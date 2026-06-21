---
target: app/pulled-over.tsx
total_score: 32
p0_count: 1
p1_count: 1
timestamp: 2026-06-20-closeout
slug: app-pulled-over-tsx
phase: closeout
---

## Then vs now

**Phase 1:** 29/40 · 1 P0, 2 P1, 3 P2 (6 priority findings).
**Closeout:** 32/40 · 1 P0, 1 P1, 3 P2 (5 priority findings).

Phase 2/3 work landed two of Phase 1's three top-priority items: the stop-recording control now paints at 44pt (PR #238) and the empty-contact avatar adopts the freshgreen-outline + bodyEmphasized register that reads as a clear CTA (PR #247). The recording-widget hierarchy gained a third state ("Recording saved") and the RecordingChip's a11y label was rewritten to read clean numerics. The P0 dismissal-affordance gap and the smaller polish items (skipHint discoverability, Settings redirect on mic-denied, timer format, Review→Guidance back) remain unaddressed — pulled-over was the safety-critical surface most touched by Phase 3 but its remaining gaps are now the smallest cohort in the file's history.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | RecordingChip live timer on contact/review; new "Recording saved" terminal state on guidance closes the silent-cleanup gap from Phase 1; still no transition-phase progress cue |
| 2 | Match Between System and Real World | 4 | Guidance register, Officer/Trooper visual language, ACLU-accurate rights copy — unchanged from Phase 1, still right |
| 3 | User Control and Freedom | 3 | Manual stop-recording now reaches a terminal "Recording saved" state (genuine control, not just gesture); `Tap to continue` on transition still 13pt at opacity 0.7; Review `Back` still returns to contact only |
| 4 | Consistency and Standards | 3 | `readAloud` icons 32pt vs Contact/Review 24pt unchanged; `stopRecordingText` still footnote-underlined (now at 44pt painted but visually still reads as link, not destructive action); `reviewLink` still labeled `accessibilityRole="link"` for button behavior |
| 5 | Error Prevention | 4 | `stopRecordingBtn` painted minHeight 44pt + paddingHorizontal 12 — fails-tap-target gap from Phase 1 closed; Alert language unchanged ("Save & leave"); `usePreventRemove` guard correct |
| 6 | Recognition Over Recall | 4 | Unchanged — guidance bullets repeat verbatim in Review sub-views; state attribution on WhatToSayView |
| 7 | Flexibility and Efficiency of Use | 2 | Flow still strictly linear; transition still 3s auto-advance with tap-to-skip; no Review→Guidance return path |
| 8 | Aesthetic and Minimalist Design | 3 | Guidance phase density unchanged: eyebrow + title + bullets + readAloud + widget + continue still six visual groups; recording widget's third state (saved) reduces noise once user stops — net neutral for the active stop |
| 9 | Help Users Recognize, Diagnose, and Recover | 2 | RecordingSaveErrorBanner on save-failure is genuinely good recovery affordance (added since Phase 1); mic-permission-denied path still has no Settings-redirect |
| 10 | Help and Documentation | 3 | "Swipe down on the gray slider to return to navigation" hint still only on contact phase |
| **Total** | | **32/40** | **Good (range 27-33, upper end)** |

## Anti-Patterns Verdict

**Not AI slop.** Phase 1's craft observations all hold — `hasStartedRecordingRef` / `hasActiveRecording` dual-tracking, `usePreventRemove` over `addListener`, doc-comment 5-phase state machine, token-driven typography. New evidence of craft: the RecordingSaveErrorBanner pattern (deferred nav action stashed in refs so Retry can replay the user's original back-gesture) is exactly the kind of edge-case engineering slop misses. The `recordingArmedRef` / `recordingStartedAtRef` snapshot-at-start pattern is documented and load-bearing.

No gradient text, no glassmorphism, no identical card grids. Eyebrow/title pattern continues to be used sparingly (3 phases) and meaningfully.

## Cognitive Load

| Item | Status | Note |
|------|--------|------|
| 1. Line-height on stress reads | PASS | `relaxedLineHeight(typography.title3Regular)` consistent across GuidanceBullet, ContentView Bullet, OfficerTrooper bullet (the latter promoted from 16pt static per P11 fix per inline comment) |
| 2. Dynamic Type coverage | PARTIAL | `dynamicType()` on transition title/subtitle, recording label/timer, OfficerTrooper bullets, ContentView bullets. Still missing on `skipHint` and `reviewLinkText` and `stopRecordingText` |
| 3. Waveform under stress | PARTIAL | 48 bars × 64pt max unchanged; `reduceMotion` correctly gates to flat baseline. Flat baseline now distinguishable from mic-unavailable because micUnavailable has its own widget state ("Microphone unavailable…") rather than just appearing as a flat waveform |
| 4. Timer format | FLAG | `00:MM:SS` format unchanged on sighted display. RecordingChip a11y label now reads clean numerics ("X minutes Y seconds") — sighted display still has the triple-zero prefix |
| 5. Number of live countdowns | FLAG | Recording timer + RecordingChip both tick; no visual continuity bridge between them when transition out of guidance happens |
| 6. Stop recording placement | PARTIAL | Now reaches 44pt painted minimum (per `minHeight: 44`), so tap-target rule satisfied. Visual weight still subordinate — `footnoteRegular` + `labelTertiary` + underline — so under stress it still reads as link, not as destructive action. The fix that landed was tap-target, not visual-weight |
| 7. Review sub-view count / wayfinding | PARTIAL | 5 sub-views with 6pt→8pt active dot; unchanged from Phase 1 |
| 8. Exit affordance at end of review | FAIL | `closeBtn` now paints 44pt (paddingVertical: 13) — tap-target fixed — but is still trailing-aligned underlined footnote text, easy to miss under stress |

## Emotional Journey

**Armed phase:** Unchanged from Phase 1 — tone correct, three cards visually even, `Prefer not to answer` considerate, heavy haptic on answer earned.

**Transition phase:** Unchanged from Phase 1. "We've started recording for your safety." is still the right calming beat; `Tap to continue` is still too small to discover under stress. The Pressable wraps the whole text block with documented trauma-informed rationale ("pace control during stress is one of the strongest predictors of self-regulation per Stanford's Trauma & Resilience Lab") which is the right reasoning — implementation still doesn't surface the affordance enough.

**Guidance phase:** New "Recording saved" terminal state is a meaningful emotional improvement — when the user manually stops, the widget collapses from active-waveform to a quiet "Recording saved — Saved to your phone — guidance continues below" panel. That's the kind of "the app acknowledged my action" feedback Phase 1 missed. The active-recording state still has the bullets + readAloud + widget + Continue density Phase 1 flagged.

**Contact phase:** Major improvement. Empty-state avatar now `freshgreen` outline + duotone UserPlus + `bodyEmphasized` freshgreen "Add a contact" label. Reads unambiguously as CTA rather than dim, static layout. Removes Phase 1's strongest contact-phase emotional flag. "You're not alone." still the best line in the file.

**Review phase:** Reference-mode arc unchanged. Still no Review→Guidance back link.

## What's Working

**1. Phase 1's Add-a-contact subtle-affordance flag closed.** Empty-state avatar's fill→outline register flip (per `avatarCircleEmpty`: `backgroundColor: 'transparent'` + 2pt freshgreen border) plus the `contactNameEmpty` style (bodyEmphasized + freshgreen) is the right move. Reuses the Button library's fill-vs-outline convention (fill = identity/commitment, outline = invitation/secondary) rather than introducing new chrome. The inline comment ("a filled wiltedgreen avatar misframes the empty slot as a populated identity") names exactly what was wrong with the prior treatment. Single-property flip, semantically loaded.

**2. Stop-recording tap-target compliant; manual-stop now reaches a real terminal state.** The Phase 1 fix that landed (`minHeight: 44`, `paddingHorizontal: 12`) is the tap-target half. The new `recordingStopped` state + handleStopRecording flow is the conceptual half — Phase 1 implicitly assumed manual stop existed; now it does and lands in a real "Recording saved" widget state with cleared `hasActiveRecording`. The two halves together make stop-recording a first-class control even if the visual weight is still link-like.

**3. RecordingSaveErrorBanner — recovery affordance for the highest-stakes silent-fail path.** Added since Phase 1. The deferred-navigation pattern (stashing input + nav action in refs so Retry can replay the user's original back-gesture, while explicit Discard fires the action without retry) is exactly the kind of P-C-shaped escape hatch the file's highest-stakes data-loss path needed. Comment correctly identifies this as "highest-stakes silent-fail surface in the app."

**4. RecordingChip accessibility label reads clean.** `a11yMinutes` / `a11ySeconds` (raw numerics) feed the accessibility label instead of the zero-padded display string, so VoiceOver says "0 minutes 3 seconds elapsed" rather than "zero zero minutes zero three seconds". Inline comment names the exact bug ("VoiceOver reads '00' as 'zero zero' literally"). Closes the Sam-persona note from Phase 1 on the a11y side, even though the sighted timer format is unchanged.

## Priority Issues

**[P0] Dismissal affordance is still invisible — users may not discover confirm guard**
- What: `usePreventRemove` correctly blocks swipe-down dismiss during recording and shows Alert, but no visible in-UI affordance signals "this sheet has dismiss guard." DragHandle at top is visually identical to any other dismissible modal. User who doesn't know sheet is guarded may interpret Alert as unexpected behavior.
- Why it matters: For the Black-driver persona in the most charged moment, unexpected UI behavior during a traffic stop is categorically dangerous — may prompt physical interaction with phone during stop to figure out "why it's not closing." Alert fires *after* gesture; affordance should communicate guard *before* it.
- Phase 1 status: Open. PR #246 (safety-critical convention) was scoped to surfaces that lacked confirmation; pulled-over already had `usePreventRemove`-driven Alert and was excluded — correctly, but the visible-lock affordance gap is orthogonal and remains.
- Fix: When `hasActiveRecording` is true, add small persistent lock indicator on the DragHandle row — `Lock` Phosphor icon (16pt, `labelTertiary`) next to handle with `accessibilityLabel="Recording in progress — swipe down to safely end"`. 1-2 lines of JSX + conditional style.

**[P1] "Stop recording" visual weight still reads as link, not destructive action**
- What: `stopRecordingText` is `footnoteRegular` (13pt) + `textDecorationLine: 'underline'` + `color: colors.labelTertiary`. The Phase 1 tap-target half of the fix landed (`minHeight: 44`); the visual-weight half didn't. Under stress, with eyes partly on road and officer, the control still reads as secondary metadata that happens to be tappable rather than as "this is an action you can take."
- Why it matters: Recording is the primary protection layer. With manual-stop now actually doing something (the new `recordingStopped` terminal state is a real improvement), the gap between the action's importance and its visual treatment widened slightly — the destination state is now first-class but the entry control still isn't.
- Fix: Promote `stopRecordingBtn` to a contained control — `footnoteEmphasized` text with a 1pt `labelTertiary` pill border (or `wiltedgreen` if matching the recording-system register). Keep the existing `minHeight: 44` and `paddingHorizontal: 12`. ~3 style-prop changes.

**[P2] Timer format `00:MM:SS` still adds parsing load on sighted display**
- What: Both RecordingChip and guidance recording widget still display elapsed as `00:${minutes}:${seconds}` (lines 864 and 1008). A 4-minute stop reads as `00:04:00`. The a11y label was fixed (raw numerics, comment-documented as P13) — the sighted display wasn't.
- Why it matters: Under stress, parsing three-segment countdown means recognizing the leading `00:` is constant and focusing on the middle two digits. Minor cognitive tax, but the a11y label being clean while the sighted display has the triple-zero prefix is internally inconsistent — and the comment that fixed the a11y side ("reads as a bug") applies equally to the sighted side.
- Fix: `const timeString = hours > 0 ? \`${hours}:${minutes}:${seconds}\` : \`${minutes}:${seconds}\`` in both GuidanceView (l. 862-864) and RecordingChip (l. 990-991, 1008). Two ~3-line changes.

**[P2] Transition phase `Tap to continue` skip-hint still undiscoverable**
- What: Skip hint rendered at `footnoteRegular` (13pt), `opacity: 0.7`, `color: colors.labelTertiary`, 24pt below subtitle. Static — not wrapped in `dynamicType()` like the title/subtitle directly above it. Sam persona on Large Accessibility size still sees scaled title/subtitle and visually tiny static "Tap to continue".
- Why it matters: Unchanged from Phase 1 — transition auto-advances after 3 seconds, and self-regulation during stress is improved by perceived pace control.
- Fix: (a) Wrap in `dynamicType(typography.subheadlineRegular)` at full opacity with subtle `wiltedgreen` tint, or (b) replace with a visible Continue CTA below text block. Option (a) is the smaller diff.

**[P2] Still no settings-redirect when mic permission denied**
- What: `!micGranted` branch still shows "Microphone unavailable — your guidance continues below" with no action. `Linking` is already imported (used for `tel:` and `sms:` in ContactView).
- Why it matters: User who denied mic permission during onboarding and regrets it mid-stop still has no in-app recovery path. Recording is the primary safety affordance.
- Fix: Add "Open Settings to allow microphone access" Pressable below the unavailable text, calling `Linking.openURL('app-settings:')`. ~6 lines.

## Persona Red Flags

**Sam (accessibility):**
RecordingChip's accessibility label now reads clean numerics — Phase 1's "zero zero minutes zero three" jarring-output flag is closed. `stopRecordingBtn` now hits 44pt painted target — Phase 1's tap-target miss closed. `closeBtn` in review footer now paints 44pt (paddingVertical: 13, per the inline comment that explicitly cites the cursorrules tap-target rule). Remaining: transition `skipHint` still static (no `dynamicType`); `stopRecordingText` and `reviewLinkText` also static. The RecordingChip row uses `accessibilityRole="text"` — still not a standard valid value, and live updates to the timer still won't auto-announce because there's no `accessibilityLiveRegion="polite"` on the timer Text.

**Casey (distracted mobile):**
Recording-widget's terminal "Recording saved" state is a meaningful Casey win — manual stop now produces a calm, decisive confirmation rather than silently vanishing. Empty-contact avatar reads clearly as CTA rather than as static layout — second Casey win, addressing the Phase 1 "Add a contact subtle for mid-stop recovery" flag. The transition skip-hint and the stop-recording visual weight remain Casey-risky in the same way as Phase 1.

**Black driver assessing safety in a charged moment:**
The two improvements that landed (stop-recording-as-real-action + empty-avatar-as-clear-CTA) both target this persona's most fragile moments. Empty-state reads as "you can fix this now" rather than "everything is fine when underlying state is you're on your own" — the exact framing Phase 1 flagged. Manual stop reaches a calm terminal state rather than a vague "did I just lose my recording?" moment.

Remaining flag: dismiss guard still fires Alert with no in-UI lock affordance. The expectation-mismatch problem Phase 1 named (driver used to swipeable modals, under acute stress, encountering unexpected system Alert) is unchanged.

## Minor Observations

- `timeString` in GuidanceView (line 864) and the inline format string in RecordingChip (lines 990-991, 1008) still produce the same format from two separate code paths. Phase 1 noted this as drift risk; unchanged. With the a11y label now computing its own raw values separately, there are now *three* time-format code paths in the file.
- `transitionStyles.skipHint` still has `marginTop: 24` as a literal (not `spacing.lg`). Unchanged from Phase 1.
- Eyebrow punctuation inconsistency unchanged ("Ok. Got it." vs "We can help").
- RecordingChip still uses `accessibilityRole="text"` — not a standard role value. Should be `accessibilityRole="none"` (or omitted) with `accessibilityLiveRegion="polite"` on the inner timer Text.
- Contact subtitle still says "Your trusted contacts are alerted" (plural) but the flow supports one. Copy still overstates.
- Review `closeBtn` has correct tap-target paint and its inline comment cites the cursorrules rule explicitly — good pattern hygiene — but the label is still "Back" trailing-aligned underlined footnote; the destination context ("Back to trusted contact" per the accessibility label) doesn't surface visually.

## Questions to Consider

1. Now that manual-stop reaches a terminal "Recording saved" state, is there a parallel "Resume recording" affordance, or is stop one-way? Currently `recordingStopped` only flips true; no path back to recording within the same stop session. Probably correct (stops shouldn't restart), but worth naming as a deliberate constraint.
2. Does the "Recording saved" terminal state's footnote ("Saved to your phone — guidance continues below") match what actually happened? If `durationMs < 2000`, the recording is silently dropped per the usePreventRemove path — does manual handleStopRecording have an equivalent guard? Looking at the code, handleStopRecording just sets `recordingStopped: true` without the duration check, so the user gets "Recording saved" copy even if no recording was actually persisted via the unmount path. Worth verifying the actual save behavior matches the UI claim.
3. The Phase 1 question about maximum recording duration (`00:60:00` at 60 min) is now joined by an a11y question — at 60 minutes, the chip label would say "60 minutes 0 seconds" which is fine, but the sighted display says `00:60:00` which is wrong (should be `01:00:00`). Worth a defensive max or a format change.
4. Does the new RecordingSaveErrorBanner have its own accessibility announcement when it appears? A surface that pins until explicit user action should announce itself via `AccessibilityInfo.announceForAccessibility` on mount.
