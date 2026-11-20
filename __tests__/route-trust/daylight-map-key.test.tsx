import { fireEvent, render } from '@testing-library/react-native';
import { DaylightMapKey } from '../../components/DaylightMapKey';

const labels = ['Solid line, Daylight', 'Dashed line, Dusk', 'Dotted line, After dark'];

test.each([400, 64])('opens and dismisses the map key with %i points of clearance', async (availableHeight) => {
  const screen = await render(<DaylightMapKey availableHeight={availableHeight} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Map key', expanded: false }));
  for (const name of labels) expect(screen.getByRole('text', { name })).toBeDefined();
  await fireEvent.press(screen.getByRole('button', { name: 'Close map key', expanded: true }));
  expect(screen.queryByLabelText(labels[0])).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Map key' }));
  await fireEvent(screen.getByLabelText(labels[1]), 'accessibilityEscape');
  expect(screen.getByRole('button', { name: 'Map key', expanded: false })).toBeDefined();
});
