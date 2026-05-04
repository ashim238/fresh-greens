import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Pulled Over — page 1 of the pulled-over flow: Officer vs Trooper.
 *
 * Informational screen. Shows the user how to distinguish an officer
 * (standard police, brimmed cap, county/city marked car) from a trooper
 * (Smokey Bear hat, "State Trooper"/"Highway Patrol" on door). The
 * distinction matters because it affects jurisdiction, procedure, and
 * what the driver should expect — substance taken directly from the
 * Figma design.
 *
 * Route: /pulled-over
 * Figma node: 825:3957
 */
export default function PulledOver() {
  const router = useRouter();

  function handleNext() {
    // TODO: navigate to /pulled-over/armed-or-not once that screen exists.
  }

  function handleClose() {
    router.back();
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {/* Drag handle in its own wrapper, matching Figma's pt-16 box. */}
        <View style={styles.dragWrapper}>
          <View style={styles.dragHandle} />
        </View>

        <ScrollView
          contentContainerStyle={styles.page}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>Stay informed</Text>
            <Text style={styles.title}>Know the difference:</Text>
          </View>

          <View style={styles.cardsRow}>
            {/*
              TODO: real Officer/Trooper illustrations exported from Figma.
              For v1 the illustration slot is a transparent rounded card
              with an Ionicon placeholder + label, matching Figma's
              structural layout (no tinted fill — the design's cards are
              transparent).
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
            Footer: forward arrow centered on its own row, "Close" link
            right-aligned beneath. Matches Figma's two-row footer layout.
          */}
          <View style={styles.footer}>
            <Pressable
              onPress={handleNext}
              accessibilityRole="button"
              accessibilityLabel="Continue to next page"
              hitSlop={12}
              style={styles.nextRow}
            >
              <Ionicons name="chevron-forward" size={24} color="#3D3D3D" />
            </Pressable>

            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
              style={styles.closeRow}
            >
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </ScrollView>
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
  dragWrapper: {
    paddingTop: 16,
    alignItems: 'center',
  },
  dragHandle: {
    width: 32,
    height: 4,
    borderRadius: 100,
    backgroundColor: 'rgba(128, 128, 128, 0.55)',
  },
  page: {
    gap: 40, // Figma's outer column gap between drag/title/cards/footer
    paddingTop: 40, // gap from drag handle to first content
  },
  titleBlock: {
    gap: 8,
  },
  eyebrow: {
    // Title1/Regular: same size/lineHeight/letterSpacing as Title1/Emphasized
    // but weight 400 instead of 700 (per Figma).
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '400',
    letterSpacing: 0.38,
    color: '#3D3D3D',
  },
  title: {
    ...typography.title1Emphasized,
    color: colors.black,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    gap: 32,
    alignItems: 'center',
  },
  illustrationBox: {
    // Transparent card per Figma — no background fill. Real character
    // illustrations land here in a follow-up PR.
    width: 148,
    height: 244,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    padding: 16,
  },
  cardLabel: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '400',
    letterSpacing: -0.45,
    color: colors.black,
  },
  bullets: {
    gap: 16,
    width: '100%',
  },
  bullet: {
    // Callout/Regular per Figma — not yet a token in theme/typography.ts.
    // Worth adding when there's a third use of this style.
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
  footer: {
    gap: 16,
  },
  nextRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeRow: {
    alignItems: 'flex-end',
  },
  closeText: {
    ...typography.footnoteRegular,
    color: 'rgba(80, 80, 80, 0.7)',
    textDecorationLine: 'underline',
  },
});
