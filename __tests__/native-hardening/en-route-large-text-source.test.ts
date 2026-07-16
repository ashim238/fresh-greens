const { readFileSync } = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
};

const enRouteSource = readFileSync('app/en-route.tsx', 'utf8');

describe('en-route glanceable text contract', () => {
  test('keeps fixed-proportion road signs and dashboard speed from scaling', () => {
    expect(enRouteSource).toMatch(
      /style=\{styles\.speedLimitSignNumber\}[\s\S]*?allowFontScaling=\{false\}/,
    );
    expect(enRouteSource).toMatch(
      /style=\{styles\.speedLimitCurrentNumber\}[\s\S]*?allowFontScaling=\{false\}/,
    );
    expect(enRouteSource).toMatch(
      /style=\{styles\.speedLimitCurrentUnit\}[\s\S]*?allowFontScaling=\{false\}/,
    );
  });

  test('caps turn and ETA chrome while preserving full accessibility labels', () => {
    expect(enRouteSource).toMatch(
      /style=\{styles\.turnInstruction\}[\s\S]*?maxFontSizeMultiplier=\{1\.5\}/,
    );
    expect(enRouteSource).toMatch(
      /style=\{styles\.turnStreet\}[\s\S]*?maxFontSizeMultiplier=\{1\.5\}/,
    );
    expect(enRouteSource).toMatch(
      /style=\{\[styles\.eta,[\s\S]*?maxFontSizeMultiplier=\{1\.5\}/,
    );
    expect(enRouteSource).toContain(
      'dynamicType(relaxedLineHeight(typography.title2Emphasized), 1.5)',
    );
    expect(enRouteSource).toContain(
      'dynamicType(typography.largeTitleEmphasized, 1.5)',
    );
    expect(enRouteSource).toContain(
      'dynamicType(relaxedLineHeight(typography.subheadlineEmphasized), 1.5)',
    );
    expect(enRouteSource).toMatch(
      /style=\{styles\.endTripText\}[\s\S]*?maxFontSizeMultiplier=\{1\.5\}/,
    );
  });

  test('keeps variable expanded-sheet details scrollable above a pinned exit', () => {
    expect(enRouteSource).toContain('useWindowDimensions');
    expect(enRouteSource).toMatch(
      /style=\{\[styles\.bottomSheet, \{ maxHeight: windowHeight \* 0\.65 \}\]\}/,
    );
    expect(enRouteSource).toMatch(
      /<ScrollView[\s\S]*?contentContainerStyle=\{styles\.sheetContent\}[\s\S]*?<\/ScrollView>[\s\S]*?styles\.endTripBtn/,
    );
  });
});
