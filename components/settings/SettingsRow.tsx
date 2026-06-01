// components/settings/SettingsRow.tsx
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';

import { colors } from '../../theme/colors';
import { dynamicType } from '../../theme/dynamic-type';
import { pressedDim } from '../../theme/interaction';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type Trailing = 'chevron' | 'toggle' | 'segmented' | 'none';

/**
 * One settings row. Icon (optional) + label + a trailing affordance.
 *
 * trailing:
 *   'chevron' (default) — pushes to a sub-page; row is a Pressable.
 *   'toggle'            — RN Switch; row is NOT a Pressable (the Switch
 *                         owns interaction).
 *   'none'              — static / value-only row.
 *   'segmented'         — INTERFACE ONLY in Plan 1. No renderer here;
 *                         the prop slots are reserved for Phase B's
 *                         distance-units row. Passing 'segmented' in
 *                         Plan 1 renders as 'none' (no crash, no pill).
 *
 * `value` renders right-aligned text before the trailing affordance
 * (e.g. "English (US)"). `destructive` makes the row a centered red
 * label with no icon / no trailing (Sign out).
 *
 * Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md
 */
export function SettingsRow({
  icon,
  label,
  value,
  trailing = 'chevron',
  toggleValue,
  onToggle,
  onPress,
  destructive,
  accessibilityHint,
}: {
  icon?: ReactNode;
  label: string;
  value?: string;
  trailing?: Trailing;
  toggleValue?: boolean;
  onToggle?: (next: boolean) => void;
  onPress?: () => void;
  destructive?: boolean;
  accessibilityHint?: string;
}) {
  if (destructive) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.row, pressed && pressedDim]}
      >
        <Text style={[styles.label, styles.destructiveLabel]}>{label}</Text>
      </Pressable>
    );
  }

  const isToggle = trailing === 'toggle';

  const body = (
    <>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing === 'chevron' ? (
        <CaretRight size={16} color={colors.labelTertiary} weight="regular" />
      ) : null}
      {isToggle ? (
        <Switch
          value={!!toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: colors.cardBorderSubtle, true: colors.freshgreen }}
          thumbColor={colors.white}
          accessibilityLabel={label}
          accessibilityHint={accessibilityHint}
        />
      ) : null}
    </>
  );

  // Toggle rows are not Pressables — the Switch owns interaction.
  if (isToggle) {
    return <View style={styles.row}>{body}</View>;
  }

  // Static row (no onPress, not a toggle) — a plain View so VoiceOver
  // doesn't announce a non-interactive value row as a button and the
  // row doesn't swallow touches.
  if (!onPress) {
    return (
      <View
        style={styles.row}
        accessible
        accessibilityLabel={value ? `${label}, ${value}` : label}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, pressed && pressedDim]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // 52pt min-height + 12pt vertical padding — a touch roomier than
    // the iOS 44pt floor so rows breathe inside the grouped cards
    // (user-flagged 2026-06-01: the register felt tight). Still clears
    // the HIG 44pt tap-target minimum with margin.
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
    flex: 1,
  },
  // flexShrink + numberOfLines: a long value (e.g. "Reach a trusted
  // contact or 911") must truncate rather than squeeze the flex:1
  // label into a wrap. textAlign right keeps it iOS-value-aligned.
  value: {
    ...dynamicType(typography.bodyRegular),
    color: colors.labelSecondary,
    flexShrink: 1,
    textAlign: 'right',
  },
  destructiveLabel: {
    ...dynamicType(typography.bodyRegular),
    color: colors.red,
    textAlign: 'center',
    flex: 1,
  },
});
