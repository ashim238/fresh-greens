# Safety Flow Layout Design

## Goal

Make the pulled-over and sibling safety flows feel balanced, keep active recording information clear of iPhone top chrome, and present text-only decisions as neutral choices.

## Scope

- Keep the title and supporting copy leading-aligned inside text-only choice cards in `/pulled-over`, `/unfamiliar`, and `/share-location`.
- Keep icon-and-chevron action rows, including roadside options, leading-aligned.
- Center each choice stack in the usable space between its question and its footer or bottom safe inset.
- Preserve scrolling when content, viewport height, or Dynamic Type makes optical centering impossible.
- Replace fixed choice-card heights with minimum heights so scaled text can grow.
- Use a 24-point gap between choice cards and a 24-to-32-point relationship between the question and its choices.
- Standardize the pulled-over top rail so the drag handle has 16 points above and below it, status content follows the rail, and phase content retains its existing overall vertical position.
- Continue protecting both top and bottom safe-area edges.
- Replace the portfolio's pulled-over armed, guidance, and contact stills after native verification.

## Layout Contract

The standard order for the pulled-over modal is:

1. Native top safe inset.
2. Sixteen points of space.
3. Drag handle.
4. Sixteen points of space.
5. Recording, saving, or error status when present.
6. The safe container's eight-point gap.
7. An eight-point inset before the phase content.

Text-only choices keep leading-aligned copy that is vertically centered inside each card. Their stack is optically centered within the remaining space rather than forced to a fixed screen coordinate. A ScrollView remains the fallback for smaller screens and larger accessibility text.

## Media Truthfulness

The replacement stills must come from the current app and follow the real sequence from the safety toolkit into the pulled-over flow. The capture must not deep-link directly to an internal phase. The contact still must show an unobscured active-recording indicator, and no capture may show visible community reports.

## Verification

- Source-contract tests cover safe-area edges, symmetric pulled-over top-rail spacing, vertically centered choice stacks, leading-aligned card copy, and minimum card heights.
- Focused React Native tests and the TypeScript check pass.
- Native runtime review covers armed, guidance, and contact at default text size and at an accessibility text size.
- Portfolio replacements retain native resolution and render sharply in the case-study phone frame.

## Deferred

- Centering icon-and-chevron navigation rows.
- Redesigning the overall safety-flow navigation model.
- Moving recording ownership into a global recording manager.
