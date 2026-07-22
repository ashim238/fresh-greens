import appConfig from '../../app.json';

const fs = jest.requireActual('fs') as {
  readFileSync(file: string, encoding: string): string;
};
const path = jest.requireActual('path') as {
  join(...parts: string[]): string;
};

const runbook = fs.readFileSync(
  path.join(process.cwd(), 'docs/supabase-sdk-release-runbook.md'),
  'utf8',
);
const envExample = fs.readFileSync(
  path.join(process.cwd(), '.env.example'),
  'utf8',
);

test('uses the permanent Apple identity configuration', () => {
  expect(appConfig.expo.ios.bundleIdentifier).toBe(
    'com.freshgreens.navigation',
  );
  expect(appConfig.expo.ios.usesAppleSignIn).toBe(true);
  expect(appConfig.expo.plugins).toContain('expo-apple-authentication');
});

test('allows local signed device acceptance without opening distribution gates', () => {
  expect(runbook).toContain('signed local Xcode/CNG development build');
  expect(runbook).toContain('`.env.local`');
  expect(runbook).toContain(
    'Local native generation and a signed development build are allowed before manual acceptance.',
  );
  expect(runbook).toContain(
    'EAS configuration, production or store builds, and TestFlight uploads remain prohibited until every manual row passes.',
  );
  expect(envExample).toContain(
    'use a signed local Xcode/CNG development build',
  );
  expect(envExample).not.toContain(
    'Release builds must set both values in the EAS environment before the',
  );
});

test('requires anonymous identity preservation before cross-device acceptance', () => {
  const realIPhoneSection = runbook
    .split('## Real iPhone')[1]
    ?.split('## Distribution Gate')[0] ?? '';
  const requiredChecks = [
    'Create a Device A report before Apple linking while the current Supabase user is anonymous.',
    'Apple linking converts the current anonymous user in place.',
    'The Supabase UUID is unchanged across Apple linking.',
    'No second `auth.users` row exists for the test account.',
    'The linked user has `is_anonymous` set to `false`.',
    'First Apple sign-in leaves exactly one permanent `auth.users` row for the test account.',
    'Sign-out then sign-in restores the same Supabase UUID.',
    'Returning sign-in preserves display name when Apple returns null.',
    'The pre-link Device A report appears on device B.',
    'Promoted UUID can open moderation; unpromoted UUID cannot.',
    'Offline relaunch uses the persisted permanent session.',
    'Cancelling or interrupting Apple sign-in leaves the app signed out and retryable.',
    'Revoked Apple authorization is detected as invalid without deleting local data before cleanup completes.',
  ];

  let previousIndex = -1;
  for (const requiredCheck of requiredChecks) {
    const currentIndex = realIPhoneSection.indexOf(requiredCheck);
    expect(currentIndex).toBeGreaterThan(previousIndex);
    previousIndex = currentIndex;
  }

  expect(realIPhoneSection).toContain(
    'Record only Pass/Fail. Do not record the UUID.',
  );

  const checklistRows = runbook
    .split('\n')
    .filter((line: string) => line.startsWith('- '));
  expect(checklistRows.length).toBeGreaterThan(0);
  expect(checklistRows.every((line: string) =>
    line.startsWith('- Pass [ ] Fail [ ] ')
  )).toBe(true);
  expect(runbook).not.toMatch(/(?:Pass|Fail) \[[xX]\]/);
});
