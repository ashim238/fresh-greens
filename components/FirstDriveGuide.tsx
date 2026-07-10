import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * First-drive spotlight tour — the darkened-screen walkthrough over
 * /en-route's controls. One control is spotlit at a time through a
 * cutout in the scrim; a card names it and explains its use. The SOS
 * step is the reason this exists: hold-to-confirm is invisible until
 * taught, and a label chip alone couldn't carry "press and HOLD"
 * (device-smoke PR #237 note).
 *
 * Rendering: the scrim is four absolutely-positioned rectangles
 * around the cutout, plus a white ring hugging the target. No mask
 * library needed; the rectangular cutout's corners leak a few px of
 * un-dimmed map outside the rounded ring, which reads fine over map
 * tiles. Tapping anywhere advances; Skip bails; the last step's CTA
 * reads "Got it".
 *
 * Persistence lives with the CALLER (useCoachMark) — this component
 * only renders steps and reports completion via onDone.
 */

export type GuideStep = {
  key: string;
  title: string;
  body: string;
  /** Window coordinates from measureInWindow. */
  rect: { x: number; y: number; width: number; height: number };
  /** circle → capsule ring (FABs); rounded → card ring (banner, speed). */
  shape: 'circle' | 'rounded';
};

/** Breathing room between the target's bounds and the spotlight ring. */
const CUTOUT_PAD = 8;

export function FirstDriveGuide({
  steps,
  onDone,
}: {
  steps: GuideStep[];
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const { height: winH } = useWindowDimensions();

  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;

  // VoiceOver hears each step as it appears — the visual spotlight
  // carries no semantics on its own.
  useEffect(() => {
    if (step) {
      AccessibilityInfo.announceForAccessibility(`${step.title}. ${step.body}`);
    }
  }, [step]);

  if (!step) return null;

  const hole = {
    x: step.rect.x - CUTOUT_PAD,
    y: step.rect.y - CUTOUT_PAD,
    w: step.rect.width + CUTOUT_PAD * 2,
    h: step.rect.height + CUTOUT_PAD * 2,
  };
  const ringRadius = step.shape === 'circle' ? hole.h / 2 : radii.lg;
  // Card sits opposite the spotlight's screen half so it never covers
  // the control it's describing.
  const cardBelow = hole.y + hole.h / 2 < winH / 2;

  const advance = () => (last ? onDone() : setIndex((i) => i + 1));

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onDone}>
      <View style={styles.root} accessibilityViewIsModal>
        <View
          pointerEvents="none"
          style={[
            styles.scrim,
            { top: 0, left: 0, right: 0, height: Math.max(0, hole.y) },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.scrim,
            { top: hole.y, left: 0, width: Math.max(0, hole.x), height: hole.h },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.scrim,
            { top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.scrim,
            { top: hole.y + hole.h, left: 0, right: 0, bottom: 0 },
          ]}
        />
        {/* Tap-anywhere-to-advance. Sits above the scrim, below the
            card, and deliberately covers the cutout too — the tour is
            a look-don't-touch surface; the real control works the
            moment the tour closes. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={advance}
          accessible={false}
        />
        <View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              top: hole.y,
              left: hole.x,
              width: hole.w,
              height: hole.h,
              borderRadius: ringRadius,
            },
          ]}
        />
        <View
          style={[
            styles.card,
            cardBelow
              ? { top: hole.y + hole.h + spacing.lg }
              : { bottom: winH - hole.y + spacing.lg },
          ]}
        >
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>
          <View style={styles.footer}>
            <View style={styles.dots}>
              {steps.map((s, i) => (
                <View
                  key={s.key}
                  style={[styles.dot, i === index && styles.dotActive]}
                />
              ))}
            </View>
            <Pressable
              onPress={onDone}
              style={styles.skipBtn}
              accessibilityRole="button"
              accessibilityLabel="Skip the guide"
            >
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
            <Pressable
              onPress={advance}
              style={({ pressed }) => [styles.nextBtn, pressed && styles.nextBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={last ? 'Finish the guide' : 'Next tip'}
            >
              <Text style={styles.nextText}>{last ? 'Got it' : 'Next'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrim: {
    position: 'absolute',
    backgroundColor: colors.guideScrim,
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.white,
  },
  card: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.e2,
  },
  title: {
    ...dynamicType(typography.title3Emphasized),
    color: colors.black,
  },
  body: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.labelSecondary,
    marginTop: spacing.xs,
  },
  footer: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.xs,
    flex: 1,
  },
  // 6pt ornament dots — page-position indicators, deliberately below
  // the 12pt floor (they carry no text; position is spoken via the
  // step announcements instead).
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.borderWarm,
  },
  dotActive: {
    backgroundColor: colors.freshgreen,
  },
  skipBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  skipText: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.mutedSecondary,
  },
  nextBtn: {
    minHeight: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.freshgreen,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  nextBtnPressed: {
    opacity: 0.85,
  },
  nextText: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.white,
  },
});
