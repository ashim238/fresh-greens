// Fresh Greens — border-radius scale.
//
// Companion to theme/spacing.ts. Pulled out of inline use after the
// 2026-06-01 self-audit found a 4-site repeat of `borderRadius: 20`
// (centered-card modals on /emergency, /report, /pulled-over, and
// LiveSafetySheet) and 60+ sites of `borderRadius: 12/16/100/999`
// scattered across screens. The latter sweep stays deferred — too
// much blast radius for a single PR — but this scale is here so new
// code adopts it and the cleanup is a search-and-replace away.
//
// Usage:
//   import { radii } from '../theme/radii';
//   ...
//   borderRadius: radii.lg,
//
// Naming mirrors the spacing ramp (sm/md/lg/xl + pill) so the design
// tokens speak with one voice.

export const radii = {
  xs: 4,    // tight inner chips, checkboxes, indicator dots, skeleton lines
  sm: 8,    // small chips, footer pills
  md: 12,   // standard cards (default)
  lg: 16,   // elevated modal cards (LifelineModal, RouteComparisonSheet)
  xl: 20,   // centered popup modals (/emergency, /report, /pulled-over)
  sheet: 28, // bottom-sheet + modal top corners
  pill: 999, // capsule buttons, location chips
} as const;

export type Radius = keyof typeof radii;
