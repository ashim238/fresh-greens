---
target: app/safety.tsx
total_score: 35
p0_count: 0
p1_count: 2
timestamp: 2026-06-20-closeout
slug: app-safety-tsx
phase: closeout
---

## Then vs now

**Phase 1:** 35/40 · 0 P0, 2 P1, 2 P2, 1 P3 (5 priority findings).
**Closeout:** 35/40 · 0 P0, 2 P1, 2 P2, 1 P3 (5 priority findings). Net delta: **0**.

`app/safety.tsx` was not edited between Phase 1 and the closeout — `git log -- app/safety.tsx` shows no commits in the Phase 2 / Phase 3 window. The Phase 2/3 conventions this screen would have inherited were promoted via PR #242 (VoiceOver hint depth, 2026-06-20) and PR #241 (dismissal standardization, 2026-06-19), and both PRs propagated explicitly down into the sub-flow screens — share-location, unfamiliar, roadside, roadside-setup, route-comparison — but **stopped at the picker level**. The picker tiles on `/safety` still set `accessibilityLabel` without `accessibilityHint`; the modal still has no close-X painted; the cross-tile + no-contact gates still fire `Alert.alert` rather than reflecting state in the tile. All five Phase 1 priority findings remain open, in the same order, with the same fixes. The closeout is honest: this screen was triaged out of the Phase 3 critical-path and the score reflects that — it didn't regress, but it also didn't pick up the conventions the rest of the safety flow now ships with. Score holds because the inherited gaps were already counted in Phase 1; nothing got worse.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Unchanged — active share session still has no visible state on the picker; cross-tile guard still fires `Alert` rather than tile-state change |
| 2 | Match System / Real World | 4 | Unchanged — "Pulled-over" hyphenation still grammatically odd as standalone noun label; "Unfamiliar area" vs "Share location" still semantically close |
| 3 | User Control and Freedom | 3 | Unchanged — DragHandle still decorative; no close-X painted. PR #241 codified the close-X convention and added it to /route-comparison, but the safety modal was out of scope |
| 4 | Consistency and Standards | 4 | **Drifted from the new convention without losing the Phase 1 score** — PR #242 codified `label = noun, hint = present-tense outcome` and applied it to the four sub-flow pickers (share-location, unfamiliar, roadside, roadside-setup). The /safety picker still sets `accessibilityLabel={tab.label}` with no hint. The SOS bar at the bottom already had a hint in Phase 1, so the inconsistency is now sharper: the emergency lane follows the new house style and the toolkit lane doesn't |
| 5 | Error Prevention | 3 | Unchanged — no-contact gate still reactive (fires Alert after tap on Share location tile) |
| 6 | Recognition Rather Than Recall | 4 | Unchanged — tile labels still single/double-word; illustrations correctly set `accessible={false}` so VoiceOver users still rely on the missing hint to disambiguate |
| 7 | Flexibility and Efficiency | 4 | Unchanged — picker always required first stop; no deep-link path |
| 8 | Aesthetic and Minimalist Design | 4 | Unchanged — `marginTop: 'auto'` SOS anchor still elegant; "Need help now?" still at 13pt `footnoteRegular` in `labelTertiary` |
| 9 | Error Recovery | 3 | Unchanged — Alert dialogs for both gate conditions still informational dead ends |
| 10 | Help and Documentation | 3 | Unchanged — no subtitle/descriptor under tile labels; first-time user still can't tell "Unfamiliar area" from "Share location" without tapping |
| **Total** | | **35/40** | **Good — held its Phase 1 score by inertia rather than by being touched. Same gaps, same priorities, with one of them now sharper because the rest of the safety flow moved on without it.** |

## Anti-Patterns Verdict

**None triggered.** Same verdict as Phase 1, same evidence.

The four-tile grid still faintly echoes the "identical card grids" anti-pattern but is still saved by per-tile illustration distinctiveness — the SVGs (siren, pipe wrench, compass with red diamond, share-network with green pin) carry per-tile semantic load that a generic icon set wouldn't. Token discipline still clean, `pressedDim` still consistently applied, reserved-color rule still respected (red lives inside the SOS illustration, not as ambient surface tint).

One thing the closeout can add that Phase 1 didn't: the **screen still passes the slop test specifically because Phase 1 caught the bigger reflexes early**. The Title1 Regular held-question register, the "Need help now?" hairline-separated escape hatch, and the navy duotone shield carve-out for safety affordances are the kind of choices that would have been a slop tell if they'd defaulted (Title1 Emphasized command voice, an alert-banner SOS row, a generic shield). They were caught in the v2 spec and held through Phase 3 by simply not being touched.

## Cognitive Load

Unchanged from Phase 1. Low on entry; 2×2 with single-concept tiles still as scannable as this screen gets. Load spikes still cluster in the same two moments:

1. **When share session is already active.** The picker still has no ambient indicator of that state. The cross-tile conflict is still discoverable only by tapping the wrong tile and reading the Alert ("You're in a Unfamiliar area session. End it first to enter Share location.")
2. **Choosing between Unfamiliar area and Share location.** Still semantically close; the picker still doesn't disambiguate.

What changed in the surrounding code that *would* have helped here but didn't reach this file: PR #242 wrote a `label = noun, hint = present-tense outcome` rule that explicitly addresses the "single-noun tile label that doesn't tell a VoiceOver user what tapping does" problem. The convention exists in `.cursorrules` now; the picker just doesn't consume it yet.

## Emotional Journey

Same arc as Phase 1, same edges. The "I need help → I can pick the right kind of help → I'm in control" reading still lands for the mid-scenario case. The same two emotional valleys are still present:

**Calm planning moment:** first-time use of the modal still asks "What's going on?" without orientation. Brand voice still correct; information architecture still assumes prior knowledge.

**Charged moment (most important case):** four-tile picker still one extra tap before the relevant sub-flow. Pulled-over (the most-likely-most-consequential tile) still top-left, still correct for LTR scanning. SOS bar still bottom-anchored, still thumb-reachable.

The closeout-specific note: the **sub-flows the picker routes into are now noticeably better than the picker that opens them**. Roadside picked up an X-dismissal + hold-to-confirm SOS (PR #246). Unfamiliar + share-location picked up VoiceOver hints (PR #242). Pulled-over picked up a 44pt stop-recording control + a terminal "Recording saved" state (per closeout). When the user enters the picker and then enters a sub-flow, they cross a polish boundary mid-arc — the sub-flow is more carefully held than the door they walked through to get there.

## What's Working

- **The Phase 1 strengths all held.** Token discipline still flawless. `pressedDim` still consistently applied. `marginTop: 'auto'` on the emergency section still pins the SOS bar to the modal foot on tall devices without crowding the grid. Reserved-color rule still respected — `sidebtn-sos.svg` is still the only place red lives, and it lives there as illustration, not as ambient surface.
- **The Title1 Regular held-question register still reads correctly under the new safety-flow surround.** Pulled-over, Roadside, Unfamiliar, and Share-location all stayed in the same voice register through Phase 3, so the picker's "What's going on?" still sounds like the same product when you tap through. No drift.
- **The SOS bar a11y was already at convention.** PR #242 codified `label = noun, hint = present-tense outcome` and the SOS row was already there: `accessibilityLabel="Emergency. Reach a trusted contact or 911."` + `accessibilityHint="Opens emergency options to call your trusted contact or 911."` — the convention has a reference implementation on this screen already, two lines below the four tiles that don't yet follow it.

## Priority Issues

**[P1] Active session state still invisible on picker**
- What: Unchanged from Phase 1. When a share session is already active, the picker shows no indicator; the user only discovers state by tapping a conflicting tile and reading the Alert.
- Why it matters: Unchanged from Phase 1. Charged-moment user not reading Alerts; they are tapping.
- Closeout-specific note: `useShareSession()` is already read at line 112 and `session` is already in scope at the tile-render site — the wiring exists, only the visual treatment is missing.
- Fix: Status badge or subtitle on the active tile ("Active session"); add Resume shortcut routing directly into the active flow.

**[P1] No-contact gate still reactive, not proactive**
- What: Unchanged from Phase 1. "Share location" still fires the no-contact Alert on tap; the tile still looks identical to any other fully-available tile pre-tap.
- Why it matters: Unchanged from Phase 1. A tap that fails and opens setup is disorienting in a stress moment.
- Closeout-specific note: `useTrustedContact()` is already read at line 110 and `contact` is already in scope — same situation as P1 above, the prerequisite is computed but not painted.
- Fix: If `!contact`, render the Share location tile with a visible prerequisite (Set up chip under the label, lock glyph on the icon, or reduced opacity on the illustration).

**[P2] Tile `accessibilityHint` gap is now sharper, not flat**
- What: In Phase 1 this was a flat "tiles have label but no hint" finding. In the closeout it has a new dimension: PR #242 codified the convention (`label = noun, hint = present-tense outcome, no "Tap to"`), promoted it into `.cursorrules`, and applied it to the four sub-flow picker screens this picker routes into. The /safety tile Pressables (lines 207-220) still set only `accessibilityLabel={tab.label}` while the SOS bar two lines below (line 239) already follows the new house style.
- Why it matters: The drift is now visible inside one file. A VoiceOver user swiping the picker hears "Pulled-over, button. Roadside assistance, button. Unfamiliar area, button. Share location, button. Emergency. Reach a trusted contact or 911, button. Opens emergency options to call your trusted contact or 911." The depth shifts between the toolkit lane and the emergency lane mid-screen.
- Fix: Add `accessibilityHint` to each tile per the codified convention. Example for Pulled-over: `"Opens guidance for a traffic stop."` — present-tense outcome, no "Tap to", matches the rule applied to the rest of the safety flow.

**[P2] Tile label copy — "Pulled-over" and the "Unfamiliar area" / "Share location" pair**
- What: Unchanged from Phase 1. "Pulled-over" still hyphenated as if compound modifier; "Unfamiliar area" and "Share location" still semantically close.
- Why it matters: Unchanged from Phase 1. Stress-moment pattern-matching still slowed by the hyphen and the ambiguity.
- Fix: Rename "Pulled-over" → "Pulled Over" or "Traffic Stop". One-line subtitle under each tile label per Phase 1.

**[P3] `emergencySectionLabel` quietness**
- What: Unchanged from Phase 1. "Need help now?" still at `typography.footnoteRegular` (13pt) in `colors.labelTertiary`.
- Why it matters: Unchanged from Phase 1. The label introducing the most critical escape hatch is still quiet for its semantic weight.
- Fix: `footnoteEmphasized` or `subheadlineRegular`.

## Persona Red Flags

**Sam (accessibility):**
Worse-relative-to-the-rest-of-the-app than at Phase 1, even though the file itself is identical. Sam now has a noticeably better VoiceOver experience inside the sub-flow screens (share-location, unfamiliar, roadside, roadside-setup) than on the picker that opens them — when Sam taps the door and enters the room, the room is more carefully labeled than the door. Sam still cannot distinguish "Unfamiliar area" from "Share location" by announcement alone on the picker. The SOS bar at the bottom of the same screen sets the standard the tiles should match, and the convention to apply is now codified in `.cursorrules`.

**Casey (distracted mobile):**
Unchanged. Picker still one tap deep. Pulled-over still top-left, still correct for charged-moment LTR scanning. SOS still thumb-reachable. Main risk for Casey is still the reactive no-contact gate.

**Black driver assessing safety in a charged moment:**
Unchanged. Header still asks rather than alarms. The Alert-on-cross-tile-conflict and Alert-on-no-contact paths are still the same; if either fires during a traffic stop, the driver is still looking at a dialog rather than a guided handoff. The fact that the picker has not been touched while the sub-flows have means the gap between "picker behavior in stress" and "in-flow behavior in stress" widened across Phase 3 — the sub-flows learned new manners and the front door didn't.

## Minor Observations

- `SidebtnSafety width={32} height={32}` inside the 56×56 `iconBox` still leaves visible dead space at 57% fill. Unchanged.
- `root` style still sets `borderTopLeftRadius: 28` and `borderTopRightRadius: 28` as inline literals; `radii.xl` is 20pt and 28pt is still not on the scale. Unchanged.
- `subtitle` ("What's going on?") still uses `typography.bodyRegular` (17pt) in `labelTertiary`. Unchanged.
- The SAF-prefix code-comment numbering system (e.g., "SAF1" on the title style, "SAF5" on the safe-area `paddingBottom`) still isn't documented anywhere reachable. Inherits from v2 spec. Unchanged.
- New observation specific to the closeout: the cross-tile-guard Alert string template at lines 154-158 produces `"You're in a Unfamiliar area session."` — note the `a Unfamiliar` article-noun disagreement. Phase 1 quoted this Alert and didn't flag the article; the closeout is flagging it now as a P3 copy nit because the rest of the safety flow's strings were tightened in Phase 3 (sign-out, trip-summary CTA, Lifeline subtitle — PR #243) and this one wasn't.

## Questions to Consider

Same five from Phase 1, unchanged, all still open. Adding two the closeout surfaces specifically because of what changed around this file:

6. The sub-flows learned to dismiss with an X-button (PR #241), to confirm SOS with a hold gesture (PR #246), and to label themselves with present-tense outcomes (PR #242). Should the /safety picker get a follow-up PR to inherit these conventions explicitly, or is it on a deliberately separate cadence? The closeout can't answer this — it's a roadmap question, not a design question.

7. The picker's tiles use `accessibilityLabel={tab.label}` with no hint, but the SOS row two `<Pressable>` levels down on the same screen already follows the `.cursorrules` hint convention. Is the picker's tile pattern intended to be a special case (e.g., the tile label IS the outcome because the destination is the same as the noun), or is this an inherited gap from before #242 landed? If the former, document it in `.cursorrules` so future audits don't keep re-flagging it. If the latter, six-line PR.
