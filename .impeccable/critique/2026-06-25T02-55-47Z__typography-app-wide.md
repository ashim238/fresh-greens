---
target: app-wide (Jost + Libre Franklin rollout)
total_score: 31
p0_count: 0
p1_count: 3
timestamp: 2026-06-25T02-55-47Z
slug: typography-app-wide
supersedes: theme-typography-ts (token-only scope was too narrow)
---
## Scope

App-wide pass for the Jost + Libre Franklin rollout: all 28 routes under `app/`, shared `components/`, font load plumbing (`hooks/useAppFonts.ts`, `app/_layout.tsx`), and Dynamic Type compliance. Corrects the prior snapshot scoped only to `theme/typography.ts`.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Splash gates fonts; no load-failure UI |
| 2 | Match System / Real World | 4 | Jost/Franklin split reads on brand surfaces (login, menu, settings) |
| 3 | User Control and Freedom | 4 | — |
| 4 | Consistency and Standards | 2 | **Systemic `dynamicType` gap**: ~80 raw `...typography.*` spreads vs ~200 wrapped; worst on `/pulled-over` |
| 5 | Error Prevention | 3 | Font load failure unhandled |
| 6 | Recognition Rather Than Recall | 4 | Display vs body register clear where tokens are used correctly |
| 7 | Flexibility and Efficiency | 3 | Single ramp; held-question Jost vs Franklin undecided on device |
| 8 | Aesthetic and Minimalist Design | 4 | Pairing works; tightened Jost tracking helps hero screens |
| 9 | Error Recovery | 2 | `/pulled-over` mixes scaled guidance bullets with fixed-size Jost titles — hierarchy breaks at AX5 |
| 10 | Help and Documentation | 4 | DESIGN.md updated; Figma still SF Pro |
| **Total** | | **31/40** | **Good tokens, uneven app-wide application** |

## Audit Dimensions (app-wide)

| Dimension | Score | Notes |
|-----------|-------|-------|
| Accessibility (Dynamic Type) | 2/4 | `Button.tsx` + `/pulled-over` + `/home` chips bypass `dynamicType`; WCAG 1.4.4 gap at highest-traffic controls |
| Responsive / stress layouts | 2/4 | Pulled-over inverted hierarchy at AX5; report modal titles fixed |
| Theming / token discipline | 4/4 | Choke-point rollout; no inline hex/fontSize in ramp (exempts tagged) |
| Performance | 3/4 | 7 font files; splash gate acceptable; no fallback path |
| Anti-patterns | 4/4 | Not AI slop; application debt is pre-existing compliance holes |

**Audit total: 15/20** — ship-worthy brand change; compliance pass is the follow-up.

## Anti-Patterns Verdict

**Not AI slop** at the brand level. **Application slop** at the compliance level: the token system is clean, but large surfaces still bypass `dynamicType()` — a pre-existing debt the font change makes visible (Franklin on every non-scaling CTA and chip).

**Detector:** `detect.mjs` on `app/` + `components/` returned **0 findings** (no web/CSS slop patterns).

**Browser visualization:** N/A — RN native fonts.

## Overall Impression

The architecture decision was right: load fonts once, assign families in `theme/typography.ts`, and let ~200 call sites pick up Jost/Franklin without a 28-route edit marathon. On device, the **register split lands** — Jost on login/get-started/menu name feels wayfinding-confident; Franklin on settings and body copy feels human and readable.

What the token-only critique missed: **compliance is not uniform**. The same user who gets scaling Franklin on `/fuel` Save (via `dynamicType` on surrounding copy) hits fixed Franklin on every primary CTA (`Button.tsx`), fixed Jost titles on `/pulled-over`, and fixed caption chips on `/home` route preview. That inconsistency is now *more* visible because custom fonts replaced system fallbacks — there's no silent "maybe iOS scaled it" anymore.

Score drops from 33 (token file) → **31 (app-wide)** because Consistency and Error Recovery heuristics reflect real surface-level failures, not token design.

## App-Wide Inventory

### Token pickup (automatic — good)

~200 `dynamicType(typography.*)` call sites across routes and components. Strong coverage on: `/fuel`, `/insurance-setup`, `/roadside`, `/safety-settings`, `/legal`, `/search`, `/trip-summary`, `/login`, `/get-started`, `/menu` (partial).

### Raw `...typography.*` spreads (no Dynamic Type — gap)

| Location | Raw | `dynamicType` | Risk |
|----------|-----|---------------|------|
| **`app/pulled-over.tsx`** | **35** | 6 | **P1** |
| **`app/home.tsx`** | **15** | 8 | **P1** |
| **`components/Button.tsx`** | **1** | 0 | **P1** (all CTAs) |
| **`app/report.tsx`** | **8** | 6 | P2 |
| **`components/HomeBrowseSheet.tsx`** | **6** | 13 | P2 |
| **`app/en-route.tsx`** | **5** | 11 | P2 |
| `app/emergency.tsx` | 2 | 7 | P3 (`sosCountdown` exempt) |
| `app/trusted-contact-setup.tsx` | 2 | 3 | P3 |
| `app/permissions.tsx` | 1 | 3 | P2 |
| `app/recordings.tsx` | 1 | 5 | P2 |
| Map markers (`EdgeIndicator`, `ClusterMarker`, `EnRouteZone`) | 3 | 0 | P3 |

### Jost surfaces (verify on device)

| Screen | Jost tokens | Notes |
|--------|-------------|-------|
| `/login`, `/get-started` | `largeTitleEmphasized` | Brand entry |
| `/menu` | `title1Emphasized` (name) | 28pt not 34pt |
| `/trusted-contact-setup` | `largeTitleEmphasized` | |
| `/pulled-over`, `/safety`, `/trip-summary` | `title1Regular` / `title1Emphasized` | Held-question in geometric Jost — test tone |
| `/emergency` | `sosCountdown` ExtraBold | |
| `/en-route` | `largeTitleEmphasized` (ETA) | |

### Franklin surfaces

Settings tree, forms, body copy, chips, `/fuel`, `/insurance-setup`, most map sheet prose.

### Exempt surfaces

| Surface | Current | Verdict |
|---------|---------|---------|
| Speed-limit disc (`en-route`) | System sans, raw `fontSize` | Correct |
| Lifeline avatar 44pt | Franklin Bold via `title2Emphasized` | Drift — consider Jost or system |
| `sosCountdown` | Jost ExtraBold, no `dynamicType` | Correct (fixed disc) |

## What's Working (app-wide)

1. **Choke-point rollout** — one change propagates across onboarding, settings, safety, map sheets.
2. **Settings register** — Franklin on `/fuel`, `/insurance-setup`, `/menu`, `/safety-settings` feels cohesive.
3. **Brand entry** — Jost on login/get-started/menu name delivers wayfinding confidence.
4. **Exempt speed signage** — system font on speed disc beside Jost SOS preserves regulation metaphor.

## Priority Issues

**[P1] `components/Button.tsx` — all CTA labels skip `dynamicType`**
- Blast radius: every Save, Continue, Go, primary action.
- Fix: `...dynamicType(typography.bodyEmphasized)` on label style.

**[P1] `app/pulled-over.tsx` — 35 fixed token spreads on highest-stress surface**
- Jost titles fixed; Franklin guidance bullets scale (`relaxedLineHeight` + `dynamicType`).
- At AX5, body outgrows headlines — inverted hierarchy during traffic stop.

**[P1] `app/home.tsx` — 15 fixed spreads on route-preview / chips / browse metadata**
- `caption1*` / `footnote*` at fixed 12–13pt; thesis-critical hazard briefing should scale.

**[P2] `app/report.tsx` + `components/HomeBrowseSheet.tsx`** — 8 + 6 raw spreads.

**[P2] `app/en-route.tsx`** — turn banner `title3Emphasized`, caption chips on driving surface.

**[P2] Font load failure** — `_layout.tsx` returns `null` indefinitely.

**[P2] Lifeline avatar** — Franklin at 44pt on exempt surface.

**[P2] Figma** — text styles still SF Pro (`7DDh6c7tk7OKF4WiA7pEkp`).

**[P3] Map marker labels** — fixed caption/subheadline on map chrome.

## Persona Red Flags

**Sam:** Button + pulled-over + home chips = three Dynamic Type failures in one session.

**Jordan:** Report modal fixed Jost/Franklin titles may clip with long Dynamic Type on small phones.

**Casey:** Pulled-over fixed Jost titles while scrolling scaled guidance — stress + large text combo failure.

**Morgan:** Home route-preview chips not scaling undermines low-vision auditability of hazard briefing.

## Recommended Fix Order

1. `Button.tsx` — one file, entire app CTAs
2. `pulled-over.tsx` — wrap titles in `dynamicType` where layout allows
3. `home.tsx` — chip/footnote/caption spreads
4. `report.tsx` + `HomeBrowseSheet.tsx`
5. `en-route.tsx` — turn banner + chips
6. Lifeline exempt + font load hardening
7. Figma sync

## Questions to Consider

- Batch Dynamic Type pass as one PR ("typography compliance") vs per-surface?
- Move `title1Regular` to Franklin for held-question modals app-wide?
- Should map marker text stay fixed (legibility at map scale) or scale with system?
