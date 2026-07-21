import type { SupabaseClient } from '@supabase/supabase-js';

import {
  createRolesRepository,
  RolesRepositoryError,
} from '../../lib/supabase/roles-repository';
import type { Database } from '../../lib/supabase/database.types';

type QueryResponse<T> = {
  data: T;
  error: { code?: string; message?: string; details?: string } | null;
  status?: number;
};

type QueryBuilder<T> = PromiseLike<QueryResponse<T>> & {
  select: jest.Mock;
  eq: jest.Mock;
  limit: jest.Mock;
};

function queryBuilder<T>(response: QueryResponse<T>): QueryBuilder<T> {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    limit: jest.fn(),
    then: <TResult1 = QueryResponse<T>, TResult2 = never>(
      onfulfilled?: ((value: QueryResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(response).then(onfulfilled, onrejected),
  } as QueryBuilder<T>;
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
}

describe('roles repository', () => {
  const client = { from: jest.fn() };
  let repository: ReturnType<typeof createRolesRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = createRolesRepository(
      () => client as unknown as SupabaseClient<Database>,
    );
  });

  test('checks the current user moderator role with a limited query', async () => {
    const builder = queryBuilder({
      data: [{ user_id: 'user-a' }],
      error: null,
    });
    client.from.mockReturnValue(builder);

    await expect(repository.hasModeratorRole('user-a')).resolves.toBe(true);

    expect(client.from).toHaveBeenCalledWith('user_roles');
    expect(builder.select).toHaveBeenCalledWith('user_id');
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-a');
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'role', 'moderator');
    expect(builder.limit).toHaveBeenCalledWith(1);
  });

  test('fails closed when Supabase is unconfigured or the user id is empty', async () => {
    const unconfigured = createRolesRepository(() => null);

    await expect(unconfigured.hasModeratorRole('user-a')).resolves.toBe(false);
    await expect(repository.hasModeratorRole('  ')).resolves.toBe(false);

    expect(client.from).not.toHaveBeenCalled();
  });

  test('returns false when no moderator role exists', async () => {
    client.from.mockReturnValue(queryBuilder({ data: [], error: null }));

    await expect(repository.hasModeratorRole('user-a')).resolves.toBe(false);
  });

  test('rejects malformed role rows with a redacted product error', async () => {
    client.from.mockReturnValue(
      queryBuilder({ data: [{ user_id: 42 }], error: null }),
    );

    await expect(repository.hasModeratorRole('user-a')).rejects.toEqual(
      new RolesRepositoryError('invalid-data'),
    );
  });

  test('redacts RLS response details from the thrown product error', async () => {
    client.from.mockReturnValue(
      queryBuilder({
        data: null,
        error: {
          code: '42501',
          message: 'raw RLS body synthetic-access-token',
          details: 'private role details',
        },
        status: 403,
      }),
    );

    let caught: unknown;
    try {
      await repository.hasModeratorRole('user-a');
    } catch (error) {
      caught = error;
    }

    expect(caught).toEqual(new RolesRepositoryError('rejected'));
    expect(JSON.stringify(caught)).not.toContain('42501');
    expect(JSON.stringify(caught)).not.toContain('synthetic-access-token');
    expect(JSON.stringify(caught)).not.toContain('private role details');
  });

  test('maps a resolved status-zero role response to unavailable', async () => {
    client.from.mockReturnValue(
      queryBuilder({
        data: null,
        error: {
          code: 'NETWORK_ERROR',
          message: 'raw offline role response synthetic-access-token',
          details: 'private role transport details',
        },
        status: 0,
      }),
    );

    let caught: unknown;
    try {
      await repository.hasModeratorRole('user-a');
    } catch (error) {
      caught = error;
    }

    expect(caught).toEqual(new RolesRepositoryError('unavailable'));
    expect(JSON.stringify(caught)).not.toContain('NETWORK_ERROR');
    expect(JSON.stringify(caught)).not.toContain('synthetic-access-token');
    expect(JSON.stringify(caught)).not.toContain('private role transport details');
    expect(JSON.stringify(caught)).not.toContain('status');
  });

  test('redacts thrown transport failures', async () => {
    client.from.mockImplementation(() => {
      throw new Error('network failure synthetic-access-token');
    });

    await expect(repository.hasModeratorRole('user-a')).rejects.toEqual(
      new RolesRepositoryError('unavailable'),
    );
  });
});
