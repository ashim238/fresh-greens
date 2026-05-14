import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import DestinationEnrouteSvg from '../assets/illustrations/destination-enroute.svg';
import DestinationHomeSvg from '../assets/illustrations/destination-home.svg';

export type DestinationVariant = 'home' | 'enroute';

/**
 * Destination marker — drops at the endpoint of the active route.
 *
 * Two variants, both 48×48 from Figma `296:468`:
 *   - `home`    — wiltedgreen pin with a freshgreen center (pre-departure).
 *   - `enroute` — checkered finish-line flag (mid-trip).
 *
 * Anchor differs per variant to honor each glyph's natural reference point:
 * the pin variant anchors at its tip (bottom-center) so the coordinate lands
 * exactly where the teardrop points; the flag variant anchors at the
 * pole base (≈ 22%, 85% of the 48×48 frame) so the pole "stands" on the
 * coordinate the way navigation flags conventionally do.
 *
 * **`tracksViewChanges` lifecycle.** Mounts with `true` so MapKit's
 * snapshot captures the SVG subtree once it paints, then flips to
 * `false` on the next tick so subsequent zoom/pan transitions don't
 * pay the re-render cost. Same pattern as `EnRouteCarMarker`. With
 * `false` from t=0, MapKit can snapshot before the SVG resolves and
 * the marker renders empty — visible as "marker disappears when I
 * zoom" because the cached empty bitmap is what gets drawn.
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

  // Per-variant anchor: pin tip lands on coord; flag pole base lands on coord.
  // Fractions of the 48×48 frame — see header note for derivation.
  const anchor =
    variant === 'home'
      ? { x: 0.5, y: 1 }
      : { x: 10.5 / 48, y: 41 / 48 };

  // Track-until-first-paint — see header note for the why. setTimeout(0)
  // (rAF-equivalent) is enough: by the next tick, the bundled SVG has
  // painted and MapKit's snapshot captures it correctly.
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setTracking(false), 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={anchor}
      tracksViewChanges={tracking}
      zIndex={500}
      accessibilityLabel={name ? `Destination: ${name}` : 'Destination'}
    >
      <View style={styles.frame} accessibilityIgnoresInvertColors>
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
