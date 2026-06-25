import { colors } from './colors';

/**
 * Inner-circle fill on the report-variant landmark pin
 * (`mapmarker-bg-report.svg`). Single source for LandmarkMarker and
 * edge-indicator report disks.
 */
export const MARKER_REPORT_LANDMARK_BG = '#B26800';

/** Fixed identity-glyph outline — readable on wiltedgreen and other fills. */
export const MARKER_GLYPH_STROKE = colors.black;

/**
 * Women-owned illustrative fill — matches baked SVG paths; not UI
 * `colors.pink` (reserved, role TBD).
 */
export const MARKER_GLYPH_FILL_WOMEN_OWNED = '#FF2D55';

/**
 * Saturated-fill glyph stroke — darker than fill, same treatment as
 * report-pin illustrations (orange flag fill + dark outline).
 */
export const MARKER_GLYPH_STROKE_WOMEN_OWNED = '#C41E52';

/** Subtle identity-glyph outline at the 24pt viewBox scale. */
export const MARKER_GLYPH_STROKE_WIDTH_24 = 1;

/** Subtle identity-glyph outline at the 48pt viewBox scale. */
export const MARKER_GLYPH_STROKE_WIDTH_48 = 1.25;

type MarkerCircleVariant = 'black-owned' | 'positive' | 'report';

type MarkerSurface = 'landmark' | 'edge';

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
