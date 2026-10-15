"""Validation checks for goalies-uncertainty-data.js. Prints a pass/fail report.

  python analysis/validate_uncertainty.py [--csv-dir DIR]

--csv-dir points at a folder holding the raw NHL stats exports s2026.csv and
s2027.csv (season end year in the name) to reconcile the snapshot against.
"""

import argparse
import csv
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_js(name):
    text = (ROOT / name).read_text(encoding="utf-8")
    return json.loads(re.search(r"=\s*(\{.*\})\s*;?\s*$", text, re.S).group(1))


def pearson(xs, ys):
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / math.sqrt(sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv-dir")
    args = ap.parse_args()
    data, unc, zones = load_js("goalies-data.js"), load_js("goalies-uncertainty-data.js"), load_js("goalies-zones-data.js")
    report = []

    # 1. Totals reconcile (snapshot internal consistency, and against raw exports if given).
    bad, noshot = [], []
    for g in data["goalies"]:
        for season, s in g["seasons"].items():
            if s.get("sa") is None:
                continue
            extra = s["sv"] + s["ga"] - s["sa"]
            if extra in (1, 2):  # goals the feed counts against the goalie with no recorded shot
                noshot.append(f"{g['name']} {season}: GA is {extra} more than shots - saves")
            elif extra:
                bad.append(f"{g['name']} {season}: sv+ga-sa = {extra}")
            if abs(round(s["sv"] / s["sa"], 3) - s["svp"]) > 0.0011:
                bad.append(f"{g['name']} {season}: svp {s['svp']} vs {s['sv'] / s['sa']:.4f}")
            if s.get("toi") and abs(s["ga"] * 3600 / s["toi"] - s["gaa"]) > 0.011:
                bad.append(f"{g['name']} {season}: gaa {s['gaa']} vs {s['ga'] * 3600 / s['toi']:.3f}")
    if args.csv_dir:
        for fname, season in (("s2026.csv", "2025-26"), ("s2027.csv", "2026-27")):
            with open(Path(args.csv_dir) / fname, newline="", encoding="utf-8") as f:
                raw = {int(r["playerId"]): r for r in csv.DictReader(f)}
            snap = {g["id"]: g["seasons"][season] for g in data["goalies"] if season in g["seasons"]}
            for pid in raw.keys() ^ snap.keys():
                bad.append(f"{season}: player {pid} in only one of snapshot / {fname}")
            for pid in raw.keys() & snap.keys():
                for k_raw, k_snap in (("shotsAgainst", "sa"), ("saves", "sv"), ("goalsAgainst", "ga"), ("gamesPlayed", "gp")):
                    if int(raw[pid][k_raw]) != snap[pid][k_snap]:
                        bad.append(f"{season} {pid}: {k_raw} {raw[pid][k_raw]} vs snapshot {snap[pid][k_snap]}")
    zone_vs_feed = []
    snap27 = {g["id"]: g["seasons"].get("2026-27") for g in data["goalies"]}
    for z in zones["goalies"]:
        s = snap27.get(z["id"])
        if s and s["gp"] == z["gp"] and abs(s["ga"] - z["ga"]) > 0:
            zone_vs_feed.append(f"{z['name']}: GA {z['ga']} (MoneyPuck file) vs {s['ga']} (NHL feed), both {z['gp']} GP")
    report.append(("Totals reconcile", "PASS" if not bad else "FAIL",
                   f"{len(bad)} mismatches in the snapshot" + (" and raw exports" if args.csv_dir else "")
                   + f"; {len(noshot)} goalie-seasons where GA exceeds shots - saves by 1-2 (goals with no recorded shot,"
                   " in the raw export too; save % uses shots - saves); play-by-play rebuild not run (endpoint blocked)", bad))
    report.append(("MoneyPuck file vs NHL feed (same GP)", "INFO", f"{len(zone_vs_feed)} goalies differ on GA", zone_vs_feed))

    # 2. xG calibration (league total only; per-shot xG is not stored, so no per-bin plot).
    xg, ga = unc["gsax"]["xga"], unc["gsax"]["ga"]
    report.append(("xG calibrated (league total)", "PASS" if abs(xg - ga) / ga <= .10 else "FAIL",
                   f"xGA {xg} vs GA {ga} ({(xg - ga) / ga:+.1%}); per-bin calibration not run (no per-shot xG stored)", []))

    # 3. Shrunk 2025-26 save % predicts 2026-27 better than raw 2025-26 save %.
    s26 = unc["seasons"]["2025-26"]["goalies"]
    rows = []
    for g in data["goalies"]:
        a, b = g["seasons"].get("2025-26"), g["seasons"].get("2026-27")
        if a and b and a.get("sa") and b.get("sa"):
            rows.append((a["sv"] / a["sa"], s26[str(g["id"])]["m"], b["sv"], b["ga"]))
    lg26 = unc["seasons"]["2025-26"]["league"]
    ll = lambda pick: sum(sv * math.log(min(pick(r), .9999)) + gl * math.log(1 - min(pick(r), .9999)) for r in rows for sv, gl in [(r[2], r[3])])
    ll_raw, ll_shr, ll_lg = ll(lambda r: r[0]), ll(lambda r: r[1]), ll(lambda r: lg26)
    shots = sum(r[2] + r[3] for r in rows)
    report.append(("Shrunk save % predicts better than raw", "PASS" if ll_shr > ll_raw else "FAIL",
                   f"{len(rows)} goalies, {shots} 2026-27 shots: log-lik shrunk {ll_shr:.1f}, raw {ll_raw:.1f}, league-only {ll_lg:.1f}", []))

    # Year-over-year reliability of raw save % (2024-25 to 2025-26, 30+ GP both).
    pairs = [(g["seasons"]["2024-25"]["svp"], g["seasons"]["2025-26"]["svp"]) for g in data["goalies"]
             if g["seasons"].get("2024-25", {}).get("gp", 0) >= 30 and g["seasons"].get("2025-26", {}).get("gp", 0) >= 30]
    report.append(("Year-over-year save % (30+ GP both)", "INFO", f"r = {pearson(*zip(*pairs)):.2f} over {len(pairs)} goalies", []))
    k = unc["seasons"]["2025-26"]["k"]
    report.append(("Reliability from the prior", "INFO",
                   f"skill share = n/(n+{k}): {1000 / (1000 + k):.2f} at 1,000 shots, {1500 / (1500 + k):.2f} at 1,500, 0.50 at {k}", []))

    report.append(("External models agree", "NOT RUN", "Natural Stat Trick / Evolving-Hockey not reachable; GSAx here is MoneyPuck's own xG", []))
    report.append(("Video confirms", "NOT RUN", "no shot-level locations rebuilt from play-by-play to sample", []))

    for name, status, why, detail in report:
        print(f"[{status}] {name}: {why}")
        for d in detail[:15]:
            print("    " + d)


if __name__ == "__main__":
    main()
