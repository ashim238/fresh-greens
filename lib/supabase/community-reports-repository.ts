import type { SupabaseClient } from '@supabase/supabase-js';

import { backendAuthRepository } from './auth-repository';
import { getSupabaseClient } from './client';
import type { Database, Json } from './database.types';

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

export type CommunityReportInsert = Database['public']['Tables']['community_reports']['Insert'];

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

function isCoordinate(value: Json | null): value is {
  latitude: number;
  longitude: number;
} {
  if (!value || Array.isArray(value) || typeof value !== 'object') return false;
  return (
    typeof value.latitude === 'number' &&
    Number.isFinite(value.latitude) &&
    typeof value.longitude === 'number' &&
    Number.isFinite(value.longitude)
  );
}

function isPublicRow(row: PublicViewRow): row is CommunityReportPublicRow {
  return (
    typeof row.id === 'string' &&
    REPORT_CATEGORIES.has(row.category_id as CommunityReportCategoryId) &&
    typeof row.timestamp === 'number' &&
    Number.isFinite(row.timestamp) &&
    isCoordinate(row.location) &&
    (row.trust_tier === null ||
      TRUST_TIERS.has(row.trust_tier as CommunityReportTrustTier))
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
      const client = await authenticatedClient();
      if (!client) return { ok: false, error: 'unknown' };

      let query = client.from('community_reports').insert(row);
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
