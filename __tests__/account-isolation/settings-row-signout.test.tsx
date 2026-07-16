import { fireEvent, render, screen } from '@testing-library/react-native';

import './test-harness';
import { SettingsRow } from '../../components/settings/SettingsRow';

describe('destructive settings row busy state', () => {
  test('disables repeated sign-out presses and exposes busy state', async () => {
    const onPress = jest.fn();
    await render(
      <SettingsRow
        label="Sign out"
        destructive
        busy
        onPress={onPress}
      />,
    );

    const row = screen.getByRole('button', { name: 'Sign out' });
    await fireEvent.press(row);

    expect(onPress).not.toHaveBeenCalled();
    expect(row.props.accessibilityState).toMatchObject({
      busy: true,
      disabled: true,
    });
  });
});
