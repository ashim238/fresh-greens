import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { colors } from '../theme/colors';

/**
 * Custom map marker — a circular pip with a Phosphor glyph inside,
 * rendered as a `react-native-maps` Marker. The pin point (the bottom
 * tip of the circle) sits on the marker's coordinate, mirroring how
 * native iOS map pins anchor.
 *
 * Used for community reports and saved places. Color of the surface
 * encodes role: freshgreen for the user's own saved spaces (home,
 * landmarks), category-tinted for community reports.
 */
export function MapMarker({
  latitude,
  longitude,
  surfaceColor = colors.freshgreen,
  borderColor = colors.white,
  children,
  onPress,
  accessibilityLabel,
}: {
  latitude: number;
  longitude: number;
  surfaceColor?: string;
  borderColor?: string;
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 1 }}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      tracksViewChanges={false}
    >
      <View style={styles.shadow}>
        <View
          style={[
            styles.pip,
            { backgroundColor: surfaceColor, borderColor },
          ]}
        >
          {children}
        </View>
        {/* Pin "tail" — small downward triangle from the pip's bottom. */}
        <View
          style={[
            styles.tail,
            { borderTopColor: surfaceColor },
          ]}
        />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  shadow: {
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  pip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
});
