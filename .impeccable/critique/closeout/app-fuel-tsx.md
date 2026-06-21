---
target: app/fuel.tsx
phase: closeout
total_score: 28
p0_count: 0
p1_count: 2
delta_score: +2
delta_p0: -1
delta_p1: 0
slug: app-fuel-tsx
---

## Phase 1 vs Closeout

| | Phase 1 | Closeout | Δ |
|---|---|---|---|
| Total | 26/40 | 28/40 | +2 |
| P0 | 1 | 0 | -1 |
| P1 | 2 | 2 | 0 |
| P2 | 3 | 3 | 0 |
| P3 | 1 | 1 | 0 |

**What changed:** PR #244 lands `canSave = !saving && !(distanceEnabled && rangeMiles === null)`, gating the Save Pressable's `disabled`, dim style, accessibility hint, and `accessibilityState.disabled`. This closes Phase 1's P0 (silent misconfig of distance reminders) cleanly and is the right shape — derived state at render time rather than a separate validity flag that can drift. The Heuristic 5 (Error Prevention) score moves from 2 → 4. Everything else from Phase 1 is unchanged: stepper still 1-tap-per-day, custom range still silently clamps, "Tank range" still engineering language, fill-row borders still freshgreen on unselected, Preferred Stations still buried below the reminder form, `handleCommitCustom` still doesn't close the input on valid commit.

**Why only +2 not +3 or +4:** The fix is correct but the surfacing is thin. Disabled state is `opacity: 0.7` on a freshgreen button — at default type that reads "loading" more than "blocked," and there is no visible reason-for-disable anywhere in the form. The `accessibilityHint` carries the explanation for VoiceOver, but a sighted user staring at a dim Save button has to infer that the tank-range bucket is the missing piece. Closing the trapdoor counts; signposting the trapdoor would have been the full point.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | "Next reminder: [date]" tells when, not where in cycle; no progress cue or mileage odometer readout; fill-fraction row still appears only after reminders are on AND profile is saved |
| 2 | Match System / Real World | 3 | "Tank range" is engineering language; drivers think "how far before I fill up?" — unchanged from Phase 1 |
| 3 | User Control and Freedom | 3 | Fuel-type change correctly clears bucket and shows note, but no undo; switching from Gas to Electric clears carefully-chosen bucket irreversibly |
| 4 | Consistency and Standards | 3 | RowGroup hairline separator inset assumes icon-bearing rows; fuel.tsx RowGroups are icon-less, so separator runs under blank space |
| 5 | Error Prevention | 4 | `canSave` now blocks Save when `distanceEnabled && rangeMiles === null` — P0 closed. Custom range still silently clamps to [20, 800] on blur; that's the only remaining error-prevention gap |
| 6 | Recognition Rather Than Recall | 3 | Fill-fraction footer explains the feature, but main "I filled up…" label gives no hint that fraction affects the next reminder date |
| 7 | Flexibility and Efficiency | 2 | Stepper still maxes at 60 days with no long-press acceleration or preset pills — 30-day cadence still 23 taps from default 7 |
| 8 | Aesthetic and Minimalist Design | 3 | Screen reads clean but conditional RowGroup for current state breaks rhythm; `showFuelChangeNote` inline note creates three consecutive text elements in same semantic register |
| 9 | Error Recovery | 2 | `handleCommitCustom` non-numeric branch still closes `customRangeOpen` silently with no message; valid-input branch still does not close the input (Phase 1 minor obs #6 — functional bug, unfixed) |
| 10 | Help and Documentation | 2 | No explanation of "Also use distance" until you turn it on; new `accessibilityHint` on Save is the first inline coaching anywhere on screen but only fires for VoiceOver |
| **Total** | | **28/40** | **Functional, needs UX polish** |

## Anti-Patterns Verdict

**Not AI slop.** Same verdict as Phase 1 — coherent information hierarchy, token discipline complete, BucketPill component thoughtful, no gratuitous decoration. The `canSave` addition stayed in style: a derived const with a four-line comment explaining the failure mode it prevents, wired into the existing Pressable rather than adding a sibling validation banner. That restraint is on-brand for the Steady Companion register.

**The fillBtn freshgreen-on-unselected drift from Phase 1 still stands** (lines 733–734). Compare BucketPill and segmentItem, which use `colors.separatorSubtle`. Same internal inconsistency, untouched.

## Cognitive Load

**Moderate on first visit, low on return.** Unchanged from Phase 1. The `canSave` fix does not reduce the decision count — it just prevents one of the decision paths from silently failing. Net cognitive cost is the same: car name, fuel type, reminders on/off, cadence, distance on/off, tank range.

One small improvement worth naming: a user who toggles distance on without picking a range now sees an unresponsive Save button. That is a soft prompt to look back at the form, which is correctly cheaper than a post-submit error alert. But because the disabled state is only `opacity: 0.7` with no inline "pick a range" text near the bucket pills, the prompt is weak — the cognitive load of "why won't this save?" is real even if briefer than "why aren't my reminders firing?"

## Emotional Journey

**Entering the screen** — Unchanged. Neutral-functional admin register, appropriate for Steady Companion.

**First-time setup** — Unchanged. Toggle reads as row label and switch with no surrounding coaching.

**After enabling reminders, toggling distance, not picking a range** — *Changed.* Phase 1: Save fires, profile silently persists no-op, user leaves believing distance reminders are armed. Closeout: Save is dim and unresponsive; pressing it does nothing. The emotional register here is "mild confusion" rather than "silent betrayal" — strictly better, but the user is now responsible for connecting "dim button" to "missing bucket pick." A sighted user with no VoiceOver gets no hint. A more complete fix would tint the disabled Save with a subtle helper string ("Pick a tank range") or scroll-anchor a callout to the bucket grid.

**After saving with reminders on** — Unchanged. Warmest part of screen.

**Preferred Stations section** — Unchanged. Still buried.

## What's Working

**1. `canSave` derivation is in the right place and the right shape.** Render-time derived const, not a separate validity state. Comment (lines 214–218) names the exact failure mode it prevents ("the engine sees a no-op"). Wired into `disabled`, dim style, `pressed && canSave && pressedDim` (correctly suppresses press dim while disabled), `accessibilityState.disabled`, and `accessibilityHint`. Five touchpoints, all consistent. This is the kind of small fix that holds up under future refactors because the invariant lives next to the render.

**2. `accessibilityHint` carries the reason-for-disable** ("Pick a tank range to enable Save"). VoiceOver users get the coaching the sighted UI is missing. Good a11y instinct; now mirror it for sight.

**3. BucketPill selected state is thorough.** Unchanged from Phase 1.

**4. Fuel-type change reset is principled.** Unchanged from Phase 1.

**5. Token discipline is complete.** Unchanged from Phase 1.

## Priority Issues

**[P1] Disabled Save has no sighted-user explanation**
- What: `canSave === false` produces `opacity: 0.7` on a freshgreen button with no inline copy near the bucket grid, near the Save button, or in the distance RowGroup footer. The footer copy that *would* be a natural home ("Reminders fire on your schedule OR after this many in-app navigated miles…") is gated on `enabled && distanceEnabled` and does not mention that a range is required.
- Why it matters: Phase 1's silent-misconfig P0 became a quieter "why won't this save?" puzzle. Better, but Casey in a parking lot needs the cause surfaced where she is looking — the bucket grid — not encoded in button dimming.
- Fix: Add a one-line helper below the "Tank range" `fieldLabel` when `distanceEnabled && rangeMiles === null`: "Pick a range to use distance reminders." Same string the `accessibilityHint` paraphrases. Could re-use the `fuelChangeNote` style (already used for inline prompts above the bucket grid). Optionally also dim the Save with a subtle outline or stripe rather than pure opacity, so "disabled" reads differently from "loading."

**[P1] Stepper has no acceleration — 30+ day cadences require many taps**
- Carryover from Phase 1, unchanged. Stepper increments by 1 day per press. MIN=1, MAX=60. No long-press repeat, no direct text entry, no preset options. Casey's biggest frustration.
- Fix: Long-press acceleration OR preset pills (7d / 14d / 30d / custom) mirroring BucketPill.

**[P2] Custom range input still silently clamps and gives no bounds hint**
- Carryover from Phase 1. `MIN_RANGE = 20`, `MAX_RANGE = 800`. Placeholder is "e.g. 320." No inline "(20–800 mi)" hint; user typing "1000" sees value silently clamp to 800 on blur.
- Fix: Range hint below input, and surface the clamp when it happens.

**[P2] "Tank range" is engineering language; section needs plain-language reframe**
- Carryover from Phase 1. Drivers think "how far before I fill up?", not "what is my tank range?"
- Fix: Rename to "How far before you refuel?" or "Range before empty."

**[P2] Fill-fraction row uses freshgreen borders on unselected state**
- Carryover from Phase 1. `fillBtn`: `borderColor: colors.freshgreen` (line 734) on unselected. Every other pill-like control uses `colors.separatorSubtle`.
- Fix: Change unselected `fillBtn` borderColor to `colors.separatorSubtle`.

**[P2] Preferred Stations buried below reminder form with no navigational anchor**
- Carryover from Phase 1. Driver entering specifically to manage trusted stations must scroll past all reminder controls.
- Fix: Pull into own screen, or add full-width section break.

**[P3] RowGroup separator inset assumes icon-bearing rows; fuel.tsx has none**
- Carryover from Phase 1. Every hairline runs under 52pt of empty space.
- Fix: RowGroup `separatorInset` prop.

## Persona Red Flags

**Sam (accessibility, Dynamic Type, deliberate language processing):**
The new `accessibilityHint` on Save is a real win for Sam — first inline coaching on the page, fires precisely when needed (`distanceEnabled && rangeMiles === null`). Everything else from Phase 1 carries: stepper `stepValue` `minWidth: 72` not AX5-constrained, stepper row `gap: spacing.lg` could visually separate Minus/Plus from value at AX5, `customRangeUnit` "mi" not paired with input's accessible label.

One new note: the disabled Save still announces `accessibilityState={{ disabled: true }}` correctly, and the hint reads on focus. VoiceOver users now get a better experience than sighted users on this exact failure path — a small accessibility inversion worth fixing by surfacing the hint visibly too.

**Casey (distracted mobile user, one-handed thumb reach):**
Casey's failure mode shifts from "silent misconfig" to "unresponsive button." Better, but she still has no inline prompt directing her to the bucket grid. A dim Save in a parking lot, with the cause two scroll-screens up, is still a friction point. 1-day-increment stepper still her biggest cumulative frustration.

**Black driver assessing safety in a charged moment:**
Unchanged from Phase 1 — screen unlikely to be visited in a charged moment. Preferred Stations placement still signals misplaced priority. No reserved-color violations; no orange/red/yellow/navy on this surface. Correct — not a safety-signaling surface.

## Minor Observations

1. `accessibilityRole="button"` on fuel-type segment items — still effectively radio buttons. Phase 1 obs unchanged.
2. `StatusBar style="dark"` hardcoded — appropriate.
3. `Trash` icon weight `"regular"` on station remove — Phase 1 obs unchanged.
4. `nextLabel` `toLocaleDateString` accessibility — Phase 1 obs unchanged.
5. Footer on fill-fraction RowGroup voice ("us" vs second-person) — Phase 1 obs unchanged.
6. `handleCommitCustom` does not close `customRangeOpen` on *valid* input (lines 277–290). Phase 1 obs #6 — functional bug, still unfixed. Worth pairing with the P2 custom-range work since both live in the same handler.
7. New: `pressed && canSave && pressedDim` on Save (line 582) — correct AND-gating so the press-dim doesn't compound with disabled-dim. Easy to miss in review; good instinct.
8. New: `disabled={!canSave}` correctly uses the derived const rather than re-deriving inline, so future logic additions (e.g. "block when carName too long") extend by editing one expression.

## Questions to Consider

1. Should the helper text live next to the bucket grid or next to the Save button? Next-to-grid is where the action is needed; next-to-button is where the user is looking when they hit the wall. A case for both, with the grid version being the primary.
2. Is `opacity: 0.7` strong enough disabled affordance on a freshgreen button? Compare with a desaturated/outlined disabled state.
3. Should `canSave` also block when `enabled && cadenceDays` is at MAX or MIN with no recent change — i.e. did the user actually intend that value? Probably not; that would over-validate. Mention only because the current `canSave` covers exactly one invariant and naming it `canSave` invites future invariants to accrete here. Worth a comment to keep the scope tight.
4. Carryovers from Phase 1: "I filled up" discoverability, Preferred Stations scope, blank-cadence semantics, fuel-change note dismissibility, EV fill-fraction semantics. All still open.
