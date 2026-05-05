# Next session — pick up here

Read this first, then `docs/learnings.md`, then `git log --oneline -20`. The auto-memory at `~/.claude/projects/-Users-mylesashitey/memory/` loads automatically and primes the design rules + Figma file pointer.

## Where we left off

- **Branch:** `feat/home-report-button` (created but no code committed yet — we discussed specs, didn't build).
- **Active design work:** community reporting flow. Two new Figma frames were added to the Flow tab (canvas `825:3161`) for the report modal. Their node IDs are unknown to me — pull `get_metadata` on `825:3161` to find them, then `get_design_context` on each.

## Decisions made this session that aren't yet in code

### Report flow — categories (2×3 grid)
| Category | Score weight | Anonymous? | Photo? | Icon |
|---|---|---|---|---|
| Lighting | caution (-1) | No | Useful | `bulb-outline` (or `flash-off`) |
| Hazard | caution (-1) | No | Useful | `warning` (triangle) |
| Felt unsafe | avoid (-5) | **Yes (auto)** | No | `eye-outline` |
| Incident | avoid (-5) | **Yes (auto)** | Situational | `flag` or `document-text-outline` |
| Felt welcome | safe (+2) | No | Optional | `heart-outline` |
| Black-owned spot | safe (+2) | No | Optional | `star-outline` or `people-circle-outline` |

Anonymity model: **auto-anonymous on sensitive categories** (felt-unsafe, incident), attributed on the rest. Not a per-report toggle.

Row order in the grid communicates spectrum — top row = caution (yellow), middle = avoid (red), bottom = safe (green). Reserved-color exception applies (legitimate UI safety signals).

### Report flow — input
- **Single optional textbox** for v1 (not checkboxes). Copy: *"What else should others know? (optional)"*.
- Defer preset checkbox sub-tags to v2 — design them once we have real submission data.

### Entry points
- **From Home:** Report button (already added to Figma), opens flow with **drop-pin mode** (user picks location).
- **From En-Route:** Same Report button on the side-button column, opens flow with **location locked to current GPS**.
- **From map long-press (bonus):** opens with the long-pressed coords pre-filled.

### Architecture
- Reports become Zones in `lib/api/zones.ts` pipeline. New geometry kind: `'point'` with a small influence radius (~30m). Extend the discriminated union (`'polygon' | 'polyline' | 'point'`).
- New adapter: `lib/api/community-reports.ts`. Mock-first storage (in-memory or AsyncStorage). Returns `Zone[]` with point geometry. Combined with OSM data in scoring.
- `pickWinner` already handles arbitrary zone counts — just need scorer branch on `point` geometry (point-to-point distance ≤ radius).

### Home Report button — specs (already in Figma 825:3625 update)
- **56×56**, rounded-100 (circular), white background.
- **32×32 orange alert icon** inside (Ionicons `alert-circle`, color `#FF9500`).
- **M3 Elevation 2** shadow: `shadowOffset: {0, 2}, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4`.
- **Right-aligned**, `right: 16` from screen edge.
- **Tracks bottom sheet's top edge** at 24pt offset. Implementation: measure bottom sheet height with `onLayout`, position button at `bottom: bottomSheetHeight + 24`.

### Modal padding rule (already established, worth re-stating)
- **Tab-grid / card-based modals:** 16pt horizontal padding (Safety, Pulled-over, Armed-or-Not). Tile widths depend on this.
- **Static-content screens:** 32pt horizontal padding (Onboarding, Permissions). Long-form copy reads better.
- **Don't switch the modals to 32pt.** The grids won't fit.

## What to do first when you start

1. `git status` — confirm where you are. If on `main`, branch into `feat/home-report-button`.
2. `get_metadata` on Figma node `825:3161` → find the two new frames added for the report modal.
3. `get_design_context` on each → audit against the design system + the decisions in this doc.
4. **Build order:**
   - `feat/home-report-button` — add the Home Report button (specs above). Wire onPress to push to `/report` (which doesn't exist yet — that's fine, fix in next PR).
   - `feat/community-report` — build the `/report` screen + `lib/api/community-reports.ts` adapter + `Zone` type extension for `point` geometry.
   - `feat/long-press-report` — bonus, hook map long-press to /report.

## What's been shipped recently (for log-scan context)

Recent PRs (newest first):
- `chore/figma-fidelity-audit-2` — Welcome/Get-Started/Onboarding/Permissions button shadows + structural cleanup.
- `chore/figma-fidelity-audit` — Pulled-over and Search rebuilds, responsive search bar widths.
- `feat/armed-or-not` — Armed-or-Not screen + extracted `<TrustedContactStatus />`.
- `feat/pulled-over-routing` — Officer/Trooper screen.
- `feat/safety-modal` — Safety modal entry point.

The full architecture (zones, scoring, OSRM routing, daylight gradient, search, route explanation) is shipped and working. Today's work is about extending the safety/community-reporting layer.

## Open questions for next session

- Voice (audio note) attachment in lieu of typing? Probably defer.
- Report deduplication / aggregation policy when multiple users hit same spot? Document as a thesis-paper note rather than building.
- Real backend storage for reports? Mock with AsyncStorage for v1, defer real backend.
