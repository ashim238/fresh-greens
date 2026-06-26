#!/usr/bin/env python3
"""Generate Fresh Greens routing + zones architecture PDF for desktop."""

from __future__ import annotations

from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT = Path.home() / "Desktop" / "Fresh-Greens-Routing-and-Zones.pdf"


def mono(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build_styles():
    base = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle(
            "FGTitle",
            parent=base["Title"],
            fontSize=22,
            leading=26,
            spaceAfter=6,
            textColor=colors.HexColor("#003F04"),
        ),
        "subtitle": ParagraphStyle(
            "FGSubtitle",
            parent=base["Normal"],
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#326936"),
            spaceAfter=18,
        ),
        "h1": ParagraphStyle(
            "FGH1",
            parent=base["Heading1"],
            fontSize=16,
            leading=20,
            spaceBefore=14,
            spaceAfter=8,
            textColor=colors.HexColor("#003F04"),
        ),
        "h2": ParagraphStyle(
            "FGH2",
            parent=base["Heading2"],
            fontSize=13,
            leading=16,
            spaceBefore=10,
            spaceAfter=6,
            textColor=colors.HexColor("#326936"),
        ),
        "body": ParagraphStyle(
            "FGBody",
            parent=base["BodyText"],
            fontSize=10.5,
            leading=14,
            spaceAfter=8,
        ),
        "code": ParagraphStyle(
            "FGCode",
            parent=base["Code"],
            fontSize=8.5,
            leading=11,
            fontName="Courier",
            backColor=colors.HexColor("#F4F4F5"),
            leftIndent=8,
            rightIndent=8,
            spaceBefore=4,
            spaceAfter=8,
        ),
        "caption": ParagraphStyle(
            "FGCaption",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
            textColor=colors.grey,
            spaceAfter=10,
        ),
        "bullet": ParagraphStyle(
            "FGBullet",
            parent=base["BodyText"],
            fontSize=10.5,
            leading=14,
            leftIndent=14,
            bulletIndent=6,
        ),
    }
    return styles


def bullets(styles, items: list[str]):
    return ListFlowable(
        [ListItem(Paragraph(item, styles["bullet"]), leftIndent=12) for item in items],
        bulletType="bullet",
        start="circle",
        leftIndent=18,
    )


def code_block(styles, text: str):
    return Preformatted(mono(text), styles["code"])


def table(data, col_widths):
    t = Table(data, colWidths=col_widths, hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#326936")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAF8")]),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D4E8D6")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return t


def diagram_flow(styles):
    lines = """
  ORIGIN + DESTINATION
         |
         v
  getRoutesBetween()  --------->  Route[]  (2-3 candidate polylines)
         |                              |
         |                              |
  getZonesForTrip()  --------->  Zone[]   (safety geography)
         |                              |
         +--------------+---------------+
                        v
                 pickWinner(routes, zones)
                        |
                        v
           recommended (highest score) + alternates
                        |
                        v
        chips, markers, detail sheet, en-route alerts
"""
    return code_block(styles, lines.strip())


def build_story(styles):
    s: list = []
    today = date.today().isoformat()

    s.append(Paragraph("Fresh Greens", styles["title"]))
    s.append(
        Paragraph(
            "Routing logic, zone geometry, and how Zone[] fits in",
            styles["subtitle"],
        )
    )
    s.append(
        Paragraph(
            f"Reference doc · aligned to codebase on main · generated {today}",
            styles["caption"],
        )
    )

  # --- Overview ---
    s.append(Paragraph("1. The big picture", styles["h1"]))
    s.append(
        Paragraph(
            "Fresh Greens does <b>not</b> ask Mapbox for a “safest route.” It asks routing "
            "engines for <b>candidate paths</b>, loads a parallel <b>safety layer</b> as "
            "zones, then <b>scores and ranks</b> those paths locally. Two pipelines meet at "
            "<font face='Courier'>pickWinner()</font> in <font face='Courier'>lib/scoring.ts</font>.",
            styles["body"],
        )
    )
    s.append(diagram_flow(styles))
    s.append(
        Paragraph(
            "<b>Routing engines draw roads.</b> Fresh Greens decides which drawn road is safest.",
            styles["body"],
        )
    )

    s.append(Paragraph("2. Layer responsibilities", styles["h1"]))
    s.append(
        table(
            [
                ["Layer", "Location", "Job"],
                [
                    "Adapters",
                    "lib/api/*",
                    "Talk to the outside world; return typed Route[] or Zone[]",
                ],
                [
                    "Scoring",
                    "lib/scoring.ts",
                    "Pure math: score routes against zones; no network I/O",
                ],
                [
                    "Screens",
                    "app/home.tsx, app/en-route.tsx",
                    "Render polylines, chips, markers; hold React state",
                ],
            ],
            [1.1 * inch, 1.6 * inch, 3.8 * inch],
        )
    )
    s.append(Spacer(1, 12))

    s.append(PageBreak())

    # --- Routing ---
    s.append(Paragraph("3. Routing logic (geometry only)", styles["h1"]))
    s.append(
        Paragraph(
            "<font face='Courier'>getRoutesBetween(origin, destination)</font> in "
            "<font face='Courier'>lib/api/routes.ts</font> returns 2–3 polylines with ETAs. "
            "It knows nothing about lighting, police, or community reports.",
            styles["body"],
        )
    )
    s.append(Paragraph("3.1 Source ladder", styles["h2"]))
    s.append(
        table(
            [
                ["Tier", "Source", "When used"],
                ["1", "Mapbox Directions (driving-traffic)", "Token set; network OK"],
                ["2", "OSRM public demo", "Mapbox fails or no token"],
                ["3", "AsyncStorage route cache", "Both networks fail mid-trip"],
                ["4", "Mock straight-line route", "No cache — UI never empty"],
                ["—", "no-route", "Engines confirm destination is unroutable"],
            ],
            [0.5 * inch, 2.2 * inch, 3.8 * inch],
        )
    )
    s.append(Spacer(1, 10))
    s.append(
        Paragraph(
            "Mapbox and OSRM both request <font face='Courier'>alternatives=true</font>, so "
            "you usually get a fast primary path plus one or more alternates. None are "
            "pre-labeled “safe” — scoring assigns that later.",
            styles["body"],
        )
    )
    s.append(Paragraph("3.2 Preview vs navigation detail", styles["h2"]))
    s.append(
        bullets(
            styles,
            [
                "<b>/home</b> uses <font face='Courier'>detail: 'preview'</font>. On long trips "
                "the polyline may be coarser and turn-by-turn steps dropped so scoring does not "
                "freeze on thousands of coordinates.",
                "<b>/en-route</b> uses full detail: steps, lanes (Mapbox), live recalculation.",
                "Mapbox routes may carry <font face='Courier'>mapboxIncidentZones</font> parsed "
                "from Directions <font face='Courier'>legs[].incidents</font> — per-route, not global.",
            ],
        )
    )

    s.append(Paragraph("4. Scoring and picking a winner", styles["h1"]))
    s.append(
        Paragraph(
            "<font face='Courier'>pickWinner(rawRoutes, enabledZones)</font> scores every candidate, "
            "sorts descending, labels index 0 as <font face='Courier'>recommended</font> and the "
            "rest as <font face='Courier'>alternate</font>.",
            styles["body"],
        )
    )
    s.append(code_block(styles, """scoreRoute(route, zones):
  for each POINT zone:
    if route line passes within ~30m → add weight once
  for each route waypoint:
    for each POLYGON / POLYLINE zone:
      if waypoint inside / near zone → add weight

SCORE_WEIGHTS:  safe +2   caution -1   avoid -5
wildlife at dawn/dusk: ×2 multiplier (SunCalc)"""))
    s.append(Paragraph("4.1 Why two scoring passes?", styles["h2"]))
    s.append(
        bullets(
            styles,
            [
                "<b>Point zones</b> (community reports, police nodes): scored once per zone using "
                "distance from the <b>route line</b> to the point. Sparse Mapbox waypoints on "
                "straight blocks would miss a pin if you only tested waypoints.",
                "<b>Polygon / polyline zones</b> (dark streets, forests): scored per waypoint so "
                "penalty scales with <b>how much</b> of the route is exposed.",
            ],
        )
    )
    s.append(
        Paragraph(
            "For display tests (chips, markers), <font face='Courier'>routePassesZone()</font> "
            "densely samples the polyline every ~300m (capped) so long preview lines still "
            "catch hazards between sparse engine waypoints.",
            styles["body"],
        )
    )

    s.append(PageBreak())

    # --- Zone ---
    s.append(Paragraph("5. What is a Zone?", styles["h1"]))
    s.append(
        Paragraph(
            "A <font face='Courier'>Zone</font> is one classified piece of safety geography — "
            "the universal contract every adapter emits. Defined in "
            "<font face='Courier'>lib/api/zones.ts</font>.",
            styles["body"],
        )
    )
    s.append(code_block(styles, """type Zone = {
  id: string
  type: 'safe' | 'caution' | 'avoid'     // scoring weight
  label: string
  geometry: 'polygon' | 'polyline' | 'point'
  coordinates: Coordinate[]
  category?: 'lighting' | 'police' | 'wildlife' | ...
  source?: 'osm-overpass' | 'mapbox-incidents' | ...
}"""))
    s.append(Paragraph("5.1 Three axes", styles["h2"]))
    s.append(
        table(
            [
                ["Field", "Meaning", "Example"],
                [
                    "geometry",
                    "How to test intersection with a route",
                    "lit=no street → polyline",
                ],
                [
                    "type",
                    "Numeric weight in scoreRoute",
                    "lit=no → avoid (-5)",
                ],
                [
                    "category",
                    "What kind of signal; drives chips and UI",
                    "lighting, police, community-report",
                ],
            ],
            [1.0 * inch, 2.3 * inch, 2.9 * inch],
        )
    )
    s.append(Spacer(1, 10))

    s.append(Paragraph("5.2 Zone geometry", styles["h2"]))
    s.append(
        table(
            [
                ["Geometry", "coordinates[]", "Hit test", "Typical sources"],
                [
                    "polygon",
                    "Closed area vertices",
                    "Point-in-polygon on route samples",
                    "landuse, parks, forest polygons",
                ],
                [
                    "polyline",
                    "Open path along a street",
                    "Within ~20m of line",
                    "lit=* tags, road surface, construction",
                ],
                [
                    "point",
                    "Single [lat, lng]",
                    "Within ~30m of route line",
                    "community reports, speed cameras, wildlife crossings",
                ],
            ],
            [0.9 * inch, 1.4 * inch, 1.8 * inch, 2.4 * inch],
        )
    )
    s.append(Spacer(1, 10))
    s.append(
        Paragraph(
            "Adapters <b>describe</b> what is there. Scoring <b>decides</b> what it means for "
            "this trip (e.g. wildlife amplified at dusk). UI <b>explains</b> it back via chips "
            "and markers.",
            styles["body"],
        )
    )

    s.append(Paragraph("6. Where Zone[] comes from", styles["h1"]))
    s.append(
        Paragraph(
            "On <font face='Courier'>/home</font> you do not have one monolithic fetch. Several "
            "arrays merge into one working set called <font face='Courier'>enabledZones</font>.",
            styles["body"],
        )
    )
    s.append(code_block(styles, """osmZones          ← getZonesForTrip (corridor / browse / nav rolls)
reportZones       ← getCommunityReportsAsZones() (device-local)
mapboxIncidents   ← on each Route when source is mapbox

corridorZones = collapseHazardZones([...osmZones, ...incidents])
enabledOsmZones = corridorZones filtered by user prefs
enabledReportZones = reportZones filtered by prefs
enabledZones = enabledOsmZones + enabledReportZones   ← main input"""))
    s.append(Paragraph("6.1 Fetch modes", styles["h2"]))
    s.append(
        bullets(
            styles,
            [
                "<b>Browse</b> (no destination): small circle around GPS via Overpass.",
                "<b>Preview</b> (<font face='Courier'>/home</font>): corridor sampler along the "
                "route polyline — powers orange chips and yellow map markers.",
                "<b>Navigation</b> (<font face='Courier'>/en-route</font>): hydrate corridor "
                "cache from preview, then roll ~30km ahead of GPS (~every 45s). Dev log: "
                "<font face='Courier'>[corridor] navigation +N zones</font>.",
            ],
        )
    )
    s.append(Paragraph("6.2 collapseHazardZones (L3 merge)", styles["h2"]))
    s.append(
        Paragraph(
            "When OSM, DOT-511 demo, and Mapbox incidents describe the same hazard in one "
            "grid cell, merge keeps one survivor by source precedence: "
            "<b>community &gt; 511 &gt; mapbox-incidents &gt; osm-overpass</b>. "
            "Prevents duplicate chips for the same real-world hazard.",
            styles["body"],
        )
    )
    s.append(Paragraph("6.3 User preference filters", styles["h2"]))
    s.append(
        bullets(
            styles,
            [
                "<font face='Courier'>flagPolice</font>, <font face='Courier'>flagLowLight</font>, "
                "<font face='Courier'>flagCommunityReports</font> gate categories via "
                "<font face='Courier'>isZoneCategoryEnabled()</font>.",
                "Wildlife and road-condition are always on (baseline safety factors).",
            ],
        )
    )

    s.append(PageBreak())

    # --- How it fits ---
    s.append(Paragraph("7. How Zone[] connects to the UI", styles["h1"]))
    s.append(
        table(
            [
                ["Consumer", "Reads", "Purpose"],
                [
                    "pickWinner / scoreRoute",
                    "enabledZones (+ per-route incidents)",
                    "Which route wins",
                ],
                ["routeConditions", "enabledZones + selectedRoute", "Orange chip categories"],
                [
                    "routeHazardsOnPath",
                    "enabledZones + selectedRoute",
                    "Ordered hazards → detail sheet pager",
                ],
                ["Map markers", "hazards on selected path", "Yellow teardrops + orange report pins"],
                ["/en-route", "enabledZones + GPS", "Zone entry, turn-card hazards, speed pill"],
                ["zone-cache", "osmZones only", "Preview → navigation handoff (24h TTL)"],
            ],
            [1.3 * inch, 1.8 * inch, 2.9 * inch],
        )
    )
    s.append(Spacer(1, 12))
    s.append(
        Paragraph(
            "Chips and score both use <font face='Courier'>routePassesZone()</font> on the same "
            "zones so briefing and math stay aligned. Chips show <b>warnings only</b> "
            "(<font face='Courier'>type !== safe</font>); a route can score well from many "
            "lit streets (+2 each) while chips still show community flags.",
            styles["body"],
        )
    )

    s.append(Paragraph("8. Typical trip lifecycle", styles["h1"]))
    s.append(
        bullets(
            styles,
            [
                "User sets destination → <font face='Courier'>getRoutesBetween</font> → polylines appear.",
                "Corridor runs → <font face='Courier'>osmZones</font> fills (stale cache first, then refresh).",
                "<font face='Courier'>enabledZones</font> merges OSM + incidents + reports → "
                "<font face='Courier'>pickWinner</font> re-ranks.",
                "Preview shows <font face='Courier'>recommended</font> by default; user may select an alternate.",
                "Chips/markers reflect <b>selectedRoute</b>, not necessarily the winner.",
                "Tap Go → <font face='Courier'>saveCorridorZones</font>; en-route loads cache + navigation rolls.",
            ],
        )
    )

    s.append(Paragraph("9. Key files", styles["h1"]))
    s.append(
        bullets(
            styles,
            [
                "<font face='Courier'>lib/api/routes.ts</font> — source ladder, Route type, alternatives",
                "<font face='Courier'>lib/api/zones.ts</font> — Zone type, Overpass adapters",
                "<font face='Courier'>lib/corridor/*</font> — preview planner, navigation rolls, merge",
                "<font face='Courier'>lib/scoring.ts</font> — scoreRoute, pickWinner, routeConditions",
                "<font face='Courier'>lib/api/zone-cache.ts</font> — corridor cache per destination",
                "<font face='Courier'>app/home.tsx</font> — enabledZones wiring, chips, markers",
            ],
        )
    )

    s.append(Spacer(1, 16))
    s.append(
        Paragraph(
            "<b>One sentence:</b> Mapbox/OSRM propose roads; adapters fill Zone[] with classified "
            "geography; scoreRoute adds up safe/caution/avoid hits; pickWinner crowns the safest; "
            "chips and markers explain the selected route.",
            styles["body"],
        )
    )
    s.append(
        Paragraph(
            "Portfolio tag: <font face='Courier'>portfolio-2026-06</font> · "
            "GitHub: ashim238/fresh-greens",
            styles["caption"],
        )
    )

    return s


def main() -> None:
    styles = build_styles()
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        leftMargin=0.85 * inch,
        rightMargin=0.85 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title="Fresh Greens — Routing and Zones",
        author="Fresh Greens / Myles Ashitey",
    )
    doc.build(build_story(styles))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
