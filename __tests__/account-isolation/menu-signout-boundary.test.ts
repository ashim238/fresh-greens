const fs = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
};
const path = jest.requireActual('path') as {
  join(...parts: string[]): string;
};

describe('menu sign-out boundary', () => {
  test('delegates cleanup only to the root session authority', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'app/menu.tsx'),
      'utf8',
    );

    expect(source).toContain('beginSignOut');
    expect(source).not.toMatch(/clearStored|clearContact|clearResolutions/);
    expect(source).not.toMatch(/clearCalendarConnection|clearPreferredStations/);
    expect(source).not.toContain('Promise.all([');
    expect(source).toContain('accountOperationGate.runCurrent');

    const reportSource = fs.readFileSync(
      path.join(process.cwd(), 'app/report.tsx'),
      'utf8',
    );
    expect(reportSource).toContain('accountOperationGate.runCurrent');
  });
});
