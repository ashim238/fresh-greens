# Roadmap — milestones toward pilot + funding

The strategic layer **above** the per-PR rhythm. `docs/workflow.md` is how a single
PR gets built; this is *which* big chunks stand between now and the next real
goal, and in what order. A milestone here decomposes into specs
(`docs/superpowers/specs/`) → plans (`docs/superpowers/plans/`) → PRs, which in
turn spawn tactical items in `docs/next-session.md`. Don't put punch-list minutiae
here; don't put strategic milestones in next-session.md. (This is the one
"roadmap layer" piece worth adopting from GSD — see workflow.md §14.)

**Adopted 2026-06-17.** Revisit/re-order milestones whenever the goal shifts.

---

## Where we are now

A feature-complete **thesis demo**: routing with safety scoring, community
reporting, recommendations, en-route navigation, the safety/pulled-over suite,
fuel reminders (now distance-aware), calendar destinations, a polished design
system (Figma fidelity audited through #10), a live portfolio piece, the MFA
thesis, and real user-research interviews.

**What it is NOT yet:** multi-user, installable by strangers, or evidenced. Those
three gaps — not more features — are what stand between "impressive demo" and
"fundable, pilotable project." The surface is wide enough; the next work is
*depth on the thesis claim*.

The encouraging part, from a grounding pass on 2026-06-17: the biggest gap is
**closer than it looks** (see M1.1).

---

## Milestone 1 — Pilot-ready (test with actual folks)

The minimum for strangers to use it on their own phones and *generate real data*.

### M1.1 — Community cloud: stand up + harden  *(the thesis linchpin)*
The client is **already built** — `lib/api/sources/community-cloud.ts` is a
complete 181-line Supabase REST client (reads/inserts/deletes + a sync queue),
gated behind `isCommunityCloudConfigured()` (`EXPO_PUBLIC_SUPABASE_*`). What's
missing is the **server side**:
- Create the Supabase project + `community_reports` table (match the client's shape).
- Set `EXPO_PUBLIC_SUPABASE_*` in the build; verify two phones see each other's pins.
- **RLS + abuse — the real work, and thesis-integrity, not just security:** anon
  SELECT (read the map), gated INSERT (signed-in or rate-limited), no editing
  others' rows, and a **report-flagging / moderation path**. The weaponization
  risk surfaced in the Jacobs thread ("a biased cluster of reports redlines a
  neighborhood") goes live the instant two users share data — hardening before
  any real user submits is non-negotiable.

*Size: small-to-medium (client done; the RLS/abuse design is the thinking).
Start here.*

### M1.2 — Distribution: EAS → TestFlight
Real bundle id (currently the `com.anonymous.fresh-greens` placeholder), an
`eas.json`, Apple Developer Program ($99/yr), `eas build` + `eas submit`,
TestFlight internal/external testers. Lead time: Apple review for external
testing (~days). This is also your **grant-demo link**. *Runs in parallel with M1.1.*

### M1.3 — First-use quality
- **Seed a demo neighborhood** (Clinton Hill / Fort Greene) so first-open isn't
  an empty map; confirm OSM zones load there. Optional: make `landuse`/Jacobs a
  **live OSM** signal instead of the current mock so eyes-on-street actually fires.
- **Fix the weather card** (the Open-Meteo `—°` bug — a visibly-broken home tile
  during a pilot erodes trust). Likely the `visibility` `current` param or
  device-network; needs an on-device repro.
- **Light onboarding-to-value** — a stranger grasps "report places → safer
  routes" in ~30 seconds.

### M1.4 — Light instrumentation  *(net-new; the project has none)*
A minimal event log (even to a Supabase table): reports submitted, **routes
where community data changed the pick**, safe-chip shown. This is what turns a
pilot into *evidence* (and directly feeds M2).

### M1.5 — Stability pass
Crash-free across the real-device matrix; permission flows (location, notifications)
sane on first run.

---

## Milestone 2 — Funding-ready (apply for funding)

≈ **M1 + a few weeks of the pilot actually running.** Grants (research / civic-tech)
fund *a credible differentiated thing + evidence it works + a plan* — not a
finished, scaled product. Beyond M1 you need:
- The **TestFlight link** reviewers can try (M1.2) + the differentiator
  **functioning live with real data** (M1.1).
- **Early pilot evidence** — even N=5–10 from the interview cohort (women drivers,
  drivers of color, queer drivers, late-shift workers) over a few weeks: usage,
  reports, "community data changed the route in X% of trips" (via M1.4),
  qualitative quotes.
- The narrative is already strong (portfolio piece, thesis, research, Green-Book
  framing). What's missing is **live + early evidence** — which M1.1 + M1.4 + the
  pilot produce.

See the grant-fit shortlist from the 2026-06 research pass (Knight/Mozilla/Ford
civic-tech, Halcyon/New Inc student-founder, public-interest-tech + women's-safety
funds, NYC-local) when M1 is in TestFlight.

---

## Explicitly OUT (don't build before the pilot)

Deferring these is the discipline — the surface is already wide; depth on the
thesis claim is what funding hinges on:
- **Fuel Phase 2** (EPA make/model cascading lookup + dollar-input fill-up) — polish.
- **felt-welcome-out-of-scoreRoute** refactor — thesis-refinement (cheap; do it
  only if it sharpens the demo). Specced in the Jacobs thread, backlogged.
- **`tapTarget44` migration sweep**, **Figma fidelity audit #11** — polish.
- **Relational / personalized safety** — too far; community-aggregate is the call.
- **Any new feature.**

---

## Near-term verification owed (tactical — lives in next-session.md)
- **Device-test fuel Phase 1** (merged `e70ab1c`) via the simulated-location recipe
  before relying on it in a demo. Tracked in `docs/next-session.md`.
