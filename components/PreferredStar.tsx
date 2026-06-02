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
      {/* Filled YELLOW star when trusted — the universal "favorite"
          mark. Documented reserved-color carve-out: yellow is otherwise
          the caution signal, but a filled favorite-star is iconographic
          enough (App Store / ratings convention) to read as "favorite",
          not "caution" — same universal-iconography logic as the
          recording-red carve-out. See .cursorrules carve-out #9. Hollow
          gray when not trusted. */}
      <Star
        size={24}
        weight={preferred ? 'fill' : 'regular'}
        color={preferred ? colors.yellow : colors.labelTertiary}
      />
    </Pressable>
  );
}
