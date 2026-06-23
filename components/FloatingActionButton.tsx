import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { MaterialSurface } from './MaterialSurface';
import { pressedDim } from '../theme/interaction';

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
 * MaterialSurface `tier="chrome"` surface (blurred glass over the map).
 * Falls back to solid white when Reduce Transparency is on. Universal
 * `pressedDim` (0.7) for Pressed state. Glyph is passed in via
 * `children` — the component is icon-agnostic; consumers pass Phosphor
 * icons as appropriate.
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
  const dim = size === '56' ? styles.size56 : styles.size48;
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
        dim,
        style,
        (pressed || disabled) && pressedDim,
      ]}
    >
      <MaterialSurface tier="chrome" style={[styles.surface, dim]}>
        <View style={styles.iconWrap}>{children}</View>
      </MaterialSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
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
