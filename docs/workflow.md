# Per-PR workflow — Fresh Greens overlay

This is the **Fresh Greens binding** of [`WORKFLOW-TEMPLATE.md`](WORKFLOW-TEMPLATE.md).
Read them together: the template is the universal rhythm (steps 1–13); this file
fills in the project's concrete tools and carries the FG-specific deep content (the
review-agent briefs, the fidelity audit). **Starting a new project?** Copy the
template and write a fresh overlay like this one — don't fork this file.

**Where this sits:** the per-PR layer. Above it, [`ROADMAP.md`](ROADMAP.md) holds the
milestones; below it, [`next-session.md`](next-session.md) is the backlog and
[`learnings.md`](learnings.md) the journal; [`architecture.md`](architecture.md) is
the code map. `CLAUDE.md` indexes all of these (and holds the canonical graphify/fgq
rules — see there rather than re-stating).

## Placeholder bindings (template → Fresh Greens)

| Template role | Fresh Greens value |
|---|---|
| `{{DESIGN_SOURCE}}` | Figma via the MCP server: `get_design_context(nodeId="…", fileKey="7DDh6c7tk7OKF4WiA7pEkp")`. Output is React+Tailwind reference — a guide, not the answer. |
| `{{TOKEN_SYSTEM}}` | `theme/colors.ts` · `typography.ts` · `shadows.ts` · `interaction.ts` (incl. `tapTarget44`). |
| `{{DESIGN_SPECIMEN}}` | the gitignored **`fresh-greens-specimen/` folder nested in this repo** (a separate repo checked out here, *not* a sibling). Mirror new `colors.ts` tokens into its `:root` block + swatch grid; `npm run check:specimen` fails on drift (skips cleanly if absent). |
| `{{DEV_LOOP}}` | Save → Expo Go hot-reloads on phone in ~1s. |
| `{{NATIVE_BUILD_CAVEAT}}` | Native-module features (`expo-notifications`, `-calendar`, `-audio`, entitlements) do **not** run in Expo Go — they need a **dev build** (`eas build --profile development`) or the iOS Simulator with simulated location. Fuel reminders, calendar destinations, recording waveform, GPS-driven logic all fall here. |
| `{{TYPECHECK_CMD}}` | `npx tsc --noEmit 2>&1 \| grep -vE "menu\.tsx.*avatar\.png\|proxy/api"` — the filtered output must be empty (4 known env-level errors filtered). |
| `{{BLAST_RADIUS_TOOL}}` | `graphify affected "<symbol>"` (sub-second; static-import only). |
| `{{MEMORY_TOOL}}` | `fgq query "<short-seed>"` against the merged code+chats+thesis graph. |
| `{{DESIGN_RULEBOOK}}` | [`.cursorrules`](../.cursorrules) — color tokens + reserved-color rule, typography, tap-target rule, anti-slop checks. Reserved-color rule is *use-granular*, so graphify can't enforce it: `rg "colors\.(orange\|red\|yellow\|pink\|navy)"`. |
| `{{REVIEW_AGENTS}}` | the five project-relevant subagents below (the rest of `~/.claude/agents/` is GSD's 33-agent fleet — unused here, see §14). |

## FG-specific step notes (beyond the template)

- **§7 commit** — include the Figma node ID in parens: `feat: <screen> layout (figma <node-id>)`.
- **§9 merge mechanics** —
  - *GitHub PR path:* `gh pr merge <num> --squash --delete-branch` → `git checkout main` → `git pull --ff-only`.
  - *Local-only path:* `git checkout main && git pull --ff-only` → `git merge --squash feat/<name>` → `git commit` (one squash commit) → `git push origin main` → `git branch -D feat/<name>` (`-D`: squash leaves it "unmerged"). Docs-only changes commit straight to `main`.
  - The `post-commit`/`post-checkout` hooks auto-run `graphify update .`; sanity-check with `head -1 graphify-out/GRAPH_REPORT.md` if a result looks sparse.
- **§11 learnings format** — `## branch-name (YYYY-MM-DD)` heading + 1–3 bullets each ending "Worth keeping: <generalizable rule>". Recurrence check via `fgq query` first.

## §12 — Subagent reviews (the FG roster)

Invoke with `subagent_type: "<name>"` (e.g. `general-purpose` for implementation,
`code-reviewer` for review — note the hyphen; `generalPurpose` is not a valid name).
The plan file is the source of truth — paste each task's text into the implementer
prompt; don't ask it to read the plan from disk.

### Cadence
| Trigger | Agent(s) | Parallel? |
|---|---|---|
| Per PR, after commit, before merge | `code-reviewer` + `mobile-ux-optimizer` | yes |
| End of each Round (every 3–5 PRs) | `whimsy-injector` | standalone |
| Tests fail / unexpected behavior | `debugger` | standalone, reactive |
| New component or perf work | `frontend-developer` | standalone, situational |

### `code-reviewer` — per-PR audit
**Focus:** cross-file consistency (new token vs. existing; new pattern vs. existing);
stale comments that contradict the same diff; dead code / unused imports / half-done
work; input boundaries (user strings → URLs/regex in `proxy/api` routes); comments
that say *what* not *why*; **accessibility** on touched UI (new Pressables need
`accessibilityRole` + `accessibilityLabel`; new loading states `accessibilityState={{ busy }}`;
sighted-visible state changes need a VoiceOver announcement; new Images a label or
`accessible={false}`; new TextInputs a label).
**Ignore:** pre-existing missing-module TS errors (`@expo/vector-icons`, `@vercel/node`);
nits in untouched files; "add tests" unless it's a pure-fn lib (no RN test infra).
**Brief:** "Review the diff on branch X. Blast radius: `<graphify affected …>`. Focus:
cross-file consistency, stale comments, boundary inputs, a11y. Ignore: pre-existing
missing-module TS errors, untouched files."

### `mobile-ux-optimizer` — per-PR UI audit
**Focus:** tap targets (44pt iOS HIG on the *painted* surface, not just `hitSlop` —
use `tapTarget44`); contrast in real lighting (watch the documented freshgreen<AA
exceptions don't proliferate); theme drift (inline hex/spacing vs. `theme/`);
thumb-reach on a 6.7" iPhone; modal padding (`.cursorrules`: 16pt tab/grid, 32pt
static).
**Ignore:** tablet breakpoints (iPhone-first); web patterns (hover/cursor);
`LayoutAnimation` perf (Reduce Motion audited separately).
**Brief:** "Review UI on branch X for mobile fit. Theme-drift files: `<graphify affected colors …>`.
Focus: tap targets, theme drift, .cursorrules conformance. Ignore: tablet/web."

### `whimsy-injector` — end-of-Round
**Focus:** loading/empty/error/success moments; was a meaningful action celebrated
(report submitted, safety flow done)?; generic microcopy that could carry voice;
power-user easter eggs.
**Ignore:** anything in the safety flow — `/pulled-over` is intentionally serious (no
confetti, no jokes); animations without a Reduce Motion path; suggestions needing
assets we don't have.

### `debugger` — reactive
**Focus:** root cause not symptom; recent commits as first suspect (two prior
regressions traced to the previous PR); revert-vs-forward-fix.
**Brief:** "Reproducing X breaks Y. Recent commit is Z. Find root cause; propose
forward-fix or revert; don't patch the symptom."

### `frontend-developer` — situational
**Focus:** new component structure + composition; render cost as a list grows (rec
carousel, marker clusters); state-shape for new features.
**Ignore:** bundle-size/code-split (native app); SSR/SSG.

**Trust but verify** every agent's report — read the diff, not the intent-summary
(both prior regressions came from accepting an intent-summary as fact).

## §12b — Periodic Figma fidelity audit (every ~5 PRs, or after any heavy/structural one)
Branch `chore/figma-fidelity-audit-N`. Source the screen list from
`graphify-out/GRAPH_REPORT.md` community hubs (covers every shipped screen, not just
remembered ones). Per screen: pull the Figma node via `get_design_context`, diff vs.
implementation for — token drift, spacing drift, tap-target violations, reserved-color
violations, modal padding, responsive widths. Capture every finding before fixing;
fix in the same branch; append a learnings entry for *recurring* misses (a recurring
miss is a habit — fix the habit). Track cadence: `git log --oneline | grep audit`.

**Architecture audit** (pairs with fidelity, periodically): adapter purity (no UI in
`lib/api`), theme discipline, orphan cleanup, the three-layer boundary (adapters /
scoring / screens).

## §14 — Process tools (session-level)
- **task-observer** — invoke at the **start of any task-oriented session** (mirrors
  the global `~/.claude/CLAUDE.md` rule). Passive capture of skill-improvement signal;
  check a skill's OPEN observations when you load it.
- **grill-me** — opt-in adversarial stress-test of a plan, *between* `writing-plans`
  and execution. Reach for it on risky/ambiguous plans (behavioral features, formula
  changes); skip it for token swaps. (The template's §12 pre-execution 3-question
  sanity-check is the always-on minimum; grill-me is the deeper version.)
- **GSD** — only the roadmap layer adopted ([`ROADMAP.md`](ROADMAP.md), 2026-06-17);
  its `spec→plan→execute` pipeline + agent fleet stay shelved (they'd duplicate the
  superpowers flow). Borrow GSD's *questions* (did we meet the goal? is it verified in
  the runtime? — now baked into template §10/§12), never its machinery.
