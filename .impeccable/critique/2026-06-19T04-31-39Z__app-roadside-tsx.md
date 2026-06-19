---
target: app/roadside.tsx
total_score: 26
p0_count: 1
p1_count: 3
timestamp: 2026-06-19T04-31-39Z
slug: app-roadside-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | "Locating…" chip is the only progress signal; geocoding failure silently freezes at "Your location" with no indication the system gave up |
| 2 | Match System / Real World | 3 | Three-step state machine matches the distress flow mental model; minor mismatch: "What you shared" card label suggests past tense but sharing is still live |
| 3 | User Control and Freedom | 2 | Step 3 traps dismissal via `usePreventRemove` with no visible escape; user locked in with only "I'm back on the road" or "Switch to Pulled-over mode" |
| 4 | Consistency and Standards | 3 | Row pattern consistent across steps; sectionLabel uses same visual weight as supporting metadata, so section headers don't read as headers |
| 5 | Error Prevention | 2 | "I figured it out" fires `router.back()` immediately with no confirmation; WrongSpotModal has no accessible cancel button |
| 6 | Recognition Rather Than Recall | 3 | Problem icons plus labels good; Step 2 carries selected problem forward in headline; action rows lack indication which is recommended |
| 7 | Flexibility and Efficiency | 2 | No fast path for returning users who always call the same service; must advance through Step 1 every time |
| 8 | Aesthetic and Minimalist Design | 3 | Three-row action list and single-card status view are lean; sharedCard's inline bullet concatenation disguises that "Messages opened for Alex" is categorically different from situation facts |
| 9 | Error Recovery | 2 | WrongSpotModal geocode failure shows error string but no suggestion of what to try; call-path failure is dead-end Alert with no next step |
| 10 | Help and Documentation | 3 | "Let's get you the help you need." positions the app as companion; no guidance for users with no roadsideProfile — row becomes "Set up your roadside service" mid-distress |
| **Total** | | **26/40** | **Acceptable (20-27)** |

## Anti-Patterns Verdict

No AI slop. The banned patterns are all absent: no gradient text, no glassmorphism, no eyebrow labels on every section, no identical decorative card grids, no side-stripe borders. The screen reads as methodically HIG-native. The one texture that brushes the line is the bullet-concatenated sharedCard body (line 511), which has a slightly algorithmic feel — it looks like `array.join(' • ')` in the rendered output because it literally is — but it does not trigger the slop verdict.

## Cognitive Load

| Item | Pass/Fail | Notes |
|------|-----------|-------|
| Single focus per step | Pass | Each step has one primary question or status |
| Chunking ≤4 per group | Fail | Step 1 presents 5 problem options — one over the limit |
| Meaningful grouping | Pass | Problem list / action list / status card cleanly separated |
| Visual hierarchy | Fail | Step 3's "If this gets worse" has same visual weight as supporting metadata |
| One-thing-at-a-time | Pass | Modal enforces one sub-flow per step |
| ≤4 options per decision | Fail | Step 1: 5 options; Step 2: 3 action rows plus escape CTA borderline |
| Working memory relief | Pass | Step 2 headline rebuilds context so user never carries Step 1 choice mentally |
| Progressive disclosure | Pass | Trusted-contact share only appears if user has a contact configured |

**Failures: 3 — Moderate cognitive load**

## Emotional Journey

**Peak moment:** The "Got it." + location-anchored headline on Step 2 is the strongest emotional beat. It is fast, names the user's situation specifically, gives three distinct paths to help without overwhelming. Calm competence at the moment the user most needs it.

**Valley:** Step 3's "What you shared" card. The title is past tense and archival-feeling, at odds with the live moment. The inline bullet string "Flat tire • Park Slope, Brooklyn • Messages opened for Alex at 3:14 PM" reads like a receipt, not reassurance. At a charged moment, a receipt is the wrong register.

**Reassurance at charged moments:** Mostly handled well — haptic success feedback on entering Step 3, the `NotifyingPulse` below the primary CTA, the headline "Help is on the way. Stay where you are." are all grounding. Gap: no emotional acknowledgment that the user is in a stressful situation before the problem picker asks them to categorize it.

## What's Working

**1. The phantom-chevron slot (line 674-677) is excellent invisible craft.** The `backChevronPlaceholder` holds vertical space on Step 1 so the title's y-position stays identical across the Step 1 → Step 2 transition. Users never feel the layout shift because there is none.

**2. The headline rebuild on Step 2 is the screen's most important UX decision.** `buildActionHeadline` reconstructs the user's situation in plain English: "You're in Park Slope with a flat tire." Users don't need to hold their Step 1 choice in working memory while scanning action rows.

**3. The reserved-color rule application on the Siren row is a documented carve-out done right.** The navy `Siren` icon visually signals "this row goes to the Pulled-over safety context" without using navy as decoration or ambient brand color.

## Priority Issues

**[P0] Step 3 dismissal trap has no visible escape affordance**
- What: `usePreventRemove(step === 'status', ...)` blocks sheet dismissal. The user can only exit via "I'm back on the road" or "Switch to Pulled-over mode." `markActionTaken()` is called when share is toggled on (line 183), advancing to Step 3 without deliberate intent. Accidental share toggle = locked into Step 3.
- Why it matters: A user who accidentally toggles share is trapped with no exit except CTAs that carry real consequences.
- Fix: Add a visible "X" or "Done" button on Step 3, or only advance to Step 3 via an explicit "Help is on the way" CTA, not implicitly from the share toggle.

**[P1] "What you shared" card uses wrong register for a live moment**
- What: Line 510-511: title is "What you shared" (past tense), body joins problem/location/messaging-event with " • ". The concatenation shows three semantically different categories as if equivalent.
- Why it matters: At a charged moment, "What you shared" reads as closed summary. The bullet-join buries the most reassuring fact ("Messages opened for Alex at 3:14 PM") as the third item.
- Fix: Rename to "Right now" or "Active" with present-tense body copy. Break facts into a vertical list with distinct labels ("Problem / Location / Notified").

**[P1] "If this gets worse" sectionLabel has insufficient visual weight**
- What: Style at line 848-851 uses `footnoteRegular` at 13pt in `labelSecondary` — same visual level as location chip label. A user scanning Step 3 will not register "If this gets worse" as a section divider.
- Why it matters: The Pulled-over escalation row is the most consequential affordance on Step 3. If the section label doesn't read as a section label, the row's discoverability drops dramatically.
- Fix: Elevate to `subheadlineEmphasized` (600 weight, 15pt) in `black`. Add `spacing.lg` top margin above it.

**[P1] WrongSpotModal has no accessible cancel path**
- What: Only way to close without confirming is to tap the scrim, which is `accessible={false}` and `accessibilityElementsHidden`. No cancel button in `modalCard`.
- Why it matters: VoiceOver user trapped in modal with only confirm available. WCAG 2.1 SC 2.1.2 (No Keyboard Trap) violation.
- Fix: Add a visible "Cancel" button to `modalCard` (text link, `minHeight: 44`, `alignSelf: 'center'`, `color: colors.labelSecondary`).

**[P2] "I figured it out" fires with no confirmation**
- What: `onFiguredOut` calls `router.back()` immediately. No confirmation, no undo.
- Why it matters: One-handed high-stress = accidental taps. Accidentally dismissing the roadside flow mid-distress means reopening from scratch.
- Fix: Add brief "You're sure?" Alert or reposition CTA with stronger spatial separation.

**[P2] No-roadsideProfile state is a mid-distress setup redirect**
- What: If no `roadsideProfile` exists, "Call" row label becomes "Set up your roadside service" and tap pushes `/roadside-setup`. User redirected out of emergency sheet for configuration.
- Why it matters: User with a flat tire who hasn't configured roadside redirected to setup at the exact moment they need help.
- Fix: Show un-configured call row as secondary-state variant with explicit "Add your roadside number first →" treatment so the user can skip to other actions.

## Persona Red Flags

**Sam (accessibility):**
- WrongSpotModal is a VoiceOver trap (see P1).
- `accessibilityRole="link"` on "Wrong spot?" Pressable is incorrect — should be `"button"` (opens modal, not navigation).
- `accessibilityRole="switch"` on share location `View` shadows the inner Switch's own accessibility node — needs device testing.
- `iconCircle` (36×36) doesn't scale with Dynamic Type; at AX5 will look disproportionately small against larger row labels.

**Casey (distracted mobile):**
- `backChevron` uses `alignItems: 'flex-start'` — 28pt CaretLeft left-anchored within 44pt container; left third tap zone for the icon.
- Switch for share location below 44pt floor; row container is `minHeight: 60` but Switch's individual painted area is the constraint.
- "I figured it out" at bottom of sheet near thumb resting position; elevated misfire risk.

**Black driver assessing safety in a charged moment:**
- "If this gets worse" is the first word in the screen acknowledging escalation; could land as ambient-risk acknowledgment. Consider "If you need more support" or "If the situation changes".
- Reasoning not visible in Step 3 — "Help is on the way" without confirming what actions were actually taken violates the "visible reasoning" thesis principle.
- "Switch to Pulled-over mode" row has no subtitle explaining what Pulled-over mode does; user can't make informed decision without tapping.

## Minor Observations

- `accessibilityRole="text"` on locationChip View (line 269) is not a valid role for View on older iOS.
- `modalTitle` uses `bodyEmphasized` for a question prompt — violates Held-Question Rule (should be Title1 Regular).
- `gap: spacing.lg` between problem rows on a 5-item list creates significant vertical stretch; bottom items may sit below the fold on SE.
- Inline `{ marginTop: spacing.sm }` style on Step 3 subtitle — the one deviation from Step 1/2 pattern; confirm intentional.
- `wrongSpot` text uses underline + `labelSecondary` on 13pt — lowest-visibility affordance in the file; consider freshgreen for clearer affordance signal.

## Questions to Consider

- Should `markActionTaken()` unconditionally advance to Step 3 when the share toggle fires, or should Step 3 advance require an explicit user intent (separate CTA), with the share toggle being a side-effect inside Step 2?
- Does the "Messages opened for Alex at 3:14 PM" fact actually confirm the message was *delivered*, or only that `notifyTrustedContact` was called? Silent failure here violates PRODUCT.md Principle 4 (Honesty of Disclosure).
- Is the `usePreventRemove` trap intentional UX or defensive code? If intentional, needs visible affordance. If defensive, dismiss confirmation dialog is the better solution.
- `buildActionHeadline` produces "You're in Locating… with a flat tire." if user advances from Step 1 before geocode resolves. Needs guard.
- Should the Pulled-over escalation row have a brief subtitle explaining what it does?
