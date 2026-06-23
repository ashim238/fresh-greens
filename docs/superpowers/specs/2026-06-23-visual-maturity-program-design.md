# Visual Maturity Program — design spec

**Date:** 2026-06-23
**Author:** Myles Ashitey (w/ Claude)
**Status:** brainstorm-approved, awaiting plan
**Adjacent:** [Design Health Program](./phase-1-findings/2026-06-20-design-health-program-closeout.md) (predecessor, closed 2026-06-21)

---

## Problem

Fresh Greens has a coherent design system on paper — Figma-traced tokens, an iOS HIG type ramp, a four-tier shadow ramp, a reserved-color rule, tap-target geometry rules, dynamic-type support, reduce-motion respect — and the system is consistent across 25 shipped screens.

The system is **functionally correct** and **visually amateur**. Every surface is a solid white rectangle with the same shadow at the same depth. There is no translucency, no material hierarchy, no motion personality. The app reads as a competent React Native build, not as a native iOS app a designer cared about.

The thesis context makes this acute. Fresh Greens is a safety-navigation app for Black drivers. It is compared in passing to Waze and Apple Maps. The functional bar has been met. The craft bar has not.

## Goal

Move Fresh Greens from a Layer 1 visual register (solid surfaces, flat shadows, opacity-only press states) to a Layer 3 register (frosted material, color-aware depth, spring motion) in a single coordinated program. Preserve the "Steady Companion" brand voice — warm + knowing, never Waze-loud. Deliver an app that reads as deliberate craft in the thesis defense.

**Success criteria:**
- Every primary surface uses material (translucent + blur) over the map, not solid white.
- The category icon system has visual personality (squircle gradients, color-aware shadows), not generic Phosphor on a solid circle.
- Pressed states, sheet transitions, and at least three hero animations use spring physics, not opacity or linear timing.
- Density rhythm is regularized to a single 4pt grid (8/16/24/32) with no off-grid stragglers.
- Reduce-motion respected throughout (every spring has a fallback).
- The thesis viewer (and future pilot user) reads the app as polished, not as a prototype.

## Non-goals

- **Not** a feature redesign. Every screen keeps its current functionality and information architecture.
- **Not** a brand identity overhaul. Color tokens stay (`freshgreen`/`wiltedgreen`/`burntgreen`/`fadedgreen`), the reserved-color rule stays, the type ramp stays.
- **Not** a Waze-loud whimsy port. No cartoon characters, no cheeky copy passes, no bouncy animations. The warmth comes from material and motion physics, not from personality theater.
- **Not** a routing or map-engine change. Apple Maps stays; the material lives over it.

## Constraints

- React Native + Expo (managed). Any native module needed must be expo-config-plugin compatible.
- iOS-first; Android render fidelity is a non-blocker (the app is iPhone-first per `architecture.md`), but the system must not crash on Android.
- All animations under 400ms total duration.
- All material surfaces respect iOS's `prefers-reduced-transparency` (collapses to solid fallback).
- All motion respects `useReduceMotion()` (already in the project).
- The existing `.cursorrules` rulebook is not overridden — it gets *extended* (new tokens, new primitives), not contradicted.
- Cardinal tap-target rule (44pt painted minimum) stays intact across all new components.

## Architecture

### Three new token modules

The current theme directory has `colors.ts`, `typography.ts`, `spacing.ts`, `shadows.ts`, `interaction.ts`. The program adds three:

**`theme/materials.ts`** — surface materials. Each entry returns a render-ready object (or a JSX wrapper) for one material register. Tiers mirror Apple's `UIBlurEffect` styles, narrowed to what FG actually needs:

- `chrome` — over-map FABs, search bar in default state. Light blur (~12), high translucency (~0.85 white), 0.5pt hairline. Lifts off the map without obscuring it.
- `sheet` — bottom sheets (ReportDetailCard, ZoneDetailCard, HomeBrowseSheet, etc.). Heavier blur (~24), saturated (180%), translucent white at 0.78, 0.5pt top hairline. The sheet rises like frosted glass.
- `card` — embedded cards on light-gray pages (settings rows, recommendation cards). Lighter, less translucent — the page beneath isn't the map, so blur is decorative not functional.
- `modal` — full-screen modals over heavily-styled content (Lifeline, /emergency disc). Thick blur, dimmer scrim, suppresses background activity.

Each tier is implemented via `expo-blur`'s `BlurView` wrapped in a `MaterialSurface` component. Solid-fallback when reduce-transparency is on.

**`theme/radii.ts`** — squircle/radius scale. Currently radii are inlined (16, 28, 1000). New scale:

- `xs: 6` — chips, small pills
- `sm: 12` — squircle icons, small cards
- `md: 16` — standard cards (most current uses)
- `lg: 20` — primary content cards
- `xl: 28` — sheet top corners (matches current)
- `pill: 1000` — Buttons, SearchBar

**`theme/motion.ts`** — spring presets + duration scale. Currently animations are inlined in the components that have them (LandmarkMarker scale settle, avatar entrance spring). New module:

- Spring presets: `gentle` (tension 180, friction 14 — primary), `crisp` (240, 16 — for press states), `settle` (160, 18 — for arriving content)
- Duration scale: `instant: 100`, `quick: 200`, `standard: 300`, `relaxed: 400` (the ceiling per constraints)
- Easing curves for non-spring use: `easeOut` (standard iOS curve), `easeInOut` (for crossfades)

### Three new primitive components

**`components/MaterialSurface.tsx`** — the universal material wrapper. Wraps `expo-blur`'s `BlurView` with the FG-specific tier prop. Handles reduce-transparency fallback (renders a solid surface with the system's reduce-transparency token). Carries 0.5pt hairline border by default; overridable.

Props: `tier: 'chrome' | 'sheet' | 'card' | 'modal'`, `style?`, `children`. That's it.

**`components/SquircleIcon.tsx`** — replaces the current circle-with-glyph pattern used in LandmarkMarker, ReportDetailCard, and the report-picker tiles. Renders the glyph (existing SVG asset) on a squircle (12pt radius) with a gradient fill (`freshgreen → wiltedgreen` for positive, `orange → deeper-orange` for report, `black-owned` for that variant). Carries a color-aware drop shadow tinted to the gradient's primary color.

Props: `categoryId`, `size = 40`, `selected?`. Size determines the squircle dimensions and glyph size; selected modulates the gradient/glow strength.

**`hooks/useSpringPress.tsx`** — the universal press-down animation. Replaces inline `pressedDim` with a scale (0.97) + opacity (0.85) spring on press-in, return to 1.0/1.0 on press-out using the `crisp` preset. Reduce-motion respected.

Returns a style object suitable for `Animated.View`. Consumed by Button, FloatingActionButton, settings rows.

### Hero motion moments

Four motion set-pieces that ship with the program (Phase 3):

1. **Route line draws on** — when a route is selected from `RouteComparisonSheet`, the polyline animates from origin to destination over 700ms using the existing daylight gradient, revealing left-to-right. First moment every user experiences. Implementation: `Animated.Value` driving a stroke-dasharray on a custom `<Polyline />` overlay (react-native-maps doesn't support animated polylines natively; we add an `<Animated.Polyline>` wrapper or use an SVG overlay sized to the route bounds).

2. **Marker drop-in cascade** — when reports load (initial /home mount or after report submission), markers fall in from above with stagger (50ms between pins, bounce-free spring settle). Implementation: each `LandmarkMarker` accepts an `entranceIndex` prop and runs a `translateY` spring on mount. New mounts after initial load get a 0-index (no stagger). Existing mount-tracking ref handles the cohort.

3. **SOS countdown pulse** — the disc on /emergency breathes with the count, scaling 1.0→1.04→1.0 each second synced to the numeral tick. Adds emotional gravity; signals the system is alive and counting. Implementation: spring loop driven by the countdown timer.

4. **Trusted-friend trail afterglow** — when the trusted-friend marker's location updates, a soft green afterglow (radial gradient, alpha 0.3 → 0) fades over the last known position for ~1.5s. Pure warmth — costs almost nothing, communicates "we're keeping watch."

Each hero moment respects `useReduceMotion()` and degrades to instant state-swaps.

## Phase plan

The program ships in 4 phases over an estimated 10-13 sessions. Phases 1, 2, 3 can pipeline with care (overlap noted).

### Phase 0 — Audit + token foundation (1 session)

**Goal:** Establish the new tokens and primitive components so all later phases have a stable foundation. Diagnostic pass over current state.

**Outputs:**
- `theme/materials.ts`, `theme/radii.ts`, `theme/motion.ts` — three new token modules, fully typed.
- `components/MaterialSurface.tsx`, `components/SquircleIcon.tsx`, `hooks/useSpringPress.tsx` — three new primitives, each with a docblock and Figma reference.
- `docs/superpowers/specs/visual-maturity/surface-audit.md` — per-surface change map: what tier each surface adopts, what density changes, what motion attaches. Drives Phase 1+ planning.
- `expo-blur` added to dependencies and verified working on device.

**Risks:**
- `expo-blur` interaction with `react-native-maps` on iOS — needs device verification that translucent overlays don't break the map's hit-testing or render cycle.
- `expo-linear-gradient` (needed for SquircleIcon) — already common, low risk, but verify it composes with `Pressable + borderRadius` on Android without clipping.

**Branch:** `program/visual-maturity-phase-0`
**Atomic commits:** one per token module, one per primitive, one for the surface audit.

### Phase 1 — Material foundation (3-4 sessions)

**Goal:** Migrate every primary surface from solid to material. The map breathes through every sheet, FAB, and search bar.

**Surfaces (ordered low-blast → high-blast):**
1. FloatingActionButton — wraps in `MaterialSurface tier="chrome"`. Touches every screen with a FAB.
2. SearchBar (default state, over-map) — `chrome` tier. /home, /search.
3. ZoneDetailCard, RouteHazardDetailCard, ReportDetailCard — sheet tier. /home.
4. HomeBrowseSheet — sheet tier with adjusted density. /home.
5. RouteComparisonSheet, FuelStopsSheet, CalendarPickSheet — sheet tier. /home, /roadside, /trip-summary.
6. LifelineModal, LiveSafetySheet — modal tier. /home, /pulled-over.

**Per-surface PR rhythm:**
- 1 PR per logical surface group (FABs in one, sheets in another, modals in a third)
- Subagent-driven 2-stage review (spec compliance + code quality) per the Design Health Program model
- Manual device smoke after each PR — material rendering and gesture handling

**Risks:**
- Apple Maps backdrop performance with multiple stacked translucent surfaces. Mitigation: limit simultaneous material layers to 2; modal tier renders opaque-on-content (not over the map).
- Reduce-transparency fallback. Mitigation: every MaterialSurface consumes the system setting and renders a solid fallback (white at 1.0 opacity for sheet/card, fillsTertiary for chrome).

### Phase 2 — Refined polish (3-4 sessions)

**Goal:** Layer 3 craft — squircle iconography, gradient CTAs, 0.5pt hairlines, color-aware shadows, density regularization.

**Workstreams:**
1. **SquircleIcon migration** — replace LandmarkMarker's circle-bg + glyph composition with SquircleIcon. Replace /report picker tiles' circle pattern. Replace ReportDetailCard's header icon. Cross-cutting; one PR per consumer.
2. **Button gradient pass** — primary fill gets `freshgreen → wiltedgreen` gradient; secondary stays solid wiltedgreen. Color-aware shadow (freshgreen at 0.25 opacity, 12pt radius, 4pt offset). One PR.
3. **Density regularization sweep** — audit every screen for off-grid spacing values. Snap to 8/16/24/32. One PR per screen group (~4 PRs).
4. **Hairline border treatment** — every MaterialSurface gets a 0.5pt top hairline (rgba 1,1,1,0.5 over dark map, rgba 0,0,0,0.06 over light). Built into MaterialSurface in Phase 0; this PR audits and bumps any custom borders that drift.

**Can pipeline with Phase 1** — workstream 1 (SquircleIcon) needs Phase 0's primitive, not Phase 1's surfaces. Can start day 1.

**Risks:**
- Gradient + Pressable + borderRadius Android clipping. Mitigation: test on emulator in Phase 0; if blocking, ship gradients iOS-only (Android falls back to solid `freshgreen`).
- Density changes regressing existing layouts. Mitigation: per-screen visual smoke after each PR; the existing screenshot-comparison habit from Design Health Program catches drift.

### Phase 3 — Motion (3-4 sessions)

**Goal:** Foundation motion across all interactions + four hero animation set-pieces.

**Foundation (1-2 sessions):**
- `useSpringPress` adopted on Button, FloatingActionButton, settings rows, all chips. One PR per consumer group.
- Bottom sheet transitions move from linear slide to `gentle` spring. ReportDetailCard, ZoneDetailCard, etc. Built into MaterialSurface's `tier="sheet"` mount animation.
- Staggered list mounts on HomeBrowseSheet recommendation cards (50ms cascade, `settle` preset).

**Hero moments (1-2 sessions, in priority order):**
1. Route line draws on (highest leverage — first thing every user sees)
2. Marker drop-in cascade
3. SOS countdown pulse
4. Trusted-friend trail afterglow

Each is its own PR. Each respects `useReduceMotion()`.

**Can pipeline with Phase 1** — foundation work (`useSpringPress`, motion tokens) ships before any hero moment. The hero moments wait until their target surface is at Phase 2 state.

**Risks:**
- Animated polyline complexity in react-native-maps. Mitigation: prototype the route-draw on a single test route in Phase 0's verification work; if blocking, ship a simpler fade-in for the route (the bar is still motion, not nothing).
- Spring overshoot reading as "Waze-bouncy." Mitigation: friction 14+ throughout (no friction 8 / "bouncy" springs); design review on first hero PR sets the calibration.

## Parallelism map

```
Phase 0 ──┐
          ├─ Phase 1 (material) ──────────────────┐
          ├─ Phase 2 workstream 1 (squircle) ─────┤
          ├─ Phase 3 foundation (motion tokens) ──┤
                                                  ├─ Phase 2 workstreams 2-4 ──┐
                                                  ├─ Phase 3 hero moments ─────┤
                                                                               └─ Closeout
```

Phase 0 is the only hard prereq. After it lands, three streams can run in parallel. Hero moments and Phase 2 polish PRs converge at closeout.

## Closeout

Mirror the Design Health Program closeout:
- One synthesis PR documenting before/after on the 25 audited screens
- Updated `docs/learnings.md` entry
- Spec for any follow-up program if the audit surfaces new gaps

## Risk register summary

| Risk | Severity | Mitigation phase |
|---|---|---|
| `expo-blur` × `react-native-maps` hit-test bug | High | Phase 0 device verify |
| Gradient × Pressable × Android clipping | Medium | Phase 0 emulator test, iOS-only fallback |
| Material stack performance on older iPhones | Medium | Phase 1 caps simultaneous layers at 2 |
| Spring physics reading as Waze-bouncy | Low | Phase 3 calibration review on first PR |
| Reduce-transparency fallback drift | Low | Built into MaterialSurface primitive |
| Density regressions during regularization | Low | Per-screen smoke after each PR |

## Adjacent work

- **Design Health Program** ([closeout](./phase-1-findings/2026-06-20-design-health-program-closeout.md)) — predecessor program that established the rhythm (atomic commits, subagent reviews, per-PR smoke). This program inherits the rhythm exactly.
- **Report card multi-select subTags** ([next-session.md](../../next-session.md)) — 🟣 deferred feature that overlaps with Phase 2's SquircleIcon migration on the /report picker. Sequence after this program closes so the new chrome doesn't drift mid-rebuild.
- **Roadmap** ([ROADMAP.md](../../ROADMAP.md)) — this program is the visual-craft layer beneath the pilot-ready milestone.

---

## Out of scope (do not let the program creep)

- Adding new screens
- Changing the routing model or map provider
- Restructuring information architecture on any screen
- Adding new categories or report types
- Brand color changes
- Typography ramp changes
- Accessibility improvements beyond what the new primitives carry (reduce-motion, reduce-transparency)
- Settings-screen visual changes (it already uses the iOS native register cleanly — leave it alone)
