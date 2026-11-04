"""Assemble the goaltending-departments data files for the site hand-off.

Joins what build_departments.py and fetch_nst.py saved in data/departments/ with the hand-researched
staff, contract and program files, and writes the eight files listed in the research prompt:

  staff.csv  depth-chart.csv  contracts.csv  team-spend.csv  development.csv
  performance.csv  team-defence.csv  sources.csv
  (plus team-goalie-results.csv and pipeline.csv, derived views used for the dossier)

  python assemble_departments.py --notes <research notes folder> --out <data folder>

Numbers from the NHL feed and Natural Stat Trick are rebuilt here, never typed. Hand-researched rows
are copied through unchanged, so their sources and statuses stay with them.
"""

import argparse
import csv
import glob
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEPT = HERE / "data" / "departments"
NST_CREDIT = "Natural Stat Trick (data.naturalstattrick.com)"
# Natural Stat Trick writes four clubs differently from the NHL feed.
NST_CLUB = {"N.J": "NJD", "S.J": "SJS", "T.B": "TBL", "L.A": "LAK"}
SIX_DRAFTS = range(2021, 2027)


def norm(n):
    n = unicodedata.normalize("NFD", n or "")
    return re.sub(r"[^a-z]", "", "".join(c for c in n if not unicodedata.combining(c)).lower())


def read(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write(out, name, rows, fields):
    out.mkdir(parents=True, exist_ok=True)
    with open(out / name, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"{name}: {len(rows)} rows")


def season_label(sid):
    return f"{sid[:4]}-{sid[6:]}"


def num(x, cast=float):
    try:
        return cast(x)
    except (TypeError, ValueError):
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--notes", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    as_of = date.today().isoformat()

    club_goalies = read(DEPT / "club-goalies.csv")
    ids = {}  # (norm name, club, season) -> player id, and (norm name) -> ids
    by_name = defaultdict(set)
    by_last = defaultdict(set)  # (last name, club, season): catches Sam/Samuel, Georgi/Georgii
    for r in club_goalies:
        by_last[(norm(r["name"].split()[-1]), r["club"], r["season"])].add(r["player_id"])
        ids[(norm(r["name"]), r["club"], r["season"])] = r["player_id"]
        by_name[norm(r["name"])].add(r["player_id"])

    # performance.csv: one row per goalie x NST team label x season x situation.
    perf = []
    for path in sorted(glob.glob(str(DEPT / "nst" / "goalies_*_*.csv"))):
        _, sid, sit = Path(path).stem.split("_")
        for r in read(path):
            clubs = [NST_CLUB.get(c.strip(), c.strip()) for c in r["Team"].split(",")]
            pid = next((ids.get((norm(r["Player"]), c, season_label(sid))) for c in clubs
                        if ids.get((norm(r["Player"]), c, season_label(sid)))), "")
            if not pid:
                hits = set().union(*(by_last[(norm(r["Player"].split()[-1]), c, season_label(sid))] for c in clubs))
                pid = next(iter(hits)) if len(hits) == 1 else ""
            if not pid and len(by_name[norm(r["Player"])]) == 1:
                pid = next(iter(by_name[norm(r["Player"])]))
            xga, ga = num(r.get("xG Against")), num(r.get("Goals Against"))
            perf.append({
                "season": season_label(sid), "club": "/".join(clubs), "player_id": pid, "name": r["Player"],
                "situation": sit, "gp": r["GP"], "toi": r["TOI"], "sa": r["Shots Against"],
                "ga": r["Goals Against"], "svpct": r["SV%"], "xga": r.get("xG Against", ""),
                "gsaa": r["GSAA"], "gsax": f"{xga - ga:.2f}" if xga is not None and ga is not None else "",
                "hd_sa": r["HD Shots Against"], "hd_svpct": r["HDSV%"], "as_of": as_of, "source": NST_CREDIT})
    write(args.out, "performance.csv", perf, ["season", "club", "player_id", "name", "situation", "gp", "toi",
          "sa", "ga", "svpct", "xga", "gsaa", "gsax", "hd_sa", "hd_svpct", "as_of", "source"])

    # team-goalie-results.csv: club x season goalie GSAx. A goalie who played for two clubs is split
    # by the share of his NHL shots against with each club (from the NHL feed); those rows are flagged.
    shots = defaultdict(dict)
    for r in club_goalies:
        shots[(r["player_id"], r["season"])][r["club"]] = int(r["sa"] or 0)
    team = defaultdict(lambda: defaultdict(float))
    for p in perf:
        g = num(p["gsax"])
        if g is None:
            continue
        clubs = p["club"].split("/")
        split = shots.get((p["player_id"], p["season"]), {})
        total = sum(split.get(c, 0) for c in clubs)
        for c in clubs:
            share = split.get(c, 0) / total if total and len(clubs) > 1 else 1.0 / len(clubs)
            t = team[(c, p["season"])]
            t[f"gsax_{p['situation']}"] += g * share
            t[f"sa_{p['situation']}"] += (num(p["sa"]) or 0) * share
            t[f"toi_{p['situation']}"] += (num(p["toi"]) or 0) * share
            if len(clubs) > 1:
                t["split_goalies"] += 1 / 2  # counted once per situation file
    tgr = []
    for (c, s), t in sorted(team.items()):
        row = {"club": c, "season": s, "as_of": as_of, "source": NST_CREDIT,
               "split_goalies": int(t["split_goalies"])}
        for sit in ("all", "5v5"):
            toi = t[f"toi_{sit}"]
            row[f"gsax_{sit}"] = f"{t[f'gsax_{sit}']:.1f}"
            row[f"gsax60_{sit}"] = f"{t[f'gsax_{sit}'] * 60 / toi:.3f}" if toi else ""
            row[f"sa_{sit}"] = round(t[f"sa_{sit}"])
        tgr.append(row)
    write(args.out, "team-goalie-results.csv", tgr, ["club", "season", "gsax_all", "gsax60_all", "sa_all",
          "gsax_5v5", "gsax60_5v5", "sa_5v5", "split_goalies", "as_of", "source"])

    # team-defence.csv: the 5v5 team table, when Natural Stat Trick returned it.
    defence = []
    full = {norm(t["team_name"]): t["club"] for t in read(DEPT / "teams.csv")}
    full.update({norm("Arizona Coyotes"): "ARI", norm("Utah Hockey Club"): "UTA", norm("Utah Mammoth"): "UTA"})
    for path in sorted(glob.glob(str(DEPT / "nst" / "teams_*_5v5.csv"))):
        sid = Path(path).stem.split("_")[1]
        for r in read(path):
            defence.append({"season": season_label(sid), "club": full.get(norm(r["Team"]), r["Team"]), "xga60": r.get("xGA/60", ""),
                            "hdca60": r.get("HDCA/60", ""), "sa60": r.get("SA/60", ""),
                            "as_of": as_of, "source": NST_CREDIT})
    write(args.out, "team-defence.csv", defence, ["season", "club", "xga60", "hdca60", "sa60", "as_of", "source"])

    # depth-chart.csv: the feed's roster and prospect lists, plus goalies the club drafted in the last
    # six drafts that the feed's prospect list leaves out (rights not yet verified).
    depth = read(DEPT / "depth-chart.csv")
    drafts = read(DEPT / "draft-goalies.csv")
    listed = {r["player_id"] for r in depth}
    listed_names = {(norm(r["name"].split()[-1]), str(r["draft_year"])) for r in depth}  # Nikke/Niklas Kokko
    agents = {}
    for path in glob.glob(str(args.notes / "agents_*.csv")):
        for r in read(path):
            agents[r["player_id"] or norm(r["name"])] = r
    extra = []
    for d in drafts:
        if (int(d["draft_year"]) not in SIX_DRAFTS or (d["player_id"] and d["player_id"] in listed)
                or (norm(d["name"].split()[-1]), str(d["draft_year"])) in listed_names):
            continue
        extra.append({"club": d["club"], "level": "Prospects", "player_id": d["player_id"], "name": d["name"],
                      "draft_year": d["draft_year"], "draft_club": d["club"], "draft_round": d["round"],
                      "draft_overall": d["overall"], "league_now": d["amateur_league"],
                      "team_now": d["amateur_club"], "in_feed_list": "draft list only",
                      "source_url": d["source"], "source_class": "primary",
                      "note": "drafted goalie not in the club's prospect list; rights not verified; league/team at draft"})
    for r in depth + extra:
        a = agents.get(r.get("player_id")) or agents.get(norm(r.get("name")))
        r["agent"], r["agency"], r["agent_source_url"] = (a["agent"], a["agency"], a["source_url"]) if a else ("", "", "")
        r["as_of"] = as_of
    rank = Counter()
    for r in extra:
        rank[r["club"]] += 1
        r["rank"] = 100 + rank[r["club"]]  # after the feed-listed prospects
    write(args.out, "depth-chart.csv", depth + extra, [
        "club", "level", "rank", "player_id", "name", "birth_date", "catches", "height_in", "weight_lb",
        "draft_year", "draft_club", "draft_round", "draft_overall", "league_now", "team_now", "gp_now",
        "nhl_gp_now", "nhl_gs_now", "contract_status", "rights_expire", "moved_this_season", "stops_this_season",
        "moved_on", "agent", "agency", "agent_source_url", "in_feed_list", "note", "as_of", "source_url",
        "source_class"])

    # staff.csv: hand-researched rows, unchanged.
    staff = [r for p in sorted(glob.glob(str(args.notes / "staff_*.csv"))) for r in read(p)]
    for r in staff:
        if "/" in r["role_group"] and "Development" in r["role_group"]:
            r["role_group"] = "Director of Goaltending Development"
        elif r["role_group"].startswith("Goaltending Consultant"):
            r["role_group"] = "Goaltending Consultant / Video"
    # Later batches fill gaps the first pass left as placeholders: drop an unconfirmed placeholder
    # wherever a confirmed or none_listed row now covers the same club, season and role.
    covered = {(r["club"], r["season"], r["role_group"]) for r in staff if r["status"] in ("confirmed", "none_listed")}
    staff = [r for r in staff if r["status"] in ("confirmed", "none_listed")
             or (r["club"], r["season"], r["role_group"]) not in covered]
    canon = {"director of goaltending development / goaltending development coach": "Director of Goaltending Development",
             "goaltending consultant or goalie-dedicated video/analytics staff": "Goaltending Consultant / Video",
             "goaltending consultant": "Goaltending Consultant / Video"}
    for r in staff:
        r["role_group"] = canon.get(r["role_group"].strip().lower(), r["role_group"].strip())
    seen_rows = set()
    staff = [r for r in staff if not ((k := tuple(r.get(c, "") for c in ("club", "season", "person", "role_group",
             "level", "status"))) in seen_rows or seen_rows.add(k))]
    for r in staff:
        r["as_of"] = as_of
    write(args.out, "staff.csv", staff, ["club", "season", "person", "title_exact", "role_group", "level",
          "start_season", "end_season", "status", "source_url", "source_date", "source_class", "background",
          "note", "as_of"])

    # contracts.csv and team-spend.csv.
    contracts = [r for p in sorted(glob.glob(str(args.notes / "contracts_*.csv"))) for r in read(p)]
    # A later batch can confirm a contract an earlier one left as an unconfirmed lead: drop the lead
    # when a row with a figure exists for the same goalie and an overlapping season or signing date.
    def overlaps(a, b):
        if a["signed_on"] and a["signed_on"][:7] == b["signed_on"][:7]:
            return True
        return bool(a["start_season"] and b["start_season"] and a["start_season"] <= (b["end_season"] or b["start_season"])
                    and b["start_season"] <= (a["end_season"] or a["start_season"]))
    contracts = [r for r in contracts if num(r["aav"]) or not any(
        num(o["aav"]) and norm(o["name"]) == norm(r["name"]) and (overlaps(r, o) or not r["start_season"])
        for o in contracts)]
    for r in contracts:
        r["as_of"] = as_of
        if "nhl.com" in r["source_url"]:
            r["reuse_allowed"] = "nhl-terms"  # NHL.com terms limit reuse to personal use
    cfields = ["player_id", "name", "club", "signed_on", "type", "term_years", "aav", "start_season",
               "end_season", "two_way", "retained", "buried", "source_url", "source_class", "reuse_allowed",
               "note", "as_of"]
    write(args.out, "contracts.csv", contracts, cfields)
    limits = {r["season"]: num(re.sub(r"[^0-9].*", "", r["upper_limit"])) for r in read(args.notes / "cap_limits.csv")}
    seasons = sorted({r["season"] for r in club_goalies})
    nhl_users = defaultdict(set)
    for r in club_goalies:
        nhl_users[(r["club"], r["season"])].add(norm(r["name"]))
    played = defaultdict(set)  # (last name, season) -> clubs he played NHL games for
    for r in club_goalies:
        played[(norm(r["name"].split()[-1]), r["season"])].add(r["club"])
    carried = defaultdict(list)  # (club, season) -> [(contract, share)]
    for c in contracts:
        if not (num(c["aav"]) and c["start_season"]):
            continue
        for s in seasons:
            if not c["start_season"] <= s <= (c["end_season"] or c["start_season"]):
                continue
            clubs = played.get((norm(c["name"].split()[-1]), s)) or {c["club"]}
            for club in clubs:  # a goalie traded mid-season is split evenly between his clubs (approximate)
                carried[(club, s)].append((c, 1 / len(clubs)))
    spend = []
    for club in sorted({r["club"] for r in club_goalies}):
        for s in seasons:
            covering = carried.get((club, s), [])
            total = sum(num(c["aav"]) * w for c, w in covering)
            nhl = sum(num(c["aav"]) * w for c, w in covering if norm(c["name"]) in nhl_users[(club, s)])
            used = len(nhl_users[(club, s)])
            known = {norm(c["name"]) for c, _ in covering} & nhl_users[(club, s)]
            spend.append({"club": club, "season": s, "goalie_cap_total": int(total) if covering else "",
                          "nhl_tandem_cap": int(nhl) if covering else "",
                          "outside_nhl_cap": int(total - nhl) if covering else "",
                          "upper_limit": int(limits[s]) if limits.get(s) else "",
                          "share_of_cap": f"{total / limits[s]:.4f}" if covering and limits.get(s) else "",
                          "nhl_goalies_used": used, "nhl_goalies_with_contract": len(known),
                          "complete": "yes" if used and len(known) == used else "no",
                          "note": "traded goalie split evenly between clubs" if any(w < 1 for _, w in covering) else "",
                          "as_of": as_of})
    for s in seasons:
        done = sorted((r for r in spend if r["season"] == s and r["complete"] == "yes"),
                      key=lambda r: -num(r["goalie_cap_total"]))
        for i, r in enumerate(done, 1):
            r["league_rank"] = i
    write(args.out, "team-spend.csv", spend, ["club", "season", "goalie_cap_total", "nhl_tandem_cap",
          "outside_nhl_cap", "upper_limit", "share_of_cap", "league_rank", "nhl_goalies_used",
          "nhl_goalies_with_contract", "complete", "note", "as_of"])

    # pipeline.csv: drafted goalies who reached the NHL, and with whom.
    teams = read(DEPT / "teams.csv")
    names = defaultdict(set)
    for t in teams:
        names[t["club"]].add(t["team_name"])
    names["ARI"] |= {"Phoenix Coyotes", "Arizona Coyotes"}
    names["WPG"] |= {"Atlanta Thrashers"}  # the franchise moved to Winnipeg in 2011
    pipeline = []
    for d in drafts:
        if not d["first_nhl_season"]:
            continue
        pipeline.append({**d, "with_draft_club": "yes" if any(n in d["nhl_clubs"] for n in names.get(d["club"], ()))
                         else "no", "years_to_nhl": int(d["first_nhl_season"][:4]) - int(d["draft_year"])})
    write(args.out, "pipeline.csv", pipeline, ["draft_year", "club", "round", "overall", "name", "player_id",
          "first_ahl_season", "first_nhl_season", "years_to_nhl", "nhl_gp", "nhl_clubs", "with_draft_club",
          "as_of", "source"])

    # development.csv: researched program components plus components counted from the feed.
    dev = [r for p in sorted(glob.glob(str(args.notes / "programs_*.csv"))) for r in read(p)]
    for club in sorted(k for k in names if any(t["club"] == k and t["season"] == seasons[-1] for t in teams)):
        six = [d for d in drafts if d["club"] == club and int(d["draft_year"]) in SIX_DRAFTS]
        rounds = Counter(int(d["round"]) for d in six)
        reached = [p for p in pipeline if p["club"] == club and p["with_draft_club"] == "yes"]
        staff_now = {r["person"] for r in staff if r["club"] == club and r["season"] == "2026-27"
                     and r["status"] == "confirmed" and r["person"]}
        feed = f"https://api-web.nhle.com/v1/draft/picks/<year>/all"
        dev += [
            {"club": club, "component": "goalies_drafted_6y", "value": len(six), "unit": "goalies, 2021-2026 drafts",
             "evidence_url": feed, "note": "rounds " + ", ".join(f"R{k}:{v}" for k, v in sorted(rounds.items()))},
            {"club": club, "component": "mean_draft_round_6y",
             "value": f"{sum(int(d['round']) for d in six) / len(six):.1f}" if six else "",
             "unit": "round", "evidence_url": feed, "note": ""},
            {"club": club, "component": "own_draftees_reached_nhl_2010_2026", "value": len(reached),
             "unit": "goalies", "evidence_url": "https://api-web.nhle.com/v1/player/<id>/landing",
             "note": "drafted by the club and played an NHL regular-season game for it"},
            {"club": club, "component": "median_years_draft_to_nhl",
             "value": sorted(p["years_to_nhl"] for p in reached)[len(reached) // 2] if reached else "",
             "unit": "years", "evidence_url": "https://api-web.nhle.com/v1/player/<id>/landing", "note": ""},
            {"club": club, "component": "goalie_staff_confirmed_now", "value": len(staff_now), "unit": "people",
             "evidence_url": "staff.csv", "note": "confirmed 2026-27 goaltending staff; a lower bound"},
        ]
    for r in dev:
        r["as_of"] = as_of
    write(args.out, "development.csv", dev, ["club", "component", "value", "unit", "evidence_url", "note", "as_of"])

    # sources.csv: the terms checks, plus every other URL the files cite.
    sources = read(args.notes / "sources_terms.csv")
    seen = {s["url"] for s in sources}
    for rows, kind in ((staff, "staff"), (contracts, "contract")):
        for r in rows:
            u = r.get("source_url", "")
            for url in re.findall(r"https?://\S+", u):
                url = url.rstrip(";,)")
                if url not in seen:
                    seen.add(url)
                    sources.append({"url": url, "publisher": re.sub(r"^https?://(www\.)?([^/]+).*", r"\2", url),
                                    "read_on": r.get("source_date", "") or as_of, "kind": kind,
                                    "terms_checked": "", "reuse_allowed": "", "note": ""})
    for url, pub, kind in ((("https://api-web.nhle.com/v1", "NHL", "feed"),
                            ("https://data.naturalstattrick.com", "Natural Stat Trick", "keyed data"))):
        if url not in seen:
            sources.append({"url": url, "publisher": pub, "read_on": as_of, "kind": kind, "terms_checked": "",
                            "reuse_allowed": "", "note": ""})
    write(args.out, "sources.csv", sources, ["url", "publisher", "read_on", "kind", "terms_checked",
          "reuse_allowed", "note"])


if __name__ == "__main__":
    main()
