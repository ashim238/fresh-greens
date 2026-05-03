import { Ionicons } from '@expo/vector-icons';
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
 * Get Started — auth/signup entry screen.
 * Route: /get-started
 * Figma node: 825:3245
 */
export default function GetStarted() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/*
        Background split: top wiltedgreen sky, bottom burntgreen ground.
        Flat divider — cars sit right on the seam.
      */}
      <View style={styles.ground} />

      {/*
        Cars + smoke trail. Anchored absolutely to the divider line (top: 20%
        matches the ground's 80% bottom height). Spans the full width.
      */}
      <Image
        source={require('../assets/illustrations/get-started-cars.png')}
        style={styles.cars}
        resizeMode="contain"
        accessible
        accessibilityLabel="Three cartoon cars driving across the horizon with smoke trail"
      />

      <SafeAreaView style={styles.content}>
        <View style={styles.spacerTop} />

        <Text style={styles.title}>Get started</Text>

        <View style={styles.actions}>
          {/* TODO: real auth handlers — these are visual-only for now */}
          <Pressable
            style={styles.outlinedButton}
            accessibilityRole="button"
            accessibilityLabel="Continue with Apple"
          >
            <Ionicons name="logo-apple" size={20} color={colors.white} />
            <Text style={styles.outlinedButtonText}>Continue with Apple</Text>
          </Pressable>

          <Pressable
            style={styles.outlinedButton}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            {/*
              TODO: replace with brand-accurate multi-color Google G.
              Ionicons only ships a single-color glyph; the official Google asset
              has brand guidelines that warrant a separate import later.
            */}
            <Ionicons name="logo-google" size={20} color={colors.white} />
            <Text style={styles.outlinedButtonText}>Continue with Google</Text>
          </Pressable>

          <Pressable
            style={styles.outlinedButton}
            accessibilityRole="button"
            accessibilityLabel="Continue with Email"
          >
            <Ionicons name="mail-outline" size={20} color={colors.white} />
            <Text style={styles.outlinedButtonText}>Continue with Email</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={styles.loginRow}
            accessibilityRole="link"
            accessibilityLabel="Already have an account? Log in"
          >
            <Text style={styles.loginPrompt}>
              Already have an account?{' '}
              <Text style={styles.loginLink}>Log in</Text>
            </Text>
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
  ground: {
    // Flat-edged lower section — no curve. Just a colored block at the bottom.
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '80%',
    backgroundColor: colors.burntgreen,
  },
  cars: {
    // Anchored to the seam between sky (top 20%) and ground (bottom 80%).
    // Explicit width: '100%' is required — Image + absolute positioning with
    // only left/right shorthand can fall back to the asset's natural pixel
    // size (huge, since it's a 3x export).
    position: 'absolute',
    top: '16%',
    left: 0,
    width: '100%',
    height: 110,
    // translateX shifts the whole image right, pushing the smoke trail off
    // the left edge while the cars sit in the right portion of the screen.
    transform: [{ translateX: 110 }],
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  spacerTop: {
    // Pushes title down below the (future) cars illustration row.
    // Tune this once the illustration lands.
    height: 200,
  },
  title: {
    color: colors.white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: 0.38,
    textAlign: 'center',
    marginBottom: 88, // matches Figma — gap between title and button stack
  },
  actions: {
    width: 326,
    gap: 16,
  },
  outlinedButton: {
    width: 326,
    height: 48,
    borderRadius: 100, // pill
    borderWidth: 1,
    borderColor: colors.wiltedgreen,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8, // space between (future) icon and label
  },
  outlinedButtonText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.23,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.wiltedgreen,
  },
  dividerLabel: {
    color: colors.freshgreen,
    fontSize: 12,
    lineHeight: 16,
  },
  loginRow: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loginPrompt: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.08,
    textAlign: 'center',
  },
  loginLink: {
    color: colors.freshgreen,
    fontWeight: '600',
  },
});
