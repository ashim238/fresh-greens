import { PixelRatio } from 'react-native';

import { dynamicType } from '../../theme/dynamic-type';

describe('dynamicType', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('lets React Native scale font size once while matching the explicit line height', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);

    expect(dynamicType({ fontSize: 17, lineHeight: 22 })).toEqual({
      fontSize: 17,
      lineHeight: 44,
    });
  });

  test('can cap line-height growth when the Text uses the same maximum multiplier', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(3.12);

    expect(dynamicType({ fontSize: 17, lineHeight: 22 }, 2)).toEqual({
      fontSize: 17,
      lineHeight: 44,
    });
  });
});
