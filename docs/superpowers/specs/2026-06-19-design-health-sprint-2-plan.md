# Design Health Program — Phase 2 Sprint 2 Plan

**Date:** 2026-06-19
**Status:** Approved (sprint-meta-spec)
**Scope:** Phase 2 Sprint 2 — composition, sequence, rhythm
**Source:** [`docs/superpowers/specs/phase-1-findings/2026-06-19-cross-screen-synthesis.md`](phase-1-findings/2026-06-19-cross-screen-synthesis.md) Section 4 (synthesis PRs 4–10)
**Sprint 1 status:** Closed. 3 PRs merged (#233 `useHydratedState`, #234 `useMutation`, #235 `SafetyErrorMessage` + `useHydratedResource` + `useRecordings` migration).

---

## Goal

Ship 4 "cheap-wins" extractions from the synthesis backlog while keeping each PR small, mechanical, and independently reviewable. Validate a pipelined brainstorm cadence so Sprint 2's wall-clock is shorter than Sprint 1's serial rhythm without sacrificing per-PR rigor.

This is a **sprint-meta-spec** — it scopes the sprint, not any single PR. Each of the 4 PRs gets its own brainstorm → spec → plan → execution cycle, citing this doc as the sprint-level reference.

## The composition (4 PRs)

| # | PR | Synthesis row | Effort | Surface |
|---|---|---|---|---|
| 1 | **PR 5 — Settings value-population** | "iOS Settings Register — Value-as-Description" | SMALL | `SettingsRow` value-slot convention doc + 3 screens (safety-settings, menu, zone-preferences) |
| 2 | **PR 7 — Coach-mark recoverability** | "Coach Mark One-Shot" | SMALL | Extend `useCoachMark` with `reset()`; add Map guide menu entry; en-route re-entry affordance. 2 screens (home, en-route). |
| 3 | **PR 4 — Tap-target geometry** | "Tap-Target Painted Geometry" | MEDIUM | Component-level: `Button (transparent)` carries painted `minHeight: 44`; `SettingsRow` tab pill → 44pt. Plus 5 screen-level violations (legal tabs, search Clear, permissions recovery, pulled-over stop-recording, home drag handle). |
| 4 | **PR 10 — Reserved-color audit** | "Reserved-Color Discipline Drift" | MEDIUM | Correct `wiltedgreen` (trip-summary accept), `freshgreen` (fuel unselected borders); standardize separator tokens (menu, recordings, roadside-setup); document carve-outs. |

## What lives outside Sprint 2 (already accounted for)

- **Sprint 3** — synthesis PRs 6, 8, 9 (VoiceOver hint depth, Dynamic Type audit + lint, dismissal standardization). PR 9 is solo per the synthesis's explicit do-not-combine warning — dismiss guards on `pulled-over`/`roadside` carry safety semantics.
- **Phase 3** — 15 per-screen tail items in `docs/next-session.md` (Phase 1 critique tail).
- **Sprint 1 follow-up chips** — 8 open chips queued from PRs #233/#234/#235; not blocking program work.
- **Search tap-to-bookmark feature** — deferred mid-Sprint-1-smoke discovery; resumes after Sprint 2 if user prioritizes.

## Sequence (smallest-first)

The 4 PRs are independent — no inter-PR dependencies. Order is chosen for **rhythm validation**, not technical necessity:

1. **PR 5 first.** Smallest, partially done (PR #234's leftover refinements already populated 2 of 3 safety-settings row values). Quick brainstorm (just the convention + 3 screen edits). Validates pipelined cadence with the smallest possible blast radius.
2. **PR 7 second.** Contained to `useCoachMark` + 2 screens + 1 menu entry. Brainstorm fits cleanly inside PR 5's execute window — first real pipelining test.
3. **PR 4 third.** Component-level fix that propagates broadly. Larger surface than 5/7 but the work is mechanical (painted-height adjustments + 5 screen audits). Lands after cadence is settled.
4. **PR 10 fourth.** Sprint 2 closer. Sets the visual baseline before Sprint 3's architectural work begins.

## Rhythm — pipelined brainstorm/spec

Sprint 1 ran strictly serial: PR N fully closed (merge) before PR N+1's brainstorm started. Sprint 2 pipelines the brainstorm/spec phases:

```
PR 5  brainstorm → spec → plan → ──── execute/review ──── → merge
PR 7                              brainstorm → spec → plan → ──── execute/review ──── → merge
PR 4                                                          brainstorm → spec → plan → ──── execute/review ──── → merge
PR 10                                                                                   brainstorm → spec → plan → ──── execute/review ──── → merge
```

**The trigger:** when a PR enters execute/review (subagent dispatch + tsc/spec/code-quality review cycles), start the next PR's brainstorm. The next spec lands while reviews are still cycling on the current PR. No PR's *execution* overlaps with another's — that constraint stays serial.

**Why this works for cheap wins specifically:** brainstorms here are fast (clear synthesis prompt, small surface, no novel architecture). The review/execute window has natural waiting beats where brainstorm questions don't compete with implementer dispatch. This would NOT work for Sprint 3's LARGE PRs where brainstorms themselves take real thought.

## Rigor benchmarks (inherited from Sprint 1)

These don't change between sprints. Each PR within Sprint 2 still ships:

- Brainstorm → spec → plan → subagent-driven execute → 2-stage review per task → whole-branch final review → PR
- Atomic-commit-per-target within each PR, low-blast-first sequencing
- `tsc --noEmit` gate after every commit + at PR open
- Scope-discipline diff check before PR opens
- Per-task spec-compliance review BEFORE code-quality review (per Sprint 1's enforced order)
- Manual device/sim smoke checklist in the PR body (user's responsibility)

## Definition of done

Sprint 2 closes when all 4 PRs are merged to `main` and `tsc` is green at HEAD. Sprint 3 scope discussion opens.

## Risk notes

- **No expected merge conflicts between Sprint 2 PRs.** They touch disjoint surfaces:
  - PR 5 touches settings screens (safety-settings, menu, zone-preferences) + SettingsRow JSDoc
  - PR 7 touches `useCoachMark` + menu (new row) + en-route + home
  - PR 4 touches `Button.tsx`, `SettingsRow.tsx`, and 5 named screens
  - PR 10 touches trip-summary + fuel + menu + recordings + roadside-setup
  - Menu is touched by 3 of 4 PRs but at different sites (PR 5: value props, PR 7: new "Map guide" row, PR 10: separator tokens). Low actual conflict risk.
- **PR 4's Button (transparent) change has codebase-wide blast** — every transparent Button gets the new painted minHeight. Risk surfaced in synthesis: "layout changes need regression tests on all uses." Per-PR brainstorm needs to enumerate all transparent Button call-sites before committing to the visual change.
- **Pipelined brainstorm carries one real risk** — answering brainstorm Qs for PR N+1 while reviewing PR N's code can split attention. Mitigation: I ask one question at a time, and review-cycle pauses (waiting on subagent dispatch) are the natural windows.

## Path after Sprint 2

If Sprint 2 ships clean, Sprint 3's structure question reopens — particularly the order of PR 8 (Dynamic Type + lint) vs PR 6 (VoiceOver hint depth) before PR 9 (solo dismissal). Sprint 3 likely needs its own sprint-meta-spec given the LARGE-effort PRs and PR 9's hard constraint.
