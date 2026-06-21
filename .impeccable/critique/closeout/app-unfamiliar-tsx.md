---
target: app/unfamiliar.tsx
phase1_score: 28
phase1_p0: 2
phase1_p1: 2
closeout_score: 32
closeout_p0: 0
closeout_p1: 2
slug: app-unfamiliar-tsx
phase1_source: 2026-06-19T09-38-46Z__app-unfamiliar-tsx.md
---

## Preamble — Phase 1 vs Closeout

**Phase 1 (2026-06-19):** 28/40, 2 P0 + 2 P1. P0s: silent async during destination search (no loading state); error recovery via system Alert breaks composed register. P1s: "I'm safe now" one-tap-ends-session on step 2; no acknowledgment of selected problem on step transition. P2s: ActiveSessionView clinical copy; LifelineModal "can see your current location" overcommits live-location capability.

**Closeout:** 32/40, 0 P0 + 2 P1. PR #244 closes the silent-async P0 cleanly — per-row ActivityIndicator, sibling-dim, accessibilityState.busy, double-tap guard via `loadingDestId !== null` short-circuit. PR #243 closes the LifelineModal honesty P2 (subtitle now reads "has a Messages draft with your location" — capability-honest). PR #242's VoiceOver hints (`accessibilityHint` on problem rows + destination rows) lift heuristic 6 (Recognition) and Sam's accessibility ledger. The Alert-as-error-recovery P0 and the "I'm safe now" / problem-acknowledgment P1s remain open.

**Delta narrative:** Phase 1's most acute trust-break (a frozen UI during 2–5s safety search) is gone — the screen now behaves like a deliberate tool under load rather than a broken one. The honesty gap in LifelineModal (which the Black-driver persona flagged as physical-safety-relevant, not UX polish) is closed. The remaining open items are now the cluster around emotional register and irreversibility — softer than the Phase 1 blockers, still real.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Loading state on destination row now genuine status reveal — spinner replaces icon inline, sibling rows dim to 0.5, accessibilityState.busy announced. ActiveSessionView still shows "Sharing in Unfamiliar area." with no timestamp/pulse-of-activity. +1 vs Phase 1. |
| 2 | Match Between System and World | 4 | Unchanged. Problem clarifiers + destination icons stay strong real-world matches; aspirationalNote on step 2 still factually contingent on Messages-draft flow being live. |
| 3 | User Control and Freedom | 2 | Unchanged. backChevron still left-aligned inside 44pt box (painted glyph ~28pt at container edge); drag handle still cosmetic / unlabeled; ActiveSessionView still has only "I'm safe now" exit. |
| 4 | Consistency and Standards | 3 | Unchanged. `iconRow` `minHeight: 60` vs `twoLineRow` `height: safetyCardHeight` (100). LifelineModal still uses inline radius integers rather than `radii.xl`. |
| 5 | Error Prevention | 2 | Unchanged. "I'm safe now" still one unguarded tap ending session. Loading guard prevents the double-tap class of error but doesn't address irreversible-action class. |
| 6 | Recognition Over Recall | 4 | PR #242 VoiceOver hints make the recognition scaffolding announce its job ("Reports this and starts sharing your location with your trusted contact" / "Routes you there and returns to the map"). Hint depth lands. +1 vs Phase 1. |
| 7 | Flexibility and Efficiency of Use | 2 | Unchanged. No shortcuts, no mid-flow destination change, no last-used memory. |
| 8 | Aesthetic and Minimalist Design | 4 | Unchanged. ActivityIndicator at `colors.freshgreen` swapped in-place into iconCircle — does not break minimalist register, no chrome added. |
| 9 | Help Users Recognize, Diagnose, and Recover | 3 | Loading state now visible, so "silent async" half of the heuristic resolves. Three error paths still route through `Alert.alert` — out-of-sheet system dialog breaks composed register, no in-surface recovery copy. +1 vs Phase 1. |
| 10 | Help and Documentation | 4 | PR #242 accessibilityHint copy doubles as embedded documentation for sighted users via VoiceOver pass; LifelineModal subtitle now factually represents the Messages-draft flow. +1 vs Phase 1. |
| **Total** | | **32/40** | **Good — trust-breaks resolved, emotional-register polish remains** |

## Anti-Patterns Verdict

**Still not AI slop.** Code comments around `loadingDestId` (lines 104–108, 157–160) are precisely the kind of institutional memory healthy codebases keep — they explain WHY the row dims, WHY the cleanup is in `finally`, WHY the cleared-on-replace is harmless. The accessibilityState.busy addition is the small-but-load-bearing detail an unconsidered patch would have skipped. ActivityIndicator inside iconCircle (rather than overlay) reads as a deliberate substitution, not a bolt-on.

Minor slop-adjacent risk unchanged: aspirationalNote on step 2 still packs two reassurances into one footnote-weight line.

## Cognitive Load

| Item | Status | Notes |
|------|--------|-------|
| Choices per screen ≤ 3–5 | Pass | Unchanged. |
| Labels self-explanatory without context | Pass | Unchanged + reinforced by accessibilityHint copy. |
| No simultaneous attention splits | Pass | Unchanged. |
| Progress indication | Fail | Unchanged — still no step indicator. |
| Irreversible actions guarded | Fail | "I'm safe now" still one-tap on step 2. |
| Loading / async states visible | **Pass** | PR #244 closed this. Spinner-in-iconCircle + sibling-dim + busy state. |
| Error recovery in-surface | Fail | All errors still break to system Alert. |
| Emotional register matches moment | Partial | Unchanged. |

Three of four Phase 1 fails persist; one (loading) now passes.

## Emotional Journey

**Step 1 — Problem Picker:** Unchanged from Phase 1 — "Acknowledged, not panicked." Gap on problem-acknowledgment at transition still open.

**Step 2 — Destination Picker:** Materially improved. The previous read on this step was "user taps, screen goes silent for several seconds — reads as broken." Now: tap → tapped row's icon becomes a spinner, sibling rows fade — flow reads as "the app heard you and is working." The wait time itself didn't change, but the felt register did. Aspirational note still emotionally flat. "I'm safe now" still premature.

**Active Session View:** Unchanged. "Sharing in Unfamiliar area." + "Reason: …" still clinical.

## What's Working

**1. Loading-state intervention is small but load-bearing.** The change (one piece of state, one accessibilityState entry, one disabled gate, one inline ActivityIndicator) does what the screen most needed: it converts the worst moment of the flow from "I think it's broken" to "I see it working." This was the trust-break Phase 1 flagged as highest-impact; closing it cleanly is the right kind of intervention — minimum surface area, maximum register shift.

**2. Accessibility deepening.** PR #242's accessibilityHint copy on problem rows ("Reports this and starts sharing…") and destination rows ("Routes you there and returns to the map") tells VoiceOver users not just *what* the control is but *what will happen if they activate it*. accessibilityState `{ disabled, busy }` on destination rows means a screen reader user gets the same "the app is working" signal sighted users now get from the spinner. Sam's persona ledger no longer has a hole here.

**3. LifelineModal honesty restored.** "Your Trusted Contact has a Messages draft with your location. You can call or text them right now." is capability-true. Phase 1's flag was the highest-stakes finding in the rubric (Black-driver persona: "may make decisions based on false premise of continuous oversight"). It's closed.

**4. Code comments around the new state.** Lines 104–108 explain WHY `loadingDestId` exists (the 2–5s cold-start gap and the double-tap risk). Lines 157–160 explain WHY the `finally` clear is safe on `router.replace` and necessary on errors. Future drift on this state will hit prose written by someone who knew what they were guarding.

## Priority Issues

**[P1] Error recovery via system Alert still breaks composed safety register** *(was P0 in Phase 1 — demoted because the silent-async sibling is now closed, but on its own merits this is still P0-shaped)*
- What: All three error paths (location denied, no results, search failed) still fire `Alert.alert`. Native modal drops user out of sheet context.
- Why it matters: With the loading state now reading as "the app is working," the eventual transition into a system-level Alert is sharper — user sees deliberate-feeling UI throughout the working state, then a generic system dialog at the failure boundary. Register break more audible now, not less.
- Fix: In-surface error states below destination list — small footnote-weight, `labelTertiary` — explaining what happened and offering a retry tap on the same row. Keep Alert only for "this device cannot do X" terminal cases.

**[P1] "I'm safe now" on step 2 is one unguarded tap from ending active session**
- Unchanged from Phase 1. Single-step confirmation (`Alert.alert` or on-brand hold-to-end / double-tap) still warranted.

**[P1] No acknowledgment of selected problem during step transition**
- Unchanged from Phase 1. `sessionReason` is available in `useShareSession()` and could feed DestinationPicker's subtitle: "You're being followed. Let's move."

**[P2] ActiveSessionView copy clinically registered**
- Unchanged from Phase 1. "Sharing in Unfamiliar area." + "Reason: {sessionReason}" still reads as label-value, not human voice.

**[P3] backChevron tap-target alignment**
- Unchanged from Phase 1. `alignItems: 'flex-start'` inside 44pt box still violates the painted-glyph rule.

## Persona Red Flags

**Sam (accessibility):** Materially improved. accessibilityHint copy on both problem and destination rows; accessibilityState `{ disabled, busy }` on destination rows announces the loading transition. Outer `pulseFooter` View on ActiveSessionView still lacks a role/label, but is now the only Sam-flag standing on the screen.

**Casey (distracted mobile):** Unchanged — "I'm safe now" still bottom-pinned, may scroll on SE/mini.

**Black driver assessing safety in a charged moment:** The Phase 1 lifeline-modal honesty gap (rated as physical-safety-relevant, not polish) is closed. Closeout posture is materially stronger here. The problem-acknowledgment beat at step transition remains the open gap — "I'm being followed" → "Where do you want to go?" still pivots faster than the moment deserves.

## Minor Observations

- LifelineModal still uses inline radius integers (`borderTopLeftRadius: 20`) rather than `radii.xl`. Unchanged.
- `iconRow` `minHeight: 60` magic number unchanged.
- `handleSafeNow` still `console.warn`-and-silent on `endSession` failure. Unchanged.
- New `loadingDestId` cleanup in `finally` is correct — both error paths and the (no-op-on-unmount) replace path land safely.
- `anyLoading && !isLoading && { opacity: 0.5 }` style merge is inline rather than a named token — small consistency nit if sibling-dim becomes a pattern elsewhere.

## Questions to Consider

1. Should the Alert-based error states become the next P0? They were P0 in Phase 1; on closeout, with the loading state closed, they're the loudest remaining register-break — and on their own merits, still P0-shaped.
2. Is "hold to confirm" the right pattern for "I'm safe now" given the project's broader irreversible-action posture? Worth a cross-screen decision rather than per-screen.
3. ActiveSessionView "Sharing in Unfamiliar area." — is the title meant to be parseable-by-screenshot (status-log register) for a contact who later asks "where were you?" or is it the user-facing in-the-moment surface? If both, two different copies may be warranted.
