# Report Modal Redesign — Per-Category Detail Screens

**Date:** 2026-06-24
**Status:** Approved

## Summary

Redesign the report detail screen so each of the 6 categories gets a tailored UX — unique copy, form structure, visual tone, and layout — instead of the current generic form shared across all categories. Safety categories gain severity-aware subTag chips that feed the scoring engine with finer granularity. The picker grid drops its row eyebrow labels.

## Motivation

Device testing revealed that the one-size-fits-all detail form doesn't fit the context of each report type. A felt-unsafe report (urgent, anonymous, personal) needs a different experience than a black-owned submission (directory-style, celebratory). The current generic form also misses an opportunity: safety subTags can carry severity information that strengthens the scoring engine and the thesis's countermapping claim (C2 — community knowledge weighted equally with institutional data). With severity-aware chips, community reports carry *more* resolution than OSM's binary `lit=no` tag.

## Architecture

### State machine — no change

The existing 3-state flow stays: **picker → detail → thank-you**. The picker grid and thank-you confirmation are shared across all categories. Only the detail screen branches on `categoryId` to render a category-specific form.

No new screens, no new routes, no navigation changes.

### Picker change

Remove the three row eyebrows ("Something off", "Something useful", "Something good") from the `PICKER_GROUPS` rendering. The layout structure stays (pairs of tiles per row) but the `gridGroupHeader` text is removed. Tiles' icons and labels are self-explanatory.

## Per-Category Detail Screens

### Safety Tier

All four safety categories share the same structural pattern — severity chips + optional enrichment fields — but with unique chips, copy, and fields per category. **Single-select: one chip = the report.** Selecting a severity chip is the minimum viable submission. Everything else is optional enrichment.

#### Incident

- **Subtitle:** "What did you see?"
- **Section header:** "What happened?"
- **Chips (severity → zoneType):**
  - Accident → avoid
  - Confrontation → avoid
  - Suspicious activity → avoid
  - Police presence → avoid
  - Near miss → caution
- **Optional fields:** Photo, free-text note
- **Anonymous:** Yes (identity note shown)
- **CTA:** "Submit report"

#### Felt Unsafe

- **Subtitle:** "Talk to us. What's going on?"
- **Section header:** "What was it?"
- **Chips (severity → zoneType):**
  - Threatened → avoid
  - Followed → avoid
  - Harassed → avoid
  - Uncomfortable → caution
  - Uneasy vibe → caution
- **Optional fields:** Free-text note only (no photo — protects the reporter)
- **Anonymous:** Yes (identity note shown)
- **CTA:** "Submit report"

#### Lighting

- **Subtitle:** "Street lights down or dimmer than normal?"
- **Section header:** "How dark is it?"
- **Chips (severity → zoneType):**
  - Pitch black → avoid
  - No streetlights → avoid
  - Broken light → caution
  - Flickering → caution
  - Dim area → caution
- **Optional fields:** Photo only
- **Anonymous:** No
- **CTA:** "Submit report"

#### Hazard

- **Subtitle:** "Anything in the road?"
- **Section header:** "What's the hazard?"
- **Chips (severity → zoneType):**
  - Road blocked → avoid
  - Flooding → avoid
  - Construction → caution
  - Pothole / damage → caution
  - Debris → caution
- **Optional fields:** Photo, free-text note
- **Anonymous:** No
- **CTA:** "Submit report"

### Positive Tier

#### Felt Welcome

- **Subtitle:** "What made it feel that way?"
- **Two independent single-select sections:**
  - **"What kind of place?"** — Restaurant, Bar/Cafe, Retail, Park/Public space, Residential (optional, informational)
  - **"What made it welcoming?"** — Women-owned, LGBTQ+ welcoming, Open restroom, Late-night welcome (optional to the user, but when selected this becomes the stored `subTag` — it's the value the recommendation engine routes on)
- **Optional fields:** Free-text note
- **Anonymous:** No
- **CTA:** "Share your experience"

#### Black-Owned

- **Subtitle:** "A new community staple?"
- **Section header:** "What kind of business?"
- **Chips:** Restaurant, Bar/Cafe, Retail, Salon/Barber, Services, Other
- **Optional fields:** Business name text field
- **Anonymous:** No
- **CTA:** "Add to directory"

## Data Model Changes

### 3a. `severityMap` on ReportCategory

New optional field on `ReportCategory` in `lib/api/community-reports.ts`:

```ts
severityMap?: Record<string, ZoneType>;
```

Maps a subTag label to a zoneType override. When present, `reportToZone()` uses the selected subTag's zoneType instead of the category's default. Categories without `severityMap` (felt-welcome, black-owned) keep their current flat zoneType.

Safety categories gain `subTags` arrays (they currently have none) alongside their `severityMap`.

### 3b. `placeType` on CommunityReport

New optional field on the persisted `CommunityReport` type:

```ts
placeType?: string;
```

Stores the felt-welcome "What kind of place?" selection separately from the identity `subTag`. The identity tag remains the stored `subTag` (scoring-critical for the recommendation engine). `placeType` is informational display data only.

### 3c. Per-category CTA values

The existing `cta` field on `ReportCategory` gets updated values:

| Category | CTA |
|----------|-----|
| incident | "Submit report" |
| felt-unsafe | "Submit report" |
| lighting | "Submit report" |
| hazard | "Submit report" |
| felt-welcome | "Share your experience" |
| black-owned | "Add to directory" |

### 3d. No multi-select

SubTag selection stays single-select everywhere. Felt-welcome has two independent single-selects (one per section), but each section is pick-one. The API contract (`subTag: string`) does not change.

## Scoring Integration

One-line change in `reportToZone()`:

```ts
// Before
type: category.zoneType,

// After
type: category.severityMap?.[report.subTag ?? ''] ?? category.zoneType,
```

If the report has a subTag and the category has a `severityMap`, use the severity-specific zoneType. Otherwise fall back to the category default.

No changes to `scoreRoute`, `SCORE_WEIGHTS`, `pickWinner`, or any downstream scoring code — they already operate on `zone.type`.

## Visual Design

### Severity chip color coding

Safety category chips use reserved-color borders to encode severity at a glance:

- **avoid-level chips:** Red border + tint (`colors.red` at 8% fill)
- **caution-level chips:** Orange border + tint (`colors.orange` at 8% fill)

This requires a new documented exception (#12) in `.cursorrules`:

> **12. Report severity chips** (red/orange): severity-encoding chip borders on the report detail form use reserved colors because the severity IS the safety signal — the chip represents the level of danger the reporter experienced. Same logic as #7 (zone-warning chips) and #10 (hazard markers): the data being encoded is hazard-class.

### Positive chip styling

- **Identity tags** (felt-welcome "What made it welcoming?"): freshgreen border + tint
- **Place type tags** (felt-welcome + black-owned): fadedgreen border + tint

Both use brand greens, no reserved-color exception needed.

### Chip sizing

All chips must meet the 44pt minimum painted area on both axes per `.cursorrules` tap-target rule.

## Blast Radius

| File | Change |
|------|--------|
| `lib/api/community-reports.ts` | `ReportCategory` gains `severityMap?`. `CommunityReport` gains `placeType?`. `reportToZone()` gets the one-line severity override. Safety categories gain `subTags` + `severityMap`. CTA values updated. |
| `app/report.tsx` | Detail view branches on `categoryId` for per-category rendering. Picker drops `gridGroupHeader`. New severity chip styles. Felt-welcome renders two independent single-select sections. |
| `.cursorrules` | New reserved-color exception #12 (severity chips). |
| `lib/api/recommendations.ts` | **No changes.** `recCategoryForReport` and `vouchKeyForReport` still route on `subTag` as a single string. Felt-welcome identity tags are unchanged. New safety subTags don't feed the recommendation engine. |
| `components/ReportDetailCard.tsx` | **No changes.** SubTag display in the subline works as-is. |

## Thesis Support

Severity-aware subTags strengthen **C2** (countermapping claim): community reports now carry more scoring resolution than OSM's binary `lit=no` tag. A community member reporting "pitch black — no streetlights" creates an `avoid` zone (-5) while "dim area" stays `caution` (-1). The person who walks that block at night knows more than the infrastructure database. Also strengthens **C1** (safety-routing accuracy) — better-granularity data produces better route scores.
