import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
// Phosphor deep-import bypasses the package's barrel — see
// app/trusted-contact-setup.tsx for the longer note + tsconfig
// `paths` mapping that keeps TypeScript happy.
import { Microphone } from 'phosphor-react-native/src/icons/Microphone';
import { Shield } from 'phosphor-react-native/src/icons/Shield';
// Red star glyph — the shared SOS/"get help" mark, identical to
// /en-route's SOS side-button and /emergency's main button. Replaced
// the prior red medical-cross SVG (user-flagged 2026-06-01) because
// the cross shape conflicted with the protected Red Cross emblem.
// See app/emergency.tsx for the full rationale.
import { Star } from 'phosphor-react-native/src/icons/Star';
import { UserCircle } from 'phosphor-react-native/src/icons/UserCircle';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRecordings } from '../hooks/useRecordings';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { typography } from '../theme/typography';

/**
 * Safety Settings — pushed from /menu's "Safety" row.
 *
 * v2 redesign per Figma `1128:5284`: register flips from wiltedgreen-
 * on-dark to white-on-light to match /recordings (Round 5 PR A) and
 * /menu's redesigned register. The old wiltedgreen page was the only
 * green surface left in the /menu→sub-page navigation, which read as
 * a jarring transition.
 *
 * Layout: back chevron (top-left) → shield glyph + "Safety" title →
 * two rows (Trusted Contact with the contact name as sub-line,
 * Recordings as a label-only row). Future safety prefs slot in as
 * additional rows.
 *
 * Route: /safety-settings
 */
export default function SafetySettings() {
  const router = useRouter();
  const { contact } = useTrustedContact();
  const { recordings } = useRecordings();
  // Trimmed contact name — defends the a11y label and the sub-line
  // both against `contact` existing-but-empty (stale stored contact
  // saved with name=undefined; defensive whitespace strip).
  const trustedContactName = contact?.name?.trim();
  // Sub-line copy: actual name when set, "Add someone you trust"
  // as a warm placeholder otherwise. Mirrors the entry copy on
  // /trusted-contact-setup ("Tap to add someone you trust.") so the
  // user sees continuity between the row sub-line and the screen it
  // pushes to. Always-rendered so the row doesn't change height
  // when a contact is first saved.
  const trustedContactValue = trustedContactName ?? 'Add someone you trust';
  // Recordings count is no longer surfaced visually per Figma v2,
  // but VoiceOver users benefit from hearing it before they tap in.
  const recordingsA11yCount =
    recordings.length === 0
      ? 'none yet'
      : recordings.length === 1
        ? '1 saved'
        : `${recordings.length} saved`;

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
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/*
            Title row mirrors /recordings (Microphone + "Recordings")
            so the two safety-flow surfaces share visual language. 48pt
            duotone shield + title2Emphasized matches that pattern.
          */}
          <View style={styles.titleRow}>
            <Shield size={48} color={colors.black} weight="duotone" />
            <Text style={styles.pageTitle}>Safety</Text>
          </View>

          {/*
            Settings rows live in their own group with a tighter gap
            (16pt) so the within-group rhythm reads as related-items.
            The outer scrollContent gap (32pt) keeps the title block
            visually separated from the row group.
          */}
          <View style={styles.rowGroup}>
            {/* Emergency SOS — the most consequential row, so it sits
                first. Routes straight to the /emergency surface (the
                same one /safety's SOS bar and the /en-route SOS side-
                button open), giving safety-settings its own direct path
                to the crisis control. The red medical-cross glyph (vs
                the black duotone glyphs below) marks it as the emergency
                row and matches the SOS symbol used everywhere else. */}
            <Pressable
              onPress={() => router.push('/emergency')}
              style={({ pressed }) => [styles.row, pressed && pressedDim]}
              accessibilityRole="button"
              accessibilityLabel="Emergency SOS. Reach a trusted contact or 911."
            >
              <Star size={28} color={colors.red} weight="fill" />
              <View style={styles.rowTextStack}>
                <Text style={styles.rowLabel}>Emergency SOS</Text>
                <Text style={styles.rowValue}>Reach a trusted contact or 911</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.labelTertiary}
              />
            </Pressable>

            {/* Trusted Contact row — name when set, "Not set" otherwise.
                Always renders a sub-line for layout stability so the
                row doesn't change height on first save. */}
            <Pressable
              onPress={handleEditTrustedContact}
              style={({ pressed }) => [styles.row, pressed && pressedDim]}
              accessibilityRole="button"
              accessibilityLabel={
                trustedContactName
                  ? `Trusted contact: ${trustedContactName}. Tap to change.`
                  : 'No trusted contact yet. Tap to add someone you trust.'
              }
            >
              <UserCircle size={28} color={colors.black} weight="duotone" />
              <View style={styles.rowTextStack}>
                <Text style={styles.rowLabel}>Trusted Contact</Text>
                <Text style={styles.rowValue}>{trustedContactValue}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                // SAF6: 20 → 16 to match /menu's SettingsRow chevron.
                // This sub-page is reached from /menu's Safety row and
                // shares its visual register; the 4pt trailing-icon
                // discrepancy was noticeable in back-to-back viewing.
                size={16}
                color={colors.labelTertiary}
              />
            </Pressable>

            {/*
              Recordings — the audio captures from /pulled-over's
              safety flow live here because the entire reason
              recordings exist is the safety flow. v2 layout drops the
              visible count sub-line, but the count is still surfaced
              in the accessibilityLabel for VoiceOver users.
            */}
            <Pressable
              onPress={handleRecordings}
              style={({ pressed }) => [styles.row, pressed && pressedDim]}
              accessibilityRole="button"
              accessibilityLabel={`Recordings, ${recordingsA11yCount}. Tap to view.`}
            >
              <Microphone size={28} color={colors.black} weight="duotone" />
              <View style={styles.rowTextStack}>
                <Text style={styles.rowLabel}>Recordings</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                // SAF6: 20 → 16 to match /menu's SettingsRow chevron.
                // This sub-page is reached from /menu's Safety row and
                // shares its visual register; the 4pt trailing-icon
                // discrepancy was noticeable in back-to-back viewing.
                size={16}
                color={colors.labelTertiary}
              />
            </Pressable>
          </View>

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
    backgroundColor: colors.white,
  },
  safe: {
    flex: 1,
  },

  // --- Header (back chevron strip) ---
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

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 32,
  },
  // Title row pattern from /recordings — leading 48pt duotone glyph
  // + Title2Emphasized so the two safety-flow surfaces share register.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  pageTitle: {
    ...typography.title2Emphasized,
    color: colors.black,
  },

  // Wraps the two settings rows so they sit 16pt apart from each
  // other while the title-to-row-group distance stays at the outer
  // scrollContent's 32pt gap. Without this nesting, both gaps would
  // be 32 and two visually-similar rows would feel like two
  // separate sections.
  rowGroup: {
    gap: 16,
  },

  // --- Row pattern ---
  // Deliberate third row variant — distinct from /menu (which uses
  // gap:12, subheadlineEmphasized, 24pt icon inside a layout slot)
  // and from /recordings (whose rows are cards, not settings rows).
  // The Figma v2 (1128:5284) simplifies the row to bare 28pt icon +
  // bodyEmphasized label + optional sub-line + chevron, with no
  // wrapping container around the icon. Keeping this divergent from
  // /menu's row because the safety-settings page is a settings hub,
  // not a navigation drawer — a heavier label register reads as
  // settable, not just navigable.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  rowTextStack: {
    flex: 1,
    // SAF3: 2 → 4. The 2pt gap was off the 4pt grid and collapsed to
    // visually zero between the 17pt label and 15pt value under large
    // Dynamic Type. 4pt (spacing.xs) holds the hierarchy on the ramp.
    gap: 4,
  },
  rowLabel: {
    ...typography.bodyEmphasized,
    color: colors.black,
  },
  rowValue: {
    // SAF7: subheadlineRegular (15pt) → footnoteRegular (13pt). At 15pt
    // the value sub-line read close to a second label, especially for
    // long names ("Alexandra Thompson-Rivera"). 13pt gives a cleaner
    // 3-step hierarchy (17pt label → 13pt value → chevron), matching
    // the /menu + /recordings sub-line register.
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
  },
});
