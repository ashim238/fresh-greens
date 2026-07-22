# Supabase SDK Release Runbook

Use this checklist after the automated rewrite gates pass and before any
production distribution work. The Apple Developer, Supabase dashboard, and
real-iPhone checks are external manual acceptance work. Every box is
intentionally unchecked until someone performs that step against the release
environment.

For each check, mark exactly one status box and record no values or issue notes
in this file. Do not record UUIDs, tokens, secrets, IP addresses, Apple private
keys, copied dashboard payloads, or raw error bodies. If a check fails, record
details only in a separate bug with sanitized logs and session labels.

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

## Ordered Supabase Setup

Perform these rows from top to bottom. Never run the seed before the first
permanent login.

- Pass [ ] Fail [ ] Apply `supabase/migrations/0001_m1.1_initial.sql`.
- Pass [ ] Fail [ ] Apply `supabase/migrations/0002_supabase_sdk_contract_fix.sql`.
- Pass [ ] Fail [ ] Enable anonymous sign-ins.
- Pass [ ] Fail [ ] Enable manual identity linking.
- Pass [ ] Fail [ ] Enable Apple and add `com.freshgreens.navigation` to Client IDs.
- Pass [ ] Fail [ ] Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in gitignored `.env.local`.

## First Login And Safe Promotion

Use session labels such as Anonymous A and Permanent A in test notes. Never
write the underlying user identifier into this runbook or a bug.

- Pass [ ] Fail [ ] Complete the first anonymous-to-Apple login on Device A and confirm it converts the existing anonymous account in place.
- Pass [ ] Fail [ ] Confirm exactly one permanent `auth.users` row and no moderator row exist before promotion, without recording either identifier.
- Pass [ ] Fail [ ] Run `supabase/seed.sql` only after the first permanent login and confirm `private.bootstrap_first_moderator()` succeeds once.
- Pass [ ] Fail [ ] Re-running the seed is rejected because a moderator already exists; do not bypass the guard with a direct role insert.

## IP Retention

Migration `0002` installs the nightly job when `pg_cron` is already enabled.
If the extension was unavailable during migration, enable it in the Supabase
dashboard and, only when no job with this name exists, schedule it in SQL
Editor with:

```sql
SELECT cron.schedule(
  'fresh-greens-purge-old-ips',
  '0 3 * * *',
  'SELECT public.purge_old_ips()'
);
```

- Pass [ ] Fail [ ] Confirm the `fresh-greens-purge-old-ips` job runs nightly at `0 3 * * *` and calls `public.purge_old_ips()`.
- Pass [ ] Fail [ ] Run the owner-only purge once and confirm report and flag IPs older than 90 days become null while newer rows remain populated; record only Pass/Fail.
- Pass [ ] Fail [ ] Confirm anonymous, permanent, unpromoted, and moderator app sessions cannot execute the owner-only purge function.

## Authorization Matrix

Use disposable labeled sessions and sanitized test reports. Check both the
expected success and expected denial for every role. Do not record UUIDs,
tokens, secrets, IP addresses, device identifiers, or raw policy errors.

- Pass [ ] Fail [ ] Anonymous session: can read `community_reports_public` and submit an allowed low-risk report through `submit_report`.
- Pass [ ] Fail [ ] Anonymous session: cannot submit a protected report category, call moderator RPCs, read moderation rows, or mutate base tables directly.
- Pass [ ] Fail [ ] Permanent session: can submit a protected report and delete its own report through the guarded RPCs.
- Pass [ ] Fail [ ] Permanent session: cannot delete another session's report or mutate report, flag, role, ban, device, or audit tables directly.
- Pass [ ] Fail [ ] Unpromoted session: sees no moderator role and cannot list moderation reports or flags, restore reports, or remove reports.
- Pass [ ] Fail [ ] Unpromoted session: cannot inspect another session's role row or bypass RLS with direct base-table reads.
- Pass [ ] Fail [ ] Moderator session: can list moderation reports and flags through the security-invoker RPCs and can restore or remove reports through audited RPCs.
- Pass [ ] Fail [ ] Moderator session: still cannot insert, update, or delete protected base tables directly, and each successful state transition creates the expected sanitized audit action.

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
