# Visual pass — hub screens + map markers (2026-06-26)

Branch: `polish/visual-pass-markers`

## Critique vs visual pass

| Layer | What it inspects | What it misses |
|-------|------------------|----------------|
| **Impeccable critique** | Voice, hierarchy, calm-companion register, slop tells, IA | Optical separator geometry; mixed-weight rhythm; flex `gap` asymmetry around interpuncts |
| **Technical audit** | `dynamicType`, theme tokens, tap targets, reserved-color grep | String-embedded `·` optical centering; marker disk geometry at map edges |
| **Visual pass (this work)** | Meta separators, chip/sheet micro-layout, marker circle geometry | Voice/copy/IA; token violations outside layout |

Builds on [VISUAL-PASS-2026-06-25.md](./VISUAL-PASS-2026-06-25.md) — most hub meta rows were fixed there; this round targets priority hubs plus map-marker optical bugs.

## Results

| Screen / component | Issue | Severity | Fixed? | Notes |
|--------------------|-------|----------|--------|-------|
| `app/home.tsx` | Route-preview arrival · distance meta | N/A | — | `MetaSeparator` from 06-25 pass; re-verified |
| `app/home.tsx` | Zone-warning chips icon+label row | N/A | — | `gap: spacing.sm`; orange diamond intentional |
| `app/en-route.tsx` | Bottom-sheet distance · duration | N/A | — | `MetaSeparator` in `secondaryRow` (06-25) |
| `app/en-route.tsx` | Offline pill meta | N/A | — | Split beats with `MetaSeparator` (06-25) |
| `app/search.tsx` | Recent/saved/gas meta rows | N/A | — | `joinMetaParts` throughout (06-25) |
| `app/roadside.tsx` | Contact · notified-time row | N/A | — | `MetaSeparator` (06-25) |
| `components/RoadsideTowPick.tsx` | Tow result distance · address string | P1 | Yes | `joinMetaParts` + `towMetaRow` |
| `components/HomeBrowseSheet.tsx` | Category chip row tap targets | N/A | — | 44pt painted via `paddingVertical: 13` (prior) |
| `components/HomeBrowseSheet.tsx` | Trusted-row facet `joinMetaParts` | N/A | — | 06-25 |
| `components/HomeBrowseSheet.tsx` | `weatherCard` `borderRadius: 8` literal | P2 | Yes | → `radii.sm` |
| `components/HomeBrowseSheet.tsx` | Card `borderRadius: 12` literals | P2 | Log | Deferred — Figma card family confirm |
| `components/EdgeIndicator.tsx` | 36×36 disk used `radii.lg` (16) → rounded square at viewport edge | P1 | Yes | → `radii.pill` (full circle) |
| `components/ClusterMarker.tsx` | Same `radii.lg` on 36×36 count badge | P1 | Yes | → `radii.pill` |
| `components/EdgeIndicator.tsx` | Off-screen identity pins ignored `subTag` | P1 | Yes | Identity glyph dispatch + `subTag` from `/home` |
| `mapmarker-glyph-*.svg` | Pink/black glyphs low contrast on wiltedgreen circle | P1 | Yes | White `stroke` on identity + felt-welcome SVGs |
| `components/LandmarkMarker.tsx` | On-map positive-circle glyphs | P1 | Yes | Same stroked SVG assets (shared with browse sheet) |
| `app/fuel.tsx` | Vehicle picker chip labels with `·` | P2 | Log | Picker labels — needs Figma confirm (06-25 carry) |

## Counts

- **Screens/components reviewed:** 12
- **Fixed (P1):** 6
- **Fixed (P2):** 1
- **Logged P2 / N/A:** 5

## Device verification (simulator / device)

Agent did not run simulator — verify on iOS Simulator or Expo Go:

- [ ] **Off-screen markers:** Pan map so a community-report pin leaves viewport — edge indicator disk is a **circle**, not a rounded square
- [ ] **Cluster badge:** Zoom out until reports cluster — wiltedgreen count disk is circular
- [ ] **Women-owned contrast:** Drop or locate a felt-welcome report with **Women-owned** sub-tag — pink glyph has visible white stroke on green inner circle (on-map pin + off-screen edge indicator)
- [ ] **Identity parity:** Repeat for LGBTQ+ / restroom / late-night sub-tags — edge indicator matches on-map glyph
- [ ] **Roadside tow pick:** Open `/roadside` → tow search → confirm distance · address middot is optically centered
- [ ] **Hub meta regression:** Spot-check `/home` route-preview meta, `/search` gas row meta, `/en-route` sheet secondary row — no middot drift vs 06-25

## Verification

- `npx tsc --noEmit` — pass (run on branch before merge)
