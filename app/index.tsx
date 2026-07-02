import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
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
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { Button } from '../components/Button';
import { dynamicType } from '../theme/dynamic-type';
import { pressedDim, tapTarget44 } from '../theme/interaction';
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
  // Scale the 390-baseline backdrop to the device width. Anchored at
  // bottom-center so the hill stays glued to the bottom edge across
  // iPhone SE through Pro Max instead of floating in the middle of
  // an orange margin.
  const { width: screenWidth } = useWindowDimensions();
  const sceneScale = screenWidth / 390;

  useEffect(() => {
    if (!loading && user) {
      router.replace('/home');
    }
  }, [loading, user, router]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/*
        Backdrop is purely decorative atmosphere — sun, hill, clouds,
        wind, Vic. Hidden from VoiceOver so the screen reader announces
        only the foreground content (title, subtitle, terms, CTAs) in
        document order. accessibilityIgnoresInvertColors keeps the
        carefully-tuned orange-sky palette intact when iOS Smart Invert
        is on (otherwise the whole atmosphere flips to a teal sky and
        the brand register breaks).
      */}
      <View
        style={styles.backdropContainer}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        accessibilityIgnoresInvertColors
      >
        <View
          style={[
            styles.backdropScene,
            {
              transform: [{ scale: sceneScale }],
              transformOrigin: 'bottom center',
            },
          ]}
        >
          {/*
            Static layers — z-order: hill (back), sun, border cloud, Vic.
            Position styles go directly on the Svg components rather than
            wrapping each in a View. The Figma exports declare
            `width="100%" height="100%"` internally, so an
            absolute-positioned wrapper View without explicit dimensions
            collapses to 0×0 — and the SVG inside resolves 100% to that
            zero, rendering nothing.
          */}
          <WelcomeHill
            width={390}
            height={475}
            style={[styles.absLayer, { left: 0, top: 371 }]}
          />
          <WelcomeSun
            width={75}
            height={39.932}
            style={[styles.absLayer, { left: 156, top: 333 }]}
          />
          <WelcomeBorderCloud
            width={390}
            height={40.12}
            style={[styles.absLayer, { left: 0, top: 0 }]}
          />
          {/*
            Vic stays a PNG, not an SVG. Vic's illustration uses image-
            fill rects in Figma (texture for skin/clothing) which export
            as <pattern> elements with embedded base64 rasters —
            react-native-svg renders those unreliably (mis-tiles on iOS,
            pin shape wraps to the other side). The single PNG source
            is exported at 3x density (498×677) and displayed at the
            166×226 component size — RN downsamples on render so it
            stays crisp on every retina device. We don't use the
            `@3x` filename suffix because Metro reads that as a density
            tag and expects a 1x base file alongside; a single
            high-density bitmap referenced directly is simpler.
            docs/architecture.md "Asset format default: SVG" rule has the
            documented exception for assets with image fills like this.
          */}
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
          <Drift x={63.33} y={206.4} w={76.97} h={42.41} amplitude={12} duration={5800}>
            <WelcomeCloudLarge width={76.97} height={42.41} />
          </Drift>
          <Drift x={218.9} y={264.92} w={52.26} h={19.07} amplitude={10} duration={5200}>
            <WelcomeCloudMed1 width={52.26} height={19.07} />
          </Drift>
          <Drift x={233.93} y={108.07} w={46.83} h={24.55} amplitude={10} duration={5500}>
            <WelcomeCloudMed2 width={46.83} height={24.55} />
          </Drift>
          <Drift x={298.84} y={167.38} w={33.21} h={14.04} amplitude={8} duration={4600}>
            <WelcomeCloudSm width={33.21} height={14.04} />
          </Drift>
          <Drift x={282.45} y={120.07} w={14.84} h={5} amplitude={5} duration={4200}>
            <WelcomeCloudOvalMed width={14.84} height={5} />
          </Drift>
          <Drift x={79.76} y={61.29} w={9.9} h={5} amplitude={4} duration={3800}>
            <WelcomeCloudOval1 width={9.9} height={5} />
          </Drift>
          <Drift x={54.19} y={257.76} w={14.84} h={5} amplitude={5} duration={4400}>
            <WelcomeCloudOval2 width={14.84} height={5} />
          </Drift>
          <Drift x={255.63} y={285.5} w={27.937} h={25.7} amplitude={6} duration={3500}>
            <WelcomeWindLg width={27.937} height={25.7} />
          </Drift>
          <Drift x={67.83} y={199.89} w={25.356} h={11.579} amplitude={5} duration={3000}>
            <WelcomeWindMed width={25.356} height={11.579} />
          </Drift>
          <Drift x={272.84} y={98.45} w={10.262} h={9.418} amplitude={4} duration={2800}>
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
              style={({ pressed }) => [tapTarget44, pressed && pressedDim]}
              onPress={() => setTermsAccepted((prev) => !prev)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              accessibilityLabel="I acknowledge the Privacy Policy and agree to Fresh Greens' Terms and Conditions."
            >
              <View style={styles.checkbox}>
                {termsAccepted && (
                  <Check size={18} color={colors.accent} weight="fill" />
                )}
              </View>
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

          <Button
            type="primary"
            fill="fill"
            text="Get started"
            // Gated on the terms checkbox above. The state was
            // already tracked but `Get started` worked regardless —
            // a thesis reviewer asking "what if I don't check the
            // box?" would get "nothing, you get in anyway." Now the
            // button is disabled until they consent.
            disabled={!termsAccepted}
            accessibilityHint={
              termsAccepted
                ? undefined
                : 'Accept the Privacy Policy and Terms to enable Get started'
            }
            onPress={() => router.push('/get-started')}
            style={styles.buttonStretch}
          />

          <Button
            type="secondary"
            fill="fill"
            text="Have an account? Log in"
            onPress={() => router.push('/login')}
            style={styles.buttonStretch}
          />
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
  w,
  h,
  amplitude,
  duration,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  amplitude: number;
  duration: number;
  children: ReactNode;
}) {
  const tx = useRef(new Animated.Value(0)).current;
  // Reduce Motion respect — when iOS Accessibility → Motion → Reduce
  // Motion is on, the cloud/wind drift stops oscillating and pins to
  // y=0 (centered, static). The decoration stays visible; just no
  // motion. Per Apple HIG + WCAG 2.1 SC 2.3.3 (Animation from
  // Interactions). Live listener picks up runtime toggles.
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      tx.setValue(0);
      return;
    }
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
  }, [amplitude, duration, tx, reduceMotion]);

  return (
    <Animated.View
      style={[
        styles.absLayer,
        {
          left: x,
          top: y,
          width: w,
          height: h,
          transform: [{ translateX: tx }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Orange = sunrise sky on the brand splash — the one place a reserved
    // color is used decoratively, blessed by .cursorrules reserved-color
    // exception #1 ("Welcome screen orange = sunrise"). NOT a hazard
    // signal. Pointer left here so a reserved-color audit (`rg "colors\.
    // (orange|red|...)"`) doesn't re-flag this use site — it has, twice.
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
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  illustrationContainer: {
    flex: 1,
  },
  titleBlock: {
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: 160,
  },
  title: {
    ...dynamicType(typography.largeTitleEmphasized),
    color: colors.white,
  },
  subtitle: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.white,
  },
  actions: {
    alignItems: 'stretch',
    gap: spacing.md,
  },
  terms: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  checkbox: {
    // 24pt glyph centered inside the 44pt painted Pressable (tapTarget44).
    // A 44pt box would dominate this dense legal-copy row; the HIG floor
    // is met on the painted control, not via hitSlop on a sub-44 visual.
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radii.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsTextColumn: {
    flex: 1,
    gap: spacing.xs,
  },
  termsText: {
    // caption2Regular is the ornamental tier (11pt, below WCAG 12pt floor)
    // per typography.ts. Legal terms-of-service copy belongs there, but
    // since it's still text the user reads, scale it with Dynamic Type so
    // a user at AX-large can resize it past the floor.
    ...dynamicType(typography.caption2Regular),
    color: colors.white,
  },
  link: {
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  buttonStretch: {
    alignSelf: 'stretch',
  },
});
