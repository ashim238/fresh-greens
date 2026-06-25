import { Pressable } from 'react-native';

import { Star } from 'phosphor-react-native/src/icons/Star';

import { colors } from '../theme/colors';
import { pressedDim, tapTarget44 } from '../theme/interaction';

/**
 * Trust-star toggle — identical affordance wherever a gas/charging
 * station is shown (FuelStopsSheet, /search Gas results). Filled
 * wiltedgreen when trusted, hollow labelTertiary otherwise. Compact
 * glyph centered in a 44pt painted tap target.
 *
 * Spec: docs/archive/superpowers/specs/2026-06-02-preferred-stations-design.md
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
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (preferred ? 'Untrust this station' : 'Trust this station')
      }
      accessibilityState={{ selected: preferred }}
      style={({ pressed }) => [tapTarget44, pressed && pressedDim]}
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
