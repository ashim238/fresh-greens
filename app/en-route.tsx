import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Polygon, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

// Phosphor deep-imports — see app/trusted-contact-setup.tsx for the
// longer note on why we bypass the package's barrel index.
import { ArrowBendUpLeft } from 'phosphor-react-native/src/icons/ArrowBendUpLeft';
import { ArrowBendUpRight } from 'phosphor-react-native/src/icons/ArrowBendUpRight';
import { ArrowsClockwise } from 'phosphor-react-native/src/icons/ArrowsClockwise';
import { ArrowsMerge } from 'phosphor-react-native/src/icons/ArrowsMerge';
import { FlagCheckered } from 'phosphor-react-native/src/icons/FlagCheckered';
import { NavigationArrow } from 'phosphor-react-native/src/icons/NavigationArrow';
import { WifiSlash } from 'phosphor-react-native/src/icons/WifiSlash';
import { Shield } from 'phosphor-react-native/src/icons/Shield';

import EnRoutePath from '../assets/illustrations/enroute-path.svg';
import EnRouteSearch from '../assets/illustrations/enroute-search.svg';
import SidebtnHelp from '../assets/illustrations/sidebtn-help.svg';
import SidebtnRecenter from '../assets/illustrations/sidebtn-recenter.svg';
import SidebtnReport from '../assets/illustrations/sidebtn-report.svg';
import SidebtnVolume from '../assets/illustrations/sidebtn-volume.svg';
import TurnMic from '../assets/illustrations/turn-mic.svg';

// Daylight glyphs — same SVGs Figma uses on /home's gradient key
// (node 825:3647) so the symbol means the same thing on both
// surfaces: arrival in daylight (sun) vs darkness (moon).
import DaylightMoon from '../assets/illustrations/daylight-moon.svg';
import DaylightSun from '../assets/illustrations/daylight-sun.svg';

import { ClusterMarker } from '../components/ClusterMarker';
import { DestinationMarker } from '../components/DestinationMarker';
import { DragHandle } from '../components/DragHandle';
import { EnRouteZone } from '../components/EnRouteZone';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { Hazard } from '../components/Hazard';
import { LandmarkMarker } from '../components/LandmarkMarker';
import { LaneStrip } from '../components/LaneStrip';
import { EnRouteCarMarker } from '../components/EnRouteCarMarker';
import { ReportDetailCard } from '../components/ReportDetailCard';
import { usePreferences } from '../hooks/usePreferences';
import {
  getCommunityReportsAsZones,
  type ReportCategoryId,
} from '../lib/api/community-reports';
import {
  findNextStep,
  getRoutesBetween,
  type ManeuverKind,
  type NextStepInfo,
  type Route,
  type RouteSource,
  routeColors,
} from '../lib/api/routes';
import { clearActiveRoute } from '../lib/api/route-cache';
import {
  getZonesForRegion,
  type Zone,
  zoneColors,
  zoneDashPattern,
} from '../lib/api/zones';
import { clusterPointZones } from '../lib/clustering';
import { gradientSegments } from '../lib/daylight';
import { type Region } from '../lib/edge-indicators';
import { formatDistance, formatDuration } from '../lib/format';
import {
  hazardsNearTurn,
  isPointInZone,
  pickWinner,
  zoneAnchor,
  zoneLengthMiles,
  zoneToHazardCategory,
  type HazardCategory,
} from '../lib/scoring';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { mapStyle } from '../theme/map-style';
import { shadows } from '../theme/shadows';
import { typography } from '../theme/typography';

/**
 * En-Route — active driving state.
 * Route: /en-route
 * Figma node: 825:3754
 *
 * Shares the map data pipeline with /home (route polyline, daylight gradient,
 * community-report zones). Different chrome: turn-sign header replaces the
 * search bar, side button column replaces the lone report button, ETA-focused
 * bottom sheet replaces the trip-summary sheet.
 *
 * Map setup is intentionally duplicated from /home — this is the second use,
 * extraction waits for a third (rule of three).
 *
 * Turn instruction copy is a static placeholder for v1: OSRM gives route
 * geometry, not turn-by-turn instructions. Real navigation engines (Mapbox
 * Directions, Google Directions) would slot in later. The placeholder
 * communicates the design intent without faking instruction data.
 */
// Hazard ids carry hyphens (e.g. "road-condition") which screen
// readers literalize — VoiceOver says "road dash condition." Maps to
// human-readable strings for `accessibilityLabel` interpolation only;
// the on-screen icon component still takes the typed id.
function humanReadableHazard(category: HazardCategory): string {
  switch (category) {
    case 'lighting':
      return 'low lighting';
    case 'road-condition':
      return 'road condition';
    case 'wildlife':
      return 'wildlife';
    case 'community-alert':
      return 'community alert';
  }
}

// Zone-length formatter for the hazard panel's "For X mi." line.
// Same rule as `EnRouteZone`'s Extended pill (1 decimal under 10mi,
// rounded whole otherwise). Inlined here as the second consumer of
// the pattern; rule-of-three earns extraction to lib/format.ts when
// a third surface needs it.
function formatHazardMiles(miles: number): string {
  if (miles < 10) return `${miles.toFixed(1)} mi.`;
  return `${Math.round(miles)} mi.`;
}

/**
 * Phosphor duotone glyph dispatch for the turn-card. Maps the OSRM
 * maneuver kind → an icon that visually communicates the direction.
 * `undefined` (no steps from adapter) renders NavigationArrow, same
 * neutral indicator the v1 placeholder used.
 */
function maneuverIcon(kind: ManeuverKind | undefined, size: number, color: string) {
  switch (kind) {
    case 'left':
    case 'slight-left':
    case 'sharp-left':
      return <ArrowBendUpLeft size={size} color={color} weight="duotone" />;
    case 'right':
    case 'slight-right':
    case 'sharp-right':
      return <ArrowBendUpRight size={size} color={color} weight="duotone" />;
    case 'arrive':
      return <FlagCheckered size={size} color={color} weight="duotone" />;
    case 'roundabout':
      return <ArrowsClockwise size={size} color={color} weight="duotone" />;
    case 'merge':
      return <ArrowsMerge size={size} color={color} weight="duotone" />;
    case 'depart':
    case 'straight':
    default:
      return <NavigationArrow size={size} color={color} weight="duotone" />;
  }
}

/**
 * Formats step distance for the turn-card subtitle:
 *   < 30m: "now" (visible UI only — a11y label drops "in" entirely)
 *   < 1000m: "120 m" (rounded to nearest 10m)
 *   ≥ 1000m: "1.2 mi" (US units, one decimal)
 * Sub-30m short-circuits because GPS jitter at the maneuver point
 * makes "5 m" / "12 m" reads dance distractingly — at that range the
 * driver is on top of the turn and reading "now" instead.
 */
function formatStepDistance(meters: number): string {
  if (meters < 30) return 'now';
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  const miles = meters / 1609.344;
  return `${miles.toFixed(1)} mi`;
}

/**
 * VoiceOver-friendly turn-card label. Commas instead of "in" before
 * the distance (natural beat for screen readers); special-cased "now"
 * since "Turn left, in now" reads ungrammatically.
 *
 * Terminal states get their own copy:
 *   - arrived: "You've arrived at your destination"
 *   - off-route: "Recalculating route"
 *   - null (mock fallback): "Heading toward {destination}"
 */
function a11yLabelForTurnCard(
  info: NextStepInfo | null,
  destName: string | undefined,
): string {
  if (!info) return `Heading toward ${destName ?? 'your destination'}`;
  if (info.status === 'arrived') return "You've arrived at your destination";
  if (info.status === 'off-route') return 'Recalculating route';
  const dist = info.distanceMeters;
  if (dist < 30) return `${info.step.instruction}, now`;
  return `${info.step.instruction}, in ${formatStepDistance(dist)}`;
}

/**
 * Coarse cache-age stamp for the "Offline route" pill. Keeps the
 * pill tight — buckets to "minutes" / "hours" / "23h" so the pill
 * width doesn't dance as the clock ticks. Floors so the user never
 * sees a more-recent number than reality.
 */
function formatCacheAge(ms: number | null): string {
  if (ms == null || ms < 60_000) return 'just now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

// Sentence-form hazard copy for the Full bottom-sheet hazard panel
// (Figma 1133:13329). `humanReadableHazard` returns labels for
// VoiceOver interpolation; this returns the full-sentence variant
// the driver reads on the panel itself.
function hazardFullCopy(category: HazardCategory): string {
  switch (category) {
    case 'lighting':
      return 'Low lighting on this stretch';
    case 'road-condition':
      return 'Rough road ahead';
    case 'wildlife':
      return 'Wildlife crossing ahead';
    case 'community-alert':
      return 'Recent community alert ahead';
  }
}

export default function EnRoute() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const params = useLocalSearchParams<{
    destLat?: string;
    destLng?: string;
    destName?: string;
    /**
     * Optional priming values from /home — the recommended route's
     * estimatedMinutes + distanceMeters at the time the user tapped
     * Go. Let /en-route render the ETA, duration, and mileage on
     * first paint instead of "—" while its own OSRM fetch resolves.
     * Once the local fetch lands, the live values replace them.
     */
    destEstMinutes?: string;
    destDistanceMeters?: string;
  }>();
  // Zone overlay rendering follows /home — driven by the user's
  // preference, which lives in AsyncStorage and is toggled from
  // /menu's Zone Settings accordion. Default off until they flip it,
  // so first-time en-route users see a clean map; toggle persists
  // across sessions and applies on both /home and /en-route.
  const { preferences } = usePreferences();
  const showZones = preferences?.showZones ?? false;

  const [osmZones, setOsmZones] = useState<Zone[]>([]);
  const [reportZones, setReportZones] = useState<Zone[]>([]);
  const [rawRoutes, setRawRoutes] = useState<Route[]>([]);
  // Provenance of the rendered routes — drives the "Offline route" /
  // "Demo route" pill on the turn card. 'mapbox' = live primary;
  // 'osrm' = live fallback (network up, but Mapbox tier failed);
  // 'cache' = AsyncStorage hydration after both network tiers failed;
  // 'mock' = last-resort synthetic (network down AND no cache for
  // this destination). The background refetch loop tries to swap
  // non-mapbox sources → 'mapbox' non-jarringly.
  const [routeSource, setRouteSource] = useState<RouteSource>('mapbox');
  // Cache age stamp at hydration time — displayed inside the offline
  // pill ("Offline route · 3h old") so the driver knows how stale the
  // saved data is. Null for live ('mapbox', 'osrm') and 'mock' sources.
  const [cacheAgeMs, setCacheAgeMs] = useState<number | null>(null);
  // Tapped community-report state — mirrors /home so the marker
  // grows in place (LandmarkMarker `selected` prop) and the
  // ReportDetailCard surfaces the report's detail/timestamp. Same
  // shape and dismiss semantics as the /home implementation.
  const [selectedReport, setSelectedReport] = useState<{
    zoneId: string;
    categoryId: ReportCategoryId;
    detail?: string;
    subTag?: string;
    placeName?: string;
    photoUri?: string;
    timestamp: number;
  } | null>(null);
  // Region + viewport size for marker clustering. Without these, dense
  // pin neighborhoods stack on top of the user-location dot at the
  // default zoom — same problem /home solved by clustering.
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [mapSize, setMapSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  // Live GPS for the EnRouteCarMarker — /home uses UserLocationMarker
  // (blue dot), /en-route swaps to the rotating car glyph during
  // active navigation. Same upstream `watchPositionAsync` plumbing.
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  // Current speed in mph, captured from the live GPS watch. Null until
  // the first position fix with a real speed value (iOS reports -1 or
  // null before motion is detected). Feeds the SpeedLimit sign's top
  // pill — when null, the pill renders a dash.
  const [speedMph, setSpeedMph] = useState<number | null>(null);
  // GPS heading (degrees, 0=north) — feeds the EnRouteCarMarker's
  // rotation so the car icon points in the direction of travel.
  // Null while iOS hasn't computed a heading yet (stationary), in
  // which case the car points north as a safe default. Sticky once
  // resolved so brief stationary moments don't snap the car back
  // to north.
  const [heading, setHeading] = useState<number | null>(null);
  // Bottom-sheet height drives where the side button column floats. Same
  // pattern /home uses for the Report button: measure on layout, anchor
  // children relative to the measured value, conditionally render so we
  // never paint at the wrong position.
  const [bottomSheetHeight, setBottomSheetHeight] = useState(0);
  // Bottom sheet Collapsed ↔ Full per Figma 1133:13328 (Collapsed)
  // and 1133:13329 (Full). Tap the drag handle to toggle. Full
  // surfaces a hazard notice panel below the ETA when at least one
  // category crosses threshold near the upcoming turn — the on-map
  // EnRouteZone markers are passive; this panel is the user's
  // explicit "show me what's ahead" affordance.
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const allZones = useMemo(
    () => [...osmZones, ...reportZones],
    [osmZones, reportZones],
  );

  // Mirrors /home: collapse nearby community reports into a single
  // count badge when they'd overlap on screen. Empty until the first
  // region/size measurement settles, which keeps the map clean during
  // the initial transition into /en-route.
  const clusteredReports = useMemo(() => {
    if (!mapRegion || !mapSize) return [];
    return clusterPointZones(reportZones, mapRegion, mapSize.width, mapSize.height);
  }, [reportZones, mapRegion, mapSize]);

  const routes = useMemo(
    () => pickWinner(rawRoutes, allZones),
    [rawRoutes, allZones],
  );

  const recommended = routes.find((route) => route.type === 'recommended');

  // On-map caution/avoid zone markers — polygon/polyline OSM zones
  // surface as En-Route Zone markers at the zone's anchor point
  // (polyline midpoint or polygon centroid). Each marker has a
  // Default state (compact 72pt badge) and an Extended state (150×42
  // pill with "For X mi." copy) that swaps when the user enters the
  // zone. Point zones already render as LandmarkMarker community-
  // report pins — they don't get the En-Route Zone treatment.
  const enRouteZones = useMemo(() => {
    return osmZones.flatMap((zone) => {
      if (zone.geometry === 'point') return [];
      if (zone.type !== 'caution' && zone.type !== 'avoid') return [];
      const category = zoneToHazardCategory(zone);
      if (!category) return []; // police/landuse/park don't get hazard glyphs
      const anchor = zoneAnchor(zone);
      if (!anchor) return [];
      return [{ zone, anchor, category, lengthMiles: zoneLengthMiles(zone) }];
    });
  }, [osmZones]);

  // Which en-route zones the user is currently inside. Used to flip
  // each marker to its Extended pill state. Recomputed on every
  // userLocation update (one fix per ~second). `enRouteZones` is
  // already filtered to caution/avoid OSM zones with a hazard
  // category — typically a small set per Overpass region — so the
  // per-fix scan is cheap.
  const enteredZoneIds = useMemo(() => {
    if (!userLocation) return new Set<string>();
    const inside = new Set<string>();
    for (const { zone } of enRouteZones) {
      if (isPointInZone(userLocation, zone)) inside.add(zone.id);
    }
    return inside;
  }, [enRouteZones, userLocation]);

  // Monotonic step-progress tracker — prevents `findNextStep` from
  // regressing to a completed maneuver when GPS jitter or slow city
  // traffic keeps the user near a passed turn-point. Resets on new
  // route (recommended.id change).
  const minStepIndexRef = useRef(0);
  useEffect(() => {
    minStepIndexRef.current = 0;
  }, [recommended?.id]);

  // Next maneuver the driver should act on — closest-by-GPS step from
  // OSRM's `steps=true` payload, advancing past completed maneuvers
  // when user is within 30m. Carries terminal states ('arrived',
  // 'off-route') the turn card renders distinctly. Null when steps
  // weren't returned (mock fallback path) — the turn card falls back
  // to a neutral "Heading toward {destination}" header in that case.
  const nextStepInfo = useMemo<NextStepInfo | null>(() => {
    if (!recommended || !userLocation) return null;
    return findNextStep(
      recommended.steps,
      userLocation,
      minStepIndexRef.current,
    );
  }, [recommended, userLocation]);

  // Track the highest step index ever reached so subsequent
  // findNextStep calls can't regress.
  useEffect(() => {
    if (nextStepInfo && nextStepInfo.index > minStepIndexRef.current) {
      minStepIndexRef.current = nextStepInfo.index;
    }
  }, [nextStepInfo?.index]);

  // Lane strip visibility — gated on multiple conditions so the strip
  // only appears when it represents a real lane *decision* for the
  // driver. See docs/superpowers/specs/2026-05-27-lane-guidance-design.md
  // §"Trigger logic" for rationale.
  const showLaneStrip = useMemo(() => {
    const lanes = nextStepInfo?.step.lanes;
    if (!lanes || lanes.length < 2) return false;
    // Filter "all lanes go this way" — no decision, no value rendering.
    const activeCount = lanes.filter((l) => l.active).length;
    if (activeCount === 0) return false;
    if (activeCount === lanes.length) return false;
    // Only on approach to a real upcoming maneuver, not terminal states.
    if (nextStepInfo.status !== 'upcoming') return false;
    // 500m is the "you should be looking at this now" threshold.
    return nextStepInfo.distanceMeters < 500;
  }, [nextStepInfo]);

  // Cache hygiene — wipe the single-slot active route when the user
  // reaches the destination. Without this, the next trip's /en-route
  // mount could briefly load the previous destination's cached route
  // (single-slot, destination-keyed: a different dest grid-key would
  // miss the cache, but a NEW trip to the SAME destination from a
  // different origin would hit it and momentarily show the prior
  // route shape before the fresh OSRM fetch lands). Fire-and-forget;
  // best-effort cleanup, never blocks anything.
  const arrivalCleanedRef = useRef(false);
  useEffect(() => {
    if (arrivalCleanedRef.current) return;
    if (nextStepInfo?.status !== 'arrived') return;
    arrivalCleanedRef.current = true;
    void clearActiveRoute();
  }, [nextStepInfo?.status]);

  // Reset arrival guard when the recommended route changes (e.g. mid-
  // trip destination change via /search?from=enroute). Mirrors the
  // minStepIndexRef reset pattern so a second arrival fires its own
  // clearActiveRoute. Today this is mostly future-proofing — the new
  // route's first OSRM fetch overwrites the cache anyway — but the
  // ref reset keeps invariants tight.
  useEffect(() => {
    arrivalCleanedRef.current = false;
  }, [recommended?.id]);

  // Hazards crossing threshold near the next turn — surfaces up to 2
  // glyphs on the turn card, worst-first. Uses the next-step's
  // maneuver location when OSRM steps are present; falls back to the
  // route's first coordinate for the mock path. Capped at 2 — three
  // glyphs degrade into noise faster than a driver can parse mid-drive.
  const turnHazards = useMemo(() => {
    if (!recommended || recommended.coordinates.length === 0) return [];
    const turnPoint =
      nextStepInfo?.step.maneuverLocation ?? recommended.coordinates[0];
    return hazardsNearTurn(turnPoint, allZones).slice(0, 2);
  }, [recommended, nextStepInfo, allZones]);

  // What the Full bottom-sheet hazard panel should show. Entered-zone
  // hazards take priority over next-turn hazards — when the driver
  // crosses INTO a zone, that's the live context, more relevant than
  // "something is near your next turn." Falls back to turnHazards
  // when not in a zone. Returns null when neither has anything.
  //
  // `lengthMiles` carries the zone's on-the-ground length when this is
  // an entered-zone hazard; null for the turn-hazard fallback (turn
  // hazards aren't tied to a single zone, so length isn't meaningful).
  // The panel surfaces this as a "For X mi." secondary line — same
  // pattern as the EnRouteZone Extended pill, so the bottom sheet
  // and the on-map pill speak with one voice when the user enters
  // a zone.
  const displayedHazard = useMemo<{
    category: HazardCategory;
    lengthMiles: number | null;
  } | null>(() => {
    for (const { zone, category, lengthMiles } of enRouteZones) {
      if (enteredZoneIds.has(zone.id)) return { category, lengthMiles };
    }
    if (turnHazards[0] != null) {
      return { category: turnHazards[0], lengthMiles: null };
    }
    return null;
  }, [enRouteZones, enteredZoneIds, turnHazards]);

  // Auto-expand on zone entry. Compares enteredZoneIds across renders
  // and, on any newly-entered zone, expands the sheet so the hazard
  // panel surfaces immediately — the driver doesn't have to think to
  // tap the drag handle mid-drive. Auto-collapse 5s later so the
  // sheet doesn't camp expanded indefinitely. Manual drag-handle taps
  // cancel the pending auto-collapse (see handleDragHandleToggle).
  const prevEnteredZoneIdsRef = useRef<Set<string>>(new Set());
  const autoCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  useEffect(() => {
    let entered = false;
    for (const id of enteredZoneIds) {
      if (!prevEnteredZoneIdsRef.current.has(id)) {
        entered = true;
        break;
      }
    }
    prevEnteredZoneIdsRef.current = enteredZoneIds;
    if (!entered) return;

    setSheetExpanded(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    if (autoCollapseTimerRef.current) clearTimeout(autoCollapseTimerRef.current);
    autoCollapseTimerRef.current = setTimeout(() => {
      setSheetExpanded(false);
      autoCollapseTimerRef.current = null;
    }, 5000);
  }, [enteredZoneIds]);

  // Cleanup the auto-collapse timer on unmount so a pending callback
  // never fires after the screen is gone.
  useEffect(() => {
    return () => {
      if (autoCollapseTimerRef.current) clearTimeout(autoCollapseTimerRef.current);
    };
  }, []);

  // Drag-handle tap: toggles expansion AND cancels any pending
  // auto-collapse. Without the cancel, tapping while the timer is
  // running would re-set sheetExpanded but the timer would still
  // fire seconds later and override the user's manual choice.
  const handleDragHandleToggle = useCallback(() => {
    if (autoCollapseTimerRef.current) {
      clearTimeout(autoCollapseTimerRef.current);
      autoCollapseTimerRef.current = null;
    }
    setSheetExpanded((v) => !v);
  }, []);

  // Route polylines memoized so live-GPS re-renders don't rebuild the
  // overlay on the native side. Halo retired — see longer note in
  // /home; RN-Maps Polyline lacks zIndex and iOS paint-order can't be
  // controlled reliably across re-renders, so the colored stroke
  // alone is the v1 design.
  const routePolylines = useMemo(
    () => {
      // See /home for the why — alternates render first so the
      // recommended gradient paints over them, not under.
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

  // Arrival clock time (now + remaining minutes), formatted as "8:30".
  // Figma shows the arrival time as `h:MM` with a sun/moon glyph
  // beside it (not "8:30 PM") — the time stays compact (no wrap on
  // narrow devices) and morning/evening reads as a graphic instead
  // of an inline tag. We format manually rather than via
  // toLocaleTimeString since the iOS default appends locale
  // AM/PM that can't be cleanly stripped.
  const arrivalDisplay = useMemo(() => {
    // Prefer the live recommended-route value; fall back to the
    // primed `destEstMinutes` from /home until the local OSRM fetch
    // resolves. Only show "—" if we have neither (e.g. user opened
    // /en-route via deep-link without coming through /home's Go).
    const minutesAhead =
      recommended?.estimatedMinutes ??
      (params.destEstMinutes ? parseFloat(params.destEstMinutes) : NaN);
    if (!Number.isFinite(minutesAhead)) return { time: '—', isNight: false };

    const arrival = new Date(Date.now() + minutesAhead * 60_000);
    const h24 = arrival.getHours();
    const h12 = h24 % 12 || 12;
    const minutes = String(arrival.getMinutes()).padStart(2, '0');
    // Night ≈ 6pm–6am. Common app convention; matches the moon-glyph
    // intent in Figma (moon = arriving in the dark, sun = daylight).
    const isNight = h24 < 6 || h24 >= 18;
    return { time: `${h12}:${minutes}`, isNight };
  }, [recommended, params.destEstMinutes]);

  // Distance in miles, derived from the recommended route. Falls back
  // to the primed `destDistanceMeters` from /home until the local
  // OSRM fetch resolves. Same pattern as arrivalDisplay above —
  // first paint has a real number instead of a dash.
  const distanceMiles = useMemo(() => {
    const meters =
      recommended?.distanceMeters ??
      (params.destDistanceMeters
        ? parseFloat(params.destDistanceMeters)
        : NaN);
    if (!Number.isFinite(meters)) return null;
    return meters / 1609.344;
  }, [recommended, params.destDistanceMeters]);

  // Duration in minutes — same priming logic as the ETA, but exposed
  // as a number for formatDuration. Kept separate from arrivalDisplay
  // because the two render in different rows (ETA cluster vs.
  // secondary [distance · duration] line) and could conceivably want
  // different formatters in the future.
  const durationMinutes = useMemo(() => {
    const m =
      recommended?.estimatedMinutes ??
      (params.destEstMinutes ? parseFloat(params.destEstMinutes) : NaN);
    return Number.isFinite(m) ? m : null;
  }, [recommended, params.destEstMinutes]);

  // Announce the route-loaded state once for screen reader users.
  // Apple Maps speaks each route recalc; we get the smaller version
  // of the same affordance — when the OSRM fetch resolves and the
  // ETA/duration land, VoiceOver reads "Route loaded, X minutes."
  // Fires once on first non-null duration (a `useRef` flag could
  // avoid the dependency array doing this implicitly, but the
  // `routeAnnouncedRef` pattern below makes the intent explicit).
  const routeAnnouncedRef = useRef(false);
  useEffect(() => {
    if (routeAnnouncedRef.current) return;
    if (durationMinutes == null) return;
    routeAnnouncedRef.current = true;
    AccessibilityInfo.announceForAccessibility(
      `Route loaded, ${formatDuration(durationMinutes)} to ${params.destName ?? 'your destination'}.`,
    );
  }, [durationMinutes, params.destName]);

  // User's current location, captured once on mount and used as the map's
  // initial focus. Real driving would update continuously via watchPosition
  // — that's a future PR.
  const [userCenter, setUserCenter] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

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
      setUserCenter(center);

      // Animate to the driving-perspective camera (pitched, slight zoom).
      // initialCamera on MapView sets a static camera; animateCamera lets
      // us transition smoothly from whatever the map opens with.
      mapRef.current?.animateCamera(
        {
          center,
          pitch: 45,
          heading: 0,
          zoom: 17,
        },
        { duration: 1000 },
      );

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

      // Independent fetches — route resolves in ~1–2s, zones can
      // take up to 12s on Overpass timeout. Earlier version awaited
      // both atomically (Promise.allSettled) to avoid a mid-trip
      // flicker when zones landed and MapKit re-evaluated every
      // overlay; the trade-off was a worst-case 12-second blank
      // route, which a thesis-defense reviewer would catch
      // immediately and assume the navigation is broken.
      //
      // Now: route renders the moment it resolves. Zones land
      // when they're ready (or never, if Overpass times out). The
      // marker flicker on zone-arrival is the lesser evil — it's
      // a sub-second visual blip; the 12s blank route was a sign
      // of complete failure.
      getRoutesBetween(center, destination)
        .then(({ routes, source, cacheAgeMs: ageMs }) => {
          if (cancelled) return;
          setRawRoutes(routes);
          setRouteSource(source);
          setCacheAgeMs(ageMs ?? null);
        })
        .catch(() => {
          // Silent failure → route polyline stays empty; the
          // destination marker + car marker still render. /home
          // already filters this branch out before navigating.
        });
      getZonesForRegion(center)
        .then((zones) => {
          if (!cancelled) setOsmZones(zones);
        })
        .catch(() => {
          // Overpass timeout / network fail → no scoring overlays.
          // Scoring still works against an empty zones array.
        });
    }

    fetchAndCenterOnUser();
    return () => {
      cancelled = true;
    };
  }, [params.destLat, params.destLng]);

  // Silent background refresh — when running on the OSRM fallback,
  // cached data, or the mock catastrophe-fallback, poll the routing
  // ladder every 90s and swap up to the Mapbox primary on success.
  // The swap is non-jarring because we seed the monotonic step index
  // to the NEW route's closest-by-GPS step (not 0) — without that,
  // findNextStep would briefly show "Head out on Main" mid-trip until
  // the user moves past the new depart step's 50m guard.
  //
  // Skip only when source === 'mapbox' (Mapbox is the target primary;
  // OSRM is a fallback that still benefits from retrying for the
  // richer Mapbox metadata in PR 2+).
  //
  // userLocation is read via ref so live GPS ticks don't restart the
  // interval. destination IS in the deps because it's URL-derived and
  // doesn't change mid-trip — if the user picks a new destination,
  // the effect resets cleanly.
  const userLocationRef = useRef(userLocation);
  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);
  useEffect(() => {
    // Skip the poll for terminal states. 'mapbox' is the goal — no
    // upgrade target. 'no-route' is a confirmed unroutable destination
    // (engine said no) — polling won't change that and would just burn
    // Mapbox quota. The cache/osrm/mock states are the ones worth
    // periodically retrying to upgrade to Mapbox.
    if (routeSource === 'mapbox' || routeSource === 'no-route') return;
    if (!params.destLat || !params.destLng) return;
    const dest = {
      latitude: parseFloat(params.destLat),
      longitude: parseFloat(params.destLng),
    };
    if (Number.isNaN(dest.latitude) || Number.isNaN(dest.longitude)) return;
    // `cancelled` guards against state writes after unmount or after
    // the effect tears down (destination changes, user backs out of
    // /en-route mid-fetch). clearInterval stops FUTURE fires; this
    // flag covers the in-flight promise that already started.
    let cancelled = false;
    const id = setInterval(() => {
      const liveLocation = userLocationRef.current;
      if (!liveLocation) return;
      getRoutesBetween(liveLocation, dest)
        .then((result) => {
          if (cancelled) return;
          if (result.source !== 'mapbox') return; // still not on the primary tier
          // Seed minStepIndex to the new route's closest-by-GPS step
          // so the swap doesn't visually regress to "Head out on Main."
          // Guard: only seed when closest-by-GPS distance is < 150m —
          // if the new route diverged topologically (detour around a
          // closure, different recommendation), closest could be a
          // turn the driver has physically passed but hasn't reached
          // on the new geometry, surfacing a ghost instruction. When
          // closest is far, leave the ref at 0 and let findNextStep's
          // 50m depart guard advance naturally as the user moves.
          const newRecommended = result.routes[0];
          if (newRecommended?.steps?.length && liveLocation) {
            let closestIdx = 0;
            let closestDist = Number.POSITIVE_INFINITY;
            const latToM = 111000;
            const lngToM =
              111000 * Math.cos((liveLocation.latitude * Math.PI) / 180);
            for (let i = 0; i < newRecommended.steps.length; i++) {
              const s = newRecommended.steps[i];
              const dLat =
                (s.maneuverLocation.latitude - liveLocation.latitude) * latToM;
              const dLng =
                (s.maneuverLocation.longitude - liveLocation.longitude) *
                lngToM;
              const d = Math.hypot(dLat, dLng);
              if (d < closestDist) {
                closestDist = d;
                closestIdx = i;
              }
            }
            if (closestDist < 150) {
              minStepIndexRef.current = closestIdx;
            }
          }
          setRawRoutes(result.routes);
          setRouteSource('mapbox');
          setCacheAgeMs(null);
          console.info(
            '[en-route] silently swapped fallback → live Mapbox',
          );
        })
        .catch(() => {
          // Still offline; keep showing cached data + offline pill.
        });
    }, 90_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [routeSource, params.destLat, params.destLng]);

  // Subscribe to live GPS for the EnRouteCarMarker (heading-driven
  // car glyph). Same setup as /home — high accuracy, 1s/5m thresholds,
  // cleanup on unmount.
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
          // pos.coords.speed is in m/s. iOS returns -1 before motion
          // is detected; treat anything <0 as "not yet known."
          const ms = pos.coords.speed;
          if (typeof ms === 'number' && ms >= 0) {
            setSpeedMph(Math.round(ms * 2.237));
          }
          // pos.coords.heading is in degrees (0=north). iOS returns
          // -1 when the device hasn't detected motion. Same gate as
          // speed — only update when we have a real heading, so the
          // car doesn't snap back to north every time the driver
          // stops at a red light.
          const hdg = pos.coords.heading;
          if (typeof hdg === 'number' && hdg >= 0) {
            setHeading(hdg);
          }
        },
      );
    })();
    return () => {
      subscription?.remove();
    };
  }, []);

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

  function handleRecenter() {
    if (!userCenter) return;
    mapRef.current?.animateCamera(
      {
        center: userCenter,
        pitch: 45,
        heading: 0,
        zoom: 17,
      },
      { duration: 500 },
    );
  }

  function handleEndTrip() {
    router.back();
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <MapView
        ref={mapRef}
        style={styles.map}
        initialCamera={{
          center: { latitude: 30.6954, longitude: -88.0399 },
          pitch: 45,
          heading: 0,
          zoom: 17,
          altitude: 1000,
        }}
        // Same muted basemap as /home — Apple Maps / Waze dim POIs
        // during navigation; we apply it app-wide. See theme/map-style.ts.
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
      >
        {/*
          Zone overlays — same render rules as /home. Rendered first
          (before route polylines) so the route's daylight gradient
          paints on top, not under. Only when the user has the
          preference toggled on; default off keeps the active driving
          map clean by default. Renders both polyline zones (lit
          streets, surface conditions) and polygon zones (parks,
          landuse, wildlife).
        */}
        {showZones &&
          allZones.map((zone) => {
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
                  strokeWidth={1}
                  lineDashPattern={zoneDashPattern[zone.type]}
                />
              );
            }
            return null;
          })}
        {/*
          Community-report points — clustered at low zoom so the
          en-route default camera (zoom 17, 1000m altitude) doesn't
          stack pins on top of the user-location dot. Singletons render
          as the same LandmarkMarker /home uses; groups render as an
          orange count badge that zooms to fit on tap.
        */}
        {clusteredReports.map((item) => {
          if (item.kind === 'cluster') {
            const { cluster } = item;
            return (
              <ClusterMarker
                key={cluster.id}
                latitude={cluster.center.latitude}
                longitude={cluster.center.longitude}
                count={cluster.count}
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
              />
            );
          }
          const { zone } = item;
          const point = zone.coordinates[0];
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
                  placeName: zone.reportPlaceName,
                  photoUri: zone.reportPhotoUri,
                  timestamp: zone.reportTimestamp ?? Date.now(),
                })
              }
            />
          );
        })}
        {/*
          Destination pin — sits at the route endpoint so the driver
          always sees where the line ends, even when the polyline runs
          off-screen as the car advances. Same component as /home so
          the destination reads identically across the trip.
        */}
        {params.destLat && params.destLng && (
          <DestinationMarker
            latitude={parseFloat(params.destLat)}
            longitude={parseFloat(params.destLng)}
            name={params.destName}
            variant="enroute"
          />
        )}
        {routePolylines}

        {/*
          En-Route Zone markers — Figma 1133:13297. One marker per
          caution/avoid OSM polygon/polyline zone that maps to a
          hazard category. Default state is a compact badge shown
          ahead of the zone; Extended state swaps to a 150×42 pill
          ("For X mi.") the moment the user crosses into the zone.
          Independent of the data-layer `showZones` toggle — these
          are driver-facing hazard notices, not the optional
          overlay.
        */}
        {enRouteZones.map(({ zone, anchor, category, lengthMiles }) => {
          const state = enteredZoneIds.has(zone.id) ? 'extended' : 'default';
          // Embed state in the key so flipping default ↔ extended
          // remounts the native Marker view rather than mutating its
          // children in place. iOS MapKit caches the marker snapshot
          // once `tracksViewChanges` settles to false, so an in-place
          // child swap can leave the stale snapshot painted. A
          // remount guarantees a fresh snapshot on every transition
          // without keeping tracking enabled the whole session.
          return (
            <EnRouteZone
              key={`hazard-${zone.id}-${state}`}
              latitude={anchor.latitude}
              longitude={anchor.longitude}
              category={category}
              state={state}
              lengthMiles={lengthMiles}
            />
          );
        })}

        {userLocation && (
          <EnRouteCarMarker
            // Embed heading in the key so each meaningful rotation
            // remounts the native Marker — iOS MapKit caches the
            // marker snapshot when `tracksViewChanges` is false, so
            // an in-place transform update wouldn't repaint. Rounding
            // to whole degrees gates updates to ~360 per full turn,
            // not one per GPS tick.
            key={`car-${heading != null ? Math.round(heading) : 'n'}`}
            latitude={userLocation.latitude}
            longitude={userLocation.longitude}
            heading={heading}
          />
        )}
      </MapView>

      {/*
        Turn-sign header — wrapped in SafeAreaView so the wiltedgreen panel
        starts below the notch/status-bar inset rather than under it. The
        panel itself paints up to the SafeAreaView edge so it reads as a
        single block; the inset sits as transparent padding above.
      */}
      <SafeAreaView
        style={styles.headerWrap}
        edges={['top']}
        pointerEvents="box-none"
      >
        {/*
          Lane guidance strip — Apple Maps-style cells showing which
          lane(s) the driver should occupy for the upcoming maneuver.
          Sits ABOVE the maneuver row (per spec) so the lane decision
          is read FIRST, then the instruction. Always mounted;
          visibility tween handled internally. Lanes come from Mapbox
          banner_instructions (parseMapboxStep). When the strip is
          hidden, its maxHeight tweens to 0 so the turn card collapses
          to its non-lane height.
        */}
        <LaneStrip
          lanes={nextStepInfo?.step.lanes ?? []}
          visible={showLaneStrip}
        />

        <View style={styles.turnSign}>
          <View
            style={styles.turnDirection}
            accessible
            accessibilityLabel={a11yLabelForTurnCard(nextStepInfo, params.destName)}
          >
            {/*
              Turn maneuver glyph — informational, not a button.
              Phosphor duotone per Figma `825:3754`'s Turn Icon
              register. When OSRM steps are present, the icon
              dispatches off the maneuver kind ("turn left" →
              ArrowBendUpLeft, etc.). Off-route renders the neutral
              NavigationArrow so we're not asserting a direction
              while the user isn't on the route. Mock-fallback path
              (no steps) also lands on NavigationArrow via the
              undefined-kind default.
            */}
            {maneuverIcon(
              nextStepInfo?.status === 'off-route'
                ? undefined
                : nextStepInfo?.step.kind,
              56,
              colors.white,
            )}
          </View>

          <View style={styles.turnText}>
            {nextStepInfo?.status === 'arrived' ? (
              <Text style={styles.turnInstruction}>You&apos;ve arrived</Text>
            ) : nextStepInfo?.status === 'off-route' ? (
              <Text style={styles.turnInstruction}>Recalculating…</Text>
            ) : nextStepInfo?.step ? (
              <Text style={styles.turnInstruction}>
                {nextStepInfo.step.instruction}
                {'\n'}
                <Text style={styles.turnStreet}>
                  {/* Special-case "now" so the visible UI doesn't
                      read "in now" — the formatStepDistance helper
                      returns "now" inside the <30m bucket; drop the
                      "in" prefix in that case. */}
                  {nextStepInfo.distanceMeters < 30
                    ? 'now'
                    : `in ${formatStepDistance(nextStepInfo.distanceMeters)}`}
                </Text>
              </Text>
            ) : (
              <Text style={styles.turnInstruction}>
                Heading toward{'\n'}
                <Text style={styles.turnStreet}>
                  {params.destName ?? 'your destination'}
                </Text>
              </Text>
            )}
            {turnHazards.length > 0 && (
              <View
                style={styles.hazardRow}
                accessibilityRole="text"
                accessibilityLabel={`Heads up: ${turnHazards
                  .map(humanReadableHazard)
                  .join(', ')} near this turn`}
              >
                {turnHazards.map((category) => (
                  <Hazard key={category} category={category} size={24} />
                ))}
              </View>
            )}
            {(routeSource === 'cache' || routeSource === 'mock') && (
              <View
                style={styles.offlinePill}
                accessibilityRole="text"
                accessibilityLabel={
                  routeSource === 'cache'
                    ? `Offline route, saved ${formatCacheAge(cacheAgeMs)} ago. No live recalculation.`
                    : 'Demo route — network and saved route both unavailable. Approximate path shown.'
                }
              >
                <WifiSlash size={14} color={colors.white} weight="duotone" />
                <Text style={styles.offlinePillText}>
                  {/* Cache → "Offline route" with age stamp ("· 3h old")
                      when available; mock → "Demo route" to distinguish
                      real-but-stale OSRM geometry from last-resort
                      synthetic. Both keep the pill same visual register
                      (translucent white, WifiSlash) — degraded states,
                      not alarm. */}
                  {routeSource === 'cache'
                    ? cacheAgeMs != null
                      ? `Offline route · ${formatCacheAge(cacheAgeMs)} old`
                      : 'Offline route'
                    : 'Demo route'}
                </Text>
              </View>
            )}
          </View>

          <Pressable
            style={({ pressed }) => [styles.micBtn, pressed && pressedDim]}
            accessibilityRole="button"
            accessibilityLabel="Voice control (not yet supported)"
          >
            {/*
              Speech-control affordance — the mic glyph signals "tap to
              speak a destination/command," matching the in-app voice-
              search pattern Apple/Google/Waze all use during active
              navigation. 32pt icon in a 48pt pill per Figma 825:3755
              (inner Frame size-[32px] centered in size-[48px] pill =
              8pt margin each side).
            */}
            <TurnMic width={32} height={32} />
          </Pressable>
        </View>

        <View style={styles.thenFooter}>
          <Text style={styles.thenText}>Then</Text>
          {/*
            "Then" footer arrow — same duotone Phosphor register as
            the main turn-card arrow above. ArrowBendUpRight reads
            as "next-turn direction" (curving right-and-up) without
            committing to a specific direction since the next-next
            turn isn't known yet.
          */}
          <ArrowBendUpRight
            size={20}
            color={colors.fadedgreen}
            weight="duotone"
          />
        </View>
      </SafeAreaView>

      {/*
        Side button column — Help / Shield / Report / Center. Anchored
        relative to the measured bottom-sheet height so it always sits
        24pt above the sheet's top edge (Figma reads more like 32pt of
        breathing room; 24pt accounts for the M3 Elevation 2 shadow that
        already adds visual gap below the lowest button). Hidden until
        layout pass to avoid a one-frame flash at the wrong y.
      */}
      {/*
        Speed Limit sign — Waze/Apple-Maps style. Anchored bottom-left,
        mirrors the side-button column on the right. Top pill shows
        current speed from the GPS watch; bottom yellow card shows
        the speed limit. SF Pro Bold is a stand-in for the canonical
        Overpass Bold (the standard US speed-limit-sign typeface) —
        queued for the next bulk font/asset import pass.
        v1 limitation: speed limit is hardcoded to 25 mph (urban
        default) since OSM `maxspeed` tags aren't wired through the
        zones adapter yet.
      */}
      {bottomSheetHeight > 0 && (
        <View
          style={[styles.speedLimitWrap, { bottom: bottomSheetHeight + 24 }]}
          pointerEvents="box-none"
        >
          <View style={styles.speedLimitCurrentPill}>
            <Text style={styles.speedLimitCurrentNumber} numberOfLines={1}>
              {speedMph ?? '—'}
            </Text>
          </View>
          <View style={styles.speedLimitSign}>
            <Text style={styles.speedLimitNumber} numberOfLines={1}>
              25
            </Text>
            <Text style={styles.speedLimitUnit} numberOfLines={1}>
              mph
            </Text>
          </View>
        </View>
      )}
      {bottomSheetHeight > 0 && (
        <View
          style={[
            styles.sideButtons,
            { bottom: bottomSheetHeight + 24 },
          ]}
          pointerEvents="box-none"
        >
          {/*
            Volume sits at the top of the column — set-once auxiliary,
            so it goes furthest from the thumb-resting Center button at
            the bottom. Same 56pt pill as the other four so the column
            reads as a uniform stack. All glyphs are canonical Figma
            SVGs from `assets/illustrations/sidebtn-*.svg`. Shield is
            still Phosphor — the documented canonical safety-affordance
            (navy duotone) and matches /menu's Safety row register.
          */}
          <FloatingActionButton
            size="56"
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              Alert.alert('Volume', 'Voice prompt controls land in a future update.', [
                { text: 'OK' },
              ]);
            }}
            accessibilityLabel="Toggle volume (coming soon)"
            style={styles.sideBtnInert}
          >
            <SidebtnVolume width={32} height={32} />
          </FloatingActionButton>
          <FloatingActionButton
            size="56"
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              Alert.alert(
                'Help',
                'In-trip help (chat, FAQ, contact support) lands in a future update.',
                [{ text: 'OK' }],
              );
            }}
            accessibilityLabel="Help (coming soon)"
            style={styles.sideBtnInert}
          >
            <SidebtnHelp width={32} height={32} />
          </FloatingActionButton>
          <FloatingActionButton
            size="56"
            onPress={() => router.push('/safety')}
            accessibilityLabel="Open safety menu"
          >
            <Shield size={32} color={colors.navy} weight="duotone" />
          </FloatingActionButton>
          <FloatingActionButton
            size="56"
            onPress={() => router.push('/report')}
            accessibilityLabel="Report something"
          >
            <SidebtnReport width={32} height={32} />
          </FloatingActionButton>
          <FloatingActionButton
            size="56"
            onPress={handleRecenter}
            accessibilityLabel="Recenter map on your location"
          >
            <SidebtnRecenter width={32} height={32} />
          </FloatingActionButton>
        </View>
      )}

      {/*
        Bottom sheet — Figma 825:3783. Layout:
          [Search] [ETA "8:30"] [Paths]
          [distance · duration]
          [End trip]
        Symmetric: one utility per side flanking the ETA. Volume moved
        to the right-side button column (above Help/Shield/Report/
        Center) — it's a driving-utility control like the others in
        that family, and removing it lets the bottom sheet read clean.
      */}
      {/*
        Hide the ETA bottom sheet when a ReportDetailCard is open
        — that card slides up from the same edge with the same
        rounded chrome, so leaving both visible reads as "two cards
        stacked." Same rule as /home. The driver can dismiss the
        report card to bring the ETA panel back; if this proves too
        aggressive in real driving we can swap to auto-dismiss the
        card after a few seconds instead.
      */}
      {!selectedReport && <SafeAreaView
        style={styles.bottomSheet}
        edges={['bottom']}
        onLayout={(e) => setBottomSheetHeight(e.nativeEvent.layout.height)}
      >
        {/*
          Tap the drag-handle row to toggle Collapsed ↔ Full. The
          Pressable wraps a generously padded area around the
          drag handle itself so the tap target meets HIG 44pt
          while the visible handle bar stays small (32×4).
        */}
        <Pressable
          style={styles.dragHandleTapTarget}
          // hitSlop extends the touchable area without painting
          // padding — keeps the visual gap tight (8 + 4 + 8 = 20pt)
          // while the touch hit region meets HIG 44pt (12 + 8 + 4 +
          // 8 + 12 = 44pt vertical). Earlier version painted 20pt
          // of vertical padding which stacked with the sheet's
          // gap: 16 to leave ~60pt of dead space above the ETA.
          hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
          onPress={handleDragHandleToggle}
          accessibilityRole="button"
          accessibilityLabel={
            sheetExpanded
              ? 'Collapse bottom sheet'
              : 'Expand bottom sheet for hazard details'
          }
          accessibilityState={{ expanded: sheetExpanded }}
        >
          <DragHandle />
        </Pressable>

        <View style={styles.sheetContent}>
          {/*
            v2 layout per Figma `1133:13328` (BottomSheet/En-route/
            Collapsed). Two 48pt FABs flank a 34pt Large Title/Emphasized
            ETA. The number renders in label/black for WCAG AA-large
            contrast (freshgreen-on-white is 2.9:1, fails 3:1) — the
            brand presence on this sheet comes from the route polyline
            and the recommended-route badge, not the ETA number. The
            ETA is wrapped in a flex:1 column
            that takes the remaining width — the FABs are intrinsic-
            sized, so the ETA centers between them regardless of which
            iconography lands on each side.
          */}
          <View style={styles.etaRow}>
            <FloatingActionButton
              size="48"
              accessibilityLabel="Change destination"
              accessibilityHint="Opens search to pick a new destination mid-trip"
              onPress={() => {
                // Mid-trip destination change. /search reads
                // ?from=enroute and routes the result back here
                // instead of /home; the existing destLat/destLng
                // useEffect refetches the route + steps in place.
                // The active-route cache from the previous
                // destination self-replaces on the next successful
                // OSRM fetch (single-slot, destination-keyed); no
                // need to clearActiveRoute here, which would race
                // the new saveActiveRoute and risk leaving the user
                // with no offline fallback during the swap window.
                Haptics.selectionAsync().catch(() => {});
                router.push('/search?from=enroute');
              }}
            >
              <EnRouteSearch width={24} height={24} />
            </FloatingActionButton>

            <View style={styles.etaCluster}>
              {/*
                ETA cluster — `[16pt spacer] [time] [16pt sun/moon]`
                per Figma 364:3116. The left spacer balances the right
                glyph so the time text stays optically centered. nowrap
                on the time defends against any locale-format expansion.
              */}
              <View style={styles.etaIconSpacer} />
              <Text
                style={styles.eta}
                numberOfLines={1}
                // accessibilityLiveRegion="polite" lets TalkBack
                // re-announce the ETA when it updates after rerouting
                // — Apple Maps speaks every route recalc; this is the
                // text-region equivalent on Android.
                accessibilityLiveRegion="polite"
                accessibilityLabel={`Arrival time ${arrivalDisplay.time}${arrivalDisplay.isNight ? ', after dark' : ', in daylight'}`}
              >
                {arrivalDisplay.time}
              </Text>
              {arrivalDisplay.isNight ? (
                <DaylightMoon width={16} height={16} />
              ) : (
                <DaylightSun width={16} height={16} />
              )}
            </View>

            <FloatingActionButton
              size="48"
              accessibilityLabel="Show alternate paths (coming soon)"
            >
              <EnRoutePath width={24} height={24} />
            </FloatingActionButton>
          </View>

          {/*
            Hazard panel — Full state (Figma 1133:13329). Renders the
            entered-zone hazard (preferred) or the next-turn hazard
            (fallback). 96pt yellow diamond on the left, Title3/
            Emphasized sentence on the right; when the hazard is tied
            to a real zone (lengthMiles known), a secondary "For X mi."
            line below matches the EnRouteZone Extended-pill register.
            Only shows when the user (or the auto-expand) has expanded
            AND a hazard exists — collapsed = compact ETA only.
          */}
          {sheetExpanded && displayedHazard && (
            <View
              style={styles.hazardPanel}
              accessibilityRole="text"
              accessibilityLabel={
                displayedHazard.lengthMiles != null
                  ? `Heads up: ${hazardFullCopy(displayedHazard.category)} for ${formatHazardMiles(displayedHazard.lengthMiles)}`
                  : `Heads up: ${hazardFullCopy(displayedHazard.category)}`
              }
            >
              {/*
                Hazard SVG renders the full visual (yellow diamond +
                black glyph + stroke) at 96pt. The text column
                takes the remaining width.
              */}
              <Hazard category={displayedHazard.category} size={96} />
              <View style={styles.hazardCopyColumn}>
                <Text style={styles.hazardCopy}>
                  {hazardFullCopy(displayedHazard.category)}
                </Text>
                {displayedHazard.lengthMiles != null && (
                  <Text style={styles.hazardLengthCopy}>
                    For {formatHazardMiles(displayedHazard.lengthMiles)}
                  </Text>
                )}
              </View>
            </View>
          )}

          <View style={styles.secondaryRow}>
            <Text style={styles.secondaryDistance}>
              {distanceMiles != null ? formatDistance(distanceMiles) : '—'}
            </Text>
            <Text style={styles.secondarySeparator}>·</Text>
            <Text style={styles.secondaryDuration}>
              {durationMinutes != null ? formatDuration(durationMinutes) : '—'}
            </Text>
          </View>

          {/*
            End trip — always visible on both Collapsed and Full,
            even though the Figma frames don't show it explicitly.
            A driver under stress shouldn't have to find or
            interpret an X icon to exit a trip. The Figma's Full
            (1133:13329) crops above this row but the design intent
            is consistent: End trip remains an always-available
            primary exit affordance.
          */}
          <Pressable
            style={({ pressed }) => [styles.endTripBtn, pressed && pressedDim]}
            onPress={handleEndTrip}
            accessibilityRole="button"
            accessibilityLabel="End trip"
          >
            <Text style={styles.endTripText}>End trip</Text>
          </Pressable>
        </View>
      </SafeAreaView>}

      {/*
        Report detail card — surfaces when the driver taps an on-map
        community-report pin. Same component and dismiss semantics as
        /home; drivers can read what the report is about without
        leaving the trip. Tap outside (on the map) dismisses.
      */}
      {selectedReport && (
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

  // --- Turn-sign header ---
  // Single SafeAreaView that owns:
  //   - wiltedgreen bg, so the status-bar inset area (added as top
  //     padding by `edges={['top']}`) is wiltedgreen too — the panel
  //     reads as starting from the very top of the screen.
  //   - rounded bottom + `overflow: 'hidden'`, so both children
  //     (turnSign wiltedgreen + thenFooter burntgreen) are clipped
  //     to the rounded shape as a unit. No bleed at the seam.
  headerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.wiltedgreen,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  turnSign: {
    backgroundColor: colors.wiltedgreen,
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
    // 16pt of additional top padding on top of SafeAreaView's
    // status-bar inset. Without it the turn arrow + instruction sit
    // visually flush with the status bar — readable but cramped on
    // device. The 16pt gives the turn-card content room to breathe
    // below the time/battery icons.
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  // Direction column per Figma 825:3754 — turn arrow at top, distance
  // at bottom, stretched to the turnSign row's full content height
  // (matched by the Text column on the right). `justifyContent:
  // space-between` puts the arrow at the top and the distance at the
  // bottom; `alignItems: center` centers the distance horizontally
  // below the arrow (vs. flex-end, which right-aligned them
  // inconsistently). `alignSelf: stretch` is what gives us a height
  // to space-between against.
  turnDirection: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  // Distance "0.5" in Title3/Emphasized per Figma 364:2853 — bumped
  // from Title3/Regular so the number reads with the prominence the
  // driver needs to glance at it under stress.
  turnDistance: {
    ...typography.title3Emphasized,
    color: colors.white,
  },
  turnDistanceUnit: {
    ...typography.subheadlineRegular,
    color: colors.fadedgreen,
  },
  turnText: {
    flex: 1,
    gap: 16,
  },
  turnInstruction: {
    ...typography.title2Emphasized,
    color: colors.white,
  },
  turnStreet: {
    color: colors.fadedgreen,
  },
  // Hazard row — up to 2 glyphs from `hazardsNearTurn`. 8pt gap per
  // Figma `1109:3527/364:2860`. Only renders when at least one hazard
  // crosses threshold (parent conditional in the JSX).
  hazardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // "Offline route" pill — surfaced on the turn card when route
  // source is 'cache' or 'mock'. Translucent dark backing reads as
  // muted status, not alarm — offline navigation is a degraded state
  // but not an error, and the alarmist palette (orange/red) is
  // reserved for actual hazards per .cursorrules.
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-start',
  },
  offlinePillText: {
    ...typography.caption1Emphasized,
    color: colors.white,
  },
  // Half-opacity treatment for the Volume + Help FABs (coming-soon
  // side buttons). Matches the /safety + /menu coming-soon register.
  sideBtnInert: {
    opacity: 0.5,
  },
  micBtn: {
    // 56pt pill (Figma specs 48pt as Material 3 icon-button, but the
    // side-button column is all 56pt — bumping the turn-card mic to
    // match means every white-pill nav button on the en-route screen
    // is the same size, and gives better tap target during driving.
    // 32pt icon + 56pt pill = 12pt margin each side — same icon-to-
    // pill ratio as the side buttons.
    width: 56,
    height: 56,
    borderRadius: 100,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  thenFooter: {
    backgroundColor: colors.burntgreen,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    // Rounded bottom + clipping lives on the parent `headerCard`,
    // not here — see the comment there for why.
  },
  thenText: {
    ...typography.title3Regular,
    color: colors.fadedgreen,
  },

  // --- Side button column ---
  sideButtons: {
    position: 'absolute',
    right: 16,
    // `bottom` set inline from measured sheet height + 16 offset.
    gap: 16,
  },
  // sideBtn style block retired — the 5 side-column buttons consume
  // the FloatingActionButton component now (size="56").

  // --- Speed Limit sign (Figma 364:3239) ---
  // Mirrors the sideButtons column on the right edge of the screen.
  // Two stacked elements: white pill on top (current speed), yellow
  // card below (speed limit). Real-world speed-limit-sign proportions.
  // Width bumped from Figma's 71pt → 88pt to give the 32pt-bold "25"
  // numerals room to render on one line. Figma's tight 71 worked in
  // Figma's text engine but RN with the 4pt borders + 8pt padding
  // squeezed each digit into its own line. The visual proportion is
  // still that of a US speed-limit sign.
  speedLimitWrap: {
    position: 'absolute',
    left: 16,
    width: 88,
    alignItems: 'stretch',
  },
  speedLimitCurrentPill: {
    backgroundColor: colors.white,
    borderWidth: 4,
    borderColor: colors.cardBorderSubtle,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'flex-end',
    // 56pt (was 46) — the 24pt/28pt-line number needs 38pt of
    // content room (10pt top padding + 28pt line); the -12pt
    // overlap with the yellow sign below clipped the bottom of
    // round digits ("0", "8") into the yellow band. 56pt gives
    // 8pt of headroom above the overlap.
    height: 56,
    // Overlap with the yellow sign below per Figma — `mb-[-12px]` in
    // the source mocks. Gives the appearance of a unified stack.
    marginBottom: -12,
  },
  speedLimitCurrentNumber: {
    // SF Pro Bold stand-in for Overpass Bold (the canonical US speed-
    // limit-sign typeface). Visually close; swap when Overpass loads.
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 28,
    color: colors.black,
    textAlign: 'center',
    letterSpacing: -0.26,
  },
  speedLimitSign: {
    backgroundColor: colors.yellow,
    borderWidth: 4,
    borderColor: colors.cardBorderSubtle,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 24,
    alignItems: 'center',
    // M3 Elevation 1 — subtle drop shadow so the sign reads as a
    // physical object on the map.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  speedLimitNumber: {
    fontWeight: '700',
    fontSize: 32,
    lineHeight: 36,
    color: colors.black,
    textAlign: 'center',
    letterSpacing: -0.26,
  },
  speedLimitUnit: {
    ...typography.subheadlineRegular,
    color: colors.black,
    textAlign: 'center',
  },

  // --- Bottom sheet ---
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    // Top padding lives on `dragHandleTapTarget` now (the first
    // child) so the tap region extends to the sheet's top edge.
    // Without that move, the top 16pt of the sheet was visual
    // dead-space outside the Pressable.
    gap: 16,
    ...shadows.sheet,
  },
  sheetContent: {
    gap: 8,
    paddingBottom: 8,
  },
  // Drag handle tap target — 8+4+8=20pt of vertical paint; the
  // remaining HIG 44pt floor comes from `hitSlop` on the Pressable.
  // Painting the full 44pt of padding left too much dead space
  // above the ETA row.
  dragHandleTapTarget: {
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: 'center',
  },
  // Hazard panel (Full state) — yellow diamond hazard marker on the
  // left, sentence-form hazard copy on the right. The Hazard SVG
  // ships at 96pt and carries its own yellow diamond + stroke —
  // earlier scaffolding (a 68pt rotated square wrapper with a
  // Phosphor glyph inside) is retired now that the canonical SVG
  // is in place.
  hazardPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  // Text column inside the hazard panel. Stacks the Title3/Emphasized
  // sentence above an optional Subheadline/Regular "For X mi." line.
  hazardCopyColumn: {
    flex: 1,
    gap: 4,
  },
  hazardCopy: {
    ...typography.title3Emphasized,
    color: colors.black,
  },
  hazardLengthCopy: {
    ...typography.subheadlineRegular,
    color: colors.mutedSecondary,
  },
  // v2 layout — FAB + ETA + FAB with the ETA wrapped in a flex:1
  // column that takes the remaining width. FABs are intrinsic-sized,
  // so the ETA centers between them. Replaces the v1 3-slot row that
  // had separate flex:1 left/center/right slots.
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    // 20pt (not 16pt) so the right FAB's column center aligns with
    // the side-button column above it. Side buttons are 56pt at
    // right:16 → center at right:44. Bottom-sheet FABs are 48pt;
    // center at right:44 puts the outer edge at right:20.
    paddingHorizontal: 20,
  },
  etaCluster: {
    flex: 1,
    flexDirection: 'row',
    // Matches Figma 364:3116 ETA's `items-start`. The 16pt sun/moon
    // glyph sits at the top of the row alongside the 41pt-line-height
    // "8:30" — visually subtitling the time as "this is morning" or
    // "this is night" rather than centered to the time's mid-line.
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  etaIconSpacer: {
    width: 16,
    height: 16,
  },
  eta: {
    ...typography.largeTitleEmphasized,
    color: colors.black,
  },
  // Body/Emphasized 17pt per Figma 364:3133/3135 — bumped from v1's
  // 15pt Subheadline. Distance + duration both emphasized; the "·"
  // separator stays Subheadline/Regular gray for a quiet beat.
  secondaryRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryDistance: {
    ...typography.bodyEmphasized,
    color: colors.black,
  },
  secondarySeparator: {
    ...typography.subheadlineRegular,
    color: colors.labelTertiary,
  },
  secondaryDuration: {
    ...typography.bodyEmphasized,
    color: colors.black,
  },

  // --- End trip pill ---
  endTripBtn: {
    marginHorizontal: 16,
    height: 44,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.wiltedgreen,
    alignItems: 'center',
    justifyContent: 'center',
    // No fill — outlined matches the secondary-action register (same
    // pattern as /home's "Schedule for later"). Distinct from filled
    // primary actions (Go button) and from destructive red (the
    // navigation isn't being undone, just stopped).
  },
  endTripText: {
    ...typography.subheadlineEmphasized,
    color: colors.wiltedgreen,
  },
});
