# Recommendation same-place dedup + multi-facet Trusted cards — design

**Date:** 2026-06-03
**Status:** Approved (brainstorm)

## Problem

The recommendation adapter dedups across sources with `dedupByProximity`
([lib/api/recommendations.ts](../../../lib/api/recommendations.ts)), which
collides entries by lat/lng (~50m) **only** — no name check. Two
consequences:

1. **Different places clobber each other.** Two genuinely distinct
   businesses within 50m (Sisters at 123 Wallaby Way and the barber next
   door at 125) collapse to one entry; the second is silently dropped,
   its info lost. Dense storefronts — exactly where community finds
   cluster — are the worst case. Same class of bug as the preferred-
   stations "two stars on one tap" (fixed via name+proximity in
   `stationsMatch`).

2. **Same place vouched multiple ways shows its facets lossily.** When
   one place has community reports under multiple categories (e.g. a
   black-owned report AND a felt-welcome report at the same address),
   the cross-category "Trusted by your community" row
   (`getTrustedByCommunity`) groups them by ~50m proximity and shows the
   **freshest report's metadata only** — the other vouch is discarded.
   The card never communicates "this place is trusted in more than one
   way."

## Goals

- **(a)** Make same-place matching name-aware so co-located *different*
  places stop clobbering each other.
- **(b)** In the Trusted-by-community row, merge co-located *same-place*
  reports into one card that names all its vouches as a combined label
  ("Black-owned · Felt welcome").

## Non-goals

- Facet badges in the per-category chip rows (Trusted-row only).
- Merging report *details* / quotes — freshest-metadata-wins display
  stays; only the vouch labels accumulate.
- A test runner. The repo has none; `.cursorrules` forbids adding deps
  without asking. Verification is tsc + a throwaway Node assertion run
  for the pure predicates + a device test (see Testing).

## Design

### Data model

One optional field added to `Recommendation`:

```ts
/**
 * Distinct human-readable vouch labels when this card represents a
 * same-place group trusted in more than one way (e.g.
 * ['Black-owned', 'Felt welcome']). Populated ONLY by
 * getTrustedByCommunity, ONLY when a group has >= 2 distinct vouches.
 * Undefined everywhere else — every other row and the card's default
 * pill behavior are untouched.
 */
facets?: string[];
```

### Adapter (`lib/api/recommendations.ts`)

**1. `normalizeName` + `samePlace` (the (a) primitive).**

```ts
/** Case/whitespace-insensitive name key. Mirrors the same one-liner in
 *  lib/api/preferred-stations.ts — kept local rather than shared to
 *  avoid coupling the two adapters over a trivial normalize. */
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

const SAME_PLACE_DEG_SQ = (50 / 111000) ** 2; // ~50m, squared lat/lng

/** Two recs/points refer to the same place when their normalized names
 *  match AND they sit within ~50m. Name is the disambiguator —
 *  proximity alone collapses distinct neighbors. */
function samePlace(
  a: { name: string; latitude: number; longitude: number },
  b: { name: string; latitude: number; longitude: number },
): boolean {
  if (normalizeName(a.name) !== normalizeName(b.name)) return false;
  const dLat = a.latitude - b.latitude;
  const dLng = a.longitude - b.longitude;
  return dLat * dLat + dLng * dLng < SAME_PLACE_DEG_SQ;
}
```

**2. `dedupByProximity` → `dedupBySamePlace`.** The collision predicate
becomes `samePlace` (name AND proximity) instead of proximity alone.
Rename for honesty (no longer proximity-only); update both call sites
(`getRecommendations`, `getOpenNow`). First-occurrence-wins precedence
(curated → community → external) is unchanged.

```ts
function dedupBySamePlace(recs: Recommendation[]): Recommendation[] {
  const kept: Recommendation[] = [];
  for (const rec of recs) {
    if (!kept.some((k) => samePlace(k, rec))) kept.push(rec);
  }
  return kept;
}
```

**Accepted tradeoff:** a community report whose `placeName` didn't
resolve (generic fallback name) and the external listing of the same
place will now BOTH show, where proximity-only would have merged them.
This is the deliberate inverse of not clobbering true neighbors — a
generic-named duplicate is strictly less bad than two distinct places
collapsing to one. As community names increasingly resolve via
`/api/nearby`, the case shrinks.

**3. `vouchLabelForReport(categoryId, subTag): string`.** Maps a report
to its display vouch:

- `black-owned` → `'Black-owned'`
- `felt-welcome` + an identity subTag (`Women-owned`, `LGBTQ+ welcoming`,
  `Open restroom`, `Late-night welcome`) → that subTag's label, via the
  existing `IDENTITY_SUBTAG_TO_REC_CATEGORY` routing + a category→label
  map
- `felt-welcome` + place-type/no subTag → `'Felt welcome'`

The category→label map lives in the adapter (the data layer owns the
canonical vouch labels). It intentionally includes `'Felt welcome'`,
which `HomeBrowseSheet`'s `CATEGORY_LABELS` lacks (that map is keyed by
`RecommendationCategory`, and general felt-welcome routes to none).

**4. `getTrustedByCommunity` grouping.** Two changes to the Step-2 group
loop:

- Group membership test changes from proximity-only to `samePlace`
  (name AND proximity) against the group anchor — so different-name
  neighbors start their own group instead of merging.
- Each group accumulates a `Set<string>` of vouch labels
  (`vouchLabelForReport(r.categoryId, r.subTag)`) across its members.
- When building the group's display rec: if the set has ≥2 distinct
  labels, set `facets` to the distinct labels (insertion order, which
  follows the report iteration). Single-vouch groups leave `facets`
  undefined (unchanged behavior).

The anchor stays the first report's location/name (the existing
order-independence rationale holds — see the current Step-2 comment).
`samePlace` against a fixed anchor is deterministic regardless of
arrival order.

### Card (`components/HomeBrowseSheet.tsx`, `RecommendationCard`)

The category pill currently renders `r.categoryLabel`
([HomeBrowseSheet.tsx:1058](../../../components/HomeBrowseSheet.tsx)).
Change to:

```ts
const FACET_DISPLAY_CAP = 2;
const categoryPillText =
  r.facets && r.facets.length > 0
    ? r.facets.slice(0, FACET_DISPLAY_CAP).join(' · ') +
      (r.facets.length > FACET_DISPLAY_CAP
        ? ` +${r.facets.length - FACET_DISPLAY_CAP}`
        : '')
    : r.categoryLabel;
```

Render `categoryPillText` in the existing pill (same `styles.tag`,
`numberOfLines={1}` as a backstop). The a11y label
([HomeBrowseSheet.tsx:957](../../../components/HomeBrowseSheet.tsx))
swaps `r.categoryLabel` for `categoryPillText` so the screen reader
announces the combined vouches. No new styles — reuses the existing tag
pill.

Because `facets` is only ever set on Trusted-row entries with ≥2
vouches, every other card path is byte-for-byte unchanged.

## Data flow

```
community reports (AsyncStorage)
  → getTrustedByCommunity
      → candidates (proximity-gated)
      → group by samePlace(anchor) ; accumulate vouch-label Set
      → group with >=2 vouches → rec.facets = [...labels]
  → RecommendationCard reads r.facets → combined pill label

getRecommendations / getOpenNow
  → ... → dedupBySamePlace (name+proximity) → neighbors survive
```

## Error handling

- `samePlace` / `vouchLabelForReport` are pure and total (every branch
  returns). `vouchLabelForReport` falls through to `'Felt welcome'` for
  any unrecognized felt-welcome shape and — defensively — returns a
  generic `'Trusted'` for an unexpected categoryId (should be
  unreachable; the candidate filter already excludes non-routing
  categories).
- `getTrustedByCommunity`'s existing `try/catch → []` is unchanged.

## Testing

No test runner exists in this repo. Verify via:

1. **`npx tsc --noEmit`** — clean for the touched files.
2. **Throwaway Node assertion run** (not committed, no dep) for the pure
   predicates during implementation:
   - `samePlace`: same name + near = true; different name + near = false;
     same name + far = false; case/whitespace variants of same name +
     near = true.
   - `vouchLabelForReport`: black-owned → "Black-owned"; felt-welcome +
     "Women-owned" → "Women-owned"; felt-welcome + "Restaurant" →
     "Felt welcome"; felt-welcome + undefined → "Felt welcome".
3. **Device test** of both scenarios:
   - Two same-name reports at one address under two categories
     (black-owned + felt-welcome) → ONE Trusted card reading
     "Black-owned · Felt welcome".
   - Two different-name reports within ~50m → TWO cards, neither
     dropped.

## Files touched

- `lib/api/recommendations.ts` — `facets` field; `normalizeName` +
  `samePlace` + `SAME_PLACE_DEG_SQ`; `dedupByProximity` →
  `dedupBySamePlace` (+ 2 call sites); `vouchLabelForReport` + label
  map; `getTrustedByCommunity` grouping.
- `components/HomeBrowseSheet.tsx` — `RecommendationCard` category-pill
  text + a11y label.
