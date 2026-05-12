import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import type { HazardCategory } from '../lib/scoring';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

import { Hazard } from './Hazard';

/**
 * On-map zone marker that swaps between a compact "this is a hazard
 * zone" badge and an extended pill once the user enters the zone.
 * Matches Figma `1133:13297` (Default + Extended variants).
 *
 *   Default  — 72pt yellow rectangle with a 24pt hazard glyph inside.
 *              Always rendered for caution/avoid polygon/polyline
 *              zones within the viewport.
 *   Extended — 150×42 pill: `[hazard icon] For X mi.` Shown when the
 *              user is currently inside (or near) the zone, telling
 *              the driver how long the zone lasts so they know what
 *              to expect ahead.
 *
 * Second consumer of the Hazard glyph (first was the en-route turn
 * card hazard row). The Hazard component's existence is now earned
 * by the rule of three: turn-card row, this marker's Default, this
 * marker's Extended pill.
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
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      // Static within a mount — the caller remounts the Marker (via
      // a state-bearing key) when default↔extended flips. With that
      // pattern, we can leave tracking off in both states and avoid
      // the iOS MapKit per-frame snapshot cost.
      tracksViewChanges={false}
      accessibilityLabel={
        state === 'extended'
          ? `Entering a zone. ${humanReadableHazard(category)} for ${formatMiles(lengthMiles)}.`
          : `${humanReadableHazard(category)} zone ahead`
      }
    >
      {state === 'default' ? <DefaultMarker category={category} /> : (
        <ExtendedPill category={category} lengthMiles={lengthMiles} />
      )}
    </Marker>
  );
}

function DefaultMarker({ category }: { category: HazardCategory }) {
  // 32pt Hazard SVG inside a 72pt invisible tap region. The SVG
  // already carries the yellow diamond + black stroke — no inner
  // badge wrapper needed.
  return (
    <View style={styles.defaultMarker} accessibilityIgnoresInvertColors>
      <Hazard category={category} size={32} />
    </View>
  );
}

function ExtendedPill({
  category,
  lengthMiles,
}: {
  category: HazardCategory;
  lengthMiles: number;
}) {
  return (
    <View style={styles.extendedPill} accessibilityIgnoresInvertColors>
      <Hazard category={category} size={24} />
      <Text style={styles.extendedText} numberOfLines={1}>
        For {formatMiles(lengthMiles)}
      </Text>
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
  // Default marker — 72pt outer drop area as the marker's tap region;
  // the inner 32pt Hazard SVG carries its own yellow diamond + stroke.
  defaultMarker: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Extended pill — 150×42 yellow rounded pill per Figma 1133:13305.
  // 24pt hazard icon on the left, copy on the right. 4pt gap between.
  extendedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 150,
    height: 42,
    paddingHorizontal: 8,
    borderRadius: 32,
    backgroundColor: colors.yellow,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    justifyContent: 'center',
    // M3 Elevation 1 — same as Speed Limit sign so both yellow
    // hazard-register elements feel like physical objects on the map.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  extendedText: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
    textAlign: 'center',
  },
});
