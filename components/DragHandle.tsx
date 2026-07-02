import { StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';
import { radii } from '../theme/radii';

export function DragHandle() {
  return (
    <View
      style={styles.handle}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  handle: {
    width: 32,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.dragHandleBar,
    alignSelf: 'center',
  },
});
