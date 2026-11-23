import type { Coordinate } from './api/zones';
import { haversineMeters, sampleAlongPath } from './geo';

/** Keep the preview routing inputs stable within the live map's 30 m GPS snap range. */
export function initialNavigationOrigin(live: Coordinate, previewOrigin?: string): Coordinate {
  if (!previewOrigin) return live;
  const parts = previewOrigin.split(',');
  if (parts.length !== 2 || parts.some((part) => !part.trim())) return live;
  const [latitude, longitude] = parts.map(Number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return live;
  const preview = { latitude, longitude };
  return haversineMeters(live, preview) <= 30 ? preview : live;
}

export function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** Provider IDs identify response slots; geometry survives a reordered response. */
export function routeGeometryFingerprint(coordinates: Coordinate[]): string {
  function hashPoints(points: Coordinate[], decimals: number) {
    return stableHash(points.map(({ latitude, longitude }) =>
      `${latitude.toFixed(decimals)},${longitude.toFixed(decimals)}`,
    ).join(';'));
  }
  // Prefer the complete path. Equidistant samples also recognize the same
  // road represented by a different number of vertices in the navigation fetch.
  return `${hashPoints(coordinates, 5)}.${hashPoints(sampleAlongPath(coordinates, 0, 17), 4)}`;
}

export function matchRouteGeometry(keysById: Map<string, string>, selected: string): string | undefined {
  const shape = selected.split('.')[1];
  let shapeMatch: string | undefined;
  let shapeMatches = 0;
  for (const [id, key] of keysById) {
    if (key === selected) return id;
    if (shape && key.split('.')[1] === shape) {
      shapeMatches++;
      shapeMatch = id;
    }
  }
  return shapeMatches === 1 ? shapeMatch : undefined;
}
