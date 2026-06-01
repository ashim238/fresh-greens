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
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { typography } from '../theme/typography';

/**
 * Login — returning-user auth entry.
 *
 * Mirrors /get-started's visual register (same wiltedgreen sky, burnt-
 * green ground, Apple sign-in button) but copy and routing targets are
 * tuned for users who already have an account:
 *   - Title: "Welcome back" (vs "Get started")
 *   - On successful Apple Sign In: route directly to /home (skip
 *     onboarding entirely — these users have done it before)
 *   - "Don't have an account? Sign up" link → /get-started
 *
 * Sign in with Apple is the only auth provider in v1. Same pattern as
 * /get-started.
 *
 * Route: /login
 *
 * Note on visual reuse: the layout/styles below are deliberately a
 * near-clone of /get-started rather than an extracted shared component.
 * The two screens have the same structure today but their copy +
 * post-sign-in routing diverge, and the third use (settings sign-in?)
 * doesn't exist yet — applying the rule of three, we'll wait for a
 * third use before extracting an `<AuthScreen />` shared component.
 */
export default function Login() {
  const router = useRouter();
  const { signInWithApple } = useUser();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAppleSignIn() {
    if (signingIn) return;
    setError(null);
    setSigningIn(true);
    try {
      await signInWithApple();
      // Success haptic — same cue as get-started, confirms the Apple
      // sheet completed cleanly before /home paints.
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      // Returning-user route — /login is dedicated to people who already
      // have an account, so they always skip onboarding.
      router.replace('/home');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== 'ERR_REQUEST_CANCELED') {
        setError('Sign-in failed. Please try again.');
        console.warn('Apple Sign In error', err);
      }
    } finally {
      setSigningIn(false);
    }
  }

  function handleSignUpLink() {
    // replace, not push — login is a sibling of get-started, not a
    // child. The user shouldn't be able to swipe-back from /get-started
    // to /login (they came from / via the "Have an account?" link).
    router.replace('/get-started');
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={styles.ground} />

      <Image
        source={require('../assets/illustrations/get-started-cars.png')}
        style={styles.cars}
        resizeMode="contain"
        accessible
        accessibilityLabel="Three cartoon cars driving across the horizon with smoke trail"
      />

      <SafeAreaView style={styles.content}>
        <View style={styles.contentInner}>
          <Text style={styles.title}>Welcome back</Text>

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
              accessibilityLabel="Log in with Apple"
              accessibilityState={{ busy: signingIn, disabled: signingIn }}
            >
              {signingIn ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <LogoApple width={20} height={20} />
                  <Text style={styles.outlinedButtonText}>Log in with Apple</Text>
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
              onPress={handleSignUpLink}
              style={({ pressed }) => [styles.loginRow, pressed && pressedDim]}
              accessibilityRole="link"
              accessibilityLabel="Don't have an account? Sign up"
            >
              <Text style={styles.loginPrompt}>
                Don't have an account?{' '}
                <Text style={styles.loginLink}>Sign up</Text>
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '80%',
    backgroundColor: colors.burntgreen,
  },
  cars: {
    position: 'absolute',
    top: '16%',
    left: 0,
    width: '100%',
    height: 110,
    transform: [{ translateX: 110 }],
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentInner: {
    alignSelf: 'stretch',
    gap: 88,
    alignItems: 'center',
  },
  title: {
    ...typography.title1Emphasized,
    color: colors.white,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: 16,
  },
  outlinedButton: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.wiltedgreen,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonBusy: {
    opacity: 0.7,
  },
  outlinedButtonText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
  },
  errorText: {
    ...typography.footnoteRegular,
    color: colors.red,
    textAlign: 'center',
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
    ...typography.caption1Regular,
    color: colors.freshgreen,
  },
  loginRow: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loginPrompt: {
    // Mirrors /get-started's loginPrompt bump (2026-06-01 text-size
    // audit) — auth-screen inline link, 13pt → 15pt for the auth-
    // screen prompt register.
    ...typography.subheadlineRegular,
    color: colors.white,
    textAlign: 'center',
  },
  loginLink: {
    color: colors.freshgreen,
    fontWeight: typography.footnoteEmphasized.fontWeight,
  },
});
