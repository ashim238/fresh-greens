---
target: app/sign-out.tsx
phase: closeout
total_score: 30
p0_count: 0
p1_count: 2
p2_count: 2
timestamp: 2026-06-20
slug: app-sign-out-tsx
---

## Phase 1 vs Closeout

| Metric | Phase 1 (2026-06-19) | Closeout (2026-06-20) | Delta |
|---|---|---|---|
| **Total score** | 28/40 | 30/40 | **+2** |
| **P0 count** | 0 | 0 | 0 |
| **P1 count** | 2 | 2 | 0 |
| **Rating band** | Acceptable — emotionally thin | Good (low end) — voice corrected, structure unchanged | — |

### Findings delta

- **[Phase 1 P2 → resolved]** Subtitle copy. PR #243 swapped "Thank you for stopping by!" for "Drive safe." This was tagged P2 in the Phase 1 priority list, but it was also the screen's emotional core failure (called out explicitly in the Black-driver persona section as "the screen's most important issue, and the lowest-code fix"). The fix lands. "Drive safe." is in the companion voice — short, steady, presumptive of return, honors the safety frame without invoking it. Heuristic #2 (Match System / Real World) moves 3 → 4; persona red flag for Black-driver-in-charged-moment now closed. Aesthetic / minimalist (#8) holds at 3 — copy was never the visual problem.
- **[P1 unchanged]** `alignSelf: 'flex-start'` + `width: 163` on the Button. Left-anchored, undersized CTA still reads as left-third pill rather than confident exit affordance. No change since Phase 1.
- **[P1 unchanged]** `gap: 43` in `styles.content` still off the 4pt ramp, still unexplained. `theme/spacing.ts` still warns against this exact pattern.
- **[P2 unchanged]** Illustration is still the rotated pin + car from `permissions-*.svg`. Still semantically borrowed.
- **[P3 unchanged]** Illustration wrappers still carry no `accessible={false}` / `importantForAccessibility="no-hide-descendants"`. VoiceOver traversal hazard persists.

Net: PR #243 made the right call on the lowest-code, highest-emotional-leverage issue. Score lift is modest (+2) because the structural problems flagged in Phase 1 (left-anchored button, off-ramp gap, borrowed illustration, a11y on decorative SVGs) were all out of #243's scope and carry forward verbatim. The screen is no longer tonally wrong; it is still structurally thin.

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Screen exists and confirms sign-out clearly; no loading/progress state needed for this moment |
| 2 | Match System / Real World | 4 | "You've been logged out." is literal. "Drive safe." is the companion voice — domain-appropriate, honors the safety frame, presumes return |
| 3 | User Control and Freedom | 1 | `router.replace('/login')` kills the stack; no cancel affordance upstream; arriving here IS the point of no return |
| 4 | Consistency and Standards | 3 | Tokens used throughout, `dynamicType` applied, `Button` component used correctly. `gap: 43` off the 4pt ramp drops the otherwise-clean discipline a tier |
| 5 | Error Prevention | 4 | Confirmation screen for an action that already happened. N/A in the classic sense |
| 6 | Recognition Rather Than Recall | 3 | Single-action screen — not a recall problem. Illustration semantically ambiguous |
| 7 | Flexibility and Efficiency | 3 | One path in, one path out. Appropriate for a confirmation screen |
| 8 | Aesthetic and Minimalist Design | 3 | Clean. Two lines, one CTA, one illustration. Left-anchored CTA still reads as a left-fragment, not a deliberate composition |
| 9 | Error Recovery | 2 | Not an error screen. "What do I do next?" path weakened by 163pt fixed-width left-aligned CTA reading smaller than the moment deserves |
| 10 | Help and Documentation | 4 | No help needed; copy now carries enough context on its own |
| **Total** | | **30/40** | **Good (low end) — voice corrected, structure unchanged** |

## Anti-Patterns Verdict

**Not AI slop.** No gradient text, no glassmorphism, no eyebrow labels, no decoration for decoration's sake. Token discipline clean. Voice now matches the rest of the app — "Drive safe." sits naturally next to "You're not alone" and "Talk to us. What's going on?" from elsewhere.

The Phase 1 soft flag (retail-app farewell) is closed. No new slop introduced. The remaining structural issues (left-anchored CTA, off-ramp gap, borrowed illustration) are craft debt, not slop tells.

## Cognitive Load

| Item | Status |
|------|--------|
| 1. Single clear primary action | Pass — one CTA, zero ambiguity |
| 2. Copy is scannable in one pass | Pass — two short lines, second now meaningfully short ("Drive safe." vs the Phase 1 8-word retail line) |
| 3. No unnecessary decisions presented | Pass |
| 4. Visual hierarchy leads the eye correctly | Partial — `gap: 43` still treats illustration and title as peers; 89pt illustration on `wiltedgreen` still low-contrast |
| 5. Color carries meaning, not decoration | Pass |
| 6. Tap target meets HIG minimum | Fail — `alignSelf: 'flex-start'` + `width: 163` still produces a 163×44pt button that reads as a left-fragment |
| 7. Dynamic Type applied to all text | Pass |
| 8. Illustration communicates screen's purpose | Fail — borrowed permissions-flow assets, unchanged since Phase 1 |

5 pass / 1 partial / 2 fail. Phase 1 was 5/1/2 with the same distribution; item 2 went from Pass-but-tonally-off to Pass-clean.

## Emotional Journey

This is the biggest change since Phase 1, and it is real.

User arriving here may have just ended a charged session — pulled over, ride home alone, location shared with a trusted contact. The Phase 1 subtitle ("Thank you for stopping by!") read as the platform being unaware of what just happened — retail farewell for a safety tool. That was the screen's worst failure mode and the easiest to fix.

"Drive safe." reframes the moment entirely. Two words, no exclamation point, presumes the road continues. It is the companion-voice register the brand promises — said the way one driver says it to another at a parting, not the way a website says it to a closed tab. The Green Book lineage in the brand has a register for this kind of departure, and "Drive safe." is inside it.

What still misses: the illustration. Rotated pin + car was wrong for this moment in Phase 1 (it speaks to anticipation, not departure) and is still wrong here. A screen whose copy has been deliberately tuned for a freighted moment now sits above an illustration borrowed from the onboarding flow. The voice fix throws the visual mismatch into sharper relief, not softer.

CTA "Log back in" remains neutral and functional — fine. The button's left-anchored composition still understates the moment; "Drive safe." deserves a CTA that looks like it agrees with the sentiment, not one that hangs off the left margin.

## What's Working

**1. Copy fix lands cleanly.** "Drive safe." is the right call — short, steady, in voice, presumes return. The Phase 1 critique's concern (companion-voice farewell, not retail farewell) is resolved with two words and a period.

**2. Token discipline holds.** Every color still a named token. `signOutSubtitle` token still meaningfully distinct from `white`. No regressions in the discipline that was praised in Phase 1.

**3. `router.replace` pattern still intentional and correct.** Comment block at the top of the file remains a model for documenting non-obvious navigation choices.

## Priority Issues

**[P1] Button is left-anchored and undersized — unchanged from Phase 1**
- What: `alignSelf: 'flex-start'` + `width: 163` still produces a left-third pill. Visually small relative to the 28pt title above it.
- Why it matters: With the copy now tuned for emotional weight, the CTA composition is the next-most-visible thing that doesn't match that weight. A confident farewell deserves a confident exit affordance.
- Fix: `alignSelf: 'stretch'` (full-width, matches the permissions-screen pattern this screen visually echoes) or `alignSelf: 'center'` with `minWidth: 200`.
- Suggested command: `/impeccable layout app/sign-out.tsx`

**[P1] `gap: 43` still off the 4pt ramp — unchanged from Phase 1**
- What: `gap: 43` in `styles.content`. Not on `spacing.xl` (32) or `spacing.xxl` (48). No comment explains.
- Why it matters: `theme/spacing.ts` explicitly calls out "stragglers at 5/6/13/18/20/23" as the problem the spacing token was created to solve. 43 is a new straggler living in a screen with no complex layout reason for sub-ramp precision.
- Fix: Change to `spacing.xxl` (48) or `spacing.xl` (32); whichever reads better at runtime. If Figma genuinely specifies 43, document the node reference in a comment.
- Suggested command: `/impeccable layout app/sign-out.tsx`

**[P2] Illustration still semantically borrowed — unchanged from Phase 1**
- What: `PermissionsLocation` + `PermissionsCar` reused. Asset names betray origin.
- Why it matters: The voice fix puts pressure on the visual to match. A copy line that has been deliberately tuned for a freighted moment now sits over a borrowed illustration. The mismatch is more visible now than it was in Phase 1.
- Fix: (a) Sign-out-specific illustration (parked car, key, door at rest) or (b) remove the illustration entirely and let `title1Emphasized` + `subheadlineRegular` carry the moment.
- Suggested command: `/impeccable distill app/sign-out.tsx` (option b) or design work (option a)

**[P2] Illustration wrappers still missing a11y treatment — unchanged from Phase 1**
- What: View wrappers around `PermissionsLocation` and `PermissionsCar` carry no `accessible={false}` / `importantForAccessibility="no-hide-descendants"`.
- Why it matters: WCAG 2.1 AA target. Decorative SVGs will either announce file-name fragments or expose raw SVG node trees to VoiceOver. Phase 2 conventions covered this exact pattern elsewhere in the app.
- Fix: Add `accessible={false}` and `importantForAccessibility="no-hide-descendants"` to `styles.illustration`.
- Suggested command: `/impeccable audit app/sign-out.tsx` (for the full a11y sweep) or one-line edit

## Persona Red Flags

**Sam (accessibility):**
Illustration a11y still missing. VoiceOver behavior unchanged from Phase 1 — file-name fragments or raw SVG traversal. Two text nodes are fine. CTA inherits correct role from `Button`. One concrete failure unchanged.

**Casey (distracted mobile):**
CTA still left-anchored and 163pt wide. Casey thumbing for the button still has to aim left-of-center, which is the harder thumb arc on a right-handed grip. Centered or full-width fixes this without other cost.

**Black driver assessing safety in a charged moment:**
Phase 1 called this the screen's most important issue. It is now closed. "Drive safe." is the right thing for this user on this screen at this moment — concise, presumes the road, honors the frame without naming it, said in the voice of someone who has been with them. The persona red flag that was a screaming alarm in Phase 1 is now silent. This alone justifies PR #243.

## Minor Observations

- `paddingBottom: 56` still off the 4pt ramp (`spacing.xxl = 48`). Worth bundling with the `gap: 43` fix.
- `StatusBar style="light"` still correct.
- `width: 163`, `left: 10.71`, `top: 48.55`, `height: 33.797` — sub-pixel Figma values. Defensible for SVG-faithful positioning; would be more defensible with a one-line comment naming the Figma node.
- Comment on `subtitle` still references "the 2026-06-01 text-size audit" and the 13pt-vs-15pt rationale. Worth keeping; this is exactly the kind of decision-justification that survives code review.

## Questions to Consider

1. With "Drive safe." in place, does the illustration still earn its space? Or does removing it let typography carry the moment with more confidence than borrowed SVGs ever could?
2. Is the left-anchored CTA a Figma-faithful decision or a screen-port artifact? Worth checking the Figma node before changing — but if it was an artifact, a full-width or centered CTA is the easier on-brand move.
3. Could the `gap: 43` value be the result of a Figma frame measuring the gap between two illustration baselines rather than two content boundaries? If so, the fix is to remeasure from the content edge, which usually lands on a ramp value.
