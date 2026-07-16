# Route Trust Design

**Date:** 2026-07-15

**Status:** Current implementation slice complete — route scoring, corridor cleanup, adaptive width, essential offline bundle, and source-only native audit landed

## Implementation progress

- Completed route-scoring evidence isolation for the current screens.
- `scoreRoute` and `pickWinner` now require an explicit departure time.
- `/home` and `/en-route` no longer merge route-owned Mapbox incidents into the shared corridor zone array.
- The scorer builds a per-route evidence set, so Mapbox incidents stay attached to their owning alternative and are not counted twice.
- Completed current-scope corridor cleanup: checked-empty tiles are valid evidence, bbox cache reads require complete tile coverage, bbox writes no longer smear one response into every tile slot, successful empty Overpass responses no longer trigger mock fallback, and preview corridor collection covers all route alternatives instead of only the first route.
- Completed current-scope adaptive corridor width: long sparse stretches stay wider, dense or curvy local geometry tightens per anchor, and gap-fill samples use the same adaptive policy.
- Completed current-scope offline resilience: Go prepares an essential selected-route bundle with route geometry, route-set identity, departure time, validated on-route evidence, and the `adaptive-corridor-v1` policy before opening navigation.
- Completed route-trust source-only native audit: Go now exposes a visible preparing state, `/en-route` surfaces `Route saved` or `Backup limited`, and the audit artifact lives at [`docs/audits/2026-07-16-route-trust-native-audit.md`](../../audits/2026-07-16-route-trust-native-audit.md).
- Focused regression tests cover route-owned incident isolation, duplicate protection, condition-chip consistency, explicit departure-time contracts, screen source contracts, tile completeness, empty provider responses, all-alternative corridor collection, adaptive width, essential bundle creation/handoff, and route-backup visible states.

Plain-language state: the app now treats route scoring like comparing separate folders. Shared evidence goes into every folder. Evidence stapled to Route A stays in Route A's folder. Corridor collection now looks across the alternatives before scoring, empty checked areas count as real “we looked there” evidence, the collection bubble adapts to local route shape, and Go packs a starter offline envelope before navigation opens. The UI now says when that envelope is being packed and whether it arrived ready or limited. The next route-trust slices still need provider deadlines, stable route identities beyond provider ids, bounded exposure scoring, richer weak-signal enrichment, and device/simulator verification.

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
- Adapt collection resolution to route geometry, street complexity, and declared evidence-source density without changing the fairness standard between alternatives.
- Calculate route impact from evidence severity, confidence, and bounded exposure.
- Prepare an essential offline bundle for the selected route and enrich it before known weak-signal areas.

## Non-goals

- Claiming that sampled third-party data proves every road is safe.
- Replacing Mapbox, OSRM, or Overpass.
- Blocking route geometry while safety evidence loads.
- Changing account, recording, or community-report ownership.
- Claiming complete cellular or GPS-obstruction coverage.
- Claiming that cached information restores live GPS or live conditions.
- Adding background location permission.
- Downloading app-controlled base-map imagery with the current native map stack.

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

### Versioned adaptive corridor policy

The coordinator plans every candidate with the same `adaptive-corridor-v1` policy. Planning finishes before evidence fetches begin. The policy may use route geometry, road class, intersection density, known tunnels, provider coverage metadata, and the declared accuracy of an evidence source. It may not widen or tighten a route merely because an earlier request found a desirable or undesirable result.

Collection adapts as follows:

- Dense urban grids and complex junctions use smaller tiles and closer sample spacing.
- Sparse rural legs use wider collection bounds and greater spacing within the same request and deadline budgets.
- Curves, route transitions, tunnel entrances, tunnel exits, and closely parallel roads receive extra resolution.
- A provider response that declares truncation may be subdivided deterministically. A high hazard count alone does not trigger selective refinement.
- Empty completed tiles remain valid evidence and never cause repeated widening in search of a result.

The plan records its policy version, inputs, required tile keys, and sampling disclosure. Coverage completeness is measured against that recorded plan. Alternatives may require different numbers of tiles, but every candidate must complete its own plan before the comparison can use `Safest` or `All clear`.

### Evidence influence and exposure

Collection answers where to look. Influence answers whether collected evidence applies to a route. Exposure answers how much of that route it affects.

```ts
type EvidenceImpact = {
  evidenceId: string;
  routeKey: string;
  eligible: boolean;
  confidence: 0.6 | 0.75 | 1;
  influenceMeters?: number;
  exposureMeters: number;
  exposureMultiplier: number;
  exclusionReason?: 'location-too-uncertain' | 'different-road' | 'stale';
};
```

The initial influence policy is explicit:

- A point report starts with the existing 30-metre influence distance.
- Reported horizontal accuracy may add up to 50 metres, producing an 80-metre maximum.
- Accuracy of 30 metres or better receives confidence `1`. Accuracy from 31 through 80 metres receives `0.75`. Accuracy from 81 through 100 metres receives `0.6`. Missing accuracy also receives `0.6` and keeps the 30-metre base distance.
- Accuracy worse than 100 metres is excluded from ranking unless the reporter confirms or adjusts the position. The map may show it as low-confidence information.
- Polygons use their actual boundaries.
- Road-like polylines keep the existing 20-metre proximity test. When road identity is available, the evidence must match the route's road segment so a frontage-road condition does not penalize an adjacent highway.
- Stale evidence is excluded according to the source-specific freshness policy. Low provider density changes the coverage disclosure, not an individual item's severity.

Community-report capture adds `horizontalAccuracyMeters` from the location fix and records whether the person manually confirmed or adjusted the pin. The server validates both fields and never lets the client claim a higher accuracy tier than the submitted fix supports. This schema addition ships through the privacy and community-data migration, while this specification owns how ranking consumes it.

Point evidence contributes once when eligible. Polygon and polyline evidence use measured route exposure instead of raw waypoint count. Their multiplier is `1 + min(2, exposureMeters / 1000)`, so exposure grows the contribution gradually and one zone cannot exceed three times its base category weight. Confidence multiplies that contribution. The same calculation and policy version apply to every alternative.

### Navigation-resilience bundle

When the user taps Go, write an atomic essential bundle before navigation depends on the network:

```ts
type RouteResilienceBundle = {
  schemaVersion: number;
  tripKey: string;
  routeKey: string;
  routeSetKey: string;
  corridorPolicyVersion: 'adaptive-corridor-v1';
  departureTimeMs: number;
  route: Route;
  assessment: RouteAssessment;
  validatedEvidence: Zone[];
  knownWeakSignalZones: WeakSignalZone[];
  createdAtMs: number;
  enrichedAreas: EnrichedArea[];
};
```

The essential bundle contains route geometry, turn instructions, the selected route assessment, validated evidence, known weak-signal areas, cache age, and policy versions. It expires after 24 hours or trip completion. Evidence inside it still follows its own shorter freshness rule.

Known weak-signal areas come from validated tunnel geometry or a future connectivity-source adapter. Missing coverage never implies that a road has reliable signal.

Before a known area, the app enriches the bundle while foreground navigation is active. The trigger distance is:

```text
clamp(
  current speed × (expected download seconds + 120 seconds),
  3 kilometres,
  20 kilometres
)
```

`expected download seconds` uses the rolling 90th-percentile duration from the last ten completed enrichment requests on that device, clamped from 5 to 30 seconds. With no history, it defaults to 10 seconds.

Enrichment covers the weak-signal area plus an exit recovery distance equal to three minutes of current travel, clamped from 2 to 10 kilometres. It stores detailed evidence, remaining maneuvers, and route-recovery information. Writes use a temporary record and checksum, then replace the active bundle only after validation. A failed enrichment leaves the essential bundle intact.

The current `react-native-maps` setup does not provide an app-owned offline base-map contract. Version 1 therefore guarantees route geometry, instructions, evidence, and recovery information without promising downloadable map imagery. A future provider adapter may add imagery only when its native API and terms support it.

If GPS becomes unavailable inside a mapped weak-signal area, the app may estimate progress along the selected route from the last matched position, speed, and elapsed time. Estimation starts only after five seconds without a usable fix and ends when GPS returns.

The uncertainty distance begins with the last reported horizontal accuracy and grows each second by the larger of 5 metres or 15 percent of the last reliable speed. Automatic maneuver advancement occurs only after estimated progress has passed a maneuver by more than the current uncertainty distance. Estimation stops after two minutes, at the mapped exit, or when uncertainty reaches 500 metres. The marker then freezes at the last estimate and automatic advancement stops.

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

Bundle preparation and enrichment follow the same identity rule. A route or trip change invalidates pending writes. No bundle may be opened for a different `tripKey`, `routeKey`, or policy version.

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

### Navigation-resilience states

| State | What the user sees | Actions | VoiceOver behavior |
|---|---|---|---|
| Preparing | `Preparing this route for weak signal…` in the existing route status area | Go remains pending until the essential write settles, or Cancel | Announces preparation once and marks the route status busy |
| Ready | `Route ready for offline sections` | Go | Announces readiness once without implying live GPS protection |
| Partially ready | `Basic directions saved. Some live details may be unavailable.` | Go, Try again | Reads the limitation before Go |
| Using saved information | Existing `Offline route` pill with cache age and `Using saved route information` | Continue, Retry live route when available | Announces the change once without repeating on every maneuver |
| Position estimated | `Position estimated until GPS returns` | Continue, show route overview | Announces estimated status before the next instruction |
| Position unavailable | `Position unavailable. Follow road signs until GPS returns.` | Show route overview | Freezes automatic maneuver announcements and focuses no modal |
| Reconnected | `Live route information restored` | Continue | Announces once, then removes the temporary status |
| Bundle failure | `We couldn't prepare this section for offline use.` | Try again, Continue with live route | Announces the limitation and recovery actions |

## Design audit requirements

- Route cards must disclose evidence completeness without forcing the user into a detail sheet.
- Safety language must describe current data, not promise physical safety.
- Partial information remains usable, but the limitation appears before the primary action.
- Error, timeout, and no-route states cannot share copy because their recovery actions differ.
- Dynamic Type must keep disclosures and recovery actions visible.
- VoiceOver must announce state changes once, in the same order as the visible hierarchy.
- Map geometry should render as soon as routing resolves. Safety checks update it progressively without layout jumps.
- Adaptive collection remains invisible unless it changes coverage completeness or the long-trip sampling disclosure.
- Route readiness uses the existing route-card metadata area, Libre Franklin hierarchy, and the warm sheet surfaces.
- `Ready` uses the existing non-safety accent vocabulary. It does not use safety green as proof that the route is safe.
- En-route loss of live data reuses the current dark-card `Offline route` pill, `WifiSlash` icon, white text, and compact metadata separator.
- Position uncertainty uses neutral white-on-dark status treatment. Orange and red remain reserved for physical hazards and urgent alerts.
- Retry actions use the existing green button vocabulary with 44-point painted targets. Do not add a new alert banner or blocking modal.
- Readiness changes crossfade with the existing 220-millisecond quick motion token. Reduce Motion changes state immediately.
- Navigation status stays in Libre Franklin. DM Serif remains reserved for emotional moments outside route chrome.

## Performance budgets

- No network promise outlives its deadline.
- At most four concurrent safety requests.
- At most 20 unique safety tile calls per preview.
- Planning, deduplication, and ranking each finish within 50 ms for three typical routes.
- At most four partial UI publications per calculation.
- Tests prove one network call per unique tile.
- Essential bundle writes finish within 500 milliseconds for a typical regional route and remain below 5 MB without base-map imagery.
- Enrichment respects the existing safety deadline and never delays current turn guidance.

## Test strategy

- Unit tests for stable keys, geometry fingerprints, explicit-time scoring, fair scheduling, valid empty tiles, missing coverage, and incident isolation.
- Fake-timer tests for provider timeouts, fallback order, overall deadlines, and abort cleanup.
- Integration tests proving three alternatives share tiles without sharing route-specific evidence.
- Policy tests for urban grids, rural legs, curves, parallel roads, tunnels, declared truncation, empty tiles, and deterministic planning before evidence is known.
- Influence tests for every GPS-accuracy band, missing accuracy, over-100-metre exclusion, road-segment mismatch, polygon boundaries, exposure multipliers, and policy-version cache invalidation.
- Race tests proving destination A cannot mutate destination B through partial, cached, delayed, or debounced results.
- Cache tests for same destination with different trips, route reorder, provider change, stale evidence, and v1 rejection.
- Bundle tests for atomic replacement, checksum failure, stale and mismatched identities, trip completion, sign-out purge, dynamic trigger distance, enrichment failure, and storage limits.
- Simulated navigation tests for signal loss, five-second estimation entry, confidence decay, two-minute cutoff, frozen maneuver advancement, and live recovery.
- Component tests for every state, action, label, hint, focus order, and the absence of all-clear language during partial coverage.
- Manual VoiceOver checks for phase announcements, comparison rows, cached disclosures, offline preparation, estimated position, timeouts, and rapid destination changes.

## Rollout order

1. Add typed results, explicit clocks, stable keys, and privacy-safe telemetry.
2. Add provider deadlines and structured outcomes.
3. Add tile cache v2 with valid empty entries and complete coverage accounting.
4. Add the versioned adaptive planner and deterministic sampling policies.
5. Add the multi-route scheduler, influence and exposure model, and per-route assessments.
6. Propagate aborts and generation guards through both screens.
7. Add the atomic essential bundle, weak-signal enrichment, and bounded position estimation.
8. Migrate route caches and Home-to-En-Route handoff.
9. Update preview, comparison, and navigation-resilience states using the existing design language.
10. Remove production mock navigation and delete v1 cache reads after one release.

## Acceptance criteria

- Every candidate has its own planned coverage record.
- Shared tiles are fetched once.
- Missing and failed tiles never count as complete. Successful empty tiles do.
- Adaptive plans are deterministic, recorded before evidence fetch, and generated under the same policy for every candidate.
- Urban, rural, curved, tunnel, and parallel-road cases receive the documented collection behavior.
- Ranking uses one explicit departure time and route-specific evidence.
- Evidence influence follows the documented accuracy bands, distance caps, road matching, confidence, and exposure rules.
- `Safest` and `All clear` appear only after complete planned coverage for all candidates.
- Incidents never affect another route or count twice.
- Provider and overall deadlines always settle.
- Old generations cannot update route, evidence, selection, cache, or announcements.
- Selection survives provider reorder when geometry is unchanged.
- Cached navigation requires the same active trip and discloses its age.
- All eight user states match the documented copy, actions, and accessibility behavior.
- The essential route bundle is atomic, identity-bound, size-bounded, and usable without live providers.
- Approaching a known weak-signal area enriches the selected route without delaying guidance.
- GPS estimation is visibly disclosed, time-bounded, route-bounded, and replaced or frozen according to confidence.
- All eight navigation-resilience states match the documented visual, action, motion, and VoiceOver behavior.
- Production cannot navigate on synthetic mock geometry.

## Deferred work

- Background route refreshing.
- New safety-data providers.
- A universal cellular-coverage or GPS-obstruction dataset.
- App-controlled offline base-map imagery.
- Server-side route assessment caching.
- A broader product study of how drivers interpret sampled-coverage disclosures.
