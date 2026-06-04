import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
// Phosphor deep-import bypasses the package's barrel — see
// app/trusted-contact-setup.tsx for the longer note + tsconfig
// `paths` mapping that keeps TypeScript happy.
import { Microphone } from 'phosphor-react-native/src/icons/Microphone';
// Red asterisk glyph — matches /emergency's header mark. /en-route SOS
// uses sidebtn-sos.svg (32pt burst); settings uses this 24pt row icon.
// Replaced
// the prior red medical-cross SVG (user-flagged 2026-06-01) because
// the cross shape conflicted with the protected Red Cross emblem.
// See app/emergency.tsx for the full rationale.
import { Asterisk } from 'phosphor-react-native/src/icons/Asterisk';
import { UserCircle } from 'phosphor-react-native/src/icons/UserCircle';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RowGroup } from '../components/settings/RowGroup';
import { SettingsHeader } from '../components/settings/SettingsHeader';
import { SettingsRow } from '../components/settings/SettingsRow';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

/**
 * Safety Settings — pushed from /menu's "Safety" row.
 *
 * Settings register: SettingsHeader (back + close) over a grouped-gray
 * page, one RowGroup white card holding three rows — Emergency SOS
 * (red Asterisk → /emergency), Trusted Contact (the contact name as a
 * right-aligned value → /trusted-contact-setup), and Recordings
 * (→ /recordings). Matches /menu and /zone-preferences. Future safety
 * prefs slot in as additional rows.
 *
 * Route: /safety-settings
 */
export default function SafetySettings() {
  const router = useRouter();
  const { contact } = useTrustedContact();
  // Trimmed contact name — defends the sub-line value against `contact`
  // existing-but-empty (stale stored contact saved with name=undefined;
  // defensive whitespace strip).
  const trustedContactName = contact?.name?.trim();
  // Value copy: actual name when set, "Add someone you trust" as a warm
  // placeholder otherwise. Mirrors the entry copy on
  // /trusted-contact-setup ("Tap to add someone you trust.") so the
  // user sees continuity between the row value and the screen it pushes
  // to.
  const trustedContactValue = trustedContactName ?? 'Add someone you trust';

  function handleEditTrustedContact() {
    // Default routing returns here via back() on save/skip — that's the
    // default since the 2026-06-01 inversion. No `from` param needed.
    router.push('/trusted-contact-setup');
  }

  function handleRecordings() {
    router.push('/recordings');
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SettingsHeader
          title="Safety"
          onBack={() => router.back()}
          onClose={() => router.replace('/home')}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <RowGroup>
            <SettingsRow
              icon={<Asterisk size={24} color={colors.red} weight="bold" />}
              label="Emergency SOS"
              value="Reach a trusted contact or 911"
              onPress={() => router.push('/emergency')}
              accessibilityHint="Opens the SOS screen to call your trusted contact or 911"
            />
            <SettingsRow
              icon={<UserCircle size={24} color={colors.black} weight="duotone" />}
              label="Trusted Contact"
              value={trustedContactValue}
              onPress={handleEditTrustedContact}
            />
            <SettingsRow
              icon={<Microphone size={24} color={colors.black} weight="duotone" />}
              label="Recordings"
              onPress={handleRecordings}
            />
          </RowGroup>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.systemGroupedBackground,
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
});
