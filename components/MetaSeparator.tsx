import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Interpunct (·) beat between inline meta tokens ("arrive 8:30 · 12 mi").
 * Owns symmetric horizontal padding so the glyph sits equidistant from
 * flanking Text siblings — flex `gap` or a leading "· " in a string leaves
 * the middot optically closer to one neighbor.
 */
export function MetaSeparator({ style }: { style?: StyleProp<TextStyle> }) {
  return (
    <Text
      style={[styles.base, style]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      ·
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.labelTertiary,
    paddingHorizontal: spacing.xs,
  },
});
