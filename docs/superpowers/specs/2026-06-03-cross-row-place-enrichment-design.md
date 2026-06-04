# Cross-row place enrichment — design

**Date:** 2026-06-03
**Status:** Approved (brainstorm)

## Problem

The browse sheet fetches each row independently ([useRecommendationsBatch
`fetchForRow`](../../../hooks/useRecommendationsBatch.ts)): the
Trusted-by-community row from `getTrustedByCommunity` (community reports
only), the Open Now row from `getOpenNow` (external Google listings
only), category rows from `getRecommendations`. The `samePlace` matcher
runs only *within* a single row's list — there is no cross-row pass. So
the same real place (e.g. "Sisters") appears as a bare community card in
the Trusted row AND a separate external card in Open Now, with neither
recognizing the other. The community card lacks the photo/rating/open
status; the external card lacks the community vouch.

## Goal

Recognize the same place across rows and **enrich each card with the
data its twin has**, while keeping the place in every row it qualifies
for (no cross-row removal). One place identity, surfaced in multiple
rows, consistent data on each card.

## Non-goals

- Removing cards from rows (keep-in-both was the chosen behavior).
- Merging the community facets pill onto the external card (would
  clobber its useful categoryLabel like "American Restaurant"). The
  community signal rides a quote + a small badge instead.
- A test runner (none in repo; verify via tsc + throwaway node + device).

## Design

### Data model

One optional field added to `Recommendation`:

```ts
/**
 * Set by cross-row enrichment on a NON-community card whose place also
 * appears as a community report in another row — drives the small
 * "Community pick" badge. Undefined on community cards (already in a
 * community context) and on places with no community twin.
 */
communityTrusted?: boolean;
```

The other enriched fields (`photoName`, `rating`, `reviewCount`,
`isOpen`, `hoursLabel`, `priceTier`, `reportDetail`) already exist on
`Recommendation` and already have card slots that render when present —
enrichment just fills them.

### Adapter: `enrichAcrossRows` (lib/api/recommendations.ts)

Pure function, reuses the private `samePlace`:

```ts
export function enrichAcrossRows(
  byKey: Record<string, Recommendation[]>,
): Record<string, Recommendation[]>
```

Algorithm:
1. Flatten all recs across rows into entries `{ rowKey, idx, rec }`.
2. Group entries by `samePlace` against each group's first member
   (fixed-anchor, order-independent — same approach as
   `getTrustedByCommunity`).
3. For each group with ≥2 members, build a donor pool:
   - `photoName`, and the `rating`/`reviewCount` pair, `isOpen`,
     `hoursLabel`, `priceTier` — from the first member that has each
     (in practice the external/curated twin).
   - `reportDetail` — from the first member with `source === 'community'`.
   - `hasCommunity` — any member with `source === 'community'`.
4. Enrich each member (fill-if-missing, never overwrite):
   ```ts
   {
     ...rec,
     photoName: rec.photoName ?? pool.photoName,
     rating: rec.rating ?? pool.rating,
     reviewCount: rec.reviewCount ?? pool.reviewCount,
     isOpen: rec.isOpen ?? pool.isOpen,
     hoursLabel: rec.hoursLabel ?? pool.hoursLabel,
     priceTier: rec.priceTier ?? pool.priceTier,
     reportDetail: rec.reportDetail ?? pool.reportDetail,
     communityTrusted:
       rec.source !== 'community' && pool.hasCommunity
         ? true
         : rec.communityTrusted,
   }
   ```
   (`rating`/`reviewCount` taken from the SAME donor so a place's star
   count and review count stay paired.)
5. Reconstruct `byKey` writing each enriched rec back to its
   `(rowKey, idx)` slot; single-member groups pass through untouched.

`??` (not `||`) so a real `isOpen === false` or `rating === 0` is not
clobbered.

### Hook: useRecommendationsBatch

Enrichment is a **derived transform**, not stored state — so it re-runs
as each row lands progressively (the hook sets rows independently as they
resolve; there is no all-rows barrier and we keep progressive loading):

```ts
const enrichedByKey = useMemo(() => {
  const recsOnly: Record<string, Recommendation[]> = {};
  for (const [k, v] of Object.entries(byKey)) recsOnly[k] = v.recommendations;
  const enriched = enrichAcrossRows(recsOnly);
  const out: Record<string, BrowseRowResult> = {};
  for (const k of Object.keys(byKey)) {
    out[k] = { ...byKey[k], recommendations: enriched[k] ?? byKey[k].recommendations };
  }
  return out;
}, [byKey]);
return { byKey: enrichedByKey };
```

Public API (`{ byKey }`) is unchanged — HomeBrowseSheet reads enriched
data transparently.

### Card: RecommendationCard (components/HomeBrowseSheet.tsx)

The borrowed `photoName` / `rating` / `isOpen` / `hoursLabel` /
`priceTier` / `reportDetail` render through the card's EXISTING slots —
no new code for those (the community card simply gains a photo, a rating
pill, an open/hours pill, etc.).

One new element: a small green **"Community pick"** badge, rendered when
`r.communityTrusted`, in the first tag row alongside the rating. Styled
like the existing `openPill` (fadedgreen/burntgreen safety register).
Added to the a11y label too.

## Data flow

```
useRecommendationsBatch.byKey (raw per-row)
  → useMemo → enrichAcrossRows
       → group all rows' recs by samePlace
       → fill each card's missing fields from its twins
       → set communityTrusted on non-community twins
  → enrichedByKey → HomeBrowseSheet rows → RecommendationCard
```

## Error handling

- `enrichAcrossRows` is pure/total; an empty/one-member group is a
  no-op. A row whose enriched result is somehow absent falls back to its
  raw recs (the hook's `?? byKey[k].recommendations`).
- No new async, no new failure surface.

## Testing

No test runner. Verify via:
1. `npx tsc --noEmit` clean for touched files.
2. Throwaway node assertion for the fill-if-missing logic (a community
   rec + an external rec at same name/coord → community gains photo/
   rating, external gains reportDetail + communityTrusted; `isOpen===false`
   not clobbered; different-name pair untouched).
3. Device: a place that's both a community report and a Google Open-Now
   listing → the Trusted card shows the photo + rating, the Open Now card
   shows the community quote + green "Community pick" badge.

## Files touched

- `lib/api/recommendations.ts` — `communityTrusted` field;
  `enrichAcrossRows` (+ reuses `samePlace`).
- `hooks/useRecommendationsBatch.ts` — `useMemo` enrichment wrapper.
- `components/HomeBrowseSheet.tsx` — "Community pick" badge + a11y +
  one style.
