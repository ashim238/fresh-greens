// Fresh Greens — typography tokens
// Source of truth: Figma file 7DDh6c7tk7OKF4WiA7pEkp (sizes/weights);
// families: Jost display + Libre Franklin body — see theme/fonts.ts.
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
    fontFamily: fonts.jost.bold,
    fontSize: 34,
    lineHeight: 41,
    letterSpacing: 0.15,
  },
  // SOS countdown numeral — Jost ExtraBold per brand type system.
  sosCountdown: {
    fontFamily: fonts.jost.extraBold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: 0.5,
  },
  title1Emphasized: {
    fontFamily: fonts.jost.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0.12,
  },
  // In-modal user-prompt register — see .cursorrules ("Typography").
  title1Regular: {
    fontFamily: fonts.jost.regular,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0.12,
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
} as const;

export type TypographyToken = keyof typeof typography;
