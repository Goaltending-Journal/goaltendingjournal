"""Cross-check the NHL stats feed against Natural Stat Trick, goalie by goalie.

Reads what the morning stats run has already saved (goalies-data.js and the Natural Stat Trick
table in data/nst/), so it needs no download:

  python check_sources.py

For every goalie this season it compares games played, shots against and goals against. Small gaps
are normal (the two sources count a few shots and brief relief appearances differently), so a goalie
is only flagged when goals against differ, shots against differ by more than SHOT_GAP, or the goalie
is missing from one source. Smaller gaps are listed as minor.

Writes data/checks/nhl-vs-nst.json (today's result) and appends one line to data/checks/history.csv,
so the monthly dreaming pass can look for anything that keeps standing out. Prints a GitHub Actions
warning when a goalie is flagged; it never fails the stats run.
"""

import csv
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from build_uncertainty_data import load_js, load_nst, norm_name

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE / "data" / "checks"
SHOT_GAP = 2


def main() -> int:
    data = load_js("goalies-data.js")
    nst = load_nst(data)
    season = nst["season"]
    nhl = {norm_name(g["name"]): (g["name"], g["team"], g["seasons"][season])
           for g in data["goalies"] if season in g["seasons"]}
    theirs = {norm_name(g["name"]): g for g in nst["goalies"]}

    flagged, minor, matched = [], [], 0
    for key, (name, team, s) in sorted(nhl.items()):
        n = theirs.get(key)
        if not n:
            flagged.append({"name": name, "team": team, "issue": "not in Natural Stat Trick"})
            continue
        gaps = {k: s[a] - n[b] for k, a, b in (("gp", "gp", "gp"), ("sa", "sa", "sog"), ("ga", "ga", "ga")) if s[a] != n[b]}
        if not gaps:
            matched += 1
            continue
        row = {"name": name, "team": team, "nhl": {"gp": s["gp"], "sa": s["sa"], "ga": s["ga"]},
               "nst": {"gp": n["gp"], "sa": n["sog"], "ga": n["ga"]}}
        (flagged if "ga" in gaps or abs(gaps.get("sa", 0)) > SHOT_GAP else minor).append(row)
    for key, n in sorted(theirs.items()):
        if key not in nhl:
            flagged.append({"name": n["name"], "team": n["team"], "issue": "not in the NHL feed"})

    today = datetime.now(ZoneInfo("America/New_York")).date().isoformat()
    result = {"checked": today, "season": season, "nhlAsOf": data["asOf"], "nstAsOf": nst["asOf"],
              "goalies": len(nhl), "matched": matched, "minor": minor, "flagged": flagged}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "nhl-vs-nst.json").write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    history = OUT_DIR / "history.csv"
    rows = list(csv.DictReader(open(history, encoding="utf-8"))) if history.exists() else []
    rows = [r for r in rows if r["checked"] != today]  # a re-run on the same day replaces that day's line
    rows.append({"checked": today, "season": season, "goalies": len(nhl), "matched": matched, "minor": len(minor),
                 "flagged": len(flagged), "flagged_names": "; ".join(f["name"] for f in flagged)})
    with open(history, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[-1]))
        w.writeheader()
        w.writerows(rows)

    print(f"{season}: {matched} of {len(nhl)} goalies match the NHL feed exactly, {len(minor)} minor gaps, {len(flagged)} flagged.")
    for f in flagged:
        print(f"::warning title=NHL vs Natural Stat Trick::{f['name']}: {f.get('issue') or json.dumps({'nhl': f['nhl'], 'nst': f['nst']})}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
