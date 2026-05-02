// Fresh Greens — color tokens
// Source of truth: Figma file 7DDh6c7tk7OKF4WiA7pEkp
// See ../.cursorrules ("Reserved-color rule") for usage rules and exceptions.
//
// Usage:
//   import { colors } from '../theme/colors';
//   <View style={{ backgroundColor: colors.freshgreen }} />

export const colors = {
  // Brand greens — use freely for UI
  freshgreen: '#41AD49',   // primary CTA, in-flow links
  wiltedgreen: '#326936',  // secondary CTAs, atmospheric headers
  burntgreen: '#003F04',   // deep accents (e.g. turn-card "Then" footer)
  fadedgreen: '#A0D6A4',   // supporting fills

  // Reserved — UI signals only. See .cursorrules for documented exceptions.
  orange: '#FF9500',       // hazard / speed limit / construction
  red: '#FF3B30',          // alert
  yellow: '#FFCC00',       // caution
  pink: '#FF2D55',         // role TBD — ask before use

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
} as const;

// Type helper: lets TypeScript autocomplete color names and catch typos.
// e.g. `color: ColorToken` will only accept 'freshgreen' | 'wiltedgreen' | ...
export type ColorToken = keyof typeof colors;
