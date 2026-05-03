import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageControl } from '../components/PageControl';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Onboarding panel 2 — "For us, by us."
 * Second of three onboarding panels (Permissions is the 4th step in the
 * page-control sequence).
 *
 * Route: /onboarding-2
 * Figma node: 825:3444
 */
export default function Onboarding2() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.safe}>
        <View style={styles.topContent}>
          <PageControl total={4} activeIndex={1} />

          <View style={styles.titleAndCopy}>
            <Text style={styles.title}>For us, by us</Text>
            <Text style={styles.body}>
              Fresh Greens relies on insights shared by travelers like you.
              Community contributions are vital in the mapping process,
              ensuring drivers have a full understanding of their surroundings,
              from road hazards to the treatment{'\n'}of Black visitors.
            </Text>
          </View>
        </View>

        {/*
          TODO: export the sitting figure + speech bubble illustration from
          Figma and render here as an absolute-positioned <Image>.
        */}

        <View style={styles.actions}>
          {/* TODO: wire to /onboarding-3 once that screen exists */}
          <Pressable
            style={styles.continueBtn}
            accessibilityRole="button"
            accessibilityLabel="Continue to next onboarding step"
          >
            <Text style={styles.continueText}>Continue</Text>
          </Pressable>

          <Pressable
            style={styles.skipBtn}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            onPress={() => router.push('/permissions')}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>
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
    paddingHorizontal: 32,
    paddingBottom: 34,
    justifyContent: 'space-between',
  },
  topContent: {
    width: '100%',
    gap: 32,
  },
  titleAndCopy: {
    width: '100%',
    gap: 32,
  },
  title: {
    ...typography.largeTitleEmphasized,
    color: colors.white,
  },
  body: {
    ...typography.bodyRegular,
    color: colors.white,
  },
  actions: {
    width: '100%',
  },
  continueBtn: {
    backgroundColor: colors.freshgreen,
    height: 40,
    borderRadius: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  continueText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
  },
  skipBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
    textDecorationLine: 'underline',
  },
});
