import { Easing, LayoutAnimation, Platform, UIManager } from 'react-native';

// Android needs this once before any LayoutAnimation call.
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Motion tokens — the project's one source of truth for animation
 * durations and easing curves. Keeps the calm-companion voice
 * consistent across surfaces: no bounce, no elastic, no theatrical
 * choreography. iOS-native deceleration curves (ease-out cubic /
 * quart) carry every transition.
 *
 * The 100/300/500 rule, project-adapted:
 *   - **instant** (120ms) — press-feedback, color flips. Reads as
 *     "the system acknowledged" without becoming a tiny show.
 *   - **quick**   (220ms) — state changes (skeleton→content, detail
 *     card slide-up). The workhorse; matches the existing 220ms
 *     LaneStrip tween + 240ms ETA reveal already in the codebase.
 *   - **calm**    (320ms) — larger entrances (full sheet morph-in,
 *     entrance reveals). Matches the existing 320ms TrustedByCommunity
 *     first-card fade.
 *
 * Anything longer is theatrical for an app the user is in a task in;
 * anything shorter feels like a glitch.
 *
 * Reduce Motion: never read these timings directly when motion is
 * disabled — use the existing `useReduceMotion()` hook to branch.
 * `instant` and `quick` still feel right because they're already at
 * the floor of human perception.
 *
 * The easing curves below avoid the bounce / elastic family per
 * the design rule "no bounce, no elastic." `Easing.out(Easing.cubic)`
 * is the iOS-native deceleration shape; the `quart` variant is one
 * notch snappier for press-feedback moments.
 */

export const motion = {
  duration: {
    /** 120ms — press feedback, color flips, value bumps. */
    instant: 120,
    /** 220ms — state changes, skeleton→content, detail-card entry. */
    quick: 220,
    /** 320ms — entrance reveals, larger morphs. */
    calm: 320,
  },
  easing: {
    /** iOS-native deceleration. The default. */
    out: Easing.out(Easing.cubic),
    /** Slightly snappier — press releases, micro-feedback. */
    outQuart: Easing.out(Easing.quad),
  },
} as const;

/**
 * Damped spring for layout snaps (sheet expand/collapse, row collapse,
 * category reveal). High springDamping keeps the settle physical
 * without the bounce/elastic family the calm-companion voice bans.
 * Call only when `useReduceMotion()` is false.
 */
export function configureLayoutSpring() {
  LayoutAnimation.configureNext({
    duration: motion.duration.calm,
    update: {
      type: LayoutAnimation.Types.spring,
      springDamping: 0.86,
    },
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  });
}
