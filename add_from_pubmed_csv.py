#!/usr/bin/env python3
"""Draft new records for data.js from a PubMed CSV export.

Usage (Python 3, nothing to install):
    python3 add_from_pubmed_csv.py my-export.csv            # preview what would be added
    python3 add_from_pubmed_csv.py my-export.csv --write    # add the new records to data.js

Records whose PMID is already in data.js are skipped. Scope and topic tags are
guesses from the title, so review the new rows afterwards: delete anything that
is not about ice hockey goaltending and correct the tags.
"""
import argparse
import csv
import datetime
import json
import pathlib
import re
import shutil
import sys

GOALIE = re.compile(r"goaltend|goalie|goalkeep", re.I)
TOPICS = [
    ("hip", r"hip|femoroacetabular|\bFAI\b|groin|labral|butterfly"),
    ("inj", r"injur|concussion|fracture|dissection|trauma|cruciate|meniscus|impingement|safety|protective|commotio|brain strain"),
    ("eq", r"mask|helmet|\bpads?\b|cage|protective"),
    ("vis", r"quiet eye|gaze|visual|shot reading|occlusion|perceptual|eyes-puck|anticipat|reaction|speed of response"),
    ("phy", r"physiolog|fitness|thermoregulation|dehydration|load management|agility|physical|body composition|conditioning|loading"),
    ("bio", r"kinematic|movement pattern|stance|blade|torso|biomechanic|butterfly"),
    ("psy", r"psycholog|cognitive|neurophysiolog|anxiety|mental"),
]
SUFFIXES = {"Jr", "Sr", "2nd", "3rd", "4th"}


def load(data_js):
    text = data_js.read_text(encoding="utf-8")
    m = re.search(r"const REC = \[\n(.*?)\n\];", text, re.S)
    if not m:
        sys.exit("Could not find the REC list in " + str(data_js))
    rows = [json.loads(line.rstrip().rstrip(",")) for line in m.group(1).splitlines() if line.strip()]
    return text, m, rows


def author(first_author, authors):
    words = first_author.split()
    while len(words) > 1 and words[-1] in SUFFIXES:
        words.pop()
    surname = " ".join(words[:-1]) if len(words) > 1 else first_author
    count = len([a for a in authors.rstrip(".").split(", ") if a.strip()])
    return surname + (" et al." if count > 1 else "")


def source(row):
    journal, cite = row["Journal/Book"], row["Citation"]
    m = re.search(r";\s*(\d+)(?:\((\d[^)]*)\))?:\s*([\w-]+)", cite)
    if m:
        vol, issue, pages = m.groups()
        out = journal + " " + vol + (f"({issue})" if issue else "")
        if len(pages) <= 7:
            out += ": " + pages.replace("-", "–")
        return out
    if "online ahead of print" in cite.lower():
        return journal + " (online ahead of print)"
    return journal


def record(row, number):
    title = row["Title"].strip().rstrip(".")
    year = int(row["Publication Year"]) if row["Publication Year"].isdigit() else None
    doi = row["DOI"].strip() or None
    return {
        "i": number,
        "y": year,
        "yl": str(year) if year else "n.d.",
        "t": title,
        "a": author(row["First Author"], row["Authors"]),
        "j": source(row),
        "doi": doi,
        "pmid": row["PMID"].strip() or None,
        "link": None,
        "sc": "goaltending" if GOALIE.search(title) else "hockey-wide",
        "sn": "",
        "qe": "quiet eye" in title.lower(),
        "tp": [key for key, rx in TOPICS if re.search(rx, title + " " + row["Journal/Book"], re.I)],
        "nt": "",
        "nodoi": "" if doi else "None listed",
    }


def main():
    here = pathlib.Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", nargs="+", help="PubMed CSV export(s)")
    ap.add_argument("--data", default=str(here / "data.js"), help="path to data.js (default: next to this script)")
    ap.add_argument("--write", action="store_true", help="add the new records to data.js (a data.js.bak backup is made first)")
    args = ap.parse_args()

    data_js = pathlib.Path(args.data)
    text, match, rows = load(data_js)
    known = {r["pmid"] for r in rows if r.get("pmid")}
    number = max(r["i"] for r in rows) + 1
    new = []
    for path in args.csv:
        with open(path, newline="", encoding="utf-8-sig") as fh:
            for row in csv.DictReader(fh):
                pmid = row["PMID"].strip()
                if pmid in known:
                    continue
                known.add(pmid)
                new.append(record(row, number))
                number += 1

    print(f"{len(rows)} records already in data.js; {len(new)} new from {len(args.csv)} file(s).")
    for r in new:
        print(f"  {r['y']}  [{r['sc']}]  {r['t'][:90]}")
    if not new:
        return
    if not args.write:
        print("\nPreview only. Run again with --write to add these to data.js.")
        return

    shutil.copyfile(data_js, str(data_js) + ".bak")
    body = match.group(1) + ",\n" + ",\n".join(json.dumps(r, ensure_ascii=False) for r in new)
    text = text[: match.start(1)] + body + text[match.end(1):]
    today = datetime.date.today()
    text = re.sub(r'const UPDATED = "[^"]*";', f'const UPDATED = "{today.day} {today.strftime("%B %Y")}";', text)
    data_js.write_text(text, encoding="utf-8")
    print(f"\nAdded {len(new)} records to {data_js} (backup: {data_js}.bak). Open index.html and review them.")


if __name__ == "__main__":
    main()
