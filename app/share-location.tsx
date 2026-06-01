import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { DragHandle } from '../components/DragHandle';
import { NotifyingPulse } from '../components/NotifyingPulse';
import { useShareSession } from '../hooks/useShareSession';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { spacing } from '../theme/spacing';
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
  const { session, startSession, endSession } = useShareSession();
  const { contact } = useTrustedContact();
  const [busy, setBusy] = useState(false);

  const isActive = session?.type === 'share-location';

  // Dismiss to /home if we got here cold (deep-link / notification entry)
  // — never strand the user with no exit. router.canGoBack() is true for
  // the usual /safety → /share-location push path.
  function dismiss() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  }

  async function handlePick(option: ReasonOption) {
    if (busy) return;
    setBusy(true);
    try {
      await startSession({ type: 'share-location', reason: option.title });
      dismiss();
    } catch (err) {
      console.warn('share-location start failed', err);
      setBusy(false);
    }
  }

  async function handleEnd() {
    try {
      await endSession();
      dismiss();
    } catch (err) {
      console.warn('share-location end failed', err);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <DragHandle />
        {isActive && session ? (
          <ActiveView
            contactName={contact?.name ?? 'Your contact'}
            sessionReason={session.reason}
            onEnd={handleEnd}
          />
        ) : (
          <ReasonPicker
            contactName={contact?.name ?? 'Your contact'}
            onPick={handlePick}
            disabled={busy}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function ReasonPicker({
  contactName,
  onPick,
  disabled,
}: {
  contactName: string;
  onPick: (option: ReasonOption) => void;
  disabled: boolean;
}) {
  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Text style={styles.subtitle}>On it. Sharing your location now.</Text>
      <Text style={styles.title} accessibilityRole="header">
        What&apos;s the situation?
      </Text>

      <View style={styles.rowList}>
        {REASONS.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => onPick(r)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.twoLineRow,
              pressed && !disabled && pressedDim,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${r.title}. ${r.clarifier}`}
            accessibilityState={{ disabled }}
          >
            <Text style={styles.rowTitle}>{r.title}</Text>
            <Text style={styles.rowClarifier}>{r.clarifier}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.pulseFooter}>
        <NotifyingPulse contactName={contactName} />
      </View>
    </ScrollView>
  );
}

function ActiveView({
  contactName,
  sessionReason,
  onEnd,
}: {
  contactName: string;
  sessionReason: string;
  onEnd: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Text style={styles.subtitle}>Already on it.</Text>
      <Text style={styles.title} accessibilityRole="header">
        Sharing your location.
      </Text>
      <Text style={styles.aspirationalNote}>Reason: {sessionReason}</Text>

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
        <NotifyingPulse contactName={contactName} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1 },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  subtitle: {
    ...dynamicType(relaxedLineHeight(typography.bodyRegular)),
    color: colors.labelSecondary,
    marginTop: spacing.sm,
  },
  title: {
    ...dynamicType(typography.title2Emphasized),
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
  rowList: {
    gap: spacing.sm,
  },
  twoLineRow: {
    backgroundColor: colors.systemGroupedBackground,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 76,
  },
  rowTitle: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
  },
  rowClarifier: {
    ...dynamicType(relaxedLineHeight(typography.bodyRegular)),
    color: colors.labelSecondary,
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
