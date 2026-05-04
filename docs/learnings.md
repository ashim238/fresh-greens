# Learnings log

Running notes on things that bit me, surprised me, or clicked. One line per entry, newest at the top. Re-read every couple weeks to check the work is sticking.

---

## feat/route-explanation (2026-05-04)

The bottom sheet learns to talk. What we did, in plain terms:

- **Anchored to Figma instead of inventing UI.** Found a "Route (Established)" variant at 825:3635 with the actual designed bottom sheet — greeting, daylight strip, main copy with destination, tradeoff explanation, two-button action row. Way better than the generic "passes through 2 safe zones" panel I'd have generated. **The instinct to verify against Figma before building is worth its own PR.** Always check first.
- **Optional chaining + nullish coalescing for in-flight async data.** `recommended?.estimatedMinutes ?? '—'` handles three cases in one line: routes loaded with recommended (show minutes), routes loaded but no recommended (show dash), routes haven't loaded yet (show dash). The `?.` skips the property access if the object is undefined; the `??` provides a fallback for null/undefined results. Standard pattern for data that arrives a moment after render.
- **Typography tokens grow naturally — added `bodyEmphasized`.** When a screen needs a token we don't have, add it. Don't fight the type ramp. The token is the same shape (size/lineHeight/weight/spacing) as the existing ones, just with a new name. New screens use it via spread without touching old screens.
- **TODOs as future-PR markers.** Each placeholder in the layout is tagged with what data it'll consume when the right PR lands: `// TODO: real destination text once search wires`, `// TODO: personalized greeting once auth lands`, `// TODO: real schedule time once we install a sun calculator`. Each TODO is a future PR. Each future PR slots into the layout without restructuring. Architecture that survives staged delivery.
- **Spacing-matches-Figma but text doesn't.** When the layout looks compact compared to a Figma render, check if your placeholder copy is shorter than the designer's expected copy length. Spacing is a function of gaps + text height. Same gap with shorter text = tighter visual. Doesn't mean the spacing is wrong; it means the data placeholder is.

---

## feat/osrm-routing (2026-05-04)

The mock got replaced with real and the screen didn't notice. What we did, in plain terms:

- **Replaced `getRoutesBetween`'s body with a real `fetch` to OSRM's free public API.** Same function signature, same return type (`Promise<Route[]>`), same usage in home.tsx. The consumer is decoupled from the data source — that's the entire point of the adapter pattern, and now you've felt it pay off.
- **Try/catch with mock fallback for graceful degradation.** Three failure modes (no network, HTTP error, no routes found) all funnel to the same catch block: log warning, return mock data. The screen never breaks, even when the API is down. Resilience built in from the start, not retrofitted later.
- **Typed only what we read from OSRM, not their whole schema.** `OSRMResponse` and `OSRMRoute` are minimal types covering the 4 fields we actually use. Pragmatic: if their API surface is huge but you only consume 5%, type the 5%. Don't sign up to maintain a mirror of someone else's API.
- **GeoJSON coordinate order is `[longitude, latitude]` — NOT lat/lng.** Our internal type is `{ latitude, longitude }`. The conversion happens at the boundary in `parseOSRMRoute`. This is the single most common bug in geo code: invert the order somewhere and your polyline appears in Antarctica. Convert at the edge, keep the rest of the codebase in one convention.
- **The architectural claim, validated.** Turn off WiFi → mock kicks in. Turn it back on → real routes return. Same screen, no code changes, no rebuilds. Every future external integration (real zone data, weather, incident reports) follows this exact `try { fetch } catch { fallback }` shape.

---

## feat/daylight-gradient (2026-05-04)

The thesis becomes visual. What we did, in plain terms:

- **Wrote a second pure function (`lib/daylight.ts`).** Same shape as scoring — no async, no I/O, takes data in, returns data out. `gradientSegments(route)` splits a route into colored chunks. Right now the colors are calibrated to position-along-route; later they'll be calibrated to real solar calculations. Function signature stays the same when we swap the body — same adapter-pattern discipline applied to pure utilities.
- **JSX `.map()` inside `.map()` returns nested arrays. React handles this.** The outer map iterates routes; the inner map iterates the gradient segments of the recommended route. Each element gets its own key. React flattens automatically at render time. This is how you express "expand one element into N elements during render."
- **Shared boundary coordinates prevent visible seams.** Each gradient segment starts at the previous segment's last point. Without overlap, the renderer would leave 1-pixel gaps where polylines don't draw. The `pointsPerSegment - 1` math in `gradientSegments` is what creates that single-point overlap.
- **The reserved-color rule's daylight exception in action.** Red and orange used here as functional encoding (daylight availability), not as signal (hazard). This is exactly the case the .cursorrules exception was written for, and it's why the audit specifically documented this feature as not a violation.
- **The thesis is now visual.** Before: a sentence about helping drivers be home before dark. After: a polyline that paints from green to orange to red as the route extends toward sunset. The user sees the tradeoff in one glance — no explanation needed. That's the thing screenshots in a thesis paper for.

---

## feat/route-scoring (2026-05-04)

The thesis crystallizes. What we did, in plain terms:

- **Wrote pure functions for the first time.** `lib/scoring.ts` has no async, no API calls, no side effects. Same input always gives the same output. This is different from adapters in `lib/api/` (which reach out to the world). Pure functions are trivially testable, composable, predictable. They sit in the middle of the pipeline transforming data.
- **The pipeline is now: adapters fetch → scoring decides → screens render.** Each layer has one job. If a real API replaces the mock, scoring doesn't change. If we tune the scoring weights, adapters don't change. If we redesign the map screen, the data flow doesn't change. This is what "separation of concerns" actually looks like in practice.
- **Refactored Route to drop the `type` field.** The adapter shouldn't pre-judge which route is best — that's the scorer's job. Cleaner contract: adapter returns *candidates*; scorer decides *winners*. New `RankedRoute` type adds `type` and `score` after scoring.
- **Point-in-polygon ray-casting algorithm.** From any point, cast a horizontal ray. Count edge crossings. Odd = inside, even = outside. Elegant because it works for any polygon shape. Worth knowing exists; rarely worth re-deriving from scratch.
- **The spread-sort-spread immutable transform pattern.** `routes.map(r => ({ ...r, score }))` then `.sort()` then `.map(r => ({ ...r, type }))`. Each step creates new objects rather than mutating originals. Standard modern-JS way to transform an array without surprises.
- **Validated by experiment.** Swapped the order of routes in the adapter's mock array. The scoring picked the same winner regardless. That's the proof — pure functions are deterministic, and scoring is operating on the data's *meaning* (which zones each route passes through), not its position.
- **The thesis lives in this file.** Everything from here is tuning weights, layering modifiers (daylight, time-of-day, user preferences), and showing the user *why* this route was chosen. The mechanism that makes Fresh Greens the recommendation engine it claims to be — that's `pickWinner`.

---

## feat/routes-adapter-mock (2026-05-03)

Second piece of the product. What we did, in plain terms:

- **Built a second adapter (`lib/api/routes.ts`) following the same pattern as zones.** Typed inputs/outputs, async signature, simulated delay, mock data. Reusing the pattern you just learned reinforces it as muscle memory — every future API source (weather, lighting, incident reports) follows the same shape.
- **Returned multiple candidates, not a single route.** The mock returns 2 candidate routes between the same two points. The next PR (scoring) picks one based on which zones each candidate passes through. Asking "what's the best route" is a *separate question* from "what are the possible routes" — splitting them keeps each adapter's job tight.
- **`Promise.all([a, b])` runs async work in parallel.** Two adapters that don't depend on each other can be kicked off at the same moment and awaited together. Total wait = slower of the two, not the sum. The `[fetchedZones, fetchedRoutes] = ...` destructuring pulls the results in the same order you passed the promises.
- **`<Polyline>` works exactly like `<Polygon>`** — child of MapView, takes a `coordinates` array. Difference: polygon auto-closes (last point connects back to first); polyline is an open path (A to B, no loop). Routes are open paths.
- **The aha:** zones × routes = the product. Each route gets a score based on which zones it passes through (green good, red bad, yellow tradeoff). Highest-scoring route wins. The route picker explaining its choice ("your route adds 4 min but passes through 2 well-lit zones, avoids 1 incident area") is what makes Fresh Greens trustworthy — not opaque, but defending the choice in a sentence.

---

## feat/zone-data-mock (2026-05-03)

The first piece of the actual product (everything before this was scaffolding around an empty map). What we did, in plain terms:

- **Built a fake data source ("adapter") that pretends to be a real API.** `lib/api/zones.ts` has a function called `getZonesForRegion` that returns three made-up safety zones around the user's location. It's `async` and waits 100ms before returning — even though the data is hardcoded — so the rest of the app feels exactly like it would when we plug in a real API later.
- **Why fake-but-real-shaped:** when we swap in the real API down the road, *only this one file changes*. The screen that uses it doesn't notice. That's the whole point of the adapter pattern — separate "where data comes from" from "what we do with it."
- **Used `useState` for the first time.** `const [zones, setZones] = useState<Zone[]>([])` says: "give me a place to store an array of zones. Start it empty. When `setZones` is called, re-render the screen with the new value." That's the React loop in one sentence.
- **`<Polygon>` must be a *child* of `<MapView>`**, not next to it. react-native-maps reads its children, sees the overlays, and hands them to the native map renderer. Same parent-decides-how-to-render pattern as `<View>` containing `<Text>`.
- **Used reserved colors (green/yellow/red) on purpose.** The .cursorrules reserved-color rule explicitly allows reserved colors as legitimate UI safety signals. Zone shading is exactly that case — it's communicating "safe here / be careful here / avoid here." This isn't decoration.
- **Mock-first development discipline.** Build the consumer (the home screen showing zones) against fake data first. The visual loop (save → reload → see zones on map) confirms the rendering works. Later, swap fake for real with high confidence the screens won't break.
- **What this builds toward.** Real zone APIs (lighting, incidents, daylight) feed the same pipeline. A separate routes adapter provides candidate paths from a routing engine. A scoring function picks the best route based on which zones it passes through. The chosen route renders as a colored polyline. That's the actual Fresh Greens product — and every piece of it follows the same adapter-then-render pattern this PR establishes.

---

## feat/home-overlay (2026-05-03)

- **`pointerEvents="box-none"`** — Views that wrap floating UI but cover empty space need this so taps pass through to whatever's underneath (e.g., the map) unless they hit a child. Three values worth knowing: `"auto"` (default), `"none"` (blocks all), `"box-none"` (passes through, children still capture).
- **`SafeAreaView` `edges` prop** (from `react-native-safe-area-context`) lets you inset only specific sides: `edges={['top']}` for notch-only, `edges={['bottom']}` for home-indicator-only. Use it when one screen has multiple floating regions that each only care about one edge.
- **RN shadows are physical cues.** `shadowOffset: { width: 0, height: -4 }` (negative y) makes a shadow point *up* — right for a sheet floating up from the bottom. Match the offset direction to where the surface "is coming from."
- **RN can only render one shadow per element.** Figma often specifies layered shadows (M3 Elevation 1/2/3 each have two stacked drop shadows). Approximate with the larger of the two layers; the visual fidelity loss is negligible.
- **Android's elevation is a separate prop.** `elevation: 6` produces the equivalent system shadow on Android. Always set both `shadow*` props (iOS) AND `elevation` (Android) — RN doesn't unify them.

---

## feat/location-permission (2026-05-03)

- **`useEffect(() => { ... }, [])`** runs after the component renders. Empty deps = "run once on mount." Use it for side effects: API calls, subscriptions, permission requests. Anything that talks to the outside world.
- **Effects can't be async themselves.** Wrap an inner async function and call it. Always include the `cancelled` flag pattern + cleanup function for in-flight async — handles the case where the user navigates away mid-request and prevents touching a component that no longer exists.
- **`useRef<T>(null)` gives you an imperative handle to a child component.** Refs hold a `.current` value that persists across renders without triggering re-renders when changed. Use the `?.` optional chain (`mapRef.current?.animateToRegion(...)`) to safely call methods even when the ref hasn't attached yet.
- **`Location.requestForegroundPermissionsAsync` > `getForegroundPermissionsAsync` for re-checking.** The "get" variant can return stale state right after the user toggles permission in iOS Settings. The "request" variant goes to the OS for a fresh answer and is safe to call repeatedly — it returns granted/denied immediately if already decided, or shows the prompt if undetermined.
- **iOS permission usage strings live in `app.json` via the plugin form.** `["expo-location", { "locationWhenInUsePermission": "..." }]`. Without the string, `requestForegroundPermissionsAsync` fails silently. The plugin form auto-handles both iOS Info.plist and Android manifest entries.
- **Expo Go's permission-management modal is dev-only.** "Experience needs permissions" is Expo Go's per-project permission UI. It disappears in development builds and App Store builds — production users see the standard iOS system prompt with your custom string.
- **Once iOS permission is denied, the system won't prompt again.** Only `Linking.openSettings()` (which opens iOS Settings) lets the user re-enable. After enabling and returning to the app, calling `requestForegroundPermissionsAsync` again returns granted.

---

## feat/home-map (2026-05-03)

- **Native module install = two steps, easy to mis-sequence.** `npx expo install <pkg>` writes to package.json AND fetches into node_modules. If only the first happens (e.g., Cursor edits the manifest without running install), Metro errors with "added to package.json but doesn't seem to be installed." Fix: plain `npm install` to sync.
- **After installing a native module, restart Expo with `-c`.** Metro caches the dependency graph; a new native module isn't visible until cache is cleared. Same pattern as expo-router install.
- **Expo + npm 7+ peer-dep conflicts are routine.** `--legacy-peer-deps` is the official Expo workaround. Adding `.npmrc` with `legacy-peer-deps=true` makes it permanent, sticky across collaborators and CI. Industry-standard for Expo SDK 50+.
- **`<MapView>` is a native bridge component**, not a JS-only React component. It wraps Apple MapKit on iOS and Google Maps on Android. Map tiles, gestures, animations all happen at the native layer — JS just hands props.
- **`initialRegion` vs `region`.** `initialRegion` (uncontrolled) sets the starting viewport; user pan/zoom is preserved. `region` (controlled) forces the map back on every render. Use the former for normal navigation, latter for "snap to a specific location" features.
- **Apple MapKit allows overlays but not basemap restyling.** Custom routes, markers, zones all draw on top of the map ✓. Restyling streets/labels themselves ✗. Fresh Greens' route customization lives in the data + overlay layer, not basemap geometry — so MapKit is sufficient. Switch to MapLibre/Mapbox only if dark-mode or fully custom basemap aesthetics become essential.

---

## feat/onboarding-2 (2026-05-03)

- **Extract on the third use, not before.** Two inline copies of the page-control pattern stayed inline. The third occasion is when you write `<PageControl />` for the first time — and at the same time, retrofit the two prior consumers to use it. Earlier extraction over-fits to the first variant; later extraction accumulates drift between copies.
- **Replicate Figma's structure 1:1 when reasonable.** Figma's "Page Control" is an h-44 wrapper with the dots vertically centered. Translating that as `height: 44` + `alignItems: 'center'` (instead of guessing at paddingVertical math) keeps the design-to-code mapping legible. Whoever opens Figma and the file should see the same shape on both sides.
- **`false` in a style array is a no-op.** `style={[styles.dot, isInactive && styles.dotInactive]}` evaluates to either `[styles.dot, styles.dotInactive]` or `[styles.dot, false]`. RN's array merger silently ignores the `false`. Cleanest conditional-style pattern.
- **`Array.from({ length: n }).map((_, i) => ...)`** is the canonical "render n elements" pattern when you don't have a real array of data. The underscore signals "we don't care about the value, only the index."
- **`justifyContent: 'space-between'` doesn't mean buttons are pinned independently.** When the top child grows, the distributed gap shrinks; the bottom child stays at the bottom but appears closer to the body. Not a bug — feature of how the flex distribution works. The fix when this matters is usually a missing illustration filling the middle, not a layout change.

---

## chore/typography-tokens (2026-05-03)

- **Spread + override is the canonical token consumption pattern.** Spread the token to inherit the contract (size, weight, letter spacing), then add overrides (color, alignment, decorations) below. Reads top-down as "what kind of text + what's special about this instance."
- **Pull a single property when nested Text inherits.** For inner `<Text>` inside an outer `<Text>`, RN inherits size/lineHeight/letterSpacing automatically — only override the property that differs (e.g. `fontWeight: typography.footnoteEmphasized.fontWeight`). Spreading the whole token would re-apply already-inherited values redundantly.
- **A successful refactor has zero visual diff.** "Looks identical" is the success state. If something looks different post-refactor, the token or the consumer is wrong.

---

## feat/onboarding-1 (2026-05-03)

- **iOS system font is SF Pro by default** — leave `fontFamily` unset on `<Text>` and you get SF Pro automatically. Setting `fontFamily: 'SF Pro'` explicitly doesn't work; the system font is accessed by *not* naming it.
- **RN's `fontWeight` only accepts standard 100-step values** (100, 200, ..., 900). Figma's "Semibold" is technically PostScript weight 590, but RN maps Semibold to 600. Visually identical to the eye; spec-different on paper. Don't try to set 590 in RN — it'll snap to 600 anyway.
- **Rule-of-three trigger.** Same typography scale used inline across Welcome, Get Started, Permissions, Onboarding 1 — past the threshold. Same for the page-control 4-dot pattern. Both should be extracted in a follow-up `chore/` PR.

---

## feat/permissions (2026-05-03)

- **JSX nesting often needs to mirror Figma's group nesting.** A Figma group with `gap: 32` between visual-block and CTA isn't decorative — it's load-bearing structure. Flattening it into siblings of the SafeAreaView lost the relationship and put the CTA at the bottom instead of 32pt below the sub-instructions.
- **`alignItems: 'flex-start'` cascades through wrapper Views.** Each level inherits "be as small as your kids," which collapses long Text down to its intrinsic line width and visually swallows parent padding. Default `alignItems: 'stretch'` lets wrappers fill the cross-axis so Text wraps within the proper width.
- **The robust pattern: default `stretch` + `alignSelf` overrides on exceptions.** Don't flip the parent's `alignItems` and then compensate everywhere; let stretch be the default and add `alignSelf: 'flex-start'` (or `center`) only on the children that need different behavior.
- **Built-in `SafeAreaView` clobbers horizontal padding** because its inset application runs after React applies your styles and touches the same padding properties. Workaround: put `paddingHorizontal` on a parent View, leave only vertical concerns on SafeAreaView. Real fix: migrate to `react-native-safe-area-context` (next PR).
- **TEMP-wire pattern for testing in-progress routes.** When a screen exists but isn't reachable from the proper flow yet, temporarily wire an existing button to navigate there, with a clear `// TEMP:` comment so it's grep-able and obviously not permanent. Better than building a hidden dev menu just for one route.

---

## feat/button-icons (2026-05-03)

- **`@expo/vector-icons` ships with Expo** — no install needed. Re-exports Ionicons, MaterialIcons, Feather, FontAwesome, and others. Used like a component: `<Ionicons name="logo-apple" size={20} color={colors.white} />`.
- **Icon names are type-checked.** Typos get red-underlined in Cursor before save. The type system teaching you the API.
- **Icon fonts vs PNG icons:** font glyphs render at any size, recolor via `color` prop, stay sharp on every density. Use fonts for UI icons; reserve PNG/SVG for illustrations and brand assets that font sets can't match (e.g., the multi-color Google G).
- **Browse icons at icons.expo.fyi.** Searchable across all bundled libraries; click → copy the name.
- **Code can change the design too.** Bumped icon size from 24→20 in code, then updated Figma to match. The Figma file is source of truth, but the bidirectional loop is real — don't be afraid to push back when the implementation suggests a tweak.

---

## feat/screen-illustrations (2026-05-02)

- **`<Image>` needs explicit width AND height.** The `left: 0, right: 0` shorthand that implicitly widths a `<View>` doesn't reliably work on Image — RN can fall back to the asset's natural pixel size (huge, since 3x exports are 3× the design dimensions). Always set `width` explicitly.
- **`require('../path/to/file.png')` bundles a local asset at build time.** Different from `source={{ uri: 'https://...' }}` which fetches a remote URL at runtime. Metro reads `require()` calls statically and packs the file into the app bundle.
- **`resizeMode="contain"` fits the image inside its bounds preserving aspect ratio.** Other options: `cover` (fills, may crop), `stretch` (fills, may distort), `center` (no scaling). `contain` is almost always right for illustrations.
- **`transform: [{ translateX: N }, { translateY: M }]` shifts an element visually without affecting layout flow.** Negative Y = up (screen coords have y pointing down). Use for fine-tuning position without cascading into siblings.
- **JSX source order = paint order for overlapping absolute siblings.** Earlier in JSX = behind, later = in front. No `z-index` needed for sibling overlaps. Useful for masking via overlap (sun behind hill = clean rising-sun silhouette without a pre-clipped asset).
- **Centering an absolutely-positioned element:** `left: '50%', marginLeft: -<half-width>`. The `left: 50%` puts the *left edge* at center; the negative margin pulls the element back so its *center* sits on center. Same trick vertically with `top` + `marginTop`.
- **`accessible={false}` on decorative images** tells VoiceOver to skip them. Sun, clouds, atmospheric art = decorative; UI icons that convey meaning = `accessible={true}` with a label.
- **New asset directories sometimes need `npx expo start -c`** to be picked up by Metro's file watcher. Hot reload works for code changes but can miss brand-new directories.

---

## feat/get-started (2026-05-02)

- **`onPress={handler()}` runs at render time and is almost always wrong.** `onPress` wants a function, not the result of calling one. Three forms: `onPress={fn}` if no args, `onPress={() => fn(arg)}` if args, never `onPress={fn()}`.
- **Arrow function `() => expr` is shorthand for `function() { return expr }`.** Defines an anonymous function that runs `expr` when called.
- **`useRouter()` is a hook — call it at the top of the component**, not inside conditionals or loops. Hooks always start with `use`.
- **`router.push('/path')` matches a file at `app/path.tsx`.** That's the file-based routing magic — no manual route registration.
- **Pattern reuse from screen to screen is a trap.** Welcome had a curved hill; I copied the same View+borderRadius onto Get Started without checking the design — but Get Started's divider is *flat*. Look at the design first, name the shape, then decide whether to reuse. Anti-slop rule "match existing patterns" only applies when the new screen actually wants the existing pattern.
- **Name styles by what they are, not where they came from.** `hill` implies a curve; `ground` describes a flat lower section. Future-you reading the file shouldn't have to guess.

---

## feat/welcome (2026-05-01)

- **Git commits live in `.git/` locally — they're real before you push.** GitHub is just a hosted copy. `git push` is backup + share, not "make the commit count."
- **`git checkout -b` = create a branch *and* switch to it.** `-b` is `--branch`, the create flag.
- **`-u` on `git push` sets upstream tracking.** First push only; later pushes are just `git push`.
- **`as const` on a TS object literal** narrows the inferred types from `string` → exact literals. Combined with `keyof typeof`, that's how you get a union type of valid color names.
- **In RN, `borderRadius` clamps to half the element's width.** A 240 radius on a 390-wide View becomes 195 on each top corner — and two 195-radius quarter-circles meeting at the top-center give a tombstone dome, not a hill. Fix: extend the element past the screen edges + much larger radius. Only the gentle middle of the arc shows.
- **RN layout is bottom-anchored when actions are pinned to the bottom.** To move a sibling *up*, increase the gap *below* it (its `marginBottom`), not the space above it. Backwards from web instinct.
- **`StyleSheet` has no units.** Numbers are density-independent pixels; same physical size on iPhone SE and Pro Max.
- **`fontWeight` in RN is a string, not a number.** `'700'`, not `700`. Trips everyone up once.
- **`Text` can't sit directly inside a `View` as a string.** Always wrap in `<Text>`. Different from HTML.
- **Built-in `SafeAreaView` is the simpler version.** `react-native-safe-area-context` is the more capable replacement we'll swap in when the built-in misbehaves (landscape, side notches, custom inset positioning).
