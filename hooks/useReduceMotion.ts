import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Reactive wrapper around iOS/Android's "Reduce Motion" accessibility
 * setting. Returns `true` if the user has opted out of non-essential
 * animations (iOS: Settings → Accessibility → Motion; Android:
 * Settings → Accessibility → Remove animations).
 *
 * WCAG 2.3.3 Animation from Interactions (Level AAA, recommended for
 * vestibular-disorder accessibility): "Motion animation triggered by
 * interaction can be disabled." Apple HIG explicitly calls out
 * respecting this setting for any non-essential animation. The
 * navigation context here makes it more important than usual —
 * Reduce Motion users include people with vestibular triggers, and
 * a moving map already taxes that vestibular system.
 *
 * Read once on mount + subscribe to the change event so the value
 * updates live if the user flips the toggle while the app is open
 * (background → settings → foreground flow).
 *
 * Usage:
 *   const reduceMotion = useReduceMotion();
 *   if (!reduceMotion) LayoutAnimation.configureNext(SPRING);
 *   // ...or pass through to a component that conditionally animates
 *
 * The default is `false` (animations on) until the platform reports
 * back — matches the unaccessed-API default and keeps animations on
 * for the millisecond before the read resolves.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

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

  return reduceMotion;
}
