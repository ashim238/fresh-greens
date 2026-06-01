import * as Location from 'expo-location';

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
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
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { spacing } from '../theme/spacing';
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
  const { session, loading, startSession, endSession } = useShareSession();
  const { contact } = useTrustedContact();
  // Step initializer reads `session` lazily on mount. While the hook is
  // still hydrating from AsyncStorage (loading=true), `session` is null —
  // we'd land on 'problem' and let the user start a NEW session that
  // overwrites the existing one's startedAtIso. Guarding on `loading`
  // forces the picker to wait until the hook resolves; once it has, we
  // never re-read here (the useState initializer fires once).
  const [step, setStep] = useState<Step | null>(() =>
    loading ? null : session?.type === 'unfamiliar' ? 'active' : 'problem',
  );
  if (step === null && !loading) {
    setStep(session?.type === 'unfamiliar' ? 'active' : 'problem');
  }
  const [lifelineOpen, setLifelineOpen] = useState(false);

  async function handleProblemPick(option: ProblemOption) {
    await startSession({ type: 'unfamiliar', reason: option.title });
    setStep('destination');
  }

  async function handleDestinationPick(option: DestinationOption) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location needed',
          'Allow location access so we can find nearby safe destinations.',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const results = await searchPlaces(option.query, {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const hit = results[0];
      if (!hit) {
        Alert.alert(
          'No results',
          `Couldn't find a ${option.nounSingular} nearby. Try a different option.`,
        );
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
      console.warn('unfamiliar destination search failed', err);
      Alert.alert(
        'Search failed',
        'Could not search for nearby destinations. Try again in a moment.',
      );
    }
  }

  async function handleSafeNow() {
    try {
      await endSession();
      // Most entries push /unfamiliar over /safety so `back()` works,
      // but a future notification deep-link could land here cold —
      // fall back to /home so the user is never stranded on the modal.
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/home');
      }
    } catch (err) {
      console.warn('unfamiliar end failed', err);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <DragHandle />
        {step === 'problem' && (
          <ProblemPicker
            contactName={contact?.name ?? 'Your contact'}
            onPick={handleProblemPick}
            onLifeline={() => setLifelineOpen(true)}
          />
        )}
        {step === 'destination' && (
          <DestinationPicker
            contactName={contact?.name ?? 'Your contact'}
            onBack={() => setStep('problem')}
            onPick={handleDestinationPick}
            onSafeNow={handleSafeNow}
            onLifeline={() => setLifelineOpen(true)}
          />
        )}
        {step === 'active' && session && (
          <ActiveSessionView
            contactName={contact?.name ?? 'Your contact'}
            sessionReason={session.reason}
            onEnd={handleSafeNow}
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
  onPick,
  onLifeline,
}: {
  contactName: string;
  onPick: (option: ProblemOption) => void;
  onLifeline: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
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
          >
            <Text style={styles.rowTitle}>{p.title}</Text>
            <Text style={styles.rowClarifier}>{p.clarifier}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={onLifeline}
        style={styles.pulseFooter}
        accessibilityRole="button"
        accessibilityLabel={`${contactName} is being notified. Tap to call or text.`}
        hitSlop={8}
      >
        <NotifyingPulse contactName={contactName} />
      </Pressable>
    </ScrollView>
  );
}

function DestinationPicker({
  contactName,
  onBack,
  onPick,
  onSafeNow,
  onLifeline,
}: {
  contactName: string;
  onBack: () => void;
  onPick: (option: DestinationOption) => void;
  onSafeNow: () => void;
  onLifeline: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.backChevron, pressed && pressedDim]}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
      >
        <CaretLeft size={28} color={colors.black} weight="regular" />
      </Pressable>

      <Text style={styles.subtitle}>Let&apos;s get you someplace safe.</Text>
      <Text style={styles.title} accessibilityRole="header">
        Where do you want to go?
      </Text>
      <Text style={styles.aspirationalNote}>
        Fresh Greens saves your journey periodically to ensure we can get you back on track.
      </Text>

      <View style={styles.rowList}>
        {DESTINATIONS.map((d) => (
          <Pressable
            key={d.id}
            onPress={() => onPick(d)}
            style={({ pressed }) => [styles.iconRow, pressed && pressedDim]}
            accessibilityRole="button"
            accessibilityLabel={d.title}
          >
            <View style={styles.iconCircle}>
              <d.Icon size={24} color={colors.freshgreen} weight="regular" />
            </View>
            <Text style={styles.rowTitle}>{d.title}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.safeNowWrap}>
        <Button
          text="I'm safe now"
          type="primary"
          fill="outline"
          onPress={onSafeNow}
          style={styles.safeNowStretch}
        />
      </View>

      <Pressable
        onPress={onLifeline}
        style={styles.pulseFooter}
        accessibilityRole="button"
        accessibilityLabel={`${contactName} is being notified. Tap to call or text.`}
        hitSlop={8}
      >
        <NotifyingPulse contactName={contactName} />
      </Pressable>
    </ScrollView>
  );
}

function ActiveSessionView({
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
          and the only exit is "I'm safe now". The pulse stays decorative. */}
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
  backChevron: {
    marginTop: spacing.sm,
    width: 32,
    height: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
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
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.systemGroupedBackground,
    borderRadius: 12,
    padding: spacing.md,
    minHeight: 60,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
  },
  rowClarifier: {
    ...dynamicType(relaxedLineHeight(typography.bodyRegular)),
    color: colors.labelSecondary,
  },
  safeNowWrap: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
  safeNowStretch: {
    alignSelf: 'stretch',
  },
  pulseFooter: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    alignItems: 'center',
  },
});
