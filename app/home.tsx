import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Polygon, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SearchBar } from '../components/SearchBar';
import { getRoutesBetween, routeColors } from '../lib/api/routes';
import { getZonesForRegion, type Zone, zoneColors } from '../lib/api/zones';
import { pickWinner, type RankedRoute } from '../lib/scoring';
import { typography } from '../theme/typography';

/**
 * Home — the main map screen.
 * Route: /home
 * Figma node: 825:3625 (Established variant)
 *
 * Layout: full-bleed map, with floating UI on top — search bar + menu
 * button at the top, bottom-sheet stub at the bottom. Custom markers
 * and full bottom-sheet content land in future PRs.
 */
export default function Home() {
  const mapRef = useRef<MapView>(null);
  // Zones and routes both live in component state so they re-render the
  // map when fetched. Empty arrays initially → nothing renders → map shows
  // clean until data arrives a moment later. This is the "loading state"
  // without explicit UI.
  const [zones, setZones] = useState<Zone[]>([]);
  // routes holds RankedRoute[] (post-scoring) rather than raw Route[].
  // Each ranked route carries `type` ('recommended' | 'alternate') and
  // `score`, both decided by pickWinner based on which zones the route
  // intersects.
  const [routes, setRoutes] = useState<RankedRoute[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchAndCenterOnUser() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled || status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({});
      if (cancelled) return;

      const center = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      mapRef.current?.animateToRegion(
        { ...center, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        1000,
      );

      // Fetch zones AND routes in parallel. Promise.all kicks both off
      // at the same time and waits for both — faster than awaiting them
      // sequentially. The cancellation flag check after handles the case
      // where the user navigated away while either was in flight.
      //
      // Mock destination is a fixed offset (~1.1km NE) just so we have
      // somewhere to route to. Real destination input lands when we wire
      // the search bar.
      const destination = {
        latitude: center.latitude + 0.01,
        longitude: center.longitude + 0.01,
      };
      const [fetchedZones, fetchedRoutes] = await Promise.all([
        getZonesForRegion(center),
        getRoutesBetween(center, destination),
      ]);
      if (cancelled) return;

      // Rank the candidate routes by how many safe vs caution vs avoid
      // zone waypoints they contain. The winner gets type='recommended'
      // and renders bold green; the rest get 'alternate' (muted gray).
      // This is the actual "Fresh Greens picks the safer route" moment.
      const ranked = pickWinner(fetchedRoutes, fetchedZones);

      setZones(fetchedZones);
      setRoutes(ranked);
    }

    fetchAndCenterOnUser();
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
        initialRegion={{
          latitude: 30.6954,
          longitude: -88.0399,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/*
          Map overlays. Polygons (zones) and Polylines (routes) must be
          CHILDREN of MapView — react-native-maps reads its overlay
          children and renders them at the native layer alongside the
          map tiles. JSX order = paint order; routes render on top of
          zones so the polyline is always visible against the polygon
          fills.
        */}
        {zones.map((zone) => (
          <Polygon
            key={zone.id}
            coordinates={zone.coordinates}
            fillColor={zoneColors[zone.type].fill}
            strokeColor={zoneColors[zone.type].stroke}
            strokeWidth={2}
          />
        ))}
        {routes.map((route) => (
          <Polyline
            key={route.id}
            coordinates={route.coordinates}
            strokeColor={routeColors[route.type].stroke}
            strokeWidth={routeColors[route.type].width}
          />
        ))}
      </MapView>

      {/*
        Top overlay: search bar + menu button. pointerEvents="box-none"
        means taps pass through this container unless they hit a child —
        so empty space between/around the floating elements still reaches
        the map for pan/zoom. Children with their own onPress (Pressable)
        capture taps normally.
      */}
      <SafeAreaView
        style={styles.topOverlay}
        edges={['top']}
        pointerEvents="box-none"
      >
        <SearchBar />

        <View style={styles.menuRow} pointerEvents="box-none">
          <Pressable
            style={styles.menuButton}
            accessibilityRole="button"
            accessibilityLabel="Menu"
          >
            <Ionicons name="menu" size={32} color="#3C3C43" />
          </Pressable>
        </View>
      </SafeAreaView>

      {/*
        Bottom sheet stub. Real content (recommendations, weather chip,
        location header) lands in a follow-up PR. For now: just the
        rounded-top white panel + drag handle to establish the shape.
      */}
      <SafeAreaView style={styles.bottomSheet} edges={['bottom']}>
        <View style={styles.dragHandle} />
        <Text style={styles.bottomSheetPlaceholder}>
          Recommendations and route info land here.
        </Text>
      </SafeAreaView>
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
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // SafeAreaView's edges=['top'] adds the system inset (~47pt on
    // iPhone X+). Adding 23pt on top of that brings the search bar to
    // ~70pt from screen top, matching Figma's pt-[70px].
    paddingTop: 23,
    gap: 24,
    alignItems: 'center',
    // No horizontal padding — children set their own widths so the menu
    // button can left-align with the search bar's left edge (both 374pt).
  },
  menuRow: {
    // Width 358 + alignItems flex-start places menu button at x=16 from
    // screen edge — 8pt to the right of where the search bar's pill begins
    // (x=8). This is intentional in the Figma design: the search bar
    // overflows the parent's 16pt padding (it's 374pt wide on a 390pt
    // screen), while the menu button respects the padding.
    width: 358, // 390 screen - 16*2 padding
    alignItems: 'flex-start',
  },
  menuButton: {
    width: 48,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    // Approximates Figma M3 Elevation Light/2.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    // Shadow points UP (negative offset.y) since the sheet floats above
    // content from the bottom edge.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  dragHandle: {
    width: 32,
    height: 4,
    borderRadius: 100,
    backgroundColor: 'rgba(128, 128, 128, 0.55)',
    marginBottom: 16,
  },
  bottomSheetPlaceholder: {
    ...typography.footnoteRegular,
    color: 'rgba(60, 60, 67, 0.6)',
    paddingVertical: 16,
  },
});
