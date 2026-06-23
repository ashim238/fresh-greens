// Fresh Greens — material tokens. Surface translucency + blur tiers,
// mirroring Apple's UIBlurEffect styles narrowed to what the app
// actually needs. Each tier carries: blur intensity, tint color, tint
// opacity, hairline border color, and a reduce-transparency fallback.
//
// The tiers are consumed by `components/MaterialSurface.tsx` — surfaces
// don't read this module directly.
//
// Calibration baseline:
//   - chrome  → over-map FABs, search bar default state. Light + airy.
//   - sheet   → bottom sheets that rise from the screen edge. Heavier.
//   - card    → embedded cards on light-gray pages (settings rows).
//                Decorative blur — the page beneath isn't the map.
//   - modal   → full-screen modals over heavy content. Thickest blur.
//
// Tint / hairline values are tuned for the light-mode app surface; dark
// mode is a future-scope concern (the app is light-mode-only today).

import type { BlurTint } from 'expo-blur';

import { colors } from './colors';

export type MaterialTier = 'chrome' | 'sheet' | 'card' | 'modal';

type MaterialConfig = {
  /** expo-blur intensity (0-100). iOS-native blur strength. */
  intensity: number;
  /** Light/dark/default tint per expo-blur. We use 'light' throughout
   *  for now; reserved so dark mode can swap later. */
  tint: BlurTint;
  /** Hairline border color — 0.5pt edge that separates layers without
   *  reading as a heavy border. Apple's signature on every UIVisualEffect. */
  hairline: string;
  /** Solid fallback background when reduce-transparency is on, OR when
   *  the platform doesn't honor BlurView (Android). Approximates the
   *  tier's perceived weight as an opaque color. */
  fallback: string;
};

export const materials: Record<MaterialTier, MaterialConfig> = {
  chrome: {
    intensity: 80,
    tint: 'light',
    hairline: 'rgba(255, 255, 255, 0.5)',
    fallback: colors.white,
  },
  sheet: {
    intensity: 80,
    tint: 'light',
    hairline: 'rgba(255, 255, 255, 0.6)',
    fallback: colors.white,
  },
  card: {
    intensity: 40,
    tint: 'light',
    hairline: 'rgba(0, 0, 0, 0.06)',
    fallback: colors.white,
  },
  modal: {
    intensity: 90,
    tint: 'light',
    hairline: 'rgba(255, 255, 255, 0.4)',
    fallback: colors.white,
  },
};
