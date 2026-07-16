# Account Isolation Design

**Date:** 2026-07-15

**Status:** Implemented with source conformance and iOS simulator account-boundary verification; broader manual native audit remains

## Goal

Make sign-out a reliable account boundary. After sign-out starts, private screens must leave navigation history, account data must be removed from memory and local persistence, and the active Supabase session must be revoked. A later sign-in must start from a clean account state.

This work follows the product's calm, plain-language voice and its honesty-of-disclosure rule. The interface must say what is happening, expose recoverable failures, support Dynamic Type, and give VoiceOver the same state and actions as the visual UI. See `PRODUCT.md:9-38` and `DESIGN.md:143-155, 233-241, 297-319`.

## Scope

- Add one root app-session authority for hydration, sign-in, sign-out, purge recovery, and delegation to the cloud-session owner.
- Put every private route behind a root navigation guard.
- Remove private routes from history when the account becomes unavailable.
- Replace the screen-owned sign-out cascade with one idempotent purge coordinator and an authoritative manifest.
- Purge all identity-bound AsyncStorage records, app-owned personal files, scheduled refuel notifications, route-location caches, local report sync work, and the Supabase session.
- Prevent mounted hooks from carrying one person's data into another person's session.
- Show progress, failure, retry, and completion states with visible copy, actions, and VoiceOver behavior.
- Resume an interrupted purge on the next launch before any private screen or sign-in action is available.

## Non-goals

- Deleting Sign in with Apple authorization from Apple.
- Revoking iOS Calendar, Contacts, Camera, Photos, Location, or Notifications permissions. The app clears its connection flags and data, but OS permission changes remain in Settings.
- Deleting public community reports from Supabase. Local authored copies, pending uploads, and app-owned photos are purged. Account-level deletion of already-published community contributions is deferred.
- Linking the Apple identity to the cloud author identity. That boundary is owned by the privacy and community-data specification.
- Changing routing, scoring, report moderation, or safety-flow behavior beyond account isolation.
- Redesigning the existing authentication screens.
- Treating device learning as account data. Coach-mark acknowledgements and the device moderation UUID remain on the device.

## Verified root causes

### The root has no account boundary

`app/_layout.tsx:28-46` waits only for fonts, starts a Supabase anonymous session, and renders the full `Stack`. It does not hydrate the local user before exposing routes, and it does not classify routes as public or private. Any private path can therefore be opened directly while signed out.

`app/index.tsx:51-66` redirects an authenticated user from `/` to `/home`, but that is a one-way convenience redirect on the welcome screen. It does not protect `/home`, `/menu`, safety routes, or deep links.

### Sign-out does not remove private navigation history

`app/menu.tsx:322-346` clears data while `/menu` is still on the authenticated stack, then calls `router.replace('/sign-out')`. `app/sign-out.tsx:27-29, 87-92` only replaces the sign-out screen with `/login`. Neither action removes earlier private routes from the root stack. A back gesture, stale navigation action, or direct path can reveal a private screen after local identity has been cleared.

### Cleanup is incomplete and split across hook instances

`app/menu.tsx:120-146` creates local instances of several persistence hooks. `app/menu.tsx:334-345` clears the local user, trusted contact, saved places, regular destinations, preferences, fuel profile, insurance profile, calendar connection, calendar resolutions, and preferred stations.

The cascade omits recent searches, roadside service details, active share sessions, recordings and their audio files, local community report records, queued report uploads, report photos, avatar files, the active route cache, corridor and tile caches that encode traveled areas, and the Supabase session. The adapters and keys are verified in the purge manifest below.

### The Supabase session is only deleted locally and is recreated while signed out

`lib/supabase-auth.ts:15, 25-39` caches the session in module memory and AsyncStorage. `lib/supabase-auth.ts:115-118` clears only memory and the local key. It does not call the Supabase logout endpoint to revoke refresh tokens.

`app/_layout.tsx:31-38` calls `signInAnonymously()` whenever fonts load and cloud reporting is configured. That happens without reference to the Apple-backed local user. A completed sign-out can therefore be followed by an immediate anonymous cloud sign-in.

### A partial failure can strand the user without feedback

`app/menu.tsx:334-349` uses `Promise.all` with no `catch`. The first thrown rejection skips navigation, while `finally` only resets the local busy flag. No alert or inline error explains that some stores may have cleared and others may still exist.

The saved-places clear is especially inconsistent. `hooks/useSavedPlaces.ts:121-131` returns a `MutationResult` instead of throwing, while `app/menu.tsx:328-333` intentionally ignores that result. The UI can proceed as if cleanup succeeded after saved-place removal failed.

Several clear adapters also swallow storage errors, including `lib/api/recent-searches.ts:96-102`, `lib/api/route-cache.ts:129-134`, and `lib/api/zone-cache.ts:78-83`. A purge coordinator cannot report a failure unless purge-mode adapters throw or return a checked result.

### Mounted hooks can retain personal data

`hooks/useUser.ts:25-30, 32-48` states that each caller owns a local snapshot and reads only on mount. Clearing the `/menu` instance does not update `app/index.tsx`, `app/report.tsx`, or any other mounted `useUser` instance.

The same risk exists for mount-only personal collections. `hooks/useSavedPlaces.ts:33-43`, `hooks/useRecordings.ts:32-48`, and `hooks/useRecentSearches.ts:11-33` retain their own state after hydration. Refocus-aware hooks eventually reread storage, but that does not provide an atomic account switch. A newly authenticated person could briefly receive the prior person's React state.

### Personal files outlive their metadata

`app/menu.tsx:216-259` copies avatar images into `documentDirectory/avatars/`, while `lib/api/user.ts:70-73` removes only the user record. `lib/api/recordings.ts:8-17, 146-158` owns both recording metadata and files, but its existing bulk clear is not called by sign-out. `app/report.tsx:225-270` copies report photos into `documentDirectory/reports/`, while `lib/api/community-reports.ts:397-406` removes only AsyncStorage. Clearing metadata alone leaves sensitive files on disk.

## Considered approaches

### Chosen: root session provider, protected routes, and a purge registry

One root provider owns session state. Expo Router protected routes derive from that state and remove inaccessible routes from history. One purge registry calls adapter-level, idempotent cleanup functions and reports every result. A durable purge marker makes interruption recovery deterministic.

This approach fixes the navigation, persistence, failure, and stale-memory problems at their owners. It also gives future personal stores one registration point.

### Rejected: add redirects to each private screen

Per-screen redirects duplicate policy across more than 30 files, allow a protected screen to mount before redirecting, and do not reliably remove private history. A missed route becomes an account-isolation defect.

### Rejected: keep the cascade in `app/menu.tsx`

Adding more calls to the current `Promise.all` would still couple data ownership to one screen, preserve silent `MutationResult` failures, and leave local hook snapshots unsynchronized.

## Chosen architecture

### `SessionProvider` is the only identity authority

Create a provider near the root with this public contract:

```ts
type SessionPhase =
  | 'hydrating'
  | 'authenticated'
  | 'signingOut'
  | 'cleanupFailed'
  | 'signedOut'

type SessionContextValue = {
  phase: SessionPhase
  user: User | null
  failure: PurgeFailureSummary | null
  sessionGeneration: number
  signInWithApple(): Promise<{ user: User, wasReturning: boolean }>
  signInAsDevUser(): Promise<User>
  beginSignOut(): Promise<void>
  retryCleanup(): Promise<void>
}
```

`useUser()` becomes a compatibility wrapper over this context. It must not keep a second user state. Login and get-started call the provider's sign-in methods so the root guard changes in the same transaction as identity persistence.

On launch, the provider reads the pending-purge marker before the user record. A marker forces `signingOut` and purge recovery. Without a marker, a valid local user yields `authenticated`, and no user yields `signedOut`.

Cloud authentication starts only after `authenticated` and stops when the phase changes. This provider delegates cloud identity to the boundary defined in the privacy and community-data specification. It must not create an independent anonymous session after that boundary ships.

### A durable marker quarantines interrupted cleanup

Add `fresh-greens.pending-account-purge.v1` with a version, start time, and failed manifest IDs. It contains no user values or tokens.

`beginSignOut()` must write the marker before changing the phase. If that first write fails, cleanup does not start, the user stays authenticated, and `/menu` shows a normal alert. Once the marker exists, the phase changes to `signingOut`. The private route guard closes immediately.

All purge operations are idempotent. Missing keys, files, directories, and notification IDs count as success. The coordinator runs all independent tasks with `Promise.allSettled`, records each failure, and retries only failed tasks plus any dependency that must run again safely.

The marker is removed only after every required local task succeeds and Supabase revocation either succeeds or the provider confirms there was no session to revoke. Then the provider drops the in-memory user, increments `sessionGeneration`, and enters `signedOut`.

### Private React state is destroyed at the boundary

Protected routes unmount when the phase leaves `authenticated`. Key the protected route subtree by `sessionGeneration` so a successful sign-in always creates fresh hook instances. This handles local state held by `useHydratedState`, `useHydratedResource`, `useState`, refs, and pending mutations without adding a reset event to every hook.

Async hydration and mutations must also be session-aware. Capture the current generation before a read or write. Ignore a result if the generation changed before it resolved. This prevents an old account's in-flight read from repainting after sign-out or reauthentication.

## Authoritative purge manifest

The implementation must define this list once in a data-layer module. UI code calls the coordinator and never imports individual clear functions. Each manifest entry has a stable `id`, `label`, `kind`, and `purge(): Promise<void>`. Purge-mode functions must report failures instead of swallowing them.

| Manifest ID | Owner and storage | Personal data | Required purge behavior | Current sign-out coverage |
|---|---|---|---|---|
| `identity.user` | `lib/api/user.ts:24, 50-73`, `fresh-greens.user.v1` | Apple ID, name, email, avatar URI | Remove the key after dependent file cleanup | Included |
| `files.avatars` | `app/menu.tsx:216-259`, `documentDirectory/avatars/` | Profile photos, including orphaned prior versions | Delete the whole app-owned directory idempotently | Missing |
| `identity.trustedContact` | `lib/api/trusted-contact.ts:22, 39-52, 79-82` | Contact ID, name, phone, home coordinates | Remove the key | Included |
| `places.saved` | `lib/api/saved-places.ts:14, 25-33, 107-110` | Home and landmark coordinates | Remove the key and surface errors | Included, failure ignored |
| `places.regular` | `lib/api/regular-destinations.ts:17, 28-37, 125-128` | Habitual destinations and frequency | Remove the key | Included |
| `places.recent` | `lib/api/recent-searches.ts:22, 32-42, 96-102` | Recent destination names, addresses, coordinates | Remove the key and surface errors | Missing |
| `places.preferredStations` | `lib/api/preferred-stations.ts:17, 26-35, 117-120` | Trusted station locations | Remove the key | Included |
| `settings.preferences` | `lib/api/preferences.ts:20, 22-44, 71-74` | Personalized safety flags | Remove the key | Included |
| `vehicle.fuel` | `lib/api/fuel.ts:17, 37-69, 107-110` and scheduled notification | Vehicle, range, fill history, reminder ID | Cancel the stored notification, then remove the key | Included through one local hook |
| `safety.insurance` | `lib/api/insurance.ts:12-20, 43-45` | Carrier, policy number, card photo URI | Remove the key. Best-effort delete only an app-owned cached photo, never a Photos library original | Included metadata only |
| `safety.roadside` | `lib/api/roadside.ts:17, 20-32, 57-60` | Service name and phone number | Remove the key | Missing |
| `safety.shareSession` | `lib/api/share-session.ts:16, 20-29, 51-53` | Active safety reason and timestamps | Remove the key before allowing sign-in | Missing |
| `safety.recordings` | `lib/api/recordings.ts:27, 36-46, 146-158` and `document/recordings/` | Audio, timestamps, and armed-state context | Delete the whole recordings directory and metadata key. Directory deletion catches orphaned files | Missing |
| `calendar.connection` | `lib/api/calendar.ts:15, 21-23, 59-62` | App-level Calendar connection choice | Remove the key. Do not claim the OS permission was revoked | Included |
| `calendar.resolutions` | `lib/api/calendar-resolutions.ts:14, 16-23, 47-50` | Event location text mapped to places | Remove the key | Included |
| `reports.local` | `lib/api/community-reports.ts:29, 283-337, 397-406` | Authored report details, coordinates, identity, photo URIs | Remove local authored records and delete `documentDirectory/reports/` | Missing |
| `reports.syncQueue` | `lib/api/sources/community-cloud.ts:13, 164-207` | Unsent reports with locations and detail | Remove the queue without attempting upload | Missing |
| `navigation.activeRoute` | `lib/api/route-cache.ts:43, 46-51, 129-134` | Destination and route geometry | Remove the key and surface errors | Missing |
| `navigation.corridor` | `lib/api/zone-cache.ts:17, 19-24, 78-83` | Destination, route ID, and corridor | Remove the key and surface errors | Missing |
| `navigation.tiles` | `lib/api/zone-tile-cache.ts:17-24, 82-97` | Grid keys for recently browsed or traveled areas | Add an idempotent clear and remove the key | Missing |
| `navigation.resilience` | Route-resilience storage defined by the route-trust specification | Selected route, instructions, validated evidence, weak-signal areas, and estimated-progress metadata | Delete the app-owned resilience directory and metadata key idempotently | Planned dependency |
| `auth.supabase` | `lib/supabase-auth.ts:6-15, 25-39, 110-118` | Access token, refresh token, cloud user ID, module cache | Call Supabase logout with the current bearer token, require an accepted response, then clear protected credential storage and module memory | Missing |

The order has three dependency stages:

1. Write the recovery marker and move the UI into quarantine.
2. Revoke Supabase while the bearer token is available. In parallel, cancel the fuel notification and purge all other local entries and files.
3. Clear the local Supabase token and user record, remove the marker, clear provider memory, and increment the generation.

The device UUID in `lib/device-uuid.ts:4-25`, coach-mark keys in `hooks/useCoachMark.ts:4-18`, and public cloud report rows are explicitly retained. They are device or public-product state, not a signed-in person's private workspace.

## Navigation and auth boundary

The root stack must classify routes explicitly. No private route may be left outside a protected group.

- Guest routes: `/`, `/get-started`, and `/login`, available only in `signedOut`.
- Transition route: `/sign-out`, available in `signingOut`, `cleanupFailed`, and `signedOut` so the completion screen can remain visible.
- Private onboarding routes: `/onboarding`, `/permissions`, and `/trusted-contact-setup`.
- Private application routes: every remaining route in `app/`, including `/home`, `/menu`, settings, search, navigation, reporting, recordings, moderation, safety flows, modals, and setup screens.

While `hydrating`, render no navigator content and keep the splash screen visible. Hide the splash only after fonts and session recovery have settled.

When an authenticated guard becomes false, Expo Router must remove the private screens from navigation history. Do not rely on `router.replace()` as the security boundary. Route replacement remains useful for choosing the next allowed screen, but the guard owns access.

An unauthorized deep link to any private route resolves to `/login` after hydration. It must not briefly render the requested screen. Preserve the requested URL only as an in-memory post-login destination if the route is safe to resume. Do not persist it across sign-out.

After a successful login, the guest and sign-out routes become unavailable and are removed from history. Back navigation from `/home` must not return to login, sign-out, or any prior account's screen.

## Failure recovery

### Before quarantine starts

If writing the purge marker fails, stay on `/menu`. Show:

- Title: `Couldn't start sign out`
- Message: `Your account is still open on this device. Try again.`
- Actions: `Try again` and `Cancel`

No store has been intentionally changed at this point.

### After quarantine starts

The private navigator remains unavailable even if cleanup fails. `Promise.allSettled` returns a checked result for every manifest entry. The user sees one calm failure state, not raw store names or tokens.

- Heading: `We couldn't finish signing out`
- Body: `Some information is still on this device. Try the cleanup again before you log in.`
- Primary action: `Try again`
- Secondary action: none while any local purge task failed

If the only failure is Supabase revocation because the device is offline, keep the local session quarantined so retry remains possible. Show the same primary action plus `Finish on this device` as a secondary action. That action clears the local Supabase token and completes local sign-out, with this confirmation first: `The online session could not be confirmed as closed. It will expire, and this device will forget it now.`

No sign-in action is available while local cleanup is incomplete. Relaunch reads the marker, returns to the sign-out recovery screen, and retries automatically once. A failed automatic retry leaves the explicit `Try again` action.

Do not log user values, coordinates, phone numbers, policy numbers, tokens, or file URIs. Diagnostics may log only manifest IDs, error classes, and attempt timestamps.

## Plain-language user-state table

| User state | Technical condition | Visible copy | Available actions | VoiceOver behavior |
|---|---|---|---|---|
| Authenticated | `phase === 'authenticated'`, user loaded, no purge marker | Existing private screen copy | Normal app actions. Menu offers `Sign out` | On transition into the app, announce the destination screen's existing header. Do not announce auth internals |
| Signing out | Marker written, `phase === 'signingOut'`, private guard false, purge running | Heading: `Signing you out` Body: `Removing your information from this device.` | All sign-out controls disabled. No back or dismiss action | Move focus to the heading, announce `Signing you out. Removing your information from this device. In progress.` Mark the progress container busy. Do not announce each store |
| Partial cleanup failure | `phase === 'cleanupFailed'`, marker retained, private guard false | Heading: `We couldn't finish signing out` Body: `Some information is still on this device. Try the cleanup again before you log in.` | `Try again`. Show `Finish on this device` only for a remote-only failure | Post a live-region announcement once. Focus the heading, then expose the body and actions in reading order. Each button has a concise hint. Do not repeat the alert on rerender |
| Signed out | `phase === 'signedOut'`, required local tasks complete, marker absent, provider user null | Heading: `You've been logged out.` Body: `Drive safe.` | `Log back in` | Focus the heading and announce `You've been logged out. Drive safe.` The illustration stays hidden from VoiceOver. `Log back in` is announced as a button |
| Unauthorized deep link | Signed out after hydration and requested route belongs to the private group | Login heading: `Welcome back` Optional body: `Log in to open that page.` | `Log in with Apple`, `Sign up` | Do not expose the private screen to the accessibility tree. Move focus to `Welcome back`, then announce the optional explanation once |
| Reauthentication | Apple sign-in pending, then provider enters `authenticated` with a new generation | While pending, keep existing `Welcome back` copy and busy button. On success, show the allowed destination | Disable duplicate sign-in taps. Cancel remains owned by the Apple sheet | Sign-in button reports busy and disabled while pending. On success, remove guest routes from the tree and move focus to the destination header. No stale account content may be announced |

All new text uses Dynamic Type. Buttons keep a painted 44pt minimum target. Progress motion must resolve immediately under Reduce Motion. Error styling uses normal page and brand colors rather than safety signal red, because this is an account operation, not a physical danger signal.

## Rollout order

1. Add purge-capable adapter functions and tests. Make all purge paths idempotent and failure-reporting. Include app-owned directory cleanup and notification cancellation.
2. Add the authoritative manifest, result types, durable marker, staged coordinator, and interruption recovery tests.
3. Add `SessionProvider`. Move `useUser` to context and gate the cloud-session owner on `authenticated`.
4. Add the root protected-route classification and hydration splash gate. Verify every file in `app/` is classified.
5. Convert `/menu` to call only `beginSignOut()`. Convert `/sign-out` into progress, failure, and completion views.
6. Add generation checks to shared hydration and mutation primitives, then key the private subtree by `sessionGeneration`.
7. Run automated, manual navigation, file-system, offline, Dynamic Type, Reduce Motion, and VoiceOver verification before removing any old cascade code.

## Test strategy

The repository currently has no test script or test files in `package.json`. The implementation plan must add an Expo-compatible unit and React Native component test setup before changing behavior.

### Unit tests

- Manifest completeness test asserts the exact stable IDs in this document and rejects duplicates.
- Every purge adapter succeeds when its key or directory is already absent.
- File purges remove orphan files even when metadata is missing.
- Fuel purge cancels the stored notification before removing the profile.
- Supabase purge sends a logout request when a session exists, clears module memory and storage only after the chosen completion path, and returns a typed remote failure.
- Coordinator uses all settled results, preserves the marker on any required failure, records only failed IDs, and removes the marker only on success.
- A launch with a marker enters quarantine before reading a usable user.
- Generation-aware hydration ignores a result from an older generation.

### Provider and route tests

- Hydration does not render a private child before the user read settles.
- Authenticated exposes private routes and hides guest routes.
- Beginning sign-out unmounts the private tree before purge completion.
- Cleanup failure exposes only the recovery route.
- Signed out rejects a private deep link and lands on login without mounting the target.
- Reauthentication increments the generation and cannot reuse a previous hook state.
- Back navigation after sign-out and after reauthentication cannot reveal removed routes.

### Failure injection

Inject one failure at a time for every manifest entry, including AsyncStorage removal, directory deletion, notification cancellation, and Supabase logout. Assert the visible state, retry set, marker contents, and final data state. Add a multi-failure case to prove results are collected rather than short-circuited.

### Manual accessibility and device checks

- VoiceOver reading and focus order for all six states in the table.
- No duplicate live announcements during retries or rerenders.
- AX5 Dynamic Type without clipped copy or actions.
- Reduce Motion with no delayed or partial progress animation.
- iOS back gesture, modal swipe, app background and foreground, cold relaunch during purge, offline sign-out, and sign-in as a different Apple user.
- Inspect AsyncStorage keys, app document directories, scheduled notifications, and Supabase request logs after success.

## Acceptance criteria

- The root waits for session hydration before rendering navigable content.
- Every route in `app/` is explicitly guest, transition, or private.
- A signed-out deep link never mounts or exposes a private screen.
- Starting sign-out immediately removes the private navigation tree and disables back access to it.
- The UI calls one purge coordinator. `app/menu.tsx` imports no individual data-clear functions.
- Every manifest entry is attempted and checked. Cleanup does not short-circuit on the first failure.
- A successful sign-out removes every identity-bound AsyncStorage key, app-owned personal file directory, active refuel notification, and location-bearing route cache listed above.
- Supabase logout is attempted with the active session before local token deletion. A remote failure follows the documented recovery path.
- A partial failure is visible, actionable, and recoverable after app relaunch.
- No login action is available while required local cleanup remains incomplete.
- All mounted private hooks are destroyed on sign-out. Old async results cannot commit after the session generation changes.
- Signing in again creates a new private subtree and shows no previous user's profile, contact, places, searches, routes, recordings, reports, safety details, calendar resolutions, or preferences.
- Back navigation after sign-out or reauthentication cannot reveal a removed auth or private state.
- Visible copy, controls, focus, busy state, and announcements match the user-state table.
- TypeScript, automated tests, manual device checks, Dynamic Type, Reduce Motion, and VoiceOver verification pass.

## Deferred work

- Account-level deletion or ownership transfer for published Supabase community reports.
- Remote session management across multiple devices.
- A settings screen that lists and deletes each local data category independently.
- Revoking Apple authorization or OS permissions from inside the app.
- Deciding whether coach-mark learning should be device-bound forever or move to account scope.
