import { type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import GlyphBlackOwned from '../assets/illustrations/mapmarker-glyph-black-owned.svg';
import GlyphFeltUnsafe from '../assets/illustrations/mapmarker-glyph-felt-unsafe.svg';
import GlyphFeltWelcome from '../assets/illustrations/mapmarker-glyph-felt-welcome.svg';
import { usePulseOpacity } from '../hooks/usePulseOpacity';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { typography } from '../theme/typography';

import { type Variant } from './LandmarkMarker';

/**
 * Off-viewport POI indicator — per Figma `1133:13250`.
 *
 * Shape: a 36pt colored circle with a small triangular tail at the
 * bottom pointing outward, the whole thing rotated so the tail
 * faces the direction of the off-screen POI. The 24pt inner glyph
 * is counter-rotated so the icon stays upright regardless of the
 * marker's orientation.
 *
 * Variant maps to color + default glyph:
 *   - 'positive'    → slightlyWiltedGreen circle + FeltWelcome heart
 *   - 'report'      → slightlyDarkOrange circle + FeltUnsafe eye
 *   - 'black-owned' → black circle + BlackOwned storefront
 *
 * When `count > 1`, the inner glyph is replaced with the counter
 * number (matches the Figma "Badge" variant). The Badge variant in
 * Figma uses brand orange with a white border, but for visual
 * consistency the cluster counter inherits the underlying variant's
 * color — a cluster of felt-unsafe reports still reads as orange.
 *
 * Caller can pass `children` to override the default glyph (e.g. a
 * custom Phosphor icon). When omitted, the variant-default glyph
 * renders.
 */
export function EdgeIndicator({
  x,
  y,
  rotation,
  variant,
  count,
  children,
  onPress,
  accessibilityLabel,
}: {
  x: number;
  y: number;
  rotation: number;
  variant?: Variant;
  count?: number;
  children?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const pulse = usePulseOpacity(0.55);
  const fillColor = variant ? VARIANT_COLOR[variant] : colors.labelSecondary;
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
        { left: x - 36, top: y - 36, transform: [{ rotate: `${rotation}deg` }] },
        pressed && pressedDim,
      ]}
    >
      <Animated.View style={[styles.inner, { opacity: pulse }]}>
        {/*
          Triangle tail. Drawn via View borders — cheap, no SVG asset
          needed. The tail points "down" within the unrotated frame;
          the wrapper's rotate transform swings it to face the actual
          off-viewport direction. Positioned at the bottom of the
          frame so the circle sits centered with the tail extending
          beyond.
        */}
        <View
          style={[
            styles.tail,
            { borderTopColor: fillColor },
          ]}
        />
        {/*
          The colored circle. Counter-rotated so the inner glyph (or
          counter number) stays upright regardless of the wrapper's
          rotation — a marker facing north and one facing south both
          have a vertically-upright eye/heart inside the circle.
        */}
        <View
          style={[
            styles.circle,
            { backgroundColor: fillColor },
            { transform: [{ rotate: `${-rotation}deg` }] },
          ]}
        >
          {showCount ? (
            <Text style={styles.countText}>{countLabel}</Text>
          ) : children ? (
            children
          ) : variant ? (
            <DefaultGlyphForVariant variant={variant} />
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

function DefaultGlyphForVariant({ variant }: { variant: Variant }) {
  switch (variant) {
    case 'positive':
      return <GlyphFeltWelcome width={24} height={24} />;
    case 'report':
      return <GlyphFeltUnsafe width={24} height={24} />;
    case 'black-owned':
      return <GlyphBlackOwned width={24} height={24} />;
  }
}

const VARIANT_COLOR: Record<Variant, string> = {
  'positive': colors.slightlyWiltedGreen,
  'report': colors.slightlyDarkOrange,
  'black-owned': colors.black,
};

const styles = StyleSheet.create({
  // 72pt frame per Figma 1133:13250 — the wrapper is the rotation
  // anchor, so its size dictates how much the tail extends beyond
  // the circle when the marker is "pointing" in any direction. The
  // x/y caller-passed coords land at the frame's top-left; we shift
  // by -36 to center the frame on (x, y).
  wrap: {
    position: 'absolute',
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    // Slight elevation so the marker reads as floating above the
    // map, matching the LandmarkMarker shadow register.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  // 36pt circle holding the glyph or counter. Stays centered in the
  // frame; the tail extends beyond it.
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // CSS triangle via border tricks. The 0×0 element draws its borders
  // as the only visible content; setting transparent on three sides
  // and the fill color on the top yields a downward-pointing triangle.
  // Positioned below the circle's center so it reads as a "tail"
  // extending from the bottom of the marker.
  tail: {
    position: 'absolute',
    top: 32,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  countText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
  },
});
