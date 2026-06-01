import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Phosphor deep-imports per CLAUDE.md icon rule.
import { Bookmark } from 'phosphor-react-native/src/icons/Bookmark';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { House } from 'phosphor-react-native/src/icons/House';
import { MapPin } from 'phosphor-react-native/src/icons/MapPin';
import { Trash } from 'phosphor-react-native/src/icons/Trash';

import { useSavedPlaces } from '../hooks/useSavedPlaces';
import type { SavedPlace } from '../lib/api/saved-places';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * /saved-places — review and remove the user's saved spatial anchors.
 *
 * Pushed from /menu's "Saved places" row. Until this surface existed,
 * the only way to add a saved place was from /search or /home's
 * "Save as Home" affordance, and the only way to REMOVE one was to
 * overwrite-by-saving-again — there was no review-or-remove surface
 * in settings.
 *
 * Thesis-relevant: data transparency. The user should see what the
 * app keeps about their navigation (saved anchors persist locally
 * via AsyncStorage) and have first-class control over removing it.
 *
 * Register mirrors /zone-preferences + /safety-settings — header +
 * title row + grouped list of rows. Per-place destructive-action via
 * trailing Trash button with an Alert confirm; explicit two-tap to
 * delete prevents accidental loss of an intentionally-saved anchor.
 *
 * Route: /saved-places
 */
export default function SavedPlaces() {
  const router = useRouter();
  const { savedPlaces, removeSavedPlace } = useSavedPlaces();

  function handleRemove(place: SavedPlace) {
    Alert.alert(
      `Remove ${place.name}?`,
      'This will delete the saved place from your device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeSavedPlace(place.id).catch((err) =>
              console.warn('removeSavedPlace failed', err),
            );
          },
        },
      ],
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={({ pressed }) => [
              styles.headerBackBtn,
              pressed && pressedDim,
            ]}
          >
            <CaretLeft size={28} color={colors.black} weight="regular" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/*
            Title row mirrors /zone-preferences + /safety-settings:
            48pt duotone glyph + Title2 Emphasized. The three /menu
            sub-pages share this register so back-to-back viewing
            reads coherent.
          */}
          <View style={styles.titleRow}>
            <Bookmark size={48} color={colors.black} weight="duotone" />
            <Text style={styles.pageTitle} accessibilityRole="header">
              Saved places
            </Text>
          </View>

          {savedPlaces.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No saved places yet</Text>
              <Text style={styles.emptyBody}>
                Save a Home from the map or a landmark from Search, and
                they&apos;ll appear here so you can review or remove them.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {savedPlaces.map((place) => (
                <SavedPlaceRow
                  key={place.id}
                  place={place}
                  onRemove={() => handleRemove(place)}
                />
              ))}
            </View>
          )}
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
      <Glyph size={24} color={colors.black} weight="duotone" />
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
        hitSlop={12}
        style={({ pressed }) => [styles.removeBtn, pressed && pressedDim]}
      >
        <Trash size={20} color={colors.labelSecondary} weight="regular" />
      </Pressable>
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

  // Header (back chevron strip) — matches /safety-settings + /zone-preferences.
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pageTitle: {
    ...dynamicType(typography.title2Emphasized),
    color: colors.black,
    flex: 1,
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

  // List of saved-place rows.
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 60,
    ...shadows.e1,
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
  // Trash button — 44pt visual via the surrounding tap area; the
  // 20pt glyph sits inside per the .cursorrules tap-target floor.
  removeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
