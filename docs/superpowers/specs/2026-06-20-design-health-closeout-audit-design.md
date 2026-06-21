# Design Health Program — Closeout Audit Design Spec

**Date:** 2026-06-20
**Status:** Approved (brainstorm complete; awaiting plan)
**Phase:** Design Health Program — closing audit (the exit ramp)
**Phase 1 source:** [`phase-1-findings/2026-06-19-cross-screen-synthesis.md`](phase-1-findings/2026-06-19-cross-screen-synthesis.md)
**Phase 1 snapshots:** `.impeccable/critique/`

---

## Goal

Verify that the Design Health Program's investments hold up by re-running `/impeccable` against every screen the Phase 1 critique covered, then synthesizing **then-vs-now** evidence. The audit is the program's exit ramp: it produces the evidence the user (and any future collaborator) needs to trust that the program's work is real before pivoting to M1.1 (community cloud + RLS, per `docs/ROADMAP.md`).

This is **diagnostic-only.** No code changes ship from this audit. Outputs are evidence + a closeout synthesis doc.

## What the program shipped (the audit's subject)

- **Phase 1** — 25 deep `/impeccable` per-screen critiques + synthesis. The critique snapshots live in `.impeccable/critique/`; the synthesis at `docs/superpowers/specs/phase-1-findings/2026-06-19-cross-screen-synthesis.md`.
- **Phase 2 Sprint 1** — `useMutation` + `useHydratedResource` discriminated-union primitives + `getErrorMessage` taxonomy.
- **Phase 2 Sprint 2** — 4 cheap-wins PRs (#236 settings value-population, #237 coach-mark recoverability, #238 tap-target geometry, #239 reserved-color audit).
- **Phase 2 Sprint 3** — 3 architectural PRs (#240 Dynamic Type, #241 dismissal, #242 VoiceOver hints). Codified 3 new `.cursorrules` sections.
- **Phase 3** — 5 fix PRs / 13 items (#243 copy, #244 validation/loading/banner, #245 recordings evidence, #246 safety guardrails, #247 honest UI). Codified the 4th convention (Safety-critical interactions) + the `useHoldToConfirm` primitive.

**Codebase footprint** (post-Phase-1 stretch): exactly **one new file** (`hooks/useHoldToConfirm.ts`), ~150 LOC. Everything else was modification. The program was overwhelmingly a **convention and behavior pass**, not a new-abstraction pass — measurable quality improvement with negligible code growth. That observation is itself part of the evidence.

---

## Audit scope

### Critique pass — all 25 Phase 1 screens

Re-run `/impeccable` against the same 25 screens Phase 1 covered, using the same skill. Same lens, same rubric, same depth. Identical conditions are the only way the comparison is real evidence rather than narrative.

The Phase 1 screen list (from the synthesis preamble + `.impeccable/critique/` directory contents) is the authoritative input — the plan task will enumerate it explicitly from the existing snapshots so no screen is forgotten or substituted.

**Output location:** `.impeccable/critique/closeout/` — a sibling folder so Phase 1 snapshots remain pristine for diffing. Filename convention mirrors Phase 1 (`<screen-slug>.md`).

**Tagging:** preserve Phase 1's `INCOMPLETE` / `NOISY` retry tags. If a critique can't complete cleanly, mark it and move on — the closeout synthesis notes the gap rather than blocking.

### Synthesis pass — the closeout doc

One final subagent reads:
- All 25 closeout snapshots (`.impeccable/critique/closeout/*.md`)
- The original Phase 1 synthesis (`docs/superpowers/specs/phase-1-findings/2026-06-19-cross-screen-synthesis.md`)
- The Phase 1 per-screen snapshots (`.impeccable/critique/*.md`) for direct then-vs-now comparison

And writes `docs/superpowers/specs/phase-1-findings/2026-06-20-design-health-program-closeout.md` with the structure below.

---

## Closeout doc structure

Tight prose framing + tabular ledgers throughout. Estimated 6–8 pages.

### 1. Per-screen then-vs-now (table)

| Screen | Phase 1 score | Phase 1 findings (count) | Closeout score | Closeout findings | Delta narrative |
|---|---|---|---|---|---|

One row per screen (25 rows). The delta narrative is a single sentence: "P0 SOS one-tap closed via PR #246 hold-to-confirm; new minor: …" or "No change; cosmetic only." The synthesis subagent generates this from the snapshot diffs.

### 2. Cross-screen patterns — then-vs-now

The 4 patterns the Phase 1 synthesis named (Section 4):
1. Optimistic mutations
2. Hydration / 3-state ladder
3. Tap-target painted geometry
4. Reserved-color discipline

Plus the additions that emerged through Phase 2/3:
- Dynamic Type compliance
- Dismissal affordance consistency
- VoiceOver hint depth
- Safety-critical interaction gating

For each: status (closed / partial / new-pattern-emerged), evidence pointer, and a one-line carry-forward (anything still loose for a hypothetical Phase 4).

### 3. New patterns surfaced by the closeout pass

Anything the re-critique found that Phase 1 missed OR that emerged post-program (e.g. introduced by Phase 3 fixes). Bias honest — if the closeout finds nothing new, say so. False symmetry with Phase 1 would be dishonest.

### 4. Program-produced artifacts inventory

Tabular: the 4 new `.cursorrules` sections + 2 carve-out additions; the primitives (`useHoldToConfirm`, `useHydratedResource`, `useMutation`, `getErrorMessage` taxonomy, `useCoachMark` extensions); the codebase footprint summary (~1 new file, N modified). The "1 new file" point lands hard here — proof the program's value was in the conventions, not the abstractions.

### 5. M1 readiness statement

The program's purpose was to clear design-debt before the pilot. The closeout asserts:
- **What the program affected:** the user-facing surfaces, conventions, accessibility floor, safety-critical interaction gates.
- **What M1.1 (community cloud) actually needs:** server-side Supabase + `community_reports` table + RLS + abuse / moderation path. The client (`lib/api/sources/community-cloud.ts`) already exists. The program touched none of that code region.
- **What M1.2 (EAS → TestFlight) actually needs:** `eas.json`, real bundle id, Apple Developer Program, EAS build pipeline. The program added zero EAS config.

**Recommendation:** M1.1 is the start. The program cleared the runway *for* M1.1, not *of* it — no design-debt blocks the pilot work.

### 6. Outstanding deferrals from the program

Tabular: every `docs/next-session.md` item added with a 2026-06-20 stamp (the program's deferrals). Confirm each is still tracked. Flag any that became pilot-blocking in hindsight (none expected).

---

## Process — mirrors Phase 1's executing-plans pattern

### Wave-based dispatch
**4-wide subagent parallelism** (Phase 1's cap). 25 screens ÷ 4 ≈ 7 waves. Each subagent invokes `/impeccable` for one screen, writes the snapshot to `.impeccable/critique/closeout/<slug>.md`, and returns a one-line status (DONE / INCOMPLETE / NOISY).

### Commit cadence — per-snapshot (changed from Phase 1's per-batch)
Commit **every completed snapshot** to main, not batched. Each commit:
```
audit(closeout): critique for <slug> (N/25)
```

The denser cadence trades a few more commits for **zero-loss durability**: if the session dies mid-wave or hits a token wall, every completed critique is already in `origin/main`. A fresh session resumes cleanly by reading the progress tracker (below).

### Resumability — progress tracker
Maintain `.impeccable/critique/closeout/PROGRESS.md` updated alongside each snapshot commit. Format:

```markdown
# Closeout audit progress
Updated: <timestamp on each commit>
Status: in-progress | synthesis-pending | complete

## Done (N/25)
- ✅ app-home-tsx — commit <sha>
- ✅ app-en-route-tsx — commit <sha>
...

## Pending
- ⏳ app-pulled-over-tsx
- ⏳ app-recordings-tsx
...

## Retry queue
- 🔁 app-X-tsx (1st attempt INCOMPLETE; will retry once)
```

The tracker is committed with each snapshot. A fresh session reads `PROGRESS.md` first, sees the pending list, and resumes dispatch from there. The synthesis subagent runs only when `Pending` is empty (or all pending are exhausted-retry gaps).

### Failure handling
- INCOMPLETE → retry once.
- NOISY (the critique returned but reads as garbled / off-rubric) → retry once with a tightened prompt.
- Still bad after retry → leave the snapshot tagged `INCOMPLETE` / `NOISY` in the closeout folder and surface in the synthesis as a gap. Do not block the audit.

### Synthesis subagent
After all 25 (or as many as completed cleanly) snapshots land:
- One subagent reads the closeout snapshots + Phase 1 snapshots + Phase 1 synthesis.
- Writes the closeout doc using the structure in this spec.
- Returns the doc path.

### Final commits
- `audit(closeout): synthesis — Design Health Program closeout` — the closeout doc.
- `docs(learnings): close the Design Health Program journal` — one-line terminal entry in `docs/learnings.md` pointing to the closeout doc.

Both straight to main, no PR. Docs cadence.

---

## Files

- **Add:** `.impeccable/critique/closeout/<slug>.md` × 25 (the snapshots).
- **Add:** `docs/superpowers/specs/phase-1-findings/2026-06-20-design-health-program-closeout.md` (the synthesis).
- **Modify:** `docs/learnings.md` (terminal entry).
- **Untouched (deliberate):** `.impeccable/critique/*.md` (Phase 1 baselines stay pristine); all code; all other docs.

## Verification (definition of done)

- [ ] Every Phase 1 screen has a corresponding `.impeccable/critique/closeout/<slug>.md` (target: 25/25; minimum acceptable: 22/25 with the 3 gaps explicitly named in the synthesis).
- [ ] Closeout synthesis doc exists at the named path with all 6 sections present.
- [ ] Per-screen then-vs-now table has one row per critiqued screen.
- [ ] M1 readiness statement explicitly recommends M1.1 as the next strategic move.
- [ ] `docs/learnings.md` terminal entry exists and points to the closeout doc.
- [ ] No code changed; no `.cursorrules` changed; no Phase 1 snapshot modified.

## Sequencing

1. Plan task enumerates the 25 screens from `.impeccable/critique/` directory contents.
2. Subagent waves dispatched 4-wide; commit every 5 completes.
3. Synthesis subagent dispatched after wave 7 completes.
4. Closeout doc committed; learnings terminal entry committed.

After this audit closes, the Design Health Program is formally complete. The next strategic move is **M1.1 (community cloud — Supabase server-side + RLS)**, per the closeout doc's recommendation and `docs/ROADMAP.md`.
