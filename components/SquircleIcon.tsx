import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import GlyphBlackOwned from '../assets/illustrations/mapmarker-glyph-black-owned.svg';
import GlyphFeltUnsafe from '../assets/illustrations/mapmarker-glyph-felt-unsafe.svg';
import GlyphFeltWelcome from '../assets/illustrations/mapmarker-glyph-felt-welcome.svg';
import GlyphHazard from '../assets/illustrations/mapmarker-glyph-hazard.svg';
import GlyphIncident from '../assets/illustrations/mapmarker-glyph-incident.svg';
import GlyphLighting from '../assets/illustrations/mapmarker-glyph-lighting.svg';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';

/**
 * Squircle category icon — gradient-filled rounded square with the
 * existing glyph SVG centered inside, plus a color-aware drop shadow
 * tinted to the gradient's primary color.
 *
 * Replaces (in Phase 2) the current circle-with-glyph pattern used by
 * LandmarkMarker, ReportDetailCard, and the /report picker tiles.
 *
 * Variants follow the same three-bucket sentiment system as
 * `LandmarkMarker.variantForCategoryId`:
 *   - 'positive'    → freshgreen → wiltedgreen
 *   - 'black-owned' → burntgreen (solid, no gradient — identity, not sentiment)
 *   - 'report'      → orange → slightlyDarkOrange
 *
 * Size scales the squircle and the glyph proportionally (glyph is
 * always 60% of the squircle).
 */

export type SquircleVariant = 'positive' | 'black-owned' | 'report';

const GRADIENTS: Record<SquircleVariant, readonly [string, string]> = {
  positive: [colors.freshgreen, colors.wiltedgreen],
  // black-owned stays solid burntgreen — identity marker, not sentiment.
  // The same color twice still renders the LinearGradient cleanly.
  'black-owned': [colors.burntgreen, colors.burntgreen],
  report: [colors.orange, colors.slightlyDarkOrange],
};

const SHADOW_TINT: Record<SquircleVariant, string> = {
  positive: colors.freshgreen,
  'black-owned': colors.burntgreen,
  report: colors.orange,
};

function GlyphForCategory({
  categoryId,
  size,
}: {
  categoryId: string;
  size: number;
}) {
  switch (categoryId) {
    case 'black-owned':
      return <GlyphBlackOwned width={size} height={size} />;
    case 'felt-welcome':
      return <GlyphFeltWelcome width={size} height={size} />;
    case 'felt-unsafe':
      return <GlyphFeltUnsafe width={size} height={size} />;
    case 'incident':
      return <GlyphIncident width={size} height={size} />;
    case 'lighting':
      return <GlyphLighting width={size} height={size} />;
    case 'hazard':
      return <GlyphHazard width={size} height={size} />;
    default:
      // Defensive fallback — keeps the icon visible if a new categoryId
      // is added before this dispatch is updated. Hazard reads as a
      // sensible "generic report."
      return <GlyphHazard width={size} height={size} />;
  }
}

export function SquircleIcon({
  categoryId,
  variant,
  size = 40,
  style,
}: {
  categoryId: string;
  variant: SquircleVariant;
  /** Outer squircle dimension. Glyph renders at 60% of this. Default 40.
   *  If rendered inside a Pressable, ensure the container meets the 44pt
   *  tap-target minimum per .cursorrules. Use 48 for tappable contexts. */
  size?: number;
  style?: ViewStyle;
}) {
  const glyphSize = Math.round(size * 0.6);
  const shadowStyle: ViewStyle = {
    shadowColor: SHADOW_TINT[variant],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  };

  return (
    <View style={[shadowStyle, style]}>
      <LinearGradient
        colors={GRADIENTS[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.squircle,
          { width: size, height: size, borderRadius: radii.md },
        ]}
      >
        <GlyphForCategory categoryId={categoryId} size={glyphSize} />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  squircle: {
    alignItems: 'center',
    justifyContent: 'center',
    // overflow:'hidden' so the gradient respects borderRadius — without
    // it, LinearGradient on Android paints past the rounded corners on
    // some devices.
    overflow: 'hidden',
  },
});
