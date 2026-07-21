import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseClient } from './client';
import type { Database } from './database.types';

type ClientReader = () => SupabaseClient<Database> | null;

export type RolesRepositoryErrorCode =
  | 'rejected'
  | 'unavailable'
  | 'invalid-data';

const ERROR_MESSAGES: Record<RolesRepositoryErrorCode, string> = {
  rejected: 'Moderator role check was rejected',
  unavailable: 'Moderator role check is unavailable',
  'invalid-data': 'Moderator role response was invalid',
};

export class RolesRepositoryError extends Error {
  readonly code: RolesRepositoryErrorCode;

  constructor(code: RolesRepositoryErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'RolesRepositoryError';
    this.code = code;
  }
}

function asRepositoryError(error: unknown): RolesRepositoryError {
  return error instanceof RolesRepositoryError
    ? error
    : new RolesRepositoryError('unavailable');
}

function responseError(status: number): RolesRepositoryError {
  return new RolesRepositoryError(status === 0 ? 'unavailable' : 'rejected');
}

function isRoleRow(value: unknown, userId: string): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return (value as Record<string, unknown>).user_id === userId;
}

export function createRolesRepository(readClient: ClientReader) {
  async function hasModeratorRole(userId: string): Promise<boolean> {
    if (userId.trim().length === 0) return false;

    try {
      const client = readClient();
      if (!client) return false;

      const { data, error, status } = await client
        .from('user_roles')
        .select('user_id')
        .eq('user_id', userId)
        .eq('role', 'moderator')
        .limit(1);

      if (error) throw responseError(status);
      if (!Array.isArray(data) || !data.every((row) => isRoleRow(row, userId))) {
        throw new RolesRepositoryError('invalid-data');
      }
      return data.length > 0;
    } catch (error) {
      throw asRepositoryError(error);
    }
  }

  return { hasModeratorRole };
}

export const rolesRepository = createRolesRepository(getSupabaseClient);
