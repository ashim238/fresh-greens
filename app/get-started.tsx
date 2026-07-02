import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import LogoApple from '../assets/illustrations/logo-apple.svg';
import { useUser } from '../hooks/useUser';
import { getStoredUser } from '../lib/api/user';
import { getErrorMessage } from '../lib/error-message';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { dynamicType } from '../theme/dynamic-type';
import { typography } from '../theme/typography';

/**
 * Get Started — auth/signup entry screen for first-time users.
 *
 * Sign in with Apple is the only auth provider in v1 — deliberate: it
 * satisfies Apple's sign-in requirement and keeps the account model
 * minimal. No Google/Email placeholders.
 *
 * On successful Apple Sign In:
 *   - First-time user (no prior stored user) → /onboarding (full intro)
 *   - Returning user (stored user already exists) → /home (skip intro)
 * The hook's signInWithApple does an upsert that merges cached
 * displayName/email with Apple's first-sign-in-only fields, so
 * returning users keep their identity even though Apple won't return
 * fullName again.
 *
 * "Already have an account? Log in" routes to /login — the dedicated
 * returning-user path that always skips onboarding.
 *
 * Route: /get-started
 * Figma node: 825:3245
 */
export default function GetStarted() {
  const router = useRouter();
  const { signInWithApple } = useUser();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAppleSignIn() {
    if (signingIn) return;
    setError(null);
    setSigningIn(true);
    try {
      // First-time vs returning is decided by whether a user was already
      // stored before this sign-in attempt. Apple itself doesn't tell us
      // (it returns the same stable user-id whether it's the user's
      // first or fiftieth sign-in to this app), so we check storage.
      const wasReturning = (await getStoredUser()) !== null;
      await signInWithApple();
      // Success haptic confirms the Apple sheet completed cleanly —
      // the visual transition (sheet dismiss → router.replace) is fast
      // enough that a confirmation cue helps the user know the sign-in
      // landed before /home or /onboarding paints.
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      router.replace(wasReturning ? '/home' : '/onboarding');
    } catch (err: unknown) {
      // expo-apple-authentication throws ERR_REQUEST_CANCELED when the
      // user dismisses the sheet — that's not an error worth surfacing.
      const code = (err as { code?: string })?.code;
      if (code !== 'ERR_REQUEST_CANCELED') {
        setError(getErrorMessage('auth', 'transient', err).body);
      }
    } finally {
      setSigningIn(false);
    }
  }

  function handleLogInLink() {
    router.push('/login');
  }

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
        {/*
          Content wrapper stretches with parent gutter (32pt each side
          on the 390pt baseline = Figma's 326pt content strip). Vertically
          centered via the parent's justify-content; gap-88 between
          title and continue group per Figma's absolutely-centered
          Content node.
        */}
        <View style={styles.contentInner}>
          <Text style={styles.title}>Get started</Text>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.outlinedButton,
                signingIn && styles.buttonBusy,
                pressed && !signingIn && pressedDim,
              ]}
              onPress={handleAppleSignIn}
              disabled={signingIn}
              accessibilityRole="button"
              accessibilityLabel="Continue with Apple"
              accessibilityState={{ busy: signingIn, disabled: signingIn }}
            >
              {signingIn ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <LogoApple width={20} height={20} />
                  <Text style={styles.outlinedButtonText}>
                    Continue with Apple
                  </Text>
                </>
              )}
            </Pressable>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              onPress={handleLogInLink}
              style={({ pressed }) => [styles.loginRow, pressed && pressedDim]}
              accessibilityRole="link"
              accessibilityLabel="Already have an account? Log in"
            >
              <Text style={styles.loginPrompt}>
                Already have an account?{' '}
                <Text style={styles.loginLink}>Log in</Text>
              </Text>
            </Pressable>
          </View>
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
    // 32pt gutter matches Figma's 326pt content-strip on the 390pt
    // baseline. Inner content stretches to fill instead of hardcoding
    // 326, so on Pro Max the column grows with the device rather than
    // orphaning in the middle.
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentInner: {
    alignSelf: 'stretch',
    gap: 88, // gap between title and continue group, per Figma
    alignItems: 'center',
  },
  title: {
    ...dynamicType(typography.largeTitleEmphasized),
    color: colors.white,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: spacing.md,
  },
  outlinedButton: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.wiltedgreen,
    backgroundColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm, // space between icon and label
    ...shadows.e1,
  },
  buttonBusy: {
    // Subtle dim while the Apple sheet is up so the user has feedback
    // even if the modal takes a beat to appear. Doesn't gray out the
    // border — just lowers the foreground a touch.
    opacity: 0.7,
  },
  errorText: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.red,
    textAlign: 'center',
  },
  outlinedButtonText: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.white,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.wiltedgreen,
  },
  dividerLabel: {
    ...dynamicType(typography.caption1Regular),
    color: colors.freshgreen,
  },
  loginRow: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  loginPrompt: {
    // subheadlineRegular (15pt) per the 2026-06-01 text-size audit.
    // "Already have an account? Log in" inline auth-screen link —
    // matches Apple's auth-screen prompt register (15pt). 13pt sat
    // at caption tier, which read as auxiliary metadata rather than
    // the navigation affordance it is.
    ...dynamicType(typography.subheadlineRegular),
    color: colors.white,
    textAlign: 'center',
  },
  loginLink: {
    // Inner Text inherits size/lineHeight/letterSpacing from loginPrompt;
    // we only need the weight bump for "Log in" + the green color.
    color: colors.freshgreen,
    fontFamily: typography.footnoteEmphasized.fontFamily,
  },
});
