import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
// Phosphor deep-imports bypass the package's barrel index — see
// app/trusted-contact-setup.tsx for the longer note + tsconfig
// `paths` mapping that keeps TypeScript happy.
import { Bookmark } from 'phosphor-react-native/src/icons/Bookmark';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
import { Camera } from 'phosphor-react-native/src/icons/Camera';
import { GasPump } from 'phosphor-react-native/src/icons/GasPump';
import { Gear } from 'phosphor-react-native/src/icons/Gear';
import { MapPinArea } from 'phosphor-react-native/src/icons/MapPinArea';
import { FileText } from 'phosphor-react-native/src/icons/FileText';
import { Question } from 'phosphor-react-native/src/icons/Question';
import { Shield } from 'phosphor-react-native/src/icons/Shield';
import { ShieldCheck } from 'phosphor-react-native/src/icons/ShieldCheck';
// Legacy API (documentDirectory + copyAsync) — same import the /report
// photo flow uses; SDK 54 moved the classic surface under /legacy.
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useState, type ReactNode } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AvatarPng from '../assets/illustrations/avatar.png';
import FuelIcon from '../assets/illustrations/fuel.svg';

import { clearCalendarConnection } from '../lib/api/calendar';
import { clearResolutions } from '../lib/api/calendar-resolutions';
import { clearPreferredStations } from '../lib/api/preferred-stations';
import { RowGroup } from '../components/settings/RowGroup';
import { SettingsHeader } from '../components/settings/SettingsHeader';
import { SettingsRow } from '../components/settings/SettingsRow';
import { useCalendarConnection } from '../hooks/useCalendarConnection';
import { useFuelProfile } from '../hooks/useFuelProfile';
import { useInsuranceProfile } from '../hooks/useInsuranceProfile';
import { usePreferences } from '../hooks/usePreferences';
import { useRegularDestinations } from '../hooks/useRegularDestinations';
import { useSavedPlaces } from '../hooks/useSavedPlaces';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { resetCoachMarks } from '../hooks/useCoachMark';
import { useModeratorRole } from '../hooks/useModeratorRole';
import { useUser } from '../hooks/useUser';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

// Portfolio-screenshot / demo escape hatch: hide the Moderation row even
// for confirmed moderators. Prod behavior is unchanged when unset. Set
// EXPO_PUBLIC_HIDE_MODERATION_ROW=true in .env.local before taking
// screenshots that shouldn't include the admin surface.
const HIDE_MODERATION_ROW = process.env.EXPO_PUBLIC_HIDE_MODERATION_ROW === 'true';

/**
 * Menu Page — the settings hub, pushed from /home's avatar (car) button.
 *
 * Retrofitted to the iOS grouped-settings register (2026-06-01, Plan 1
 * of the settings-register-refresh). Grouped-gray page background with
 * white RowGroup cards; the page IS the settings hub (no separate
 * /settings route — see the spec's Q1-c decision).
 *
 * Layout (top → bottom):
 *
 *   ⚙ Settings                  ✕   ← SettingsHeader `large`: big LEFT-
 *                                     aligned title + gear, close-X only.
 *                                     This is the settings-tree ROOT, so
 *                                     no chevron-back (nothing above it
 *                                     inside settings). Close exits to
 *                                     /home via router.back().
 *
 *   ┌ profile card ───────────────┐ ← avatar + "Hey there," + name,
 *   │ ⬤  Hey there, <name>        │   white card, non-tappable (no
 *   └─────────────────────────────┘   profile-edit surface yet)
 *
 *   ┌ Set up refuel reminders ────┐ ← progressive carousel tile. Shows
 *   │ ⛽ …                         │   ONLY while remindersEnabled is
 *   └─────────────────────────────┘   false; disappears once configured.
 *                                     (Plan 2 reintroduces a horizontal
 *                                     carousel when a 2nd tile —
 *                                     Connect calendar — exists.)
 *
 *   ┌ app-config RowGroup ────────┐
 *   │ ⛽ Refuel reminders       › │  ← always-available row (the
 *   │ 📍 Zone Preferences       › │     carousel is a shortcut, never
 *   │ 🛡 Safety                 › │     the only path — so /fuel is
 *   │ 🔖 Saved places           › │     reachable here even when the
 *   └─────────────────────────────┘     tile is hidden)
 *
 *   ┌ about RowGroup ─────────────┐
 *   │ 📄 Privacy & Terms        › │
 *   └─────────────────────────────┘
 *
 *   ┌ sign-out RowGroup ──────────┐
 *   │          Sign out           │  ← destructive SettingsRow (red,
 *   └─────────────────────────────┘     centered). Clears identity
 *                                       state then routes to /sign-out.
 *
 * Greeting name uses a fall-through ladder (displayName → email
 * local-part → "friend") so the row never shows an unfilled-form
 * placeholder.
 *
 * Avatar illustration: a placeholder PNG until the custom illustrated
 * face SVG is exported (queued for the next bulk-SVG export pass).
 *
 * Route: /menu
 */

export default function Menu() {
  const router = useRouter();
  const { user, signOut, updateProfile } = useUser();
  const { clearContact } = useTrustedContact();
  const savedPlacesState = useSavedPlaces();
  const { clear: clearSavedPlacesMutation } = savedPlacesState;
  const savedPlacesCount = savedPlacesState.ready
    ? savedPlacesState.savedPlaces.length
    : 0;
  const savedPlacesValue =
    savedPlacesCount === 0 ? undefined : `${savedPlacesCount} saved`;
  const { clearAll: clearRegularDestinations } = useRegularDestinations();
  const { clearAll: clearPreferences } = usePreferences();
  const {
    profile: fuelProfile,
    loading: fuelLoading,
    clearAll: clearFuelProfile,
  } = useFuelProfile();
  const { clearAll: clearInsuranceProfile } = useInsuranceProfile();
  const { isModerator } = useModeratorRole();
  const [signingOut, setSigningOut] = useState(false);

  const {
    connected: calendarConnected,
    loading: calendarLoading,
    connect: connectCalendar,
  } = useCalendarConnection();

  // Progressive carousel: a tile shows only while its underlying setting
  // is UNSET. Refuel reminders is set once remindersEnabled is true;
  // Connect calendar is set once the calendar connection is established.
  // Both gate on !loading so an already-configured user doesn't see a
  // one-frame "Set up X" flash on cold mount before useFocusEffect's
  // async read resolves (a small honesty-of-disclosure ding — showing
  // an affordance for a state they've already satisfied).
  const showFuelTile = !fuelLoading && !fuelProfile?.remindersEnabled;
  const showCalendarTile = !calendarLoading && !calendarConnected;

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

  /**
   * Edit the greeting name. iOS-native text prompt (the app is
   * iPhone-first) seeded with the current name. An empty save clears the
   * name back to the email/"friend" fallback. Fixes the "still says
   * friend" gap for users whose Apple Sign-In never returned a name
   * (Apple only sends it on first authorization).
   */
  function handleEditName() {
    Alert.prompt(
      'Your name',
      'How should Fresh Greens greet you?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: (text?: string) => {
            void updateProfile({ displayName: text ?? '' });
          },
        },
      ],
      'plain-text',
      user?.displayName ?? '',
    );
  }

  /** Photo-source action sheet → library or camera, with a Remove
   *  option once a custom avatar is set. */
  function handleChangeAvatar() {
    Haptics.selectionAsync().catch(() => {});
    Alert.alert('Profile photo', undefined, [
      { text: 'Choose from Library', onPress: () => void pickAvatar('library') },
      { text: 'Take Photo', onPress: () => void pickAvatar('camera') },
      ...(user?.avatarUri
        ? [
            {
              text: 'Remove Photo',
              style: 'destructive' as const,
              onPress: () => void updateProfile({ avatarUri: null }),
            },
          ]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  /**
   * Pick a square avatar from the library or camera, copy it out of the
   * volatile picker cache into documentDirectory for durability (same
   * pattern as /report's photo), and persist the URI. Falls back to the
   * cache URI if the copy fails. Permission denied → Settings-pointing
   * Alert; cancel → no-op.
   */
  async function pickAvatar(source: 'library' | 'camera') {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        source === 'camera' ? 'Camera access needed' : 'Photo access needed',
        `Allow ${source === 'camera' ? 'Camera' : 'Photos'} access for Fresh Greens in Settings to set a profile photo.`,
      );
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: 'images',
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    try {
      const dir = `${FileSystem.documentDirectory}avatars/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
        () => {},
      );
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const durableUri = `${dir}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      await FileSystem.copyAsync({ from: asset.uri, to: durableUri });
      await updateProfile({ avatarUri: durableUri });
    } catch {
      await updateProfile({ avatarUri: asset.uri });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
  }

  function handleBack() {
    router.back();
  }

  function handleFuel() {
    router.push('/fuel');
  }

  function handleZonePreferences() {
    router.push('/zone-preferences');
  }

  function handleSafety() {
    router.push('/safety-settings');
  }

  function handleSavedPlaces() {
    router.push('/saved-places');
  }

  function handleModeration() {
    router.push('/moderation');
  }

  async function handleMapGuide() {
    await resetCoachMarks();
    router.replace('/home');
  }

  function handleLegal() {
    router.push('/legal');
  }

  function confirmSignOut() {
    if (signingOut) return;
    // Destructive confirm — handleSignOut cascades 8 clearAll* calls
    // across 7+ stores plus the auth signOut. A single mis-tap on the
    // /menu row would wipe saved places, regulars, preferences, fuel
    // profile, calendar connection, resolutions, preferred stations.
    // Alert.alert with destructive style matches the iOS convention
    // and gives the user one undo opportunity before the cascade fires.
    Alert.alert(
      'Sign out?',
      "You'll need to sign back in to use Fresh Greens again.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            void handleSignOut();
          },
        },
      ],
    );
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // Clear identity-attached state before the sign-out confirmation
      // screen takes over — same hygiene as v1.
      // clearSavedPlacesMutation.run() resolves to MutationResult instead of
      // throwing — a clear failure does NOT block sign-out. Cleanup failures
      // here are transient AsyncStorage hiccups; making the user re-tap
      // sign-out because of one is worse UX than proceeding with a stale
      // saved-places list. Other clearAll-style methods in this Promise.all
      // still throw; this is the only mutation-style one.
      await Promise.all([
        signOut(),
        clearContact(),
        clearSavedPlacesMutation.run(),
        clearRegularDestinations(),
        clearPreferences(),
        clearFuelProfile(),
        clearInsuranceProfile(),
        clearCalendarConnection(),
        clearResolutions(),
        clearPreferredStations(),
      ]);
      router.replace('/sign-out');
    } finally {
      setSigningOut(false);
    }
  }

  // Progressive carousel tiles — each shows only while its underlying
  // setting is unset. .filter(Boolean) drops the gated-off entries; the
  // trailing cast restores the element type the `false &&` union erased.
  const carouselTiles: {
    key: string;
    label: string;
    subtitle: string;
    icon: ReactNode;
    onPress: () => void;
  }[] = [
    showFuelTile && {
      key: 'fuel',
      label: 'Set up refuel reminders',
      subtitle: "Tell us how often you fill up so you don't run low in an unsafe spot.",
      icon: <FuelIcon width={32} height={32} />,
      onPress: () => {
        Haptics.selectionAsync().catch(() => {});
        router.push('/fuel');
      },
    },
    showCalendarTile && {
      key: 'calendar',
      label: 'Connect your calendar',
      subtitle:
        'Route to your next appointment from the home screen — no typing required.',
      icon: <CalendarBlank size={32} color={colors.accent} weight="regular" />,
      onPress: () => {
        Haptics.selectionAsync().catch(() => {});
        void connectCalendar();
      },
    },
  ].filter(Boolean) as {
    key: string;
    label: string;
    subtitle: string;
    icon: ReactNode;
    onPress: () => void;
  }[];

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SettingsHeader
          title="Settings"
          large
          icon={<Gear size={28} color={colors.wiltedgreen} weight="regular" />}
          onClose={handleBack}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile card — identity anchor, non-tappable (no profile
              edit surface yet). */}
          <View style={styles.profileCard}>
            <Pressable
              onPress={handleChangeAvatar}
              accessibilityRole="button"
              accessibilityLabel="Profile photo"
              accessibilityHint="Change your profile photo"
              style={({ pressed }) => [
                styles.avatarPressable,
                pressed && pressedDim,
              ]}
            >
              <Image
                // Key on the URI so the Image remounts when the avatar
                // changes — RN doesn't always refresh an <Image> when its
                // source switches between a static require() and a {uri}
                // (or between two file:// URIs), which read as "the photo
                // didn't update."
                key={user?.avatarUri ?? 'placeholder'}
                source={user?.avatarUri ? { uri: user.avatarUri } : AvatarPng}
                style={styles.profileAvatar}
                resizeMode="cover"
                accessible={false}
                accessibilityIgnoresInvertColors
              />
              {/* Camera badge — the discoverability cue that the avatar
                  is editable (iOS Contacts / iMessage convention). */}
              <View style={styles.avatarBadge}>
                <Camera size={14} color={colors.white} weight="fill" />
              </View>
            </Pressable>
            <Pressable
              onPress={handleEditName}
              accessibilityRole="button"
              accessibilityLabel={`Hey there, ${displayName}`}
              accessibilityHint="Edit your name"
              style={({ pressed }) => [
                styles.profileTextStack,
                pressed && pressedDim,
              ]}
            >
              <Text style={styles.profileGreeting}>Hey there,</Text>
              <Text
                style={styles.profileName}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {displayName}
              </Text>
            </Pressable>
          </View>

          {/* App-config group */}
          <RowGroup>
            <SettingsRow
              icon={<GasPump size={24} color={colors.labelSecondary} weight="regular" />}
              label="Refuel reminders"
              onPress={handleFuel}
            />
            <SettingsRow
              icon={<MapPinArea size={24} color={colors.labelSecondary} weight="regular" />}
              label="Zone Preferences"
              onPress={handleZonePreferences}
            />
            <SettingsRow
              icon={<Shield size={24} color={colors.labelSecondary} weight="regular" />}
              label="Safety"
              onPress={handleSafety}
            />
            <SettingsRow
              icon={<Bookmark size={24} color={colors.labelSecondary} weight="regular" />}
              label="Saved places"
              value={savedPlacesValue}
              onPress={handleSavedPlaces}
            />
            <SettingsRow
              icon={<Question size={24} color={colors.labelSecondary} weight="regular" />}
              label="Map guide"
              onPress={handleMapGuide}
            />
            {isModerator && !HIDE_MODERATION_ROW && (
              <SettingsRow
                icon={<ShieldCheck size={24} color={colors.labelSecondary} weight="regular" />}
                label="Moderation"
                onPress={handleModeration}
              />
            )}
          </RowGroup>

          {/* Progressive setup tiles — placed BELOW the primary app-config
              RowGroup so substantive settings lead. The carousel is
              onboarding/discovery content (it disappears once both settings
              are configured), not primary navigation. Each tile mirrors an
              unset row in app-config above; users can tap either path. */}
          {carouselTiles.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
            >
              {carouselTiles.map((tile) => (
                <Pressable
                  key={tile.key}
                  style={({ pressed }) => [
                    styles.tileCard,
                    styles.tileCardCarousel,
                    pressed && pressedDim,
                  ]}
                  onPress={tile.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={`${tile.label}. ${tile.subtitle}`}
                >
                  <View style={styles.tileIcon}>{tile.icon}</View>
                  <Text style={styles.tileTitle}>{tile.label}</Text>
                  <Text style={styles.tileSubtitle}>{tile.subtitle}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* About group — eyebrow added per layout pass so this 1-row group
              reads as semantically distinct from the (also 1-row, also
              chrome-identical) destructive Sign-out group below. */}
          <RowGroup title="About">
            <SettingsRow
              icon={<FileText size={24} color={colors.labelSecondary} weight="regular" />}
              label="Privacy & Terms"
              onPress={handleLegal}
            />
          </RowGroup>

          {/* Sign out — destructive, its own bottom group */}
          <RowGroup>
            <SettingsRow
              label="Sign out"
              destructive
              onPress={confirmSignOut}
            />
          </RowGroup>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// --- Styles --------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfacePage,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceTinted,
    borderRadius: radii.md,
    padding: spacing.md,
    ...shadows.e1,
  },
  // Relative wrapper so the camera badge can pin to the avatar's
  // bottom-right. Sized to the 80pt avatar.
  avatarPressable: {
    width: 80,
    height: 80,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: radii.pill,
    backgroundColor: colors.freshgreen,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.freshgreen,
  },
  // Camera badge pinned to the avatar's bottom-right — the editable cue.
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: radii.md,
    backgroundColor: colors.wiltedgreen,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  profileTextStack: {
    flex: 1,
    gap: spacing.xs,
  },
  profileGreeting: {
    ...dynamicType(typography.title2Emphasized),
    color: colors.wiltedgreen,
  },
  profileName: {
    ...dynamicType(typography.title1Emphasized),
    color: colors.black,
  },
  carouselContent: {
    gap: spacing.md,
  },
  // Fixed-width tile (always applied). With ≥2 tiles the next one peeks
  // at the edge; with 1 tile it sits left-aligned with scroll-space to
  // its right — the iOS progressive-carousel pattern that says "more
  // might appear here." User-flagged 2026-06-01: the prior solo-tile
  // stretched to the ScrollView's full width and read underfilled
  // because the title/subtitle text didn't grow with it.
  tileCardCarousel: {
    width: 280,
  },
  // Per Figma 1121:6590 / 1121:6602: white bg + 1pt wiltedgreen border
  // + 12pt rounded corners + 16pt padding. NO shadow (the border
  // carries the elevation visually, vs v1's shadow approach).
  tileCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  tileIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: {
    // bodyEmphasized (17pt) per the 2026-06-01 text-size audit —
    // featured-tile titles deserve the primary-content register; v1's
    // subheadlineEmphasized (15pt) dropped a tier below the row labels
    // below them in the visual hierarchy.
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
  },
  tileSubtitle: {
    // M8: was footnoteEmphasized + underline. Underline on colored
    // text is the canonical link affordance (cf. signOutText below,
    // Button fill='transparent' in §2.2) — applying it to non-link
    // copy inside an already-tappable card created a false-link
    // signal AND killed the within-card hierarchy (weight 600 title
    // vs weight 600 subtitle read as peers). Regular weight without
    // underline matches the supporting-copy register used elsewhere.
    //
    // Bumped 13pt → 15pt (subheadlineRegular) on 2026-06-01 to
    // rebalance against the tileTitle's 15pt → 17pt bump above —
    // keeping the supporting copy one tier below the title preserves
    // the within-card hierarchy.
    ...dynamicType(relaxedLineHeight(typography.subheadlineRegular)),
    color: colors.accent,
  },
});
