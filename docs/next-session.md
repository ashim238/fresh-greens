# Next-session punch list

Post-`v1.0-thesis` iteration backlog, captured at the end of the thesis push (2026-05-13). Items roughly grouped by type. Each line is the user's note verbatim, lightly annotated with the file or pattern most likely to touch the fix.

## Visual fidelity / Figma drift

- **Safety page matches v2 Figma + confirmation modal popup** — `app/safety.tsx` against current Figma node; confirmation modal pattern likely lives on a new tap path off one of the four tiles.
- **Home bottom sheet matches the v2 version** — `components/HomeBrowseSheet.tsx`, Figma `1133:13690`. Current shipped form is structural; v2 has photo, quote callout, tag rows in a card-shaped layout that the placeholder doesn't fully implement.
- **Report modals match v2 design** — `app/report.tsx`. Currently still v1 design per `docs/architecture.md`.
- ~~**Edge markers match Figma (not placeholders)**~~ — shipped across #134–138 (`EdgeIndicator.tsx` cites Figma `1133:13250`). Component implements the full layered composition (42×62 polygon + 36pt disk + 24pt counter-rotated glyph, per-category routing). The "32pt pill with generic glyph" description here hasn't matched reality since the redesign rounds.
- ~~**Trusted contact text → body regular, not emphasized**~~ — already there. `ContactView` styles (`pulled-over.tsx:1669-1727`) use `title1Regular`/`subheadlineRegular`/`title2Regular`. No `bodyEmphasized` left to swap.
- ~~**Guidance flow has 24px padding**~~ — already there, via composition. `guidanceStyles.page` uses `paddingHorizontal: 8` inside the modal's 16pt safe-area gutter → 24pt effective. Inline comment at `pulled-over.tsx:1546-1550` explains the math.

## Interaction polish

- ~~**Drag-and-drop icon swap**~~ — shipped in #184 (canonical `DragAndDrop` SVG from Figma `1114:10979`) + revised in #187 to a single clean teardrop pin after the canonical asset's two-pin stylization read as duplicate markers on a real map.
- ~~**Drag-and-drop pressure**~~ — closed. Drag attempted in #187 (PanResponder rewrite) then reverted: combining a drag gesture with the map's own pan recognizer made the interaction feel ambiguous. Tap-to-move is the only placement gesture now — friction-free for the common case, and the cancel/confirm row handles abort.
- ~~**Zone preferences dropdown doesn't collapse**~~ — re-verified, tapping the row *does* collapse it (`menu.tsx:370` flips state). The original complaint was about the missing close animation: `LayoutAnimation.configureNext` is intentionally fired only on the expand direction because firing it on collapse can prevent the state update from registering (see comment at `menu.tsx:364-366`). Functional behavior is correct; the unanimated collapse is a deliberate workaround. Revisit only if it bothers anyone in practice.
- ~~**Map pin on-tap functionality**~~ — shipped. All variants wired: community report → `ReportDetailCard` (`home.tsx:818`), saved-home → recenter + selection haptic (`handleHomeMarkerPress`), trusted-friend → Call/Text Alert (`handleTrustedFriendMarkerPress`), cluster → fit-bounds zoom (`home.tsx:783`).
- ~~**Hold-to-delete on community-report markers**~~ — shipped. Author-only (`reportSubmittedBy === user.id`) long-press via `MapView.onLongPress` proximity hit-test → heavy haptic → destructive Alert confirm → `removeCommunityReport(id)`. `Zone` gained `reportSubmittedBy` field threaded from `CommunityReport.submittedBy`.

## New features

- **En-route search** — currently the search bar is /home-only; /en-route has no search affordance. Add a way to change destination mid-trip without backing out to /home.
- **Trip summary screen** — Figma `825:4908` exists ("Pop-up Modal (Trip Summary)"). Out-of-scope at thesis but on the next-feature list.
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

## Round 5 — Safety + recording redesign

Three Figma nodes covering the v2 design pass for the safety / recording surfaces. Group these together; they share visual register and likely overlap on components (audio control row, trusted-contact footer, drag handle).

- [Figma `1128:5284`](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/Thesis_Draft_Final?node-id=1128-5284&m=dev)
- [Figma `1133:12323`](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/Thesis_Draft_Final?node-id=1133-12323&m=dev)
- [Figma `1133:12674`](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/Thesis_Draft_Final?node-id=1133-12674&m=dev)

Files likely touched: `app/safety.tsx` (already at v2 from `1133:13908`; revisit if these supersede), `app/pulled-over.tsx` (the recording widget + the four phases), `app/recordings.tsx` (the recordings list), `components/TrustedContactStatus.tsx`. Fetch the nodes via the Figma MCP at the start of the round to confirm what each one is before scoping the PR(s).

## Workflow note

The `v1.0-thesis` tag marks the submitted state. Any of these items can land in iteration commits past that tag without affecting the submitted snapshot — `git checkout v1.0-thesis` always returns reviewers to exactly what was submitted.
