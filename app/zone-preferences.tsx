import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Phosphor deep-imports per CLAUDE.md icon rule (project_icons_phosphor.md).
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { MapPinArea } from 'phosphor-react-native/src/icons/MapPinArea';

import { usePreferences } from '../hooks/usePreferences';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Zone Preferences — pushed from /menu's "Zone Preferences" row.
 *
 * v1 surfaced these controls as an inline-expanded accordion inside
 * /menu (the row's chevron flipped CaretDown ↔ CaretUp, and the toggle
 * column slid open underneath). The accordion's discoverability was
 * weak — user-flagged 2026-06-01 — and the controls grew enough that
 * an accordion no longer fit cleanly in a menu row's vertical budget.
 *
 * The dedicated page mirrors the /safety-settings register (back
 * chevron strip → leading-glyph title row → grouped toggle rows).
 * "What we flag" caption separates the display-only Show-zones-overlay
 * toggle from the three scoring-affecting flag toggles.
 *
 * Route: /zone-preferences
 */
export default function ZonePreferences() {
  const router = useRouter();
  const { preferences, setShowZones, setPreference } = usePreferences();

  // Same default ladder as the /menu accordion that this page replaces —
  // showZones false-by-default (start with a clean map), flag toggles
  // true-by-default (scoring is the load-bearing feature; opt-out
  // rather than opt-in).
  const showZones = preferences?.showZones ?? false;
  const flagPolice = preferences?.flagPolice ?? true;
  const flagLowLight = preferences?.flagLowLight ?? true;
  const flagCommunityReports = preferences?.flagCommunityReports ?? true;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
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
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/*
            Title row mirrors /safety-settings (Shield + "Safety") and
            /recordings (Microphone + "Recordings"): 48pt duotone glyph
            + title2Emphasized. All three /menu sub-pages share the
            register, so back-to-back viewing reads coherent.
          */}
          <View style={styles.titleRow}>
            <MapPinArea size={48} color={colors.black} weight="duotone" />
            <Text style={styles.pageTitle} accessibilityRole="header">
              Zone Preferences
            </Text>
          </View>

          {/*
            Display group — one row. Show-zones-overlay is display-only
            (no effect on scoring), so it sits in its own group above
            the "What we flag" caption that groups the scoring-affecting
            toggles below it.
          */}
          <View style={styles.rowGroup}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Show zones overlay</Text>
              <Switch
                value={showZones}
                onValueChange={setShowZones}
                trackColor={{
                  false: colors.cardBorderSubtle,
                  true: colors.freshgreen,
                }}
                thumbColor={colors.white}
                accessibilityLabel="Toggle zones overlay"
                // VoiceOver users can't see the map; hint pairs the
                // control with its effect (design-system §2.1).
                accessibilityHint="Shows or hides the zone safety overlay on the map"
              />
            </View>
          </View>

          {/*
            "What we flag" — the safety factors that shape route scoring
            and map flags. Grouped apart from the display-only overlay
            toggle so the user can tell at a glance which toggles affect
            their routes and which only affect visibility.
          */}
          <View>
            <Text style={styles.groupCaption}>What we flag</Text>
            <View style={styles.rowGroup}>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Police presence</Text>
                <Switch
                  value={flagPolice}
                  onValueChange={(v) => setPreference('flagPolice', v)}
                  trackColor={{
                    false: colors.cardBorderSubtle,
                    true: colors.freshgreen,
                  }}
                  thumbColor={colors.white}
                  accessibilityLabel="Flag police presence"
                  accessibilityHint="Will affect which areas shape your route scoring and map flags"
                />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Low-light areas</Text>
                <Switch
                  value={flagLowLight}
                  onValueChange={(v) => setPreference('flagLowLight', v)}
                  trackColor={{
                    false: colors.cardBorderSubtle,
                    true: colors.freshgreen,
                  }}
                  thumbColor={colors.white}
                  accessibilityLabel="Flag low-light areas"
                  accessibilityHint="Will affect which areas shape your route scoring and map flags"
                />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Community reports</Text>
                <Switch
                  value={flagCommunityReports}
                  onValueChange={(v) => setPreference('flagCommunityReports', v)}
                  trackColor={{
                    false: colors.cardBorderSubtle,
                    true: colors.freshgreen,
                  }}
                  thumbColor={colors.white}
                  accessibilityLabel="Flag community reports"
                  accessibilityHint="Will affect which areas shape your route scoring and map flags"
                />
              </View>
            </View>
          </View>
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
  // Matches /safety-settings: 16/8 strip with a 44pt centered tap target.
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },

  // Title row pattern from /recordings + /safety-settings — leading
  // 48pt duotone glyph + Title2Emphasized.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pageTitle: {
    ...dynamicType(typography.title2Emphasized),
    color: colors.black,
    flex: 1,
  },

  // Row group — toggles in their own card-shaped container with a
  // soft divider between them via gap. Matches /safety-settings'
  // rowGroup gap rhythm.
  rowGroup: {
    gap: spacing.md,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: spacing.xs,
  },
  toggleLabel: {
    ...dynamicType(relaxedLineHeight(typography.bodyRegular)),
    color: colors.black,
    flex: 1,
    paddingRight: spacing.md,
  },

  // "What we flag" group caption — same hierarchy decision as the v1
  // accordion: footnoteEmphasized + labelSecondary so it reads as a
  // sub-group label below the page title, not as a peer-section
  // divider.
  groupCaption: {
    ...dynamicType(relaxedLineHeight(typography.footnoteEmphasized)),
    color: colors.labelSecondary,
    paddingBottom: spacing.sm,
  },
});
