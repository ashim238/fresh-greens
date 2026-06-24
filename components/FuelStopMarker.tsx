import { Star } from 'phosphor-react-native/src/icons/Star';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import FuelSvg from '../assets/illustrations/fuel.svg';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';

/**
 * On-map fuel/charging stop pin for route preview and en-route. Tap
 * opens FuelStopsSheet with this stop highlighted.
 */
export function FuelStopMarker({
  latitude,
  longitude,
  name,
  preferred,
  selected = false,
  onPress,
}: {
  latitude: number;
  longitude: number;
  name: string;
  preferred: boolean;
  /** Sheet open + this stop is the map-tap subject (echoes FuelStopsSheet highlight). */
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 1 }}
      onPress={onPress}
      tracksViewChanges={false}
      zIndex={400}
      accessibilityRole="button"
      accessibilityLabel={
        preferred
          ? `${name}, trusted fuel stop on your route`
          : `${name}, fuel stop on your route`
      }
      accessibilityHint="Opens fuel stops along your route"
    >
      <View style={styles.frame} accessibilityIgnoresInvertColors>
        <View
          style={[
            styles.iconCircle,
            preferred && styles.iconCirclePreferred,
            selected && !preferred && styles.iconCircleSelected,
          ]}
        >
          <FuelSvg width={22} height={22} />
        </View>
        {preferred ? (
          <View style={styles.starBadge}>
            <Star size={12} color={colors.yellow} weight="fill" />
          </View>
        ) : null}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.separatorSubtle,
    ...shadows.e1,
  },
  iconCirclePreferred: {
    // reserved-color sanctioned (.cursorrules #9): favorite-gold ring, on-map sibling of PreferredStar
    borderColor: colors.yellow,
    borderWidth: 2,
  },
  iconCircleSelected: {
    borderColor: colors.wiltedgreen,
    borderWidth: 2,
  },
  starBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: radii.sm,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.e1,
  },
});
