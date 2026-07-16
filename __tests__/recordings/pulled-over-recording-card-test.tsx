import { render, screen } from '@testing-library/react-native';

import { PulledOverRecordingCard } from '../../components/PulledOverRecordingCard';
import type { RecordingStatus } from '../../lib/recording-session';

const baseProps = {
  elapsed: 65,
  meteringHistory: [-60, -40, -10],
  reduceMotion: true,
  onStopRecording: jest.fn(),
};

const staticStates: ReadonlyArray<{
  status: Exclude<RecordingStatus, 'recording' | 'discarded'>;
  title: string;
  detail: string;
}> = [
  {
    status: 'idle',
    title: 'Preparing recording',
    detail: 'Your guidance is ready below',
  },
  {
    status: 'requesting-permission',
    title: 'Preparing recording',
    detail: 'Your guidance is ready below',
  },
  {
    status: 'saving',
    title: 'Saving recording',
    detail: 'Keep this screen open',
  },
  {
    status: 'saved',
    title: 'Recording saved',
    detail: 'Saved on this phone',
  },
  {
    status: 'unavailable',
    title: 'Microphone unavailable',
    detail: 'Your guidance continues below',
  },
  {
    status: 'save-error',
    title: 'Recording needs attention',
    detail: 'Retry or discard the recording above',
  },
];

describe('PulledOverRecordingCard', () => {
  test.each(staticStates)(
    'renders the $status state without a Stop action',
    async ({ status, title, detail }) => {
      await render(
        <PulledOverRecordingCard
          status={status}
          {...baseProps}
        />,
      );

      expect(screen.getByText(title)).toBeTruthy();
      expect(screen.getByText(detail)).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: 'Stop recording' }),
      ).toBeNull();
    },
  );

  test('renders recording progress and the Stop action', async () => {
    await render(
      <PulledOverRecordingCard
        status="recording"
        {...baseProps}
      />,
    );

    expect(screen.getByText('Recording…')).toBeTruthy();
    expect(screen.getByText('00:01:05')).toBeTruthy();
    expect(
      screen.getByText('Saved on this phone when you stop'),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Stop recording' }),
    ).toBeTruthy();
  });

  test('renders nothing after the recording is discarded', async () => {
    const view = await render(
      <PulledOverRecordingCard
        status="discarded"
        {...baseProps}
      />,
    );

    expect(view.toJSON()).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Stop recording' }),
    ).toBeNull();
  });
});
