import { colors } from './colors';

/**
 * Inner-circle fill on the report-variant landmark pin
 * (`mapmarker-bg-report.svg`). Kept here so stroke contrast tracks the
 * same value LandmarkMarker paints, without duplicating the hex in
 * component code.
 */
export const MARKER_REPORT_LANDMARK_BG = '#B26800';

/** Subtle identity-glyph outline at the 24pt viewBox scale. */
export const MARKER_GLYPH_STROKE_WIDTH_24 = 1;

/** Subtle identity-glyph outline at the 48pt viewBox scale. */
export const MARKER_GLYPH_STROKE_WIDTH_48 = 1.25;

type MarkerCircleVariant = 'black-owned' | 'positive' | 'report';

type MarkerSurface = 'landmark' | 'edge';

const LIGHT_MARKER_CIRCLE_BGS = new Set(
  [colors.white, colors.fadedgreen, colors.yellow].map((c) => c.toLowerCase()),
);

const DARK_MARKER_CIRCLE_BGS = new Set(
  [
    colors.wiltedgreen,
    colors.burntgreen,
    colors.navy,
    colors.black,
    colors.slightlyWiltedGreen,
    colors.slightlyDarkOrange,
    MARKER_REPORT_LANDMARK_BG,
  ].map((c) => c.toLowerCase()),
);

function normalizeHex(color: string): string {
  return color.trim().toLowerCase();
}

/** WCAG relative luminance — fallback when bg isn't a known token. */
function relativeLuminance(hex: string): number {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return 0;
  const channels = [0, 2, 4].map((i) => {
    const srgb = parseInt(raw.slice(i, i + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

/**
 * Returns the solid inner-circle color behind a map marker glyph.
 * Landmark pins use the Bg SVG fills; edge indicators use the same
 * semantic palette at the smaller disk size.
 */
export function markerCircleBgFor(
  variant: MarkerCircleVariant | undefined,
  categoryId: string | undefined,
  surface: MarkerSurface,
): string {
  if (categoryId === 'trusted-friend') return colors.burntgreen;
  switch (variant) {
    case 'positive':
      return surface === 'edge' ? colors.slightlyWiltedGreen : colors.wiltedgreen;
    case 'report':
      return surface === 'edge' ? colors.slightlyDarkOrange : MARKER_REPORT_LANDMARK_BG;
    case 'black-owned':
      return colors.black;
    default:
      return colors.labelSecondary;
  }
}

/**
 * Contrast stroke for illustrated identity glyphs on marker inner circles.
 * Light circle → dark stroke; dark circle → light stroke.
 *
 * Identity SVG paths use `stroke="currentColor"`; pass the return value
 * as the Svg `color` prop at render time.
 */
export function markerGlyphStroke(bgColor: string): string {
  const normalized = normalizeHex(bgColor);
  if (LIGHT_MARKER_CIRCLE_BGS.has(normalized)) return colors.black;
  if (DARK_MARKER_CIRCLE_BGS.has(normalized)) return colors.white;
  return relativeLuminance(normalized) > 0.45 ? colors.black : colors.white;
}
