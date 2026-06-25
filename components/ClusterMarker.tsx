import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { dynamicType } from '../theme/dynamic-type';
import { typography } from '../theme/typography';

/**
 * Map cluster marker — small orange circle with a count number,
 * shown when several community-report markers would otherwise stack
 * at low zoom levels. Tap zooms the camera into the cluster.
 *
 * Renders inside `react-native-maps` Marker. The reason this needs
 * its own component is the `tracksViewChanges` lifecycle: cluster
 * IDs change on every zoom step (the clustering algorithm rebuckets
 * per visible region), so each cluster is a *fresh* Marker mount.
 * Setting `tracksViewChanges={false}` from t=0 raced the inner
 * View's first paint and MapKit would snapshot an empty bitmap.
 *
 * Same `useState(true) → setTimeout(50ms) → false` pattern as the
 * other custom markers in the app (LandmarkMarker, DestinationMarker,
 * UserLocationMarker, EnRouteCarMarker). Fixes the "markers go
 * blank when I zoom" rendering issue.
 */
export function ClusterMarker({
  latitude,
  longitude,
  count,
  onPress,
}: {
  latitude: number;
  longitude: number;
  count: number;
  onPress?: () => void;
}) {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setTracking(false), 50);
    return () => clearTimeout(id);
  }, []);

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={550}
      tracksViewChanges={tracking}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${count} community reports nearby — tap to zoom in`}
    >
      <View style={styles.marker}>
        <Text style={styles.count}>{count}</Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  marker: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    // wiltedgreen (not orange) — orange is reserved per .cursorrules
    // rule #4 for caution/hazard signaling. A community-report
    // cluster is informational (N reports here, tap to zoom), not
    // a hazard signal. wiltedgreen + white reads as "count badge"
    // without coding it as a danger marker.
    backgroundColor: colors.wiltedgreen,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    // A22: was inline (elevation:3) drifting from shadows.e3 (elevation:4).
    // All other map-pin markers (LandmarkMarker, DestinationMarker) use
    // shadows.e3 — ClusterMarker is brought into the same tier per
    // DESIGN.md §4 shadows.e2.
    ...shadows.e3,
  },
  count: {
    ...dynamicType(typography.footnoteEmphasized),
    color: colors.white,
  },
});
