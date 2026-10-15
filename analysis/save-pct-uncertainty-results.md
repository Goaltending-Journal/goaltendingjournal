# Results: save % with uncertainty, and goals saved vs expected

Run 2026-10-15 against `goalies-data.js` (snapshot 2026-10-13) and `goalies-zones-data.js` (2026-09-29 to 2026-10-12, 89 games). Plan: `save-pct-uncertainty-plan.md`.

## Plain answer
Save % is mostly noise over a season. Across 2025-26 only about 37% of the gap between two goalies at 1,000 shots is skill, so only one goalie, Scott Wedgewood (COL, 1,093 shots, .921 actual, .906 estimated, 90% range .897 to .915), is clearly better than the league rate of .896, and nobody is clearly worse. Two weeks into 2026-27 it is too soon to rank anyone on save %.

## Key numbers

| Season | League SV% | Skill SD | Shots to reach 50% reliability | Goalies clearly above / below |
| --- | --- | --- | --- | --- |
| 2025-26 | .896 | .0074 | 1,688 | 1 / 0 |
| 2026-27 (to 2026-10-13) | .890 | .0074 (from 2025-26) | 1,768 | 0 / 0 |

Goals saved vs expected, 2026-27 to 2026-10-12, goalies with 50+ shots. Range is a rough 90% (±1.645·√xGA). With 45 goalies, about 4 or 5 would fall outside their range by luck alone, and 6 do.

| Goalie | Team | Shots | Minutes | GSAx | Range |
| --- | --- | --- | --- | --- | --- |
| Jesper Wallstedt | MIN | 163 | 363 | +7.0 | +0.0 to +14.0 |
| Linus Ullmark | OTT | 116 | 284 | +6.9 | +1.0 to +12.8 |
| Jake Oettinger | DAL | 81 | 242 | +6.5 | +1.5 to +11.6 |
| Devin Cooley | CGY | 55 | 120 | −4.3 | −8.3 to −0.4 |
| Dustin Wolf | CGY | 87 | 177 | −7.0 | −12.0 to −2.1 |
| Kevin Lankinen | VAN | 132 | 253 | −10.8 | −17.8 to −3.8 |

These describe what happened. They are not evidence of skill yet.

## Validation

| Check | Result | Why |
| --- | --- | --- |
| Totals reconcile | Pass (partial) | Snapshot shots, saves, goals and GP match the raw NHL stats exports (`s2026.csv`, `s2027.csv`) for every goalie. 23 goalie-seasons have GA 1 or 2 higher than shots − saves (goals with no recorded shot, also in the raw export), so save % uses shots − saves. Not rebuilt from play-by-play: the endpoint is blocked from the build environment. |
| xG calibrated | Pass (league total only) | League xGA 525.2 vs 510 goals (+3.0%). No per-bin calibration plot: per-shot xG is not stored. |
| Metric predicts | Pass, narrowly | On 2,805 shots in 2026-27 for 52 goalies, shrunk 2025-26 save % beats raw 2025-26 save % (log-likelihood −965.7 vs −982.6), but only just beats the league rate alone (−967.0). The holdout is tiny. |
| External models agree | Not run | GSAx here is MoneyPuck's own xG; Natural Stat Trick and Evolving-Hockey were not reachable. |
| Video confirms | Not run | No shot-level data rebuilt from play-by-play to sample. |

Year-over-year correlation of raw save % (2024-25 to 2025-26, 30+ GP both seasons): r = 0.27 over 35 goalies, consistent with the low reliability above.

## Caveats that matter
- Built from the site's stored snapshots, not from the raw game record, so there is no rink-bias adjustment and no in-house xG model.
- All situations only. Special-teams shots raise every goalie's goals against and are not split out.
- The GSAx range uses √xGA, an upper bound on the luck spread, so it is slightly too wide.

## Methods
- Build: `python build_uncertainty_data.py` (stdlib only) writes `goalies-uncertainty-data.js`.
- Checks: `python analysis/validate_uncertainty.py --csv-dir <folder with s2026.csv and s2027.csv>`.
- Model: beta-binomial empirical Bayes, prior spread by method of moments from 65 goalies with 500+ shots in 2025-26; 90% equal-tailed posterior intervals.
