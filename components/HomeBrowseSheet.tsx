import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretUp } from 'phosphor-react-native/src/icons/CaretUp';
import { ChatCircle } from 'phosphor-react-native/src/icons/ChatCircle';
import { CloudSun } from 'phosphor-react-native/src/icons/CloudSun';
import { Coffee } from 'phosphor-react-native/src/icons/Coffee';
import { HandHeart } from 'phosphor-react-native/src/icons/HandHeart';
import { Heart } from 'phosphor-react-native/src/icons/Heart';
import { MoonStars } from 'phosphor-react-native/src/icons/MoonStars';
import { SteeringWheel } from 'phosphor-react-native/src/icons/SteeringWheel';
import { Toilet } from 'phosphor-react-native/src/icons/Toilet';
import { useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useRecommendations } from '../hooks/useRecommendations';
import { useReduceMotion } from '../hooks/useReduceMotion';
import type {
  Recommendation,
  RecommendationCategory,
} from '../lib/api/recommendations';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { typography } from '../theme/typography';

/**
 * /home bottom sheet — browse mode (no destination set yet).
 * Figma node: 1133:13690 (Home Full + Collapsed variants).
 *
 * Layout (Full):
 *   - Eyebrow:    "Jordan's Local Recs 💃🏾"
 *   - Title row:  neighborhood (left) + weather/driving card (right)
 *   - Chips:      horizontal scroller of recommendation categories
 *   - Section:    "Around Me: {selected category}" with collapse
 *                 chevron
 *   - Card:       featured recommendation from the selected category
 *                 (or empty state when no matches yet)
 *
 * Five categories per the v1 design — see `RecommendationCategory`
 * in `lib/api/recommendations.ts` for the full taxonomy and the
 * three-source hybrid data flow (curated + community + external).
 *
 * Weather (66° + Moderate) is still mocked — `lib/api/weather.ts`
 * is the documented future swap-in.
 */
export function HomeBrowseSheet({
  firstName,
  neighborhoodLabel,
  userLocation,
  collapsed,
  onToggleCollapsed,
  onSelectRecommendation,
}: {
  /** Display name for the eyebrow; falls back to "Local" if undefined. */
  firstName?: string;
  /** Geocoded neighborhood label; falls back to a generic when null. */
  neighborhoodLabel?: string;
  /**
   * User's current GPS — drives the proximity filter on community
   * submissions (10mi) AND the Google Places `searchText`
   * locationBias on the proxy side. Without it the external adapter
   * short-circuits to []; the sheet then falls back to curated.
   */
  userLocation?: { latitude: number; longitude: number } | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Caller routes to /home with the destination params set. */
  onSelectRecommendation: (rec: Recommendation) => void;
}) {
  const [category, setCategory] = useState<RecommendationCategory>('black-owned');
  const { recommendations } = useRecommendations({ category, userLocation });
  // Multi-card variant per Figma 1133:13551 — horizontal scroll of
  // up to 5 cards. `getRecommendations` already orders them
  // (community first, then external, curated only as catastrophic
  // fallback) and computes `distanceMiles`, so this consumes the
  // list as-is.
  const reduceMotion = useReduceMotion();

  // Eyebrow copy — when we have the user's first name, render the
  // possessive ("Jordan's Local Recs 💃🏾"). With no name (signed-out
  // or pre-displayName Apple sign-in), drop the possessive entirely
  // rather than substituting a generic placeholder.
  const eyebrowCopy = firstName
    ? `${firstName}'s Local Recs 💃🏾`
    : 'Local Recs 💃🏾';

  const categoryLabel = CATEGORY_LABELS[category];

  return (
    <View style={styles.content}>
      <View style={styles.headers}>
        <Text style={styles.eyebrow}>{eyebrowCopy}</Text>

        <View style={styles.topRow}>
          <Text style={styles.neighborhood} numberOfLines={1}>
            {neighborhoodLabel ?? 'Your area'}
          </Text>
          <WeatherDrivingCard />
        </View>
      </View>

      <CategoryChips
        category={category}
        onChange={(next) => {
          // Smooth re-layout when the card refreshes with a different
          // category's recommendation. Skip the animation when the
          // user has Reduce Motion on — the state change still
          // happens, only the transition is suppressed.
          if (!reduceMotion) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          }
          setCategory(next);
        }}
      />

      <Pressable
        onPress={() => {
          if (!reduceMotion) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          }
          onToggleCollapsed();
        }}
        accessibilityRole="button"
        accessibilityLabel={collapsed ? `Show ${categoryLabel} recommendations` : `Hide ${categoryLabel} recommendations`}
        accessibilityState={{ expanded: !collapsed }}
        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        style={({ pressed }) => [styles.sectionRow, pressed && pressedDim]}
      >
        <Text style={styles.sectionTitle}>Around Me: {categoryLabel}</Text>
        {collapsed ? (
          <CaretDown size={16} color={colors.black} weight="fill" />
        ) : (
          <CaretUp size={16} color={colors.black} weight="fill" />
        )}
      </Pressable>

      {!collapsed && (
        recommendations.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardsRow}
            // A bit of a snap so the next card lands aligned to the
            // card width — feels closer to the platform-native
            // carousel pattern (Apple Maps Place collections, Google
            // Maps "Explore" cards) than free-scroll.
            decelerationRate="fast"
            snapToInterval={CARD_WIDTH + CARD_GAP}
            snapToAlignment="start"
          >
            {recommendations.map((rec) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                onPress={() => onSelectRecommendation(rec)}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.cardWrap}>
            <EmptyState categoryLabel={categoryLabel} />
          </View>
        )
      )}
    </View>
  );
}

// --- Category chip row ---------------------------------------------------

const CATEGORY_LABELS: Record<RecommendationCategory, string> = {
  'black-owned': 'Black-Owned',
  'women-owned': 'Women-Owned',
  'lgbtq-welcoming': 'LGBTQ+ Welcoming',
  'restroom': 'Restrooms',
  'late-night-warm-welcome': 'Late Night, Warm Welcome',
};

/** Iteration order — surfaces black-owned first per the original Figma framing. */
const CATEGORY_ORDER: RecommendationCategory[] = [
  'black-owned',
  'women-owned',
  'lgbtq-welcoming',
  'restroom',
  'late-night-warm-welcome',
];

function CategoryChips({
  category,
  onChange,
}: {
  category: RecommendationCategory;
  onChange: (next: RecommendationCategory) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsRow}
    >
      {CATEGORY_ORDER.map((cat) => {
        const selected = cat === category;
        return (
          <Pressable
            key={cat}
            onPress={() => onChange(cat)}
            accessibilityRole="button"
            accessibilityLabel={`${CATEGORY_LABELS[cat]} category`}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              pressed && pressedDim,
            ]}
          >
            <Text
              style={[styles.chipText, selected && styles.chipTextSelected]}
            >
              {CATEGORY_LABELS[cat]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// --- Weather card --------------------------------------------------------

function WeatherDrivingCard() {
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

// --- Recommendation card -------------------------------------------------

/**
 * Photo placeholder per category. Real production would replace this
 * with bundled storefront images (recommendation.photoAsset).
 * Category-appropriate Phosphor glyph + fadedgreen ground reads as
 * "this kind of place" without faking a specific photo.
 */
function PhotoPlaceholderGlyph({ category }: { category: RecommendationCategory }) {
  switch (category) {
    case 'black-owned':
      return <Coffee size={64} color={colors.burntgreen} weight="duotone" />;
    case 'women-owned':
      return <HandHeart size={64} color={colors.burntgreen} weight="duotone" />;
    case 'lgbtq-welcoming':
      return <Heart size={64} color={colors.burntgreen} weight="duotone" />;
    case 'restroom':
      return <Toilet size={64} color={colors.burntgreen} weight="duotone" />;
    case 'late-night-warm-welcome':
      return <MoonStars size={64} color={colors.burntgreen} weight="duotone" />;
  }
}

function RecommendationCard({
  recommendation,
  onPress,
}: {
  recommendation: Recommendation;
  onPress: () => void;
}) {
  const r = recommendation;
  const quoteText = r.curatorQuote ?? r.reportDetail;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${r.name} recommendation — tap to route`}
      style={({ pressed }) => [styles.card, pressed && pressedDim]}
    >
      <View style={styles.photoWrap}>
        <View style={styles.photoPlaceholder} accessibilityIgnoresInvertColors>
          <PhotoPlaceholderGlyph category={r.category} />
        </View>
        {quoteText ? (
          <View style={styles.quoteCallout}>
            <ChatCircle size={16} color={colors.wiltedgreen} weight="fill" />
            <Text style={styles.quoteText} numberOfLines={4}>
              {quoteText}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{r.name}</Text>

        <View style={styles.tagRow}>
          {r.rating != null ? (
            <View style={styles.ratingPill}>
              <Text style={styles.rating}>{r.rating.toFixed(1)}</Text>
              {r.reviewCount != null ? (
                <Text style={styles.ratingMeta}> ({r.reviewCount} reviews)</Text>
              ) : null}
            </View>
          ) : null}
          <View style={styles.tag}>
            <Text style={styles.tagText}>{r.categoryLabel}</Text>
          </View>
        </View>

        <View style={styles.tagRow}>
          {r.isOpen != null ? (
            <View style={r.isOpen ? styles.openPill : styles.tag}>
              <Text style={r.isOpen ? styles.openText : styles.tagText}>
                {r.isOpen ? 'Open' : 'Closed'}
              </Text>
            </View>
          ) : null}
          {r.hoursLabel ? (
            <View style={styles.tag}>
              <Text style={styles.tagText} numberOfLines={1}>{r.hoursLabel}</Text>
            </View>
          ) : null}
          {r.distanceMiles != null ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{formatDistanceMiles(r.distanceMiles)}</Text>
            </View>
          ) : null}
        </View>

        {r.priceTier ? (
          <View style={styles.muteTag}>
            <Text style={styles.muteText}>{r.priceTier}</Text>
          </View>
        ) : null}

        {r.tags?.map((t) => (
          <View key={t.label} style={styles.muteTag}>
            <Text style={styles.muteText}>
              {t.label}
              {t.emoji ? ` ${t.emoji}` : ''}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

/**
 * "0.7 mi away" / "12 mi away" — same pattern as the en-route
 * distance pill but mile-only (no metric switch). Decimal under
 * 10mi, rounded whole above. Below 0.1mi reads as "<0.1 mi away"
 * (we don't promise pedestrian precision at GPS scale).
 */
function formatDistanceMiles(miles: number): string {
  if (miles < 0.1) return '<0.1 mi away';
  if (miles < 10) return `${miles.toFixed(1)} mi away`;
  return `${Math.round(miles)} mi away`;
}

// --- Empty state ---------------------------------------------------------

function EmptyState({ categoryLabel }: { categoryLabel: string }) {
  return (
    <View style={styles.empty} accessible>
      <Text style={styles.emptyTitle}>
        More {categoryLabel.toLowerCase()} coming soon
      </Text>
      <Text style={styles.emptyBody}>
        We're still collecting community-trusted spots in your area.
        Submit a report from the map and yours could land here.
      </Text>
    </View>
  );
}

// --- Styles --------------------------------------------------------------

// Multi-card variant per Figma 1133:13551. Cards are fixed width so
// the horizontal ScrollView's snapToInterval has a deterministic
// stride and adjacent cards peek consistently at the viewport edge
// (Apple Maps / Google Maps collection convention). Figma renders
// at 328pt × 576pt on the wide canvas; ~280pt fits an iPhone
// viewport with comfortable peek room.
export const CARD_WIDTH = 280;
export const CARD_GAP = 12;

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
  chipsRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.fillsTertiary,
  },
  chipSelected: {
    // wiltedgreen for AA contrast on the white chip label.
    backgroundColor: colors.wiltedgreen,
  },
  chipText: {
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
  },
  chipTextSelected: {
    ...typography.footnoteEmphasized,
    color: colors.white,
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
  // Horizontal scroller container for the multi-card variant. Padding
  // on left = sheet edge gutter (16); the right edge gets a matching
  // 16 inside the last card via `marginRight` on the last item, so
  // the trailing card lands flush with the sheet edge when scrolled
  // all the way right.
  cardsRow: {
    paddingHorizontal: 16,
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.white,
    borderRadius: 12,
    // 16pt content padding matches mobile-density Apple/Google place
    // cards. Figma renders at 24pt on the wide canvas — keeping 16
    // for mobile keeps the title + tag rows breathing without
    // wasting vertical space.
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
  photoWrap: {
    // Mobile-density override of Figma 1133:13554's 1:1 photo.
    // The square design works on a wide canvas; on iPhone, a 248pt
    // square + 200pt of card body + 32pt of padding overflowed the
    // sheet's available vertical space (~510pt on a 6.1" device).
    // 4:3 keeps the rectangular spirit and the title/tag rows
    // visible without scrolling inside the card.
    width: '100%',
    aspectRatio: 4 / 3,
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
    // Black rather than freshgreen — Google/Yelp pattern keeps the
    // number neutral and lets the star carry the visual cue. Also
    // fixes the 2.9:1 freshgreen-on-fillsPrimary contrast issue.
    color: colors.black,
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
  empty: {
    padding: 24,
    backgroundColor: colors.white,
    borderRadius: 12,
    gap: 8,
    alignItems: 'center',
  },
  emptyTitle: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
    textAlign: 'center',
  },
});
