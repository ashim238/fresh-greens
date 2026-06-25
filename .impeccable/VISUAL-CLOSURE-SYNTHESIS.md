# Pre-Supabase visual closure — synthesis (2026-06-25)

Branch: `chore/visual-closure-synthesis`  
PRs merged: #266 (batch 1), #267 (batch 2), #268 (batch 3), #269 (batch 4)

## Gate verdict

| Criterion | Status |
| --------- | ------ |
| 27/27 routes — audit + critique + visual-pass | **Met** |
| Open P0 / P1 across three passes | **0 / 0** |
| P2/P3 logged with defer rationale | **Yes** (below + batch docs) |
| Snapshot trail | Batch docs + critique timestamps + prior VISUAL-PASS rounds |
| `npx tsc --noEmit` on synthesis branch | **Pass** |

**Supabase M1.1 pivot:** Ready — visual closure gate met.

## Critique vs visual pass vs audit

| Layer | What it inspects | What it misses |
| ----- | ---------------- | -------------- |
| **Impeccable critique** | Voice, hierarchy, IA, calm-companion register, cognitive load | Optical interpunct geometry; mixed-weight rhythm on one line |
| **Technical audit** | `dynamicType`, theme tokens, tap targets, reserved-color grep | String-embedded `·` optical centering; hitSlop-as-compliance on painted 44pt |
| **Visual pass** | `MetaSeparator` / `joinMetaParts`, chip/sheet micro-layout, FAB/SearchBar register | Copy tone; token violations outside layout |

## Shared component re-spot-check (batch 5)

| Component | Check | Sev | Status | Notes |
| --------- | ----- | --- | ------ | ----- |
| `MetaSeparator` | Symmetric `paddingHorizontal: spacing.xs`; `subheadlineRegular` + `labelTertiary`; `joinMetaParts` helper | — | **Pass** | Canonical primitive; hub meta rows adopt it |
| `SearchBar` | Floating default = white + `shadows.e2`; inset = `fillsTertiary` no shadow; mic hidden when no `onMicPress` | — | **Pass** | Batch 1 fixed inert-mic P1; 44pt icon wraps |
| `FloatingActionButton` | 48/56 painted circles; `shadows.e2`; hold-to-confirm consumers wire pressIn/Out | — | **Pass** | Used on `/home`, `/en-route`, map-overlay cards |
| `DragHandle` | 32×4pt bar, `radii.pill`, `colors.dragHandleBar`; consistent across sheets | — | **Pass** | Consumers wrap with `paddingVertical` where grab area needs expansion (`home` `dragHandleArea`, safety sub-flows) |

## Full route rollup (27 screens)

Presentation from `app/_layout.tsx`. P0/P1 = open after batches 1–4 fix-forward.

| # | Route | Batch | Audit | Critique snapshot | Visual-pass | P0 | P1 |
| - | ----- | ----- | ----- | ----------------- | ----------- | -- | -- |
| 1 | `/` | 4 | 17/20 | welcome re-verify | checkbox + CTA a11y fixed | 0 | 0 |
| 2 | `/get-started` | 4 | 19/20 | — | N/A onboarding stack | 0 | 0 |
| 3 | `/onboarding` | 4 | 18/20 | `2026-06-19T10-11-42Z` | PageControl decorative | 0 | 0 |
| 4 | `/login` | 4 | 19/20 | closeout | dev row P2 only | 0 | 0 |
| 5 | `/permissions` | 4 | 19/20 | closeout | N/A | 0 | 0 |
| 6 | `/home` | 1 | 17/20 | `2026-06-24T01-57-45Z` | zone chip `MetaSeparator`; route meta 06-25 | 0 | 0 |
| 7 | `/search` | 1 | 17/20 | `2026-06-25T19-30-00Z` | `joinMetaParts` rows; mic hidden | 0 | 0 |
| 8 | `/en-route` | 1 | 17/20 | `2026-06-25T19-30-00Z` | mock/cache turn-card; `secondaryRow` meta | 0 | 0 |
| 9 | `/report` | 1 | 18/20 | `2026-06-24T01-57-50Z` | severity chip padding P2 | 0 | 0 |
| 10 | `/trip-summary` | 1 | 18/20 | `2026-06-25T19-30-00Z` | stacked stats N/A | 0 | 0 |
| 11 | `/fuel` | 1 | 19/20 | `2026-06-25T19-30-00Z` | picker `·` labels P2 | 0 | 0 |
| 12 | `/safety` | 2 | 17/20 | `2026-06-25T17-31-14Z` | session banner + tile hints verified | 0 | 0 |
| 13 | `/emergency` | 2 | 18/20 | closeout | SOS disc spacing N/A | 0 | 0 |
| 14 | `/pulled-over` | 2 | 17/20 | closeout | recording chip meta N/A | 0 | 0 |
| 15 | `/share-location` | 2 | 17/20 | `2026-06-25T19-45-00Z` | inline `pickError` | 0 | 0 |
| 16 | `/unfamiliar` | 2 | 17/20 | `2026-06-25T19-45-00Z` | inline `problemError` / `endError` | 0 | 0 |
| 17 | `/roadside` | 2 | 17/20 | `2026-06-25T17-31-26Z` | share toggle decoupled; tow meta 06-26 | 0 | 0 |
| 18 | `/menu` | 3 | 18/20 | `2026-06-24T01-57-52Z` | sign-out confirm stale-fixed | 0 | 0 |
| 19 | `/safety-settings` | 3 | 19/20 | `2026-06-25T20-15-00Z` | insurance value prose P2 | 0 | 0 |
| 20 | `/zone-preferences` | 3 | 18/20 | `2026-06-25T20-15-00Z` | LoadingState hydrate | 0 | 0 |
| 21 | `/trusted-contact-setup` | 3 | 18/20 | `2026-06-25T20-15-00Z` | back hitSlop removed | 0 | 0 |
| 22 | `/roadside-setup` | 3 | 18/20 | `2026-06-25T20-15-00Z` | Save hint fixed | 0 | 0 |
| 23 | `/insurance-setup` | 3 | 19/20 | `2026-06-25T02-19-54Z` | loading header P2 | 0 | 0 |
| 24 | `/saved-places` | 3 | 19/20 | `2026-06-25T20-15-00Z` | `gap:2` P2 | 0 | 0 |
| 25 | `/recordings` | 3 | 18/20 | `2026-06-25T20-15-00Z` | `joinMetaParts` timestamp | 0 | 0 |
| 26 | `/sign-out` | 3 | 20/20 | `2026-06-25T20-15-00Z` | N/A | 0 | 0 |
| 27 | `/legal` | 3 | 20/20 | `2026-06-25T20-15-00Z` | tab pills 44pt | 0 | 0 |

**Shell:** `app/_layout.tsx` — presentation options consistent with route catalog; no UI audit required.

## Cross-batch P1 fixes (carried into synthesis verification)

| Fix | Surface | Batch | Verified |
| --- | ------- | ----- | -------- |
| Inert mic hidden | `SearchBar` / `/search`, `/home` | 1 | Yes |
| Mock/cache turn-card copy | `/en-route` | 1 | Yes |
| Route zone retry chip middot | `/home` | 1 | Yes |
| Inline errors replace Alert | `/share-location`, `/unfamiliar` | 2 | Yes |
| Share toggle decoupled from step advance | `/roadside` | 2 | Yes |
| 44pt painted stars/headers | `PreferredStar`, `SettingsHeader`, sheets | 3 | Yes |
| Welcome checkbox + disabled CTA hint | `/` | 4 | Yes |
| Tow meta `joinMetaParts` | `RoadsideTowPick` | markers PR / 06-26 | Yes |
| Marker disk `radii.pill` | `EdgeIndicator`, `ClusterMarker` | 06-26 | Yes |

## P2 / P3 deferred (explicit — not blocking Supabase)

| Item | Surface | Rationale |
| ---- | ------- | --------- |
| Long route-preview stack at AX5 | `/home` | ScrollView shipped; consolidation polish |
| FAB-stack magic-number offsets | `/home` | Named constants partial; extract helper later |
| MapCoach one-shot | `/home` | Onboarding cross-cut; feature polish |
| FuelStopsSheet subtitle middot in string | `FuelStopsSheet` | Prose subtitle; row meta uses `MetaSeparator` |
| Report severity chip padding | `/report` | Needs Figma confirm |
| Vehicle picker `Sedan · 350 mi` labels | `/fuel` | Picker register; Figma confirm |
| Insurance `carrier · policy` value string | `/safety-settings` | Settings summary prose |
| Privacy/Terms links on splash | `/` | Ornamental copy; `/legal` deep-link deferred |
| Calendar tile connect feedback | `/menu` | Success = tile removal on refocus |
| WrongSpotModal in-card Cancel | `/roadside` | Scrim dismiss; VoiceOver escape gap P2 |
| Saved-places `gap: 2` | `/saved-places` | Off-ramp tuning, not meta |
| HomeBrowseSheet card `borderRadius: 12` literals | `HomeBrowseSheet` | Figma card family confirm |
| Post-coach FAB label flash | `/en-route` | Discoverability polish |
| Report subTags overhaul | `/report` | Feature scope (🟣) |
| Saved places empty — no write path | `/saved-places` | Feature not built (🟣) |

## Prior visual-pass rounds (reference)

Historical batch/round docs: [`.impeccable/archive/`](./archive/) (indexed in [`.impeccable/README.md`](./README.md)).

- `archive/VISUAL-PASS-2026-06-25.md` — meta separator hub sweep + `joinMetaParts`
- `archive/VISUAL-PASS-2026-06-26.md` — map markers + tow-pick meta
- `archive/VISUAL-CLOSURE-BATCH-{1,2,3,4}.md` — per-PR three-pass scorecards
- `archive/ROUND-7-SYNTHESIS.md` — pre-closure hub sweep (P1s closed in batches 1–2)

## Counts

- **Routes reviewed:** 27
- **Key components spot-checked:** 4 shared + 19 batch-scoped
- **P0 open:** 0
- **P1 open:** 0
- **P2/P3 logged:** 15

## Verification

- `npx tsc --noEmit` — **pass** (2026-06-25, synthesis branch)
