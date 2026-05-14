import { type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import EdgeBlackOwned from '../assets/illustrations/edge-marker-blackowned.svg';
import EdgePositive from '../assets/illustrations/edge-marker-positive.svg';
import EdgeReport from '../assets/illustrations/edge-marker-report.svg';
import EdgeGlyphCar from '../assets/illustrations/edge-marker-glyph-car.svg';
import GlyphBlackOwned from '../assets/illustrations/mapmarker-glyph-black-owned.svg';
import GlyphFeltUnsafe from '../assets/illustrations/mapmarker-glyph-felt-unsafe.svg';
import GlyphFeltWelcome from '../assets/illustrations/mapmarker-glyph-felt-welcome.svg';
import GlyphHazard from '../assets/illustrations/mapmarker-glyph-hazard.svg';
import GlyphHome from '../assets/illustrations/mapmarker-glyph-home.svg';
import GlyphIncident from '../assets/illustrations/mapmarker-glyph-incident.svg';
import GlyphLighting from '../assets/illustrations/mapmarker-glyph-lighting.svg';
import { usePulseOpacity } from '../hooks/usePulseOpacity';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { typography } from '../theme/typography';

import { type Variant } from './LandmarkMarker';

/**
 * Off-viewport POI indicator — per Figma `1133:13250`.
 *
 * Renders the Figma teardrop polygon SVG (per variant — green for
 * positive, orange for report, black for black-owned) at 42×62,
 * rotated so the tip points toward the off-screen POI. A 24pt inner
 * glyph layers on top, positioned over the polygon's "circle"
 * lower portion and counter-rotated so it stays upright regardless
 * of the wrapper's rotation.
 *
 * Polygon orientation note: the source SVG's tip is at (21, 0) —
 * pointing UP in its natural orientation. The caller's `rotation`
 * uses screen-space `atan2(dy, dx)` where 0° = right. We add +90°
 * to reconcile: at rotation=0, the polygon needs +90° clockwise to
 * swing its up-tip to the right-tip pointing at an east-of-screen
 * POI.
 *
 * Per-category glyph routing: `categoryId` (when set) wins over the
 * variant default. Lets the trusted-friend variant render a Car
 * glyph rather than the felt-welcome heart, even though both map
 * to the `positive` variant.
 *
 * When `count > 1`, the inner glyph is replaced with the counter
 * number ("3", "9+"). Inherits the variant's color via the polygon,
 * so a cluster of felt-unsafe reports stays orange.
 */
export function EdgeIndicator({
  x,
  y,
  rotation,
  variant,
  categoryId,
  count,
  children,
  onPress,
  accessibilityLabel,
}: {
  x: number;
  y: number;
  rotation: number;
  variant?: Variant;
  /**
   * Underlying community-report category id. When set, picks the
   * inner glyph per-category (so trusted-friend gets a Car rather
   * than the variant-default heart). Variant still drives polygon
   * color.
   */
  categoryId?: string;
  count?: number;
  children?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const pulse = usePulseOpacity(0.55);
  const Polygon = variant ? POLYGON_FOR_VARIANT[variant] : EdgeReport;
  const showCount = count != null && count > 1;
  const countLabel = count != null && count > 9 ? '9+' : String(count);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.wrap,
        { left: x - 36, top: y - 36 },
        pressed && pressedDim,
      ]}
    >
      {/*
        Polygon layer — rotates with the off-viewport direction so
        the tip points at the POI. Pulses for "look at me, off-
        screen content here." The +90° offset reconciles the SVG's
        up-tip natural orientation with rotation=0=east semantics.
      */}
      <Animated.View
        style={[
          styles.polygonLayer,
          {
            opacity: pulse,
            transform: [{ rotate: `${rotation + 90}deg` }],
          },
        ]}
      >
        <Polygon width={42} height={62} />
      </Animated.View>
      {/*
        Glyph layer — same rotation as the polygon so the glyph
        moves with the polygon's circle through the rotation, then
        the glyph itself counter-rotates to stay upright. Positioned
        at the polygon's circle center (~21, 40 in the 42×62 local
        coords, which maps to ~36, 45 in the 72-frame after centering).
      */}
      <View
        style={[
          styles.glyphLayer,
          { transform: [{ rotate: `${rotation + 90}deg` }] },
        ]}
      >
        <View
          style={[
            styles.glyphInner,
            {
              // translateY first to shift down to the polygon's
              // circle center in the (still-rotating) parent frame.
              // Then counter-rotate to keep the glyph itself upright.
              transform: [
                { translateY: 9 },
                { rotate: `${-(rotation + 90)}deg` },
              ],
            },
          ]}
        >
          {showCount ? (
            <Text style={styles.countText}>{countLabel}</Text>
          ) : children ? (
            children
          ) : (
            <DefaultGlyph categoryId={categoryId} variant={variant} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Per-category glyph dispatch. `categoryId` wins when set; otherwise
 * we fall back to the variant default. The trusted-friend case is
 * the load-bearing reason this exists — both trusted-friend and
 * felt-welcome map to variant='positive', but they need different
 * inner glyphs (Car vs heart).
 */
function DefaultGlyph({
  categoryId,
  variant,
}: {
  categoryId?: string;
  variant?: Variant;
}) {
  // Specific categories first — these win over variant defaults.
  switch (categoryId) {
    case 'trusted-friend':
      // Custom car glyph extracted from `trusted-friend.svg` (the
      // on-map marker's inner illustration). Re-uses the brand-baked
      // car silhouette + wheels rather than swapping to a generic
      // Phosphor Car — keeps visual continuity between the on-map
      // pin and its off-screen edge indicator. Body recolored white
      // (was freshgreen) so it shows against the green polygon.
      return <EdgeGlyphCar width={24} height={24} />;
    case 'home':
      return <GlyphHome width={24} height={24} />;
    case 'felt-welcome':
      return <GlyphFeltWelcome width={24} height={24} />;
    case 'felt-unsafe':
      return <GlyphFeltUnsafe width={24} height={24} />;
    case 'incident':
      return <GlyphIncident width={24} height={24} />;
    case 'lighting':
      return <GlyphLighting width={24} height={24} />;
    case 'hazard':
      return <GlyphHazard width={24} height={24} />;
    case 'black-owned':
      return <GlyphBlackOwned width={24} height={24} />;
  }
  // Variant defaults when no specific categoryId is set.
  switch (variant) {
    case 'positive':
      return <GlyphFeltWelcome width={24} height={24} />;
    case 'report':
      return <GlyphFeltUnsafe width={24} height={24} />;
    case 'black-owned':
      return <GlyphBlackOwned width={24} height={24} />;
    default:
      return null;
  }
}

const POLYGON_FOR_VARIANT: Record<Variant, typeof EdgeReport> = {
  'positive': EdgePositive,
  'report': EdgeReport,
  'black-owned': EdgeBlackOwned,
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Polygon layer is centered in the 72×72 wrapper. The polygon
  // itself is 42×62; flex centering puts it visually centered, and
  // the transform rotates it around its center point — same
  // anchor as the glyphLayer below, so polygon + glyph rotate in
  // lockstep and the glyph stays inside the polygon's circle.
  polygonLayer: {
    position: 'absolute',
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  // Glyph layer — same 72×72, same rotation, same center. The inner
  // child counter-rotates to stay upright. translateY shifts the
  // glyph down ~9pt to align with the polygon's circle center (which
  // sits in the lower portion of the teardrop, not its geometric
  // center).
  glyphLayer: {
    position: 'absolute',
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphInner: {
    // Layout-time properties only. Transform combines translateY+rotate
    // inline above — putting them both in one transform array preserves
    // order (translate first, rotate second) so the counter-rotation
    // happens around the already-shifted center.
  },
  countText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
  },
});
