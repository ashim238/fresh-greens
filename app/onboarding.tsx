import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageControl } from '../components/PageControl';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Onboarding — three swipeable panels followed by Permissions (page 4 of 4).
 *
 * Replaces the previous /onboarding-1, /onboarding-2, /onboarding-3 stack
 * routes with a single screen that uses a horizontal FlatList pager. This
 * is the native iOS onboarding pattern: swipe to advance, dots reflect
 * current page, Continue button also advances programmatically.
 *
 * Route: /onboarding
 * Figma nodes: 825:3382 (panel 1), 825:3444 (panel 2), 825:3525 (panel 3)
 */

type Panel = {
  id: string;
  title: string;
  body: string;
};

const PANELS: Panel[] = [
  {
    id: 'drive',
    title: 'Drive like you know these roads',
    body: 'No one should feel uncomfortable on the open road. Fresh Greens places the agency back in your hands by suggesting routes that maximize visibility and familiarity.',
  },
  {
    id: 'community',
    title: 'For us, by us',
    body: 'Fresh Greens relies on insights shared by travelers like you. Community contributions are vital in the mapping process, ensuring drivers have a full understanding of their surroundings, from road hazards to the treatment of Black visitors.',
  },
  {
    id: 'unique',
    title: 'Your viewpoint is unique',
    body:
      "That gut feeling that tells you to turn onto a road you've been down before is valuable. Fresh Greens integrates your intuition into the navigation, creating a driving experience specific to you.",
  },
];

export default function Onboarding() {
  const router = useRouter();
  // useWindowDimensions: hook that returns current screen size and updates
  // automatically on rotation. Each pager item must be exactly screen-width
  // so pagingEnabled snaps correctly to one item per swipe.
  const { width } = useWindowDimensions();
  // useRef gives us an imperative handle to the FlatList so the Continue
  // button can call scrollToIndex on it programmatically.
  const pagerRef = useRef<FlatList<Panel>>(null);
  // Tracks the currently visible page (0, 1, or 2). Used by PageControl
  // to highlight the right dot, and by handleContinue to know whether
  // to advance or to leave the pager.
  const [pagerIndex, setPagerIndex] = useState(0);

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
      router.push('/permissions');
    }
  }

  function handleContinue() {
    if (pagerIndex < PANELS.length - 1) {
      pagerRef.current?.scrollToIndex({
        index: pagerIndex + 1,
        animated: true,
      });
    } else {
      router.push('/permissions');
    }
  }

  function handleSkip() {
    router.push('/permissions');
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.safe}>
        <PageControl total={4} activeIndex={pagerIndex} />

        <FlatList
          ref={pagerRef}
          data={PANELS}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.panel, { width }]}>
              <View style={styles.titleAndCopy}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
              </View>
            </View>
          )}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleDragEnd}
          style={styles.pager}
        />

        <View style={styles.actions}>
          <Pressable
            style={styles.continueBtn}
            accessibilityRole="button"
            accessibilityLabel={
              pagerIndex < PANELS.length - 1
                ? 'Continue to next onboarding step'
                : 'Continue to permissions'
            }
            onPress={handleContinue}
          >
            <Text style={styles.continueText}>Continue</Text>
          </Pressable>

          <Pressable
            style={styles.skipBtn}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            onPress={handleSkip}
          >
            <Text style={styles.skipText}>Skip</Text>
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
    paddingBottom: 34,
  },
  pager: {
    flex: 1, // claim the leftover vertical space between PageControl and actions
  },
  panel: {
    // Each panel is exactly screen-width (set inline via useWindowDimensions
    // when rendered) so pagingEnabled snaps to one panel per swipe. Internal
    // padding matches the previous per-screen onboarding layout.
    paddingHorizontal: 32,
    paddingTop: 32,
  },
  titleAndCopy: {
    width: '100%',
    gap: 32,
  },
  title: {
    ...typography.largeTitleEmphasized,
    color: colors.white,
  },
  body: {
    ...typography.bodyRegular,
    color: colors.white,
  },
  actions: {
    width: '100%',
    paddingHorizontal: 32,
  },
  continueBtn: {
    backgroundColor: colors.freshgreen,
    height: 44,
    borderRadius: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    // Approximates Figma M3 Elevation Light/1 (the larger of two layers).
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  continueText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
  },
  skipBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
    textDecorationLine: 'underline',
  },
});
