# AX5 Audit — /safety Surfaces

**Date:** 2026-05-31
**Branch:** `ax5/safety-surfaces`

## Goal

Bring the 8 safety surfaces shipped this session up to the same AX5 standard as `/pulled-over` and `/trusted-contact-setup`: `dynamicType()` on user-facing text, `useReduceMotion()` on the pulse animation, tap-target ≥44pt, accessible names + roles, color-contrast spot-check. No new features — pure accessibility polish.

## In-scope surfaces (8)

**Components (Pass 1):**
- `components/NotifyingPulse.tsx`
- `components/LiveSafetySheet.tsx`
- `components/LifelineModal.tsx`

**Routes (Pass 2):**
- `app/safety.tsx`
- `app/roadside.tsx`
- `app/roadside-setup.tsx`
- `app/unfamiliar.tsx`
- `app/share-location.tsx`

## Canonical pattern (from `app/pulled-over.tsx`)

```ts
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';

// In StyleSheet entries:
labelLikeStyle: {
  ...dynamicType(relaxedLineHeight(typography.bodyRegular)),  // body text — both helpers
  color: colors.labelSecondary,
},

headerStyle: {
  ...dynamicType(typography.title2Emphasized),                // headers — dynamicType ONLY
  color: colors.black,
},
```

**Helper roles** (per `theme/dynamic-type.ts`):
- `dynamicType(token)` — scales `fontSize` + `lineHeight` by `PixelRatio.getFontScale()`. Apply broadly.
- `relaxedLineHeight(token)` — bumps line-height by 1.15× to avoid clipping at AX5 on multi-line copy. Apply to body text only; skip on single-line headers.

## Audit checklist (per surface)

For each surface:

1. **Add `dynamicType()` to every user-facing Text style** — titles, subtitles, body labels, row titles, row clarifiers, button labels (Button component already scales), error messages, footer pulse labels.

2. **Add `relaxedLineHeight()` only to multi-line copy** — clarifiers, subtitles, aspirational notes, modal bodies. Skip on single-line headers.

3. **Verify tap targets ≥44pt** — every Pressable's effective tap area. Row `minHeight` patterns established (60, 76) are fine. Check edge cases: chevron-back, pulse-footer Pressables, small icons.

4. **Verify accessibility coverage** — every interactive element has `accessibilityRole` + `accessibilityLabel`. Composite two-line labels read as sentences ("Title. Clarifier."). Decorative subtrees use `accessibilityElementsHidden` + `importantForAccessibility="no"`.

5. **Color-contrast spot-check** — confirm muted text combinations (`labelSecondary` #3C3C43 on white = ~12:1 ✓; `freshgreen` text on white = ~3.1:1 — OK only on ≥18pt large text or UI components, NOT body). Flag any normal-body-size text in freshgreen.

## Component-specific notes (Pass 1)

### `components/NotifyingPulse.tsx`

**Single key change:** wrap the opacity-pulsing `Animated.View` with `useReduceMotion()`. When `reduceMotion === true`, render a static freshgreen dot (no animation):

```tsx
import { useReduceMotion } from '../hooks/useReduceMotion';
// ...
const reduceMotion = useReduceMotion();
const pulse = usePulseOpacity();
// ...
<Animated.View
  style={[
    styles.dot,
    reduceMotion ? undefined : { opacity: pulse },
  ]}
  // ...
/>
```

The `label` Text also needs `dynamicType(relaxedLineHeight(...))` since it's a single line but can wrap on AX5 with long contact names ("Christopher" + "is being notified").

### `components/LiveSafetySheet.tsx`

- Apply `dynamicType()` to: `expandedKicker`, `expandedTitle`, `activelyLabel`, `contactName`, `contactRelation`, `metaLabel`, `metaValue`.
- Apply `relaxedLineHeight()` to none of these — they're all short labels in a constrained card layout. (Per the spec's nuance: this card is layout-constrained, unlike the modal-sheet titles which have vertical room.)
- Confirm the collapsed pill's `height: 64` doesn't truncate the NotifyingPulse label at AX5. If it does (likely), drop the fixed height and let it expand — already a `minHeight` would be safer. **Change `height: 64` → `minHeight: 64`** so AX5 users get a taller pill instead of clipped text.

### `components/LifelineModal.tsx`

- Apply `dynamicType()` + `relaxedLineHeight()` to: `subtitle` (it's multi-line on default, gets longer at AX5).
- Apply `dynamicType()` only to: `title`, `name`.
- **Avatar `fontSize: 44`** — this is a fixed display-scale element. Wrap with `dynamicType`: `...dynamicType({ fontSize: 44, lineHeight: 52, fontWeight: '600', letterSpacing: -0.5 })` so initials still scale. Acceptable risk that the ring becomes tight at AX5; the alternative (fixed 44pt initials in a fixed-size ring) drops accessibility for layout cleanliness, which is the wrong trade.
- Actually: simpler — keep `fontSize: 44` un-scaled. The initials are 1-2 characters, won't clip. Avatar ring is a *visual* element, not a textual one needing AX5 compliance. **Document this as the deliberate exception in code.**

## Route-specific notes (Pass 2)

### `app/safety.tsx`

The tile labels are short ("Pulled-over", "Roadside assistance", "Unfamiliar area", "Share location"). Apply `dynamicType()` to the tile label style. Tiles are in a 2-column grid — at AX5 the labels may wrap to 2-3 lines; the tile's fixed-height visual needs to accommodate. **Change tile container `height` → `minHeight`** if a fixed height is set.

### `app/roadside.tsx`

- 4 components in the file. Apply `dynamicType()` to: `subtitle`, `title`, `rowLabel`, `locationChipLabel`, `wrongSpot`, `modalTitle`, `modalCtaLabel`, `outlinedCtaLabel`, `sharedCardTitle`, `sharedCardBody`, `sectionLabel`, `primaryCtaLabel` (if not via Button), `statusPulseLabel` (now inside NotifyingPulse — already handled in Pass 1).
- `relaxedLineHeight()` on: `subtitle`, `modalError` (the inline geocode error wraps).
- Note: Step 3's pulse footer is `<NotifyingPulse />` — its text scaling is fixed in Pass 1.

### `app/roadside-setup.tsx`

- Apply `dynamicType()` to: `title`, `fieldLabel`, input `style` (TextInput inherits via the `typography.bodyRegular` spread), `ctaLabel`.
- `relaxedLineHeight()`: none — this screen is all single-line labels.

### `app/unfamiliar.tsx`

- Apply `dynamicType()` to: `subtitle`, `title`, `aspirationalNote`, `rowTitle`, `rowClarifier`, `safeNowStretch` (label via Button).
- `relaxedLineHeight()`: `subtitle`, `rowClarifier`, `aspirationalNote`.
- The two-line rows have `minHeight: 76` already — fine for AX5.

### `app/share-location.tsx`

- Apply `dynamicType()` to: `subtitle`, `title`, `aspirationalNote`, `rowTitle`, `rowClarifier`.
- `relaxedLineHeight()`: `subtitle`, `rowClarifier`, `aspirationalNote`.

## What's NOT in scope

- VoiceOver focus-order rewrites (existing structure is fine — no nested-interactive hazards detected in this session's work)
- New tokens or new components
- Map / location-permission flows — outside the safety modals proper
- The `Button` component itself — already AX5-compliant per its established usage in `/pulled-over`
- `app/pulled-over.tsx` — already audited
- `app/trusted-contact-setup.tsx` — already audited

## Verification

Per surface (per task):
1. `npx tsc --noEmit 2>&1 | grep -iE "<file>"` — zero new errors
2. Visual: boot iOS Simulator, set Settings → Display & Brightness → Text Size to MAX (AX5 / "Larger Accessibility Sizes"), walk every surface. Acceptance criterion: no clipped text, no overlapping lines, no off-screen content, all tap targets still tappable.

## Out of scope (v2 if needed)

- Dynamic Type scaling on the Map polyline / overlay text
- WCAG AAA contrast upgrade
- Switch-control / voice-control flow audit
- Reduce-Transparency or Increase-Contrast accommodation

## Self-review

- ✅ All 8 surfaces enumerated with concrete site lists.
- ✅ Policy clear: `dynamicType` everywhere, `relaxedLineHeight` only on multi-line.
- ✅ One reduce-motion fix point (`NotifyingPulse`) cascades to all 5+ call sites.
- ✅ Two layout-as-data fixes flagged: LiveSafetySheet pill `height → minHeight`, /safety tile `height → minHeight`.
- ✅ Fixed-display avatar fontSize documented as deliberate exception with rationale.
- ✅ Canonical pattern source (`/pulled-over`) cited for implementer reference.
- ✅ Verification recipe: filtered tsc + AX5 simulator walk.
