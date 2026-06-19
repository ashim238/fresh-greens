# Design Health Program — design

**Date:** 2026-06-19
**Status:** Approved (brainstorm)
**Scope:** A three-phase program to lift every screen in the Fresh Greens app to ≥35/40 on `/impeccable critique` and keep it there as features ship. This spec covers the full program at the strategic level; **only Phase 1 has a full implementation plan written from this spec.** Phases 2 and 3 each get their own spec → plan cycle after their predecessor's checkpoint clears.

## Why

The home screen critique (Design Health 29/40 — Tier B) surfaced 6 priority issues that a batch-audit pass would not have caught: a P0 safety-check dead end, a P1 first-run overlay that lost the brand voice, a P1 hidden save affordance, a P1 working-memory cliff on hazard-chip tap, and two P2 polish gaps. PR #231 ships those fixes. The user's worry — and the realistic concern — is that the *other* 24 screens have analogous polish gaps that the earlier 22-screen batch audits scored too generously to surface.

The earlier batch audits (Sonnet, heuristic + 5-dimension scoring, ~2 min per screen) gave us tier signal: 11 screens at Tier A (≥35/40), 10 at Tier B (28–34), 1 at Tier C (28). But a Tier-A batch score is not the same instrument as a Tier-A score from a deep design-director critique, and we don't know the gap between the two until we look.

There are also visible *systemic* patterns across the batches — silent error swallowing, inconsistent dismiss patterns, hitSlop-as-compliance creeping back, off-ramp spacing/radius values, near-identical pill/chip implementations — that no amount of per-screen polish will sustainably fix. The leverage is to identify these once and lift them once.

This program does both: a uniform deep critique pass to establish the real baseline, then a system-level lift that addresses the recurring patterns, then a per-screen tail for what's left, and a lightweight Definition-of-Done gate so quality holds as features ship.

## Goals

- **Floor:** every screen ≥35/40 on `/impeccable critique`.
- **Macro:** the systemic patterns that show up across multiple screens get fixed at the design-system level (extracted components, tightened tokens), not re-fixed per-screen.
- **Drift prevention:** new features inherit the floor by default — there's a documented step in the per-PR workflow that catches new drift before merge.

## Non-goals

- No automated CI gate in this program. The DoD step in Phase 3 is documentation, not enforcement. CI is a separate, later investment once the manual loop proves what's worth gating on.
- No changes to `DESIGN.md` or the theme tokens for their own sake. If extraction in Phase 2 surfaces a missing token (e.g. a needed `radii` value), it gets added — but token additions are evidence-driven, not aspirational.
- No new features. This program is strictly improvement of existing surfaces and the shared chrome that supports them.
- No critique of internal helpers, hooks, or non-screen components. Phase 1's 25 targets are user-facing route screens (`app/*.tsx`). Shared components are evaluated indirectly through the screens that consume them.

---

## Program shape

```
Phase 1 — Diagnose          ← this spec's full detail; one plan; ~4.5M tokens
   25 deep `/impeccable critique` runs (the screen-route inventory)
   + a cross-screen synthesis report identifying systemic patterns
   ↓ checkpoint: review findings, decide Phase 2 scope
Phase 2 — System lift       ← sketched only here; new spec written after Phase 1
   Extract recurring patterns into shared components/tokens
   ↓ checkpoint: re-score lifted screens; decide Phase 3 tail
Phase 3 — Per-screen tail   ← sketched only here; new spec written after Phase 2
   Targeted polish PRs for what extraction didn't catch
   + lightweight "Definition of Done" step added to docs/workflow.md
```

Each phase has a natural ship/measure cycle. Phase 1 produces a synthesis report. Phase 2 produces upgraded components + re-scored screens. Phase 3 produces a clean Tier-A scorecard and the DoD entry in the per-PR workflow.

---

# PHASE 1 — Diagnose (this spec's full detail)

## Scope

**25 screens get a deep `/impeccable critique`.** The set is the union of:
- The 22 screens covered by the earlier batch audits (every Tier A, B, and C screen named in the audit summaries from this session).
- The 3 highest-traffic surfaces we've polished separately this session: `app/home.tsx` (re-baseline after PR #231 merges, current snapshot is pre-polish 29/40), `app/en-route.tsx` (fresh — never had a deep critique, only Wave 5 polish), `app/pulled-over.tsx` (fresh — only Wave 5 polish).

The full target list: home, en-route, pulled-over, search, report, roadside, emergency, menu, recordings, fuel, unfamiliar, trip-summary, onboarding, permissions, login, get-started, legal, safety, safety-settings, saved-places, share-location, zone-preferences, roadside-setup, sign-out, trusted-contact-setup.

**Even Tier-A-on-batch screens are critiqued.** A 38/40 from the batch audit is not the same instrument as a 38/40 from a deep critique. We want a uniform ruler across the app, and even excellent screens typically surface 1–2 polish findings under a director-level review.

## Critique order — lowest batch-audit score first

Sequence:
1. `roadside` (28 — Tier C)
2. `search` (30)
3. `home` (29 critique pre-polish — re-baseline after PR #231 merges)
4. `fuel` (31 pre-v2 baseline; v2 has shipped, so this captures post-v2 state)
5. `legal` (32)
6. `trip-summary` (32)
7. `report` (32)
8. `sign-out` (33)
9. `menu` (33)
10. `get-started` (34)
11. `login` (34)
12. `unfamiliar` (34)
13. `en-route` (no batch score — uses traffic priority slot)
14. `pulled-over` (no batch score — uses traffic priority slot)
15. `trusted-contact-setup` (35)
16. `recordings` (35)
17. `emergency` (35)
18. `roadside-setup` (36)
19. `share-location` (37)
20. `saved-places` (37)
21. `permissions` (37)
22. `safety` (38)
23. `onboarding` (38)
24. `safety-settings` (39)
25. `zone-preferences` (40)

Two reasons for lowest-first: (a) **fail-fast on the worst** — if the program is going to be longer than expected, we find out early; (b) **recurring patterns surface faster** when the worst offenders go through the funnel first.

`en-route` and `pulled-over` slot in mid-sequence because they're high-traffic but recently polished — we expect them to score high, but we want the data sooner than Tier-A's tail.

## Execution shape

**Parallelism: up to 4 concurrent critiques.** The `/impeccable critique` skill dispatches a Sonnet subagent for Assessment A (the design review) — each is ~150–180k tokens and parallel-safe (read-only on source, writes to its own snapshot file). Wall-clock for the full sweep: ~75–90 minutes at 4-way parallelism, vs. ~5 hours serial. Token cost is unchanged by parallelism.

**Per-critique workflow** (the `/impeccable critique` skill's existing flow):

1. **Resolve target slug** — `app-{screen-name}-tsx` via the `critique-storage.mjs slug` helper.
2. **Read `.impeccable/critique/ignore.md`** if it exists (it doesn't today; this is the skill's standard pre-step).
3. **Dispatch Assessment A subagent (Sonnet, general-purpose).** The subagent reads the screen source, the relevant supporting components (e.g. `HomeBrowseSheet.tsx` for `home`), the design tokens (`theme/*.ts`), `.cursorrules`, and DESIGN.md / PRODUCT.md. It produces: AI-slop verdict, Nielsen's 10 heuristic scores (0–4 each, /40 total), cognitive-load checklist, emotional journey, 2–3 strengths, 4–6 priority issues with P0–P3 severity + concrete fixes, persona red flags (Sam, Casey, and a project-specific "Black driver assessing safety" persona derived from PRODUCT.md), minor observations.
4. **Assessment B (deterministic detector):** runs `node .claude/skills/impeccable/scripts/detect.mjs --json {target}`. This is a CSS/HTML-oriented scanner; on React Native TSX it returns `[]` (no findings). That's expected — we record it as "deterministic scan N/A for RN," not as a clean pass. The design review IS the substance.
5. **Synthesize** the chat-facing critique report (Design Health table + Anti-Patterns verdict + Strengths + Priority Issues + Persona Red Flags + Minor Observations + Questions to Consider).
6. **Persist the snapshot** to `.impeccable/critique/{ISO-timestamp}__{slug}.md` via `critique-storage.mjs write`. Frontmatter carries `target`, `total_score`, `p0_count`, `p1_count`, `timestamp`, `slug`.
7. **No "Ask the User" / "Recommended Actions"** sections after the report. The standard `/impeccable critique` flow asks scope/priority questions at the end of each run; we skip that step in Phase 1 — we're collecting baselines, not deciding remediation per-screen.

**Failure handling.**
- *Critique subagent crashes or returns malformed output* → retry once with a tighter prompt (drop optional sections, demand only the heuristic table + priority issues). If still failing, mark the slug as `INCOMPLETE` in the synthesis manifest and move on. Don't block the program on one screen.
- *A critique returns nonsense / false-positive-heavy* → mark as `NOISY` in the synthesis manifest; weight its findings lower in pattern detection but keep the snapshot for human review.
- *Two snapshots for the same slug* → the synthesis uses the most recent. `home` will deliberately have two: today's pre-polish snapshot and a post-PR-#231 re-baseline.

## Synthesis step

After all 25 critiques land, dispatch **one synthesis subagent** (Sonnet, general-purpose) that reads every snapshot in `.impeccable/critique/`, **deduplicates to the most recent snapshot per slug** (so `home`'s pre-polish snapshot is superseded by its post-PR-#231 re-baseline), and produces a single report at `docs/superpowers/specs/phase-1-findings/2026-MM-DD-cross-screen-synthesis.md`. The directory will be created on first write.

The synthesis report contains five sections:

### 1. Score table

Per-screen total + heuristic-by-heuristic breakdown, sorted from lowest to highest total. Columns: screen, total /40, H1–H10 (heuristic scores), P0 count, P1 count, gap to 35, current tier (A / B / C). Color-coded so the screens above the line and below are immediately distinguishable.

### 2. Recurring patterns

Every P0 and P1 issue named in any critique gets categorized. Patterns appearing on **3 or more screens** become Phase 2 candidates. Each pattern entry contains:

- **Name** — short identifier (e.g. "silent error swallowing").
- **Description** — one sentence.
- **Consuming screens** — the list of slugs where it shows up.
- **Proposed system-level fix** — the extraction or design-system change that would lift all consumers (e.g. *"extract `<RetryChip>` + `useRetryable()` hook"*).
- **Expected lift** — estimated heuristic-score delta per consuming screen (typically +1 to +2 on the relevant heuristic).
- **Estimated Phase 2 token cost** — implementer + reviewers per extraction.

Patterns appearing on 1 or 2 screens stay in the per-screen polish backlog (Phase 3); they're not worth extracting.

### 3. Component-extraction candidates

A parallel list, derived from the patterns but framed as code-level extractions. Today's known candidates from this session's work: a unified `<Pill>` primitive (BucketPill, fuel-segment, fill-fraction, RouteWarningChip), a `<RetryChip>` (lots of silent-error sites), a `<DismissAffordance>` family (X-pill vs Cancel-FAB vs scrim-tap divergence flagged in the home critique), a `<DestructiveConfirm>` wrapper for `Alert.alert` patterns. The synthesis will confirm or correct these and add any new ones the critiques surface.

### 4. Phase 2 scope estimate

A recommended Phase 2 plan: which extractions to do, sequenced by lift count (most-consuming-screens first), with a total token estimate. This is what we'll decide on at the checkpoint.

### 5. Phase 3 tail

Per-screen issues that are screen-specific (appear on 1–2 screens, not extracted away by Phase 2). Each is tagged with the source critique snapshot path so the Phase 3 plan can pull the context directly.

## Checkpoint — the decision moment

When the synthesis report is committed, present it in chat with three structured questions, each grounded in data from the report (per the brainstorming-skill discipline — never ask generic questions when specific findings are available):

1. **Per-screen state.** Here's the score table. X screens are already ≥35; Y are below. Did anything score *lower* than the batch audit suggested (which would expand Phase 3's tail), or did anything score *higher* (some Tier B's may already be Tier A under a deep look)? Are any unexpected scores worth investigating before deciding remediation?
2. **Phase 2 scope sign-off.** The synthesis recommends extracting N shared patterns (named, with lift counts and costs). Accept the recommended set, trim it, or add to it?
3. **Phase 3 sketch sign-off.** Of the screens that won't be fixed by Phase 2, here's the per-screen polish backlog. Sequence by score-gap-to-35? By traffic? Stop earlier than full Tier A coverage if the tail isn't worth it?

Concrete go/no-go criteria for the Phase 2 decision (a "pattern" here is one that already cleared the 3-or-more-consuming-screens threshold to make it into the synthesis's recurring-patterns section):
- **Go to Phase 2 as-recommended** when ≥3 such patterns exist in the synthesis (real systemic leverage — at least three separate extractions, each lifting at least three screens).
- **Trim Phase 2** when only 1–2 patterns reach the threshold (extraction isn't paying for itself; route those findings to Phase 3 per-screen polish instead).
- **Re-scope** when the report surfaces something we didn't expect (a screen scoring catastrophically low, a new pattern like "8 screens share an empty-state shape that should be one component," etc.).

After the checkpoint, the brainstorming flow loops: Phase 2 gets its own brainstorm-skill spec written and informed by the synthesis report. This spec does not pre-commit to Phase 2's exact shape.

## Files Phase 1 touches

- **Reads only:**
  - `app/{screen}.tsx` × 25
  - `components/` (the shared UI components consumed by the screens)
  - `theme/colors.ts`, `theme/typography.ts`, `theme/spacing.ts`, `theme/radii.ts`, `theme/shadows.ts`, `theme/interaction.ts`
  - `.cursorrules`, `PRODUCT.md`, `DESIGN.md`
- **Creates/updates:**
  - `.impeccable/critique/{timestamp}__{slug}.md` × 25 (or 26 counting the home re-baseline)
  - `docs/superpowers/specs/phase-1-findings/2026-MM-DD-cross-screen-synthesis.md` (one)

Phase 1 makes no code changes. No `app/`, `components/`, `hooks/`, `lib/`, or `theme/` edits.

## Testing / verification

There is no automated test surface for Phase 1 — it's a diagnostic. Verification is procedural:

1. **All 25 critique snapshots exist** in `.impeccable/critique/` with frontmatter validated by `critique-storage.mjs trend`.
2. **Each snapshot has a total_score** in the expected 0–40 range and a non-empty Priority Issues section. If any snapshot is `INCOMPLETE`, it's named in the synthesis report's preamble.
3. **The synthesis report committed** to the spec's findings directory. It contains all five required sections (score table, recurring patterns, extraction candidates, Phase 2 estimate, Phase 3 tail).
4. **The chat-facing checkpoint** is presented with the three structured questions.

No tsc, no test runner, no device pass — Phase 1 doesn't ship code.

## Workflow

Per the per-PR rhythm in `docs/workflow.md`:
- **Branch:** `program/design-health-phase-1`.
- **Commits:** one per critique snapshot is heavyweight; we'll commit in waves (every 5 critiques) to keep history readable. The synthesis report is a final commit.
- **Step 7 review brief:** none required — the program is diagnostic only.
- **Step 11 learnings entry:** an entry at the end of Phase 1 capturing what the deep-critique-vs-batch-audit comparison taught us (whether batch scores held up, where they diverged) — this is a useful methodological observation for future sessions.
- **PR:** one PR at the end of Phase 1, body is the synthesis report's executive summary. The PR doesn't change code; it ships the snapshots + the synthesis to main as the program's checkpoint artifact.

---

# PHASE 2 — System lift (sketched only)

After the Phase 1 checkpoint, a new spec is written informed by the synthesis report. The shape we expect, based on patterns visible from this session's work:

- **One PR per extraction.** Each extraction is a small focused PR (new shared component or hook, plus call-site swaps across the consuming screens, plus regression-test the lift on a few representative consumers).
- **Likely first extractions** (confirmed by synthesis, not pre-committed here):
  - `<RetryChip>` + `useRetryable()` hook — unified silent-error recovery.
  - Unified `<Pill>` primitive — subsumes BucketPill, fuel-segment, fill-fraction, RouteWarningChip.
  - `<DismissAffordance>` family — standardizes the X-pill / Cancel-FAB / scrim-tap divergence.
  - `<DestructiveConfirm>` — wrapper around `Alert.alert` for destructive actions.
- **Per-extraction execution:** subagent-driven development pattern (implementer + spec-reviewer + code-reviewer), like the fuel-v2 program. Estimated 250–350k tokens per PR.
- **Re-score after each batch** of extractions: the affected screens get a light re-critique to confirm the lift. (Light re-critiques are ~50–80k tokens — cheaper than full critiques because the heuristic scoring can be done against the existing snapshot as a delta.)

**Phase 2 checkpoint:** after extractions land, present the re-scored screen table to user. Decide Phase 3 scope (which screens still need targeted polish to clear 35).

# PHASE 3 — Per-screen tail (sketched only)

Two pieces:

1. **Per-screen polish PRs.** One per screen that didn't clear 35 after Phase 2. Each pulls from its critique snapshot for the backlog. Small (~150–250k tokens each). Sequenced by score-gap-to-35.
2. **Definition-of-Done step added to `docs/workflow.md` Step 7.** A documented requirement — not CI:
   > For surfaces with substantive UI changes, run `/impeccable critique <touched-file>` before merging. Persist the snapshot to `.impeccable/critique/`. Address P0/P1 unless out of scope; defer P2 to `next-session.md`.
   This integrates with the existing per-PR rhythm. Future features inherit the floor by default because the workflow says so.

**Phase 3 closes when:**
- Every screen has at least one critique snapshot showing total ≥35.
- `docs/workflow.md` carries the DoD step.
- A re-baseline pass (a light re-critique of every screen, ~50–80k tokens each = ~1.5M for the sweep) confirms the floor holds across the app.

## Out of scope for the entire program

- Automated CI gate enforcing critique scores. The DoD entry is documentation. A real CI gate is a separate spec, written if and when the manual DoD loop proves stable.
- `DESIGN.md` rewrite. Token additions are evidence-driven; the source-of-truth doc stays as is unless extraction surfaces a real gap.
- New features, new screens, new flows. Improvement only.
- Critique of non-screen surfaces (hooks, lib adapters, scoring logic). Evaluated indirectly through the screens that consume them.
- Performance benchmarking. Out of scope; the critique covers perceived performance via the cognitive-load checklist, not measured FPS.
