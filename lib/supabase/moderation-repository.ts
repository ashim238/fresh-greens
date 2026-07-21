import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseClient } from './client';
import type { CommunityReportCategoryId } from './community-reports-repository';
import type { Database } from './database.types';

type ClientReader = () => SupabaseClient<Database> | null;
type ModerationViewRow =
  Database['public']['Views']['community_reports_moderation']['Row'];
type ReportFlagRow = Database['public']['Tables']['report_flags']['Row'];

export type ModerationReport = Pick<
  ModerationViewRow,
  | 'detail'
  | 'place_name'
  | 'place_type'
  | 'submitted_by'
  | 'auth_user_id'
  | 'submitter_ip'
  | 'hidden_at'
  | 'hidden_reason'
  | 'removed_at'
> & {
  id: string;
  category_id: CommunityReportCategoryId;
  location: { latitude: number; longitude: number };
  timestamp: number;
  device_uuid: string;
  is_verified_phone: boolean;
};

export type ReportFlagReasonCategory =
  | 'spam'
  | 'inaccurate'
  | 'misleading'
  | 'abusive'
  | 'other';

export type ReportFlag = Omit<
  Pick<
    ReportFlagRow,
    | 'id'
    | 'report_id'
    | 'flagger_device_uuid'
    | 'flagger_ip'
    | 'reason'
    | 'reason_category'
    | 'created_at'
  >,
  'reason_category'
> & {
  reason_category: ReportFlagReasonCategory;
};

export type ModerationRepositoryErrorCode =
  | 'unconfigured'
  | 'rejected'
  | 'unavailable'
  | 'invalid-data'
  | 'invalid-input';

const ERROR_MESSAGES: Record<ModerationRepositoryErrorCode, string> = {
  unconfigured: 'Moderation service is not configured',
  rejected: 'Moderation request was rejected',
  unavailable: 'Moderation service is unavailable',
  'invalid-data': 'Moderation response was invalid',
  'invalid-input': 'Moderation input was invalid',
};

const REPORT_CATEGORIES = new Set<CommunityReportCategoryId>([
  'lighting',
  'hazard',
  'incident',
  'felt-unsafe',
  'felt-welcome',
  'black-owned',
]);

const FLAG_REASON_CATEGORIES = new Set<ReportFlagReasonCategory>([
  'spam',
  'inaccurate',
  'misleading',
  'abusive',
  'other',
]);

export class ModerationRepositoryError extends Error {
  readonly code: ModerationRepositoryErrorCode;

  constructor(code: ModerationRepositoryErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'ModerationRepositoryError';
    this.code = code;
  }
}

function asRepositoryError(error: unknown): ModerationRepositoryError {
  return error instanceof ModerationRepositoryError
    ? error
    : new ModerationRepositoryError('unavailable');
}

function responseError(status: number): ModerationRepositoryError {
  return new ModerationRepositoryError(
    status === 0 ? 'unavailable' : 'rejected',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isCoordinate(value: unknown): value is {
  latitude: number;
  longitude: number;
} {
  if (!isRecord(value)) return false;
  return (
    typeof value.latitude === 'number' &&
    Number.isFinite(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    typeof value.longitude === 'number' &&
    Number.isFinite(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

function parseModerationReport(row: unknown): ModerationReport | null {
  if (!isRecord(row)) return null;
  if (
    !isNonEmptyString(row.id) ||
    typeof row.category_id !== 'string' ||
    !REPORT_CATEGORIES.has(row.category_id as CommunityReportCategoryId) ||
    !isCoordinate(row.location) ||
    !isNullableString(row.detail) ||
    !isNullableString(row.place_name) ||
    !isNullableString(row.place_type) ||
    !isNullableString(row.submitted_by) ||
    typeof row.timestamp !== 'number' ||
    !Number.isFinite(row.timestamp) ||
    !isNonEmptyString(row.device_uuid) ||
    !isNullableString(row.auth_user_id) ||
    !isNullableString(row.submitter_ip) ||
    !isNullableString(row.hidden_at) ||
    !isNullableString(row.hidden_reason) ||
    !isNullableString(row.removed_at) ||
    typeof row.is_verified_phone !== 'boolean'
  ) {
    return null;
  }

  return {
    id: row.id,
    category_id: row.category_id as CommunityReportCategoryId,
    location: {
      latitude: row.location.latitude,
      longitude: row.location.longitude,
    },
    detail: row.detail,
    place_name: row.place_name,
    place_type: row.place_type,
    submitted_by: row.submitted_by,
    timestamp: row.timestamp,
    device_uuid: row.device_uuid,
    auth_user_id: row.auth_user_id,
    submitter_ip: row.submitter_ip,
    hidden_at: row.hidden_at,
    hidden_reason: row.hidden_reason,
    removed_at: row.removed_at,
    is_verified_phone: row.is_verified_phone,
  };
}

function parseReportFlag(row: unknown, reportId: string): ReportFlag | null {
  if (!isRecord(row)) return null;
  if (
    !isNonEmptyString(row.id) ||
    row.report_id !== reportId ||
    !isNonEmptyString(row.flagger_device_uuid) ||
    !isNonEmptyString(row.flagger_ip) ||
    !isNullableString(row.reason) ||
    typeof row.reason_category !== 'string' ||
    !FLAG_REASON_CATEGORIES.has(
      row.reason_category as ReportFlagReasonCategory,
    ) ||
    !isNonEmptyString(row.created_at) ||
    !Number.isFinite(Date.parse(row.created_at))
  ) {
    return null;
  }

  return {
    id: row.id,
    report_id: row.report_id,
    flagger_device_uuid: row.flagger_device_uuid,
    flagger_ip: row.flagger_ip,
    reason: row.reason,
    reason_category: row.reason_category as ReportFlagReasonCategory,
    created_at: row.created_at,
  };
}

export function createModerationRepository(readClient: ClientReader) {
  function requireClient(): SupabaseClient<Database> {
    const client = readClient();
    if (!client) throw new ModerationRepositoryError('unconfigured');
    return client;
  }

  async function fetchModerationQueue(): Promise<ModerationReport[]> {
    try {
      const { data, error, status } = await requireClient()
        .from('community_reports_moderation')
        .select('*')
        .order('hidden_at', { ascending: false, nullsFirst: false })
        .order('timestamp', { ascending: false });

      if (error) throw responseError(status);
      if (!Array.isArray(data)) {
        throw new ModerationRepositoryError('invalid-data');
      }
      const reports = data.map(parseModerationReport);
      if (reports.some((report) => report === null)) {
        throw new ModerationRepositoryError('invalid-data');
      }
      return reports as ModerationReport[];
    } catch (error) {
      throw asRepositoryError(error);
    }
  }

  async function fetchReportFlags(reportId: string): Promise<ReportFlag[]> {
    if (!isNonEmptyString(reportId)) {
      throw new ModerationRepositoryError('invalid-input');
    }

    try {
      const { data, error, status } = await requireClient()
        .from('report_flags')
        .select(
          'id,report_id,flagger_device_uuid,flagger_ip,reason,reason_category,created_at',
        )
        .eq('report_id', reportId)
        .order('created_at', { ascending: false });

      if (error) throw responseError(status);
      if (!Array.isArray(data)) {
        throw new ModerationRepositoryError('invalid-data');
      }
      const flags = data.map((row) => parseReportFlag(row, reportId));
      if (flags.some((flag) => flag === null)) {
        throw new ModerationRepositoryError('invalid-data');
      }
      return flags as ReportFlag[];
    } catch (error) {
      throw asRepositoryError(error);
    }
  }

  async function restoreReport(id: string, reason: string): Promise<void> {
    if (!isNonEmptyString(id) || !isNonEmptyString(reason)) {
      throw new ModerationRepositoryError('invalid-input');
    }

    try {
      const { error, status } = await requireClient().rpc('moderator_restore_report', {
        p_report_id: id,
        p_reason: reason,
      });
      if (error) throw responseError(status);
    } catch (error) {
      throw asRepositoryError(error);
    }
  }

  async function removeReport(id: string, reason: string): Promise<void> {
    if (!isNonEmptyString(id) || !isNonEmptyString(reason)) {
      throw new ModerationRepositoryError('invalid-input');
    }

    try {
      const { error, status } = await requireClient().rpc('moderator_remove_report', {
        p_report_id: id,
        p_reason: reason,
      });
      if (error) throw responseError(status);
    } catch (error) {
      throw asRepositoryError(error);
    }
  }

  async function runBulkModeration(
    ids: readonly string[],
    action: 'restore' | 'remove',
  ): Promise<{ failedIds: string[] }> {
    let moderate: (id: string) => Promise<void>;
    switch (action) {
      case 'restore':
        moderate = (id) =>
          restoreReport(id, 'Bulk restored via moderation queue');
        break;
      case 'remove':
        moderate = (id) =>
          removeReport(id, 'Bulk removed via moderation queue');
        break;
      default:
        throw new ModerationRepositoryError('invalid-input');
    }

    if (!Array.isArray(ids) || !ids.every(isNonEmptyString)) {
      throw new ModerationRepositoryError('invalid-input');
    }

    const results = await Promise.allSettled(
      ids.map(moderate),
    );
    return {
      failedIds: results.flatMap((result, index) =>
        result.status === 'rejected' ? [ids[index]] : [],
      ),
    };
  }

  return {
    fetchModerationQueue,
    fetchReportFlags,
    restoreReport,
    removeReport,
    runBulkModeration,
  };
}

export const moderationRepository = createModerationRepository(
  getSupabaseClient,
);
