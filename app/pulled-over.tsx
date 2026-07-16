import { usePreventRemove } from '@react-navigation/native';
import { type NavigationAction } from '@react-navigation/routers';
// Phosphor deep-imports — see app/trusted-contact-setup.tsx for the
// longer note on why we bypass the package's barrel index. SpeakerHigh
// + Stop align this screen's audio-control register with /recordings
// (which uses Phosphor Play/Pause/Microphone for the same recording
// data); UserPlus is the canonical "add a person" affordance per
// docs/architecture.md (contact phase) and matches /trusted-contact-setup.
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Lock } from 'phosphor-react-native/src/icons/Lock';
import { ChatCircle } from 'phosphor-react-native/src/icons/ChatCircle';
import { Phone } from 'phosphor-react-native/src/icons/Phone';
import { SpeakerHigh } from 'phosphor-react-native/src/icons/SpeakerHigh';
import { Stop } from 'phosphor-react-native/src/icons/Stop';
import { UserPlus } from 'phosphor-react-native/src/icons/UserPlus';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Image,
  Linking,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import TrooperHatBadge from '../assets/illustrations/trooper-hat-badge.svg';
import { DragHandle } from '../components/DragHandle';
import { MetaSeparator } from '../components/MetaSeparator';
import { PulledOverRecordingCard } from '../components/PulledOverRecordingCard';
import { RecordingSaveErrorBanner } from '../components/RecordingSaveErrorBanner';
import { TrustedContactStatus } from '../components/TrustedContactStatus';
import { useDisclosureDuty } from '../hooks/useDisclosureDuty';
import { useInsuranceProfile } from '../hooks/useInsuranceProfile';
import { usePulseOpacity } from '../hooks/usePulseOpacity';
import { useRecordings } from '../hooks/useRecordings';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useTrustedContact } from '../hooks/useTrustedContact';
import {
  FIREARM_GUIDANCE,
  type DisclosureDuty,
  type SayBullet,
} from '../lib/api/gun-laws';
import type { AddRecordingInput } from '../lib/api/recordings';
import { maskPolicyNumber } from '../lib/api/insurance';
import { getErrorMessage } from '../lib/error-message';
import {
  persistRecordingInput,
  stopAndPersistRecording,
  type RecordingStatus,
} from '../lib/recording-session';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim, tapTarget44 } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { safetyCardHeight, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Pulled Over — the entire pulled-over safety flow in one modal.
 *
 * Previously this flow was four stacked modals
 * (/armed-or-not → /recording → /contact → /review-guidance). Each one
 * had its own swipe-down dismissal, so getting back to /home after a
 * stressful event meant peeling off four layers. Bad UX, especially
 * for a post-stop reflective flow that should feel like one held
 * conversation.
 *
 * Consolidation: same content, single modal envelope, internal state
 * machine moves between phases. One swipe-down exits the whole flow.
 *
 * Phases:
 *   armed       — Are you armed? (3 answer cards)
 *   transition  — "We'll walk you through what to do." (auto 3s → guidance)
 *   guidance    — "Read the following" bullets + persistent recording
 *                 widget with live waveform (real mic metering via
 *                 expo-audio) + Read aloud (expo-speech) + Continue
 *   contact     — Trusted contact screen (Call/Text + Review-guidance link).
 *                 Outer avatar ring pulses to mirror the "live/connected"
 *                 status the trusted-contact dot conveys elsewhere.
 *   review      — 5 sub-views via reviewIndex (Officer/Trooper → Do →
 *                 Have → Say → Know), chevron navigation
 *
 * Recording lifecycle: starts on the user's first armed answer (i.e.
 * leaving the 'armed' phase) and runs until the user stops it or the
 * modal dismisses. The recording widget is *displayed* only on the
 * guidance phase, while a truthful chip follows active recording into
 * the contact and review phases.
 *
 * If the user denies microphone permission (or startup fails), guidance
 * remains available without showing a recording timer or protected-state
 * affordance. Save success is shown only after the local persistence
 * mutation resolves.
 *
 * Route: /pulled-over
 * Entry: tap "I was pulled over" on /safety
 *
 * Figma nodes (per phase):
 *   armed             — 825:4034
 *   transition        — 825:4100
 *   guidance          — 825:4238
 *   contact           — 825:4791
 *   review (officer)  — 825:3957
 *   review (do)       — 825:4386
 *   review (have)     — 825:4533
 *   review (say)      — 825:4599
 *   review (know)     — 825:4724
 */

type ArmedAnswer = 'yes' | 'no' | 'preferred-not-to-answer';
type Phase = 'armed' | 'transition' | 'guidance' | 'contact' | 'review';

type AnswerCard = {
  id: ArmedAnswer;
  title: string;
  subtitle?: string;
};

const ANSWERS: AnswerCard[] = [
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
    id: 'preferred-not-to-answer',
    title: 'Prefer not to answer',
  },
];

const REVIEW_VIEW_COUNT = 5;

// Fallback display when no trusted contact has been set yet (user
// skipped the onboarding step). The avatar block becomes a tap target
// that opens the contact picker — "out of luck" is a worse outcome
// than asking the user to pick mid-stop.
const NO_CONTACT_NAME = 'Add a contact';

// --- Waveform tuning -----------------------------------------------------
// Number of bars rendered, polling interval for new metering samples, and
// the dB → bar-height mapping. Voice typically registers around -40 to
// -10 dB; silence sits at -60 or below.

const WAVEFORM_BAR_COUNT = 48;
const WAVEFORM_POLL_MS = 80;
const METERING_FLOOR_DB = -60;

// --- Main component ------------------------------------------------------

export default function PulledOver() {
  const router = useRouter();
  const navigation = useNavigation();
  // Lifted from ContactView so TrustedContactStatus (rendered by the
  // parent below, across armed/transition/guidance phases) can gate its
  // render on contact-set state. Per audit 2026-05-31 §/pulled-over F1,
  // the prior unconditional render claimed active notification while
  // none existed — the gated render + forward-looking copy closes the
  // honesty gap.
  const contactState = useTrustedContact();
  const contact = contactState.ready ? contactState.contact : null;
  const [phase, setPhase] = useState<Phase>('armed');
  const [armed, setArmed] = useState<ArmedAnswer | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [meteringHistory, setMeteringHistory] = useState<number[]>(() =>
    new Array(WAVEFORM_BAR_COUNT).fill(METERING_FLOOR_DB),
  );
  // P6: reduce-motion gates the live waveform animation. Was the only
  // animation in the app NOT gated; now respects the system preference.
  // Per DESIGN.md Reduce-Motion-Honest Rule.
  const reduceMotion = useReduceMotion();
  const [recordingStatus, setRecordingStatus] =
    useState<RecordingStatus>('idle');
  const recordingStatusRef = useRef<RecordingStatus>('idle');
  const updateRecordingStatus = useCallback((next: RecordingStatus) => {
    recordingStatusRef.current = next;
    setRecordingStatus(next);
  }, []);
  const [isRetryingSave, setIsRetryingSave] = useState(false);
  const [pendingNavVersion, setPendingNavVersion] = useState(0);
  const hasProtectedAudio =
    recordingStatus === 'recording' ||
    recordingStatus === 'saving' ||
    recordingStatus === 'save-error';

  const { add } = useRecordings();
  // Mutation wrapper for the recording-save persist — see
  // RecordingSaveErrorBanner for the UX rationale. We hold onto the
  // input that produced the failure (so Retry can replay it) and the
  // deferred nav action (so success or explicit-dismiss can resume the
  // back-navigation the user originally requested).
  //
  // `add` from useRecordings is already a Mutation object (run/status/
  // error/reset) — aliasing preserves all the banner's existing reads.
  const saveRecordingMutation = add;
  const lastRecordingSaveInputRef = useRef<AddRecordingInput | null>(null);
  const pendingNavRef = useRef<{
    action: NavigationAction;
    ownerGeneration: number;
  } | null>(null);
  const navigationIntentGenerationRef = useRef(0);
  const activeNavigationIntentGenerationRef = useRef(0);
  const consumedNavigationIntentGenerationRef = useRef(0);
  const recordingOperationGenerationRef = useRef(0);
  const saveInFlightRef = useRef(false);
  // State-aware firearm guidance — variant resolved from the device's
  // current state via reverse-geocoding. Defaults to 'duty-to-inform'
  // while loading or on any failure path; see `useDisclosureDuty`
  // for the safer-default rationale. The downstream views render
  // duty-to-inform copy while `loading === true`, so the brief delay
  // between mount and state-resolution is invisible to the user.
  const { duty: disclosureDuty, stateName: disclosureStateName } = useDisclosureDuty();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks whether we've already kicked off the recorder. The lifecycle
  // effect below is keyed on `phase` (so it can fire once we leave
  // armed), but every subsequent phase change would otherwise re-trigger
  // it and try to start an already-recording recorder — which throws on
  // iOS. This ref is the "started exactly once" latch.
  const hasStartedRecordingRef = useRef(false);
  // Refs capture the metadata snapshot at recording start so the shared
  // save coordinator can persist the right armed context + timestamp
  // even after `armed` state is gone.
  const recordingArmedRef = useRef<ArmedAnswer | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);

  // Set up the audio recorder. Spreading HIGH_QUALITY with
  // isMeteringEnabled lets us read the input level (dB) for the live
  // waveform. The actual recorder is started/stopped imperatively in
  // the effect below — the hook just gives us the instance.
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(recorder, WAVEFORM_POLL_MS);

  // Conservative default: show firearm advice unless the user explicitly
  // said "no". 'preferred-not-to-answer' falls under the same conservative
  // bucket as 'yes' so the guidance assumes a firearm may be present.
  const showFirearmGuidance =
    armed === 'yes' || armed === 'preferred-not-to-answer';
  const shouldStartRecording = phase !== 'armed';

  // Recording timer follows the truthful recorder state. Permission denial,
  // startup failure, saving, and saved states never keep a false timer alive.
  useEffect(() => {
    if (recordingStatus !== 'recording') return;
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [recordingStatus]);

  // Transition → guidance is now user-initiated (explicit Continue
  // button) per WCAG 2.2.1 Timing Adjustable. The prior 3-second
  // auto-advance removed user control during the most stressful
  // moment — replaced with an indefinite wait + prominent CTA.

  // VoiceOver focus management — announce each phase change so the
  // screen reader user gets verbal confirmation that the flow has
  // moved forward, even if their cursor stayed on a now-stale element
  // from the previous phase. Apple HIG recommends moving focus when
  // content changes meaningfully (WCAG 2.4.3 Focus Order); on a
  // stress-time flow where the user can't visually track changes,
  // this is more important than usual. announceForAccessibility is
  // the right primitive here vs. setAccessibilityFocus — it speaks
  // the phase identity immediately without disrupting the user's
  // navigation cursor or merging child elements into one a11y group.
  useEffect(() => {
    const phaseAnnouncements: Record<Phase, string> = {
      armed: 'Are you armed?',
      transition: "We'll walk you through what to do",
      guidance: 'Guidance for the stop',
      contact: 'Trusted contact',
      review: 'Reviewing guidance',
    };
    AccessibilityInfo.announceForAccessibility(phaseAnnouncements[phase]);
  }, [phase]);

  // Audio recording lifecycle: request mic permission and start the
  // recorder when the user first leaves the armed phase. Guarded by
  // hasStartedRecordingRef so subsequent phase changes (transition →
  // guidance → contact → review) don't re-invoke prepareToRecord/record
  // on an already-recording recorder. Errors are soft-failed — if
  // permission is denied or recording errors, the rest of the flow
  // works fine; the waveform just stays at its baseline.
  useEffect(() => {
    if (!shouldStartRecording) return;
    if (hasStartedRecordingRef.current) return;
    let cancelled = false;
    hasStartedRecordingRef.current = true;
    if (cancelled) return;
    updateRecordingStatus('requesting-permission');
    (async () => {
      try {
        const permission = await requestRecordingPermissionsAsync();
        if (cancelled) return;
        if (!permission.granted) {
          if (cancelled) return;
          updateRecordingStatus('unavailable');
          if (cancelled) return;
          console.warn('Microphone permission not granted; waveform disabled');
          return;
        }
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        if (cancelled) return;
        await recorder.prepareToRecordAsync();
        if (cancelled) return;
        recorder.record();
        if (cancelled) return;
        recordingArmedRef.current = armed;
        recordingStartedAtRef.current = Date.now();
        if (cancelled) return;
        updateRecordingStatus('recording');
        if (cancelled) return;
        AccessibilityInfo.announceForAccessibility('Recording started.');
      } catch (err) {
        if (cancelled) return;
        // Group B: surface to the user. They think recording is happening; if
        // it isn't, they need to know NOW. Recordings + permanent maps to
        // "Couldn't start recording / Try a different microphone or restart."
        updateRecordingStatus('unavailable');
        if (cancelled) return;
        const { title, body } = getErrorMessage('recordings', 'permanent', err);
        if (cancelled) return;
        Alert.alert(title, body);
      }
    })();
    return () => {
      cancelled = true;
    };
    // recorder identity is stable from the hook; intentionally not in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldStartRecording]);

  const queueNavigationIntent = useCallback(
    (action: NavigationAction, ownerGeneration: number) => {
      if (
        activeNavigationIntentGenerationRef.current !== ownerGeneration ||
        consumedNavigationIntentGenerationRef.current === ownerGeneration
      ) {
        return;
      }
      pendingNavRef.current = { action, ownerGeneration };
      setPendingNavVersion((version) => version + 1);
    },
    [],
  );

  const cancelNavigationIntent = useCallback((ownerGeneration: number) => {
    if (activeNavigationIntentGenerationRef.current !== ownerGeneration) return;
    pendingNavRef.current = null;
    setPendingNavVersion((version) => version + 1);
  }, []);

  const saveCurrentRecording = useCallback(
    async (action?: NavigationAction, ownerGeneration?: number) => {
      if (action && ownerGeneration != null) {
        queueNavigationIntent(action, ownerGeneration);
      }
      if (
        recordingStatusRef.current === 'saved' ||
        recordingStatusRef.current === 'discarded'
      ) {
        return;
      }
      const startedAt = recordingStartedAtRef.current;
      if (startedAt == null) {
        updateRecordingStatus('save-error');
        return;
      }
      if (saveInFlightRef.current) return;

      const operationGeneration =
        ++recordingOperationGenerationRef.current;
      saveInFlightRef.current = true;
      updateRecordingStatus('saving');
      AccessibilityInfo.announceForAccessibility('Saving recording.');
      const result = await stopAndPersistRecording({
        recorder,
        startedAt,
        armed: recordingArmedRef.current,
        persist: saveRecordingMutation.run,
      });
      if (recordingOperationGenerationRef.current !== operationGeneration) return;
      saveInFlightRef.current = false;

      if (!result.ok) {
        lastRecordingSaveInputRef.current = result.retryInput ?? null;
        updateRecordingStatus('save-error');
        AccessibilityInfo.announceForAccessibility(
          'Recording could not be saved. Retry or discard the recording.',
        );
        return;
      }

      lastRecordingSaveInputRef.current = null;
      updateRecordingStatus('saved');
      AccessibilityInfo.announceForAccessibility('Recording saved.');
    },
    [
      queueNavigationIntent,
      recorder,
      saveRecordingMutation.run,
      updateRecordingStatus,
    ],
  );

  const retryRecordingSave = useCallback(async (
    action?: NavigationAction,
    ownerGeneration?: number,
  ) => {
    if (action && ownerGeneration != null) {
      queueNavigationIntent(action, ownerGeneration);
    }
    if (saveInFlightRef.current) return;
    const retryInput = lastRecordingSaveInputRef.current;
    if (!retryInput) {
      setIsRetryingSave(true);
      await saveCurrentRecording(action, ownerGeneration);
      setIsRetryingSave(false);
      return;
    }

    const operationGeneration = ++recordingOperationGenerationRef.current;
    saveInFlightRef.current = true;
    setIsRetryingSave(true);
    updateRecordingStatus('saving');
    AccessibilityInfo.announceForAccessibility('Saving recording.');
    const result = await persistRecordingInput(
      retryInput,
      saveRecordingMutation.run,
    );
    if (recordingOperationGenerationRef.current !== operationGeneration) return;
    saveInFlightRef.current = false;
    setIsRetryingSave(false);

    if (!result.ok) {
      lastRecordingSaveInputRef.current = result.retryInput ?? retryInput;
      updateRecordingStatus('save-error');
      AccessibilityInfo.announceForAccessibility(
        'Recording could not be saved. Retry or discard the recording.',
      );
      return;
    }

    lastRecordingSaveInputRef.current = null;
    updateRecordingStatus('saved');
    AccessibilityInfo.announceForAccessibility('Recording saved.');
  }, [
    queueNavigationIntent,
    saveCurrentRecording,
    saveRecordingMutation.run,
    updateRecordingStatus,
  ]);

  const discardCurrentRecording = useCallback(async (
    action?: NavigationAction,
    ownerGeneration?: number,
  ) => {
    if (action && ownerGeneration != null) {
      queueNavigationIntent(action, ownerGeneration);
    }
    recordingOperationGenerationRef.current += 1;
    if (recorder.isRecording) {
      try {
        await recorder.stop();
      } catch {
        // The user explicitly chose permanent discard. Continue disarming the
        // screen even if the native recorder is already unavailable.
      }
    }
    saveRecordingMutation.reset();
    saveInFlightRef.current = false;
    setIsRetryingSave(false);
    lastRecordingSaveInputRef.current = null;
    recordingStartedAtRef.current = null;
    recordingArmedRef.current = null;
    updateRecordingStatus('discarded');
  }, [
    queueNavigationIntent,
    recorder,
    saveRecordingMutation.reset,
    updateRecordingStatus,
  ]);

  useEffect(() => {
    if (recordingStatus !== 'saved' && recordingStatus !== 'discarded') return;
    const pending = pendingNavRef.current;
    if (!pending) return;
    if (
      pending.ownerGeneration !==
        activeNavigationIntentGenerationRef.current ||
      consumedNavigationIntentGenerationRef.current === pending.ownerGeneration
    ) {
      return;
    }
    pendingNavRef.current = null;
    consumedNavigationIntentGenerationRef.current = pending.ownerGeneration;
    navigation.dispatch(pending.action);
  }, [navigation, pendingNavVersion, recordingStatus]);

  // Stop the recorder and persist the captured audio when the user
  // dismisses the modal.
  //
  // We use `usePreventRemove` rather than a useEffect cleanup because
  // at unmount time `useAudioRecorder`'s own cleanup races ours and
  // disposes the native recorder shared object — accessing
  // recorder.uri / .stop() from inside an unmount cleanup throws
  // NativeSharedObjectNotFound. usePreventRemove fires while the
  // screen is still mounted and the recorder is still alive, then we
  // dispatch the original action to let the dismiss complete.
  //
  // We picked usePreventRemove over navigation.addListener('beforeRemove')
  // because native-stack's gesture dismiss removes the screen natively
  // before JS can intercept; addListener + preventDefault gets a
  // "screen was removed natively but didn't get removed from JS state"
  // warning. usePreventRemove is the supported pattern for this case.
  usePreventRemove(hasProtectedAudio, ({ data }) => {
    const ownerGeneration = ++navigationIntentGenerationRef.current;
    activeNavigationIntentGenerationRef.current = ownerGeneration;
    const operationGeneration = recordingOperationGenerationRef.current;
    const confirmDiscardAndLeave = (keepLabel: string) => {
      Alert.alert(
        'Discard this recording?',
        'This permanently discards the recording. Leave this screen?',
        [
          {
            text: keepLabel,
            style: 'cancel',
            onPress: () => cancelNavigationIntent(ownerGeneration),
          },
          {
            text: 'Discard & leave',
            style: 'destructive',
            onPress: () => {
              void discardCurrentRecording(data.action, ownerGeneration);
            },
          },
        ],
      );
    };

    if (recordingStatus === 'saving') {
      Alert.alert(
        'Saving recording',
        'Saving is underway. You can stay here or leave automatically after it finishes.',
        [
          {
            text: 'Stay',
            style: 'cancel',
            onPress: () => cancelNavigationIntent(ownerGeneration),
          },
          {
            text: 'Leave after saving',
            onPress: () => {
              const status = recordingStatusRef.current;
              const isTerminal = status === 'saved' || status === 'discarded';
              if (
                !isTerminal &&
                recordingOperationGenerationRef.current !== operationGeneration
              ) {
                return;
              }
              queueNavigationIntent(data.action, ownerGeneration);
            },
          },
        ],
      );
      return;
    }

    if (recordingStatus === 'save-error') {
      Alert.alert(
        'Recording not saved',
        'Retry saving before leaving, or discard the recording permanently.',
        [
          {
            text: 'Stay',
            style: 'cancel',
            onPress: () => cancelNavigationIntent(ownerGeneration),
          },
          {
            text: 'Discard & leave',
            style: 'destructive',
            onPress: () => confirmDiscardAndLeave('Keep trying'),
          },
          {
            text: 'Retry & leave',
            onPress: () => {
              void retryRecordingSave(data.action, ownerGeneration);
            },
          },
        ],
      );
      return;
    }

    Alert.alert(
      'Recording in progress',
      'Save the recording before leaving, or discard it permanently.',
      [
        {
          text: 'Stay',
          style: 'cancel',
          onPress: () => cancelNavigationIntent(ownerGeneration),
        },
        {
          text: 'Discard & leave',
          style: 'destructive',
          onPress: () => confirmDiscardAndLeave('Keep recording'),
        },
        {
          text: 'Save & leave',
          onPress: () => {
            void saveCurrentRecording(data.action, ownerGeneration);
          },
        },
      ],
    );
  });

  // Sample metering into a circular buffer. Each tick: push the latest
  // dB value, drop the oldest. Renders as a left-to-right scrolling
  // waveform (newest on the right).
  //
  // Heartbeat dep: durationMillis. We *don't* depend on metering itself
  // because metering can stay at a constant value across ticks (or be
  // undefined entirely) — that would mean the effect never re-runs and
  // the buffer stalls. durationMillis ticks up every WAVEFORM_POLL_MS
  // while recording, so it's the reliable cadence signal.
  useEffect(() => {
    if (phase !== 'guidance' || recordingStatus !== 'recording') return;
    // P6: short-circuit the metering buffer updates when reduce-motion
    // is enabled — the Waveform component renders all bars at floor
    // regardless of history when reduceMotion is true, so skipping the
    // setState also avoids the per-tick re-renders that the metering
    // poll would otherwise drive.
    if (reduceMotion) return;
    setMeteringHistory((prev) => {
      const next = prev.slice(1);
      // metering may be undefined on the first tick, before the
      // recorder has produced any samples, or if the platform doesn't
      // expose it. Fall back to floor (silent) so the bar reads as a
      // flat baseline rather than a NaN.
      const sample =
        typeof recorderState.metering === 'number'
          ? recorderState.metering
          : METERING_FLOOR_DB;
      next.push(sample);
      return next;
    });
  }, [
    phase,
    recorderState.durationMillis,
    recorderState.metering,
    recordingStatus,
    reduceMotion,
  ]);

  // Stop any in-progress speech when leaving guidance phase, since the
  // Read-aloud button only exists there. Without this the speech would
  // keep narrating bullets into the contact / review screens.
  useEffect(() => {
    if (phase !== 'guidance') {
      Speech.stop();
    }
    return () => {
      Speech.stop();
    };
  }, [phase]);

  function handleAnswer(answer: ArmedAnswer) {
    // Heavy impact for the armed answer — this is the moment the
    // safety flow turns from "what's happening" into "what to do."
    // The physical thump cues the user that their answer landed and
    // the app is now actively helping them, not just listening.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setArmed(answer);
    setPhase('transition');
  }

  function handleContinueToContact() {
    Haptics.selectionAsync().catch(() => {});
    setPhase('contact');
  }

  function handleReviewGuidance() {
    setReviewIndex(0);
    setPhase('review');
  }

  function handleReviewNext() {
    if (reviewIndex < REVIEW_VIEW_COUNT - 1) {
      setReviewIndex(reviewIndex + 1);
    }
  }

  function handleReviewBack() {
    if (reviewIndex > 0) setReviewIndex(reviewIndex - 1);
  }

  const handleStopRecording = useCallback(() => {
    void saveCurrentRecording();
  }, [saveCurrentRecording]);

  function handleClose() {
    router.back();
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.dragWrapper}>
          <DragHandle />
          {hasProtectedAudio && (
            <View style={styles.lockBadge} accessibilityLabel="Sheet locked while recording">
              <Lock size={14} color={colors.labelTertiary} weight="bold" />
            </View>
          )}
        </View>

        {/*
          Highest-stakes silent-fail surface in the app: the recording
          save failed and the user is still on /pulled-over (deferred
          nav). Banner pins until Retry succeeds or explicit dismiss-
          with-confirm. See RecordingSaveErrorBanner for the P-C
          pattern rationale (Phase 1's tail).
        */}
        {(recordingStatus === 'save-error' || isRetryingSave) && (
          <RecordingSaveErrorBanner
            pending={isRetryingSave}
            onRetry={() => {
              void retryRecordingSave();
            }}
            onDismiss={() => {
              void discardCurrentRecording();
            }}
          />
        )}

        {recordingStatus === 'saving' &&
          !isRetryingSave &&
          (phase === 'contact' || phase === 'review') && (
            <View style={styles.savingStatus} accessibilityLiveRegion="polite">
              <Text style={styles.savingStatusTitle}>Saving recording</Text>
              <Text style={styles.savingStatusDetail}>Keep this screen open</Text>
            </View>
          )}

        {/*
          Persistent recording chip — only on phases where the recording
          widget itself isn't visible. Without this, recording vanishes
          from the UI the moment the user taps Continue, even though the
          recorder keeps running. Honors the "don't make recording feel
          like a black box" concern: a small inline indicator with the
          live timer sits above the phase content for the rest of the
          flow. Hidden on guidance because the full widget is there.
        */}
        {recordingStatus === 'recording' &&
          (phase === 'contact' || phase === 'review') && (
            <RecordingChip elapsed={elapsed} />
          )}

        <View style={styles.phaseContainer}>
          {phase === 'armed' && <ArmedView onAnswer={handleAnswer} />}
          {phase === 'transition' && (
            <TransitionView
              recordingStatus={recordingStatus}
              onSkip={() => setPhase('guidance')}
            />
          )}
          {phase === 'guidance' && (
            <GuidanceView
              showFirearmGuidance={showFirearmGuidance}
              disclosureDuty={disclosureDuty}
              stateName={disclosureStateName}
              elapsed={elapsed}
              meteringHistory={meteringHistory}
              reduceMotion={reduceMotion}
              recordingStatus={recordingStatus}
              onContinue={handleContinueToContact}
              onStopRecording={handleStopRecording}
            />
          )}
          {phase === 'contact' && (
            <ContactView onReviewGuidance={handleReviewGuidance} />
          )}
          {phase === 'review' && (
            <ReviewView
              index={reviewIndex}
              showFirearmGuidance={showFirearmGuidance}
              disclosureDuty={disclosureDuty}
              stateName={disclosureStateName}
              onNext={handleReviewNext}
              onBack={handleReviewBack}
              // "Close" on review now returns to the contact phase
              // rather than dismissing the entire modal. Trauma-
              // informed UX: a user reading the guidance might realize
              // they need to call their trusted contact mid-read; with
              // the prior behavior they'd have to dismiss the safety
              // modal entirely and reopen, restarting the recording
              // flow. Now the in-modal back is preserved; full modal
              // exit is via the iOS swipe-down gesture (handled by the
              // Stack.Screen presentation: 'modal').
              onClose={() => setPhase('contact')}
            />
          )}
        </View>

        {/*
          TrustedContactStatus is the persistent indicator across phases.
          Hidden on review (its own footer with chevrons + Close) and on
          contact (the screen IS about the trusted contact — repeating
          the status under it is noise). Also returns null internally
          when no contact is configured — see audit 2026-05-31 §/pulled-
          over F1 for the honesty rationale.
        */}
        {(phase === 'armed' ||
          phase === 'transition' ||
          phase === 'guidance') && <TrustedContactStatus contact={contact} />}
      </SafeAreaView>
    </View>
  );
}

// --- Phase: Armed --------------------------------------------------------

function ArmedView({ onAnswer }: { onAnswer: (a: ArmedAnswer) => void }) {
  return (
    <ScrollView
      contentContainerStyle={armedStyles.page}
      showsVerticalScrollIndicator={false}
    >
      <View style={armedStyles.titleBlock}>
        <Text style={armedStyles.eyebrow} maxFontSizeMultiplier={2}>
          Ok. Got it.
        </Text>
        <Text style={armedStyles.title} maxFontSizeMultiplier={2}>
          Are you armed?
        </Text>
      </View>

      <View style={armedStyles.answersWrapper}>
        {ANSWERS.map((answer) => (
          <Pressable
            key={answer.id}
            style={({ pressed }) => [
              armedStyles.answerCard,
              pressed && pressedDim,
            ]}
            onPress={() => onAnswer(answer.id)}
            accessibilityRole="button"
            accessibilityLabel={
              answer.subtitle
                ? `${answer.title} — ${answer.subtitle}`
                : answer.title
            }
          >
            <View style={armedStyles.answerContent}>
              <Text
                style={armedStyles.answerTitle}
                maxFontSizeMultiplier={2}
              >
                {answer.title}
              </Text>
              {answer.subtitle && (
                <Text
                  style={armedStyles.answerSubtitle}
                  maxFontSizeMultiplier={2}
                >
                  {answer.subtitle}
                </Text>
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

// --- Phase: Transition ---------------------------------------------------

function TransitionView({
  recordingStatus,
  onSkip,
}: {
  recordingStatus: RecordingStatus;
  onSkip: () => void;
}) {
  const [recordingTitle, recordingDetail] =
    recordingStatus === 'recording'
      ? ['Recording started', 'For your safety.']
      : recordingStatus === 'unavailable'
        ? ['Microphone unavailable', 'Guidance is still ready']
        : recordingStatus === 'saving'
          ? ['Saving your recording', 'Keep this screen open.']
          : recordingStatus === 'saved'
            ? ['Recording saved', 'Guidance is still ready']
            : recordingStatus === 'save-error'
              ? ['Recording needs attention', 'Retry or discard before leaving.']
              : recordingStatus === 'discarded'
                ? ['Recording discarded', 'Guidance is still ready']
                : ['Preparing your recording', 'For your safety.'];
  // User-controlled advance (WCAG 2.2.1): the screen waits
  // indefinitely for the user to tap Continue. Pace control during
  // stress is one of the strongest predictors of self-regulation per
  // Stanford's Trauma & Resilience Lab — an explicit button is
  // clearer than tap-anywhere and removes the auto-advance timer
  // that took control away from the user.
  return (
    <View style={transitionStyles.center}>
      <View style={transitionStyles.textBlock}>
        <Text style={transitionStyles.title}>
          We'll walk you{'\n'}through what to do.
        </Text>
        <View>
          <Text style={transitionStyles.subtitle}>{recordingTitle}</Text>
          <Text style={transitionStyles.subtitle}>{recordingDetail}</Text>
        </View>
      </View>

      <Pressable
        onPress={onSkip}
        accessibilityRole="button"
        accessibilityLabel="Continue to guidance"
        style={({ pressed }) => [
          transitionStyles.continueBtn,
          pressed && pressedDim,
        ]}
      >
        <Text style={transitionStyles.continueBtnText}>Continue</Text>
      </Pressable>
    </View>
  );
}

// --- Phase: Guidance -----------------------------------------------------

function GuidanceBullet({ children }: { children: ReactNode }) {
  // Stress-readable + Dynamic-Type-aware. Guidance bullets are the
  // longest reads in the app, happening during the most stressful
  // moment — apply both the user's iOS Dynamic Type setting AND a
  // 1.6× line-height ratio per Carter et al. 1998 cognitive-load
  // research (validated by NN Group). The bullet dot Text gets the
  // same scaled style so the dot glyph stays vertically aligned with
  // the wrapped paragraph it labels.
  const scaledStyle = dynamicType(relaxedLineHeight(typography.title3Regular));
  return (
    <View style={guidanceStyles.bulletRow}>
      <Text style={[guidanceStyles.bulletDot, scaledStyle]}>•</Text>
      <Text style={[guidanceStyles.bulletText, scaledStyle]}>{children}</Text>
    </View>
  );
}

function GuidanceView({
  showFirearmGuidance,
  disclosureDuty,
  stateName,
  elapsed,
  meteringHistory,
  reduceMotion,
  recordingStatus,
  onContinue,
  onStopRecording,
}: {
  showFirearmGuidance: boolean;
  disclosureDuty: DisclosureDuty;
  stateName: string | null;
  elapsed: number;
  meteringHistory: number[];
  reduceMotion: boolean;
  recordingStatus: RecordingStatus;
  onContinue: () => void;
  onStopRecording: () => void;
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  // useMemo: bullet list shouldn't be rebuilt every render — the
  // showFirearmGuidance + disclosureDuty values are stable for the
  // life of the modal once the location has resolved. The firearm
  // bullet's copy comes from `FIREARM_GUIDANCE` (gun-laws adapter),
  // keyed on the user's state's disclosure duty — duty-to-inform,
  // no-duty, or asked-only. Same record is consumed by the What-to-
  // Say review sub-view below so the two surfaces never drift.
  const bulletLines = useMemo<string[]>(
    () => [
      'Pull over safely in a well lit place',
      ...(showFirearmGuidance
        ? [FIREARM_GUIDANCE[disclosureDuty].guidanceBullet]
        : []),
      'Provide all necessary documentation',
      "You don't have to consent to a search",
    ],
    [showFirearmGuidance, disclosureDuty],
  );

  const handleReadAloud = useCallback(() => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    bulletLines.forEach((line, i) => {
      Speech.speak(line, {
        rate: 0.95,
        onDone:
          i === bulletLines.length - 1
            ? () => setIsSpeaking(false)
            : undefined,
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    });
  }, [bulletLines, isSpeaking]);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  return (
    <View style={guidanceStyles.page}>
      <View style={guidanceStyles.titleBlock}>
        <Text style={guidanceStyles.eyebrow}>We can help</Text>
        <Text style={guidanceStyles.title}>Read the following</Text>
      </View>

      <ScrollView
        style={guidanceStyles.scrollArea}
        contentContainerStyle={guidanceStyles.scrollContent}
        showsVerticalScrollIndicator
        bounces={false}
      >
      {/*
        Structured bullets — flex row with dot + text columns rather than
        an inline `•{"  "}{text}`. Matches the indent and wrap behavior
        of Figma's `<li class="list-disc ms-[30px]">` more faithfully:
        the bullet character has its own column, multi-line text wraps
        flush with the first line. Same pattern review-guidance uses.
      */}
      <View style={guidanceStyles.bullets}>
        {bulletLines.map((line) => (
          <GuidanceBullet key={line}>{line}</GuidanceBullet>
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [
          guidanceStyles.readAloudRow,
          pressed && pressedDim,
        ]}
        onPress={handleReadAloud}
        accessibilityRole="button"
        accessibilityLabel={isSpeaking ? 'Stop reading aloud' : 'Read aloud'}
        // P5: hitSlop removed — the row now paints at 56pt via the
        // bumped paddingVertical: 12 in guidanceStyles.readAloudRow,
        // so the visual is the affordance (no longer relying on an
        // invisible touch-area extension).
      >
        {isSpeaking ? (
          <Stop size={32} color={colors.labelTertiary} />
        ) : (
          <SpeakerHigh size={32} color={colors.labelTertiary} />
        )}
        <Text style={guidanceStyles.readAloudText}>
          {isSpeaking ? 'Stop' : 'Read aloud'}
        </Text>
      </Pressable>

      <PulledOverRecordingCard
        status={recordingStatus}
        elapsed={elapsed}
        meteringHistory={meteringHistory}
        reduceMotion={reduceMotion}
        onStopRecording={onStopRecording}
      />
      </ScrollView>

      <Pressable
        onPress={onContinue}
        accessibilityRole="button"
        accessibilityLabel="Continue to trusted contact"
        style={({ pressed }) => [
          guidanceStyles.continueBtn,
          pressed && pressedDim,
        ]}
      >
        <Text style={guidanceStyles.continueText}>Continue</Text>
        <CaretRight size={20} color={colors.wiltedgreen} weight="bold" />
      </Pressable>
    </View>
  );
}

// --- Phase: Contact ------------------------------------------------------

/**
 * Persistent recording indicator shown on phases where the recording
 * widget itself isn't visible (contact, review). A pulse dot + label +
 * live timer, sized small enough to live as a chip near the top of the
 * modal without competing with the phase content. Reuses usePulseOpacity
 * for cadence consistency with the trusted-contact dot — different
 * color (red for recording, freshgreen for trusted contact) but the
 * same heartbeat rhythm.
 */
function RecordingChip({ elapsed }: { elapsed: number }) {
  const pulse = usePulseOpacity();
  const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const seconds = (elapsed % 60).toString().padStart(2, '0');
  // P13: use the raw numeric values (not zero-padded display strings)
  // for the accessibility label. VoiceOver reads "00" as "zero zero"
  // literally — "zero zero minutes zero three seconds" is jarring and
  // reads as a bug. Parse from elapsed for clean speech output.
  const a11yMinutes = Math.floor(elapsed / 60);
  const a11ySeconds = elapsed % 60;
  return (
    <View
      style={chipStyles.row}
      accessibilityRole="text"
      accessibilityLabel={`Recording, ${a11yMinutes} minutes ${a11ySeconds} seconds elapsed`}
    >
      <Animated.View style={[chipStyles.dot, { opacity: pulse }]} />
      <Text style={chipStyles.label}>Recording</Text>
      <MetaSeparator style={chipStyles.dotSeparator} />
      <Text style={chipStyles.timer}>
        00:{minutes}:{seconds}
      </Text>
    </View>
  );
}

function ContactView({ onReviewGuidance }: { onReviewGuidance: () => void }) {
  // Higher min opacity for the avatar ring (a 160pt surface reads as a
  // strobe at the dot's 0.3 floor). Keeps the rhythm, softens the depth.
  const ringPulse = usePulseOpacity(0.55);
  const contactState = useTrustedContact();
  const { pickContact } = contactState;
  const contact = contactState.ready ? contactState.contact : null;

  // Real-contact fields when set; "add a contact" affordance when not.
  // The avatar block itself becomes the tap target in the no-contact
  // case — see the conditional Pressable wrap below — so a user who
  // skipped onboarding can recover mid-stop instead of being stranded.
  //
  // displayName: defensive fallback for stale stored contacts that
  // saved with name=undefined before the adapter learned to derive
  // names from firstName/lastName/phone. Without this, those contacts
  // would show "Add a contact" while the avatar was inert (hasContact
  // is truthy on the contact object), stranding the user.
  const hasContact = !!contact;
  const displayName =
    contact?.name?.trim() || contact?.phoneNumber || NO_CONTACT_NAME;
  const canCall = !!contact?.phoneNumber;

  function handleCall() {
    if (!contact?.phoneNumber) return;
    // Medium impact — confirms the action is firing as the Phone app
    // lifts. Recording continues, but the user's attention is about
    // to leave the app, so the haptic is the last sensory cue from
    // Fresh Greens before the dialer takes focus.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // tel: is the universal phone-dial scheme. iOS recognizes it and
    // launches the Phone app; Android similarly. expo-router doesn't
    // intercept these — they pass through to the platform handler.
    void Linking.openURL(`tel:${contact.phoneNumber}`);
  }

  function handleText() {
    if (!contact?.phoneNumber) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // sms: opens Messages with the recipient pre-filled. No body
    // pre-fill — the user picks what to say in the moment.
    void Linking.openURL(`sms:${contact.phoneNumber}`);
  }

  async function handleAddContact() {
    try {
      await pickContact();
    } catch (err) {
      console.warn('[pulled-over] pickContact failed', err);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={contactStyles.page}
      showsVerticalScrollIndicator={false}
    >
      <View style={contactStyles.topContent}>
        <View style={contactStyles.titleBlock}>
          <Text style={contactStyles.title} maxFontSizeMultiplier={2}>
            You're not alone.
          </Text>
          <Text style={contactStyles.subtitle} maxFontSizeMultiplier={2}>
            Call or text your trusted contact. No message or location has been sent yet.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            contactStyles.avatarBlock,
            pressed && !hasContact && pressedDim,
          ]}
          onPress={hasContact ? undefined : handleAddContact}
          disabled={hasContact}
          accessibilityRole={hasContact ? 'text' : 'button'}
          accessibilityLabel={
            hasContact
              ? `${displayName}, trusted contact`
              : 'Add a trusted contact'
          }
        >
          {/*
            Only the outermost ring stroke pulses, and only when a
            contact is actually set — pulsing on an empty avatar would
            falsely imply a connection that doesn't exist. The middle
            ring + filled circle stay static so identity doesn't
            flicker; the outer ring overlays them via absolute
            positioning so animating its opacity affects nothing else.
          */}
          <View style={contactStyles.avatarStack}>
            <View style={contactStyles.avatarRingMiddle}>
              <View
                style={[
                  contactStyles.avatarCircle,
                  !hasContact && contactStyles.avatarCircleEmpty,
                ]}
              >
                {hasContact ? (
                  <Text
                    style={contactStyles.avatarInitials}
                    maxFontSizeMultiplier={1}
                  >
                    {contact?.initials}
                  </Text>
                ) : (
                  <UserPlus
                    size={56}
                    color={colors.freshgreen}
                    weight="regular"
                  />
                )}
              </View>
            </View>
            {hasContact && (
              <Animated.View
                pointerEvents="none"
                style={[
                  contactStyles.avatarRingOuterPulse,
                  { opacity: ringPulse },
                ]}
              />
            )}
          </View>
          <Text
            style={[
              contactStyles.contactName,
              !hasContact && contactStyles.contactNameEmpty,
            ]}
            maxFontSizeMultiplier={2}
          >
            {displayName}
          </Text>
        </Pressable>

        <View style={contactStyles.buttonsBlock}>
          <Pressable
            style={({ pressed }) => [
              contactStyles.callBtn,
              !canCall && contactStyles.btnDisabled,
              pressed && canCall && pressedDim,
            ]}
            onPress={handleCall}
            disabled={!canCall}
            accessibilityRole="button"
            accessibilityLabel={
              canCall
                ? `Call ${displayName}`
                : 'Call (no trusted contact set)'
            }
            accessibilityState={{ disabled: !canCall }}
          >
            <Phone size={24} color={colors.white} weight="fill" />
            <Text style={contactStyles.callBtnText} maxFontSizeMultiplier={2}>
              Call
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              contactStyles.textBtn,
              !canCall && contactStyles.btnDisabled,
              pressed && canCall && pressedDim,
            ]}
            onPress={handleText}
            disabled={!canCall}
            accessibilityRole="button"
            accessibilityLabel={
              canCall
                ? `Text ${displayName}`
                : 'Text (no trusted contact set)'
            }
            accessibilityState={{ disabled: !canCall }}
          >
            <ChatCircle
              size={24}
              color={colors.wiltedgreen}
              weight="fill"
            />
            <Text style={contactStyles.textBtnText} maxFontSizeMultiplier={2}>
              Text
            </Text>
          </Pressable>

          <Pressable
            onPress={onReviewGuidance}
            accessibilityRole="link"
            accessibilityLabel="Review guidance"
            style={({ pressed }) => [
              contactStyles.reviewLink,
              pressed && pressedDim,
            ]}
          >
            <Text
              style={contactStyles.reviewLinkText}
              maxFontSizeMultiplier={2}
            >
              Review guidance
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={contactStyles.footerHint}>
        <Text style={contactStyles.footerHintText}>
          Swipe down on the gray slider to{'\n'}return to navigation
        </Text>
      </View>
    </ScrollView>
  );
}

// --- Phase: Review (5 sub-views, formerly /review-guidance) --------------

function ReviewView({
  index,
  showFirearmGuidance,
  disclosureDuty,
  stateName,
  onNext,
  onBack,
  onClose,
}: {
  index: number;
  showFirearmGuidance: boolean;
  disclosureDuty: DisclosureDuty;
  stateName: string | null;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <View style={reviewStyles.page}>
      <View style={reviewStyles.content}>
        {index === 0 && <OfficerTrooperView />}
        {index === 1 && <WhatToDoView />}
        {index === 2 && <WhatToHaveView />}
        {index === 3 && (
          <WhatToSayView
            showFirearm={showFirearmGuidance}
            disclosureDuty={disclosureDuty}
            stateName={stateName}
          />
        )}
        {index === 4 && <WhatToKnowView />}
      </View>

      <View style={reviewStyles.footer}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Back to trusted contact"
          style={({ pressed }) => [reviewStyles.closeBtn, pressed && pressedDim]}
        >
          <Text style={reviewStyles.closeText}>Back</Text>
        </Pressable>

        <View style={reviewStyles.chevronsRow}>
          {index > 0 ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Previous"
              style={({ pressed }) => [
                tapTarget44,
                pressed && pressedDim,
              ]}
            >
              <CaretLeft
                size={24}
                color={colors.labelTertiary}
                weight="regular"
              />
            </Pressable>
          ) : (
            <View style={tapTarget44}>
              <CaretLeft
                size={24}
                color={colors.separatorSubtle}
                weight="regular"
              />
            </View>
          )}

          <View style={reviewStyles.progressBlock}>
            <View
              style={reviewStyles.dotStrip}
              accessibilityElementsHidden
            >
              {Array.from({ length: REVIEW_VIEW_COUNT }).map((_, i) => (
                <View
                  key={i}
                  style={[reviewStyles.dot, i === index && reviewStyles.dotActive]}
                />
              ))}
            </View>
            <Text
              style={reviewStyles.progressLabel}
              accessibilityLabel={`Step ${index + 1} of ${REVIEW_VIEW_COUNT}`}
            >
              {index + 1} of {REVIEW_VIEW_COUNT}
            </Text>
          </View>

          {index < REVIEW_VIEW_COUNT - 1 ? (
            <Pressable
              onPress={onNext}
              accessibilityRole="button"
              accessibilityLabel="Next"
              style={({ pressed }) => [
                tapTarget44,
                pressed && pressedDim,
              ]}
            >
              <CaretRight
                size={24}
                color={colors.labelTertiary}
                weight="regular"
              />
            </Pressable>
          ) : (
            <View style={tapTarget44}>
              <CaretRight
                size={24}
                color={colors.separatorSubtle}
                weight="regular"
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function OfficerTrooperView() {
  const largeText = PixelRatio.getFontScale() >= 2;

  return (
    <ScrollView
      contentContainerStyle={officerStyles.page}
      showsVerticalScrollIndicator={false}
    >
      <View style={officerStyles.titleBlock}>
        <Text style={officerStyles.eyebrow} maxFontSizeMultiplier={2}>
          Stay informed
        </Text>
        <Text style={officerStyles.title} maxFontSizeMultiplier={2}>
          Know the difference:
        </Text>
      </View>

      <View
        style={[officerStyles.cardsRow, largeText && officerStyles.cardsColumn]}
      >
        <View style={[officerStyles.card, largeText && officerStyles.cardColumn]}>
          <View style={officerStyles.illustrationBox}>
            <View
              style={[officerStyles.illustrationWrap, officerStyles.alignEnd]}
            >
              <Image
                source={require('../assets/illustrations/pulled-over-officer.png')}
                style={officerStyles.officerImage}
                resizeMode="contain"
                accessible
                accessibilityLabel="Illustration of an officer wearing a brimmed cap"
                accessibilityIgnoresInvertColors
              />
            </View>
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

        <View
          style={[
            officerStyles.divider,
            largeText && officerStyles.dividerHorizontal,
          ]}
        />

        <View style={[officerStyles.card, largeText && officerStyles.cardColumn]}>
          <View style={officerStyles.illustrationBox}>
            <View style={officerStyles.illustrationWrap}>
              <Image
                source={require('../assets/illustrations/pulled-over-trooper.png')}
                style={officerStyles.trooperImage}
                resizeMode="contain"
                accessible
                accessibilityLabel="Illustration of a trooper wearing a Smokey Bear hat"
                accessibilityIgnoresInvertColors
              />
              <TrooperHatBadge
                width={16.26}
                height={17.23}
                style={officerStyles.trooperBadge}
              />
            </View>
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
    </ScrollView>
  );
}

function ContentView({
  illustration,
  title,
  bullets,
  supplement,
}: {
  illustration: ReactNode;
  title: string;
  bullets: ReactNode[];
  supplement?: ReactNode;
}) {
  // ScrollView (not plain View) because the bullet count varies across
  // sub-views — Know now has 6 bullets, which combined with the 320pt
  // illustration can overflow the modal's available height on iPhone
  // 14/15. ScrollView gracefully handles overflow without changing the
  // layout when content fits. showsVerticalScrollIndicator hidden so
  // the visual stays clean when scrolling isn't needed.
  return (
    <ScrollView
      style={contentStyles.scroll}
      contentContainerStyle={contentStyles.page}
      showsVerticalScrollIndicator={false}
    >
      <View style={contentStyles.illustrationBox}>{illustration}</View>
      <View style={contentStyles.body}>
        <Text style={contentStyles.title}>{title}</Text>
        <View style={contentStyles.bullets}>{bullets}</View>
        {supplement}
      </View>
    </ScrollView>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  // Same scaled-and-relaxed treatment as GuidanceBullet — these are
  // the review sub-views (What to Do/Have/Say/Know) that the user
  // reads either during or just after the stop. Long paragraphs,
  // identical cognitive-load context, identical typography needs.
  const scaledStyle = dynamicType(relaxedLineHeight(typography.title3Regular));
  return (
    <View style={contentStyles.bulletRow}>
      <Text style={[contentStyles.bulletDot, scaledStyle]}>•</Text>
      <Text style={[contentStyles.bulletText, scaledStyle]}>{children}</Text>
    </View>
  );
}

// Renders a SayBullet either as a plain string or as
// `lead + <Strong>emphasized</Strong> + trail` — used by the firearm
// review section to bold the literal spoken script while keeping the
// surrounding instruction regular weight.
function renderSayBullet(bullet: SayBullet): ReactNode {
  if (typeof bullet === 'string') return bullet;
  return (
    <>
      {bullet.lead}
      <Strong>{bullet.emphasized}</Strong>
      {bullet.trail}
    </>
  );
}

function Strong({ children }: { children: ReactNode }) {
  // Strong inherits its size from the surrounding Bullet's scaled
  // style via React Native's nested-Text inheritance. Apply scaling
  // directly here too so it doesn't fall back to the static base
  // size when used outside a scaled parent.
  const scaledStyle = dynamicType(relaxedLineHeight(typography.title3Emphasized));
  return <Text style={[contentStyles.bulletStrong, scaledStyle]}>{children}</Text>;
}

function WhatToDoView() {
  return (
    <ContentView
      illustration={
        <Image
          source={require('../assets/illustrations/pulled-over-stopped.png')}
          style={reviewIllustrationStyles.square}
          resizeMode="contain"
          accessible
          accessibilityLabel="Illustration: a car pulled over to the side of the road"
          accessibilityIgnoresInvertColors
        />
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
  const { profile: insuranceProfile } = useInsuranceProfile();
  const supplement = insuranceProfile ? (
    <View
      style={contentStyles.onFileBlock}
      accessible
      accessibilityLabel={`Saved in Fresh Greens. ${insuranceProfile.carrierName}, policy ${maskPolicyNumber(insuranceProfile.policyNumber)}`}
    >
      <Text style={contentStyles.onFileLabel}>Saved in Fresh Greens</Text>
      <Text style={contentStyles.onFileValue}>
        {insuranceProfile.carrierName}{' '}
        {maskPolicyNumber(insuranceProfile.policyNumber)}
      </Text>
    </View>
  ) : undefined;

  return (
    <ContentView
      illustration={
        <Image
          source={require('../assets/illustrations/pulled-over-provide.png')}
          style={reviewIllustrationStyles.square}
          resizeMode="contain"
          accessible
          accessibilityLabel="Illustration: license, registration, and insurance documents"
          accessibilityIgnoresInvertColors
        />
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
      supplement={supplement}
    />
  );
}

function WhatToSayView({
  showFirearm,
  disclosureDuty,
  stateName,
}: {
  showFirearm: boolean;
  disclosureDuty: DisclosureDuty;
  stateName: string | null;
}) {
  const bullets: ReactNode[] = [];

  if (showFirearm) {
    // Firearm copy is pulled from the gun-laws adapter (single source
    // of truth — the guidance phase reads from the same record). Two-
    // bullet shape preserved from v1: the first bullet is the
    // primary script/instruction, the second is the paired action.
    // Per-duty:
    //   - duty-to-inform: a quotable script + the location-disclosure
    //     follow-up (Alabama-style proactive disclosure).
    //   - no-duty:        "you're not required to volunteer" + "if
    //     asked, answer honestly" (CA/NY/IL register).
    //   - asked-only:     "hands visible" + "if asked, answer
    //     honestly" (most permit-only states).
    if (stateName) {
      bullets.push(
        <Text key="state-attribution" style={guidanceStyles.stateAttribution}>
          Laws for {stateName}
        </Text>,
      );
    }
    const sayBullets = FIREARM_GUIDANCE[disclosureDuty].sayBullets;
    sayBullets.forEach((line, i) => {
      bullets.push(
        <Bullet key={`firearm-${i}`}>{renderSayBullet(line)}</Bullet>,
      );
    });
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
        <Image
          source={require('../assets/illustrations/pulled-over-say.png')}
          style={reviewIllustrationStyles.square}
          resizeMode="contain"
          accessible
          accessibilityLabel="Illustration: a person speaking with the officer"
          accessibilityIgnoresInvertColors
        />
      }
      title="What you can say:"
      bullets={bullets}
    />
  );
}

function WhatToKnowView() {
  // Rights bullets aligned to ACLU's "Stopped by Police" guidance:
  //   - Right to remain silent (clean phrasing; the earlier "beyond
  //     identifying yourself" hedge tried to acknowledge stop-and-
  //     identify states but didn't generalize correctly)
  //   - Documents are still required even if you stay silent — pairs
  //     with "What to Have" so users don't read "remain silent" as
  //     "refuse to hand over license/registration/insurance"
  //   - Right to refuse a search (kept; matches ACLU)
  //   - Right to record (added; ACLU explicitly affirms this and the
  //     app is doing exactly that during the guidance phase)
  //   - Right to leave if not under arrest (added; ACLU's concrete
  //     post-stop guidance, useful for the review register)
  //   - Asking why you were stopped — kept as practical guidance,
  //     framed as "you can" not "you have the right to" since the
  //     officer isn't legally bound to answer
  return (
    <ContentView
      illustration={
        <Image
          source={require('../assets/illustrations/pulled-over-know.png')}
          style={reviewIllustrationStyles.square}
          resizeMode="contain"
          accessible
          accessibilityLabel="Illustration: a book of rights"
          accessibilityIgnoresInvertColors
        />
      }
      title="Know your rights:"
      bullets={[
        <Bullet key="silent">
          You have the <Strong>right to remain silent</Strong>
        </Bullet>,
        <Bullet key="documents">
          You still have to provide your{' '}
          <Strong>license, registration, and insurance</Strong>
        </Bullet>,
        <Bullet key="search">
          You don't have to consent to a search.{' '}
          <Strong>Say "I do not consent to a search"</Strong> clearly
        </Bullet>,
        <Bullet key="record">
          You have the <Strong>right to record this interaction</Strong>
        </Bullet>,
        <Bullet key="leave">
          If you are not under arrest, you have the{' '}
          <Strong>right to leave</Strong>
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
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
  },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  dragWrapper: {
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  lockBadge: {
    position: 'absolute',
    right: spacing.lg,
    top: spacing.md,
  },
  savingStatus: {
    backgroundColor: colors.surfaceTinted,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  savingStatusTitle: {
    ...dynamicType(typography.bodyRegular),
    color: colors.black,
  },
  savingStatusDetail: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelTertiary,
  },
  phaseContainer: {
    flex: 1,
    paddingTop: spacing.lg,
  },
});

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.xs,
    backgroundColor: colors.severityCritical,
    marginRight: spacing.sm,
  },
  label: {
    ...dynamicType(typography.footnoteEmphasized),
    color: colors.black,
  },
  dotSeparator: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelTertiary,
  },
  timer: {
    // Tabular figures so the seconds digits don't jiggle as they
    // change (default proportional figures shift width per glyph).
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelTertiary,
    fontVariant: ['tabular-nums'],
  },
});

const armedStyles = StyleSheet.create({
  page: {
    flexGrow: 1,
    minHeight: '100%',
    gap: spacing.xl,
    paddingBottom: spacing.md,
  },
  titleBlock: {
    gap: spacing.sm,
  },
  eyebrow: {
    // Drops to title3Regular (20pt) so the size-step against the 28pt
    // title is unmistakable. With both lines at title1 (28pt) the weight
    // alone (regular vs emphasized) didn't read as a clear hierarchy.
    // User-flagged 2026-06-01. Amends the safety-flow entry-header
    // precedent (mirrored in /roadside, /unfamiliar, /share-location).
    ...dynamicType(typography.title3Regular, 2),
    color: colors.labelTertiary,
  },
  title: {
    // Held-Question Rule (.cursorrules Typography): the armed prompt
    // "Are you armed?" is a user question at peak stress; Regular
    // holds space open instead of commanding. Size (28pt) + placement
    // carry the emphasis. Consistent with /safety, /unfamiliar,
    // /share-location.
    ...dynamicType(typography.title1Regular, 2),
    color: colors.black,
  },
  answersWrapper: {
    flex: 1,
    gap: spacing.xxl,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  answerCard: {
    minHeight: safetyCardHeight,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    // A22 / P1: was inline (height:1, opacity:0.15, radius:3, elevation:2)
    // — exact match to shadows.e1. Replaced with the canonical spread per
    // DESIGN.md §4 shadows.e2 (FAB drift note).
    ...shadows.e1,
  },
  answerContent: {
    // P2: was width: 238 — magic number that clipped at iPhone SE
    // viewport and under large Dynamic Type. flex: 1 fills the card's
    // available content area (parent is width: '100%' with 16pt
    // padding) responsively at any viewport, which is the real fix —
    // not a grid alignment concern. Per DESIGN.md §5 (every state designed).
    // (every state designed) + §1.6 (avoid magic constants).
    //
    // justifyContent: 'center' centers the title+subtitle block vertically
    // within the card. Without it the single-line "Prefer not to answer"
    // card reads top-aligned next to its two-line siblings (Yes/No) —
    // user-flagged 2026-06-01.
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  // Promoted from bodyEmphasized (17pt) to title2Emphasized (22pt Bold)
  // for decision weight — the armed answer is the highest-stakes tap
  // in the flow and the title should read as a clear, bold choice.
  answerTitle: {
    ...dynamicType(typography.title2Emphasized, 2),
    color: colors.black,
  },
  answerSubtitle: {
    ...dynamicType(typography.subheadlineRegular, 2),
    color: colors.labelTertiary,
  },
});

const transitionStyles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textBlock: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  title: {
    // P3: dynamicType on transition title — sets emotional tone after
    // armed check; users with Large Accessibility type need scaled
    // copy. Skip relaxedLineHeight (header per DESIGN.md Held-Question Rule;
    // guidance — relaxed is for stress-state long-reads).
    ...dynamicType(typography.title1Regular),
    color: colors.black,
    textAlign: 'center',
  },
  subtitle: {
    // P3: dynamicType on transition subtitle for the same reason.
    ...dynamicType(typography.subheadlineRegular),
    color: colors.labelTertiary,
    textAlign: 'center',
  },
  // Primary Continue button — freshgreen fill with wiltedgreen border
  // per the spec. 44pt height, pill radius, centered below the text
  // block. This is the only way forward from the transition phase
  // (no auto-advance), so it gets primary-CTA treatment.
  continueBtn: {
    minHeight: 44,
    paddingVertical: spacing.sm,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.freshgreen,
    borderWidth: 1,
    borderColor: colors.wiltedgreen,
    marginTop: spacing.xl,
  },
  continueBtnText: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
  },
});

const guidanceStyles = StyleSheet.create({
  page: {
    flex: 1,
    gap: spacing.lg,
    // +8pt additional horizontal padding on top of the modal-level 16pt
    // (styles.safe), bringing the guidance phase's effective gutter to
    // 24pt. The bullet-heavy register reads tighter than the rest of
    // the modal phases (armed cards, contact avatar block, review hero
    // illustrations) and benefits from extra breathing room.
    paddingHorizontal: spacing.sm,
  },
  titleBlock: {
    gap: spacing.sm,
  },
  eyebrow: {
    // Drops to title3Regular (20pt) so the size-step against the 28pt
    // title is unmistakable. With both lines at title1 (28pt) the weight
    // alone (regular vs emphasized) didn't read as a clear hierarchy.
    // User-flagged 2026-06-01. Amends the safety-flow entry-header
    // precedent (mirrored in /roadside, /unfamiliar, /share-location).
    ...dynamicType(typography.title3Regular),
    color: colors.labelTertiary,
  },
  title: {
    ...dynamicType(typography.title1Emphasized),
    color: colors.black,
  },
  bullets: {
    // Figma uses gap-[8px] between <li>s; we mirror that here. Bullets
    // are now rendered as flex rows (dot + text columns) below.
    gap: spacing.sm,
    paddingLeft: 18, // matches Figma's ms-[30px] (page padding 16 + 14 ≈ 30)
  },
  bulletRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  bulletDot: {
    ...dynamicType(typography.title3Regular),
    color: colors.black,
  },
  bulletText: {
    ...dynamicType(typography.title3Regular),
    color: colors.black,
    flex: 1,
  },
  readAloudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    // P5: paddingVertical 8 → 12 brings the painted height to 56pt
    // (32pt icon + 12×2 = 56). Earlier value (8) produced ~35pt
    // painted, with hitSlop:12 papering over the visual-to-touch gap.
    // .cursorrules tap-target rule explicitly forbid papering
    // a sub-44pt visual with hitSlop — drop the hitSlop now that the
    // painted area is comfortable on its own.
    paddingVertical: spacing.md,
  },
  readAloudText: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.labelTertiary,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.lg,
  },
  // Wiltedgreen-outline pill (mirrors Contact's Text button) — quieter
  // than freshgreen-fill, conserving the freshgreen for genuine primary
  // actions like Call. The "we're recording during a stop" register
  // wants reserved, not cheerful.
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.wiltedgreen,
    backgroundColor: colors.surfaceElevated,
  },
  continueText: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.wiltedgreen,
  },
  stateAttribution: {
    ...dynamicType(typography.caption1Regular),
    color: colors.labelTertiary,
    marginBottom: spacing.xs,
  },
});

const contactStyles = StyleSheet.create({
  page: {
    flexGrow: 1,
    gap: spacing.xl,
    paddingBottom: spacing.md,
  },
  topContent: {
    gap: spacing.xxl,
  },
  titleBlock: {
    gap: spacing.sm,
  },
  title: {
    ...dynamicType(typography.brandDisplay, 2),
    color: colors.black,
  },
  subtitle: {
    ...dynamicType(typography.bodyRegular, 2),
    color: colors.labelSecondary,
  },
  avatarBlock: {
    gap: spacing.md,
    alignItems: 'center',
  },
  // 160×160 box that hosts both the static middle-ring stack (a flow
  // child centered by alignItems/justifyContent) AND the animated outer
  // ring (an absolute-positioned overlay). Separating these means the
  // pulse only affects the outermost stroke; the middle ring + filled
  // circle stay 100% opaque.
  avatarStack: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRingOuterPulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.pill,
    borderWidth: 3,
    borderColor: colors.fadedgreen,
  },
  avatarRingMiddle: {
    width: 140,
    height: 140,
    borderRadius: radii.pill,
    borderWidth: 3,
    borderColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 128,
    height: 128,
    borderRadius: radii.pill,
    backgroundColor: colors.wiltedgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    ...dynamicType(typography.largeTitleEmphasized, 1),
    color: colors.white,
  },
  contactName: {
    ...dynamicType(typography.title2Regular, 2),
    color: colors.black,
    textAlign: 'center',
  },
  // Empty-state overrides applied via style array when !hasContact.
  // Per Phase 1 P1-11: a filled wiltedgreen avatar misframes the empty
  // slot as a populated identity. The fill→outline register flip reuses
  // Button's convention (fill = identity / commitment; outline =
  // invitation / secondary) — no new chrome, just a property flip.
  avatarCircleEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.freshgreen,
  },
  contactNameEmpty: {
    ...dynamicType(typography.bodyEmphasized, 2),
    color: colors.freshgreen,
    textAlign: 'center',
  },
  buttonsBlock: {
    gap: spacing.md,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingVertical: spacing.sm,
    width: '100%',
    // wiltedgreen for WCAG AA contrast on the white "Call" text
    // (matches the post-#148 primary-CTA register).
    backgroundColor: colors.wiltedgreen,
    borderRadius: radii.pill,
    // A22 / P8: was inline (height:1, opacity:0.15, radius:3, elevation:2)
    // — exact match to shadows.e1. Same fix class as the armed answer
    // card (P1). Per DESIGN.md §4 shadows.e2.
    ...shadows.e1,
  },
  callBtnText: {
    ...dynamicType(typography.subheadlineEmphasized, 2),
    color: colors.white,
  },
  textBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingVertical: spacing.sm,
    width: '100%',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.wiltedgreen,
  },
  textBtnText: {
    ...dynamicType(typography.subheadlineEmphasized, 2),
    color: colors.wiltedgreen,
  },
  btnDisabled: {
    // Visible-but-non-interactive state for Call/Text when no trusted
    // contact is set yet. Same shape, dimmed — communicates "this is a
    // button but it's not currently usable" rather than hiding it
    // (which would leave the contact phase looking incomplete).
    opacity: 0.4,
  },
  reviewLink: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewLinkText: {
    ...dynamicType(typography.subheadlineRegular, 2),
    color: colors.labelTertiary,
    textDecorationLine: 'underline',
  },
  footerHint: {
    alignItems: 'center',
  },
  footerHintText: {
    ...dynamicType(typography.footnoteRegular),
    // P10: instructional copy ("Swipe down on the gray slider...") at
    // 13pt + 70% gray = ~3.5:1 contrast. Same fix class as P9 — promote
    // to labelTertiary for readable instruction. Per .cursorrules reserved-color rule.
    color: colors.labelTertiary,
    textAlign: 'center',
  },
});

const reviewStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  footer: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  closeText: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelTertiary,
    textDecorationLine: 'underline',
  },
  chevronsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    alignItems: 'center',
  },
  progressBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  dotStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  progressLabel: {
    ...dynamicType(typography.caption1Regular),
    color: colors.labelSecondary,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.xs,
    backgroundColor: colors.separatorSubtle,
  },
  dotActive: {
    backgroundColor: colors.wiltedgreen,
    width: 8,
    height: 8,
    borderRadius: radii.xs,
  },
});

const officerStyles = StyleSheet.create({
  page: {
    flexGrow: 1,
    gap: spacing.xl,
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  titleBlock: {
    gap: spacing.sm,
    alignItems: 'flex-start',
    width: '100%',
  },
  eyebrow: {
    // Drops to title3Regular (20pt) so the size-step against the 28pt
    // title is unmistakable. With both lines at title1 (28pt) the weight
    // alone (regular vs emphasized) didn't read as a clear hierarchy.
    // User-flagged 2026-06-01. Amends the safety-flow entry-header
    // precedent (mirrored in /roadside, /unfamiliar, /share-location).
    ...dynamicType(typography.title3Regular, 2),
    color: colors.labelTertiary,
  },
  title: {
    ...dynamicType(typography.title1Emphasized, 2),
    color: colors.black,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: '100%',
  },
  cardsColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  card: {
    flex: 1,
    gap: spacing.xl,
    alignItems: 'center',
  },
  cardColumn: {
    flex: 0,
    width: '100%',
  },
  illustrationBox: {
    width: 148,
    height: 244,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    padding: spacing.md,
  },
  illustrationWrap: {
    width: 120,
    height: 172,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  alignEnd: {
    justifyContent: 'flex-end',
  },
  officerImage: {
    width: 100,
    height: 157,
  },
  trooperImage: {
    width: 100,
    height: 171,
  },
  // Top + left derived from Figma's `inset-[20.99%_43.22%_68.99%_43.23%]`
  // against the 120×172 wrapper.
  trooperBadge: {
    position: 'absolute',
    top: 36,
    left: 52,
  },
  cardLabel: {
    ...dynamicType(typography.title3Regular),
    color: colors.black,
  },
  bullets: {
    gap: spacing.md,
    width: '100%',
    alignItems: 'flex-start',
  },
  bullet: {
    // P11: was calloutRegular (16pt) — every other ContentView bullet
    // in this file uses title3Regular (20pt) wrapped in
    // dynamicType(relaxedLineHeight(...)). OfficerTrooper was the lone
    // 16pt static outlier; users flipping through review views saw
    // bullets visibly shrink on the first sub-view. Promote to match
    // the GuidanceBullet / Bullet pattern. Per DESIGN.md Relaxed-Read Rule + dynamicType.
    ...dynamicType(relaxedLineHeight(typography.title3Regular)),
    color: colors.black,
  },
  emphasis: {
    // Inline emphasis weight inside Officer/Trooper card bullets.
    // Pulls from the typography token instead of an inline literal so
    // weight changes flow through one source.
    fontFamily: typography.bodyEmphasized.fontFamily,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.dividerNeutral,
    marginVertical: spacing.md,
  },
  dividerHorizontal: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    alignSelf: 'auto',
    marginVertical: spacing.md,
  },
});

const contentStyles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  page: {
    // ScrollView contentContainerStyle. flexGrow: 1 (not flex: 1) so
    // the content fills available height when short, and can grow
    // beyond it when long. minHeight: '100%' keeps short content
    // anchored visually rather than collapsing.
    flexGrow: 1,
    gap: spacing.xl,
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  illustrationBox: {
    // P12: was fixed width/height 320 — original iPhone SE (320pt viewport)
    // with 16pt horizontal padding leaves only 288pt for content, causing
    // the 320pt illustration to overflow. width:'100%' + aspectRatio:1
    // makes the box fluid; maxWidth caps the square proportion on larger
    // viewports so the visual stays as designed. Per theme/spacing 4pt ramp.
    width: '100%',
    aspectRatio: 1,
    maxWidth: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    width: '100%',
    gap: spacing.xl,
  },
  title: {
    ...dynamicType(typography.title1Emphasized),
    color: colors.black,
  },
  bullets: {
    gap: spacing.md,
  },
  onFileBlock: {
    gap: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.dividerNeutral,
  },
  onFileLabel: {
    ...dynamicType(typography.footnoteEmphasized),
    color: colors.labelSecondary,
  },
  onFileValue: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.black,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  bulletDot: {
    ...dynamicType(typography.title3Regular),
    color: colors.black,
  },
  bulletText: {
    ...dynamicType(typography.title3Regular),
    color: colors.black,
    flex: 1,
  },
  bulletStrong: {
    ...dynamicType(typography.title3Emphasized),
    color: colors.black,
  },
});

// Review hero illustrations (`pulled-over-stopped/provide/say/know`)
// are square @3x PNGs (~960×960). Display at 280pt inside the 320pt
// illustrationBox so there's ~20pt breathing room on each side.
const reviewIllustrationStyles = StyleSheet.create({
  square: {
    width: 280,
    height: 280,
  },
});
