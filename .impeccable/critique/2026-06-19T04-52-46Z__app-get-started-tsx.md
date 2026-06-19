---
target: app/get-started.tsx
total_score: 29
p0_count: 0
p1_count: 2
timestamp: 2026-06-19T04-52-46Z
slug: app-get-started-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading state (ActivityIndicator) present and haptic confirms success; gap: no in-progress label ("Signing in…") replaces button text, spinner alone carries the load |
| 2 | Match Between System & World | 4 | "Continue with Apple" is canonical Apple phrasing; green-on-dark earthy split echoes road horizon naturally; cars illustration grounds driving metaphor |
| 3 | User Control & Freedom | 2 | `router.push('/login')` for "Log in" link means user can navigate back via swipe-back, creating navigation loop: Get Started → Login → swipe back → Get Started; sibling relationship broken |
| 4 | Consistency & Standards | 3 | Button height 48pt — consistent with app's outlined-button pattern but 4pt above DESIGN.md's `button-secondary` spec of 44pt; divider's `caption1Regular` "or" label at 12pt matches nothing in nearby text scale |
| 5 | Error Prevention | 3 | `if (signingIn) return` guard prevents double-tap; error only shows for non-cancellation failures — correct; `getStoredUser()` pre-check correct order |
| 6 | Recognition Rather Than Recall | 4 | Single path, single CTA; no hidden options; Apple logo aids recognition |
| 7 | Flexibility & Efficiency | 3 | No biometric fast-path for returning users; "Already have an account? Log in" is escape valve; `gap: 88` between title and actions leaves substantial dead space — on smaller 6.1" screen CTA feels far from title |
| 8 | Aesthetic & Minimalist Design | 3 | Screen clean; divider + "or" feels vestigial — separates primary CTA from account-recovery link, but divider implies parity; link is not equal action; gap-88 leaves large void that reads as incomplete rather than generous |
| 9 | Help Users Recognize, Diagnose, Recover | 2 | Error "Sign-in failed. Please try again." accurate but offers no guidance; appears in `typography.footnoteRegular` at 13pt — small for error in stress state |
| 10 | Help & Documentation | 2 | No contextual "what is this?" affordance; for thesis app a first-time Black driver is encountering before they understand its purpose, no micro-copy explaining what they're getting into; screen drops user straight into auth without communicating value |
| **Total** | | **29/40** | **Competent but incomplete** |

## Anti-Patterns Verdict

**Not AI slop.** Screen avoids every anti-pattern named in PRODUCT.md: no gradient text, glassmorphism, eyebrow labels; no neon or aggressive conversion CTA language; no alarmist red; no decorative reserved-color usage. Illustration specific and mission-aligned (cars on road horizon), not generic stock vibe.

**One structural concern approaching slop territory:** `gap: 88` between title and actions sits without visible reason. Looks like Figma layout math that transferred faithfully but reads on-device as empty. User who hasn't seen Figma brief will read as "unfinished" rather than "generous." Generous space needs something to be generous *around*.

**Code-level:** No hardcoded hex values, all theme tokens used correctly. Reserved-color rule respected: `colors.red` used only for error string (carve-out #8 applies). `colors.freshgreen` used on `dividerLabel` and `loginLink` — both in-flow link roles, correct.

## Cognitive Load

| Item | Status | Note |
|------|--------|-------|
| 1. Single primary action | Pass | One CTA, clearly labeled |
| 2. Chunked actions (≤7 items) | Pass | Two interactive elements total |
| 3. Labels match mental model | Pass | "Continue with Apple" is industry standard |
| 4. Error messages actionable | Partial | "Try again" without context |
| 5. No competing affordances | Partial | Divider visually elevates "Log in" to equal-action status |
| 6. Progressive disclosure | Fail | No value prop before the auth ask |
| 7. Legible under stress | Partial | 13pt error text small; 88pt gap makes CTA feel far |
| 8. State change communicated | Partial | Spinner visible but no text label; haptic fires after the fact |

**Total load score: 5/8 — Moderate.** Main drag not complexity (screen appropriately minimal) but absence of progressive disclosure: screen asks for Apple auth commitment before user understands why app deserves it.

## Emotional Journey

**Arrival:** Wiltedgreen-to-burntgreen split and cars illustration land well. Palette calm and earthy. Horizon metaphor (sky above, road below, cars mid-scene) on-brand for driving companion. Illustration right-shifted (translateX: 110) creates sense of motion — cars driving *into* the screen rather than centered. Quiet delight.

**Reading the title:** "Get started" is functional but not evocative. Names the step, not the experience. For thesis app whose brand brief says "the warmth of the thesis is felt, not stated," this is the moment to feel *something*. Title is only piece of copy above CTA and does no emotional work.

**Looking for a reason to proceed:** User's eye moves from title to 88pt void to "Continue with Apple." No sentence in between answers "why should I?" This is the trust deficit. Brand says trust comes from visible reasoning. Entry screen provides no reasoning.

**Committing to Apple auth:** Outlined pill button confident without being aggressive. Apple logo provides recognition. Border color (`colors.wiltedgreen`) is 2.3:1 contrast against `colors.burntgreen` ground — likely falls below WCAG 3:1.

**After sign-in fails:** Error appears between button and divider. Text small (13pt), copy minimal, no supporting action. For user who already hesitated, silent failure loop is deflating.

**Overall arc:** Calm arrival → purposeful void → ambiguous commitment → thin recovery. Illustration carries more emotional weight than copy. Screen needs one sentence.

## What's Working

**1. Illustration compositional choice strong.** Horizontal split (wiltedgreen sky / burntgreen earth), road-horizon metaphor, rightward translateX on cars all work together without feeling engineered. Communicates "driving" in earthy and calm register. No reserved colors used atmospherically.

**2. Accessibility wiring thorough.** `accessibilityRole="button"` on primary CTA, `accessibilityState={{ busy: signingIn, disabled: signingIn }}`, `accessibilityRole="link"` on "Log in" row, full `accessibilityLabel` on image. Not afterthoughts — idiomatic React Native a11y.

**3. Error handling logic precise.** `ERR_REQUEST_CANCELED` suppression correct. `getStoredUser()` pre-check before `signInWithApple()` correctly solves Apple-doesn't-tell-you-if-it's-first-sign-in problem. Guard against double-tap present. Careful, not cargo-culted.

## Priority Issues

**[P1] No value proposition before the auth ask**
- What: Screen has title ("Get started") and immediate "Continue with Apple" CTA with no interstitial copy explaining what Fresh Greens is, why someone should trust it with Apple auth, or who it was built for.
- Why it matters: PRODUCT.md says "Trust comes from visible reasoning, not authority." Get Started is first moment new user decides whether to trust app. Asking for auth before establishing purpose is conversion risk and trust anti-pattern — especially for target audience (Black drivers discerning about apps that claim to protect them).
- Fix: Add 1-2 lines of micro-copy between title and CTA — either as subtitle under "Get started" or floating tag line in 88pt gap. Something like: "Routes built on community knowledge — safer paths for Black drivers." Keep it one breath. Alternatively, use 88pt gap for condensed onboarding value prop, making entry screen do trust-building work before committing user to Apple auth.

**[P1] Button contrast on burntgreen ground likely below WCAG 3:1**
- What: `outlinedButton` uses `borderColor: colors.wiltedgreen` (#326936) against `colors.burntgreen` (#003F04) — produces contrast ratio of approximately 2.2:1, below WCAG 1.4.11 non-text contrast requirement of 3:1 for UI component boundaries. Button background transparent, so on lower 80% of screen button outline sits against burntgreen ground.
- Why it matters: Primary CTA is only action path to auth. If boundary not perceivable against background (particularly for low-vision users), affordance invisible. Sam hits this directly.
- Fix: Use `colors.white` or `colors.fadedgreen` as border color rather than `colors.wiltedgreen`. White gives ~21:1 against burntgreen ground — fully compliant and visually sharp. Button text already white, so white border unifies outlined-pill geometry.

**[P2] 88pt gap reads as emptiness, not generosity**
- What: `gap: 88` between `styles.contentInner`'s title and actions group faithful to Figma but leaves large void between "Get started" and CTA with no content anchored in it.
- Why it matters: Generous spacing only reads as intentional when there's something to breathe around. Empty 88pt column registers as "incomplete." On 6.1" device with safe area insets, gap is roughly 1/6 of usable screen height.
- Fix: Populate with value prop micro-copy from P1 (solves two issues), or tighten to `gap: 56` or `64`. Option (a) strongly preferred.

**[P2] Navigation loop: Get Started → Login → swipe-back → Get Started**
- What: `handleLogInLink` uses `router.push('/login')`. Login's `handleSignUpLink` uses `router.replace('/get-started')`. Asymmetry means user who taps "Log in" from Get Started, then taps "Don't have an account? Sign up" from Login, lands back at Get Started with back-navigation entry pointing to Login. Swipe-back from re-arrived Get Started navigates to Login, which navigates back to Get Started — infinite loop.
- Why it matters: Confused or second-guessing users (Casey) explore between these two screens. Loop undermines user control.
- Fix: Change `handleLogInLink` in `get-started.tsx` to use `router.replace('/login')` to match how Login navigates back. Sibling, not parent-child.

**[P2] Divider elevates "Log in" link to visual parity with primary CTA**
- What: Full-width `<View style={styles.divider}>` with lines on both sides and centered "or" sits between "Continue with Apple" and "Already have an account? Log in." Visual grammar of two equal options.
- Why it matters: Divider signals "you can do either," but intent is "you should do this first one; here's a recovery path." Visual weight misleading.
- Fix: Remove divider entirely. Space between button and "Log in" row sufficient (`gap: 16` in `styles.actions` still present).

**[P3] Error state typography small for stress-state message**
- What: `styles.errorText` uses `typography.footnoteRegular` (13pt, lineHeight 18). 13pt above WCAG Caption 2 ornamental floor (11pt), but error messages in sign-in flow during stress state warrant body or subheadline register.
- Why it matters: User who sees "Sign-in failed. Please try again." already in recovery state — possibly anxious, possibly on small screen in bright light.
- Fix: Bump to `typography.subheadlineRegular` (15pt). Or make copy more specific: "Couldn't connect to Apple. Check your connection and try again."

## Persona Red Flags

**Sam (accessibility):**
Button border contrast against burntgreen ground (~2.2:1) is direct WCAG 1.4.11 failure. Sam — using screen in low-vision mode or high-glare conditions — may not see outlined button boundary at all, making app's sole entry point effectively invisible. `accessibilityRole="button"` and `accessibilityState` wiring strong, but VoiceOver only helps if Sam *finds* button. Error text at 13pt below comfort reading size. Neither title nor CTA appears to use `dynamicType()` wrapper.

**Casey (distracted mobile):**
Navigation loop directly catches Casey. Casey is user who second-guesses — taps "Log in," realizes she wants to create account, taps "Sign up," swipes back out of habit, finds herself at "Log in" again. Screen-switching anxiety compounds because both screens look nearly identical pixel-for-pixel. Without visual marker distinguishing "you are on Get Started" from "you are on Login," Casey feels lost.

**Black driver assessing safety in a charged moment:**
This persona is raison d'être of app. Not arriving at Get Started in charged moment, but *trust stakes* at this entry point highest they will ever be. Black driver with reason to be discerning about "safety apps" is being asked to hand over Apple identity without a single sentence explaining who built this, why, or what they can expect. Community-and-heritage warmth that PRODUCT.md says should be *felt* is not felt here. Screen competent and calm, but anonymous. For driver burned by apps that claimed to help and didn't, anonymous calm is not sufficient. Value-prop gap (P1) most urgent for this persona. One honest sentence — ideally one that acknowledges Green Book lineage without stating it — could change quality of consent being given.

## Minor Observations

- `theme/spacing.ts` imported nowhere in this file. Gap values (`88`, `16`) and padding (`32`) numeric rather than from spacing tokens. `spacing.xl` is 32, `spacing.md` is 16. 88pt title-to-actions gap has no spacing token — `.cursorrules` anti-slop check failure.
- `theme/radii.ts` has `pill: 999` token. Button uses `borderRadius: 100` rather than `radii.pill`.
- `dividerLine` uses `backgroundColor: colors.wiltedgreen` against burntgreen ground. Same contrast issue applies.
- `login.tsx` does not import `getStoredUser` (always routes to `/home`). Two files literal near-copies with 90% shared StyleSheet definitions. `login.tsx` header comment explicitly invokes rule-of-three. Architecturally sound per project's own rules.
- `accessibilityRole="link"` on "Log in" Pressable technically correct (navigates) but on iOS VoiceOver, `role="link"` announces as "link" in context that reads as button. `accessibilityRole="button"` with `accessibilityHint="Opens the log in screen"` more natural.

## Questions to Consider

1. Should Get Started surface value-prop sentence or defer entirely to onboarding? Current design assumes onboarding will do trust-building work — but onboarding only runs for first-time users after successful auth. Trust gap exists before auth.
2. Is outlined-button pattern right visual register? Outlined button on dark surface reads as "secondary" in iOS HIG convention (secondary = outlined, primary = filled). Sole CTA is primary action, so filled `wiltedgreen` or `freshgreen` button would communicate primary path more clearly.
3. Is there case for cars illustration to bleed upward into content zone? Currently absolutely positioned at `top: 16%` in background. If content's `justifyContent` shifted or gap reduced, illustration and copy could occupy same visual half of screen.
4. What is onboarding-bypass path for returning user who lands on /get-started by accident? "Already have an account?" adequate but passive.
