import { Redirect, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import { useAppFonts } from '../hooks/useAppFonts';
import { Button } from '../components/Button';
import {
  SessionProvider,
  useSession,
} from '../lib/account-session/session-provider';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

void SplashScreen.preventAutoHideAsync();

export function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const {
    phase,
    sessionError,
    sessionGeneration,
    retrySessionHydration,
  } = useSession();
  const pathname = usePathname();
  const retryingStartup = phase === 'hydrating' && sessionError !== null;
  const sessionHydrated = phase !== 'hydrating' || retryingStartup;

  useEffect(() => {
    if (fontsLoaded && sessionHydrated) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, sessionHydrated]);

  if (!fontsLoaded || !sessionHydrated) return null;

  if (phase === 'sessionError' || retryingStartup) {
    return (
      <SafeAreaView style={styles.startupSafe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.startupError}
          showsVerticalScrollIndicator={false}
          accessibilityLiveRegion="polite"
        >
          <Text accessibilityRole="header" style={styles.startupTitle}>
            We couldn&apos;t open Fresh Greens
          </Text>
          <Text style={styles.startupBody}>
            Your information is still on this device. Try again.
          </Text>
          <Button
            text="Try again"
            onPress={() => void retrySessionHydration()}
            loading={retryingStartup}
            accessibilityHint="Tries to open your account information again"
            style={styles.startupButton}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const isGuest = phase === 'signedOut';
  const isTransition =
    phase === 'signingOut' ||
    phase === 'cleanupFailed' ||
    phase === 'signedOut';
  const isPrivate = phase === 'authenticated';
  const isGuestPath =
    pathname === '/' || pathname === '/get-started' || pathname === '/login';
  const isTransitionPath = pathname === '/sign-out';
  const redirectTarget = isGuest
    ? isGuestPath || isTransitionPath
      ? null
      : '/login'
    : isPrivate
      ? isGuestPath || isTransitionPath
        ? '/home'
        : null
      : isTransitionPath
        ? null
        : '/sign-out';

  return (
    <>
      {redirectTarget ? <Redirect href={redirectTarget} /> : null}
      <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isGuest}>
        <Stack.Screen name="index" />
        <Stack.Screen name="get-started" />
        <Stack.Screen name="login" />
      </Stack.Protected>

      <Stack.Protected guard={isTransition}>
        <Stack.Screen name="sign-out" />
      </Stack.Protected>

      <Stack.Protected
        key={`private-session-${sessionGeneration}`}
        guard={isPrivate}
      >
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="permissions" />
        <Stack.Screen name="trusted-contact-setup" />

        <Stack.Screen name="home" />
        <Stack.Screen name="menu" />
        <Stack.Screen name="search" />
        <Stack.Screen name="en-route" />
        <Stack.Screen name="saved-places" />
        <Stack.Screen name="fuel" />
        <Stack.Screen name="zone-preferences" />
        <Stack.Screen name="safety-settings" />
        <Stack.Screen name="insurance-setup" />
        <Stack.Screen name="legal" />
        <Stack.Screen name="moderation" />
        <Stack.Screen name="recordings" />
        {__DEV__ ? <Stack.Screen name="dev-sign-out" /> : null}

        <Stack.Screen name="safety" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="pulled-over"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="trip-summary"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="share-location"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="unfamiliar"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen name="roadside" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="roadside-setup"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="report"
          options={{ presentation: 'transparentModal', animation: 'fade' }}
        />
        <Stack.Screen
          name="emergency"
          options={{ presentation: 'transparentModal', animation: 'fade' }}
        />
      </Stack.Protected>
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  startupSafe: {
    flex: 1,
    backgroundColor: colors.surfacePage,
  },
  startupError: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surfacePage,
  },
  startupTitle: {
    ...dynamicType(typography.title1Emphasized),
    color: colors.black,
  },
  startupBody: {
    ...dynamicType(typography.bodyRegular),
    color: colors.labelSecondary,
  },
  startupButton: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
});

export default function RootLayout() {
  const fonts = useAppFonts();
  const fontsLoaded = fonts.loaded || fonts.error !== null;

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <RootNavigator fontsLoaded={fontsLoaded} />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
