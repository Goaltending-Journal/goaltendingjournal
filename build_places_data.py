"""Rebuild places-data.js: the world map behind "Where the research happens" on research.html.

Run by hand after researchers-data.js changes (new researcher, new affiliation):

  python build_places_data.py

Reads each researcher's current (or last known) organisation from researchers-data.js, places it in a
city from the ORGS table below, and draws the land from data/world/land-50m.json (world-atlas 2.0.2,
Natural Earth 1:50m, ISC licence) in the Equal Earth projection. Uses only the standard library.
An organisation missing from ORGS is reported and left off the map; add it here and re-run.
"""

import json
import math
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "places-data.js"
W = 1000  # map width in SVG units; the height follows from the projection

# organisation -> city
ORGS = {
    "Dalhousie University": "Halifax",
    "Acadia University": "Wolfville",
    "Memorial University of Newfoundland": "St. John's",
    "University of Toronto": "Toronto",
    "York University": "Toronto",
    "Mount Sinai Hospital": "Toronto",
    "Ontario Tech University": "Oshawa",
    "Brock University": "St. Catharines",
    "University of Ottawa": "Ottawa",
    "Western University": "London",
    "University of Guelph": "Guelph",
    "McGill University": "Montréal",
    "Université du Québec à Montréal": "Montréal",
    "Université Laval": "Québec City",
    "Université du Québec à Trois-Rivières": "Trois-Rivières",
    "Université du Québec à Chicoutimi": "Saguenay",
    "University of Calgary": "Calgary",
    "University of Alberta": "Edmonton",
    "Simon Fraser University": "Burnaby",
    "University of Michigan": "Ann Arbor",
    "Mayo Clinic": "Rochester",
    "Mayo Clinic Sports Medicine Center": "Rochester",
    "Twin Cities Orthopedics": "Minneapolis–St. Paul",
    "Gillette Children's": "Minneapolis–St. Paul",
    "Hospital for Special Surgery": "New York",
    "Baptist Health Orthopedic Care": "Boca Raton",
    "The Steadman Clinic": "Vail",
    "University of North Carolina at Charlotte": "Charlotte",
    "University of Mary": "Bismarck",
    "Hendrix College": "Conway",
    "University College Dublin": "Dublin",
    "Lund University": "Lund",
    "Swedish Ice Hockey Association": "Stockholm",
    "University of Jyväskylä": "Jyväskylä",
    "JYP Jyväskylä": "Jyväskylä",
    "Charles University": "Prague",
    "La Trobe University": "Melbourne",
}
# city -> (country, latitude, longitude)
CITIES = {
    "Halifax": ("Canada", 44.65, -63.58),
    "Wolfville": ("Canada", 45.09, -64.36),
    "St. John's": ("Canada", 47.57, -52.73),
    "Toronto": ("Canada", 43.66, -79.40),
    "Oshawa": ("Canada", 43.94, -78.90),
    "St. Catharines": ("Canada", 43.12, -79.25),
    "Ottawa": ("Canada", 45.42, -75.68),
    "London": ("Canada", 43.01, -81.27),
    "Guelph": ("Canada", 43.53, -80.23),
    "Montréal": ("Canada", 45.50, -73.58),
    "Québec City": ("Canada", 46.78, -71.27),
    "Trois-Rivières": ("Canada", 46.35, -72.58),
    "Saguenay": ("Canada", 48.42, -71.05),
    "Calgary": ("Canada", 51.08, -114.13),
    "Edmonton": ("Canada", 53.52, -113.53),
    "Burnaby": ("Canada", 49.28, -122.92),
    "Ann Arbor": ("USA", 42.28, -83.74),
    "Rochester": ("USA", 44.02, -92.47),
    "Minneapolis–St. Paul": ("USA", 44.96, -93.18),
    "New York": ("USA", 40.77, -73.95),
    "Boca Raton": ("USA", 26.37, -80.10),
    "Vail": ("USA", 39.64, -106.37),
    "Charlotte": ("USA", 35.31, -80.73),
    "Bismarck": ("USA", 46.81, -100.78),
    "Conway": ("USA", 35.10, -92.44),
    "Dublin": ("Ireland", 53.31, -6.22),
    "Lund": ("Sweden", 55.71, 13.19),
    "Stockholm": ("Sweden", 59.33, 18.07),
    "Jyväskylä": ("Finland", 62.24, 25.75),
    "Prague": ("Czechia", 50.09, 14.42),
    "Melbourne": ("Australia", -37.72, 145.05),
}
# map views: (label, west, south, east, north)
VIEWS = [
    ("North America", -126, 24, -51, 57),
    ("Europe", -13, 47, 33, 66),
]
LAT_MIN, LAT_MAX = -56, 84  # crop Antarctica and the far Arctic

A1, A2, A3, A4 = 1.340264, -0.081106, 0.000893, 0.003796
M = math.sqrt(3) / 2


def equal_earth(lon, lat):
    lam, phi = math.radians(lon), math.radians(lat)
    th = math.asin(M * math.sin(phi))
    t2 = th * th
    t6 = t2 * t2 * t2
    x = lam * math.cos(th) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)))
    y = th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))
    return x, y


X0, _ = equal_earth(-180, 0)
X1, _ = equal_earth(180, 0)
_, Y1 = equal_earth(0, LAT_MAX)
_, Y0 = equal_earth(0, LAT_MIN)
K = W / (X1 - X0)
H = round((Y1 - Y0) * K)


def proj(lon, lat):
    x, y = equal_earth(lon, max(LAT_MIN, min(LAT_MAX, lat)))
    return (x - X0) * K, (Y1 - y) * K


def read_js(path, name):
    s = path.read_text(encoding="utf-8")
    return json.loads(s[s.index("=", s.index(name)) + 1:].strip().rstrip(";"))


def num(v, after=False):
    """Shortest SVG number: no leading zero, sign or space as the separator."""
    t = f"{v:g}".replace("0.", ".", 1) if abs(v) < 1 else f"{v:g}"
    return t if t.startswith("-") else ("," if after else " ") + t


def land_path():
    topo = json.loads((HERE / "data/world/land-50m.json").read_text(encoding="utf-8"))
    (sx, sy), (tx, ty) = topo["transform"]["scale"], topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)

    def ring(ids):
        pts = []
        for i in ids:
            a = arcs[i] if i >= 0 else arcs[~i][::-1]
            pts.extend(a if not pts else a[1:])
        return pts

    out = []
    for geom in topo["objects"]["land"]["geometries"]:
        polys = geom["arcs"] if geom["type"] == "MultiPolygon" else [geom["arcs"]]
        for poly in polys:
            for rg in poly:
                pts = ring(rg)
                if max(p[1] for p in pts) < LAT_MIN:
                    continue
                # rings that cross the antimeridian (Chukotka, Wrangel, Fiji): unwrap the longitudes,
                # then pin anything past ±180 to the map edge
                lon = [pts[0][0]]
                for (a, _), (b, _) in zip(pts, pts[1:]):
                    lon.append(lon[-1] + ((b - a + 180) % 360) - 180)
                shift = max((-360, 0, 360), key=lambda k: sum(-180 <= x + k <= 180 for x in lon))
                xy = [proj(max(-180, min(180, x + shift)), p[1]) for x, p in zip(lon, pts)]
                xs, ys = [p[0] for p in xy], [p[1] for p in xy]
                if (max(xs) - min(xs)) * (max(ys) - min(ys)) < 1.5:  # drop specks
                    continue
                keep = [xy[0]]
                for p in xy[1:]:
                    if abs(p[0] - keep[-1][0]) + abs(p[1] - keep[-1][1]) >= 0.6:
                        keep.append(p)
                if len(keep) < 4:
                    continue
                # relative moves on a 0.1 grid keep the path short
                q = [(round(x * 10), round(y * 10)) for x, y in keep]
                d = [f"M{q[0][0] / 10:g},{q[0][1] / 10:g}l"]
                for (ax, ay), (bx, by) in zip(q, q[1:]):
                    d.append(f"{num((bx - ax) / 10)}{num((by - ay) / 10, True)}")
                out.append("".join(d) + "z")
    return "".join(out)


def main():
    net = read_js(HERE / "researchers-data.js", "NETWORK")
    places, missing = {}, []
    for p in net["people"]:
        org = re.sub(r"^Last known:\s*", "", p["org"] or "")
        org = re.sub(r"\s*\(.*\)$", "", org).strip()
        city = ORGS.get(org)
        if not city:
            missing.append(f"{p['id']}: {p['org'] or '(no organisation)'}")
            continue
        c = places.setdefault(city, {"orgs": {}})
        c["orgs"].setdefault(org, []).append(p["id"])
    rows = []
    for city, c in places.items():
        country, lat, lon = CITIES[city]
        x, y = proj(lon, lat)
        orgs = sorted(c["orgs"].items(), key=lambda o: (-len(o[1]), o[0]))
        rows.append({"city": city, "country": country, "x": round(x, 1), "y": round(y, 1), "orgs": [[o, ids] for o, ids in orgs]})
    rows.sort(key=lambda r: (-sum(len(o[1]) for o in r["orgs"]), r["city"]))
    views = []
    for label, w, s, e, n in VIEWS:
        corners = [proj(lon, lat) for lon in (w, e, (w + e) / 2) for lat in (s, n)]
        xs, ys = [p[0] for p in corners], [p[1] for p in corners]
        views.append([label, round(min(xs)), round(min(ys)), round(max(xs) - min(xs)), round(max(ys) - min(ys))])
    data = {"w": W, "h": H, "land": land_path(), "views": views, "places": rows}
    OUT.write_text(
        "// Where the research happens: each researcher's current or last known organisation, placed by city.\n"
        "// Generated by build_places_data.py from researchers-data.js. Land: Natural Earth via world-atlas (ISC).\n"
        "const PLACES = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    placed = sum(len(ids) for r in rows for _, ids in r["orgs"])
    print(f"{OUT.name}: {placed} researchers in {len(rows)} cities, {OUT.stat().st_size // 1024} KB")
    if missing:
        print("Not placed (no organisation in ORGS):", *missing, sep="\n  ", file=sys.stderr)


if __name__ == "__main__":
    main()
