// components/settings/SettingsHeader.tsx
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { X } from 'phosphor-react-native/src/icons/X';

import { colors } from '../../theme/colors';
import { dynamicType } from '../../theme/dynamic-type';
import { pressedDim } from '../../theme/interaction';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

/**
 * Settings page header. Two registers:
 *
 * Default (child pages): optional chevron-back (left), centered title,
 * always-present close-X (right). Per the settings-register spec (Q2-a),
 * child pages pass both `onBack` (pop to /menu) and `onClose` (exit to
 * /home); the back chevron's absence renders an equal-width spacer so
 * the centered title stays optically centered.
 *
 * Large (`large` — the settings-tree ROOT, /menu): a big LEFT-aligned
 * title with an optional leading `icon` (the gear), close-X on the
 * right. iOS large-title pattern for a settings root; children keep the
 * compact centered register.
 *
 * Both controls are 44pt visual tap targets per .cursorrules.
 */
export function SettingsHeader({
  title,
  onBack,
  onClose,
  large = false,
  icon,
}: {
  title: string;
  onBack?: () => void;
  onClose: () => void;
  large?: boolean;
  icon?: ReactNode;
}) {
  if (large) {
    return (
      <View style={styles.headerLarge}>
        <View style={styles.largeLeft}>
          {icon ? <View style={styles.largeIcon}>{icon}</View> : null}
          <Text
            style={styles.largeTitle}
            accessibilityRole="header"
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
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
  // --- Large register (root /menu) ---
  headerLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // More left inset than the compact header so the large title reads
    // as an iOS large-title; close-X keeps its standard right position.
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    paddingVertical: spacing.sm,
  },
  largeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  // Box sized to the 28pt gear glyph so it baseline-aligns with the title.
  largeIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeTitle: {
    ...dynamicType(typography.title1Emphasized),
    color: colors.black,
    flexShrink: 1,
  },
});
