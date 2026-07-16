import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PermissionsCar from '../assets/illustrations/permissions-car.svg';
import PermissionsLocation from '../assets/illustrations/permissions-location.svg';
import { Button } from '../components/Button';
import { useSession } from '../lib/account-session/session-provider';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export default function SignOut() {
  const router = useRouter();
  const {
    phase,
    failure,
    signOutCompletion,
    retryCleanup,
    finishOnDevice,
  } = useSession();
  const [actionPending, setActionPending] = useState(false);

  async function handleRetry() {
    if (actionPending) return;
    setActionPending(true);
    try {
      await retryCleanup();
    } catch {
      // The provider restores cleanupFailed. The same calm recovery copy
      // remains visible without exposing storage or credential details.
    } finally {
      setActionPending(false);
    }
  }

  async function handleFinishOnDevice() {
    if (actionPending) return;
    setActionPending(true);
    try {
      await finishOnDevice();
    } catch {
      // The provider restores cleanupFailed for another explicit retry.
    } finally {
      setActionPending(false);
    }
  }

  function confirmFinishOnDevice() {
    Alert.alert(
      'Finish on this device?',
      'The online session could not be confirmed as closed. It will expire, and this device will forget it now.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish',
          style: 'destructive',
          onPress: () => void handleFinishOnDevice(),
        },
      ],
    );
  }

  const signingOut = phase === 'signingOut';
  const cleanupFailed = phase === 'cleanupFailed';
  const localOnly =
    phase === 'signedOut' && signOutCompletion === 'local-only';

  const title = signingOut
    ? 'Signing you out'
    : cleanupFailed
      ? "We couldn't finish signing out"
      : localOnly
        ? 'Signed out on this device.'
        : "You've been logged out.";
  const body = signingOut
    ? 'Removing your information from this device.'
    : cleanupFailed
      ? 'Some information is still on this device. Try the cleanup again before you log in.'
      : localOnly
        ? 'The online session could not be confirmed as closed.'
        : 'Drive safe.';

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          accessible={signingOut}
          accessibilityLabel={
            signingOut
              ? 'Signing you out. Removing your information from this device. In progress.'
              : undefined
          }
          accessibilityState={signingOut ? { busy: true } : undefined}
        >
          <View
            style={styles.illustration}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={styles.locationWrap}>
              <PermissionsLocation width={67} height={84} />
            </View>
            <View style={styles.carWrap}>
              <PermissionsCar width={143} height={100} />
            </View>
          </View>

          <View
            style={styles.copy}
            accessibilityLiveRegion={cleanupFailed ? 'assertive' : 'none'}
          >
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <Text style={styles.subtitle}>{body}</Text>
          </View>

          {cleanupFailed ? (
            <View style={styles.actions}>
              <Button
                text="Try again"
                onPress={() => void handleRetry()}
                loading={actionPending}
                accessibilityHint="Tries the account cleanup again"
                style={styles.button}
              />
              {failure?.canFinishOnDevice ? (
                <Button
                  text="Finish on this device"
                  fill="transparent"
                  onPress={confirmFinishOnDevice}
                  disabled={actionPending}
                  accessibilityHint="Finishes local sign out without confirming the online session"
                  style={styles.button}
                />
              ) : null}
            </View>
          ) : phase === 'signedOut' ? (
            <Button
              text="Log back in"
              onPress={() => router.replace('/login')}
              accessibilityHint="Opens the login screen"
              style={styles.button}
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.wiltedgreen },
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.xxl,
  },
  illustration: { width: 143, height: 222 },
  locationWrap: {
    position: 'absolute',
    top: 0,
    left: 27,
    width: 90,
    height: 101,
    transform: [{ rotate: '17.72deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  carWrap: {
    position: 'absolute',
    top: 121,
    left: 0,
    width: 143,
    height: 100,
  },
  copy: { gap: spacing.md, marginTop: spacing.lg },
  title: {
    ...dynamicType(typography.brandDisplayLarge),
    color: colors.white,
  },
  subtitle: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.signOutSubtitle,
  },
  actions: { gap: spacing.sm, alignItems: 'flex-start' },
  button: { minWidth: 190 },
});
