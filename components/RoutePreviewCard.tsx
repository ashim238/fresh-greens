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
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { ArrowClockwise } from 'phosphor-react-native/src/icons/ArrowClockwise';
import { ArrowRight } from 'phosphor-react-native/src/icons/ArrowRight';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { PathIcon } from 'phosphor-react-native/src/icons/Path';
import { Star } from 'phosphor-react-native/src/icons/Star';
import { WarningDiamond } from 'phosphor-react-native/src/icons/WarningDiamond';
import { X } from 'phosphor-react-native/src/icons/X';

import { DaylightRouteLegend } from './DaylightRouteLegend';
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
  arrivalLightLabel,
  gradientSegments,
  suggestedDepartureForDaylight,
} from '../lib/daylight';
import { getErrorMessage } from '../lib/error-message';
import { formatDistance, formatDuration, formatTimeOfDay } from '../lib/format';
import { pathLengthMeters } from '../lib/geo';
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
  const [navigationPrepStatus, setNavigationPrepStatus] = useState<'idle' | 'preparing'>(
    'idle',
  );
  const isPreparingNavigation = navigationPrepStatus === 'preparing';

  // ---- Route cycling -------------------------------------------------------

  // lastCycleDirRef stamps which chevron was last tapped so the ETA entrance
  // animation can slide in from the correct direction.
  const lastCycleDirRef = useRef<1 | -1 | null>(null);

  const selectedIndex = routes.findIndex((r) => r.id === selectedRoute?.id);
  const isRecommendedSelected = selectedRoute?.id === recommended?.id;
  const canPrevRoute = selectedIndex > 0;
  const canNextRoute = selectedIndex >= 0 && selectedIndex < routes.length - 1;

  function cycleRoute(dir: 1 | -1) {
    if (routes.length < 2) return;
    const cur = routes.findIndex((r) => r.id === selectedRoute?.id);
    const next = Math.min(routes.length - 1, Math.max(0, cur + dir));
    if (next === cur) return;
    lastCycleDirRef.current = dir;
    haptics.tap();
    onSelectRoute(routes[next].id);
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

  const viaRoad = primaryRoadName(selectedRoute?.steps);

  const arrivalTime =
    selectedRoute != null
      ? formatTimeOfDay(new Date(Date.now() + selectedRoute.estimatedMinutes * 60_000))
      : null;
  const METERS_PER_MILE = 1609.34;
  const distanceLabel =
    selectedRoute?.distanceMeters != null
      ? formatDistance(selectedRoute.distanceMeters / METERS_PER_MILE)
      : null;

  const arrivalSegs = selectedRoute ? gradientSegments(selectedRoute) : [];
  const arrivalBand = arrivalSegs.length
    ? arrivalSegs[arrivalSegs.length - 1].band
    : null;
  const arrivalLabel = arrivalBand ? arrivalLightLabel(arrivalBand, cloudCoverPct) : null;

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

  // ---- Chip computations ----------------------------------------------------

  const suggestedDeparture = useMemo(
    () => (recommended ? suggestedDepartureForDaylight(recommended) : null),
    [recommended],
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

  async function handleStartNavigation() {
    if (isPreparingNavigation) return;
    haptics.tap();
    setNavigationPrepStatus('preparing');
    let routePrepStatus: 'ready' | 'degraded' = selectedRoute ? 'ready' : 'degraded';

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
        routePrepStatus = 'degraded';
        console.warn('[route-resilience] bundle save failed:', error);
      }
    }

    setNavigationPrepStatus('idle');
    router.push({
      pathname: '/en-route',
      params: {
        ...(params.destLat ? { destLat: params.destLat } : {}),
        ...(params.destLng ? { destLng: params.destLng } : {}),
        ...(params.destName ? { destName: params.destName } : {}),
        // Prime /en-route with selected route data so ETA renders
        // immediately on mount instead of waiting for its own fetch.
        // destRouteRank = which route the user chose (0 = recommended).
        ...(selectedRoute
          ? {
              destEstMinutes: String(selectedRoute.estimatedMinutes),
              destDistanceMeters: String(selectedRoute.distanceMeters),
              destRouteRank: String(Math.max(0, selectedIndex)),
              routePrepStatus,
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
        {/*
          Clear-destination row — right-aligned 44pt X plus, when there's
          more than one route, a chevron pair to switch between them.
          Chevrons sit immediately left of the X so all three controls
          right-align together as one cluster.
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
              {/* Sighted route count — chevron pair alone doesn't say how many
                  alternates exist. VoiceOver gets it from the ETA label. */}
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
              haptics.tap();
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
            1. Calculating — fetch in flight, no data yet.
            2. No-route — Mapbox+OSRM both returned unroutable.
            3. Default — route is loaded.
        */}
        {isCalculatingRoute ? (
          <LoadingState text="Mapping the safest way there…" style={styles.routePreviewState} />
        ) : routeFetchSource === 'no-route' ? (
          <View
            style={styles.noRouteState}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`No route available. We couldn't find a driving route to ${params.destName ?? 'your destination'}. Try a different destination.`}
          >
            <PathIcon size={40} color={colors.wiltedgreen} weight="duotone" />
            <View style={styles.noRouteText}>
              <Text style={styles.noRouteHeadline}>No route available</Text>
              <Text style={styles.noRouteBody}>
                We couldn't find a driving route to{' '}
                {params.destName ?? 'your destination'}. Try a different
                destination.
              </Text>
            </View>
          </View>
        ) : (
          <>
            {/*
              Trip-summary block — destination title, hero duration + arrival,
              and distance are ONE unit, so they sit in a tight 4pt group
              rather than each taking the card's 16pt inter-row gap.
            */}
            <View style={styles.routeSummaryBlock}>
              {/*
                Destination title — card title + tappable save-as-regular
                toggle. Saved regulars show the bookmark glyph.
              */}
              <Pressable
                onPress={handleToggleRegular}
                accessibilityRole="button"
                accessibilityLabel={`${params.destName ?? 'Destination'}. ${
                  isRegularDestination ? 'Saved as a regular' : 'Not a regular'
                }.`}
                accessibilityHint={
                  isRegularDestination
                    ? 'Removes this destination from your regulars'
                    : 'Saves this destination as a regular'
                }
                style={({ pressed }) => [styles.routeDestTitleHit, pressed && pressedDim]}
              >
                <View style={styles.routeDestTitleRow}>
                  <Text
                    style={styles.routeDestTitle}
                    numberOfLines={2}
                    maxFontSizeMultiplier={2}
                  >
                    {params.destName ?? 'your destination'}
                  </Text>
                  <SavedPlaceBookmark
                    size={22}
                    variant={isRegularDestination ? 'selected' : 'default'}
                  />
                </View>
              </Pressable>

              {/*
                Hero row: "{N} min" headline + promoted arrival time.
                The ETA has a directional slide-in when a chevron drives the
                change — right chevron → slides in from +24pt, left → from -24pt.
              */}
              <View style={styles.routeHeroRow}>
                <Animated.Text
                  style={[
                    styles.routeMinutes,
                    { opacity: minutesOpacity, transform: [{ translateX: routeShiftX }] },
                  ]}
                  accessibilityLabel={`${
                    selectedRoute ? formatDuration(selectedRoute.estimatedMinutes) : 'No route'
                  }${routes.length > 1 ? `, route ${selectedIndex + 1} of ${routes.length}` : ''}`}
                  numberOfLines={1}
                  maxFontSizeMultiplier={2}
                >
                  {selectedRoute ? formatDuration(selectedRoute.estimatedMinutes) : '—'}
                </Animated.Text>
                {(arrivalTime || distanceLabel) && (
                  <View
                    style={styles.routeMetaCluster}
                    accessibilityRole="text"
                    accessibilityLabel={[
                      arrivalTime ? `arrive ${arrivalTime}` : null,
                      distanceLabel,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  >
                    {arrivalTime && (
                      <Text style={styles.routeArrival} maxFontSizeMultiplier={2}>
                        {`arrive\u00a0${arrivalTime}`}
                      </Text>
                    )}
                    {arrivalTime && distanceLabel && (
                      <MetaSeparator style={styles.routeMetaSeparator} />
                    )}
                    {distanceLabel && (
                      <Text style={styles.routeDistance} maxFontSizeMultiplier={2}>
                        {distanceLabel}
                      </Text>
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

            {/*
              Via + daylight share a row — both secondary context. Via flexes
              to fill the left column, daylight strip anchors the right at its
              fixed 96pt width.
            */}
            <View style={styles.routeViaRow}>
              <Text
                style={styles.routeViaLabel}
                numberOfLines={2}
                maxFontSizeMultiplier={2}
              >
                Via {viaRoad ?? params.destName ?? 'your destination'}
              </Text>
              <DaylightRouteLegend
                cloudCoverPct={cloudCoverPct}
                style={styles.daylightStripInline}
              />
            </View>

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
      </ScrollView>

      {/*
        Actions row — Schedule (outline wiltedgreen) on the left, Go (filled
        freshgreen) on the right. Hidden during calculating and no-route states.
      */}
      {!isCalculatingRoute && routeFetchSource !== 'no-route' && (
        <View style={styles.actionsRow}>
          {suggestedDeparture && (
            <Pressable
              style={({ pressed }) => [styles.scheduleBtn, pressed && pressedFeedback]}
              onPress={async () => {
                haptics.tap();
                const timeLabel = formatTimeOfDay(suggestedDeparture);
                const result = await scheduleDepartureNotification(
                  suggestedDeparture,
                  params.destName,
                );
                if (result.ok) {
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
              }}
              accessibilityRole="button"
              accessibilityLabel={`Schedule trip for ${formatTimeOfDay(suggestedDeparture)} for better daylight`}
            >
              {/* Two lines keep "Schedule for 7:30 AM" readable on narrow
                  buttons without shrinking text below the user's setting. */}
              <Text
                style={styles.scheduleText}
                numberOfLines={2}
                maxFontSizeMultiplier={2}
              >
                Schedule for {formatTimeOfDay(suggestedDeparture)}
              </Text>
            </Pressable>
          )}

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
    ...dynamicType(typography.title3Emphasized),
    color: colors.wiltedgreen,
  },
  noRouteBody: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelTertiary,
  },
  routeSummaryBlock: {
    gap: spacing.xs,
  },
  routeDestTitleHit: {
    minHeight: 44,
    justifyContent: 'center',
  },
  routeDestTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  routeDestTitle: {
    ...dynamicType(typography.title3Emphasized, 2),
    color: colors.black,
    flex: 1,
  },
  routeHeroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  routeMetaCluster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  routeArrival: {
    ...dynamicType(typography.subheadlineRegular, 2),
    color: colors.labelSecondary,
  },
  routeMetaSeparator: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelTertiary,
  },
  routeDistance: {
    ...dynamicType(typography.footnoteRegular, 2),
    color: colors.labelTertiary,
  },
  routeMinutes: {
    // H12: title2Emphasized (22pt) → largeTitleEmphasized (34pt). The "12 min"
    // is the anchor number — Waze and Apple Maps put ETA in the 34-36pt range.
    ...dynamicType(typography.largeTitleEmphasized, 2),
    color: colors.wiltedgreen,
  },
  routeChipsBlock: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  routeChipsFootnote: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelTertiary,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  routeChipsHeader: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelTertiary,
  },
  routeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  routeTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  routeCycleBtnDisabled: {
    opacity: 0.25,
  },
  routeCountLabel: {
    ...dynamicType(typography.caption1Regular),
    color: colors.labelTertiary,
    minWidth: 44,
    textAlign: 'center',
  },
  routeClearBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.xl,
    backgroundColor: colors.fillsTertiary,
    alignItems: 'center',
    justifyContent: 'center',
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
    ...dynamicType(typography.caption1Emphasized),
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
    ...dynamicType(typography.caption1Emphasized),
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
    ...dynamicType(typography.caption1Emphasized),
    color: colors.labelSecondary,
  },
  routeZonesMetaSeparator: {
    color: colors.labelSecondary,
  },
  routeViaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  daylightStripInline: {
    width: 96,
    gap: spacing.xs,
  },
  routeViaLabel: {
    ...dynamicType(typography.subheadlineRegular, 2),
    color: colors.labelSecondary,
    flex: 1,
  },
  routeConditionsCaption: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
    paddingHorizontal: spacing.lg,
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
    ...dynamicType(typography.footnoteRegular),
    color: colors.burntgreen,
  },
  tradeoffRow: {
    paddingHorizontal: spacing.lg,
  },
  tradeoffCopy: {
    // Type comes from the render site's dynamicType(relaxedLineHeight(...))
    // — the stress-relaxed variant. Keeping a base footnote here would just
    // be overridden every render, so only color lives in the StyleSheet.
    color: colors.mutedTertiary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
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
    flex: 1,
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
    ...dynamicType(typography.footnoteEmphasized, 2),
    color: colors.wiltedgreen,
    flexShrink: 1,
    textAlign: 'center',
  },
  goBtn: {
    flex: 1,
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
    ...dynamicType(typography.bodyEmphasized, 2),
    color: colors.black,
    flexShrink: 1,
    textAlign: 'center',
  },
});
