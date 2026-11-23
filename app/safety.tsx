import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentType } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SvgProps } from 'react-native-svg';

// Phosphor deep-import — see trusted-contact-setup.tsx for the note on
// bypassing the barrel index.
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';

import SidebtnSos from '../assets/illustrations/sidebtn-sos.svg';
import SafetyCarTroubles from '../assets/illustrations/safety-car-troubles.svg';
import SafetyLost from '../assets/illustrations/safety-lost.svg';
import SafetyPulledOver from '../assets/illustrations/safety-pulled-over.svg';
import SafetyShareLocation from '../assets/illustrations/safety-share-location.svg';
import SidebtnSafety from '../assets/illustrations/sidebtn-safety.svg';

import { DragHandle } from '../components/DragHandle';
import { useShareSession } from '../hooks/useShareSession';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Safety Modal — entry point to the safety/pulled-over flow.
 *
 * Presented as a modal (slides up from bottom over /home or /en-route).
 * Modal presentation is configured in app/_layout.tsx via Stack.Screen
 * options. The drag handle is decorative — modal dismissal happens via
 * the system swipe-down gesture.
 *
 * Each tile is a category entry point. Tapping one pushes the user
 * into a sub-flow:
 *   Pulled-over → /pulled-over (consolidated state-machine modal:
 *     armed → transition → guidance → contact → review)
 *   Roadside assistance → /roadside
 *   Unfamiliar area → /unfamiliar (gated on trusted contact)
 *   Share location → /share-location (gated on trusted contact)
 *
 * Route: /safety
 * Figma node (v2): 1133:13908
 *
 * v2 deltas from v1:
 *  - Tile labels shortened to single-noun glyphs ("Pulled-over" vs "I
 *    was pulled over"). Reads as a toolkit at a glance.
 *  - Iconography matches v2 spec: bundled SVGs (blue siren, pipe
 *    wrench, red-diamond compass, share-network + green pin). The
 *    SVGs were already in assets/illustrations/ — same filenames as
 *    v1 but the contents were updated to v2 designs.
 *  - TrustedContactStatus footer removed — v2 doesn't show it on this
 *    screen (it lives on /pulled-over's guidance phase instead, where
 *    it's more contextually relevant).
 *  - Modal padding/gap adjusted to v2 spec (px-24 py-32 gap-24).
 */

type SafetyTab = {
  id: string;
  label: string;
  hint: string;
  Icon: ComponentType<SvgProps>;
  /** Sub-flow route. All four tiles are wired as of the
   *  Unfamiliar + Share-Location PR; the no-contact and cross-tile
   *  guards live in handleTabPress, not in tile data. */
  href: string;
};

const SHARE_FLOW_LABEL = {
  unfamiliar: 'Unfamiliar area',
  'share-location': 'Share location',
} as const;

const TABS: SafetyTab[] = [
  {
    id: 'pulled-over',
    label: 'Pulled-over',
    hint: 'Opens pulled-over recording and guidance',
    Icon: SafetyPulledOver,
    // Routes to /pulled-over, a single consolidated modal that runs the
    // entire flow as an internal state machine: armed-or-not → recording
    // → contact → review-guidance. One swipe-down dismisses everything,
    // instead of the four-deep modal stack we used to push.
    href: '/pulled-over',
  },
  {
    id: 'roadside',
    label: 'Roadside assistance',
    hint: 'Opens roadside assistance for car troubles',
    Icon: SafetyCarTroubles,
    href: '/roadside',
  },
  {
    id: 'unfamiliar',
    label: 'Unfamiliar area',
    hint: 'Opens routing to a nearby safe destination',
    Icon: SafetyLost,
    href: '/unfamiliar',
  },
  {
    id: 'share-location',
    label: 'Share location',
    hint: 'Opens live location sharing with your trusted contact',
    Icon: SafetyShareLocation,
    href: '/share-location',
  },
];

export default function SafetyModal() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const columns = fontScale > 1.4 ? 1 : 2;
  const contactState = useTrustedContact();
  const contact = contactState.ready ? contactState.contact : null;
  const shareState = useShareSession();
  const session = shareState.ready ? shareState.session : null;

  function handleTabPress(tab: SafetyTab) {
    const isShareFlow = tab.id === 'unfamiliar' || tab.id === 'share-location';

    // No-contact gate — ONLY for /share-location, whose entire purpose
    // is sharing your location with a trusted contact. /unfamiliar can
    // route you to a nearby safe destination even without one (the
    // routing is the load-bearing feature; the contact-share is the
    // optional second layer), so it handles missing-contact internally
    // by hiding the lifeline pulse instead. User-flagged 2026-06-01.
    // Pulled-over and Roadside have always handled missing contact
    // internally.
    if (tab.id === 'share-location' && !contact) {
      Alert.alert(
        'Set a trusted contact',
        'Share Location shares your location with your trusted contact. Set one up first.',
        [
          { text: 'Cancel', style: 'cancel' },
          // The setup screen returns via router.back() to this safety
          // modal on Continue/Skip — that's the default since the
          // 2026-06-01 routing inversion.
          {
            text: 'Set up',
            onPress: () => router.push('/trusted-contact-setup'),
          },
        ],
      );
      return;
    }

    // Cross-tile guard: prevent starting one share-flow while the other
    // is active. Re-tapping the SAME tile is fine — its route handles
    // active-state on its own (renders the ActiveView).
    if (session && isShareFlow) {
      const sameTile = tab.id === session.type;

      if (!sameTile) {
        const otherLabel = SHARE_FLOW_LABEL[session.type];
        const desiredLabel =
          SHARE_FLOW_LABEL[tab.id as keyof typeof SHARE_FLOW_LABEL];
        Alert.alert(
          `You're in a ${otherLabel} session.`,
          `End it first to enter ${desiredLabel}.`,
          [{ text: 'OK' }],
        );
        return;
      }
    }

    router.push(tab.href as never);
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.dragHandleWrapper}>
          <DragHandle />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SidebtnSafety width={32} height={32} accessible={false} />
            <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={2}>
              What&rsquo;s going on?
            </Text>
          </View>

          <View style={styles.body}>
            {session && (
              <View
                style={styles.sessionBanner}
                accessibilityRole="text"
                accessibilityLabel={`${SHARE_FLOW_LABEL[session.type]} session active. Tap the tile again to manage your session.`}
              >
                <Text style={styles.sessionBannerTitle}>
                  {SHARE_FLOW_LABEL[session.type]} session active
                </Text>
                <Text style={styles.sessionBannerBody}>
                  Tap {SHARE_FLOW_LABEL[session.type]} again to manage your session.
                </Text>
              </View>
            )}
            <View style={styles.grid}>
              {Array.from({ length: Math.ceil(TABS.length / columns) }, (_, row) => (
                <View style={styles.gridRow} key={row}>
                  {TABS.slice(row * columns, (row + 1) * columns).map((tab) => (
                    <Pressable
                      key={tab.id}
                      style={({ pressed }) => [styles.tab, pressed && pressedDim]}
                      onPress={() => handleTabPress(tab)}
                      accessibilityRole="button"
                      accessibilityLabel={tab.label}
                      accessibilityHint={tab.hint}
                    >
                      <View style={styles.tabIcon}>
                        <tab.Icon width={48} height={48} />
                      </View>
                      <Text style={styles.tabLabel}>
                        {tab.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>

            {/*
              Emergency / SOS (thesis claim C8) — separate lane below the
              situational toolkit. Grouped-surface row (same register as the
              tiles) keeps the modal in the green/gray family; the red burst
              icon is sidebtn-sos.svg — same glyph as /en-route's SOS FAB.
              Red 911 escalation stays inside /emergency.
            */}
            <View style={styles.emergencySection}>
              <Text style={styles.emergencySectionLabel}>Need help now?</Text>
              <Pressable
                onPress={() => router.push('/emergency')}
                accessibilityRole="button"
                accessibilityLabel="Emergency. Reach a trusted contact or 911."
                accessibilityHint="Opens emergency options to call your trusted contact or 911."
                style={({ pressed }) => [styles.sosBar, pressed && pressedDim]}
              >
                <View style={styles.sosBarIcon}>
                  <SidebtnSos width={32} height={32} accessible={false} />
                </View>
                <View style={styles.sosBarText}>
                  <Text style={styles.sosBarTitle}>Emergency</Text>
                  <Text style={styles.sosBarSubtitle}>
                    Reach a trusted contact or 911
                  </Text>
                </View>
                <CaretRight
                  size={20}
                  color={colors.labelTertiary}
                  weight="regular"
                />
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    // The rounded top corners read because the modal slides up from
    // bottom — the OS shows the previous screen behind/above this one
    // briefly during the transition.
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  safe: {
    flex: 1,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  dragHandleWrapper: {
    // pt-16 from Figma's Drag block; centers the 4pt bar horizontally.
    paddingTop: spacing.md, // 16
    alignItems: 'center',
  },
  header: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  title: {
    // Native Text scales both glyphs and line height with Dynamic Type.
    ...typography.title1Regular,
    color: colors.black,
    alignSelf: 'stretch',
  },
  body: {
    flexGrow: 1,
    gap: spacing.lg,
  },
  sessionBanner: {
    alignSelf: 'stretch',
    backgroundColor: colors.fillsTertiary,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  sessionBannerTitle: {
    ...typography.footnoteEmphasized,
    color: colors.black,
  },
  sessionBannerBody: {
    ...typography.footnoteRegular,
    color: colors.labelSecondary,
  },
  grid: {
    // Matches /report picker: 24pt between rows (popup gap-24).
    gap: spacing.lg,
  },
  emergencySection: {
    // Hairline + label separate "escape hatch" from the 2×2 toolkit.
    // marginTop: 'auto' uses body flex space to pin this lane to the
    // modal foot on tall devices instead of crowding the grid.
    alignSelf: 'stretch',
    marginTop: 'auto',
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separatorSubtle,
    gap: spacing.sm,
  },
  emergencySectionLabel: {
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  tab: {
    // flex:1 fills the row between the 24pt side gutters — same as
    // report.tsx `styles.tile` (max width per column, not fixed 140pt).
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
    alignItems: 'center',
  },
  tabIcon: {
    width: '100%',
    minHeight: 96,
    borderRadius: radii.sm,
    backgroundColor: colors.surfacePage,
    alignItems: 'center',
    justifyContent: 'center',
    // Theme tier for the per-tile lift. e1 matches the v2 Figma
    // M3/Elevation Light/1 spec (offset 0,1 + radius 3).
    ...shadows.e1,
  },
  tabLabel: {
    // bodyEmphasized (17pt) per the 2026-06-01 text-size audit. The
    // three sub-flow tile labels (Pulled-over, Roadside, Unfamiliar
    // area) are the affordance description for their tap target;
    // 15pt left them reading as captions under their illustrations
    // instead of as the primary nav element they actually are.
    ...typography.bodyEmphasized,
    color: colors.black,
    textAlign: 'center',
  },
  // C8 — Emergency/SOS entry row. Same grouped surface + e1 lift as the
  // toolkit tiles; sidebtn-sos.svg matches /en-route's SOS FAB glyph.
  sosBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.surfacePage,
    ...shadows.e1,
  },
  sosBarIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosBarText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  sosBarTitle: {
    ...typography.bodyEmphasized,
    color: colors.black,
  },
  sosBarSubtitle: {
    // subheadlineRegular (15pt) per the 2026-06-01 text-size audit.
    ...typography.subheadlineRegular,
    color: colors.labelTertiary,
  },
});
