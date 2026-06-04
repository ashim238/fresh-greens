import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import DestinationEnrouteSvg from '../assets/illustrations/destination-enroute.svg';
import DestinationHomeSvg from '../assets/illustrations/destination-home.svg';
import { shadows } from '../theme/shadows';

export type DestinationVariant = 'home' | 'enroute';

/**
 * Destination marker — drops at the endpoint of the active route.
 *
 * Two variants, both 48×48:
 *   - `home`    — pin teardrop with a checkered-flag inset + anchor dot
 *                 (Figma 1245:10977 "Home Destination"). Used on /home
 *                 route-preview where the trip hasn't started yet —
 *                 the pin reads as "this is where we're going."
 *   - `enroute` — checkered finish-line flag on a pole (Figma 296:468).
 *                 Used on /en-route mid-trip — the flag reads as
 *                 "racing toward the finish."
 *
 * The two variants share a checker-pattern visual vocabulary (so the
 * destination semantic is consistent across the trip lifecycle) but
 * use different shapes for each phase.
 *
 * Anchor differs per variant to honor each glyph's natural reference point:
 * the pin variant anchors at the small anchor-dot center (the SVG's "you
 * are here" indicator at viewBox y=92 of 96) so the coordinate lands on
 * the dot the way pin conventions expect; the flag variant anchors at
 * the pole base (≈ 22%, 85% of the 48×48 frame) so the pole "stands" on
 * the coordinate the way navigation flags conventionally do.
 *
 * **`tracksViewChanges` stays TRUE permanently.** The finish pin must
 * never vanish. Every `tracksViewChanges={false}` perf variant we tried
 * regressed something on iOS: snapshot-once-on-mount and re-track-in-place
 * both let MapKit re-rasterize a cached-but-empty bitmap on zoom /
 * route-switch reflows (the pin disappears), and the state-in-key remount
 * that fixed visibility lost the marker's zIndex on re-insertion (a
 * co-located community-report pin drew over the flag). Keeping it live is
 * the only option that stays visible AND honors zIndex in every state.
 * It's one static SVG marker — the re-render cost is negligible. See
 * docs/learnings.md — "the must-never-vanish markers always track."
 */
export function DestinationMarker({
  latitude,
  longitude,
  name,
  variant = 'home',
}: {
  latitude: number;
  longitude: number;
  /** Optional place name surfaced to VoiceOver. */
  name?: string;
  /** Visual register — pin for pre-departure, flag for mid-trip. */
  variant?: DestinationVariant;
}) {
  const Svg = variant === 'home' ? DestinationHomeSvg : DestinationEnrouteSvg;

  // Per-variant anchor:
  //   - home: anchor-dot center (the SVG explicitly draws a small dot
  //     at viewBox y=92 of 96 as the "you are here" reference; that's
  //     where the GPS coord should land, NOT the frame bottom). Was
  //     y=1.0 originally — the old wiltedgreen pin's tip sat at frame
  //     bottom — but the new Figma 1245:10977 SVG has the dot 4pt up
  //     from the bottom edge, so y=1.0 floats the coord below the dot.
  //   - enroute: flag pole base (≈ 22%, 85% of the 48×48 frame) so
  //     the pole "stands" on the coordinate.
  const anchor =
    variant === 'home'
      ? { x: 0.5, y: 92 / 96 }
      : { x: 10.5 / 48, y: 41 / 48 };

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={anchor}
      // Always live — see the header note. Never remounts, so zIndex={500}
      // stays honored against a co-located community-report pin.
      tracksViewChanges
      zIndex={500}
      accessibilityRole="image"
      accessibilityLabel={name ? `Destination: ${name}` : 'Destination'}
    >
      <View
        // Both variants now use shadows.e3 on the wrapper so the
        // destination pin reads with a marker-grade lift against busy
        // basemap content. Earlier rev applied e3 only to enroute on
        // the theory that the home variant SVG (Figma 1245:10977) baked
        // its own dual drop-shadow filter and a second RN shadow would
        // compound. In practice react-native-svg's <filter>+feGaussianBlur
        // support is patchy on native and the in-SVG shadow renders
        // significantly fainter than the Figma source — user-flagged
        // 2026-06-03 ("Finish pin shadow looks faint"). RN shadow on
        // the wrapper is the reliable surface to control elevation;
        // any residual SVG-filter rendering just compounds toward the
        // intended Figma weight rather than away from it.
        style={[styles.frame, shadows.e3]}
        accessibilityIgnoresInvertColors
      >
        <Svg width={48} height={48} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
