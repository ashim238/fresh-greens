import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Button } from '../../components/Button';

describe('Button large-text layout', () => {
  test('grows vertically and gives a long action label room to wrap', async () => {
    await render(
      <Button text="Have an account? Log in" onPress={jest.fn()} />,
    );

    const button = screen.getByRole('button', {
      name: 'Have an account? Log in',
    });
    const buttonStyle = StyleSheet.flatten(button.props.style);
    const label = screen.getByText('Have an account? Log in');
    const labelStyle = StyleSheet.flatten(label.props.style);

    expect(buttonStyle.minHeight).toBe(44);
    expect(buttonStyle.height).toBeUndefined();
    expect(label.props.numberOfLines).toBe(2);
    expect(labelStyle.flexShrink).toBe(1);
  });
});
