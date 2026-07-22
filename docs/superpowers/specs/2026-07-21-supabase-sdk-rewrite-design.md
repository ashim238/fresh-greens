# Supabase SDK Rewrite Design

**Date:** 2026-07-21
**Status:** Approved architecture
**Scope:** Replace every direct Supabase REST call and the custom token owner
with one persistent configured `@supabase/supabase-js` client behind Fresh
Greens-owned repositories and adapters. Ephemeral stateless, non-persisting
auth verifiers are allowed only for captured access-token validation.

## Context

Fresh Greens currently uses Supabase without the official SDK. The app manually
creates anonymous users, refreshes and persists tokens, constructs PostgREST and
RPC requests, and injects authorization headers. That implementation has strong
account-isolation tests, but Apple identity linking would add more custom auth
protocol code to an already large session owner.

The rewrite makes the Supabase SDK the only code allowed to communicate directly
with Supabase while retaining product-level boundaries above it.

## Goals

- Make the Supabase SDK the sole authority for backend sessions.
- Link native Sign in with Apple to the current anonymous Supabase user when
  possible, preserving that user's database ownership.
- Sign returning Apple users into their existing permanent Supabase account.
- Replace direct PostgREST, RPC, role, moderation, and Edge Function requests
  with typed SDK operations.
- Preserve local-first community reports, offline queues, operation draining,
  account cleanup, and the app's unconfigured local-only mode.
- Keep screens and hooks independent of Supabase implementation details.
- Remove obsolete custom REST and token-management code after parity is proven.

## Non-goals

- No screen redesign or navigation-flow redesign.
- No migration of recordings, insurance cards, avatars, or report photos to
  Supabase Storage. Those files are currently local and need a separate bucket,
  retention, access-control, and consent design before upload behavior changes.
- No CarPlay work.
- No App Store submission in this rewrite. EAS and TestFlight configuration is
  the next release step after the SDK migration passes automated and on-device
  verification.
- No replacement of Supabase, its schema, or the existing RLS model.

## Target Architecture

```text
Screens and hooks
      |
      v
Fresh Greens repositories and adapters
      |
      v
One persistent configured Supabase SDK client
      |
      v
Auth, database, RPC, storage, and Edge Functions
```

Only modules under `lib/supabase/` may import the configured client. Screens and
hooks consume Fresh Greens-owned repository functions and product-level result
types.

## Client Boundary

Create a lazy singleton client under `lib/supabase/`. It is created only when
both `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are configured. Repositories return their
existing local-only or unconfigured behavior when no client exists.

Captured access-token validation creates a fresh stateless verifier using the
same public URL and publishable key. The verifier has persistence, automatic
refresh, and URL session detection disabled, stores no session, and is not used
for normal app auth or data access.

The client configuration will:

- Use `detectSessionInUrl: false` for native authentication.
- Enable persisted sessions and automatic token refresh.
- Start refresh while the app is active and stop it while backgrounded.
- Use the SDK's process lock to serialize refresh-sensitive operations.
- Use an Expo-compatible secure storage adapter for mobile sessions.
- Never log access tokens, refresh tokens, Apple identity tokens, or raw auth
  error payloads.
- Use generated database types so tables, views, and RPC arguments are checked
  at compile time.

The existing anonymous-key environment variable is retired after migration.
No service-role or secret key may be shipped in the application.

## Authentication Model

The SDK session is the only backend identity authority. Fresh Greens keeps a
small local user profile for display name, initials, email, and local avatar,
but that object does not determine whether backend requests are authenticated.

### Startup

1. Hydrate the SDK session through `supabase.auth.getSession()`.
2. A securely persisted permanent session may reopen the app while offline.
   Validate it with the server when connectivity is available; only a confirmed
   invalid session forces sign-out.
3. Reconstruct a missing local display profile from Supabase user metadata
   rather than treating a valid permanent SDK session as orphaned.
4. If backend services are configured and no Supabase session exists, create an
   anonymous Supabase session before the first backend operation.
5. Subscribe once to SDK auth-state changes and reflect signed-in, refreshed,
   and signed-out states through `SessionProvider`.
6. If Supabase is unconfigured, preserve the current local-only authentication
   behavior for development and single-device demos.

An anonymous Supabase session does not count as a signed-in Fresh Greens account.
The app can remain in its signed-out phase while the backend holds an anonymous
session for permitted operations.

### Sign in with Apple

1. Generate a one-time nonce and begin native Apple authentication.
2. Require a non-empty Apple identity token from the returned credential.
3. If the current Supabase user is anonymous, call the SDK's native identity
   linking flow with the Apple identity token and nonce.
4. If linking returns the specific identity-already-exists conflict, sign in to
   that permanent Supabase account with the same ID token. All other linking
   failures leave the app signed out and surface a retryable product error.
5. Persist the resulting SDK session before changing the Fresh Greens session
   phase to authenticated.
6. Use the Supabase user UUID as the canonical app identity. Migrate the stored
   local profile from the prior Apple subject identifier on first successful SDK
   sign-in while preserving Apple's first-sign-in-only name and email values.
7. Store non-sensitive display metadata in the local profile cache. The Apple
   token and nonce are never persisted by Fresh Greens.

Anonymous reports intentionally submitted before Apple sign-in remain anonymous.
Queued local reports are uploaded under the session active at upload time. The
client does not reassign existing database rows between user IDs.

### Sign out and Cleanup

The existing purge coordinator and operation gate remain the product-level
orchestrators.

- Normal sign-out requests SDK global sign-out so remote refresh tokens are
  revoked before local account data is released.
- A network or server failure remains retryable and keeps the current cleanup
  recovery flow.
- The existing "finish on this device" path performs SDK local sign-out and
  clears SDK session storage after the user explicitly chooses it.
- Account cleanup still drains active account operations before deleting local
  files, queues, caches, and profile state.
- SDK auth-state callbacks must not reopen a session while cleanup is sealed.

## Repository Design

### Community Reports

The community-report cloud adapter keeps its existing public API and local-first
queue. Its internals change to:

- `.from('community_reports_public').select()` for reads.
- `.from('community_reports').insert()` for writes.
- `.rpc('submitter_delete_report')` for soft deletion.
- SDK session user IDs for `auth_user_id`.
- SDK query abort signals tied to the account operation gate.
- Product-level error mapping from structured PostgREST error codes `P0001`
  through `P0004`.

### Moderation

Extract all direct networking from `app/moderation.tsx` into a typed moderation
repository. It owns moderation-view reads and all moderator RPC calls. The screen
continues to own display state, selection state, haptics, and user-facing copy.

### Roles

Replace the hand-built moderator-role URL in `useModeratorRole` with a role
repository query. The hook only manages loading and refresh state.

### Edge Functions and Storage

There are no current client-initiated Edge Function calls. Any future call must
go through a repository using `supabase.functions.invoke`. Server-triggered
functions remain server-side and are not duplicated in the app.

All future Supabase Storage access must be implemented in a repository using
`supabase.storage`. This rewrite does not upload existing local safety or profile
files because no approved bucket contract exists yet.

## Types and Errors

- Generate `Database` types from the deployed schema after all migrations are
  applied.
- Keep database row shapes inside repositories and map them to domain models.
- Screens receive domain objects and product errors, never `PostgrestError`,
  `AuthError`, raw rows, or SDK response wrappers.
- Expected unavailable or offline reads preserve current graceful fallback.
- Authentication and account-cleanup errors stay explicit because silently
  continuing could create identity or ownership mismatches.

## Migration Sequence

1. Add the SDK, URL polyfill, typed client factory, storage adapter, and client
   configuration tests.
2. Replace the custom cloud session owner with an SDK-backed auth repository
   while preserving the account-session interface and cleanup contract.
3. Add anonymous-session creation and Apple identity linking, including the
   returning-account fallback and local-profile ID migration.
4. Convert community-report reads, inserts, deletes, and queue flushes.
5. Extract and convert role and moderation operations.
6. Route any existing client Edge Function calls through the SDK.
7. Add an architecture test that rejects direct Supabase client imports outside
   `lib/supabase/`.
8. Delete `lib/supabase-auth.ts`, the hand-written REST implementation in
   `lib/cloud-session.ts`, and obsolete tests only after replacement behavior is
   green.
9. Run account-isolation, full Jest, TypeScript, Expo configuration, and real
   iPhone authentication checks sequentially.

## Testing Strategy

Implementation follows red-green-refactor. Tests cover behavior at the
repository boundary rather than asserting SDK mock internals.

Required automated coverage:

- Configured and unconfigured client creation.
- Secure session persistence, hydration, refresh events, and local clearing.
- Anonymous session creation and reuse.
- Apple nonce and identity-token validation.
- Anonymous-to-Apple identity linking.
- Returning Apple account sign-in after an identity conflict.
- No authenticated app phase before SDK persistence succeeds.
- Local profile migration from Apple subject ID to Supabase UUID.
- Global sign-out, retryable remote failure, and explicit local completion.
- Community-report reads, inserts, structured errors, RPC deletion, and queue
  retry behavior.
- Moderator role lookup and every moderation RPC.
- Account-operation abort and stale-result protection.
- No secret values in logs or thrown error messages.
- No direct configured-client imports from screens or hooks.

Required device verification:

- First Apple authorization on a real iPhone.
- Returning Apple authorization where Apple omits name and email.
- Sign out and sign back into the same Supabase user.
- Relaunch with a persisted session.
- Offline launch, interrupted sign-in, and revoked Apple authorization.
- Submit on one device and observe the report on another.
- Confirm moderator access is granted only to the promoted Supabase UUID.

## External Configuration

The code can be completed locally, but end-to-end acceptance also requires:

- A permanent Apple bundle identifier and Sign in with Apple capability.
- Supabase Apple provider configuration for that bundle identifier.
- Anonymous sign-ins enabled in Supabase.
- Manual identity linking enabled in Supabase.
- The current migration and seed applied to the target Supabase project.
- A moderator role assigned to the permanent Supabase user after first sign-in.
- Production URL and publishable key supplied to the EAS build environment.

## Acceptance Criteria

- No production module performs a direct fetch to a Supabase Auth, REST, RPC,
  Storage, or Functions URL.
- Exactly one persistent configured Supabase client exists. Ephemeral
  non-persisting auth verifiers are used only for captured-token validation.
- Screens and hooks access Supabase only through Fresh Greens repositories or
  adapters.
- Native Apple sign-in creates or restores a permanent Supabase-backed Fresh
  Greens identity without duplicating the user.
- Existing account cleanup and local-only behavior remain functional.
- Community reporting, moderation, roles, and server error mapping retain
  behavioral parity.
- The custom token parser, refresh endpoint code, and authorization-header
  builder are deleted.
- Automated gates pass and the real-device checklist succeeds before beginning
  the TestFlight release step.
