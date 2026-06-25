import { House } from 'phosphor-react-native/src/icons/House';
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
import GlyphIncident from '../assets/illustrations/mapmarker-glyph-incident.svg';
import GlyphLateNight from '../assets/illustrations/mapmarker-glyph-late-night.svg';
import GlyphLgbtq from '../assets/illustrations/mapmarker-glyph-lgbtq.svg';
import GlyphLighting from '../assets/illustrations/mapmarker-glyph-lighting.svg';
import GlyphRestroom from '../assets/illustrations/mapmarker-glyph-restroom.svg';
import GlyphWomenOwned from '../assets/illustrations/mapmarker-glyph-womenowned.svg';
import { MarkerGlyph } from './MarkerGlyph';
import { usePulseOpacity } from '../hooks/usePulseOpacity';
import { colors } from '../theme/colors';
import { markerCircleBgFor, markerGlyphStroke } from '../theme/marker-glyph';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { dynamicType } from '../theme/dynamic-type';
import { typography } from '../theme/typography';

import { type Variant } from './LandmarkMarker';

/**
 * Off-viewport POI indicator — per Figma `1133:13250`.
 *
 * Layered composition matching Figma's `Location Landmark` group:
 *
 *   1. Bottom layer — the colored teardrop polygon (42×62, per
 *      variant). Tip points toward the off-screen POI via the
 *      `rotation + 90` transform on its wrapper.
 *
 *   2. Middle layer — a 36pt solid-fill circle, sized and colored
 *      per Figma's `Icon` background. Sits at the polygon's
 *      "circle" (rounded-base) position so the polygon's tail and
 *      this circle visually nest. The circle's color depends on
 *      both `variant` and `categoryId`:
 *        positive (review/shop) → slightlyWiltedGreen
 *        positive + trusted-friend → burntgreen (matches the on-
 *          map marker's dark inner circle)
 *        report                → slightlyDarkOrange
 *        black-owned           → black
 *
 *   3. Top layer — the 24pt inner glyph (or the 22×15 trusted-
 *      friend car, which is wider-than-tall and uses its native
 *      dimensions). Counter-rotated to stay upright at any wrapper
 *      rotation.
 *
 * Rotation note: the source polygon SVG's tip is at (21, 0) —
 * pointing UP. The caller's `rotation` is screen-space atan2 where
 * 0° = right. We add +90° to swing the up-tip to face the actual
 * off-viewport direction.
 *
 * Per-category glyph routing: `categoryId` (when set) wins over
 * the variant default. Trusted-friend renders the brand-baked car
 * glyph (extracted from `trusted-friend.svg`); other categories
 * use their respective single-purpose glyphs.
 *
 * `count > 1` replaces the inner glyph with the counter number,
 * inheriting the variant's color via the circle.
 */
export function EdgeIndicator({
  x,
  y,
  rotation,
  variant,
  categoryId,
  subTag,
  count,
  children,
  onPress,
  accessibilityLabel,
}: {
  x: number;
  y: number;
  rotation: number;
  variant?: Variant;
  categoryId?: string;
  /** Identity / place sub-tag — mirrors LandmarkMarker dispatch. */
  subTag?: string;
  count?: number;
  children?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const pulse = usePulseOpacity(0.55);
  const Polygon = variant ? POLYGON_FOR_VARIANT[variant] : EdgeReport;
  const circleColor = markerCircleBgFor(variant, categoryId, 'edge');
  const showCount = count != null && count > 1;
  const countLabel = count != null && count > 9 ? '9+' : String(count);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }) => [
        styles.wrap,
        { left: x - 36, top: y - 36 },
        pressed && pressedDim,
      ]}
    >
      {/* Layer 1: polygon, rotated to point at POI. */}
      <Animated.View
        style={[
          styles.fullLayer,
          {
            opacity: pulse,
            transform: [{ rotate: `${rotation + 90}deg` }],
          },
        ]}
      >
        <Polygon width={42} height={62} />
      </Animated.View>

      {/* Layer 2+3: circle (rotates with polygon) + icon (counter-rotates). */}
      <View
        style={[
          styles.fullLayer,
          { transform: [{ rotate: `${rotation + 90}deg` }] },
        ]}
      >
        <View
          style={[
            styles.circle,
            { backgroundColor: circleColor },
            { transform: [{ translateY: 9 }] },
          ]}
        >
          <View
            style={{ transform: [{ rotate: `${-(rotation + 90)}deg` }] }}
          >
            {showCount ? (
              <Text style={styles.countText}>{countLabel}</Text>
            ) : children ? (
              children
            ) : (
              <DefaultGlyph
                categoryId={categoryId}
                subTag={subTag}
                variant={variant}
                bgColor={circleColor}
              />
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Per-category glyph dispatch. `categoryId` wins when set; otherwise
 * fall back to the variant default. The trusted-friend case is the
 * load-bearing reason this exists — both trusted-friend and felt-
 * welcome map to variant='positive', but they need different inner
 * glyphs (car vs heart).
 *
 * Trusted-friend uses the car at native 22.14×15.03 (wider than
 * tall, sits inside the circle with natural padding). Other
 * categories use square 24pt glyphs.
 */
function DefaultGlyph({
  categoryId,
  subTag,
  variant,
  bgColor,
}: {
  categoryId?: string;
  subTag?: string;
  variant?: Variant;
  bgColor: string;
}) {
  // Identity-tag bespoke SVGs — same four as LandmarkMarker so on-map
  // and off-screen edge markers read identically.
  switch (subTag) {
    case 'Women-owned':
      return <MarkerGlyph Glyph={GlyphWomenOwned} bgColor={bgColor} width={24} />;
    case 'LGBTQ+ welcoming':
      return <MarkerGlyph Glyph={GlyphLgbtq} bgColor={bgColor} width={24} />;
    case 'Open restroom':
      return <MarkerGlyph Glyph={GlyphRestroom} bgColor={bgColor} width={24} />;
    case 'Late-night welcome':
      return <MarkerGlyph Glyph={GlyphLateNight} bgColor={bgColor} width={24} />;
  }

  switch (categoryId) {
    case 'trusted-friend':
      return <EdgeGlyphCar width={22.14} height={15.03} />;
    case 'home':
      return (
        <House
          size={24}
          color={markerGlyphStroke(bgColor)}
          weight="duotone"
        />
      );
    case 'felt-welcome':
      return <MarkerGlyph Glyph={GlyphFeltWelcome} bgColor={bgColor} width={24} />;
    case 'felt-unsafe':
      return <MarkerGlyph Glyph={GlyphFeltUnsafe} bgColor={bgColor} width={24} />;
    case 'incident':
      return <MarkerGlyph Glyph={GlyphIncident} bgColor={bgColor} width={24} />;
    case 'lighting':
      return <MarkerGlyph Glyph={GlyphLighting} bgColor={bgColor} width={24} />;
    case 'hazard':
      return <MarkerGlyph Glyph={GlyphHazard} bgColor={bgColor} width={24} />;
    case 'black-owned':
      return <MarkerGlyph Glyph={GlyphBlackOwned} bgColor={bgColor} width={24} />;
  }
  switch (variant) {
    case 'positive':
      return <MarkerGlyph Glyph={GlyphFeltWelcome} bgColor={bgColor} width={24} />;
    case 'report':
      return <MarkerGlyph Glyph={GlyphFeltUnsafe} bgColor={bgColor} width={24} />;
    case 'black-owned':
      return <MarkerGlyph Glyph={GlyphBlackOwned} bgColor={bgColor} width={24} />;
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
  // Both polygon and circle-icon layers fill the 72pt wrapper and
  // center their content. Same width/height + same alignment puts
  // them in the same spatial frame; the layer's `transform` rotates
  // the whole thing around the wrapper's center.
  fullLayer: {
    position: 'absolute',
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    // e3 = "markers and pins" per shadows.ts. The edge marker is a
    // directional pin pointing toward off-screen content — same
    // weight class as LandmarkMarker (which also uses e3) and needs
    // to read distinctly against busy basemap tiles. Previously
    // inlined as a hand-tuned (h:1, op:0.25, r:3, e:3) block that
    // matched e3's opacity exactly but used a smaller radius.
    ...shadows.e3,
  },
  // The 36pt colored disk that sits at the polygon's "head" position.
  // translateY:9 (applied inline) shifts it into the lower half of
  // the polygon, where the rounded tip lives. Icons get centered
  // inside via the View's flex alignment.
  circle: {
    width: 36,
    height: 36,
    // radii.lg (16) on a 36×36 view reads as a rounded square at the
    // map edge — pill (999) keeps the disk circular at any size.
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.white,
  },
});
