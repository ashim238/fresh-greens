import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Microphone } from 'phosphor-react-native/src/icons/Microphone';
import { NavigationArrow } from 'phosphor-react-native/src/icons/NavigationArrow';
import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PermissionsCar from '../assets/illustrations/permissions-car.svg';
import PermissionsLocation from '../assets/illustrations/permissions-location.svg';
import { Button } from '../components/Button';
import { PageControl } from '../components/PageControl';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Permissions — onboarding step 4 of 5. Asks the user to grant
 * location AND microphone access.
 *
 * Mic permission was previously requested mid-stress during the
 * /pulled-over guidance phase, which is the worst possible moment —
 * the user is being pulled over and we're popping a system dialog.
 * Asking here, during calm onboarding, lets the user grant in advance
 * so the safety flow is silent about it later.
 *
 * Both permissions are requested back-to-back when the CTA is tapped.
 * iOS shows them as two sequential dialogs. If either is denied we
 * still continue to the next step — the app degrades gracefully:
 * routes work without precise location (less accurate scoring),
 * recording falls back to a flat-baseline waveform without the mic.
 *
 * Route: /permissions
 * Figma node: 825:3585
 */
export default function Permissions() {
  const router = useRouter();

  // Recovery affordance: when the OS will no longer show the permission
  // prompt (user previously tapped "Don't Allow"), `canAskAgain` is
  // false AND status is 'denied'. Without a visible escape hatch, the
  // user taps Continue and advances silently with no permissions —
  // worst-case UX. We surface a footnote-link recovery affordance below
  // Continue when either permission is in that state.
  //
  // Subtle: on iOS, `canAskAgain` is `false` after *any* decision,
  // including grant — because iOS doesn't re-prompt for an already-
  // granted permission either. So checking only `!canAskAgain` is too
  // broad (link shows after granting too). The right condition is
  // "status not granted AND OS won't ask again."
  const [locationNeedsRecovery, setLocationNeedsRecovery] = useState(false);
  const [micNeedsRecovery, setMicNeedsRecovery] = useState(false);

  // useFocusEffect re-checks on every focus, so when the user opens
  // iOS Settings via the recovery link, grants permission, and
  // navigates back, the affordance disappears on the next render.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [loc, mic] = await Promise.all([
          Location.getForegroundPermissionsAsync(),
          getRecordingPermissionsAsync(),
        ]);
        if (cancelled) return;
        setLocationNeedsRecovery(loc.status !== 'granted' && !loc.canAskAgain);
        setMicNeedsRecovery(mic.status !== 'granted' && !mic.canAskAgain);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const showSettingsRecovery = locationNeedsRecovery || micNeedsRecovery;

  // Permission-specific recovery copy. Generic "Previously declined?"
  // didn't tell users which permission still needed attention — first
  // tester granted Location, missed that Microphone was still pending,
  // wondered why the link persisted. Naming what's actually pending
  // makes the next step obvious.
  const recoveryPrompt = (() => {
    if (locationNeedsRecovery && micNeedsRecovery) {
      return 'Location and microphone need enabling';
    }
    if (locationNeedsRecovery) return 'Location needs enabling';
    return 'Microphone needs enabling';
  })();

  function handleOpenSettings() {
    // Linking.openSettings() opens the app's page in iOS Settings,
    // not the root Settings app. User lands directly where they can
    // toggle Location / Microphone for Fresh Greens.
    Linking.openSettings();
  }

  // Permission flow. requestForegroundPermissionsAsync handles all three
  // states with a single call:
  //   - undetermined → shows the iOS prompt → returns user's choice
  //   - granted (already) → returns granted immediately, no prompt
  //   - denied (already) → returns denied immediately, no prompt
  //
  // We use this rather than getForegroundPermissionsAsync because the
  // "get" variant can return stale state right after the user toggles
  // permission in iOS Settings; "request" forces a fresh OS-level check.
  //
  // Both location and mic are non-blocking for onboarding. We always
  // advance to /trusted-contact-setup after the prompts, regardless of
  // grant/deny — onboarding momentum > permission gating. If the user
  // denied either, the app degrades gracefully (less precise routing
  // without location, flat-baseline waveform without mic) and they can
  // re-enable later via system Settings.
  async function handleContinuePress() {
    Haptics.selectionAsync().catch(() => {});
    await Location.requestForegroundPermissionsAsync();
    await requestRecordingPermissionsAsync();
    // Only caller that wants the home-reset exit (end of onboarding).
    // ?from=onboarding opts into the dark brand splash + replace('/home')
    // exit — every other caller defaults to back() + white register.
    // See trusted-contact-setup.tsx's docblock.
    router.push('/trusted-contact-setup?from=onboarding');
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.safe}>
        {/* Step 4 of 5 — permissions. Trusted-contact setup follows. */}
        <PageControl total={5} activeIndex={3} />

        {/*
          Content fills the remaining vertical space, centered. Children
          are left-aligned (items-start), with a 32pt gap between the
          visual+copy block and the Settings CTA.
        */}
        <View style={styles.content}>
          <View style={styles.visualAndCopy}>
            <View style={styles.visual} accessibilityIgnoresInvertColors>
              <View style={styles.locationWrap}>
                <View style={styles.locationRotated}>
                  <PermissionsLocation
                    width={26.881}
                    height={33.797}
                    accessible
                    accessibilityLabel="Location pin illustration"
                  />
                </View>
              </View>
              <View style={styles.carWrap}>
                <PermissionsCar
                  width={57}
                  height={40}
                  accessible
                  accessibilityLabel="Car illustration"
                />
              </View>
            </View>

            {/* Copy block — body + sub instructions, all left-aligned */}
            <View style={styles.copy}>
              <View style={styles.mainBody}>
                <Text style={styles.body}>
                  Fresh Greens needs your precise location for turn-by-turn
                  directions and route-safety insights — lighting, wildlife,
                  road conditions — and microphone access to record audio
                  during traffic stops as ambient protection.
                </Text>
                <Text style={styles.tapInstruction}>
                  Tap Continue. You'll see two quick prompts:
                </Text>
              </View>

              {/*
                Sub-instructions list what each iOS prompt will ask for.
                Reflects the new flow (in-app prompts, no system-Settings
                deep-link) — the rows that used to walk the user through
                navigating iOS Settings became misleading.
              */}
              <View style={styles.subDirections}>
                <View style={styles.subRow}>
                  <View style={styles.thumb}>
                    <NavigationArrow
                      size={14}
                      color={colors.freshgreen}
                      weight="duotone"
                    />
                  </View>
                  <Text style={styles.subText}>Location</Text>
                </View>
                <View style={styles.subRow}>
                  <View style={styles.thumb}>
                    <Microphone
                      size={14}
                      color={colors.black}
                      weight="duotone"
                    />
                  </View>
                  <Text style={styles.subText}>Microphone</Text>
                </View>
              </View>
            </View>
          </View>

          <Button
            type="primary"
            fill="fill"
            text="Continue"
            onPress={handleContinuePress}
            accessibilityLabel="Continue and grant permissions"
            style={styles.cta}
          />

          {/*
            Recovery affordance for the "previously declined" state.
            iOS doesn't re-prompt once the user taps Don't Allow, so
            without this link the only escape is to find the app in
            Settings manually. Inline-link register matches Get Started
            / Login's "Already have an account? Log in" pattern —
            footnoteRegular white prompt with a freshgreen underlined
            action span.
          */}
          {showSettingsRecovery && (
            <Pressable
              onPress={handleOpenSettings}
              style={({ pressed }) => [
                styles.settingsLinkRow,
                pressed && pressedDim,
              ]}
              accessibilityRole="link"
              accessibilityLabel={`${recoveryPrompt}. Open iOS Settings.`}
            >
              <Text style={styles.settingsLinkPrompt}>
                {recoveryPrompt} —{' '}
                <Text style={styles.settingsLink}>Open iOS Settings</Text>
              </Text>
            </Pressable>
          )}
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
    paddingHorizontal: spacing.xl, // matches Figma — works directly on SafeAreaView now that we use react-native-safe-area-context
    paddingBottom: spacing.xl,
  },
  content: {
    flex: 1,
    width: '100%',
    // Default alignItems: 'stretch' — wrapper Views (visualAndCopy, copy,
    // mainBody) fill the cross-axis width so the Text inside can wrap
    // within the padded safe area. Explicitly setting flex-start collapses
    // wrappers to text intrinsic width and visually swallows the padding.
    justifyContent: 'center',
    gap: spacing.xl,
  },
  visualAndCopy: {
    gap: spacing.xl,
  },
  visual: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  locationWrap: {
    width: 35.891,
    height: 40.374,
    marginLeft: 10.71,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationRotated: {
    transform: [{ rotate: '17.72deg' }],
  },
  carWrap: {
    width: 57,
    height: 40,
  },
  copy: {
    gap: spacing.xl, // gap between mainBody and subDirections
  },
  mainBody: {
    gap: spacing.md, // gap between body and "Tap Settings below:"
  },
  body: {
    // bodyEmphasized (17pt) per the 2026-06-01 text-size audit. This
    // is the primary instructional copy on the permissions screen
    // ("Allow location access to find safe routes…") — primary
    // content deserves the iOS-norm body register, not the 15pt
    // subhead tier v1 had it at.
    ...dynamicType(typography.bodyEmphasized),
    color: colors.white,
  },
  tapInstruction: {
    // subheadlineRegular (15pt) per the 2026-06-01 text-size audit.
    // The "Tap Settings below:" instruction is part of the step-by-
    // step guidance flow; 13pt left it reading as caption while the
    // body above is now 17pt. 15pt keeps it subordinate to the body
    // (17pt) but lifts it out of fine-print tier.
    ...dynamicType(typography.subheadlineRegular),
    color: colors.white,
  },
  subDirections: {
    gap: spacing.md,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: radii.xs,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  subText: {
    // Bumped 13pt → 15pt to match tapInstruction above — both are
    // step-by-step guidance copy and want the same supporting-tier
    // register. Audit 2026-06-01.
    ...dynamicType(typography.subheadlineRegular),
    color: colors.white,
  },
  cta: {
    // Width per Figma 1100:8115 — 163pt Container that wraps the
    // button. Left-aligned with the rest of the content.
    alignSelf: 'flex-start',
    width: 163,
  },
  // Recovery-affordance row — same inline-link pattern as Get Started's
  // "Already have an account? Log in" (footnoteRegular white prompt +
  // freshgreen underlined action). Left-aligned to match the rest of
  // the Permissions content (visual + body + CTA all sit at flex-start).
  // paddingVertical: 16 brings the effective tap area up to ~46pt
  // around the ~14pt footnote text — clears the iOS HIG 44pt minimum
  // without going so wide that the link visually competes with Continue.
  settingsLinkRow: {
    paddingVertical: spacing.md,
  },
  settingsLinkPrompt: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.white,
  },
  settingsLink: {
    color: colors.freshgreen,
    fontFamily: typography.footnoteEmphasized.fontFamily,
    textDecorationLine: 'underline',
  },
});
