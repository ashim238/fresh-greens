# Per-PR / per-feature workflow — portable template

A project-agnostic development rhythm. **To reuse on a new project:** copy this
file, then write a short `workflow.md` *overlay* that binds the `{{PLACEHOLDERS}}`
below to that project's concrete tools. The methodology here is the part that
transfers; the nouns live in the overlay.

**Placeholders the overlay must supply:** `{{DESIGN_SOURCE}}` (where designs come
from), `{{TOKEN_SYSTEM}}` (design-token location), `{{DESIGN_SPECIMEN}}` (optional
published design-system mirror + drift check), `{{DEV_LOOP}}` + `{{NATIVE_BUILD_CAVEAT}}`
(how you run/iterate), `{{TYPECHECK_CMD}}` (the static gate), `{{BLAST_RADIUS_TOOL}}`
(who-calls-this code-graph query), `{{MEMORY_TOOL}}` (cross-session decision/recurrence
search), `{{DESIGN_RULEBOOK}}` (the "is this on-brand" source of truth),
`{{REVIEW_AGENTS}}` (named review subagents + their filled-in focus/ignore briefs),
`{{ARCH_AUDIT_CHECKLIST}}`.

## The doc-ecosystem shape

Five docs + an index, each at a different altitude. Reuse the *shape*:
- **roadmap** — strategic milestones; decompose *into* PRs.
- **workflow** (this) — the per-PR rhythm.
- **backlog** — tactical punch list; strike-through on close, don't delete.
- **learnings** — journal of what bit you; newest on top.
- **architecture** — code-orientation map.
- **index** (e.g. `CLAUDE.md` / `AGENTS.md`) — points at all five.

---

## 1. Start clean
Branch off the trunk; name the branch for the work (`feat/<thing>`, `fix/<thing>`).

## 2. Pull the design
Get the reference from `{{DESIGN_SOURCE}}`. Treat generated reference code as a
*guide, not the answer* — adapt to the project's stack and tokens.

## 3. Scope v1
Decide what's in this PR vs. a follow-up. Default: layout/copy/interaction/tokens/
a11y in scope; decorative assets/animations deferred (mark `TODO:` so they're not
lost). **Blast-radius check:** for changes to shared components, tokens, or prop
signatures, run `{{BLAST_RADIUS_TOOL}}` to enumerate downstream callers up front — a
new prop with N callers is a scoping decision, not a review surprise. Caveat:
static-import graphs miss runtime composition (context/render-props) — confirm with
grep. **Name the closest existing analog** for each new file so new code matches
established patterns rather than inventing a parallel one.

## 4. Tokenize before inlining
Before writing a raw color/size/spacing value, check `{{TOKEN_SYSTEM}}`; if it's
missing, add it there first, then consume it. **Never inline a design value.** If a
new token ships, mirror it into `{{DESIGN_SPECIMEN}}` (if the project has one) and
run its drift check.

## 5. Build, iterate
Iterate in `{{DEV_LOOP}}`. **`{{NATIVE_BUILD_CAVEAT}}`** — some features only run /
are only testable in a fuller build or simulator, not the fast loop; know which side
of that line your feature is on *before* you trust it.

## 6. Self-review the diff before committing
Read your own changes. Checklist (these are *gates*, not suggestions):
- Hardcoded values that should be tokens; stray debug logs; dead comments/imports.
- **No secrets / env files staged** — never commit credentials or `.env*`.
- **Accessibility** — new interactive elements have role + label; new state changes
  visible to sighted users are announced; new media has a label or is marked
  decorative. (Non-negotiable if the product has any safety/assistive surface.)

## 7. Commit + (push)
Conventional-commit prefixes (`feat:`/`fix:`/`chore:`/`docs:`/`refactor:`); name files
explicitly (avoid `add .`); reference the design node in the message. Push the branch
if you want the remote review surface / backup / collaboration; for small solo
features you can keep it local and merge locally (§8).

## 8. Review surface: PR or local merge
A hosted PR buys a rendered-diff review + remote backup. Solo/fast features can skip
it and squash-merge the local branch. **The audit (§12) is the real gate, not the
PR.** Re-read the rendered diff once more before merging — a different reading mode
catches different mistakes.

## 9. Merge on a clean audit
Merge once the pre-merge audit (§12) is clean, or once substantive findings are fixed
in the same branch. Squash-merge + delete the branch; sync the trunk. **Hold only
when:** the audit surfaced a CRITICAL needing triage, the author asked to wait, or a
destructive remote op is involved.

## 10. Verify the goal, not just the tasks
Tasks-done + `{{TYPECHECK_CMD}}`-clean is **not** "the goal is met." Before declaring
a feature done, run a **goal-backward check**: restate the feature's stated goal,
name the `file:line` that delivers each user-facing promise, and **list every promise
with no real-runtime confirmation**. Verdict: MET / PARTIAL / **UNVERIFIED-IN-RUNTIME**.
For anything only the real runtime can exercise (native modules, device sensors, live
notifications), name the verification debt explicitly ("owes runtime test: X") in the
merge note rather than silently deferring it. Making the unverified state *explicit
and logged* is the whole point — it stops "ship, then quietly owe a test forever."

## 11. Learnings + backlog hygiene
If the PR taught something (a quirk, a gotcha, a recurring habit), add a dated entry
to the learnings journal — *check for recurrence first* via `{{MEMORY_TOOL}}` and
append to the existing entry rather than duplicating. The check: "did this take two
tries or surprise me at audit?" → entry. **Strike-through any backlog item this PR
closed, in the same commit** (don't delete — keep the closure note + date + SHA for
grep). Delete *speculative* backlog entries (no design/code basis) outright.

---

## 12. Review cadence

| Trigger | Reviewer role | Parallel? |
|---|---|---|
| Per PR, after commit, before merge | code-review + UX | yes |
| Every ~N PRs, or after a structural change | design-fidelity audit + architecture audit | dedicated branch |
| Tests fail / unexpected behavior | debugger (reactive) | standalone |
| Periodically | learnings consolidation | standalone |

**Subagent-driven execution (multi-task plans):** one implementer per task,
sequential on one branch (never parallel implementers — they conflict). After each
task, **two-stage review: spec-compliance first, then code-quality**; fix-loop to
green before task N+1; one final full-diff review after the last task. The plan file
is the source of truth — give each implementer its task text + scene-setting, and the
verification gates (`{{TYPECHECK_CMD}}`, pure-fn assertions) are part of spec
compliance. **Pre-execution sanity-check** every multi-task plan with three questions
before Task 1: *Does executing every task as written produce the stated goal? Which
task is load-bearing for the goal? What's verified only by the static gate (and thus
owes a runtime check)?*

**Review-agent roles** — keep a tight focus/ignore brief per role (a vague brief
yields noise). The overlay fills these in with the project's named agents:
- **code-review** — cross-file consistency, stale comments, dead code, input boundaries, a11y on touched UI.
- **UX** — tap targets, contrast, token drift, reachability, platform conventions.
- **delight** — loading/empty/error/success moments, microcopy (with an explicit "don't touch the serious surfaces" constraint).
- **debugger** — root cause not symptom; recent commits as first suspect; revert-vs-forward-fix.
- **build/architecture** — component shape, render cost at scale, state model.

**One discipline for all of them — trust but verify the agent's report.** A subagent
summary describes what it *intended*, not necessarily what's in the diff. Read the
actual changes before relaying "done."

---

## 13. When it goes wrong — rollback + escalation

- **A CRITICAL audit finding** blocks merge: fix-in-branch and re-review, or if the
  change is tangled, prefer a clean revert + retry over patching.
- **A bad merge already on the trunk:** `git revert <sha>` (for a squash-merge, that's
  the single squash commit) — forward-revert, don't force-push shared history.
- **Stop and escalate to the human when:** the plan itself looks wrong (not just a
  task), an irreversible/destructive or outward-facing action is implied, the goal is
  ambiguous in a way that changes what you build, or you've looped twice on the same
  failure without progress. Escalating early is cheaper than a confident wrong build.

---

## Tooling caveats (generalize per project)
A code-graph tool (`{{BLAST_RADIUS_TOOL}}`) answers *who-calls / blast-radius*
fast, but: it can't enforce *use-granular* rules (it sees imports, not usages — grep
those), can't see runtime composition, and isn't a type-checker (`{{TYPECHECK_CMD}}`
is authoritative). A prose/decision-history search (`{{MEMORY_TOOL}}`) is for *why*
questions; treat its inferred nodes as memory-joggers, verify before citing.
