import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { pressedDim, pressedFeedback } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';

/**
 * Floating circular icon button — consolidates the `sideBtn`,
 * `menuButton`, and `avatarButton` styles previously duplicated
 * across /home and /en-route into one component matching Figma
 * `1133:13197`.
 *
 *   - `size="56"`  /en-route side column (Volume, SOS, Shield,
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
  onLongPress,
  onPressIn,
  onPressOut,
  disabled,
  size = '56',
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  /** Optional long-press handler. Used for hidden affordances (e.g. the
      menu FAB toggling dev-only chrome) — never the primary action. */
  onLongPress?: () => void;
  /** Exposed for hold-to-confirm patterns (see hooks/useHoldToConfirm). */
  onPressIn?: () => void;
  /** Exposed for hold-to-confirm patterns (see hooks/useHoldToConfirm). */
  onPressOut?: () => void;
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
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        dimensions,
        style,
        pressed && pressedFeedback,
        disabled && pressedDim,
      ]}
    >
      <View style={styles.iconWrap}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // A22: was inline (shadowRadius:6, elevation:4) drifting from the
    // shadows.e2 token (radius:4, elevation:3). Replaced with the
    // canonical e2 spread per DESIGN.md §4. Two
    // visual deltas land with this swap: radius tightens 6→4 (slightly
    // crisper edge), opacity bumps 0.15→0.18. Net result is a marginally
    // tighter, marginally darker lift — within Figma M3/Elevation/2
    // tolerances and consistent with every other e2 surface in the app.
    ...shadows.e2,
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
