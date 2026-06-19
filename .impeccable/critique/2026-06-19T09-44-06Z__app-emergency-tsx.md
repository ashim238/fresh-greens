---
target: app/emergency.tsx
total_score: 34
p0_count: 0
p1_count: 2
timestamp: 2026-06-19T09-44-06Z
slug: app-emergency-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Live countdown numeral + `accessibilityLiveRegion="polite"` keeps both sighted and VoiceOver users oriented; haptic metronome adds non-visual status channel |
| 2 | Match Between System and World | 4 | "Need help? / You choose who responds." is plain and human; 3-second Stop window maps to universal "confirm before dial" mental model; `dialOrWarn` Alert on failure matches expectation |
| 3 | User Control and Freedom | 4 | Stop affordance on countdown, scrim-dismiss on idle, pivot link give three distinct escape valves across two states; scrim correctly locks during countdown |
| 4 | Consistency and Standards | 3 | "Call [Contact]" uses `colors.navy` (safety-affordance register), but idle subtitle "You choose who responds" implies two buttons are peers while visual hierarchy treats them as primary/secondary |
| 5 | Error Prevention | 3 | 3-second countdown window primary error-prevention mechanism works well; if user has no trusted contact and taps "Set up a contact first," routed to `/trusted-contact-setup` and emergency modal disappears — if they cancel setup, return to underlying screen, not emergency card |
| 6 | Recognition Rather Than Recall | 4 | Pivot link ("Or call 911" / "Or call [Name]") surfaces alternative at exact moment user needs it; `accessibilityLiveRegion` announcement on pivot explicitly names switch |
| 7 | Flexibility and Efficiency of Use | 3 | Efficient for primary flow; hint text rendered in `footnoteRegular` at `labelTertiary` — the lowest contrast token — means information users need to confidently tap a button is in least legible register |
| 8 | Aesthetic and Minimalist Design | 4 | Idle card: 6 elements serving different roles; countdown card: 3 elements; both minimal without being sparse; no decorative chrome |
| 9 | Help Users Recognize, Diagnose, and Recover | 3 | `dialOrWarn` surfaces Alert when `tel:` fails — good; "Set up a contact first" path gives no in-card feedback — button text changes but no sub-label explaining why call can't happen |
| 10 | Help and Documentation | 2 | 3-second cancel window disclosed in idle-card hint and accessibility label — good for first use; no re-surface inside countdown view itself; disc number as "seconds remaining" only machine-communicated to VoiceOver; sighted users must infer |
| **Total** | | **34/40** | **Strong — execution-quality issues, no structural gaps** |

## Anti-Patterns Verdict

**No AI slop detected.** This screen is the opposite of slop.

- No decorative reserved-color usage. Red is SOS disc and 911 button — both purposeful. Navy is contact button in safety-affordance register. Zero ambient red. Design explicitly refuses "alarmist safety-app red."
- No gradient fills, glassmorphism, eyebrow labels.
- Typography choices argued from first principles (Regular for "Need help?" per Held-Question Rule; title2Emphasized vs title1Regular on countdown title because contact name can be long).
- Haptic scale (Medium arm → Selection metronome → Warning fire) is deliberate, differentiated vocabulary, not default "vibrate on tap."
- Comment quality unusually high — design decisions documented at point of decision.

One mild concern worth naming: `sosCountdown` token sits at 40/44 inside 88pt disc. The ratio is tight. On iOS 17+ with largest Dynamic Type sizes, `dynamicType()` is NOT applied to `countdownNumber` — style spreads `typography.sosCountdown` directly. Deliberate choice (comment reads "natural 60pt lineHeight flows through"), but means countdown number does not scale with user's accessibility text size. Likely correct for this constrained element, but should be conscious exception, documented as such.

## Cognitive Load

| Item | Status | Notes |
|------|--------|-------|
| Single clear primary action per state | Pass | Idle: two peer CTAs, contextually appropriate. Countdown: one action (Stop), one sub-action (pivot). |
| Irreversible actions gated | Pass | 3-second countdown before dial fires. Scrim-lock during countdown prevents accidental dismissal. |
| State transition clearly communicated | Pass | Title swap + haptic + VoiceOver announcement on mode change. |
| No information lost on state change | Pass | Pivot link preserves alternative path mid-countdown. |
| Labels are self-describing | Partial | "Stop" with X glyph unambiguous. "Or call 911" clear. Disc numeral as "seconds remaining" inferable but not labelled for sighted users. |
| No competing visual priorities | Pass | Idle: action buttons dominate. Countdown: red disc undeniable focal point. |
| Error states distinguishable | Partial | No-contact state (button text changes to "Set up a contact first") semantically different but visually similar — same navy button. |
| Charged-moment copy is in right register | Pass | "Need help?" at title1Regular. "You choose who responds." at bodyRegular/labelSecondary — reassuring, not commanding. |

**Cognitive load summary: Low.** Two-state model clean, haptic vocabulary differentiated, typography hierarchy does heavy lifting.

## Emotional Journey

**Entry (armed):** User arrives from en-route SOS side-button or /safety SOS bar. `transparentModal` means map still visible beneath 20% scrim. Exactly right: driving context not stripped away.

**Idle card — "Need help? You choose who responds."** Tone lands precisely on brand's "Steady Companion" frequency. Question held open (Regular weight). Subtitle most important copy on card and doing real emotional work: in moment where Black driver may feel they have no agency, "You choose who responds" asserts autonomy. This is thesis-encoded copy (claim C8), not filler.

**Tapping "Call 911":** Medium impact haptic fires moment intent registers — phone responds in hand before visual even changes. Countdown card appears with "Calling 911" in title2Emphasized and red disc. Emotional register shifts from "choosing" to "committed with way out."

**The 3 seconds:** Haptic metronome (selectionAsync at 2 and 1) gives embodied sense of time passing without user looking at disc. Most thoughtful detail in whole screen — driver whose eyes are on road still has tactile countdown.

**Stop:** Light impact haptic confirms interrupt. Emotional register snaps back to idle. "You're back. You chose not to call."

**One emotional gap:** If 911 call fires and Phone app takes over, modal returns to idle. On real device Phone app takes foreground; on simulator/iPad where dial fails, user sees idle card again with no confirmation anything happened. `dialOrWarn` Alert handles this, but Alert is system-level interruption. Brief in-card toast ("Couldn't connect — try dialing manually") would be more composed.

## What's Working

**1. Haptic vocabulary as parallel UX channel.** Three-tier haptic scale (Medium commit → Selection metronome → Warning fire) is complete, differentiated communication system. Driver who looks away from phone after tapping 911 still knows: something changed (Medium), time is passing (Selection × 2), and call has fired (Warning). Earns real trust from users who've been in charged situations.

**2. Pivot architecture.** Maintaining alternative path mid-countdown — "Or call [Name]" / "Or call 911" — while restarting 3-second window on each pivot is right solution to genuinely hard problem. Naive design would lock target after first tap; this keeps deliberation open. Comment calls out exactly why ("a punishing pivot punishes deliberation").

**3. "You choose who responds."** Thesis claim C8 encoded in five words. In moment that could easily drift toward "app takes action," idle card explicitly returns agency to user. Not decorative copy — load-bearing UX that distinguishes Fresh Greens from every alarmist safety-app peer.

## Priority Issues

**[P1] Countdown disc numeral is not labelled for sighted users**
- What: Red disc shows live numeral (3 → 2 → 1). VoiceOver users hear "X seconds remaining" via `accessibilityLabel`. Sighted users must infer that numeral means "seconds." No visible label — not even "sec" below numeral.
- Why it matters: Most acute moment in app. User who has never used countdown before sees red circle with number and must correctly infer "this is a countdown, and I have N seconds to stop it." Inference reasonable but not guaranteed under stress. One moment where UI's meaning must be instantly obvious is one moment where it requires inference.
- Fix: Add small `caption1Regular` label — "sec" or "seconds" — immediately below numeral inside disc. Disc is 88pt; at 40pt numeral + 12pt caption interior still legible. Alternatively, render "Tap Stop to cancel" as persistent sub-label below disc.

**[P1] Hint text contrast is weakest element at most critical moment**
- What: `styles.hint` uses `typography.footnoteRegular` (13pt) and `colors.labelTertiary`. Disclosure that tells users they have 3 seconds to cancel — arguably most important pre-action information on idle card. `#3D3D3D` on `#FFFFFF` is approximately 6.6:1 (passes WCAG technically), but visual weight at this size and color means it will be last element user sees.
- Why it matters: 3-second cancel window is safety net. If users don't internalize it before tapping, they will be surprised by countdown and more likely to panic-tap Stop even when they intended to call. Hint needs to land.
- Fix: Bump hint to `subheadlineRegular` (15pt) or `footnoteEmphasized` (13pt/semibold). Shift color to `labelSecondary`. Alternatively, restructure information hierarchy: present 3-second window inline in button's sub-label.

**[P2] No-contact state offers no recovery path within card**
- What: When `hasContact` false, contact button reads "Set up a contact first" and routes to `/trusted-contact-setup`. If user cancels setup, `router.back()` returns to calling screen (en-route or safety), not emergency card. Emergency card has dismissed.
- Why it matters: Edge case but most dangerous edge case. User who reaches for emergency surface and discovers mid-attempt their contact is not set up has lost the surface they were trying to use. 911 button still available, but contact-setup detour has consumed cognitive bandwidth.
- Fix: Option A: treat no-contact state as disabled button with inline explanation ("No contact set — tap to add one"), preventing navigation away during active session. Option B: push to setup with explicit return-to-emergency parameter setup screen honors on both Skip and Back.

**[P2] `sosCountdown` typography not wrapped in `dynamicType`**
- What: `countdownNumber` spreads `typography.sosCountdown` directly. Every other text element uses `dynamicType(...)`. Countdown numeral is single most important text element on countdown card.
- Why it matters: Deliberate trade-off (disc fixed-size, numeral fills it), but undocumented as exception. Developer who touches code later and adds `dynamicType` to be "consistent" will overflow 88pt disc at larger text sizes.
- Fix: Add comment to `countdownNumber` style: `// sosCountdown intentionally NOT wrapped in dynamicType — numeral is constrained to the fixed 88pt disc`. Load-bearing documentation for safety-critical surface.

**[P3] `StatusBar style="dark"` may not survive transparentModal context**
- What: `<StatusBar style="dark" />` rendered inside modal. On iOS, status bar appearance inside `transparentModal`-presented screen can be overridden by presenting screen's status bar props.
- Why it matters: Minor, but if presenting screen (en-route) uses `style="light"` for map contrast, status bar may not flip to dark over emergency card's white surface.
- Fix: Verify status bar behavior across iOS 16/17/18. If override unreliable, set transparent modal's `statusBarStyle` in `_layout.tsx` screen options instead.

**[P3] `colors.labelSecondary` is opaque `#3C3C43` — lighter than iOS semantic gray**
- What: iOS `UIColor.secondaryLabel` is `rgba(60, 60, 67, 0.6)` in light mode. Token `colors.labelSecondary` is `#3C3C43` (opaque), which on white is approximately 4.75:1 — passes AA but visually darker than iOS native. `stopLabel` and `pivotLabel` use `labelSecondary` (opaque) — correct for readability, but mismatch between token name and iOS semantic is latent confusion risk.
- Why it matters: Low risk on this screen (white card background). Flagged as systemic token-naming tension.

## Persona Red Flags

**Sam (accessibility):**
Screen notably well-considered for Sam. `dynamicType()` on all text except disc numeral, explicit `accessibilityRole`, `accessibilityLiveRegion="polite"` on both countdown title and disc, VoiceOver pivot announcements ("Switched to calling 911. 3 seconds to cancel.") all present and differentiated. One live gap: idle-card close button uses `tapTarget44` correctly, but scrim `Pressable` has `accessible={false}` and `accessibilityElementsHidden` — correct for overlay dim layer, but means VoiceOver users cannot tap scrim to dismiss. Must use X close button. Acceptable but should be validated: does VoiceOver focus reach X close button without traversing scrim?

**Casey (distracted driver, eyes off screen):**
Haptic metronome is Casey's best friend. Three-tier haptic vocabulary means Casey can initiate 911 call, feel commit, feel two steps, feel fire without looking at screen. Stop affordance is 44pt painted chrome circle — large enough to hit without precision. Where Casey under-served: first time Casey reaches countdown card, disc numeral not labelled. Casey may feel Medium haptic, glance at screen, see "3" in red circle, and not know if 3 means seconds or attempts. Inline "sec" label fix is specifically a Casey fix.

**Black driver assessing safety in a charged moment (THE persona):**
This is the one screen where thesis either earns driver's trust or loses it. Verdict: earns it, with one gap.

What works: "You choose who responds." is right copy. Map staying visible behind scrim is right — losing map context when map is reason for charged moment would compound crisis. Deliberate two-tier escalation (community contact first, 911 second) encodes real understanding of why Black driver might not want to call 911 as first response. Pivot architecture means driver can change mind mid-countdown. Haptic metronome means driver doesn't have to watch screen during 3 seconds.

The gap: no-contact detour (P2). If Black driver in charged moment taps community contact button and is routed to contact-setup, emergency surface dissolved under them. They now have to navigate back, open SOS button again, tap 911 instead. UX failure in worst possible context. Driver who most needs community-first option (Black driver who specifically does NOT want to call 911 by default) is driver who hits this failure mode hardest. One bug in screen that rises above "fix when you get to it."

## Minor Observations

- `dynamicType` on `countdownTitle` (`title2Emphasized`, 22pt) means countdown title can grow beyond single-line at large Dynamic Type. Comment explains 22pt specifically to keep long names single-line. At Accessibility XL+ sizes, long name still wraps. Worth `numberOfLines={2}` safeguard with `adjustsFontSizeToFit` fallback.
- `exitCluster` uses `gap: spacing.xs` (4pt) between Stop and pivot link. Pivot's `minHeight: 44` ensures tap-compliant, but visually pivot sits very close to Stop circle. `gap: spacing.sm` (8pt) here would visually separate without adding significant height.
- `Asterisk` icon in idle header is 24pt, `colors.red`, `weight="bold"`. SOS glyph — red appropriate per reserved-color exception 6. Worth confirming with Figma: does spec call for filled or outlined Asterisk?
- `card` style sets `alignItems: 'center'`. `header` has `alignSelf: 'stretch'` to break out. Correct pattern. Worth verifying it holds at `maxWidth: 400` cap on iPad portrait.
- LifelineModal is separate component not rendered inside emergency.tsx — different flow (unfamiliar area, not emergency dial).

## Questions to Consider

1. What does driver see if they tap 911, countdown fires, and Phone app does NOT take over (Simulator, iPad, no SIM)? Code returns to idle and `dialOrWarn` fires Alert. Does Alert render on top of modal correctly?
2. Is 3-second countdown right duration? Short enough to feel urgent but long enough to cancel misfire. Research on human reaction time under stress suggests 3 seconds is near floor for conscious "I meant to do that" vs. "I didn't mean that" discrimination.
3. Does VoiceOver focus order on idle card progress top-to-bottom through header → title → subtitle → contact button → 911 button → hint? Asterisk is non-interactive decorative element — VoiceOver may focus it and announce "Asterisk bold" before meaningful content. Consider `accessible={false}`.
4. What happens if user force-quits app during 3-second countdown? Timer is JavaScript interval — does not survive app termination. Acceptable behavior but worth stating explicitly in component comment.
5. Is `transparentModal` right presentation on all entry points? Both entry points push to `/emergency` as transparent modal. On /safety screen (not map surface), background behind scrim would be safety settings content. 20% scrim over settings may read as rendering artifact.
