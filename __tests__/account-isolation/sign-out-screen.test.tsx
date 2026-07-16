import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import './test-harness';
import type { SessionContextValue } from '../../lib/account-session/session-provider';

jest.mock('../../hooks/useReduceMotion', () => ({
  useReduceMotion: () => true,
}));

jest.mock('../../assets/illustrations/permissions-car.svg', () => () => null);
jest.mock('../../assets/illustrations/permissions-location.svg', () => () => null);

jest.mock('../../lib/account-session/session-provider', () => ({
  useSession: jest.fn(),
}));

const { useSession } = jest.mocked(
  require('../../lib/account-session/session-provider'),
);
const SignOut = require('../../app/sign-out').default as typeof import('../../app/sign-out').default;

function session(
  overrides: Partial<SessionContextValue>,
): SessionContextValue {
  return {
    phase: 'signingOut',
    user: null,
    failure: null,
    sessionError: null,
    signOutCompletion: null,
    sessionGeneration: 1,
    signInWithApple: jest.fn(),
    signInAsDevUser: jest.fn(),
    beginSignOut: jest.fn(),
    retryCleanup: jest.fn(async () => undefined),
    finishOnDevice: jest.fn(async () => undefined),
    retrySessionHydration: jest.fn(async () => undefined),
    updateProfile: jest.fn(),
    ...overrides,
  };
}

describe('sign-out recovery screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows a busy, non-dismissible cleanup state', async () => {
    useSession.mockReturnValue(session({ phase: 'signingOut' }));

    await render(<SignOut />);

    expect(screen.getByRole('header', { name: 'Signing you out' })).toBeTruthy();
    expect(
      screen.getByText('Removing your information from this device.'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        'Signing you out. Removing your information from this device. In progress.',
      ).props.accessibilityState,
    )
      .toMatchObject({ busy: true });
    expect(screen.queryByText('Try again')).toBeNull();
  });

  test('shows retry without login when local cleanup failed', async () => {
    const retryCleanup = jest.fn(async () => undefined);
    useSession.mockReturnValue(
      session({
        phase: 'cleanupFailed',
        failure: {
          failures: [
            {
              id: 'places.saved',
              errorName: 'Error',
              scope: 'local',
              retryable: true,
            },
          ],
          canFinishOnDevice: false,
        },
        retryCleanup,
      }),
    );

    await render(<SignOut />);
    await fireEvent.press(screen.getByText('Try again'));

    expect(screen.getByText("We couldn't finish signing out")).toBeTruthy();
    expect(
      screen.getByText(
        'Some information is still on this device. Try the cleanup again before you log in.',
      ),
    ).toBeTruthy();
    expect(retryCleanup).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Log back in')).toBeNull();
    expect(screen.queryByText('Finish on this device')).toBeNull();
  });

  test('confirms the local-only completion choice for an online-only failure', async () => {
    const finishOnDevice = jest.fn(async () => undefined);
    useSession.mockReturnValue(
      session({
        phase: 'cleanupFailed',
        failure: {
          failures: [
            {
              id: 'auth.supabase',
              errorName: 'AccountPurgeRemoteError',
              scope: 'remote',
              retryable: true,
            },
          ],
          canFinishOnDevice: true,
        },
        finishOnDevice,
      }),
    );
    const alert = jest.spyOn(Alert, 'alert');

    await render(<SignOut />);
    await fireEvent.press(screen.getByText('Finish on this device'));

    expect(alert).toHaveBeenCalledWith(
      'Finish on this device?',
      'The online session could not be confirmed as closed. It will expire, and this device will forget it now.',
      expect.any(Array),
    );
    const actions = alert.mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    await act(async () => {
      await actions.find(({ text }) => text === 'Finish')?.onPress?.();
    });
    expect(finishOnDevice).toHaveBeenCalledTimes(1);
  });

  test('distinguishes confirmed and device-only completion', async () => {
    useSession.mockReturnValue(
      session({ phase: 'signedOut', signOutCompletion: 'confirmed' }),
    );
    const confirmed = await render(<SignOut />);
    expect(screen.getByText("You've been logged out.")).toBeTruthy();
    await confirmed.unmount();

    useSession.mockReturnValue(
      session({ phase: 'signedOut', signOutCompletion: 'local-only' }),
    );
    await render(<SignOut />);
    expect(screen.getByText('Signed out on this device.')).toBeTruthy();
    expect(
      screen.getByText('The online session could not be confirmed as closed.'),
    ).toBeTruthy();
  });
});
