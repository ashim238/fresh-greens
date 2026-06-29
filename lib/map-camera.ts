import type React from 'react';
import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';

/**
 * Animate the map camera with a deceleration-aware duration.
 * Small moves (recentering) get 300ms; larger moves (cross-city pan)
 * get up to 600ms so the camera doesn't blur past landmarks.
 *
 * react-native-maps' animateToRegion uses iOS's native MKMapView
 * animation which already applies ease-out — we just need to scale
 * the duration to the move distance so small pans feel snappy and
 * large ones feel deliberate.
 */
export function animateCamera(
  mapRef: React.RefObject<MapView | null>,
  region: Region,
  currentRegion?: Region | null,
) {
  if (!mapRef.current) return;

  let duration = 400; // fallback
  if (currentRegion) {
    const latDelta = Math.abs(region.latitude - currentRegion.latitude);
    const lngDelta = Math.abs(region.longitude - currentRegion.longitude);
    const maxDelta = Math.max(latDelta, lngDelta);

    if (maxDelta < 0.005) {
      duration = 300;  // nearby — snappy
    } else if (maxDelta < 0.05) {
      duration = 400;  // medium move
    } else {
      duration = 600;  // cross-city — deliberate
    }
  }

  mapRef.current.animateToRegion(region, duration);
}
