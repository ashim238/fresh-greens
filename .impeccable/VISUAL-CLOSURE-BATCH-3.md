# Visual closure — Batch 3: Settings flows (2026-06-25)

Branch: `chore/visual-closure-settings`

## Scope

**Routes:** `/menu`, `/safety-settings`, `/zone-preferences`, `/trusted-contact-setup`, `/roadside-setup`, `/insurance-setup`, `/saved-places`, `/recordings`, `/sign-out`, `/legal`

**Components:** `settings/SettingsRow`, `settings/RowGroup`, `settings/SettingsHeader`, `ReportDetailCard`, `PreferredStar`, `CalendarPickSheet`

## Three-pass summary

### Audit scorecards

| Route | A11y | Perf | Theme | Responsive | Anti-slop | Total | P0 | P1 open (after fixes) |
| ----- | ---- | ---- | ----- | ---------- | --------- | ----- | -- | --------------------- |
| `/menu` | 3 | 4 | 4 | 3 | 4 | 18/20 | 0 | 0 |
| `/safety-settings` | 4 | 4 | 4 | 3 | 4 | 19/20 | 0 | 0 |
| `/zone-preferences` | 3 | 4 | 4 | 3 | 4 | 18/20 | 0 | 0 |
| `/trusted-contact-setup` | 3 | 4 | 4 | 3 | 4 | 18/20 | 0 | 0 |
| `/roadside-setup` | 3 | 4 | 4 | 3 | 4 | 18/20 | 0 | 0 |
| `/insurance-setup` | 4 | 4 | 4 | 3 | 4 | 19/20 | 0 | 0 |
| `/saved-places` | 4 | 4 | 4 | 3 | 4 | 19/20 | 0 | 0 |
| `/recordings` | 4 | 3 | 4 | 3 | 4 | 18/20 | 0 | 0 |
| `/sign-out` | 4 | 4 | 4 | 4 | 4 | 20/20 | 0 | 0 |
| `/legal` | 4 | 4 | 4 | 4 | 4 | 20/20 | 0 | 0 |

**Components**

| Component | Total | P0 | P1 open (after fixes) |
| --------- | ----- | -- | --------------------- |
| `SettingsRow` | 19/20 | 0 | 0 |
| `RowGroup` | 19/20 | 0 | 0 |
| `SettingsHeader` | 18/20 | 0 | 0 |
| `ReportDetailCard` | 19/20 | 0 | 0 |
| `PreferredStar` | 18/20 | 0 | 0 |
| `CalendarPickSheet` | 18/20 | 0 | 0 |

**Batch gate:** Zero open P0/P1 after fix-forward.

### Critique snapshots

| Route | File | Score | Notes |
| ----- | ---- | ----- | ----- |
| `/menu` | `.impeccable/critique/2026-06-24T01-57-52Z__app-menu-tsx.md` | 32/40 | Sign-out P1 **stale** — `confirmSignOut` Alert shipped |
| `/insurance-setup` | `.impeccable/critique/2026-06-25T02-19-54Z__app-insurance-setup-tsx.md` | 31/40 | Save-hint P1 **stale** — `saveAccessibilityHint()` present |
| `/safety-settings` | `.impeccable/critique/2026-06-25T20-15-00Z__app-safety-settings-tsx.md` | 33/40 | Settings register solid; insurance value prose · acceptable |
| `/zone-preferences` | `.impeccable/critique/2026-06-25T20-15-00Z__app-zone-preferences-tsx.md` | 32/40 | allFlagsOff footer verified |
| `/trusted-contact-setup` | `.impeccable/critique/2026-06-25T20-15-00Z__app-trusted-contact-setup-tsx.md` | 31/40 | Inline pick error; embedded back register |
| `/roadside-setup` | `.impeccable/critique/2026-06-25T20-15-00Z__app-roadside-setup-tsx.md` | 30/40 | Save-hint P1 fixed this batch |
| `/saved-places` | `.impeccable/critique/2026-06-25T20-15-00Z__app-saved-places-tsx.md` | 32/40 | Destructive confirm + tapTarget44 trash |
| `/recordings` | `.impeccable/critique/2026-06-25T20-15-00Z__app-recordings-tsx.md` | 33/40 | joinMetaParts timestamp row verified |
| `/sign-out` | `.impeccable/critique/2026-06-25T20-15-00Z__app-sign-out-tsx.md` | 34/40 | "Drive safe." register correct |
| `/legal` | `.impeccable/critique/2026-06-25T20-15-00Z__app-legal-tsx.md` | 32/40 | Tab pills 44pt floor verified |

### Visual-pass round (13 categories)

| Screen / component | Issue | Sev | Fixed? | Notes |
| ------------------ | ----- | --- | ------ | ----- |
| `recordings` timestamp row | MetaSeparator | N/A | — | Already `joinMetaParts` |
| `ReportDetailCard` subline | MetaSeparator | N/A | — | Render uses `joinMetaParts`; share string · is prose |
| `safety-settings` insurance value | Inline `·` in value string | P2 | No | Settings summary prose, not meta row |
| `SettingsHeader` close/back | hitSlop on 44pt painted | P1 | Yes | Removed redundant hitSlop |
| `PreferredStar` | hitSlop compliance | P1 | Yes | `tapTarget44` painted surface |
| `CalendarPickSheet` close | hitSlop on 44pt painted | P1 | Yes | Removed hitSlop |
| `trusted-contact-setup` back | hitSlop on 44pt painted | P1 | Yes | Removed hitSlop |
| `saved-places` rowMeta | `gap: 2` literal | P2 | No | Off-ramp spacing between label/meta |
| `menu` carousel solo tile | Underfilled 280pt width | P2 | No | Documented iOS progressive pattern |
| `menu` calendar tile | No connect progress | P2 | No | Tile disappears on next focus when connected |
| `insurance-setup` loading | Header hidden during hydrate | P2 | No | Brief trap; header-over-spinner deferred |
| `legal` tab row | Optical pill padding | N/A | — | minHeight 44 correct |

**Counts:** 10 routes + 6 components reviewed · 5 P1 fixed · 4 P2 logged

## Fixes shipped (this PR)

1. **PreferredStar** — 44pt painted `tapTarget44` replaces `hitSlop` on 24pt star glyph.
2. **SettingsHeader** — remove redundant `hitSlop` on back/close (already `tapTarget44`).
3. **CalendarPickSheet** — remove redundant `hitSlop` on close X.
4. **trusted-contact-setup** — remove redundant `hitSlop` on embedded back chevron.
5. **roadside-setup** — conditional `accessibilityHint` when Save disabled (name/phone validation).
6. **zone-preferences** — `LoadingState` while preferences hydrate (no blank scroll body).

## P2/P3 deferred (batch 3)

| Item | Surface | Rationale |
| ---- | ------- | --------- |
| Calendar tile connect feedback | `/menu` | Success = tile removal on refocus; loading state deferred |
| Insurance value `carrier · policy` middot | `/safety-settings` | Settings value prose; not rendered meta cluster |
| Insurance loading removes header chrome | `/insurance-setup` | Brief AsyncStorage read; skeleton pattern deferred |
| Saved-places `gap: 2` | `/saved-places` | Tuned off-ramp; not meta separator |
| Menu row current-values (Fuel, Zone, Safety) | `/menu` | Polish; saved-places count already surfaces |
| Solo carousel tile width | `/menu` | Intentional progressive-carousel register |

## Verification

- `npx tsc --noEmit` — **pass** (2026-06-25)

## Critique vs visual pass

| Layer | What it inspects | What it misses |
| ----- | ---------------- | -------------- |
| Impeccable critique | Voice, hierarchy, IA, cognitive load | Optical separator geometry |
| Technical audit | dynamicType, tokens, tap targets, reserved colors | hitSlop-as-compliance on 44pt painted controls |
| Visual pass | Meta separators, label/value rows, tap-target paint | Voice/copy/IA (critique) |
