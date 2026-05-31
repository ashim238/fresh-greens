import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePreventRemove } from '@react-navigation/native';

import { CarBattery } from 'phosphor-react-native/src/icons/CarBattery';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { GasPump } from 'phosphor-react-native/src/icons/GasPump';
import { Lock } from 'phosphor-react-native/src/icons/Lock';
import { MapPin } from 'phosphor-react-native/src/icons/MapPin';
import { Phone } from 'phosphor-react-native/src/icons/Phone';
import { ShareNetwork } from 'phosphor-react-native/src/icons/ShareNetwork';
import { Siren } from 'phosphor-react-native/src/icons/Siren';
import { Tire } from 'phosphor-react-native/src/icons/Tire';
import { Wrench } from 'phosphor-react-native/src/icons/Wrench';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';

import { Button } from '../components/Button';
import { DragHandle } from '../components/DragHandle';
import { NotifyingPulse } from '../components/NotifyingPulse';
import { useRoadsideProfile } from '../hooks/useRoadsideProfile';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { type ProblemType } from '../lib/api/roadside';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Step = 'problem' | 'action' | 'status';

type ProblemMeta = {
  id: ProblemType;
  label: string;
  Icon: typeof Tire;
  /** Phrase used in Step 2's headline: "You're in {location} {phrase}." */
  phrase: string;
};

const PROBLEMS: ProblemMeta[] = [
  { id: 'flat-tire',  label: 'Flat tire',                Icon: Tire,       phrase: 'with a flat tire' },
  { id: 'no-start',   label: "Won't start / Dead battery", Icon: CarBattery, phrase: 'with a dead battery' },
  { id: 'no-gas',     label: 'Out of gas',                Icon: GasPump,    phrase: 'out of gas' },
  { id: 'locked-out', label: 'Locked out',                Icon: Lock,       phrase: 'locked out' },
  { id: 'other',      label: 'Something else',            Icon: Wrench,     phrase: '' /* fallback handled in Step 2 */ },
];

/**
 * /roadside — Roadside Assistance sub-flow.
 *
 * Single page-sheet modal route with internal state machine: problem →
 * action → status. DragHandle on every step; chevron is internal-step
 * back nav (not sheet dismissal); Step 3 traps dismissal via
 * usePreventRemove (added in a later task). Matches /pulled-over.
 *
 * Spec: docs/superpowers/specs/2026-05-31-roadside-assistance-design.md
 */
export default function Roadside() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('problem');
  const [problem, setProblem] = useState<ProblemType | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null); // null = "Locating…"
  const [locationCoords, setLocationCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [wrongSpotOpen, setWrongSpotOpen] = useState(false);
  const [actionTaken, setActionTaken] = useState(false);
  const [shareOn, setShareOn] = useState(false);
  const [shareToggledAtIso, setShareToggledAtIso] = useState<string | null>(null);

  usePreventRemove(step === 'status', () => {
    // Block the dismissal — the user must use an explicit CTA on Step 3.
    // No-op callback; presence of the hook + true flag is what blocks.
  });

  // Fire a success haptic once when entering Step 3.
  useEffect(() => {
    if (step === 'status') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    }
  }, [step]);

  // Reverse-geocode the user's current location for the chip + Step 2 headline.
  // Fails silently → label stays "Locating…" until the user uses "Wrong spot?".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setLocationLabel('Location unavailable');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        setLocationCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        const places = await Location.reverseGeocodeAsync(pos.coords);
        if (cancelled) return;
        const hit = places[0];
        if (hit) {
          // "Park Slope, Brooklyn" — neighborhood, city. Fall back gracefully.
          const a = hit.district || hit.subregion || hit.name;
          const b = hit.city || hit.region;
          setLocationLabel([a, b].filter(Boolean).join(', ') || 'Your location');
        } else {
          setLocationLabel('Your location');
        }
      } catch (err) {
        console.warn('roadside reverse-geocode failed', err);
        if (!cancelled) setLocationLabel('Your location');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleProblemPick(id: ProblemType) {
    setProblem(id);
    setStep('action');
  }

  function handleBackToProblem() {
    setStep('problem');
  }

  function markActionTaken() {
    setActionTaken(true);
    setStep('status');
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <DragHandle />
        {step === 'problem' && (
          <ProblemPicker
            locationLabel={locationLabel}
            onPick={handleProblemPick}
            onWrongSpot={() => setWrongSpotOpen(true)}
          />
        )}
        {step === 'action' && (
          <ActionMenu
            problem={problem}
            locationLabel={locationLabel ?? 'Your location'}
            locationCoords={locationCoords}
            shareOn={shareOn}
            onBack={handleBackToProblem}
            onCallPlaced={markActionTaken}
            onTowSearchOpened={markActionTaken}
            onShareToggle={(next) => {
              setShareOn(next);
              if (next) {
                setShareToggledAtIso(new Date().toISOString());
                if (!actionTaken) markActionTaken();
              }
            }}
            onFiguredOut={() => router.back()}
          />
        )}
        {step === 'status' && (
          <LiveStatus
            problem={problem}
            locationLabel={locationLabel ?? 'Your location'}
            shareOn={shareOn}
            shareToggledAtIso={shareToggledAtIso}
            onBackOnRoad={() => router.back()}
            onSwitchToPulledOver={() => router.replace('/pulled-over')}
          />
        )}
      </SafeAreaView>

      <WrongSpotModal
        visible={wrongSpotOpen}
        onClose={() => setWrongSpotOpen(false)}
        onConfirm={(label, coords) => {
          setLocationLabel(label);
          if (coords) setLocationCoords(coords);
          setWrongSpotOpen(false);
        }}
      />
    </View>
  );
}

function ProblemPicker({
  locationLabel,
  onPick,
  onWrongSpot,
}: {
  locationLabel: string | null;
  onPick: (id: ProblemType) => void;
  onWrongSpot: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.stepBody}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.subtitle}>Let&apos;s get you the help you need.</Text>
      <Text style={styles.title} accessibilityRole="header">
        What&apos;s going on?
      </Text>

      <View style={styles.rowList}>
        {PROBLEMS.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onPick(p.id)}
            style={({ pressed }) => [styles.row, pressed && pressedDim]}
            accessibilityRole="button"
            accessibilityLabel={p.label}
          >
            <View style={styles.iconCircle}>
              <p.Icon size={24} color={colors.freshgreen} weight="regular" />
            </View>
            <Text style={styles.rowLabel}>{p.label}</Text>
            <CaretRight size={20} color={colors.labelTertiary} weight="bold" />
          </Pressable>
        ))}
      </View>

      <View style={styles.locationBlock}>
        <View
          style={styles.locationChip}
          accessibilityRole="text"
          accessibilityLabel={
            locationLabel ? `Current location: ${locationLabel}` : 'Locating'
          }
        >
          <MapPin size={16} color={colors.labelSecondary} weight="regular" />
          <Text style={styles.locationChipLabel}>{locationLabel ?? 'Locating…'}</Text>
        </View>
        <Pressable
          onPress={onWrongSpot}
          accessibilityRole="link"
          accessibilityLabel="Change location"
          hitSlop={8}
        >
          <Text style={styles.wrongSpot}>Wrong spot?</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function ActionMenu({
  problem,
  locationLabel,
  locationCoords,
  shareOn,
  onBack,
  onCallPlaced,
  onTowSearchOpened,
  onShareToggle,
  onFiguredOut,
}: {
  problem: ProblemType | null;
  locationLabel: string;
  locationCoords: { latitude: number; longitude: number } | null;
  shareOn: boolean;
  onBack: () => void;
  onCallPlaced: () => void;
  onTowSearchOpened: () => void;
  onShareToggle: (next: boolean) => void;
  onFiguredOut: () => void;
}) {
  const router = useRouter();
  const { profile: roadsideProfile } = useRoadsideProfile();
  const { contact } = useTrustedContact();

  const headline = buildActionHeadline(locationLabel, problem);

  async function handleCall() {
    if (!roadsideProfile) {
      router.push('/roadside-setup');
      return;
    }
    const tel = `tel:${roadsideProfile.phoneNumber.replace(/[^\d+]/g, '')}`;
    const supported = await Linking.canOpenURL(tel);
    if (!supported) {
      Alert.alert('Cannot place call', 'This device cannot make phone calls.');
      return;
    }
    await Linking.openURL(tel);
    onCallPlaced();
  }

  async function handleTowSearch() {
    const sll = locationCoords
      ? `&sll=${locationCoords.latitude},${locationCoords.longitude}`
      : '';
    const url = `maps://?q=tow+truck${sll}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Cannot open Maps', 'Apple Maps is not available.');
      return;
    }
    await Linking.openURL(url);
    onTowSearchOpened();
  }

  function handleShareToggle(next: boolean) {
    Haptics.selectionAsync().catch(() => {});
    onShareToggle(next);
  }

  function handleShareSetup() {
    router.push('/trusted-contact-setup');
  }

  return (
    <ScrollView
      contentContainerStyle={styles.stepBody}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.backChevron, pressed && pressedDim]}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
      >
        <CaretLeft size={28} color={colors.black} weight="regular" />
      </Pressable>

      <Text style={styles.subtitle}>Got it.</Text>
      <Text style={styles.title} accessibilityRole="header">
        {headline}
      </Text>

      <View style={styles.rowList}>
        {/* Call row */}
        <Pressable
          onPress={handleCall}
          style={({ pressed }) => [styles.row, pressed && pressedDim]}
          accessibilityRole="button"
          accessibilityLabel={
            roadsideProfile
              ? `Call ${roadsideProfile.serviceName}`
              : 'Set up your roadside service'
          }
        >
          <View style={styles.iconCircle}>
            <Phone size={24} color={colors.freshgreen} weight="regular" />
          </View>
          <Text style={styles.rowLabel}>
            {roadsideProfile
              ? `Call ${roadsideProfile.serviceName}`
              : 'Set up your roadside service'}
          </Text>
          <CaretRight size={20} color={colors.labelTertiary} weight="bold" />
        </Pressable>

        {/* Tow-search row */}
        <Pressable
          onPress={handleTowSearch}
          style={({ pressed }) => [styles.row, pressed && pressedDim]}
          accessibilityRole="button"
          accessibilityLabel="Search nearby tow services"
        >
          <View style={styles.iconCircle}>
            <MapPin size={24} color={colors.freshgreen} weight="regular" />
          </View>
          <Text style={styles.rowLabel}>Search nearby tow services</Text>
          <CaretRight size={20} color={colors.labelTertiary} weight="bold" />
        </Pressable>

        {/* Share-location row */}
        {contact ? (
          <View
            style={styles.row}
            accessible
            accessibilityRole="switch"
            accessibilityState={{ checked: shareOn }}
            accessibilityLabel={`Share location with ${contact.name}`}
          >
            <View style={styles.iconCircle}>
              <ShareNetwork size={24} color={colors.freshgreen} weight="regular" />
            </View>
            <Text style={styles.rowLabel}>Share location w/ {contact.name}</Text>
            <Switch
              value={shareOn}
              onValueChange={handleShareToggle}
              trackColor={{ false: colors.cardBorderSubtle, true: colors.freshgreen }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.cardBorderSubtle}
            />
          </View>
        ) : (
          <Pressable
            onPress={handleShareSetup}
            style={({ pressed }) => [styles.row, pressed && pressedDim]}
            accessibilityRole="button"
            accessibilityLabel="Set a trusted contact"
          >
            <View style={styles.iconCircle}>
              <ShareNetwork size={24} color={colors.freshgreen} weight="regular" />
            </View>
            <Text style={styles.rowLabel}>Set a trusted contact</Text>
            <CaretRight size={20} color={colors.labelTertiary} weight="bold" />
          </Pressable>
        )}
      </View>

      <View style={styles.outlinedCtaWrap}>
        <Button
          text="I figured it out"
          type="primary"
          fill="outline"
          onPress={onFiguredOut}
          style={styles.outlinedCtaStretch}
        />
      </View>
    </ScrollView>
  );
}

function LiveStatus({
  problem,
  locationLabel,
  shareOn,
  shareToggledAtIso,
  onBackOnRoad,
  onSwitchToPulledOver,
}: {
  problem: ProblemType | null;
  locationLabel: string;
  shareOn: boolean;
  shareToggledAtIso: string | null;
  onBackOnRoad: () => void;
  onSwitchToPulledOver: () => void;
}) {
  const { profile: roadsideProfile } = useRoadsideProfile();
  const { contact } = useTrustedContact();

  const headline = roadsideProfile
    ? `${roadsideProfile.serviceName} should be on the way.`
    : 'Help is on the way. Stay where you are.';

  const problemLabel = problem
    ? PROBLEMS.find((p) => p.id === problem)?.label ?? 'Need help'
    : 'Need help';

  const sharedFacts: string[] = [problemLabel, locationLabel];
  if (shareOn && shareToggledAtIso && contact) {
    const time = new Date(shareToggledAtIso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
    sharedFacts.push(`${contact.name} was notified at ${time}`);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.stepBody}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.subtitle, { marginTop: spacing.sm }]}>Hang tight.</Text>
      <Text style={styles.title} accessibilityRole="header">
        {headline}
      </Text>

      <View style={styles.sharedCard}>
        <Text style={styles.sharedCardTitle}>What you shared</Text>
        <Text style={styles.sharedCardBody}>{sharedFacts.join(' • ')}</Text>
      </View>

      <Text style={styles.sectionLabel}>If this gets worse</Text>
      <Pressable
        onPress={onSwitchToPulledOver}
        style={({ pressed }) => [styles.row, pressed && pressedDim]}
        accessibilityRole="button"
        accessibilityLabel="Switch to Pulled-over mode"
      >
        <View style={styles.iconCircle}>
          <Siren size={24} color={colors.navy} weight="regular" />
        </View>
        <Text style={styles.rowLabel}>Switch to Pulled-over mode</Text>
        <CaretRight size={20} color={colors.labelTertiary} weight="bold" />
      </Pressable>

      <View style={styles.primaryCtaWrap}>
        <Button
          text="I'm back on the road"
          type="primary"
          fill="fill"
          onPress={onBackOnRoad}
          style={styles.primaryCtaStretch}
        />

        {shareOn && contact && <NotifyingPulse contactName={contact.name} />}
      </View>
    </ScrollView>
  );
}

/**
 * Builds the Step 2 headline. "Something else" (and any null problem,
 * defensive) falls back to a generic "need help" phrasing so we never
 * read "with a something else."
 */
function buildActionHeadline(
  locationLabel: string,
  problem: ProblemType | null,
): string {
  if (!problem || problem === 'other') {
    return `You're in ${locationLabel} and need help.`;
  }
  const phrase = PROBLEMS.find((p) => p.id === problem)?.phrase ?? '';
  return `You're in ${locationLabel} ${phrase}.`;
}

function WrongSpotModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (
    label: string,
    coords: { latitude: number; longitude: number } | null,
  ) => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    const query = text.trim();
    if (!query) return;
    setBusy(true);
    setError(null);
    try {
      const results = await Location.geocodeAsync(query);
      const hit = results[0];
      if (!hit) {
        setError("Couldn't find that address. Try again.");
        setBusy(false);
        return;
      }
      onConfirm(query, { latitude: hit.latitude, longitude: hit.longitude });
      setText('');
      setBusy(false);
    } catch (err) {
      console.warn('wrong-spot geocode failed', err);
      setError("Couldn't find that address. Try again.");
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessible={false}
        accessibilityElementsHidden
      >
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle} accessibilityRole="header">
            Where are you?
          </Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={(v) => {
              setText(v);
              setError(null);
            }}
            placeholder="Enter address or area"
            placeholderTextColor={colors.mutedSecondary}
            autoFocus
            accessibilityLabel="Address or area"
          />
          {error && <Text style={styles.modalError}>{error}</Text>}
          <Pressable
            onPress={handleConfirm}
            disabled={busy || !text.trim()}
            style={({ pressed }) => [
              styles.modalCta,
              (busy || !text.trim()) && styles.ctaDisabled,
              pressed && !(busy || !text.trim()) && pressedDim,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Confirm location"
          >
            <Text style={styles.modalCtaLabel}>Confirm</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1 },
  stepBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  subtitle: {
    ...typography.bodyRegular,
    color: colors.labelSecondary,
    marginTop: spacing.sm,
  },
  title: {
    ...typography.title2Emphasized,
    color: colors.black,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  rowList: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 60,
    gap: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.fillsTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    ...typography.bodyEmphasized,
    color: colors.black,
    flex: 1,
  },
  locationBlock: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: spacing.xl,
    gap: spacing.xs,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.fillsTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  locationChipLabel: {
    ...typography.footnoteRegular,
    color: colors.labelSecondary,
  },
  wrongSpot: {
    ...typography.footnoteRegular,
    color: colors.labelSecondary,
    textDecorationLine: 'underline',
  },
  // Wrong-spot Modal
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.lg,
    width: '100%',
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.bodyEmphasized,
    color: colors.black,
  },
  input: {
    ...typography.bodyRegular,
    color: colors.black,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalError: {
    ...typography.footnoteRegular,
    color: colors.red,
  },
  modalCta: {
    backgroundColor: colors.freshgreen,
    borderRadius: 999,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  ctaDisabled: {
    backgroundColor: colors.cardBorderSubtle,
  },
  modalCtaLabel: {
    ...typography.bodyEmphasized,
    color: colors.white,
  },
  // Step 2 — action menu
  backChevron: {
    marginTop: spacing.sm,
    width: 32,
    height: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  outlinedCtaWrap: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
  outlinedCtaStretch: {
    alignSelf: 'stretch',
  },
  // Step 3 — live status
  sharedCard: {
    backgroundColor: colors.systemGroupedBackground,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  sharedCardTitle: {
    ...typography.footnoteEmphasized,
    color: colors.black,
  },
  sharedCardBody: {
    ...typography.footnoteRegular,
    color: colors.labelSecondary,
  },
  sectionLabel: {
    ...typography.footnoteRegular,
    color: colors.labelSecondary,
    marginBottom: spacing.sm,
  },
  primaryCtaWrap: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  primaryCtaStretch: {
    alignSelf: 'stretch',
  },
});
