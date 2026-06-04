import type { Coordinate, ZoneBounds } from '../api/zones';

/** Coarse state footprints for demo-corridor 511 gating (not survey-grade). */
const STATE_BOXES: { code: string; south: number; north: number; west: number; east: number }[] = [
  { code: 'AL', south: 30.1, north: 35.0, west: -88.5, east: -84.9 },
  { code: 'GA', south: 30.4, north: 35.0, west: -85.6, east: -80.8 },
  { code: 'TN', south: 34.9, north: 36.7, west: -90.3, east: -81.6 },
  { code: 'MS', south: 30.1, north: 35.0, west: -91.7, east: -88.1 },
  { code: 'NY', south: 40.5, north: 45.0, west: -79.8, east: -71.8 },
  { code: 'NJ', south: 38.9, north: 41.4, west: -75.6, east: -73.9 },
  { code: 'PA', south: 39.7, north: 42.3, west: -80.5, east: -74.7 },
  { code: 'DE', south: 38.4, north: 39.8, west: -75.8, east: -75.0 },
  { code: 'MD', south: 37.9, north: 39.7, west: -79.5, east: -75.0 },
  { code: 'VA', south: 36.5, north: 39.5, west: -83.7, east: -75.2 },
  { code: 'NC', south: 33.8, north: 36.6, west: -84.3, east: -75.4 },
  { code: 'SC', south: 32.0, north: 35.2, west: -83.4, east: -78.5 },
  { code: 'KY', south: 36.5, north: 39.1, west: -89.6, east: -81.9 },
  { code: 'FL', south: 24.5, north: 31.0, west: -87.6, east: -80.0 },
  { code: 'LA', south: 28.9, north: 33.0, west: -94.0, east: -88.8 },
];

/** Dominant US state for a bbox or point — smallest containing box wins ties. */
export function dominantUsStateCode(
  bounds: ZoneBounds,
  points?: Coordinate[],
): string | null {
  const lat =
    points && points.length > 0
      ? points.reduce((s, p) => s + p.latitude, 0) / points.length
      : (bounds.south + bounds.north) / 2;
  const lng =
    points && points.length > 0
      ? points.reduce((s, p) => s + p.longitude, 0) / points.length
      : (bounds.west + bounds.east) / 2;

  let best: string | null = null;
  let bestArea = Infinity;
  for (const box of STATE_BOXES) {
    if (
      lat < box.south ||
      lat > box.north ||
      lng < box.west ||
      lng > box.east
    ) {
      continue;
    }
    const area = (box.north - box.south) * (box.east - box.west);
    if (area < bestArea) {
      best = box.code;
      bestArea = area;
    }
  }
  return best;
}
