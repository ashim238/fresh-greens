import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';

type HoldHandlers = {
  onPressIn: () => void;
  onPressOut: () => void;
  onPress?: () => void; // VoiceOver bypass path
};

/**
 * Press-and-hold confirmation for safety-critical actions on driving
 * surfaces (e.g. en-route SOS). Returns an Animated.Value that ramps
 * 0→1 over `thresholdMs` while held, and handlers to spread onto a
 * Pressable. On release before threshold: silent cancel (the user just
 * learned the gesture; a "denied" buzz reads as alarming). At threshold:
 * success haptic + onConfirm.
 *
 * VoiceOver bypass: when AccessibilityInfo.isScreenReaderEnabled is true,
 * the Pressable's `onPress` fires onConfirm immediately on tap. Hold-
 * timing is fiddly with screen readers, and VoiceOver users are
 * intentional by definition (a screen reader user does not accidentally
 * double-tap the SOS button).
 *
 * Per .cursorrules ## Safety-critical interactions.
 */
export function useHoldToConfirm({
  thresholdMs = 800,
  onConfirm,
}: {
  thresholdMs?: number;
  onConfirm: () => void;
}): { holdProgress: Animated.Value; pressHandlers: HoldHandlers; isVoiceOverOn: boolean } {
  const holdProgress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hapticTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const voiceOverRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (!cancelled) voiceOverRef.current = on;
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (on) => {
      voiceOverRef.current = on;
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    for (const t of hapticTimersRef.current) clearTimeout(t);
    hapticTimersRef.current = [];
    holdProgress.stopAnimation();
    Animated.timing(holdProgress, {
      toValue: 0,
      duration: 120,
      useNativeDriver: false,
    }).start();
  }, [holdProgress]);

  const onPressIn = useCallback(() => {
    if (voiceOverRef.current) return; // VoiceOver bypass uses onPress
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: thresholdMs,
      useNativeDriver: false,
    }).start();
    // Light haptic ramp at 200 / 400 / 600 ms — confirming buildup, not alarm.
    hapticTimersRef.current = [200, 400, 600].map((delay) =>
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, delay),
    );
    timerRef.current = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      onConfirm();
      timerRef.current = null;
    }, thresholdMs);
  }, [holdProgress, thresholdMs, onConfirm]);

  const onPressOut = useCallback(() => {
    if (voiceOverRef.current) return;
    cleanup();
  }, [cleanup]);

  const onPress = useCallback(() => {
    if (!voiceOverRef.current) return;
    onConfirm();
  }, [onConfirm]);

  useEffect(() => cleanup, [cleanup]);

  return {
    holdProgress,
    pressHandlers: { onPressIn, onPressOut, onPress },
    isVoiceOverOn: voiceOverRef.current,
  };
}
