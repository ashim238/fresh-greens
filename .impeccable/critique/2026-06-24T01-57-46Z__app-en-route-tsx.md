---
target: app/en-route.tsx
total_score: 29
p0_count: 0
p1_count: 1
timestamp: 2026-06-24T01-57-46Z
slug: app-en-route-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | ETA-pulse during fetch is good; routeAnnouncedRef VoiceOver fire-once works; offline / demo pill clear; secondaryRow (distance · duration) now pairs visibly with ETA — the layout pass materially helped the "is this still loading?" read |
| 2 | Match System / Real World | 4 | Speed-sign shape matches US road metaphor; car marker rotates to heading; daylight dash-patterns + sun/moon glyph; "now" sub-30m read is a driving-attention idiom; maneuver glyphs map 1:1 to OSRM kinds |
| 3 | User Control and Freedom | 3 | End-trip always visible (correct decision documented inline); drag-handle expands hazard panel; compare-routes accessible from FAB cluster; coach mark dismissal still scrim-tap-only — SOS hold-to-confirm gate is good safety practice and correctly bypassed for VoiceOver |
| 4 | Consistency and Standards | 3 | secondaryRow uses dot separator (`·`) which matches /home's route-preview row — consistency across screens earned by the layout pass; SideFabRow's labelPill uses `caption2Regular` (11pt) which the 12pt Floor Rule explicitly carves out for ornament — labels here are informational, technically a Floor Rule miss |
| 5 | Error Prevention | 3 | SOS hold-to-confirm at 800ms with ring + haptic ramp is the canonical safety pattern; route-source background-refresh is silent-swap; mid-trip destination change handles route-cache race correctly; fuel entry hides during hazard panel which prevents competing-callout muddle |
| 6 | Recognition Rather Than Recall | 3 | Hazard glyphs in turn-card top right are 24pt and instantly readable; lane strip gates on actual decision (filtered "all lanes go this way"); coach-mark labels disappear after first dismissal — once gone, the four FABs are icon-only which is the standing critique on this screen |
| 7 | Flexibility and Efficiency | 3 | Mid-trip destination change, route-comparison sheet, fuel-stops sheet all wire from one FAB cluster; no shortcut to safety menu from the turn card itself; long-tap fallback for coach labels not implemented |
| 8 | Aesthetic and Minimalist Design | 3 | Wiltedgreen header reads grounded; secondaryRow + ETA in the collapsed sheet is the right minimum; **fuel hidden during hazard** is the key polish from this arc — previously a utility row competed with the 96pt yellow diamond, now the warning gets the floor; the hazard panel's 96pt diamond + 20pt copy reads as glance-friendly |
| 9 | Help Users Recognize, Diagnose, Recover | 2 | Off-route Recalculating state clear; route-source-mock distinguished from cache distinguished from live; zone-roll silent-fail still has no user-facing surfaced recovery (background catch); when the route fetch returns no-route from this surface, the turn card falls through to "Heading toward {dest}" — same string as mock fallback, ambiguous |
| 10 | Help and Documentation | 2 | Coach-mark surfaces SideFabRow labels but is one-shot per the existing critique; no in-app glossary; no long-press to re-show a label |
| **Total** | | **29/40** | **Good — secondaryRow + fuel-during-hazard fixes lifted the bottom-sheet hierarchy; help/recovery and label-discoverability still the standing gaps** |

## Anti-Patterns Verdict

**LLM assessment**: No AI-slop tells. The wiltedgreen turn-card header is the brand executing well; reserved-color discipline maintained (yellow only on hazard glyph + speed-sign caution recolor; red only on SOS burst). Side-button column is five 56pt FABs in a stack — the kind of construction the Apple Maps / Google Maps category convention earns. The fuel-during-hazard exclusion is exactly the kind of "minimize competing callouts" decision DESIGN.md asks for under the One-Voice Rule.

**Deterministic scan**: detector returned 0 findings across the file.

**Visual overlays**: Browser injection skipped (RN source).

## Overall Impression
This screen recovered from the bigger danger on /home — too much vertical stacking — by doing two things right in this arc: secondaryRow paired distance · duration with the ETA cluster instead of orphaning a sub-line, and the fuel entry deferred to the hazard panel when both want screen real estate. Both feel like principled application of DESIGN.md's One-Voice Rule. The screen's persistent weakness remains coach-mark discoverability after first dismissal — that's a Phase-1 known item documented as P1-9 from the 2026-06-19 baseline, untouched in this polish arc by design (this arc was layout, not feature).

## What's Working
- **secondaryRow as ETA's companion**, not a separate row with its own gravity. The dot-separator pattern matches /home's via row → cross-screen consistency.
- **Fuel hidden during hazard**. Two competing callouts at the bottom sheet would each fight for the user's glance during the most attention-budget-constrained moment of the drive. Hiding one when the other matters more is correct hierarchy-by-exclusion.
- **Hold-to-confirm SOS** with VoiceOver bypass is the textbook safety pattern; the ring's `colors.red` is the sanctioned reserved-color use.

## Priority Issues

- **[P1] Side-FAB label tier is below 12pt Floor.** `sideFabRowStyles.labelText` uses `typography.caption2Regular` (11pt). DESIGN.md 12pt Floor Rule reserves caption2 for ornament; these labels carry meaning ("Guide", "SOS", "Safety", "Report", "Recenter"). **Fix**: bump to `caption1Regular` (12pt) or `footnoteRegular` (13pt). **Suggested command**: `/impeccable typeset app/en-route.tsx`
- **[P2] No long-press fallback to re-show FAB labels.** Once `sideFabCoach.visible` flips off, the column is icon-only forever (this run + future runs); the Guide button re-shows them but isn't itself labeled when collapsed → recursive discoverability problem. **Fix**: long-press on any FAB → temporarily flash its label. **Suggested command**: `/impeccable polish app/en-route.tsx` (or `clarify` if the goal is the Guide button copy/label)
- **[P2] No-route fallback indistinguishable from mock fallback.** The turn card's `else` branch renders "Heading toward {destName}" for both real no-route conditions and mock-route fallback. **Fix**: separate the two — no-route should show a recoverable state inline on the turn card (parallel to /home's noRouteState). **Suggested command**: `/impeccable clarify app/en-route.tsx`

## Persona Red Flags

**Sam (Accessibility)**: Side-FAB labels read by VoiceOver via `accessibilityLabel` on each FloatingActionButton (good) but the *visible* label in `caption2Regular` is below dynamic-type's reasonable reading floor at any scale below AX2; low-vision sighted users get the worst of both worlds.

**Casey (Distracted Mobile)**: With 6 columns stacked at 56pt + 8pt gap = ~376pt of column height on a 6.1" 844pt-tall device, the bottom-sheet expanded + side-column-bottom + speed-sign-bottom geometry will sometimes push the column off-screen at AX5. Already speculative; would need a screenshot to confirm.

## Minor Observations
- The `SideFabRow` positioning fix from 2026-06-21 (absolute-position the labelPill so showLabel toggle doesn't shift the FAB) is the right kind of layout-stability work; carry that discipline forward.
- ETA pulse animation respects reduceMotion (no fallback half-motion) — Reduce-Motion-Honest Rule observed.
- `offlinePill` uses `rgba(255, 255, 255, 0.2)` directly (called out in 2026-06-19 baseline as a token gap, still present). Low-priority cleanup.

## Questions to Consider
- Could the FAB labels live on a single shared coach-mark prompt that re-shows automatically the first time per session, rather than per-install? The cognitive cost of re-orientation is high during driving.
- What's the right register for the "Heads up: low lighting on this stretch" hazard panel copy at AX5? It currently inherits Title3 Emphasized; long copy + diamond + 96pt height could overflow.
