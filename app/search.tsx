import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Phosphor deep-imports per the project's tsconfig paths mapping —
// see app/trusted-contact-setup.tsx for the long note.
import { Clock } from 'phosphor-react-native/src/icons/Clock';
import { MagnifyingGlass } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { MapPin } from 'phosphor-react-native/src/icons/MapPin';

import FuelIcon from '../assets/illustrations/fuel.svg';
import QuickToolSaved from '../assets/illustrations/quick-tools-saved.svg';
import QuickToolFood from '../assets/illustrations/safety-tools-food.svg';
import QuickToolGas from '../assets/illustrations/safety-tools-gas.svg';
import QuickToolParking from '../assets/illustrations/safety-tools-parking.svg';

import { SearchBar } from '../components/SearchBar';
import { ErrorState, LoadingState } from '../components/StateCard';
import { useFuelProfile } from '../hooks/useFuelProfile';
import { useRecentSearches } from '../hooks/useRecentSearches';
import { useRegularDestinations } from '../hooks/useRegularDestinations';
import { useSavedPlaces } from '../hooks/useSavedPlaces';
import { searchPlaces, type Place } from '../lib/api/places';
import { type RegularDestination } from '../lib/api/regular-destinations';
import { type SavedPlace } from '../lib/api/saved-places';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { typography } from '../theme/typography';

/**
 * Search — state machine across the Figma redesign frames:
 *
 *   `landing`  empty input. Shows SearchBar (on-tap) + Quick Tools row
 *              + Fuel section + Recent searches. Figma `1103:6123`.
 *
 *   `typing`   has input, not yet submitted. Shows SearchBar (typing)
 *              + Recent searches (keep something tappable visible).
 *              Quick Tools/Fuel hide to reduce visual noise.
 *
 *   `loading`  geocoding in progress. Shows SearchBar (typing) +
 *              LoadingState card. Figma `1105:6049`.
 *
 *   `results`  POI search returned named results. Shows SearchBar
 *              (typing) + ""{query}" results in {area}" subhead +
 *              list of named places with address + distance. Figma
 *              `1105:6462`. Tap a result → route to /home.
 *
 *   `error`    search failed or returned no matches. Shows SearchBar
 *              (typing) + ErrorState card. Uses the `1133:13326`
 *              ErrorState component.
 *
 * POI search is powered by `lib/api/places.ts` (OpenStreetMap Nominatim).
 * Distance from the user is computed in the adapter; user location is
 * acquired once on mount via `Location.getCurrentPositionAsync`.
 *
 * Quick Tool icons use iOS system colors per Figma. Documented as a
 * decorative-iconography exception to `.cursorrules`'s reserved-color
 * rule (same exception clause as Welcome's orange splash bg).
 *
 * Route: /search
 */

type Phase = 'landing' | 'typing' | 'loading' | 'results' | 'error';

type QuickTool = {
  id: string;
  label: string;
  /**
   * Canonical Figma SVG for this tile. Each carries its own fill
   * color (per the iOS-system-color register from Figma) — no need
   * to thread tint through anymore.
   */
  Icon: React.ComponentType<{ width: number; height: number }>;
  /**
   * Search-text the tile fires when tapped. Tiles with a `query`
   * populate the search bar via `setQuery` and let the autocomplete
   * pipeline handle the rest — Mapbox v6 Search Box understands
   * each of these as a category and returns matching POIs.
   *
   * `Saved` has no query: tapping it toggles an inline list of the
   * user's saved places + regular destinations (see `buildSavedRows`).
   */
  query?: string;
};

const QUICK_TOOLS: QuickTool[] = [
  { id: 'saved', label: 'Saved', Icon: QuickToolSaved },
  { id: 'food', label: 'Food', Icon: QuickToolFood, query: 'restaurant' },
  { id: 'gas', label: 'Gas', Icon: QuickToolGas, query: 'gas station' },
  { id: 'parking', label: 'Parking', Icon: QuickToolParking, query: 'parking' },
];

/** A flattened row for the Saved list — saved places + regulars in one
    uniform shape the list renderer + nav handler can consume. */
type SavedRow = {
  id: string;
  name: string;
  subtitle: string;
  latitude: number;
  longitude: number;
};

// ~200m bounding-box half-width (degrees) for de-duping a regular
// destination against a saved place at the same spot. Mirrors
// regular-destinations.ts's MATCH_DELTA_DEG so the two stores agree on
// "the same place."
const SAVED_MATCH_DELTA = 0.002;

/**
 * Merges saved places + regular destinations into one ranked list for
 * the Saved tile. Saved places first (home before other saved, then
 * most-recently saved); then regulars by trip frequency, skipping any
 * that sit within ~200m of a saved place (same spot → one row, not two).
 */
function buildSavedRows(
  savedPlaces: SavedPlace[],
  regulars: RegularDestination[],
): SavedRow[] {
  const rows: SavedRow[] = [];
  const sortedSaved = [...savedPlaces].sort((a, b) => {
    if (a.kind === 'home' && b.kind !== 'home') return -1;
    if (b.kind === 'home' && a.kind !== 'home') return 1;
    return b.setAt - a.setAt;
  });
  for (const p of sortedSaved) {
    rows.push({
      id: p.id,
      name: p.name,
      subtitle: p.kind === 'home' ? 'Home' : 'Saved place',
      latitude: p.latitude,
      longitude: p.longitude,
    });
  }
  const sortedRegulars = [...regulars].sort(
    (a, b) => b.count - a.count || b.setAt - a.setAt,
  );
  for (const r of sortedRegulars) {
    const coveredBySaved = rows.some(
      (row) =>
        Math.abs(row.latitude - r.latitude) < SAVED_MATCH_DELTA &&
        Math.abs(row.longitude - r.longitude) < SAVED_MATCH_DELTA,
    );
    if (coveredBySaved) continue;
    rows.push({
      id: r.id,
      name: r.name,
      subtitle:
        r.count > 1 ? `Default · ${r.count} trips` : 'Default destination',
      latitude: r.latitude,
      longitude: r.longitude,
    });
  }
  return rows;
}

// Recents are sourced from useRecentSearches (AsyncStorage-backed,
// 8-entry cap, dedup by mapbox_id). Picked-from-results only — typed-
// and-discarded queries don't enter the list. See
// lib/api/recent-searches.ts for the storage contract.

/**
 * Distance-row formatter for the results list.
 *
 *   < 0.1 mi  → "Near you"  (the row is essentially at the user's
 *                            location; a precise number like "0.1
 *                            mi" reads as false precision and the
 *                            phrase reads more naturally)
 *   0.1–9.9   → "X.X mi"    (one decimal place)
 *   ≥ 10      → "X mi"      (rounded whole — past 10 mi the tenths
 *                            don't carry meaningful information)
 */
function formatResultDistance(miles: number): string {
  if (miles < 0.1) return 'Near you';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export default function Search() {
  const router = useRouter();
  // `from=enroute` opts the result-tap into a mid-trip destination
  // change instead of the default /home route-preview. The /en-route
  // screen's existing destLat/destLng useEffect detects the param
  // change and refetches the route + steps; minStepIndexRef resets
  // are already keyed on recommended.id so monotonic step progress
  // restarts cleanly on the new route.
  //
  // Trust boundary: today the only producer of `from=enroute` is the
  // EnRouteSearch FAB on /en-route itself. A deep-link with this
  // param would land the user on /en-route without an active trip
  // — equivalent to /home → Go (the canonical entry), just skipping
  // /home. /en-route handles missing destination gracefully (renders
  // empty polyline; user can back out). No defensive gate needed
  // today; revisit if new producers of this param land.
  const params = useLocalSearchParams<{ from?: string }>();
  const fromEnRoute = params.from === 'enroute';
  // S4: destructure `loading` so we can gate the empty-state branch
  // and avoid the flash of "Your recent destinations will show up here"
  // during the AsyncStorage read on first mount.
  const { profile: fuelProfile } = useFuelProfile();
  const { recents, loading: recentsLoading, addRecent, removeRecent, clearRecents } = useRecentSearches();
  // Saved tile data — saved places + regular destinations, merged into
  // one ranked list (see buildSavedRows). Surfaced inline when the
  // Saved quick-tile is selected.
  const { savedPlaces } = useSavedPlaces();
  const { regulars } = useRegularDestinations();
  const savedRows = useMemo(
    () => buildSavedRows(savedPlaces, regulars),
    [savedPlaces, regulars],
  );
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<Phase>('landing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // S8: distinguish "no results" (search query problem) from network
  // failure. The ErrorState component defaults to WifiSlash for the
  // network case; we override with MagnifyingGlass when this flag is
  // true so users don't think their connection dropped just because
  // they misspelled something.
  const [isNoResultsError, setIsNoResultsError] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [resultsCity, setResultsCity] = useState<string>('your area');
  // Quick Tool filter selection — visual-only for v1 (filter logic
  // isn't wired yet, the tools are still "coming soon"). Tapping a
  // tile selects it; tapping the selected tile deselects. Mutually
  // exclusive — one filter at a time matches the Figma's "Selected"
  // variant which has no multi-select treatment.
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  // Tracks the most-recently-issued autocomplete query so stale
  // responses from earlier keystrokes can be discarded when they
  // resolve out of order. Apple Maps does the same — without this,
  // typing "Mc" then "Mcd" can result in "Mc"'s slower response
  // overwriting "Mcd"'s faster one.
  const lastQueryRef = useRef<string>('');

  // Acquire user location once on mount. Permission was granted during
  // onboarding (/permissions); a failure here is non-fatal — the search
  // can still run with a default centerpoint, just with less-relevant
  // distance ordering.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const position = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        // Reverse-geocode the user's location once so the Results
        // subhead can read ""{query}" results in {city}" instead of
        // the generic fallback.
        const reverse = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (cancelled) return;
        const city = reverse[0]?.city ?? reverse[0]?.subregion;
        if (city) setResultsCity(city);
      } catch (err) {
        console.warn('[search] could not acquire user location:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const searchBarState = phase === 'landing' ? 'on-tap' : 'typing';

  // Debounced autocomplete: fire a search 300ms after the user stops
  // typing. Backend is Mapbox (10 req/sec free-tier envelope), so
  // 300ms reactivity is well within budget — no 429 storm risk like
  // the Nominatim era. Silent — failures don't show ErrorState
  // (Apple Maps pattern). Explicit submit (Return key / Recent tap)
  // still shows proper Loading + Error states via runSearch(query, true).
  useEffect(() => {
    if (query.trim().length === 0) return;
    if (!userLocation) return;
    const timer = setTimeout(() => {
      runSearch(query, false);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, userLocation]);

  async function runSearch(searchQuery: string, isExplicit: boolean) {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    if (!userLocation) {
      if (isExplicit) {
        setPhase('error');
        // S8 parity — reset the no-results flag so the MagnifyingGlass
        // icon doesn't carry over from a prior search-query error into
        // this location-availability error (icon-copy mismatch).
        setIsNoResultsError(false);
        setErrorMessage('Locating you… try again in a moment.');
      }
      return;
    }

    if (isExplicit) {
      setPhase('loading');
      setErrorMessage(null);
      setIsNoResultsError(false);
      setResults([]);
    }

    lastQueryRef.current = trimmed;

    try {
      const places = await searchPlaces(trimmed, userLocation);
      // Stale-response guard — drop if the user has typed past this query.
      if (lastQueryRef.current !== trimmed) return;

      if (!places.length) {
        if (isExplicit) {
          setPhase('error');
          setIsNoResultsError(true);
          setErrorMessage(
            `No results for "${trimmed}". Try a more specific name or address.`,
          );
        } else {
          // Silent autocomplete miss — clear stale results, return
          // to typing so the user keeps seeing Recent.
          setPhase('typing');
          setResults([]);
        }
        return;
      }
      setResults(places);
      setPhase('results');
    } catch (err) {
      if (lastQueryRef.current !== trimmed) return;
      console.warn('[search] places search failed:', err);
      if (isExplicit) {
        setPhase('error');
        setIsNoResultsError(false);
        setErrorMessage(
          "We're having trouble connecting to the internet right now.",
        );
      }
      // Silent autocomplete error — leave UI alone, user can keep typing.
    }
  }

  function handleQueryChange(text: string) {
    setQuery(text);
    setErrorMessage(null);
    setIsNoResultsError(false);
    // If the new text doesn't match the currently-selected Quick
    // Tool's query, that tile is no longer driving the search and
    // should deselect. Covers the case where the user taps Food
    // ("restaurant"), then types "pizza" — the Food tile would
    // otherwise stay visually selected while the bar reads pizza.
    if (selectedToolId) {
      const selected = QUICK_TOOLS.find((t) => t.id === selectedToolId);
      if (!selected || selected.query !== text) {
        setSelectedToolId(null);
      }
    }
    if (text.length === 0) {
      setPhase('landing');
      setResults([]);
    } else if (phase === 'landing' || phase === 'error' || phase === 'results') {
      // Typing transitions out of any settled state into the typing
      // intermediate state. The user is composing a new query.
      setPhase('typing');
    }
  }

  function handleSelectPlace(place: Place) {
    // Fire-and-forget the persistence write — we don't want to gate
    // the navigation on AsyncStorage I/O. The hook's optimistic
    // local-state update reflects the new recent immediately on the
    // next /search visit; the disk write resolves in the background.
    void addRecent({
      id: place.id,
      name: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
    });
    router.replace({
      // From /en-route → return to /en-route with new destination
      // (mid-trip destination change). Default → /home route preview.
      pathname: fromEnRoute ? '/en-route' : '/home',
      params: {
        destLat: String(place.latitude),
        destLng: String(place.longitude),
        destName: place.name,
      },
    });
  }

  /**
   * Re-tapping a recent routes directly using the stored coord — no
   * Mapbox re-query. The user gets the *same place* every time, not
   * "whatever Mapbox returns for this string today." Also faster:
   * skips a network round-trip on a known destination.
   */
  function handleSelectRecent(recent: typeof recents[number]) {
    void addRecent({
      id: recent.id,
      name: recent.name,
      address: recent.address,
      latitude: recent.latitude,
      longitude: recent.longitude,
    });
    router.replace({
      pathname: fromEnRoute ? '/en-route' : '/home',
      params: {
        destLat: String(recent.latitude),
        destLng: String(recent.longitude),
        destName: recent.name,
      },
    });
  }

  /** Tapping a saved/regular place routes straight to it (same
   *  navigation as a recent), and drops it into recents so it's a
   *  one-tap repeat next time. */
  function handleSelectSaved(row: SavedRow) {
    void addRecent({
      id: row.id,
      name: row.name,
      address: row.subtitle,
      latitude: row.latitude,
      longitude: row.longitude,
    });
    router.replace({
      pathname: fromEnRoute ? '/en-route' : '/home',
      params: {
        destLat: String(row.latitude),
        destLng: String(row.longitude),
        destName: row.name,
      },
    });
  }

  /** Long-press → confirm → remove. Quiet feature, expected for any
   *  recents list. iOS Alert is fine here — no design comp for a
   *  custom remove-confirm sheet. */
  function handleLongPressRecent(recent: typeof recents[number]) {
    Alert.alert(
      'Remove from recent',
      `Forget "${recent.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void removeRecent(recent.id);
          },
        },
      ],
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.searchBarRow}>
          <SearchBar
            state={searchBarState}
            value={query}
            onChangeText={handleQueryChange}
            onSubmit={() => runSearch(query, true)}
            onBackPress={() => router.back()}
            onClearPress={() => {
              setQuery('');
              setPhase('landing');
              setErrorMessage(null);
              setIsNoResultsError(false);
              // Clear deselects any active Quick Tool filter too —
              // the tile's selected state was confirming the filter
              // applied to the now-cleared query. Without this, the
              // tile stays visually selected after the user wipes
              // the search bar, which reads as "filter still active"
              // when nothing is filtering anything.
              setSelectedToolId(null);
              setResults([]);
            }}
            // S2: omit onMicPress until voice input is built. Passing
            // a no-op handler made PressableIcon render as a Pressable
            // (truthy onPress), which VoiceOver announces as "Voice
            // search, button" but produces zero feedback on tap.
            // Undefined keeps the icon visible as a static decorative
            // glyph until expo-speech / native speech-to-text lands.
            // TODO: restore handler when voice input ships.
            autoFocus
          />
        </View>

        {(phase === 'landing' || phase === 'typing') && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Quick Tools + Fuel show only in landing — when the user
                is mid-query, hiding them reduces noise. */}
            {phase === 'landing' && (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickToolsRow}
                >
                  {QUICK_TOOLS.map((tool) => {
                    const isSelected = selectedToolId === tool.id;
                    return (
                      <Pressable
                        key={tool.id}
                        style={({ pressed }) => [
                          styles.quickTool,
                          isSelected && styles.quickToolSelected,
                          pressed && pressedDim,
                        ]}
                        onPress={() => {
                          // Two paths:
                          //   1. has a `query` (Food/Gas/Parking) → toggle
                          //      selection AND mirror it into the search
                          //      text: selecting sets the query (the
                          //      debounced autocomplete effect fires the
                          //      Mapbox call); DESELECTING clears it, so a
                          //      second tap fully backs out instead of
                          //      leaving a stale query behind.
                          //   2. no query (Saved) → toggle the selected
                          //      state, which reveals the inline Saved
                          //      list below the tiles.
                          const willSelect = selectedToolId !== tool.id;
                          setSelectedToolId(willSelect ? tool.id : null);
                          if (tool.query) {
                            setQuery(willSelect ? tool.query : '');
                          }
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={tool.label}
                        accessibilityState={{ selected: isSelected }}
                        accessibilityHint={
                          tool.query
                            ? `Search for ${tool.label.toLowerCase()} nearby`
                            : 'Show your saved places'
                        }
                      >
                        <tool.Icon width={24} height={24} />
                        <View style={styles.quickToolLabelWrap}>
                          <Text style={styles.quickToolLabel}>{tool.label}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Saved list — revealed when the Saved tile is selected.
                    Merges saved places + regular destinations; rows route
                    straight to the place (same as a recent). Reuses the
                    Recent row styles for a consistent list register. */}
                {selectedToolId === 'saved' && (
                  <View style={styles.recentSection}>
                    <Text style={styles.recentLabel}>Saved</Text>
                    {savedRows.length === 0 ? (
                      <Text style={styles.recentEmpty}>
                        Places you save or set as a default destination show
                        up here.
                      </Text>
                    ) : (
                      savedRows.map((row) => (
                        <Pressable
                          key={row.id}
                          style={({ pressed }) => [
                            styles.recentItem,
                            pressed && pressedDim,
                          ]}
                          onPress={() => handleSelectSaved(row)}
                          accessibilityRole="button"
                          accessibilityLabel={`Route to ${row.name}. ${row.subtitle}.`}
                        >
                          <MapPin
                            size={24}
                            color={colors.labelTertiary}
                            weight="duotone"
                          />
                          <View style={styles.recentTextColumn}>
                            <Text style={styles.recentText} numberOfLines={1}>
                              {row.name}
                            </Text>
                            <Text style={styles.recentSubtext} numberOfLines={1}>
                              {row.subtitle}
                            </Text>
                          </View>
                        </Pressable>
                      ))
                    )}
                  </View>
                )}

                <View style={styles.divider} />

                <Pressable
                  style={({ pressed }) => [styles.fuelSection, pressed && pressedDim]}
                  onPress={() => router.push('/fuel')}
                  accessibilityRole="button"
                  accessibilityLabel="Fuel and refuel reminders"
                  accessibilityHint={
                    fuelProfile?.remindersEnabled
                      ? 'Opens your refuel reminder settings'
                      : 'Set up refuel reminders'
                  }
                >
                  <FuelIcon width={32} height={32} />
                  <Text style={styles.fuelTitle}>Fuel</Text>
                  <Text style={styles.fuelSubtitle}>
                    {fuelProfile?.remindersEnabled && fuelProfile.nextReminderAt
                      ? `Refuel reminder on · next ${new Date(
                          fuelProfile.nextReminderAt,
                        ).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                      : 'Set up refuel reminders for your car'}
                  </Text>
                </Pressable>

                <View style={styles.divider} />
              </>
            )}

            {/* Recent stays visible across both landing and typing —
                gives the user something to tap during the typing
                phase instead of staring at a blank canvas. */}
            <View style={styles.recentSection}>
              <View style={styles.recentHeader}>
                <Text style={styles.recentLabel}>Recent</Text>
                {recents.length > 0 && (
                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        'Clear recent searches',
                        'Forget all your recent destinations? This cannot be undone.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Clear',
                            style: 'destructive',
                            onPress: () => void clearRecents(),
                          },
                        ],
                      );
                    }}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Clear all recent searches"
                    style={({ pressed }) => pressed && pressedDim}
                  >
                    <Text style={styles.recentClear}>Clear</Text>
                  </Pressable>
                )}
              </View>

              {recents.length === 0 ? (
                // S4: gate the empty-state copy behind !recentsLoading so
                // users with a populated recents list don't see "Your
                // recent destinations will show up here" flash on mount
                // during the AsyncStorage read (~50-100ms). Render nothing
                // while loading — the section header above gives a stable
                // container so the layout doesn't shift.
                recentsLoading ? null : (
                  <Text style={styles.recentEmpty}>
                    Your recent destinations will show up here.
                  </Text>
                )
              ) : (
                recents.map((recent) => (
                  <Pressable
                    key={recent.id}
                    style={({ pressed }) => [
                      styles.recentItem,
                      pressed && pressedDim,
                    ]}
                    onPress={() => handleSelectRecent(recent)}
                    onLongPress={() => handleLongPressRecent(recent)}
                    accessibilityRole="button"
                    accessibilityLabel={`Re-route to ${recent.name} at ${recent.address}. Long-press to remove.`}
                  >
                    <Clock size={24} color={colors.labelTertiary} weight="duotone" />
                    {/*
                      Two-line row: name on top, address as subtitle.
                      The address disambiguates multiple locations of
                      the same chain — two Starbucks recents have
                      identical names but different street addresses,
                      and the subtitle is what tells them apart at
                      a glance. (The adapter already dedups by
                      mapbox_id, so two locations of one chain are
                      stored as two separate recents, not one.)
                    */}
                    <View style={styles.recentTextColumn}>
                      <Text style={styles.recentText} numberOfLines={1}>
                        {recent.name}
                      </Text>
                      {recent.address ? (
                        <Text style={styles.recentSubtext} numberOfLines={1}>
                          {recent.address}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          </ScrollView>
        )}

        {phase === 'loading' && (
          <View style={styles.stateCardWrap}>
            <LoadingState text="Charting course…" />
          </View>
        )}

        {phase === 'error' && errorMessage && (
          <View style={styles.stateCardWrap}>
            {/*
              S8: swap icon by error class. No-results uses MagnifyingGlass
              (search-query problem), network failure keeps the default
              WifiSlash via undefined. Prevents the dissonance of seeing
              a "no internet" icon when the actual issue is a misspelled
              place name.
            */}
            <ErrorState
              text={errorMessage}
              icon={
                isNoResultsError ? (
                  <MagnifyingGlass
                    size={56}
                    color={colors.labelTertiary}
                    weight="duotone"
                  />
                ) : undefined
              }
            />
          </View>
        )}

        {phase === 'results' && (
          <ScrollView
            contentContainerStyle={styles.resultsContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.resultsHeader}>
              <MagnifyingGlass
                size={20}
                color={colors.labelTertiary}
                weight="duotone"
              />
              <Text style={styles.resultsHeaderText} numberOfLines={1}>
                "{query}" results in {resultsCity}
              </Text>
            </View>
            {/*
              Horizontal/Inset divider per Figma 1105:6502 — 12pt
              inset on both sides. Matches the row-separator inset
              below so the dividers read as a consistent stack.
              Shared `divider` style stays full-width for the
              landing screen's section breaks.
            */}
            <View style={styles.resultsInsetDivider} />
            {results.map((place, idx) => (
              <Pressable
                key={place.id}
                style={({ pressed }) => [
                  styles.resultRow,
                  pressed && pressedDim,
                ]}
                onPress={() => handleSelectPlace(place)}
                accessibilityRole="button"
                accessibilityLabel={`${place.name}, ${place.address}, ${formatResultDistance(place.distanceMiles)} away`}
              >
                <View style={styles.resultText}>
                  <Text style={styles.resultName} numberOfLines={1}>
                    {place.name}
                  </Text>
                  {/*
                    S6: guard against empty address strings. `formatAddress`
                    in lib/api/places.ts can return '' when both
                    place_formatted and full_address are missing — without
                    this conditional, the Text still occupies its 18pt
                    lineHeight as an invisible gap below the name, reading
                    as floating-name layout drift. Mirrors the recents
                    list's existing guard (`recent.address ? ...`).
                  */}
                  {place.address ? (
                    <Text style={styles.resultAddress} numberOfLines={1}>
                      {place.address}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.resultDistance} numberOfLines={1}>
                  {formatResultDistance(place.distanceMiles)}
                </Text>
                {idx < results.length - 1 && (
                  <View style={styles.resultSeparator} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  safe: {
    flex: 1,
  },
  searchBarRow: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 32,
  },
  quickToolsRow: {
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  quickTool: {
    width: 144,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 24,
    paddingBottom: 12,
    paddingHorizontal: 40,
  },
  // Selected state per Figma `1133:13314`. Same outline and shape;
  // the bg flips from white → iOS system fillsTertiary so the
  // tile reads as "active filter" without losing the icon/label
  // contrast. fillsTertiary is the same neutral surface tint we
  // already use on /search's gray search-bar — reuses an iOS-
  // native register instead of inventing a new "selected" color.
  quickToolSelected: {
    backgroundColor: colors.fillsTertiary,
  },
  quickToolLabelWrap: {
    alignItems: 'center',
    gap: 2,
  },
  quickToolLabel: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.black,
  },
  divider: {
    height: 1,
    backgroundColor: colors.separatorSubtle,
  },
  // Inset variant used above the results list. Wraps the 1pt rule in
  // a 12pt left/right padding to match Figma 1105:6502.
  resultsInsetDivider: {
    height: 1,
    marginHorizontal: 12,
    backgroundColor: colors.separatorSubtle,
  },
  fuelSection: {
    paddingHorizontal: 24,
    gap: 8,
  },
  fuelTitle: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.black,
  },
  fuelSubtitle: {
    ...dynamicType(relaxedLineHeight(typography.footnoteRegular)),
    color: colors.wiltedgreen,
  },
  recentSection: {
    paddingHorizontal: 24,
    gap: 8,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentLabel: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelTertiary,
  },
  recentClear: {
    ...dynamicType(typography.footnoteEmphasized),
    color: colors.freshgreen,
  },
  recentEmpty: {
    ...dynamicType(relaxedLineHeight(typography.subheadlineRegular)),
    color: colors.mutedSecondary,
    paddingVertical: 10,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    // S5: 10 → 12pt. Brings row to 48pt (24pt icon + 12pt × 2 padding),
    // aligned to the 4pt grid (10 wasn't) and matching iOS table-row
    // density. Recents is a primary affordance; generous row height
    // signals quality and improves scan-ability.
    paddingVertical: 12,
  },
  // The text column wraps name + address so the Clock icon stays
  // vertically centered against the full row block, not just the
  // name line. flex:1 + minWidth:0 lets the address truncate via
  // numberOfLines without pushing the row width.
  recentTextColumn: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  recentText: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.black,
  },
  recentSubtext: {
    ...dynamicType(relaxedLineHeight(typography.footnoteRegular)),
    color: colors.mutedSecondary,
  },
  stateCardWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 32,
  },
  resultsContent: {
    paddingBottom: 32,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resultsHeaderText: {
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
    flex: 1,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    paddingLeft: 48,
    paddingRight: 24,
    paddingVertical: 12,
    position: 'relative',
  },
  resultText: {
    flex: 1,
    gap: 4,
  },
  resultName: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
  },
  resultAddress: {
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
  },
  resultDistance: {
    ...typography.subheadlineRegular,
    color: colors.black,
    // 72pt fits up to "9,999.9 mi" (10 chars × ~7pt at SF Pro 15)
    // — accommodates comma-separated values when Nominatim returns
    // a far-away match. Address `numberOfLines={1}` ellipsizes
    // correctly since resultText is `flex: 1` and shrinks to fit.
    minWidth: 72,
    textAlign: 'right',
    // S7: tabular-nums prevents horizontal column reflow as autocomplete
    // results update mid-debounce ("1.2 mi" → "10.4 mi" → "3.8 mi").
    // The existing minWidth: 72 floor + tabular-nums together is the
    // canonical pattern — minWidth caps the column when digits change
    // count, tabular-nums keeps each digit width-stable within that cap.
    // Same convention as F7 (en-route ETA) + H8 (recommendation rating).
    fontVariant: ['tabular-nums'],
  },
  // Symmetric 12pt inset per Figma `1105:6502` (Horizontal/Inset
  // divider). Earlier value (left: 48, right: 0) matched iOS list-
  // style separators where the inset aligns with content text, but
  // the v2 Figma uses a balanced 12pt inset on both sides. Same
  // value as `resultsInsetDivider` above for register parity.
  resultSeparator: {
    position: 'absolute',
    bottom: 0,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: colors.separatorSubtle,
  },
});
