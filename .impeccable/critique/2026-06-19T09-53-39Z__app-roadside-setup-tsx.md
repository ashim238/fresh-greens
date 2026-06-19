---
target: app/roadside-setup.tsx
total_score: 25
p0_count: 1
p1_count: 2
timestamp: 2026-06-19T09-53-39Z
slug: app-roadside-setup-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Save state has `saving` loading guard but disabled CTA gives no inline indication of why; no spinner overlay |
| 2 | Match Between System and World | 3 | "Service name" + "Phone number" are accurate; "Roadside service" title bare for first-time user who doesn't know why this screen exists |
| 3 | User Control and Freedom | 3 | Back chevron with `tapTarget44` works; no undo on accidental save; no "clear all" affordance in-screen for users wanting to reset (lives in /menu) |
| 4 | Consistency and Standards | 2 | Missing the documented 1pt wiltedgreen border on primary CTA — DESIGN.md §5 explicitly specifies it; `cardBorderSubtle` used as input border (heavier than sibling `separatorSubtle` used in fuel.tsx); `cardBorderSubtle` used as disabled CTA fill — token-identity bleed |
| 5 | Error Prevention | 2 | Silent validation — Save button stays grey with no inline error when partial phone number entered; no `returnKeyType` chaining means keyboard flow broken |
| 6 | Recognition Rather Than Recall | 3 | Field labels self-describing once seen; phone-pad keyboard helps recognition; format-agnostic phone validation (`length >= 7`) is forgiving and correct |
| 7 | Flexibility and Efficiency | 2 | No keyboard flow (no returnKeyType, no onSubmitEditing chaining, no textContentType); user must manually dismiss keyboard and tap Save |
| 8 | Aesthetic and Minimalist Design | 3 | Clean form layout; heavier input border (`cardBorderSubtle` 30% opacity) reads slightly clinical compared to sibling `separatorSubtle` (10% opacity) used in fuel.tsx |
| 9 | Help Users Recognize, Diagnose, and Recover | 2 | Validation is silent — Save button just stays grey; no inline error message when user types partial phone number and taps Save; error boundary `Alert.alert` on `saveProfile` failure is solid |
| 10 | Help and Documentation | 2 | No orienting sub-copy for first-time user; "Your service's direct line — used to call for help if you need it." would ground the moment |
| **Total** | | **25/40** | **Acceptable — three concrete gaps (CTA contrast, keyboard flow, validation feedback)** |

## Anti-Patterns Verdict

**Pass on reserved colors in interactive chrome** — CTA freshgreen, back chevron `colors.black`, no orange/red/yellow/navy decoratively.

**Flag on disabled CTA:** `backgroundColor: colors.cardBorderSubtle` (`rgba(0,0,0,0.3)`) is input-border token repurposed as button fill. Not semantically wrong (no reserved-color violation), but token-identity bleed: `cardBorderSubtle` means "card/input outline," not "inactive state fill." `fuel.tsx` achieves same disabled look via lowered opacity on enabled state.

**Flag on input border:** Uses `colors.cardBorderSubtle` (`rgba(0,0,0,0.3)`) where `fuel.tsx` uses `colors.separatorSubtle` (`rgba(0,0,0,0.1)`). Heavier border weight (30% vs 10% black) visually inconsistent with sibling pattern and makes form look slightly more anxious than calm.

## Cognitive Load

Low for the form itself — two fields, one CTA, clear labels. Screen's footprint appropriate.

Load spike comes from keyboard flow. With no `returnKeyType="next"` on service name field and no `returnKeyType="done"` + `onSubmitEditing={handleSave}` on phone field, user must:
1. Type service name
2. Manually tap phone field
3. Dismiss keyboard manually
4. Tap Save

Four steps for two-field form. `/fuel` screen does this correctly. Roadside-setup is the regression.

## Emotional Journey

**Entry:** Neutral. Back chevron + title-only header consistent with settings-modal pattern (fuel, recordings, safety-settings). No anxiety generated.

**Form fill:** Heavier input border (`cardBorderSubtle`) reads touch more clinical than intended — closer to "sterile/clinical" anti-reference than earthier separatorSubtle the rest of the app uses.

**First-time setup context:** Screen gives no orientation. When user arrives from /roadside "Set up your roadside service" CTA, they already understand why they're here. But first-time user who encounters this screen cold — seeing just title and two inputs — gets no warmth, no "why this matters," no acknowledgment of thesis. Screen works, but doesn't feel like Steady Companion spoke.

**Validation failure:** User who types "AAA" and "800" and taps grey Save button gets silence. Button does nothing; no copy explaining why. **Coldest moment on screen.**

**Success:** `router.back()` on save correct and clean. No excessive ceremony needed.

## What's Working

- **Tap targets:** `tapTarget44` on back button correct. `minHeight: 50` on CTA over-delivers. `minHeight: 44` on inputs meets floor.
- **Keyboard avoidance:** `KeyboardAvoidingView` with `behavior="padding"` on iOS is right pattern.
- **Hydration latch:** `hydrated` guard in `useEffect` well-considered — prevents user edits being clobbered if profile re-resolves on refocus. Comment explaining React 19 rationale is good documentation.
- **Error boundary:** `try/catch` around `saveProfile` with `Alert.alert` fallback is solid. Re-enables Save button on failure (clears `saving`), so user can retry.
- **Token discipline:** No inline hex values, no inline font sizes. All values pulled from theme.
- **Validation logic:** `phoneNumber.replace(/\D/g, '').length >= 7` check format-agnostic and correctly handles international formats.

## Priority Issues

**[P0] Missing wiltedgreen border on primary CTA**
- What: Save button has `backgroundColor: colors.freshgreen` with no border. DESIGN.md §5 explicitly specifies: "Fresh Green fill, white label, e1 shadow, 1pt Wilted Green border (the contrast lift)." `fuel.tsx` implements this; roadside-setup omits it entirely.
- Why it matters: Freshgreen (#41AD49) against white is 2.88:1 contrast — below WCAG 3:1 floor for UI component boundaries. Button-to-page edge non-compliant. Tracked, documented requirement.
- Fix: Add `borderWidth: 1, borderColor: colors.wiltedgreen` to `styles.cta`.

**[P1] No keyboard flow (returnKeyType / onSubmitEditing)**
- What: Neither TextInput has `returnKeyType`. Service name field has no `onSubmitEditing` to advance to phone field. Phone field has no `onSubmitEditing` to trigger save. `ref` forwarding absent.
- Why it matters: Single most common mobile form usability failure. `/fuel.tsx` uses `returnKeyType="done"` and `onSubmitEditing`. Roadside-setup regresses pattern.
- Fix: Add `ref={phoneRef}` on phone TextInput. On service name: `returnKeyType="next"`, `onSubmitEditing={() => phoneRef.current?.focus()}`. On phone: `returnKeyType="done"`, `onSubmitEditing={handleSave}`.

**[P1] Silent validation — no inline error on failed Save attempt**
- What: When `canSave` false and user taps Save, `handleSave` returns immediately with no feedback. Button's grey disabled state communicates "not ready" but not "why not."
- Why it matters: Exception #8 in `.cursorrules` explicitly establishes inline form-validation errors as appropriate uses of `colors.red`. Without it, users left guessing. For Black driver setting this up before trip where roadside assistance actually matters, silent failure is more than UX friction point.
- Fix: Track `touched` state per field (set `true` on first `onBlur`). When `touched.phone && !phoneValid`, render small `colors.red` error message below phone input ("Enter at least 7 digits"). Only show errors after user has interacted with field.

**[P2] Wrong input border token — `cardBorderSubtle` vs `separatorSubtle`**
- What: `styles.input` uses `borderColor: colors.cardBorderSubtle` (`rgba(0,0,0,0.3)`). Sibling screens use `colors.separatorSubtle` (`rgba(0,0,0,0.1)`).
- Why it matters: Heavier border pulls form slightly toward "clinical/sterile" anti-reference. Inconsistency with `/fuel.tsx`'s input border pattern.
- Fix: Change to `borderColor: colors.separatorSubtle` in `styles.input`.

**[P2] `ctaDisabled` uses border token as button fill**
- What: `styles.ctaDisabled` sets `backgroundColor: colors.cardBorderSubtle`. Token's semantic identity is "card/input border outline," not "disabled state fill."
- Why it matters: Token-identity bleed makes future refactors hazardous.
- Fix: Replace with `backgroundColor: colors.fillsPrimary` or apply `opacity: 0.4` to whole CTA instead of swapping fill.

**[P2] Inline `marginTop: spacing.lg` on second field label**
- What: Phone number label has `style={[styles.fieldLabel, { marginTop: spacing.lg }]}` as inline override. `body` view has `gap: spacing.sm` which already drives sibling spacing. Override fights gap system.
- Why it matters: Gap property on flex container controls space between all direct children uniformly. Adding `marginTop` on specific child creates mixed-spacing model harder to reason about.
- Fix: Remove `gap: spacing.sm` from `styles.body` and replace with explicit `marginBottom` on each element, or wrap each field in labeled group `View` with no gap.

**[P3] No `textContentType` for autofill**
- What: Neither TextInput has `textContentType`. Phone field especially benefits from `textContentType="telephoneNumber"` — enables iOS's QuickType bar to suggest numbers from Contacts.
- Fix: Add `textContentType="organizationName"` (closest for service name) and `textContentType="telephoneNumber"` to phone input. Also add `autoComplete="tel"` for cross-platform parity.

## Persona Red Flags

**Sam (accessibility):**
VoiceOver reads both inputs as their `accessibilityLabel` alone with no hint about what format is expected. For phone field especially, user relying on VoiceOver has no hint that 7 digits is minimum. CTA reads "Save, button, dimmed" when disabled but gives no reason — add `accessibilityHint="Enter a service name and phone number to enable"` to Save Pressable. Title using `accessibilityRole="header"` correct. Dynamic Type fully covered via `dynamicType()`.

**Casey (distracted mobile):**
Broken keyboard flow is sharpest pain point. Filling in two fields one-handed while glancing at map or sitting in car already friction-heavy. Needing to dismiss keyboard manually between fields, then tap Save, is three extra gestures.

**Black driver assessing safety in a charged moment:**
Screen most likely used in calm pre-trip setup moment, not mid-incident — appropriate. Charged moment risk indirect: if screen never filled in before trip and user arrives at /roadside Step 2 to find no profile, pushed back to this setup screen. In that context — parked on shoulder, stressed — silent validation failure (typing partial number, hitting Save, nothing happening) genuinely harmful. Single line of sub-copy ("Your service's direct line — used to call for help if you need it.") would ground the moment.

## Minor Observations

- `StatusBar style="dark"` correct for white-background screen.
- `SafeAreaView edges={['top', 'bottom']}` correct for full-screen modal pushed from stack.
- Header comment thorough and useful — `tel:` URL note and validation philosophy worth keeping.
- `autoCapitalize="words"` on service name field nice touch — "AAA" and "Geico" render correctly from mixed-case input.
- `saving` guard in `canSave` prevents double-submission on slow async.
- `clearAll` exported from hook but unused on this screen — used by /menu for "remove" action.
- `hydrated` latch comment correctly explains React 19 migration rationale.

## Questions to Consider

1. Should first-time flow have orienting sub-copy? One line below title ("Your service's direct line — used to call for help if you need it.") would connect form to thesis without adding ceremony.
2. Is `minHeight: 44` on TextInputs enough at large Dynamic Type sizes? Input text may grow taller.
3. Should phone input do any live formatting? Current choice (no coercion, raw digits passed to `tel:`) pragmatic and defensible.
4. What happens if `saveProfile` throws from corrupted AsyncStorage? `Alert.alert` recovery correct. `setSaving(false)` in catch block is only path that re-enables button — fragile.
5. Is "Save" right CTA label? Given screen can be reached from /roadside in semi-urgent moment, consider "Save & go back" or leave as "Save."
