// Fresh Greens — spacing scale.
//
// 4pt base step ramp (xs/sm/md/lg/xl/xxl). Apple/Google design systems
// both lean on a 4pt rhythm; we stayed implicit through v1 demo polish
// and ended up with stragglers at 5/6/13/18/20/23. This module makes
// the system explicit so reviewers can flag drift, and future surfaces
// pull from one source.
//
// Usage:
//   import { spacing } from '../theme/spacing';
//   ...
//   paddingHorizontal: spacing.md,
//   gap: spacing.sm,
//
// When you need a value that isn't on the ramp, prefer the closest
// step over inventing a new constant. The exceptions worth keeping
// numeric: anchored pixel-art positions (e.g. SVG-faithful insets
// from Figma frames) and asymmetric padding tuned to specific glyph
// optics.

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export type Spacing = keyof typeof spacing;

// Component-specific dimensional constants that aren't part of the
// 4pt spacing ramp itself but are shared across surfaces. Pulled out
// of inline use after the 2026-06-01 self-audit found the
// safety-flow card height duplicated across /pulled-over,
// /unfamiliar, and /share-location.

// Shared height for the elevated answer/option cards in the safety
// sub-flows (/pulled-over armed picker, /unfamiliar problem picker,
// /share-location reason picker). /pulled-over is the precedent;
// the others matched it during the 2026-06-01 cross-flow alignment
// pass. Anchor the value here so a future redesign updates one
// place, not three.
export const safetyCardHeight = 100;
