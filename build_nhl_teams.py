"""Build nhl-teams-data.js for the NHL Teams view on goalies.html (Goldy, 2026-11-26).

Reads the NHL team goaltending depth chart from the project's research folder (research/nhl-goaltending-departments/
depth-chart.csv, built from the NHL feed: roster and prospect lists) and keeps only public feed facts: club, level, rank,
name, catches, birth year, draft and where the goalie plays now. No agents, contracts or staff (still being verified).
NHL-level goalies are not taken from this file: the page lists them live from goalies-data.js.

    python build_nhl_teams.py path/to/depth-chart.csv
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
with open("nhl-teams-data.js", "w", encoding="utf-8") as f:
    f.write("/* NHL Teams view: divisions and each club's goalies below the NHL (AHL, ECHL, prospects), from the NHL feed's\n"
            "   roster and prospect lists via build_nhl_teams.py. NHL goalies come live from goalies-data.js. */\n")
    f.write("window.NHL_TEAMS = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(len(rows), "goalies,", len(depth), "clubs, as of", as_of)
