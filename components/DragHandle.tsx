import { StyleSheet, View } from 'react-native';

export function DragHandle() {
  return <View style={styles.handle} />;
}

const styles = StyleSheet.create({
  handle: {
    width: 32,
    height: 4,
    borderRadius: 100,
    backgroundColor: 'rgba(128, 128, 128, 0.55)',
    alignSelf: 'center',
  },
});
