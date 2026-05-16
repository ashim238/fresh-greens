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

## New features

- **En-route search** — currently the search bar is /home-only; /en-route has no search affordance. Add a way to change destination mid-trip without backing out to /home.
- **Trip summary screen** — Figma `825:4908` exists ("Pop-up Modal (Trip Summary)"). Out-of-scope at thesis but on the next-feature list.
- **Code the results page** — search results screen with map+sheet layout (Figma `1133:11400`). Currently /search returns a flat results list; the design is map-with-pins + sheet of result cards.

## Copy

- **Update "thanks for recording" copy** — final post-dismiss screen / toast after /pulled-over closes. Current copy is placeholder; needs a final pass with the rest of the safety-flow register.

## Workflow note

The `v1.0-thesis` tag marks the submitted state. Any of these items can land in iteration commits past that tag without affecting the submitted snapshot — `git checkout v1.0-thesis` always returns reviewers to exactly what was submitted.
