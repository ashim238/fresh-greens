# Learnings log

Running notes on things that bit me, surprised me, or clicked. One line per entry, newest at the top. Re-read every couple weeks to check the work is sticking.

---

## feat/routing-formula-zones (2026-05-06)

The remaining three thesis factors — police, wildlife, road conditions — land as OSM-fed zones through the existing pipeline. What we did, in plain terms:

- **The discriminated union earned its keep again.** Adding three new categories to the routing formula meant: extend the Overpass query union, add new tag dispatchers in the parser, add new entries in mock fallback. **No change** required to `pickWinner`'s public signature, no consumer changes in /home or /en-route, no scoring inner-loop rewrite. Discriminated `geometry: 'polygon' | 'polyline' | 'point'` made the geometry side trivial; adding optional `category: ZoneCategory` made per-source modulation possible without touching the type system everywhere else. Three new data sources, ~200 lines of net adapter additions, zero ripples.
- **Time modulation belongs in scoring, not in the zones adapter.** The dawn/dusk wildlife multiplier could've been baked into the zone (compute "is it dusk" at fetch time, return type='avoid' instead of 'caution'). Doing it in scoring is cleaner: zones describe *what's there*; scoring decides *what to do about it given the trip context*. Trip context (departureTime) lives at the call site of `pickWinner`, not at the time of fetching zones — and a route may be re-scored against the same zones for different scheduled departures (the future "Schedule for 7:38 AM" feature). Single source of zone truth, multiple scorings as needed.
- **Mixed-geometry Overpass queries (way + node) need both element types in the response parser.** OSM's `amenity=police` exists as both nodes (point markers) and ways (building polygons); `highway=speed_camera` and `hazard=wildlife_crossing` are always nodes. Parser used to assume `way` only — needed to add `parseOverpassNode` and a top-level dispatch on `element.type`. Lesson: when extending an Overpass query, check whether the new tag families use way/node/both before assuming the existing parser shape covers them.
- **`departureTime` defaults to `new Date()` so adding the param wasn't a breaking change.** Existing call sites in /home and /en-route still call `pickWinner(rawRoutes, allZones)` with no third argument — they implicitly mean "leave now," which is what most trips are. Forward-looking signature for when scheduling lands; zero churn today. Default values are an underrated tool for forward-compatible API additions.
- **Mock fallback grew with the categories.** Original mock was 3 polygons covering safe/caution/avoid. With the new categories shipping behind the same `SHOW_ZONES` debug toggle, the mock needed to demonstrate police/wildlife/road-condition zones too — otherwise the demo screenshot would be misleading when Overpass is unreachable. Six mock zones now, one per category. Mock fidelity is part of the demo experience, not a fallback afterthought.

---

## chore/figma-fidelity-audit-3 (2026-05-06)

Third fidelity audit, after three structural PRs (community-report, en-route, review-guidance). What we did, in plain terms:

- **Recurring miss across screens: tap-target compliance via hitSlop=8 instead of hitSlop=12.** Pattern showed up in /report (4 close-X / chevron-back buttons, 8pt → 12pt), making them HIG-compliant on the visual + slop math. Lesson: when copying the modal-header dismiss pattern, default to hitSlop=12 from the start. 8pt was the original value; 4pt nudge per side compounds across every modal we ship.
- **Daylight gradient had two competing palettes.** /home's bottom-sheet strip (orange→mauve→indigo, the literal colors of light from afternoon to night) and `lib/daylight.ts`'s polyline (green→yellow→orange→red, a severity scale) both encoded the same axis with different colors. The Figma's intent — confirmed via Route Experienced (825:3715) — is one canonical gradient: orange→mauve→indigo. The severity-style gradient ("good→bad") was inherited from a generic palette and contradicts the thesis register, which is "this is what your trip looks like at sunset," not "drive at risk." Updated `colorForMinutesToSunset` to sample the strip palette at 5 bands. One axis, one canonical encoding, one set of colors. Bottom-sheet strip and polyline now agree.
- **Welcome checkbox had no state.** It rendered as a Pressable with no `useState`, no `accessibilityState`, no toggled visual. VoiceOver couldn't tell it was checked; tap did nothing. Added a real boolean state, accessibility state, and a checkmark Ionicon that renders only when checked. Visual bumped 18→24pt with `hitSlop=20` for HIG compliance via the exception clause (genuinely-constrained dense row alongside legal copy). Unrelated original miss — first build was visual-only, missed the interaction half.
- **Search recent items: paddingVertical 4 → 10 was the cleanest HIG fix.** No hitSlop was set; the row was 32pt tall (icon 24 + 4×2). Bumping padding to 10pt brings total to 44pt — visual itself is HIG-compliant, no fallback math needed. Easier to reason about than hitSlop.
- **En-route utility buttons: the 32pt icon in 44pt frame was visually crowded** (only 6pt of pill visible per side). Dropped to 24pt icons; same 44pt frame now reads as "icon sitting inside pill" rather than "icon filling pill." The earlier iteration that bumped icons to 32pt was reaching for in-driving readability, but at the cost of the visual register. 24pt was the correct middle ground all along — Figma had it at 16pt, we found 24pt as the readable-without-crowding sweet spot.
- **Patterns ship faster than fixes.** Each of the five misses above was a single PR's worth of drift, but accumulated over three structural PRs they hit critical mass. Every audit, the pattern is the same: a few systemic misses (hitSlop, daylight gradient axis), a few one-offs (Welcome checkbox state). Auditing every ~5 PRs catches them before they become muscle memory.

---

## feat/review-guidance (2026-05-06)

The post-incident reflective Do/Have/Say/Know flow lands. What we did, in plain terms:

- **CLAUDE.md was wrong about /what-to-do being a tab navigator.** It described "/what-to-do as a tab navigator with four content variants." The real design — discovered by asking the user, not by re-reading docs — is a *sequential* flow: Officer/Trooper → Do → Have → Say → Know, traversed with chevrons, one screen at a time. Reflective post-incident review, not active-driving urgent guidance. The doc described the Figma's *content variants* and inferred the wrong navigation pattern. Lesson: when CLAUDE.md describes architecture, treat it as one source among many — confirm with the user *and* with Figma before building.
- **State machine in one route, not five separate routes.** Same play we used in /report (picker → detail → thank-you): one modal envelope, internal index 0–4, chevron back/forward decrements/increments. Sidesteps the iOS modal-on-modal stacking quirk this codebase has hit before (the prior /safety → /pulled-over → /armed-or-not chain). Cleaner state, cleaner architecture, faster build. Pattern reuse is its own win — every additional time we use it, the next person reaches for it sooner.
- **`router.dismissAll()` is the right exit for nested modal flows.** Plain `router.back()` from /review-guidance only pops one level, leaving the user on /armed-or-not (also a modal), which they'd have to dismiss. Then /safety. Three taps to escape after a stressful arc — bad UX. `dismissAll()` unwinds every stacked modal at once and lands on the underlying stack route (/en-route). Pattern worth remembering for any modal flow that's >1 deep.
- **Flow position determines the register, not the content.** The same Officer/Trooper screen we'd built for the active-pre-stop path turned out to belong in the *post*-stop reflective flow. The content didn't change; its position in the user journey did. Lesson: a screen's chrome and copy are determined by its job in the flow, not just by what's on it. Always confirm flow position before building.
- **Conditional rendering branched on a single param keeps the data shape flat.** The "What to Say" sub-view's first bullet (concealed-carry declaration) only renders when `armed=yes` or `preferred-not-to-answer`. One boolean (`showFirearm`), one if-block in the bullets array — no separate variants table, no duplicated screens. Simple branch in the view, single source of truth in the URL param.
- **Deleted /pulled-over.tsx in the same diff that absorbed its content.** Per anti-slop rule #5: "delete what you replace." Git history preserves the standalone Officer/Trooper screen if we ever want it again; the live tree stays uncluttered. No "in case we need it" leftovers.

---

## feat/en-route (2026-05-05)

The active-driving state. What we did, in plain terms:

- **The Figma metadata audit reframed the docket.** Before pulling the full Flow canvas, "What's NOT shipped" in CLAUDE.md called En-Route "out of scope." After listing the 38 designed screens, En-Route turned out to be the connective tissue between the technical claim (good routes) and the moral claim (handling stops): the safety modal, the report modal, the trip-summary popup all presuppose you're driving. The doc was wrong; pull the canvas before trusting the doc. Lesson: design docs decay, design files don't.
- **Map setup duplicated, not extracted (rule of three).** /home and /en-route share route fetching, zone fetching, scoring memos, useFocusEffect refresh, polyline rendering, circle rendering. About 80 lines of duplicated logic. The rule says inline twice, extract on three. Premature extraction would force a `<RoutedMap />` API decision before we know what /en-route's third sibling (Trip Summary? Two Zone Turn Card?) actually needs. Cheaper to copy-paste now and refactor when the shape is clear than to design for hypothetical future requirements.
- **`router.push` on /en-route gives free swipe-to-dismiss.** No explicit "End trip" button on the design — the system swipe-back gesture handles it because the screen is stack-pushed (not modal-presented). Trusting the platform affordance kept the chrome clean. Modal presentation would've broken the gesture; stack push respects it.
- **Side button column = the bridge.** Shield → /safety, Report → /report, Center → recenter. Three out of four buttons wire directly into existing flows. Building En-Route added zero new flows but unlocked four downstream ones (safety, report, recenter, future help). Highest leverage build of the session per line of code.
- **Placeholder turn instruction beats fake turn-by-turn.** OSRM gives route geometry, not turn-by-turn instructions. Faking instructions ("Turn left in 0.3 mi") at runtime would require either a routing engine or a hand-tuned heuristic that lies. Static placeholder ("Turn left onto South Cedar Street, 0.5 mi") communicates the design intent without claiming functionality we don't have. Same play as the photo-stub on /report — visible affordance, honest scope.
- **Title2/Emphasized was the missing token.** Turn instruction is 22/28/700/-0.26 — Title2/Emphasized in iOS HIG. Wasn't in `theme/typography.ts` because no prior screen needed it. Added it before using it (per anti-slop rule #2). Token system continues to grow only when the design demands it; not a token-completionist exercise.
- **iOS HIG > Figma — but with a real exception clause.** Mid-PR we promoted "44pt visual takes precedence over Figma" from suggestion to rule (`.cursorrules` + CLAUDE.md). Then immediately ran into the case the rule's exception clause was written for: 4 utility-secondary buttons in a dense status row, where 44pt visual would crowd the ETA number and read as primary actions. Resolved with 28pt visual + `hitSlop=12` (52pt effective tap area). The exception is "small icon inside a dense row where 44pt would break the layout" — and "break" includes soft visual break, not just literal overflow. Rule + exception clause encoded together so the next person reading the rule sees both halves.
- **Figma fidelity audit cadence is now codified.** Every ~5 PRs, branch `chore/figma-fidelity-audit-N`, diff every shipped screen against its Figma node, fix drift in one PR. Added to `docs/workflow.md` (step 12) and surfaced in `CLAUDE.md` (workflow step 9). Already 2 audits done informally — codifying made it part of the rhythm rather than something we'd notice was missing later. Five sub-44pt tap targets across the app (Welcome checkbox, pulled-over chevron + close, search recent items, report close X) noted but deferred to the next audit branch — keeps this PR scoped.

---

## feat/community-report (2026-05-05)

The full community-reporting flow lands. What we did, in plain terms:

- **Single screen, internal state machine — not three routes.** The Figma shows three "popups" (picker, detail, thank-you) but they all share one backdrop and one card. That's a state machine, not a router shape. `useState<'picker' | 'detail' | 'thank-you'>` + sub-component dispatch reads cleaner than three screens with inter-route param passing, AND avoids the iOS modal-stack quirk (see prior PR's note on /safety presentation). One screen, three views; the route boundary is the modal envelope, not the views.
- **`presentation: 'transparentModal'` is the right tool when you want a popup, not a sheet.** iOS's `'modal'` slides up from the bottom and takes over the screen; `'transparentModal'` fades in over the previous screen which stays mounted. The map underneath stays interactive for the duration. Use it for anything that's conceptually an overlay — drop-pin, action sheet, confirmation — not a navigated destination.
- **Refactored ranked-routes from `useState` to `useMemo`.** Old pattern: `setRoutes(pickWinner(...))` called from the fetch effect, twice (once with empty zones, once with full zones). New pattern: store `rawRoutes`, `osmZones`, `reportZones` as separate useState slots; derive `routes` via `useMemo`. Result: when reportZones updates from `useFocusEffect`, ranking recomputes automatically. No second effect needed. Three sources of truth, one derived value — cleaner than juggling setRoutes call sites.
- **`useFocusEffect` for "refresh on return-to-screen" patterns.** Submitting a report on /report and tapping Close should land the user back on /home with the new report already on the map. `useFocusEffect(useCallback(...))` runs on every focus, including initial mount and post-modal-dismissal. Cheaper than a polling interval, more reliable than imperative refresh calls. Signature requires `useCallback` to stabilize the effect's identity — copy-paste the pattern, don't forget the wrapper.
- **`Zone` discriminated union grew a new variant without breaking consumers.** Adding `'point'` to `'polygon' | 'polyline'` required: extending the type, adding a `case 'point'` branch in the scorer dispatch, and a new geometry-specific renderer. TypeScript caught the missing branch in scoring on the first compile. The reducer-style switch on `zone.geometry` is what makes the discriminated union earn its keep — adding a variant means adding one branch in each consumer, not auditing every callsite.
- **Anonymity at write-time, not at storage-time.** Sensitive-category reports never persist a `submittedBy` field. The user can't later "de-anonymize" a sensitive report because there's no record of who they were when they made it. Compare: storing the field but flagging it `private: true` — same UX, much more leakable. The strongest privacy guarantee is the absence of data.
- **Photo affordance as visible stub instead of hidden TODO.** The dashed-border tap target renders; tapping shows "coming soon." User sees the future of the feature without tripping over a half-built camera flow. Better than hiding it (loses context for designers/users) AND better than implementing a half-version (sets a ceiling on quality). Signal the intent; defer the work.
- **`addCommunityReport` returns the inserted report.** The Thank-You screen needs the id to support Undo. Returning the full report from `add(...)` is one extra line in the adapter and saves the consumer a separate `getById` call. Adapters that return what they wrote are friendlier than adapters that return void.

---

## feat/home-report-button (2026-05-05)

The community-reporting flow's entry point. What we did, in plain terms:

- **`onLayout` + conditional-render pattern for buttons anchored to a measured sibling.** The Report button floats 24pt above a bottom sheet whose height grows with content. State holds the measured height (init 0); the sheet's `onLayout` writes to it; the button only renders when `> 0`. One frame of "no button" is preferable to one frame of "button at the wrong position." Reusable shape for any future floating-anchored UI (e.g., the En-Route side-button column tracking the same sheet).
- **Expo-router unmatched routes interact weirdly with modal-presented routes in the stack.** Tapping a dead-link route then "back" landed on `/safety` (modal-presented) instead of `/home`, even after a fresh app start. Didn't dig into root cause — wrote a 15-line stub at `/report` instead. Sometimes a tool quirk is cheaper to paper over than to understand. The stub gets fully replaced by the next PR; the cost is low and the symptom is gone.
- **Scope creep can be the right call.** The handoff said "dead link to /report is fine for one PR." It wasn't, once the modal-stack quirk surfaced. Expanding PR scope by 15 lines to ship clean nav beats shipping a documented bug. Revisit the handoff's assumptions when reality disagrees with them.
- **Reserved-color rule grew without weakening.** Orange `alert-circle` for the Report identity icon could've been framed as an "exception to the rule." Instead it's framed as "consistent with the rule's intent" (reserved colors signal safety; reporting *is* a safety signal). Same outcome, but keeps the rule strong everywhere else — exceptions invite more exceptions; alignments don't.
- **The audit pays compounding interest.** Six Figma frames came back tightened after one round of feedback (tile gap 32→24, submit 36→44pt, anonymity disclosure promoted to title block, per-category CTA copy differentiated, Title1 Regular added). Auditing before coding once saved auditing after coding three times.

---

## chore/figma-fidelity-audit-2 (2026-05-05)

Second audit pass on the lighter screens. What we did, in plain terms:

- **Recurring miss across screens: M3 Elevation 1 shadow on filled buttons.** Welcome (Get started + Log in), Onboarding (Continue), Permissions (Settings) all specced an Elevation 1 shadow in Figma — a small drop shadow that lifts the pill button off the surface — that I'd missed during initial builds. Added the same approximation pattern: `shadowOffset: {0, 1}, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2`. Outlined buttons (Get Started's auth options, Permissions sub-rows) correctly don't have shadows.
- **Get Started: replaced `spacerTop: 200` hack with flex centering.** Original used a 200pt View to push title down; restructured to use `flex: 1, alignItems: 'center', justifyContent: 'center'` on outer + `width: 326, gap: 88` on inner wrapper. Same visual on iPhone 14, but now responsive across device heights — content centers on whatever screen.
- **Welcome: replaced `marginTop: 16` on subtitle with `gap: 16` on titleBlock.** Same visual outcome, but matches Figma's flex column structure rather than CSS-style margins. Cleaner hierarchy.
- **Spot-checks passed for Home and Safety modal.** Home's bottom sheet was rebuilt against Figma 825:3635 carefully; Safety modal got fixed yesterday + the user consolidated the footer to TrustedContactStatus. Nothing additional to fix.
- **Audit pattern that's worked across both passes.** Pull Figma node → scan for load-bearing structural patterns (flex hierarchies, gap values, justify-*, fixed dimensions, shadows) → compare structurally → fix. Don't chase pixel-level deltas; the structure is what reads as "right" or "off." Most screens needed only minor tweaks once the pattern was established.

---

## chore/figma-fidelity-audit (2026-05-04)

Audit pass on the screens flagged for spacing/structural fidelity issues. What we did, in plain terms:

- **Pulled-over: same flex-1 + justify-end miss as armed-or-not.** Close link was sitting `gap: 40` below the cards instead of being pushed to the bottom of available space. Fixed by adding a `closeArea` wrapper with `flex: 1, justifyContent: 'flex-end'` — same pattern that fixed armed-or-not.
- **Search: full Landing rebuild.** Previous version was a barebones text input with back chevron — actual Figma shows gray-fill search bar (chevron + input + mic), Quick Tools horizontal scroll (Saved/Trending/Food/Gas/Parking), Fuel section CTA, Recent searches list. Rebuilt to match.
- **Hardcoded widths fail on wider iPhones.** `width: 374` was set on the search bar (and `width: 358` on the menu row) on a 390pt iPhone 14 baseline. On iPhone 14 Pro Max (430pt) or 16 Pro Max (440pt), `width: 374` centered creates a 28pt+ edge margin instead of the intended 8pt. **Fix: `alignSelf: 'stretch'` + `marginHorizontal: 8`** — preserves the "8pt from each edge" design intent across all device widths. Applied to both /search and components/SearchBar.tsx; menuRow got the analogous `marginHorizontal: 16` fix.
- **Audit methodology that worked.** Pull the Figma node via MCP, scan its source for the load-bearing structural patterns (flex-1, gap values, justify-content, items-*, fixed dimensions). Compare to my implementation. Look for missing wrappers, missing flex-1 + justify-* combinations, hardcoded widths that don't scale. Fix the structural misses; ignore pixel-level minor differences.
- **Audit lesson worth keeping.** "Lands but feels off" feedback is signal that a structural pattern was missed (typically flex-1 + justify-* for "fill remaining space"), not that individual values are wrong. Match Figma's hierarchy, not just its numbers.

---

## feat/armed-or-not (2026-05-04)

The pulled-over flow advances. What we did, in plain terms:

- **`Animated.Value` + `Animated.loop` for the pulse dot.** Stored in `useRef` so it persists across renders; sequence of two timing tweens (1 → 0.3 → 1) wrapped in a loop. `useNativeDriver: true` runs the animation on the native UI thread so it stays smooth even when JS is busy. Cleanup on unmount via `loop.stop()` so it doesn't leak.
- **Extracted `<TrustedContactStatus />` at the third use point.** The "Your trusted contact is being notified" footer was inline on safety modal, would be on armed-or-not, and will be on the upcoming what-to-do screens. Three uses = extract. Component owns the text, the dot, and the pulse animation. Future "real notification backend" wiring goes in one place.
- **The diligence lesson on Figma fidelity.** First pass at armed-or-not used `gap: 40` between title and cards. That matched one Figma value but missed the structural intent — Figma has a `flex: 1, gap: 48, justifyContent: 'center'` wrapper around the cards that takes remaining space and centers them. Without that wrapper, cards just hang 40pt below the title; with it, they float in the middle of available space. **Match Figma's structure, not just its individual gap numbers.**
- **`width: 238` on inner content for controlled text wrapping.** Card subtitles are designed to wrap to 2 lines. Without an explicit width, they'd stretch the full card and stay on one line — different visual rhythm. Constraining the inner content column matches the wrapping behavior the design depends on.
- **Shadow clipping in narrow containers.** Card shadows extend ~3pt past their bounds. If a parent has clipping (ScrollView, rounded panel root) the shadow's L/R edges can get cut. Fix: small `paddingHorizontal` on the cards' container (4pt is plenty).
- **Diligence over speed.** "Lands but feels off" feedback is signal that I missed something structural. Faster to redo it carefully than to ship a near-miss and accumulate visual debt.

---

## feat/safety-modal (2026-05-04)

The cultural center begins. What we did, in plain terms:

- **Modal presentation in expo-router.** `<Stack.Screen name="safety" options={{ presentation: 'modal' }} />` tells the router to present /safety as a sheet that slides up from the bottom over the current screen, with system swipe-down dismissal. Same routing API (`router.push('/safety')`) — different visual presentation. iOS-native sheet behavior for free.
- **Per-screen overrides inside a global Stack.** Default `screenOptions` apply to every route; specific routes can override by listing them as explicit `<Stack.Screen>` children. Pattern reused for disabling swipe-back, custom animations, or any per-route navigator config.
- **Data-driven JSX from a typed config array.** Four tabs defined as `TABS: SafetyTab[]` outside the component, mapped into JSX inside. Adding a fifth tab later is one entry in the array — no JSX edit. `iconName: keyof typeof Ionicons.glyphMap` typing means Cursor autocompletes icon names and red-underlines typos. Same pattern as PANELS in onboarding.
- **The thesis claim's cultural side now has a foundation.** The technical claim (zone scoring picks safer routes) was demoable two PRs ago. The cultural claim (Fresh Greens addresses driving-while-Black with situation-specific guidance) needed UI to land in. This is that UI's entry point. Each tab is a chapter; future PRs flesh them out — pulled-over being the most thesis-relevant given the Onboarding 1 framing.

---

## feat/zone-data-osm (2026-05-04)

The thesis claim becomes defensible. Mock data is fully replaced with real public sources, and the daylight gradient is real solar geometry. What we did, in plain terms:

- **Multi-source OSM data via Overpass API.** One round-trip query fetches three signal types into the same Zone[] pipeline: streets tagged `lit=*` (polyline), landuse polygons (residential/commercial/industrial — polygon), and parks (polygon, mapped to caution per nighttime-crime literature). Layered signals compound — a residential street that's `lit=yes` accumulates safe + safe; the scoring becomes more robust than any single signal.
- **Discriminated union for geometry types.** `Zone` now has a `geometry: 'polygon' | 'polyline'` discriminator. Three places branch on it: parser (polygon for landuse, polyline for streets), scorer (in-polygon test vs. point-near-polyline), renderer (`<Polygon>` vs `<Polyline>`). TypeScript narrows the type when you check the tag.
- **Point-to-polyline distance via equirectangular projection.** Lat/lng deltas → meters using `1° lat = 111000m` and `1° lng = 111000 × cos(lat)`. Project point onto each segment, clamp to segment extent, return Euclidean distance. Accurate enough at neighborhood scale; would matter at country scale where Earth curvature can't be ignored.
- **Real solar geometry via SunCalc.** `lib/daylight.ts` now uses the library to compute actual sunset times per segment's lat/lng + estimated arrival time. The gradient encodes minutes-to-sunset against real solar math, not just position-along-route. 5KB pure-JS dependency, MIT.
- **Hidden-by-default data overlays.** `SHOW_ZONES` constant in home.tsx defaults to false — the user just sees the route, not the polygon/polyline data underneath. Flip to true for thesis screenshots that need to argue "this data drove the choice." Same app, two views, both honest.
- **AbortController for fetch timeouts.** RN's fetch has no built-in timeout, so a hanging server would block forever. Pattern: `const controller = new AbortController(); setTimeout(() => controller.abort(), 6000); fetch(url, { signal: controller.signal })`. Aborted fetch throws, gets caught, falls back to mock. Hard ceiling on wait time.
- **Optimistic / progressive rendering.** Routes (OSRM) and zones (Overpass) start fetching in parallel, but we sequentially `await` them so routes render the moment they arrive (with a default ranking) and refine when zones land. Same total time, way better perceived speed. The intermediate state isn't wrong — it's just not yet opinionated.
- **`pickWinner(routes, [])` is a graceful default.** With empty zones, all routes score 0; stable sort preserves OSRM's original order; first result becomes "recommended" by default. That matches what a non-Fresh-Greens nav app would do. When real zones arrive, scoring kicks in and may shift the choice.
- **The thesis claim, validated.** Today's screenshot: real OSM lighting tags + real landuse classifications + real OSRM routing + real solar geometry. Mock-only is gone. The architecture's adapter pattern earned its full keep — no consumer code changed during any of these swaps.

---

## feat/search-destination (2026-05-04)

The app becomes interactive. What we did, in plain terms:

- **URL params as state.** The destination doesn't live in React state — it lives in the URL. `router.replace({ pathname: '/home', params: { destLat, destLng, destName } })` puts the data into the URL. `useLocalSearchParams<{...}>()` on /home reads it back. Three nice properties: destination survives re-renders, deep-links work for free (`freshgreens://home?destLat=...`), and there's no "tell home to refetch" mechanism needed because the URL changing IS the trigger.
- **`useEffect` deps array drives refetch.** Adding `params.destLat` and `params.destLng` to the deps array means: re-run this effect when those values change. Type a new destination → URL params update → effect re-runs → routes refetch. The "loop" between search and home is a single line of code.
- **`Location.geocodeAsync` for free geocoding.** expo-location ships with forward geocoding (place name → coordinates). iOS uses Apple's geocoder, no API key. Returns an array because place names can be ambiguous ("Springfield" matches 30+ cities); we take the top result. Real production might surface a list for the user to pick.
- **`<TextInput>` first appearance.** RN's text input primitive. `autoFocus` opens keyboard on mount. `returnKeyType="search"` makes the keyboard's blue button read "Search." `onSubmitEditing` fires on the return key. `editable={!loading}` prevents double-submission while geocoding.
- **`router.replace` vs `router.push`.** Push adds a screen on top of the stack; replace swaps the current screen for a new one. We use replace from /search → /home so the search screen pops out of the stack rather than stacking duplicate /home routes. Minor stack quirk: the *original* /home is still in the stack one level deeper, so back-swipe lands there. Acceptable for thesis demo; future fix would be a global state store (Zustand or Context) instead of URL params.
- **The thesis demo is now end-to-end.** Type → geocode → route → score → render → explain. Every step is real. The remaining work is polish (illustrations, schedule time, zone data sources) and additional flows (safety modal, auth) — none of which change the architectural shape of what's shipped.

---

## feat/onboarding-pager (2026-05-04)

Three onboarding screens become one. What we did, in plain terms:

- **Horizontal `FlatList` + `pagingEnabled` = native iOS pager.** No new dependency, no separate library. Set `horizontal pagingEnabled showsHorizontalScrollIndicator={false}` and the FlatList snaps to one item per swipe. Each item rendered at exactly screen-width using `useWindowDimensions`.
- **`useWindowDimensions()`** just returns the current screen size. Updates on rotation. Use it instead of hardcoding 390 — different iPhones have different widths (390, 430, 375), and the value re-flows automatically when the user rotates.
- **`useRef<FlatList>` + `scrollToIndex` = a remote control.** A ref grabs hold of the rendered FlatList; later you can call methods on it like `pagerRef.current?.scrollToIndex({ index: 1 })`. Same imperative-handle pattern as `useRef<MapView>` for `animateToRegion`. Without a ref you can only feed data; you can't *tell* the component to do something.
- **`onMomentumScrollEnd` vs `onScrollEndDrag` — different moments, different jobs.** A swipe has two phases: (1) finger drags, (2) page snaps after release. `onScrollEndDrag` fires at the start of phase 2 (finger lifts). `onMomentumScrollEnd` fires at the END of phase 2 (snap completes). For tracking the active page, use `onMomentumScrollEnd`. For detecting "user dragged past the last page" (before the bounce-back snap pulls them back), use `onScrollEndDrag`.
- **Magic numbers start as guesses, get tuned by feel.** Initial 60pt overscroll threshold felt stiff; dropped to 30pt. There's no objectively correct value — pick one, try it, iterate. Same workflow for `gap` values, padding, button heights. Architecture decisions deserve thought; small dials deserve iteration.
- **Inline vs extract = master vs instance in Figma.** Same mental model: extracting code is the same as making a component in Figma. Master = single source of truth (the extracted function/component); instances = each use site (each call). Props = instance overrides. Detaching = inlining. Rule of three applies in both worlds: write it twice inline before componentizing, in code or in design.
- **Two functions for two events, not one branching handler.** `handleScrollEnd` and `handleDragEnd` could've been one function with `if`-branches. Splitting them matches the natural shape of the problem — each event has different semantics — and makes each function's job obvious from its name.

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
