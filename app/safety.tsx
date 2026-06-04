import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
import { useShareSession } from '../hooks/useShareSession';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
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
  Icon: ComponentType<SvgProps>;
  /** Sub-flow route. All four tiles are wired as of the
   *  Unfamiliar + Share-Location PR; the no-contact and cross-tile
   *  guards live in handleTabPress, not in tile data. */
  href: string;
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
    href: '/unfamiliar',
  },
  {
    id: 'share-location',
    label: 'Share location',
    Icon: SafetyShareLocation,
    href: '/share-location',
  },
];

export default function SafetyModal() {
  const router = useRouter();
  const { contact } = useTrustedContact();
  const { session } = useShareSession();

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
      const sameTile =
        (tab.id === 'unfamiliar' && session.type === 'unfamiliar') ||
        (tab.id === 'share-location' && session.type === 'share-location');

      if (!sameTile) {
        const otherLabel =
          session.type === 'unfamiliar' ? 'Unfamiliar area' : 'Share location';
        const desiredLabel =
          tab.id === 'unfamiliar' ? 'Unfamiliar area' : 'Share location';
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
            `sidebtn-safety.svg` (Figma 825:3754) — the SAME SVG the
            /en-route safety FAB renders, so the button and the modal it
            opens match. (The /menu Safety row uses the Phosphor `Shield`
            in black — the monochrome settings-row register, a deliberately
            different treatment, not this colored safety-affordance glyph.)
            Same iconography across the safety-affordance surfaces signals
            "safety affordance" consistently per `.cursorrules` reserved-
            color rule #6.
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
          {/* Two tiles per row, flex-stretched — same grid contract as
              /report's category picker (gridRow + flex:1 tiles). */}
          {[0, 2].map((rowStart) => (
            <View style={styles.gridRow} key={rowStart}>
              {TABS.slice(rowStart, rowStart + 2).map((tab) => (
                <Pressable
                  key={tab.id}
                  style={({ pressed }) => [styles.tab, pressed && pressedDim]}
                  onPress={() => handleTabPress(tab)}
                  accessibilityRole="button"
                  accessibilityLabel={tab.label}
                >
                  <View style={styles.tabIcon}>
                    <tab.Icon width={48} height={48} />
                  </View>
                  <Text style={styles.tabLabel} numberOfLines={2}>
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
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
    paddingHorizontal: spacing.lg, // 24
    paddingTop: spacing.md, // 16 — additional top space provided by dragHandleWrapper
    // SAF5: was 16 — asymmetric with the top edge (which nets 32pt via
    // dragHandleWrapper's own paddingTop: 16). The v2 spec is py-32;
    // bumping to 32 makes the bottom breathing room match the top so
    // the tile grid doesn't read as pushed against the bottom chrome
    // on 6.1" devices.
    paddingBottom: spacing.xl, // 32
    gap: spacing.lg, // 24 — v2 inter-section gap
  },
  dragHandleWrapper: {
    // pt-16 from Figma's Drag block; centers the 4pt bar horizontally.
    paddingTop: spacing.md, // 16
    alignItems: 'center',
  },
  header: {
    // EmptyState/Content from Figma: column stack, gap-16. Left-
    // aligned like /report's picker + detail titleBlock (icon → title
    // → subtitle) so the safety/report modals share one placement register.
    gap: 16,
    alignItems: 'flex-start',
    alignSelf: 'stretch',
  },
  iconBox: {
    // 56x56 dedicated space for the shield. Icon anchors top-leading
    // so the stack reads as one left edge with the title block below.
    width: 56,
    height: 56,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  titleBlock: {
    gap: 8,
    alignItems: 'flex-start',
    alignSelf: 'stretch',
  },
  title: {
    // SAF1: Title1 Regular (not Emphasized). /safety ASKS the user a
    // question ("What's going on?"), and per design-system.md the
    // in-modal-prompt register is regular weight — a held question, not
    // a directive (bold read as a command on a stress-state screen).
    //
    // Weight differs from /report's Title1 Emphasized picker title,
    // but placement matches: left-aligned icon + title + subtitle stack.
    ...typography.title1Regular,
    color: colors.black,
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  subtitle: {
    // Supporting line under the Title1 Regular prompt — left-aligned to
    // match /report's picker + detail subtitle placement.
    ...typography.bodyRegular,
    color: colors.labelTertiary,
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  grid: {
    // Matches /report picker: 24pt between rows (popup gap-24).
    gap: spacing.lg,
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
    gap: 8,
    alignItems: 'center',
  },
  tabIcon: {
    width: '100%',
    minHeight: 96,
    borderRadius: 8,
    backgroundColor: colors.systemGroupedBackground,
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
    ...dynamicType(typography.bodyEmphasized),
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
    // subheadlineRegular (15pt) per the 2026-06-01 text-size audit.
    // Sits beneath the SOS bar title on a high-stakes affordance —
    // 13pt left the supporting copy reading as fine print on a
    // crisis surface, which is exactly where it shouldn't.
    ...typography.subheadlineRegular,
    color: colors.fadedgreen,
  },
});
