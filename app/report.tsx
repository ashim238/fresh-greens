import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * /report — community reporting flow.
 *
 * STUB: this PR (feat/home-report-button) wires the entry point on /home
 * to push here, but the real reporting UI (category picker, per-category
 * detail screens, Thank-You confirmation) lands in the next PR
 * (feat/community-report). For now this is a placeholder so navigation
 * works end-to-end without falling through to expo-router's auto-generated
 * unmatched-route screen.
 *
 * Figma nodes (for the next PR): 984:5010, 987:4291, 992:4752, 992:4933,
 * 992:3933, 992:4123.
 */
export default function ReportStub() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>Report</Text>
        <Text style={styles.subtitle}>
          Coming next. The full reporting flow lands in the next PR.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.buttonText}>Back</Text>
        </Pressable>
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
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    ...typography.title1Emphasized,
    color: colors.black,
  },
  subtitle: {
    ...typography.subheadlineRegular,
    color: '#3D3D3D',
    textAlign: 'center',
  },
  button: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 100,
    backgroundColor: colors.freshgreen,
  },
  buttonText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
  },
});
