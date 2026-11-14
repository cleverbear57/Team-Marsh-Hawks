"""Download primary California agronomy sources and point SSURGO records.

Python standard library only. The exact query, raw response and response metadata
are retained. Derived CSV files are convenience views, not new measurements.
"""
from __future__ import annotations
import argparse
import csv
import datetime as dt
import hashlib
import json
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw" / "local" / "agronomy"
DERIVED = ROOT / "derived"
ENDPOINT = "https://sdmdataaccess.nrcs.usda.gov/Tabular/post.rest"
POINTS = [
    ("davis", "Southern Sacramento Valley / Davis", 38.54, -121.75),
    ("five_points", "San Joaquin Valley / Five Points", 36.36, -120.10),
    ("salinas", "Central Coast / Salinas", 36.65, -121.65),
    ("el_centro", "Imperial Valley / El Centro", 32.80, -115.55),
    ("colusa", "Sacramento Valley / Colusa", 39.20, -122.00),
    ("tulelake", "Intermountain / Tulelake", 41.96, -121.47),
    ("santa_maria", "South Central Coast / Santa Maria", 34.95, -120.45),
    ("bakersfield", "Southern San Joaquin Valley / Bakersfield", 35.35, -119.15),
]

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def fetch(url, target, payload=None):
    target.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers={
        "User-Agent": "CaliforniaRotationResearch/1.0 (primary-source archive)",
        **({"Content-Type": "application/json"} if data else {}),
    })
    meta = {"source_url": url, "retrieved_at_utc": now(),
            "file": target.relative_to(ROOT).as_posix(),
            "method": "POST" if data else "GET"}
    if payload is not None:
        request_path = target.with_suffix(".request.json")
        request_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        meta["request_file"] = request_path.relative_to(ROOT).as_posix()
    try:
        with urllib.request.urlopen(req, timeout=75) as response:
            body = response.read()
            meta.update(status="downloaded", http_status=response.status,
                        final_url=response.url,
                        response_headers=dict(response.headers), bytes=len(body),
                        sha256=hashlib.sha256(body).hexdigest())
        target.write_bytes(body)
    except Exception as exc:
        meta.update(status="failed", error=f"{type(exc).__name__}: {exc}")
        if isinstance(exc, urllib.error.HTTPError):
            body = exc.read()
            target.with_suffix(target.suffix + ".error.txt").write_bytes(body)
    target.with_suffix(target.suffix + ".metadata.json").write_text(
        json.dumps(meta, indent=2), encoding="utf-8")
    return meta

def soil_query(lat, lon):
    return f"""SELECT l.areasymbol, l.areaname, l.lkey,
       m.mukey, m.musym, m.muname,
       c.cokey, c.compname, c.comppct_r, c.majcompflag, c.compkind,
       c.drainagecl, c.hydgrp, c.taxclname,
       h.chkey, h.hzname, h.hzdept_l, h.hzdept_r, h.hzdept_h,
       h.hzdepb_l, h.hzdepb_r, h.hzdepb_h,
       h.sandtotal_l, h.sandtotal_r, h.sandtotal_h,
       h.silttotal_l, h.silttotal_r, h.silttotal_h,
       h.claytotal_l, h.claytotal_r, h.claytotal_h,
       h.om_l, h.om_r, h.om_h,
       h.ph1to1h2o_l, h.ph1to1h2o_r, h.ph1to1h2o_h,
       h.awc_l, h.awc_r, h.awc_h,
       h.dbthirdbar_l, h.dbthirdbar_r, h.dbthirdbar_h,
       h.ksat_l, h.ksat_r, h.ksat_h,
       h.ec_l, h.ec_r, h.ec_h
FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('POINT({lon} {lat})') AS p
JOIN mapunit AS m ON m.mukey = p.mukey
JOIN legend AS l ON l.lkey = m.lkey
LEFT JOIN component AS c ON c.mukey = m.mukey
LEFT JOIN chorizon AS h ON h.cokey = c.cokey
ORDER BY m.mukey, c.comppct_r DESC, c.cokey, h.hzdept_r, h.chkey"""

def fetch_soil(point):
    region_id, region_label, lat, lon = point
    path = RAW / "ssurgo" / f"{region_id}.json"
    meta = fetch(ENDPOINT, path, {"query": soil_query(lat, lon), "format": "JSON+COLUMNNAME"})
    meta.update(region_id=region_id, region_label=region_label,
                latitude=lat, longitude=lon, coordinate_crs="EPSG:4326",
                selection="all intersecting mapunits; all components; all horizons")
    rows = []
    if meta["status"] == "downloaded":
        try:
            raw = json.loads(path.read_text(encoding="utf-8-sig"))
            table = raw.get("Table", [])
            if table:
                columns = table[0]
                for values in table[1:]:
                    rows.append({"region_id": region_id, "latitude": lat,
                                 "longitude": lon, **dict(zip(columns, values))})
            meta["horizon_rows"] = len(rows)
            if not rows:
                meta["status"] = "downloaded_no_records"
                meta["response_keys"] = list(raw)
        except Exception as exc:
            meta.update(status="parse_failed", error=str(exc))
    path.with_suffix(".json.metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta, rows

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--soils", action="store_true")
    parser.add_argument("--sources", action="store_true")
    parser.add_argument("--source-ids", nargs="*", help="Limit source downloads to these catalog IDs")
    args = parser.parse_args()
    RAW.mkdir(parents=True, exist_ok=True)
    DERIVED.mkdir(parents=True, exist_ok=True)
    entries = []
    manifest_path = RAW / "manifest.json"
    if manifest_path.exists():
        entries = json.loads(manifest_path.read_text(encoding="utf-8")).get("sources", [])
    if args.soils:
        with ThreadPoolExecutor(max_workers=3) as pool:
            soils = list(pool.map(fetch_soil, POINTS))
        entries = [e for e in entries if not e.get("region_id")]
        entries.extend(meta for meta, _ in soils)
        rows = [row for _, region_rows in soils for row in region_rows]
        if rows:
            with (DERIVED / "ssurgo_point_horizons.csv").open("w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=list(rows[0]))
                writer.writeheader()
                writer.writerows(rows)
        print(json.dumps([{k:m.get(k) for k in ["region_id","status","horizon_rows","error"]} for m,_ in soils], indent=2))
    if args.sources:
        source_specs = json.loads((RAW / "source_catalog.json").read_text(encoding="utf-8"))
        if args.source_ids:
            source_specs = [s for s in source_specs if s["source_id"] in args.source_ids]
        def one(spec):
            meta = fetch(spec["url"], RAW / "sources" / spec["filename"])
            meta.update({k:v for k,v in spec.items() if k not in ["url", "filename"]})
            return meta
        with ThreadPoolExecutor(max_workers=4) as pool:
            downloaded = list(pool.map(one, source_specs))
        ids = {e["source_id"] for e in downloaded}
        entries = [e for e in entries if e.get("source_id") not in ids]
        entries.extend(downloaded)
        print(json.dumps([{k:e.get(k) for k in ["source_id","status","bytes","error"]} for e in downloaded], indent=2))
    manifest_path.write_text(json.dumps({
        "updated_at_utc":now(), "scope":"California local soil map and primary agronomy evidence",
        "sources":entries,
        "raw_preservation":"Response bodies stored unchanged; derived CSV uses blank for SQL null; raw JSON preserves nulls.",
        "soil_limitation":"SSURGO map estimates at illustrative coordinates, not field soil tests or measured farm profiles."
    }, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
