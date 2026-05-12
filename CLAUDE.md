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

### Why zones exist

Hazard avoidance has a ceiling: even the highest-scoring route passes through risky territory somewhere. Zones are how the app makes that honest. Drawing from the same public databases that produce individual markers (lighting points, police buildings, wildlife crossings, road-condition tags), zones aggregate them into shapes — polygons over areas of higher marker saturation, polylines over streets that share a tag value. For lighting the inversion holds: a zone signals *low* saturation (the absence of streetlights, not their presence). The scoring layer reads zones to penalize or reward routes; the en-route layer surfaces them visually when concentration crosses a threshold (see hazard-notice item under "What's NOT shipped").

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
- **Asset format default: SVG.** When Figma provides a vector source, default to SVG (`react-native-svg-transformer` resolves the import to a real component, scales clean at every density). PNG is the exception, reserved for photographic content **and for Figma layers that use image fills** (raster textures inside vector shapes — these export as `<pattern>` elements with embedded base64 rasters, which `react-native-svg` renders unreliably: scaling wrong, tiling/wrapping incorrectly). Past mistakes — onboarding panels, get-started cars — shipped as 1x PNGs and went visibly blurry on retina at any size above ~48pt. The threshold worth remembering: **if the asset is over ~48pt in either dimension and the Figma layer is pure vector, export as SVG. If the layer has image fills, export as @3x PNG instead.** Figma's "Flatten" command merges paths but does NOT remove image fills, so it doesn't rescue an image-fill SVG — only changing the fill type at the source does. Welcome's Vic is the canonical case: hand-painted texture inside vector shape, ships as `welcome-vic.png` exported at 3x density (498×677) and displayed at 166×226 — Metro downsamples on render. Note the filename has no `@3x` suffix: Metro reads `@Nx` as a density tag and expects a 1x base file alongside, so a single high-density bitmap is referenced as a plain filename.

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
- Welcome (`/`) — title, subtitle, terms, two CTAs, illustrations (Vic, sun, hill). Auto-redirects signed-in users to `/home` so returning users skip the entire intro.
- Get Started (`/get-started`) — three "Continue with" auth buttons. **Apple Sign In is real** (via `expo-apple-authentication`); Google + Email are visual-only placeholders. First-time users route to `/onboarding`; returning users (already in storage) route directly to `/home`.
- Login (`/login`) — returning-user auth entry. Mirrors Get Started's visual register; Apple Sign In always routes to `/home` (skips onboarding). "Don't have an account? Sign up" → `/get-started`.
- Onboarding pager (`/onboarding`) — three swipeable panels (FlatList horizontal + pagingEnabled). Page 1–3 of 5.
- Permissions (`/permissions`) — real `expo-location` + `expo-audio` (mic) permission flow, Settings deep-link on denial. Page 4 of 5. Mic moved here from mid-stress in /pulled-over so the prompt shows during calm onboarding.
- Trusted Contact Setup (`/trusted-contact-setup`) — page 5 of 5. iOS-native contact picker via `expo-contacts`; selected contact stored in AsyncStorage and read by /pulled-over's contact phase. Skip allowed (Call/Text show as disabled in /pulled-over until set).

Auth + identity:
- `lib/api/user.ts` — AsyncStorage-backed user adapter (`getStoredUser` / `setStoredUser` / `clearStoredUser` / `upsertUser`). Same adapter pattern as community-reports; backend swap-in point for the future. `User` type holds id, provider, displayName, email, derived initials, and signedInAt timestamp.
- `hooks/useUser.ts` — reactive wrapper. Exposes `{ user, loading, signInWithApple, signOut }`. Apple's first-sign-in-only `fullName`/`email` are merged via `upsertUser` so returning sign-ins don't overwrite cached identity with nulls.
- `lib/api/trusted-contact.ts` — AsyncStorage-backed trusted-contact adapter (`getTrustedContact` / `setTrustedContact` / `clearTrustedContact`). Stores only what the safety flow needs (id, name, initials, phone, setAt) — not the full Contact, for both privacy and storage-size reasons.
- `hooks/useTrustedContact.ts` — reactive wrapper. Exposes `{ contact, loading, pickContact, clearContact }`. `pickContact` opens iOS's native picker via `expo-contacts`'s `presentContactPickerAsync`, normalizes to our shape, and persists.

Settings:
- Settings (`/menu`) — pushed from /home's avatar button (top-right of the menu row). Wiltedgreen page background, brand-cohesive with the auth/onboarding/contact-setup register. Layout (after the menu-hub rework, Waze-flavored):
  1. Header: back chevron only (profile row carries the page identity, no separate "Settings" title).
  2. Profile row: burntgreen-circle avatar with a Phosphor `Car` glyph (TODO: swap for the custom car asset the user is making) + "Hey {firstName}" greeting in `title2Emphasized` + email. Renders at opacity 0.5 with no chevron and no tap until `/profile` ships — matches the Settings/Schedule/Theme inert pattern, so "future destination" reads consistently across the menu (per audit 7).
  3. Divider on dark (fadedgreen at 25%, defined as `colors.dividerOnDark`).
  4. Settings rows in the ScrollView: white-circle 36pt icon tiles + 24pt wiltedgreen Phosphor duotone glyphs + label + chevron. Real entries: **Zone Settings** (accordion — tap toggles `LayoutAnimation.easeInEaseOut` reveal of the in-menu "Show zones overlay" Switch wired to `usePreferences`), **Safety** (pushes to `/safety-settings`). Inert TODO entries: Settings, Schedule a drive, Theme — render at 0.5 opacity with no chevron and no `onPress`.
  5. Quick-settings carousel pinned above Sign out (outside the ScrollView): rectangular icon-on-left/title-and-subtitle-on-right tiles, ~80% screen width with peek of next tile, swipeable via `snapToInterval`, page indicator dots below. v1 tiles: Fuel (custom SVG from Figma 825:4997, subtitle copy verbatim from 825:5001) and Notifications (custom SVG, mirrored subtitle register). Tiles are visually inviting (no opacity dim) but tap is no-op — the "what this does" subtitles invite action without lying about defaults.
  6. Sign out at the very bottom (outside the ScrollView, pinned via SafeAreaView's bottom edge): centered, quiet, `subheadlineRegular` fadedgreen text — no pill, no icon. Clears stored user + trusted contact and routes to `/`.
- Safety Settings (`/safety-settings`) — pushed from /menu's Safety row. Hosts safety-flow preferences. v1 rows: Trusted Contact (re-uses `/trusted-contact-setup?from=settings`) and Recordings (pushes to `/recordings`, value-line shows `"3 recordings"` / `"None yet"` from `useRecordings()`). Future safety prefs slot in as additional rows.
- Recordings (`/recordings`) — pushed from /safety-settings. Lists every saved audio capture from /pulled-over, newest-first. Single shared expo-audio player swaps sources via `player.replace({ uri })` so only one row plays at a time; play/pause toggles on the active row, auto-resets on `didJustFinish`. Trash affordance per row deletes file + metadata. Empty state explains recordings come from the safety flow, not from a "record now" button. Visual register matches /menu and /safety-settings (wiltedgreen background, burntgreen card fills, white-circle play button).
- `lib/api/recordings.ts` — AsyncStorage-backed Recordings adapter. Same shape as user/trusted-contact/preferences. Two layers of storage: audio file in `Paths.document/recordings/` (persistent across cold starts) and metadata (id, uri, createdAt, durationMs, armed) in AsyncStorage. Uses expo-file-system v19's class-based API (`new Directory`, `new File`, `file.copy`, `file.delete` — most ops synchronous, unlike v18's procedural `FileSystem.copyAsync`).
- `hooks/useRecordings.ts` — reactive wrapper. Exposes `{ recordings, loading, addRecording, removeRecording }`. Each consumer reads its own snapshot (loaded once on mount); /pulled-over saves to AsyncStorage, /recordings refetches on next mount via expo-router's stack remount.
- `lib/api/preferences.ts` — AsyncStorage-backed Preferences adapter. Same shape as user/trusted-contact. Currently holds a single `showZones` toggle; grows as more user-facing prefs ship.
- `hooks/usePreferences.ts` — reactive wrapper. Exposes `{ preferences, loading, setShowZones }`. Toggling in /menu writes to AsyncStorage; /home reads `preferences.showZones` to render or hide the zone overlay. The `SHOW_ZONES` debug constant in home.tsx is gone — overlay rendering is a real user preference now.
- The avatar button on `/home` uses the same Phosphor Car as `/menu`'s profile glyph (28pt at home, larger at menu). Same iconography across surfaces — user reads as a "car-in-the-system" everywhere. Different colors signal role: freshgreen for the trusted-friend pin, fadedgreen for the user's own car.
- Custom SVG asset infrastructure: `react-native-svg-transformer` registered in `metro.config.js`, imports typed via `types/svg.d.ts`. `import FuelIcon from '...fuel.svg'` resolves to a real `react-native-svg`-backed component that scales cleanly at any size.

Map / routing:
- Home (`/home`) — full-bleed Apple Maps, real OSRM routes, real OSM zone data, real solar daylight gradient on the recommended route polyline. Bottom sheet shows the route's "why" (estimated time, destination name, tradeoff explanation). Avatar button top-right opens `/menu`.
- Search (`/search`) — gray search bar (Fills/Tertiary), Quick Tools row (Saved/Trending/Food/Gas/Parking), Fuel section, Recent searches. `Location.geocodeAsync` for forward geocoding.
- `SHOW_ZONES` constant in home.tsx — toggle for thesis screenshots showing the data layer; default `false` (clean user view).

Safety flow:
- Safety modal (`/safety`) — 2x2 tab grid entry point.
- Pulled Over (`/pulled-over`) — single consolidated modal containing the entire pulled-over flow as an internal state machine. Phases: `armed` (Yes/No/Prefer-not-to-answer) → `transition` ("We'll walk you through what to do.", auto 3s) → `guidance` ("Read the following" bullets + persistent recording widget + Read-aloud via `expo-speech` + Continue) → `contact` (Trusted contact: real avatar/name/initials read from `useTrustedContact`, Call/Text use `Linking.openURL('tel:'/'sms:')`. When no trusted contact is set, the avatar block becomes a tappable "Add a contact" affordance — UserPlus glyph + label + no pulse — that opens the iOS picker via `pickContact()` so users who skipped onboarding can recover mid-stop) → `review` (5 sub-views: Officer/Trooper → Do → Have → Say → Know, chevron nav). Recording timer starts on the armed answer and runs through the rest of the flow; no stop button — recording is ambient protection that ends when the modal dismisses. **Save lifecycle:** `usePreventRemove(hasActiveRecording, …)` blocks the dismiss while we await `recorder.stop()` + `addRecording(...)`, then dispatches the original action. Avoids `NativeSharedObjectNotFoundException` from racing `useAudioRecorder`'s own teardown in a useEffect cleanup. Firearm-conditional guidance (`armed=yes` or `preferred-not-to-answer`) appears in both the guidance bullets and the "What to Say" review sub-view, kept consistent. Consolidation replaced what used to be four stacked modals so one swipe-down exits the whole flow back to /home.

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

- ~~**Real audio waveform.**~~ ✅ Shipped in `feat/recording-contact` — live mic-driven waveform via `expo-audio` metering, falls back to flat baseline when permission denied.
- ~~**Real call/text wiring.**~~ ✅ Shipped in `feat/trusted-contact-end-to-end` — Call/Text use `Linking.openURL('tel:…')` / `sms:…` against the stored trusted-contact phone number. Disabled state when no contact set.
- ~~**Trusted contact data model.**~~ ✅ Shipped in `feat/trusted-contact-end-to-end` — `lib/api/trusted-contact.ts` adapter + `useTrustedContact` hook + `/trusted-contact-setup` onboarding screen + iOS-native picker via `expo-contacts`.
- **Officer / Trooper character illustrations** (review sub-view 0) — currently Ionicons placeholders.
- ~~**State-aware firearm guidance (V2).**~~ ✅ Shipped in `feat/state-aware-firearm-guidance`. `lib/api/gun-laws.ts` maps every US state + DC to one of three `DisclosureDuty` variants (`duty-to-inform` / `no-duty` / `asked-only`); `useDisclosureDuty` resolves the user's state via on-device `Location.reverseGeocodeAsync` and exposes the variant to `/pulled-over`, which now reads the firearm bullet on the guidance phase and the firearm `sayBullets` on the What-to-Say review sub-view from a single `FIREARM_GUIDANCE` record. Defaults to `duty-to-inform` while loading and on every failure path — the asymmetric error cost (following no-duty copy in a duty-to-inform state is unlawful; the reverse is merely unnecessary) makes over-disclosure the safer default when uncertain.

### En-route — open follow-ups

- **Hazard notice on the primary turn card.** The recommended route is the *highest-scoring* route, not a hazard-free one. When a turn passes through a high-saturation zone, the primary turn card surfaces a hazard symbol — a heads-up that "this turn is on your safe route, but be aware." Without it the app over-promises ("we picked safe" reads as "no hazards exist"). Four symbols match the four data categories: **lighting, police, wildlife, road-condition**. Community reports drive triggers too — they already flow through `lib/scoring.ts`, so a saturation of recent reports near a turn lights up the relevant category symbol with no separate plumbing. **A turn shows at most two symbols at once** — when more than two categories cross threshold, worst-first wins; the cap keeps the card readable mid-drive (three or four icons would degrade into noise faster than the driver can parse). Trigger is threshold-based (multiple markers within X meters of the turn), not "any zone touched." Implementation outline: `lib/scoring.ts` gains a pure `hazardsNearTurn(turn, zones)` helper that returns the set of categories crossing threshold; the en-route screen reads it per turn and renders up to two matching symbols on the turn card. Figma component: 4-variant hazard symbol on the Draft tab — node ID TBD; pull when implementing.
- **Zone-entry auto-expand — verify on a real driving session.** `feat/en-route-zone-entry-auto-expand` ships the auto-expand-on-zone-entry behavior (sheet pops up + Warning haptic when the user crosses into a caution/avoid OSM zone; auto-collapses after 5s). Code path verified via manual drag-handle toggle; the auto-trigger requires `watchPositionAsync`'s 5m-movement threshold to fire, so it can't be tested stationary. Repro options: (a) walk through a known lighting/wildlife polygon, (b) iOS Simulator → Features → Location → "Freeway Drive" through a known zone area, (c) wait for a real drive. Flag in next audit if the auto-expand doesn't fire on a verifiable zone-entry — likely culprit would be `enteredZoneIds` not updating because of a useMemo stale-deps issue.

### Routing formula — v2 follow-ups

All four thesis factors (light, police, wildlife, road conditions) are now covered through OSM via `lib/api/zones.ts`. Heavier integrations queued, not blocking:

- **TIGER/Line** — road-classification overlay for unmapped roads. Bigger lift than v1; needs per-region pre-extract or backend endpoint. Scope to demo region (Mobile, AL) when picked up.
- **State DOT 511** — real-time construction/incident feed (ALDOT for the demo region). Single-state integration, fits the adapter pattern. Would replace the OSM `highway=construction` signal (which lags real-time by weeks).
- **FEMA + NOAA flooding** — flood-zone (static) + real-time water level / advisory data. Especially relevant to New Orleans use cases per thesis evidence. Temporal/real-time concern — different data shape than OSM.

### Polish / smaller gaps

- ~~Welcome illustrations: clouds + wind.~~ ✅ Shipped in `feat/illustrations`, then re-architected as individual animated layers in `feat/welcome-cloud-animation`. Welcome renders 13 SVG layers from Figma 825:3163 plus one PNG (Vic) inside a 390×846 bottom-centered backdrop scene. Vic stays a PNG (`welcome-vic.png`, 498×677 source displayed at 166×226) because his Figma source uses image fills — see the Asset format rule under Design system for the exception clause. The 7 cloud + 3 wind elements wrap in a `Drift` helper that runs `Animated.loop` translateX oscillation with `Easing.inOut(Easing.sin)` + `useNativeDriver: true`; per-element durations spread across 2.8s–5.8s naturally desync them. Content (title, terms, buttons) overlays via SafeAreaView.
- ~~Onboarding panel illustrations.~~ ✅ Shipped in `feat/illustrations` — each panel renders its illustration as a bottom-anchored full-width Image (`onboarding-1.png` / `-2.png` / `-3.png`, cropped from the Figma panel screenshots at y=369-720 to exclude the Continue/Skip overlay). Uses `aspectRatio: 390/351` so the image scales proportionally on wider iPhones.
- ~~Permissions: real location-pin + car illustration.~~ ✅ Shipped in `feat/illustrations` — `permissions-location.svg` (rotated 17.72° in a 35.9×40.4 wrap to match Figma) + `permissions-car.svg` (57×40), imported as `react-native-svg` components.
- ~~Officer / Trooper character illustrations.~~ ✅ Shipped in `feat/illustrations` — `officer.png` (100×157) and `trooper.png` (100×171) PNGs in 120×172 wrappers (Officer anchored to bottom, Trooper centered). Trooper's yellow-shield hat badge is a separate SVG (`trooper-hat-badge.svg`) layered on top at top:36/left:52 within the wrapper, computed from Figma's inset-[20.99%_43.22%_68.99%_43.23%] against the wrapper's 120×172 dimensions.
- ~~Daylight gradient color consistency.~~ ✅ Resolved in `chore/figma-fidelity-audit-3`. `lib/daylight.ts` polyline now uses orange→mauve→indigo to match the bottom-sheet strip. Polyline and legend share one canonical gradient.
- ~~Real "Schedule for X:XX AM" computation using SunCalc + route duration.~~ ✅ Shipped in `feat/schedule-for-am` — `suggestedDepartureForDaylight(route, now)` in `lib/daylight.ts` returns a Date when leaving later genuinely buys more daylight (currently: pre-sunrise departures get sunrise+15min, capped to a 3-hour look-ahead), `null` otherwise. /home renders "Schedule for 7:38 AM" via the new `formatTimeOfDay` helper in `lib/format.ts`; the chip and its rationale copy ("Heads up! You can leave in a bit…") only render when a suggestion exists, so mid-day departures hide both rather than showing a meaningless time.
- ~~Custom map markers (saved home, community reports).~~ ✅ Shipped across three PRs. `feat/map-markers-and-edge-indicators` set up the foundation: `lib/api/saved-places.ts` adapter + `useSavedPlaces` hook + `MapMarker` component (circular pip, used for saved home with a Phosphor House glyph; saved via long-press on the map → `Alert.alert` confirm). `feat/map-marker-icons-from-figma` layered the Figma-faithful **`LandmarkMarker`** component. `feat/landmark-marker-green-variant` added the 4th `positive` variant from Figma `1044:2667` (corrected spelling — Figma labels it "Postive") and replaced every Ionicons fallback with the picker's illustrated SVG glyphs. Final mapping: `black-owned` → black pin, `felt-welcome` → green pin, `felt-unsafe`/`incident`/`lighting`/`hazard` → orange pin, with each category's inner glyph being the same SVG that renders in the `/report` picker tile. `Zone.reportCategoryId` (optional) carries the category id off the community-reports adapter so the marker variant + glyph reflect the submission. **Trusted-friend marker plumbing shipped** in `feat/trusted-contact-location` — `lib/api/trusted-contact.ts` gained optional `latitude` / `longitude` / `addressLabel`; `useTrustedContact.pickContact` now opportunistically re-fetches the picked contact with Addresses + geocodes via `Location.geocodeAsync`. /home renders a green `LandmarkMarker` (`categoryId="trusted-friend"`) + off-viewport `EdgeIndicator` when a real lat/lng exists. Inner glyph is a Phosphor `HeartStraight` stand-in until Figma `1133:13245` is exported.
- ~~Off-viewport indicators pointing to nearby places of interest.~~ ✅ Shipped in `feat/map-markers-and-edge-indicators` — `lib/edge-indicators.ts` pure utilities (bearing + ray-rectangle intersection) + `EdgeIndicator` component (32pt pill on the screen edge with rotation matching the bearing; counter-rotated child glyph stays upright). Tap recenters the map on the POI via `animateToRegion`. Driven by `mapRegion` state from `onRegionChangeComplete` and viewport size from the MapView's `onLayout`.
- ~~/login screen (Welcome's "Have an account?" still TEMP-wired to /onboarding).~~ ✅ Shipped in `feat/auth-apple-signin` along with real Apple Sign In.
- ~~**Custom car illustration for the user's identity glyph.**~~ ✅ Shipped in `feat/user-car-glyph`. `assets/illustrations/user-car.svg` (24×24 viewBox) now renders at 28pt inside both /menu's 48pt profile-hero circle and /home's 48pt avatar button. Phosphor `Car` import retired from both files. Same treatment as fuel.svg + notification.svg.
- ~~/home menu button (top-left) → /menu rewire.~~ ✅ Shipped in `chore/safety-button-rewire`. /home's hamburger now pushes to /menu instead of /safety. /safety is reached via the navy duotone Shield in /en-route's side-button column (Phosphor Shield with `weight="duotone"` and `color={colors.navy}`); the previous wiltedgreen Ionicons placeholder is retired. Added `colors.navy: '#041E49'` to the palette as the canonical safety-affordance blue (matches Figma 825:3754's en-route shield).
- **Deeper menu design assessment** queued for the next Figma fidelity audit. /menu shipped without a Figma reference (extrapolated from brand tokens + Waze pattern); next audit should diff each region against any sketches that land between now and then, especially: hero proportions, divider weight, tile peek balance, signOut bottom inset on different device classes.
- **Bulk SVG export for custom Figma glyphs** queued for the next Figma fidelity audit. Several screens still render Ionicons stand-ins where the Figma uses custom illustrated glyphs that haven't been exported yet. Known targets: /en-route side-button column (Volume, Help, Recenter — Shield + Report already match Figma), the turn maneuver arrow on /en-route's turn card (Phosphor `ArrowBendUpLeft regular` is a stand-in for the custom Figma turn-sign), the turn-card mic, and any others surfaced during the audit pass. Workflow: branch `chore/svg-bulk-import-N`, designer exports each frame as SVG to `assets/illustrations/`, batch-wire them into the screens in one PR, drop the Ionicons imports. Same flow used for onboarding panels in #60 and Vic in `fix/onboarding-illustrations-svg` — it's the documented path for Figma-vector → RN component.
- ~~**`local-business` (gray) variant cleanup.**~~ ✅ Resolved in `chore/design-token-discipline-pass`. Deleted from the `Variant` type union in `components/LandmarkMarker.tsx`, removed from the consuming records in `components/EdgeIndicator.tsx` and `components/ReportDetailCard.tsx`, and the three `mapmarker-{bg,glyph,pin}-localbusiness.svg` assets pulled. LandmarkMarker's docstring now notes the deletion + restore path; the Figma source still has the 4-variant component but the green pin (`positive`) covers our current use cases.
- ~~**`caption2Regular` readability pass.**~~ ✅ Resolved in `chore/design-token-discipline-pass`. Decision: keep `caption2Regular` at 11pt for ornamental use; informational content migrates to `caption1Regular` (12pt). Migrated: `components/EdgeIndicator.tsx`'s cluster-count badge. Retained on caption2: `app/index.tsx`'s Welcome screen terms-of-service fine print (legal copy, ornamental per Apple's pattern). Token doc-comment in `theme/typography.ts` records the rule so future usage stays disciplined.
- ~~**Caption-tier line-height relaxation.**~~ ✅ Resolved in `chore/design-token-discipline-pass`. `caption2Regular.lineHeight` bumped 13 → 15 (1.36×) — visually invisible in normal use, meaningful for low-vision and stress-state reading.

### Design-system v2 — handoff snapshot (2026-05-12)

A multi-PR redesign port from the v2 Figma file (`7DDh6c7tk7OKF4WiA7pEkp`, Components page `1133:12986` + Final flow page `1100:5549`). Shipped across 7 PRs (#74–#79). The app is in a coherent v2 state for everything except /home's bottom sheet, /en-route's bottom sheet, the safety modal flow, /pulled-over, and /report — those screens still render the v1 design and need their own dedicated ports.

**Shipped in v2:**
- Foundational components: `Button` (Type × Fill variants with type-narrowed Figma constraints), `SearchBar` (3 states), `StateCard` (EmptyState + LoadingState + ErrorState), `FloatingActionButton` (48/56), avatar PNG.
- Screens redesigned: Welcome, /menu + /sign-out (new), /search (with Nominatim POI search + debounced autocomplete), /onboarding, /permissions, /trusted-contact-setup, /recordings.
- Map: route polyline gradient stable across re-renders (memoized), Speed Limit sign on /en-route (GPS-fed current speed + hardcoded 25 mph limit), Trash icon swapped to Phosphor on /recordings.

**Known limitation:** the white route halo from Figma is intentionally dropped — `react-native-maps`'s `Polyline` doesn't expose `zIndex`, and iOS MKMapView paint-order isn't reliably controllable across re-renders. Apple Maps takes the same approach (colored stroke alone, no halo). Revisit only if a custom native module or a different map library lands.

**Components on the Figma Components page NOT yet ported, by thesis-defense impact:**

High-impact (defense-critical, gated by data or thesis-feature work):
- **Trusted Friend marker** (`1133:13245`) — encodes the "community-shaped data" claim. Blocked on adding lat/lng to `lib/api/trusted-contact.ts` first; one-feature follow-up.
- **Hazard icons** — 4 variants Light/Road/Deer/Eye (`1133:13397`) — powers the en-route hazard notice on turn cards. Already queued under "En-route open follow-ups" above.
- **Turn Sign** (`1133:13396`) — partially inline on /en-route; needs the hazard-icon row + the redesigned typography per the v2 frame `1109:3527`.
- **Safety modal icons** (`1133:13935`) — 4 custom illustrations (Pulled-over / Car troubles / Lost / Share location) replacing the current Ionicons stand-ins on /safety.
- **Map Marker on-tap state** — newer Figma variants on the existing 4-variant Map Marker (`1133:13418`) showing the marker in a "tapped/expanded" state. /home's `ReportDetailCard` partially covers this functionally but doesn't match the v2 marker styling.

Medium (bottom-sheet rewrites — substantial, need their own PRs):
- **Bottom Sheet / Home Full + Collapsed** (`1133:13690`) — /home's bottom-sheet redesign. New layout adds a destination-with-caption header ("Jordan's Local Recs 💃🏾"), a weather + driving-conditions card on the right, a "Things to Do: Black Owned" recommendation card section. Needs a weather data adapter and a POI/recommendation data source neither of which exist yet — likely a multi-PR effort.
- **Bottom Sheet / En-route / Collapsed + Full** (`1133:13328` + `:13329`) — /en-route bottom-sheet redesign. New layout has a 34pt ETA badge in freshgreen with bracketing FABs, plus a different expanded state. Less data-dependent than /home's; the Speed Limit sign already landed.
- **Bottom Sheet (Marker)** (`1133:13853`) — tap a community-report marker → bottom sheet appears with details. Today the inline `ReportDetailCard` component covers this functionally; the redesign would consolidate it into the unified bottom-sheet system.
- **Tile carousel** (`1133:13854`) — the /menu Fuel + Calendar tile pattern. Could be shared with /search if extracted.
- **Dropdown + Expanded** (`1133:13859` + `:13956`) — inline in /menu's Zone Preferences; the redesigned variants might be cleaner to consume as a shared `<Dropdown>` component.

**En-Route Zone — new on-zone-entry pill** (`1133:13297`): two-variant component used on /en-route. Default (72×72) is the static hazard marker that already lives on the map. Extended (150×42) is a NEW pill — "[hazard icon] For 0.5 mi." in Subheadline/Emphasized black — that pops out when the driver enters the zone, communicating how long the hazard zone extends. Real new feature (distance-to-end-of-zone), not just styling. Implementation needs: a "is user inside this zone right now?" check (point-in-polygon against the user's location, run on each `watchPositionAsync` tick) and a transition between Default and Extended states. Worth pairing with the en-route hazard notice queued elsewhere — both consume the same hazard data.

**Trusted Contact Footer is already shipped** (`1133:13945`) — the existing `components/TrustedContactStatus.tsx` is functionally identical to the v2 spec (footnote-regular muted text + pulsing freshgreen dot). Only diff from v2: copy capitalization ("Your **Trusted Contact** is being notified" per Figma vs current "Your trusted contact is being notified"). Trivial one-line fix.

Lower priority / deferred:
- **Quick Tool Selected state** (`1133:13314`) — no "selected" state currently implemented on /search's Quick Tool tiles. Picking one would visually indicate "filter active."
- **Logo** (`1133:13122`) — Apple/Google/Mail SVGs for /login + /get-started, currently Ionicons.
- **Search Results map+sheet** (full Figma `1133:11400`) — requires Status, ReviewIcon, DropdownPill, ListEntry, and MapMarker-Shop components first. Deferred to its own track.

### Out-of-scope for thesis (defer)

- Real auth backend. Apple Sign In + AsyncStorage user object ships in `feat/auth-apple-signin`; identity is local-only. A real backend (Supabase / Firestore / custom) would slot in by replacing `lib/api/user.ts`'s read/write internals — the public surface and `User` type stay stable, so consumers (`useUser`, screens that read user state) don't change.
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
10. **Every ~5 PRs (same cadence as the fidelity audit), run an architecture audit.** Branch `chore/architecture-audit-N`. Counterpart to the visual audit — that one catches Figma drift; this one catches code-architecture drift. Checklist:
    - Adapter pattern compliance — `lib/api/*` files stay async, typed, with try/catch + mock fallback. No synchronous helpers sneaking in.
    - Scoring purity — `lib/scoring.ts` has zero I/O, zero `await`, deterministic.
    - Orphan exports — run a Pattern 2 dead-code sweep with a public-API filter (`app/` + `components/` only, since `lib/`/`hooks/`/`theme/` are deliberate public surfaces).
    - Theme-token discipline — no hardcoded colors or typography outside `.cursorrules`'s documented exceptions.
    - Hook usage — no hooks defined with only one consumer unless explicitly future-facing.
    Result is a punch list that either becomes its own cleanup PR or feeds into the next feature PR.
11. **Quarterly (or every ~20 PRs), consolidate `docs/learnings.md`.** The file is append-only by design — per-PR practice — but it grows unbounded. Consolidation merges redundant entries about the same lesson, retires entries where the underlying decision was overturned, and *promotes stable patterns* from learnings → CLAUDE.md body so they're seen on every session boot. Best run as a Pattern 1 agent task (instruct it to consolidate without losing the *why* context). Keep entries that captured the reason a decision was made, even when the decision is now obvious.

---

## How I want to collaborate

These have been earned through iteration; preserve them.

- **Comprehension over speed.** Explain *why* you chose an approach and what the tradeoffs are. I value learning the reasoning, not just receiving working code. New concepts get a brief walk-through inline.
- **Push back when I'm about to do something inconsistent.** If I propose a change that violates the design system or contradicts a documented learning, say so before implementing.
- **Anchor to Figma — except where iOS HIG says otherwise.** "Lands but feels off" feedback is usually signal that a structural pattern was missed (typically `flex-1 + justify-*` for "fill remaining space"). Match the hierarchy, not just the gap values. **But:** when Figma conflicts with iOS HIG (most often on tap targets), HIG wins. The design source of truth is the *intent*, and the platform constraint is part of the intent. A 36pt button at 44pt is still the design — visually faithful, behaviorally correct.
- **Diligent on widths and devices.** Hardcoded widths (`width: 374`) fail on wider iPhones. Default to `alignSelf: 'stretch' + marginHorizontal: <n>` for responsive sizing.
- **Rule of three.** Don't extract a helper, hook, or component for the second use site. Inline duplication is cheaper than a wrong abstraction. Extract on the third use when the shape has stabilized. Pair-review agents check for this — premature extraction is a flagged defect.
- **Write code a senior engineer could pick up cold in 6 months.** This is the readability bar — *above* the design rules in `.cursorrules`. Specifics:
  - Comments explain WHY (a hidden constraint, a workaround, a thesis-claim link). Don't restate what well-named code already says.
  - Public surface minimization. Only `export` what at least one other file imports today. `lib/`/`hooks/`/`theme/` are deliberate exceptions (they document a contract); `app/` and `components/` aren't.
  - Stale-comment hygiene — when a referenced file/symbol is deleted or renamed, the comments that named it get fixed too.
  - Narrow types > comments. If a constraint can be encoded in the type system (e.g., the Button's `Secondary + Transparent` exclusion), it should be — types don't rot.
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
