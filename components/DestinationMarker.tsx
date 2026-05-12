import { MapPin } from 'phosphor-react-native/src/icons/MapPin';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { colors } from '../theme/colors';

/**
 * Destination pin — drops at the endpoint of the active route.
 *
 * Phosphor `MapPin` weight="fill" in wiltedgreen, anchored bottom-
 * center so the pin's tip sits exactly on the coordinate. Sized
 * 36×36 — large enough to read against busy map content (POI
 * labels, business pins) without dominating the route line.
 *
 * Color choice: wiltedgreen (the project's deeper brand green) so
 * the pin reads as brand-aligned without colliding with reserved
 * orange/red/yellow signaling. Distinct from the lighter freshgreen
 * used on saved-home and trusted-friend pins — a destination is a
 * different kind of "important place" than those persistent ones.
 *
 * `tracksViewChanges={false}` after first paint — the pin doesn't
 * animate or update; static throughout the trip.
 */
export function DestinationMarker({
  latitude,
  longitude,
  name,
}: {
  latitude: number;
  longitude: number;
  /** Optional place name surfaced to VoiceOver. */
  name?: string;
}) {
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={false}
      zIndex={500}
      accessibilityLabel={name ? `Destination: ${name}` : 'Destination'}
    >
      <View style={styles.frame} accessibilityIgnoresInvertColors>
        <MapPin size={36} color={colors.wiltedgreen} weight="fill" />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
