# Analysis plan: save % with uncertainty, and goals saved vs expected

Written 2026-10-15, before looking at results. Feeds the two new visualizer panels on `goalies.html`.

## Decision
Readers and goalie coaches use the Goalie Stats page to judge whether a goalie's save % is real or noise, especially early in a season. The panels must show how sure we can be, not just rank goalies.

## Questions in measurable terms
1. For each goalie and season, what is the plausible range of their underlying save %, given the shots they have faced?
2. How much of the spread in save % between goalies is skill rather than luck, at a given number of shots?
3. Early 2026-27: how many goals has each goalie saved compared with an expected-goals model, and is that difference bigger than chance?

## Metrics
- **Shrunk save %**: empirical-Bayes beta-binomial. Prior = league save % with a between-goalie spread estimated by method of moments (observed variance minus binomial variance) from goalies with 500+ shots in 2025-26. Posterior Beta(a + saves, b + goals); report the posterior mean and a 90% interval.
- 2026-27 is too early to estimate the spread, so it reuses the 2025-26 spread centred on the 2026-27 league rate.
- **Reliability at n shots** = n / (n + a + b): the share of the observed spread that is skill.
- **GSAx** = expected goals − goals allowed, from the stored MoneyPuck-format game file. Approximate 90% interval ±1.645·√xGA (Poisson upper bound on the variance of goals given xG, since per-shot probabilities are not stored).

## Seasons, strength, sample
- Seasons 2025-26 and 2026-27. 2024-25 has no shot counts in the snapshot, so it cannot be shrunk and is left out of the save % panel.
- All situations (the only split stored). Empty-net goals are not in goalie totals.
- Every goalie who meets the page's Min GP is shown; the interval carries the sample size.

## Baseline and what would change my mind
- Baseline: raw save % and the league rate.
- Shrunk save % must predict 2026-27 save % better than raw 2025-26 save % does (binomial log-likelihood on 2026-27 saves). If it does not, the panel shows raw save % with plain binomial intervals instead.
- League xGA must fall within ±10% of actual goals over the stored 2026-27 sample, or the GSAx panel is not published.

## Data (deviation from the standard pipeline)
The NHL play-by-play and shift-chart endpoints are blocked from the build environment, so this analysis uses the site's stored snapshots (`goalies-data.js`, `goalies-zones-data.js`) rather than a dataset rebuilt from the raw game record. Rink-bias adjustment, our own xG model and play-by-play reconciliation are therefore not run here.
