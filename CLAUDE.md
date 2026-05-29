# Fresh Greens — agent orientation

You are working on Fresh Greens, a React Native + Expo (iPhone-first) thesis navigation/safety app. The canonical rulebooks are split across three files. Read the relevant one for the task; don't restate their rules here.

## Where the rules live

- **[`.cursorrules`](.cursorrules)** — design rulebook. Color tokens + reserved-color rule, typography, tap-target rule, code conventions, anti-slop checks, out-of-scope items. The single source of truth for "is this design choice on-brand." Read before generating any UI code.
- **[`docs/workflow.md`](docs/workflow.md)** — per-PR rhythm. Step 1–13 recipe covering branch → Figma fetch → scope → commit → audit → merge. Step 10 (Merge, sync, clean up) and Step 13 (Subagent reviews) define the per-PR rhythm; Step 11 covers the learnings entry. Follow this for every PR.
- **[`docs/architecture.md`](docs/architecture.md)** — project orientation. Three-layer architecture (adapters / scoring / screens), tech stack, design rules, shipped-vs-deferred status. Read when scoping a new feature or onboarding a new area.

## Where the backlog lives

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

## What this file isn't

A rulebook. The rules live in the files linked above. This is a map to find them. If a rule changes, change it at the source, not here.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- For **why / decision / history / thesis** questions (not just "where is the code"), query the MERGED graph instead: `fgq query "<question>"` (also `fgq path "A" "B"`, `fgq affected "X"`). It spans this code + 36 chat transcripts + the MFA thesis (`~/.graphify/fresh-greens-merged/`), so it answers "why did we choose X", "what's the rationale behind Y", and "which shipped feature serves which thesis claim". Treat its chat/thesis nodes as memory-joggers (LLM-inferred from prose) — verify against code / `docs/learnings.md` before relying on them.
