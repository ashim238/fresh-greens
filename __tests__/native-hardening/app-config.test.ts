const appConfig = require('../../app.json') as {
  expo: {
    ios?: {
      supportsTablet?: boolean;
    };
    android?: {
      permissions?: string[];
    };
  };
};

describe('native app platform declarations', () => {
  test('does not request write access to contacts on Android', () => {
    expect(appConfig.expo.android?.permissions ?? []).not.toContain(
      'android.permission.WRITE_CONTACTS',
    );
  });

  test('does not advertise tablet support without a tablet validation plan', () => {
    expect(appConfig.expo.ios?.supportsTablet).toBe(false);
  });
});
