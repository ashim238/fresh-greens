import {
  assertHarnessIdle,
  asyncStorageState,
  createTrackedAbortController,
  deferred,
  fetchMock,
  resetTestHarness,
  secureStoreState,
} from './test-harness';

const AsyncStorage = require('@react-native-async-storage/async-storage')
  .default as typeof import('@react-native-async-storage/async-storage').default;
const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
const {
  SUPABASE_LEGACY_SESSION_KEY,
  SUPABASE_SECURE_SESSION_KEY,
  supabaseCloudSessionOwner,
} = require('../../lib/cloud-session') as typeof import('../../lib/cloud-session');
const {
  getAuthHeaders,
  getAuthUserId,
  getSession,
  signInAnonymously,
  signOut,
} = require('../../lib/supabase-auth') as typeof import('../../lib/supabase-auth');

type StoredSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; is_anonymous?: boolean };
};

const ACCESS_TOKEN = 'access-token-private-value';
const REFRESH_TOKEN = 'refresh-token-private-value';
const RESPONSE_SECRET = 'response-body-private-value';

function session(
  overrides: Partial<StoredSession> = {},
): StoredSession {
  return {
    access_token: ACCESS_TOKEN,
    refresh_token: REFRESH_TOKEN,
    expires_at: Date.now() / 1000 + 3600,
    user: { id: 'cloud-user-1', is_anonymous: true },
    ...overrides,
  };
}

function response(
  status: number,
  body: unknown = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn(async () => body),
    text: jest.fn(async () => JSON.stringify(body)),
  } as unknown as Response;
}

function seedSecure(value: StoredSession = session()): void {
  secureStoreState.values.set(
    SUPABASE_SECURE_SESSION_KEY,
    JSON.stringify(value),
  );
}

function seedLegacy(value: StoredSession = session()): void {
  asyncStorageState.values.set(
    SUPABASE_LEGACY_SESSION_KEY,
    JSON.stringify(value),
  );
}

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

async function expectRedactedRejection(
  promise: Promise<unknown>,
): Promise<Error> {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(Error);
  const rendered = errorText(error);
  expect(rendered).not.toContain(ACCESS_TOKEN);
  expect(rendered).not.toContain(REFRESH_TOKEN);
  expect(rendered).not.toContain(RESPONSE_SECRET);
  return error as Error;
}

async function expectCloudOperation(
  promise: Promise<unknown>,
  operation: string,
): Promise<void> {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toMatchObject({
    name: 'CloudSessionError',
    code: 'CLOUD_SESSION_ERROR',
    operation,
  });
}

async function waitForCall(mock: jest.Mock): Promise<void> {
  for (let attempt = 0; attempt < 20 && mock.mock.calls.length === 0; attempt += 1) {
    await Promise.resolve();
  }
  expect(mock).toHaveBeenCalled();
}

async function waitForCalls(mock: jest.Mock, count: number): Promise<void> {
  for (
    let attempt = 0;
    attempt < 30 && mock.mock.calls.length < count;
    attempt += 1
  ) {
    await Promise.resolve();
  }
}

describe('supabaseCloudSessionOwner', () => {
  beforeEach(async () => {
    resetTestHarness();
    await supabaseCloudSessionOwner.clearLocalSession();
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.example.test/';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-anon-key';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    assertHarnessIdle();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('hydrates a typed missing result without inventing a session', async () => {
    await expect(
      supabaseCloudSessionOwner.hydrateLocalSession(),
    ).resolves.toEqual({ kind: 'missing' });
    await expect(getSession()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('hydrates a typed found result from a strictly valid secure value', async () => {
    const stored = session();
    seedSecure(stored);

    await expect(
      supabaseCloudSessionOwner.hydrateLocalSession(),
    ).resolves.toEqual({ kind: 'found' });
    await expect(getSession()).resolves.toEqual(stored);
  });

  test.each([
    ['invalid JSON', `{ "access_token": "${ACCESS_TOKEN}"`],
    ['missing refresh token', JSON.stringify({ ...session(), refresh_token: undefined })],
    ['empty access token', JSON.stringify(session({ access_token: '' }))],
    ['whitespace access token', JSON.stringify(session({ access_token: '   ' }))],
    ['whitespace refresh token', JSON.stringify(session({ refresh_token: '\n\t' }))],
    ['invalid expiry', JSON.stringify(session({ expires_at: Number.NaN }))],
    ['missing user id', JSON.stringify(session({ user: { id: '' } }))],
    ['whitespace user id', JSON.stringify(session({ user: { id: '   ' } }))],
    [
      'invalid anonymous flag',
      JSON.stringify(session({ user: { id: 'cloud-user-1', is_anonymous: 'yes' as never } })),
    ],
  ])('rejects a malformed secure session: %s', async (_name, raw) => {
    secureStoreState.values.set(SUPABASE_SECURE_SESSION_KEY, raw);
    seedLegacy();

    await expectRedactedRejection(
      supabaseCloudSessionOwner.hydrateLocalSession(),
    );

    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(asyncStorageState.values.has(SUPABASE_LEGACY_SESSION_KEY)).toBe(true);
  });

  test('fails closed on a SecureStore read error without consulting or deleting legacy storage', async () => {
    seedLegacy();
    secureStoreState.failNext(
      'getItemAsync',
      new Error(`read failed with ${ACCESS_TOKEN}`),
    );

    await expectRedactedRejection(
      supabaseCloudSessionOwner.hydrateLocalSession(),
    );

    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(asyncStorageState.values.has(SUPABASE_LEGACY_SESSION_KEY)).toBe(true);
  });

  test('migrates a valid legacy session by completing the secure write before legacy removal', async () => {
    const legacy = session();
    seedLegacy(legacy);
    const write = deferred<void>();
    secureStoreState.deferNext('setItemAsync', write);

    const hydration = supabaseCloudSessionOwner.hydrateLocalSession();
    await waitForCall(SecureStore.setItemAsync as jest.Mock);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      SUPABASE_SECURE_SESSION_KEY,
      JSON.stringify(legacy),
      expect.objectContaining({
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      }),
    );
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(asyncStorageState.values.has(SUPABASE_LEGACY_SESSION_KEY)).toBe(true);

    write.resolve();
    await expect(hydration).resolves.toEqual({ kind: 'found' });
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      SUPABASE_LEGACY_SESSION_KEY,
    );
    expect(secureStoreState.values.get(SUPABASE_SECURE_SESSION_KEY)).toBe(
      JSON.stringify(legacy),
    );
    expect(asyncStorageState.values.has(SUPABASE_LEGACY_SESSION_KEY)).toBe(false);
  });

  test('single-flights concurrent legacy hydration through one secure migration write', async () => {
    const legacy = session();
    seedLegacy(legacy);

    const results = await Promise.all([
      supabaseCloudSessionOwner.hydrateLocalSession(),
      supabaseCloudSessionOwner.hydrateLocalSession(),
    ]);

    expect(results).toEqual([{ kind: 'found' }, { kind: 'found' }]);
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(secureStoreState.values.get(SUPABASE_SECURE_SESSION_KEY)).toBe(
      JSON.stringify(legacy),
    );
    expect(asyncStorageState.values.has(SUPABASE_LEGACY_SESSION_KEY)).toBe(false);
  });

  test('keeps the only valid legacy credential when the secure migration write fails', async () => {
    seedLegacy();
    secureStoreState.failNext(
      'setItemAsync',
      new Error(`secure write exposed ${REFRESH_TOKEN}`),
    );

    await expectRedactedRejection(
      supabaseCloudSessionOwner.hydrateLocalSession(),
    );

    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(asyncStorageState.values.has(SUPABASE_LEGACY_SESSION_KEY)).toBe(true);
    expect(secureStoreState.values.has(SUPABASE_SECURE_SESSION_KEY)).toBe(false);
  });

  test('retains both copies after legacy cleanup fails and retries cleanup without losing module memory', async () => {
    const legacy = session();
    seedLegacy(legacy);
    asyncStorageState.failNext(
      'removeItem',
      new Error(`legacy cleanup exposed ${ACCESS_TOKEN}`),
    );

    await expectRedactedRejection(
      supabaseCloudSessionOwner.hydrateLocalSession(),
    );

    expect(secureStoreState.values.get(SUPABASE_SECURE_SESSION_KEY)).toBe(
      JSON.stringify(legacy),
    );
    expect(asyncStorageState.values.has(SUPABASE_LEGACY_SESSION_KEY)).toBe(true);
    await expect(getSession()).resolves.toEqual(legacy);

    await expect(
      supabaseCloudSessionOwner.hydrateLocalSession(),
    ).resolves.toEqual({ kind: 'found' });
    expect(asyncStorageState.values.has(SUPABASE_LEGACY_SESSION_KEY)).toBe(false);
  });

  test('clearLocalSession attempts secure and legacy deletion and clears module memory', async () => {
    const stored = session();
    seedSecure(stored);
    seedLegacy(stored);
    await supabaseCloudSessionOwner.hydrateLocalSession();
    jest.clearAllMocks();

    await expect(
      supabaseCloudSessionOwner.clearLocalSession(),
    ).resolves.toBeUndefined();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      SUPABASE_SECURE_SESSION_KEY,
    );
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      SUPABASE_LEGACY_SESSION_KEY,
    );
    secureStoreState.values.delete(SUPABASE_SECURE_SESSION_KEY);
    await expect(getSession()).resolves.toBeNull();
  });

  test('clearLocalSession surfaces partial failure after attempting every boundary and remains retryable', async () => {
    seedSecure();
    seedLegacy();
    secureStoreState.failNext(
      'deleteItemAsync',
      new Error(`delete failed with ${ACCESS_TOKEN}`),
    );

    await expectRedactedRejection(
      supabaseCloudSessionOwner.clearLocalSession(),
    );

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      SUPABASE_LEGACY_SESSION_KEY,
    );
    expect(secureStoreState.values.has(SUPABASE_SECURE_SESSION_KEY)).toBe(true);
    expect(asyncStorageState.values.has(SUPABASE_LEGACY_SESSION_KEY)).toBe(false);

    await expect(
      supabaseCloudSessionOwner.clearLocalSession(),
    ).resolves.toBeUndefined();
    expect(secureStoreState.values.has(SUPABASE_SECURE_SESSION_KEY)).toBe(false);
  });

  test('clear synchronously blocks local session operations until deferred deletion succeeds', async () => {
    seedSecure();
    await supabaseCloudSessionOwner.hydrateLocalSession();
    jest.clearAllMocks();
    const deletion = deferred<void>();
    secureStoreState.deferNext('deleteItemAsync', deletion);

    const clearing = supabaseCloudSessionOwner.clearLocalSession();
    const blocked = await Promise.allSettled([
      getSession(),
      supabaseCloudSessionOwner.hydrateLocalSession(),
      supabaseCloudSessionOwner.ensureSession(),
      supabaseCloudSessionOwner.revokeCurrentSession(),
    ]);
    const secureReadsWhileClearing = (SecureStore.getItemAsync as jest.Mock)
      .mock.calls.length;
    const fetchesWhileClearing = fetchMock.mock.calls.length;

    deletion.resolve();
    await expect(clearing).resolves.toBeUndefined();
    expect(blocked.every((result) => result.status === 'rejected')).toBe(true);
    expect(secureReadsWhileClearing).toBe(0);
    expect(fetchesWhileClearing).toBe(0);
    await expect(getSession()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('partial clear failure stays fail-closed until an explicit clear retry succeeds', async () => {
    seedSecure();
    seedLegacy();
    secureStoreState.failNext(
      'deleteItemAsync',
      new Error(`delete failed with ${ACCESS_TOKEN}`),
    );

    await expectRedactedRejection(
      supabaseCloudSessionOwner.clearLocalSession(),
    );
    jest.clearAllMocks();

    const blocked = await Promise.allSettled([
      getSession(),
      supabaseCloudSessionOwner.hydrateLocalSession(),
      supabaseCloudSessionOwner.ensureSession(),
      supabaseCloudSessionOwner.revokeCurrentSession(),
    ]);
    expect(blocked.every((result) => result.status === 'rejected')).toBe(true);
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    await expect(
      supabaseCloudSessionOwner.clearLocalSession(),
    ).resolves.toBeUndefined();
    await expect(getSession()).resolves.toBeNull();
  });

  test('only the latest concurrent clear completion reopens local session operations', async () => {
    seedSecure();
    const firstDeletion = deferred<void>();
    const secondDeletion = deferred<void>();
    secureStoreState.deferNext('deleteItemAsync', firstDeletion);
    secureStoreState.deferNext('deleteItemAsync', secondDeletion);

    const firstClear = supabaseCloudSessionOwner.clearLocalSession();
    const secondClear = supabaseCloudSessionOwner.clearLocalSession();
    firstDeletion.resolve();
    await expect(firstClear).resolves.toBeUndefined();

    const whileSecondClear = await getSession().catch(
      (error: unknown) => error,
    );
    const secureReadsWhileSecondClear = (SecureStore.getItemAsync as jest.Mock)
      .mock.calls.length;

    secondDeletion.resolve();
    await expect(secondClear).resolves.toBeUndefined();
    expect(whileSecondClear).toMatchObject({
      name: 'CloudSessionError',
      operation: 'local',
    });
    expect(secureReadsWhileSecondClear).toBe(0);
    await expect(getSession()).resolves.toBeNull();
  });

  test('ensures a missing session through anonymous signup and persists it securely', async () => {
    const created = session();
    fetchMock.mockResolvedValueOnce(response(200, created));

    await expect(
      supabaseCloudSessionOwner.ensureSession(),
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://project.example.test/auth/v1/signup',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(secureStoreState.values.get(SUPABASE_SECURE_SESSION_KEY)).toBe(
      JSON.stringify(created),
    );
    expect(asyncStorageState.values.has(SUPABASE_LEGACY_SESSION_KEY)).toBe(false);
    await expect(getSession()).resolves.toEqual(created);
  });

  test('single-flights concurrent missing-session ensures through one signup', async () => {
    const firstNetwork = deferred<Response>();
    const secondNetwork = deferred<Response>();
    const firstCreated = session();
    const secondCreated = session({
      access_token: 'second-access-token',
      refresh_token: 'second-refresh-token',
      user: { id: 'cloud-user-2', is_anonymous: true },
    });
    fetchMock
      .mockReturnValueOnce(firstNetwork.promise)
      .mockReturnValueOnce(secondNetwork.promise);

    const first = signInAnonymously();
    const second = signInAnonymously();
    await waitForCalls(fetchMock, 2);
    const requestCount = fetchMock.mock.calls.length;

    firstNetwork.resolve(response(200, firstCreated));
    secondNetwork.resolve(response(200, secondCreated));
    const results = await Promise.all([first, second]);

    expect(requestCount).toBe(1);
    expect(results).toEqual([firstCreated, firstCreated]);
    await expect(getSession()).resolves.toEqual(firstCreated);
  });

  test('an ensure aborted while queued does not cancel the shared session decision', async () => {
    const network = deferred<Response>();
    const created = session();
    const controller = createTrackedAbortController();
    fetchMock.mockReturnValueOnce(network.promise);

    const first = supabaseCloudSessionOwner.ensureSession();
    const queued = supabaseCloudSessionOwner.ensureSession(controller.signal);
    let queuedSettled = false;
    const queuedOutcome = queued.catch((error: unknown) => {
      queuedSettled = true;
      return error;
    });
    await waitForCall(fetchMock);
    controller.abort();
    for (let attempt = 0; attempt < 10 && !queuedSettled; attempt += 1) {
      await Promise.resolve();
    }
    const settledBeforeSharedWork = queuedSettled;
    network.resolve(response(200, created));

    await expect(first).resolves.toBeUndefined();
    const queuedError = await queuedOutcome;
    expect(queuedError).toMatchObject({
      name: 'CloudSessionError',
      operation: 'abort',
    });
    expect(settledBeforeSharedWork).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(getSession()).resolves.toEqual(created);
  });

  test('refreshes an expiring session and persists the replacement before exposing it', async () => {
    const expiring = session({ expires_at: Date.now() / 1000 + 30 });
    const refreshed = session({
      access_token: 'refreshed-access-token',
      refresh_token: 'refreshed-refresh-token',
      expires_at: Date.now() / 1000 + 7200,
    });
    seedSecure(expiring);
    fetchMock.mockResolvedValueOnce(response(200, refreshed));

    await expect(getSession()).resolves.toEqual(refreshed);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/token?grant_type=refresh_token',
    );
    expect(secureStoreState.values.get(SUPABASE_SECURE_SESSION_KEY)).toBe(
      JSON.stringify(refreshed),
    );
  });

  test('single-flights concurrent expiring-session reads through one refresh', async () => {
    const expiring = session({ expires_at: Date.now() / 1000 + 30 });
    const firstNetwork = deferred<Response>();
    const secondNetwork = deferred<Response>();
    const firstRefreshed = session({
      access_token: 'first-refreshed-access',
      refresh_token: 'first-refreshed-refresh',
      expires_at: Date.now() / 1000 + 7200,
    });
    const secondRefreshed = session({
      access_token: 'second-refreshed-access',
      refresh_token: 'second-refreshed-refresh',
      expires_at: Date.now() / 1000 + 7200,
    });
    seedSecure(expiring);
    fetchMock
      .mockReturnValueOnce(firstNetwork.promise)
      .mockReturnValueOnce(secondNetwork.promise);

    const first = getSession();
    const second = getSession();
    await waitForCalls(fetchMock, 2);
    const requestCount = fetchMock.mock.calls.length;

    firstNetwork.resolve(response(200, firstRefreshed));
    secondNetwork.resolve(response(200, secondRefreshed));
    const results = await Promise.all([first, second]);

    expect(requestCount).toBe(1);
    expect(results).toEqual([firstRefreshed, firstRefreshed]);
    expect(secureStoreState.values.get(SUPABASE_SECURE_SESSION_KEY)).toBe(
      JSON.stringify(firstRefreshed),
    );
  });

  test('does not create a replacement session after a transient refresh failure', async () => {
    const expiring = session({ expires_at: Date.now() / 1000 + 30 });
    seedSecure(expiring);
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    fetchMock.mockRejectedValueOnce(
      new Error(`network failure ${REFRESH_TOKEN}`),
    );

    await expect(signInAnonymously()).resolves.toBeNull();

    expect(warning).toHaveBeenCalledWith(
      '[supabase-auth] anonymous signup failed',
    );
    expect(JSON.stringify(warning.mock.calls)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(warning.mock.calls)).not.toContain(REFRESH_TOKEN);
    warning.mockRestore();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/token?grant_type=refresh_token',
    );
    expect(secureStoreState.values.get(SUPABASE_SECURE_SESSION_KEY)).toBe(
      JSON.stringify(expiring),
    );
  });

  test('does not persist a signup result when its abort signal becomes stale', async () => {
    const network = deferred<Response>();
    const controller = createTrackedAbortController();
    fetchMock.mockReturnValueOnce(network.promise);

    const ensuring = supabaseCloudSessionOwner.ensureSession(controller.signal);
    await Promise.resolve();
    controller.abort();
    network.resolve(response(200, session()));

    await expectRedactedRejection(ensuring);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(secureStoreState.values.has(SUPABASE_SECURE_SESSION_KEY)).toBe(false);
  });

  test('maps a native in-flight fetch abort to the abort operation', async () => {
    const controller = createTrackedAbortController();
    fetchMock.mockImplementationOnce((_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => {
            const error = new Error('native request aborted');
            error.name = 'AbortError';
            reject(error);
          },
          { once: true },
        );
      }),
    );

    const ensuring = supabaseCloudSessionOwner.ensureSession(controller.signal);
    await waitForCall(fetchMock);
    controller.abort();

    await expectCloudOperation(ensuring, 'abort');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  test('clear invalidates an in-flight secure persistence generation and wins the mutation race', async () => {
    fetchMock.mockResolvedValueOnce(response(200, session()));
    const write = deferred<void>();
    secureStoreState.deferNext('setItemAsync', write);

    const ensuring = supabaseCloudSessionOwner.ensureSession();
    const ensureOutcome = ensuring.catch((error: unknown) => error);
    await waitForCall(SecureStore.setItemAsync as jest.Mock);

    const clearing = supabaseCloudSessionOwner.clearLocalSession();
    write.resolve();

    const ensureError = await ensureOutcome;
    expect(ensureError).toBeInstanceOf(Error);
    expect(errorText(ensureError)).not.toContain(ACCESS_TOKEN);
    await expect(clearing).resolves.toBeUndefined();
    expect(secureStoreState.values.has(SUPABASE_SECURE_SESSION_KEY)).toBe(false);
    expect(asyncStorageState.values.has(SUPABASE_LEGACY_SESSION_KEY)).toBe(false);
    await expect(getSession()).resolves.toBeNull();
  });

  test('rejects a malformed successful auth response without persisting or exposing its body', async () => {
    fetchMock.mockResolvedValueOnce(
      response(200, {
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
        response_secret: RESPONSE_SECRET,
        user: {},
      }),
    );

    await expectRedactedRejection(
      supabaseCloudSessionOwner.ensureSession(),
    );

    expect(secureStoreState.values.has(SUPABASE_SECURE_SESSION_KEY)).toBe(false);
    await expect(getSession()).resolves.toBeNull();
  });

  test.each([
    ['access token', session({ access_token: '   ' })],
    ['refresh token', session({ refresh_token: '\n\t' })],
    ['user id', session({ user: { id: '   ' } })],
  ])(
    'rejects a successful auth response with a whitespace-only %s',
    async (_field, payload) => {
      fetchMock.mockResolvedValueOnce(response(200, payload));

      await expectRedactedRejection(
        supabaseCloudSessionOwner.ensureSession(),
      );

      expect(secureStoreState.values.has(SUPABASE_SECURE_SESSION_KEY)).toBe(
        false,
      );
    },
  );

  test('revoke returns no-session without making a request', async () => {
    await expect(
      supabaseCloudSessionOwner.revokeCurrentSession(),
    ).resolves.toEqual({ kind: 'terminal', reason: 'no-session' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('single-flights concurrent revoke callers through one terminal result', async () => {
    seedSecure();
    const network = deferred<Response>();
    fetchMock
      .mockReturnValueOnce(network.promise)
      .mockResolvedValueOnce(response(200));

    const first = supabaseCloudSessionOwner.revokeCurrentSession();
    const second = supabaseCloudSessionOwner.revokeCurrentSession();
    await waitForCall(fetchMock);
    network.resolve(response(200));
    const results = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results[0]).toBe(results[1]);
    expect(results[0]).toEqual({ kind: 'terminal', reason: 'revoked' });
  });

  test('single-flights concurrent retryable revoke and allows a later explicit retry', async () => {
    seedSecure();
    const network = deferred<Response>();
    fetchMock
      .mockReturnValueOnce(network.promise)
      .mockResolvedValue(response(200));

    const first = supabaseCloudSessionOwner.revokeCurrentSession();
    const second = supabaseCloudSessionOwner.revokeCurrentSession();
    await waitForCall(fetchMock);
    network.resolve(response(503));
    const results = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results[0]).toBe(results[1]);
    expect(results[0]).toMatchObject({
      kind: 'retryable',
      reason: 'server',
    });

    await expect(
      supabaseCloudSessionOwner.revokeCurrentSession(),
    ).resolves.toEqual({ kind: 'terminal', reason: 'revoked' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('one concurrent revoke caller can abort without cancelling the shared request', async () => {
    seedSecure();
    const network = deferred<Response>();
    const controller = createTrackedAbortController();
    fetchMock.mockReturnValueOnce(network.promise);

    const first = supabaseCloudSessionOwner.revokeCurrentSession(
      controller.signal,
    );
    const firstOutcome = first.catch((error: unknown) => error);
    const second = supabaseCloudSessionOwner.revokeCurrentSession();
    await waitForCall(fetchMock);
    controller.abort();
    network.resolve(response(200));

    await expect(firstOutcome).resolves.toMatchObject({
      name: 'CloudSessionError',
      operation: 'abort',
    });
    await expect(second).resolves.toEqual({
      kind: 'terminal',
      reason: 'revoked',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test.each([
    [200, {}, { kind: 'terminal', reason: 'revoked' }],
    [204, {}, { kind: 'terminal', reason: 'revoked' }],
    [401, { message: RESPONSE_SECRET }, { kind: 'terminal', reason: 'auth-invalid' }],
    [403, { message: RESPONSE_SECRET }, { kind: 'terminal', reason: 'auth-invalid' }],
    [422, { error_code: 'refresh_token_expired' }, { kind: 'terminal', reason: 'auth-invalid' }],
    [404, { code: 'session_not_found' }, { kind: 'terminal', reason: 'auth-invalid' }],
    [400, { message: 'invalid jwt' }, { kind: 'terminal', reason: 'auth-invalid' }],
    [400, { message: 'Session is invalid' }, { kind: 'terminal', reason: 'auth-invalid' }],
  ])(
    'classifies revoke HTTP %i as terminal',
    async (status, body, expected) => {
      seedSecure();
      fetchMock.mockResolvedValueOnce(response(status, body));

      await expect(
        supabaseCloudSessionOwner.revokeCurrentSession(),
      ).resolves.toEqual(expected);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://project.example.test/auth/v1/logout',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${ACCESS_TOKEN}`,
          }),
        }),
      );
    },
  );

  test('classifies a fetch rejection as retryable network without exposing the cause', async () => {
    seedSecure();
    fetchMock.mockRejectedValueOnce(
      new Error(`offline ${ACCESS_TOKEN} ${RESPONSE_SECRET}`),
    );

    const result = await supabaseCloudSessionOwner.revokeCurrentSession();

    expect(result).toMatchObject({ kind: 'retryable', reason: 'network' });
    if (result.kind !== 'retryable') throw new Error('Expected retryable result');
    expect(errorText(result.error)).not.toContain(ACCESS_TOKEN);
    expect(errorText(result.error)).not.toContain(RESPONSE_SECRET);
  });

  test('revoke rethrows a native in-flight abort instead of classifying it as network', async () => {
    seedSecure();
    const controller = createTrackedAbortController();
    fetchMock.mockImplementationOnce((_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => {
            const error = new Error('native logout aborted');
            error.name = 'AbortError';
            reject(error);
          },
          { once: true },
        );
      }),
    );

    const revoking = supabaseCloudSessionOwner.revokeCurrentSession(
      controller.signal,
    );
    await waitForCall(fetchMock);
    controller.abort();

    await expectCloudOperation(revoking, 'abort');
  });

  test('revoke rethrows a stale generation detected after fetch settles', async () => {
    seedSecure();
    const network = deferred<Response>();
    fetchMock.mockReturnValueOnce(network.promise);

    const revoking = supabaseCloudSessionOwner.revokeCurrentSession();
    await waitForCall(fetchMock);
    await supabaseCloudSessionOwner.clearLocalSession();
    network.resolve(response(200));

    await expectCloudOperation(revoking, 'stale');
  });

  test('classifies 5xx as retryable server without exposing the response body', async () => {
    seedSecure();
    fetchMock.mockResolvedValueOnce(
      response(503, { message: RESPONSE_SECRET, token: ACCESS_TOKEN }),
    );

    const result = await supabaseCloudSessionOwner.revokeCurrentSession();

    expect(result).toMatchObject({ kind: 'retryable', reason: 'server' });
    if (result.kind !== 'retryable') throw new Error('Expected retryable result');
    expect(errorText(result.error)).not.toContain(ACCESS_TOKEN);
    expect(errorText(result.error)).not.toContain(RESPONSE_SECRET);
  });

  test.each([
    [409, { message: 'Invalid request payload', detail: RESPONSE_SECRET }],
    [422, { message: 'Community report expired', detail: RESPONSE_SECRET }],
    [400, { message: 'Authentication request invalid', detail: RESPONSE_SECRET }],
    [409, { message: 'Session invalidation request failed', detail: RESPONSE_SECRET }],
    [409, { message: 'Session badge conflict', detail: RESPONSE_SECRET }],
    [
      409,
      {
        code: 'session_conflict',
        message: 'Invalid request payload',
        detail: RESPONSE_SECRET,
      },
    ],
  ])(
    'keeps non-auth HTTP %i client errors as redacted required failures',
    async (status, body) => {
      seedSecure();
      fetchMock.mockResolvedValueOnce(
        response(status, { ...body, token: ACCESS_TOKEN }),
      );

      const result = await supabaseCloudSessionOwner.revokeCurrentSession();

      expect(result).toMatchObject({
        kind: 'required-failure',
        reason: 'unexpected-client',
      });
      if (result.kind !== 'required-failure') {
        throw new Error('Expected required failure');
      }
      expect(errorText(result.error)).not.toContain(ACCESS_TOKEN);
      expect(errorText(result.error)).not.toContain(RESPONSE_SECRET);
    },
  );

  test('keeps the existing supabase-auth public functions delegated and functional', async () => {
    const created = session();
    fetchMock.mockResolvedValueOnce(response(200, created));

    await expect(signInAnonymously()).resolves.toEqual(created);
    await expect(getAuthUserId()).resolves.toBe(created.user.id);
    await expect(getAuthHeaders()).resolves.toEqual({
      apikey: 'public-anon-key',
      Authorization: `Bearer ${created.access_token}`,
      'Content-Type': 'application/json',
    });

    await expect(signOut()).resolves.toBeUndefined();
    expect(secureStoreState.values.has(SUPABASE_SECURE_SESSION_KEY)).toBe(false);
    expect(asyncStorageState.values.has(SUPABASE_LEGACY_SESSION_KEY)).toBe(false);
  });
});
