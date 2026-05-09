import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
// Phosphor deep-imports bypass the package's barrel index — see
// app/trusted-contact-setup.tsx for the longer note + tsconfig
// `paths` mapping that keeps TypeScript happy.
import { Microphone } from 'phosphor-react-native/src/icons/Microphone';
import { Pause } from 'phosphor-react-native/src/icons/Pause';
import { Play } from 'phosphor-react-native/src/icons/Play';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRecordings } from '../hooks/useRecordings';
import type { ArmedAnswer, Recording } from '../lib/api/recordings';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { typography } from '../theme/typography';

/**
 * Recordings — the audio captures from /pulled-over's safety flow.
 *
 * Pushed from /menu's Recordings row. Lists every saved recording
 * newest-first, with inline playback (single shared expo-audio
 * player; tapping play on a different row swaps the source). Each
 * row also has a trash affordance to delete the recording (file +
 * metadata).
 *
 * Empty state when nothing's stored yet — communicates that
 * recordings come from the safety flow, not from a "record now"
 * button on this screen. The /pulled-over flow is where capture
 * happens; this screen is the library.
 *
 * Visual register matches /menu and the rest of the wiltedgreen
 * onboarding/account flow. Recording cards use the burntgreen fill
 * established by /trusted-contact-setup's preview state and
 * /menu's contact card.
 *
 * Route: /recordings
 */
export default function Recordings() {
  const router = useRouter();
  const { recordings, loading, removeRecording } = useRecordings();
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Single shared player. Source starts empty; we call player.replace()
  // when the user picks a different recording. Cheaper than spinning
  // up N players (one per row) and avoids the multiple-players-can-
  // play-at-once bug.
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  // When playingId changes to a real recording, swap the player's
  // source and start playback. Wrapped in useEffect so the imperative
  // calls happen after the state commit, not during render.
  useEffect(() => {
    if (!playingId) return;
    const target = recordings.find((r) => r.id === playingId);
    if (!target) return;
    try {
      player.replace({ uri: target.uri });
      player.play();
    } catch (err) {
      console.warn('Failed to play recording', target.id, err);
      setPlayingId(null);
    }
    // recordings + player identities are stable; the trigger here is
    // the active id change. No state-related deps needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingId]);

  // Reset playingId when playback finishes naturally so the play
  // button on the row resets from "Pause" back to "Play."
  useEffect(() => {
    if (status?.didJustFinish) {
      setPlayingId(null);
    }
  }, [status?.didJustFinish]);

  function handleBack() {
    router.back();
  }

  function handleTogglePlay(id: string) {
    if (playingId !== id) {
      // Different recording — switching sources will trigger
      // play() via the effect above.
      setPlayingId(id);
      return;
    }
    // Same recording — toggle pause/resume.
    if (status?.playing) {
      player.pause();
    } else {
      player.play();
    }
  }

  async function handleDelete(id: string) {
    if (playingId === id) {
      try {
        player.pause();
      } catch {
        /* noop — player may not have a source loaded */
      }
      setPlayingId(null);
    }
    await removeRecording(id);
  }

  const showEmptyState = !loading && recordings.length === 0;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={({ pressed }) => [
              styles.headerBackBtn,
              pressed && pressedDim,
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={28}
              color={colors.white}
            />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageTitle}>Recordings</Text>

          {showEmptyState ? (
            <EmptyState />
          ) : (
            <View style={styles.recordingsList}>
              {recordings.map((recording) => {
                const isActive = playingId === recording.id;
                const isPlaying = isActive && (status?.playing ?? false);
                return (
                  <RecordingCard
                    key={recording.id}
                    recording={recording}
                    isActive={isActive}
                    isPlaying={isPlaying}
                    onTogglePlay={() => handleTogglePlay(recording.id)}
                    onDelete={() => handleDelete(recording.id)}
                  />
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// --- Sub-components ------------------------------------------------------

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Microphone
          size={56}
          color={colors.fadedgreen}
          weight="duotone"
        />
      </View>
      <Text style={styles.emptyTitle}>No recordings yet</Text>
      <Text style={styles.emptyBody}>
        Audio captures from your safety flow appear here. Recordings
        start automatically when you open the Pulled Over guide and
        save when you exit.
      </Text>
    </View>
  );
}

function RecordingCard({
  recording,
  isActive,
  isPlaying,
  onTogglePlay,
  onDelete,
}: {
  recording: Recording;
  isActive: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onDelete: () => void;
}) {
  const PlayPauseIcon = isPlaying ? Pause : Play;
  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      <Pressable
        onPress={onTogglePlay}
        style={({ pressed }) => [styles.playButton, pressed && pressedDim]}
        accessibilityRole="button"
        accessibilityLabel={
          isPlaying ? `Pause ${formatTimestamp(recording.createdAt)}` : `Play ${formatTimestamp(recording.createdAt)}`
        }
        accessibilityState={{ selected: isActive }}
        hitSlop={8}
      >
        <PlayPauseIcon
          size={22}
          color={colors.wiltedgreen}
          weight="fill"
        />
      </Pressable>

      <View style={styles.cardTextStack}>
        <Text style={styles.cardTimestamp}>
          {formatTimestamp(recording.createdAt)}
        </Text>
        <Text style={styles.cardSecondary}>
          {formatArmed(recording.armed)}
          {recording.armed != null ? ' · ' : ''}
          {formatDuration(recording.durationMs)}
        </Text>
      </View>

      <Pressable
        onPress={onDelete}
        style={({ pressed }) => [styles.deleteButton, pressed && pressedDim]}
        accessibilityRole="button"
        accessibilityLabel={`Delete recording from ${formatTimestamp(recording.createdAt)}`}
        hitSlop={12}
      >
        <Ionicons
          name="trash-outline"
          size={22}
          color={colors.fadedgreen}
        />
      </Pressable>
    </View>
  );
}

// --- Helpers -------------------------------------------------------------

/**
 * "May 6 · 3:42 PM" — month/day with no comma, separator, time. Year
 * appears only when the recording is from a different year, so the
 * usual case stays compact.
 */
function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const dateOptions: Intl.DateTimeFormatOptions = sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' };
  const date = new Intl.DateTimeFormat('en-US', dateOptions).format(d);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
  return `${date} · ${time}`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatArmed(armed: ArmedAnswer | null): string {
  switch (armed) {
    case 'yes':
      return 'Armed';
    case 'no':
      return 'Unarmed';
    case 'preferred-not-to-answer':
      return 'Undisclosed';
    default:
      return '';
  }
}

// --- Styles --------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.wiltedgreen,
  },
  safe: {
    flex: 1,
  },

  // --- Header ---
  header: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Scroll body ---
  scrollContent: {
    paddingHorizontal: 32,
    paddingBottom: 32,
    gap: 24,
  },
  pageTitle: {
    ...typography.title1Emphasized,
    color: colors.white,
  },

  // --- Recordings list ---
  recordingsList: {
    gap: 12,
  },

  // --- Card (matches /trusted-contact-setup preview + /menu contact card) ---
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.burntgreen,
  },
  cardActive: {
    // Subtle highlight when this is the active recording. Keeps the
    // burntgreen base; just thickens the border to mark "this one is
    // playing" without screaming.
    borderWidth: 1,
    borderColor: colors.fadedgreen,
    padding: 15, // compensate for borderWidth so total size unchanged
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextStack: {
    flex: 1,
    gap: 2,
  },
  cardTimestamp: {
    ...typography.bodyEmphasized,
    color: colors.white,
  },
  cardSecondary: {
    ...typography.subheadlineRegular,
    color: colors.fadedgreen,
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Empty state ---
  emptyState: {
    alignItems: 'center',
    gap: 16,
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.fadedgreen,
  },
  emptyIconWrap: {
    paddingVertical: 8,
  },
  emptyTitle: {
    ...typography.title3Emphasized,
    color: colors.white,
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.subheadlineRegular,
    color: colors.fadedgreen,
    textAlign: 'center',
  },
});
