import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Search — destination input screen.
 *
 * v1 is functional, not pixel-matched to Figma. Layout is a minimal
 * back-button header + autofocused TextInput. When the user submits,
 * we geocode the typed text into lat/lng using expo-location's
 * Location.geocodeAsync (no extra dependency — already installed),
 * then router.replace back to /home with the destination as URL
 * params. /home reads the params and re-fetches routes for the new
 * destination.
 *
 * Route: /search
 * Figma node: 825:4987 (Search Landing) — TODO: visual polish PR
 * to match Figma's recent-searches list, category chips, etc.
 */
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
      // geocodeAsync turns place text ("Mobile, AL" or "300 N Water St")
      // into lat/lng coordinates via the OS-level geocoder. iOS uses
      // Apple's built-in service; no API key needed.
      const results = await Location.geocodeAsync(trimmed);
      if (!results.length) {
        setError(`Couldn't find "${trimmed}". Try a more specific address.`);
        return;
      }

      const top = results[0];

      // router.replace swaps /search out for /home with the destination
      // baked into the URL as query params. /home reads them via
      // useLocalSearchParams and re-fetches routes for the new endpoint.
      // String() because URL params are always strings — /home parses
      // them back to numbers on the other side.
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
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color={colors.black} />
          </Pressable>
          <Text style={styles.headerTitle}>Search</Text>
          {/* Spacer matches the back button's width so the title centers visually. */}
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.inputArea}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSubmit}
            placeholder="Where are you headed?"
            placeholderTextColor="rgba(60, 60, 67, 0.6)"
            style={styles.input}
            // autoFocus opens the keyboard immediately when the screen mounts
            // — saves the user a tap and matches what they expect when they
            // tapped a search field to get here.
            autoFocus
            // returnKeyType "search" makes the keyboard's blue button read
            // "Search" instead of "Return" — visual cue + same submit handler.
            returnKeyType="search"
            // Disabled during the network round-trip so they can't fire
            // multiple geocodes at once.
            editable={!searching}
            // No autocapitalize — addresses are mixed-case.
            autoCapitalize="none"
            autoCorrect={false}
          />
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    ...typography.bodyEmphasized,
    color: colors.black,
  },
  headerSpacer: {
    width: 24, // matches Ionicons size so title visually centers
  },
  inputArea: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  input: {
    ...typography.bodyRegular,
    color: colors.black,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(60, 60, 67, 0.2)',
  },
  error: {
    ...typography.footnoteRegular,
    color: '#FF3B30', // reserved Red — used here as a legitimate UI error signal per .cursorrules
  },
});
