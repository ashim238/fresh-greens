import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
// Phosphor deep-imports bypass the package's barrel index — see
// app/trusted-contact-setup.tsx for the longer note + tsconfig
// `paths` mapping that keeps TypeScript happy.
import { Calendar } from 'phosphor-react-native/src/icons/Calendar';
import { Car } from 'phosphor-react-native/src/icons/Car';
import { CircleHalf } from 'phosphor-react-native/src/icons/CircleHalf';
import { GearSix } from 'phosphor-react-native/src/icons/GearSix';
import { MapTrifold } from 'phosphor-react-native/src/icons/MapTrifold';
import { Shield } from 'phosphor-react-native/src/icons/Shield';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';

// SVG asset imports. react-native-svg-transformer (configured in
// metro.config.js) turns each .svg file into a real RN component
// backed by react-native-svg, so they scale cleanly at any render
// size. TypeScript types come from types/svg.d.ts.
import FuelIcon from '../assets/illustrations/fuel.svg';
import NotificationIcon from '../assets/illustrations/notification.svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageControl } from '../components/PageControl';
import { usePreferences } from '../hooks/usePreferences';
import { useSavedPlaces } from '../hooks/useSavedPlaces';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { useUser } from '../hooks/useUser';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { typography } from '../theme/typography';

// LayoutAnimation needs explicit opt-in on Android. iOS supports it
// out of the box. Without this guard, the accordion expand/collapse
// renders as a hard cut on Android.
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Settings — pushed from /home's avatar (car) button.
 *
 * Layout (Waze-flavored: profile carries page identity, uniform row
 * register, inline accordion for Zone Settings, quiet sign out):
 *
 *   ‹                              ← back chevron only (no page title;
 *                                    profile row identifies the page)
 *
 *   [Car]  Hey {firstName}         ← profile row, inert (opacity 0.5,
 *          {email}                   no chevron) until /profile ships
 *
 *   ─── divider on dark ───────────
 *
 *   [Map] Zone Settings         ›  ← row pattern; tap toggles ▾
 *     ↳ Show zones overlay [⊙]    ← accordion-revealed toggle
 *
 *   [Shield] Safety            ›  ← real route → /safety-settings
 *   [Gear] Settings            ›  ← inert (TODO) — opacity 0.5, no chevron
 *   [Calendar] Schedule a drive › ← inert (TODO)
 *   [Theme] Theme              ›  ← inert (TODO)
 *
 *           Sign out               ← centered, quiet, no pill
 *
 * Design notes informed by user feedback after first pass:
 *  - "Settings" page title removed — felt redundant against the
 *    profile-row "Hey {firstName}" hierarchy. Profile is the page
 *    identifier (Waze pattern).
 *  - Zone Settings now matches the other rows visually — same icon /
 *    label / chevron register — and uses an accordion to reveal the
 *    actual toggle. Avoids the "weirdo row that doesn't match" feel
 *    of an inline toggle next to non-toggle rows.
 *  - Spacing reassessed: 20pt gap inside rows (was 16), generous
 *    vertical padding on each row (16pt vs 12pt), divider has 16pt
 *    breathing room top + bottom.
 *  - "Safety Settings" → "Safety" — shorter label, less repetitive
 *    when sitting next to Settings / Theme / etc.
 *
 * Inert rows (Settings / Schedule a drive / Theme) render at 50%
 * opacity with no chevron and no onPress — communicates "planned but
 * not active." When each ships, opacity returns to 1, chevron returns,
 * onPress wires up.
 *
 * Route: /menu
 */
// Quick-settings carousel data. Tiles are inert placeholders in v1 —
// each represents a preference that ships in its own future PR.
//
// Subtitle copy follows the descriptive register the Search Landing
// frame established for the Fuel section in Figma (node 825:4996):
// "Add your car's model and fuel for refuel reminders." Subtitles
// describe what the feature *will do* once configured, inviting
// action without implying a default state.
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
    // Verbatim from Figma Search Landing (node 825:5001).
    subtitle: "Add your car's model and fuel for refuel reminders",
    renderIcon: () => <FuelIcon width={36} height={36} />,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    // Mirrors the Fuel subtitle's "what this does" register.
    subtitle: 'Get alerts for your trips and safety events',
    renderIcon: () => <NotificationIcon width={36} height={36} />,
  },
];

export default function Menu() {
  const router = useRouter();
  const { user, signOut } = useUser();
  const { contact, clearContact } = useTrustedContact();
  const { clearAll: clearSavedPlaces } = useSavedPlaces();
  const { preferences, setShowZones } = usePreferences();
  const { width: screenWidth } = useWindowDimensions();
  const [signingOut, setSigningOut] = useState(false);
  const [zoneExpanded, setZoneExpanded] = useState(false);
  const [activeQuickIndex, setActiveQuickIndex] = useState(0);

  // Carousel sizing — Waze-flavored peek pattern: each tile takes
  // most of the screen width, with the next tile peeking ~50pt at
  // the right edge so the user knows there's another tile to swipe
  // to. Snap interval = tile width + gap so each swipe moves one
  // tile.
  //
  //   |‹─ 32 ─›|‹───── TILE_WIDTH ─────›|‹─ GAP ─›|‹─ peek ─›|
  //   first tile starts 32pt from screen edge.
  const TILE_GAP = 16;
  const TILE_WIDTH = screenWidth - 96; // ~80% of screen, leaves peek
  const SNAP_INTERVAL = TILE_WIDTH + TILE_GAP;

  // First name only for the greeting — matches Waze's "Hey {first}"
  // register. Falls back to "there" when displayName is missing
  // (returning Apple Sign In with no cached name).
  const firstName = user?.displayName?.split(/\s+/)[0] ?? 'there';

  // Carousel snap handler — fires when a swipe settles. Page index
  // is content-offset divided by SNAP_INTERVAL (one tile + gap).
  function handleQuickScrollEnd(
    e: NativeSyntheticEvent<NativeScrollEvent>,
  ) {
    const index = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL);
    setActiveQuickIndex(index);
  }

  function handleBack() {
    router.back();
  }

  function handleZoneSettingsToggle() {
    // LayoutAnimation.configureNext schedules the next layout pass
    // to animate. easeInEaseOut is the standard "expand smoothly"
    // preset. Has to be called BEFORE the state change that causes
    // the layout shift, not after.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setZoneExpanded((prev) => !prev);
  }

  function handleSafety() {
    router.push('/safety-settings');
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // Clear all identity-attached state on sign-out so the next
      // sign-in (potentially a different Apple ID) doesn't inherit the
      // previous user's trusted contact, saved home, or other places.
      await Promise.all([signOut(), clearContact(), clearSavedPlaces()]);
      router.replace('/');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

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
            <Ionicons
              name="chevron-back"
              size={28}
              color={colors.white}
            />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* --- Profile row (page identifier) ---
              Inert until /profile ships. Per audit-7: matches the
              Settings/Schedule/Theme rows' inert pattern (opacity 0.5,
              no chevron, no tap) so "future destination" reads
              consistently across the menu. */}
          <View
            style={[styles.profileRow, styles.profileRowInert]}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Hey ${firstName}${user?.email ? `, ${user.email}` : ''}`}
          >
            <View style={styles.profileAvatar}>
              <Car
                size={28}
                color={colors.fadedgreen}
                weight="duotone"
              />
            </View>
            <View style={styles.profileTextStack}>
              <Text style={styles.profileGreeting}>Hey {firstName}</Text>
              {user?.email && (
                <Text style={styles.profileEmail}>{user.email}</Text>
              )}
            </View>
          </View>

          {/* Divider line — separates profile from settings list */}
          <View style={styles.divider} />

          {/* --- Settings rows --- */}
          <View style={styles.rowList}>
            {/* Zone Settings: accordion — same visual register as the
                other rows, but tap toggles an inline reveal of the
                Show-zones-overlay switch instead of pushing a route. */}
            <SettingsRow
              icon={
                <MapTrifold
                  size={24}
                  color={colors.wiltedgreen}
                  weight="duotone"
                />
              }
              label="Zone Settings"
              onPress={handleZoneSettingsToggle}
              chevronDirection={zoneExpanded ? 'down' : 'forward'}
            />
            {zoneExpanded && (
              <View style={styles.zoneAccordion}>
                <Text style={styles.accordionLabel}>
                  Show zones overlay
                </Text>
                <Switch
                  value={preferences?.showZones ?? false}
                  onValueChange={setShowZones}
                  trackColor={{
                    false: colors.cardBorderSubtle,
                    true: colors.freshgreen,
                  }}
                  thumbColor={colors.white}
                  accessibilityLabel="Toggle zones overlay"
                />
              </View>
            )}

            <SettingsRow
              icon={
                <Shield
                  size={24}
                  color={colors.wiltedgreen}
                  weight="duotone"
                />
              }
              label="Safety"
              onPress={handleSafety}
            />

            <SettingsRow
              icon={
                <GearSix
                  size={24}
                  color={colors.wiltedgreen}
                  weight="duotone"
                />
              }
              label="Settings"
              inert
            />

            <SettingsRow
              icon={
                <Calendar
                  size={24}
                  color={colors.wiltedgreen}
                  weight="duotone"
                />
              }
              label="Schedule a drive"
              inert
            />

            <SettingsRow
              icon={
                <CircleHalf
                  size={24}
                  color={colors.wiltedgreen}
                  weight="duotone"
                />
              }
              label="Theme"
              inert
            />
          </View>

        </ScrollView>

        {/*
          Quick settings carousel — pinned outside the ScrollView so it
          sits right above Sign out at the bottom of the screen,
          regardless of how tall the row list above grows. Waze-style
          rectangular tiles with peek of the next tile at the right
          edge; inert in v1.

          First tile offset 32pt from the screen edge via
          contentContainerStyle, last tile gets matching 32pt right
          padding for visual balance. Snap-to-interval moves one tile
          per swipe.
        */}
        <View style={styles.quickWrap}>
          <FlatList
            data={QUICK_TILES}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={SNAP_INTERVAL}
            snapToAlignment="start"
            contentContainerStyle={styles.quickContent}
            ItemSeparatorComponent={() => (
              <View style={{ width: TILE_GAP }} />
            )}
            onMomentumScrollEnd={handleQuickScrollEnd}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.tileCard, { width: TILE_WIDTH }]}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}. ${item.subtitle}`}
                accessibilityHint="Coming soon"
                // Visually inviting (no opacity dim) — the
                // descriptive subtitle reads as "this will do
                // something when configured." Tap is a no-op
                // until each feature ships.
              >
                <View style={styles.tileIcon}>{item.renderIcon()}</View>
                <View style={styles.tileTextStack}>
                  <Text style={styles.tileTitle}>{item.label}</Text>
                  <Text
                    style={styles.tileSubtitle}
                    numberOfLines={2}
                  >
                    {item.subtitle}
                  </Text>
                </View>
              </Pressable>
            )}
          />
          <PageControl
            total={QUICK_TILES.length}
            activeIndex={activeQuickIndex}
          />
        </View>

        {/*
          Sign out — pinned to the bottom of the SafeAreaView (outside
          the ScrollView), so it sits at the bottom of the screen with
          the bottom safe-area inset already factored in by the parent
          SafeAreaView's `edges={['top', 'bottom']}`. Sitting below the
          scroll means scrollable content above can grow freely without
          pushing Sign out off-screen — the menu is short enough today
          that the ScrollView won't actually scroll, but if Recordings
          + Recent Trips fill the spine later, this stays correct.
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
              <ActivityIndicator color={colors.fadedgreen} />
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
 * Single settings row: leading icon + label + chevron.
 *
 *   chevronDirection — 'forward' (default, →) for push-to-route rows,
 *   'down' (▾) when this row is acting as an accordion in its
 *   expanded state. The Zone Settings row uses 'down' to signal the
 *   inline toggle below it.
 *
 *   inert — "planned but not yet built" state. Drops opacity to 0.5,
 *   removes the chevron entirely, no-ops on tap. Communicates "this
 *   exists in the future" without hiding the row.
 */
function SettingsRow({
  icon,
  label,
  onPress,
  inert = false,
  chevronDirection = 'forward',
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  inert?: boolean;
  chevronDirection?: 'forward' | 'down';
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
      accessibilityState={{ disabled: inert, expanded: chevronDirection === 'down' }}
      accessibilityHint={inert ? 'Coming soon' : undefined}
    >
      <View style={styles.rowIconWrap}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      {!inert && (
        <Ionicons
          name={chevronDirection === 'down' ? 'chevron-down' : 'chevron-forward'}
          size={22}
          color={colors.fadedgreen}
        />
      )}
    </Pressable>
  );
}

// --- Styles --------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.wiltedgreen,
  },
  safe: {
    flex: 1,
  },

  // --- Header (back chevron only) ---
  header: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Scroll body ---
  // flex: 1 on the ScrollView itself fills the space between the
  // header and the pinned Sign out below — that's what pushes Sign
  // out to the bottom of the SafeAreaView. Without flex: 1, ScrollView
  // would size to its content and Sign out would sit right under the
  // last visible row regardless of screen height.
  scroll: {
    flex: 1,
  },
  // 32pt horizontal matches /trusted-contact-setup, /permissions
  // (static-content modal-padding rule). 16pt top sits the profile
  // row a beat below the header without crowding it.
  scrollContent: {
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 24,
  },

  // --- Profile row ---
  // Burntgreen avatar (vs the white-circle nav rows below) keeps
  // identity a visual tier above navigation.
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16, // pulled back from 20 — felt too wide between glyph and type
    paddingVertical: 16,
    minHeight: 64, // profile carries page identity, give it weight
  },
  profileRowInert: {
    // Audit-7 consistency rule: the menu's "future destination" affordance
    // is opacity 0.5 + no chevron, applied uniformly to Settings/Schedule/
    // Theme. Profile row inherits the same treatment until /profile ships.
    opacity: 0.5,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.burntgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTextStack: {
    flex: 1,
    gap: 2,
  },
  profileGreeting: {
    // Bumped from title3Emphasized (20pt) to title2Emphasized (22pt).
    // First-pass felt small for a page-anchoring greeting; t2 gives
    // it more weight without going as heavy as title1 (28pt would
    // compete with the in-modal user-prompt register).
    ...typography.title2Emphasized,
    color: colors.white,
  },
  profileEmail: {
    ...typography.subheadlineRegular,
    color: colors.fadedgreen,
  },

  // --- Divider on dark ---
  // 16pt above + below — generous breathing room so the divider feels
  // like a deliberate separation rather than an accidental hairline.
  divider: {
    height: 1,
    backgroundColor: colors.dividerOnDark,
    marginVertical: 16,
  },

  // --- Settings rows list ---
  rowList: {
    // No gap between rows — the row's own paddingVertical creates
    // the visual separation. A gap on top of paddingVertical doubles
    // the apparent space and makes rows feel disconnected.
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16, // pulled back from 20 — type-to-icon felt too wide
    paddingVertical: 16, // generous touch register, ~52-56pt total
    minHeight: 56,
  },
  rowInert: {
    opacity: 0.5,
  },
  // White-circle icon tile — gives each row a tactile anchor against
  // the wiltedgreen background. Brand-faithful (matches the app's
  // illustrative warmth) and reads as "tappable / discrete" vs a
  // muted duotone-on-color icon. 36pt is large enough to host a 24pt
  // glyph with breathing room.
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    ...typography.bodyEmphasized,
    color: colors.white,
    flex: 1,
  },

  // --- Zone Settings accordion content ---
  // Sits below the Zone Settings row when expanded. Indented 52pt
  // (32 icon + 20 gap) so the content aligns with the row's text
  // column — visually clear that the toggle belongs to that row.
  zoneAccordion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 52,
    paddingRight: 4,
    paddingTop: 4,
    paddingBottom: 12,
  },
  accordionLabel: {
    ...typography.subheadlineRegular,
    color: colors.fadedgreen,
    flex: 1,
  },

  // --- Quick-settings carousel ---
  // Sits as a sibling of the ScrollView (outside it), pinned to the
  // bottom right above Sign out. No marginHorizontal: -32 hack needed
  // — the wrapper spans the SafeAreaView width directly. Vertical
  // padding gives the carousel air between the scrollable rows above
  // and the Sign out below.
  quickWrap: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  // FlatList contentContainer — 32pt left padding offsets the first
  // tile from the screen edge, 32pt right padding gives the last
  // tile matching breathing room when fully snapped into view.
  quickContent: {
    paddingHorizontal: 32,
  },
  // Rectangular Waze-style tile: icon on the left, title + subtitle
  // stacked on the right. ~80% of screen width (TILE_WIDTH), wider
  // than tall, with the next tile peeking ~50pt at the right edge
  // when fully snapped.
  tileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  // No background fill — icon sits naked on the white card. The 36pt
  // square wrap reserves layout space; the SVG inside renders at
  // whatever width/height it was passed (36 in QUICK_TILES).
  tileIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTextStack: {
    flex: 1,
    gap: 4,
  },
  tileTitle: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
  },
  tileSubtitle: {
    ...typography.footnoteRegular,
    // Wiltedgreen mirrors the Figma Search Landing's subtitle color
    // (#326936) — same descriptive-copy register on a white card.
    color: colors.wiltedgreen,
  },

  // --- Sign out (centered, quiet) ---
  signOutWrap: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 8,
  },
  signOutText: {
    ...typography.subheadlineRegular,
    color: colors.fadedgreen,
  },
});
