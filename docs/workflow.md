# Building a screen — workflow

The recipe we landed on while building Welcome (Figma `825:3162`). Follow it for each new screen so the rhythm becomes muscle memory.

## 1. Start clean
```
git checkout main
git pull
git checkout -b feat/<screen-name>
```
Branch names mirror the screen: `feat/welcome`, `feat/get-started`, `feat/permissions`.

## 2. Pull the design
Use the Figma MCP server. Pass the node ID for the screen:
```
get_design_context(nodeId="825:3162", fileKey="7DDh6c7tk7OKF4WiA7pEkp")
```
The output is React+Tailwind reference code — **do not paste it as-is**. It's a guide, not the answer. Adapt to the project's stack and tokens.

## 3. Decide scope of v1
Most screens have decorative illustrations or assets that aren't worth recreating layer-by-layer. Default rule:
- **In scope:** layout, copy, interactive elements, color tokens, accessibility props.
- **Deferred to a follow-up PR:** illustrative SVGs, icons, animations.

Mark deferred items with a `TODO:` comment so they don't get lost.

**Blast-radius check for shared changes.** For changes to shared components, theme tokens, or prop signatures, run `graphify affected "<symbol>"` to enumerate downstream callers up front. A new prop with 3 callers is a scoping decision (backward compat), not a code-reviewer finding. Caveat: edges are static-import only — Context consumers and render-prop composition are invisible to the tool, so confirm with grep when the API is context-driven.

## 4. Update theme if needed
Before writing a hex color, font size, or spacing value inline — check `theme/`. If it doesn't exist, add it to the right file in `theme/` first, then consume it from the screen. **Never inline a design value.**

**If you added a color token to `theme/colors.ts`, mirror it into the design specimen** (`fresh-greens-specimen/index.html` — both the `:root` block and the visible swatch grid) and commit + push that sibling repo. The specimen is README-linked, so a missing token leaves portfolio visitors on a stale design system. Run `npm run check:specimen` to catch drift — it fails on any theme hex missing from the specimen (and skips cleanly if the sibling repo isn't cloned). This is the enforcement that prevents the hand-mirror from silently drifting; the Step 13 pre-merge audit runs it too.

## 5. Build, iterate on phone
Save → Expo Go reloads on phone within ~1s. Tweak numbers (`marginBottom`, `width`, `borderRadius`) directly until it looks right. Don't be precious about reverting — the loop is the point.

## 6. Self-review the diff before committing
Scan your own changes in Cursor's source-control panel. Catch:
- Hardcoded values you forgot to tokenize
- Stray `console.log`s
- Comments you meant to delete
- Imports for things you ended up not using

## 7. Commit + push
```
git add <specific files>
git commit -m "feat: <screen> layout (figma <node-id>)"
git push -u origin feat/<screen-name>
```
- Use conventional-commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- Include the Figma node ID in parens — future-you searching the log will thank you.
- Avoid `git add .` — name files explicitly.

## 8. Open the PR on GitHub
Description template:
```
## What
<one-line summary>

## Notable choices
- <decision worth remembering>
- <ditto>

## Out of scope
- <deferred to a future PR>
```

## 9. Self-review the diff on GitHub
Different mode of reading than Cursor — easier to spot mistakes when the diff is rendered as a webpage. Worth doing every time.

## 10. Merge, sync, clean up

**Default rhythm (added 2026-05-19):** merge once Step 13's pre-merge audit is clean, OR once substantive findings have been addressed in the same branch. The audit is the gate; don't queue up a separate wait-for-explicit-approval step on top. Squash-merge with `--delete-branch`. Surface what shipped + pull main + report. The author reviews on main and flags issues as follow-ups.

Hold the merge only when: (1) the audit surfaces critical findings that the author needs to triage, (2) the author has explicitly asked to wait ("don't merge until I device-test"), (3) destructive remote ops outside the merge itself (force-push to main, deleting branches with unmerged work).

Docs-only PRs that skip the audit (per Step 13's "no code surface" exception) still merge by default.

Mechanics:
```
gh pr merge <num> --squash --delete-branch
git checkout main
git pull --ff-only
```

The locally-installed `post-commit` + `post-checkout` git hooks re-run `graphify update .` automatically, so the codebase graph stays current without a manual step. If a graphify result feels suspiciously sparse, sanity-check with `head -1 graphify-out/GRAPH_REPORT.md` — the title carries the build date.

## 11. Add a learnings entry
If this PR taught you something — a new RN quirk, a layout trick, a tooling gotcha — add a one-liner to `docs/learnings.md`. Future-you reading them weekly is how you check that the work is sticking.

Bias toward writing one. The check is "did something here take two tries to get right, or surprise me at audit?" If yes, it earns an entry. Standard refactors, copy changes, and mechanical token swaps don't unless they uncovered a recurring habit worth naming. Append before the audit pass (Step 13) so a future "no learning, skipped" decision is conscious rather than accidental. Format mirrors the existing entries: `## branch-name (YYYY-MM-DD)` heading + 1–3 bullets each ending with "Worth keeping: <generalizable rule>" so the entry transcends the specific PR.

**Before writing, check for recurrence.** Run `fgq query "<short-seed>"` (NOT a sentence — the tokenizer is brittle on prose) against the merged graph to surface prior entries and chat-transcript context on the same surface. Recurrence → note in the existing entry rather than duplicating. Empty → fresh entry. Treat fgq chat/thesis nodes as memory-joggers, not fact-claims; verify against actual code or `docs/learnings.md` before citing.

## 11.5. Strike-through closed backlog entries in `docs/next-session.md`
If this PR closed any item in `docs/next-session.md` — wholly or partially — strike-through that line **in the same commit that closes it** (or in a follow-up commit on the same branch). Per CLAUDE.md convention: strike-through (`~~...~~`), don't delete; keep the closure note + a date + the closing commit's SHA so future readers can grep the context. Example:

```
~~**Foo widget should do X**~~ — ✅ shipped 2026-05-31 (`abc1234`); now Y at file.ts:LINE.
```

**Why this exists:** without it, the file drifts. We've caught case-after-case where the backlog claimed work was open that had shipped weeks earlier (Round 4 multi-row, voice button removal, report v2, community-signal icons — all stale on 2026-05-31). The pattern is universal: ship the feature → write the learnings entry → move on → forget the backlog line. Closing the entry in the same PR is the only durable fix.

Also worth doing in this step: if reading the backlog flagged a *speculative* entry (something half-remembered from ideation, with no design or code basis), **delete it outright** with a one-line PR note. Stale aspirations rot harder than stale completions.

## 12. Periodic Figma fidelity audit (every ~5 PRs, or after any heavy one)

Visual drift compounds quietly. Every fifth PR — or earlier if the previous PR was structural (new screen, refactor, design-system change) — run a dedicated audit pass before starting the next feature:

1. Branch `chore/figma-fidelity-audit-N` (incrementing `N` per audit). Source the screen list from `graphify-out/GRAPH_REPORT.md` community hubs (e.g. community 6 is the design-system + onboarding cluster) so the audit covers every shipped screen, not just the ones the auditor remembers. The Figma fetch + eyeball comparison still drives findings.
2. For each shipped screen, pull its Figma node via `get_design_context` and diff against the implementation. Look for:
   - Token drift — inline hex/rgba/font sizes that should reference `theme/`.
   - Spacing drift — gap/padding values that no longer match Figma.
   - Tap-target violations (44pt iOS HIG minimum; `hitSlop` is fine).
   - Reserved-color rule violations (see `.cursorrules`).
   - Modal padding rules (16pt for tab/grid modals, 32pt for static-content).
   - Responsive sizing — hardcoded widths that fail on wider iPhones.
3. Capture every finding before fixing — easy to wander mid-fix and miss the next one.
4. Fix in the same branch. One audit branch, one PR.
5. Append a learnings entry covering recurring misses (these are the highest-leverage ones — a recurring miss is a habit; fixing the habit beats fixing the symptom).

Audits don't ship features but they reset the baseline — every subsequent feature starts from a fidelity floor instead of a slow-eroding one. Track audit cadence in commit history (`git log --oneline | grep audit`) so it's easy to tell when the next one is due.

## 13. Subagent reviews at regular intervals

Five Claude subagents are installed at `~/.claude/agents/` (user-level, available across all projects). Use them as a review layer woven into the PR rhythm, not a one-off. **Note:** subagent types load at session start — a freshly-installed agent only becomes invokable in the next conversation.

### Subagent-driven implementation (multi-task plans)

When executing a written plan from `docs/superpowers/plans/*.md` (after `writing-plans`), use the **subagent-driven-development** skill in the same session:

1. **Branch** — `feat/<feature>` off `main` before Task 1 (see plan header).
2. **One implementer subagent per task** — sequential, not parallel implementers (avoids merge conflicts on the same branch).
3. **Two-stage review after each task** (before starting the next):
   - **Spec compliance** — diff matches the task + linked spec section; no missing requirements, no unrequested scope.
   - **`code-reviewer`** — cross-file consistency, dead code, boundaries, a11y on touched UI; use the brief template under `code-reviewer` below and `graphify affected "<symbol>"` for blast radius.
4. **Fix loops** — if either review finds issues, re-dispatch the implementer (or fix in-session), then re-run the failed review until ✅. Do not start Task N+1 with open review findings.
5. **Final pass** — after all tasks: one more `code-reviewer` on the full branch diff (plus `mobile-ux-optimizer` if the plan touched screens), then Step 9–10 merge rhythm.

Cursor equivalents: `subagent_type: "generalPurpose"` for implementation tasks; `subagent_type: "code-reviewer"` for per-task and final review. The plan file is the source of truth — paste the full task text into each implementer prompt; do not ask the subagent to read the plan from disk.

**Verification gates from the plan** (e.g. `npx tsc --noEmit`, `node scripts/verify-corridor-planner.mjs`) are part of spec compliance — the implementer runs them before reporting DONE.

### Cadence

| Trigger | Agent(s) | Run in parallel? |
|---|---|---|
| Per PR, after commit, before merge | `code-reviewer` + `mobile-ux-optimizer` | Yes |
| End of each Round (every 3–5 PRs) | `whimsy-injector` | Standalone |
| Tests fail / unexpected behavior | `debugger` | Standalone, reactive |
| Building a new component or perf work | `frontend-developer` | Standalone, situational |

### What to focus each agent on

The default instinct for a subagent is to over-review. A tight brief beats a vague one. For each agent below, the **Focus on** list is what to ask for; the **Ignore** list is what to explicitly tell it to skip so it doesn't dilute the review with noise we've already accepted.

#### `code-reviewer` — per-PR audit
**Focus on:**
- Cross-file consistency the model can't see in a single edit (e.g., a new token vs. existing tokens, a new pattern vs. existing patterns)
- Stale comments — comments that referred to behavior that changed in the same diff
- Dead code, unused imports, half-finished implementations
- Input boundaries — user-supplied strings flowing into URLs, regex, SQL-ish queries (we have proxy/api routes worth this scrutiny)
- Comments that say what instead of why
- Accessible feedback patterns — new Pressables need `accessibilityRole` + `accessibilityLabel`; new loading states need `accessibilityState={{ busy: true }}`; state changes visible to sighted users (route loaded, mode switch, error) need a VoiceOver announcement (`announceForAccessibility` or `accessibilityLiveRegion`); new Images need `accessibilityLabel` or explicit `accessible={false}` if decorative; new TextInputs need `accessibilityLabel`

**Ignore:**
- Pre-existing TS errors from missing `@expo/vector-icons` types and `@vercel/node` types — these are environment-level, not the PR's fault
- Style nits in files the PR didn't touch
- "Add tests" suggestions unless the change is a pure-function lib (no React Native test infra in this repo yet)

**Brief template:** "Review the diff on branch X. Cross-file impact from graphify: `<paste output of `graphify affected <file>` for each non-test file in the diff>`. Focus: cross-file consistency, stale comments, boundary inputs. Ignore: pre-existing missing-module TS errors, untouched files."

#### `mobile-ux-optimizer` — per-PR UI audit
**Focus on:**
- Tap targets — 44pt iOS HIG minimum on the *painted* surface (not just `hitSlop`)
- Touch contrast in real lighting (we have explicit brand-exception comments where freshgreen sits below WCAG AA; check it doesn't proliferate)
- Theme drift — inline hex/rgba/spacing values vs. `theme/colors.ts`, `theme/typography.ts`, `theme/shadows.ts`
- Thumb-reachability on a 6.7" iPhone (top-left corners are far; primary actions should sit lower)
- Modal padding rules from `.cursorrules` (16pt for tab/grid modals, 32pt for static-content)

**Ignore:**
- "Add tablet breakpoints" suggestions — this is iPhone-first; tablet is out of scope
- Web-specific patterns (hover states, cursor changes) — we're a native app
- Animation perf concerns on `LayoutAnimation` — we already audit Reduce Motion separately

**Brief template:** "Review the UI changes on branch X for mobile fit. Files to scan for theme drift: `<paste output of `graphify affected colors` (and `typography`, `spacing`, `shadows`, `interaction` if the PR touches them)>`. Focus: tap targets, theme drift, .cursorrules conformance. Ignore: tablet/web concerns."

#### `whimsy-injector` — end-of-Round audit
**Focus on:**
- Loading/empty/error states — these are where delight differentiates
- Success moments — was a meaningful action celebrated? (e.g., submitting a community report, completing the safety flow)
- Microcopy — generic strings ("Submit," "Confirm," "Loading…") that could carry voice
- Easter eggs for power users — long-press, shake-to-X, three-tap secrets

**Ignore:**
- Whimsy that interrupts the safety flow — `/pulled-over` is emotionally serious; no confetti, no jokes. Document this constraint in the brief so the agent doesn't propose stress-inappropriate suggestions.
- Animations that would conflict with Reduce Motion
- Changes that require new SVG assets we don't have yet

**Brief template:** "Audit the home browse + recommendation surfaces (NOT the safety/pulled-over flow — that surface is intentionally serious) for delight opportunities. Loading/empty/success moments, microcopy. Constraint: every animation must have a Reduce Motion path."

#### `debugger` — reactive
**Focus on:**
- Root cause, not symptom — "the tap doesn't fire" is the symptom; "the PanResponder claims the gesture but the state update doesn't register because Y" is the cause
- Recent commits as the first suspect (we've had two regressions where the previous PR was the cause: the live-drag broke tap-to-toggle, and the Phosphor swap missed the in-repo SVGs)
- Whether the fix should land as a revert vs. a forward-fix — sometimes a clean revert + retry is cheaper than patching a tangled change

**Ignore:**
- N/A — when invoked, give it the full error context and trust its triage

**Brief template:** "Reproducing X breaks Y. Recent commit is Z. Find the root cause and propose either a forward-fix or a revert; don't patch the symptom."

#### `frontend-developer` — situational
**Focus on:**
- New component structure and the right composition (when adding non-trivial UI)
- Render-cost concerns when a list grows (e.g., the recommendation carousel, the report markers cluster)
- State-shape decisions for new features (multi-row recs in Round 4 will benefit here)

**Ignore:**
- Bundle-size and code-split suggestions — this is a React Native app, not a web bundle
- SSR/SSG patterns — not applicable

**Brief template:** "Designing X. Constraints: React Native + Expo, iPhone-first. Propose component shape and state model; flag any rendering perf risks at the listed scale."

### One discipline that applies to all of them

**Trust but verify the agent's report.** Subagent summaries describe what they *intended* to find or do, not necessarily what's in the diff. When an agent proposes edits, read the actual changes before relaying "this is done" to the user. The two regressions in this project's history both came from accepting an intent-summary as a fact-summary.

**Where graphify is the wrong tool.** It cannot enforce the reserved-color rule — edges are import-granular, not use-granular, so it can't tell "imports `colors`" from "uses `colors.orange` for a non-hazard CTA." Use `rg "colors\.(orange|red|yellow|pink|navy)"` for that rule. It cannot see runtime composition (Context consumers, render props, children-as-function) — static imports only. It is not a type-checker; `tsc` remains authoritative. And its `query` command is brittle on prose — for "how does X work" or "why did we choose Y," read source or use `fgq query "<short-seed>"` against the merged graph.
