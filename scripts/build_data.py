"""Build public/data/happiness.json from the raw WHR / ISO / OWID files.

Usage: python3 scripts/build_data.py   (or `npm run data`)
Raw inputs live in data-raw/ (see README for download URLs).
"""
import csv
import json
import os
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(__file__))
from xlsx_reader import read_xlsx  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data-raw")
OUT = os.path.join(ROOT, "public", "data", "happiness.json")

# WHR name -> ISO alpha-3 where the names differ from the ISO list.
ALIASES = {
    "Bolivia": "BOL", "Congo (Brazzaville)": "COG", "Congo (Kinshasa)": "COD",
    "Czechia": "CZE", "Hong Kong SAR of China": "HKG", "Iran": "IRN",
    "Ivory Coast": "CIV", "Kosovo": "XKX", "Laos": "LAO", "Moldova": "MDA",
    "North Cyprus": "XNC", "Russia": "RUS", "Somaliland region": "XSL",
    "South Korea": "KOR", "State of Palestine": "PSE", "Syria": "SYR",
    "Taiwan Province of China": "TWN", "Tanzania": "TZA", "Türkiye": "TUR",
    "Turkiye": "TUR", "United Kingdom": "GBR", "United States": "USA",
    "Venezuela": "VEN", "Vietnam": "VNM", "Eswatini": "SWZ",
    "Netherlands": "NLD", "Bosnia and Herzegovina": "BIH",
    "North Macedonia": "MKD", "Swaziland": "SWZ", "Macedonia": "MKD",
    "Palestinian Territories": "PSE", "Somaliland": "XSL",
    "Republic of Moldova": "MDA", "Lao PDR": "LAO", "Gambia": "GMB",
    "DR Congo": "COD", "Republic of Korea": "KOR", "Somaliland Region": "XSL",
}
# Countries without ISO entries: (name, world-atlas feature name, region).
EXTRA = {
    "XKX": ("Kosovo", "Kosovo", "Eastern Europe & Central Asia"),
    "XNC": ("North Cyprus", "N. Cyprus", "Western Europe"),
    "XSL": ("Somaliland", "Somaliland", "Sub-Saharan Africa"),
}
POP_CODES = {"XKX": "OWID_KOS"}
REGION_FIX = {"TWN": "East & Southeast Asia"}
DISPLAY = {
    "KOR": "South Korea", "RUS": "Russia", "HKG": "Hong Kong", "TWN": "Taiwan",
    "LAO": "Laos", "VNM": "Vietnam", "XSL": "Somaliland", "MDA": "Moldova",
    "PSE": "Palestine", "COD": "DR Congo", "COG": "Congo", "TUR": "Türkiye",
    "CIV": "Côte d’Ivoire", "SWZ": "Eswatini", "MKD": "North Macedonia",
}
CAUCASUS = {"ARM", "AZE", "GEO"}
BALKANS = {"ALB", "BIH", "HRV", "MNE", "MKD", "SRB", "SVN", "XKX"}


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return "".join(ch for ch in s.lower() if ch.isalnum())


def region_for(iso3, region, sub):
    if iso3 in CAUCASUS or iso3 in BALKANS:
        return "Eastern Europe & Central Asia"
    if iso3 == "IRN":
        return "Middle East & North Africa"
    if sub in ("Northern Europe", "Western Europe", "Southern Europe"):
        return "Western Europe"
    if sub in ("Eastern Europe", "Central Asia"):
        return "Eastern Europe & Central Asia"
    if sub in ("Northern America", "Australia and New Zealand"):
        return "North America & Oceania"
    if sub == "Latin America and the Caribbean":
        return "Latin America & Caribbean"
    if sub in ("Western Asia", "Northern Africa"):
        return "Middle East & North Africa"
    if sub == "Sub-Saharan Africa":
        return "Sub-Saharan Africa"
    if sub == "Southern Asia":
        return "South Asia"
    if sub in ("Eastern Asia", "South-eastern Asia"):
        return "East & Southeast Asia"
    return region or "Other"


def load_iso():
    by_name, by_code = {}, {}
    with open(os.path.join(RAW, "iso.csv"), encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rec = (row["name"], row["country-code"], region_for(
                row["alpha-3"], row["region"], row["sub-region"]))
            by_code[row["alpha-3"]] = rec
            by_name[norm(row["name"])] = row["alpha-3"]
            short = row["name"].split(" (")[0].split(",")[0]
            by_name.setdefault(norm(short), row["alpha-3"])
    by_code.update(EXTRA)
    return by_name, by_code


def load_population():
    pop = {}
    with open(os.path.join(RAW, "population.csv"), encoding="utf-8") as f:
        for row in csv.DictReader(f):
            code, year = row["code"], int(row["year"])
            if code and year >= 2010:
                pop.setdefault(code, {})[year] = int(float(row["population_historical"]))
    return pop


def main():
    rows = read_xlsx(os.path.join(RAW, "whr26.xlsx"))
    header, body = rows[0], [r for r in rows[1:] if r and r[0]]
    by_name, by_code = load_iso()
    pop = load_population()
    years = sorted({int(r[0]) for r in body})
    countries, missing = {}, set()
    for r in body:
        name = r[2]
        iso3 = ALIASES.get(name) or by_name.get(norm(name))
        if not iso3:
            missing.add(name)
            continue
        _, num, region = by_code[iso3]
        c = countries.setdefault(iso3, {
            "id": iso3, "name": DISPLAY.get(iso3, name),
            "region": REGION_FIX.get(iso3, region),
            "v": [None] * len(years),
        })
        if iso3 in EXTRA:
            c["mapName"] = num  # world-atlas feature has no ISO id
        else:
            c["num"] = num
        vals = [r[i] if i < len(r) else None for i in (3, 4, 5, 1, *range(6, 13))]
        c["v"][years.index(int(r[0]))] = [
            round(x, 3) if isinstance(x, float) else x for x in vals
        ]
    for iso3, c in countries.items():
        p = pop.get(POP_CODES.get(iso3, iso3), {})
        c["pop"] = p[max(p)] if p else None
    if missing:
        sys.exit(f"Unmatched WHR names: {sorted(missing)}")
    out = {
        "source": "World Happiness Report 2026, Figure 2.1 (Gallup World Poll); "
                  "population: Our World in Data",
        "years": years,
        "fields": ["score", "lo", "hi", "rank", "gdp", "social", "health",
                   "freedom", "generosity", "corruption", "dystopia"],
        "countries": sorted(countries.values(), key=lambda c: c["name"]),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {len(countries)} countries x {len(years)} years "
          f"({os.path.getsize(OUT) // 1024} KB) -> {OUT}")


if __name__ == "__main__":
    main()
