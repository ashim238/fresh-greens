---
target: app/onboarding.tsx
total_score: 35
p0_count: 0
p1_count: 2
timestamp: 2026-06-19T10-11-42Z
slug: app-onboarding-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | PageControl shows 5 dots but only panels 1-3 are interactive here; dots 4 and 5 have no panel behind them and never visually advance |
| 2 | Match System / Real World | 3 | "For us, by us" requires prior cultural knowledge to decode; new users see a phrase without translation scaffold |
| 3 | User Control and Freedom | 3 | Skip fully functional but sits in same 44pt fill block as Continue with transparent style — visually feels like disabled state, not intentional exit |
| 4 | Consistency and Standards | 4 | Panel 3 copy more abstract than panels 1-2 which are concrete and verb-driven; register shifts mid-journey |
| 5 | Error Prevention | 3 | Past-the-end swipe threshold (30pt) is hardcoded and not calibrated to user speed |
| 6 | Recognition Rather Than Recall | 4 | No visual cue (chevron, subtle arrow, partial bleed) to indicate swiping is possible — users who don't try will tap Continue through all panels |
| 7 | Flexibility and Efficiency | 4 | Advanced users cannot shortcut past 3-panel sequence beyond Skip, which is itself visually muted |
| 8 | Aesthetic and Minimalist Design | 4 | Panel 2's illustration is 90pt taller (565 vs 475) than other two — title text lands at visually different vertical position across swipe |
| 9 | Error Recovery | 3 | Once user taps Skip, no way back — no "back" affordance on /permissions, no breadcrumb trail |
| 10 | Help and Documentation | 4 | Body copy on each panel explains *what* but not *why* in Green Book lineage sense — app's thesis identity isn't surfaced until deeper in flow |
| **Total** | | **35/40** | **Good — solid technical execution, targeted copy and affordance gaps** |

## Anti-Patterns Verdict

**Clean on reserved colors.** `wiltedgreen` as full-bleed background correct — brand green used atmospherically, not reserved signal. No orange, red, navy, yellow appears. Button's `freshgreen` fill on `wiltedgreen` ground uses correct palette for colored-surface CTA.

**Icon rule: N/A.** No icons in `onboarding.tsx` or `PageControl.tsx`.

**Tap-target rule: mostly clean, one ambiguity.** Button component is `height: 44`. Skip button visual affordance is text link with underline — users may perceive it as smaller than 44pt because ink area (underlined text at 17pt) is much smaller than 44pt container. Per `.cursorrules`: "invisible tap area below visible affordance is usability-and-confidence problem."

**Inline design values: violation.** `gap: 32`, `paddingHorizontal: 32` should be `spacing.xl`. `gap: 16` should be `spacing.md`. Magic `76` in `marginTop` and `34` in `paddingBottom` have no token home.

**Typography deviation:** Onboarding uses `largeTitleEmphasized` (34pt/700) — one tier above Title1. Not inherently wrong for full-screen intro, but should be flagged as conscious deviation.

**`bodyRegular` vs Figma's `bodyEmphasized`:** Inline comment acknowledges this departure — defensible. Thoughtful deviation, not slop.

## Cognitive Load

**Low — by design.** Three discrete panels, one concept each, one primary action. Mental model ask minimal.

One load-adding element: **5-dot PageControl when only 3 panels are navigable here.** User sees 5 dots, swipes through 3 panels, then is jumped to separate screen (permissions). Mental model has to accommodate "some of those dots are on different screen I haven't seen yet" — counterintuitive. Standard iOS onboarding convention uses dots that reflect *this screen's* panels.

Copy length appropriately tight. Panel 2 body longest at 166 characters — one comfortable read.

## Emotional Journey

**Panel 1 (Drive) — Empowering.** "Drive like you know these roads" right opening note. Speaks confidence and agency before mentioning hazard. Driving-position illustration reinforces felt ownership. **Grounded, welcoming.**

**Panel 2 (Community) — Warm but cognitively dense.** "For us, by us" lands emotionally for users who know its resonance, but body packs two distinct ideas (road hazards + treatment of Black visitors) into one sentence. Emotional peak — community care — present but copy doing double duty.

**Panel 3 (Unique) — Weakest panel.** "Your viewpoint is unique" most abstract promise. "Integrates your intuition into the navigation" is tech-speak for deeply human act. Thesis's most distinctive claim gets most neutral phrasing. Illustration (thought bubble with no-fly icon) more concrete than copy.

**Transition to permissions:** Flow exits warm, illustrated journey and lands on system permissions sheet — cold, functional register with no emotional bridge.

## What's Working

**Full-bleed pager architecture correct.** Single FlatList pager screen instead of three separate routes eliminates back-stack complexity. `pagingEnabled` + `scrollToIndex` + `onMomentumScrollEnd` right RN pattern.

**Illustration sizing via `aspectRatio` smart.** Driving container height from SVG's intrinsic aspect ratio at runtime means layout stays proportional on every device width without media queries.

**Latch guard (`leftPagerRef`)** on `goToPermissions` good defensive pattern.

**Haptic feedback on Continue.** `Haptics.selectionAsync` right haptic tier.

**Accessibility architecture thorough.** `adjustable` role + `increment`/`decrement` actions on FlatList, combined with hiding PageControl dots from VoiceOver and letting FlatList announce "page X of 5" as sole count, well-considered AX design.

**VoiceOver labels on illustrations specific and descriptive.**

**Button component's transparent variant on colored surface contextually correct.**

**StatusBar handled** with `style="light"` on dark-green surface.

## Priority Issues

**[P1] PageControl dot count implies navigable 5-panel sequence, but panels 4 and 5 unreachable from this surface**
- What: `PageControl` receives `total={ONBOARDING_FLOW_STEPS}` (5), so user sees 5 dots but can only advance 3 through swipe/Continue. Dots 4 and 5 static. Active dot stops at position 3 even though visual suggests 2 more pages exist.
- Why it matters: Users see 5 progress dots and expect 5 swipeable panels. On panel 3, may attempt to swipe and nothing happens. Mismatch teaches wrong model.
- Fix: Change `total={ONBOARDING_FLOW_STEPS}` to `total={PANELS.length}` (3). Update FlatList's `accessibilityLabel` similarly to `page ${pagerIndex + 1} of ${PANELS.length}`.

**[P1] "Skip" transparent button reads as inert, not as low-emphasis action**
- What: Skip uses `fill="transparent"` which renders as white underlined text with no background or border. At 17pt bodyEmphasized, ink area roughly 30pt tall visually — below 44pt painted-target requirement.
- Why it matters: "Steady Companion" brand needs every escape affordance to feel safe and deliberate. User who doesn't notice Skip has no graceful exit from pager short of force-quitting.
- Fix: Keep `fill="transparent"` but add `accessibilityHint="Skips the intro and goes to permissions"`. For sighted users, consider increasing visual weight slightly.

**[P2] Panel 3 copy breaks concrete-to-abstract promise of sequence**
- What: Panels 1 and 2 make specific, verb-driven promises. Panel 3 retreats to abstraction: "integrates your intuition into the navigation." "Integrates" and "specific to you" product-speak for something deeply personal.
- Why it matters: Panel 3 is climax of sequence — delivers app's most differentiated claim. Losing specificity at climax undercuts emotional arc.
- Fix: Rewrite body to be as concrete as panels 1 and 2. Candidate: "Mark routes and places you'd rather avoid. Fresh Greens factors your choices into every route it recommends."

**[P2] Inline spacing literals diverge from `theme/spacing`**
- What: `gap: 32` and `paddingHorizontal: 32` should be `spacing.xl`. `gap: 16` in `actions` should be `spacing.md`. Magic numbers `76` and `34` have no token home.
- Why it matters: `.cursorrules` anti-slop rule #2 violation.
- Fix: Replace `gap: 32 → spacing.xl`, `paddingHorizontal: 32 → spacing.xl`, `gap: 16 → spacing.md`. Extract `76` and `34` as module-level named constants.

**[P3] No emotional bridge between panel 3 and /permissions**
- What: Sequence cuts directly from warm, illustrated "Your viewpoint is unique" panel to system permissions request.
- Why it matters: Permissions requests fail at higher rates when users don't understand why they're being asked. Abrupt cut undermines "Steady Companion" register.
- Fix: Add brief transitional moment — either as fourth panel ("Before we begin — we need two permissions to route for you") or as loading/animation state on /permissions itself.

## Persona Red Flags

**Sam (accessibility):**
`adjustable` FlatList + `increment`/`decrement` action pattern correctly implemented. However, 5-dot PageControl count mismatch creates AX-specific confusion: VoiceOver reads "page 3 of 5," Sam attempts to increment past panel 3, nothing happens, navigation jumps to /permissions. Transition not announced as screen change within pager's AX model. Recommend adding `AccessibilityInfo.announceForAccessibility('Moving to permissions setup')` immediately before `router.push('/permissions')`.

**Casey (distracted mobile):**
Casey one-handing this at red light. Continue button correctly placed at bottom — thumb-reachable — and large enough for one-handed confident tapping. Risk for Casey is Skip: white underlined text at 17pt with no background may be missed entirely. Casey won't discover swipe gesture — will tap Continue three times and advance.

**Black driver assessing safety in a charged moment:**
This persona doesn't encounter onboarding in charged moment. However, onboarding's function is to build trust foundation. Two gaps relevant:
1. Panel 2 ("For us, by us") uses phrase with specific cultural weight — affirming. But body's dual-subject sentence ("from road hazards to the treatment of Black visitors") doing a lot. "Treatment of Black visitors" is heavy phrase introducing thesis's core tension in middle of onboarding panel.
2. Panel 3 ("integrates your intuition") most directly relevant to charged-moment persona — gut-feeling routing signal. But abstract copy doesn't communicate what that actually means in practice.

## Minor Observations

- `illustrationAspect` comment misleading — stored value is width/height ratio (correct), but naming suggests otherwise.
- Panel 2's `illustrationAspect: 390 / 565` means illustration container ~30% taller than panels 1 and 3.
- `body` style applies `dynamicType(typography.bodyRegular)` — correct. Title style also applies `dynamicType(typography.largeTitleEmphasized)`. At maximum 3.12× iOS accessibility multiplier becomes ~106pt — title alone would exceed most of safe text area.
- `onScrollEndDrag` handler fires on *any* drag end, including reverse drags on panel 1.
- `setPagerIndex` only set on `onMomentumScrollEnd`, not on programmatic `scrollToIndex` calls.

## Questions to Consider

1. Should PageControl count match navigable panels here (3) or whole flow (5)? Pick one model and be consistent.
2. Is "For us, by us" right title for screen that may also be used by allies and non-Black users?
3. What happens if user backs out of /permissions to /onboarding? `leftPagerRef` reset by `useFocusEffect` — does pager return to `pagerIndex: 0` or last-visited panel?
4. Panel 3's illustration `illustrationLabel` reads "a no-fly icon" — accurate description of what icon depicts?
5. `gap: 32` between title and body quite generous — at smaller screen heights, does this spacing compress illustration?
