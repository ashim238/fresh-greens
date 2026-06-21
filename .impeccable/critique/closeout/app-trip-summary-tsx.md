---
target: app/trip-summary.tsx
total_score: 36
p0_count: 0
p1_count: 1
timestamp: 2026-06-20-closeout
slug: app-trip-summary-tsx
phase: closeout
---

## Then vs now

**Phase 1:** 32/40 · 1 P0, 2 P1, 2 P2, 1 P3 (6 priority findings).
**Closeout:** 36/40 · 0 P0, 1 P1, 2 P2, 1 P3 (4 priority findings). Delta **+4**.

Phase 2/3 work landed the two structural items: the P0 silent-failure on community-report submission and the P1 "Set as default" mental-model mismatch. The submit path now runs through `useMutation`, statuses are rolled back on failure (`statusesRef` guard prevents clobbering a deliberate Reject during the await), and a per-row "Didn't save — tap to retry." line surfaces the failure honestly. The same retry treatment was extended to `markRegular` for the footer CTA, which is a thoughtful generalization beyond the original P0 scope. PR #243 replaced the primary CTA copy with "Remember this destination," resolving the "default what?" reading. The remaining cohort is the smaller surface: the wiltedgreen-as-affirmative token collision, the still-inverted consequence-before-ask framing, and the missing scroll affordance. None are structural; all are reachable in single edits.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Optimistic flip is now honest — `useMutation` rollback + inline retry line on failure; no in-flight pending visual (button stays in accepted state during await), minor |
| 2 | Match Between System and World | 4 | "Remember this destination" lands the bookmark concept (PR #243); "Keep current route" still framed as active choice rather than passive exit |
| 3 | User Control and Freedom | 4 | Retry path now exists for both inference accepts and the regular-mark; still no undo for a Reject once tapped, and no return path after modal dismiss |
| 4 | Consistency and Standards | 3 | `inferenceBtnAccept` still `colors.wiltedgreen` — secondary-CTA token used as primary affirmative fill, unchanged from Phase 1; `inferenceResultAccepted.color` carries the same collision |
| 5 | Error Prevention | 3 | Still no confirmation gate before community-report submission; tap on check fires immediately. Now at least the failure path is honest, but the no-confirm-before-submit shape is unchanged |
| 6 | Recognition Rather Than Recall | 4 | CTA now self-describes; "Remember this destination" reads as bookmark in arrival register |
| 7 | Flexibility and Efficiency | 4 | Still no "Confirm all"; trip with four zones = four taps. Lower priority now that each tap has honest feedback |
| 8 | Aesthetic and Minimalist Design | 4 | Calm and well-spaced; new retry lines render conditionally so quiet state is unaffected |
| 9 | Error Recovery | 4 | The structural fix — inline tap-to-retry on inference, separate retry line on the regular-mark, both with proper accessibilityLabel. Phase 1's P0 closed |
| 10 | Help and Documentation | 3 | Sub-copy still sits below the heading, after the ask — consequence disclosed second, unchanged from Phase 1 |
| **Total** | | **36/40** | **Strong — one token collision, two ordering/discovery nits** |

## Anti-Patterns Verdict

**Not AI slop.** New evidence of craft beyond Phase 1: the `statusesRef` pattern (ref mirroring state for synchronous reads inside async handlers) is exactly the kind of race-condition engineering slop misses — the in-line comment explicitly names the "user taps Reject during the await" case the rollback would otherwise clobber. The `setRetryableAccepts` clear-on-new-attempt step is the same shape of care. `useMutation` adoption removes a homegrown try/catch; consistent abstraction across both the inference and regular-destination paths.

Phase 1 noted the slop-adjacent smell that pending vs confirmed/dismissed rows look structurally identical. Still true. The retry line gives failed-confirm rows new visual texture but adds nothing for the success terminal state — confirmed and dismissed rows remain visually flat differentiations on text color and copy alone.

## Cognitive Load

1. **Number of decisions:** Unchanged — up to N+2 at arrival. New "Retry" choice appears only on failure, which is correct (lazy escalation).

2. **Working memory burden:** Improved. "Remember this destination" surfaces what's being set as a concept (this place, frequent stop); no longer requires holding a definition of "default" to choose.

3. **Chunking:** Unchanged. Stats / inference / actions correctly grouped.

4. **Reading level:** Sub-copy unchanged; retry copy ("Didn't save — tap to retry.") tight and direct. New text passes the register.

5. **Status legibility:** Unchanged — `inferenceResult` still `subheadlineEmphasized` (15pt/600). Confirmed reads as wiltedgreen (token collision below) which makes its hue close to mutedTertiary at distance.

6. **Sequencing:** Unchanged. "Did we get this right?" still precedes consequence sub-copy. Phase 1 P2 still open.

7. **Scroll detection:** Unchanged — `showsVerticalScrollIndicator={false}`. Phase 1 P2 still open. Now slightly more material with retry lines pushing list height further.

8. **Recovery path:** Improved for the in-flight case; unchanged for the post-dismiss case. Once modal closes, no way back to revisit a Reject or a missed inference.

## Emotional Journey

**Arrival → stats beat:** unchanged from Phase 1. Relief and satisfaction land correctly.

**Inference section:** Tone of the *ask* is unchanged (heading before consequence). What changed is the tone of the *failure*: a silent "Confirmed" that didn't save is replaced by an honest "Didn't save — tap to retry." The trust claim ("it helps the next driver") is now backed by the implementation. Material upgrade.

**Action buttons:** "Remember this destination" lands warmer than "Set as default" — it reads as the app offering to remember on the user's behalf, rather than asking the user to configure a setting. "Keep current route" still framed as active choice; emotional friction on the exit path persists.

**Overall arc:** Relief → satisfaction → softer mild obligation → cleaner exit. The obligation beat is still present (community-report ask), but the exit-and-failure beats are both improved.

## What's Working

**1. The race-safe rollback.** `statusesRef` + status guard in the failure path is genuinely subtle work — synchronous mirror of async state specifically so the rollback can read user intent that landed during the await. The doc comment is load-bearing.

**2. CTA copy now self-describes.** "Remember this destination" carries the bookmark concept; no prior-language dependency. Phase 1 P1 closed.

**3. Retry surface is honest and quiet.** Inline retry line uses `footnoteRegular` + `labelSecondary` — same register as a caption, doesn't borrow alarm color or shouting weight. Failure is disclosed without performing failure.

**4. Mutation retry generalized to the regular-mark.** `regularMutation.status === 'error'` renders a retry line above the CTA. Extending the pattern beyond the original P0 scope shows the fix was understood as a pattern, not a one-off.

## Priority Issues

**[P1] Accept-button color still violates color system (unchanged from Phase 1)**
- What: `inferenceBtnAccept.backgroundColor: colors.wiltedgreen` and `inferenceResultAccepted.color: colors.wiltedgreen`. Wiltedgreen is the secondary-CTA token; the affirmative-action color is `colors.freshgreen`.
- Why it matters: Reserved-color discipline only holds if green-family tokens carry single meanings. Using wiltedgreen for primary affirmative confirmation gives the token a second job ("secondary CTA" and "you confirmed a report") and weakens the system everywhere it's read.
- Fix: `inferenceBtnAccept.backgroundColor` and `inferenceResultAccepted.color` → `colors.freshgreen`. Two-line change.

**[P2] Inference framing still inverts consequence and ask**
- What: Heading "Did we get this right?" still precedes sub-copy "Confirming adds your report to the community map…" Consequence disclosed after the ask.
- Why it matters: For informed consent on the community-report submission, stakes need to be visible before the affordance to confirm.
- Fix: Sub-copy first (reframed: "These are the areas we flagged on your route. Confirming sends a report to the community map.") → then list items. Move or drop the heading.

**[P2] No scroll affordance (unchanged from Phase 1)**
- What: `showsVerticalScrollIndicator={false}` still suppresses the indicator. With the new retry lines, list heights grow on failure cases — more material likely below the fold.
- Why it matters: Users who accept/reject the first two inferences and tap Remember may not know more inferences (or retry lines) wait below.
- Fix: Restore default scroll indicator, or add a subtle gradient fade at the bottom of the scroll region.

**[P3] No "Confirm all" shortcut**
- What: Each inference still requires a per-row tap. Lower priority post-P0-close because the cost-per-tap is now honest (failure visible), but the friction-on-the-good-path still starves the community signal.
- Fix: "Confirm all" transparent button, freshgreen, visible only when ≥2 inferences pending. Same proposal as Phase 1.

## Persona Red Flags

**Sam (accessibility):**
Retry lines have `accessibilityRole="button"` and clear labels ("Retry confirming {label}", "Retry saving as default"). Good. `inferenceResult` still has `accessibilityLiveRegion="polite"` — correct. The `statValue` blocks (duration, distance) still lack `accessibilityLabel`; screen reader still reads "47 min" then "time" as two unconnected items. Phase 1 observation still open.

**Casey (distracted mobile):**
Still 8pt gap between 44pt accept/reject circles. Misfire surface unchanged. The new mutation rollback partially mitigates: an accidental Accept that the network confirms is still an accidental Accept, but if the network fails, the user lands on a visible retry line and can disambiguate.

**Black driver assessing safety in a charged moment:**
The "Increased police presence" → `felt-unsafe` category translation is unchanged. The user is still confirming "police were present" while the report tags it "felt-unsafe." Failure visibility doesn't address semantic translation; this is the deepest unresolved trust issue on the screen.

## Minor Observations

- `setDefaultRetryText` copy is "Didn't save — tap to retry." while the CTA above now reads "Remember this destination." Retry copy doesn't mention "default" anymore (good) but also doesn't name what didn't save. Consider "Couldn't remember it — tap to retry." for symmetry.
- `inferenceRow` still has `borderTopWidth: 1` on every row — first row carries a separator above the heading-list boundary; last row has no bottom separator. Visual asymmetry from Phase 1 unchanged.
- `INFERENCE_META` ordering in the object is not stable across `parsedInferences`; map iteration order from the URL param controls list order. Trip with the same four inferences in different order shows different layouts. Minor.
- `retryableAccepts` is keyed by inference id and stores the whole Inference. Cheap enough at N≤4 but worth a note: the rollback also `delete next[inf.id]`s the status, so a retry-then-success path correctly clears both maps.
- The `regularMutation.status === 'error'` retry line renders even after a successful retry of `acceptMutation`, because the two mutations are independent. Correct behavior, but worth a manual QA pass to confirm both retry lines can coexist without layout overflow.

## Questions to Consider

1. Should the empty-inference variant of this screen (stats + two CTAs only) still show "Remember this destination"? The bookmark concept lands fine, but the "Keep current route" sibling reads odd when there's no route discussion happening.
2. Wiltedgreen-as-affirmative — is it a Figma spec or an oversight? Phase 1 asked the same question and it remains the cheapest fix on the file.
3. Is the inference list intended to scroll, or should the modal grow with content? Current `flex: 1` ScrollView inside a modal works but the no-indicator + likely-overflow combination is the suppressed half of a real design call.
4. Long destination labels still have no `numberOfLines` clamp (Phase 1 observation #4 unchanged).
5. Should `Reject` be reversible? Current model: one-tap-and-locked. A driver who reflexively dismissed "Increased police presence" and then reconsiders has no path back.
