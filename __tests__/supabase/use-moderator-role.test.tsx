import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  backendAuthRepository,
  type BackendAuthState,
  type BackendSession,
} from '../../lib/supabase/auth-repository';
import { rolesRepository } from '../../lib/supabase/roles-repository';
import { useModeratorRole } from '../../hooks/useModeratorRole';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function session(id: string): BackendSession {
  return {
    accessToken: `access-${id}`,
    user: {
      id,
      email: null,
      displayName: null,
      provider: 'apple',
      identities: [],
    },
  };
}

describe('useModeratorRole', () => {
  const unsubscribe = jest.fn();
  let getUserId: jest.SpiedFunction<typeof backendAuthRepository.getUserId>;
  let subscribe: jest.SpiedFunction<typeof backendAuthRepository.subscribe>;
  let hasModeratorRole: jest.SpiedFunction<
    typeof rolesRepository.hasModeratorRole
  >;
  let authListener: ((state: BackendAuthState) => void) | undefined;

  function emit(state: BackendAuthState): void {
    expect(authListener).toBeDefined();
    authListener?.(state);
  }

  beforeEach(() => {
    getUserId = jest.spyOn(backendAuthRepository, 'getUserId');
    subscribe = jest.spyOn(backendAuthRepository, 'subscribe');
    hasModeratorRole = jest.spyOn(rolesRepository, 'hasModeratorRole');
    unsubscribe.mockClear();
    authListener = undefined;
    getUserId.mockResolvedValue(null);
    hasModeratorRole.mockResolvedValue(false);
    subscribe.mockImplementation((listener) => {
      authListener = listener;
      return unsubscribe;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('never publishes stale moderator A after a signed-out transition', async () => {
    const roleA = deferred<boolean>();
    hasModeratorRole.mockImplementation((id) =>
      id === 'user-a' ? roleA.promise : Promise.resolve(false),
    );
    const view = await renderHook(() => useModeratorRole());
    expect(subscribe).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    await act(() => emit({ kind: 'authenticated', session: session('user-a') }));
    await waitFor(() =>
      expect(hasModeratorRole).toHaveBeenCalledWith('user-a'),
    );

    await act(() => emit({ kind: 'signed-out' }));
    expect(view.result.current.isModerator).toBe(false);
    expect(view.result.current.loading).toBe(false);

    await act(async () => {
      roleA.resolve(true);
      await roleA.promise;
    });

    expect(view.result.current.isModerator).toBe(false);
    expect(view.result.current.loading).toBe(false);
    await view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  test('uses authenticated event identities and only publishes latest user B', async () => {
    const roleA = deferred<boolean>();
    const roleB = deferred<boolean>();
    hasModeratorRole.mockImplementation((id) => {
      if (id === 'user-a') return roleA.promise;
      if (id === 'user-b') return roleB.promise;
      return Promise.resolve(false);
    });
    const view = await renderHook(() => useModeratorRole());
    expect(subscribe).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    await act(() => emit({ kind: 'authenticated', session: session('user-a') }));
    await waitFor(() =>
      expect(hasModeratorRole).toHaveBeenCalledWith('user-a'),
    );
    await act(() => emit({ kind: 'authenticated', session: session('user-b') }));
    expect(view.result.current.isModerator).toBe(false);
    await waitFor(() =>
      expect(hasModeratorRole).toHaveBeenCalledWith('user-b'),
    );

    await act(async () => {
      roleA.resolve(true);
      await roleA.promise;
    });
    expect(view.result.current.isModerator).toBe(false);
    expect(view.result.current.loading).toBe(true);

    await act(async () => {
      roleB.resolve(true);
      await roleB.promise;
    });
    expect(view.result.current.isModerator).toBe(true);
    expect(view.result.current.loading).toBe(false);
    expect(getUserId).toHaveBeenCalledTimes(1);
    await view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  test.each([
    { kind: 'signed-out' } as const,
    { kind: 'unconfigured' } as const,
    { kind: 'anonymous', session: session('anonymous-a') } as const,
  ])('clears an established moderator immediately for $kind', async (state) => {
    getUserId.mockResolvedValue('user-a');
    hasModeratorRole.mockResolvedValue(true);
    const view = await renderHook(() => useModeratorRole());
    expect(subscribe).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(view.result.current.isModerator).toBe(true));
    hasModeratorRole.mockClear();

    await act(() => emit(state));

    expect(view.result.current.isModerator).toBe(false);
    expect(view.result.current.loading).toBe(false);
    expect(hasModeratorRole).not.toHaveBeenCalled();
    await view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  test('invalidates an outstanding event request on unmount and unsubscribes', async () => {
    const roleA = deferred<boolean>();
    hasModeratorRole.mockReturnValue(roleA.promise);
    const view = await renderHook(() => useModeratorRole());
    expect(subscribe).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    await act(() => emit({ kind: 'authenticated', session: session('user-a') }));
    await waitFor(() => expect(hasModeratorRole).toHaveBeenCalledWith('user-a'));
    await view.unmount();

    await act(async () => {
      roleA.resolve(true);
      await roleA.promise;
    });

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(view.result.current.isModerator).toBe(false);
  });

  test('only the latest overlapping refresh may publish', async () => {
    const roleA = deferred<boolean>();
    const roleB = deferred<boolean>();
    getUserId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('user-a')
      .mockResolvedValueOnce('user-b');
    hasModeratorRole.mockImplementation((id) =>
      id === 'user-a' ? roleA.promise : roleB.promise,
    );
    const view = await renderHook(() => useModeratorRole());
    expect(subscribe).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    await act(() => {
      view.result.current.refresh();
    });
    await waitFor(() => expect(hasModeratorRole).toHaveBeenCalledWith('user-a'));
    await act(() => {
      view.result.current.refresh();
    });
    await waitFor(() => expect(hasModeratorRole).toHaveBeenCalledWith('user-b'));

    await act(async () => {
      roleB.resolve(true);
      await roleB.promise;
    });
    expect(view.result.current.isModerator).toBe(true);
    expect(view.result.current.loading).toBe(false);

    await act(async () => {
      roleA.resolve(false);
      await roleA.promise;
    });
    expect(view.result.current.isModerator).toBe(true);
    expect(view.result.current.loading).toBe(false);
    await view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
