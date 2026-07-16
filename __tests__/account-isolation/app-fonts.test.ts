jest.mock('expo-font', () => ({
  useFonts: jest.fn(),
}));

const { useFonts } = jest.mocked(require('expo-font'));
const { useAppFonts } = require('../../hooks/useAppFonts') as typeof import('../../hooks/useAppFonts');

describe('useAppFonts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('reports font loading errors so startup can fall back', () => {
    const error = new Error('font load failed');
    useFonts.mockReturnValue([false, error]);

    expect(useAppFonts()).toEqual({ loaded: false, error });
  });
});
