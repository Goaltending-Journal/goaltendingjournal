"""Pull five NHL regular seasons of play-by-play into one shot table for the context-weighted goalie metric study.

Writes (in --out):
  shots.csv   one row per unblocked shot on goal faced by a goalie (no empty nets, no shootouts)
  games.csv   one row per game: date, teams, final score, winner
  points.csv  one row per goal with scorer and assisters (for prior points per game)
  dressed.csv one row per player per game dressed (for games played)

Raw play-by-play is cached as gzip JSON in --cache so reruns only download what is missing.
Standard library only. Run by .github/workflows/context-metric.yml.
"""
import argparse, csv, gzip, json, os, sys, time, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor

API = "https://api-web.nhle.com/v1"
SEASONS = [2021, 2022, 2023, 2024, 2025]          # start years: 2021-22 to 2025-26
GAMES_PER_SEASON = 1312


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "goaltendingjournal context-metric study"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(3 * (attempt + 1))
        except (urllib.error.URLError, TimeoutError):
            time.sleep(3 * (attempt + 1))
    return None


def fetch(gid, cache):
    path = os.path.join(cache, f"{gid}.json.gz")
    if os.path.exists(path):
        with gzip.open(path, "rt", encoding="utf-8") as f:
            return json.load(f)
    time.sleep(0.25)
    d = get(f"{API}/gamecenter/{gid}/play-by-play")
    if d:
        with gzip.open(path, "wt", encoding="utf-8") as f:
            json.dump(d, f)
    return d


def secs(t):
    m, _, s = (t or "").partition(":")
    return int(m) * 60 + int(s) if m.isdigit() and s.isdigit() else None


def parse(d, season):
    home, away = d["homeTeam"], d["awayTeam"]
    hid, aid = home["id"], away["id"]
    abbr = {hid: home["abbrev"], aid: away["abbrev"]}
    game = {"game": d["id"], "season": season, "date": d.get("gameDate", ""), "home": home["abbrev"], "away": away["abbrev"],
            "home_score": home.get("score"), "away_score": away.get("score")}
    dressed = [{"game": d["id"], "player": p["playerId"], "team": abbr.get(p.get("teamId"), ""), "pos": p.get("positionCode", ""),
                "name": f'{p.get("firstName", {}).get("default", "")} {p.get("lastName", {}).get("default", "")}'.strip()}
               for p in d.get("rosterSpots", [])]
    shots, points = [], []
    hs = as_ = 0
    prev = None
    for play in d.get("plays", []):
        kind = play.get("typeDescKey")
        per = play.get("periodDescriptor", {})
        pnum, ptype = per.get("number"), per.get("periodType")
        t = secs(play.get("timeInPeriod"))
        det = play.get("details", {}) or {}
        before = prev
        prev = play
        if ptype == "SO" or pnum is None or t is None:
            continue
        if kind not in ("shot-on-goal", "goal"):
            continue
        owner, goalie, x, y = det.get("eventOwnerTeamId"), det.get("goalieInNetId"), det.get("xCoord"), det.get("yCoord")
        if kind == "goal":
            new_hs, new_as = det.get("homeScore", hs), det.get("awayScore", as_)
            points.append({"game": d["id"], "date": game["date"], "scorer": det.get("scoringPlayerId") or "",
                           "a1": det.get("assist1PlayerId") or "", "a2": det.get("assist2PlayerId") or ""})
        if goalie is None or owner is None or x is None or y is None:
            if kind == "goal":
                hs, as_ = new_hs, new_as
            continue
        shoot_home = owner == hid
        side = play.get("homeTeamDefendingSide")
        if side in ("left", "right"):
            net = ("left" if side == "right" else "right") if shoot_home else side
        else:
            net = "right" if x > 0 else "left"
        flip = -1 if net == "left" else 1
        fx, fy = x * flip, y * flip
        code = play.get("situationCode") or ""
        if len(code) == 4 and code.isdigit():
            a_sk, h_sk = int(code[1]), int(code[2])
        else:
            a_sk = h_sk = 5
        shooters, defenders = (h_sk, a_sk) if shoot_home else (a_sk, h_sk)
        reb = rush = cross = 0
        if before and before.get("periodDescriptor", {}).get("number") == pnum:
            t0 = secs(before.get("timeInPeriod"))
            bd = before.get("details", {}) or {}
            if t0 is not None and 0 <= t - t0 <= 4:
                bx, by = bd.get("xCoord"), bd.get("yCoord")
                bk = before.get("typeDescKey")
                if bk in ("shot-on-goal", "missed-shot", "blocked-shot") and t - t0 <= 3 and bd.get("eventOwnerTeamId") == owner:
                    reb = 1
                if bx is not None and by is not None:
                    pbx, pby = bx * flip, by * flip
                    if pbx < 25:
                        rush = 1
                    elif t - t0 <= 3 and abs(pby) >= 3 and abs(fy) >= 3 and (pby > 0) != (fy > 0):
                        cross = 1
        sd = (hs - as_) if shoot_home else (as_ - hs)
        shooter = det.get("scoringPlayerId") if kind == "goal" else det.get("shootingPlayerId")
        shots.append({
            "season": season, "game": d["id"], "date": game["date"], "period": pnum,
            "gsec": (pnum - 1) * 1200 + t, "goalie": goalie, "gteam": abbr[aid if shoot_home else hid],
            "steam": abbr[owner], "shooter": shooter or "", "goalie_home": int(not shoot_home),
            "x": fx, "y": fy, "type": det.get("shotType") or "", "shooters": shooters, "defenders": defenders,
            "score_diff": sd, "reb": reb, "rush": rush, "cross": cross, "goal": int(kind == "goal")})
        if kind == "goal":
            hs, as_ = new_hs, new_as
    return game, shots, points, dressed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default="pbp-cache")
    ap.add_argument("--out", default="out")
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    os.makedirs(a.cache, exist_ok=True)
    os.makedirs(a.out, exist_ok=True)
    ids = [(s, int(f"{s}02{n:04d}")) for s in SEASONS for n in range(1, GAMES_PER_SEASON + 1)]
    with ThreadPoolExecutor(a.workers) as ex:
        raw = list(ex.map(lambda p: (p[0], fetch(p[1], a.cache)), ids))
    games, shots, points, dressed = [], [], [], []
    for season, d in raw:
        if not d or d.get("gameType") != 2 or d.get("gameState") not in ("OFF", "FINAL"):
            continue
        g, s, p, r = parse(d, season)
        games.append(g); shots += s; points += p; dressed += r
    for name, rows in (("games", games), ("shots", shots), ("points", points), ("dressed", dressed)):
        with open(os.path.join(a.out, f"{name}.csv"), "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader(); w.writerows(rows)
    print(f"{len(games)} games, {len(shots)} shots on goal, {sum(s['goal'] for s in shots)} goals", file=sys.stderr)


if __name__ == "__main__":
    main()
