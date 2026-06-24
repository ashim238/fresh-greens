// Fresh Greens — fuel-price enrichment adapter.
//
// Mapbox Search Box returns POI identity + distance, not pump prices.
// This adapter attaches optional per-station quotes for Gas UI surfaces.
// v1: deterministic demo quotes (honest disclosure in /search).
// v2: `mode: 'live'` can call a proxy route when a provider exists.
//
// Spec: docs/archive/superpowers/specs/2026-06-04-gas-search-prices-design.md

import type { Place } from './places';

export type FuelPriceQuote = {
  /** e.g. "$3.49" — grade word lives in copy / a11y, not here. */
  display: string;
  grade: 'regular';
  fetchedAt: string;
  source: 'demo' | 'live';
};

export type FuelPriceMode = 'demo' | 'live';

function resolveMode(opts?: { mode?: FuelPriceMode }): FuelPriceMode {
  const env = process.env.EXPO_PUBLIC_FUEL_PRICE_MODE;
  if (opts?.mode) return opts.mode;
  if (env === 'live') return 'live';
  return 'demo';
}

/** Stable 32-bit hash for place.id → demo cents. */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function demoQuoteForPlace(id: string, fetchedAt: string): FuelPriceQuote {
  const cents = 319 + (hashId(id) % 111); // 319–429 inclusive
  const display = `$${(cents / 100).toFixed(2)}`;
  return { display, grade: 'regular', fetchedAt, source: 'demo' };
}

/**
 * Returns places with `fuelPrice` set where a quote exists. On failure
 * or live-without-provider, returns the input array unchanged.
 */
export async function enrichPlacesWithFuelPrices(
  places: Place[],
  opts?: { mode?: FuelPriceMode },
): Promise<Place[]> {
  if (places.length === 0) return places;
  const mode = resolveMode(opts);
  if (mode === 'live') {
    // v2 slot — no live provider wired in thesis v1.
    return places;
  }
  try {
    const fetchedAt = new Date().toISOString();
    return places.map((p) => ({
      ...p,
      fuelPrice: demoQuoteForPlace(p.id, fetchedAt),
    }));
  } catch (err) {
    console.warn('[fuel-prices] enrich failed', err);
    return places;
  }
}

/** Meta fragment for UI: "$3.49 regular" or null. */
export function fuelPriceLabel(price: FuelPriceQuote | undefined): string | null {
  if (!price) return null;
  return `${price.display} ${price.grade}`;
}

/** True when the results list should show the demo footnote. */
export function shouldShowDemoPriceFootnote(places: Place[]): boolean {
  return places.some((p) => p.fuelPrice?.source === 'demo');
}
