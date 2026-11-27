"""Build nhl-teams-data.js for the NHL Teams view on goalies.html (Goldy, 2026-11-26).

Reads the NHL team goaltending depth chart from the project's research folder (research/nhl-goaltending-departments/
depth-chart.csv, built from the NHL feed: roster and prospect lists) and keeps only public feed facts: club, level, rank,
name, catches, birth year, draft and where the goalie plays now. No agents or contracts (still being verified).
NHL-level goalies are not taken from this file: the page lists them live from goalies-data.js.

Depth Charts round (Goldy, 2026-11-27): also reads the same folder's staff.csv (goalie coaches and goaltending staff;
only rows marked confirmed with a club source page) and team-defence.csv (Natural Stat Trick 5v5 team rates against).

    python build_nhl_teams.py path/to/depth-chart.csv path/to/staff.csv path/to/team-defence.csv
"""
import csv, json, sys

DIVISIONS = [
    ("Atlantic", "Eastern", ["BOS", "BUF", "DET", "FLA", "MTL", "OTT", "TBL", "TOR"]),
    ("Metropolitan", "Eastern", ["CAR", "CBJ", "NJD", "NYI", "NYR", "PHI", "PIT", "WSH"]),
    ("Central", "Western", ["CHI", "COL", "DAL", "MIN", "NSH", "STL", "UTA", "WPG"]),
    ("Pacific", "Western", ["ANA", "CGY", "EDM", "LAK", "SEA", "SJS", "VAN", "VGK"]),
]
LEVELS = ["AHL", "ECHL", "Prospects"]

src = sys.argv[1]
staff_src, def_src = (sys.argv[2:4] + [None, None])[:2]
SEASON = "2026-27"
CLUBS = {t for _, _, ts in DIVISIONS for t in ts}   # drops old Arizona rows (the rights moved to Utah)
rows = [r for r in csv.DictReader(open(src, encoding="utf-8")) if r["level"] in LEVELS and r["club"] in CLUBS]
as_of = max(r["as_of"] for r in rows)
depth = {}
for r in sorted(rows, key=lambda r: (r["club"], LEVELS.index(r["level"]), int(r["rank"] or 99))):
    draft = f'{r["draft_year"]} · Rd {r["draft_round"]} · #{r["draft_overall"]}' if r["draft_year"] else ""
    depth.setdefault(r["club"], []).append({
        "id": int(r["player_id"]) if r["player_id"] else None, "name": r["name"], "level": r["level"],
        "born": r["birth_date"][:4], "catches": r["catches"], "draft": draft,
        "now": f'{r["team_now"]} ({r["league_now"]})' if r["team_now"] else r["league_now"],
    })
out = {"asOf": as_of, "divisions": [{"name": n, "conf": c, "teams": t} for n, c, t in DIVISIONS], "depth": depth}

# Goaltending staff: confirmed this season on the club's own staff page; NHL bench first, then the farm, then the front office
ROLES = ["Head Goalie Coach (NHL)", "Assistant Goalie Coach", "AHL Goalie Coach", "ECHL Goalie Coach", "Director of Goaltending",
         "Director of Goaltending Development", "Goaltending Consultant / Video", "Goaltending Scout"]
if staff_src:
    srows = [r for r in csv.DictReader(open(staff_src, encoding="utf-8")) if r["season"] == SEASON and r["status"] == "confirmed"
             and r["source_url"] and r["club"] in CLUBS and r["role_group"] in ROLES]
    staff, links = {}, {}
    for r in sorted(srows, key=lambda r: (r["club"], ROLES.index(r["role_group"]), r["person"])):
        if any(p["name"] == r["person"] and p["title"] == r["title_exact"].strip() for p in staff.get(r["club"], [])): continue   # listed twice on one page
        staff.setdefault(r["club"], []).append({"name": r["person"], "title": r["title_exact"].strip(), "level": r["level"], "role": r["role_group"]})
        if r["source_url"] not in links.setdefault(r["club"], []): links[r["club"]].append(r["source_url"])
    out.update(staff=staff, staffLinks=links, staffAsOf=max(r["source_date"] or r["as_of"] for r in srows))
    print(len(srows), "confirmed staff,", len(staff), "clubs")
# Team defence: shots, expected goals and high-danger chances against per 60 at 5v5 (Natural Stat Trick)
if def_src:
    drows = [r for r in csv.DictReader(open(def_src, encoding="utf-8")) if r["season"] == SEASON and r["club"] in CLUBS]
    out.update(defence={r["club"]: {k: float(r[k]) for k in ("sa60", "xga60", "hdca60")} for r in drows},
               defenceAsOf=max(r["as_of"] for r in drows))
    print(len(drows), "clubs of team defence")
with open("nhl-teams-data.js", "w", encoding="utf-8") as f:
    f.write("/* NHL Teams view: divisions and each club's goalies below the NHL (AHL, ECHL, prospects), from the NHL feed's\n"
            "   roster and prospect lists via build_nhl_teams.py, plus confirmed goaltending staff and Natural Stat Trick 5v5\n"
            "   team defence. NHL goalies come live from goalies-data.js. */\n")
    f.write("window.NHL_TEAMS = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(len(rows), "goalies,", len(depth), "clubs, as of", as_of)
