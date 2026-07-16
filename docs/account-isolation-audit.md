# Account Isolation Audit

**Date:** 2026-07-15
**Status:** Source conformance supported; iOS simulator account-boundary rerun passed with storage inspection; broader native runtime verdict still pending

## Plain-language model

The account boundary works like closing a room before cleaning it:

```text
1. Put a durable “cleanup in progress” sign on the door.
2. Lock the door so no new personal writes can begin.
3. Wait for writes already inside the room to finish.
4. Remove every owned personal record, file, reminder, cache, and credential.
5. Remove the sign and open a fresh room for the next account.
```

If step 1 fails, the current account remains open and the menu says so. If a
later step fails, private routes remain locked, the marker remains durable, and
the sign-out screen offers Retry. A retryable remote-only failure additionally
offers Finish on this device after a disclosure.

## User-state map

| State | What the system knows | What the user sees | Available action |
|---|---|---|---|
| Initial hydration | Ownership has not been proven | Splash remains visible | None |
| Startup error | Identity, marker, or credential ownership is unreadable | `We couldn't open Fresh Greens` and retained-data disclosure | Retry, with a visible busy state |
| Authenticated | A durable local user owns the active generation | Normal private app | Sign out from Menu |
| Signing out | Marker is durable, private routes are closed, writers are draining or purge is running | `Signing you out` and `Removing your information from this device.` | None |
| Cleanup failed | Marker remains and at least one required boundary is incomplete | Calm retained-data disclosure | Retry; Finish on this device only for retryable remote-only failure |
| Signed out | Required local cleanup is complete and marker is absent | Confirmed or local-only completion | Log back in |

## Owned purge boundaries

The runtime manifest contains exactly 22 unique IDs in this order:

1. `identity.user`
2. `files.avatars`
3. `identity.trustedContact`
4. `places.saved`
5. `places.regular`
6. `places.recent`
7. `places.preferredStations`
8. `settings.preferences`
9. `vehicle.fuel`
10. `safety.insurance`
11. `safety.roadside`
12. `safety.shareSession`
13. `safety.recordings`
14. `calendar.connection`
15. `calendar.resolutions`
16. `reports.local`
17. `reports.syncQueue`
18. `navigation.activeRoute`
19. `navigation.corridor`
20. `navigation.tiles`
21. `navigation.resilience`
22. `auth.supabase`

`vehicle.fuel` owns both the fuel profile and all tagged Fresh Greens personal
notifications. Purge enumerates tagged reminders so orphaned departure or
refuel notifications are removed even when the stored notification ID is lost.
Unrelated notifications are retained.

## Operation-gate coverage

The account operation gate now owns:

- Shared mutations and generation-aware hydration.
- Profile updates and personal adapter writes.
- Avatar and report-photo picker/copy workflows.
- Route, corridor, and passive tile cache writes.
- Preferences, fuel state, notification scheduling, and cancellation cleanup.
- Local reports and the report sync queue.
- Recording metadata and file work through the shared mutation boundary.

Purge and marker adapters intentionally bypass the ordinary gate because the
coordinator must be the final writer after the gate drains. Device-scoped coach
marks and the device moderation UUID are intentionally outside account purge.

## Startup and navigation boundaries

- The pending-purge marker is read before identity.
- Startup seals and drains the legacy generation before ownership is exposed.
- A missing local user plus a found cloud credential enters quarantine cleanup
  before guest sign-in appears.
- Corrupt or unreadable identity fails closed instead of being treated as a new
  user.
- Every route is explicitly guest, transition, or private.
- A signed-out private deep link becomes plain `/login`; its query is discarded.
- Authentication removes guest and sign-out history. Sign-out removes private
  history through protected-route guards rather than screen-owned replacement.

## Retained state and explicit deferrals

Retained by design:

- Device moderation UUID.
- Coach-mark acknowledgements.
- Public cloud community-report rows.
- External Photos-library insurance source URI; the app does not claim to
  delete or revoke OS-owned content or permissions.

Deferred:

- Account-level deletion of already-published community contributions.
- Linking Apple identity to cloud author identity and replacing anonymous cloud
  authorship.
- Resuming a private deep link after authentication.
- A global recording manager; current recording work remains route-owned.

## Automated evidence

Verified on 2026-07-15:

- `npm run test:account-isolation`: 14 suites, 208 tests passed.
- `npm test -- --runInBand`: 23 suites, 254 tests passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.

Tests cover strict identity reads, marker durability, all-settled purge,
same-process retry, remote-only Finish, orphaned cloud cleanup, bounded writer
drain, last-writer cache and notification races, generation-aware hooks, exact
route classification, private deep-link collapse, startup recovery, and every
visible sign-out state.

## Provisional native design audit

These scores remain capped at 3 because only a partial iPhone simulator pass
was completed. Android, physical-device, VoiceOver, and Reduce Motion behavior
were not observed.

| Dimension | Score | Source finding |
|---|---:|---|
| Accessibility | 3/4 | Dynamic Type, semantic headers, busy states, action hints, hidden decorative art, and scrollable sign-out content are present. Runtime focus order and maximum text sizes remain unobserved. |
| Performance | 3/4 | Startup work is bounded and local, writes drain once, and no polling or implicit retry loop was added. Launch timing remains unmeasured. |
| Appearance and theming | 3/4 | Account surfaces use project typography, color, spacing, and button tokens. Dark appearance is not implemented as a first-class scheme. |
| Platform conformance | 3/4 | Safe areas, native alerts, stack guards, and standard pressable/button behavior are used. Android-specific 48 dp targets and predictive Back need device verification. |
| Adaptivity | 3/4 | Account recovery surfaces support safe areas, scrolling, and Dynamic Type. Tablet, landscape, split-screen, and foldable behavior remains unobserved. |
| **Total** | **15/20** | **Good, provisional** |

## Native evidence recorded

Observed on 2026-07-15 in the iPhone 17 Pro simulator on iOS 26.3:

- An earlier manual simulator pass appeared to show successful sign-out from
  `/menu`, a blocked signed-out deep link to `freshgreens:///menu`, and a cold
  relaunch to the public welcome surface.
- That earlier conclusion is no longer trustworthy. A later container
  inspection on the same simulator found `fresh-greens.user.v1` still present
  in `RCTAsyncLocalStorage_V1/manifest.json` with the `dev-simulator-user`
  payload after the app had been treated as signed out.
- The same later pass also reopened private surfaces: `freshgreens:///menu`
  rendered authenticated Settings with `Hey there, Dev User`, and a force-close
  plus relaunch returned to private home instead of the public welcome flow.
- During follow-up verification, CoreSimulatorService became unstable and
  stopped responding to `simctl`, so the native rerun could not yet be
  completed from a clean simulator state.
- A later unsandboxed rerun recovered `simctl`, booted the same simulator
  cleanly, relaunched `com.anonymous.fresh-greens`, and again landed on the
  authenticated private home surface rather than a public welcome flow.
- The same rerun deep-linked to `freshgreens:///menu` and again rendered the
  authenticated Settings screen with `Hey there, Dev User`.
- Container inspection after that clean rerun still showed
  `fresh-greens.user.v1` in
  `Library/Application Support/com.anonymous.fresh-greens/RCTAsyncLocalStorage_V1/manifest.json`
  with the `dev-simulator-user` payload and no pending-purge marker.
- Simulator swipe gestures were reproducible during this rerun, but synthetic
  tap delivery to the close and sign-out controls was not. That blocked
  automated completion of the final destructive confirmation step inside this
  session.
- A dev-only `/dev-sign-out` route was added to trigger the same
  `beginSignOut()` provider action without depending on unreliable synthetic
  taps. It is only registered in the private stack while `__DEV__` is true and
  does not create a second cleanup path.
- Opening `freshgreens:///dev-sign-out` from authenticated state reached the
  signed-out confirmation surface with `You've been logged out.` and
  `Log back in`.
- Immediate container inspection after the dev-triggered sign-out found no
  matches for `fresh-greens.user.v1`, `dev-simulator-user`,
  `fresh-greens.pending-account-purge.v1`, or
  `fresh-greens.supabase-session` under the app data container.
- A signed-out private deep link to `freshgreens:///menu` stayed on the
  signed-out confirmation surface instead of reopening Settings.
- After force-closing and relaunching `com.anonymous.fresh-greens`, the app
  opened to the public Fresh Greens welcome screen with `Get started` and
  `Have an account? Log in`.

Current interpretation:

- Source-level route and purge logic align with the intended design.
- The iOS simulator account boundary passes for the verified path:
  authenticated state -> provider sign-out -> no persisted local identity ->
  private deep link remains blocked -> cold relaunch starts public.
- The earlier private resurrection was not reproduced after completing the
  provider cleanup path. The most likely explanation is that the earlier manual
  attempt never actually completed sign-out because synthetic tap delivery was
  unreliable.

### Remaining source findings

- **P2 Accessibility:** source supplies labels, live-region state, and reading
  order, but does not programmatically move VoiceOver focus to the new heading.
  Verify first on device because navigation may already focus the first header.
  Recommended next command: `/impeccable harden app/sign-out.tsx`.
- **P2 Android conformance:** the shared Button is 44 points high, matching the
  iOS floor but below Material's 48 dp target. Decide whether Android is a real
  thesis deliverable before introducing a platform-specific minimum.
  Recommended next command: `/impeccable adapt components/Button.tsx`.
- **P2 Theming:** the account surfaces are intentionally light and token-driven,
  but Dark Mode and increased-contrast variants are not first-class.
  Recommended next command: `/impeccable colorize account surfaces`.

### Native verification still pending

The following native checks remain pending or only partially covered:

- iOS edge-swipe Back and modal dismissal during sign-out.
- Android system and predictive Back.
- Force-close during quarantine, drain, purge, and finalization. Only the
  post-sign-out relaunch path was observed.
- Offline Retry and Finish on this device.
- Account switch from account A to account B with proof that no A-owned route,
  fuel, report, recording, notification, or credential state survives.
- VoiceOver and TalkBack focus/announcements.
- Reduce Motion / Remove animations. `simctl ui` exposes content size and
  contrast, but not motion preference.
- Landscape, tablet, split view, and foldables.
- Actual file, notification, and credential deletion on device.

Run those checks before changing the provisional platform verdict to Pass or
awarding any 4/4 dimension.
