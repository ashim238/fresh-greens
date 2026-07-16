import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Linking } from 'react-native';

const mockRouterBack = jest.fn();
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockNotifyTrustedContact = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockRouterBack,
    push: mockRouterPush,
    replace: mockRouterReplace,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  usePreventRemove: jest.fn(),
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'denied' }),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn().mockResolvedValue([]),
  geocodeAsync: jest.fn().mockResolvedValue([]),
}));

jest.mock('react-native-safe-area-context', () => {
  const safeAreaMock = jest.requireActual<{ default: object }>(
    'react-native-safe-area-context/jest/mock',
  );
  return safeAreaMock.default;
});

jest.mock('../../components/RoadsideTowPick', () => ({
  RoadsideTowPick: () => null,
}));

jest.mock('../../hooks/useRoadsideProfile', () => ({
  useRoadsideProfile: () => ({
    profile: { serviceName: 'Good Sam', phoneNumber: '800-555-0100' },
    loading: false,
  }),
}));

jest.mock('../../hooks/useTrustedContact', () => ({
  useTrustedContact: () => ({
    ready: true,
    contact: {
      id: 'trusted-1',
      name: 'Alex',
      initials: 'A',
      phoneNumber: '212-555-0100',
      setAt: 1,
    },
    pickContact: jest.fn(),
    clearContact: jest.fn(),
  }),
}));

jest.mock('../../lib/api/trusted-contact', () => ({
  getTrustedContact: jest.fn().mockResolvedValue({
    id: 'trusted-1',
    name: 'Alex',
    initials: 'A',
    phoneNumber: '212-555-0100',
    setAt: 1,
  }),
}));

jest.mock('../../lib/notify-trusted-contact', () => ({
  notifyTrustedContact: (...args: unknown[]) =>
    mockNotifyTrustedContact(...args),
}));

const Roadside = require('../../app/roadside').default as typeof import('../../app/roadside').default;

async function enterActions() {
  await render(<Roadside />);
  await fireEvent.press(screen.getByRole('button', { name: 'Flat tire' }));
}

describe('Roadside handoff truthfulness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockNotifyTrustedContact.mockResolvedValue({
      opened: true,
      openedAtIso: '2026-07-16T12:00:00.000Z',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('opening a roadside call asks the user to confirm help with the provider', async () => {
    await enterActions();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Call Good Sam' }),
    );

    expect(Linking.openURL).toHaveBeenCalledWith('tel:8005550100');
    expect(
      screen.getByRole('header', {
        name: 'Confirm help directly with Good Sam.',
      }),
    ).toBeTruthy();
    expect(screen.getByText('Call opened.')).toBeTruthy();
    expect(screen.queryByText(/on the way/i)).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Back to actions' }),
    ).toBeTruthy();
  });

  test('opening an SMS draft shows a truthful Messages state without a switch', async () => {
    await enterActions();

    expect(screen.queryByRole('switch')).toBeNull();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Open message draft for Alex' }),
    );

    await waitFor(() => {
      expect(
        screen.getByText('Message draft opened — tap Send in Messages'),
      ).toBeTruthy();
    });
    expect(screen.queryByRole('switch')).toBeNull();
    expect(mockNotifyTrustedContact).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', {
        name: 'Message draft opened for Alex. Tap Send in Messages. Open message draft again',
      }),
    ).toBeTruthy();
  });
});
