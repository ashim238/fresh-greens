import { StatusBar } from 'expo-status-bar';
import {
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
  return (
    <View style={styles.root}>
      {/*
        StatusBar = the iOS clock/battery row at the top.
        "light" makes the icons white so they read on the orange sky.
      */}
      <StatusBar style="light" />

      {/*
        The hill. Sits absolutely at the bottom, behind the content.
        Approximated with a tall View + a big top borderRadius — good enough
        for v1. The Figma version has a more organic curve we can swap in
        later as an SVG.
      */}
      <View style={styles.hill} />

      {/*
        TODO: drop in the Figma illustration (Vic + clouds + sun + wind glyphs)
        as a single PNG export. Skipping for v1 to ship the layout first.
      */}

      {/*
        SafeAreaView pads its children away from the notch and home indicator
        so text/buttons don't sit underneath them.
      */}
      <SafeAreaView style={styles.content}>
        {/* Top spacer pushes the title block toward the hill */}
        <View style={styles.illustrationPlaceholder} />

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
          >
            <Text style={styles.buttonText}>Get started</Text>
          </Pressable>

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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  illustrationPlaceholder: {
    flex: 1, // claims all leftover vertical space above the title
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
