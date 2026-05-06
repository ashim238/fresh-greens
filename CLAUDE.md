# Fresh Greens — Claude Code Project Orientation

This file loads automatically into every Claude Code session for this project. Read it first; it tells you what Fresh Greens is, how it's built, and how I want to collaborate.

---

## What this project is

Fresh Greens is a **thesis navigation/safety app** for Black drivers. Two complementary claims:

1. **Technical claim:** the app picks routes that maximize lighting, daylight, and familiar/safe zones — not just the fastest path. Real public data (OpenStreetMap, OSRM, SunCalc) drives the decisions through a typed adapter pipeline.
2. **Cultural / moral claim:** the app respects the lived experience of Black drivers — especially during the most dangerous interactions (traffic stops). Includes situation-specific guidance ("What to Do/Have/Say/Know"), trusted-contact notification, and community-shaped data through reporting.

Onboarding 1 frames the technical claim ("Drive like you know these roads"). Onboarding 2 frames the cultural one ("For us, by us"). Onboarding 3 frames user agency ("Your viewpoint is unique").

The thesis case turns on whether the architecture demonstrably encodes these claims, not just describes them.

---

## Tech stack

- **Expo (managed workflow) + React Native + TypeScript** — iPhone-first, Expo Go for dev.
- **expo-router** — file-based routing, `app/` directory.
- **react-native-maps** — Apple MapKit on iOS (no API key, no fee).
- **expo-location** — permission flow, current location, geocoding.
- **react-native-safe-area-context** — replaced built-in SafeAreaView (which clobbered horizontal padding).
- **suncalc** — solar geometry for the daylight gradient.
- **@expo/vector-icons** (Ionicons) — pre-installed icon font.
- **`.npmrc` with `legacy-peer-deps=true`** — Expo's recommended workaround for peer-dep conflicts.

Public data sources:
- **OpenStreetMap Overpass API** — `lit=*` highway tags + landuse polygons + parks. Free, no key.
- **OSRM public demo server** — `router.project-osrm.org` for routing. Free, has rate limits, fine for thesis demo.

---

## Architecture

Three-layer data flow. Each layer has one job. Adding a new data source or new screen doesn't ripple through the others.

```
Adapters (lib/api/*)        →   Scoring (lib/scoring.ts)        →   Screens (app/*)
"talks to outside world"        "transforms data, no I/O"            "renders"
```

### Adapters (`lib/api/`)
- `zones.ts` — calls Overpass API; returns `Zone[]` with discriminated geometry (`'polygon' | 'polyline' | 'point'`) and category (`'lighting' | 'landuse' | 'park' | 'police' | 'wildlife' | 'road-condition' | 'community-report'`). Sources covered:
  - **Lighting** (`lit=*`) → polyline zones (safe/caution/avoid by tag value)
  - **Landuse** (residential/commercial/industrial) → polygon zones
  - **Parks** (`leisure=park`) → polygon zones (caution per nighttime-crime research)
  - **Police** (`amenity=police` building/point, `highway=speed_camera` point) → caution
  - **Wildlife** (`hazard=wildlife_crossing` point, `landuse=forest`/`natural=wood` polygons) → caution; score amplified ×2 at dawn/dusk in `lib/scoring.ts`
  - **Road conditions** (`surface=unpaved|gravel|dirt|sand|ground` → caution polyline; `smoothness=bad|very_bad` → caution; `smoothness=horrible|impassable` → avoid; `highway=construction` → caution)
  - **Community reports** → point zones from `community-reports.ts`
- `community-reports.ts` — AsyncStorage-backed; returns `Zone[]` with `category: 'community-report'`. Same pipeline as OSM zones.
- `routes.ts` — calls OSRM; returns `Route[]` (candidate routes). Falls back to mock on error.
- All adapters use the same shape: typed inputs/outputs, async signature, try/catch with mock fallback, AbortController timeouts where relevant.

### Scoring (`lib/scoring.ts`)
- Pure functions — no async, no I/O, deterministic.
- `scoreRoute(route, zones, departureTime?)` — for each waypoint, dispatches per zone geometry: in-polygon for areas, near-polyline for streets (20m threshold), point-to-point for points (~30m threshold). Sums weighted scores per `SCORE_WEIGHTS`: `safe: +2, caution: -1, avoid: -5`.
- **Per-category modulation:** wildlife zones at dawn/dusk (±30 min from sunrise/sunset, computed by SunCalc against the zone's coordinates and the trip's `departureTime`) have their score multiplied by 2. Time-of-day belongs in scoring (which has trip context), not in the zones adapter (which describes what's there).
- `pickWinner(routes, zones, departureTime?)` — scores all candidates, sorts descending, marks the winner `recommended` and the rest `alternate`. Returns `RankedRoute[]`.

### Daylight gradient (`lib/daylight.ts`)
- Pure function, uses SunCalc to compute real minutes-to-sunset per route segment based on departure time + lat/lng + travel time.
- Splits route polyline into 5 segments, colors each by minutes-to-sunset (green → yellow → orange → red).
- Per `.cursorrules`: orange here is the documented daylight-encoding exception to the reserved-color rule (orange/mauve/indigo gradient — the literal colors of light from afternoon through twilight).

### Screens (`app/`)
- expo-router file-based: `app/index.tsx` = `/`, `app/onboarding.tsx` = `/onboarding`, etc.
- Modal-presented screens (`/safety`, `/pulled-over`) configured in `app/_layout.tsx` via `Stack.Screen options={{ presentation: 'modal' }}`. `/pulled-over` runs the entire pulled-over flow internally (armed → transition → guidance → contact → review) so the stack only ever has one safety modal on top of the map.
- Theme tokens consumed via spread: `{ ...typography.title1Emphasized, color: colors.white }`.

---

## Design system

`.cursorrules` at the repo root is the canonical design rulebook. Cursor reads it; you should too. Key rules summarized:

- **Reserved-color rule:** Orange / Red / Yellow / Navy reserved as UI safety signals. Documented exceptions: brand splash backgrounds (Welcome's orange sky), illustrations (Officer/Trooper navy uniform), daylight gradient on routes, zone fills (legitimate safety signaling), report-button alert icon.
- **Search bar contextual variant:** white + Elevation 3 over map/imagery; Fills/Tertiary gray + no shadow on flat surfaces.
- **Typography emotional-restraint exception:** Title1/Regular permitted on emotionally-charged screens (Contact, Trip Summary).
- **Tap targets:** iOS HIG 44×44 minimum.
- **Modal padding:** 16pt for tab-grid / card-based modals (Safety, Pulled-over, Armed-or-Not). 32pt for static-content screens (Onboarding, Permissions). Don't switch the modals to 32pt — grids won't fit.
- **Responsive search-bar / menu-row pattern:** `alignSelf: 'stretch'` + `marginHorizontal: 8` (search bar) or `16` (menu row). Hardcoded `width: 374` fails on wider iPhones (Pro Max line) — produces 28pt+ edge margins instead of intended 8pt.

Theme tokens:
- `theme/colors.ts` — type-safe color palette (Freshgreen, Wiltedgreen, Burntgreen, etc.).
- `theme/typography.ts` — iOS-style type ramp (largeTitleEmphasized, title1Emphasized, bodyRegular, bodyEmphasized, subheadlineRegular, subheadlineEmphasized, footnoteRegular, footnoteEmphasized, caption1Regular, caption2Regular).

Shared components (`components/`):
- `SearchBar` — white-elevated variant for /home; gray variant inlined in /search.
- `PageControl` — onboarding step dots, used on Onboarding pager and Permissions.
- `TrustedContactStatus` — animated pulse dot + "Your trusted contact is being notified" copy. Used across the safety flow.

---

## What's shipped

Onboarding flow:
- Welcome (`/`) — title, subtitle, terms, two CTAs, illustrations (Vic, sun, hill).
- Get Started (`/get-started`) — three "Continue with" auth buttons, divider, login prompt. Visual-only auth.
- Onboarding pager (`/onboarding`) — three swipeable panels (FlatList horizontal + pagingEnabled).
- Permissions (`/permissions`) — real `expo-location` permission flow, Settings deep-link on denial.

Map / routing:
- Home (`/home`) — full-bleed Apple Maps, real OSRM routes, real OSM zone data, real solar daylight gradient on the recommended route polyline. Bottom sheet shows the route's "why" (estimated time, destination name, tradeoff explanation).
- Search (`/search`) — gray search bar (Fills/Tertiary), Quick Tools row (Saved/Trending/Food/Gas/Parking), Fuel section, Recent searches. `Location.geocodeAsync` for forward geocoding.
- `SHOW_ZONES` constant in home.tsx — toggle for thesis screenshots showing the data layer; default `false` (clean user view).

Safety flow:
- Safety modal (`/safety`) — 2x2 tab grid entry point.
- Pulled Over (`/pulled-over`) — single consolidated modal containing the entire pulled-over flow as an internal state machine. Phases: `armed` (Yes/No/Prefer-not-to-answer) → `transition` ("We'll walk you through what to do.", auto 3s) → `guidance` ("Read the following" bullets + persistent recording widget + Read-aloud via `expo-speech` + Continue) → `contact` (Trusted contact: Call/Text/Review-guidance link) → `review` (5 sub-views: Officer/Trooper → Do → Have → Say → Know, chevron nav). Recording timer starts on the armed answer and runs through the rest of the flow; no stop button — recording is ambient protection that ends when the modal dismisses. Firearm-conditional guidance (`armed=yes` or `preferred-not-to-answer`) appears in both the guidance bullets and the "What to Say" review sub-view, kept consistent. Consolidation replaced what used to be four stacked modals so one swipe-down exits the whole flow back to /home.

Infrastructure:
- Theme tokens + design rules consolidated.
- Two Figma fidelity audit passes done.
- `docs/workflow.md`, `docs/learnings.md`, `docs/react-basics.md` capture working conventions.

---

## What's NOT shipped (current focus)

### Community reporting — open iteration items

The reporting flow itself is shipped (`/report` modal: picker → detail → thank-you, AsyncStorage adapter, six categories with score weights, anonymity auto-on for sensitive categories). Open follow-ups:

- **Home-screen entry mechanic — design call needed.** Currently /home's Report button opens `/report` with the user's GPS as the report location. The original intent was a richer interaction. Two candidate mechanics:
  1. **Drag-to-place:** drag the Report button itself onto the map; release to drop the pin; modal opens at that location.
  2. **Tap then drag:** tap Report → a draggable marker appears anchored to the user's current location → user drags it to refine → confirm to open the modal.
  Drag-to-place is more direct but cramps the map's pan gesture during the drag; tap-then-drag is two-step but composes cleanly with map navigation. Pick before building. (En-route's entry point stays current-GPS — the driver isn't placing pins mid-drive.)
- **v2 inputs.** Preset checkbox sub-tags per category, deferred from v1 until we have submission data telling us which sub-types matter.
- **Real backend.** Replace the AsyncStorage adapter internals; public surface (`addCommunityReport`, `getCommunityReportsAsZones`) already designed to swap.

### Safety flow — open follow-ups

The pulled-over flow shipped as a single consolidated `/pulled-over` modal (state machine, see "What's shipped" above). Remaining items:

- **Real audio waveform.** The recording widget currently shows label + timer + pulse dot. Hardcoded waveform bars were stripped because they implied real audio levels but were static placeholders. Real waveform needs `expo-av` amplitude metering — its own PR.
- **Real call/text wiring.** Contact phase's Call and Text buttons are visual-only. Wire `Linking.openURL('tel:…')` / `sms:…` once a real trusted-contact data model exists.
- **Trusted contact data model.** Currently a hardcoded `CONTACT_NAME = 'Myles Ashitey'` placeholder. Needs auth + contact picker before Call/Text become real.
- **Officer / Trooper character illustrations** (review sub-view 0) — currently Ionicons placeholders.

### Routing formula — v2 follow-ups

All four thesis factors (light, police, wildlife, road conditions) are now covered through OSM via `lib/api/zones.ts`. Heavier integrations queued, not blocking:

- **TIGER/Line** — road-classification overlay for unmapped roads. Bigger lift than v1; needs per-region pre-extract or backend endpoint. Scope to demo region (Mobile, AL) when picked up.
- **State DOT 511** — real-time construction/incident feed (ALDOT for the demo region). Single-state integration, fits the adapter pattern. Would replace the OSM `highway=construction` signal (which lags real-time by weeks).
- **FEMA + NOAA flooding** — flood-zone (static) + real-time water level / advisory data. Especially relevant to New Orleans use cases per thesis evidence. Temporal/real-time concern — different data shape than OSM.

### Polish / smaller gaps

- Welcome illustrations: clouds + wind (vic, sun, hill are in; sky elements are missing).
- Onboarding panel illustrations (steering wheel, sitting figure with thought bubble, thinking figure).
- Permissions: real location-pin + car illustration (currently Ionicons placeholders).
- Officer / Trooper character illustrations (currently Ionicons placeholders).
- ~~Daylight gradient color consistency.~~ ✅ Resolved in `chore/figma-fidelity-audit-3`. `lib/daylight.ts` polyline now uses orange→mauve→indigo to match the bottom-sheet strip. Polyline and legend share one canonical gradient.
- Real "Schedule for X:XX AM" computation using SunCalc + route duration.
- Custom map markers (saved home, trusted friend, location landmarks).
- /login screen (Welcome's "Have an account?" still TEMP-wired to /onboarding).

### Out-of-scope for thesis (defer)

- Real auth backend.
- Real community-report storage backend.
- Real-time live re-routing.
- Real turn-by-turn instructions on /en-route (basic en-route screen exists; copy is static placeholder until a routing engine that gives instructions, not just geometry, is integrated).
- Trip Summary screen variants.
- Roadside / Unfamiliar / Share-location safety sub-flows.

---

## Workflow conventions

Per `docs/workflow.md`. Summary:

1. **Branch first.** `git checkout -b feat/<screen>` or `chore/<thing>` before editing. The most common slip in this project has been forgetting to branch and committing on main.
2. **Pull Figma node** via MCP before building. Designs are the source of truth.
3. **Decide scope of v1** — illustrative assets typically deferred.
4. **Build, iterate on phone** — Save → Expo Go reloads.
5. **Self-review the diff** before committing.
6. **Conventional commit messages.** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`. Include Figma node ID in parens for `feat:` commits.
7. **Open a PR**, even solo. Self-review the diff on GitHub (different mode of reading than Cursor; catches things).
8. **Add a learnings entry** to `docs/learnings.md` per PR. One-liner per non-obvious takeaway. Newest at top.
9. **Every ~5 PRs (or after any heavy structural one), run a Figma fidelity audit.** Branch `chore/figma-fidelity-audit-N`, diff every shipped screen against its Figma node, fix drift in one PR. See `docs/workflow.md` step 12 for the checklist. Audits reset the baseline — without them, every feature builds on a slowly eroding fidelity floor.

---

## How I want to collaborate

These have been earned through iteration; preserve them.

- **Comprehension over speed.** Explain *why* you chose an approach and what the tradeoffs are. I value learning the reasoning, not just receiving working code. New concepts get a brief walk-through inline.
- **Push back when I'm about to do something inconsistent.** If I propose a change that violates the design system or contradicts a documented learning, say so before implementing.
- **Anchor to Figma — except where iOS HIG says otherwise.** "Lands but feels off" feedback is usually signal that a structural pattern was missed (typically `flex-1 + justify-*` for "fill remaining space"). Match the hierarchy, not just the gap values. **But:** when Figma conflicts with iOS HIG (most often on tap targets), HIG wins. The design source of truth is the *intent*, and the platform constraint is part of the intent. A 36pt button at 44pt is still the design — visually faithful, behaviorally correct.
- **Diligent on widths and devices.** Hardcoded widths (`width: 374`) fail on wider iPhones. Default to `alignSelf: 'stretch' + marginHorizontal: <n>` for responsive sizing.
- **Don't extract before the third use.** Rule of three. Inline twice; extract on the third.
- **Pair scoring weights / data shape decisions to thesis claims.** When adding a new data source or category, walk through how it maps to the existing `Zone` / `ZoneType` model before designing the screens.

---

## Where to read for more

- `.cursorrules` — design system rules (read every session).
- `docs/workflow.md` — per-PR rhythm and recipe.
- `docs/learnings.md` — running journal, newest at top. Re-read entries for recent PRs to refresh on accumulated context.
- `docs/react-basics.md` — quick-flip reference for React/RN syntax I've explained over the project.
- `docs/next-session.md` — ephemeral "what's queued *right now*" — may be deleted in favor of this file's "What's NOT shipped" section.
- `theme/colors.ts`, `theme/typography.ts` — design tokens.
- `lib/api/*`, `lib/scoring.ts`, `lib/daylight.ts` — the data + scoring pipeline.

---

## Useful Figma references

- File: `7DDh6c7tk7OKF4WiA7pEkp` (Thesis_Draft_Final).
- Root canvas: `825:3161` ("Flow tab").
- Welcome: `825:3162`. Get Started: `825:3245`. Permissions: `825:3585`.
- Onboarding panels: `825:3382` / `825:3444` / `825:3525`.
- Home (Established): `825:3625` (recently updated with Report button).
- Home (Route Established): `825:3635` (the variant our bottom sheet was built against).
- Search Landing: `825:4987`. Search Typed: `825:5017`.
- Safety Modal: `825:3875`. Pulled Over (Officer/Trooper): `825:3957`. Armed or Not: `825:4034`.
- What to Do/Have/Say/Know: `825:4386` / `825:4533` / `825:4599` / `825:4724`.
- Contact: `825:4791`. Back to Nav: `825:4869`. Pop-up Modal (Trip Summary): `825:4908`.

When pulling, use `mcp__figma__get_design_context` with `fileKey=7DDh6c7tk7OKF4WiA7pEkp`. Designs lag the code occasionally — re-pull before claiming an audit item is "still live."
