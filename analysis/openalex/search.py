"""Search OpenAlex for ice hockey goaltending research and save every hit, for comparison with the Oracle.

Run by .github/workflows/openalex-search.yml. Reads an optional OpenAlex API key from the OPENALEX_KEY
environment variable (a repository secret); without it the polite pool is used. Writes hits.jsonl.
"""
import json, os, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
KEY = os.environ.get("OPENALEX_KEY", "").strip()
QUERIES = [
    "goaltender", "goaltenders", "goaltending", "goalie hockey", "goalies hockey", "hockey goalkeeper",
    "ice hockey goalkeeper", "netminder", "gardien de but hockey", "målvakt ishockey", "maalivahti jääkiekko",
    "brankář hokej", "Torhüter Eishockey", "butterfly style hockey", "goalie pads",
]
FIELDS = "id,doi,title,publication_year,type,language,authorships,primary_location,abstract_inverted_index,cited_by_count,keywords,topics"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "goaltendingjournal research search"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            if attempt == 3:
                raise
            print(f"retry {attempt + 1}: {e}", file=sys.stderr)
            time.sleep(3 * (attempt + 1))


def main():
    seen, out = set(), open(os.path.join(HERE, "hits.jsonl"), "w", encoding="utf-8")
    for q in QUERIES:
        cursor, n = "*", 0
        while cursor and n < 2000:
            params = {"filter": f"title_and_abstract.search:{q}", "per-page": "200", "cursor": cursor, "select": FIELDS}
            if KEY:
                params["api_key"] = KEY
            data = get("https://api.openalex.org/works?" + urllib.parse.urlencode(params))
            for w in data.get("results", []):
                n += 1
                if w["id"] in seen:
                    continue
                seen.add(w["id"])
                w["matched_query"] = q
                out.write(json.dumps(w, ensure_ascii=False) + "\n")
            cursor = data.get("meta", {}).get("next_cursor")
            time.sleep(0.2)
        print(f"{q!r}: {n} results")
    print(f"{len(seen)} unique works (key {'used' if KEY else 'not set'})")


if __name__ == "__main__":
    main()
