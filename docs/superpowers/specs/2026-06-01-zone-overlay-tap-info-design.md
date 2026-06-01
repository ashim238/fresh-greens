# Zone Overlay Tap-Info — Design

**Date:** 2026-06-01
**Status:** Approved (brainstorm complete)
**Next step:** Implementation plan via `superpowers:writing-plans`

## Goal

Let the user tap a zone overlay on `/home` to learn what it represents, why it's marked the way it is, and how it affects Fresh Greens' routing. Surfaces the thesis claim that the user should be able to see *and understand* the safety-scoring data that shapes their navigation, rather than just experiencing its output.

## Scope

**In scope:**
- New tap-to-info behavior on `/home`'s zone overlays
- New `ZoneDetailCard` bottom-sheet component
- Polygon and polyline overlays — the six OSM-derived zone categories: `lighting`, `landuse`, `park`, `police`, `wildlife`, `road-condition`

**Out of scope:**
- `/en-route` tap behavior (driving-stress UX concerns; the existing bottom-sheet hazard panel already covers en-route zone transparency when the user enters a zone)
- Community-report **point** zones — these already render via `LandmarkMarker` and tap to open `ReportDetailCard`. No changes there.
- Scoring-impact quantification (numeric percentage by which a zone affects route ranking). Defer; v1 explains the category and toggleable status only.

## User flow

1. User opens `/home`. Zone overlays are visible (assuming `showZones` is on in `usePreferences`).
2. User taps a zone polygon or polyline.
3. `ZoneDetailCard` slides up from the bottom of the screen with category-specific content.
4. User reads the explanation. Two affordances available:
   - Toggleable categories (`lighting`, `police`): footer link "Manage in Zone Preferences →" navigates to `/zone-preferences`.
   - Always-on categories (`park`, `landuse`, `wildlife`, `road-condition`): no link footer; the body copy explains *why* it's always factored without implying it can be toggled.
5. User dismisses via close X, drag-handle swipe down, or tap-outside on the map.

If the user taps a community-report point during this state, the existing `ReportDetailCard` opens and `ZoneDetailCard` dismisses (mutual exclusion). Same the other way.

## Architecture

### Component

**New file:** `components/ZoneDetailCard.tsx`

Mirrors `ReportDetailCard`'s register. Rendered inline on `/home` (not a route — same pattern as `ReportDetailCard`). Visibility driven by a `selectedZone: Zone | null` state on `/home`.

Rule-of-three rationale: did NOT consolidate with `ReportDetailCard` into a shared `MapDetailCard` because the content shapes diverge meaningfully (report = photo + user-detail + timestamp; zone = data-source + scoring-effect + manage-link). With only two surfaces today, parallel components are clearer than a discriminated union. Revisit if a third map-tap-detail surface arrives.

### `/home` state additions

```ts
const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
```

Mutual exclusion with `selectedReport`: opening one clears the other.

### Tap wiring

Each `<Polygon>` and `<Polyline>` rendering call on `/home` receives:

```tsx
onPress={() => {
  setSelectedReport(null);   // clear sibling sheet
  setSelectedZone(zone);
}}
tappable  // polyline only; polygon is tappable by default
```

`react-native-maps` natively supports `onPress` on `Polygon` (always tappable) and `Polyline` (requires `tappable` prop).

### Dismissal

- Close X on the card → `setSelectedZone(null)`
- Drag-handle swipe down → same
- `MapView.onPress` (tap on empty map area) → clears both `selectedZone` and `selectedReport`

### Routing to Zone Preferences

Footer link uses `router.push('/zone-preferences')` (the existing route, shipped this session).

## Per-category content matrix

**Glyph color rule**: every glyph is tinted by the zone's `ZoneType`, not its category. This keeps the color story consistent with the rest of the app's reserved-color rule (red = alert, yellow = caution, freshgreen = safe affordance). Categories that don't have a default-safe footprint (lighting, police, wildlife, road-condition) are almost always `caution` or `avoid` in fixtures, so they'll typically render yellow or red. Park is typically `safe` → freshgreen. Landuse is informational (no type signal) and falls back to `labelSecondary`.

```
safe    → colors.freshgreen
caution → colors.yellow
avoid   → colors.red
neutral (landuse only) → colors.labelSecondary
```

| Category | Title | Glyph (Phosphor, duotone) | Data-source line | Affects-routes line | Toggleable? |
|---|---|---|---|---|---|
| `lighting` | "Low lighting" | `Lightbulb` | Streets here are tagged as below-average lighting in OpenStreetMap data. | Fresh Greens routes around low-lit areas when **Low-light areas** is on in Zone Preferences. | yes |
| `police` | "Police presence" | `Shield` | A police station, speed camera, or other police facility is mapped here in OpenStreetMap. | Fresh Greens routes around police presence when **Police presence** is on in Zone Preferences. | yes |
| `park` | "Park or green space" | `Tree` | Mapped as a park in OpenStreetMap data. | Fresh Greens factors green spaces into safety scoring — they generally read as safer during daylight. | no |
| `landuse` | "Commercial / residential area" | `Buildings` | OpenStreetMap land-use tag. | Fresh Greens factors land-use type into routing — commercial corridors typically have more pedestrians. | no |
| `wildlife` | "Wildlife crossing zone" | `PawPrint` | Mapped as a wildlife corridor in OpenStreetMap data. | Fresh Greens routes around wildlife zones during dawn and dusk when collision risk is highest. | no |
| `road-condition` | "Road condition zone" | `Warning` | Tagged in OpenStreetMap as having degraded surface condition. | Fresh Greens factors road condition into route scoring. | no |

**Honesty-of-disclosure:** only the three toggleable categories (`lighting`, `police`, plus `community-report` which already has its own card) have user-controllable flags in `usePreferences`. The other four are always-on. Card copy reflects this — only toggleable categories link to Zone Preferences as a controllable affordance; always-on categories explain *why* they factor in without implying they can be turned off.

## Layout + visual register

```
┌────────────────────────────────────────┐
│        ━━                       [✕]    │  drag handle + close (44pt visual)
│                                        │
│              ⊙                         │  48pt category glyph, centered
│        Low lighting                    │  title2Emphasized, centered
│                                        │
│   Streets here are tagged as           │
│   below-average lighting in            │  bodyRegular (17pt), left-aligned
│   OpenStreetMap data.                  │
│                                        │
│   Fresh Greens routes around low-lit   │
│   areas when Low-light areas is on     │
│   in Zone Preferences.                 │
│                                        │
│      Manage in Zone Preferences →      │  freshgreen underlined link
│                                        │  (subheadlineRegular)
└────────────────────────────────────────┘
```

**Chrome**:
- Card rounded top corners: `radii.xl` (20pt)
- Card shadow: `shadows.e3`
- Padding: `paddingHorizontal: spacing.lg`, `paddingTop: spacing.md`, `paddingBottom: spacing.xl`
- Animation: slide-up from bottom on open, slide-down on close (mirrors `ReportDetailCard`)

**Type ramp**:
- Title: `title2Emphasized` (22pt bold, centered)
- Body: `bodyRegular` (17pt, left-aligned, `relaxedLineHeight` for the multi-line reading-text register)
- Footer link: `subheadlineRegular` (15pt) + `colors.freshgreen` + `textDecorationLine: 'underline'`

**Estimated card height**: ~300pt (glyph 48 + title 28 + 2 body paragraphs ≈ 100pt + footer ≈ 32 + paddings/gaps). Covers ~35% of an iPhone screen, leaving the upper map visible so the user can still see where the zone is.

## Accessibility

- On card open: `AccessibilityInfo.announceForAccessibility("[Title]. [Body summary]")` so VoiceOver speaks the new state immediately
- Close X: 44pt visual, `accessibilityLabel="Close"` (per the just-shipped tap-target audit)
- Drag handle visual: `accessible={false}` (the sheet itself is announced via the title)
- Footer link: `accessibilityRole="link"`, `accessibilityLabel="Manage in Zone Preferences"`
- Glyph: `accessible={false}` (decorative; title carries the meaning)
- Polygon/Polyline `onPress`: `react-native-maps` doesn't expose an `accessibilityLabel` on overlays directly (this is a platform limitation); zones are an enhancement to sighted users. The bottom-sheet hazard panel on `/en-route` remains the parity surface for VO users in driving contexts.

## Honesty-of-disclosure / thesis alignment

This feature is the most direct expression of the thesis's transparency-in-scoring claim shipped to date. Every other transparency surface in the app (the bottom-sheet hazard panel, the daylight gradient on the route polyline, the Zone Preferences page) shows scoring *inputs* or *outputs*; this feature lets the user **point at a single overlay and ask "what is this and why is it shaping my route?"**

The data-source line is load-bearing — saying "OpenStreetMap tags" makes the provenance explicit. The affects-routes line is load-bearing for the same reason — it ties the overlay back to user-controllable preferences when applicable, and explains the always-on categories without obscuring them.

## Deferred follow-ups

- **Numeric scoring impact** ("This zone reduces route safety score by ~X%") — interesting transparency claim, but the scoring function is non-linear and a single percentage isn't honest. Defer until the scoring layer exposes a clean per-zone delta API.
- **`/en-route` tap behavior** — current design says no taps mid-drive. If a stationary-tap pattern (gated on `speedMph ≤ 3`) becomes valuable, design separately.
- **Polygon tap-anchor ambiguity** — for very large polygons (e.g., a 0.5-mi-wide park), the user's tap location isn't relevant to the card content. Acceptable v1 limitation. If callout-style anchoring ever becomes valuable (showing exactly *which* part of a polygon the user tapped), that's its own design.
- **Shared chrome extraction** (rule-of-three) — if a third map-tap-detail surface ships, extract `MapDetailCardChrome` and have `ReportDetailCard` + `ZoneDetailCard` both consume it. Not now.
