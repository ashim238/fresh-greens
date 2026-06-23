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
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  LayoutAnimation,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArrowClockwise } from 'phosphor-react-native/src/icons/ArrowClockwise';
import { ArrowRight } from 'phosphor-react-native/src/icons/ArrowRight';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { PathIcon } from 'phosphor-react-native/src/icons/Path';
import { Star } from 'phosphor-react-native/src/icons/Star';
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
import { EnRouteZone } from '../components/EnRouteZone';
import { FuelStopMarker } from '../components/FuelStopMarker';
import { FuelStopsSheet } from '../components/FuelStopsSheet';
import { DragHandle } from '../components/DragHandle';
import { EdgeIndicator } from '../components/EdgeIndicator';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { HomeBrowseSheet } from '../components/HomeBrowseSheet';
import { MaterialSurface } from '../components/MaterialSurface';
import { LandmarkMarker, variantForCategoryId } from '../components/LandmarkMarker';
import { LiveSafetySheet } from '../components/LiveSafetySheet';
import { ReportDetailCard } from '../components/ReportDetailCard';
import { RouteHazardDetailCard } from '../components/RouteHazardDetailCard';
import { ZoneDetailCard } from '../components/ZoneDetailCard';
import { LoadingState } from '../components/StateCard';
import { SavedPlaceBookmark } from '../components/SavedPlaceBookmark';
import { SearchBar } from '../components/SearchBar';
import { UserLocationMarker } from '../components/UserLocationMarker';
import { useFuelProfile } from '../hooks/useFuelProfile';
import { useRouteFuelStops } from '../hooks/useRouteFuelStops';
import { usePreferences } from '../hooks/usePreferences';
import { usePreferredStations } from '../hooks/usePreferredStations';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useCoachMark } from '../hooks/useCoachMark';
import { useRegularDestinations } from '../hooks/useRegularDestinations';
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
import { isRegularLocation } from '../lib/api/regular-destinations';
import {
  getRoutesBetween,
  primaryRoadName,
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
import {
  ALL_CLEAR_A11Y_LONG_TRIP,
  LONG_TRIP_COPY_METERS,
  LONG_TRIP_FOOTNOTE_COPY,
  PARTIAL_DEBOUNCE_MS,
} from '../lib/corridor/constants';
import { maybeWarmZoneTile } from '../lib/corridor/passive-zone-tiles';
import { getErrorMessage } from '../lib/error-message';
import { pathLengthMeters } from '../lib/geo';
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
import { colors } from '../theme/colors';
import { pressedDim, tapTarget44 } from '../theme/interaction';
import { mapStyle } from '../theme/map-style';
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

// Hazard chip types charted on the route-preview card, in display order.
// `community` leads — a community "someone felt unsafe HERE" is the most
// directly relevant signal (the thesis claim), then the OSM-derived ones.
// "All clear" shows only when a route passes NONE of these.
const ROUTE_HAZARD_ORDER = [
  'community',
  'police',
  'lowLight',
  'wildlife',
  'road',
] as const;
type RouteHazardType = (typeof ROUTE_HAZARD_ORDER)[number];

// [singular, plural] chip labels per hazard type.
const ROUTE_HAZARD_LABEL: Record<RouteHazardType, readonly [string, string]> = {
  community: ['community flag', 'community flags'],
  police: ['police zone', 'police zones'],
  lowLight: ['low light zone', 'low light zones'],
  wildlife: ['wildlife zone', 'wildlife zones'],
  road: ['road condition', 'road conditions'],
};

// Safe-zone chips charted ALONGSIDE hazards on the route-preview card,
// in display order. These surface the *offset* against the visible
// hazards — the algorithm sums hazards (negative) and safe zones
// (positive) into one net score, but only the negatives showed on the
// chip row, making the recommendation feel wrong when a hazard-heavier
// route won via more safe-tagged streets (user-flagged 2026-06-04:
// "why is the route with 2 community flags the safest"). The two safe
// signals are deliberately distinct: 'lit street' is an OSM lighting
// signal (lit=yes / 24-7 / automatic); 'residential' is Jane Jacobs'
// eyes-on-street theory rendered as the OSM landuse=residential tag.
// Only renders when hazards are present (the All-clear chip alone
// holds for genuinely-clear routes).
const ROUTE_SAFE_ORDER = ['litStreet', 'residential'] as const;
type RouteSafeType = (typeof ROUTE_SAFE_ORDER)[number];

const ROUTE_SAFE_LABEL: Record<RouteSafeType, readonly [string, string]> = {
  litStreet: ['lit street', 'lit streets'],
  residential: ['residential block', 'residential blocks'],
};

/**
 * Which safe chip a zone contributes to, or null if the zone isn't a
 * charted safe signal. The two we surface are the same `safe`-typed
 * zones that contribute the +2 to scoreRoute — lit streets (lighting
 * + safe) and residential landuse (landuse + safe). Felt-welcome /
 * black-owned community-report safes aren't charted here: those land
 * as the orange eye / heart pins on the map, not as route-level chips.
 */
function routeSafeType(zone: Zone): RouteSafeType | null {
  if (zone.type !== 'safe') return null;
  if (zone.category === 'lighting') return 'litStreet';
  if (zone.category === 'landuse') return 'residential';
  return null;
}

/**
 * Which hazard chip a zone contributes to, or null if it's not a charted
 * hazard. Safe-typed zones (lit=yes, felt-welcome, black-owned, residential
 * landuse) never warn. community-report and lighting only chart their
 * AVOID variants (felt-unsafe/incident; lit=no) — a caution-level lighting
 * report isn't a low-light warning.
 */
type RouteHazardOnPath = {
  zone: Zone;
  focus: Coordinate;
  distanceAlongM: number;
};

/** All distinct hazards of a chip type on the route, ordered from start → end. */
function routeHazardsOnPath(
  hazardType: RouteHazardType,
  routeCoordinates: Coordinate[],
  zones: Zone[],
): RouteHazardOnPath[] {
  const seen = new Set<string>();
  const hits: RouteHazardOnPath[] = [];

  for (const zone of zones) {
    if (routeHazardType(zone) !== hazardType) continue;
    if (!routePassesZone(routeCoordinates, zone)) continue;
    const anchor = zoneAnchor(zone);
    if (!anchor) continue;
    const dedupeKey = zone.canonicalHazardKey ?? zone.id;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const focus =
      zone.category === 'community-report'
        ? anchor
        : nearestPointOnPolyline(anchor, routeCoordinates);
    hits.push({
      zone,
      focus,
      distanceAlongM: distanceAlongRouteMeters(focus, routeCoordinates),
    });
  }

  hits.sort((a, b) => a.distanceAlongM - b.distanceAlongM);
  return hits;
}

/** First zone on the route matching a safe chip type — map focus target. */
function firstRouteSafeOnPath(
  safeType: RouteSafeType,
  routeCoordinates: Coordinate[],
  zones: Zone[],
): { zone: Zone; focus: Coordinate } | null {
  for (const zone of zones) {
    if (routeSafeType(zone) !== safeType) continue;
    if (!routePassesZone(routeCoordinates, zone)) continue;
    const anchor = zoneAnchor(zone);
    if (!anchor) continue;
    return {
      zone,
      focus: nearestPointOnPolyline(anchor, routeCoordinates),
    };
  }
  return null;
}

function routeHazardType(zone: Zone): RouteHazardType | null {
  if (zone.type === 'safe') return null;
  switch (zone.category) {
    case 'community-report':
      return zone.type === 'avoid' ? 'community' : null;
    case 'police':
      return 'police';
    case 'lighting':
      return zone.type === 'avoid' ? 'lowLight' : null;
    case 'wildlife':
      return 'wildlife';
    case 'road-condition':
      return 'road';
    default:
      return null;
  }
}

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
  // docs/superpowers/specs/2026-06-01-zone-overlay-tap-info-design.md
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
  const isRecommendedSelected = selectedRoute?.id === recommended?.id;

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

  // Route cycling via the chevron pair in routeTopRow. `routes` is
  // recommended-first; right chevron → next (dir: 1), left → previous
  // (dir: -1). Clamped (no wrap) so the chevrons can hint the ends by
  // going transparent. Each tap stamps `lastCycleDirRef` so the
  // minutesOpacity entrance animation below knows which way the ETA
  // should slide in from (right tap → slides in from the right, mirror
  // for left). The earlier rev had a PanResponder-driven swipe on the
  // ETA group; user-flagged 2026-06-03 — chevrons in the middle of the
  // headline interrupted the ETA's reading flow, so they moved to the
  // top row and the gesture became tap + a directional slide animation.
  const lastCycleDirRef = useRef<1 | -1 | null>(null);
  function cycleRoute(dir: 1 | -1) {
    if (routes.length < 2) return;
    const cur = routes.findIndex((r) => r.id === selectedRoute?.id);
    const next = Math.min(routes.length - 1, Math.max(0, cur + dir));
    if (next === cur) return;
    lastCycleDirRef.current = dir;
    Haptics.selectionAsync().catch(() => {});
    setSelectedRouteId(routes[next].id);
  }
  const selectedIndex = routes.findIndex((r) => r.id === selectedRoute?.id);
  const canPrevRoute = selectedIndex > 0;
  const canNextRoute = selectedIndex >= 0 && selectedIndex < routes.length - 1;

  // The primary road the recommended route travels (longest named
  // step). This is what the "Via" line should surface — the main road
  // you take to get there — NOT the destination, which already sits in
  // the search bar above. Null when the source returned step-less or
  // unnamed geometry (mock routes, some OSRM responses).
  const viaRoad = primaryRoadName(selectedRoute?.steps);

  // Arrival clock time = now + ETA. Distance from the route (m → mi).
  // (All derive from selectedRoute so the card follows route switching.)
  const arrivalTime =
    selectedRoute != null
      ? formatTimeOfDay(new Date(Date.now() + selectedRoute.estimatedMinutes * 60_000))
      : null;
  const METERS_PER_MILE = 1609.34;
  const distanceLabel =
    selectedRoute?.distanceMeters != null
      ? formatDistance(selectedRoute.distanceMeters / METERS_PER_MILE)
      : null;
  // Arrival daylight band = the last gradient segment's band (≈ destination).
  // Sighted users also read this via the daylight strip's sun/moon glyphs +
  // the polyline gradient; the strip is accessibilityElementsHidden, so the
  // arrival context is folded into the conditions caption's a11y label below.
  const arrivalSegs = selectedRoute ? gradientSegments(selectedRoute) : [];
  const arrivalBand = arrivalSegs.length
    ? arrivalSegs[arrivalSegs.length - 1].band
    : null;
  const arrivalLabel = arrivalBand ? arrivalLightLabel(arrivalBand, cloudCoverPct) : null;

  // Honest conditions caption: the recommended route IS the safest, so it
  // gets the "Safest route" framing. An alternate the user switched to is
  // NOT — relabeling it "safest" would lie — so it reads "Alternate route
  // · {faster/longer}" instead. Safety still picked the recommended; this
  // reflects the user's choice to take a different one.
  const routeIsAlternate = selectedRoute != null && !isRecommendedSelected;
  const routeSpeedVsRecommended =
    selectedRoute && recommended
      ? Math.round(selectedRoute.estimatedMinutes - recommended.estimatedMinutes)
      : 0;
  const routeSpeedLabel =
    routeSpeedVsRecommended < 0
      ? `${Math.abs(routeSpeedVsRecommended)} min faster`
      : routeSpeedVsRecommended > 0
        ? `${routeSpeedVsRecommended} min longer`
        : 'about the same time';
  const routeConditionsText = routeIsAlternate
    ? `Alternate route · ${routeSpeedLabel}${arrivalLabel ? ` · ${arrivalLabel}` : ''}.`
    : arrivalLabel
      ? `Safest route · ${arrivalLabel}.`
      : 'Safest route with current conditions.';
  const routeConditionsA11y = routeIsAlternate
    ? routeConditionsText
    : arrivalLabel || arrivalTime
      ? `Safest route. ${
          arrivalLabel
            ? arrivalLabel.charAt(0).toUpperCase() + arrivalLabel.slice(1)
            : 'Arriving'
        }${arrivalTime ? ` at ${arrivalTime}` : ''}.`
      : 'Safest route with current conditions.';

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
  // Uses `routePassesZone` (same route-level test as scoreRoute +
  // routeConditions) so the chip COUNTS match the chip presence and the
  // score — including the line-based detection that catches a police
  // POINT zone the per-waypoint test would miss between sparse waypoints.
  // Comprehensive hazard chips for the route-preview card: counts of every
  // charted hazard type (community flags, police, low-light, wildlife, road)
  // the SELECTED route passes — via routePassesZone, the same route-level
  // line-based test the score uses, so chip presence + counts + score all
  // agree. Earlier this only counted OSM police + low-light, so community
  // reports (and wildlife/road) couldn't turn off "All clear" — a route
  // with felt-unsafe pins on it still read "All clear" (user-flagged
  // 2026-06-03). Returns chips in ROUTE_HAZARD_ORDER; empty → truly clear.
  const routeHazardChips = useMemo(() => {
    if (!selectedRoute) return [] as { type: RouteHazardType; count: number; label: string }[];
    const counts = {} as Record<RouteHazardType, number>;
    const seen = new Set<string>();
    for (const zone of enabledZones) {
      const type = routeHazardType(zone);
      if (!type) continue;
      if (!routePassesZone(selectedRoute.coordinates, zone)) continue;
      const dedupeKey = `${type}:${zone.canonicalHazardKey ?? zone.id}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      counts[type] = (counts[type] ?? 0) + 1;
    }
    return ROUTE_HAZARD_ORDER.filter((t) => (counts[t] ?? 0) > 0).map((t) => {
      const count = counts[t];
      return { type: t, count, label: count === 1 ? ROUTE_HAZARD_LABEL[t][0] : ROUTE_HAZARD_LABEL[t][1] };
    });
  }, [selectedRoute, enabledZones]);

  // Safe-zone chips — the OFFSET that the hazards score against. Same
  // routePassesZone predicate as the chips + score, counted ONCE per
  // distinct safe zone (NOT per waypoint — "Franklin passes 27 waypoints
  // in lit zones" is meaningless; "Franklin passes 3 lit-street
  // stretches" is intelligible). Only computed when hazards are present
  // (the caller skips rendering otherwise — All-clear alone is the
  // clean state for a truly-clear route, and showing safe counts there
  // would clutter without serving the "why" question this surfaces).
  const routeSafeChips = useMemo(() => {
    if (!selectedRoute) return [] as { type: RouteSafeType; count: number; label: string }[];
    const counts = {} as Record<RouteSafeType, number>;
    for (const zone of enabledZones) {
      const type = routeSafeType(zone);
      if (!type) continue;
      if (!routePassesZone(selectedRoute.coordinates, zone)) continue;
      counts[type] = (counts[type] ?? 0) + 1;
    }
    return ROUTE_SAFE_ORDER.filter((t) => (counts[t] ?? 0) > 0).map((t) => {
      const count = counts[t];
      return { type: t, count, label: count === 1 ? ROUTE_SAFE_LABEL[t][0] : ROUTE_SAFE_LABEL[t][1] };
    });
  }, [selectedRoute, enabledZones]);

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
      Haptics.selectionAsync().catch(() => {});
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
      Haptics.selectionAsync().catch(() => {});
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
    Haptics.selectionAsync().catch(() => {});
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

  // Read-only over scoring: is a trusted station near the selected route?
  // ~150m tolerance — "near your way", looser than the ~78m station-
  // identity match. Does NOT influence which route is chosen.
  const trustedStationOnRoute = useMemo(() => {
    if (!selectedRoute || preferredStations.length === 0) return false;
    return preferredStations.some((s) =>
      isPointNearPolyline(
        { latitude: s.latitude, longitude: s.longitude },
        selectedRoute.coordinates,
        150,
      ),
    );
  }, [selectedRoute, preferredStations]);

  // "station" vs "charger" by fuel type (fuelProfile is the existing
  // useFuelProfile() value — use the file's actual variable name).
  const trustedNoun = fuelProfile?.fuelType === 'electric' ? 'charger' : 'station';

  // Route-preview headline reveal — fire a single light haptic + a
  // 240ms opacity fade on the "{N} min" text the first time a given
  // destination's route resolves. The em-dash → minutes transition
  // is the most important moment on the card and previously had no
  // entrance. Keyed on destination+minutes so it doesn't refire on
  // every re-render. Reduce Motion → skip the fade, fire the haptic
  // (the haptic doesn't depend on motion).
  const minutesOpacity = useRef(new Animated.Value(1)).current;
  // Paired with minutesOpacity for the route-cycle entrance — when a
  // chevron tap drove the selectedRoute change, the ETA slides in from
  // the direction of the tap (right chevron → slides in from +24pt;
  // left → from -24pt). Re-uses minutesOpacity's duration/easing so the
  // fade and slide land together. Reduce Motion → skip the translate,
  // keep the fade (the haptic carries the change either way).
  const routeShiftX = useRef(new Animated.Value(0)).current;
  const lastMinutesRevealKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedRoute || !params.destLat || !params.destLng) return;
    const key = `${params.destLat}|${params.destLng}|${selectedRoute.id}|${selectedRoute.estimatedMinutes}`;
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
      const cycleDir = lastCycleDirRef.current;
      lastCycleDirRef.current = null;
      minutesOpacity.setValue(0);
      // cycleDir non-null = the change came from a chevron tap, so
      // pair the fade with a directional slide-in. null = the change
      // came from somewhere else (route refetch, map-tap on an alt
      // line) — fade only, no slide.
      if (cycleDir != null) {
        routeShiftX.setValue(cycleDir * 24);
        Animated.parallel([
          Animated.timing(routeShiftX, {
            toValue: 0,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(minutesOpacity, {
            toValue: 1,
            duration: 240,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.timing(minutesOpacity, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      }
    }
  }, [
    selectedRoute,
    params.destLat,
    params.destLng,
    reduceMotion,
    minutesOpacity,
    routeShiftX,
  ]);

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
    suppressNextMapPressRef.current = true;
    Haptics.selectionAsync().catch(() => {});
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
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              ).catch(() => {});
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
      Haptics.selectionAsync().catch(() => {});
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
        Haptics.selectionAsync().catch(() => {});
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
                suppressNextMapPressRef.current = true;
                setSelectedZone(null);
                setSelectedRouteHazard(null);
                Haptics.selectionAsync().catch(() => {});
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
        // FAB stack (right), or the bottom sheet.
        //
        // The EdgeIndicator is a 72×72 box centered on its (x, y), so its
        // body reaches 36pt past its center toward each edge. Each inset
        // therefore clears the chrome's reach PLUS that 36pt half —
        // earlier they cleared only the chrome, so the indicator's CENTER
        // sat at the chrome edge and its body bled ~36pt into the right
        // FAB column and ~4pt off the left screen edge (user-flagged
        // 2026-06-03). The direction math (edgePositionForPoint) already
        // points the arrow at the POI relative to map center; this only
        // moves where on the inset rectangle it lands.
        const chromeInsets = {
          top: 232,          // search + menu stack (~196) + 36 indicator half
          right: 112,        // FAB column (to 72 from right) + 36 half + buffer
          bottom: (bottomSheetHeight || 0) + 64, // sheet + 64 (already > 36 half)
          left: 44,          // 8 minimal chrome + 36 half — keeps it on-screen
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
            onLongPress={
              __DEV__
                ? () => {
                    Haptics.selectionAsync().catch(() => {});
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
        !selectedRouteHazard && <MaterialSurface tier="sheet" style={styles.bottomSheetSurface}>
          <SafeAreaView
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
            Clear-destination row — right-aligned 44pt X plus, when
            there's more than one route, a chevron pair to switch
            between them. Chevrons sit immediately left of the X so
            all three controls right-align together as one cluster.
            Previously the chevrons flanked the ETA inline (with a
            swipe gesture as the primary interaction); user-flagged
            2026-06-03 — that interrupted the headline's reading
            flow, so they moved up here and the gesture became a
            tap + a directional slide-in animation on the ETA.
          */}
          <View style={styles.routeTopRow}>
            {routes.length > 1 && (
              <>
                <Pressable
                  onPress={() => cycleRoute(-1)}
                  disabled={!canPrevRoute}
                  accessibilityRole="button"
                  accessibilityLabel="Previous route"
                  accessibilityState={{ disabled: !canPrevRoute }}
                  style={({ pressed }) => [
                    tapTarget44,
                    !canPrevRoute && styles.routeCycleBtnDisabled,
                    pressed && canPrevRoute && pressedDim,
                  ]}
                >
                  <CaretLeft size={22} weight="bold" color={colors.labelSecondary} />
                </Pressable>
                {/* Sighted route count — the chevron pair alone doesn't say
                    how many alternates exist; this anchors "where am I in
                    the set." VoiceOver already gets it from the ETA label,
                    so hide this from AT to avoid a double read. */}
                <Text
                  style={styles.routeCountLabel}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  {selectedIndex + 1} of {routes.length}
                </Text>
                <Pressable
                  onPress={() => cycleRoute(1)}
                  disabled={!canNextRoute}
                  accessibilityRole="button"
                  accessibilityLabel="Next route"
                  accessibilityState={{ disabled: !canNextRoute }}
                  style={({ pressed }) => [
                    tapTarget44,
                    !canNextRoute && styles.routeCycleBtnDisabled,
                    pressed && canNextRoute && pressedDim,
                  ]}
                >
                  <CaretRight size={22} weight="bold" color={colors.labelSecondary} />
                </Pressable>
              </>
            )}
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
            toggle. Saved regulars show the bookmark glyph (not underline).
          */}
          <Pressable
            onPress={handleToggleRegular}
            accessibilityRole="button"
            accessibilityLabel={`${params.destName ?? 'Destination'}. ${
              isRegularDestination ? 'Saved as a regular' : 'Tap to save as a regular'
            }.`}
            style={({ pressed }) => [styles.routeDestTitleHit, pressed && pressedDim]}
          >
            <View style={styles.routeDestTitleRow}>
              <Text style={styles.routeDestTitle} numberOfLines={1}>
                {params.destName ?? 'your destination'}
              </Text>
              {/* Bookmark is always present as the save affordance — hollow
                  (default) when not yet saved so the action is discoverable
                  before the tap, filled (selected) once saved. Trailing,
                  per the iOS Maps/Reminders save-affordance convention. */}
              <SavedPlaceBookmark
                size={16}
                variant={isRegularDestination ? 'selected' : 'default'}
              />
            </View>
          </Pressable>

          {/*
            Hero row: "{N} min" headline + promoted arrival time.
            routeHeroRow owns the 24pt gutter so the old routeHeadlineRow
            wrapper (which also had paddingHorizontal: 24) is gone —
            the Animated.Text is moved directly inside here to avoid
            double-padding. The animated style array is preserved verbatim.
          */}
          <View style={styles.routeHeroRow}>
            {/* ETA — reads clean as the headline number. Route-switching
                lives in the chevron pair in routeTopRow above (tap to
                advance) and as direct taps on the gray alternate route
                lines on the map. The translateX paired with opacity gives
                the ETA a directional slide-in when a chevron drives the
                change — right chevron → slides in from +24pt, left chevron
                → from -24pt — so the swap feels spatially anchored to
                which side was tapped. */}
            <Animated.Text
              style={[
                styles.routeMinutes,
                { opacity: minutesOpacity, transform: [{ translateX: routeShiftX }] },
              ]}
              accessibilityLabel={`${
                selectedRoute ? formatDuration(selectedRoute.estimatedMinutes) : 'No route'
              }${routes.length > 1 ? `, route ${selectedIndex + 1} of ${routes.length}` : ''}`}
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
              {selectedRoute ? formatDuration(selectedRoute.estimatedMinutes) : '—'}
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

            Via never carries the saved-regular marker — the title owns it.
          */}
          <View style={styles.routeViaRow}>
            <Text style={styles.routeViaLabel} numberOfLines={1}>
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
            accessibilityLabel={routeConditionsA11y}
          >
            {routeConditionsText}
          </Text>


          {recommended && trustedStationOnRoute && (
            <View style={styles.trustedOnRouteRow}>
              <Star size={16} color={colors.burntgreen} weight="fill" />
              <Text style={styles.trustedOnRouteText}>
                A {trustedNoun} you trust is on this route.
              </Text>
            </View>
          )}

          {recommended && tripZonesStatus !== 'idle' && (
            <>
            <View style={styles.routeChipsBlock}>
              {/*
                Three render paths:
                  - OSM corridor still loading → gray "Checking route…"
                    chip (never All-clear while data is in flight).
                  - Warnings present → "Along this route:" + orange chips.
                  - Checks complete, no hazards → All-clear chip alone.
              */}
              {tripZonesStatus === 'loading' ? (
                <View
                  style={styles.routeChipsRow}
                  accessibilityLabel="Checking route for hazards along this path."
                  accessibilityLiveRegion="polite"
                >
                  <RouteZonesLoadingChip />
                </View>
              ) : tripZonesFetchFailed ? (
                <View style={styles.routeChipsRow} accessibilityLiveRegion="polite">
                  <RouteZonesFetchFailedChip
                    onRetry={() => setCorridorRetryTick((t) => t + 1)}
                  />
                </View>
              ) : routeHazardChips.length > 0 ? (
                <>
                  <Text style={styles.routeChipsHeader}>Along this route:</Text>
                  <View
                    style={styles.routeChipsRow}
                    // Hazards then safes in one sentence — VoiceOver gets
                    // the full picture instead of just the negative half.
                    accessibilityLabel={[
                      ...routeHazardChips.map((c) => `${c.count} ${c.label}`),
                      ...routeSafeChips.map((c) => `${c.count} ${c.label}`),
                    ]
                      .join(', ')
                      .concat(' along this route.')}
                  >
                    {routeHazardChips.map((c) => (
                      <RouteWarningChip
                        key={c.type}
                        count={c.count}
                        label={c.label}
                        onPress={() => handleRouteHazardChipPress(c.type)}
                      />
                    ))}
                    {/* Safe-zone chips render AFTER the hazards — they're
                        the offset that lets a hazard-heavier route win on
                        net score (e.g. Franklin Ave's many lit-street
                        stretches outweigh its 2 community flags). Showing
                        the negative half alone made the recommendation
                        feel wrong (user-flagged 2026-06-04). */}
                    {routeSafeChips.map((c) => (
                      <RouteSafeChip
                        key={c.type}
                        count={c.count}
                        label={c.label}
                        onPress={() => handleRouteSafeChipPress(c.type)}
                      />
                    ))}
                  </View>
                </>
              ) : tripZonesStatus === 'ready' && tripZonesCorridorComplete ? (
                <View
                  style={styles.routeChipsRow}
                  accessibilityLabel={
                    selectedRoute &&
                    pathLengthMeters(selectedRoute.coordinates) >
                      LONG_TRIP_COPY_METERS
                      ? ALL_CLEAR_A11Y_LONG_TRIP
                      : 'No reported hazards or flagged zones along this route.'
                  }
                >
                  <RouteAllClearChip />
                </View>
              ) : null}
            </View>
            {selectedRoute &&
              pathLengthMeters(selectedRoute.coordinates) >
                LONG_TRIP_COPY_METERS &&
              tripZonesStatus === 'ready' &&
              tripZonesCorridorComplete &&
              !tripZonesFetchFailed && (
                <Text
                  style={[
                    styles.routeChipsFootnote,
                    dynamicType(typography.footnoteRegular),
                  ]}
                  accessibilityRole="text"
                >
                  {LONG_TRIP_FOOTNOTE_COPY}
                </Text>
              )}
            </>
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
                  const { title, body } = getErrorMessage('save', 'transient');
                  Alert.alert(title, body);
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
                  // Prime /en-route with the SELECTED route's
                  // estimatedMinutes + distanceMeters so its ETA,
                  // duration, and mileage all render immediately on
                  // mount instead of waiting for /en-route's own
                  // OSRM fetch to resolve. /en-route still re-fetches
                  // and refines the values; this just removes the
                  // visible "—" placeholders during the network call.
                  // destRouteRank carries WHICH route the user chose
                  // (0 = recommended/safest, 1+ = an alternate) so
                  // /en-route starts navigating that one, not its own
                  // default recommended.
                  ...(selectedRoute
                    ? {
                        destEstMinutes: String(selectedRoute.estimatedMinutes),
                        destDistanceMeters: String(selectedRoute.distanceMeters),
                        destRouteRank: String(Math.max(0, selectedIndex)),
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
          </SafeAreaView>
        </MaterialSurface>}

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
              {'\n\n'}Long-press anywhere to save it as your home.
            </Text>
            <Pressable
              onPress={mapCoach.dismiss}
              style={({ pressed }) => [styles.mapCoachButton, pressed && pressedDim]}
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

/**
 * Inline chip for the route-preview card's zone-warning row (Figma
 * 1109:3264). Each chip is a light pill with an orange WarningDiamond
 * icon on the left and a count-prefixed label on the right
 * ("1 police zone"). Rendered conditionally — chips never show with
 * count=0. The accessibilityLabel is provided at the row level (so
 * VoiceOver reads "1 police zone and 1 low-light zone along this
 * route" once, not per-chip).
 */
function RouteWarningChip({
  count,
  label,
  onPress,
}: {
  count: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.routeChip,
        styles.routeChipPressable,
        pressed && pressedDim,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Show ${count} ${label} on map`}
    >
      {/* H4: 24pt → 16pt. Chip is ~40pt tall; a 24pt glyph filled 60%
          of the pill height and dominated the chip's tag-row register.
          16pt matches the topline-callout chip family's icon weight. */}
      <WarningDiamond size={16} color={colors.orange} weight="fill" />
      <Text style={styles.routeChipText}>
        {count} {label}
      </Text>
    </Pressable>
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

/** Gray chip while OSM zones for this trip are still loading / refining. */
function RouteZonesLoadingChip() {
  return (
    <View
      style={styles.routeZonesLoadingChip}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <ActivityIndicator size="small" color={colors.labelSecondary} />
      <Text style={styles.routeZonesLoadingText}>Checking route…</Text>
    </View>
  );
}

/** Gray chip when corridor OSM fetch failed — not All clear. */
function RouteZonesFetchFailedChip({ onRetry }: { onRetry: () => void }) {
  return (
    <Pressable
      onPress={onRetry}
      style={({ pressed }) => [styles.routeZonesRetryChip, pressed && pressedDim]}
      accessibilityRole="button"
      accessibilityLabel="Couldn't check this route for hazards"
      accessibilityHint="Tap to try the route check again"
    >
      <ArrowClockwise size={16} color={colors.labelSecondary} weight="bold" />
      <Text style={styles.routeZonesLoadingText}>Couldn't check route · Retry</Text>
    </Pressable>
  );
}

/**
 * Safe-zone chip — renders alongside the orange RouteWarningChips in the
 * "Along this route:" row to surface what's OFFSETTING the visible
 * hazards (lit streets the route passes, residential blocks, etc.).
 * Same fadedgreen/burntgreen safety-affirmative register as
 * RouteAllClearChip, distinguished from the warning chips by color (not
 * shape) and by a smaller Check glyph matching the family's 16pt icon
 * scale. Visually says "this counts FOR the route's safety."
 */
function RouteSafeChip({
  count,
  label,
  onPress,
}: {
  count: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.routeAllClearChip,
        styles.routeChipPressable,
        pressed && pressedDim,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Show ${count} ${label} on map`}
    >
      <Check size={16} color={colors.burntgreen} weight="bold" />
      <Text style={styles.routeAllClearText}>
        {count} {label}
      </Text>
    </Pressable>
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
    ...typography.title3Emphasized,
    color: colors.black,
  },
  mapCoachBody: {
    ...typography.subheadlineRegular,
    color: colors.labelSecondary,
  },
  mapCoachButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.freshgreen,
    borderWidth: 1,
    borderColor: colors.wiltedgreen,
    marginTop: spacing.xs,
  },
  mapCoachButtonText: {
    ...typography.footnoteEmphasized,
    color: colors.white,
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
  // __DEV__-only reset chip in the menuRow's right slot. Low-key pill so
  // it reads as a dev tool, not a shipped affordance — and it never
  // renders in production (the JSX is gated on `__DEV__`).
  devResetChip: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 16,
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
  // MaterialSurface wrapper — carries position, sizing, radius, and
  // the frosted-glass visual treatment (bg + shadow handled by tier="sheet").
  bottomSheetSurface: {
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  // SafeAreaView inside the MaterialSurface — layout only, no visuals.
  // flex:1 fills the MaterialSurface; paddingTop/gap give the drag
  // handle and content their breathing room.
  bottomSheet: {
    paddingTop: 12,
    gap: 12,
    flex: 1,
  },
  bottomSheetContent: {
    gap: 12,
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
  routeDestTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
  },
  // Destination title — card title + tappable save-as-regular toggle.
  routeDestTitle: {
    ...typography.title3Emphasized,
    color: colors.black,
    flex: 1,
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
    ...dynamicType(typography.subheadlineRegular),
    color: colors.labelSecondary,
    paddingBottom: 6,
  },
  // Distance line below the hero row.
  routeDistance: {
    ...dynamicType(typography.footnoteRegular),
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
    ...dynamicType(typography.largeTitleEmphasized),
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
    ...dynamicType(typography.subheadlineRegular),
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
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelTertiary,
    paddingHorizontal: 24,
  },
  trustedOnRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 24,
  },
  trustedOnRouteText: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.burntgreen,
  },
  routeChipsBlock: {
    gap: 8,
    // H16: lifted paddingHorizontal from each child (routeChipsHeader,
    // routeChipsRow) to the parent. Earlier pattern had each child
    // re-declare 24 independently — fragile coupling that would break
    // if a new chip type was added without copying the value.
    paddingHorizontal: 24,
  },
  routeChipsFootnote: {
    color: colors.labelTertiary,
    marginTop: 6,
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
  // overlap the daylight strip's moon glyph below. Also houses the
  // route-cycle chevron pair (when there's >1 route), sitting left of
  // the X so all three controls right-align as one cluster. alignItems
  // centers the smaller chevrons vertically against the 44pt X. The
  // chevrons are bare (transparent bg) so the X stays the only filled
  // circle in the row — three fillsTertiary circles would read heavy.
  routeTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 24,
  },
  // Disabled state — route-cycle chevrons use shared tapTarget44. — chevron stays visible but the whole control dims
  // so users see "you've reached the end of the list, this direction is
  // unavailable" rather than the affordance vanishing. Earlier rev
  // rendered the caret transparent at the ends; user-flagged 2026-06-03
  // — disappearing chevrons look broken, dimmed chevrons read as
  // "off." Opacity on the wrapper is the iOS-standard disabled-button
  // treatment (the Pressable's `disabled` prop already cuts taps).
  routeCycleBtnDisabled: {
    opacity: 0.25,
  },
  routeCountLabel: {
    ...typography.caption1Regular,
    color: colors.labelTertiary,
    minWidth: 44,
    textAlign: 'center',
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
    borderColor: colors.slightlyDarkOrange,
    backgroundColor: colors.white,
  },
  routeChipPressable: {
    minHeight: 44,
    justifyContent: 'center',
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
  routeZonesLoadingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: colors.fillsTertiary,
  },
  routeZonesRetryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.fillsTertiary,
  },
  routeZonesLoadingText: {
    ...typography.caption1Emphasized,
    color: colors.labelSecondary,
  },
  daylightBar: {
    height: 4,
    borderRadius: 100,
  },
  daylightIcons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    ...dynamicType(relaxedLineHeight(typography.footnoteRegular)),
    color: colors.labelTertiary,
    // Centered in the placement bar. Earlier rev anchored this left to
    // the Confirm CTA on the theory the asymmetric Confirm+X row pulled
    // the visual center off-axis; user-tested and overridden 2026-06-03 —
    // centered reads as instruction (addressed to the whole bar), left
    // read as a stray caption beside the buttons.
    textAlign: 'center',
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
