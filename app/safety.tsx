import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import type { ComponentType } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SvgProps } from 'react-native-svg';

// Phosphor deep-import — see trusted-contact-setup.tsx for the note on
// bypassing the barrel index.
import { ShieldWarning } from 'phosphor-react-native/src/icons/ShieldWarning';

import SafetyCarTroubles from '../assets/illustrations/safety-car-troubles.svg';
import SafetyLost from '../assets/illustrations/safety-lost.svg';
import SafetyPulledOver from '../assets/illustrations/safety-pulled-over.svg';
import SafetyShareLocation from '../assets/illustrations/safety-share-location.svg';
import SidebtnSafety from '../assets/illustrations/sidebtn-safety.svg';

import { DragHandle } from '../components/DragHandle';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { shadows } from '../theme/shadows';
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
 *   Roadside assistance → /roadside (TBD)
 *   Unfamiliar area → /unfamiliar (TBD)
 *   Share location → /share-location (TBD)
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
  Icon: ComponentType<SvgProps>;
  /** Future sub-flow route — null = unwired TODO for this PR */
  href: string | null;
};

const TABS: SafetyTab[] = [
  {
    id: 'pulled-over',
    label: 'Pulled-over',
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
    Icon: SafetyCarTroubles,
    href: '/roadside',
  },
  {
    id: 'unfamiliar',
    label: 'Unfamiliar area',
    Icon: SafetyLost,
    href: null, // TODO: /unfamiliar sub-flow
  },
  {
    id: 'share-location',
    label: 'Share location',
    Icon: SafetyShareLocation,
    href: null, // TODO: /share-location sub-flow
  },
];

export default function SafetyModal() {
  const router = useRouter();

  function handleTabPress(tab: SafetyTab) {
    if (tab.href) {
      router.push(tab.href as never);
      return;
    }
    // Tiles whose sub-flows haven't shipped yet — surface a brief
    // haptic + native Alert so the user gets feedback instead of
    // tapping into dead pixels.
    Haptics.selectionAsync().catch(() => {});
    Alert.alert(
      tab.label,
      'This flow is coming in a future update. For now, only Pulled-over is wired up.',
      [{ text: 'OK' }],
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.dragHandleWrapper}>
          <DragHandle />
        </View>

        <View style={styles.header}>
          {/*
            56x56 wrapper around the shield icon. Matches Figma's
            EmptyState/Content structure — icon → title → subtitle in a
            vertical stack with gap-16.

            Uses the canonical navy duotone shield from
            `sidebtn-safety.svg` — the same glyph that lives on
            /en-route's safety FAB and the /menu Safety row. Same
            iconography across surfaces signals "safety affordance"
            consistently per `.cursorrules` reserved-color rule #6.
          */}
          <View style={styles.iconBox}>
            <SidebtnSafety width={32} height={32} accessible={false} />
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Safety</Text>
            <Text style={styles.subtitle}>What’s going on?</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {TABS.map((tab) => {
            const isInert = tab.href === null;
            return (
              <Pressable
                key={tab.id}
                // Dim inert tiles visually so reviewers can see at a
                // glance which sub-flows are wired vs scaffolded.
                // accessibilityState already announces disabled to
                // VoiceOver; this gives sighted users the same cue.
                style={({ pressed }) => [
                  styles.tab,
                  isInert && styles.tabInert,
                  pressed && pressedDim,
                ]}
                onPress={() => handleTabPress(tab)}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
                // SAF4: pair the disabled state with a "Coming soon" hint
                // so VoiceOver explains *why* the tile is dimmed rather
                // than just announcing "button, dimmed." Matches the
                // inert-row pattern already used in /menu.
                accessibilityHint={isInert ? 'Coming soon' : undefined}
                accessibilityState={{ disabled: isInert }}
              >
                <View style={styles.tabIcon}>
                  <tab.Icon width={48} height={48} />
                </View>
                <Text style={styles.tabLabel}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/*
          Emergency / SOS (thesis claim C8) — the most consequential
          safety affordance, so it gets its own prominent control below
          the tile grid rather than a same-weight tile. navy (reserved
          safety-affordance register, .cursorrules #6) matches the
          /emergency surface; the red 911 escalation lives INSIDE the
          flow, not on this calm entry button.
        */}
        <Pressable
          onPress={() => router.push('/emergency')}
          accessibilityRole="button"
          accessibilityLabel="Emergency. Reach a trusted contact or 911."
          style={({ pressed }) => [styles.sosBar, pressed && pressedDim]}
        >
          <ShieldWarning size={28} color={colors.white} weight="duotone" />
          <View style={styles.sosBarText}>
            <Text style={styles.sosBarTitle}>Emergency</Text>
            <Text style={styles.sosBarSubtitle}>
              Reach a trusted contact or 911
            </Text>
          </View>
        </Pressable>
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
    // v2 spec: px-24 py-32. Switching from v1's 16pt gutter gives the
    // tiles + header more breathing room and matches the Figma node.
    paddingHorizontal: 24,
    paddingTop: 16, // additional top space provided by dragHandleWrapper
    // SAF5: was 16 — asymmetric with the top edge (which nets 32pt via
    // dragHandleWrapper's own paddingTop: 16). The v2 spec is py-32;
    // bumping to 32 makes the bottom breathing room match the top so
    // the tile grid doesn't read as pushed against the bottom chrome
    // on 6.1" devices.
    paddingBottom: 32,
    gap: 24, // v2 inter-section gap
  },
  dragHandleWrapper: {
    // pt-16 from Figma's Drag block; centers the 4pt bar horizontally.
    paddingTop: 16,
    alignItems: 'center',
  },
  header: {
    // EmptyState/Content from Figma: column stack, gap-16. iconBox is
    // 56pt fixed; title + subtitle stack below.
    gap: 16,
  },
  iconBox: {
    // 56x56 dedicated space for the shield. The icon (32pt) is smaller
    // than the box and centers via alignItems + justifyContent.
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    gap: 8,
  },
  title: {
    // SAF1: Title1 Regular (not Emphasized). /safety ASKS the user a
    // question ("What's going on?"), and per design-system.md the
    // in-modal-prompt register is regular weight — a held question, not
    // a directive (bold read as a command on a stress-state screen).
    //
    // This is DELIBERATELY a different register from /report, whose
    // "Report" + per-category titles are an action/instruction heading
    // → Title1 Emphasized (the .cursorrules guidance-screen rule). So
    // the two safety-column surfaces don't match by design: a question
    // is regular, an instruction heading is bold. (An earlier version
    // of this comment wrongly claimed /report was also regular.)
    ...typography.title1Regular,
    color: colors.black,
  },
  subtitle: {
    // The title above carries the Title1 Regular prompt register (the
    // .cursorrules "in-modal user prompts" rule). This supporting line
    // sits one step down at Body/Regular (17pt) in labelTertiary — v1
    // used bodyEmphasized, but a softer weight reads less imperative
    // beneath a held question.
    ...typography.bodyRegular,
    color: colors.labelTertiary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 32,
    justifyContent: 'center',
  },
  tab: {
    // v2 spec: 139.5pt fixed width. Two tiles per row + 32pt gap fits
    // an iPhone with the 24pt outer gutter (24 + 139.5 + 32 + 139.5 +
    // 24 = 359, under 390 baseline width — slight extra breathing room).
    width: 140,
    gap: 8,
    alignItems: 'center',
  },
  // Visible "this sub-flow isn't wired yet" state. Half-opacity
  // matches the standard iOS disabled-control register; the on-
  // press handler still fires (with an Alert) so the user gets
  // feedback rather than dead pixels.
  tabInert: {
    opacity: 0.5,
  },
  tabIcon: {
    width: '100%',
    height: 96,
    borderRadius: 8,
    backgroundColor: colors.systemGroupedBackground,
    alignItems: 'center',
    justifyContent: 'center',
    // Theme tier for the per-tile lift. e1 matches the v2 Figma
    // M3/Elevation Light/1 spec (offset 0,1 + radius 3).
    ...shadows.e1,
  },
  tabLabel: {
    ...typography.subheadlineEmphasized,
    color: colors.black,
    textAlign: 'center',
  },
  // C8 — Emergency/SOS entry control. Raw spacing values match this
  // file's existing convention (a spacing-token sweep can migrate the
  // whole file later); all land on the 4pt grid.
  sosBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.navy,
    marginTop: 8,
    ...shadows.e2,
  },
  sosBarText: {
    flex: 1,
    gap: 4,
  },
  sosBarTitle: {
    ...typography.bodyEmphasized,
    color: colors.white,
  },
  sosBarSubtitle: {
    ...typography.footnoteRegular,
    color: colors.fadedgreen,
  },
});
