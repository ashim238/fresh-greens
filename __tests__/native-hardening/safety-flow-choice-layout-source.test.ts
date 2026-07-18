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
  test('centers text-only choices and lets their cards grow', () => {
    expect(styleBlock(pulledOverSource, 'answersWrapper')).toContain(
      'gap: spacing.lg',
    );
    const answerCard = styleBlock(pulledOverSource, 'answerCard');
    expect(answerCard).toContain('minHeight: safetyCardHeight');
    expect(answerCard).not.toMatch(/\n\s*height:\s*safetyCardHeight/);
    expect(styleBlock(pulledOverSource, 'answerContent')).toContain(
      "alignItems: 'center'",
    );
    expect(styleBlock(pulledOverSource, 'answerTitle')).toContain(
      "textAlign: 'center'",
    );
    expect(styleBlock(pulledOverSource, 'answerSubtitle')).toContain(
      "textAlign: 'center'",
    );

    for (const source of [unfamiliarSource, shareLocationSource]) {
      expect(styleBlock(source, 'rowList')).toContain('gap: spacing.lg');
      const twoLineRow = styleBlock(source, 'twoLineRow');
      expect(twoLineRow).toContain('minHeight: safetyCardHeight');
      expect(twoLineRow).not.toMatch(/\n\s*height:\s*safetyCardHeight/);
      expect(twoLineRow).toContain("alignItems: 'center'");
      expect(styleBlock(source, 'rowTitle')).toContain("textAlign: 'center'");
      expect(styleBlock(source, 'rowClarifier')).toContain(
        "textAlign: 'center'",
      );
    }
  });

  test('keeps the share-location loading indicator in a trailing slot', () => {
    expect(shareLocationSource).toMatch(
      /isLoading\s*&&[\s\S]*?style=\{styles\.rowIndicatorSlot\}[\s\S]*?<ActivityIndicator/,
    );
    expect(styleBlock(shareLocationSource, 'rowTitleRow')).toContain(
      "justifyContent: 'center'",
    );
    expect(styleBlock(shareLocationSource, 'rowTitleRow')).toContain(
      'paddingHorizontal: spacing.lg',
    );
    expect(styleBlock(shareLocationSource, 'rowIndicatorSlot')).toMatch(
      /position:\s*'absolute'[\s\S]*?right:\s*0/,
    );
  });
});
