import { PixelRatio } from 'react-native';
import type { TextStyle } from 'react-native';

/**
 * Opt-in Dynamic Type scaling for a typography token. Scales both
 * `fontSize` and `lineHeight` by the iOS Settings → Display & Text
 * Size → Larger Text multiplier (read via `PixelRatio.getFontScale()`).
 *
 * Why this and not `allowFontScaling={true}` alone: React Native's
 * Text component scales the rendered glyphs when `allowFontScaling`
 * is on (the default), but it does NOT scale a `lineHeight` you've
 * explicitly set in the style. Our typography tokens spread
 * `lineHeight` into every styled Text, so without this helper the
 * font grows but the line box stays fixed — and lines overlap at
 * larger Dynamic Type sizes.
 *
 * Apply to long-read copy where Dynamic Type matters most: multi-
 * line paragraphs, bullets, narrative explanations. Skip on headers
 * and short labels — those are constrained by layout, and scaling
 * them risks pushing fixed-position UI off-screen on Pro Max devices
 * with maximum Dynamic Type. Per Apple HIG: "Make sure all text
 * scales appropriately when accessibility text sizes are used,
 * unless the text is part of a logo or has a fixed aspect ratio."
 *
 * Per WCAG 1.4.4 Resize Text (Level AA, required for compliance).
 *
 * Recompute on each render — `PixelRatio.getFontScale()` is cheap,
 * and reading at render time means we pick up any Dynamic Type
 * change the next time React schedules a render (e.g., when the
 * user re-focuses the app after toggling iOS Settings).
 */
export function dynamicType<T extends TextStyle>(token: T): T {
  const scale = PixelRatio.getFontScale();
  return {
    ...token,
    fontSize: token.fontSize ? token.fontSize * scale : token.fontSize,
    lineHeight: token.lineHeight ? token.lineHeight * scale : token.lineHeight,
  };
}

/**
 * Bumps line-height to 1.6× fontSize for stress-state long reads —
 * `/pulled-over` guidance bullets are the canonical case. Default
 * iOS body type uses ~1.29× ratio (17pt/22pt), which matches the
 * native body register but sits below WCAG 1.4.12 Text Spacing's
 * "remains usable at 1.5× line-height" requirement.
 *
 * Cognitive-load research (Carter et al. 1998, validated by NN Group
 * usability studies) shows wider line-height reduces line-tracking
 * errors when readers are under stress or time pressure — exactly
 * the /pulled-over context. The cost is more vertical space; benefit
 * is the user being able to read the guidance under load.
 *
 * Compose with `dynamicType` for stress copy that also respects the
 * user's iOS Dynamic Type setting:
 *   <Text style={dynamicType(relaxedLineHeight(typography.bodyRegular))}>
 *
 * Order: relax first (sets ratio), scale second (preserves ratio
 * across font scales).
 */
export function relaxedLineHeight<T extends TextStyle>(token: T): T {
  if (!token.fontSize) return token;
  return {
    ...token,
    lineHeight: token.fontSize * 1.6,
  };
}
