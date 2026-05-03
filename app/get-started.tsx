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
        Flat divider (not a hill curve) — cars will eventually sit on the seam.
      */}
      <View style={styles.ground} />

      {/* TODO: row of cartoon cars + smoke trail across the divider */}

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
            {/* TODO: Apple logo icon */}
            <Text style={styles.outlinedButtonText}>Continue with Apple</Text>
          </Pressable>

          <Pressable
            style={styles.outlinedButton}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            {/* TODO: Google logo icon */}
            <Text style={styles.outlinedButtonText}>Continue with Google</Text>
          </Pressable>

          <Pressable
            style={styles.outlinedButton}
            accessibilityRole="button"
            accessibilityLabel="Continue with Email"
          >
            {/* TODO: Email envelope icon */}
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
