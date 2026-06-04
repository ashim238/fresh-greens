import type { Zone } from '../api/zones';
import { HAZARD_MERGE_ENABLED } from './constants';

/**
 * L3 cross-source collapse (Part B½). No-op until B4 enables
 * `HAZARD_MERGE_ENABLED` and implements grid + precedence merge.
 */
export function collapseHazardZones(zones: Zone[]): Zone[] {
  if (!HAZARD_MERGE_ENABLED) return zones;
  // B4: hazardBucket + canonicalHazardKey + source precedence
  return zones;
}
