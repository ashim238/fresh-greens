# Dismissal Standardization — Design Spec

**Date:** 2026-06-20
**Status:** Approved (brainstorm complete; awaiting plan)
**Sprint:** Design Health Program — Phase 2 Sprint 3, PR 2 of 3 (sequence 8 → 9 → 6)
**Synthesis source:** [`phase-1-findings/2026-06-19-cross-screen-synthesis.md`](phase-1-findings/2026-06-19-cross-screen-synthesis.md) Section 4, "Dismissal Consistency"

---

## Goal

Make every dismissable surface (bottom-sheet, overlay card, modal) closeable the same predictable way, so a user under stress never hunts for how to close something. The Phase 1 critique flagged dismissal as inconsistent. The audit shows it's *mostly* already consistent — one surface genuinely violates the pattern, and the convention itself is undocumented. This PR fixes the one violation and codifies the convention.

## The audit: dismissal affordance matrix

The surfaces are all custom overlays (no React Native `<Modal>` dismissal chrome is relied on for the affordance). The matrix below covers every genuine sheet/card/modal; route screens (which use the shared `SettingsHeader` back-chevron — navigation, not dismissal) and `SearchBar` (text-clear X, not a surface dismissal) are out of scope by category.

| Surface | Type | DragHandle | Close glyph | Position | Tap target | Scrim dismiss |
|---|---|---|---|---|---|---|
| `CalendarPickSheet` | content sheet | yes | X 20pt | top-right | `tapTarget44` + hitSlop 8 | yes |
| `FuelStopsSheet` | content sheet | yes | X 24pt | top-right | `tapTarget44` | yes |
| `ReportDetailCard` | map-overlay card | yes | X 24pt | top-right | 48pt `FloatingActionButton` | yes |
| `RouteHazardDetailCard` | map-overlay card | yes | X 24pt | top-right | 48pt `FloatingActionButton` | yes |
| `ZoneDetailCard` | map-overlay card | yes | X 24pt | top-right | 48pt `FloatingActionButton` | yes |
| **`RouteComparisonSheet`** | content sheet | no | X 24pt | top-right | **`hitSlop={12}` on a bare 24pt glyph** | yes |
| `HomeBrowseSheet` | content sheet | no | none (swipe/scroll) | — | — | — |
| `LiveSafetySheet` | full modal | yes | none (scrim) | — | — | yes |
| `LifelineModal` | full modal | yes | none (scrim + handle) | — | — | yes |
| `trip-summary` | full modal | yes | none (nav-back) | — | — | no |

### What the matrix shows

- **Glyph + position are already uniform:** every explicit close is an **X, top-right, with scrim-tap dismissal.** No divergence there.
- **Two compliant tap-target implementations coexist by surface-context, both ≥44pt:**
  - **Content sheets** (Calendar, FuelStops) → bare `tapTarget44`.
  - **Map-overlay cards** (Report, Hazard, Zone) → a 48pt `FloatingActionButton`, matching the map's floating-button register.
  These are intentionally different (a FAB-style close on a content picker would read as a map control); both clear the 44pt painted floor, so both are sanctioned.
- **The one real violation — `RouteComparisonSheet`:** its close-X is `hitSlop={12}` on a bare 24pt glyph (`components/RouteComparisonSheet.tsx:64`). Painted target ≈ 24pt — below the 44pt floor, reached only via `hitSlop`. This is exactly the anti-pattern the tap-target rule (and PR 4) forbids: *"don't paper over a sub-44pt visual with hitSlop."* The other two content sheets already use `tapTarget44`; this one is the outlier.
- **Four surfaces intentionally have no explicit close** (`HomeBrowseSheet`, `LiveSafetySheet`, `LifelineModal`, `trip-summary`): dismissal is swipe/scroll, scrim, or nav-back. These are deliberate minimalist/architectural choices — adding close chrome would fight the design. Sanctioned, not violations.

**Result:** "MEDIUM dismissal standardization" → **1 real fix + codify the de-facto convention.** (Sixth consecutive PR where the synthesis estimate collapses on inspection.)

---

## Design

**2 atomic commits, 2 files.**

### Commit 1 — fix `RouteComparisonSheet` close-X tap target

`components/RouteComparisonSheet.tsx:64` currently:

```tsx
<Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
  <X size={24} color={colors.labelSecondary} weight="regular" />
</Pressable>
```

Conform it to the content-sheet pattern (`CalendarPickSheet`/`FuelStopsSheet`): wrap the glyph in `tapTarget44` (44pt painted) + the standard `pressedDim`, and drop the `hitSlop={12}` crutch:

```tsx
<Pressable
  onPress={onClose}
  accessibilityRole="button"
  accessibilityLabel="Close"
  style={({ pressed }) => [tapTarget44, pressed && pressedDim]}
>
  <X size={24} color={colors.labelSecondary} weight="regular" />
</Pressable>
```

Add the import if absent: `import { pressedDim, tapTarget44 } from '../theme/interaction';` (the file does not currently import them — `CalendarPickSheet` is the reference for the exact import path). This is the only behavioral change in the PR: the close target grows from ~24pt painted to 44pt painted. No layout shift elsewhere (the X sits in the same top-right slot; only its tappable/painted box grows, centered on the glyph).

### Commit 2 — `.cursorrules`: add the Dismissal convention

Add a new section (near `## Tap targets` / `## Reserved-color rule`, in the interaction-rules region), documenting the now-uniform pattern:

> **## Dismissal**
> Sheets and overlay cards dismiss via three affordances together: **the `DragHandle` (swipe-down), scrim-tap, and a top-right close `X`** (Phosphor `X`, `labelSecondary`) in a **≥44pt painted target** — `tapTarget44` on content sheets, or the 48pt `FloatingActionButton` on map-overlay cards (both compliant; pick the one matching the surface's register). The close `X` must clear 44pt painted per the tap-target rule — never `hitSlop` on a bare glyph.
>
> Full-screen modals **may omit** the explicit `X` when dismissal is unambiguous via nav-back or scrim-tap. Sanctioned no-X surfaces: `LiveSafetySheet`, `LifelineModal`, `trip-summary` (nav-back), `HomeBrowseSheet` (swipe/scroll). Don't add close chrome to these — their minimalism is deliberate.

No other `.cursorrules` line changes.

### Out of scope (deliberate)

- **Handler-name normalization** (`onClose` / `onDismiss` / `onRequestClose`) — internal prop names, invisible to users; renaming is pure churn with no UX benefit. Skip.
- **Forcing FAB ↔ `tapTarget44` uniformity** — both clear 44pt and fit their surface register; unifying would make a content-sheet close read as a map control. Both stay as sanctioned-compliant variants.
- **The 4 intentional no-X surfaces** — unchanged; documented as sanctioned exceptions only.

---

## Testing

- **`tsc --noEmit`** clean after each commit.
- **Manual smoke (user's responsibility):** open the route-comparison sheet (`/home` route preview → compare) and confirm the top-right X is comfortably tappable (~44pt) and still sits in the same position; the sheet still dismisses via X, scrim-tap, and `onRequestClose`. No visual change to the X glyph itself (same 24pt icon, same spot) — only the tappable/painted box around it grew.
- **Re-confirm the matrix** holds: `rg "hitSlop" components/RouteComparisonSheet.tsx` returns nothing after the fix.

---

## Files

- **Modify:** `components/RouteComparisonSheet.tsx` (close-X → `tapTarget44` + `pressedDim`, drop `hitSlop`; add import)
- **Modify:** `.cursorrules` (new `## Dismissal` section)
- **Untouched (deliberate):** all other sheets/cards/modals (already compliant or intentionally no-X); no handler renames

## Verification (definition of done)

- [ ] `RouteComparisonSheet` close `Pressable` uses `style={({ pressed }) => [tapTarget44, pressed && pressedDim]}`; `hitSlop={12}` removed; `tapTarget44`/`pressedDim` imported
- [ ] The `X` glyph is unchanged (`size={24}`, `colors.labelSecondary`, `weight="regular"`) and stays top-right
- [ ] `.cursorrules` has a new `## Dismissal` section with the convention + the 4 sanctioned no-X surfaces
- [ ] `tsc --noEmit` passes
- [ ] No other component changes; no handler-name renames
- [ ] `rg "hitSlop" components/RouteComparisonSheet.tsx` returns empty

## Sequencing

PR 2 of 3 in Sprint 3. Within it, low-blast-first:

1. **`fix(route-comparison): close-X clears 44pt painted (tapTarget44)`** — `RouteComparisonSheet.tsx`.
2. **`docs(cursorrules): codify the dismissal convention + sanctioned no-X modals`** — `.cursorrules`.
3. **verify + PR.**

Next: PR 6 (VoiceOver hint depth — the judgment-heavy one), which closes Sprint 3 and Phase 2.
