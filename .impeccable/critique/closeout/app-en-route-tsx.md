---
target: app/en-route.tsx
total_score: 34
p0_count: 0
p1_count: 1
timestamp: closeout
slug: app-en-route-tsx
---

## Then vs now

Phase 1: **28/40**, 1 P0 + 2 P1 + 2 P2 findings. Closeout: **34/40**, 0 P0 + 1 P1 + 3 P2 findings. The two highest-stakes findings (SOS misfire, auto-expand on zone entry) closed cleanly with idiomatic fixes — hold-to-confirm with an opacity-ramped ring, and the zone-entry haptic decoupled from layout disruption. The dead speed-limit sign was retired honestly, recovering Heuristic 9 most of all. What remains is mostly the discoverability-of-side-column gap (Help button helps, but the labels still rely on coach-mark reinvocation) plus a small dial-back of token drift.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Route source pill + WifiSlash, ETA pulse, current-speed dash before GPS — same strong baseline; still no "GPS live" persistent dot, still no signal when corridor roll fails silently |
| 2 | Match Between System and World | 4 | Speed pill now reads as dashboard speedometer (black panel/white digits); car marker rotates to heading; daylight dash-patterns intact — real-world metaphors still strong |
| 3 | User Control and Freedom | 4 | End trip always visible, drag-handle expands hazard panel, route comparison sheet, mid-trip destination change. New Help (Question) button at top of column reinvokes the coach mark on demand — closes the "one-shot then gone" trap. Coach overlay still dismisses via a full-screen invisible Pressable; better an X, but reinvocation makes the cost survivable |
| 4 | Consistency and Standards | 3 | Token discipline still strong overall; `offlinePill` still uses `rgba(255,255,255,0.2)` directly; `borderRadius: 100` still appears on `offlinePill`, `fuelStopsDueBadge`, `routeBadge`, `endTripBtn` instead of `radii.pill`; `speedLimitCurrentNumber` still defines inline font metrics with no typography token; `routeBadgeTextActive: { color: colors.black }` is still a no-op on a `colors.black` base |
| 5 | Error Prevention | 4 | **Major recovery here.** SOS now gates on `useHoldToConfirm` at 800ms with an opacity-ramped red ring (`sosHoldRing`) and VoiceOver-aware single-tap bypass. Distinct interaction shape from the four other column buttons. Accidental-brush misfire largely closed. Route re-fetch and off-route states remain composed |
| 6 | Recognition Over Recall | 3 | Side-column glyphs still unlabeled in steady state; Help (Question) button at column top reinvokes coach mark on demand — meaningful improvement, but the coach labels themselves still use `caption2Regular` (11pt, untreated by `dynamicType`) and the Help glyph itself is unlabeled until tapped |
| 7 | Flexibility and Efficiency | 3 | Same affordances as Phase 1. SOS column position unchanged — but the consequence has changed (hold-to-confirm makes top-of-column placement defensible: hardest reach for the most consequential button) |
| 8 | Aesthetic and Minimalist Design | 3 | Killing the speed-limit sign leaves a single black speedometer pill on the left — cleaner left-edge, no broken affordance. Hazard panel still loud (96pt yellow diamond against 20pt copy) but driver now opts in via drag handle instead of being yanked. Bottom-sheet stack still trends single-column at expanded state |
| 9 | Help Users Recognize, Diagnose, and Recover | 3 | **Recovered one point.** Removing the permanent "—" speed-limit sign closes a persistent honesty-of-disclosure violation. Corridor-roll silent failure still has no surfaced indicator (`catch { /* Keep prior zones */ }` at line ~1287); no `no-route` branch on the turn card (still falls through to "Heading toward {dest}") |
| 10 | Help and Documentation | 4 | **Recovered three points.** Help (Question) FAB at top of side column reinvokes the coach mark on demand. The "tap anywhere to dismiss" mechanic remains discoverability-light, but the existence of an explicit "show me again" button is the structural fix the Phase 1 P1 demanded. Still no in-app glossary or long-press labels |
| **Total** | | **34/40** | **Composed — the two hard P-level fixes landed; what remains is token drift, label typography, and one silent-failure surface** |

## Anti-Patterns Verdict

**Still not AI slop.** Reserved-color discipline intact: red lives only on the SOS button + its new hold ring (a sanctioned amplification of the existing carve-out, not a new reservation); yellow only on caution-zone hazard markers and the speed-pill border state; orange only on hazard marker fills; navy only on the safety shield. The hold-ring (`sosHoldRing`) is an unusually elegant pattern — outside the FAB, opacity-driven, no size animation, no column jitter. Reads as the system showing its work without theatrics.

Token drift, unchanged from Phase 1:
- `rgba(255, 255, 255, 0.2)` still inline on `offlinePill`
- `borderRadius: 100` still on five style blocks where `radii.pill` exists
- `speedLimitCurrentNumber` still inline `fontWeight: '700' / fontSize: 24 / lineHeight: 28 / letterSpacing: -0.26` — with explicit "dynamic-type exempt" comment, which is the right call for fixed-proportion signage, but the metrics themselves don't match any typography token

New token note: the `sosHoldWrap` + `sosHoldRing` styles are correctly scoped and well-commented; no drift introduced.

## Cognitive Load

| Item | Status | Notes |
|------|--------|-------|
| Single primary action per view state | Partial | Collapsed: ETA clear, End Trip prominent. Side column is now FIVE icons (Help added). Help is auxiliary so it stacks above SOS — defensible, still a busy column |
| Labels for all interactive elements | Partial → improved | Help button provides on-demand label reinvocation. Glyphs still unlabeled in steady state. Net forward but not closed |
| Progressive disclosure | Pass | Collapsed / Full states still well-designed. Hazard panel only in Full, fuel entry only in Full |
| Information hierarchy follows attention sequence | Partial | Same as Phase 1 — turn card → ETA → End Trip is right; expanded sheet still flattens hazard/fuel/ETA into uniform stack |
| Motion is purposeful and deferrable | Pass | ETA pulse, lane strip fade, SOS hold-ring opacity ramp all respect intent (the SOS ring deliberately doesn't gate on `reduceMotion` — it's a safety signal, not decoration) |
| Simultaneous-information count | **Improved** | Killing auto-expand removes one concurrent stream at the highest-load moment. Driver now sees up to: turn card + turn hazard glyphs + speed pill + lane strip — four streams, all driver-controlled. Auto-expand-induced fifth stream gone |
| Recovery from attention lapse | Pass | Turn card persists. Distance counts down. Recalculation explicit |
| Spatial consistency of controls | Pass | Side column anchored above sheet (now hosts five buttons), speed pill bottom-left |

## Emotional Journey

**Entry:** Same calm. Route loads, car glyph rotates to heading, daylight gradient quietly signals what's ahead. ETA pulses while loading.

**Steady driving:** Speed pill now reads as digital dashboard (black panel/white digits). Without the yellow speed-limit sign below it, the left edge of the screen is quieter — one stack of information instead of two competing road-sign metaphors.

**Approaching a hazard zone:** This is where the closeout reads most differently. Zone entry now fires a single `ImpactFeedbackStyle.Light` haptic with NO layout disruption (`prevEnteredZoneIdsRef` diff, no `setSheetExpanded(true)`). The driver's eyes stay on the road. If they want to read the panel they drag the handle up themselves. The hazard panel still arrives loud (96pt yellow diamond), but only when invited. The composure-vs-alarm slider is decisively on the composure side now.

**SOS interaction:** The hold-ring is the most expressive piece of state on the screen. Press in, the red ring at 64pt outside the 56pt FAB ramps from 0 → 1 over 800ms; let go early and it disappears with no transition. Reads as "I see what you're trying to do, confirm it." VoiceOver users get a single-tap bypass via `sosHold.isVoiceOverOn`. This is the textbook safety-critical pattern from `.cursorrules`.

**Off-route / arrival:** Unchanged, still composed.

**Overall arc:** The zone-entry spike Phase 1 flagged is gone. What remains is steady. For "The Steady Companion" brand, this is what the screen was supposed to feel like.

## What's Working

**1. SOS hold-to-confirm is shipped well.** Visual ring + ramping opacity + VoiceOver bypass + sanctioned reuse of `colors.red` + sane 800ms threshold. The pattern is reusable across other safety-critical surfaces; the implementation reads like the canonical reference.

**2. Removing the dead speed-limit sign was the right call.** The Phase 1 P2 — "permanently broken affordance teaches user to distrust other data" — got the unambiguous fix. The code's TODO ("v1 limitation: OSM `maxspeed` tags aren't wired") is still in the file's prose comments around line 1980, but the sign UI is gone. Honest.

**3. Zone-entry haptic without layout disruption is exactly the fix.** Line ~956-968: `prevEnteredZoneIdsRef` diff → Light haptic → done. The Phase 1 comment is preserved in the code ("DON'T auto-expand the sheet. The v1 auto-expand + 5s auto-collapse yanked driver eyes off the road"). The fix is small, the comment captures why — future contributors won't reintroduce the behavior.

**4. Help (Question) FAB is the right structural answer to coach-mark discoverability.** Reinvocation on demand beats persistent labels for steady-state clarity and beats one-shot-then-gone for first-time learnability. Net forward.

## Priority Issues

**[P1] Coach-mark label typography still below WCAG floor and untreated by Dynamic Type**
- What: `sideFabRowStyles.labelText` is `typography.caption2Regular` (11pt) with no `dynamicType()` wrapper. The Help FAB (Question) now reinvokes the coach mark — making this label the ongoing surface a returning user reads under street light in a moving car.
- Why it matters: 11pt is below the WCAG 1.4.4 informational floor. Without `dynamicType`, users with larger text settings can't scale these labels up. The reinvocation pattern makes the label the durable surface; its readability now matters more, not less.
- Fix: Promote to `typography.footnoteRegular` (13pt) and wrap in `dynamicType()`. Consider also bumping `labelText` from `colors.labelSecondary` (60% black) to `colors.labelPrimary` for the coach-mark register specifically — these are guidance labels, not metadata.

**[P2] Help (Question) FAB has no persistent affordance for what it does**
- What: Top of side column, Phosphor `Question` glyph, 48pt FAB. `accessibilityLabel="Show map controls guide"` + hint exist for VoiceOver. Sighted users see a "?" with no caption until they tap it.
- Why it matters: The Help button's value depends on users discovering it. A new driver who didn't see the original coach mark, or dismissed it before reading, has to recognize that the "?" reinvokes labels for the four buttons below.
- Fix: Consider showing the Help button's own label persistently (not gated on `sideFabCoach.visible`), or label-on-first-mount-then-fade. Alternatively, a subtle pulse on first cold start of `/en-route` after the coach mark has been dismissed.

**[P2] `no-route` source still visually indistinguishable from loading on the turn card**
- What: Same finding as Phase 1. When `routeSource === 'no-route'`, the turn card falls through to "Heading toward {destination}" with neutral NavigationArrow — same appearance as mock fallback. The background-refresh loop now correctly SKIPS polling for `no-route` (lines ~1331), so the engine knows it's terminal, but the UI doesn't.
- Why it matters: Driver who started a trip to a known-unroutable destination has no signal the route engine has given up.
- Fix: Add an `routeSource === 'no-route'` branch to the turn card with explicit copy ("Route unavailable — try a new destination") and surface the existing change-destination FAB with a tinted state.

**[P2] Silent corridor-roll failure still has no user-facing indicator**
- What: Lines ~1287-1290, the `catch { /* Keep prior zones on roll failure */ }` path. When OSM rolls fail mid-trip, the user has no signal that the hazard overlay may be stale relative to the road ahead.
- Why it matters: Honesty-of-disclosure principle. The cache-age stamp on the offline-route pill is the analog pattern — the corridor-roll equivalent doesn't exist.
- Fix: Consider a small "freshness" indicator on the speed pill or as a secondary state on the offline-pill — green dot = corridor fresh, gray dot = stale-but-loaded, no dot = corridor unknown.

## Persona Red Flags

**Sam (accessibility):**
- `useHoldToConfirm` shipped with `isVoiceOverOn` bypass — Sam's path opens at single-tap with full label/hint
- Coach-mark labels at 11pt + no `dynamicType` is the active remaining gap
- The auto-expand removal closes one previous AccessibilityInfo concern: there is no longer an un-announced layout change on zone entry; the only zone-entry signal is haptic, which Sam already pairs with VoiceOver's own context

**Casey (one-handed, distracted):**
- Top-of-column SOS is now defensible: hardest reach + hold-to-confirm = "two layers of intent" before emergency surface
- Removal of auto-expand means Casey's eyes stay on road during zone entry
- Side column gained Help (5 buttons total). Recenter still at bottom (most-frequent, easiest reach) — column order is right

**Black driver assessing safety in a charged moment:**

1. **SOS misfire scenario closes cleanly.** Brushing the top of the column no longer triggers `/emergency`. The ring's visual feedback during the 800ms hold lets the driver confirm or back out. The remaining risk surface is intentional activation.

2. **Police-presence zone behavior is calmer.** No more auto-expand + 96pt yellow diamond + 5-second timer arriving uninvited. The haptic still fires (driver knows something changed), but the panel content is opt-in via drag. For a driver already alert to police presence, this is the right register — brief, not amplify.

3. **Community-report tap during navigation** — still hides the ETA sheet (line ~2126). Phase 1 noted the in-code comment ("if this proves too aggressive in real driving we can swap to auto-dismiss"). Comment is still there. Hasn't graduated to a fix; not a closeout regression but a deferred Phase 1 P2.

## Minor Observations

- `routeBadgeTextActive: { color: colors.black }` still a no-op on the freshgreen-filled active badge — Phase 1 flagged this; still 2.9:1 contrast and still inert as written. Likely safe to delete the style block.
- `thenFooter` still always shows `ArrowBendUpRight` regardless of actual next-next maneuver.
- `dragHandleTapTarget` comment still says "the remaining HIG 44pt floor comes from `hitSlop`" — there is no `hitSlop`. Comment is stale (was stale in Phase 1 too).
- `LaneStrip` cell `minWidth: 32` × `height: 40` still untested at 5+ lanes — not a closeout issue but a long-tail concern.
- `handleRecenter` (line ~1541) still recenters to `userCenter` (the initial GPS fix from mount) rather than live `userLocation`. **Still a functional bug** — Phase 1 flagged, unchanged. During a long trip the recenter button increasingly disagrees with where the car actually is.
- The new `sosHoldRing` correctly does NOT gate on `reduceMotion`. Safety-critical interaction feedback, not decoration — right call.

## Questions to Consider

1. The Help button's discoverability — is it OK that it's a "?" with no label until tapped? Or should the Help label be the one persistent caption in the column?
2. The corridor-roll silent-failure indicator — is freshness worth a dot, a pill, or something on the offline-pill?
3. `handleRecenter` recentering to `userCenter` instead of `userLocation` — Phase 1 called this a functional bug; it's still there. Was this consciously left, or did it slip past the closeout sweep?
4. SOS hold threshold at 800ms — is this the right gate? Long enough to defeat brush-tap, short enough to feel responsive in an actual emergency. Worth a real-device check.
5. Coach-mark dismiss-on-full-screen-tap remains label-free for sighted users. With Help button now offering reinvocation, does the dismiss mechanic still need its own affordance (X button on the coach overlay), or is "tap anywhere" survivable now that reinvocation is cheap?
