import appConfig from '../../app.json';

test('uses the permanent Apple identity configuration', () => {
  expect(appConfig.expo.ios.bundleIdentifier).toBe(
    'com.freshgreens.navigation',
  );
  expect(appConfig.expo.ios.usesAppleSignIn).toBe(true);
  expect(appConfig.expo.plugins).toContain('expo-apple-authentication');
});
