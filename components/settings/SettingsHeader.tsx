// components/settings/SettingsHeader.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { X } from 'phosphor-react-native/src/icons/X';

import { colors } from '../../theme/colors';
import { dynamicType } from '../../theme/dynamic-type';
import { pressedDim } from '../../theme/interaction';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

/**
 * Settings page header. Three slots: optional chevron-back (left),
 * centered title, always-present close-X (right).
 *
 * Per the settings-register spec (Q2-a): the settings-tree ROOT
 * (/menu) passes only `onClose` — there's no parent to point a back
 * chevron at, so the left slot renders an equal-width spacer to keep
 * the title centered. CHILD pages pass both `onBack` (pop to /menu)
 * and `onClose` (exit the whole flow to /home).
 *
 * Both controls are 44pt visual tap targets per .cursorrules.
 */
export function SettingsHeader({
  title,
  onBack,
  onClose,
}: {
  title: string;
  onBack?: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={({ pressed }) => [styles.control, pressed && pressedDim]}
        >
          <CaretLeft size={28} color={colors.black} weight="regular" />
        </Pressable>
      ) : (
        <View style={styles.control} />
      )}

      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>

      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={8}
        style={({ pressed }) => [styles.control, pressed && pressedDim]}
      >
        <X size={24} color={colors.black} weight="regular" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  // 44pt visual tap target on both controls; the spacer matches so the
  // centered title stays optically centered whether or not onBack is set.
  control: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
    textAlign: 'center',
    flex: 1,
  },
});
