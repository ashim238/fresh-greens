import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';

/**
 * Off-screen POI indicator — a small pill rendered absolutely on the
 * screen edge, with a glyph inside and a directional arrow on the
 * outer side. Tap recenters the map on the POI.
 *
 * Position + rotation are computed in lib/edge-indicators.ts and
 * passed in as { x, y, rotation } in screen-space pt.
 */
export function EdgeIndicator({
  x,
  y,
  rotation,
  surfaceColor = colors.white,
  borderColor = colors.cardBorderSubtle,
  arrowColor = colors.labelSecondary,
  children,
  onPress,
  accessibilityLabel,
}: {
  x: number;
  y: number;
  /** Degrees, 0 = pointing right. */
  rotation: number;
  surfaceColor?: string;
  borderColor?: string;
  arrowColor?: string;
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      // Center the 32pt pill on (x, y); the parent overlay uses
      // pointerEvents="box-none" so empty space passes taps through
      // to the map.
      style={[
        styles.wrap,
        { left: x - 16, top: y - 16, transform: [{ rotate: `${rotation}deg` }] },
      ]}
    >
      <View
        style={[
          styles.pill,
          { backgroundColor: surfaceColor, borderColor },
        ]}
      >
        {/* Counter-rotate the glyph so the icon stays upright while
            the wrapping pill rotates with the bearing. */}
        <View style={{ transform: [{ rotate: `${-rotation}deg` }] }}>
          {children}
        </View>
      </View>
      {/* Tip — a small triangle on the outside (right side after
          rotation) that visually points toward the POI. */}
      <View style={[styles.tip, { borderLeftColor: arrowColor }]} />
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
