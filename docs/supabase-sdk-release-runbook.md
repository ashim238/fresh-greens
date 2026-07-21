# Supabase SDK Release Runbook

Use this checklist after the automated rewrite gates pass and before starting
EAS or TestFlight distribution. The Apple Developer, Supabase dashboard, and
real-iPhone checks are external manual acceptance work. Every box is
intentionally unchecked until someone performs that step against the release
environment.

For each check, mark exactly one status box. Record only a short, sanitized
issue note when a check fails. Do not add Apple private keys, Supabase secrets,
private user identifiers, identity or access tokens, or copied dashboard
payloads to this file.

## Apple Developer

- Pass [ ] Fail [ ] Register `com.freshgreens.navigation` as an explicit App ID.
- Pass [ ] Fail [ ] Enable Sign in with Apple for the App ID.
- Pass [ ] Fail [ ] Confirm Xcode/EAS provisioning includes `com.apple.developer.applesignin`.

## Supabase

- Pass [ ] Fail [ ] Apply `supabase/migrations/0001_m1.1_initial.sql`.
- Pass [ ] Fail [ ] Enable anonymous sign-ins.
- Pass [ ] Fail [ ] Enable manual identity linking.
- Pass [ ] Fail [ ] Enable Apple and add `com.freshgreens.navigation` to Client IDs.
- Pass [ ] Fail [ ] Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Real iPhone

- Pass [ ] Fail [ ] First Apple sign-in creates one permanent `auth.users` row.
- Pass [ ] Fail [ ] Sign-out then sign-in restores the same Supabase UUID.
- Pass [ ] Fail [ ] Returning sign-in preserves display name when Apple returns null.
- Pass [ ] Fail [ ] Device A report appears on device B.
- Pass [ ] Fail [ ] Promoted UUID can open moderation; unpromoted UUID cannot.
- Pass [ ] Fail [ ] Offline relaunch uses the persisted permanent session.
- Pass [ ] Fail [ ] Cancelling or interrupting Apple sign-in leaves the app signed out and retryable.
- Pass [ ] Fail [ ] Revoked Apple authorization is detected as invalid without deleting local data before cleanup completes.

## TestFlight Gate

Do not configure EAS or upload a TestFlight build until every checklist row has
`Pass` selected and no `Fail` selected. If a row fails, stop and open a focused
bug containing the failing step and sanitized logs only.
