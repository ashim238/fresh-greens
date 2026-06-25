import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { DragHandle } from '../components/DragHandle';
import { NotifyingPulse } from '../components/NotifyingPulse';
import { useShareSession } from '../hooks/useShareSession';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { getErrorMessage } from '../lib/error-message';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { safetyCardHeight, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type ReasonOption = {
  id: string;
  title: string;
  clarifier: string;
};

const REASONS: ReasonOption[] = [
  { id: 'new-place',   title: 'Heading somewhere new', clarifier: 'I want someone to know where I am' },
  { id: 'night-drive', title: 'Driving late at night', clarifier: 'I could use the additional peace of mind' },
  { id: 'uneasy',      title: 'I feel uneasy',         clarifier: "Something's off, and I could use the visibility" },
  { id: 'routine',     title: 'Just in case',          clarifier: 'Routine safety — nothing specific' },
];

/**
 * /share-location — proactive Share Location /safety sub-flow.
 *
 * Single step (reason picker). On selection: startSession + router.back()
 * to whatever was underneath (/home or /en-route). LiveSafetySheet
 * surfaces the active session there.
 *
 * Re-entry: if a share-location session is already live, render the
 * "active session" view with End-sharing CTA — never the picker.
 *
 * No lifeline footer (Unfamiliar-only per scope decision).
 */
export default function ShareLocation() {
  const router = useRouter();
  const shareState = useShareSession();
  const { start, end, resend } = shareState;
  const contactState = useTrustedContact();
  const contact = contactState.ready ? contactState.contact : null;
  const [busyReasonId, setBusyReasonId] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [endError, setEndError] = useState<string | null>(null);

  const session = shareState.ready ? shareState.session : null;
  const isActive = session?.type === 'share-location';

  function dismiss() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  }

  async function handlePick(option: ReasonOption) {
    if (busyReasonId !== null) return;
    setPickError(null);
    setBusyReasonId(option.id);
    const startResult = await start.run({ type: 'share-location', reason: option.title });
    if (!startResult.ok) {
      const { body } = getErrorMessage('sharing', 'transient', startResult.error);
      setPickError(body);
      setBusyReasonId(null);
      return;
    }
    dismiss();
  }

  async function handleEnd() {
    setEndError(null);
    const endResult = await end.run();
    if (!endResult.ok) {
      const { body } = getErrorMessage('sharing', 'transient', endResult.error);
      setEndError(body);
      return;
    }
    dismiss();
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.dragHandleWrap}>
          <DragHandle />
        </View>
        {shareState.ready
          ? isActive && session
            ? (
              <ActiveView
                contactName={contact?.name ?? 'Your contact'}
                sessionReason={session.reason}
                onEnd={handleEnd}
                endError={endError}
                onResendSms={() => {
                  void resend.run(undefined);
                }}
              />
            )
            : (
              <ReasonPicker
                contactName={contact?.name ?? 'Your contact'}
                onPick={handlePick}
                busyReasonId={busyReasonId}
                pickError={pickError}
              />
            )
          : null}
      </SafeAreaView>
    </View>
  );
}

function ReasonPicker({
  contactName,
  onPick,
  busyReasonId,
  pickError,
}: {
  contactName: string;
  onPick: (option: ReasonOption) => void;
  busyReasonId: string | null;
  pickError: string | null;
}) {
  const anyBusy = busyReasonId !== null;
  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      {/* Phantom-chevron slot — keeps title y-position aligned with
          the chevron-bearing views in sibling safety flows. */}
      <View style={styles.backChevronPlaceholder} />
      <Text style={styles.subtitle}>You choose. We&apos;ll tell them.</Text>
      <Text style={styles.title} accessibilityRole="header">
        What&apos;s the situation?
      </Text>

      {pickError ? (
        <Text style={styles.errorNote} accessibilityLiveRegion="polite">
          {pickError} Tap a reason to try again.
        </Text>
      ) : null}

      <View style={styles.rowList}>
        {REASONS.map((r) => {
          const isLoading = busyReasonId === r.id;
          return (
            <Pressable
              key={r.id}
              onPress={() => onPick(r)}
              disabled={anyBusy}
              style={({ pressed }) => [
                styles.twoLineRow,
                pressed && !anyBusy && pressedDim,
                anyBusy && !isLoading && { opacity: 0.5 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${r.title}. ${r.clarifier}`}
              accessibilityHint={`Opens Messages with a safety check-in draft for ${contactName}`}
              accessibilityState={{ disabled: anyBusy, busy: isLoading }}
            >
              <View style={styles.rowTitleRow}>
                <Text style={styles.rowTitle}>{r.title}</Text>
                {isLoading && <ActivityIndicator size="small" color={colors.freshgreen} />}
              </View>
              <Text style={styles.rowClarifier}>{r.clarifier}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.pulseFooter}>
        <NotifyingPulse
          contactName={contactName}
          label={`Choosing a reason opens Messages for ${contactName}`}
        />
      </View>
    </ScrollView>
  );
}

function ActiveView({
  contactName,
  sessionReason,
  onEnd,
  endError,
  onResendSms,
}: {
  contactName: string;
  sessionReason: string;
  onEnd: () => void;
  endError: string | null;
  onResendSms: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      {/* Phantom-chevron slot — keeps title y-position aligned with
          the chevron-bearing views in sibling safety flows. */}
      <View style={styles.backChevronPlaceholder} />
      <Text style={styles.subtitle}>Already on it.</Text>
      <Text style={styles.title} accessibilityRole="header">
        Sharing your location.
      </Text>
      <Text style={styles.aspirationalNote}>Reason: {sessionReason}</Text>

      {endError && (
        <Text style={styles.errorNote} accessibilityLiveRegion="polite">
          {endError} Tap below to retry.
        </Text>
      )}

      <View style={styles.endWrap}>
        <Button
          text="End sharing"
          type="primary"
          fill="fill"
          onPress={onEnd}
          style={styles.endStretch}
        />
      </View>

      <View style={styles.pulseFooter}>
        <NotifyingPulse contactName={contactName} onPress={onResendSms} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1 },
  // Drag-handle wrapper mirrors /safety's dragHandleWrapper + /roadside's
  // updated pattern: 16pt above AND below the bar so the breathing room
  // is symmetric. User-flagged 2026-06-01 — bare DragHandle was too
  // tight against the safe-area top.
  dragHandleWrap: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  body: {
    paddingHorizontal: spacing.lg,
    // paddingTop: 0 — dragHandleWrap above provides the separation.
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  // Phantom-chevron slot — /share-location is a single-step flow with
  // no back-chevron anywhere, but the other safety flows
  // (/unfamiliar, /roadside) have chevron-steps that push their title
  // ~40pt down. Reserving the same space here keeps the title's
  // y-position aligned across the four safety flows. User-flagged
  // 2026-06-01.
  backChevronPlaceholder: {
    marginTop: spacing.sm,
    height: 32,
  },
  // Eyebrow + title pair — mirrors /pulled-over's armed picker. The
  // eyebrow drops to title3Regular (20pt) so the size-step against
  // the 28pt title is unmistakable; the prior title1Regular eyebrow
  // (28pt) was hard to read as an eyebrow when weight was the only
  // differentiator. User-flagged 2026-06-01. See /roadside for the
  // full rationale.
  subtitle: {
    ...dynamicType(typography.title3Regular),
    color: colors.labelTertiary,
    marginTop: spacing.sm,
  },
  title: {
    // title1Regular per Held-Question rule — "What's the situation?" is
    // a user prompt, not a directive. Active state "Sharing your location."
    // is declarative but Regular reads cleanly there too.
    ...dynamicType(typography.title1Regular),
    color: colors.black,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  aspirationalNote: {
    ...dynamicType(relaxedLineHeight(typography.footnoteRegular)),
    color: colors.labelSecondary,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  errorNote: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.red,
    marginBottom: spacing.sm,
  },
  // Card list mirrors /pulled-over's armed picker (and the matching
  // pass on /unfamiliar): flex 1 + justifyContent center vertically
  // centers the cards, gap 48 between them. With 4 reasons at height
  // 100 the stack can exceed a page-sheet's height on smaller devices;
  // the ScrollView then scrolls and the rows fall back to top-aligned.
  // User-flagged 2026-06-01: /pulled-over sets the precedent for the
  // safety-flow card treatment.
  rowList: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  // Two-line reason card — elevated white + shadows.e1, height 100,
  // content vertically centered. Exact match to /pulled-over's
  // answerCard (was flat systemGroupedBackground at minHeight 76).
  twoLineRow: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    height: safetyCardHeight,
    justifyContent: 'center',
    ...shadows.e1,
  },
  rowTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  rowTitle: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
  },
  // Matches /pulled-over's answerSubtitle (subheadlineRegular +
  // labelTertiary) — was bodyRegular + labelSecondary.
  rowClarifier: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.labelTertiary,
  },
  endWrap: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
  endStretch: {
    alignSelf: 'stretch',
  },
  pulseFooter: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    alignItems: 'center',
  },
});
