---
target: app/en-route.tsx
total_score: 30
p0_count: 0
p1_count: 1
timestamp: 2026-06-25T17-31-02Z
slug: app-en-route-tsx
round: 7
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | ETA pulse + offline pill clear; zone-roll silent-fail still has no surfaced recovery |
| 2 | Match System / Real World | 4 | Turn-card maneuvers, daylight dash-patterns, hold-to-confirm SOS match driving idioms |
| 3 | User Control and Freedom | 4 | End-trip visible; hold-to-confirm SOS with VoiceOver bypass; compare-routes from FAB cluster |
| 4 | Consistency and Standards | 4 | Side-FAB labels bumped to `footnoteRegular` (13pt) — Floor Rule closed; secondaryRow dot matches /home |
| 5 | Error Prevention | 3 | SOS hold pattern canonical; fuel hidden during hazard panel — One-Voice Rule applied |
| 6 | Recognition Rather Than Recall | 3 | Coach-mark labels one-shot; post-dismiss column is icon-only forever |
| 7 | Flexibility and Efficiency | 3 | Mid-trip destination change + route comparison wired; no long-press label flash fallback |
| 8 | Aesthetic and Minimalist Design | 3 | Wiltedgreen header grounded; hazard panel gets floor when active |
| 9 | Help Users Recognize, Diagnose, Recover | 2 | No-route fallback reads same as mock fallback ("Heading toward {dest}") — ambiguous recovery |
| 10 | Help and Documentation | 2 | Guide FAB re-shows labels once; no persistent glossary or long-press hint |
| **Total** | | **30/40** | **Good — Floor Rule + SOS affordance fixes landed; label discoverability + no-route ambiguity remain** |

## Anti-Patterns Verdict

**LLM assessment**: No AI-slop tells. Side-button column earns Maps-category convention; reserved colors disciplined (yellow hazard, red SOS burst, navy safety shield).

**Deterministic scan**: Skipped (RN source). `speedLimitCurrentNumber` uses exempt raw `fontSize: 24` per dynamic-type carve-out — sanctioned.

**Visual overlays**: Browser injection skipped (RN source).

## Overall Impression

Round 7 delta vs 2026-06-24 (+1): follow-up sweep closed the caption2/Floor Rule P1 and SOS visible hold affordance. Persistent weakness is post-coach icon-only FAB column and turn-card no-route vs mock ambiguity.

## What's Working

- **Hold-to-confirm SOS** with ring + haptic ramp + VoiceOver bypass — textbook safety pattern.
- **Fuel deferred during hazard** — correct hierarchy-by-exclusion at glance budget.
- **Absolute-positioned labelPill** — FAB column doesn't shift when Guide toggles labels.

## Priority Issues

- **[P1] No-route turn-card indistinguishable from mock fallback.** Both render "Heading toward {destName}" — user can't tell recoverable failure from demo route. **Fix**: inline no-route branch parallel to /home's `noRouteState`. **Suggested command**: `/impeccable clarify app/en-route.tsx`
- **[P2] No long-press fallback to re-show FAB labels.** After coach dismissal, column is icon-only; Guide re-shows all labels but isn't labeled when collapsed. **Fix**: long-press any FAB → flash its label 2s. **Suggested command**: `/impeccable polish app/en-route.tsx`
- **[P2] Zone-roll background failure silent.** No user-facing chip when zone refresh fails mid-drive. **Suggested command**: `/impeccable harden app/en-route.tsx`

## Persona Red Flags

**Sam (Accessibility)**: FABs have `accessibilityLabel` (good); visible coach labels now 13pt and scale — prior Floor Rule gap closed.

**Casey (Distracted Mobile)**: Six FABs × 56pt + gaps ≈ 376pt column — verify AX5 doesn't push column off-screen with expanded sheet (screenshot needed).

## Minor Observations

- `offlinePill` still uses inline `rgba(255,255,255,0.2)` — token gap, P3.
- ETA pulse respects `reduceMotion` — Reduce-Motion-Honest Rule observed.

## Questions to Consider

- Should FAB labels re-show automatically once per session, not per install?
- What's the right turn-card copy at AX5 for long hazard panel bodies?
