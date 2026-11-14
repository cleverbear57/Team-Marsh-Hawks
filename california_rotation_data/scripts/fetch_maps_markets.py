"""Fetch a bounded, public primary-source geography/hydrology/economics sample.

Run from any directory: python fetch_maps_markets.py
Dependencies: requests, pyshp, pyproj, pypdf. No credentials are used.
Original downloads are preserved; manifests distinguish derived artifacts.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile

import requests
import shapefile
from pyproj import CRS, Transformer
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "raw" / "local" / "maps_markets"
NOW = datetime.now(timezone.utc).isoformat()
CENSUS_PAGE = "https://www.census.gov/geographies/mapping-files/2024/geo/carto-boundary-file.html"
CDEC_URL = "https://cdec.water.ca.gov/dynamicapp/req/CSVDataServlet?Stations=SHA,ORO,FOL,SNL&SensorNums=15&dur_code=D&Start=2024-01-01&End=2024-12-31"

SOURCES = [
    ("maps", "cb_2024_us_state_500k.zip", "https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_500k.zip", "U.S. Census Bureau", "2024 cartographic boundary state geometry; national original"),
    ("maps", "cb_2024_us_county_500k.zip", "https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_county_500k.zip", "U.S. Census Bureau", "2024 cartographic boundary county geometry; national original"),
    ("maps", "census_2024_catalog.html", CENSUS_PAGE, "U.S. Census Bureau", "Dataset catalog snapshot"),
    ("ground", "cdec_reservoir_storage_daily_2024.csv", CDEC_URL, "California Department of Water Resources CDEC", "Daily storage, sensor 15, 2024, stations SHA ORO FOL SNL; original response"),
    ("ground", "cdec_webservice_documentation.html", "https://cdec.water.ca.gov/dynamicapp/wsSensorData", "California Department of Water Resources CDEC", "Webservice documentation; timestamps use Pacific Standard Time"),
    ("markets", "uc_2023_processing_tomatoes_sacramento_sdi.pdf", "https://coststudyfiles.ucdavis.edu/uploads/pub/2023/08/21/amended_82123_2023processtomatosacramentovalleysdifinal.pdf", "UC ANR / UC Davis", "2023 Sacramento Valley and northern Delta processing tomato sample costs; amended August 21, 2023"),
    ("markets", "uc_2021_rice_sacramento.pdf", "https://coststudyfiles.ucdavis.edu/uploads/pub/2021/11/03/2021ricesacramentovalley.pdf", "UC ANR / UC Davis", "2021 Sacramento Valley medium-grain rice sample costs; rice-only rotation"),
    ("markets", "uc_2023_iceberg_lettuce_central_coast.pdf", "https://coststudyfiles.ucdavis.edu/uploads/pub/2023/08/04/2023-iceberglettuce-full-final.pdf", "UC ANR / UC Davis", "2023 film-wrapped iceberg lettuce sample costs; Monterey Santa Cruz San Benito"),
    ("markets", "uc_2023_broccoli_crowns_central_coast.pdf", "https://coststudyfiles.ucdavis.edu/uploads/pub/2023/08/04/2023-broccrowncut-full-final.pdf", "UC ANR / UC Davis", "2023 crown-cut broccoli sample costs; Monterey Santa Cruz San Benito"),
    ("markets", "cdfa_2023_2024_agricultural_statistics_review.pdf", "https://www.cdfa.ca.gov/Statistics/PDFs/2023-2024_california_agricultural_statistics_review.pdf", "California Department of Food and Agriculture / USDA NASS", "State crop acreage yield production and value tables, plus county agricultural commissioners' data"),
    ("expertise", "ucce_monterey_directory.html", "https://ucanr.edu/county/monterey-county/contact-us", "UC ANR", "Public county adviser directory snapshot; no contact made"),
    ("expertise", "uc_rice_agronomy.html", "https://agronomy-rice.ucdavis.edu/", "UC Davis / UC ANR", "Rice specialists and county advisers; no contact made"),
    ("expertise", "rcd_monterey_services.html", "https://www.rcdmonterey.org/professional-services", "Resource Conservation District of Monterey County", "Conservation and irrigation assistance; no contact made"),
    ("expertise", "ucce_capitol_corridor_vegetable_crops.html", "https://ucanr.edu/site/capitol-corridor-vegetable-crops", "UC ANR", "Yolo Solano Sacramento vegetable-crops program; no contact made"),
]
for station in ("SHA", "ORO", "FOL", "SNL"):
    SOURCES.append(("ground", f"cdec_station_{station}.html", f"https://cdec.water.ca.gov/dynamicapp/staMeta?station_id={station}", "California Department of Water Resources CDEC", "Station metadata and sensor description"))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fetch(source):
    folder, name, url, provider, description = source
    path = DEST / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    entry = dict(file=name, source_url=url, provider=provider, description=description,
                 retrieved_at_utc=NOW, artifact_type="original_download")
    try:
        response = requests.get(url, timeout=55, headers={"User-Agent": "CaliforniaRotationEducationalData/1.0 public-data-research"})
        entry.update(http_status=response.status_code, final_url=response.url,
                     content_type=response.headers.get("Content-Type"))
        response.raise_for_status()
        payload = response.content
        if name.endswith(".pdf") and not payload.startswith(b"%PDF"):
            raise ValueError("Expected PDF but response signature was not PDF")
        if name.endswith(".zip") and not payload.startswith(b"PK"):
            raise ValueError("Expected ZIP but response signature was not ZIP")
        if name.endswith(".csv") and b"STATION_ID,DURATION" not in payload[:200]:
            raise ValueError("Expected CDEC CSV header was not present")
        path.write_bytes(payload)
        entry.update(status="downloaded", bytes=path.stat().st_size, sha256=digest(path))
    except Exception as error:
        entry.update(status="failed", error=str(error), file=None)
    return folder, entry


def transform_coordinates(coords, transformer):
    if isinstance(coords[0], (int, float)):
        x, y = transformer.transform(coords[0], coords[1])
        return [x, y]
    return [transform_coordinates(c, transformer) for c in coords]


def geometry_subset(kind):
    archive = DEST / "maps" / f"cb_2024_us_{kind}_500k.zip"
    with ZipFile(archive) as z:
        names = z.namelist()
        def member(suffix):
            return next(name for name in names if name.endswith(suffix))
        wkt = z.read(member(".prj")).decode()
        src_crs = CRS.from_wkt(wkt)
        transformer = Transformer.from_crs(src_crs, "EPSG:4326", always_xy=True)
        reader = shapefile.Reader(shp=io.BytesIO(z.read(member(".shp"))),
                                  shx=io.BytesIO(z.read(member(".shx"))),
                                  dbf=io.BytesIO(z.read(member(".dbf"))))
        features = []
        for item in reader.iterShapeRecords():
            props = item.record.as_dict()
            if props.get("STATEFP") != "06":
                continue
            geom = item.shape.__geo_interface__
            geom["coordinates"] = transform_coordinates(geom["coordinates"], transformer)
            features.append(dict(type="Feature", id=props["GEOID"], properties=props, geometry=geom))
        expected = 1 if kind == "state" else 58
        assert len(features) == expected, (kind, len(features))
        output = DEST / "maps" / f"california_{kind}_2024_500k.geojson"
        output.write_text(json.dumps(dict(type="FeatureCollection", features=features), ensure_ascii=False), encoding="utf-8")
        (DEST / "maps" / f"source_{kind}.prj").write_text(wkt, encoding="utf-8")
        return dict(file=output.name, source_file=archive.name, source_url=CENSUS_PAGE,
                    retrieved_at_utc=NOW, status="derived_verified", artifact_type="derived_subset",
                    transformation="Select STATEFP=06; transform original CRS to EPSG:4326 with pyproj always_xy; preserve Census attributes and GEOID string",
                    original_crs=src_crs.to_string(), output_crs="EPSG:4326 longitude, latitude (GeoJSON RFC 7946)",
                    original_crs_wkt_file=f"source_{kind}.prj", feature_count=len(features),
                    scale="1:500000 generalized; not parcel or field boundaries", bytes=output.stat().st_size, sha256=digest(output))


def hydrology_subset():
    path = DEST / "ground" / "cdec_reservoir_storage_daily_2024.csv"
    rows = list(csv.DictReader(io.StringIO(path.read_text(encoding="utf-8-sig"))))
    output = DEST / "ground" / "reservoir_storage_daily_2024_normalized.csv"
    fields = ["station_id", "sensor_number", "sensor_type", "observation_time_pst", "date_time_pst", "value", "unit", "data_flag", "source_url"]
    valid = 0
    by_station = {}
    with output.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            if not row.get("STATION_ID"):
                continue
            by_station[row["STATION_ID"]] = by_station.get(row["STATION_ID"], 0) + 1
            try:
                float(row["VALUE"])
                valid += 1
            except ValueError:
                pass
            writer.writerow(dict(station_id=row["STATION_ID"], sensor_number=row["SENSOR_NUMBER"],
                sensor_type=row["SENSOR_TYPE"], observation_time_pst=row["OBS DATE"], date_time_pst=row["DATE TIME"],
                value=row["VALUE"], unit=row["UNITS"], data_flag=row["DATA_FLAG"], source_url=CDEC_URL))
    return dict(file=output.name, source_file=path.name, source_url=CDEC_URL, status="derived_verified",
                retrieved_at_utc=NOW, artifact_type="normalized_observations", row_count=sum(by_station.values()),
                numeric_value_count=valid, station_row_counts=by_station, units="AF = acre-feet",
                time_zone="Pacific Standard Time year-round, per CDEC documentation; no DST conversion",
                transformation="Rename fields only; preserve raw value tokens, data flags and source timestamps; no imputation",
                limitation="Reservoir storage is hydrologic context, not a farm water allocation or field soil moisture measurement",
                bytes=output.stat().st_size, sha256=digest(output))


def extract_pdf_text():
    entries = []
    for path in (DEST / "markets").glob("*.pdf"):
        reader = PdfReader(path)
        output = path.with_suffix(".txt")
        output.write_text("\n\n".join(f"=== PDF PAGE {i+1} ===\n" + (page.extract_text() or "") for i, page in enumerate(reader.pages)), encoding="utf-8")
        entries.append(dict(file=output.name, source_file=path.name, status="derived_text_not_layout_verified",
            retrieved_at_utc=NOW, artifact_type="searchable_pdf_text", pdf_pages=len(reader.pages),
            bytes=output.stat().st_size, sha256=digest(output), limitation="Text extraction may alter table order; original PDF is authoritative"))
    return entries


def main():
    manifests = {key: [] for key in ("maps", "ground", "markets", "expertise")}
    with ThreadPoolExecutor(max_workers=5) as pool:
        for folder, entry in pool.map(fetch, SOURCES):
            manifests[folder].append(entry)
            print(folder, entry["status"], entry.get("file") or entry["source_url"])
    for kind in ("state", "county"):
        manifests["maps"].append(geometry_subset(kind))
    manifests["ground"].append(hydrology_subset())
    manifests["markets"].extend(extract_pdf_text())
    for folder, entries in manifests.items():
        path = DEST / folder / "manifest.json"
        previous = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        # Preserve manually audited numeric extracts and limitations when re-running.
        generated_files = {e.get("file") for e in entries}
        entries.extend(e for e in previous.get("files", []) if e.get("artifact_type") in ("manually_verified_numeric_extract", "directory_of_primary_sources") and e.get("file") not in generated_files)
        path.write_text(json.dumps(dict(updated_at_utc=NOW, access="public; no authentication", files=entries), indent=2), encoding="utf-8")
    (DEST / "manifest.json").write_text(json.dumps(dict(updated_at_utc=NOW, folders=list(manifests),
        scope="Bounded official geography, water storage, crop economics and local-expertise sample; no application",
        pipeline="scripts/fetch_maps_markets.py", note="Consult each folder manifest for source URLs, statuses, hashes, transformations, units and limitations"), indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
