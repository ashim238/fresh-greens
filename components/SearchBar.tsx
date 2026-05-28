import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { shadows } from '../theme/shadows';
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
        <Ionicons name="search" size={24} color={colors.labelSecondary} />
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
  const icon = <Ionicons name={name} size={size} color={colors.labelSecondary} />;
  if (!onPress) {
    return <View style={styles.iconWrap}>{icon}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
      style={({ pressed }) => [styles.iconWrap, pressed && pressedDim]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 1000,
    // Responsive sizing: stretch to parent width with 8pt margins on
    // each side. Figma specs w-374 (Default) or w-358 (on-tap/typing)
    // on a 390pt baseline — both translate to "8pt or 16pt inset from
    // the screen edges." alignSelf + marginHorizontal preserves the
    // intent across device widths.
    alignSelf: 'stretch',
    marginHorizontal: 8,
  },
  containerDefault: {
    backgroundColor: colors.white,
    // A22: was inline (shadowRadius:6, elevation:4) — identical to the
    // FAB pattern that landed alongside this fix. Replaced with the
    // canonical shadows.e2 spread per design-system.md §1.3 drift note.
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
    ...typography.bodyRegular,
    flex: 1,
    color: colors.mutedSecondary,
  },
  input: {
    ...typography.bodyRegular,
    flex: 1,
    color: colors.black,
    paddingVertical: 0,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
