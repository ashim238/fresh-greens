import { Ionicons } from '@expo/vector-icons';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PermissionsCar from '../assets/illustrations/permissions-car.svg';
import PermissionsLocation from '../assets/illustrations/permissions-location.svg';
import { PageControl } from '../components/PageControl';
import { colors } from '../theme/colors';
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
    await Location.requestForegroundPermissionsAsync();
    await requestRecordingPermissionsAsync();
    router.push('/trusted-contact-setup');
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
            {/*
              Visual: location pin + car, sized + offset to match Figma.
              Location pin sits at 10.71pt from the left in a 35.9×40.4
              wrap (the wrap accounts for the 17.72° rotation overflow);
              car stacks below at 0 left offset, 8pt gap. Both authored
              as SVGs in the design system, imported via
              react-native-svg-transformer.
            */}
            <View style={styles.visual}>
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
                    <Ionicons
                      name="navigate"
                      size={14}
                      color={colors.freshgreen}
                    />
                  </View>
                  <Text style={styles.subText}>Location</Text>
                </View>
                <View style={styles.subRow}>
                  <View style={styles.thumb}>
                    <Ionicons name="mic" size={14} color={colors.black} />
                  </View>
                  <Text style={styles.subText}>Microphone</Text>
                </View>
              </View>
            </View>
          </View>

          <Pressable
            style={styles.cta}
            accessibilityRole="button"
            accessibilityLabel="Continue and grant permissions"
            onPress={handleContinuePress}
          >
            <Text style={styles.ctaText}>Continue</Text>
          </Pressable>
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
    paddingHorizontal: 32, // matches Figma — works directly on SafeAreaView now that we use react-native-safe-area-context
    paddingBottom: 34,
  },
  content: {
    flex: 1,
    width: '100%',
    // Default alignItems: 'stretch' — wrapper Views (visualAndCopy, copy,
    // mainBody) fill the cross-axis width so the Text inside can wrap
    // within the padded safe area. Explicitly setting flex-start collapses
    // wrappers to text intrinsic width and visually swallows the padding.
    justifyContent: 'center',
    gap: 32,
  },
  visualAndCopy: {
    gap: 32,
  },
  visual: {
    // 8.55pt gap between location wrap and car wrap derives from
    // Figma's mt-[48.55px] on the car minus the 40.374pt location
    // wrap height. Rounded to 8 for cleanliness.
    gap: 8,
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
    gap: 32, // gap between mainBody and subDirections
  },
  mainBody: {
    gap: 16, // gap between body and "Tap Settings below:"
  },
  body: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
  },
  tapInstruction: {
    ...typography.footnoteRegular,
    color: colors.white,
  },
  subDirections: {
    gap: 16,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  subText: {
    ...typography.footnoteRegular,
    color: colors.white,
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: colors.freshgreen,
    width: 163,
    height: 44,
    borderRadius: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    // Approximates Figma M3 Elevation Light/1 (the larger of two layers).
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  ctaText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
  },
});
