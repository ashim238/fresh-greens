# Visual closure — Batch 2: Safety flows (2026-06-25)

Branch: `chore/visual-closure-safety`

## Scope

**Routes:** `/safety`, `/emergency`, `/pulled-over`, `/share-location`, `/unfamiliar`, `/roadside`

**Components:** `RoadsideTowPick`, `LiveSafetySheet`, `LifelineModal`, `NotifyingPulse`, `RecordingSaveErrorBanner`, `TrustedContactStatus`

## Three-pass summary

### Audit scorecards

| Route | Total | P0 | P1 open (after fixes) |
| ----- | ----- | -- | --------------------- |
| `/safety` | 17/20 | 0 | 0 |
| `/emergency` | 18/20 | 0 | 0 |
| `/pulled-over` | 17/20 | 0 | 0 |
| `/share-location` | 17/20 | 0 | 0 |
| `/unfamiliar` | 17/20 | 0 | 0 |
| `/roadside` | 17/20 | 0 | 0 |

### Round 7 P1 re-check

| Item | Status |
| ---- | ------ |
| Share toggle auto-advances to status | **Stale** — share toggle does not call `markActionTaken()`; only call/tow paths advance. Removed dead `actionTaken` state. |
| Toolkit tiles missing hints | **Stale** — `accessibilityHint={tab.hint}` on all tiles; session banner renders when active. |
| share-location `handlePick` Alert | **Fixed** — inline `pickError` |
| unfamiliar start/end Alert | **Fixed** — inline `problemError` + `endError` |

### Visual-pass round

| Surface | Issue | Sev | Fixed? |
| ------- | ----- | --- | ------ |
| `pulled-over` recording chip | MetaSeparator | N/A | Already correct |
| `roadside` shared rows | MetaSeparator | N/A | Already correct |
| `RoadsideTowPick` | Simulator copy | P2 | **Stale** — production copy only (verified) |
| `roadside` WrongSpotModal Cancel | P2 | No | Defer |
| `roadside` "I figured it out" confirm | P2 | No | Already has Alert confirm (verified) |

## Fixes shipped

1. **share-location** — `pickError` inline instead of `Alert.alert` on session start failure.
2. **unfamiliar** — `problemError` on step 1; `endError` on active session end failure.
3. **roadside** — remove unused `actionTaken` state (documents share-toggle decoupling).

## Critique snapshots

Re-use Round 7 snapshots where current; add dated re-verify notes in batch commit:
- `.impeccable/critique/2026-06-25T17-31-14Z__app-safety-tsx.md` (P1s verified stale)
- `.impeccable/critique/2026-06-25T17-31-26Z__app-roadside-tsx.md` (share P1 verified stale)
- `.impeccable/critique/2026-06-25T19-45-00Z__app-share-location-tsx.md` (new)
- `.impeccable/critique/2026-06-25T19-45-00Z__app-unfamiliar-tsx.md` (new)

## Verification

- `npx tsc --noEmit` — pass (2026-06-25)
