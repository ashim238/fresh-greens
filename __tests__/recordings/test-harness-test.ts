import React from 'react';
import { render } from '@testing-library/react-native';
import { View } from 'react-native';

describe('recording test harness', () => {
  test('renders React Native through the testing library', async () => {
    const screen = await render(
      React.createElement(View, { testID: 'recording-test-harness' }),
    );

    expect(screen.getByTestId('recording-test-harness')).toBeTruthy();
  });
});
