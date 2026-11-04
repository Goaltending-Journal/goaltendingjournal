"""Build panes/index.html, the "Brad's Goalie Panes" view on goalies.html.

Goalie Panes (forked from Goaltending-Journal/goalie-panes) draws every NHL goalie start this season as a
3D stack of glass panes, one per team, to show back-to-backs: the two nights a team plays in a row, and
who started each. This script replaces that repo's hand-saved snapshots with the NHL feed, so the panes
update with the rest of the stats each morning:

  python build_panes.py

Reads the schedule week by week (api-web.nhle.com) from the start of the season to two weeks ahead, and
the box score of every finished regular-season game, caching each game's goalie lines in
data/panes/<season>.json. Games in progress are read fresh and marked as partial.

Rules, as in the original:
- A start is the goalie the box score marks as the starter.
- "Most-used", "backup" and "third" rank each team's goalies by starts so far this season.
- A back-to-back is any two games on consecutive calendar dates.
Season totals on each goalie's card count every start this season. The panes show the last WINDOW_PAST days
and the next WINDOW_AHEAD, so they stay readable as the season grows.
"""

import collections
import json
import re
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

from build_goal_map import API, EASTERN, get, season_start

HERE = Path(__file__).resolve().parent
SRC = HERE / "panes" / "panes_src.html"
OUT = HERE / "panes" / "index.html"
DATA_DIR = HERE / "data" / "panes"
CACHE_VERSION = 1
WINDOW_PAST, WINDOW_AHEAD = 41, 14
DONE = {"OFF", "FINAL"}
LIVE = {"LIVE", "CRIT"}
DIV = {"Atlantic": "BOS BUF DET FLA MTL OTT TBL TOR", "Metropolitan": "CAR CBJ NJD NYI NYR PHI PIT WSH",
       "Central": "CHI COL DAL MIN NSH STL UTA WPG", "Pacific": "ANA CGY EDM LAK SJS SEA VAN VGK"}


def toi_s(t):
    m, _, s = (t or "0:0").partition(":")
    return int(m) * 60 + int(s or 0)


def schedule(start_year, last_day):
    """Every regular-season game from 1 September to last_day: id -> date, away, home, state."""
    games, day = {}, date(start_year, 9, 1)
    while day <= last_day:
        sched = get(f"{API}/schedule/{day.isoformat()}")
        for wk in sched.get("gameWeek", []):
            for g in wk.get("games", []):
                if g.get("gameType") == 2 and wk["date"] <= last_day.isoformat():
                    games[g["id"]] = dict(gid=g["id"], date=wk["date"], away=g["awayTeam"]["abbrev"],
                                          home=g["homeTeam"]["abbrev"], state=g.get("gameState", "FUT"))
        nxt = sched.get("nextStartDate")
        if not nxt:
            break
        day = date.fromisoformat(nxt)
    return games


def read_box(box):
    """One game's goalie lines and score, from its box score."""
    lines = []
    for side in ("awayTeam", "homeTeam"):
        team = box[side]["abbrev"]
        for g in box.get("playerByGameStats", {}).get(side, {}).get("goalies", []):
            sv, _, sa = (g.get("saveShotsAgainst") or "0/0").partition("/")
            lines.append(dict(team=team, pid=g["playerId"], name=g.get("name", {}).get("default", str(g["playerId"])),
                              starter=bool(g.get("starter")), toi=toi_s(g.get("toi")), sv=int(sv or 0), sa=int(sa or 0),
                              ga=int(g.get("goalsAgainst") or 0), dec=g.get("decision") or ""))
    return {"v": CACHE_VERSION, "lines": lines, "away": box["awayTeam"].get("score"), "home": box["homeTeam"].get("score"),
            "ot": (box.get("gameOutcome") or {}).get("lastPeriodType") or (box.get("periodDescriptor") or {}).get("periodType") or "REG"}


def full_names():
    """NHL ids to full names from goalies-data.js (the box score only gives "I. Sorokin")."""
    try:
        text = (HERE / "goalies-data.js").read_text(encoding="utf-8")
        data = json.loads(re.search(r"=\s*(\{.*\})\s*;?\s*$", text, re.S).group(1))
        return {g["id"]: g["name"] for g in data["goalies"]}
    except (OSError, AttributeError, ValueError, KeyError):
        return {}


def build(games, boxes, today, names):
    div = {t: k for k, v in DIV.items() for t in v.split()}
    by_day = {}
    for g in games.values():
        by_day[(g["date"], g["away"])] = by_day[(g["date"], g["home"])] = g
    start, scores = {}, {}
    for gid, b in boxes.items():
        g = games[gid]
        if b["away"] is not None and g["state"] in DONE:
            scores[gid] = dict(away=b["away"], home=b["home"], ot=b["ot"])
        for team in (g["away"], g["home"]):
            rows = [r for r in b["lines"] if r["team"] == team]
            pick = next((r for r in rows if r["starter"]), None)
            if not pick:  # no starter flag yet: the goalie with a decision, else the most ice time
                played = [r for r in rows if r["toi"] > 0]
                pick = next((r for r in played if r["dec"]), None) or (max(played, key=lambda r: r["toi"]) if played else None)
            if pick:
                start[(g["date"], team)] = dict(pid=pick["pid"], name=names.get(pick["pid"], pick["name"]), sv=pick["sv"], sa=pick["sa"],
                                                ga=pick["ga"], dec=pick["dec"], toi=pick["toi"], partial=g["state"] not in DONE)

    starts = collections.Counter((v["pid"], t) for (_, t), v in start.items())
    rank = {}
    for team in sorted(div):
        gl = sorted([(c, p) for (p, tm), c in starts.items() if tm == team], reverse=True)
        rank[team] = [dict(pid=p, name=next(v["name"] for v in start.values() if v["pid"] == p), starts=c) for c, p in gl]

    d0 = date.fromisoformat(min(g["date"] for g in games.values()))
    last = max(date.fromisoformat(max(g["date"] for g in games.values())), today)
    days = [(d0 + timedelta(i)).isoformat() for i in range((last - d0).days + 1)]
    cells, goalies = [], {}
    for t in sorted(div):
        for i, day in enumerate(days):
            g = by_day.get((day, t))
            if not g:
                continue
            prev, nxt = (d0 + timedelta(i - 1)).isoformat(), (d0 + timedelta(i + 1)).isoformat()
            b2b = ("out" if (prev, t) in by_day else "") + ("in" if (nxt, t) in by_day else "")
            s = start.get((day, t))
            home = g["home"] == t
            opp = g["away"] if home else g["home"]
            rk = next((j + 1 for j, x in enumerate(rank[t]) if s and x["pid"] == s["pid"]), None)
            prevs = start.get((prev, t))
            sc = scores.get(g["gid"])
            score = sc and dict(us=sc["home"] if home else sc["away"], them=sc["away"] if home else sc["home"], ot=sc["ot"])
            cells.append(dict(t=t, d=i, gid=g["gid"], opp=opp, home=int(home), st=g["state"], b2b=b2b or "none", rank=rk, score=score,
                              g=s and dict(pid=s["pid"], n=s["name"], sv=s["sv"], sa=s["sa"], ga=s["ga"], dec=s["dec"], toi=s["toi"],
                                           partial=s["partial"], same=(prevs is not None and prevs["pid"] == s["pid"]))))
            if s:
                G = goalies.setdefault(s["pid"], dict(pid=s["pid"], name=s["name"], team=t, rank=rk, gs=0, w=0, l=0, otl=0, sv=0, sa=0, ga=0, toi=0, games=[]))
                G["team"], G["rank"] = t, rk  # a traded goalie shows his newest team
                G["gs"] += 1; G["sv"] += s["sv"]; G["sa"] += s["sa"]; G["ga"] += s["ga"]; G["toi"] += s["toi"]
                if s["dec"] == "W": G["w"] += 1
                elif s["dec"] == "L": G["l"] += 1
                elif s["dec"]: G["otl"] += 1
                G["games"].append(dict(d=i, opp=opp, home=int(home), b2b=b2b or "none", sv=s["sv"], sa=s["sa"], dec=s["dec"]))
    for G in goalies.values():
        G["svpct"] = round(G["sv"] / G["sa"], 3) if G["sa"] else None
        G["gaa"] = round(G["ga"] * 3600 / G["toi"], 2) if G["toi"] else None
        G["second_nights"] = sum(1 for x in G["games"] if x["b2b"].startswith("out"))
        G["first_nights"] = sum(1 for x in G["games"] if x["b2b"].endswith("in"))
    played = [c for c in cells if c["g"]]
    second = [c for c in played if "out" in c["b2b"] and start.get(((d0 + timedelta(c["d"] - 1)).isoformat(), c["t"]))]
    summary = dict(played=len(played), second_nights=len(second), same_goalie=sum(1 for c in second if c["g"]["same"]),
                   by_rank=collections.Counter(c["rank"] for c in second), asof=today.isoformat())

    # The panes show a moving window; season totals and the summary above count the whole season.
    lo = max(0, days.index(today.isoformat()) - WINDOW_PAST) if today.isoformat() in days else 0
    hi = min(len(days), lo + WINDOW_PAST + WINDOW_AHEAD + 1)
    keep = lambda d: lo <= d < hi
    cells = [dict(c, d=c["d"] - lo) for c in cells if keep(c["d"])]
    for G in goalies.values():
        G["games"] = [dict(x, d=x["d"] - lo) for x in G["games"] if keep(x["d"])]
    return dict(days=days[lo:hi], today=today.isoformat(), teams=sorted(div), div=div, rank=rank, cells=cells,
                goalies=goalies, summary=summary)


def label(d):
    return datetime.strptime(d, "%Y-%m-%d").strftime("%b %-d")


def main():
    today = datetime.now(EASTERN).date()
    start_year = season_start(today)
    games = schedule(start_year, today + timedelta(WINDOW_AHEAD))
    if not games:
        sys.exit("No games in the schedule; panes left unchanged.")
    cache_path = DATA_DIR / f"{start_year}{start_year + 1}.json"
    cache = {}
    if cache_path.exists():
        cache = {int(k): v for k, v in json.loads(cache_path.read_text(encoding="utf-8")).items() if v.get("v") == CACHE_VERSION}
    boxes, new = {}, 0
    for gid, g in sorted(games.items()):
        if g["date"] > today.isoformat() or g["state"] not in DONE | LIVE:
            continue
        if g["state"] in DONE and gid in cache:
            boxes[gid] = cache[gid]
            continue
        if new:
            time.sleep(0.3)  # be gentle with the feed
        try:
            boxes[gid] = read_box(get(f"{API}/gamecenter/{gid}/boxscore"))
            new += 1
        except Exception as e:  # one bad game should not stop the rest
            print(f"Skipped game {gid}: {e}", file=sys.stderr)
            continue
        if g["state"] in DONE:
            cache[gid] = boxes[gid]
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps({str(k): cache[k] for k in sorted(cache)}, separators=(",", ":")) + "\n", encoding="utf-8")

    out = build(games, boxes, today, full_names())
    src = SRC.read_text(encoding="utf-8")
    page = src.replace("__RANGE__", f"{label(out['days'][0])} to {label(out['days'][-1])}").replace("__DATA__", json.dumps(out, separators=(",", ":")))
    OUT.write_text(page, encoding="utf-8")
    s = out["summary"]
    print(f"{new} box scores read; {s['played']} starts, {len(out['goalies'])} goalies, {s['second_nights']} second nights "
          f"({s['same_goalie']} by the first-night starter) -> {OUT.relative_to(HERE)}")


if __name__ == "__main__":
    main()
