# Visual closure — Batch 1: Map hubs (2026-06-25)

Branch: `chore/visual-closure-map-hubs`

## Scope

**Routes:** `/home`, `/search`, `/en-route`, `/report`, `/trip-summary`, `/fuel`

**Components:** `HomeBrowseSheet`, `RouteComparisonSheet`, `FuelStopsSheet`, `LandmarkMarker`, `EdgeIndicator`, `ClusterMarker`, `FuelStopMarker`, `EnRouteZone`, `DaylightRouteLegend`, `ZoneDetailCard`, `RouteHazardDetailCard`, `SearchBar`

## Three-pass summary

### Audit scorecards (per route)

| Route | A11y | Perf | Theme | Responsive | Anti-slop | Total | P0 | P1 open |
| ----- | ---- | ---- | ----- | ---------- | --------- | ----- | -- | ------- |
| `/home` | 3 | 3 | 4 | 3 | 4 | 17/20 | 0 | 0 |
| `/search` | 3 | 3 | 4 | 3 | 4 | 17/20 | 0 | 0 |
| `/en-route` | 3 | 3 | 4 | 3 | 4 | 17/20 | 0 | 0 |
| `/report` | 4 | 3 | 4 | 3 | 4 | 18/20 | 0 | 0 |
| `/trip-summary` | 3 | 4 | 4 | 3 | 4 | 18/20 | 0 | 0 |
| `/fuel` | 3 | 4 | 4 | 4 | 4 | 19/20 | 0 | 0 |

**Batch gate:** Zero open P0/P1 after fix-forward.

### Critique snapshots

| Route | File | Score | Notes |
| ----- | ---- | ----- | ----- |
| `/home` | `.impeccable/critique/2026-06-24T01-57-45Z__app-home-tsx.md` | 29/40 | Re-verified; P2 stack at AX5 deferred |
| `/en-route` | `.impeccable/critique/2026-06-25T19-30-00Z__app-en-route-tsx.md` | 30/40 | Mock/cache turn-card P1 fixed this batch |
| `/search` | `.impeccable/critique/2026-06-25T19-30-00Z__app-search-tsx.md` | 30/40 | Inert mic P1 fixed this batch |
| `/report` | `.impeccable/critique/2026-06-24T01-57-50Z__app-report-tsx.md` | — | Re-verified; no new P0/P1 |
| `/trip-summary` | `.impeccable/critique/2026-06-25T19-30-00Z__app-trip-summary-tsx.md` | 31/40 | Stacked stats layout correct |
| `/fuel` | `.impeccable/critique/2026-06-25T19-30-00Z__app-fuel-tsx.md` | 31/40 | Chip labels use inline · (picker register — N/A) |

### Visual-pass round (13 categories)

| Screen / component | Issue | Severity | Fixed? | Notes |
| ------------------ | ----- | -------- | ------ | ----- |
| `app/home.tsx` `RouteZonesFetchFailedChip` | Inline `·` in retry chip | P1 | Yes | `MetaSeparator` |
| `app/en-route.tsx` turn card | Mock/cache indistinguishable from live loading | P1 | Yes | "Following route to" branch |
| `components/SearchBar.tsx` | Inert mic 44pt decorative zone | P1 | Yes | Hide mic when no handler |
| `app/en-route.tsx` `secondaryRow` | — | N/A | — | Already uses `MetaSeparator` |
| `components/RouteComparisonSheet` | — | N/A | — | Meta row correct |
| `components/HomeBrowseSheet` | — | N/A | — | `joinMetaParts` on facet tags |
| `components/FuelStopsSheet` | Subtitle `·` in a11y string | P2 | No | Prose subtitle, not rendered meta row |
| `app/fuel.tsx` | Vehicle chip `·` labels | N/A | — | Single-line picker labels |
| `app/trip-summary.tsx` | Stacked stats (not inline meta) | N/A | — | Correct pattern |
| `app/report.tsx` | Severity chips optical padding | P2 | No | Figma confirm deferred |

**Counts:** 6 routes + 11 components reviewed · 3 P1 fixed · 2 P2 logged

## Fixes shipped (this PR)

1. **SearchBar** — hide mic glyph when `onMicPress` undefined (fixes Round 7 P1 inert-mic affordance on `/search` and `/home` default pill).
2. **en-route turn card** — separate `mock`/`cache` fallback ("Following route to") from live `Heading toward` and `no-route` recovery copy; a11y label updated in parallel.
3. **home** `RouteZonesFetchFailedChip` — `MetaSeparator` replaces inline middot.

## P2/P3 deferred (batch 1)

| Item | Surface | Rationale |
| ---- | ------- | --------- |
| Long route-preview vertical stack at AX5 | `/home` | Consolidation pass; not blocking Supabase gate |
| FAB stack magic-number offsets | `/home` | Extract helper — polish, not correctness |
| MapCoach one-shot | `/home` | Batch 5 synthesis / onboarding cross-cut |
| FuelStopsSheet subtitle middot in string | `FuelStopsSheet` | Prose subtitle; row meta uses `MetaSeparator` |
| Report severity chip padding | `/report` | Needs Figma confirm |

## Verification

- `npx tsc --noEmit` — **pass** (2026-06-25)
- Prior Round 7 P1 items in this batch: **verified fixed or stale** (side-FAB labels, weather load, no-route home branch pre-existing)

## Critique vs visual pass

| Layer | What it inspects | What it misses |
| ----- | ---------------- | -------------- |
| Impeccable critique | Voice, hierarchy, IA, cognitive load | Optical separator geometry |
| Technical audit | dynamicType, tokens, tap targets, reserved colors | Inline `·` asymmetric spacing |
| Visual pass | Meta separators, mixed-weight rhythm, sheet micro-layout | Voice/copy (critique) |
