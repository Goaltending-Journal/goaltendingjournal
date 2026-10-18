"""Rebuild journals-data.js: every open-access sports journal in the Directory of Open Access Journals.

Run by hand whenever you want the Sources list on about.html refreshed:

  python build_journals_data.py

Downloads every journal DOAJ files under the subject "Sports" (which includes Sports medicine)
from its public search API (doaj.org/api/search/journals), sorted by title. Uses only the
standard library.

  --file FILE   read a saved API page (JSON) instead of downloading (for testing)
"""

import argparse
import json
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "journals-data.js"
API = "https://doaj.org/api/search/journals/{query}?{params}"
QUERY = 'bibjson.subject.term:"Sports"'
PAGE_SIZE = 100
HEADER = """// Open-access sports journals: every journal the Directory of Open Access Journals (doaj.org) files under the subject "Sports".
// Each row: [title, publisher, author fee (true = authors pay an article processing charge), journal website, publisher country code].
// Rebuilt by build_journals_data.py; shown in the Sources section of about.html.
"""


def fetch_page(page):
    params = urllib.parse.urlencode({"page": page, "pageSize": PAGE_SIZE, "sort": "bibjson.title.exact:asc"})
    url = API.format(query=urllib.parse.quote(QUERY, safe=""), params=params)
    req = urllib.request.Request(url, headers={"User-Agent": "goaltendingjournal (build_journals_data.py)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def clean_url(u):
    """DOAJ has a few homepage links with stray characters at the end, such as ")" or "%20"."""
    u = (u or "").strip().rstrip(")")
    return u[:-3] if u.endswith("%20") else u


def row(rec):
    b = rec.get("bibjson", {})
    pub = b.get("publisher", {})
    return [
        b.get("title", "").strip(),
        pub.get("name", "").strip().rstrip(","),
        bool(b.get("apc", {}).get("has_apc")),
        clean_url(b.get("ref", {}).get("journal")),
        pub.get("country", ""),
    ]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", help="saved API page to read instead of downloading")
    args = ap.parse_args()

    if args.file:
        results = json.load(open(args.file, encoding="utf-8"))["results"]
    else:
        first = fetch_page(1)
        results, total = first["results"], first["total"]
        page = 2
        while len(results) < total:
            results += fetch_page(page)["results"]
            page += 1
    rows = [row(r) for r in results if r.get("bibjson", {}).get("title")]
    if not rows:
        sys.exit("No journals returned; journals-data.js left unchanged.")

    today = date.today()
    body = ",\n".join(json.dumps(r, ensure_ascii=False) for r in rows)
    OUT.write_text(f'{HEADER}\nconst JOURNALS_UPDATED = "{today.day} {today.strftime("%B %Y")}";\n\nconst JOURNALS = [\n{body}\n];\n', encoding="utf-8")
    print(f"Wrote {len(rows)} journals to {OUT.name} ({sum(r[2] for r in rows)} charge an author fee).")


if __name__ == "__main__":
    main()
