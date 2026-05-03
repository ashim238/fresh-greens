import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import MapView from 'react-native-maps';

/**
 * Home — the main map screen. v1 is map-only; floating UI (search bar,
 * menu, bottom sheet, markers) lands in feat/home-overlay.
 *
 * Route: /home
 * Figma node: 825:3625 (Established variant)
 *
 * Map provider: Apple MapKit on iOS (default — no API key needed),
 * Google Maps on Android (would require a key, not configured yet).
 */
export default function Home() {
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <MapView
        style={styles.map}
        // initialRegion centers Mobile, AL (matches Figma's "East Historic
        // District, Mobile" copy in the bottom sheet). Will be replaced by
        // the user's actual location in feat/location-permission.
        initialRegion={{
          latitude: 30.6954,
          longitude: -88.0399,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
