"""Build goalie-types-data.js: each NHL goalie's playing type, for the goalie illustrations on goalies.html.

Reads what the morning stats run has already saved (the Natural Stat Trick table in data/nst/
and goalies-data.js), so it needs no download:

  python build_goalie_types.py

Each type is one trait the data can measure, and the illustration for that type shows only that trait:

  workhorse    most time in net this season (TOI)
  hd-stopper   goals saved above average on high-danger shots, per 60
  wall         goals saved above average on low- and medium-danger shots, per 60 (no soft goals)
  rebound      fewest rebound attempts against per 100 shots
  siege        most shots against per 60
  crease       highest share of shots against from high danger (traffic and net-front play)

A goalie's score on a trait is its z-score across qualifying goalies, shrunk toward zero by
TOI / (TOI + SHRINK_MIN) so a hot two-game start doesn't decide a type. The type is the trait
with the highest score among those that reach MIN_Z (MIN_Z_BY_TYPE for minutes); otherwise "plain". The single goalie with the most
goals saved above average (shrunk the same way) is "standout", if that score reaches STANDOUT_Z.

Five one-goalie titles sit on top of the types, from goalies-data.js (any goalie who has played
this season, whatever their minutes):

  donut-king   most shutouts (ties go to the better save %)
  grandpa      oldest
  young-gun    youngest
  style-king   most colourful gear, picked by hand in STYLE_KING (there is no data feed for gear)
  standout     as above

A goalie keeps every title they win in "titles"; their picture uses the first in TITLE_ORDER.

The run is nightly, so types are refined as games are played. To stop goalies flipping between
types on one game, a goalie keeps yesterday's type unless a new trait beats it by SWITCH_MARGIN.
Data courtesy of Natural Stat Trick (https://www.naturalstattrick.com).
"""

import csv
import json
import statistics
from datetime import date

from build_uncertainty_data import HERE, NST_DIR, NST_TEAMS, load_js, norm_name

OUT = HERE / "goalie-types-data.js"
MIN_TOI = 120          # minutes in net before a goalie gets a type
SHRINK_MIN = 240       # about four games
MIN_Z = 0.75
# Every starter piles up minutes, so a workhorse has to clear a higher bar than the other traits
MIN_Z_BY_TYPE = {"workhorse": 1.5}
STANDOUT_Z = 1.0
SWITCH_MARGIN = 0.25
STYLE_KING = 8476932   # Anthony Stolarz (Goldy, 2026-10-29); NHL player id of the goalie with the most colourful gear, set by hand
TITLE_ORDER = ["donut-king", "grandpa", "young-gun", "style-king", "standout"]

# key, name, the one trait the picture shows, the rule in words, the value, higher-is-better sign
TYPES = [
    ("workhorse", "Workhorse", "Always in the net", "Most minutes played this season", "toi", 1),
    ("hd-stopper", "High-Danger Stopper", "Stops the point-blank chance", "Goals saved above average on high-danger shots, per 60", "hd60", 1),
    ("wall", "The Wall", "Never gives up the soft one", "Goals saved above average on low- and medium-danger shots, per 60", "ldmd60", 1),
    ("rebound", "Rebound Controller", "Swallows the puck", "Fewest rebound attempts against per 100 shots", "reb100", -1),
    ("siege", "Under Siege", "Faces a flood of shots", "Most shots against per 60", "sa60", 1),
    ("crease", "Crease Battler", "Fights through traffic", "Highest share of shots from high danger", "hdshare", 1),
]
EXTRAS = [
    ("plain", "Steady", "No single trait stands out yet", f"No trait at {MIN_Z} or more"),
    ("standout", "Standout", "Beating expectations", "Most goals saved above average, per 60"),
    ("donut-king", "Donut King", "Zeros on the scoreboard", "Most shutouts this season"),
    ("grandpa", "Grandpa", "The league's elder", "Oldest goalie to play this season"),
    ("young-gun", "Young Gun", "The league's youngest", "Youngest goalie to play this season"),
    ("style-king", "Style King", "The loudest gear in the league", "Picked by hand: most colourful gear"),
]


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def traits(r):
    toi, sa = num(r["TOI"]), num(r["Shots Against"])
    h = toi / 60
    return {
        "toi": toi,
        "sa60": sa / h,
        "hdshare": num(r["HD Shots Against"]) / sa,
        "hd60": num(r["HDGSAA"]) / h,
        "ldmd60": (num(r["LDGSAA"]) + num(r["MDGSAA"])) / h,
        "reb100": num(r["Rebound Attempts Against"]) / sa * 100,
        "gsaa60": num(r["GSAA"]) / h,
    }


def zscores(rows, key, sign, shrink=True):
    vals = [r["t"][key] for r in rows]
    mu, sd = statistics.mean(vals), statistics.pstdev(vals) or 1
    for r in rows:
        w = r["t"]["toi"] / (r["t"]["toi"] + SHRINK_MIN) if shrink else 1
        r.setdefault("z", {})[key] = round(sign * (r["t"][key] - mu) / sd * w, 2)
    return mu, sd


def previous():
    try:
        return {g["id"]: g.get("trait", g["type"]) for g in load_js(OUT.name)["goalies"]}
    except (FileNotFoundError, AttributeError, KeyError, ValueError):
        return {}


def main():
    summary = json.loads((NST_DIR / "summary.json").read_text(encoding="utf-8"))
    nhl = load_js("goalies-data.js")["goalies"]
    ids = {norm_name(g["name"]): g["id"] for g in nhl}
    rows = []
    with open(NST_DIR / summary["files"]["all"]["file"], newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if num(r["TOI"]) < MIN_TOI or num(r["Shots Against"]) <= 0:
                continue
            team = r["Team"].split(",")[-1].strip()
            rows.append({"id": ids.get(norm_name(r["Player"])), "name": r["Player"],
                         "team": NST_TEAMS.get(team, team), "gp": int(num(r["GP"])), "t": traits(r)})

    league = {}
    for key, *_rest, value, sign in TYPES:
        mu, sd = zscores(rows, value, sign, shrink=value != "toi")   # minutes already carry their own sample size
        league[value] = {"mean": round(mu, 3), "sd": round(sd, 3)}
    mu, sd = zscores(rows, "gsaa60", 1)
    league["gsaa60"] = {"mean": round(mu, 3), "sd": round(sd, 3)}

    before = previous()
    for r in rows:
        scores = {key: r["z"][value] for key, *_rest, value, _sign in TYPES
                  if r["z"][value] >= MIN_Z_BY_TYPE.get(key, MIN_Z)}
        best = max(scores, key=scores.get, default="plain")
        kept = before.get(r["id"])
        if kept in scores and scores[best] - scores[kept] < SWITCH_MARGIN:
            best = kept
        r["type"] = best
    titles = {}
    top = max(rows, key=lambda r: r["z"]["gsaa60"], default=None)
    if top and top["z"]["gsaa60"] >= STANDOUT_Z:
        titles["standout"] = top["id"]
    y = summary["season"].split("-")
    season = f"{y[0]}-{y[1][2:]}"                                     # goalies-data.js labels seasons 2026-27
    played = [g for g in nhl if g["seasons"].get(season, {}).get("gp", 0) > 0]
    shut = [g for g in played if g["seasons"][season].get("so", 0) > 0]
    if shut:
        titles["donut-king"] = max(shut, key=lambda g: (g["seasons"][season]["so"], g["seasons"][season].get("svp") or 0))["id"]
    aged = [g for g in played if g.get("born")]
    if aged:
        titles["grandpa"] = min(aged, key=lambda g: g["born"])["id"]
        titles["young-gun"] = max(aged, key=lambda g: g["born"])["id"]
    if STYLE_KING:
        titles["style-king"] = STYLE_KING
    by_id = {r["id"]: r for r in rows}
    for key in TITLE_ORDER:
        gid = titles.get(key)
        if gid is None:
            continue
        if gid not in by_id:                                          # a title holder under MIN_TOI still gets an entry
            g = next(g for g in nhl if g["id"] == gid)
            by_id[gid] = {"id": gid, "name": g["name"], "team": g["seasons"][season].get("team", g.get("team")),
                          "gp": g["seasons"][season]["gp"], "z": {}, "type": None}
            rows.append(by_id[gid])
        by_id[gid].setdefault("titles", []).append(key)
    for r in rows:
        r["trait"] = r["type"]                                        # kept so tomorrow's run compares traits, not titles
        if r.get("titles"):
            r["type"] = r["titles"][0]

    counts = {k: sum(r["type"] == k for r in rows) for k, *_ in TYPES + EXTRAS}
    data = {
        "asOf": summary["fetched_at"][:10] or date.today().isoformat(),
        "season": summary["season"],
        "minToi": MIN_TOI,
        "credit": summary.get("credit", "Data courtesy of Natural Stat Trick"),
        "types": [{"key": k, "name": n, "trait": t, "rule": rule, "n": counts[k]} for k, n, t, rule, *_ in TYPES + EXTRAS],
        "league": league,
        "goalies": [{"id": r["id"], "name": r["name"], "team": r["team"], "gp": r["gp"], "type": r["type"],
                     **({"trait": r["trait"]} if r["trait"] and r["trait"] != r["type"] else {}),
                     **({"titles": r["titles"]} if r.get("titles") else {}), "z": r["z"]}
                    for r in sorted(rows, key=lambda r: r["name"])],
    }
    OUT.write_text(
        "/* Each NHL goalie's playing type from Natural Stat Trick data, for the goalie illustrations.\n"
        "   Rebuilt by build_goalie_types.py after each night's games; see its docstring for the rules. */\n"
        "window.GOALIE_TYPES = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8")
    print(f"Typed {len(rows)} goalies: " + ", ".join(f"{k} {n}" for k, n in counts.items()))


if __name__ == "__main__":
    main()
