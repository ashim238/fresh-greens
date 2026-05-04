# Learnings log

Running notes on things that bit me, surprised me, or clicked. One line per entry, newest at the top. Re-read every couple weeks to check the work is sticking.

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
