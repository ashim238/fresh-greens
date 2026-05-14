import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, LayoutAnimation, Linking, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { X } from 'phosphor-react-native/src/icons/X';
import DaylightMoon from '../assets/illustrations/daylight-moon.svg';
import DaylightSun from '../assets/illustrations/daylight-sun.svg';
import MenuGlyph from '../assets/illustrations/menu-glyph.svg';
import SidebtnReport from '../assets/illustrations/sidebtn-report.svg';

import { DestinationMarker } from '../components/DestinationMarker';
import { DragHandle } from '../components/DragHandle';
import { EdgeIndicator } from '../components/EdgeIndicator';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { HomeBrowseSheet } from '../components/HomeBrowseSheet';
import { LandmarkMarker, variantForCategoryId } from '../components/LandmarkMarker';
import { ReportDetailCard } from '../components/ReportDetailCard';
import { SearchBar } from '../components/SearchBar';
import { UserLocationMarker } from '../components/UserLocationMarker';
import { usePreferences } from '../hooks/usePreferences';
import { useSavedPlaces } from '../hooks/useSavedPlaces';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { useUser } from '../hooks/useUser';
import {
  getCommunityReportsAsZones,
  type ReportCategoryId,
} from '../lib/api/community-reports';
import { getRoutesBetween, type Route, routeColors } from '../lib/api/routes';
import {
  getZonesForRegion,
  type Coordinate,
  type Zone,
  zoneColors,
  zoneDashPattern,
} from '../lib/api/zones';
import { clusterPointZones } from '../lib/clustering';
import { gradientSegments, suggestedDepartureForDaylight } from '../lib/daylight';
import { formatDuration, formatTimeOfDay } from '../lib/format';
import {
  edgePositionForPoint,
  groupEdgeIndicators,
  isPointInRegion,
  type Region,
} from '../lib/edge-indicators';
import { pickWinner } from '../lib/scoring';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
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
  const { preferences } = usePreferences();
  const { home, addSavedPlace } = useSavedPlaces();
  // Trusted Friend marker — renders only when the trusted contact has a
  // geocoded lat/lng (captured opportunistically during the picker flow
  // in /trusted-contact-setup). Encodes the thesis claim that the app
  // respects the "people who care about you" graph alongside the road
  // graph. Visual is a Phosphor HeartStraight stand-in inside the green
  // LandmarkMarker; the canonical SVG comes from Figma 1133:13245 when
  // it's exported.
  const { contact: trustedContact } = useTrustedContact();
  const { user } = useUser();
  // First name for the browse-mode sheet eyebrow ("Jordan's Local
  // Recs"). Pull off displayName since that's what useUser exposes;
  // fall back to undefined so HomeBrowseSheet drops the possessive
  // and renders "Local Recs 💃🏾" plain.
  const userFirstName = user?.displayName?.split(' ')[0];
  // Browse-mode "Things to Do" section starts COLLAPSED — the
  // expanded recommendation card is ~280pt tall and combined with
  // the eyebrow/title/weather rows would eat most of the screen on
  // iPhone-sized devices, crowding the Report FAB against the search
  // bar. Collapsed by default leaves the map breathing room; user
  // expands via the chevron when they want recommendations.
  const [thingsToDoCollapsed, setThingsToDoCollapsed] = useState(true);
  // showZones is `false` while preferences are loading from AsyncStorage;
  // overlays just render on the next pass once the value resolves.
  const showZones = preferences?.showZones ?? false;
  const mapRef = useRef<MapView>(null);
  // Tracks the current visible region so we can decide whether each POI
  // needs a Marker (in viewport) or an EdgeIndicator (out of viewport).
  // Updated on `onRegionChangeComplete`; null until the user's first
  // pan/zoom or the centering effect fires.
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  // Live GPS for the custom UserLocationMarker (which replaces
  // showsUserLocation so it can sit above LandmarkMarker pins via
  // zIndex). Updated by the watchPositionAsync subscription below;
  // null until the first fix arrives.
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
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
  // immediately when the user closes the modal. Rendered as LandmarkMarkers
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

  // --- Report placement mode (tap-then-drag) ---
  // When true, a draggable marker appears on the map. The user drags
  // it to the report location, then taps Confirm to open /report with
  // those coords. Cancel exits placement mode.
  const [placingReport, setPlacingReport] = useState(false);
  const [placementPin, setPlacementPin] = useState<Coordinate | null>(null);

  // --- Report detail card ---
  // Tapping an on-map community-report marker opens a compact detail
  // card at the bottom of the screen. Stores the zone data needed to
  // render the card; null = card hidden. `zoneId` lets the
  // corresponding marker render its on-tap state (1.33× scale per
  // Figma `1133:13418`) while the card is open.
  const [selectedReport, setSelectedReport] = useState<{
    zoneId: string;
    categoryId: ReportCategoryId;
    detail?: string;
    subTag?: string;
    timestamp: number;
  } | null>(null);

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

  // Route polylines memoized so unrelated re-renders don't rebuild
  // them on the native side. Same pattern in /en-route.
  //
  // Halo retired: react-native-maps' Polyline doesn't expose zIndex,
  // and iOS MKMapView paints overlays in an order we can't reliably
  // control across re-renders — the wider white halo kept winning
  // paint-order and hiding the colored stroke after the first
  // re-render. Apple Maps' own route polylines have no halo for the
  // same reason; the colored stroke alone reads fine against street
  // geometry. Bumped strokeWidth slightly so the route still claims
  // the map without the border.
  const routePolylines = useMemo(
    () => {
      // Paint order matters: react-native-maps' `Polyline` overlays
      // render in document order, so later children sit *over* earlier
      // ones. `pickWinner` returns recommended at index 0; iterating
      // routes as-is means the gray alternate polylines would paint
      // over the colored gradient where the two share streets — the
      // gradient gets visibly "cut" by gray segments. Render alternates
      // first, recommended last, so the colored stroke stays on top.
      const ordered = [
        ...routes.filter((r) => r.type !== 'recommended'),
        ...routes.filter((r) => r.type === 'recommended'),
      ];
      return ordered.flatMap((route) => {
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
        return [
          <Polyline
            key={route.id}
            coordinates={route.coordinates}
            strokeColor={routeColors[route.type].stroke}
            strokeWidth={routeColors[route.type].width}
          />,
        ];
      });
    },
    [routes],
  );

  // PanResponder for the bottom-sheet drag handle in browse mode.
  // Three intents resolved on release based on the gesture's vertical
  // delta: a near-stationary release reads as a tap (toggle), a
  // sufficient downward drag reads as collapse-intent, an upward drag
  // reads as expand-intent. 20pt threshold filters out the wobble of
  // a normal finger-lift while staying loose enough that a deliberate
  // half-inch flick commits.
  //
  // We don't bother making the sheet *follow* the finger in real time
  // — that would mean Animated.Value tracking + render-time interp,
  // and the snap-on-release feel is what most users actually expect
  // from a drag handle (Google Maps + Waze use the same pattern).
  // LayoutAnimation transitions the resulting height change so the
  // snap doesn't feel jarring.
  const dragHandleResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
        onPanResponderRelease: (_, g) => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          if (g.dy > 20) {
            setThingsToDoCollapsed(true);
          } else if (g.dy < -20) {
            setThingsToDoCollapsed(false);
          } else {
            setThingsToDoCollapsed((v) => !v);
          }
        },
      }),
    [],
  );

  // Suggested departure for the "Schedule for X:XX AM" chip. Only set
  // when leaving later actually buys more daylight (currently: pre-dawn
  // departures). `null` hides the chip — see lib/daylight.ts for rules.
  // v1 limitation: `now` is captured at first render, so a user who
  // lingers across sunrise will see a stale chip until /home remounts
  // (which happens on tab/route change). Acceptable for thesis demo;
  // a minute-resolution tick would fix it cheaply if needed later.
  const suggestedDeparture = useMemo(
    () => (recommended ? suggestedDepartureForDaylight(recommended) : null),
    [recommended],
  );

  // Clustered report markers — groups nearby points at low zoom to
  // prevent overlapping pins in dense neighborhoods. Recomputes on
  // every pan/zoom (mapRegion change) and when reports update.
  const clusteredReports = useMemo(() => {
    if (!mapRegion || !mapSize) return [];
    return clusterPointZones(reportZones, mapRegion, mapSize.width, mapSize.height);
  }, [reportZones, mapRegion, mapSize]);

  function handleReportButtonPress() {
    if (!userLocation) return;
    setPlacingReport(true);
    setPlacementPin({ ...userLocation });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Recenter on the placement pin with a tighter zoom — the user is
    // about to drag this thing, so the camera should be sitting on
    // top of it. Previously the pin appeared at the user's GPS coord
    // regardless of where the map was panned to; if the user had
    // scrolled the map away, the new pin could land off-screen and
    // they'd have no idea where it went. Tighter delta (0.005 vs the
    // 0.02 used on initial center) so the drag-by-1-block intent
    // reads as a meaningful gesture, not a tiny nudge.
    mapRef.current?.animateToRegion(
      {
        ...userLocation,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      400,
    );
  }

  /**
   * Tapping the saved-home pin recenters the map on it with a slight
   * zoom-in. Most users tap a saved-place pin because they want a
   * closer look at it — "drive me to home" is a separate flow handled
   * by the search/destination pipeline, not by tapping the pin itself.
   */
  function handleHomeMarkerPress() {
    if (!home) return;
    Haptics.selectionAsync().catch(() => {});
    mapRef.current?.animateToRegion(
      {
        latitude: home.latitude,
        longitude: home.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      400,
    );
  }

  /**
   * Tapping the trusted-friend pin opens an action sheet with Call /
   * Text (deep-linking the same way /pulled-over's Contact phase
   * does). Caller is the trusted-contact-setup picker's stored phone.
   * Native iOS Alert is the right register here — it matches the
   * mid-flow safety affordance without introducing a new sheet
   * component for a single decision point.
   */
  function handleTrustedFriendMarkerPress() {
    if (!trustedContact?.phoneNumber) return;
    Haptics.selectionAsync().catch(() => {});
    const name = trustedContact.name ?? 'your trusted contact';
    Alert.alert(
      name,
      `Reach ${name} now.`,
      [
        {
          text: 'Call',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            void Linking.openURL(`tel:${trustedContact.phoneNumber}`);
          },
        },
        {
          text: 'Text',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            void Linking.openURL(`sms:${trustedContact.phoneNumber}`);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  function handleConfirmPlacement() {
    if (!placementPin) return;
    setPlacingReport(false);
    router.push({
      pathname: '/report',
      params: {
        latitude: String(placementPin.latitude),
        longitude: String(placementPin.longitude),
      },
    });
    setPlacementPin(null);
  }

  function handleCancelPlacement() {
    setPlacingReport(false);
    setPlacementPin(null);
  }

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

      // Destination only comes from URL params (set by the search
      // screen). On first open / browse mode, no destination is set
      // — and we deliberately *don't* fetch routes in that case.
      // Previously we synthesized a NE-of-user destination as a demo
      // crutch; that produced a stray polyline pointing nowhere
      // every time the user landed on /home without having searched.
      const destination =
        params.destLat && params.destLng
          ? {
              latitude: parseFloat(params.destLat),
              longitude: parseFloat(params.destLng),
            }
          : null;

      // Fire fetches in parallel where applicable. Routes are skipped
      // entirely when there's no destination (rawRoutes stays []).
      // Zones still fetch — scoring needs them ready by the time a
      // user does search, and the overlay toggle can render them
      // immediately when flipped on.
      //
      // Net effect: route polyline appears immediately after OSRM
      // (often <1s) when a destination IS set; daylight gradient +
      // scoring refines a beat later when Overpass finishes. Browse
      // mode shows zero polylines on the map.
      const routePromise = destination
        ? getRoutesBetween(center, destination)
        : Promise.resolve([]);
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

  // Subscribe to live GPS for the custom UserLocationMarker. Permission
  // was negotiated by /permissions during onboarding; we ask again here
  // (cached → returns granted immediately, no re-prompt). Highest
  // accuracy + 1s/5m thresholds are conservative defaults that update
  // the dot smoothly without burning battery.
  useEffect(() => {
    let subscription: Location.LocationSubscription | undefined;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 5,
        },
        (pos) => {
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
      );
    })();
    return () => {
      subscription?.remove();
    };
  }, []);

  // Long-press on the map saves that location as the user's home.
  // Goes through Alert so the user confirms before persistence —
  // accidental long-presses on a navigation map shouldn't silently
  // overwrite a real saved home.
  function handleLongPress(e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    // Light impact when the long-press fires — confirms the gesture
    // registered before the Alert appears, same way iOS Maps thumps
    // when you long-press to drop a pin. Without it, the gesture
    // feels uncertain (did the press hold long enough?).
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
                  lineDashPattern={zoneDashPattern[zone.type]}
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
                  lineDashPattern={zoneDashPattern[zone.type]}
                />
              );
            }
            // OSM adapter never returns 'point' geometry — community
            // reports do, and they're rendered separately below.
            return null;
          })}
        {/*
          Community-report points — clustered at low zoom, individual
          LandmarkMarkers at high zoom. Off-viewport reports surface
          as EdgeIndicators in the overlay below. Tap opens the detail
          card. Cluster markers show a count badge.
        */}
        {clusteredReports.map((item) => {
          if (item.kind === 'cluster') {
            const { cluster } = item;
            if (mapRegion && !isPointInRegion(cluster.center, mapRegion)) {
              return null;
            }
            return (
              <Marker
                key={cluster.id}
                coordinate={cluster.center}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                accessibilityLabel={`${cluster.count} community reports nearby — tap to zoom in`}
                onPress={() => {
                  Haptics.selectionAsync();
                  const lats = cluster.zones.map((z) => z.coordinates[0].latitude);
                  const lngs = cluster.zones.map((z) => z.coordinates[0].longitude);
                  const minLat = Math.min(...lats);
                  const maxLat = Math.max(...lats);
                  const minLng = Math.min(...lngs);
                  const maxLng = Math.max(...lngs);
                  mapRef.current?.animateToRegion(
                    {
                      latitude: (minLat + maxLat) / 2,
                      longitude: (minLng + maxLng) / 2,
                      latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.005),
                      longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.005),
                    },
                    400,
                  );
                }}
              >
                <View style={styles.clusterMarker}>
                  <Text style={styles.clusterCount}>{cluster.count}</Text>
                </View>
              </Marker>
            );
          }
          const { zone } = item;
          const point = zone.coordinates[0];
          if (mapRegion && !isPointInRegion(point, mapRegion)) {
            return null;
          }
          return (
            <LandmarkMarker
              key={zone.id}
              latitude={point.latitude}
              longitude={point.longitude}
              categoryId={zone.reportCategoryId}
              subTag={zone.reportSubTag}
              accessibilityLabel={zone.label}
              selected={selectedReport?.zoneId === zone.id}
              onPress={() =>
                setSelectedReport({
                  zoneId: zone.id,
                  categoryId: zone.reportCategoryId as ReportCategoryId,
                  detail: zone.reportDetail,
                  subTag: zone.reportSubTag,
                  timestamp: zone.reportTimestamp ?? Date.now(),
                })
              }
            />
          );
        })}
        {/* Placement pin — draggable marker for tap-then-drag report entry. */}
        {placingReport && placementPin && (
          <Marker
            coordinate={placementPin}
            draggable
            onDragEnd={(e) =>
              setPlacementPin({
                latitude: e.nativeEvent.coordinate.latitude,
                longitude: e.nativeEvent.coordinate.longitude,
              })
            }
            anchor={{ x: 0.5, y: 1 }}
            accessibilityLabel="Report location — drag to adjust"
          >
            <View style={styles.placementPin}>
              <Ionicons name="alert-circle" size={24} color={colors.orange} />
            </View>
          </Marker>
        )}
        {/*
          Saved home — green teardrop pin (positive variant) with the
          Figma house glyph. Matches the LandmarkMarker system; green
          preserves the "home as welcoming" association from the
          previous freshgreen MapMarker. Only visible when in the
          viewport; the EdgeIndicator overlay below handles the
          off-viewport case.
        */}
        {home &&
          (!mapRegion || isPointInRegion(home, mapRegion)) && (
            <LandmarkMarker
              latitude={home.latitude}
              longitude={home.longitude}
              categoryId="home"
              accessibilityLabel={`${home.name} (saved place) — tap to recenter`}
              onPress={handleHomeMarkerPress}
            />
          )}
        {/*
          Trusted Friend marker — green pin with a heart glyph,
          anchored to the contact's geocoded address (captured during
          the picker flow in /trusted-contact-setup). Hidden until a
          location is actually known; absent address = no marker, no
          fake placement.
        */}
        {trustedContact?.latitude != null &&
          trustedContact.longitude != null &&
          (!mapRegion ||
            isPointInRegion(
              {
                latitude: trustedContact.latitude,
                longitude: trustedContact.longitude,
              },
              mapRegion,
            )) && (
            <LandmarkMarker
              latitude={trustedContact.latitude}
              longitude={trustedContact.longitude}
              categoryId="trusted-friend"
              accessibilityLabel={`${trustedContact.name}'s ${trustedContact.addressLabel ?? 'home'} (trusted contact) — tap to call or text`}
              onPress={handleTrustedFriendMarkerPress}
            />
          )}
        {/*
          Destination pin — drops at the route endpoint when a
          destination is set via URL params. The route polyline alone
          doesn't visually anchor the trip's end; the pin reads as
          "this is where we're going" against busy map content.
        */}
        {params.destLat && params.destLng && (
          <DestinationMarker
            latitude={parseFloat(params.destLat)}
            longitude={parseFloat(params.destLng)}
            name={params.destName}
          />
        )}
        {/*
          OSRM-derived routes. Recommended renders as a daylight-
          gradient polyline; alternates render in muted gray. Always
          on the map's native overlay layer.
        */}
        {routePolylines}

        {/*
          Custom user-location dot — replaces showsUserLocation so it
          can sit above LandmarkMarker pins (zIndex=1000) when a
          report happens to land near the user's GPS. Renders only
          after the first watchPositionAsync fix.
        */}
        {userLocation && (
          <UserLocationMarker
            latitude={userLocation.latitude}
            longitude={userLocation.longitude}
          />
        )}
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
          {(() => {
            const offScreen = reportZones
              .filter(
                (z) =>
                  z.geometry === 'point' &&
                  z.coordinates.length > 0 &&
                  !isPointInRegion(z.coordinates[0], mapRegion),
              )
              .map((zone) => ({
                item: zone,
                edge: edgePositionForPoint(zone.coordinates[0], mapRegion, mapSize),
              }));
            const groups = groupEdgeIndicators(offScreen);
            return groups.map((group, i) => {
              const variant = variantForCategoryId(group.items[0].reportCategoryId);
              const first = group.items[0].coordinates[0];
              return (
                <EdgeIndicator
                  key={`edge-group-${i}`}
                  x={group.edge.x}
                  y={group.edge.y}
                  rotation={group.edge.rotation}
                  variant={variant}
                  count={group.items.length}
                  accessibilityLabel={
                    group.items.length === 1
                      ? `${group.items[0].label} (off-screen — tap to center)`
                      : `${group.items.length} reports nearby (off-screen — tap to zoom)`
                  }
                  onPress={() => {
                    if (group.items.length === 1) {
                      mapRef.current?.animateToRegion(
                        {
                          latitude: first.latitude,
                          longitude: first.longitude,
                          latitudeDelta: mapRegion.latitudeDelta,
                          longitudeDelta: mapRegion.longitudeDelta,
                        },
                        400,
                      );
                    } else {
                      const lats = group.items.map((z) => z.coordinates[0].latitude);
                      const lngs = group.items.map((z) => z.coordinates[0].longitude);
                      const minLat = Math.min(...lats);
                      const maxLat = Math.max(...lats);
                      const minLng = Math.min(...lngs);
                      const maxLng = Math.max(...lngs);
                      mapRef.current?.animateToRegion(
                        {
                          latitude: (minLat + maxLat) / 2,
                          longitude: (minLng + maxLng) / 2,
                          latitudeDelta: (maxLat - minLat) * 1.5 + 0.005,
                          longitudeDelta: (maxLng - minLng) * 1.5 + 0.005,
                        },
                        400,
                      );
                    }
                  }}
                />
              );
            });
          })()}
          {home && !isPointInRegion(home, mapRegion) && (
            (() => {
              const edge = edgePositionForPoint(home, mapRegion, mapSize);
              return (
                <EdgeIndicator
                  x={edge.x}
                  y={edge.y}
                  rotation={edge.rotation}
                  variant="positive"
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
                />
              );
            })()
          )}
          {trustedContact?.latitude != null &&
            trustedContact.longitude != null &&
            !isPointInRegion(
              {
                latitude: trustedContact.latitude,
                longitude: trustedContact.longitude,
              },
              mapRegion,
            ) &&
            (() => {
              const point = {
                latitude: trustedContact.latitude!,
                longitude: trustedContact.longitude!,
              };
              const edge = edgePositionForPoint(point, mapRegion, mapSize);
              return (
                <EdgeIndicator
                  x={edge.x}
                  y={edge.y}
                  rotation={edge.rotation}
                  variant="positive"
                  accessibilityLabel={`${trustedContact.name} (off-screen — tap to center)`}
                  onPress={() =>
                    mapRef.current?.animateToRegion(
                      {
                        ...point,
                        latitudeDelta: mapRegion.latitudeDelta,
                        longitudeDelta: mapRegion.longitudeDelta,
                      },
                      400,
                    )
                  }
                />
              );
            })()}
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
          {/*
            Menu hamburger — Figma 1133:13222 (56×56 white pill with
            inner 24×24 hamburger). `menu-glyph.svg` is the inner
            glyph only; FAB provides the matching pill + shadow so
            the chrome lives in one place and stays consistent with
            the Report button (also FAB size 56). Replaces the prior
            menu-home.svg which baked the full button chrome into a
            single SVG.
          */}
          <FloatingActionButton
            size="56"
            onPress={() => router.push('/menu')}
            accessibilityLabel="Menu"
          >
            <MenuGlyph width={24} height={24} />
          </FloatingActionButton>

          {/*
            Avatar button retired — it was redundant with the
            hamburger to its left (both opened /menu). The hamburger
            stays as the single Settings entry. The user's identity
            glyph (UserCar) lives on /menu's profile row, which is
            the surface where identity actually belongs.
          */}
        </View>
      </SafeAreaView>

      {/*
        Bottom sheet — two visual modes:
          - Route established (destination set): trip-context greeting,
            daylight strip, "About X min to Y", Schedule + Go.
            Figma node: 825:3635.
          - Browse mode (no destination yet): "Jordan's Local Recs",
            weather + driving conditions, "Things to Do: Black Owned"
            recommendation card. Figma node: 1133:13690.
        Single SafeAreaView shell + DragHandle wraps both — only the
        body content swaps based on `params.destLat`.
      */}
      <SafeAreaView
        style={styles.bottomSheet}
        edges={['bottom']}
        onLayout={(e) => setBottomSheetHeight(e.nativeEvent.layout.height)}
      >
        {!(params.destLat && params.destLng) ? (
          // Browse mode: the drag bar is interactive — tap or vertical
          // pan to toggle the recommendations section. Wider hit area
          // via vertical padding so the bar is comfortable to grab
          // mid-trip without aiming at a 4pt stripe.
          <View
            style={styles.dragHandleArea}
            accessibilityRole="button"
            accessibilityLabel={
              thingsToDoCollapsed
                ? 'Drag bar — drag up or tap to expand recommendations'
                : 'Drag bar — drag down or tap to collapse recommendations'
            }
            {...dragHandleResponder.panHandlers}
          >
            <DragHandle />
          </View>
        ) : (
          <DragHandle />
        )}

        {!(params.destLat && params.destLng) ? (
          <HomeBrowseSheet
            firstName={userFirstName}
            collapsed={thingsToDoCollapsed}
            onToggleCollapsed={() => setThingsToDoCollapsed((v) => !v)}
          />
        ) : (
          <>
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
                daylight progression across the day. Purely visual
                metadata; the bottom-sheet copy below already announces
                arrival context (estimated time + destination), so the
                strip is redundant for VoiceOver users — hide to keep
                the announcement order clean.
              */}
              <View
                style={styles.daylightStrip}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                accessibilityIgnoresInvertColors
              >
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

          {suggestedDeparture && (
            <View style={styles.tradeoffRow}>
              <Text style={styles.tradeoffCopy}>
                Heads up! You can leave in a bit and still make it on time with
                some added daylight on your route.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actionsRow}>
          {suggestedDeparture && (
            <Pressable
              style={({ pressed }) => [styles.scheduleBtn, pressed && pressedDim]}
              onPress={() => {
                // Schedule scaffolding for v1: confirm the user's intent
                // and tell them what'll happen. Real reminder wiring
                // (expo-notifications local reminder fired at the
                // suggested time) is a follow-up PR — it needs the
                // permission flow added to /permissions first.
                Haptics.selectionAsync();
                const timeLabel = formatTimeOfDay(suggestedDeparture);
                Alert.alert(
                  `Scheduled for ${timeLabel}`,
                  `We'll remind you when it's time to leave. For now, open the app at ${timeLabel} to start your trip with the extra daylight along your route.`,
                  [{ text: 'Got it' }],
                );
              }}
              accessibilityRole="button"
              accessibilityLabel={`Schedule trip for ${formatTimeOfDay(suggestedDeparture)} for better daylight`}
            >
              <Text style={styles.scheduleText}>
                Schedule for {formatTimeOfDay(suggestedDeparture)}
              </Text>
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [styles.goBtn, pressed && pressedDim]}
            onPress={() =>
              router.push({
                pathname: '/en-route',
                params: {
                  ...(params.destLat ? { destLat: params.destLat } : {}),
                  ...(params.destLng ? { destLng: params.destLng } : {}),
                  ...(params.destName ? { destName: params.destName } : {}),
                  // Prime /en-route with the recommended route's
                  // estimatedMinutes + distanceMeters so its ETA,
                  // duration, and mileage all render immediately on
                  // mount instead of waiting for /en-route's own
                  // OSRM fetch to resolve. /en-route still re-fetches
                  // and refines the values; this just removes the
                  // visible "—" placeholders during the network call.
                  ...(recommended
                    ? {
                        destEstMinutes: String(recommended.estimatedMinutes),
                        destDistanceMeters: String(recommended.distanceMeters),
                      }
                    : {}),
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
          </>
        )}
      </SafeAreaView>

      {/*
        Report button — floats 24pt above the bottom sheet's top edge.
        Tapping enters placement mode: a draggable marker appears at
        the user's location. Drag to refine, then Confirm to open
        /report with those coords.
      */}
      {bottomSheetHeight > 0 && !placingReport && (
        <FloatingActionButton
          size="56"
          onPress={handleReportButtonPress}
          accessibilityLabel="Report something — place a pin on the map"
          style={{
            position: 'absolute',
            right: 16,
            bottom: bottomSheetHeight + 24,
          }}
        >
          <SidebtnReport width={32} height={32} />
        </FloatingActionButton>
      )}

      {/* Placement mode controls — confirm / cancel bar at the bottom. */}
      {placingReport && (
        <SafeAreaView
          style={styles.placementBar}
          edges={['bottom']}
          pointerEvents="box-none"
        >
          <View style={styles.placementBarInner}>
            <Text style={styles.placementHint}>
              Drag the pin to the report location
            </Text>
            <View style={styles.placementActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.placementCancel,
                  pressed && pressedDim,
                ]}
                onPress={handleCancelPlacement}
                accessibilityRole="button"
                accessibilityLabel="Cancel report placement"
              >
                <X size={20} color={colors.labelSecondary} weight="bold" />
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.placementConfirm,
                  pressed && pressedDim,
                ]}
                onPress={handleConfirmPlacement}
                accessibilityRole="button"
                accessibilityLabel="Confirm report location"
              >
                <Text style={styles.placementConfirmText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      )}

      {/* Report detail card — appears when tapping an on-map marker. */}
      {selectedReport && (
        <ReportDetailCard
          categoryId={selectedReport.categoryId}
          detail={selectedReport.detail}
          subTag={selectedReport.subTag}
          timestamp={selectedReport.timestamp}
          onDismiss={() => setSelectedReport(null)}
        />
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
  dragHandleArea: {
    // Wraps the 4pt DragHandle bar with vertical padding so the
    // touchable region is ~40pt tall — comfortable to grab mid-drive.
    // The DragHandle itself stays visually 4pt; this only expands
    // the gesture's hit area.
    paddingVertical: 16,
    alignItems: 'center',
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
  // menuButton + avatarButton style blocks retired — both consume
  // the FloatingActionButton component now (size="48").
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
  // --- Cluster marker ---
  clusterMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.orange,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  clusterCount: {
    ...typography.footnoteEmphasized,
    color: colors.white,
  } as const,
  // --- Placement mode ---
  placementPin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.orange,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  placementBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  placementBarInner: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  placementHint: {
    ...typography.subheadlineRegular,
    color: colors.mutedSecondary,
    textAlign: 'center',
  } as const,
  placementActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  placementCancel: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.systemGroupedBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placementConfirm: {
    flex: 1,
    height: 44,
    borderRadius: 100,
    backgroundColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  placementConfirmText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
  } as const,
});
