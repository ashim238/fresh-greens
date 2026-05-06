import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
// Deep import path bypasses the phosphor-react-native barrel (Metro
// chokes on the 9000-icon re-export); see app/trusted-contact-setup.tsx
// for the longer note. The tsconfig `paths` mapping redirects TS to
// the precompiled .d.ts so we don't type-check the source.
import { Car } from 'phosphor-react-native/src/icons/Car';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTrustedContact } from '../hooks/useTrustedContact';
import { useUser } from '../hooks/useUser';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Settings — pushed from /home's avatar button.
 *
 * The Settings spine that hosts secondary surfaces. v1 is intentionally
 * small (Profile / Trusted contact / Sign out) — Recordings and Recent
 * Trips slot in here when those features ship in their own PRs. The
 * spine is structural; the contents grow.
 *
 * Visual register matches the rest of Fresh Greens' setup-and-account
 * surfaces (Get Started, Login, Onboarding, Permissions, Trusted
 * Contact Setup): wiltedgreen page, white primary text, fadedgreen
 * accents and labels, burntgreen card fills. Pushing into /trusted-
 * contact-setup for an edit doesn't cause a jarring color transition
 * because both screens share the wiltedgreen base.
 *
 * Hero header uses a car icon as the user's identity glyph — same
 * iconography as the trusted-friend pin on /home, so the user reads
 * as a "car-in-the-system" throughout the app. Freshgreen is the
 * trusted-friend pin's color, so the user's own car uses fadedgreen
 * to differentiate the two roles.
 *
 * TODO: replace the Phosphor Car placeholder with the custom car
 * asset (matches the trusted-friend pin Figma asset). Same swap
 * pattern as the Officer/Trooper Ionicons placeholders.
 *
 * Sign-out semantics are local-only — clears stored user + trusted
 * contact and routes to /. Apple's own credential isn't revoked
 * here; that lives in iOS Settings → Apple ID, called out in the
 * footnote at the bottom.
 *
 * Route: /menu
 */
export default function Menu() {
  const router = useRouter();
  const { user, signOut } = useUser();
  const { contact, clearContact } = useTrustedContact();
  const [signingOut, setSigningOut] = useState(false);

  function handleBack() {
    router.back();
  }

  function handleEditTrustedContact() {
    // Reuse /trusted-contact-setup with from=settings so it routes
    // back to /menu on save/skip rather than replacing with /home.
    router.push('/trusted-contact-setup?from=settings');
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // Clear both stored identities together. Trusted contact is
      // identity-coupled enough that signing out without clearing
      // it would leak the previous user's contact into a future
      // sign-in (potentially under a different Apple ID). Clean
      // slate is the safer default.
      await Promise.all([signOut(), clearContact()]);
      router.replace('/');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Header: back chevron + page title. No bottom border —
            the wiltedgreen background flows through. */}
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={styles.headerBackBtn}
          >
            <Ionicons
              name="chevron-back"
              size={28}
              color={colors.white}
            />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageTitle}>Settings</Text>

          {/* --- Hero: car icon + name + email --- */}
          <View style={styles.hero}>
            <View style={styles.heroIconWrap}>
              <Car size={80} color={colors.fadedgreen} weight="regular" />
            </View>
            <Text style={styles.heroName}>
              {user?.displayName ?? 'Signed in'}
            </Text>
            {user?.email && (
              <Text style={styles.heroEmail}>{user.email}</Text>
            )}
          </View>

          {/* --- Trusted contact section --- */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Trusted contact</Text>
            <Pressable
              onPress={handleEditTrustedContact}
              style={styles.contactCard}
              accessibilityRole="button"
              accessibilityLabel={
                contact
                  ? `Trusted contact: ${contact.name}. Tap to change.`
                  : 'No trusted contact set. Tap to set one.'
              }
            >
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarInitials}>
                  {contact?.initials ?? '?'}
                </Text>
              </View>
              <View style={styles.contactTextStack}>
                <Text style={styles.contactName}>
                  {contact?.name ?? 'No contact set'}
                </Text>
                <Text style={styles.contactSecondary}>
                  {contact?.phoneNumber ?? 'Tap to choose'}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.fadedgreen}
              />
            </Pressable>
          </View>

          {/* --- Account section --- */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Account</Text>
            <Pressable
              onPress={handleSignOut}
              disabled={signingOut}
              style={[styles.signOutBtn, signingOut && styles.signOutBusy]}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              accessibilityState={{ busy: signingOut, disabled: signingOut }}
            >
              {signingOut ? (
                <ActivityIndicator color={colors.fadedgreen} />
              ) : (
                <Text style={styles.signOutText}>Sign out</Text>
              )}
            </Pressable>
          </View>

          {/* Footnote — sits in a quietly tinted container so it
              reads as supporting context rather than primary copy. */}
          <View style={styles.footnoteWrap}>
            <Text style={styles.footnote}>
              Sign out clears this app's stored identity. Your Apple
              Sign In access stays available — manage it in iOS
              Settings if you want to revoke entirely.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// --- Styles --------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.wiltedgreen,
  },
  safe: {
    flex: 1,
  },

  // --- Header ---
  header: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Scroll body ---
  scrollContent: {
    paddingHorizontal: 32, // matches /trusted-contact-setup, /permissions
    paddingBottom: 32,
    gap: 32,
  },
  pageTitle: {
    ...typography.title1Emphasized,
    color: colors.white,
  },

  // --- Hero ---
  // Car icon + name + email, centered. Visually carries the page —
  // identity is the first thing the user sees here.
  hero: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  heroIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: colors.fadedgreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroName: {
    ...typography.title2Regular,
    color: colors.white,
    textAlign: 'center',
  },
  heroEmail: {
    ...typography.subheadlineRegular,
    color: colors.fadedgreen,
    textAlign: 'center',
  },

  // --- Sections ---
  section: {
    gap: 8,
  },
  sectionLabel: {
    ...typography.subheadlineEmphasized,
    color: colors.fadedgreen,
    paddingHorizontal: 4,
  },

  // --- Trusted contact card ---
  // Burntgreen fill matches /trusted-contact-setup's preview state so
  // the card register stays consistent across the contact surfaces.
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.burntgreen,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarInitials: {
    ...typography.bodyEmphasized,
    color: colors.white,
  },
  contactTextStack: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    ...typography.bodyEmphasized,
    color: colors.white,
  },
  contactSecondary: {
    ...typography.subheadlineRegular,
    color: colors.fadedgreen,
  },

  // --- Sign out (outline pill, quieter destructive register) ---
  signOutBtn: {
    height: 48,
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: colors.fadedgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutBusy: {
    opacity: 0.7,
  },
  signOutText: {
    ...typography.subheadlineEmphasized,
    color: colors.fadedgreen,
  },

  // --- Footnote ---
  // fillsTertiary background = subtle iOS-style tint over wiltedgreen.
  // No border, just the gentle tonal shift, per design call.
  footnoteWrap: {
    backgroundColor: colors.fillsTertiary,
    borderRadius: 12,
    padding: 12,
  },
  footnote: {
    ...typography.footnoteRegular,
    color: colors.fadedgreen,
    textAlign: 'center',
  },
});
