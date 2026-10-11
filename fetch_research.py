#!/usr/bin/env python3
"""Add recent ecological dynamics and skill acquisition articles to research.js using OpenAlex.

OpenAlex is a free index of scholarly work. No account or key is needed.

Usage (Python 3, nothing to install):
    python3 fetch_research.py                  # preview what would be added
    python3 fetch_research.py --write          # add new items to research.js
    python3 fetch_research.py --from-file x.json --write   # read a saved OpenAlex response (for testing)

Items you added by hand ("m": true) are never removed. Automatic items are kept for MAX_AGE_DAYS and
capped at MAX_AUTO. Edit QUERIES to change what is collected, and WATCH_AUTHORS to follow named researchers.
Automatic items have no summary line; add one by hand if you want it, and set "m": true to keep the item.
"""
import argparse
import datetime
import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request

# (OpenAlex search text, tag). Tag "ed" = ecological dynamics / constraints-led, "sa" = skill acquisition.
QUERIES = [
    ('"ecological dynamics"', "ed"),
    ('"constraints-led approach"', "ed"),
    ('"skill acquisition" AND (sport OR athlete OR coaching)', "sa"),
]
# Names to follow, for example ["Keith Davids", "Ian Renshaw"]. Results are tagged "ed". Name matches can
# include other people with the same name, so review them.
WATCH_AUTHORS = []
CONTACT_EMAIL = ""      # optional: your email, which OpenAlex asks for to give faster service
MAX_AGE_DAYS = 120
MAX_AUTO = 24
PER_QUERY = 25


def api_url(search=None, author=None, since=""):
    flt = [f"from_publication_date:{since}", "type:article"]
    params = {"sort": "publication_date:desc", "per-page": str(PER_QUERY)}
    if search:
        params["search"] = search
    if author:
        flt.append("raw_author_name.search:" + author)
    params["filter"] = ",".join(flt)
    if CONTACT_EMAIL:
        params["mailto"] = CONTACT_EMAIL
    return "https://api.openalex.org/works?" + urllib.parse.urlencode(params, safe=":,\"()")


def parse(resp, tag):
    out = []
    for w in resp.get("results", []):
        title = (w.get("title") or w.get("display_name") or "").strip()
        date = w.get("publication_date") or ""
        if not title or not re.match(r"\d{4}-\d{2}-\d{2}$", date):
            continue
        doi = (w.get("doi") or "").replace("https://doi.org/", "") or None
        names = [a["author"]["display_name"] for a in w.get("authorships", []) if a.get("author", {}).get("display_name")]
        if not names:
            first = ""
        else:
            surname = names[0].split()[-1]
            first = surname + (" et al." if len(names) > 2 else (" & " + names[1].split()[-1] if len(names) == 2 else ""))
        src = ((w.get("primary_location") or {}).get("source") or {}).get("display_name") or ""
        link = (w.get("primary_location") or {}).get("landing_page_url") or w.get("id")
        out.append({"d": date, "t": title, "a": first, "j": src, "doi": doi, "u": None if doi else link, "tg": [tag], "n": "", "m": False})
    return out


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def load(path):
    text = path.read_text(encoding="utf-8")
    m = re.search(r"const RESEARCH = \[\n(.*?)\n\];", text, re.S)
    if not m:
        sys.exit("Could not find the RESEARCH list in " + str(path))
    rows = [json.loads(line.rstrip().rstrip(",")) for line in m.group(1).splitlines() if line.strip()]
    return text, m, rows


def main():
    here = pathlib.Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default=str(here / "research.js"))
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--from-file")
    args = ap.parse_args()

    path = pathlib.Path(args.data)
    text, match, rows = load(path)
    today = datetime.date.today()
    since = (today - datetime.timedelta(days=MAX_AGE_DAYS)).isoformat()
    found = []
    if args.from_file:
        found += parse(json.loads(pathlib.Path(args.from_file).read_text(encoding="utf-8")), "ed")
    else:
        jobs = [(dict(search=q, since=since), tag) for q, tag in QUERIES] + [(dict(author=a, since=since), "ed") for a in WATCH_AUTHORS]
        for kw, tag in jobs:
            try:
                req = urllib.request.Request(api_url(**kw), headers={"User-Agent": "journal-research-updater"})
                with urllib.request.urlopen(req, timeout=30) as resp:
                    found += parse(json.load(resp), tag)
            except Exception as exc:  # keep going if one query fails
                print(f"Could not fetch {kw}: {exc}", file=sys.stderr)

    by_key = {}
    for r in rows:
        by_key[(r.get("doi") or "").lower() or norm(r["t"])] = r
    new = []
    for f in sorted(found, key=lambda r: r["d"], reverse=True):
        if f["d"] < since or f["d"] > today.isoformat():
            continue
        key = (f["doi"] or "").lower() or norm(f["t"])
        if key in by_key:                      # known item: just add any new tag
            for k in f["tg"]:
                if k not in by_key[key]["tg"]:
                    by_key[key]["tg"].append(k)
            continue
        by_key[key] = f
        new.append(f)

    manual = [r for r in rows if r.get("m")]
    auto = [r for r in by_key.values() if not r.get("m") and r["d"] >= since]
    auto.sort(key=lambda r: r["d"], reverse=True)
    merged = sorted(manual + auto[:MAX_AUTO], key=lambda r: r["d"], reverse=True)

    print(f"{len(rows)} items in research.js; {len(new)} new article(s) found.")
    for r in new:
        print(f"  {r['d']}  {r['t'][:90]}")
    if not args.write:
        if new:
            print("\nPreview only. Run again with --write to update research.js.")
        return
    if not new and len(merged) == len(rows):
        return
    body = ",\n".join(json.dumps(r, ensure_ascii=False) for r in merged)
    text = text[: match.start(1)] + body + text[match.end(1):]
    text = re.sub(r'const RESEARCH_UPDATED = "[^"]*";', f'const RESEARCH_UPDATED = "{today.day} {today.strftime("%B %Y")}";', text)
    path.write_text(text, encoding="utf-8")
    print(f"\nresearch.js now holds {len(merged)} items.")


if __name__ == "__main__":
    main()
