import HazardCommunityAlert from '../assets/illustrations/hazard-community-alert.svg';
import HazardLighting from '../assets/illustrations/hazard-lighting.svg';
import HazardPolice from '../assets/illustrations/hazard-police.svg';
import HazardRoadCondition from '../assets/illustrations/hazard-road-conditions.svg';
import HazardWildlife from '../assets/illustrations/hazard-wildlife.svg';

import type { HazardCategory } from '../lib/scoring';

/**
 * Hazard glyph — 4 variants matching Figma `1133:13397` / `1133:13297`.
 * Each variant is the full visual (yellow diamond + black glyph), not
 * just the inner glyph — the SVG carries its own background fill and
 * stroke. Callers should NOT wrap this in an additional yellow
 * container; that double-counts the diamond.
 *
 * Surfaces:
 *   - /en-route turn-card hazard row (small, inline)
 *   - EnRouteZone Default badge on the map (32pt)
 *   - EnRouteZone Extended pill (24pt, inside the pill chrome)
 *   - /en-route Full bottom-sheet hazard panel (96pt)
 *
 * `color` is intentionally not a prop — the SVG's fill is baked in
 * (yellow body + black stroke + black glyph). If a future tinted
 * variant is needed, do it via a separate component, not by trying
 * to recolor the SVG at runtime.
 */
export function Hazard({
  category,
  size = 24,
}: {
  category: HazardCategory;
  size?: number;
}) {
  switch (category) {
    case 'lighting':
      return <HazardLighting width={size} height={size} />;
    case 'road-condition':
      return <HazardRoadCondition width={size} height={size} />;
    case 'wildlife':
      return <HazardWildlife width={size} height={size} />;
    case 'community-alert':
      return <HazardCommunityAlert width={size} height={size} />;
    case 'police':
      return <HazardPolice width={size} height={size} />;
  }
}
