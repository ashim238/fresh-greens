# Next-session punch list

Post-`v1.0-thesis` iteration backlog, captured at the end of the thesis push (2026-05-13). Items roughly grouped by type. Each line is the user's note verbatim, lightly annotated with the file or pattern most likely to touch the fix.

## Visual fidelity / Figma drift

- **Safety page matches v2 Figma + confirmation modal popup** — `app/safety.tsx` against current Figma node; confirmation modal pattern likely lives on a new tap path off one of the four tiles.
- **Home bottom sheet matches the v2 version** — `components/HomeBrowseSheet.tsx`, Figma `1133:13690`. Current shipped form is structural; v2 has photo, quote callout, tag rows in a card-shaped layout that the placeholder doesn't fully implement.
- **Report modals match v2 design** — `app/report.tsx`. Currently still v1 design per `docs/architecture.md`.
- **Edge markers match Figma (not placeholders)** — `components/EdgeIndicator.tsx`; the 32pt pill currently renders a generic glyph. Figma has a specific edge-indicator design — find the node, swap.
- **Trusted contact text → body regular, not emphasized** — `app/pulled-over.tsx` ContactPhase block; likely a one-token swap (`bodyEmphasized` → `bodyRegular`).
- **Guidance flow has 24px padding** — `app/pulled-over.tsx` guidance phase styles; current padding likely 16pt (modal-grid convention) where 24pt is wanted.

## Interaction polish

- **Drag-and-drop icon swap** — the report-placement drag pin glyph. Currently `Ionicons alert-circle`; swap to canonical SVG when exported.
- **Drag-and-drop pressure** — tap-then-drag report placement is too "sticky" to begin moving. Likely needs `Marker.draggable={true}` + a `delayLongPress` tweak, or move from native draggable to a pan-responder-tracked custom marker.
- **Zone preferences dropdown doesn't collapse** — `app/menu.tsx` Zone Settings accordion. Tapping the row should collapse it; currently it stays open or only one-way-expands. Check the `LayoutAnimation` toggle.
- **Map pin on-tap functionality** — `LandmarkMarker` `onPress`. Currently most pin types are inert. Wire each variant to its appropriate behavior (community report → `ReportDetailCard`; saved-home → recenter; trusted-friend → call/text quick-action sheet).
- **Hold-to-delete on community-report markers** — long-press an in-frame `LandmarkMarker` whose report was submitted by this device → `Alert.alert` confirm → `removeCommunityReport(id)`. Use case: accidental submission, conditions changed (broken streetlight got fixed), wrong location. Infrastructure exists: `removeCommunityReport()` in `lib/api/community-reports.ts`, the long-press pattern already shipped for save-home (`onLongPress` on `<MapView>`) and recent-search removal (`app/search.tsx:322`). Author-only: gate on `report.userId === currentUserId` so you can't delete someone else's submission. Heavy-haptic + Alert confirm for the destructive step.

## New features

- **En-route search** — currently the search bar is /home-only; /en-route has no search affordance. Add a way to change destination mid-trip without backing out to /home.
- **Trip summary screen** — Figma `825:4908` exists ("Pop-up Modal (Trip Summary)"). Out-of-scope at thesis but on the next-feature list.
- **Code the results page** — search results screen with map+sheet layout (Figma `1133:11400`). Currently /search returns a flat results list; the design is map-with-pins + sheet of result cards.

## Copy

- **Update "thanks for recording" copy** — final post-dismiss screen / toast after /pulled-over closes. Current copy is placeholder; needs a final pass with the rest of the safety-flow register.

## Round 4 — Discovery experiments

- **Multi-row recommendations sheet (Google Maps-style)** — `components/HomeBrowseSheet.tsx`. Restructure the single-carousel browse mode into a vertical stack of horizontal carousels (each row a different theme). DO NOT replicate Google verbatim; the strongest version is:
  - **Row 1: "Trusted by your community"** — top-rated mixed across all 5 categories, ranked by recency of *community* signal (the row that's uniquely Fresh Greens-shaped). This row carries the differentiator; without it, the multi-row pattern dilutes the chip-driven mission. If we build this, build Row 1 first and decide if the rest is worth it.
  - **Row 2: "Open now"** — utility, mixed categories, `isOpen === true` + distance-sorted.
  - **Rows 3–7: One row per existing category** (Black-Owned, Women-Owned, LGBTQ+, Restrooms, Late Night).
  - **Keep the chips** as a quick-filter mode that collapses the sheet to a single category (current behavior) when tapped. Default state: multi-row browse. Chip tapped: focus mode.
  - Watch: data-load cost (5+ parallel proxy calls on mount), empty-state proliferation in low-density areas, total scroll height inside the capped sheet (~360pt × 5 rows = 1800pt inside a ~720pt sheet — vertical sheet scroll already exists, but UX needs validation on device).
  - Implementation hint: a `useRecommendationsBatch()` hook that fires the per-category requests in parallel with shared cache, vs. firing N copies of `useRecommendations`.

## Round 5 — Safety + recording redesign

Three Figma nodes covering the v2 design pass for the safety / recording surfaces. Group these together; they share visual register and likely overlap on components (audio control row, trusted-contact footer, drag handle).

- [Figma `1128:5284`](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/Thesis_Draft_Final?node-id=1128-5284&m=dev)
- [Figma `1133:12323`](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/Thesis_Draft_Final?node-id=1133-12323&m=dev)
- [Figma `1133:12674`](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/Thesis_Draft_Final?node-id=1133-12674&m=dev)

Files likely touched: `app/safety.tsx` (already at v2 from `1133:13908`; revisit if these supersede), `app/pulled-over.tsx` (the recording widget + the four phases), `app/recordings.tsx` (the recordings list), `components/TrustedContactStatus.tsx`. Fetch the nodes via the Figma MCP at the start of the round to confirm what each one is before scoping the PR(s).

## Workflow note

The `v1.0-thesis` tag marks the submitted state. Any of these items can land in iteration commits past that tag without affecting the submitted snapshot — `git checkout v1.0-thesis` always returns reviewers to exactly what was submitted.
