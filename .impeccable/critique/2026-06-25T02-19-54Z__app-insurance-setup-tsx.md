---
target: app/insurance-setup.tsx
total_score: 31
p0_count: 0
p1_count: 1
timestamp: 2026-06-25T02-19-54Z
slug: app-insurance-setup-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Scanning and saving show spinners; disabled Save gives no VoiceOver hint for *why*; loading gate hides header/back |
| 2 | Match System / Real World | 4 | Carrier, policy number, scan card — plain insurance vocabulary; privacy footer matches on-device OCR reality |
| 3 | User Control and Freedom | 3 | Back + close-to-home; photo removable; no unsaved-changes guard on close (same as /fuel) |
| 4 | Consistency and Standards | 4 | Grouped-gray + SettingsHeader + RowGroup now matches /fuel and /safety-settings; scan row is bespoke vs SettingsRow |
| 5 | Error Prevention | 3 | Blur + save validation; OCR failure copy is actionable; Save blocked while scanning |
| 6 | Recognition Rather Than Recall | 3 | Footer carries privacy/dev-build context; no on-screen "why" lede (upstream safety-settings footer covers entry) |
| 7 | Flexibility and Efficiency | 3 | Scan path accelerates entry; manual always available; Alert offers camera vs library |
| 8 | Aesthetic and Minimalist Design | 4 | Two RowGroups, no decorative clutter; post-layout-fix shadow issue resolved |
| 9 | Error Recovery | 3 | Field errors specific; scan errors suggest manual fallback; save errors use Alert |
| 10 | Help and Documentation | 3 | RowGroup footer explains OCR limits; dev-build message duplicated in footer + Alert on tap |
| **Total** | | **31/40** | **Good — settings-register solid, a11y polish gaps** |

## Anti-Patterns Verdict

**Not AI slop.** Screen reads as native iOS grouped settings: wiltedgreen section eyebrow, white cards on grouped gray, token-driven typography. No gradient text, glass, eyebrow spam, or identical icon-card grids. Reserved colors used only for errors (sanctioned #8).

**Deterministic scan:** `detect.mjs` on `app/insurance-setup.tsx` returned **0 findings** (clean).

**Browser visualization:** Skipped — React Native route has no web render target; assessment based on source + project design rules.

## Overall Impression

The layout/shadow fix landed correctly: this now feels like a sibling of `/fuel`, not a one-off white modal. The biggest remaining gap is **feedback when Save is disabled** and **orchestration of scan errors** between the two cards. Nothing blocks shipping; this is polish-tier work.

## What's Working

1. **Settings-register alignment** — `systemGroupedBackground`, `SettingsHeader`, `RowGroup`, and fuel-matched field pattern make the screen predictable inside the Safety tree.
2. **OCR honesty** — Footer + Alert explain Expo Go vs dev build without pretending scan works when it cannot. Privacy copy ("On-device only") matches thesis disclosure principle.
3. **Token discipline** — Colors, spacing, radii, and `dynamicType()` throughout; Save CTA wiltedgreen border matches DESIGN.md.

## Priority Issues

**[P1] Save button disabled with no explanatory accessibility hint**
- What: When carrier or policy is invalid, Save is `disabled` with `opacity: 0.7` but no `accessibilityHint` like `/fuel` uses ("Pick a tank range to enable Save").
- Why it matters: VoiceOver users hear "Save insurance, dimmed" with no guidance on which field to fix.
- Fix: Add conditional `accessibilityHint` when `!canSave` naming the first failing requirement.
- Suggested command: `/impeccable harden`

**[P2] Scan error floats between RowGroups with negative-margin hack**
- What: `scanError` sits outside both RowGroups with `marginTop: -spacing.md`, visually orphaning OCR failure copy between scan and manual sections.
- Why it matters: Error should read as belonging to the scan card; the negative margin is a layout smell and breaks rhythm at large Dynamic Type.
- Fix: Move scan error inside the scan `RowGroup` as footer (error color) or directly under the scan card within the same `wrap`.
- Suggested command: `/impeccable layout`

**[P2] Loading state removes navigation chrome**
- What: Hydration spinner replaces entire screen — no `SettingsHeader`, no back affordance for ~AsyncStorage read.
- Why it matters: Brief trap; user who opened by mistake cannot dismiss until load completes.
- Fix: Show header + skeleton/inline spinner in scroll (pattern used elsewhere) or keep header over loading body.
- Suggested command: `/impeccable polish`

**[P2] Close-to-home discards unsaved edits silently**
- What: `SettingsHeader` close calls `router.replace('/home')` with no dirty-state check.
- Why it matters: Casey persona loses typed carrier/policy on accidental close. Inherited from `/fuel` but still a real loss on this form.
- Fix: Track dirty state; confirm on close when `hydrated && (carrierName !== profile?.carrierName || ...)`.
- Suggested command: `/impeccable harden`

**[P3] Custom scan row duplicates SettingsRow instead of composing it**
- What: Bespoke `Pressable` + icon + two-line copy + chevron mirrors `SettingsRow` but isn't one.
- Why it matters: Future SettingsRow tweaks won't propagate; minor maintenance drift.
- Fix: Extend `SettingsRow` with optional `subtitle` prop, or extract a `SettingsActionRow` shared with similar surfaces.
- Suggested command: `/impeccable distill`

## Persona Red Flags

**Jordan (first-timer):** "Development build" in footer may read as developer jargon. Tapping scan in Expo Go gets a second explanation — good — but Jordan may not connect footer text to why the row still looks tappable. Consider `accessibilityState={{ disabled: !ocrSupported }}` styling when scan unavailable (while keeping tap for explanation Alert).

**Sam (accessibility):** Save disabled state lacks hint (P1). Field labels are visual `Text` siblings, not `accessibilityLabelledBy` — VoiceOver relies on `accessibilityLabel` on inputs (present). Scan button announces title only; subtitle "Take a photo or import…" not in label. Error borders are red but error text is adjacent — acceptable.

**Casey (mobile, interrupted):** Save at bottom of scroll — may require scroll on small phones with keyboard open. No dirty-state on close (P2). Photo thumbnail full-width inside card is good recognition after scan.

**Morgan (pre-stop planner, project-specific):** Wants confidence data will appear on `/pulled-over`. Save succeeds via `router.back()` with no explicit confirmation toast — relies on Safety row value updating. Acceptable if row updates immediately; if hydration lag on parent, brief stale value could erode trust.

## Minor Observations

1. `paddingVertical: 12` on `scanRow` is a magic number — `SettingsRow` uses the same 12pt intentionally; could be `spacing.sm + 4` or a named token.
2. `handleSave` sets `carrierTouched`/`policyTouched` before `if (!canSave) return` — errors appear on failed save tap (good).
3. Remove-photo uses `labelSecondary` not destructive red — correct (not irreversible delete of profile).
4. Scan subtitle duplicates footer partially ("library" vs footer privacy) — minor copy overlap.

## Questions to Consider

- Should scan row look visually inactive in Expo Go while still explaining on tap?
- Does scan error belong in the card footer or as an inline alert below the thumbnail?
- Is a one-line purpose lede under the header worth adding, or is the Safety-settings entry footer enough?
