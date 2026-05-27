import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';

// Phosphor deep-imports — same pattern as the rest of the codebase.
// `ArrowUTurnLeft` doesn't exist in our pinned phosphor-react-native
// release; `ArrowUUpLeft` is the closest visual equivalent (a U-shape
// going up and bending left — reads as "u-turn" at small sizes).
import { ArrowBendUpLeft } from 'phosphor-react-native/src/icons/ArrowBendUpLeft';
import { ArrowBendUpRight } from 'phosphor-react-native/src/icons/ArrowBendUpRight';
import { ArrowElbowLeft } from 'phosphor-react-native/src/icons/ArrowElbowLeft';
import { ArrowElbowRight } from 'phosphor-react-native/src/icons/ArrowElbowRight';
import { ArrowUp } from 'phosphor-react-native/src/icons/ArrowUp';
import { ArrowUpLeft } from 'phosphor-react-native/src/icons/ArrowUpLeft';
import { ArrowUpRight } from 'phosphor-react-native/src/icons/ArrowUpRight';
import { ArrowUUpLeft } from 'phosphor-react-native/src/icons/ArrowUUpLeft';

import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors } from '../theme/colors';
import type { Lane, LaneDirection } from '../lib/api/routes';

/**
 * Lane guidance strip — Apple Maps-style row of lane cells shown at
 * the top of the en-route turn card when approaching a multi-lane
 * maneuver. Highlights which lanes the driver should occupy.
 *
 * Visibility is controlled by the `visible` prop — the component is
 * always mounted, fades + grows in/out via an Animated.Value tween.
 * `useReduceMotion()` gates the tween; reduce-motion users get an
 * instant present/absent toggle via setValue.
 *
 * Spec: docs/superpowers/specs/2026-05-27-lane-guidance-design.md
 */
export function LaneStrip({
  lanes,
  visible,
  style,
}: {
  lanes: Lane[];
  visible: boolean;
  style?: ViewStyle;
}) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(visible ? 1 : 0);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      // maxHeight animates; layout properties can't use native driver
      useNativeDriver: false,
    });
    anim.start();
    // Stop the tween on cleanup so a reduce-motion mid-flight flip or
    // an unmount during animation doesn't leak the timer or overwrite
    // a subsequent setValue. Same pattern as UserLocationMarker's
    // pulse loop cleanup.
    return () => anim.stop();
  }, [visible, reduceMotion, progress]);

  // VoiceOver announcement when the strip appears mid-trip. Without
  // this the label is only read when the user focuses the strip
  // manually — drivers approaching a maneuver should HEAR the
  // lane decision as soon as it becomes relevant. Mirrors the
  // pattern /en-route uses for route-loaded announcements (line ~598
  // there). Only fires on the false→true transition.
  const wasVisibleRef = useRef(false);
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      AccessibilityInfo.announceForAccessibility(buildLaneLabel(lanes));
    }
    wasVisibleRef.current = visible;
  }, [visible, lanes]);

  const maxHeight = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 56],
  });

  return (
    <Animated.View
      style={[styles.strip, { maxHeight, opacity: progress }, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={buildLaneLabel(lanes)}
      // Suppress the element from VoiceOver entirely when collapsed.
      // accessible+label alone leaves zero-height nodes platform-
      // inconsistent (Android sometimes still announces). Matches
      // the pattern in HomeBrowseSheet / home.tsx daylight strip.
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <View style={styles.cells}>
        {lanes.map((lane, idx) => (
          <LaneCell key={idx} lane={lane} />
        ))}
      </View>
    </Animated.View>
  );
}

function LaneCell({ lane }: { lane: Lane }) {
  return (
    <View style={[styles.cell, lane.active && styles.cellActive]}>
      <View style={styles.glyphRow}>
        {lane.directions.map((dir) => {
          const Icon = iconForDirection(dir);
          const isActiveDir = lane.active && lane.activeDirection === dir;
          const isMultiDir = lane.directions.length > 1;
          // Active + matching activeDirection → full opacity
          // Active + non-matching direction in multi-dir lane → 0.5
          // Inactive → 0.3
          const opacity = lane.active
            ? isActiveDir || !isMultiDir || !lane.activeDirection
              ? 1.0
              : 0.5
            : 0.3;
          return (
            <Icon
              key={dir}
              size={isMultiDir ? 16 : 24}
              color={colors.white}
              weight="bold"
              style={{ opacity }}
            />
          );
        })}
      </View>
    </View>
  );
}

function iconForDirection(d: LaneDirection) {
  switch (d) {
    case 'straight': return ArrowUp;
    case 'slight-left': return ArrowUpLeft;
    case 'left': return ArrowBendUpLeft;
    case 'sharp-left': return ArrowElbowLeft;
    case 'slight-right': return ArrowUpRight;
    case 'right': return ArrowBendUpRight;
    case 'sharp-right': return ArrowElbowRight;
    default:
      // Exhaustiveness backstop. TypeScript catches missing union
      // members at compile time, but if mapMapboxDirection ever
      // surfaces an unmapped string from Mapbox at runtime (despite
      // the snake_case + KNOWN_LANE_DIRECTIONS allow-list), fall
      // back to straight rather than rendering <undefined />.
      return ArrowUp;
    case 'uturn': return ArrowUUpLeft;
  }
}

/**
 * VoiceOver label for the strip as a whole. Counts active lanes from
 * each side, picks the smaller cluster, and frames as "Use {position}
 * lanes" so the driver hears a single coherent instruction rather
 * than per-cell announcements.
 */
function buildLaneLabel(lanes: Lane[]): string {
  if (lanes.length === 0) return 'Lane guidance';
  const activeIndices = lanes
    .map((l, i) => (l.active ? i : -1))
    .filter((i) => i >= 0);
  const total = lanes.length;

  if (activeIndices.length === 0) return 'Lane guidance';
  if (activeIndices.length === total) return 'All lanes go this way';

  const firstActive = activeIndices[0];
  const lastActive = activeIndices[activeIndices.length - 1];
  const isContiguous = lastActive - firstActive === activeIndices.length - 1;

  if (!isContiguous) {
    return `Use lanes ${activeIndices.map((i) => i + 1).join(', ')} from the left`;
  }

  const count = activeIndices.length;
  const fromLeft = firstActive;
  const fromRight = total - 1 - lastActive;

  if (count === 1) {
    // For middle lanes, append "from the left" so the VoiceOver
    // listener has an anchor — "Use the 2nd lane" alone is
    // ambiguous without a visual reference. Matches the
    // disambiguation in the non-contiguous branch above.
    if (firstActive === 0) return 'Use the leftmost lane';
    if (firstActive === total - 1) return 'Use the rightmost lane';
    return `Use the ${firstActive + 1}${nthSuffix(firstActive + 1)} lane from the left`;
  }

  if (fromLeft === 0) return `Use leftmost ${count} lanes`;
  if (fromRight === 0) return `Use rightmost ${count} lanes`;
  return `Use middle ${count} lanes`;
}

function nthSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

const styles = StyleSheet.create({
  strip: {
    overflow: 'hidden',
  },
  cells: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  cell: {
    flex: 1,
    minWidth: 32,
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  cellActive: {
    backgroundColor: colors.whiteFill12,
  },
  glyphRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
