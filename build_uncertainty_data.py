"""Build goalies-uncertainty-data.js for the "How sure are we?" panels on goalies.html.

Reads what the morning stats run has already saved (goalies-data.js and the
Natural Stat Trick table in data/nst/), so it needs no download and no extra packages:

  python build_uncertainty_data.py

Save %: empirical-Bayes beta-binomial shrinkage. The prior is the league save %
with a between-goalie spread estimated from goalies with MIN_PRIOR_SHOTS+ shots
in PRIOR_SEASON (observed variance minus the variance luck alone would give).
Early seasons reuse that spread, centred on their own league rate. Each goalie
gets a posterior mean and a 90% interval.

Goals saved vs expected (GSAx): Natural Stat Trick's expected goals against
minus goals allowed (all situations, season to date), with an approximate 90% interval of
+/- 1.645 * sqrt(xGA). Per-shot probabilities are not stored, so sqrt(xGA) is
used as an upper bound on the spread of goals given xG.

The plan behind these choices is in analysis/save-pct-uncertainty-plan.md.
"""

import csv
import json
import math
import re
import unicodedata
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
NST_DIR = HERE / "data" / "nst"
NST_TEAMS = {"L.A": "LAK", "N.J": "NJD", "S.J": "SJS", "T.B": "TBL"}  # NST's dotted codes to the NHL's
OUT = HERE / "goalies-uncertainty-data.js"
SEASONS = ["2025-26", "2026-27"]  # 2024-25 has no shot counts in the snapshot
PRIOR_SEASON = "2025-26"
MIN_PRIOR_SHOTS = 500
LEVEL = 0.90
Z90 = 1.6449


def load_js(name: str) -> dict:
    text = (HERE / name).read_text(encoding="utf-8")
    return json.loads(re.search(r"=\s*(\{.*\})\s*;?\s*$", text, re.S).group(1))


def betacf(a: float, b: float, x: float) -> float:
    """Continued fraction for the incomplete beta function (modified Lentz)."""
    tiny, qab, qap, qam = 1e-300, a + b, a + 1, a - 1
    c, d = 1.0, 1 - qab * x / qap
    d = 1 / (d if abs(d) > tiny else tiny)
    h = d
    for m in range(1, 400):
        m2 = 2 * m
        for aa in (m * (b - m) * x / ((qam + m2) * (a + m2)),
                   -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))):
            d = 1 + aa * d
            d = 1 / (d if abs(d) > tiny else tiny)
            c = 1 + aa / c
            c = c if abs(c) > tiny else tiny
            h *= d * c
        if abs(d * c - 1) < 1e-12:
            break
    return h


def beta_cdf(x: float, a: float, b: float) -> float:
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    lbt = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log(1 - x)
    if x < (a + 1) / (a + b + 2):
        return math.exp(lbt) * betacf(a, b, x) / a
    return 1 - math.exp(lbt) * betacf(b, a, 1 - x) / b


def beta_ppf(q: float, a: float, b: float) -> float:
    lo, hi = 0.0, 1.0
    for _ in range(80):
        mid = (lo + hi) / 2
        if beta_cdf(mid, a, b) < q:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def season_lines(data: dict, season: str) -> list:
    out = []
    for g in data["goalies"]:
        s = g["seasons"].get(season)
        if s and s.get("sa"):
            # Goals on shots = shots - saves. The feed's GA can be 1-2 higher (goals with no recorded shot).
            out.append({"id": g["id"], "sv": s["sv"], "ga": s["sa"] - s["sv"], "sa": s["sa"]})
    return out


def spread(lines: list) -> tuple:
    """League rate, and between-goalie variance of true save % by method of moments."""
    p = sum(r["sv"] for r in lines) / sum(r["sa"] for r in lines)
    big = [r for r in lines if r["sa"] >= MIN_PRIOR_SHOTS]
    w = sum(r["sa"] for r in big)
    obs = sum(r["sa"] * (r["sv"] / r["sa"] - p) ** 2 for r in big) / w
    luck = p * (1 - p) * len(big) / w  # shot-weighted mean of the binomial variance p(1-p)/n_i
    return p, obs - luck, obs, luck, len(big)


def norm_name(n: str) -> str:
    n = unicodedata.normalize("NFD", n or "")
    return re.sub(r"[^a-z]", "", "".join(c for c in n if not unicodedata.combining(c)).lower())


def load_nst(data: dict) -> dict:
    """Season-to-date NST goalie table (all situations), with NHL ids matched by name."""
    summary = json.loads((NST_DIR / "summary.json").read_text(encoding="utf-8"))
    path = NST_DIR / summary["files"]["all"]["file"]
    ids = {norm_name(g["name"]): g["id"] for g in data["goalies"]}
    goalies = []
    with open(path, newline="", encoding="utf-8") as f:
        for i, r in enumerate(csv.DictReader(f)):
            try:
                xga, ga, sa = float(r["xG Against"]), int(r["Goals Against"]), int(r["Shots Against"])
            except (KeyError, ValueError):
                continue
            goalies.append({"id": ids.get(norm_name(r["Player"]), -(i + 1)), "name": r["Player"],
                            "team": NST_TEAMS.get(t := r["Team"].split(",")[-1].strip(), t), "gp": int(r["GP"]),
                            "toi": round(float(r["TOI"])), "sog": sa, "ga": ga, "xga": round(xga, 2)})
    y = summary["season"].split("-")
    return {"season": f"{y[0]}-{y[1][2:]}", "asOf": summary["fetched_at"][:10], "goalies": goalies}


def main() -> int:
    data = load_js("goalies-data.js")
    nst = load_nst(data)

    p0, tau2, obs, luck, n_big = spread(season_lines(data, PRIOR_SEASON))
    if tau2 <= 0:
        raise SystemExit(f"No skill spread left after removing luck in {PRIOR_SEASON}; check the data.")

    out = {"asOf": data["asOf"], "level": LEVEL, "priorSeason": PRIOR_SEASON,
           "priorShots": MIN_PRIOR_SHOTS, "priorGoalies": n_big, "seasons": {}}
    for season in SEASONS:
        lines = season_lines(data, season)
        p = sum(r["sv"] for r in lines) / sum(r["sa"] for r in lines)
        k = p * (1 - p) / tau2 - 1  # prior strength a + b, in shots
        a, b = p * k, (1 - p) * k
        goalies = {}
        for r in lines:
            pa, pb = a + r["sv"], b + r["ga"]
            goalies[r["id"]] = {
                "m": round(pa / (pa + pb), 4),
                "lo": round(beta_ppf((1 - LEVEL) / 2, pa, pb), 4),
                "hi": round(beta_ppf(1 - (1 - LEVEL) / 2, pa, pb), 4),
                # plain interval from this season's shots alone, for comparison
                "rlo": round(beta_ppf((1 - LEVEL) / 2, r["sv"] + .5, r["ga"] + .5), 4),
                "rhi": round(beta_ppf(1 - (1 - LEVEL) / 2, r["sv"] + .5, r["ga"] + .5), 4),
            }
        out["seasons"][season] = {"league": round(p, 4), "k": round(k), "sd": round(math.sqrt(tau2), 4),
                                  "goalies": goalies}
        print(f"{season}: league {p:.4f}, prior strength {k:.0f} shots, skill SD {math.sqrt(tau2):.4f}, {len(goalies)} goalies")

    xg, ga = sum(g["xga"] for g in nst["goalies"]), sum(g["ga"] for g in nst["goalies"])
    out["gsax"] = {
        "season": nst["season"], "asOf": nst["asOf"], "xga": round(xg, 1), "ga": ga,
        "goalies": [{**g, "v": round(g["xga"] - g["ga"], 2), "e": round(Z90 * math.sqrt(g["xga"]), 2)}
                    for g in nst["goalies"] if g["sog"] > 0],
    }
    print(f"GSAx {nst['season']} to {nst['asOf']} (Natural Stat Trick): xGA {xg:.1f} vs GA {ga} ({(xg - ga) / ga:+.1%})")
    print(f"Prior from {n_big} goalies with {MIN_PRIOR_SHOTS}+ shots in {PRIOR_SEASON}: "
          f"observed SD {math.sqrt(obs):.4f}, luck SD {math.sqrt(luck):.4f}")

    OUT.write_text(
        "/* Generated by build_uncertainty_data.py. Shrunk save % with intervals, and goals saved vs expected, for goalies.html. */\n"
        f"/* Built {date.today().isoformat()} from goalies-data.js ({data['asOf']}) and Natural Stat Trick ({nst['asOf']}). */\n"
        "window.GOALIE_UNCERTAINTY = " + json.dumps(out, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
