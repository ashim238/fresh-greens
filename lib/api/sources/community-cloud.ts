// Fresh Greens — community reports cloud adapter (B1 → M1.1).
//
// The Supabase repository owns SDK queries and database rows. This adapter
// keeps the product-facing report mapping and local-first retry queue.

import type { CommunityReport } from '../community-reports';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  accountOperationGate,
  runBestEffortAccountOperation,
} from '../../account-session/operation-gate';
import {
  communityReportsRepository,
  isCommunityReportsRepositoryConfigured,
  type CommunityReportPublicRow,
  type CommunityReportSubmitError,
} from '../../supabase/community-reports-repository';

const SYNC_QUEUE_KEY = 'fresh-greens.community-reports.sync-queue.v1';

export type ReportSubmitError = CommunityReportSubmitError;

export function isCommunityCloudConfigured(): boolean {
  return isCommunityReportsRepositoryConfigured();
}

function rowToReport(row: CommunityReportPublicRow): CommunityReport {
  return {
    id: row.id,
    categoryId: row.category_id,
    location: row.location,
    detail: row.detail ?? undefined,
    subTag: row.sub_tag ?? undefined,
    placeName: row.place_name ?? undefined,
    placeType: row.place_type ?? undefined,
    googlePlaceId: row.google_place_id ?? undefined,
    ownedByCurrentUser: row.owned_by_current_user ?? undefined,
    photoUri: row.photo_uri ?? undefined,
    timestamp: row.timestamp,
    trustTier: row.trust_tier ?? undefined,
  };
}

/** All visible cloud reports via the public view; empty when unconfigured or on failure. */
export async function fetchCloudCommunityReports(): Promise<CommunityReport[]> {
  if (!isCommunityCloudConfigured()) return [];
  try {
    const rows = await accountOperationGate.runCurrent((signal) =>
      communityReportsRepository.fetchCommunityReports(signal),
    );
    return rows.map(rowToReport);
  } catch {
    console.warn('[community-cloud] fetch unavailable');
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
    return await accountOperationGate.runCurrent(async (signal) => {
      return communityReportsRepository.insertCommunityReport(
        {
          id: report.id,
          category_id: report.categoryId,
          location: report.location,
          detail: report.detail ?? null,
          sub_tag: report.subTag ?? null,
          place_name: report.placeName ?? null,
          place_type: report.placeType ?? null,
          google_place_id: report.googlePlaceId ?? null,
        },
        signal,
      );
    });
  } catch {
    console.warn('[community-cloud] push unavailable');
    return { ok: false, error: 'unknown' };
  }
}

/** Soft-delete via RPC (Undo / hold-to-delete). */
export async function deleteCommunityReportFromCloud(id: string): Promise<void> {
  if (!isCommunityCloudConfigured()) return;
  await runBestEffortAccountOperation(
    (signal) => communityReportsRepository.deleteCommunityReport(id, signal),
    () => console.warn('[community-cloud] delete unavailable'),
  );
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
  }, () => console.warn('[community-cloud] sync queue write failed'));
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
