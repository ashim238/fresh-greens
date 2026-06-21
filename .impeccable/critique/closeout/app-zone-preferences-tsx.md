---
target: app/zone-preferences.tsx
phase: closeout
phase1_score: 24
closeout_score: 29
phase1_p0: 0
phase1_p1: 2
closeout_p0: 0
closeout_p1: 1
delta: +5
timestamp: 2026-06-20T00-00-00Z
slug: app-zone-preferences-tsx
---

## Phase 1 vs Closeout

| | Phase 1 (2026-06-19) | Closeout (2026-06-20) | Δ |
|---|---|---|---|
| Total score | 24/40 (Acceptable) | 29/40 (Good) | **+5** |
| P0 | 0 | 0 | 0 |
| P1 | 2 | 1 | **−1** |
| P2 | 2 | 1 | −1 |

**Closed since Phase 1:**
- **P1 — Silent degradation resolved.** PR #244 introduced `allFlagsOff` (verified at line 59) and swaps the "What we flag" RowGroup footer to *"All three off — routes are scored on distance and time only. No safety signals factor in."* Honesty-of-disclosure satisfied in-register, no banner needed, no chrome added — the footer slot itself carries the truth. Heuristics 5 (Error Prevention) and 9 (Error Recovery) move 2→3.
- **P2 — Hydration lag resolved as a side effect.** The whole render is now gated by `prefsState.ready` (line 51). No defaults flash, no pre-hydration tap race. Heuristic 1 (Visibility of System Status) moves 2→3.

**Still open from Phase 1:**
- **P1 — Route-scoring consequence still invisible at point of decision.** Toggle labels remain bare ("Police presence", "Low-light areas", "Community reports"). The footer now tells the truth about the *aggregate* OFF state but no per-row consequence text appears. Heuristic 6 stays at 2; Heuristic 10 lifts only to 2 (the degraded footer is help, but it's conditional and aggregate, not point-of-decision).
- **P2 — Separator inset still 56pt without icons.** No icons added; cosmetic hairline misalignment unchanged.
- **"Show zones overlay" group still has no title/footer.** Floating one-toggle card with abstract label; closure unchanged.

---

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | `ready` gate eliminates hydration flash; no save-confirmation toast but toggle is its own confirmation |
| 2 | Match System / Real World | 3 | "Community reports" still slightly abstract; otherwise plain English |
| 3 | User Control and Freedom | 3 | Back + close-X dual exit; no "Reset to defaults" but low-stakes given binary toggles |
| 4 | Consistency and Standards | 4 | iOS grouped-settings register held; token-driven |
| 5 | Error Prevention | 3 | Degraded state is now disclosed honestly via footer swap; no longer silent |
| 6 | Recognition Rather Than Recall | 2 | Per-row routing consequence still absent — aggregate footer doesn't cover individual decisions |
| 7 | Flexibility and Efficiency | 2 | No bulk reset, no "all off" → "all on" accelerator |
| 8 | Aesthetic and Minimalist Design | 3 | Footer copy swap is in-register, no visual weight added |
| 9 | Error Recovery | 3 | Degraded state surfaces and self-clears the moment any flag flips back on |
| 10 | Help and Documentation | 3 | Footer is now conditionally informative; per-row help still missing |
| **Total** | | **29/40** | **Good — address weak areas, solid foundation** |

## Anti-Patterns Verdict
LLM: No AI slop. Still HIG-native, token-disciplined, no gradient text, no eyebrows, no glassmorphism. The conditional footer is the most opinionated copy on the screen and it earns its line — it's diagnostic, not decorative. Detector not re-run for this closeout (single .tsx file, prior run clean and surface unchanged structurally).

## Cognitive Load
1/8 checklist failure (low): point-of-decision context for individual toggles still absent. The compound decision model (display vs. routing) is now partially visible because the routing group declares its degraded state aloud — the user can infer the model from the footer's grammar. Working memory is in bounds (4 toggles, two groups).

## Emotional Journey
The footer swap is the right move. Phase 1 read like engineer release notes; the closeout copy reads like a steady disclosure — *"No safety signals factor in"* names the consequence without alarm. It's the Steady Companion voice arriving in the one slot where it matters most: the moment a user has just disabled the thing the product is for. The toggles themselves still read flat, but the page-level honesty is now intact.

## What's Working
- **The conditional footer is the right primitive.** Using the existing RowGroup footer slot — same type ramp, same color, same inset — to carry degraded-state truth avoids inventing a banner component and keeps the surface from gaining chrome. This is the disciplined version of the P1 fix.
- **`ready` gate fixes a problem the prior critique called P2 — quietly.** No flash, no race, no extra prop on Switch. Side-effect of the same PR; structurally cleaner than the suggested "disable Switch during loading" approach.
- **The IIFE pattern is honest about the data dependency.** Destructuring the four flags at the top of the gated block makes `allFlagsOff` legible; the inline comment (lines 52–56) anchors the *why* for future readers.

## Priority Issues

**[P1] Route-scoring consequence still invisible at point of decision**
- What: Each "What we flag" toggle still has only a label and AX hint; no `value` prop, no inline consequence. The aggregate footer now tells the truth when all three are off, but a user toggling *one* flag off gets no signal about what that single decision changes.
- Why it matters: Phase 2 polish target. The all-off case is the cliff; the one-off and two-off cases are the slope, and they're unannounced. For a Black driver toggling "Police presence" off in a charged moment, the absence of per-row consequence text is a missed reassurance.
- Fix: Add `value="Routes around mapped police presence"` (and equivalents) via SettingsRow's existing `value` prop. No new component, no extra row.
- Suggested command: /impeccable clarify

**[P2] "Show zones overlay" group still floats without anchoring context**
- What: Isolated RowGroup with one toggle, no title, no footer (line 65–73). Carried forward from Phase 1.
- Why it matters: Display preference vs. routing preference is a real distinction the IA is making visually but not verbally. A one-line footer would cost nothing and cement the model.
- Fix: Add `footer="Turns on a map layer showing police, low-light, and community-flagged zones."` to the first RowGroup.
- Suggested command: /impeccable clarify

**[P3] Separator inset still 56pt without icons**
- What: Carried forward. Hairline starts mid-label.
- Fix: Either add Phosphor icons to the three flag rows (improves scannability) or make the inset adaptive.
- Suggested command: /impeccable polish

## Persona Red Flags

**Sam (accessibility):** VoiceOver wiring still correct on all toggles. `ready` gate now prevents pre-hydration tap races for switch-access users — a real win. Open gap: the conditional footer swap is announced as label text but not as a state-change event, so a screen reader user who has just toggled the third flag off has to navigate down to the footer to hear the degraded state. Consider an `AccessibilityInfo.announceForAccessibility(...)` on the OFF→all-off transition.

**Casey (distracted mobile):** Full-row tap still doesn't toggle Switch — only the thumb does. Phase 1 finding unchanged. The new conditional footer at least gives Casey a glanceable answer to "did I just turn off the thing the app is for?" without needing to remember what each toggle does.

**Black driver assessing safety in a charged moment:** The page-level honesty is now there. The per-row honesty isn't. "Police presence" still reads as a binary checkbox at the point of decision; only after disabling all three does the surface acknowledge the consequence. Phase 2 P1 above is the close.

## Minor Observations
- `scrollContent` still uses `spacing.lg` horizontal / `spacing.xl` gap — asymmetry carried forward, minor.
- The IIFE inside `ScrollView` is structurally correct but worth extracting as a named helper or splitting into a `<ZonePreferencesContent />` subcomponent if anything else needs to land here. Currently fine.
- No save-confirmation feedback — the toggle's own animation is the confirmation, which is on-register for iOS Settings.app.

## Questions to Consider
- Should the degraded-state footer color shift slightly (e.g. toward `colors.systemRed` at low alpha or a token-defined warning ink) to telegraph "this isn't the default state" without becoming a banner? The current footer uses the same gray as the non-degraded variant — copy carries the signal, color doesn't.
- Should `AccessibilityInfo.announceForAccessibility` fire on the all-off transition so VoiceOver users hear the degraded state without hunting for the footer?
- Is "All three off" the right phrasing, or does "All safety signals off" land harder? The current copy is honest but slightly mechanical.
