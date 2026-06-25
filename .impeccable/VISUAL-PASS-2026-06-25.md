# Visual pass — meta-line spacing (2026-06-25)

**Scope:** Hub + driving surfaces, Priority A/B meta lines. Code review of JSX + StyleSheet (not scorecard-only).

**Branch:** `polish/visual-pass-meta-spacing`

## Audit gap — why Round 7 / type critique missed interpunct

Round 7 and the typography app-wide critique score **token presence** (dynamicType spread, ramp compliance, reserved-color grep) and **macro hierarchy** (headline vs body weight steps). They do **not** inspect:

- Mixed-weight inline runs on the same flex row (`subheadline` arrive + `footnote` distance + a `·` baked into a string prefix)
- Whether separator glyphs own **symmetric** horizontal padding vs flex `gap` or leading `"· "` in a string
- Optical centering of middots between emphasized and regular siblings

Interpunct spacing is **micro-typography / optical layout** — invisible to token grep and invisible to rubrics that stop at "uses footnoteRegular." Future visual passes should add an explicit **meta-line separator** check: any `·` in route/sheet meta → `MetaSeparator` or equivalent row with `paddingHorizontal: spacing.xs` on the glyph.

## Findings

| Screen / component | Issue | Fixed? | Notes |
|---|---|---|---|
| `/home` route-preview card | `· ${distance}` string left middot closer to distance than arrival | **Yes** | `MetaSeparator` + `routeMetaCluster` row; a11y label on cluster |
| `/en-route` bottom sheet ETA row | Raw `·` Text + `gap: spacing.xs` doubled beat spacing | **Yes** | `MetaSeparator`; removed row `gap` |
| `RouteComparisonSheet` | Inline `"arrival · distance"` string | **Yes** | `metaRow` + `MetaSeparator` |
| `RouteComparisonSheet` | Raw `gap: 4` / `marginTop: 4` literals | **Yes** | → `spacing.xs` / `spacing.sm` |
| `FuelStopsSheet` stop rows | 3-part meta string with embedded `·` | **Yes** | `rowMetaRow` + `MetaSeparator` |
| `/pulled-over` recording chip | `gap` + bare `·` Text | **Yes** | `MetaSeparator`; dot gets `marginRight` only |
| `/roadside` share card Contact row | `name · time` in one Text | **Yes** | Value row + `MetaSeparator` |
| `ReportDetailCard` subline | Category · tag · time string | **Yes** | `sublineParts` row + `MetaSeparator`; share still uses joined string |
| `/recordings` row secondary | Armed · duration string | **Yes** | `cardSecondaryRow` + `MetaSeparator` |
| `MetaSeparator` (new) | No shared separator primitive | **Yes** | 8 uses — exceeds rule-of-three |
| `DaylightRouteLegend` | — | n/a | No interpunct; 96pt column + `spacing.*` already correct |
| `/home` via + daylight row | — | n/a | Flex row reviewed; no separator issue |
| `HomeBrowseSheet` rec cards | Rating/distance as pills not `·` meta | n/a | Different pattern; pills use `gap: spacing.sm` |
| `/en-route` secondary row | `bodyEmphasized` flanks + `subheadline` separator | **P2** | Intentional quiet beat per comment; monitor optically on device |
| `/home` route meta | Mixed `subheadline` arrive + `footnote` distance | **P2** | Matches Figma tiering; separator sized to footnote side |
| `LiveSafetySheet` collapsed | `sessionType · duration` in NotifyingPulse label string | **P2** | Low-traffic chip; would need NotifyingPulse parts API |
| `FuelStopsSheet` header subtitle | Trusted-count clause in template string | **P2** | Prose sentence, not token meta row |
| `RoadsideTowPick` | `distance · address` inline | **P2** | Secondary to this pass; same fix pattern if it ships |
| `/trip-summary` | Stat columns not inline meta | n/a | Label/value stack reviewed — spacing OK |
| `formatTimestamp` in `/recordings` | Date · time inside one string (title line) | **P2** | Tabular-nums guard on timestamp; separator not split (title row) |

## Counts

- **Fixed:** 10 (including new `MetaSeparator` + 9 call-site/layout fixes)
- **Logged P2 / reviewed n/a:** 8

## Verification

- `npx tsc --noEmit` — run on branch before merge
