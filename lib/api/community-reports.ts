// Fresh Greens — community reports adapter.
//
// Persistent local store for user-submitted reports. Mock-first: backed
// by AsyncStorage so reports survive app restarts within a device. A real
// backend (Firestore, Supabase, custom API) would slot in by replacing
// the read/write internals here — `getCommunityReportsAsZones` and
// `addCommunityReport` are the public surface, and they keep the same
// signatures regardless of where the data actually lives.
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
 *
 * `iconName` is typed loosely as `string` here so this file stays free
 * of UI-layer imports (Ionicons). The consumer (app/report.tsx) types
 * it precisely on use.
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
  /** Ionicons glyph name. Typed as string here; consumer narrows. */
  iconName: string;
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
};

export const CATEGORIES: ReportCategory[] = [
  // Row 1: avoid (most severe)
  {
    id: 'incident',
    label: 'Incident',
    iconName: 'flag',
    subtitle: 'What did you see?',
    zoneType: 'avoid',
    anonymous: true,
    hasPhoto: true,
    cta: 'Submit report',
  },
  {
    id: 'felt-unsafe',
    label: 'Felt unsafe',
    iconName: 'eye-outline',
    subtitle: 'Talk to us. What’s going on?',
    zoneType: 'avoid',
    anonymous: true,
    hasPhoto: false,
    cta: 'Submit report',
  },
  // Row 2: caution (functional / heads-up)
  {
    id: 'lighting',
    label: 'Lighting',
    iconName: 'bulb-outline',
    subtitle: 'Street lights down or dimmer than normal?',
    zoneType: 'caution',
    anonymous: false,
    hasPhoto: true,
    cta: 'Submit report',
  },
  {
    id: 'hazard',
    label: 'Hazard',
    iconName: 'warning',
    subtitle: 'Anything in the road?',
    zoneType: 'caution',
    anonymous: false,
    hasPhoto: true,
    cta: 'Submit report',
  },
  // Row 3: safe (affirming)
  {
    id: 'felt-welcome',
    label: 'Felt welcome',
    iconName: 'heart-outline',
    subtitle: 'What made it feel that way?',
    zoneType: 'safe',
    anonymous: false,
    hasPhoto: false,
    cta: 'Submit review',
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
      'Personal',
      'Women-owned',
      'LGBTQ+ welcoming',
      'Open restroom',
      'Late-night welcome',
      'Other',
    ],
  },
  {
    id: 'black-owned',
    label: 'Black-owned',
    iconName: 'star-outline',
    subtitle: 'A new community staple?',
    zoneType: 'safe',
    anonymous: false,
    hasPhoto: false,
    cta: 'Submit review',
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
   * Auto-resolved business name at the report's coordinates, looked
   * up at submit time via the proxy's `/api/nearby` endpoint (Google
   * Places `searchNearby` with a 50m radius). Lets the
   * recommendations card render "Wintzell's Oyster House" instead of
   * "Restaurant." Undefined when the lookup returned no nearby
   * business (rural / sparse-Places-coverage) or when the network
   * call failed — display path falls back to subTag-based naming.
   */
  placeName?: string;
  /** Anonymous-category reports never set this. */
  submittedBy?: string;
  /** ms since epoch — used for ordering and stale-cleanup if ever needed. */
  timestamp: number;
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
  const all = await readAll();
  all.push(report);
  await writeAll(all);
  return report;
}

/**
 * Remove a report by id. Used by the Thank-You screen's Undo button.
 * Silent if the id isn't found (already-removed; nothing to do).
 */
export async function removeCommunityReport(id: string): Promise<void> {
  const all = await readAll();
  const filtered = all.filter((r) => r.id !== id);
  await writeAll(filtered);
}

/**
 * Returns reports as Zone[] with point geometry, ready to feed the
 * scoring pipeline alongside OSM zones. Each report becomes one point
 * zone whose ZoneType is determined by its category (CATEGORIES table).
 */
export async function getCommunityReportsAsZones(): Promise<Zone[]> {
  const reports = await readAll();
  return reports.map(reportToZone);
}

/** For UI display (e.g., "you have N reports nearby"). */
export async function getCommunityReports(): Promise<CommunityReport[]> {
  return readAll();
}

// --- Internals ------------------------------------------------------------

function reportToZone(report: CommunityReport): Zone {
  const category = getCategory(report.categoryId);
  return {
    id: report.id,
    type: category.zoneType,
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
  };
}

async function readAll(): Promise<CommunityReport[]> {
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

async function writeAll(reports: CommunityReport[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}
