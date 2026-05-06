import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Search — Landing variant.
 *
 * Shown when the user taps the search bar on /home. Includes the gray
 * search field (per .cursorrules' contextual rule: gray when embedded
 * on a flat surface, white-elevated when floating over map/imagery),
 * Quick Tools shortcuts, a Fuel section CTA, and Recent searches.
 *
 * Functional core: TextInput in the search field accepts a destination,
 * geocodes via Location.geocodeAsync, returns to /home with destination
 * lat/lng/name as URL params. The Quick Tools, Fuel, and Recent sections
 * are visual stubs for now (TODOs documented inline).
 *
 * Route: /search
 * Figma node: 825:4987 (Search Landing)
 *
 * Future: 825:5017 (Search Typed) is a separate screen showing typing
 * suggestions. v1 collapses Landing + Typed into this single screen
 * since the TextInput handles both states implicitly.
 */

type QuickTool = {
  id: string;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
};

const QUICK_TOOLS: QuickTool[] = [
  { id: 'saved', label: 'Saved', iconName: 'bookmark' },
  { id: 'trending', label: 'Trending', iconName: 'trophy' },
  { id: 'food', label: 'Food', iconName: 'restaurant' },
  { id: 'gas', label: 'Gas', iconName: 'speedometer' },
  { id: 'parking', label: 'Parking', iconName: 'car' },
];

// TODO: real recent searches from a persistence layer (AsyncStorage or
// backend). Hardcoded mock for v1 so the section reads visually.
const RECENT_SEARCHES = [
  { id: 'recent-1', label: 'Jackson, MS' },
];

export default function Search() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  async function handleSubmit() {
    const trimmed = query.trim();
    if (!trimmed) return;

    setSearching(true);
    setError(null);

    try {
      const results = await Location.geocodeAsync(trimmed);
      if (!results.length) {
        setError(`Couldn't find "${trimmed}". Try a more specific address.`);
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
      setError('Something went wrong. Try again.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topSection}>
            {/*
              Search bar — gray (Fills/Tertiary) variant since this screen
              is a flat white surface. Per .cursorrules' contextual search-
              bar rule, only the white-elevated variant lives over map
              imagery. Three interactive zones inside the pill: back-chevron
              (left), TextInput (middle), mic (right).
            */}
            <View style={styles.searchBar}>
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={24} color={colors.labelSecondary} />
              </Pressable>

              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSubmit}
                placeholder="Where are you headed?"
                placeholderTextColor={colors.mutedSecondary}
                style={styles.searchInput}
                autoFocus
                returnKeyType="search"
                editable={!searching}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Voice search (not yet supported)"
                hitSlop={8}
              >
                {/* TODO: voice input via expo-speech / native speech-to-text */}
                <Ionicons name="mic" size={20} color={colors.labelSecondary} />
              </Pressable>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            {/*
              Quick Tools — horizontally scrollable row of category
              shortcuts. Each tile is a visual stub for now; tapping
              would (in production) pre-fill the search with the
              relevant category.
            */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickToolsRow}
            >
              {QUICK_TOOLS.map((tool) => (
                <Pressable
                  key={tool.id}
                  style={styles.quickTool}
                  accessibilityRole="button"
                  accessibilityLabel={tool.label}
                  // TODO: wire to category-filtered search (e.g., search
                  // for nearby Food places, gas stations, etc.)
                >
                  <Ionicons
                    name={tool.iconName}
                    size={24}
                    color={colors.black}
                  />
                  <Text style={styles.quickToolLabel}>{tool.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.divider} />

          {/*
            Fuel CTA section — the user can configure their car's model
            and fuel type for refuel-reminder functionality. Visual stub
            for v1; tapping would (in production) push to a fuel-config
            screen.
          */}
          <Pressable
            style={styles.section}
            accessibilityRole="button"
            accessibilityLabel="Configure fuel reminders"
          >
            <Ionicons name="speedometer-outline" size={32} color={colors.black} />
            <Text style={styles.sectionTitle}>Fuel</Text>
            <Text style={styles.sectionSubtitle}>
              Add your car's model and fuel for refuel reminders
            </Text>
          </Pressable>

          <View style={styles.divider} />

          {/* Recent searches — list of previous destinations. */}
          <View style={styles.recentSection}>
            <Text style={styles.recentLabel}>Recent</Text>
            {RECENT_SEARCHES.map((recent) => (
              <Pressable
                key={recent.id}
                style={styles.recentItem}
                onPress={() => {
                  setQuery(recent.label);
                  // Don't auto-submit — user may want to edit the query first.
                }}
                accessibilityRole="button"
                accessibilityLabel={`Search again for ${recent.label}`}
              >
                <Ionicons name="time-outline" size={24} color={colors.black} />
                <Text style={styles.recentText}>{recent.label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
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
  content: {
    gap: 16,
  },
  topSection: {
    // No horizontal padding here — the search bar is 374pt wide and
    // overflows a 16pt padding by design (same as /home's search bar).
    // Each child manages its own horizontal padding so the search bar
    // can render at full 374pt centered on screen.
    //
    // paddingTop: 23 sits on top of SafeAreaView's ~47pt top inset,
    // landing the search bar at ~70pt from screen top — same position
    // as /home's search bar so the transition between screens has zero
    // vertical jump.
    paddingTop: 23,
    gap: 16,
    width: '100%', // ensure full-width regardless of ScrollView constraints
  },
  searchBar: {
    // Fills/Tertiary per Figma — gray translucent on flat surfaces.
    backgroundColor: 'rgba(120, 120, 128, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 1000,
    // Responsive sizing: stretch to fill the parent's width, with 8pt
    // margins on each side. Figma specs `w-374` on a 390pt iPhone 14
    // baseline (374 = 390 - 8 - 8), which is the "8pt from each edge"
    // intent. Hardcoding width: 374 fails on wider devices (Pro Max,
    // 16 Pro Max, etc) where it creates a 28pt+ edge margin instead.
    // alignSelf + marginHorizontal preserves the intent across screen
    // sizes — the bar always sits 8pt from each edge.
    alignSelf: 'stretch',
    marginHorizontal: 8,
  },
  searchInput: {
    flex: 1,
    ...typography.bodyRegular,
    color: colors.black,
    height: '100%',
  },
  error: {
    ...typography.footnoteRegular,
    color: colors.red,
    paddingHorizontal: 16,
  },
  quickToolsRow: {
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 4, // breathing room for tile borders/shadows
  },
  quickTool: {
    width: 128,
    height: 96,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 24,
    paddingBottom: 14,
    paddingHorizontal: 30,
  },
  quickToolLabel: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  section: {
    paddingHorizontal: 16,
    gap: 8,
  },
  sectionTitle: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
  },
  sectionSubtitle: {
    ...typography.footnoteRegular,
    color: colors.wiltedgreen,
  },
  recentSection: {
    gap: 8,
  },
  recentLabel: {
    ...typography.footnoteRegular,
    color: colors.mutedSecondary,
    paddingHorizontal: 16,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    // 10pt vertical padding around the 24pt icon = 44pt total tap height,
    // satisfying the iOS HIG minimum on the visual itself (no hitSlop
    // fallback). Was 4pt → 32pt total, below HIG.
    paddingVertical: 10,
  },
  recentText: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
  },
});
