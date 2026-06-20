# Dynamic Type Guard — Design Spec

**Date:** 2026-06-20
**Status:** Approved (brainstorm complete; awaiting plan)
**Sprint:** Design Health Program — Phase 2 Sprint 3, PR 1 of 3 (the architectural cluster: 8 → 9 → 6)
**Synthesis source:** [`phase-1-findings/2026-06-19-cross-screen-synthesis.md`](phase-1-findings/2026-06-19-cross-screen-synthesis.md) Section 4, "Dynamic Type Coverage"

---

## Goal

Guard against hardcoded font sizes that bypass the project's Dynamic Type scaling. Every styled text is supposed to route through `dynamicType(typography.X)` so iOS "Larger Text" scales the app (WCAG 1.4.4 Resize Text, Level AA). A raw `fontSize: N` in a StyleSheet silently bypasses that — the text won't scale for low-vision, older, or stressed drivers. For a safety app serving vulnerable users, text that doesn't scale is an exclusion bug, not cosmetic polish.

## The finding: 0 genuine misses

The audit is a ripgrep sweep: `rg "fontSize:" app/ components/` (excluding `theme/`). It returns **3 raw-fontSize sites, all intentional fixed-size** — there are no genuine misses to fix.

The `dynamicType()` JSDoc already encodes the exception policy, citing Apple HIG verbatim: *"Make sure all text scales… unless the text is part of a logo or has a fixed aspect ratio."* All 3 sites fall under that fixed-aspect/display carve-out:

| Site | Value | What | Currently |
|---|---|---|---|
| `app/en-route.tsx` `speedLimitCurrentNumber` | `fontSize: 24` | Current-speed glyph (Overpass-Bold signage stand-in) | Commented re: typeface; **not** tagged exempt |
| `app/en-route.tsx` `speedLimitNumber` | `fontSize: 32` | Posted speed-limit sign number | Commented re: register; **not** tagged exempt |
| `components/LifelineModal.tsx` `avatarText` | `fontSize: 44` | Avatar initials (display-scale identity element) | **Already documented** as a fixed-size exception in-code |

This is the same shape as the reserved-color audit (PR 10): the codebase is already compliant, so the PR's value is **codifying the convention + sanctioning the exceptions**, not fixing.

## Why each exception is legitimate (not a bug)

- **Speed-limit sign numbers** — US speed-limit signage is fixed-proportion (regulation Overpass Bold on a bordered sign). Scaling the digits with Dynamic Type would overflow the sign's SVG/border box and break the road-sign metaphor (the whole point is that it *looks like* a posted sign). Apple HIG's "fixed aspect ratio" carve-out applies directly.
- **Lifeline avatar initials** — a 44pt display-scale identity element inside a fixed 132pt avatar ring. The ring is a visual element, not body copy; no typography-ramp token reaches 44pt (largest is `title2Emphasized` ~28pt); a single initial won't clip. The existing in-code comment already explains this.

## Tooling reality (why the guard is documentation, not a linter)

- **No ESLint** — not in `package.json`, no config file, no lint script. Standing up ESLint for a single rule is far too heavy for a cheap win.
- **No `.cursorrules` Dynamic Type rule** — the convention lives *only* in the `dynamicType()` JSDoc. There is no entry in the cardinal rulebook.
- **Enforcement model that already works here** — the reserved-color rule (the project's most-guarded invariant) is enforced by a `.cursorrules` rule + `rg` during review + inline `// reserved-color sanctioned` pointers, with no tooling. This PR mirrors that exact model: a documented rule + `rg "fontSize:"` during review + inline `// dynamic-type exempt` pointers. (A pre-commit grep-hook was considered and rejected: more moving parts + allowlist maintenance + false-positive risk, for a codebase that's already clean.)

---

## Design

**2 atomic commits, 3 files, zero behavior change** (`.cursorrules` prose + code comments only).

### Commit 1 — `.cursorrules`: add the Dynamic Type rule

Add a new section to `.cursorrules` (in the typography region of the rulebook), wording canonical:

> **## Dynamic Type (text scaling)**
>
> All styled text must scale with iOS Settings → Display & Text Size → Larger Text, per WCAG 1.4.4 (Resize Text, Level AA). The mechanism is `dynamicType(typography.X)` from `theme/dynamic-type.ts` — it scales both `fontSize` and `lineHeight` (React Native's `allowFontScaling` alone won't scale an explicit `lineHeight`). Spread it into every text style: `...dynamicType(typography.bodyRegular)`. For stress-state long reads, compose `dynamicType(relaxedLineHeight(typography.X))` (relax first, scale second).
>
> **Raw `fontSize:` in a StyleSheet is forbidden** — it bypasses scaling and excludes low-vision users. Exception: fixed-aspect logo/signage/display text, where scaling would break the metaphor or push fixed-position UI off-screen (per Apple HIG: "unless the text is part of a logo or has a fixed aspect ratio"). Sanctioned exceptions, each tagged in-code with `// dynamic-type exempt`:
>
> 1. **Speed-limit sign numbers** (`/en-route` `speedLimitCurrentNumber` 24pt, `speedLimitNumber` 32pt) — US speed-limit signage is fixed-proportion (Overpass Bold on a regulation sign); scaling overflows the sign SVG and breaks the road-sign metaphor.
> 2. **Lifeline avatar initials** (`LifelineModal` `avatarText` 44pt) — a display-scale identity element (the ring is visual, not body text); no typography-ramp token reaches 44pt, and a single initial won't clip.

No other line of `.cursorrules` changes.

### Commit 2 — inline `// dynamic-type exempt` pointers at the 3 sites

Mirror the `// reserved-color sanctioned` precedent so a future `rg "fontSize:"` sweep self-documents. All three share one greppable marker string (`dynamic-type exempt`).

`app/en-route.tsx` `speedLimitCurrentNumber` — add a comment above `fontSize: 24`:

```ts
  speedLimitCurrentNumber: {
    // SF Pro Bold stand-in for Overpass Bold (the canonical US speed-
    // limit-sign typeface). Visually close; swap when Overpass loads.
    fontWeight: '700',
    // dynamic-type exempt (.cursorrules): fixed-proportion speed-limit signage
    fontSize: 24,
    lineHeight: 28,
    ...
```

`app/en-route.tsx` `speedLimitNumber` — add a comment above `fontSize: 32`:

```ts
  speedLimitNumber: {
    fontWeight: '700',
    // dynamic-type exempt (.cursorrules): fixed-proportion speed-limit signage
    fontSize: 32,
    lineHeight: 36,
    ...
```

`components/LifelineModal.tsx` `avatarText` — prepend the standard tag to its existing exemption comment (so all three share the marker). The existing comment block is preserved; add one tagged line directly above `fontSize: 44`:

```ts
  avatarText: {
    ...typography.title2Emphasized,
    color: colors.white,
    // Avatar initials stay at fixed display-scale — the ring is a visual
    // element, not text needing AX5 scaling. The single character won't clip
    // at this size.
    // dynamic-type exempt (.cursorrules): display-scale avatar identity element
    fontSize: 44,
  },
```

All three are comment-only; no `fontSize`/`lineHeight`/token value changes.

### Out of scope (deliberate)

- **No fixes** — there are no genuine misses. The 3 sites are intentional fixed-size and stay as-is (only gaining a tag comment).
- **No ESLint, no pre-commit hook** — the chosen guard is the documented rule + review-time `rg`, per the reserved-color model. (Mechanical tooling is a separate, heavier infra decision if ever wanted.)
- **No typography-token changes** — `theme/typography.ts` and `theme/dynamic-type.ts` are untouched.

---

## Testing

- **`tsc --noEmit`** clean (comment-only code changes can't break types; run to be safe).
- **No runtime smoke needed** — zero behavior change; the app renders byte-identically.
- **Re-run the sweep** as verification: `rg "fontSize:" app/ components/` still returns the same 3 sites (now each preceded by a `// dynamic-type exempt` line). Confirm the code diff added only comments.

---

## Files

- **Modify:** `.cursorrules` (new Dynamic Type section)
- **Modify:** `app/en-route.tsx` (two `// dynamic-type exempt` comments on `speedLimitCurrentNumber`, `speedLimitNumber`)
- **Modify:** `components/LifelineModal.tsx` (one `// dynamic-type exempt` comment on `avatarText`)
- **Untouched (deliberate):** `theme/dynamic-type.ts`, `theme/typography.ts`, all scaling-compliant text styles

## Verification (definition of done)

- [ ] `.cursorrules` has a new "Dynamic Type (text scaling)" section with the wording above (rule + the 2 sanctioned exceptions)
- [ ] `en-route.tsx` `speedLimitCurrentNumber` and `speedLimitNumber` each have a `// dynamic-type exempt (.cursorrules)` comment; the `fontSize` values (24, 32) and `lineHeight` (28, 36) are unchanged
- [ ] `LifelineModal.tsx` `avatarText` has the `// dynamic-type exempt (.cursorrules)` tag; `fontSize: 44` unchanged
- [ ] `tsc --noEmit` passes
- [ ] No `fontSize`/`lineHeight`/token value changed anywhere — code diff is exactly three comment lines across two files
- [ ] `theme/dynamic-type.ts` and `theme/typography.ts` not in the diff

## Sequencing

PR 1 of 3 in Sprint 3 — smallest-first. Within it, low-blast-first:

1. **`docs(cursorrules): add Dynamic Type text-scaling rule + signage exceptions`** — `.cursorrules` only.
2. **`docs(dynamic-type): tag the three fixed-size signage/display exemptions`** — `en-route.tsx` + `LifelineModal.tsx` comments.
3. **verify + PR.**

PR 8 is the first of Sprint 3. Next: PR 9 (dismissal standardization — the medium audit), then PR 6 (VoiceOver hint depth — the judgment-heavy one), closing Phase 2.
