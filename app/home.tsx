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
import { gradientSegments } from '../lib/daylight';
import { pickWinner, type RankedRoute } from '../lib/scoring';
import { colors } from '../theme/colors';
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

  // Recommended route is the one we explain in the bottom sheet. May be
  // undefined briefly on first render before the fetch completes.
  const recommended = routes.find((route) => route.type === 'recommended');

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
        {routes.map((route) => {
          // Recommended route renders as multiple polyline segments with
          // a daylight gradient (green → orange → red) representing how
          // daylight availability fades across the route's duration.
          // Alternate routes stay muted gray — their daylight isn't
          // relevant since they aren't the chosen path.
          if (route.type === 'recommended') {
            return gradientSegments(route).map((segment, idx) => (
              <Polyline
                key={`${route.id}-seg-${idx}`}
                coordinates={segment.coordinates}
                strokeColor={segment.color}
                strokeWidth={routeColors.recommended.width}
              />
            ));
          }
          return (
            <Polyline
              key={route.id}
              coordinates={route.coordinates}
              strokeColor={routeColors[route.type].stroke}
              strokeWidth={routeColors[route.type].width}
            />
          );
        })}
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
        Bottom sheet — Route (Established) variant.
        Figma node: 825:3635
        Layout mirrors Figma's nested groups: drag handle / headers
        (greeting + daylight strip + main copy) / picture (tradeoff
        explanation) / actions row (Schedule + Go).
      */}
      <SafeAreaView style={styles.bottomSheet} edges={['bottom']}>
        <View style={styles.dragHandle} />

        <View style={styles.bottomSheetContent}>
          <View style={styles.headers}>
            <View style={styles.greetingRow}>
              {/*
                TODO: personalized greeting once auth lands. Figma copy is
                "Mornin' Jordan. Ready to face the day?" — first half is
                user-name + time-of-day, second half is the static prompt.
              */}
              <Text style={styles.greeting} numberOfLines={1}>
                Ready to face the day?
              </Text>

              {/*
                Daylight strip — gradient bar + sun/moon icons showing
                daylight progression across the day.
                TODO: install expo-linear-gradient and replace the flat
                placeholder bar with a real gradient (orange → mauve →
                indigo per Figma).
              */}
              <View style={styles.daylightStrip}>
                <View style={styles.daylightBar} />
                <View style={styles.daylightIcons}>
                  <Ionicons name="sunny" size={16} color="#FFB347" />
                  <Ionicons name="moon" size={16} color="#2D1B69" />
                </View>
              </View>
            </View>

            <View style={styles.mainCopyRow}>
              {/*
                TODO: real destination text once the search bar is wired.
                Figma copy: "You've made a few early morning trips to
                300 N Water lately. Heading there now?"
              */}
              <Text style={styles.mainCopy}>
                About{' '}
                <Text style={styles.minutes}>
                  {recommended?.estimatedMinutes ?? '—'} min
                </Text>
                {' '}to <Text style={styles.destination}>your destination</Text>
                .
              </Text>
            </View>
          </View>

          <View style={styles.tradeoffRow}>
            <Text style={styles.tradeoffCopy}>
              Heads up! You can leave in a bit and still make it on time with
              some added daylight on your route.
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {/*
            TODO: real schedule time once we install a sun calculator.
            Figma copy: "Schedule for 7:38 AM" (computed from sunset
            time + estimated trip duration).
          */}
          <Pressable
            style={styles.scheduleBtn}
            accessibilityRole="button"
            accessibilityLabel="Schedule trip for later when daylight is better"
          >
            <Text style={styles.scheduleText}>Schedule for later</Text>
          </Pressable>

          {/* TODO: wire to turn-by-turn / en-route screen once it exists */}
          <Pressable
            style={styles.goBtn}
            accessibilityRole="button"
            accessibilityLabel="Start navigation"
          >
            <Ionicons name="arrow-forward" size={24} color={colors.white} />
            <Text style={styles.goText}>Go</Text>
          </Pressable>
        </View>
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
    gap: 16,
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
    alignSelf: 'center', // explicit since the parent no longer alignItems:center
  },
  bottomSheetContent: {
    gap: 24,
  },
  headers: {
    gap: 8,
  },
  greetingRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
    paddingHorizontal: 16,
  },
  greeting: {
    ...typography.footnoteRegular,
    flex: 1,
    color: 'rgba(80, 80, 80, 0.7)', // muted secondary per Figma
  },
  daylightStrip: {
    width: 96,
    gap: 4,
  },
  daylightBar: {
    height: 4,
    borderRadius: 100,
    // Placeholder color — averaged middle of the orange→mauve→indigo
    // gradient. TODO: install expo-linear-gradient for real gradient.
    backgroundColor: '#C4785A',
  },
  daylightIcons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mainCopyRow: {
    paddingHorizontal: 16,
  },
  mainCopy: {
    ...typography.bodyEmphasized,
    color: colors.black,
  },
  minutes: {
    color: colors.wiltedgreen,
  },
  destination: {
    color: colors.wiltedgreen,
    textDecorationLine: 'underline',
  },
  tradeoffRow: {
    paddingHorizontal: 16,
  },
  tradeoffCopy: {
    ...typography.footnoteRegular,
    color: 'rgba(80, 80, 80, 0.7)',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  scheduleBtn: {
    flex: 1,
    height: 36,
    borderRadius: 100, // pill
    borderWidth: 1,
    borderColor: colors.wiltedgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleText: {
    ...typography.footnoteEmphasized,
    color: colors.wiltedgreen,
  },
  goBtn: {
    flex: 1,
    height: 36,
    borderRadius: 100,
    backgroundColor: colors.freshgreen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    // Approximates Figma M3 Elevation Light/1.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  goText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
  },
});
