const { readFileSync } = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
};

const zonesSource = readFileSync('lib/api/zones.ts', 'utf8');

describe('empty Overpass source contract', () => {
  test('successful empty Overpass responses remain checked empty evidence', () => {
    expect(zonesSource).not.toContain("throw new Error('Overpass returned no elements')");
    expect(zonesSource).not.toContain("throw new Error('No usable values in Overpass response')");
  });
});
