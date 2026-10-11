#!/usr/bin/env python3
"""Add new YouTube videos to videos.js using the YouTube Data API.

This needs a free YouTube Data API key from Google Cloud. Set it as the environment variable
YOUTUBE_API_KEY (on GitHub, store it as a repository secret with that name). Without a key this script
does nothing, so the rest of the site is unaffected.

Usage:
    YOUTUBE_API_KEY=... python3 fetch_videos.py           # preview
    YOUTUBE_API_KEY=... python3 fetch_videos.py --write   # add new videos to videos.js
    python3 fetch_videos.py --from-file x.json --write    # read a saved API response (for testing)

Items you added by hand ("m": true) are never removed. Automatic items are capped at MAX_AUTO.
Each search costs 100 of the 10,000 free daily quota units, so a daily run is well within the limit.
"""
import argparse
import datetime
import html
import json
import os
import pathlib
import re
import sys
import urllib.parse
import urllib.request

# (YouTube search text, tags). "ed" = ecological dynamics, "gk" = goaltending.
QUERIES = [
    ("ecological dynamics goaltending", ["ed", "gk"]),
    ("ecological dynamics", ["ed"]),
    ("goalie constraints-led approach", ["ed", "gk"]),
]
MAX_AUTO = 18
PER_QUERY = 10


def api_url(q, key):
    params = {"part": "snippet", "type": "video", "q": q, "maxResults": str(PER_QUERY), "order": "relevance",
              "videoEmbeddable": "true", "safeSearch": "strict", "key": key}
    return "https://www.googleapis.com/youtube/v3/search?" + urllib.parse.urlencode(params)


def parse(resp, tags):
    out = []
    for it in resp.get("items", []):
        vid = (it.get("id") or {}).get("videoId", "")
        sn = it.get("snippet") or {}
        if re.fullmatch(r"[\w-]{11}", vid) and sn.get("title"):
            out.append({"id": vid, "t": html.unescape(sn["title"]).strip(), "ch": html.unescape(sn.get("channelTitle", "")).strip(), "tg": list(tags), "m": False})
    return out


def load(path):
    text = path.read_text(encoding="utf-8")
    m = re.search(r"const VIDEOS = \[\n(.*?)\n\];", text, re.S)
    if not m:
        sys.exit("Could not find the VIDEOS list in " + str(path))
    rows = [json.loads(line.rstrip().rstrip(",")) for line in m.group(1).splitlines() if line.strip()]
    return text, m, rows


def main():
    here = pathlib.Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default=str(here / "videos.js"))
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--from-file")
    args = ap.parse_args()

    key = os.environ.get("YOUTUBE_API_KEY", "").strip()
    if not key and not args.from_file:
        print("No YOUTUBE_API_KEY set; nothing to do.")
        return
    path = pathlib.Path(args.data)
    text, match, rows = load(path)
    found = []
    if args.from_file:
        found += parse(json.loads(pathlib.Path(args.from_file).read_text(encoding="utf-8")), ["ed"])
    else:
        for q, tags in QUERIES:
            try:
                with urllib.request.urlopen(api_url(q, key), timeout=30) as resp:
                    found += parse(json.load(resp), tags)
            except Exception as exc:
                print(f"Could not fetch '{q}': {type(exc).__name__}", file=sys.stderr)   # never print the URL: it holds the key

    by_id = {r["id"]: r for r in rows}
    new = []
    for f in found:
        if f["id"] in by_id:
            for k in f["tg"]:
                if k not in by_id[f["id"]]["tg"]:
                    by_id[f["id"]]["tg"].append(k)
            continue
        by_id[f["id"]] = f
        new.append(f)
    manual = [r for r in rows if r.get("m")]
    auto = [r for r in rows if not r.get("m")] + new
    merged = manual + auto[-MAX_AUTO:]

    print(f"{len(rows)} videos in videos.js; {len(new)} new found.")
    for r in new:
        print(f"  {r['id']}  {r['ch']}: {r['t'][:80]}")
    if not args.write:
        if new:
            print("\nPreview only. Run again with --write to update videos.js.")
        return
    if not new and len(merged) == len(rows):
        return
    body = ",\n".join(json.dumps(r, ensure_ascii=False) for r in merged)
    text = text[: match.start(1)] + body + text[match.end(1):]
    today = datetime.date.today()
    text = re.sub(r'const VIDEOS_UPDATED = "[^"]*";', f'const VIDEOS_UPDATED = "{today.day} {today.strftime("%B %Y")}";', text)
    path.write_text(text, encoding="utf-8")
    print(f"\nvideos.js now holds {len(merged)} videos.")


if __name__ == "__main__":
    main()
