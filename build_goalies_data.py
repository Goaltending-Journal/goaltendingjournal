"""Refresh goalies-data.js with the current season's totals from the NHL stats feed.

Run by .github/workflows/update-goalie-stats.yml every morning, or by hand:

  python build_goalies_data.py

Only the current season is re-downloaded (api.nhle.com/stats/rest goalie summary,
regular season). Earlier seasons and the QuantHockey line (qh) are
kept as they are. A goalie who appears for the first time gets his bio from the
same feed's goalie bios table. Uses only the standard library.

  --summary FILE --bios FILE   read saved feed JSON instead of downloading (for testing)
"""

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
OUT = HERE / "goalies-data.js"
FEED = "https://api.nhle.com/stats/rest/en/goalie/{table}"
HEADER = ("/* NHL goaltender snapshot used by goalies.html. Season totals and bios: "
          "NHL stats feed (api.nhle.com). qh = QuantHockey 2026-27 line. */\n")


def current_season(today):
    """NHL seasons start in the autumn: October 2026 is 2026-27."""
    start = today.year if today.month >= 9 else today.year - 1
    return f"{start}{start + 1}", f"{start}-{str(start + 1)[2:]}"


def fetch(table, season_id):
    query = urllib.parse.urlencode({
        "limit": -1,
        "cayenneExp": f"seasonId={season_id} and gameTypeId=2",
    })
    req = urllib.request.Request(FEED.format(table=table) + "?" + query,
                                 headers={"User-Agent": "goaltendingjournal-stats-bot"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)["data"]


def load_rows(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return data["data"] if isinstance(data, dict) else data


def load_snapshot():
    text = OUT.read_text(encoding="utf-8")
    return json.loads(re.search(r"=\s*(\{.*\})\s*;?\s*$", text, re.S).group(1))


def season_line(row):
    return {
        "team": row["teamAbbrevs"],
        "gp": row["gamesPlayed"],
        "w": row["wins"],
        "l": row["losses"],
        "otl": row["otLosses"],
        "gaa": round(row["goalsAgainstAverage"] or 0, 2),
        "svp": round(row["savePct"] or 0, 3),
        "so": row["shutouts"],
        "gs": row["gamesStarted"],
        "ga": row["goalsAgainst"],
        "sv": row["saves"],
        "sa": row["shotsAgainst"],
        "toi": row["timeOnIce"],
    }


def new_goalie(row, bio):
    draft = None
    if bio.get("draftYear"):
        draft = f"{bio['draftYear']} · Rd {bio['draftRound']} · #{bio['draftOverall']}"
    return {
        "id": row["playerId"],
        "name": row["goalieFullName"],
        "team": "",
        "catches": row.get("shootsCatches") or bio.get("shootsCatches"),
        "born": bio.get("birthDate"),
        "nat": bio.get("nationalityCode"),
        "ht": bio.get("height"),
        "wt": bio.get("weight"),
        "draft": draft,
        "seasons": {},
        "qh": None,
    }


def last_name_key(g):
    return (g["name"].split(" ", 1)[-1].lower(), g["name"].lower())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--summary")
    ap.add_argument("--bios")
    args = ap.parse_args()

    today = datetime.now(ZoneInfo("America/New_York")).date()
    season_id, label = current_season(today)
    rows = load_rows(args.summary) if args.summary else fetch("summary", season_id)
    if not rows:
        sys.exit(f"The NHL feed returned no goalies for {label}; leaving goalies-data.js alone.")

    data = load_snapshot()
    by_id = {g["id"]: g for g in data["goalies"]}
    new_ids = [r["playerId"] for r in rows if r["playerId"] not in by_id]
    bios = {}
    if new_ids:
        bio_rows = load_rows(args.bios) if args.bios else fetch("bios", season_id)
        bios = {b["playerId"]: b for b in bio_rows}

    for row in rows:
        g = by_id.get(row["playerId"])
        if g is None:
            g = by_id[row["playerId"]] = new_goalie(row, bios.get(row["playerId"], {}))
            data["goalies"].append(g)
        g["seasons"][label] = season_line(row)
        g["team"] = row["teamAbbrevs"].split(",")[-1]

    data["goalies"].sort(key=last_name_key)
    data["asOf"] = today.isoformat()
    OUT.write_text(HEADER + "window.GOALIE_DATA = "
                   + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
                   encoding="utf-8")
    print(f"{label}: {len(rows)} goalies from the NHL feed, {len(new_ids)} new; asOf {data['asOf']}.")


if __name__ == "__main__":
    main()
