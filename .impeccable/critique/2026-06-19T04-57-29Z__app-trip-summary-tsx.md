---
target: app/trip-summary.tsx
total_score: 32
p0_count: 1
p1_count: 2
timestamp: 2026-06-19T04-57-29Z
slug: app-trip-summary-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Inference accept/reject state updates optimistically with no network feedback; Confirmed/Dismissed label lands immediately — user has no idea if report actually submitted |
| 2 | Match Between System and World | 4 | "Set as default" is a mental model mismatch — default what? Concept isn't surfaced anywhere in app's prior language |
| 3 | User Control and Freedom | 3 | Once inference accepted or rejected, no undo path; for community-report submission with real downstream routing effects, notable gap |
| 4 | Consistency and Standards | 4 | `inferenceBtnAccept` uses `colors.wiltedgreen` as confirmation fill — wiltedgreen is *secondary CTA* color; only place wiltedgreen appears as button fill for primary action |
| 5 | Error Prevention | 2 | No confirmation before submitting community report; tap on check immediately fires `addCommunityReport` — no "Are you sure?" gate, no pending visual; meaningful gap for report feeding future routing |
| 6 | Recognition Rather Than Recall | 3 | "Set as default" and "Keep current route" CTAs appear with no contextual framing for what "default" means |
| 7 | Flexibility and Efficiency | 4 | No "Confirm all" affordance for inference list; trip with four zones requires four accept taps; bulk-confirm shortcut would serve power users |
| 8 | Aesthetic and Minimalist Design | 4 | Screen genuinely calm and well-spaced; single concern: inference section immediately below trip stats with no breathing room beyond `marginTop: spacing.xl` |
| 9 | Error Recovery | 2 | No error surface for community report submission; `catch {}` in `handleAccept` silently keeps optimistic `'accepted'` state even if write failed; user sees "Confirmed" but nothing made it to community map |
| 10 | Help and Documentation | 3 | Inference sub-copy is only contextual explanation and sits above list, not adjacent to each item; users who scroll past it before processing first inference have lost framing |
| **Total** | | **32/40** | **Good — one structural gap in error handling** |

## Anti-Patterns Verdict

**Not AI slop.** Carefully authored screen. Typography uses correct held-question register (`title1Regular`) for arrival modal per `.cursorrules` rule. `dynamicType()` applied throughout. Spacing pulls from `spacing.*` tokens. Icons are Phosphor deep imports. Inference section comment cites thesis claim C12b. Code comments load-bearing. `INFERENCE_META` mapping with explicit `reportCategoryId` and `detail` fields is right structure.

One slop-adjacent smell: inference rows have no visual hierarchy between label and action buttons. Row is `flexDirection: 'row'` `alignItems: 'center'` `justifyContent: 'space-between'` — visually flat. A `pending` row and a `confirmed/dismissed` row look structurally identical. Distinction purely in right-hand slot content.

## Cognitive Load

1. **Number of decisions at once:** Screen can ask up to N+2 decisions (N inference confirmations + "Set as default" vs "Keep current route"). Trip with all four inference categories triggered = 6 decisions at exactly the wrong moment.

2. **Working memory burden:** "Set as default" requires user to remember current route and contrast with arrived route. No route name, no origin, nothing to anchor comparison.

3. **Chunking:** Correctly separates stats from inference section. Visual grouping good. Two CTA buttons appropriately grouped at bottom.

4. **Reading level:** Sub-copy ("Confirming adds your report to the community map — it helps the next driver") plain and direct. Passed.

5. **Status legibility:** "Confirmed" / "Dismissed" in `subheadlineEmphasized` is small for status result. 15pt/600 lighter edge for action with downstream consequences.

6. **Sequencing:** Inference section titled "Did we get this right?" but sub-copy below explains consequence — framing and stakes inverted. Consequence should be disclosed before ask, not after.

7. **Scroll detection:** Bottom CTA buttons visible above fold but inference section may continue below. No visual scroll affordance (`showsVerticalScrollIndicator={false}`).

8. **Recovery path:** None. Once modal dismissed, no way to return to inference validation or revisit "Set as default" decision.

## Emotional Journey

**Arrival state:** User just completed trip — ambient emotion is relief, mild accomplishment. "Trip Summary" title and arrival destination name land correctly.

**Stats beat:** Duration and distance in `title2Emphasized` — satisfying micro-moment, "you made it" receipt. Appropriate.

**Inference section:** Tone shifts unexpectedly. "Did we get this right?" introduces social obligation — user asked to do work for community immediately upon arrival. Right thesis goal but emotionally lands as task, not invitation. Framing could soften shift.

**Action buttons:** "Set as default" and "Keep current route" land with friction. "Keep current route" is dismissive path but framed as active choice, not passive dismiss ("Not now"). Unnecessary cognitive weight on zero-friction exit.

**Overall arc:** Relief → satisfaction → mild obligation → mild confusion. Satisfaction beat strong. Obligation and confusion beats need softening to honor Steady Companion register.

## What's Working

**1. Title register is correct.** `typography.title1Regular` on "Trip Summary" applies Held-Question Rule per `.cursorrules` — right weight for modal that is presenting, not commanding. Comment explicitly cites this choice.

**2. Accessibility announcement is thoughtful.** `useEffect` building composite VoiceOver announcement from all screen data segments is ahead of standard practice. Screen-reader users get full arrival summary immediately.

**3. Tap targets on inference buttons compliant.** `inferenceBtn` explicitly `width: 44, height: 44, borderRadius: 22` — check and X icons 18pt inside 44pt painted target. `tapTarget44` token would be cleaner but local repro gets measurement right.

## Priority Issues

**[P0] Silent failure on community report submission**
- What: `handleAccept` flips inference to `'accepted'` optimistically then calls `addCommunityReport` in try/catch that swallows all errors silently. If AsyncStorage fails or API call fails, user sees "Confirmed" permanently. Community report never lands. No error state, no retry, no visual signal.
- Why it matters: This is the countermapping loop — thesis mechanism by which lived validation feeds future routing. Silently-failed confirmation is phantom contribution. User believes they helped; next driver never benefits. Trust claim ("it helps the next driver") violated by implementation.
- Fix: Replace silent catch with at minimum `AccessibilityInfo.announceForAccessibility('Report could not be saved. Try again later.')` and visual fallback — either revert inference to `'pending'` (allowing retry) or render error state next to Confirmed label. Optimistic-then-rollback more honest than optimistic-and-silently-fail.

**[P1] "Set as default" CTA is a mental model mismatch**
- What: Primary CTA in footer is "Set as default." Language does not appear anywhere else in app. Action marks destination as "regular" in `useRegularDestinations`, which feeds home screen's `isRegularLocation` underline. Label gives user no indication of what they're setting as default.
- Why it matters: User arriving home and seeing "Set as default / Keep current route" would reasonably interpret as choice about routing algorithm, GPS preference, transit mode — not bookmarking frequent destination. Borrows language from settings screens and drops into moment where user needs arrival-register language.
- Fix: Replace "Set as default" with consequence-surfacing language: "Save [destination] as a regular" or "Remember this destination" or "Mark as a frequent stop." Replace "Keep current route" with "Done" or "Not now."

**[P1] Accept button color violates color system**
- What: `inferenceBtnAccept` uses `backgroundColor: colors.wiltedgreen`. Wiltedgreen defined in design system as *secondary CTA* color — darker, quieter, used for "secondary / atmospheric headers." Correct affirmative-action color is `colors.freshgreen`.
- Why it matters: Reserved-color rule's discipline only works if green family internally consistent. Using wiltedgreen for positive confirmation introduces second meaning for token — both "secondary CTA" and "affirmative confirmation" — eroding semantic clarity.
- Fix: Change `inferenceBtnAccept.backgroundColor` from `colors.wiltedgreen` to `colors.freshgreen`. Update `inferenceResultAccepted.color` correspondingly.

**[P2] Inference framing inverts consequence and ask**
- What: Section reads: heading "Did we get this right?" → sub-copy "Confirming adds your report to the community map — it helps the next driver." → inference list items. Consequence disclosed *after* question is posed, not before.
- Why it matters: For user to give informed consent to community report, they need to understand stakes before they see confirmation buttons. Asks first, explains second — pattern that produces accidental submissions.
- Fix: Reorder: sub-copy first (reframed: "These are the areas we flagged on your route. Confirming sends a report to the community map.") → then list items. Move or remove "Did we get this right?"

**[P2] No scroll affordance with hidden indicator**
- What: `showsVerticalScrollIndicator={false}` suppresses scroll bar. On trip with all four inferences, content likely overflows viewport — no visual cue list continues below.
- Why it matters: Users who accept/reject first two inferences and tap "Set as default" may not know two more items waiting below fold. Missed confirmations are silent loss in community knowledge.
- Fix: Restore `showsVerticalScrollIndicator` to default, or add subtle gradient fade at bottom of scroll region.

**[P3] No "Confirm all" shortcut for inference list**
- What: Each inference requires two taps (one for check button, button itself). Four inferences = four interactions before user can exit. No batch-confirm path.
- Why it matters: Thesis frames community knowledge as first-class routing signal. Friction on confirmation reduces submission rate, starves community map.
- Fix: Add "Confirm all" text button (`type="transparent"`, `colors.freshgreen`) above inference list, visible only when two or more inferences pending.

## Persona Red Flags

**Sam (accessibility):**
`AccessibilityInfo.announceForAccessibility` call on mount is genuinely good. However: (1) Inference accept/reject buttons have clear `accessibilityRole="button"` and labels. (2) `inferenceResult` Text has `accessibilityLiveRegion="polite"` correct. (3) `statValue` blocks (duration, distance) have no `accessibilityLabel` — label reads as raw text. Screen reader navigating linearly will read "47 min" then "time" as two separate items without parent association. (4) Title has `accessibilityRole="header"` correct.

**Casey (distracted mobile):**
Casey is driving, glances at modal after parking. Inference buttons at 44pt pass tap-target test, but layout places reject (X) and accept (check) side by side with only `spacing.sm` (8pt) between them — 8pt gap between 44pt circles. On small device or for large thumb, insufficient for confident tap differentiation. Accept on right (dominant-hand side for right-handed) correct placement, but proximity makes misfires likely.

**Black driver assessing safety in a charged moment:**
"Increased police presence" inference label, followed by accept button submitting community report tagged `'felt-unsafe'` with detail text "Confirmed on a recent trip: increased police presence along this route," is doing important thesis work. Mapping intentional and on-thesis. However, semantic gap: label says "Increased police presence" (neutral-descriptive) but report uses category `felt-unsafe` (evaluative). User has not been told they are confirming that they *felt unsafe* — only that police were present. For driver with mixed feelings about encounter, silent semantic translation is trust issue.

## Minor Observations

- `METERS_PER_MILE = 1609.34` constant local. If `formatDistance` lives in `lib/format.ts` and also converts, may be duplicate worth checking.
- `DragHandle` wrapper uses asymmetric padding (4pt top, 8pt/16pt bottom). Worth confirming against Figma `825:4908`.
- `inferenceRow` uses `borderTopWidth: 1` on every row — first row has separator above it, no bottom separator on last row. Visual ambiguity.
- `statLabel` text ("time" / "distance") lowercase. Consistent with earthy, non-corporate register. Fine.
- `Inference.latitude` and `Inference.longitude` required fields typed as `number` but come from URL params. Defensive parsing in place, but no validation that values are finite numbers before passing to `addCommunityReport`. Malformed inference could pass `NaN` coordinate.

## Questions to Consider

1. What is expected state when user has no inferences? Currently shows only stats and two CTA buttons — is "Set as default / Keep current route" right framing when there was nothing to validate?
2. Is "Set as default" right moment for this action? C12c description says "first frequency signal" suggests arrival is intentional, but UX frame for why *right now* isn't surfaced.
3. Should inference section appear before or after stats? Thesis would argue countermapping feedback more load-bearing than trip receipt. Inverting order may improve submission rate.
4. What does screen look like with very long destination label? `destination` Text has no `numberOfLines` clamp.
5. Is the `wiltedgreen` inference-accept color deliberate Figma spec? If so, document carve-out; if not, fix to freshgreen.
