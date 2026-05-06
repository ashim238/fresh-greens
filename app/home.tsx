import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Polygon, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DragHandle } from '../components/DragHandle';
import { SearchBar } from '../components/SearchBar';
import { getCommunityReportsAsZones } from '../lib/api/community-reports';
import { getRoutesBetween, type Route, routeColors } from '../lib/api/routes';
import {
  getZonesForRegion,
  POINT_PROXIMITY_METERS,
  type Zone,
  zoneColors,
} from '../lib/api/zones';
import { gradientSegments } from '../lib/daylight';
import { pickWinner } from '../lib/scoring';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Toggle for rendering zone overlays (polygons + polylines) on the map.
 * Default OFF — the user just sees the route. The zone data still drives
 * scoring; it's just invisible.
 *
 * Flip to `true` for thesis screenshots that need to show the data layer
 * informing the route choice.
 */
const SHOW_ZONES = false;

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
  const mapRef = useRef<MapView>(null);
  // Destination params from the search screen, if any. URL params arrive
  // as strings and may be undefined (when the user landed on /home without
  // having searched). We parse them into numbers below.
  const params = useLocalSearchParams<{
    destLat?: string;
    destLng?: string;
    destName?: string;
  }>();
  // Zones and routes both live in component state so they re-render the
  // map when fetched. Empty arrays initially → nothing renders → map shows
  // clean until data arrives a moment later. This is the "loading state"
  // without explicit UI.
  // OSM zones (lit streets, landuse, parks). Refreshed when destination
  // changes. Hidden by default — they drive scoring invisibly.
  const [osmZones, setOsmZones] = useState<Zone[]>([]);
  // Community-submitted point reports. Refreshed every time /home gains
  // focus, so a freshly-submitted report from /report appears
  // immediately when the user closes the modal. Always rendered as
  // visible Circle markers — these are the "trusted community" signal,
  // unlike OSM zones which are infrastructure.
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
          Zone overlays — only rendered when SHOW_ZONES=true (debug/thesis-
          screenshot mode). In normal use the user just sees the route;
          the zone data still drives scoring invisibly behind the scenes.
        */}
        {SHOW_ZONES &&
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
          Community-report points — always visible (not gated by
          SHOW_ZONES). Rendered as Circles whose radius matches the
          scoring influence radius (POINT_PROXIMITY_METERS), so the
          map honestly shows what the scorer considers "in reach" of
          the report. Color matches the category's safety classification
          via the same zoneColors lookup OSM zones use.
        */}
        {reportZones.map((zone) => {
          if (zone.geometry !== 'point' || zone.coordinates.length === 0) {
            return null;
          }
          return (
            <Circle
              key={zone.id}
              center={zone.coordinates[0]}
              radius={POINT_PROXIMITY_METERS}
              fillColor={zoneColors[zone.type].fill}
              strokeColor={zoneColors[zone.type].stroke}
              strokeWidth={2}
            />
          );
        })}
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
        <SearchBar onPress={() => router.push('/search')} />

        <View style={styles.menuRow} pointerEvents="box-none">
          {/*
            TEMP: menu button wired to /safety for in-progress dev testing
            of the safety modal. Real entry point lands when we build the
            side-button navigation column (Help / Shield / Report / Center)
            in a future PR — at which point this button goes back to
            opening a side menu, and the shield button opens /safety.
          */}
          <Pressable
            style={styles.menuButton}
            accessibilityRole="button"
            accessibilityLabel="Menu"
            onPress={() => router.push('/safety')}
          >
            <Ionicons name="menu" size={32} color={colors.labelSecondary} />
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
                {' '}to{' '}
                <Text style={styles.destination}>
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
    // side. Combined with alignItems: flex-start, the menu button
    // lands at exactly 16pt from the screen edge regardless of device
    // width. Search bar (8pt from edge) sits 8pt to the left — the
    // intentional design offset.
    alignSelf: 'stretch',
    marginHorizontal: 16,
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
