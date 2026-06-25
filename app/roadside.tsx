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
import { X } from 'phosphor-react-native/src/icons/X';

import { Button } from '../components/Button';
import { DragHandle } from '../components/DragHandle';
import { NotifyingPulse } from '../components/NotifyingPulse';
import { RoadsideTowPick } from '../components/RoadsideTowPick';
import { useRoadsideProfile } from '../hooks/useRoadsideProfile';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { getTrustedContact } from '../lib/api/trusted-contact';
import { notifyTrustedContact } from '../lib/notify-trusted-contact';
import { type ProblemType } from '../lib/api/roadside';
import { getErrorMessage } from '../lib/error-message';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim, tapTarget44 } from '../theme/interaction';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Step = 'problem' | 'action' | 'tow-pick' | 'status';

type ActionSource = 'membership' | 'tow' | null;

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
 * action → tow-pick → status. DragHandle on every step; chevron is internal-step
 * back nav (not sheet dismissal); Step 3 traps dismissal via
 * usePreventRemove (added in a later task). Matches /pulled-over.
 *
 * Spec: docs/archive/superpowers/specs/2026-05-31-roadside-assistance-design.md
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
  const [actionSource, setActionSource] = useState<ActionSource>(null);
  const [contactedTowName, setContactedTowName] = useState<string | null>(null);

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

  function handleBackToActions() {
    setStep('action');
  }

  function handleOpenTowPick() {
    setContactedTowName(null);
    setStep('tow-pick');
  }

  function handleMembershipCallPlaced() {
    setActionSource('membership');
    setContactedTowName(null);
    markActionTaken();
  }

  function handleTowCalled(businessName: string) {
    setActionSource('tow');
    setContactedTowName(businessName);
    markActionTaken();
  }

  function markActionTaken() {
    setActionTaken(true);
    setStep('status');
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
            onCallPlaced={handleMembershipCallPlaced}
            onOpenTowPick={handleOpenTowPick}
            onShareToggle={(next) => {
              setShareOn(next);
              if (next) {
                setShareToggledAtIso(new Date().toISOString());
                const problemLabel =
                  PROBLEMS.find((p) => p.id === problem)?.label ?? 'Need help';
                void (async () => {
                  const contact = await getTrustedContact();
                  await notifyTrustedContact(contact, {
                    flow: 'roadside',
                    reason: problemLabel,
                    locationLabel: locationLabel ?? 'Your location',
                    coordinates: locationCoords ?? undefined,
                  });
                })();
              }
            }}
            onFiguredOut={() => {
              Alert.alert(
                'All set?',
                "You'll leave roadside assistance and return to the map.",
                [
                  { text: 'Stay', style: 'cancel' },
                  {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: () => router.back(),
                  },
                ],
              );
            }}
          />
        )}
        {step === 'tow-pick' && (
          <RoadsideTowPick
            locationCoords={locationCoords}
            onBack={() => setStep('action')}
            onTowCalled={handleTowCalled}
          />
        )}
        {step === 'status' && (
          <LiveStatus
            problem={problem}
            locationLabel={locationLabel ?? 'Your location'}
            shareOn={shareOn}
            shareToggledAtIso={shareToggledAtIso}
            actionSource={actionSource}
            contactedTowName={contactedTowName}
            onBackOnRoad={() => router.back()}
            onSwitchToPulledOver={() => router.replace('/pulled-over')}
            onBackToActions={handleBackToActions}
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
      {/* Reserve the chevron's vertical footprint even though step 1
          has no back affordance — keeps the title's y-position stable
          across step 1 → step 2 transitions. */}
      <View style={styles.backChevronPlaceholder} />
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
            accessibilityHint="Selects this problem and shows roadside actions"
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
          style={styles.wrongSpotBtn}
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
  onOpenTowPick,
  onShareToggle,
  onFiguredOut,
}: {
  problem: ProblemType | null;
  locationLabel: string;
  locationCoords: { latitude: number; longitude: number } | null;
  shareOn: boolean;
  onBack: () => void;
  onCallPlaced: () => void;
  onOpenTowPick: () => void;
  onShareToggle: (next: boolean) => void;
  onFiguredOut: () => void;
}) {
  const router = useRouter();
  const { profile: roadsideProfile } = useRoadsideProfile();
  const contactState = useTrustedContact();
  const contact = contactState.ready ? contactState.contact : null;

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

  function handleOpenTowPick() {
    onOpenTowPick();
  }

  function handleShareToggle(next: boolean) {
    Haptics.selectionAsync().catch(() => {});
    onShareToggle(next);
  }

  function handleShareSetup() {
    // Setup returns via router.back() to this roadside modal on
    // Continue/Skip — that's the default since the 2026-06-01 routing
    // inversion. No `from` param needed.
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

        {/* Nearby tow list */}
        <Pressable
          onPress={handleOpenTowPick}
          style={({ pressed }) => [styles.row, pressed && pressedDim]}
          accessibilityRole="button"
          accessibilityLabel="Find a tow truck nearby"
          accessibilityHint="Shows nearby tow services you can call"
        >
          <View style={styles.iconCircle}>
            <MapPin size={24} color={colors.freshgreen} weight="regular" />
          </View>
          <Text style={styles.rowLabel}>Find a tow truck nearby</Text>
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
  actionSource,
  contactedTowName,
  onBackOnRoad,
  onSwitchToPulledOver,
  onBackToActions,
}: {
  problem: ProblemType | null;
  locationLabel: string;
  shareOn: boolean;
  shareToggledAtIso: string | null;
  actionSource: ActionSource;
  contactedTowName: string | null;
  onBackOnRoad: () => void;
  onSwitchToPulledOver: () => void;
  onBackToActions: () => void;
}) {
  const { profile: roadsideProfile } = useRoadsideProfile();
  const contactState = useTrustedContact();
  const contact = contactState.ready ? contactState.contact : null;

  const headline =
    actionSource === 'tow'
      ? 'Stay where you are. Help is on the way.'
      : roadsideProfile
        ? `${roadsideProfile.serviceName} should be on the way.`
        : 'Help is on the way. Stay where you are.';

  const problemLabel = problem
    ? PROBLEMS.find((p) => p.id === problem)?.label ?? 'Need help'
    : 'Need help';

  const contactNotifiedTime =
    shareOn && shareToggledAtIso
      ? new Date(shareToggledAtIso).toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        })
      : null;

  return (
    <ScrollView
      contentContainerStyle={styles.stepBody}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.statusTopChrome}>
        <Pressable
          onPress={onBackToActions}
          accessibilityRole="button"
          accessibilityLabel="Back to actions"
          style={({ pressed }) => [tapTarget44, pressed && pressedDim]}
        >
          <X size={24} color={colors.labelSecondary} weight="regular" />
        </Pressable>
      </View>
      <Text style={[styles.subtitle, { marginTop: spacing.sm }]}>Hang tight.</Text>
      <Text style={styles.title} accessibilityRole="header">
        {headline}
      </Text>

      <View style={styles.sharedCard}>
        <Text style={styles.sharedCardTitle}>What they know</Text>
        <View style={styles.sharedRow}>
          <Text style={styles.sharedRowLabel}>Problem</Text>
          <Text style={styles.sharedRowValue}>{problemLabel}</Text>
        </View>
        <View style={styles.sharedRow}>
          <Text style={styles.sharedRowLabel}>Location</Text>
          <Text style={styles.sharedRowValue}>{locationLabel}</Text>
        </View>
        {contactedTowName && (
          <View style={styles.sharedRow}>
            <Text style={styles.sharedRowLabel}>Contacted</Text>
            <Text style={styles.sharedRowValue}>{contactedTowName}</Text>
          </View>
        )}
        {shareOn && contact && contactNotifiedTime && (
          <View style={styles.sharedRow}>
            <Text style={styles.sharedRowLabel}>Contact</Text>
            <Text style={styles.sharedRowValue}>{contact.name} · {contactNotifiedTime}</Text>
          </View>
        )}
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
        setError(getErrorMessage('load', 'transient').body);
        setBusy(false);
        return;
      }
      onConfirm(query, { latitude: hit.latitude, longitude: hit.longitude });
      setText('');
      setBusy(false);
    } catch (err) {
      console.warn('wrong-spot geocode failed', err);
      setError(getErrorMessage('load', 'transient', err).body);
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
            placeholderTextColor={colors.labelTertiary}
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
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.modalCancelBtn,
              pressed && pressedDim,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.modalCancelLabel}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1 },
  // Drag-handle wrapper mirrors /safety's dragHandleWrapper: vertical
  // padding seats the 4pt bar in its own slot rather than slapping it
  // against the safe-area top. User-flagged 2026-06-01 — the prior
  // bare DragHandle + 16pt body paddingTop felt incredibly tight; the
  // wrapper adds 16pt above AND below the bar so the breathing room
  // is symmetric and visibly generous.
  dragHandleWrap: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  statusTopChrome: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    // tapTarget44 provides the 44pt painted floor on the Pressable.
    // The row container right-aligns it per .cursorrules ## Dismissal.
  },
  stepBody: {
    paddingHorizontal: spacing.lg,
    // Body paddingTop kept at 0 — dragHandleWrap above provides the
    // separation. Doubling up would push the title too far down.
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  // Phantom-chevron slot on step 1 (problem picker): matches the
  // backChevron's marginTop + height so the title position stays put
  // when the user advances to step 2 (action menu, which DOES have a
  // back chevron). Prevents the ~40pt title-jump on transition.
  // User-flagged 2026-06-01.
  backChevronPlaceholder: {
    marginTop: spacing.sm,
    height: 32,
  },
  // Eyebrow + title pair — mirrors /pulled-over's armed picker. The
  // eyebrow drops to title3Regular (20pt) so the size-step against
  // the 28pt title is unmistakable; the prior title1Regular eyebrow
  // (28pt) was hard to read as an eyebrow when weight was the only
  // differentiator. User-flagged 2026-06-01.
  // Header copy intentionally skips relaxedLineHeight (per design-
  // system.md §1.4 — relaxed is for stress-state long-reads, not
  // single-line headers).
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
  // Card list mirrors /pulled-over's vertical centering (flex 1 +
  // justifyContent center centers the rows in the space between the
  // title and the location footer). Gap bumped spacing.sm (8) →
  // spacing.lg (24) so the 5 problem cards read as a spaced stack
  // rather than a tight cluster. User-flagged 2026-06-01. On small
  // viewports where the cards exceed the available height the
  // ScrollView scrolls and the rows fall back to top-aligned.
  rowList: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 60,
    gap: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: colors.fillsTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    ...dynamicType(typography.bodyEmphasized),
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
    borderRadius: radii.pill,
  },
  locationChipLabel: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
  },
  wrongSpot: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
    textDecorationLine: 'underline',
  },
  // Pressable wrapper around the "Wrong spot?" text link — painted 44pt
  // floor so the link clears HIG without leaning on hitSlop (audit #10).
  // The standalone Pressable is alone on its row (not inline within a
  // paragraph), so the HIG 44pt rule applies — text-link inline carve-outs
  // don't.
  wrongSpotBtn: {
    minHeight: 44,
    justifyContent: 'center',
  },
  // Wrong-spot Modal
  scrim: {
    flex: 1,
    backgroundColor: colors.modalScrimStrong,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    width: '100%',
    gap: spacing.md,
  },
  modalTitle: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
  },
  input: {
    ...dynamicType(typography.bodyRegular),
    color: colors.black,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalError: {
    ...dynamicType(relaxedLineHeight(typography.footnoteRegular)),
    color: colors.red,
  },
  modalCta: {
    backgroundColor: colors.freshgreen,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  ctaDisabled: {
    backgroundColor: colors.cardBorderSubtle,
  },
  modalCtaLabel: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.white,
  },
  modalCancelBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelLabel: {
    ...dynamicType(typography.bodyRegular),
    color: colors.labelSecondary,
  },
  // Step 2 — action menu
  backChevron: {
    marginTop: spacing.sm,
    // Bumped 32→44 (audit #10) — 32pt + hitSlop=12 brought touch to 56 but
    // painted target was below the HIG 44pt floor (and .cursorrules
    // forbids hitSlop as the compliance mechanism). alignItems flex-start
    // keeps the caret left-anchored so the visual placement on the row
    // doesn't shift; the 28pt CaretLeft now centers vertically inside.
    width: 44,
    height: 44,
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
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  sharedCardTitle: {
    ...dynamicType(typography.footnoteEmphasized),
    color: colors.black,
  },
  sharedRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  sharedRowLabel: {
    ...dynamicType(typography.footnoteEmphasized),
    color: colors.labelTertiary,
    width: 64,
  },
  sharedRowValue: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelSecondary,
    flex: 1,
  },
  sectionLabel: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.black,
    marginTop: spacing.lg,
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
