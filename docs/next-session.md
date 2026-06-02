# Next-session punch list

Post-`v1.0-thesis` iteration backlog, captured at the end of the thesis push (2026-05-13). Items roughly grouped by type. Each line is the user's note verbatim, lightly annotated with the file or pattern most likely to touch the fix.

## Connect-calendar (Plan 2) — deferred minors + verification gate (2026-06-01)

Shipped via subagent-driven development. Final-review minors, non-blocking (the one Important — /menu tile cold-load flash — was fixed in `4e19ec4`):

- ~~**Native verification PENDING a dev build**~~ — **core path verified on-device (2026-06-02).** A real calendar event surfaced in `/search` Upcoming on a physical-device dev build, confirming the full connect → permission → `getUpcomingLocatedEvents` read → resolve → render chain works. `expo-calendar` is still a native module (no Expo Go; needs a dev build). Lighter-tested sub-paths if you want to close them fully: the pick-sheet correction persisting + sign-out clearing the calendar stores — simpler code paths, very likely fine, but not specifically walked.
- **Sequential geocoding** in `useUpcomingDestinations` — distinct unresolved venues are awaited in series on focus. Fine for a realistic week of events (cache dedupes repeats); if the Upcoming list grows, batch with `Promise.all` over distinct location texts.
- **`(e.location as string)` cast** in `calendar.ts:111` — sound (guarded by the `typeof === 'string'` filter one line up), cosmetic; a filter-narrowing helper would drop it.
- **`relativeWhen` drift** in `/search` — recomputes vs `Date.now()` per render; visible label + a11y label can differ by a render at the m/h/d granularity. Negligible.
- **`showFuelTile` cold-load flash** — the calendar tile now gates on `!loading`; the fuel tile (pre-existing) still doesn't. Same one-frame flash for already-configured users. Apply the same `!loading` gate to `useFuelProfile` if it ever bothers anyone.

## Settings register refresh (Plan 1) — deferred minors (2026-06-01)

Final-review minors, non-blocking (the one Important — SettingsRow value/label wrap — was fixed in `a8e11a6`):

- **`/menu` sign-out not bottom-pinned.** Spec called for `marginTop: 'auto'` to pin the sign-out RowGroup to the bottom; implementation lets it flow after the About group. Reviewer noted flow-position is arguably better with the profile card + tile above. Decide: pin it, or update the spec note. Cosmetic.
- **`/menu` onClose uses `router.back()` vs children's `router.replace('/home')`.** Works today (menu is always entered via push from /home), but for symmetry + resilience-against-a-second-entry-point, consider aligning menu's onClose to `router.replace('/home')`.
- **RowGroup Fragment index keys.** Rows keyed by array index inside RowGroup; fine for static groups, and `/saved-places`' dynamic rows are mitigated by `SavedPlaceRow`'s own `key={place.id}`. Revisit only if RowGroup ever hosts stateful dynamic children directly.
- **RowGroup separator inset assumes icon-bearing rows.** Icon-less groups (e.g. `/zone-preferences` toggles, `/fuel` Reminder group) get a separator inset past where the label starts. Accepted per the primitive's comment; revisit if it reads off in the simulator.
- **Settings register = Plan 1 of 2.** Plan 2 (Connect-calendar feature: expo-calendar dep, 2 adapters, 2 hooks, /search Upcoming section, pick-sheet, carousel 2nd tile) is specced in `docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md` — write its plan + execute after this lands + simulator-verifies.

## Zone-overlay tap-info — post-merge follow-ups (2026-06-01)

Shipped `51549ed`. Final-review minors not blocking merge:

- **ESLint exhaustive-deps comment on ZoneDetailCard's useEffect** — `components/ZoneDetailCard.tsx:53` uses `[zone.id]` as the dep but the effect's closure reads `content`. The project doesn't have an ESLint config today, so no warning fires; if one is ever added, `react-hooks/exhaustive-deps` will flag this as a false positive. Pre-empt with a one-line `// eslint-disable-next-line react-hooks/exhaustive-deps` and a comment ("fires once per zone open, not per content-object identity"). Low priority.
- **`handleZonePress` allocated per-render inside the zones map** — `app/home.tsx:1106`. Negligible at current zone counts; if the overlay set grows, hoist to a `useCallback((zone) => …)` outside the map for referentially-stable Polygon/Polyline props. Post-merge optimization only.
- **Zone-unmount while card is open** — if the user opens a `ZoneDetailCard` and then toggles `showZones` off (or a category-flag off) in `/zone-preferences`, the card stays mounted holding a stale `Zone` object. Not a crash, but visually weird. Optional `useEffect` on `selectedZone` clearing it when its category's enabled flag flips off. Edge case.
- **Repeat-tap behavior on the same zone** — currently no-op (React bails on identical refs; the `useEffect([zone.id])` doesn't re-fire so VoiceOver doesn't re-announce). Defer until user feedback says otherwise.
- **`BottomSheetShell` extraction** — `ReportDetailCard` and `ZoneDetailCard` now share ~30 lines of scrim + sheet + drag-handle chrome. Rule-of-three threshold not yet met (two surfaces), but the next sibling sheet will tempt a third copy — at that point, extract.
- **Unit test for `zoneCategoryContent`** — pure function, trivial to test; would lock the per-category content contract. Project doesn't have a test runner configured today; consider when one lands.

## Audit follow-ups — focused session-surfaces pass (2026-05-30)

Minor findings from the focused static audit of the surfaces this session touched (the blocker + 4 importants were fixed in `99fe915`). All low-severity:

- **Quick a11y nits** — `/search` Saved-row `accessibilityLabel` uses a mid-string period ("Route to X. X.") → VoiceOver reads two sentences; use a comma. Saved rows + `/en-route` Shield FAB lack `accessibilityHint` (parity with the SOS FAB / query tiles). `/safety-settings` Emergency-SOS row label omits the "Tap to open…" action prompt its sibling rows include. `/home` daylight-strip wrapper could add `accessibilityRole="none"` (Android belt-and-suspenders).
- **`/en-route` SOS haptic** — `selectionAsync`, identical to the Report tap; consider `notificationAsync(Warning)` so the emergency trigger feels distinct.
- **`/menu` "What we flag" hierarchy** — sub-header vs toggle-label distinction rests on font-weight alone (`labelSecondary` #3C3C43 ≈ `labelTertiary` #3D3D3D). Approved for now; if it ever reads ambiguous, drop to `caption1Regular` or a genuinely lighter gray.
- **Spacing-token discipline (pervasive, pre-existing)** — raw `gap: 16/24` instead of `spacing.*` across several screens. Codebase-wide convention drift, not a session regression; worth a sweep someday.
- **`/search` tile toggle (pre-existing)** — deselecting a query tile (Food/Gas/Parking) leaves the search query set; minor interaction ambiguity, predates this work.
- **`/roadside` file split (post-`feat/roadside-assistance`)** — `app/roadside.tsx` is ~817 lines hosting `Roadside` + 4 step components + helper + const + type + one styles block. Internally cohesive today (one route, one state machine, components only used by their sibling steps), but if a Step 4 or a major addition lands, split into `app/roadside/{ProblemPicker,WrongSpotModal,ActionMenu,LiveStatus}.tsx`.
- ~~**`/roadside-setup` hydration via `useEffect`**~~ — ✅ done (`audit/safety-polish`); both `/roadside-setup` and `/fuel` swept to `useEffect` on `[loading, profile, hydrated]`.
- **`ActionMenu` local `useRouter` redundancy** — `app/roadside.tsx`'s `ActionMenu` calls `useRouter()` for its `router.push('/roadside-setup')` + `router.push('/trusted-contact-setup')`, while the parent `Roadside` also has one. Symmetric with `LiveStatus` would mean passing the two navigations as callbacks. Drop the inner `useRouter` when next touching the component.
- **`/trusted-contact-setup` routing default is inverted (footgun)** — the screen does `back()` when `from=settings|emergency` and `replace('/home')` otherwise. Every in-app caller wants `back()`; only the one-time onboarding flow wants the home-reset. A missing `from` param has now caused the "Home drops as a sheet over the modal stack" bug **twice** (emergency entry, then `/safety`+`/roadside` in `fd0417c`). Structural fix: invert the default — make `back()` the default and require an explicit `from=onboarding` (or a `replaceHome` flag) for the hard reset. Then a forgotten param degrades to the safe behavior instead of the bug. All three in-app callers currently pass `from=settings` as the workaround.
- ~~**`/unfamiliar` re-entry race**~~ — ✅ done (`audit/safety-polish`); `step` is now nullable and re-derives once `useShareSession.loading` resolves, blocking the picker from rendering during the AsyncStorage hydration window.
- ~~**`router.back()` fallback when `!canGoBack()`**~~ — ✅ done (`audit/safety-polish`); `/unfamiliar` and `/share-location` both gate `router.back()` behind `canGoBack()`, falling back to `router.replace('/home')` so a deep-link entry can never strand the user.
- ~~**`LifelineModal` empty-phone guard**~~ — ✅ done (`audit/safety-polish`); sanitized phone hoisted into `dialable`, empty case bails with a dedicated "No phone number" Alert before `canOpenURL` is consulted.
- ~~**`DESTINATIONS` error-copy fragility**~~ — ✅ done (`audit/safety-polish`); `DestinationOption` gained an explicit `nounSingular` field; the no-results Alert reads from it instead of munging `title`.

## Phase 0b — un-triaged dead-ends (found by the 2026-05-30 acceptance sweep)

Phase 0 (`ae79812`) removed the *enumerated* dead-ends (Google/Email auth, inert /menu rows, /search Trending, plus the query-tile deselect bug + honest /report copy). A codebase-wide `rg` for `coming soon|future update|not yet supported` then surfaced dead-ends the spec's triage table never listed. Each needs a **cut / hide / wire** decision before "zero visible dead-ends" is literally true:

- ~~**/en-route mic button** — "Voice control (not yet supported)"~~ — ✅ hidden in `74c2d98` (see triage decisions below); future voice-nav work tracked as its own feature track.
- ~~**/en-route Volume button** — "Voice prompt controls land in a future update"~~ — ✅ hidden in `74c2d98`; same voice-nav track as above.
- ~~**/en-route alternate-paths FAB** — "Show alternate paths (coming soon)"~~ — ✅ shipped (`457f3ef`); alternate-route comparison sheet.
- ~~**/search Fuel card** — "Coming soon" hint~~ — ✅ shipped (`d9cb709` + `1997010`); wired to /fuel.

Known Phase-1 deferrals (already triaged as WIRE, intentionally still present): **/menu Quick Tiles** (Fuel, Notifications) and the **/safety inert tiles** (Roadside, Unfamiliar area, Share my location).

**Triage decisions (2026-05-30) — status:**
- ~~**HIDE now:** /en-route voice (mic) + Volume buttons~~ — ✅ done (`74c2d98`); buttons + orphaned imports/style removed.
- **Feature track — Voice-guided navigation + en-route voice search (STILL OPEN):** spoken turn-by-turn (gates a future Volume control) + speech-to-text destination input (gates a future mic). Requires an Expo dev build, a speech library, and a mic-for-dictation permission. Own brainstorm→spec→build cycle.
- ~~**BUILD — Alternate-route comparison (/en-route alternate-paths FAB)**~~ — ✅ shipped (`457f3ef`). Comparison sheet + switch + condition chips + map duration badges; `recommended`→`activeRoute` refactor. Anchored to Figma `2:9033`. Spec + plan in `docs/superpowers/`.
- ~~**BUILD — Refuel reminders (/search Fuel card)**~~ — ✅ shipped (Plan 1 `d9cb709` core + Plan 2 `1997010` on-route stops). Time-based reminder + car profile + /fuel screen + on-route fuel stops in /en-route.

## Visual fidelity / Figma drift

- ~~**Safety page matches v2 Figma + confirmation modal popup**~~ — verified 2026-05-31. `app/safety.tsx` cites Figma `1133:13908` v2 with documented v2 deltas; 4-tile layout shipped. The "confirmation modal popup" half of this entry has no design or code basis — speculative artifact from early ideation. Closed.
- ~~**Home bottom sheet matches the v2 version**~~ — verified 2026-05-31. The original Figma reference `1133:13690` here was the *single-row v2* sheet from way back; the multi-row layout was designed collaboratively in conversation, NOT from a Figma node. The vertical-stack-of-horizontal-carousels structure is live in `components/HomeBrowseSheet.tsx` with 7 rows (Trusted + Open Now + 5 categories). Closed; the Figma node citation was always a mismatch.
- ~~**Report modals match v2 design**~~ — verified 2026-05-31. `app/report.tsx` cites v2 Figma nodes (`984:5010` picker, `987:4291` / `992:4752` / `992:4933` details, `992:3933` thank-you) and implements the picker → detail → thank-you state machine with v2 typography + padding. Backlog entry was stale.
- ~~**Custom "community signal" icon for Round 4 surfaces**~~ — verified 2026-05-31. Both `trustedbycommunity-empty.svg` (64×64pt) AND `trustedbycommunity-empty-24.svg` (24×24pt) exist as imported assets in `HomeBrowseSheet.tsx` (lines 11, 29) and render in `TrustedByCommunityEmpty` (line 672). The Star placeholder has already been replaced. Closed.
- ~~**Edge markers match Figma (not placeholders)**~~ — shipped across #134–138 (`EdgeIndicator.tsx` cites Figma `1133:13250`). Component implements the full layered composition (42×62 polygon + 36pt disk + 24pt counter-rotated glyph, per-category routing). The "32pt pill with generic glyph" description here hasn't matched reality since the redesign rounds.
- ~~**Trusted contact text → body regular, not emphasized**~~ — already there. `ContactView` styles (`pulled-over.tsx:1669-1727`) use `title1Regular`/`subheadlineRegular`/`title2Regular`. No `bodyEmphasized` left to swap.
- ~~**Guidance flow has 24px padding**~~ — already there, via composition. `guidanceStyles.page` uses `paddingHorizontal: 8` inside the modal's 16pt safe-area gutter → 24pt effective. Inline comment at `pulled-over.tsx:1546-1550` explains the math.

## Interaction polish

- ~~**Drag-and-drop icon swap**~~ — shipped in #184 (canonical `DragAndDrop` SVG from Figma `1114:10979`) + revised in #187 to a single clean teardrop pin after the canonical asset's two-pin stylization read as duplicate markers on a real map.
- ~~**Drag-and-drop pressure**~~ — closed. Drag attempted in #187 (PanResponder rewrite) then reverted: combining a drag gesture with the map's own pan recognizer made the interaction feel ambiguous. Tap-to-move is the only placement gesture now — friction-free for the common case, and the cancel/confirm row handles abort.
- ~~**Zone preferences dropdown doesn't collapse**~~ — moot as of `8ea29ac`: Zone Preferences moved to its own /zone-preferences page; the accordion no longer exists. The earlier "unanimated collapse is a deliberate workaround" trail-off is also resolved by the move (no collapse to animate).
- ~~**Map pin on-tap functionality**~~ — shipped. All variants wired: community report → `ReportDetailCard` (`home.tsx:818`), saved-home → recenter + selection haptic (`handleHomeMarkerPress`), trusted-friend → Call/Text Alert (`handleTrustedFriendMarkerPress`), cluster → fit-bounds zoom (`home.tsx:783`).
- ~~**Hold-to-delete on community-report markers**~~ — shipped. Author-only (`reportSubmittedBy === user.id`) long-press via `MapView.onLongPress` proximity hit-test → heavy haptic → destructive Alert confirm → `removeCommunityReport(id)`. `Zone` gained `reportSubmittedBy` field threaded from `CommunityReport.submittedBy`.

## A18 — Heading wedge on /home user-location dot

- **UserLocationMarker gains a heading indicator.** Translucent systemBlue wedge fanning forward from the dot in the direction the user is facing — Apple Maps "you-are-here-and-facing-this-way" convention. **Scope: /home only.** /en-route already has heading via `EnRouteCarMarker` (car rotates with `heading` prop); adding a wedge there would be redundant.
- **Specs:** 60° wedge, ~25–30pt long beyond the dot's edge, systemBlue at 35% opacity. Rotates via `transform: [{ rotate: \`${heading}deg\` }]` on a wrapper View, behind the dot in z-order. Hidden when `heading == null` or `speed < 0.5 m/s` (direction unreliable at low speeds — show nothing rather than wrong info).
- **Plumbing:** `UserLocationMarker` gains `heading?: number | null` + `speed?: number | null` props. `/home` already runs `Location.watchPositionAsync`; the position object carries both fields. One-line change at the call site to pass them through.
- **Size:** ~30 LOC standalone PR. Independent of Mapbox/lane work — could ship anytime.
- **Design reference:** visual companion mockup at `.superpowers/brainstorm/97027-1779908977/content/heading-indicator.html`. Variant `60-systemblue` was selected.

## New features

- **Connect-calendar Quick Tile (cut at v1)** — `/menu`'s Quick Tiles carousel originally had a second tile per Figma 1120:7079 — "Connect calendar / Get to events safely and on time" — that linked to a not-yet-built integration. Cut from `QUICK_TILES` in `feat/phase-1-wrapup` because the underlying feature doesn't exist; restore the tile when the calendar-connect feature actually ships.
- **En-route search** — currently the search bar is /home-only; /en-route has no search affordance. Add a way to change destination mid-trip without backing out to /home.
- **Turn card "Then" arrow uses the actual next-next maneuver** — `app/en-route.tsx:1462` currently hardcodes `ArrowBendUpRight` because we weren't using the OSRM step N+1 kind. The data is available (`rawSteps[currentStepIdx + 1]?.kind`); a one-line `maneuverIcon(nextNext?.kind, 20, colors.fadedgreen)` swap would make the footer accurately preview the next-next turn. Out of scope for the polish pass (turn-card audit was AX5-focused); ship as a small follow-up when next touching turn-step logic.
- ~~**Trip summary screen**~~ — shipped (C12: `app/trip-summary.tsx` — arrival inference-validation + "set as default" regular-destination flow).
- **Code the results page** — search results screen with map+sheet layout (Figma `1133:11400`). Currently /search returns a flat results list; the design is map-with-pins + sheet of result cards.

## Copy

- ~~**Update "thanks for recording" copy**~~ — there's no post-dismiss screen or toast to write copy for. The /pulled-over flow exits via iOS swipe-down directly back to /safety with no intermediate surface. Reframe as a feature (add a post-dismiss surface) if the safety-flow register would benefit from one — otherwise close.

## Round 4 — Discovery experiments

~~**Multi-row recommendations sheet (Google Maps-style)**~~ — **Round 4 closed (verified 2026-05-31).** Shipped via `BROWSE_ROW_SPECS` in `components/HomeBrowseSheet.tsx` (lines 407–415): 7 rows live — Row 1 "Trusted by your community" (the differentiator), Row 2 "Open now", Rows 3–7 per existing category. The chip-filter mode is preserved as the focus-mode (chip tap collapses to single-category browse). `useRecommendationsBatch()`-equivalent batch loading lives at lines 103–115. Entry was pre-ship planning framing that survived past the actual shipment.

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

- ~~**Turn-by-turn instructions are static placeholder copy**~~ — **stale, shipped (verified 2026-06-02).** Mapbox Directions is the primary routing source with real `banner_instructions` + lane guidance (`80fda0e` PR1, `d59c2e3` PR2), OSRM `steps=true` is the fallback, and `/en-route` consumes `activeRoute.steps` live — GPS-driven next-maneuver selection rendering `step.instruction` with live distance ("Turn left onto Main St, in 0.3 mi"), lane strip, monotonic step advancement, arrival handling. The "Heading toward {destination}" copy is the graceful fallback for mock/no-network routes only, not the default. Entry predated the Mapbox integration; the matching en-route.tsx docblock was stale too (fixed same commit).
- ~~**Weather card is mocked at "66° / Moderate"**~~ — shipped: real Open-Meteo via `lib/api/weather.ts` (now incl. `cloud_cover`); driving label relabeled Easy/Moderate/Tough → Good/Fair/Poor.
- ~~**/safety modal has 3 of 4 tiles inert**~~ — **stale (verified 2026-06-02).** All four tiles in `app/safety.tsx` are wired: "I was pulled over" → `/pulled-over`, "Roadside assistance" → `/roadside`, "Unfamiliar area" → `/unfamiliar`, "Share my location" → `/share-location`. The `href: null` no-op state no longer exists.
- ~~**/menu has inert rows + Quick Tiles**~~ — **stale, shipped (verified 2026-06-02).** Plan 1's settings-register refresh (`7fc4cff`) rebuilt /menu entirely. The claimed inert rows ("Settings," "Schedule a drive," "Theme") and the decorative Quick Tiles carousel are gone; /menu now renders six real wired rows (Refuel reminders, Zone Preferences, Safety, Saved places, Privacy & Terms, Sign out) plus the progressive setup carousel.
- ~~**Reports submit as `'mock-user'`**~~ — **stale (verified 2026-06-02).** `app/report.tsx:231` stamps `submittedBy: category.anonymous ? undefined : user?.id` — the real signed-in Apple user id, not a mock. What's genuinely still true (and the real v2 item): AsyncStorage is **device-local**, so reports don't sync across devices — "the community" is functionally per-phone until a backend (Supabase/Firebase) lands behind the adapter. `/report` photo capture is also real now (`expo-image-picker` camera capture), not the stub the old entry implied.

## Accessibility gaps

- **ScrollView snap doesn't respect Reduce Motion** — `snapToInterval` + `decelerationRate="fast"` not gated on `useReduceMotion()` in the home browse carousel.
- **Carousel container has no `accessibilityRole="list"`** — screen readers don't announce "list of N" on entry to the recommendations row.
- ~~**`cardTitle` doesn't truncate at AX5**~~ — **stale (verified 2026-06-02).** `HomeBrowseSheet.tsx:1039` cardTitle has `numberOfLines={2}` (+ `adjustsFontSizeToFit minimumFontScale={0.85}`). Truncation is handled.
- **Saved-home + trusted-friend markers don't get a `selected` state** — tapping them fires handlers but no visual feedback.
- **Cluster marker + placement pin missing `accessibilityRole`** — both have `accessibilityLabel` but no role.
- ~~**Dynamic Type expansion** — only ~3 `dynamicType()` invocations~~ — **stale (verified 2026-06-02).** Now **140 `dynamicType()` invocations across 27 files** — the 2026-05-31 PROJECT-B sweep + the per-surface closures landed it. Breakpoint testing at AX5 on device is the only remaining (non-code) piece.
- ~~**Daylight gradient is color-only signaling (WCAG 1.4.1 failure)**~~ — **substantially fixed (2026-06-02).** `lib/daylight.ts` exposes `DAYLIGHT_DASH_PATTERN` (solid = day, dashes = twilight, dots = night); `/home`'s route-preview polyline consumed it, and `/en-route`'s active-route polyline now does too (`9e2fe5d`, the impeccable audit fix) — so the non-color cue rides the line on both the preview and the live drive. The bottom-sheet daylight legend carries `DaylightSun` / `DaylightMoon` glyph brackets as its non-color poles. Remaining (optional): an explicit inline accessibility-label narration ("daylight for first 12 mi, twilight from mile 12…") if a fuller text channel is wanted later.

## Visual / polish nits

- ~~**Cold-start map shows Mobile, AL until GPS resolves**~~ — shipped in #217. One-shot useEffect watches `userLocation` and `animateToRegion`s on first non-null fix (1000ms, instant under Reduce Motion). Ref-guarded so subsequent GPS updates don't yank the user's pan/zoom.
- ~~**EdgeIndicator count="1" pill**~~ — already handled at `EdgeIndicator.tsx:85` via `showCount = count != null && count > 1`. Singletons fall through to the category glyph. Backlog entry was stale.
- **Cluster marker missing `tracksViewChanges` lifecycle** — hardcoded to `false` from t=0. Inconsistent with the LandmarkMarker pattern (track-then-settle).
- ~~**Curated-fallback distance pill is jarring**~~ — shipped in #217. `annotateDistance` leaves `distanceMiles` undefined for curated entries beyond 50mi from the user; the card already gates the pill on `!= null`. Mobile-area users keep the useful read.
- ~~**Rapid chip tapping causes flicker**~~ — closed by #216 (chips-as-jump-links). Chips no longer trigger per-tap fetches or `LayoutAnimation`; rapid taps just animate the vertical scroller to the latest target.
- **"Coming soon" Alert mid-report flow** — the `app/report.tsx` photo half is **stale** (real `expo-image-picker` camera capture now, no alert); verify whether `app/home.tsx` Schedule still surfaces a "coming soon" Alert (the Schedule→notification CTA shipped, so this may be fully stale). If a stray Alert remains, prefer inline disabled-state copy.

## Architecture / data v2

- **User auth + report sync** — currently device-local AsyncStorage. v2 needs Supabase / Firebase / similar so community reports persist across phones. Unlocks real `submittedBy` IDs (the hold-to-delete and Round-4 weighted-recency work would benefit).
- ~~**Real photo capture in /report**~~ — **stale, shipped (verified 2026-06-02).** `app/report.tsx` uses `expo-image-picker` — `requestCameraPermissionsAsync` + `launchCameraAsync` (camera capture only, copied out of the picker's cache), with a `photoUri` state. Real, not a stub.
- ~~**Schedule CTA → expo-notifications**~~ — shipped: `scheduleDepartureNotification` fires a real local notification (inline permission request) at the suggested departure.
- **Curated catalog as catastrophic fallback feels invisible** — only fires when external + community both empty. With Google Places returning worldwide results, curated rarely runs. Consider letting curated participate when it's category-appropriate AND user is near the curated entry's region.
- **Demo-mode toggle / offline seed** — a `/menu` switch that swaps the external adapter for a richer curated catalog (more cities, more cards, real photos) would let you demo without internet anxiety.
- **Bespoke SVG glyphs for v2 sub-tags** — currently Phosphor fallbacks (HandHeart / Heart / Toilet / MoonStars). Swap when Figma exports land. Track alongside the Round-4 custom community-signal icon.
- **Yelp / EatOkra adapter** — Yelp went paid; EatOkra has no public API. Deferred until either landscape changes.

## Workflow note

The `v1.0-thesis` tag marks the submitted state. Any of these items can land in iteration commits past that tag without affecting the submitted snapshot — `git checkout v1.0-thesis` always returns reviewers to exactly what was submitted.

## Audit 2026-05-31 — backlog flow-in

Findings from `docs/audits/2026-05-31-app-wide-fidelity-audit.md`. Critical + Important + Minor only (Notes live in the audit doc). Strike through on landing per workflow Step 11.5.

### Project-wide

- ~~**[PROJECT] Ionicons leak across 8 surfaces (Phosphor-only rule)**~~ — **stale, done (verified 2026-06-02).** Zero non-Phosphor icon imports remain anywhere (`rg` for `@expo/vector-icons` / `Ionicons` / `react-native-vector-icons` imports → empty; the only "Ionicons" hits are docblock comments saying "was previously Ionicons"). The per-surface closures (`a481cff` et al.) completed the sweep.
- ~~**[PROJECT] Missing `dynamicType()` on 8 non-/safety surfaces**~~ — **stale, done (verified 2026-06-02).** 140 `dynamicType()` invocations across 27 files; every named surface (/home, /en-route, /menu, /search, /recordings, /trip-summary, /trusted-contact-setup, /fuel) has its per-surface closure struck below.
- **[PROJECT] Honesty-of-disclosure overpromise across 7 surfaces** — [Audit 2026-05-31 §Cross-cutting PROJECT-C, Critical] per-surface copy tightening + render-gating. Anchor instances: /pulled-over F1, /trusted-contact-setup F3, /legal F1.
- **[PROJECT] Raw spacing integers / token-discipline drift across 4 surfaces** — [Audit 2026-05-31 §Cross-cutting PROJECT-D, Important] /search (25+), /safety (SOSBar, documented), /en-route (`rgba()` + `#000` literals), /menu (verify).
- **[PROJECT] Stale or missing v2-deltas docblocks (emerging)** — [Audit 2026-05-31 §Cross-cutting PROJECT-E, Important] /home `app/home.tsx:1516` cites stale Figma `1133:13690`; /en-route `app/en-route.tsx:101-118` lacks consolidated deltas block.

### /pulled-over

- ~~**[/pulled-over] TrustedContactStatus claims active notification while wiring is decorative**~~ — ✅ closed `3cf2389` (TrustedContactStatus refactored — gated on contact, pulse dropped, copy now forward-looking). Original audit context: [Audit 2026-05-31 §/pulled-over F1, Critical] gate render on `useTrustedContact().contact`; revise copy at `components/TrustedContactStatus.tsx:27` (rendered `app/pulled-over.tsx:527`).
- **[/pulled-over] Recording footnote elides "we don't auto-share" claim** — [Audit 2026-05-31 §/pulled-over F2, Important] tighten copy at `app/pulled-over.tsx:797-799`.
- **[/pulled-over] "Tap to continue" hint contradicts calming-pause intent** — [Audit 2026-05-31 §/pulled-over F3, Important] `app/pulled-over.tsx:605` → "Tap when ready" or "Tap to skip ahead."
- **[/pulled-over] `officerStyles.emphasis` reaches into another token's `fontWeight`** — [Audit 2026-05-31 §/pulled-over F4, Minor] use `<Strong>` helper at `app/pulled-over.tsx:1997`.
- **[/pulled-over] RecordingChip a11y label says "minutes" even at 0** — [Audit 2026-05-31 §/pulled-over F5, Minor] `app/pulled-over.tsx:847`.

### /en-route

- ~~**[/en-route] Bottom-sheet typography not wrapped in `dynamicType()`**~~ — ✅ closed `6189847` (9 bottom-sheet styles wrapped; endTripBtn lifted to minHeight). Original audit context: [Audit 2026-05-31 §/en-route F1, Important] wrap at `app/en-route.tsx:2143, 2147, 2162, 2173, 2223, 2231, 2227, 2079, 2269`; lift `endTripBtn.height: 52` → `minHeight`.
- **[/en-route] Raw `rgba()` and hex literal in styles** — [Audit 2026-05-31 §/en-route F2, Important] tokens at `app/en-route.tsx:1959, 2064`.
- ~~**[/en-route] Ionicons leak inside en-route surface**~~ — ✅ closed `a481cff` (All en-route + RouteComparisonSheet + FuelStopsSheet icons Phosphor). Original audit context: [Audit 2026-05-31 §/en-route F3, Important] `app/en-route.tsx:13, 1723`; `components/RouteComparisonSheet.tsx:1,54,78,91`; `components/FuelStopsSheet.tsx:1,51`.
- **[/en-route] Speed limit hardcoded to 25 mph** — [Audit 2026-05-31 §/en-route F4, Important] `app/en-route.tsx:1507` — hide when unknown OR show "—" with "Limit unknown" a11y label.
- **[/en-route] No consolidated v2-deltas docblock** — [Audit 2026-05-31 §/en-route F5, Important] add at `app/en-route.tsx:101-118`.
- **[/en-route] No empty-state when location permission denied** — [Audit 2026-05-31 §/en-route F6, Important] `app/en-route.tsx:848-927`.
- **[/en-route] Turn-card a11y wrapper doesn't surface hazards / offline state** — [Audit 2026-05-31 §/en-route F7, Important] promote `turnSign` View to `accessible` with composite label.
- **[/en-route] LiveSafetySheet collapsed pill overlaps en-route bottom sheet** — [Audit 2026-05-31 §/en-route F8, Important] anchor above measured `bottomSheetHeight`.
- **[/en-route] Route-badge marker a11y uses only duration** — [Audit 2026-05-31 §/en-route F9, Minor] `app/en-route.tsx:1271`.
- **[/en-route] Speed-limit "SF Pro Bold stand-in for Overpass Bold"** — [Audit 2026-05-31 §/en-route F10, Minor] no canonical Overpass font queued.
- **[/en-route] Dead `turnDistance`/`turnDistanceUnit` styles** — [Audit 2026-05-31 §/en-route F11, Minor] `app/en-route.tsx:1910-1917`.

### /home

- **[/home] Stale Figma citation `1133:13690`** — [Audit 2026-05-31 §/home F1, Important] update at `app/home.tsx:1516`; reconcile against `HomeBrowseSheet.tsx:44` (`1114:9047`).
- **[/home] Outdated browse-mode docblock** — [Audit 2026-05-31 §/home F2, Important] `app/home.tsx:1514-1518` describes single-card; shipped is 7-row.
- ~~**[/home] SearchBar uses Ionicons (most-seen UI in the app)**~~ — ✅ closed `a481cff` (MagnifyingGlass/Microphone/CaretLeft/XCircle in SearchBar). Original audit context: [Audit 2026-05-31 §/home F3, Critical] `components/SearchBar.tsx:1, 65, 130`. Folds into PROJECT-A; called out separately for blast-radius.
- ~~**[/home] Browse-sheet section/eyebrow/topRow titles missing Dynamic Type**~~ — ✅ closed `73e53dd` (Browse-sheet section/eyebrow/cardTitle etc. wrapped). Original audit context: [Audit 2026-05-31 §/home F4, Important] `components/HomeBrowseSheet.tsx:1244-1257, 1328-1332, 1457-1462, 1494-1504`.
- ~~**[/home] Carousel `cardTitle` uses `adjustsFontSizeToFit` (wrong primitive)**~~ — ✅ closed `73e53dd` (adjustsFontSizeToFit removed; dynamicType applied). Original audit context: [Audit 2026-05-31 §/home F5, Important] `HomeBrowseSheet.tsx:1039` — shrinks under pressure, opposite of AX5.
- ~~**[/home] `StateCard.card` fixed `width: 326`**~~ — ✅ closed `a916e6a` (StateCard.card width: 326 → maxWidth). Original audit context: [Audit 2026-05-31 §/home F6, Important] `components/StateCard.tsx:128`.
- **[/home] "Safest route" caption renders before zones load or with empty zones** — [Audit 2026-05-31 §/home F7, Important] gate at `app/home.tsx:1831` on `enabledZones.length > 0 && !isCalculatingRoute`.
- **[/home] Cold-start race: `bottomSheetHeight` vs `fabAnchorHeight` lock** — [Audit 2026-05-31 §/home F8, Important] `app/home.tsx:1541-1551`; closed-form anchor proposed.
- **[/home] `routeArrival` "arrive {time}" lowercase** — [Audit 2026-05-31 §/home F9, Minor] `app/home.tsx:1754`.
- **[/home] Route-preview labels use spread `typography.*` without `dynamicType`** — [Audit 2026-05-31 §/home F10, Important] `placementHint`, `routeViaLabel`, `routeConditionsCaption`, `routeDistance`, `routeArrival`, `routeMinutes`, `destTitle`.
- **[/home] `WeatherDrivingCard` uses `CloudSun` regardless of conditions** — [Audit 2026-05-31 §/home F11, Important] `HomeBrowseSheet.tsx:822`.
- **[/home] `weatherCard` icon/text hierarchy inconsistent** — [Audit 2026-05-31 §/home F12, Minor] icon `labelSecondary` vs text `labelTertiary`.
- **[/home] `UserLocationMarker` pulse animation runs forever** — [Audit 2026-05-31 §/home F14, Minor] lines 78-85. Defensible-by-comment.
- **[/home] `daylightStripInline` `accessibilityElementsHidden`** — [Audit 2026-05-31 §/home F15, Minor] defensible-by-comment.
- **[/home] Identical haptic for home + trusted-friend markers** — [Audit 2026-05-31 §/home F17, Minor] consider `impactAsync(Light)` for trusted-friend.

### /search

- **[/search] Results-phase search-bar mismatches Figma `1105:6462` left-icon variant** — [Audit 2026-05-31 §/search F1, Important] intentional but not disclosed in docblock.
- **[/search] "More results for X" affordance from Figma results node absent** — [Audit 2026-05-31 §/search F2, Important] Mapbox Search Box pages; surface it.
- **[/search] 25+ raw integer spacings** — [Audit 2026-05-31 §/search F3, Important] `app/search.tsx:826-1021`, `SearchBar.tsx:147-198`, `StateCard.tsx:126-195`.
- ~~**[/search] SearchBar uses Ionicons**~~ — ✅ closed `a481cff` (Same SearchBar fix as /home F3). Original audit context: [Audit 2026-05-31 §/search F4, Important] `SearchBar.tsx:1, 65, 130`. Folds into PROJECT-A.
- ~~**[/search] Zero `dynamicType()` calls across the three files**~~ — ✅ closed `a916e6a` (search.tsx + SearchBar + StateCard swept). Original audit context: [Audit 2026-05-31 §/search F5, Important] folds into PROJECT-B.
- **[/search] Quick Tools horizontal ScrollView lacks `tablist` semantics** — [Audit 2026-05-31 §/search F6, Minor] `app/search.tsx:520-569`.
- **[/search] `userLocation` failure silently downgrades ErrorState to transient** — [Audit 2026-05-31 §/search F7, Minor] permission denied is hard wall.
- ~~**[/search] Saved-row a11y label period-as-separator**~~ — **stale, fixed `57055bf` (2026-06-02).** Label now uses a comma (`Route to ${name}, ${subtitle}`) so VoiceOver reads one phrase; an `accessibilityHint` was added too.

### /roadside

- **[/roadside] `WrongSpotModal` input bypasses `dynamicType()`** — [Audit 2026-05-31 §/roadside F1, Minor] lines 716-724.
- **[/roadside] Missing empty-string defensive bail on sanitized phone** — [Audit 2026-05-31 §/roadside F2, Minor] line 302 — references `audit/safety-polish` class-of-bug.

### /menu

- ~~**[/menu] Ionicons chevrons violate Phosphor-only**~~ — ✅ closed `a481cff` (Menu chevron-back + SettingsRow chevron-forward → CaretLeft/CaretRight). Original audit context: [Audit 2026-05-31 §/menu F1, Important] `app/menu.tsx:1, 202, 520-524`. Folds into PROJECT-A.
- ~~**[/menu] No Dynamic Type on any text node**~~ — ✅ closed `36d03db` (Menu profileGreeting/profileName/rowLabel/zoneInnerLabel/zoneGroupCaption/tile/signOutText wrapped). Original audit context: [Audit 2026-05-31 §/menu F2, Important] lines 587-733. Folds into PROJECT-B.
- **[/menu] Sign-out `Promise.all` masks per-adapter errors** — [Audit 2026-05-31 §/menu F3, Minor] lines 172-179 — use `Promise.allSettled` + console.warn.
- **[/menu] Avatar image has no `onError` / fallback** — [Audit 2026-05-31 §/menu F4, Minor] lines 218-224.

### /recordings

- ~~**[/recordings] Back chevron Ionicons (re-graded from Minor)**~~ — ✅ closed `a481cff` (Recordings chevron-back → CaretLeft). Original audit context: [Audit 2026-05-31 §/recordings F1, Important] lines 1, 174. PROJECT-A retires the "de-facto convention" defense.
- ~~**[/recordings] No Dynamic Type / `relaxedLineHeight`**~~ — ✅ closed `2a8cd20` (Recordings pageTitle/cardTimestamp/cardSecondary/confirmTitle/confirmBody wrapped). Original audit context: [Audit 2026-05-31 §/recordings F2, Minor] lines 454, 499, 507, 587, 594. Folds into PROJECT-B.

### /unfamiliar

- **[/unfamiliar] "Saves your journey periodically" overstates v1 behavior** — [Audit 2026-05-31 §/unfamiliar F1, Important] `app/unfamiliar.tsx:274-276` — adapter persists exactly once. Fix: "Fresh Greens stays with you until you tell us you're safe."
- **[/unfamiliar] Auto-share-on-Step-1-pick has no inline disclosure** — [Audit 2026-05-31 §/unfamiliar F2, Minor] lines 99-102.
- **[/unfamiliar] No-results / Search-failed Alerts collapse state silently** — [Audit 2026-05-31 §/unfamiliar F3, Minor] lines 120-126, 135-141.

### /trip-summary

- ~~**[/trip-summary] Title + stats + inference copy not wrapped in `dynamicType()`**~~ — ✅ closed `d4e5141` (trip-summary title/destination/statValue/statLabel/inferenceHeading/Sub/Label/Result wrapped). Original audit context: [Audit 2026-05-31 §/trip-summary F1, Important] lines 349, 353, 363, 368, 378, 382, 396, 422. Folds into PROJECT-B.
- **[/trip-summary] "Set as default" silently no-ops when `destLat`/`destLng` absent** — [Audit 2026-05-31 §/trip-summary F2, Important] lines 159-178. Folds into PROJECT-C.
- **[/trip-summary] Title/inferenceHeading register inconsistency** — [Audit 2026-05-31 §/trip-summary F3, Minor] `title1Regular` vs `title3Emphasized` at line 378.
- **[/trip-summary] No haptic on Confirm/Dismiss or Set-as-default success** — [Audit 2026-05-31 §/trip-summary F4, Minor] lines 159-202.

### /trusted-contact-setup

- ~~**[/trusted-contact-setup] Ionicons `chevron-back`**~~ — ✅ closed `a481cff` (trusted-contact-setup chevron-back → CaretLeft). Original audit context: [Audit 2026-05-31 §/trusted-contact-setup F1, Important] lines 1, 173. Folds into PROJECT-A.
- ~~**[/trusted-contact-setup] No `dynamicType()` / `relaxedLineHeight` despite canonical-AX5-reference status**~~ — ✅ closed `3eaa95b` (title/body/previewName/previewPhone wrapped — canonical AX5 ref now follows its own rule). Original audit context: [Audit 2026-05-31 §/trusted-contact-setup F2, Important] lines 337-352. Direct contradiction of learnings.
- ~~**[/trusted-contact-setup] "Alerts this person during emergencies" overpromises v1 (re-graded from Important)**~~ — ✅ closed `25a2654` (Body copy rewritten: "every call and text is yours to send"). Original audit context: [Audit 2026-05-31 §/trusted-contact-setup F3, Critical] `app/trusted-contact-setup.tsx:186-189`. Anchor finding for PROJECT-C.
- **[/trusted-contact-setup] Error text has no live-region announcement and no haptic** — [Audit 2026-05-31 §/trusted-contact-setup F4, Minor] lines 249, 121-126.

### /legal

- ~~**[/legal] Ionicons used on the page asserting Phosphor MIT in terms.md**~~ — ✅ closed `a481cff` (/legal chevron-back → CaretLeft). Original audit context: [Audit 2026-05-31 §/legal F1, Critical] `app/legal.tsx:1, 74`. The internal contradiction is the thesis hit.
- **[/legal] JSX drops Mapbox URL + "(the map provider)" parenthetical** — [Audit 2026-05-31 §/legal F2, Important] line 125.
- **[/legal] JSX omits four Privacy sections** — [Audit 2026-05-31 §/legal F3, Important] missing "What we do *not* collect", "Children" (COPPA), "Contact", "Sign out cleanup."
- **[/legal] JSX omits Terms sections (incl. Phosphor MIT line that conflicts with F1)** — [Audit 2026-05-31 §/legal F4, Important] missing "What Fresh Greens is", "Your account and data", "Intellectual property", "Governing law", "Contact"; limitation-of-liability text shorter than markdown.
- **[/legal] Limitations tab missing "We are not selling your data" + effective date** — [Audit 2026-05-31 §/legal F5, Important] lines 244, 302.
- **[/legal] Tab row missing `accessibilityRole="tablist"`** — [Audit 2026-05-31 §/legal F6, Important] lines 81-103.
- **[/legal] `•` literal bullet glyph not flagged decorative-hidden** — [Audit 2026-05-31 §/legal F7, Minor] lines 351-353.
- **[/legal] No scroll-to-top reset / no `onScroll` activeSection sync** — [Audit 2026-05-31 §/legal F8, Minor] lines 53-57 — pill desyncs.

### /safety

- **[/safety] Raw spacing literals in SOSBar (documented tech debt)** — [Audit 2026-05-31 §/safety F1, Minor] lines 322-347.
- **[/safety] `header.gap: 16` / `titleBlock.gap: 8` raw literals** — [Audit 2026-05-31 §/safety F2, Minor] lines 255, 266.
- **[/safety] SOS Pressable lacks `accessibilityHint`** — [Audit 2026-05-31 §/safety F3, Minor] lines 204-217.

### /share-location

- **[/share-location] `aspirationalNote` style identifier semantic mismatch** — [Audit 2026-05-31 §/share-location F2, Minor] lines 164, 202-207 — rename `reasonNote`.
- **[/share-location] End-sharing CTA asymmetry — verify dignity rationale inline** — [Audit 2026-05-31 §/share-location F3, Minor] add WHY comment.

### /fuel

- ~~**[/fuel] Ionicons usage drifts from Phosphor**~~ — ✅ closed `a481cff` (/fuel chevron-back + Plus/Minus steppers). Original audit context: [Audit 2026-05-31 §/fuel F1, Important] lines 1, 116, 168, 179. Folds into PROJECT-A.
- ~~**[/fuel] No Dynamic Type / line-height policy**~~ — ✅ closed `062546f` (/fuel title/fieldLabel/input/segmentText/stepValue/toggleLabel/statusText/CTAlabels wrapped). Original audit context: [Audit 2026-05-31 §/fuel F2, Important] lines 236-307. Folds into PROJECT-B.
- **[/fuel] Segmented fuel-type buttons lack composite label; toggle row lacks role** — [Audit 2026-05-31 §/fuel F3, Important] lines 148-150, 183-192.
- **[/fuel] "Next reminder" hides time-of-day reality of TIME_INTERVAL** — [Audit 2026-05-31 §/fuel F4, Minor] lines 92-99, 196 — add WHY comment or surface time.
- **[/fuel] No haptic on Save / "I filled up"** — [Audit 2026-05-31 §/fuel F5, Minor].
