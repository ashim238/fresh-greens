import type { FetchBudget } from './types';

export const PREVIEW_BUDGET: FetchBudget = {
  maxMs: 10_000,
  maxCalls: 20,
  maxParallel: 8,
};

export const NAV_BUDGET: FetchBudget = {
  maxMs: 6_000,
  maxCalls: 2,
  maxParallel: 2,
};

export const LONG_TRIP_METERS = 45_000;
export const WAVE1_ANCHOR_CAP = 8;
export const MAX_SEGMENT_ANCHORS = 20;
export const SEGMENT_TARGET_SPACING_M = 70_000;
export const SEGMENT_MAX_RADIUS_M = 12_000;
export const SEGMENT_MIN_RADIUS_M = 1_500;
export const CORRIDOR_RADIUS_SPACING_FACTOR = 0.4;

export const MIN_STRAIGHT_METERS = 20_000;
export const MAX_BEARING_DELTA_DEG = 12;
export const CARDINAL_TOLERANCE_DEG = 15;
export const BBOX_PAD_METERS = 2_000;

export const GAP_ARC_METERS = 80_000;
export const MAX_GAP_FILLS = 3;
export const GAP_MIN_UNCOVERED_METERS = 60_000;
export const HOT_LEG_ZONE_COUNT = 35;
export const HOT_LEG_RADIUS_FACTOR = 0.5;

export const SEGMENT_TIMEOUT_MS = 8_000;
export const OVERPASS_MIRROR_COUNT = 2;
export const TRIP_MOCK_ON_EMPTY = true;

export const NAV_ROLL_INTERVAL_MS = 45_000;
export const NAV_MIN_MOVE_METERS = 2_000;
export const NAV_AHEAD_METERS = 30_000;
export const NAV_AROUND_RADIUS_M = 3_000;
export const NAV_ROLL_WHEN_BACKGROUNDED = false;

export const ZONE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const ZONE_CACHE_GRID_METERS = 50;
export const ZONE_CACHE_KEY_INCLUDES_ROUTE_ID = false;

export const LONG_TRIP_COPY_METERS = 250_000;

/** Path length above which wave-1 uses a higher around-anchor cap (megatrip). */
export const MEGA_TRIP_PATH_METERS = LONG_TRIP_COPY_METERS;
export const MEGA_TRIP_WAVE1_ANCHOR_CAP = 14;

export const LONG_TRIP_FOOTNOTE_COPY =
  'Hazards checked along sampled stretches of this route.';
export const ALL_CLEAR_A11Y_LONG_TRIP =
  'No hazards found in checked areas along this route.';
export const PARTIAL_DEBOUNCE_MS = 0;

export const CLASSIFY_USE_DENSIFIED_POLYLINE = false;
export const COMMUNITY_MERGE_AFTER_WAVE = 1;
export const COMMUNITY_IN_CORRIDOR_CACHE = false;

/** Part B½ — cross-source hazard equivalence (B4). */
export const HAZARD_GRID_METERS = 250;
export const HAZARD_MERGE_ENABLED = true;

/** States where straight-leg bbox samples include `dot-511` (demo corridor). */
export const SUPPORTED_511_STATES = [
  'AL',
  'GA',
  'TN',
  'MS',
  'NY',
  'NJ',
  'PA',
  'DE',
  'MD',
  'VA',
  'NC',
  'SC',
  'KY',
  'FL',
  'LA',
] as const;

export const SUPPORTED_511_STATE_SET = new Set<string>(SUPPORTED_511_STATES);
