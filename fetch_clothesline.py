#!/usr/bin/env python3
"""Research bot for the goaltending "clothesline" at the top of index.html.

It looks for recent articles on six topics (see TOPICS) and writes them to clothesline.js, which the
page shows as post-it notes on a scrolling line.

How it works:
  1. Free sources, no key needed: Google News search results for each topic, the InGoal Magazine and
     The Goalie Guild feeds, and OpenAlex (scholarly articles) for biomechanics and statistics.
  2. If ANTHROPIC_API_KEY is set, Claude also searches the web for each topic, then reviews every
     candidate, drops anything that is not about ice hockey goaltending, and picks the topic for each.
     Without a key, a simple keyword filter is used instead.

Usage (Python 3):
    python3 fetch_clothesline.py              # preview what would be added
    python3 fetch_clothesline.py --write      # update clothesline.js
    python3 fetch_clothesline.py --no-claude  # skip the Claude step even if a key is set

The Claude step needs the anthropic package: pip install anthropic

Items you add by hand ("m": true) are never removed. Automatic items are kept for MAX_AGE_DAYS and
capped at MAX_AUTO.
"""
import argparse
import datetime
import email.utils
import json
import os
import pathlib
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

# Topic code: (label shown on the note, Google News search text)
TOPICS = {
    "dev": ("Goalie development", '"goaltending development" OR "goalie development" hockey'),
    "train": ("Training", '"goalie training" OR "goaltender training" NHL OR pro'),
    "coach": ("NHL goalie coaches", '"goalie coach" OR "goaltending coach" NHL'),
    "stats": ("Advanced stats", '"goals saved above expected" OR "GSAx" OR "goalie analytics" hockey'),
    "bio": ("Biomechanics", 'goaltender OR goalie biomechanics hockey'),
    "coaching": ("Goalie coaching", '"goalie coaching" OR "coaching goalies" hockey'),
}
FEEDS = [  # blogs that cover goaltending; items are kept only if they pass the relevance check
    ("InGoal Magazine", "https://ingoalmag.com/feed/"),
    ("The Goalie Guild", "https://www.thegoalieguild.com/feed/"),
]
OPENALEX = [  # (search text, topic)
    ('ice hockey goaltender OR goalkeeper biomechanics', "bio"),
    ('ice hockey goaltender OR goalie performance statistics', "stats"),
]
MODEL = "claude-opus-5-5"
MAX_AGE_DAYS = 90
MAX_AUTO = 36
PER_SOURCE = 15
UA = {"User-Agent": "Mozilla/5.0 (goaltending-journal clothesline bot)"}

KEEP = re.compile(r"goalie|goaltend|goalkeeper|netminder|between the pipes|crease|save percentage|GSAx|saves above", re.I)
DROP = re.compile(r"soccer|football|lacrosse|water polo|handball|futsal|premier league|\bMLS\b|\bFIFA\b", re.I)


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def iso(datestr):
    try:
        return email.utils.parsedate_to_datetime(datestr).date().isoformat()
    except Exception:
        m = re.match(r"\d{4}-\d{2}-\d{2}", datestr or "")
        return m.group(0) if m else ""


def from_rss(data, source, topic):
    out = []
    for it in ET.fromstring(data).iter("item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        src = (it.findtext("source") or source).strip()
        if source == "Google News" and title.endswith(" - " + src):   # Google appends " - Publisher"
            title = title[: -len(" - " + src)]
        if title and link:
            out.append({"d": iso(it.findtext("pubDate") or ""), "t": title, "u": link, "s": src, "tp": topic, "m": False})
        if len(out) >= PER_SOURCE:
            break
    return out


def from_openalex(data, topic):
    out = []
    for w in json.loads(data).get("results", []):
        title = (w.get("title") or "").strip()
        doi = (w.get("doi") or "")
        link = doi or (w.get("primary_location") or {}).get("landing_page_url") or w.get("id")
        src = ((w.get("primary_location") or {}).get("source") or {}).get("display_name") or "Research article"
        if title and link:
            out.append({"d": w.get("publication_date") or "", "t": title, "u": link, "s": src, "tp": topic, "m": False})
    return out


def gather(since):
    found = []
    for code, (_, query) in TOPICS.items():
        q = urllib.parse.quote(f"{query} when:{MAX_AGE_DAYS}d")
        try:
            found += from_rss(get(f"https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"), "Google News", code)
        except Exception as exc:
            print(f"Could not fetch Google News for {code}: {exc}", file=sys.stderr)
    for name, url in FEEDS:
        try:
            found += from_rss(get(url), name, "dev")
        except Exception as exc:
            print(f"Could not fetch {name}: {exc}", file=sys.stderr)
    for search, code in OPENALEX:
        params = urllib.parse.urlencode({"search": search, "filter": f"from_publication_date:{since}", "sort": "publication_date:desc", "per-page": PER_SOURCE})
        try:
            found += from_openalex(get("https://api.openalex.org/works?" + params), code)
        except Exception as exc:
            print(f"Could not fetch OpenAlex for {code}: {exc}", file=sys.stderr)
    return found


def keyword_filter(items):
    return [r for r in items if KEEP.search(r["t"]) and not DROP.search(r["t"])]


PROMPT = """You are the research bot for The Goaltending Open Source Journal, a site about ice hockey goaltending.
Today is {today}. Find and choose articles for a ticker of post-it notes on the home page, covering:
{topics}

1. Use web search to find good articles from the last {days} days on each topic: coaching and development
   sites (InGoal Magazine, The Goalie Guild, team sites, The Athletic, Hockey Graphs, Evolving Hockey and
   similar), research papers, and news about NHL goalie coaches and goalie development.
2. Review the candidates below that other sources found, plus your own finds. Keep only items that are
   really about ice hockey goaltending and fit one of the topics. Drop soccer or other sports, duplicates,
   betting tips, fantasy advice and plain game recaps.
3. Return at most {limit} items, newest and most useful first, spread across the topics.

Candidates (JSON):
{candidates}

Reply with only a JSON array and nothing else. Each element:
{{"d": "YYYY-MM-DD", "t": "article title", "u": "https link", "s": "publisher or journal", "tp": "<topic code>"}}
Use only links you found or that are in the candidates; never make one up. Topic codes: {codes}."""


def claude_review(candidates, today):
    import anthropic  # only needed for this step

    topics = "\n".join(f"- {code}: {label}" for code, (label, _) in TOPICS.items())
    prompt = PROMPT.format(today=today, topics=topics, days=MAX_AGE_DAYS, limit=MAX_AUTO,
                           candidates=json.dumps(candidates, ensure_ascii=False), codes=", ".join(TOPICS))
    client = anthropic.Anthropic()
    messages = [{"role": "user", "content": prompt}]
    for _ in range(6):  # a long web search can pause; send the turn back to let it continue
        with client.beta.messages.stream(
            model=MODEL,
            max_tokens=32000,
            betas=["server-side-fallback-2026-07-01"],
            extra_body={"fallbacks": "default"},  # if the model declines, the API retries on a fallback model
            output_config={"effort": "medium"},
            tools=[{"type": "web_search_20260209", "name": "web_search", "max_uses": 18}],
            messages=messages,
        ) as stream:
            resp = stream.get_final_message()
        if resp.stop_reason != "pause_turn":
            break
        messages.append({"role": "assistant", "content": resp.content})
    if resp.stop_reason == "refusal":
        raise RuntimeError("Claude declined the request")
    text = "".join(b.text for b in resp.content if b.type == "text")
    m = re.search(r"\[.*\]", text, re.S)
    if not m:
        raise RuntimeError("Claude did not return a JSON list")
    out = []
    for r in json.loads(m.group(0)):
        if not isinstance(r, dict) or not str(r.get("u", "")).startswith("http") or not r.get("t"):
            continue
        tp = r.get("tp") if r.get("tp") in TOPICS else "dev"
        out.append({"d": iso(str(r.get("d", ""))), "t": str(r["t"]).strip(), "u": r["u"], "s": str(r.get("s", "")).strip(), "tp": tp, "m": False})
    return out


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def load(path):
    text = path.read_text(encoding="utf-8")
    m = re.search(r"const CLOTHESLINE = \[\n(.*?)\n?\];", text, re.S)
    if not m:
        sys.exit("Could not find the CLOTHESLINE list in " + str(path))
    rows = [json.loads(line.rstrip().rstrip(",")) for line in m.group(1).splitlines() if line.strip()]
    return text, m, rows


def main():
    here = pathlib.Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default=str(here / "clothesline.js"))
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--no-claude", action="store_true")
    args = ap.parse_args()

    path = pathlib.Path(args.data)
    text, match, rows = load(path)
    today = datetime.date.today()
    since = (today - datetime.timedelta(days=MAX_AGE_DAYS)).isoformat()

    found = [r for r in gather(since) if not r["d"] or since <= r["d"] <= today.isoformat()]
    use_claude = os.environ.get("ANTHROPIC_API_KEY") and not args.no_claude
    if use_claude:
        try:
            found = claude_review(found, today.isoformat())
        except Exception as exc:
            print(f"Claude step failed, using the keyword filter instead: {exc}", file=sys.stderr)
            found = keyword_filter(found)
    else:
        found = keyword_filter(found)

    by_key = {norm(r["t"]): r for r in rows}
    new = []
    for f in found:
        f["d"] = f["d"] or today.isoformat()
        key = norm(f["t"])
        if key and key not in by_key:
            by_key[key] = f
            new.append(f)

    manual = [r for r in rows if r.get("m")]
    # Undated notes are kept until newer ones fill the line.
    auto = sorted((r for r in by_key.values() if not r.get("m") and (r["d"] >= since or not r["d"])), key=lambda r: r["d"], reverse=True)
    merged = sorted(manual + auto[:MAX_AUTO], key=lambda r: r["d"], reverse=True)

    print(f"{len(rows)} notes in clothesline.js; {len(new)} new article(s) found" + (" (reviewed by Claude)." if use_claude else "."))
    for r in new:
        print(f"  {r['d']}  [{r['tp']}]  {r['t'][:90]}")
    if not args.write:
        if new:
            print("\nPreview only. Run again with --write to update clothesline.js.")
        return
    if not new and len(merged) == len(rows):
        return
    body = ",\n".join(json.dumps(r, ensure_ascii=False) for r in merged)
    text = text[: match.start(1)] + body + text[match.end(1):]
    text = re.sub(r'const CLOTHESLINE_UPDATED = "[^"]*";', f'const CLOTHESLINE_UPDATED = "{today.day} {today.strftime("%B %Y")}";', text)
    path.write_text(text, encoding="utf-8")
    print(f"\nclothesline.js now holds {len(merged)} notes.")


if __name__ == "__main__":
    main()
