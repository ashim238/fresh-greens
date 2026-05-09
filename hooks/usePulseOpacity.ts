import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/**
 * Shared pulse animation — the canonical "live/connected" rhythm used
 * across the safety flow.
 *
 * Same tween everywhere: opacity 1 ↔ minOpacity, 800ms each direction,
 * Easing.inOut(Easing.ease) — soft "breathe" curve, not on/off blink.
 * `useNativeDriver: true` so the loop keeps running smoothly even when
 * the JS thread is busy.
 *
 * `minOpacity` defaults to 0.3 (right for ~8pt dots — the default range
 * reads as a heartbeat at that size). Pass a higher floor (e.g. 0.55)
 * for larger surfaces like the avatar ring, where 0.3 reads as a
 * strobe instead of a pulse. Same rhythm, different depth — the
 * rhythm is what makes the surfaces feel like one system.
 *
 * **Reduce Motion respect:** when iOS Accessibility → Motion → Reduce
 * Motion is enabled, this hook short-circuits the loop and leaves the
 * value pinned at 1 (fully visible, static). The element keeps its
 * "alive" semantic via the visible dot/ring, but doesn't oscillate —
 * matches Apple HIG's guidance for `UIAccessibilityIsReduceMotionEnabled`
 * and WCAG 2.1 SC 2.3.3 (Animation from Interactions). The listener
 * picks up runtime toggles too, so flipping the iOS setting while the
 * app is open stops/starts the pulse on the next render pass.
 *
 * Consumers:
 *   - TrustedContactStatus dot (default 0.3)
 *   - PulledOver / RecordingChip dot (default 0.3)
 *   - PulledOver / Contact avatar outer ring (0.55)
 *
 * If you reach for an `Animated.loop` to add another pulse to the
 * safety flow, use this hook instead — keeps all surfaces breathing
 * on the same beat without each component re-deriving the timing,
 * and inherits the Reduce Motion gate for free.
 */
export function usePulseOpacity(minOpacity: number = 0.3): Animated.Value {
  const pulse = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  // Read the current Reduce Motion state on mount and subscribe to
  // changes. iOS users can toggle the setting from Control Center
  // without leaving the app; the subscription means the next render
  // sees the new value.
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      // Pin opacity to 1 so the surface stays visible; just don't
      // animate. Resetting here covers the "user enabled Reduce
      // Motion mid-pulse" case — without this the value would stick
      // at whatever frame the loop was on when we returned.
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: minOpacity,
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
    return () => loop.stop();
  }, [pulse, minOpacity, reduceMotion]);

  return pulse;
}
