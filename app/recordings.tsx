import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
// Phosphor deep-imports bypass the package's barrel index — see
// app/trusted-contact-setup.tsx for the longer note + tsconfig
// `paths` mapping that keeps TypeScript happy.
import { Microphone } from 'phosphor-react-native/src/icons/Microphone';
import { Pause } from 'phosphor-react-native/src/icons/Pause';
import { Play } from 'phosphor-react-native/src/icons/Play';
import { Share } from 'phosphor-react-native/src/icons/Share';
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { X } from 'phosphor-react-native/src/icons/X';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '../components/BackButton';
import { Button } from '../components/Button';
import { MetaSeparator, joinMetaParts } from '../components/MetaSeparator';
import { SafetyErrorMessage } from '../components/SafetyErrorMessage';
import {
  EmptyState as EmptyStateCard,
  LoadingState,
} from '../components/StateCard';
import { useRecordings } from '../hooks/useRecordings';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { getErrorMessage } from '../lib/error-message';
import type { ArmedAnswer, Recording } from '../lib/api/recordings';
import { colors } from '../theme/colors';
import { dynamicType, relaxedLineHeight } from '../theme/dynamic-type';
import { pressedDim, tapTarget44 } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
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
// Discriminated request for the destructive-confirm Modal: `'all'` (bulk
// delete) or `'single'` (per-row delete, carries id + createdAt so the
// dialog can name the recording's date). `null` = modal hidden.
type ConfirmRequest =
  | { mode: 'all' }
  | { mode: 'single'; id: string; createdAt: number }
  | null;

export default function Recordings() {
  const router = useRouter();
  const state = useRecordings();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackErrorId, setPlaybackErrorId] = useState<string | null>(null);
  // In-app destructive confirm per Figma 1133:12674. Built as an
  // overlay <Modal> rather than `Alert.alert` so the body can render
  // an inline emphasized "cannot" — native iOS Alert doesn't support
  // mid-sentence bold. Tap-outside or the X close in the top-right
  // both dismiss; only "Yes, I'm sure" proceeds.
  const [confirm, setConfirm] = useState<ConfirmRequest>(null);
  // Latched while the deletion is in flight. Keeps the modal open
  // with the confirm button in a loading state, disables the
  // trigger button so a fast double-tap can't re-fire the same
  // deletion, and stays true through the closure so unmount-during-
  // await is harmless (we just don't setShowDeleteAllConfirm(false)
  // on an unmounted component — React warns, but the work completed).
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  // Latched true for the rest of the session after a successful
  // delete-all so the empty state reads "Cleared." instead of the
  // cold-start "No recordings yet." Resets only on unmount / next
  // navigation away — a fresh visit to /recordings starts back at
  // the cold-start framing. Differentiates intentional deletion
  // from never-had-recordings.
  const [justDeletedAll, setJustDeletedAll] = useState(false);
  const reduceMotion = useReduceMotion();

  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  const isStateReady = state.ready;
  const isStateOk = state.ready && state.ok;

  useEffect(() => {
    if (!playingId) return;
    if (!state.ready || !state.ok) return;
    const target = state.recordings.find((r) => r.id === playingId);
    if (!target) return;
    try {
      player.replace({ uri: target.uri });
      player.play();
      setPlaybackErrorId(null);
    } catch (err) {
      // Group B: surface to the user. The user tapped play on a specific
      // row; show an inline error next to THAT row.
      void getErrorMessage('recordings', 'transient', err); // canonical [recordings:transient] log
      setPlaybackErrorId(playingId);
      setPlayingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingId, isStateReady, isStateOk]);

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
      setPlaybackErrorId(null);
      setPlayingId(id);
      return;
    }
    if (status?.playing) {
      player.pause();
    } else {
      player.play();
    }
  }

  async function handleShare(uri: string, createdAt: number) {
    try {
      await Sharing.shareAsync(uri, {
        dialogTitle: `Recording from ${formatTimestamp(createdAt)}`,
        mimeType: 'audio/m4a',
      });
    } catch (err) {
      const { title, body } = getErrorMessage('recordings', 'transient', err);
      Alert.alert(title, body);
    }
  }

  function handleDelete(id: string, createdAt: number) {
    setConfirm({ mode: 'single', id, createdAt });
  }

  function handleRequestDeleteAll() {
    setConfirm({ mode: 'all' });
  }

  function handleCancelConfirm() {
    if (isDeletingAll) return;
    setConfirm(null);
  }

  async function handleConfirmDelete() {
    if (!confirm) return;
    if (confirm.mode === 'all') {
      if (isDeletingAll) return;
      setIsDeletingAll(true);
      if (playingId) {
        try {
          player.pause();
        } catch {
          /* noop */
        }
        setPlayingId(null);
      }
      // Iterate the local snapshot — capture before the first run() in case
      // state.recordings is replaced by an in-flight optimistic.
      const ids = state.ready && state.ok ? state.recordings.map((r) => r.id) : [];
      const results = await Promise.all(ids.map((id) => state.remove.run(id)));
      const anyFailed = results.some((r) => !r.ok);
      setConfirm(null);
      setIsDeletingAll(false);
      if (anyFailed) {
        const firstFailed = results.find(
          (r): r is { ok: false; error: Error } => !r.ok,
        );
        const firstErr = firstFailed?.error;
        const { title, body } = getErrorMessage('recordings', 'transient', firstErr);
        Alert.alert(title, body);
        return;
      }
      setJustDeletedAll(true);
      return;
    }
    // mode === 'single' — single-row delete: pause playback if this row is
    // playing, then commit. Close the modal first so it doesn't briefly
    // show after the user confirmed.
    const { id } = confirm;
    if (playingId === id) {
      try {
        player.pause();
      } catch {
        /* noop — player may not have a source loaded */
      }
      setPlayingId(null);
    }
    setConfirm(null);
    const result = await state.remove.run(id);
    if (!result.ok) {
      const { title, body } = getErrorMessage('recordings', 'transient', result.error);
      Alert.alert(title, body);
      return;
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <BackButton onPress={handleBack} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleRow}>
            <Microphone size={48} color={colors.labelSecondary} weight="regular" />
            <Text style={styles.pageTitle}>Recordings</Text>
          </View>

          {!state.ready ? (
            <LoadingState text="Loading recordings…" />
          ) : !state.ok ? (
            <SafetyErrorMessage
              domain="load"
              disposition="transient"
              error={state.error}
            />
          ) : state.recordings.length === 0 ? (
            <EmptyStateCard
              icon={
                <Microphone size={56} color={colors.accent} weight="regular" />
              }
              headline={justDeletedAll ? 'All deleted.' : 'No recordings yet'}
              text={
                justDeletedAll
                  ? 'Your recordings have been removed. New captures from your safety flow will appear here.'
                  : 'Audio captures from your safety flow appear here.'
              }
            />
          ) : (
            <View style={styles.recordingsList}>
              {state.recordings.map((recording) => {
                const isActive = playingId === recording.id;
                const isPlaying = isActive && (status?.playing ?? false);
                return (
                  <View key={recording.id}>
                    <RecordingCard
                      recording={recording}
                      isActive={isActive}
                      isPlaying={isPlaying}
                      onTogglePlay={() => handleTogglePlay(recording.id)}
                      onDelete={() => handleDelete(recording.id, recording.createdAt)}
                      onShare={() => handleShare(recording.uri, recording.createdAt)}
                    />
                    {playbackErrorId === recording.id && (
                      <SafetyErrorMessage
                        domain="recordings"
                        disposition="transient"
                      />
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {state.ready && state.ok && state.recordings.length > 0 && (
          <View style={styles.deleteAllWrap}>
            <Button
              type="primary"
              fill="fill"
              text="Delete all recordings"
              onPress={handleRequestDeleteAll}
              accessibilityLabel="Delete all recordings"
              disabled={isDeletingAll}
              style={styles.deleteAllBtn}
            />
          </View>
        )}
      </SafeAreaView>

      {/*
        Destructive-confirm overlay per Figma 1133:12674. Built as a
        transparent <Modal> with a tap-anywhere-to-dismiss scrim plus
        an X close in the top-right of the card. `animationType` is
        gated on Reduce Motion — fade is gentle but the principle
        matches the rest of the app's animations-respect-accessibility
        rhythm.
      */}
      <Modal
        visible={confirm !== null}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={handleCancelConfirm}
        statusBarTranslucent
      >
        {/*
          Outer Pressable = the scrim. Tapping it dismisses.
          `accessible={false}` so VoiceOver doesn't announce the scrim
          as its own button — the modal's content (title, body, CTA)
          is what users hear. `accessibilityViewIsModal` is hoisted
          here (the topmost view inside <Modal>) so the entire subtree
          is scoped, not just the card.
        */}
        <Pressable
          style={styles.confirmScrim}
          onPress={handleCancelConfirm}
          accessible={false}
          accessibilityViewIsModal
        >
          {/*
            Inner Pressable swallows taps so they don't propagate up
            to the scrim's onPress. Without this, tapping the card
            itself would close the modal.
          */}
          <Pressable style={styles.confirmCard} onPress={() => {}}>
            <Pressable
              onPress={handleCancelConfirm}
              disabled={confirm?.mode === 'all' && isDeletingAll}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              // R7: the tap target is a transparent 44pt surface; the
              // visible affordance is the 32pt fillsTertiary circle
              // nested inside it. This keeps the HIG 44pt touch floor
              // (was 32pt + hitSlop, the exact paper-over §4.3 flags)
              // WITHOUT growing the gray circle to a weight that
              // competes with the title.
              style={({ pressed }) => [
                tapTarget44,
                styles.confirmCloseHit,
                pressed && pressedDim,
              ]}
            >
              <View style={styles.confirmCloseCircle}>
                <X size={20} color={colors.labelSecondary} weight="bold" />
              </View>
            </Pressable>
            <Text style={styles.confirmTitle}>
              {confirm?.mode === 'all'
                ? 'Are you sure you want to delete all recordings?'
                : confirm?.mode === 'single'
                  ? `Delete this recording from ${formatTimestamp(confirm.createdAt)}?`
                  : ''}
            </Text>
            <Text style={styles.confirmBody}>
              Deleted files{' '}
              <Text style={styles.confirmBodyEmphasis}>cannot</Text> be recovered.
            </Text>
            <Button
              type="primary"
              fill="fill"
              text={confirm?.mode === 'single' ? 'Yes, delete' : "Yes, I'm sure"}
              onPress={handleConfirmDelete}
              accessibilityLabel={
                confirm?.mode === 'single'
                  ? 'Yes, delete this recording'
                  : "Yes, I'm sure — delete all recordings"
              }
              accessibilityHint={
                confirm?.mode === 'single'
                  ? 'Permanently deletes this recording'
                  : undefined
              }
              loading={confirm?.mode === 'all' && isDeletingAll}
              style={styles.confirmActionBtn}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function RecordingCard({
  recording,
  isActive,
  isPlaying,
  onTogglePlay,
  onDelete,
  onShare,
}: {
  recording: Recording;
  isActive: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onDelete: () => void;
  onShare: () => void;
}) {
  const PlayPauseIcon = isPlaying ? Pause : Play;
  // R6: compose the timestamp + armed-status + duration into a single
  // VoiceOver label so the text stack is ONE focus stop, not two. The
  // play/delete buttons carry the timestamp but NOT the duration or
  // armed status, so collapsing the text to a bare role="none" would
  // drop that info — instead we make the stack one accessible node
  // that announces everything. Net per row: 3 stops (play · info ·
  // delete), down from 4, with no information lost.
  const armedLabel = recording.armed != null ? `${formatArmed(recording.armed)}, ` : '';
  const rowInfoLabel = `${formatTimestamp(recording.createdAt)}, ${armedLabel}${formatDuration(recording.durationMs)}`;
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
        // R4: hitSlop dropped — playButton is a 56pt painted surface,
        // already well above the 44pt floor. The 8pt slop extended the
        // hit region toward the adjacent delete button in a dense row,
        // risking an accidental delete-instead-of-play.
      >
        <PlayPauseIcon size={24} color={colors.white} weight="fill" />
      </Pressable>

      <View style={styles.cardTextStack} accessible accessibilityLabel={rowInfoLabel}>
        <View style={styles.cardTimestampRow}>
          {(() => {
            const { date, time } = formatTimestampParts(recording.createdAt);
            return joinMetaParts([date, time], {
              textStyle: styles.cardTimestamp,
              separatorStyle: styles.cardTimestampSeparator,
            });
          })()}
        </View>
        <View style={styles.cardSecondaryRow}>
          {recording.armed != null ? (
            <>
              <Text style={styles.cardSecondary}>{formatArmed(recording.armed)}</Text>
              <MetaSeparator style={styles.cardSecondarySeparator} />
              <Text style={styles.cardSecondary}>
                {formatDuration(recording.durationMs)}
              </Text>
            </>
          ) : (
            <Text style={styles.cardSecondary}>
              {formatDuration(recording.durationMs)}
            </Text>
          )}
        </View>
      </View>

      <Pressable
        onPress={onShare}
        style={({ pressed }) => [tapTarget44, pressed && pressedDim]}
        accessibilityRole="button"
        accessibilityLabel={`Share recording from ${formatTimestamp(recording.createdAt)}`}
      >
        <Share size={24} color={colors.labelTertiary} weight="regular" />
      </Pressable>

      <Pressable
        onPress={onDelete}
        style={({ pressed }) => [tapTarget44, pressed && pressedDim]}
        accessibilityRole="button"
        accessibilityLabel={`Delete recording from ${formatTimestamp(recording.createdAt)}`}
      >
        <Trash size={24} color={colors.labelTertiary} weight="regular" />
      </Pressable>
    </View>
  );
}

// --- Helpers -------------------------------------------------------------

function formatTimestampParts(ms: number): { date: string; time: string } {
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
  return { date, time };
}

function formatTimestamp(ms: number): string {
  const { date, time } = formatTimestampParts(ms);
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
    backgroundColor: colors.surfacePage,
  },
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xl,
  },
  // Title row — Microphone icon + "Recordings" title on one line per
  // Figma 1133:12468. Replaces v1's standalone pageTitle.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pageTitle: {
    ...dynamicType(typography.title2Emphasized),
    color: colors.black,
  },
  recordingsList: {
    // Intentional off-ramp value: 12 sits between spacing.sm (8) and
    // spacing.md (16). Kept numeric per theme/spacing.ts's "prefer the
    // closest step, but tuned values may stay numeric" guidance — 8
    // crowds the cards, 16 spreads them too far for a dense list.
    gap: 12,
  },
  // Recording card per Figma 1133:12483 — light gray Backgrounds/
  // Secondary fill with a subtle border. Inner content is the row
  // pattern from the EmptyState component (icon + text + icon).
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
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
    borderRadius: radii.pill,
    backgroundColor: colors.freshgreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextStack: {
    flex: 1,
    gap: spacing.sm,
  },
  cardTimestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  cardTimestamp: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
    // R5: tabular-nums so the timestamp ("May 28 · 3:42 PM") digits
    // hold a fixed column width across rows — proportional digits
    // shift the "·" separator and stagger the stack between rows.
    fontVariant: ['tabular-nums'],
  },
  cardTimestampSeparator: {
    ...dynamicType(typography.bodyEmphasized),
    color: colors.labelTertiary,
  },
  cardSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  cardSecondary: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.labelTertiary,
    // R5: duration strings ("0:12" vs "10:42") in the same column need
    // fixed-width digits so the colon stays aligned row-to-row. Same
    // convention as the /en-route ETA + HomeBrowseSheet rating values.
    fontVariant: ['tabular-nums'],
  },
  cardSecondarySeparator: {
    ...dynamicType(typography.subheadlineRegular),
    color: colors.labelTertiary,
  },
  // 44pt painted surface per HIG. Was 32pt + hitSlop:12 which met
  // the touch-area floor but violated the cursorrules "visual on the
  // painted surface, not just hit area" rule — sub-44pt visuals
  // train users to tap "near" rather than "on" the affordance.
  // Delete-all bar pinned at the bottom of the SafeArea — outside the
  // ScrollView so the button stays reachable regardless of list length.
  deleteAllWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  // Stretch so the button adapts to device width — the prior
  // hardcoded 326 overflowed iPhone SE (320pt logical width minus
  // 2×32pt deleteAllWrap padding = 256pt available). The
  // deleteAllWrap already provides 32pt horizontal padding.
  deleteAllBtn: {
    alignSelf: 'stretch',
  },
  // --- Destructive-confirm overlay (Figma 1133:12674) ---
  confirmScrim: {
    flex: 1,
    backgroundColor: colors.modalScrim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  // Centered card. 28pt radius matches the project's "sheet/card"
  // surface convention (ReportDetailCard, placement pin frame).
  // shadows.e2 — the elevation tier shadows.ts names for "content
  // above map" surfaces; a modal-over-scrim sits in the same class.
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: radii.sheet,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    ...shadows.e2,
  },
  // R7: transparent 44pt tap target. top/right are 10 (not a spacing
  // token — a geometry offset) so the nested 32pt circle's center
  // lands at the same point the old 32pt circle occupied (top/right
  // 16): 10 + 22 (half of 44) = 32 = 16 + 16 (half of the old 32).
  confirmCloseHit: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  // The visible affordance — a 32pt circle, unchanged in weight from
  // before R7. Subtle iOS-style fill so the X reads as tappable
  // against the white card. fillsTertiary (12% gray) signals
  // "tappable" without competing with the title for attention.
  confirmCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.fillsTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    // title3Regular per Held-Question rule — the confirm modal asks a
    // question (Stop? Delete?); Regular holds it as a prompt, not a command.
    ...dynamicType(typography.title3Regular),
    color: colors.black,
    // Reserve room under the absolutely-positioned X — without this
    // the title would visually collide with the close target.
    paddingRight: spacing.xl,
  },
  confirmBody: {
    ...dynamicType(typography.bodyRegular),
    color: colors.labelSecondary,
  },
  confirmBodyEmphasis: {
    // Inline emphasized run inside an otherwise-regular body sentence.
    // bodyEmphasized carries the weight (typography token already
    // defines fontWeight/fontFamily), so we just spread it.
    ...dynamicType(typography.bodyEmphasized),
    color: colors.black,
  },
  confirmActionBtn: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
});
