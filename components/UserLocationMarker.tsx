import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';

const WEDGE_LENGTH = 28;
const WEDGE_HALF_WIDTH = 16;
const FRAME_SIZE = 80;
const MIN_SPEED_MPS = 0.5;

export function UserLocationMarker({
  latitude,
  longitude,
  heading,
  speed,
}: {
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
}) {
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

  const showWedge =
    heading != null &&
    heading >= 0 &&
    speed != null &&
    speed >= MIN_SPEED_MPS;

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
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
        {showWedge && (
          <View
            style={[
              styles.wedgeAnchor,
              { transform: [{ rotate: `${heading}deg` }] },
            ]}
          >
            <View style={styles.wedge} />
          </View>
        )}
        <View style={styles.outerRing}>
          <View style={styles.innerCore} />
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
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
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.dot,
  },
  innerCore: {
    width: 18,
    height: 18,
    borderRadius: radii.sm,
    backgroundColor: colors.systemBlue,
  },
  wedgeAnchor: {
    position: 'absolute',
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    alignItems: 'center',
  },
  wedge: {
    width: 0,
    height: 0,
    borderLeftWidth: WEDGE_HALF_WIDTH,
    borderRightWidth: WEDGE_HALF_WIDTH,
    borderTopWidth: WEDGE_LENGTH,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(0, 122, 255, 0.35)',
    marginTop: FRAME_SIZE / 2 - WEDGE_LENGTH,
  },
});
