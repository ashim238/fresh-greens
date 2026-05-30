# Route-preview card redesign + cloud-aware daylight

**Date:** 2026-05-30
**Status:** Design approved (brainstorm). Next: implementation plan.
**Surfaces:** `/home` route-preview card (primary); `lib/daylight.ts` + `/en-route` polyline gradient (shared engine, Part 3).

## Context

The `/home` route-preview card (shown once a destination is set) drew three pieces of user feedback:

1. **Subtext too small.** "Via {road}" (13pt) and "Safest route with current conditions." (12pt) sit at the smallest type tiers — hard to scan.
2. **Reads sparse.** A big duration number, two thin gray lines, a chip — lots of vertical air, low information density.
3. **No destination on the card.** The destination name only lives in the search bar, so the recurring-destination "save as a regular" underline (added in `fix/via-shows-road`) has no natural home — it's currently parked in the no-road fallback.

The user chose the **richest** redesign direction ("C"), then refined to a **blend**, and asked to fold in a **cloud-cover → daylight** enhancement plus a **tappable** save-as-regular affordance.

## Goals

- Lift the small subtext up a type tier; make the card read denser/more useful without clutter.
- Put the destination on the card as a **title**, and give the "save as a regular" underline a real, **tappable** home there.
- Make the daylight read honest about cloud cover (an overcast arrival shouldn't look like full daylight).
- Keep all the card's existing safety semantics (conditions framing, zone chips, daylight strip, Schedule/Go).

## Non-goals

- No new routing/scoring logic. The card is presentation-only except where noted (Part 2 store add, Part 3 weather field).
- No arrival-time **forecast** for cloud (v1 uses *current* cloud as a proxy — see Part 3).
- Not touching `/en-route`'s layout — only the shared daylight color it already consumes shifts (Part 3).

---

## Part 1 — Card layout (the "blend")

### Structure (top → bottom)

1. **Destination title** — `params.destName` (e.g. "Trader Joe's"). Freshgreen, **underlined when the destination is a saved regular** (see Part 2). This is the new card title and the home for the underline.
2. **Hero row** — duration as the hero number ("12 min"), with **arrival clock time beside it** ("arrive 7:42 PM"). Arrival is the natural pair to "how long."
3. **Distance** — "3.2 mi", demoted to a small line under the hero (least decision-relevant of the three stats, but kept — the user okayed the density).
4. **Via + daylight strip** — "Via {road}" (bigger, left) + the daylight strip (right, unchanged position).
5. **Conditions line** — "Safest route…" with a cloud-aware arrival-light tail (see Part 4).
6. **Zone chips** — "Along this route:" + warning chips, or the All-clear chip. Unchanged.
7. **Actions** — Schedule (when a better departure exists) + Go. Unchanged.

### Type tokens (the "too small" fix)

Consume from `theme/typography.ts`; each bumps one tier off its current size:

| Element | Today | Redesign |
|---|---|---|
| Destination title | (absent) | `title3Emphasized` (20pt) |
| Duration hero | large headline (unchanged) | unchanged |
| Arrival ("arrive 7:42 PM") | (absent / a11y-only) | `subheadlineRegular` (15pt), `labelSecondary` (kept below the duration hero so it doesn't compete) |
| Distance ("3.2 mi") | (absent) | `footnoteRegular` (13pt), `labelTertiary` |
| Via | `footnoteRegular` (13pt) | `subheadlineRegular` (15pt) |
| Conditions | `caption1Regular` (12pt) | `footnoteRegular` (13pt) |

Final exact tokens get pinned in the plan; the rule is "one tier up, title3-emphasized for the new title."

### Data sources (all already on hand — presentation-only)

- **Destination name** — `params.destName`.
- **Duration** — `recommended.estimatedMinutes` → `formatDuration`.
- **Arrival** — `now + estimatedMinutes` → `formatTimeOfDay` (the same helper the Schedule button already uses).
- **Distance** — `recommended.distanceMeters` → miles (extend `lib/format` with a meters→miles formatter if one doesn't exist).
- **Via** — `primaryRoadName(recommended.steps)` (from the Via fix).
- **Daylight strip / conditions / chips** — unchanged sources.

No new fetch for the layout itself.

### Edge / empty states (all preserved)

- **Calculating** / **no-route** — actions hidden, headline shows "—" / no-route copy (unchanged branches).
- **No Via road** (mock/step-less route) — Via falls back to the destination, as today.
- **Not a regular** — title renders without the underline (plain).
- **No `suggestedDeparture`** — Schedule collapses, Go takes full width (unchanged).
- **No arrival/distance** (route still calculating) — those lines render only when the values exist; the title + Via still anchor the card.

### Reserved-color compliance

- The freshgreen underlined title is the `.cursorrules` in-flow-link register (freshgreen) — allowed, not a reserved safety color.
- Orange zone chip, daylight gradient — unchanged, already-documented exceptions.

---

## Part 2 — Tap-to-toggle "regular" on the destination title

### Behavior

The destination title is tappable:

- **Not a regular → tap** → mark it a regular (freshgreen underline appears), light success haptic.
- **Is a regular → tap** → un-mark it (underline disappears), light selection haptic.

This closes the loop: today regulars are only set from the trip-summary "Set as default." The route preview is the natural place to toggle it directly.

### Store + hook changes (new capability)

`lib/api/regular-destinations.ts` currently has `addRegularDestination` (which *increments* count if a match exists — wrong for a toggle) but **no remove**. Add:

- `removeRegularDestination(latitude, longitude)` — removes any stored regular within `MATCH_DELTA_DEG` of the point (mirrors `isRegularLocation`'s proximity match).
- `useRegularDestinations` hook — expose an `unmarkRegular(lat, lng)` alongside `markRegular`, both updating local state optimistically.

Toggle semantics on the title: `isRegularDestination ? unmarkRegular(...) : markRegular(...)`. (Tapping an already-regular must NOT call `addRegularDestination`, to avoid count inflation.)

### a11y + haptics

- `accessibilityRole="button"`, label e.g. `"{destName}. {Saved as a regular | Tap to save as a regular}."`, hint describing the toggle.
- `Haptics.notificationAsync(Success)` on mark, `Haptics.selectionAsync()` on unmark.

---

## Part 3 — Cloud-aware daylight engine

A single change to the daylight color computation, consumed by both the card strip and the `/en-route` polyline gradient.

### `lib/api/weather.ts`

- Add `cloud_cover` to the Open-Meteo `current=` field list (currently `temperature_2m,precipitation,wind_speed_10m,visibility`). No new endpoint/key.
- Add `cloudCoverPct: number` (0–100) to the response type + the returned `Weather` object.

### `lib/daylight.ts`

- `colorForMinutesToSunset(minutes, cloudCoverPct?)` — after selecting the base sun-position color, **blend it toward a neutral gray** by a factor derived from `cloudCoverPct`.
  - Blend factor = `(cloudCoverPct / 100) * MAX_CLOUD_DESATURATION`, where `MAX_CLOUD_DESATURATION` caps the effect (default **0.65**) so even 100% cloud stays legible — never fully gray.
  - Gray target = the luminance-matched gray of the base color (so it dims/desaturates rather than shifting hue).
  - `cloudCoverPct` omitted/undefined → no change (backward-compatible; current callers keep working).

### Threading to consumers

- **Card daylight strip (`/home`)** — the strip keeps its fixed 3-stop `daylightDawn → daylightDusk → daylightNight` legend gradient, but **each stop is run through the same cloud-desaturation** before rendering. So the whole strip dims/grays uniformly as cloud rises (the legend stays a legend; it just reads dimmer when overcast). No layout/position change.
- **En-route polyline (`/en-route`)** — pass `cloudCoverPct` into the per-segment color call; the gradient desaturates with cloud automatically.

### v1 proxy + future

- **v1:** use the *current* cloud cover (from the existing weather fetch for the route area) as a proxy for arrival cloud.
- **Future:** Open-Meteo `hourly` cloud forecast at the destination, sampled at arrival time, for a true arrival read. Out of scope here.

---

## Part 4 — Conditions line (Option B): cloud-aware arrival-light tail

The line gains a short, dynamic suffix. The descriptor word is chosen from the **arrival sun-band** (`bandForMinutes` in `daylight.ts`: day / twilight / night) **modulated by cloud**:

| Arrival band | Cloud | Tail |
|---|---|---|
| day | < 60% (default) | "arriving in daylight" |
| day | ≥ 60% (default) | "arriving in low light" |
| twilight | any | "arriving at dusk" |
| night | any | "arriving after dark" |

Rendered as: `Safest route · {tail}.` (When the band/arrival is unknown, fall back to today's plain "Safest route with current conditions.")

This surfaces, in text, the arrival-light info that's currently VoiceOver-only — and makes it cloud-true (an overcast late-afternoon arrival reads "low light," matching the desaturated strip). The exact cloud threshold is tunable in the plan.

---

## Implementation phasing

Two independent parts; the plan can sequence them as separate PRs:

- **Part A — card + interaction (`/home` only):** layout/structure, type bumps, arrival + distance, destination title, tap-to-toggle regular (+ the `removeRegularDestination`/`unmarkRegular` store+hook add), conditions-line tail wiring. Self-contained in `app/home.tsx` + `regular-destinations.ts` + `useRegularDestinations.ts` + `lib/format`.
- **Part B — daylight engine:** `weather.ts` cloud field, `daylight.ts` desaturation, thread `cloudCoverPct` into the card strip and `/en-route` gradient. Independent of Part A; can land first or second. Part 4's tail consumes Part B's cloud value (so if Part A ships first, the tail starts daylight-only and gains cloud-awareness when Part B lands).

## Files touched

- `app/home.tsx` — card render + styles; title tap handler; arrival/distance; conditions tail.
- `lib/api/regular-destinations.ts` — `removeRegularDestination`.
- `hooks/useRegularDestinations.ts` — `unmarkRegular`.
- `lib/format.ts` — meters→miles formatter (if absent).
- `lib/api/weather.ts` — `cloud_cover` field.
- `lib/daylight.ts` — cloud desaturation in `colorForMinutesToSunset`; the conditions-tail label helper (or co-locate the label helper in `home.tsx`).
- `app/en-route.tsx` — pass `cloudCoverPct` into the gradient color call.

## Testing

- **Type/visual:** card renders at each state (regular/not, road/no-road, suggestedDeparture/not, calculating/no-route). Title underline toggles on tap; store reflects mark/unmark; no count inflation on re-tap of a regular.
- **Daylight:** `colorForMinutesToSunset` returns the same color at `cloudCoverPct=0`/undefined (backward-compat); progressively grays toward the cap as cloud rises; never fully gray at 100%.
- **Conditions tail:** correct word per (band × cloud) combination; graceful fallback when arrival/band unknown.
- **a11y:** title button label/hint; arrival + conditions read sensibly under VoiceOver.

## Out of scope / future

- Arrival-time cloud **forecast** (vs current-cloud proxy).
- Cloud feeding the *driving-conditions* Good/Fair/Poor read (that's the weather card; separate).
- Any `/en-route` layout change beyond the gradient color shift.
