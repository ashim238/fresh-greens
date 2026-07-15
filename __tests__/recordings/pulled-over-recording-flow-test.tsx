import {
  act,
  cleanup,
  configure,
  fireEvent,
  render,
  resetToDefaults,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { NavigationAction } from '@react-navigation/routers';
import { AccessibilityInfo, Alert } from 'react-native';

import PulledOver from '../../app/pulled-over';
import type {
  AddRecordingInput,
  Recording,
} from '../../lib/api/recordings';

type PreventRemoveCallback = (event: {
  data: { action: NavigationAction };
}) => void;

const mockRouterBack = jest.fn();
const mockNavigationDispatch = jest.fn();
const mockRecorderStop = jest.fn<Promise<void>, []>();
const mockRecorderRecord = jest.fn();
const mockRecorderPrepare = jest.fn<Promise<void>, []>();
const mockRequestRecordingPermissions = jest.fn();
const mockSetAudioMode = jest.fn<Promise<void>, [unknown]>();
const mockAddRecording = jest.fn<Promise<Recording>, [AddRecordingInput]>();
const mockGetRecordings = jest.fn<Promise<Recording[]>, []>();

let mockPreventRemoveEnabled = false;
let mockPreventRemoveCallback: PreventRemoveCallback | null = null;
let mockNow = 1_000;

const mockRecorder = {
  isRecording: false,
  uri: 'file:///cache/pulled-over.m4a' as string | null,
  stop: mockRecorderStop,
  record: mockRecorderRecord,
  prepareToRecordAsync: mockRecorderPrepare,
};

jest.mock('@react-navigation/native', () => ({
  usePreventRemove: (
    enabled: boolean,
    callback: PreventRemoveCallback,
  ) => {
    mockPreventRemoveEnabled = enabled;
    mockPreventRemoveCallback = callback;
  },
}));

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({ back: mockRouterBack }),
    useNavigation: () => ({ dispatch: mockNavigationDispatch }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(callback, [callback]);
    },
  };
});

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: () =>
    mockRequestRecordingPermissions(),
  setAudioModeAsync: (options: unknown) => mockSetAudioMode(options),
  useAudioRecorder: () => mockRecorder,
  useAudioRecorderState: () => ({
    durationMillis: 0,
    metering: -60,
  }),
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Heavy: 'heavy', Medium: 'medium' },
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
}));

jest.mock('expo-location', () => ({
  Accuracy: { Lowest: 'lowest' },
  getCurrentPositionAsync: jest
    .fn()
    .mockRejectedValue(new Error('location unavailable in test')),
  reverseGeocodeAsync: jest.fn().mockResolvedValue([]),
}));

jest.mock('expo-contacts', () => ({
  Fields: { Addresses: 'addresses' },
  PermissionStatus: { GRANTED: 'granted' },
  getContactByIdAsync: jest.fn().mockResolvedValue(null),
  presentContactPickerAsync: jest.fn().mockResolvedValue(null),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
}));

jest.mock('react-native-safe-area-context', () => {
  const safeAreaMock = jest.requireActual<{ default: object }>(
    'react-native-safe-area-context/jest/mock',
  );
  return safeAreaMock.default;
});

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);

jest.mock('../../lib/api/recordings', () => ({
  addRecording: (input: AddRecordingInput) => mockAddRecording(input),
  clearAllRecordings: jest.fn().mockResolvedValue(undefined),
  getRecordings: () => mockGetRecordings(),
  removeRecording: jest.fn().mockResolvedValue(undefined),
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function recordingFor(input: AddRecordingInput): Recording {
  return {
    id: 'recording-1',
    uri: 'file:///documents/recordings/recording-1.m4a',
    createdAt: input.createdAt ?? mockNow,
    durationMs: input.durationMs,
    armed: input.armed,
  };
}

function recordingAnnouncementCount(message: string) {
  return jest
    .mocked(AccessibilityInfo.announceForAccessibility)
    .mock.calls.filter(([announcement]) => announcement === message).length;
}

function latestAlertButtons(): ReadonlyArray<{
  text?: string;
  onPress?: () => void;
}> {
  const calls = jest.mocked(Alert.alert).mock.calls;
  return (calls[calls.length - 1]?.[2] ?? []) as ReadonlyArray<{
    text?: string;
    onPress?: () => void;
  }>;
}

async function pressLatestAlertButton(label: string) {
  const button = latestAlertButtons().find((candidate) => candidate.text === label);
  expect(button).toBeDefined();
  await act(async () => {
    button?.onPress?.();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function chooseUnarmedAnswer() {
  await fireEvent.press(
    screen.getByRole('button', {
      name: 'No — I do not have a firearm, knife, or other weapon on me',
    }),
  );
}

async function enterGuidanceWithRecording() {
  await chooseUnarmedAnswer();
  await waitFor(() => {
    expect(mockRecorderRecord).toHaveBeenCalledTimes(1);
  });
  await fireEvent.press(
    screen.getByRole('button', { name: 'Continue to guidance' }),
  );
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Stop recording' }),
    ).toBeTruthy();
  });
}

async function requestDismissal(action: NavigationAction) {
  expect(mockPreventRemoveEnabled).toBe(true);
  expect(mockPreventRemoveCallback).not.toBeNull();
  await act(() => {
    mockPreventRemoveCallback?.({ data: { action } });
  });
  expect(Alert.alert).toHaveBeenCalledWith(
    'Recording in progress',
    'Your recording will be saved. Leave this screen?',
    expect.any(Array),
  );
}

describe('PulledOver recording flow', () => {
  beforeAll(() => {
    configure({ asyncUtilTimeout: 250 });
  });

  afterAll(() => {
    resetToDefaults();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPreventRemoveEnabled = false;
    mockPreventRemoveCallback = null;
    mockNow = 1_000;
    mockRecorder.isRecording = false;
    mockRecorder.uri = 'file:///cache/pulled-over.m4a';

    jest.spyOn(Date, 'now').mockImplementation(() => mockNow);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    mockGetRecordings.mockResolvedValue([]);
    mockRequestRecordingPermissions.mockResolvedValue({ granted: true });
    mockSetAudioMode.mockResolvedValue(undefined);
    mockRecorderPrepare.mockResolvedValue(undefined);
    mockRecorderRecord.mockImplementation(() => {
      mockRecorder.isRecording = true;
    });
    mockRecorderStop.mockImplementation(async () => {
      mockRecorder.isRecording = false;
    });
    mockAddRecording.mockImplementation(async (input) => recordingFor(input));
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  test('manual Stop stays in saving until persistence resolves and stops once', async () => {
    const pendingPersist = deferred<Recording>();
    mockAddRecording.mockReturnValueOnce(pendingPersist.promise);
    await render(<PulledOver />);
    await enterGuidanceWithRecording();
    mockNow = 2_500;

    const stopButton = screen.getByRole('button', { name: 'Stop recording' });
    await act(async () => {
      await fireEvent.press(stopButton);
      await fireEvent.press(
        stopButton,
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('Saving recording')).toBeTruthy();
    });
    expect(screen.queryByText('Recording saved')).toBeNull();
    expect(mockRecorderStop).toHaveBeenCalledTimes(1);
    expect(mockAddRecording).toHaveBeenCalledTimes(1);
    expect(recordingAnnouncementCount('Saving recording.')).toBe(1);
    expect(mockAddRecording).toHaveBeenCalledWith({
      sourceUri: 'file:///cache/pulled-over.m4a',
      durationMs: 1_500,
      armed: 'no',
      createdAt: 1_000,
    });

    await act(async () => {
      pendingPersist.resolve(recordingFor(mockAddRecording.mock.calls[0][0]));
      await pendingPersist.promise;
    });

    await waitFor(() => {
      expect(screen.getByText('Recording saved')).toBeTruthy();
    });
    expect(recordingAnnouncementCount('Saving recording.')).toBe(1);
    expect(recordingAnnouncementCount('Recording saved.')).toBe(1);
    expect(mockNavigationDispatch).not.toHaveBeenCalled();
  });

  test('Save & leave dispatches once only after saved commits and protection disarms', async () => {
    const pendingPersist = deferred<Recording>();
    mockAddRecording.mockReturnValueOnce(pendingPersist.promise);
    const action = { type: 'GO_BACK' } as NavigationAction;
    const dispatchSnapshots: Array<{
      action: NavigationAction;
      protected: boolean;
      savedCommitted: boolean;
    }> = [];
    mockNavigationDispatch.mockImplementation((dispatchedAction) => {
      dispatchSnapshots.push({
        action: dispatchedAction,
        protected: mockPreventRemoveEnabled,
        savedCommitted: screen.queryByText('Recording saved') !== null,
      });
    });
    await render(<PulledOver />);
    await enterGuidanceWithRecording();
    mockNow = 4_000;

    await requestDismissal(action);
    await pressLatestAlertButton('Save & leave');
    expect(mockRecorderStop).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText('Saving recording')).toBeTruthy();
    });
    expect(mockNavigationDispatch).not.toHaveBeenCalled();

    await act(async () => {
      pendingPersist.resolve(recordingFor(mockAddRecording.mock.calls[0][0]));
      await pendingPersist.promise;
    });

    await waitFor(() => {
      expect(mockNavigationDispatch).toHaveBeenCalledTimes(1);
    });
    expect(dispatchSnapshots).toEqual([
      { action, protected: false, savedCommitted: true },
    ]);
  });

  test('persistence failure shows save-error, retains retry input, and holds navigation', async () => {
    const persistError = new Error('recording storage unavailable');
    mockAddRecording.mockRejectedValueOnce(persistError);
    const action = { type: 'GO_BACK' } as NavigationAction;
    await render(<PulledOver />);
    await enterGuidanceWithRecording();
    mockNow = 4_000;

    await requestDismissal(action);
    await pressLatestAlertButton('Save & leave');

    await waitFor(() => {
      expect(screen.getByText('Recording needs attention')).toBeTruthy();
      expect(screen.getByText("Couldn't save your recording")).toBeTruthy();
    });
    expect(mockNavigationDispatch).not.toHaveBeenCalled();
    expect(mockPreventRemoveEnabled).toBe(true);
    expect(mockRecorderStop).toHaveBeenCalledTimes(1);
    expect(mockAddRecording).toHaveBeenCalledTimes(1);
  });

  test('Retry reuses retained input without stopping again and resumes pending navigation', async () => {
    const persistError = new Error('recording storage unavailable');
    const retryPersist = deferred<Recording>();
    mockAddRecording
      .mockRejectedValueOnce(persistError)
      .mockReturnValueOnce(retryPersist.promise);
    const action = { type: 'GO_BACK' } as NavigationAction;
    await render(<PulledOver />);
    await enterGuidanceWithRecording();
    mockNow = 4_000;

    await requestDismissal(action);
    await pressLatestAlertButton('Save & leave');
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Retry saving recording' }),
      ).toBeTruthy();
    });
    const firstInput = mockAddRecording.mock.calls[0][0];

    const retryPress = fireEvent.press(
      screen.getByRole('button', { name: 'Retry saving recording' }),
    );

    await waitFor(() => {
      expect(screen.getByText('Saving recording')).toBeTruthy();
    });
    expect(mockRecorderStop).toHaveBeenCalledTimes(1);
    expect(mockAddRecording).toHaveBeenCalledTimes(2);
    expect(mockAddRecording.mock.calls[1][0]).toEqual(firstInput);
    expect(mockNavigationDispatch).not.toHaveBeenCalled();

    await act(async () => {
      retryPersist.resolve(recordingFor(firstInput));
      await retryPersist.promise;
      await retryPress;
    });

    await waitFor(() => {
      expect(mockNavigationDispatch).toHaveBeenCalledWith(action);
    });
    expect(mockNavigationDispatch).toHaveBeenCalledTimes(1);
    expect(mockPreventRemoveEnabled).toBe(false);
  });

  test('confirmed Discard clears protection and resumes pending navigation without another persist', async () => {
    mockAddRecording.mockRejectedValueOnce(
      new Error('recording storage unavailable'),
    );
    const action = { type: 'GO_BACK' } as NavigationAction;
    await render(<PulledOver />);
    await enterGuidanceWithRecording();
    mockNow = 4_000;

    await requestDismissal(action);
    await pressLatestAlertButton('Save & leave');
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: 'Dismiss banner — discard recording',
        }),
      ).toBeTruthy();
    });

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Dismiss banner — discard recording',
      }),
    );
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Discard this recording?',
      'This will permanently discard the audio you just captured.',
      expect.any(Array),
    );
    await pressLatestAlertButton('Discard');

    await waitFor(() => {
      expect(mockNavigationDispatch).toHaveBeenCalledWith(action);
    });
    expect(mockNavigationDispatch).toHaveBeenCalledTimes(1);
    expect(mockAddRecording).toHaveBeenCalledTimes(1);
    expect(mockPreventRemoveEnabled).toBe(false);
    expect(screen.queryByText('Recording needs attention')).toBeNull();
  });

  test.each([
    {
      name: 'permission denial',
      configure: () => {
        mockRequestRecordingPermissions.mockResolvedValueOnce({
          granted: false,
        });
      },
      expectedAlert: false,
    },
    {
      name: 'recorder startup failure',
      configure: () => {
        mockRecorderPrepare.mockRejectedValueOnce(
          new Error('microphone unavailable'),
        );
      },
      expectedAlert: true,
    },
  ])(
    '$name becomes unavailable without a protected recording or false elapsed timer',
    async ({ configure, expectedAlert }) => {
      configure();
      await render(<PulledOver />);

      await chooseUnarmedAnswer();
      await fireEvent.press(
        screen.getByRole('button', { name: 'Continue to guidance' }),
      );
      await waitFor(() => {
        expect(screen.getByText('Microphone unavailable')).toBeTruthy();
        expect(screen.getByText('Your guidance continues below')).toBeTruthy();
      });

      expect(
        screen.getByRole('button', { name: 'Continue to trusted contact' }),
      ).toBeTruthy();
      expect(mockPreventRemoveEnabled).toBe(false);
      expect(mockRecorderRecord).not.toHaveBeenCalled();
      expect(mockRecorderStop).not.toHaveBeenCalled();
      if (expectedAlert) {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Couldn't start recording",
          'Try a different microphone or restart the app.',
        );
      }

      await fireEvent.press(
        screen.getByRole('button', { name: 'Continue to trusted contact' }),
      );
      await waitFor(() => {
        expect(screen.getByText("You're not alone.")).toBeTruthy();
      });
      expect(
        screen.queryByLabelText(/Recording, \d+ minutes \d+ seconds elapsed/),
      ).toBeNull();
    },
  );
});
