---
target: app/legal.tsx
phase: closeout
total_score: 33
p0_count: 0
p1_count: 2
p2_count: 3
timestamp: 2026-06-20
slug: app-legal-tsx
---

## Phase 1 vs Closeout

| Metric | Phase 1 (2026-06-19) | Closeout (2026-06-20) | Delta |
|---|---|---|---|
| **Total score** | 31/40 | 33/40 | **+2** |
| **P0 count** | 1 | 0 | **−1** |
| **P1 count** | 2 | 2 | 0 |
| **Rating band** | Good — Structurally incomplete | Good — Structurally incomplete | — |

### Findings delta

- **[P0 → resolved]** Tab pills 28pt painted → 44pt. PR #238 added `minHeight: 44` + `justifyContent: 'center'` and dropped `paddingVertical`. The painted target now clears the `.cursorrules` floor on the visual, not just hit area. Active-pill register matches the comment intent (primary nav, not caption-tier metadata). Heuristic #4 (Consistency / Standards) moves 3 → 4; #1 (Visibility of System Status) holds at 3 (scroll-spy still missing); #8 (Aesthetic / Minimalist) moves 3 → 4 (tab row now reads as a proper navigation surface at body height).
- **[P1 unchanged]** No scroll-spy: `activeSection` still set only inside `jumpTo()`. Frozen pill after scroll persists.
- **[P1 unchanged]** `accessibilityRole="button"` on tabs, no `tablist` wrapper. VoiceOver still reads as button group, not tab group. (Curious gap: line 89 still says `accessibilityRole="button"` despite Phase 2 conventions covering exactly this on other screens.)
- **[P2 unchanged]** H2 and H3 visually identical except by color. Hierarchy collapses without color.
- **[P2 unchanged]** Limitations tab buried third.
- **[P3 unchanged]** EffectiveDate duplicated in Privacy and Terms, absent in Limitations. ISO date format still raw.

Net: the one P0 blocking issue closed cleanly. The two P1s and the structural P2s carry forward — none of them were in PR #238's scope, and Phase 1 framed them as orthogonal to the tap-target fix. Score lift is honest, not generous: +1 for the painted-target compliance (Consistency), +1 for the tab row now reading as committed primary nav (Aesthetic). Held flat on every other axis.

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Active tab updates on tap but no scroll-spy — scroll past a section and active tab stays frozen on last-tapped value |
| 2 | Match System / Real World | 4 | Three-tab structure (Privacy / Terms / Limitations) maps to user mental model; section headers match tab labels |
| 3 | User Control and Freedom | 3 | Scroll always available; tab-jump works; no "back to top" or re-tap-scrolls-to-top affordance |
| 4 | Consistency and Standards | 4 | Tab pills now hit 44pt painted (PR #238); `accessibilityRole="button"` still wrong for tabs but no longer carrying a compliance gap |
| 5 | Error Prevention | 4 | No errors possible on read-only screen; `router.replace('/home')` on close avoids dead back-stack entry |
| 6 | Recognition Rather Than Recall | 3 | Section headers match tab labels; mid-section scroll requires recall of section due to frozen active tab |
| 7 | Flexibility and Efficiency | 2 | No deep-link to section; no copy/share for specific policies; power users have no fast path |
| 8 | Aesthetic and Minimalist Design | 4 | Tab row now sized as committed primary navigation; token discipline exemplary; H2/H3 color-only distinction is the one remaining noise |
| 9 | Error Recovery | 3 | No error states possible; `jumpTo` relies on `anchorOffsets.current` populated; unrendered section silently lands at y=0 |
| 10 | Help and Documentation | 3 | Limitations IS the help documentation and it's excellent, but buried as third tab |
| **Total** | | **33/40** | **Good — Structurally incomplete** |

## Anti-Patterns Verdict

**No slop detected.** Screen still passes the AI-slop test cleanly. No gradient text, glassmorphism, eyebrow labels, identical card grid, decoration-for-decoration. Grouped-gray + white-card register stays HIG-native. Token discipline preserved through PR #238 — the fix used `minHeight: 44` (a tap-target primitive) rather than padding inflation, and added `justifyContent: 'center'` to center the label inside the larger painted box. Clean change.

`EffectiveDate` still renders raw `2026-05-31` ISO date — register inconsistency, not slop.

## Cognitive Load

**Intrinsic load remains high by necessity.** Tab row is now visually committed at body-emphasized height inside a 44pt painted box, which slightly *reduces* extraneous load because the primary navigation surface no longer reads as auxiliary metadata. Phase 1's note that 13pt tab labels "read as caption tier" had been addressed in the 2026-06-01 text-size audit; PR #238 finishes the job by giving those labels enough painted real estate to feel like the page's primary nav.

**Extraneous load sources unchanged:**
1. H2 and H3 indistinguishable except by color. Both use `typography.bodyEmphasized` (lines 418, 424). Only distinction: `colors.black` vs `colors.labelSecondary`.
2. Limitations section third.
3. Bullet dot color mismatch (`bulletDot` is `labelSecondary`, `bulletText` is `black`).

## Emotional Journey

**Entry:** Unchanged — Privacy is the default landing. Tab row now reads as confident primary navigation rather than understated metadata; the active pill at 44pt minimum height carries the affordance weight it claims.

**Tab navigation:** Tapping a pill is now physically easier — the painted target matches the visual promise of "this is the page's nav." Casey (one-handed thumb tap) gets the most direct benefit. The frozen-after-scroll behavior is still the single most disorienting moment on the screen, and a more confident tab row makes that lie slightly louder (you trust a more committed indicator more, so its drift hurts more).

**The Limitations section** is unchanged and still emotionally the strongest moment for primary persona.

**Exit:** Unchanged.

## What's Working

1. **PR #238 hit the right primitive.** `minHeight: 44` + `justifyContent: 'center'` is the textbook fix — the `.cursorrules` rule names painted-on-visual, not hit area, and PR #238 inflated the painted box rather than reaching for `hitSlop` forgiveness. The label preserves its `subheadlineEmphasized` size; only the container grew. That's the right altitude of fix.
2. **TL;DR section in Privacy** — still the standout structural decision.
3. **Limitations copy** — still the best writing in the app.

## Priority Issues

**[P1] No scroll-spy: active tab doesn't track scroll position** *(unchanged from Phase 1)*
- What: `activeSection` set only in `jumpTo()`. Frozen indicator after manual scroll.
- Why it matters: With the tab row now reading as more confident primary nav (post-PR #238), the lie hurts more, not less. A confident indicator that drifts erodes trust faster than an understated one.
- Fix: Add `onScroll` + `scrollEventThrottle={16}` to ScrollView. Track scroll Y against `anchorOffsets.current`; the section whose anchor is closest-to-but-not-greater-than current scroll Y is active.

**[P1] `accessibilityRole="button"` on tabs — VoiceOver reads as buttons, not tabs** *(unchanged from Phase 1)*
- What: Line 89 still declares `accessibilityRole="button"`. No `tablist` wrapper. VoiceOver announces "Privacy, button" instead of "Privacy, tab, 1 of 3, selected."
- Why it matters: Phase 2 conventions cover this exact pattern on other screens. Sam (VoiceOver) gets no count, no position, no group context.
- Fix: `accessibilityRole="tablist"` on `styles.tabRow` View. `accessibilityRole="tab"` on each Pressable. `accessibilityLabel={s.label}` (drop the "Jump to" prefix — the tab role announces "tab" automatically).

**[P2] H2 and H3 visually identical — heading hierarchy collapses without color** *(unchanged from Phase 1)*
- What: Both `styles.h2` and `styles.h3` use `typography.bodyEmphasized`. Only difference: `colors.black` vs `colors.labelSecondary`.
- Why it matters: WCAG 1.4.1 (Use of Color) for hierarchy. Colorblind reader sees one tier.
- Fix: Drop H3 to `subheadlineEmphasized` (15pt/600 — one step down) OR keep 17pt and use `subheadlineRegular` for lighter weight.

**[P2] Limitations tab buried third** *(unchanged from Phase 1)*
- What: Privacy / Terms / Limitations tab order.
- Why it matters: Limitations is the most operationally significant disclosure for primary persona.
- Fix: Reorder to Limitations / Privacy / Terms, OR persistent callout at top of contentCard linking to Limitations.

**[P3] EffectiveDate inconsistency** *(unchanged from Phase 1)*
- What: `<EffectiveDate />` in Privacy and Terms, missing from Limitations. ISO format reads form-document.
- Fix: Add to Limitations. Format as "May 31, 2026." Extract to named constant.

## Persona Red Flags

**Sam (accessibility):**
Painted-target compliance now clean — tab pills meet 44pt floor for low-vision and motor-impaired users. At AX5 (large Dynamic Type), the `minHeight: 44` with `justifyContent: 'center'` is still the right primitive because the label can grow inside the box without breaking the floor. Still: VoiceOver reads tabs as buttons (line 89), still gets no count/position; still no scroll-position announcement. **The biggest remaining Sam gap is the role, not the target.**

**Casey (distracted mobile):**
Casey gets the most direct PR #238 benefit. 44pt painted pill is genuinely thumb-friendly under one-handed use; 28pt was a miss-tap-likely surface. Casey still has the frozen-active-tab problem — the more confident tab row makes the drift more confusing, not less.

**Black driver assessing safety in a charged moment:**
Tap reliability under stress matters disproportionately on safety-critical surfaces. PR #238 closes the miss-tap concern on the navigation row itself. The Limitations ordering and scroll-spy gap remain the dominant trust risks; neither is in PR #238's scope.

## Minor Observations

- `/recordings` path reference still reads as a developer path, not a UI affordance.
- ISO date format on `EffectiveDate` — "May 31, 2026" warmer.
- `sectionHeader` `marginTop: spacing.lg` on first section creates ~48pt top whitespace combined with card padding.
- `h2` and `h3` `marginTop` not suppressed when following `SectionHeader` / `EffectiveDate`.
- `BoldInline` typed as `string` — `React.ReactNode` more flexible.
- `showsVerticalScrollIndicator={false}` on the main ScrollView — for long-form legal text, scroll indicator is a useful wayfinding cue, especially absent scroll-spy.

## Questions to Consider

1. With the tab row now confidently sized, is the scroll-spy gap closer to a P0 than a P1? A confident indicator that lies is worse than a meek one that lies.
2. Is `accessibilityRole="button"` on tabs a deliberate carve-out for the legal screen, or a missed sweep when Phase 2 propagated tab semantics elsewhere?
3. Should this critique re-run after the scroll-spy + a11y-role pair lands? Both are scoped, neither is structural — a single PR could close both P1s and lift the score to ~36/40.

---

**Closeout summary:** PR #238 closed the one P0 cleanly with the right primitive (`minHeight: 44`, not padding inflation). Score 31 → 33 (+2). Two P1s remain (scroll-spy, tab a11y role); both are scoped and tractable. Two P2s (heading hierarchy, tab order) are structural and would benefit from a follow-up pass. No regressions introduced.
