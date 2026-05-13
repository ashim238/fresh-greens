import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretUp } from 'phosphor-react-native/src/icons/CaretUp';
import { ChatCircle } from 'phosphor-react-native/src/icons/ChatCircle';
import { CloudSun } from 'phosphor-react-native/src/icons/CloudSun';
import { Coffee } from 'phosphor-react-native/src/icons/Coffee';
import { SteeringWheel } from 'phosphor-react-native/src/icons/SteeringWheel';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { typography } from '../theme/typography';

/**
 * /home bottom sheet — browse mode (no destination set yet).
 * Figma node: 1133:13690 (Home Full + Collapsed variants).
 *
 * Layout (Full):
 *   - Eyebrow:   "Jordan's Local Recs 💃🏾"
 *   - Title row: place neighborhood (left) + weather/driving card (right)
 *   - Section:   "Things to Do: Black Owned ▼" (toggles full ↔ collapsed)
 *   - Card:      one featured recommendation (photo + quote + tags)
 *
 * The route-established sheet (existing /home design) renders when a
 * destination IS set; this sheet renders when the user hasn't picked
 * one yet — the "what's around here?" state.
 *
 * Data adapters intentionally not wired yet:
 *   - Weather (66° + "Moderate" driving conditions) is mocked. Future
 *     `lib/api/weather.ts` would call NOAA or OpenWeather and return
 *     `{ temperatureF, drivingConditions: 'good'|'moderate'|'poor' }`.
 *   - Recommendation card (Great Day Latte) is hardcoded from Figma.
 *     Future `lib/api/recommendations.ts` would return a list of
 *     curated POIs with photo + testimony + tags.
 *
 * Both adapter shells are out of scope for this PR — the screen
 * already encodes the design intent against mocked data; the swap-in
 * happens behind the `useWeather` / `useRecommendations` hooks when
 * those land.
 */
export function HomeBrowseSheet({
  firstName,
  neighborhoodLabel,
  collapsed,
  onToggleCollapsed,
}: {
  /** Display name for the eyebrow; falls back to "Local" if undefined. */
  firstName?: string;
  /** Geocoded neighborhood label; falls back to a generic when null. */
  neighborhoodLabel?: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  // Eyebrow copy — when we have the user's first name, render the
  // possessive ("Jordan's Local Recs 💃🏾"). With no name (signed-out
  // or pre-displayName Apple sign-in), drop the possessive entirely
  // rather than substituting a generic placeholder — "Local Local
  // Recs" reads as a typo (and was, in v1).
  const eyebrowCopy = firstName
    ? `${firstName}'s Local Recs 💃🏾`
    : 'Local Recs 💃🏾';

  return (
    <View style={styles.content}>
      <View style={styles.headers}>
        <Text style={styles.eyebrow}>{eyebrowCopy}</Text>

        <View style={styles.topRow}>
          <Text style={styles.neighborhood} numberOfLines={1}>
            {neighborhoodLabel ?? 'East Historic District, Mobile'}
          </Text>
          <WeatherDrivingCard />
        </View>
      </View>

      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          onToggleCollapsed();
        }}
        accessibilityRole="button"
        accessibilityLabel={collapsed ? 'Show recommendations' : 'Hide recommendations'}
        accessibilityState={{ expanded: !collapsed }}
        hitSlop={8}
        style={({ pressed }) => [styles.sectionRow, pressed && pressedDim]}
      >
        <Text style={styles.sectionTitle}>Things to Do: Black Owned</Text>
        {collapsed ? (
          <CaretDown size={16} color={colors.black} weight="fill" />
        ) : (
          <CaretUp size={16} color={colors.black} weight="fill" />
        )}
      </Pressable>

      {!collapsed && (
        <View style={styles.cardWrap}>
          <RecommendationCard />
        </View>
      )}
    </View>
  );
}

function WeatherDrivingCard() {
  // Mocked v1: 66°F + Moderate. See file-level doc for the future
  // weather adapter contract.
  return (
    <View style={styles.weatherCard} accessibilityLabel="66 degrees, moderate driving conditions">
      <View style={styles.weatherRow}>
        <CloudSun size={16} color={colors.labelSecondary} weight="fill" />
        <Text style={styles.weatherText}>66°</Text>
      </View>
      <View style={styles.weatherRow}>
        <SteeringWheel size={16} color={colors.labelSecondary} weight="fill" />
        <Text style={styles.weatherText}>Moderate</Text>
      </View>
    </View>
  );
}

function RecommendationCard() {
  // Mocked v1: Great Day Latte from Figma 306:823. Photo is the cafe
  // illustration the design uses; testimony copy verbatim from the
  // Figma so the visual register matches end-to-end.
  return (
    <View style={styles.card} accessible accessibilityLabel="Great Day Latte recommendation card">
      <View style={styles.photoWrap}>
        {/*
          Photo placeholder — real cafe storefront image arrives with
          the recommendations adapter. fadedgreen ground + a Coffee
          glyph reads as "cafe placeholder" without faking a specific
          photo. Eight-pt corner radius matches Figma 306:826.
        */}
        <View style={styles.photoPlaceholder} accessibilityIgnoresInvertColors>
          <Coffee size={64} color={colors.burntgreen} weight="duotone" />
        </View>
        <View style={styles.quoteCallout}>
          <ChatCircle size={16} color={colors.freshgreen} weight="fill" />
          <Text style={styles.quoteText}>
            An ESSENTIAL part of my daily morning ritual. The fragrant scents and
            atmosphere remind me of my own kitchen
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>Great Day Latte</Text>

        <View style={styles.tagRow}>
          <View style={styles.ratingPill}>
            <Text style={styles.rating}>4.7</Text>
            <Text style={styles.ratingMeta}> (97 reviews)</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>Cafe</Text>
          </View>
        </View>

        <View style={styles.tagRow}>
          <View style={styles.openPill}>
            <Text style={styles.openText}>Open</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>Closes 4 PM</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>0.7 mi away</Text>
          </View>
        </View>

        <View style={styles.muteTag}>
          <Text style={styles.muteText}>$1–10</Text>
        </View>
        <View style={styles.muteTag}>
          <Text style={styles.muteText}>A Sunday staple 👀</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 16,
  },
  headers: {
    gap: 8,
    paddingHorizontal: 16,
  },
  eyebrow: {
    ...typography.footnoteRegular,
    color: colors.mutedTertiary,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  neighborhood: {
    ...typography.bodyEmphasized,
    color: colors.black,
    flex: 1,
  },
  weatherCard: {
    backgroundColor: colors.fillsQuaternary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 8,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weatherText: {
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
  },
  cardWrap: {
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 24,
    gap: 48,
    // M3 Elevation 1 — keeps the card distinct from the sheet body
    // without competing with the sheet's own elevation.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
  photoWrap: {
    width: 280,
    height: 280,
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'center',
    position: 'relative',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.fadedgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteCallout: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: colors.white,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  quoteText: {
    ...typography.caption1Regular,
    color: colors.black,
    flex: 1,
  },
  cardBody: {
    gap: 8,
  },
  cardTitle: {
    ...typography.title1Emphasized,
    color: colors.black,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.fillsPrimary,
    borderRadius: 4,
    padding: 4,
  },
  rating: {
    ...typography.footnoteEmphasized,
    color: colors.freshgreen,
  },
  ratingMeta: {
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
  },
  tag: {
    backgroundColor: colors.fillsPrimary,
    borderRadius: 4,
    padding: 4,
  },
  tagText: {
    ...typography.footnoteRegular,
    color: colors.black,
  },
  openPill: {
    backgroundColor: colors.fadedgreen,
    borderRadius: 4,
    padding: 4,
  },
  openText: {
    ...typography.footnoteEmphasized,
    color: colors.burntgreen,
  },
  muteTag: {
    backgroundColor: colors.fillsSecondary,
    borderRadius: 4,
    padding: 4,
    alignSelf: 'flex-start',
  },
  muteText: {
    ...typography.caption1Regular,
    color: colors.mutedSecondary,
  },
});
