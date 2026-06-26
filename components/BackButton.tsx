// components/BackButton.tsx
import { Pressable, type ViewStyle } from 'react-native';

import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';

import { colors } from '../theme/colors';
import { pressedDim, tapTarget44 } from '../theme/interaction';

/**
 * Shared back-affordance for screen-pop registers (safety flows, modal
 * children, list detail). 28pt black CaretLeft inside a 44pt painted
 * tap target — the convention `SettingsHeader` also uses for its inline
 * back. Consolidates 6 hand-rolled copies that were drifting in tap-
 * target style (some forgot `tapTarget44`).
 *
 * Out of scope:
 *  - `SettingsHeader` keeps its own copy (it owns the settings register's
 *    title + close-X chrome and would be over-coupled here).
 *  - `/report`'s back arrow stays inline — it's a 24pt labelTertiary
 *    glyph on the transparent-modal register, deliberately different
 *    from the screen-pop register this component serves.
 */
export function BackButton({
  onPress,
  accessibilityLabel = 'Back',
  style,
}: {
  onPress: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [tapTarget44, style, pressed && pressedDim]}
    >
      <CaretLeft size={28} color={colors.black} weight="regular" />
    </Pressable>
  );
}
