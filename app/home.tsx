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
import { AccessibilityInfo, Alert, Animated, Dimensions, Easing, LayoutAnimation, Linking, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArrowRight } from 'phosphor-react-native/src/icons/ArrowRight';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { PathIcon } from 'phosphor-react-native/src/icons/Path';
import { WarningDiamond } from 'phosphor-react-native/src/icons/WarningDiamond';
import { X } from 'phosphor-react-native/src/icons/X';
import DaylightMoon from '../assets/illustrations/daylight-moon.svg';
import DaylightSun from '../assets/illustrations/daylight-sun.svg';
import PlacementPin from '../assets/illustrations/drag-and-drop.svg';
import MenuGlyph from '../assets/illustrations/menu-glyph.svg';
import SidebtnRecenter from '../assets/illustrations/sidebtn-recenter.svg';
import SidebtnReport from '../assets/illustrations/sidebtn-report.svg';

import { ClusterMarker } from '../components/ClusterMarker';
import { DestinationMarker } from '../components/DestinationMarker';
import { DragHandle } from '../components/DragHandle';
import { EdgeIndicator } from '../components/EdgeIndicator';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { HomeBrowseSheet } from '../components/HomeBrowseSheet';
import { LandmarkMarker, variantForCategoryId } from '../components/LandmarkMarker';
import { LiveSafetySheet } from '../components/LiveSafetySheet';
import { ReportDetailCard } from '../components/ReportDetailCard';
import { LoadingState } from '../components/StateCard';
import { SearchBar } from '../components/SearchBar';
import { UserLocationMarker } from '../components/UserLocationMarker';
import { usePreferences } from '../hooks/usePreferences';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useRegularDestinations } from '../hooks/useRegularDestinations';
import { useSavedPlaces } from '../hooks/useSavedPlaces';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { useUser } from '../hooks/useUser';
import { useWeather } from '../hooks/useWeather';
import {
  getCommunityReportsAsZones,
  removeCommunityReport,
  type ReportCategoryId,
} from '../lib/api/community-reports';
import {
  DEFAULT_PREFERENCES,
  isZoneCategoryEnabled,
} from '../lib/api/preferences';
import { isRegularLocation } from '../lib/api/regular-destinations';
import {
  getRoutesBetween,
  primaryRoadName,
  type Route,
  type RouteSource,
  routeColors,
} from '../lib/api/routes';
import {
  getZonesForRegion,
  type Coordinate,
  type Zone,
  zoneColors,
  zoneDashPattern,
} from '../lib/api/zones';
import { clusterPointZones } from '../lib/clustering';
import {
  arrivalLightLabel,
  cloudDesaturate,
  DAYLIGHT_DASH_PATTERN,
  gradientSegments,
  suggestedDepartureForDaylight,
} from '../lib/daylight';
import { formatDistance, formatDuration, formatTimeOfDay } from '../lib/format';
import { scheduleDepartureNotification } from '../lib/notifications';
import {
  edgePositionForPoint,
  groupEdgeIndicators,
  isPointInRegion,
  type Region,
} from '../lib/edge-indicators';
import { isPointInZone, pickWinner } from '../lib/scoring';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { mapStyle } from '../theme/map-style';
import { shadows } from '../theme/shadows';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
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
  // Browse-mode "Things to Do" section starts COLLAPSED. An earlier
  // default of expanded surfaced the thesis claim immediately
  // ("community knowledge is the backbone" via the recommendations
  // row), but on app entry it dominated the screen — the carousel
  // + eyebrow + chips combine to ~360pt before the map shows. Users
  // need to see the map first to orient themselves; the chevron
  // lets them opt into recommendations when ready. Validated on
  // device — the expanded default didn't give users a chance to
  // explore.
  const [thingsToDoCollapsed, setThingsToDoCollapsed] = useState(true);
  // Neighborhood label for the browse-mode sheet header. Derived
  // from a one-shot `Location.reverseGeocodeAsync` against the
  // user's first GPS fix. Picks `subregion + city` (most natural
  // for a neighborhood-level read) and falls back through `city +
  // region` → `region` until something resolves. Null while in
  // flight; HomeBrowseSheet renders "Your area" until it lands.
  // Re-runs only when userLocation transitions from null → set;
  // we deliberately don't refetch on every GPS tick (the label
  // doesn't need real-time precision).
  const [neighborhoodLabel, setNeighborhoodLabel] = useState<string | undefined>();
  // showZones is `false` while preferences are loading from AsyncStorage;
  // overlays just render on the next pass once the value resolves.
  const showZones = preferences?.showZones ?? false;
  const mapRef = useRef<MapView>(null);
  // Tracks the current visible region so we can decide whether each POI
  // needs a Marker (in viewport) or an EdgeIndicator (out of viewport).
  // Updated on `onRegionChangeComplete`; null until the user's first
  // pan/zoom or the centering effect fires.
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  // Hide the zone overlay once the map is zoomed out past ~city scale.
  // Beyond this a neighborhood zone polygon shrinks below ~2pt and reads
  // as a stray red/green/yellow "pin" rather than an area (the
  // red-zone-looks-like-a-pin report). The zone DATA still feeds scoring
  // regardless of overlay visibility — this gates rendering only.
  // ~0.5° latitude ≈ a 35mi-tall region; below that zones read as areas.
  const ZONE_OVERLAY_MAX_LAT_DELTA = 0.5;
  const zonesVisibleAtZoom =
    !mapRegion || mapRegion.latitudeDelta <= ZONE_OVERLAY_MAX_LAT_DELTA;
  // Live GPS for the custom UserLocationMarker (which replaces
  // showsUserLocation so it can sit above LandmarkMarker pins via
  // zIndex). Updated by the watchPositionAsync subscription below;
  // null until the first fix arrives.
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  // Weather — drives cloud-aware daylight strip, route gradient, and
  // conditions tail. `cloudCoverPct` is undefined until the first fix
  // and weather fetch resolve; all consumers accept `number | undefined`.
  const { weather } = useWeather(userLocation);
  const cloudCoverPct = weather?.cloudCoverPct;
  // One-shot guard: animate the map to the user's first GPS fix.
  // Without this, `initialRegion` (Mobile, AL) stays parked on the
  // viewport until the user does something that calls
  // animateToRegion (set a destination, tap Recenter, etc) — cold
  // start reads as "wrong city, app is broken" for users far from
  // Mobile. Flips true after the first animation so subsequent GPS
  // updates don't yank the map around (Recenter is the canonical
  // user-initiated re-centering).
  const hasAnimatedToInitialFixRef = useRef(false);
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
  // user has never been. C12c: now a real signal — true when the
  // current destination is within ~200m of a destination the user
  // marked "regular" from a post-trip summary (regular-destinations
  // store). Closes the loop the long-standing TODO described.
  const { regulars, markRegular, unmarkRegular } = useRegularDestinations();
  const isRegularDestination =
    !!params.destLat &&
    !!params.destLng &&
    isRegularLocation(
      parseFloat(params.destLat),
      parseFloat(params.destLng),
      regulars,
    );
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
  // Route fetch state for the bottom-sheet preview. `isCalculatingRoute`
  // is true between fetch-start and fetch-resolve so the preview can
  // render a "Calculating route…" indicator instead of looking broken
  // on slow networks / long routes. `routeFetchSource` distinguishes
  // "no route available" (transoceanic, unroutable) from "haven't
  // fetched yet" / "fetched and got routes" — UI uses it to render
  // distinct copy. Null until the first fetch resolves.
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeFetchSource, setRouteFetchSource] = useState<RouteSource | null>(null);
  // Measured bottom-sheet height. The Report button floats 24pt above
  // the sheet's top edge, so we need to know how tall the sheet is at
  // runtime (it grows with content). 0 until first layout pass — the
  // button stays unrendered until then to avoid a one-frame flash at
  // the wrong position.
  const [bottomSheetHeight, setBottomSheetHeight] = useState(0);
  // FAB anchor height — locked to the *collapsed* browse-sheet height
  // (or current sheet height in route mode, where there's no
  // expand/collapse concept). The Recenter/Report FABs anchor to this
  // instead of `bottomSheetHeight` so they DON'T push up when the
  // user expands the browse sheet — they stay parked and the
  // expanded sheet draws over them (Apple Maps / Google Maps pattern).
  // EdgeIndicator inset below still reads `bottomSheetHeight` so
  // off-screen markers stay visible when the sheet expands; the
  // marker chrome IS subject to "stay out of the sheet's way," the
  // FABs are not.
  const [fabAnchorHeight, setFabAnchorHeight] = useState(0);

  // --- Report placement mode (tap-to-move) ---
  // When true, a placement marker appears at the user's location.
  // Tap anywhere on the map to relocate it; Confirm opens /report
  // with the chosen coords; Cancel exits. Drag was tried (PanResponder
  // rewrite in #187) but reverted: combining a drag gesture with the
  // map's own pan recognizer made the interaction feel ambiguous, and
  // tap-to-move alone is already friction-free for the common case.
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
    placeName?: string;
    photoUri?: string;
    timestamp: number;
  } | null>(null);

  // Combined zone set fed to scoring. OSM + community reports flow
  // through the same pipeline — same Zone type, same scorer dispatch.
  // useMemo keeps the array reference stable across renders that don't
  // change either source.
  // Zones gated by the user's flag toggles (filtered per-source so the
  // overlay, scoring, counts, and report markers all respect the flags).
  const prefs = preferences ?? DEFAULT_PREFERENCES;
  const enabledOsmZones = useMemo(
    () => osmZones.filter((z) => isZoneCategoryEnabled(z.category, prefs)),
    [osmZones, prefs],
  );
  const enabledReportZones = useMemo(
    () => reportZones.filter((z) => isZoneCategoryEnabled(z.category, prefs)),
    [reportZones, prefs],
  );
  const enabledZones = useMemo(
    () => [...enabledOsmZones, ...enabledReportZones],
    [enabledOsmZones, enabledReportZones],
  );

  // Ranked routes are derived from raw routes + zones. Recomputes
  // whenever any source changes — including when reportZones updates
  // after a new community report lands. Replaces the previous
  // setRoutes(pickWinner(...)) call sites.
  const routes = useMemo(
    () => pickWinner(rawRoutes, enabledZones),
    [rawRoutes, enabledZones],
  );

  // Recommended route is the one we explain in the bottom sheet. May be
  // undefined briefly on first render before the fetch completes.
  const recommended = routes.find((route) => route.type === 'recommended');

  // The primary road the recommended route travels (longest named
  // step). This is what the "Via" line should surface — the main road
  // you take to get there — NOT the destination, which already sits in
  // the search bar above. Null when the source returned step-less or
  // unnamed geometry (mock routes, some OSRM responses).
  const viaRoad = primaryRoadName(recommended?.steps);

  // Arrival clock time = now + ETA. Distance from the route (m → mi).
  const arrivalTime =
    recommended != null
      ? formatTimeOfDay(new Date(Date.now() + recommended.estimatedMinutes * 60_000))
      : null;
  const METERS_PER_MILE = 1609.34;
  const distanceLabel =
    recommended?.distanceMeters != null
      ? formatDistance(recommended.distanceMeters / METERS_PER_MILE)
      : null;
  // Arrival daylight band = the last gradient segment's band (≈ destination).
  // Sighted users also read this via the daylight strip's sun/moon glyphs +
  // the polyline gradient; the strip is accessibilityElementsHidden, so the
  // arrival context is folded into the conditions caption's a11y label below.
  const arrivalSegs = recommended ? gradientSegments(recommended) : [];
  const arrivalBand = arrivalSegs.length
    ? arrivalSegs[arrivalSegs.length - 1].band
    : null;
  const arrivalLabel = arrivalBand ? arrivalLightLabel(arrivalBand, cloudCoverPct) : null;

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
          return gradientSegments(route, undefined, cloudCoverPct).map((segment, idx) => (
            <Polyline
              key={`${route.id}-seg-${idx}`}
              coordinates={segment.coordinates}
              strokeColor={segment.color}
              strokeWidth={routeColors.recommended.width}
              // WCAG 1.4.1 non-color cue: pair the daylight color
              // gradient with a dash pattern so day/twilight/night
              // reads through deuteranopia/tritanopia/monochromacy.
              // Solid = day, medium dashes = twilight, short dashes
              // = night. The bottom-sheet daylight legend has the
              // same color anchors so the polyline + legend tell
              // the same story two ways.
              lineDashPattern={DAYLIGHT_DASH_PATTERN[segment.band]}
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
    [routes, cloudCoverPct],
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
  const reduceMotion = useReduceMotion();
  const dragHandleResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
        onPanResponderRelease: (_, g) => {
          // Skip the height-snap animation when the user has Reduce
          // Motion on. The collapsed-state change still happens; only
          // the transition is suppressed.
          if (!reduceMotion) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          }
          if (g.dy > 20) {
            setThingsToDoCollapsed(true);
          } else if (g.dy < -20) {
            setThingsToDoCollapsed(false);
          } else {
            setThingsToDoCollapsed((v) => !v);
          }
        },
      }),
    [reduceMotion],
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

  // Route-preview zone-warning chip counts per Figma 1109:3264. Two
  // categories surface on the departure card: "police zones" (any
  // zone tagged `category: 'police'`) and "low light zones" (zones
  // tagged `category: 'lighting'` AND `type: 'avoid'` — per the
  // lib/api/zones.ts comment, `lit=no` maps to type=avoid). A zone
  // counts as "on the route" if any waypoint along the recommended
  // polyline falls inside it (uses `isPointInZone` which already
  // handles polygon/polyline/point geometry with the project's
  // standard proximity thresholds).
  //
  // Recomputes only when the recommended route or enabledZones change —
  // not on every pan/zoom (mapRegion is intentionally not a dep).
  // For sparse polylines this could miss a zone that crosses the
  // route between waypoints; OSRM's geometry is dense enough at the
  // city scale that this is acceptable for v1.
  const routeZoneCounts = useMemo(() => {
    if (!recommended) return { police: 0, lowLight: 0 };
    let police = 0;
    let lowLight = 0;
    for (const zone of enabledZones) {
      if (zone.category !== 'police' && zone.category !== 'lighting') continue;
      if (zone.category === 'lighting' && zone.type !== 'avoid') continue;
      const hit = recommended.coordinates.some((coord) =>
        isPointInZone(coord, zone),
      );
      if (!hit) continue;
      if (zone.category === 'police') police += 1;
      else lowLight += 1;
    }
    return { police, lowLight };
  }, [recommended, enabledZones]);

  // Route-preview headline reveal — fire a single light haptic + a
  // 240ms opacity fade on the "{N} min" text the first time a given
  // destination's route resolves. The em-dash → minutes transition
  // is the most important moment on the card and previously had no
  // entrance. Keyed on destination+minutes so it doesn't refire on
  // every re-render. Reduce Motion → skip the fade, fire the haptic
  // (the haptic doesn't depend on motion).
  const minutesOpacity = useRef(new Animated.Value(1)).current;
  const lastMinutesRevealKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!recommended || !params.destLat || !params.destLng) return;
    const key = `${params.destLat}|${params.destLng}|${recommended.estimatedMinutes}`;
    if (lastMinutesRevealKeyRef.current === key) return;
    const isFirstReveal = lastMinutesRevealKeyRef.current === null;
    lastMinutesRevealKeyRef.current = key;
    Haptics.selectionAsync().catch(() => {});
    // Skip the fade on the very first reveal — without this, the
    // card briefly renders the "—" placeholder, fades to "12 min",
    // then the user sees the entrance. Better entrance is just
    // "appears" on first paint; subsequent route-changes get the
    // fade as a "we recalculated" cue.
    if (!isFirstReveal && !reduceMotion) {
      minutesOpacity.setValue(0);
      Animated.timing(minutesOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [recommended, params.destLat, params.destLng, reduceMotion, minutesOpacity]);

  // Clustered report markers — groups nearby points at low zoom to
  // prevent overlapping pins in dense neighborhoods. Recomputes on
  // every pan/zoom (mapRegion change) and when reports update.
  const clusteredReports = useMemo(() => {
    if (!mapRegion || !mapSize) return [];
    return clusterPointZones(enabledReportZones, mapRegion, mapSize.width, mapSize.height);
  }, [enabledReportZones, mapRegion, mapSize]);

  /**
   * Toggle the current destination in/out of the regular-destinations
   * store. Triggered by the star/bookmark control on the route-preview
   * card (rendered in A4). Uses distinct haptic feedback so marking
   * feels rewarding (success) and unmarking feels neutral (selection).
   */
  function handleToggleRegular() {
    if (!params.destLat || !params.destLng) return;
    const lat = parseFloat(params.destLat);
    const lng = parseFloat(params.destLng);
    if (isRegularDestination) {
      Haptics.selectionAsync().catch(() => {});
      void unmarkRegular(lat, lng);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void markRegular({ name: params.destName ?? 'Destination', latitude: lat, longitude: lng });
    }
  }

  /**
   * Recenter the map on the user's current location. Standard nav-app
   * affordance — useful after the user has panned the map away. Uses
   * `animateToRegion` (flat 2D view) at the same delta as the initial
   * centering, so the post-tap framing matches the screen's default
   * "you just opened the app" state.
   */
  function handleRecenter() {
    if (!userLocation) return;
    Haptics.selectionAsync().catch(() => {});
    mapRef.current?.animateToRegion(
      {
        ...userLocation,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      400,
    );
  }

  function handleReportButtonPress() {
    if (!userLocation) return;
    // Clear any open report detail card so it doesn't linger behind
    // the placement confirm bar during the placement flow.
    setSelectedReport(null);
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
    // Inert during placement mode — taps that visually land on map
    // markers should fall through to handleMapPress so the placement
    // pin relocates, not open recenter/detail surfaces.
    if (placingReport) return;
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
    if (placingReport) return;
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
    // Immediate visual: clear the route polylines if there's no
    // destination, BEFORE we await any I/O below. Pairs with the
    // camera-animation skip further down so the X tap gives instant
    // feedback (no ~1s perceived delay while we re-do location
    // permission + GPS fetch + re-center).
    if (!params.destLat || !params.destLng) {
      setRawRoutes([]);
      setRouteFetchSource(null);
      setIsCalculatingRoute(false);
    } else {
      // Mark calculating BEFORE awaiting permission/GPS so the route-
      // preview bottom sheet shows LoadingState immediately on
      // destination change (rather than displaying stale "—" headline
      // for the ~1s permission + GPS resolution window). Cleared in
      // the fetch resolve below.
      setIsCalculatingRoute(true);
    }

    let cancelled = false;

    async function fetchAndCenterOnUser() {
      // try/finally ensures isCalculatingRoute clears on ALL exit paths
      // — including permission denial, GPS error, or any uncaught throw.
      // Without this, an entry with destination set but permission
      // denied (or a thrown getCurrentPositionAsync) would leave the
      // bottom sheet stuck on "Calculating route…" indefinitely.
      try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled || status !== 'granted') return;

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

      const location = await Location.getCurrentPositionAsync({});
      if (cancelled) return;

      const center = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      // Only animate the camera when a destination is set — re-running
      // this effect on destination CLEAR (X tap) shouldn't yank the
      // user's map back to their location. That 1000ms re-center was
      // the perceived delay between "tapped X" and "map looks right."
      if (destination) {
        mapRef.current?.animateToRegion(
          { ...center, latitudeDelta: 0.02, longitudeDelta: 0.02 },
          1000,
        );
      }

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
        ? // 'preview' detail (A20): /home only renders a route-preview
          // line + ETA, never turn-by-turn. On long routes this drops
          // steps and fetches a coarse overview so the preview doesn't
          // freeze the JS thread parsing + scoring thousands of points.
          getRoutesBetween(center, destination, { detail: 'preview' })
        : Promise.resolve({ routes: [] as Route[], source: 'mapbox' as const });
      const zonePromise = getZonesForRegion(center);

      const fetchedResult = await routePromise;
      if (cancelled) return;
      // Routes appear immediately with whatever zones we already have
      // (likely community reports from useFocusEffect, possibly empty).
      // The useMemo handles re-ranking when osmZones lands a moment
      // later — no second setRoutes needed.
      //
      // /home's polyline renders the same regardless of source 'mapbox'
      // vs 'osrm' vs 'cache' vs 'mock' — the offline UX surfaces on
      // /en-route. But 'no-route' IS load-bearing here: when the engine
      // says the destination is unroutable, we render distinct empty-
      // state copy instead of a "—" headline. The routeFetchSource
      // state below drives that branch in the JSX.
      //
      // Pre-warming the cache happens inside getRoutesBetween itself
      // (every successful network fetch writes to AsyncStorage), so
      // this /home route-preview call IS what populates the cache for
      // the future /en-route mount if the user drives into dead signal.
      setRawRoutes(fetchedResult.routes);
      setRouteFetchSource(fetchedResult.source);
      setIsCalculatingRoute(false);

      if (fetchedResult.routes.length > 0) {
        const best = fetchedResult.routes[0];
        AccessibilityInfo.announceForAccessibility(
          `Route loaded, ${formatDuration(best.estimatedMinutes)} to ${params.destName ?? 'your destination'}.`,
        );
      } else if (fetchedResult.source === 'no-route') {
        AccessibilityInfo.announceForAccessibility(
          `No route available to ${params.destName ?? 'your destination'}.`,
        );
      }

      const fetchedZones = await zonePromise;
      if (cancelled) return;
      setOsmZones(fetchedZones);
      } catch (err) {
        console.warn('[home] fetchAndCenterOnUser failed:', err);
      } finally {
        // Clear calc state on any exit. Guarded against the unmount
        // race so a post-cancel setState doesn't fire on a stale
        // component. The success path also calls setIsCalculatingRoute(false)
        // before this finally — idempotent.
        if (!cancelled) setIsCalculatingRoute(false);
      }
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

  // One-shot reverse-geocode for the browse-sheet neighborhood label.
  // Fires the first time userLocation transitions from null → set;
  // skipped on subsequent GPS ticks because the label doesn't need
  // real-time precision (the user isn't crossing neighborhood
  // boundaries every second of every drive).
  //
  // Format priority: `subregion + city` → `city + region` →
  // `region`. Subregion in Expo's reverse-geocode response often
  // resolves to a neighborhood name in dense cities (e.g.
  // "Williamsburg, Brooklyn"); city + region is the standard
  // fallback ("Brooklyn, NY"); region alone is the last resort if
  // the geocoder only got that far.
  useEffect(() => {
    if (!userLocation || neighborhoodLabel) return;
    let cancelled = false;
    (async () => {
      try {
        const results = await Location.reverseGeocodeAsync(userLocation);
        if (cancelled) return;
        const place = results[0];
        if (!place) return;
        const label =
          place.subregion && place.city
            ? `${place.subregion}, ${place.city}`
            : place.city && place.region
              ? `${place.city}, ${place.region}`
              : place.region ?? null;
        if (label) setNeighborhoodLabel(label);
      } catch {
        // Geocoder failures soft-fail — HomeBrowseSheet renders its
        // generic "Your area" fallback. Not a degraded experience
        // worth surfacing.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userLocation, neighborhoodLabel]);

  // Cold-start centering: animate to the user's first GPS fix exactly
  // once. The Mobile, AL `initialRegion` is a build-time default; for
  // any user not in Mobile it reads as "wrong city" until something
  // else triggers a re-center. Fires only on the first non-null
  // userLocation so subsequent GPS updates don't disrupt the user's
  // own pan/zoom. reduceMotion → instant pan (0ms) for vestibular-
  // sensitive users, matching the gating pattern used elsewhere in
  // this file.
  useEffect(() => {
    if (!userLocation || hasAnimatedToInitialFixRef.current) return;
    hasAnimatedToInitialFixRef.current = true;
    mapRef.current?.animateToRegion(
      {
        ...userLocation,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      reduceMotion ? 0 : 1000,
    );
  }, [userLocation, reduceMotion]);

  function handleLongPress(e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) {
    if (placingReport) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;

    // Check if the long-press landed on an author-owned community
    // report marker. MapView.onLongPress fires even when the finger
    // is over a Marker, so we convert the marker's visual radius to
    // degrees at the current zoom and hit-test each report point.
    if (mapRegion && mapSize && mapSize.width > 0) {
      const degPerPxLat = mapRegion.latitudeDelta / mapSize.height;
      const degPerPxLng = mapRegion.longitudeDelta / mapSize.width;
      const hitLat = degPerPxLat * 30;
      const hitLng = degPerPxLng * 30;

      const hit = enabledReportZones
        .filter((z) => {
          if (z.geometry !== 'point' || z.reportSubmittedBy !== user?.id) return false;
          const pt = z.coordinates[0];
          return Math.abs(pt.latitude - latitude) < hitLat && Math.abs(pt.longitude - longitude) < hitLng;
        })
        .sort((a, b) => {
          const da = Math.abs(a.coordinates[0].latitude - latitude) + Math.abs(a.coordinates[0].longitude - longitude);
          const db = Math.abs(b.coordinates[0].latitude - latitude) + Math.abs(b.coordinates[0].longitude - longitude);
          return da - db;
        })[0];

      if (hit) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        Alert.alert(
          'Remove report?',
          'This will remove your community report from the map.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: async () => {
                try {
                  await removeCommunityReport(hit.id);
                  const refreshed = await getCommunityReportsAsZones();
                  setReportZones(refreshed);
                } catch {
                  Alert.alert('Could not remove', 'Please try again.');
                }
                if (selectedReport?.zoneId === hit.id) setSelectedReport(null);
              },
            },
          ],
        );
        return;
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // First-home flag captured *before* the Alert so the post-confirm
    // path can tell a milestone save (first home, ever) apart from a
    // re-save / update. Button label, success-notification haptic, and
    // camera settle only fire on the milestone — re-saves stay quiet,
    // and the button reads "Update home" so the user isn't promised
    // milestone feedback they won't get.
    const wasFirstHome = home == null;
    Alert.alert(
      'Save as home',
      'Add this location to your saved places? Your home appears on the map and as an off-screen indicator when you pan away.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: wasFirstHome ? 'Make it home' : 'Update home',
          onPress: () => {
            void addSavedPlace({ kind: 'home', name: 'Home', latitude, longitude });
            // Re-check `home` at confirm time — defense in depth
            // against a hypothetical concurrent save (no current path
            // creates one, but the snapshot is cheap to harden).
            if (wasFirstHome && home == null) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              // Re-center on the new home so the just-dropped pin
              // is unambiguously visible. Reduce-Motion path uses
              // duration=0 so the camera still lands on the pin
              // (the "where did it land?" question still matters)
              // but the animation itself is skipped.
              mapRef.current?.animateToRegion(
                { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
                reduceMotion ? 0 : 600,
              );
            }
          },
        },
      ],
    );
  }

  /**
   * Tap-to-move for the report placement pin. While placing a report,
   * any tap on the map (including taps that visually land on the pin
   * itself — the Marker is `tappable={false}` so they fall through)
   * relocates the pin to the tap location.
   *
   * Outside of placement mode the handler is a no-op — taps in
   * normal browse mode shouldn't accidentally move anything.
   */
  function handleMapPress(e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) {
    if (!placingReport) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    Haptics.selectionAsync().catch(() => {});
    setPlacementPin({ latitude, longitude });
  }

  // Refresh community reports each time /home gains focus. Two paths
  // hit this: initial mount (when navigating in from any prior screen)
  // and the dismissal of /report after a successful submission. The
  // second path is what makes a freshly-submitted report appear on the
  // map within a frame of the user closing the modal.
  // Ticks every time /home regains focus. Threaded down to
  // HomeBrowseSheet so useRecommendationsBatch can re-read AsyncStorage
  // after the user submits a fresh report and returns here — without
  // this, the "Trusted by your community" row (and any per-category
  // row the report routes to) stays stale until the user crosses a
  // ~0.5mi geo-grid boundary (which is what currently re-triggers
  // the hook via gridLat/gridLng deps). The map's report markers
  // refresh via setReportZones below, but the recommendations rows
  // read from their own hook that doesn't share that signal.
  const [focusRefreshKey, setFocusRefreshKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const fetched = await getCommunityReportsAsZones();
        if (cancelled) return;
        setReportZones(fetched);
        setFocusRefreshKey((k) => k + 1);
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
        // Veteran-navigation basemap: hides POI clutter (other
        // restaurants, attractions, transit stations) so our own
        // curated/community pins read against a quieter background.
        // iOS honors mapType="mutedStandard"; Android reads the JSON.
        // See theme/map-style.ts for the dimming rules + rationale.
        customMapStyle={mapStyle}
        mapType="mutedStandard"
        showsMyLocationButton={false}
        showsPointsOfInterest={false}
        onRegionChangeComplete={setMapRegion}
        onLayout={(e) =>
          setMapSize({
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
          })
        }
        onLongPress={handleLongPress}
        onPress={handleMapPress}
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
          "Show zones overlay" toggle in /menu's Zone Settings AND the
          map is zoomed in enough that zones read as areas (see
          `zonesVisibleAtZoom`). Default off; the zone data still drives
          scoring even when overlays are hidden.
        */}
        {showZones &&
          zonesVisibleAtZoom &&
          enabledOsmZones.map((zone) => {
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
              <ClusterMarker
                key={cluster.id}
                latitude={cluster.center.latitude}
                longitude={cluster.center.longitude}
                count={cluster.count}
                onPress={() => {
                  if (placingReport) return;
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
              />
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
              onPress={() => {
                if (placingReport) return;
                setSelectedReport({
                  zoneId: zone.id,
                  categoryId: zone.reportCategoryId as ReportCategoryId,
                  detail: zone.reportDetail,
                  subTag: zone.reportSubTag,
                  placeName: zone.reportPlaceName,
                  photoUri: zone.reportPhotoUri,
                  timestamp: zone.reportTimestamp ?? Date.now(),
                });
              }}
            />
          );
        })}
        {/*
          Placement pin — purely decorative. `tappable={false}` so a
          tap on the pin glyph itself falls through to the MapView's
          onPress (handleMapPress relocates the pin). Without that,
          the 48pt pin frame becomes a dead zone at the most likely
          re-tap location. `tracksViewChanges={false}` stops MapKit
          from re-snapshotting the static SVG every frame.
          Asset (still filed as drag-and-drop.svg for git blame
          continuity) is the single-pin variant from #187.
        */}
        {placingReport && placementPin && (
          <Marker
            coordinate={placementPin}
            anchor={{ x: 0.5, y: 1 }}
            tappable={false}
            tracksViewChanges={false}
            // role="none" — the pin is a coordinate indicator that
            // moves on map tap, not a labeled image. The
            // accessibilityLabel carries the semantic ("here, and
            // here's how to move it") without over-promising
            // image-content semantics.
            accessibilityRole="none"
            accessibilityLabel="Report location — tap the map to move"
          >
            <View style={styles.placementPinFrame}>
              <PlacementPin width={48} height={48} />
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
            // Pin-with-checkered-flag per Figma 1245:10977 ("Home
            // Destination"). The earlier round used the en-route
            // flag-on-pole here too for visual unity across the trip
            // lifecycle, but Figma actually calls for two distinct
            // registers: a stationary pin on /home (pre-departure
            // — "this is where we're going") and the flag-on-pole
            // mid-trip on /en-route ("you're racing toward this").
            // The checker pattern visually marries the two: same
            // semantic vocabulary, different shapes for each phase.
            variant="home"
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
      {mapRegion && mapSize && (() => {
        // Chrome-aware insets: edge markers shouldn't land under the
        // search bar / menu button stack (top), the Report/Recenter
        // FAB stack (right), or the bottom sheet. Bottom uses the
        // measured sheet height + a buffer that clears the FAB
        // stack above it.
        const chromeInsets = {
          top: 220,          // search bar (~70+56) + menu button (~56+12 gap) + buffer
          right: 88,         // FAB column right:16 + 56pt width + buffer
          bottom: (bottomSheetHeight || 0) + 64,
          left: 32,
        };
        return (
        <View style={styles.edgeOverlay} pointerEvents="box-none">
          {(() => {
            const offScreen = enabledReportZones
              .filter(
                (z) =>
                  z.geometry === 'point' &&
                  z.coordinates.length > 0 &&
                  !isPointInRegion(z.coordinates[0], mapRegion),
              )
              .map((zone) => ({
                item: zone,
                edge: edgePositionForPoint(zone.coordinates[0], mapRegion, mapSize, chromeInsets),
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
                  // Pass the category id of the first item so single-
                  // pin clusters render the correct per-category glyph
                  // (e.g. lighting → bulb, not the variant-default eye).
                  // Multi-pin clusters get the counter anyway, which
                  // overrides the glyph at render time.
                  categoryId={group.items[0].reportCategoryId}
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
              const edge = edgePositionForPoint(home, mapRegion, mapSize, chromeInsets);
              return (
                <EdgeIndicator
                  x={edge.x}
                  y={edge.y}
                  rotation={edge.rotation}
                  variant="positive"
                  categoryId="home"
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
              const edge = edgePositionForPoint(point, mapRegion, mapSize, chromeInsets);
              return (
                <EdgeIndicator
                  x={edge.x}
                  y={edge.y}
                  rotation={edge.rotation}
                  variant="positive"
                  categoryId="trusted-friend"
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
        );
      })()}

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
            // H2: size="56" → "48" per FloatingActionButton's docstring
            // (48 = /home top-row overlay; 56 = /en-route side column).
            // At 56 the menu FAB matched the search bar's 56pt height and
            // competed for chrome weight; at 48 it recedes so the search
            // bar dominates the top-row hierarchy.
            size="48"
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
      {/*
        Hide the browse/route sheet entirely while in placement mode
        so the user can tap anywhere on the map (including the
        bottom half) to move the pin. Without this the sheet's ~180pt
        collapsed footprint covers the lower map and creates a dead
        zone the user can't tap — and the sheet's zIndex:10 also
        paints over the placement bar even when the bar is the only
        thing meant to be visible. Conditional unmount is simpler
        than juggling zIndex per phase.

        Also hide while the ReportDetailCard is open — that card is
        ITSELF a bottom sheet (slides up, rounded top, same shadow
        depth). Stacking it on the browse sheet read as "two cards
        stacked," which is what the user saw and flagged. The
        ReportDetailCard owns the bottom-of-screen affordance while
        a report is selected.
      */}
      {!placingReport && !selectedReport && <SafeAreaView
        style={styles.bottomSheet}
        edges={['bottom']}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          setBottomSheetHeight(h);
          // Lock the FAB anchor to the collapsed sheet height in
          // browse mode (so FABs stay put while the sheet expands
          // over them); in route mode there's no collapse concept,
          // so always track.
          const isRouteMode = !!(params.destLat && params.destLng);
          if (isRouteMode || thingsToDoCollapsed) {
            setFabAnchorHeight(h);
          }
        }}
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
          // Browse-mode sheet. HomeBrowseSheet owns its own vertical
          // ScrollView (so its category chips can pin via
          // stickyHeaderIndices — that only works on a ScrollView's
          // direct JSX children, which this element can't be when it's
          // a lone component child of a ScrollView here). The sheet's
          // capped maxHeight bounds the scroller's `flex: 1`.
          <HomeBrowseSheet
            firstName={userFirstName}
            neighborhoodLabel={neighborhoodLabel}
            userLocation={userLocation}
            refreshKey={focusRefreshKey}
            collapsed={thingsToDoCollapsed}
            onToggleCollapsed={() => setThingsToDoCollapsed((v) => !v)}
            onSelectRecommendation={(rec) => {
              // Tapping a recommendation card routes to /home with
              // the destination params set, same way a search-result
              // tap does. router.replace (not push) so back-stack
              // stays clean — this is a destination CHANGE on
              // /home, not a new screen entry.
              router.replace({
                pathname: '/home',
                params: {
                  destLat: String(rec.latitude),
                  destLng: String(rec.longitude),
                  destName: rec.name,
                },
              });
            }}
            onEmptyTap={() => {
              // Empty-state CTA — taps route to the report flow
              // (same entry point as the Report FAB). Light haptic
              // marks the transition; the report flow's own success
              // notification handles the commit feedback.
              Haptics.selectionAsync().catch(() => {});
              router.push('/report');
            }}
          />
        ) : (
          <>
        {/*
          Route-preview card per Figma 1109:3264 ("Route (Default)").
          Layout top-to-bottom: "{N} min" headline (wiltedgreen) on the
          left + daylight strip on the right, "Via {street}" sub-row,
          conditions caption, zone-warning chips, then the actions row.
          The pre-Round-5 "Ready to face the day?" greeting is dropped
          from this state — Figma replaces it with the trip headline.

          Street-name extraction (real OSRM step data) is a follow-up.
          For now `params.destName` is used as the "Via" target — for
          most cases it's the destination POI name rather than the
          actual street, but the row reads naturally either way.

          Clear-destination X sits absolutely at the top-right of the
          card content. Figma doesn't show it in the actions row, but
          dropping the affordance entirely leaves no one-tap escape
          back to browse mode — search-bar + pick-new-dest is too
          many steps. Same fillsTertiary circular pattern as the
          recordings delete-confirm modal X.
        */}
        <View style={styles.bottomSheetContent}>
          {/*
            Clear-destination row — right-aligned 44pt X above the
            headline. Previously absolute-positioned, but the 44pt
            footprint overlapped the moon glyph at the right edge of
            the daylight strip. Dedicated row clears the conflict and
            gives the affordance explicit layout space.
          */}
          <View style={styles.routeTopRow}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                // router.replace with no params clears destLat/destLng/
                // destName from the URL; /home re-renders in browse mode.
                router.replace({ pathname: '/home', params: {} });
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear destination and return to browsing"
              style={({ pressed }) => [styles.routeClearBtn, pressed && pressedDim]}
            >
              <X size={16} color={colors.labelSecondary} weight="bold" />
            </Pressable>
          </View>

          {/*
            Route-preview body — three branches:
              1. Calculating — fetch in flight, no data yet. Render
                 LoadingState ("Calculating route…") so the user knows
                 work is happening, especially on long-route fetches
                 that can take a few seconds.
              2. No-route — Mapbox+OSRM both said the destination is
                 unroutable (transoceanic, road-network disconnect,
                 or beyond MAX_ROUTE_DISTANCE_MILES). Render EmptyState
                 with copy that prompts the user to pick something else.
              3. Default — route is loaded. Existing headline + via +
                 caption + chips render. The Clear-X above stays
                 mounted across all three branches so the user can
                 escape back to browse mode.
          */}
          {isCalculatingRoute ? (
            <LoadingState text="Calculating route…" style={styles.routePreviewState} />
          ) : routeFetchSource === 'no-route' ? (
            // A21 interim: render the no-route state inline on the
            // sheet's own white surface, mirroring the populated route-
            // preview card's left-aligned hierarchy (wiltedgreen
            // headline + labelTertiary supporting line + 24pt gutter)
            // instead of the generic gray EmptyState card. The bespoke
            // "road trailing off" illustration is queued in
            // docs/figma-mockup-queue.md; this uses the existing Path
            // glyph recolored to the brand accent in the meantime. The
            // wrapping View is the single a11y node (icon is decorative;
            // the label carries the meaning).
            <View
              style={styles.noRouteState}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`No route available. We couldn’t find a driving route to ${params.destName ?? 'your destination'}. Try a different destination.`}
            >
              <PathIcon size={40} color={colors.wiltedgreen} weight="duotone" />
              <View style={styles.noRouteText}>
                <Text style={styles.noRouteHeadline}>No route available</Text>
                <Text style={styles.noRouteBody}>
                  We couldn’t find a driving route to{' '}
                  {params.destName ?? 'your destination'}. Try a different
                  destination.
                </Text>
              </View>
            </View>
          ) : (
            <>
          {/*
            Trip-summary block — destination title, hero duration +
            arrival, and distance are ONE unit, so they sit in a tight
            4pt group rather than each taking the card's 16pt inter-row
            gap (which read airy/sparse when applied between these three
            closely-related lines).
          */}
          <View style={styles.routeSummaryBlock}>
          {/*
            Destination title — card title + tappable save-as-regular
            toggle. freshgreen underline (styles.destination) = saved regular.
          */}
          <Pressable
            onPress={handleToggleRegular}
            accessibilityRole="button"
            accessibilityLabel={`${params.destName ?? 'Destination'}. ${
              isRegularDestination ? 'Saved as a regular' : 'Tap to save as a regular'
            }.`}
            style={({ pressed }) => [styles.routeDestTitleHit, pressed && pressedDim]}
          >
            <Text
              style={[styles.routeDestTitle, isRegularDestination && styles.destination]}
              numberOfLines={1}
            >
              {params.destName ?? 'your destination'}
            </Text>
          </Pressable>

          {/*
            Hero row: "{N} min" headline + promoted arrival time.
            routeHeroRow owns the 24pt gutter so the old routeHeadlineRow
            wrapper (which also had paddingHorizontal: 24) is gone —
            the Animated.Text is moved directly inside here to avoid
            double-padding. The animated style array is preserved verbatim.
          */}
          <View style={styles.routeHeroRow}>
            <Animated.Text
              style={[styles.routeMinutes, { opacity: minutesOpacity }]}
              // S3 of PR E review: defensive numberOfLines at 34pt. The
              // current longest formatDuration output ("59 hr 59 min")
              // fits comfortably on SE (~200pt vs 272pt available), but
              // future copy expansion or localization shouldn't be able
              // to wrap the headline number to a second line and break
              // the card's vertical rhythm. Matches the H17 guard.
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {recommended ? formatDuration(recommended.estimatedMinutes) : '—'}
            </Animated.Text>
            {arrivalTime && <Text style={styles.routeArrival}>arrive {arrivalTime}</Text>}
          </View>
          {distanceLabel && <Text style={styles.routeDistance}>{distanceLabel}</Text>}
          </View>

          {/*
            Via + daylight share a row — both secondary context. The
            via label flexes to fill the left column, daylight strip
            anchors the right at its fixed 96pt width.

            "Via" surfaces the *main road* the recommended route takes
            (the longest named step), the Google/Waze convention — the
            destination already lives in the title above, so repeating
            it here is redundant. We fall back to the destination name
            only when the route source returned no named geometry
            (mock / step-less routes).

            Destination underline renders ONLY in that no-road fallback
            — i.e. only when the line genuinely shows the destination.
            A road name is never underlined.
          */}
          <View style={styles.routeViaRow}>
            <Text
              style={[
                styles.routeViaLabel,
                isRegularDestination && !viaRoad && styles.destination,
              ]}
              numberOfLines={1}
            >
              Via {viaRoad ?? params.destName ?? 'your destination'}
            </Text>
            {/*
              Daylight strip — paired with the via line per Figma.
              Hidden from accessibility tree (the conditions caption
              below carries the arrival context for VoiceOver).
            */}
            <View
              style={styles.daylightStripInline}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              accessibilityIgnoresInvertColors
            >
              <LinearGradient
                colors={[
                  cloudDesaturate(colors.daylightDawn, cloudCoverPct),
                  cloudDesaturate(colors.daylightDusk, cloudCoverPct),
                  cloudDesaturate(colors.daylightNight, cloudCoverPct),
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

          {/*
            Conditions caption — "Safest route…" framing is real (the
            recommended route IS the safest). arrivalLabel (day/dusk/dark)
            is promoted here so VoiceOver and sighted users both see the
            arrival-light context without relying on the decorative strip.
          */}
          <Text
            style={styles.routeConditionsCaption}
            accessibilityLabel={
              arrivalLabel || arrivalTime
                ? `Safest route. ${
                    arrivalLabel
                      ? arrivalLabel.charAt(0).toUpperCase() + arrivalLabel.slice(1)
                      : 'Arriving'
                  }${arrivalTime ? ` at ${arrivalTime}` : ''}.`
                : 'Safest route with current conditions.'
            }
          >
            {arrivalLabel ? `Safest route · ${arrivalLabel}.` : 'Safest route with current conditions.'}
          </Text>

          {recommended && enabledZones.length > 0 && (
            <View style={styles.routeChipsBlock}>
              {/*
                Two render paths:
                  - Warnings present → "Along this route:" header
                    + chips (orange WarningDiamond, briefing register).
                  - Warnings absent → All-clear chip alone, no header
                    ("Along this route: All clear" reads bureaucratic
                    for what should feel like a light exhale).
                The outer block is gated on enabledZones.length > 0 —
                without it the All-clear chip flashes during the OSM
                zone-fetch race, giving false reassurance before the
                zones have actually arrived.
              */}
              {routeZoneCounts.police > 0 || routeZoneCounts.lowLight > 0 ? (
                <>
                  <Text style={styles.routeChipsHeader}>Along this route:</Text>
                  <View
                    style={styles.routeChipsRow}
                    accessibilityLabel={[
                      routeZoneCounts.police > 0
                        ? `${routeZoneCounts.police} police ${routeZoneCounts.police === 1 ? 'zone' : 'zones'}`
                        : null,
                      routeZoneCounts.lowLight > 0
                        ? `${routeZoneCounts.lowLight} low-light ${routeZoneCounts.lowLight === 1 ? 'zone' : 'zones'}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' and ')
                      .concat(' along this route.')}
                  >
                    {routeZoneCounts.police > 0 && (
                      <RouteWarningChip
                        count={routeZoneCounts.police}
                        label={routeZoneCounts.police === 1 ? 'police zone' : 'police zones'}
                      />
                    )}
                    {routeZoneCounts.lowLight > 0 && (
                      <RouteWarningChip
                        count={routeZoneCounts.lowLight}
                        label={routeZoneCounts.lowLight === 1 ? 'low light zone' : 'low light zones'}
                      />
                    )}
                  </View>
                </>
              ) : (
                <View
                  style={styles.routeChipsRow}
                  accessibilityLabel="No reported zones along this route."
                >
                  <RouteAllClearChip />
                </View>
              )}
            </View>
          )}

          {suggestedDeparture && (
            <View style={styles.tradeoffRow}>
              <Text
                style={[
                  styles.tradeoffCopy,
                  dynamicType(relaxedLineHeight(typography.footnoteRegular)),
                ]}
              >
                Heads up! You can leave in a bit and still make it on time with
                some added daylight on your route.
              </Text>
            </View>
          )}
            </>
          )}
        </View>

        {/*
          Actions row — Schedule (outline wiltedgreen) on the left,
          Go (filled freshgreen) on the right per Figma 1109:3264.
          When suggestedDeparture is null, the Schedule slot collapses
          and Go takes the full width.

          Hidden during calculating and no-route states — no Go/Schedule
          target exists in those branches. Clear-X stays available
          above as the only escape.

          Clear-destination X was dropped from this row in the v2
          redesign. To return to browse mode, the user taps the search
          bar at the top and picks a different destination, or system-
          back out of /home. A floating X may return as a future polish
          PR if the loss of affordance bites in practice.
        */}
        {!isCalculatingRoute && routeFetchSource !== 'no-route' && (
        <View style={styles.actionsRow}>
          {suggestedDeparture && (
            <Pressable
              style={({ pressed }) => [styles.scheduleBtn, pressed && pressedDim]}
              onPress={async () => {
                Haptics.selectionAsync().catch(() => {});
                const timeLabel = formatTimeOfDay(suggestedDeparture);
                // Real local-notification scheduling via expo-notifications.
                // The helper requests permission inline on first use; result
                // shape lets us pick the right Alert per outcome.
                const result = await scheduleDepartureNotification(
                  suggestedDeparture,
                  params.destName,
                );
                if (result.ok) {
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                  ).catch(() => {});
                  Alert.alert(
                    `Scheduled for ${timeLabel}`,
                    `We'll send a heads-up at ${timeLabel} so you can leave when the daylight's right.`,
                    [{ text: 'Got it' }],
                  );
                } else if (result.reason === 'permission-denied') {
                  Alert.alert(
                    'Notification access needed',
                    'Allow Notifications in Settings to get a heads-up when it\'s time to leave. You can still leave at the suggested time manually.',
                  );
                } else if (result.reason === 'past-time') {
                  Alert.alert(
                    "Can't schedule that time",
                    "That moment has already passed. Try picking a new destination.",
                  );
                } else {
                  Alert.alert(
                    'Could not schedule',
                    'Please try again in a moment.',
                  );
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={`Schedule trip for ${formatTimeOfDay(suggestedDeparture)} for better daylight`}
            >
              {/*
                H17: numberOfLines + adjustsFontSizeToFit so "Schedule
                for 7:30 AM" (~130-135pt at 13pt) doesn't overflow on
                iPhone SE (per-button width ~120pt at 320pt viewport).
                accessibilityLabel above retains the full phrase.
              */}
              <Text
                style={styles.scheduleText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
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
            <ArrowRight size={24} color={colors.white} weight="bold" />
            <Text style={styles.goText}>Go</Text>
          </Pressable>
        </View>
        )}
          </>
        )}
      </SafeAreaView>}

      {/*
        Report button — floats 24pt above the bottom sheet's top edge.
        Tapping enters placement mode: a draggable marker appears at
        the user's location. Drag to refine, then Confirm to open
        /report with those coords.
      */}
      {fabAnchorHeight > 0 && !placingReport && (
        <>
          {/*
            Recenter button — stacked 12pt above the Report FAB on the
            right side. Same right-edge alignment so the two buttons
            read as a vertical stack of map-controls. Hidden when
            we're in placement mode (the Confirm/Cancel bar takes
            over) or before the bottom sheet has measured (so we
            don't paint at y=0 mid-mount).

            Anchored to `fabAnchorHeight` (locked at the collapsed
            sheet height) rather than the live `bottomSheetHeight`,
            so expanding the browse sheet covers the FABs instead of
            shoving them up — Apple Maps / Google Maps convention.
          */}
          {/*
            H6: Recenter renders unconditionally (matching Report's
            guard pattern: fabAnchorHeight > 0 && !placingReport handled
            at the outer fragment). Previously gated on userLocation,
            which meant the button popped into existence ~1-3s after
            mount when the first GPS fix arrived — and Report jumped
            up 68pt to make room. Apple Maps shows recenter immediately,
            just inert until GPS is known. `disabled={!userLocation}`
            threads VoiceOver's disabled state AND suppresses onPress;
            FloatingActionButton's pressedDim handles the visual.
          */}
          <FloatingActionButton
            size="56"
            disabled={!userLocation}
            onPress={handleRecenter}
            accessibilityLabel={
              userLocation
                ? 'Recenter map on your location'
                : 'Recenter map (waiting for location)'
            }
            style={{
              position: 'absolute',
              right: 16,
              bottom: fabAnchorHeight + 24 + 56 + 12,
            }}
          >
            <SidebtnRecenter width={32} height={32} />
          </FloatingActionButton>
          <FloatingActionButton
            size="56"
            onPress={handleReportButtonPress}
            accessibilityLabel="Report something — place a pin on the map"
            style={{
              position: 'absolute',
              right: 16,
              bottom: fabAnchorHeight + 24,
            }}
          >
            <SidebtnReport width={32} height={32} />
          </FloatingActionButton>
        </>
      )}

      {/* Placement mode controls — confirm / cancel bar at the bottom. */}
      {placingReport && (
        <SafeAreaView
          style={styles.placementBar}
          edges={['bottom']}
          pointerEvents="box-none"
        >
          <View style={styles.placementDragHandleWrap}>
            <DragHandle />
          </View>
          <View style={styles.placementBarInner}>
            {/*
              Subtle placement hint. Figma v2 (1109:8139) had dropped this
              on the theory the orange pin's visual affordance was
              self-evident — but live testing showed users didn't realize
              the pin moves on map-tap, so it's restored as quiet
              footnote copy (usability over the Figma call). Sits 16pt
              above the action row via placementBarInner's gap.
            */}
            <Text style={styles.placementHint}>
              Tap the map to move the pin. Drag to move around.
            </Text>
            <View style={styles.placementActions}>
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
            </View>
          </View>
        </SafeAreaView>
      )}

      {/* Report detail card — appears when tapping an on-map marker.
          Suppressed during placement mode so it doesn't sit behind
          the confirm bar (the marker onPress handlers are also gated,
          but this is the defensive render-level guard). */}
      {selectedReport && !placingReport && (
        <ReportDetailCard
          categoryId={selectedReport.categoryId}
          detail={selectedReport.detail}
          subTag={selectedReport.subTag}
          placeName={selectedReport.placeName}
          photoUri={selectedReport.photoUri}
          timestamp={selectedReport.timestamp}
          onDismiss={() => setSelectedReport(null)}
        />
      )}

      <LiveSafetySheet />
    </View>
  );
}

/**
 * Inline chip for the route-preview card's zone-warning row (Figma
 * 1109:3264). Each chip is a light pill with an orange WarningDiamond
 * icon on the left and a count-prefixed label on the right
 * ("1 police zone"). Rendered conditionally — chips never show with
 * count=0. The accessibilityLabel is provided at the row level (so
 * VoiceOver reads "1 police zone and 1 low-light zone along this
 * route" once, not per-chip).
 */
function RouteWarningChip({ count, label }: { count: number; label: string }) {
  return (
    <View style={styles.routeChip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* H4: 24pt → 16pt. Chip is ~40pt tall; a 24pt glyph filled 60%
          of the pill height and dominated the chip's tag-row register.
          16pt matches the topline-callout chip family's icon weight. */}
      <WarningDiamond size={16} color={colors.orange} weight="fill" />
      <Text style={styles.routeChipText}>
        {count} {label}
      </Text>
    </View>
  );
}

/**
 * Positive counterpart to RouteWarningChip. Renders when the route
 * has zero police/low-light intersections — the most reassuring
 * read on the route-preview card is "we checked and you're clear,"
 * and an absent chips row reads as "feature not loaded." Single
 * fadedgreen pill with a check glyph, same row position as the
 * warning chips so the slot stays consistent across route variants.
 */
function RouteAllClearChip() {
  return (
    <View style={styles.routeAllClearChip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* H4: 24pt → 16pt to match RouteWarningChip icon sizing. */}
      <Check size={16} color={colors.burntgreen} weight="bold" />
      <Text style={styles.routeAllClearText}>All clear</Text>
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
    paddingTop: 24,
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
    // zIndex above the Recenter/Report FABs so when the sheet
    // expands past their fixed anchor, it draws *over* them
    // (Apple Maps / Google Maps obscure-not-reflow pattern).
    zIndex: 10,
    // Cap the sheet at 85% of screen height so it never pushes
    // entirely off-screen on smaller devices (iPhone SE/mini). The
    // content area inside the sheet wraps in a vertical ScrollView
    // (browse mode only), so overflow becomes scrollable rather
    // than clipped — the user can scroll inside the sheet to reach
    // the bottom of a long card.
    maxHeight: Dimensions.get('window').height * 0.85,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 16,
    gap: 16,
    // Shadow points UP since the sheet floats above content from the
    // bottom edge — `shadows.sheet` bundles the directional offset.
    ...shadows.sheet,
  },
  bottomSheetContent: {
    // 24 → 16: with the redesigned route-preview card carrying more rows
    // (title / hero / distance / via / conditions / chips / actions), a
    // uniform 24pt between every row read as too much vertical air. 16pt
    // is the tighter section rhythm; the trip-summary rows cluster even
    // closer via routeSummaryBlock (4pt).
    gap: 16,
  },
  // Wraps the LoadingState card rendered inside the route-preview
  // bottom sheet during the calculating state. (The no-route state no
  // longer uses this — it renders inline via noRouteState below.)
  // Negative top margin pulls the card up toward the Clear-X row so
  // the card doesn't sit awkwardly low; alignSelf:center keeps the
  // fixed-width state card horizontally centered against the wider
  // sheet content padding.
  routePreviewState: {
    marginTop: -8,
    alignSelf: 'center',
  },
  // A21 interim no-route state. Mirrors the populated route-preview
  // card's vocabulary — 24pt left gutter, wiltedgreen headline,
  // labelTertiary supporting line, white sheet surface — so it reads
  // as part of the sheet rather than a borrowed gray EmptyState card.
  // Left-aligned (like the headline/via/caption stack), icon above the
  // text block.
  noRouteState: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 12,
    alignItems: 'flex-start',
  },
  noRouteText: {
    gap: 4,
  },
  noRouteHeadline: {
    // title3Emphasized (not the 34pt largeTitle of "12 min") — a
    // measured empty-state weight that won't shout or wrap, sharing
    // the populated headline's wiltedgreen accent.
    ...typography.title3Emphasized,
    color: colors.wiltedgreen,
  },
  noRouteBody: {
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
  },
  // (Browse-sheet scroller styles moved into HomeBrowseSheet, which
  // now owns its own ScrollView so the category chips can pin via
  // stickyHeaderIndices.)
  headers: {
    gap: 8,
  },
  // v1 route-preview styles removed in Round 5 (greeting / greetingRow
  // / daylightStrip / mainCopyRow / mainCopy / minutes). See git blame.
  // `destination` kept — new layout still uses it for the
  // recurring-destination underline.
  // --- Route-preview card (Figma 1109:3264) ---
  // Trip-summary group — title + hero (duration/arrival) + distance read
  // as one unit, so they cluster at 4pt instead of the card's 16pt
  // inter-row gap. Children keep their own 24pt horizontal gutter.
  routeSummaryBlock: {
    gap: 4,
  },
  // Wraps the destination-title Text so the tappable save-as-regular
  // affordance meets the 44pt painted floor — the 20pt title alone is
  // ~25pt tall, and .cursorrules forbids hitSlop as the compliance
  // mechanism for a standalone CTA. minHeight + center, not hitSlop.
  routeDestTitleHit: {
    minHeight: 44,
    justifyContent: 'center',
  },
  // Destination title — card title + tappable save-as-regular toggle.
  routeDestTitle: {
    ...typography.title3Emphasized,
    color: colors.black,
    paddingHorizontal: 24,
  },
  // Hero row: headline + arrival time on the same baseline.
  // Owns the 24pt gutter; the old routeHeadlineRow wrapper is gone.
  routeHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: 24,
  },
  // Arrival clock time — sits baseline-aligned with the duration headline.
  routeArrival: {
    ...typography.subheadlineRegular,
    color: colors.labelSecondary,
    paddingBottom: 6,
  },
  // Distance line below the hero row.
  routeDistance: {
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
    paddingHorizontal: 24,
  },
  routeMinutes: {
    // H12: title2Emphasized (22pt) → largeTitleEmphasized (34pt). The
    // "12 min" is the route card's anchor number — at 22pt it read
    // as a section header, not as the headline. Waze and Apple Maps
    // put their ETA in the 34-36pt range. The card already has a
    // type ladder beneath (footnote Via line, caption1 conditions)
    // so the 34pt headline doesn't crush anything.
    ...typography.largeTitleEmphasized,
    color: colors.wiltedgreen,
  },
  // Via + daylight strip share a row per Figma — both are secondary
  // context (street name + arrival-light forecast). Via flexes to
  // fill, daylight strip anchors right at its fixed 96pt width.
  routeViaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  daylightStripInline: {
    // Fixed 96pt right-column width per Figma. The width is shared
    // with the v1 standalone placement — only the parent row context
    // changed (now paired with via, not the headline).
    width: 96,
    gap: 4,
  },
  routeViaLabel: {
    ...typography.subheadlineRegular,
    color: colors.labelTertiary,
    // flex into the left column so the daylight strip on the right
    // gets its fixed 96pt while the via text takes whatever's left.
    flex: 1,
  },
  routeConditionsCaption: {
    // footnoteRegular (13pt) — bumped from caption1Regular (12pt) to
    // match the conditions tail's increased role: it now surfaces the
    // arrivalLabel ("arriving in daylight" etc.) that was previously
    // only in the VoiceOver a11y label.
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
    paddingHorizontal: 24,
  },
  routeChipsBlock: {
    gap: 8,
    // H16: lifted paddingHorizontal from each child (routeChipsHeader,
    // routeChipsRow) to the parent. Earlier pattern had each child
    // re-declare 24 independently — fragile coupling that would break
    // if a new chip type was added without copying the value.
    paddingHorizontal: 24,
  },
  routeChipsHeader: {
    // Briefing-framing header above the chips ("Along this route:")
    // — reframes the orange WarningDiamond chips from alarm to
    // informational, per the mobile-ux audit on PR B.
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
  },
  routeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // Clear-destination row — dedicated top slot so the 44pt X doesn't
  // overlap the daylight strip's moon glyph below. 24pt right gutter
  // matches the content-sheet padding so the X aligns to the same
  // vertical edge as the daylight strip + chip rows below.
  routeTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
  },
  // 44pt painted tap target per HIG, same fillsTertiary circular
  // treatment as the recordings delete-confirm modal X for visual
  // consistency across destructive-or-dismissal affordances.
  routeClearBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.fillsTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.orange,
    backgroundColor: colors.white,
  },
  routeChipText: {
    // Caption1/Emphasized per Figma 1109:3264 (12pt Medium 510 →
    // RN's 500 weight). Post-H4 the 16pt WarningDiamond + orange border
    // together carry chip recognizability; the text reads as count +
    // label at the smaller size without competing with the glyph for
    // emphasis.
    ...typography.caption1Emphasized,
    color: colors.black,
  },
  // Positive variant — the "we scanned, you're clear" chip. Same
  // pill shape as RouteWarningChip but in the safety-green register
  // (fadedgreen fill + burntgreen text/glyph) so the affordance
  // reads as affirmative rather than informational. No border —
  // the green fill carries the affordance on its own.
  routeAllClearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: colors.fadedgreen,
  },
  routeAllClearText: {
    // Match RouteWarningChip's caption1Emphasized so the two chip
    // variants read as a family — same row slot, same type register,
    // different palette for the binary watch/clear semantic.
    ...typography.caption1Emphasized,
    color: colors.burntgreen,
  },
  daylightBar: {
    height: 4,
    borderRadius: 100,
  },
  daylightIcons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  destination: {
    // freshgreen — underlined in-flow link, cursorrules explicitly names
    // freshgreen for this role ("primary CTA, in-flow links").
    color: colors.freshgreen,
    textDecorationLine: 'underline',
  },
  tradeoffRow: {
    // H13: 16 → 24 to match the route card's canonical gutter
    // (routeHeadlineRow, routeViaRow, routeConditionsCaption,
    // routeChipsHeader, routeChipsRow, routeTopRow all use 24).
    // Tradeoff copy was indenting 8pt shallower than everything
    // else — visible left-gutter misalignment.
    paddingHorizontal: 24,
  },
  tradeoffCopy: {
    ...typography.footnoteRegular,
    color: colors.mutedTertiary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 16,
    // H14: 16 → 24 to align Schedule/Go button edges with the
    // route-card content gutter above (Via text + daylight strip end
    // at 24pt from edge; buttons were ending at 16pt, leaving the Go
    // pill's right edge 8pt short of the daylight strip's moon glyph).
    paddingHorizontal: 24,
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
    // freshgreen — primary CTA brand exception (cursorrules). White text
    // at bodyEmphasized (17pt bold) on freshgreen = 2.9:1, defensible at
    // large-text threshold. goBtn is the screen's one primary action.
    backgroundColor: colors.freshgreen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    // e1 = chrome over map per shadows.ts. Previously inlined as an
    // exact duplicate of e1's values.
    ...shadows.e1,
  },
  goText: {
    // bodyEmphasized (17pt) — primary CTA should outweigh Schedule's
    // 13pt footnote secondary. Apple Maps "Directions" / Waze "GO"
    // both sit near 17pt semibold.
    ...typography.bodyEmphasized,
    color: colors.white,
  },
  // --- Placement mode ---
  // The pin frame just centers the SVG inside an alignment box; the
  // pin shape + shadow are part of the SVG itself, so we don't draw
  // a wrapping circle or border anymore.
  placementPinFrame: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placementBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    // zIndex above the browse/route sheet (zIndex 10) — defensive
    // even though we unmount that sheet during placement, so future
    // changes don't accidentally re-introduce the overlap regression.
    // Match radius to the main sheet (28pt) so the surface family
    // reads as consistent across phases.
    zIndex: 11,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...shadows.sheet,
  },
  placementDragHandleWrap: {
    // Centered drag handle, matching the home browse sheet and the
    // safety modal. Decorative — placement bar dismissal is via the
    // X cancel button, not a swipe gesture.
    paddingTop: 16,
    alignItems: 'center',
  },
  placementBarInner: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 16,
  },
  placementHint: {
    // Quiet footnote instruction above the Confirm/cancel row. Tertiary
    // gray so it reads as a hint, not a heading.
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
    // Left-aligned to the gutter — which is also the Confirm button's
    // left edge. Centering looked off against the asymmetric Confirm +
    // X action row (the X eats the right side, pulling the buttons'
    // visual center left of the bar's center); a deliberate left set
    // reads cleaner and anchors to the same edge as the CTA.
    textAlign: 'left',
  },
  placementActions: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  placementCancel: {
    // 48pt circular FAB per v2 (1109:8139) — matches the size family of
    // the bottom-sheet FAB pair (recenter / report on /en-route).
    // shadows.e1 for the lift above the white sheet surface.
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.e1,
  },
  placementConfirm: {
    flex: 1,
    height: 44,
    borderRadius: 100,
    // freshgreen — primary CTA brand exception (cursorrules). Confirm
    // placement is the one primary action in this mode.
    backgroundColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.e1,
  },
  placementConfirmText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
  } as const,
});
