import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DragHandle } from '../components/DragHandle';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Review Guidance — post-incident reflective flow.
 *
 * The user reaches this screen *after* the stressful situation has ended,
 * to review what to do next time. The five content sections live in one
 * modal route as an internal index state machine — same pattern as
 * /report (picker → detail → thank-you). One backdrop, one modal envelope,
 * five sub-views; chevron navigation moves between them.
 *
 * Why state-machine over five separate routes:
 *   1. Avoids modal-on-modal stacking quirks on iOS (this codebase has
 *      hit those before — see /safety presentation notes).
 *   2. State (current index, armed param) lives in one component;
 *      chevrons are simple inc/dec.
 *   3. Matches /report's established pattern in the codebase.
 *
 * Sub-view order matches Figma left-to-right canvas position:
 *   0. Officer/Trooper — Figma 825:3957 (back chevron hidden)
 *   1. What to Do      — Figma 825:4386
 *   2. What to Have    — Figma 825:4533
 *   3. What to Say     — Figma 825:4599 (firearm bullet conditional)
 *   4. What to Know    — Figma 825:4724 (forward chevron hidden)
 *
 * Route: /review-guidance
 *
 * Wiring (current temp state):
 *   /armed-or-not → /review-guidance?armed=yes|no|preferred-not-to-answer
 *
 * Wiring (eventual full chain):
 *   /armed-or-not → recording → /contact → (Review guidance link) → /review-guidance
 *
 * Close link uses router.dismissAll() to fully unwind the safety modal
 * stack and land back on /en-route, rather than popping one level at
 * a time through several modals.
 *
 * Copy is sourced from the Figma file, which was lifted from ACLU's
 * "Stopped by Police" guidance and tightened for at-a-glance UI use.
 */

type ArmedState = 'yes' | 'no' | 'preferred-not-to-answer' | undefined;

const TOTAL_VIEWS = 5;

export default function ReviewGuidance() {
  const router = useRouter();
  const params = useLocalSearchParams<{ armed?: ArmedState }>();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Conservative default: show firearm advice unless the user explicitly
  // said "no". 'preferred-not-to-answer' falls under the same conservative
  // bucket as 'yes' so the guidance assumes a firearm may be present.
  const showFirearmGuidance =
    params.armed === 'yes' || params.armed === 'preferred-not-to-answer';

  function handleNext() {
    if (currentIndex < TOTAL_VIEWS - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function handleBack() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  function handleClose() {
    // dismissAll unwinds every stacked modal in the safety flow at once,
    // landing the user back on /en-route. Plain router.back() would only
    // pop /review-guidance, leaving the user trapped on /armed-or-not /
    // /pulled-over / /safety, which they'd then have to dismiss one at
    // a time — a bad post-stress UX.
    router.dismissAll();
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.dragWrapper}>
          <DragHandle />
        </View>

        <View style={styles.content}>
          {currentIndex === 0 && <OfficerTrooperView />}
          {currentIndex === 1 && <WhatToDoView />}
          {currentIndex === 2 && <WhatToHaveView />}
          {currentIndex === 3 && <WhatToSayView showFirearm={showFirearmGuidance} />}
          {currentIndex === 4 && <WhatToKnowView />}
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close and return to navigation"
            hitSlop={12}
            style={styles.closeBtn}
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>

          <View style={styles.chevronsRow}>
            {currentIndex > 0 ? (
              <Pressable
                onPress={handleBack}
                accessibilityRole="button"
                accessibilityLabel="Previous"
                hitSlop={12}
                style={styles.chevronBtn}
              >
                <Ionicons name="chevron-back" size={24} color={colors.labelTertiary} />
              </Pressable>
            ) : (
              <View style={styles.chevronBtn} />
            )}
            {currentIndex < TOTAL_VIEWS - 1 ? (
              <Pressable
                onPress={handleNext}
                accessibilityRole="button"
                accessibilityLabel="Next"
                hitSlop={12}
                style={styles.chevronBtn}
              >
                <Ionicons name="chevron-forward" size={24} color={colors.labelTertiary} />
              </Pressable>
            ) : (
              <View style={styles.chevronBtn} />
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

// --- Sub-views -----------------------------------------------------------

/**
 * Sub-view 0: Officer vs Trooper comparison. Distinct from the other four
 * sub-views in layout (2 cards side-by-side instead of single illustration
 * + bullets). Content was previously the standalone /pulled-over screen.
 *
 * Figma node: 825:3957
 */
function OfficerTrooperView() {
  return (
    <View style={officerStyles.page}>
      <View style={officerStyles.titleBlock}>
        <Text style={officerStyles.eyebrow}>Stay informed</Text>
        <Text style={officerStyles.title}>Know the difference:</Text>
      </View>

      <View style={officerStyles.cardsRow}>
        {/*
          TODO: real Officer/Trooper character illustrations exported
          from Figma. Ionicons placeholders carry the layout.
        */}
        <View style={officerStyles.card}>
          <View style={officerStyles.illustrationBox}>
            <Ionicons name="shield" size={64} color="#1B3F8B" />
            <Text style={officerStyles.cardLabel}>Officer</Text>
          </View>
          <View style={officerStyles.bullets}>
            <Text style={officerStyles.bullet}>
              •{'  '}Wears a{' '}
              <Text style={officerStyles.emphasis}>standard police uniform</Text>{' '}
              with a <Text style={officerStyles.emphasis}>brimmed cap</Text>
            </Text>
            <Text style={officerStyles.bullet}>
              •{'  '}Drives a{' '}
              <Text style={officerStyles.emphasis}>county or city marked car</Text>{' '}
              with the municipality name
            </Text>
          </View>
        </View>

        <View style={officerStyles.divider} />

        <View style={officerStyles.card}>
          <View style={officerStyles.illustrationBox}>
            <Ionicons name="shield-half" size={64} color="#5C5C5C" />
            <Text style={officerStyles.cardLabel}>Trooper</Text>
          </View>
          <View style={officerStyles.bullets}>
            <Text style={officerStyles.bullet}>
              •{'  '}Wears a{' '}
              <Text style={officerStyles.emphasis}>Smokey Bear hat</Text>
            </Text>
            <Text style={officerStyles.bullet}>
              •{'  '}Vehicle has{' '}
              <Text style={officerStyles.emphasis}>"State Trooper"</Text> or{' '}
              <Text style={officerStyles.emphasis}>"Highway Patrol"</Text> on the door
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Reusable layout for sub-views 1-4. Each follows the same structure:
 * 320x320 illustration block / Title1 Emphasized title / bulleted list.
 */
function ContentView({
  illustration,
  title,
  bullets,
}: {
  illustration: ReactNode;
  title: string;
  bullets: ReactNode[];
}) {
  return (
    <View style={contentStyles.page}>
      <View style={contentStyles.illustrationBox}>{illustration}</View>
      <View style={contentStyles.body}>
        <Text style={contentStyles.title}>{title}</Text>
        <View style={contentStyles.bullets}>{bullets}</View>
      </View>
    </View>
  );
}

/** Single bullet row. `children` accepts mixed text + emphasized fragments. */
function Bullet({ children }: { children: ReactNode }) {
  return (
    <View style={contentStyles.bulletRow}>
      <Text style={contentStyles.bulletDot}>•</Text>
      <Text style={contentStyles.bulletText}>{children}</Text>
    </View>
  );
}

/** Inline emphasized fragment within a bullet (Title3 Emphasized weight). */
function Strong({ children }: { children: ReactNode }) {
  return <Text style={contentStyles.bulletStrong}>{children}</Text>;
}

function WhatToDoView() {
  return (
    <ContentView
      illustration={
        <Ionicons name="car-outline" size={120} color={colors.wiltedgreen} />
      }
      title="Immediately after you've been stopped:"
      bullets={[
        <Bullet key="pull-over">
          <Strong>Pull over</Strong> safely in a well lit place
        </Bullet>,
        <Bullet key="turn-off">
          Turn off the car, and turn on the interior light
        </Bullet>,
        <Bullet key="window">
          Partially <Strong>open the window</Strong>
        </Bullet>,
        <Bullet key="hands">
          Place your <Strong>hands on the wheel</Strong>
        </Bullet>,
      ]}
    />
  );
}

function WhatToHaveView() {
  return (
    <ContentView
      illustration={
        <Ionicons name="card-outline" size={120} color={colors.wiltedgreen} />
      }
      title="What you must provide:"
      bullets={[
        <Bullet key="license">
          Driver's <Strong>license</Strong>
        </Bullet>,
        <Bullet key="registration">
          <Strong>Registration</Strong>
        </Bullet>,
        <Bullet key="insurance">
          Proof of <Strong>insurance</Strong>
        </Bullet>,
      ]}
    />
  );
}

function WhatToSayView({ showFirearm }: { showFirearm: boolean }) {
  // Firearm bullet only renders when armed=yes or preferred-not-to-answer.
  // For armed=no it's omitted entirely — declaring a non-existent weapon
  // would be the wrong advice and adds cognitive load to a stressful moment.
  const bullets: ReactNode[] = [];

  if (showFirearm) {
    bullets.push(
      <Bullet key="firearm">
        "Officer,{' '}
        <Strong>
          I have a valid concealed carry permit and am currently carrying a
          firearm. It is located [location of firearm]
        </Strong>
        ."
      </Bullet>,
    );
  }

  bullets.push(
    <Bullet key="ask-how">
      <Strong>Ask how to proceed</Strong>
    </Bullet>,
    <Bullet key="remain-still">
      <Strong>Remain still and do not reach</Strong> until instructed otherwise
    </Bullet>,
  );

  return (
    <ContentView
      illustration={
        <Ionicons
          name="chatbubble-ellipses-outline"
          size={120}
          color={colors.wiltedgreen}
        />
      }
      title="What you can say:"
      bullets={bullets}
    />
  );
}

function WhatToKnowView() {
  return (
    <ContentView
      illustration={
        <Ionicons name="library-outline" size={120} color={colors.wiltedgreen} />
      }
      title="Know your rights:"
      bullets={[
        <Bullet key="answer">
          You don't have to answer questions beyond{' '}
          <Strong>identifying yourself</Strong>
        </Bullet>,
        <Bullet key="search">
          You don't have to consent to a search.{' '}
          <Strong>Say "I do not consent to a search"</Strong> clearly
        </Bullet>,
        <Bullet key="why">
          You can <Strong>ask why</Strong> you were stopped
        </Bullet>,
      ]}
    />
  );
}

// --- Styles --------------------------------------------------------------

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
  content: {
    flex: 1,
    paddingTop: 40,
  },
  footer: {
    gap: 16,
    paddingBottom: 8,
  },
  closeBtn: {
    alignSelf: 'flex-end',
  },
  closeText: {
    ...typography.footnoteRegular,
    color: colors.mutedTertiary,
    textDecorationLine: 'underline',
  },
  chevronsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    alignItems: 'center',
  },
  chevronBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Officer/Trooper has its own layout (2-card comparison) — separate
// stylesheet so the smaller content-view styles don't leak in.
const officerStyles = StyleSheet.create({
  page: {
    flex: 1,
    gap: 40,
    alignItems: 'center',
  },
  titleBlock: {
    gap: 8,
    alignItems: 'flex-start',
    width: '100%',
  },
  eyebrow: {
    ...typography.title1Regular,
    color: colors.labelTertiary,
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
    width: '100%',
  },
  card: {
    flex: 1,
    gap: 32,
    alignItems: 'center',
  },
  illustrationBox: {
    width: 148,
    height: 244,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    padding: 16,
  },
  cardLabel: {
    ...typography.title3Regular,
    color: colors.black,
  },
  bullets: {
    gap: 16,
    width: '100%',
    alignItems: 'flex-start',
  },
  bullet: {
    ...typography.calloutRegular,
    color: colors.black,
  },
  emphasis: {
    fontWeight: '600',
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(202, 196, 208, 1)',
    marginVertical: 16,
  },
});

// Shared content layout for sub-views 1-4 (Do / Have / Say / Know).
const contentStyles = StyleSheet.create({
  page: {
    flex: 1,
    gap: 40,
    alignItems: 'center',
  },
  illustrationBox: {
    // 320x320 square per Figma (each sub-view's illustration container is
    // size-[320px]). Ionicons placeholders float small inside this until
    // real illustrations land in a polish PR — at which point the assets
    // will fill the box without resizing.
    width: 320,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    width: '100%',
    gap: 32,
  },
  title: {
    ...typography.title1Emphasized,
    color: colors.black,
  },
  bullets: {
    gap: 16,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  bulletDot: {
    ...typography.title3Regular,
    color: colors.black,
  },
  bulletText: {
    ...typography.title3Regular,
    color: colors.black,
    flex: 1,
  },
  bulletStrong: {
    ...typography.title3Emphasized,
    color: colors.black,
  },
});
