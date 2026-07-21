import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import Moderation from '../../app/moderation';
import {
  moderationRepository,
  ModerationRepositoryError,
  type ModerationReport,
  type ReportFlag,
} from '../../lib/supabase/moderation-repository';

const mockRouterBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockRouterBack }),
}));

jest.mock('react-native-safe-area-context', () => {
  const safeAreaMock = jest.requireActual<{ default: object }>(
    'react-native-safe-area-context/jest/mock',
  );
  return safeAreaMock.default;
});

jest.mock('../../hooks/useHoldToConfirm', () => ({
  useHoldToConfirm: () => ({
    holdProgress: { interpolate: jest.fn() },
    pressHandlers: {},
    isVoiceOverOn: false,
  }),
}));

jest.mock('../../hooks/useReduceMotion', () => ({
  useReduceMotion: () => true,
}));

type Deferred<T> = {
  promise: Promise<T>;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((_resolve, rejectPromise) => {
    reject = rejectPromise;
  });
  return { promise, reject };
}

const report: ModerationReport = {
  id: 'report-a',
  category_id: 'lighting',
  location: { latitude: 40.7, longitude: -74 },
  detail: 'Dark block',
  place_name: 'Corner store',
  place_type: 'store',
  submitted_by: 'Myles',
  timestamp: 1_800_000_000_000,
  device_uuid: 'device-a',
  auth_user_id: 'user-a',
  submitter_ip: '192.0.2.1',
  hidden_at: '2026-07-20T00:00:00.000Z',
  hidden_reason: 'flag threshold',
  removed_at: null,
  is_verified_phone: true,
};

const flag: ReportFlag = {
  id: 'flag-a',
  report_id: 'report-a',
  flagger_device_uuid: 'device-b',
  flagger_ip: '192.0.2.2',
  reason: 'Incorrect location',
  reason_category: 'inaccurate',
  created_at: '2026-07-20T01:00:00.000Z',
};

describe('moderation flag loading', () => {
  let fetchQueue: jest.SpiedFunction<
    typeof moderationRepository.fetchModerationQueue
  >;
  let fetchFlags: jest.SpiedFunction<
    typeof moderationRepository.fetchReportFlags
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchQueue = jest
      .spyOn(moderationRepository, 'fetchModerationQueue')
      .mockResolvedValue([report]);
    fetchFlags = jest
      .spyOn(moderationRepository, 'fetchReportFlags')
      .mockResolvedValue([]);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function renderAndOpenFlags() {
    const view = await render(<Moderation />);
    await waitFor(() => expect(fetchQueue).toHaveBeenCalledTimes(1));
    await fireEvent.press(
      await screen.findByRole('button', { name: /Corner store/ }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Flags' }));
    await waitFor(() => expect(fetchFlags).toHaveBeenCalledTimes(1));
    return view;
  }

  async function rejectAttempt(
    attempt: Deferred<ReportFlag[]>,
    error: unknown,
  ): Promise<void> {
    await act(async () => {
      attempt.reject(error);
      await attempt.promise.catch(() => undefined);
    });
  }

  test('rejected loads show no empty claim and retry when reopened', async () => {
    const firstAttempt = deferred<ReportFlag[]>();
    fetchFlags
      .mockReturnValueOnce(firstAttempt.promise)
      .mockResolvedValueOnce([flag]);
    const view = await renderAndOpenFlags();

    await rejectAttempt(
      firstAttempt,
      new ModerationRepositoryError('rejected'),
    );

    expect(screen.queryByText('No flags on this report.')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Flags' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Flags' }));
    await waitFor(() => expect(fetchFlags).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Incorrect location')).toBeTruthy();
    expect(screen.queryByText('No flags on this report.')).toBeNull();

    await view.unmount();
  });

  test.each([
    [
      'unavailable product error',
      new ModerationRepositoryError('unavailable'),
    ],
    ['thrown transport error', new Error('socket closed')],
  ])('%s renders the empty state and does not retry', async (_name, error) => {
    const firstAttempt = deferred<ReportFlag[]>();
    fetchFlags.mockReturnValueOnce(firstAttempt.promise);
    const view = await renderAndOpenFlags();

    await rejectAttempt(firstAttempt, error);

    expect(await screen.findByText('No flags on this report.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Flags (0)' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Flags (0)' }));
    await act(async () => undefined);
    expect(fetchFlags).toHaveBeenCalledTimes(1);

    await view.unmount();
  });
});
