// Fresh Greens — typography tokens
// Source of truth: Figma file 7DDh6c7tk7OKF4WiA7pEkp (sizes/weights);
// families: Space Grotesk display + Libre Franklin body — see theme/fonts.ts.
//
// Naming follows the iOS Human Interface Guidelines type ramp:
// largeTitle / title1 / body / subheadline / footnote / caption1 / caption2,
// with Regular / Emphasized suffixes for weight variants.
//
// Usage:
//   import { typography } from '../theme/typography';
//   ...dynamicType(typography.bodyRegular)
//
// Custom fonts: each token sets `fontFamily` to a specific weight file.
// Do not add `fontWeight` — RN will not synthesize weights across files.

import { fonts } from './fonts';

export const typography = {
  largeTitleEmphasized: {
    fontFamily: fonts.spaceGrotesk.bold,
    fontSize: 34,
    lineHeight: 41,
    // Space Grotesk sets wider than Jost; drop the geometric-opening tracking.
    letterSpacing: 0,
  },
  // SOS countdown numeral — Space Grotesk Bold (heaviest available weight).
  sosCountdown: {
    fontFamily: fonts.spaceGrotesk.bold,
    fontSize: 40,
    lineHeight: 44,
    // Neutral tracking keeps the single numeral optically centered in the disc.
    letterSpacing: 0,
  },
  title1Emphasized: {
    fontFamily: fonts.spaceGrotesk.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0,
  },
  // In-modal user-prompt register — see .cursorrules ("Typography").
  title1Regular: {
    fontFamily: fonts.spaceGrotesk.regular,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0,
  },
  title2Regular: {
    fontFamily: fonts.franklin.regular,
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.15,
  },
  title2Emphasized: {
    fontFamily: fonts.franklin.bold,
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.15,
  },
  title3Regular: {
    fontFamily: fonts.franklin.regular,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  title3Emphasized: {
    fontFamily: fonts.franklin.semiBold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  bodyRegular: {
    fontFamily: fonts.franklin.regular,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.25,
  },
  bodyEmphasized: {
    fontFamily: fonts.franklin.semiBold,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.25,
  },
  calloutRegular: {
    fontFamily: fonts.franklin.regular,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  subheadlineRegular: {
    fontFamily: fonts.franklin.regular,
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.15,
  },
  subheadlineEmphasized: {
    fontFamily: fonts.franklin.semiBold,
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.15,
  },
  footnoteRegular: {
    fontFamily: fonts.franklin.regular,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.05,
  },
  footnoteEmphasized: {
    fontFamily: fonts.franklin.semiBold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.05,
  },
  caption1Regular: {
    fontFamily: fonts.franklin.regular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
  },
  caption1Emphasized: {
    fontFamily: fonts.franklin.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
  },
  caption2Regular: {
    fontFamily: fonts.franklin.regular,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.06,
  },

  // ── Brand display — DM Serif Display ──────────────────────────
  // Warm serif for emotional / brand-voice moments only: emergency
  // headings, ETAs, wordmark, settings greeting, reassurance copy,
  // onboarding heroes, success confirmations. One weight (Regular),
  // headings only. Space Grotesk stays for structural display;
  // DM Serif adds warmth where the moment calls for it.
  brandDisplayLarge: {
    fontFamily: fonts.dmSerif.regular,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: 0,
  },
  brandDisplay: {
    fontFamily: fonts.dmSerif.regular,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: 0,
  },
  brandDisplaySmall: {
    fontFamily: fonts.dmSerif.regular,
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: 0,
  },
} as const;

export type TypographyToken = keyof typeof typography;
