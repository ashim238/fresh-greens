// Fresh Greens — community reports cloud adapter (B1).
//
// Optional Supabase PostgREST read/write when EXPO_PUBLIC_SUPABASE_URL and
// EXPO_PUBLIC_SUPABASE_ANON_KEY are set in `.env.local`. No SDK — plain
// fetch, same mock-fallback spirit as Overpass mirrors.
//
// Expected table `community_reports` (snake_case columns):
//   id, category_id, location (jsonb {latitude, longitude}), detail,
//   sub_tag, place_name, google_place_id, submitted_by, photo_uri, timestamp
//
// RLS: thesis demo typically allows anon SELECT; INSERT for signed-in users
// or open insert — configure in Supabase dashboard, not in this repo.

import type { CommunityReport, ReportCategoryId } from '../community-reports';

const SYNC_QUEUE_KEY = 'fresh-greens.community-reports.sync-queue.v1';

type SupabaseRow = {
  id: string;
  category_id: string;
  location: { latitude: number; longitude: number };
  detail?: string | null;
  sub_tag?: string | null;
  place_name?: string | null;
  google_place_id?: string | null;
  submitted_by?: string | null;
  photo_uri?: string | null;
  timestamp: number;
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

function supabaseHeaders(): Record<string, string> {
  return {
    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };
}

function rowToReport(row: SupabaseRow): CommunityReport {
  return {
    id: row.id,
    categoryId: row.category_id as ReportCategoryId,
    location: row.location,
    detail: row.detail ?? undefined,
    subTag: row.sub_tag ?? undefined,
    placeName: row.place_name ?? undefined,
    googlePlaceId: row.google_place_id ?? undefined,
    submittedBy: row.submitted_by ?? undefined,
    photoUri: row.photo_uri ?? undefined,
    timestamp: row.timestamp,
  };
}

function reportToRow(report: CommunityReport): SupabaseRow {
  return {
    id: report.id,
    category_id: report.categoryId,
    location: report.location,
    detail: report.detail ?? null,
    sub_tag: report.subTag ?? null,
    place_name: report.placeName ?? null,
    google_place_id: report.googlePlaceId ?? null,
    submitted_by: report.submittedBy ?? null,
    photo_uri: report.photoUri ?? null,
    timestamp: report.timestamp,
  };
}

/** All cloud reports; empty when unconfigured or on failure. */
export async function fetchCloudCommunityReports(): Promise<CommunityReport[]> {
  if (!isCommunityCloudConfigured()) return [];
  try {
    const url = `${supabaseRestBase()}/community_reports?select=*&order=timestamp.desc`;
    const res = await fetch(url, { headers: supabaseHeaders() });
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

/** Upsert one report; returns true on success. */
export async function pushCommunityReportToCloud(
  report: CommunityReport,
): Promise<boolean> {
  if (!isCommunityCloudConfigured()) return false;
  try {
    const url = `${supabaseRestBase()}/community_reports`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...supabaseHeaders(),
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(reportToRow(report)),
    });
    if (!res.ok && res.status !== 409) {
      console.warn('[community-cloud] push failed:', res.status);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[community-cloud] push error:', error);
    return false;
  }
}

/** Best-effort delete (Undo / hold-to-delete). */
export async function deleteCommunityReportFromCloud(id: string): Promise<void> {
  if (!isCommunityCloudConfigured()) return;
  try {
    const url = `${supabaseRestBase()}/community_reports?id=eq.${encodeURIComponent(id)}`;
    await fetch(url, { method: 'DELETE', headers: supabaseHeaders() });
  } catch (error) {
    console.warn('[community-cloud] delete error:', error);
  }
}

export async function readSyncQueue(): Promise<CommunityReport[]> {
  const { default: AsyncStorage } = await import(
    '@react-native-async-storage/async-storage'
  );
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
  const { default: AsyncStorage } = await import(
    '@react-native-async-storage/async-storage'
  );
  if (reports.length === 0) {
    await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
    return;
  }
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(reports));
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
    const ok = await pushCommunityReportToCloud(report);
    if (!ok) remaining.push(report);
  }
  await writeSyncQueue(remaining);
}
