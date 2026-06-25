import type { Place } from './places';
import type { MapKitSearchResult } from './sources/apple-mapkit';

const MATCH_RADIUS_MILES = 0.15; // ~240 m — same business, not a neighbor

function distanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Picks the best MKLocalSearch phone for a Mapbox place by name + proximity.
 * Pure function — safe to test with `npx tsx` (no React Native import).
 */
export function matchMapKitPhoneForPlace(
  place: Pick<Place, 'name' | 'latitude' | 'longitude'>,
  candidates: MapKitSearchResult[],
): string | undefined {
  const target = normalizeName(place.name);
  let best: { phone?: string; dist: number } | null = null;

  for (const c of candidates) {
    const dist = distanceMiles(
      place.latitude,
      place.longitude,
      c.latitude,
      c.longitude,
    );
    if (dist > MATCH_RADIUS_MILES) continue;

    const candidateName = normalizeName(c.name);
    const nameMatches =
      candidateName.includes(target) ||
      target.includes(candidateName) ||
      candidateName.split(' ')[0] === target.split(' ')[0];

    if (!nameMatches) continue;

    if (!best || dist < best.dist) {
      best = { phone: c.phoneNumber, dist };
    }
  }

  return best?.phone?.trim() || undefined;
}
