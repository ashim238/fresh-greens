import type { SupabaseClient } from '@supabase/supabase-js';

import {
  AccountOperationClosedError,
  AccountOperationGate,
} from '../../lib/account-session/operation-gate';
import type { Database } from '../../lib/supabase/database.types';
import {
  createModerationRepository,
  ModerationRepositoryError,
  type ModerationReport,
  type ReportFlag,
} from '../../lib/supabase/moderation-repository';

type QueryResponse<T> = {
  data: T;
  error: { code?: string; message?: string; details?: string } | null;
  status?: number;
};

type QueryBuilder<T> = PromiseLike<QueryResponse<T>> & {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  abortSignal: jest.Mock;
};

function queryBuilder<T>(response: QueryResponse<T>): QueryBuilder<T> {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    abortSignal: jest.fn(),
    then: <TResult1 = QueryResponse<T>, TResult2 = never>(
      onfulfilled?: ((value: QueryResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(response).then(onfulfilled, onrejected),
  } as QueryBuilder<T>;
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.abortSignal.mockReturnValue(builder);
  return builder;
}

function deferredQueryBuilder<T>() {
  let resolve!: (response: QueryResponse<T>) => void;
  const response = new Promise<QueryResponse<T>>((resolveResponse) => {
    resolve = resolveResponse;
  });
  const builder = queryBuilder<T>({ data: null as T, error: null });
  builder.then = response.then.bind(response);
  return { builder, resolve };
}

const report: ModerationReport = {
  id: 'report-a',
  category_id: 'lighting',
  location: { latitude: 40.7, longitude: -74 },
  detail: 'Dark block',
  place_name: 'Corner store',
  place_type: 'store',
  submitted_by: 'Myles',
  timestamp: 1_800_000_000_000,
  device_uuid: 'device-a',
  auth_user_id: 'user-a',
  submitter_ip: '192.0.2.1',
  hidden_at: '2026-07-20T00:00:00.000Z',
  hidden_reason: 'flag threshold',
  removed_at: null,
  is_verified_phone: true,
};

const flag: ReportFlag = {
  id: 'flag-a',
  report_id: 'report-a',
  flagger_device_uuid: 'device-b',
  flagger_ip: '192.0.2.2',
  reason: 'Incorrect location',
  reason_category: 'inaccurate',
  created_at: '2026-07-20T01:00:00.000Z',
};

describe('moderation repository', () => {
  const client = {
    from: jest.fn(),
    rpc: jest.fn(),
  };
  const readClient = jest.fn();
  let gate: AccountOperationGate;
  let repository: ReturnType<typeof createModerationRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    gate = new AccountOperationGate();
    readClient.mockReturnValue(client as unknown as SupabaseClient<Database>);
    repository = createModerationRepository(readClient, gate);
  });

  test('reads the server-ordered moderation queue through its guarded RPC', async () => {
    const builder = queryBuilder({ data: [report], error: null });
    client.rpc.mockReturnValue(builder);

    await expect(repository.fetchModerationQueue()).resolves.toEqual([report]);

    expect(client.rpc).toHaveBeenCalledWith('moderator_list_reports');
    expect(builder.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  test('maps validated rows without exposing raw SDK object references', async () => {
    const rawReport = {
      ...report,
      location: { latitude: 40.7, longitude: -74 },
    };
    client.rpc.mockReturnValue(
      queryBuilder({ data: [rawReport], error: null }),
    );

    const [mapped] = await repository.fetchModerationQueue();

    expect(mapped).not.toBe(rawReport);
    expect(mapped.location).not.toBe(rawReport.location);
    expect(mapped.location).toEqual(rawReport.location);
  });

  test.each([
    ['null row', null],
    ['empty id', { ...report, id: '  ' }],
    ['category', { ...report, category_id: 12 }],
    ['unknown category', { ...report, category_id: 'not-a-category' }],
    ['coordinate', { ...report, location: { latitude: '40.7', longitude: -74 } }],
    ['latitude range', { ...report, location: { latitude: 91, longitude: -74 } }],
    ['longitude range', { ...report, location: { latitude: 40.7, longitude: -181 } }],
    ['detail', { ...report, detail: false }],
    ['place name', { ...report, place_name: [] }],
    ['place type', { ...report, place_type: 5 }],
    ['submitted by', { ...report, submitted_by: {} }],
    ['timestamp', { ...report, timestamp: Number.NaN }],
    ['device UUID', { ...report, device_uuid: '' }],
    ['auth user', { ...report, auth_user_id: 8 }],
    ['submitter IP', { ...report, submitter_ip: false }],
    ['hidden timestamp', { ...report, hidden_at: 1 }],
    ['hidden reason', { ...report, hidden_reason: [] }],
    ['removed timestamp', { ...report, removed_at: {} }],
    ['verified status', { ...report, is_verified_phone: 'yes' }],
  ])('rejects a malformed moderation %s', async (_label, malformed) => {
    client.rpc.mockReturnValue(
      queryBuilder({ data: [malformed], error: null }),
    );

    await expect(repository.fetchModerationQueue()).rejects.toEqual(
      new ModerationRepositoryError('invalid-data'),
    );
  });

  test('orders report flags newest first and validates their report identity', async () => {
    const builder = queryBuilder({ data: [flag], error: null });
    client.rpc.mockReturnValue(builder);

    await expect(repository.fetchReportFlags('report-a')).resolves.toEqual([flag]);

    expect(client.rpc).toHaveBeenCalledWith('moderator_list_report_flags', {
      p_report_id: 'report-a',
    });
    expect(builder.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  test('accepts a retained flag after its IP address has been purged', async () => {
    const purgedFlag = { ...flag, flagger_ip: null };
    client.rpc.mockReturnValue(
      queryBuilder({ data: [purgedFlag], error: null }),
    );

    await expect(repository.fetchReportFlags('report-a')).resolves.toEqual([
      purgedFlag,
    ]);
  });

  test.each([
    ['null row', null],
    ['empty id', { ...flag, id: '' }],
    ['wrong report', { ...flag, report_id: 'report-b' }],
    ['device UUID', { ...flag, flagger_device_uuid: 3 }],
    ['flagger IP', { ...flag, flagger_ip: false }],
    ['blank flagger IP', { ...flag, flagger_ip: '  ' }],
    ['reason', { ...flag, reason: [] }],
    ['reason category', { ...flag, reason_category: '' }],
    ['unknown reason category', { ...flag, reason_category: 'brigading' }],
    ['created timestamp', { ...flag, created_at: 'not-a-date' }],
  ])('rejects a malformed flag %s', async (_label, malformed) => {
    client.rpc.mockReturnValue(
      queryBuilder({ data: [malformed], error: null }),
    );

    await expect(repository.fetchReportFlags('report-a')).rejects.toEqual(
      new ModerationRepositoryError('invalid-data'),
    );
  });

  test('passes exact report ids and reasons to restore and remove RPCs', async () => {
    client.rpc.mockReturnValue(
      queryBuilder({ data: undefined, error: null }),
    );

    await expect(
      repository.restoreReport('report-a', 'Restored via moderation queue'),
    ).resolves.toBeUndefined();
    await expect(
      repository.removeReport('report-b', 'Removed via moderation queue'),
    ).resolves.toBeUndefined();

    expect(client.rpc).toHaveBeenNthCalledWith(1, 'moderator_restore_report', {
      p_report_id: 'report-a',
      p_reason: 'Restored via moderation queue',
    });
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'moderator_remove_report', {
      p_report_id: 'report-b',
      p_reason: 'Removed via moderation queue',
    });
  });

  test.each(['', '  ', '\n']) (
    'rejects an invalid flag report id before client access',
    async (reportId) => {
      await expect(repository.fetchReportFlags(reportId)).rejects.toEqual(
        new ModerationRepositoryError('invalid-input'),
      );

      expect(readClient).not.toHaveBeenCalled();
      expect(client.rpc).not.toHaveBeenCalled();
    },
  );

  test.each([
    ['restore', '', 'valid reason'],
    ['restore', 'report-a', '  '],
    ['remove', '\t', 'valid reason'],
    ['remove', 'report-a', ''],
  ] as const)(
    'rejects invalid %s input before client or RPC access',
    async (action, id, reason) => {
      const operation = action === 'restore'
        ? repository.restoreReport(id, reason)
        : repository.removeReport(id, reason);

      await expect(operation).rejects.toEqual(
        new ModerationRepositoryError('invalid-input'),
      );
      expect(readClient).not.toHaveBeenCalled();
      expect(client.rpc).not.toHaveBeenCalled();
    },
  );

  test('rejects an unknown bulk action without defaulting to remove', async () => {
    const runWithRuntimeAction = repository.runBulkModeration as (
      ids: readonly string[],
      action: string,
    ) => Promise<{ failedIds: string[] }>;

    let caught: unknown;
    try {
      await runWithRuntimeAction(
        ['report-dangerous-action-token'],
        'destroy',
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toEqual(new ModerationRepositoryError('invalid-input'));
    expect(JSON.stringify(caught)).not.toContain('destroy');
    expect(JSON.stringify(caught)).not.toContain('dangerous-action-token');
    expect(readClient).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  test('validates every bulk id before executing any RPC', async () => {
    let caught: unknown;
    try {
      await repository.runBulkModeration(
        ['report-safe', '  ', 'report-private-input-token'],
        'remove',
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toEqual(new ModerationRepositoryError('invalid-input'));
    expect(JSON.stringify(caught)).not.toContain('report-private-input-token');
    expect(readClient).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  test('returns only failed ids from a bulk remove without leaking failures', async () => {
    client.rpc
      .mockReturnValueOnce(queryBuilder({ data: undefined, error: null }))
      .mockReturnValueOnce(queryBuilder({
        data: undefined,
        error: {
          code: '42501',
          message: 'raw RLS body synthetic-access-token',
          details: 'private moderation details',
        },
      }));

    const result = await repository.runBulkModeration(['a', 'b'], 'remove');

    expect(result).toEqual({ failedIds: ['b'] });
    expect(JSON.stringify(result)).not.toContain('42501');
    expect(JSON.stringify(result)).not.toContain('synthetic-access-token');
    expect(client.rpc).toHaveBeenNthCalledWith(1, 'moderator_remove_report', {
      p_report_id: 'a',
      p_reason: 'Bulk removed via moderation queue',
    });
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'moderator_remove_report', {
      p_report_id: 'b',
      p_reason: 'Bulk removed via moderation queue',
    });
  });

  test('uses the bulk restore reason for every selected id', async () => {
    client.rpc.mockReturnValue(
      queryBuilder({ data: undefined, error: null }),
    );

    await expect(
      repository.runBulkModeration(['a', 'b'], 'restore'),
    ).resolves.toEqual({ failedIds: [] });

    expect(client.rpc).toHaveBeenNthCalledWith(1, 'moderator_restore_report', {
      p_report_id: 'a',
      p_reason: 'Bulk restored via moderation queue',
    });
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'moderator_restore_report', {
      p_report_id: 'b',
      p_reason: 'Bulk restored via moderation queue',
    });
  });

  test('aborts and suppresses a deferred moderation read across sign-out', async () => {
    const deferred = deferredQueryBuilder<ModerationReport[]>();
    client.rpc.mockReturnValue(deferred.builder);

    const operation = repository.fetchModerationQueue();
    await Promise.resolve();
    const signal = deferred.builder.abortSignal.mock.calls[0][0] as AbortSignal;

    gate.seal(0);
    const drain = gate.drain(0, 1_000);
    let drainSettled = false;
    void drain.then(() => {
      drainSettled = true;
    });
    await Promise.resolve();

    expect(signal.aborted).toBe(true);
    expect(drainSettled).toBe(false);

    deferred.resolve({ data: [report], error: null });

    await expect(operation).rejects.toEqual(new AccountOperationClosedError());
    await expect(drain).resolves.toEqual({ kind: 'drained' });
  });

  test('aborts and suppresses a deferred moderation mutation across sign-out', async () => {
    const deferred = deferredQueryBuilder<undefined>();
    client.rpc.mockReturnValue(deferred.builder);

    const operation = repository.removeReport('report-a', 'boundary test');
    await Promise.resolve();
    const signal = deferred.builder.abortSignal.mock.calls[0][0] as AbortSignal;

    gate.seal(0);
    const drain = gate.drain(0, 1_000);
    expect(signal.aborted).toBe(true);

    deferred.resolve({ data: undefined, error: null });

    await expect(operation).rejects.toEqual(new AccountOperationClosedError());
    await expect(drain).resolves.toEqual({ kind: 'drained' });
  });

  test('does not dispatch later bulk mutations after the account boundary seals', async () => {
    const first = deferredQueryBuilder<undefined>();
    client.rpc
      .mockReturnValueOnce(first.builder)
      .mockReturnValue(queryBuilder({ data: undefined, error: null }));

    const operation = repository.runBulkModeration(['a', 'b'], 'remove');
    await Promise.resolve();
    expect(client.rpc).toHaveBeenCalledTimes(1);

    gate.seal(0);
    const drain = gate.drain(0, 1_000);
    first.resolve({ data: undefined, error: null });

    await expect(operation).rejects.toEqual(new AccountOperationClosedError());
    await expect(drain).resolves.toEqual({ kind: 'drained' });
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });

  test('fails closed when Supabase is unconfigured', async () => {
    const unconfigured = createModerationRepository(
      () => null,
      new AccountOperationGate(),
    );

    await expect(unconfigured.fetchModerationQueue()).rejects.toEqual(
      new ModerationRepositoryError('unconfigured'),
    );
    await expect(unconfigured.fetchReportFlags('report-a')).rejects.toEqual(
      new ModerationRepositoryError('unconfigured'),
    );
    await expect(unconfigured.restoreReport('report-a', 'reason')).rejects.toEqual(
      new ModerationRepositoryError('unconfigured'),
    );
    await expect(unconfigured.removeReport('report-a', 'reason')).rejects.toEqual(
      new ModerationRepositoryError('unconfigured'),
    );
    await expect(
      unconfigured.runBulkModeration(['a', 'b'], 'remove'),
    ).resolves.toEqual({ failedIds: ['a', 'b'] });
  });

  test.each([
    ['queue', () => repository.fetchModerationQueue()],
    ['flags', () => repository.fetchReportFlags('report-a')],
    ['restore', () => repository.restoreReport('report-a', 'reason')],
    ['remove', () => repository.removeReport('report-a', 'reason')],
  ])('redacts non-moderator RLS failures from %s errors', async (_label, operation) => {
    const rawError = {
      code: '42501',
      message: 'raw RLS body synthetic-access-token',
      details: 'private moderation details',
    };
    client.rpc.mockReturnValue(
      queryBuilder({ data: null, error: rawError, status: 403 }),
    );

    let caught: unknown;
    try {
      await operation();
    } catch (error) {
      caught = error;
    }

    expect(caught).toEqual(new ModerationRepositoryError('rejected'));
    expect(JSON.stringify(caught)).not.toContain('42501');
    expect(JSON.stringify(caught)).not.toContain('synthetic-access-token');
    expect(JSON.stringify(caught)).not.toContain('private moderation details');
  });

  test.each([
    ['queue', () => repository.fetchModerationQueue()],
    ['flags', () => repository.fetchReportFlags('report-a')],
    ['restore', () => repository.restoreReport('report-a', 'reason')],
    ['remove', () => repository.removeReport('report-a', 'reason')],
  ])('maps a resolved status-zero %s failure to unavailable', async (_label, operation) => {
    const rawError = {
      code: 'NETWORK_ERROR',
      message: 'raw offline response synthetic-access-token',
      details: 'private transport details',
    };
    client.rpc.mockReturnValue(
      queryBuilder({ data: null, error: rawError, status: 0 }),
    );

    let caught: unknown;
    try {
      await operation();
    } catch (error) {
      caught = error;
    }

    expect(caught).toEqual(new ModerationRepositoryError('unavailable'));
    expect(JSON.stringify(caught)).not.toContain('NETWORK_ERROR');
    expect(JSON.stringify(caught)).not.toContain('synthetic-access-token');
    expect(JSON.stringify(caught)).not.toContain('private transport details');
    expect(JSON.stringify(caught)).not.toContain('status');
  });

  test('redacts thrown transport failures', async () => {
    client.rpc.mockImplementation(() => {
      throw new Error('network failure synthetic-access-token');
    });

    await expect(repository.fetchModerationQueue()).rejects.toEqual(
      new ModerationRepositoryError('unavailable'),
    );
  });
});
