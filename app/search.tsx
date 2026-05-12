import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
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
import { BookmarkSimple } from 'phosphor-react-native/src/icons/BookmarkSimple';
import { Clock } from 'phosphor-react-native/src/icons/Clock';
import { ForkKnife } from 'phosphor-react-native/src/icons/ForkKnife';
import { GasPump } from 'phosphor-react-native/src/icons/GasPump';
import { Medal } from 'phosphor-react-native/src/icons/Medal';
import { Parking } from 'phosphor-react-native/src/icons/Parking';

import FuelIcon from '../assets/illustrations/fuel.svg';

import { SearchBar } from '../components/SearchBar';
import { ErrorState, LoadingState } from '../components/StateCard';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { typography } from '../theme/typography';

/**
 * Search — state machine across three Figma frames:
 *
 *   `landing`  empty input. Shows SearchBar (on-tap) + Quick Tools row +
 *              Fuel section + Recent searches. Figma `1103:6123`.
 *
 *   `loading`  geocoding in progress. SearchBar (typing) + LoadingState
 *              card. Figma `1105:6049`.
 *
 *   `error`    geocode failed or returned no matches. SearchBar (typing)
 *              + ErrorState card. (Not a separate Figma frame; uses the
 *              ErrorState component from `1133:13326`.)
 *
 * v1 limitation: a true Results list (Figma `1105:6462`) requires a POI
 * search backend that returns named places (e.g., MKLocalSearch). Apple's
 * `Location.geocodeAsync` returns coordinates only — no business names.
 * Until a POI backend lands, success geocode routes immediately to /home,
 * skipping the Results state. The state machine is set up so adding a
 * `results` phase is a one-liner when the backend ships.
 *
 * Quick Tool icons use iOS system colors (pink bookmark, yellow medal,
 * etc.) per Figma `1103:6123`. These read as decorative category
 * indicators — not safety signals — so they fall under the reserved-
 * color rule's documented exception clause (same as Welcome's orange
 * splash bg).
 *
 * Route: /search
 */

type Phase = 'landing' | 'typing' | 'loading' | 'error';

type QuickTool = {
  id: string;
  label: string;
  // System color per Figma; applied to the duotone Phosphor icon.
  color: string;
  renderIcon: (color: string) => React.ReactNode;
};

const QUICK_TOOLS: QuickTool[] = [
  {
    id: 'saved',
    label: 'Saved',
    color: colors.pink,
    renderIcon: (color) => <BookmarkSimple size={24} color={color} weight="fill" />,
  },
  {
    id: 'trending',
    label: 'Trending',
    color: colors.yellow,
    renderIcon: (color) => <Medal size={24} color={color} weight="fill" />,
  },
  {
    id: 'food',
    label: 'Food',
    color: colors.orange,
    renderIcon: (color) => <ForkKnife size={24} color={color} weight="fill" />,
  },
  {
    id: 'gas',
    label: 'Gas',
    color: '#34C759', // iOS system green per Figma — separate from brand freshgreen
    renderIcon: (color) => <GasPump size={24} color={color} weight="fill" />,
  },
  {
    id: 'parking',
    label: 'Parking',
    color: '#0B57D0', // iOS material primary blue per Figma
    renderIcon: (color) => <Parking size={24} color={color} weight="fill" />,
  },
];

// TODO: real recent searches from a persistence layer (AsyncStorage or
// backend). Hardcoded mock for v1 so the section reads visually.
const RECENT_SEARCHES = [{ id: 'recent-1', label: 'Jackson, Mississippi' }];

export default function Search() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<Phase>('landing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // SearchBar state derives from phase: typing while typing/loading/
  // error (input has content), on-tap when landing (empty input). The
  // "default" floating-pill state is owned by /home, not /search.
  const searchBarState = phase === 'landing' ? 'on-tap' : 'typing';

  async function handleSubmit() {
    const trimmed = query.trim();
    if (!trimmed) return;

    setPhase('loading');
    setErrorMessage(null);

    try {
      const results = await Location.geocodeAsync(trimmed);
      if (!results.length) {
        setPhase('error');
        setErrorMessage(
          `No results for "${trimmed}". Try a more specific address.`,
        );
        return;
      }

      const top = results[0];
      router.replace({
        pathname: '/home',
        params: {
          destLat: String(top.latitude),
          destLng: String(top.longitude),
          destName: trimmed,
        },
      });
    } catch (err) {
      console.warn('[search] geocode failed:', err);
      setPhase('error');
      setErrorMessage("We're having trouble connecting to the internet right now.");
    }
  }

  function handleQueryChange(text: string) {
    setQuery(text);
    setErrorMessage(null);
    // Returning to landing as soon as the input is empty — feels
    // continuous with /home's tap-to-search affordance.
    if (text.length === 0) {
      setPhase('landing');
    } else if (phase === 'landing' || phase === 'error') {
      // Typing transitions out of landing/error into the "typing"
      // intermediate state. Loading only happens after submit.
      setPhase('typing');
    }
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
            onBackPress={() => router.back()}
            onClearPress={() => {
              setQuery('');
              setPhase('landing');
              setErrorMessage(null);
            }}
            onMicPress={() => {
              // TODO: voice input via expo-speech / native speech-to-text
            }}
            autoFocus
          />
        </View>

        {phase === 'landing' && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Quick Tools row */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickToolsRow}
            >
              {QUICK_TOOLS.map((tool) => (
                <Pressable
                  key={tool.id}
                  style={({ pressed }) => [styles.quickTool, pressed && pressedDim]}
                  accessibilityRole="button"
                  accessibilityLabel={tool.label}
                  accessibilityHint="Coming soon"
                >
                  {tool.renderIcon(tool.color)}
                  <Text style={styles.quickToolLabel}>{tool.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.divider} />

            {/* Fuel section */}
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

            {/* Recent searches */}
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
                    handleSubmit();
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
  // SearchBar gets pinned at the top with 16pt vertical breathing room
  // (matches Figma 1103:6202 / 1105:6051: pt-72 ≈ status bar + 16pt).
  // The SearchBar component itself handles 8pt edge inset via
  // alignSelf: stretch + marginHorizontal.
  searchBarRow: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 32,
  },
  // Horizontally scrollable Quick Tools — first tile inset 16pt from
  // screen edge; gap 16pt between tiles. Matches Figma 1104:5893
  // pl-16 + gap-16.
  quickToolsRow: {
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  // 144pt wide × ~88pt tall card with subtle border, icon centered
  // above label. Matches Figma 1103:6407: w-144 + pb-12 pt-24 px-40.
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
  quickToolLabel: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
  },
  divider: {
    height: 1,
    backgroundColor: colors.separatorSubtle,
  },
  // Fuel section per Figma 1103:6267 — icon (32pt), title row, subtitle row.
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
    paddingVertical: 10, // 24pt icon + 10×2 = 44pt HIG-compliant tap target
  },
  recentText: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
  },
  // LoadingState / ErrorState are centered cards that take the full
  // available vertical space — flex: 1 + center alignment from the
  // outer View handles it.
  stateCardWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 32,
  },
});
