import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
// Phosphor deep-imports bypass the package's barrel index — see
// app/trusted-contact-setup.tsx for the longer note + tsconfig
// `paths` mapping that keeps TypeScript happy.
import { Calendar } from 'phosphor-react-native/src/icons/Calendar';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretUp } from 'phosphor-react-native/src/icons/CaretUp';
import { GearSix } from 'phosphor-react-native/src/icons/GearSix';
import { MapPinArea } from 'phosphor-react-native/src/icons/MapPinArea';
import { PaintRoller } from 'phosphor-react-native/src/icons/PaintRoller';
import { Shield } from 'phosphor-react-native/src/icons/Shield';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  LayoutAnimation,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useReduceMotion } from '../hooks/useReduceMotion';

// SVG asset imports — fuel.svg already exists; calendar tile uses the
// Phosphor Calendar duotone for v1 (queue a custom illustrated SVG
// for a future bulk-export pass to match the Fuel tile's register).
import AvatarPng from '../assets/illustrations/avatar.png';
import FuelIcon from '../assets/illustrations/fuel.svg';

import { PageControl } from '../components/PageControl';
import { usePreferences } from '../hooks/usePreferences';
import { useRegularDestinations } from '../hooks/useRegularDestinations';
import { useSavedPlaces } from '../hooks/useSavedPlaces';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { useUser } from '../hooks/useUser';
import { colors } from '../theme/colors';
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
 *   📍 Zone Preferences         ⌄  ← inline-expanded dropdown
 *      👁 Show zones overlay   [⊙]    (toggle always visible, not
 *                                     hidden behind a tap)
 *
 *   🛡  Safety                   ›
 *   ⚙  Settings                  ›  inert (TODO)
 *   📅 Schedule a drive          ›  inert (TODO)
 *   🎨 Theme                     ›  inert (TODO)
 *
 *   ┌──── Fuel ────┐ ┌── Calendar ──┐    ← carousel, page-control dots
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
 *  - Zone Preferences (renamed from "Zone Settings") moves from an
 *    accordion-on-tap to an inline-expanded layout — toggle is always
 *    visible. Removes a hidden-affordance discoverability concern.
 *  - Quick-tile carousel: Notifications tile retired, Connect calendar
 *    added. Tile visual register changes from "white card with shadow"
 *    to "white card with wiltedgreen border" — quieter elevation.
 *
 * Avatar illustration: Figma uses a custom illustrated person/face on
 * the freshgreen circle. Until that SVG is exported, we render a
 * Phosphor `User` duotone glyph as a placeholder (queued for the
 * next bulk-SVG export pass).
 *
 * Inert rows still render at 50% opacity with no chevron — same
 * "planned but not active" affordance as v1.
 *
 * Route: /menu
 */

type QuickTile = {
  id: string;
  label: string;
  subtitle: string;
  renderIcon: () => React.ReactNode;
};

const QUICK_TILES: QuickTile[] = [
  {
    id: 'fuel',
    label: 'Fuel',
    // Verbatim from Figma 1120:7079 carousel tile copy.
    subtitle: 'Add your fuel level for refuel reminders.',
    renderIcon: () => <FuelIcon width={32} height={32} />,
  },
  {
    id: 'calendar',
    label: 'Connect calendar',
    // Verbatim from Figma 1120:7079.
    subtitle: 'Get to events safely and on time.',
    renderIcon: () => (
      <Calendar size={32} color={colors.wiltedgreen} weight="duotone" />
    ),
  },
];

export default function Menu() {
  const router = useRouter();
  const { user, signOut } = useUser();
  const { clearContact } = useTrustedContact();
  const { clearAll: clearSavedPlaces } = useSavedPlaces();
  const { clearAll: clearRegularDestinations } = useRegularDestinations();
  const { preferences, setShowZones, setPreference, clearAll: clearPreferences } =
    usePreferences();
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
  // as a two-line stack. When the user has a real displayName, render
  // that as the second line; otherwise fall back to the Figma
  // placeholder so the page still reads as identity-anchored.
  const displayName = user?.displayName ?? 'First name, Last name';

  function handleQuickScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL);
    setActiveQuickIndex(index);
  }

  function handleBack() {
    router.back();
  }

  function handleSafety() {
    router.push('/safety-settings');
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
            <Ionicons name="chevron-back" size={28} color={colors.black} />
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

          {/* Settings rows */}
          <View style={styles.rowList}>
            <ZonePreferencesRow
              showZones={preferences?.showZones ?? false}
              onToggle={setShowZones}
              flagPolice={preferences?.flagPolice ?? true}
              flagLowLight={preferences?.flagLowLight ?? true}
              flagCommunityReports={preferences?.flagCommunityReports ?? true}
              onFlagToggle={(key, value) => setPreference(key, value)}
            />

            <SettingsRow
              icon={<Shield size={24} color={colors.black} weight="duotone" />}
              label="Safety"
              onPress={handleSafety}
            />

            <SettingsRow
              icon={<GearSix size={24} color={colors.black} weight="duotone" />}
              label="Settings"
              inert
            />

            <SettingsRow
              icon={<Calendar size={24} color={colors.black} weight="duotone" />}
              label="Schedule a drive"
              inert
            />

            <SettingsRow
              icon={<PaintRoller size={24} color={colors.black} weight="duotone" />}
              label="Theme"
              inert
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
                // Coming-soon tiles. Gives a haptic + Alert so the
                // user gets feedback instead of tapping into dead
                // pixels; half-opacity surfaces the disabled state
                // visually (matches the /safety inert-tile pattern).
                style={({ pressed }) => [
                  styles.tileCard,
                  { width: TILE_WIDTH },
                  styles.tileCardComingSoon,
                  pressed && pressedDim,
                ]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  Alert.alert(
                    item.label,
                    `${item.subtitle} — this tile lands in a future update.`,
                    [{ text: 'OK' }],
                  );
                }}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}. ${item.subtitle}`}
                accessibilityHint="Coming soon"
                accessibilityState={{ disabled: true }}
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
 * Zone Preferences row — collapsible accordion with a single inline
 * toggle child.
 *
 * Tap the header to expand/collapse; the chevron flips between
 * CaretDown (collapsed, "tap to open") and CaretUp (expanded, "tap
 * to close"). LayoutAnimation makes the height transition smooth.
 *
 * Starts collapsed because the toggle's default-off state means the
 * row's information value is low at first paint; the user opens it
 * intentionally to flip the preference.
 */
function ZonePreferencesRow({
  showZones,
  onToggle,
  flagPolice,
  flagLowLight,
  flagCommunityReports,
  onFlagToggle,
}: {
  showZones: boolean;
  onToggle: (next: boolean) => void;
  flagPolice: boolean;
  flagLowLight: boolean;
  flagCommunityReports: boolean;
  onFlagToggle: (
    key: 'flagPolice' | 'flagLowLight' | 'flagCommunityReports',
    value: boolean,
  ) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // M4: every other animation on this screen (the Quick Tiles carousel
  // snap at line ~278) is gated on useReduceMotion per design-system.md
  // §4.5; the accordion was missed. A user with Reduce Motion enabled
  // was still getting the easeInEaseOut expand animation they opted
  // out of. Calling the hook locally instead of threading a prop down
  // keeps the surface API of ZonePreferencesRow unchanged.
  const reduceMotion = useReduceMotion();
  const handleToggleExpanded = () => {
    // Only animate the expand direction. Calling configureNext on collapse
    // can prevent the state update from registering (the collapse tap appears
    // to do nothing), so the animation is skipped on the way down.
    // Skipped entirely when reduceMotion is on — the state update still
    // fires; content snaps in/out instantly.
    if (!expanded && !reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpanded((v) => !v);
  };
  return (
    <View style={styles.zoneRow}>
      <Pressable
        onPress={handleToggleExpanded}
        accessibilityRole="button"
        accessibilityLabel="Zone Preferences"
        // M5: "Zone Preferences" is a noun — accessibilityState.expanded
        // tells VoiceOver the row is collapsed but not what tapping
        // does. The hint completes the affordance the same way
        // FloatingActionButton's hint pattern does (§2.1).
        accessibilityHint={
          expanded
            ? 'Collapse zone display options'
            : 'Expand zone display options'
        }
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.row, pressed && pressedDim]}
      >
        <View style={styles.rowIconWrap}>
          <MapPinArea size={24} color={colors.black} weight="duotone" />
        </View>
        <Text style={styles.rowLabel}>Zone Preferences</Text>
        {expanded ? (
          <CaretUp size={16} color={colors.labelTertiary} weight="bold" />
        ) : (
          <CaretDown size={16} color={colors.labelTertiary} weight="bold" />
        )}
      </Pressable>
      {expanded && (
        <View>
          <View style={styles.zoneInner}>
            <Text style={styles.zoneInnerLabel}>Show zones overlay</Text>
            <Switch
              value={showZones}
              onValueChange={onToggle}
              trackColor={{ false: colors.cardBorderSubtle, true: colors.freshgreen }}
              thumbColor={colors.white}
              accessibilityLabel="Toggle zones overlay"
              // M6: a VoiceOver user can't see the map; label = WHAT the
              // control is, hint = what it affects (§2.1 hint-pairing).
              accessibilityHint="Shows or hides the zone safety overlay on the map"
            />
          </View>

          {/* "What we flag" — the safety factors that shape route scoring
              + map flags, grouped apart from the display-only overlay
              toggle above. Toggles persist now; wiring them into scoring
              and the map is a tracked follow-up. */}
          <Text style={styles.zoneGroupCaption}>What we flag</Text>
          <View style={styles.zoneInner}>
            <Text style={styles.zoneInnerLabel}>Police presence</Text>
            <Switch
              value={flagPolice}
              onValueChange={(v) => onFlagToggle('flagPolice', v)}
              trackColor={{ false: colors.cardBorderSubtle, true: colors.freshgreen }}
              thumbColor={colors.white}
              accessibilityLabel="Flag police presence"
              accessibilityHint="Will affect which areas shape your route scoring and map flags"
            />
          </View>
          <View style={styles.zoneInner}>
            <Text style={styles.zoneInnerLabel}>Low-light areas</Text>
            <Switch
              value={flagLowLight}
              onValueChange={(v) => onFlagToggle('flagLowLight', v)}
              trackColor={{ false: colors.cardBorderSubtle, true: colors.freshgreen }}
              thumbColor={colors.white}
              accessibilityLabel="Flag low-light areas"
              accessibilityHint="Will affect which areas shape your route scoring and map flags"
            />
          </View>
          <View style={styles.zoneInner}>
            <Text style={styles.zoneInnerLabel}>Community reports</Text>
            <Switch
              value={flagCommunityReports}
              onValueChange={(v) => onFlagToggle('flagCommunityReports', v)}
              trackColor={{ false: colors.cardBorderSubtle, true: colors.freshgreen }}
              thumbColor={colors.white}
              accessibilityLabel="Flag community reports"
              accessibilityHint="Will affect which areas shape your route scoring and map flags"
            />
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * Single push-to-route settings row.
 *
 *   inert — "planned but not yet built." Drops opacity to 0.5,
 *   removes chevron, no-ops on tap. Same v1 affordance.
 */
function SettingsRow({
  icon,
  label,
  onPress,
  inert = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  inert?: boolean;
}) {
  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      disabled={inert}
      style={({ pressed }) => [
        styles.row,
        inert && styles.rowInert,
        pressed && !inert && pressedDim,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert }}
      accessibilityHint={inert ? 'Coming soon' : undefined}
    >
      <View style={styles.rowIconWrap}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      {!inert && (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.labelTertiary}
        />
      )}
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
    ...typography.title3Regular,
    color: colors.black,
  },
  profileName: {
    ...typography.title2Emphasized,
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
  rowInert: {
    opacity: 0.5,
  },
  rowIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
    flex: 1,
  },
  // Zone Preferences container — wraps the header row + the inline
  // toggle in one vertical stack so they read as one component.
  zoneRow: {
    paddingVertical: 4,
    gap: 4,
  },
  // Inline toggle row — indented to align with the header's text
  // column (24pt icon + 12pt gap = 36pt indent), matching Figma's
  // `px-8` inner inset.
  zoneInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 36 + 12,
    paddingRight: 12,
    paddingVertical: 4,
  },
  zoneInnerLabel: {
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
    flex: 1,
  },
  // "What we flag" — section header for the factor toggles. Uses the
  // app's in-content section-header register (subheadlineEmphasized +
  // black, same tier as the row labels) so it reads as a header, not
  // fine print; the 16pt top gap separates it from the Show-zones row
  // above, and a hairline rule reinforces the section break. Indented to
  // the toggle label column (36 + 12, matching zoneInner's paddingLeft).
  zoneGroupCaption: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
    paddingLeft: 36 + 12,
    paddingRight: 12,
    paddingTop: 16,
    paddingBottom: 6,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorderSubtle,
  },
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
  // Coming-soon visual cue. Matches the /safety tabInert opacity
  // register so every "not wired yet" surface reads the same way.
  tileCardComingSoon: {
    opacity: 0.5,
  },
  tileIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: {
    ...typography.subheadlineEmphasized,
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
    ...typography.footnoteRegular,
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
    ...typography.subheadlineRegular,
    color: colors.labelTertiary,
    // Underline reads as the canonical destructive-link signal —
    // matches the pattern Button uses on fill="transparent" labels.
    // Without it the row reads as another rowLabel item.
    textDecorationLine: 'underline',
  },
});
