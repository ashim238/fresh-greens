import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { typography } from '../theme/typography';

type Props = {
  placeholder?: string;
  onPress?: () => void;
};

/**
 * Floating search bar pill — used on map screens and the Search Landing.
 * Per the design system: white + Elevation 3 shadow when floating over
 * map/imagery; gray + no shadow when embedded on flat surfaces. This
 * component is the floating variant — for the embedded variant, swap in
 * a separate component or accept a `variant` prop later.
 *
 * Figma node: 247:743
 */
export function SearchBar({
  placeholder = 'Where are you headed?',
  onPress,
}: Props) {
  return (
    <Pressable
      style={styles.container}
      onPress={onPress}
      accessibilityRole="search"
      accessibilityLabel={placeholder}
    >
      <Ionicons name="search" size={24} color="#3C3C43" />
      <Text style={styles.placeholder} numberOfLines={1}>
        {placeholder}
      </Text>
      <Ionicons name="mic" size={20} color="#3C3C43" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    height: 48,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 1000, // pill
    // Responsive sizing: stretch to parent width with 8pt margins on
    // each side. Figma specs `w-374` on a 390pt iPhone 14 baseline
    // (374 = 390 - 16), which is the "8pt from each edge" intent.
    // Hardcoded 374 fails on wider devices (Pro Max, 16 Pro Max) where
    // it creates a 28pt+ edge margin. alignSelf + marginHorizontal
    // preserves the intent across device widths.
    alignSelf: 'stretch',
    marginHorizontal: 8,
    // Approximates Figma M3 Elevation Light/3. RN can only render one shadow,
    // so we use the bigger of the two layers Figma specifies.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6, // Android equivalent
  },
  placeholder: {
    ...typography.bodyRegular,
    flex: 1,
    color: 'rgba(60, 60, 67, 0.6)', // iOS Labels/Secondary
  },
});
