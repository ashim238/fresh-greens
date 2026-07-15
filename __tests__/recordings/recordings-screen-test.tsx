import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';

import Recordings from '../../app/recordings';
import {
  type AddRecordingInput,
  type RecordingsState,
  useRecordings,
} from '../../hooks/useRecordings';
import type { Mutation, MutationResult } from '../../hooks/useMutation';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import type { Recording } from '../../lib/api/recordings';

const mockRouterBack = jest.fn();
const mockPlayerReplace = jest.fn();
const mockPlayerPlay = jest.fn();
const mockPlayerPause = jest.fn();
const mockShareAsync = jest.fn();

const mockPlayer = {
  replace: mockPlayerReplace,
  play: mockPlayerPlay,
  pause: mockPlayerPause,
};

const mockPlayerStatus = {
  id: 1,
  currentTime: 0,
  playbackState: 'ready',
  timeControlStatus: 'paused',
  reasonForWaitingToPlay: '',
  mute: false,
  duration: 0,
  playing: false,
  loop: false,
  didJustFinish: false,
  isBuffering: false,
  isLoaded: true,
  playbackRate: 1,
  shouldCorrectPitch: true,
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockRouterBack }),
}));

jest.mock('expo-audio', () => ({
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => mockPlayerStatus,
}));

jest.mock('expo-sharing', () => ({
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

jest.mock('react-native-safe-area-context', () => {
  const safeAreaMock = jest.requireActual<{ default: object }>(
    'react-native-safe-area-context/jest/mock',
  );
  return safeAreaMock.default;
});

jest.mock('../../hooks/useRecordings', () => ({
  useRecordings: jest.fn(),
}));

jest.mock('../../hooks/useReduceMotion', () => ({
  useReduceMotion: jest.fn(),
}));

const mockUseRecordings = jest.mocked(useRecordings);
const mockUseReduceMotion = jest.mocked(useReduceMotion);
const mockAddRun = jest.fn<
  Promise<MutationResult<Recording>>,
  [AddRecordingInput]
>();
const mockRemoveRun = jest.fn<Promise<MutationResult<void>>, [string]>();
const mockClearAllRun = jest.fn<Promise<MutationResult<void>>, [void]>();
const mockAddReset = jest.fn();
const mockRemoveReset = jest.fn();
const mockClearAllReset = jest.fn();

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

function mutation<I, T>(
  run: Mutation<I, T>['run'],
  reset: () => void,
): Mutation<I, T> {
  return {
    run,
    status: 'idle',
    error: null,
    reset,
  };
}

function readyState(): RecordingsState {
  return {
    ready: true,
    ok: true,
    recordings,
    add: mutation(mockAddRun, mockAddReset),
    remove: mutation(mockRemoveRun, mockRemoveReset),
    clearAll: mutation(mockClearAllRun, mockClearAllReset),
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const deleteAllLabel = "Yes, I'm sure — delete all recordings";

describe('Recordings screen delete all', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRecordings.mockReturnValue(readyState());
    mockUseReduceMotion.mockReturnValue(true);
    mockAddRun.mockResolvedValue({ ok: true, data: recordings[0] });
    mockRemoveRun.mockResolvedValue({ ok: true, data: undefined });
    mockClearAllRun.mockResolvedValue({ ok: true, data: undefined });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('cleans up playback and keeps confirmation visible while one atomic clear is pending', async () => {
    const pendingClear = deferred<MutationResult<void>>();
    mockClearAllRun.mockReturnValue(pendingClear.promise);
    await render(<Recordings />);

    await fireEvent.press(
      screen.getAllByRole('button', { name: /^Play / })[0],
    );
    await waitFor(() => {
      expect(mockPlayerReplace).toHaveBeenCalledWith({ uri: recordings[0].uri });
      expect(mockPlayerPlay).toHaveBeenCalledTimes(1);
    });

    await fireEvent.press(
      screen.getByRole('button', { name: 'Delete all recordings' }),
    );
    const confirmPress = fireEvent.press(
      screen.getByRole('button', { name: deleteAllLabel }),
    );

    await waitFor(() => {
      expect({
        clearAllCalls: mockClearAllRun.mock.calls.length,
        removeCalls: mockRemoveRun.mock.calls.length,
      }).toEqual({ clearAllCalls: 1, removeCalls: 0 });
    });
    expect(mockPlayerPause).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', {
        name: deleteAllLabel,
        disabled: true,
        busy: true,
      }),
    ).toBeTruthy();

    await act(async () => {
      pendingClear.resolve({ ok: true, data: undefined });
      await confirmPress;
    });
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: deleteAllLabel }),
      ).toBeNull();
    });
  });

  test('keeps confirmation available and shows the recordings error when atomic clear fails', async () => {
    const clearError = new Error('recording storage unavailable');
    mockClearAllRun.mockResolvedValue({ ok: false, error: clearError });
    await render(<Recordings />);

    await fireEvent.press(
      screen.getByRole('button', { name: 'Delete all recordings' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: deleteAllLabel }),
    );

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Couldn't save your recording",
        'Try again in a moment.',
      );
    });
    expect(mockClearAllRun).toHaveBeenCalledTimes(1);
    expect(mockRemoveRun).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', {
        name: deleteAllLabel,
        disabled: false,
        busy: false,
      }),
    ).toBeTruthy();
  });
});
