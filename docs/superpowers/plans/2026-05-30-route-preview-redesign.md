# Route-preview Card Redesign + Cloud-aware Daylight — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `/home` route-preview card (destination title + denser stat hierarchy + bigger subtext), make the destination title a tappable save-as-regular toggle, and make the daylight read cloud-aware across the card strip and the `/en-route` gradient.

**Architecture:** Two independent phases. **Phase A** is presentation + interaction, contained to `app/home.tsx` plus a small store/hook add and one daylight label helper. **Phase B** is a daylight-engine change (`weather.ts` cloud field → `daylight.ts` desaturation) threaded into the card strip and the en-route polyline. Phase A degrades gracefully without B (the conditions tail is daylight-only until B passes cloud in).

**Tech Stack:** React Native + Expo + TypeScript, `expo-router`, `react-native-maps`, StyleSheet API, AsyncStorage adapters, SunCalc, Open-Meteo.

**Spec:** `docs/superpowers/specs/2026-05-30-route-preview-redesign-design.md`

---

## Verification model (read first)

This project has **no test runner** (no jest, no test script, no test files). The established verification rhythm — used across the whole codebase — is:

1. `npx tsc --noEmit 2>&1 | grep -v "@expo/vector-icons\|@vercel/node\|avatar.png"` → must show **no** errors in the touched files (those three are pre-existing environment noise).
2. For pure logic, an **expected-output table** stated in the task (sanity-checked by reading, since there's no runner).
3. The **code-reviewer** subagent at each PR boundary.
4. **Simulator** eyeballing (`npx expo start`) for visual/interaction changes.

So tasks below use **implement → typecheck → verify-expected/visual → commit** instead of failing-test-first. Do not invent jest commands.

**Branch + commit rhythm:** one branch per phase (`feat/route-preview-card` for A, `feat/cloud-aware-daylight` for B); commit per task on that branch; squash-merge to main at phase end after the code-reviewer pass (per `docs/workflow.md`). End commit messages with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.

---

## File Structure

| File | Phase | Responsibility / change |
|---|---|---|
| `lib/api/regular-destinations.ts` | A | + `removeRegularDestination(lat, lng)` — proximity-match remove (toggle-off). |
| `hooks/useRegularDestinations.ts` | A | + `unmarkRegular(lat, lng)` exposed alongside `markRegular`. |
| `lib/daylight.ts` | A, B | A: + `arrivalLightLabel(band, cloudCoverPct?)`. B: desaturation in `colorForMinutesToSunset` + `cloudCoverPct` param on `gradientSegments`. |
| `app/home.tsx` | A, B | A: route-preview card restructure + title tap-toggle + arrival/distance + conditions tail. B: desaturate the card strip stops + pass cloud to `gradientSegments`/`arrivalLightLabel` (via `useWeather`). |
| `lib/api/weather.ts` | B | + `cloud_cover` Open-Meteo field + `cloudCoverPct` on `Weather`. |
| `app/en-route.tsx` | B | Pass `cloudCoverPct` into `gradientSegments(route)`. |

`lib/format.ts` is **unchanged** — `formatDistance(miles)`, `formatDuration(minutes)`, `formatTimeOfDay(date)` already exist; the card converts route meters→miles inline (`meters / 1609.34`) and calls `formatDistance`.

---

# PHASE A — Card layout + interaction

Branch: `feat/route-preview-card`.

## Task A1: Add `removeRegularDestination` + `unmarkRegular`

**Files:**
- Modify: `lib/api/regular-destinations.ts`
- Modify: `hooks/useRegularDestinations.ts`

Context: `addRegularDestination` *increments count* when a match exists — wrong for a toggle. The toggle calls `markRegular` only when not-yet-regular, and `unmarkRegular` to remove. `MATCH_DELTA_DEG` (≈0.002°, ~200m box) and the proximity predicate already exist in this file (see `isRegularLocation`).

- [ ] **Step 1: Add `removeRegularDestination` to the adapter**

In `lib/api/regular-destinations.ts`, after `addRegularDestination`:

```ts
/**
 * Removes any stored regular within ~200m of (latitude, longitude).
 * The toggle-off counterpart to addRegularDestination. No-op if none
 * match. Returns the surviving list.
 */
export async function removeRegularDestination(
  latitude: number,
  longitude: number,
): Promise<RegularDestination[]> {
  const all = await getRegularDestinations();
  const kept = all.filter(
    (r) =>
      Math.abs(r.latitude - latitude) >= MATCH_DELTA_DEG ||
      Math.abs(r.longitude - longitude) >= MATCH_DELTA_DEG,
  );
  if (kept.length !== all.length) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
  }
  return kept;
}
```

- [ ] **Step 2: Expose `unmarkRegular` from the hook**

In `hooks/useRegularDestinations.ts`: import `removeRegularDestination`, add a `useCallback` mirroring `markRegular` (optimistic local update + persist), and return it.

```ts
const unmarkRegular = useCallback(async (latitude: number, longitude: number) => {
  setRegulars((prev) =>
    prev.filter(
      (r) =>
        Math.abs(r.latitude - latitude) >= 0.002 ||
        Math.abs(r.longitude - longitude) >= 0.002,
    ),
  );
  await removeRegularDestination(latitude, longitude);
}, []);
```

Add `unmarkRegular` to the hook's return object (alongside `regulars`, `markRegular`, `clearAll`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "regular-destinations|useRegularDestinations"`
Expected: no output (clean).

- [ ] **Step 4: Verify expected behavior (by reading)**

- `removeRegularDestination(lat,lng)` on a store with a regular at (lat,lng) → returns the list without it, persists.
- On a store with no match → returns the list unchanged, no write.
- `unmarkRegular` updates local state immediately, then persists.

- [ ] **Step 5: Commit**

```bash
git add lib/api/regular-destinations.ts hooks/useRegularDestinations.ts
git commit -m "feat: removeRegularDestination + unmarkRegular for the toggle"
```

## Task A2: Add `arrivalLightLabel` to `daylight.ts`

**Files:**
- Modify: `lib/daylight.ts`

Drives the conditions-line tail (Part 4). Takes the arrival daylight band (from `bandForMinutesToSunset`) and an optional cloud %; cloud is honored only in the `day` band (overcast daytime → "low light"). Cloud param is optional so Phase A ships it daylight-only and Phase B starts passing cloud with no signature change.

- [ ] **Step 1: Implement the helper**

In `lib/daylight.ts`, near `bandForMinutesToSunset`:

```ts
/** Cloud % at/above which a daytime arrival reads as "low light". */
const LOW_LIGHT_CLOUD_PCT = 60;

/**
 * Short arrival-light descriptor for the route-preview conditions line.
 * `day` + heavy cloud reads as "low light" (overcast dims daylight);
 * twilight/night are cloud-independent. Returns null when band is
 * unknown so the caller can fall back to the plain conditions copy.
 */
export function arrivalLightLabel(
  band: DaylightBand,
  cloudCoverPct?: number,
): string | null {
  switch (band) {
    case 'day':
      return cloudCoverPct != null && cloudCoverPct >= LOW_LIGHT_CLOUD_PCT
        ? 'arriving in low light'
        : 'arriving in daylight';
    case 'twilight':
      return 'arriving at dusk';
    case 'night':
      return 'arriving after dark';
    default:
      return null;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep daylight`
Expected: no output.

- [ ] **Step 3: Verify expected behavior (by reading)**

| band | cloud | → |
|---|---|---|
| day | undefined / 10 | "arriving in daylight" |
| day | 75 | "arriving in low light" |
| twilight | any | "arriving at dusk" |
| night | any | "arriving after dark" |

- [ ] **Step 4: Commit**

```bash
git add lib/daylight.ts
git commit -m "feat: arrivalLightLabel for the route-preview conditions tail"
```

## Task A3: Derive the new card values + the title tap-toggle in `app/home.tsx`

**Files:**
- Modify: `app/home.tsx`

Add, near where `recommended`/`viaRoad` are computed (the route-mode render scope): arrival time, distance string, arrival band + light label, and the `isRegularDestination` (already computed in `fix/via-shows-road`) + a toggle handler.

- [ ] **Step 1: Import what's needed**

Ensure these imports exist in `app/home.tsx`:
- `formatDistance`, `formatTimeOfDay` from `../lib/format`
- `bandForMinutesToSunset`, `arrivalLightLabel`, `gradientSegments` from `../lib/daylight` (gradientSegments already imported)
- `useRegularDestinations` already imported; destructure `markRegular`, `unmarkRegular` from it.

- [ ] **Step 2: Derive the values**

Near the existing `const viaRoad = primaryRoadName(recommended?.steps);`:

```ts
// Arrival clock time = now + ETA. Distance from the route (m → mi).
const arrivalTime =
  recommended != null
    ? formatTimeOfDay(new Date(Date.now() + recommended.estimatedMinutes * 60_000))
    : null;
const distanceLabel =
  recommended?.distanceMeters != null
    ? formatDistance(recommended.distanceMeters / 1609.34)
    : null;
// Arrival daylight band = the last gradient segment's band (≈ destination).
const arrivalSegs = recommended ? gradientSegments(recommended) : [];
const arrivalBand = arrivalSegs.length
  ? arrivalSegs[arrivalSegs.length - 1].band
  : null;
// Phase A: daylight-only (no cloud yet). Phase B passes cloudCoverPct here.
const arrivalLabel = arrivalBand ? arrivalLightLabel(arrivalBand) : null;
```

- [ ] **Step 3: Add the toggle handler**

```ts
function handleToggleRegular() {
  if (!params.destLat || !params.destLng) return;
  const lat = parseFloat(params.destLat);
  const lng = parseFloat(params.destLng);
  if (isRegularDestination) {
    Haptics.selectionAsync().catch(() => {});
    void unmarkRegular(lat, lng);
  } else {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    void markRegular({ name: params.destName ?? 'Destination', latitude: lat, longitude: lng });
  }
}
```

(Confirm `markRegular`'s argument shape against `hooks/useRegularDestinations.ts` at implementation — match its existing signature.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "home.tsx"`
Expected: no output (some bindings unused until A4 wires them — if "declared but never used" appears, it clears in A4; otherwise temporarily reference them).

- [ ] **Step 5: Commit**

```bash
git add app/home.tsx
git commit -m "feat: derive arrival/distance/light + regular-toggle handler"
```

## Task A4: Restructure the route-preview card JSX + styles

**Files:**
- Modify: `app/home.tsx` (the route-preview card render + its styles)

Target structure (top→bottom), replacing the current headline + Via-row region down through the conditions line. Keep the daylight strip, chips block, and actions row as they are (only the conditions line gains the tail).

- [ ] **Step 1: Replace the title/hero/Via/conditions region**

Target JSX (adapt to the exact surrounding wrappers in the file):

```tsx
{/* Destination title — card title + tappable save-as-regular toggle.
    Freshgreen underline = a saved regular (the underline's permanent
    home after fix/via-shows-road). */}
<Pressable
  onPress={handleToggleRegular}
  accessibilityRole="button"
  accessibilityLabel={`${params.destName ?? 'Destination'}. ${
    isRegularDestination ? 'Saved as a regular' : 'Tap to save as a regular'
  }.`}
  hitSlop={8}
  style={({ pressed }) => pressed && pressedDim}
>
  <Text
    style={[styles.routeDestTitle, isRegularDestination && styles.destination]}
    numberOfLines={1}
  >
    {params.destName ?? 'your destination'}
  </Text>
</Pressable>

{/* Hero duration + promoted arrival */}
<View style={styles.routeHeroRow}>
  <Animated.Text style={[styles.routeHeadline, ...]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
    {recommended ? formatDuration(recommended.estimatedMinutes) : '—'}
  </Animated.Text>
  {arrivalTime && <Text style={styles.routeArrival}>arrive {arrivalTime}</Text>}
</View>
{distanceLabel && <Text style={styles.routeDistance}>{distanceLabel}</Text>}

{/* Via + daylight strip — unchanged row, bigger Via text */}
<View style={styles.routeViaRow}>
  <Text style={[styles.routeViaLabel, isRegularDestination && !viaRoad && styles.destination]} numberOfLines={1}>
    Via {viaRoad ?? params.destName ?? 'your destination'}
  </Text>
  {/* ...existing daylightStripInline View unchanged... */}
</View>

{/* Conditions line — Part 4 tail */}
<Text style={styles.routeConditionsCaption} accessibilityLabel={
  arrivalLabel ? `Safest route, ${arrivalLabel}.` : 'Safest route with current conditions.'
}>
  {arrivalLabel ? `Safest route · ${arrivalLabel}.` : 'Safest route with current conditions.'}
</Text>
```

Notes:
- The `styles.destination` (freshgreen + underline) already exists. The Via line keeps its `isRegularDestination && !viaRoad` underline gate from `fix/via-shows-road` (now redundant with the title underline but harmless in the no-road fallback — leave it, or drop it; dropping is cleaner since the title now owns the underline).
- The duration `Animated.Text` keeps its existing animated style array — preserve it.

- [ ] **Step 2: Add/adjust styles**

```ts
routeDestTitle: {
  ...typography.title3Emphasized, // 20pt — the new card title tier
  color: colors.black,
  paddingHorizontal: 24,
},
routeHeroRow: {
  flexDirection: 'row',
  alignItems: 'flex-end',
  gap: 12,
  paddingHorizontal: 24,
},
routeArrival: {
  ...typography.subheadlineRegular, // 15pt
  color: colors.labelSecondary,
  paddingBottom: 6, // baseline-align with the big headline
},
routeDistance: {
  ...typography.footnoteRegular, // 13pt
  color: colors.labelTertiary,
  paddingHorizontal: 24,
},
```

Update existing styles:
- `routeViaLabel`: `...typography.footnoteRegular` → `...typography.subheadlineRegular` (13→15pt).
- `routeConditionsCaption`: `...typography.caption1Regular` → `...typography.footnoteRegular` (12→13pt).

(`title3Emphasized`, `subheadlineRegular`, `footnoteRegular`, `caption1Regular` all exist in `theme/typography.ts`. `labelSecondary`/`labelTertiary`/`black` exist in `theme/colors.ts`.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "home.tsx"`
Expected: no output.

- [ ] **Step 4: Visual verify in simulator**

Run `npx expo start`, set a destination. Confirm: destination title shows (underlined green when it's a saved regular); "12 min" + "arrive H:MM" on one row; distance below; Via + conditions read larger; conditions shows "Safest route · arriving in daylight/at dusk/after dark."; tapping the title toggles the underline and persists (re-enter route → state holds).

- [ ] **Step 5: Commit**

```bash
git add app/home.tsx
git commit -m "feat: route-preview card redesign — title, hero+arrival, distance, bigger subtext, conditions tail"
```

## Phase A close-out

- [ ] Run the **code-reviewer** subagent on the `feat/route-preview-card` diff. Address findings.
- [ ] Append a `docs/learnings.md` entry if anything took two tries (per workflow Step 11).
- [ ] Squash-merge to main; delete the branch.

---

# PHASE B — Cloud-aware daylight engine

Branch: `feat/cloud-aware-daylight`. Independent of Phase A; can land after.

## Task B1: Add `cloud_cover` to `weather.ts`

**Files:**
- Modify: `lib/api/weather.ts`

- [ ] **Step 1: Request + type the field**

- Add `cloud_cover` to the Open-Meteo `current:` param list (currently `'temperature_2m,precipitation,wind_speed_10m,visibility'` → append `,cloud_cover`).
- Add `cloud_cover?: number;` to the raw `current` response type.
- Add `cloudCoverPct: number;` to the public `Weather` type.
- In the mapping, set `cloudCoverPct: current.cloud_cover ?? 0`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep weather`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/api/weather.ts
git commit -m "feat: weather adds Open-Meteo cloud_cover (cloudCoverPct)"
```

## Task B2: Cloud desaturation in `daylight.ts`

**Files:**
- Modify: `lib/daylight.ts`

- [ ] **Step 1: Add a desaturation helper + thread cloud through**

```ts
/** Max desaturation at 100% cloud — capped so it never goes fully gray. */
const MAX_CLOUD_DESATURATION = 0.65;

/** Blend a #RRGGBB hex toward its luminance-gray by `amount` (0..1). */
function desaturateHex(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const mix = (c: number) => Math.round(c + (gray - c) * amount);
  const h = (c: number) => mix(c).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Cloud %→ desaturation amount, capped. Exported for the card strip. */
export function cloudDesaturate(hex: string, cloudCoverPct?: number): string {
  if (cloudCoverPct == null || cloudCoverPct <= 0) return hex;
  const amount = Math.min(cloudCoverPct, 100) / 100 * MAX_CLOUD_DESATURATION;
  return desaturateHex(hex, amount);
}
```

- [ ] **Step 2: Apply it in `colorForMinutesToSunset` + `gradientSegments`**

- `colorForMinutesToSunset(minutes: number, cloudCoverPct?: number)`: wrap the existing `return <color>` paths so the returned color is `cloudDesaturate(<color>, cloudCoverPct)`. Simplest: compute the base color into a local `const c`, then `return cloudDesaturate(c, cloudCoverPct);`.
- `gradientSegments(route, cloudCoverPct?: number)`: pass `cloudCoverPct` into the `colorForMinutesToSunset(minutesToSunset, cloudCoverPct)` call (line ~153). Param optional → existing callers unaffected.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep daylight`
Expected: no output.

- [ ] **Step 4: Verify expected behavior (by reading)**

- `cloudDesaturate('#FFB347', undefined)` → `'#FFB347'` (unchanged).
- `cloudDesaturate('#FFB347', 0)` → unchanged.
- `cloudDesaturate('#FFB347', 100)` → grayer but not full gray (65% toward luminance gray).
- `colorForMinutesToSunset(120)` (no cloud) → identical to before (backward-compat).

- [ ] **Step 5: Commit**

```bash
git add lib/daylight.ts
git commit -m "feat: cloud desaturation in the daylight color engine"
```

## Task B3: Thread cloud into the `/home` card (strip + gradient + conditions tail)

**Files:**
- Modify: `app/home.tsx`

- [ ] **Step 1: Get cloud from weather**

Add (route-mode scope), using the existing weather hook:

```ts
import { useWeather } from '../hooks/useWeather'; // if not already imported
// ...
const { weather } = useWeather(userLocation);
const cloudCoverPct = weather?.cloudCoverPct;
```

- [ ] **Step 2: Desaturate the card daylight-strip stops**

The strip is a fixed `LinearGradient` with `colors={[colors.daylightDawn, colors.daylightDusk, colors.daylightNight]}`. Replace with cloud-desaturated stops:

```tsx
colors={[
  cloudDesaturate(colors.daylightDawn, cloudCoverPct),
  cloudDesaturate(colors.daylightDusk, cloudCoverPct),
  cloudDesaturate(colors.daylightNight, cloudCoverPct),
]}
```

Import `cloudDesaturate` from `../lib/daylight`.

- [ ] **Step 3: Pass cloud to the polyline + the conditions tail**

- Polyline: the home `gradientSegments(route)` calls (lines ~310, ~344) → `gradientSegments(route, cloudCoverPct)`.
- Conditions tail: `arrivalLightLabel(arrivalBand)` → `arrivalLightLabel(arrivalBand, cloudCoverPct)` (now overcast daytime arrivals read "low light").

- [ ] **Step 4: Typecheck + visual verify**

Run: `npx tsc --noEmit 2>&1 | grep "home.tsx"` → no output.
Simulator: the strip + route line read dimmer/grayer under high cloud; conditions tail flips to "low light" for a cloudy daytime arrival. (Cloud value comes from live weather; to force-test, temporarily hardcode `cloudCoverPct = 90`.)

- [ ] **Step 5: Commit**

```bash
git add app/home.tsx
git commit -m "feat: cloud-aware daylight strip, route gradient, and conditions tail on /home"
```

## Task B4: Thread cloud into the `/en-route` gradient

**Files:**
- Modify: `app/en-route.tsx`

- [ ] **Step 1: Pass cloud to `gradientSegments`**

`app/en-route.tsx` calls `gradientSegments(route)` at ~line 661. Source cloud from the en-route weather (en-route already has location; use `useWeather` the same way, or thread the existing weather value if one exists) and pass it: `gradientSegments(route, cloudCoverPct)`. If en-route has no weather hook yet, add `const { weather } = useWeather(userLocation); const cloudCoverPct = weather?.cloudCoverPct;` near the other hooks.

- [ ] **Step 2: Typecheck + visual verify**

Run: `npx tsc --noEmit 2>&1 | grep "en-route.tsx"` → no output.
Simulator: the en-route route polyline desaturates under heavy cloud.

- [ ] **Step 3: Commit**

```bash
git add app/en-route.tsx
git commit -m "feat: cloud-aware daylight gradient on /en-route"
```

## Phase B close-out

- [ ] Run the **code-reviewer** subagent on the `feat/cloud-aware-daylight` diff. Address findings.
- [ ] `docs/learnings.md` entry if warranted.
- [ ] Squash-merge to main; delete the branch.

---

## Self-review (done while writing)

- **Spec coverage:** Part 1 (layout) → A3/A4. Part 2 (tap-toggle) → A1 + A3 handler + A4 Pressable. Part 3 (cloud engine) → B1/B2 + B3/B4 threading. Part 4 (conditions tail) → A2 helper + A4 render + B3 cloud upgrade. All four parts covered.
- **Placeholders:** none — every code step has concrete code; verification uses the project's real tsc/reviewer/simulator rhythm (no invented jest).
- **Type consistency:** `removeRegularDestination`/`unmarkRegular`, `arrivalLightLabel(band, cloudCoverPct?)`, `cloudDesaturate(hex, cloudCoverPct?)`, `gradientSegments(route, cloudCoverPct?)`, `cloudCoverPct` (from `Weather`) used consistently across tasks.

## Out of scope (tracked elsewhere)

- Arrival-time cloud **forecast** (v1 uses current cloud as proxy).
- Cloud feeding the driving-conditions Good/Fair/Poor read.
- Re-applying the parked `feat/zone-flag-prefs` change to main (separate follow-up).
