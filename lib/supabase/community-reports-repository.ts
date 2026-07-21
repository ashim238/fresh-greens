import type { SupabaseClient } from '@supabase/supabase-js';

import { backendAuthRepository } from './auth-repository';
import { getSupabaseClient } from './client';
import type { Database } from './database.types';

type PublicViewRow = Database['public']['Views']['community_reports_public']['Row'];

export type CommunityReportCategoryId =
  | 'lighting'
  | 'hazard'
  | 'incident'
  | 'felt-unsafe'
  | 'felt-welcome'
  | 'black-owned';

export type CommunityReportTrustTier =
  | 'verified'
  | 'community'
  | 'contributor';

export type CommunityReportPublicRow = Omit<
  PublicViewRow,
  'id' | 'category_id' | 'location' | 'timestamp' | 'trust_tier'
> & {
  id: string;
  category_id: CommunityReportCategoryId;
  location: { latitude: number; longitude: number };
  timestamp: number;
  trust_tier: CommunityReportTrustTier | null;
};

type CommunityReportDatabaseInsert = Database['public']['Tables']['community_reports']['Insert'];

export type CommunityReportInsert = Omit<
  CommunityReportDatabaseInsert,
  'auth_user_id'
>;

export type CommunityReportSubmitError =
  | 'device-banned'
  | 'otp-required'
  | 'rate-limited'
  | 'cluster-limited'
  | 'unknown';

export type CommunityReportInsertResult =
  | { ok: true }
  | { ok: false; error: CommunityReportSubmitError };

type AuthDependency = Pick<typeof backendAuthRepository, 'ensureAnonymous'>;
type ClientReader = () => SupabaseClient<Database> | null;

const PRODUCT_ERRORS: Record<string, CommunityReportSubmitError> = {
  P0001: 'device-banned',
  P0002: 'otp-required',
  P0003: 'rate-limited',
  P0004: 'cluster-limited',
};

const REPORT_CATEGORIES = new Set<CommunityReportCategoryId>([
  'lighting',
  'hazard',
  'incident',
  'felt-unsafe',
  'felt-welcome',
  'black-owned',
]);

const TRUST_TIERS = new Set<CommunityReportTrustTier>([
  'verified',
  'community',
  'contributor',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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

function isPublicRow(row: unknown): row is CommunityReportPublicRow {
  if (!isRecord(row)) return false;
  return (
    typeof row.id === 'string' &&
    row.id.trim().length > 0 &&
    typeof row.category_id === 'string' &&
    REPORT_CATEGORIES.has(row.category_id as CommunityReportCategoryId) &&
    typeof row.timestamp === 'number' &&
    Number.isFinite(row.timestamp) &&
    isCoordinate(row.location) &&
    isNullableString(row.detail) &&
    isNullableString(row.sub_tag) &&
    isNullableString(row.place_name) &&
    isNullableString(row.place_type) &&
    isNullableString(row.google_place_id) &&
    isNullableString(row.submitted_by) &&
    isNullableString(row.photo_uri) &&
    (row.trust_tier === null ||
      (typeof row.trust_tier === 'string' &&
        TRUST_TIERS.has(row.trust_tier as CommunityReportTrustTier)))
  );
}

export function createCommunityReportsRepository(
  readClient: ClientReader,
  authRepository: AuthDependency,
) {
  async function authenticatedClient(): Promise<SupabaseClient<Database> | null> {
    await authRepository.ensureAnonymous();
    return readClient();
  }

  async function fetchCommunityReports(
    signal?: AbortSignal,
  ): Promise<CommunityReportPublicRow[]> {
    try {
      const client = await authenticatedClient();
      if (!client) return [];

      let query = client
        .from('community_reports_public')
        .select('*')
        .order('timestamp', { ascending: false });
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query;

      if (error) {
        console.warn('[community-reports-repository] read unavailable');
        return [];
      }
      if (!data || !data.every(isPublicRow)) {
        console.warn('[community-reports-repository] invalid public report data');
        return [];
      }
      return data;
    } catch {
      console.warn('[community-reports-repository] read unavailable');
      return [];
    }
  }

  async function insertCommunityReport(
    row: CommunityReportInsert,
    signal?: AbortSignal,
  ): Promise<CommunityReportInsertResult> {
    try {
      const session = await authRepository.ensureAnonymous();
      const client = readClient();
      const authUserId = session?.user?.id;
      if (!client || !authUserId) return { ok: false, error: 'unknown' };

      const databaseRow: CommunityReportDatabaseInsert = {
        ...row,
        auth_user_id: authUserId,
      };
      let query = client.from('community_reports').insert(databaseRow);
      if (signal) query = query.abortSignal(signal);
      const { error } = await query;

      if (!error) return { ok: true };
      const productError = PRODUCT_ERRORS[error.code ?? ''] ?? 'unknown';
      if (productError === 'unknown') {
        console.warn('[community-reports-repository] insert rejected');
      }
      return {
        ok: false,
        error: productError,
      };
    } catch {
      console.warn('[community-reports-repository] insert unavailable');
      return { ok: false, error: 'unknown' };
    }
  }

  async function deleteCommunityReport(
    id: string,
    signal?: AbortSignal,
  ): Promise<void> {
    try {
      const client = await authenticatedClient();
      if (!client) return;

      let query = client.rpc('submitter_delete_report', { p_report_id: id });
      if (signal) query = query.abortSignal(signal);
      const { error } = await query;
      if (error) {
        console.warn('[community-reports-repository] delete unavailable');
      }
    } catch {
      console.warn('[community-reports-repository] delete unavailable');
    }
  }

  return {
    fetchCommunityReports,
    insertCommunityReport,
    deleteCommunityReport,
  };
}

export const communityReportsRepository = createCommunityReportsRepository(
  getSupabaseClient,
  backendAuthRepository,
);

export function isCommunityReportsRepositoryConfigured(): boolean {
  return getSupabaseClient() !== null;
}
