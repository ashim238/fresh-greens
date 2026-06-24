import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PermissionsCar from '../assets/illustrations/permissions-car.svg';
import PermissionsLocation from '../assets/illustrations/permissions-location.svg';

import { Button } from '../components/Button';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { typography } from '../theme/typography';

/**
 * Sign Out confirmation screen — replaces the inline immediate-sign-out
 * pattern from v1. Reached via /menu's Sign out trigger after identity
 * state (user, trusted contact, saved places) has been cleared.
 *
 * Figma `1133:12894`. Wiltedgreen bg, location-pin + car illustrations
 * (re-uses permissions-location.svg + permissions-car.svg), Title1
 * goodbye + footnote thanks, Primary Button to route back to /login.
 *
 * Uses `router.replace('/login')` so the back gesture from /login
 * doesn't return here — leaving via "Log back in" should feel like a
 * fresh entry, not a stack pop.
 */
export default function SignOut() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.illustration}>
            <View style={styles.locationWrap}>
              <PermissionsLocation width={26.881} height={33.797} />
            </View>
            <View style={styles.carWrap}>
              <PermissionsCar width={57} height={40} />
            </View>
          </View>

          <View style={styles.copy}>
            <Text style={styles.title}>You've been logged out.</Text>
            <Text style={styles.subtitle}>Drive safe.</Text>
          </View>

          <Button
            type="primary"
            fill="fill"
            text="Log back in"
            onPress={() => router.replace('/login')}
            style={styles.button}
          />
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
  },
  // Centered vertically in the safe area, 32pt horizontal padding
  // matches the static-content modal-padding rule from .cursorrules.
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 56,
    gap: 43,
  },
  // Illustration cluster — location pin sits up-and-right, car sits
  // below-and-left, mirroring Figma 1133:12898 layout.
  illustration: {
    width: 57,
    height: 89,
  },
  locationWrap: {
    position: 'absolute',
    top: 0,
    left: 10.71,
    width: 35.891,
    height: 40.374,
    transform: [{ rotate: '17.72deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  carWrap: {
    position: 'absolute',
    top: 48.55,
    left: 0,
    width: 57,
    height: 40,
  },
  copy: {
    gap: 16,
  },
  title: {
    // Bolder pass: 28pt → 34pt (largeTitleEmphasized). The goodbye line
    // is the screen's emotional anchor — a confident largeTitle on the
    // wiltedgreen surface reads as a deliberate farewell rather than a
    // utility confirmation. Pairs with the existing 15pt subtitle so
    // the type ladder still has clear hierarchy.
    ...dynamicType(typography.largeTitleEmphasized),
    color: colors.white,
  },
  subtitle: {
    // subheadlineRegular (15pt) per the 2026-06-01 text-size audit.
    // The sign-out screen pairs a 28pt title with this supporting
    // sentence; 13pt dropped two tiers below the title (caption
    // tier), reading as fine print on what's actually an onboarding-
    // class screen. 15pt keeps it subordinate without burying it.
    ...dynamicType(typography.subheadlineRegular),
    color: colors.signOutSubtitle,
  },
  button: {
    alignSelf: 'flex-start',
    width: 163, // per Figma container width
  },
});
