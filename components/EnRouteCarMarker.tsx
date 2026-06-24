import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { NavigationArrow } from 'phosphor-react-native/src/icons/NavigationArrow';

import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';

const PUCK_SIZE = 36;
const BORDER_WIDTH = 1.5;
const OUTER_SIZE = PUCK_SIZE + BORDER_WIDTH * 2;
const ARROW_SIZE = 20;
const FRAME_SIZE = 80;

const TRAIL_1_OFFSET = 25;
const TRAIL_1_SIZE = 7;
const TRAIL_2_OFFSET = 35;
const TRAIL_2_SIZE = 4;

const TILT_PERSPECTIVE = 300;
const TILT_ANGLE = '40deg';

export function EnRouteCarMarker({
  latitude,
  longitude,
  heading,
}: {
  latitude: number;
  longitude: number;
  heading: number | null;
}) {
  const rotation = heading ?? 0;
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setTracking(false), 50);
    return () => clearTimeout(id);
  }, []);

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={1000}
      tracksViewChanges={tracking}
      accessibilityRole="image"
      accessibilityLabel="Your car along the route"
    >
      <View
        style={[styles.frame, { transform: [{ rotate: `${rotation}deg` }] }]}
      >
        <View
          style={[
            styles.tilt,
            {
              transform: [
                { perspective: TILT_PERSPECTIVE },
                { rotateX: TILT_ANGLE },
              ],
            },
          ]}
        >
          <View style={styles.trail1} />
          <View style={styles.trail2} />
          <View style={styles.puck}>
            <View style={styles.core}>
              <View style={styles.crescent} />
              <NavigationArrow
                size={ARROW_SIZE}
                color={colors.white}
                weight="fill"
              />
            </View>
          </View>
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
  tilt: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  puck: {
    width: OUTER_SIZE,
    height: OUTER_SIZE,
    borderRadius: OUTER_SIZE / 2,
    backgroundColor: colors.burntgreen,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.dot,
  },
  core: {
    width: PUCK_SIZE,
    height: PUCK_SIZE,
    borderRadius: PUCK_SIZE / 2,
    backgroundColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  crescent: {
    position: 'absolute',
    top: -PUCK_SIZE * 0.35,
    left: -PUCK_SIZE * 0.1,
    width: PUCK_SIZE * 0.9,
    height: PUCK_SIZE * 0.9,
    borderRadius: (PUCK_SIZE * 0.9) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  trail1: {
    position: 'absolute',
    width: TRAIL_1_SIZE,
    height: TRAIL_1_SIZE,
    borderRadius: TRAIL_1_SIZE / 2,
    backgroundColor: colors.freshgreen,
    opacity: 0.28,
    top: FRAME_SIZE / 2 + TRAIL_1_OFFSET - TRAIL_1_SIZE / 2,
    left: FRAME_SIZE / 2 - TRAIL_1_SIZE / 2,
  },
  trail2: {
    position: 'absolute',
    width: TRAIL_2_SIZE,
    height: TRAIL_2_SIZE,
    borderRadius: TRAIL_2_SIZE / 2,
    backgroundColor: colors.freshgreen,
    opacity: 0.12,
    top: FRAME_SIZE / 2 + TRAIL_2_OFFSET - TRAIL_2_SIZE / 2,
    left: FRAME_SIZE / 2 - TRAIL_2_SIZE / 2,
  },
});
