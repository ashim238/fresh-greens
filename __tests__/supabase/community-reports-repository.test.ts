import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { accountOperationGate } from '../../lib/account-session/operation-gate';
import * as deviceUuidModule from '../../lib/device-uuid';
import { createBackendAuthRepository } from '../../lib/supabase/auth-repository';
import { backendAuthRepository } from '../../lib/supabase/auth-repository';
import * as communityRepositoryModule from '../../lib/supabase/community-reports-repository';
import {
  createCommunityReportsRepository,
  type CommunityReportInsert,
  type CommunityReportPublicRow,
} from '../../lib/supabase/community-reports-repository';
import type { Database } from '../../lib/supabase/database.types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

type QueryResponse<T> = {
  data: T;
  error: { code?: string; message?: string; details?: string } | null;
};

type QueryBuilder<T> = PromiseLike<QueryResponse<T>> & {
  select: jest.Mock;
  order: jest.Mock;
  insert: jest.Mock;
  abortSignal: jest.Mock;
};

function queryBuilder<T>(response: QueryResponse<T>): QueryBuilder<T> {
  const builder = {
    select: jest.fn(),
    order: jest.fn(),
    insert: jest.fn(),
    abortSignal: jest.fn(),
    then: <TResult1 = QueryResponse<T>, TResult2 = never>(
      onfulfilled?: ((value: QueryResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(response).then(onfulfilled, onrejected),
  } as QueryBuilder<T>;
  builder.select.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.abortSignal.mockReturnValue(builder);
  return builder;
}

function user(id: string, isAnonymous = false): User {
  return {
    id,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
    is_anonymous: isAnonymous,
  };
}

function session(id: string, isAnonymous = false): Session {
  return {
    access_token: 'synthetic-access-token',
    refresh_token: 'synthetic-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: user(id, isAnonymous),
  };
}

const publicRow: CommunityReportPublicRow = {
  id: 'report-a',
  category_id: 'lighting',
  location: { latitude: 40.7, longitude: -74 },
  detail: 'Dark block',
  sub_tag: 'Dim area',
  place_name: null,
  place_type: null,
  google_place_id: null,
  submitted_by: null,
  photo_uri: null,
  timestamp: 1_800_000_000_000,
  trust_tier: 'community',
};

const insertRow: CommunityReportInsert = {
  id: 'report-a',
  category_id: 'lighting',
  location: { latitude: 40.7, longitude: -74 },
  detail: 'Dark block',
  sub_tag: 'Dim area',
  place_name: null,
  place_type: null,
  google_place_id: null,
  submitted_by: null,
  photo_uri: null,
  timestamp: 1_800_000_000_000,
  device_uuid: 'device-a',
  auth_user_id: 'user-a',
  is_verified_phone: false,
};

describe('community reports repository', () => {
  const client = {
    from: jest.fn(),
    rpc: jest.fn(),
  };
  const auth = {
    ensureAnonymous: jest.fn(),
  };
  let repository: ReturnType<typeof createCommunityReportsRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    auth.ensureAnonymous.mockResolvedValue(session('user-a'));
    repository = createCommunityReportsRepository(
      () => client as unknown as SupabaseClient<Database>,
      auth,
    );
  });

  test('returns safe no-service results when Supabase is unconfigured', async () => {
    const unconfiguredAuth = { ensureAnonymous: jest.fn(async () => null) };
    const unconfigured = createCommunityReportsRepository(
      () => null,
      unconfiguredAuth,
    );

    await expect(unconfigured.fetchCommunityReports()).resolves.toEqual([]);
    await expect(unconfigured.insertCommunityReport(insertRow)).resolves.toEqual({
      ok: false,
      error: 'unknown',
    });
    await expect(unconfigured.deleteCommunityReport('report-a')).resolves.toBeUndefined();
    expect(unconfiguredAuth.ensureAnonymous).toHaveBeenCalledTimes(3);
  });

  test('reads the public view in descending timestamp order after ensuring auth', async () => {
    const builder = queryBuilder({ data: [publicRow], error: null });
    client.from.mockReturnValue(builder);

    await expect(repository.fetchCommunityReports()).resolves.toEqual([publicRow]);

    expect(client.from).toHaveBeenCalledWith('community_reports_public');
    expect(builder.select).toHaveBeenCalledWith('*');
    expect(builder.order).toHaveBeenCalledWith('timestamp', { ascending: false });
    expect(auth.ensureAnonymous.mock.invocationCallOrder[0]).toBeLessThan(
      client.from.mock.invocationCallOrder[0],
    );
  });

  test('forwards an abort signal to public reads', async () => {
    const builder = queryBuilder({ data: [publicRow], error: null });
    const controller = new AbortController();
    client.from.mockReturnValue(builder);

    await repository.fetchCommunityReports(controller.signal);

    expect(builder.abortSignal).toHaveBeenCalledWith(controller.signal);
  });

  test.each([
    ['coordinate', { location: { latitude: 'invalid', longitude: -74 } }],
    ['category', { category_id: 'not-a-category' }],
    ['trust tier', { trust_tier: 'super-user' }],
  ])('rejects a malformed %s without leaking it to domain mapping', async (_label, malformed) => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const builder = queryBuilder({
      data: [{ ...publicRow, ...malformed }],
      error: null,
    });
    client.from.mockReturnValue(builder);

    await expect(repository.fetchCommunityReports()).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      '[community-reports-repository] invalid public report data',
    );
    warn.mockRestore();
  });

  test('returns an empty offline read without logging raw response details', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    client.from.mockReturnValue(
      queryBuilder({
        data: null,
        error: {
          code: '503',
          message: 'raw body synthetic-access-token',
          details: 'private response details',
        },
      }),
    );

    await expect(repository.fetchCommunityReports()).resolves.toEqual([]);

    expect(warn).toHaveBeenCalledWith(
      '[community-reports-repository] read unavailable',
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain('synthetic-access-token');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private response details');
    warn.mockRestore();
  });

  test('inserts a typed report row and forwards its abort signal', async () => {
    const builder = queryBuilder({ data: null, error: null });
    const controller = new AbortController();
    client.from.mockReturnValue(builder);

    await expect(
      repository.insertCommunityReport(insertRow, controller.signal),
    ).resolves.toEqual({ ok: true });

    expect(client.from).toHaveBeenCalledWith('community_reports');
    expect(builder.insert).toHaveBeenCalledWith(insertRow);
    expect(builder.abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(auth.ensureAnonymous.mock.invocationCallOrder[0]).toBeLessThan(
      client.from.mock.invocationCallOrder[0],
    );
  });

  test.each([
    ['P0001', 'device-banned'],
    ['P0002', 'otp-required'],
    ['P0003', 'rate-limited'],
    ['P0004', 'cluster-limited'],
  ] as const)('maps %s to %s', async (code, expected) => {
    client.from.mockReturnValue(
      queryBuilder({ data: null, error: { code, message: 'raw server body' } }),
    );

    await expect(repository.insertCommunityReport(insertRow)).resolves.toEqual({
      ok: false,
      error: expected,
    });
  });

  test('does not log raw PostgREST bodies or token details', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    client.from.mockReturnValue(
      queryBuilder({
        data: null,
        error: {
          code: 'XX000',
          message: 'raw body synthetic-access-token',
          details: 'private response details',
        },
      }),
    );

    await expect(repository.insertCommunityReport(insertRow)).resolves.toEqual({
      ok: false,
      error: 'unknown',
    });

    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain('raw body');
    expect(logged).not.toContain('synthetic-access-token');
    expect(logged).not.toContain('private response details');
    warn.mockRestore();
  });

  test('deletes through submitter_delete_report after ensuring auth', async () => {
    const builder = queryBuilder({ data: undefined, error: null });
    const controller = new AbortController();
    client.rpc.mockReturnValue(builder);

    await repository.deleteCommunityReport('report-a', controller.signal);

    expect(client.rpc).toHaveBeenCalledWith('submitter_delete_report', {
      p_report_id: 'report-a',
    });
    expect(builder.abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(auth.ensureAnonymous.mock.invocationCallOrder[0]).toBeLessThan(
      client.rpc.mock.invocationCallOrder[0],
    );
  });

  test('creates one missing anonymous session and reuses it for the next insert', async () => {
    let currentSession: Session | null = null;
    const anonymousSession = session('anonymous-a', true);
    const authClient = {
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: currentSession },
          error: null,
        })),
        signInAnonymously: jest.fn(async () => {
          currentSession = anonymousSession;
          return {
            data: { session: anonymousSession, user: anonymousSession.user },
            error: null,
          };
        }),
      },
      from: jest.fn(),
      rpc: jest.fn(),
    };
    authClient.from
      .mockReturnValueOnce(queryBuilder({ data: [publicRow], error: null }))
      .mockReturnValueOnce(queryBuilder({ data: null, error: null }));
    const backendAuth = createBackendAuthRepository(
      () => authClient as unknown as SupabaseClient<Database>,
    );
    const sharedRepository = createCommunityReportsRepository(
      () => authClient as unknown as SupabaseClient<Database>,
      backendAuth,
    );

    await sharedRepository.fetchCommunityReports();
    await sharedRepository.insertCommunityReport(insertRow);

    expect(authClient.auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(authClient.auth.getSession).toHaveBeenCalledTimes(2);
  });

  test('reuses an existing permanent session unchanged', async () => {
    const permanentSession = session('permanent-a');
    const authClient = {
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: permanentSession },
          error: null,
        })),
        signInAnonymously: jest.fn(),
      },
      from: jest.fn(() => queryBuilder({ data: [publicRow], error: null })),
      rpc: jest.fn(),
    };
    const backendAuth = createBackendAuthRepository(
      () => authClient as unknown as SupabaseClient<Database>,
    );
    const sharedRepository = createCommunityReportsRepository(
      () => authClient as unknown as SupabaseClient<Database>,
      backendAuth,
    );

    await sharedRepository.fetchCommunityReports();

    expect(authClient.auth.signInAnonymously).not.toHaveBeenCalled();
    expect(permanentSession.user.id).toBe('permanent-a');
  });
});

describe('community cloud adapter', () => {
  const repository = communityRepositoryModule.communityReportsRepository;
  const configured = jest
    .spyOn(communityRepositoryModule, 'isCommunityReportsRepositoryConfigured')
    .mockReturnValue(true);
  const fetchReports = jest.spyOn(repository, 'fetchCommunityReports');
  const insertReport = jest.spyOn(repository, 'insertCommunityReport');
  const deleteReport = jest.spyOn(repository, 'deleteCommunityReport');
  const ensureAnonymous = jest.spyOn(backendAuthRepository, 'ensureAnonymous');
  const getUserId = jest.spyOn(backendAuthRepository, 'getUserId');
  const getDeviceUUID = jest.spyOn(deviceUuidModule, 'getDeviceUUID');
  const cloud = require(
    '../../lib/api/sources/community-cloud'
  ) as typeof import('../../lib/api/sources/community-cloud');

  const firstReport = {
    id: 'report-first',
    categoryId: 'lighting' as const,
    location: { latitude: 40.7, longitude: -74 },
    detail: 'First',
    timestamp: 100,
  };
  const secondReport = {
    id: 'report-second',
    categoryId: 'hazard' as const,
    location: { latitude: 40.71, longitude: -74.01 },
    detail: 'Second',
    photoUri: 'file:///documents/reports/local-only.jpg',
    timestamp: 200,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    configured.mockReturnValue(true);
    ensureAnonymous.mockResolvedValue(session('current-user'));
    getUserId.mockResolvedValue('current-user');
    getDeviceUUID.mockResolvedValue('device-current');
    fetchReports.mockResolvedValue([]);
    insertReport.mockResolvedValue({ ok: true });
    deleteReport.mockResolvedValue(undefined);
    await AsyncStorage.clear();
  });

  test('maps repository rows into community report domain objects', async () => {
    fetchReports.mockResolvedValue([
      {
        ...publicRow,
        detail: null,
        sub_tag: 'Dim area',
        place_name: 'Corner store',
        photo_uri: null,
      },
    ]);

    await expect(cloud.fetchCloudCommunityReports()).resolves.toEqual([
      {
        id: 'report-a',
        categoryId: 'lighting',
        location: { latitude: 40.7, longitude: -74 },
        detail: undefined,
        subTag: 'Dim area',
        placeName: 'Corner store',
        placeType: undefined,
        googlePlaceId: undefined,
        submittedBy: undefined,
        photoUri: undefined,
        timestamp: 1_800_000_000_000,
        trustTier: 'community',
      },
    ]);

    expect(fetchReports).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  test('attributes inserts to the current SDK user and keeps photo files local', async () => {
    await expect(cloud.pushCommunityReportToCloud(secondReport)).resolves.toEqual({
      ok: true,
    });

    expect(ensureAnonymous).toHaveBeenCalledTimes(1);
    expect(getUserId).toHaveBeenCalledTimes(1);
    expect(insertReport).toHaveBeenCalledWith(
      {
        id: 'report-second',
        category_id: 'hazard',
        location: { latitude: 40.71, longitude: -74.01 },
        detail: 'Second',
        sub_tag: null,
        place_name: null,
        place_type: null,
        google_place_id: null,
        submitted_by: null,
        photo_uri: 'file:///documents/reports/local-only.jpg',
        timestamp: 200,
        device_uuid: 'device-current',
        auth_user_id: 'current-user',
        is_verified_phone: false,
      },
      expect.any(AbortSignal),
    );
  });

  test('keeps deduplicated queue entries in local-first insertion order', async () => {
    await cloud.writeSyncQueue([firstReport, secondReport]);
    await cloud.enqueueCommunityReportSync({
      ...firstReport,
      detail: 'Updated first',
    });

    await expect(cloud.readSyncQueue()).resolves.toEqual([
      secondReport,
      { ...firstReport, detail: 'Updated first' },
    ]);
  });

  test('retains failed reports for retry without changing their order', async () => {
    await cloud.writeSyncQueue([firstReport, secondReport]);
    insertReport
      .mockResolvedValueOnce({ ok: false, error: 'rate-limited' })
      .mockResolvedValueOnce({ ok: true });

    await cloud.flushCommunityReportSyncQueue();

    await expect(cloud.readSyncQueue()).resolves.toEqual([firstReport]);
  });

  test('keeps queue writes best effort when local storage is unavailable', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(
      new Error('private storage failure synthetic-access-token'),
    );

    await expect(cloud.writeSyncQueue([firstReport])).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith('[community-cloud] sync queue write failed');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('synthetic-access-token');
    warn.mockRestore();
  });

  test('forwards account cancellation to soft deletion', async () => {
    await cloud.deleteCommunityReportFromCloud('report-a');

    expect(deleteReport).toHaveBeenCalledWith(
      'report-a',
      expect.any(AbortSignal),
    );
    expect(accountOperationGate.currentGeneration()).toBe(0);
  });
});
