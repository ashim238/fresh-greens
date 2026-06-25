# Visual pass — meta separators & micro-layout (2026-06-25)

Branch: `polish/visual-pass-meta-spacing`

## Critique vs visual pass

| Layer | What it inspects | What it misses |
|-------|------------------|----------------|
| **Impeccable critique** | Heuristic UX — voice, hierarchy, calm-companion register, slop tells, IA. Scores screens holistically. | Optical separator geometry, mixed-weight rhythm on the same meta line, flex `gap` asymmetry around interpuncts. |
| **Technical audit** | `dynamicType`, theme tokens, tap targets, reserved-color grep. | Inline `·` in strings — grep sees the character but not that it sits closer to one neighbor than the other. |
| **Visual pass (this work)** | Fix-forward micro-layout: `MetaSeparator`, label/value rows, flex mistakes, truncation on meta clusters. | Voice/copy/IA — that's critique's job. |

**Short answer for "I thought that was covered by critique":** Critique scores whether a screen *feels* right; it does not measure whether an interpunct is optically centered between two `Text` siblings. Technical audit catches token violations but passes string-embedded `·` because the character is present and valid. This pass complements both — it does not replace them.

## Results

| Screen / component | Issue | Fixed? | Notes |
|--------------------|-------|--------|-------|
| `app/home.tsx` | Route-preview arrival · distance meta cluster | Yes | `MetaSeparator` + `routeMetaCluster` row (prior agent). Mixed weights intentional: arrival subheadline, distance footnote. |
| `app/en-route.tsx` | Bottom-sheet distance · duration | Yes | `MetaSeparator` in `secondaryRow` (prior agent). |
| `app/en-route.tsx` | Offline pill `Offline route · 3h old` string | Yes | Split to `MetaSeparator` beats inside pill. |
| `components/RouteComparisonSheet.tsx` | Arrival · distance meta row | Yes | Prior agent. |
| `components/FuelStopsSheet.tsx` | Row meta price · distance · along route | Yes | Prior agent. Subtitle trusted-count clause left as prose (not a meta cluster). |
| `components/FuelStopsSheet.tsx` | `gap: 2`, `paddingHorizontal: 8` literals | Yes | → `spacing.xs` / `spacing.sm`. |
| `components/DaylightRouteLegend.tsx` | — | N/A | No interpunct meta; gradient key only. |
| `components/HomeBrowseSheet.tsx` | Trusted-row facet pill `Black-owned · Felt welcome` | Yes | `joinMetaParts` inside category tag. Rating/distance use separate tag pills (Figma), not one meta line. |
| `components/ReportDetailCard.tsx` | Subline category · tag · time | Yes | Refactored to `joinMetaParts`. |
| `app/trip-summary.tsx` | — | N/A | Duration/distance are stacked stat columns, not inline meta. |
| `app/roadside.tsx` | Contact · notified-time shared row | Yes | Prior agent. |
| `app/search.tsx` | Upcoming place · when, Set location · when | Yes | `joinMetaParts` in `recentMetaRow`. |
| `app/search.tsx` | Saved regular `Default · N trips` | Yes | `subtitleMeta` + `joinMetaParts`. |
| `app/search.tsx` | Gas result price · distance | Yes | `resultMetaRow` + `joinMetaParts`. |
| `components/LiveSafetySheet.tsx` | Collapsed pill session · duration | Yes | `NotifyingPulse.labelParts` + `MetaSeparator`. |
| `components/NotifyingPulse.tsx` | String label with embedded · | Yes | New `labelParts` prop. |
| `app/pulled-over.tsx` | Recording · timer chip | Yes | Prior agent. |
| `app/recordings.tsx` | Card timestamp date · time | Yes | `joinMetaParts`; a11y strings keep comma join. |
| `components/MetaSeparator.tsx` | Repeated map/join pattern | Yes | Added `joinMetaParts()` helper. |
| `components/RoadsideTowPick.tsx` | Distance · address in result row | P2 | Out of priority list; same pattern, defer to next pass. |
| `app/fuel.tsx` | Vehicle picker `Sedan · 350 mi` labels | P2 | Picker chip labels — needs Figma confirm on whether beats belong in chips. |
| `app/safety-settings.tsx` | Insurance carrier · policy string | P2 | Settings summary prose, not route meta. |
| `app/home.tsx` | Alternate-route announcement strings with · | P2 | VoiceOver/announcement copy, not rendered meta row. |

## Counts

- **Screens/components reviewed:** 18
- **Fixed:** 15
- **Logged P2 / N/A:** 6

## Verification

- `npx tsc --noEmit` — pass
