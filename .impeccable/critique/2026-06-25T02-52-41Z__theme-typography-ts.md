---
target: theme/typography.ts (Jost + Libre Franklin)
total_score: 33
p0_count: 0
p1_count: 1
timestamp: 2026-06-25T02-52-41Z
slug: theme-typography-ts
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Splash gates on font load; no user-visible fallback if `useFonts` fails |
| 2 | Match System / Real World | 4 | Jost reads wayfinding; Franklin reads human guidance — split matches thesis voice |
| 3 | User Control and Freedom | 4 | N/A for typography system |
| 4 | Consistency and Standards | 3 | Exempt surfaces inconsistent (speed limit = system, lifeline initial = Franklin, SOS = Jost); `Button` skips `dynamicType` |
| 5 | Error Prevention | 3 | No degraded-mode if font files fail to load |
| 6 | Recognition Rather Than Recall | 4 | Display vs body register is visually distinct at title2 boundary |
| 7 | Flexibility and Efficiency | 3 | Single ramp; no per-locale font fallback |
| 8 | Aesthetic and Minimalist Design | 4 | Pairing is intentional, not generic Inter; Jost tracking tighten helped |
| 9 | Error Recovery | 3 | Font-load failure leaves `null` root — no recovery path |
| 10 | Help and Documentation | 4 | `DESIGN.md`, `theme/fonts.ts`, learnings entry document the system |
| **Total** | | **33/40** | **Good — ship-worthy with targeted fixes** |

## Anti-Patterns Verdict

**Not AI slop.** Jost + Libre Franklin is a deliberate display/body split, not default Inter-on-cream. Token choke point (`theme/typography.ts`) keeps the system disciplined. Tightened Jost tracking (+0.12–+0.15) avoids the airy geometric-default look.

**Deterministic scan:** `detect.mjs` on `theme/typography.ts`, `theme/fonts.ts`, `hooks/useAppFonts.ts`, `app/_layout.tsx` returned **0 findings**.

**Browser visualization:** N/A — RN native fonts, no web render target.

## Overall Impression

The architecture is right: one load site, one token file, app-wide pickup without per-screen edits. The brand shift lands — Jost on hero/login/menu titles, Franklin on settings and body copy. The main gaps are **pre-existing Dynamic Type holes** now more visible because every CTA label is explicitly Franklin SemiBold, and **exempt-surface hygiene** (lifeline avatar inherited Franklin from `title2Emphasized`).

## What's Working

1. **Choke-point design** — `fontFamily` per weight file in `typography.ts`; no scattered `fontWeight` synthesis bugs (nested `<Text>` fixed to use `.fontFamily`).
2. **Role split** — Jost only on `largeTitle*`, `title1*`, `sosCountdown`; Franklin from `title2*` down matches the agreed plan.
3. **Docs track reality** — `DESIGN.md` §3, `.cursorrules`, and `docs/learnings.md` updated in the same window as code.

## Priority Issues

**[P1] `Button.tsx` CTA labels bypass `dynamicType()` — every primary action**
- What: `styles.label` spreads `...typography.bodyEmphasized` without `dynamicType()`. All `Button` primary/secondary labels app-wide do not scale with iOS Larger Text.
- Why it matters: Font change made labels explicitly Libre Franklin SemiBold; low-vision users lose WCAG 1.4.4 on the most-tapped copy in the app. Pre-existing, now brand-visible.
- Fix: `...dynamicType(typography.bodyEmphasized)` in `components/Button.tsx`.
- Suggested command: `/impeccable audit` then `/impeccable polish`

**[P2] Font load failure has no fallback**
- What: `_layout.tsx` returns `null` until `useFonts` resolves; no `onError` / timeout / system-font fallback.
- Why it matters: Corrupt cache or load error = indefinite blank after splash.
- Fix: Log in dev; on failure set `loaded=true` with system fallback flag, or show error `StateCard` with retry.
- Suggested command: `/impeccable harden`

**[P2] Lifeline avatar initial now renders in Franklin Bold, not system**
- What: `LifelineModal` `avatarText` spreads `typography.title2Emphasized` + `fontSize: 44`. Exempt comment says display-scale identity; `.cursorrules` exempt implied system/signage, but token is Franklin.
- Why it matters: Large single initial in body grotesque reads different from SF — minor brand drift on a high-visibility safety surface.
- Fix: Use `fonts.jost.bold` or omit `fontFamily` (system) on exempt style only.
- Suggested command: `/impeccable polish`

**[P2] Held-question modals use Jost Regular (`title1Regular`)**
- What: `/safety`, `/pulled-over`, `/trip-summary` prompts use geometric Jost at 28pt for "held question" copy.
- Why it matters: `.cursorrules` intent is softer voice; Jost Regular is still display geometry — may feel cooler than Franklin would on emotional prompts. Verify on device.
- Fix: If cold, switch `title1Regular` to Franklin Regular (same metrics) or add `title1RegularFranklin` token.
- Suggested command: `/impeccable typeset`

**[P2] Figma text styles not synced**
- What: Figma file `7DDh6c7tk7OKF4WiA7pEkp` still documents SF Pro in node styles.
- Why it matters: Design-code drift on next fidelity audit.
- Fix: Update Display → Jost, Text → Libre Franklin in Figma.
- Suggested command: manual design pass

**[P3] Safety surfaces spread raw `typography.*` without `dynamicType`**
- What: `app/pulled-over.tsx` (~15 styles), `app/report.tsx`, `app/en-route.tsx` `largeTitleEmphasized` — titles fixed-size while body uses `dynamicType`.
- Why it matters: At AX5, Franklin body grows but Jost/Franklin titles in pulled-over stay fixed — hierarchy inverts under load.
- Fix: Audit pulled-over/report title styles; wrap in `dynamicType` where layout allows.
- Suggested command: `/impeccable adapt`

**[P3] `permissions.tsx` recovery copy skips `dynamicType`**
- What: `settingsLinkPrompt` spreads raw `footnoteRegular`.
- Why it matters: Permission-denied recovery path stays 13pt when body above scales.
- Fix: `...dynamicType(typography.footnoteRegular)`.
- Suggested command: `/impeccable polish`

## Persona Red Flags

**Sam (accessibility):** Primary `Button` labels do not scale — blocks WCAG resize on Save, Continue, Go, and every CTA. `sosCountdown` correctly exempt from scaling (fixed disc). Tabular nums on Franklin should be verified on emergency countdown.

**Jordan (first-timer):** Jost on onboarding/login titles is confident and clear. Franklin chip labels at `caption1` (12pt) remain at readability floor — OK if informational only.

**Morgan (pre-stop planner):** Settings tree (`Franklin`) feels calmer than Welcome (`Jost`) — appropriate register shift. Insurance/manual forms in Franklin match fuel — consistent.

## Minor Observations

1. `SettingsHeader` `largeTitle` style uses `title1Emphasized` (28pt Jost), not `largeTitleEmphasized` (34pt) — intentional menu pass, naming is misleading.
2. `en-route` speed-limit numbers correctly stay system sans — good contrast with Jost SOS elsewhere.
3. Seven font files — reasonable; subsetting Latin could shrink bundle later.
4. Jost tracking could go one step tighter (0 → slight negative) if large titles still feel airy.

## Questions to Consider

- Should held-question modals move to Franklin Regular at 28pt instead of Jost?
- Is lifeline initial Jost, Franklin, or system?
- Wrap all `Button` labels in `dynamicType` in one PR before any further metric tuning?
