"""Context-weighted goalie metric study: build and test each layer against plain GSAx.

Reads the tables pull.py writes and writes results.json, summary.md and CSVs to --out.

Layers (each tested separately, then together):
  base     shot location, angle, type, rebound, rush, cross-ice, manpower, score state, period
  shooter  the shooter's finishing talent (prior goals over prior expected goals, shrunk) and prior points per game
  opp      the shooting team's prior finishing and shot generation; the defending team's prior xG against
  b2b      second night of a back-to-back for either team, and whether the goalie also played the night before
Importance is kept apart from difficulty: the impact-weighted view multiplies each shot's goals-saved value by how
much a goal would have moved the defending team's win probability.

Everything that describes a player or team uses only games before the shot's game (no leakage).
"""
import argparse, json, os
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss, brier_score_loss

SEASONS = [2021, 2022, 2023, 2024, 2025]
TEST = [2023, 2024, 2025]      # walk-forward: each test season is fit on the seasons before it
TYPES = ["wrist", "snap", "slap", "backhand", "tip-in", "deflected", "wrap-around"]


def load(d):
    shots = pd.read_csv(os.path.join(d, "shots.csv"))
    games = pd.read_csv(os.path.join(d, "games.csv"))
    points = pd.read_csv(os.path.join(d, "points.csv"))
    dressed = pd.read_csv(os.path.join(d, "dressed.csv"))
    shots["date"] = pd.to_datetime(shots["date"]); games["date"] = pd.to_datetime(games["date"])
    points["date"] = pd.to_datetime(points["date"])
    shots = shots.sort_values(["date", "game", "gsec"]).reset_index(drop=True)
    return shots, games, points, dressed


# ---------- base shot features ----------
def base_features(s):
    X = pd.DataFrame(index=s.index)
    dist = np.hypot(89 - s.x, s.y).clip(1, 100)
    ang = np.degrees(np.arctan2(s.y.abs(), (89 - s.x).abs().clip(0.1)))
    for lo, hi in [(0, 10), (10, 20), (20, 30), (30, 40), (40, 55)]:
        X[f"d{lo}"] = ((dist >= lo) & (dist < hi)).astype(float)
    X["logd"] = np.log(dist)
    X["ang"] = ang / 90
    X["ang2"] = (ang / 90) ** 2
    X["behind"] = (s.x > 89).astype(float)
    for t in TYPES:
        X[f"t_{t}"] = (s.type == t).astype(float)
    for c in ["reb", "rush", "cross"]:
        X[c] = s[c].astype(float)
    adv = s.shooters - s.defenders
    X["pp"] = (adv > 0).astype(float); X["sh"] = (adv < 0).astype(float)
    X["ev_other"] = ((adv == 0) & (s.shooters < 5)).astype(float)
    sd = s.score_diff.clip(-3, 3)
    X["lead"] = (sd > 0).astype(float); X["trail"] = (sd < 0).astype(float)
    X["p3"] = (s.period == 3).astype(float); X["ot"] = (s.period > 3).astype(float)
    return X


def fit_predict(X, y, train, test, C=1.0):
    m = LogisticRegression(C=C, max_iter=2000)
    m.fit(X[train], y[train])
    return m.predict_proba(X[test])[:, 1], m


def crossfit_xg(s, X):
    """Base xG for every shot from a model fit on the other seasons (used only to build talent priors)."""
    xg = np.zeros(len(s))
    for season in SEASONS:
        te = (s.season == season).values
        p, _ = fit_predict(X, s.goal.values, ~te, te)
        xg[te] = p
    return xg


# ---------- leakage-free priors ----------
def prior_by_game(s, key, cols):
    """For each shot, cumulative sums of cols over the key's earlier games (not this game)."""
    g = s.groupby([key, "date", "game"], sort=False)[cols].sum().reset_index().sort_values([key, "date", "game"])
    for c in cols:
        g[f"cum_{c}"] = g.groupby(key)[c].cumsum() - g[c]
    return s.merge(g[[key, "game"] + [f"cum_{c}" for c in cols]], on=[key, "game"], how="left")


def shooter_layer(s, points, dressed, games, k=60.0):
    s = prior_by_game(s, "shooter", ["goal", "xg0"]).rename(columns={"cum_goal": "sh_g", "cum_xg0": "sh_xg"})
    # shrunk finishing: (G + k) / (xG + k), on the log scale; k is in expected goals
    s["fin"] = np.log((s.sh_g + k) / (s.sh_xg + k))
    # prior points per game from goals and assists, over prior games dressed
    pts = pd.concat([points[["game", "date", c]].rename(columns={c: "player"}) for c in ["scorer", "a1", "a2"]])
    pts = pts.dropna(subset=["player"]); pts = pts[pts.player != ""]
    pts["player"] = pts.player.astype(float).astype(int)
    pts = pts.groupby(["player", "game", "date"]).size().rename("pts").reset_index()
    gd = dressed.merge(pts[["player", "game", "pts"]], on=["player", "game"], how="left").fillna({"pts": 0})
    gd = gd.merge(games[["game", "date"]], on="game", how="inner")
    gd = gd.sort_values(["player", "date", "game"])
    gd["cum_pts"] = gd.groupby("player").pts.cumsum() - gd.pts
    gd["cum_gp"] = gd.groupby("player").cumcount()
    s = s.merge(gd[["player", "game", "cum_pts", "cum_gp"]].rename(columns={"player": "shooter"}), on=["shooter", "game"], how="left")
    s["ppg"] = (s.cum_pts.fillna(0) + 0.4 * 20) / (s.cum_gp.fillna(0) + 20)    # shrunk toward 0.4 over 20 games
    return s


def team_layer(s):
    # shooting team: prior finishing (G - xG per shot) and prior xG per game, this season only
    s["steam_season"] = s.steam + "_" + s.season.astype(str)
    s["gteam_season"] = s.gteam + "_" + s.season.astype(str)
    s["one"] = 1.0
    s = prior_by_game(s, "steam_season", ["goal", "xg0", "one"])
    s = s.rename(columns={"cum_goal": "st_g", "cum_xg0": "st_xg", "cum_one": "st_n"})
    gp = s.groupby(["steam_season", "date", "game"]).size().reset_index().sort_values(["steam_season", "date"])
    gp["st_gp"] = gp.groupby("steam_season").cumcount()
    s = s.merge(gp[["steam_season", "game", "st_gp"]], on=["steam_season", "game"])
    s = prior_by_game(s, "gteam_season", ["xg0"]).rename(columns={"cum_xg0": "gt_xga"})
    gp2 = s.groupby(["gteam_season", "date", "game"]).size().reset_index().sort_values(["gteam_season", "date"])
    gp2["gt_gp"] = gp2.groupby("gteam_season").cumcount()
    s = s.merge(gp2[["gteam_season", "game", "gt_gp"]], on=["gteam_season", "game"])
    k = 10.0
    lg_xg_pg = s.groupby("season").apply(lambda d: d.xg0.sum() / d.game.nunique() / 2).rename("lg").reset_index()
    s = s.merge(lg_xg_pg, on="season")
    s["opp_fin"] = (s.st_g - s.st_xg) / (s.st_n + 300)                        # shrunk per-shot finishing residual
    s["opp_gen"] = np.log(((s.st_xg + k * s.lg) / (s.st_gp + k)) / s.lg)      # shot generation vs league
    s["own_def"] = np.log(((s.gt_xga + k * s.lg) / (s.gt_gp + k)) / s.lg)     # own team xG against vs league
    return s


def b2b_layer(s, games):
    tg = pd.concat([games[["game", "date", "home"]].rename(columns={"home": "team"}),
                    games[["game", "date", "away"]].rename(columns={"away": "team"})]).sort_values(["team", "date"])
    tg["prev"] = tg.groupby("team").date.shift(1)
    tg["b2b"] = ((tg.date - tg.prev).dt.days == 1).astype(float)
    s = s.merge(tg[["team", "game", "b2b"]].rename(columns={"team": "gteam", "b2b": "def_b2b"}), on=["gteam", "game"], how="left")
    s = s.merge(tg[["team", "game", "b2b"]].rename(columns={"team": "steam", "b2b": "off_b2b"}), on=["steam", "game"], how="left")
    s[["def_b2b", "off_b2b"]] = s[["def_b2b", "off_b2b"]].fillna(0.0)
    # did this goalie face a shot the day before?
    gd = s[["goalie", "date"]].drop_duplicates()
    played = set(zip(gd.goalie, gd.date))
    s["g_b2b"] = [float((g, d - pd.Timedelta(days=1)) in played) for g, d in zip(s.goalie, s.date)]
    return s


# ---------- win probability for importance ----------
def wp_model(s, games):
    """Defending team's win probability from score difference and time left, fit on all shot moments."""
    g = games.set_index("game")
    home_win = (g.home_score > g.away_score)
    d = s[["game", "gsec", "score_diff", "goalie_home"]].copy()
    d["def_diff"] = -d.score_diff
    d["def_win"] = [float(home_win.get(gm, np.nan) == bool(h)) for gm, h in zip(d.game, d.goalie_home)]
    d["left"] = (3600 - d.gsec).clip(0, 3600) / 3600
    def feats(diff, left, home):
        diff = np.clip(diff, -4, 4)
        return np.column_stack([diff, diff / np.sqrt(left + 0.02), home])
    m = LogisticRegression(max_iter=1000).fit(feats(d.def_diff, d.left, d.goalie_home), d.def_win)
    now = m.predict_proba(feats(d.def_diff, d.left, d.goalie_home))[:, 1]
    after = m.predict_proba(feats(d.def_diff - 1, d.left, d.goalie_home))[:, 1]
    lev = now - after
    lev[s.period.values > 3] = now[s.period.values > 3]          # an overtime goal ends the game
    return np.clip(lev, 0.001, 1)


# ---------- evaluation ----------
LAYERS = {
    "base": [],
    "shooter": ["fin", "ppg"],
    "shooter_fin_only": ["fin"],
    "shooter_ppg_only": ["ppg"],
    "opp": ["opp_fin", "opp_gen", "own_def"],
    "b2b": ["def_b2b", "off_b2b", "g_b2b"],
    "all": ["fin", "ppg", "opp_fin", "opp_gen", "own_def", "def_b2b", "off_b2b", "g_b2b"],
}


def corr(a, b):
    a, b = np.asarray(a, float), np.asarray(b, float)
    ok = ~(np.isnan(a) | np.isnan(b))
    return float(np.corrcoef(a[ok], b[ok])[0, 1]) if ok.sum() > 5 else None


def boot_corr(a, b, n=1000, seed=1):
    a, b = np.asarray(a, float), np.asarray(b, float)
    r = np.random.default_rng(seed); idx = np.arange(len(a)); out = []
    for _ in range(n):
        i = r.choice(idx, len(idx)); out.append(np.corrcoef(a[i], b[i])[0, 1])
    return [float(np.nanpercentile(out, 2.5)), float(np.nanpercentile(out, 97.5))]


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--data", default="out"); ap.add_argument("--out", default="results")
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    s, games, points, dressed = load(a.data)
    s = s[s.shooter.notna() & (s.shooter != "")].copy()
    s["shooter"] = s.shooter.astype(float).astype(int)
    X0 = base_features(s)
    s["xg0"] = crossfit_xg(s, X0)
    s = shooter_layer(s, points, dressed, games)
    s = team_layer(s)
    s = b2b_layer(s, games)
    s = s.sort_values(["date", "game", "gsec"]).reset_index(drop=True)
    X0 = base_features(s)
    R = {"n_shots": int(len(s)), "n_goals": int(s.goal.sum()), "seasons": SEASONS, "layers": {}}

    # 1. walk-forward fit: how much does each layer improve prediction of goals on unseen seasons?
    preds = {}
    for name, extra in LAYERS.items():
        X = pd.concat([X0, s[extra].astype(float).fillna(0)], axis=1) if extra else X0
        xs, rows, coefs = np.zeros(len(s)) * np.nan, [], {}
        for t in TEST:
            tr, te = (s.season < t).values, (s.season == t).values
            p, m = fit_predict(X.values, s.goal.values, tr, te)
            xs[te] = p
            rows.append({"season": t, "logloss": log_loss(s.goal[te], p), "brier": brier_score_loss(s.goal[te], p)})
            coefs = dict(zip(X.columns[-len(extra):], m.coef_[0][-len(extra):])) if extra else {}
        preds[name] = xs
        R["layers"][name] = {"by_season": rows, "logloss": float(np.mean([r["logloss"] for r in rows])),
                             "coef_last_fit": {k: float(v) for k, v in coefs.items()}}
    base_ll = R["layers"]["base"]["logloss"]
    for name in LAYERS:
        R["layers"][name]["logloss_gain_vs_base_pct"] = 100 * (base_ll - R["layers"][name]["logloss"]) / base_ll

    # calibration of base and all, by decile
    te = s.season.isin(TEST).values
    cal = []
    for name in ["base", "all"]:
        p = preds[name][te]; y = s.goal.values[te]
        q = pd.qcut(p, 10, labels=False, duplicates="drop")
        for b in sorted(set(q)):
            cal.append({"model": name, "bin": int(b), "pred": float(p[q == b].mean()), "obs": float(y[q == b].mean()), "n": int((q == b).sum())})
    pd.DataFrame(cal).to_csv(os.path.join(a.out, "calibration.csv"), index=False)

    # 2. importance (kept apart from difficulty)
    s["lev"] = wp_model(s, games)
    s["lev_w"] = s.lev / s.lev[te].mean()
    lev_by_state = s[te].copy()
    lev_by_state["state"] = np.where(lev_by_state.shooters > lev_by_state.defenders, "opp PP",
                                     np.where(lev_by_state.shooters < lev_by_state.defenders, "opp SH", "even"))
    R["importance_by_manpower"] = lev_by_state.groupby("state").lev_w.mean().round(3).to_dict()
    R["importance_by_period_score"] = (lev_by_state.assign(sd=(-lev_by_state.score_diff).clip(-2, 2))
                                       .groupby(["period", "sd"]).lev_w.mean().round(3).reset_index()
                                       .query("period <= 4").to_dict(orient="records"))

    # 3. goalie metrics on test seasons
    T = s[te].copy()
    for name in ["base", "shooter", "opp", "b2b", "all"]:
        T[f"gs_{name}"] = preds[name][te] - T.goal
    T["gs_impact"] = T.gs_all * T.lev_w
    T["gs_impact_base"] = T.gs_base * T.lev_w
    T["half"] = (T.game % 2)
    agg = {f"gs_{n}": "sum" for n in ["base", "shooter", "opp", "b2b", "all", "impact", "impact_base"]}
    gs = T.groupby(["goalie", "season"]).agg(shots=("goal", "size"), ga=("goal", "sum"), **{k: (k, v) for k, v in agg.items()}).reset_index()
    gs["name"] = gs.goalie.map(dressed.drop_duplicates("player").set_index("player").name)
    gs.to_csv(os.path.join(a.out, "goalie_seasons.csv"), index=False)

    # reliability: odd vs even games, per shot, goalie-seasons with 600+ shots per half
    rel = {}
    halves = T.groupby(["goalie", "season", "half"]).agg(n=("goal", "size"), **{k: (k, "sum") for k in agg}).reset_index()
    for k in agg:
        h = halves.pivot_table(index=["goalie", "season"], columns="half", values=[k, "n"])
        h = h[(h["n"][0] >= 400) & (h["n"][1] >= 400)]
        x, y = h[k][0] / h["n"][0], h[k][1] / h["n"][1]
        rel[k] = {"r": corr(x, y), "ci": boot_corr(x.values, y.values), "n_goalie_seasons": int(len(h))}
    R["split_half"] = rel

    # year over year and next-season prediction (per shot), goalies with 800+ shots in both seasons
    yoy = {}
    nxt = gs.merge(gs, on="goalie", suffixes=("", "_n"))
    nxt = nxt[(nxt.season_n == nxt.season + 1) & (nxt.shots >= 800) & (nxt.shots_n >= 800)]
    for k in agg:
        x = nxt[k] / nxt.shots
        yoy[k] = {"same_metric_r": corr(x, nxt[f"{k}_n"] / nxt.shots_n),
                  "predicts_next_base_gsax_r": corr(x, nxt["gs_base_n"] / nxt.shots_n),
                  "predicts_next_sv_pct_r": corr(x, 1 - nxt.ga_n / nxt.shots_n),
                  "n_pairs": int(len(nxt))}
    R["year_over_year"] = yoy

    # 4. back-to-backs: shot quality against (defence) vs goalie result given shot quality
    tgm = T.groupby(["gteam", "game", "season"]).agg(xga=("xg0", "sum"), shots=("goal", "size"), ga=("goal", "sum"),
                                                    def_b2b=("def_b2b", "max"), off_b2b=("off_b2b", "max"),
                                                    home=("goalie_home", "max")).reset_index()
    tgm["xg_per_shot"] = tgm.xga / tgm.shots
    tgm["team_mean_xga"] = tgm.groupby(["gteam", "season"]).xga.transform("mean")
    tgm["team_mean_xps"] = tgm.groupby(["gteam", "season"]).xg_per_shot.transform("mean")
    b = {}
    for flag in [0, 1]:
        d = tgm[tgm.def_b2b == flag]
        b[f"def_b2b={flag}"] = {"games": int(len(d)), "xga_vs_team_mean": float((d.xga - d.team_mean_xga).mean()),
                                "xg_per_shot_vs_team_mean": float((d.xg_per_shot - d.team_mean_xps).mean()),
                                "shots": float(d.shots.mean())}
    # goalie: per shot goals saved above base xG, by goalie rest and team rest
    T["g_state"] = np.where(T.g_b2b == 1, "goalie also played last night",
                            np.where(T.def_b2b == 1, "team on b2b, rested goalie", "team rested"))
    gstate = T.groupby("g_state").agg(shots=("goal", "size"), sv=("goal", lambda g: 1 - g.mean()),
                                      xsv=("xg0", lambda x: 1 - x.mean()), gsax_per_100=("gs_base", lambda v: 100 * v.mean())).reset_index()
    # bootstrap the per-100 gap by game
    def gap_ci(d1, d2, n=500):
        r = np.random.default_rng(2); g1 = d1.groupby("game").gs_base.agg(["sum", "size"]); g2 = d2.groupby("game").gs_base.agg(["sum", "size"]); out = []
        for _ in range(n):
            a1 = g1.sample(len(g1), replace=True, random_state=int(r.integers(10**9))); a2 = g2.sample(len(g2), replace=True, random_state=int(r.integers(10**9)))
            out.append(100 * (a1["sum"].sum() / a1["size"].sum() - a2["sum"].sum() / a2["size"].sum()))
        return [float(np.percentile(out, 2.5)), float(np.percentile(out, 97.5))]
    R["b2b_team_defence"] = b
    R["b2b_goalie"] = gstate.round(4).to_dict(orient="records")
    R["b2b_goalie_gap_ci_per100"] = {
        "goalie_tired_minus_rested": gap_ci(T[T.g_b2b == 1], T[T.def_b2b == 0]),
        "team_b2b_rested_goalie_minus_team_rested": gap_ci(T[(T.def_b2b == 1) & (T.g_b2b == 0)], T[T.def_b2b == 0])}

    # 5. biggest movers, last season
    last = gs[(gs.season == TEST[-1]) & (gs.shots >= 800)].copy()
    last["move"] = last.gs_all - last.gs_base
    nm = dressed.drop_duplicates("player").set_index("player").name
    last["name"] = last.goalie.map(nm)
    last.sort_values("move").to_csv(os.path.join(a.out, "movers_last_season.csv"), index=False)
    R["movers_last_season_top"] = last.sort_values("move", ascending=False).head(10)[["name", "shots", "gs_base", "gs_all", "move"]].round(2).to_dict(orient="records")
    R["movers_last_season_bottom"] = last.sort_values("move").head(10)[["name", "shots", "gs_base", "gs_all", "move"]].round(2).to_dict(orient="records")

    # shooter talent sanity: how spread out is the shrunk finishing multiplier among shots taken?
    R["shooter_fin_multiplier_pctiles"] = {q: float(np.exp(np.nanpercentile(s.fin, q))) for q in [5, 25, 50, 75, 95]}
    R["opp_layer_pctiles"] = {c: [float(np.nanpercentile(s[c], q)) for q in [5, 50, 95]] for c in ["opp_fin", "opp_gen", "own_def"]}

    json.dump(R, open(os.path.join(a.out, "results.json"), "w"), indent=1, default=float)
    print(json.dumps({k: R[k] for k in ["n_shots", "n_goals"]}), {n: round(v["logloss_gain_vs_base_pct"], 3) for n, v in R["layers"].items()})


if __name__ == "__main__":
    main()
