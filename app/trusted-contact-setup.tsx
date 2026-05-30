import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { UserPlus } from 'phosphor-react-native/src/icons/UserPlus';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { PageControl } from '../components/PageControl';
import { EmptyState } from '../components/StateCard';
import { useReduceMotion } from '../hooks/useReduceMotion';
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
 *   - "emergency" → Continue + Skip both `back()`, returning to the
 *     /emergency SOS screen that pushed here (when the user has no
 *     trusted contact yet). Without this, Skip fell through to the
 *     onboarding `replace('/home')`, which dropped a fresh Home card on
 *     top of the live stack — the "Home overlays as a sheet" bug.
 * Any `from` value other than onboarding ("embedded" entry) returns via
 * back(); without the param, editing from /menu or skipping from SOS
 * would push the user to /home instead — wrong stack semantics.
 *
 * Embedded entries (settings + emergency) also swap the visual register
 * from wiltedgreen-on-dark to white-on-light, matching the white
 * /safety-settings and /emergency surfaces that push here. The
 * onboarding register stays the dark brand splash — flipping it
 * mid-onboarding would feel disjointed.
 *
 * Skipping is always allowed: /pulled-over falls back to a "no contact
 * set" state when there's nothing stored.
 *
 * Route: /trusted-contact-setup
 */
type EntryPoint = 'onboarding' | 'settings' | 'emergency';

export default function TrustedContactSetup() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: EntryPoint }>();
  // "Embedded" = reached from inside the app (Settings or the Emergency
  // SOS screen), NOT the first-run onboarding flow. Embedded entries
  // return via back() to where the user came from and use the white
  // register; onboarding (no param) ends the onboarding stack with
  // replace('/home') and keeps the dark brand splash.
  const embedded = params.from === 'settings' || params.from === 'emergency';
  const { contact, loading: contactLoading, pickContact } = useTrustedContact();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reduceMotion = useReduceMotion();

  // Avatar entrance — fire a success notification haptic + a small
  // spring on the avatar block when `contact` first transitions from
  // unset → set (or changes to a new ID, signalling a contact swap).
  //
  // The trusted-contact store hydrates async from AsyncStorage, so
  // we can't capture the initial id at component-define time — at
  // that moment `contact` is always undefined regardless of what's
  // persisted. Instead, on the first post-hydrate render (`loading
  // === false`) we capture the hydrated id into the ref, then start
  // comparing future changes against it. The `undefined` sentinel
  // distinguishes "not yet captured" from "captured as null."
  const avatarScale = useRef(new Animated.Value(1)).current;
  const initialContactIdRef = useRef<string | null | undefined>(undefined);
  const lastAnimatedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (contactLoading) return;
    if (initialContactIdRef.current === undefined) {
      // First post-hydrate render — capture the baseline and return.
      // A pre-existing contact at mount doesn't fire the animation.
      initialContactIdRef.current = contact?.id ?? null;
      return;
    }
    if (!contact?.id) return;
    if (contact.id === initialContactIdRef.current) return;
    if (contact.id === lastAnimatedIdRef.current) return;
    lastAnimatedIdRef.current = contact.id;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    if (!reduceMotion) {
      avatarScale.setValue(0.85);
      Animated.spring(avatarScale, {
        toValue: 1,
        tension: 180,
        friction: 12,
        useNativeDriver: true,
      }).start();
    }
  }, [contact?.id, contactLoading, reduceMotion, avatarScale]);

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
    if (embedded) {
      router.back();
    } else {
      router.replace('/home');
    }
  }

  function handleSkip() {
    if (embedded) {
      router.back();
    } else {
      router.replace('/home');
    }
  }

  return (
    <View style={[styles.root, embedded && stylesWhite.root]}>
      <StatusBar style={embedded ? 'dark' : 'light'} />

      <SafeAreaView style={styles.safe}>
        {/*
          Onboarding shows the 5-of-5 PageControl as the forward
          progress affordance. Embedded entries (settings / emergency)
          show a back caret instead — onboarding is forward-only, while
          an in-app entry needs an explicit return path to the screen
          that pushed here. Mirrors /safety-settings + /recordings.
        */}
        {embedded ? (
          <View style={styles.backHeader}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={12}
              style={({ pressed }) => [
                styles.backBtn,
                pressed && pressedDim,
              ]}
            >
              <Ionicons name="chevron-back" size={28} color={colors.black} />
            </Pressable>
          </View>
        ) : (
          <PageControl total={5} activeIndex={4} />
        )}

        <View style={styles.content}>
          <View style={styles.copy}>
            <Text style={[styles.title, embedded && stylesWhite.title]}>
              Set your Trusted Contact
            </Text>
            <Text style={[styles.body, embedded && stylesWhite.body]}>
              Fresh Greens alerts this person during emergencies and shares
              your location with them. They're who the Call and Text buttons
              dial during a safety event.
            </Text>
          </View>

          {contact ? (
            <View style={[styles.preview, embedded && stylesWhite.preview]}>
              <Animated.View
                style={[
                  styles.avatar,
                  embedded && stylesWhite.avatar,
                  { transform: [{ scale: avatarScale }] },
                ]}
              >
                <Text style={styles.avatarInitials}>{contact.initials}</Text>
              </Animated.View>
              <View style={styles.previewText}>
                <Text
                  style={[
                    styles.previewName,
                    embedded && stylesWhite.previewName,
                  ]}
                >
                  {contact.name}
                </Text>
                <Text
                  style={[
                    styles.previewPhone,
                    embedded && stylesWhite.previewPhone,
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
            Action hierarchy is now consistent across registers because
            the Button component's primary+fill variant ships with a
            wiltedgreen 1pt border (invisible on green-onboarding, lifts
            contrast on white-settings — see Button.tsx primaryFill).
            Continue is primary+fill on both. Skip needs to swap on the
            white register because primary+transparent renders white
            text — invisible on white. Settings flips Skip to
            secondary+outline so the wiltedgreen text reads cleanly.
          */}
          <View style={styles.actions}>
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
            {embedded ? (
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
    // 32pt per 4pt grid. Was 34 — likely a transcription drift from
    // a 32 + 2 calc. iOS bottom-safe-area inset is added on top of
    // this by SafeAreaView so the final clear above the home-bar is
    // ~64pt either way.
    paddingBottom: 32,
  },
  // Back-caret row (embedded entries — settings / emergency). 32pt outer left-align
  // matches the safe area's paddingHorizontal so the caret reads
  // as gutter-anchored rather than inset.
  backHeader: {
    // -16 offset pulls the back-button row to the left edge of the
    // page (the SafeAreaView's paddingHorizontal:32 would otherwise
    // double-indent the caret relative to the title block below).
    marginLeft: -16,
    marginBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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

// White-on-light overrides applied for embedded entries — reached from
// /safety-settings or the /emergency SOS screen (`from=settings` /
// `from=emergency`). Only the register-sensitive styles
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
