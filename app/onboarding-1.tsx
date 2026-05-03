import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';

/**
 * Onboarding panel 1 — "Drive like you know these roads."
 * First of three onboarding panels; Permissions is the 4th step in the
 * page-control sequence.
 *
 * Route: /onboarding-1
 * Figma node: 825:3382
 */
export default function Onboarding1() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.safe}>
        {/* Top content: page control + title + body */}
        <View style={styles.topContent}>
          <View style={styles.pageControl}>
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotInactive]} />
            <View style={[styles.dot, styles.dotInactive]} />
            <View style={[styles.dot, styles.dotInactive]} />
          </View>

          <View style={styles.titleAndCopy}>
            <Text style={styles.title}>Drive like you know these roads</Text>
            <Text style={styles.body}>
              No one should feel uncomfortable on the open road. Fresh Greens
              places the agency back in your hands by suggesting routes that
              maximize visibility and familiarity.
            </Text>
          </View>
        </View>

        {/*
          TODO: export the hands + steering wheel illustration from Figma
          and render here as an absolute-positioned <Image>.
        */}

        {/* Bottom CTAs */}
        <View style={styles.actions}>
          {/* TODO: wire to /onboarding-2 once that screen exists */}
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
    justifyContent: 'space-between', // top content vs bottom CTAs
  },
  topContent: {
    width: '100%',
    gap: 32,
  },
  pageControl: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignSelf: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  dotInactive: {
    opacity: 0.3,
  },
  titleAndCopy: {
    width: '100%',
    gap: 32,
  },
  title: {
    color: colors.white,
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  body: {
    color: colors.white,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: -0.43,
  },
  actions: {
    width: '100%',
    // No gap between Continue and Skip — skipBtn's height: 48 already
    // provides comfortable separation.
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
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.23,
  },
  skipBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.23,
    textDecorationLine: 'underline',
  },
});
