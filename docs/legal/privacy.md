# Privacy Policy

**Effective date:** 2026-05-31

Fresh Greens is a graduate thesis project — a navigation and safety app exploring how to make solo travel feel less alone. This policy is the honest description of what the app does with your data. We wrote it specifically to match what Fresh Greens actually does, not as a generic template.

## TL;DR

- Fresh Greens runs locally on your device. There is no Fresh Greens server.
- The only data that leaves your device is the route-search query sent to Mapbox (the map provider) so the map can show you places and routes.
- We do not track you across other apps or websites.
- We do not show ads.
- We do not sell or share your data with any third party for advertising, analytics, or any other purpose.

## What we collect, and what we do with it

### Your location (foreground only)

Fresh Greens uses your device's location to draw routes, show nearby places, and let you share with a trusted contact during a safety event.

- We request location *only while the app is in use*. We do not request background location.
- Your location stays on your device. We do not store it on any server.
- When you search for a place, the search query (e.g. "gas station") and a *coarse* nearby anchor point are sent to Mapbox to get back results. Mapbox's privacy policy governs that request — see [mapbox.com/legal/privacy](https://www.mapbox.com/legal/privacy).
- When you start a Roadside, Unfamiliar Area, or Share Location session, the app shows a "{name} is being notified" indicator. In this version, this is a visual representation of your *intent* to share — the app does not yet transmit your live location to your contact. A future version may add real transmission with your explicit opt-in.

### Your trusted contact

You can pick one contact from your phone's address book to be designated as your trusted contact for safety flows.

- We request Contacts permission only when you tap "Pick a contact."
- We read only the contact you select. We do not scan your address book.
- The contact's name, phone number, and (if available) home address are stored locally on your device only.
- We do not send any messages or notifications from Fresh Greens to your trusted contact. Any calls or texts are placed by *you* through your device's normal dialer / messaging app.

### Audio recordings (Pulled-over mode)

During a Pulled-over event, Fresh Greens can record audio for your personal record.

- We request Microphone permission only when you tap to record.
- Recordings are stored locally on your device. They are not uploaded anywhere.
- Recordings are visible only inside Fresh Greens (in `/recordings`). They are not added to your phone's Photos library or shared automatically.
- You can delete a recording from `/recordings` at any time. Deletion removes it from your device.

### Your preferences and route history

Things like which factors you want considered in routing (lighting, police, community reports), your saved places, your trusted contact, your roadside service info, and your share-session state are all stored in your device's local storage (AsyncStorage).

- Nothing is uploaded.
- Sign out (when implemented) will clear this local state from the device.

### What we do *not* collect

- Advertising identifiers
- Browser/web tracking data
- Cross-app tracking
- Analytics events
- Crash reports beyond Expo's default opt-in framework (see "Third parties" below)

## Third parties

Fresh Greens talks to a small number of services to function:

- **Apple** — Apple Sign In, if you sign in that way. Governed by [Apple's privacy policy](https://www.apple.com/legal/privacy/).
- **Mapbox** — map tiles, geocoding, place search. Governed by [Mapbox's privacy policy](https://www.mapbox.com/legal/privacy).
- **Expo / EAS** — the framework Fresh Greens is built on. Expo may collect anonymous crash data if you have opted into that via your device settings. See [Expo's privacy policy](https://expo.dev/privacy).
- **OpenStreetMap** — when Mapbox cannot reach a routing answer, Fresh Greens falls back to OSRM, an open-source routing engine. Same data shape as the Mapbox request (start, end, query).

We do not use Google Analytics, Firebase Analytics, Crashlytics, Mixpanel, Segment, or any other analytics SDK.

## Your rights

You have the right to:

- **Delete your data** — Most data is on your device. Uninstalling Fresh Greens removes everything. You can also use the in-app sign-out (when implemented) to clear stored preferences and recordings.
- **See what's stored** — All persisted data is visible inside the app: trusted contact in `/safety-settings`, recordings in `/recordings`, places in `/search`, etc.
- **Withdraw a permission** — You can revoke Location, Contacts, or Microphone permission at any time in iOS Settings. Fresh Greens will degrade gracefully (some flows will require the permission to function).

## Children

Fresh Greens is not directed at children under 13. We do not knowingly collect data from children under 13.

## Changes

If we change this policy, we will update the "Effective date" at the top and surface a notice in the app on next launch.

## Contact

This is a graduate-thesis project. Questions about this policy can be sent to the author at the email address listed in the App Store listing.
