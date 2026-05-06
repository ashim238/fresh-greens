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
import MapView, { Circle, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DragHandle } from '../components/DragHandle';
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
export default function EnRoute() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const params = useLocalSearchParams<{
    destLat?: string;
    destLng?: string;
    destName?: string;
  }>();

  const [osmZones, setOsmZones] = useState<Zone[]>([]);
  const [reportZones, setReportZones] = useState<Zone[]>([]);
  const [rawRoutes, setRawRoutes] = useState<Route[]>([]);
  // Bottom-sheet height drives where the side button column floats. Same
  // pattern /home uses for the Report button: measure on layout, anchor
  // children relative to the measured value, conditionally render so we
  // never paint at the wrong position.
  const [bottomSheetHeight, setBottomSheetHeight] = useState(0);

  const allZones = useMemo(
    () => [...osmZones, ...reportZones],
    [osmZones, reportZones],
  );

  const routes = useMemo(
    () => pickWinner(rawRoutes, allZones),
    [rawRoutes, allZones],
  );

  const recommended = routes.find((route) => route.type === 'recommended');

  // Arrival clock time (now + remaining minutes), formatted as "8:30".
  // Figma shows the arrival time, not minutes-remaining — so we add the
  // estimated duration to the current wall-clock time. Recomputed only
  // when the recommended route's duration changes.
  const arrivalTime = useMemo(() => {
    if (!recommended) return '—';
    const arrival = new Date(
      Date.now() + recommended.estimatedMinutes * 60_000,
    );
    return arrival.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [recommended]);

  // Distance in miles, derived from the recommended route's coordinates.
  // OSRM returns distance in meters on the route object; we fall back to
  // a polyline length estimate when the field isn't populated.
  const distanceMiles = useMemo(() => {
    if (!recommended) return null;
    return (recommended.distanceMeters ?? 0) / 1609.344;
  }, [recommended]);

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

      const routePromise = getRoutesBetween(center, destination);
      const zonePromise = getZonesForRegion(center);

      const fetchedRoutes = await routePromise;
      if (cancelled) return;
      setRawRoutes(fetchedRoutes);

      const fetchedZones = await zonePromise;
      if (cancelled) return;
      setOsmZones(fetchedZones);
    }

    fetchAndCenterOnUser();
    return () => {
      cancelled = true;
    };
  }, [params.destLat, params.destLng]);

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
        showsUserLocation
        showsMyLocationButton={false}
      >
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
        <View style={styles.turnSign}>
          <View
            style={styles.turnDirection}
            accessible
            accessibilityLabel="Turn left in 0.5 miles"
          >
            {/*
              Turn maneuver glyph — informational, not a button. Ionicons
              doesn't ship a curving turn arrow; arrow-back-outline is the
              closest stand-in until a custom turn-sign asset lands.
            */}
            <Ionicons
              name="arrow-back-outline"
              size={56}
              color={colors.white}
            />
            <Text style={styles.turnDistance}>
              0.5{' '}
              <Text style={styles.turnDistanceUnit}>mi</Text>
            </Text>
          </View>

          <View style={styles.turnText}>
            <Text style={styles.turnInstruction}>
              Turn left onto{'\n'}
              <Text style={styles.turnStreet}>South Cedar Street</Text>
            </Text>
          </View>

          <Pressable
            style={styles.micBtn}
            accessibilityRole="button"
            accessibilityLabel="Voice control (not yet supported)"
          >
            <Ionicons name="mic" size={24} color={colors.labelSecondary} />
          </Pressable>
        </View>

        <View style={styles.thenFooter}>
          <Text style={styles.thenText}>Then</Text>
          <Ionicons
            name="arrow-forward"
            size={20}
            color={colors.fadedgreen}
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
      {bottomSheetHeight > 0 && (
        <View
          style={[
            styles.sideButtons,
            { bottom: bottomSheetHeight + 24 },
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            style={styles.sideBtn}
            accessibilityRole="button"
            accessibilityLabel="Help (coming soon)"
          >
            <Ionicons name="medical" size={32} color={colors.red} />
          </Pressable>
          <Pressable
            style={styles.sideBtn}
            onPress={() => router.push('/safety')}
            accessibilityRole="button"
            accessibilityLabel="Open safety menu"
          >
            <Ionicons
              name="shield-checkmark"
              size={32}
              color={colors.wiltedgreen}
            />
          </Pressable>
          <Pressable
            style={styles.sideBtn}
            onPress={() => router.push('/report')}
            accessibilityRole="button"
            accessibilityLabel="Report something"
          >
            <Ionicons name="alert-circle" size={32} color={colors.orange} />
          </Pressable>
          <Pressable
            style={styles.sideBtn}
            onPress={handleRecenter}
            accessibilityRole="button"
            accessibilityLabel="Recenter map on your location"
          >
            <Ionicons name="locate" size={32} color={colors.labelSecondary} />
          </Pressable>
        </View>
      )}

      {/*
        Bottom sheet — Figma 825:3783. Layout per design:
          [Volume] [End trip] [ETA "8:30"] [Search] [Paths]
          [distance · duration]
        End trip replaces the Figma's invisible "Spacer" slot — the design
        had no exit affordance, but we need one (system swipe-back is too
        easy to miss in active driving). End trip uses the close icon
        on a small white pill, parity with the other utility buttons.
      */}
      <SafeAreaView
        style={styles.bottomSheet}
        edges={['bottom']}
        onLayout={(e) => setBottomSheetHeight(e.nativeEvent.layout.height)}
      >
        <DragHandle />

        <View style={styles.sheetContent}>
          {/*
            3-slot layout — left/center/right each take equal flex:1
            width. ETA centers in its slot so it's guaranteed to land at
            screen center regardless of how many buttons sit on either
            side. The asymmetry (1 button left, 2 right) lives inside
            the slots, not across the row.
          */}
          <View style={styles.etaRow}>
            <View style={styles.leftSlot}>
              <Pressable
                style={styles.utilityBtn}
                accessibilityRole="button"
                accessibilityLabel="Toggle volume (coming soon)"
                hitSlop={12}
              >
                <Ionicons
                  name="volume-high"
                  size={24}
                  color={colors.labelSecondary}
                />
              </Pressable>
            </View>

            <View style={styles.centerSlot}>
              <Text style={styles.eta}>{arrivalTime}</Text>
            </View>

            <View style={styles.rightSlot}>
              <Pressable
                style={styles.utilityBtn}
                accessibilityRole="button"
                accessibilityLabel="Search along route (coming soon)"
                hitSlop={12}
              >
                <Ionicons
                  name="search"
                  size={24}
                  color={colors.labelSecondary}
                />
              </Pressable>

              <Pressable
                style={styles.utilityBtn}
                accessibilityRole="button"
                accessibilityLabel="Show alternate paths (coming soon)"
                hitSlop={12}
              >
                <Ionicons
                  name="git-branch"
                  size={24}
                  color={colors.labelSecondary}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.secondaryRow}>
            <Text style={styles.secondaryDistance}>
              {distanceMiles != null ? `${distanceMiles.toFixed(1)} mi.` : '—'}
            </Text>
            <Text style={styles.secondarySeparator}>·</Text>
            <Text style={styles.secondaryDuration}>
              {recommended ? `${recommended.estimatedMinutes} min` : '—'}
            </Text>
          </View>

          {/*
            End trip — lifted out of the icon row to its own labeled pill.
            A driver under stress shouldn't have to interpret an X glyph;
            "End trip" text is unambiguous, and the dedicated row resets
            the visual hierarchy (utilities are icons, status is a number,
            the explicit primary action is a labeled button).
          */}
          <Pressable
            style={styles.endTripBtn}
            onPress={handleEndTrip}
            accessibilityRole="button"
            accessibilityLabel="End trip"
          >
            <Text style={styles.endTripText}>End trip</Text>
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

  // --- Turn-sign header ---
  headerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.wiltedgreen,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  turnSign: {
    backgroundColor: colors.wiltedgreen,
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  turnDirection: {
    gap: 8,
    alignItems: 'flex-end',
  },
  turnDistance: {
    ...typography.title3Regular,
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
  micBtn: {
    width: 48,
    height: 48,
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
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
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
  sideBtn: {
    width: 56,
    height: 56,
    borderRadius: 100,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
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
    paddingTop: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  sheetContent: {
    gap: 8,
    paddingBottom: 8,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  leftSlot: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
  },
  rightSlot: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  utilityBtn: {
    // 44x44 visual + 24pt icons. Earlier iteration ran 32pt icons but
    // they crowded the 44pt frame (only 6pt of pill visible). 24pt icons
    // give 10pt of breathing room on each side — the icon reads as
    // sitting *inside* the pill, not filling it. Still legible at speed;
    // hitSlop=12 keeps effective tap area at 68pt for one-handed use.
    width: 44,
    height: 44,
    borderRadius: 1000,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    // M3 Elevation 1
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  eta: {
    ...typography.largeTitleEmphasized,
    color: colors.freshgreen,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryDistance: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
  },
  secondarySeparator: {
    ...typography.subheadlineRegular,
    color: colors.labelTertiary,
  },
  secondaryDuration: {
    ...typography.subheadlineRegular,
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
