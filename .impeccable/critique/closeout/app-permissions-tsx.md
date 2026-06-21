---
target: app/permissions.tsx
phase1_score: 31
closeout_score: 32
phase1_p0: 0
phase1_p1: 2
closeout_p0: 0
closeout_p1: 1
delta: +1 (one P1 retired via PR #238 tap-target audit verification)
phase1_timestamp: 2026-06-19T09-53-39Z
closeout_timestamp: 2026-06-20
slug: app-permissions-tsx
---

## Phase 1 vs Closeout

| Dimension | Phase 1 | Closeout | Delta |
|---|---|---|---|
| Total score | 31/40 | 32/40 | +1 |
| P0 count | 0 | 0 | 0 |
| P1 count | 2 | 1 | −1 |
| P2 count | 3 | 3 | 0 |
| P3 count | 2 | 2 | 0 |

**What moved:** the [P1] tap-target on recovery `Pressable` retired. Phase 1 flagged `settingsLinkRow` as having zero horizontal padding (text-width tap target on the horizontal axis). The PR #238 tap-target audit verified `paddingVertical: 16` around the ~14pt footnote yields ~50pt vertical tap area — clears the 44pt HIG floor on the load-bearing axis, and the inline-link convention (text-width interactive run inside a wider parent row) is consistent with the Get Started "Already have an account? Log in" pattern shipped elsewhere. Closeout treats this as resolved-by-audit-acceptance, not resolved-by-code-change. Heuristic 10 (Help and Documentation) lifts 2 → 3 to reflect that the recovery affordance is no longer flagged as a tap-target risk.

**What stayed:** Dynamic Type gap on recovery footnote (P1), Microphone icon `colors.black` asymmetry (P2), `bodyEmphasized` weight on 4-line paragraph (P2), `settingsLink` partial-token re-derivation (P2), `paddingBottom: 34` off-ramp (P3), `subRow` icon-badge a11y exposure (P3). File is byte-identical to Phase 1 — no PRs landed in this screen between the two critiques.

**Net read:** screen held. The one delta is an audit-verification credit, not a code improvement. The remaining P1 is the load-bearing concern for closeout.

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Continue button has no loading state; permission request is async with system dialog overlay |
| 2 | Match Between System and World | 4 | "lighting, wildlife, road conditions" and "ambient protection" are concrete benefits, not marketing; PageControl correctly indicates step 4 of 5 |
| 3 | User Control and Freedom | 3 | Recovery affordance ("Open iOS Settings") for previously-denied permissions is thoughtful; back navigation not visible |
| 4 | Consistency and Standards | 3 | Phosphor deep imports correct; `settingsLink` re-derives `footnoteEmphasized.fontWeight` instead of spreading full token — partial token discipline |
| 5 | Error Prevention | 3 | Non-blocking permission flow — always advances regardless of grant/deny is right call for onboarding momentum; comment documents tradeoff explicitly |
| 6 | Recognition Rather Than Recall | 4 | Sub-directions (icon + label rows) provide visual anchoring; recovery prompt names which specific permission needs enabling |
| 7 | Flexibility and Efficiency | 3 | Non-blocking flow keeps onboarding moving; recovery affordance appears only conditionally |
| 8 | Aesthetic and Minimalist Design | 3 | Wiltedgreen bg reads warm and grounded; `bodyEmphasized` weight on 4-line paragraph fights "steady companion" register; black Microphone icon against freshgreen NavigationArrow introduces unintentional hierarchy |
| 9 | Help Users Recognize, Diagnose, Recover | 3 | Recovery affordance appears with specific copy; `useFocusEffect` re-check pattern means link disappears when user grants from Settings |
| 10 | Help and Documentation | 3 | Permission rationale specific and human; recovery affordance tap-target verified at ~50pt vertical via PR #238 audit; Dynamic Type gap remains the only friction on this row |
| **Total** | | **32/40** | **Solid — one P1 (Dynamic Type on recovery), three P2s, two P3s** |

## Anti-Patterns Verdict

**None from reserved-color blacklist.** No orange, red, yellow, navy used as decorative or ambient tones. Freshgreen scoped to location icon and recovery action span — in-flow visual signal, not decorative bg ambient.

**One slop flag (carried from Phase 1):** `settingsLink` re-derives `typography.footnoteEmphasized.fontWeight` instead of spreading `...typography.footnoteEmphasized`. Intent clear but violates "no hardcoded design values" anti-slop rule — if token's weight ever changes, this site won't pick it up.

**One structural flag (carried from Phase 1):** `dynamicType` applied to `bodyEmphasized`, `subheadlineRegular`, and `subText` but NOT to `settingsLinkPrompt` / `settingsLink`. Recovery affordance exempt from Dynamic Type scaling. At Large Text body scales up while recovery footnote stays pinned — creates visual wedge at exactly the size ratio HIG and WCAG designed to prevent.

## Cognitive Load

**Low to moderate.** Unchanged from Phase 1. Screen does three things: explains what permissions are needed and why, tells user how to grant them, and offers recovery hatch. Copy does not talk down or over-explain.

**Mild redundancy at instruction layer:** "Tap Continue. You'll see two quick prompts:" followed by icon+label subDirections rows is logical sequencing — body paragraph already mentions both permissions by name. Sub-directions add visual anchoring worth keeping, but tapInstruction could be trimmed.

**Recovery affordance clear once visible,** but appears only conditionally and lives below primary CTA with no visual separator. First-time users who see it will need a moment to parse the dash-separated `{recoveryPrompt} — Open iOS Settings` pattern.

## Emotional Journey

Unchanged from Phase 1. Arrives calm → stays calm → asks clearly → exits. Primary friction point remains `bodyEmphasized` weight on the long paragraph. Microphone icon `colors.black` against the freshgreen NavigationArrow still introduces an unintentional semantic asymmetry within the subDirections list.

## What's Working

1. **Permission rationale is specific and human.** Concrete benefits, not marketing.
2. **Recovery affordance genuinely thoughtful.** `useFocusEffect` re-check pattern means link disappears when user grants permission from Settings and returns. Specific recovery copy ("Location needs enabling" vs "Microphone needs enabling" vs both) prevents confusion.
3. **Tap target on recovery affordance verified.** PR #238 audit confirmed `paddingVertical: 16` around the ~14pt footnote yields ~50pt vertical hit area — clears the iOS HIG 44pt minimum on the load-bearing axis. Inline-link convention (text-width interactive span inside wider padded parent) is consistent with the Get Started pattern.
4. **Permission sequencing rationale documented inline.** `handleContinuePress` docblock explains the `get` vs `request` distinction.
5. **Non-blocking permission flow.** Always advancing regardless of grant/deny is the right call for onboarding momentum.
6. **`accessibilityIgnoresInvertColors` on illustration container.**
7. **Phosphor deep imports used correctly.**

## Priority Issues

**[P1] Recovery footnote exempt from Dynamic Type** *(carried from Phase 1, unchanged)*
- What: `settingsLinkPrompt` and `settingsLink` both use `typography.footnoteRegular` / `typography.footnoteEmphasized.fontWeight` directly (not wrapped in `dynamicType()`), while body copy above uses `dynamicType(typography.bodyEmphasized)` and `dynamicType(typography.subheadlineRegular)`. At large Dynamic Type sizes body scales up 1.5–2x while recovery copy stays at 13pt.
- Why it matters: Recovery affordance is the exit hatch for users who previously denied permissions. Many users who need recovery options also rely on larger text. WCAG 1.4.4 requires text to resize to 200% — excluding footnote from scaling breaks that requirement for this interactive text.
- Fix: Wrap both `settingsLinkPrompt` and `settingsLink` text styles in `dynamicType()`. `settingsLink` override for color still works on top of dynamic base.
- Closeout note: this is now the single highest-priority issue on the screen. With the tap-target P1 retired, the Dynamic Type gap stands alone as the load-bearing accessibility risk.

**[P2] Microphone icon color: `colors.black` on wiltedgreen** *(carried, unchanged)*
- NavigationArrow icon uses `colors.freshgreen` and Microphone icon uses `colors.black`. Asymmetry implies semantic hierarchy that isn't intentional.
- Fix: Use `colors.white` for both icons (consistent with white copy on wiltedgreen throughout screen), or `colors.freshgreen` for both.

**[P2] `bodyEmphasized` (600 weight) on 4-line paragraph** *(carried, unchanged)*
- Primary instructional paragraph at fontWeight 600 over 4 lines reads as directive in a moment that should feel like a quiet companion.
- Fix: Change `styles.body` to `dynamicType(typography.bodyRegular)`. If "precise location" or "ambient protection" need emphasis, use nested `<Text>` span with `bodyEmphasized`.

**[P2] `settingsLink` partially reconstructs a token** *(carried, unchanged)*
- `styles.settingsLink` reaches into `typography.footnoteEmphasized.fontWeight` for a single property rather than spreading the full token.
- Fix: `...dynamicType(typography.footnoteEmphasized), color: colors.freshgreen, textDecorationLine: 'underline'` — folds in the Dynamic Type fix above.

**[P3] `paddingBottom: 34` is off-ramp** *(carried, unchanged)*
- `styles.safe` uses 34, not on the spacing ramp.
- Fix: Verify `react-native-safe-area-context`'s `SafeAreaView` already accounts for home indicator; if yes, reduce to `spacing.xl` (32) or 0.

**[P3] `subRow` icon badge lacks `accessibilityElementsHidden`** *(carried, unchanged)*
- VoiceOver will attempt to read icon and adjacent `<Text>` as separate elements.
- Fix: Add `accessibilityElementsHidden` (iOS) or `importantForAccessibility="no"` (Android) to each `<View style={styles.thumb}>`.

## Persona Red Flags

**Sam (accessibility):** Dynamic Type gap on recovery affordance remains the direct regression. At maximum Dynamic Type the body grows to ~32pt while recovery footnote stays at 13pt — 2.5x size difference between adjacent copy blocks. With the tap-target P1 retired, this is now the only structural a11y concern on the screen, and it's the one that matters most for Sam specifically.

**Casey (distracted mobile):** Screen reached mid-onboarding, calm moment. `bodyEmphasized` weight may still read as more urgent than intended if Casey is skimming. Recovery affordance at 13pt footnote below CTA still risks being missed on quick scan if Casey previously denied permissions.

**Black driver assessing safety:** Frame less directly relevant here (calm onboarding, not charged moment). Copy "record audio during traffic stops as ambient protection" remains direct and honest. Inline rationale for asking mic permission during onboarding rather than during the pull-over flow is the right call.

## Minor Observations

1. `visual` container uses `gap: 8` between locationWrap and carWrap. Unchanged.
2. `locationWrap` width/height are non-ramp decimal values (35.891 × 40.374) — SVG-frame dimensions from Figma, correct pattern.
3. `tapInstruction` comment references "Tap Settings below:" but actual copy is "Tap Continue. You'll see two quick prompts:" — documentation drift, carried.
4. Button `accessibilityLabel` is "Continue and grant permissions." Worth keeping.
5. `visual` block has individual SVG labels but no parent role/label describing combined meaning. Unchanged.

## Questions to Consider

1. Why `bodyEmphasized` for primary paragraph? Was this intentional emphasis decision, or inherited from heading-tier assumption?
2. Is 163pt fixed button width Figma constraint or copy-length artifact? At large Dynamic Type sizes where label wraps, `alignSelf: 'flex-start'` with `paddingHorizontal: spacing.xl` on Button might be more legible.
3. Should `subDirections` icons preview real iOS permission dialog icons to set expectations?
4. Does wiltedgreen background interact with iOS Smart Invert at the root level? `accessibilityIgnoresInvertColors` set on illustration but not on root.
5. What happens if both permissions already granted on re-entry? Is `/trusted-contact-setup?from=onboarding` idempotent?
