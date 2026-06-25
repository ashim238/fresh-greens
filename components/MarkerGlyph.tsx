import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';

import { MARKER_GLYPH_STROKE } from '../theme/marker-glyph';

type GlyphComponent = ComponentType<SvgProps>;

/**
 * Renders a mapmarker-glyph SVG with a fixed black contrast stroke.
 * Glyphs that declare `stroke="currentColor"` pick up `color` here;
 * fills stay baked in the illustration.
 */
export function MarkerGlyph({
  Glyph,
  width,
  height,
}: {
  Glyph: GlyphComponent;
  width: number;
  height?: number;
}) {
  return (
    <Glyph
      width={width}
      height={height ?? width}
      color={MARKER_GLYPH_STROKE}
    />
  );
}
