const { readFileSync } = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
};

const pulledOverSource = readFileSync('app/pulled-over.tsx', 'utf8');
const unfamiliarSource = readFileSync('app/unfamiliar.tsx', 'utf8');
const shareLocationSource = readFileSync('app/share-location.tsx', 'utf8');

function styleBlock(source: string, name: string): string {
  const match = source.match(
    new RegExp(`\\n\\s{2}${name}: \\{([\\s\\S]*?)\\n\\s{2}\\},`),
  );

  expect(match).not.toBeNull();
  return match?.[1] ?? '';
}

describe('safety flow choice layout contract', () => {
  test('centers the armed choices inside an explicit scroll-safe region', () => {
    expect(pulledOverSource).toMatch(
      /<ScrollView[\s\S]*?style=\{armedStyles\.scroll\}[\s\S]*?contentContainerStyle=\{armedStyles\.scrollContent\}/,
    );
    expect(pulledOverSource).toMatch(
      /contentContainerStyle=\{armedStyles\.scrollContent\}[\s\S]*?<View style=\{armedStyles\.page\}>[\s\S]*?<View style=\{armedStyles\.titleBlock\}>[\s\S]*?<View style=\{armedStyles\.answersWrapper\}>/,
    );

    expect(styleBlock(pulledOverSource, 'scroll')).toContain('flex: 1');
    expect(styleBlock(pulledOverSource, 'scrollContent')).toContain(
      'flexGrow: 1',
    );

    const page = styleBlock(pulledOverSource, 'page');
    expect(page).toContain('flexGrow: 1');
    expect(page).not.toContain("minHeight: '100%'");
    expect(page).not.toContain('gap: spacing.xl');
    expect(page).not.toContain('paddingBottom');

    const answers = styleBlock(pulledOverSource, 'answersWrapper');
    expect(answers).toContain('flexGrow: 1');
    expect(answers).not.toMatch(/\n\s*flex:\s*1/);
    expect(answers).toContain("justifyContent: 'center'");
    expect(answers).toContain('paddingVertical: spacing.lg');
  });

  test('centers choice stacks while keeping card copy leading-aligned', () => {
    expect(styleBlock(pulledOverSource, 'answersWrapper')).toContain(
      'gap: spacing.lg',
    );
    expect(styleBlock(pulledOverSource, 'answersWrapper')).toContain(
      "justifyContent: 'center'",
    );
    const answerCard = styleBlock(pulledOverSource, 'answerCard');
    expect(answerCard).toContain('minHeight: safetyCardHeight');
    expect(answerCard).toContain("justifyContent: 'center'");
    expect(answerCard).not.toMatch(/\n\s*height:\s*safetyCardHeight/);
    expect(styleBlock(pulledOverSource, 'answerContent')).toContain(
      "alignItems: 'stretch'",
    );
    expect(styleBlock(pulledOverSource, 'answerTitle')).toContain(
      "textAlign: 'left'",
    );
    expect(styleBlock(pulledOverSource, 'answerSubtitle')).toContain(
      "textAlign: 'left'",
    );

    for (const source of [unfamiliarSource, shareLocationSource]) {
      expect(styleBlock(source, 'rowList')).toContain('gap: spacing.lg');
      expect(styleBlock(source, 'rowList')).toContain(
        "justifyContent: 'center'",
      );
      const twoLineRow = styleBlock(source, 'twoLineRow');
      expect(twoLineRow).toContain('minHeight: safetyCardHeight');
      expect(twoLineRow).toContain("justifyContent: 'center'");
      expect(twoLineRow).not.toMatch(/\n\s*height:\s*safetyCardHeight/);
      expect(twoLineRow).toContain("alignItems: 'stretch'");
      expect(styleBlock(source, 'rowTitle')).toContain("textAlign: 'left'");
      expect(styleBlock(source, 'rowClarifier')).toContain(
        "textAlign: 'left'",
      );
    }
  });

  test('keeps the share-location loading indicator in a trailing slot', () => {
    expect(shareLocationSource).toMatch(
      /isLoading\s*&&[\s\S]*?style=\{styles\.rowIndicatorSlot\}[\s\S]*?<ActivityIndicator/,
    );
    expect(styleBlock(shareLocationSource, 'rowTitleRow')).toContain(
      "justifyContent: 'flex-start'",
    );
    expect(styleBlock(shareLocationSource, 'rowTitleRow')).toContain(
      'paddingRight: spacing.lg',
    );
    expect(styleBlock(shareLocationSource, 'rowTitleRow')).not.toContain(
      'paddingHorizontal',
    );
    expect(styleBlock(shareLocationSource, 'rowTitle')).toContain('flex: 1');
    expect(styleBlock(shareLocationSource, 'rowIndicatorSlot')).toMatch(
      /position:\s*'absolute'[\s\S]*?right:\s*0/,
    );
  });
});
