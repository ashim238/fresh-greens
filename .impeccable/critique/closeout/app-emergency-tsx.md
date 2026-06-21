---
target: app/emergency.tsx
total_score: 34
p0_count: 0
p1_count: 2
timestamp: 2026-06-20-closeout
slug: app-emergency-tsx
phase: closeout
---

## Then vs now

**Phase 1:** 34/40 · 0 P0, 2 P1, 2 P2, 2 P3 (6 priority findings).
**Closeout:** 34/40 · 0 P0, 2 P1, 2 P2, 2 P3 (6 priority findings).
**Delta:** 0 (zero file changes since Phase 1; PR #242 VoiceOver hint depth + PR #246 dismissal standardization both deliberately excluded this surface).

`git log --since="2026-06-19" -- app/emergency.tsx` returns empty. The screen is bit-for-bit identical. What changed is the project around it: PR #242 established a "Action + safety-window" VoiceOver hint convention across other safety-critical surfaces, and PR #246 standardized swipe-down dismissal on safety-critical modals. PR #242's pre-implementation audit found emergency.tsx's existing labels already disambiguate fully ("Call [contact]. Three-second cancel window." / "Call 911. Three-second cancel window.") and skipped it; PR #246's countdown-as-confirmation-gesture rationale applies here (the 3-second window IS the intent gesture). Both exclusions are honest. So this closeout is asking a narrower question than the typical Phase 1 → closeout delta: do the same six Phase 1 findings still stand under Phase 2's stricter conventions, and does the unchanged code now feel inconsistent with sibling safety surfaces that did get touched?

Verdict: Phase 1 findings stand intact. The H4 (Consistency) score is the one place where the answer is non-obvious — emergency's labels intentionally encode their hint inline ("Three-second cancel window") rather than splitting into a separate `accessibilityHint`, which is now a project-wide pattern on other safety surfaces. That's a defensible variant, not a drift: emergency's labels are short enough to fit the hint inline without breaking VoiceOver's first-pass announcement, and the safety-window phrase is the single most load-bearing piece of disclosure on the screen. Splitting it into a hint would bury it behind the first announcement. The H4 score (3) holds.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Unchanged. Live countdown numeral + `accessibilityLiveRegion="polite"` + haptic metronome (Selection × 2) still a complete three-channel status system |
| 2 | Match Between System and Real World | 4 | Unchanged. "Need help? / You choose who responds." still lands at the right register; 3-second confirm-before-dial maps to universal mental model |
| 3 | User Control and Freedom | 4 | Unchanged. Stop on countdown, scrim-dismiss on idle, mid-countdown pivot. Scrim correctly locks during countdown. Sibling surfaces' swipe-down dismissal added in PR #246 deliberately omitted here because the countdown IS the dismissal-confirmation gesture — honest carve-out, not a gap |
| 4 | Consistency and Standards | 3 | Unchanged from Phase 1 — and now slightly more interesting. PR #242 established split label/hint convention on sibling safety surfaces; this file inlines the safety-window into the label. Defensible variant (short label + load-bearing disclosure that mustn't be buried in the hint), but worth a one-line comment marking it as a documented exception. The original Phase 1 issue (idle subtitle implies button peerage while hierarchy treats them as primary/secondary) still stands |
| 5 | Error Prevention | 3 | Unchanged. 3-second cancel window remains primary mechanism; no-contact branch still routes away from the emergency surface |
| 6 | Recognition Rather Than Recall | 4 | Unchanged. Pivot link surfaces alternative at exact moment of need |
| 7 | Flexibility and Efficiency of Use | 3 | Unchanged. Hint at `footnoteRegular`/`labelTertiary` still the weakest legibility at the highest-stakes moment |
| 8 | Aesthetic and Minimalist Design | 4 | Unchanged. Idle 6 elements / countdown 3 elements; no decorative chrome |
| 9 | Help Users Recognize, Diagnose, and Recover | 3 | Unchanged. `dialOrWarn` Alert remains the recovery channel; no-contact state still gives no in-card feedback |
| 10 | Help and Documentation | 2 | Unchanged. Disc numeral as "seconds remaining" still machine-only to VoiceOver; sighted users still infer |
| **Total** | | **34/40** | **Strong — execution-quality issues, no structural gaps; identical to Phase 1** |

## Anti-Patterns Verdict

**Still not AI slop.** The same evidence holds: deliberate haptic vocabulary, no decorative reserved-color use, typography choices argued from first principles, dense and honest comments. The `countdownNumber` un-`dynamicType`'d exception is still undocumented in code (Phase 1 P2 finding stands).

One closeout-only observation: across Phase 2 polish work this file picked up zero churn. That itself is a signal — when sibling safety surfaces (pulled-over, safety, share-location) were earning multiple PRs of token / tap-target / a11y polish, emergency.tsx earned nothing. Possibilities: (a) it's genuinely done, (b) the team treated it as too-load-bearing-to-touch, (c) it's been overlooked. The Phase 1 priority issues argue against (a). The fact that every issue is execution-quality polish (none structural) argues for (b) — a reasonable instinct on a safety-critical surface, but the P1/P2 polish items would still be net positive.

## Cognitive Load

| Item | Status | Notes |
|------|--------|-------|
| Single clear primary action per state | Pass | Unchanged from Phase 1 |
| Irreversible actions gated | Pass | Unchanged — 3-second countdown + scrim lock during countdown |
| State transition clearly communicated | Pass | Unchanged — title swap + Medium haptic + VoiceOver announcement |
| No information lost on state change | Pass | Pivot preserves alternative path mid-countdown |
| Labels self-describing | Partial | Disc numeral still not labelled "sec" for sighted users (Phase 1 P1 unchanged) |
| No competing visual priorities | Pass | Unchanged |
| Error states distinguishable | Partial | No-contact button visually identical to has-contact (Phase 1 finding unchanged) |
| Charged-moment copy register | Pass | Unchanged — "Need help?" at title1Regular, "You choose who responds." still doing the thesis-encoded emotional work |

**Cognitive load summary: Low.** Identical to Phase 1.

## Emotional Journey

Unchanged from Phase 1 in every meaningful respect. The closeout-relevant lens is whether the screen *feels* different now that sibling safety surfaces have been polished: pulled-over gained a "Recording saved" terminal state; safety-settings tightened its grouping; share-location standardized its dismissal affordance. Against that backdrop, emergency.tsx reads as if the team made a deliberate choice not to touch the most charged moment in the app. Defensible — change-aversion on safety-critical surfaces is the right default — but the Phase 1 P1 findings (countdown disc unlabelled for sighted users; hint contrast at the wrong altitude) are still the two single highest-leverage emotional improvements available, and shipping neither leaves the strongest moment in the thesis (Black driver in a charged moment) one polish-pass short of where the rest of the surface area is.

The pivot architecture, the haptic vocabulary, the "You choose who responds" copy — still all working at the level Phase 1 described.

## What's Working

Three things the closeout view confirms are still the right calls:

**1. Inline safety-window in the accessibilityLabel.** PR #242's audit reasoning still holds: "Call 911. Three-second cancel window." reads cleanly in a single VoiceOver pass. A split label/hint here would bury the disclosure the user most needs to internalize. Worth noting in a code comment that this is an intentional deviation from PR #242's convention so a future audit doesn't "fix" it.

**2. Countdown-as-confirmation-gesture.** PR #246's swipe-down dismissal didn't land here because the 3-second Stop window IS the deliberate confirmation gesture — adding a second gesture would dilute its meaning, not reinforce it. The Stop affordance + scrim-locked-during-countdown is already the canonical "you can change your mind" surface.

**3. Zero churn on the most charged surface.** Stability has value on the screen the user reaches in their worst moment. The Phase 1 craft observations (haptic vocabulary, pivot architecture, "You choose who responds.") all stayed intact — nothing regressed across Phase 2 polish.

## Priority Issues

All six Phase 1 findings remain. Re-presented at closeout severity:

**[P1] Countdown disc numeral is not labelled for sighted users** — Unchanged. Inline "sec" label inside the disc remains the right fix. Most acute moment in the app; inference still required.

**[P1] Hint text contrast is weakest element at most critical moment** — Unchanged. `footnoteRegular` + `labelTertiary` for the safety-window disclosure is still the wrong altitude. Bump to `subheadlineRegular` + `labelSecondary` or restructure into button sub-labels.

**[P2] No-contact state offers no recovery path within card** — Unchanged. Still the single most thesis-relevant gap: the driver who specifically does NOT want to call 911 by default is the driver who hits this failure mode hardest. Fix-in-card with inline "No contact set — tap to add one" still beats routing away mid-emergency.

**[P2] `sosCountdown` typography not wrapped in `dynamicType`** — Unchanged. Still no documenting comment. Low-cost fix; high latent risk if a future "consistency" pass adds `dynamicType` here.

**[P3] `StatusBar style="dark"` may not survive transparentModal context** — Unchanged. Still untested.

**[P3] `colors.labelSecondary` is opaque rather than alpha-blended** — Unchanged. Systemic token concern, not specific to this surface.

**One new closeout-specific [P3]:** Mark the inline-safety-window label pattern as an intentional deviation from PR #242's split-hint convention. A short code comment ("// Inline safety-window in label, not hint — short labels + load-bearing disclosure that mustn't be buried behind first VoiceOver pass; do not split per PR #242 convention") would protect against a future "consistency" audit refactoring it.

## Persona Red Flags

**Sam (accessibility):** Same gaps as Phase 1. Scrim still `accessible={false}` (correct, but VoiceOver users still rely on X close button only). New context: the inline safety-window in the label means Sam hears the disclosure on first VoiceOver pass — which is arguably *better* for Sam than the split label/hint pattern PR #242 adopted elsewhere. Worth confirming with a Sam-equivalent user that this preference holds.

**Casey (distracted driver):** Same gaps as Phase 1. Haptic metronome is still Casey's best friend; unlabelled disc numeral still the specific failure point.

**Black driver in charged moment (THE persona):** Same verdict — earns trust, with the same no-contact gap. The closeout question is whether shipping Phase 2 polish on sibling safety surfaces while leaving this surface untouched is the right resource allocation. Argument for: stability on the most charged surface has value. Argument against: this is the screen the thesis stands or falls on, and the P1 findings are net-positive low-risk craft polish, not redesigns.

## Minor Observations

- All four Phase 1 minor observations still apply (countdownTitle wrap at AX5, exitCluster gap, Asterisk weight confirmation, card maxWidth at iPad portrait).
- The fact that PR #242 audit logic recorded this file as already-disambiguated is worth preserving in a comment near the `accessibilityLabel` strings — institutional memory.

## Questions to Consider

The five Phase 1 questions all still apply unchanged. One closeout addition:

6. The pattern of "PR #242 audit excluded this file because labels already disambiguate" + "PR #246 dismissal convention doesn't apply because countdown IS the confirmation gesture" represents real, useful design judgment — but it lives in PR descriptions, not in this file's source. Is one or two lines of comment in `emergency.tsx` enough to preserve that reasoning at the point a future developer asks "why doesn't this match the rest of the safety surfaces?"
