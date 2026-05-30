import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Phone } from 'phosphor-react-native/src/icons/Phone';
import { ShieldWarning } from 'phosphor-react-native/src/icons/ShieldWarning';
import { X } from 'phosphor-react-native/src/icons/X';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useReduceMotion } from '../hooks/useReduceMotion';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Emergency / SOS — the autonomy-of-support control (thesis claim C8).
 *
 * Interviews surfaced two coping behaviors for moments of crisis:
 * leaning on community (call a trusted contact) vs. institutional help
 * (911) — and a wariness of police that made the *choice* matter. The
 * control encodes both paths on one button, with the gesture cost
 * scaling to the stakes:
 *
 *   - TAP → a 3-second cancelable countdown, then a real `tel:` call to
 *           the trusted contact. Low-friction; it's calling your friend.
 *   - HOLD → the button fills red as you hold (the thesis's "fills with
 *           red"); completing the hold opens a deliberate 911 confirm.
 *
 * GUARDED 911: per the build decision, the hold does NOT auto-dial. It
 * opens a confirm screen with an explicit "Call 911" button the user
 * taps deliberately — keeping a real path while removing the
 * accidental-misfire risk of an auto-dialing gesture in a demo build.
 *
 * A pushed full-screen route (not a swipe-down modal): an accidental
 * swipe must not dismiss a crisis surface.
 *
 * Two entry points: (1) /safety's SOS control, and (2) directly from
 * the /en-route SOS side-button (the red medical-cross FAB) — a single
 * tap mid-drive, so the crisis surface isn't buried behind the Shield →
 * /safety menu path.
 */

// Hold duration before the 911 confirm opens. Long enough that a fumble
// can't trigger it, short enough to reach under stress.
const HOLD_MS = 2500;
// Delay before the red fill becomes visible, so a quick tap (countdown
// path) doesn't flash red before its onPressOut reverses the fill.
const FILL_START_DELAY_MS = 200;
// Land the fill a beat BEFORE onLongPress fires (W1) so the user sees
// the button fully red — otherwise the fill is still ~1 frame short
// when mode swaps to the 911 confirm and the button unmounts, killing
// the thesis's "fills with red" payoff.
const FILL_LEAD_MS = 150;
const COUNTDOWN_SEC = 3;

type Mode = 'idle' | 'countdown' | 'confirm911';

/**
 * Dial a `tel:` URL, surfacing an Alert if the handoff fails. On a
 * crisis surface a silently-dropped dial (Simulator, iPad, no SIM)
 * must not be invisible — the user needs to know to dial directly.
 */
function dialOrWarn(url: string, failMessage: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert("Couldn't open the dialer", failMessage);
  });
}

export default function Emergency() {
  const router = useRouter();
  const { contact } = useTrustedContact();
  const reduceMotion = useReduceMotion();

  const [mode, setMode] = useState<Mode>('idle');
  const [countdownSec, setCountdownSec] = useState(COUNTDOWN_SEC);

  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fillStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  // 0 → 1 hold progress, drives the red fill height. Reduce-motion users
  // never see it animate (we skip the tween); the hold still works.
  const fillProgress = useRef(new Animated.Value(0)).current;

  const contactName = contact?.name?.trim() || 'your trusted contact';
  const hasContact = !!contact?.phoneNumber;

  const clearCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount — never leave a timer running into a dead screen.
  useEffect(() => {
    return () => {
      clearCountdown();
      if (fillStartTimerRef.current) clearTimeout(fillStartTimerRef.current);
    };
  }, [clearCountdown]);

  // --- Trusted-contact (tap) path ---------------------------------------

  function startCountdown() {
    if (!hasContact) {
      // No contact set — route to setup instead of counting down to
      // nothing. The picker flow returns here implicitly (pushed route).
      router.push('/trusted-contact-setup');
      return;
    }
    setMode('countdown');
    setCountdownSec(COUNTDOWN_SEC);
    AccessibilityInfo.announceForAccessibility(
      `Calling ${contactName} in ${COUNTDOWN_SEC} seconds. Tap the button to cancel.`,
    );
    clearCountdown();
    // `remaining` is a closure counter decremented in the interval BODY
    // — the side effect (dial) and setMode live here, not inside a
    // setState updater, so React StrictMode's double-invoked updaters
    // can't fire the call twice. `phoneNumber` is captured at start;
    // it won't change mid-countdown.
    const phoneNumber = contact?.phoneNumber;
    let remaining = COUNTDOWN_SEC;
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearCountdown();
        // Real dial — it's the user's chosen trusted contact, not 911.
        if (phoneNumber) {
          dialOrWarn(
            `tel:${phoneNumber}`,
            `Call ${contactName} directly at ${phoneNumber}.`,
          );
        }
        setMode('idle');
        setCountdownSec(COUNTDOWN_SEC);
        return;
      }
      setCountdownSec(remaining);
    }, 1000);
  }

  function cancelCountdown() {
    clearCountdown();
    setMode('idle');
  }

  // --- 911 (hold) path ---------------------------------------------------

  function handlePressIn() {
    longPressFiredRef.current = false;
    if (reduceMotion) return; // no animated fill; the hold still fires
    fillStartTimerRef.current = setTimeout(() => {
      Animated.timing(fillProgress, {
        toValue: 1,
        duration: HOLD_MS - FILL_START_DELAY_MS - FILL_LEAD_MS,
        easing: Easing.linear,
        // height interpolation animates layout → JS driver
        useNativeDriver: false,
      }).start();
    }, FILL_START_DELAY_MS);
  }

  function handlePressOut() {
    if (fillStartTimerRef.current) {
      clearTimeout(fillStartTimerRef.current);
      fillStartTimerRef.current = null;
    }
    // Only reverse if the hold did NOT complete into the 911 confirm.
    if (!longPressFiredRef.current) {
      Animated.timing(fillProgress, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    }
  }

  function handleLongPress() {
    longPressFiredRef.current = true;
    clearCountdown();
    setMode('confirm911');
  }

  function dismiss911() {
    longPressFiredRef.current = false;
    fillProgress.setValue(0);
    setMode('idle');
  }

  function callNineOneOne() {
    // Real dial, but only on a deliberate tap of this explicit button —
    // never auto-triggered by the hold gesture (guarded-stub decision).
    dialOrWarn('tel:911', 'Dial 911 directly from your phone.');
  }

  const fillHeight = fillProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // --- Render ------------------------------------------------------------

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && pressedDim]}
          >
            <X size={20} color={colors.labelSecondary} weight="bold" />
          </Pressable>
        </View>

        {mode === 'confirm911' ? (
          <View style={styles.confirmBlock}>
            <ShieldWarning size={64} color={colors.red} weight="duotone" />
            <Text style={styles.confirmTitle}>Call 911?</Text>
            <Text style={styles.confirmBody}>
              This places a call to emergency services. Only continue if
              you're in immediate danger.
            </Text>
            <Pressable
              onPress={callNineOneOne}
              accessibilityRole="button"
              accessibilityLabel="Call 911 now"
              style={({ pressed }) => [styles.call911Btn, pressed && pressedDim]}
            >
              <Phone size={20} color={colors.white} weight="fill" />
              <Text style={styles.call911Text}>Call 911</Text>
            </Pressable>
            <Pressable
              onPress={dismiss911}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              hitSlop={8}
              style={({ pressed }) => [styles.cancelLink, pressed && pressedDim]}
            >
              <Text style={styles.cancelLinkText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.body}>
            <Text style={styles.title}>
              {mode === 'countdown' ? 'Calling…' : 'Need help?'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'countdown'
                ? `Reaching ${contactName} in ${countdownSec}`
                : 'You choose who responds.'}
            </Text>

            <View style={styles.sosWrap}>
              <Pressable
                onPress={mode === 'countdown' ? cancelCountdown : startCountdown}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onLongPress={handleLongPress}
                delayLongPress={HOLD_MS}
                accessibilityRole="button"
                accessibilityLabel={
                  mode === 'countdown'
                    ? `Cancel — calling ${contactName} in ${countdownSec} seconds`
                    : `Emergency. Tap to call ${contactName}. Press and hold to reach 911.`
                }
                style={({ pressed }) => [
                  styles.sosButton,
                  pressed && mode !== 'countdown' && styles.sosButtonPressed,
                ]}
              >
                {/* Red fill rises from the bottom as the 911 hold
                    progresses. Reduce-motion users never see it tween
                    (handlePressIn returns early), but the hold still
                    fires onLongPress → confirm. */}
                <Animated.View
                  pointerEvents="none"
                  style={[styles.sosFill, { height: fillHeight }]}
                />
                <Text style={styles.sosLabel}>
                  {mode === 'countdown' ? countdownSec : 'SOS'}
                </Text>
              </Pressable>
            </View>

            {mode === 'countdown' ? (
              <Text style={styles.holdHint}>Tap the button to cancel.</Text>
            ) : (
              <>
                <Text style={styles.holdHint}>
                  Tap to call {contactName} · Hold for 911
                </Text>
                {/* Explicit, non-gesture path to 911 — VoiceOver and
                    motor-impaired users can't reliably long-press, so
                    the gesture is never the *only* way to reach 911. */}
                <Pressable
                  onPress={() => {
                    fillProgress.setValue(0); // W2: symmetry with dismiss911
                    setMode('confirm911');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Emergency services. Opens a 911 confirmation."
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.emergencyLink,
                    pressed && pressedDim,
                  ]}
                >
                  <Text style={styles.emergencyLinkText}>
                    Emergency services →
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const SOS_SIZE = 220;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // White ground. An earlier draft flooded the whole screen with navy
    // (the reserved safety color), but a full-bleed navy canvas with
    // fadedgreen supporting text read harsh and alarmed — the opposite
    // of the thesis's calm-under-stress intent. Navy is now scoped to
    // the SOS button itself (the safety affordance per .cursorrules
    // exception 6), so the color still SIGNALS "this is the safety
    // control" without shouting across the entire surface.
    backgroundColor: colors.white,
  },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    height: 44,
    justifyContent: 'center',
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    ...typography.title1Regular,
    color: colors.black,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyRegular,
    color: colors.labelSecondary,
    textAlign: 'center',
  },
  sosWrap: {
    marginVertical: spacing.lg,
  },
  sosButton: {
    width: SOS_SIZE,
    height: SOS_SIZE,
    borderRadius: SOS_SIZE / 2,
    // navy = the canonical safety-affordance color (.cursorrules
    // exception 6, the en-route shield). On the white ground this one
    // navy disc is the screen's safety anchor — it reads as "the
    // control that summons help" without flooding the surface. The red
    // 911 fill rises OVER this navy, so navy→red still reads as
    // escalation.
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.e3,
  },
  sosButtonPressed: {
    ...pressedDim,
  },
  sosFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // red = the reserved emergency signal; it only appears DURING the
    // 911 hold, so the color's meaning ("emergency escalation") stays
    // honest — the idle button is never red.
    backgroundColor: colors.red,
  },
  sosLabel: {
    fontWeight: '800',
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: 2,
    // White on the navy disc (was navy on the old white disc). Stays
    // legible whether it sits over navy (idle/countdown) or over the
    // rising red fill (911 hold).
    color: colors.white,
    fontVariant: ['tabular-nums'],
  },
  holdHint: {
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
    textAlign: 'center',
  },
  emergencyLink: {
    marginTop: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  emergencyLinkText: {
    ...typography.subheadlineEmphasized,
    // navy, not the usual freshgreen link color: this is the accessible
    // alternate trigger for the SAME 911 path the navy SOS hold opens,
    // so it belongs to the safety-affordance register, not the in-flow
    // link register. A green "→ 911" would misencode an emergency path
    // as affirmative; red is held back for the final 911 action only.
    color: colors.navy,
    textDecorationLine: 'underline',
  },
  // --- 911 confirm ---
  confirmBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  confirmTitle: {
    ...typography.title1Regular,
    color: colors.black,
    textAlign: 'center',
  },
  confirmBody: {
    ...typography.bodyRegular,
    color: colors.labelSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  call911Btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    height: 56,
    borderRadius: 100,
    marginTop: spacing.md,
    backgroundColor: colors.red,
    ...shadows.e2,
  },
  call911Text: {
    ...typography.bodyEmphasized,
    color: colors.white,
  },
  cancelLink: {
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelLinkText: {
    ...typography.subheadlineRegular,
    color: colors.labelTertiary,
  },
});
