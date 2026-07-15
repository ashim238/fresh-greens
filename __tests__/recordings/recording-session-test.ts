import type { Recording } from '../../lib/api/recordings';
import {
  persistRecordingInput,
  stopAndPersistRecording,
} from '../../lib/recording-session';

const storedRecording: Recording = {
  id: 'rec-1',
  uri: 'file:///documents/recordings/rec-1.m4a',
  createdAt: 1_000,
  durationMs: 1_500,
  armed: 'no',
};

describe('recording persistence coordinator', () => {
  test('stops and persists a recording shorter than two seconds', async () => {
    const recorder = {
      isRecording: true,
      uri: 'file:///cache/capture.m4a',
      stop: jest.fn().mockResolvedValue(undefined),
    };
    const persist = jest
      .fn()
      .mockResolvedValue({ ok: true, data: storedRecording });

    const result = await stopAndPersistRecording({
      recorder,
      startedAt: 1_000,
      armed: 'no',
      now: () => 2_500,
      persist,
    });

    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith({
      sourceUri: 'file:///cache/capture.m4a',
      durationMs: 1_500,
      armed: 'no',
      createdAt: 1_000,
    });
    expect(result.ok).toBe(true);
  });

  test('returns retry input when persistence fails', async () => {
    const persistError = new Error('storage unavailable');
    const persist = jest
      .fn()
      .mockResolvedValue({ ok: false, error: persistError });

    const result = await stopAndPersistRecording({
      recorder: {
        isRecording: true,
        uri: 'file:///cache/capture.m4a',
        stop: jest.fn().mockResolvedValue(undefined),
      },
      startedAt: 3_000,
      armed: 'yes',
      now: () => 4_250,
      persist,
    });

    expect(result).toEqual({
      ok: false,
      stage: 'persist',
      error: persistError,
      retryInput: {
        sourceUri: 'file:///cache/capture.m4a',
        durationMs: 1_250,
        armed: 'yes',
        createdAt: 3_000,
      },
    });
  });

  test('retries persistence without stopping the recorder twice', async () => {
    const recorder = {
      isRecording: true,
      uri: 'file:///cache/capture.m4a',
      stop: jest.fn().mockResolvedValue(undefined),
    };
    const firstError = new Error('storage unavailable');
    const persist = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, error: firstError })
      .mockResolvedValueOnce({ ok: true, data: storedRecording });

    const firstResult = await stopAndPersistRecording({
      recorder,
      startedAt: 5_000,
      armed: null,
      now: () => 5_900,
      persist,
    });

    expect(firstResult.ok).toBe(false);
    if (firstResult.ok || !firstResult.retryInput) {
      throw new Error('Expected persistence failure to retain retry input');
    }

    const retryResult = await persistRecordingInput(
      firstResult.retryInput,
      persist,
    );

    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(2);
    expect(retryResult).toEqual({ ok: true, recording: storedRecording });
  });

  test('never persists when stopping fails', async () => {
    const stopError = new Error('recorder stop failed');
    const persist = jest.fn();

    const result = await stopAndPersistRecording({
      recorder: {
        isRecording: true,
        uri: 'file:///cache/capture.m4a',
        stop: jest.fn().mockRejectedValue(stopError),
      },
      startedAt: 7_000,
      armed: 'preferred-not-to-answer',
      persist,
    });

    expect(persist).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      stage: 'stop',
      error: stopError,
    });
  });

  test('never reports success when the recorder has no URI', async () => {
    const persist = jest.fn();

    const result = await stopAndPersistRecording({
      recorder: {
        isRecording: false,
        uri: null,
        stop: jest.fn().mockResolvedValue(undefined),
      },
      startedAt: 9_000,
      armed: 'no',
      persist,
    });

    expect(persist).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      stage: 'source',
      error: new Error('Recorder did not provide an audio URI'),
    });
  });

  test('normalizes non-Error persistence throws and retains retry input', async () => {
    const input = {
      sourceUri: 'file:///cache/capture.m4a',
      durationMs: 800,
      armed: null,
      createdAt: 11_000,
    };
    const persist = jest.fn().mockRejectedValue('disk full');

    const result = await persistRecordingInput(input, persist);

    expect(result).toEqual({
      ok: false,
      stage: 'persist',
      error: new Error('disk full'),
      retryInput: input,
    });
  });

  test('normalizes non-Error stop failures without retaining retry input', async () => {
    const persist = jest.fn();

    const result = await stopAndPersistRecording({
      recorder: {
        isRecording: true,
        uri: 'file:///cache/capture.m4a',
        stop: jest.fn().mockRejectedValue('stop unavailable'),
      },
      startedAt: 13_000,
      armed: null,
      persist,
    });

    expect(persist).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      stage: 'stop',
      error: new Error('stop unavailable'),
    });
  });
});
