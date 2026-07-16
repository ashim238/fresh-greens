import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  clearAllRecordings,
  getRecordings,
  removeRecording,
  type Recording,
} from '../../lib/api/recordings';
import { useRecordings } from '../../hooks/useRecordings';

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('../../lib/api/recordings', () => ({
  addRecording: jest.fn(),
  clearAllRecordings: jest.fn(),
  getRecordings: jest.fn(),
  removeRecording: jest.fn(),
}));

const mockClearAllRecordings = jest.mocked(clearAllRecordings);
const mockGetRecordings = jest.mocked(getRecordings);
const mockRemoveRecording = jest.mocked(removeRecording);

const recordings: Recording[] = [
  {
    id: 'rec-newer',
    uri: 'file:///documents/recordings/rec-newer.m4a',
    createdAt: 2_000,
    durationMs: 1_750,
    armed: 'yes',
  },
  {
    id: 'rec-older',
    uri: 'file:///documents/recordings/rec-older.m4a',
    createdAt: 1_000,
    durationMs: 3_250,
    armed: 'preferred-not-to-answer',
  },
];

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('useRecordings clearAll', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRecordings.mockResolvedValue(recordings);
    mockClearAllRecordings.mockResolvedValue(undefined);
  });

  test('rejects clearAll during hydration without hiding the eventual recordings', async () => {
    const pendingHydration = deferred<Recording[]>();
    mockGetRecordings.mockReturnValue(pendingHydration.promise);
    const { result } = await renderHook(() => useRecordings());

    expect(result.current.ready).toBe(false);

    let clearResult!: Awaited<
      ReturnType<typeof result.current.clearAll.run>
    >;
    await act(async () => {
      clearResult = await result.current.clearAll.run(undefined);
    });

    expect(clearResult).toEqual({
      ok: false,
      error: new Error('Recordings are not ready'),
    });
    expect(mockClearAllRecordings).not.toHaveBeenCalled();
    expect(result.current.ready).toBe(false);

    pendingHydration.resolve(recordings);
    await waitFor(() => {
      expect(
        result.current.ready &&
          result.current.ok &&
          result.current.recordings,
      ).toBe(recordings);
    });
  });

  test('keeps clearAll.run stable across rerender and hydration', async () => {
    const pendingHydration = deferred<Recording[]>();
    mockGetRecordings.mockReturnValue(pendingHydration.promise);
    const { result, rerender } = await renderHook(() => useRecordings());
    const initialRun = result.current.clearAll.run;

    await rerender(undefined);
    expect(result.current.clearAll.run).toBe(initialRun);

    pendingHydration.resolve(recordings);
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    expect(result.current.clearAll.run).toBe(initialRun);
  });

  test('optimistically clears the list through the bulk adapter once', async () => {
    const pendingClear = deferred<void>();
    mockClearAllRecordings.mockReturnValue(pendingClear.promise);
    const { result } = await renderHook(() => useRecordings());

    await waitFor(() => {
      expect(
        result.current.ready &&
          result.current.ok &&
          result.current.recordings,
      ).toEqual(recordings);
    });

    let clearResult!: ReturnType<typeof result.current.clearAll.run>;
    await act(() => {
      clearResult = result.current.clearAll.run(undefined);
    });

    expect(mockClearAllRecordings).toHaveBeenCalledTimes(1);
    expect(mockRemoveRecording).not.toHaveBeenCalled();
    expect(
      result.current.ready && result.current.ok && result.current.recordings,
    ).toEqual([]);

    await act(async () => {
      pendingClear.resolve();
      await clearResult;
    });
  });

  test('restores the complete recording snapshot when the bulk adapter fails', async () => {
    const clearError = new Error('recording storage unavailable');
    mockClearAllRecordings.mockRejectedValue(clearError);
    const { result } = await renderHook(() => useRecordings());

    await waitFor(() => {
      expect(
        result.current.ready &&
          result.current.ok &&
          result.current.recordings,
      ).toEqual(recordings);
    });

    await act(async () => {
      await result.current.clearAll.run(undefined);
    });

    expect(mockClearAllRecordings).toHaveBeenCalledTimes(1);
    expect(mockRemoveRecording).not.toHaveBeenCalled();
    expect(
      result.current.ready && result.current.ok && result.current.recordings,
    ).toBe(recordings);
  });
});
