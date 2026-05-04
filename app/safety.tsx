import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Safety Modal — entry point to the safety/pulled-over flow.
 *
 * Presented as a modal (slides up from bottom over /home or /en-route).
 * Modal presentation is configured in app/_layout.tsx via Stack.Screen
 * options. The drag handle is decorative — modal dismissal happens via
 * the system swipe-down gesture.
 *
 * Each tab is a category entry point. Tapping one will (in future PRs)
 * push the user into a sub-flow:
 *   I was pulled over → /pulled-over (Officer/Trooper → Armed-or-Not
 *     → What to Do/Have/Say/Know)
 *   I need roadside assistance → /roadside (TBD)
 *   I'm in an unfamiliar area → /unfamiliar (TBD)
 *   I want to share my location → /share-location (TBD)
 *
 * Route: /safety
 * Figma node: 825:3875
 */

type SafetyTab = {
  id: string;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  /** Future sub-flow route — null = unwired TODO for this PR */
  href: string | null;
};

const TABS: SafetyTab[] = [
  {
    id: 'pulled-over',
    label: 'I was pulled over',
    iconName: 'alert-circle',
    href: '/pulled-over',
  },
  {
    id: 'roadside',
    label: 'I need roadside assistance',
    iconName: 'construct',
    href: null, // TODO: /roadside sub-flow
  },
  {
    id: 'unfamiliar',
    label: "I'm in an unfamiliar area",
    iconName: 'compass',
    href: null, // TODO: /unfamiliar sub-flow
  },
  {
    id: 'share-location',
    label: 'I want to share my location',
    iconName: 'share-social',
    href: null, // TODO: /share-location sub-flow
  },
];

export default function SafetyModal() {
  const router = useRouter();

  function handleTabPress(tab: SafetyTab) {
    if (tab.href) {
      router.push(tab.href as never);
    }
    // Otherwise no-op for now. Once sub-flows exist, every tab will
    // have a real href and this branch goes away.
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.dragHandle} />

        <View style={styles.header}>
          {/*
            56x56 state-layer wrapper around the shield icon. Matches
            Figma's structure — the wrapper's internal padding provides
            the visual gap between icon and title block below.
          */}
          <View style={styles.iconBox}>
            <Ionicons
              name="shield-checkmark"
              size={32}
              color={colors.wiltedgreen}
              accessible={false}
            />
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Safety</Text>
            <Text style={styles.subtitle}>What's going on?</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.id}
              style={styles.tab}
              onPress={() => handleTabPress(tab)}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ disabled: tab.href === null }}
            >
              <View style={styles.tabIcon}>
                <Ionicons
                  name={tab.iconName}
                  size={48}
                  color={colors.black}
                  accessible={false}
                />
              </View>
              <Text style={styles.tabLabel}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.footer}>
          {/*
            TODO: real "trusted contact" notification backend. The pulse
            dot is currently static; once auth + a contact picker exist,
            this should reflect real notification state.
          */}
          <Text style={styles.footerText}>
            Your trusted contact is being notified
          </Text>
          <View style={styles.pulseDot} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
    // The rounded top corners read because the modal slides up from
    // bottom — the OS shows the previous screen behind/above this one
    // briefly during the transition.
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 48, // matches Figma's gap-48 between drag/header/grid/footer
  },
  dragHandle: {
    width: 32,
    height: 4,
    borderRadius: 100,
    backgroundColor: 'rgba(128, 128, 128, 0.55)',
    alignSelf: 'center',
    marginTop: 16,
  },
  header: {
    // No explicit gap — the iconBox's internal padding-16 provides the
    // visual separation between shield and title block below. Matches
    // Figma's structure.
  },
  iconBox: {
    // 56x56 dedicated space for the shield. No explicit padding — the
    // icon (32pt) is smaller than the box and centers via alignItems +
    // justifyContent, leaving ~12pt margin all around. Figma specifies
    // p-16 but its renderer is forgiving; in RN, p-16 + 56 box would
    // clip a 32 icon (inner area becomes 24x24).
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    gap: 8,
  },
  title: {
    ...typography.title1Emphasized,
    color: colors.black,
  },
  subtitle: {
    ...typography.bodyEmphasized,
    color: '#3D3D3D', // iOS Labels/Secondary base
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 32,
    justifyContent: 'center',
  },
  tab: {
    width: 160,
    gap: 8,
    alignItems: 'center',
  },
  tabIcon: {
    width: '100%',
    height: 96,
    borderRadius: 8,
    backgroundColor: '#F2F2F7', // iOS Backgrounds/Secondary
    alignItems: 'center',
    justifyContent: 'center',
    // Approximates Figma M3 Elevation Light/1.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  tabLabel: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  footerText: {
    ...typography.footnoteRegular,
    color: 'rgba(80, 80, 80, 0.7)',
    textAlign: 'center',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.freshgreen,
  },
});
