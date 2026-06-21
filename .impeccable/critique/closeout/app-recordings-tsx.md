---
target: app/recordings.tsx
phase1_score: 27
phase1_p0: 2
phase1_p1: 2
closeout_score: 33
closeout_p0: 0
closeout_p1: 2
delta: Both Phase 1 P0s genuinely closed — per-row Share via iOS Share Sheet shipped, single-row delete now routed through a dual-mode ConfirmRequest Modal that reuses the bulk-delete pattern. Screen moved from "archive with no exit" to legitimate safety tool; residual gaps now sit at playback-affordance and surface-framing depth, not at evidence-egress.
---

## Closeout Preamble

**Phase 1 (2026-06-19):** 27/40 · 2 P0 · 2 P1
- P0: No share/export path
- P0: Single-row delete had no confirmation
- P1: No playback progress indicator
- P1: Error state offers no retry

**Closeout (2026-06-20):** 33/40 · 0 P0 · 2 P1
- P0s: both resolved
- P1: No playback progress indicator (carry-over — `useAudioPlayerStatus` exposes position/duration but they're still not surfaced)
- P1: Error state still offers no retry affordance (carry-over — `useRecordings` does not expose a reload)
- New P2: Three icon-only affordances now stack on the right edge of each card (Share, Trash, plus the play button on the left) — density pushed up, ambiguity of label-free Share next to label-free Trash adds a fat-finger risk the screen didn't have before
- New P2: Share button uses `colors.labelTertiary` — same color weight as Trash, so the two right-edge affordances read as a pair rather than as a primary-export vs. destructive-delete contrast

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Unchanged from Phase 1 — playback progress still not surfaced; active-state border still the only signal |
| 2 | Match Between System and Real World | 3 | Unchanged — "Armed/Unarmed/Undisclosed" honest, `formatDuration` still bare `0:12` |
| 3 | User Control and Freedom | 4 | Single-row delete now confirmed via dual-mode Modal naming the recording by date; dismissal patterns (tap-scrim, X, Reduce Motion gating) carry across both modes |
| 4 | Consistency and Standards | 3 | Confirm modal reuse is the consistency win; Share + Trash both at 24pt `labelTertiary` introduces a new color-coupling issue (see P2) |
| 5 | Error Prevention | 4 | Single-row delete confirmation closes the Phase 1 hole; copy ("Delete this recording from June 14 · 3:42 PM?") names the artifact, which is stronger than the bulk-delete dialog's generic phrasing |
| 6 | Recognition Rather Than Recall | 3 | Unchanged — still no recording name, no route/location, no thumbnail |
| 7 | Flexibility and Efficiency of Use | 4 | Per-row Share via `Sharing.shareAsync` with `dialogTitle: 'Recording from <timestamp>'` is exactly the right surface; passes recording to iOS Share Sheet without intermediate state. Still no swipe gestures, but Share alone moves this from 2 → 4 |
| 8 | Aesthetic and Minimalist Design | 3 | Phase 1 was 4; closeout drops to 3 because the card now carries four icon affordances (play, text-stack-as-tap-target via accessible wrap, share, trash) and the right edge crowds. Card is still clean but no longer sparse |
| 9 | Help Users Recognize, Diagnose, Recover | 2 | Unchanged — `SafetyErrorMessage` still offers no retry button at the screen level; per-row playback error inline is correct but list-load error stays a dead end |
| 10 | Help and Documentation | 2 | Unchanged — no contextual framing once recordings exist, no pointer to "what should I do with these" beyond the now-present Share button |
| **Total** | | **33/40** | **Strong — both P0s closed, gaps now at polish + framing depth** |

## Anti-Patterns Verdict

**Still not AI slop.** PR #245's additions read as the same hand: the `ConfirmRequest` discriminated union (`'all'` | `'single'` | `null`) is a deliberate data-model decision that lets the same Modal carry two confirmation flows without duplicate JSX. The comment on line 50-52 ("Discriminated request for the destructive-confirm Modal") is engineering rationale, not commentary-as-filler. `dialogTitle` and `mimeType: 'audio/m4a'` passed to `Sharing.shareAsync` show the author thought about how the share sheet presents the artifact rather than firing the default sheet.

The Phase 1 slop tell (`relaxedLineHeight` imported unused) **persists** at line 30. Phase 1 P3; still present.

Light new tell: `handleShare` body is generic try/catch with `Alert.alert(title, body)` — same pattern as the delete-all error path. Consistent, but the Alert escape route reads as "the modal pattern was too heavy to extend to error reporting too" rather than a deliberate choice between Modal and Alert per disposition.

## Cognitive Load

1. **Decisions per view:** Now play/pause, share, delete-row, delete-all. Four decisions per card vs. Phase 1's two. **Borderline pass.**
2. **Visual hierarchy clarity:** Title > timestamp > meta still clean. **Pass.**
3. **Action labeling ambiguity:** Now *three* unlabeled icons per card (play, share, trash) instead of two. Share and Trash both render at 24pt `labelTertiary` — the two right-edge affordances are visually a pair. User scanning sees "two gray icons on the right" before they parse which is which. **Regressed from partial fail to fail.**
4. **State change visibility:** Unchanged from Phase 1. Still partial fail.
5. **Error recovery path:** Unchanged. Still fail.
6. **Destructive action friction:** Single-row delete now gated. **Full pass.**
7. **Information density per card:** Now denser — three right-side affordances + play button + text stack. **Borderline.**
8. **Modal interrupt coherence:** Dual-mode Modal still coherent; the `confirm?.mode === 'single'` ternaries are readable. **Pass.**

The cognitive-load delta is honest: closing the P0 export path bought one new partial-fail in icon-label ambiguity. Net positive but not free.

## Emotional Journey

**Arrival → list scan → playback:** unchanged from Phase 1.

**The export moment:** This is where the closeout earns its score. User who realizes they want to send this to a lawyer or family member now sees the Share icon mid-row, taps it, gets the iOS Share Sheet with a recording titled "Recording from June 14 · 3:42 PM," and can route it to Messages, Mail, AirDrop, Files, Signal, or any installed app. The single largest emotional gap Phase 1 identified is **closed**. Screen has gone from dead-end-with-evidence to functional safety tool.

**The new ambiguity:** User in elevated state, looking at three icons (play-green-left, share-gray-right, trash-gray-right), needs one extra parse-cycle to know which gray-icon-on-the-right is "send" and which is "destroy permanently." In a calm-state walkthrough this is trivial. In the post-stop emotional state the screen is designed for, an icon-disambiguation cycle next to a destructive action is real cost. The confirmation modal on the trash action absorbs the risk — fat-finger on Trash now requires a second deliberate confirm — but the visual coupling of Share and Trash via shared color is the new emotional snag.

**Delete state:** New single-row delete dialog names the artifact ("Delete this recording from June 14 · 3:42 PM?"). Stronger than the bulk-delete dialog's generic "Are you sure" phrasing. Inline-bold `cannot` carries over.

## What's Working

**1. Dual-mode Modal via discriminated union.** `ConfirmRequest` as `{ mode: 'all' } | { mode: 'single', id, createdAt } | null` is the right shape. Single `handleConfirmDelete` branches on `confirm.mode` instead of two parallel modal components. CTA copy adapts (`'Yes, delete'` vs `"Yes, I'm sure"`), `accessibilityLabel` and `accessibilityHint` adapt, loading state only attaches to the `'all'` branch (correct — single-row delete is a single AsyncStorage write, not 50 parallel ones; the latch protection isn't needed). This is the cleanest possible resolution of Phase 1's asymmetry observation.

**2. iOS Share Sheet integration with named artifact.** `Sharing.shareAsync(uri, { dialogTitle: 'Recording from <timestamp>', mimeType: 'audio/m4a' })` is the minimal-correct integration. `mimeType` lets receiving apps file the audio correctly (Messages shows it as a voice memo; Mail attaches as audio/m4a). `dialogTitle` lets the user see what they're about to share before they pick the destination.

**3. Single-row delete dialog naming the recording.** "Delete this recording from June 14 · 3:42 PM?" is honest, specific, and disambiguates from bulk delete. Beats the generic-question pattern. The dialog title for single-mode carries more information than the bulk-mode title.

**4. Inline playback-error pattern preserved.** Per-row `playbackErrorId` + `SafetyErrorMessage` mid-list still correct. PR #245's Share addition didn't disturb the existing error surfacing rhythm.

## Priority Issues

**[P1] No playback progress indicator** *(carry-over from Phase 1)*
- What: When a recording plays, only signal is card's green border and Pause icon in the play button. No progress bar, elapsed time, remaining time.
- Why it matters: 15-minute recording from a traffic stop has no way to verify content without listening through. `useAudioPlayerStatus` already exposes position data — the data is acquired, just not rendered.
- Fix: Thin progress bar below `cardTextStack` when `isActive`, driven by `status.currentTime / status.duration` (or `positionMillis / recording.durationMs`). Alternative: elapsed counter in `cardSecondary` row while playing.

**[P1] Error state offers no retry affordance** *(carry-over from Phase 1)*
- What: `SafetyErrorMessage` for the list-load case still renders copy with no action. `useRecordings` does not expose a `reload`.
- Why it matters: Post-traffic-stop user wanting to confirm recording survived sees a blank error with no action.
- Fix: Add `reload` to `useRecordings`, pass an `onRetry` to `SafetyErrorMessage` for the `state.ok === false` branch.

**[P2] Share + Trash share color weight, creating a destructive-vs-export ambiguity** *(new)*
- What: `Share` icon at `colors.labelTertiary` and `Trash` icon at `colors.labelTertiary` sit adjacent on the right edge. Identical 24pt size, identical color, identical tap target. Visually, they are a pair of gray icons.
- Why it matters: Share is the primary safety affordance this PR introduced; Trash is the destructive affordance. Coupling them via color reads as "two equivalent secondary actions" rather than "one primary egress + one guarded destructive." For Casey distracted-mobile, the icon shapes (paper-plane vs. trash-can) are the only disambiguation cue. The confirm dialog absorbs the consequence of mistakenly tapping Trash, but the visual coupling still costs a parse cycle.
- Fix: Move Share to a more affirmative color weight — `colors.labelSecondary` or even `colors.freshgreen` (Share is the affordance the safety thesis is built around — earning saturated color is defensible). Keep Trash at `labelTertiary`. The color delta makes the right edge legible at a glance.

**[P2] Card right edge is now dense — three affordances + text stack on iPhone SE width** *(new)*
- What: At iPhone SE (320pt logical width), `spacing.lg` × 2 = 32 page padding, minus play button (56), minus two `tapTarget44` zones for Share and Trash (88), leaves ~144pt for `cardTextStack` between play and the share/trash pair. Timestamp `"May 28 · 3:42 PM"` at `bodyEmphasized` Dynamic Type, plus `"Armed · 12:42"` at `subheadlineRegular`, will get close to the edge at AX1+ Dynamic Type sizes.
- Why it matters: The text stack is the recognition layer (per heuristic 6). Squeezing it for two icon affordances at the largest Dynamic Type tier risks truncation of "May 28 · 3:42 PM" → "May 28 · 3:42…" — which destroys the disambiguation the timestamp exists to provide.
- Fix: Test at AX5 Dynamic Type on iPhone SE. If timestamp truncates, consider collapsing Share + Trash into an overflow menu (`DotsThree` icon → action sheet with "Share" and "Delete") at the largest Dynamic Type tiers, or accept that the right-edge stack wraps below the text stack.

**[P2] `cardBorderSubtle` (rgba(0,0,0,0.3)) too heavy** *(carry-over from Phase 1 P2)*
- Unchanged.

**[P2] No contextual framing once recordings exist** *(carry-over from Phase 1 P2)*
- Unchanged. The Share affordance partially addresses "what do I do with these" but doesn't substitute for screen-level orientation copy.

**[P3] `relaxedLineHeight` imported but unused** *(carry-over from Phase 1 P3)*
- Line 30. Still imported, still unused. Trivial removal.

**[P3] `handleShare` error path uses Alert rather than the existing Modal pattern** *(new, observational)*
- What: Share failures route through `Alert.alert(title, body)`. The screen otherwise carries a custom Modal pattern. Inconsistent.
- Why it matters: Low — Share failures are rare and the Alert is acceptable. Worth flagging as "the Modal pattern could have extended here" rather than "this is broken."
- Fix: Optional. Either accept the Alert as the right tool for transient share errors (probably correct), or extend the Modal to a tri-mode `'all' | 'single' | 'share-error'` (probably overkill).

**[P3] `confirmBodyEmphasis` still spreads `typography.bodyEmphasized` without `dynamicType()`** *(carry-over from Phase 1 minor observation)*
- At large Dynamic Type sizes the parent `confirmBody` scales but the emphasis run does not. Same observation as Phase 1, still present.

## Persona Red Flags

**Sam (accessibility):**
Share button has `accessibilityLabel="Share recording from <timestamp>"` — correct. Single-row delete now gets `accessibilityHint="Permanently deletes this recording"` on the confirm CTA. `accessibilityHint` passthrough on `Button` (per PR #245) is consumed correctly. Carry-over from Phase 1: play button still has no `accessibilityHint`; active-playback state still announced via `accessibilityState={{ selected: isActive }}` (semantically `busy` would be stronger). The new Share affordance ships **without** an `accessibilityHint`, consistent with the play button's gap.

**Casey (distracted mobile):**
Right edge now carries two `tapTarget44` zones adjacent (Share + Trash). Casey is the persona most affected by the new icon-disambiguation cost. The confirm dialog on Trash mitigates fat-finger consequence, but the screen has gone from "one destructive icon to avoid" to "one export + one destructive to disambiguate."

**Black driver assessing safety in a charged moment:**
The Phase 1 critical failure is **closed**. Driver can share recording to family member via Messages, lawyer via Mail, civil rights org via any installed app, or save to Files for off-device backup — all in one tap from the list row. iOS Share Sheet's destination-picking is familiar OS chrome at a high-stakes moment, which is the right register. The screen now operates as the safety tool the thesis claims. Residual gap: still no in-screen orientation copy explaining that recordings stay on-device until shared, which matters for the privacy-concerned subset of this persona who might assume cloud sync.

## Minor Observations

- `formatDuration` accessibility-label carry-over from Phase 1 still applies; now applies to Share button's announced label as well (`Sam` hears "Share recording from June 14 · 3:42 PM" — no duration, no armed status, which is appropriate scope for the action label but means Share has less context than the text-stack focus stop just before it).
- Microphone duotone icon at `colors.black` carry-over from Phase 1.
- Title-row Microphone icon also used at 56pt `colors.freshgreen` `weight="duotone"` in the empty state — duotone with non-black single color may render with the intended tonal split. Worth verifying the empty-state icon renders as expected (likely it does — `freshgreen` is not black so duotone has chroma to work with).
- The bulk-delete `Promise.all(...)` over `state.recordings` carry-over from Phase 1 — now routes through `state.remove.run(id)` (the typed result envelope) and aggregates failures via `results.some((r) => !r.ok)`. The error-aggregation pattern is stronger than Phase 1's bare promise; the parallel-write storage concern carries over but the failure semantics improved.
- `handleShare` does not pause active playback. If a user taps Share while a recording is playing, the iOS Share Sheet appears over the playing audio. Probably fine (the audio is the artifact being shared, so it's contextual) but worth a deliberate decision.

## Questions to Consider

1. The Phase 1 export-path question is answered (expo-sharing + iOS Share Sheet). Is the implicit answer to "what about a server-upload safety mirror" now "no, share-via-OS is the safety tool"? Worth recording in `docs/learnings.md` as a thesis decision, not just a PR note.
2. Share button color: stay at `labelTertiary` (current — couples with Trash, low visual weight) or step up to a more affirmative color tier (decouples from Trash, signals "this is the primary egress")?
3. Sharing a recording to Messages or AirDrop creates a copy the user no longer controls. Should the share path show a one-time "Shared recordings leave your device — recipients can keep their copy" notice? Privacy-thesis question more than UX question.
4. Does the new dual-mode confirm copy ("Delete this recording from June 14 · 3:42 PM?") need a route/location field if Phase 1's Heuristic 6 recognition gap is addressed in a future PR? Naming the artifact better in the confirm would compound recognition gains.
5. Phase 1 Q3 (recordings screen reachable during active safety flow) and Q4 (retention policy) — unchanged, still open.
