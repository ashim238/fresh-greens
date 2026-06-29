// Fresh Greens — community reports adapter.
//
// Persistent local store for user-submitted reports. Mock-first: backed
// by AsyncStorage so reports survive app restarts within a device. When
// `EXPO_PUBLIC_SUPABASE_*` is set (B1), reads merge cloud + local and
// submits enqueue to `lib/api/sources/community-cloud.ts` for upload.
// Public surface (`getCommunityReportsAsZones`, `addCommunityReport`) is
// unchanged for consumers.
//
// Reports are surfaced to the rest of the app as `Zone[]` with point
// geometry — same Zone type the OSM adapter returns, so they flow
// through the existing scoring pipeline (lib/scoring.ts) without any
// consumer changes. Severity-to-zoneType mapping is per-category; see
// CATEGORIES below.
//
// Anonymity is handled at write time, not at storage time: sensitive-
// category reports never persist a `submittedBy` field. The user can't
// later "de-anonymize" a sensitive report because there's no record
// of who they were when they made it.
//
// The `addCommunityReport` → `removeCommunityReport` pair supports the
// Thank-You screen's Undo affordance — a 5-second window where the user
// can take back what they submitted.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Coordinate, Zone, ZoneType } from './zones';

const STORAGE_KEY = 'fresh-greens.community-reports.v1';

// --- Categories -----------------------------------------------------------

/**
 * The six report categories. ID is the stable identifier (used in
 * storage + as React keys); the rest is presentation metadata consumed
 * by the /report screen.
 */
export type ReportCategoryId =
  | 'lighting'
  | 'hazard'
  | 'incident'
  | 'felt-unsafe'
  | 'felt-welcome'
  | 'black-owned';

export type ReportCategory = {
  id: ReportCategoryId;
  /** Tile label in the picker grid + title in the detail screen. */
  label: string;
  /** Detail-screen subtitle. The question the modal asks the user. */
  subtitle: string;
  /** How a submission of this category translates to safety scoring. */
  zoneType: ZoneType;
  /**
   * Sensitive categories are auto-anonymous. The submitter's identity
   * is not recorded; an "All reports are anonymous" disclosure shows
   * in the detail screen.
   */
  anonymous: boolean;
  /**
   * Whether the detail screen shows a photo upload affordance. Only
   * the picker UI uses this — the actual photo capture is a v2
   * concern (currently a visual stub, no real camera flow).
   */
  hasPhoto: boolean;
  /** Submit button copy. "Submit report" vs. "Submit review" by tone. */
  cta: string;
  /**
   * Optional whitelist of place-type sub-tags surfaced as inline
   * chips in the detail view. Captured on the persisted report and
   * carried through to the marker for future per-type glyph
   * differentiation. Only the *place* categories (black-owned,
   * felt-welcome) define this — incident/lighting/hazard/felt-unsafe
   * describe conditions, not place types, so they leave it
   * undefined.
   */
  subTags?: string[];
  /**
   * Optional structured grouping of `subTags` for the picker UI.
   * When set, the /report detail screen renders each group as its
   * own labeled chip row instead of one flat row, which is useful
   * when the subTag whitelist mixes semantic categories (e.g.,
   * felt-welcome combines place-type tags like "Restaurant" with
   * identity tags like "LGBTQ+ welcoming" — different reasons a
   * place can earn a felt-welcome vote, deserving their own
   * subsection headers).
   *
   * Each group's `tags` must be a subset of `subTags`. The picker
   * concatenates groups in order. A group with no `label` renders
   * its chips without a header (for catch-all rows like "Other").
   *
   * Data-layer routing (recCategoryForReport in recommendations.ts)
   * still reads the flat `subTags` field; this is purely a
   * presentation enrichment.
   */
  subTagGroups?: Array<{
    /** Optional header label rendered above this group's chips. */
    label?: string;
    /** Whitelist subset for this group, in chip-render order. */
    tags: string[];
  }>;
  /**
   * Per-subTag zone severity override. When set, `reportToZone` uses the
   * matched entry instead of `zoneType` so a "Pitch black" lighting report
   * scores as `avoid` while a "Dim area" report scores as `caution`, rather
   * than both inheriting the category's single fallback zoneType.
   */
  severityMap?: Record<string, ZoneType>;
};

export const CATEGORIES: ReportCategory[] = [
  // Row 1: avoid (most severe)
  {
    id: 'incident',
    label: 'Incident',
    subtitle: 'What did you see?',
    zoneType: 'avoid',
    anonymous: true,
    hasPhoto: true,
    cta: 'Submit report',
    subTags: ['Accident', 'Confrontation', 'Suspicious activity', 'Police presence', 'Near miss'],
    subTagGroups: [
      { label: 'What happened?', tags: ['Accident', 'Confrontation', 'Suspicious activity', 'Police presence', 'Near miss'] },
    ],
    severityMap: {
      'Accident': 'avoid',
      'Confrontation': 'avoid',
      'Suspicious activity': 'avoid',
      'Police presence': 'avoid',
      'Near miss': 'caution',
    },
  },
  {
    id: 'felt-unsafe',
    label: 'Felt unsafe',
    subtitle: "Talk to us. What’s going on?",
    zoneType: 'avoid',
    anonymous: true,
    hasPhoto: false,
    cta: 'Submit report',
    subTags: ['Threatened', 'Followed', 'Harassed', 'Uncomfortable', 'Uneasy vibe'],
    subTagGroups: [
      { label: 'What was it?', tags: ['Threatened', 'Followed', 'Harassed', 'Uncomfortable', 'Uneasy vibe'] },
    ],
    severityMap: {
      'Threatened': 'avoid',
      'Followed': 'avoid',
      'Harassed': 'avoid',
      'Uncomfortable': 'caution',
      'Uneasy vibe': 'caution',
    },
  },
  // Row 2: caution (functional / heads-up)
  {
    id: 'lighting',
    label: 'Lighting',
    subtitle: 'Street lights down or dimmer than normal?',
    zoneType: 'caution',
    anonymous: false,
    hasPhoto: true,
    cta: 'Submit report',
    subTags: ['Pitch black', 'No streetlights', 'Broken light', 'Flickering', 'Dim area'],
    subTagGroups: [
      { label: 'How dark is it?', tags: ['Pitch black', 'No streetlights', 'Broken light', 'Flickering', 'Dim area'] },
    ],
    severityMap: {
      'Pitch black': 'avoid',
      'No streetlights': 'avoid',
      'Broken light': 'caution',
      'Flickering': 'caution',
      'Dim area': 'caution',
    },
  },
  {
    id: 'hazard',
    label: 'Hazard',
    subtitle: 'Anything in the road?',
    zoneType: 'caution',
    anonymous: false,
    hasPhoto: true,
    cta: 'Submit report',
    subTags: ['Road blocked', 'Flooding', 'Construction', 'Pothole / damage', 'Debris'],
    subTagGroups: [
      { label: "What's the hazard?", tags: ['Road blocked', 'Flooding', 'Construction', 'Pothole / damage', 'Debris'] },
    ],
    severityMap: {
      'Road blocked': 'avoid',
      'Flooding': 'avoid',
      'Construction': 'caution',
      'Pothole / damage': 'caution',
      'Debris': 'caution',
    },
  },
  // Row 3: safe (affirming)
  {
    id: 'felt-welcome',
    label: 'Felt welcome',
    subtitle: 'What made it feel that way?',
    zoneType: 'safe',
    anonymous: false,
    hasPhoto: false,
    cta: 'Share your experience',
    // subTags here mix two kinds of "why this felt welcome":
    //   1. Place-type tags (Restaurant, Bar/Cafe, …) — what kind of
    //      place it is.
    //   2. Identity / context tags (Women-owned, LGBTQ+ welcoming,
    //      Open restroom, Late-night welcome) — what about this
    //      place earned the affirmation.
    //
    // The user picks ONE — whichever feels most salient. The
    // recommendations adapter (`getCommunityRecommendations`)
    // dispatches on this subTag value to route the submission into
    // the matching browse-sheet chip ("Women Owned", "LGBTQ+
    // Welcoming", "Restroom", "Late Night, Warm Welcome"); a
    // place-type subTag stays under Black-Owned's chip's nearest-
    // neighbor felt-welcome bucket.
    //
    // This architecture replaced an earlier attempt that promoted
    // each identity tag to a top-level category (10 picker tiles)
    // which was visually too crowded — see closed PR #158.
    subTags: [
      'Restaurant',
      'Bar/Cafe',
      'Retail',
      'Park/Public space',
      'Residential',
      'Women-owned',
      'LGBTQ+ welcoming',
      'Open restroom',
      'Late-night welcome',
      'Other',
    ],
    // Picker grouping — place-type tags answer "what kind of place,"
    // identity tags answer "what about it earned the vote." Without
    // a header users skim a single flat row and miss the distinction;
    // with headers the choice frames itself.
    subTagGroups: [
      {
        label: 'What kind of place is it?',
        tags: ['Restaurant', 'Bar/Cafe', 'Retail', 'Park/Public space', 'Residential'],
      },
      {
        label: 'What made it welcoming?',
        tags: ['Women-owned', 'LGBTQ+ welcoming', 'Open restroom', 'Late-night welcome'],
      },
      // Catch-all row gets its own header ("Doesn't quite fit?")
      // instead of dangling unlabeled below the identity group —
      // without it, the "Other" chip reads as a sixth identity
      // chip rather than a fallback. Using "Other" both as the
      // label and the chip would be visually redundant.
      { label: "Doesn't quite fit?", tags: ['Other'] },
    ],
  },
  {
    id: 'black-owned',
    label: 'Black-owned',
    subtitle: 'A new community staple?',
    zoneType: 'safe',
    anonymous: false,
    hasPhoto: false,
    cta: 'Add to directory',
    subTags: [
      'Restaurant',
      'Bar/Cafe',
      'Retail',
      'Salon/Barber',
      'Services',
      'Other',
    ],
  },
];

/** Look up a category by ID. Throws on unknown ID — narrow type means this should be unreachable. */
export function getCategory(id: ReportCategoryId): ReportCategory {
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown category: ${id}`);
  return found;
}

// --- Storage shape --------------------------------------------------------

/**
 * Persisted shape. `submittedBy` is omitted on anonymous categories —
 * see file header comment on anonymity-at-write-time.
 */
export type CommunityReport = {
  id: string;
  categoryId: ReportCategoryId;
  location: Coordinate;
  detail?: string;
  /**
   * Place-type sub-tag the user picked from the category's `subTags`
   * whitelist. Only set for categories that define `subTags` (place
   * categories — black-owned, felt-welcome). String-typed (not a
   * narrow union) so categories can grow their whitelists without a
   * type-system migration.
   */
  subTag?: string;
  /**
   * Google Places primary type (e.g. "restaurant", "park") returned by
   * the `/api/nearby` lookup at submit time. Stored alongside `placeName`
   * and `googlePlaceId` so future UI can differentiate marker glyphs by
   * place type without re-querying Places.
   */
  placeType?: string;
  /**
   * Auto-resolved business name at the report's coordinates, looked
   * up at submit time via the proxy's `/api/nearby` endpoint (Google
   * Places `searchNearby` with a 50m radius). Lets the
   * recommendations card render "Wintzell's Oyster House" instead of
   * "Restaurant." Undefined when the lookup returned no nearby
   * business (rural / sparse-Places-coverage) or when the network
   * call failed — display path falls back to subTag-based naming.
   */
  placeName?: string;
  /**
   * Google Places id from submit-time `/api/nearby` (stable identity
   * for matching external listings and hydrating card fields).
   */
  googlePlaceId?: string;
  /** Anonymous-category reports never set this. */
  submittedBy?: string;
  /**
   * Local file URI from `expo-image-picker.launchCameraAsync` when
   * the user attached a photo via /report. Local-device only —
   * persisting across reinstall would require an upload step the v1
   * device-local storage model doesn't have. Display path falls back
   * to the category glyph when undefined (vast majority — most
   * categories don't expose the photo affordance, and even on
   * `hasPhoto` categories it's optional).
   */
  photoUri?: string;
  /** ms since epoch — used for ordering and stale-cleanup if ever needed. */
  timestamp: number;
  /** Server-derived trust signal from the public view (M1.1). */
  trustTier?: 'verified' | 'community' | 'contributor';
};

// --- Public API -----------------------------------------------------------

/**
 * Append a new report. Returns the assigned id so the caller can pair
 * it with an Undo handler.
 */
export async function addCommunityReport(
  draft: Omit<CommunityReport, 'id' | 'timestamp'>,
): Promise<CommunityReport> {
  const report: CommunityReport = {
    ...draft,
    id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };
  const all = await readLocalOnly();
  all.push(report);
  await writeLocalOnly(all);

  try {
    const cloud = await import('./sources/community-cloud');
    if (cloud.isCommunityCloudConfigured()) {
      const result = await cloud.pushCommunityReportToCloud(report);
      if (!result.ok) {
        // Remove the optimistic local save on server rejection
        const remaining = (await readLocalOnly()).filter((r) => r.id !== report.id);
        await writeLocalOnly(remaining);
        throw new ReportSubmitRejection(result.error);
      }
    }
  } catch (error) {
    if (error instanceof ReportSubmitRejection) throw error;
    // Network failure — keep local, queue for retry
    void scheduleCommunityCloudSync(report);
  }

  return report;
}

export class ReportSubmitRejection extends Error {
  code: import('./sources/community-cloud').ReportSubmitError;
  constructor(code: import('./sources/community-cloud').ReportSubmitError) {
    super(`Report rejected: ${code}`);
    this.name = 'ReportSubmitRejection';
    this.code = code;
  }
}

/**
 * Remove a report by id. Used by the Thank-You screen's Undo button.
 * Silent if the id isn't found (already-removed; nothing to do).
 */
export async function removeCommunityReport(id: string): Promise<void> {
  const all = await readLocalOnly();
  const filtered = all.filter((r) => r.id !== id);
  await writeLocalOnly(filtered);
  void scheduleCommunityCloudDelete(id);
}

/**
 * Wipes every community report from the store. Unlike removeCommunityReport,
 * this ignores authorship + anonymity (those gate the per-marker hold-to-
 * delete, so anonymous `incident`/`felt-unsafe` reports and reports made
 * under a prior sign-in can't be cleared that way). Used only by the
 * __DEV__ reset affordance on /home to get a clean map for screenshots.
 */
export async function clearAllCommunityReports(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * Returns reports as Zone[] with point geometry, ready to feed the
 * scoring pipeline alongside OSM zones. Each report becomes one point
 * zone whose ZoneType is determined by its category (CATEGORIES table).
 */
export async function getCommunityReportsAsZones(): Promise<Zone[]> {
  const reports = await readMergedReports();
  return reports.map(reportToZone);
}

/** For UI display (e.g., "you have N reports nearby"). */
export async function getCommunityReports(): Promise<CommunityReport[]> {
  return readMergedReports();
}

// --- Internals ------------------------------------------------------------

function reportToZone(report: CommunityReport): Zone {
  const category = getCategory(report.categoryId);
  return {
    id: report.id,
    source: 'community-report',
    type: category.severityMap?.[report.subTag ?? ''] ?? category.zoneType,
    // Marker accessibilityLabel — leads with the resolved business
    // name when we have it ("Wintzell's Oyster House: felt welcome")
    // so VoiceOver users hear what kind of place the report is
    // about, not just the category abstraction.
    label: report.placeName
      ? `${report.placeName}: ${category.label.toLowerCase()}${report.detail ? ` — ${report.detail}` : ''}`
      : `${category.label}${report.detail ? `: ${report.detail}` : ''}`,
    geometry: 'point',
    coordinates: [report.location],
    category: 'community-report',
    reportCategoryId: report.categoryId,
    reportSubTag: report.subTag,
    reportDetail: report.detail,
    reportTimestamp: report.timestamp,
    reportPlaceName: report.placeName,
    reportSubmittedBy: report.submittedBy,
    reportPhotoUri: report.photoUri,
  };
}

async function readLocalOnly(): Promise<CommunityReport[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    // Corrupted storage entry — log and start fresh rather than crash.
    // Real risk is low (we control the writer); the catch is hygiene.
    console.warn('[community-reports] read failed, starting fresh:', error);
    return [];
  }
}

async function writeLocalOnly(reports: CommunityReport[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

/** Device store wins on id collision; cloud fills in other devices' reports. */
function mergeReportsById(
  cloud: CommunityReport[],
  local: CommunityReport[],
): CommunityReport[] {
  const byId = new Map<string, CommunityReport>();
  for (const r of cloud) byId.set(r.id, r);
  for (const r of local) byId.set(r.id, r);
  return [...byId.values()].sort((a, b) => b.timestamp - a.timestamp);
}

async function readMergedReports(): Promise<CommunityReport[]> {
  const local = await readLocalOnly();
  try {
    const cloud = await import('./sources/community-cloud');
    if (!cloud.isCommunityCloudConfigured()) return local;
    await cloud.flushCommunityReportSyncQueue();
    const remote = await cloud.fetchCloudCommunityReports();
    return mergeReportsById(remote, local);
  } catch (error) {
    console.warn('[community-reports] cloud merge failed, local only:', error);
    return local;
  }
}

async function scheduleCommunityCloudSync(report: CommunityReport): Promise<void> {
  try {
    const cloud = await import('./sources/community-cloud');
    if (!cloud.isCommunityCloudConfigured()) return;
    await cloud.enqueueCommunityReportSync(report);
    await cloud.flushCommunityReportSyncQueue();
  } catch (error) {
    console.warn('[community-reports] sync schedule failed:', error);
  }
}

async function scheduleCommunityCloudDelete(id: string): Promise<void> {
  try {
    const cloud = await import('./sources/community-cloud');
    if (!cloud.isCommunityCloudConfigured()) return;
    const queue = await cloud.readSyncQueue();
    await cloud.writeSyncQueue(queue.filter((r) => r.id !== id));
    await cloud.deleteCommunityReportFromCloud(id);
  } catch (error) {
    console.warn('[community-reports] cloud delete failed:', error);
  }
}
