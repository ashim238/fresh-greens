import {
  asyncStorageState,
  resetTestHarness,
} from './test-harness';

import {
  ACCOUNT_PURGE_MANIFEST,
  type AccountPurgeEntry,
  type AccountPurgeManifestId,
} from '../../lib/account-session/purge-manifest';
import {
  PENDING_ACCOUNT_PURGE_KEY,
  readPendingAccountPurge,
  writePendingAccountPurge,
} from '../../lib/account-session/purge-marker';
import {
  AccountPurgeRemoteError,
  createAccountPurgeCoordinator,
  type AccountPurgeCoordinatorDependencies,
} from '../../lib/account-session/purge-coordinator';

const EXPECTED_IDS = [
  'identity.user',
  'files.avatars',
  'identity.trustedContact',
  'places.saved',
  'places.regular',
  'places.recent',
  'places.preferredStations',
  'settings.preferences',
  'vehicle.fuel',
  'safety.insurance',
  'safety.roadside',
  'safety.shareSession',
  'safety.recordings',
  'calendar.connection',
  'calendar.resolutions',
  'reports.local',
  'reports.syncQueue',
  'navigation.activeRoute',
  'navigation.corridor',
  'navigation.tiles',
  'navigation.resilience',
  'auth.supabase',
] as const satisfies readonly AccountPurgeManifestId[];

function entry(
  id: AccountPurgeManifestId,
  kind: AccountPurgeEntry['kind'],
  purge: () => Promise<void>,
): AccountPurgeEntry {
  return { id, label: id, kind, purge };
}

function coordinatorDependencies(
  entries: readonly AccountPurgeEntry[],
  overrides: Partial<AccountPurgeCoordinatorDependencies> = {},
): AccountPurgeCoordinatorDependencies {
  return {
    entries,
    clearLocalCloudSession: jest.fn(async () => undefined),
    now: () => Date.parse('2026-07-15T12:00:00.000Z'),
    ...overrides,
  };
}

describe('account purge manifest', () => {
  test('contains every stable account-isolation ID exactly once', () => {
    const ids = ACCOUNT_PURGE_MANIFEST.map(({ id }) => id);

    expect(ids).toEqual(EXPECTED_IDS);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      ACCOUNT_PURGE_MANIFEST.every(
        ({ label, purge }) => label.length > 0 && typeof purge === 'function',
      ),
    ).toBe(true);
  });
});

describe('pending account purge marker', () => {
  beforeEach(resetTestHarness);
  afterEach(resetTestHarness);

  test('round-trips only recovery metadata', async () => {
    await writePendingAccountPurge({
      version: 1,
      startedAt: '2026-07-15T12:00:00.000Z',
      failedIds: ['places.saved', 'auth.supabase'],
    });

    await expect(readPendingAccountPurge()).resolves.toEqual({
      version: 1,
      startedAt: '2026-07-15T12:00:00.000Z',
      failedIds: ['places.saved', 'auth.supabase'],
    });
    expect(asyncStorageState.values.get(PENDING_ACCOUNT_PURGE_KEY)).not.toMatch(
      /token|email|coordinate|phone/i,
    );
  });

  test('rejects malformed marker data instead of treating it as safe', async () => {
    asyncStorageState.values.set(
      PENDING_ACCOUNT_PURGE_KEY,
      JSON.stringify({ version: 1, startedAt: 'today', failedIds: ['unknown'] }),
    );

    await expect(readPendingAccountPurge()).rejects.toThrow(
      'Pending account purge marker is malformed',
    );
  });
});

describe('account purge coordinator', () => {
  beforeEach(resetTestHarness);
  afterEach(resetTestHarness);

  test('writes quarantine marker before attempting any purge entry', async () => {
    const observedMarker: Array<string | undefined> = [];
    const entries = [
      entry('places.saved', 'local', async () => {
        observedMarker.push(asyncStorageState.values.get(PENDING_ACCOUNT_PURGE_KEY));
      }),
      entry('identity.user', 'identity', async () => undefined),
      entry('auth.supabase', 'remote', async () => undefined),
    ];
    const coordinator = createAccountPurgeCoordinator(
      coordinatorDependencies(entries),
    );

    await coordinator.begin();

    expect(observedMarker).toHaveLength(1);
    expect(observedMarker[0]).toBeDefined();
  });

  test('announces quarantine after the marker is durable and before purge starts', async () => {
    const order: string[] = [];
    const coordinator = createAccountPurgeCoordinator(
      coordinatorDependencies([
        entry('places.saved', 'local', async () => {
          order.push('purge');
        }),
        entry('identity.user', 'identity', async () => undefined),
        entry('auth.supabase', 'remote', async () => undefined),
      ]),
    );

    await coordinator.begin(() => {
      expect(asyncStorageState.values.has(PENDING_ACCOUNT_PURGE_KEY)).toBe(true);
      order.push('quarantine');
    });

    expect(order).toEqual(['quarantine', 'purge']);
  });

  test('waits for asynchronous quarantine work before purging stores', async () => {
    let release!: () => void;
    const quarantine = new Promise<void>((resolve) => {
      release = resolve;
    });
    const purge = jest.fn(async () => undefined);
    const coordinator = createAccountPurgeCoordinator(
      coordinatorDependencies([
        entry('places.saved', 'local', purge),
        entry('identity.user', 'identity', async () => undefined),
        entry('auth.supabase', 'remote', async () => undefined),
      ]),
    );

    const result = coordinator.begin(() => quarantine);
    await Promise.resolve();
    await Promise.resolve();
    expect(purge).not.toHaveBeenCalled();

    release();
    await result;
    expect(purge).toHaveBeenCalledTimes(1);
  });

  test('attempts every independent entry and records all failures', async () => {
    const attempted: string[] = [];
    const entries = [
      entry('places.saved', 'local', async () => {
        attempted.push('places.saved');
        throw new TypeError('saved place delete failed');
      }),
      entry('places.recent', 'local', async () => {
        attempted.push('places.recent');
        throw new Error('recent search delete failed');
      }),
      entry('identity.user', 'identity', async () => {
        attempted.push('identity.user');
      }),
      entry('auth.supabase', 'remote', async () => {
        attempted.push('auth.supabase');
      }),
    ];
    const clearLocalCloudSession = jest.fn(async () => undefined);
    const coordinator = createAccountPurgeCoordinator(
      coordinatorDependencies(entries, { clearLocalCloudSession }),
    );

    const result = await coordinator.begin();

    expect(result.status).toBe('failed');
    expect(result.failures).toEqual([
      {
        id: 'places.saved',
        errorName: 'TypeError',
        scope: 'local',
        retryable: true,
      },
      {
        id: 'places.recent',
        errorName: 'Error',
        scope: 'local',
        retryable: true,
      },
    ]);
    expect(attempted).toEqual([
      'places.saved',
      'places.recent',
      'auth.supabase',
    ]);
    expect(clearLocalCloudSession).not.toHaveBeenCalled();
    await expect(readPendingAccountPurge()).resolves.toMatchObject({
      failedIds: ['places.saved', 'places.recent'],
    });
  });

  test('commits identity and local cloud deletion only after stage two succeeds', async () => {
    const order: string[] = [];
    const entries = [
      entry('files.avatars', 'local', async () => {
        order.push('files.avatars');
      }),
      entry('identity.user', 'identity', async () => {
        order.push('identity.user');
      }),
      entry('auth.supabase', 'remote', async () => {
        order.push('auth.supabase');
      }),
    ];
    const clearLocalCloudSession = jest.fn(async () => {
      order.push('auth.local');
    });
    const coordinator = createAccountPurgeCoordinator(
      coordinatorDependencies(entries, { clearLocalCloudSession }),
    );

    await expect(coordinator.begin()).resolves.toEqual({
      status: 'completed',
      failures: [],
    });

    expect(new Set(order.slice(0, 2))).toEqual(
      new Set(['files.avatars', 'auth.supabase']),
    );
    expect(order.slice(2)).toEqual(['identity.user', 'auth.local']);
    expect(asyncStorageState.values.has(PENDING_ACCOUNT_PURGE_KEY)).toBe(false);
  });

  test('reports local cloud deletion as the auth manifest failure', async () => {
    const entries = [
      entry('identity.user', 'identity', async () => undefined),
      entry('auth.supabase', 'remote', async () => undefined),
    ];
    const coordinator = createAccountPurgeCoordinator(
      coordinatorDependencies(entries, {
        clearLocalCloudSession: async () => {
          throw new Error('secure deletion failed');
        },
      }),
    );

    await expect(coordinator.begin()).resolves.toEqual({
      status: 'failed',
      failures: [
        {
          id: 'auth.supabase',
          errorName: 'Error',
          scope: 'local',
          retryable: true,
        },
      ],
    });
    await expect(readPendingAccountPurge()).resolves.toMatchObject({
      failedIds: ['auth.supabase'],
    });
  });

  test('retry resumes local cloud deletion after revocation already succeeded', async () => {
    const remotePurge = jest.fn(async () => undefined);
    const clearLocalCloudSession = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('secure deletion failed'))
      .mockResolvedValueOnce(undefined);
    const coordinator = createAccountPurgeCoordinator(
      coordinatorDependencies(
        [
          entry('identity.user', 'identity', async () => undefined),
          entry('auth.supabase', 'remote', remotePurge),
        ],
        { clearLocalCloudSession },
      ),
    );

    await expect(coordinator.begin()).resolves.toMatchObject({
      status: 'failed',
    });
    await expect(coordinator.recover()).resolves.toMatchObject({
      status: 'completed',
    });

    expect(remotePurge).toHaveBeenCalledTimes(1);
    expect(clearLocalCloudSession).toHaveBeenCalledTimes(2);
  });

  test('keeps credentials for retry when remote revocation is retryable', async () => {
    const identityPurge = jest.fn(async () => undefined);
    const clearLocalCloudSession = jest.fn(async () => undefined);
    const entries = [
      entry('places.saved', 'local', async () => undefined),
      entry('identity.user', 'identity', identityPurge),
      entry('auth.supabase', 'remote', async () => {
        throw new AccountPurgeRemoteError('network', true);
      }),
    ];
    const coordinator = createAccountPurgeCoordinator(
      coordinatorDependencies(entries, { clearLocalCloudSession }),
    );

    await expect(coordinator.begin()).resolves.toEqual({
      status: 'failed',
      failures: [
        {
          id: 'auth.supabase',
          errorName: 'AccountPurgeRemoteError',
          scope: 'remote',
          retryable: true,
        },
      ],
    });
    expect(identityPurge).not.toHaveBeenCalled();
    expect(clearLocalCloudSession).not.toHaveBeenCalled();
  });

  test('can finish locally after a retryable remote-only failure', async () => {
    const identityPurge = jest.fn(async () => undefined);
    const remotePurge = jest.fn(async () => {
      throw new AccountPurgeRemoteError('network', true);
    });
    const clearLocalCloudSession = jest.fn(async () => undefined);
    const coordinator = createAccountPurgeCoordinator(
      coordinatorDependencies(
        [
          entry('identity.user', 'identity', identityPurge),
          entry('auth.supabase', 'remote', remotePurge),
        ],
        { clearLocalCloudSession },
      ),
    );

    await expect(coordinator.begin()).resolves.toMatchObject({
      status: 'failed',
    });
    await expect(coordinator.finishOnDevice()).resolves.toEqual({
      status: 'completed-locally',
      failures: [],
    });

    expect(remotePurge).toHaveBeenCalledTimes(1);
    expect(identityPurge).toHaveBeenCalledTimes(1);
    expect(clearLocalCloudSession).toHaveBeenCalledTimes(1);
    expect(asyncStorageState.values.has(PENDING_ACCOUNT_PURGE_KEY)).toBe(false);
  });

  test('does not allow local finish after a non-retryable remote failure', async () => {
    const coordinator = createAccountPurgeCoordinator(
      coordinatorDependencies([
        entry('identity.user', 'identity', async () => undefined),
        entry('auth.supabase', 'remote', async () => {
          throw new AccountPurgeRemoteError('unexpected-client', false);
        }),
      ]),
    );

    await coordinator.begin();

    await expect(coordinator.finishOnDevice()).rejects.toThrow(
      'Finishing on this device is not available',
    );
  });

  test('recovery retries only failed IDs plus their safe commit dependencies', async () => {
    const attempted: string[] = [];
    await writePendingAccountPurge({
      version: 1,
      startedAt: '2026-07-15T11:00:00.000Z',
      failedIds: ['places.saved'],
    });
    const entries = [
      entry('places.saved', 'local', async () => {
        attempted.push('places.saved');
      }),
      entry('places.recent', 'local', async () => {
        attempted.push('places.recent');
      }),
      entry('identity.user', 'identity', async () => {
        attempted.push('identity.user');
      }),
      entry('auth.supabase', 'remote', async () => {
        attempted.push('auth.supabase');
      }),
    ];
    const coordinator = createAccountPurgeCoordinator(
      coordinatorDependencies(entries),
    );

    await expect(coordinator.recover()).resolves.toMatchObject({
      status: 'completed',
    });

    expect(attempted).toEqual(['places.saved', 'identity.user']);
  });

  test('recovery with an empty failure list treats the prior run as interrupted', async () => {
    const purge = jest.fn(async () => undefined);
    await writePendingAccountPurge({
      version: 1,
      startedAt: '2026-07-15T11:00:00.000Z',
      failedIds: [],
    });
    const coordinator = createAccountPurgeCoordinator(
      coordinatorDependencies([
        entry('places.saved', 'local', purge),
        entry('identity.user', 'identity', purge),
        entry('auth.supabase', 'remote', purge),
      ]),
    );

    await coordinator.recover();

    expect(purge).toHaveBeenCalledTimes(3);
  });

  test('begin stops before quarantine when the marker cannot be written', async () => {
    const purge = jest.fn(async () => undefined);
    asyncStorageState.failNext('setItem', new Error('marker write failed'));
    const coordinator = createAccountPurgeCoordinator(
      coordinatorDependencies([
        entry('places.saved', 'local', purge),
        entry('identity.user', 'identity', purge),
        entry('auth.supabase', 'remote', purge),
      ]),
    );

    await expect(coordinator.begin()).rejects.toThrow('marker write failed');
    expect(purge).not.toHaveBeenCalled();
  });

  test('shares one in-flight purge when begin is called twice', async () => {
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const purge = jest.fn(async () => wait);
    const coordinator = createAccountPurgeCoordinator(
      coordinatorDependencies([
        entry('places.saved', 'local', purge),
        entry('identity.user', 'identity', async () => undefined),
        entry('auth.supabase', 'remote', async () => undefined),
      ]),
    );

    const first = coordinator.begin();
    const second = coordinator.begin();
    await Promise.resolve();
    release();

    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: 'completed', failures: [] },
      { status: 'completed', failures: [] },
    ]);
    expect(purge).toHaveBeenCalledTimes(1);
  });
});
