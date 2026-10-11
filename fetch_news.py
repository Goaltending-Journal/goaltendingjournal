#!/usr/bin/env python3
"""Add recent NHL goaltending headlines to news.js from Google News RSS searches.

Usage (Python 3, nothing to install):
    python3 fetch_news.py                 # preview what would be added
    python3 fetch_news.py --write         # add new items to news.js
    python3 fetch_news.py --from-file x.xml --write   # read a saved RSS file instead (for testing)

Items you added by hand ("m": true) are never removed. Automatic items are kept for
MAX_AGE_DAYS and the list is capped at MAX_AUTO automatic items. Each item links to the
publisher's own page. Edit QUERIES below to change what is collected.
"""
import argparse
import datetime
import email.utils
import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

QUERIES = ["NHL goalie", "NHL goaltending", "NHL goaltender"]
MAX_AGE_DAYS = 45
MAX_AUTO = 24
RELEVANT = re.compile(r"goalie|goaltend|netminder|\bgoal-?tender", re.I)


def feed_url(query):
    q = urllib.parse.quote_plus(query + " when:14d")
    return f"https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"


def parse_feed(xml_bytes):
    items = []
    for it in ET.fromstring(xml_bytes).iter("item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        src_el = it.find("source")
        source = (src_el.text or "").strip() if src_el is not None else ""
        if source and title.endswith(" - " + source):
            title = title[: -len(source) - 3].strip()
        elif " - " in title and not source:
            title, source = title.rsplit(" - ", 1)
        try:
            when = email.utils.parsedate_to_datetime(it.findtext("pubDate")).astimezone(datetime.timezone.utc).date()
        except Exception:
            continue
        if title and link and RELEVANT.search(title):
            items.append({"d": when.isoformat(), "t": title, "s": source or "News", "u": link, "k": "News", "n": "", "m": False})
    return items


def norm(title):
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()


def load(path):
    text = path.read_text(encoding="utf-8")
    m = re.search(r"const NEWS = \[\n(.*?)\n\];", text, re.S)
    if not m:
        sys.exit("Could not find the NEWS list in " + str(path))
    rows = [json.loads(line.rstrip().rstrip(",")) for line in m.group(1).splitlines() if line.strip()]
    return text, m, rows


def main():
    here = pathlib.Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default=str(here / "news.js"))
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--from-file", help="read this saved RSS file instead of fetching")
    args = ap.parse_args()

    path = pathlib.Path(args.data)
    text, match, rows = load(path)
    found = []
    if args.from_file:
        found += parse_feed(pathlib.Path(args.from_file).read_bytes())
    else:
        for q in QUERIES:
            req = urllib.request.Request(feed_url(q), headers={"User-Agent": "Mozilla/5.0 (journal news updater)"})
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    found += parse_feed(resp.read())
            except Exception as exc:  # keep going if one query fails
                print(f"Could not fetch '{q}': {exc}", file=sys.stderr)

    today = datetime.date.today()
    cutoff = (today - datetime.timedelta(days=MAX_AGE_DAYS)).isoformat()
    seen_t = {norm(r["t"]) for r in rows}
    seen_u = {r["u"] for r in rows}
    new = []
    for f in sorted(found, key=lambda r: r["d"], reverse=True):
        if f["d"] < cutoff or f["d"] > today.isoformat():
            continue
        if f["u"] in seen_u or norm(f["t"]) in seen_t:
            continue
        seen_u.add(f["u"]); seen_t.add(norm(f["t"]))
        new.append(f)

    manual = [r for r in rows if r.get("m")]
    auto = [r for r in rows if not r.get("m") and r["d"] >= cutoff] + new
    auto.sort(key=lambda r: r["d"], reverse=True)
    auto = auto[:MAX_AUTO]
    merged = sorted(manual + auto, key=lambda r: r["d"], reverse=True)

    print(f"{len(rows)} items in news.js; {len(new)} new headline(s) found.")
    for r in new:
        print(f"  {r['d']}  {r['s']}: {r['t'][:90]}")
    if not new and len(merged) == len(rows):
        return
    if not args.write:
        print("\nPreview only. Run again with --write to update news.js.")
        return
    body = ",\n".join(json.dumps(r, ensure_ascii=False) for r in merged)
    text = text[: match.start(1)] + body + text[match.end(1):]
    text = re.sub(r'const NEWS_UPDATED = "[^"]*";', f'const NEWS_UPDATED = "{today.day} {today.strftime("%B %Y")}";', text)
    path.write_text(text, encoding="utf-8")
    print(f"\nnews.js now holds {len(merged)} items.")


if __name__ == "__main__":
    main()
