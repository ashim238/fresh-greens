import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
// Phosphor deep-import bypasses the package's barrel — see
// app/trusted-contact-setup.tsx for the longer note + tsconfig
// `paths` mapping that keeps TypeScript happy.
import { Microphone } from 'phosphor-react-native/src/icons/Microphone';
import { UserCircle } from 'phosphor-react-native/src/icons/UserCircle';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRecordings } from '../hooks/useRecordings';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { typography } from '../theme/typography';

/**
 * Safety Settings — pushed from /menu's "Safety Settings" row.
 *
 * Hosts the safety-flow's user-facing preferences. v1 has just one
 * row: Trusted Contact. Future safety prefs (mic auto-on toggle,
 * preferred-guidance copy variants, etc.) will slot in as additional
 * rows here as they're built.
 *
 * Visual register matches /menu and the rest of the wiltedgreen
 * onboarding/account flow. Row treatment mirrors /menu's row pattern
 * (leading icon + label + value preview + chevron) so the navigation
 * feels like the same room, not a different one.
 *
 * Route: /safety-settings
 */
export default function SafetySettings() {
  const router = useRouter();
  const { contact } = useTrustedContact();
  const { recordings } = useRecordings();

  function handleBack() {
    router.back();
  }

  function handleEditTrustedContact() {
    // Reuse /trusted-contact-setup with from=settings so the screen
    // routes back here on save/skip rather than replacing with /home.
    router.push('/trusted-contact-setup?from=settings');
  }

  function handleRecordings() {
    router.push('/recordings');
  }

  const recordingsValue =
    recordings.length === 0
      ? 'None yet'
      : recordings.length === 1
        ? '1 recording'
        : `${recordings.length} recordings`;

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
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageTitle}>Safety Settings</Text>

          {/* Trusted contact row — same row pattern as /menu */}
          <Pressable
            onPress={handleEditTrustedContact}
            style={({ pressed }) => [styles.row, pressed && pressedDim]}
            accessibilityRole="button"
            accessibilityLabel={
              contact
                ? `Trusted contact: ${contact.name}. Tap to change.`
                : 'No trusted contact set. Tap to set one.'
            }
          >
            <View style={styles.rowIconWrap}>
              <UserCircle
                size={24}
                color={colors.wiltedgreen}
                weight="duotone"
              />
            </View>
            <View style={styles.rowTextStack}>
              <Text style={styles.rowLabel}>Trusted contact</Text>
              <Text style={styles.rowValue}>
                {contact?.name ?? 'Not set'}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.fadedgreen}
            />
          </Pressable>

          {/*
            Recordings — the audio captures from /pulled-over's safety
            flow live here because the entire reason recordings exist
            is the safety flow. Listing them on /menu would orphan them
            from their context; here they sit next to the trusted
            contact, the other artifact of that same flow.
          */}
          <Pressable
            onPress={handleRecordings}
            style={({ pressed }) => [styles.row, pressed && pressedDim]}
            accessibilityRole="button"
            accessibilityLabel={`Recordings, ${recordingsValue}. Tap to view.`}
          >
            <View style={styles.rowIconWrap}>
              <Microphone
                size={24}
                color={colors.wiltedgreen}
                weight="duotone"
              />
            </View>
            <View style={styles.rowTextStack}>
              <Text style={styles.rowLabel}>Recordings</Text>
              <Text style={styles.rowValue}>{recordingsValue}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.fadedgreen}
            />
          </Pressable>

          {/*
            Future rows slot in here as more safety preferences ship.
            Anticipated: "Mic auto-on" toggle, "Preferred guidance copy"
            (ACLU vs custom), "Auto-call trusted contact on serious
            events" (with confirmation), etc. Architecture is row-based
            so additions don't restructure the screen.
          */}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.wiltedgreen,
  },
  safe: {
    flex: 1,
  },

  // --- Header ---
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

  scrollContent: {
    paddingHorizontal: 32,
    paddingBottom: 32,
    gap: 24,
  },
  pageTitle: {
    ...typography.title1Emphasized,
    color: colors.white,
  },

  // --- Row pattern (mirrored from /menu) ---
  // 16pt gap (icon ↔ text) and 36pt white-circle icon tile match the
  // /menu row treatment exactly so the navigation register is one
  // visual language, not two.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    minHeight: 56,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextStack: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...typography.bodyEmphasized,
    color: colors.white,
  },
  rowValue: {
    ...typography.subheadlineRegular,
    color: colors.fadedgreen,
  },
});
