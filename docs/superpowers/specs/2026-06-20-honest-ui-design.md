# Honest UI — Design Spec

**Date:** 2026-06-20
**Status:** Approved (brainstorm complete; awaiting plan)
**Phase:** Design Health Program — Phase 3 PR E (final fix PR before the closing audit)
**Synthesis source:** [`phase-1-findings/2026-06-19-cross-screen-synthesis.md`](phase-1-findings/2026-06-19-cross-screen-synthesis.md) Section 5

---

## Goal

Close the last two Phase 1 fix items in the Design Health Program. Both are about **dead or dishonest UI** — surfaces that show wrong/missing information or misframe an affordance:

1. **P1-10 — en-route static speed-limit "—"** — a posted-speed sign that has shown a dash since launch because OSM `maxspeed` was never wired. Per the synthesis: *"Affordance teaches users to distrust other data signals."*
2. **P1-11 — pulled-over "Add a contact" mid-stop recovery too subtle** — the empty contact slot looks like a configured-but-anonymous identity, not a call to action. Per the synthesis: *"Needs explicit pill-outline button affordance."*

After PR E ships, all 13 Phase 3 items are shipped and only the program's closing audit remains.

## What's actually true today (verified)

### P1-10
The en-route speed display has TWO elements stacked in `speedLimitWrap`:

- **`speedLimitCurrentPill`** (lines 1998–2003) — shows the user's CURRENT GPS-derived speed. Driven live by `pos.coords.speed → speedMph` (`app/en-route.tsx:452` state, `:1422` `pos.coords.speed` consumer). Renders `{speedMph ?? '—'}` and is correct.
- **`speedLimitSign`** (lines 2004–2018) — the regulation-styled white-box sign meant to show OSM posted limit. The `accessibilityLabel="Speed limit unknown"` admits the dead state, and the comment at `:1999` notes "zones adapter yet, so the limit-sign renders '—'…". `speedSignCaution` at `:923` flips the sign yellow inside caution zones (`speedLimitSignCaution`); only consumed by the sign itself.

The synthesis suggested "repurpose for current speed" — but current speed is already on the screen via the pill. Repurposing would duplicate. **Pure removal is correct.**

### P1-11
`app/pulled-over.tsx` lines 1075–1115 render an avatar block with a `Pressable` wrapping the whole stack (avatar + label below). The current visual:

- `avatarRingMiddle` (140pt, 3pt freshgreen border, no fill).
- `avatarCircle` inside (128pt, **`wiltedgreen` filled**) — when `hasContact`: renders white initials; when empty: renders `<UserPlus size={56} color={colors.white} weight="duotone" />`.
- `contactName` text below — when `hasContact`: the name; when empty: `'Add a contact'` (`NO_CONTACT_NAME` at line 159), styled `title2Regular` `black`.

The accessibilityLabel is already correct (`'Add a trusted contact'` when empty). The Pressable's tap surface is ~140pt — far above 44pt. The problem is purely visual: a filled wiltedgreen circle reads as a **populated identity** (someone's slot), not as an **empty slot wanting filling**. The fill register misframes the affordance.

## The principle (already in the codebase)

The Button component encodes a register the rest of the app inherits: **fill = primary identity / commitment; outline = invitation / secondary**. Applying that to the pulled-over avatar: when empty, the avatar should read as outline-style. No new chrome — just a property flip on the existing structure.

---

## Scope

**2 atomic commits, 2 files modified.** Low-blast, no new deps, no new tokens, no `.cursorrules` codification (these are screen-local visual decisions; the fill-vs-outline register is already established).

| # | Commit | File | Effort |
|---|---|---|---|
| 1 | `fix(en-route): remove dead speed-limit sign (current speed already shown via pill)` | `app/en-route.tsx` | small |
| 2 | `fix(pulled-over): outline register for empty contact avatar` | `app/pulled-over.tsx` | small |

**Out of scope (deliberate):**
- Restoring the posted speed-limit sign when OSM `maxspeed` is wired (future feature; record as a `next-session.md` note so the design isn't lost).
- Any redesign of the configured-state avatar — only the empty state changes.
- Any change to the existing `accessibilityLabel` (already a verb-object CTA on the empty avatar).

---

## Design

### Commit 1 — remove the dead speed-limit sign

**Delete from `app/en-route.tsx`:**

1. The `speedSignCaution` boolean at `:923`:
   ```ts
   const speedSignCaution = inCautionZone || turnHazards.length > 0;
   ```
   Only the sign consumes it.

2. The entire sign render block (`:2004`–`:2018`):
   ```tsx
   <View
     style={[
       styles.speedLimitSign,
       speedSignCaution && styles.speedLimitSignCaution,
     ]}
     accessible
     accessibilityLabel="Speed limit unknown"
   >
     <Text style={styles.speedLimitNumber} numberOfLines={1}>
       —
     </Text>
     <Text style={styles.speedLimitUnit} numberOfLines={1}>
       MPH
     </Text>
   </View>
   ```

3. Four dead styles in the StyleSheet:
   - `speedLimitSign`
   - `speedLimitSignCaution`
   - `speedLimitNumber` (including the `// dynamic-type exempt` tag on it — PR 8's tag follows the style)
   - `speedLimitUnit`

**Keep:**
- `speedLimitWrap` (now a single-child container holding just the pill).
- `speedLimitCurrentPill` style.
- `speedLimitCurrentNumber` style with its `// dynamic-type exempt` tag.
- The pill JSX (`{speedMph ?? '—'}`).

**Update the relevant comment** (the `// Speed-limit sign (posted limit from OSM): white normally …` comment block above the now-removed sign): replace with a brief note documenting the removal and the rationale (point to this spec).

Net diff: ~30 lines removed, ~3 lines added (the replacement comment). No behavior change beyond removing a dead element. Layout: the pill stays in the same screen position; the wrap is now single-child.

### Commit 2 — outline register for empty contact avatar

**Two new styles in `pulled-over.tsx`'s `contactStyles` block:**

```ts
avatarCircleEmpty: {
  // Empty-state register: outline instead of fill (matches Button's
  // outline variant — invitation, not identity). Replaces the
  // wiltedgreen fill with a 2pt freshgreen border. Per Phase 1 P1-11.
  backgroundColor: 'transparent',
  borderWidth: 2,
  borderColor: colors.freshgreen,
},
contactNameEmpty: {
  ...typography.bodyEmphasized,
  color: colors.freshgreen,
  textAlign: 'center',
},
```

**Three small render-conditional changes (lines ~1097–1115):**

(a) `avatarCircle`'s style array:
```tsx
<View
  style={[
    contactStyles.avatarCircle,
    !hasContact && contactStyles.avatarCircleEmpty,
  ]}
>
```

(b) `UserPlus` color flips from `colors.white` to `colors.freshgreen` (the empty branch is the only one that renders `UserPlus`, so this is a simple constant swap, not a conditional):
```tsx
<UserPlus
  size={56}
  color={colors.freshgreen}
  weight="duotone"
/>
```

(c) `contactName` text gets the empty-state style:
```tsx
<Text
  style={[
    contactStyles.contactName,
    !hasContact && contactStyles.contactNameEmpty,
  ]}
>
  {displayName}
</Text>
```

The Pressable wrapping the whole block, the `accessibilityLabel`, the `avatarRingMiddle`, the `avatarStack`, the pulse-ring (`hasContact &&`-gated already), and `handleAddContact` are all unchanged.

When `hasContact`: every branch evaluates to the original style — visual unchanged.

When `!hasContact`: avatar reads as `transparent` with a `freshgreen` outline + `freshgreen` UserPlus glyph + `freshgreen` emphasized "Add a contact" label — the register flip communicates "this slot is empty and waiting for you" without new chrome.

---

## Testing

- `tsc --noEmit` clean after each commit.
- **Smoke (user's responsibility):**
  - `/en-route`: speed display shows only the live current-speed pill; no dead "—" sign below it. Layout above the bottom sheet is uncluttered.
  - `/pulled-over` cold (no trusted contact set): avatar reads as a freshgreen-outlined circle with a freshgreen `+` person glyph; "Add a contact" below in freshgreen-emphasized. Tap navigates to `/trusted-contact-setup`.
  - `/pulled-over` with contact set: avatar visual unchanged (wiltedgreen filled, white initials, black name, freshgreen middle ring, optional pulse).
- VoiceOver: the empty avatar's `accessibilityLabel="Add a trusted contact"` reads as a verb+object CTA — no hint needed.

---

## Files

- **Modify:** `app/en-route.tsx` (Commit 1)
- **Modify:** `app/pulled-over.tsx` (Commit 2)
- **Modify:** `docs/next-session.md` — append a one-line note recording the deferred OSM `maxspeed` wiring so the posted-sign restoration isn't lost.
- **Untouched (deliberate):** every other screen, every shared component, `theme/`, `.cursorrules`, every hook.

## Verification (definition of done)

- [ ] `tsc --noEmit` passes after every commit.
- [ ] `app/en-route.tsx` has no `speedSignCaution`, `speedLimitSign`, `speedLimitSignCaution`, `speedLimitNumber`, or `speedLimitUnit` references remaining.
- [ ] `app/en-route.tsx` retains `speedMph`, `speedLimitCurrentPill`, `speedLimitCurrentNumber` with its existing `// dynamic-type exempt` tag.
- [ ] `app/pulled-over.tsx` has new `avatarCircleEmpty` + `contactNameEmpty` styles; the avatar and label render-conditionals apply them only when `!hasContact`.
- [ ] `UserPlus` glyph color is `colors.freshgreen` in the empty branch.
- [ ] No reserved-color violation; no `hitSlop` introduced; no new shared component.
- [ ] `docs/next-session.md` has a one-line "restore posted speed-limit sign when OSM `maxspeed` adapter ships" note in the appropriate section.

## Sequencing

PR E of Phase 3, low-blast-first:

1. `fix(en-route): remove dead speed-limit sign (current speed already shown via pill)` — dead-code removal.
2. `fix(pulled-over): outline register for empty contact avatar` — register flip on the empty state.
3. `docs(next-session): defer posted speed-limit sign restoration (OSM maxspeed wiring)` — one-line note so the design isn't lost.
4. Verify + PR.

After PR E merges, all 13 Phase 3 fix items are shipped. The program then enters its **closing audit phase** — a thorough cross-screen critique pass verifying that the program's investments hold up under the same lens that started it. That audit is itself the program's exit ramp.
