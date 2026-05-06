import { Animated, StyleSheet, Text, View } from 'react-native';

import { usePulseOpacity } from '../hooks/usePulseOpacity';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Footer used across the safety/pulled-over flow — the small reassurance
 * line "Your trusted contact is being notified" with a green pulsing dot
 * indicating active notification status.
 *
 * Pulse rhythm comes from the shared `usePulseOpacity` hook (opacity
 * 1 ↔ 0.3, 800ms each, ease in-out) — same heartbeat the recording
 * chip and the avatar ring use, so the safety flow's "live" surfaces
 * all breathe on one beat.
 *
 * TODO: real backend wiring — once auth + a contact picker exist, this
 * component will accept props for whether a trusted contact is configured
 * and whether the notification actually fired. For now it's decorative
 * but architecturally consistent with where it'll plug in.
 */
export function TrustedContactStatus() {
  const pulse = usePulseOpacity();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Your trusted contact is being notified</Text>
      <Animated.View style={[styles.dot, { opacity: pulse }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  text: {
    ...typography.footnoteRegular,
    color: colors.mutedTertiary,
    textAlign: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.freshgreen,
  },
});
