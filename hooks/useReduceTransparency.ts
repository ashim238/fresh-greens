import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Reactive wrapper around iOS's "Reduce Transparency" accessibility
 * setting (Settings → Accessibility → Display & Text Size → Reduce
 * Transparency). Returns `true` when the user has opted out of
 * translucent / blurred surfaces.
 *
 * Mirrors `useReduceMotion` exactly — same read-once-then-subscribe
 * pattern, same default-false bootstrap. Used by `MaterialSurface` to
 * collapse `BlurView` to a solid fallback when the user prefers
 * opaque surfaces.
 *
 * Android doesn't expose this setting; the call resolves to `false`
 * there, which matches our iOS-first posture (Android renders a solid
 * surface via the same fallback path because the BlurView still
 * collapses, just via the platform-default rather than user choice).
 */
export function useReduceTransparency(): boolean {
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (!cancelled) setReduceTransparency(enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return reduceTransparency;
}
