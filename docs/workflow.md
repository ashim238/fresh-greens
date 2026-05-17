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

## 4. Update theme if needed
Before writing a hex color, font size, or spacing value inline — check `theme/`. If it doesn't exist, add it to the right file in `theme/` first, then consume it from the screen. **Never inline a design value.**

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
On GitHub: **Merge pull request** → **Confirm**. Optionally delete the branch.

Locally:
```
git checkout main
git pull
git branch -d feat/<screen-name>
```

## 11. Add a learnings entry
If this PR taught you something — a new RN quirk, a layout trick, a tooling gotcha — add a one-liner to `docs/learnings.md`. Future-you reading them weekly is how you check that the work is sticking.

## 12. Periodic Figma fidelity audit (every ~5 PRs, or after any heavy one)

Visual drift compounds quietly. Every fifth PR — or earlier if the previous PR was structural (new screen, refactor, design-system change) — run a dedicated audit pass before starting the next feature:

1. Branch `chore/figma-fidelity-audit-N` (incrementing `N` per audit).
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

**Ignore:**
- Pre-existing TS errors from missing `@expo/vector-icons` types and `@vercel/node` types — these are environment-level, not the PR's fault
- Style nits in files the PR didn't touch
- "Add tests" suggestions unless the change is a pure-function lib (no React Native test infra in this repo yet)

**Brief template:** "Review the diff on branch X. Focus: cross-file consistency, stale comments, boundary inputs. Ignore: pre-existing missing-module TS errors, untouched files."

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

**Brief template:** "Review the UI changes on branch X for mobile fit. Focus: tap targets, theme drift, .cursorrules conformance. Ignore: tablet/web concerns."

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
