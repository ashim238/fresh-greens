---
target: app/roadside.tsx
phase1_score: 26
phase1_p0: 1
phase1_p1: 3
closeout_score: 30
closeout_p0: 0
closeout_p1: 2
slug: app-roadside-tsx
---

## Phase 1 → Closeout Delta

Phase 1 (26/40, 1 P0, 3 P1) → Closeout (30/40, 0 P0, 2 P1). The Step 3 dismissal trap (P0-3) is closed by an X affordance at top-right that routes back to Step 2 via a non-committing handler, and the "You're in Locating…" headline edge case is guarded; the "What you shared" register, sectionLabel weight, and WrongSpotModal cancel-path issues persist unchanged.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | "Locating…" chip remains the only progress signal; geocode failure still falls to "Your location" silently. Unchanged from Phase 1. |
| 2 | Match System / Real World | 3 | Three-step model still strong; "What you shared" past-tense label still mismatches the live moment. Unchanged. |
| 3 | User Control and Freedom | 4 | Step 3 now exposes a top-right X that routes back to Step 2 via `onBackToActions` without committing state. Phase 1 P0-3 is closed. `usePreventRemove` still blocks gesture/swipe but the X is a visible, labeled escape. +2. |
| 4 | Consistency and Standards | 3 | Row pattern still consistent; sectionLabel still indistinguishable from supporting metadata. Unchanged. |
| 5 | Error Prevention | 2 | "I figured it out" still fires `router.back()` with no confirmation; WrongSpotModal still has no in-card Cancel. Unchanged. |
| 6 | Recognition Rather Than Recall | 4 | Problem picker now carries `accessibilityHint` ("Selects this problem and shows roadside actions") and tow row has a navigation-intent hint. Recognition layer for non-sighted users is now load-bearing rather than incidental. +1. |
| 7 | Flexibility and Efficiency | 2 | No fast path for repeat callers; Step 1 still mandatory. Unchanged. |
| 8 | Aesthetic and Minimalist Design | 3 | Lean rows preserved; sharedCard bullet-concat still reads receipt-like. Unchanged. |
| 9 | Error Recovery | 2 | WrongSpotModal still leaves the user with an error string and no recovery suggestion; call-path failure still dead-end Alert. Unchanged. |
| 10 | Help and Documentation | 3 | "Set up your roadside service" mid-distress still unreframed. Unchanged. |
| **Total** | | **30/40** | **Good (28-31)** |

## Anti-Patterns Verdict

No AI slop. Phase 1's borderline case — the bullet-concatenated sharedCard body — is unchanged at line 539 and still does not trigger the slop verdict. No new slop introduced by the X chrome (clean Phosphor glyph, labelSecondary, sits in its own right-aligned row container rather than overlaying a card).

## Cognitive Load

| Item | Pass/Fail | Notes |
|------|-----------|-------|
| Single focus per step | Pass | Each step still anchored on one question or status. |
| Chunking ≤4 per group | Fail | Step 1 still presents 5 problem options. Unchanged. |
| Meaningful grouping | Pass | Problem list / action list / status card cleanly separated. |
| Visual hierarchy | Fail | `sectionLabel` ("If this gets worse") still at `footnoteRegular` 13pt in `labelSecondary`. Unchanged. |
| One-thing-at-a-time | Pass | Modal still enforces one sub-flow per step. |
| ≤4 options per decision | Fail | Step 1 still 5; Step 2 still 3 action rows + escape CTA. Unchanged. |
| Working memory relief | Pass | Step 2 headline still rebuilds context. Now defended against the "Locating…" race via `locationLabel ?? 'Your location'` at the boundary (line 184). |
| Progressive disclosure | Pass | Trusted-contact share row still appears only when configured. |

**Failures: 3 — Moderate cognitive load.** Same count as Phase 1; structural ceiling on this screen unchanged.

## Emotional Journey

**Peak moment:** The "Got it." + location-anchored headline on Step 2 remains the strongest beat — and the headline race is now closed: a user advancing before geocode resolves reads "You're in Your location with a flat tire" rather than the previously possible "You're in Locating… with a flat tire." Still a soft outcome but no longer an obviously broken one.

**Valley:** "What you shared" card on Step 3, unchanged. Title is still past tense, body still bullet-joined ("Flat tire • Park Slope, Brooklyn • Messages opened for Alex at 3:14 PM"). Receipt register at a live moment.

**Reassurance at charged moments:** The new X affordance is a quiet but real reassurance win. A user who reached Step 3 by accident — or simply wants to step back to action choices — now has a visible escape that costs nothing. The Phase 1 valley-within-the-valley (locked-in, two-CTA cul-de-sac) is gone. The remaining gap from Phase 1 — no acknowledgment of stress before the problem picker — is unchanged.

## What's Working

**1. The X-to-Step-2 path is the right shape of fix for P0-3.** `statusTopChrome` puts the X in a right-aligned row above the subtitle, `tapTarget44` ensures the 44pt floor, and `onBackToActions` is explicitly non-committing — the inline comment ties the implementation back to the Phase 1 audit ("Per Phase 1 P0-3: Step 3 was a trap…"). The fix preserves `usePreventRemove` for swipe-dismiss while giving the visible escape that was missing. This is the audit-loop working as intended.

**2. The headline guard (line 184) closes the geocode-race gap.** `locationLabel ?? 'Your location'` is now applied at the ActionMenu prop boundary rather than relying on the picker label being non-null. The Phase 1 "Questions to Consider" item ("buildActionHeadline produces 'You're in Locating…'") was a real bug; this fix is small but load-bearing.

**3. The VoiceOver hint additions on the problem picker and tow row are exactly the right hints, not generic ones.** "Selects this problem and shows roadside actions" tells a non-sighted user the row's outcome, not just its label. "Opens Apple Maps to find tow services near you" names both the destination app and the search intent — non-sighted parity with the sighted user's mental model. Sets a depth bar for the rest of the screen.

## Priority Issues

**[P1] "What you shared" card uses wrong register for a live moment**
- What: Line 538-539 unchanged from Phase 1 — title "What you shared" (past tense), body joins problem/location/messaging-event with " • ".
- Why it matters: The Phase 1 reasoning still holds. At a charged moment, "What you shared" reads as closed summary; the bullet-join buries the most reassuring fact ("Messages opened for Alex at 3:14 PM") as the third item.
- Fix: Rename to "Right now" or "Active" with present-tense body. Break facts into a vertical list with distinct labels ("Problem / Location / Notified").

**[P1] "If this gets worse" sectionLabel has insufficient visual weight**
- What: Style at lines 882-886 unchanged — `footnoteRegular` at 13pt in `labelSecondary`, same level as the location chip label.
- Why it matters: The Pulled-over escalation row is still the most consequential affordance on Step 3 and the section divider still doesn't read as one.
- Fix: Elevate to `subheadlineEmphasized` (600 weight, 15pt) in `black`. Add `spacing.lg` top margin above it.

**[P2] WrongSpotModal still has no in-card cancel path**
- What: Lines 634-639 unchanged — scrim Pressable is `accessible={false}` and `accessibilityElementsHidden`. No Cancel button inside `modalCard`. Demoted from P1 → P2 because the screen-level dismissal trap (the Phase 1 P0) is now closed, lowering the systemic severity; the WCAG concern for the modal itself remains real but is one-modal-scoped rather than route-scoped.
- Why it matters: VoiceOver user still trapped in the modal with only Confirm. WCAG 2.1 SC 2.1.2 still implicated for the modal.
- Fix: Add a visible "Cancel" button to `modalCard` (text link, `minHeight: 44`, `alignSelf: 'center'`, `color: colors.labelSecondary`).

**[P2] "I figured it out" still fires with no confirmation**
- What: `onFiguredOut` still calls `router.back()` directly (line 208).
- Why it matters: Unchanged from Phase 1 — one-handed high-stress = accidental taps, accidental dismissal means reopening from scratch.
- Fix: Add brief "You're sure?" Alert, or stronger spatial separation from the row stack above.

**[P2] No-roadsideProfile state is still a mid-distress setup redirect**
- What: Line 332-334 unchanged. `roadsideProfile` absence still pushes `/roadside-setup` on tap; label becomes "Set up your roadside service."
- Why it matters: Unchanged from Phase 1.
- Fix: Show un-configured call row as secondary-state variant with explicit "Add your roadside number first →" treatment so the user can skip to other actions without leaving the sheet.

## Persona Red Flags

**Sam (accessibility):**
- WrongSpotModal still a VoiceOver trap (see P2 above) — but the screen-level trap (Phase 1 P0) is now closed.
- `accessibilityRole="link"` on "Wrong spot?" Pressable (line 292) still incorrect — should be `"button"`. Unchanged.
- `accessibilityRole="switch"` on share-location `View` (line 434) still shadows the inner Switch's accessibility node. Unchanged.
- `iconCircle` (36×36) still doesn't scale with Dynamic Type. Unchanged.
- New X affordance has `accessibilityLabel="Back to actions"` (line 526) which is the right label for what it does — non-sighted parity with the sighted "escape hatch" reading.

**Casey (distracted mobile):**
- `backChevron` still left-anchored within 44pt container (line 856). Unchanged.
- Share-location Switch still below 44pt floor in its painted area. Unchanged.
- "I figured it out" still at bottom of sheet near thumb resting position. Unchanged.
- New X is top-right, 24pt glyph in a 44pt tap area — comfortably out of thumb-misfire territory.

**Black driver assessing safety in a charged moment:**
- "If this gets worse" framing on Step 3 unchanged; still the first ambient-risk word on the screen.
- "Visible reasoning" gap on Step 3 still applies — "Help is on the way" without confirming what was actually placed/sent.
- "Switch to Pulled-over mode" row still has no subtitle. Unchanged.

## Minor Observations

- `accessibilityRole="text"` on locationChip View (line 282) still not a valid role for View on older iOS. Unchanged.
- `modalTitle` still uses `bodyEmphasized` for a question prompt (line 816-819) — violates Held-Question Rule. Unchanged.
- 5-item problem list with `gap: spacing.lg` (24pt) still creates significant vertical stretch on SE. Unchanged.
- `marginTop: spacing.sm` on Step 3 subtitle (line 532) still the one deviation from Step 1/2 pattern; the new X chrome above it makes the asymmetry harder to read as intentional.
- `wrongSpot` text (line 787-791) still labelSecondary underline at 13pt — lowest-visibility affordance on the screen. Unchanged.
- `statusTopChrome` (new, line 690-695) uses `flexDirection: 'row'` + `justifyContent: 'flex-end'` — clean, but the container has no explicit `paddingHorizontal`, leaning on `stepBody`'s `spacing.lg` parent padding. Works but couples the chrome's right edge to whatever the parent decides.
- The X glyph is `weight="regular"` at 24pt in `labelSecondary` — consistent with iOS dismissal-X convention and the rest of the file's icon weights. Good match.
- `tapTarget44` is applied via the `style` array on the Pressable rather than wrapping the X in a View — fine, but means the painted target is centered on the glyph, which puts the touch hot zone tight against the safe-area top. Confirm on hardware.

## Questions to Consider

- The X routes to Step 2 via `onBackToActions`, but `actionTaken` and `shareOn` are not reset on the way back. A user who landed on Step 3 by accidentally toggling share and then taps X arrives back at Step 2 with the Switch still on. Is that intentional (preserve user's state) or a small leak (the "accident" path doesn't fully undo)?
- `usePreventRemove` is still active on Step 3 — the sheet swipe-dismiss is still blocked. With the X now present, is the swipe-block still needed, or is the X enough? Defensive double-coverage is fine, but worth a conscious decision.
- The share-location row's `accessibilityHint` is absent; the problem and tow rows got hints in PR #242. Is the omission deliberate (the Switch self-describes via `accessibilityState`) or pending?
- The X icon's `accessibilityLabel="Back to actions"` is a destination label, not an action label. iOS HIG suggests "Close" or "Done" for the chrome X glyph and putting the destination in a hint. Worth aligning.
