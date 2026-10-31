"""Goalie Cards: rebuilds goalie-cards-data.js, the 2026-27 Collection Binder's slots and the card-back text.

One slot per goalie who has played a 2026-27 regular-season game (goalies-data.js, NHL stats feed). A goalie gets one
slot, filed under his first 2026-27 team; once made, a slot keeps its team and is never removed, so a traded goalie
stays where he was first filed. Order: four divisions, teams A to Z, goalies by games played. Each slot carries today's
stat line and archetype pose (goalie-types-data.js; "streaky" until a goalie has one), which a card freezes when it is
filed. The card backs come from goalie-cards-content.json, one row per brief or module.
Run by the morning stats workflow after build_goalies_data.py and build_goalie_types.py."""
import json, os

EDITION = "2026-27"
OUT = "goalie-cards-data.js"
# Divisions from the NHL standings feed (api-web.nhle.com/v1/standings/now), 30 Oct 2026
DIVISIONS = {
    "Atlantic": "BOS BUF DET FLA MTL OTT TBL TOR",
    "Metropolitan": "CAR CBJ NJD NYI NYR PHI PIT WSH",
    "Central": "CHI COL DAL MIN NSH STL UTA WPG",
    "Pacific": "ANA CGY EDM LAK SEA SJS VAN VGK",
}
DIV_OF = {t: d for d, ts in DIVISIONS.items() for t in ts.split()}


def read_js(path):
    s = open(path, encoding="utf-8").read()
    return json.loads(s[s.index("{"):s.rindex("}") + 1])


def main():
    stats = read_js("goalies-data.js")
    types = read_js("goalie-types-data.js") if os.path.exists("goalie-types-data.js") else {"goalies": []}
    pose = {g["id"]: g["type"] for g in types["goalies"] if g.get("type")}
    content = json.load(open("goalie-cards-content.json", encoding="utf-8"))["items"]
    old = {s["id"]: s for s in read_js(OUT)["slots"]} if os.path.exists(OUT) else {}

    slots = {}
    for g in stats["goalies"]:
        line = g["seasons"].get(EDITION) or {}
        if not line.get("gp") and g["id"] not in old:
            continue
        team = old[g["id"]]["team"] if g["id"] in old else line["team"].split(",")[0]
        if team not in DIV_OF:
            print("skipped, unknown team:", g["name"], team)
            continue
        slots[g["id"]] = {"slot": f"2627-{team}-{g['id']}", "id": g["id"], "name": g["name"], "team": team,
                          "division": DIV_OF[team], "catches": g.get("catches") or "",
                          "gp": line.get("gp", 0), "svp": line.get("svp"), "gaa": line.get("gaa"),
                          "pose": pose.get(g["id"], "streaky")}
    for i, s in old.items():                     # a slot never disappears, even if its goalie drops out of the feed
        slots.setdefault(i, s)

    order = list(DIVISIONS)
    out = sorted(slots.values(), key=lambda s: (order.index(s["division"]), s["team"], -s["gp"], s["name"]))
    data = {"edition": EDITION, "asOf": stats["asOf"], "rule": "One slot per goalie with a 2026-27 regular-season game",
            "source": "NHL stats feed (api.nhle.com), regular season", "divisions": order, "slots": out, "content": content}
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("/* Goalie Cards: the 2026-27 Collection Binder's slots (one per goalie with a regular-season game, never removed)\n"
                "   with today's stat line and archetype pose, and the card-back text for each brief or module.\n"
                "   Rebuilt each morning by build_goalie_cards.py; edit goalie-cards-content.json, not this file. */\n")
        f.write("window.GOALIE_CARDS = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(len(out), "slots,", len(content), "briefs and modules")


if __name__ == "__main__":
    main()
