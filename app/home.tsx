import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Polygon, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

// Phosphor deep-imports — see app/trusted-contact-setup.tsx for the
// longer note + tsconfig `paths` mapping that keeps TypeScript happy.
import { Car } from 'phosphor-react-native/src/icons/Car';
import { House } from 'phosphor-react-native/src/icons/House';
import { Megaphone } from 'phosphor-react-native/src/icons/Megaphone';

// Daylight glyphs — same SVGs Figma uses on /en-route's ETA so the
// symbol carries the same meaning on both surfaces.
import DaylightMoon from '../assets/illustrations/daylight-moon.svg';
import DaylightSun from '../assets/illustrations/daylight-sun.svg';

import { DragHandle } from '../components/DragHandle';
import { EdgeIndicator } from '../components/EdgeIndicator';
import { MapMarker } from '../components/MapMarker';
import { SearchBar } from '../components/SearchBar';
import { usePreferences } from '../hooks/usePreferences';
import { useSavedPlaces } from '../hooks/useSavedPlaces';
import { useUser } from '../hooks/useUser';
import { getCommunityReportsAsZones } from '../lib/api/community-reports';
import { getRoutesBetween, type Route, routeColors } from '../lib/api/routes';
import {
  getZonesForRegion,
  type Zone,
  zoneColors,
} from '../lib/api/zones';
import { gradientSegments } from '../lib/daylight';
import { formatDuration } from '../lib/format';
import {
  edgePositionForPoint,
  isPointInRegion,
  type Region,
} from '../lib/edge-indicators';
import { pickWinner } from '../lib/scoring';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

// Zone-overlay rendering is now a real user preference (toggled from
// /menu's Zone Settings). Read from `usePreferences` inside the
// component below — no module-level constant. Default OFF until the
// user flips it in Settings; the zone data still drives scoring even
// when overlays are hidden.

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
  const router = useRouter();
  const { user } = useUser();
  const { preferences } = usePreferences();
  const { home, addSavedPlace } = useSavedPlaces();
  // showZones is `false` while preferences are loading from AsyncStorage;
  // overlays just render on the next pass once the value resolves.
  const showZones = preferences?.showZones ?? false;
  const mapRef = useRef<MapView>(null);
  // Tracks the current visible region so we can decide whether each POI
  // needs a Marker (in viewport) or an EdgeIndicator (out of viewport).
  // Updated on `onRegionChangeComplete`; null until the user's first
  // pan/zoom or the centering effect fires.
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  // Viewport size in pt. Measured once via the MapView's onLayout —
  // edge-indicator positioning needs screen-space pixels, not lat/lng.
  const [mapSize, setMapSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  // Destination params from the search screen, if any. URL params arrive
  // as strings and may be undefined (when the user landed on /home without
  // having searched). We parse them into numbers below.
  const params = useLocalSearchParams<{
    destLat?: string;
    destLng?: string;
    destName?: string;
  }>();
  // Whether to underline the destination text in the bottom sheet.
  // The underline is the visual invitation to "save this as home/work"
  // for recurring trips — not for one-off journeys to somewhere the
  // user has never been. Hard-coded false until feat/recent-trips lands
  // a real frequency signal; the conditional rendering is in place so
  // flipping this becomes a one-line change.
  const isRegularDestination = false;
  // Zones and routes both live in component state so they re-render the
  // map when fetched. Empty arrays initially → nothing renders → map shows
  // clean until data arrives a moment later. This is the "loading state"
  // without explicit UI.
  // OSM zones (lit streets, landuse, parks). Refreshed when destination
  // changes. Hidden by default — they drive scoring invisibly.
  const [osmZones, setOsmZones] = useState<Zone[]>([]);
  // Community-submitted point reports. Refreshed every time /home gains
  // focus, so a freshly-submitted report from /report appears
  // immediately when the user closes the modal. Rendered as MapMarkers
  // when in the viewport and as EdgeIndicators when out — the "trusted
  // community" signal layer, distinct from OSM infrastructure zones.
  const [reportZones, setReportZones] = useState<Zone[]>([]);
  // Raw OSRM routes — pre-scoring. Ranking is derived (useMemo below)
  // so it recomputes automatically when zones change without needing
  // another effect.
  const [rawRoutes, setRawRoutes] = useState<Route[]>([]);
  // Measured bottom-sheet height. The Report button floats 24pt above
  // the sheet's top edge, so we need to know how tall the sheet is at
  // runtime (it grows with content). 0 until first layout pass — the
  // button stays unrendered until then to avoid a one-frame flash at
  // the wrong position.
  const [bottomSheetHeight, setBottomSheetHeight] = useState(0);

  // Combined zone set fed to scoring. OSM + community reports flow
  // through the same pipeline — same Zone type, same scorer dispatch.
  // useMemo keeps the array reference stable across renders that don't
  // change either source.
  const allZones = useMemo(
    () => [...osmZones, ...reportZones],
    [osmZones, reportZones],
  );

  // Ranked routes are derived from raw routes + zones. Recomputes
  // whenever any source changes — including when reportZones updates
  // after a new community report lands. Replaces the previous
  // setRoutes(pickWinner(...)) call sites.
  const routes = useMemo(
    () => pickWinner(rawRoutes, allZones),
    [rawRoutes, allZones],
  );

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

      // Destination comes from URL params (set by the search screen).
      // Falls back to a fixed offset NE of the user when the user hasn't
      // searched yet — gives the demo something to route to on first open.
      const destination =
        params.destLat && params.destLng
          ? {
              latitude: parseFloat(params.destLat),
              longitude: parseFloat(params.destLng),
            }
          : {
              latitude: center.latitude + 0.01,
              longitude: center.longitude + 0.01,
            };

      // Fire both fetches in parallel, but DON'T await them together —
      // that would gate the whole UI on the slower one. Instead:
      //   1. Render routes as soon as OSRM responds (with no zone
      //      ranking yet — first candidate becomes recommended by
      //      default since pickWinner with [] zones gives all routes
      //      score 0 and stable-sort preserves order).
      //   2. When zones arrive a moment later, re-rank against real
      //      data. The recommended route may shift; the screen updates.
      //
      // Net effect: route polyline appears immediately after OSRM
      // (often <1s); the daylight gradient + scoring refines a beat
      // later when Overpass finishes.
      const routePromise = getRoutesBetween(center, destination);
      const zonePromise = getZonesForRegion(center);

      const fetchedRoutes = await routePromise;
      if (cancelled) return;
      // Routes appear immediately with whatever zones we already have
      // (likely community reports from useFocusEffect, possibly empty).
      // The useMemo handles re-ranking when osmZones lands a moment
      // later — no second setRoutes needed.
      setRawRoutes(fetchedRoutes);

      const fetchedZones = await zonePromise;
      if (cancelled) return;
      setOsmZones(fetchedZones);
    }

    fetchAndCenterOnUser();
    return () => {
      cancelled = true;
    };
    // Re-run whenever the destination URL params change, so submitting
    // a new search refetches routes for the new endpoint without
    // requiring the user to navigate away and back.
  }, [params.destLat, params.destLng]);

  // Long-press on the map saves that location as the user's home.
  // Goes through Alert so the user confirms before persistence —
  // accidental long-presses on a navigation map shouldn't silently
  // overwrite a real saved home.
  function handleLongPress(e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    Alert.alert(
      'Save as home',
      'Add this location to your saved places? Your home appears on the map and as an off-screen indicator when you pan away.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: () => {
            void addSavedPlace({ kind: 'home', name: 'Home', latitude, longitude });
          },
        },
      ],
    );
  }

  // Refresh community reports each time /home gains focus. Two paths
  // hit this: initial mount (when navigating in from any prior screen)
  // and the dismissal of /report after a successful submission. The
  // second path is what makes a freshly-submitted report appear on the
  // map within a frame of the user closing the modal.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const fetched = await getCommunityReportsAsZones();
        if (cancelled) return;
        setReportZones(fetched);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

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
        onRegionChangeComplete={setMapRegion}
        onLayout={(e) =>
          setMapSize({
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
          })
        }
        onLongPress={handleLongPress}
      >
        {/*
          Map overlays. Polygons (zones) and Polylines (routes) must be
          CHILDREN of MapView — react-native-maps reads its overlay
          children and renders them at the native layer alongside the
          map tiles. JSX order = paint order; routes render on top of
          zones so the polyline is always visible against the polygon
          fills.
        */}
        {/*
          Zone overlays — rendered when the user has flipped the
          "Show zones overlay" toggle in /menu's Zone Settings.
          Default off; the zone data still drives scoring even when
          overlays are hidden.
        */}
        {showZones &&
          osmZones.map((zone) => {
            // Polyline zones (real OSM lit-street data) render as colored
            // street overlays — stroke only, no fill. Polygon zones (mock
            // fallback OR landuse from OSM) render as filled areas.
            if (zone.geometry === 'polyline') {
              return (
                <Polyline
                  key={zone.id}
                  coordinates={zone.coordinates}
                  strokeColor={zoneColors[zone.type].stroke}
                  strokeWidth={4}
                />
              );
            }
            if (zone.geometry === 'polygon') {
              return (
                <Polygon
                  key={zone.id}
                  coordinates={zone.coordinates}
                  fillColor={zoneColors[zone.type].fill}
                  strokeColor={zoneColors[zone.type].stroke}
                  strokeWidth={2}
                />
              );
            }
            // OSM adapter never returns 'point' geometry — community
            // reports do, and they're rendered separately below.
            return null;
          })}
        {/*
          Community-report points — rendered as custom Markers
          (Phosphor Megaphone glyph) only when they're inside the
          current viewport. Off-viewport reports surface as
          EdgeIndicators in the overlay below the map. Color tints by
          the category's safety classification via zoneColors.
        */}
        {reportZones.map((zone) => {
          if (zone.geometry !== 'point' || zone.coordinates.length === 0) {
            return null;
          }
          const point = zone.coordinates[0];
          // Render only when in viewport. mapRegion may be null on the
          // very first frame — render conservatively (yes) until
          // onRegionChangeComplete fires.
          if (mapRegion && !isPointInRegion(point, mapRegion)) {
            return null;
          }
          return (
            <MapMarker
              key={zone.id}
              latitude={point.latitude}
              longitude={point.longitude}
              surfaceColor={zoneColors[zone.type].stroke}
              accessibilityLabel={zone.label}
            >
              <Megaphone size={20} color={colors.white} weight="fill" />
            </MapMarker>
          );
        })}
        {/*
          Saved home — rendered as a freshgreen pip with a House
          glyph. Only visible when in the viewport; the EdgeIndicator
          overlay below handles the off-viewport case.
        */}
        {home &&
          (!mapRegion || isPointInRegion(home, mapRegion)) && (
            <MapMarker
              latitude={home.latitude}
              longitude={home.longitude}
              surfaceColor={colors.freshgreen}
              accessibilityLabel={`${home.name} (saved place)`}
            >
              <House size={20} color={colors.white} weight="fill" />
            </MapMarker>
          )}
        {/*
          OSRM-derived routes. Recommended renders as a daylight-
          gradient polyline; alternates render in muted gray. Always
          on the map's native overlay layer.
        */}
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
        Edge-indicator overlay — pills on the screen edge pointing to
        POIs that are currently outside the viewport. Updates on every
        pan/zoom (via mapRegion state) and renders in screen-space
        rather than the map's native layer. pointerEvents="box-none"
        keeps taps falling through to the map elsewhere.
      */}
      {mapRegion && mapSize && (
        <View style={styles.edgeOverlay} pointerEvents="box-none">
          {reportZones.map((zone) => {
            if (zone.geometry !== 'point' || zone.coordinates.length === 0) {
              return null;
            }
            const point = zone.coordinates[0];
            if (isPointInRegion(point, mapRegion)) return null;
            const edge = edgePositionForPoint(point, mapRegion, mapSize);
            return (
              <EdgeIndicator
                key={`edge-${zone.id}`}
                x={edge.x}
                y={edge.y}
                rotation={edge.rotation}
                surfaceColor={zoneColors[zone.type].stroke}
                borderColor={colors.white}
                arrowColor={zoneColors[zone.type].stroke}
                accessibilityLabel={`${zone.label} (off-screen — tap to center)`}
                onPress={() =>
                  mapRef.current?.animateToRegion(
                    {
                      latitude: point.latitude,
                      longitude: point.longitude,
                      latitudeDelta: mapRegion.latitudeDelta,
                      longitudeDelta: mapRegion.longitudeDelta,
                    },
                    400,
                  )
                }
              >
                <Megaphone size={16} color={colors.white} weight="fill" />
              </EdgeIndicator>
            );
          })}
          {home && !isPointInRegion(home, mapRegion) && (
            (() => {
              const edge = edgePositionForPoint(home, mapRegion, mapSize);
              return (
                <EdgeIndicator
                  x={edge.x}
                  y={edge.y}
                  rotation={edge.rotation}
                  surfaceColor={colors.freshgreen}
                  borderColor={colors.white}
                  arrowColor={colors.freshgreen}
                  accessibilityLabel={`${home.name} (off-screen — tap to center)`}
                  onPress={() =>
                    mapRef.current?.animateToRegion(
                      {
                        latitude: home.latitude,
                        longitude: home.longitude,
                        latitudeDelta: mapRegion.latitudeDelta,
                        longitudeDelta: mapRegion.longitudeDelta,
                      },
                      400,
                    )
                  }
                >
                  <House size={16} color={colors.white} weight="fill" />
                </EdgeIndicator>
              );
            })()
          )}
        </View>
      )}

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
        <SearchBar onPress={() => router.push('/search')} />

        <View style={styles.menuRow} pointerEvents="box-none">
          {/*
            Hamburger menu — pushes to /menu (Settings). Redundant with
            the avatar button on the right, but a hamburger is the
            expected pattern for "open the drawer" and the avatar is
            an identity-affordance first; both wire to the same place
            so neither feels broken. /safety reaches the user via the
            shield in the en-route side-button column.
          */}
          <Pressable
            style={styles.menuButton}
            accessibilityRole="button"
            accessibilityLabel="Menu"
            onPress={() => router.push('/menu')}
          >
            <Ionicons name="menu" size={32} color={colors.labelSecondary} />
          </Pressable>

          {/*
            Avatar button — opens /menu (Settings hub). Uses the same
            car-icon glyph as /menu's hero header, so the user's
            identity reads as a "car-in-the-system" everywhere it
            appears. Fadedgreen color matches /menu's hero (the
            trusted-friend pin gets freshgreen — different role).
            48pt white circular surface mirrors menuButton's elevation.
            useUser is read for accessibility label only (announces
            the user's name to VoiceOver) — visual is icon-only.

            TODO: replace Car placeholder with custom car asset to
            match the trusted-friend pin's iconography.
          */}
          <Pressable
            style={styles.avatarButton}
            onPress={() => router.push('/menu')}
            accessibilityRole="button"
            accessibilityLabel={
              user?.displayName
                ? `Open Settings (signed in as ${user.displayName})`
                : 'Open Settings'
            }
            hitSlop={8}
          >
            <Car size={28} color={colors.fadedgreen} weight="regular" />
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
      <SafeAreaView
        style={styles.bottomSheet}
        edges={['bottom']}
        onLayout={(e) => setBottomSheetHeight(e.nativeEvent.layout.height)}
      >
        <DragHandle />

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
              */}
              <View style={styles.daylightStrip}>
                {/*
                  Daylight progression: orange dawn → mauve dusk → indigo
                  night. Per Figma 825:3647 (gradient stops match the
                  swatch colors there). expo-linear-gradient renders this
                  natively — RN core has no gradient primitive.
                */}
                <LinearGradient
                  colors={[
                    colors.daylightDawn,
                    colors.daylightDusk,
                    colors.daylightNight,
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.daylightBar}
                />
                <View style={styles.daylightIcons}>
                  <DaylightSun width={16} height={16} />
                  <DaylightMoon width={16} height={16} />
                </View>
              </View>
            </View>

            <View style={styles.mainCopyRow}>
              {/*
                Figma copy: "You've made a few early morning trips to
                300 N Water lately. Heading there now?" — the
                destination underline is reserved for *recurring*
                destinations (a save-as-home/work invitation), so it
                only shows when the trip is recognized as regular.
                Hard-coded false until feat/recent-trips lands a real
                trip-frequency signal; right now every destination
                renders plain.
              */}
              <Text style={styles.mainCopy}>
                About{' '}
                <Text style={styles.minutes}>
                  {recommended ? formatDuration(recommended.estimatedMinutes) : '—'}
                </Text>
                {' '}to{' '}
                <Text style={isRegularDestination ? styles.destination : undefined}>
                  {params.destName ?? 'your destination'}
                </Text>
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
            TODO: compute the real schedule time via SunCalc + route
            duration (suncalc + lib/daylight.ts already wired). Figma
            copy: "Schedule for 7:38 AM".
          */}
          <Pressable
            style={styles.scheduleBtn}
            accessibilityRole="button"
            accessibilityLabel="Schedule trip for later when daylight is better"
          >
            <Text style={styles.scheduleText}>Schedule for later</Text>
          </Pressable>

          <Pressable
            style={styles.goBtn}
            onPress={() =>
              router.push({
                pathname: '/en-route',
                params: {
                  ...(params.destLat ? { destLat: params.destLat } : {}),
                  ...(params.destLng ? { destLng: params.destLng } : {}),
                  ...(params.destName ? { destName: params.destName } : {}),
                },
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Start navigation"
          >
            <Ionicons name="arrow-forward" size={24} color={colors.white} />
            <Text style={styles.goText}>Go</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/*
        Report button — floats 24pt above the bottom sheet's top edge,
        right-aligned 16pt from the screen edge. Tracks the sheet's
        height via onLayout so it lifts with the sheet as content grows.
        Hidden until first layout pass measures the sheet.
        Figma node: 825:3625 (Home, with Report button update)
        Pushes to /report — currently a stub (see app/report.tsx); the
        full reporting UI lands in the next PR (feat/community-report).
      */}
      {bottomSheetHeight > 0 && (
        <Pressable
          style={[styles.reportBtn, { bottom: bottomSheetHeight + 24 }]}
          accessibilityRole="button"
          accessibilityLabel="Report something — opens reporting flow"
          onPress={() => router.push('/report')}
        >
          <Ionicons name="alert-circle" size={32} color={colors.orange} />
        </Pressable>
      )}
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
  edgeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    // Responsive: stretch to parent width with 16pt margins on each
    // side. Menu button sits left, optional dev-reset chip sits right
    // via justifyContent: 'space-between'. With only the menu (production
    // build), the chip is gone and the menu still aligns to start —
    // space-between with one child collapses to flex-start behavior.
    alignSelf: 'stretch',
    marginHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  menuButton: {
    width: 48,
    height: 48,
    backgroundColor: colors.white,
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
  // Avatar button — top-right of /home. 48pt circular surface that
  // matches menuButton's elevation but reads as "identity / Settings"
  // rather than "menu icon." Holds the user's car glyph (rendered
  // in fadedgreen by the Car component itself).
  avatarButton: {
    width: 48,
    height: 48,
    backgroundColor: colors.white,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: colors.white,
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
    color: colors.mutedTertiary,
  },
  daylightStrip: {
    width: 96,
    gap: 4,
  },
  daylightBar: {
    height: 4,
    borderRadius: 100,
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
    color: colors.mutedTertiary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  scheduleBtn: {
    flex: 1,
    // 44pt height per iOS HIG (Figma specs 36 — HIG wins per .cursorrules).
    height: 44,
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
    // 44pt height per iOS HIG (Figma specs 36 — HIG wins per .cursorrules).
    height: 44,
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
  reportBtn: {
    position: 'absolute',
    right: 16,
    // `bottom` set inline from measured sheet height + 24 offset.
    width: 56,
    height: 56,
    borderRadius: 100, // circular (clamps to 28pt at this size)
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    // Approximates Figma M3 Elevation Light/2.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
});
