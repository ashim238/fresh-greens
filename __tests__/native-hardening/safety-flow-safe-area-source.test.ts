const { readFileSync } = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
};

const safetySource = readFileSync('app/safety.tsx', 'utf8');
const pulledOverSource = readFileSync('app/pulled-over.tsx', 'utf8');
const roadsideSource = readFileSync('app/roadside.tsx', 'utf8');
const unfamiliarSource = readFileSync('app/unfamiliar.tsx', 'utf8');
const shareLocationSource = readFileSync('app/share-location.tsx', 'utf8');

describe('safety flow safe-area contract', () => {
  test('entry safety flows protect both top and bottom safe areas', () => {
    for (const source of [
      safetySource,
      pulledOverSource,
      roadsideSource,
      unfamiliarSource,
      shareLocationSource,
    ]) {
      expect(source).toMatch(/<SafeAreaView[\s\S]*?edges=\{\['top', 'bottom'\]\}/);
    }
  });
});
