import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PermissionsCar from '../assets/illustrations/permissions-car.svg';
import PermissionsLocation from '../assets/illustrations/permissions-location.svg';

import { Button } from '../components/Button';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { motion } from '../theme/motion';
import { spacing } from '../theme/spacing';
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
  const reduceMotion = useReduceMotion();

  // D6: delayed subtitle entrance — "Drive safe." waits 600ms before
  // fading in over 220ms. The pause creates an emotional beat after
  // the title. Gated on reduce motion (both shown immediately).
  const [subtitleVisible, setSubtitleVisible] = useState(reduceMotion);
  const subtitleOpacity = useRef(
    new Animated.Value(reduceMotion ? 1 : 0),
  ).current;

  useEffect(() => {
    if (reduceMotion) {
      subtitleOpacity.setValue(1);
      setSubtitleVisible(true);
      return;
    }
    const delay = setTimeout(() => {
      setSubtitleVisible(true);
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: motion.duration.quick,
        easing: motion.easing.out,
        useNativeDriver: true,
      }).start();
    }, 600);
    return () => clearTimeout(delay);
  }, [reduceMotion, subtitleOpacity]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.illustration}>
            <View style={styles.locationWrap}>
              <PermissionsLocation width={67} height={84} />
            </View>
            <View style={styles.carWrap}>
              <PermissionsCar width={143} height={100} />
            </View>
          </View>

          <View style={styles.copy}>
            <Text style={styles.title} accessibilityRole="header">
              You&apos;ve been logged out.
            </Text>
            {subtitleVisible && (
              <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
                Drive safe.
              </Animated.Text>
            )}
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
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.xxl,
  },
  // Illustration cluster — location pin sits up-and-right, car sits
  // below-and-left, mirroring Figma 1133:12898 layout.
  illustration: {
    width: 143,
    height: 222,
  },
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
  copy: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  title: {
    ...dynamicType(typography.brandDisplayLarge),
    color: colors.white,
  },
  subtitle: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.signOutSubtitle,
  },
  button: {
    alignSelf: 'flex-start',
    // minWidth (not fixed width) per Figma 163pt container, but lets the
    // button grow to fit its label under Dynamic Type instead of clipping.
    minWidth: 163,
  },
});
