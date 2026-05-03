import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../theme/colors';

/**
 * Permissions — onboarding step 4 of 4. Asks the user to grant location access.
 * Route: /permissions
 * Figma node: 825:3585
 */
export default function Permissions() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.safe}>
        {/*
          Page control: 4 dots, last one active. Marks this as the final
          step in the onboarding sequence (Onboarding 1/2/3 + Permissions).
        */}
        <View style={styles.pageControl}>
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={[styles.dot, styles.dotInactive]} />
          <View style={styles.dot} />
        </View>

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

          {/*
            TODO: wire to Linking.openSettings() so the button actually opens
            iOS Settings. Visual-only for v1.
          */}
          <Pressable
            style={styles.cta}
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
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
    // Horizontal padding lives here, NOT on SafeAreaView — the built-in
    // SafeAreaView aggressively manages its own insets and can override
    // horizontal padding set on it directly.
    paddingHorizontal: 32,
  },
  safe: {
    flex: 1,
    paddingBottom: 34,
  },
  pageControl: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignSelf: 'center', // dots stay centered horizontally even though parent is left-aligned now
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  dotInactive: {
    opacity: 0.3,
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
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.23,
  },
  tapInstruction: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.08,
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
    color: colors.white,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.08,
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
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.23,
  },
});
