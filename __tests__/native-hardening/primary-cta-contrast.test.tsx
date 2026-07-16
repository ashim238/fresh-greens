import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import '../account-isolation/test-harness';
import { Button } from '../../components/Button';
import { colors } from '../../theme/colors';

const { readFileSync } = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
};

describe('primary action contrast contract', () => {
  test('uses dark text on the bright primary fill', async () => {
    await render(<Button text="Continue" />);

    const labelStyle = StyleSheet.flatten(screen.getByText('Continue').props.style);
    expect(labelStyle.color).toBe(colors.black);
  });

  test('keeps hand-rolled route and roadside actions on the same pairing', () => {
    const routeSource = readFileSync('components/RoutePreviewCard.tsx', 'utf8');
    const roadsideSource = readFileSync('app/roadside.tsx', 'utf8');
    const towSource = readFileSync('components/RoadsideTowPick.tsx', 'utf8');
    const placementSource = readFileSync(
      'components/HomePlacementOverlay.tsx',
      'utf8',
    );
    const pulledOverSource = readFileSync('app/pulled-over.tsx', 'utf8');

    expect(routeSource).toMatch(
      /goText:\s*\{[\s\S]*?color:\s*colors\.black/,
    );
    expect(roadsideSource).toMatch(
      /modalCtaLabel:\s*\{[\s\S]*?color:\s*colors\.black/,
    );
    expect(towSource).toMatch(
      /callBtnLabel:\s*\{[\s\S]*?color:\s*colors\.black/,
    );
    expect(placementSource).toMatch(
      /placementConfirmText:\s*\{[\s\S]*?color:\s*colors\.black/,
    );
    expect(pulledOverSource).toMatch(
      /continueBtnText:\s*\{[\s\S]*?color:\s*colors\.black/,
    );
  });

  test('keeps authentication labels and busy indicators readable on Fresh Green', () => {
    for (const path of ['app/login.tsx', 'app/get-started.tsx']) {
      const source = readFileSync(path, 'utf8');

      expect(source).toMatch(/<ActivityIndicator color=\{colors\.black\} \/>/);
      expect(source).toMatch(
        /outlinedButtonText:\s*\{[\s\S]*?color:\s*colors\.black/,
      );
    }
  });

  test('keeps the route-start icon and busy indicator readable on Fresh Green', () => {
    const source = readFileSync('components/RoutePreviewCard.tsx', 'utf8');

    expect(source).toMatch(/<ActivityIndicator size="small" color=\{colors\.black\} \/>/);
    expect(source).toMatch(/<ArrowRight size=\{24\} color=\{colors\.black\} weight="bold" \/>/);
  });
});
