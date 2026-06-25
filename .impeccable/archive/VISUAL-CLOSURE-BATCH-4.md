# Visual closure — Batch 4: Onboarding flows (2026-06-25)

Branch: `chore/visual-closure-onboarding`

## Scope

**Routes:** `/` (`index`), `/get-started`, `/onboarding`, `/login`, `/permissions`

**Components:** `PageControl`, `Button`, `StateCard` (referenced; no changes this batch)

## Three-pass summary

### Audit scorecards

| Route | A11y | Perf | Theme | Responsive | Anti-slop | Total | P0 | P1 open (after fixes) |
| ----- | ---- | ---- | ----- | ---------- | --------- | ----- | -- | --------------------- |
| `/` (welcome) | 3 | 3 | 4 | 3 | 4 | 17/20 | 0 | 0 |
| `/get-started` | 4 | 4 | 4 | 3 | 4 | 19/20 | 0 | 0 |
| `/onboarding` | 4 | 3 | 4 | 3 | 4 | 18/20 | 0 | 0 |
| `/login` | 4 | 4 | 4 | 3 | 4 | 19/20 | 0 | 0 |
| `/permissions` | 4 | 4 | 4 | 3 | 4 | 19/20 | 0 | 0 |

**Batch gate:** Zero open P0/P1 after fix-forward.

### Visual-pass round (13 categories)

| Screen | Issue | Sev | Fixed? | Notes |
| ------ | ----- | --- | ------ | ----- |
| `/` terms checkbox | hitSlop on 24pt visual | P1 | Yes | `tapTarget44` Pressable wraps 24pt glyph |
| `/` Get started CTA | Disabled with no VoiceOver hint | P1 | Yes | `accessibilityHint` when terms unchecked |
| `/get-started` Apple button | 48pt height | N/A | — | Above 44pt floor |
| `/onboarding` PageControl | Decorative in a11y tree | N/A | — | `accessibilityElementsHidden` intentional |
| `/login` dev sign-in | Dev-only row | P2 | No | `__DEV__` gate; not shipped register |
| `/` Privacy/Terms links | Non-navigating styled text | P2 | No | Links to `/legal` deferred — copy is ornamental on splash |

**Counts:** 5 routes reviewed · 2 P1 fixed · 2 P2 logged

## Fixes shipped (this PR)

1. **Welcome (`/`)** — terms checkbox uses 44pt painted `tapTarget44` wrapper; removed `hitSlop={20}` on 24pt visual.
2. **Welcome (`/`)** — `Get started` exposes `accessibilityHint` when disabled pending terms acceptance.

## P2 deferred (batch 4)

| Item | Surface | Rationale |
| ---- | ------- | --------- |
| Privacy/Terms tappable links on splash | `/` | Ornamental copy today; `/legal` deep-link is feature polish |
| Dev sign-in row styling | `/login` | `__DEV__` only |
| Onboarding pager without progress a11y | `/onboarding` | PageControl hidden; Continue label carries step context |

## Verification

- `npx tsc --noEmit` — **pass** (2026-06-25)
