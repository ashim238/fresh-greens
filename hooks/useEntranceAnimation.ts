import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

import { motion } from '../theme/motion';
import { useReduceMotion } from './useReduceMotion';

/**
 * Mount-time entrance tween — opacity 0→1 paired with an optional
 * translateY slide. Used by the detail-card family (ReportDetailCard,
 * RouteHazardDetailCard, ZoneDetailCard) so tapping a map marker
 * morphs the card up from the bottom edge instead of snapping it
 * into place. Calm-companion physics: 220ms ease-out, no bounce.
 *
 * Returns the animated `opacity` and `translateY` values + a small
 * `style` shortcut. Wrap your top-level View in `Animated.View` and
 * spread `entrance.style`:
 *
 *   const entrance = useEntranceAnimation();
 *   return <Animated.View style={[styles.sheet, entrance.style]}>...</Animated.View>;
 *
 * Reduce Motion: short-circuits both tweens to their resolved values
 * (1 / 0) on the first commit. The element still renders; only the
 * motion is suppressed. Matches the rest of the project's a11y
 * discipline (LaneStrip, usePulseOpacity).
 *
 * `slideFromY` defaults to 16 — the small upward nudge that reads as
 * "this surface arrived from below" without the full bottom-sheet
 * travel. Pass 0 for a pure fade (e.g. state cards).
 */
export function useEntranceAnimation(slideFromY: number = 16) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(slideFromY)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.duration.quick,
        easing: motion.easing.out,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: motion.duration.quick,
        easing: motion.easing.out,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [reduceMotion, opacity, translateY]);

  return {
    opacity,
    translateY,
    style: { opacity, transform: [{ translateY }] },
  };
}
