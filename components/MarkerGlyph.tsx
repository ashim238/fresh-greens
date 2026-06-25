import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';

import { MARKER_GLYPH_STROKE } from '../theme/marker-glyph';

type GlyphComponent = ComponentType<SvgProps>;

/**
 * Renders a mapmarker-glyph SVG with a contrast stroke on stroked paths.
 * Glyphs that declare `stroke="currentColor"` pick up `color` here;
 * fills stay baked in the illustration.
 */
export function MarkerGlyph({
  Glyph,
  width,
  height,
  stroke = MARKER_GLYPH_STROKE,
}: {
  Glyph: GlyphComponent;
  width: number;
  height?: number;
  /** Svg `color` for `stroke="currentColor"` paths. Defaults to black. */
  stroke?: string;
}) {
  return (
    <Glyph
      width={width}
      height={height ?? width}
      color={stroke}
    />
  );
}
