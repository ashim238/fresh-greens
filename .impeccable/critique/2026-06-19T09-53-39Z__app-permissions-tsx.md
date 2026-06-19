---
target: app/permissions.tsx
total_score: 31
p0_count: 0
p1_count: 2
timestamp: 2026-06-19T09-53-39Z
slug: app-permissions-tsx
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
| 9 | Help Users Recognize, Diagnose, Recover | 3 | Recovery affordance appears with specific copy ("Location needs enabling" vs "Microphone needs enabling" vs both); `useFocusEffect` re-check pattern means link disappears when user grants from Settings |
| 10 | Help and Documentation | 2 | Permission rationale specific and human; tap-target width on recovery `Pressable` collapses to text width — recovery is most important tap target on screen for failure case, can break |
| **Total** | | **31/40** | **Solid — three concrete gaps (CTA contrast, keyboard flow, validation feedback)** |

## Anti-Patterns Verdict

**None from reserved-color blacklist.** No orange, red, yellow, navy used as decorative or ambient tones. Freshgreen correctly scoped to location icon (in-flow visual, not CTA on dark surface — borderline but defensible).

**One slop flag:** `settingsLink` re-derives `footnoteEmphasized.fontWeight` instead of spreading `...typography.footnoteEmphasized`. Intent clear but violates "no hardcoded design values" anti-slop rule — if token's weight ever changes, this site won't pick it up.

**One structural flag:** `dynamicType` applied to `bodyEmphasized`, `subheadlineRegular`, and `subText` but NOT to `settingsLinkPrompt` / `settingsLink`. Recovery affordance exempt from Dynamic Type scaling. If user has Large Text enabled, body and tap instruction scale up while recovery footnote stays pinned — creates visual wedge at exactly size ratio HIG and WCAG designed to prevent.

## Cognitive Load

**Low to moderate.** Screen does three things: explains what permissions are needed and why, tells user how to grant them, and offers recovery hatch. Copy does not talk down or over-explain.

**Mild redundancy at instruction layer:** "Tap Continue. You'll see two quick prompts:" (tapInstruction) followed by icon+label subDirections rows is logical sequencing — but body paragraph already mentions both permissions by name. Sub-directions add visual anchoring (icon = real iOS prompt icon metaphor) worth keeping, but tapInstruction could be trimmed.

**Recovery affordance clear once visible,** but appears only conditionally and lives below primary CTA with no visual separator. First-time users who see it will need moment to parse dash-separated `{recoveryPrompt} — Open iOS Settings` pattern.

## Emotional Journey

| Moment | Tone | Assessment |
|---|---|---|
| Screen arrival on wiltedgreen | Warm, earthy, grounded | Correct. Sets "this is not a panic screen." |
| Illustration (location pin + car) | Light, illustrative | Effective trust-builder. Small scale feels humble rather than heroic. |
| Body copy ("Fresh Greens needs your precise location…") | Informative, direct | Good. But `bodyEmphasized` (600 weight semibold) on 4-line paragraph feels slightly effortful for "calm companion" register. |
| "Tap Continue. You'll see two quick prompts:" | Preparatory, guiding | Helpful framing. "Quick" doing meaningful emotional work — sets expectation that reduces anxiety. |
| Sub-directions (icon + label rows) | Structured, simple | Good. Micro-signal: NavigationArrow gets freshgreen, Microphone gets black. Asymmetry subtle but introduces visual hierarchy mismatch. |
| Continue button (left-aligned, 163pt wide) | Action-ready | Left alignment consistent with Figma and content column. |
| Recovery affordance (conditional) | Helpful, low-key | Pattern consistent with Get Started, so consistency wins. |

**Overall arc:** Arrives calm → stays calm → asks clearly → exits. Primary friction point is `bodyEmphasized` weight on long paragraph.

## What's Working

1. **Permission rationale is specific and human.** Concrete benefits, not marketing. Thesis-appropriate: shows work, earns trust.
2. **Recovery affordance genuinely thoughtful.** `useFocusEffect` re-check pattern means link disappears when user grants permission from Settings and returns — no stale UI. Specific recovery copy ("Location needs enabling" vs "Microphone needs enabling" vs both) prevents confusion.
3. **Permission sequencing rationale documented inline.** `handleContinuePress` docblock explains difference between `getForegroundPermissionsAsync` and `requestForegroundPermissionsAsync` and why latter is used.
4. **Non-blocking permission flow.** Always advancing regardless of grant/deny is right call for onboarding momentum.
5. **`accessibilityIgnoresInvertColors` on illustration container.** Illustrative SVGs should not invert under Smart Invert — correct and often overlooked.
6. **Phosphor deep imports used correctly.**

## Priority Issues

**[P1] Tap-target width on recovery `Pressable`**
- What: `settingsLinkRow` has `paddingVertical: 16` (providing ~46pt height, which clears 44pt) but zero horizontal padding. Painted target width equals rendered text string width. Per `.cursorrules`, painted target must be 44pt minimum on **both** axes. Vertical axis may clear; horizontal tap area outside characters is zero.
- Why it matters: Recovery affordance for users who previously denied permissions — most important tap target for failure case. If they can't reliably hit it, recovery path breaks.
- Fix: Add `paddingHorizontal: spacing.md` (16pt) minimum. If link needs to stay left-aligned, add `alignSelf: 'flex-start'` to keep tap area from stretching to full width.

**[P1] Recovery footnote exempt from Dynamic Type**
- What: `settingsLinkPrompt` and `settingsLink` both use `typography.footnoteRegular` directly (not wrapped in `dynamicType()`), while body copy above uses `dynamicType(typography.bodyEmphasized)` and `dynamicType(typography.subheadlineRegular)`. At large Dynamic Type sizes body scales up 1.5–2x while recovery copy stays at 13pt.
- Why it matters: Recovery affordance is exit hatch for users who previously denied permissions. Many users who need recovery options also rely on larger text. WCAG 1.4.4 requires text to resize to 200% without assistive technology — excluding footnote from scaling breaks that requirement for this interactive text.
- Fix: Wrap both `settingsLinkPrompt` and `settingsLink` text styles in `dynamicType()`: `...dynamicType(typography.footnoteRegular)`. `settingsLink` override for color/weight still works fine on top of dynamic base.

**[P2] Microphone icon color: `colors.black` on wiltedgreen**
- What: NavigationArrow icon uses `colors.freshgreen` and Microphone icon uses `colors.black`. Asymmetry implies semantic hierarchy (freshgreen = "active/primary", black = "secondary/pending"?) that isn't intentional.
- Why it matters: Visual consistency within subDirections list broken. First-time users may read color difference as meaningful. Fights "calm and even" tone.
- Fix: Use `colors.white` for both icons (consistent with white copy on wiltedgreen throughout screen), or `colors.freshgreen` for both. Either more defensible than current mixed signal.

**[P2] `bodyEmphasized` (600 weight) on 4-line paragraph**
- What: Primary instructional paragraph uses `dynamicType(typography.bodyEmphasized)` — 17pt/22pt at fontWeight 600. Screen's longest copy block and primary narrative voice.
- Why it matters: `bodyEmphasized` at 600 weight over 4 lines reads as directive in moment that should feel like quiet companion explaining itself. "Steady Companion" brand persona better served by `bodyRegular` (400) here. Per typography guidance in `.cursorrules`, "In-modal user prompts use Title1 Regular" — same composure logic applies here.
- Fix: Change `styles.body` to `dynamicType(typography.bodyRegular)`. If "precise location" or "ambient protection" need emphasis, use nested `<Text>` span with `bodyEmphasized`.

**[P2] `settingsLink` partially reconstructs a token**
- What: `styles.settingsLink` spreads `color` and `textDecorationLine` then reaches into `typography.footnoteEmphasized.fontWeight` for single property rather than spreading `...dynamicType(typography.footnoteEmphasized)`.
- Why it matters: Violates anti-slop rule "no hardcoded design values — pull from theme." Only weight property being pulled; letterSpacing for `footnoteEmphasized` is -0.08 which matches `footnoteRegular`, so today no visible regression. But pattern fragile.
- Fix: Spread full token: `...dynamicType(typography.footnoteEmphasized), color: colors.freshgreen, textDecorationLine: 'underline'`.

**[P3] `paddingBottom: 34` is off-ramp**
- What: `styles.safe` uses `paddingBottom: 34`, not on spacing ramp (xs=4, sm=8, md=16, lg=24, xl=32, xxl=48). Likely compensating for SafeAreaView inset.
- Fix: Verify whether `react-native-safe-area-context`'s `SafeAreaView` already accounts for home indicator. If yes, reduce to `spacing.xl` (32) or 0.

**[P3] `subRow` icon badge lacks `accessibilityElementsHidden`**
- What: Each `<View style={styles.thumb}>` containing Phosphor icon is visible non-interactive element inside non-interactive row. VoiceOver will attempt to read both icon (which has no `accessibilityLabel`) and adjacent `<Text>` as separate elements.
- Fix: Add `accessibilityElementsHidden` (iOS) or `importantForAccessibility="no"` (Android) to each `<View style={styles.thumb}>`.

## Persona Red Flags

**Sam (accessibility):**
Dynamic Type gap on recovery affordance is direct regression for Sam. At maximum Dynamic Type size, body copy grows to ~32pt while recovery footnote stays at 13pt — 2.5x size difference between adjacent copy blocks. Sam relies on tap-target affordance precisely because they may have previously dismissed system dialog by accident. Recovery path is most important thing on screen for Sam, and it's the only element not scaled.

**Casey (distracted mobile):**
Screen reached mid-onboarding, likely in calm moment. Casey won't be distracted here way they would in en-route flow. However, `bodyEmphasized` weight may read as more urgent than intended if Casey is skimming — semibold on long paragraph pattern-matches to "important warning" in most app contexts. If Casey previously denied permissions (common), recovery affordance needs to be visually obvious. At 13pt footnote below CTA, risks being missed on quick scan.

**Black driver assessing safety in a charged moment:**
Screen reached during calm onboarding, not charged moment — so high-stress frame less directly relevant. Microphone permission ask is specifically for traffic stops. Copy "record audio during traffic stops as ambient protection" direct and honest. Screen correctly frames mic ask as advance preparation, not emergency response. The code comment explains exactly why: requesting mic permission during pull-over would be "worst possible moment." Emotional register here appropriate.

## Minor Observations

1. `visual` container uses `gap: 8` between locationWrap and carWrap.
2. `locationWrap` width/height are non-ramp decimal values (35.891 × 40.374). SVG-frame dimensions from Figma — correct pattern for SVG-faithful insets.
3. `tapInstruction` reads "Tap Settings below:" in stale comment from previous version but actual copy is "Tap Continue. You'll see two quick prompts:" — minor documentation drift.
4. Button `accessibilityLabel` is "Continue and grant permissions." Worth keeping.
5. `visual` block does not have combined `accessibilityLabel` for composition as whole. Two SVG children have individual labels but no parent role/label that describes their combined meaning.

## Questions to Consider

1. Why `bodyEmphasized` for primary paragraph? Was this intentional emphasis decision, or inherited from heading-tier assumption?
2. Is 163pt fixed button width Figma constraint or copy-length artifact? At large Dynamic Type sizes where label wraps, `alignSelf: 'flex-start'` with `paddingHorizontal: spacing.xl` on Button might be more legible.
3. Should `subDirections` icons use real iOS permission icons? Phosphor glyphs are abstract; iOS will show its own permission dialog icons. Value in previewing system icons to set expectations?
4. Does wiltedgreen background interact with iOS Smart Invert? `accessibilityIgnoresInvertColors` set on illustration `View` but not on root `View` with `backgroundColor: colors.wiltedgreen`.
5. What happens if both permissions already granted on re-entry? `showSettingsRecovery` would be false and screen would look identical to first-time visit. Continue button would advance to `/trusted-contact-setup?from=onboarding` again. Is that route idempotent?
