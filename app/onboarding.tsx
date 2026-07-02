import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Onboarding1Hill from '../assets/illustrations/onboarding-1-hill.svg';
import Onboarding1Visual from '../assets/illustrations/onboarding-1-visual.svg';
import Onboarding2Hill from '../assets/illustrations/onboarding-2-hill.svg';
import Onboarding2Visual from '../assets/illustrations/onboarding-2-visual.svg';
import Onboarding3 from '../assets/illustrations/onboarding-3.svg';
import { Button } from '../components/Button';
import { PageControl } from '../components/PageControl';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { typography } from '../theme/typography';

/**
 * Onboarding — three swipeable panels followed by Permissions (page 4
 * of 5) and Trusted Contact Setup (page 5 of 5).
 *
 * Replaces the previous /onboarding-1, /onboarding-2, /onboarding-3 stack
 * routes with a single screen that uses a horizontal FlatList pager. This
 * is the native iOS onboarding pattern: swipe to advance, dots reflect
 * current page, Continue button also advances programmatically.
 *
 * Illustrations are SVG (not the previous 1x PNG screenshots) so they stay
 * crisp on every density and at every screen width. Each panel's
 * illustration is sized to its real Figma frame:
 *  - Panel 1 (Drive):  390×475, hill fills + steering-wheel visual layered on top.
 *  - Panel 2 (FuBu):   390×565, taller because the thought bubble sits
 *                       above the hill (visual + hill exported as siblings,
 *                       not nested in a single Figma frame).
 *  - Panel 3 (Unique): 390×475, exported as a single SVG.
 *
 * Route: /onboarding
 * Figma nodes: 825:3382 (panel 1), 825:3444 (panel 2), 825:3525 (panel 3)
 */

type Panel = {
  id: string;
  title: string;
  body: string;
  /**
   * The illustration's intrinsic aspect ratio. Sets the height of the
   * illustration container at runtime — width fills the screen, height
   * derives from this ratio so the SVG inside renders at its true
   * proportions on any device.
   */
  illustrationAspect: number;
  /** Renders the layered SVG content. Sized to fill its parent container. */
  renderIllustration: () => ReactNode;
  /**
   * Plain-language description of the illustration, surfaced to
   * VoiceOver. Falls back to "Onboarding illustration" when omitted.
   */
  illustrationLabel: string;
};

// Per-panel illustration components. Each renders its layered SVGs
// inside an absolute-fill container — the parent View sets the
// aspectRatio so percentages here resolve to the right pixel sizes.
//
// Panel 1: hill is the full illustration canvas (390×475). The
// steering-wheel visual is 390×422 and bottom-aligns over the hill,
// leaving the top ~53pt of the canvas as hill-only background.
function PanelOneIllustration() {
  return (
    <>
      <Onboarding1Hill width="100%" height="100%" style={StyleSheet.absoluteFill} />
      <View style={panel1VisualStyles.wrap}>
        <Onboarding1Visual width="100%" height="100%" />
      </View>
    </>
  );
}

// Panel 2: hill (390×237) bottom-aligns; visual (371×414) top-aligns
// with a small left inset (Figma puts the visual at x=10 inside the
// 390-wide panel). Container is 390×565 to span both elements.
function PanelTwoIllustration() {
  return (
    <>
      <View style={panel2HillStyles.wrap}>
        <Onboarding2Hill width="100%" height="100%" />
      </View>
      <View style={panel2VisualStyles.wrap}>
        <Onboarding2Visual width="100%" height="100%" />
      </View>
    </>
  );
}

// Panel 3: single SVG covers the full 390×475 illustration canvas.
function PanelThreeIllustration() {
  return <Onboarding3 width="100%" height="100%" style={StyleSheet.absoluteFill} />;
}

const PANELS: Panel[] = [
  {
    id: 'drive',
    title: 'Drive like you know these roads',
    // Copy shortened per Figma v2 redesign (1100:7553) — previous opener
    // ("No one should feel uncomfortable on the open road.") was retired
    // for a tighter "what the app does" framing.
    body: 'Fresh Greens places the agency back in your hands by suggesting routes that maximize visibility and familiarity.',
    illustrationAspect: 390 / 475,
    renderIllustration: () => <PanelOneIllustration />,
    illustrationLabel:
      'Illustration of hands gripping a steering wheel, viewed from the driver seat',
  },
  {
    id: 'community',
    title: 'For us, by us',
    // Per Figma 1100:7715 — tighter than v1, lands the core claim
    // (community contributions cover road hazards + treatment) in one
    // sentence rather than two.
    body: 'Community contributions ensure drivers have a full understanding of their surroundings, from road hazards to the treatment of Black visitors.',
    illustrationAspect: 390 / 565,
    renderIllustration: () => <PanelTwoIllustration />,
    illustrationLabel:
      'Illustration of a person sitting on a hill with a thought bubble reading "This street needs more lighting"',
  },
  {
    id: 'unique',
    title: 'Your viewpoint is unique',
    // Per Figma 1100:7867 — drops the "gut feeling" preamble; same
    // sentiment carried by the illustration's thought bubble.
    body: 'Fresh Greens integrates your intuition into the navigation, creating a driving experience specific to you.',
    illustrationAspect: 390 / 475,
    renderIllustration: () => <PanelThreeIllustration />,
    illustrationLabel:
      'Illustration of a person thinking, with a thought bubble showing a no-fly icon',
  },
];

// The onboarding journey spans 5 screens: these 3 swipe panels, then
// /permissions (4 of 5) and /trusted-contact-setup (5 of 5). The dots
// (PageControl) AND the VoiceOver page announcement both count against
// this whole-flow total — the dots are muted to VoiceOver, so the
// FlatList's spoken "page X of N" is the only count a screen-reader user
// hears, and it must match the dots a sighted user sees (and the
// downstream screens, which each render total={5}). Counting against
// PANELS.length (3) made the spoken flow jump "3 of 3" → "4 of 5".
const ONBOARDING_FLOW_STEPS = 5;

export default function Onboarding() {
  const router = useRouter();
  // useWindowDimensions: hook that returns current screen size and updates
  // automatically on rotation. Each pager item must be exactly screen-width
  // so pagingEnabled snaps correctly to one item per swipe.
  const { width } = useWindowDimensions();
  // Safe-area insets drive vertical placement directly instead of going
  // through SafeAreaView. The pager fills the entire screen so the
  // illustrations bleed all the way to the bottom edge (Continue overlays
  // the lower portion, matching Figma); only the title/body and the
  // foreground UI need safe-area offsets.
  const insets = useSafeAreaInsets();
  // useRef gives us an imperative handle to the FlatList so the Continue
  // button can call scrollToIndex on it programmatically.
  const pagerRef = useRef<FlatList<Panel>>(null);
  // Tracks the currently visible page (0, 1, or 2). Used by PageControl
  // to highlight the right dot, and by handleContinue to know whether
  // to advance or to leave the pager.
  const [pagerIndex, setPagerIndex] = useState(0);

  // One-shot latch so a frantic past-the-end bounce-drag (or a double
  // tap on Continue/Skip) can't stack two /permissions screens. Re-armed
  // on focus so backing out of /permissions to here leaves every exit
  // usable again — a permanent latch would dead-lock the pager.
  const leftPagerRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      leftPagerRef.current = false;
    }, []),
  );
  const goToPermissions = useCallback(() => {
    if (leftPagerRef.current) return;
    leftPagerRef.current = true;
    router.push('/permissions');
  }, [router]);

  // onMomentumScrollEnd fires when a swipe finishes (not during the swipe
  // itself). contentOffset.x is the scroll position; dividing by item
  // width gives the page index.
  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    setPagerIndex(newIndex);
  }

  // onScrollEndDrag fires when the user lifts their finger after dragging.
  // If they tried to drag PAST the last panel (iOS bounces during this),
  // we treat that as "they want to leave the pager" and navigate to
  // /permissions. Threshold tuned by feel — too small and tiny accidental
  // bounces would navigate; too large and a deliberate swipe doesn't trigger.
  function handleDragEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const offset = e.nativeEvent.contentOffset.x;
    const lastPanelOffset = (PANELS.length - 1) * width;
    if (offset > lastPanelOffset + 30) {
      goToPermissions();
    }
  }

  function handleContinue() {
    // Light tick on each Continue tap — selectionAsync is the
    // subtlest haptic, the iOS picker-wheel "click" — so it doesn't
    // dominate the swipe gesture but reads as "next" each time.
    Haptics.selectionAsync().catch(() => {});
    if (pagerIndex < PANELS.length - 1) {
      pagerRef.current?.scrollToIndex({
        index: pagerIndex + 1,
        animated: true,
      });
    } else {
      goToPermissions();
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/*
        Background pager. Sits at root level (not inside SafeAreaView)
        so each panel is screen-tall — the illustration's bottom: 0
        anchors to the absolute bottom of the device, not to the top
        of the action buttons. Continue/Skip overlay the lower portion
        of the illustration, matching Figma's full-bleed layout.
      */}
      <FlatList
        ref={pagerRef}
        data={PANELS}
        keyExtractor={(item) => item.id}
        accessibilityRole="adjustable"
        accessibilityLabel={`Onboarding, page ${pagerIndex + 1} of ${ONBOARDING_FLOW_STEPS}`}
        accessibilityActions={[
          { name: 'increment' },
          { name: 'decrement' },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment' && pagerIndex < PANELS.length - 1) {
            pagerRef.current?.scrollToIndex({ index: pagerIndex + 1, animated: true });
          } else if (event.nativeEvent.actionName === 'decrement' && pagerIndex > 0) {
            pagerRef.current?.scrollToIndex({ index: pagerIndex - 1, animated: true });
          }
        }}
        renderItem={({ item }) => (
          <View style={[styles.panel, { width }]}>
            <View
              style={[
                styles.titleAndCopy,
                // Clear status bar + PageControl (44pt) + 32pt design gap.
                // Matches Figma's title block at y=123 (screen top + 76pt
                // below the safe-area inset).
                { marginTop: insets.top + 76 },
              ]}
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
            <View
              style={[
                styles.illustration,
                { width, aspectRatio: item.illustrationAspect },
              ]}
              accessible
              accessibilityLabel={item.illustrationLabel}
              // Smart Invert preserves images by default but mishandles
              // SVGs rendered via react-native-svg. Pin so the
              // illustrated palette stays intact when invert is on.
              accessibilityIgnoresInvertColors
            >
              {item.renderIllustration()}
            </View>
          </View>
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleDragEnd}
        style={StyleSheet.absoluteFillObject}
      />

      {/*
        Foreground UI overlay. PageControl pinned to the top safe area,
        Actions pinned to the bottom safe area, flex:1 spacer between.
        pointerEvents="box-none" passes pager swipes through to the
        FlatList everywhere except the action buttons (which set
        pointerEvents="auto" on their wrapper).
      */}
      <View
        style={[
          styles.foreground,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 34 },
        ]}
        pointerEvents="box-none"
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <PageControl total={ONBOARDING_FLOW_STEPS} activeIndex={pagerIndex} />
        </View>
        <View style={styles.spacer} pointerEvents="none" />
        <View style={styles.actions} pointerEvents="auto">
          <Button
            type="primary"
            fill="fill"
            text="Continue"
            onPress={handleContinue}
            accessibilityLabel={
              pagerIndex < PANELS.length - 1
                ? 'Continue to next onboarding step'
                : 'Continue to permissions'
            }
            style={styles.btnStretch}
          />
          {/* Demoted to a transparent text-link (white underlined "Skip")
              so it reads as the low-emphasis alternative beneath the
              filled Continue, not a competing peer button. Transparent is
              the Button variant designed for this colored onboarding
              surface — a secondary OUTLINE here would be wiltedgreen-on-
              wiltedgreen and vanish. */}
          <Button
            type="primary"
            fill="transparent"
            text="Skip"
            onPress={goToPermissions}
            accessibilityLabel="Skip onboarding"
            style={styles.btnStretch}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.wiltedgreen,
  },
  foreground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  spacer: {
    flex: 1,
  },
  panel: {
    // flex:1 lets `bottom: 0` on the absolute illustration anchor to
    // the FlatList's full height. Now that the FlatList fills the
    // entire screen, that anchor sits at the absolute bottom edge —
    // illustrations bleed full-bleed, Continue overlays them.
    flex: 1,
  },
  illustration: {
    position: 'absolute',
    left: 0,
    bottom: 0,
  },
  titleAndCopy: {
    width: '100%',
    gap: 32,
    // Page gutter lives here now (was on `panel`). Pulling the
    // padding inward keeps the title/body in their original column
    // while letting the bottom illustration sit edge-to-edge.
    paddingHorizontal: 32,
  },
  title: {
    ...dynamicType(typography.brandDisplayLarge),
    color: colors.white,
  },
  body: {
    // Body/Regular per iOS HIG convention for onboarding supporting
    // copy (Apple's own onboarding, Mail, Health all use Regular).
    // Figma v2 specs Body/Emphasized but at 17pt on the colored bg
    // with this much copy, Semibold reads dense and urgent when the
    // text is informational — Regular lets the 34pt title carry the
    // emphasis. 80% opacity subordinates body to the full-white title
    // so the hierarchy reads title-commands / body-supports.
    ...dynamicType(typography.bodyRegular),
    color: colors.white,
    opacity: 0.8,
  },
  actions: {
    width: '100%',
    paddingHorizontal: 32,
    gap: 16,
  },
  btnStretch: {
    alignSelf: 'stretch',
  },
});

// Per-panel layered-illustration positioning. Percentages resolve
// against the parent illustration container, which is sized via
// aspectRatio so these stay accurate at any device width.
const panel1VisualStyles = StyleSheet.create({
  // Visual is 390×422 inside a 390×475 canvas. Bottom-aligned so the
  // hill backdrops the steering wheel; top 53/475 ≈ 11.16% is hill only.
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: `${(422 / 475) * 100}%`,
  },
});

const panel2HillStyles = StyleSheet.create({
  // Hill (390×237) sits at the bottom of the 390×565 canvas — 237/565 ≈ 41.95%.
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: `${(237 / 565) * 100}%`,
  },
});

const panel2VisualStyles = StyleSheet.create({
  // Visual (371×414) at top of canvas, 10/390 ≈ 2.56% left inset.
  // Width 371/390 ≈ 95.13%, height 414/565 ≈ 73.27%.
  wrap: {
    position: 'absolute',
    top: 0,
    left: `${(10 / 390) * 100}%`,
    width: `${(371 / 390) * 100}%`,
    height: `${(414 / 565) * 100}%`,
  },
});
