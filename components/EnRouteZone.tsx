import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import EnrouteHazardCommunityAlert from '../assets/illustrations/enroute-hazard-community-alert.svg';
import EnrouteHazardExtendedCommunityAlert from '../assets/illustrations/enroute-hazard-extended-community-alert.svg';
import EnrouteHazardExtendedLight from '../assets/illustrations/enroute-hazard-extended-light.svg';
import EnrouteHazardExtendedRoad from '../assets/illustrations/enroute-hazard-extended-road.svg';
import EnrouteHazardExtendedWildlife from '../assets/illustrations/enroute-hazard-extended-wildlife.svg';
import EnrouteHazardLight from '../assets/illustrations/enroute-hazard-light.svg';
import EnrouteHazardPolice from '../assets/illustrations/enroute-hazard-police.svg';
import EnrouteHazardRoad from '../assets/illustrations/enroute-hazard-road.svg';
import EnrouteHazardWildlife from '../assets/illustrations/enroute-hazard-wildlife.svg';

import type { HazardCategory } from '../lib/scoring';

/**
 * On-map zone marker that swaps between a compact "this is a hazard
 * zone" badge and an extended pill once the user enters the zone.
 * Matches Figma `1133:13297` (Default + Extended variants).
 *
 *   Default  — 62×50 yellow tail-shape marker with the diamond +
 *              glyph baked into the SVG. Always rendered for
 *              caution/avoid polygon/polyline zones within the
 *              viewport. The tail's tip sits at the coordinate.
 *   Extended — 158×50 pill: `[hazard icon] For X mi.` Shown when the
 *              user is currently inside (or near) the zone, telling
 *              the driver how long the zone lasts so they know what
 *              to expect ahead.
 *
 * v1 limitation: the Extended SVG carries a baked-in "For 0.5 mi."
 * text path from Figma. The dynamic `lengthMiles` prop is still
 * threaded through for VoiceOver (which uses the real length) but
 * the visible text on the pill is the Figma-baked value until a
 * future PR strips the text path and overlays a dynamic `<Text>`.
 */

export function EnRouteZone({
  latitude,
  longitude,
  category,
  state,
  lengthMiles,
}: {
  latitude: number;
  longitude: number;
  category: HazardCategory;
  state: 'default' | 'extended';
  /**
   * Approximate zone length in miles, surfaced on the Extended pill.
   * Caller computes this from the underlying zone geometry —
   * polyline length for streets, bounding-box diagonal for polygons.
   */
  lengthMiles: number;
}) {
  // Default anchor: the tail's tip is at the bottom-left corner of
  // the 62×50 SVG (matches the trusted-friend marker's frame). Anchor
  // there so the coord sits at the tail tip. Extended's tail is in
  // the same position relative to its 158×50 frame, so the x ratio
  // shifts (4/158 instead of 4/62) while y stays at 45/50.
  const anchor =
    state === 'default'
      ? { x: 4 / 62, y: 45 / 50 }
      : { x: 4 / 158, y: 45 / 50 };

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={anchor}
      // Static within a mount — the caller remounts the Marker (via
      // a state-bearing key) when default↔extended flips. With that
      // pattern, we can leave tracking off in both states and avoid
      // the iOS MapKit per-frame snapshot cost.
      tracksViewChanges={false}
      // role="none" — passive route-segment annotation, not a tappable
      // surface and not labelable image content. The label carries
      // the semantic ("zone N ahead"); no role over-promise.
      accessibilityRole="none"
      accessibilityLabel={
        state === 'extended'
          ? `Entering a zone. ${humanReadableHazard(category)} for ${formatMiles(lengthMiles)}.`
          : `${humanReadableHazard(category)} zone ahead`
      }
    >
      {state === 'default' ? (
        <DefaultMarker category={category} />
      ) : (
        <ExtendedPill category={category} />
      )}
    </Marker>
  );
}

function DefaultMarker({ category }: { category: HazardCategory }) {
  return (
    <View style={styles.defaultFrame} accessibilityIgnoresInvertColors>
      {category === 'lighting' && <EnrouteHazardLight width={62} height={50} />}
      {category === 'road-condition' && <EnrouteHazardRoad width={62} height={50} />}
      {category === 'wildlife' && <EnrouteHazardWildlife width={62} height={50} />}
      {category === 'community-alert' && (
        <EnrouteHazardCommunityAlert width={62} height={50} />
      )}
      {/* Police-presence marker. Consumed by the /home route-preview
          on-route hazard pipeline. NOT rendered in en-route's own on-map
          zone-marker pipeline (that explicitly filters out point zones +
          the police category — police precincts are points and don't get
          length-based "For X mi." treatment). Police gets NO ExtendedPill
          branch for the same reason. */}
      {category === 'police' && <EnrouteHazardPolice width={62} height={50} />}
    </View>
  );
}

function ExtendedPill({ category }: { category: HazardCategory }) {
  return (
    <View style={styles.extendedFrame} accessibilityIgnoresInvertColors>
      {category === 'lighting' && (
        <EnrouteHazardExtendedLight width={158} height={50} />
      )}
      {category === 'road-condition' && (
        <EnrouteHazardExtendedRoad width={158} height={50} />
      )}
      {category === 'wildlife' && (
        <EnrouteHazardExtendedWildlife width={158} height={50} />
      )}
      {category === 'community-alert' && (
        <EnrouteHazardExtendedCommunityAlert width={158} height={50} />
      )}
    </View>
  );
}

function humanReadableHazard(category: HazardCategory): string {
  switch (category) {
    case 'lighting':
      return 'Low lighting';
    case 'road-condition':
      return 'Road condition';
    case 'wildlife':
      return 'Wildlife';
    case 'community-alert':
      return 'Community alert';
    case 'police':
      return 'Police presence';
  }
}

/**
 * `0.5 mi.` (one decimal under 10 miles), `12 mi.` (rounded otherwise).
 * Matches Figma's "For 0.5 mi." pill copy without computing more
 * precision than the underlying length estimate justifies.
 */
function formatMiles(miles: number): string {
  if (miles < 10) return `${miles.toFixed(1)} mi.`;
  return `${Math.round(miles)} mi.`;
}

const styles = StyleSheet.create({
  defaultFrame: {
    width: 62,
    height: 50,
  },
  extendedFrame: {
    width: 158,
    height: 50,
  },
});
