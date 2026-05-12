import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
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

import FuelIcon from '../assets/illustrations/fuel.svg';
import QuickToolSaved from '../assets/illustrations/quick-tools-saved.svg';
import QuickToolTrending from '../assets/illustrations/quick-tools-trending.svg';
import QuickToolFood from '../assets/illustrations/safety-tools-food.svg';
import QuickToolGas from '../assets/illustrations/safety-tools-gas.svg';
import QuickToolParking from '../assets/illustrations/safety-tools-parking.svg';

import { SearchBar } from '../components/SearchBar';
import { ErrorState, LoadingState } from '../components/StateCard';
import { searchPlaces, type Place } from '../lib/api/places';
import { colors } from '../theme/colors';
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
};

const QUICK_TOOLS: QuickTool[] = [
  { id: 'saved', label: 'Saved', Icon: QuickToolSaved },
  { id: 'trending', label: 'Trending', Icon: QuickToolTrending },
  { id: 'food', label: 'Food', Icon: QuickToolFood },
  { id: 'gas', label: 'Gas', Icon: QuickToolGas },
  { id: 'parking', label: 'Parking', Icon: QuickToolParking },
];

// TODO: real recent searches from a persistence layer.
const RECENT_SEARCHES = [{ id: 'recent-1', label: 'Jackson, Mississippi' }];

export default function Search() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<Phase>('landing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
        setErrorMessage('Waiting for your location… try again in a moment.');
      }
      return;
    }

    if (isExplicit) {
      setPhase('loading');
      setErrorMessage(null);
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
    router.replace({
      pathname: '/home',
      params: {
        destLat: String(place.latitude),
        destLng: String(place.longitude),
        destName: place.name,
      },
    });
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
              setResults([]);
            }}
            onMicPress={() => {
              // TODO: voice input via expo-speech / native speech-to-text
            }}
            autoFocus
          />
        </View>

        {(phase === 'landing' || phase === 'typing') && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
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
                        onPress={() =>
                          setSelectedToolId((prev) =>
                            prev === tool.id ? null : tool.id,
                          )
                        }
                        accessibilityRole="button"
                        accessibilityLabel={tool.label}
                        accessibilityState={{ selected: isSelected }}
                        accessibilityHint="Filter coming soon"
                      >
                        <tool.Icon width={24} height={24} />
                        <Text style={styles.quickToolLabel}>{tool.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={styles.divider} />

                <Pressable
                  style={({ pressed }) => [styles.fuelSection, pressed && pressedDim]}
                  accessibilityRole="button"
                  accessibilityLabel="Fuel. Add your car's model and fuel for refuel reminders"
                  accessibilityHint="Coming soon"
                >
                  <FuelIcon width={32} height={32} />
                  <Text style={styles.fuelTitle}>Fuel</Text>
                  <Text style={styles.fuelSubtitle}>
                    Add your car's model and fuel for refuel reminders
                  </Text>
                </Pressable>

                <View style={styles.divider} />
              </>
            )}

            {/* Recent stays visible across both landing and typing —
                gives the user something to tap during the typing
                phase instead of staring at a blank canvas. */}
            <View style={styles.recentSection}>
              <Text style={styles.recentLabel}>Recent</Text>
              {RECENT_SEARCHES.map((recent) => (
                <Pressable
                  key={recent.id}
                  style={({ pressed }) => [
                    styles.recentItem,
                    pressed && pressedDim,
                  ]}
                  onPress={() => {
                    setQuery(recent.label);
                    runSearch(recent.label, true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Search again for ${recent.label}`}
                >
                  <Clock size={24} color={colors.labelTertiary} weight="duotone" />
                  <Text style={styles.recentText}>{recent.label}</Text>
                </Pressable>
              ))}
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
            <ErrorState text={errorMessage} />
          </View>
        )}

        {phase === 'results' && (
          <ScrollView
            contentContainerStyle={styles.resultsContent}
            keyboardShouldPersistTaps="handled"
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
                accessibilityLabel={`${place.name}, ${place.address}, ${place.distanceMiles} miles away`}
              >
                <View style={styles.resultText}>
                  <Text style={styles.resultName} numberOfLines={1}>
                    {place.name}
                  </Text>
                  <Text style={styles.resultAddress} numberOfLines={1}>
                    {place.address}
                  </Text>
                </View>
                <Text style={styles.resultDistance} numberOfLines={1}>
                  {place.distanceMiles.toLocaleString('en-US')} mi
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
  quickToolLabel: {
    ...typography.subheadlineEmphasized,
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
    ...typography.subheadlineEmphasized,
    color: colors.black,
  },
  fuelSubtitle: {
    ...typography.footnoteRegular,
    color: colors.wiltedgreen,
  },
  recentSection: {
    paddingHorizontal: 24,
    gap: 8,
  },
  recentLabel: {
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  recentText: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
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
