import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { colors } from '../theme/colors';

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
  // 1.6s loop, native driver.
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
  }, [pulse]);

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.4],
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0],
  });

  // Track-until-first-paint. With `tracksViewChanges={false}` from
  // t=0, MapKit's marker snapshot was racing the View tree's paint;
  // on zoom re-evaluations the marker could disappear when MapKit
  // re-rasterized a cached-but-empty bitmap. 50ms ≈ 3 frames gives
  // the View tree time to paint and commit before MapKit caches the
  // bitmap — setTimeout(0) fires before native paint and isn't
  // enough. (The pulse stops animating once we stop tracking —
  // acceptable trade for a marker that actually renders. The pulse
  // is decorative; the dot is the load-bearing affordance.)
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setTracking(false), 50);
    return () => clearTimeout(id);
  }, []);

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      // High zIndex so the dot draws above LandmarkMarker pins
      // (default zIndex 0). 1000 leaves room for any future markers
      // that legitimately need to draw above the user dot (e.g. a
      // turn-by-turn next-step arrow).
      zIndex={1000}
      tracksViewChanges={tracking}
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

const DOT_BLUE = '#007AFF'; // iOS systemBlue — matches the native MKUserLocation tint

const styles = StyleSheet.create({
  // 32×32 frame so the pulsing ring has room to expand without
  // getting clipped by the marker's bounding box.
  frame: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: DOT_BLUE,
  },
  outerRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  innerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: DOT_BLUE,
  },
});
