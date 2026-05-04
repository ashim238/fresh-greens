import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageControl } from '../components/PageControl';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Onboarding panel 3 — "Your viewpoint is unique."
 * Third of three onboarding panels (Permissions is the 4th step in the
 * page-control sequence).
 *
 * Route: /onboarding-3
 * Figma node: 825:3525
 */
export default function Onboarding3() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.safe}>
        <View style={styles.topContent}>
          <PageControl total={4} activeIndex={2} />

          <View style={styles.titleAndCopy}>
            <Text style={styles.title}>Your viewpoint is unique</Text>
            <Text style={styles.body}>
              That gut feeling that tells you to turn onto a road you've been
              down before is valuable. Fresh Greens integrates your intuition
              into the navigation, creating a driving experience specific to
              you.
            </Text>
          </View>
        </View>

        {/*
          TODO: export the thinking-figure + thought-bubble illustration
          from Figma and render here as an absolute-positioned <Image>.
        */}

        <View style={styles.actions}>
          <Pressable
            style={styles.continueBtn}
            accessibilityRole="button"
            accessibilityLabel="Continue to Permissions"
            onPress={() => router.push('/permissions')}
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
