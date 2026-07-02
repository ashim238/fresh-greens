import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Phosphor deep-imports per CLAUDE.md icon rule.
import { House } from 'phosphor-react-native/src/icons/House';
import { MapPin } from 'phosphor-react-native/src/icons/MapPin';
import { Trash } from 'phosphor-react-native/src/icons/Trash';

import { RowGroup } from '../components/settings/RowGroup';
import { SettingsHeader } from '../components/settings/SettingsHeader';
import { useSavedPlaces } from '../hooks/useSavedPlaces';
import type { SavedPlace } from '../lib/api/saved-places';
import { getErrorMessage } from '../lib/error-message';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim, tapTarget44 } from '../theme/interaction';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * /saved-places — review and remove the user's saved spatial anchors.
 *
 * Pushed from /menu's "Saved places" row. Add paths: /search result-row
 * bookmark (landmarks) and /home long-press → Save as home. Remove
 * path: this screen's per-row Trash + confirm.
 *
 * Thesis-relevant: data transparency. The user should see what the
 * app keeps about their navigation (saved anchors persist locally
 * via AsyncStorage) and have first-class control over removing it.
 *
 * Register mirrors /zone-preferences + /safety-settings — SettingsHeader
 * over a grouped-gray page, the saved-place rows wrapped in a RowGroup
 * card. Per-place destructive-action via trailing Trash button with an
 * Alert confirm; explicit two-tap to delete prevents accidental loss of
 * an intentionally-saved anchor.
 *
 * Route: /saved-places
 */
export default function SavedPlaces() {
  const router = useRouter();
  const savedPlacesState = useSavedPlaces();
  const { remove } = savedPlacesState;
  const savedPlaces = savedPlacesState.ready ? savedPlacesState.savedPlaces : [];

  function handleRemove(place: SavedPlace) {
    Alert.alert(
      `Remove ${place.name}?`,
      'This will delete the saved place from your device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await remove.run(place.id);
            if (!result.ok) {
              const { title, body } = getErrorMessage('save', 'transient', result.error);
              Alert.alert(title, body);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SettingsHeader
          title="Saved places"
          onBack={() => router.back()}
          onClose={() => router.replace('/home')}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {savedPlacesState.ready && (savedPlaces.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No saved places yet</Text>
              <Text style={styles.emptyBody}>
                Save a Home from the map or a landmark from Search, and
                they&apos;ll appear here so you can review or remove them.
              </Text>
            </View>
          ) : (
            <RowGroup>
              {savedPlaces.map((place) => (
                <SavedPlaceRow
                  key={place.id}
                  place={place}
                  onRemove={() => handleRemove(place)}
                />
              ))}
            </RowGroup>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SavedPlaceRow({
  place,
  onRemove,
}: {
  place: SavedPlace;
  onRemove: () => void;
}) {
  const Glyph = place.kind === 'home' ? House : MapPin;
  // Display the rough storage age — "Saved [date]" rather than a
  // raw ms timestamp. Locally formatted to the user's locale via
  // toLocaleDateString.
  const savedDate = new Date(place.setAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={styles.row}>
      <Glyph size={24} color={colors.labelSecondary} weight="regular" />
      <View style={styles.rowTextStack}>
        <Text
          style={styles.rowLabel}
          numberOfLines={1}
          ellipsizeMode="tail"
          accessibilityLabel={`${place.name}, saved ${savedDate}`}
        >
          {place.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          Saved {savedDate}
        </Text>
      </View>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${place.name}`}
        style={({ pressed }) => [tapTarget44, pressed && pressedDim]}
      >
        <Trash size={20} color={colors.labelSecondary} weight="regular" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.systemGroupedBackground,
  },
  safe: {
    flex: 1,
  },

  scrollContent: {
    padding: spacing.lg,
    gap: spacing.xl,
  },

  // Empty state — sits where the list would be, same horizontal
  // alignment as the list rows so the page doesn't feel hollow.
  emptyState: {
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  emptyTitle: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
  },
  emptyBody: {
    ...dynamicType(relaxedLineHeight(typography.subheadlineRegular)),
    color: colors.labelSecondary,
  },

  // Saved-place row — a flat row inside the RowGroup card; the card
  // chrome (bg / radius / shadow) lives on RowGroup, not here.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 60,
  },
  rowTextStack: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
  },
  rowMeta: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
  },
});
