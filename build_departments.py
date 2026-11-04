"""Build the NHL-feed parts of the goaltending-departments research data.

Reads the NHL's public feed (api-web.nhle.com) and writes, to data/departments/:

  teams.csv            club x season: team name, standings points (2021-22 to now)
  depth-chart.csv      every goalie each club controls today, by level (NHL, AHL, ECHL, Prospects)
  club-goalies.csv     goalie x club x season: NHL games and starts (2021-22 to now)
  draft-goalies.csv    every goalie drafted 2010 to now: club, round, pick, path to the NHL
  feed-counts.json     goalie counts per club in the feed, for validation

Only professional facts are kept: no headshots, birthplaces or photos.
Staff, contracts and team spend change less often and come from the research files,
not from this script. Run it from the repository root:

  python build_departments.py            # everything
  python build_departments.py --quick    # skip the 2010-2020 draft classes
"""

import argparse
import csv
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

API = "https://api-web.nhle.com/v1"
HERE = Path(__file__).resolve().parent
OUT = HERE / "data" / "departments"
EASTERN = ZoneInfo("America/New_York")
FIRST_SEASON = 2021          # 2021-22, the first season in scope
FIRST_DRAFT = 2010           # draft classes kept for the pipeline view
FEED = "api-web.nhle.com"


def get(url):
    """Same helper as build_goal_map.py, with a small pause so the feed is read gently."""
    req = urllib.request.Request(url, headers={"User-Agent": "goaltendingjournal (build_departments.py)"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.load(r)
            time.sleep(0.25)
            return data
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if attempt == 2:
                raise
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt == 2:
                raise
            print(f"Retrying {url}: {e}", file=sys.stderr)
        time.sleep(5 * (attempt + 1))


def name_of(p):
    first = (p.get("firstName") or {}).get("default", "")
    last = (p.get("lastName") or {}).get("default", "")
    return f"{first} {last}".strip()


def season_id(start):
    return f"{start}{start + 1}"


def current_start(now):
    return now.year if now.month >= 9 else now.year - 1


def write_csv(name, rows, fields):
    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / name, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} rows to {name}")


def standings_by_season(first, last):
    """{season: {abbrev: {name, points, gp}}} at each season's final standings date."""
    seasons = {str(s["id"]): s for s in (get(f"{API}/standings-season") or {}).get("seasons", [])}
    out = {}
    for start in range(first, last + 1):
        sid = season_id(start)
        end = seasons.get(sid, {}).get("standingsEnd")
        data = get(f"{API}/standings/{end}") if end else None
        if not data and start == last:
            data = get(f"{API}/standings/now")
        out[sid] = {}
        for t in (data or {}).get("standings", []):
            ab = t["teamAbbrev"]["default"]
            out[sid][ab] = {"name": t["teamName"]["default"], "points": t.get("points"),
                            "gp": t.get("gamesPlayed")}
    return out


landing_cache = {}


def landing(pid):
    if pid not in landing_cache:
        landing_cache[pid] = get(f"{API}/player/{pid}/landing") or {}
    return landing_cache[pid]


def reg_rows(land):
    return [r for r in land.get("seasonTotals", []) if r.get("gameTypeId") == 2]


def path_to_nhl(land):
    """First AHL and NHL regular-season seasons, NHL games, and NHL clubs, from seasonTotals."""
    rows = reg_rows(land)
    ahl = [r["season"] for r in rows if r.get("leagueAbbrev") == "AHL" and r.get("gamesPlayed")]
    nhl = [r for r in rows if r.get("leagueAbbrev") == "NHL" and r.get("gamesPlayed")]
    return {
        "first_ahl_season": min(ahl) if ahl else "",
        "first_nhl_season": min(r["season"] for r in nhl) if nhl else "",
        "nhl_gp": sum(r.get("gamesPlayed", 0) for r in nhl),
        "nhl_clubs": sorted({r["teamName"]["default"] for r in nhl}),
    }


def bio(pid, land):
    d = land.get("draftDetails") or {}
    return {
        "player_id": pid,
        "name": name_of(land),
        "birth_date": land.get("birthDate", ""),
        "catches": land.get("shootsCatches", ""),
        "height_in": land.get("heightInInches", ""),
        "weight_lb": land.get("weightInPounds", ""),
        "draft_year": d.get("year", ""),
        "draft_club": d.get("teamAbbrev", ""),
        "draft_round": d.get("round", ""),
        "draft_overall": d.get("overallPick", ""),
    }


def current_placement(land, sid):
    """League and team now: the latest regular-season row this season, else the latest row."""
    rows = reg_rows(land)
    now = sorted([r for r in rows if str(r.get("season")) == sid], key=lambda r: r.get("sequence", 0))
    latest = now[-1] if now else (sorted(rows, key=lambda r: (r["season"], r.get("sequence", 0)))[-1] if rows else {})
    teams = [f'{r.get("leagueAbbrev")}:{r["teamName"]["default"]}' for r in now]
    return {
        "league_now": latest.get("leagueAbbrev", ""),
        "team_now": (latest.get("teamName") or {}).get("default", ""),
        "placement_season": latest.get("season", ""),
        "gp_now": latest.get("gamesPlayed", 0) if now else 0,
        "moved_this_season": "yes" if len(set(teams)) > 1 else "",
        "stops_this_season": " > ".join(teams) if len(set(teams)) > 1 else "",
    }


def nhl_game_dates(pid, sid):
    log = get(f"{API}/player/{pid}/game-log/{sid}/2") or {}
    dates = sorted(g["gameDate"] for g in log.get("gameLog", []))
    return (dates[0], dates[-1]) if dates else ("", "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true", help="skip the older draft classes")
    args = ap.parse_args()

    now = datetime.now(EASTERN)
    as_of = now.date().isoformat()
    last = current_start(now)
    sid_now = season_id(last)

    standings = standings_by_season(FIRST_SEASON, last)
    clubs = sorted(standings[sid_now])
    if len(clubs) != 32:
        print(f"Warning: {len(clubs)} clubs in this season's standings", file=sys.stderr)

    teams_rows = [{"club": ab, "season": f"{s[:4]}-{s[6:]}", "team_name": v["name"],
                   "points": v["points"], "gp": v["gp"], "as_of": as_of, "source": FEED}
                  for s, by in standings.items() for ab, v in sorted(by.items())]
    write_csv("teams.csv", teams_rows, ["club", "season", "team_name", "points", "gp", "as_of", "source"])

    # Goalie usage by club and season (NHL games and starts).
    usage, club_goalies = {}, []
    for s in standings:
        for ab in sorted(standings[s]):
            data = get(f"{API}/club-stats/{ab}/{s}/2") or {}
            for g in data.get("goalies", []):
                usage[(ab, s, g["playerId"])] = g
                club_goalies.append({
                    "club": ab, "season": f"{s[:4]}-{s[6:]}", "player_id": g["playerId"], "name": name_of(g),
                    "gp": g.get("gamesPlayed", 0), "gs": g.get("gamesStarted", 0),
                    "sa": g.get("shotsAgainst", 0), "ga": g.get("goalsAgainst", 0),
                    "toi_sec": g.get("timeOnIce", 0), "as_of": as_of, "source": FEED})
    write_csv("club-goalies.csv", club_goalies,
              ["club", "season", "player_id", "name", "gp", "gs", "sa", "ga", "toi_sec", "as_of", "source"])

    # Depth charts: the NHL roster plus the club's prospects list.
    depth, counts = [], {}
    for ab in clubs:
        roster = (get(f"{API}/roster/{ab}/current") or {}).get("goalies", [])
        prospects = (get(f"{API}/prospects/{ab}") or {}).get("goalies", [])
        roster_ids = {p["id"] for p in roster}
        prospect_ids = {p["id"] for p in prospects}
        seen, rows = set(), []
        for p in roster + prospects:
            pid = p["id"]
            if pid in seen:
                continue
            seen.add(pid)
            land = landing(pid)
            row = {"club": ab, **bio(pid, land), **current_placement(land, sid_now)}
            u = usage.get((ab, sid_now, pid), {})
            row["nhl_gp_now"], row["nhl_gs_now"] = u.get("gamesPlayed", 0), u.get("gamesStarted", 0)
            if pid in roster_ids:
                row["level"] = "NHL"
            elif row["league_now"] in ("AHL", "ECHL") and str(row["placement_season"]) == sid_now:
                row["level"] = row["league_now"]
            else:
                row["level"] = "Prospects"
            row["in_feed_list"] = "+".join(n for n, ids in (("roster", roster_ids), ("prospects", prospect_ids))
                                           if pid in ids)
            if row["moved_this_season"] and row["nhl_gp_now"]:
                first, lastd = nhl_game_dates(pid, sid_now)
                row["moved_on"] = f"NHL games {first} to {lastd}"
            else:
                row["moved_on"] = ""
            if not row["draft_year"]:
                row["draft_round"] = "undrafted"
            rows.append(row)
        order = {"NHL": 0, "AHL": 1, "ECHL": 2, "Prospects": 3}
        rows.sort(key=lambda r: (order[r["level"]], -int(r["nhl_gs_now"] or 0),
                                 -int(r["nhl_gp_now"] or 0), -int(r["gp_now"] or 0), r["name"]))
        rank = {}
        for r in rows:
            rank[r["level"]] = rank.get(r["level"], 0) + 1
            r["rank"] = rank[r["level"]]
            r["as_of"], r["source_url"], r["source_class"] = as_of, f"https://{FEED}/v1/prospects/{ab}", "primary"
        counts[ab] = {"roster": len(roster), "prospects": len(prospects), "listed": len(rows)}
        depth += rows
    write_csv("depth-chart.csv", depth, [
        "club", "level", "rank", "player_id", "name", "birth_date", "catches", "height_in", "weight_lb",
        "draft_year", "draft_club", "draft_round", "draft_overall", "league_now", "team_now",
        "placement_season", "gp_now", "nhl_gp_now", "nhl_gs_now", "contract_status", "rights_expire",
        "moved_this_season", "stops_this_season", "moved_on", "in_feed_list", "as_of", "source_url",
        "source_class"])

    # Draft history: every goalie pick, and how far each one has got.
    drafts = []
    first_draft = FIRST_SEASON if args.quick else FIRST_DRAFT
    for year in range(first_draft, now.year + 1):
        data = get(f"{API}/draft/picks/{year}/all") or {}
        for p in data.get("picks", []):
            if p.get("positionCode") != "G":
                continue
            row = {"draft_year": year, "club": p["teamAbbrev"], "round": p["round"],
                   "overall": p["overallPick"], "name": name_of(p),
                   "amateur_league": p.get("amateurLeague", ""), "amateur_club": p.get("amateurClubName", ""),
                   "player_id": "", "first_ahl_season": "", "first_nhl_season": "", "nhl_gp": 0,
                   "nhl_clubs": "", "as_of": as_of, "source": f"https://{FEED}/v1/draft/picks/{year}/all"}
            # The draft feed has no player id; match the drafted goalie through depth charts or search.
            match = [d for d in depth if d["name"] == row["name"] and str(d["draft_year"]) == str(year)]
            pid = match[0]["player_id"] if match else None
            if not pid:
                found = get(f"https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=5&q={urllib.request.quote(row['name'])}")
                for c in found or []:
                    if c.get("positionCode") == "G":
                        land = landing(c["playerId"])
                        if (land.get("draftDetails") or {}).get("year") == year:
                            pid = c["playerId"]
                            break
            if pid:
                row["player_id"] = pid
                path = path_to_nhl(landing(pid))
                row.update({**path, "nhl_clubs": "; ".join(path["nhl_clubs"])})
            drafts.append(row)
    write_csv("draft-goalies.csv", drafts, [
        "draft_year", "club", "round", "overall", "name", "player_id", "amateur_league", "amateur_club",
        "first_ahl_season", "first_nhl_season", "nhl_gp", "nhl_clubs", "as_of", "source"])

    (OUT / "feed-counts.json").write_text(json.dumps(
        {"as_of": as_of, "season": sid_now, "clubs": counts}, indent=1) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
