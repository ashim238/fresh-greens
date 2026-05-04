import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Footer used across the safety/pulled-over flow — the small reassurance
 * line "Your trusted contact is being notified" with a green pulsing dot
 * indicating active notification status.
 *
 * The pulse is a subtle heartbeat (opacity 1 → 0.3 → 1, ~1.6s loop). It
 * communicates "this is live and ongoing" without being distracting in
 * the high-stakes moments these screens are designed for.
 *
 * TODO: real backend wiring — once auth + a contact picker exist, this
 * component will accept props for whether a trusted contact is configured
 * and whether the notification actually fired. For now it's decorative
 * but architecturally consistent with where it'll plug in.
 */
export function TrustedContactStatus() {
  // Animated.Value persists across re-renders via useRef. Starting at 1
  // (fully visible) so the first frame doesn't flash.
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animated.loop runs an animation forever. Sequence chains two
    // tweens: fade down to 0.3, then back up to 1. Easing.inOut.ease
    // gives a soft "breathe" curve instead of a harsh on/off.
    //
    // useNativeDriver: true offloads the animation to the native UI
    // thread — the JS thread can be busy and the pulse keeps running
    // smoothly. Required for opacity, transform, and a few other props.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    // Stop the loop when the component unmounts so it doesn't leak.
    return () => loop.stop();
  }, [pulse]);

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
    color: 'rgba(80, 80, 80, 0.7)',
    textAlign: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.freshgreen,
  },
});
