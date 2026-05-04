import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView from 'react-native-maps';

/**
 * Home — the main map screen. v1 is map-only; floating UI (search bar,
 * menu, bottom sheet, markers) lands in feat/home-overlay.
 *
 * Route: /home
 * Figma node: 825:3625 (Established variant)
 *
 * On mount, requests location permission and animates the map to the
 * user's current coordinates. Falls back to Mobile, AL if permission
 * isn't granted.
 */
export default function Home() {
  // useRef gives us an imperative handle to the MapView so we can call
  // `animateToRegion` on it from inside an effect. Refs hold a `.current`
  // value that persists across renders without triggering re-renders
  // when changed. The initial value is `null` because the map hasn't
  // mounted yet on the first render.
  const mapRef = useRef<MapView>(null);

  // useEffect runs *after* the component renders. The empty `[]` deps
  // array means "run only on mount" — once, when the screen first appears.
  // Effects can't be async themselves, so we wrap an async function
  // and call it. The `cancelled` flag handles the case where the user
  // navigates away before the location lookup finishes — we don't want
  // to update a map that no longer exists.
  useEffect(() => {
    let cancelled = false;

    async function fetchAndCenterOnUser() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled || status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({});
      if (cancelled) return;

      mapRef.current?.animateToRegion(
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        1000, // animation duration in ms
      );
    }

    fetchAndCenterOnUser();

    // The cleanup function runs when the component unmounts. Setting
    // `cancelled = true` causes any in-flight async work to bail before
    // touching state or refs that no longer exist.
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <MapView
        ref={mapRef}
        style={styles.map}
        // Fallback region — used only briefly until location loads.
        initialRegion={{
          latitude: 30.6954,
          longitude: -88.0399,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        // Renders the blue user-location dot once permission is granted.
        showsUserLocation
        // Hides the default "center on me" button — we'll add a custom
        // one in feat/home-overlay.
        showsMyLocationButton={false}
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
