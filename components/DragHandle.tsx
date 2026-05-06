import { StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';

export function DragHandle() {
  return <View style={styles.handle} />;
}

const styles = StyleSheet.create({
  handle: {
    width: 32,
    height: 4,
    borderRadius: 100,
    backgroundColor: colors.dragHandleBar,
    alignSelf: 'center',
  },
});
