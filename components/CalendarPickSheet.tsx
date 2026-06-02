// components/CalendarPickSheet.tsx
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MagnifyingGlass } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { X } from 'phosphor-react-native/src/icons/X';

import { DragHandle } from './DragHandle';
import { searchPlaces, type Place } from '../lib/api/places';
import { type ResolvedPlace } from '../lib/api/calendar-resolutions';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Manual location correction for a calendar event. Bottom-sheet (same
 * scrim + sheet + drag-handle chrome as ReportDetailCard / ZoneDetailCard)
 * pre-filled with the event's location text. The user searches (via
 * searchPlaces) and picks the right place; the parent persists it.
 *
 * Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md
 */
export function CalendarPickSheet({
  initialQuery,
  userLocation,
  onPick,
  onDismiss,
}: {
  initialQuery: string;
  userLocation: { latitude: number; longitude: number } | null;
  onPick: (place: ResolvedPlace) => void;
  onDismiss: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  // Distinguishes "haven't searched yet" from "searched, no matches" so
  // the empty-results copy only shows after an actual search.
  const [searched, setSearched] = useState(false);

  async function runSearch() {
    const q = query.trim();
    if (!q || !userLocation) return;
    setSearching(true);
    try {
      const hits = await searchPlaces(q, userLocation);
      setResults(hits);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }

  return (
    <Pressable
      style={styles.scrim}
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel="Dismiss location picker"
    >
      <View
        style={styles.sheet}
        accessibilityViewIsModal
        // Stop taps inside the sheet from bubbling to the scrim's
        // dismiss handler — matches ReportDetailCard / ZoneDetailCard
        // (responder, not a redundant inner Pressable).
        onStartShouldSetResponder={() => true}
      >
        <DragHandle />

        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Set location
          </Text>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={({ pressed }) => [styles.closeBtn, pressed && pressedDim]}
          >
            <X size={20} color={colors.labelSecondary} weight="bold" />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <MagnifyingGlass size={20} color={colors.labelTertiary} weight="regular" />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            placeholder="Search for the place"
            placeholderTextColor={colors.labelTertiary}
            returnKeyType="search"
            autoFocus
            accessibilityLabel="Search for the event's location"
          />
        </View>

        {searching ? (
          <ActivityIndicator style={styles.spinner} color={colors.labelSecondary} />
        ) : searched && results.length === 0 ? (
          <Text style={styles.emptyResults}>
            No matches. Try a different search.
          </Text>
        ) : (
          <View style={styles.results}>
            {results.map((place) => (
              <Pressable
                key={place.id}
                onPress={() =>
                  onPick({
                    name: place.name,
                    latitude: place.latitude,
                    longitude: place.longitude,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Use ${place.name}`}
                style={({ pressed }) => [styles.resultRow, pressed && pressedDim]}
              >
                <Text style={styles.resultName} numberOfLines={1}>
                  {place.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.modalScrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    ...shadows.sheet,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...dynamicType(typography.title2Emphasized),
    color: colors.black,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.systemGroupedBackground,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  input: {
    ...dynamicType(typography.bodyRegular),
    color: colors.black,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  spinner: {
    paddingVertical: spacing.lg,
  },
  results: {
    gap: spacing.xs,
  },
  emptyResults: {
    ...dynamicType(typography.bodyRegular),
    color: colors.labelSecondary,
    paddingVertical: spacing.sm,
  },
  resultRow: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  resultName: {
    ...dynamicType(typography.bodyRegular),
    color: colors.black,
  },
});
