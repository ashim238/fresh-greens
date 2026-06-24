import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';

/**
 * Custom user-location marker — replaces react-native-maps'
 * `showsUserLocation` because that prop renders the iOS-native
 * MKUserLocation annotation, which can't be assigned a `zIndex`
 * and ends up sitting *under* custom markers when both occupy the
 * same coordinate (the case here when a community report lands
 * near the user's GPS — the LandmarkMarker pin would cover the
 * blue dot).
 *
 * Visual: iOS-style blue dot — outer white ring + inner systemBlue
 * circle, with a subtle pulsing accuracy ring behind it. Anchored
 * at center (the GPS coord sits at the dot's middle), `zIndex={1000}`
 * keeps it above any LandmarkMarker (which uses default zIndex).
 *
 * The component takes the GPS coord as a prop; the parent screen
 * is responsible for subscribing to `expo-location.watchPositionAsync`
 * and feeding fresh coords down. Keeps this component pure +
 * cheap; no useEffect/no permission negotiation here.
 */
export function UserLocationMarker({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  // Pulse on the outer accuracy ring — gentle "this is live" cue
  // without overwhelming the dot. Scale 1 → 1.4, opacity 0.35 → 0,
  // 1.6s loop, native driver. Gated on Reduce Motion: when on, the
  // pulse is pinned to value=1 (end-of-cycle = scale 1.4, opacity 0),
  // which renders as no visible ring at all. The dot itself is the
  // load-bearing "you-are-here" affordance; pinning to value=0
  // instead would leave a frozen semi-visible (opacity 0.35) ring
  // that reads as a rendering artifact.
  const reduceMotion = useReduceMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.4],
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0],
  });

  // tracksViewChanges stays TRUE permanently. We cycled through the
  // tracksViewChanges={false} perf optimizations — snapshot-once-on-mount,
  // state-in-key remount, re-track-in-place — and each one regressed
  // *something* (vanishes on zoom, vanishes on route-switch, or the dot
  // drops under a co-located heart pin because a remount loses zIndex on
  // iOS). The only option that keeps the dot reliably visible AND honors
  // its zIndex in every state is to never let MapKit cache a stale bitmap:
  // keep rendering live. This is one small marker (and it's animated — the
  // pulse needs live rendering anyway), so the cost is negligible; Apple
  // Maps keeps its user dot always-live for the same reason. See
  // docs/learnings.md — "the must-never-vanish markers always track."
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      // High zIndex so the dot draws above LandmarkMarker pins
      // (default zIndex 0). 1000 leaves room for any future markers
      // that legitimately need to draw above the user dot (e.g. a
      // turn-by-turn next-step arrow). Honored because the marker never
      // remounts — a remount is what loses zIndex on iOS.
      zIndex={1000}
      tracksViewChanges
      accessibilityRole="image"
      accessibilityLabel="Your location"
    >
      <View style={styles.frame}>
        <Animated.View
          style={[
            styles.pulse,
            { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
          ]}
        />
        <View style={styles.outerRing}>
          <View style={styles.innerDot} />
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  // 40×40 frame so the pulsing ring has room to expand without
  // getting clipped by the marker's bounding box. Bumped from 32×32
  // alongside the dot/ring resize so the user-location marker reads
  // at proportional weight to LandmarkMarker (~52pt visible) and the
  // 48pt placement pin — was getting visually lost between them.
  frame: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: radii.md,
    backgroundColor: colors.systemBlue,
  },
  outerRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.dot,
  },
  innerDot: {
    width: 18,
    height: 18,
    borderRadius: radii.sm,
    backgroundColor: colors.systemBlue,
  },
});
