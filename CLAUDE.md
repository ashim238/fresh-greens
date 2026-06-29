# Fresh Greens — agent orientation

You are working on Fresh Greens, a React Native + Expo (iPhone-first) thesis navigation/safety app. The canonical rulebooks and backlog are indexed below. Read the relevant doc for the task; don't restate their rules here.

## Where the rules live

- **[`.cursorrules`](.cursorrules)** — enforceable design law. Color tokens, reserved-color rule, typography, tap targets, anti-slop checks. Read before generating any UI code.
- **[`DESIGN.md`](DESIGN.md)** — canonical human design doc (voice, named rules, component catalog). Chain: `theme/` → `.impeccable/design.json` → this file.
- **[`docs/archive/`](docs/archive/)** — point-in-time specs, audits, and superseded references (see `docs/archive/README.md`).
- **[`docs/workflow.md`](docs/workflow.md)** — per-PR rhythm, **Fresh Greens overlay**. Binds the placeholders in [`docs/WORKFLOW-TEMPLATE.md`](docs/WORKFLOW-TEMPLATE.md) (the project-agnostic spine — branch → scope → build → self-review → verify-the-goal → merge → learnings, plus subagent-driven execution + two-stage review) to this project's tools, and carries the FG-specific review-agent briefs + Figma fidelity audit. Read both together; follow for every PR. Starting a new project → copy the template, write a fresh overlay.
- **UI review layers** — three complementary passes, not substitutes: `/impeccable critique` (voice, hierarchy, IA), `/impeccable audit` (tokens, `dynamicType`, a11y, tap targets), **`/visual-pass`** (optical micro-layout: meta separators, mixed-weight rhythm, flex alignment). Skill: [`.cursor/skills/visual-pass/SKILL.md`](.cursor/skills/visual-pass/SKILL.md). Quick mode every UI PR; round mode ~every 5 PRs with critique (see `docs/workflow.md` §6 Tier A, §12c Tier B).
- **[`docs/architecture.md`](docs/architecture.md)** — project orientation. Three-layer architecture (adapters / scoring / screens), tech stack, design rules, shipped-vs-deferred status. Read when scoping a new feature or onboarding a new area.

## Where the backlog lives

- **[`docs/ROADMAP.md`](docs/ROADMAP.md)** — strategic milestone layer above the per-PR rhythm (pilot-ready → funding-ready). Milestones decompose into specs → plans → PRs → next-session items. Read when deciding *what big chunk* to build next vs. *how* to build a PR (that's workflow.md). Adopted 2026-06-17 as the one roadmap-layer piece worth taking from GSD.
- **[`docs/next-session.md`](docs/next-session.md)** — current punch list. Open items grouped by visual fidelity, interaction polish, new features, copy, named rounds (Round 4 — multi-row recs; Round 5 — safety + route-preview), accessibility, polish nits, architecture v2. Strike-through items as they ship rather than deleting; the closure note is worth keeping for grep.
- **[`docs/learnings.md`](docs/learnings.md)** — running journal of decisions and gotchas, newest at top. Append a branch-headed entry per PR that taught something non-obvious (per workflow Step 11). The check: did this take two tries or surprise me at audit? Yes → entry.

## Per-session feedback memory

Durable rules from past sessions live at `~/.claude/projects/-Users-mylesashitey-code-fresh-greens/memory/` and auto-load via `MEMORY.md`. Examples currently saved:

- Merge to main is the default once the pre-merge audit is clean (don't wait for "ship it")
- Append to `docs/learnings.md` per workflow Step 11; bias toward writing one

When a user gives feedback worth keeping across sessions, save it as a new `feedback_*.md` and index it in `MEMORY.md`.

## Stack at a glance

- Expo (managed) + React Native + TypeScript
- `expo-router` (file-based)
- `react-native-maps` (Apple Maps on iOS)
- StyleSheet API (no Tailwind / styled-components)
- `useState` + Context (no Redux / Zustand)
- Theme tokens at `theme/colors.ts`, `theme/typography.ts`, `theme/shadows.ts`, `theme/interaction.ts` — consume from here, never inline a design value.

## Auto critique + audit at merge

After squash-merging a UI PR to main, count `feat`/`fix` commits touching `app/` or `components/` since the newest file in `.impeccable/critique/`. If >= 5, automatically run `/impeccable critique` + `/impeccable audit` on the changed routes before reporting done. No user prompt needed — this is part of the merge step.

## What this file isn't

A rulebook. The rules live in the files linked above. This is a map to find them. If a rule changes, change it at the source, not here.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For **symbol-grounded** codebase questions ("who imports X", "blast radius of Y", "what's the path from A to B"), run `graphify affected "<symbol>"`, `graphify explain "<symbol>"`, or `graphify path "<A>" "<B>"`. Sub-200ms. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output. `affected` is the workhorse for "what does my change touch downstream."
- **Hand graphify an actual identifier**, not a concept. `explain "colors"` works; `explain "design system tokens"` returns `No node matching ...`. The index is symbol-shaped, not English.
- **Do NOT feed `graphify query` natural-language prose.** Its tokenizer seeds on the first matching identifier and frequently returns junk (e.g. asking "what is the routing source ladder" seeds on "lib" and returns tsconfig.json compiler options). For prose or architectural questions, read source. For decision-history questions, use `fgq query` (below).
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when affected/explain/path do not surface enough context.
- The repo has `post-commit` + `post-checkout` git hooks installed that auto-run `graphify update .` so the graph stays current without manual refresh. If a graphify result feels suspiciously sparse, sanity-check with `head -1 graphify-out/GRAPH_REPORT.md` — the title carries the build date, and a manual `graphify update .` (sub-2s, AST-only, no API cost) re-syncs if needed.
- For **why / decision / history / thesis** questions (not just "where is the code"), query the MERGED graph: `fgq query "<seed>"` (use a short seed, not a full sentence — same tokenizer limitation as `graphify query`). It spans this code + 76 chat transcripts + the MFA thesis (at `~/.graphify/fresh-greens-merged/`). Answers "why did we choose X", "what's the rationale behind Y", "which shipped feature serves which thesis claim". Treat chat/thesis nodes as memory-joggers (LLM-inferred from prose) — verify against code / `docs/learnings.md` before citing.
- **Default to `fgq query` for cross-session memory checks.** In-chat context condenses and dilutes old decisions, so before (a) making a non-obvious decision, (b) verifying a feature's intent against the thesis, (c) re-opening a topic that might have prior coverage, or (d) auditing whether shipped code matches a stated claim — run `fgq query "<short-seed>"` first. The current in-chat context is what's in front of you; the merged graph is what's behind you. Most of this session's drift bugs (stale next-session.md entries, redundant work, "did we already decide this?" moments) trace to skipping this check.
- **Do NOT use graphify for:** the reserved-color rule (edges are import-granular, not use-granular — use `rg "colors\.(orange|red|yellow|pink|navy)"`); runtime composition (Context consumers, render props — static imports only); type checks (use `tsc`).
