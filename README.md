# The Goaltending Open Source Journal: site files

A static website. There is nothing to install and no server: it is plain HTML and JavaScript that any web host can serve.

## What is in this folder

| File | What it is |
| --- | --- |
| `index.html` | The page: layout, wording, and sections such as Peers, Virtual Conference and Methods. |
| `data.js` | The data: every article, the open-access journal table, and the "last updated" date. |
| `add_from_pubmed_csv.py` | Optional helper that turns a PubMed CSV export into new rows for `data.js`. |
| `README.md` | This file. |

`index.html` and `data.js` must stay in the same folder.

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
| `qe` | `true` if it is a Quiet Eye study. These also appear in the Quiet Eye section. |
| `tp` | Topic tags, from: `hip`, `inj`, `eq`, `vis`, `phy`, `bio`, `psy`. |
| `nt` | A short note shown as a tag, such as `"in Finnish"`. Otherwise `""`. |
| `sn`, `nodoi` | Optional notes that are not shown on the page. |

A title links to its DOI if there is one, then to `link`, then to PubMed.

The page works out the record count, the "last updated" date and the decade chart from this file, so you only edit `data.js`.

## Updating the data

**Add or fix one record by hand.** Open `data.js` in a plain text editor (not Word). Copy a line, change the values, keep the comma at the end of each line except the last. Update `UPDATED` near the top. Save and reload `index.html`. If the page shows no articles after an edit, there is a typo such as a missing comma or quote; press F12 in your browser and open Console to see the line.

**Add a batch from PubMed.**
1. On pubmed.ncbi.nlm.nih.gov, run your search.
2. Click Save, set the format to CSV, and create the file.
3. In a terminal, in this folder, run `python3 add_from_pubmed_csv.py your-export.csv`. It lists what is new and changes nothing.
4. Run it again with `--write` to add the new records. It saves a backup as `data.js.bak` and updates the date.
5. Review the new rows. Scope and topic tags are guesses from the title. Delete rows that are not about ice hockey goaltending and fix the tags.

Records already in `data.js` are skipped by PubMed ID, so you can re-run an export safely.

**Quiet Eye summaries.** To add a one-sentence summary under a Quiet Eye study, add a line to `QE_NOTES` in `index.html`. The key is the PubMed ID, the DOI, or part of the title.

**Open-access journals.** Edit the `OA` list at the bottom of `data.js`.

**Other wording.** Peers, Virtual Conference, Methods, the menu and the masthead text are plain HTML in `index.html`. Search the file for the heading you want, for example `Peers`, and replace the "To be announced" lines.

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
- Check the dates and search descriptions in the Methods section.
