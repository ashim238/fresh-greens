# Supabase SDK Release Runbook

Use this checklist after the automated rewrite gates pass and before any
production distribution work. The Apple Developer, Supabase dashboard, and
real-iPhone checks are external manual acceptance work. Every box is
intentionally unchecked until someone performs that step against the release
environment.

For each check, mark exactly one status box and record no values or issue notes
in this file. Do not add Apple private keys, Supabase secrets, private user
identifiers, identity or access tokens, or copied dashboard payloads. If a check
fails, record the details only in a separate bug with sanitized logs.

## Allowed Local Device Path

Use the public Supabase URL and publishable key from a gitignored `.env.local`.
Run a signed local Xcode/CNG development build on the test iPhone using either
`npx expo run:ios --device` or a locally generated Xcode workspace from
`npx expo prebuild --platform ios`. Use a Debug development build only.

Local native generation and a signed development build are allowed before manual acceptance.
EAS configuration, production or store builds, and TestFlight uploads remain prohibited until every manual row passes.

## Apple Developer

- Pass [ ] Fail [ ] Register `com.freshgreens.navigation` as an explicit App ID.
- Pass [ ] Fail [ ] Enable Sign in with Apple for the App ID.
- Pass [ ] Fail [ ] Confirm local Xcode development provisioning includes `com.apple.developer.applesignin`.

## Supabase

- Pass [ ] Fail [ ] Apply `supabase/migrations/0001_m1.1_initial.sql`.
- Pass [ ] Fail [ ] Enable anonymous sign-ins.
- Pass [ ] Fail [ ] Enable manual identity linking.
- Pass [ ] Fail [ ] Enable Apple and add `com.freshgreens.navigation` to Client IDs.
- Pass [ ] Fail [ ] Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in gitignored `.env.local`.

## Real iPhone

For the identity comparisons below: Record only Pass/Fail. Do not record the UUID.

- Pass [ ] Fail [ ] Create a Device A report before Apple linking while the current Supabase user is anonymous.
- Pass [ ] Fail [ ] Apple linking converts the current anonymous user in place.
- Pass [ ] Fail [ ] The Supabase UUID is unchanged across Apple linking.
- Pass [ ] Fail [ ] No second `auth.users` row exists for the test account.
- Pass [ ] Fail [ ] The linked user has `is_anonymous` set to `false`.
- Pass [ ] Fail [ ] First Apple sign-in leaves exactly one permanent `auth.users` row for the test account.
- Pass [ ] Fail [ ] Sign-out then sign-in restores the same Supabase UUID.
- Pass [ ] Fail [ ] Returning sign-in preserves display name when Apple returns null.
- Pass [ ] Fail [ ] The pre-link Device A report appears on device B.
- Pass [ ] Fail [ ] Promoted UUID can open moderation; unpromoted UUID cannot.
- Pass [ ] Fail [ ] Offline relaunch uses the persisted permanent session.
- Pass [ ] Fail [ ] Cancelling or interrupting Apple sign-in leaves the app signed out and retryable.
- Pass [ ] Fail [ ] Revoked Apple authorization is detected as invalid without deleting local data before cleanup completes.

## Distribution Gate

Only after every checklist row has `Pass` selected and no `Fail` selected may
the release proceed to EAS environment configuration, production or store
builds, EAS provisioning verification, and TestFlight upload. If a row fails,
stop and open a focused bug containing the failing step and sanitized logs only.
