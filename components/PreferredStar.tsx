import { Pressable } from 'react-native';

import { Star } from 'phosphor-react-native/src/icons/Star';

import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';

/**
 * Trust-star toggle — identical affordance wherever a gas/charging
 * station is shown (FuelStopsSheet, /search Gas results). Filled
 * wiltedgreen when trusted, hollow labelTertiary otherwise. Compact
 * glyph with hitSlop for a 44pt effective tap target.
 *
 * Spec: docs/superpowers/specs/2026-06-02-preferred-stations-design.md
 */
export function PreferredStar({
  preferred,
  onToggle,
  accessibilityLabel,
}: {
  preferred: boolean;
  onToggle: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (preferred ? 'Untrust this station' : 'Trust this station')
      }
      accessibilityState={{ selected: preferred }}
      style={({ pressed }) => [pressed && pressedDim]}
    >
      <Star
        size={24}
        weight={preferred ? 'fill' : 'regular'}
        color={preferred ? colors.wiltedgreen : colors.labelTertiary}
      />
    </Pressable>
  );
}
