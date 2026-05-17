// Fresh Greens — elevation system.
//
// Three-tier shadow ramp matching the M3 Light elevations Figma uses
// across the design system. v1 demo polish ended up with ~14 inline
// shadow blocks that diverged slightly per surface; this module
// consolidates them so the system reads as systematic rather than
// hand-tuned per component.
//
// Tiers:
//   e1 — chrome over map (FAB stack, ETA pill, search bar). The
//        lightest shadow, just enough to lift a card off the basemap.
//   e2 — bottom sheets, recommendation cards, primary CTAs. The
//        workhorse elevation for content that sits above the map but
//        below modals.
//   e3 — markers and overlay pins (cluster marker, landmark pin
//        outlines, placement pin). Strongest of the three so pins
//        read distinctly against busy map content.
//
// Each tier returns a spread-ready object — `...shadows.e2` mixes
// into a StyleSheet entry cleanly.
//
// Why this exists separately from colors/typography: shadows aren't
// just a token, they're a multi-property bundle (color/offset/
// opacity/radius + Android elevation). Inlining them ~14 times had
// drift; spreading from one source keeps them honest.

import { Platform } from 'react-native';

type ShadowTier = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

/** e1 — chrome over map. Lightest lift. */
const e1: ShadowTier = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.15,
  shadowRadius: 3,
  elevation: 2,
};

/** e2 — content above map. Sheets, cards, primary CTAs. */
const e2: ShadowTier = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.18,
  shadowRadius: 4,
  elevation: 3,
};

/** e3 — markers and pins. Strongest of the three. */
const e3: ShadowTier = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 4,
};

/**
 * dot — tiny circular markers like the user-location blue dot. e3 is
 * proportionally too heavy on a 24pt circle (the shadow footprint
 * would be half the marker's). Tighter radius + the same darker
 * opacity gives a crisp, perceivable lift without the shadow eating
 * the marker visually.
 */
const dot: ShadowTier = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.25,
  shadowRadius: 2,
  elevation: 2,
};

/**
 * Sheet shadow — bottom sheet's shadow points *up* (negative height)
 * because the sheet rises out of the bottom edge. Kept separate from
 * e1/e2/e3 since it's directional, not just elevated.
 */
const sheet: ShadowTier = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.15,
  shadowRadius: 8,
  elevation: 8,
};

// Platform-specific tweaks: Android's `elevation` is the only
// shadow primitive that does anything on RN < 0.76; the iOS-specific
// fields are read on iOS only. Both fields safely coexist on both
// platforms (the unused one is a no-op), so we ship the same object
// to both. Wrapping in Platform.select is only worth it if a future
// design requires divergent iOS/Android elevations.
void Platform; // keep the import alive in case a future divergence needs it.

export const shadows = { e1, e2, e3, dot, sheet } as const;
export type ShadowName = keyof typeof shadows;
