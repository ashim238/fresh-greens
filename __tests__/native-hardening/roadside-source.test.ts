const { readFileSync } = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
};

const source = readFileSync('app/roadside.tsx', 'utf8');

describe('roadside native hardening source contracts', () => {
  test('status-step navigation guard lets approved CTA exits dispatch once', () => {
    expect(source).toContain('approvedExitRef');
    expect(source).toContain('navigation.dispatch(data.action)');
  });

  test('message drafting is an accessible button, not a live-sharing switch', () => {
    expect(source).not.toContain('Switch,');
    expect(source).not.toContain('accessibilityRole="switch"');
    expect(source).toContain('`Open message draft for ${contact.name}`');
    expect(source).toContain(
      '`Message draft opened for ${contact.name}. Tap Send in Messages. Open message draft again`',
    );
    expect(source).toContain(
      'accessibilityHint="Opens Messages with your roadside details. You must tap Send in Messages."',
    );
  });
});
