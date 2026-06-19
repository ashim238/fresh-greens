---
target: app/recordings.tsx
total_score: 27
p0_count: 2
p1_count: 2
timestamp: 2026-06-19T09-53-39Z
slug: app-recordings-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading and error states present and named; active-playback state (green border) subtle but legible; missing: no progress indicator for currently-playing recording |
| 2 | Match Between System and Real World | 3 | "Armed / Unarmed / Undisclosed" mirrors officer's language from flow; `formatDuration` outputs bare `0:12` with no unit label |
| 3 | User Control and Freedom | 3 | Delete-confirm modal with tap-scrim, X button, and "Yes, I'm sure" correct; individual row deletion has no confirm — one accidental Trash tap permanent; asymmetry meaningful for legal evidence material |
| 4 | Consistency and Standards | 3 | Phosphor icons, tapTarget44, dynamicType, spacing tokens — all consistent; 56pt circular play button consistent with primary FABs; `gap: 12` in `recordingsList` is off-ramp |
| 5 | Error Prevention | 2 | No confirmation on single-row delete for what may be critical evidence; `cardBorderSubtle` is `rgba(0,0,0,0.3)` — noticeably heavy on white-to-grouped-gray card, blunting active-state green border signal |
| 6 | Recognition Rather Than Recall | 3 | Timestamp + armed-status + duration row dense but self-contained; no recording name, no route/location context, no thumbnail — users with multiple recordings from similar dates have no distinguishing affordance except timestamp |
| 7 | Flexibility and Efficiency of Use | 2 | No swipe-to-delete; no way to share or export — entire purpose of these recordings is as potential legal evidence, and there is no path from list to sharing with lawyer, family, or civil rights org; surface feels like archive with no exit |
| 8 | Aesthetic and Minimalist Design | 4 | Clean. Light-gray cards, green play button, sparse secondary text. Title row proportional and grounded. No decoration carrying no meaning |
| 9 | Help Users Recognize, Diagnose, Recover | 2 | Error state copy generic: "We couldn't load your recordings. Reopen this screen to try again." No retry button — only recovery path is closing and reopening screen |
| 10 | Help and Documentation | 2 | Screen provides no contextual framing of what recordings *are for* or what to do with them; empty state partially addresses cold-start ("Audio captures from your safety flow appear here") but vanishes the moment any recording exists |
| **Total** | | **27/40** | **Functional — core flows work, strategic gaps around material's high stakes** |

## Anti-Patterns Verdict

**Not AI slop.** Screen clearly hand-authored. Comments carry genuine engineering rationale (isDeletingAll latch, R6 VoiceOver collapse, R7's geometric derivation of close-button offset). State ladder explicitly documented with latent bug it fixed. `confirmBodyEmphasis` inline bold ("cannot" run) shows awareness of native Alert's limitations and thoughtful decision to build custom modal. `justDeletedAll` state distinction between "never had" and "just cleared" shows UX-level thinking.

One light-slop tell: `relaxedLineHeight` import present but never used in file. Suggests copy-paste import from another screen without subsequent clean-up pass.

## Cognitive Load

1. **Number of distinct decisions per view:** Low. Only decisions are play/pause or delete. Delete-all explicit and gated. **Pass.**
2. **Visual hierarchy clarity:** Title > card-timestamp > secondary-meta is clean three-level hierarchy. **Pass.**
3. **Action labeling ambiguity:** Play button has no visible text label — icon-only affordance on critical evidence artifact. Trash icon similarly has no label. **Partial fail.**
4. **State change visibility:** Active-playback state signaled only by card's border changing from `cardBorderSubtle` to `freshgreen`. Border-width stays at 1pt — subtle, easily-missed signal. No waveform, no playing animation, no explicit "Now playing" label. **Partial fail.**
5. **Error recovery path:** Error state offers copy and no action. **Fail.**
6. **Destructive action friction:** Delete-all correctly gated. Single-row delete has zero friction for legally significant material. **Split.**
7. **Information density per card:** Date + time + armed status + duration is right density for scanning; for positive identification of specific incident, it is thin. **Pass for casual; borderline for evidence.**
8. **Modal interrupt coherence:** Delete-all confirm modal clearly scoped, dismissible; button copy self-describing ("Yes, I'm sure"). **Pass.**

## Emotional Journey

**Arrival:** User arrives after triggering safety flow. Likely still in elevated state. Screen opens to clean white surface, Microphone icon, word "Recordings." Calm, no alarm color, no urgency. Brand holding composure.

**List scan:** User looks for their recording. Sees timestamps and durations. If multiple recordings, must identify right one by date/time — requires remembering exactly when stop happened. In charged state, time perception unreliable. "Armed / Unarmed / Undisclosed" useful distinguisher but only if they answered question. **Moment where screen's thinness starts to cost trust.**

**Playback:** User taps play. Faint green border appears. Audio starts. No scrubbing, no progress, no way to know if first three minutes captured anything useful without listening through. For recording that may be evidence, low-fidelity verification experience.

**The export question:** User realizes they need to send this to someone — family, lawyer, civil rights organization. **No share button. No export. Screen is dead end.** Single largest emotional gap: screen that houses most important artifact of safety system has no path to doing anything with that artifact except listening to it in-app and deleting it.

**Delete-all state:** Well-handled. Confirmation modal's language ("Deleted files cannot be recovered") honest without being alarming.

## What's Working

**1. State ladder correctness.** Explicit `loading → error → empty → list` ladder (documented in PR K note) is model of how to handle async state. Latent bug it fixed (delete-all bar appearing over loading screen) shows developer thought about state interactions. `justDeletedAll` distinction is UX-level touch most screens skip.

**2. VoiceOver architecture.** R6 collapse (timestamp + armed status + duration into single focusable node) reduces stop count from 4 to 3 without losing information. `accessibilityViewIsModal` on scrim, `accessible={false}` on scrim Pressable — correctness details that typically only appear in apps built under accessibility review.

**3. Destructive-confirm modal implementation.** Custom Modal over `Alert.alert` to enable inline `cannot` bold run is genuine UX decision with documented reason. Geometry derivation in R7 (44pt transparent target centered on 32pt circle) rigorous. Tap-scrim + X + Reduce Motion gating — all present, all correct.

## Priority Issues

**[P0] No path to share or export a recording**
- What: No affordance to send a recording to another person, export it to Files, or share via iOS Share Sheet. Screen is read-only + delete-only.
- Why it matters: Sole purpose of these recordings is evidence preservation during traffic stop. Recording user cannot share or export is effectively inaccessible as legal protection. If user's phone seized, damaged, or they need to send to lawyer or family member, app offers no path. **Highest-stakes UX gap in entire app** — undermines safety thesis at point of greatest need.
- Fix: Add Share icon (Phosphor `ShareNetwork` or `Export`) to each card row, on right side. Trigger iOS Share Sheet (`expo-sharing` or `Sharing.shareAsync(uri)`). Single addition per `RecordingCard` with no architectural changes to `useRecordings`.

**[P0] Single-row delete has no confirmation for legally significant material**
- What: Tapping Trash icon on row immediately calls `handleDelete` with no confirm dialog. Single accidental tap permanently destroys what may be evidence of police misconduct.
- Why it matters: Bulk-delete path gated with thoughtfully-designed modal; row-level path is not. Asymmetry backward — user more likely to accidentally tap small icon than press clearly-labeled "Delete all recordings" button. For Black driver who just recorded traffic stop, fat-finger on wrong icon has legal consequences.
- Fix: Apply same confirm pattern as `handleRequestDeleteAll` / Modal — or at minimum iOS `Alert.alert` with destructive-style confirm. Inline-bold `cannot` rationale doesn't apply here, so `Alert.alert` appropriate and lower overhead than second Modal.

**[P1] No playback progress indicator**
- What: When recording playing, only visual signal is card's green border and Pause icon in play button. No progress bar, elapsed time, or remaining time.
- Why it matters: Recording from traffic stop may be 15 minutes long. User listening to verify content has no way to navigate, to know where they are, or to know how much is left. `useAudioPlayerStatus` hook already exposes `positionMillis` and `durationMillis` — data is available.
- Fix: Render thin progress bar below `cardTextStack` when `isActive`, driven by `status.positionMillis / recording.durationMs`. Or add elapsed counter in `cardSecondary` row while playing. Full scrubber not required — read-only progress bar materially improves verification.

**[P1] Error state offers no retry affordance**
- What: `ErrorState` component renders copy but no action. Instruction "Reopen this screen to try again" requires user to navigate away and back.
- Why it matters: User who just completed safety flow and arrives on /recordings to see error has no in-screen recovery. Emotional context (post-traffic-stop, wanting to confirm recording survived) makes blank error state with no action particularly poor.
- Fix: Pass `onRetry` callback to `ErrorState` component. In `useRecordings`, expose `reload` function that re-runs `getRecordings`. Wire in `recordings.tsx`.

**[P2] `cardBorderSubtle` (rgba(0,0,0,0.3)) too heavy for card border on systemGroupedBackground**
- What: `cardBorderSubtle` resolves to `rgba(0,0,0,0.3)` — 30% black opacity on `#F6F6FA` grouped background. Reads more as hard edge than subtle separator.
- Why it matters: Active-state green border needs to read as signal change from resting state. If resting border already strong, delta between rest and active is smaller and signal diluted. Creates mild visual noise across full list of cards.
- Fix: Step border back to `colors.separatorSubtle` (`rgba(0,0,0,0.1)`) or `colors.separatorOnFlat` (`rgba(0,0,0,0.08)`).

**[P2] No contextual framing once recordings exist**
- What: Empty state has clear copy ("Audio captures from your safety flow appear here"). Once any recording exists, that framing disappears entirely.
- Why it matters: User who arrives here first time weeks after a stop may not remember recordings are only from safety-flow activations, may not know how to get them off device, has no pointer to next steps.
- Fix: Add subdued footnote-level description line under page title — "Recordings are captured privately on your device during safety flows." One `footnoteRegular` line in `labelTertiary` covers orientation case without adding visual weight.

**[P3] `relaxedLineHeight` imported but unused**
- What: Line 27 imports `relaxedLineHeight` from `../theme/dynamic-type` but never called.
- Fix: Remove the `relaxedLineHeight` named import from line 27.

## Persona Red Flags

**Sam (accessibility):**
Icon-only play button and Trash button covered by `accessibilityLabel` — Sam would hear "Play June 14 · 3:42 PM" and "Delete recording from June 14 · 3:42 PM." Correct. However, active-playback state communicated via `accessibilityState={{ selected: isActive }}` — `selected` typically used for tabs and segmented controls, not playback state. More semantically correct approach is `accessibilityState={{ busy: isPlaying }}`. No `accessibilityHint` on play button to indicate what happens on press for new user.

**Casey (distracted mobile):**
56pt play button is large, thumb-friendly target — good for one-handed use. Trash button at `tapTarget44` (44pt transparent surface, 24pt icon) compliant but small for distracted tap. Layout places play button on left and Trash on right — natural left-to-right reading order pushes destructive action to dominant-hand side, increases fat-finger risk.

**Black driver assessing safety in a charged moment:**
This is the persona where screen is most consequential and most underbuilt. Driver has just ended traffic stop, triggered safety flow, and needs to confirm: (1) recording exists, (2) long enough to have captured stop, (3) they can get it somewhere safe. Screen answers (1) yes, (2) partially, (3) **not at all**. Absence of share/export path is critical failure. If officer takes or damages phone, if driver needs to hand it to passenger, if they want to immediately send it to family member — no affordance for any of these actions. **Single Share affordance per card would transform this screen from archive into safety tool.**

## Minor Observations

- `formatDuration` outputs bare `"0:12"` — consider `accessibilityLabel` override that reads "12 seconds" or "1 minute 12 seconds" for VoiceOver.
- Title-row Microphone icon is `color={colors.black}` at 48pt `duotone` weight — duotone with single color is flat single-color render. Likely rendering bug.
- `confirmBodyEmphasis` spreads `typography.bodyEmphasized` without wrapping in `dynamicType()`. At large Dynamic Type sizes parent `confirmBody` scales but emphasis run's font size does not. Breaks typographic relationship.
- `handleConfirmDeleteAll` calls `Promise.all(recordings.map((r) => removeRecording(r.id)))`. If list has 50 recordings, fires 50 parallel AsyncStorage writes.
- `gap: 12` in `recordingsList` is documented off-ramp. Worth revisiting whether 12 actually looks meaningfully better than 16.

## Questions to Consider

1. What is intended export path for recordings? Is expo-file-system + expo-sharing right mechanism, or future server-upload path?
2. Should armed-status field be hidden or access-controlled? "Armed" as metadata accessible to anyone who unlocks phone is sensitive — could be used against driver if phone inspected.
3. Is recordings screen ever reachable during active safety flow? If user navigates to /recordings mid-flow, hook would re-mount and audio player would initialize independently from pulled-over flow's player.
4. Is there maximum recording retention policy? Unlimited list of indefinitely retained audio files raises storage and privacy questions.
5. Microphone `duotone` icon with `colors.black` — intentional? Duotone with single color is flat single-color render.
