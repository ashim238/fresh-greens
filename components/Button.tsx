import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle, View } from 'react-native';

import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { shadows } from '../theme/shadows';
import { typography } from '../theme/typography';

/**
 * Unified Button — replaces the ad-hoc button styles previously
 * scattered across screens (`scheduleBtn`, `goBtn`, `ctaPrimary`,
 * etc.) with one component matching Figma `1133:12988`.
 *
 * Variant matrix (10 total per Figma):
 *
 *   Type=Primary   × Fill=Fill         freshgreen bg, white text, M3/Elevation/1
 *                  × Fill=Outline      freshgreen border, freshgreen text
 *                  × Fill=Transparent  no bg/border, freshgreen text — for use on dark surfaces
 *   Type=Secondary × Fill=Fill         wiltedgreen bg, white text, M3/Elevation/1
 *                  × Fill=Outline      wiltedgreen border, wiltedgreen text
 *
 * Pressed state is handled automatically via the universal
 * `pressedDim` (opacity 0.7) — no separate Pressed prop needed in
 * code, since React Native's `Pressable` provides the `pressed`
 * boolean. Figma encodes Pressed as a separate variant for
 * documentation; in code it's a runtime state.
 *
 * `Type=Secondary, Fill=Transparent` is intentionally not a Figma
 * variant (would be too low-emphasis on most surfaces). Type
 * narrowing below enforces the same constraint at the type level.
 */

type FillVariant = 'fill' | 'outline' | 'transparent';

type CommonProps = {
  text: string;
  /** Optional 24pt icon rendered to the left of the label with 8pt gap. */
  icon?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /**
   * When true, renders an ActivityIndicator in place of the
   * icon+label. Implies `disabled`. Not a Figma variant — added as a
   * code-only convenience for async CTAs (e.g. /trusted-contact-setup's
   * Pick a contact button while the iOS picker spins up).
   */
  loading?: boolean;
  accessibilityLabel?: string;
  /** Container style override — most useful for `alignSelf: 'stretch'` in flex layouts. */
  style?: ViewStyle;
};

type ButtonProps = CommonProps &
  (
    | { type?: 'primary'; fill?: FillVariant }
    | { type: 'secondary'; fill?: 'fill' | 'outline' }
  );

export function Button({
  text,
  icon,
  onPress,
  disabled,
  loading,
  accessibilityLabel,
  style,
  type = 'primary',
  fill = 'fill',
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const containerStyle = [
    styles.base,
    fill === 'fill' && (type === 'primary' ? styles.primaryFill : styles.secondaryFill),
    fill === 'outline' && (type === 'primary' ? styles.primaryOutline : styles.secondaryOutline),
    // Transparent has no fill/border — just renders the text. Type
    // narrowing above ensures only Primary reaches here.
  ];

  // Transparent renders white text per Figma — designed for use on
  // dark/colored backgrounds (onboarding, /trusted-contact-setup),
  // never on white. On a white page the text would be invisible;
  // that constraint is documented but not type-enforced.
  const textColor =
    fill === 'fill' || fill === 'transparent'
      ? colors.white
      : type === 'primary'
        ? colors.freshgreen
        : colors.wiltedgreen;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? text}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        containerStyle,
        style,
        (pressed || isDisabled) && pressedDim,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text
            style={[
              styles.label,
              { color: textColor },
              // Transparent variant has no bg or border — without a
              // container, the text needs an affordance to read as
              // tappable. Underline is the canonical link signal.
              // Fill and Outline have visible containers that carry
              // that affordance themselves, so they stay un-underlined.
              fill === 'transparent' && styles.labelUnderlined,
            ]}
            numberOfLines={1}
          >
            {text}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 44,
    borderRadius: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    // bodyEmphasized (17pt) per the 2026-06-01 text-size audit. App-
    // wide CTA label — every primary action across the app inherits
    // this register. 15pt sat a tier below iOS's first-party CTA
    // norm; 17pt matches Settings.app's primary-action buttons and
    // anchors the label visually inside the 44pt pill. Height stays
    // 44pt (HIG floor); Apple's compact-button pattern is 44 × 17pt
    // so this is on-precedent.
    ...typography.bodyEmphasized,
  },
  labelUnderlined: {
    textDecorationLine: 'underline',
  },
  // M3/Elevation/1 approximation. Figma specs two drop shadows
  // (0,1,3,1 @ 15% + 0,1,2,0 @ 30%); RN renders only one per view, so
  // we use the bigger soft layer that carries the visible elevation.
  primaryFill: {
    // freshgreen brand fill + wiltedgreen 1pt border. The border is
    // invisible on green-onboarding surfaces (wiltedgreen border on
    // wiltedgreen page bg blends), but on white surfaces it lifts
    // the button-to-page contrast from freshgreen's 2.88:1 (below
    // WCAG AA 3.0:1 for UI components) into the 6.54:1 wiltedgreen
    // range. Lets us keep the primary brand vibrance app-wide
    // without forcing a wiltedgreen swap on every white-surface
    // CTA — see the audit-9 contrast catch + the user-confirmed
    // "(c) freshgreen with wiltedgreen border" decision in
    // docs/learnings.md feat/whimsy-animations entry's followup.
    backgroundColor: colors.freshgreen,
    borderWidth: 1,
    borderColor: colors.wiltedgreen,
    // M3 Elevation/1 — was inlined byte-for-byte (audit #10 token-drift fix).
    ...shadows.e1,
  },
  secondaryFill: {
    backgroundColor: colors.wiltedgreen,
    ...shadows.e1,
  },
  primaryOutline: {
    borderWidth: 1,
    borderColor: colors.freshgreen,
  },
  secondaryOutline: {
    borderWidth: 1,
    borderColor: colors.wiltedgreen,
  },
});
