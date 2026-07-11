# Impeccable critique + audit — en-route + roadside (merge-time pass)

Scope: the two commits merged to `main` — `3a2ccbb` feat(en-route) + `45cfe53` fix(roadside).
Files: `app/en-route.tsx`, `components/EnRouteCarMarker.tsx`, `lib/api/routes.ts`, `app/roadside.tsx`.
Trigger: auto critique+audit at merge (6 feat/fix commits touching app/|components/ since 2026-07-02, ≥5 threshold).
Register: product. RN app — Assessment B detector (HTML/CSS) N/A; runtime evidence = this session's active-nav sim recording.

## Anti-Patterns verdict — PASS
Both changes move *away* from AI tells. The marker change deletes a fake-3D `perspective`/`rotateX` tilt (a common slop move) for a flat, legible directional puck. The roadside change enforces the Held-Question Rule (regular-weight Franklin for a held question; DM Serif reserved for the reassurance payoff). No new tells introduced.

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 4 | `question` keeps `accessibilityRole="header"`; marker keeps role="image"+label; safety FAB column 56pt |
| 2 | Performance | 3 | `findNextStep` runs `nearestPointOnPolyline` over the full route polyline every GPS fix (P3) |
| 3 | Theming | 4 | All diff values token-driven; removed hard-coded TILT_* constants |
| 4 | Responsive / Dynamic Type | 4 | `question` wraps `dynamicType()`; marker fixed-size (correct for a pin) |
| 5 | Anti-Patterns | 4 | Net slop *removal* (flat marker) + voice discipline (Held-Question) |
| **Total** | | **19/20** | Scores high, but see the P2 copy/honesty finding below — it's a content bug the 5 dims don't capture |

## Findings

- **[P2] Honesty-of-Disclosure violation — guide copy promises a deleted control.** `app/en-route.tsx:471` (FirstDriveGuide recenter step) reads *"Replay this walkthrough anytime with the ? button."* — but this same diff removed the `?` Guide FAB, and `sideFabCoach.dismiss()` persists, so after the tour ends there is **no replay affordance at all**. False instruction pointing at a nonexistent button. Directly violates Design Principle #4 (no claim the code doesn't back). Fix: cut the second sentence, or restore a `sideFabCoach.show()` entry point. (Surfaced by `code-reviewer`, missed by Assessment A.)
- **[P3] Stale comments contradicting the diff.** `app/en-route.tsx:407` (*"Guide-button replays via show()"* — `show()` now has zero callers) and `:350` (SideFabRow *"same Guide re-trigger"*). `:631` correctly says "replaced" — the file is internally inconsistent about whether the Guide button exists.
- **[P3] Recenter leaves the arrow briefly stale.** ~~`handleRecenter` (`:1819`) and the mount-anim site (`:1334`) set `cameraHeadingRef.current = 0` without a re-render; `screenHeading` reads the ref in render, so the arrow keeps `heading - oldCameraHeading` until the next GPS fix (~1s).~~ **FIXED** — promoted `cameraHeadingRef` → `cameraHeading` state; the moving-fix site feeds a local const to the synchronous `animateCamera` read and batches `setCameraHeading` with `setHeading`/`setUserLocation` (no extra render), while recenter/mount now re-render the marker so the arrow snaps upright immediately.
- **[P3] Perf — full-polyline cross-track scan per fix.** `lib/api/routes.ts` `findNextStep` calls `nearestPointOnPolyline(userLocation, routeCoordinates)` over the entire route polyline (~6.6k coords) on every `userLocation` change. **Deferred (intentional)** — the cost is ~ms/fix at 1 fix/sec and doesn't profile; windowing the search around `minStepIndex` would put the off-route *safety* test at risk for no measured gain (Karpathy-lean: no speculative optimization). Revisit only if it shows in a battery/thermal trace.

## Assessment B (code-reviewer agent, in lieu of the HTML detector)
Verified clean: no orphans (TILT_* consts + `tilt` style, `labelChip`/`labelText`, `Question` import, `showGuideFab`/`windowHeight`/`NATURAL_SIDE_COLUMN_HEIGHT` all excised with their uses); `routes.ts ↔ scoring.ts` is not a runtime cycle (`import type` erased); all new tokens/exports exist; FirstDriveGuide a11y sound (modal trap, per-step announce, labeled buttons). Single material finding = the P2 above.

## Positive findings (keep replicating)
- Diff carries strong *why* comments: the flat-puck rationale, the cross-track "500m-from-nearest-turn on a long step" example, the Held-Question cross-ref to /unfamiliar + /share-location.
- Off-route fix improves Visibility-of-System-Status + Honesty-of-Disclosure: no more false "Recalculating…" mid-block.
- roadside prompt now matches the structurally-identical prompts in /unfamiliar + /share-location — cross-flow consistency.
- Call site (`en-route.tsx:970`) passes `activeRoute.coordinates` — cross-track path actually wired, not silently falling back to the loose net.
- `tsc` clean; a11y preserved through both changes.

## Verdict
Tokens / a11y / anti-slop are clean. One **P2 content bug** already on `main` (guide copy references the removed `?` button — Honesty-of-Disclosure violation) → needs a follow-up fix (cut the sentence or restore replay). Plus 2 stale comments + a minor recenter-lag, all P3.
