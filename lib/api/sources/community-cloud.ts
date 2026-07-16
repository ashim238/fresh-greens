// Fresh Greens — community reports cloud adapter (B1 → M1.1).
//
// Supabase PostgREST read/write when EXPO_PUBLIC_SUPABASE_URL and
// EXPO_PUBLIC_SUPABASE_ANON_KEY are set in `.env.local`. No SDK — plain
// fetch. M1.1 additions: auth token injection, device-UUID header,
// reads from community_reports_public view, soft-delete via RPC,
// server-side error-code mapping (P0001–P0004).

import type { CommunityReport, ReportCategoryId } from '../community-reports';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { runBestEffortAccountOperation } from '../../account-session/operation-gate';
import { getDeviceUUID } from '../../device-uuid';
import { getAuthHeaders, getAuthUserId } from '../../supabase-auth';

const SYNC_QUEUE_KEY = 'fresh-greens.community-reports.sync-queue.v1';

export type ReportSubmitError =
  | 'device-banned'
  | 'otp-required'
  | 'rate-limited'
  | 'cluster-limited'
  | 'unknown';

type SupabaseRow = {
  id: string;
  category_id: string;
  location: { latitude: number; longitude: number };
  detail?: string | null;
  sub_tag?: string | null;
  place_name?: string | null;
  place_type?: string | null;
  google_place_id?: string | null;
  submitted_by?: string | null;
  photo_uri?: string | null;
  timestamp: number;
  trust_tier?: string | null;
};

export function isCommunityCloudConfigured(): boolean {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key);
}

function supabaseRestBase(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL!.replace(/\/$/, '');
  return `${url}/rest/v1`;
}

function rpcBase(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL!.replace(/\/$/, '');
  return `${url}/rest/v1/rpc`;
}

function rowToReport(row: SupabaseRow): CommunityReport {
  return {
    id: row.id,
    categoryId: row.category_id as ReportCategoryId,
    location: row.location,
    detail: row.detail ?? undefined,
    subTag: row.sub_tag ?? undefined,
    placeName: row.place_name ?? undefined,
    placeType: row.place_type ?? undefined,
    googlePlaceId: row.google_place_id ?? undefined,
    submittedBy: row.submitted_by ?? undefined,
    photoUri: row.photo_uri ?? undefined,
    timestamp: row.timestamp,
    trustTier: (row.trust_tier as 'verified' | 'community' | 'contributor') ?? undefined,
  };
}

function parsePostgrestError(body: string): ReportSubmitError {
  if (body.includes('P0001')) return 'device-banned';
  if (body.includes('P0002')) return 'otp-required';
  if (body.includes('P0003')) return 'rate-limited';
  if (body.includes('P0004')) return 'cluster-limited';
  return 'unknown';
}

/** All visible cloud reports via the public view; empty when unconfigured or on failure. */
export async function fetchCloudCommunityReports(): Promise<CommunityReport[]> {
  if (!isCommunityCloudConfigured()) return [];
  try {
    const headers = await getAuthHeaders();
    const url = `${supabaseRestBase()}/community_reports_public?select=*&order=timestamp.desc`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn('[community-cloud] fetch failed:', res.status);
      return [];
    }
    const rows = (await res.json()) as SupabaseRow[];
    if (!Array.isArray(rows)) return [];
    return rows.map(rowToReport);
  } catch (error) {
    console.warn('[community-cloud] fetch error:', error);
    return [];
  }
}

export type PushResult =
  | { ok: true }
  | { ok: false; error: ReportSubmitError };

/** Insert a report; returns ok or a typed error code. */
export async function pushCommunityReportToCloud(
  report: CommunityReport,
): Promise<PushResult> {
  if (!isCommunityCloudConfigured()) return { ok: false, error: 'unknown' };
  try {
    const [headers, deviceUUID, authUserId] = await Promise.all([
      getAuthHeaders(),
      getDeviceUUID(),
      getAuthUserId(),
    ]);
    const url = `${supabaseRestBase()}/community_reports`;
    const row = {
      id: report.id,
      category_id: report.categoryId,
      location: report.location,
      detail: report.detail ?? null,
      sub_tag: report.subTag ?? null,
      place_name: report.placeName ?? null,
      place_type: report.placeType ?? null,
      google_place_id: report.googlePlaceId ?? null,
      submitted_by: report.submittedBy ?? null,
      photo_uri: report.photoUri ?? null,
      timestamp: report.timestamp,
      device_uuid: deviceUUID,
      auth_user_id: authUserId,
      is_verified_phone: false,
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
    if (res.ok || res.status === 201) return { ok: true };
    const body = await res.text();
    console.warn('[community-cloud] push failed:', res.status, body);
    return { ok: false, error: parsePostgrestError(body) };
  } catch (error) {
    console.warn('[community-cloud] push error:', error);
    return { ok: false, error: 'unknown' };
  }
}

/** Soft-delete via RPC (Undo / hold-to-delete). */
export async function deleteCommunityReportFromCloud(id: string): Promise<void> {
  if (!isCommunityCloudConfigured()) return;
  try {
    const headers = await getAuthHeaders();
    const url = `${rpcBase()}/submitter_delete_report`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_report_id: id }),
    });
    if (!res.ok) {
      console.warn('[community-cloud] delete failed:', res.status);
    }
  } catch (error) {
    console.warn('[community-cloud] delete error:', error);
  }
}

export async function readSyncQueue(): Promise<CommunityReport[]> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeSyncQueue(reports: CommunityReport[]): Promise<void> {
  await runBestEffortAccountOperation(async () => {
    if (reports.length === 0) {
      await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
      return;
    }
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(reports));
  }, (error) => console.warn('[community-cloud] sync queue write failed:', error));
}

export async function enqueueCommunityReportSync(
  report: CommunityReport,
): Promise<void> {
  const queue = await readSyncQueue();
  const without = queue.filter((r) => r.id !== report.id);
  without.push(report);
  await writeSyncQueue(without);
}

export async function flushCommunityReportSyncQueue(): Promise<void> {
  if (!isCommunityCloudConfigured()) return;
  const queue = await readSyncQueue();
  if (queue.length === 0) return;
  const remaining: CommunityReport[] = [];
  for (const report of queue) {
    const result = await pushCommunityReportToCloud(report);
    if (!result.ok) remaining.push(report);
  }
  await writeSyncQueue(remaining);
}

/**
 * Account-isolation purge path. Pending uploads remain private local
 * workspace data until a later authenticated session explicitly resubmits.
 */
export async function purgeCommunityReportSyncQueueForAccount(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
}
