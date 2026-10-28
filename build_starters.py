"""Build starters-data.js: the projected starting goalies carousel at the top of goalies.html.

For the next day with regular-season games (usually today), reads the NHL schedule
(api-web.nhle.com) and projects each team's starter from who has been starting lately,
using the games build_goal_map.py has cached in data/goal-map/<season>.jsonl.
The NHL does not publish confirmed starters before puck drop, so these are projections:

  - a team's number one is the goalie with the most starts in its last 10 games;
  - on the second night of a back-to-back, if the number one started last night,
    the team's most recent other starter is projected instead.

A game's starter is the goalie who faced that team's first shot on goal.
Run by .github/workflows/update-goalie-stats.yml after build_goal_map.py, or by hand:

  python build_starters.py

  --schedule FILE   read a saved schedule JSON instead of downloading (for testing)
  --today DATE      pretend today is DATE (YYYY-MM-DD), for testing
"""

import argparse
import json
from collections import Counter
from datetime import date, datetime, timedelta

from build_goal_map import API, CACHE_DIR, EASTERN, HERE, get, load_cache, season_start

OUT = HERE / "starters-data.js"
RECENT = 10


def team_history(games):
    """team -> [(date, starter id)] oldest first, plus season shots/goals per goalie and latest names."""
    hist, faced, info = {}, {}, {}
    for g in sorted(games.values(), key=lambda g: (g["date"], g["id"])):
        first = {}
        for s in g["shots"]:
            pid = str(s["g"])
            meta = g["goalies"].get(pid)
            if not meta:
                continue
            info[pid] = meta
            first.setdefault(meta["team"], pid)
            n = faced.setdefault(pid, [0, 0])
            n[0] += 1
            n[1] += s["goal"]
        for team, pid in first.items():
            hist.setdefault(team, []).append((g["date"], pid))
    return hist, faced, info


def project(team, day, hist):
    """(goalie id, reason) for one team on one day, or (None, "") when it has no games yet."""
    past = [(d, pid) for d, pid in hist.get(team, []) if d < day.isoformat()]
    if not past:
        return None, ""
    recent = past[-RECENT:]
    counts = Counter(pid for _, pid in recent)
    number_one = max(counts, key=lambda pid: (counts[pid], max(i for i, (_, p) in enumerate(recent) if p == pid)))
    last_day, last_pid = past[-1]
    if last_day == (day - timedelta(days=1)).isoformat() and last_pid == number_one:
        other = next((pid for _, pid in reversed(past) if pid != number_one), None)
        if other:
            return other, "Back-to-back: the number one started last night"
    return number_one, f"Started {counts[number_one]} of the last {len(recent)}"


def next_slate(sched, today):
    """The first date on or after today with regular-season games, and those games."""
    for wk in sched.get("gameWeek", []):
        if wk.get("date", "") < today.isoformat():
            continue
        games = [g for g in wk.get("games", []) if g.get("gameType") == 2]
        if games:
            return wk["date"], games
    return None, []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--schedule", help="saved schedule JSON to read instead of downloading")
    ap.add_argument("--today", help="pretend today is this date (YYYY-MM-DD)")
    args = ap.parse_args()

    today = date.fromisoformat(args.today) if args.today else datetime.now(EASTERN).date()
    start = season_start(today)
    games = load_cache(CACHE_DIR / f"{start}{start + 1}.jsonl")
    hist, faced, info = team_history(games)
    sched = json.load(open(args.schedule, encoding="utf-8")) if args.schedule else get(f"{API}/schedule/{today.isoformat()}")
    day, slate = next_slate(sched, today)

    rows = []
    for g in sorted(slate, key=lambda g: (g.get("startTimeUTC", ""), g["id"])):
        sides = []
        for key in ("awayTeam", "homeTeam"):
            team = g[key]["abbrev"]
            pid, why = project(team, date.fromisoformat(day), hist)
            side = {"team": team}
            if pid:
                sa, ga = faced.get(pid, [0, 0])
                side.update(id=int(pid), name=info[pid]["name"], why=why,
                            sv=round((sa - ga) / sa, 3) if sa else None,
                            gs=sum(1 for _, p in hist.get(team, []) if p == pid))
            sides.append(side)
        rows.append({"id": g["id"], "start": g.get("startTimeUTC", ""), "away": sides[0], "home": sides[1]})

    data = {"asOf": today.isoformat(), "date": day or "", "season": f"{start}{start + 1}", "games": rows}
    OUT.write_text(
        "/* Projected starting goalies for the next NHL game day, from who has been starting lately.\n"
        "   Rebuilt by build_starters.py each morning; shown in the carousel at the top of goalies.html. */\n"
        "window.STARTERS = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8")
    print(f"Wrote {len(rows)} games for {day or 'no upcoming date'} to {OUT.name}.")


if __name__ == "__main__":
    main()
