---
target: app/sign-out.tsx
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-06-19T04-57-29Z
slug: app-sign-out-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Screen exists and confirms sign-out clearly; no loading/progress state needed for this moment, which is correct |
| 2 | Match Between System and World | 3 | "You've been logged out." is honest and literal. "Thank you for stopping by!" is slightly mismatched — user did not visit a store, they ended a safety session |
| 3 | User Control and Freedom | 1 | No way back. `router.replace('/login')` kills the stack; no cancel affordance before this screen — arriving here IS the point of no return, with zero undo path |
| 4 | Consistency and Standards | 3 | `dynamicType` applied to both text nodes, `colors.*` tokens used throughout, `Button` component used correctly. Minor: gap of 43pt off the 4pt spacing ramp |
| 5 | Error Prevention | 4 | This screen is the result of an action that already happened; nothing to prevent here. N/A in the classic sense |
| 6 | Recognition Rather Than Recall | 3 | Single-action screen — not a recall problem. Illustration provides orientation but is semantically ambiguous |
| 7 | Flexibility and Efficiency | 3 | One path in, one path out. Appropriate for a confirmation screen |
| 8 | Aesthetic and Minimalist Design | 3 | Clean. Two lines of copy, one CTA, one illustration cluster. Wiltedgreen full-bleed is the right register |
| 9 | Error Recovery | 2 | Not an error screen, but "what do I do next?" path weakened by left-aligned, fixed-width 163pt CTA that reads as smaller than it needs to be |
| 10 | Help and Documentation | 3 | No help needed; context sufficient |
| **Total** | | **28/40** | **Adequate — functional but emotionally thin and accessibility-incomplete** |

## Anti-Patterns Verdict

**Not AI slop.** Screen is spare, on-brand, uses project tokens correctly. No gradient text, no glassmorphism, no eyebrow labels, no decoration for decoration's sake. Illustration reuse from permissions flow is valid economy.

One soft flag: "Thank you for stopping by!" is retail-app farewell phrase. In context of safety tool for Black drivers who may have just ended tense session, lands as tonally incongruous rather than warm. Not slop — copy choice that misreads emotional register of moment.

## Cognitive Load

| Item | Status |
|------|--------|
| 1. Single clear primary action | Pass — one CTA, zero ambiguity |
| 2. Copy is scannable and complete in one pass | Pass — two short lines |
| 3. No unnecessary decisions presented | Pass |
| 4. Visual hierarchy leads the eye correctly | Partial — illustration sits at same visual weight as title because gap of 43pt treats both as peers; illustration cluster only 89pt tall and very low-contrast against wiltedgreen |
| 5. Color carries meaning, not decoration | Pass — wiltedgreen is correct atmospheric register |
| 6. Tap target meets HIG minimum | Fail — `alignSelf: 'flex-start'` with `width: 163` produces 163 × 44pt button; visual treatment reads as left-fragment rather than confident CTA |
| 7. Dynamic Type applied to all text | Pass — both `title` and `subtitle` wrap `dynamicType()` |
| 8. Illustration communicates screen's purpose | Fail — rotated location pin + car is permissions screen metaphor, not sign-out metaphor; illustration borrowed rather than purposeful |

## Emotional Journey

User landing on this screen has just ended session. Best case they are home and relieved. Harder case they were in pulled-over or safety-active session and are processing something stressful.

The screen does something right: does not alarm. Wiltedgreen full-bleed is calm, grounded, appropriately valedictory.

What it misses: brand promise is "The Steady Companion." A steady companion does not greet departure with borrowed retail sign-off. Subtitle "Thank you for stopping by!" dissipates connection rather than closing it with warmth. Compare to app's own voice elsewhere — "You're not alone," "Talk to us. What's going on?" — personal and direct. Sign-out farewell should feel like same voice.

Illustration reuse from permissions also leaves screen emotionally unclosed. Arriving on permissions you have expectation and anticipation. Leaving the app you have completion and emotional residue. Same image speaks to neither moment particularly well.

"Log back in" label is neutral and functional. Not a problem. But moment is being left on the table.

## What's Working

**1. Token discipline clean.** `colors.wiltedgreen` for root background, `colors.white` for title, `colors.signOutSubtitle` for subtitle — every color named token, no inline hex, no reserved-color violations. `signOutSubtitle` token existing at all shows this off-white was deliberately separated from pure white.

**2. Typography sizing decision well-reasoned.** Comment on `subheadlineRegular` correctly explains why `footnoteRegular` (13pt) was rejected: would read as fine print on onboarding-class screen. 15pt keeps subtitle subordinate without burying it. 28pt title / 15pt subtitle is 1.87× step, generous and reads cleanly on dark background.

**3. `router.replace` pattern intentionally correct.** Comment ("so the back gesture from /login doesn't return here") demonstrates navigation pattern was consciously chosen to prevent confusing back-stack state.

## Priority Issues

**[P1] Button is left-anchored and undersized relative to screen's emotional weight**
- What: `alignSelf: 'flex-start'` combined with `width: 163` produces pill CTA that sits in left third of screen. At 163pt fixed width, HIG-tall but visually small relative to 28pt title above it.
- Why it matters: Only interactive element on screen. Exit affordance for moment that may carry emotional weight. Timid CTA at departure moment undercuts brand's "steady companion" posture.
- Fix: Either `alignSelf: 'stretch'` (full-width, matches app's permissions-screen pattern) or center-align at `alignSelf: 'center'` with `minWidth: 200` floor.

**[P1] Gap value of 43pt is off the 4pt ramp and unexplained**
- What: `gap: 43` in `styles.content` not on 4pt spacing scale (`spacing.xl = 32`, `spacing.xxl = 48`). Not Figma-pixel-perfect to any obvious value. No comment explains why 43 and not 44 or 48.
- Why it matters: Spacing module exists precisely to prevent straggler values. Comment in `theme/spacing.ts` calls out "stragglers at 5/6/13/18/20/23" as the problem this token was created to solve. 43 is new straggler, lives in screen with no complex layout reason for sub-ramp precision.
- Fix: Change `gap: 43` to `spacing.xxl` (48) or `spacing.xl` (32) — whichever reads better at runtime — and pull the import. If Figma genuinely specifies 43, document in comment with Figma node reference.

**[P2] Illustration is semantically borrowed, not purposeful**
- What: `PermissionsLocation` and `PermissionsCar` are permissions-flow illustrations. Reused here because available, not because rotated pin + car communicates "you've signed out." Assets named for their home screen.
- Why it matters: Illustration is only non-text visual on screen. Meant to provide orientation and warmth. Instead provides faint sense of déjà vu — users who completed onboarding will have vague memory of this arrangement from different moment. For thesis artifact being reviewed and presented, borrowed illustration is auditable design debt.
- Fix: (a) Commission or design sign-out-specific illustration — parked car, key, door — that communicates departure and rest; or (b) remove illustration entirely and let typography carry the moment.

**[P2] Subtitle copy is tonally misaligned with app's voice**
- What: "Thank you for stopping by!" is retail/SaaS farewell language. Reads as platform saying goodbye to customer. App's established voice is personal and direct.
- Why it matters: Sign-out screen is last impression. User who ended difficult session (pulled-over, unfamiliar area, shared location) deserves farewell that honors what they just went through. "Thank you for stopping by!" also implies user was visitor; brand positions itself as companion, not store.
- Fix: Rewrite to something closer to app's voice:
  - "Drive safe." (short, steady, the companion voice)
  - "See you on the road." (community warmth, Green Book lineage register)
  - "Take care out there." (personal, not corporate)

**[P3] No `accessibilityLabel` on illustration cluster**
- What: `View` elements wrapping `PermissionsLocation` and `PermissionsCar` carry no `accessibilityLabel`, no `accessibilityRole`, no `accessible={false}` to mark them decorative. VoiceOver will either announce SVG file names or traverse into SVG elements.
- Why it matters: Project targets WCAG 2.1 AA. Decorative illustrations must either be explicitly hidden or given meaningful label.
- Fix: Add `accessible={false}` and `importantForAccessibility="no-hide-descendants"` to outer `styles.illustration` View.

## Persona Red Flags

**Sam (accessibility):**
Illustration wrappers have no accessibility treatment. VoiceOver will likely traverse into SVG elements and announce raw file-name fragments or empty nodes. Two text nodes are fine — `dynamicType` applied, will scale. CTA inherits correct `accessibilityRole="button"` and `accessibilityLabel` from Button component. Gap issue invisible to VoiceOver. Net: one concrete failure (illustration a11y), everything else adequate.

**Casey (distracted mobile):**
Single-action screen is right shape for Casey. One headline, one line, one button. Problem is CTA is small and left-anchored — Casey glancing and thumbing for button may overshoot or undershoot. Centered or full-width CTA is thumb-safer on one-handed glance.

**Black driver assessing safety in a charged moment:**
This persona may arrive at sign-out directly after pulled-over session or safety-share. "Thank you for stopping by!" is worst possible farewell for that arrival path. Reads as app being unaware of what just happened — as if session had no weight. For driver who just documented stop, shared location in case something went wrong, or navigated through unfamiliar area alone at night, "stopping by" is grotesquely casual. Brand promise is steady companion who knows what you went through. Copy violates that promise at exact moment it matters most. This is screen's most important issue, and it is the lowest-code fix.

## Minor Observations

- `paddingBottom: 56` in `styles.content` not on 4pt ramp (`spacing.xxl = 48`). If needed to optically center accounting for safe-area, document with comment.
- `StatusBar style="light"` correct for dark-background screen.
- `router.replace('/login')` correct navigation pattern per comment. Worth verifying `/login` is `replace`-safe route.
- `illustration` View has hardcoded pixel dimensions (`width: 57, height: 89`) matching Figma exact container. SVG-faithful insets qualify for numeric exception.
- `locationWrap` uses `left: 10.71` — sub-pixel precision from Figma. Correct for SVG-faithful positioning.

## Questions to Consider

1. Does sign-out flow have confirmation step upstream? If user taps "Sign out" in `/menu` and is immediately replaced with this screen, `router.replace` is doing a lot of work. Brief confirmation ("Sign out? Your saved places will stay private.") before navigation may be appropriate.
2. What happens to saved state on sign-out? Comment mentions identity state cleared. Is that cleared before or after navigation to this screen?
3. Should this screen exist at all as a route, or should it be a modal? iOS sign-out confirmation pattern commonly is modal ActionSheet followed by returning to /login without intermediate "you've been signed out" screen.
4. Is fixed `width: 163` for button derived from Figma frame assuming specific device width? Will read proportionally correct on 375pt-wide screens and proportionally too small on 430pt-wide screens.
