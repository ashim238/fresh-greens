# Fresh Greens — Thesis Coverage Audit

_Generated 2026-05-30 — audits the shipped v1 codebase against the MFA thesis's testable claims._

Produced by a multi-agent workflow (21 agents): each thesis claim was extracted from `thesis-2026-ashitey.md`, then verified **against actual shipped code** (file:line grounded — `fgq` used only for provenance pointers, never as standalone evidence). Re-runnable; see `docs/workflow.md` §11 for the `fgq` discipline.

---

## Summary

**8 implemented · 7 partial · 3 missing** (of 18 extracted claims).

> 8 of 18 thesis claims fully implemented, 6 partial, 4 missing. The technical spine of the thesis ships end-to-end and honestly: safety-weighted route scoring, the equal-weight community-knowledge pipeline, the three-layer adapter/scoring/screen architecture, the daylight surfacing, and the pulled-over flow are all real, live-data-backed, and verifiable in code. The gaps cluster in two places — the emergency/SOS half of the safety story (no 911 path or countdown SOS at all) and the adaptive-narrative claims (no usage-keyed tone shift, no inference-validation trip summary, no checkpoints) — which are exactly the "v2 vision" surfaces the thesis describes aspirationally rather than the "v1 mechanism" it grounds in architecture.

---

## Closed since the audit

The audit above is a point-in-time snapshot (2026-05-30). Gap-closing work tracked here so the snapshot stays honest while progress is visible.

- **C16 — speed cluster recolors on zone entry** → ✅ closed (PR L). The current-speed pill's border goes white → yellow (`colors.yellow`, the reserved caution color) when the driver is inside a caution/avoid zone, driven off the existing `enteredZoneIds` signal. `app/en-route.tsx` (`inCautionZone` + `speedLimitCurrentPillCaution`).
- **C18 — "max two zones" cap** → ✅ resolved as an intentional reframe (PR L). The literal cap lives on the turn-card hazard glyphs (`hazardsNearTurn(...).slice(0, 2)`), where glanceability under stress is the constraint; the on-map overlays deliberately show the full hazard picture as the spatial overview. Capping the map would hide hazards — documented inline in `app/en-route.tsx` as a design evolution, not a regression.

---

## Coverage table

| | Claim | Status | Implementing feature | Evidence |
|---|---|---|---|---|
| **C1** | The app routes by safety, not just speed, generating an alternate route that … | 🟢 implemented | Safety-scoring layer (lib/scoring.ts: scoreRoute + pickWinner) consuming live OSM zones (lib/api/zones.ts), surfaced through the /home departure card and /en-route navigation — recommended route is the highest-safety-score route, not the fastest, with 'Safest route' framing and per-route zone-warning chips. | lib/scoring.ts:101-120 (scoreRoute walks every route coordinate against every zone, sum… |
| **C2** | Community-sourced reports are weighted equally with institutional/public-infr… | 🟢 implemented | reportToZone() + getCommunityReportsAsZones() adapter feeding the shared Zone[] scoring pipeline (scoreRoute/pickWinner), with community-report and OSM zones merged into one undifferentiated allZones array on /home and /en-route. | lib/api/community-reports.ts:333-356 (reportToZone converts a CommunityReport into the … |
| **C3** | Three adapter files fetch from three distinct sources: zones (OpenStreetMap),… | 🟢 implemented | Adapters layer (layer 1 of the three-layer architecture): lib/api/zones.ts (OSM/Overpass), lib/api/routes.ts (OSRM with Mapbox primary + cache + mock fallback), lib/api/community-reports.ts (AsyncStorage device-local store). | lib/api/zones.ts:68-72 (OVERPASS_ENDPOINTS: overpass-api.de, kumi.systems, openstreetma… |
| **C4** | Each zone carries a type (safe/caution/avoid), a geometry (polyline, polygon,… | 🟢 implemented | Zone data model + geometry-dispatched route scoring (lib/api/zones.ts Zone type; lib/scoring.ts isPointInZone/scoreRoute) | lib/api/zones.ts:95 (ZoneType = 'safe'\|'caution'\|'avoid'); lib/api/zones.ts:102-109 (… |
| **C5** | Time of day affects scoring: wildlife zones at dawn or dusk carry double weig… | 🟢 implemented | Per-category time-of-day score modulation in lib/scoring.ts (categoryMultiplier + isDawnOrDusk), consumed by pickWinner/scoreRoute which drive route recommendation on /home and /en-route | lib/scoring.ts:55-64 (categoryMultiplier returns 2 for wildlife in dawn/dusk window); l… |
| **C6** | Daylight awareness is surfaced to the user: the app shows daylight at the des… | 🟢 implemented | Daylight gradient route polyline + bottom-sheet daylight strip (sun/moon glyphs) + arrival daylight label + "Schedule for {time}" leave-later chip with local notification | lib/daylight.ts:79-159 (gradientSegments computes minutes-to-sunset per segment via Sun… |
| **C7** | Zones (areas of higher hazard / lower visibility saturation) are rendered on … | 🟡 partial | En-route zone overlays, EnRouteZone markers, turn-card hazard glyphs, /home route-warning chips. | Rendered: app/en-route.tsx:944-970; lib/api/zones.ts:361-543. Fires at entry: app/en-ro… |
| **C8** | An emergency/SOS control offers the driver a choice between calling a trusted… | 🔴 missing | — | No code implements the described emergency/SOS control. Repo-wide searches found: zero … |
| **C9** | The trusted-contact graph reflects two real coping behaviors drawn from inter… | 🟡 partial | Trusted-contact (community) path: contact adapter + hook reused across pulled-over Contact phase, home trusted-friend pin, and the TrustedContactStatus footer. The 911 / institutional counterpart is not implemented. | Community (trusted-contact) path is fully shipped and reused across flows: lib/api/trus… |
| **C10** | A 'pulled over' flow assists a driver stopped by police: starts audio recordi… | 🟢 implemented | /pulled-over consolidated state-machine modal (armed → transition → guidance → contact → review) with live mic-metered recording, ACLU-aligned rights content, and trusted-contact call/text | app/pulled-over.tsx:293-322 (mic permission + recorder.record() starts on leaving armed… |
| **C11** | A reworked safety modal presents a 2x2 grid of comprehensive safety options: … | 🟡 partial | Safety modal (/safety route) — 2x2 tile grid header "Safety / What's going on?" with four category tiles | app/safety.tsx:61-90 (TABS array with exactly the four named entries: 'pulled-over', 'r… |
| **C12** | Trips end with a post-trip summary where the user can validate or reject the … | 🟡 partial | app/trip-summary.tsx — post-trip recap modal (route-disposition only), currently unreachable/untracked | app/trip-summary.tsx:45-133 (single-view arrival recap modal: destination label, durati… |
| **C13** | The screen layer is independent of how data is fetched and how routes are sco… | 🟢 implemented | Three-layer data pipeline: adapters (lib/api/*) → scoring (lib/scoring.ts, lib/daylight.ts) → screens (app/*), wired through useMemo in home.tsx and en-route.tsx | lib/scoring.ts:1-4 (header asserts "Pure functions (no async, no I/O)"), :101 scoreRout… |
| **C14** | Edge markers (compass-style icons at the screen edge) point toward nearby pla… | 🟡 partial | Off-viewport edge indicators on the /home browse map (lib/edge-indicators.ts + components/EdgeIndicator.tsx), including a dedicated Black-owned compass marker variant fed by community-report place data. | lib/edge-indicators.ts:79-120 (edgePositionForPoint: screen-edge anchor + atan2 bearing… |
| **C15** | The app's tone shifts with familiarity: early states confirm/ask about infere… | 🔴 missing | — (no usage-keyed tone system; only a binary first-time-vs-returning onboarding gate + light name/place personalization on /home) | No familiarity/usage-count state exists: lib/api/user.ts:33-42 (User type = id, provide… |
| **C16** | Visual language is skeuomorphic and culturally specific: turn cards resemble … | 🟡 partial | /en-route custom turn-card header (components in app/en-route.tsx) + EnRouteZone on-map markers + Hazard glyph components, all driven by theme/colors.ts brand tokens with reserved-color rule in .cursorrules | Turn cards (interstate-sign register, token-driven): app/en-route.tsx:1126-1218 (turnSi… |
| **C17** | Checkpoints (pre-planned rest stops) are inserted at intervals for long-haul … | 🔴 missing | — (none for checkpoints/ETA toggle). Adjacent shipped feature: static sun/moon daylight glyph on the ETA — app/en-route.tsx:1478-1482, isNight at :603 — plus minutes-to-sunset polyline gradient in lib/daylight.ts:79-159. | No checkpoint/rest-stop code exists: case-insensitive ripgrep for `checkpoint`, `rest-s… |
| **C18** | Zone display has a hard limit (max two zones at once) and uses non-color-depe… | 🟡 partial | Zone stroke/dash + per-category glyph accessibility encoding; two-hazard-symbol cap on the en-route turn card (hazardsNearTurn + slice(0,2)) | NON-COLOR DISTINCTION (shipped): lib/api/zones.ts:307-311 zoneDashPattern (safe=solid, … |

---

## Detailed verdicts

### C1 — 🟢 implemented · _safety-routing_

**Claim:** The app routes by safety, not just speed, generating an alternate route that maximizes visibility and reduces interview-identified hazards.

**Thesis detail:** The thesis states Fresh Greens would "at the very least, create an alternate route that took the previously mentioned markers and generated a route that maximized visibility and reduced what interviewees identified as hazards, deviating from mainstream navigation applications in its function rather than its aesthetic." Unlike Google/Apple/Waze which "prioritize timeliness as a universal metric," Fresh Greens scores routes by safety. The scoring layer "makes a ranking out of routes and zones" and "the route with the highest score is recommended."

**Expected implementation:** A scoring module that takes candidate routes plus zones, walks each coordinate point, adds/subtracts zone weights, and returns a ranked list where the highest-safety route (not the fastest) is the recommended one. Route selection UI shows safety, not just ETA.

**Evidence:** lib/scoring.ts:101-120 (scoreRoute walks every route coordinate against every zone, summing SCORE_WEIGHTS safe:+2 / caution:-1 / avoid:-5 with per-category time-of-day multiplier); lib/scoring.ts:41-45 (SCORE_WEIGHTS), 55-64 (categoryMultiplier wildlife dawn/dusk x2); lib/scoring.ts:234-250 (pickWinner scores all candidate routes, sorts by score descending, marks index 0 'recommended' and the rest 'alternate'); lib/scoring.ts:130-149 (isPointInZone polygon/polyline/point geometry dispatch). Wired into both route screens: app/home.tsx:272 and app/en-route.tsx:339 call pickWinner(rawRoutes, allZones); app/home.tsx:278 selects the highest-score winner as 'recommended'. Real safety data source: lib/api/zones.ts:184 getZonesForRegion fetches live OSM via Overpass API, mapping lit=no->avoid / lit=yes->safe (zones.ts:8-10,568), plus smoothness/road-condition (433) and landuse/park (497). Route-selection UI surfaces safety not just ETA: app/home.tsx:1767 'Safest route with current conditions' caption and app/home.tsx:1784-1812 RouteWarningChip counts of police/low-light zones along the recommended polyline (routeZoneCounts at 418-433). Candidate routes from real engines: lib/api/routes.ts:215 getRoutesBetween (Mapbox -> OSRM -> cache -> mock ladder).

**Notes:** Fully met end-to-end: a pure scoring module takes candidate routes + zones, walks each coordinate, adds/subtracts zone weights (with crepuscular-wildlife time modulation), returns a ranked list where the highest-safety route is marked 'recommended', and the UI labels it 'Safest route' while counting hazardous zones along it. One honest nuance worth recording as v2 context (not a gap against the thesis's own wording): candidate routes are the alternates returned by Mapbox/OSRM (distance/duration-derived), and Fresh Greens re-ranks those candidates by safety score rather than synthesizing a brand-new visibility-maximizing geometry from scratch. That matches the thesis's stated bar ('at the very least, create an alternate route ... the route with the highest score is recommended'). Zones are real (live Overpass OSM lighting/road-condition/landuse) plus community reports merged through the same Zone type and scorer dispatch (home.tsx:262-274). Mock route fallback exists only when both routing engines and cache are unreachable.

---

### C2 — 🟢 implemented · _community-knowledge_

**Claim:** Community-sourced reports are weighted equally with institutional/public-infrastructure data in route scoring.

**Thesis detail:** The thesis is explicit: "Community reports go through reportToZone() becoming the same Zone shape as OSM data, ensuring that a person's submission about feeling unsafe and public infrastructure data about an unlit street carry the same scoring weight." This privileging of lived/community knowledge alongside official data is the countermapping thesis made literal.

**Expected implementation:** A reportToZone() (or equivalent) function that converts a user-submitted community report into the same Zone object shape (type, geometry, category) used by OSM/infrastructure data, so both flow into the scoring layer with the same weight.

**Evidence:** lib/api/community-reports.ts:333-356 (reportToZone converts a CommunityReport into the same Zone shape — type/label/geometry/coordinates/category — with type = category.zoneType, the same safe|caution|avoid discriminant OSM zones use); lib/api/community-reports.ts:321-324 (getCommunityReportsAsZones returns Zone[], docstring: "ready to feed the scoring pipeline alongside OSM zones"); app/home.tsx:262-264 and app/en-route.tsx:324-326 (allZones = [...osmZones, ...reportZones] — one flat array, no source distinction); lib/scoring.ts:101-120 (scoreRoute applies SCORE_WEIGHTS[zone.type] * multiplier, keyed on zone.type ONLY, not zone.category); lib/scoring.ts:41-45 (SCORE_WEIGHTS = {safe:2, caution:-1, avoid:-5} — no category branch); lib/scoring.ts:55-64 (categoryMultiplier returns 1 for community-report; only wildlife at dawn/dusk gets ×2); app/home.tsx:272 and app/en-route.tsx:339 (pickWinner(rawRoutes, allZones) ranks routes over the merged array).

**Notes:** Fully end-to-end. reportToZone() produces the identical Zone shape OSM produces, the screens concatenate both sources into allZones with no provenance tag, and scoreRoute weights purely on zone.type (safe/caution/avoid) via SCORE_WEIGHTS — never on zone.category. So a community-report caution zone and an OSM caution zone contribute the exact same score. The only per-category modulation (categoryMultiplier) amplifies wildlife at dawn/dusk and returns 1 (no modulation) for community-report, which strengthens rather than weakens the claim: the code deliberately adds no factor that down-weights lived/community knowledge relative to infrastructure data. Minor nuance, not a gap: community reports are point-geometry (30m proximity) while many OSM zones are polyline/polygon, so an individual report influences a narrower stretch of route geometrically — but per-hit weight is identical, which is what the thesis claim asserts. Note the scoring runs client-side in the Expo app (lib/scoring.ts), not the proxy; the proxy's osm-overpass.ts is a separate recommendations/zone-fetch path.

---

### C3 — 🟢 implemented · _research-grounding_

**Claim:** Three adapter files fetch from three distinct sources: zones (OpenStreetMap), routes (OSRM), and community reports (local phone storage).

**Thesis detail:** Step 1 of the architecture: "Three adapter files each fetch information from a different source: zones from OpenStreetMap (lit streets, parks, industrial districts, police, hazards), routes from OSRM (a routing engine), and community reports from local storage on the phone. Each API call returns Zone[] (an array of zones)." This is the adapters layer of the three-layer architecture.

**Expected implementation:** Three separate adapter modules: one calling OpenStreetMap/Overpass for zones, one calling OSRM for routes, one reading community reports from local device storage (AsyncStorage). Each normalizes its output to a Zone[] array.

**Evidence:** lib/api/zones.ts:68-72 (OVERPASS_ENDPOINTS: overpass-api.de, kumi.systems, openstreetmap.fr — OpenStreetMap Overpass API), zones.ts:184-218 getZonesForRegion returns Promise<Zone[]> via fetchOverpassZones (zones.ts:225-266); zones.ts:351-373 buildOverpassQuery pulls lit streets / landuse / parks / police / wildlife / road-conditions. lib/api/routes.ts:519-533 buildOSRMUrl builds https://router.project-osrm.org/route/v1/driving/... fetched at routes.ts:315, returns source:'osrm' (routes.ts:354). lib/api/community-reports.ts:25 imports AsyncStorage, reads via readAll (community-reports.ts:358-370, STORAGE_KEY line 29) and exposes getCommunityReportsAsZones returning Promise<Zone[]> (community-reports.ts:321-324, reportToZone line 333-356).

**Notes:** Three distinct adapters from three distinct sources are fully present and shipped. Two caveats, neither a code gap: (1) The thesis DETAIL's blanket statement "Each API call returns Zone[]" holds for zones and community-reports, but the routes adapter intentionally returns RoutesResult/Route[] (routes.ts:103-117, 206-208), a separate type — the routes.ts header even notes routes are not pre-classified into zones. So routes do NOT normalize to Zone[]; that sub-claim is imprecise in the thesis. (2) The routes adapter is actually a four-tier ladder where OSRM is the second tier (Mapbox primary, then OSRM, then AsyncStorage cache, then mock) — routes.ts:1-20. The thesis simplification ("routes from OSRM") names only the fallback engine; OSRM is genuinely wired and live, so the source attribution is correct, just narrower than the real implementation. Core C3 claim (three adapters, three sources: OSM, OSRM, local storage) is fully met.

---

### C4 — 🟢 implemented · _research-grounding_

**Claim:** Each zone carries a type (safe/caution/avoid), a geometry (polyline, polygon, or point), and a category.

**Thesis detail:** The thesis specifies the Zone data shape: "Each zone has: A type (safe / caution / avoid), A geometry (polyline, polygon, or a point), A category." The scoring uses geometry-specific tests: "point-in-polygon for areas, distance from the segment for streets, and distance from the point for community reports."

**Expected implementation:** A Zone TypeScript type/interface with a type field constrained to safe/caution/avoid, a geometry field supporting polyline/polygon/point, and a category field. Scoring code branches on geometry kind (point-in-polygon, distance-from-segment, distance-from-point).

**Evidence:** lib/api/zones.ts:95 (ZoneType = 'safe'|'caution'|'avoid'); lib/api/zones.ts:102-109 (ZoneCategory union); lib/api/zones.ts:131-176 (Zone type: type/geometry='polygon'|'polyline'|'point'/category fields); lib/scoring.ts:130-149 (isPointInZone dispatches on zone.geometry: polygon→isPointInPolygon, polyline→isPointNearPolyline, point→pointToPointDistanceMeters); lib/scoring.ts:374-389 (ray-casting point-in-polygon); lib/scoring.ts:401-445 (point-near-polyline via pointToSegmentDistanceMeters, distance-from-segment); lib/scoring.ts:453-462 (pointToPointDistanceMeters, distance-from-point); lib/api/community-reports.ts:345-347 (community reports produced as geometry:'point', category:'community-report')

**Notes:** Fully implemented end-to-end and matches the thesis precisely. The Zone TypeScript type constrains `type` to safe/caution/avoid, `geometry` to polygon/polyline/point, and carries `category` (ZoneCategory union of 7 sources). Scoring's isPointInZone (and the looser isWaypointInProximity for hazards) branch on geometry exactly as the thesis describes: ray-casting point-in-polygon for areas, clamped point-to-segment distance for streets/polylines, and point-to-point distance (≤30m, POINT_PROXIMITY_METERS) for points. Community reports flow through as point-geometry zones, so 'distance from the point for community reports' is literal. Minor caveat: `category` is declared optional (`category?`) for backwards-compat with older fixtures, but every adapter-produced zone (OSM ways/nodes, mock fallback, community reports) sets it. Geometry-specific scoring is also exercised in lib/edge-indicators.ts and /en-route live zone-entry detection via the same isPointInZone helper.

---

### C5 — 🟢 implemented · _daylight_

**Claim:** Time of day affects scoring: wildlife zones at dawn or dusk carry double weight (daylight awareness baked into routing).

**Thesis detail:** "Time of day comes into play as well. Wildlife zones at dawn or dusk carry double the weight." This operationalizes the Light and Wildlife markers from interviews, where drivers planned trips around sunrise/sunset and were cautious of deer in tree-dense areas at low light.

**Expected implementation:** Scoring logic that reads current/projected time of day and applies a multiplier (e.g. 2x) to wildlife-category zone weights when the time falls in a dawn/dusk window.

**Evidence:** lib/scoring.ts:55-64 (categoryMultiplier returns 2 for wildlife in dawn/dusk window); lib/scoring.ts:74-82 (isDawnOrDusk uses SunCalc real sunrise/sunset, ±30min window); lib/scoring.ts:101-120 (scoreRoute applies SCORE_WEIGHTS[zone.type] * multiplier, takes departureTime: Date = new Date()); lib/scoring.ts:234-250 (pickWinner threads departureTime through); lib/api/zones.ts:476-481 & 551-556 (real Overpass parser emits category 'wildlife', type 'caution'); lib/api/zones.ts:688-695 (mock wildlife zone); call sites app/home.tsx:272 and app/en-route.tsx:339

**Notes:** Core mechanic is real and end-to-end for the CURRENT-time case: a wildlife (forest/wildlife-crossing) zone scored within +-30min of SunCalc-computed sunrise/sunset gets its caution weight (-1) doubled to -2, computed at the zone's actual lat/lng. Wildlife zones genuinely exist in both the live Overpass adapter and mock data, so the multiplier is reachable against real data. Two caveats, neither defeating the claim: (1) Both production call sites call pickWinner(rawRoutes, allZones) WITHOUT a departureTime arg, so it always defaults to now -- the 'projected time' path (e.g. scoring a scheduled future departure) is fully plumbed in the API (departureTime param exists and is threaded) but never exercised by a UI caller; the 'Schedule for X:XX AM' chip at home.tsx:1861-1917 only fires a local notification, it does not re-score with the suggested future time. (2) No unit tests cover the scoring/dawn-dusk logic. The thesis substance -- wildlife at dawn/dusk carries double weight, baked into routing -- is satisfied for the operative leave-now scenario.

---

### C6 — 🟢 implemented · _daylight_

**Claim:** Daylight awareness is surfaced to the user: the app shows daylight at the destination and can suggest leaving later for more daylight.

**Thesis detail:** An interview respondent explicitly asked for a light-conscious feature ("show the gradient of light... bright where you are and dark where you arrive, or your projected light coverage"). The scenario describes a user seeing "a note about leaving a bit later for more daylight." The daylight feature evolved from a gradient down to "the discreet icon found in the final iteration."

**Expected implementation:** A daylight UI element (icon and/or gradient) comparing light at origin vs destination, computed from sunrise/sunset times, and ideally a suggestion to depart later for more daylight.

**Evidence:** lib/daylight.ts:79-159 (gradientSegments computes minutes-to-sunset per segment via SunCalc.getTimes at L134 using departure time + per-segment travel offset + segment lat/lng); lib/daylight.ts:239-256 (suggestedDepartureForDaylight returns a later departure, pre-dawn → sunrise+15min, capped 5min-3hr); package.json:35 + node_modules/suncalc confirmed installed; theme/colors.ts:49-51 (daylightDawn/Dusk/Night tokens). Origin-vs-destination comparison: app/home.tsx:286-294 (arrivalDaylightLabel reads final segment band → "arriving in daylight/at dusk/after dark"); app/en-route.tsx:587-604 + 1474-1481 (arrivalDisplay.isNight → sun vs moon glyph at arrival time). Daylight UI rendered: app/home.tsx:322-337 + app/en-route.tsx:558 (gradient route polyline orange→mauve→indigo with WCAG DAYLIGHT_DASH_PATTERN, daylight.ts:63-67); app/home.tsx:1728-1748 (bottom-sheet daylight strip: LinearGradient + DaylightSun/DaylightMoon glyphs — the "discreet icon"). Leave-later suggestion: app/home.tsx:398-401 (suggestedDeparture memo), 1826-1837 ("Heads up! You can leave in a bit ... with some added daylight" copy), 1862-1917 ("Schedule for {time}" chip), wired to lib/notifications.ts:59-94 (scheduleDepartureNotification, body "Leaving now gives you more daylight {dest}").

**Notes:** Fully implemented end-to-end and rendered (not dead code) on both /home and /en-route. Daylight is computed for real from SunCalc sunrise/sunset, not mocked. Origin-vs-destination contrast is shown via the gradient (light start → dark end) plus an explicit arrival band label/glyph. The leave-later suggestion is real and actionable (schedules an OS notification). Mirrors the thesis evolution note precisely: gradient → discreet sun/moon icon in the final iteration. Minor v1 limitations noted in-code (not claim gaps): suggestedDepartureForDaylight currently only fires for pre-dawn departures (mid-day/post-sunset return null), and `now` is captured at first render so a stale chip can persist until /home remounts. These narrow the suggestion's trigger window but do not contradict the claim.

---

### C7 — 🟡 partial · _safety-routing_

**Claim:** Zones (areas of higher hazard / lower visibility saturation) are rendered on the map and warn the driver before entry without permanently labeling neighborhoods.

**Thesis detail:** "Zones signaled areas of higher marker saturation—or in the case of visibility, lower saturation." Notification copy was deliberately chosen to avoid stigma: "The difference between phrases like 'Police zone ahead' and 'Increased police presence in 0.9 mi' is in the lack of ambiguity." Zone warnings surface a mile before entry.

**Expected implementation:** Map overlays for zones plus a zone-entry warning UI that appears ~1 mile ahead, using non-stigmatizing distance-based copy (e.g. "Increased police presence in 0.9 mi") rather than fixed labels like "Police zone."

**Evidence:** Rendered: app/en-route.tsx:944-970; lib/api/zones.ts:361-543. Fires at entry: app/en-route.tsx:370-377,483-490 swap to Extended only when isPointInZone true (lib/scoring.ts:130-150); thresholds 20m/30m; turn glyphs 200m (lib/scoring.ts:280). Copy is zone-length For X mi (components/EnRouteZone.tsx:142-145). Pre-trip fixed police zone labels (app/home.tsx:1804,1810).

**Notes:** Trigger at-entry 20-30m or 200m near-turn, never a mile ahead; no distance-to-entry math. Copy zone-length or fixed labels, never Increased police presence in 0.9 mi. /home chips ship literal police zone label. Distance-based mile-ahead non-stigmatizing copy is v2 gap.

---

### C8 — 🔴 missing · _trusted-contact_

**Claim:** An emergency/SOS control offers the driver a choice between calling a trusted contact and calling 911, reflecting interview-sourced wariness of police.

**Thesis detail:** "Respondents mentioned wariness around police; the feature gave them the autonomy to choose how they'd like to be supported in moments of crisis." Behavior: single tap initiates a three-second countdown and calls a trusted contact; long-press fills the button with red and initiates a 911 call on completion. The split deliberately separates trusted-contact from first-responder paths.

**Expected implementation:** An emergency component with two distinct paths: a tap path that runs a 3s countdown then calls a trusted contact, and a long-press path that fills red and triggers a 911 call. The two coping behaviors (lean on community vs. call authorities) are both first-class.

**Evidence:** No code implements the described emergency/SOS control. Repo-wide searches found: zero references to "911" as a dialed number, zero "SOS"/"emergency button/control" identifiers, and no 3s-countdown or long-press-to-fill-red gesture. Every tel: dial targets a trusted contact's stored phoneNumber, never 911 — app/pulled-over.tsx:890 (`tel:${contact.phoneNumber}`, plain onPress) and app/home.tsx:566 (`tel:${trustedContact.phoneNumber}`, Alert Call action). The trusted-contact call surfaces (app/pulled-over.tsx:880-899 handleCall/handleText; app/home.tsx:553-579 handleTrustedFriendMarkerPress) are tap-only with no countdown and no authority-call alternative. The only onLongPress handlers in the codebase are unrelated: app/search.tsx:546 (delete recent search) and app/home.tsx:994 (place a community report pin on the map). The only "red fill" match is a zone-overlay polygon color, lib/api/zones.ts:286, not a button. fgq's "emergency modal" node resolves solely to the thesis transcript (~/.graphify/fg-chats/raw/thesis-2026-ashitey.md), with no corresponding code node.

**Notes:** Only one half of the claim's spirit ships, and even that diverges from the described behavior: the /pulled-over Contact phase (app/pulled-over.tsx:859-1037) and the home-screen Trusted Friend marker (app/home.tsx:553-579) let the user Call/Text a trusted contact. But these are plain single taps that immediately open the dialer — there is NO 3-second countdown, NO dedicated SOS/emergency control, and critically NO 911 / first-responder path at all. The claim's central design point — a split control giving the user autonomy to choose between leaning on community (trusted contact) vs. calling authorities (911), via two distinct gestures (tap-countdown vs. long-press-fill-red) — is entirely absent from shipped code. The 911 / long-press-fill-red authority path was never implemented; the trusted-contact path exists but as ordinary call/text buttons, not as the countdown-driven SOS the thesis describes. This is a genuine v2 gap: the thesis claim (and its police-wariness rationale) is narrative-only, not fulfilled by code. Note the 3000ms TRANSITION_MS in pulled-over.tsx:143 is an unrelated phase auto-advance, not an SOS countdown.

---

### C9 — 🟡 partial · _trusted-contact_

**Claim:** The trusted-contact graph reflects two real coping behaviors drawn from interviews (leaning on community vs. institutional help).

**Thesis detail:** Interviews surfaced that drivers, when veered off course, "would call a family member or friend at the destination or trail behind them," and were wary of police. The product encodes both a trusted-contact (community) path and a 911 (institutional) path across the emergency modal and pulled-over flow, giving the user autonomy over which support to invoke.

**Expected implementation:** A trusted-contact concept stored and reused across emergency and pulled-over flows, presented alongside (and distinct from) the 911 option, so the user picks community support or institutional support.

**Evidence:** Community (trusted-contact) path is fully shipped and reused across flows: lib/api/trusted-contact.ts (storage adapter) + hooks/useTrustedContact.ts:87 (reactive wrapper, native contact picker); set up in app/trusted-contact-setup.tsx. Reused in the pulled-over flow at app/pulled-over.tsx:863 (useTrustedContact), with Call at :890 (tel:) and Text at :898 (sms:); persistent footer components/TrustedContactStatus.tsx:22-31. Reused on the home map action sheet at app/home.tsx:553-579 (Call/Text on the trusted-friend pin). The INSTITUTIONAL (911) path: NONE FOUND — `rg "911" -g '*.tsx' -g '*.ts'` returns zero matches (the only "911" hits are SVG path coordinates in assets/illustrations/*.svg); every tel:/sms: usage in the codebase (home.tsx:566/573, pulled-over.tsx:890/898) dials the trusted contact, never emergency services. No police/911 affordance exists in app/safety.tsx (the emergency modal — tiles are Pulled-over/Roadside/Unfamiliar/Share-location, the latter three inert stubs) or anywhere else.

**Notes:** Only the community half of the claimed two-behavior model is encoded. The defining contrast the claim asserts — an institutional 911 path presented ALONGSIDE and DISTINCT FROM the community path, with the user choosing which support to invoke — does not exist in code: no 911 literal, no emergency-services call, no police-contact affordance in any TS/TSX. "emergencies" appears only as descriptive copy (pulled-over.tsx:915, trusted-contact-setup.tsx:175) describing when trusted contacts are alerted, not an institutional option. The single-path-to-community design is arguably faithful to the interview finding that drivers were wary of police, but the thesis explicitly claims BOTH paths are encoded with user autonomy between them — that second path and the choice it implies are a genuine v2 gap. fgq surfaced no provenance node for a shipped 911 feature either.

---

### C10 — 🟢 implemented · _safety-routing_

**Claim:** A 'pulled over' flow assists a driver stopped by police: starts audio recording, shows know-your-rights bullets, and offers a trusted-contact call.

**Thesis detail:** "The pulled over safety flow... was designed to assist a driver being stopped by an officer or trooper. The feature immediately begins recording the audio and presents the driver with brief bullets on what to say. Following the encounter... the feature offers the opportunity to call a pre-set trusted contact. The flow includes four guidance slides sourced from ACLU know-your-rights-documentation."

**Expected implementation:** A pulled-over flow screen that triggers audio recording, displays four ACLU-sourced guidance slides (with selective bolding for scanning) on what to say, and ends with a call-trusted-contact action plus a return-to-navigation option.

**Evidence:** app/pulled-over.tsx:293-322 (mic permission + recorder.record() starts on leaving armed phase); app/pulled-over.tsx:340-378 (recorder runs ambiently, persists to /recordings on dismiss); app/pulled-over.tsx:734-752 ("Read the following" guidance bullets); app/pulled-over.tsx:1390-1444 ("Know your rights" review sub-view, comment at :1391 cites ACLU "Stopped by Police"); app/pulled-over.tsx:880-991 (ContactView Call button dials tel:, plus Text + Review guidance); app/pulled-over.tsx:1264-1271 (Strong component for selective bolding); app/pulled-over.tsx:1030-1034 (return-to-navigation via swipe-down); lib/api/gun-laws.ts:260-288 (FIREARM_GUIDANCE record, single source for guidance + Say bullets); app/safety.tsx:63-70 + app/_layout.tsx:38 (entry from /safety, route registered as a modal)

**Notes:** All three core promises ship end-to-end: (1) audio recording auto-starts via expo-audio when the user answers the armed question and runs through the whole flow with persistence to /recordings (graceful fallback if mic denied); (2) know-your-rights bullets appear both on the guidance phase and a dedicated ACLU-aligned "Know your rights" review sub-view, with selective bolding via the <Strong> component for scanning; (3) a trusted-contact Call (tel:) action with a return-to-navigation affordance. Structural caveat on the thesis's literal "four guidance slides": the shipped flow is one scrolling guidance bullet phase PLUS a five-sub-view review carousel (Officer/Trooper, Do, Have, Say, Know) — richer than four slides, but not a literal four-slide structure. The firearm/say guidance is state-aware (duty-to-inform / no-duty / asked-only) sourced from the gun-laws adapter rather than a fixed ACLU script. Substance fully satisfies the claim; only the exact slide count/structure differs.

---

### C11 — 🟡 partial · _safety-routing_

**Claim:** A reworked safety modal presents a 2x2 grid of comprehensive safety options: pulled-over, roadside assistance, share location, and unfamiliar area.

**Thesis detail:** "This led to the development of a reworked safety modal featuring a two-by-two grid of comprehensive safety options: a pulled over flow, a roadside assistance modal, a share location modal, and an unfamiliar area modal." The thesis also splits an all-purpose safety tool (Share Trip) from an emergency tool (911/Trusted Contact).

**Expected implementation:** A safety modal laid out as a 2x2 grid with four entries (pulled over, roadside assistance, share location/trip, unfamiliar area), distinct from the emergency 911/trusted-contact tool.

**Evidence:** app/safety.tsx:61-90 (TABS array with exactly the four named entries: 'pulled-over', 'roadside', 'unfamiliar', 'share-location'); app/safety.tsx:141-173 (renders each tile in a grid); app/safety.tsx:242-255 (styles.grid uses flexDirection:'row' + flexWrap:'wrap', tab width fixed at 140pt — comment at L249-252 documents "Two tiles per row" → four tiles wrap to 2 rows of 2 = a 2x2 grid); app/_layout.tsx:29 (Stack.Screen name="safety" presentation:'modal'). Gap evidence: app/safety.tsx:76,82,88 (roadside/unfamiliar/share-location all href:null) and app/safety.tsx:104-108 (inert tiles fire an Alert "coming in a future update. For now, only Pulled-over is wired up."). No "Share Trip" or "911" surface exists anywhere (rg for "share trip"/"911" in app/ returns nothing).

**Notes:** The core claim is fully shipped: the reworked safety modal renders exactly the four named options (pulled-over, roadside assistance, share location, unfamiliar area) as a 2x2 grid (140pt tiles, row + flexWrap, two-per-row), presented as a bottom modal. Two gaps keep this from full "implemented": (1) Only the Pulled-over tile is wired to a real sub-flow (/pulled-over); roadside, unfamiliar, and share-location are href:null stubs that show a "coming in a future update" Alert and are dimmed to 0.5 opacity — so it's a grid of four entries but three are scaffolded, not functional. (2) The thesis's secondary assertion — splitting an all-purpose "Share Trip" tool from an emergency "911/Trusted Contact" tool — has no code: there is no "Share Trip" surface and no "911" reference anywhere in the app; trusted-contact call/text exists only inside the pulled-over state machine (app/pulled-over.tsx:984-1004), not as a distinct emergency tool split. The grid layout and four-option structure are real and shipped; the comprehensiveness (working sub-flows) and the emergency/all-purpose split are not.

---

### C12 — 🟡 partial · _brand/narrative_

**Claim:** Trips end with a post-trip summary where the user can validate or reject the inferences the app made, and which adapts after incidents.

**Thesis detail:** The established-user journey includes "a post-navigation summary that allows the user to validate or reject the inferences the app made along the route." After a traffic stop, "the app acknowledge[s] the jarring nature of the incident and presents an alternative route for the next commute." The summary embodies 'This is how we get better' — a transparent, confirm-what-was-inferred loop.

**Expected implementation:** A trip-summary screen presenting inferences the app made (e.g. detected zones/incidents) with accept/reject controls, and offering an alternative route for next time when an incident (like a stop) occurred. (Note: app/trip-summary.tsx exists untracked in the repo.)

**Evidence:** app/trip-summary.tsx:45-133 (single-view arrival recap modal: destination label, duration, distance, two buttons "Set as default" / "Keep current route"); app/_layout.tsx:46-49 (route registered as a modal). MISSING wiring: zero callers navigate to it — repo-wide grep for router.push('/trip-summary')/href found none; arrival handler app/en-route.tsx:437-442 only calls clearActiveRoute(), never opens the summary. MISSING inference loop: no validate/reject/accept controls anywhere (grep for validate|reject|inference returned only unrelated comments). MISSING persistence: app/trip-summary.tsx:74-79 "Set as default" is a TODO no-op-then-dismiss. MISSING incident adaptation: no traffic-stop/pulled-over branch and no "alternative route for next commute" (grep found nothing).

**Notes:** A trip-summary screen physically exists but only fulfills a thin slice of the claim and is not even wired into the flow. (1) The "validate or reject the inferences the app made" loop is entirely absent — the screen shows a route recap (time/distance) plus two route-default buttons, NOT inferred zones/incidents with accept/reject controls; there is no confirm-what-was-inferred UI in the codebase. (2) The "set as default" action is a no-op TODO (app/trip-summary.tsx:74-79), so even the route-preference half doesn't persist. (3) The "adapts after incidents — acknowledge the traffic stop and present an alternative route for the next commute" element has no code at all. (4) The screen is dead: registered in _layout but never pushed (en-route's arrived state only clears the active route). Net: scaffolded UI shell for a much narrower idea than the thesis claim; the brand/narrative "This is how we get better" inference-validation loop is a v2 gap.

---

### C13 — 🟢 implemented · _research-grounding_

**Claim:** The screen layer is independent of how data is fetched and how routes are scored (clean three-layer separation: adapters / scoring / screens).

**Thesis detail:** Step 3: "The screen layer renders. It calls on the adapters to fetch the information, hands those results to the scoring function, and displays the recommended route on the map. Screens are independent from how data is pulled and the scoring formula." This separation-of-concerns is the stated architecture and is echoed in CLAUDE.md (adapters / scoring / screens).

**Expected implementation:** Directory/module structure separating adapters (data fetching), scoring (route ranking), and screens (rendering), where screen components import scoring results and adapter outputs but contain no fetching or scoring logic themselves.

**Evidence:** lib/scoring.ts:1-4 (header asserts "Pure functions (no async, no I/O)"), :101 scoreRoute, :234 pickWinner — module has zero fetch/await/async/AsyncStorage (verified by grep). Adapters hold all I/O: lib/api/routes.ts (2 fetch calls to OSRM + 2 AsyncStorage for route cache), lib/api/zones.ts (1 fetch to Overpass), lib/api/community-reports.ts (4 AsyncStorage). Screens contain zero raw fetch() calls (grep over app/*.tsx returns 0). app/home.tsx:48 imports getRoutesBetween from lib/api/routes, :55 imports getZonesForRegion from lib/api/zones, :70 imports pickWinner from lib/scoring, :272 const routes = useMemo(() => pickWinner(rawRoutes, allZones), ...) — screen hands adapter outputs to the pure scorer. Same pattern in app/en-route.tsx:62,69 (adapter imports), :77-82 (scoring imports), :339 (pickWinner call). No SCORE_WEIGHTS or suncalc import appears in any screen (grep over app/ returns nothing), so no scoring math leaks into the render layer. scoring.ts only imports suncalc + types (not fetchers) from ./api/zones and ./api/routes (lib/scoring.ts:21,23-33).

**Notes:** Fully met. The directory naming differs from the thesis's literal labels (there is no folder literally named "adapters" or "scoring" — data fetching lives in lib/api/, scoring in lib/scoring.ts, daylight in lib/daylight.ts), but the separation-of-concerns the claim describes is real and enforced in code, and is documented identically in docs/architecture.md and CLAUDE.md. Verified directionally: I/O is confined to lib/api/* (fetch + AsyncStorage), the scoring module is provably pure (no async/fetch/await/AsyncStorage), and screens contain no fetching and no scoring math — they only import adapter functions and the pure pickWinner/scoreRoute and compose them via useMemo. The screen-to-scoring boundary is also reused by both primary map screens (home.tsx and en-route.tsx), confirming the layer is a genuine reusable seam rather than a one-off.

---

### C14 — 🟡 partial · _community-knowledge_

**Claim:** Edge markers (compass-style icons at the screen edge) point toward nearby places of interest, including Black-owned businesses.

**Thesis detail:** "Edge markers were directed compass icons at the screen edge pointing toward nearby places of interest, including Black-owned businesses." The map-directions tool also "located nearby places of interest and their general directions relative to current location." This carries the Green Book's affirmative (joy, Black-owned safe harbor) dimension, not just hazard avoidance.

**Expected implementation:** On the en-route map, edge-anchored directional compass markers that point to nearby POIs including Black-owned businesses, computed from current location and POI bearing.

**Evidence:** lib/edge-indicators.ts:79-120 (edgePositionForPoint: screen-edge anchor + atan2 bearing rotation from region center + POI latlng + viewport); lib/edge-indicators.ts:40-51 (isPointInRegion off-viewport test), :135-161 (groupEdgeIndicators by angular bearing); components/EdgeIndicator.tsx:61-142 (directional teardrop rotated rotation+90 to point at POI, upright counter-rotated glyph); components/EdgeIndicator.tsx:177-186,202-213 (explicit 'black-owned' edge marker: black teardrop, black circle, storefront glyph); app/home.tsx:1250-1316 (off-screen reportZones -> EdgeIndicator, variant=variantForCategoryId(reportCategoryId), categoryId passed through); components/LandmarkMarker.tsx:71-74 ('black-owned'->'black-owned'); lib/api/community-reports.ts:333-348 (reportToZone emits geometry:'point' + reportCategoryId incl 'black-owned'); app/home.tsx:954-956 (getCommunityReportsAsZones feeds reportZones); docs/architecture.md:200 (shipped). GAP: app/en-route.tsx:72 imports only the Region TYPE, not the EdgeIndicator/edgePositionForPoint/isPointInRegion utilities; en-route renders report zones only as in-viewport LandmarkMarker/ClusterMarker (app/en-route.tsx:978-1011) with no edge overlay. Only fetchNearestPlace caller is app/report.tsx:218 (returns a place name, not a direction).

**Notes:** The affirmative compass-marker mechanism is fully real and end-to-end on the /home map: a Black-owned business that is off-screen renders as an edge-anchored directional teardrop whose tip rotates to its true bearing (atan2) computed from the map center + POI latlng + viewport, carrying the black storefront glyph. This squarely fulfills the affirmative (Green Book safe-harbor / Black-owned) dimension. Two scope gaps keep it from full: (1) the thesis ties edge markers and "general directions relative to current location" to the EN-ROUTE / map-directions while-driving context, but app/en-route.tsx does NOT render edge markers at all (imports only the Region type) — off-screen POIs disappear while driving; the feature lives only on the static /home browse map. (2) The "located nearby places of interest and their general directions" map-directions tool is not implemented as a bearing/direction feature — fetchNearestPlace (app/report.tsx:218) only reverse-geocodes a nearest place name for report attribution, not a direction. So: affirmative compass markers incl. Black-owned = shipped; en-route/while-driving directional framing = missing.

---

### C15 — 🔴 missing · _brand/narrative_

**Claim:** The app's tone shifts with familiarity: early states confirm/ask about inferences (partner, not presumptuous); confident later (adaptive personalization).

**Thesis detail:** "Early user states are reserved for confirming what was inferred. As the user engages with the app more frequently, the tone switches from inquisitive to confident." The three user journeys (This is What I Do / How I Work / How I Improve) and the personalized home page ('custom home page... fit the needs and habits of the specific Black driver') encode this. Transparency separates a partner philosophy from a presumptuous one.

**Expected implementation:** Logic keyed to user familiarity/usage count that changes copy/behavior — e.g. inquisitive confirmation prompts for new users vs. confident pre-loaded suggestions for established users — plus a home screen that personalizes around the user's habitual routes.

**Evidence:** No familiarity/usage-count state exists: lib/api/user.ts:33-42 (User type = id, provider, displayName, email, initials, signedInAt only — no trip/session/usage counter). app/home.tsx:87 references the single "Established variant" (Figma 825:3625) as the ONLY home implemented — no early/new-user variant in code. app/home.tsx:1595 notes the home greeting ("Ready to face the day?") was DROPPED, removing the one tone-carrying surface. app/home.tsx:187 isRegularDestination = false hard-coded ("until feat/recent-trips lands a real frequency signal") — no habitual-route personalization. Closest existing logic is a binary onboarding gate, not a graduated tone shift: app/get-started.tsx:59,68 + hooks/useUser.ts:20-22 route first-time→/onboarding, returning→/home from storage presence; app/login.tsx:100 static "Welcome back" title. The three named journeys (This is What I Do / How I Work / How I Improve) appear nowhere — grep returns no matches; onboarding is 3 static fixed-copy panels (app/onboarding.tsx:107-143: drive/community/unique). No inference-confirming prompts for new users exist anywhere.

**Notes:** The central mechanism — copy/behavior keyed to user familiarity that shifts from inquisitive confirmation to confident pre-loaded suggestions — is absent. There is NO usage/trip/session counter to key tone on (lib/api/user.ts), and the only home variant shipped is the "Established" one. What partially exists: (1) a one-time binary onboarding gate (first-time→/onboarding vs returning→/home, get-started.tsx:59-68) plus a static "Welcome back" login title — a single fork, not a graduated inquisitive→confident progression, and it carries no confirmation-of-inference prompts; (2) shallow home personalization — first-name possessive eyebrow (HomeBrowseSheet.tsx:211-213), saved home/trusted-contact markers, neighborhood label, and community-report-driven recs in home.tsx — but explicitly NOT personalization around habitual routes (isRegularDestination hard-coded false, home.tsx:187). The three thesis journeys are pure narrative framing with no code counterpart. This is a real v2 gap: the adaptive-personalization / tone-shift-with-familiarity claim is narrative, not shipped.

---

### C16 — 🟡 partial · _brand/narrative_

**Claim:** Visual language is skeuomorphic and culturally specific: turn cards resemble interstate signs and zone markers resemble road signs, in a Fresh Greens design system distinct from Google Maps.

**Thesis detail:** "The turn cards were designed to resemble interstate signs... The zone markers were designed to resemble road signs." Zone entry "passively changed the speed limit component from its default white to the defining yellow of the Fresh Greens zone markers." The pivot explicitly rejected a 'corporate' Google-clone look for a design language "more inspired by the community I was designing for," with reserved color tokens.

**Expected implementation:** Custom-styled turn-card components evoking interstate signage and zone-marker components evoking road signs, driven by Fresh Greens theme tokens (theme/colors.ts etc.), including a speed-limit component that recolors (white→yellow) on zone entry.

**Evidence:** Turn cards (interstate-sign register, token-driven): app/en-route.tsx:1126-1218 (turnSign JSX), styles app/en-route.tsx:1599-1731 — wiltedgreen panel, 28pt rounded bottom, duotone turn-arrow, white instruction + fadedgreen street subtext, burntgreen "Then" footer (app/en-route.tsx:1237-1240, styles 1713-1731). All colors from theme/colors.ts (freshgreen/wiltedgreen/burntgreen/fadedgreen); theme/colors.ts:14 labels burntgreen as the turn-card "Then" footer. Zone markers (road-sign register): components/EnRouteZone.tsx:36-122 (62x50 yellow tail-shape Default marker + 158x50 Extended pill, default->extended swap on zone entry via app/en-route.tsx:1064); yellow-diamond hazard glyph SVGs in components/Hazard.tsx:25-44 (doc comment "yellow diamond + black glyph"). Zone-entry detection at app/en-route.tsx:370-377 (enteredZoneIds). Brand-distinct narrative: .cursorrules:27-38 reserved-color rule + theme/colors.ts:11-25 reserved tokens. MISSING piece — speed-limit recolor: SpeedLimit sign at app/en-route.tsx:1273-1292 uses static styles; speedLimitCurrentPill is always colors.white (app/en-route.tsx:1763) and speedLimitSign is always colors.yellow (app/en-route.tsx:1793). Neither consumes enteredZoneIds; grep of app/components/lib for speed-limit-by-zone wiring returns nothing (exit 1).

**Notes:** Two of three sub-claims are fully shipped: (1) interstate-style turn cards and (2) road-sign-style zone markers, both token-driven and visually distinct from a Google-Maps clone — the brand-distinct/reserved-color framing is real in code (.cursorrules + theme/colors.ts). The specific thesis DETAIL — that zone entry "passively changed the speed limit component from its default white to the defining yellow" — is NOT implemented. The on-screen speed-limit sign (app/en-route.tsx:1273-1292) is statically yellow regardless of zone state; the white element above it is a separate current-speed pill, not a default state that flips to yellow. Zone-entry state (enteredZoneIds) is wired to the EnRouteZone default->extended swap and the hazard-panel auto-expand, but never to the speed-limit component. So the headline visual-language claim holds while the named speed-limit-recolor behavior is a v2 gap.

---

### C17 — 🔴 missing · _daylight_

**Claim:** Checkpoints (pre-planned rest stops) are inserted at intervals for long-haul trips over three hours, and ETA can toggle between destination and next checkpoint.

**Thesis detail:** "A checkpoint is a pre-planned rest-stop placed at intervals for trips exceeding three hours." The ETA "displayed the estimated time of arrival for the destination, but on tap triggers a switch to the estimated time of arrival of a checkpoint." This reflects the Light marker (arrive before dark) and the long-haul vs short-drive state distinction.

**Expected implementation:** Logic that, for routes >3 hours, places rest-stop checkpoints at intervals and renders them; an ETA control that toggles between destination ETA and next-checkpoint ETA on tap.

**Evidence:** No checkpoint/rest-stop code exists: case-insensitive ripgrep for `checkpoint`, `rest-stop`, `long-haul`, `next-stop`/`nextStop` across app/, lib/, components/, hooks/ returns zero matches. ETA is a non-interactive plain Text element with no tap handler: app/en-route.tsx:1466-1477 (`<Text style={styles.eta}>` — not a Pressable, no onPress). The ETA value (app/en-route.tsx:587-605, `arrivalDisplay`) only ever computes destination arrival from `recommended.estimatedMinutes`; there is no checkpoint ETA and no toggle. The only 3-hour figure in the codebase (lib/daylight.ts:253, `minutesUntil > 180`) caps an unrelated "suggest a daylight-friendly departure time" feature, not a long-haul checkpoint trigger.

**Notes:** Both load-bearing halves of C17 are absent: (1) no logic detects routes >3h or inserts/renders interval rest-stop checkpoints; (2) the ETA cannot toggle — it is a static Text with no onPress and only one (destination) value. The thesis's secondary "Light marker (arrive before dark)" idea IS partially realized via the sun/moon ETA glyph and the daylight polyline gradient, but that is a different feature from the checkpoint mechanism the claim describes. No checkpoint item appears in docs/next-session.md backlog either, so it is not even a tracked deferral. Verifiable against code (not pure narrative) — and the code does not fulfill it.

---

### C18 — 🟡 partial · _accessibility_

**Claim:** Zone display has a hard limit (max two zones at once) and uses non-color-dependent distinction, accounting for accessibility and stressed drivers.

**Thesis detail:** After rejecting multi-color (memorization burden, cultural variance, negative emotional load) and single-color-opacity (not distinct enough), the design landed on a zone limit: "a maximum of two zones could be displayed at once," with stroke/marker distinction. Claude's probing centered on "interview data and accessibility" and the risk of "negative feelings that certain colors can impart on drivers in a stressful environment."

**Expected implementation:** Rendering code that caps concurrent displayed zones at two and distinguishes priority by means beyond hue alone (stroke style, marker shape), avoiding reliance on arbitrary color coding that requires memorization.

**Evidence:** NON-COLOR DISTINCTION (shipped): lib/api/zones.ts:307-311 zoneDashPattern (safe=solid, caution=[10,5] long-dash, avoid=[3,3] short-dash) with WCAG 1.4.1 / Apple HIG justification at zones.ts:291-306; applied via lineDashPattern at app/en-route.tsx:953,965 and app/home.tsx:1023,1035; per-category SHAPE/glyph markers (not hue) in components/EnRouteZone.tsx:92-122 (lighting/road/wildlife/community-alert SVGs). "TWO" CAP (reframed, not zone-display): app/en-route.tsx:457-463 turnHazards = hazardsNearTurn(...).slice(0,2) "Capped at 2"; lib/scoring.ts:273-312 HAZARD_SEVERITY worst-first ordering + hazardsNearTurn; documented as "A turn shows at most two symbols at once" in docs/architecture.md:178. NO CAP on map zone overlays: app/en-route.tsx:944-970 allZones.map (renders every region zone) and app/home.tsx:1011-1042 osmZones.map; en-route markers app/en-route.tsx:1063-1082 enRouteZones.map also uncapped.

**Notes:** Partial. The non-color-dependent half is genuinely and thoroughly shipped: distinct line-dash patterns per ZoneType (explicitly for red-green CVD per WCAG 1.4.1) plus shape-based per-category marker glyphs, so distinction never relies on hue alone. Caveat: lineDashPattern is iOS-only and silently no-ops on Android (zones.ts:303-305) — acceptable for an iPhone-first project but means the non-color cue degrades to color-only on Android. The "hard limit of max two zones displayed at once" half does NOT match what shipped. The thesis decision ("a maximum of two zones could be displayed at once") was reframed into a cap of at most TWO HAZARD SYMBOLS on the turn card (slice(0,2), severity-ordered), per docs/architecture.md:178 — not a cap on zones drawn on the map. The actual on-map zone overlays (allZones.map / osmZones.map) and en-route zone markers (enRouteZones.map) render every caution/avoid zone in the region with no two-at-a-time limit. So the "two" cap exists in code but governs glyph chips on a card, not concurrent zone display. This is a v2 gap worth surfacing: the accessibility intent is met; the literal max-two-zone-display rule is not implemented as the thesis states.

---

## v2 roadmap (thesis-grounded)

Every missing or partial claim becomes a grounded backlog item. This is the v2 vision the thesis already describes — not invented scope.

### [HIGH] No emergency/SOS control and no 911 path at all — the entire institutional-help half of the safety thesis is narrative-only.

- **Thesis claim:** C8: SOS offers a choice between calling a trusted contact (tap→3s countdown) and 911 (long-press→fill red), reflecting police-wariness. C9: trusted-contact graph encodes BOTH community and institutional coping paths.
- **Suggested work:** Build a dedicated SOS control with two distinct gestures: single tap → 3s cancelable countdown → tel: trusted contact; long-press → button fills red → tel:911 on completion. Reuse the existing useTrustedContact hook for the community side; add the 911 path as a deliberate, separately-styled affordance. Surface it from /safety and/or /en-route. This closes both C8 and the missing institutional half of C9 in one component.

### [HIGH] Trip-summary screen exists but is unreachable, persists nothing, and shows no inference-validation loop or post-incident route adaptation.

- **Thesis claim:** C12: trips end with a post-trip summary where the user validates/rejects the inferences the app made, and which adapts after incidents ('This is how we get better').
- **Suggested work:** (1) Wire navigation: have the /en-route arrived handler (en-route.tsx:437-442) push /trip-summary instead of only clearing the active route. (2) Add the inference-validation UI: list zones/incidents the app detected along the route with accept/reject controls, persisting accepted inferences. (3) Make 'Set as default' actually persist (currently a no-op TODO at trip-summary.tsx:74-79). (4) Add a post-stop branch that acknowledges a traffic stop and proposes an alternative route next time.

### [MED] No usage/familiarity state — tone never shifts from inquisitive to confident, the three named journeys don't exist, and the home page isn't personalized around habitual routes.

- **Thesis claim:** C15: tone shifts with familiarity (partner, not presumptuous → confident); three journeys (This is What I Do / How I Work / How I Improve); home personalizes around the user's habits.
- **Suggested work:** Add a trip/session counter to the User adapter (user.ts:33-42). Replace the hard-coded isRegularDestination=false (home.tsx:187) with a real frequency signal from a recent-trips store. Introduce at least one early-user home variant with inference-confirming prompts alongside the existing 'Established' variant, keyed on the counter. This is the largest v2 narrative lift and unlocks the thesis's adaptive-personalization spine.

### [MED] Safety modal grid is structurally correct but only 1 of 4 tiles works; the Share-Trip vs 911/Trusted-Contact split is absent.

- **Thesis claim:** C11: 2x2 grid of comprehensive safety options, plus a split between an all-purpose Share Trip tool and an emergency 911/Trusted-Contact tool.
- **Suggested work:** Build the three stubbed sub-flows (roadside assistance, unfamiliar area, share location/trip — currently href:null at safety.tsx:76,82,88). Implement Share Trip as the all-purpose tool and pair it with the C8 emergency SOS to realize the all-purpose-vs-emergency split the thesis describes.

### [MED] Zone warnings fire at the moment of entry (~20-200m), not ~1 mile ahead, and copy is zone-length / literal labels rather than non-stigmatizing distance-ahead phrasing.

- **Thesis claim:** C7: zones warn ~1mi before entry using copy like 'Increased police presence in 0.9 mi' rather than fixed labels like 'Police zone'.
- **Suggested work:** Add distance-to-zone-entry math (project user position against upcoming zone boundary along the route polyline) and trigger an advance warning at ~1mi. Replace the literal 'police zone' chip (home.tsx:1804) and the 'For X mi.' baked-in pill with computed non-stigmatizing distance-ahead copy. Reuse isPointInZone geometry but compute approach distance, not just containment.

### [LOW] Edge compass markers ship only on the static /home browse map, not en-route; off-screen POIs disappear while driving. The map-directions 'general directions relative to current location' tool isn't a bearing feature.

- **Thesis claim:** C14: edge markers point toward nearby POIs incl. Black-owned businesses, tied to the en-route / while-driving directional context.
- **Suggested work:** Import edgePositionForPoint/isPointInRegion/EdgeIndicator into app/en-route.tsx (currently only the Region type is imported) and render edge markers for off-viewport POIs during navigation, so Black-owned safe-harbors stay visible while driving — the affirmative Green Book dimension where it matters most.

### [LOW] Named speed-limit white→yellow recolor on zone entry not implemented (the visual-language headline ships, this specific behavior doesn't).

- **Thesis claim:** C16: zone entry passively changes the speed-limit component from default white to the defining Fresh Greens yellow.
- **Suggested work:** Wire the already-computed enteredZoneIds (en-route.tsx:370) into the speedLimitCurrentPill / speedLimitSign styles (1762,1792) so the component recolors white→yellow when the user is inside a caution/avoid zone, matching the marker-swap that enteredZoneIds already drives.

### [LOW] No checkpoint/rest-stop logic for >3h trips and ETA is a static, non-interactive Text with a single destination value.

- **Thesis claim:** C17: checkpoints inserted at intervals for trips >3h; ETA toggles between destination and next checkpoint on tap.
- **Suggested work:** Detect routes whose estimatedMinutes>180, place rest-stop checkpoints at intervals (lean on POI/recommendations catalog for real stops), render them on the route, and convert the ETA Text (en-route.tsx:1466-1477) into a Pressable that toggles destination ETA ↔ next-checkpoint ETA. Reinforces the 'arrive before dark' Light marker.

### [LOW] The literal 'max two zones displayed at once' cap governs hazard glyphs on the turn card, not concurrent on-map zone overlays, which render uncapped.

- **Thesis claim:** C18: zone display has a hard limit of max two zones at once (the non-color distinction half is fully shipped).
- **Suggested work:** If the thesis's literal rule still holds, apply a severity-ordered slice(0,2) to the on-map zone renderers (allZones.map / osmZones.map / enRouteZones.map at en-route.tsx:945,1063 and home.tsx:1012) so at most two zones draw concurrently. Alternatively, document the reframe (cap moved to turn-card glyphs) as a deliberate design evolution. Note: dash patterns are iOS-only and no-op on Android.

---

## Scope drift

Shipped features cross-referenced against the claims. Most are defensible (infrastructure or direct extensions); the genuine drift candidates are flagged.

- **Four-tier routing source ladder (Mapbox→OSRM→cache→mock, routes.ts)** — Defensible. The thesis names only OSRM (C3); the extra tiers are production-hardening of the same routes-adapter claim. Mapbox-primary gives real traffic/lane data the thesis didn't anticipate but doesn't contradict.
- **Offline active-route cache (route-cache.ts)** — Defensible — indirectly serves C1/C3. Explicitly framed as the 'digital Green Book parallel' (survives rural/tunnel signal loss). Infrastructure that keeps the safety-routed trip alive when connectivity drops; on-thesis even though no claim names it.
- **Lane guidance strip (LaneStrip.tsx)** — Mild drift. Apple/Mapbox-parity navigation polish with no thesis claim behind it. The thesis explicitly contrasts Fresh Greens with mainstream nav 'in its function rather than its aesthetic' — lane guidance is mainstream-nav function. Defensible as table-stakes usability, but it's the clearest example of building toward Google-Maps parity rather than the countermapping thesis.
- **State-aware firearm disclosure guidance (gun-laws.ts + useDisclosureDuty)** — Defensible — deepens C10. Not in the thesis text but a direct, research-flavored extension of the pulled-over flow's 'what to say' content; serves the same Black-driver-safety intent with real per-state legal grounding.
- **Audio recording capture + library (/recordings)** — Defensible — extends C10. The pulled-over flow's recording has to land somewhere; a review/library surface is the natural completion of that claim, not new scope.
- **Weather + driving-conditions card (weather.ts)** — Drift. No thesis claim covers weather/driving conditions. Open-Meteo tier (easy/moderate/tough) is reasonable safety-adjacent context but traces to no interview finding or thesis marker in the provided set — candidate to justify against research or cut.
- **Apple Sign In + local identity (user.ts, get-started/login)** — Defensible infrastructure. No claim names auth, but identity is the precondition for the personalization the thesis does claim (C15) and for trusted-contact storage. Note the irony: the identity layer exists but the C15 familiarity/tone system it would key on does not.
- **Address + POI search (search.tsx, places.ts)** — Defensible infrastructure. A navigation app needs destination entry; this is table-stakes plumbing for every routing claim (C1) rather than independent scope.
- **Recommendations browse sheet + 'Trusted by your community' row** — Defensible — serves C14's affirmative Green Book dimension. The curated Black-owned/identity-chip catalog (black-owned, women-owned, LGBTQ+, restrooms, late-night) carries the joy/safe-harbor half of the thesis even though C14 is framed narrowly around edge markers.
- **Custom map markers + clustering (LandmarkMarker, ClusterMarker)** — Defensible — serves C16 (culturally-specific visual language) and C18 (clustering reduces visual load for stressed drivers). On-thesis rendering infrastructure.

---

## Portfolio paragraph (ready to use)

> I tested whether the shipped v1 actually fulfilled what my six interviews and the thesis surfaced, auditing eighteen extracted claims against the code line by line. Eight ship fully end-to-end, six are partial, and four remain narrative-only — and the split is telling: the technical spine is real, while the gaps sit in the aspirational v2 surfaces. The strongest interview-to-feature traces all hold. The countermapping thesis — that lived community knowledge should carry the same weight as institutional data — is literal in code: reportToZone() turns a driver's report into the exact same Zone shape as OpenStreetMap infrastructure, and the scorer weights them identically. The police-wariness finding produced a working pulled-over flow with ambient recording and ACLU-aligned rights. And routing-by-safety-not-speed is genuine: the app re-ranks real candidate routes by a safety score and recommends the safest, not the fastest. What I deferred — an SOS/911 split, the inference-validation trip summary, and familiarity-driven tone — I can name precisely, because I measured against my own research rather than around it.

---

## Shipped feature inventory (reference)

The inventory the audit cross-referenced for scope drift.

- **Safety-weighted multi-route selection (route scoring)** (lib/scoring.ts + lib/api/routes.ts, consumed by app/home.tsx) — Scores every candidate route against zone data (per-waypoint dispatch: in-polygon for areas, near-polyline for streets, point-to-point for points) using SCORE_WEIGHTS (safe +2, caution -1, avoid -5), then pickWinner ranks them and marks the highest-scoring path 'recommended' rather than just the fastest — the core technical thesis claim that routes maximize lighting/daylight/safe zones.
- **Four-tier routing source ladder** (lib/api/routes.ts) — Fetches real driving routes via Mapbox Directions (primary, traffic-aware + lane data) with automatic fallback to OSRM, then AsyncStorage cache, then a synthetic mock, all returning an identical Route[] shape tagged with its source so the UI can flag offline/demo routes.
- **Daylight gradient on the route polyline** (lib/daylight.ts, rendered on app/home.tsx) — Pure SunCalc-driven function that splits the route into 5 segments and colors each by real minutes-to-sunset (orange to mauve to indigo) based on departure time, lat/lng, and travel time — the documented reserved-color exception that visually encodes light loss along the trip.
- **Schedule-for-daylight departure suggestion** (lib/daylight.ts (suggestedDepartureForDaylight) + lib/notifications.ts + app/home.tsx) — Computes whether leaving later genuinely buys more daylight (e.g. pre-sunrise departures get sunrise+15min, capped 3hr look-ahead) and surfaces a 'Schedule for 7:38 AM' chip that can fire a local expo-notifications departure reminder; hidden entirely when no meaningful suggestion exists.
- **OSM zone data adapter (six safety categories)** (lib/api/zones.ts) — Calls the Overpass API and returns typed Zone[] with discriminated geometry (polygon/polyline/point) across lighting, landuse, parks, police, wildlife, and road-condition categories — plus community-report points — feeding both the scoring layer and the on-map overlay.
- **Time-of-day wildlife score amplification** (lib/scoring.ts) — Per-category modulation that doubles the penalty of wildlife zones at dawn/dusk (within 30 min of sunrise/sunset computed by SunCalc against the zone's coordinates and the trip's departureTime), keeping time-aware logic in scoring where trip context lives rather than in the zones adapter.
- **Zone overlay user preference** (lib/api/preferences.ts + hooks/usePreferences.ts + app/menu.tsx + app/home.tsx) — AsyncStorage-backed showZones toggle wired through a Zone Settings accordion in /menu; /home reads the preference to render or hide the on-map zone overlay, replacing the old debug-only SHOW_ZONES constant with a real setting.
- **En-route hazard notice on turn cards** (lib/scoring.ts (hazardsNearTurn) + components/Hazard.tsx + app/en-route.tsx) — Pure helper returns the set of hazard categories (lighting/police/wildlife/road-condition, plus community reports) crossing a saturation threshold near a turn; the turn card renders up to two worst-first hazard glyphs so the recommended-but-not-hazard-free route stays honest mid-drive.
- **On-map zone-entry pill (distance-to-end-of-zone)** (components/EnRouteZone.tsx + app/en-route.tsx) — On-map zone markers swap from a compact hazard badge to an extended 'For X mi.' pill when the user enters a caution/avoid zone (point-in-polygon against live location), communicating how far the hazard extends; auto-expands the sheet with a warning haptic on entry.
- **Real turn-by-turn navigation with monotonic step tracking** (app/en-route.tsx + lib/api/routes.ts) — Parses Mapbox/OSRM step geometry + banner instructions into maneuver-typed turn instructions; findNextStep advances through the ordered sequence with a monotonic min-index clamp so GPS jitter can't re-select a maneuver the driver already passed.
- **Lane guidance strip** (components/LaneStrip.tsx + lib/api/routes.ts) — Apple Maps-style row of lane cells at the top of the en-route turn card that highlights which lanes the driver should occupy for the upcoming maneuver, parsed from Mapbox lane components (active_direction) and animated in/out with reduce-motion gating.
- **Offline active-route cache** (lib/api/route-cache.ts) — Single-slot, destination-keyed (grid-rounded ~50m), 24hr-TTL AsyncStorage cache of the last successful route+steps so /en-route survives mid-trip signal loss in rural/tunnel areas — the digital Green Book parallel; write-gated on wantSteps so cheap stepless previews can't downgrade a navigation-grade cached route.
- **Community reporting flow** (app/report.tsx + lib/api/community-reports.ts) — AsyncStorage-backed report modal (picker to detail to thank-you) with six scored categories, optional place sub-tags, and anonymity auto-on for sensitive categories; submissions become community-report Zones that flow through the same scoring pipeline and surface as map markers.
- **Pulled-over safety flow (5-phase state machine)** (app/pulled-over.tsx) — Single consolidated modal running armed-question to transition to guidance to contact to review (Officer/Trooper, Do/Have/Say/Know), with ambient audio recording started on the armed answer, read-aloud via expo-speech, and a usePreventRemove save lifecycle that blocks dismiss until recording is stopped and persisted — the core cultural thesis claim.
- **State-aware firearm disclosure guidance** (lib/api/gun-laws.ts + hooks/useDisclosureDuty.ts + app/pulled-over.tsx) — Maps every US state + DC to one of three disclosure-duty variants (duty-to-inform / no-duty / asked-only), resolves the user's state via on-device reverseGeocodeAsync, and tailors the firearm guidance + What-to-Say bullets; defaults to duty-to-inform on any failure since over-disclosure is the safer error.
- **Trusted-contact graph + notification** (lib/api/trusted-contact.ts + hooks/useTrustedContact.ts + app/trusted-contact-setup.tsx + components/TrustedContactStatus.tsx) — iOS-native contact picker (expo-contacts) stores a trusted contact (name/initials/phone, optional geocoded lat/lng); the pulled-over flow shows a pulsing 'being notified' status and real Call/Text via Linking tel:/sms:, with mid-stop recovery when no contact was set during onboarding.
- **Trusted-friend map marker + edge indicator** (app/home.tsx + components/LandmarkMarker.tsx + components/EdgeIndicator.tsx + lib/edge-indicators.ts) — When the trusted contact has a geocoded location, /home renders a green landmark pin for the friend plus an off-viewport edge indicator (bearing + ray-rectangle intersection) that points to and recenters on the friend — encoding the 'community-shaped data' claim on the map.
- **Audio recording capture + library** (lib/api/recordings.ts + hooks/useRecordings.ts + app/recordings.tsx) — expo-audio metering-driven recordings saved from the pulled-over flow (file in Paths.document + metadata in AsyncStorage), listed newest-first in /recordings with a single shared player, per-row delete, and live waveform during capture; reached via /safety-settings.
- **Custom map markers + clustering** (components/LandmarkMarker.tsx + components/ClusterMarker.tsx + lib/clustering.ts + lib/api/saved-places.ts + hooks/useSavedPlaces.ts) — Four-variant illustrated pins (black-owned/positive/orange-hazard) whose glyph mirrors the report category, a long-press-to-save home place, and pure screen-space clustering that collapses dense point zones into count-badged clusters at low zoom with fit-bounds zoom on tap.
- **Recommendations browse sheet (three-source hybrid)** (lib/api/recommendations.ts + hooks/useRecommendationsBatch.ts + components/HomeBrowseSheet.tsx) — Around-Me browse mode powered by a curated Green Book-style catalog + community reports + an external feed stub, deduped by proximity, organized into a multi-row layout led by a 'Trusted by your community' row that routes community submissions to identity chips (black-owned, women-owned, LGBTQ+, restrooms, late-night).
- **Weather + driving-conditions card** (lib/api/weather.ts + hooks/useWeather.ts + components/HomeBrowseSheet.tsx) — Open-Meteo (keyless) adapter returns current temperature plus a derived easy/moderate/tough driving-condition tier combining precipitation, wind, and visibility, displayed on the home browse sheet.
- **Address + POI search** (app/search.tsx + lib/api/places.ts + lib/api/recent-searches.ts + hooks/useRecentSearches.ts) — Type-aware Mapbox Search Box (v6) forward geocoding for both named POIs and street addresses with debounced autocomplete and distance-from-user, a Quick Tools filter row, and persisted recent searches.
- **Apple Sign In + local identity** (lib/api/user.ts + hooks/useUser.ts + app/get-started.tsx + app/login.tsx + app/index.tsx) — Real Apple Sign In (expo-apple-authentication) with an AsyncStorage user adapter (id/provider/displayName/email/initials) that merges Apple's first-sign-in-only name/email; returning signed-in users auto-skip onboarding straight to /home.
- **Onboarding + permissions + contact setup flow** (app/onboarding.tsx + app/permissions.tsx + app/trusted-contact-setup.tsx) — Five-page intro: three swipeable thesis-framing panels, a real expo-location + expo-audio (mic) permission flow with Settings deep-link on denial, and the trusted-contact picker — all skippable with downstream recovery affordances.
- **Settings hub + safety settings** (app/menu.tsx + app/safety-settings.tsx + app/sign-out.tsx) — Waze-flavored /menu (profile hero, Zone Settings accordion, Safety row, quick-settings carousel, sign-out that clears user + trusted contact) plus a /safety-settings screen hosting Trusted Contact re-pick and a Recordings entry showing the saved-capture count.
- **User location heading wedge** (components/UserLocationMarker.tsx + app/home.tsx) — Apple Maps-style translucent systemBlue heading wedge fanning forward from the user-location dot in the facing direction, hidden when heading is null or speed is below 0.5 m/s so it never shows unreliable direction at rest.
- **Trip summary recap modal** (app/trip-summary.tsx) — Post-trip pop-up shown on en-route arrival that recaps the route just driven (destination, distance, duration) and offers route-disposition actions (set as default / keep current), built on the pulled-over modal shell as an expo-router modal.
- **Safety modal entry hub** (app/safety.tsx) — 2x2 tab-grid modal reached from the en-route navy duotone Shield; the 'I was pulled over' tile launches the full pulled-over flow (the other three tiles are scaffolded/inert), serving as the entry point to the safety surfaces.
