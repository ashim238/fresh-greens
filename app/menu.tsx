import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
// Phosphor deep-imports bypass the package's barrel index — see
// app/trusted-contact-setup.tsx for the longer note + tsconfig
// `paths` mapping that keeps TypeScript happy.
import { Calendar } from 'phosphor-react-native/src/icons/Calendar';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { GearSix } from 'phosphor-react-native/src/icons/GearSix';
import { MapPinArea } from 'phosphor-react-native/src/icons/MapPinArea';
import { PaintRoller } from 'phosphor-react-native/src/icons/PaintRoller';
import { Shield } from 'phosphor-react-native/src/icons/Shield';
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
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// SVG asset imports — fuel.svg already exists; calendar tile uses the
// Phosphor Calendar duotone for v1 (queue a custom illustrated SVG
// for a future bulk-export pass to match the Fuel tile's register).
import AvatarPng from '../assets/illustrations/avatar.png';
import FuelIcon from '../assets/illustrations/fuel.svg';

import { PageControl } from '../components/PageControl';
import { usePreferences } from '../hooks/usePreferences';
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
  const { preferences, setShowZones } = usePreferences();
  const { width: screenWidth } = useWindowDimensions();
  const [signingOut, setSigningOut] = useState(false);
  const [activeQuickIndex, setActiveQuickIndex] = useState(0);

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
      await Promise.all([signOut(), clearContact(), clearSavedPlaces()]);
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
              accessibilityIgnoresInvertColors
            />
            <View style={styles.profileTextStack}>
              <Text style={styles.profileGreeting}>Hey there,</Text>
              <Text style={styles.profileName}>{displayName}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Settings rows */}
          <View style={styles.rowList}>
            <ZonePreferencesRow
              showZones={preferences?.showZones ?? false}
              onToggle={setShowZones}
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
            decelerationRate="fast"
            snapToInterval={SNAP_INTERVAL}
            snapToAlignment="start"
            contentContainerStyle={styles.quickContent}
            ItemSeparatorComponent={() => <View style={{ width: TILE_GAP }} />}
            onMomentumScrollEnd={handleQuickScrollEnd}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.tileCard, { width: TILE_WIDTH }]}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}. ${item.subtitle}`}
                accessibilityHint="Coming soon"
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
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            accessibilityState={{ busy: signingOut, disabled: signingOut }}
            style={({ pressed }) =>
              pressed && !signingOut ? pressedDim : undefined
            }
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
 * Zone Preferences row — header + always-visible toggle.
 *
 * Differs from regular SettingsRow in that the toggle sits inline
 * below the header, always visible. v1 hid this behind an
 * accordion-on-tap; v2 surfaces it directly per Figma `1120:7357`.
 * Header still shows a CaretDown to communicate that this is an
 * expanded dropdown (vs the CaretRight used on push-to-route rows).
 */
function ZonePreferencesRow({
  showZones,
  onToggle,
}: {
  showZones: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <View style={styles.zoneRow}>
      <View style={styles.row}>
        <View style={styles.rowIconWrap}>
          <MapPinArea size={24} color={colors.black} weight="duotone" />
        </View>
        <Text style={styles.rowLabel}>Zone Preferences</Text>
        <CaretDown size={16} color={colors.labelTertiary} weight="bold" />
      </View>
      <View style={styles.zoneInner}>
        <Text style={styles.zoneInnerLabel}>Show zones overlay</Text>
        <Switch
          value={showZones}
          onValueChange={onToggle}
          trackColor={{
            false: colors.cardBorderSubtle,
            true: colors.freshgreen,
          }}
          thumbColor={colors.white}
          accessibilityLabel="Toggle zones overlay"
        />
      </View>
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
    // The avatar SVG carries its own 80pt freshgreen circle bg per
    // Figma 1120:7476 — wrapper is just a layout slot, no fill/radius
    // needed here. (Was a circle wrapper around the Phosphor User
    // placeholder before the real SVG was exported.)
    width: 80,
    height: 80,
  },
  profileTextStack: {
    flex: 1,
    gap: 8,
  },
  profileGreeting: {
    ...typography.title3Emphasized,
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
    ...typography.subheadlineEmphasized,
    color: colors.black,
  },
  tileSubtitle: {
    ...typography.footnoteEmphasized,
    color: colors.wiltedgreen,
    textDecorationLine: 'underline',
  },
  signOutWrap: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  signOutText: {
    ...typography.subheadlineRegular,
    color: colors.labelTertiary,
  },
});
