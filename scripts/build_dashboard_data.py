"""Build data/dashboard_sales.json, the compact file the dashboard (index.html) reads.

Reads data/college_town_home_sales.csv (never modifies it) and writes only the columns the
site uses, in a column-oriented layout so the browser downloads far less than the 9 MB CSV.
Every row is kept. The price rule, the living-area rule and all aggregations are applied in
the browser (js/app.js), so each number on the site is computed from these rows.

Run from the repository root:
    python3 scripts/build_dashboard_data.py

Uses only the Python standard library.
"""

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "college_town_home_sales.csv"
OUT = ROOT / "data" / "dashboard_sales.json"


def to_int(value):
    return int(float(value)) if value != "" else None


def to_flag(value):
    return int(float(value)) if value != "" else None


def main():
    # zipcode, county_fips and parcel_number stay text; the csv module never converts them.
    with SRC.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))

    city_keys = sorted({(r["city"], r["state"]) for r in rows})
    universities = sorted({r["university"] for r in rows})
    city_index = {key: i for i, key in enumerate(city_keys)}
    uni_index = {name: i for i, name in enumerate(universities)}

    cols = {k: [] for k in ["city", "uni", "miles", "date", "price", "beds", "area",
                            "built", "garage", "basement", "fireplace", "lat", "lon"]}
    for r in rows:
        cols["city"].append(city_index[(r["city"], r["state"])])
        cols["uni"].append(uni_index[r["university"]])
        cols["miles"].append(float(r["miles_to_campus"]))
        cols["date"].append(r["sale_date"] or None)
        cols["price"].append(int(r["sale_price"]))
        cols["beds"].append(int(r["beds"]))
        cols["area"].append(to_int(r["living_area_sqft"]))
        cols["built"].append(to_int(r["year_built"]))
        cols["garage"].append(to_flag(r["has_garage"]))
        cols["basement"].append(to_flag(r["has_basement"]))
        cols["fireplace"].append(to_flag(r["has_fireplace"]))
        cols["lat"].append(round(float(r["latitude"]), 4))
        cols["lon"].append(round(float(r["longitude"]), 4))

    out = {
        "source": "College-town home sales dataset, version 1.0 (2026). Data collected March 2026.",
        "built_from": "data/college_town_home_sales.csv by scripts/build_dashboard_data.py",
        "rows": len(rows),
        "cities": [{"city": c, "state": s} for c, s in city_keys],
        "universities": universities,
        "columns": cols,
    }
    OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(rows)} rows, {OUT.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
