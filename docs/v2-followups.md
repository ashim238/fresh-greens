# V2 follow-ups & known gaps

Captured from two audit passes (multi-card carousel a11y/UX + end-to-end demo walkthrough) and ongoing development. Each item is a candidate to revisit post-thesis-defense or in the v1.1 polish window.

## Gaps to call out preemptively during defense

These are scaffolded-but-not-real features a thesis reviewer would notice. Better to name them yourself than be ambushed.

- **Turn-by-turn instructions are static placeholder copy** — `app/en-route.tsx:86-89, 271-272`. OSRM provides geometry, not steps. v1.5 cheap path: OSRM `steps=true` parameter gives a minimal maneuver list (`Turn left in 0.3 mi`). v2: Mapbox Directions or Google Directions for production-quality narration.
- **Weather card is mocked at "66° / Moderate"** — `components/HomeBrowseSheet.tsx:230-238`. `lib/api/weather.ts` is the documented v2 swap-in.
- **/safety modal has 3 of 4 tiles inert** — `app/safety.tsx:63,69,75`. "Roadside assistance," "Unfamiliar area," "Share my location" have `href: null` and silently no-op. Only "I was pulled over" is wired.
- **/menu has 3 inert rows + Quick Tiles** — `app/menu.tsx:237-282`. "Settings," "Schedule a drive," "Theme" are inert; Quick Tiles carousel is decorative.
- **Reports submit as `'mock-user'`** — `app/report.tsx:138`. No auth wiring. AsyncStorage is device-local — "the community" is functionally one anonymous user per phone, and reports don't sync.

## Polish gaps a reviewer might catch

- **No real photos on recommendation cards** — `components/HomeBrowseSheet.tsx:251-264` renders a single Phosphor glyph per category on `fadedgreen`. v2: wire Google Places `photos` field through the proxy. (Being addressed in the current demo-stabilization batch.)
- **Cold-start map shows Mobile, AL until GPS resolves** — `app/home.tsx:686-689` hardcodes the initialRegion. v2: defer initialRegion until first location fix, or animate to user location ASAP.
- **Welcome screen's terms checkbox isn't gated** — `app/index.tsx:217-223`. `termsAccepted` state exists but `Get started` works regardless. (Being addressed in the current batch.)
- **"Coming soon" `Alert.alert` mid-report flow** — `app/report.tsx:386-394` (photo capture) and `app/home.tsx:1342-1346` (Schedule). Breaks the rhythm of an otherwise fluid flow. v2: inline disabled-state copy instead of modal Alert.

## Carousel-specific (post-PR #163)

- **`useRecommendations` exposes `loading` but `HomeBrowseSheet` doesn't read it** — `components/HomeBrowseSheet.tsx:69`. Empty-state flashes before cards on every chip change. (Being addressed in the current batch.)
- **Snap math off by 16pt** — `contentContainerStyle.paddingHorizontal: 16` interferes with `snapToInterval` from x=0. Cards 2+ misalign by the padding amount. (Being addressed.)
- **Card accessibilityLabel strips key info** — currently `${name} recommendation — tap to route`. VoiceOver doesn't get rating, hours, distance, curator quote. (Being addressed.)
- **ScrollView snap doesn't respect Reduce Motion** — `snapToInterval` + `decelerationRate="fast"` not gated on `useReduceMotion()`.
- **Carousel container has no `accessibilityRole="list"`** — screen readers don't announce "list of N" on entry.
- **`cardTitle` doesn't truncate at AX5** — `numberOfLines` is missing; long names + max Dynamic Type push layout.
- **Curated-fallback distance pill is jarring** — when user is in NYC and curated (Mobile-only) fires, cards show "1186 mi away." Should suppress or relabel as "Demo content — Mobile, AL."
- **Rapid chip tapping causes flicker** — each chip-tap triggers `LayoutAnimation` AND a fresh async fetch; cards animate out / empty pops in / new cards animate in. Debounce.

## /en-route polish

- **12s blank route on Overpass timeout** — `app/en-route.tsx:516-541`. `Promise.allSettled` waits on BOTH routes and zones before rendering. Render route as soon as it resolves; let zones land separately. (Being addressed in the current batch.)

## Audit-listed S1/S2 items not yet resolved

- **EdgeIndicator count="1" pill** — single-item edge groups still render a "1" badge. Small visual cleanup.
- **Cluster marker missing `tracksViewChanges` lifecycle** — hardcoded to `false` from t=0. Inconsistent with other markers.
- **Cluster marker no `accessibilityRole`** — has `accessibilityLabel` but no role. Same for placement pin.
- **Saved-home + trusted-friend markers don't get a `selected` state** — tapping them fires handlers but no visual feedback.
- **Dynamic Type expansion (S1 #6 from a11y audit)** — only ~3 `dynamicType()` invocations across the codebase. Needs broader application + breakpoint testing.

## Accessibility — daylight gradient colorblind support

The daylight gradient on the route polyline (orange → mauve → indigo) encodes when each route segment will be in daylight, twilight, or after dark — *functional* color, per the `.cursorrules` reserved-color rule #3. But the gradient is color-only signaling, which fails on three counts for colorblind users:

- **Deuteranopia / protanopia (red-green colorblind, ~8% of men)** — orange and mauve get hard to distinguish; the daylight→twilight boundary becomes invisible
- **Tritanopia (blue-yellow, rare)** — indigo→mauve boundary becomes invisible
- **Monochromacy / low-vision** — the entire gradient reads as a uniform stripe

Two layered fixes (combine for full coverage):
1. **Non-color cue along the polyline** — alternate dash patterns per daylight tier (solid = day, dashed = twilight, dotted = night), or width changes (thicker = day, thinner = night). RN-Maps Polyline supports `lineDashPattern`.
2. **Accessibility label or an inline legend overlay** that calls out the transitions explicitly: "Daylight for first 12 mi, twilight from mile 12 to mile 18, dark from mile 18 to arrival." VoiceOver users get the same information the gradient conveys visually.

Same problem applies to the bottom-sheet daylight strip key in /home — color alone today; should add the same dash-pattern legend.

WCAG 1.4.1 (Use of Color, Level A) requires color not be the only visual means of conveying info. Currently a known failure.

## v2 architecture

- **Curated catalog as catastrophic fallback feels invisible** — `lib/api/recommendations.ts:148-152` only fires curated when external+community both empty. With Google Places returning worldwide results, curated rarely fires in practice. Consider letting curated participate when it's category-appropriate AND user is near the curated entry's region.
- **Demo-mode toggle / offline seed** — a `/menu` switch that swaps the external adapter for a richer curated catalog (more cities, more cards, real photos) would let you demo without internet anxiety.
- **Skeleton loading state** — see Carousel-specific above. Will close the "are the chips broken?" perception during proxy cold start.
- **Bespoke SVG glyphs from Figma for v2 sub-tags** — currently Phosphor fallbacks (HandHeart / Heart / Toilet / MoonStars). Swap when Figma exports land.
- **Yelp / EatOkra adapter** — Yelp went paid; EatOkra has no public API. Deferred until either landscape changes.
- **User auth + report sync** — currently device-local AsyncStorage. v2 needs Supabase / Firebase / similar so community reports persist across phones.
- **Real photo capture in /report** — `app/report.tsx` photo button currently `Alert.alert` stub. Needs expo-camera or expo-image-picker.
- **Schedule CTA → expo-notifications** — `/home` "Schedule for X" button is scaffolded but only shows an Alert. v2 wires local notifications fired at the suggested departure.

## Reference

- Last carousel audit: `tasks/aebe273bd1c9f2671.output`
- Last demo-walkthrough audit: `tasks/aa8c4da1ffd31d5fa.output`
- Visual + a11y audit (from earlier session): `tasks/ab0c1620a83362534.output`
