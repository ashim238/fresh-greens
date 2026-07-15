# Native Hardening Design

**Status:** Proposed for implementation sequencing

## Goal

Make the native app recover cleanly from stale requests, navigation changes, permission failures, and unavailable platform services. Every visible status must match what the device actually completed.

## Why this is a program specification

The remaining native findings span three independent areas. They should share one audit standard while shipping through separate implementation plans:

1. Async freshness and resource ownership.
2. Charged-flow navigation and sharing truth.
3. Startup, accessibility, permissions, and device support.

Each area can be tested and reviewed without waiting for the others. None should be bundled into one large production change.

## Scope

### Async freshness and resource ownership

- Prevent stale search enrichment from replacing results for a newer or cleared query.
- Key route fuel-stop results by route identity or geometry instead of coordinate count.
- Fetch fuel stops only when their sheet or visible pins need them.
- Replace duplicate screen-owned high-accuracy GPS watchers with one focused or shared owner.
- Close the async watcher-creation cleanup race.
- Share one live-safety session state between parent layout and sheet consumers.

### Charged-flow navigation and sharing truth

- Let approved Roadside exits pass through the status-step navigation guard.
- Await the Messages-open result before showing contact-sharing success.
- Distinguish “draft opened” from “contact notified” and “sharing active.”
- Remove ghost share sessions after notification failure.

### Platform and accessibility hardening

- Recover from font-loading failure instead of holding the splash screen forever.
- Make the Roadside sharing switch operable as one VoiceOver control.
- Remove the unnecessary Android write-contacts permission.
- Either disable advertised tablet support or add an iPad validation strategy.

## Non-goals

- Recording lifecycle work belongs to the recording-reliability specification.
- Authentication and sign-out belong to the account-isolation specification.
- Route safety coverage, tile completeness, and provider timeouts belong to the route-trust specification.
- Community report synchronization belongs to the privacy and community-data specification.
- This program does not introduce background location.

## Verified root causes

### Search requests have an incomplete freshness check

`app/search.tsx` compares the query after `searchPlaces`, then performs a second await for fuel-price enrichment without checking again. Clear actions do not invalidate the in-flight generation. An older request can therefore repopulate cleared results or replace a newer query.

### Fuel stops are keyed by geometry length

`hooks/useRouteFuelStops.ts` depends on `routeCoords.length`. Two routes with the same point count are treated as the same route. The en-route screen also activates the hook before the user opens the fuel-stop surface.

### Location ownership is duplicated

Home keeps a mount-lifetime high-accuracy watcher while En Route creates another after navigation. Because navigation pushes the next screen, Home can remain mounted. Both effects assign their subscription after async permission and watcher setup, so cleanup can run before a subscription exists and fail to remove the later result.

### Live-safety state has multiple owners

`app/en-route.tsx` and `components/LiveSafetySheet.tsx` create separate `useShareSession` instances. Ending a session updates the sheet while the parent can keep stale reserved layout space.

### The Roadside guard blocks approved exits

`app/roadside.tsx` prevents every removal action during the status step and supplies an empty callback. “Back on the road” and “Switch to pulled-over mode” call navigation methods that the same guard blocks.

### Sharing is reported before Messages confirms anything

Roadside turns on its sharing state and timestamp before awaiting `notifyTrustedContact`. The notifier can return without opening Messages. The global share-session hook persists an active session before the same notification step and does not compensate storage after failure.

### The screen-reader switch groups away its action

The Roadside row is exposed as a switch while the actual native `Switch` is nested inside it. The wrapper has no press handler, so VoiceOver can focus a switch it cannot operate.

### Startup has no font-error state

`hooks/useAppFonts.ts` discards the error returned by `useFonts`. `app/_layout.tsx` returns `null` and hides the splash only after `loaded` becomes true. A load failure leaves the app visually frozen.

### Platform declarations exceed shipped behavior

`app.json` requests `WRITE_CONTACTS` even though the app only reads the contact selected by the user. The same file advertises tablet support while project documentation excludes tablet layouts and validation.

## Architecture

### Request generations

Every user-controlled async query receives a monotonically increasing generation number. Starting, clearing, changing tools, changing routes, and unmounting all invalidate the prior generation.

```ts
type RequestGeneration = {
  current: number;
  begin: () => number;
  invalidate: () => void;
  isCurrent: (generation: number) => boolean;
};
```

Every await boundary checks `isCurrent`. Abortable network calls also receive an `AbortSignal`. Generation checks remain necessary because enrichment and native calls may not support aborting.

### Stable route identity

Fuel-stop state receives a route key derived from the route ID when available. A deterministic geometry signature is the fallback. The hook depends on the key, `active`, fuel type, and the captured open-time location.

### One foreground location owner

Introduce one foreground location service or provider used by Home and En Route. Consumers subscribe to shared state. The provider raises accuracy while navigation is active and lowers or stops it when no focused consumer needs updates.

Watcher creation uses a cancellation guard:

```ts
const subscription = await Location.watchPositionAsync(options, onPosition);
if (cancelled) {
  subscription.remove();
  return;
}
activeSubscription = subscription;
```

### One share-session owner

Lift share-session state into the nearest common route layout or a focused provider. The parent passes the state and mutations to `LiveSafetySheet`. The sheet no longer hydrates a second instance.

### Approved navigation actions

The Roadside screen records an approved exit intent before navigating. The guard dispatches that approved action and blocks only unapproved gestures.

### Sharing stages

Use separate states:

```ts
type ShareDeliveryState =
  | 'idle'
  | 'opening-draft'
  | 'draft-opened'
  | 'active'
  | 'failed'
  | 'ending';
```

Opening a draft does not prove the user sent it. Copy must say “Message draft opened” until the product has a verifiable delivery channel. A session becomes active only after its required setup succeeds. Notification failure clears optimistic and persisted session state.

### Startup settlement

`useAppFonts` returns `{ loaded, error }`. Root startup hides the splash after loading settles. On error, the app renders with a system-font fallback and records the failure for diagnosis. The first iteration will not retry font loading. It will let the user continue immediately with the system fallback.

## User-state maps

### Search

| State | What the user sees | Actions | VoiceOver |
|---|---|---|---|
| Typing | Current query and recent items | Continue typing or submit | Reads the current query |
| Loading | Results loading for the submitted query | Clear or change query | Announces loading once for explicit searches |
| Current results | Results matching the visible query | Choose a result | Announces result count |
| Cleared | Empty query with recent items | Start another search | Does not announce stale results |
| Superseded | No visible change from the older request | None | No announcement |
| Error | Plain recovery message for the current query | Retry or edit | Announces the current error once |

### Fuel stops

| State | What the user sees | Actions | VoiceOver |
|---|---|---|---|
| Closed | No fuel request or loading indicator | Open Fuel Stops | No background announcement |
| Loading for route | Loading inside the sheet | Close or wait | Names the current route context |
| Ready | Stops for the current route | Select a stop | Announces count and route relevance |
| Route changed | Prior stops disappear before the new request | Wait or close | Announces that results are updating |
| Error | Current-route failure copy | Retry | Announces failure once |

### Roadside exit

| State | What the user sees | Actions | VoiceOver |
|---|---|---|---|
| Assistance active | Status and approved exit controls | Back on the road or switch mode | Reads both controls as buttons |
| Exiting | Brief disabled state while navigation commits | Wait | Announces the selected exit |
| Gesture attempt | Existing assistance status remains | Use an explicit exit | Explains why dismissal was blocked |

### Trusted-contact sharing

| State | What the user sees | Actions | VoiceOver |
|---|---|---|---|
| Idle | Sharing is off | Turn on | Reads one operable switch |
| Opening draft | Opening Messages | Cancel if possible | Announces progress |
| Draft opened | Message draft opened | Send in Messages or return | Says that sending still requires the user |
| Active | Safety session active after required setup | Resend or end | Reads active status and elapsed context |
| Failed | Could not open the message draft | Retry | Announces failure and Retry |
| Ending | Ending the session | Wait | Announces completion after storage clears |

### App startup

| State | What the user sees | Actions | VoiceOver |
|---|---|---|---|
| Loading | Native splash | Wait | Native startup behavior |
| Ready | App with brand fonts | Continue | Normal screen announcement |
| Font fallback | App with system fonts and no blocked navigation | Continue | Announces the current screen normally |
| Fatal startup error | Recovery screen for a non-font failure | Retry | Focus moves to the recovery heading |

## Design audit requirements

- Keep charged-flow copy calm and literal. Do not say a contact was notified when the app only opened a draft.
- Keep standard iOS controls and gestures. A native `Switch` should remain the operable element.
- Pending states must prevent duplicate actions without trapping the user.
- Error states need a visible recovery action where retry can help.
- Large Dynamic Type must not hide exit, retry, or session-ending controls.
- Reduce Motion may remove pulses and transitions without removing status information.
- Location accuracy and battery use are product behavior. Invisible duplicate watchers fail the performance audit.
- Tablet support must be an explicit product decision reflected in `app.json`, documentation, and validation evidence.

## Test strategy

### Unit and hook tests

- Generation invalidation after every await and clear action.
- Geometry-key changes when route coordinates change with the same length.
- Fuel fetch starts only when `active` becomes true.
- A watcher that resolves after cancellation removes itself immediately.
- Provider reference counting starts and stops the native watcher once.
- Share-session failure clears persisted and optimistic state.
- Draft-opened and active states remain distinct.
- Font error returns a settled fallback state.

### Screen tests

- Roadside approved exits dispatch once through the guard.
- Unapproved dismissal remains blocked with explanatory copy.
- The sharing switch is one operable accessibility element.
- Roadside shows success only after the notifier result permits it.
- Ending Live Safety updates both the sheet and parent layout in the same render cycle.

### Native checks

- Back gestures and modal dismissal on a physical iPhone.
- VoiceOver operation of the sharing switch and approved exits.
- Dynamic Type at AX5.
- Reduce Motion on the recording and live-safety indicators.
- Location watcher count and battery behavior while moving Home to En Route and back.
- Split View and rotation if tablet support remains enabled.

## Implementation order

1. Add request-generation utilities and repair Search.
2. Add stable route keys and lazy fuel fetching.
3. Centralize foreground location ownership.
4. Lift share-session state and make notification outcomes transactional.
5. Repair Roadside navigation and the VoiceOver switch.
6. Add font fallback behavior.
7. Remove unnecessary permissions and decide tablet support.
8. Run the complete native audit across the affected flows.

The first two changes are independent of sharing and startup. The location and share-session providers should each receive separate plans because they alter ownership boundaries.

## Acceptance criteria

- Cleared or superseded searches never repopulate visible results.
- Fuel stops always correspond to the selected route and are fetched only when needed.
- Home and En Route share one high-accuracy foreground watcher.
- Async watcher creation cannot leak after unmount.
- Parent and sheet render the same live-safety session state.
- Roadside approved exits work while gesture dismissal remains intentionally guarded.
- The app never claims a contact was notified from an unconfirmed draft-open result.
- Failed notification leaves no stored active session.
- VoiceOver can toggle the Roadside sharing switch.
- Font failure cannot hold the splash indefinitely.
- Android no longer requests write-contact permission.
- Tablet support is either disabled or backed by documented native validation.

## Rollout and rollback

- Ship each independent area behind its existing screen boundary.
- Preserve current storage formats where possible.
- Migrate share-session storage only when the new state model is ready to read both old and new values.
- Add diagnostic logging for stale-response drops, location watcher ownership, and notification outcomes without recording message contents or exact coordinates.
- If a provider migration fails, restore the prior consumer interface while keeping the new tests and state contracts.

## Deferred work

- Background location requires a separate consent, privacy, battery, and platform review.
- Verifiable message delivery requires a delivery service and a new privacy contract.
- Full iPad layouts require a dedicated adaptive-layout specification if tablet support remains enabled.
