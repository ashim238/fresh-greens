import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
// Deep import path (phosphor-react-native exposes ./src/icons/* via
// its `exports` field). Bypasses the barrel index, which Metro chokes
// on — the barrel re-exports ~9000 icons and any single resolution
// failure (we hit ./icons/Bank) takes the whole bundle down. Direct
// import = only this one icon gets pulled into the bundle.
//
// TypeScript resolves this path to the package's precompiled .d.ts
// via the `paths` mapping in tsconfig.json (avoids type-checking
// phosphor's strict-incompatible source TSX). Metro still uses the
// .tsx source at runtime per phosphor's exports field.
import { UserPlus } from 'phosphor-react-native/src/icons/UserPlus';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageControl } from '../components/PageControl';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Trusted Contact Setup — onboarding step 5 of 5, also reused as the
 * "edit trusted contact" surface from /menu.
 *
 * Asks the user to pick the person who'll be alerted during the safety
 * flow and whose number the Call/Text buttons in /pulled-over dial.
 * "Pick a contact" opens iOS's native contact picker — no contacts
 * permission required because the OS handles selection on our behalf
 * and only returns the chosen contact.
 *
 * Two-state screen:
 *   - empty (no contact picked yet) → CTA + skip option
 *   - preview (contact picked) → avatar + name + Continue / change
 *
 * Routing depends on entry point. The `from` query param distinguishes:
 *   - undefined / "onboarding" → Continue + Skip both `replace('/home')`,
 *     ending the onboarding stack. Default behavior.
 *   - "settings" → Continue + Skip both `back()`, returning to /menu
 *     so the user lands back where they came from.
 * Without this param, editing trusted contact from /menu would push the
 * user to /home instead of returning to Settings — wrong stack semantics.
 *
 * Skipping is always allowed: /pulled-over falls back to a "no contact
 * set" state when there's nothing stored.
 *
 * Route: /trusted-contact-setup
 */
type EntryPoint = 'onboarding' | 'settings';

export default function TrustedContactSetup() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: EntryPoint }>();
  const fromSettings = params.from === 'settings';
  const { contact, pickContact } = useTrustedContact();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePickContact() {
    if (picking) return;
    setError(null);
    setPicking(true);
    try {
      await pickContact();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not pick contact. Try again.',
      );
      console.warn('pickContact failed', err);
    } finally {
      setPicking(false);
    }
  }

  function handleContinue() {
    if (fromSettings) {
      router.back();
    } else {
      router.replace('/home');
    }
  }

  function handleSkip() {
    if (fromSettings) {
      router.back();
    } else {
      router.replace('/home');
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.safe}>
        {/*
          Step 5 of 5 — final onboarding step before /home. Hidden when
          reached from /menu since the user isn't progressing through
          onboarding; they're editing settings.
        */}
        {!fromSettings && <PageControl total={5} activeIndex={4} />}

        <View style={styles.content}>
          <View style={styles.copy}>
            <Text style={styles.title}>Set your trusted contact</Text>
            <Text style={styles.body}>
              Fresh Greens alerts this person during emergencies and shares
              your location with them. They're who the Call and Text buttons
              dial during a safety event.
            </Text>
          </View>

          {contact ? (
            <View style={styles.preview}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitials}>{contact.initials}</Text>
              </View>
              <View style={styles.previewText}>
                <Text style={styles.previewName}>{contact.name}</Text>
                <Text style={styles.previewPhone}>{contact.phoneNumber}</Text>
              </View>
            </View>
          ) : (
            // Empty state is itself a Pressable — the big icon is the
            // most visible affordance on the screen, so tapping anywhere
            // in the card fires the picker. The bottom CTA is a
            // redundant tap target for users who don't realize the card
            // is interactive.
            <Pressable
              style={[styles.emptyState, picking && styles.emptyStateBusy]}
              onPress={handlePickContact}
              disabled={picking}
              accessibilityRole="button"
              accessibilityLabel="Pick a contact"
              accessibilityHint="Opens the contact picker"
              accessibilityState={{ busy: picking, disabled: picking }}
            >
              <UserPlus
                size={56}
                color={colors.fadedgreen}
                weight="duotone"
              />
              <Text style={styles.emptyText}>
                No contact set yet. Tap to pick someone you trust.
              </Text>
            </Pressable>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          {/*
            Action hierarchy:
            - Empty state: [Pick a contact] primary, [Skip] link
            - Contact picked: [Continue] primary, [Change contact]
              outlined, [Skip] link
            Primary action is always freshgreen-filled per established
            register (matches /permissions Continue button, /onboarding
            Continue button). Outlined wiltedgreen variant is for the
            "secondary, you-might-need-this" tier.
          */}
          <View style={styles.actions}>
            {contact ? (
              <>
                <Pressable
                  style={[styles.cta, styles.ctaPrimary]}
                  onPress={handleContinue}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with this trusted contact"
                >
                  <Text style={styles.ctaText}>Continue</Text>
                </Pressable>
                <Pressable
                  style={[styles.cta, picking && styles.ctaBusy]}
                  onPress={handlePickContact}
                  disabled={picking}
                  accessibilityRole="button"
                  accessibilityLabel="Change trusted contact"
                  accessibilityState={{ busy: picking, disabled: picking }}
                >
                  {picking ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.ctaText}>Change contact</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <Pressable
                style={[
                  styles.cta,
                  styles.ctaPrimary,
                  picking && styles.ctaBusy,
                ]}
                onPress={handlePickContact}
                disabled={picking}
                accessibilityRole="button"
                accessibilityLabel="Pick a contact"
                accessibilityState={{ busy: picking, disabled: picking }}
              >
                {picking ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.ctaText}>Pick a contact</Text>
                )}
              </Pressable>
            )}

            <Pressable
              onPress={handleSkip}
              style={styles.skipBtn}
              accessibilityRole="button"
              accessibilityLabel="Skip for now"
              hitSlop={12}
            >
              <Text style={styles.skipText}>Skip for now</Text>
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
  safe: {
    flex: 1,
    paddingHorizontal: 32,
    paddingBottom: 34,
  },
  content: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    gap: 32,
  },
  copy: {
    gap: 16,
  },
  title: {
    ...typography.title1Emphasized,
    color: colors.white,
  },
  body: {
    ...typography.subheadlineRegular,
    color: colors.white,
  },

  // --- Preview (contact picked) ---
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.burntgreen,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    ...typography.title3Emphasized,
    color: colors.white,
  },
  previewText: {
    flex: 1,
    gap: 2,
  },
  previewName: {
    ...typography.bodyEmphasized,
    color: colors.white,
  },
  previewPhone: {
    ...typography.subheadlineRegular,
    color: colors.fadedgreen,
  },

  // --- Empty state (no contact yet) ---
  // The whole card is tappable — well above 44pt min on every axis.
  // Uses fadedgreen border (vs preview's burntgreen fill) so the card
  // reads as "empty / waiting for input" rather than "filled / done".
  emptyState: {
    alignItems: 'center',
    gap: 12,
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.fadedgreen,
  },
  emptyStateBusy: {
    opacity: 0.7,
  },
  emptyText: {
    ...typography.subheadlineRegular,
    color: colors.fadedgreen,
    textAlign: 'center',
  },

  errorText: {
    ...typography.footnoteRegular,
    color: colors.red,
    textAlign: 'center',
  },

  // --- Actions ---
  actions: {
    gap: 12,
    paddingTop: 8,
  },
  // Outlined wiltedgreen-bordered pill — secondary action register.
  // Mirrors /pulled-over's Continue button (audit-4 quieter register).
  cta: {
    height: 48,
    borderRadius: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.fadedgreen,
  },
  // Freshgreen-filled pill — primary action register. Matches
  // /permissions Continue and /onboarding Continue.
  ctaPrimary: {
    backgroundColor: colors.freshgreen,
    borderColor: colors.freshgreen,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  ctaBusy: {
    opacity: 0.7,
  },
  ctaText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
  },
  skipBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
    textDecorationLine: 'underline',
  },
});
