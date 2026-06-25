---
target: app/roadside.tsx (+ components/RoadsideTowPick.tsx)
total_score: 31
p0_count: 0
p1_count: 1
timestamp: 2026-06-25T17-31-26Z
slug: app-roadside-tsx
round: 7
priority: NEW tow-pick step
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Tow-pick: progressive rows + footer spinner good; Locating… chip still only geocode signal on Step 1 |
| 2 | Match System / Real World | 4 | Four-step machine (problem → action → tow-pick → status) matches call-first distress model; distance in miles |
| 3 | User Control and Freedom | 4 | Step 3 X → back to actions; tow-pick has chevron back; `usePreventRemove` on status intentional |
| 4 | Consistency and Standards | 4 | "What they know" vertical rows + `subheadlineEmphasized` section label — closeout P1s closed; tow-pick matches row register |
| 5 | Error Prevention | 2 | Share toggle auto-advances to status on enable — accidental toggle skips action review; "I figured it out" still one-tap dismiss |
| 6 | Recognition Rather Than Recall | 3 | Tow rows show name + distance + address; muted Call + inline no-phone note is honest; 5 problem options on Step 1 |
| 7 | Flexibility and Efficiency | 3 | Tow-pick in-app replaces Maps handoff — major efficiency win; no fast path for repeat callers |
| 8 | Aesthetic and Minimalist Design | 3 | Tow rows dense but scannable; simulator error copy leaks dev framing to production UI |
| 9 | Error Recovery | 2 | WrongSpotModal still no in-card Cancel; call-path `Alert.alert` dead-end; tow-pick empty state mentions simulator |
| 10 | Help and Documentation | 3 | Tow row hints name Phone app outcome; setup redirect on missing roadside profile still mid-distress |
| **Total** | | **31/40** | **Good — tow-pick ships the thesis call-first path; error-prevention + recovery gaps remain** |

## Anti-Patterns Verdict

**LLM assessment**: No AI-slop tells. Tow-pick progressive reveal is the right calm-companion pattern (rows appear as enriched, not blank-then-pop). Muted Call button without `disabled={true}` preserves VoiceOver honesty.

**Deterministic scan**: Skipped (RN source).

**Visual overlays**: Browser injection skipped (RN source).

## Round 7 Delta (post PR #253 tow-pick merge)

| Prior finding | Status |
|---------------|--------|
| Step 3 dismissal trap | **Closed** — X + `onBackToActions` |
| "What you shared" past tense | **Closed** — "What they know" + labeled rows |
| "If this gets worse" weight | **Closed** — `subheadlineEmphasized/black` |
| Maps handoff for tow | **Closed** — in-app `tow-pick` step |
| WrongSpotModal Cancel | **Open** — still Confirm-only in card |
| Share toggle auto-advance | **Open** — toggling share jumps to status |

## Overall Impression

Tow-pick is the headline win: Mapbox rank + MKLocalSearch phone enrichment + progressive rows executes the grill-me spec. Status card now surfaces **Contacted** row for tow path. Remaining work is distress-moment guardrails (share toggle side effect, figured-it-out confirm) and production-facing error copy on tow-pick empty state.

## What's Working

- **Progressive tow rows** — `enrichPlacesWithPhoneProgressive` + footer spinner communicates batch in flight without blocking first callable result.
- **Muted Call + inline footnote** — gray button stays focusable; "No number on file" appears on tap with `accessibilityHint` on the button.
- **Status headline branches** — tow path ("Stay where you are") vs membership path (`{serviceName} should be on the way`) + Contacted row.

## Priority Issues

- **[P1] Share-location toggle auto-advances to Step 3 on enable.** `onShareToggle` calls `markActionTaken()` when `!actionTaken` — user may have only meant to arm sharing, not leave the action menu. **Fix**: decouple toggle from step advance; advance on explicit "Done" or first outbound notify only. **Suggested command**: `/impeccable harden app/roadside.tsx`
- **[P2] Tow-pick empty/error copy mentions simulator.** Line 74: "Set a simulator location (Features → Location)" — dev framing in user-facing error. **Fix**: user-facing copy only; dev note in `__DEV__` branch. **Suggested command**: `/impeccable clarify components/RoadsideTowPick.tsx`
- **[P2] WrongSpotModal no in-card Cancel.** Scrim tap works for sighted users; VoiceOver users lack explicit escape inside card. **Fix**: text Cancel button, 44pt, `labelSecondary`. **Suggested command**: `/impeccable harden app/roadside.tsx`
- **[P2] "I figured it out" one-tap `router.back()`.** Accidental dismiss in stress state. **Fix**: brief confirm Alert. **Suggested command**: `/impeccable harden app/roadside.tsx`
- **[P2] Five problem options on Step 1.** Cognitive load checklist fail (≤4). **Fix**: group "Won't start" + "Out of gas" under "Vehicle won't run" or accept as distress completeness. **Suggested command**: `/impeccable distill app/roadside.tsx`
- **[P3] `iconCircle` 36×36 below 44pt painted floor.** Row `minHeight: 60` compensates for row tap, not icon visual. **Suggested command**: `/impeccable polish app/roadside.tsx`
- **[P3] `accessibilityRole="link"` on Wrong spot?** Should be `button`. **Suggested command**: `/impeccable harden app/roadside.tsx`

## Persona Red Flags

**Casey (Distracted Mobile)**: Share toggle near thumb + auto-advance = accidental status jump while trying to notify contact.

**Sam (Accessibility)**: Tow-pick Call hints are good; WrongSpotModal trap remains.

**Riley (Stress Tester)**: Toggle share → back via X on status → share still on, action menu state unclear (intentional preserve vs leak).

## Minor Observations

- Tow-pick `titleBlock` uses `relaxedLineHeight` on headers — correct for stress-state sub-step.
- `locationCoords` null on tow-pick shows permission error — user may have denied on Step 1 without revisiting Wrong spot?.

## Questions to Consider

- Should enabling share require a confirm before advancing to status?
- When MK enrichment returns no phones for all rows, is membership-call row the only honest path — should UI say so?
