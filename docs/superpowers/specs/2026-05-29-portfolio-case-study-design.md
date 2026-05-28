# Fresh Greens portfolio case study — design

**Status:** Draft, awaiting user review
**Author:** Brainstorming session, 2026-05-29
**Topic:** A case-study page about Fresh Greens for the author's existing portfolio, aimed primarily at recruiters / hiring managers, structured as annotated craft moments anchored by primary research.

---

## Goal

A markdown + HTML case study that presents Fresh Greens as evidence that the author **ships polished product end-to-end** — designed, built, and shipped a real native app, with the discipline traceable to research conducted upfront and a design system enforced through audits at the end.

The artifact will be integrated into the author's existing portfolio (built in a parallel Claude Code session). It needs to emulate the portfolio's visual language without embedding specific tokens — semantic class names + CSS variable hooks so the portfolio session can adapt without rewriting the content.

---

## Decisions made during brainstorming

| Question | Decision |
|---|---|
| Audience | Recruiters / hiring managers (IC engineering or design-eng roles) |
| Venue | New case-study page on the author's existing portfolio (built in a parallel Claude Code session) |
| Takeaway | "Ships polished product end-to-end" — IC product story, not staff platform story |
| Structure | Option B — annotated craft moments (hero + origin + 5 moments + process moment + stack + footer) |
| Craft moment count | 5 (cut #5 lane guidance per user) |
| Research integration | Primary anchor — 6-participant qualitative interview research is the foundation of moment #1; subsequent moments trace product decisions back to research findings |
| Build-arc framing | Option D — Process moment carries phase 0 (systems work) + phase 1-8 (build + enforcement). No separate timeline section. |
| Visual emulation | Yes — emulate portfolio's existing brand color + type via CSS variables; semantic HTML classes; no hardcoded styling |
| Word count target | ≤ 1500 words |
| LinkedIn/tweet companion | Skipped |

---

## Research foundation (anchors moment #1)

The author conducted **6 semi-structured interviews** with Black drivers in America during 2026 to test whether the issues of the 20th century had persisted. Recruited through personal network + alumni poster. Ages 20s to early 40s. Urban and rural mix.

### Three interview themes → product features

1. **Zone vocabulary (4 findings):** participants were cognizant of **light, police presence, road quality, and wildlife** when driving familiar and unfamiliar areas. → Those four became the canonical zone primitives in the app. Every zone overlay traces back to one of the four.

2. **Trusted-contact behaviors (2 patterns):** participants reported calling a friend when lost — sometimes to be **guided turn-by-turn** through an area the friend knew, sometimes to have the friend **drive to them and trail them home**. → The trusted-contact graph has two distinct affordances reflecting both patterns: the trusted-friend pin on `/home` (for "drive to me") and the Contact phase on `/pulled-over` (for "guide me / call me").

3. **Skepticism + community knowledge:** participants were skeptical of "powers that be" and put significant faith in community-sourced knowledge. → Architecture: community-sourced reports get visual weight alongside (sometimes above) institutional zones. Routing engine has a fallback ladder so the app never depends on a single institutional source.

These three threads weave through moments 1-4 as explicit interview → feature traces.

---

## Page architecture

### Vertical structure (top to bottom)

1. **Hero** — 1-sentence pitch + 1 hero image + meta strip (role, dates, stack)
2. **Origin** — 1 paragraph (~80 words) anchored in the research
3. **Craft moments × 5** — each ~100-150 words + 1 image + sidebar metadata
4. **Process moment** — ~120 words (build arc: phase 0 systems work + phase 1-8 build + audit-driven culmination)
5. **Stack + tools** — bulleted list
6. **Footer CTAs** — GitHub repo, contact, back to portfolio

### Total length target

~1500 words across all body sections (excluding code samples, captions, metadata). Skimmable in 60 seconds (hero + moment headings). Deep-readable in 5-10 minutes.

### Hero treatment

- **One sentence** pitch positioned over hero image. Example draft: *"A native iPhone navigation app for Black drivers — daylight-aware routing, community-sourced safety knowledge, and a trusted-contact graph that lives alongside the road graph."*
- **One image:** map screenshot with all four zone types visible (police, low-light, road, wildlife) + daylight gradient on the polyline. Says "these are the four things drivers told me mattered" without writing it out.
- **Meta strip:** Role · Dates · Stack — three short lines below hero image.

---

## Craft moments

Each moment follows the same template:

```
[Heading — short noun phrase]
[Body — 100-150 words, first-person, confident-reporter voice]
[Image — 4:3 portrait for phone screens, 16:9 for diagrams]
[Sidebar metadata — Role / Stack / Outcome, 2-3 short tags each]
[Optional pull-quote — for moments with interview material]
```

### Moment 1 — From interviews to features

**Body framing:** Open with the four zone findings (light, police, road, wildlife) → those four became the app's zone primitives. Then trusted-contact (two patterns → two affordances). Close with community-skepticism → architectural fallback ladder. ~150 words (longest moment).

**Image:** Same as hero, or 2x2 grid of zone-type close-ups.

**Pull-quote slot:** `<INTERVIEW_QUOTE_RESEARCH>` — author provides 1-2 lines from interviews.

**Sidebar:**
- Role: Research → Product
- Stack: 6-participant qualitative interviews
- Outcome: 4 zone primitives + 2 trusted-contact affordances + fallback architecture

### Moment 2 — Daylight-aware routing

**Body framing:** Implementation of the "light" finding. Compute minutes-to-sunset per route segment using SunCalc against segment midpoints + travel duration. Color the polyline orange → mauve → indigo as the trip progresses through the day. WCAG 1.4.1 trade-off: color isn't enough on its own, so add `lineDashPattern` (solid → dashed → dotted) so the day/twilight/night transitions read for colorblind users too. ~100 words.

**Image:** Polyline at a zoom level where the gradient day → twilight → night reads clearly. Daylight strip visible on bottom sheet.

**Sidebar:**
- Role: Custom feature + accessibility
- Stack: SunCalc + react-native-maps Polyline
- Outcome: Daylight-encoded routes that read for colorblind users

### Moment 3 — Community knowledge over institutional routing

**Body framing:** The "skeptical of powers that be + faith in community knowledge" interview theme → architectural decision. Mapbox Directions as the primary routing source, OSRM as automatic fallback, cached route as third tier, mock as final. Source ladder: `mapbox → osrm → cache → mock`. The app never strands a driver because no single source is canonical. Parallel architectural choice: community-sourced reports get more visual weight than institutional zone overlays. ~120 words.

**Image:** Architecture diagram — 4-tier ladder rendered as a vertical flow. Will draft as inline SVG or hand-drawn-ish.

**Code sample:** 6-8 lines of the source ladder logic from `lib/api/routes.ts:getRoutesBetween`. File:line attribution.

**Sidebar:**
- Role: Architecture + values
- Stack: Mapbox Directions + OSRM + AsyncStorage
- Outcome: Routing that degrades gracefully + privileges community knowledge

### Moment 4 — Trusted-contact graph

**Body framing:** Two distinct behaviors from interviews → two distinct affordances. Pattern 1 (be trailed): the trusted-friend pin on `/home` shows where a friend's home is on the map; tap to call them. Pattern 2 (be guided): on `/pulled-over`, the Contact phase surfaces Call/Text affordances mid-stop. The trusted-contact graph lives **alongside the road graph** — both are first-class navigational data. ~120 words.

**Image:** Two-pane composition: `/home` browse mode with trusted-friend pin visible + `/pulled-over` Contact phase with Call/Text buttons.

**Pull-quote slot:** `<INTERVIEW_QUOTE_TRUSTED_CONTACT>` (optional).

**Sidebar:**
- Role: Product concept
- Stack: Custom marker + expo-linking (tel:/sms:)
- Outcome: Two affordances reflecting two real coping behaviors

### Moment 5 — Design system as enforcement layer

**Body framing:** Phase 0 — design system framework established upfront in dedicated planning sessions, before any feature code. Phase 1-8 — 25+ PRs across 24 days, with ~40 learnings entries documented per PR. Phase 8 (culmination) — design system codified into `docs/design-system.md` (893 lines), then 4 surface audits + 8 polish PRs that drift-cleaned the codebase against the canonical doc. Audits cited the doc directly in commit messages. Engineering practice, not output velocity. ~140 words.

**Image:** Before/after of one specific audit fix. Candidate: PR F's "back arrow disappears mid-typing" (S1) — visible visual diff. Or a section of the design-system.md doc with a callout for a successfully-caught drift.

**Code sample:** 10 lines max — an audit finding paired with the fix (e.g., F7 tabular-nums one-prop change). Shows discipline without flexing.

**Sidebar:**
- Role: Engineering practice
- Stack: TypeScript + custom mobile-ux-optimizer agent + docs/design-system.md
- Outcome: 38 polish fixes shipped across 8 PRs, every fix traceable to a documented convention

---

## Process moment

After the 5 craft moments, one short section (~120 words) frames the build arc:

> **Phase 0 — Systems work (pre-code).** Competitor audit for positioning. Design system framework. User-flow prioritization. Done across dedicated planning sessions before any feature code.
>
> **Phase 1-8 — Build + enforcement.** 25+ PRs over 24 days. 16 Claude Code sessions. ~40 learnings entries documented per PR. Round 8 culminates with the design system codified into `docs/design-system.md` + a Figma workflow PDF, and 4 surface audits + 8 polish PRs that drift-cleaned the codebase against it.

Single one-line tooling mention: *"Built across 24 days using ~16 Claude Code sessions with audit-driven discipline."* Honest framing — neither buried nor sensationalized.

---

## Stack + tools section

Bulleted list. No prose. Just signals:

- React Native + Expo (managed) + TypeScript
- `expo-router` (file-based)
- Mapbox Directions API + Mapbox Search Box (v6)
- OSRM (fallback routing source)
- `react-native-maps` (Apple Maps tile)
- SunCalc (daylight computation)
- AsyncStorage (route cache + community reports)
- Phosphor icons (deep-imports for tree-shaking)
- Custom three-layer architecture (adapters / scoring / screens)

---

## Visual treatment

### Image specs

| Image | Aspect | What | Production status |
|---|---|---|---|
| Hero | 4:3 portrait or 16:9 landscape | Map with 4 zone types + daylight gradient | Capture or composite needed |
| Moment 1 | Same as hero, or 2×2 grid | Zone-type close-ups | Composite needed |
| Moment 2 | 4:3 portrait | Polyline gradient + daylight strip | Existing screenshot likely works |
| Moment 3 | 16:9 landscape | 4-tier ladder diagram | I draft inline SVG |
| Moment 4 | 4:3 portrait (two-pane) | /home + /pulled-over composite | Existing screenshots compose |
| Moment 5 | 4:3 or 16:9 | Before/after audit fix | Existing screenshots compose |

All images need alt text — provided in the markdown.

### Code samples

Maximum 2 code blocks, ≤ 20 lines each:

1. **Moment 3** — `lib/api/routes.ts` source ladder snippet (6-8 lines)
2. **Moment 5** — F7 tabular-nums fix or equivalent small diff (10 lines)

No code in moments 1, 2, 4 (product-decision moments, not implementation).

### Pull-quote treatment

- Reserved for moment 1 (interview research) and optionally moment 4 (trusted-contact pattern)
- Large italic, set-off with left border in the portfolio's accent color (via CSS variable)
- Anonymized attribution: "Interview participant" or "P3, urban"
- 1-2 per moment max

### Sidebar metadata

Right-stripe on desktop, stacked-below on mobile. Per moment:

```
Role        [short tag]
Stack       [short tag]
Outcome     [short tag]
```

Tags are nouns/phrases, not sentences. Recruiter-skimmable.

### Visual emulation (portfolio integration)

The case study will use:

- **Semantic HTML class names** — `case-hero`, `craft-moment`, `craft-moment-meta`, `pull-quote`, `code-sample`, `process-arc`
- **CSS variable hooks** for theme — `--accent`, `--bg`, `--surface`, `--text-primary`, `--text-secondary`, `--text-meta`
- **No hardcoded colors, fonts, or spacing values** — portfolio's existing CSS overrides everything via the variables

The portfolio-building Claude session can define the variables once and the case study inherits the portfolio's visual identity automatically.

---

## What's NOT in the case study

Explicit scope cuts:

- Demo video — separate artifact
- Funding pitch / v2 vision — investor-facing track, different audience
- Comprehensive technical deep-dives — code is sparing; `docs/architecture.md` linked but not embedded
- Full audit findings enumeration — cite discipline + outcome; specifics live in commit history
- Full design system catalogue — link to `docs/design-system.md`; don't embed
- Verbose AI-collaboration narrative — single one-line mention
- Thesis framing as lede — acknowledged in origin paragraph, not the opening
- Acknowledgments / committee shoutouts
- Methodology section as standalone block — research IS the engine of moment 1

---

## Delivery plan

### What this spec produces (via `writing-plans` next)

1. **`case-study.md`** — clean markdown, ≤ 1500 words body, semantic structure
2. **HTML fallback** — same content with portfolio-agnostic class names + CSS variable hooks
3. **Image production brief** — bulleted list of needed captures with specs
4. **Code sample selections** — specific `file:line` ranges
5. **Sidebar metadata templates** — filled-in role/stack/outcome stripes
6. **Pull-quote slots** — placeholder markers for the author's interview quotes
7. **Architecture diagram SVG** for moment 3 — inline, theme-agnostic

### What the author does

1. Provide interview quotes when moment 1 is being drafted (or in advance — author indicated they have quotes ready)
2. Capture or composite the missing images per the brief
3. Coordinate with the portfolio-building Claude session to define CSS variables matching the portfolio's brand
4. Paste markdown / HTML into the portfolio's CMS or framework

### Items I'll need from the author before writing-plans

- **Interview quotes** for pull-quote slots (1-2 short lines per slot)
- **Hero image** decision: capture from running app, or composite from existing screenshots?
- **Confirmation** that the portfolio session can accept the CSS-variable handoff pattern

These can be surfaced during plan execution; not blocking spec completion.

---

## Follow-up thread (after this spec ships)

Author flagged that after this brainstorm closes (spec → user review → writing-plans → drafting), we'll do a separate planning pass on what to prioritize in the Fresh Greens codebase itself given the new portfolio + funding lens. Items likely to surface:

- A21 (no-route empty state redesign) — visible in screenshots
- A20 (rolling-window route fetch) — addresses the Amsterdam→Granada freeze; credibility hit for funding demos
- /menu, /recordings, /report audits — finishing the audit series
- Specimen sibling-repo sync
- A18 (heading wedge on /home dot) — small standalone polish
- README upgrade for GitHub

Tracking here so the side-thread doesn't get lost.
