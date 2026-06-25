# Design Round 7 — Hub Screen Synthesis

**Date:** 2026-06-25  
**Branch:** `chore/design-round-7` (post squash-merge PR #253 tow-pick → `main`)  
**Method:** Impeccable-style critique pass per workflow §12b — source review + prior snapshot delta; RN screens skip browser/detector overlay.

## Scope

| Screen | File | Round 7 score | Δ vs prior | P0 | P1 | P2 | P3 |
|--------|------|---------------|------------|----|----|----|-----|
| `/home` | `app/home.tsx` | 30/40 | +1 | 0 | 0 | 2 | 1 |
| `/en-route` | `app/en-route.tsx` | 30/40 | +1 | 0 | 1 | 2 | 0 |
| `/search` | `app/search.tsx` | 31/40 | 0 | 0 | 1 | 2 | 1 |
| `/safety` | `app/safety.tsx` | 33/40 | −2* | 0 | 2 | 2 | 1 |
| `/menu` | `app/menu.tsx` | 33/40 | +1 | 0 | 0 | 1 | 2 |
| `/roadside` | `app/roadside.tsx` + `RoadsideTowPick` | 31/40 | +1** | 0 | 1 | 4 | 2 |

\* Safety score adjusted honestly: sub-flows gained polish in PR #253 arc while picker untouched — relative regression vs children, not absolute slop.  
\*\* Roadside +1 vs 2026-06-24 closeout (30) with tow-pick net-new surface.

**Aggregate:** 0 P0 · 5 P1 · 13 P2 · 7 P3 across 6 screens.

## Anti-Patterns Verdict (cross-screen)

**Pass.** No screen triggers AI-slop tells. Hub screens share a coherent calm-companion register: wiltedgreen eyebrows, chips-as-briefing on /home, hold-to-confirm SOS on /en-route, grouped-settings on /menu, tow-pick progressive reveal on /roadside. Reserved-color discipline holds.

## Top 5 Findings (priority order)

### 1. [P1] `/roadside` — Share toggle auto-advances to status
Enabling "Share location w/ {contact}" calls `markActionTaken()` and jumps to Step 3 before the user reviews other actions. High accidental-advance risk for one-handed distress use. **Fix PR:** decouple toggle from step transition.

### 2. [P1] `/safety` — Picker drift from sub-flow polish convention
Toolkit tiles lack `accessibilityHint`; active share session invisible until wrong-tile Alert. Sub-flows (/roadside, /share-location, /unfamiliar) now follow PR #242 label+hint rule — the modal door didn't get the same pass.

### 3. [P1] `/en-route` — No-route turn-card ambiguous with mock fallback
"Heading toward {dest}" reads identical for real no-route and demo/mock paths. Users can't diagnose recoverable failure. **Fix PR:** inline no-route branch like /home.

### 4. [P1] `/search` — Inert mic looks tappable (sighted users)
Documented intentional (`onMicPress` omitted for VoiceOver honesty) but full-opacity mic in 44pt wrap still fails sighted affordance test. Mute glyph or remove until voice ships.

### 5. [P2] `/roadside` tow-pick — Production error copy mentions simulator
`RoadsideTowPick` empty-state string references Xcode simulator location — dev framing in user-facing error. Trivial copy fix.

## Closed since last hub sweep (don't re-open)

- /home FAB magic numbers → named constants
- /home AX5 route-preview overflow → ScrollView + flexShrink
- /en-route Side-FAB labels → footnoteRegular (Floor Rule)
- /en-route SOS hold affordance → ring + "Hold" caption
- /menu sign-out → `confirmSignOut` Alert
- /roadside Step 3 trap → X back to actions
- /roadside "What they know" card + section label weight
- /roadside Maps tow handoff → in-app tow-pick (PR #253)

## Recommended fix PR clusters

1. **`fix/roadside-distress-guardrails`** — share-toggle decouple, figured-it-out confirm, WrongSpot Cancel, simulator copy (P1 + P2 bundle, same file)
2. **`fix/safety-picker-parity`** — tile hints + active-session banner (P1 pair)
3. **`fix/en-route-no-route`** — turn-card recovery branch (single P1)
4. **`polish/search-mic-affordance`** — quieter mic or remove (P1, touches SearchBar)

## P0 gate for follow-up fix PR

**No P0 blockers.** All findings are P1–P3. Tow-pick ships a complete call-first path; nothing prevents opening a fix PR immediately.

## Snapshot index

- `.impeccable/critique/2026-06-25T17-30-56Z__app-home-tsx.md`
- `.impeccable/critique/2026-06-25T17-31-02Z__app-en-route-tsx.md`
- `.impeccable/critique/2026-06-25T17-31-08Z__app-search-tsx.md`
- `.impeccable/critique/2026-06-25T17-31-14Z__app-safety-tsx.md`
- `.impeccable/critique/2026-06-25T17-31-20Z__app-menu-tsx.md`
- `.impeccable/critique/2026-06-25T17-31-26Z__app-roadside-tsx.md`

## Trend (total heuristic score)

`home`: 29 → 30 · `en-route`: 29 → 30 · `search`: 31 → 31 · `safety`: 35 → 33 · `menu`: 32 → 33 · `roadside`: 30 → 31

Net: hub screens stable-to-improving; safety picker is the relative laggard because sub-flows outran it.
