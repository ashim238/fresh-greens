# Next-session punch list

Post-`v1.0-thesis` iteration backlog, captured at the end of the thesis push (2026-05-13). Items roughly grouped by type. Each line is the user's note verbatim, lightly annotated with the file or pattern most likely to touch the fix.

## Audit follow-ups — focused session-surfaces pass (2026-05-30)

Minor findings from the focused static audit of the surfaces this session touched (the blocker + 4 importants were fixed in `99fe915`). All low-severity:

- **Quick a11y nits** — `/search` Saved-row `accessibilityLabel` uses a mid-string period ("Route to X. X.") → VoiceOver reads two sentences; use a comma. Saved rows + `/en-route` Shield FAB lack `accessibilityHint` (parity with the SOS FAB / query tiles). `/safety-settings` Emergency-SOS row label omits the "Tap to open…" action prompt its sibling rows include. `/home` daylight-strip wrapper could add `accessibilityRole="none"` (Android belt-and-suspenders).
- **`/en-route` SOS haptic** — `selectionAsync`, identical to the Report tap; consider `notificationAsync(Warning)` so the emergency trigger feels distinct.
- **`/menu` "What we flag" hierarchy** — sub-header vs toggle-label distinction rests on font-weight alone (`labelSecondary` #3C3C43 ≈ `labelTertiary` #3D3D3D). Approved for now; if it ever reads ambiguous, drop to `caption1Regular` or a genuinely lighter gray.
- **Spacing-token discipline (pervasive, pre-existing)** — raw `gap: 16/24` instead of `spacing.*` across several screens. Codebase-wide convention drift, not a session regression; worth a sweep someday.
- **`/search` tile toggle (pre-existing)** — deselecting a query tile (Food/Gas/Parking) leaves the search query set; minor interaction ambiguity, predates this work.
- **`/roadside` file split (post-`feat/roadside-assistance`)** — `app/roadside.tsx` is ~817 lines hosting `Roadside` + 4 step components + helper + const + type + one styles block. Internally cohesive today (one route, one state machine, components only used by their sibling steps), but if a Step 4 or a major addition lands, split into `app/roadside/{ProblemPicker,WrongSpotModal,ActionMenu,LiveStatus}.tsx`.
- **`/roadside-setup` hydration via `useEffect`** — current code does conditional `setState` during render (`roadside-setup.tsx:46-52`) to seed the form from a loaded profile. Works because the `hydrated` guard flips once, but the pattern trips React 19's stricter dev warnings later. Move to a `useEffect` on `[loading, profile]` when next touching the file. `app/fuel.tsx` has the same pattern — sweep both together.
- **`ActionMenu` local `useRouter` redundancy** — `app/roadside.tsx`'s `ActionMenu` calls `useRouter()` for its `router.push('/roadside-setup')` + `router.push('/trusted-contact-setup')`, while the parent `Roadside` also has one. Symmetric with `LiveStatus` would mean passing the two navigations as callbacks. Drop the inner `useRouter` when next touching the component.
- **`/unfamiliar` re-entry race (post-`feat/unfamiliar-and-share-location`)** — `app/unfamiliar.tsx:82-84` reads `session` inside `useState(() => …)` initializer, which fires before `useShareSession`'s focus-effect resolves. Race window is the AsyncStorage read; if a user opens `/unfamiliar` mid-load, they land on `'problem'` even when a session exists in storage. Guard the picker render on `loading` OR derive `step` from `session` directly. Low likelihood but a real bug class.
- **`router.back()` fallback when `!canGoBack()`** — `unfamiliar.tsx:132-139` (`handleSafeNow`) and `share-location.tsx:62-69` (`handleEnd`) assume there's a route to back into. Direct navigation (e.g. from a future notification) would strand the user. Wrap with `router.canGoBack() ? router.back() : router.replace('/home')`.
- **`LifelineModal` empty-phone guard** — `components/LifelineModal.tsx:40-46` strips formatting from `phoneNumber` but doesn't validate that anything's left. `canOpenURL('tel:')` may report supported on some devices, opening a blank dialer. Defensive bail with the existing "Unavailable" Alert if the sanitized number is empty.
- **`DESTINATIONS` error-copy fragility** — `unfamiliar.tsx:111` builds the no-results Alert via `title.toLowerCase().replace('take me to ', '')`. Works today; brittle if Figma copy ever drops the prefix. Grow `DestinationOption` with an explicit `searchNounSingular` field when next touching the array.

## Phase 0b — un-triaged dead-ends (found by the 2026-05-30 acceptance sweep)

Phase 0 (`ae79812`) removed the *enumerated* dead-ends (Google/Email auth, inert /menu rows, /search Trending, plus the query-tile deselect bug + honest /report copy). A codebase-wide `rg` for `coming soon|future update|not yet supported` then surfaced dead-ends the spec's triage table never listed. Each needs a **cut / hide / wire** decision before "zero visible dead-ends" is literally true:

- **/en-route mic button** (`en-route.tsx:1329`) — "Voice control (not yet supported)", no `onPress` (taps do nothing).
- **/en-route Volume button** (`en-route.tsx:1438`) — Alert "Voice prompt controls land in a future update."
- **/en-route alternate-paths FAB** (`en-route.tsx:1607`) — "Show alternate paths (coming soon)"; the app *does* compute alternates, so this is plausibly WIRE-able.
- **/search Fuel card** (`search.tsx:614`) — "Coming soon" hint, no `onPress`; could WIRE to the /search fuel query like the Quick Tile, or cut.

Known Phase-1 deferrals (already triaged as WIRE, intentionally still present): **/menu Quick Tiles** (Fuel, Notifications) and the **/safety inert tiles** (Roadside, Unfamiliar area, Share my location).

**Triage decisions (2026-05-30) — status:**
- ~~**HIDE now:** /en-route voice (mic) + Volume buttons~~ — ✅ done (`74c2d98`); buttons + orphaned imports/style removed.
- **Feature track — Voice-guided navigation + en-route voice search (STILL OPEN):** spoken turn-by-turn (gates a future Volume control) + speech-to-text destination input (gates a future mic). Requires an Expo dev build, a speech library, and a mic-for-dictation permission. Own brainstorm→spec→build cycle.
- ~~**BUILD — Alternate-route comparison (/en-route alternate-paths FAB)**~~ — ✅ shipped (`457f3ef`). Comparison sheet + switch + condition chips + map duration badges; `recommended`→`activeRoute` refactor. Anchored to Figma `2:9033`. Spec + plan in `docs/superpowers/`.
- ~~**BUILD — Refuel reminders (/search Fuel card)**~~ — ✅ shipped (Plan 1 `d9cb709` core + Plan 2 `1997010` on-route stops). Time-based reminder + car profile + /fuel screen + on-route fuel stops in /en-route.

## Visual fidelity / Figma drift

- **Safety page matches v2 Figma + confirmation modal popup** — `app/safety.tsx` against current Figma node; confirmation modal pattern likely lives on a new tap path off one of the four tiles.
- **Home bottom sheet matches the v2 version** — `components/HomeBrowseSheet.tsx`, Figma `1133:13690`. Current shipped form is structural; v2 has photo, quote callout, tag rows in a card-shaped layout that the placeholder doesn't fully implement.
- **Report modals match v2 design** — `app/report.tsx`. Currently still v1 design per `docs/architecture.md`.
- **Custom "community signal" icon for Round 4 surfaces** — Phosphor doesn't have a clean fit for "trusted by your community" semantics. Star (currently used in Row 1 empty state, `HomeBrowseSheet.tsx` `TrustedByCommunityEmpty`) reads as "favorites/saved" — forward-collision with any save-spot feature, and visually inconsistent with the row's framing. Two assets to design, both burntgreen (`#003F04`) single-color SVG so they theme-tint cleanly: (1) **64×64pt** for the Row 1 empty-state card (drops in next to the per-category `PhotoPlaceholderGlyph` family in `HomeBrowseSheet.tsx`); (2) **24×24pt** for section-header glyphs in Round 4 PR B's multi-row layout (matches the section-title row pattern Apple Maps uses for collection rows). Visual directions worth exploring: overlapping silhouettes/hands cradling a pin, a pin with concentric ripples (signal echoing outward), or a chorus of small markers converging on one spot. File names: `community-signal.svg` (slots next to existing `mapmarker-glyph-*` family). The other rows in PR B can keep Phosphor: existing `PhotoPlaceholderGlyph` mappings for the 5 category rows, `Clock` or `Storefront` for "Open Now" — only Trusted needs custom.
- ~~**Edge markers match Figma (not placeholders)**~~ — shipped across #134–138 (`EdgeIndicator.tsx` cites Figma `1133:13250`). Component implements the full layered composition (42×62 polygon + 36pt disk + 24pt counter-rotated glyph, per-category routing). The "32pt pill with generic glyph" description here hasn't matched reality since the redesign rounds.
- ~~**Trusted contact text → body regular, not emphasized**~~ — already there. `ContactView` styles (`pulled-over.tsx:1669-1727`) use `title1Regular`/`subheadlineRegular`/`title2Regular`. No `bodyEmphasized` left to swap.
- ~~**Guidance flow has 24px padding**~~ — already there, via composition. `guidanceStyles.page` uses `paddingHorizontal: 8` inside the modal's 16pt safe-area gutter → 24pt effective. Inline comment at `pulled-over.tsx:1546-1550` explains the math.

## Interaction polish

- ~~**Drag-and-drop icon swap**~~ — shipped in #184 (canonical `DragAndDrop` SVG from Figma `1114:10979`) + revised in #187 to a single clean teardrop pin after the canonical asset's two-pin stylization read as duplicate markers on a real map.
- ~~**Drag-and-drop pressure**~~ — closed. Drag attempted in #187 (PanResponder rewrite) then reverted: combining a drag gesture with the map's own pan recognizer made the interaction feel ambiguous. Tap-to-move is the only placement gesture now — friction-free for the common case, and the cancel/confirm row handles abort.
- ~~**Zone preferences dropdown doesn't collapse**~~ — re-verified, tapping the row *does* collapse it (`menu.tsx:370` flips state). The original complaint was about the missing close animation: `LayoutAnimation.configureNext` is intentionally fired only on the expand direction because firing it on collapse can prevent the state update from registering (see comment at `menu.tsx:364-366`). Functional behavior is correct; the unanimated collapse is a deliberate workaround. Revisit only if it bothers anyone in practice.
- ~~**Map pin on-tap functionality**~~ — shipped. All variants wired: community report → `ReportDetailCard` (`home.tsx:818`), saved-home → recenter + selection haptic (`handleHomeMarkerPress`), trusted-friend → Call/Text Alert (`handleTrustedFriendMarkerPress`), cluster → fit-bounds zoom (`home.tsx:783`).
- ~~**Hold-to-delete on community-report markers**~~ — shipped. Author-only (`reportSubmittedBy === user.id`) long-press via `MapView.onLongPress` proximity hit-test → heavy haptic → destructive Alert confirm → `removeCommunityReport(id)`. `Zone` gained `reportSubmittedBy` field threaded from `CommunityReport.submittedBy`.

## A18 — Heading wedge on /home user-location dot

- **UserLocationMarker gains a heading indicator.** Translucent systemBlue wedge fanning forward from the dot in the direction the user is facing — Apple Maps "you-are-here-and-facing-this-way" convention. **Scope: /home only.** /en-route already has heading via `EnRouteCarMarker` (car rotates with `heading` prop); adding a wedge there would be redundant.
- **Specs:** 60° wedge, ~25–30pt long beyond the dot's edge, systemBlue at 35% opacity. Rotates via `transform: [{ rotate: \`${heading}deg\` }]` on a wrapper View, behind the dot in z-order. Hidden when `heading == null` or `speed < 0.5 m/s` (direction unreliable at low speeds — show nothing rather than wrong info).
- **Plumbing:** `UserLocationMarker` gains `heading?: number | null` + `speed?: number | null` props. `/home` already runs `Location.watchPositionAsync`; the position object carries both fields. One-line change at the call site to pass them through.
- **Size:** ~30 LOC standalone PR. Independent of Mapbox/lane work — could ship anytime.
- **Design reference:** visual companion mockup at `.superpowers/brainstorm/97027-1779908977/content/heading-indicator.html`. Variant `60-systemblue` was selected.

## New features

- **En-route search** — currently the search bar is /home-only; /en-route has no search affordance. Add a way to change destination mid-trip without backing out to /home.
- ~~**Trip summary screen**~~ — shipped (C12: `app/trip-summary.tsx` — arrival inference-validation + "set as default" regular-destination flow).
- **Code the results page** — search results screen with map+sheet layout (Figma `1133:11400`). Currently /search returns a flat results list; the design is map-with-pins + sheet of result cards.

## Copy

- ~~**Update "thanks for recording" copy**~~ — there's no post-dismiss screen or toast to write copy for. The /pulled-over flow exits via iOS swipe-down directly back to /safety with no intermediate surface. Reframe as a feature (add a post-dismiss surface) if the safety-flow register would benefit from one — otherwise close.

## Round 4 — Discovery experiments

- **Multi-row recommendations sheet (Google Maps-style)** — `components/HomeBrowseSheet.tsx`. Restructure the single-carousel browse mode into a vertical stack of horizontal carousels (each row a different theme). DO NOT replicate Google verbatim; the strongest version is:
  - **Row 1: "Trusted by your community"** — top-rated mixed across all 5 categories, ranked by recency of *community* signal (the row that's uniquely Fresh Greens-shaped). This row carries the differentiator; without it, the multi-row pattern dilutes the chip-driven mission. If we build this, build Row 1 first and decide if the rest is worth it.
  - **Row 2: "Open now"** — utility, mixed categories, `isOpen === true` + distance-sorted.
  - **Rows 3–7: One row per existing category** (Black-Owned, Women-Owned, LGBTQ+, Restrooms, Late Night).
  - **Keep the chips** as a quick-filter mode that collapses the sheet to a single category (current behavior) when tapped. Default state: multi-row browse. Chip tapped: focus mode.
  - Watch: data-load cost (5+ parallel proxy calls on mount), empty-state proliferation in low-density areas, total scroll height inside the capped sheet (~360pt × 5 rows = 1800pt inside a ~720pt sheet — vertical sheet scroll already exists, but UX needs validation on device).
  - Implementation hint: a `useRecommendationsBatch()` hook that fires the per-category requests in parallel with shared cache, vs. firing N copies of `useRecommendations`.

## Round 5 — Safety surfaces + route-preview departure card

~~Four Figma nodes covering the v2 design pass for the safety surfaces AND the /home route-preview state.~~ **Round 5 closed (verified 2026-05-23).** All four nodes are shipped:

- ~~[Figma `1128:5284`](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/Thesis_Draft_Final?node-id=1128-5284&m=dev)~~ → `app/safety-settings.tsx` cites the node directly; shipped in Round 5 PR A.
- ~~[Figma `1133:12323`](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/Thesis_Draft_Final?node-id=1133-12323&m=dev)~~ → `app/recordings.tsx` main view; shipped in Round 5 PR A.
- ~~[Figma `1133:12674`](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/Thesis_Draft_Final?node-id=1133-12674&m=dev)~~ → `app/recordings.tsx` delete-all confirm modal; shipped in Round 5 PR A.
- ~~[Figma `1109:3264`](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/Thesis_Draft_Final?node-id=1109-3264&m=dev)~~ → `app/home.tsx` route-preview card; shipped across audit-9 + #215 (row pairing).

`app/pulled-over.tsx` 5-phase state machine + audio recording + trusted-contact footer + firearm-guidance ACLU copy all shipped previously. Backlog entry was stale.

## Formalized deviations (documented, not drift)

The following ship in code with no Figma backing — captured here so future fidelity audits don't auto-revert them:

- **All-clear chip + "Along this route:" preamble** on the route-preview card. Extension over Figma `1109:3264` (which only shows warning chips). The "we checked, you're clear" read is load-bearing for trust; an absent chips row read as "feature not loaded."
- **Topline variants on `RecommendationCard`** (`closing-soon`, `curator-attribution`). Top-left pill mirroring the existing bottom quote callout. Surfaces the row's load-bearing signal (hours / curator identity) on rows where it's the row's reason for existing.
- **Scroll-to-row chip behavior** (chips are jump-links, not filters). Focus mode retired. See #216.
- **Clear-destination X on route-preview** (top-right). Extension over Figma `1109:3264`; the affordance is needed in practice.
- **Round 6 `Button` border for AA contrast** (`primary+fill` variant). Documented brand exception so freshgreen-on-white passes the 3:1 UI-component contrast floor.
- **"Around Me: {category}" copy** on the focus-mode header — pinned per #210 as a deliberate Figma deviation (locator framing beats activity framing for community-data).

## Scaffolded-but-not-real (named preemptively at thesis defense)

Carried over from the old `docs/v2-followups.md` (folded in 2026-05-19). These are the gaps a thesis reviewer or a code walkthrough would notice. Better to name them in advance than be ambushed.

- **Turn-by-turn instructions are static placeholder copy** — `app/en-route.tsx:86-89, 271-272`. OSRM provides geometry, not steps. v1.5 cheap path: OSRM `steps=true` parameter gives a minimal maneuver list (`Turn left in 0.3 mi`). v2: Mapbox Directions or Google Directions for production-quality narration.
- ~~**Weather card is mocked at "66° / Moderate"**~~ — shipped: real Open-Meteo via `lib/api/weather.ts` (now incl. `cloud_cover`); driving label relabeled Easy/Moderate/Tough → Good/Fair/Poor.
- **/safety modal has 3 of 4 tiles inert** — `app/safety.tsx`. "Roadside assistance," "Unfamiliar area," "Share my location" have `href: null` and silently no-op. Only "I was pulled over" is wired.
- **/menu has inert rows + Quick Tiles** — "Settings," "Schedule a drive," "Theme" rows; Quick Tiles carousel is decorative. The "replaces vs. augments Safety row" call from Round 5 PR C will land here.
- **Reports submit as `'mock-user'`** — `app/report.tsx`. No auth wiring. AsyncStorage is device-local — "the community" is functionally one anonymous user per phone, and reports don't sync across devices.

## Accessibility gaps

- **ScrollView snap doesn't respect Reduce Motion** — `snapToInterval` + `decelerationRate="fast"` not gated on `useReduceMotion()` in the home browse carousel.
- **Carousel container has no `accessibilityRole="list"`** — screen readers don't announce "list of N" on entry to the recommendations row.
- **`cardTitle` doesn't truncate at AX5** — `numberOfLines` is missing; long names + max Dynamic Type push layout.
- **Saved-home + trusted-friend markers don't get a `selected` state** — tapping them fires handlers but no visual feedback.
- **Cluster marker + placement pin missing `accessibilityRole`** — both have `accessibilityLabel` but no role.
- **Dynamic Type expansion** — only ~3 `dynamicType()` invocations across the codebase. Needs broader application + breakpoint testing.
- **Daylight gradient is color-only signaling (WCAG 1.4.1 failure)** — the route polyline encodes daylight via orange → mauve → indigo. Colorblind users (deuteranopia ~8% of men, tritanopia, monochromacy) can't read the transitions. Two layered fixes: (1) non-color cue along the polyline via `lineDashPattern` (solid = day, dashed = twilight, dotted = night) or width changes; (2) accessibility label / inline legend overlay calling out the transitions explicitly ("Daylight for first 12 mi, twilight from mile 12 to mile 18…"). Same problem applies to the bottom-sheet daylight strip key.

## Visual / polish nits

- ~~**Cold-start map shows Mobile, AL until GPS resolves**~~ — shipped in #217. One-shot useEffect watches `userLocation` and `animateToRegion`s on first non-null fix (1000ms, instant under Reduce Motion). Ref-guarded so subsequent GPS updates don't yank the user's pan/zoom.
- ~~**EdgeIndicator count="1" pill**~~ — already handled at `EdgeIndicator.tsx:85` via `showCount = count != null && count > 1`. Singletons fall through to the category glyph. Backlog entry was stale.
- **Cluster marker missing `tracksViewChanges` lifecycle** — hardcoded to `false` from t=0. Inconsistent with the LandmarkMarker pattern (track-then-settle).
- ~~**Curated-fallback distance pill is jarring**~~ — shipped in #217. `annotateDistance` leaves `distanceMiles` undefined for curated entries beyond 50mi from the user; the card already gates the pill on `!= null`. Mobile-area users keep the useful read.
- ~~**Rapid chip tapping causes flicker**~~ — closed by #216 (chips-as-jump-links). Chips no longer trigger per-tap fetches or `LayoutAnimation`; rapid taps just animate the vertical scroller to the latest target.
- **"Coming soon" Alert mid-report flow** — `app/report.tsx` (photo capture) and `app/home.tsx` (Schedule). Breaks the rhythm. v2: inline disabled-state copy instead of modal Alert.

## Architecture / data v2

- **User auth + report sync** — currently device-local AsyncStorage. v2 needs Supabase / Firebase / similar so community reports persist across phones. Unlocks real `submittedBy` IDs (the hold-to-delete and Round-4 weighted-recency work would benefit).
- **Real photo capture in /report** — `app/report.tsx` photo button currently `Alert.alert` stub. Needs `expo-camera` or `expo-image-picker`.
- ~~**Schedule CTA → expo-notifications**~~ — shipped: `scheduleDepartureNotification` fires a real local notification (inline permission request) at the suggested departure.
- **Curated catalog as catastrophic fallback feels invisible** — only fires when external + community both empty. With Google Places returning worldwide results, curated rarely runs. Consider letting curated participate when it's category-appropriate AND user is near the curated entry's region.
- **Demo-mode toggle / offline seed** — a `/menu` switch that swaps the external adapter for a richer curated catalog (more cities, more cards, real photos) would let you demo without internet anxiety.
- **Bespoke SVG glyphs for v2 sub-tags** — currently Phosphor fallbacks (HandHeart / Heart / Toilet / MoonStars). Swap when Figma exports land. Track alongside the Round-4 custom community-signal icon.
- **Yelp / EatOkra adapter** — Yelp went paid; EatOkra has no public API. Deferred until either landscape changes.

## Workflow note

The `v1.0-thesis` tag marks the submitted state. Any of these items can land in iteration commits past that tag without affecting the submitted snapshot — `git checkout v1.0-thesis` always returns reviewers to exactly what was submitted.
