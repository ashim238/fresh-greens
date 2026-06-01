# Limitations of use

Fresh Greens is a thesis project — a working prototype designed to explore what a safety-aware navigation app could feel like. Some parts of the app are not yet what they appear to be. We want to be honest about that.

## Sharing your location is simulated in this version

When you start a Roadside Assistance, Unfamiliar Area, or Share Location session, the app shows a "{name} is being notified" indicator and a "Sharing location" widget at the bottom of the screen.

In this version, **the indicator reflects your intent to share — not active transmission.** Your trusted contact does not receive an SMS, push notification, or live-location feed from Fresh Greens.

A future version will add real transmission, with your explicit opt-in. Until then, treat the affordance as a commitment to share — the next thing you should do is text or call your contact yourself, using the Lifeline button in Unfamiliar mode or just opening your normal messaging app.

## Roadside Assistance dials *your* service — we do not provide one

Fresh Greens does not have a relationship with AAA, Geico, USAA, or any other roadside service. When you tap "Call your roadside service," the app dials the number you saved in `/roadside-setup` using your phone's normal dialer.

- We do not verify that the number you saved is correct.
- We do not negotiate price, response time, or coverage on your behalf.
- We do not know whether the service is open, busy, or available at your location.

The Roadside flow is a convenient way to call a number you've already pre-saved, plus a place for "I'm not alone" reassurance copy. Anything beyond that is between you and your service provider.

## Pulled-over recordings are for your personal record

When you record audio during a Pulled-over event, the recording is saved to local storage on your device, visible only in `/recordings`. It does not automatically:

- Notify the police, your attorney, or anyone else
- Upload to a cloud backup
- Stream live to a witness or recipient
- Get reviewed by Fresh Greens (we don't have a server)

If you want anyone else to have a copy, you need to share it yourself.

**Recording-consent laws vary by jurisdiction.** In most U.S. states recording your own interaction with police is legal, but the specifics differ. You are responsible for understanding the law in your state or country.

## We are not an emergency service

If you are in immediate physical danger, **call 911** (or your local emergency number) on your phone, not Fresh Greens.

Fresh Greens is designed to:
- Help you feel less alone when you're stressed or in an unfamiliar place
- Make it easy to reach the people who already care about you
- Document your own movements

It is not designed to:
- Summon police, fire, or medical responders
- Replace a personal-safety alarm or panic button
- Function as a 24/7 monitored security service

## We are not a routing certifier

Fresh Greens shows routes based on Mapbox data, with optional overlays for lighting, police presence, parks, etc. We do our best to make those overlays helpful, but:

- Map data has errors
- Lighting data is sparse and inferred
- "Safety scores" are heuristics, not guarantees
- A route that looks safe on the map can change in real conditions

Trust your own judgment over the app's recommendation. If a route looks wrong, take a different one.

## We are not selling your data

We say this elsewhere too, but it bears repeating: Fresh Greens has no analytics, no ads, no third-party trackers, and no server. The only data that leaves your device is the route-search query sent to Mapbox so the app can render your map.

## In summary

Fresh Greens is a prototype. Use it like a prototype — as a thoughtful companion, not a guarantee. In any situation where your safety actually depends on a working tool, use a real one.
