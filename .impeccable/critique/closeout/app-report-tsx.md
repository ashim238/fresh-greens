---
target: app/report.tsx
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-06-20-closeout
slug: app-report-tsx
phase: closeout
---

## Then vs now

**Phase 1:** 28/40 · 0 P0, 2 P1, 3 P2, 1 P3 (6 priority findings).
**Closeout:** 28/40 · 0 P0, 2 P1, 3 P2, 1 P3 (6 priority findings). Net delta: **0**.

`app/report.tsx` was not edited between Phase 1 (2026-06-19) and the closeout. `git log -- app/report.tsx` shows the last touches as PR #235 (SafetyErrorMessage adoption, Sprint 1 closer) and PR #234 (useMutation migration) — both pre-date the Phase 1 audit. The `submitError` inline line wired above the Submit CTA (`SafetyErrorMessage` with `domain="report"`, `disposition="transient"`) is the *P-B pending+inline error pattern* Sprint 1 codified — and Phase 1 already audited the file in that state. So the useMutation/inline-error work is already counted in the 28 score; it didn't materially shift heuristic ratings because the Phase 1 critique scored what it saw, and what it saw was the post-#235 file.

What *did* happen in the Phase 2/3 window were conventions promoted by adjacent PRs that explicitly stopped short of this screen: PR #241 standardized dismissal (close-X painted, header geometry) and PR #242 codified `label = noun, hint = present-tense outcome`. Neither reached `/report`. Both of the Phase 1 P1 findings — Thank-You CaretLeft-as-undo and the silently-disabled Submit with no `accessibilityHint` — are exactly the failure modes those conventions exist to fix, and both remain open. Score holds at 28 because the inherited gaps were already priced in; nothing regressed, but the screen now sits one polish boundary behind the safety flow it visually rhymes with.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Unchanged — submission state communicated (`submitting` → `loading` prop on Button, "Submitting…" label, success haptic, inline `SafetyErrorMessage` on failure now in place since PR #235). GPS-acquisition still silent: Submit stays `disabled={!locationKnown}` with no progress signal, no `accessibilityHint`, no inline "Getting your location…" line |
| 2 | Match Between System and World | 3 | Unchanged — picker tiles share map-marker glyphs (strong coherence); Thank-You CaretLeft still glyph-as-undo (iOS convention says chevron-left = navigate back) |
| 3 | User Control and Freedom | 3 | Unchanged — scrim-to-dismiss has `accessibilityLabel="Dismiss report"` (good) but still no `accessibilityHint`; no confirm-before-discard for partially-filled detail form; undo affordance still icon-only |
| 4 | Consistency and Standards | 3 | **Slightly sharper inconsistency** — header row uses `tapTarget44` token throughout (audit #10 fix held), but the broader dismissal convention promoted by PR #241 (consistent close-X geometry, modal exit patterns) was applied to /route-comparison and other modals; `/report` predates and doesn't re-conform. `identityIcon` and `detailIdentityIcon` still defined as two style objects with identical values — same rule-of-three smell Phase 1 flagged |
| 5 | Error Prevention | 3 | Unchanged — `locationKnown` guards Submit (good); camera-denied Alert still includes fallback path; disabled Submit still has no `accessibilityHint`; `maxLength={280}` still silent with no counter |
| 6 | Recognition Rather Than Recall | 3 | Unchanged — picker glyphs still bridge to marker identity strongly; "(Optional)" prefix on every field label still low-priority cognitive noise implying a required variant that doesn't exist |
| 7 | Flexibility and Efficiency | 2 | Unchanged — linear flow, no "report again" shortcut, sub-tag single-select; the felt-welcome multi-attribute case Phase 1 flagged still single-select |
| 8 | Aesthetic and Minimalist Design | 3 | Unchanged — card clean, tokens disciplined. Subtitle "Reports like yours keep Fresh Greens fresh." still appears identically in detail and Thank-You (v2 Figma codified this as deliberate — comment at line 558-563 explains the per-category subtitles on `CATEGORIES` were retired). Picker's 32pt SidebtnReport SVG in 56×56 box still reads as 24pt of dead space |
| 9 | Error Recovery | 3 | **Improved one notch since Phase 1 baseline, but already counted** — failure case no longer renders generic `Alert.alert('Could not submit', ...)`. PR #235 wired `SafetyErrorMessage` inline above the CTA with `domain="report"` / `disposition="transient"`, preserving form state and giving a typed error surface. Phase 1 audited this state already (the `submitError` conditional was in place at audit time) but called Recovery a 2 because the *form-state-preservation* fix wasn't called out as the improvement it is. Honest read: this should arguably be a 3 retroactively. Holding it at 3 here, not bumping the total, since Phase 1 saw the same code |
| 10 | Help and Documentation | 3 | Unchanged — anonymous-note disclosure still right contextual placement; no inline distinguishing copy for felt-unsafe vs incident; no help on why sub-tags are optional |
| **Total** | | **28/40** | **Fair — held its Phase 1 score by not being touched. Same six priority findings, in the same order, with the same fixes. One heuristic (Error Recovery) is arguably underscored relative to the post-#235 reality, but the audit caught it post-fix and the number is internally consistent.** |

## Anti-Patterns Verdict

**No AI slop detected.** Same verdict as Phase 1, same evidence. Reserved-color rule still holds — orange appears only via `SidebtnReport` SVG (documented exception #4 in `.cursorrules`); UI chrome entirely freshgreen / wiltedgreen / neutral. Typography hierarchy still `title1Emphasized` for screen titles, `bodyRegular` + `labelTertiary` for subtitle. Card geometry still 20pt radius / 24px-32px padding / `shadows.e2` — all token-sourced.

Phase 1's one mild anti-slop concern — `identityIcon` and `detailIdentityIcon` as two objects with identical values — **still present, unchanged**. The rule-of-three violation is a coiled spring: as soon as a third variant of this stack lands, the cleanup cost compounds. Cheap to fix, hasn't been.

One thing the closeout can add: the inline `SafetyErrorMessage` adoption (PR #235) is the kind of structural choice that *avoids* the most common AI-slop tell in this surface — modal error toasts or generic Alert dialogs. The `domain` + `disposition` taxonomy gives the surface room to evolve without each screen reinventing its own error treatment. That this lands invisibly (the success path looks unchanged) is exactly right; the slop test is precisely about what the screen *doesn't* do.

## Cognitive Load

Unchanged from Phase 1. Still 5-of-8 pass cleanly; same three flags:

1. **Field count per form view** — Flag. Detail view still can show text input + up to 3 chip groups + photo on the same surface for the felt-welcome category.
2. **Labels self-describing** — Flag. "Felt unsafe" vs "Incident" disambiguation still absent in UI.
3. **Status always visible** — Flag. Disabled Submit still gives no explanation of its state (no-location = silent failure). PR #242's `label = noun, hint = present-tense outcome` convention would address this directly; it didn't reach this file.
4. **Irreversible actions guarded** — Flag. Back from detail still silently discards typed text + chip + photo.
5. **Copy voice consistent** — Flag. Detail and Thank-You subtitles still identical. v2 Figma chose this deliberately (comment at line 758-763) — the closeout view is that codifying it as v2-correct doesn't make it land better emotionally for sensitive-category submissions.

What the surrounding code added that *would* have helped: nothing structurally new in the form-state or copy domain landed in the Phase 2/3 window for community-reporting. The dismissal-standardization PR (#241) touched modal exit but not in-form discard guards; VoiceOver hint depth (#242) touched picker labels but not disabled-CTA explanation.

## Emotional Journey

Same arc as Phase 1, same edges. **Picker (calm, inviting) → Detail (neutral-to-taxing) → Thank-You (muted warmth)** still reads the same way, with the same emotional valley for sensitive-category reporters (felt-unsafe, incident) where the form feels cold and the Thank-You generic. The biggest emotional gap is still exactly where the user is most vulnerable.

The closeout-specific note: the screen is now the **only modal-entry surface in the safety-adjacent flow that didn't pick up Phase 2/3 polish**. Sub-flows around it tightened their dismissal language (PR #241), tightened their VoiceOver hint depth (PR #242), and tightened their error-recovery surfaces (PR #235 — which `/report` *did* pick up). So a Black driver entering `/report` from the FAB after a charged moment crosses the same polish boundary as the safety closeout flagged: the door into the flow is slightly less held than the rooms it would open into.

One specific moment the closeout can name precisely: the **silently-disabled Submit during GPS acquisition** is the worst single emotional failure point on this screen. For a user trying to document a racially charged traffic stop, with adrenaline elevated, tapping a button that does nothing — no spinner, no "Getting your location…", no explanation when VoiceOver lands on "Submit report, button, dimmed" — is a dignity failure that Phase 1 flagged as P1 and that the closeout can confirm: nothing about the code since has reduced this risk.

## What's Working

Unchanged from Phase 1, with one closeout addition:

**1. Reserved-color discipline.** Orange only via documented exception SVG; UI chrome entirely fresh / wilted / neutral. Future orange warning chip still carries signal weight.

**2. Tap-target compliance throughout.** `tapTarget44` token applied at every header chevron / X / Done; `hitSlop: 8` exception on photo-clear badge well-commented at lines 692-702 — the carve-out is exactly the kind `.cursorrules` allows (child target inside an already-compliant container).

**3. State machine clarity.** Picker → detail → thank-you still handled in local state with clean transitions. `accessibilityViewIsModal` wired. `KeyboardAvoidingView` + `ScrollView` combination handles the tall felt-welcome form. GPS fallback chain still well-defended.

**4. (Closeout addition) The submit-error path is structurally correct.** Pre-Sprint-1, this would have been `Alert.alert('Could not submit', 'Please try again.')` — a modal-on-modal dead end. Now it's an inline `SafetyErrorMessage` above the CTA, form state preserved, retry one tap away. The fact that the *visible polish* didn't move (the closeout score holds at 28) shouldn't obscure that the *structural correctness* of error handling moved in Sprint 1 and this screen is consuming the result.

## Priority Issues

All six Phase 1 findings remain open, in the same order, with the same fixes. Restated briefly for closeout completeness:

**[P1] Thank-You "back" icon invokes undo — mental model mismatch.** Lines 769-778. `CaretLeft` wired to `handleUndo`. Fix unchanged: replace with explicit labeled "Undo" text button or secondary outlined `Button`. Reserve chevron for genuine back-navigation.

**[P1] Disabled Submit button explains nothing.** Lines 736-743. `disabled={!locationKnown}` with no `accessibilityHint`, no inline status line, no spinner-vs-disabled distinction. Fix unchanged: (a) add `accessibilityHint="Waiting for your location"` when `!locationKnown`, (b) inline "Getting your location…" line below form while GPS pending, (c) consider showing CTA as loading rather than disabled. **Worst-case persona impact is the felt-unsafe / incident reporter — closeout reaffirms this as the screen's highest-stakes unaddressed gap.**

**[P2] Discarding filled detail form has no guard.** Lines 145-150, 510-528. X (close) and CaretLeft (back from detail) both reset state without a confirm step. Fix unchanged: intercept with `Alert.alert("Discard this report?", [Cancel, Discard])` when `detailText.length > 0 || photoUri || selectedSubTag`.

**[P2] Sensitive-category subtitle ignores emotional register.** Lines 564-566. Closeout note: v2 Figma made this single-subtitle choice deliberately (comment at lines 558-563 says per-category subtitles are no longer consumed; `CATEGORIES` still defines them). The audit view is that v2 being deliberate doesn't make it land better for felt-unsafe / incident. The fix is the same: re-surface `category.subtitle` for sensitive categories.

**[P2] Character counter missing for 280-char text input.** Lines 576-589. Fix unchanged: `caption1Regular` `labelTertiary` counter right-aligned below input, conditionally rendered when `detailText.length > 0`; shift to `colors.red` when `< 20` remain (documented exception #8).

**[P3] Identical subtitle in detail and thank-you.** Lines 564-566 and 764. Closeout note: same as the P2 subtitle finding — v2 Figma codified the repetition (comment at lines 758-763 explains the choice). Same fix: give Thank-You its own closing line. "Your note is on the map." aligns with Steady Companion register without losing the brand voice.

## Persona Red Flags

Unchanged from Phase 1:

- **Sam (accessibility):** Three live issues remain. (1) Disabled Submit still has no `accessibilityHint`. (2) Sub-tag chips still use `accessibilityState={{ selected: active }}` without a `radio`-group wrapper — single-select semantics still implicit. (3) The `&rsquo;` HTML entity at line 442 still renders literally; RN `<Text>` does not process HTML entities.
- **Casey (distracted mobile):** Silent disabled Submit still the primary risk. Same arc Phase 1 described.
- **Black driver in a charged moment:** Highest-stakes use case, unchanged. Three friction points (generic subtitle, low-contrast anonymous note, silent Submit) all still live. The closeout reaffirms that this is the persona the screen serves least well, by a margin.

## Minor Observations

Unchanged from Phase 1; restating to make the closeout self-contained:

- `identityIcon` (line 881) and `detailIdentityIcon` (line 889) still identical. Consolidate.
- `paddingHorizontal: 14` on `.chip` (line 1036) still not a spacing-scale step. Use `spacing.md` (16) or add `12` to the scale.
- Scrim `Pressable` (line 268-273) still missing `accessibilityHint`.
- `&rsquo;` at line 442 — still a literal-render bug, still trivial to fix.
- `ThankYouView` (lines 750-803) still receives `placeName` prop and immediately ignores it. Comment at lines 758-763 explains the v2 choice; the prop should either be consumed or removed from the type to avoid the next reader wondering.
- `photoPreviewWrap` and `photoStub` `borderRadius: 16` (lines 979, 987) still not token-sourced — should be `radii.lg`.

## Questions to Consider

Same five as Phase 1; closeout adds one:

1. What is the intended UX when `locationKnown` remains false indefinitely?
2. Felt-unsafe vs incident — meaningful user-facing difference? Single category with sub-tag?
3. Undo window — race condition where report has already broadcast before undo fires?
4. Sub-tag single-select for felt-welcome — deliberate constraint?
5. Thank-You "what happens next" — signal about when contribution appears on map?
6. **(Closeout addition)** The submit-error inline pattern from PR #235 works structurally. Is there a Sprint 4 (or post-thesis) intent to backport its sibling — the *form-state-preservation-during-network-failure* contract — into a documented convention that other forms (`/trusted-contact-setup`, `/safety-settings`) consume the same way? The pattern exists in code; it doesn't exist in `.cursorrules` yet.
