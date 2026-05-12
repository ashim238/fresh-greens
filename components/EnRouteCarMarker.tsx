import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import EnRouteCurrentLocation from '../assets/illustrations/enroute-current-location.svg';

/**
 * En-route variant of the user-location marker. Replaces the blue dot
 * from /home with a top-down car glyph that rotates to face the
 * driver's direction of travel — Apple Maps / Waze convention during
 * active navigation.
 *
 * Heading is `expo-location.LocationObjectCoords.heading` (degrees,
 * 0=north, 90=east). The SVG ships pointing "up" at 0°, so passing
 * the raw heading rotates it to the actual heading on a north-up
 * camera.
 *
 * When `heading` is null (no GPS heading yet, or device stationary),
 * the SVG sits unrotated — same as facing north. The user prefers
 * this over falling back to a blue dot since the car is the active
 * driving indicator regardless of motion state.
 *
 * Anchored at center (the GPS coord sits at the car's middle). The
 * Marker uses `tracksViewChanges={false}` after the heading prop is
 * known so rotation re-renders aren't snapshotted away by MapKit's
 * caching — the consumer drives re-rendering by changing the marker
 * `key` when heading changes meaningfully (handled at the screen
 * level via `Math.round(heading)` keying).
 */
export function EnRouteCarMarker({
  latitude,
  longitude,
  heading,
}: {
  latitude: number;
  longitude: number;
  /** GPS heading in degrees, 0=north. Null when device is stationary. */
  heading: number | null;
}) {
  const rotation = heading ?? 0;
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={1000}
      tracksViewChanges={false}
    >
      <View
        style={[styles.frame, { transform: [{ rotate: `${rotation}deg` }] }]}
      >
        <EnRouteCurrentLocation width={36} height={48} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 36,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
