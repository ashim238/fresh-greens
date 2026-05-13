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
 * `tracksViewChanges={false}` after first paint — the marker doesn't
 * animate or update; static throughout the trip. The SVG is bundled
 * (no async path resolution), so the first frame is safe.
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

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={anchor}
      tracksViewChanges={false}
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
