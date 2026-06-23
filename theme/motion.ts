import { Easing } from 'react-native';

// Fresh Greens — motion tokens. Spring presets, duration scale, easing
// curves. Extracted in the Visual Maturity Program from inline animation
// values scattered across LandmarkMarker (tension 180, friction 12),
// trusted-contact-setup avatar spring (tension 180, friction 12), etc.
//
// "Warm + knowing" register: spring physics with mild overshoot, never
// bouncy. All durations ≤ 400ms — the program constraint.
//
// Usage:
//   import { springs, durations, easings } from '../theme/motion';
//   Animated.spring(value, { ...springs.gentle, toValue: 1, useNativeDriver: true });
//   Animated.timing(value, { duration: durations.standard, easing: easings.easeOut, useNativeDriver: true });

/**
 * Spring presets — `useNativeDriver: true`-compatible. Apply via spread:
 *   Animated.spring(v, { ...springs.gentle, toValue: 1, useNativeDriver: true })
 *
 * Calibration: recalibrated from inline friction 12 to friction ≥ 14
 * across the board to suppress bounce. The mild overshoot lands as
 * "alive" instead of "Waze-cartoony" — the program's brand-voice line.
 */
export const springs = {
  /** Default for content arrival, sheet rise, marker settle. Mild overshoot. */
  gentle: { tension: 180, friction: 14 },
  /** Press-down/release. Tighter spring, faster settle — feels responsive. */
  crisp: { tension: 240, friction: 16 },
  /** Final-state arrival (e.g. an icon snapping into place after a state change). */
  settle: { tension: 160, friction: 18 },
} as const;

/**
 * Duration scale — ceiling 400ms per program constraint. Use for
 * `Animated.timing` calls and non-spring motion. Numbers, not strings,
 * because RN's Animated API wants them numeric.
 */
export const durations = {
  /** Press-state opacity, micro-flicks. */
  instant: 100,
  /** Crossfades, state toggles. */
  quick: 200,
  /** Sheet transitions, list mounts. */
  standard: 300,
  /** Hero moments (route line draw, marker cascade). Program ceiling. */
  relaxed: 400,
} as const;

/**
 * Easing curves for non-spring motion. iOS-canonical: most exits use
 * `easeOut`, most A↔B transitions use `easeInOut`. Spring physics
 * cover the rest — reach for these only when a spring would feel
 * wrong (e.g. opacity-only fades).
 *
 * Each value is a real `(t: number) => number` function, pass-through-
 * able to `Animated.timing({ easing: easings.easeOut, ... })`.
 */
export const easings = {
  /** Exits, dismissals, things leaving the screen. */
  easeOut: Easing.out(Easing.cubic),
  /** Reversible transitions, A↔B state. */
  easeInOut: Easing.inOut(Easing.cubic),
} as const;

export type SpringPreset = keyof typeof springs;
export type DurationToken = keyof typeof durations;
