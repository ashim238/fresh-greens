# Privacy and Community Data Design

**Date:** 2026-07-15

**Status:** Ready for implementation planning

## Goal

Make the product's privacy promises match its real data flow, and make community reports reliable under weak networks, retries, abuse, and moderation.

In plain language, this work closes two trust gaps. The app must tell people where their information actually goes, and it must never lose or resurrect a report because a network request failed at the wrong moment.

## Scope

- Correct the privacy policy, Terms, Limitations, and matching in-app copy.
- Treat Supabase as a real Fresh Greens backend and Vercel as a real proxy.
- Bind the Apple-backed app account to the cloud identity used by community commands.
- Replace direct client writes with server-owned report commands.
- Repair grants, row-level security, moderator authorization, views, triggers, and retention jobs.
- Validate report shape, category, location, timestamps, identity, and moderation fields on the server.
- Store reported horizontal location accuracy and manual pin confirmation so route scoring can apply the versioned influence policy.
- Add a durable outbox and deletion tombstones.
- Harden the Google Places proxy against location leakage, unbounded use, invalid input, and hanging upstream requests.
- Define visible pending, uploaded, rejected, offline, deleting, and failed states.

## Non-goals

- Building a live-location sharing service.
- Promising that community reports are true or independently verified.
- Building phone verification in this phase.
- Replacing Supabase, Vercel, Google Places, Mapbox, or OSRM.
- Migrating unrelated historical anonymous reports without evidence that the current Apple account created them.

## Verified root causes

### Legal copy describes a local-only product that no longer exists

`docs/legal/privacy.md` and `app/legal.tsx` say there is no Fresh Greens server, nothing is uploaded, location stays on device, and Mapbox is the only destination for route-search data. Current code sends exact report coordinates and report fields to Supabase, sends exact coordinates through the Vercel proxy to Google Places, and sends routing endpoints to Mapbox or OSRM.

The policy also says sign-out will clear local state and recordings. That claim must not ship until the account-isolation acceptance criteria pass.

### The Apple user and cloud author are unrelated

The app creates a Supabase anonymous session independently of local Sign in with Apple. `auth_user_id` therefore identifies the anonymous cloud session, not the Apple-backed app account. Any trust tier based on an Apple identity in `auth.identities` cannot be earned by the current client path.

### The migration defines policy without a usable, safe command boundary

The migration revokes all table privileges from `anon` and `authenticated`, then creates an insert policy without restoring a narrowly scoped insert grant. Even if a grant were added, direct inserts let the client provide IDs, timestamps, device identifiers, attribution fields, and verification flags.

Default-owner views and `SECURITY DEFINER` functions need explicit `security_invoker`, `search_path`, grants, and role checks. The moderator view selects every base-table column, including IP and device identifiers. Recursive `user_roles` policies can evaluate the protected table while deciding access to itself.

The general update trigger allows only attribution changes, then separately blocks moderation state changes. It also runs for `SECURITY DEFINER` moderation and deletion functions, so approved server transitions can be rejected by the same client-facing rule.

### Abuse controls trust client data

`lib/api/sources/community-cloud.ts` sends a client-created report ID, timestamp, device UUID, `auth_user_id`, and `is_verified_phone`. Rate limits query the client timestamp. An attacker can change those fields or call PostgREST outside the app.

The device UUID is useful as one abuse signal, but it is neither a person nor a secure identity. The server must stamp time, derive `auth.uid()`, ignore verification claims, validate coordinates and categories, and enforce idempotency.

### Retention cannot complete as written

`purge_old_ips()` sets `report_flags.flagger_ip` to null, while the column is declared `NOT NULL`. The cron path therefore fails when a qualifying flag exists. Retention needs nullable IP fields or a separate short-lived network-signals table.

### Sync is not transactional

The client saves locally, attempts an upload, and queues on a thrown network error. A typed server rejection removes the local record immediately. Delete removes the local record first, filters the upload queue, and ignores any cloud-delete failure.

Because merged reads fetch remote rows again, a failed deletion can resurrect a report the user just removed. Fire-and-forget calls also leave no visible state or durable retry contract.

### Invalid remote rows can poison the feed

Cloud rows are cast into client types without runtime validation. Invalid category IDs, coordinates, timestamps, or trust tiers can reach scoring and map rendering. One corrupt row should be quarantined, not break the full feed.

### The nearby-business proxy exposes exact coordinates too freely

`proxy/api/nearby.ts` accepts public GET requests with latitude and longitude in the URL, uses open CORS, and sends cacheable responses. URLs can appear in browser, CDN, and platform logs. It validates that values are numbers but not that they fall within geographic bounds. It has no client authorization, rate limit, quota, or upstream timeout, so it can become an unrestricted billing relay.

## Chosen architecture

### Server-owned report commands

Clients receive read access only to a deliberately limited public view. Report mutations go through narrowly granted RPCs or an Edge Function:

```ts
type SubmitReportCommand = {
  idempotencyKey: string;
  categoryId: ReportCategoryId;
  latitude: number;
  longitude: number;
  horizontalAccuracyMeters?: number;
  locationConfirmed: boolean;
  detail?: string;
  subTag?: string;
  placeName?: string;
  placeType?: string;
  googlePlaceId?: string;
};
```

The server generates the row ID and timestamp, derives `auth.uid()`, captures network signals, validates category-specific fields, strips unexpected properties, and derives trust and verification fields. It accepts a bounded idempotency key so retries return the same logical result.

Coordinates must be finite and within latitude and longitude bounds. `horizontalAccuracyMeters` must be finite and non-negative when present. The server stores the submitted measurement without improving its accuracy tier. `locationConfirmed` records that the person reviewed or moved the pin. Neither field proves that an untrusted client is honest, so abuse controls never rely on them. Text fields receive length, character, and nullability limits. Category and sub-tag combinations come from a server allow-list. The server never accepts moderation state or verification status from the client.

Public coordinates are rounded to four decimal places before they enter the public read model. The public DTO exposes only the server-derived accuracy band required by `adaptive-corridor-v1`, not the raw device measurement. If exact coordinates or raw accuracy are retained for a documented moderation need, they stay in the protected base table and follow the published retention policy.

### One cloud identity boundary

Use one supported Supabase authentication client as the cloud-session owner. Native Apple sign-in generates and verifies a nonce, then exchanges the Apple ID token through Supabase's supported ID-token flow. Community commands use the resulting `auth.uid()`.

If an anonymous Supabase session already owns draft or published rows, do not assume the local Apple ID proves ownership. Preserve that user ID only through a Supabase-supported identity conversion that is verified in staging. Otherwise use a server transaction that validates both sessions, transfers allowed ownership, and records the migration. A failed exchange leaves community contribution read-only and must not weaken authorization.

The account-isolation provider may expose the app user state, but it does not create a second cloud session. Cloud tokens move to platform-protected credential storage as part of this boundary.

### Authorization helpers without recursive RLS

Create a private `is_moderator()` helper with a fixed empty `search_path`, owned by a migration role, and revoke public execution unless explicitly required. Policies call this helper rather than recursively selecting `user_roles` under its own policy.

- Public report view exposes only fields required by the map and feed.
- Moderator list RPC returns a reviewed DTO, not `SELECT *`.
- Raw IP, device UUID, auth IDs, and internal notes never enter client-readable views unless a documented moderation need requires a separately audited field.
- Views explicitly choose `security_invoker = true` when RLS should apply. Any intentionally owner-executed aggregate view contains only non-identifying aggregates and has a dedicated test.
- Every `SECURITY DEFINER` function sets `search_path`, schema-qualifies objects, checks authorization internally, and has `EXECUTE` revoked from `public` before narrow grants are added.

### Split user edits from moderation transitions

Remove broad direct update access. Use separate commands for submitter attribution changes, submitter deletion, moderator removal, restore, and ban. Each function owns the exact columns it may change and writes an immutable audit action in the same database transaction.

Server commands return typed outcomes such as `accepted`, `duplicate`, `rate-limited`, `banned`, `not-found`, and `not-authorized`. They do not leak database error bodies.

### Durable local outbox

Store reports, outbox operations, and deletion tombstones in one versioned local envelope so a crash cannot update one collection without the others. Each report has explicit sync state:

```ts
type LocalReportRecord = {
  localId: string;
  serverId?: string;
  payload: ReportDraft;
  syncState: 'pending' | 'uploading' | 'uploaded' | 'rejected' | 'delete-pending';
  attemptCount: number;
  nextAttemptAtMs?: number;
  lastError?: ReportSyncError;
};
```

Submission writes the local record and outbox entry atomically before network work. Network failure keeps it pending with bounded exponential backoff and jitter. A permanent rejection stays visible to its author with a reason and actions to edit or remove. It is excluded from public scoring.

Delete first writes a tombstone or changes the record to `delete-pending`. The item disappears from the public map immediately but remains in the durable outbox until the server confirms deletion. Remote merge must consult tombstones so an undeleted remote row cannot reappear. Tombstones are removed only after confirmation or an explicit conflict resolution.

Outbox processing is single-owner, idempotent, session-aware, and safe after restart. Sign-out purges pending work according to the account-isolation manifest instead of uploading it under another user.

### Defensive read boundary

Parse every remote row with a runtime schema. Invalid rows are dropped individually and counted in privacy-safe diagnostics. Reads have a deadline and return a typed freshness result. The UI distinguishes fresh cloud data, local-only fallback, and unavailable community data. Scoring consumes only validated, visible reports.

### Honest privacy disclosure

The Markdown legal documents remain canonical. Generate or test the in-app legal content from the same source so it cannot drift.

The revised disclosure must name:

- Supabase as the Fresh Greens community-report and moderation backend.
- Vercel as the proxy host and Google Places as the nearby-business provider.
- Mapbox and OSRM as routing and search providers.
- The exact categories sent to each service, including precise coordinates where required.
- That report submission may store the location accuracy reported by the device and whether the person confirmed the pin.
- Stored report content, approximate retention, device and network abuse signals, and public visibility.
- What stays local, including recordings and trusted-contact data in the current version.
- How deletion, sign-out, permission withdrawal, and public-report removal differ.
- That a message draft is not confirmed delivery and community data is not verified safety advice.

Material policy changes need a version and effective date. On the next launch, users see a short summary and can open the full policy before continuing to contribution features. Browsing routes does not require forced acceptance unless counsel determines otherwise.

### Hardened nearby proxy

- Change exact-coordinate lookup to `POST` with coordinates in the body.
- Set `Cache-Control: private, no-store` and remove coordinate-bearing cache keys.
- Restrict CORS to approved app and development origins where browser access is needed.
- Validate method, content type, body size, latitude, longitude, and optional fields.
- Require an app-scoped signed token or attestation when available. Add per-IP and per-device quotas plus a project-wide budget ceiling.
- Add a short upstream timeout, abort cleanup, structured errors, and redacted logs.
- Never log request bodies, exact coordinates, Google keys, Supabase tokens, or report details.

The same authentication, quota, timeout, size, kill-switch, and logging baseline applies to the billable `recs`, `place`, and `photo` endpoints. Endpoint-specific caching may remain only for keys that contain no precise user location or secret.

### Operational safety gates

Use three independent controls: a database `community_writes_enabled` check inside mutation commands, proxy environment switches for billable endpoints, and a client mode of `off`, `read-only`, or `read-write`. New builds default to `off` until their server contract is deployed and verified.

## User-state maps

### Report submission

| State | What the user sees | Actions | VoiceOver behavior |
|---|---|---|---|
| Draft | Report form and a concise public-data disclosure | Submit, Cancel | Reads what will be public before Submit |
| Saving locally | `Saving your report…` | Controls disabled briefly | Announces progress once |
| Pending upload | `Saved on this device. We'll send it when you're online.` | View, Remove | Announces that it is not public yet |
| Uploaded | `Report shared with the community.` | Done, Undo | Announces success only after server acceptance |
| Rejected | Plain reason such as rate limit or invalid field | Edit, Remove | Focuses the reason, then recovery actions |
| Unknown failure | `We couldn't share this report yet.` | Try again, Keep on device, Remove | Does not imply data was lost |

### Report removal

| State | What the user sees | Actions | VoiceOver behavior |
|---|---|---|---|
| Removing | Report disappears from the public map and shows local progress | Undo when safe | Announces removal in progress |
| Pending offline | `Removed here. We'll finish when you're online.` | Retry now | Says the remote copy may remain temporarily |
| Confirmed | No report or tombstone remains | None | Announces completion once |
| Conflict | `We couldn't remove the community copy.` | Try again, Contact support | Focuses the recovery heading |

### Community feed

| State | What the user sees | Actions | VoiceOver behavior |
|---|---|---|---|
| Fresh | Validated community reports with age and source | Inspect | Reads report age and community source |
| Local fallback | `Community updates may be out of date.` | Retry | Announces limitation before report list |
| Unavailable | `Community updates are unavailable.` | Retry | Does not translate absence into `All clear` |
| Invalid rows skipped | Feed continues without a user-facing error | None | No repeated announcement |

### Policy update

| State | What the user sees | Actions | VoiceOver behavior |
|---|---|---|---|
| Current | Existing settings link and effective date | Read policy | Standard navigation |
| Material update | Short change summary and effective date | Review, Continue | Focuses the change heading and reads actions in order |
| Contribution blocked | Explanation that report sharing needs review | Review policy, Not now | No route or safety feature is falsely shown as unavailable |

### Moderation

| State | What the moderator sees | Actions | VoiceOver behavior |
|---|---|---|---|
| Published | `Published` with report age and reviewed public fields | Remove with confirmation | Reads status in text, not color alone |
| Hidden | `Hidden while under review` | Restore or Remove | Announces the status before actions |
| Removed | `Removed from the community map` with reason | Restore with confirmation | Announces the reason and consequences |
| Unauthorized | No moderation data | Return to Home | Never mounts sensitive rows in the accessibility tree |

## Design audit requirements

- Put the public-data disclosure next to Submit, not only in Settings.
- Use literal sync language. `Saved`, `sent`, `public`, and `deleted` describe different states.
- Do not use safety red for ordinary network failure.
- Pending and rejected personal reports must be distinguishable from public reports.
- Dynamic Type must keep disclosure and recovery actions visible.
- VoiceOver announcements occur once per real transition, never per retry tick.
- Offline use remains possible. The interface discloses stale community evidence before any safety claim.

## Migration and deployment order

1. Freeze production community writes or put them behind a remote flag.
2. Back up and inspect current schema, grants, policies, functions, views, and scheduled jobs.
3. Add server validation helpers, moderator authorization helper, idempotency storage, command functions, and typed responses.
4. Repair nullability and retention. Move short-lived IP data to a dedicated table if that produces a cleaner retention boundary.
5. Add safe public and moderator DTO views, explicit grants, and database tests. Keep old read compatibility temporarily.
6. Ship and verify the Apple-to-Supabase identity boundary with community contribution still read-only.
7. Ship the client outbox, tombstones, runtime row validation, and new sync UI while writes remain gated.
8. Enable new commands for an internal cohort, then all clients. Monitor accepted, duplicate, rejected, and retry outcomes without sensitive payloads.
9. Disable legacy direct writes and remove their grants and policies.
10. Harden and deploy the proxy before updating the app to use POST.
11. Publish synchronized legal documents and in-app policy content with a new effective date before general write enablement.

Rollback may disable new writes and keep validated reads. It must not restore unsafe direct table mutations or erase outbox records.

## Test strategy

### Database tests

- Anonymous and authenticated roles can perform only documented reads and commands.
- Non-moderators cannot read moderator DTOs or execute moderation commands.
- Role checks do not recurse.
- Client IDs, timestamps, auth IDs, verification flags, moderation fields, and unexpected properties are ignored or rejected.
- Invalid coordinates, categories, sub-tags, lengths, and timestamps fail with typed outcomes.
- Negative, non-finite, and malformed accuracy values fail. The server never promotes a submitted measurement into a better public accuracy band.
- Duplicate idempotency keys return one logical report.
- Submitter delete and moderator remove or restore succeed without a conflicting generic trigger.
- Audit action and state transition commit or roll back together.
- Retention removes eligible IP data despite nullability rules.
- Views expose no raw IP, device UUID, token, or unnecessary auth identifier.

### Client tests

- Network failure preserves a pending report through restart.
- Permanent rejection does not enter public scoring and remains recoverable.
- Delete failure cannot resurrect a tombstoned report during merge.
- Sign-out cannot upload another account's pending work.
- Corrupt remote rows are skipped individually.
- All visible states match copy, actions, focus, labels, and announcements.

### Proxy tests

- Only POST with a valid, bounded body is accepted.
- Geographic bounds, body-size limits, quotas, origin checks, and credentials are enforced.
- Upstream timeout aborts and settles.
- Responses are `private, no-store` and logs contain no exact coordinates or secrets.

### Manual checks

- Offline submit, relaunch, retry, upload, undo, delete, and account switch.
- VoiceOver and AX5 Dynamic Type across submission, removal, feed, moderation, and policy update states.
- Compare every legal claim against observed network traffic, stored database fields, local storage, and app behavior before release.

## Acceptance criteria

- Legal Markdown and in-app content accurately name services, data categories, purposes, retention, public visibility, and deletion limits.
- Community commands use the Supabase identity established from the verified Apple sign-in, not an unrelated anonymous session.
- Exact coordinates are never placed in proxy URLs or cacheable responses.
- Direct clients cannot set server identity, time, trust, verification, IP, or moderation fields.
- Route consumers receive only the server-derived report accuracy band and confirmation state required by the versioned scoring policy.
- Table and function grants match the documented role matrix.
- Moderator access cannot leak sensitive base-table columns.
- Every privileged function has a fixed search path, internal authorization, and narrow execution grants.
- Retention jobs succeed against production constraints.
- Upload retries are idempotent and durable across restart.
- A network failure never deletes the only local copy.
- A delete failure never silently resurrects a report.
- Invalid remote rows cannot poison the feed or scoring.
- Community-data absence never becomes an `All clear` claim.
- Proxy validation, authorization, quotas, timeouts, no-store behavior, and redacted logging pass.
- All documented user states have matching visual, action, and VoiceOver behavior.

## Deferred work

- Phone verification and its consent and retention contract.
- Public user profiles or reputation.
- Photo upload, moderation, and retention.
- Cross-device report-management history.
- Formal legal review before commercial release.
