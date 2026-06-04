import * as Haptics from 'expo-haptics';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretUp } from 'phosphor-react-native/src/icons/CaretUp';
import { ChatCircle } from 'phosphor-react-native/src/icons/ChatCircle';
import { Star } from 'phosphor-react-native/src/icons/Star';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, LayoutAnimation, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import CommunitySignalGlyph from '../assets/illustrations/trustedbycommunity-empty.svg';
// Bespoke category glyphs — multi-color illustrative SVGs that
// replace the Phosphor placeholders (Coffee/HandHeart/Heart/Toilet/
// MoonStars) on the recommendation-card empty-state placeholder
// surface. Black-owned reuses the existing mapmarker glyph;
// women-owned / LGBTQ+ / restroom / late-night each ship as their
// own bespoke illustration (Figma 1255:1060).
import GlyphBlackOwned from '../assets/illustrations/mapmarker-glyph-black-owned.svg';
import GlyphLateNight from '../assets/illustrations/mapmarker-glyph-late-night.svg';
import GlyphLgbtq from '../assets/illustrations/mapmarker-glyph-lgbtq.svg';
import GlyphRestroom from '../assets/illustrations/mapmarker-glyph-restroom.svg';
import GlyphWomenOwned from '../assets/illustrations/mapmarker-glyph-womenowned.svg';
// Weather + driving-conditions glyphs are bespoke multi-color
// illustrations (Figma 1100:8749) — they replace the monochrome
// Phosphor CloudSun/SteeringWheel placeholders so the card matches
// the design source of truth. Baked-in yellow (sun, wheel hub) is
// illustrative, covered by .cursorrules reserved-color carve-out #2.
import DrivingGlyph from '../assets/illustrations/driving-glyph.svg';
import WeatherGlyph from '../assets/illustrations/weather-glyph.svg';

import { Clock } from 'phosphor-react-native/src/icons/Clock';
import { useRecommendationsBatch, type BrowseRowSpec } from '../hooks/useRecommendationsBatch';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useWeather } from '../hooks/useWeather';

import CommunitySignalGlyph24 from '../assets/illustrations/trustedbycommunity-empty-24.svg';
import { formatDistanceAway } from '../lib/format';
import { PROXY_PHOTO_URL } from '../lib/proxy';
import type {
  Recommendation,
  RecommendationCategory,
} from '../lib/api/recommendations';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
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
  // All 7 browse-mode rows batched in parallel. Trusted-by-community
  // is row[0]; the result for it is consumed by TrustedByCommunityRow
  // (which keeps its scroll-to-leading + first-card-fade animation
  // for new submissions). Rows 2–7 render via a generic carousel
  // helper below.
  const { byKey: browseRowResults } = useRecommendationsBatch({
    rows: BROWSE_ROW_SPECS,
    userLocation,
    refreshKey,
  });
  const trustedRowResult = browseRowResults['trusted-community'];
  const trusted = trustedRowResult?.recommendations ?? [];
  const trustedLoading = trustedRowResult?.loading ?? true;
  const reduceMotion = useReduceMotion();

  // This sheet OWNS its vertical scroller (moved in from app/home.tsx).
  // It has to: `stickyHeaderIndices` only pins a ScrollView's *direct*
  // JSX children, and a child component's returned Fragment is opaque
  // to the parent's `React.Children` — so when home.tsx wrapped a lone
  // `<HomeBrowseSheet/>` in a ScrollView, index 1 pointed at nothing and
  // the chips never stuck. With the ScrollView here, headers/chips/rows
  // are real direct children: [0]=headers, [1]=chips (sticky), then the
  // section header + row stack.
  const sheetScrollRef = useRef<ScrollView>(null);
  // Measured height of the sticky chips strip — used to offset chip
  // jump-link scroll targets so the destination row's header lands just
  // below the pinned chips, not behind them. Local to the scroller now
  // (was reported up to the parent when it owned the ScrollView).
  const stickyChipsHeightRef = useRef(0);

  // Per-row Y offsets captured via onLayout — used by the chip-tap
  // jump-link handler. Ref (not state) because reads happen
  // imperatively at tap-time; layout writes shouldn't trigger
  // re-renders.
  const rowYsRef = useRef<Record<string, number>>({});
  // When a chip is tapped before its target row has been laid out
  // (sheet collapsed, or first-render race), we stash the target
  // here — the next onLayout pass for that row will fire the scroll.
  const [pendingScrollKey, setPendingScrollKey] = useState<string | null>(null);

  // Scroll-spy: which chip's section is currently pinned under the chip
  // strip. `null` = the "Browse" chip (the top region — trusted +
  // open-now, neither of which has a chip). Updated on scroll, and set
  // optimistically on tap for instant feedback.
  const [activeCategory, setActiveCategory] =
    useState<RecommendationCategory | null>(null);

  // On scroll, the active chip is the DEEPEST category row whose header
  // has scrolled up to/under the pinned chip strip. Rows without a chip
  // (open-now) aren't anchors, so the active chip holds at "Browse"
  // while the user scrolls through the top region. `setActiveCategory`
  // bails on an unchanged value, so this only re-renders the sheet on a
  // section-boundary crossing (~6× per full scroll), not per frame.
  function handleSheetScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const spyLine =
      e.nativeEvent.contentOffset.y + stickyChipsHeightRef.current;
    let active: RecommendationCategory | null = null;
    for (const cat of CATEGORY_ORDER) {
      const y = rowYsRef.current[categoryToRowKey(cat)];
      // Rows are laid out in CATEGORY_ORDER, so Ys increase — stop at
      // the first row that hasn't scrolled past the spy line yet.
      if (y == null || y > spyLine) break;
      active = cat;
    }
    setActiveCategory((prev) => (prev === active ? prev : active));
  }

  // Clear the cached row Ys when the sheet collapses — the rows
  // unmount, and their cached Y values are now stale (next expand
  // could lay them out at different offsets if sheet content
  // changed, e.g. a new community report bumped Row 1's height).
  // Fresh measurements arrive via onLayout on the post-expand pass.
  useEffect(() => {
    if (collapsed) {
      rowYsRef.current = {};
    }
  }, [collapsed]);

  // Scrolls the sheet so the given row offset lands just below the
  // pinned chip strip (+8pt breathing room), clamped at the top.
  function scrollToRow(y: number) {
    sheetScrollRef.current?.scrollTo({
      y: Math.max(0, y - stickyChipsHeightRef.current - 8),
      animated: true,
    });
  }

  function recordRowY(key: string, y: number) {
    rowYsRef.current[key] = y;
    if (pendingScrollKey === key) {
      scrollToRow(y);
      setPendingScrollKey(null);
    }
  }

  function jumpToCategory(category: RecommendationCategory | null) {
    // Browse chip (null) → top of the sheet. Category chip → its row.
    const key = category ? categoryToRowKey(category) : 'trusted-community';
    // Optimistic active state — light up the tapped chip immediately
    // rather than waiting for the scroll-spy to catch up mid-animation.
    setActiveCategory(category);
    Haptics.selectionAsync().catch(() => {});
    // Try the cached Y first regardless of collapsed state — covers
    // the case where rows are already laid out (e.g. user collapsed
    // then re-tapped a chip without the rowYsRef having been cleared
    // mid-frame, or the LayoutAnimation race the code-reviewer flagged
    // where onLayout fired before this tap landed).
    const cachedY = rowYsRef.current[key];
    if (cachedY !== undefined) {
      // If currently collapsed, expand AND scroll — scrollToRow runs
      // against this sheet's own ScrollView (always mounted in browse
      // mode), so the scroll target survives the expansion animation.
      if (collapsed) {
        if (!reduceMotion) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
        onToggleCollapsed();
      }
      scrollToRow(cachedY);
      return;
    }
    // No cached Y — use the pending pattern: stash the target and
    // expand. The post-expand onLayout pass fires the scroll once Y
    // is known.
    setPendingScrollKey(key);
    if (collapsed) {
      if (!reduceMotion) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      onToggleCollapsed();
    }
  }

  // Eyebrow copy — when we have the user's first name, render the
  // possessive ("Jordan's Local Recs 💃🏾"). Without a name (Apple
  // sign-in only returns displayName on the first sign-in IF the
  // user grants FULL_NAME — most don't), fall back to "Your" so the
  // possessive structure holds and the eyebrow still reads as
  // personal, not generic.
  const eyebrowCopy = firstName
    ? `${firstName}'s Local Recs 💃🏾`
    : 'Your Local Recs 💃🏾';

  return (
    // This sheet owns its vertical scroller so the chips can actually
    // pin: `stickyHeaderIndices` only sticks a ScrollView's *direct*
    // JSX children, and the headers/chips/row-stack below ARE those
    // direct children here. (Previously home.tsx wrapped a lone
    // `<HomeBrowseSheet/>` element in a ScrollView — its Fragment was
    // opaque to the ScrollView's `React.Children`, so index 1 pointed
    // at nothing and the chips never stuck.)
    //
    // Index map for `stickyHeaderIndices={[1]}`:
    //   [0] headers (eyebrow + neighborhood/weather row)
    //   [1] chips strip  ← sticky
    //   [2] "Trusted by your community" section header (Pressable)
    //   [3] the collapsed-gated row stack (a Fragment, flattened by
    //       React.Children but it sits AFTER index 1, so it can't
    //       shift the chips' index)
    //
    // `flex: 1` bounds the scroller to the sheet's capped height;
    // `sheetScrollContent` carries the gap + bottom padding the old
    // home.tsx wrapper provided, so vertical rhythm is unchanged.
    <ScrollView
      ref={sheetScrollRef}
      style={styles.sheetScroll}
      contentContainerStyle={styles.sheetScrollContent}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      stickyHeaderIndices={[1]}
      onScroll={handleSheetScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.headers}>
        <Text style={styles.eyebrow}>{eyebrowCopy}</Text>

        <View style={styles.topRow}>
          <Text style={styles.neighborhood} numberOfLines={1}>
            {neighborhoodLabel ?? 'Your area'}
          </Text>
          <WeatherDrivingCard userLocation={userLocation} />
        </View>
      </View>

      {/*
        Chips are jump-links into the multi-row stack below — tap
        a chip to scroll to that category's row. The pre-Round-4
        focus mode (chip = single-category filter) was retired
        because users couldn't see other rows while drilled in;
        scroll-to-row keeps the full stack in view and lets chips
        function as a table-of-contents. "Browse" chip → scroll to
        top (the Trusted-by-your-community row).

        Wrapped in a solid-bg View so when this sheet's ScrollView
        pins this slot via stickyHeaderIndices during scroll, content
        scrolling underneath doesn't bleed through the chip row.
        onLayout stores the wrapper's height in stickyChipsHeightRef so
        chip-jump scrollTos land the target row's header just below the
        pinned chips, not behind them.
      */}
      <View
        style={styles.stickyChipsWrap}
        onLayout={(e) => {
          stickyChipsHeightRef.current = e.nativeEvent.layout.height;
        }}
      >
        <CategoryChips onJump={jumpToCategory} activeCategory={activeCategory} />
      </View>

      <Pressable
        onPress={() => {
          if (!reduceMotion) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          }
          onToggleCollapsed();
        }}
        accessibilityRole="button"
        accessibilityLabel={
          collapsed
            ? 'Show trusted-by-your-community recommendations'
            : 'Hide trusted-by-your-community recommendations'
        }
        accessibilityState={{ expanded: !collapsed }}
        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        style={({ pressed }) => [styles.sectionRow, pressed && pressedDim]}
        onLayout={(e) => recordRowY('trusted-community', e.nativeEvent.layout.y)}
      >
        <View style={styles.sectionTitleGroup}>
          <CommunitySignalGlyph24 width={24} height={24} />
          <Text style={styles.sectionTitle}>Trusted by your community</Text>
        </View>
        {collapsed ? (
          <CaretDown size={16} color={colors.black} weight="fill" />
        ) : (
          <CaretUp size={16} color={colors.black} weight="fill" />
        )}
      </Pressable>
      {!collapsed && (
        <>
          <TrustedByCommunityRow
            recommendations={trusted}
            loading={trustedLoading}
            reduceMotion={reduceMotion}
            onSelectRecommendation={onSelectRecommendation}
            onEmptyTap={onEmptyTap}
          />
          {/* Rows 2–7: Open Now + 5 per-category. Each row is
              header (glyph + title) + carousel body. Wrap each in
              a View with onLayout so its Y is captured for chip
              jump-links. */}
          {BROWSE_ROW_SPECS.slice(1).map((spec) => {
            const result = browseRowResults[spec.key];
            return (
              <View
                key={spec.key}
                onLayout={(e) => recordRowY(spec.key, e.nativeEvent.layout.y)}
              >
                <GenericBrowseRow
                  spec={spec}
                  recommendations={result?.recommendations ?? []}
                  loading={result?.loading ?? true}
                  reduceMotion={reduceMotion}
                  onSelectRecommendation={onSelectRecommendation}
                  onEmptyTap={onEmptyTap}
                />
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

/**
 * Maps a chip's recommendation category to the BROWSE_ROW_SPECS key
 * for the matching per-category row. Kept as a single-source-of-truth
 * helper so chip-tap routing and any future "highlight current row"
 * affordance share the same key derivation.
 */
function categoryToRowKey(category: RecommendationCategory): string {
  switch (category) {
    case 'black-owned':
      return 'cat-black-owned';
    case 'women-owned':
      return 'cat-women-owned';
    case 'lgbtq-welcoming':
      return 'cat-lgbtq';
    case 'restroom':
      return 'cat-restroom';
    case 'late-night-warm-welcome':
      return 'cat-late-night';
  }
}

// --- Multi-row browse stack (Round 4 PR B) ------------------------------

/**
 * Browse-mode row order per the Round 4 spec. Row 1 (Trusted) is
 * rendered separately above so its scroll-to-leading animation +
 * sheet-collapse Pressable header are preserved verbatim. Rows 2–7
 * render below via `GenericBrowseRow`. Keys are stable strings —
 * the batch hook uses them to track per-row state across reorders.
 */
const BROWSE_ROW_SPECS: BrowseRowSpec[] = [
  { key: 'trusted-community', kind: 'trusted-community' },
  { key: 'open-now', kind: 'open-now' },
  { key: 'cat-black-owned', kind: 'category', category: 'black-owned' },
  { key: 'cat-women-owned', kind: 'category', category: 'women-owned' },
  { key: 'cat-lgbtq', kind: 'category', category: 'lgbtq-welcoming' },
  { key: 'cat-restroom', kind: 'category', category: 'restroom' },
  { key: 'cat-late-night', kind: 'category', category: 'late-night-warm-welcome' },
];

/**
 * Per-row header glyph (24pt) + display title. Centralized here so the
 * row-render loop can dispatch off the spec without per-call branching.
 * The Trusted-by-community + per-category glyphs reuse the bespoke
 * illustrations from /report's marker family; Open Now uses Phosphor
 * `Clock` for the "right now" semantic (no bespoke asset needed —
 * utility row).
 */
function GenericBrowseRow({
  spec,
  recommendations,
  loading,
  reduceMotion,
  onSelectRecommendation,
  onEmptyTap,
}: {
  spec: BrowseRowSpec;
  recommendations: Recommendation[];
  loading: boolean;
  reduceMotion: boolean;
  onSelectRecommendation: (rec: Recommendation) => void;
  onEmptyTap?: () => void;
}) {
  const { glyph, title } = headerForRow(spec);
  const isLoading = loading && recommendations.length === 0;
  return (
    <View style={styles.browseRow}>
      <View style={styles.sectionRow}>
        <View style={styles.sectionTitleGroup}>
          {glyph}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
      </View>
      {isLoading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsRowContent}
          scrollEnabled={false}
          accessible
          accessibilityLabel={`Loading ${title} recommendations`}
        >
          <View style={styles.carouselLeadingSpacer} />
          {[0, 1, 2].map((i) => (
            <RecommendationCardSkeleton key={`${spec.key}-skel-${i}`} />
          ))}
          <View style={styles.carouselTrailingSpacer} />
        </ScrollView>
      ) : recommendations.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsRowContent}
          decelerationRate={reduceMotion ? 'normal' : 'fast'}
          snapToInterval={reduceMotion ? undefined : CARD_WIDTH + CARD_GAP}
          snapToAlignment="start"
          accessibilityRole={'list' as any}
          accessibilityLabel={title}
        >
          <View style={styles.carouselLeadingSpacer} />
          {recommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
              onPress={() => onSelectRecommendation(rec)}
              topline={spec.kind === 'open-now' ? 'closing-soon' : undefined}
            />
          ))}
          <View style={styles.carouselTrailingSpacer} />
        </ScrollView>
      ) : spec.kind === 'category' ? (
        // Per-category empty — the empty IS the contribution CTA.
        // Re-uses the existing per-category EmptyState component
        // (warm copy + bespoke glyph + tap-to-report).
        <View style={styles.cardWrap}>
          <EmptyState category={spec.category} onTap={onEmptyTap} />
        </View>
      ) : (
        // Open Now empty — render a thin placeholder line instead of
        // silently hiding the row. Silent-vanish made "nothing open"
        // visually identical to "feature broken"; a worded line keeps
        // the row's intent legible and tells the user the check ran.
        <View style={styles.cardWrap}>
          <Text style={styles.browseEmptyLine}>
            Nothing open right now within 10 mi.
          </Text>
        </View>
      )}
    </View>
  );
}

function headerForRow(spec: BrowseRowSpec): { glyph: React.ReactNode; title: string } {
  switch (spec.kind) {
    case 'trusted-community':
      // Unreachable — trusted-community renders above via
      // TrustedByCommunityRow with its own header. Defensive only.
      return {
        glyph: <CommunitySignalGlyph24 width={24} height={24} />,
        title: 'Trusted by your community',
      };
    case 'open-now':
      return {
        glyph: <Clock size={24} color={colors.wiltedgreen} weight="duotone" />,
        title: 'Open now',
      };
    case 'category':
      // Bare category label — no "Around Me:" prefix. With 5 category
      // rows in the stack, the prefix repeated 5× was clutter; the
      // chips above already convey what each row is, and the
      // neighborhood eyebrow at the top of the sheet covers the
      // geographic framing once for the whole stack.
      return {
        glyph: <CategoryGlyph24 category={spec.category} />,
        title: CATEGORY_LABELS[spec.category],
      };
  }
}

/**
 * 24pt version of the bespoke category illustrations — same files as
 * the 64pt empty-state cards (`PhotoPlaceholderGlyph`), rendered at
 * section-header scale. SVGs scale cleanly via `width`/`height`.
 */
function CategoryGlyph24({ category }: { category: RecommendationCategory }) {
  switch (category) {
    case 'black-owned':
      return <GlyphBlackOwned width={24} height={24} />;
    case 'women-owned':
      return <GlyphWomenOwned width={24} height={24} />;
    case 'lgbtq-welcoming':
      return <GlyphLgbtq width={24} height={24} />;
    case 'restroom':
      return <GlyphRestroom width={24} height={24} />;
    case 'late-night-warm-welcome':
      return <GlyphLateNight width={24} height={24} />;
  }
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
              topline="curator-attribution"
            />
          </Animated.View>
        ) : (
          <RecommendationCard
            key={rec.id}
            topline="curator-attribution"
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

/**
 * Chip row — a scroll-spy table of contents. Each chip jumps to its row
 * in the multi-row stack below; `activeCategory` (driven by the sheet's
 * scroll position) highlights the chip for the section currently pinned
 * under the strip, so the row doubles as a "you are here" indicator
 * (Apple Maps category-row pattern). `null` activates the "Browse" chip
 * (the top region: Trusted-by-your-community + Open Now, which have no
 * chips of their own). A static select-on-tap was avoided deliberately —
 * it would go stale the moment the user scrolls past the tapped section.
 */
function CategoryChips({
  onJump,
  activeCategory,
}: {
  onJump: (next: RecommendationCategory | null) => void;
  activeCategory: RecommendationCategory | null;
}) {
  const browseActive = activeCategory === null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsRow}
    >
      <Pressable
        onPress={() => onJump(null)}
        accessibilityRole="button"
        accessibilityLabel="Browse"
        accessibilityHint="Scrolls to the top of the recommendations"
        accessibilityState={{ selected: browseActive }}
        style={({ pressed }) => [
          styles.chip,
          browseActive && styles.chipActive,
          pressed && pressedDim,
        ]}
      >
        <Text style={[styles.chipText, browseActive && styles.chipTextActive]}>
          Browse
        </Text>
      </Pressable>
      {CATEGORY_ORDER.map((cat) => {
        const isActive = activeCategory === cat;
        return (
          <Pressable
            key={cat}
            onPress={() => onJump(cat)}
            accessibilityRole="button"
            accessibilityLabel={CATEGORY_LABELS[cat]}
            accessibilityHint="Scrolls to that section"
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => [
              styles.chip,
              isActive && styles.chipActive,
              pressed && pressedDim,
            ]}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
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
        <WeatherGlyph width={16} height={16} />
        <Text style={styles.weatherText}>{temp}</Text>
      </View>
      <View style={styles.weatherRow}>
        <DrivingGlyph width={16} height={16} />
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
      return <GlyphBlackOwned width={64} height={64} />;
    case 'women-owned':
      return <GlyphWomenOwned width={64} height={64} />;
    case 'lgbtq-welcoming':
      return <GlyphLgbtq width={64} height={64} />;
    case 'restroom':
      return <GlyphRestroom width={64} height={64} />;
    case 'late-night-warm-welcome':
      return <GlyphLateNight width={64} height={64} />;
  }
}

/**
 * Per-row emphasis variant for the card's photo-top overlay. The
 * standard card already surfaces distance + open-state + hours in
 * the body tag rows, but on the Open Now and Trusted-by-Community
 * rows the row's *reason for existing* is one of those signals —
 * surfacing it as a photo-top pill (mirroring the bottom `quoteCallout`)
 * gives the row a visual differentiator without forking the card.
 *
 *  - `closing-soon`: Clock + `hoursLabel` ("Open until midnight").
 *    The Open Now row's contract is "right now"; the time horizon
 *    is the row's load-bearing signal, not the boolean isOpen tag.
 *  - `curator-attribution`: avatar circle + "{curator}'s pick".
 *    The Trusted-by-Community row's contract is "someone vouched";
 *    the WHO is the row's load-bearing signal, not the rating.
 *  - undefined (per-category rows): no topline. The category context
 *    is already in the row header, so adding a topline would be noise.
 */
type CardTopline = 'closing-soon' | 'curator-attribution';

type ToplinePayload =
  | { kind: 'closing-soon'; text: string; a11yPrefix: string }
  // `initial` is optional — community-source entries with no curator
  // name skip the avatar and render text-only ("Community pick"). A
  // placeholder dot/glyph read as a typo in code review, and "Community
  // pick" already carries the meaning on its own.
  | { kind: 'curator-attribution'; initial?: string; text: string; a11yPrefix: string };

function resolveToplinePayload(
  variant: CardTopline | undefined,
  r: Recommendation,
): ToplinePayload | null {
  if (!variant) return null;
  if (variant === 'closing-soon') {
    // Open Now's row contract is "right now" — the hoursLabel
    // ("Open until midnight", "Closes 4 PM") carries the time
    // horizon. Skip silently if the entry never set one.
    if (!r.hoursLabel) return null;
    return {
      kind: 'closing-soon',
      text: r.hoursLabel,
      a11yPrefix: r.hoursLabel,
    };
  }
  // curator-attribution: WHO vouched is the row's load-bearing signal.
  // Community-source entries don't carry a curator name; fall back to
  // a text-only "Community pick" so the slot doesn't collapse mid-row.
  const name = r.curatorName;
  if (!name) {
    if (r.source !== 'community') return null;
    return {
      kind: 'curator-attribution',
      text: 'Community pick',
      a11yPrefix: 'Community pick',
    };
  }
  return {
    kind: 'curator-attribution',
    initial: name.charAt(0).toUpperCase(),
    text: `${name}'s pick`,
    a11yPrefix: `${name}'s pick`,
  };
}

function RecommendationCard({
  recommendation,
  onPress,
  topline,
}: {
  recommendation: Recommendation;
  onPress: () => void;
  topline?: CardTopline;
}) {
  const r = recommendation;
  const quoteText = r.curatorQuote ?? r.reportDetail;
  // When the rec is a multi-vouch same-place group (Trusted row only),
  // the category pill shows the combined vouch label ("Black-owned ·
  // Felt welcome") instead of the single categoryLabel. Capped at 2
  // facets with a "+N" overflow so the pill never wraps; numberOfLines
  // on the Text is the backstop. facets is undefined for every other
  // card, so this is a no-op outside the Trusted row.
  const FACET_DISPLAY_CAP = 2;
  const categoryPillText =
    r.facets && r.facets.length > 0
      ? r.facets.slice(0, FACET_DISPLAY_CAP).join(' · ') +
        (r.facets.length > FACET_DISPLAY_CAP
          ? ` +${r.facets.length - FACET_DISPLAY_CAP}`
          : '')
      : r.categoryLabel;
  // Resolve the topline variant against the entry's actual data —
  // if the variant's payload is missing (e.g. closing-soon on an
  // entry with no `hoursLabel`), skip the topline rather than
  // render an empty pill.
  const toplinePayload = resolveToplinePayload(topline, r);
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
    // Topline reads first when present — it's also visually first.
    toplinePayload?.a11yPrefix,
    r.name,
    categoryPillText,
    r.rating != null
      ? `${r.rating.toFixed(1)} stars${r.reviewCount != null ? `, ${r.reviewCount} reviews` : ''}`
      : null,
    r.communityTrusted ? 'Community pick' : null,
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
        {toplinePayload ? (
          <View style={styles.toplineCallout}>
            {toplinePayload.kind === 'closing-soon' ? (
              <>
                {/* 14pt duotone matches the topline's tighter pill scale
                    (vs the bottom quote's 16pt fill ChatCircle in the
                    chunkier `quoteCallout`). Different pill, different
                    family weight — both stay in the green ramp. */}
                <Clock size={14} color={colors.wiltedgreen} weight="duotone" />
                <Text style={styles.toplineText} numberOfLines={1}>
                  {toplinePayload.text}
                </Text>
              </>
            ) : (
              <>
                {toplinePayload.initial ? (
                  <View style={styles.toplineAvatar}>
                    <Text style={styles.toplineAvatarText}>{toplinePayload.initial}</Text>
                  </View>
                ) : null}
                <Text style={styles.toplineText} numberOfLines={1}>
                  {toplinePayload.text}
                </Text>
              </>
            )}
          </View>
        ) : null}
        {quoteText ? (
          <View style={styles.quoteCallout}>
            <ChatCircle size={16} color={colors.wiltedgreen} weight="fill" />
            {/*
              Dynamic Type wrap: the curator quote is multi-line
              editorial copy — the load-bearing differentiator on the
              card. `relaxedLineHeight` opens line spacing to 1.6×
              fontSize for the longest-read text on the card (4 lines
              max); `dynamicType` then scales both fontSize and
              line-height in proportion when the user has bumped iOS
              Dynamic Type. The numberOfLines={4} cap absorbs overflow
              at large scales gracefully. WCAG 1.4.4 + 1.4.12.
            */}
            <Text
              style={[
                styles.quoteText,
                dynamicType(relaxedLineHeight(typography.footnoteRegular)),
              ]}
              numberOfLines={4}
            >
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
            <Text style={styles.tagText} numberOfLines={1}>{categoryPillText}</Text>
          </View>
          {/* Cross-row enrichment badge: this non-community card's place
              is also a community report in another browse row. Reuses the
              openPill's affirmative-green pill (fadedgreen / burntgreen) —
              same visual token, no parallel style. Set by enrichAcrossRows. */}
          {r.communityTrusted ? (
            <View style={styles.openPill}>
              <Text style={styles.openText}>Community pick</Text>
            </View>
          ) : null}
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
        {/* W1 of PR E review: skeleton title height paired with H7's
            cardTitle drop. Earlier height: 28 matched title1Emphasized's
            lineHeight (34) approximately; now title3Emphasized has
            lineHeight 25, so the skeleton title sized 25 keeps the
            "no reflow on content land" guarantee the skeleton docstring
            promises. */}
        <View style={[styles.skelLine, { width: '70%', height: 25 }]} />
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
  // Vertical scroller for the whole sheet (browse mode). `flex: 1` is
  // load-bearing: it bounds the scroller to the space available inside
  // the sheet's capped maxHeight so the inner cards scroll internally
  // rather than overflowing past the sheet's bottom edge. Splitting
  // `style` (the viewport) from `contentContainerStyle` (the scrolled
  // content) is the RN-canonical pattern — mixing them collapses the
  // flex constraint.
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    flexGrow: 1,
    // Vertical rhythm between the stacked sections (headers / chips /
    // section header / rows). `gap` here replaces the old wrapping
    // `content` View that couldn't coexist with stickyHeaderIndices.
    gap: 16,
    // 40pt = 24pt shadow clearance for the last card + 16pt of bottom
    // breathing room (what the old wrapper View provided).
    paddingBottom: 40,
  },
  // Sticky chip wrapper — solid white bg so when the ScrollView pins
  // this slot via stickyHeaderIndices during vertical scroll,
  // row content scrolling underneath doesn't show through the chip
  // strip. Vertical padding gives the pinned-state a breathing room
  // band; horizontal padding is set on CategoryChips' own ScrollView
  // contentContainerStyle so the leftmost chip aligns to the sheet's
  // 16pt gutter without double-counting.
  stickyChipsWrap: {
    backgroundColor: colors.white,
    paddingVertical: 8,
  },
  headers: {
    gap: 8,
    paddingHorizontal: 16,
  },
  eyebrow: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.mutedTertiary,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  neighborhood: {
    ...dynamicType(typography.bodyEmphasized),
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
    ...dynamicType(typography.footnoteRegular),
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
  chipText: {
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
  },
  // Scroll-spy active chip — fadedgreen fill + burntgreen text, the
  // app's existing affirmative-green register (same as the "Open" pill).
  // Brand green, NOT a reserved safety color. Only the fill + text COLOR
  // change (no weight bump) so the chip can't change width and reflow
  // the row as the active chip moves during scroll.
  chipActive: {
    backgroundColor: colors.fadedgreen,
  },
  chipTextActive: {
    color: colors.burntgreen,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    // justifyContent: space-between via flex:1 on the inner title
    // group below — keeps the chevron right-anchored when present
    // and lets the title-group take the remaining width.
    justifyContent: 'space-between',
  },
  // Leading-glyph + title combo for multi-row section headers.
  // Per-row 24pt glyph (community-signal, Clock, or bespoke category
  // illustration) reads as the row's visual identity; title sits to
  // its right. flex:1 so a long title can wrap if needed before the
  // chevron edge (Row 1 only).
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionTitle: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.black,
    flexShrink: 1,
  },
  // One row block inside the multi-row stack — gap:8 between header
  // and carousel, plus the outer browse-content gap handles spacing
  // between rows.
  browseRow: {
    gap: 8,
  },
  browseEmptyLine: {
    ...typography.footnoteRegular,
    color: colors.mutedTertiary,
    // H11: paddingVertical 4 → 12 so the Open Now empty line gets
    // minimum row breathing room. Earlier 4pt left it flush against
    // the section header above. Matches the cadence of other row
    // empty states (which use padding: 24 via the empty component).
    paddingVertical: 12,
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
  // Top-of-photo emphasis pill. Mirrors `quoteCallout`'s white-pill +
  // e1 shadow visual language but pinned to the top-left only (not
  // edge-to-edge — the topline is a one-liner badge, the quote is
  // narrative copy that wants the full width). `alignSelf: 'flex-start'`
  // keeps the pill tight to its content; `maxWidth` prevents a long
  // hoursLabel from running into the right edge of the photo.
  toplineCallout: {
    position: 'absolute',
    top: 8,
    left: 8,
    maxWidth: '85%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.white,
    borderRadius: 8,
    ...shadows.e1,
  },
  toplineText: {
    ...dynamicType(typography.footnoteEmphasized),
    color: colors.black,
    flexShrink: 1,
  },
  // 20pt avatar circle for curator-attribution variant. fadedgreen
  // backing matches the openPill family — keeps "community-trust"
  // signaling in the green ramp rather than introducing a fresh
  // surface color. Initial sits in burntgreen for the AA contrast
  // boost over freshgreen-on-fadedgreen (which fails).
  toplineAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.fadedgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toplineAvatarText: {
    ...typography.caption1Emphasized,
    color: colors.burntgreen,
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
    // H7: dropped from title1Emphasized (28pt) → title3Emphasized (20pt).
    // title1Emphasized is the guidance-screen register per .cursorrules
    // ("Guidance/instruction screens: Title1 Emphasized") — overkill on
    // a 280pt carousel card where it left no weight for the tag rows.
    // Apple Maps / Google Maps place cards sit at 15-17pt semibold.
    // PROJECT-B: dynamicType so the title scales with iOS Larger Text
    // (WCAG 1.4.4). Replaced the earlier adjustsFontSizeToFit /
    // minimumFontScale={0.85} primitive on the <Text> — that shrinks
    // under AX5 pressure (the opposite of the user's intent) instead
    // of growing. numberOfLines={2} stays to cap overflow.
    ...dynamicType(typography.title3Emphasized),
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
    ...dynamicType(typography.footnoteEmphasized),
    // freshgreen per v2 Figma (1114:9047) — brand-exception accent,
    // same family as the freshgreen Go button and underlined
    // destination link in route mode (.cursorrules: "primary CTA,
    // in-flow links"). Contrast on fillsPrimary is ~2.5:1, below
    // AA, but the star icon to the left carries the meaning and
    // the "(N reviews)" context resolves any ambiguity. Documented
    // as a brand exception, not an oversight.
    color: colors.freshgreen,
    // H8: tabular-nums on the rating number ("4.2", "3.8") so carousel
    // snap doesn't reflow card layouts due to proportional digit widths.
    // Same finding class as the en-route ETA + distance F7 fix.
    fontVariant: ['tabular-nums'],
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
    // H8: tabular-nums for the distance tag ("0.3 mi", "1.2 mi") +
    // any numeric tag content. No-op on alpha-only tags (categoryLabel,
    // hoursLabel) per the CSS font-variant-numeric spec.
    fontVariant: ['tabular-nums'],
  },
  // Affirmative-green pill — TWO consumers, both in the safety-green
  // register: (1) "Open" hours badge below the rating row; (2) the
  // "Community pick" badge in the rating row (cross-row enrichment,
  // 44202e0). One visual token, two affirmative semantics — if a
  // future change needs them to diverge, fork into separate styles
  // first.
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
