import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import './test-harness';
import { routerMock } from './test-harness';

jest.mock('../../hooks/useUser', () => ({
  useUser: () => ({ user: null, loading: false }),
}));

for (const asset of [
  'welcome-border-cloud',
  'welcome-cloud-large',
  'welcome-cloud-med-1',
  'welcome-cloud-med-2',
  'welcome-cloud-oval-1',
  'welcome-cloud-oval-2',
  'welcome-cloud-oval-med',
  'welcome-cloud-sm',
  'welcome-hill',
  'welcome-sun',
  'welcome-wind-lg',
  'welcome-wind-med',
  'welcome-wind-sm',
]) {
  jest.mock(`../../assets/illustrations/${asset}.svg`, () => () => null);
}

const Welcome = require('../../app/index').default as typeof import('../../app/index').default;

describe('welcome large-text layout', () => {
  test('keeps the guest entry content scrollable and caps the decorative title', async () => {
    const view = await render(<Welcome />);

    expect(JSON.stringify(view.toJSON())).toContain('RCTScrollView');
    expect(screen.getByText('Fresh Greens').props.maxFontSizeMultiplier).toBe(2);
  });

  test('keeps consent separate from the Privacy Policy link', async () => {
    await render(<Welcome />);

    const checkbox = screen.getByRole('checkbox', {
      name: 'Accept the Privacy Policy and Terms and Conditions',
    });
    const checkboxStyle = StyleSheet.flatten(checkbox.props.style);

    expect(checkbox.props.accessibilityState).toEqual({ checked: false });
    expect(checkboxStyle.width).toBe(44);
    expect(checkboxStyle.height).toBe(44);

    await fireEvent.press(screen.getByRole('link', { name: 'Privacy Policy' }));

    expect(routerMock.push).toHaveBeenCalledWith('/legal');
    expect(checkbox.props.accessibilityState).toEqual({ checked: false });
  });

  test('keeps consent separate from the Terms and Conditions link', async () => {
    await render(<Welcome />);

    const checkbox = screen.getByRole('checkbox', {
      name: 'Accept the Privacy Policy and Terms and Conditions',
    });

    await fireEvent.press(
      screen.getByRole('link', { name: 'Terms and Conditions' }),
    );

    expect(routerMock.push).toHaveBeenCalledWith('/legal');
    expect(checkbox.props.accessibilityState).toEqual({ checked: false });
  });
});
