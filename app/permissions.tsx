import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageControl } from '../components/PageControl';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Permissions — onboarding step 4 of 4. Asks the user to grant location access.
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
  async function handleSettingsPress() {
    const result = await Location.requestForegroundPermissionsAsync();

    if (result.status === 'granted') {
      router.push('/home');
      return;
    }

    // Denied — only iOS Settings can re-enable. After the user toggles
    // it on and swipes back, the next tap on this button hits the
    // granted branch above.
    Linking.openSettings();
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.safe}>
        {/* Step 4 of 4 — final step in the onboarding sequence */}
        <PageControl total={4} activeIndex={3} />

        {/*
          Content fills the remaining vertical space, centered. Children
          are left-aligned (items-start), with a 32pt gap between the
          visual+copy block and the Settings CTA.
        */}
        <View style={styles.content}>
          <View style={styles.visualAndCopy}>
            {/*
              Visual: location pin + car. Ionicons placeholders for v1 — the
              Figma versions are custom illustrations we'll swap in later.
            */}
            <View style={styles.visual}>
              <Ionicons name="location" size={36} color={colors.fadedgreen} />
              <Ionicons name="car" size={40} color={colors.fadedgreen} />
            </View>

            {/* Copy block — body + sub instructions, all left-aligned */}
            <View style={styles.copy}>
              <View style={styles.mainBody}>
                <Text style={styles.body}>
                  Fresh Greens needs your precise location to provide you with
                  turn-by-turn directions and comprehensive insights, including
                  traffic conditions, local street lighting, wildlife presence,
                  and other relevant info.
                </Text>
                <Text style={styles.tapInstruction}>Tap Settings below:</Text>
              </View>

              {/*
                Sub-instructions: each row has a white "thumbnail" mimicking
                the iOS Settings row icon, plus a label.
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
                  <Text style={styles.subText}>Select Location</Text>
                </View>
                <View style={styles.subRow}>
                  <View style={styles.thumb}>
                    <Ionicons
                      name="hand-left"
                      size={14}
                      color={colors.black}
                    />
                  </View>
                  <Text style={styles.subText}>
                    Tap Always or While using
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <Pressable
            style={styles.cta}
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
            onPress={handleSettingsPress}
          >
            <Text style={styles.ctaText}>Settings</Text>
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
    gap: 8,
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
    borderColor: 'rgba(0, 0, 0, 0.3)',
  },
  subText: {
    ...typography.footnoteRegular,
    color: colors.white,
  },
  cta: {
    alignSelf: 'flex-start', // left-align inside content (which now stretches its other children)
    backgroundColor: colors.freshgreen,
    width: 163,
    height: 40,
    borderRadius: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
  },
});
