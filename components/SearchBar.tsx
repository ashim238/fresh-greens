import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
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
 *                state. Left: search icon. Center: live `value` in
 *                primary text color. Right: clear (X) icon.
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
        name={state === 'on-tap' ? 'chevron-back' : 'search'}
        onPress={state === 'on-tap' ? onBackPress : undefined}
        accessibilityLabel={state === 'on-tap' ? 'Back to map' : undefined}
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
      hitSlop={8}
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
    // M3/Elevation/2 approximation — picking the larger soft halo
    // (the second layer would be a tiny sharp contact shadow; RN can
    // only render one).
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  containerInset: {
    backgroundColor: colors.separatorOnFlat,
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
