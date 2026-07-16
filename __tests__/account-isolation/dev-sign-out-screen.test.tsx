import { render, screen, waitFor } from '@testing-library/react-native';

import {
  routerMock,
} from './test-harness';
import type { SessionContextValue } from '../../lib/account-session/session-provider';

jest.mock('../../lib/account-session/session-provider', () => ({
  useSession: jest.fn(),
}));

const { useSession } = jest.mocked(
  require('../../lib/account-session/session-provider'),
);
const DevSignOut = require('../../app/dev-sign-out').default as typeof import('../../app/dev-sign-out').default;

function session(
  overrides: Partial<SessionContextValue> = {},
): SessionContextValue {
  return {
    phase: 'authenticated',
    user: { id: 'user-a' } as never,
    failure: null,
    sessionError: null,
    signOutCompletion: null,
    sessionGeneration: 1,
    signInWithApple: jest.fn(),
    signInAsDevUser: jest.fn(),
    beginSignOut: jest.fn(async () => undefined),
    retryCleanup: jest.fn(async () => undefined),
    finishOnDevice: jest.fn(async () => undefined),
    retrySessionHydration: jest.fn(async () => undefined),
    updateProfile: jest.fn(),
    ...overrides,
  };
}

describe('dev sign-out trigger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('starts the real sign-out flow for an authenticated dev session', async () => {
    const beginSignOut = jest.fn(async () => undefined);
    useSession.mockReturnValue(session({ beginSignOut }));

    await render(<DevSignOut />);

    expect(screen.getByText('Starting dev sign out')).toBeTruthy();
    await waitFor(() => expect(beginSignOut).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/sign-out'));
  });

  test('does not start sign-out outside an authenticated session', async () => {
    const beginSignOut = jest.fn(async () => undefined);
    useSession.mockReturnValue(
      session({
        phase: 'signedOut',
        user: null,
        beginSignOut,
      }),
    );

    await render(<DevSignOut />);

    expect(beginSignOut).not.toHaveBeenCalled();
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/sign-out'));
  });
});
