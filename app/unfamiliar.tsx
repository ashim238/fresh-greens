import * as Location from 'expo-location';

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { GasPump } from 'phosphor-react-native/src/icons/GasPump';
import { Lightbulb } from 'phosphor-react-native/src/icons/Lightbulb';
import { RoadHorizon } from 'phosphor-react-native/src/icons/RoadHorizon';

import { Button } from '../components/Button';
import { DragHandle } from '../components/DragHandle';
import { LifelineModal } from '../components/LifelineModal';
import { NotifyingPulse } from '../components/NotifyingPulse';
import { useShareSession } from '../hooks/useShareSession';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { searchPlaces } from '../lib/api/places';
import { getErrorMessage } from '../lib/error-message';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { safetyCardHeight, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Step = 'problem' | 'destination' | 'active';

type ProblemOption = {
  id: string;
  title: string;
  clarifier: string;
};

const PROBLEMS: ProblemOption[] = [
  { id: 'lost',     title: "I'm lost",         clarifier: "I don't recognize this area and need to get somewhere safe" },
  { id: 'unsafe',   title: 'I feel unsafe',    clarifier: 'Something about this area feels wrong — I want to leave' },
  { id: 'followed', title: "I'm being followed", clarifier: 'I think someone is tailing me' },
];

type DestinationOption = {
  id: 'well-lit' | 'gas-station' | 'on-ramp';
  title: string;
  Icon: typeof Lightbulb;
  /**
   * Mapbox / Apple Maps category seed for searchPlaces. "Well-lit" has no
   * literal category — we proxy to "open business" (the closest honest
   * approximation; documented in the spec's "Well-lit" rationale).
   */
  query: string;
  /** Used in error copy: "Couldn't find a {nounSingular} nearby." */
  nounSingular: string;
};

const DESTINATIONS: DestinationOption[] = [
  { id: 'well-lit',    title: 'Take me to somewhere well-lit',  Icon: Lightbulb,   query: 'open business',  nounSingular: 'well-lit spot' },
  { id: 'gas-station', title: 'Take me to a gas station',       Icon: GasPump,     query: 'gas station',    nounSingular: 'gas station' },
  { id: 'on-ramp',     title: 'Take me to the nearest on-ramp', Icon: RoadHorizon, query: 'highway on-ramp', nounSingular: 'on-ramp' },
];

/**
 * /unfamiliar — Unfamiliar area /safety sub-flow.
 *
 * Step 1 (picker): pick the problem. Selection starts a global ShareSession
 *   and advances to Step 2.
 * Step 2 (destinations): pick a safe-destination category; nearest POI search
 *   + router.replace('/en-route?…') routes the user there. Modal dismisses;
 *   LiveSafetySheet on /en-route carries the active session forward.
 * Active (re-entry): if a session is already live when the route mounts, jump
 *   straight to a small "active session" view with end-sharing affordance.
 *
 * Footer pulse on Steps 1/2 is wrapped in a Pressable that opens LifelineModal.
 */
export default function Unfamiliar() {
  const router = useRouter();
  const shareState = useShareSession();
  const session = shareState.ready ? shareState.session : null;
  const { start, end, resend } = shareState;
  const contactState = useTrustedContact();
  const contact = contactState.ready ? contactState.contact : null;
  // Step initializer reads `session` lazily on mount. While the hook is
  // still hydrating from AsyncStorage (!shareState.ready), `session` is null —
  // we'd land on 'problem' and let the user start a NEW session that
  // overwrites the existing one's startedAtIso. Guarding on ready
  // forces the picker to wait until the hook resolves; once it has, we
  // never re-read here (the useState initializer fires once).
  const [step, setStep] = useState<Step | null>(() =>
    !shareState.ready ? null : session?.type === 'unfamiliar' ? 'active' : 'problem',
  );
  if (step === null && shareState.ready) {
    setStep(session?.type === 'unfamiliar' ? 'active' : 'problem');
  }
  const [lifelineOpen, setLifelineOpen] = useState(false);
  // Tracks the destination row currently fetching (Location + Mapbox
  // searchPlaces — 2-5s on cold start). Drives an in-row ActivityIndicator
  // + disables all rows so the safety flow doesn't read as broken or accept
  // a double-tap mid-flight.
  const [loadingDestId, setLoadingDestId] = useState<string | null>(null);
  const [destError, setDestError] = useState<string | null>(null);

  async function handleProblemPick(option: ProblemOption) {
    const startResult = await start.run({ type: 'unfamiliar', reason: option.title });
    if (!startResult.ok) {
      const { title, body } = getErrorMessage('sharing', 'transient', startResult.error);
      Alert.alert(title, body);
      return;
    }
    setStep('destination');
  }

  async function handleDestinationPick(option: DestinationOption) {
    if (loadingDestId !== null) return;
    setDestError(null);
    setLoadingDestId(option.id);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setDestError('Allow location access so we can find nearby safe destinations.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const results = await searchPlaces(option.query, {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const hit = results[0];
      if (!hit) {
        setDestError(`Couldn't find a ${option.nounSingular} nearby. Try a different option.`);
        return;
      }
      router.replace({
        pathname: '/en-route',
        params: {
          destLat: String(hit.latitude),
          destLng: String(hit.longitude),
          destName: hit.name,
        },
      });
    } catch (err) {
      const { body } = getErrorMessage('load', 'transient', err);
      setDestError(body);
    } finally {
      setLoadingDestId(null);
    }
  }

  async function handleSafeNow() {
    const endResult = await end.run();
    if (!endResult.ok) {
      const { title: endTitle, body: endBody } = getErrorMessage('sharing', 'transient', endResult.error);
      Alert.alert(endTitle, endBody);
      return;
    }
    // Most entries push /unfamiliar over /safety so `back()` works,
    // but a future notification deep-link could land here cold —
    // fall back to /home so the user is never stranded on the modal.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.dragHandleWrap}>
          <DragHandle />
        </View>
        {step === 'problem' && (
          <ProblemPicker
            contactName={contact?.name ?? 'Your contact'}
            hasLifeline={!!contact}
            onPick={handleProblemPick}
            onLifeline={() => setLifelineOpen(true)}
          />
        )}
        {step === 'destination' && (
          <DestinationPicker
            contactName={contact?.name ?? 'Your contact'}
            hasLifeline={!!contact}
            onBack={() => setStep('problem')}
            onPick={handleDestinationPick}
            onSafeNow={handleSafeNow}
            onLifeline={() => setLifelineOpen(true)}
            loadingDestId={loadingDestId}
            error={destError}
          />
        )}
        {step === 'active' && session && (
          <ActiveSessionView
            contactName={contact?.name ?? 'Your contact'}
            hasLifeline={!!contact}
            sessionReason={session.reason}
            onEnd={handleSafeNow}
            onResendSms={() => {
              void resend.run(undefined);
            }}
          />
        )}
      </SafeAreaView>

      {contact && (
        <LifelineModal
          visible={lifelineOpen}
          onClose={() => setLifelineOpen(false)}
          contact={contact}
        />
      )}
    </View>
  );
}

function ProblemPicker({
  contactName,
  hasLifeline,
  onPick,
  onLifeline,
}: {
  contactName: string;
  hasLifeline: boolean;
  onPick: (option: ProblemOption) => void;
  onLifeline: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      {/* Reserve the chevron's vertical footprint even though step 1
          has no back affordance — keeps the title's y-position stable
          across step 1 → step 2 transitions. */}
      <View style={styles.backChevronPlaceholder} />
      <Text style={styles.subtitle}>Ok. You&apos;re somewhere unfamiliar.</Text>
      <Text style={styles.title} accessibilityRole="header">
        What&apos;s going on?
      </Text>

      <View style={styles.rowList}>
        {PROBLEMS.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onPick(p)}
            style={({ pressed }) => [styles.twoLineRow, pressed && pressedDim]}
            accessibilityRole="button"
            accessibilityLabel={`${p.title}. ${p.clarifier}`}
            accessibilityHint="Reports this and starts sharing your location with your trusted contact"
          >
            <Text style={styles.rowTitle}>{p.title}</Text>
            <Text style={styles.rowClarifier}>{p.clarifier}</Text>
          </Pressable>
        ))}
      </View>

      {/* Lifeline pulse only shows when a trusted contact is set —
          /unfamiliar's routing works contact-less per the relaxed gate
          (user-flagged 2026-06-01), but the pulse copy literally
          claims notification, so it must hide when there's no one to
          notify rather than degrade silently. */}
      {hasLifeline && (
        <Pressable
          onPress={onLifeline}
          style={styles.pulseFooter}
          accessibilityRole="button"
          accessibilityLabel={`Messages opened for ${contactName}. Tap to call or text.`}
        >
          <NotifyingPulse contactName={contactName} />
        </Pressable>
      )}
    </ScrollView>
  );
}

function DestinationPicker({
  contactName,
  hasLifeline,
  onBack,
  onPick,
  onSafeNow,
  onLifeline,
  loadingDestId,
  error,
}: {
  contactName: string;
  hasLifeline: boolean;
  onBack: () => void;
  onPick: (option: DestinationOption) => void;
  onSafeNow: () => void;
  onLifeline: () => void;
  loadingDestId: string | null;
  error: string | null;
}) {
  const anyLoading = loadingDestId !== null;
  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.backChevron, pressed && pressedDim]}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <CaretLeft size={28} color={colors.black} weight="regular" />
      </Pressable>

      <Text style={styles.subtitle}>Let&apos;s get you someplace safe.</Text>
      <Text style={styles.title} accessibilityRole="header">
        Where do you want to go?
      </Text>
      <Text style={styles.aspirationalNote}>
        Pick a safe destination and we&apos;ll route you there. Your contact already has a text draft in Messages.
      </Text>

      <View style={styles.destinationList}>
        {DESTINATIONS.map((d) => {
          const isLoading = loadingDestId === d.id;
          return (
            <Pressable
              key={d.id}
              onPress={() => onPick(d)}
              disabled={anyLoading}
              style={({ pressed }) => [
                styles.iconRow,
                pressed && !anyLoading && pressedDim,
                anyLoading && !isLoading && { opacity: 0.5 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={d.title}
              accessibilityHint="Routes you there and returns to the map"
              accessibilityState={{ disabled: anyLoading, busy: isLoading }}
            >
              <View style={styles.iconCircle}>
                {isLoading ? (
                  <ActivityIndicator color={colors.freshgreen} />
                ) : (
                  <d.Icon size={24} color={colors.freshgreen} weight="regular" />
                )}
              </View>
              <Text style={styles.rowTitle}>{d.title}</Text>
            </Pressable>
          );
        })}
      </View>

      {error && (
        <Text style={styles.destError} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}

      <View style={styles.safeNowWrap}>
        <Button
          text="I'm safe now"
          type="primary"
          fill="outline"
          onPress={onSafeNow}
          style={styles.safeNowStretch}
        />
      </View>

      {/* Same contact-less guard as ProblemPicker. */}
      {hasLifeline && (
        <Pressable
          onPress={onLifeline}
          style={styles.pulseFooter}
          accessibilityRole="button"
          accessibilityLabel={`Messages opened for ${contactName}. Tap to call or text.`}
        >
          <NotifyingPulse contactName={contactName} />
        </Pressable>
      )}
    </ScrollView>
  );
}

function ActiveSessionView({
  contactName,
  hasLifeline,
  sessionReason,
  onEnd,
  onResendSms,
}: {
  contactName: string;
  hasLifeline: boolean;
  sessionReason: string;
  onEnd: () => void;
  onResendSms: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      {/* Phantom-chevron slot — keeps the title's y-position aligned
          with the other views in this flow that DO have a chevron. */}
      <View style={styles.backChevronPlaceholder} />
      <Text style={styles.subtitle}>Already on it.</Text>
      <Text style={styles.title} accessibilityRole="header">
        Sharing in Unfamiliar area.
      </Text>
      <Text style={styles.aspirationalNote}>Reason: {sessionReason}</Text>

      <View style={styles.safeNowWrap}>
        <Button
          text="I'm safe now"
          type="primary"
          fill="fill"
          onPress={onEnd}
          style={styles.safeNowStretch}
        />
      </View>

      {/* Active view: lifeline omitted — contact is already context here,
          and the only exit is "I'm safe now". The pulse stays decorative.
          Same hasLifeline gate as the other views — if no contact is set
          the pulse would claim notification it can't perform. */}
      {hasLifeline && (
        <View style={styles.pulseFooter}>
          <NotifyingPulse contactName={contactName} onPress={onResendSms} />
        </View>
      )}
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
  backChevron: {
    marginTop: spacing.sm,
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  // Phantom-chevron slot on step 1 (problem picker): matches the
  // backChevron's marginTop + height so the title position stays put
  // when the user advances to step 2 (destination picker, which DOES
  // have a back chevron). User-flagged 2026-06-01.
  backChevronPlaceholder: {
    marginTop: spacing.sm,
    height: 44,
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
    ...dynamicType(typography.title1Emphasized),
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
  destError: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.red,
    marginTop: spacing.sm,
  },
  // Card list mirrors /pulled-over's armed picker (armedStyles
  // answersWrapper): flex 1 + justifyContent center vertically centers
  // the cards in the space between the title and the footer, gap 48
  // between cards. User-flagged 2026-06-01: /pulled-over sets the
  // precedent for the safety-flow card treatment.
  rowList: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  // DestinationPicker keeps its own list — it has a bottom-pinned
  // "I'm safe now" button (safeNowWrap, marginTop: auto), so the rows
  // can't be flex:1-centered or they'd consume the space the button
  // needs. Elevated cards (via iconRow) at a 16pt gap that suits the
  // shadow separation.
  destinationList: {
    gap: spacing.md,
  },
  // Two-line problem card — elevated white + shadows.e1, height 100,
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
  // Destination icon row — same elevated white register as the problem
  // cards so the two /unfamiliar screens read as one flow. Single-line
  // (icon + label) so it keeps its row height rather than the 100pt
  // two-line card height.
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 60,
    ...shadows.e1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    // fillsTertiary (was white) — the card itself is now white, so a
    // white circle would vanish. Matches /roadside's iconCircle.
    backgroundColor: colors.fillsTertiary,
    alignItems: 'center',
    justifyContent: 'center',
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
  safeNowWrap: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
  safeNowStretch: {
    alignSelf: 'stretch',
  },
  pulseFooter: {
    minHeight: 44,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
