---
target: app/en-route.tsx
total_score: 30
p0_count: 0
p1_count: 0
timestamp: 2026-06-25T19-30-00Z
slug: app-en-route-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | ETA pulse, offline/demo pill, turn-card terminal states |
| 2 | Match System / Real World | 4 | Maneuver glyphs, speed pill, daylight legend |
| 3 | User Control and Freedom | 3 | Hold-to-confirm SOS; end-trip visible |
| 4 | Consistency and Standards | 3 | secondaryRow MetaSeparator matches /home |
| 5 | Error Prevention | 3 | SOS hold gate; silent route refresh |
| 6 | Recognition Rather Than Recall | 3 | Hazard glyphs on turn card |
| 7 | Flexibility and Efficiency | 3 | FAB cluster: compare, fuel, safety |
| 8 | Aesthetic and Minimalist Design | 3 | Fuel hidden during hazard panel |
| 9 | Help Users Recognize, Diagnose, Recover | 3 | no-route / mock / cache / live turn-card branches now distinct |
| 10 | Help and Documentation | 2 | Coach-mark one-shot (P2, batch 2/5) |
| **Total** | | **30/40** | **Good — mock/cache ambiguity resolved** |

## Priority Issues

- ~~**[P1] No-route indistinguishable from mock fallback**~~ — Fixed batch 1: `Following route to` for mock/cache without steps; `no-route` recovery unchanged; `Heading toward` only for live routes awaiting steps.
- ~~**[P1] Side-FAB label below 12pt floor**~~ — Pre-fixed: footnoteRegular (13pt).
- **[P2] No long-press FAB label flash** — Deferred to synthesis.

## Overall Impression

Turn-card copy now encodes route-source honesty: offline/demo routes no longer mimic live turn-by-turn. Offline pill + new header register reinforce the same signal.
