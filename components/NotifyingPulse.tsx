import { Animated, StyleSheet, Text, View } from 'react-native';

import { usePulseOpacity } from '../hooks/usePulseOpacity';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Props = {
  contactName: string;
  /** Optional override; defaults to `${contactName} is being notified`. */
  label?: string;
  /** Centered (flow footers) vs. row-left (inside widget chrome). Default: 'center'. */
  align?: 'center' | 'start';
};

/**
 * Shared "{contactName} is being notified" affordance — pulsing freshgreen dot
 * + label. Extracted from /roadside Step 3 (which was the original site) so
 * Unfamiliar, Share Location, and the LiveSafetySheet all share one source
 * of truth for the pattern.
 *
 * A11y: parent View carries the label; the animated dot is decorative
 * (`accessibilityElementsHidden`).
 */
export function NotifyingPulse({ contactName, label, align = 'center' }: Props) {
  const pulse = usePulseOpacity();
  const resolvedLabel = label ?? `${contactName} is being notified`;

  return (
    <View
      style={[
        styles.row,
        align === 'center' ? styles.alignCenter : styles.alignStart,
      ]}
      accessibilityLabel={resolvedLabel}
    >
      <Animated.View
        style={[styles.dot, { opacity: pulse }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={styles.label}>{resolvedLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  alignCenter: {
    justifyContent: 'center',
  },
  alignStart: {
    justifyContent: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.freshgreen,
  },
  label: {
    ...typography.footnoteRegular,
    color: colors.labelSecondary,
  },
});
