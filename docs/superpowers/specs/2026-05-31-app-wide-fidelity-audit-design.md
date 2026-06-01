# App-wide Fidelity Audit — Design Spec

**Date:** 2026-05-31
**Purpose:** Establish the state of Fresh Greens against four quality dimensions (polish, fidelity, accessibility, concept-execution) before pivoting to Phase 5 (portfolio + submission work).
**Output shape:** A trusted finding-list, not a fix-PR.

**Five dimensions** (polish / fidelity / accessibility / reliability / concept-execution). Concept-execution has three sub-lenses: brand voice, thesis-promise delivery, honesty-of-disclosure.

## Goal

Produce a **dated, sourced, prioritized finding-list** covering ~13 portfolio-facing surfaces across five dimensions, so the user can defend each surface to a portfolio reviewer and know exactly what's still imperfect on purpose. Findings flow into `docs/next-session.md` as live backlog; the audit doc itself is a static snapshot.

**Risk posture: this is likely the last app-wide audit before the project goes to portfolio.** The synthesis subagent and all 13 per-surface subagents must operate under "last gate" framing — no soft-pedaling findings on the assumption that a future audit will catch them, no deferring cross-cutting patterns to "later," no charitable readings of borderline copy or behavior. When in doubt, tier up (Minor → Important; Important → Critical). The cost of an over-flagged finding is a quick "defensible by:" note; the cost of a missed finding is a portfolio reviewer catching it first.

## The five dimensions

Per surface, the audit evaluates:

### 1. Polish
Visual nits, copy quality, spacing, micro-interactions, micro-animations, haptic moments, transition feel. The "would a portfolio reviewer notice this and form a small negative impression?" bar.

### 2. Fidelity — compare to canonical reference state, NOT just Figma
Figma is a starting point, not ground truth. Many surfaces refined past Figma in chat — Roadside, Unfamiliar, the Safety sub-flows, HomeBrowseSheet multi-row, /legal. Treating Figma as canonical generates false-positive drift findings on surfaces whose actual canonical design lives in chat decisions + v2-delta docblocks + learnings entries.

**Composed canonical reference state** (the subagent constructs this before comparing):

1. **Figma node** (where one's cited in the file's docblock) — the starting state.
2. **The file's docblock "v2 deltas" / "intended deviations" list** — many files explicitly enumerate what diverged from Figma and why (e.g., `app/safety.tsx` has documented v2 deltas). Drift covered by deltas is intended.
3. **`docs/learnings.md` entries for the surface's shipping branches** — search by branch name (`feat/roadside-assistance`, `feat/unfamiliar-and-share-location`, `audit/safety-polish`, etc.). Refinements documented in learnings are intentional.
4. **`fgq query` against the merged graph** — chat transcripts story-tell what got refined collaboratively past Figma. The subagent runs short-seed queries to surface design decisions on this surface.

The composed reference state = (1) + (2) + (3) + (4). Then compare shipped vs the composed reference, and classify each fidelity finding as one of:

- **Real drift** — shipped diverges from the composed reference. Finding (severity per rubric).
- **Undocumented intentional refinement** — shipped diverges from Figma in a way that IS in chat/learnings but NOT in the file's docblock deltas list. Action: update the docblock to make canonical state legible. **Tier Important by default** — future readers will misread the surface otherwise.
- **Stale Figma citation** — docblock cites a Figma node that's no longer canonical (e.g., HomeBrowseSheet's old `1133:13690` single-row reference, when the shipped surface is the collaborative multi-row). Action: update or remove the citation. **Tier Important** — this is the failure mode that just bit this very audit; fix at the source.

If NO Figma node is cited AND chat/learnings show the surface was designed entirely collaboratively (e.g., /legal, NotifyingPulse): fidelity is N/A — report "no canonical Figma; surface is chat-defined" rather than "skip." The synthesis can verify whether the chat-defined design has its own documentation.

If the Figma MCP is unavailable: report "Figma fetch not assessed — MCP unavailable" but STILL evaluate deltas + learnings + chat-decisions. Partial assessment > no assessment.

### 3. Accessibility
Dynamic Type (AX5), `useReduceMotion` coverage, VoiceOver flow order, `accessibilityRole` + `accessibilityLabel` completeness, color contrast (WCAG AA), tap-target ≥44pt, decorative-vs-meaningful element discrimination, screen-reader gesture compatibility, two-line composite-label correctness.

### 4. Reliability / failure modes
What does the surface look and behave like when the happy-path breaks? Per surface, the audit asks:

- **No data / cold first-launch** — empty states, never-set-up flows, "no recordings yet" / "no saved places" / etc. Are they designed, or do they show a blank box?
- **A lot of data** — list virtualization, scroll perf, layout breaks at high counts (50 recordings, 100 saved places).
- **Permission denied** — Location / Contacts / Microphone refused. Does the surface degrade gracefully or stall?
- **Network down** — Mapbox unreachable, AsyncStorage write failure, route fetch timeout. Inline-error, silent fail, or crash?
- **Mid-loading state** — is there a skeleton, spinner, or just a flicker?
- **Mid-error state** — Alert? inline message? toast? nothing?
- **App-kill resilience** — does the surface restore correctly after a kill (e.g., active share session, in-progress recording, mid-trip)?

Portfolio reviewers will test these. Failure-mode UX is *categorically* different from polish (which is about happy-path craft) and worth its own row.

### 5. Concept-execution
Three sub-lenses:

- **Brand voice & tone consistency** — does the copy + visual register read as Fresh Greens (honest, warm, plainspoken — "You're not alone" / "Hang tight" / "On it.")? Or does it lapse into generic-product voice ("Coming soon", "Tap to continue", clinical labels like "Reason: Routine")?
- **Thesis-promise delivery** — does the surface deliver on the user-promise the thesis stated? E.g., does /safety actually reduce isolation for a stressed user? Does /search surface community-trusted spots first? Does /pulled-over feel like ambient protection rather than a tool you'd reach for in panic?
- **Honesty of disclosure** — does what each surface CLAIMS match what it actually DOES? Examples: "Myles is being notified" while v1 doesn't actually transmit; "Saved your journey periodically" on Unfamiliar Step 2 (v1 doesn't); "Safest route" claims on /home (does the route actually weight safety, or just say so?); placeholder copy that suggests features not yet built. Overlaps with brand voice but the rigor is different — brand voice asks "does this read as Fresh Greens"; honesty asks "is this true."

Audit fairness notes:
- Thesis-promise is interpretive. Subagents will be instructed to anchor their judgments to specific thesis claims (queryable via `fgq query "<short-seed>"` against the merged graph at `~/.graphify/fresh-greens-merged/`) and to flag claims they couldn't substantiate.
- Honesty findings should always include the *honest framing* the surface could adopt instead. Don't just say "this claim is overstated"; say "swap to X" or "qualify with Y."

## In-scope surfaces (~13)

1. `/home` (and `components/HomeBrowseSheet.tsx`)
2. `/search`
3. `/en-route`
4. `/safety` (entry tile sheet)
5. `/pulled-over`
6. `/roadside`
7. `/unfamiliar`
8. `/share-location`
9. `/trip-summary`
10. `/menu`
11. `/fuel` (refuel reminders setup)
12. `/recordings`
13. `/trusted-contact-setup`
14. `/legal`

(Listed as 14; treat as "~13" since `/legal` is a low-risk reading surface that may be combined or de-prioritized in the report.)

**Out of scope:**
- Onboarding screens (`/welcome`, `/sign-in`) — one-time, low portfolio judgment surface
- `/safety-settings` (touched but not a primary surface)
- `/report` modal (lower portfolio judgment)
- Map overlay primitives (route polylines, zone polygons, edge markers, daylight gradient) — addressable as a separate visual-only audit if needed
- Hooks, adapters, lib utilities — code-quality territory, separate concern

## Methodology — A + synthesis

**14 subagents total:** 13 per-surface deep-audit subagents (parallelizable) + 1 synthesis subagent (sequential, after the first 13 complete).

### Phase 1 — Per-surface deep audits (13 subagents, parallel)

Each subagent gets one surface and reads it end-to-end. The prompt template includes:

- The surface's file path + a directive to read it fully
- A directive to look at any sibling files the surface depends on (the screen's `components/*` and `hooks/*` references)
- The four dimensions, each with concrete examples and the severity rubric
- A directive to look up thesis claims relevant to the surface via `fgq query`, citing nodes verbatim
- The output format: structured per-finding with id, severity, dimension, file:line, description, suggested fix, defensibility note (whether leaving it as-is is portfolio-defensible)
- The severity rubric (see below) with concrete examples

Subagents return a per-surface report.

### Phase 2 — Synthesis (1 subagent, after Phase 1)

The synthesis subagent ingests all 13 per-surface reports + does:

1. **Severity normalization** — calibrate severity calls across the 13 reports. If subagent A called something Important and subagent B called the same pattern Minor on a different surface, the synthesis decides which is correct and re-grades.
2. **Cross-cutting pattern detection** — promote any pattern appearing on ≥3 surfaces to a project-level finding (e.g., "the hydration anti-pattern from `audit/safety-polish` was found again in 4 surfaces"; "spacing-token drift appears in 5 surfaces' settings sections").
3. **Executive summary** — 1-page TL;DR with: overall state per dimension, top 5 surfaces by finding density, "must-fix-before-portfolio" shortlist (≤8 items), known-deferred / portfolio-defensible "imperfect on purpose" list.
4. **Output writing** — produces both:
   - `docs/audits/2026-05-31-app-wide-fidelity-audit.md` (static snapshot)
   - Appended entries to `docs/next-session.md` (live operational backlog), one per Critical/Important/Minor finding, organized by surface, each citing back to the audit doc

## Severity rubric

| Tier | Definition | Action |
|---|---|---|
| **Critical** | Breaks UX, violates project rules (reserved-color, anti-slop, etc.), fails an a11y requirement, or actively misrepresents the app (e.g., shipping a "coming soon" tile for a shipped feature). | Must fix before portfolio. |
| **Important** | A portfolio reviewer would notice and flag it. Tightenable without major refactor. | Should fix before portfolio. |
| **Minor** | Polish nit you can defend leaving as-is. Flag with "defensible by:" reasoning if not fixing. | Backlog. |
| **Note** | Observation worth recording but not actionable (e.g., "this pattern works but is worth re-examining if a similar surface lands"). | Audit doc only; does NOT flow to next-session.md. |

Each finding must include a one-line **defensibility note** — what the answer would be if a portfolio reviewer (or, more pointedly, a thesis-defense panel) asked "why is this still like this?" The answer should be thesis-grounded: a specific design decision tied to a thesis claim, scope constraint, or principle — not "it works" or "we ran out of time." If the only defensible answer is the latter, the finding is genuinely actionable and should be tiered Critical or Important.

## Output structure

### `docs/audits/2026-05-31-app-wide-fidelity-audit.md` (static)

```
# App-wide Fidelity Audit — 2026-05-31

## Executive summary
- Overall state per dimension (1 line each)
- Top 5 surfaces by finding density
- Must-fix-before-portfolio shortlist (≤8)
- Defensible-imperfect-on-purpose list

## Cross-cutting patterns
- Any pattern appearing on ≥3 surfaces, with affected surfaces enumerated

## Per-surface findings
### /home
**Context:** 1-paragraph summary of what this surface does in the app.
**Findings:**
- [F1 Critical Polish] description, file:line, suggested fix, defensibility
- [F2 Important A11y] ...
- ...

### /search
... (etc, all 13)

## Per-dimension appendix
### Polish (raw)
... (per-surface findings re-organized by dimension, lightly cleaned)
... (other 3 dimensions)
```

### `docs/next-session.md` (live)

A new section `## Audit 2026-05-31 — backlog flow-in` is appended, with entries organized by surface, each citing the audit doc's finding id. When a finding gets fixed, that line gets strike-through per workflow step 11.5.

## Concept-execution methodology — thesis-promise audit

For each surface, the subagent queries the merged graph for relevant thesis claims:

```bash
fgq query "<short seed: e.g. 'pulled-over', 'safety', 'trusted contact'>"
```

Returns chat-transcript + thesis-text nodes mentioning the seed. The subagent treats these as the *claim* the surface is supposed to deliver on. Then evaluates whether the shipped surface delivers — concretely:

- Is the user-promise visible in the surface's copy?
- Does the interaction flow match the user's predicted emotional path (panic → calm; lost → safe; etc.)?
- Are the specific design choices traceable back to the claim (e.g., "we chose the Lifeline modal because the thesis claims solo-driver isolation is the central pain")?

Findings here look like: `[F4 Important Concept] /pulled-over's contact phase shows the trusted contact's avatar but never says the contact's name in copy — thesis claim "you are not alone, by name" is half-realized at file:line; suggest adding "{name} can see you're here" subtitle. Defensibility: works, but skipping the name dilutes the promise.`

## Subagent prompt template (Phase 1)

The dispatching prompt for each per-surface subagent must include:

- Path to the file(s) under audit (the route + key sibling files)
- The "last gate before portfolio" framing — tier up when in doubt; don't soft-pedal
- Mandatory `fgq query "<short-seed>"` runs before judging concept-execution (thesis-promise) on this surface, with the seeds the subagent ran logged in the report so the synthesis can verify coverage
- The 5 dimensions with concrete examples for each (polish, fidelity, accessibility, reliability, concept-execution)
- For concept-execution: the three sub-lenses (brand voice, thesis-promise delivery, honesty-of-disclosure) with concrete examples for each
- The severity rubric verbatim, including the thesis-defense-grade defensibility-note requirement
- The thesis-promise audit method + `fgq query` instructions (short keyword seeds, NOT sentences)
- For reliability: an explicit list of failure-mode questions to probe (no data, lots of data, denied permissions, network down, mid-loading, mid-error, app-kill resilience)
- For honesty-of-disclosure: instruction to enumerate every UI claim the surface makes and verify each against actual behavior
- Required output format (findings array + brief surface summary)
- Cross-references to the previous audit-pass learnings (`docs/learnings.md` entries `audit/safety-polish` and `ax5/safety-surfaces`)
- Instruction: "Do NOT report 'Note' findings to next-session.md; those stay in the audit doc"

## Subagent prompt template (Phase 2 — synthesis)

The synthesis subagent gets:

- All 13 per-surface reports (full text, passed inline)
- Cross-cutting pattern detection instruction with the ≥3-surfaces threshold
- Severity normalization instruction
- Executive summary template
- Output file paths: `docs/audits/2026-05-31-app-wide-fidelity-audit.md` and append to `docs/next-session.md`
- Instructions for how to format the next-session.md entries with citation back

## Out of scope (this audit)

- The map overlay primitives (separate visual audit if needed)
- Hooks / adapters / utilities code review
- Performance / runtime profiling
- Test coverage (project has no test runner)
- Onboarding + sign-in flows
- /report modal and /safety-settings
- The compliance round-2 backlog (parked earlier; separate work)
- Phase 5 submission prep (this audit precedes that)

## What this audit is NOT

- It is **not** a fix-PR. No code changes happen during the audit. Fix-PRs come later, driven by next-session.md.
- It is **not** a feature spec. We're not designing new things.
- It is **not** a code-quality review. We're not asking "is this code well-written" — we're asking "does this surface meet the polish/fidelity/AX/concept bar?"

## Self-review

- ✅ All 5 dimensions defined with concrete examples + scope (polish, fidelity, accessibility, reliability, concept-execution).
- ✅ Concept-execution has three sub-lenses: brand voice, thesis-promise, honesty-of-disclosure (per brainstorm; internal-coherence explicitly excluded; performance/idiom/discoverability/privacy explicitly skipped).
- ✅ Reliability dimension covers no-data, lots-of-data, denied-permission, network-down, mid-loading, mid-error, app-kill resilience.
- ✅ Defensibility note must be thesis-defense-grade — "it works" is not a defense.
- ✅ 14 in-scope surfaces enumerated.
- ✅ Out-of-scope items enumerated (onboarding, settings, map primitives, etc.).
- ✅ Methodology spec'd: A+synthesis with 13 parallel subagents + 1 synthesis subagent.
- ✅ Severity rubric with 4 tiers + defensibility-note requirement.
- ✅ Output is hybrid: static audit doc + flow into next-session.md.
- ✅ Phase 2 synthesis explicitly responsible for severity normalization + cross-cutting pattern detection + writing both files.
- ✅ Concept-execution methodology grounded in `fgq query` against the merged graph for thesis claims.
- ✅ No placeholders, no TBDs.
- ✅ The audit is explicitly NOT a fix-PR, NOT a feature spec, NOT a code review.
