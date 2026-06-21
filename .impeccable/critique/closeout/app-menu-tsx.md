---
target: app/menu.tsx
phase1_score: 31
phase1_p0: 0
phase1_p1: 2
closeout_score: 34
closeout_p0: 0
closeout_p1: 2
slug: app-menu-tsx
phase: closeout
---

## Phase 1 → Closeout

- **Phase 1:** 31/40 · 0 P0 · 2 P1 (sign-out had no confirmation dialog; calendar tile fired with no async feedback). P2s: no value hints on config rows, separator token mismatch (`cardBorderSubtle` heavier than `separatorSubtle`). P3s: solo carousel tile read as bug; "Remove Photo" had no confirmation.
- **Closeout:** 34/40 · 0 P0 · 2 P1. PR #236 closed the value-hint P2 *partially* — `savedPlacesValue` now surfaces as `"N saved"` on the Saved Places row, establishing the row value-as-state convention that #237/#239 inherit. PR #237 added the Map guide row (always-available coach-mark reset hatch), thickening the config group from four to five rows and improving register coverage. PR #239 sanctions destructive red on `SettingsRow destructive` (carve-out #11) — the Sign out row's red label now has explicit rule cover rather than an unspoken exception.
- **Delta:** +3 points. Gains come from value-state convention adoption, register thickening, and explicit rule sanction of the destructive carve-out. The two P1s from Phase 1 (sign-out confirmation, calendar async feedback) are unchanged — both remain real risks. The value-hint fix is partial: Saved places surfaces a count, but the four other config rows (Refuel reminders, Zone Preferences, Safety, Map guide) still show icon-label-chevron only despite the hooks (`useFuelProfile`, `useTrustedContact`) being available in scope.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Saved places now surfaces "N saved" (partial win), but Refuel reminders / Zone Preferences / Safety still show no value. Calendar tile still fires `void connectCalendar()` with no loading or success feedback |
| 2 | Match System / Real World | 5 | iOS grouped-settings register exact; PR #239's sanction of destructive red on Sign out is now explicit rule cover. Map guide row uses Question icon — universal "help / re-show tutorial" affordance |
| 3 | User Control and Freedom | 3 | Sign-out still clears all identity state on a single press; no Alert confirmation. `signingOut` re-entrancy guard exists but provides no UI feedback during the clear |
| 4 | Consistency and Standards | 3 | RowGroup separator still uses `colors.cardBorderSubtle` (rgba(0,0,0,0.3)) — too heavy versus `separatorSubtle`. Not addressed since Phase 1. PR #236's value convention IS consistent (`"N saved"` is iOS-canonical count format) |
| 5 | Error Prevention | 3 | Sign-out still single-tap-destructive. "Remove Photo" still no confirmation. Map guide row's `router.replace('/home')` (after resetCoachMarks) is a quiet side-effect — user expecting "show me tutorial" gets routed away from settings without warning |
| 6 | Recognition Rather Than Recall | 4 | Saved places count is a clean recognition cue. Carousel tile copy still specific. Other config rows still require recall ("did I set up trusted contact?") |
| 7 | Flexibility and Efficiency | 4 | Saved places power-user scan now possible at a glance — convention is in place, just under-applied. Map guide adds a power-user hatch (re-run coach marks without re-onboarding) |
| 8 | Aesthetic and Minimalist Design | 4 | Five-row config group (vs Phase 1's four) reads more substantial — solo-carousel-with-large-config-group balances better. Solo-tile carousel issue remains when only one tile is eligible |
| 9 | Error Recovery | 2 | Calendar connect still fire-and-forget with `void` — no error boundary, no Alert on rejection. Unchanged from Phase 1 |
| 10 | Help and Documentation | 4 | **Map guide row is a real win here** — re-running coach marks is the canonical "help" affordance for a tutorial-bearing app, and putting it in Settings (vs hiding it) telegraphs that the app expects help-seeking. Privacy & Terms still solo in About group |
| **Total** | | **34/40** | **Stronger than Phase 1; the unfixed P1s cap further gain** |

## Anti-Patterns Verdict

**Clean.** Destructive red on Sign out now sanctioned under `.cursorrules` carve-out #11 — Phase 1 noted it as correct-but-unspoken; PR #239 wrote the rule. No reserved-color violations elsewhere. Map guide's Question icon in `colors.black weight="duotone"` matches the row icon convention (vs reserved `wiltedgreen`/`navy`/`red`/`orange`/`yellow`).

Three soft concerns persist from Phase 1:
- Gear icon beside "Settings" header still semantic-redundant.
- `tileCard` still has hardcoded `padding: 16`, `borderRadius: 12`, `gap: 8` (should be `spacing.md`, `radii.md`, `spacing.sm`).
- `profileTextStack` still uses `gap: 8` (off-ramp; should be `spacing.sm`).

These are nits, not slop. But they accumulate — the file now uses a mix of theme tokens (in RowGroup zone) and hardcoded values (in tile/profile zone), which is harder to keep clean than uniform discipline.

## Cognitive Load

| # | Item | Status |
|---|------|--------|
| 1 | Chunking — related items grouped | PASS — three RowGroups remain (config / about / sign-out). Map guide correctly slotted into config (not its own group) |
| 2 | Primary action obvious | PASS — config group heaviest, first below profile card |
| 3 | Labels scan without tapping | PARTIAL → improved — Saved places now surfaces count; four other rows still opaque |
| 4 | No competing focal points | PARTIAL — solo-tile carousel still creates dead space |
| 5 | Progressive disclosure honored | PASS |
| 6 | Destructive actions isolated | PASS — Sign out alone in its group |
| 7 | State legible at a glance | PARTIAL → improved from FAIL — convention exists, applied to one row of five |
| 8 | Async feedback visible | FAIL — calendar tile unchanged |

**Cognitive load rating: Moderate, trending light.** Two PARTIAL→improved deltas are real gains. One FAIL (async feedback) persists.

## Emotional Journey

**First open (unconfigured):** Unchanged from Phase 1. Warm greeting, inviting avatar badge, two carousel tiles as orientation. Map guide row reads as quiet reassurance ("there's a way back to the tutorial if I need it") — a small but real warmth gain.

**Return (partially configured):** Improvement. User who has saved places sees "3 saved" on the row — a recognition cue that they configured something here. Same user still sees "Refuel reminders ›" with no state, and "Safety ›" with no state — so the screen mid-arc still flattens, just less than before. The asymmetry ("why does Saved places tell me but Safety doesn't?") may itself read as inconsistency.

**Sign-out moment:** Unchanged. Destructive row correctly isolated and styled; single-tap-clears-everything risk persists. The Phase 1 concern (phone handed to officer at traffic stop) is unchanged.

**Map guide tap:** New surface area. User taps "Map guide ›" expecting a help screen, gets routed via `router.replace('/home')` after coach-mark reset. The behavior is intentional (coach marks fire on /home), but the row label "Map guide" doesn't telegraph "this will take you back to home and re-show the tutorial overlay." Mild surprise risk.

**Overall arc:** Warm entry → less-flat middle (Saved places anchors recognition) → adequately safe exit (sign-out risk persists) → quiet help hatch (Map guide). Net warmer than Phase 1.

## What's Working

**1. PR #236's value-as-state convention is the right move.** `savedPlacesValue` computed inline from `savedPlacesState.ready` + `savedPlaces.length` (with undefined-when-empty so the row doesn't render "0 saved" misleadingly during hydration) is the pattern. The convention is now in the file — applying it to Refuel reminders / Zone Preferences / Safety / Trusted contact is mechanical.

**2. PR #237's Map guide row is brand-aligned.** "Companion that doesn't condescend" — letting users re-run the coach-mark tour without uninstalling is the opposite of opaque. Phosphor `Question` icon at `weight="duotone"` matches the row icon convention.

**3. PR #239's destructive red sanction closes a quiet ambiguity.** Sign out was correctly styled in Phase 1 but lived as an unspoken exception. Carve-out #11 documents it — future destructive rows (e.g., "Delete account") now have explicit rule cover.

## Priority Issues

**[P1] Sign-out still has no confirmation dialog** *(unchanged from Phase 1)*
- What: `handleSignOut()` still fires `Promise.all([signOut(), clearContact(), ...])` directly on row press. No Alert. The destructive-red sanction (PR #239) makes the row visually correct but does not address the no-confirmation behavior.
- Why it matters: Same as Phase 1 — single mis-tap clears identity + trusted contact + saved places + calendar + fuel profile + resolutions + preferred stations. The phone-handed-to-officer / phone-handed-to-passenger scenarios remain unguarded. Highest-stakes action without standard guard.
- Fix: `Alert.alert('Sign out?', 'You\'ll need to sign back in. Your safety settings will be cleared.', [{text: 'Cancel', style: 'cancel'}, {text: 'Sign out', style: 'destructive', onPress: () => void doSignOut()}])`.

**[P1] Calendar connect tile still has no async status feedback** *(unchanged from Phase 1)*
- What: Tile still calls `void connectCalendar()` with `Haptics.selectionAsync()` and nothing else. No local loading state, no Alert on rejection.
- Why it matters: Same as Phase 1. If the tile disappears on success but with no haptic confirmation, success reads as "nothing happened." Failure silently swallowed.
- Fix: Local `calendarConnecting` state; ActivityIndicator inside tile during connect; Haptics.notificationAsync success on completion; Alert with retry on rejection.

**[P2] Value-as-state convention under-applied** *(partial fix from Phase 1)*
- What: PR #236 wired `savedPlacesValue` into the Saved places row. But Refuel reminders, Zone Preferences, Safety, and Map guide remain icon-label-chevron-only despite `useFuelProfile().profile?.remindersEnabled`, `useTrustedContact().contact?.name` etc. being readable in scope.
- Why it matters: The asymmetry now reads as inconsistency — "if Saved places can tell me, why can't Safety?" The fix is the same as Phase 1, just smaller in scope now that the convention exists in the file:
  - Refuel reminders → `value={fuelProfile?.remindersEnabled ? 'On' : undefined}`
  - Safety → `value={trustedContact?.name ?? undefined}` (or recordings count — depends on Safety's primary axis)
  - Zone Preferences → unclear primary axis; may be acceptable bare
- Fix: Wire `value` props from the hooks already imported. No new API calls; pattern is in the file.

**[P2] Separator token mismatch persists** *(unchanged from Phase 1)*
- What: `RowGroup.separator` still uses `colors.cardBorderSubtle` (`rgba(0,0,0,0.3)`) instead of `colors.separatorSubtle` (`rgba(0,0,0,0.1)`).
- Fix: One-token swap in `components/settings/RowGroup.tsx` line 94.

**[P3] Solo carousel tile dead-space** *(unchanged from Phase 1)*
- Same issue, same fix (render full-width card outside ScrollView when `carouselTiles.length === 1`).

**[P3] "Remove Photo" no confirmation** *(unchanged from Phase 1)*
- Same as Phase 1. Acceptable as-is given iOS `.destructive` action-sheet style.

**[P3 — new] Map guide row has quiet side-effect**
- What: `handleMapGuide` calls `await resetCoachMarks(); router.replace('/home')`. The row label "Map guide" does not telegraph "we'll route you back to home and re-show the overlay."
- Why it matters: Minor surprise. Most "Help / Tutorial" rows in iOS push to a help screen, not navigate away from settings. The behavior is correct (coach marks fire on /home), but the row label is mismatched to the action.
- Fix: Either rename to "Show map tutorial" / "Replay map guide" to telegraph the route, or add a brief Alert ("Replay the map tutorial?") before the navigate-and-reset.

## Persona Red Flags

**Sam (accessibility):** Map guide row's Pressable inherits SettingsRow's correct VoiceOver wiring — `accessibilityRole="button"`, `accessibilityLabel: "Map guide"`. No accessibility regression from #237. Carousel tile `accessibilityHint` gap from Phase 1 persists ("Opens refuel reminder settings" / "Connects your calendar" would complete the pattern).

**Casey (distracted mobile):** Improved. Saved-places-count surfacing means one of four config-check questions resolves without tapping in. Three remain (Refuel, Safety, Zone). Sign-out mis-tap risk persists — same as Phase 1.

**Black driver assessing safety in a charged moment:** Improved but not closed. The Safety row — the most consequential row on this screen — still surfaces no state. Trusted contact name, recordings enabled, lifeline configured: all opaque from this screen. Thesis-coverage gap from Phase 1 unchanged. The Saved Places row demonstrates the right pattern is achievable.

## Minor Observations

- `savedPlacesValue` correctly uses `undefined` (not empty string or `"0 saved"`) when no places exist — keeps the row clean and avoids hydration-flash misread. Good pattern; apply elsewhere.
- `handleMapGuide` is `async function` but only awaits `resetCoachMarks()` then calls synchronous `router.replace`. Acceptable; no error path though — if `resetCoachMarks` rejects, the navigate still fires. Likely intentional (best-effort reset) but worth a `.catch(() => {})` for hygiene.
- `tileCard` style block STILL has hardcoded `padding: 16`, `borderRadius: 12`, `gap: 8`. This nit survived two PRs that touched the file — worth a one-line cleanup pass.
- `signingOut` re-entrancy guard returns early but still provides no visual feedback. After clearing seven async operations, the user gets ambient quiet for ~0.5-1s. A brief `ActivityIndicator` or row-disable would close the feedback gap.
- The Sign out row's destructive carve-out (PR #239 carve-out #11) is now load-bearing for the codebase's reserved-color discipline. Worth a code comment in `SettingsRow.tsx` near `destructiveLabel` linking to `.cursorrules` #11 for future-reader grep.

## Questions to Consider

1. Should Map guide row be renamed to telegraph the route-and-reset behavior? "Replay map tutorial" is more honest than "Map guide ›".
2. Is the Saved places row's "N saved" convention going to ship to Refuel reminders / Safety / Zone Preferences in a follow-up? If yes, the partial-application asymmetry is temporary; if no, the inconsistency is the new steady state.
3. Sign-out confirmation: is the deliberate-friction Alert the right answer, or is `signingOut`-with-loading-feedback + a secondary "tap to confirm" inline-pattern more in keeping with the app's quiet voice?
4. Calendar tile's error path — if `connectCalendar()` rejects, where does the user learn about it? /home's calendar affordance, or this screen?
5. The two PRs that touched this file (#236 value convention, #237 Map guide row) both correctly used theme tokens — but the carryover hardcoded values in `tileCard` and `profileTextStack` are now visibly out-of-discipline. Worth a token-cleanup PR before the file accretes more.
