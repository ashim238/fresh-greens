import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useUser } from '../hooks/useUser';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Welcome screen — the `/` route (default landing).
 * Figma node: 825:3162
 */
export default function Welcome() {
  const router = useRouter();
  const { user, loading } = useUser();
  // Terms acknowledgement — was previously a decorative Pressable with no
  // state. Now a real toggle so VoiceOver can announce the checked state
  // and so we can later gate the primary CTAs on consent (TODO).
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Auto-redirect signed-in users to /home. The `loading` guard avoids
  // a flash of Welcome while AsyncStorage is being read on cold start —
  // we don't navigate until we actually know whether someone's signed
  // in. router.replace (not push) so they can't swipe-back to /.
  useEffect(() => {
    if (!loading && user) {
      router.replace('/home');
    }
  }, [loading, user, router]);

  return (
    <View style={styles.root}>
      {/*
        StatusBar = the iOS clock/battery row at the top.
        "light" makes the icons white so they read on the orange sky.
      */}
      <StatusBar style="light" />

      {/*
        Sun — rendered BEFORE the hill so the hill paints over its bottom half,
        creating the "rising sun" silhouette without needing a pre-clipped asset.
        JSX source order = z-order: later siblings render on top.
      */}
      <Image
        source={require('../assets/illustrations/welcome-sun.png')}
        style={styles.sun}
        resizeMode="contain"
        accessible={false}
      />

      {/*
        The hill. Sits absolutely at the bottom, behind the content.
        Approximated with a tall View + a big top borderRadius — good enough
        for v1. The Figma version has a more organic curve we can swap in
        later as an SVG.
      */}
      <View style={styles.hill} />

      {/*
        SafeAreaView pads its children away from the notch and home indicator
        so text/buttons don't sit underneath them.
      */}
      <SafeAreaView style={styles.content}>
        {/*
          The Vic character. resizeMode="contain" scales the image to fit
          inside its container while preserving aspect ratio — no squish.
          The wrapping View has flex: 1 so it claims the leftover vertical
          space (same role the placeholder used to play).
        */}
        <View style={styles.illustrationContainer}>
          <Image
            source={require('../assets/illustrations/welcome-vic.png')}
            style={styles.welcomeVic}
            resizeMode="contain"
            accessible
            accessibilityLabel="Illustration of a person waving from inside a location pin"
          />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>Fresh Greens</Text>
          <Text style={styles.subtitle}>A path made for you, by you</Text>
        </View>

        <View style={styles.actions}>
          <View style={styles.terms}>
            <Pressable
              style={styles.checkbox}
              hitSlop={20}
              onPress={() => setTermsAccepted((prev) => !prev)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              accessibilityLabel="I acknowledge the Privacy Policy and agree to Fresh Greens' Terms and Conditions."
            >
              {termsAccepted && (
                <Ionicons
                  name="checkmark"
                  size={18}
                  color={colors.freshgreen}
                />
              )}
            </Pressable>
            {/*
              Two stacked Text rows match the Figma line breaks exactly,
              instead of letting the text auto-wrap wherever it fits.
            */}
            <View style={styles.termsTextColumn}>
              <Text style={styles.termsText}>
                I acknowledge the{' '}
                <Text style={styles.link}>Privacy Policy</Text> and agree to
              </Text>
              <Text style={styles.termsText}>
                Fresh Greens'{' '}
                <Text style={styles.link}>Terms and Conditions</Text>.
              </Text>
            </View>
          </View>

          <Pressable
            style={[styles.button, styles.buttonPrimary]}
            accessibilityRole="button"
            onPress={() => router.push('/get-started')}
          >
            <Text style={styles.buttonText}>Get started</Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.buttonSecondary]}
            accessibilityRole="button"
            onPress={() => router.push('/login')}
          >
            <Text style={styles.buttonText}>Have an account? Log in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Brand-exception use of a reserved color — see .cursorrules
    backgroundColor: colors.orange,
  },
  hill: {
    // Extending past the screen edges + huge radius gives a gentle arc
    // (only the middle of a much wider ellipse is visible). With borderRadius
    // alone on a screen-width element, RN clamps to half-width and you get
    // a tombstone dome instead of a hill.
    position: 'absolute',
    bottom: 0,
    left: -160,
    right: -160,
    height: '55%',
    backgroundColor: colors.burntgreen,
    borderTopLeftRadius: 600,
    borderTopRightRadius: 600,
  },
  sun: {
    // Centered horizontally on screen, sitting at the top of the hill so the
    // bottom half is hidden by the hill's overlap (the hill renders later in
    // JSX = paints on top).
    position: 'absolute',
    top: '41%', // tune to nudge sun up/down relative to the hill ridge
    left: '50%',
    marginLeft: -45, // half the width — classic absolute-centering trick
    width: 90,
    height: 90,
  },
  content: {
    flex: 1,
    // 32pt gutter matches Figma's intent on the 390pt baseline (390 -
    // 326 = 64 ÷ 2). Buttons + terms now stretch to fill the content
    // width instead of hardcoding 326, so on Pro Max they grow with
    // the device rather than orphaning in the middle.
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  illustrationContainer: {
    flex: 1, // claims all leftover vertical space above the title
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeVic: {
    width: 200,
    height: 250,
    // transform shifts the image without affecting layout flow.
    // translateX negative = move left (so the marker pin's point lines up
    //   with the canvas's horizontal center, compensating for the raised arm
    //   extending the bounding box to the left).
    // translateY negative = move up (creating room below for the sun export).
    // Tune both numbers to taste.
    transform: [{ translateX: -20 }, { translateY: -50 }],
  },
  titleBlock: {
    alignItems: 'center',
    gap: 16, // matches Figma — flex column gap between title and subtitle
    marginBottom: 160, // matches Figma — pushes title up because actions are anchored at the bottom
  },
  title: {
    ...typography.title1Emphasized,
    color: colors.white,
  },
  subtitle: {
    ...typography.subheadlineRegular,
    color: colors.white,
  },
  actions: {
    // alignItems: stretch so children with alignSelf: 'stretch' actually
    // fill the container width. Center is the wrong cross-axis for a
    // responsive button column — children would shrink to intrinsic.
    alignItems: 'stretch',
    gap: 16,
  },
  terms: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'stretch', // tracks parent gutter so terms row aligns with buttons across devices
  },
  checkbox: {
    // 24pt visual (was 18pt). Below the 44pt HIG minimum because it's
    // visually paired with multi-line legal copy at the same eye level
    // — a 44pt box would dominate the layout. This is the exception
    // clause case (.cursorrules tap-target rule): genuinely-constrained
    // dense row, hitSlop=20 brings the effective tap area to 64pt
    // which exceeds 44pt.
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.freshgreen,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsTextColumn: {
    flex: 1,
    gap: 4, // matches Figma — small gap between the two stacked rows
  },
  termsText: {
    ...typography.caption2Regular,
    color: colors.white,
  },
  link: {
    color: colors.freshgreen,
    textDecorationLine: 'underline',
  },
  button: {
    alignSelf: 'stretch', // grows with device width instead of hardcoded 326
    height: 44,
    borderRadius: 1000, // pill — large radius clamps to half-height
    alignItems: 'center',
    justifyContent: 'center',
    // Approximates Figma M3 Elevation Light/1 (the larger of two layers).
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  buttonPrimary: {
    backgroundColor: colors.freshgreen,
  },
  buttonSecondary: {
    backgroundColor: colors.wiltedgreen,
  },
  buttonText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
  },
});
