const { readFileSync } = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
};

const roadsideSource = readFileSync('app/roadside.tsx', 'utf8');

describe('roadside large-text layout contract', () => {
  test('keeps the stress flow scrollable and caps short interface headings', () => {
    expect(roadsideSource).toContain('<ScrollView');
    expect(roadsideSource).toMatch(
      /style=\{styles\.subtitle\}[\s\S]*?maxFontSizeMultiplier=\{2\}/,
    );
    expect(roadsideSource).toMatch(
      /style=\{styles\.question\}[\s\S]*?maxFontSizeMultiplier=\{2\}/,
    );
    expect(roadsideSource).toMatch(
      /style=\{styles\.title\}[\s\S]*?maxFontSizeMultiplier=\{2\}/,
    );
    expect(roadsideSource).toContain('dynamicType(typography.title3Regular, 2)');
    expect(roadsideSource).toContain('dynamicType(typography.title1Regular, 2)');
    expect(roadsideSource).toContain('dynamicType(typography.brandDisplay, 2)');
  });

  test('lets action rows grow instead of fixing their height', () => {
    expect(roadsideSource).toMatch(/row:\s*\{[\s\S]*?minHeight:\s*60/);
    expect(roadsideSource).not.toMatch(/row:\s*\{[\s\S]*?height:\s*60/);
    expect(roadsideSource).toMatch(
      /style=\{styles\.rowLabel\}[\s\S]*?maxFontSizeMultiplier=\{2\}/,
    );
  });
});
