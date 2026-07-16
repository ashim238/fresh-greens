import { act, renderHook } from '@testing-library/react-native';

import './test-harness';

import { useUser } from '../../hooks/useUser';
import type { SessionContextValue } from '../../lib/account-session/session-provider';
import type { User } from '../../lib/api/user';

jest.mock('../../lib/account-session/session-provider', () => ({
  useSession: jest.fn(),
}));

const { useSession } = jest.mocked(
  require('../../lib/account-session/session-provider'),
);

const USER: User = {
  id: 'user-a',
  provider: 'apple',
  displayName: 'Alice Example',
  email: 'alice@example.com',
  initials: 'AE',
  avatarUri: null,
  signedInAt: 123,
};

function session(
  overrides: Partial<SessionContextValue> = {},
): SessionContextValue {
  return {
    phase: 'authenticated',
    user: USER,
    failure: null,
    sessionError: null,
    signOutCompletion: null,
    sessionGeneration: 1,
    signInWithApple: jest.fn(async () => ({
      user: USER,
      wasReturning: false,
    })),
    signInAsDevUser: jest.fn(async () => USER),
    beginSignOut: jest.fn(async () => undefined),
    retryCleanup: jest.fn(async () => undefined),
    finishOnDevice: jest.fn(async () => undefined),
    retrySessionHydration: jest.fn(async () => undefined),
    updateProfile: jest.fn(async () => USER),
    ...overrides,
  };
}

describe('useUser compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('is a context view with no independent user snapshot', async () => {
    const shared = session();
    useSession.mockReturnValue(shared);

    const { result } = await renderHook(() => useUser());

    expect(result.current.user).toBe(shared.user);
    expect(result.current.loading).toBe(false);
    expect(result.current.sessionGeneration).toBe(1);
  });

  test('maps legacy actions to the root session authority', async () => {
    const shared = session();
    useSession.mockReturnValue(shared);
    const { result } = await renderHook(() => useUser());

    let signedInUser;
    await act(async () => {
      signedInUser = await result.current.signInWithApple();
      await result.current.signOut();
      await result.current.updateProfile({ displayName: 'Alice Z Example' });
    });

    expect(signedInUser).toBe(USER);
    expect(shared.signInWithApple).toHaveBeenCalledTimes(1);
    expect(shared.beginSignOut).toHaveBeenCalledTimes(1);
    expect(shared.updateProfile).toHaveBeenCalledWith({
      displayName: 'Alice Z Example',
    });
  });

  test('reports loading only while the root session is hydrating', async () => {
    useSession.mockReturnValue(session({ phase: 'hydrating', user: null }));
    const hydrating = await renderHook(() => useUser());
    expect(hydrating.result.current.loading).toBe(true);
    await hydrating.unmount();

    useSession.mockReturnValue(session({ phase: 'cleanupFailed', user: null }));
    const failed = await renderHook(() => useUser());
    expect(failed.result.current.loading).toBe(false);
  });
});
