# Fresh Greens

Fresh Greens is a wayfinding tool inspired by the history of Black travel in America but driven by the lived Black experience of today. It creates a route aiming to limit exposure to the external hazards Black drivers were most concerned about in addition to maximizing daylight on the route. Fresh Greens prioritizes safety and community knowledge as the backbone of the routing experience.

The technical architecture mirrors that ethic. Every safety decision Fresh Greens makes on a map traces back to public, auditable data — not gestural design or a proprietary algorithm. **OpenStreetMap's Overpass API** supplies street-level lighting tags, landuse polygons, parks, police presence, wildlife crossings, and road conditions; **OSRM's** public routing engine returns candidate route geometries; **SunCalc** computes the literal solar geometry — sunrise, sunset, and the daylight remaining at each segment of the trip given the driver's planned departure. **Mapbox's Search Box API** handles destination search. Alongside the public data, a **community-reports** layer treats user-submitted observations — a place that felt unsafe, a Black-owned business worth knowing about, a recent incident — as a first-class signal flowing through the same scoring pipeline as OSM. The "external hazards" the app routes around are not just what a department of transportation surveyed; they are what the community noticed.

The app is **React Native + Expo (iOS-first)**, structured in three layers that each have one job. The **adapter layer** (`lib/api/*`) wraps each external data source in a typed contract; the rest of the app sees `Zone[]`, `Route[]`, and `Place[]` rather than the idiosyncratic JSON each provider returns. The **scoring layer** (`lib/scoring.ts`) is a pure function: given a candidate route and a set of zones, it returns a deterministic score. There is no I/O in scoring, no time-dependent surprise — the same inputs always produce the same routing decision, so safety choices are reproducible and inspectable. The **screen layer** (`app/*`) renders the result. AsyncStorage holds community reports, the trusted contact, and user preferences locally; the adapter pattern is designed so a production backend slots in without touching screen code.

## Running

Requires Node, npm, and Expo Go on a physical iPhone (the app is iPhone-first; Apple MapKit and the GPS pipeline don't run meaningfully in the iOS Simulator).

```bash
npm install
npx expo start
```

Scan the QR code with the Camera app on a physical iPhone running Expo Go. A Mapbox token in `.env.local` (`EXPO_PUBLIC_MAPBOX_TOKEN=...`) is required for destination search; the routing and zone pipelines use free public endpoints (OSRM, Overpass) and need no key.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — full project orientation: tech stack, three-layer architecture, design rules, and the running punch list of shipped vs. deferred work.
- [`docs/workflow.md`](docs/workflow.md) — per-PR rhythm and recipe.
- [`docs/learnings.md`](docs/learnings.md) — running journal of decisions and gotchas, newest at top.
- [`fresh-greens-specimen/index.html`](fresh-greens-specimen/index.html) — design system specimen (colors, typography, design rules, references) generated from the theme tokens.
- [`.cursorrules`](.cursorrules) — canonical design rulebook, read by Cursor on every session.

## License

Thesis project. All rights reserved pending publication.
