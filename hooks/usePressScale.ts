import { useRef } from 'react';
import { Animated } from 'react-native';

import { motion } from '../theme/motion';
import { useReduceMotion } from './useReduceMotion';

/**
 * Pressable scale-down feedback — pairs with `pressedDim` (0.7
 * opacity) to give larger touch targets (recommendation cards, FABs)
 * a subtle "press absorbed" squeeze. The opacity alone reads as a
 * dim; the scale adds the physical "yes, this is the thing I
 * touched" cue without becoming a bouncy iOS-toy gesture.
 *
 * Usage with Pressable:
 *
 *   const pressScale = usePressScale();
 *   return (
 *     <Pressable
 *       onPressIn={pressScale.handlePressIn}
 *       onPressOut={pressScale.handlePressOut}
 *       style={({ pressed }) => [styles.card, pressed && pressedDim]}
 *     >
 *       <Animated.View style={[styles.cardInner, pressScale.style]}>
 *         ...
 *       </Animated.View>
 *     </Pressable>
 *   );
 *
 * Calm-companion: 0.98 (not 0.95 — the iOS-app-icon shrink reads as
 * the right depth without becoming theatrical), 120ms press-in, 220ms
 * release. Faster grab, slower let-go matches how a finger actually
 * lifts — same logic the iOS UIControl spring uses.
 *
 * Reduce Motion: short-circuits the scale entirely (stays at 1).
 * The existing `pressedDim` opacity already carries the "press
 * acknowledged" signal for reduce-motion users.
 */
export function usePressScale(targetScale: number = 0.98) {
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    if (reduceMotion) return;
    Animated.timing(scale, {
      toValue: targetScale,
      duration: motion.duration.instant,
      easing: motion.easing.outQuart,
      useNativeDriver: true,
    }).start();
  }
  function handlePressOut() {
    if (reduceMotion) return;
    Animated.timing(scale, {
      toValue: 1,
      duration: motion.duration.quick,
      easing: motion.easing.out,
      useNativeDriver: true,
    }).start();
  }

  return {
    scale,
    handlePressIn,
    handlePressOut,
    style: { transform: [{ scale }] },
  };
}
