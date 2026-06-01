# App-wide Fidelity Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan. **This is an audit, not a code change** — the normal implementer → spec-review → quality-review loop does NOT apply. Each "task" dispatches a read-only per-surface audit subagent; the synthesis task (Task 15) is the review/normalization layer. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a dated, sourced, prioritized 5-dimension finding-list across 14 portfolio-facing surfaces, written to a static audit snapshot AND flowed into `docs/next-session.md` as live backlog.

**Architecture:** 14 read-only per-surface deep-audit subagents (parallelizable — read-only, no file conflicts) dispatched in 4 weight-balanced batches, then 1 synthesis subagent that normalizes severity, detects cross-cutting patterns, writes both output files.

**Tech Stack:** Agent tool (general-purpose subagents), `fgq query` against the merged graph (`~/.graphify/fresh-greens-merged/`) for thesis-promise grounding, Figma MCP (`get_screenshot`) for fidelity where a node is cited, no test runner (audit produces docs).

**Spec:** [docs/superpowers/specs/2026-05-31-app-wide-fidelity-audit-design.md](../specs/2026-05-31-app-wide-fidelity-audit-design.md)

---

## Conventions

- **No code changes during the audit.** Subagents read + report. Only Task 15 (synthesis) writes files (the two output docs).
- **Branch:** `audit/app-wide-fidelity` (create at start).
- **Working directory:** `/Users/mylesashitey/code/fresh-greens`.
- **Parallelism:** per-surface audits are read-only → dispatch each batch's surfaces in a single message (multiple Agent tool calls). The controller collects all reports from a batch before starting the next.
- **No two-stage review per task.** Audit reports aren't spec-compliance-reviewed or code-quality-reviewed individually — the synthesis pass (Task 15) is the calibration/verification layer. The controller's only per-task check is a shape sanity-check (did the report come back with the required fields?).
- **Last-gate framing** (from the spec): every subagent tiers up when in doubt. There's no next audit.

---

## File structure

**Created by this plan (only Task 15 writes):**
- `docs/audits/2026-05-31-app-wide-fidelity-audit.md` — static snapshot (executive summary + cross-cutting patterns + 14 per-surface sections + per-dimension appendix)
- `docs/next-session.md` — modified: a new `## Audit 2026-05-31 — backlog flow-in` section appended

**Read-only inputs (the audit targets):** the 14 surface files + their sibling components/hooks (enumerated per task below).

---

## The canonical per-surface subagent prompt

Every Task 1–14 dispatches a `general-purpose` subagent with this prompt, substituting the **bracketed inputs** from the task's own row. Reproduce the full template each dispatch — do not abbreviate.

````
You are auditing ONE surface of Fresh Greens (React Native + Expo iPhone-first thesis navigation/safety app) as part of an app-wide fidelity audit. This is a READ-ONLY audit — do NOT change any code. Produce a structured finding-list.

**This is likely the LAST app-wide audit before the project goes to portfolio + thesis defense.** Tier up when in doubt (Minor→Important, Important→Critical). The cost of an over-flagged finding is a quick "defensible by:" note; the cost of a missed finding is a reviewer catching it first. Do not soft-pedal on the assumption a future pass will catch it — there is no future pass.

## Your surface: [SURFACE_NAME]

**Primary file:** [PRIMARY_FILE]
**Sibling files to read (the components/hooks this surface composes):** [SIBLING_FILES]

Read the primary file end-to-end first, then the siblings. Hold the whole surface in context before judging.

## The five dimensions

### 1. Polish
Visual nits, copy quality, spacing/token discipline, micro-interactions, haptic moments, transition feel. The "would a portfolio reviewer notice this and form a small negative impression?" bar. Examples of real findings: a spread typography token with a `fontWeight` override (anti-pattern); raw `rgba()`/hex instead of a `colors.*` token; raw spacing ints instead of `spacing.*`; a missing pressed-state; a haptic that's identical to an unrelated action.

### 2. Fidelity
Read the primary file's header docblock for a cited Figma node (format like `Figma node (v2): 1133:13908`). If a node IS cited: attempt to fetch it via the Figma MCP `get_screenshot` tool (ToolSearch for `mcp__figma__get_screenshot` if it's not already loaded; extract fileKey `7DDh6c7tk7OKF4WiA7pEkp` and the nodeId from the citation). Download + view the PNG, compare to the shipped surface, report drift. If the MCP is unavailable, report fidelity as "NOT ASSESSED — Figma MCP unavailable" (do not guess). If NO node is cited (some surfaces were designed collaboratively in-conversation, e.g. the HomeBrowseSheet multi-row, /legal), report fidelity as "N/A — no canonical Figma node" and move on.

### 3. Accessibility
Dynamic Type (AX5) via `dynamicType()`/`relaxedLineHeight()` from `theme/dynamic-type.ts` — body copy needs both, single-line headers need `dynamicType` only. `useReduceMotion()` coverage on any custom animation. VoiceOver flow order. `accessibilityRole` + `accessibilityLabel` completeness on every interactive element. Two-line rows need composite "Title. Clarifier." labels. Decorative elements need `accessibilityElementsHidden` + `importantForAccessibility="no"`. Color contrast (WCAG AA: 4.5:1 normal text, 3:1 large/UI). Tap targets ≥44pt. The canonical AX5 reference is `app/pulled-over.tsx`. Prior AX5 learnings live in `docs/learnings.md` under `ax5/safety-surfaces` — read that entry's policy (dynamicType broadly; relaxedLineHeight multi-line only; lift fixed `height` to `minHeight` wherever text scales).

### 4. Reliability / failure modes
Probe each: **no data / cold first-launch** (empty states designed, or blank box?); **lots of data** (list virtualization, layout break at high counts); **permission denied** (Location/Contacts/Mic refused — graceful or stall?); **network down** (Mapbox/AsyncStorage/route-fetch failure — inline error, silent fail, or crash?); **mid-loading** (skeleton/spinner/flicker?); **mid-error** (Alert/inline/toast/nothing?); **app-kill resilience** (does the surface restore correctly — active share session, in-progress recording, mid-trip?). Failure-mode UX is categorically distinct from polish.

### 5. Concept-execution (three sub-lenses)
- **Brand voice & tone** — does copy + visual register read as Fresh Greens (honest, warm, plainspoken — "You're not alone" / "Hang tight" / "On it.")? Or lapse into generic-product voice ("Coming soon", clinical labels)?
- **Thesis-promise delivery** — does the surface deliver the user-promise the thesis stated? BEFORE judging this lens, run `fgq query "<seed>"` for EACH of these seeds: [FGQ_SEEDS]. Use SHORT keyword seeds, never sentences (the tokenizer is brittle on prose). Treat returned chat/thesis nodes as the *claim* the surface should deliver on — but as memory-joggers, not fact; verify against the actual code + `docs/learnings.md` before citing. LOG which seeds you ran in your report so synthesis can verify coverage.
- **Honesty of disclosure** — enumerate every claim the surface's UI makes (in copy, labels, status indicators) and verify each against actual behavior. Known class: "{name} is being notified" while v1 doesn't transmit; "Saves your journey periodically" (v1 doesn't); "Safest route" (does it actually weight safety?). For each honesty finding, give the honest framing the surface could adopt instead ("swap to X" / "qualify with Y").

## Severity rubric

- **Critical** — breaks UX, violates a project rule (reserved-color, anti-slop), fails an a11y requirement, or actively misrepresents the app (shipping "coming soon" for a shipped feature). MUST fix before portfolio.
- **Important** — a portfolio reviewer / thesis panel would notice and flag it. Tightenable without major refactor. SHOULD fix.
- **Minor** — polish nit you can defend leaving. Flag with "defensible by:" reasoning.
- **Note** — observation worth recording, not actionable. (Synthesis keeps these in the audit doc; they do NOT flow to next-session.md.)

**Every finding MUST include a defensibility note** — the answer if a thesis-defense panel asked "why is this still like this?" It must be thesis-grounded (a specific design decision tied to a thesis claim, scope constraint, or principle), NOT "it works" or "ran out of time." If the only honest answer is the latter, the finding is genuinely actionable — tier it Critical or Important, not Minor.

## Output format

Return EXACTLY this structure (markdown):

```
## Surface: [SURFACE_NAME]

**Context:** <1-paragraph: what this surface does in the app, who hits it, when>

**fgq seeds run:** <list the seeds you queried + 1-line gist of what each surfaced>

**Fidelity status:** <drift findings | "NOT ASSESSED — Figma MCP unavailable" | "N/A — no canonical Figma node">

**Findings:**
- [F1 | <Critical|Important|Minor|Note> | <Polish|Fidelity|A11y|Reliability|Concept>] <one-line title>
  - Where: <file:line>
  - What: <description>
  - Fix: <concrete suggested fix>
  - Defensible by: <thesis-grounded answer, or "NOT DEFENSIBLE — actionable" if there's no good answer>
- [F2 | ...] ...

**Surface verdict:** <1-2 sentences: is this surface portfolio-ready? what's the single highest-priority thing?>
```

If a dimension surfaces zero findings, say so explicitly ("Reliability: no findings — empty/error/permission states all handled at file:line"). Silence is ambiguous; absence-of-findings must be a positive statement.

Be thorough but precise. Cite file:line for everything. Under 900 words.
````

---

## Surface input table

Each task below substitutes its row into the template. Sibling-file lists were extracted from each route's local imports; the subagent reads the route + these.

| # | SURFACE_NAME | PRIMARY_FILE | SIBLING_FILES | FGQ_SEEDS |
|---|---|---|---|---|
| 1 | /home | `app/home.tsx` | `components/HomeBrowseSheet.tsx`, `components/UserLocationMarker.tsx`, `components/EdgeIndicator.tsx`, `components/StateCard.tsx`, `components/SearchBar.tsx`, `hooks/useWeather.ts` | `home`, `route`, `daylight`, `community` |
| 2 | /search | `app/search.tsx` | `components/SearchBar.tsx`, `components/StateCard.tsx`, `hooks/useRecentSearches.ts`, `hooks/useSavedPlaces.ts` | `search`, `community`, `recommendations` |
| 3 | /en-route | `app/en-route.tsx` | `components/LaneStrip.tsx`, `components/Hazard.tsx`, `components/RouteComparisonSheet.tsx`, `components/FuelStopsSheet.tsx`, `components/EnRouteCarMarker.tsx`, `components/LiveSafetySheet.tsx` | `en-route`, `navigation`, `turn`, `lane` |
| 4 | /safety | `app/safety.tsx` | `components/DragHandle.tsx`, `hooks/useShareSession.ts`, `hooks/useTrustedContact.ts` | `safety`, `pulled-over` |
| 5 | /pulled-over | `app/pulled-over.tsx` | `components/TrustedContactStatus.tsx`, `hooks/useDisclosureDuty.ts`, `hooks/useRecordings.ts`, `hooks/usePulseOpacity.ts` | `pulled-over`, `recording`, `firearm`, `trusted contact` |
| 6 | /roadside | `app/roadside.tsx` | `components/NotifyingPulse.tsx`, `components/Button.tsx`, `hooks/useRoadsideProfile.ts` | `roadside` |
| 7 | /unfamiliar | `app/unfamiliar.tsx` | `components/LifelineModal.tsx`, `components/NotifyingPulse.tsx`, `hooks/useShareSession.ts`, `lib/api/places.ts` | `unfamiliar`, `lost`, `share location` |
| 8 | /share-location | `app/share-location.tsx` | `components/NotifyingPulse.tsx`, `components/LiveSafetySheet.tsx`, `hooks/useShareSession.ts` | `share location`, `trusted contact` |
| 9 | /trip-summary | `app/trip-summary.tsx` | `components/Button.tsx`, `components/DragHandle.tsx`, `hooks/useRegularDestinations.ts` | `trip summary`, `arrival`, `regular destination` |
| 10 | /menu | `app/menu.tsx` | `components/PageControl.tsx`, `hooks/usePreferences.ts`, `hooks/useUser.ts` | `menu`, `preferences`, `zone flags` |
| 11 | /fuel | `app/fuel.tsx` | `hooks/useFuelProfile.ts`, `lib/notifications.ts` | `fuel`, `refuel` |
| 12 | /recordings | `app/recordings.tsx` | `components/Button.tsx`, `hooks/useRecordings.ts` | `recordings`, `audio` |
| 13 | /trusted-contact-setup | `app/trusted-contact-setup.tsx` | `hooks/useTrustedContact.ts`, `lib/api/trusted-contact.ts` | `trusted contact` |
| 14 | /legal | `app/legal.tsx` | `docs/legal/privacy.md`, `docs/legal/terms.md`, `docs/legal/limitations.md` | `privacy`, `disclosure`, `simulated` |

---

## Task 0: Branch setup

- [ ] **Step 1: Create the audit branch**

```bash
cd /Users/mylesashitey/code/fresh-greens && git checkout -b audit/app-wide-fidelity && git branch --show-current
```

Expected: `audit/app-wide-fidelity`

- [ ] **Step 2: Confirm the audit-output directory will exist**

`docs/audits/` does not exist yet. Task 15 creates it (the `Write` tool auto-creates parent dirs). No action now — just noted.

---

## Tasks 1–14: Per-surface audits (dispatch in 4 batches)

Per-surface audits are read-only — dispatch each batch's surfaces in a SINGLE message (one Agent call per surface, all in one turn). Collect all reports from a batch before starting the next. Store each returned report verbatim — Task 15 needs the full text.

**Batch A (heavy surfaces, ~2000+ lines each — dispatch 3 in parallel):** Tasks 1 (/home), 3 (/en-route), 5 (/pulled-over).

**Batch B (medium — dispatch 4 in parallel):** Tasks 2 (/search), 6 (/roadside), 10 (/menu), 12 (/recordings).

**Batch C (medium — dispatch 4 in parallel):** Tasks 7 (/unfamiliar), 9 (/trip-summary), 13 (/trusted-contact-setup), 14 (/legal).

**Batch D (light — dispatch 3 in parallel):** Tasks 4 (/safety), 8 (/share-location), 11 (/fuel).

- [ ] **Task 1 — /home:** Dispatch the canonical template with row 1's inputs. `subagent_type: general-purpose`.
- [ ] **Task 2 — /search:** Dispatch with row 2's inputs.
- [ ] **Task 3 — /en-route:** Dispatch with row 3's inputs.
- [ ] **Task 4 — /safety:** Dispatch with row 4's inputs.
- [ ] **Task 5 — /pulled-over:** Dispatch with row 5's inputs.
- [ ] **Task 6 — /roadside:** Dispatch with row 6's inputs.
- [ ] **Task 7 — /unfamiliar:** Dispatch with row 7's inputs.
- [ ] **Task 8 — /share-location:** Dispatch with row 8's inputs.
- [ ] **Task 9 — /trip-summary:** Dispatch with row 9's inputs.
- [ ] **Task 10 — /menu:** Dispatch with row 10's inputs.
- [ ] **Task 11 — /fuel:** Dispatch with row 11's inputs.
- [ ] **Task 12 — /recordings:** Dispatch with row 12's inputs.
- [ ] **Task 13 — /trusted-contact-setup:** Dispatch with row 13's inputs.
- [ ] **Task 14 — /legal:** Dispatch with row 14's inputs.

**Per-task shape check** (the only per-task review): when a report comes back, confirm it has `## Surface:`, `**Context:**`, `**fgq seeds run:**`, `**Fidelity status:**`, `**Findings:**`, and `**Surface verdict:**`. If a section is missing (especially `fgq seeds run` — the most-likely-skipped), re-dispatch that one surface with an explicit reminder to include it. Don't proceed to synthesis with a malformed report.

---

## Task 15: Synthesis + output

**Files (this task WRITES):**
- Create: `docs/audits/2026-05-31-app-wide-fidelity-audit.md`
- Modify: `docs/next-session.md`

- [ ] **Step 1: Dispatch the synthesis subagent**

Dispatch a `general-purpose` subagent with the full text of ALL 14 per-surface reports pasted inline, plus this prompt:

````
You are the synthesis layer of Fresh Greens' app-wide fidelity audit (likely the LAST before portfolio + thesis defense). Below are 14 per-surface audit reports. Your job: normalize, find cross-cutting patterns, and write two output files.

[PASTE ALL 14 REPORTS HERE]

## Your tasks

1. **Severity normalization.** The 14 reports were written by 14 separate auditors. Calibrate severity across them: if surface A tiered something Important that surface B tiered Minor for the same underlying pattern, decide the correct tier and re-grade both. Bias toward the higher tier (last-gate framing). Note any re-grades.

2. **Cross-cutting pattern detection.** Any pattern appearing on ≥3 surfaces gets promoted to a project-level finding. Enumerate the affected surfaces. Known candidates to check for explicitly: the conditional-setState-during-render hydration anti-pattern (was found in /fuel + /roadside-setup before); spacing-token drift in settings-style screens; missing `dynamicType` on non-/safety surfaces; `router.back()` without `canGoBack()` fallback; honesty-of-disclosure gaps around simulated sharing.

3. **fgq coverage check.** Each report should list the fgq seeds it ran. Flag any surface whose concept-execution findings look ungrounded (no seeds run, or seeds that returned nothing substantive). Note these as "thesis-promise NOT verified for <surface>" so the user knows which concept judgments are softer.

4. **Write `docs/audits/2026-05-31-app-wide-fidelity-audit.md`** with this structure:
   - `# App-wide Fidelity Audit — 2026-05-31`
   - `## Executive summary` — overall state per dimension (1 line each: polish, fidelity, a11y, reliability, concept); top 5 surfaces by finding density; **Must-fix-before-portfolio shortlist (≤8 Critical/Important items, ranked)**; **Defensible-imperfect-on-purpose list** (the Minor findings with strong defensibility notes).
   - `## Cross-cutting patterns` — each ≥3-surface pattern with affected surfaces enumerated.
   - `## fgq coverage notes` — which surfaces have verified vs unverified thesis-promise judgments.
   - `## Per-surface findings` — all 14 surfaces, each with its Context + normalized Findings + Surface verdict.
   - `## Per-dimension appendix` — all findings re-grouped by the 5 dimensions, for traceability.

5. **Append to `docs/next-session.md`** a new section `## Audit 2026-05-31 — backlog flow-in`. Include ONLY Critical + Important + Minor findings (NOT Note-tier). Organize by surface. Each entry one bullet, citing the audit doc's finding id, e.g.:
   `- **[/home] Daylight strip lacks accessibilityRole** — [Audit 2026-05-31 §/home F4, Important] add accessibilityRole="none" at home.tsx:LINE.`
   These are live backlog — future PRs strike them through (workflow step 11.5). Do NOT duplicate the full finding text; cite back to the audit doc for detail.

Use the project's tone in prose: plainspoken, specific, no filler. Report counts honestly (don't inflate or deflate). When you re-grade or promote a finding, say so.
````

- [ ] **Step 2: Verify the two output files**

Run: `ls -la docs/audits/2026-05-31-app-wide-fidelity-audit.md && grep -c "^- \*\*\[" docs/next-session.md`

Expected: the audit file exists; next-session.md gained the flow-in bullets. Read the executive summary to confirm it's coherent (per-dimension state lines + a must-fix shortlist + cross-cutting patterns are all present).

- [ ] **Step 3: Commit**

```bash
cd /Users/mylesashitey/code/fresh-greens && git add docs/audits/2026-05-31-app-wide-fidelity-audit.md docs/next-session.md && git commit -m "docs(audit): app-wide fidelity audit findings + backlog flow-in"
```

---

## Task 16: Learnings + merge

- [ ] **Step 1: Append a learnings entry**

Add to the top of `docs/learnings.md` (newest-at-top), a `## audit/app-wide-fidelity` entry capturing what the audit *methodology* taught (not the findings themselves — those live in the audit doc). Candidate observations: did A+synthesis surface cross-cutting patterns the per-surface passes missed? Did the fgq-grounding requirement change the quality of concept-execution findings vs prior vibe-based audits? Was the last-gate tier-up framing worth it, or did it inflate noise? Only write bullets that are genuinely generalizable (per workflow step 11's bar).

- [ ] **Step 2: Commit the learnings entry**

```bash
cd /Users/mylesashitey/code/fresh-greens && git add docs/learnings.md && git commit -m "docs: audit/app-wide-fidelity methodology learnings"
```

- [ ] **Step 3: Squash-merge to main**

This is a docs-only branch (audit findings + backlog + learnings). Per the user's standing merge-to-main-after-clean preference:

```bash
cd /Users/mylesashitey/code/fresh-greens && git checkout main && git merge --squash audit/app-wide-fidelity && git commit -m "docs(audit): app-wide fidelity audit — 5-dimension finding-list across 14 surfaces

Pre-portfolio audit. 14 read-only per-surface deep audits + synthesis.
Findings in docs/audits/2026-05-31-app-wide-fidelity-audit.md; live
backlog flowed into docs/next-session.md (workflow step 11.5 governs
strike-through as fixes land).

Spec: docs/superpowers/specs/2026-05-31-app-wide-fidelity-audit-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>" && git branch -D audit/app-wide-fidelity
```

- [ ] **Step 4: Present the must-fix shortlist to the user**

Surface the executive summary's "must-fix-before-portfolio" shortlist in the response, so the user can immediately decide which findings become fix-PRs before Phase 5. The audit produces the list; the user drives what gets fixed.

---

## Self-review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| 5 dimensions per surface | Canonical template (Tasks 1–14) |
| Concept-execution 3 sub-lenses | Template dimension 5 |
| Reliability failure-mode probes | Template dimension 4 |
| Fidelity self-discovery from docblock | Template dimension 2 |
| fgq-grounded thesis-promise | Template dimension 5 + per-task FGQ_SEEDS |
| Severity rubric + defensibility note | Template severity section |
| 14 surfaces enumerated | Surface input table |
| A+synthesis methodology | Tasks 1–14 + Task 15 |
| Severity normalization | Task 15 step 1 (2) |
| Cross-cutting pattern detection (≥3 surfaces) | Task 15 step 1 (2) |
| Static audit doc output | Task 15 step 1 (4) |
| Flow into next-session.md | Task 15 step 1 (5) |
| Note-tier stays out of next-session.md | Template + Task 15 (5) |
| Last-gate tier-up framing | Template top + Task 15 |
| fgq seeds logged for coverage verification | Template output format + Task 15 (3) |

No gaps.

**Placeholder scan:** the bracketed `[SURFACE_NAME]` etc. are intentional substitution slots, resolved by the surface input table — not placeholders in the plan-failure sense (every value is concretely specified in the table). The synthesis prompt's `[PASTE ALL 14 REPORTS HERE]` is an explicit controller action. No "TBD"/"handle errors"/vague steps.

**Consistency:** surface count is 14 throughout (template, table, batches, synthesis). The `audit/app-wide-fidelity` branch name and the `docs/audits/2026-05-31-app-wide-fidelity-audit.md` path are consistent across Tasks 0, 15, 16. The 4 batches cover all 14 surfaces exactly once (A: 1,3,5 / B: 2,6,10,12 / C: 7,9,13,14 / D: 4,8,11 = 14 unique). Severity tiers (Critical/Important/Minor/Note) consistent between template and synthesis.
