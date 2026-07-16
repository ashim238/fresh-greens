const { readFileSync } = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
};

function readSource(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

const sheetSource = readSource('components/LiveSafetySheet.tsx');
const controllerSource = readSource('components/LiveSafetyController.tsx');
const enRouteSource = readSource('app/en-route.tsx');

describe('live safety single owner', () => {
  test('LiveSafetySheet renders from controller props instead of owning hooks', () => {
    expect(sheetSource).not.toContain("from '../hooks/useShareSession'");
    expect(sheetSource).not.toContain("from '../hooks/useTrustedContact'");
    expect(sheetSource).toContain('controller: LiveSafetyControllerState');
  });

  test('controller is the only live-safety hook owner for sheet rendering', () => {
    expect(controllerSource).toContain('useShareSession()');
    expect(controllerSource).toContain('useTrustedContact()');
    expect(controllerSource).toContain('pillVisible');
  });

  test('en-route layout and sheet share one controller result', () => {
    expect(enRouteSource).toContain('const liveSafety = useLiveSafetyController();');
    expect(enRouteSource).toContain(
      'const columnBottomOffset = liveSafety.pillVisible ? 92 : 24;',
    );
    expect(enRouteSource).toContain('controller={liveSafety}');
  });
});
