---
target: app/home.tsx
phase1_score: 36
phase1_p0: 0
phase1_p1: 2
closeout_score: 36
closeout_p0: 0
closeout_p1: 2
slug: app-home-tsx
phase: closeout
---

## Then vs now

**Phase 1 (2026-06-19 re-baseline):** 36/40 · 0 P0, 2 P1, 2 P2, 2 P3 (6 priority findings).
**Closeout:** 36/40 · 0 P0, 2 P1, 2 P2, 2 P3 (6 priority findings). Net delta: **0**.

`app/home.tsx` was not edited between Phase 1 and the closeout. The last commit touching this file is `27bde39` ("polish(home): critique fixes — route-check retry, coaching voice, discoverability") — PR #231, which closed out Sprint 1 and is the commit the Phase 1 re-baseline was taken against. `git log 27bde39..HEAD -- app/home.tsx` is empty. The four PRs Phase 2/3 shipped on top of that baseline — PR #233 (useHydratedState), PR #234 (useMutation), PR #235 (SafetyErrorMessage + error taxonomy), and the Phase 3 a11y/dismissal/Dynamic Type work routed through #236, #241, #242, #246 — all landed in adjacent surfaces (safety sub-flows, saved-places, route-comparison, en-route, pulled-over, roadside). home.tsx is the largest screen file in the project and was triaged off the Phase 3 critical path on purpose; this closeout reflects that.

The honest read: the screen didn't regress and it didn't pick up the conventions the rest of the app now ships with. The two P1s named in Phase 1 — chip tap-affordance absent for sighted users and the "Heads up!" alarm-register exclamation — are still there in exactly the form Phase 1 described. The Phase 2/3 conventions home would have inherited had the work reached this file are Dynamic Type pressure-tests on the route-preview card's 34/15/13/12pt ladder, the `label = noun, hint = present-tense outcome` VoiceOver rule from PR #242 applied to RouteWarningChip / RouteSafeChip / route-cycle chevrons, and the painted-X dismissal convention from PR #241 applied to the placement-mode bar. None of those landed. The screen still scores 36 because the gaps already counted in Phase 1 are the same gaps; nothing got worse and the conventions it missed weren't the ones holding it back from a higher score in the first place.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Unchanged — route-check chip ladder (loading → retry → all-clear / hazards) still well-communicated; Recenter FAB still has no visible "waiting for GPS" state for sighted users |
| 2 | Match System / Real World | 4 | Unchanged — "Along this route:" briefing register still correct; "community flag" chip label still domain-opaque |
| 3 | User Control and Freedom | 4 | Unchanged — clear-destination X still 44pt; long-press-to-remove on community pins still has zero discoverability |
| 4 | Consistency and Standards | 4 | **Drifted from the new convention without losing the Phase 1 score** — PR #241 codified painted-X dismissal and applied it to /route-comparison; the placement-mode bar on home still uses a 48pt Cancel button while the route-preview Clear-destination is 44pt. PR #242 codified the noun-label + hint-outcome VoiceOver rule; RouteWarningChip and RouteSafeChip still set a single combined `accessibilityLabel` on the row with no per-chip hints. Token discipline still watertight |
| 5 | Error Prevention | 4 | Unchanged — `suppressNextMapPressRef` still load-bearing; suggested-departure past-time still reactive not preventive |
| 6 | Recognition Rather Than Recall | 4 | Unchanged — map coach still helps first-time users; hazard chips still tappable with no chevron, no underline, no press-state change beyond `pressedDim` |
| 7 | Flexibility and Efficiency | 4 | Unchanged — route cycling via chevrons still efficient; chip-tap jump-link still works for the users who discover it |
| 8 | Aesthetic and Minimalist Design | 3 | Unchanged — type ladder on the route-preview card still earns its density; "Heads up!" suggested-departure copy still breaks the Steady Companion register |
| 9 | Error Recovery | 3 | Unchanged — retry chip and long-press confirmation still well-executed; weather error card "—°" still ambiguous between "no data" and "tap to retry" |
| 10 | Help and Documentation | 2 | Unchanged — map coach still fires once with no re-entry path; the "Map guide" menu row Phase 1 proposed still doesn't exist |
| **Total** | | **36/40** | **Good — held its Phase 1 score by inertia. Same gaps, same priorities. The H4 score is now sharper because the rest of the app moved on without it.** |

## Anti-Patterns Verdict

**Clean. No AI slop detected.** Same verdict as Phase 1, same evidence.

Reserved-color discipline still watertight: orange on hazard chips, fadedgreen/burntgreen on safe chips and all-clear, freshgreen on primary CTAs only. `Star` icon in trusted-station row still `burntgreen` (correctly avoiding the yellow-only-for-saved-favorite carve-out). `RouteAllClearChip` still a `View` not a `Pressable` (semantically correct — status, not action). No gradient text, glassmorphism, decorative fills. No alarm-register copy except the still-isolated "Heads up!" discussed under H8.

The slop test passes for the same reason the safety-screen closeout passed it: the bigger reflexes were caught earlier. The "Steady Companion" register on chips, the briefing-not-alarm phrasing on the hazard row, the muted-standard map style, the non-interactive status chip — these are the choices that would have been slop tells had they defaulted. They held through Phase 3 by not being touched.

## Cognitive Load

Unchanged from Phase 1.

**Browse mode (no destination): Low-to-moderate.** Sheet's collapsed-by-default recommendation section still the right call. Three-piece header stack (eyebrow / neighborhood / weather) still serves three distinct temporal questions in compact space. Sticky category chips still well-placed. Progressive disclosure on "Show all categories" still appropriate.

**Route-preview mode (destination set): Moderate.** Still 9–11 information atoms before Go. Type ladder still does the triage work. The risk Phase 1 named — in-car or time-pressured parsing overwhelming a user who hasn't internalized the card's vocabulary — is still present, and is now the closeout's largest unaddressed load risk because Phase 2/3 didn't ship the Dynamic Type pressure-tests on the 34/15/13/12pt ladder that would have surfaced it. At accessibility-large text sizes the ladder compresses; the card hasn't been stress-tested against that.

**Detail card layer (RouteHazardDetailCard): Low.** Unchanged.

## Emotional Journey

Same arc as Phase 1, same edges. Cold start → browse → search → route established → hazard chips load → charged moment all still land in the registers Phase 1 named: grounded, reassured, informed-not-frightened, acknowledged.

The closeout-specific note matches the pattern seen on `/safety`: **the sub-flows the home surface routes into are now noticeably better than the home surface itself.** /en-route picked up VoiceOver hint depth (PR #242). /pulled-over picked up a 44pt stop-recording control and a terminal recording-saved state. /roadside picked up X-dismissal + hold-to-confirm SOS (PR #246). The home → route → en-route arc therefore crosses a polish boundary mid-trip. The user starts on the largest-but-least-recently-polished surface in the app and walks into screens that are more carefully held than the door they entered through.

The charged-moment read is still composed: "Along this route: 1 police zone" still briefing-not-alarm; tap chip → focus map → detail card → "Manage in Zone Preferences" still gives data without editorializing; destination breadcrumb still keeps spatial context. This is still the screen earning the thesis's hardest moment, and that hasn't drifted.

## What's Working

**1. Reserved-color discipline still watertight.** Same evidence as Phase 1. Every orange, red, yellow, navy instance traces to a documented carve-out. Worth re-stating in the closeout because the Phase 2/3 work explicitly tested this boundary on adjacent surfaces (PR #242 on en-route and pulled-over) and home's hazard chip palette is the convention those surfaces inherit from.

**2. Route-preview card's type ladder still earns its density.** Same evidence as Phase 1. `largeTitleEmphasized` ETA still dominant enough for a single-glance read; entrance haptic + fade still gives the ETA reveal real weight.

**3. Map coach + zone visibility architecture still sound.** Coach fires once, zone overlays off by default, `zonesVisibleAtZoom` guard still prevents polygon-at-zoom-out misread. The "no re-entry path after dismissal" gap (H10) is still the cost of this architecture and still unaddressed.

## Priority Issues

All six findings carry over from Phase 1 unchanged. Same fixes, same severities, same order.

**[P1] Route hazard chips have no tap affordance.** Unchanged from Phase 1. `RouteWarningChip` and `RouteSafeChip` still `Pressable` with no chevron, no underline, no press-state change beyond `pressedDim`. VoiceOver users still better served than sighted users — an inversion that the Phase 2/3 a11y work on adjacent surfaces (en-route, pulled-over) makes sharper rather than narrower. Fix unchanged: trailing 16pt `CaretRight` inside each chip, matching the destination breadcrumb pattern in `RouteHazardDetailCard`.

**[P1] "Heads up!" exclamation still breaks the Steady Companion register.** Unchanged. Still the only instance of alarm-register punctuation in the route-preview card. Fix unchanged: `"You can leave a little later and still arrive with more daylight on this route."`

**[P2] No-destination GPS wait state still invisible to sighted users.** Unchanged. Recenter FAB still renders the same glyph in "GPS ready" and "GPS acquiring." `accessibilityLabel` still correct for VoiceOver. Fix unchanged: small `ActivityIndicator` or pulsing animation when `!userLocation`, with `reduceMotion` guard.

**[P2] Map coach still permanently unrecoverable after first dismissal.** Unchanged. `useCoachMark('home-map-intro')` still one-shot. Fix unchanged: "Map guide" row in /menu's settings list, two-line change. (Worth re-flagging because /menu was touched in PR #236 for the `savedPlacesValue` change — the door was open and this didn't ride along.)

**[P3] "Community flag" chip label still domain-opaque.** Unchanged. `ROUTE_HAZARD_LABEL` for `community` still renders "1 community flag." Fix unchanged: rename to `['community report', 'community reports']`.

**[P3] Placement-mode hint text still subtly contradictory.** Unchanged. `"Tap the map to move the pin. Drag to move around."` still describes panning, which a user reading literally will try to apply to the pin. Fix unchanged: `"Tap anywhere on the map to move the pin."`

## Persona Red Flags

**Sam (accessibility — VoiceOver user):** Phase 1's read holds. Screen still unusually well-prepared for VoiceOver in the broad strokes — combined `accessibilityLabel` on `routeHazardChips`, `RouteAllClearChip` hidden from AT, route cycling chevrons with `accessibilityState` and Previous/Next labels. The closeout-specific note: PR #242 codified `label = noun, hint = present-tense outcome` for the rest of the app, but home's hazard chips still use a single row-level combined label rather than per-chip label+hint pairs. Sam still hears the row as one sentence and still cannot drill into a specific chip via VoiceOver. The map-coach overlay-as-single-button gap Phase 1 named is also unchanged.

**Casey (distracted mobile — one-handed, glancing):** Phase 1's read holds. Route-preview card still demands more visual parsing than a glance allows for the multi-chip state. "Heads up!" still the element most likely to catch peripheral vision — still the wrong moment to introduce alarm register. The unsurfaced Dynamic Type risk Phase 2/3 didn't pressure-test (34/15/13/12pt ladder at accessibility-large) is Casey's risk first.

**Black driver assessing safety in a charged moment:** Phase 1's read holds. App still handles this moment with composure. The one unresolved risk Phase 1 named — second-failure on the route-check retry chip with no fallback — is still present and is still architectural rather than design. Copy suggestion unchanged: "Route check unavailable — drive with extra care."

## Minor Observations

All five Phase 1 minor observations still stand unchanged:

- `dragHandleArea` in browse mode still ~36pt touchable, below the 44pt rule.
- `routeZonesLoadingChip` (~28pt) vs `routeZonesRetryChip` (44pt) still inconsistent in same slot.
- `mapCoachCard` `maxWidth: 320` still hardcoded vs spacing-token use elsewhere.
- `trustedOnRouteRow` Star still `burntgreen` — still correct per reserved-color rule.
- `WeatherDrivingCard` error state still shows "—°" with no retry-icon affordance.

Closeout-specific addendum: the Dynamic Type pressure-test that Phase 3 ran on en-route, pulled-over, share-location, and unfamiliar did not run on home. The route-preview card's four-tier type ladder is the densest type composition in the app; if any screen would have surfaced an `accessibility5` overflow it's this one. Cost of the triage decision, flagged so it's on the next-session list.

## Questions to Consider

Phase 1's five questions are all still open. Closeout adds one:

- When does home.tsx get its Phase 2/3 conventions pulled in? The screen is the largest in the app and the most visited; it currently sits one polish-generation behind every surface it routes into. The conventions exist in `.cursorrules` and have been validated on 8+ other screens — this is now a propagation task, not a design task.
