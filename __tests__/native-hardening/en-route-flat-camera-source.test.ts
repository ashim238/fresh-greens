const { readFileSync } = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
};

const enRouteSource = readFileSync('app/en-route.tsx', 'utf8');

describe('en-route flat camera contract', () => {
  test('keeps every navigation camera state on a top-down plane', () => {
    const cameraPitches = [
      ...enRouteSource.matchAll(/\bpitch:\s*(\d+)/g),
    ].map((match) => Number(match[1]));

    expect(cameraPitches).toHaveLength(4);
    expect(cameraPitches).toEqual([0, 0, 0, 0]);
  });
});
