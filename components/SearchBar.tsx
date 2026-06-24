import { Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';

import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { MagnifyingGlass } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { Microphone } from 'phosphor-react-native/src/icons/Microphone';
import { XCircle } from 'phosphor-react-native/src/icons/XCircle';

import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { dynamicType } from '../theme/dynamic-type';
import { typography } from '../theme/typography';

/**
 * SearchBar — three states matching Figma `1133:13168`.
 *
 *   - `default`  white pill with M3/Elevation/2 shadow. Floating over
 *                map/imagery. Left: search icon. Right: mic icon.
 *                Placeholder text only — taps route to the Search screen.
 *   - `on-tap`   gray translucent pill, no shadow. The pre-typing state
 *                on /search after the user has tapped in. Left: back
 *                chevron (returns to map). Right: mic icon.
 *   - `typing`   gray translucent pill, no shadow. The active-typing
 *                state. Left: back chevron (always visible while the
 *                user is on /search — per S1 polish, lets users abandon
 *                a query without using OS-level back gestures).
 *                Center: live `value` in primary text color. Right:
 *                clear (X) icon.
 *
 * `default` is a Pressable; `on-tap` and `typing` use TextInput so the
 * keyboard is owned by the search screen, not the floating pill.
 */

type Props = {
  state?: 'default' | 'on-tap' | 'typing';
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  /** Fires when the user presses the keyboard's return/search key. */
  onSubmit?: () => void;
  onPress?: () => void;
  onBackPress?: () => void;
  onClearPress?: () => void;
  onMicPress?: () => void;
  autoFocus?: boolean;
  style?: ViewStyle;
};

export function SearchBar({
  state = 'default',
  placeholder = 'Where are you headed?',
  value,
  onChangeText,
  onSubmit,
  onPress,
  onBackPress,
  onClearPress,
  onMicPress,
  autoFocus,
  style,
}: Props) {
  if (state === 'default') {
    return (
      <Pressable
        style={({ pressed }) => [styles.container, styles.containerDefault, style, pressed && pressedDim]}
        onPress={onPress}
        accessibilityRole="search"
        accessibilityLabel={placeholder}
      >
        <MagnifyingGlass size={24} color={colors.labelSecondary} weight="regular" />
        <Text style={styles.placeholder} numberOfLines={1}>
          {placeholder}
        </Text>
        <PressableIcon
          name="mic"
          onPress={onMicPress}
          accessibilityLabel="Voice search"
        />
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, styles.containerInset, style]}>
      <PressableIcon
        // S1: always show chevron-back on left when SearchBar is on
        // /search (both 'on-tap' and 'typing' states). Earlier swap to
        // the 'search' icon during 'typing' left users without a visible
        // back affordance — Google Maps/Apple Maps keep back-arrow
        // visible for the entire search session. Search icon during
        // typing added nothing since the keyboard + pill chrome already
        // signal "you're searching."
        name="chevron-back"
        onPress={onBackPress}
        accessibilityLabel="Back to map"
      />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedSecondary}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        autoFocus={autoFocus}
        returnKeyType="search"
        // Off: kills the green predictive-text/autocorrect underline iOS
        // draws under in-progress words (it tints to the app's accent),
        // and place names shouldn't be autocorrected anyway.
        autoCorrect={false}
        spellCheck={false}
        accessibilityLabel={placeholder}
      />
      {state === 'typing' ? (
        <PressableIcon
          name="close-circle"
          onPress={onClearPress}
          accessibilityLabel="Clear search"
        />
      ) : (
        <PressableIcon
          name="mic"
          onPress={onMicPress}
          accessibilityLabel="Voice search"
        />
      )}
    </View>
  );
}

function PressableIcon({
  name,
  onPress,
  accessibilityLabel,
}: {
  name: 'search' | 'mic' | 'chevron-back' | 'close-circle';
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const size = name === 'mic' ? 20 : 24;
  const icon = renderPhosphorIcon(name, size);
  if (!onPress) {
    return <View style={styles.iconWrap}>{icon}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.iconWrap, pressed && pressedDim]}
    >
      {icon}
    </Pressable>
  );
}

/** Maps the SearchBar's legacy icon-name strings to Phosphor components. */
function renderPhosphorIcon(
  name: 'search' | 'mic' | 'chevron-back' | 'close-circle',
  size: number,
) {
  const color = colors.labelSecondary;
  switch (name) {
    case 'search':
      return <MagnifyingGlass size={size} color={color} weight="regular" />;
    case 'mic':
      return <Microphone size={size} color={color} weight="regular" />;
    case 'chevron-back':
      return <CaretLeft size={size} color={color} weight="regular" />;
    case 'close-circle':
      return <XCircle size={size} color={color} weight="regular" />;
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    // Responsive sizing: stretch to parent width with 8pt margins on
    // each side. Figma specs w-374 (Default) or w-358 (on-tap/typing)
    // on a 390pt baseline — both translate to "8pt or 16pt inset from
    // the screen edges." alignSelf + marginHorizontal preserves the
    // intent across device widths.
    alignSelf: 'stretch',
    marginHorizontal: spacing.sm,
  },
  containerDefault: {
    backgroundColor: colors.white,
    // A22: was inline (shadowRadius:6, elevation:4) — identical to the
    // FAB pattern that landed alongside this fix. Replaced with the
    // canonical shadows.e2 spread per DESIGN.md §4.
    // SearchBar over the map matches FAB elevation now; previously they
    // diverged by ~2pt of soft halo.
    ...shadows.e2,
  },
  containerInset: {
    // S3: canonical inset bg per .cursorrules "Search bar contextual
    // treatment" rule — fillsTertiary, not separatorOnFlat. The latter
    // is named/intended for hairline separator lines (see colors.ts:
    // "search bar outline on tap-state"), not surface fills. Using it
    // as a background coupled the search bar's tint to a token whose
    // future tweaks would silently affect this surface.
    backgroundColor: colors.fillsTertiary,
  },
  placeholder: {
    ...dynamicType(typography.bodyRegular),
    flex: 1,
    color: colors.mutedSecondary,
  },
  input: {
    ...dynamicType(typography.bodyRegular),
    flex: 1,
    color: colors.black,
    paddingVertical: 0,
  },
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
