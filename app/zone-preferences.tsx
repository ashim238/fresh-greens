import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingState } from '../components/StateCard';
import { RowGroup } from '../components/settings/RowGroup';
import { SettingsHeader } from '../components/settings/SettingsHeader';
import { SettingsRow } from '../components/settings/SettingsRow';

import { usePreferences } from '../hooks/usePreferences';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

/**
 * Zone Preferences — pushed from /menu's "Zone Preferences" row.
 *
 * v1 surfaced these controls as an inline-expanded accordion inside
 * /menu (the row's chevron flipped CaretDown ↔ CaretUp, and the toggle
 * column slid open underneath). The accordion's discoverability was
 * weak — user-flagged 2026-06-01 — and the controls grew enough that
 * an accordion no longer fit cleanly in a menu row's vertical budget.
 *
 * The dedicated page rides the shared settings register: SettingsHeader
 * (title + chevron-back + close-X) over grouped-gray, with two RowGroups
 * of toggle SettingsRows. The display-only Show-zones-overlay toggle
 * sits in its own group above the "What we flag" group, whose footer
 * caption flags that those three toggles shape route scoring.
 *
 * Route: /zone-preferences
 */
export default function ZonePreferences() {
  const router = useRouter();
  const prefsState = usePreferences();
  const { setShowZones, setPreference } = prefsState;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <SettingsHeader
          title="Zone Preferences"
          onBack={() => router.back()}
          onClose={() => router.replace('/home')}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!prefsState.ready ? (
            <LoadingState text="Loading preferences…" />
          ) : (() => {
            // Degraded-state surfacing: when all three flag toggles are off,
            // route scoring has no safety signals to weigh — routes degrade
            // to distance/time only. Silent in v1; user-flagged as a P1.
            // Replace the normal footer caption with an honest note in the
            // same iOS grouped-settings register (RowGroup footer slot).
            const { showZones, flagPolice, flagLowLight, flagCommunityReports } =
              prefsState.preferences;
            const allFlagsOff = !flagPolice && !flagLowLight && !flagCommunityReports;
            const flagsFooter = allFlagsOff
              ? 'All three off — routes are scored on distance and time only. No safety signals factor in.'
              : 'Affects route scoring and map flags.';
            return (
              <>
                <RowGroup>
                  <SettingsRow
                    label="Show zones overlay"
                    trailing="toggle"
                    toggleValue={showZones}
                    onToggle={setShowZones}
                    accessibilityHint="Shows or hides the zone safety overlay on the map"
                  />
                </RowGroup>

                <RowGroup title="What we flag" footer={flagsFooter}>
                  <SettingsRow
                    label="Police presence"
                    trailing="toggle"
                    toggleValue={flagPolice}
                    onToggle={(v) => setPreference('flagPolice', v)}
                    accessibilityHint="Routes around mapped police presence when on"
                  />
                  <SettingsRow
                    label="Low-light areas"
                    trailing="toggle"
                    toggleValue={flagLowLight}
                    onToggle={(v) => setPreference('flagLowLight', v)}
                    accessibilityHint="Routes around poorly-lit streets when on"
                  />
                  <SettingsRow
                    label="Community reports"
                    trailing="toggle"
                    toggleValue={flagCommunityReports}
                    onToggle={(v) => setPreference('flagCommunityReports', v)}
                    accessibilityHint="Factors neighbor-submitted reports when on"
                  />
                </RowGroup>
              </>
            );
          })()}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfacePage,
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
});
