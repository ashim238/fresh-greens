// Fresh Greens — pure geo distance helpers.
//
// No I/O, deterministic. Used by the on-route fuel-stops feature to keep
// only POIs that sit near the active route polyline. Kept separate from
// lib/edge-indicators.ts (which does screen-space bearing/clamp math, not
// great-circle meters).

import type { LatLng } from './edge-indicators';

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in meters (haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Approximate distance (meters) from `point` to a route `polyline`,
 * computed as the minimum great-circle distance to any vertex.
 *
 * This is a vertex approximation, not true point-to-segment distance —
 * but OSRM route geometry is densely sampled (vertices every few meters
 * on surface streets), so the error is small and the math stays simple
 * and allocation-free. Returns Infinity for an empty polyline so callers
 * treat "no route" as "nothing is near it".
 */
export function distanceToPolylineMeters(
  point: LatLng,
  polyline: LatLng[],
): number {
  let min = Infinity;
  for (const vertex of polyline) {
    const d = haversineMeters(point, vertex);
    if (d < min) min = d;
  }
  return min;
}
