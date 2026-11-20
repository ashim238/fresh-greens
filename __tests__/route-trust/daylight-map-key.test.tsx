import { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PixelRatio, StyleSheet } from 'react-native';
import { DaylightMapKey, PreviewDaylightMapKey } from '../../components/DaylightMapKey';
import { typography } from '../../theme/typography';

const labels = ['Solid line, Daylight', 'Dashed line, Dusk', 'Dotted line, After dark'];

test('lets native Text scale key line heights once at the largest accessibility size', async () => {
  const scale = jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(3.12);
  try {
    const screen = await render(
      <PreviewDaylightMapKey expanded onExpandedChange={jest.fn()} onHeightChange={jest.fn()} />,
    );
    const label = screen.getByText('Daylight');
    expect(StyleSheet.flatten(label.props.style).lineHeight).toBe(typography.footnoteRegular.lineHeight);
    expect(label.props.maxFontSizeMultiplier).toBe(2);
  } finally {
    scale.mockRestore();
  }
});

test('shows all three patterns immediately in the preview and honors dismissal until reopened', async () => {
  function Preview() {
    const [expanded, setExpanded] = useState(true);
    return (
      <PreviewDaylightMapKey
        expanded={expanded}
        onExpandedChange={setExpanded}
        onHeightChange={jest.fn()}
        style={{ maxWidth: 220 }}
      />
    );
  }

  const screen = await render(<Preview />);
  for (const name of labels) expect(screen.getByRole('text', { name })).toBeDefined();
  await fireEvent.press(screen.getByRole('button', { name: 'Close map key', expanded: true }));
  await screen.rerender(<Preview />);
  for (const name of labels) expect(screen.queryByLabelText(name)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Map key', expanded: false }));
  for (const name of labels) expect(screen.getByRole('text', { name })).toBeDefined();
});

test.each([400, 64])('starts driving collapsed and discloses the key with %i points of clearance', async (availableHeight) => {
  const screen = await render(<DaylightMapKey availableHeight={availableHeight} />);

  for (const name of labels) expect(screen.queryByLabelText(name)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Map key', expanded: false }));
  for (const name of labels) expect(screen.getByRole('text', { name })).toBeDefined();
  await fireEvent.press(screen.getByRole('button', { name: 'Close map key', expanded: true }));
  expect(screen.queryByLabelText(labels[0])).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Map key' }));
  await fireEvent(screen.getByLabelText(labels[1]), 'accessibilityEscape');
  expect(screen.getByRole('button', { name: 'Map key', expanded: false })).toBeDefined();
});
