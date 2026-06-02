# Fresh Greens

Fresh Greens is a wayfinding tool inspired by the history of Black travel in America but driven by the lived Black experience of today. It creates a route aiming to limit exposure to the external hazards Black drivers were most concerned about in addition to maximizing daylight on the route. Fresh Greens prioritizes safety and community knowledge as the backbone of the routing experience.

The technical architecture mirrors that ethic. Every safety decision Fresh Greens makes on a map traces back to public, auditable data — not gestural design or a proprietary algorithm. **OpenStreetMap's Overpass API** supplies street-level lighting tags, landuse polygons, parks, police presence, wildlife crossings, and road conditions; **OSRM's** public routing engine returns candidate route geometries; **SunCalc** computes the literal solar geometry — sunrise, sunset, and the daylight remaining at each segment of the trip given the driver's planned departure. **Mapbox's Search Box API** handles destination search. Alongside the public data, a **community-reports** layer treats user-submitted observations — a place that felt unsafe, a Black-owned business worth knowing about, a recent incident — as a first-class signal flowing through the same scoring pipeline as OSM. The "external hazards" the app routes around are not just what a department of transportation surveyed; they are what the community noticed.

The app is **React Native + Expo (iOS-first)**, structured in three layers that each have one job. The **adapter layer** (`lib/api/*`) wraps each external data source in a typed contract; the rest of the app sees `Zone[]`, `Route[]`, and `Place[]` rather than the idiosyncratic JSON each provider returns. The **scoring layer** (`lib/scoring.ts`) is a pure function: given a candidate route and a set of zones, it returns a deterministic score. There is no I/O in scoring, no time-dependent surprise — the same inputs always produce the same routing decision, so safety choices are reproducible and inspectable. The **screen layer** (`app/*`) renders the result. AsyncStorage holds community reports, the trusted contact, and user preferences locally; the adapter pattern is designed so a production backend slots in without touching screen code.

## Running

Requires Node, npm, and a physical iPhone (the app is iPhone-first; Apple MapKit and the GPS pipeline don't run meaningfully in the iOS Simulator). A Mapbox token in `.env.local` (`EXPO_PUBLIC_MAPBOX_TOKEN=...`) is required for destination search; the routing and zone pipelines use free public endpoints (OSRM, Overpass) and need no key.

Two ways to run, depending on which features you want:

**Expo Go (fast, most of the app)** — works for the core experience: routing, the browse sheet, en-route navigation, safety surfaces, /search, /menu (minus the calendar feature). No native build required.

```bash
npm install
npx expo start
```

Scan the QR code with the Camera app on a physical iPhone running Expo Go.

**Dev build (full app, including calendar)** — required for the Connect-Calendar feature, which reads upcoming located events from the iPhone's calendar and surfaces them as one-tap navigation destinations in `/search`. `expo-calendar` is a native module that Expo Go can't host, so this path runs a custom dev client. First-time setup needs Xcode and signing configured for your Apple ID.

```bash
npm install
npx expo run:ios --device
```

The dev build installs onto a USB-connected (or wirelessly-paired) iPhone. The Connect-Calendar feature is strictly read-only — see the `What's shipped vs. what's v2` section below for the full disclosure of feature scope.

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — agent orientation (Claude Code auto-loads this). Maps to the rulebooks below; doesn't restate them.
- [`.cursorrules`](.cursorrules) — canonical design rulebook (color tokens, reserved-color rule, tap targets, anti-slop checks). Read by Cursor on every session and referenced by `CLAUDE.md`.
- [`docs/workflow.md`](docs/workflow.md) — per-PR rhythm and recipe.
- [`docs/architecture.md`](docs/architecture.md) — full project orientation: tech stack, three-layer architecture, design rules, and the running punch list of shipped vs. deferred work.
- [`docs/next-session.md`](docs/next-session.md) — the live backlog. Open items, struck-through closures, named rounds.
- [`docs/learnings.md`](docs/learnings.md) — running journal of decisions and gotchas, newest at top.
- [`fresh-greens-specimen/index.html`](fresh-greens-specimen/index.html) — design system specimen (colors, typography, design rules, references) generated from the theme tokens.

## What's shipped vs. what's v2

The app is a thesis project — a working argument, not a shipped product. Some surfaces are deliberately scaffolded rather than fully wired, and naming those gaps up-front is more honest than leaving them as quiet surprises mid-walkthrough. The ones a code-reading reviewer would notice:

- **Community reports are device-local.** Reports are stored in `AsyncStorage` and submitted with a `'mock-user'` ID — there is no auth and no backend, so "the community" is functionally one anonymous user per phone, and reports don't sync across devices. The scoring pipeline treats reports as a first-class signal regardless; the v2 path is a Supabase/Firebase backend behind the existing adapter contract.
- **Turn-by-turn instructions are placeholder copy.** OSRM provides route geometry but not narrated steps. The cheap v1.5 path is OSRM's `steps=true` parameter for a minimal maneuver list; the v2 path is Mapbox Directions or Google Directions for production-quality narration.
- **`/report` photo capture is a stub.** The photo button surfaces an "in a future update" alert. v2: `expo-camera` or `expo-image-picker`.
- **Connect Calendar is unverified on-device.** The JavaScript layer is exercisable and the failure modes degrade safely (empty section on denied permission), but the calendar reads themselves haven't been walked end-to-end on a physical device. The feature ships in `/menu` and `/search` and is honest about its capabilities; the gap is verification, not implementation.
- **Apple Sign-In + Push Notifications need a paid Apple Developer account** to provision under their own entitlements. The free Personal Team that ships with any Apple ID can't sign apps that use either capability, so dev builds for hobbyist contributors will omit those flows.

What IS shipped, end-to-end: zone-aware routing across the three public data sources, the daylight-aware route geometry via SunCalc, the route-preview card with safety chips and an all-clear state, multi-row community/category browsing, the en-route experience with the side-button column, the `/pulled-over` 5-phase safety state machine with audio recording and trusted-contact wiring, real-time weather via Open-Meteo, scheduled departure notifications, alternate-route comparison, refuel reminders (local notifications), the iOS grouped-settings register across all six settings pages, and the Connect-Calendar adapter/hook/UI layer (verification pending). Three months of working argument; the gaps above are intentional, not unfinished.

## License

Thesis project. All rights reserved pending publication.
