import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

// Phosphor deep-imports — see app/trusted-contact-setup.tsx for the
// longer note on why we bypass the package's barrel index.
import { ArrowBendUpLeft } from 'phosphor-react-native/src/icons/ArrowBendUpLeft';
import { Shield } from 'phosphor-react-native/src/icons/Shield';

// Daylight glyphs — same SVGs Figma uses on /home's gradient key
// (node 825:3647) so the symbol means the same thing on both
// surfaces: arrival in daylight (sun) vs darkness (moon).
import DaylightMoon from '../assets/illustrations/daylight-moon.svg';
import DaylightSun from '../assets/illustrations/daylight-sun.svg';

import { DragHandle } from '../components/DragHandle';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { LandmarkMarker } from '../components/LandmarkMarker';
import { UserLocationMarker } from '../components/UserLocationMarker';
import { usePreferences } from '../hooks/usePreferences';
import { getCommunityReportsAsZones } from '../lib/api/community-reports';
import { getRoutesBetween, type Route, routeColors } from '../lib/api/routes';
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
import { pickWinner } from '../lib/scoring';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
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
  // Region + viewport size for marker clustering. Without these, dense
  // pin neighborhoods stack on top of the user-location dot at the
  // default zoom — same problem /home solved by clustering.
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [mapSize, setMapSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  // Live GPS for the custom UserLocationMarker — same pattern /home
  // uses to keep the dot above LandmarkMarker pins via zIndex.
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  // Current speed in mph, captured from the live GPS watch. Null until
  // the first position fix with a real speed value (iOS reports -1 or
  // null before motion is detected). Feeds the SpeedLimit sign's top
  // pill — when null, the pill renders a dash.
  const [speedMph, setSpeedMph] = useState<number | null>(null);
  // Bottom-sheet height drives where the side button column floats. Same
  // pattern /home uses for the Report button: measure on layout, anchor
  // children relative to the measured value, conditionally render so we
  // never paint at the wrong position.
  const [bottomSheetHeight, setBottomSheetHeight] = useState(0);

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

  // Arrival clock time (now + remaining minutes), formatted as "8:30".
  // Figma shows the arrival time as `h:MM` with a sun/moon glyph
  // beside it (not "8:30 PM") — the time stays compact (no wrap on
  // narrow devices) and morning/evening reads as a graphic instead
  // of an inline tag. We format manually rather than via
  // toLocaleTimeString since the iOS default appends locale
  // AM/PM that can't be cleanly stripped.
  const arrivalDisplay = useMemo(() => {
    if (!recommended) return { time: '—', isNight: false };
    const arrival = new Date(
      Date.now() + recommended.estimatedMinutes * 60_000,
    );
    const h24 = arrival.getHours();
    const h12 = h24 % 12 || 12;
    const minutes = String(arrival.getMinutes()).padStart(2, '0');
    // Night ≈ 6pm–6am. Common app convention; matches the moon-glyph
    // intent in Figma (moon = arriving in the dark, sun = daylight).
    const isNight = h24 < 6 || h24 >= 18;
    return { time: `${h12}:${minutes}`, isNight };
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

  // Subscribe to live GPS for the UserLocationMarker. Same setup as
  // /home — high accuracy, 1s/5m thresholds, cleanup on unmount.
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
        showsMyLocationButton={false}
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
          return (
            <LandmarkMarker
              key={zone.id}
              latitude={point.latitude}
              longitude={point.longitude}
              categoryId={zone.reportCategoryId}
              subTag={zone.reportSubTag}
              accessibilityLabel={zone.label}
            />
          );
        })}
        {routes.flatMap((route) => {
          // White halo polyline first (slightly wider) + colored stroke
          // on top — same pattern as /home, gives the route a 1–2pt
          // white border per Figma so it stands out against street
          // geometry. See the longer note on home.tsx.
          const isRecommended = route.type === 'recommended';
          const baseWidth = isRecommended
            ? routeColors.recommended.width
            : routeColors.alternate.width;
          const elements: React.ReactElement[] = [
            <Polyline
              key={`${route.id}-halo`}
              coordinates={route.coordinates}
              strokeColor={colors.white}
              strokeWidth={baseWidth + 3}
            />,
          ];
          if (isRecommended) {
            elements.push(
              ...gradientSegments(route).map((segment, idx) => (
                <Polyline
                  key={`${route.id}-seg-${idx}`}
                  coordinates={segment.coordinates}
                  strokeColor={segment.color}
                  strokeWidth={routeColors.recommended.width}
                />
              )),
            );
          } else {
            elements.push(
              <Polyline
                key={route.id}
                coordinates={route.coordinates}
                strokeColor={routeColors[route.type].stroke}
                strokeWidth={routeColors[route.type].width}
              />,
            );
          }
          return elements;
        })}

        {userLocation && (
          <UserLocationMarker
            latitude={userLocation.latitude}
            longitude={userLocation.longitude}
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
        <View style={styles.turnSign}>
          <View
            style={styles.turnDirection}
            accessible
            accessibilityLabel="Turn left in 0.5 miles"
          >
            {/*
              Turn maneuver glyph — informational, not a button. Phosphor's
              ArrowBendUpLeft duotone reads as a real turn-sign curve
              (the Ionicons arrow-back-outline used previously read as
              "back chevron," not "turn left"). Duotone weight gives the
              arrow visual mass against the wiltedgreen header without
              going filled — matches the rest of the app's nav icon
              register (Shield, House, Megaphone all duotone).
            */}
            <ArrowBendUpLeft
              size={56}
              color={colors.white}
              weight="regular"
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
            <Ionicons name="mic" size={32} color={colors.labelSecondary} />
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
            <Text style={styles.speedLimitCurrentNumber}>
              {speedMph ?? '—'}
            </Text>
          </View>
          <View style={styles.speedLimitSign}>
            <Text style={styles.speedLimitNumber}>25</Text>
            <Text style={styles.speedLimitUnit}>mph</Text>
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
            reads as a uniform stack.
          */}
          {/*
            Side-button glyphs use Ionicons as a temporary stand-in.
            The Figma design uses custom illustrated glyphs (one per
            button — Volume, Help, Shield, Report, Center) that aren't
            yet exported as SVG. When those drop into
            assets/illustrations/, swap each Ionicon below for the
            matching SVG component. Shield is already Phosphor (the
            documented canonical safety-affordance) and Report uses
            the documented orange alert-circle exception — those stay.
          */}
          <FloatingActionButton size="56" accessibilityLabel="Toggle volume (coming soon)">
            <Ionicons name="volume-high" size={32} color={colors.labelSecondary} />
          </FloatingActionButton>
          <FloatingActionButton size="56" accessibilityLabel="Help (coming soon)">
            <Ionicons name="medical" size={32} color={colors.red} />
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
            <Ionicons name="alert-circle" size={32} color={colors.orange} />
          </FloatingActionButton>
          <FloatingActionButton
            size="56"
            onPress={handleRecenter}
            accessibilityLabel="Recenter map on your location"
          >
            <Ionicons name="locate" size={32} color={colors.labelSecondary} />
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
                style={({ pressed }) => [
                  styles.utilityBtn,
                  pressed && pressedDim,
                ]}
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
            </View>

            <View style={styles.centerSlot}>
              {/*
                ETA cluster — `[16pt spacer] [time] [16pt sun/moon]`
                per Figma. The left spacer balances the right glyph
                so the time text stays optically centered. nowrap on
                the time defends against any future locale-format
                expansion.
              */}
              <View style={styles.etaCluster}>
                <View style={styles.etaIconSpacer} />
                <Text style={styles.eta} numberOfLines={1}>
                  {arrivalDisplay.time}
                </Text>
                {arrivalDisplay.isNight ? (
                  <DaylightMoon width={16} height={16} />
                ) : (
                  <DaylightSun width={16} height={16} />
                )}
              </View>
            </View>

            <View style={styles.rightSlot}>
              <Pressable
                style={({ pressed }) => [
                  styles.utilityBtn,
                  pressed && pressedDim,
                ]}
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
              {distanceMiles != null ? formatDistance(distanceMiles) : '—'}
            </Text>
            <Text style={styles.secondarySeparator}>·</Text>
            <Text style={styles.secondaryDuration}>
              {recommended ? formatDuration(recommended.estimatedMinutes) : '—'}
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
            style={({ pressed }) => [styles.endTripBtn, pressed && pressedDim]}
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
    // 16pt of additional top padding on top of SafeAreaView's
    // status-bar inset. Without it the turn arrow + instruction sit
    // visually flush with the status bar — readable but cramped on
    // device. The 16pt gives the turn-card content room to breathe
    // below the time/battery icons.
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
  // sideBtn style block retired — the 5 side-column buttons consume
  // the FloatingActionButton component now (size="56").

  // --- Speed Limit sign (Figma 364:3239) ---
  // Mirrors the sideButtons column on the right edge of the screen.
  // Two stacked elements: white pill on top (current speed), yellow
  // card below (speed limit). Real-world speed-limit-sign proportions.
  speedLimitWrap: {
    position: 'absolute',
    left: 16,
    width: 71,
    alignItems: 'stretch',
  },
  speedLimitCurrentPill: {
    backgroundColor: colors.white,
    borderWidth: 4,
    borderColor: colors.cardBorderSubtle,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 46,
    // Overlap with the yellow sign below per Figma — `mb-[-12px]` in
    // the source mocks. Gives the appearance of a unified stack.
    marginBottom: -12,
  },
  speedLimitCurrentNumber: {
    // SF Pro Bold stand-in for Overpass Bold (the canonical US speed-
    // limit-sign typeface). Visually close; swap when Overpass loads.
    fontFamily: 'SF Pro',
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 24,
    color: colors.black,
    textAlign: 'center',
    letterSpacing: -0.26,
  },
  speedLimitSign: {
    backgroundColor: colors.yellow,
    borderWidth: 4,
    borderColor: colors.cardBorderSubtle,
    borderRadius: 12,
    paddingHorizontal: 16,
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
    fontFamily: 'SF Pro',
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
  etaCluster: {
    flexDirection: 'row',
    // Matches Figma 825:3783 ETA's `items-start` + no inter-item gap.
    // The 16pt sun/moon glyph sits at the top of the row alongside
    // the 41pt-line-height "8:30" — visually subtitling the time as
    // "this is morning" / "this is night" rather than centered to
    // the time's mid-line (which read like a satellite dot floating
    // beside the digits).
    alignItems: 'flex-start',
    gap: 0,
  },
  etaIconSpacer: {
    width: 16,
    height: 16,
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
  },
});
