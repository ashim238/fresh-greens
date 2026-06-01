import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
        <SettingsHeader
          title="Zone Preferences"
          onBack={() => router.back()}
          onClose={() => router.replace('/home')}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <RowGroup>
            <SettingsRow
              label="Show zones overlay"
              trailing="toggle"
              toggleValue={showZones}
              onToggle={setShowZones}
              accessibilityHint="Shows or hides the zone safety overlay on the map"
            />
          </RowGroup>

          <RowGroup
            title="What we flag"
            footer="Affects route scoring and map flags."
          >
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
