# Reserved-Color Audit — Design Spec

**Date:** 2026-06-20
**Status:** Approved (brainstorm complete; awaiting plan)
**Sprint:** Design Health Program — Phase 2 Sprint 2, PR 4 of 4 (the closer)
**Sprint plan:** [`docs/superpowers/specs/2026-06-19-design-health-sprint-2-plan.md`](2026-06-19-design-health-sprint-2-plan.md)
**Synthesis source:** [`phase-1-findings/2026-06-19-cross-screen-synthesis.md`](phase-1-findings/2026-06-19-cross-screen-synthesis.md) Section 4, "Reserved-Color Discipline"

---

## Goal

Audit every use-site of the reserved/semantic colors against their reserved meanings, and close the audit by codifying the two compliant-but-undocumented uses so the rule stays drift-proof. The reserved-color rule (in `.cursorrules`) is the project's cardinal design invariant: reserved colors are load-bearing **safety signals** (red = recording/alert, orange = hazard, yellow = caution, navy = safety affordance), so an off-semantic use is a thesis-level failure, not a cosmetic one.

## The finding: 0 violations

The audit is a ripgrep use-site sweep (the rule is use-granular, not import-granular — `rg "colors\.(orange|red|yellow|pink|navy)"` per CLAUDE.md, never graphify). It found **26 use-sites, 0 genuine violations.** Every use is either *on-semantic* (the color used for its literal reserved meaning) or covered by one of the rule's 10 existing carve-outs + the cross-link carve-out.

This matches the pattern of the prior three Sprint 2 PRs (5, 7, 4), each of which collapsed a synthesis "fix" estimate to near-nothing on inspection. The reserved-color rule is the most heavily enforced invariant in the project; it was already clean.

So this PR's deliverable is **not** a fix. It is: (a) the recorded census proving compliance, and (b) codifying the two uses that are compliant-in-intent but not yet *named* by a carve-out — so a future `rg` sweep doesn't re-flag them as tribal knowledge.

## Use-site census (the audit result)

`rg "colors\.(orange|red|yellow|pink|navy)\b" app/ components/`. Comment-only matches excluded.

| # | File:line | Token | Element | Disposition |
|---|---|---|---|---|
| 1 | `app/home.tsx:3444` | orange | `WarningDiamond` route-preview zone chip | Carve-out #7 |
| 2 | `app/index.tsx:345` | orange | Brand splash background (sunrise) | Carve-out #1 (has inline pointer) |
| 3 | `app/roadside.tsx:525` | navy | `Siren` "Switch to Pulled-over mode" row | Cross-link carve-out |
| 4 | `app/emergency.tsx:535` | navy | `actionBtnContact` (trusted-contact CTA) | Carve-out #6 (cited in-code) |
| 5 | `components/PreferredStar.tsx:46` | yellow | Filled favorite `Star` | Carve-out #9 |
| 6 | `app/en-route.tsx:2654` | yellow | `speedLimitSignCaution` fill | On-semantic (yellow = caution sign) |
| 7 | `components/zoneCategoryContent.ts:125` | yellow | `'caution'` zone glyph | On-semantic (yellow = caution) |
| 8 | `components/FuelStopMarker.tsx:56` | yellow | Preferred-stop `Star` | Carve-out #9 |
| 9 | `components/FuelStopMarker.tsx:83` | yellow | `iconCirclePreferred` ring | Carve-out #9 (gap — see below) |
| 10 | `app/safety-settings.tsx:102` | red | Emergency-SOS row `Asterisk` → `/emergency` | Cross-link + SOS iconography |
| 11 | `components/SafetyErrorMessage.tsx:57` | red | Safety error copy | Carve-out #8 |
| 12 | `app/get-started.tsx:240` | red | `errorText` | Carve-out #8 |
| 13 | `app/pulled-over.tsx:1676` | red | Recording widget | Carve-out #5 |
| 14 | `app/pulled-over.tsx:1905` | red | Recording waveform | Carve-out #5 |
| 15 | `app/roadside.tsx:800` | red | `modalError` | Carve-out #8 |
| 16 | `components/RecordingSaveErrorBanner.tsx:82` | red | Banner bg (sanctioned in-code) | Carve-out #5/#8 |
| 17 | `components/RecordingSaveErrorBanner.tsx:107` | red | Banner text | Carve-out #5/#8 |
| 18 | `app/trusted-contact-setup.tsx:399` | red | Contact-pick failure copy | Carve-out #8 |
| 19 | `components/zoneCategoryContent.ts:127` | red | `'avoid'` zone glyph | On-semantic (red = alert/avoid) |
| 20 | `app/emergency.tsx:293` | red | SOS `Asterisk` | Emergency-screen SOS |
| 21 | `app/emergency.tsx:539` | red | `actionBtn911` (911 escalation) | On-semantic (red = full alert) |
| 22 | `app/emergency.tsx:576` | red | `countdownDisc` ("dialing now") | On-semantic (emergency alert) |
| 23 | `components/settings/SettingsRow.tsx:171` | red | `destructiveLabel` ("Sign out") | Compliant — **no carve-out names it (gap)** |
| 24 | `app/login.tsx:210` | red | Error text | Carve-out #8 |
| 25 | `components/PreferredStar.tsx` hollow | — | (not-saved star = `labelTertiary`, not reserved) | n/a |
| 26 | `colors.pink` | pink | **never used** (role TBD) | Clean |

(Counts: orange 2, navy 2, yellow 5, red 16 + 1 comment-only, pink 0.)

## The two documentation gaps (what this PR codifies)

Both are compliant-in-intent but not *named* by any carve-out, so a future audit would re-flag them:

- **A. `SettingsRow` `destructiveLabel` red** (census #23) — the destructive-row label color (rendered by /menu's "Sign out" row). iOS-universal destructive-action red (`#FF3B30`), same universal-iconography logic as the error-red (#8) and recording-red (#5) carve-outs. No carve-out enumerates "destructive action labels." Live code (`SettingsRow`'s `destructive` variant, consumed by `app/menu.tsx`).
- **B. `FuelStopMarker` `iconCirclePreferred` yellow border** (census #9) — the on-map sibling of the carve-out #9 favorite-star, but #9's text names only the *star*, not the marker ring.

---

## Design

**2 atomic commits, 3 files, zero behavior change** (docs + comments only).

### Commit 1 — `.cursorrules`: add carve-out #11, broaden #9

Add a new carve-out #11 after the existing #10, in the reserved-color rule's "Documented exceptions" list:

> **11. Destructive-action row labels (red):** a `SettingsRow` with `destructive` (e.g. /menu's "Sign out") renders its label in `colors.red`. iOS-universal convention — destructive/irreversible actions (Delete, Sign out, Remove) use system red `#FF3B30` everywhere on the platform. Same universal-iconography logic as the error-red (#8) and recording-red (#5) carve-outs: the convention is global enough not to compete with the safety-flow signals. Confined to the `destructive` variant; non-destructive rows use label-primary.

Append one sentence to the end of carve-out #9 (after "…stays `labelTertiary` gray."):

> The same favorite-gold extends on-map: `FuelStopMarker`'s `iconCirclePreferred` uses a `colors.yellow` border as the companion to the star — same "saved/preferred" semantic, same iconography logic.

No other line of `.cursorrules` changes. Carve-outs #1–#10 and the cross-link carve-out are already correct and stay verbatim.

### Commit 2 — inline "sanctioned" pointers at the two codified sites

Following the `app/index.tsx:345` precedent (a pointer comment so the next `rg` sweep self-documents and the site isn't re-flagged), add a brief comment at each of the two newly-codified sites. Comment-only — no code changes.

`components/settings/SettingsRow.tsx`, on the `destructiveLabel` style's `color: colors.red`:

```ts
  destructiveLabel: {
    ...dynamicType(typography.bodyRegular),
    // reserved-color sanctioned (.cursorrules #11): iOS-universal destructive red
    color: colors.red,
    textAlign: 'center',
    flex: 1,
  },
```

`components/FuelStopMarker.tsx`, on the `iconCirclePreferred` style's `borderColor: colors.yellow`:

```ts
  iconCirclePreferred: {
    // reserved-color sanctioned (.cursorrules #9): favorite-gold ring, on-map sibling of PreferredStar
    borderColor: colors.yellow,
    borderWidth: 2,
  },
```

### Out of scope (deliberate)

- **No fixes** — there are no violations. The 24 other use-sites are confirmed compliant and untouched.
- **No token renames** to semantic aliases (`colors.hazardOrange` etc.) — high-blast (every use-site changes), Sprint 3 candidate at most.
- **No lint/enforcement tooling** — defer; the rule is already well-enforced by `.cursorrules` + review.
- **No inline pointers at the already-obvious sites** (recording, errors, emergency screen, splash) — those are self-evident or already commented. Only the two genuinely-non-obvious codified sites get pointers (this is the chosen middle, not the "pointers everywhere" option).

---

## Testing

- **`tsc --noEmit`** clean (comment-only code changes can't break types, but run it to be safe).
- **No runtime smoke needed** — zero behavior change. Visual appearance is byte-identical (no color value, token, or layout changed).
- **Re-run the sweep** as verification: `rg "colors\.(orange|red|yellow|pink|navy)\b" app/ components/` returns the same 26 sites; confirm the diff added only comments + `.cursorrules` text.

---

## Files

- **Modify:** `.cursorrules` (carve-out #11 added; #9 extended)
- **Modify:** `components/settings/SettingsRow.tsx` (one comment on `destructiveLabel`)
- **Modify:** `components/FuelStopMarker.tsx` (one comment on `iconCirclePreferred`)
- **Untouched (deliberate):** all 24 other reserved-color use-sites; `theme/colors.ts` (no token change)

## Verification (definition of done)

- [ ] `.cursorrules` has a new carve-out #11 (destructive-action red) with the wording above
- [ ] `.cursorrules` carve-out #9 ends with the appended `FuelStopMarker` sentence
- [ ] `SettingsRow.tsx` `destructiveLabel` has the `#11` pointer comment; the `color: colors.red` value is unchanged
- [ ] `FuelStopMarker.tsx` `iconCirclePreferred` has the `#9` pointer comment; the `borderColor: colors.yellow` value is unchanged
- [ ] `tsc --noEmit` passes
- [ ] No color value, token, or layout changed anywhere — diff is `.cursorrules` text + exactly two code comments
- [ ] `theme/colors.ts` not in the diff

## Sequencing

PR 4 of 4 in Sprint 2 — the closer. Within it, low-blast-first:

1. **`docs(cursorrules): codify destructive-red (#11) + broaden favorite-gold (#9)`** — `.cursorrules` only.
2. **`docs(reserved-color): inline sanctioned pointers at the two codified sites`** — `SettingsRow.tsx` + `FuelStopMarker.tsx` comments.
3. **verify + PR.**

PR 10 closing merges Sprint 2 (PRs 5, 7, 4, 10 all shipped). The next program step is Sprint 3 (PR 6 VoiceOver hint depth, PR 8 Dynamic Type lint, PR 9 dismissal standardization), or the Phase 3 per-screen tail — a fresh scoping decision for a later session.
