import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';

import { markerGlyphStroke } from '../theme/marker-glyph';

type GlyphComponent = ComponentType<SvgProps>;

/**
 * Renders a mapmarker-glyph SVG with a situational contrast stroke.
 * Glyphs that declare `stroke="currentColor"` pick up `color` here;
 * fills stay baked in the illustration.
 */
export function MarkerGlyph({
  Glyph,
  bgColor,
  width,
  height,
}: {
  Glyph: GlyphComponent;
  bgColor: string;
  width: number;
  height?: number;
}) {
  return (
    <Glyph
      width={width}
      height={height ?? width}
      color={markerGlyphStroke(bgColor)}
    />
  );
}
