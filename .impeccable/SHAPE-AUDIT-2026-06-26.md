# Shape-language audit — circles vs squircles vs pills (2026-06-26)

A "visual-pass for shape." Catalogued every `borderRadius` site across all 47
files that have one (~150 elements) and classified each as **circle**,
**squircle** (rounded rect), **pill** (capsule), or **dot/hairline**, then
flagged where the vocabulary is inconsistent. Read-only audit — no code changed.

## Verdict

The instinct is right: there's a real "weird mix." But it's **not** that circles
and squircles coexist (that's normal — round identity surfaces vs card/tile
register). The mess is that **the boundary is fuzzy and the naming lies**:

- **Squircles named "circle"** and **squircles named "pill"** render as neither.
- **Circles are built four+ different ways**, only one of which is idiomatic.
- **Token bypass**: literals used where a token exists (`100` for pill; `12/16/4`
  for the scale).

The dominant language is healthy — **squircle** for containers/cards/tiles/rows,
**pill** for buttons/chips, **circle** for avatars/FABs/discs/dots. The fix is to
make the *boundary* crisp and route every shape through one source of truth.

## Counts (≈150 sites)

| shape | count | notes |
|-------|-------|-------|
| Squircle | ~73 | the workhorse — cards, tiles, rows, sheets, inputs |
| Pill / capsule | ~39 | buttons, chips, badges |
| Circle | ~27 | avatars, FABs, discs, location pucks |
| Dot / hairline | ~11 | indicators, marker trails, skeleton lines |

## The canonical vocabulary (what's already correct)

- **Circle** = `radii.pill` (999) on a square element. Used right by:
  `FloatingActionButton`, `ClusterMarker`, `EdgeIndicator`, fuel `stepBtn`,
  `PageControl` dot (via `radii.xs` = exact half). **One token, shape set by
  aspect: pill-on-square = circle, pill-on-wide = capsule.** No new token needed.
- **Pill / capsule** = `radii.pill` on a content-/min-height element.
  `Button`, `SearchBar`, every `…Btn`/`…cta`, `DragHandle`.
- **Squircle** = the `radii` scale (`xs 4 / sm 8 / md 12 / lg 16 / xl 20 /
  sheet 28`) on cards/tiles/rows.

Everything below deviates from this.

---

## Findings, grouped as a remediation checklist

### 1. Misnamed "circle" — actually a squircle (the headline)
`iconCircle`: **36×36 at `radii.lg` (16)** → squircle (a circle needs r≥18). The
name lies, and it's **triplicated**:
- `app/roadside.tsx:843`
- `app/unfamiliar.tsx:565` (comment: "Matches /roadside's iconCircle")
- `components/FuelStopMarker.tsx:75` (+ `iconCirclePreferred`, `iconCircleSelected`)

→ **Rename `iconTile`, dedupe into one shared style.** (Keep it a squircle —
iOS-Settings leading-icon register. This is the row-icon decision.)

Also mis-shaped-by-name:
- `emergency.tsx:614 stopChrome` — comment says "circle," is a 44×44 r20 squircle.
- `recordings.tsx:693 confirmCloseCircle` — named circle; round only because
  `radii.lg`(16) coincidentally = 32/2. Token-misuse circle.
- `NotifyingPulse` / `UserLocationMarker`: `pulse` (28×28 r12) and `innerDot`
  (18×18 r8) are named round but render as soft squares (need ≥14 / ≥9).

### 2. Misnamed "pill" — actually a squircle
- `en-route.tsx:355 labelPill` — `radii.sm` (8) → squircle, not a capsule.
- `HomeBrowseSheet.tsx:1774 ratingPill`, `:1826 openPill` — `radii.xs` (4) →
  tight squircle chips, not capsules.

→ Drop "pill" from these names (or make them real pills if a capsule was intended).

### 3. Circles built off-token (no single circle idiom)
True circles that bypass `radii.pill`, by mechanism:

**Bespoke half-width literals** (fragile — break if the size changes):
- `menu.tsx:578 profileAvatar` 80→`40`
- `emergency.tsx:576 countdownDisc` 88→`44`
- `pulled-over.tsx` avatar rings 160→`80`, 140→`70`, 128→`64`
- `LifelineModal.tsx` 152→`76`, 132→`66`
- `LiveSafetySheet.tsx:290 avatar` 40→`20`
- `home.tsx:4142 placementCancel` 48→`24` (comment: "circular FAB")
- `en-route.tsx:2516 sosHoldRing` 64→`32`
- `trip-summary.tsx:475 inferenceBtn` 44→`22`
- `EnRouteCarMarker.tsx` ×5 via `SIZE/2` (puck/core/crescent/trail1/trail2)
- `NotifyingPulse.tsx:112` & `UserLocationMarker.tsx:112` `outerRing` 24→`12`

**Token-misuse circles** (round only by coincidence — `token == half-width`):
- `recordings.tsx:593 playButton` 56→`radii.sheet`(28)
- `trusted-contact-setup.tsx:394 avatar` 56→`radii.sheet`(28)
- `HomeBrowseSheet.tsx:1723 toplineAvatar` 20→`radii.md`(12)

→ **Route every fully-round square through `radii.pill`.** Kills the fragility and
the `radii.sheet`-doing-double-duty risk (a future `sheet` change would silently
de-circle the avatars).

### 4. Capsule literal `100` instead of `radii.pill` (en-route is the outlier)
`en-route.tsx` hand-rolls `borderRadius: 100` for four pills where every other
file uses `radii.pill`:
- `:2618 offlinePill`, `:2821 fuelStopsDueBadge`, `:2894 routeBadge`, `:2914 endTripBtn`

→ Replace `100` → `radii.pill`.

### 5. Off-scale squircle literals (equal an existing token)
Literal where the token exists — pure search-and-replace:
- `FuelStopsSheet.tsx:293 dueBanner` `12`→`radii.md`
- `menu.tsx:639 tileCard` `12`→`radii.md`
- `pulled-over.tsx:2257 illustrationBox` `12`→`radii.md`; `:2214 dotActive` `4`→`radii.xs`
- `HomeBrowseSheet.tsx:1622 card` `12`→`radii.md`; `:1846 empty` `12`→`radii.md`; `:1645 skelLine` `4`→`radii.xs`
- `home.tsx:3674 devResetChip` `16`→`radii.lg`

### 6. Off-family squircle radius
- `HomeBrowseSheet.tsx:1524 chip` uses `radii.xl`(20) — the lone xl chip; every
  other chip/tag uses pill or `sm/xs`. → align to the chip family.

### 7. Button shape divergence
- `HomeBrowseSheet.tsx:1583 showAllBtn` is a `radii.md` button while the shared
  `Button` CTA is a pill. Two button shape languages. → pill, or document why.

### 8. Duplicated shape styles (fix once, in one place)
- `iconCircle` ×3 (see #1)
- `twoLineRow` / `answerCard` — same elevated-white safety card in
  `unfamiliar.tsx:541`, `share-location.tsx:318`, `pulled-over.tsx` (`answerCard`)
- `NotifyingPulse` ≈ `UserLocationMarker` — near-identical pulse/ring/dot trio

---

## Proposed convention (the rule to adopt)

1. **Fully round = `radii.pill`, always.** Square → circle, wide → capsule. No
   bespoke half-width literals, no `100`, no `radii.sheet`-as-circle. One token.
2. **Squircle = the `radii` scale**, never a literal that equals a token.
3. **Row leading-icon containers stay squircles** (`radii.lg`, renamed `iconTile`)
   — iOS-Settings register, distinct from avatars (circles).
4. **Names must match shape.** No `…Circle` that's a squircle, no `…Pill` that's
   a tight chip, no `…Dot` that's a soft square.
5. **Dedupe** the three repeated shape styles into shared definitions.

## Remediation plan (phased — the radii.ts header already defers the literal sweep)

- **Phase 1 (mechanical, low-risk):** §4 (`100`→pill), §5 (off-scale literals→tokens).
  Pure token adoption, no visual change. ~12 sites.
- **Phase 2 (circle unification):** §3 — route all bespoke/misused circles through
  `radii.pill`. No visual change (same shape), removes fragility. ~20 sites.
- **Phase 3 (naming + dedupe, touches structure):** §1, §2, §8 — rename
  `iconCircle`→`iconTile`, fix the "pill"/"dot" misnomers, dedupe the 3 repeated
  styles. The only phase with rename blast-radius; do as its own PR.
- **Phase 4 (judgment nits):** §6 (xl chip), §7 (showAllBtn) — confirm intent.

Net: the squircle/pill/circle split is sound; this makes the boundary crisp and
gives every shape one source of truth.
