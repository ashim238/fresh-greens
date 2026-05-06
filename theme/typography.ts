// Fresh Greens — typography tokens
// Source of truth: Figma file 7DDh6c7tk7OKF4WiA7pEkp
//
// Naming follows the iOS Human Interface Guidelines type ramp:
// largeTitle / title1 / body / subheadline / footnote / caption1 / caption2,
// with Regular / Emphasized suffixes for weight variants. Same convention
// Figma uses, so the mapping is one-to-one when checking the design.
//
// Usage:
//   import { typography } from '../theme/typography';
//
//   const styles = StyleSheet.create({
//     title: {
//       ...typography.title1Emphasized,
//       color: colors.white,
//     },
//   });
//
// Note on weights: RN only accepts standard 100-step fontWeight values
// (100, 200, ..., 900). Figma's "Semibold" is technically PostScript weight
// 590, but RN maps Semibold to 600. Visually identical to the eye.

export const typography = {
  largeTitleEmphasized: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  title1Emphasized: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: 0.38,
  },
  // Same metrics as title1Emphasized at Regular weight. Used as the
  // in-modal user-prompt register — see .cursorrules ("Typography").
  // The modal asks the user something; regular weight reads as a held
  // question rather than a directive.
  title1Regular: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '400',
    letterSpacing: 0.38,
  },
  title2Emphasized: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.26,
  },
  title3Regular: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '400',
    letterSpacing: -0.45,
  },
  bodyRegular: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: -0.43,
  },
  bodyEmphasized: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.43,
  },
  calloutRegular: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '400',
    letterSpacing: -0.31,
  },
  subheadlineRegular: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: -0.23,
  },
  subheadlineEmphasized: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.23,
  },
  footnoteRegular: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: -0.08,
  },
  footnoteEmphasized: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: -0.08,
  },
  caption1Regular: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0,
  },
  caption2Regular: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '400',
    letterSpacing: 0.06,
  },
} as const;

// Type helper: union of valid token names. Use as a parameter type when
// a function accepts a typography token by name.
export type TypographyToken = keyof typeof typography;
