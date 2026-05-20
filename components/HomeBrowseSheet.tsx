import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretUp } from 'phosphor-react-native/src/icons/CaretUp';
import { ChatCircle } from 'phosphor-react-native/src/icons/ChatCircle';
import { CloudSun } from 'phosphor-react-native/src/icons/CloudSun';
import { Coffee } from 'phosphor-react-native/src/icons/Coffee';
import { HandHeart } from 'phosphor-react-native/src/icons/HandHeart';
import { Heart } from 'phosphor-react-native/src/icons/Heart';
import { MoonStars } from 'phosphor-react-native/src/icons/MoonStars';
import { Star } from 'phosphor-react-native/src/icons/Star';
import { SteeringWheel } from 'phosphor-react-native/src/icons/SteeringWheel';
import { Toilet } from 'phosphor-react-native/src/icons/Toilet';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import CommunitySignalGlyph from '../assets/illustrations/trustedbycommunity-empty.svg';

import { useRecommendations } from '../hooks/useRecommendations';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useTrustedByCommunity } from '../hooks/useTrustedByCommunity';
import { useWeather } from '../hooks/useWeather';
import { formatDistanceAway } from '../lib/format';
import { PROXY_PHOTO_URL } from '../lib/proxy';
import type {
  Recommendation,
  RecommendationCategory,
} from '../lib/api/recommendations';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { shadows } from '../theme/shadows';
import { typography } from '../theme/typography';

/**
 * /home bottom sheet — browse mode (no destination set yet).
 * Figma node (v2): 1114:9047 (Home MapMarker — shows the canonical
 * card with photo + quote callout + star-rating row + tag rows).
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
  refreshKey,
  collapsed,
  onToggleCollapsed,
  onSelectRecommendation,
  onEmptyTap,
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
  /**
   * Parent-driven refetch trigger — ticks on /home focus so the
   * Trusted-by-your-community row re-reads AsyncStorage after a
   * report submission. Without this, the row stays stale until the
   * user crosses a ~0.5mi grid boundary.
   */
  refreshKey?: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Caller routes to /home with the destination params set. */
  onSelectRecommendation: (rec: Recommendation) => void;
  /**
   * Tapping the empty-state card invokes this. Wired by the parent
   * (typically to /report) so a category with no community-submitted
   * spots converts that gap into a direct "be the first" CTA rather
   * than a dead "coming soon" panel.
   */
  onEmptyTap?: () => void;
}) {
  // null = browse mode ("All" chip selected, shows the "Trusted by
  // your community" cross-category row per Round 4 spec). Any
  // category = focus mode (single-category carousel — the pre-Round-4
  // behavior, preserved verbatim). Default is browse mode so the
  // differentiator row is the first thing users see.
  const [category, setCategory] = useState<RecommendationCategory | null>(null);
  const { recommendations, loading } = useRecommendations({
    // Skip the focus-mode fetch when in browse mode — useRecommendations
    // returns the merged catalog when no category is set, which is the
    // wrong shape for the per-category carousel. Browse mode reads from
    // useTrustedByCommunity instead.
    category: category ?? undefined,
    userLocation,
  });
  const { recommendations: trusted, loading: trustedLoading } = useTrustedByCommunity({
    userLocation,
    refreshKey,
  });
  const reduceMotion = useReduceMotion();

  // Eyebrow copy — when we have the user's first name, render the
  // possessive ("Jordan's Local Recs 💃🏾"). With no name (signed-out
  // or pre-displayName Apple sign-in), drop the possessive entirely
  // rather than substituting a generic placeholder.
  const eyebrowCopy = firstName
    ? `${firstName}'s Local Recs 💃🏾`
    : 'Local Recs 💃🏾';

  const browseMode = category === null;
  const categoryLabel = category ? CATEGORY_LABELS[category] : 'All';

  return (
    <View style={styles.content}>
      <View style={styles.headers}>
        <Text style={styles.eyebrow}>{eyebrowCopy}</Text>

        <View style={styles.topRow}>
          <Text style={styles.neighborhood} numberOfLines={1}>
            {neighborhoodLabel ?? 'Your area'}
          </Text>
          <WeatherDrivingCard userLocation={userLocation} />
        </View>
      </View>

      <CategoryChips
        category={category}
        onChange={(next) => {
          if (!reduceMotion) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          }
          setCategory(next);
        }}
      />

      {browseMode ? (
        // --- Browse mode: "Trusted by your community" Row 1 ---
        // No caret/Pressable on the section title — collapsing the
        // only row in browse mode would leave the user with chips and
        // nothing else (no in-place re-expand affordance, and the
        // visual cue would be misleading). Full-sheet collapse is the
        // bottom-sheet drag handle's job (app/home.tsx). The parent's
        // `collapsed` master toggle is still honored so the drag-
        // handle path keeps working.
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Trusted by your community</Text>
          </View>
          {!collapsed && (
            <TrustedByCommunityRow
              recommendations={trusted}
              loading={trustedLoading}
              reduceMotion={reduceMotion}
              onSelectRecommendation={onSelectRecommendation}
              onEmptyTap={onEmptyTap}
            />
          )}
        </>
      ) : (
        // --- Focus mode: per-category carousel (pre-Round-4 path) ---
        <>
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

          {!collapsed && category && (
            loading && recommendations.length === 0 ? (
              // First-render path while the proxy resolves. Renders 3
              // skeleton cards in the same horizontal scroller so the
              // user doesn't see the EmptyState flash before content
              // lands. Without this, every chip-tap shows "More <cat>
              // coming soon" for ~50–500ms while the network call is
              // in flight.
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardsRowContent}
                scrollEnabled={false}
                accessible
                accessibilityLabel={`Loading ${categoryLabel} recommendations`}
              >
                <View style={styles.carouselLeadingSpacer} />
                {[0, 1, 2].map((i) => (
                  <RecommendationCardSkeleton key={`skel-${i}`} />
                ))}
                <View style={styles.carouselTrailingSpacer} />
              </ScrollView>
            ) : recommendations.length > 0 ? (
              // Multi-card variant per Figma 1133:13551 — horizontal
              // scroll of up to 5 cards. `getRecommendations` already
              // orders them (community first, then external, curated
              // only as catastrophic fallback) and computes
              // `distanceMiles`, so this consumes the list as-is.
              //
              // Snap math note: padding lives on leading/trailing spacer
              // Views, NOT on `contentContainerStyle.paddingHorizontal`.
              // Padding on the contentContainer offsets x=0 in scroll
              // coordinates but doesn't shift snap points, so cards 2+
              // misalign. Spacer views participate in the layout and the
              // snap interval lines up with each card's left edge.
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardsRowContent}
                decelerationRate={reduceMotion ? 'normal' : 'fast'}
                snapToInterval={reduceMotion ? undefined : CARD_WIDTH + CARD_GAP}
                snapToAlignment="start"
                accessibilityRole={'list' as any}
                accessibilityLabel={`${categoryLabel} recommendations`}
              >
                <View style={styles.carouselLeadingSpacer} />
                {recommendations.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    recommendation={rec}
                    onPress={() => onSelectRecommendation(rec)}
                  />
                ))}
                <View style={styles.carouselTrailingSpacer} />
              </ScrollView>
            ) : (
              <View style={styles.cardWrap}>
                <EmptyState category={category} onTap={onEmptyTap} />
              </View>
            )
          )}
        </>
      )}
    </View>
  );
}

// --- Trusted-by-community row (Round 4 Row 1) ---------------------------

function TrustedByCommunityRow({
  recommendations,
  loading,
  reduceMotion,
  onSelectRecommendation,
  onEmptyTap,
}: {
  recommendations: Recommendation[];
  loading: boolean;
  reduceMotion: boolean;
  onSelectRecommendation: (rec: Recommendation) => void;
  onEmptyTap?: () => void;
}) {
  // New-submission callback — when the leading recommendation
  // changes (a fresh community report just landed via the refresh-
  // on-focus signal from #199), scroll the carousel to leading and
  // fade-in the first card. The /report flow's success notification
  // haptic already fired; no second haptic here.
  //
  // The recommendations array hydrates async from AsyncStorage, so
  // we can't capture the leading id at component-define time — it's
  // always `undefined` then regardless of what's persisted. Instead,
  // on the first post-hydrate render (`loading === false`) we
  // capture the leading id into the ref. Then subsequent leading-id
  // changes trigger the animation. The `undefined` sentinel
  // distinguishes "not yet captured" from "captured as null."
  const scrollViewRef = useRef<ScrollView>(null);
  const firstCardOpacity = useRef(new Animated.Value(1)).current;
  const initialLeadingIdRef = useRef<string | null | undefined>(undefined);
  const lastAnimatedLeadingIdRef = useRef<string | null>(null);
  const leadingId = recommendations[0]?.id ?? null;
  useEffect(() => {
    if (loading) return;
    if (initialLeadingIdRef.current === undefined) {
      initialLeadingIdRef.current = leadingId;
      return;
    }
    if (!leadingId) return;
    if (leadingId === initialLeadingIdRef.current) return;
    if (leadingId === lastAnimatedLeadingIdRef.current) return;
    lastAnimatedLeadingIdRef.current = leadingId;
    scrollViewRef.current?.scrollTo({ x: 0, animated: !reduceMotion });
    if (!reduceMotion) {
      firstCardOpacity.setValue(0.4);
      Animated.timing(firstCardOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [leadingId, loading, reduceMotion, firstCardOpacity]);

  if (loading && recommendations.length === 0) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardsRowContent}
        scrollEnabled={false}
        accessible
        accessibilityLabel="Loading trusted-by-your-community recommendations"
      >
        <View style={styles.carouselLeadingSpacer} />
        {[0, 1, 2].map((i) => (
          <RecommendationCardSkeleton key={`trusted-skel-${i}`} />
        ))}
        <View style={styles.carouselTrailingSpacer} />
      </ScrollView>
    );
  }
  if (recommendations.length === 0) {
    return (
      <View style={styles.cardWrap}>
        <TrustedByCommunityEmpty onTap={onEmptyTap} />
      </View>
    );
  }
  return (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.cardsRowContent}
      decelerationRate={reduceMotion ? 'normal' : 'fast'}
      snapToInterval={reduceMotion ? undefined : CARD_WIDTH + CARD_GAP}
      snapToAlignment="start"
      accessibilityRole={'list' as any}
      accessibilityLabel="Trusted by your community"
    >
      <View style={styles.carouselLeadingSpacer} />
      {recommendations.map((rec, idx) =>
        idx === 0 ? (
          <Animated.View key={rec.id} style={{ opacity: firstCardOpacity }}>
            <RecommendationCard
              recommendation={rec}
              onPress={() => onSelectRecommendation(rec)}
            />
          </Animated.View>
        ) : (
          <RecommendationCard
            key={rec.id}
            recommendation={rec}
            onPress={() => onSelectRecommendation(rec)}
          />
        ),
      )}
      <View style={styles.carouselTrailingSpacer} />
    </ScrollView>
  );
}

function TrustedByCommunityEmpty({ onTap }: { onTap?: () => void }) {
  // Cross-category empty — the per-category EmptyState component is
  // keyed by RecommendationCategory and routes to a category-specific
  // glyph, which doesn't apply here. Custom `community-signal` mark
  // (an open-book illustration referencing the Negro Motorist Green
  // Book — the thesis's load-bearing historical anchor) replaces the
  // earlier Star placeholder, which carried "favorites/saved"
  // semantics and didn't match the row's framing.
  const title = 'Be the first community signal';
  const body =
    'No spots have been vouched near you yet. Drop a report and let neighbors know where the community shows up.';
  const a11yLabel = `${title}. ${body}`;
  const content = (
    <>
      <CommunitySignalGlyph width={64} height={64} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </>
  );
  if (!onTap) {
    return (
      <View style={styles.empty} accessible accessibilityLabel={a11yLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [styles.empty, pressed && pressedDim]}
      onPress={onTap}
      accessible
      accessibilityLabel={a11yLabel}
      accessibilityHint="Opens the report screen"
      accessibilityRole="button"
    >
      {content}
    </Pressable>
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
  category: RecommendationCategory | null;
  onChange: (next: RecommendationCategory | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsRow}
    >
      {/*
        "Browse" pill leads the row — selected = browse mode (Row 1
        visible, no per-category focus). Tap any other chip to enter
        focus mode; tap "Browse" to come back out. Named "Browse"
        rather than "All" because the latter is semantically ambiguous
        ("all categories"? "all locations"? "all results"?) — "Browse"
        names the mode it puts you in, pairing naturally with the
        section title "Trusted by your community".
      */}
      <Pressable
        onPress={() => onChange(null)}
        accessibilityRole="button"
        accessibilityLabel="Browse mode — recommendations across all categories"
        accessibilityState={{ selected: category === null }}
        style={({ pressed }) => [
          styles.chip,
          category === null && styles.chipSelected,
          pressed && pressedDim,
        ]}
      >
        <Text
          style={[
            styles.chipText,
            category === null && styles.chipTextSelected,
          ]}
        >
          Browse
        </Text>
      </Pressable>
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

function WeatherDrivingCard({
  userLocation,
}: {
  userLocation?: { latitude: number; longitude: number } | null;
}) {
  const { weather } = useWeather(userLocation);
  // Fall back to a sensible placeholder until the first API
  // response lands. The card never disappears — it's read at a
  // glance and "missing weather" reads worse than "loading-state
  // weather." 66°/Moderate was the prior hardcoded mock.
  const temp = weather ? `${weather.temperatureF}°` : '—°';
  const condition = weather ? weather.drivingLabel : '—';

  return (
    <View
      style={styles.weatherCard}
      accessibilityLabel={
        weather
          ? `${weather.temperatureF} degrees, ${weather.drivingLabel.toLowerCase()} driving conditions`
          : 'Loading weather'
      }
    >
      <View style={styles.weatherRow}>
        <CloudSun size={16} color={colors.labelSecondary} weight="fill" />
        <Text style={styles.weatherText}>{temp}</Text>
      </View>
      <View style={styles.weatherRow}>
        <SteeringWheel size={16} color={colors.labelSecondary} weight="fill" />
        <Text style={styles.weatherText}>{condition}</Text>
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
  // Photo load tracking — when the proxy's /api/photo returns
  // 4xx/5xx (rate limit, missing photo, Google upstream error),
  // <Image> stays empty and the card reads as broken. `photoFailed`
  // flips the card to the placeholder glyph fallback so the card
  // always renders something.
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = r.photoName && !photoFailed;
  // VoiceOver / TalkBack label — composes the visible information
  // into a single readable string so screen-reader users get the
  // same context the sighted card surfaces (name + category +
  // rating + open state + distance + curator quote). Previously
  // truncated to "{name} recommendation — tap to route" which
  // stripped 5+ data points.
  const a11yLabel = [
    r.name,
    r.categoryLabel,
    r.rating != null
      ? `${r.rating.toFixed(1)} stars${r.reviewCount != null ? `, ${r.reviewCount} reviews` : ''}`
      : null,
    r.isOpen === true ? 'Open now' : r.isOpen === false ? 'Closed' : null,
    r.hoursLabel,
    r.distanceMiles != null ? formatDistanceAway(r.distanceMiles) : null,
    quoteText ? `${r.curatorName ? `${r.curatorName} says` : 'Note'}: ${quoteText}` : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint="Routes to this destination"
      style={({ pressed }) => [styles.card, pressed && pressedDim]}
    >
      <View style={styles.photoWrap}>
        {showPhoto ? (
          <Image
            source={{ uri: `${PROXY_PHOTO_URL}?name=${encodeURIComponent(r.photoName!)}&max=560` }}
            style={styles.photoImage}
            accessibilityIgnoresInvertColors
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <View style={styles.photoPlaceholder} accessibilityIgnoresInvertColors>
            <PhotoPlaceholderGlyph category={r.category} />
          </View>
        )}
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
        <Text style={styles.cardTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
          {r.name}
        </Text>

        <View style={styles.tagRow}>
          {r.rating != null ? (
            <View style={styles.ratingPill}>
              <Star size={14} color={colors.freshgreen} weight="fill" />
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
              <Text style={styles.tagText}>{formatDistanceAway(r.distanceMiles)}</Text>
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
 * Loading-state stand-in for `RecommendationCard`. Same outer
 * dimensions (CARD_WIDTH × ~card body height) so the carousel
 * doesn't reflow when real cards land. Solid `fillsPrimary`
 * blocks represent photo + title + tag rows — enough to read as
 * "loading" without animation (animated shimmer would conflict
 * with Reduce Motion + adds another moving piece during the
 * sheet's snap behavior).
 */
function RecommendationCardSkeleton() {
  return (
    <View
      style={[styles.card, styles.cardSkeleton]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.photoWrap, styles.skelBlock]} />
      <View style={styles.cardBody}>
        <View style={[styles.skelLine, { width: '70%', height: 28 }]} />
        <View style={[styles.skelLine, { width: '50%', height: 18 }]} />
        <View style={[styles.skelLine, { width: '60%', height: 18 }]} />
      </View>
    </View>
  );
}

// --- Empty state ---------------------------------------------------------

// Per-category invitations. The previous generic "More X coming soon"
// read as an apology; framing each empty as a specific ask converts
// the gap into the most direct contribution path in the app.
const EMPTY_STATE_COPY: Record<
  RecommendationCategory,
  { title: string; body: string }
> = {
  'black-owned': {
    title: 'Be the first to put a Black-owned spot on the map here',
    body: 'Tap to drop a report — yours could anchor this category for the neighborhood.',
  },
  'women-owned': {
    title: 'No women-owned spots logged here yet',
    body: 'Tap to add the one you trust — others searching this area will see it.',
  },
  'lgbtq-welcoming': {
    title: 'Know a spot that genuinely welcomes everyone here?',
    body: 'Tap to mark it — community-vetted reads stronger than a generic flag.',
  },
  'restroom': {
    title: 'No publicly-vouched restrooms in this area yet',
    body: 'Tap to add one — the next person caught short will thank you.',
  },
  'late-night-warm-welcome': {
    title: 'No 2 a.m. safe havens logged here yet',
    body: 'Tap to mark a place that stays open and stays warm to walk into late.',
  },
};

function EmptyState({
  category,
  onTap,
}: {
  category: RecommendationCategory;
  onTap?: () => void;
}) {
  const copy = EMPTY_STATE_COPY[category];
  const a11yLabel = `${copy.title}. ${copy.body}`;
  const content = (
    <>
      <PhotoPlaceholderGlyph category={category} />
      <Text style={styles.emptyTitle}>{copy.title}</Text>
      <Text style={styles.emptyBody}>{copy.body}</Text>
    </>
  );
  if (!onTap) {
    return (
      <View style={styles.empty} accessible accessibilityLabel={a11yLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [styles.empty, pressed && pressedDim]}
      onPress={onTap}
      accessible
      accessibilityLabel={a11yLabel}
      accessibilityHint="Adds a community report for this category"
      accessibilityRole="button"
    >
      {content}
    </Pressable>
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
    paddingVertical: 8,
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
  // 44pt painted tap target per HIG. paddingVertical:13 + the chip
  // text's 18pt lineHeight (footnoteRegular) lands at ~44pt. Was 6
  // (~30pt) — that passed the touch floor with no hitSlop but
  // violated the .cursorrules "44pt on the painted surface, not
  // just hit area" rule. Adds ~14pt to the chip-row height; the
  // sheet has room for it.
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderRadius: 22,
    backgroundColor: colors.fillsTertiary,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Horizontal scroller content layout. The contentContainerStyle's
  // `paddingHorizontal` was breaking snap math (snap points are
  // measured from x=0 regardless of padding, so cards 2+ misaligned
  // by 16pt). Fixed by replacing paddingHorizontal with explicit
  // leading/trailing spacer Views that participate in layout and
  // shift the cards' actual positions, not just their visible offset.
  cardsRowContent: {
    gap: CARD_GAP,
    paddingBottom: 6,
  },
  carouselLeadingSpacer: {
    width: 16,
  },
  carouselTrailingSpacer: {
    width: 16,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.white,
    borderRadius: 12,
    // v2 spec (Figma 1114:9047) is 24pt padding + 48pt photo→body gap;
    // we use 16pt for both because the outer sheet has a vertical
    // ScrollView now (so we can grow), but iPhone-fit still wants
    // tighter density than the design canvas. Bumped from 12 → 16
    // alongside the 1:1 photo restoration to honor v2's breathing room.
    padding: 16,
    gap: 16,
    // M3 Elevation 1 — chrome over map. Theme tier so the card,
    // FAB stack, and ETA pill all read at the same depth.
    ...shadows.e1,
  },
  cardSkeleton: {
    // Slightly muted shadow on the skeleton so it doesn't draw the
    // eye as much as real cards. Same dimensions otherwise so the
    // layout stays put when real cards land.
    shadowOpacity: 0.08,
  },
  skelBlock: {
    backgroundColor: colors.fillsPrimary,
  },
  skelLine: {
    backgroundColor: colors.fillsPrimary,
    borderRadius: 4,
  },
  photoWrap: {
    // 4:3 (intentional override of v2 Figma 1114:9047's 1:1 photo).
    // Trade-off rationale:
    //  - 1:1 makes cards ~70pt taller; on a 6.1" iPhone the body
    //    (title + tag rows) gets pushed below the visible sheet edge
    //    and requires an extra inner-scroll to read. 4:3 keeps the
    //    full card at a glance.
    //  - Google Places photos are typically horizontal compositions;
    //    they frame better at 4:3 than they crop at 1:1.
    // The sheet does have a vertical ScrollView now (#179), so 1:1
    // is technically possible — but "scrollable" isn't the same as
    // "readable at a glance." Density wins here.
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
  photoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.fadedgreen, // shows during image load
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
    ...shadows.e1,
  },
  quoteText: {
    // footnoteRegular (13pt) gives the curator-quote copy headroom
    // off the caption1 12pt WCAG 1.4.4 floor for informational
    // content. The quote is a primary qualitative signal on the
    // card (the curator voice — see the Green Book editorial
    // parallel in the README) and shouldn't sit at the minimum
    // allowed size when one tier up is available.
    ...typography.footnoteRegular,
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
    gap: 4,
    backgroundColor: colors.fillsPrimary,
    borderRadius: 4,
    padding: 4,
  },
  rating: {
    ...typography.footnoteEmphasized,
    // freshgreen per v2 Figma (1114:9047) — brand-exception accent,
    // same family as the freshgreen Go button and underlined
    // destination link in route mode (.cursorrules: "primary CTA,
    // in-flow links"). Contrast on fillsPrimary is ~2.5:1, below
    // AA, but the star icon to the left carries the meaning and
    // the "(N reviews)" context resolves any ambiguity. Documented
    // as a brand exception, not an oversight.
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
