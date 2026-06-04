// Fresh Greens — state DOT 511 adapter (B4).
//
// v1: demo mode synthesizes road-condition zones inside bbox legs on the
// demo corridor (AL, GA, TN, MS, …). Live mode reserved for a future feed URL
// (`EXPO_PUBLIC_DOT_511_FEED_URL`) — each state's 511 API differs.

import type { Coordinate, Zone, ZoneBounds } from '../zones';

export type Dot511Mode = 'off' | 'demo' | 'live';

export function dot511Mode(): Dot511Mode {
  const raw = process.env.EXPO_PUBLIC_DOT_511_MODE?.trim().toLowerCase();
  if (raw === 'off' || raw === 'live') return raw;
  return 'demo';
}

function bboxCenter(bounds: ZoneBounds): Coordinate {
  return {
    latitude: (bounds.south + bounds.north) / 2,
    longitude: (bounds.west + bounds.east) / 2,
  };
}

/** Deterministic 0–1 from bounds (stable across fetches). */
function bboxHash(bounds: ZoneBounds): number {
  const s =
    bounds.south * 1e3 +
    bounds.west * 1e3 +
    bounds.north * 1e2 +
    bounds.east;
  return Math.abs(Math.sin(s * 12.9898) * 43758.5453) % 1;
}

function demoClosureZone(bounds: ZoneBounds, stateCode: string): Zone | null {
  if (bboxHash(bounds) < 0.55) return null;
  const c = bboxCenter(bounds);
  const dLat = (bounds.north - bounds.south) * 0.15;
  const dLng = (bounds.east - bounds.west) * 0.15;
  const id = `511-${stateCode}-demo-${Math.round(c.latitude * 1e4)}-${Math.round(c.longitude * 1e4)}`;
  return {
    id,
    source: 'dot-511',
    type: 'caution',
    label: `${stateCode} DOT: road work reported`,
    geometry: 'polyline',
    coordinates: [
      { latitude: c.latitude - dLat, longitude: c.longitude - dLng },
      { latitude: c.latitude + dLat, longitude: c.longitude + dLng },
    ],
    category: 'road-condition',
  };
}

async function fetchLiveDot511(
  bounds: ZoneBounds,
  stateCode: string,
): Promise<Zone[]> {
  const feedUrl = process.env.EXPO_PUBLIC_DOT_511_FEED_URL?.trim();
  if (!feedUrl) return [];
  try {
    const url = feedUrl
      .replace('{state}', encodeURIComponent(stateCode))
      .replace('{south}', String(bounds.south))
      .replace('{west}', String(bounds.west))
      .replace('{north}', String(bounds.north))
      .replace('{east}', String(bounds.east));
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[dot-511] live feed HTTP', res.status);
      return [];
    }
    // Feed-specific parsing deferred — return [] until a state feed is wired.
    void (await res.text());
    return [];
  } catch (error) {
    console.warn('[dot-511] live feed error:', error);
    return [];
  }
}

export async function fetchDot511ZonesForBbox(
  bounds: ZoneBounds,
  stateCode: string,
): Promise<Zone[]> {
  const mode = dot511Mode();
  if (mode === 'off') return [];
  if (mode === 'live') return fetchLiveDot511(bounds, stateCode);
  const zone = demoClosureZone(bounds, stateCode);
  return zone ? [zone] : [];
}
