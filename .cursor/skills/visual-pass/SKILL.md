---
name: visual-pass
description: >-
  Fresh Greens optical micro-layout pass for React Native screens. Use when the
  user invokes /visual-pass, when a UI PR touches meta rows, sheets, chips, or
  label/value layouts, or when critique/audit passed but spacing still looks
  "off." Complements Impeccable critique (voice/IA) and audit (tokens/a11y) —
  does NOT replace them. Modes: quick (diff-scoped per PR) and round (hub screens
  every ~5 PRs).
version: 1.0.0
user-invocable: true
argument-hint: "[quick|round] [optional: file or route]"
---

# Visual pass — optical layout (Fresh Greens)

Fix-forward micro-layout review for React Native + Expo (iPhone-first). Measures whether pixels *look* aligned — not whether copy *feels* right or tokens *exist*.

## Invocation

```
/visual-pass quick [touched files or routes]
/visual-pass round
```

| Mode | When | Scope | Artifact |
|------|------|-------|----------|
| **quick** | Every UI PR (§6 Tier A) | Diff-scoped: changed routes, components, sheets | Inline fixes or small PR on same branch |
| **round** | Every ~5 PRs, with `/impeccable critique` round (§12b/§12c Tier B) | Hub screens + shared components (list below) | `.impeccable/VISUAL-PASS-<YYYY-MM-DD>.md` |

Default to **quick** when mode is omitted and the user is mid-PR.

## Hard invariants

1. **NOT critique.** Do not re-score voice, hierarchy, calm-companion register, IA, Nielsen heuristics, or slop tells. Defer to `/impeccable critique`.
2. **NOT audit.** Do not re-score `dynamicType`, theme tokens, tap targets, reserved-color grep, or WCAG checklist items. Defer to `/impeccable audit`.
3. **Optical/layout focus.** Interpunct geometry, mixed-weight rhythm, flex illusions, baseline alignment, chip internal padding, sheet title blocks, truncation balance.
4. **React Native specific.** `Text` siblings, `flexDirection: 'row'`, `gap`, `lineHeight`, `numberOfLines`, `StyleSheet` — not CSS `ch`, `grid`, or web-only patterns.
5. **Fix-forward on quick.** Prefer applying the fix in the same branch when the change is localized (MetaSeparator swap, spacing token). Log P2 deferrals; do not block merge for optical nits outside the diff.
6. **Read before grep.** Confirm the row is a *rendered* meta cluster, not VoiceOver copy, announcement strings, or settings prose.

## Three review layers

| Layer | Command / skill | Inspects | Misses (visual-pass fills) |
|-------|-----------------|----------|----------------------------|
| **Critique** | `/impeccable critique` | Voice, hierarchy, IA, cognitive load, slop, holistic "feels right" | Optical separator geometry; mixed-weight rhythm on one line; flex `gap` asymmetry around `·` |
| **Technical audit** | `/impeccable audit` | `dynamicType`, theme tokens, tap targets, a11y roles, reserved-color grep | Inline `·` in strings — grep sees the character but not asymmetric neighbor spacing |
| **Visual pass** | `/visual-pass` | Meta separators, label/value rows, flex mistakes, chip/sheet micro-layout | Voice/copy/IA (critique); token violations (audit) |

**When to run each**

| Situation | Run |
|-----------|-----|
| New screen or structural UX | critique + audit + visual-pass quick |
| Token/copy fix on existing layout | audit + visual-pass quick if meta rows touched |
| Every ~5 PRs / design round | critique round + visual-pass round + §12b Figma fidelity |
| "Looks off" but audit/critique clean | visual-pass quick on the surface |

---

## Quick mode workflow

### 1. Scope the diff

```bash
git diff --name-only main...HEAD
# or for uncommitted:
git diff --name-only
```

Intersect with `app/`, `components/`. Skip pure `lib/`, `docs/`, `theme/` unless a shared layout primitive changed.

### 2. Run grep recipes (below)

Run all recipes against changed files first; expand to repo only when a pattern is endemic.

### 3. Simulator glance

On Expo Go or iOS Simulator, open each touched route. Zoom attention to:
- Meta rows (distance · time · rating)
- Sheet title + subtitle stack
- Chip/pill rows
- Label/value settings rows
- Truncated trailing meta

### 4. Fix or log

- **P1 (fix now):** Asymmetric `·` on a shipped meta row in the diff; wrong flex breaking mixed weights.
- **P2 (log):** Same pattern outside diff scope; picker chip labels needing Figma confirm; settings summary prose.

### 5. Verify

```bash
npx tsc --noEmit 2>&1 | grep -vE "menu\.tsx.*avatar\.png|proxy/api"
```

---

## Round mode workflow

### 1. Hub screen list

Pass every route and shared overlay in this list. Add new hubs when a route becomes a primary navigation destination.

**Routes (`app/`)**

| Route | Focus |
|-------|-------|
| `/home` | Route-preview meta cluster, zone chips, map-overlay card padding |
| `/en-route` | Bottom-sheet distance · duration, offline pill, side-button column |
| `/roadside` | Contact · notified-time row, tow-pick result meta |
| `/report` | Report flow sheets, severity chips (optical padding only) |
| `/menu` | Settings row density, destructive row alignment |
| `/search` | Recent/saved/gas result meta rows |
| `/trip-summary` | Stacked stats (confirm not inline meta) |
| `/pulled-over` | Recording · timer chip |
| `/recordings` | Card timestamp meta |
| `/emergency` | SOS disc spacing (map-overlay register) |
| `/fuel` | Vehicle picker chip labels |
| `/safety-settings` | Summary rows (prose vs meta) |

**Shared components (`components/`)**

| Component | Focus |
|-----------|-------|
| `HomeBrowseSheet` | Facet pill meta, category tags |
| `LiveSafetySheet` | Collapsed session · duration pill |
| `RouteComparisonSheet` | Arrival · distance meta |
| `FuelStopsSheet` | Price · distance · along route |
| `ReportDetailCard` | Category · tag · time subline |
| `NotifyingPulse` | `labelParts` + separators |
| `MetaSeparator` | Helper correctness |
| `DaylightRouteLegend` | Legend row alignment (no middots) |

### 2. Full checklist

Work through every category below on each hub. Mark N/A when the surface has no instance.

### 3. Write synthesis

Create `.impeccable/VISUAL-PASS-<YYYY-MM-DD>.md`:

```markdown
# Visual pass — <short theme> (<YYYY-MM-DD>)

Branch: `<branch-name>`

## Critique vs visual pass

| Layer | What it inspects | What it misses |
|-------|------------------|----------------|
| **Impeccable critique** | … | … |
| **Technical audit** | … | … |
| **Visual pass (this work)** | … | … |

## Results

| Screen / component | Issue | Severity | Fixed? | Notes |
|--------------------|-------|----------|--------|-------|
| `app/home.tsx` | … | P1 | Yes | … |

## Counts

- **Screens/components reviewed:** N
- **Fixed:** N
- **Logged P2 / N/A:** N

## Verification

- `npx tsc --noEmit` — pass/fail
```

Severity: **P1** = visible optical bug on shipped meta/layout; **P2** = defer / needs design confirm; **N/A** = surface has no relevant pattern.

---

## Checklist categories

Work top to bottom on each surface. Each item includes what audit/critique typically miss.

### 1. Meta separators (`·` inline vs `MetaSeparator` / `joinMetaParts`)

**Symptom:** Middot sits closer to the bolder or larger neighbor.

**Root cause:** String-embedded `·` (`"8:30 · 12 mi"`) or `flex` `gap` between `Text` siblings without symmetric padding on the separator glyph.

**Check:**
- [ ] Multi-part meta uses `joinMetaParts([...])` or explicit `<MetaSeparator />` between `Text` siblings
- [ ] No leading `"· "` inside a meta string
- [ ] Separator is its own `Text` node with `paddingHorizontal: spacing.xs` (owned by `MetaSeparator`)
- [ ] `accessibilityElementsHidden` on separator; full phrase in parent `accessibilityLabel` if needed

**Do not fix:** Comma-joined a11y strings; announcement copy; single-field prose ("Black-owned business").

### 2. Mixed-weight single-line rhythm

**Symptom:** Emphasized + regular tokens on one row feel "bumpy" even with equal `gap`.

**Check:**
- [ ] Intentional weight split documented (e.g. arrival subheadline + distance footnote)
- [ ] Shared `flexDirection: 'row'`, `alignItems: 'center'` on the cluster
- [ ] Weights from `typography.*` tokens, not inline `fontWeight`
- [ ] `MetaSeparator` uses `subheadlineRegular` — not the heaviest neighbor weight

### 3. Flex gap vs optical spacing

**Symptom:** `gap: spacing.xs` looks even in DevTools but lopsided optically.

**Check:**
- [ ] Interpunct spacing owned by `MetaSeparator` padding, not row `gap` alone
- [ ] Row `gap` only between major beats (icon ↔ text block), not between meta tokens
- [ ] No numeric literals where `spacing.*` exists (`gap: 2`, `paddingHorizontal: 8`)

### 4. Label/value row alignment

**Symptom:** Value sits high/low vs label; trailing value wraps awkwardly.

**Check:**
- [ ] `alignItems: 'baseline'` or `'center'` chosen deliberately (baseline for text pairs)
- [ ] Label column `flexShrink: 0` or `flex: 1` per pattern; value `flexShrink: 1` when truncating
- [ ] `minHeight` only when row must clear 44pt tap target on the *row*, not per glyph
- [ ] Settings-style rows: chevron/accessory vertically centered with label block

### 5. Multi-part meta rows

**Patterns:** `distance · time`, `price · distance`, `category · tag · time`, `date · time`.

**Check:**
- [ ] Each beat is a separate `Text` or `joinMetaParts` entry
- [ ] `numberOfLines={1}` on cluster when row must not wrap
- [ ] Truncation strategy: leading beats preserved vs trailing meta (see §10)

### 6. Chip/pill internal padding and icon+text centering

**Check:**
- [ ] Horizontal padding from `spacing.sm` / `spacing.md`, not literals
- [ ] `flexDirection: 'row'`, `alignItems: 'center'`, `gap: spacing.xs` for icon + label
- [ ] Icon size matches cap height of chip text style (usually 16–20pt for subheadline)
- [ ] Pill border radius consistent with Figma chip family

### 7. Sheet title blocks

**Check:**
- [ ] Title + subtitle vertical gap from `spacing.*` scale
- [ ] Subtitle uses `relaxedLineHeight` + `dynamicType` when multi-line
- [ ] Title1 **Regular** on modal *prompts* (`.cursorrules`) — visual pass checks line rhythm, not weight choice
- [ ] `DragHandle` → title block spacing matches other sheets (compare `HomeBrowseSheet`, `FuelStopsSheet`)

### 8. List row density

**Check:**
- [ ] Separator insets align with label leading edge, not full-bleed unless intentional
- [ ] Trailing accessory (chevron, switch, meta) vertically centered with primary label
- [ ] Multi-line subtitle: primary label top-aligned or centered per house pattern — consistent within screen
- [ ] `MetaSeparator` rows don't increase row height vs single-line meta

### 9. Truncation ellipsis optical balance

**Check:**
- [ ] `numberOfLines={1}` on title; meta cluster truncates as unit or trailing beat drops first — explicit choice
- [ ] Leading title + trailing meta: `flex: 1` on title, meta `flexShrink: 0` or vice versa per design
- [ ] Ellipsis not eating the middot space asymmetrically (meta should use `joinMetaParts`, not one long string)

### 10. Icon+text rows

**Check:**
- [ ] Phosphor glyph box vs text cap height — `alignItems: 'center'` on row
- [ ] Icon color from semantic token (`labelSecondary`, reserved color only per `.cursorrules` carve-outs)
- [ ] 44pt tap target on painted control, not `hitSlop` on bare glyph

### 11. Map-overlay card padding vs FAB clearance

**Check:**
- [ ] Bottom sheet / floating card respects FAB column (`FloatingActionButton` 48pt)
- [ ] Horizontal padding `spacing.md` (16pt grid) on overlay cards
- [ ] Search bar: white + elevation shadow when floating over map; flat tertiary fill when embedded (`.cursorrules`)

### 12. Modal prompt typography (optical)

**Check:**
- [ ] Title1 Regular reads with even line rhythm — `relaxedLineHeight` when prompt wraps
- [ ] Do not "fix" to bold; weight choice is intentional
- [ ] Prompt ↔ first control spacing matches other modals

### 13. Search bar contextual treatment

**Check:**
- [ ] Floating over map: `colors.white` + elevation 3 shadow
- [ ] Embedded on flat surface: tertiary fill, no shadow
- [ ] Same route doesn't mix treatments without state change

---

## Grep / search recipes

Run from repo root. Scope to changed files in **quick** mode.

### Inline middots in strings (primary signal)

```bash
# String literals containing interpunct
rg "'[^']*·[^']*'|\"[^\"]*·[^\"]*\"" app/ components/ --glob '*.tsx'

# Template literals
rg '`[^`]*·[^`]*`' app/ components/ --glob '*.tsx'
```

**Triage:** Rendered meta → fix. `accessibilityLabel`, `announcement`, comment → skip.

### Meta rows without MetaSeparator

```bash
# Files with middot but no MetaSeparator import
rg -l '·' app/ components/ --glob '*.tsx' | while read f; do
  rg -q 'MetaSeparator|joinMetaParts' "$f" || echo "$f"
done
```

### Flex gap on likely meta rows

```bash
rg "gap:\s*spacing\.(xs|sm)" app/ components/ --glob '*.tsx' -B3 -A1
rg "flexDirection:\s*'row'" app/ components/ --glob '*.tsx' -l
```

### Spacing literals (optical drift)

```bash
rg "gap:\s*[0-9]+|paddingHorizontal:\s*[0-9]+|paddingVertical:\s*[0-9]+" app/ components/ --glob '*.tsx'
```

### joinMetaParts adoption

```bash
rg "joinMetaParts|MetaSeparator" app/ components/ --glob '*.tsx' -l
```

### Chip/pill rows

```bash
rg "borderRadius:\s*[0-9]+" app/ components/ --glob '*.tsx' | rg -i 'chip|pill|tag'
```

### Sheet title blocks

```bash
rg "title1|Title1|sheetTitle|modalTitle" app/ components/ --glob '*.tsx' -i
```

---

## Fix patterns

### When to use `MetaSeparator`

Between two or more inline `Text` siblings on the same meta row. The component owns:
- `paddingHorizontal: spacing.xs` on `·`
- `typography.subheadlineRegular` + `labelTertiary`
- `accessibilityElementsHidden`

```tsx
<View style={styles.metaRow}>
  <Text style={styles.arrival}>Arrive 8:30 PM</Text>
  <MetaSeparator />
  <Text style={styles.distance}>12 mi</Text>
</View>
```

### When to use `joinMetaParts`

Three+ beats, optional null filtering, shared styles:

```tsx
<View style={styles.metaRow}>
  {joinMetaParts([price, distance, alongRoute], {
    textStyle: styles.metaText,
    numberOfLines: 1,
  })}
</View>
```

Import from `components/MetaSeparator.tsx`.

### Row container styles

```tsx
metaRow: {
  flexDirection: 'row',
  alignItems: 'center',
  flexWrap: 'nowrap',
},
```

Avoid `gap` between meta tokens; let `MetaSeparator` padding define interpunct spacing.

### Spacing tokens

| Need | Token |
|------|-------|
| Middot side padding | `spacing.xs` |
| Chip horizontal padding | `spacing.sm` / `spacing.md` |
| Sheet title ↔ subtitle | `spacing.xs` or `spacing.sm` per analog sheet |

### Accessibility

Keep comma- or space-joined strings in `accessibilityLabel` when separators are hidden from a11y tree.

---

## Do not fix (boundaries)

| Finding | Owner |
|---------|-------|
| Copy tone, word choice, calm-companion voice | Critique |
| Wrong color token, missing `dynamicType`, raw `fontSize` | Audit |
| Tap target < 44pt painted | Audit |
| Reserved color misuse | Audit + `rg` |
| IA, navigation, feature scope | Critique / human |
| Picker chip label content ("Sedan · 350 mi") without Figma confirm | Log P2 |
| Settings insurance "carrier · policy" summary prose | Log P2 unless design says meta row |
| VoiceOver-only strings with `·` | Leave; use natural speech join |

---

## Relationship to Impeccable commands

After visual-pass fixes that change layout structure, re-run `/impeccable audit` on touched files if you added new `Text` nodes or changed a11y labels — not because optical fixes always need audit, but because separator splits can orphan `accessibilityLabel` coverage.

Do **not** run `/impeccable layout` for middot fixes — use `MetaSeparator` / `joinMetaParts` per this skill.

---

## Example quick session

```
/visual-pass quick app/search.tsx components/ReportDetailCard.tsx
```

1. `rg` middot strings in those files
2. Open `/search` in simulator — check recent row, saved row, gas result meta
3. Replace string middots with `joinMetaParts`
4. `tsc` — done

## Example round session

```
/visual-pass round
```

1. Walk hub list + checklist
2. Write `.impeccable/VISUAL-PASS-2026-06-25.md`
3. Fix P1s on `chore/visual-pass-round-N` branch or log P2s in `docs/next-session.md`
