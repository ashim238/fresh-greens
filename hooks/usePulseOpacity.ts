import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

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
 * Consumers:
 *   - TrustedContactStatus dot (default 0.3)
 *   - PulledOver / RecordingChip dot (default 0.3)
 *   - PulledOver / Contact avatar outer ring (0.55)
 *
 * If you reach for an `Animated.loop` to add another pulse to the
 * safety flow, use this hook instead — keeps all surfaces breathing
 * on the same beat without each component re-deriving the timing.
 */
export function usePulseOpacity(minOpacity: number = 0.3): Animated.Value {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
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
  }, [pulse, minOpacity]);

  return pulse;
}
