import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';

import { useReduceMotion } from '../hooks/useReduceMotion';
import { motion } from '../theme/motion';

// How far (in points) old text slides up / new text slides in from.
const SLIDE_DISTANCE = 12;

export type AnimatedNumberProps = {
  /** The formatted display string, e.g. "16", "6.0", "69°". */
  value: string;
  /**
   * Text style from the parent — sets font, size, color, lineHeight.
   * Must be wrapped in `dynamicType()` by the caller (see `theme/dynamic-type.ts`).
   * The component does not apply it internally so the caller controls the token.
   */
  style?: TextStyle;
  /** Optional suffix rendered without animation, e.g. " min", " mi". */
  suffix?: string;
};

/**
 * Drop-in replacement for a static <Text> when displaying a number that
 * changes at runtime (ETA, distance, temperature). When `value` changes
 * the old string slides up and fades out while the new string slides in
 * from below — both in parallel at 120ms ease-out.
 *
 * Respects `useReduceMotion()`: when the user has opted out of motion,
 * the value swaps instantly with no animation.
 *
 * The container is `overflow: 'hidden'` and fixes its height to
 * `style.lineHeight` (falling back to `style.fontSize * 1.3` or 20pt) to
 * prevent parent layout shift during the crossfade.
 *
 * Usage:
 *   <AnimatedNumber value={etaLabel} style={typography.labelBold} suffix=" min" />
 */
export function AnimatedNumber({ value, style, suffix }: AnimatedNumberProps) {
  const reduceMotion = useReduceMotion();

  // ── Reduced-motion fast path ─────────────────────────────────────────
  if (reduceMotion) {
    return (
      <Text style={style}>
        {value}
        {suffix ?? ''}
      </Text>
    );
  }

  return <AnimatedNumberInner value={value} style={style} suffix={suffix} />;
}

// ── Inner component (animated) ──────────────────────────────────────────
// Split out so hooks are always called in the same render path (no early
// return before hooks when reduceMotion is false).

function AnimatedNumberInner({ value, style, suffix }: AnimatedNumberProps) {
  const prevValueRef = useRef<string>(value);
  const isFirstRender = useRef(true);

  // Outgoing (old) text animation values.
  const outOpacity = useRef(new Animated.Value(0)).current;
  const outTranslateY = useRef(new Animated.Value(0)).current;

  // Incoming (new) text animation values — start invisible below.
  const inOpacity = useRef(new Animated.Value(1)).current;
  const inTranslateY = useRef(new Animated.Value(0)).current;

  // Track the display strings for each layer.
  const displayedOutRef = useRef<string>(value);
  const displayedInRef = useRef<string>(value);

  // Force re-render to pick up ref changes during animation setup.
  const [, forceUpdate] = React.useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const prev = prevValueRef.current;
    if (prev === value) return;

    // Snapshot the outgoing string into the overlay layer.
    displayedOutRef.current = prev;
    displayedInRef.current = value;
    prevValueRef.current = value;

    // Reset to start positions: outgoing visible at rest, incoming below.
    outOpacity.setValue(1);
    outTranslateY.setValue(0);
    inOpacity.setValue(0);
    inTranslateY.setValue(SLIDE_DISTANCE);

    // Trigger a render so the overlay picks up the new `displayedOutRef`.
    forceUpdate();

    // Run both animations in parallel.
    Animated.parallel([
      // Old value: slide up and fade out.
      Animated.timing(outOpacity, {
        toValue: 0,
        duration: motion.duration.instant,
        easing: motion.easing.out,
        useNativeDriver: true,
      }),
      Animated.timing(outTranslateY, {
        toValue: -SLIDE_DISTANCE,
        duration: motion.duration.instant,
        easing: motion.easing.out,
        useNativeDriver: true,
      }),
      // New value: slide in from below.
      Animated.timing(inOpacity, {
        toValue: 1,
        duration: motion.duration.instant,
        easing: motion.easing.out,
        useNativeDriver: true,
      }),
      Animated.timing(inTranslateY, {
        toValue: 0,
        duration: motion.duration.instant,
        easing: motion.easing.out,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Derive a stable height so the parent doesn't shift during the slide.
  const lineHeight =
    style?.lineHeight ??
    (style?.fontSize ? style.fontSize * 1.3 : 20);

  return (
    <View style={[styles.container, { height: lineHeight }]}>
      {/* Outgoing text — slides up and fades out on change. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            opacity: outOpacity,
            transform: [{ translateY: outTranslateY }],
          },
        ]}
        pointerEvents="none"
      >
        <Text style={style} numberOfLines={1}>
          {displayedOutRef.current}
          {suffix ?? ''}
        </Text>
      </Animated.View>

      {/* Incoming text — slides in from below. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            opacity: inOpacity,
            transform: [{ translateY: inTranslateY }],
          },
        ]}
      >
        <Text style={style} numberOfLines={1}>
          {displayedInRef.current}
          {suffix ?? ''}
        </Text>
      </Animated.View>

      {/* Invisible spacer: reserves width for the longest of old/new value
          so the container doesn't collapse when both layers are absolute. */}
      <Text
        style={[style, styles.spacer]}
        numberOfLines={1}
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {value.length >= (prevValueRef.current?.length ?? 0)
          ? value
          : prevValueRef.current}
        {suffix ?? ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  spacer: {
    opacity: 0,
  },
});
