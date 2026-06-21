---
target: app/roadside-setup.tsx
phase: closeout
total_score: 26
p0_count: 1
p1_count: 2
delta_score: +1
delta_p0: 0
delta_p1: 0
slug: app-roadside-setup-tsx
---

## Phase 1 vs Closeout

| | Phase 1 | Closeout | Δ |
|---|---|---|---|
| Total | 25/40 | 26/40 | +1 |
| P0 | 1 | 1 | 0 |
| P1 | 2 | 2 | 0 |
| P2 | 3 | 3 | 0 |
| P3 | 1 | 1 | 0 |

**What changed:** Two things between Phase 1 and closeout — neither addresses the Phase 1 priority gaps.

1. **PR #242 added `accessibilityHint="Saves your roadside service profile"` on the Save Pressable** (line 142). This is the hint-depth Phase 2 convention, and it is correctly action-describing rather than redundant with the label. But Phase 1's Sam red-flag asked for a different hint — `"Enter a service name and phone number to enable"` — i.e. a *reason-for-disable* hint that resolves the silent-validation pain for VoiceOver users. The shipped hint describes what Save does when enabled, not why it is dimmed when disabled. It also does not vary with `accessibilityState.disabled`, so a VoiceOver user who lands on a dimmed button still hears "Save, button, dimmed, saves your roadside service profile" — which describes the success path, not the blocker. Heuristic 9 (Help Users Recognize, Diagnose, Recover) ticks 2 → 3 because *some* coaching now exists, but the silent-validation root cause is unfixed.

2. **PR #2 (Sprint 1 P-B inline-error pattern) was referenced in scope but did NOT land on this screen.** Save still returns silently when `!canSave`; there is no `touched` state, no inline `colors.red` error message under the phone field, no copy explaining why Save is dim. The pattern shipped on /trusted-contact-setup and /zone-preferences; roadside-setup was not adapted. This is the single largest gap from Phase 1 still open.

3. **Internal refactor: `useMutation` replaced the `saving` useState** (line 47-48). Clean internal cleanup — `saveMutation.status === 'pending'` derives `saving`, and the catch path no longer needs to manually `setSaving(false)` because `useMutation` tracks error state. Phase 1 minor obs #4 ("`setSaving(false)` in catch block is only path that re-enables button — fragile") closes silently. No visible UX delta, no score movement, but the fragility note from Phase 1 is gone.

**Why only +1:** The P0 (missing wiltedgreen border on Save CTA — `fuel.tsx` has it, roadside-setup does not, freshgreen-on-white is 2.88:1 against page edge) is untouched. Both P1s (keyboard flow regression, silent validation) are untouched. All three P2s (input border token mismatch, disabled fill using border token, inline marginTop fighting gap) are untouched. The P3 (no `textContentType` for QuickType autofill) is untouched. The +1 is entirely Sam catching slightly less friction from VoiceOver now that *some* hint exists on the CTA.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Save still has `saving` loading guard via `useMutation.status` but disabled CTA still gives no inline reason; no spinner overlay — unchanged from Phase 1 |
| 2 | Match Between System and World | 3 | "Service name" + "Phone number" accurate; "Roadside service" title still bare for first-time user — unchanged |
| 3 | User Control and Freedom | 3 | Back chevron with `tapTarget44` works; no undo on save; no in-screen clear — unchanged |
| 4 | Consistency and Standards | 2 | Wiltedgreen CTA border still missing (DESIGN.md §5); `cardBorderSubtle` still used as both input border and disabled CTA fill — token-identity bleed unchanged |
| 5 | Error Prevention | 2 | Silent validation unchanged — Save still returns immediately when `!canSave` with no inline feedback; no `returnKeyType` chaining still |
| 6 | Recognition Rather Than Recall | 3 | Field labels self-describing; phone-pad keyboard helps; format-agnostic phone validation correct — unchanged |
| 7 | Flexibility and Efficiency | 2 | No `returnKeyType`, no `onSubmitEditing` chaining, no `textContentType`, no `ref` forwarding — unchanged |
| 8 | Aesthetic and Minimalist Design | 3 | Heavier input border (`cardBorderSubtle` 30%) still reads slightly clinical vs `separatorSubtle` (10%) on sibling /fuel — unchanged |
| 9 | Help Users Recognize, Diagnose, Recover | 3 | PR #242 added `accessibilityHint` on Save — first inline coaching on screen, but hint describes success path not disable reason; visual silent validation still cold |
| 10 | Help and Documentation | 2 | No orienting sub-copy for first-time user; thesis-grounding line ("Your service's direct line — used to call for help if you need it.") still absent — unchanged |
| **Total** | | **26/40** | **Acceptable — Phase 1 gaps largely intact; one a11y polish landed** |

## Anti-Patterns Verdict

**Pass on reserved colors in interactive chrome** — unchanged from Phase 1. CTA freshgreen, back chevron `colors.black`, no orange/red/yellow/navy decoratively.

**Flag on disabled CTA carries forward.** `ctaDisabled: { backgroundColor: colors.cardBorderSubtle }` at line 196-198 still uses input-border token as button fill. Not a reserved-color violation but token-identity bleed — `cardBorderSubtle` semantically means "card/input outline," not "inactive state fill." `fuel.tsx` achieves the same disabled look via lowered opacity on enabled state. Untouched.

**Flag on input border carries forward.** `styles.input` still uses `borderColor: colors.cardBorderSubtle` (`rgba(0,0,0,0.3)`) at line 184. Sibling `fuel.tsx` uses `colors.separatorSubtle` (`rgba(0,0,0,0.1)`). Heavier weight, same drift Phase 1 named. Untouched.

**Not AI slop.** Code is coherent — the `useMutation` refactor is restrained and well-shaped (derives `saving` from status, deletes the stale catch-block `setSaving(false)`, preserves the meaningful comment about retry). Header docstring still useful. The screen feels owned, not synthesized; the gaps are real gaps not generative artifacts.

## Cognitive Load

**Unchanged from Phase 1.** Low for the form footprint (two fields, one CTA), with the same keyboard-flow load spike — the user still walks through type → tap field → dismiss keyboard → tap Save because neither TextInput has `returnKeyType` or `onSubmitEditing`. `/fuel` does this correctly; roadside-setup is still the regression. PR #242's accessibilityHint addition does not touch the keyboard flow.

## Emotional Journey

**Entry:** Unchanged. Neutral, settings-modal pattern, no anxiety.

**Form fill:** Unchanged. Heavier input border still reads slightly clinical.

**First-time setup context:** Unchanged. No orienting sub-copy, no thesis grounding. Screen works but doesn't feel like Steady Companion spoke.

**Validation failure:** **Still the coldest moment on screen.** User types "AAA" and "800", taps grey Save button, gets silence. The accessibilityHint added in PR #242 helps VoiceOver users get *some* read on the button, but a sighted user still gets nothing — no inline error, no reason-for-disable copy near the phone field, no nudge that 7 digits is the minimum. Phase 1 named this gap explicitly and PR #2's inline-error pattern was designed to close exactly this shape of cold moment. It shipped to siblings but not here.

**Success:** Unchanged. `router.back()` on save still correct and clean.

## What's Working

Carries forward from Phase 1, plus one new item:

- Tap targets unchanged and correct (`tapTarget44`, `minHeight: 50` CTA, `minHeight: 44` inputs).
- KeyboardAvoidingView pattern unchanged and correct.
- Hydration latch + React 19 docstring comment unchanged and still useful.
- Token discipline complete — no inline hex, no inline font sizes.
- Format-agnostic phone validation unchanged and correct.
- **NEW:** `useMutation` refactor cleaner than the original `saving` useState. `saveMutation.status === 'pending'` derives `saving`, comment at lines 76-77 correctly explains why the catch-block `setSaving(false)` is no longer needed. Closes Phase 1 minor obs #4 silently.
- **NEW:** Save Pressable now has `accessibilityHint` — first inline coaching on the screen, even if it's only describing the success path.

## Priority Issues

**[P0] Missing wiltedgreen border on primary CTA** — *unchanged from Phase 1.*
- Lines 188-195: `styles.cta` has `backgroundColor: colors.freshgreen` with no border. DESIGN.md §5 specifies "Fresh Green fill, white label, e1 shadow, 1pt Wilted Green border (the contrast lift)." `fuel.tsx` implements it; roadside-setup omits it.
- Freshgreen (#41AD49) against white is 2.88:1 — below WCAG 3:1 floor for UI component boundaries.
- Fix: Add `borderWidth: 1, borderColor: colors.wiltedgreen` to `styles.cta`.

**[P1] No keyboard flow (returnKeyType / onSubmitEditing)** — *unchanged from Phase 1.*
- Lines 108-116, 121-129: neither TextInput has `returnKeyType`. No `ref` forwarding, no `onSubmitEditing` to advance or submit.
- `/fuel.tsx` does this correctly; roadside-setup is the regression.
- Fix: Add `ref={phoneRef}` on phone input. On service name: `returnKeyType="next"`, `onSubmitEditing={() => phoneRef.current?.focus()}`. On phone: `returnKeyType="done"`, `onSubmitEditing={handleSave}`.

**[P1] Silent validation — no inline error on failed Save attempt** — *unchanged from Phase 1; PR #2 pattern did not land here.*
- Lines 68-69: `handleSave` still returns immediately when `!canSave`. No `touched` state, no inline `colors.red` error below phone input, no reason-for-disable copy.
- Sprint 1 P-B inline-error pattern shipped to /trusted-contact-setup and /zone-preferences; roadside-setup was not adapted. Exception #8 in `.cursorrules` explicitly allows `colors.red` for inline form-validation errors — there is no rule blocking this fix.
- For a Black driver setting up roadside service before a trip (or worse, after pulling over to fix a missing profile), silent validation is more than friction.
- Fix: Track `touched.phone` (set true on `onBlur`). When `touched.phone && !phoneValid`, render small `colors.red` error below phone input ("Enter at least 7 digits"). Pair with reason-for-disable copy or update Save's `accessibilityHint` to vary with `canSave` (current hint describes success path only).

**[P2] Wrong input border token — `cardBorderSubtle` vs `separatorSubtle`** — *unchanged.*
- Line 184. Fix as Phase 1: `borderColor: colors.separatorSubtle`.

**[P2] `ctaDisabled` uses border token as button fill** — *unchanged.*
- Line 197. Fix as Phase 1: replace with opacity-on-CTA or `colors.fillsPrimary`.

**[P2] Inline `marginTop: spacing.lg` on phone label fights gap system** — *unchanged.*
- Line 118 still has the inline override. `body` view still has `gap: spacing.sm`. Mixed-spacing model unchanged from Phase 1.

**[P3] No `textContentType` for autofill** — *unchanged.*
- Lines 108-129. Neither input declares `textContentType` or `autoComplete`. Phone field misses QuickType bar suggestions from Contacts.
- Fix: Add `textContentType="organizationName"` + `autoComplete="organization"` to service name; `textContentType="telephoneNumber"` + `autoComplete="tel"` to phone.

## Persona Red Flags

**Sam (accessibility):** Improved but not closed. PR #242 added `accessibilityHint="Saves your roadside service profile"` on Save — Phase 1 had no hint at all on this Pressable. But the hint describes the success path, not the blocker; a VoiceOver user landing on the dimmed Save button still hears "Save, button, dimmed, saves your roadside service profile" without any clue that two fields need values. Phase 1's specific recommendation was `accessibilityHint="Enter a service name and phone number to enable"` (varying with `canSave`), which would tell the user *why* they're stuck. Inputs still have no hint about expected format (Phase 1's other Sam red-flag is untouched).

**Casey (distracted mobile):** Unchanged. Broken keyboard flow still the sharpest pain — four gestures for a two-field form, one-handed in a car.

**Black driver assessing safety in a charged moment:** Unchanged. Silent validation still the harm. The PR #2 inline-error pattern was designed for exactly this user moment and shipped to siblings but not to roadside-setup, the screen most likely to be hit under stress (pulled-over, "Set up your roadside service" CTA from /roadside Step 2).

## Minor Observations

Carries forward from Phase 1:
- `StatusBar style="dark"`, `SafeAreaView edges={['top', 'bottom']}`, header docstring, `autoCapitalize="words"`, `clearAll` exported but unused — all unchanged and still correct.

New since Phase 1:
- `useMutation` hook replaces local `saving` useState. Catch-path comment at lines 76-77 correctly notes the prior `setSaving(false)` was unnecessary. Phase 1 minor obs #4's fragility note closes.
- `getErrorMessage('save', 'transient', saveMutation.error)` replaces the inline Alert title/body string from Phase 1 — centralizes error copy, consistent with the error-message lib pattern shipping across other screens.

## Questions to Consider

Carries forward from Phase 1 (1, 2, 3, 5 still open). Q4 closes — `useMutation` now manages the re-enable path, so the fragility is gone.

1. Should first-time flow have orienting sub-copy below the title? Still open.
2. Is `minHeight: 44` on TextInputs enough at large Dynamic Type? Still open.
3. Should phone input do any live formatting? Still open; raw-digits-to-`tel:` still pragmatic.
4. ~~What happens if `saveProfile` throws from corrupted AsyncStorage?~~ Closed — `useMutation` re-enables Save via status tracking; no longer fragile.
5. Is "Save" right CTA label given the semi-urgent /roadside Step 2 entry path? Still open.

**New for closeout:**
6. Why did PR #2's inline-error pattern land on /trusted-contact-setup and /zone-preferences but not /roadside-setup? Roadside-setup is arguably the highest-stakes form on the silent-validation list — worth understanding whether this was scope-bound or oversight, since the gap is now visible across the codebase rather than uniform.
7. Should the `accessibilityHint` on Save vary with `canSave`? `disabled: "Enter a service name and phone number to enable"` / `enabled: "Saves your roadside service profile"`. One Pressable, two intents, cheap fix.
