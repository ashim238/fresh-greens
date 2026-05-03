import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../theme/colors';

/**
 * Welcome screen — the `/` route (default landing).
 * Figma node: 825:3162
 */
export default function Welcome() {
  const router = useRouter();

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
              hitSlop={12}
              accessibilityRole="checkbox"
              accessibilityLabel="I acknowledge the Privacy Policy and agree to Fresh Greens' Terms and Conditions."
            />
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

          {/* TODO: route to /login once that screen exists */}
          <Pressable
            style={[styles.button, styles.buttonSecondary]}
            accessibilityRole="button"
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
    paddingHorizontal: 24,
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
    marginBottom: 160, // matches Figma — pushes title up because actions are anchored at the bottom
  },
  title: {
    color: colors.white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: 0.38,
  },
  subtitle: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.23,
    marginTop: 16,
  },
  actions: {
    alignItems: 'center',
    gap: 16,
  },
  terms: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: 326, // match button column width so the row sits within the same vertical strip
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: colors.freshgreen,
    borderRadius: 2,
  },
  termsTextColumn: {
    flex: 1,
    gap: 4, // matches Figma — small gap between the two stacked rows
  },
  termsText: {
    color: colors.white,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.06,
  },
  link: {
    color: colors.freshgreen,
    textDecorationLine: 'underline',
  },
  button: {
    width: 326,
    height: 40,
    borderRadius: 1000, // pill — large radius clamps to half-height
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.freshgreen,
  },
  buttonSecondary: {
    backgroundColor: colors.wiltedgreen,
  },
  buttonText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.23,
  },
});
