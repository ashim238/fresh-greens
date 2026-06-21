---
target: app/search.tsx
phase1_score: 31
phase1_p0: 0
phase1_p1: 1
closeout_score: 31
closeout_p0: 0
closeout_p1: 1
slug: app-search-tsx
phase: closeout
---

## Then vs now

**Phase 1 (2026-06-19 baseline):** 31/40 · 0 P0, 1 P1, 3 P2, 2 P3 (6 priority findings).
**Closeout:** 31/40 · 0 P0, 1 P1, 3 P2, 2 P3 (6 priority findings). Net delta: **0**.

`app/search.tsx` was not edited between Phase 1 and the closeout — `git log` since 2026-06-19 against `app/search.tsx` and `components/SearchBar.tsx` returns empty. The Sprint 1 hooks migration touched this screen lightly enough that all of its substitutions landed before the Phase 1 baseline; the surface has been load-bearing read-only through Phase 2/3. This closeout reflects that — the same six priority findings are still here in the same shape, and the conventions Phase 2/3 codified elsewhere (PR #241 painted-X dismissal, PR #242 label-noun + hint-outcome VoiceOver rule, PR #235 SafetyErrorMessage / error taxonomy, Dynamic Type pressure-tests) have not been applied to this file.

The one thing worth correcting from Phase 1: the P1 mic-icon finding's mechanism description was slightly off. Re-reading `PressableIcon` in `components/SearchBar.tsx`, when `onPress` is undefined it renders a plain `<View>` with no `accessibilityLabel` attached — VoiceOver therefore does **not** announce "Voice search, button" as Phase 1's worst-case described. The actual residual issue is the sighted-user one Phase 1 also named: the mic glyph is visually present at full opacity inside a 44pt iconWrap, looks tappable, and produces zero feedback. That's still a real Steady-Companion-register miss; the finding stays at P1 with the VoiceOver concern downgraded and the sighted-affordance concern as the load-bearing reason.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Unchanged — loading and error states still well-differentiated; silent debounce still gives no feedback during the 300ms autocomplete window |
| 2 | Match System / Real World | 4 | Unchanged — "Where are you headed?", "in 3h", `relativeWhen` still on-register |
| 3 | User Control and Freedom | 3 | Unchanged — back chevron persistent; clear deselects filter and query; long-press remove on recents still discoverable only by accident |
| 4 | Consistency and Standards | 3 | **Drifted from the new convention without losing the Phase 1 score** — `quickTool.borderRadius: 8`, `quickToolsRow.gap: 16`, `scrollContent.gap: 16` still raw values while `theme/radii.ts` and `theme/spacing.ts` are now the canonical ramps the rest of the app reaches for. Row anatomy still consistent. Drift is in token-import discipline, not visual output |
| 5 | Error Prevention | 3 | Unchanged — silent autocomplete pattern correct; `lastQueryRef` stale-guard correct; no debounce guard when `userLocation` is null still ships explicit-submit through a clean path |
| 6 | Recognition Rather Than Recall | 4 | Unchanged — Recents, Saved, Upcoming surfaced; Quick Tools row makes category search discoverable |
| 7 | Flexibility and Efficiency | 3 | Unchanged — Gas tile wires to category search; no way to re-trigger search if results went stale without clearing and re-selecting |
| 8 | Aesthetic and Minimalist Design | 3 | Unchanged — landing state appropriately sparse; demo-price footnote ("Sample fuel prices for demo") still visually orphaned with no enclosing surface |
| 9 | Error Recovery | 3 | Unchanged — no-results MagnifyingGlass / WifiSlash icon swap still thoughtful; "Locating you… try again in a moment" still diagnosis without remedy. PR #235's `SafetyErrorMessage` + error-taxonomy convention did not propagate here |
| 10 | Help and Documentation | 2 | **Slightly improved description** — mic icon's inert state does NOT announce as "Voice search, button" via VoiceOver (PressableIcon's undefined-onPress branch drops the label). But the sighted-user inertness — full-opacity 44pt glyph that looks tappable and isn't — is still the load-bearing register miss Phase 1 caught |
| **Total** | | **31/40** | **Good — held its Phase 1 score by inertia. The H4 score is now sharper because radii/spacing token import is standard practice elsewhere; the H10 description is sharper because the VoiceOver mechanism was misread in Phase 1** |

## Anti-Patterns Verdict

**Not AI slop.** Same verdict as Phase 1, same evidence. The state-machine comment block at the top still reads as engineering-after-edge-cases writing. Design choices remain coherent with rationale: silent autocomplete miss, `lastQueryRef` stale-guard, `relativeWhen` formatter, `recentsLoading` flash guard, the `buildSavedRows` ~200m dedup. No gradient text, no glassmorphism, no eyebrow-labeled card grids.

The soft flag from Phase 1 — Quick Tool tiles at 144×~96pt feeling slightly over-engineered for one-tap category filters — is still present and still soft. Reuses `iOS system colors` per Figma; documented as the decorative-iconography exception to the reserved-color rule. Verdict holds: **human-made**.

## Cognitive Load

| Check | Status |
|---|---|
| Distinct visual zones | Pass — section headers label each zone (unchanged) |
| Chunking | Pass — divider lines + section gaps (unchanged) |
| ~5-7 items visible without scrolling | Pass in landing (unchanged) |
| Primary action obvious | Pass — search bar dominant; `autoFocus` fires immediately (unchanged) |
| State changes legible | Partial fail — silent debounce gives no mid-flight feedback (unchanged) |
| Error copy explains what to do | Partial fail — "Locating you… try again in a moment" is diagnosis without remedy (unchanged) |
| No parallel metaphors | **Now passes for VoiceOver, still fails for sighted users** — mic glyph's inert path drops its accessibilityLabel (Phase 1 misread), but a visible affordance that produces no response is still a parallel-metaphor failure for sighted users |
| Memory load minimal | Pass — Recents and Saved eliminate memorizing past destinations (unchanged) |

**Cognitive load: Moderate — 3 failures out of 8.** Same count as Phase 1; one failure's mechanism description has been corrected without removing the failure.

## Emotional Journey

Same arc as Phase 1, same edges.

**Peak — Upcoming event row** still lands. Driver sees event with resolved address and "in 3h" badge, taps, immediately routed. Single-tap from calendar to navigation is the highest-trust moment on the screen.

**Valley — unresolved Upcoming row** still flat. `Set location · in 3h` is accurate but visually identical to a resolved row's subtitle. Driver expects navigation, gets pick sheet. Phase 1's proposed remedy (trailing CaretRight or freshgreen subtext) did not land.

**Reassurance in charged moments** still handled correctly for the network case (icon-swap, "Charting course…" calm copy). The "Locating you…" no-recovery path is still the worst-case response for a Black driver assessing safety in a time-pressured planning moment. PR #235 (SafetyErrorMessage + error taxonomy) would have been the convention to apply here; it did not propagate to this surface.

The closeout-specific note matches what showed up on `/home` and `/safety`: **the sub-flows /search routes into are now noticeably better than /search itself.** /en-route picked up VoiceOver hint depth (PR #242). /pulled-over and /roadside picked up painted-X dismissal + 44pt controls (PR #241, #246). The /search → /home → /en-route arc crosses a polish boundary mid-trip. The user starts on a screen that's holding its 31/40 by inertia and walks into screens that have been more carefully held.

## What's Working

Unchanged from Phase 1.

**1. Silent debounce pattern on autocomplete.** 300ms setTimeout + silent failure mirrors Apple Maps; `lastQueryRef` guard against stale-result overwrite still production-quality.

**2. The `recentClearBtn` minimum-height pattern.** `minHeight: 44` + `justifyContent: 'center'` still painting a 44pt-vertical tap target. (Horizontal target still narrow — see P3 below.)

**3. The `buildSavedRows` merge with ~200m dedup.** Still mirrors `regular-destinations.ts`'s `MATCH_DELTA_DEG`; cross-module coherence intact.

## Priority Issues

**[P1] Mic icon is visibly inert for sighted users (VoiceOver path corrected)**
- What: `PressableIcon` in `components/SearchBar.tsx` checks `if (!onPress)` and renders a plain `<View>` with no accessibilityLabel — VoiceOver actually skips this glyph cleanly, contrary to Phase 1's worst-case read. But the sighted-user issue stands: the mic icon renders at full opacity inside a 44pt iconWrap, looks identical to a working affordance, and produces zero feedback on tap.
- Why it matters: Steady Companion register requires every visible affordance to produce a response. A live-looking icon that does nothing is the same trust hit Phase 1 flagged.
- Fix: Hide the mic icon entirely in `on-tap`/`typing` when `onMicPress` is undefined (cleanest), or render at `opacity: 0.35` with `accessibilityElementsHidden={true}`. The `TODO: restore handler when voice input ships` comment in `app/search.tsx` line ~605 is still load-bearing — solve the visual half of it now.

**[P2] Error state for missing location still has no recovery action**
- What: Unchanged from Phase 1. When `userLocation` is null and the user submits, error state shows "Locating you… try again in a moment." No retry, no cancel, no orienting frame.
- Why it matters: Most likely on first launch or after permission reset. Same concern Phase 1 named; PR #235's error-taxonomy convention (SafetyErrorMessage) did not propagate to /search.
- Fix: Add a `retry` action prop to `ErrorState` (or inline retry Pressable) that re-triggers `Location.getCurrentPositionAsync`. Copy: "Still finding your location — tap to try again." If error-taxonomy adapter wiring is the right path, route this through `getErrorMessage('location', 'transient')` parity with how `runSearch`'s catch branch already calls `getErrorMessage`.

**[P2] Token discipline slips in Quick Tool tile and scroll container styles (now drifted from convention)**
- What: Three raw values still escape the theme system: `quickTool.borderRadius: 8` should be `radii.sm`; `quickToolsRow.gap: 16` and `scrollContent.gap: 16` should be `spacing.md`. Phase 1 caught these; the rest of the app's Sprint 2/3 work consolidated `theme/radii.ts` and `theme/spacing.ts` as the canonical ramps, so these reads are now more visibly off-convention than they were at baseline.
- Why it matters: `.cursorrules` anti-slop check 2 — "Never write a hex color, font size, or spacing value inline in a screen." Three slips can seed a pattern; they are now the only three slips of this kind on a primary screen.
- Fix: Replace with `radii.sm` and `spacing.md` from theme imports. Mechanical change.

**[P2] Unresolved Upcoming row still gives no pre-tap affordance for "Set location"**
- What: Unchanged. Row reads `Set location · in 3h` in `recentSubtext` — visually identical to a resolved row's subtitle. No icon, color cue, or typography distinction.
- Why it matters: Driver expects navigation, gets pick sheet. Unexpected UI interruption at planning moment. Inconsistency with the painted-affordance convention PR #241/#242 codified elsewhere.
- Fix: Add trailing `CaretRight` (`labelTertiary`, 16pt) to signal "tap to configure", or shift subtext color to `freshgreen` for an actionable read. CaretRight is the more legible choice now that PR #242's noun-label + outcome-hint convention is the project standard — a chevron carries the "configure on tap" promise without leaning on color alone.

**[P3] Demo-price footnote still visually orphaned**
- What: `"Sample fuel prices for demo — not live pump data."` still renders in `footnoteRegular` at `labelTertiary` with no container; same color/size as result address text, easily read as stale address.
- Why it matters: Honesty-of-disclosure principle requires the footnote to read as a footnote, not content.
- Fix: Indent to match result rows (`paddingHorizontal: 48`) or wrap in `fillsQuaternary` chip with `*` prefix. Mechanical change.

**[P3] "Clear" in Recent header still has asymmetric tap-target**
- What: `recentClearBtn` still has `minHeight: 44` (compliant vertically) but no `paddingHorizontal` — painted width equals "Clear" text width (~32pt). Horizontal target sub-44pt.
- Why it matters: "Clear" is destructive. Narrow tap target on destructive control is the same miss Phase 1 named.
- Fix: Add `paddingHorizontal: spacing.md`. Mechanical.

## Persona Red Flags

Unchanged from Phase 1.

**Sam (accessibility):** Mic icon's static-but-visible state still a sighted-user dead zone; VoiceOver path actually clean (Phase 1 misread). Long-press-to-remove on recents still potentially conflicts with VoiceOver rotor's default long-press; still untested on-device. Quick Tool tile `accessibilityState={{ selected: isSelected }}` still correct.

**Casey (distracted mobile):** Quick Tool tiles at 144×~96pt still easily one-handed tapped. Back chevron compliant 44×44 at far left edge — still awkward stretch on Max. "Clear" button's sub-44pt horizontal target still the sharpest risk for Casey.

**Black driver assessing safety in a charged moment:** "Locating you… try again in a moment" with no retry still the worst-case response. Unresolved Upcoming row still breaks the routing-expectation contract mid-flow.

## Minor Observations

Unchanged from Phase 1.

- `resultsCity` still initializes to `'your area'` — reverse-geocode-never-resolves path still reads "in your area" lowercase-inconsistent with city names.
- Fuel section still has no explicit `alignItems` on the row; default `stretch` could behave unexpectedly at Dynamic Type XXL. **This is now the screen's largest unaddressed Dynamic Type risk** because Phase 2/3 did not pressure-test the type ladders on this surface.
- `PressableIcon` still passes `size = name === 'mic' ? 20 : 24` — mic renders 4pt smaller than other icons, still intentional but undocumented.
- `clearRecents` Alert still pivots from gentle ("Forget all your recent destinations?") to clinical ("This cannot be undone.") inside two sentences.
- `scrollContent` gap creates consistent vertical rhythm but Upcoming/Saved sit inside `recentSection` (`paddingHorizontal: 24`) while Quick Tools sit inside `quickToolsRow` (`paddingHorizontal: 16`). 8pt inconsistency in left-edge alignment unchanged.

## Questions to Consider

The Phase 1 questions are all still open. The most interesting one for the closeout: **is the mic-icon TODO at risk of becoming permanent furniture?** Two sprints have passed without it moving. A decision either way (ship the voice-input integration or hide the icon until then) closes the only P1 finding on this screen with a single small change. The screen is otherwise within one mechanical-fix sweep of a 33–34/40 closeout score — radii/spacing token swap (P2), location-retry action (P2), unresolved-row chevron (P2), demo-footnote container (P3), Clear horizontal padding (P3), all surgical. The reason it didn't get that sweep is the same reason `/home` didn't: Phase 2/3 prioritized the sub-flows the user lands in after `/search`, not `/search` itself.
