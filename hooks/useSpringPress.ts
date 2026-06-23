import { useCallback, useMemo, useRef } from 'react';
import { Animated } from 'react-native';

import { useReduceMotion } from './useReduceMotion';
import { springs } from '../theme/motion';

/**
 * Universal press-down feedback spring — scale 0.97 + opacity 0.85 on
 * press-in, springs back to 1.0 / 1.0 on press-out. Uses the `crisp`
 * spring preset (faster settle than `gentle`).
 *
 * Replaces (over time, in Phase 3) the inline `pressedDim` opacity-only
 * pattern. Keep `pressedDim` for now in surfaces that haven't migrated.
 *
 * Reduce-motion aware: when the user has Reduce Motion on, the hook
 * returns static handlers that don't animate (the styled View renders
 * at the rest state always). The press still works; just doesn't move.
 *
 * Usage:
 *   const press = useSpringPress();
 *   <Animated.View style={press.style}>
 *     <Pressable onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
 *       ...
 *     </Pressable>
 *   </Animated.View>
 *
 * Or for Pressable-as-root:
 *   <Pressable onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
 *     <Animated.View style={press.style}>...</Animated.View>
 *   </Pressable>
 */
export function useSpringPress() {
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      ...springs.crisp,
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
    Animated.spring(opacity, {
      ...springs.crisp,
      toValue: 0.85,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, scale, opacity]);

  const onPressOut = useCallback(() => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      ...springs.crisp,
      toValue: 1,
      useNativeDriver: true,
    }).start();
    Animated.spring(opacity, {
      ...springs.crisp,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, scale, opacity]);

  const style = useMemo(
    () => ({
      transform: [{ scale }],
      opacity,
    }),
    [scale, opacity],
  );

  return { onPressIn, onPressOut, style };
}
