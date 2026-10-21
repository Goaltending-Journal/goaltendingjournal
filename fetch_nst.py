"""Download Natural Stat Trick goalie stats and save them in data/nst/.

Requests go to data.naturalstattrick.com, the keyed host for supporters. The
access key is read from the NST_KEY environment variable (a GitHub repository
secret in the workflow) and sent in the "nst-key" header, so it never appears
in URLs, logs or the repository.

NST serves its stats as HTML tables, so the first table on the page is parsed
with the standard library and written out as CSV.
"""

import csv
import io
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from zoneinfo import ZoneInfo

BASE_URL = "https://data.naturalstattrick.com/playerteams.php"
OUT_DIR = Path(__file__).resolve().parent / "data" / "nst"
EASTERN = ZoneInfo("America/New_York")
CREDIT = "Data courtesy of Natural Stat Trick (https://www.naturalstattrick.com)"
# Situations to pull: all strengths and 5-on-5.
SITUATIONS = ["all", "5v5"]


def current_season(now: datetime) -> str:
    """NST labels a season by both years, e.g. 20262027; a new one starts in September."""
    start = now.year if now.month >= 9 else now.year - 1
    return f"{start}{start + 1}"


def goalie_params(season: str, sit: str) -> dict:
    return {
        "fromseason": season,
        "thruseason": season,
        "stype": "2",       # regular season
        "sit": sit,
        "score": "all",
        "stdoi": "g",       # goalies
        "rate": "n",        # counts, not per-60 rates
        "team": "ALL",
        "pos": "S",
        "loc": "B",
        "toi": "0",
        "gpfilt": "none",
        "lines": "single",
        "draftteam": "ALL",
    }


def fetch(params: dict, key: str) -> str:
    req = urllib.request.Request(
        f"{BASE_URL}?{urllib.parse.urlencode(params)}",
        headers={
            "nst-key": key,
            "User-Agent": "GoaltendingJournalBot/1.0 (daily, once per day)",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", errors="replace")


class TableParser(HTMLParser):
    """Collects the rows of the first <table> in a page."""

    def __init__(self):
        super().__init__()
        self.rows: list[list[str]] = []
        self._depth = 0
        self._done = False
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        if self._done:
            return
        if tag == "table":
            self._depth += 1
        elif self._depth == 1 and tag == "tr":
            self._row = []
        elif self._depth == 1 and tag in ("td", "th") and self._row is not None:
            self._cell = []

    def handle_endtag(self, tag):
        if self._done:
            return
        if tag == "table":
            self._depth -= 1
            if self._depth == 0 and self.rows:
                self._done = True
        elif tag in ("td", "th") and self._cell is not None:
            self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            if self._row:
                self.rows.append(self._row)
            self._row = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)


def parse_table(html: str) -> list[dict]:
    parser = TableParser()
    parser.feed(html)
    if len(parser.rows) < 2:
        return []
    header, *body = parser.rows
    return [dict(zip(header, r)) for r in body if len(r) == len(header)]


def to_csv(rows: list[dict]) -> str:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue()


def main() -> int:
    key = os.environ.get("NST_KEY", "").strip()
    if not key:
        print("NST_KEY is not set; add it as a repository secret.", file=sys.stderr)
        return 1

    now = datetime.now(EASTERN)
    season = current_season(now)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    files = {}
    for i, sit in enumerate(SITUATIONS):
        if i:
            time.sleep(5)  # be gentle: a few seconds between requests
        try:
            html = fetch(goalie_params(season, sit), key)
        except urllib.error.HTTPError as e:
            print(f"Natural Stat Trick returned HTTP {e.code} for {sit} ({season})", file=sys.stderr)
            return 1
        rows = parse_table(html)
        if not rows or "Player" not in rows[0]:
            print(f"No goalie table found for {sit} ({season}); first 300 chars:\n{html[:300]}",
                  file=sys.stderr)
            return 1
        name = f"goalies_{season}_{sit}.csv"
        (OUT_DIR / name).write_text(to_csv(rows), encoding="utf-8")
        files[sit] = {"file": name, "goalies": len(rows)}
        print(f"Saved {len(rows)} goalies for {sit} ({season})")

    summary = {
        "season": f"{season[:4]}-{season[4:]}",
        "fetched_at": now.isoformat(timespec="seconds"),
        "source": BASE_URL,
        "credit": CREDIT,
        "files": files,
    }
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
