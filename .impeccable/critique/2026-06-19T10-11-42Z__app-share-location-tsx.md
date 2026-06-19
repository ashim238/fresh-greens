---
target: app/share-location.tsx
total_score: 33
p0_count: 2
p1_count: 1
timestamp: 2026-06-19T10-11-42Z
slug: app-share-location-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | `busy` blocks re-picks but no loading indicator exists; user stares at unchanged UI after tapping card |
| 2 | Match System / Real World | 4 | Copy human-scale and honest; "On it. Sharing your location now." fires before session confirms — slight over-promise |
| 3 | User Control and Freedom | 3 | ActiveView "End sharing" only control; no in-screen back/dismiss affordance |
| 4 | Consistency and Standards | 4 | Card register matches `/pulled-over`; `borderRadius: 12` inline rather than `radii.md` — minor token drift |
| 5 | Error Prevention | 3 | `startSession` failure caught but silently logged; user gets no feedback that session failed and SMS not sent |
| 6 | Recognition Rather Than Recall | 4 | Four labeled reasons with clarifiers cover space well; "Heading somewhere new" slightly overlaps with "Just in case" edge cases |
| 7 | Flexibility and Efficiency | 3 | `NotifyingPulse` label inaccurate ("Choosing a reason opens Messages") — Messages opens on session start, not on reason pick |
| 8 | Aesthetic and Minimalist Design | 4 | Calm and on-brand; gap between cards `spacing.xxl` (48pt) aggressive — can push 4th card off-screen on SE-class devices |
| 9 | Error Recovery | 2 | `handleEnd` failure is `console.warn` only — session reference remains in storage but UI dismissed; user has no path to retry ending session |
| 10 | Help and Documentation | 3 | `NotifyingPulse` only education about what happens next; does not exist in non-interactive (picker) variant with enough clarity that first-timer understands SMS side-effect before committing |
| **Total** | | **33/40** | **Good — targeted polish** |

## Anti-Patterns Verdict

**PASS with two flags:**
1. `borderRadius: 12` written inline (line 271) rather than `radii.md`. Radii token exists; clean anti-slop miss.
2. `marginTop: -spacing.sm` on `aspirationalNote` (line 252) is spacing-ramp negative offset applied as magic correction rather than proper gap composition.

No reserved-color violations. No inline hex colors. No inline font sizes. Typography tokens consumed correctly. `dynamicType()` applied throughout.

## Cognitive Load

**Low on happy path, higher than needed on entry and failure.**

Picker structurally simple: four cards, one tap, done. User arrives cold with no explicit header explaining what this screen IS — `"On it. Sharing your location now."` fires before any action (reads as status report, not invitation), while `"What's the situation?"` is actual prompt. Inverted order (status eyebrow → question title) creates beat of confusion.

`loading` state (`busy = true`) introduces silent wait: UI freezes with no spinner, no feedback. In safety flow, frozen UI under stress is corrosive — reads as broken.

ActiveView low-load but thin: "Reason: {sessionReason}" on `aspirationalNote` is raw-echo copy showing stored string verbatim. Easy to miss and does little work.

## Emotional Journey

**Entry:** User already in heightened state. Arriving at sheet with `"On it. Sharing your location now."` before picking anything creates jarring moment of "wait, did it already go?" Emotional beat should be grounding, not startling.

**Picking a reason:** Once user reads title, card register calming and legible. `pressedDim` feedback correct. Four reasons cover emotional range (routine → heightened anxiety) without being alarmist.

**The gap:** After tap, nothing visibly changes during `await startSession()` call. For user who just tapped "I feel uneasy" and is waiting to confirm trusted contact will know — this silence is worst possible UX beat. **App goes quiet at exact moment user most needs signal that something is happening.**

**ActiveView:** "Already on it." good grounding phrase. "End sharing" button appropriately large and unambiguous. But nothing tells user WHEN session started, WHO was notified, or WHETHER SMS actually went through.

## What's Working

- **Card register:** `twoLineRow` pattern (title + clarifier, 100pt fixed height, `shadows.e1`) calm, generous, consistent with `/pulled-over`.
- **Reason copy:** "I feel uneasy / Something's off, and I could use the visibility" strongest option — honest, non-alarmist, dignified.
- **`dismiss()` safety net:** `router.canGoBack()` check with `/home` fallback exactly right.
- **`busy` guard:** Prevents double-starts cleanly.
- **`NotifyingPulse` with `onResendSms`:** Re-send affordance thoughtful.
- **Reduce Motion gating:** Handled in `NotifyingPulse` itself.
- **Accessibility labeling:** `${r.title}. ${r.clarifier}` combined label for VoiceOver correct.

## Priority Issues

**[P0] No loading feedback after reason tap**
- What: After `handlePick` calls `startSession`, `busy` flips to `true` but no visual change occurs. Screen sits static during async operation (geo lookup + storage write + SMS deep-link open). Duration variable but can be 500ms-2s.
- Why it matters: Safety flow triggered by heightened alertness. Non-responsive UI in stressed state reads as failure. User may tap again (blocked silently), or abandon.
- Fix: Add `loading` prop to `ReasonPicker`, or consume `busy` state directly. Show small `ActivityIndicator` centered below card list, or add `opacity: 0.5` to selected card while busy.

**[P0] `handleEnd` failure silent — session stuck in corrupted half-state**
- What: If `endSession()` throws, session ref in storage remains, but `dismiss()` never fires. User left on `ActiveView` with no feedback and no retry path — "End sharing" button appears tappable but does nothing.
- Why it matters: End-sharing is user asserting safety moment is over. Silently failing to clear it means session persists invisibly and contact may keep receiving location context user thought they had closed.
- Fix: Set local `endError` state on catch and render inline error message + retry affordance below "End sharing" button.

**[P1] Eyebrow copy fires before session confirmation — "On it. Sharing your location now." premature**
- What: `subtitle` renders `"On it. Sharing your location now."` in `ReasonPicker` view — BEFORE user has tapped anything and BEFORE `startSession` called.
- Why it matters: Creates false status report. First-timer reads as "the app already did something without my input." Violates heuristic #1 and could erode trust in brand's promise of composure-over-alarm.
- Fix: Change picker subtitle to frame next step rather than announcing completion: `"You choose. We'll tell them."` or `"Pick a reason — we'll send the details."` Reserve confirmation language for `ActiveView`.

**[P2] `NotifyingPulse` label in picker inaccurate about timing**
- What: `label="Choosing a reason opens Messages for {contactName}"` — but Messages does NOT open when reason chosen. Opens after `startSession` completes.
- Why it matters: User trust depends on app doing exactly what it says. Technically false label misframes user expectation.
- Fix: `"Tapping a reason will share your location and open Messages for {contactName}"` — or use default label from `NotifyingPulse`.

**[P2] `borderRadius: 12` inline rather than `radii.md`**
- What: `twoLineRow.borderRadius` is literal value `12`, not `radii.md` (equals 12).
- Why it matters: If `radii.md` changes in future design pass, this card will diverge. Violates "no hardcoded design values" rule.
- Fix: Replace `borderRadius: 12` with `borderRadius: radii.md`.

**[P2] `loading` state from `useShareSession` not consumed**
- What: `useShareSession` returns `loading` boolean that is `true` until stored session is read from storage on focus. Screen ignores it.
- Why it matters: User who already has active session will see picker flash briefly before ActiveView appears. In safety context, seeing picker when you expect session status view creates momentary confusion.
- Fix: Destructure `loading` from `useShareSession()`. Render lightweight placeholder while `loading` is `true`.

**[P3] `aspirationalNote` negative margin and raw-echo copy**
- What: `marginTop: -spacing.sm` on `aspirationalNote` is tuning hack. Text echoes raw session reason string verbatim in smallest, dimmest token.
- Fix: Replace negative margin with proper `gap` composition. Consider `"Because: {sessionReason}"` or remove note.

## Persona Red Flags

**Sam (accessibility):**
`twoLineRow` Pressable has correct `accessibilityRole="button"` and combined label. However, when `disabled={true}` during `busy` state, `accessibilityState={{ disabled }}` correctly conveys state — but no announcement that anything is happening. VoiceOver users who tap during busy state get silence. `accessibilityHint` on each card explaining side-effect missing — VoiceOver users cannot know what tap commits them to.

**Casey (distracted mobile):**
4-card stack with `gap: spacing.xxl` (48pt between cards) means on iPhone SE, fourth card ("Just in case") may fall at or below fold inside page-sheet, with no scroll affordance indicated. `showsVerticalScrollIndicator={false}` suppresses one native cue. Casey taps three visible cards, doesn't see "Just in case."

**Black driver assessing safety in a charged moment:**
"I feel uneasy / Something's off, and I could use the visibility" card is one this persona most likely needs. Real concern: silent failure mode — they tap card, see nothing happen for 1-2 seconds during async chain, and in stressed state interpret silence as system failure or — worse — as confirmation that app has already done something. Absence of loading feedback at exactly moment of highest emotional need is most consequential issue.

## Minor Observations

- `REASONS` array module-level constant — appropriate, 4-item shape doesn't need memo treatment.
- `void resendSessionSms()` in `onPress` prop is correct pattern for fire-and-forget in JSX.
- `ActiveView` does not show start time of session. User returning after 20 minutes has no indication how long they have been sharing.
- `DragHandle` present on both views but screen can be reached via deep-link where drag handle is misleading affordance.
- `useTrustedContact()` called but only `contact` destructured.

## Questions to Consider

1. Should picker render at all while `loading` is true?
2. Is "On it. Sharing your location now." intended as anticipatory or completion copy?
3. What is error contract for `startSession` on `/unfamiliar` flow?
4. Should ActiveView show session start time?
5. Is `showsVerticalScrollIndicator={false}` intentional on both views?
