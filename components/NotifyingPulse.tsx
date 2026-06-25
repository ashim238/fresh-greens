import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { joinMetaParts } from './MetaSeparator';

import { usePulseOpacity } from '../hooks/usePulseOpacity';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Props = {
  contactName: string;
  /** Optional override; defaults to Messages-opened copy. */
  label?: string;
  /** When set, renders label beats with MetaSeparator instead of a string. */
  labelParts?: readonly string[];
  /** Centered (flow footers) vs. row-left (inside widget chrome). Default: 'center'. */
  align?: 'center' | 'start';
  /** Re-open the pre-filled Messages composer. */
  onPress?: () => void;
};

/**
 * Messages composer affordance — pulsing freshgreen dot + label. Share flows
 * auto-open Messages when a session starts; onPress re-opens the draft.
 */
export function NotifyingPulse({
  contactName,
  label,
  labelParts,
  align = 'center',
  onPress,
}: Props) {
  const reduceMotion = useReduceMotion();
  const pulse = usePulseOpacity();
  const resolvedLabel =
    label ??
    (labelParts && labelParts.length > 0
      ? labelParts.join(', ')
      : `Messages opened for ${contactName} — tap Send`);

  const content = (
    <>
      <Animated.View
        style={[styles.dot, reduceMotion ? undefined : { opacity: pulse }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      {labelParts && labelParts.length > 0 ? (
        <View style={styles.labelRow}>
          {joinMetaParts(labelParts, {
            textStyle: styles.label,
            separatorStyle: styles.labelSeparator,
          })}
        </View>
      ) : (
        <Text style={styles.label}>{resolvedLabel}</Text>
      )}
    </>
  );

  const rowStyle = [
    styles.row,
    align === 'center' ? styles.alignCenter : styles.alignStart,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [rowStyle, pressed && pressedDim]}
        accessibilityRole="button"
        accessibilityLabel={resolvedLabel}
        accessibilityHint="Opens Messages with a safety check-in text"
        hitSlop={8}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={rowStyle} accessibilityLabel={resolvedLabel}>
      {content}
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
    borderRadius: radii.xs,
    backgroundColor: colors.freshgreen,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  label: {
    ...dynamicType(relaxedLineHeight(typography.footnoteRegular)),
    color: colors.labelSecondary,
  },
  labelSeparator: {
    ...dynamicType(relaxedLineHeight(typography.footnoteRegular)),
    color: colors.labelSecondary,
  },
});
