"""Build goal-map-data.js for the goals heat map on goalies.html.

Reads the NHL's public play-by-play feed (api-web.nhle.com) for every finished
regular-season game this season and keeps each shot on goal a goalie faced:
where it was taken, whether it went in, the strength, and the shot type.
Missed and blocked shots are left out, and so are empty-net shots and shootouts.

Run by .github/workflows/update-goalie-stats.yml every morning, or by hand:

  python build_goal_map.py

Games already read are cached one per line in data/goal-map/<season>.jsonl, so a
daily run only downloads the games played since the last one. Uses only the
standard library.

  --pbp FILE [FILE ...]   read saved play-by-play JSON instead of downloading (for testing)
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
OUT = HERE / "goal-map-data.js"
CACHE_DIR = HERE / "data" / "goal-map"
API = "https://api-web.nhle.com/v1"
EASTERN = ZoneInfo("America/New_York")
DONE = {"OFF", "FINAL"}
SHOT_TYPES = ["wrist", "snap", "slap", "backhand", "tip-in", "deflected", "wrap-around", "poke", "bat", "between-legs", "cradle"]
# Strength from the shooting team's side: 0 even (5v5), 1 power play, 2 short-handed, 3 other even (4v4, 3v3).
STRENGTHS = ["5v5", "Power play", "Short-handed", "4v4 / 3v3"]
HEADER = ("/* Shots on goal faced by each NHL goalie this season, from the NHL play-by-play feed (api-web.nhle.com).\n"
          "   Rebuilt by build_goal_map.py; shown in the goals heat map on goalies.html.\n"
          "   x: feet from centre ice toward the goal (goal line at 89). y: feet across the ice, positive on the left as drawn.\n"
          "   Each shot: [goalie index, x, y, goal 0/1, strength index, shot type index]; a goal adds [shooter, date index, period, time]. */\n")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "goaltendingjournal (build_goal_map.py)"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt == 2:
                raise
            print(f"Retrying {url}: {e}", file=sys.stderr)
            time.sleep(5 * (attempt + 1))


def season_start(today):
    start = today.year if today.month >= 9 else today.year - 1
    return start


def finished_games(start_year, today):
    """Every finished regular-season game id from 1 October to today, read week by week."""
    ids, day = {}, date(start_year, 10, 1)
    while day <= today:
        sched = get(f"{API}/schedule/{day.isoformat()}")
        for wk in sched.get("gameWeek", []):
            for g in wk.get("games", []):
                if g.get("gameType") == 2 and g.get("gameState") in DONE:
                    ids[g["id"]] = wk["date"]
        nxt = sched.get("nextStartDate")
        if not nxt:
            break
        day = date.fromisoformat(nxt)
    return ids


def strength(code, goalie_is_home):
    """situationCode digits: away goalie, away skaters, home skaters, home goalie."""
    if not code or len(code) != 4 or not code.isdigit():
        return 3
    away, home = int(code[1]), int(code[2])
    shooters, defenders = (away, home) if goalie_is_home else (home, away)
    if shooters == defenders:
        return 0 if shooters == 5 else 3
    return 1 if shooters > defenders else 2


def read_game(pbp):
    """One cached line: the game's teams, date, goalies and every shot on goal they faced."""
    home, away = pbp["homeTeam"], pbp["awayTeam"]
    team_abbr = {home["id"]: home["abbrev"], away["id"]: away["abbrev"]}
    people = {}
    for p in pbp.get("rosterSpots", []):
        name = f'{p.get("firstName", {}).get("default", "")} {p.get("lastName", {}).get("default", "")}'.strip()
        people[p["playerId"]] = (name, team_abbr.get(p.get("teamId"), ""), p.get("positionCode"))
    shots = []
    for play in pbp.get("plays", []):
        kind = play.get("typeDescKey")
        if kind not in ("shot-on-goal", "goal"):
            continue
        per = play.get("periodDescriptor", {})
        if per.get("periodType") == "SO":
            continue
        d = play.get("details", {})
        goalie, owner, x, y = d.get("goalieInNetId"), d.get("eventOwnerTeamId"), d.get("xCoord"), d.get("yCoord")
        if goalie is None or owner is None or x is None or y is None:
            continue  # empty net, or no location recorded
        goalie_is_home = owner != home["id"]
        side = play.get("homeTeamDefendingSide")
        if side not in ("left", "right"):
            net_side = "right" if x > 0 else "left"  # no side given: assume the shot came from the attacking zone
        else:
            net_side = side if goalie_is_home else ("left" if side == "right" else "right")
        if net_side == "left":
            x, y = -x, -y
        row = {"g": goalie, "x": round(x), "y": round(y), "goal": int(kind == "goal"),
               "s": strength(play.get("situationCode"), goalie_is_home), "t": d.get("shotType") or ""}
        if kind == "goal":
            shooter = d.get("scoringPlayerId")
            row.update(by=people.get(shooter, ("", "", ""))[0], p=per.get("number"), at=play.get("timeInPeriod", ""))
        shots.append(row)
    goalies = {pid: {"name": v[0], "team": v[1]} for pid, v in people.items() if v[2] == "G"}
    return {"id": pbp["id"], "date": pbp.get("gameDate", ""), "home": home["abbrev"], "away": away["abbrev"],
            "goalies": goalies, "shots": shots}


def load_cache(path):
    games = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                g = json.loads(line)
                games[g["id"]] = g
    return games


def write_js(games, season_label, today):
    order = sorted(games.values(), key=lambda g: (g["date"], g["id"]))
    goalie_idx, goalie_list, dates, rows = {}, [], [], []
    latest = {}
    for g in order:  # the latest game's team wins, so traded goalies show their current club
        for pid, info in g["goalies"].items():
            latest[int(pid)] = info
    shooters, shooter_idx = [], {}
    for g in order:
        if not dates or dates[-1] != g["date"]:
            dates.append(g["date"])
        di = len(dates) - 1
        for s in g["shots"]:
            gid = s["g"]
            if gid not in goalie_idx:
                info = latest.get(gid, {"name": str(gid), "team": ""})
                goalie_idx[gid] = len(goalie_list)
                goalie_list.append([gid, info["name"], info["team"]])
            t = SHOT_TYPES.index(s["t"]) if s["t"] in SHOT_TYPES else -1
            row = [goalie_idx[gid], s["x"], s["y"], s["goal"], s["s"], t]
            if s["goal"]:
                if s.get("by", "") not in shooter_idx:
                    shooter_idx[s.get("by", "")] = len(shooters)
                    shooters.append(s.get("by", ""))
                row += [shooter_idx[s.get("by", "")], di, s.get("p") or 0, s.get("at", "")]
            rows.append(row)
    data = {
        "season": season_label, "asOf": today.isoformat(), "games": len(order),
        "from": dates[0] if dates else "", "to": dates[-1] if dates else "",
        "dates": dates, "strengths": STRENGTHS, "shotTypes": SHOT_TYPES,
        "goalies": goalie_list, "shooters": shooters, "shots": rows,
    }
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    body = body.replace('"shots":[[', '"shots":[\n[').replace("],[", "],\n[") if rows else body
    OUT.write_text(f"{HEADER}window.GOAL_MAP = {body};\n", encoding="utf-8")
    goals = sum(r[3] for r in rows)
    print(f"Wrote {len(rows)} shots on goal ({goals} goals) for {len(goalie_list)} goalies across {len(order)} games to {OUT.name}.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pbp", nargs="+", help="saved play-by-play JSON files to read instead of downloading")
    args = ap.parse_args()

    today = datetime.now(EASTERN).date()
    start = season_start(today)
    season_label = f"{start}-{str(start + 1)[2:]}"
    cache_path = CACHE_DIR / f"{start}{start + 1}.jsonl"
    games = {} if args.pbp else load_cache(cache_path)

    if args.pbp:
        for f in args.pbp:
            g = read_game(json.load(open(f, encoding="utf-8")))
            games[g["id"]] = g
    else:
        todo = {gid: d for gid, d in finished_games(start, today).items() if gid not in games}
        print(f"{len(games)} games cached, {len(todo)} new to read.")
        for i, gid in enumerate(sorted(todo)):
            if i:
                time.sleep(0.3)  # be gentle with the feed
            try:
                games[gid] = read_game(get(f"{API}/gamecenter/{gid}/play-by-play"))
            except Exception as e:  # one bad game should not stop the rest
                print(f"Skipped game {gid}: {e}", file=sys.stderr)
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_path.write_text("".join(json.dumps(games[k], ensure_ascii=False, separators=(",", ":")) + "\n"
                                      for k in sorted(games)), encoding="utf-8")

    if not games:
        sys.exit("No finished games found; goal-map-data.js left unchanged.")
    write_js(games, season_label, today)


if __name__ == "__main__":
    main()
