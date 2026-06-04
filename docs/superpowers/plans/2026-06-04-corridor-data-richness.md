# Corridor data richness (B0 → B1 → B4 → B5) — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development per task. Checkbox steps track progress. **Verification gate:** `npx tsc --noEmit` after every task.

**Goal:** Ship phased hazard data adapters on the corridor chassis (Part A), in order **B0 → B1 → B4 → B5**, with cross-source dedup (Part B½) landing in **B4**.

**Depends on:** [corridor sampling plan](./2026-06-04-corridor-sampling.md) merged or stacked (`feat/corridor-sampling`). Richness branches stack on that + each other.

**Spec:** [corridor-sampling-and-data-sources-design.md](../specs/2026-06-04-corridor-sampling-and-data-sources-design.md) — **Part B** (phases) + **Part B½** (hazard identity).

**Branch rhythm:**

| PR | Branch (suggested) | Base |
|----|-------------------|------|
| B0 | `feat/corridor-b0-megatrip` | `feat/corridor-sampling` |
| B1 | `feat/community-cloud-b1` | B0 merged or stacked |
| B4 | `feat/dot-511-b4` | B1 merged or stacked |
| B5 | `feat/mapbox-incidents-b5` | B4 merged or stacked |

---

## File map (cumulative)

| File | B0 | B1 | B4 | B5 |
|------|----|----|----|-----|
| `lib/api/sources/osm-overpass.ts` | Create / extend | — | — | — |
| `lib/api/zones.ts` | Thin; import OSM module | — | `fetchSample` fan-out | + Mapbox source |
| `lib/corridor/constants.ts` | `maxCalls` 20, megatrip cap | — | `HAZARD_*` knobs | — |
| `lib/corridor/planner.ts` | Megatrip anchor cap | — | Add `dot-511` on bbox legs | + Mapbox when `routeSource` |
| `lib/corridor/types.ts` | Extend `ZoneSourceId` | — | `dot-511` | `mapbox-incidents` |
| `lib/corridor/merge-hazards.ts` | Passthrough stub | — | **L3 collapse** | Extend precedence |
| `lib/api/sources/community-cloud.ts` | — | Create | — | — |
| `lib/api/sources/dot-511.ts` | — | — | Create | — |
| `lib/api/sources/mapbox-incidents.ts` | — | — | — | Create |
| `app/home.tsx` | — | Cloud read path | Chip count by `canonicalHazardKey` | — |
| `lib/scoring.ts` | — | — | Optional: score post-L3 list | — |

---

## Task B0: Extended OSM + megatrip knobs

**Branch:** `feat/corridor-b0-megatrip`

**Status:** Shipped (`b60c1dd` on `feat/corridor-b0-megatrip`).

**Files:**
- Create: `lib/api/sources/osm-overpass.ts`
- Modify: `lib/api/zones.ts`, `lib/corridor/constants.ts`, `lib/corridor/planner.ts`
- Modify: `lib/api/zones.ts` + `lib/corridor/types.ts` — `ZoneSourceId`, optional `source` on `Zone`
- Create: `lib/corridor/merge-hazards.ts` (passthrough until B4)

- [x] **Step 1–7** — OSM module, megatrip knobs, `source` + merge-hazards stub, spec B½ + richness plan.

**Commit message (when asked):** `feat(zones): B0 extended Overpass selectors and megatrip corridor knobs`

---

## Task B1: Community cloud adapter

**Branch:** `feat/community-cloud-b1`

**Goal:** Reports readable from cloud; device queue still writes locally and syncs up. **No** L3 merge between community and OSM (Part B½).

**Files:**
- Create: `lib/api/sources/community-cloud.ts`
- Modify: `lib/api/community-reports.ts` (read path: cloud + local merge)
- Modify: `app/home.tsx` / `app/en-route.tsx` if adapter surface changes
- Env: `.env.local` keys via `expo-constants` (no inline secrets)

- [x] **Step 1** — Supabase (PostgREST, no SDK); see learnings.
- [x] **Step 2–4** — `community-cloud.ts`; merge on read; sync queue on write; `source: 'community-report'` on zones.
- [ ] **Step 5: Verify** — Two devices with same `.env.local` Supabase keys; submit on A → appears on B after refresh/focus.
- [x] **Step 6: Docs** — `.env.example` + `docs/learnings.md`.

**Commit:** `feat(community): cloud adapter for cross-device reports`

---

## Task B4: DOT 511 + hazard merge (L3)

**Branch:** `feat/dot-511-b4`

**Spec:** Part B½ — implement L3 here, not in B0/B1.

**Files:**
- Create: `lib/api/sources/dot-511.ts`
- Modify: `lib/corridor/planner.ts` — `SUPPORTED_511_STATES`, append `'dot-511'` to `sources` on straight `bbox` legs
- Modify: `lib/api/zones.ts` — `fetchCorridorSample` dispatches by `request.sources`
- Implement: `lib/corridor/merge-hazards.ts` — `hazardBucket`, grid key, precedence table
- Modify: `lib/corridor/executor.ts` — call `collapseHazardZones` after each wave merge and before return
- Modify: `app/home.tsx` — `routeHazardChips` counts distinct `canonicalHazardKey` (fallback `id`)

- [x] **Steps 1–6** — merge-hazards L3, dot-511 demo, planner sources, fetch fan-out, home chip dedupe by `canonicalHazardKey`.

- [ ] **Step 7: QA** — Device: Mapbox route through AL → road chip; L3 collapses duplicate road signals.

- [ ] **Step 8: Learnings** — optional after QA.

**Commit:** `feat(zones): ALDOT 511 adapter and cross-source hazard merge`

---

## Task B5: Mapbox incidents

**Branch:** `feat/mapbox-incidents-b5`

**Precondition:** Routes using Mapbox (`routeSource === 'mapbox'`).

**Files:**
- Create: `lib/api/sources/mapbox-incidents.ts`
- Modify: planner — add `mapbox-incidents` to `sources` when Mapbox route + bbox/around policy (spec: when Mapbox routing; prefer bbox legs like 511)
- Extend: `merge-hazards.ts` precedence (511 > mapbox > osm already documented)

- [x] **Steps 1–3** — demo incidents on bbox when Mapbox token + `routeSource: 'mapbox'`; wired in planner + `fetchCorridorSample`.

- [ ] **Step 4: QA** — Mapbox-routed trip; optional road chip from `mapbox-incidents` demo layer.

**Commit:** `feat(zones): Mapbox incident layer on corridor samples`

---

## Cross-task invariants

- **Cache:** `COMMUNITY_IN_CORRIDOR_CACHE = false` — OSM (+511/mapbox from corridor) only in `zone-cache`.
- **Reserved colors:** unchanged — chips/markers keep orange/yellow rules.
- **Compare sheet:** `routeConditions` stays presence-based; home chips gain key-based counts in B4.
- **No new npm deps** without user confirmation per `.cursorrules`.

---

## Spec traceability

| Spec section | Task |
|--------------|------|
| Part B B0 | B0 |
| Part B B1 | B1 |
| Part B B4 + Part B½ | B4 |
| Part B B5 | B5 |
| Part B B6 | Deferred (post-demo) |

---

## Manual QA matrix (after B4)

| Route | Check |
|-------|-------|
| Short urban | B0 tags appear; chip counts stable |
| NYC→Birmingham | >250 km footnote; more hazards than pre-corridor; 511 on AL legs if live |
| 960 mi | 20-call budget; megatrip anchors; not "community only" when OSM exists on corridor |
