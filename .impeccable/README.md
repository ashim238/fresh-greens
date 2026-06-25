# Impeccable artifacts

Machine and human outputs from `/impeccable` (audit, critique, polish) and `/visual-pass` (optical micro-layout). Consumed by [`docs/workflow.md`](../docs/workflow.md) §12c and the Pre-Supabase visual-closure gate in [`docs/next-session.md`](../docs/next-session.md).

**Design chain:** `theme/` → **`design.json`** (this folder) → [`DESIGN.md`](../DESIGN.md) → [`.cursorrules`](../.cursorrules).

## Canonical (post-closure)

| Path | Role |
| ---- | ---- |
| [`VISUAL-CLOSURE-SYNTHESIS.md`](./VISUAL-CLOSURE-SYNTHESIS.md) | **Rollup artifact** — gate verdict (0 P0/P1), 27-route table, shared-component re-spot-check, explicit P2/P3 deferrals. Cite this when asking “did visual closure finish?” |
| [`design.json`](./design.json) | Impeccable machine catalog of tokens, colors, typography. Regenerate via Impeccable `document` when `theme/` changes. |

## Audit trail (immutable snapshots)

| Path | Role |
| ---- | ---- |
| [`critique/`](./critique/) | Timestamped UX critique snapshots: `<ISO8601>__<file>.md`. One file per `/impeccable critique` run — **do not delete or rewrite**; index only. |
| [`critique/closeout/`](./critique/closeout/) | Design Health Program Phase 1 closeout re-audit (2026-06-20). Per-screen snapshots + [`PROGRESS.md`](./critique/closeout/PROGRESS.md). |

New critique runs append files under `critique/` with the same naming convention.

## Historical (superseded by synthesis)

Point-in-time batch and round docs live in [`archive/`](./archive/). They remain useful for scorecard archaeology but **`VISUAL-CLOSURE-SYNTHESIS.md` is the single rollup**.

| Archive file | Superseded by |
| ------------ | ------------- |
| `VISUAL-CLOSURE-BATCH-{1,2,3,4}.md` | Synthesis §Full route rollup + batch PRs #266–#269 |
| `VISUAL-PASS-2026-06-25.md` | Synthesis §Critique vs visual pass + meta-separator fixes |
| `VISUAL-PASS-2026-06-26.md` | Synthesis §Cross-batch fixes (markers, tow meta) |
| `ROUND-7-SYNTHESIS.md` | Pre-closure hub sweep; P1s closed in batches 1–2 |

## Git policy

- **Commit** critique snapshots and synthesis/archive docs — they are the closure trail.
- **Ignore** only `.impeccable/hook.cache.json` (local Impeccable hook cache; see [`.gitignore`](../.gitignore)).

## Where outputs go (ongoing UI work)

| Command | Output location |
| ------- | ---------------- |
| `/impeccable critique <route>` | `critique/<timestamp>__<file>.md` |
| `/impeccable audit` | Scorecard in PR / learnings; no fixed file unless you save one |
| `/visual-pass round` | Root `VISUAL-PASS-<YYYY-MM-DD>.md` (move to `archive/` when a later synthesis supersedes it) |
