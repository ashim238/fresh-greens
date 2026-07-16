const { readFileSync } = jest.requireActual('fs') as {
  readFileSync(path: string, encoding: string): string;
};

const routePreviewSource = readFileSync('components/RoutePreviewCard.tsx', 'utf8');
const searchBarSource = readFileSync('components/SearchBar.tsx', 'utf8');
const homeSource = readFileSync('app/home.tsx', 'utf8');

describe('route preview large-text layout contract', () => {
  test('lets the route summary reflow instead of clipping its primary facts', () => {
    expect(routePreviewSource).toContain('maxFontSizeMultiplier={2}');
    expect(routePreviewSource).toMatch(
      /routeHeroRow:\s*\{[\s\S]*?flexWrap:\s*'wrap'/,
    );
    expect(routePreviewSource).toMatch(
      /routeMetaCluster:\s*\{[\s\S]*?flexWrap:\s*'wrap'/,
    );
    expect(routePreviewSource).toMatch(
      /routeViaRow:\s*\{[\s\S]*?flexWrap:\s*'wrap'/,
    );
    expect(routePreviewSource).toMatch(
      /style=\{styles\.routeDestTitle\}[\s\S]*?numberOfLines=\{2\}/,
    );
    expect(routePreviewSource).not.toContain('adjustsFontSizeToFit');
    expect(routePreviewSource).not.toContain('minimumFontScale={0.7}');
  });

  test('lets fixed action controls grow with their labels', () => {
    expect(routePreviewSource).toMatch(
      /scheduleBtn:\s*\{[\s\S]*?minHeight:\s*44/,
    );
    expect(routePreviewSource).not.toMatch(
      /scheduleBtn:\s*\{[\s\S]*?height:\s*44/,
    );
    expect(routePreviewSource).toMatch(/goBtn:\s*\{[\s\S]*?minHeight:\s*44/);
    expect(routePreviewSource).not.toMatch(/goBtn:\s*\{[\s\S]*?height:\s*44/);
    expect(routePreviewSource).toContain('numberOfLines={2}');
  });

  test('keeps the map search label visible at accessibility sizes', () => {
    expect(searchBarSource).toContain('maxFontSizeMultiplier={2}');
  });

  test('gives the large-text route sheet a definite frame so its body can scroll', () => {
    expect(homeSource).toContain('PixelRatio.getFontScale()');
    expect(routePreviewSource).toContain('PixelRatio.getFontScale()');
    expect(homeSource).toContain('fontScale > 1');
    expect(homeSource).toContain('styles.bottomSheetLargeText');
    expect(homeSource).toContain('useSafeAreaInsets');
    expect(homeSource).toContain('largeTextRouteBodyHeight');
    expect(routePreviewSource).toContain('styles.bottomSheetScrollLargeText');
    expect(routePreviewSource).toMatch(
      /bottomSheetScrollLargeText:\s*\{[\s\S]*?flex:\s*1/,
    );
    expect(routePreviewSource).toMatch(
      /routePreviewLargeText:\s*\{[\s\S]*?flex:\s*1/,
    );
    expect(routePreviewSource).toMatch(
      /routePreviewLayout:\s*\{[\s\S]*?flexShrink:\s*1/,
    );
  });
});
