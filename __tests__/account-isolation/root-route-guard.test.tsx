import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  routerMock,
  routerStackState,
  setRouterState,
} from './test-harness';
import type { SessionContextValue } from '../../lib/account-session/session-provider';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => undefined),
  hideAsync: jest.fn(async () => undefined),
}));

jest.mock('../../hooks/useAppFonts', () => ({
  useAppFonts: jest.fn(),
}));

jest.mock('../../lib/account-session/session-provider', () => {
  const React = require('react') as typeof import('react');
  return {
    SessionProvider: jest.fn(
      ({ children }: { children?: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
    ),
    useSession: jest.fn(),
  };
});

const { useAppFonts } = jest.mocked(require('../../hooks/useAppFonts'));
const { useSession } = jest.mocked(
  require('../../lib/account-session/session-provider'),
);
const SplashScreen = jest.mocked(require('expo-splash-screen'));
const { RootNavigator } = require('../../app/_layout') as typeof import('../../app/_layout');

const GUEST_ROUTES = ['index', 'get-started', 'login'];
const TRANSITION_ROUTES = ['sign-out'];
const PRIVATE_ROUTES = [
  'emergency',
  'en-route',
  'fuel',
  'home',
  'insurance-setup',
  'legal',
  'menu',
  'moderation',
  'onboarding',
  'permissions',
  'pulled-over',
  'recordings',
  'report',
  'roadside-setup',
  'roadside',
  'safety-settings',
  'safety',
  'saved-places',
  'search',
  'share-location',
  'trip-summary',
  'trusted-contact-setup',
  'unfamiliar',
  'zone-preferences',
  ...(typeof __DEV__ !== 'undefined' && __DEV__ ? ['dev-sign-out'] : []),
];

function session(
  phase: SessionContextValue['phase'],
  overrides: Partial<SessionContextValue> = {},
): SessionContextValue {
  return {
    phase,
    user: phase === 'authenticated' ? ({ id: 'user-a' } as never) : null,
    failure: null,
    sessionError: null,
    signOutCompletion: null,
    sessionGeneration: 1,
    signInWithApple: jest.fn(),
    signInAsDevUser: jest.fn(),
    beginSignOut: jest.fn(),
    retryCleanup: jest.fn(),
    finishOnDevice: jest.fn(),
    retrySessionHydration: jest.fn(),
    updateProfile: jest.fn(),
    ...overrides,
  };
}

describe('root account route guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    routerStackState.visibleScreens.clear();
    setRouterState('/');
    useAppFonts.mockReturnValue({ loaded: true, error: null });
    useSession.mockReturnValue(session('hydrating'));
  });

  afterEach(() => {
    routerStackState.visibleScreens.clear();
  });

  test('keeps navigator and splash closed while session hydration is pending', async () => {
    await render(<RootNavigator fontsLoaded />);

    expect([...routerStackState.visibleScreens]).toEqual([]);
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  test.each([
    ['signedOut', [...GUEST_ROUTES, ...TRANSITION_ROUTES]],
    ['signingOut', TRANSITION_ROUTES],
    ['cleanupFailed', TRANSITION_ROUTES],
    ['authenticated', PRIVATE_ROUTES],
  ] as const)('classifies every route for %s', async (phase, expected) => {
    useSession.mockReturnValue(session(phase));

    await render(<RootNavigator fontsLoaded />);

    expect(useSession).toHaveBeenCalled();
    expect([...routerStackState.visibleScreens].sort()).toEqual(
      [...expected].sort(),
    );
  });

  test('hides splash only after fonts and session hydration both settle', async () => {
    useAppFonts.mockReturnValue({ loaded: false, error: null });
    useSession.mockReturnValue(session('hydrating'));
    const view = await render(<RootNavigator fontsLoaded={false} />);
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();

    useAppFonts.mockReturnValue({ loaded: true, error: null });
    useSession.mockReturnValue(session('signedOut'));
    await view.rerender(<RootNavigator fontsLoaded />);

    await waitFor(() => expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1));
  });

  test('can continue after font loading settles into fallback mode', async () => {
    useSession.mockReturnValue(session('signedOut'));

    await render(<RootNavigator fontsLoaded />);

    expect([...routerStackState.visibleScreens].sort()).toEqual(
      [...GUEST_ROUTES, ...TRANSITION_ROUTES].sort(),
    );
    await waitFor(() => expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1));
  });

  test('shows truthful startup recovery without mounting any route', async () => {
    const startup = session('sessionError');
    useSession.mockReturnValue(startup);

    await render(<RootNavigator fontsLoaded />);

    expect([...routerStackState.visibleScreens]).toEqual([]);
    expect(
      screen.getByRole('header', { name: "We couldn't open Fresh Greens" }),
    ).toBeTruthy();
    expect(
      screen.getByText('Your information is still on this device. Try again.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(startup.retrySessionHydration).toHaveBeenCalledTimes(1);
  });

  test('keeps startup recovery visible and busy while retrying', async () => {
    useSession.mockReturnValue(
      session('hydrating', { sessionError: new Error('read failed') }),
    );

    await render(<RootNavigator fontsLoaded />);

    expect(
      screen.getByRole('header', { name: "We couldn't open Fresh Greens" }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' }).props.accessibilityState)
      .toMatchObject({ busy: true, disabled: true });
  });

  test('drops a signed-out private deep link and its query', async () => {
    setRouterState('/recordings', { id: 'secret-recording' });
    useSession.mockReturnValue(session('signedOut'));

    await render(<RootNavigator fontsLoaded />);

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/login'));
    expect(routerMock.replace).not.toHaveBeenCalledWith(
      expect.objectContaining({ params: expect.anything() }),
    );
  });
});
