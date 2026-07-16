import { render, screen } from '@testing-library/react-native';

import { RecordingSaveErrorBanner } from '../../components/RecordingSaveErrorBanner';
import { getErrorMessage } from '../../lib/error-message';

describe('RecordingSaveErrorBanner', () => {
  test('allows the canonical error title to wrap without a line clamp', async () => {
    await render(
      <RecordingSaveErrorBanner
        pending={false}
        onRetry={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    const errorText = screen.getByText(
      getErrorMessage('recordings', 'transient').title,
    );
    expect(errorText.props.numberOfLines).toBeUndefined();
  });
});
