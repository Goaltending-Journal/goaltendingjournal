# The Goaltending Research Journal: site files

A static website: plain HTML and JavaScript that any web host can serve, with nothing to install and no server. It is published by GitHub Pages from the `main` branch.

## Pages

| File | What it is |
| --- | --- |
| `index.html` | The home page: a scroll journey (`journey.js`, `journey.css`) through the Mission, the Features, the Oracles, the nine topics and NHL DataViz. |
| `research.html` | The Oracles page: the Master Oracle (`constellation.js`), the Evidence Oracle table, the Researcher Network Map and Heatmap, and the Coaching Oracle tab (`coaching-oracle.js`). |
| `briefs.html` | Briefs: coaching breakdowns of studies, with the Practice Labs listed below (`learn.js`, `learn.css`). |
| `glove-positioning.html` | Brief 1, Glove Positioning Analysis, with its interactive explainer. |
| `coaches-*.html` | The five Practice Labs, listed in `learn.js`. |
| `reviews.html` | Peer Reviews. |
| `conference.html` | The Virtual Conference. |
| `goalies.html` | NHL DataViz: leaders, heat map, visualizers, Impact GSAx, Archetypes and Brad's Goalie Panes (`panes/`). |
| `about.html` | About: mission, how it works, sources, ethics and the Patch Notes tab (`patch-notes.md`). |

Shared by every page: `site-nav.css` (top bar and every colour), `theme.js` (light/dark switch), `page-lid.js` (page title plates and night sky), `topics.js` (the nine topics and their colours), and the favicon files.

## Data files

| File | What it holds |
| --- | --- |
| `data.js` | The Evidence Oracle: every study and the "last updated" date. Fields below. |
| `researchers-data.js` | The researcher profiles for the network map and Master Oracle. |
| `learning-data.js`, `coaching-evidence.js`, `research.js` | The Coaching Oracle works and the evidence list that screens them. |
| `journals-data.js` | Open-access sports journals for the Sources list on About. Refresh with `python build_journals_data.py`. |
| `papers/` | PDFs linked from the site. |

## The morning stats run

`.github/workflows/update-goalie-stats.yml` runs every day at 09:00 UTC and commits whatever changed. In order:

1. `build_goalies_data.py`: this season's goalie totals from the NHL stats feed into `goalies-data.js`.
2. `fetch_nst.py`: Natural Stat Trick tables into `data/nst/` (needs the `NST_KEY` secret; credit "Data courtesy of Natural Stat Trick").
3. `build_uncertainty_data.py`: save % ranges into `goalies-uncertainty-data.js` (checks: `python analysis/validate_uncertainty.py`).
4. `check_sources.py`: NHL feed vs Natural Stat Trick, into `data/checks/`.
5. `build_goal_map.py`: every shot on goal into `goal-map-data.js` (cache in `data/goal-map/`).
6. `build_impact.py`: Impact GSAx into `impact-data.js` (`data/impact/`).
7. `build_panes.py`: Brad's Goalie Panes into `panes/index.html` (`data/panes/`).
8. `build_goalie_types.py`: goalie playing types into `goalie-types-data.js`.

The DataViz page reads these with `goalies-advanced.js`, `goal-map-3d.js`, `impact-panel.js`, `nhl-oracle.js` and `goalie-types-panel.js`. The Light Box goalie art and its checks live in `illustrations/` (see its README).

## How the data is stored

`data.js` holds one record per line. The page reads it, so changing a line changes the site. Fields:

| Field | Meaning |
| --- | --- |
| `i` | A unique number. Use the next unused one for a new record. |
| `y` | Year as a number, or `null` if unknown. Used for sorting and the decade chart. |
| `yl` | Year as shown on the page, for example `"2026"`, `"2024 (online)"` or `"c. 2019"`. |
| `t` | Title. |
| `a` | Authors as shown, for example `"Keshen et al."`. Empty `""` if unknown. |
| `j` | Journal, volume(issue): pages. |
| `doi` | DOI without the `https://doi.org/` part, or `null`. |
| `pmid` | PubMed ID as text, or `null`. |
| `link` | Web address for items with no DOI or PubMed ID, such as theses. Otherwise `null`. |
| `sc` | `"goaltending"` or `"hockey-wide"`. |
| `qe` | `true` if it is a Quiet Eye study. These are tagged Quiet Eye in the Goaltending Research table. |
| `tp` | Topic tags, from: `hip`, `inj`, `eq`, `vis`, `phy`, `bio`, `psy`. |
| `nt` | A short note shown as a tag, such as `"in Finnish"`. Otherwise `""`. |
| `sn`, `nodoi` | Optional notes that are not shown on the page. |

A title links to its DOI if there is one, then to `link`, then to PubMed.

The page works out the record count, the "last updated" date and the Records by year chart from this file, so you only edit `data.js`.

To add or fix a record, open `data.js` in a plain text editor, copy a line, change the values, keep the comma at the end, and update `UPDATED` near the top. If the page shows no studies after an edit, there is a typo; press F12 and open Console to find the line.

## Preview on your computer

In this folder run `python -m http.server` and open http://localhost:8000.
