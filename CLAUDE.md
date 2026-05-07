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
  2. Profile row: burntgreen-circle avatar with a Phosphor `Car` glyph (TODO: swap for the custom car asset the user is making) + "Hey {firstName}" greeting in `title2Emphasized` + email + chevron-right (inert tap, TODO for future /profile screen).
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
- **State-aware firearm guidance (V2).** Gun laws vary by state — Alabama (current focus) is a "duty-to-inform" state where proactive disclosure is expected, but California / NY / IL are no-duty-to-inform (proactive disclosure could escalate unnecessarily), and others are asked-only or permit-conditional. The firearm bullets in `/pulled-over` (guidance phase + What-to-Say review sub-view) are written for Alabama best-practice. At scale, the right pattern is a `lib/api/gun-laws.ts` adapter that maps user state (already available via `expo-location`) → guidance-copy variant, threaded through the same conditional rendering already used for `armed=yes` vs `armed=no`. Architecturally clean to add — just a new input dimension to the existing copy dispatch.

### Routing formula — v2 follow-ups

All four thesis factors (light, police, wildlife, road conditions) are now covered through OSM via `lib/api/zones.ts`. Heavier integrations queued, not blocking:

- **TIGER/Line** — road-classification overlay for unmapped roads. Bigger lift than v1; needs per-region pre-extract or backend endpoint. Scope to demo region (Mobile, AL) when picked up.
- **State DOT 511** — real-time construction/incident feed (ALDOT for the demo region). Single-state integration, fits the adapter pattern. Would replace the OSM `highway=construction` signal (which lags real-time by weeks).
- **FEMA + NOAA flooding** — flood-zone (static) + real-time water level / advisory data. Especially relevant to New Orleans use cases per thesis evidence. Temporal/real-time concern — different data shape than OSM.

### Polish / smaller gaps

- ~~Welcome illustrations: clouds + wind.~~ ✅ Shipped in `feat/illustrations` — Welcome now uses a single composite backdrop PNG (`welcome-backdrop.png`) exported from Figma's "Visuals" parent (825:3163), containing Vic + sun + hill + clouds + wind + border cloud. Replaces the previous Vic PNG + sun PNG + CSS-shaped hill stack. Content (title, terms, buttons) overlays via SafeAreaView.
- ~~Onboarding panel illustrations.~~ ✅ Shipped in `feat/illustrations` — each panel renders its illustration as a bottom-anchored full-width Image (`onboarding-1.png` / `-2.png` / `-3.png`, cropped from the Figma panel screenshots at y=369-720 to exclude the Continue/Skip overlay). Uses `aspectRatio: 390/351` so the image scales proportionally on wider iPhones.
- ~~Permissions: real location-pin + car illustration.~~ ✅ Shipped in `feat/illustrations` — `permissions-location.svg` (rotated 17.72° in a 35.9×40.4 wrap to match Figma) + `permissions-car.svg` (57×40), imported as `react-native-svg` components.
- ~~Officer / Trooper character illustrations.~~ ✅ Shipped in `feat/illustrations` — `officer.png` (100×157) and `trooper.png` (100×171) PNGs in 120×172 wrappers (Officer anchored to bottom, Trooper centered). Trooper's yellow-shield hat badge is a separate SVG (`trooper-hat-badge.svg`) layered on top at top:36/left:52 within the wrapper, computed from Figma's inset-[20.99%_43.22%_68.99%_43.23%] against the wrapper's 120×172 dimensions.
- ~~Daylight gradient color consistency.~~ ✅ Resolved in `chore/figma-fidelity-audit-3`. `lib/daylight.ts` polyline now uses orange→mauve→indigo to match the bottom-sheet strip. Polyline and legend share one canonical gradient.
- Real "Schedule for X:XX AM" computation using SunCalc + route duration.
- Custom map markers (saved home, trusted friend, location landmarks).
- ~~/login screen (Welcome's "Have an account?" still TEMP-wired to /onboarding).~~ ✅ Shipped in `feat/auth-apple-signin` along with real Apple Sign In.
- **Custom car illustration for the user's identity glyph.** /menu's profile hero and /home's avatar button currently render a Phosphor `Car` placeholder. User is making a custom car asset (variant of the trusted-friend pin's car iconography); when uploaded to `assets/illustrations/user-car.svg`, swap both call sites in a tiny follow-up PR. Same treatment as the existing fuel.svg + notification.svg.
- **/home menu button (top-left) → /menu rewire.** Currently TEMP-wired to /safety for in-progress dev testing. Real intent: when the side-button navigation column ships (Help / Shield / Report / Center), the shield button opens /safety and the menu button (the existing top-left chrome) rewires to /menu. Avatar button on the right side of the menu row stays as the canonical /menu entry.
- **Deeper menu design assessment** queued for the next Figma fidelity audit. /menu shipped without a Figma reference (extrapolated from brand tokens + Waze pattern); next audit should diff each region against any sketches that land between now and then, especially: hero proportions, divider weight, tile peek balance, signOut bottom inset on different device classes.

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
