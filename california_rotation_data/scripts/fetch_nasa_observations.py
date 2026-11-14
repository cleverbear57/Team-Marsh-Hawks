"""Download small NASA EO responses without credentials; retain original bytes.

Run with Python 3 and curl on PATH. No nonstandard Python dependencies.
Requests are constrained to public NASA/NSIDC/USGS product endpoints. The
manifest distinguishes catalog metadata, raster values, and access failures.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "raw" / "nasa" / "observations"
CURL = shutil.which("curl.exe") or shutil.which("curl")
SITES = {"davis": (-121.75, 38.54), "five_points": (-120.10, 36.36),
         "salinas": (-121.65, 36.65), "el_centro": (-115.55, 32.80)}
GIS = "https://gis.earthdata.nasa.gov/portal"
GPM = GIS + "/rest/services/GESDISC/GPM_3IMERGHH/ImageServer"
SMAP = GIS + "/rest/services/DISASTERS_202609_HURRICANE_NOLO/202624_smap/ImageServer"
ECO = GIS + "/rest/services/DISASTERS_202501_FIRE_CA/2501_ecostress/ImageServer"


def url(base, **params):
    return base + "?" + urllib.parse.urlencode({k: json.dumps(v, separators=(",", ":")) if isinstance(v, (dict, list)) else v for k, v in params.items()})


def fetch(name, source, kind="metadata", note=None):
    """Preserve response bytes and response headers; never use .netrc/auth."""
    dest = OUT / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    fetched_at = datetime.now(timezone.utc).isoformat()
    response_path = dest.with_name(dest.name + ".response.json")
    if dest.exists() and response_path.exists():
        rec = json.loads(response_path.read_text(encoding="utf-8"))
        if rec["source_url"] == source and rec["http_status"] == 200:
            try:
                return json.loads(dest.read_text(encoding="utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return None
    p = subprocess.run([CURL, "--disable", "--silent", "--show-error", "--location",
                        "--connect-timeout", "15", "--max-time", "50", "--max-redirs", "5",
                        "--user-agent", "CaliforniaRotationDataResearch/1.0",
                        "--dump-header", str(dest) + ".headers.txt", "--output", str(dest),
                        "--write-out", "%{http_code}\n%{url_effective}\n%{content_type}\n", source],
                       capture_output=True, timeout=55)
    lines = p.stdout.decode("utf-8", errors="replace").splitlines()
    body = dest.read_bytes() if dest.exists() else b""
    rec = {"path": str(dest.relative_to(OUT)).replace("\\", "/"), "source_url": source,
           "fetched_at_utc": fetched_at, "http_status": int(lines[0]) if lines and lines[0].isdigit() else None,
           "final_url": lines[1] if len(lines) > 1 else None,
           "content_type": lines[2] if len(lines) > 2 else None,
           "kind": kind, "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest(),
           "curl_exit_code": p.returncode, "curl_error": p.stderr.decode("utf-8", errors="replace"),
           "note": note}
    response_path.write_text(json.dumps(rec, indent=2) + "\n", encoding="utf-8")
    print(f"{rec['http_status']} {name} {len(body)} bytes", flush=True)
    try:
        return json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None


def bootstrap():
    jobs = [
        ("discovery/catalog_start.html", "https://data.nasa.gov/dataset/"),
        ("gis/gpm_service.json", url(GPM, f="pjson")),
        ("gis/gpm_item.json", url(GIS + "/sharing/rest/content/items/cfa9a890b89b49d884871567844e9080", f="pjson")),
        ("gis/gpm_multidimensional.json", url(GPM + "/multidimensionalInfo", f="pjson")),
        ("gis/smap_service.json", url(SMAP, f="pjson")),
        ("gis/smap_item.json", url(GIS + "/sharing/rest/content/items/6653758c36164234b86a1ced5c8181cf", f="pjson")),
        ("gis/smap_webmap_item.json", url(GIS + "/sharing/rest/content/items/b92f40291766442c9c4311f7857db412", f="pjson")),
        ("gis/smap_rasters.json", url(SMAP + "/query", f="pjson", where="1=1", outFields="*", returnGeometry="false")),
        ("gis/ecostress_service.json", url(ECO, f="pjson")),
        ("gis/ecostress_rasters.json", url(ECO + "/query", f="pjson", where="1=1", outFields="*", returnGeometry="false")),
        ("discovery/gis_smap_search.json", url(GIS + "/sharing/rest/search", q="SMAP", f="pjson", num=100)),
        ("discovery/gis_ecostress_search.json", url(GIS + "/sharing/rest/search", q="ECOSTRESS", f="pjson", num=100)),
    ]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        list(ex.map(lambda x: fetch(*x), jobs))


def gpm_samples():
    # Three full UTC days: a wet winter event, spring, and dry summer example.
    # Use these as illustrative snapshots, never as a climate normal.
    for date in ["2023-01-09", "2023-04-01", "2023-07-01"]:
        t0 = int(datetime.fromisoformat(date).replace(tzinfo=timezone.utc).timestamp() * 1000)
        rasters = fetch(f"gpm/{date}_rasters.json", url(GPM + "/query", f="pjson",
                        where=f"stdtime >= {t0} AND stdtime < {t0 + 86400000}",
                        outFields="*", returnGeometry="false", orderByFields="stdtime", resultRecordCount=100))
        if not rasters or "error" in rasters or not rasters.get("features"):
            rasters = fetch(f"gpm/{date}_rasters_timestamp.json", url(GPM + "/query", f="pjson",
                where=f"stdtime >= timestamp '{date} 00:00:00' AND stdtime <= timestamp '{date} 23:59:59'",
                outFields="*", returnGeometry="false", orderByFields="stdtime", resultRecordCount=100))
        if not rasters or not rasters.get("features"):
            continue
        ids = [f["attributes"]["objectid"] for f in rasters["features"]]
        # Image service permits at most 20 rasters per request. 16 fits evenly
        # into a 48-sample day. nearest neighbor avoids spatial averaging.
        jobs = []
        for site, (lon, lat) in SITES.items():
            for k in range(0, len(ids), 16):
                jobs.append((f"gpm/{date}_{site}_{k:02d}.json", url(GPM + "/getSamples",
                    f="pjson", geometry={"x": lon, "y": lat, "spatialReference": {"wkid": 4326}},
                    geometryType="esriGeometryPoint", returnFirstValueOnly="false",
                    outFields="*", interpolation="RSP_NearestNeighbor",
                    mosaicRule={"mosaicMethod": "esriMosaicLockRaster", "lockRasterIds": ids[k:k+16], "mosaicOperation": "MT_FIRST"},
                    renderingRule={"rasterFunction": "None"}), "observation_response",
                    "Raw numeric pixel sample of IMERG Final precipitation; rate units mm/hour, not daily total. Check service product/version metadata."))
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
            list(ex.map(lambda x: fetch(*x), jobs))


def smap_samples():
    rasters = json.loads((OUT / "gis/smap_rasters.json").read_text())
    ids = [f["attributes"]["objectid"] for f in rasters.get("features", [])]
    for site, (lon, lat) in SITES.items():
        fetch(f"smap/{site}.json", url(SMAP + "/getSamples", f="pjson",
              geometry={"x": lon, "y": lat, "spatialReference": {"wkid": 4326}},
              geometryType="esriGeometryPoint", returnFirstValueOnly="false", outFields="*",
              interpolation="RSP_NearestNeighbor", renderingRule={"rasterFunction": "None"},
              mosaicRule={"mosaicMethod": "esriMosaicLockRaster", "lockRasterIds": ids, "mosaicOperation": "MT_FIRST"}),
              "observation_response", "SMAP L4 model-assimilated soil wetness service; inspect raster names to distinguish surface/root-zone; never direct root-zone measurement.")


def index_responses():
    records = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(OUT.rglob("*.response.json"))]
    data = {"generated_at_utc": datetime.now(timezone.utc).isoformat(), "discovery_start": "https://data.nasa.gov/dataset/",
            "method": "Public HTTPS downloads, no credentials; byte-for-byte response bodies retained with headers and hashes.",
            "files": records, "response_count": len(records), "response_body_bytes": sum(r["bytes"] for r in records),
            "sites": {k: {"longitude": v[0], "latitude": v[1], "crs": "EPSG:4326"} for k, v in SITES.items()},
            "warning": "Metadata files are not observations. observation_response means the requested operation; inspect for numeric samples/errors. See research/nasa_observations.md and product summaries for validated counts and scientific limits."}
    (OUT / "manifest.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=["bootstrap", "gpm", "smap", "index", "all"], default="all", nargs="?")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    try:
        if args.phase in ["bootstrap", "all"]: bootstrap()
        if args.phase in ["gpm", "all"]: gpm_samples()
        if args.phase in ["smap", "all"]: smap_samples()
    finally:
        index_responses()
