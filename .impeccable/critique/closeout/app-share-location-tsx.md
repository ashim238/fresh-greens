---
target: app/share-location.tsx
total_score: 36
p0_count: 1
p1_count: 1
timestamp: 2026-06-20-closeout
slug: app-share-location-tsx
phase: closeout
---

## Then vs now

**Phase 1:** 33/40 · 2 P0, 1 P1, 3 P2, 1 P3 (7 priority findings).
**Closeout:** 36/40 · 1 P0, 1 P1, 2 P2, 1 P3 (5 priority findings). Delta **+3**.

Phase 2/3 work closed the more dangerous of Phase 1's two P0s. `handleEnd` no longer swallows its failure — both `handlePick` and `handleEnd` now branch on `result.ok` and surface a canonical `getErrorMessage('sharing', 'transient', error)` Alert before dismissing. The corrupted half-state where a session lingered in storage with no UI affordance is gone. PR #242 added a per-card `accessibilityHint` that names the trusted contact (`"Opens Messages with a safety check-in draft for ${contactName}"`) — the Phase 1 Sam red-flag about VoiceOver users not knowing what tap commits them to is closed. The `loading`-state Phase-1 gripe is partially addressed: the screen now gates on `shareState.ready` and renders `null` until hydration completes (no more picker→ActiveView flash). What did NOT move: the silent picker after a tap (no spinner during the async chain), the premature `"On it. Sharing your location now."` eyebrow, the `NotifyingPulse` mislabel, the inline `borderRadius: 12`, the `marginTop: -spacing.sm` hack, the raw-echo `Reason: {sessionReason}` on ActiveView. Net: the safety-critical correctness gap closed; the cognitive-load and copy gaps remain.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | `busy` still blocks re-pick with no spinner; the async chain (geo + storage + SMS deep-link) still runs invisibly after a tap |
| 2 | Match System / Real World | 4 | Picker subtitle still announces completion before any action; `"Already on it."` on ActiveView still right |
| 3 | User Control and Freedom | 4 | `dismiss()` fallback to `/home` correct; `handleEnd` now Alerts on failure so user can retry |
| 4 | Consistency and Standards | 4 | `borderRadius: 12` inline still drifts from `radii.md`; everything else token-clean |
| 5 | Error Prevention | 5 | Both `handlePick` and `handleEnd` now route failures through `getErrorMessage` + `Alert.alert` — the Phase 1 silent-corruption path is gone |
| 6 | Recognition Rather Than Recall | 4 | Four labeled reasons unchanged; `accessibilityHint` per card now names contact — first-timer learns side-effect before commit |
| 7 | Flexibility and Efficiency | 3 | `NotifyingPulse` label still inaccurate (`"Choosing a reason opens Messages…"` — Messages opens on session start, not on reason pick) |
| 8 | Aesthetic and Minimalist Design | 4 | Calm and on-brand; `gap: spacing.xxl` (48pt) between four 100pt cards still pushes the 4th below the fold on SE-class devices inside page-sheet |
| 9 | Error Recovery | 4 | `handleEnd` now Alerts with retryable copy ("transient"); session stays live so user can try again — the recovery loop exists |
| 10 | Help and Documentation | 4 | Per-card `accessibilityHint` interpolating `contactName` is genuine first-timer education — the Phase 1 critique of insufficient SMS-side-effect clarity is closed for VoiceOver users; sighted users still only see `NotifyingPulse` |
| **Total** | | **36/40** | **Good — narrow polish remaining** |

## Anti-Patterns Verdict

**PASS with two flags carried from Phase 1, both unchanged:**
1. `borderRadius: 12` written inline (line 282) rather than `radii.md`. Token exists; clean miss.
2. `marginTop: -spacing.sm` on `aspirationalNote` (line 262) — spacing-ramp negative offset as magic correction.

No reserved-color violations. No inline hex. No inline font sizes. `dynamicType()` applied throughout. Phase 2 conventions: Dynamic Type — pass. Dismissal — `dismiss()` with `canGoBack` + `/home` fallback — pass. Accessibility — `accessibilityRole`, combined `accessibilityLabel`, and new per-card `accessibilityHint` interpolating contact name — pass with depth. Safety-critical — error paths now surface to user rather than `console.warn`-and-drop; pass.

## Cognitive Load

**Low on happy path, still slightly elevated at entry and during the silent tap window.**

Entry beat unchanged: `"On it. Sharing your location now."` eyebrow still fires above `"What's the situation?"` title before any user action. Phase 1 called this a beat of confusion; PR #242 didn't touch it. The status-report-before-action inversion still makes first-timer wonder if something already happened.

The silent tap window — `busy = true` flips, the screen freezes for the duration of geo + storage + Messages deep-link — is the single highest-cost remaining issue. Phase 2 didn't address it. In safety flow under stress, frozen UI still reads as broken. The Phase 1 P0 is now a single P0 because the other P0 (`handleEnd` corruption) closed.

ActiveView still thin: `"Reason: {sessionReason}"` echoes the stored title verbatim in the smallest footnoteRegular token. Easy to miss; does little work. No session-start timestamp. No "since X minutes ago" affordance for a user returning 20 minutes later.

## Emotional Journey

**Entry:** Same Phase 1 beat. User in heightened state arrives at sheet, reads `"On it. Sharing your location now."` before tapping anything → "wait, did it already go?" Composure-over-alarm thesis intact but the eyebrow undercuts it. Still the cheapest copy fix in the file.

**Picking a reason:** Card register calming, `pressedDim` feedback correct, four reasons cover the emotional range without alarmism. New since Phase 1: VoiceOver users hear `"Opens Messages with a safety check-in draft for {contactName}"` on focus — for the Black-driver persona using VoiceOver in a charged moment, this is meaningful: the screen now tells them by name who is about to learn their location, before they commit.

**The gap (still there):** After tap, nothing visibly changes during the async chain. App still goes quiet at the exact moment user most needs signal. PR #242 added VoiceOver depth; it did not add a spinner or selected-card dim.

**ActiveView failure path (newly good):** Phase 1 worst-case was tap "End sharing", nothing happens, session lingers, contact keeps receiving location. Closeout: `endResult.ok === false` → Alert with retry-shaped copy → session remains live → user can try again. The fix landed quietly and is the most consequential delta in this critique.

## What's Working

- **Result-channel error handling:** Both `start.run` and `end.run` return `{ ok, error }`-shaped results, both branches alert + early-return on failure. Mirrors the `getErrorMessage('sharing', 'transient', error)` pattern used elsewhere.
- **`accessibilityHint` per card with contact-name interpolation (PR #242):** Phase 1's Sam red-flag closed.
- **`shareState.ready` gating:** Renders `null` while hydrating so the picker no longer flashes for users with an active session.
- **`dismiss()` safety net:** `router.canGoBack()` + `/home` fallback unchanged from Phase 1, still right.
- **`busy` guard:** Still prevents double-starts cleanly.
- **`NotifyingPulse` `onResendSms`:** Re-send affordance thoughtful.
- **Reduce Motion gating:** Handled in `NotifyingPulse` itself.
- **Reason copy:** "I feel uneasy / Something's off, and I could use the visibility" still strongest option in the set.

## Priority Issues

**[P0] No loading feedback after reason tap — CARRIED from Phase 1**
- What: `handlePick` flips `busy = true` but no visual change. Screen sits static during geo + storage + SMS deep-link. 500ms–2s of silence.
- Why it matters: Safety flow under stress. Non-responsive UI reads as failure. User may tap again (blocked silently) or abandon. Phase 2/3 closed the other P0 (`handleEnd` silent failure) and added VoiceOver depth (PR #242), but the sighted loading-feedback gap is still here.
- Fix: Add `loading` prop to `ReasonPicker`, or consume `busy` directly. Either an `ActivityIndicator` centered below the card list, or `opacity: 0.5` on the selected card while busy. The simplest version is opacity-on-pressed-card during the await — same visual register as `pressedDim`, just held.

**[P1] Eyebrow copy fires before session confirmation — CARRIED from Phase 1**
- What: `subtitle` renders `"On it. Sharing your location now."` in `ReasonPicker` BEFORE user taps and BEFORE `startSession` is called.
- Why it matters: False status report. First-timer reads as "the app did something without my input." Violates heuristic #1.
- Fix: `"You choose. We'll tell them."` or `"Pick a reason — we'll send the details."` Reserve completion language for ActiveView.

**[P2] `NotifyingPulse` label in picker still inaccurate — CARRIED from Phase 1**
- What: `label="Choosing a reason opens Messages for ${contactName}"`. Messages does NOT open when a reason is chosen — it opens after `startSession` completes inside the Messages deep-link step.
- Why it matters: Now slightly less load-bearing because the per-card `accessibilityHint` (PR #242) carries the same information accurately for VoiceOver users. Sighted users still read the inaccurate framing. Trust depends on the app doing exactly what it says.
- Fix: `"Tapping a reason will share your location and open Messages for ${contactName}"` — or drop to `NotifyingPulse`'s default label.

**[P2] `borderRadius: 12` inline rather than `radii.md` — CARRIED from Phase 1**
- What: `twoLineRow.borderRadius` is literal `12`, not `radii.md` (= 12 today).
- Why it matters: If `radii.md` shifts in a future pass, this card diverges. Anti-slop miss.
- Fix: Replace with `borderRadius: radii.md`.

**[P3] `aspirationalNote` negative margin + raw-echo copy — CARRIED from Phase 1**
- What: `marginTop: -spacing.sm` on `aspirationalNote` (line 262). Text echoes raw session title verbatim ("Reason: I feel uneasy") in smallest, dimmest token.
- Fix: Replace negative margin with proper `gap` composition. Consider `"Because: {sessionReason}"` framing, or remove the note and let the title carry the meaning.

## Persona Red Flags

**Sam (accessibility):** Largely resolved since Phase 1. Per-card `accessibilityHint` interpolating contact name closes the Phase 1 "VoiceOver users cannot know what tap commits them to" gap. The `accessibilityState={{ disabled }}` during `busy` is correct, but VoiceOver users tapping during busy still get silence about why nothing happens — pairs with the sighted-user P0 above. A single `accessibilityLiveRegion` announcement ("Starting share with {contactName}…") on `busy = true` would close both at once.

**Casey (distracted mobile):** Unchanged. 4-card stack with `gap: spacing.xxl` (48pt) means on iPhone SE inside a page-sheet, the 4th card ("Just in case") may still fall below the fold. `showsVerticalScrollIndicator={false}` still suppresses one native cue. Casey taps three visible cards, doesn't see "Just in case."

**Black driver assessing safety in a charged moment:** The single most consequential closeout change for this persona is the `handleEnd` failure path. Phase 1 worst-case was "I tapped End sharing, it didn't work, my contact keeps getting my location, I have no idea." Closeout: failure surfaces, session stays live, retry is one tap away. The silent loading window during the initial reason tap is now the largest remaining gap for this persona — a small spinner closes it.

## Minor Observations

- `REASONS` array still module-level — appropriate.
- `void resend.run(undefined)` in `onResendSms` callback — correct fire-and-forget shape.
- ActiveView still does not show session start time. Returning user has no "how long has this been live" anchor.
- `DragHandle` still on both views; screen still reachable via deep-link where drag handle is misleading.
- `contactState.ready ? contactState.contact : null` narrowing — clean discriminated union usage.
- `getErrorMessage('sharing', 'transient', startResult.error)` — the `'transient'` disposition is correct for both paths; both are retryable.
- Phantom-chevron placeholder (`backChevronPlaceholder`, height 32) is documented at the style site and keeps title y-position consistent with sibling safety flows. Good craft.

## Questions to Consider

1. Is the silent-busy window acceptable because the Messages app handoff is itself the "something happened" cue? (It isn't — handoff happens after the await, not during.)
2. Could the eyebrow copy fix be deferred no further? It's a one-line change and the highest-leverage non-P0 in the file.
3. Should the picker render at all while `loading` is true under the new `ready` gating, or is the `null` return the final answer?
4. Should ActiveView show session start time / elapsed duration?
5. Is `showsVerticalScrollIndicator={false}` intentional on both views given the SE-class fold concern for Casey?
