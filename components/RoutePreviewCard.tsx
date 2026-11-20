/**
 * RoutePreviewCard — the bottom-sheet content rendered when a destination
 * is set on /home (Figma 1109:3264 "Route (Default)").
 *
 * Extracted from app/home.tsx to keep the map-screen orchestrator at
 * a manageable size. Home owns route-selection state (selectedRouteId)
 * and passes selectedRoute + onSelectRoute so the map polylines stay in sync.
 *
 * Also exports RouteHazardType, RouteSafeType, routeHazardsOnPath, and
 * firstRouteSafeOnPath for use by home.tsx's focusRouteHazardAtIndex /
 * handleRouteSafeChipPress handlers.
 */
import { useRouter } from 'expo-router';
import * as haptics from '../lib/haptics';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

import { ArrowClockwise } from 'phosphor-react-native/src/icons/ArrowClockwise';
import { ArrowRight } from 'phosphor-react-native/src/icons/ArrowRight';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { PathIcon } from 'phosphor-react-native/src/icons/Path';
import { Star } from 'phosphor-react-native/src/icons/Star';
import { WarningDiamond } from 'phosphor-react-native/src/icons/WarningDiamond';
import { X } from 'phosphor-react-native/src/icons/X';

import { ArrivalLightIndicator } from './ArrivalLightIndicator';
import { MetaSeparator } from './MetaSeparator';
import { LoadingState } from './StateCard';
import { SavedPlaceBookmark } from './SavedPlaceBookmark';

import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useRegularDestinations } from '../hooks/useRegularDestinations';

import { isRegularLocation } from '../lib/api/regular-destinations';
import { prepareRouteResilienceBundle } from '../lib/api/route-resilience';
import { primaryRoadName, type Route, type RouteSource } from '../lib/api/routes';
import type { Zone } from '../lib/api/zones';
import {
  ALL_CLEAR_A11Y_LONG_TRIP,
  LONG_TRIP_COPY_METERS,
  LONG_TRIP_FOOTNOTE_COPY,
} from '../lib/corridor/constants';
import {
  arrivalLightAt,
  suggestedDepartureForDaylight,
} from '../lib/daylight';
import { getErrorMessage } from '../lib/error-message';
import { formatDistance, formatDuration, formatTimeOfDay } from '../lib/format';
import { metersToMiles, pathLengthMeters } from '../lib/geo';
import { routeGeometryFingerprint } from '../lib/route-identity';
import { scheduleDepartureNotification } from '../lib/notifications';
import {
  ROUTE_HAZARD_LABEL,
  ROUTE_HAZARD_ORDER,
  ROUTE_SAFE_LABEL,
  ROUTE_SAFE_ORDER,
  firstRouteSafeOnPath,
  routeHazardType,
  routeHazardsOnPath,
  routeSafeType,
  type RouteHazardType,
  type RouteSafeType,
} from '../lib/route-preview';
import { isPointNearPolyline, routePassesZone } from '../lib/scoring';

import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim, pressedFeedback, tapTarget44 } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

// Re-export for home.tsx (focusRouteHazardAtIndex / handleRouteSafeChipPress)
export type { RouteHazardType, RouteSafeType };
export { routeHazardsOnPath, firstRouteSafeOnPath };

// ---------------------------------------------------------------------------
// Props

type PreferredStation = { latitude: number; longitude: number };

type RoutePreviewCardProps = {
  routes: Route[];
  recommended: Route | undefined;
  /** Controlled: Home owns selectedRouteId state; derived selectedRoute passed here. */
  selectedRoute: Route | undefined;
  onSelectRoute: (id: string) => void;
  enabledZones: Zone[];
  params: { destLat?: string; destLng?: string; destName?: string };
  cloudCoverPct: number | undefined;
  isCalculatingRoute: boolean;
  routeFetchSource: RouteSource | null;
  tripZonesStatus: 'idle' | 'loading' | 'ready';
  tripZonesFetchFailed: boolean;
  tripZonesCorridorComplete: boolean;
  onCorridorRetry: () => void;
  onHazardChipPress: (type: RouteHazardType) => void;
  onSafeChipPress: (type: RouteSafeType) => void;
  preferredStations: PreferredStation[];
  fuelType?: string;
};

// ---------------------------------------------------------------------------
// Component

export function RoutePreviewCard({
  routes,
  recommended,
  selectedRoute,
  onSelectRoute,
  enabledZones,
  params,
  cloudCoverPct,
  isCalculatingRoute,
  routeFetchSource,
  tripZonesStatus,
  tripZonesFetchFailed,
  tripZonesCorridorComplete,
  onCorridorRetry,
  onHazardChipPress,
  onSafeChipPress,
  preferredStations,
  fuelType,
}: RoutePreviewCardProps) {
  const router = useRouter();
  const fontScale = PixelRatio.getFontScale();
  const reduceMotion = useReduceMotion();
  const { regulars, markRegular, unmarkRegular } = useRegularDestinations();
  const [pendingAction, setPendingAction] = useState<'go' | 'schedule' | null>(null);
  const pendingRequest = useRef<{ kind: 'go' | 'schedule' } | null>(null);
  const isPreparingNavigation = pendingAction === 'go';
  const isScheduling = pendingAction === 'schedule';

  useEffect(() => {
    setPendingAction(null);
    return () => { pendingRequest.current = null; };
  }, [params.destLat, params.destLng, selectedRoute?.id]);

  // ---- Route cycling -------------------------------------------------------

  // lastCycleDirRef stamps which chevron was last tapped so the ETA entrance
  // animation can slide in from the correct direction.
  const lastCycleDirRef = useRef<1 | -1 | null>(null);

  const selectedIndex = routes.findIndex((r) => r.id === selectedRoute?.id);
  const canPrevRoute = selectedIndex > 0 && !isPreparingNavigation;
  const canNextRoute = selectedIndex >= 0 && selectedIndex < routes.length - 1 && !isPreparingNavigation;

  function cycleRoute(dir: 1 | -1) {
    if (routes.length < 2) return;
    const cur = routes.findIndex((r) => r.id === selectedRoute?.id);
    const next = Math.min(routes.length - 1, Math.max(0, cur + dir));
    if (next === cur) return;
    pendingRequest.current = null;
    setPendingAction(null);
    lastCycleDirRef.current = dir;
    haptics.tap();
    const choice = routes[next];
    onSelectRoute(choice.id);
    if (Platform.OS === 'ios') {
      const road = primaryRoadName(choice.steps);
      AccessibilityInfo.announceForAccessibility(`Route ${next + 1} of ${routes.length}${road ? ` via ${road}` : ''}`);
    }
  }

  // ---- ETA entrance animation ----------------------------------------------

  // One-shot opacity fade + optional directional slide when the ETA resolves
  // or a route switch happens. Reduce Motion → skip the translate, keep the
  // haptic (which doesn't depend on motion).
  const minutesOpacity = useRef(new Animated.Value(1)).current;
  const routeShiftX = useRef(new Animated.Value(0)).current;
  const lastMinutesRevealKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedRoute || !params.destLat || !params.destLng) return;
    const key = `${params.destLat}|${params.destLng}|${selectedRoute.id}|${selectedRoute.estimatedMinutes}`;
    if (lastMinutesRevealKeyRef.current === key) return;
    const isFirstReveal = lastMinutesRevealKeyRef.current === null;
    lastMinutesRevealKeyRef.current = key;
    haptics.tap();
    // Skip the fade on the very first reveal — without this, the card briefly
    // renders "—", fades to "12 min", and the user sees the entrance. Better
    // entrance is just "appears" on first paint; subsequent route-changes get
    // the fade as a "we recalculated" cue.
    if (!isFirstReveal && !reduceMotion) {
      const cycleDir = lastCycleDirRef.current;
      lastCycleDirRef.current = null;
      minutesOpacity.setValue(0);
      // cycleDir non-null = chevron tap → pair fade with directional slide-in.
      // null = route refetch or map-tap → fade only, no slide.
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

  // ---- Regular destination bookmark ----------------------------------------

  const isRegularDestination = useMemo(
    () =>
      !!params.destLat &&
      !!params.destLng &&
      isRegularLocation(parseFloat(params.destLat), parseFloat(params.destLng), regulars),
    [params.destLat, params.destLng, regulars],
  );

  function handleToggleRegular() {
    if (!params.destLat || !params.destLng) return;
    const lat = parseFloat(params.destLat);
    const lng = parseFloat(params.destLng);
    if (isRegularDestination) {
      haptics.tap();
      void unmarkRegular(lat, lng);
    } else {
      haptics.confirm();
      void markRegular({
        name: params.destName ?? 'Destination',
        latitude: lat,
        longitude: lng,
      });
    }
  }

  // ---- Derived display values -----------------------------------------------

  const destinationName = params.destName?.trim() || 'Destination';
  const noDrivingRoute = routeFetchSource === 'no-route';
  const unavailableTitle = noDrivingRoute ? 'No route available' : 'Route unavailable';
  const unavailableBody = noDrivingRoute
    ? `We couldn't find a driving route to ${destinationName}. Try a different destination.`
    : 'Check your location access and try again.';
  const routeReady = !!selectedRoute && !isCalculatingRoute && routeFetchSource !== 'no-route';
  const viaRoad = primaryRoadName(selectedRoute?.steps);
  const duration = selectedRoute?.estimatedMinutes;
  const durationLabel = duration != null && Number.isFinite(duration) && duration >= 0
    ? formatDuration(duration)
    : null;
  const arrival = durationLabel && duration != null
    ? new Date(Date.now() + duration * 60_000)
    : null;
  const arrivalTime = arrival ? formatTimeOfDay(arrival) : null;
  const arrivalLight = selectedRoute && arrival
    ? arrivalLightAt(selectedRoute.coordinates[selectedRoute.coordinates.length - 1], arrival, cloudCoverPct)
    : null;
  const distance = selectedRoute?.distanceMeters;
  const distanceLabel = distance != null && Number.isFinite(distance) && distance >= 0
    ? formatDistance(metersToMiles(distance))
    : null;

  // ---- Chip computations ----------------------------------------------------

  const suggestedDeparture = useMemo(
    () => (selectedRoute ? suggestedDepartureForDaylight(selectedRoute) : null),
    [selectedRoute],
  );

  // Comprehensive hazard chips for the route-preview card: counts of every
  // charted hazard type the selected route passes, via routePassesZone (same
  // route-level line-based test the score uses). Returns chips in
  // ROUTE_HAZARD_ORDER; empty → truly clear.
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
      return {
        type: t,
        count,
        label: count === 1 ? ROUTE_HAZARD_LABEL[t][0] : ROUTE_HAZARD_LABEL[t][1],
      };
    });
  }, [selectedRoute, enabledZones]);

  // Safe-zone chips — the offset that hazards score against. Only computed
  // when hazards are present (caller skips rendering otherwise).
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
      return {
        type: t,
        count,
        label: count === 1 ? ROUTE_SAFE_LABEL[t][0] : ROUTE_SAFE_LABEL[t][1],
      };
    });
  }, [selectedRoute, enabledZones]);

  // Trusted fuel station on route — ~150m tolerance.
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

  const trustedNoun = fuelType === 'electric' ? 'charger' : 'station';

  async function handleSchedule() {
    if (!suggestedDeparture || pendingRequest.current) return;
    const request = { kind: 'schedule' } as const;
    pendingRequest.current = request;
    setPendingAction('schedule');
    haptics.tap();
    const result = await scheduleDepartureNotification(suggestedDeparture, params.destName)
      .catch(() => ({ ok: false, reason: 'failed' }) as const);
    if (pendingRequest.current !== request) return;
    pendingRequest.current = null;
    setPendingAction(null);
    if (result.ok) {
      const timeLabel = formatTimeOfDay(suggestedDeparture);
      haptics.confirm();
      Alert.alert(
        `Scheduled for ${timeLabel}`,
        `We'll send a heads-up at ${timeLabel} so you can leave when the daylight's right.`,
        [{ text: 'Got it' }],
      );
    } else if (result.reason === 'permission-denied') {
      Alert.alert(
        'Notification access needed',
        "Allow Notifications in Settings to get a heads-up when it's time to leave. You can still leave at the suggested time manually.",
      );
    } else if (result.reason === 'past-time') {
      Alert.alert(
        "Can't schedule that time",
        'That moment has already passed. Try picking a new destination.',
      );
    } else {
      const { title, body } = getErrorMessage('save', 'transient');
      Alert.alert(title, body);
    }
  }

  async function handleStartNavigation() {
    if (!routeReady || pendingRequest.current?.kind === 'go') return;
    const request = { kind: 'go' } as const;
    pendingRequest.current = request;
    haptics.tap();
    setPendingAction('go');

    if (selectedRoute) {
      const validatedEvidence = enabledZones.filter((zone) =>
        routePassesZone(selectedRoute.coordinates, zone),
      );
      try {
        await prepareRouteResilienceBundle({
          route: selectedRoute,
          routes,
          validatedEvidence,
          departureTimeMs: Date.now(),
        });
      } catch (error) {
        console.warn('[route-resilience] bundle save failed:', error);
      }
    }

    if (pendingRequest.current !== request) return;
    pendingRequest.current = null;
    setPendingAction(null);
    router.push({
      pathname: '/en-route',
      params: {
        ...(params.destLat ? { destLat: params.destLat } : {}),
        ...(params.destLng ? { destLng: params.destLng } : {}),
        ...(params.destName ? { destName: params.destName } : {}),
        // Prime /en-route with selected route data so ETA renders
        // immediately on mount instead of waiting for its own fetch.
        // Match the selected geometry when navigation refetches alternatives.
        ...(selectedRoute
          ? {
              destEstMinutes: String(selectedRoute.estimatedMinutes),
              destDistanceMeters: String(selectedRoute.distanceMeters),
              destRouteGeometry: routeGeometryFingerprint(selectedRoute.coordinates),
              ...(arrivalLight ? { destArrivalLight: arrivalLight } : {}),
              destRouteRank: String(Math.max(0, selectedIndex)),
              ...(cloudCoverPct != null ? { destCloudCoverPct: String(cloudCoverPct) } : {}),
            }
          : {}),
      },
    });
  }

  // ---- Render ---------------------------------------------------------------

  return (
    <View
      style={[
        styles.routePreviewLayout,
        fontScale > 1.4 && styles.routePreviewLargeText,
      ]}
    >
      <ScrollView
        style={[
          styles.bottomSheetScroll,
          fontScale > 1.4 && styles.bottomSheetScrollLargeText,
        ]}
        contentContainerStyle={styles.bottomSheetContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.destinationHeader}>
          <Text style={styles.routeDestTitle} accessibilityRole="header" maxFontSizeMultiplier={2}>
            {destinationName}
          </Text>
          {params.destLat && params.destLng ? (
            <Pressable
              onPress={handleToggleRegular}
              accessibilityRole="button"
              accessibilityLabel={isRegularDestination ? 'Remove from regular destinations' : 'Save as a regular destination'}
              accessibilityState={{ selected: isRegularDestination }}
              style={({ pressed }) => [styles.headerButton, pressed && pressedDim]}
            >
              <SavedPlaceBookmark size={22} variant={isRegularDestination ? 'selected' : 'default'} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              haptics.tap();
              pendingRequest.current = null;
              router.replace({ pathname: '/home', params: {} });
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear destination and return to browsing"
            style={({ pressed }) => [styles.headerButton, pressed && pressedDim]}
          >
            <X size={16} color={colors.labelSecondary} weight="bold" />
          </Pressable>
        </View>

        {isCalculatingRoute ? (
          <LoadingState text="Mapping the safest way there…" style={styles.routePreviewState} />
        ) : !routeReady ? (
          <View
            style={styles.noRouteState}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${unavailableTitle}. ${unavailableBody}`}
          >
            <PathIcon size={40} color={colors.wiltedgreen} weight="duotone" />
            <View style={styles.noRouteText}>
              <Text style={styles.noRouteHeadline}>{unavailableTitle}</Text>
              <Text style={styles.noRouteBody}>{unavailableBody}</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.routeSummaryBlock}>
              {routes.length > 1 ? (
                <View style={[styles.routeChoiceRow, fontScale > 1.4 && styles.routeChoiceStack]}>
                  <View style={styles.routeSwitcher}>
                    <Pressable
                      onPress={() => cycleRoute(-1)}
                      disabled={!canPrevRoute}
                      accessibilityRole="button"
                      accessibilityLabel="Previous route"
                      accessibilityState={{ disabled: !canPrevRoute }}
                      style={({ pressed }) => [
                        styles.routeArrow,
                        !canPrevRoute && styles.routeCycleBtnDisabled,
                        pressed && canPrevRoute && pressedDim,
                      ]}
                    >
                      <CaretLeft size={20} weight="bold" color={colors.labelSecondary} />
                    </Pressable>
                    <Text
                      style={styles.routeCountLabel}
                      maxFontSizeMultiplier={2}
                      accessibilityLabel={`Route ${selectedIndex + 1} of ${routes.length}`}
                      accessibilityLiveRegion="polite"
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
                        styles.routeArrow,
                        !canNextRoute && styles.routeCycleBtnDisabled,
                        pressed && canNextRoute && pressedDim,
                      ]}
                    >
                      <CaretRight size={20} weight="bold" color={colors.labelSecondary} />
                    </Pressable>
                  </View>
                  {viaRoad && (
                    <View style={[styles.routeRoad, fontScale > 1.4 && styles.routeRoadStacked]}>
                      <Text style={styles.routeViaLabel} maxFontSizeMultiplier={2}>Via {viaRoad}</Text>
                    </View>
                  )}
                </View>
              ) : viaRoad ? (
                <Text style={styles.routeViaLabel} maxFontSizeMultiplier={2}>Via {viaRoad}</Text>
              ) : null}

              <View style={styles.tripFacts}>
                {(durationLabel || distanceLabel) && (
                  <Animated.View
                    style={[
                      styles.routeHeroRow,
                      { opacity: minutesOpacity, transform: [{ translateX: routeShiftX }] },
                    ]}
                    accessible
                    accessibilityRole="text"
                    accessibilityLabel={[durationLabel, distanceLabel].filter(Boolean).join(', ')}
                  >
                    {durationLabel && <Text style={styles.routeMinutes} maxFontSizeMultiplier={2}>{durationLabel}</Text>}
                    {distanceLabel && (
                      <View style={styles.metricPart}>
                        {durationLabel && <MetaSeparator style={styles.routeMetaSeparator} maxFontSizeMultiplier={2} />}
                        <Text style={styles.routeDistance} maxFontSizeMultiplier={2}>{distanceLabel}</Text>
                      </View>
                    )}
                  </Animated.View>
                )}
                {arrivalTime && (
                  <View
                    style={styles.routeMetaCluster}
                    accessible
                    accessibilityRole="text"
                    accessibilityLabel={[`Arrive at ${arrivalTime}`, arrivalLight].filter(Boolean).join(', ')}
                  >
                    <Text style={styles.routeArrival} maxFontSizeMultiplier={2}>Arrive {arrivalTime}</Text>
                    {arrivalLight && (
                      <View style={styles.metricPart}>
                        <MetaSeparator style={styles.routeMetaSeparator} maxFontSizeMultiplier={2} />
                        <ArrivalLightIndicator light={arrivalLight} size="body" />
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>

            {recommended &&
              (tripZonesFetchFailed ||
                routeHazardChips.length > 0 ||
                (tripZonesStatus === 'ready' && tripZonesCorridorComplete)) && (
              <>
                <RouteChipsAnimatedWrap style={styles.routeChipsBlock}>
                  {tripZonesFetchFailed ? (
                    <View style={styles.routeChipsRow} accessibilityLiveRegion="polite">
                      <RouteZonesFetchFailedChip onRetry={onCorridorRetry} />
                    </View>
                  ) : routeHazardChips.length > 0 ? (
                    <>
                      <Text style={styles.routeChipsHeader}>Along this route:</Text>
                      <View
                        style={styles.routeChipsRow}
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
                            onPress={() => onHazardChipPress(c.type)}
                          />
                        ))}
                        {/* Safe-zone chips render AFTER the hazards — they're
                            the offset that lets a hazard-heavier route win on
                            net score. Showing only the negative half made the
                            recommendation feel wrong (user-flagged 2026-06-04). */}
                        {routeSafeChips.map((c) => (
                          <RouteSafeChip
                            key={c.type}
                            count={c.count}
                            label={c.label}
                            onPress={() => onSafeChipPress(c.type)}
                          />
                        ))}
                      </View>
                    </>
                  ) : (
                    <View
                      style={styles.routeChipsRow}
                      accessible
                      accessibilityRole="text"
                      accessibilityLabel={
                        selectedRoute &&
                        pathLengthMeters(selectedRoute.coordinates) > LONG_TRIP_COPY_METERS
                          ? ALL_CLEAR_A11Y_LONG_TRIP
                          : 'No reported hazards or flagged zones along this route.'
                      }
                    >
                      <RouteAllClearChip />
                    </View>
                  )}
                </RouteChipsAnimatedWrap>
                {selectedRoute &&
                  pathLengthMeters(selectedRoute.coordinates) > LONG_TRIP_COPY_METERS &&
                  tripZonesStatus === 'ready' &&
                  tripZonesCorridorComplete &&
                  !tripZonesFetchFailed && (
                    <Text style={styles.routeChipsFootnote} accessibilityRole="text">
                      {LONG_TRIP_FOOTNOTE_COPY}
                    </Text>
                  )}
              </>
            )}

            {recommended && trustedStationOnRoute && (
              <View style={styles.trustedOnRouteRow}>
                <Star size={16} color={colors.burntgreen} weight="fill" />
                <Text style={styles.trustedOnRouteText}>
                  A {trustedNoun} you trust is on this route.
                </Text>
              </View>
            )}

            {suggestedDeparture && (
              <View style={styles.tradeoffRow}>
                <Text
                  style={[
                    styles.tradeoffCopy,
                    previewType(relaxedLineHeight(typography.footnoteRegular)),
                  ]}
                >
                  Heads up! You can leave in a bit and still make it on time with
                  some added daylight on your route.
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.scheduleBtn, pressed && pressedFeedback]}
                  onPress={handleSchedule}
                  disabled={isScheduling || isPreparingNavigation}
                  accessibilityState={{ busy: isScheduling, disabled: isScheduling || isPreparingNavigation }}
                  accessibilityRole="button"
                  accessibilityLabel={isScheduling ? 'Scheduling departure reminder' : `Schedule trip for ${formatTimeOfDay(suggestedDeparture)} for better daylight`}
                >
                  <Text
                    style={styles.scheduleText}
                    numberOfLines={2}
                    maxFontSizeMultiplier={2}
                  >
                    {isScheduling ? 'Scheduling…' : `Schedule for ${formatTimeOfDay(suggestedDeparture)}`}
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {routeReady && (
        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.goBtn,
              isPreparingNavigation && styles.goBtnPreparing,
              pressed && !isPreparingNavigation && pressedFeedback,
            ]}
            onPress={handleStartNavigation}
            disabled={isPreparingNavigation}
            accessibilityRole="button"
            accessibilityLabel={
              isPreparingNavigation ? 'Preparing route for weak signal' : 'Start navigation'
            }
            accessibilityState={{
              busy: isPreparingNavigation,
              disabled: isPreparingNavigation,
            }}
          >
            {isPreparingNavigation ? (
              <ActivityIndicator size="small" color={colors.black} />
            ) : (
              <ArrowRight size={24} color={colors.black} weight="bold" />
            )}
            <Text
              style={styles.goText}
              numberOfLines={2}
              maxFontSizeMultiplier={2}
            >
              {isPreparingNavigation ? 'Preparing…' : 'Go'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Inline chip components

/**
 * Animated wrapper for the chip row — 220ms fade-in on first appearance.
 */
function RouteChipsAnimatedWrap({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const entrance = useEntranceAnimation(0);
  return <Animated.View style={[style, entrance.style]}>{children}</Animated.View>;
}

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
      <WarningDiamond size={16} color={colors.orange} weight="fill" />
      <Text style={styles.routeChipText}>
        {count} {label}
      </Text>
    </Pressable>
  );
}

/**
 * Positive counterpart to RouteWarningChip — rendered when the route has
 * zero hazard intersections. Single fadedgreen pill with a check glyph so
 * the slot stays consistent across route variants.
 */
function RouteAllClearChip() {
  return (
    <View
      style={styles.routeAllClearChip}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Check size={16} color={colors.burntgreen} weight="bold" />
      <Text style={styles.routeAllClearText}>All clear</Text>
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
      accessibilityHint="Re-checks this route for hazards"
    >
      <ArrowClockwise size={16} color={colors.labelSecondary} weight="bold" />
      <Text style={styles.routeZonesLoadingText}>Couldn&apos;t check route</Text>
      <MetaSeparator style={styles.routeZonesMetaSeparator} />
      <Text style={styles.routeZonesLoadingText}>Retry</Text>
    </Pressable>
  );
}

/**
 * Safe-zone chip — renders alongside RouteWarningChips to surface what's
 * offsetting the visible hazards. Same fadedgreen/burntgreen register as
 * RouteAllClearChip.
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

// ---------------------------------------------------------------------------
// Styles

// iOS scales an explicit lineHeight along with the glyphs. Give it the token's
// baseline line box so accessibility sizes are applied exactly once.
function previewType(token: TextStyle, maximumScale?: number) {
  return dynamicType(token, Platform.OS === 'ios' ? 1 : maximumScale);
}

const styles = StyleSheet.create({
  routePreviewLayout: {
    flexShrink: 1,
  },
  routePreviewLargeText: {
    flex: 1,
  },
  bottomSheetScroll: {
    flexShrink: 1,
  },
  bottomSheetScrollLargeText: {
    flex: 1,
  },
  bottomSheetContent: {
    gap: spacing.md,
  },
  routePreviewState: {
    marginTop: -spacing.sm,
    alignSelf: 'center',
  },
  noRouteState: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  noRouteText: {
    gap: spacing.xs,
  },
  noRouteHeadline: {
    ...previewType(typography.title3Emphasized),
    color: colors.wiltedgreen,
  },
  noRouteBody: {
    ...previewType(typography.footnoteRegular),
    color: colors.labelTertiary,
  },
  destinationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  routeDestTitle: {
    ...previewType(typography.title2Emphasized, 2),
    color: colors.black,
    flex: 1,
  },
  headerButton: {
    ...tapTarget44,
    borderRadius: radii.pill,
    backgroundColor: colors.fillsTertiary,
  },
  routeSummaryBlock: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  routeChoiceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  routeChoiceStack: {
    flexDirection: 'column',
    gap: spacing.xs,
  },
  routeSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  routeRoad: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  routeRoadStacked: {
    flex: 0,
    minHeight: 0,
    alignSelf: 'stretch',
  },
  routeArrow: {
    ...tapTarget44,
    borderRadius: radii.pill,
    backgroundColor: colors.fillsTertiary,
  },
  routeCountLabel: {
    ...previewType(typography.subheadlineEmphasized, 2),
    color: colors.labelSecondary,
    minWidth: 44,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  routeViaLabel: {
    ...previewType(typography.calloutRegular, 2),
    color: colors.labelSecondary,
  },
  tripFacts: {
    gap: spacing.xs,
  },
  routeHeroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  routeMinutes: {
    ...previewType(typography.title2Emphasized, 2),
    color: colors.wiltedgreen,
    flexShrink: 1,
  },
  routeDistance: {
    ...previewType(typography.title3Regular, 2),
    color: colors.labelSecondary,
    flexShrink: 1,
  },
  routeMetaCluster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  routeArrival: {
    ...previewType(typography.bodyRegular, 2),
    color: colors.labelSecondary,
    flexShrink: 1,
  },
  metricPart: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  routeMetaSeparator: {
    ...previewType(typography.bodyRegular, 2),
    color: colors.labelTertiary,
  },
  routeChipsBlock: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  routeChipsFootnote: {
    ...previewType(typography.footnoteRegular),
    color: colors.labelTertiary,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  routeChipsHeader: {
    ...previewType(typography.footnoteRegular),
    color: colors.labelTertiary,
  },
  routeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  routeCycleBtnDisabled: {
    opacity: 0.4,
  },
  routeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.slightlyDarkOrange,
    backgroundColor: colors.white,
  },
  routeChipPressable: {
    minHeight: 44,
    justifyContent: 'center',
  },
  routeChipText: {
    ...previewType(typography.caption1Emphasized),
    color: colors.black,
  },
  routeAllClearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.fadedgreen,
  },
  routeAllClearText: {
    ...previewType(typography.caption1Emphasized),
    color: colors.burntgreen,
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
    ...previewType(typography.caption1Emphasized),
    color: colors.labelSecondary,
  },
  routeZonesMetaSeparator: {
    ...previewType(typography.caption1Emphasized),
    color: colors.labelSecondary,
  },
  trustedOnRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  trustedOnRouteText: {
    ...previewType(typography.footnoteRegular),
    color: colors.burntgreen,
  },
  tradeoffRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  tradeoffCopy: {
    // Type comes from the render site's previewType(relaxedLineHeight(...))
    // — the stress-relaxed variant. Keeping a base footnote here would just
    // be overridden every render, so only color lives in the StyleSheet.
    color: colors.mutedTertiary,
  },
  actionsRow: {
    alignItems: 'stretch',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    // paddingBottom was spacing.xl (32pt). The parent `bottomSheet`
    // (app/home.tsx) is a SafeAreaView with edges=['bottom'], which
    // already adds the home-indicator inset (~34pt on iPhone 17 Pro).
    // The extra 32pt stacked on top read as dead white space below
    // the Go button. spacing.sm (8pt) is the visual breath that
    // separates Go from the safe-area inset without doubling it.
    paddingBottom: spacing.sm,
  },
  scheduleBtn: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.wiltedgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleText: {
    ...previewType(typography.footnoteEmphasized, 2),
    color: colors.wiltedgreen,
    flexShrink: 1,
    textAlign: 'center',
  },
  goBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.freshgreen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.e1,
  },
  goBtnPreparing: {
    opacity: 0.85,
  },
  goText: {
    ...previewType(typography.bodyEmphasized, 2),
    color: colors.black,
    flexShrink: 1,
    textAlign: 'center',
  },
});
