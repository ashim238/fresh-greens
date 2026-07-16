const { readFileSync } = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
};

const hookSource = readFileSync('hooks/useShareSession.ts', 'utf8');
const notifySource = readFileSync('lib/notify-trusted-contact.ts', 'utf8');
const roadsideSource = readFileSync('app/roadside.tsx', 'utf8');

describe('share-session draft-opened truth contracts', () => {
  test('notify result names a draft opening rather than a confirmed notification', () => {
    expect(notifySource).toContain('openedAtIso');
    expect(notifySource).not.toContain('notifiedAtIso');
  });

  test('share sessions become active only after Messages opens', () => {
    expect(hookSource).toContain('if (!result.opened) {');
    expect(hookSource).toContain('Messages draft could not be opened');
    expect(hookSource).not.toContain('await setStoredShareSession(next);');
  });

  test('roadside copy says the active SMS content is a draft', () => {
    expect(roadsideSource).toContain(
      'Message draft opened — tap Send in Messages',
    );
    expect(roadsideSource).toContain('Draft opened');
    expect(roadsideSource).not.toContain('What they know');
  });
});
