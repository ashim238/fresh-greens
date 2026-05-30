import { useEffect, useState } from 'react';
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
 * Anchored at center (the GPS coord sits at the car's middle).
 *
 * **Frame must be square + large enough to contain the rotated art.**
 * react-native-maps snapshots the marker to a bitmap sized to the
 * frame's bounds. A tight 36×48 frame clipped the car's corners once
 * it rotated to a heading (a 36×48 rect rotated 45° needs a ~60pt
 * square to fit) — that's the "looks strange at an angle" artifact.
 * The frame is a 64×64 square (> the ~60pt diagonal of the 36×48 art),
 * with the SVG centered, so every rotation has room and never clips.
 *
 * **`tracksViewChanges` lifecycle.** MapKit caches the marker as a
 * bitmap after first paint. Mounting with `tracksViewChanges={false}`
 * caused the SVG to snapshot empty (the `react-native-svg` subtree
 * hadn't resolved yet), leaving an invisible marker. Fix: start
 * `true` so the marker re-renders while the SVG paints, then flip to
 * `false` after a 50ms settle so subsequent rotation re-renders
 * aren't paid for. setTimeout(0) (next macrotask) fires before
 * native paint commits and isn't enough; 50ms ≈ 3 frames covers
 * layout + paint + commit reliably. The consumer also re-mounts the
 * marker via a heading-derived `key` (Math.round(heading)) when
 * heading changes meaningfully — that path stays the same.
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
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    // One-shot flip after first paint. 50ms gives the SVG subtree time
    // to paint and native to commit before MapKit caches the bitmap.
    const id = setTimeout(() => setTracking(false), 50);
    return () => clearTimeout(id);
  }, []);
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={1000}
      tracksViewChanges={tracking}
      accessibilityRole="image"
      accessibilityLabel="Your car along the route"
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
  // 64×64 square (> the ~60pt diagonal of the 36×48 car art) so the
  // rotated SVG never clips against the snapshot bitmap's bounds at any
  // heading. The SVG renders at its native 36×48, centered.
  frame: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
