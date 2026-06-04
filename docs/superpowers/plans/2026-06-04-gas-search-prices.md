# Gas Search Prices — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show optional per-station regular-grade prices on Gas search results and on-route fuel rows using a demo-price adapter, with honest disclosure and no route-scoring changes.

**Architecture:** New `lib/api/fuel-prices.ts` enriches `Place[]` after Mapbox `searchPlaces` (callers compose — geocoder stays pure). Demo mode hashes `place.id` → stable `$3.19–$4.29`. Gas-only UI: single tertiary meta line + optional results footnote. Electric skips enrichment.

**Tech Stack:** React Native + Expo + TypeScript, existing Mapbox Search Box adapter (`lib/api/places.ts`), no new npm dependencies.

**Spec:** [docs/superpowers/specs/2026-06-04-gas-search-prices-design.md](../specs/2026-06-04-gas-search-prices-design.md) — **Approved** (single meta line for Gas rows; demo footnote when any `source === 'demo'` quote renders).

**Verification gate (every task):** `npx tsc --noEmit` must exit 0.

**Branch:** create `feat/gas-search-prices` off `main` before Task 1.

---

## Task 1: Types + demo adapter — `lib/api/fuel-prices.ts`

**Files:**
- Create: `lib/api/fuel-prices.ts`
- Modify: `lib/api/places.ts`

- [ ] **Step 1: Extend `Place` in `lib/api/places.ts`**

Add a type-only import at the top (after the file header comment block):

```ts
import type { FuelPriceQuote } from './fuel-prices';
```

Add to the `Place` type (after `distanceMiles`):

```ts
  /** Set by `enrichPlacesWithFuelPrices` — Gas/on-route fuel contexts only. */
  fuelPrice?: FuelPriceQuote;
```

- [ ] **Step 2: Create `lib/api/fuel-prices.ts`**

```ts
// Fresh Greens — fuel-price enrichment adapter.
//
// Mapbox Search Box returns POI identity + distance, not pump prices.
// This adapter attaches optional per-station quotes for Gas UI surfaces.
// v1: deterministic demo quotes (honest disclosure in /search).
// v2: `mode: 'live'` can call a proxy route when a provider exists.
//
// Spec: docs/superpowers/specs/2026-06-04-gas-search-prices-design.md

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
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`  
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add lib/api/fuel-prices.ts lib/api/places.ts
git commit -m "feat(fuel-prices): demo enrichment adapter and Place.fuelPrice"
```

---

## Task 2: On-route fuel stops — `hooks/useRouteFuelStops.ts`

**Files:**
- Modify: `hooks/useRouteFuelStops.ts`

- [ ] **Step 1: Import and enrich after route filter (gas/diesel/hybrid only)**

Add import:

```ts
import { enrichPlacesWithFuelPrices } from '../lib/api/fuel-prices';
```

Inside the async IIFE, after `onRoute` is computed and before `setState`:

```ts
        const priced =
          fuelType === 'electric'
            ? onRoute
            : await enrichPlacesWithFuelPrices(onRoute);
        if (!cancelled) setState({ stops: priced, loading: false, error: false });
```

Replace the line that was `setState({ stops: onRoute, ...`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`  
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add hooks/useRouteFuelStops.ts
git commit -m "feat(fuel-prices): enrich on-route gas stops"
```

---

## Task 3: Gas search results UI — `app/search.tsx`

**Files:**
- Modify: `app/search.tsx`

- [ ] **Step 1: Import enrichment helpers**

```ts
import {
  enrichPlacesWithFuelPrices,
  fuelPriceLabel,
  shouldShowDemoPriceFootnote,
} from '../lib/api/fuel-prices';
```

- [ ] **Step 2: Enrich after `searchPlaces` when Gas tool is active**

In the `try` block where `const places = await searchPlaces(trimmed, userLocation);`, replace the flow so results are stored enriched when Gas is selected:

```ts
      const raw = await searchPlaces(trimmed, userLocation);
      if (lastQueryRef.current !== trimmed) return;

      const places =
        selectedToolId === 'gas'
          ? await enrichPlacesWithFuelPrices(raw)
          : raw;
```

Use `places` (not `raw`) for the empty check, `setResults`, and reverse-geocode.

**Dependency note:** `selectedToolId` must be in the autocomplete `useEffect` dependency array if it is not already — add it so toggling Gas on re-runs the current query with prices.

- [ ] **Step 3: Add `formatGasResultMeta` helper** (below `formatResultDistance`)

```ts
function formatGasResultMeta(place: Place): string {
  const price = fuelPriceLabel(place.fuelPrice);
  const dist = formatResultDistance(place.distanceMiles);
  return price ? `${price} · ${dist}` : dist;
}
```

- [ ] **Step 4: Demo footnote under results header**

After `resultsInsetDivider`, when `shouldShowDemoPriceFootnote(results)`:

```tsx
            {shouldShowDemoPriceFootnote(results) ? (
              <Text style={styles.demoPriceFootnote}>
                Sample fuel prices for demo — not live pump data.
              </Text>
            ) : null}
```

Style (in `StyleSheet.create`):

```ts
  demoPriceFootnote: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelTertiary,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
```

- [ ] **Step 5: Gas-only row layout in `results.map`**

At the start of the map callback:

```ts
const isGasRow = selectedToolId === 'gas';
```

**Accessibility** — replace the static label with:

```ts
accessibilityLabel={
  isGasRow
    ? `${place.name}, ${place.address ? `${place.address}, ` : ''}${formatGasResultMeta(place)} away${isPreferredStation(place) ? ', trusted by you' : ''}`
    : `${place.name}, ${place.address}, ${formatResultDistance(place.distanceMiles)} away`
}
```

**Body** — after address block, for Gas rows add meta line; hide right `resultDistance` when Gas:

```tsx
                {isGasRow ? (
                  <Text style={styles.resultMeta} numberOfLines={1}>
                    {formatGasResultMeta(place)}
                  </Text>
                ) : null}
```

```tsx
                {!isGasRow ? (
                  <Text style={styles.resultDistance} numberOfLines={1}>
                    {formatResultDistance(place.distanceMiles)}
                  </Text>
                ) : null}
```

Style:

```ts
  resultMeta: {
    ...dynamicType(typography.caption1Regular),
    color: colors.labelTertiary,
  },
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`  
Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add app/search.tsx
git commit -m "feat(search): gas result prices and demo footnote"
```

---

## Task 4: Fuel sheet row meta — `components/FuelStopsSheet.tsx`

**Files:**
- Modify: `components/FuelStopsSheet.tsx`

- [ ] **Step 1: Import `fuelPriceLabel`**

```ts
import { fuelPriceLabel } from '../lib/api/fuel-prices';
```

- [ ] **Step 2: Build `rowMeta` with optional price prefix**

Inside `renderItem`, before the `rowMeta` `Text`:

```ts
                  const pricePart = fuelPriceLabel(item.fuelPrice);
                  const meta = pricePart
                    ? `${pricePart} · ${item.distanceMiles} mi from you · along your route`
                    : `${item.distanceMiles} mi from you · along your route`;
```

Use `{meta}` in the `Text` child. Extend `accessibilityLabel` when `pricePart` is set:

```ts
accessibilityLabel={`${item.name}, ${pricePart ? `${pricePart}, ` : ''}${item.distanceMiles} miles from you along your route${isPreferred(item) ? ', trusted by you' : ''}`}
```

Skip price segment when `fuelType === 'electric'` (enrichment already skipped in hook; defensive OK).

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add components/FuelStopsSheet.tsx
git commit -m "feat(fuel-sheet): show optional demo price in row meta"
```

---

## Task 5: Spec status + docs hygiene

**Files:**
- Modify: `docs/superpowers/specs/2026-06-04-gas-search-prices-design.md`
- Modify: `.env.example` (optional one-line comment)
- Append: `docs/learnings.md`

- [ ] **Step 1: Mark spec approved**

In the spec front matter, change:

`Status: Draft — ready for review` → `Status: Approved → plan at docs/superpowers/plans/2026-06-04-gas-search-prices.md`

Check `- [ ] User approval — **pending**` → `- [x] User approval`

- [ ] **Step 2: Document env in `.env.example`**

Add commented line after Mapbox token:

```
# Fuel prices on Gas search: demo (default) | live (no provider in v1)
# EXPO_PUBLIC_FUEL_PRICE_MODE=demo
```

- [ ] **Step 3: Append learnings** (branch-headed entry, 2–4 sentences on demo hash + caller-side enrich)

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-04-gas-search-prices-design.md .env.example docs/learnings.md
git commit -m "docs: approve gas-search-prices spec and note env flag"
```

---

## Task 6: Device verification

- [ ] **Step 1: `/search` Gas**

1. Open `/search`, tap **Gas** (tile shows wiltedgreen bookmark + gray tile bg).
2. Confirm results show `$X.XX regular · Y mi` meta under address.
3. Confirm footnote: *Sample fuel prices for demo — not live pump data.*
4. Tap **Food** — rows keep distance on the right, no `$` meta, no footnote.

- [ ] **Step 2: On-route fuel**

1. `/en-route` with active route → open **Gas on route** sheet.
2. Rows show `$X.XX regular · N mi from you · along your route`.
3. Electric profile → no `$` lines on charging sheet.

- [ ] **Step 3: Reserved-color spot-check**

Run: `rg "colors\.(orange|red|yellow|pink|navy)" app/search.tsx components/FuelStopsSheet.tsx lib/api/fuel-prices.ts`  
Expected: no matches (price uses `labelTertiary` only).

---

## Plan self-review (spec coverage)

| Spec requirement | Task |
|------------------|------|
| `fuel-prices.ts` adapter + demo hash | 1 |
| `Place.fuelPrice` optional | 1 |
| `searchPlaces` not enriched internally | 1 (callers only) |
| Gas search enrich + meta line | 3 |
| Demo footnote | 3 |
| `useRouteFuelStops` enrich, skip electric | 2 |
| `FuelStopsSheet` rowMeta | 4 |
| No scoring change | (no files touched) |
| `tsc` clean | all tasks |
| Honesty / env | 5 |

No placeholders. Live provider is explicitly no-op in Task 1.
