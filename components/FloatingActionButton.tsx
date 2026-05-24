import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';

/**
 * Floating circular icon button — consolidates the `sideBtn`,
 * `menuButton`, and `avatarButton` styles previously duplicated
 * across /home and /en-route into one component matching Figma
 * `1133:13197`.
 *
 *   - `size="56"`  /en-route side column (Volume, Help, Shield,
 *                  Recenter, Report). 32pt glyph.
 *   - `size="48"`  /home top-row overlays (Menu, Avatar). 24pt glyph.
 *
 * White surface + M3/Elevation/2 shadow + universal `pressedDim`
 * (0.7) for Pressed. Glyph is passed in via `children` — the
 * component is icon-agnostic; consumers pass Phosphor / Ionicons /
 * custom SVG as appropriate.
 */

type Size = '48' | '56';

export function FloatingActionButton({
  children,
  onPress,
  disabled,
  size = '56',
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  size?: Size;
  accessibilityLabel?: string;
  /** Optional VoiceOver hint — pairs with accessibilityLabel to
      explain *what tapping does*. Useful on FABs whose visual glyph
      is iconography-only and whose label is a noun ("Change
      destination") rather than a verb phrase. */
  accessibilityHint?: string;
  style?: ViewStyle;
}) {
  const dimensions = size === '56' ? styles.size56 : styles.size48;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        dimensions,
        style,
        (pressed || disabled) && pressedDim,
      ]}
    >
      <View style={styles.iconWrap}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.white,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    // M3/Elevation/2 approximation. RN renders one shadow; using the
    // bigger soft halo (the second Figma layer is a sharp contact
    // shadow that's mostly invisible against white anyway).
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  size56: {
    width: 56,
    height: 56,
  },
  size48: {
    width: 48,
    height: 48,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
