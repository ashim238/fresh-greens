import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RecordingStatus } from '../lib/recording-session';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const WAVEFORM_MIN_HEIGHT = 4;
const WAVEFORM_MAX_HEIGHT = 64;
const METERING_FLOOR_DB = -60;
const METERING_CEILING_DB = -10;

const staticStates: Record<
  Exclude<RecordingStatus, 'recording' | 'discarded'>,
  readonly [title: string, detail: string]
> = {
  idle: ['Preparing recording', 'Your guidance is ready below'],
  'requesting-permission': [
    'Preparing recording',
    'Your guidance is ready below',
  ],
  saving: ['Saving recording', 'Keep this screen open'],
  saved: ['Recording saved', 'Saved on this phone'],
  unavailable: [
    'Microphone unavailable',
    'Your guidance continues below',
  ],
  'save-error': [
    'Recording needs attention',
    'Retry or discard the recording above',
  ],
};

type PulledOverRecordingCardProps = {
  status: RecordingStatus;
  elapsed: number;
  meteringHistory: number[];
  reduceMotion: boolean;
  onStopRecording: () => void;
};

/** Convert one dB sample to a bar height in pt. Clamped to [min, max]. */
function dbToBarHeight(db: number): number {
  const normalized = Math.max(
    0,
    Math.min(
      1,
      (db - METERING_FLOOR_DB) /
        (METERING_CEILING_DB - METERING_FLOOR_DB),
    ),
  );
  return (
    WAVEFORM_MIN_HEIGHT +
    normalized * (WAVEFORM_MAX_HEIGHT - WAVEFORM_MIN_HEIGHT)
  );
}

function Waveform({
  history,
  reduceMotion,
}: {
  history: number[];
  reduceMotion: boolean;
}) {
  return (
    <View style={styles.waveformRow}>
      {history.map((db, index) => (
        <View
          key={index}
          style={[
            styles.waveformBar,
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

export function PulledOverRecordingCard({
  status,
  elapsed,
  meteringHistory,
  reduceMotion,
  onStopRecording,
}: PulledOverRecordingCardProps) {
  const [recordingLabelStarted, setRecordingLabelStarted] = useState(
    status === 'recording' && !reduceMotion,
  );

  useEffect(() => {
    if (status !== 'recording' || reduceMotion) {
      setRecordingLabelStarted(false);
      return;
    }

    setRecordingLabelStarted(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const timer = setTimeout(() => setRecordingLabelStarted(false), 1500);
    return () => clearTimeout(timer);
  }, [reduceMotion, status]);

  if (status === 'discarded') return null;

  if (status !== 'recording') {
    const [title, detail] = staticStates[status];
    return (
      <View style={styles.recordingWidget}>
        <Text style={styles.recordingLabel}>{title}</Text>
        <Text style={styles.recordingDetail}>{detail}</Text>
      </View>
    );
  }

  const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const seconds = (elapsed % 60).toString().padStart(2, '0');
  const timeString = `00:${minutes}:${seconds}`;

  return (
    <View style={styles.recordingWidget}>
      <View style={styles.recordingTextBlock}>
        <Text style={styles.recordingLabel}>
          {recordingLabelStarted ? 'Recording started' : 'Recording…'}
        </Text>
        <Text style={styles.recordingTimer}>{timeString}</Text>
      </View>

      <Waveform history={meteringHistory} reduceMotion={reduceMotion} />

      <Pressable
        onPress={onStopRecording}
        accessibilityRole="button"
        accessibilityLabel="Stop recording"
        style={({ pressed }) => [
          styles.stopRecordingBtn,
          pressed && pressedDim,
        ]}
      >
        <Text style={styles.stopRecordingText}>Stop recording</Text>
      </Pressable>

      <Text style={styles.recordingFootnote}>
        Saved on this phone when you stop
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  recordingWidget: {
    backgroundColor: colors.surfaceTinted,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  recordingTextBlock: {
    gap: spacing.xs,
    alignItems: 'center',
  },
  recordingLabel: {
    ...dynamicType(typography.bodyRegular),
    color: colors.black,
    textAlign: 'center',
  },
  recordingTimer: {
    ...dynamicType(typography.bodyRegular),
    color: colors.labelTertiary,
    fontVariant: ['tabular-nums'],
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: WAVEFORM_MAX_HEIGHT + spacing.sm,
    paddingVertical: spacing.xs,
    width: '100%',
  },
  waveformBar: {
    width: 3,
    borderRadius: radii.xs,
    backgroundColor: colors.severityCritical,
  },
  recordingFootnote: {
    ...dynamicType(typography.caption1Regular),
    color: colors.labelTertiary,
    textAlign: 'center',
  },
  recordingDetail: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.labelTertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  stopRecordingBtn: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.labelTertiary,
  },
  stopRecordingText: {
    ...dynamicType(typography.footnoteEmphasized),
    color: colors.labelSecondary,
  },
});
