"""Build impact-data.js for the Impact GSAx situation heatmap on goalies.html.

Impact GSAx is goals saved above expected with each shot counted by how much a goal there would have
changed the game: the drop in the defending team's win probability if the shot had gone in. Saves in a
tied third period count for more than saves in a 6-1 game. It is a value stat, not a better skill rating:
the 11-season study (research/reports/Context weighted goalie metric results.md) found it about as
repeatable as plain GSAx.

The expected-goals and win-probability models are fixed fits from that study (data/impact/impact-model.json,
2015-16 to 2025-26, written by analysis/context-metric/model.py). Each season the expected goals are scaled
so the league's total goals saved above expected is zero.

Reads the NHL play-by-play feed for every finished regular-season game this season, caching each game's shots
in data/impact/<season>.jsonl. Run by .github/workflows/update-goalie-stats.yml every morning, or by hand:

  python build_impact.py
"""

import json
import math
import sys
import time
from datetime import datetime
from pathlib import Path

from build_goal_map import API, EASTERN, finished_games, get, season_start

HERE = Path(__file__).resolve().parent
OUT = HERE / "impact-data.js"
DATA_DIR = HERE / "data" / "impact"
MODEL = json.loads((DATA_DIR / "impact-model.json").read_text(encoding="utf-8"))
CACHE_VERSION = 1
TYPES = ["wrist", "snap", "slap", "backhand", "tip-in", "deflected", "wrap-around"]
# Game situations from the defending goalie's side, checked in this order; every shot lands in exactly one.
SITUATIONS = [["pk", "Penalty kill"], ["late", "Close game, 3rd period or OT"], ["early", "Close game, 1st or 2nd"],
              ["two", "Two-goal game"], ["blowout", "Three goals or more"]]
HEADER = ("/* Impact GSAx and goals saved above expected by game situation for each NHL goalie this season.\n"
          "   Rebuilt by build_impact.py from the NHL play-by-play feed (api-web.nhle.com) each morning.\n"
          "   goalies: [id, name, team, shots, goals against, GSAx, Impact GSAx, cells], cells in situation order,\n"
          "   each [shots, goals, expected goals]. Expected goals are scaled so the league total saved above expected is 0. */\n")


def secs(t):
    m, _, s = (t or "").partition(":")
    return int(m) * 60 + int(s) if m.isdigit() and s.isdigit() else None


def read_game(pbp):
    """One cached line: the game's goalies and every shot on goal they faced, with the context the models need."""
    home, away = pbp["homeTeam"], pbp["awayTeam"]
    hid = home["id"]
    abbr = {hid: home["abbrev"], away["id"]: away["abbrev"]}
    names = {p["playerId"]: f'{p.get("firstName", {}).get("default", "")} {p.get("lastName", {}).get("default", "")}'.strip()
             for p in pbp.get("rosterSpots", []) if p.get("positionCode") == "G"}
    shots, hs, as_, prev = [], 0, 0, None
    for play in pbp.get("plays", []):
        kind, per = play.get("typeDescKey"), play.get("periodDescriptor", {})
        pnum, t, det = per.get("number"), secs(play.get("timeInPeriod")), play.get("details", {}) or {}
        before, prev = prev, play
        if per.get("periodType") == "SO" or pnum is None or t is None or kind not in ("shot-on-goal", "goal"):
            continue
        new = (det.get("homeScore", hs), det.get("awayScore", as_)) if kind == "goal" else (hs, as_)
        owner, goalie, x, y = det.get("eventOwnerTeamId"), det.get("goalieInNetId"), det.get("xCoord"), det.get("yCoord")
        if goalie is None or owner is None or x is None or y is None:
            hs, as_ = new
            continue  # empty net, or no location recorded
        shoot_home = owner == hid
        side = play.get("homeTeamDefendingSide")
        if side in ("left", "right"):
            net = ("left" if side == "right" else "right") if shoot_home else side
        else:
            net = "right" if x > 0 else "left"
        flip = -1 if net == "left" else 1
        x, y = x * flip, y * flip
        code = play.get("situationCode") or ""
        a_sk, h_sk = (int(code[1]), int(code[2])) if len(code) == 4 and code.isdigit() else (5, 5)
        shooters, defenders = (h_sk, a_sk) if shoot_home else (a_sk, h_sk)
        reb = rush = cross = 0
        if before and before.get("periodDescriptor", {}).get("number") == pnum:
            t0, bd = secs(before.get("timeInPeriod")), before.get("details", {}) or {}
            if t0 is not None and 0 <= t - t0 <= 4:
                if before.get("typeDescKey") in ("shot-on-goal", "missed-shot", "blocked-shot") and t - t0 <= 3 \
                        and bd.get("eventOwnerTeamId") == owner:
                    reb = 1
                bx, by = bd.get("xCoord"), bd.get("yCoord")
                if bx is not None and by is not None:
                    bx, by = bx * flip, by * flip
                    if bx < 25:
                        rush = 1
                    elif t - t0 <= 3 and abs(by) >= 3 and abs(y) >= 3 and (by > 0) != (y > 0):
                        cross = 1
        shots.append({"g": goalie, "x": x, "y": y, "t": det.get("shotType") or "", "sh": shooters, "df": defenders,
                      "sd": (hs - as_) if shoot_home else (as_ - hs), "p": pnum, "s": (pnum - 1) * 1200 + t,
                      "home": int(not shoot_home), "reb": reb, "rush": rush, "cross": cross, "goal": int(kind == "goal")})
        hs, as_ = new
    goalies = {}
    for s in shots:
        team = abbr[away["id"]] if s["home"] == 0 else abbr[hid]
        goalies[s["g"]] = {"name": names.get(s["g"], str(s["g"])), "team": team}
    return {"v": CACHE_VERSION, "id": pbp["id"], "date": pbp.get("gameDate", ""), "goalies": goalies, "shots": shots}


def features(s):
    """The study's base shot features, in the order of impact-model.json."""
    dist = min(max(math.hypot(89 - s["x"], s["y"]), 1), 100)
    ang = math.degrees(math.atan2(abs(s["y"]), max(abs(89 - s["x"]), 0.1))) / 90
    adv, sd = s["sh"] - s["df"], max(-3, min(3, s["sd"]))
    f = {f"d{lo}": float(lo <= dist < hi) for lo, hi in [(0, 10), (10, 20), (20, 30), (30, 40), (40, 55)]}
    f.update(logd=math.log(dist), ang=ang, ang2=ang * ang, behind=float(s["x"] > 89),
             reb=s["reb"], rush=s["rush"], cross=s["cross"], pp=float(adv > 0), sh=float(adv < 0),
             ev_other=float(adv == 0 and s["sh"] < 5), lead=float(sd > 0), trail=float(sd < 0),
             p3=float(s["p"] == 3), ot=float(s["p"] > 3))
    f.update({f"t_{t}": float(s["t"] == t) for t in TYPES})
    return [f[k] for k in MODEL["xg"]["features"]]


def logistic(z):
    return 1 / (1 + math.exp(-z))


def xg(s):
    m = MODEL["xg"]
    return logistic(m["intercept"] + sum(c * v for c, v in zip(m["coef"], features(s))))


def win_prob(diff, left, home):
    w = MODEL["wp"]
    diff = max(-4, min(4, diff))
    return logistic(w["intercept"] + w["coef"][0] * diff + w["coef"][1] * diff / math.sqrt(left + 0.02) + w["coef"][2] * home)


def importance(s):
    """How much a goal on this shot would cut the defending team's win probability, scaled so the average shot is 1."""
    diff, left = -s["sd"], min(max(3600 - s["s"], 0), 3600) / 3600
    now = win_prob(diff, left, s["home"])
    lev = now if s["p"] > 3 else now - win_prob(diff - 1, left, s["home"])
    return min(max(lev, 0.001), 1) / MODEL["lev_mean"]


def situation(s):
    lead = -s["sd"]
    if s["sh"] > s["df"]:
        return 0
    if abs(lead) <= 1:
        return 1 if s["p"] >= 3 else 2
    return 3 if abs(lead) == 2 else 4


def load_cache(path):
    games = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                g = json.loads(line)
                if g.get("v") == CACHE_VERSION:
                    games[g["id"]] = g
    return games


def write_js(games, season_label, today):
    rows = [(g, s) for g in sorted(games.values(), key=lambda g: (g["date"], g["id"])) for s in g["shots"]]
    if not rows:
        sys.exit("No shots found; impact-data.js left unchanged.")
    exp = [xg(s) for _, s in rows]
    scale = sum(s["goal"] for _, s in rows) / sum(exp)   # league total saved above expected = 0
    info, out = {}, {}
    for g in games.values():
        for gid, v in g["goalies"].items():
            info[int(gid)] = v                            # later games overwrite, so traded goalies show their new team
    for (g, s), e in zip(rows, exp):
        e *= scale
        o = out.setdefault(s["g"], {"shots": 0, "ga": 0, "gsax": 0.0, "impact": 0.0, "cells": [[0, 0, 0.0] for _ in SITUATIONS]})
        c = o["cells"][situation(s)]
        c[0] += 1; c[1] += s["goal"]; c[2] += e
        o["shots"] += 1; o["ga"] += s["goal"]; o["gsax"] += e - s["goal"]; o["impact"] += (e - s["goal"]) * importance(s)
    goalies = [[gid, info.get(gid, {}).get("name", str(gid)), info.get(gid, {}).get("team", ""), o["shots"], o["ga"],
                round(o["gsax"], 2), round(o["impact"], 2), [[a, b, round(x, 2)] for a, b, x in o["cells"]]]
               for gid, o in sorted(out.items(), key=lambda kv: -kv[1]["impact"])]
    data = {"season": season_label, "asOf": today.isoformat(), "games": len(games), "situations": SITUATIONS, "goalies": goalies}
    OUT.write_text(f"{HEADER}window.IMPACT = {json.dumps(data, ensure_ascii=False, separators=(',', ':'))};\n", encoding="utf-8")
    print(f"Wrote Impact GSAx for {len(goalies)} goalies from {len(rows)} shots across {len(games)} games to {OUT.name}.")


def main():
    today = datetime.now(EASTERN).date()
    start = season_start(today)
    cache_path = DATA_DIR / f"{start}{start + 1}.jsonl"
    games = load_cache(cache_path)
    todo = sorted(gid for gid in finished_games(start, today) if gid not in games)
    print(f"{len(games)} games cached, {len(todo)} new to read.")
    for i, gid in enumerate(todo):
        if i:
            time.sleep(0.3)  # be gentle with the feed
        try:
            games[gid] = read_game(get(f"{API}/gamecenter/{gid}/play-by-play"))
        except Exception as e:  # one bad game should not stop the rest
            print(f"Skipped game {gid}: {e}", file=sys.stderr)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    cache_path.write_text("".join(json.dumps(games[k], ensure_ascii=False, separators=(",", ":")) + "\n" for k in sorted(games)),
                          encoding="utf-8")
    write_js(games, f"{start}-{str(start + 1)[2:]}", today)


if __name__ == "__main__":
    main()
