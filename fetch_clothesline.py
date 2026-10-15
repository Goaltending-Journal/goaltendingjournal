#!/usr/bin/env python3
"""Research bot for the goaltending "clothesline" at the top of index.html.

It looks for recent evidence-based articles on the topics in TOPICS and writes them to clothesline.js,
which the page shows as post-it notes on a scrolling line.

How it works:
  1. Free sources, no key needed: OpenAlex (an index of peer-reviewed research) for each topic and for
     each researcher in WATCH_AUTHORS, plus the researcher feeds in RESEARCHER_FEEDS.
  2. If ANTHROPIC_API_KEY is set, Claude also searches the web for research on each topic, then reviews
     every candidate, keeps only evidence-based work that fits a topic, and picks the topic for each.
     Without a key, a simple keyword filter is used instead.

Usage (Python 3):
    python3 fetch_clothesline.py              # preview what would be added
    python3 fetch_clothesline.py --write      # update clothesline.js
    python3 fetch_clothesline.py --no-claude  # skip the Claude step even if a key is set

The Claude step needs the anthropic package: pip install anthropic

Items you add by hand ("m": true) are never removed. Automatic items are kept for MAX_AGE_DAYS and
capped at MAX_AUTO. Sources matching BLOCKED are never shown.
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

# Topic code: (label shown on the note, OpenAlex search text)
TOPICS = {
    "dev": ("Goalie development", "ice hockey goaltender"),
    "train": ("Training", "ice hockey goaltender training physiology"),
    "coaching": ("Goalie coaching", "ice hockey goaltender coaching"),
    "stats": ("Advanced stats", "ice hockey goaltender statistics performance"),
    "bio": ("Biomechanics", "ice hockey goaltender biomechanics"),
    "ed": ("Ecological dynamics", "ecological dynamics sport"),
    "sa": ("Skill acquisition", "skill acquisition constraints-led sport coaching"),
}
# Researchers to follow on OpenAlex. Their sport and movement papers are tagged "ed" or "sa". Common
# names can match other people, so results are kept only if the title is about sport, skill or movement.
WATCH_AUTHORS = [
    "Rob Gray", "Duarte Araújo", "Keith Davids", "Andrew D. Wilson", "Ian Renshaw", "Jia Yi Chow",
    "Ludovic Seifert", "Pedro Passos", "Chris Button", "Carl T. Woods", "Mark O'Sullivan", "James Rudd",
    "Will Roberts", "Martyn Rothwell",
]
# Feeds from researchers and applied ecological dynamics groups: (name, feed address, topic).
RESEARCHER_FEEDS = [
    ("Perception & Action (Rob Gray)", "https://perceptionaction.com/feed/", "sa"),
    ("Emergence (Myszka & Yearby)", "https://emergentmvmt.com/feed/", "ed"),
]
BLOCKED = re.compile(r"ingoal", re.I)   # matched against the link and the source name
MODEL = "claude-opus-5-5"
MAX_AGE_DAYS = 365
MAX_AUTO = 36
PER_SOURCE = 15
UA = {"User-Agent": "Mozilla/5.0 (goaltending-journal clothesline bot)"}

GOALIE = re.compile(r"goalie|goaltend|goalkeeper|netminder|save percentage|saves above", re.I)
ED_SA = re.compile(r"ecolog|constraint|skill|affordance|perception|percept|motor learning|representative|nonlinear pedagogy|practice design|coach|movement|athlet|sport", re.I)
DROP = re.compile(r"soccer|football|water polo|handball|futsal", re.I)


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
        if title and link:
            out.append({"d": iso(it.findtext("pubDate") or ""), "t": title, "u": link, "s": source, "tp": topic, "m": False})
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
            out.append({"d": w.get("publication_date") or "", "t": title, "u": link, "s": src, "tp": topic, "m": False, "_chk": True})
    return out


def openalex(since, search=None, author=None):
    flt = [f"from_publication_date:{since}"]
    params = {"sort": "publication_date:desc", "per-page": PER_SOURCE}
    if search:
        params["search"] = search
    if author:
        flt.append("raw_author_name.search:" + author)
    params["filter"] = ",".join(flt)
    return get("https://api.openalex.org/works?" + urllib.parse.urlencode(params, safe=":,"))


def gather(since):
    found = []
    for code, (_, search) in TOPICS.items():
        try:
            found += from_openalex(openalex(since, search=search), code)
        except Exception as exc:
            print(f"Could not fetch OpenAlex for {code}: {exc}", file=sys.stderr)
    for name in WATCH_AUTHORS:
        try:
            for r in from_openalex(openalex(since, author=name), "ed"):
                if re.search(r"skill|learn|practice|coach|training", r["t"], re.I):
                    r["tp"] = "sa"
                found.append(r)
        except Exception as exc:
            print(f"Could not fetch OpenAlex for {name}: {exc}", file=sys.stderr)
    for name, url, code in RESEARCHER_FEEDS:
        try:
            found += from_rss(get(url), name, code)
        except Exception as exc:
            print(f"Could not fetch {name}: {exc}", file=sys.stderr)
    return [r for r in found if not BLOCKED.search(r["u"] + " " + r["s"])]


def relevant(r):
    if DROP.search(r["t"]):
        return False
    if not r.get("_chk"):            # researcher feeds are trusted as they are
        return True
    return bool(ED_SA.search(r["t"])) if r["tp"] in ("ed", "sa") else bool(GOALIE.search(r["t"]))


def keyword_filter(items):
    return [r for r in items if relevant(r)]


PROMPT = """You are the research bot for The Goaltending Open Source Journal, an evidence-based journal about ice
hockey goaltending. Today is {today}. Find and choose articles for a ticker of post-it notes on the home page,
covering:
{topics}

1. Use web search to find evidence-based work from the last {days} days on each topic: peer-reviewed journal
   articles, preprints (SportRxiv, OSF), university labs and research groups, and the work of leading
   ecological dynamics and skill acquisition researchers, such as Rob Gray (Perception & Action), Duarte
   Araújo, Keith Davids, Andrew D. Wilson, Ian Renshaw, Jia Yi Chow, Ludovic Seifert, Carl Woods, and the
   Emergence group in Minnesota (Shawn Myszka and Tyler Yearby). Foundational work in the tradition of
   James J. Gibson's ecological psychology also fits.
2. Review the candidates below that other sources found, plus your own finds. Keep only evidence-based items
   that fit a topic. For the goaltending topics, the work must be about ice hockey goaltending. Drop
   magazines, news stories, opinion blogs, fantasy or betting content, product pages and anything from
   InGoal Magazine, and drop duplicates.
3. Return at most {limit} items, newest and most useful first, spread across the topics.

Candidates (JSON):
{candidates}

Reply with only a JSON array and nothing else. Each element:
{{"d": "YYYY-MM-DD", "t": "article title", "u": "https link", "s": "journal, lab or publisher", "tp": "<topic code>"}}
Use only links you found or that are in the candidates; never make one up. Topic codes: {codes}."""


def claude_review(candidates, today):
    import anthropic  # only needed for this step

    topics = "\n".join(f"- {code}: {label}" for code, (label, _) in TOPICS.items())
    prompt = PROMPT.format(today=today, topics=topics, days=MAX_AGE_DAYS, limit=MAX_AUTO,
                           candidates=json.dumps([{k: v for k, v in r.items() if k != "_chk"} for r in candidates], ensure_ascii=False), codes=", ".join(TOPICS))
    client = anthropic.Anthropic()
    messages = [{"role": "user", "content": prompt}]
    for _ in range(6):  # a long web search can pause; send the turn back to let it continue
        with client.beta.messages.stream(
            model=MODEL,
            max_tokens=32000,
            betas=["server-side-fallback-2026-07-01"],
            extra_body={"fallbacks": "default"},  # if the model declines, the API retries on a fallback model
            output_config={"effort": "medium"},
            tools=[{"type": "web_search_20260209", "name": "web_search", "max_uses": 20, "blocked_domains": ["ingoalmag.com"]}],
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
        f.pop("_chk", None)
        if BLOCKED.search(f["u"] + " " + f["s"]):
            continue
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
