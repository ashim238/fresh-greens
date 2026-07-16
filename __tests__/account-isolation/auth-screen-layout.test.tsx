import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import './test-harness';
import type { SessionContextValue } from '../../lib/account-session/session-provider';
import { colors } from '../../theme/colors';

jest.mock('../../assets/illustrations/logo-apple.svg', () => () => null);
jest.mock('../../lib/account-session/session-provider', () => ({
  useSession: jest.fn(),
}));

const { useSession } = jest.mocked(
  require('../../lib/account-session/session-provider'),
);
const Login = require('../../app/login').default as typeof import('../../app/login').default;
const GetStarted = require('../../app/get-started').default as typeof import('../../app/get-started').default;

function signedOutSession(): SessionContextValue {
  return {
    phase: 'signedOut',
    user: null,
    failure: null,
    sessionError: null,
    signOutCompletion: 'confirmed',
    sessionGeneration: 1,
    signInWithApple: jest.fn(),
    signInAsDevUser: jest.fn(),
    beginSignOut: jest.fn(),
    retryCleanup: jest.fn(async () => undefined),
    finishOnDevice: jest.fn(async () => undefined),
    retrySessionHydration: jest.fn(async () => undefined),
    updateProfile: jest.fn(),
  };
}

describe.each([
  {
    name: 'login',
    Screen: Login,
    title: 'Welcome back',
    primaryAction: 'Log in with Apple',
  },
  {
    name: 'get started',
    Screen: GetStarted,
    title: 'Get started',
    primaryAction: 'Continue with Apple',
  },
])('$name large-text layout', ({ Screen, title, primaryAction }) => {
  let consoleWarn: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    useSession.mockReturnValue(signedOutSession());
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarn.mockRestore();
  });

  test('keeps the auth content scrollable and lets the primary action grow', async () => {
    const view = await render(<Screen />);

    expect(JSON.stringify(view.toJSON())).toContain('RCTScrollView');
    expect(screen.getByText(title).props.maxFontSizeMultiplier).toBe(2);

    const action = screen.getByLabelText(primaryAction);
    const actionStyle = StyleSheet.flatten(action.props.style);
    expect(actionStyle.minHeight).toBe(48);
    expect(actionStyle.height).toBeUndefined();
  });

  test('announces auth failures on a readable light error surface', async () => {
    const signInWithApple = jest.fn().mockRejectedValue(new Error('offline'));
    useSession.mockReturnValue({ ...signedOutSession(), signInWithApple });

    await render(<Screen />);
    await fireEvent.press(screen.getByLabelText(primaryAction));

    const alert = await screen.findByRole('alert');
    const alertStyle = StyleSheet.flatten(alert.props.style);
    const errorText = screen.getByText('Try again.');
    const errorTextStyle = StyleSheet.flatten(errorText.props.style);

    expect(alert.props.accessibilityLiveRegion).toBe('assertive');
    expect(alertStyle.backgroundColor).toBe(colors.surfaceCard);
    expect(errorTextStyle.color).toBe(colors.severityCritical);
  });
});
