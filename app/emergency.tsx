import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Asterisk } from 'phosphor-react-native/src/icons/Asterisk';
import { Phone } from 'phosphor-react-native/src/icons/Phone';
import { X } from 'phosphor-react-native/src/icons/X';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTrustedContact } from '../hooks/useTrustedContact';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Emergency / SOS — the autonomy-of-support control (thesis claim C8).
 *
 * v2 redesign per Figma nodes 49-5188 / 49-5388 / 49-197 (user-flagged
 * 2026-06-01): a centered transparent-modal card layered over the
 * calling surface (typically /en-route), NOT a full-screen takeover.
 * The map context stays visible behind a 20% scrim — critical for
 * the driving-stress use case, where losing visual context is its
 * own crisis.
 *
 * Two states:
 *   - idle      → "Need help?" + Call [Trusted Contact] + Call 911
 *                 buttons + X close. The thesis-encoded choice (C8).
 *   - countdown → "Calling [target]" + small red disc with countdown
 *                 numeral + X "Stop" affordance. 3-second cancel
 *                 window before the actual `tel:` dial fires.
 *
 * Flow: tap either button on the idle card → countdown for that
 * target → auto-dial at 0 OR Stop to cancel back to idle.
 *
 * Guarded-911: the auto-dial path goes through a deliberate user tap
 * (Call 911 button on the idle card) plus a visible 3-second Stop
 * window — two-tier safety net. The prior version's hold-to-fill +
 * separate confirm911 screen has been replaced by this pattern, which
 * matches the Figma and removes the gesture-only escalation that
 * VoiceOver / motor-impaired users couldn't reliably trigger.
 *
 * Two entry points: /safety's SOS bar and /en-route's SOS side-button.
 * Both push to /emergency, which renders over their respective surfaces
 * via transparentModal presentation (see app/_layout.tsx).
 */

const COUNTDOWN_SEC = 3;

type Target = 'contact' | '911';
type Mode = { kind: 'idle' } | { kind: 'countdown'; target: Target };

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

  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [countdownSec, setCountdownSec] = useState(COUNTDOWN_SEC);

  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    return () => clearCountdown();
  }, [clearCountdown]);

  function dismiss() {
    router.back();
  }

  function startCountdown(target: Target, opts?: { isPivot?: boolean }) {
    // No-contact branch for the contact path: route to setup instead
    // of counting down to nothing. `from=emergency` makes the setup
    // screen's Skip/Continue return here via back() — without it they
    // fall through to replace('/home'), dropping a Home card on top of
    // the modal stack (the "Home overlays as a sheet" bug, fixed in
    // fd0417c for the other entry points).
    if (target === 'contact' && !hasContact) {
      router.push('/trusted-contact-setup?from=emergency');
      return;
    }

    setMode({ kind: 'countdown', target });
    setCountdownSec(COUNTDOWN_SEC);
    // VoiceOver: a sighted user sees the title swap on a pivot; a
    // non-sighted user needs the swap stated explicitly so they don't
    // think the timer simply reset on the same target. Two announcement
    // variants so the action is unambiguous.
    const targetSpoken = target === '911' ? '911' : contactName;
    AccessibilityInfo.announceForAccessibility(
      opts?.isPivot
        ? `Switched to calling ${targetSpoken}. ${COUNTDOWN_SEC} seconds to cancel.`
        : `Calling ${targetSpoken} in ${COUNTDOWN_SEC} seconds. Tap Stop to cancel.`,
    );

    clearCountdown();
    // `remaining` is a closure counter — the side-effect (dial) lives
    // in the interval BODY, not inside a setState updater, so React
    // StrictMode's double-invoked updaters can't fire the call twice.
    const phoneNumber = contact?.phoneNumber;
    let remaining = COUNTDOWN_SEC;
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearCountdown();
        if (target === '911') {
          dialOrWarn('tel:911', 'Dial 911 directly from your phone.');
        } else if (phoneNumber) {
          dialOrWarn(
            `tel:${phoneNumber}`,
            `Call ${contactName} directly at ${phoneNumber}.`,
          );
        }
        // Return to idle so the user sees a usable surface if the
        // dial failed (Simulator, iPad). On a real device the Phone
        // app takes over visually.
        setMode({ kind: 'idle' });
        setCountdownSec(COUNTDOWN_SEC);
        return;
      }
      setCountdownSec(remaining);
    }, 1000);
  }

  function stopCountdown() {
    clearCountdown();
    setMode({ kind: 'idle' });
    setCountdownSec(COUNTDOWN_SEC);
  }

  const countdownTargetLabel =
    mode.kind === 'countdown'
      ? mode.target === '911'
        ? 'Calling 911'
        : `Calling ${contactName}`
      : '';

  // Pivot — symmetric de/escalation mid-countdown. The other target,
  // if reachable from this state:
  //   - on 911 countdown: contact pivot only when a contact is set
  //     (else there's nothing to pivot to)
  //   - on contact countdown: 911 pivot always available
  // Tapping the pivot stops the current timer and starts a fresh
  // 3-second countdown for the new target — the user gets another
  // cancel window on the switch rather than carrying a stale partial
  // window forward (a punishing pivot punishes deliberation).
  // Encodes thesis claim C8: the choice between paths stays live
  // until the dial actually fires, not just on the idle card.
  const pivotTarget: Target | null =
    mode.kind === 'countdown'
      ? mode.target === '911'
        ? hasContact
          ? 'contact'
          : null
        : '911'
      : null;
  const pivotLabel =
    pivotTarget === '911'
      ? 'Or call 911'
      : pivotTarget === 'contact'
        ? `Or call ${contactName}`
        : undefined;
  const pivotA11yLabel =
    pivotTarget === '911'
      ? 'Switch to calling 911 instead'
      : pivotTarget === 'contact'
        ? `Switch to calling ${contactName} instead`
        : undefined;

  function handlePivot() {
    if (!pivotTarget) return;
    startCountdown(pivotTarget, { isPivot: true });
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Scrim — tappable to dismiss in idle, NOT during countdown.
          A misplaced tap on the dim layer mid-countdown shouldn't
          drop the call before the user has time to interrupt it. */}
      <Pressable
        style={styles.scrim}
        onPress={mode.kind === 'idle' ? dismiss : undefined}
        accessible={false}
        accessibilityElementsHidden
      />

      <View style={styles.centering} pointerEvents="box-none">
        <View style={styles.card}>
          {mode.kind === 'idle' ? (
            <IdleView
              contactName={contactName}
              hasContact={hasContact}
              onCallContact={() => startCountdown('contact')}
              onCall911={() => startCountdown('911')}
              onClose={dismiss}
            />
          ) : (
            <CountdownView
              title={countdownTargetLabel}
              seconds={countdownSec}
              pivotLabel={pivotLabel}
              pivotA11yLabel={pivotA11yLabel}
              onPivot={pivotTarget ? handlePivot : undefined}
              onStop={stopCountdown}
            />
          )}
        </View>
      </View>
    </View>
  );
}

// --- Idle ---------------------------------------------------------------

function IdleView({
  contactName,
  hasContact,
  onCallContact,
  onCall911,
  onClose,
}: {
  contactName: string;
  hasContact: boolean;
  onCallContact: () => void;
  onCall911: () => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Header — small SOS asterisk + close X. The asterisk is the
          same glyph used everywhere SOS appears (/en-route side-button,
          /safety-settings SOS row) so the visual anchor stays
          consistent across surfaces. */}
      <View style={styles.header}>
        <Asterisk size={24} color={colors.red} weight="bold" />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          style={({ pressed }) => [styles.closeBtn, pressed && pressedDim]}
        >
          <X size={20} color={colors.labelSecondary} weight="bold" />
        </Pressable>
      </View>

      <Text style={styles.title} accessibilityRole="header">
        Need help?
      </Text>
      <Text style={styles.subtitle}>You choose who responds.</Text>

      {/* Trusted-contact path (the calm, community-first option). When
          no contact is set the same button routes to setup — degrades
          gracefully instead of disappearing or going dead. */}
      <Pressable
        onPress={onCallContact}
        accessibilityRole="button"
        accessibilityLabel={
          hasContact
            ? `Call ${contactName}. Three-second cancel window.`
            : 'Set up a trusted contact first'
        }
        style={({ pressed }) => [
          styles.actionBtn,
          styles.actionBtnContact,
          pressed && pressedDim,
        ]}
      >
        <Phone size={20} color={colors.white} weight="fill" />
        <Text style={styles.actionBtnText}>
          {hasContact ? `Call ${contactName}` : 'Set up a contact first'}
        </Text>
      </Pressable>

      {/* 911 escalation. Red bg = the reserved emergency-signal color
          (.cursorrules #4 / exception 6). The 3-second Stop window on
          the countdown card IS the deliberate confirmation step — no
          separate confirm screen needed. */}
      <Pressable
        onPress={onCall911}
        accessibilityRole="button"
        accessibilityLabel="Call 911. Three-second cancel window."
        style={({ pressed }) => [
          styles.actionBtn,
          styles.actionBtn911,
          pressed && pressedDim,
        ]}
      >
        <Phone size={20} color={colors.white} weight="fill" />
        <Text style={styles.actionBtnText}>Call 911</Text>
      </Pressable>

      <Text style={styles.hint}>
        Each call gives you {COUNTDOWN_SEC} seconds to cancel.
      </Text>
    </>
  );
}

// --- Countdown ----------------------------------------------------------

function CountdownView({
  title,
  seconds,
  pivotLabel,
  pivotA11yLabel,
  onPivot,
  onStop,
}: {
  title: string;
  seconds: number;
  pivotLabel?: string;
  pivotA11yLabel?: string;
  onPivot?: () => void;
  onStop: () => void;
}) {
  return (
    <>
      <Text style={styles.title} accessibilityRole="header" accessibilityLiveRegion="polite">
        {title}
      </Text>

      {/* Red disc with the live countdown numeral. Matches Figma
          49-5188 / 49-5388. The disc IS the "we're dialing now"
          signal; red carries that without further chrome. */}
      <View
        style={styles.countdownDisc}
        accessible
        accessibilityLabel={`${seconds} seconds remaining`}
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.countdownNumber}>{seconds}</Text>
      </View>

      {/* Stop affordance — X glyph in a neutral circle + "Stop" label.
          Sized as a real 64pt tap target (the centered chrome is 48pt
          but the Pressable's hit area extends to the surrounding gap)
          so the user can interrupt mid-countdown reliably. */}
      <Pressable
        onPress={onStop}
        accessibilityRole="button"
        accessibilityLabel="Stop the call"
        hitSlop={12}
        style={({ pressed }) => [styles.stopBtn, pressed && pressedDim]}
      >
        <View style={styles.stopChrome}>
          <X size={20} color={colors.labelSecondary} weight="bold" />
        </View>
        <Text style={styles.stopLabel}>Stop</Text>
      </Pressable>

      {/* Pivot — symmetric mid-countdown target swap. Tertiary chrome
          (text + leading 16pt Phone glyph, labelSecondary) so it
          doesn't compete with Stop's primary interrupt weight. Only
          rendered when there's actually a target to pivot to (911
          countdown with no contact set → no link). */}
      {pivotLabel && onPivot && (
        <Pressable
          onPress={onPivot}
          accessibilityRole="button"
          accessibilityLabel={pivotA11yLabel ?? pivotLabel}
          hitSlop={8}
          style={({ pressed }) => [styles.pivotBtn, pressed && pressedDim]}
        >
          <Phone size={16} color={colors.labelSecondary} weight="duotone" />
          <Text style={styles.pivotLabel}>{pivotLabel}</Text>
        </Pressable>
      )}
    </>
  );
}

// --- Styles -------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.modalScrim,
  },
  centering: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Centered card — mirrors /report's popup chrome (20pt edge margin,
  // 400pt cap, white + shadows.e2). Sized to read as a "focused dialog,"
  // not a sheet that takes over the screen. Matches Figma 49-5188 /
  // 49-5388 / 49-197.
  card: {
    alignSelf: 'stretch',
    marginHorizontal: 20,
    maxWidth: 400,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    ...shadows.e2,
  },

  // --- Header (idle) ---
  header: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 32,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Shared text ---
  title: {
    ...dynamicType(typography.title2Emphasized),
    color: colors.black,
    textAlign: 'center',
  },
  subtitle: {
    ...dynamicType(typography.bodyRegular),
    color: colors.labelSecondary,
    textAlign: 'center',
  },

  // --- Action buttons (idle) ---
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    height: 52,
    borderRadius: 100,
    paddingHorizontal: spacing.lg,
  },
  // navy = the canonical safety-affordance color (.cursorrules
  // exception 6 — en-route Shield FAB register). The trusted-contact
  // call is the community-first, lower-escalation option and reads in
  // that register.
  actionBtnContact: {
    backgroundColor: colors.navy,
  },
  // Reserved-color red — the 911 escalation gets the full alert color.
  actionBtn911: {
    backgroundColor: colors.red,
  },
  actionBtnText: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.white,
  },
  hint: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelTertiary,
    textAlign: 'center',
  },

  // --- Countdown disc + Stop (per Figma) ---
  countdownDisc: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.sm,
    ...shadows.e1,
  },
  countdownNumber: {
    // Big tabular-nums numeral so the digit doesn't shift the disc's
    // visual center as the count steps down.
    ...typography.sosCountdown,
    color: colors.white,
    fontVariant: ['tabular-nums'],
    lineHeight: 56,
  },
  stopBtn: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  stopChrome: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.fillsTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopLabel: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
  },
  // Tertiary chrome — text link with leading Phone glyph. Sits below
  // Stop in the visual stack, in the labelSecondary register, so it
  // reads as a quiet alternative rather than a competing primary CTA.
  pivotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  pivotLabel: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
  },
});
