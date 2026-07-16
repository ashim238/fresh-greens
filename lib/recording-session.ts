import type { AddRecordingInput, ArmedAnswer, Recording } from './api/recordings';

export type RecordingStatus =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'saving'
  | 'saved'
  | 'unavailable'
  | 'save-error'
  | 'discarded';

export type RecorderForPersistence = {
  isRecording: boolean;
  uri: string | null;
  stop: () => Promise<void>;
};

type PersistResult =
  | { ok: true; data: Recording }
  | { ok: false; error: Error };

export type RecordingPersist = (
  input: AddRecordingInput,
) => Promise<PersistResult>;

export type RecordingSaveResult =
  | { ok: true; recording: Recording }
  | {
      ok: false;
      stage: 'stop' | 'source' | 'persist';
      error: Error;
      retryInput?: AddRecordingInput;
    };

export async function persistRecordingInput(
  input: AddRecordingInput,
  persist: RecordingPersist,
): Promise<RecordingSaveResult> {
  try {
    const result = await persist(input);
    if (result.ok) return { ok: true, recording: result.data };
    return { ok: false, stage: 'persist', error: result.error, retryInput: input };
  } catch (raw) {
    const error = raw instanceof Error ? raw : new Error(String(raw));
    return { ok: false, stage: 'persist', error, retryInput: input };
  }
}

export async function stopAndPersistRecording({
  recorder,
  startedAt,
  armed,
  persist,
  now = Date.now,
}: {
  recorder: RecorderForPersistence;
  startedAt: number;
  armed: ArmedAnswer | null;
  persist: RecordingPersist;
  now?: () => number;
}): Promise<RecordingSaveResult> {
  if (recorder.isRecording) {
    try {
      await recorder.stop();
    } catch (raw) {
      const error = raw instanceof Error ? raw : new Error(String(raw));
      return { ok: false, stage: 'stop', error };
    }
  }
  if (!recorder.uri) {
    return {
      ok: false,
      stage: 'source',
      error: new Error('Recorder did not provide an audio URI'),
    };
  }
  return persistRecordingInput(
    {
      sourceUri: recorder.uri,
      durationMs: Math.max(0, now() - startedAt),
      armed,
      createdAt: startedAt,
    },
    persist,
  );
}
