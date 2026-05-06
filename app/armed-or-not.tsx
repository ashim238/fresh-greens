import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DragHandle } from '../components/DragHandle';
import { TrustedContactStatus } from '../components/TrustedContactStatus';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Armed or Not — page 2 of the pulled-over flow.
 *
 * Asks the driver whether they're armed. The answer affects what
 * guidance the next screen (What to Do/Have/Say/Know) shows.
 *
 * "Prefer not to answer" is by design — the app shouldn't require
 * disclosure to function. Conservative guidance applies when chosen.
 *
 * Route: /armed-or-not
 * Figma node: 825:4034
 *
 * Layout structure mirrors Figma's nested flex hierarchy:
 *   Outer panel (gap-48, items-center)
 *     Page 1 (flex-1, gap-40)
 *       Drag wrapper (pt-16)
 *       Title block (gap-8)
 *       Answers wrapper (flex-1, gap-48, justify-center)
 *     TrustedContactStatus footer
 */

type Answer = {
  id: string;
  title: string;
  subtitle?: string;
};

const ANSWERS: Answer[] = [
  {
    id: 'yes',
    title: 'Yes',
    subtitle: 'I have a firearm, knife, or other weapon on me',
  },
  {
    id: 'no',
    title: 'No',
    subtitle: 'I do not have a firearm, knife, or other weapon on me',
  },
  {
    id: 'prefer-not-to-answer',
    title: 'Prefer not to answer',
  },
];

export default function ArmedOrNot() {
  function handleAnswer(answer: Answer) {
    // TODO: navigate to /what-to-do?armed=${answer.id} once that screen exists.
    console.log('[armed-or-not] selected:', answer.id);
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.page}>
          <View style={styles.dragWrapper}>
            <DragHandle />
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>Ok. Got it.</Text>
            <Text style={styles.title}>Are you armed?</Text>
          </View>

          <View style={styles.answersWrapper}>
            {ANSWERS.map((answer) => (
              <Pressable
                key={answer.id}
                style={styles.answerCard}
                onPress={() => handleAnswer(answer)}
                accessibilityRole="button"
                accessibilityLabel={
                  answer.subtitle
                    ? `${answer.title} — ${answer.subtitle}`
                    : answer.title
                }
              >
                <View style={styles.answerContent}>
                  <Text style={styles.answerTitle}>{answer.title}</Text>
                  {answer.subtitle && (
                    <Text style={styles.answerSubtitle}>
                      {answer.subtitle}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <TrustedContactStatus />
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
    // Outer panel's gap-48 between Page 1 (drag/title/cards) and footer.
    gap: 48,
  },
  page: {
    flex: 1, // claims remaining vertical space; answersWrapper centers within it
    gap: 40, // gap-40 between drag, title block, answersWrapper per Figma
  },
  dragWrapper: {
    paddingTop: 16,
    alignItems: 'center',
  },
  titleBlock: {
    gap: 8,
  },
  eyebrow: {
    ...typography.title1Regular,
    color: colors.labelTertiary,
  },
  title: {
    // Title1/Emphasized — 28/34/700/0.38 in black.
    ...typography.title1Emphasized,
    color: colors.black,
  },
  answersWrapper: {
    // flex-1 + justify-center: cards take remaining vertical space and
    // center within it (Figma: items-center justify-center min-h-px).
    // Without this, cards would sit gap-40 below the title; with it,
    // they float in the middle of the available room.
    flex: 1,
    gap: 48,
    justifyContent: 'center',
    // 4pt inset so card shadows have breathing room on the L/R edges.
    paddingHorizontal: 4,
  },
  answerCard: {
    height: 100, // Figma h-[100px] — exact, not min
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.white,
    justifyContent: 'center',
    // Approximates Figma M3 Elevation Light/1 (the larger of two layers).
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  answerContent: {
    // Figma constrains the inner content column to 238pt — long subtitles
    // wrap within that width rather than stretching the full card width.
    width: 238,
    gap: 8,
  },
  answerTitle: {
    // Headline/Regular per Figma — 17/22/590/-0.43. RN can't do 590, so
    // bodyEmphasized (600) renders identically to the eye.
    ...typography.bodyEmphasized,
    color: colors.black,
  },
  answerSubtitle: {
    // Subheadline/Regular — 15/20/400/-0.23 in #3D3D3D.
    ...typography.subheadlineRegular,
    color: colors.labelTertiary,
  },
});
