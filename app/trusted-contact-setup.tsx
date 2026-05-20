import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { UserPlus } from 'phosphor-react-native/src/icons/UserPlus';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { PageControl } from '../components/PageControl';
import { EmptyState } from '../components/StateCard';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
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
 * The `from=settings` entry point also swaps the visual register from
 * wiltedgreen-on-dark to white-on-light, matching the /safety-settings
 * page that pushes here. The onboarding register stays untouched —
 * the dark green is part of the brand introduction and flips mid-flow
 * would feel disjointed.
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
    Haptics.selectionAsync().catch(() => {});
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
    <View style={[styles.root, fromSettings && stylesWhite.root]}>
      <StatusBar style={fromSettings ? 'dark' : 'light'} />

      <SafeAreaView style={styles.safe}>
        {/*
          Step 5 of 5 — final onboarding step before /home. Hidden when
          reached from /menu since the user isn't progressing through
          onboarding; they're editing settings.
        */}
        {!fromSettings && <PageControl total={5} activeIndex={4} />}

        <View style={styles.content}>
          <View style={styles.copy}>
            <Text style={[styles.title, fromSettings && stylesWhite.title]}>
              Set your Trusted Contact
            </Text>
            <Text style={[styles.body, fromSettings && stylesWhite.body]}>
              Fresh Greens alerts this person during emergencies and shares
              your location with them. They're who the Call and Text buttons
              dial during a safety event.
            </Text>
          </View>

          {contact ? (
            <View style={[styles.preview, fromSettings && stylesWhite.preview]}>
              <View
                style={[styles.avatar, fromSettings && stylesWhite.avatar]}
              >
                <Text style={styles.avatarInitials}>{contact.initials}</Text>
              </View>
              <View style={styles.previewText}>
                <Text
                  style={[
                    styles.previewName,
                    fromSettings && stylesWhite.previewName,
                  ]}
                >
                  {contact.name}
                </Text>
                <Text
                  style={[
                    styles.previewPhone,
                    fromSettings && stylesWhite.previewPhone,
                  ]}
                >
                  {contact.phoneNumber}
                </Text>
              </View>
            </View>
          ) : (
            // The whole EmptyState card is tappable — wraps the
            // StateCard EmptyState component in a Pressable so the
            // big icon is itself the primary affordance.
            <Pressable
              onPress={handlePickContact}
              disabled={picking}
              accessibilityRole="button"
              accessibilityLabel="Pick a contact"
              accessibilityHint="Opens the contact picker"
              accessibilityState={{ busy: picking, disabled: picking }}
              style={({ pressed }) => [pressed && !picking && pressedDim]}
            >
              <EmptyState
                icon={
                  <UserPlus
                    size={56}
                    color={colors.freshgreen}
                    weight="duotone"
                  />
                }
                headline="No contact set yet."
                text="Tap to add someone you trust."
              />
            </Pressable>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          {/*
            Action hierarchy diverges by register because the brand
            primary green (freshgreen #41AD49) clears WCAG AA on
            wiltedgreen but fails on white (2.88:1 — below the 3.0:1
            UI-component threshold). On the white settings register
            the buttons re-anchor to wiltedgreen (6.54:1 on white).
            - Onboarding (green page):
                Continue = Primary Fill (freshgreen on wiltedgreen)
                Skip    = Primary Transparent (white text)
            - Settings (white page):
                Continue = Secondary Fill (wiltedgreen on white)
                Skip    = Secondary Outline (wiltedgreen border+text)
            Either way Continue is the filled primary CTA and Skip is
            the lighter secondary option; only the color identity
            shifts to keep contrast safe.
          */}
          <View style={styles.actions}>
            {fromSettings ? (
              <Button
                type="secondary"
                fill="fill"
                text="Continue"
                onPress={handleContinue}
                accessibilityLabel={
                  contact
                    ? 'Continue with this trusted contact'
                    : 'Continue without a trusted contact'
                }
                style={styles.btnStretch}
              />
            ) : (
              <Button
                type="primary"
                fill="fill"
                text="Continue"
                onPress={handleContinue}
                accessibilityLabel={
                  contact
                    ? 'Continue with this trusted contact'
                    : 'Continue without a trusted contact'
                }
                style={styles.btnStretch}
              />
            )}
            {fromSettings ? (
              <Button
                type="secondary"
                fill="outline"
                text="Skip for now"
                onPress={handleSkip}
                style={styles.btnStretch}
              />
            ) : (
              <Button
                type="primary"
                fill="transparent"
                text="Skip for now"
                onPress={handleSkip}
                style={styles.btnStretch}
              />
            )}
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
    // Large Title/Emphasized (34pt) per Figma v2 — gives the
    // page-anchoring title weight equal to the onboarding panels.
    ...typography.largeTitleEmphasized,
    color: colors.white,
  },
  body: {
    // Body/Regular (17pt) — the explanatory copy reads as quieter
    // supporting information beneath the page title, not a directive.
    // (v1 used bodyEmphasized to "match the onboarding panels'
    // register"; in practice the panels' body copy and this page's
    // body copy serve different rhetorical roles — the panels deliver
    // the brand claims, this paragraph explains a setting.)
    ...typography.bodyRegular,
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

  errorText: {
    ...typography.footnoteRegular,
    color: colors.red,
    textAlign: 'center',
  },

  actions: {
    gap: 16,
    paddingTop: 8,
  },
  btnStretch: {
    alignSelf: 'stretch',
  },
});

// White-on-light overrides applied when reached from /safety-settings
// (`from=settings` query param). Only the register-sensitive styles
// live here — layout (gaps, padding, sizes) is shared with the green
// onboarding register above. Each override maps 1:1 to a base style
// name so the conditional application reads as "the white version of
// X" at the call sites.
const stylesWhite = StyleSheet.create({
  root: {
    backgroundColor: colors.white,
  },
  title: {
    color: colors.black,
  },
  body: {
    // labelSecondary (iOS system) matches the supporting-copy register
    // used elsewhere in the white surfaces (e.g. /recordings,
    // /safety-settings). Black would over-weight the supporting copy
    // relative to the title.
    color: colors.labelSecondary,
  },
  preview: {
    // systemGroupedBackground (iOS Settings light gray) gives the
    // preview card the same visual register as a settings list row,
    // matching where the user just came from (/safety-settings).
    backgroundColor: colors.systemGroupedBackground,
  },
  avatar: {
    // wiltedgreen pops cleanly against the light-gray preview card
    // surface; freshgreen reads as too saturated at this size against
    // a light bg.
    backgroundColor: colors.wiltedgreen,
  },
  previewName: {
    color: colors.black,
  },
  previewPhone: {
    color: colors.labelTertiary,
  },
});
