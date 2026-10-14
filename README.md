# The Goaltending Open Source Journal: site files

A static website. There is nothing to install and no server: it is plain HTML and JavaScript that any web host can serve.

## What is in this folder

| File | What it is |
| --- | --- |
| `index.html` | The page: layout, wording, and sections such as Peers and Virtual Conference. |
| `data.js` | The research data: every article, the open-access journal table, and the "last updated" date. |
| `news.js` | The NHL goaltending news list. |
| `videos.js` | The video list for the Ecological dynamics videos section. |
| `goalies.html` | The Goalie Stats page: NHL goaltender leaders, charts and a sortable table. Linked from the top bar. |
| `goalies-data.js` | The goalie stats snapshot that `goalies.html` reads. |
| `goalies-zones-data.js` | Save % by zone for the heat map at the bottom of `goalies.html`. |
| `build_zone_data.py` | Rebuilds `goalies-zones-data.js` from a MoneyPuck-format shot CSV and goalie game-by-game CSV: `python build_zone_data.py shots.csv goalies.csv`. |
| `research.js` | The list for the Ecological dynamics and skill acquisition research section. |
| `add_from_pubmed_csv.py` | Optional helper that turns a PubMed CSV export into new rows for `data.js`. |
| `fetch_news.py` | Optional helper that adds recent NHL goalie headlines to `news.js`. |
| `fetch_research.py` | Optional helper that adds recent articles to `research.js` using OpenAlex (no key needed). |
| `fetch_videos.py` | Optional helper that adds videos to `videos.js` using the YouTube Data API (needs a free key). |
| `.github/workflows/update-feeds.yml` | Optional: lets GitHub run the research and video helpers every day. |
| `.github/workflows/update-news.yml` | Optional: lets GitHub run `fetch_news.py` every day. This is a hidden folder; on a Mac press Cmd+Shift+. in Finder to see it. |
| `README.md` | This file. |

`index.html`, `data.js`, `news.js`, `videos.js` and `research.js` must stay in the same folder.

## Preview on your computer

Double-click `index.html`. It opens in your browser. Fonts load from Google Fonts when you are online; offline, the page falls back to your system fonts.

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
| `qe` | `true` if it is a Quiet Eye study. These are tagged Quiet Eye in Research Articles. |
| `tp` | Topic tags, from: `hip`, `inj`, `eq`, `vis`, `phy`, `bio`, `psy`. |
| `nt` | A short note shown as a tag, such as `"in Finnish"`. Otherwise `""`. |
| `sn`, `nodoi` | Optional notes that are not shown on the page. |

A title links to its DOI if there is one, then to `link`, then to PubMed.

The page works out the record count, the "last updated" date and the Records by year chart from this file, so you only edit `data.js`.

## Updating the data

**Add or fix one record by hand.** Open `data.js` in a plain text editor (not Word). Copy a line, change the values, keep the comma at the end of each line except the last. Update `UPDATED` near the top. Save and reload `index.html`. If the page shows no articles after an edit, there is a typo such as a missing comma or quote; press F12 in your browser and open Console to see the line.

**Add a batch from PubMed.**
1. On pubmed.ncbi.nlm.nih.gov, run your search.
2. Click Save, set the format to CSV, and create the file.
3. In a terminal, in this folder, run `python3 add_from_pubmed_csv.py your-export.csv`. It lists what is new and changes nothing.
4. Run it again with `--write` to add the new records. It saves a backup as `data.js.bak` and updates the date.
5. Review the new rows. Scope and topic tags are guesses from the title. Delete rows that are not about ice hockey goaltending and fix the tags.

Records already in `data.js` are skipped by PubMed ID, so you can re-run an export safely.

**Open-access journals.** Edit the `OA` list at the bottom of `data.js`.

**Records by year chart.** It shows 2010 to 2026 (`CHART_FROM` and `CHART_TO` near the top of the script in `index.html`). Newer years are added automatically when a record from a later year is in `data.js`. Clicking a year lists that year's records; earlier years are found under Research Articles.

**NHL goaltending news.** Edit `news.js` by hand: one item per line, newest anywhere (the page sorts by date). Fields are listed at the top of the file. Set `"m": true` on items you add yourself. To collect headlines automatically, run `python3 fetch_news.py` to preview and `python3 fetch_news.py --write` to add them. It reads Google News search results for "NHL goalie", "NHL goaltending" and "NHL goaltender" and keeps your hand-added items. Automatic items have no summary line and link to Google News, which forwards to the publisher.

**Daily automatic news (optional).** Copy `.github/workflows/update-news.yml` into your repository. On GitHub go to Settings, Actions, General, Workflow permissions, choose Read and write permissions, and save. The job then runs every day and commits an updated `news.js`; you can also run it from the Actions tab. After it commits, pull the change in GitHub Desktop before editing locally. Not tested against live feeds, so check the first run in the Actions tab.

**Colours and the masthead glow.** The colour tokens are at the top of the style block in `index.html`. The glow is controlled by `--glow-text`, `--glow-text-hover`, `--glow-spot` and `--glow-edge`, with separate dark-mode values below them. `goalies.html` uses the same colours under its own token names (also at the top of its style block, with a note on which `index.html` token each one matches), so a colour change on the front page should be copied there too.

**Videos.** Edit `videos.js` by hand: one video per line. `id` is the 11 characters after `v=` in a YouTube link, `tg` is `"ed"` (ecological dynamics), `"gk"` (goaltending) or both. Each video plays inside the page when selected and always links to YouTube. A video the owner has switched off embedding for will not play in the page, but its YouTube link still works. The search links under the videos always show the latest results for each topic.

**Research (ecological dynamics and skill acquisition).** Edit `research.js` by hand: one article per line (fields are listed at the top of the file). To add articles automatically, run `python3 fetch_research.py` to preview and `python3 fetch_research.py --write` to add. It searches OpenAlex for "ecological dynamics", "constraints-led approach" and "skill acquisition" in sport. To follow particular researchers, put their names in `WATCH_AUTHORS` at the top of that file. Automatic items have no summary line.

**Daily automatic updates (optional).** Create `.github/workflows/update-feeds.yml` in your repository (on GitHub: Add file, Create new file, and type the whole path as the name). It runs the research helper daily without any key. For videos, create a free YouTube Data API key in Google Cloud and save it in GitHub under Settings, Secrets and variables, Actions as a secret named `YOUTUBE_API_KEY`; without it the video helper does nothing. Not tested against the live services, so check the first run in the Actions tab.

**Other wording.** Peers, Virtual Conference, the notes under Research Articles, the menu and the masthead text are plain HTML in `index.html`. Search the file for the heading you want, for example `Peers`, and replace the "To be announced" lines.

## Publishing the site

**GitHub Pages (free, and a good fit for an open-source journal).**
1. Create a free account at github.com and choose New repository. Make it Public and give it a name such as `goaltending-journal`.
2. Choose Add file, then Upload files, drag in all four files, and commit.
3. Go to Settings, then Pages. Under Build and deployment, set Source to Deploy from a branch, choose the `main` branch and the `/ (root)` folder, and save.
4. After a minute or two the address appears at the top of that page, in the form `https://YOUR-USERNAME.github.io/goaltending-journal/`.

To update later, open `data.js` in the repository, click the pencil icon, edit, and commit. The live site refreshes within a couple of minutes. You can also use Settings, then Pages, to attach a custom domain you own.

**Netlify Drop (fastest).** Go to app.netlify.com/drop and drag this folder onto the page. You get a working address immediately.

**Licence.** For an open-source journal, add a licence file to the repository. That choice is yours, and none is included here.

## Before you publish

- Fill in or remove the Peers and Virtual Conference placeholders. They currently say "To be announced".
- Add a contact address so readers and authors can reach the journal.
- Check the "About these records" note under Research Articles.
