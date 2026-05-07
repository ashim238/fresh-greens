import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import WelcomeBorderCloud from '../assets/illustrations/welcome-border-cloud.svg';
import WelcomeCloudLarge from '../assets/illustrations/welcome-cloud-large.svg';
import WelcomeCloudMed1 from '../assets/illustrations/welcome-cloud-med-1.svg';
import WelcomeCloudMed2 from '../assets/illustrations/welcome-cloud-med-2.svg';
import WelcomeCloudOval1 from '../assets/illustrations/welcome-cloud-oval-1.svg';
import WelcomeCloudOval2 from '../assets/illustrations/welcome-cloud-oval-2.svg';
import WelcomeCloudOvalMed from '../assets/illustrations/welcome-cloud-oval-med.svg';
import WelcomeCloudSm from '../assets/illustrations/welcome-cloud-sm.svg';
import WelcomeHill from '../assets/illustrations/welcome-hill.svg';
import WelcomeSun from '../assets/illustrations/welcome-sun.svg';
import WelcomeWindLg from '../assets/illustrations/welcome-wind-lg.svg';
import WelcomeWindMed from '../assets/illustrations/welcome-wind-med.svg';
import WelcomeWindSm from '../assets/illustrations/welcome-wind-sm.svg';
import { useUser } from '../hooks/useUser';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Welcome screen — the `/` route (default landing).
 * Figma node: 825:3162
 *
 * Layout: a 390×846 backdrop scene (bottom-centered on the root)
 * holds every decorative element absolutely positioned per Figma —
 * hill, sun, border cloud, Vic, and a sky of clouds + wind. Clouds
 * and wind elements are wrapped in `Drift` to oscillate translateX
 * with eased timing so the sky breathes subtly. Content (title,
 * terms, buttons) sits on top in a normal SafeAreaView column.
 */
export default function Welcome() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/home');
    }
  }, [loading, user, router]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={styles.backdropContainer}>
        <View style={styles.backdropScene}>
          {/* Static layers — z-order: hill (back), sun, border cloud, Vic */}
          <View style={[styles.absLayer, { left: 0, top: 371 }]}>
            <WelcomeHill width={390} height={475} />
          </View>
          <View style={[styles.absLayer, { left: 156, top: 333 }]}>
            <WelcomeSun width={75} height={39.932} />
          </View>
          <View style={[styles.absLayer, { left: 0, top: 0 }]}>
            <WelcomeBorderCloud width={390} height={40.12} />
          </View>
          <Image
            source={require('../assets/illustrations/welcome-vic.png')}
            style={styles.vicImage}
            resizeMode="contain"
            accessible
            accessibilityLabel="Illustration of a person waving from inside a location pin"
          />

          {/*
            Animated cloud + wind layers. Per-element durations stay
            in the 4–7s range with small amplitudes (4–12pt) so the
            motion reads as ambient drift rather than weather. Mixed
            durations naturally desync the elements after a few
            cycles even though they all start at offset 0.
          */}
          <Drift x={63.33} y={206.4} amplitude={12} duration={5800}>
            <WelcomeCloudLarge width={76.97} height={42.41} />
          </Drift>
          <Drift x={218.9} y={264.92} amplitude={10} duration={5200}>
            <WelcomeCloudMed1 width={52.26} height={19.07} />
          </Drift>
          <Drift x={233.93} y={108.07} amplitude={10} duration={5500}>
            <WelcomeCloudMed2 width={46.83} height={24.55} />
          </Drift>
          <Drift x={298.84} y={167.38} amplitude={8} duration={4600}>
            <WelcomeCloudSm width={33.21} height={14.04} />
          </Drift>
          <Drift x={282.45} y={120.07} amplitude={5} duration={4200}>
            <WelcomeCloudOvalMed width={14.84} height={5} />
          </Drift>
          <Drift x={79.76} y={61.29} amplitude={4} duration={3800}>
            <WelcomeCloudOval1 width={9.9} height={5} />
          </Drift>
          <Drift x={54.19} y={257.76} amplitude={5} duration={4400}>
            <WelcomeCloudOval2 width={14.84} height={5} />
          </Drift>
          <Drift x={255.63} y={285.5} amplitude={6} duration={3500}>
            <WelcomeWindLg width={27.937} height={25.7} />
          </Drift>
          <Drift x={67.83} y={199.89} amplitude={5} duration={3000}>
            <WelcomeWindMed width={25.356} height={11.579} />
          </Drift>
          <Drift x={272.84} y={98.45} amplitude={4} duration={2800}>
            <WelcomeWindSm width={10.262} height={9.418} />
          </Drift>
        </View>
      </View>

      <SafeAreaView style={styles.content}>
        <View style={styles.illustrationContainer} />

        <View style={styles.titleBlock}>
          <Text style={styles.title}>Fresh Greens</Text>
          <Text style={styles.subtitle}>A path made for you, by you</Text>
        </View>

        <View style={styles.actions}>
          <View style={styles.terms}>
            <Pressable
              style={styles.checkbox}
              hitSlop={20}
              onPress={() => setTermsAccepted((prev) => !prev)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              accessibilityLabel="I acknowledge the Privacy Policy and agree to Fresh Greens' Terms and Conditions."
            >
              {termsAccepted && (
                <Ionicons
                  name="checkmark"
                  size={18}
                  color={colors.freshgreen}
                />
              )}
            </Pressable>
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

          <Pressable
            style={[styles.button, styles.buttonSecondary]}
            accessibilityRole="button"
            onPress={() => router.push('/login')}
          >
            <Text style={styles.buttonText}>Have an account? Log in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * Wraps an absolutely-positioned child in a translateX oscillation
 * that swings between -amplitude and +amplitude with sin easing.
 * Total cycle is 2 × duration (one half-period each direction).
 *
 * useNativeDriver: true puts the animation on the UI thread so the
 * JS thread is free during scroll / app-launch work.
 */
function Drift({
  x,
  y,
  amplitude,
  duration,
  children,
}: {
  x: number;
  y: number;
  amplitude: number;
  duration: number;
  children: ReactNode;
}) {
  const tx = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(tx, {
          toValue: amplitude,
          duration: duration / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(tx, {
          toValue: -amplitude,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(tx, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [amplitude, duration, tx]);

  return (
    <Animated.View
      style={[styles.absLayer, { left: x, top: y, transform: [{ translateX: tx }] }]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.orange,
  },

  // --- Backdrop (390×846 scene, bottom-centered) ---
  backdropContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  backdropScene: {
    width: 390,
    height: 846,
    position: 'relative',
  },
  absLayer: {
    position: 'absolute',
  },
  vicImage: {
    position: 'absolute',
    left: 87.94,
    top: 88.72,
    width: 166,
    height: 226,
  },

  // --- Foreground content ---
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  illustrationContainer: {
    flex: 1,
  },
  titleBlock: {
    alignItems: 'center',
    gap: 16,
    marginBottom: 160,
  },
  title: {
    ...typography.title1Emphasized,
    color: colors.white,
  },
  subtitle: {
    ...typography.subheadlineRegular,
    color: colors.white,
  },
  actions: {
    alignItems: 'stretch',
    gap: 16,
  },
  terms: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'stretch',
  },
  checkbox: {
    // 24pt visual; hitSlop=20 brings effective tap area to 64pt.
    // Below the 44pt HIG default by exception clause — a 44pt
    // checkbox would dominate this dense legal-copy row.
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.freshgreen,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsTextColumn: {
    flex: 1,
    gap: 4,
  },
  termsText: {
    ...typography.caption2Regular,
    color: colors.white,
  },
  link: {
    color: colors.freshgreen,
    textDecorationLine: 'underline',
  },
  button: {
    alignSelf: 'stretch',
    height: 44,
    borderRadius: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  buttonPrimary: {
    backgroundColor: colors.freshgreen,
  },
  buttonSecondary: {
    backgroundColor: colors.wiltedgreen,
  },
  buttonText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
  },
});
