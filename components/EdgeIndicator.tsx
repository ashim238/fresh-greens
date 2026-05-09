import { type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import PinBlackOwned from '../assets/illustrations/mapmarker-pin-blackowned.svg';
import PinLocalBusiness from '../assets/illustrations/mapmarker-pin-localbusiness.svg';
import PinPositive from '../assets/illustrations/mapmarker-pin-positive.svg';
import PinReport from '../assets/illustrations/mapmarker-pin-report.svg';
import { usePulseOpacity } from '../hooks/usePulseOpacity';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';

import { GlyphForCategory, type Variant } from './LandmarkMarker';

const PIN_SVGS: Record<Variant, typeof PinReport> = {
  'black-owned': PinBlackOwned,
  positive: PinPositive,
  'local-business': PinLocalBusiness,
  report: PinReport,
};

/**
 * Off-screen POI indicator rendered absolutely on the screen edge.
 * Tap recenters the map on the POI.
 *
 * Two visual modes:
 *   - **Pin mode** (`variant` set): 32pt teardrop silhouette matching
 *     the on-screen LandmarkMarker (Figma 296:439). Pulses with the
 *     canonical breathe rhythm via usePulseOpacity. Inner glyph
 *     matches the category SVG from the LandmarkMarker system.
 *   - **Pill mode** (no `variant`): original 32pt circular pill with
 *     a triangular arrow tip. Used for non-LandmarkMarker POIs
 *     (e.g., saved home).
 *
 * Position + rotation are computed in lib/edge-indicators.ts.
 */
export function EdgeIndicator({
  x,
  y,
  rotation,
  variant,
  categoryId,
  subTag,
  surfaceColor = colors.white,
  borderColor = colors.cardBorderSubtle,
  arrowColor = colors.labelSecondary,
  children,
  onPress,
  accessibilityLabel,
}: {
  x: number;
  y: number;
  rotation: number;
  variant?: Variant;
  categoryId?: string;
  subTag?: string;
  surfaceColor?: string;
  borderColor?: string;
  arrowColor?: string;
  children?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const pulse = usePulseOpacity(0.55);
  const PinSvg = variant ? PIN_SVGS[variant] : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.wrap,
        { left: x - 16, top: y - 16, transform: [{ rotate: `${rotation}deg` }] },
        pressed && pressedDim,
      ]}
    >
      {PinSvg ? (
        <Animated.View style={[styles.pinWrap, { opacity: pulse }]}>
          <View style={styles.pinRotate}>
            <PinSvg width={20} height={26} />
          </View>
          <View
            style={[
              styles.pinGlyph,
              { transform: [{ rotate: `${-rotation}deg` }] },
            ]}
          >
            {categoryId ? (
              <GlyphForCategory
                categoryId={categoryId}
                subTag={subTag}
                variant={variant!}
                size={10}
              />
            ) : (
              children
            )}
          </View>
        </Animated.View>
      ) : (
        <>
          <View
            style={[
              styles.pill,
              { backgroundColor: surfaceColor, borderColor },
            ]}
          >
            <View style={{ transform: [{ rotate: `${-rotation}deg` }] }}>
              {children}
            </View>
          </View>
          <View style={[styles.tip, { borderLeftColor: arrowColor }]} />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // --- Pin mode (Figma 296:439) ---
  pinWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  pinRotate: {
    transform: [{ rotate: '-90deg' }],
  },
  pinGlyph: {
    position: 'absolute',
    left: 2,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // --- Pill mode (original) ---
  pill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  tip: {
    position: 'absolute',
    right: -6,
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
});
