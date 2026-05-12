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
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { EmptyState as EmptyStateCard } from '../components/StateCard';
import { useRecordings } from '../hooks/useRecordings';
import type { ArmedAnswer, Recording } from '../lib/api/recordings';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { typography } from '../theme/typography';

/**
 * Recordings — the audio captures from /pulled-over's safety flow.
 *
 * v2 redesign per Figma `1133:12323`: register flips from wiltedgreen-
 * on-dark to white-on-light to match /menu's redesigned register.
 * Recording rows use a light gray card (Backgrounds/Secondary) with
 * a freshgreen circular play button and a Trash affordance on the
 * right. "Delete all recordings" Primary Button at the bottom.
 *
 * Empty state uses the StateCard EmptyState component (the same
 * Default variant used on /trusted-contact-setup).
 *
 * Route: /recordings
 */
export default function Recordings() {
  const router = useRouter();
  const { recordings, loading, removeRecording } = useRecordings();
  const [playingId, setPlayingId] = useState<string | null>(null);

  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingId]);

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
      setPlayingId(id);
      return;
    }
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

  async function handleDeleteAll() {
    if (playingId) {
      try {
        player.pause();
      } catch {
        /* noop */
      }
      setPlayingId(null);
    }
    await Promise.all(recordings.map((r) => removeRecording(r.id)));
  }

  const showEmptyState = !loading && recordings.length === 0;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

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
            <Ionicons name="chevron-back" size={28} color={colors.black} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleRow}>
            <Microphone size={48} color={colors.black} weight="duotone" />
            <Text style={styles.pageTitle}>Recordings</Text>
          </View>

          {showEmptyState ? (
            <EmptyStateCard
              icon={
                <Microphone size={56} color={colors.freshgreen} weight="duotone" />
              }
              headline="No recordings yet"
              text="Audio captures from your safety flow appear here."
            />
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

        {!showEmptyState && (
          <View style={styles.deleteAllWrap}>
            <Button
              type="primary"
              fill="fill"
              text="Delete all recordings"
              onPress={handleDeleteAll}
              accessibilityLabel="Delete all recordings"
              style={styles.deleteAllBtn}
            />
          </View>
        )}
      </SafeAreaView>
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
          isPlaying
            ? `Pause ${formatTimestamp(recording.createdAt)}`
            : `Play ${formatTimestamp(recording.createdAt)}`
        }
        accessibilityState={{ selected: isActive }}
        hitSlop={8}
      >
        <PlayPauseIcon size={24} color={colors.white} weight="fill" />
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
        <Trash size={24} color={colors.labelTertiary} weight="regular" />
      </Pressable>
    </View>
  );
}

// --- Helpers -------------------------------------------------------------

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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 32,
  },
  // Title row — Microphone icon + "Recordings" title on one line per
  // Figma 1133:12468. Replaces v1's standalone pageTitle.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  pageTitle: {
    ...typography.title2Emphasized,
    color: colors.black,
  },
  recordingsList: {
    gap: 12,
  },
  // Recording card per Figma 1133:12483 — light gray Backgrounds/
  // Secondary fill with a subtle border. Inner content is the row
  // pattern from the EmptyState component (icon + text + icon).
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.systemGroupedBackground,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  cardActive: {
    // Highlight when this is the active recording — freshgreen border
    // signals "playing now" against the otherwise neutral row.
    borderColor: colors.freshgreen,
  },
  // Freshgreen circular play button per Figma 1133:12506. White icon
  // on the green fill (matches the "primary action" register from the
  // Button component).
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextStack: {
    flex: 1,
    gap: 8,
  },
  cardTimestamp: {
    ...typography.bodyEmphasized,
    color: colors.black,
  },
  cardSecondary: {
    ...typography.subheadlineRegular,
    color: colors.labelTertiary,
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Delete-all bar pinned at the bottom of the SafeArea — outside the
  // ScrollView so the button stays reachable regardless of list length.
  deleteAllWrap: {
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 8,
  },
  deleteAllBtn: {
    alignSelf: 'center',
    width: 326,
  },
});
