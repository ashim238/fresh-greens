import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
// Phosphor deep-imports bypass the package's barrel index — see
// app/trusted-contact-setup.tsx for the longer note + tsconfig
// `paths` mapping that keeps TypeScript happy.
import { MapPinArea } from 'phosphor-react-native/src/icons/MapPinArea';
import { FileText } from 'phosphor-react-native/src/icons/FileText';
import { Shield } from 'phosphor-react-native/src/icons/Shield';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useReduceMotion } from '../hooks/useReduceMotion';

import AvatarPng from '../assets/illustrations/avatar.png';
import FuelIcon from '../assets/illustrations/fuel.svg';

import { PageControl } from '../components/PageControl';
import { useFuelProfile } from '../hooks/useFuelProfile';
import { usePreferences } from '../hooks/usePreferences';
import { useRegularDestinations } from '../hooks/useRegularDestinations';
import { useSavedPlaces } from '../hooks/useSavedPlaces';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { useUser } from '../hooks/useUser';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { typography } from '../theme/typography';

/**
 * Menu Page — pushed from /home's avatar (car) button.
 *
 * Major v2 redesign per Figma `1120:7079`. Register flip from the
 * previous wiltedgreen-on-dark Waze-flavored layout to a white
 * background, freshgreen-accented light layout.
 *
 * Layout:
 *
 *   ‹                              ← back chevron only (no page title)
 *
 *   ⬤  Hey there,                  ← 80pt freshgreen avatar +
 *       First name, Last name        Title3 greeting + Title2 name
 *
 *   ─────────── divider ───────────
 *
 *   📍 Zone Preferences         ›  ← push to /zone-preferences
 *                                     (was inline-expanded accordion;
 *                                     user-flagged 2026-06-01 — the
 *                                     accordion's discoverability was
 *                                     weak and the toggle list grew
 *                                     past a row's vertical budget)
 *
 *   🛡  Safety                   ›
 *
 *   ┌──── Fuel ────┐                    ← carousel (single tile at v1)
 *
 *           Sign out                ← bottom-pinned (Figma redesign
 *                                    didn't show this; preserved
 *                                    until the auth flow re-anchors
 *                                    sign-out elsewhere)
 *
 * Notable design changes from v1:
 *  - Background flip from wiltedgreen → white. All text colors flip
 *    accordingly. Status bar style flips from light → dark.
 *  - Profile avatar grows from 48pt burntgreen → 80pt freshgreen,
 *    becoming the visual anchor of the page.
 *  - Settings rows drop the white-circle icon tile — icon is now
 *    inline at 24pt without a wrapper. Closer to native iOS Settings
 *    than the Waze-style chip register of v1.
 *  - Zone Preferences (renamed from "Zone Settings") now pushes to a
 *    dedicated /zone-preferences page, matching /safety-settings'
 *    register. v1 used an accordion-on-tap, v1.5 moved to inline-
 *    expanded; user feedback 2026-06-01 was that the accordion still
 *    hid the controls behind a tap (compared to the chevron-and-push
 *    pattern of the other rows). The dedicated page also leaves room
 *    for the toggle list to grow without warping the menu row.
 *  - Quick-tile carousel: Notifications tile retired, Connect calendar
 *    added. Tile visual register changes from "white card with shadow"
 *    to "white card with wiltedgreen border" — quieter elevation.
 *
 * Avatar illustration: Figma uses a custom illustrated person/face on
 * the freshgreen circle. Until that SVG is exported, we render a
 * Phosphor `User` duotone glyph as a placeholder (queued for the
 * next bulk-SVG export pass).
 *
 * Route: /menu
 */

type QuickTile = {
  id: string;
  label: string;
  subtitle: string;
  renderIcon: () => React.ReactNode;
};

type QuickTileEntry = QuickTile & { href: string };

const QUICK_TILES: QuickTileEntry[] = [
  {
    id: 'fuel',
    label: 'Fuel',
    // Verbatim from Figma 1120:7079 carousel tile copy.
    subtitle: 'Add your fuel level for refuel reminders.',
    renderIcon: () => <FuelIcon width={32} height={32} />,
    href: '/fuel',
  },
  // Note: the Calendar/"Connect calendar" tile from Figma 1120:7079 was
  // intentionally cut at v1 — the underlying feature doesn't exist and
  // showing a coming-soon tile would lie about state. Tracked in
  // docs/next-session.md under New features.
];

export default function Menu() {
  const router = useRouter();
  const { user, signOut } = useUser();
  const { clearContact } = useTrustedContact();
  const { clearAll: clearSavedPlaces } = useSavedPlaces();
  const { clearAll: clearRegularDestinations } = useRegularDestinations();
  const { clearAll: clearPreferences } = usePreferences();
  const { clearAll: clearFuelProfile } = useFuelProfile();
  const { width: screenWidth } = useWindowDimensions();
  const [signingOut, setSigningOut] = useState(false);
  const [activeQuickIndex, setActiveQuickIndex] = useState(0);
  const reduceMotion = useReduceMotion();

  // Carousel sizing — same pattern as v1 (each tile ~80% of screen
  // width, peek of next tile at the right edge).
  const TILE_GAP = 16;
  const TILE_WIDTH = screenWidth - 96;
  const SNAP_INTERVAL = TILE_WIDTH + TILE_GAP;

  // Greeting copy — Figma shows "Hey there," + "First name, Last name"
  // as a two-line stack. Fall-through ladder (user-flagged 2026-06-01:
  // bare "First name, Last name" placeholder reads like an unfilled form
  // field — name should reflect the actual sign-in):
  //   1. user.displayName  (Apple Sign-In full name)
  //   2. email local-part  (e.g. ashim238 from ashim238@newschool.edu)
  //   3. "friend"          (no identity attached — keeps the row's
  //                         2-line rhythm rather than breaking layout)
  const displayName =
    user?.displayName ??
    user?.email?.split('@')[0] ??
    'friend';

  function handleQuickScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL);
    setActiveQuickIndex(index);
  }

  function handleBack() {
    router.back();
  }

  function handleZonePreferences() {
    router.push('/zone-preferences');
  }

  function handleSafety() {
    router.push('/safety-settings');
  }

  function handleLegal() {
    router.push('/legal');
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // Clear identity-attached state before the sign-out confirmation
      // screen takes over — same hygiene as v1.
      await Promise.all([
        signOut(),
        clearContact(),
        clearSavedPlaces(),
        clearRegularDestinations(),
        clearPreferences(),
        clearFuelProfile(),
      ]);
      router.replace('/sign-out');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
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
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile row + divider */}
          <View
            style={styles.profileRow}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Hey there, ${displayName}`}
          >
            <Image
              source={AvatarPng}
              style={styles.profileAvatar}
              resizeMode="cover"
              accessible={false}
              accessibilityIgnoresInvertColors
            />
            <View style={styles.profileTextStack}>
              <Text style={styles.profileGreeting}>Hey there,</Text>
              {/*
                M1: long names (e.g. real Firebase displayNames like
                "Bartholomew Huntington-Clarke") would wrap onto a
                second line and push the profile row taller, breaking
                the gap rhythm with the divider below. The avatar is
                the visual anchor; a tail-ellipsized name preserves
                identity without warping the layout.
              */}
              <Text
                style={styles.profileName}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {displayName}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Settings rows — three peers, each pushing to its own
              dedicated page. v1 mixed an accordion-style Zone Prefs
              row with chevron-push rows for Safety + Legal; the
              inconsistency cost discoverability. Now all three share
              the same chevron-push affordance. */}
          <View style={styles.rowList}>
            <SettingsRow
              icon={
                <MapPinArea size={24} color={colors.black} weight="duotone" />
              }
              label="Zone Preferences"
              onPress={handleZonePreferences}
            />

            <SettingsRow
              icon={<Shield size={24} color={colors.black} weight="duotone" />}
              label="Safety"
              onPress={handleSafety}
            />

            <SettingsRow
              icon={<FileText size={24} color={colors.black} weight="duotone" />}
              label="Privacy & Terms"
              onPress={handleLegal}
            />
          </View>
        </ScrollView>

        {/* Quick-settings carousel + page control */}
        <View style={styles.quickWrap}>
          <FlatList
            data={QUICK_TILES}
            horizontal
            showsHorizontalScrollIndicator={false}
            // reduceMotion: drop the snap + fast deceleration so the
            // carousel scrolls inertially without the vestibular pull
            // of the snap animation. Pairs with the HomeBrowseSheet
            // pattern so /menu and /home share Reduce-Motion behavior.
            decelerationRate={reduceMotion ? 'normal' : 'fast'}
            snapToInterval={reduceMotion ? undefined : SNAP_INTERVAL}
            snapToAlignment="start"
            contentContainerStyle={styles.quickContent}
            ItemSeparatorComponent={() => <View style={{ width: TILE_GAP }} />}
            onMomentumScrollEnd={handleQuickScrollEnd}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.tileCard,
                  { width: TILE_WIDTH },
                  pressed && pressedDim,
                ]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  router.push(item.href as never);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}. ${item.subtitle}`}
              >
                <View style={styles.tileIcon}>{item.renderIcon()}</View>
                <Text style={styles.tileTitle}>{item.label}</Text>
                <Text style={styles.tileSubtitle}>{item.subtitle}</Text>
              </Pressable>
            )}
          />
          <PageControl
            total={QUICK_TILES.length}
            activeIndex={activeQuickIndex}
            // M7: PageControl's default dot color is white (built for
            // onboarding's dark backgrounds — see §2.12). /menu has a
            // white surface, so the default rendered the dots
            // invisibly. wiltedgreen pairs with the rest of /menu's
            // brand accents (the Sign-Out link, freshgreen switch)
            // without competing with content above.
            color={colors.wiltedgreen}
          />
        </View>

        {/*
          Sign out — preserved from v1 even though Figma `1120:7079`
          doesn't show it. (The Page Control dots above belong to the
          quick-tile carousel, not to a 2nd menu page — bottom-pinned
          is the intended location.) Routes to /sign-out for the
          confirmation + "Log back in" flow after clearing identity
          state in the handler above.
        */}
        <View style={styles.signOutWrap}>
          <Pressable
            onPress={handleSignOut}
            disabled={signingOut}
            // M9: 44pt floor lives on the Pressable itself (not just
            // the wrapper) so the actual hit region matches the
            // visible footprint — the wrapper alone would have left
            // the Pressable text-sized inside a centered void.
            // hitSlop dropped because the visible Pressable IS now
            // the tap target. §4.3: "what you see is what you tap."
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            accessibilityState={{ busy: signingOut, disabled: signingOut }}
            style={({ pressed }) => [
              styles.signOutPressable,
              pressed && !signingOut && pressedDim,
            ]}
          >
            {signingOut ? (
              <ActivityIndicator color={colors.labelTertiary} />
            ) : (
              <Text style={styles.signOutText}>Sign out</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

// --- Sub-components ------------------------------------------------------

/**
 * Single push-to-route settings row.
 */
function SettingsRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && pressedDim]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.rowIconWrap}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      <CaretRight size={16} color={colors.labelTertiary} weight="regular" />
    </Pressable>
  );
}

// --- Styles --------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  // 24pt horizontal matches Figma `1120:7341` (px-24 py-56). 32pt gap
  // between profile + divider + rows is the per-Figma vertical rhythm.
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 32,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profileAvatar: {
    // 80pt circular slot per Figma 1120:7476. Defensive fill +
    // borderRadius ensure a visible circle even when the PNG fails
    // to load or has a transparent background — the previous
    // setup (no fill, no radius) made a missing image read as a
    // blank space rather than a placeholder. Image fills via
    // resizeMode='cover' at the JSX site.
    //
    // Future: real-photo support is a v2 feature gated on auth
    // (expo-image-picker for camera roll; persisted path via the
    // user adapter). Tracked in docs/next-session.md under
    // "Architecture / data v2."
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.freshgreen,
    overflow: 'hidden',
  },
  profileTextStack: {
    flex: 1,
    gap: 8,
  },
  profileGreeting: {
    // M2: was title3Emphasized (20pt/600). At only 2pt smaller than
    // profileName's title2Emphasized (22pt/700), the greeting and the
    // name read as near-peers — the weight delta is the only real
    // differentiator and 600→700 is too subtle to do hierarchy work.
    // Dropping to title3Regular (20pt/400) lets the regular-vs-bold
    // weight contrast carry the "atmospheric label / identity anchor"
    // distinction the layout intends.
    ...dynamicType(typography.title3Regular),
    color: colors.black,
  },
  profileName: {
    ...dynamicType(typography.title2Emphasized),
    color: colors.black,
  },
  divider: {
    height: 1,
    backgroundColor: colors.separatorSubtle,
  },
  rowList: {
    gap: 16,
  },
  // Inline icon (no white-circle wrapper) + label + chevron. Generous
  // 24pt gap-between-icon-and-label matches Figma. py-4 + py-12 paddings
  // come from Figma's `px-12 py-4` Dropdown frame container.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minHeight: 44, // HIG tap target
  },
  rowIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.black,
    flex: 1,
  },
  // Zone Preferences container — wraps the header row + the inline
  // toggle in one vertical stack so they read as one component.
  // Carousel — pinned outside the ScrollView, sits above Sign out.
  quickWrap: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  quickContent: {
    paddingHorizontal: 24,
  },
  // Per Figma 1121:6590 / 1121:6602: white bg + 1pt wiltedgreen border
  // + 12pt rounded corners + 16pt padding. NO shadow (the border
  // carries the elevation visually, vs v1's shadow approach).
  tileCard: {
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.wiltedgreen,
  },
  tileIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.black,
  },
  tileSubtitle: {
    // M8: was footnoteEmphasized + underline. Underline on colored
    // text is the canonical link affordance (cf. signOutText below,
    // Button fill='transparent' in §2.2) — applying it to non-link
    // copy inside an already-tappable card created a false-link
    // signal AND killed the within-card hierarchy (weight 600 title
    // vs weight 600 subtitle read as peers). Regular weight without
    // underline matches the supporting-copy register used elsewhere
    // (e.g. zoneInnerLabel).
    ...dynamicType(relaxedLineHeight(typography.footnoteRegular)),
    color: colors.wiltedgreen,
  },
  signOutWrap: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  signOutPressable: {
    // M9: the 44pt floor lives on the Pressable itself so the visible
    // surface IS the tap surface — putting it on the wrapper alone
    // would have left the Pressable text-sized (~20pt) inside a
    // centered void, which is exactly what the audit caught as a
    // regression against §4.3. paddingHorizontal extends the horizontal
    // hit region past the text glyph edges. Works in both the text
    // and ActivityIndicator (busy) states without per-state styling.
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  signOutText: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.labelTertiary,
    // Underline reads as the canonical destructive-link signal —
    // matches the pattern Button uses on fill="transparent" labels.
    // Without it the row reads as another rowLabel item.
    textDecorationLine: 'underline',
  },
});
