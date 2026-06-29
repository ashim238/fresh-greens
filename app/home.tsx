import * as haptics from '../lib/haptics';
import * as Location from 'expo-location';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Dimensions,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import PlacementPin from '../assets/illustrations/drag-and-drop.svg';
import MenuGlyph from '../assets/illustrations/menu-glyph.svg';
import SidebtnRecenter from '../assets/illustrations/sidebtn-recenter.svg';
import SidebtnReport from '../assets/illustrations/sidebtn-report.svg';

import { ClusterMarker } from '../components/ClusterMarker';
import { DestinationMarker } from '../components/DestinationMarker';
import { EnRouteZone } from '../components/EnRouteZone';
import { FuelStopMarker } from '../components/FuelStopMarker';
import { FuelStopsSheet } from '../components/FuelStopsSheet';
import { DragHandle } from '../components/DragHandle';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { HomeBrowseSheet } from '../components/HomeBrowseSheet';
import { HomeEdgeIndicatorLayer } from '../components/HomeEdgeIndicatorLayer';
import { HomePlacementOverlay } from '../components/HomePlacementOverlay';
import { LandmarkMarker, variantForCategoryId } from '../components/LandmarkMarker';
import { LiveSafetySheet } from '../components/LiveSafetySheet';
import { ReportDetailCard } from '../components/ReportDetailCard';
import { RouteHazardDetailCard } from '../components/RouteHazardDetailCard';
import { RoutePreviewCard } from '../components/RoutePreviewCard';
import { ZoneDetailCard } from '../components/ZoneDetailCard';
import { SearchBar } from '../components/SearchBar';
import { UserLocationMarker } from '../components/UserLocationMarker';
import { useFuelProfile } from '../hooks/useFuelProfile';
import { useRouteFuelStops } from '../hooks/useRouteFuelStops';
import { usePreferences } from '../hooks/usePreferences';
import { usePreferredStations } from '../hooks/usePreferredStations';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useCoachMark } from '../hooks/useCoachMark';
import { useSavedPlaces } from '../hooks/useSavedPlaces';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { useUser } from '../hooks/useUser';
import { useWeather } from '../hooks/useWeather';
import {
  clearAllCommunityReports,
  getCommunityReportsAsZones,
  removeCommunityReport,
  type ReportCategoryId,
} from '../lib/api/community-reports';
import {
  DEFAULT_PREFERENCES,
  isZoneCategoryEnabled,
} from '../lib/api/preferences';
import {
  getRoutesBetween,
  type Route,
  type RouteSource,
  routeColors,
} from '../lib/api/routes';
import { loadCorridorZones, saveCorridorZones } from '../lib/api/zone-cache';
import {
  getZonesForRegion,
  getZonesForTrip,
  type Coordinate,
  type Zone,
  zoneColors,
  zoneDashPattern,
} from '../lib/api/zones';
import { PARTIAL_DEBOUNCE_MS } from '../lib/corridor/constants';
import { maybeWarmZoneTile } from '../lib/corridor/passive-zone-tiles';
import { getErrorMessage } from '../lib/error-message';
import { pathLengthMeters } from '../lib/geo';
import { clusterPointZones, regionToRevealCluster } from '../lib/clustering';
import { DAYLIGHT_DASH_PATTERN, gradientSegments } from '../lib/daylight';
import { formatDuration } from '../lib/format';
import {
  isPointInRegion,
  type Region,
} from '../lib/edge-indicators';
import type { Place } from '../lib/api/places';
import { collapseHazardZones } from '../lib/corridor/merge-hazards';
import {
  isPointInZone,
  isPointNearPolyline,
  distanceAlongRouteMeters,
  nearestPointOnPolyline,
  pickWinner,
  routePassesZone,
  zoneAnchor,
  zoneLengthMiles,
  zoneToHazardCategory,
  type HazardCategory,
} from '../lib/scoring';
import {
  firstRouteSafeOnPath,
  ROUTE_HAZARD_ORDER,
  routeHazardType,
  routeHazardsOnPath,
  type RouteHazardOnPath,
  type RouteHazardType,
  type RouteSafeType,
} from '../lib/route-preview';
import { colors } from '../theme/colors';
import { pressedDim, pressedFeedback, tapTarget44 } from '../theme/interaction';
import { mapStyle } from '../theme/map-style';
import { configureLayoutSpring, motion } from '../theme/motion';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { typography } from '../theme/typography';

// Zone-overlay rendering is now a real user preference (toggled from
// /menu's Zone Settings). Read from `usePreferences` inside the
// component below — no module-level constant. Default OFF until the
// user flips it in Settings; the zone data still drives scoring even
// when overlays are hidden.

// --- FAB-stack geometry ---------------------------------------------------
// Named so the bottom-offset math reads as composition instead of magic
// arithmetic. Earlier the Recenter FAB's bottom was `fabAnchorHeight + 24
// + 56 + 12` — readable only by someone who knew which 56 + 12 + 24 was
// which. Layout's the same, the names just say what the numbers mean.

/** Vertical gap between the collapsed sheet's top edge and the first (Report) FAB. */
const FAB_ANCHOR_GAP = 24;
/** FloatingActionButton size="56" — the FAB height we stack against. */
const FAB_HEIGHT = 56;
/** Inter-FAB gap when two FABs stack vertically (Recenter above Report). */
const FAB_STACK_GAP = 12;

/** One-line route-preview context for ReportDetailCard when a report zone intersects the selected route. */
function reportRouteContextLine(
  zone: Zone | undefined,
  selectedRoute: { coordinates: Coordinate[] } | null,
): string | undefined {
  if (!zone || !selectedRoute) return undefined;
  if (!routePassesZone(selectedRoute.coordinates, zone)) return undefined;
  const hazard = routeHazardType(zone);
  if (hazard === 'community') {
    return 'On your selected route — it counts toward the community flag in your preview.';
  }
  if (hazard === 'police') {
    return 'On your selected route — it counts toward the police-zone chip in your preview.';
  }
  if (hazard === 'lowLight') {
    return 'On your selected route — it counts toward the low-light chip when that signal is on.';
  }
  if (hazard === 'wildlife') {
    return 'On your selected route — counted toward wildlife along this path.';
  }
  if (hazard === 'road') {
    return 'On your selected route — counted toward road conditions along this path.';
  }
  if (zone.category === 'community-report') {
    return 'Near your selected route — Fresh Greens weighed it when scoring this preview.';
  }
  return undefined;
}

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
  const prefsState = usePreferences();
  const preferences = prefsState.ready ? prefsState.preferences : null;
  const savedPlacesState = useSavedPlaces();
  const { add } = savedPlacesState;
  const home = savedPlacesState.ready ? savedPlacesState.home : null;
  // Trusted Friend marker — renders only when the trusted contact has a
  // geocoded lat/lng (captured opportunistically during the picker flow
  // in /trusted-contact-setup). Encodes the thesis claim that the app
  // respects the "people who care about you" graph alongside the road
  // graph. Visual is a Phosphor HeartStraight stand-in inside the green
  // LandmarkMarker; the canonical SVG comes from Figma 1133:13245 when
  // it's exported.
  const trustedContactState = useTrustedContact();
  const trustedContact = trustedContactState.ready ? trustedContactState.contact : null;
  const { user } = useUser();
  // First name for the browse-mode sheet eyebrow ("Jordan's Local
  // Recs"). Pull off displayName since that's what useUser exposes;
  // fall back to undefined so HomeBrowseSheet drops the possessive
  // and renders "Local Recs" plain.
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
  // showZones is `false` while preferences are loading from AsyncStorage;
  // overlays just render on the next pass once the value resolves.
  const showZones = preferences?.showZones ?? false;
  const mapRef = useRef<MapView>(null);
  // iOS Apple Maps (and some Android builds) fire MapView.onPress after
  // Marker.onPress. Without this, a report-pin tap sets selectedReport then
  // handleMapPress immediately clears it — the card never appears.
  const suppressNextMapPressRef = useRef(false);
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
    heading: number | null;
    speed: number | null;
  } | null>(null);
  // Bottom-sheet camera offset. The route-preview sheet covers ~40% of
  // the screen, so a camera centered on the user's coord puts the GPS
  // pin geometrically dead-center — which is UNDER the sheet, invisible.
  // Biasing the camera south by ~0.2 × latitudeDelta shifts the visible
  // center up to ~30% from the screen top, which is the visual center of
  // the above-sheet area for a ~40%-sheet. In browse mode (smaller sheet)
  // it just sits the user slightly above center, which reads natural for
  // "what's ahead, not what's behind." User-flagged 2026-06-03 — recenter
  // overshot the sheet after the route-preview height grew.
  // Applied in handleRecenter + handleHomeMarkerPress (handleReportButtonPress
  // is exempt — it uses a tighter latitudeDelta + a much smaller placement bar
  // and doesn't have the visibility problem).
  const SHEET_CAMERA_OFFSET_RATIO = 0.2;
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
  // Whether the destination is a saved regular (bookmark on the card).
  // Tapping the title toggles save-as-regular; the bookmark is the
  // visual invitation to "save this as home/work"
  // for recurring trips — not for one-off journeys to somewhere the
  // user has never been. C12c: now a real signal — true when the
  // current destination is within ~200m of a destination the user
  // marked "regular" from a post-trip summary (regular-destinations
  // store). Closes the loop the long-standing TODO described.
  // Zones and routes both live in component state so they re-render the
  // map when fetched. Empty arrays initially → nothing renders → map shows
  // clean until data arrives a moment later. This is the "loading state"
  // without explicit UI.
  // OSM zones along the trip corridor (origin→destination bbox, refined
  // to the routed polyline when it lands). Refreshed when destination
  // changes. Hidden by default — they drive scoring invisibly.
  const [osmZones, setOsmZones] = useState<Zone[]>([]);
  /** OSM fetch along the active trip — gates All-clear vs loading chip. */
  const [tripZonesStatus, setTripZonesStatus] = useState<
    'idle' | 'loading' | 'ready'
  >('idle');
  /** True when getZonesForTrip threw — suppress false "All clear". */
  const [tripZonesFetchFailed, setTripZonesFetchFailed] = useState(false);
  /** Bumped by the "Couldn't check route" retry chip to re-run the
      corridor fetch for the same destination (the fetch effect keys on
      this alongside destLat/destLng). */
  const [corridorRetryTick, setCorridorRetryTick] = useState(0);
  /** True only after a successful corridor fetch for the current trip. */
  const [tripZonesCorridorComplete, setTripZonesCorridorComplete] =
    useState(false);
  // Community-submitted point reports. Refreshed every time /home gains
  // focus, so a freshly-submitted report from /report appears
  // immediately when the user closes the modal. Rendered as LandmarkMarkers
  // when in the viewport and as EdgeIndicators when out — the "trusted
  // community" signal layer, distinct from OSM infrastructure zones.
  const [reportZones, setReportZones] = useState<Zone[]>([]);
  // __DEV__-only: lets a long-press on the menu button hide the "Clear
  // reports" dev chip so it stays out of screenshots, while keeping the
  // tool one long-press away for re-staging. Never matters in production
  // (the chip is __DEV__-gated regardless).
  const [devChipHidden, setDevChipHidden] = useState(false);
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

  // --- Sheet crossfade choreography (state) ---
  // The effect that drives this lives below `reduceMotion` (declared later)
  // because the effect's reduce-motion guard depends on it.
  const isRouteMode = !!(params.destLat && params.destLng);
  const [sheetMode, setSheetMode] = useState(isRouteMode);
  const sheetOpacity = useRef(new Animated.Value(1)).current;

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

  // Tapped zone-overlay state — mirrors selectedReport. The two are
  // mutually exclusive (opening one clears the other); both clear on
  // map tap. Spec:
  // docs/archive/superpowers/specs/2026-06-01-zone-overlay-tap-info-design.md
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);

  /** Active hazard chip session — index into `routeHazardsOnPath` for that type. */
  const [selectedRouteHazard, setSelectedRouteHazard] = useState<{
    hazardType: RouteHazardType;
    index: number;
  } | null>(null);

  const [showFuelStops, setShowFuelStops] = useState(false);
  const [highlightFuelStopId, setHighlightFuelStopId] = useState<string | null>(
    null,
  );

  // Combined zone set fed to scoring. OSM + community reports flow
  // through the same pipeline — same Zone type, same scorer dispatch.
  // useMemo keeps the array reference stable across renders that don't
  // change either source.
  // Zones gated by the user's flag toggles (filtered per-source so the
  // overlay, scoring, counts, and report markers all respect the flags).
  const prefs = preferences ?? DEFAULT_PREFERENCES;
  // Corridor OSM/511 + Mapbox Directions incidents (same token as routing).
  const corridorZones = useMemo(() => {
    const incidents =
      routeFetchSource === 'mapbox'
        ? rawRoutes.flatMap((r) => r.mapboxIncidentZones ?? [])
        : [];
    return collapseHazardZones([...osmZones, ...incidents]);
  }, [osmZones, rawRoutes, routeFetchSource]);
  const enabledOsmZones = useMemo(
    () => corridorZones.filter((z) => isZoneCategoryEnabled(z.category, prefs)),
    [corridorZones, prefs],
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

  // Recommended route is the safest one (pickWinner's index 0). May be
  // undefined briefly on first render before the fetch completes.
  const recommended = routes.find((route) => route.type === 'recommended');

  // The route the preview card + colored gradient reflect. Defaults to the
  // recommended (safest); the user can tap the chevron pair in the top row
  // or tap an alternate's gray line on the map to take a different one.
  // Falls back to recommended when the selection is stale (routes refetched)
  // or unset. Safety still PICKS the recommended; this is the user choosing
  // to take a different one — the conditions caption stays honest about
  // which it is.
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const selectedRoute =
    (selectedRouteId != null && routes.find((r) => r.id === selectedRouteId)) ||
    recommended;

  const routeHazardSession = useMemo(() => {
    if (!selectedRoute || !selectedRouteHazard) return null;
    const list = routeHazardsOnPath(
      selectedRouteHazard.hazardType,
      selectedRoute.coordinates,
      enabledZones,
    );
    const index = Math.min(
      Math.max(0, selectedRouteHazard.index),
      Math.max(0, list.length - 1),
    );
    const entry = list[index];
    if (!entry) return null;
    return { list, entry, index };
  }, [selectedRoute, selectedRouteHazard, enabledZones]);

  // EnRouteZone on the route preview runs tracksViewChanges={false}; MapKit
  // can evict the cached bitmap on zoom reflow. State-in-key remounts refresh
  // the snapshot (see docs/learnings.md — safe for EnRouteZone; zIndex 350
  // only needs to stay below community-report pins at 550).
  const markerSnapshotEpoch = mapRegion
    ? String(Math.round(mapRegion.latitudeDelta * 100))
    : 'init';

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
  // Daylight segmentation is the EXPENSIVE part (SunCalc per segment) and
  // is selection-INDEPENDENT, so it's memoized on [routes, cloudCoverPct]
  // alone — switching routes must not recompute it. Every route is
  // segmented identically regardless of which is selected; selection only
  // changes color downstream (see routePolylines). This is what reconciles
  // the leak fix (every route fully segmented, stable keys) with not
  // re-running SunCalc on every chevron tap.
  const routeSegments = useMemo(
    () => routes.map((route) => ({ route, segments: gradientSegments(route, undefined, cloudCoverPct) })),
    [routes, cloudCoverPct],
  );

  const routePolylines = useMemo(
    () => {
      // TWO STABLE LAYERS so a route-switch is COLOR-ONLY — no reorder, no
      // coordinate change, no mount/unmount. This is load-bearing for two
      // separate iOS react-native-maps quirks:
      //   1. reordering keyed Polyline children → it removes + re-adds the
      //      overlays to reorder them → a MapKit reflow that EVICTS the
      //      (tracksViewChanges) marker bitmaps. The earlier "emit selected
      //      last for paint order" reorder is exactly what made the user
      //      dot + finish pin vanish on a chevron tap (user-flagged
      //      2026-06-03) — a camera-less switch, so always-track couldn't
      //      heal it (nothing re-renders the markers).
      //   2. changing a Polyline's coordinates recreates its overlay (same
      //      reflow). So routes must keep fixed coordinates per key.
      // Every route is rendered in BOTH layers, in stable `routes` order
      // with stable keys; selection only flips strokeColor (an in-place
      // renderer update — no overlay churn, no reflow). Layer order gives
      // paint order: the highlight layer (selected) draws over the base
      // layer (alternates), so the selected stroke wins at shared segments
      // WITHOUT reordering. ~2× the Polyline count, but half are
      // 'transparent' (MapKit skips drawing them) and segments are
      // precomputed (no SunCalc on switch).
      const base = routeSegments.flatMap(({ route, segments }) => {
        const isSelected = route.id === selectedRoute?.id;
        return segments.map((segment, idx) => (
          <Polyline
            key={`${route.id}-base-${idx}`}
            coordinates={segment.coordinates}
            // Selected route's base is transparent so its own dashed
            // gradient (highlight) shows the MAP through the dash gaps,
            // not a gray base line.
            strokeColor={isSelected ? 'transparent' : routeColors.alternate.stroke}
            strokeWidth={routeColors.alternate.width}
          />
        ));
      });
      const highlight = routeSegments.flatMap(({ route, segments }) => {
        const isSelected = route.id === selectedRoute?.id;
        return segments.map((segment, idx) => (
          <Polyline
            key={`${route.id}-hl-${idx}`}
            coordinates={segment.coordinates}
            strokeColor={isSelected ? segment.color : 'transparent'}
            strokeWidth={routeColors.recommended.width}
            // WCAG 1.4.1 non-color cue on the selected route: pair the
            // daylight color gradient with a dash pattern so day/twilight/
            // night reads through deuteranopia/tritanopia/monochromacy.
            // Solid = day, medium dashes = twilight, short dashes = night.
            // The bottom-sheet daylight legend uses the same color anchors
            // so the polyline + legend tell the same story two ways.
            lineDashPattern={isSelected ? DAYLIGHT_DASH_PATTERN[segment.band] : undefined}
          />
        ));
      });
      return [...base, ...highlight];
    },
    [routeSegments, selectedRoute?.id],
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

  // Sheet crossfade effect — drives the browse↔route opacity transition.
  // State + Animated.Value declared earlier near the bottom-sheet block;
  // lives here so it can read `reduceMotion` from the line above.
  useEffect(() => {
    if (isRouteMode === sheetMode) return;
    if (reduceMotion) {
      setSheetMode(isRouteMode);
      return;
    }
    Animated.timing(sheetOpacity, {
      toValue: 0,
      duration: 80,
      easing: motion.easing.outQuart,
      useNativeDriver: true,
    }).start(() => {
      setSheetMode(isRouteMode);
      Animated.timing(sheetOpacity, {
        toValue: 1,
        duration: 200,
        easing: motion.easing.out,
        useNativeDriver: true,
      }).start();
    });
  }, [isRouteMode, sheetMode, reduceMotion, sheetOpacity]);

  const mapCoach = useCoachMark('home-map-intro');
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
            configureLayoutSpring();
          }
          if (g.dy > 20) {
            setThingsToDoCollapsed((was) => {
              if (!was) {
                haptics.shift();
              }
              return true;
            });
          } else if (g.dy < -20) {
            setThingsToDoCollapsed((was) => {
              if (was) {
                haptics.shift();
              }
              return false;
            });
          } else {
            setThingsToDoCollapsed((was) => {
              const next = !was;
              haptics.shift();
              return next;
            });
          }
        },
      }),
    [reduceMotion],
  );


  // On-route hazard markers — the yellow EnRouteZone teardrop dropped on
  // the route line at each OSM hazard the route passes (low-light /
  // wildlife / road / police). Reuses the canonical /en-route marker
  // (Figma 1133:13297) so the preview and the live drive show hazards in
  // the same visual language. Sourced from enabledOsmZones (NOT community
  // reports — the orange eye pins already mark those spots), and gated by
  // the same routePassesZone predicate as the chips + score, so marker
  // presence ⇄ chip presence ⇄ score all agree on what a route passes.
  // Each zone's anchor is SNAPPED onto the route line via
  // nearestPointOnPolyline — a polygon centroid off to the side becomes
  // an on-route glyph, reading as "the hazard is HERE on your path."
  // Capped at 6 (chip carries the authoritative count if more); ordering
  // follows ROUTE_HAZARD_ORDER (police first among OSM types) so the cap
  // bites the lowest-priority items if it ever triggers.
  const routeHazardMarkers = useMemo(() => {
    if (!selectedRoute) {
      return [] as {
        id: string;
        zoneId: string;
        coord: Coordinate;
        category: HazardCategory;
        lengthMiles: number;
      }[];
    }
    const markers: {
      id: string;
      zoneId: string;
      coord: Coordinate;
      category: HazardCategory;
      lengthMiles: number;
      orderIdx: number;
    }[] = [];
    for (const zone of enabledOsmZones) {
      // OSM-only: community-report eye pins cover those spots already.
      if (zone.category === 'community-report') continue;
      const hazardType = routeHazardType(zone);
      // Only the four charted on-route hazard types.
      if (
        hazardType !== 'police' &&
        hazardType !== 'lowLight' &&
        hazardType !== 'wildlife' &&
        hazardType !== 'road'
      ) {
        continue;
      }
      if (!routePassesZone(selectedRoute.coordinates, zone)) continue;
      const anchor = zoneAnchor(zone);
      if (!anchor) continue;
      const category = zoneToHazardCategory(zone);
      // zoneToHazardCategory may return 'community-alert' for
      // community-report zones — already filtered above, but the type
      // narrows here so we keep it tight.
      if (!category || category === 'community-alert') continue;
      markers.push({
        id: zone.id,
        zoneId: zone.id,
        coord: nearestPointOnPolyline(anchor, selectedRoute.coordinates),
        category,
        lengthMiles: zoneLengthMiles(zone, selectedRoute.coordinates),
        orderIdx: ROUTE_HAZARD_ORDER.indexOf(hazardType),
      });
    }
    markers.sort((a, b) => a.orderIdx - b.orderIdx);
    return markers
      .slice(0, 6)
      .map(({ id, zoneId, coord, category, lengthMiles }) => ({
        id,
        zoneId,
        coord,
        category,
        lengthMiles,
      }));
  }, [selectedRoute, enabledOsmZones]);

  const { profile: fuelProfile } = useFuelProfile();
  const {
    stations: preferredStations,
    isPreferred: isPreferredFuelStop,
    add: addPreferredFuelStop,
    removeNear: removePreferredFuelStopNear,
  } = usePreferredStations();

  const fuelStopsOnRoute = useRouteFuelStops({
    active: !!selectedRoute,
    routeCoords: selectedRoute?.coordinates ?? [],
    fuelType: fuelProfile?.fuelType ?? 'gas',
    userLocation,
  });

  const sortedFuelStopsOnRoute = useMemo(
    () =>
      [...fuelStopsOnRoute.stops].sort(
        (a, b) => Number(isPreferredFuelStop(b)) - Number(isPreferredFuelStop(a)),
      ),
    [fuelStopsOnRoute.stops, isPreferredFuelStop],
  );

  const handleTogglePreferredFuelStop = useCallback((stop: Place) => {
    if (isPreferredFuelStop(stop)) {
      void removePreferredFuelStopNear(stop);
    } else {
      void addPreferredFuelStop({
        name: stop.name,
        latitude: stop.latitude,
        longitude: stop.longitude,
      });
    }
  }, [
    isPreferredFuelStop,
    removePreferredFuelStopNear,
    addPreferredFuelStop,
  ]);

  const openFuelStopsSheet = useCallback((stopId: string) => {
    setSelectedReport(null);
    setSelectedZone(null);
    setSelectedRouteHazard(null);
    setHighlightFuelStopId(stopId);
    setShowFuelStops(true);
  }, []);

  const focusMapOnCoordinate = useCallback((coord: Coordinate) => {
    const latitudeDelta = 0.01;
    mapRef.current?.animateToRegion(
      {
        latitude: coord.latitude - SHEET_CAMERA_OFFSET_RATIO * latitudeDelta,
        longitude: coord.longitude,
        latitudeDelta,
        longitudeDelta: latitudeDelta,
      },
      400,
    );
  }, []);

  const focusRouteHazardAtIndex = useCallback(
    (hazardType: RouteHazardType, index: number) => {
      if (!selectedRoute) return;
      const list = routeHazardsOnPath(
        hazardType,
        selectedRoute.coordinates,
        enabledZones,
      );
      const entry = list[index];
      if (!entry) return;
      haptics.tap();
      setSelectedZone(null);
      setHighlightFuelStopId(null);
      setShowFuelStops(false);
      focusMapOnCoordinate(entry.focus);
      if (entry.zone.category === 'community-report') {
        setSelectedRouteHazard(null);
        setSelectedReport({
          zoneId: entry.zone.id,
          categoryId: entry.zone.reportCategoryId as ReportCategoryId,
          detail: entry.zone.reportDetail,
          subTag: entry.zone.reportSubTag,
          placeName: entry.zone.reportPlaceName,
          photoUri: entry.zone.reportPhotoUri,
          timestamp: entry.zone.reportTimestamp ?? Date.now(),
        });
        return;
      }
      setSelectedReport(null);
      setSelectedRouteHazard({ hazardType, index });
    },
    [selectedRoute, enabledZones, focusMapOnCoordinate],
  );

  const handleRouteHazardChipPress = useCallback(
    (hazardType: RouteHazardType) => {
      focusRouteHazardAtIndex(hazardType, 0);
    },
    [focusRouteHazardAtIndex],
  );

  const handleRouteSafeChipPress = useCallback(
    (safeType: RouteSafeType) => {
      if (!selectedRoute) return;
      const hit = firstRouteSafeOnPath(
        safeType,
        selectedRoute.coordinates,
        enabledZones,
      );
      if (!hit) return;
      haptics.tap();
      setSelectedReport(null);
      setSelectedRouteHazard(null);
      setSelectedZone(hit.zone);
      setHighlightFuelStopId(null);
      setShowFuelStops(false);
      focusMapOnCoordinate(hit.focus);
    },
    [selectedRoute, enabledZones, focusMapOnCoordinate],
  );

  const handleSelectFuelStopOnMap = useCallback((stop: Place) => {
    setHighlightFuelStopId(stop.id);
    haptics.tap();
    mapRef.current?.animateToRegion(
      {
        latitude: stop.latitude,
        longitude: stop.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      400,
    );
  }, []);

  // Clustered report markers — groups nearby points at low zoom to
  // prevent overlapping pins in dense neighborhoods. Recomputes on
  // every pan/zoom (mapRegion change) and when reports update.
  const clusteredReports = useMemo(() => {
    if (!mapRegion || !mapSize) return [];
    return clusterPointZones(enabledReportZones, mapRegion, mapSize.width, mapSize.height);
  }, [enabledReportZones, mapRegion, mapSize]);

  /**
   * Recenter the map on the user's current location. Standard nav-app
   * affordance — useful after the user has panned the map away. Uses
   * `animateToRegion` (flat 2D view) at the same delta as the initial
   * centering, so the post-tap framing matches the screen's default
   * "you just opened the app" state.
   */
  function handleRecenter() {
    if (!userLocation) return;
    haptics.tap();
    const latitudeDelta = 0.02;
    mapRef.current?.animateToRegion(
      {
        // Bias the camera south so the user pin lands above the bottom
        // sheet rather than under it — see SHEET_CAMERA_OFFSET_RATIO note.
        latitude: userLocation.latitude - SHEET_CAMERA_OFFSET_RATIO * latitudeDelta,
        longitude: userLocation.longitude,
        latitudeDelta,
        longitudeDelta: latitudeDelta,
      },
      400,
    );
    // No marker-refresh bump needed — UserLocationMarker now runs
    // tracksViewChanges permanently, so it survives animateToRegion
    // without a remount.
  }

  function handleReportButtonPress() {
    if (!userLocation) return;
    // Clear any open report detail card so it doesn't linger behind
    // the placement confirm bar during the placement flow.
    setSelectedReport(null);
    setPlacingReport(true);
    setPlacementPin({ ...userLocation });
    haptics.shift();
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
    suppressNextMapPressRef.current = true;
    haptics.tap();
    const latitudeDelta = 0.008;
    mapRef.current?.animateToRegion(
      {
        // Same south-bias as handleRecenter — the saved-home pin needs
        // to land above the bottom sheet, not under it.
        latitude: home.latitude - SHEET_CAMERA_OFFSET_RATIO * latitudeDelta,
        longitude: home.longitude,
        latitudeDelta,
        longitudeDelta: latitudeDelta,
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
    suppressNextMapPressRef.current = true;
    haptics.tap();
    const name = trustedContact.name ?? 'your trusted contact';
    Alert.alert(
      name,
      `Reach ${name} now.`,
      [
        {
          text: 'Call',
          onPress: () => {
            haptics.focus();
            void Linking.openURL(`tel:${trustedContact.phoneNumber}`);
          },
        },
        {
          text: 'Text',
          onPress: () => {
            haptics.focus();
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
      setTripZonesStatus('idle');
      setTripZonesFetchFailed(false);
      setTripZonesCorridorComplete(false);
    } else {
      // Mark calculating BEFORE awaiting permission/GPS so the route-
      // preview bottom sheet shows LoadingState immediately on
      // destination change (rather than displaying stale "—" headline
      // for the ~1s permission + GPS resolution window). Cleared in
      // the fetch resolve below.
      setIsCalculatingRoute(true);
      // Drop stale OSM from the prior trip so chips don't read "All
      // clear" against old geometry while the new corridor loads.
      setOsmZones([]);
      setTripZonesStatus('loading');
      setTripZonesFetchFailed(false);
      setTripZonesCorridorComplete(false);
    }

    let cancelled = false;
    let partialTimer: ReturnType<typeof setTimeout> | null = null;
    let corridorFetchCompleted = false;
    const hadDestination = Boolean(params.destLat && params.destLng);

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

      void maybeWarmZoneTile(center);

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
      // (often <1s) when a destination IS set; the gray "Checking
      // route…" chip runs one corridor Overpass pass (with the
      // polyline when available). Browse mode shows zero polylines.
      const routePromise = destination
        ? // 'preview' detail (A20): /home only renders a route-preview
          // line + ETA, never turn-by-turn. On long routes this drops
          // steps and fetches a coarse overview so the preview doesn't
          // freeze the JS thread parsing + scoring thousands of points.
          getRoutesBetween(center, destination, { detail: 'preview' })
        : Promise.resolve({ routes: [] as Route[], source: 'mapbox' as const });
      const browseZonePromise = destination
        ? null
        : (async () => {
            await maybeWarmZoneTile(center);
            return getZonesForRegion(center);
          })();

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

      if (destination) {
        // Stale-while-revalidate: show last corridor cache immediately, then refresh.
        const corridorCached = await loadCorridorZones(destination);
        if (corridorCached && !cancelled) {
          setOsmZones(corridorCached.zones);
          setTripZonesFetchFailed(false);
          setTripZonesCorridorComplete(true);
          setTripZonesStatus('ready');
          corridorFetchCompleted = true;
        }

        // Corridor preview: partial OSM updates while waves run; cache on ready.
        try {
          const flushPartial = (zones: Zone[]) => {
            if (PARTIAL_DEBOUNCE_MS <= 0) {
              setOsmZones(zones);
              return;
            }
            if (partialTimer) clearTimeout(partialTimer);
            partialTimer = setTimeout(
              () => setOsmZones(zones),
              PARTIAL_DEBOUNCE_MS,
            );
          };

          if (!corridorCached) {
            setTripZonesStatus('loading');
          }

          const tripZones = await getZonesForTrip(
            center,
            destination,
            fetchedResult.routes[0]?.coordinates,
            {
              mode: 'preview',
              routeSource: fetchedResult.source,
              onPartial: (zones) => flushPartial(zones),
            },
          );
          if (partialTimer) {
            clearTimeout(partialTimer);
            partialTimer = null;
          }
          if (!cancelled) {
            setOsmZones(tripZones);
            setTripZonesFetchFailed(false);
            setTripZonesCorridorComplete(true);
            corridorFetchCompleted = true;
            setTripZonesStatus('ready');
            const coords = fetchedResult.routes[0]?.coordinates;
            if (coords && coords.length >= 2) {
              await saveCorridorZones(tripZones, destination, {
                pathMeters: pathLengthMeters(coords),
                routeId: fetchedResult.routes[0]?.id,
              });
            }
          }
        } catch {
          if (!cancelled) {
            // Fail-open to ready but keep prior osmZones — never imply All clear.
            setTripZonesFetchFailed(true);
            setTripZonesStatus('ready');
          }
        }
      } else if (browseZonePromise) {
        const fetchedZones = await browseZonePromise;
        if (cancelled) return;
        setOsmZones(fetchedZones);
      }
      } catch (err) {
        console.warn('[home] fetchAndCenterOnUser failed:', err);
      } finally {
        // Clear calc state on any exit. Guarded against the unmount
        // race so a post-cancel setState doesn't fire on a stale
        // component. The success path also calls setIsCalculatingRoute(false)
        // before this finally — idempotent.
        if (!cancelled) {
          setIsCalculatingRoute(false);
          // Permission denied, GPS error, or early return before corridor:
          // tripZonesStatus may still be 'loading' — exit without false All clear.
          if (hadDestination && !corridorFetchCompleted) {
            setTripZonesStatus('ready');
          }
        }
      }
    }

    fetchAndCenterOnUser();
    return () => {
      cancelled = true;
      if (partialTimer) clearTimeout(partialTimer);
    };
    // Re-run whenever the destination URL params change, so submitting
    // a new search refetches routes for the new endpoint without
    // requiring the user to navigate away and back. corridorRetryTick
    // re-runs it for the SAME destination when the user taps "retry"
    // on a failed route check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.destLat, params.destLng, corridorRetryTick]);

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
            heading: pos.coords.heading ?? null,
            speed: pos.coords.speed ?? null,
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
      const hitLat = degPerPxLat * 50;
      const hitLng = degPerPxLng * 50;

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
        haptics.commit();
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
                } catch (err) {
                  const { title, body } = getErrorMessage('save', 'transient', err);
                  Alert.alert(title, body);
                }
                if (selectedReport?.zoneId === hit.id) setSelectedReport(null);
              },
            },
          ],
        );
        return;
      }
    }

    haptics.shift();
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
            void (async () => {
              const result = await add.run({ kind: 'home', name: 'Home', latitude, longitude });
              if (!result.ok) {
                console.warn('home save failed', result.error);
                // home save is a background nicety — silent failure is acceptable
                // here (the user can re-save), but the silent path is now EXPLICIT
                // rather than an uncaught .catch.
                return;
              }
              // Re-check `home` at confirm time — defense in depth
              // against a hypothetical concurrent save (no current path
              // creates one, but the snapshot is cheap to harden).
              if (wasFirstHome && home == null) {
                haptics.confirm();
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
            })();
          },
        },
      ],
    );
  }

  /**
   * __DEV__-only: wipe every community report from the store for a clean
   * map (screenshots, demos). Bypasses the per-marker hold-to-delete's
   * author + anonymity gate, which can't touch anonymous incident/
   * felt-unsafe reports or reports made under a prior sign-in. Never
   * ships — the chip that calls this is gated on `__DEV__`.
   */
  function handleDevClearReports() {
    Alert.alert(
      'Clear all reports? (dev)',
      'Removes every community report from this device. Dev-only — not in production builds.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllCommunityReports();
              setReportZones(await getCommunityReportsAsZones());
              setSelectedReport(null);
              haptics.confirm();
            } catch (err) {
              const { title, body } = getErrorMessage('save', 'transient', err);
              Alert.alert(title, body);
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
  function handleMapPress(e: {
    nativeEvent: {
      coordinate: { latitude: number; longitude: number };
      action?: string;
    };
  }) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    if (
      suppressNextMapPressRef.current ||
      e.nativeEvent.action === 'marker-press'
    ) {
      suppressNextMapPressRef.current = false;
      return;
    }

    // Placement mode takes precedence — the user is deliberately
    // placing a report pin, and a tap should move the pin even if it
    // happens to land on a zone overlay.
    if (placingReport) {
      haptics.tap();
      setPlacementPin({ latitude, longitude });
      return;
    }

    // Zone hit-test fallback for iOS Apple Maps. react-native-maps'
    // Polygon.onPress / Polyline.onPress don't fire reliably on
    // MKMapView overlays (Apple's MKOverlayRenderer doesn't expose
    // overlay hit-testing the way Google Maps does). The Polygon /
    // Polyline `onPress` wired in the zone-overlay render still fires
    // on Android / Google Maps; this is the iOS-side path that
    // delivers the same behavior. Reuses `isPointInZone` from the
    // scoring layer so tap-detection matches the same proximity
    // thresholds the entered-zone / route-pass-through detection
    // uses — taps and entries agree on what "in this zone" means.
    if (showZones && zonesVisibleAtZoom) {
      const tap = { latitude, longitude };
      const hit = enabledOsmZones.find((zone) => isPointInZone(tap, zone));
      if (hit) {
        setSelectedReport(null);
        setSelectedRouteHazard(null);
        setSelectedZone(hit);
        return;
      }
    }

    // Route-switch hit-test — tap a gray ALTERNATE route line to take it
    // (tapping the colored selected route is a no-op). Same iOS rationale
    // as the zone hit-test above: Polyline.onPress doesn't fire reliably
    // on MKMapView, so we hit-test against each route's polyline via the
    // exported isPointNearPolyline. Runs after zones (so a zone tap still
    // wins on overlap) with a tight ~40m tolerance so it doesn't swallow
    // empty-map taps. Only when there's a real choice (>1 route).
    if (routes.length > 1) {
      const tap = { latitude, longitude };
      const tappedAlt = routes.find(
        (r) =>
          r.id !== selectedRoute?.id &&
          isPointNearPolyline(tap, r.coordinates, 40),
      );
      if (tappedAlt) {
        haptics.tap();
        setSelectedRouteId(tappedAlt.id);
        return;
      }
    }

    // Empty-map tap dismisses any open detail card. Mutual exclusion
    // means at most one of these is non-null at a time, but clearing
    // both is the safe + cheap default.
    setSelectedReport(null);
    setSelectedZone(null);
    setSelectedRouteHazard(null);
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
            // Tap on either → opens ZoneDetailCard; clears any open
            // selectedReport for mutual exclusion. tappable required
            // on Polyline (Polygon is tappable by default in
            // react-native-maps).
            const handleZonePress = () => {
              setSelectedReport(null);
              setSelectedRouteHazard(null);
              setSelectedZone(zone);
            };
            if (zone.geometry === 'polyline') {
              return (
                <Polyline
                  key={zone.id}
                  coordinates={zone.coordinates}
                  strokeColor={zoneColors[zone.type].stroke}
                  strokeWidth={4}
                  lineDashPattern={zoneDashPattern[zone.type]}
                  tappable
                  onPress={handleZonePress}
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
                  tappable
                  onPress={handleZonePress}
                />
              );
            }
            // OSM adapter never returns 'point' geometry — community
            // reports do, and they're rendered separately below.
            return null;
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
          Phosphor duotone House inside (universal iOS home affordance,
          rendered white on the wiltedgreen bg). Matches the
          LandmarkMarker system; green preserves the "home as welcoming"
          association from the previous freshgreen MapMarker. Only
          visible when in the viewport; the EdgeIndicator overlay below
          handles the off-viewport case with the same Phosphor House.
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
          On-route hazard markers — the yellow EnRouteZone teardrop dropped
          on the route line at each OSM hazard the selected route passes
          (police, low-light, wildlife, road). Same component as /en-route's
          on-map zone markers, so the preview and the live drive share the
          visual language. Rendered AFTER routePolylines. Community-report
          pins render later still (zIndex 550) so they win hit-tests when
          colocated with a hazard teardrop or fuel pin.
        */}
        {routeHazardMarkers.map((m) => (
          <EnRouteZone
            key={`hazard-${m.id}-${markerSnapshotEpoch}`}
            latitude={m.coord.latitude}
            longitude={m.coord.longitude}
            category={m.category}
            state="default"
            lengthMiles={m.lengthMiles}
            zIndex={350}
            onPress={
              placingReport
                ? undefined
                : () => {
                    suppressNextMapPressRef.current = true;
                    setSelectedReport(null);
                    setSelectedZone(null);
                    if (!selectedRoute) return;
                    const zone = enabledOsmZones.find((z) => z.id === m.zoneId);
                    const hazardType = zone ? routeHazardType(zone) : null;
                    if (
                      !hazardType ||
                      hazardType === 'community' ||
                      !zone
                    ) {
                      return;
                    }
                    const list = routeHazardsOnPath(
                      hazardType,
                      selectedRoute.coordinates,
                      enabledZones,
                    );
                    const index = list.findIndex((h) => h.zone.id === m.zoneId);
                    focusRouteHazardAtIndex(hazardType, index >= 0 ? index : 0);
                  }
            }
          />
        ))}

        {selectedRoute &&
          sortedFuelStopsOnRoute.map((stop) => (
            <FuelStopMarker
              key={`fuel-${stop.id}`}
              latitude={stop.latitude}
              longitude={stop.longitude}
              name={stop.name}
              preferred={isPreferredFuelStop(stop)}
              selected={showFuelStops && highlightFuelStopId === stop.id}
              onPress={() => {
                if (placingReport) return;
                suppressNextMapPressRef.current = true;
                openFuelStopsSheet(stop.id);
              }}
            />
          ))}

        {/*
          Community-report points — clustered at low zoom, individual
          LandmarkMarkers at high zoom. Rendered after hazard/fuel layers
          so orange felt-unsafe (and other report) pins stay tappable when
          stacked on a route hazard. Off-viewport reports surface as
          EdgeIndicators below. Tap opens ReportDetailCard.
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
                  suppressNextMapPressRef.current = true;
                  setSelectedRouteHazard(null);
                  haptics.tap();
                  if (!mapSize) return;
                  mapRef.current?.animateToRegion(
                    regionToRevealCluster(cluster, mapSize.width, mapSize.height),
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
                suppressNextMapPressRef.current = true;
                setSelectedZone(null);
                setSelectedRouteHazard(null);
                haptics.tap();
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
          Custom user-location dot — replaces showsUserLocation so it
          can sit above LandmarkMarker pins (zIndex=1000) when a
          report happens to land near the user's GPS. Renders only
          after the first watchPositionAsync fix.
        */}
        {userLocation && (
          <UserLocationMarker
            latitude={userLocation.latitude}
            longitude={userLocation.longitude}
            heading={userLocation.heading}
            speed={userLocation.speed}
          />
        )}
      </MapView>

      {/*
        Edge-indicator overlay — pills on the screen edge pointing to
        POIs that are currently outside the viewport. Updates on every
        pan/zoom (via mapRegion state) and renders in screen-space
        rather than the map's native layer.
      */}
      {mapRegion && mapSize && (
        <HomeEdgeIndicatorLayer
          mapRegion={mapRegion}
          mapSize={mapSize}
          enabledReportZones={enabledReportZones}
          home={home}
          trustedContact={trustedContact}
          bottomSheetHeight={bottomSheetHeight}
          mapRef={mapRef}
        />
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
            // H2: size="56" → "48" per FloatingActionButton's docstring
            // (48 = /home top-row overlay; 56 = /en-route side column).
            // At 56 the menu FAB matched the search bar's 56pt height and
            // competed for chrome weight; at 48 it recedes so the search
            // bar dominates the top-row hierarchy.
            size="48"
            onPress={() => router.push('/menu')}
            onLongPress={
              __DEV__
                ? () => {
                    haptics.tap();
                    setDevChipHidden((h) => !h);
                  }
                : undefined
            }
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

            The right slot now hosts the __DEV__-only reset chip the
            menuRow's space-between layout was always built for. It
            clears all community reports for a clean map (screenshots/
            demos) and never renders in production builds.
          */}
          {__DEV__ && !devChipHidden && (
            <Pressable
              onPress={handleDevClearReports}
              style={({ pressed }) => [styles.devResetChip, pressed && pressedDim]}
              accessibilityRole="button"
              accessibilityLabel="Clear all reports (dev only)"
            >
              <Text style={styles.devResetChipText}>Clear reports</Text>
            </Pressable>
          )}
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
        a report is selected. Same logic for ZoneDetailCard — also a
        bottom sheet, also owns the bottom affordance when a zone
        is selected (added 2026-06-01 alongside the zone-tap feature).
      */}
      {!placingReport &&
        !selectedReport &&
        !selectedZone &&
        !selectedRouteHazard && <SafeAreaView
        style={styles.bottomSheet}
        edges={['bottom']}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          setBottomSheetHeight(h);
          // Lock the FAB anchor to the collapsed sheet height in
          // browse mode (so FABs stay put while the sheet expands
          // over them); in route mode there's no collapse concept,
          // so always track.
          if (isRouteMode || thingsToDoCollapsed) {
            setFabAnchorHeight(h);
          }
        }}
      >
        {!sheetMode ? (
          <View
            style={styles.dragHandleArea}
            accessibilityRole="button"
            accessibilityLabel={
              thingsToDoCollapsed
                ? 'Drag bar — drag up or tap to expand recommendations'
                : 'Drag bar — drag down or tap to collapse recommendations'
            }
            accessibilityState={{ expanded: !thingsToDoCollapsed }}
            {...dragHandleResponder.panHandlers}
          >
            <DragHandle />
          </View>
        ) : (
          <DragHandle />
        )}

        <Animated.View style={{ opacity: sheetOpacity }}>
          {!sheetMode ? (
            <HomeBrowseSheet
              firstName={userFirstName}
              userLocation={userLocation}
              refreshKey={focusRefreshKey}
              collapsed={thingsToDoCollapsed}
              onExpand={() => {
                if (!thingsToDoCollapsed) return;
                if (!reduceMotion) {
                  configureLayoutSpring();
                }
                haptics.shift();
                setThingsToDoCollapsed(false);
              }}
              onSelectRecommendation={(rec) => {
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
                haptics.tap();
                router.push('/report');
              }}
            />
          ) : (
            <RoutePreviewCard
              routes={routes}
              recommended={recommended}
              selectedRoute={selectedRoute}
              onSelectRoute={setSelectedRouteId}
              enabledZones={enabledZones}
              params={params}
              cloudCoverPct={cloudCoverPct}
              isCalculatingRoute={isCalculatingRoute}
              routeFetchSource={routeFetchSource}
              tripZonesStatus={tripZonesStatus}
              tripZonesFetchFailed={tripZonesFetchFailed}
              tripZonesCorridorComplete={tripZonesCorridorComplete}
              onCorridorRetry={() => setCorridorRetryTick((t) => t + 1)}
              onHazardChipPress={handleRouteHazardChipPress}
              onSafeChipPress={handleRouteSafeChipPress}
              preferredStations={preferredStations}
              fuelType={fuelProfile?.fuelType}
            />
          )}
        </Animated.View>
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
              // Recenter sits above Report in the stack: clear the sheet
              // anchor + Report FAB height + the inter-FAB gap.
              bottom:
                fabAnchorHeight +
                FAB_ANCHOR_GAP +
                FAB_HEIGHT +
                FAB_STACK_GAP,
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
              // Report FAB sits closest to the sheet — just clear the
              // sheet-anchor gap.
              bottom: fabAnchorHeight + FAB_ANCHOR_GAP,
            }}
          >
            <SidebtnReport width={32} height={32} />
          </FloatingActionButton>
        </>
      )}

      {/* Placement mode controls — confirm / cancel bar at the bottom. */}
      {placingReport && (
        <HomePlacementOverlay
          onConfirm={handleConfirmPlacement}
          onCancel={handleCancelPlacement}
        />
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
          routeContextLine={reportRouteContextLine(
            enabledReportZones.find((z) => z.id === selectedReport.zoneId),
            selectedRoute ?? null,
          )}
          onDismiss={() => setSelectedReport(null)}
          onRemove={
            enabledReportZones.find(
              (z) => z.id === selectedReport.zoneId && z.reportSubmittedBy === user?.id,
            )
              ? () => {
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
                            await removeCommunityReport(selectedReport.zoneId);
                            const refreshed = await getCommunityReportsAsZones();
                            setReportZones(refreshed);
                          } catch (err) {
                            const { title, body } = getErrorMessage('save', 'transient', err);
                            Alert.alert(title, body);
                          }
                          setSelectedReport(null);
                        },
                      },
                    ],
                  );
                }
              : undefined
          }
        />
      )}
      {selectedZone && (
        <ZoneDetailCard
          zone={selectedZone}
          onDismiss={() => setSelectedZone(null)}
        />
      )}
      {routeHazardSession && !placingReport && (() => {
        const { entry, list, index } = routeHazardSession;
        const category = zoneToHazardCategory(entry.zone);
        if (!category || category === 'community-alert') return null;
        return (
          <RouteHazardDetailCard
            category={category}
            lengthMiles={zoneLengthMiles(
              entry.zone,
              selectedRoute?.coordinates,
            )}
            hazardIndex={index}
            hazardCount={list.length}
            destinationName={params.destName}
            onPrevious={
              index > 0
                ? () =>
                    focusRouteHazardAtIndex(
                      selectedRouteHazard!.hazardType,
                      index - 1,
                    )
                : undefined
            }
            onNext={
              index < list.length - 1
                ? () =>
                    focusRouteHazardAtIndex(
                      selectedRouteHazard!.hazardType,
                      index + 1,
                    )
                : undefined
            }
            onDismiss={() => setSelectedRouteHazard(null)}
          />
        );
      })()}

      <FuelStopsSheet
        visible={showFuelStops}
        loading={fuelStopsOnRoute.loading}
        error={fuelStopsOnRoute.error}
        stops={sortedFuelStopsOnRoute}
        fuelType={fuelProfile?.fuelType ?? 'gas'}
        highlightStopId={highlightFuelStopId}
        onSelectStop={handleSelectFuelStopOnMap}
        onClose={() => {
          setShowFuelStops(false);
          setHighlightFuelStopId(null);
        }}
        isPreferred={isPreferredFuelStop}
        onTogglePreferred={handleTogglePreferredFuelStop}
      />

      <LiveSafetySheet />

      {mapCoach.visible && (
        <Pressable
          style={styles.mapCoachScrim}
          onPress={mapCoach.dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss map guide"
        >
          <View style={styles.mapCoachCard}>
            <Text style={styles.mapCoachTitle}>Built on community knowledge</Text>
            <Text style={styles.mapCoachBody}>
              Colored zones show lighting, road conditions, and community alerts
              along a route.
              {'\n\n'}Pins are places drivers have flagged for each other — the
              Green Book tradition, kept current.
              {'\n\n'}Long-press anywhere on the map to save that spot as your home.
            </Text>
            <Pressable
              onPress={mapCoach.dismiss}
              style={({ pressed }) => [styles.mapCoachButton, pressed && pressedFeedback]}
              accessibilityRole="button"
              accessibilityLabel="Got it, dismiss the map guide"
            >
              <Text style={styles.mapCoachButtonText}>Got it</Text>
            </Pressable>
          </View>
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
  mapCoachScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.modalScrimStrong,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl * 3 + spacing.xl, // clear top chrome (search + chips)
  },
  mapCoachCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm + spacing.xs, // 12pt
    ...shadows.e2,
    maxWidth: 320,
  },
  mapCoachTitle: {
    ...dynamicType(typography.title3Emphasized),
    color: colors.black,
  },
  mapCoachBody: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.labelSecondary,
  },
  mapCoachButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.wiltedgreen,
    borderWidth: 1,
    borderColor: colors.wiltedgreen,
    marginTop: spacing.xs,
  },
  mapCoachButtonText: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.white,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // SafeAreaView's edges=['top'] adds the system inset (~47pt on
    // iPhone X+). Adding 23pt on top of that brings the search bar to
    // ~70pt from screen top, matching Figma's pt-[70px].
    paddingTop: spacing.lg,
    gap: spacing.lg,
    alignItems: 'center',
    // No horizontal padding — children set their own widths so the menu
    // button can left-align with the search bar's left edge (both 374pt).
  },
  dragHandleArea: {
    // Wraps the 4pt DragHandle bar with vertical padding so the
    // touchable region is ~40pt tall — comfortable to grab mid-drive.
    // The DragHandle itself stays visually 4pt; this only expands
    // the gesture's hit area.
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  menuRow: {
    // Responsive: stretch to parent width with 16pt margins on each
    // side. Menu button sits left, optional dev-reset chip sits right
    // via justifyContent: 'space-between'. With only the menu (production
    // build), the chip is gone and the menu still aligns to start —
    // space-between with one child collapses to flex-start behavior.
    alignSelf: 'stretch',
    marginHorizontal: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  // __DEV__-only reset chip in the menuRow's right slot. Low-key pill so
  // it reads as a dev tool, not a shipped affordance — and it never
  // renders in production (the JSX is gated on `__DEV__`).
  devResetChip: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.systemGroupedBackground,
    borderWidth: 1,
    borderColor: colors.separatorSubtle,
  },
  devResetChipText: {
    ...dynamicType(typography.footnoteEmphasized),
    color: colors.labelSecondary,
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
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingTop: 12,
    gap: spacing.md,
    // Shadow points UP since the sheet floats above content from the
    // bottom edge — `shadows.sheet` bundles the directional offset.
    ...shadows.sheet,
  },
  // ScrollView wrapper around the route-mode body content. flexShrink: 1
  // lets the scroller cede space to the always-visible actionsRow when
  // total content (chips + via + trusted-on-route + tradeoff at AX5)
  // exceeds the sheet's maxHeight. Without it the Go button would push
  // off-screen at largest Dynamic Type — the v2-default behavior the
  // 2026-06-23 critique flagged as P2 on /home.
  bottomSheetScroll: {
    flexShrink: 1,
  },
  bottomSheetContent: {
    gap: spacing.md,
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
});
