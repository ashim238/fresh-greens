---
target: app/pulled-over.tsx
total_score: 29
p0_count: 1
p1_count: 2
timestamp: 2026-06-19T09-38-46Z
slug: app-pulled-over-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Recording chip on contact/review phases gives live elapsed time + pulse dot; missing: no visible progress indicator during transition phase auto-advance |
| 2 | Match Between System and Real World | 4 | "We'll walk you through what to do" → "Read the following" is right coaching register; Officer/Trooper distinction uses familiar visual language; `Prefer not to answer` correct real-world phrasing |
| 3 | User Control and Freedom | 2 | Transition phase has `Tap to continue` hint but entire tap target is full-screen Pressable — visually nothing communicates "this whole screen is tappable"; skip-hint `opacity: 0.7` at 13pt footnoteRegular too small to be discovered under stress; `Back` in Review footer returns to `contact`, not `guidance`; dismissal guard exists but no visible lock icon or in-UI affordance |
| 4 | Consistency and Standards | 3 | Icon sizing inconsistent: readAloud row uses `size={32}` while Contact uses `size={24}` and Review chevrons use `size={24}`; `stopRecordingBtn` is bare underlined footnote link — should feel like proper destructive action; `reviewLink` labeled `accessibilityRole="link"` but behaves as button |
| 5 | Error Prevention | 3 | `Stop recording` presented as footnote-weight underlined text link inside recording widget — weight/hierarchy mismatch reads as secondary copy rather than destructive affordance; `usePreventRemove` dismiss guard fires Alert with default iOS styling — appropriate; Stop button label says "Save & leave" slightly optimistic if `durationMs < 2000` (recording silently dropped) |
| 6 | Recognition Over Recall | 4 | Guidance bullets repeated verbatim in Review sub-views so users don't have to remember previous screen; state attribution on `WhatToSayView` helps users recognize rule is specific to their context |
| 7 | Flexibility and Efficiency of Use | 2 | Flow strictly linear: armed → transition → guidance → contact → review; no way to jump back from `contact` to `guidance` without going through `review`; no keyboard/VoiceOver shortcut to skip transition |
| 8 | Aesthetic and Minimalist Design | 3 | Guidance phase has most competing elements at once: eyebrow, title, 3-4 bullets, read-aloud row, recording widget (label + timer + waveform + stop link + footnote), continue button; six distinct visual groups on one scroll viewport; on smaller viewports widget likely scrolled off without user noticing |
| 9 | Help Users Recognize, Diagnose, and Recover | 2 | If mic permission denied, widget correctly shows "Microphone unavailable — your guidance continues below" but no path to open Settings and grant permission; only remediation affordance in whole file that's incomplete — every other failure silently falls back |
| 10 | Help and Documentation | 3 | "Swipe down on the gray slider to return to navigation" footer hint most explicit in-app help and useful; appears only on contact phase — not on guidance or review |
| **Total** | | **29/40** | **Good (range 27-33)** |

## Anti-Patterns Verdict

**Not AI slop.** File has genuine craft decisions slop misses: `hasStartedRecordingRef` / `hasActiveRecording` dual-tracking pattern correctly explained in comments, `usePreventRemove` chosen over `addListener` with specific documented rationale, dismissal guard comment explains NativeSharedObjectNotFound race condition. Doc comment describing 5-phase state machine is load-bearing, not decorative. Typography choices token-driven and traceable. `relaxedLineHeight` on guidance bullets traces to named cognitive-load principle.

No gradient text, no glassmorphism, no identical card grids. Eyebrow/title pattern ("Ok. Got it." / "Are you armed?") used meaningfully and sparingly — 3 phases use it.

## Cognitive Load

| Item | Status | Note |
|------|--------|-------|
| 1. Line-height on stress reads | PASS | `relaxedLineHeight(typography.title3Regular)` applied consistently |
| 2. Dynamic Type coverage | PASS | `dynamicType()` wraps transition title/subtitle, recording label/timer, OfficerTrooper bullets. Missing on transition `skipHint` and `reviewLinkText` |
| 3. Waveform visual noise under stress | PARTIAL | 48 bars at up to 64pt height visually dense; `reduceMotion` gates bars to flat baseline (correct); flat-baseline default means users without mic permission see what looks like dead/broken widget |
| 4. Timer format | FLAG | `00:MM:SS` format (triple-zero prefix) reads as confusing; stops rarely exceed 10 minutes; standard format would be `M:SS` |
| 5. Number of live countdowns | FLAG | Recording timer AND transition-to-contact journey have to be tracked in user's head; no visual connection between widget timer and RecordingChip that appears later |
| 6. Stop recording placement | FLAG | "Stop recording" appears inside recording widget as underlined footnote link; visual weight subordinate to recording timer and label; user glancing under stress will not notice as action |
| 7. Review sub-view count / wayfinding | PARTIAL | 5 sub-views with dot strip; dots 6pt → 8pt for active; at that size, under stress, in car, dots don't read crisply enough |
| 8. Exit affordance at end of review | FAIL | After last review sub-view, no explicit "Done" or "Back to contact" CTA; `Back` button footnoteRegular underlined at trailing end of footer, easy to miss |

## Emotional Journey

**Armed phase:** Tone correct. "Ok. Got it." as eyebrow is right de-escalation opener — acknowledges situation without catastrophizing. Three answer cards calm, visually even in weight, `Prefer not to answer` is most considerate affordance. Heavy haptic on answer earned and correct.

**Transition phase:** "We'll walk you through what to do. We've started recording for your safety." lands well — reassures without alarming. 3-second auto-advance considered design choice but *experience* of waiting 3 seconds during traffic stop could feel longer. `Tap to continue` hint too small. Phase risks feeling like app is slow to respond.

**Guidance phase:** Emotional register shifts from "companion" to "directive" — right shift. Bullets calm, verb-first. Waveform's live movement signals protection-in-progress. Read-aloud option genuine stress-reducer. Recording widget's "Saved to your phone — only you can access it" footnote is right trust-building beat. **Risk:** guidance phase is densest phase in modal and most likely to feel overwhelming.

**Contact phase:** "You're not alone." is genuinely strong emotional beat — best single line in the file. Pulsing outer ring connects avatar to "live/active" register. `Add a contact` fallback is trauma-aware (mid-stop recovery rather than dead end). **Risk:** if no contact set, disabled Call/Text buttons at 40% opacity communicate failure, not calm guidance. "Add a contact" affordance is avatar block, not labeled button — too subtle for someone who just started traffic stop.

**Review phase:** Reference mode, not active guidance mode. OfficerTrooper visual distinction useful and legible. Rights copy ACLU-accurate. Emotional arc from "companion" to "reference" appropriate. **Risk:** review presented as 5 mandatory sub-views with no "jump to the part I need" affordance.

## What's Working

**1. Dismissal guard correctly implemented and explains itself.** Using `usePreventRemove` rather than lower-level `beforeRemove` listener is right call for native stack gestures. Comment explains NativeSharedObjectNotFound race condition precisely. Defense that only comes from having actually debugged the race. Alert text ("Your recording will be saved. Leave this screen?") is calm and honest.

**2. Reserved-color discipline clean.** Red appears only on recording widget waveform bars and RecordingChip pulse dot — exactly where `.cursorrules` carve-out #5 documents. No red bleeds into CTAs, backgrounds, or text. Wiltedgreen correctly carries Continue button and text-button border on guidance phase. Avatar ring uses fadedgreen for outer pulse — gentlest green, not primary green, correct for ambient status.

**3. Conservative default for firearm disclosure is load-bearing safety logic, correctly implemented.** `duty-to-inform` as loading/failure/off-US default explicitly justified in both `useDisclosureDuty` and component comment. `preferred-not-to-answer` falling into `showFirearmGuidance` bucket (same as `yes`) is right conservative decision — comment names it ("conservative bucket"). Safer-default rationale clearly considered.

## Priority Issues

**[P0] Dismissal affordance is invisible — users may not discover confirm guard**
- What: `usePreventRemove` correctly blocks swipe-down dismiss during recording and shows Alert, but no visible in-UI affordance signals "this sheet has dismiss guard." DragHandle at top visually identical to any other dismissible modal. User who doesn't know sheet is guarded may interpret Alert as unexpected behavior.
- Why it matters: For Black driver persona in most charged moment, unexpected UI behavior during traffic stop is categorically dangerous — may prompt physical interaction with phone during stop to figure out "why it's not closing." Alert fires *after* gesture; affordance should communicate guard *before* it.
- Fix: When `hasActiveRecording` is true, add small persistent lock indicator on DragHandle row — `Lock` Phosphor icon (16pt, `labelTertiary`) next to handle with `accessibilityLabel="Recording in progress — swipe down to safely end"`. Alternatively, swap DragHandle for `LockSimple` icon during active recording. 1-2 lines of JSX + conditional style.

**[P1] "Stop recording" visual weight insufficient for destructive affordance under stress**
- What: `stopRecordingText` is `footnoteRegular` (13pt) + `textDecorationLine: 'underline'` + `color: colors.labelTertiary` — same visual treatment as secondary metadata or disabled caption. Renders below waveform, above footnote, inside padded widget. Under stress, in variable ambient light, with eyes partly on road and officer, invisible as interactive element.
- Why it matters: Recording is primary protection layer. User who wants to stop recording mid-stop needs to find and act on this control reliably. Current weight says "maybe tap this if you feel like it"; correct weight says "this is an action."
- Fix: Promote `stopRecordingBtn` to proper contained control — 44pt-tall pill-bordered button with `footnoteEmphasized` text and `labelTertiary` border. `paddingVertical: 6, paddingHorizontal: 12` is 12pt painted height — fails tap-target rule. Minimum: `paddingVertical: 13` to reach 44pt painted.

**[P1] "Add a contact" affordance too subtle for mid-stop recovery**
- What: When no trusted contact set, avatar block becomes Pressable with `UserPlus` icon and "Add a contact" beneath. Visual ring pulses only when contact set — correctly non-pulsing in empty state. But "Add a contact" call-to-action has no button affordance: no border, no background, no explicit tap-state beyond `pressedDim`. Reads as static content, not action.
- Why it matters: Casey persona and Black driver persona both need this recovery path. If user pulled over without trusted contact configured and doesn't discover this path, loses entire contact safety layer. Contact phase is only surface where this recovery is offered mid-stop.
- Fix: Below avatar name ("Add a contact"), add explicit pill-outline button: `"Tap to add a trusted contact"` in `subheadlineEmphasized` + `freshgreen` border + 44pt height. Distinct from avatar Pressable (which remains) and gives action discoverable tap surface.

**[P2] Timer format `00:MM:SS` adds unnecessary parsing load**
- What: Both RecordingChip and recording widget display elapsed time as `00:${minutes}:${seconds}` — three-segment format with permanently-zero hours. 4-minute stop reads as `00:04:00`.
- Why it matters: Under stress, parsing three-segment countdown requires recognizing leading `00:` is constant and focusing on middle two digits. Minor but nonzero cognitive tax. VoiceOver path already uses raw numeric values; sighted display could follow.
- Fix: Change to `M:SS` when elapsed < 3600 seconds. One line each in RecordingChip and GuidanceView.

**[P2] Transition phase `Tap to continue` skip-hint undiscoverable**
- What: Skip hint rendered at `footnoteRegular` (13pt), `opacity: 0.7`, `color: colors.labelTertiary`, 24pt below subtitle, at bottom of centered text block. Entire screen tappable but visual affordance is smallest, dimmest element on screen.
- Why it matters: Transition auto-advances after 3 seconds. Self-regulation during stress improved by perceived control over pace.
- Fix: (a) Make hint visible: promote to `subheadlineRegular` (15pt) at full opacity with subtle `wiltedgreen` tint, or (b) add visible "Continue" CTA button below text block. Option (b) makes skip affordance structurally obvious.

**[P2] No settings-redirect when mic permission denied**
- What: `!micGranted` branch shows "Microphone unavailable — your guidance continues below" with no action. On iOS, user can only re-grant mic permission from Settings app; UI offers no path there.
- Why it matters: User who denied mic permission during onboarding and regrets it mid-stop has no in-app recovery path. Recording is primary safety affordance; losing it silently is worse than losing it with recovery path offered.
- Fix: Add "Open Settings" Pressable below unavailable copy that calls `Linking.openURL('app-settings:')`. Style as `wiltedgreen`-underlined footnote link. Label: `"Open Settings to allow microphone access"`. One-liner on Linking API file already imports.

**[P3] Review back button returns to contact, not guidance**
- What: `onClose` from ReviewView calls `() => setPhase('contact')`. Documented: "returns to contact phase rather than dismissing entire modal." Correct for exit-modal case. However, no path from Review back to guidance bullets.
- Why it matters: Guidance bullets are most actionable content in flow — they're what to do right now. Review is reference. Users reading review may realize they missed something and want to return.
- Fix: On ReviewView footer, tertiary link below `Back` button: `"← Back to guidance"` that calls `() => setPhase('guidance')`. Or expose guidance bullets as first Review sub-view.

## Persona Red Flags

**Sam (accessibility):**
Transition phase `skipHint` is static `footnoteRegular` — not wrapped in `dynamicType()`. Sam using Large Accessibility size will see scaled title text and scaled subtitle, then visually tiny "Tap to continue" at 13pt static. `stopRecordingBtn` fails tap-target rule (painted ~18pt) — for Sam, real miss. VoiceOver announces phase changes — correct and good — but RecordingChip's `accessibilityRole="text"` means VoiceOver won't announce updates to live timer automatically. Consider `accessibilityLiveRegion="polite"` on timer Text.

**Casey (distracted mobile):**
Casey physically in car, possibly shaking, one hand on wheel, possibly in daylight glare. Recording widget's "Stop recording" underlined footnote link is highest-risk tap-target miss for Casey. Transition 3-second auto-advance without visible progress cue means Casey has no sense of when next action will appear. Guidance phase layout — eyebrow + title + bullets + readAloud + spacer + widget + continue — requires scroll comprehension pass. On 4.7" iPhone SE, Continue may be below fold behind widget. Casey may tap "Stop" thinking it advances.

**Black driver assessing safety in a charged moment:**
This is the surface built for them, and several micro-decisions exactly right: "Ok. Got it." right de-escalation opener. `preferred-not-to-answer` respects autonomy. State-aware disclosure guidance is critical safety feature — and safer-default (duty-to-inform while loading) is right conservative choice. "You're not alone." on contact phase is strongest emotional line in app.

The flags:

(1) "Add a contact" mid-stop recovery too subtle for this persona in this moment. Black driver entering flow without trusted contact may be in one of two states: (a) knew they didn't have one and hoped wouldn't need it, or (b) forgot they hadn't set one up. In either case, contact phase showing dim `UserPlus` icon in ring with "Add a contact" in small text, without visible button, in same format as configured contact — layout communicates "everything is fine" when underlying state is "you're on your own right now."

(2) Dismiss guard fires Alert when they try to swipe down. For driver used to modals being swipeable and under acute stress, unexpected system Alert appearing at moment they want to end flow is startle. Proactive lock affordance (P0 fix) would prevent.

## Minor Observations

- `timeString` in GuidanceView and display in RecordingChip produce slightly different string formats — same format but two separate format strings are drift risk.
- `transitionStyles.skipHint` has `marginTop: 24` — only spacing value in file not from `spacing.lg` (24). Could be `spacing.lg` for consistency.
- Armed eyebrow "Ok. Got it." uses period after each sentence. Transition "We'll walk you through what to do." uses period. Guidance eyebrow "We can help" has no period. Minor copy inconsistency.
- RecordingChip uses `accessibilityRole="text"` — not standard valid value. Intended behavior better served by `accessibilityRole="none"` with `accessibilityLiveRegion="polite"` on timer itself.
- Contact subtitle reads "Your trusted contacts are alerted" — says "contacts" (plural) but flow supports single contact. Copy overstates capability.
- WhatToHaveView bullet for "Registration" renders as single bolded word — unlike other bullets which have Strong sections within plain text.

## Questions to Consider

1. What does user see between leaving armed phase and recording actually starting? Async `prepareToRecordAsync()` call before `recorder.record()` — if 200-500ms, waveform shows flat baseline during window — visually identical to mic-unavailable state.
2. Is `Tap to continue` affordance on transition phase discoverable in user testing? Trauma-informed rationale (pace control) strong; implementation may not be surfacing it.
3. What happens if user gets phone call during recording? iOS will typically interrupt audio session. Does `expo-audio` recorder handle interruption gracefully?
4. Is there design decision about maximum recording duration? At 60 minutes, would display `00:60:00`. Latent bug.
5. Should ReviewView know which sub-view corresponds to user's armed state? Currently WhatToSayView always sub-view 3 — but if `showFirearmGuidance` false, firearm bullets absent and view is shorter.
