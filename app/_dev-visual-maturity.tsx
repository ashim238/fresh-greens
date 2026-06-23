import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaterialSurface } from '../components/MaterialSurface';
import { SquircleIcon } from '../components/SquircleIcon';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { typography } from '../theme/typography';

/**
 * TEMPORARY — Visual Maturity Phase 0 smoke route.
 *
 * Verifies the two high-risk integrations from the spec's Risk Register:
 *   - expo-blur × react-native-maps hit-test (does the map still pan
 *     when a MaterialSurface overlays part of the viewport? does a
 *     Pressable INSIDE a MaterialSurface still fire?)
 *   - expo-linear-gradient × Pressable × borderRadius on Android (does
 *     the gradient clip cleanly to the squircle radius when wrapped in
 *     a Pressable?)
 *
 * DELETE this file before opening the PR. The Phase 0 acceptance
 * checklist requires this file to be absent from the merged branch.
 */
export default function VisualMaturitySmoke() {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 40.7128,
          longitude: -74.006,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <MaterialSurface
          tier="chrome"
          style={[styles.chromeBar, { borderRadius: radii.pill }]}
        >
          <Pressable onPress={() => router.back()}>
            <Text style={styles.label}>Back · tap should fire through chrome</Text>
          </Pressable>
        </MaterialSurface>

        <MaterialSurface
          tier="sheet"
          style={[styles.sheet, { borderTopLeftRadius: 28, borderTopRightRadius: 28 }]}
        >
          <Text style={[styles.label, styles.heading]}>Sheet tier</Text>
          <View style={styles.row}>
            <Pressable onPress={() => console.log('positive tapped')}>
              <SquircleIcon categoryId="felt-welcome" variant="positive" size={48} />
            </Pressable>
            <Pressable onPress={() => console.log('black-owned tapped')}>
              <SquircleIcon categoryId="black-owned" variant="black-owned" size={48} />
            </Pressable>
            <Pressable onPress={() => console.log('report tapped')}>
              <SquircleIcon categoryId="hazard" variant="report" size={48} />
            </Pressable>
          </View>
          <Text style={styles.caption}>
            Tap each icon → console should log; map should still pan around the sheet.
          </Text>
        </MaterialSurface>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  overlay: { flex: 1, justifyContent: 'space-between' },
  chromeBar: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sheet: {
    padding: 24,
    gap: 16,
  },
  row: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  label: { ...typography.bodyEmphasized, color: colors.black },
  heading: { ...typography.title3Emphasized },
  caption: { ...typography.footnoteRegular, color: colors.labelSecondary, textAlign: 'center' },
});
