const { readFileSync } = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
};

const source = readFileSync('app/pulled-over.tsx', 'utf8');

describe('pulled-over large-text layout contract', () => {
  test('keeps the armed decision and its answers reachable at AX5', () => {
    expect(source).toMatch(
      /function ArmedView[\s\S]*?<ScrollView[\s\S]*?contentContainerStyle=\{armedStyles\.scrollContent\}[\s\S]*?<View style=\{armedStyles\.page\}>/,
    );
    expect(source).toMatch(
      /style=\{armedStyles\.eyebrow\}[\s\S]*?maxFontSizeMultiplier=\{2\}/,
    );
    expect(source).toMatch(
      /style=\{armedStyles\.title\}[\s\S]*?maxFontSizeMultiplier=\{2\}/,
    );
    expect(source).toContain('dynamicType(typography.title3Regular, 2)');
    expect(source).toContain('dynamicType(typography.title1Regular, 2)');
  });

  test('lets answer cards and labels grow instead of clipping', () => {
    expect(source).toMatch(
      /answerCard:\s*\{[\s\S]*?minHeight:\s*safetyCardHeight/,
    );
    expect(source).not.toMatch(
      /answerCard:\s*\{[\s\S]*?\n\s*height:\s*safetyCardHeight/,
    );
    expect(source).toMatch(
      /style=\{armedStyles\.answerTitle\}[\s\S]*?maxFontSizeMultiplier=\{2\}/,
    );
    expect(source).toMatch(
      /style=\{armedStyles\.answerSubtitle\}[\s\S]*?maxFontSizeMultiplier=\{2\}/,
    );
  });

  test('keeps trusted-contact actions scrollable and truthful', () => {
    expect(source).toMatch(
      /function ContactView[\s\S]*?<ScrollView[\s\S]*?contentContainerStyle=\{contactStyles\.page\}/,
    );
    expect(source).toContain(
      'No message or location has been sent yet.',
    );
    expect(source).toMatch(/callBtn:\s*\{[\s\S]*?minHeight:\s*48/);
    expect(source).toMatch(/textBtn:\s*\{[\s\S]*?minHeight:\s*48/);
  });

  test('lets the officer comparison scroll and stack at accessibility sizes', () => {
    expect(source).toMatch(
      /function OfficerTrooperView[\s\S]*?PixelRatio\.getFontScale\(\)[\s\S]*?<ScrollView/,
    );
    expect(source).toContain('largeText && officerStyles.cardsColumn');
    expect(source).toContain('largeText && officerStyles.dividerHorizontal');
  });
});
