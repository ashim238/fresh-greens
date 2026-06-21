---
target: app/saved-places.tsx
phase: closeout
phase1_score: 33
closeout_score: 37
phase1_p0: 0
phase1_p1: 2
closeout_p0: 0
closeout_p1: 0
delta: +4
timestamp: 2026-06-20T00-00-00Z
slug: app-saved-places-tsx
---

## Phase 1 vs Closeout

| | Phase 1 (2026-06-19) | Closeout (2026-06-20) | Δ |
|---|---|---|---|
| Total score | 33/40 (Solid) | 37/40 (Excellent) | **+4** |
| P0 | 0 | 0 | 0 |
| P1 | 2 | 0 | **−2** |
| P2 | 2 | 2 | 0 |
| P3 | 1 | 1 | 0 |

**Closed since Phase 1:**

- **P1 — Loading flash resolved.** The render is now gated by `savedPlacesState.ready` (line 85: `{savedPlacesState.ready && (...)}`). The hook returns a discriminated `{ready: false} | {ready: true, savedPlaces, home}` per the value-as-state convention confirmed canonical in PR #236. The pre-hydration moment renders nothing inside the ScrollView rather than the false "No saved places yet" empty state. Heuristic 1 (Visibility of System Status) moves 3→4. Tradeoff worth naming: the screen now shows a blank scroll area instead of a flash of wrong copy — acceptable because hydration is mount-only AsyncStorage and resolves within a frame or two; no skeleton needed at this latency. If hydration ever slipped (e.g. migration step added), a skeleton row would become warranted.
- **P1 — Silent failure on remove resolved.** Sprint 1 PR #2's `useSavedPlaces` `useMutation` migration plus the P-B `onOptimistic` returning rollback fn (verified in `hooks/useSavedPlaces.ts` lines 103-119) gives the hook proper pending+rollback. Screen now narrows on `result.ok` (line 60) and on failure surfaces `Alert.alert(title, body)` via `getErrorMessage('save', 'transient', result.error)`. The optimistic removal rolls back, the user-visible error fires, and the source-of-truth/UI divergence ("ghost place") is closed. Heuristics 5 (Error Prevention) 3→4 and 9 (Error Recovery) 2→4. This is the cleanest closure of the two — the fix lives in the right layer (hook handles rollback, screen handles disclosure), and the error path uses the same `getErrorMessage` register the rest of the app uses.

**Still open from Phase 1:**

- **P2 — No "Add" affordance from within populated-list view.** Once a user has at least one place, no in-screen route to /search or /home. Unchanged. Heuristic 7 stays at 2.
- **P2 — No swipe-to-delete.** Settings register still requires Trash-tap → Alert-confirm. iOS platform convention gap unchanged.
- **P3 — `gap: 2` in `rowTextStack`.** Sub-`spacing.xs` magic number still present at line 196. Unchanged.

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | `ready` gate eliminates empty-state flash; pre-hydration blank acceptable at AsyncStorage latency |
| 2 | Match System / Real World | 4 | "Saved {date}" clear; House / MapPin glyph honest; empty-state plain language |
| 3 | User Control and Freedom | 3 | Alert confirm-or-cancel; no undo after removal; no in-screen add path |
| 4 | Consistency and Standards | 4 | Faithful to settings register; PR #236 value-as-state convention applied; separator inset keyed to icon-bearing rows |
| 5 | Error Prevention | 4 | Two-tap delete confirm; hook now returns `MutationResult` and screen narrows on `result.ok` |
| 6 | Recognition Rather Than Recall | 4 | House vs MapPin glyph plus "Saved {date}" temporal anchor; address still absent |
| 7 | Flexibility and Efficiency | 2 | No sort/filter; no swipe-to-delete; no edit-name; no in-screen add |
| 8 | Aesthetic and Minimalist Design | 4 | Calm grouped-gray register; copy generous without being wordy |
| 9 | Error Recovery | 4 | P-B pending+rollback in hook; user-visible Alert on transient save error; optimistic state stays consistent with truth |
| 10 | Help and Documentation | 4 | Empty-state self-teaching; no mystery about surface intent |
| **Total** | | **37/40** | **Excellent — minor polish gaps remain (efficiency, freedom)** |

## Anti-Patterns Verdict

**No reserved-color violations.** Trash icon still on `colors.labelSecondary` (gray, not red). No orange/navy/pink/yellow on this surface. Palette stays freshgreen/wiltedgreen/neutral.

**No inline design values.** All spacing, color, typography pulls from tokens. Single exception is the `gap: 2` sub-floor optical gap, flagged in Phase 1 and still present.

**Tap-target rule: PASS.** `tapTarget44` on Trash Pressable, row itself non-interactive (correct for review-or-remove surface).

**Icon rule: PASS.** Phosphor deep-imports throughout (House, MapPin, Trash).

**Pattern convention: PASS.** Discriminated `ready`/`!ready` union consumed at point-of-render (line 85, 47) — value-as-state canonical per PR #236. Sprint 1 PR #2's `useMutation` migration landed cleanly; the screen calls `remove.run(id)` and narrows on `result.ok` rather than try/catch — Phase 2's result-narrowing convention applied correctly.

**Resolved pattern flag from Phase 1 — optimistic removal now has user-visible error path.** Hook's `onOptimistic` returns a rollback fn that re-splices the removed item at its original index on failure. Screen surfaces a Steady-Companion Alert via `getErrorMessage`. The "ghost place" trust-undermining moment is closed.

## Cognitive Load

Low for read-path; medium for write-path unchanged (add still requires leaving the screen). Alert dialog copy tight. Two new lines of code in the remove handler carry the entire error-disclosure load — economical.

No overload concerns at typical list sizes. No grouping/sort affordance for the long-list case — same caveat as Phase 1, still appropriate to defer until users actually accumulate ten landmarks.

## Emotional Journey

**Arrival (has places):** Calm. Unchanged.

**Arrival (no places):** Now slightly *more* honest — the brief flash of "No saved places yet" before hydration is gone; the empty state only appears once the hook has actually confirmed there are no places. Trust improves at the seam where it had been quietly fraying.

**Delete flow:** Same deliberate two-tap pacing.

**Post-delete (success):** Smooth optimistic removal.

**Post-delete (failure):** This is where the closeout work shows. The user now sees `Alert.alert(title, body)` with Steady-Companion error copy and the row reappears in its original spot (rollback re-splices at `idx`, not at the end of the array). The data-transparency claim is now actually backed by what the surface does in the failure case. The thesis claim and the runtime behavior have been unified.

## What's Working

1. **Value-as-state ready gate.** `savedPlacesState.ready` is checked at the top of the render gate and once narrowed inside it. The destructuring on line 47 uses the safe fallback `[]` only when `!ready` and reads the real array when `ready` — no false render paths.
2. **Error surface lives in the screen, rollback lives in the hook.** Correct split. The hook owns "make the optimistic move and know how to undo it"; the screen owns "tell the user when the move failed." Other screens this sprint that conflated these (rollback in the screen) read worse.
3. **`getErrorMessage('save', 'transient', result.error)`.** The screen uses the same error-copy registry as the rest of the app. No bespoke string literal, no engineer-voice leak.
4. **Token discipline still exemplary.** Every spacing, color, type pulls from theme. Only the `gap: 2` sub-floor remains and it is intentional optical kerning, not drift.
5. **Tap-target compliance, accessibility labels, Phosphor deep imports** — all carried forward unchanged.
6. **`dynamicType()` + `relaxedLineHeight()`** on empty-state body copy unchanged. Relaxed-Read Rule satisfied.

## Priority Issues

**[P2] No "Add" affordance from within populated-list view** *(unchanged from Phase 1)*
- What: Once the user has at least one place, the instructional empty-state copy disappears and no in-screen route to /search or "Save as Home" surfaces.
- Why it matters: Discoverability gap. First-time user with one place ("Home") and intent to add a landmark has no in-screen signal.
- Fix: Add a RowGroup footer ("Add landmarks from the Search tab") or a `Plus`-icon row at the bottom of the list routing to /search.

**[P2] No swipe-to-delete** *(unchanged from Phase 1)*
- What: Removal still requires Trash-tap then Alert-confirm; iOS users expect swipe-left.
- Why it matters: Settings register sets the platform expectation. Casey's mental model predicts swipe.
- Fix: Wrap `SavedPlaceRow` in `ReanimatedSwipeable` with a red Remove chip. Keep the Alert-confirm to preserve two-tap discipline.

**[P3] `gap: 2` in `rowTextStack`** *(unchanged from Phase 1)*
- What: Sub-`spacing.xs` literal at line 196.
- Fix: Inline comment naming it as intentional optical gap, or fold into `spacing.xs` and accept the visual change.

## Persona Red Flags

**Sam (accessibility):**
Unchanged. Combined `accessibilityLabel="{name}, saved {date}"` still strong. Trash button still lacks `accessibilityHint` describing the Alert consequence. Dynamic Type still wrapped correctly. The new failure Alert is screen-reader friendly via standard React Native Alert semantics.

**Casey (distracted mobile):**
Slightly better. The previously-silent failure path now produces a real Alert rather than a console warning, so a distracted user mis-tapping or hitting a transient AsyncStorage error gets explicit feedback rather than confusion-on-next-launch. Swipe-to-delete gap remains.

**Black driver assessing data transparency:**
This is where the +4 mostly accrues. The thesis claim of "you see and control what the app keeps" is now backed by the runtime behavior: the screen does not lie about what's loading (no empty-state flash), and it does not lie about whether the remove succeeded (Alert + rollback on failure). The Home anchor — which feeds routing — no longer carries the "ghost place" risk that would have undermined trust if the user had deliberately removed it and seen it return.

## Minor Observations

- The `savedPlacesState.ready` check is duplicated: once at line 47 for the safe destructure, once at line 85 for the render gate. The destructure could read `const savedPlaces = savedPlacesState.ready ? savedPlacesState.savedPlaces : [];` and the render could rely solely on the gate. Functionally fine, mildly redundant.
- Hook's `home` derivation (`savedPlaces.find((p) => p.kind === 'home') ?? null`) is exposed but not consumed by this screen. Used elsewhere — leave alone.
- Empty-state copy ("Save a Home from the map") still worth verifying against live /home screen affordance, same Phase 1 caveat.
- The Alert title/body pair on failure uses the `'save'` flow's `'transient'` register. Worth checking whether a separate `'remove'` flow exists in `getErrorMessage` for finer-grained copy, or whether `'save'` is the catch-all for write-path errors by convention.

## Questions to Consider

1. Should the rollback path (item reappears) be accompanied by a brief inline highlight on the restored row, so the user can see *which* row came back? At list sizes of 1-5 this is overkill, but at 10+ a silent re-splice could be missed.
2. Phase 1 questions 1-5 (address line, Home editability, list cap, map cache invalidation, empty-state copy accuracy) all unchanged and all still worth asking.
3. Given the hook now correctly rolls back on transient failure, is there a *permanent* failure mode (storage quota, malformed entry) where the right behavior is to NOT roll back and instead show a different error? Sprint 1's transient/permanent distinction in `getErrorMessage` suggests yes — currently both paths go through `'transient'`.
