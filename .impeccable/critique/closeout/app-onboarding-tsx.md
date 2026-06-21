---
target: app/onboarding.tsx
phase1_score: 35
closeout_score: 36
phase1_findings: 2 P1, 2 P2, 1 P3
closeout_findings: 1 P1, 2 P2, 1 P3
delta: +1 (one P1 promoted-to-intent, one new P1 surfaced)
slug: app-onboarding-tsx
phase: closeout
---

## Phase 1 vs Closeout

| Dimension | Phase 1 (2026-06-19) | Closeout (2026-06-20) | Δ |
|---|---|---|---|
| Total score | 35/40 | 36/40 | +1 |
| P0 | 0 | 0 | 0 |
| P1 | 2 | 1 | -1 |
| P2 | 2 | 2 | 0 |
| P3 | 1 | 1 | 0 |

**Delta line:** +1. Phase 1's P1 "5-dot mismatch" downgraded to P2 (now documented intent — dot count spans the full 5-screen onboarding flow, not this surface). Phase 1's P1 "Skip reads as inert" partially mitigated by code comment but the missing `accessibilityHint` regression persists, so a fresh P1 covers it. P2 spacing-literals finding unchanged. Phase 2 conventions (Dynamic Type via `dynamicType(...)`, Dismissal — not applicable as this is a forward-only intro flow) are correctly inherited.

## Design Health Score

| # | Heuristic | Phase 1 | Closeout | Key Issue |
|---|-----------|---------|----------|-----------|
| 1 | Visibility of System Status | 3 | 4 | 5-dot count now justified by inline doc comment (lines 146-154) — spans the full onboarding flow, sighted/VoiceOver counts match downstream. Still a load-tax on first viewing but no longer a mental-model bug. |
| 2 | Match System / Real World | 3 | 3 | "For us, by us" still requires prior cultural knowledge; unchanged. |
| 3 | User Control and Freedom | 3 | 3 | Skip still uses `fill="transparent"`, still no `accessibilityHint`. Code comment (lines 325-330) now explains the variant choice but doesn't address the AX gap. |
| 4 | Consistency and Standards | 4 | 4 | Panel 3 copy still abstract relative to 1-2; unchanged. |
| 5 | Error Prevention | 3 | 3 | Past-the-end threshold (30pt) still hardcoded. |
| 6 | Recognition Rather Than Recall | 4 | 4 | No swipe cue; unchanged. |
| 7 | Flexibility and Efficiency | 4 | 4 | Skip is the only shortcut; unchanged. |
| 8 | Aesthetic and Minimalist Design | 4 | 4 | Panel 2 illustration still 90pt taller (565 vs 475); title lands at different vertical position. Unchanged. |
| 9 | Error Recovery | 3 | 3 | No back affordance once Skip taps; unchanged. |
| 10 | Help and Documentation | 4 | 4 | Body copy still tells *what*, not *why* in Green Book lineage sense; unchanged. |
| **Total** | | **35/40** | **36/40** | **Good — intent now documented where it was previously mistaken for a bug.** |

## Anti-Patterns Verdict

**Reserved colors: clean.** `wiltedgreen` full-bleed background, `freshgreen` CTA fill on colored surface, white text. No orange/red/navy/yellow/pink. Unchanged from Phase 1.

**Icon rule: N/A.** No icons in onboarding.tsx.

**Tap-target rule: still the Skip ambiguity, now better-documented.** The `fill="transparent"` Button consumer is intentional — the Button component (lines 122-126 of `components/Button.tsx`) explicitly underlines the transparent-variant label as a link-style affordance, and the Pressable container is the full 44pt height. So the *hit area* is 44pt; the *ink area* is the underlined text. The CLAUDE.md flag ("relevant to the tap-target rule") is accurate but the rule's literal text — "invisible tap area below visible affordance" — is *not* violated here: the tap area is bigger than the ink, not smaller. The remaining concern is perceptual (users may not perceive 44pt of tappable space around the small underlined label) and pure-AX (no `accessibilityHint`). Demoted from a per se rule violation to a usability finding.

**Inline design values: still in violation.**
- `gap: 32` (line 374) → should be `spacing.xl`
- `paddingHorizontal: 32` (lines 378, 396) → should be `spacing.xl`
- `gap: 16` (line 397) → should be `spacing.md`
- Magic `76` (line 264) and `34` (line 304) still have no token home. `spacing.xs * 19`? No — these are real Figma-anchored values; they belong as module-level named constants (e.g. `TITLE_TOP_OFFSET`, `ACTIONS_BOTTOM_INSET`) with comments tying them to Figma.

Phase 1's P2 finding here is verbatim still applicable. No changes to the styles block since Phase 1.

**Typography deviation:** `largeTitleEmphasized` for the title, `bodyRegular` for body — both wrapped in `dynamicType(...)`. Phase 2 Dynamic Type convention correctly inherited (this was *not* the case at Phase 1 — Phase 1 noted plain `typography.largeTitleEmphasized` and `typography.bodyRegular`). Confirmed at lines 381 and 391.

## Cognitive Load

**Low by design, with one documented-but-still-real load tax.** Three panels, one concept each, one primary action. The 5-dot count for 3 navigable panels still teaches the user that some dots represent screens they haven't met, but the code comment (lines 146-154) now explains the rationale: keeping the dots in sync with the VoiceOver "page X of N" spoken count, which must match the downstream `/permissions` and `/trusted-contact-setup` screens' `total={5}`. This is a defensible cross-flow tradeoff — but it is still a tradeoff. First-time sighted users will briefly puzzle at panel 3 when their swipe doesn't advance the dots.

## Emotional Journey

Unchanged from Phase 1. Panel 1 grounded, Panel 2 warm-but-dense, Panel 3 weakest of the three with the most abstract copy at what should be the sequence climax. No copy changes since Phase 1.

## What's Working

- Phase 2 Dynamic Type convention now applied (`dynamicType(typography.largeTitleEmphasized)` and `dynamicType(typography.bodyRegular)`) — this is the biggest closeout improvement.
- Inline doc comment (lines 146-154) on `ONBOARDING_FLOW_STEPS` explicitly resolves the Phase 1 P1 by stating the cross-flow intent and the VoiceOver/dot-sync constraint. Future readers won't mistake it for a bug.
- Skip button's variant-choice rationale documented (lines 325-330) — explains why `fill="transparent"` and not `secondary outline` (would be wiltedgreen-on-wiltedgreen, invisible).
- All Phase 1 "What's Working" items still hold: full-bleed pager architecture, aspectRatio illustration sizing, `leftPagerRef` latch guard, `Haptics.selectionAsync()`, `adjustable` FlatList + increment/decrement, illustration AX labels, StatusBar `style="light"`.

## Priority Issues

**[P1] Skip button has no `accessibilityHint` — Phase 1 finding still open**
- What: The `Skip` Button (lines 331-338) sets `accessibilityLabel="Skip onboarding"` but no `accessibilityHint`. Phase 1's P1 explicitly recommended `accessibilityHint="Skips the intro and goes to permissions"`. Not applied.
- Why it matters: Phase 2's Accessibility convention has `accessibilityHint` for "consequence isn't obvious" actions (per Button.tsx's own type-comment, lines 49-54). "Skip onboarding" names *what* is skipped but not *where the user lands* — which is `/permissions`, a separate flow chunk. Sam (VoiceOver) hears "Skip onboarding" and has no clue whether that means "exit the app", "skip to the home screen", or "skip to permissions setup". The hint is the canonical way to disclose destination.
- Fix: Add `accessibilityHint="Skips the intro and goes to permissions setup"` to the Skip Button. Optional: add the same hint pattern to the Continue button's final-panel state.

**[P2] Inline spacing literals — Phase 1 finding still open**
- What: `gap: 32`, `paddingHorizontal: 32` (×2), `gap: 16` in the StyleSheet. Magic `76` and `34` still inline.
- Why it matters: `.cursorrules` anti-slop rule #2. The project's spacing scale (`spacing.xl=32`, `spacing.md=16`) was available at Phase 1 and remains available; no migration has happened on this file.
- Fix: `gap: 32 → spacing.xl`, `paddingHorizontal: 32 → spacing.xl`, `gap: 16 → spacing.md`. Extract `76` as `TITLE_TOP_OFFSET` (module-level, with comment: "Figma y=123 minus safe-area inset") and `34` as `ACTIONS_BOTTOM_INSET` (with comment tying it to Figma).

**[P2] Panel 3 copy still breaks the concrete-to-abstract promise — Phase 1 finding still open**
- What: Body unchanged from Phase 1: "Fresh Greens integrates your intuition into the navigation, creating a driving experience specific to you." Still product-speak at the sequence climax.
- Why it matters / Fix: Identical to Phase 1's P2. Suggested rewrite: "Mark routes and places you'd rather avoid. Fresh Greens factors your choices into every route it recommends."

**[P3] No emotional bridge between panel 3 and `/permissions` — Phase 1 finding still open**
- Unchanged. Direct cut from warm illustrated panel to permissions sheet. Same recommendation as Phase 1.

## Persona Red Flags

**Sam (accessibility):** Now improved on the Dynamic Type front (titles scale, body scales). The dot-count discrepancy from Phase 1 is now intentional and the comment confirms VoiceOver's "page X of 5" matches what Sam hears throughout the journey — Phase 1's "increment past panel 3 does nothing" concern is partly mitigated by `handleDragEnd` triggering `goToPermissions()` past the last panel, but `onAccessibilityAction` for `increment` at `pagerIndex === PANELS.length - 1` does *not* invoke `goToPermissions()` (lines 249-255). VoiceOver users have no equivalent of the bounce-past-last-panel exit. Recommend extending the increment handler: when already on the last panel, call `goToPermissions()`.

**Casey (distracted mobile):** Skip is still the perceptual weak spot. The transparent-on-wiltedgreen white-underlined-text variant, while AX-correct in hit area, demands more visual attention than Continue. Casey one-handing at a red light is likely to tap Continue three times.

**Black driver assessing safety:** Onboarding's copy is unchanged from Phase 1; the trust-building and the "treatment of Black visitors" framing observations apply identically.

## Minor Observations

- `onScrollEndDrag` (line 290) still fires on any drag end; reverse drag on panel 1 enters the handler but the offset check correctly no-ops. Phase 1 observation still accurate.
- `setPagerIndex` updates only on `onMomentumScrollEnd`, not on programmatic `scrollToIndex` calls. Works in practice because momentum-scroll-end fires after the programmatic animation completes — confirmed by the Continue button incrementing the dot correctly. Phase 1 noted this; remains a latent edge if RN ever changes that behavior.
- Panel 2 illustration container still 90pt taller (565 vs 475). Phase 1 visual observation unchanged.

## Questions to Consider

1. Now that `ONBOARDING_FLOW_STEPS = 5` is documented intent (not a bug), should the VoiceOver `accessibilityLabel` on the FlatList be reworded — e.g. "Onboarding intro, panel 1 of 3, step 1 of 5" — to disclose both layers? Current "page 1 of 5" leaves Sam wondering why incrementing past page 3 hands off to a different flow surface.
2. Skip's `fill="transparent"` is correct *for the surface* (transparent is the variant designed for colored bg, per Button.tsx line 87). Should the screen have a higher-emphasis "Skip → I'll set this up later" affordance for Casey, or is low-emphasis the intentional product call (trust the user to read the screen)?
3. Should `TITLE_TOP_OFFSET=76` and `ACTIONS_BOTTOM_INSET=34` move into `theme/spacing.ts` as semantic constants alongside `safetyCardHeight`, given they're Figma-anchored screen-level offsets the spacing ramp can't express?
