import { Ionicons } from '@expo/vector-icons';
import { usePreventRemove } from '@react-navigation/native';
// Phosphor deep-imports — see app/trusted-contact-setup.tsx for the
// longer note on why we bypass the package's barrel index. SpeakerHigh
// + Stop align this screen's audio-control register with /recordings
// (which uses Phosphor Play/Pause/Microphone for the same recording
// data); UserPlus is the canonical "add a person" affordance per
// docs/architecture.md (contact phase) and matches /trusted-contact-setup.
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
  Animated,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import TrooperHatBadge from '../assets/illustrations/trooper-hat-badge.svg';
import { DragHandle } from '../components/DragHandle';
import { TrustedContactStatus } from '../components/TrustedContactStatus';
import { useDisclosureDuty } from '../hooks/useDisclosureDuty';
import { usePulseOpacity } from '../hooks/usePulseOpacity';
import { useRecordings } from '../hooks/useRecordings';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useTrustedContact } from '../hooks/useTrustedContact';
import {
  FIREARM_GUIDANCE,
  type DisclosureDuty,
  type SayBullet,
} from '../lib/api/gun-laws';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { shadows } from '../theme/shadows';
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
 * leaving the 'armed' phase) and runs until the modal dismisses. No
 * stop button — ambient protection isn't something the user manages
 * mid-encounter. The recording widget is *displayed* only on the
 * guidance phase, but the recorder keeps running and the elapsed
 * counter keeps ticking through the rest of the flow.
 *
 * If the user denies the microphone permission (or recording fails),
 * the visual still works — the waveform falls back to a flat baseline
 * and the timer keeps ticking via setInterval. The "Saved to your
 * account" footnote in the widget is the contextual answer to "where
 * does this recording go," kept inside the widget so it doesn't crowd
 * the global TrustedContactStatus footer at the modal bottom.
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

const TRANSITION_MS = 3000;
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
const WAVEFORM_MIN_HEIGHT = 4;
const WAVEFORM_MAX_HEIGHT = 64;
const METERING_FLOOR_DB = -60;
const METERING_CEILING_DB = -10;

/** Convert one dB sample to a bar height in pt. Clamped to [min, max]. */
function dbToBarHeight(db: number): number {
  // Map [floor, ceiling] dB → [0, 1] then to [min, max] pt.
  const normalized = Math.max(
    0,
    Math.min(
      1,
      (db - METERING_FLOOR_DB) / (METERING_CEILING_DB - METERING_FLOOR_DB),
    ),
  );
  return WAVEFORM_MIN_HEIGHT + normalized * (WAVEFORM_MAX_HEIGHT - WAVEFORM_MIN_HEIGHT);
}

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
  const { contact } = useTrustedContact();
  const [phase, setPhase] = useState<Phase>('armed');
  const [armed, setArmed] = useState<ArmedAnswer | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [meteringHistory, setMeteringHistory] = useState<number[]>(() =>
    new Array(WAVEFORM_BAR_COUNT).fill(METERING_FLOOR_DB),
  );
  // P6: reduce-motion gates the live waveform animation. Was the only
  // animation in the app NOT gated; now respects the system preference.
  // Per design-system.md §4.5.
  const reduceMotion = useReduceMotion();

  const { addRecording } = useRecordings();
  // State-aware firearm guidance — variant resolved from the device's
  // current state via reverse-geocoding. Defaults to 'duty-to-inform'
  // while loading or on any failure path; see `useDisclosureDuty`
  // for the safer-default rationale. The downstream views render
  // duty-to-inform copy while `loading === true`, so the brief delay
  // between mount and state-resolution is invisible to the user.
  const { duty: disclosureDuty } = useDisclosureDuty();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks whether we've already kicked off the recorder. The lifecycle
  // effect below is keyed on `phase` (so it can fire once we leave
  // armed), but every subsequent phase change would otherwise re-trigger
  // it and try to start an already-recording recorder — which throws on
  // iOS. This ref is the "started exactly once" latch.
  const hasStartedRecordingRef = useRef(false);
  // Mirror of hasStartedRecordingRef as state, so usePreventRemove
  // (which only re-evaluates on render) sees the change. The ref is
  // still the source of truth for the recording lifecycle effect; this
  // state exists purely to drive the dismissal-prevention hook.
  const [hasActiveRecording, setHasActiveRecording] = useState(false);
  // Refs that capture the metadata snapshot at recording start, so the
  // unmount cleanup can persist a Recording with the right armed
  // context + timestamp even after `armed` state is gone. Refs (not
  // state) because cleanup effects only run once at unmount and don't
  // rebind to state values that have changed since the last commit.
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

  // Recording timer — runs from the first armed answer until the modal
  // dismisses. Independent of the audio recorder so the timer keeps
  // ticking even if mic permission was denied (the visual experience
  // still reads as "we're protecting you" via the elapsed counter).
  useEffect(() => {
    if (phase === 'armed') return;
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
  }, [phase]);

  // Auto-advance from transition → guidance after 3s. The transition
  // phase is a brief reassurance ("We'll walk you through what to do.")
  // with no controls of its own, so the timeout is the only way out.
  useEffect(() => {
    if (phase !== 'transition') return;
    const timeout = setTimeout(() => setPhase('guidance'), TRANSITION_MS);
    return () => clearTimeout(timeout);
  }, [phase]);

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
    if (phase === 'armed') return;
    if (hasStartedRecordingRef.current) return;
    hasStartedRecordingRef.current = true;
    setHasActiveRecording(true);
    // Snapshot metadata for the eventual Recording entry. Captured
    // here (not in cleanup) because by the time cleanup runs, the
    // `armed` state has already been cleared from the React tree.
    recordingArmedRef.current = armed;
    recordingStartedAtRef.current = Date.now();
    (async () => {
      try {
        const status = await requestRecordingPermissionsAsync();
        if (!status.granted) {
          console.warn('Microphone permission not granted; waveform disabled');
          return;
        }
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        await recorder.prepareToRecordAsync();
        recorder.record();
      } catch (err) {
        console.warn('expo-audio recorder failed to start', err);
      }
    })();
    // recorder identity is stable from the hook; intentionally not in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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
  usePreventRemove(hasActiveRecording, ({ data }) => {
    (async () => {
      try {
        if (recorder.isRecording) {
          try {
            await recorder.stop();
          } catch (stopErr) {
            console.warn('[pulled-over] recorder.stop() failed', stopErr);
          }
        }
        const sourceUri = recorder.uri;
        if (!sourceUri) {
          console.warn('[pulled-over] no recorder uri; skipping save');
          return;
        }
        const startedAt = recordingStartedAtRef.current ?? Date.now();
        const durationMs = Date.now() - startedAt;
        if (durationMs < 2000) {
          console.log('[pulled-over] recording <2s; skipping save', { durationMs });
          return;
        }
        const saved = await addRecording({
          sourceUri,
          durationMs,
          armed: recordingArmedRef.current,
          createdAt: startedAt,
        });
        console.log('[pulled-over] saved recording', saved.id, 'durationMs=', durationMs);
      } catch (err) {
        console.warn('[pulled-over] save failed', err);
      } finally {
        // Re-dispatch the navigation action we blocked. Setting
        // hasActiveRecording=false first prevents this dispatch from
        // re-triggering the prevent.
        setHasActiveRecording(false);
        navigation.dispatch(data.action);
      }
    })();
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
    if (phase !== 'guidance') return;
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
  }, [phase, recorderState.durationMillis, recorderState.metering, reduceMotion]);

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

  function handleClose() {
    router.back();
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.dragWrapper}>
          <DragHandle />
        </View>

        {/*
          Persistent recording chip — only on phases where the recording
          widget itself isn't visible. Without this, recording vanishes
          from the UI the moment the user taps Continue, even though the
          recorder keeps running. Honors the "don't make recording feel
          like a black box" concern: a small inline indicator with the
          live timer sits above the phase content for the rest of the
          flow. Hidden on guidance because the full widget is there.
        */}
        {(phase === 'contact' || phase === 'review') && (
          <RecordingChip elapsed={elapsed} />
        )}

        <View style={styles.phaseContainer}>
          {phase === 'armed' && <ArmedView onAnswer={handleAnswer} />}
          {phase === 'transition' && (
            <TransitionView onSkip={() => setPhase('guidance')} />
          )}
          {phase === 'guidance' && (
            <GuidanceView
              showFirearmGuidance={showFirearmGuidance}
              disclosureDuty={disclosureDuty}
              elapsed={elapsed}
              meteringHistory={meteringHistory}
              reduceMotion={reduceMotion}
              onContinue={handleContinueToContact}
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
    <View style={armedStyles.page}>
      <View style={armedStyles.titleBlock}>
        <Text style={armedStyles.eyebrow}>Ok. Got it.</Text>
        <Text style={armedStyles.title}>Are you armed?</Text>
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
              <Text style={armedStyles.answerTitle}>{answer.title}</Text>
              {answer.subtitle && (
                <Text style={armedStyles.answerSubtitle}>
                  {answer.subtitle}
                </Text>
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// --- Phase: Transition ---------------------------------------------------

function TransitionView({ onSkip }: { onSkip: () => void }) {
  // Trauma-informed control: the 3-second auto-advance was a calming
  // pause by design, but for users processing a stop in real time,
  // 3 seconds of "wait, what?" can feel longer than helpful. Making
  // the whole card a Pressable lets users skip ahead the moment
  // they're ready — pace control during stress is one of the
  // strongest predictors of self-regulation per Stanford's Trauma &
  // Resilience Lab. The auto-advance still fires for users who don't
  // tap (default calming pace preserved); tapping is opt-in
  // acceleration. accessibilityHint announces both behaviors so
  // VoiceOver users know they can choose.
  return (
    <Pressable
      style={({ pressed }) => [
        transitionStyles.center,
        pressed && pressedDim,
      ]}
      onPress={onSkip}
      accessibilityRole="button"
      accessibilityLabel="We'll walk you through what to do. We've started recording for your safety."
      accessibilityHint="Auto-advances after 3 seconds, or tap to advance now"
    >
      <View style={transitionStyles.textBlock}>
        <Text style={transitionStyles.title}>
          We'll walk you{'\n'}through what to do.
        </Text>
        <Text style={transitionStyles.subtitle}>
          We've started recording{'\n'} for your safety.
        </Text>
        <Text style={transitionStyles.skipHint}>Tap to continue</Text>
      </View>
    </Pressable>
  );
}

// --- Phase: Guidance -----------------------------------------------------

/**
 * Live mic-driven waveform. Renders WAVEFORM_BAR_COUNT vertical bars,
 * each height computed from a dB sample in the metering history (oldest
 * on the left, newest on the right). When the recorder isn't active or
 * the platform doesn't expose metering, the buffer stays at the floor
 * value and the waveform reads as a flat baseline — graceful fallback
 * rather than a broken visual.
 */
function Waveform({
  history,
  reduceMotion,
}: {
  history: number[];
  reduceMotion: boolean;
}) {
  // P6: when reduce-motion is on, render every bar at the floor height
  // (flat baseline) instead of the live dB values. usePulseOpacity
  // already gates correctly elsewhere; this brings the only un-gated
  // animation in the app into the same pattern. Per design-system.md §4.5.
  return (
    <View style={guidanceStyles.waveformRow}>
      {history.map((db, i) => (
        <View
          key={i}
          style={[
            guidanceStyles.waveformBar,
            {
              height: reduceMotion
                ? WAVEFORM_MIN_HEIGHT
                : dbToBarHeight(db),
            },
          ]}
        />
      ))}
    </View>
  );
}

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
  elapsed,
  meteringHistory,
  reduceMotion,
  onContinue,
}: {
  showFirearmGuidance: boolean;
  disclosureDuty: DisclosureDuty;
  elapsed: number;
  meteringHistory: number[];
  reduceMotion: boolean;
  onContinue: () => void;
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

  const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const seconds = (elapsed % 60).toString().padStart(2, '0');
  const timeString = `00:${minutes}:${seconds}`;

  return (
    <View style={guidanceStyles.page}>
      <View style={guidanceStyles.titleBlock}>
        <Text style={guidanceStyles.eyebrow}>We can help</Text>
        <Text style={guidanceStyles.title}>Read the following</Text>
      </View>

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
          <Stop size={32} color={colors.mutedTertiary} />
        ) : (
          <SpeakerHigh size={32} color={colors.mutedTertiary} />
        )}
        <Text style={guidanceStyles.readAloudText}>
          {isSpeaking ? 'Stop' : 'Read aloud'}
        </Text>
      </Pressable>

      <View style={guidanceStyles.spacer} />

      {/*
        Recording widget — Figma node 825:4298. Background F2F2F7,
        radius 20, padding 16, gap 8, items-center. The static
        waveform bars from the Figma mockup are replaced with a real
        live waveform driven by mic metering. Stop button removed:
        recording is ambient protection across the rest of the flow,
        not a thing the user manages mid-encounter. The "Saved to your
        account" footnote answers "where does this go" without
        crowding the trusted-contact status at the modal bottom.
      */}
      <View style={guidanceStyles.recordingWidget}>
        <View style={guidanceStyles.recordingTextBlock}>
          <Text style={guidanceStyles.recordingLabel}>Recording…</Text>
          <Text style={guidanceStyles.recordingTimer}>{timeString}</Text>
        </View>

        <Waveform history={meteringHistory} reduceMotion={reduceMotion} />

        <Text style={guidanceStyles.recordingFootnote}>
          Saved to your phone — only you can access it
        </Text>
      </View>

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
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.wiltedgreen}
        />
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
      <Text style={chipStyles.dotSeparator}>·</Text>
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
  const { contact, pickContact } = useTrustedContact();

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
    <View style={contactStyles.page}>
      <View style={contactStyles.topContent}>
        <View style={contactStyles.titleBlock}>
          <Text style={contactStyles.title}>You're not alone.</Text>
          <Text style={contactStyles.subtitle}>
            Your trusted contacts are alerted during emergencies and can see
            your current location.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            contactStyles.avatarBlock,
            pressed && !hasContact && pressedDim,
          ]}
          onPress={hasContact ? undefined : handleAddContact}
          disabled={hasContact}
          accessibilityRole={hasContact ? undefined : 'button'}
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
              <View style={contactStyles.avatarCircle}>
                {hasContact ? (
                  <Text style={contactStyles.avatarInitials}>
                    {contact?.initials}
                  </Text>
                ) : (
                  <UserPlus
                    size={56}
                    color={colors.white}
                    weight="duotone"
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
          <Text style={contactStyles.contactName}>{displayName}</Text>
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
            <Ionicons name="call" size={24} color={colors.white} />
            <Text style={contactStyles.callBtnText}>Call</Text>
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
            <Ionicons
              name="chatbubble"
              size={24}
              color={colors.wiltedgreen}
            />
            <Text style={contactStyles.textBtnText}>Text</Text>
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
            <Text style={contactStyles.reviewLinkText}>Review guidance</Text>
          </Pressable>
        </View>
      </View>

      <View style={contactStyles.footerHint}>
        <Text style={contactStyles.footerHintText}>
          Swipe down on the gray slider to{'\n'}return to navigation
        </Text>
      </View>
    </View>
  );
}

// --- Phase: Review (5 sub-views, formerly /review-guidance) --------------

function ReviewView({
  index,
  showFirearmGuidance,
  disclosureDuty,
  onNext,
  onBack,
  onClose,
}: {
  index: number;
  showFirearmGuidance: boolean;
  disclosureDuty: DisclosureDuty;
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
              hitSlop={12}
              style={({ pressed }) => [
                reviewStyles.chevronBtn,
                pressed && pressedDim,
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={colors.labelTertiary}
              />
            </Pressable>
          ) : (
            <View style={reviewStyles.chevronBtn} />
          )}
          {index < REVIEW_VIEW_COUNT - 1 ? (
            <Pressable
              onPress={onNext}
              accessibilityRole="button"
              accessibilityLabel="Next"
              hitSlop={12}
              style={({ pressed }) => [
                reviewStyles.chevronBtn,
                pressed && pressedDim,
              ]}
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={colors.labelTertiary}
              />
            </Pressable>
          ) : (
            <View style={reviewStyles.chevronBtn} />
          )}
        </View>
      </View>
    </View>
  );
}

function OfficerTrooperView() {
  return (
    <View style={officerStyles.page}>
      <View style={officerStyles.titleBlock}>
        <Text style={officerStyles.eyebrow}>Stay informed</Text>
        <Text style={officerStyles.title}>Know the difference:</Text>
      </View>

      <View style={officerStyles.cardsRow}>
        <View style={officerStyles.card}>
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

        <View style={officerStyles.divider} />

        <View style={officerStyles.card}>
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
    </View>
  );
}

function ContentView({
  illustration,
  title,
  bullets,
}: {
  illustration: ReactNode;
  title: string;
  bullets: ReactNode[];
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
    />
  );
}

function WhatToSayView({
  showFirearm,
  disclosureDuty,
}: {
  showFirearm: boolean;
  disclosureDuty: DisclosureDuty;
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
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 8,
  },
  dragWrapper: {
    paddingTop: 16,
    alignItems: 'center',
  },
  phaseContainer: {
    flex: 1,
    paddingTop: 24,
  },
});

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.red,
  },
  label: {
    ...typography.footnoteEmphasized,
    color: colors.black,
  },
  dotSeparator: {
    ...typography.footnoteRegular,
    color: colors.mutedTertiary,
  },
  timer: {
    // Tabular figures so the seconds digits don't jiggle as they
    // change (default proportional figures shift width per glyph).
    ...typography.footnoteRegular,
    color: colors.mutedSecondary,
    fontVariant: ['tabular-nums'],
  },
});

const armedStyles = StyleSheet.create({
  page: {
    flex: 1,
    gap: 40,
  },
  titleBlock: {
    gap: 8,
  },
  eyebrow: {
    ...typography.title1Regular,
    color: colors.labelTertiary,
  },
  title: {
    ...typography.title1Emphasized,
    color: colors.black,
  },
  answersWrapper: {
    flex: 1,
    gap: 48,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  answerCard: {
    height: 100,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.white,
    justifyContent: 'center',
    // A22 / P1: was inline (height:1, opacity:0.15, radius:3, elevation:2)
    // — exact match to shadows.e1. Replaced with the canonical spread per
    // design-system.md §1.3 drift note.
    ...shadows.e1,
  },
  answerContent: {
    // P2: was width: 238 — magic number that clipped at iPhone SE
    // viewport and under large Dynamic Type. flex: 1 fills the card's
    // available content area (parent is width: '100%' with 16pt
    // padding) responsively at any viewport, which is the real fix —
    // not a grid alignment concern. Per design-system.md §4.8
    // (every state designed) + §1.6 (avoid magic constants).
    //
    // justifyContent: 'center' centers the title+subtitle block vertically
    // within the card. Without it the single-line "Prefer not to answer"
    // card reads top-aligned next to its two-line siblings (Yes/No) —
    // user-flagged 2026-06-01.
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  answerTitle: {
    ...typography.bodyEmphasized,
    color: colors.black,
  },
  answerSubtitle: {
    ...typography.subheadlineRegular,
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
    gap: 8,
    alignItems: 'center',
  },
  title: {
    // P3: dynamicType on transition title — sets emotional tone after
    // armed check; users with Large Accessibility type need scaled
    // copy. Skip relaxedLineHeight (header per design-system.md §1.4
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
  // Subtle "Tap to continue" hint — much smaller than title/subtitle
  // so it doesn't compete with the calming message but sits visible
  // enough that users discover the skip-ahead affordance. Spaced
  // 24pt below the subtitle so it reads as separate UI hint, not
  // continuation of the message.
  skipHint: {
    ...typography.footnoteRegular,
    color: colors.labelTertiary,
    textAlign: 'center',
    marginTop: 24,
    opacity: 0.7,
  },
});

const guidanceStyles = StyleSheet.create({
  page: {
    flex: 1,
    gap: 24,
    // +8pt additional horizontal padding on top of the modal-level 16pt
    // (styles.safe), bringing the guidance phase's effective gutter to
    // 24pt. The bullet-heavy register reads tighter than the rest of
    // the modal phases (armed cards, contact avatar block, review hero
    // illustrations) and benefits from extra breathing room.
    paddingHorizontal: 8,
  },
  titleBlock: {
    gap: 8,
  },
  eyebrow: {
    ...typography.title1Regular,
    color: colors.labelTertiary,
  },
  title: {
    ...typography.title1Emphasized,
    color: colors.black,
  },
  bullets: {
    // Figma uses gap-[8px] between <li>s; we mirror that here. Bullets
    // are now rendered as flex rows (dot + text columns) below.
    gap: 8,
    paddingLeft: 18, // matches Figma's ms-[30px] (page padding 16 + 14 ≈ 30)
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
  readAloudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    // P5: paddingVertical 8 → 12 brings the painted height to 56pt
    // (32pt icon + 12×2 = 56). Earlier value (8) produced ~35pt
    // painted, with hitSlop:12 papering over the visual-to-touch gap.
    // .cursorrules + design-system.md §4.3 explicitly forbid papering
    // a sub-44pt visual with hitSlop — drop the hitSlop now that the
    // painted area is comfortable on its own.
    paddingVertical: 12,
  },
  readAloudText: {
    ...typography.subheadlineEmphasized,
    color: colors.mutedTertiary,
  },
  spacer: {
    flex: 1,
  },
  recordingWidget: {
    backgroundColor: colors.systemGroupedBackground,
    borderRadius: 20,
    padding: 16,
    gap: 8,
    alignItems: 'center',
  },
  recordingTextBlock: {
    gap: 2,
    alignItems: 'center',
  },
  recordingLabel: {
    // P4: dynamicType so the widget scales with user font preference
    // (this is the recording focal point — must scale with content).
    ...dynamicType(typography.bodyRegular),
    color: colors.black,
  },
  recordingTimer: {
    // P4: promoted from subheadlineRegular (15pt) to bodyRegular (17pt)
    // so the live counter is at least as prominent as the label above
    // it — was inverted (timer 1pt SMALLER than its label). The timer
    // is what users actually watch; hierarchy now puts the data on the
    // same visual tier as its label. Plus dynamicType per the same
    // reasoning as recordingLabel.
    ...dynamicType(typography.bodyRegular),
    color: colors.mutedSecondary,
    fontVariant: ['tabular-nums'],
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: WAVEFORM_MAX_HEIGHT + 8,
    paddingVertical: 4,
    width: '100%',
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.red,
  },
  recordingFootnote: {
    ...typography.caption1Regular,
    color: colors.mutedTertiary,
    textAlign: 'center',
  },
  // Wiltedgreen-outline pill (mirrors Contact's Text button) — quieter
  // than freshgreen-fill, conserving the freshgreen for genuine primary
  // actions like Call. The "we're recording during a stop" register
  // wants reserved, not cheerful.
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: colors.wiltedgreen,
    backgroundColor: colors.white,
  },
  continueText: {
    ...typography.subheadlineEmphasized,
    color: colors.wiltedgreen,
  },
});

const contactStyles = StyleSheet.create({
  page: {
    flex: 1,
    gap: 40,
  },
  topContent: {
    gap: 48,
  },
  titleBlock: {
    gap: 8,
  },
  title: {
    ...typography.title1Regular,
    color: colors.black,
  },
  subtitle: {
    ...typography.subheadlineRegular,
    // P9: mutedTertiary (rgba(80,80,80,0.7)) at 15pt = ~3.0-3.5:1 contrast,
    // below WCAG AA for normal text. This is reassuring informational copy
    // user needs to read, not decorative metadata — labelTertiary (#3D3D3D)
    // is the intended token for tertiary-text-that-still-must-read. Per
    // design-system.md §1.1.
    color: colors.labelTertiary,
  },
  avatarBlock: {
    gap: 16,
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
    borderRadius: 80,
    borderWidth: 3,
    borderColor: colors.fadedgreen,
  },
  avatarRingMiddle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.wiltedgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    ...typography.largeTitleEmphasized,
    color: colors.white,
  },
  contactName: {
    ...typography.title2Regular,
    color: colors.black,
    textAlign: 'center',
  },
  buttonsBlock: {
    gap: 16,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    width: '100%',
    // wiltedgreen for WCAG AA contrast on the white "Call" text
    // (matches the post-#148 primary-CTA register).
    backgroundColor: colors.wiltedgreen,
    borderRadius: 1000,
    // A22 / P8: was inline (height:1, opacity:0.15, radius:3, elevation:2)
    // — exact match to shadows.e1. Same fix class as the armed answer
    // card (P1). Per design-system.md §1.3.
    ...shadows.e1,
  },
  callBtnText: {
    ...typography.subheadlineEmphasized,
    color: colors.white,
  },
  textBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    width: '100%',
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: colors.wiltedgreen,
  },
  textBtnText: {
    ...typography.subheadlineEmphasized,
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
    ...typography.subheadlineRegular,
    color: colors.labelTertiary,
    textDecorationLine: 'underline',
  },
  footerHint: {
    alignItems: 'center',
  },
  footerHintText: {
    ...typography.footnoteRegular,
    // P10: instructional copy ("Swipe down on the gray slider...") at
    // 13pt + 70% gray = ~3.5:1 contrast. Same fix class as P9 — promote
    // to labelTertiary for readable instruction. Per design-system.md §1.1.
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
    gap: 16,
    paddingBottom: 8,
  },
  // 44pt visible tap target — paddingVertical:13 brings the ~18pt
  // footnoteRegular "Back" link to a 44pt painted height per HIG.
  // Earlier this leaned on hitSlop, but .cursorrules' tap-target rule
  // is explicit: hitSlop is for the *genuinely constrained* case, not
  // a workaround for sub-44pt visuals. The footer has room for the
  // paint; promote the visual.
  closeBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 13,
    paddingHorizontal: 4,
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
    ...typography.title3Regular,
    color: colors.black,
  },
  bullets: {
    gap: 16,
    width: '100%',
    alignItems: 'flex-start',
  },
  bullet: {
    // P11: was calloutRegular (16pt) — every other ContentView bullet
    // in this file uses title3Regular (20pt) wrapped in
    // dynamicType(relaxedLineHeight(...)). OfficerTrooper was the lone
    // 16pt static outlier; users flipping through review views saw
    // bullets visibly shrink on the first sub-view. Promote to match
    // the GuidanceBullet / Bullet pattern. Per design-system.md §1.4, §4.12.
    ...dynamicType(relaxedLineHeight(typography.title3Regular)),
    color: colors.black,
  },
  emphasis: {
    // Inline emphasis weight inside Officer/Trooper card bullets.
    // Pulls from the typography token instead of an inline literal so
    // weight changes flow through one source.
    fontWeight: typography.bodyEmphasized.fontWeight,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.dividerNeutral,
    marginVertical: 16,
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
    gap: 40,
    alignItems: 'center',
    paddingBottom: 16,
  },
  illustrationBox: {
    // P12: was fixed width/height 320 — original iPhone SE (320pt viewport)
    // with 16pt horizontal padding leaves only 288pt for content, causing
    // the 320pt illustration to overflow. width:'100%' + aspectRatio:1
    // makes the box fluid; maxWidth caps the square proportion on larger
    // viewports so the visual stays as designed. Per design-system.md §4.2.
    width: '100%',
    aspectRatio: 1,
    maxWidth: 320,
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

// Review hero illustrations (`pulled-over-stopped/provide/say/know`)
// are square @3x PNGs (~960×960). Display at 280pt inside the 320pt
// illustrationBox so there's ~20pt breathing room on each side.
const reviewIllustrationStyles = StyleSheet.create({
  square: {
    width: 280,
    height: 280,
  },
});
