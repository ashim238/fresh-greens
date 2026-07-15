# Route Trust Design

**Date:** 2026-07-15

**Status:** Ready for implementation planning

## Goal

Make every “safest route” claim auditable across all alternatives, bound every network wait, and prevent an old calculation from changing the current trip.

In plain language, the app must compare like with like. It cannot examine one route, reuse that evidence for three routes, and then call one of them safest.

## Scope

- Give every route its own safety evidence and completeness record.
- Fetch shared safety tiles once, then project them onto the routes that need them.
- Treat a checked tile with no hazards as valid evidence.
- Put deadlines around routing and safety providers.
- Give calculations, route sets, and routes stable identities.
- Capture departure time once and use it throughout a calculation.
- Prevent stale partial, cached, and provider-upgrade results from reaching the UI.
- Make complete, partial, cached, timed-out, and unavailable states visibly distinct.

## Non-goals

- Claiming that sampled third-party data proves every road is safe.
- Replacing Mapbox, OSRM, or Overpass.
- Blocking route geometry while safety evidence loads.
- Changing account, recording, or community-report ownership.

## Verified root causes

- `app/home.tsx` and `app/en-route.tsx` score every route against one shared zone array, while corridor fetching uses only the first route's coordinates.
- Both screens merge incidents from every alternative into shared zones. `lib/scoring.ts` then adds route incidents again, which leaks and duplicates evidence.
- `lib/api/zone-tile-cache.ts` declares a bounding box cached when any overlapping nonempty tile exists. It neither reports missing tiles nor preserves valid empty checks.
- The tile writer copies one broad response into every intersecting tile instead of storing exact tile results.
- `lib/api/zones.ts` treats a successful empty Overpass response as failure.
- Mapbox and OSRM requests in `lib/api/routes.ts` have no abort signal or timeout, so the fallback ladder can wait forever.
- Partial corridor callbacks in Home are not guarded by cancellation or calculation identity.
- `scoreRoute` and `pickWinner` default to `new Date()`. Production callers omit departure time, so rerenders can change time-sensitive scores.
- Provider and array-index route IDs are unstable. Selection and caches can silently attach to a different alternative after reordering.
- Route and corridor caches are destination-only. A new trip to the same destination can inherit old route evidence.

## Chosen architecture

### Multi-route coverage coordinator

Normalize all alternatives first and assign each a stable `routeKey`. Plan deterministic safety tiles for every route, take the union, read the cache once, and fetch every missing tile at most once. Shared tiles go first, followed by fair round-robin work so one alternative cannot consume the full request budget.

Completed tile evidence is then projected back onto each route. Mapbox incidents stay attached to their owning `routeKey`.

Each route produces a `RouteAssessment` containing its score, conditions, coverage ratio, and completeness. The UI may say “Safest route with current conditions” only when every candidate has complete planned coverage. Otherwise it preserves provider order and says “Safety comparison incomplete.”

### Honest long-trip coverage

“Complete” means every planned sample completed. It does not mean every mile was surveyed.

- Short routes use every tile intersecting the buffered corridor.
- Long routes use deterministic origin, destination, and evenly spaced sample tiles within the existing caps.
- Complete long-trip copy says: `Checked sampled stretches across every route.`

### Structured tile contract

```ts
type TileEntry = {
  key: string;
  source: 'osm-overpass';
  status: 'complete';
  zones: Zone[];
  fetchedAtMs: number;
  schemaVersion: number;
};

type TileCoverageResult = {
  requestedKeys: string[];
  completeKeys: string[];
  missingKeys: string[];
  staleKeys: string[];
  zones: Zone[];
  coverageRatio: number;
  complete: boolean;
};
```

`status: 'complete'` with `zones: []` is a valid checked tile. Failed, cancelled, and timed-out tiles remain missing. A bounding box is complete only when every required tile is complete. Fetch exact tile bounds and never spread one larger response across multiple entries.

Use a new storage key such as `zone-tiles-v2`. Version 1 cannot prove completeness and must not be promoted.

### Stable identities

- `calculationId`: monotonic generation for destination, retry, or departure changes.
- `routeRequestKey`: routing schema, rounded endpoints, detail, profile, and policy version.
- `routeKey`: versioned hash of normalized geometry and endpoints. It excludes provider array index.
- `routeSetKey`: hash of sorted route keys.
- `assessmentKey`: route key, explicit departure minute, preferences, and evidence schema.
- `coverageKey`: route-set key, safety-source policy, planner version, and tile schema.

### Cache boundary

Persist an active-trip envelope with `tripKey`, request and route-set keys, selected route key, endpoints, routes, and fetch time. Home passes `tripKey` and selected `routeKey` to En Route. Array rank is never identity.

A shifted navigation origin may use the cache only for the same active trip. A new trip to the same destination must not reuse a route solely because coordinates match. Replace the destination-only corridor snapshot with a route-set assessment snapshot. Tiles remain the evidence source of truth.

### Explicit time

Capture `departureTimeMs` once when calculation begins. Require it in scoring, winner selection, daylight calculations, arrival labels, assessment keys, cache metadata, and screen handoff. Remove default clocks from scoring APIs.

### Deadlines and fallbacks

- Mapbox attempt: 4 seconds.
- OSRM attempt: 4 seconds.
- Routing ladder: 8.5 seconds, including provider transition.
- Safety mirror attempt: 3 seconds.
- Safety mirrors combined: 6.25 seconds.
- Preview safety deadline: 8 seconds after geometry arrives.
- End-to-end calculation: 16.5 seconds, then publish a structured partial result.

Start cache lookup concurrently and reserve 300 ms to hydrate fallback. Use `AbortController` with a parent signal and remaining-deadline calculation. A timeout is a typed result, not an uncaught exception. Synthetic routes remain development fixtures and can never become production navigation.

### Provider result contract

```ts
type RoutesResult = {
  status: 'ok' | 'cached' | 'no-route' | 'timeout' | 'unavailable';
  routes: Route[];
  source: 'mapbox' | 'osrm' | 'cache' | null;
  attempts: ProviderAttempt[];
  calculationId: number;
  routeRequestKey: string;
  departureTimeMs: number;
  cacheAgeMs?: number;
};
```

### Cancellation rule

Each calculation owns one abort controller. Destination, retry, departure, and unmount changes abort it and increment the generation. Routing, tiles, corridor work, cache reads, and partial callbacks carry calculation and route-set identities. Reducers accept an event only when both match current state. Debounced callbacks recheck when the timer fires.

## User-state map

| State | What the user sees | Actions | VoiceOver behavior |
|---|---|---|---|
| Calculating | `Finding routes…`, then `Checking safety across every route…` | Clear destination | Announces each phase once, never each tile |
| Complete comparison | `Safest route with current conditions` and `Checked all routes` | Go, Compare routes, inspect conditions | Announces winner, route count, coverage disclosure, duration, and key conditions |
| Partial coverage | `Safety comparison incomplete` and a count such as `2 of 3 routes fully checked` | Retry, Compare routes, Go with partial information | Announces incompleteness before conditions and explains the Go action |
| Backup provider | `Live route. Some turn details may be limited.` | Go, Compare routes | Describes limitations without provider jargon |
| Cached route | `Saved route · 3h old` and `Live conditions unavailable` | Use saved route, Retry live route | Includes age and says there was no live recalculation |
| Timeout | `Route check took too long.` | Try again, Change destination | Announces once and focuses Try again |
| No route | `No route available` with the destination | Change destination | Announces the destination and recovery action |
| Destination changed | `Updating route to [destination]…` | Clear destination | Announces the new destination once and removes old route evidence immediately |

Never show `All clear` or `Safest route` during partial coverage.

## Design audit requirements

- Route cards must disclose evidence completeness without forcing the user into a detail sheet.
- Safety language must describe current data, not promise physical safety.
- Partial information remains usable, but the limitation appears before the primary action.
- Error, timeout, and no-route states cannot share copy because their recovery actions differ.
- Dynamic Type must keep disclosures and recovery actions visible.
- VoiceOver must announce state changes once, in the same order as the visible hierarchy.
- Map geometry should render as soon as routing resolves. Safety checks update it progressively without layout jumps.

## Performance budgets

- No network promise outlives its deadline.
- At most four concurrent safety requests.
- At most 20 unique safety tile calls per preview.
- Planning, deduplication, and ranking each finish within 50 ms for three typical routes.
- At most four partial UI publications per calculation.
- Tests prove one network call per unique tile.

## Test strategy

- Unit tests for stable keys, geometry fingerprints, explicit-time scoring, fair scheduling, valid empty tiles, missing coverage, and incident isolation.
- Fake-timer tests for provider timeouts, fallback order, overall deadlines, and abort cleanup.
- Integration tests proving three alternatives share tiles without sharing route-specific evidence.
- Race tests proving destination A cannot mutate destination B through partial, cached, delayed, or debounced results.
- Cache tests for same destination with different trips, route reorder, provider change, stale evidence, and v1 rejection.
- Component tests for every state, action, label, hint, focus order, and the absence of all-clear language during partial coverage.
- Manual VoiceOver checks for phase announcements, comparison rows, cached disclosures, timeouts, and rapid destination changes.

## Rollout order

1. Add typed results, explicit clocks, stable keys, and privacy-safe telemetry.
2. Add provider deadlines and structured outcomes.
3. Add tile cache v2 with valid empty entries and complete coverage accounting.
4. Add the multi-route planner, deduplicated scheduler, and per-route assessments.
5. Propagate aborts and generation guards through both screens.
6. Migrate route caches and Home-to-En-Route handoff.
7. Update preview and comparison states, copy, actions, and VoiceOver.
8. Remove production mock navigation and delete v1 cache reads after one release.

## Acceptance criteria

- Every candidate has its own planned coverage record.
- Shared tiles are fetched once.
- Missing and failed tiles never count as complete. Successful empty tiles do.
- Ranking uses one explicit departure time and route-specific evidence.
- `Safest` and `All clear` appear only after complete planned coverage for all candidates.
- Incidents never affect another route or count twice.
- Provider and overall deadlines always settle.
- Old generations cannot update route, evidence, selection, cache, or announcements.
- Selection survives provider reorder when geometry is unchanged.
- Cached navigation requires the same active trip and discloses its age.
- All eight user states match the documented copy, actions, and accessibility behavior.
- Production cannot navigate on synthetic mock geometry.

## Deferred work

- Background route refreshing.
- New safety-data providers.
- Server-side route assessment caching.
- A broader product study of how drivers interpret sampled-coverage disclosures.
