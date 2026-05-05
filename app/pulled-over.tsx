import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Pulled Over — page 1 of the pulled-over flow: Officer vs Trooper.
 *
 * Informational screen. Shows the user how to distinguish an officer
 * (standard police, brimmed cap, county/city marked car) from a trooper
 * (Smokey Bear hat, "State Trooper"/"Highway Patrol" on door).
 *
 * Route: /pulled-over
 * Figma node: 825:3957
 *
 * Layout structure mirrors Figma's nested flex hierarchy:
 *   Page (flex-1, gap-40, items-center)
 *     Drag wrapper (pt-16)
 *     Title block (gap-8, items-start, w-full)
 *     Cards row (gap-24, items-start, justify-center, w-full)
 *       Officer card → divider → Trooper card
 *     Close area (flex-1, justify-end, w-full)
 *       Forward arrow (alignSelf: center)
 *       Close text (alignSelf: flex-end)
 */
export default function PulledOver() {
  const router = useRouter();

  function handleNext() {
    router.push('/armed-or-not');
  }

  function handleClose() {
    router.back();
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.page}>
          <View style={styles.dragWrapper}>
            <View style={styles.dragHandle} />
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>Stay informed</Text>
            <Text style={styles.title}>Know the difference:</Text>
          </View>

          <View style={styles.cardsRow}>
            {/*
              TODO: real Officer/Trooper character illustrations exported
              from Figma. The illustrationBox dimensions match the design
              (148×244); the icon placeholder sits inside until real
              illustrations land in a polish PR.
            */}
            <View style={styles.card}>
              <View style={styles.illustrationBox}>
                <Ionicons name="shield" size={64} color="#1B3F8B" />
                <Text style={styles.cardLabel}>Officer</Text>
              </View>
              <View style={styles.bullets}>
                <Text style={styles.bullet}>
                  •{'  '}Wears a{' '}
                  <Text style={styles.emphasis}>
                    standard police uniform
                  </Text>{' '}
                  with a <Text style={styles.emphasis}>brimmed cap</Text>
                </Text>
                <Text style={styles.bullet}>
                  •{'  '}Drives a{' '}
                  <Text style={styles.emphasis}>
                    county or city marked car
                  </Text>{' '}
                  with the municipality name
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.card}>
              <View style={styles.illustrationBox}>
                <Ionicons name="shield-half" size={64} color="#5C5C5C" />
                <Text style={styles.cardLabel}>Trooper</Text>
              </View>
              <View style={styles.bullets}>
                <Text style={styles.bullet}>
                  •{'  '}Wears a{' '}
                  <Text style={styles.emphasis}>Smokey Bear hat</Text>
                </Text>
                <Text style={styles.bullet}>
                  •{'  '}Vehicle has{' '}
                  <Text style={styles.emphasis}>"State Trooper"</Text> or{' '}
                  <Text style={styles.emphasis}>"Highway Patrol"</Text> on the
                  door
                </Text>
              </View>
            </View>
          </View>

          {/*
            Close area: flex-1 + justify-end pushes the forward arrow + Close
            link to the bottom of available space (matches Figma's design
            where the close link sits at the bottom-right of the panel,
            with the next arrow centered just above it).
          */}
          <View style={styles.closeArea}>
            <Pressable
              onPress={handleNext}
              accessibilityRole="button"
              accessibilityLabel="Continue to next page"
              hitSlop={12}
              style={styles.nextButton}
            >
              <Ionicons name="chevron-forward" size={24} color="#3D3D3D" />
            </Pressable>

            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 16,
  },
  page: {
    // Page 1 wrapper from Figma: flex-1 + gap-40 + items-center.
    flex: 1,
    gap: 40,
    alignItems: 'center',
  },
  dragWrapper: {
    paddingTop: 16,
    alignItems: 'center',
    width: '100%',
  },
  dragHandle: {
    width: 32,
    height: 4,
    borderRadius: 100,
    backgroundColor: 'rgba(128, 128, 128, 0.55)',
  },
  titleBlock: {
    gap: 8,
    alignItems: 'flex-start',
    width: '100%',
  },
  eyebrow: {
    // Title1/Regular per Figma — 28/34/400/0.38 in #3D3D3D.
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '400',
    letterSpacing: 0.38,
    color: '#3D3D3D',
  },
  title: {
    // Title1/Emphasized — 28/34/700/0.38 in black.
    ...typography.title1Emphasized,
    color: colors.black,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: '100%',
  },
  card: {
    flex: 1,
    gap: 32,
    alignItems: 'center',
  },
  illustrationBox: {
    // Transparent card per Figma — w-148 h-244 p-16 rounded-12. Real
    // character illustrations land here in a polish PR; the icon+label
    // placeholder establishes layout structure.
    width: 148,
    height: 244,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    padding: 16,
  },
  cardLabel: {
    // Title3/Regular per Figma — 20/25/400/-0.45 in black.
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '400',
    letterSpacing: -0.45,
    color: colors.black,
  },
  bullets: {
    gap: 16,
    width: '100%',
    alignItems: 'flex-start',
  },
  bullet: {
    // Callout/Regular per Figma — 16/21/400/-0.31 in black.
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.31,
    color: colors.black,
  },
  emphasis: {
    fontWeight: '600',
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#CAC4D0',
    marginVertical: 16,
  },
  closeArea: {
    // flex-1 + justify-end pushes the next-arrow + Close to the bottom
    // of remaining space (matches Figma's Close-at-bottom-right layout).
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    gap: 16,
  },
  nextButton: {
    // Forward arrow centers itself horizontally regardless of parent
    // alignment, matching Figma's absolute-centered next arrow.
    alignSelf: 'center',
    paddingVertical: 8,
  },
  closeButton: {
    // Close text right-aligned per Figma (items-end on the close-area).
    alignSelf: 'flex-end',
  },
  closeText: {
    ...typography.footnoteRegular,
    color: 'rgba(80, 80, 80, 0.7)',
    textDecorationLine: 'underline',
  },
});
