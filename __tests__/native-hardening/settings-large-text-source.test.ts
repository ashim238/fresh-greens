const { readFileSync } = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
};

const headerSource = readFileSync(
  'components/settings/SettingsHeader.tsx',
  'utf8',
);
const rowSource = readFileSync(
  'components/settings/SettingsRow.tsx',
  'utf8',
);
const menuSource = readFileSync('app/menu.tsx', 'utf8');

describe('settings large-text layout contract', () => {
  test('caps compact and large settings headers without hiding their names', () => {
    expect(headerSource).toMatch(
      /style=\{styles\.largeTitle\}[\s\S]*?maxFontSizeMultiplier=\{1\.5\}/,
    );
    expect(headerSource).toMatch(
      /style=\{styles\.title\}[\s\S]*?maxFontSizeMultiplier=\{1\.5\}/,
    );
    expect(headerSource).toContain(
      'dynamicType(typography.title1Emphasized, 1.5)',
    );
    expect(headerSource).toContain(
      'dynamicType(typography.bodyEmphasized, 1.5)',
    );
  });

  test('lets shared settings rows grow to two readable lines', () => {
    expect(rowSource).toMatch(
      /style=\{styles\.labelWithSubtitle\}[\s\S]*?numberOfLines=\{2\}[\s\S]*?maxFontSizeMultiplier=\{2\}/,
    );
    expect(rowSource).toMatch(
      /style=\{styles\.label\}[\s\S]*?numberOfLines=\{2\}[\s\S]*?maxFontSizeMultiplier=\{2\}/,
    );
    expect(rowSource).toContain(
      'dynamicType(typography.bodyEmphasized, 2)',
    );
    expect(rowSource).toContain('dynamicType(typography.bodyRegular, 2)');
    expect(rowSource).toMatch(
      /destructiveLabel:\s*\{[\s\S]*?color:\s*colors\.severityCritical/,
    );
  });

  test('keeps the account identity card useful instead of oversized', () => {
    expect(menuSource).toMatch(
      /style=\{styles\.profileGreeting\}[\s\S]*?maxFontSizeMultiplier=\{1\.5\}/,
    );
    expect(menuSource).toMatch(
      /style=\{styles\.profileName\}[\s\S]*?maxFontSizeMultiplier=\{1\.5\}/,
    );
    expect(menuSource).toContain(
      'dynamicType(typography.title2Emphasized, 1.5)',
    );
    expect(menuSource).toContain(
      'dynamicType(typography.title1Emphasized, 1.5)',
    );
  });
});
