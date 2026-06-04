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

/** Total path length along a polyline (sum of segment haversines). */
export function pathLengthMeters(path: LatLng[]): number {
  if (path.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += haversineMeters(path[i], path[i + 1]);
  }
  return total;
}

/**
 * Sample points along `path` every `spacingMeters` (plus start/end).
 * Spacing widens automatically when `maxPoints` would be exceeded — keeps
 * long-trip zone intersection tests and Overpass anchor sampling bounded.
 */
export function sampleAlongPath(
  path: LatLng[],
  spacingMeters: number,
  maxPoints = 16,
): LatLng[] {
  if (path.length === 0) return [];
  if (path.length === 1) return [path[0]];

  const total = pathLengthMeters(path);
  if (total === 0) return [path[0]];

  const spacing = Math.max(spacingMeters, total / Math.max(1, maxPoints - 1));
  const samples: LatLng[] = [path[0]];
  let distanceAlong = 0;
  let nextSampleAt = spacing;

  for (let i = 0; i < path.length - 1 && samples.length < maxPoints; i++) {
    const a = path[i];
    const b = path[i + 1];
    const segLen = haversineMeters(a, b);

    while (distanceAlong + segLen >= nextSampleAt && samples.length < maxPoints) {
      const intoSeg = nextSampleAt - distanceAlong;
      const t = segLen === 0 ? 0 : intoSeg / segLen;
      samples.push({
        latitude: a.latitude + t * (b.latitude - a.latitude),
        longitude: a.longitude + t * (b.longitude - a.longitude),
      });
      nextSampleAt += spacing;
    }
    distanceAlong += segLen;
  }

  const end = path[path.length - 1];
  const last = samples[samples.length - 1];
  if (
    last.latitude !== end.latitude ||
    last.longitude !== end.longitude
  ) {
    if (samples.length < maxPoints) samples.push(end);
  }
  return samples;
}
