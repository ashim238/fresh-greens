# Figma mockup queue

Things that need design treatment in Figma before code can ship cleanly. Newest at top. Strike through items as they land in Figma; remove the entry once the Figma node is plumbed into code.

---

## Pending — needs design

### From PR D/E audits (May 2026)

- **A21 — "No route available" empty state redesign**
  - Current state at `app/home.tsx:1643-1648`
  - Replace gray `PathIcon` (labelTertiary) with **wiltedgreen bespoke illustration** — something like a road that trails off, or a pin with a question mark. Brand-warm register, not generic system error.
  - Copy: "No route available" → warmer phrasing per brand voice (suggestion: "Couldn't map a route there")
  - Add `accessibilityElementsHidden` to icon so VoiceOver doesn't read "Path image" before the headline
  - Adjust `routePreviewState` layout: replace `marginTop: -8` with explicit `paddingTop` so the empty state has proper clearance from the Clear-X row above
  - Spec: any size that fits in the route-card slot (~280pt tall × full sheet width)

- **F15 — EnRouteZone extended pill: text-free SVG variants**
  - Current pills bake "For 0.5 mi." into the SVG text path — driver sees stale "0.5 mi." regardless of actual zone length, while the bottom sheet shows dynamic "For X mi." (data mismatch)
  - Need text-free re-exports of: `enroute-hazard-extended-light.svg`, `enroute-hazard-extended-community-alert.svg`, `enroute-hazard-extended-road.svg`, `enroute-hazard-extended-wildlife.svg`
  - Code will overlay dynamic `<Text>` on the transparent text region
  - Spec: same dimensions/shape as current; just remove the "For 0.5 mi." text element from each

### From earlier backlog (carried forward)

- **Custom community-signal icon** (Round 4)
  - Two sizes: **64×64** for Row 1 empty state in `HomeBrowseSheet.tsx` `TrustedByCommunityEmpty`, **24×24** for section-header glyphs in PR B's multi-row layout
  - Single-color burntgreen (`#003F04`) so it theme-tints cleanly
  - File name: `community-signal.svg` — slots next to existing `mapmarker-glyph-*` family
  - Visual directions worth exploring: overlapping silhouettes/hands cradling a pin, a pin with concentric ripples (signal echoing outward), a chorus of small markers converging on one spot
  - Currently using Phosphor `Star` — reads as "favorites/saved," wrong semantic

- **Bespoke SVG glyphs for sub-tag identity categories** (Round 5+)
  - Currently rendering via Phosphor fallbacks: `HandHeart` (Women-owned), `Heart` (LGBTQ+ welcoming), `Toilet` (Open restroom), `MoonStars` (Late-night welcome)
  - Need bespoke single-color glyphs that match the `mapmarker-glyph-*` family's hand-drawn register
  - Used in: `LandmarkMarker` inner glyphs + `/report` picker sub-tag tiles + HomeBrowseSheet recommendation placeholders
  - Some partial exports already exist (`mapmarker-glyph-womenowned.svg`, `mapmarker-glyph-lgbtq.svg`, `mapmarker-glyph-restroom.svg`, `mapmarker-glyph-late-night.svg`); verify they match Round 5 quality bar

### B-tier flows (designing in Figma Make)

- **Roadside Assistance flow** — full screen design + state coverage
- **Unfamiliar Area flow** — pre-trip warning surface
- **Share My Location flow** — modal/sheet for the trusted-contact share affordance
- **Trusted-contact mid-stop picker** — picker UI inside `/en-route` for late-trip contact changes
- **/report v2 redesign** — picker + detail + sub-tag flow refresh

---

## Conditional — only if device verification fails

- **destination-home.svg re-export without baked filter** — if iOS's react-native-svg doesn't render `feMorphology` + dual `feGaussianBlur` correctly, the home destination pin ships shadowless. Verification step: drop a destination on /home, check if pin lifts off the basemap. If flat, re-export the SVG without the filter and apply `shadows.e3` via React Native style.

---

## Recently shipped (record-keeping)

- ~~/home destination marker per Figma 1245:10977~~ — shipped PR B (May 2026)
- ~~Lane guidance strip per spec~~ — shipped (PR1 + PR2 of lane-guidance plan)
- ~~Route preview card (Figma 1109:3264)~~ — earlier session
- ~~Round 5 safety surfaces (Figma 1128:5284, 1133:12323, 1133:12674, etc.)~~ — Round 5 PR A
