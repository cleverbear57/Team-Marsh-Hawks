# California Rotation Lab data package

Prepared 14 November 2026. Data preparation only; no app or simulation built. Paste APPEND_TO_MESSAGE.txt after the original prompt. It corrects misleading scientific claims and covers all 21 supplied checklist rows. REQUIREMENTS_COVERAGE.csv distinguishes requirements specified from data actually acquired and work still needed.

## Numerical data acquired

- NASA POWER: 73,048 daily location records, 2001–2025, eight representative California points; nine variables. Raw JSON under raw/nasa/power; readable CSV and exact units under derived. Meteorology is primarily gridded reanalysis; solar includes satellite-derived inputs. Samples are not statewide parcel coverage. [NASA catalog](https://data.nasa.gov/dataset/prediction-of-worldwide-energy-resources-power), [API documentation](https://power.larc.nasa.gov/docs/services/api/temporal/daily/).
- NASA GIS SMAP and GPM: raw numerical service samples plus flattened CSVs. SMAP sampled attributes describe surface/root-zone WETNESS, not volumetric moisture; preserve original variable names. GPM samples span selected days in 2023. SMAP snapshots are September 2026. These are not synchronized validation records. Refer to raw/nasa/observations manifests, GIS descriptions and per-request response files for units, versions, exact timestamps and URLs.
- NRCS SSURGO: 75 component/horizon rows across 8 sampling points. All components retained, including components with missing horizon data. Values are soil survey estimates, not newly measured soil tests. Low/representative/high suffixes are _l/_r/_h; depths cm, texture/organic matter percent, available water cm/cm, bulk density g/cm3, conductivity micrometers/second, electrical conductivity dS/m, pH unitless. Do not treat missing values as zero. Requests and map identifiers are retained. [Soil Data Access](https://sdmdataaccess.nrcs.usda.gov/).
- California state and county GeoJSON extracted from Census 2024 cartographic boundaries; original zips and CRS retained. These are administrative boundaries, not farm parcels. See raw/local/maps_markets/maps.
- DWR CDEC 2024 reservoir-storage records at four stations, raw and normalized CSV. These are regional ground/operational water records, not a farm's irrigation allocation. See ground manifest.

## Reference evidence acquired

UC ANR/UCCE/UC IPM crop-production, cover-crop and disease/rotation documents are under raw/local/agronomy/sources. UC sample cost studies for processing tomatoes, rice, broccoli and lettuce, plus CDFA agricultural statistics, are under raw/local/maps_markets/markets. PDFs are evidence documents, not a completed numeric crop-response model. Historical sample costs are not current guaranteed farm income. Local expertise comes from published material; no advisor has reviewed this project.

## Remaining gaps

ECOSTRESS ET/LST, MODIS/HLS vegetation, GRACE and NASADEM discovery/catalog records and some granule metadata are included; full numeric rasters were NOT downloaded. Some products require Earthdata authentication. The public ORNL MODIS subset service timed out during retrieval. Catalog JSON is not observational data. New ECOSTRESS V003 collections were found; do not assume V002 is latest. Source manifests retain attempted requests/failures.

No statewide crop suitability engine, field-boundary dataset, measured farm rotation, farm-specific soil test, buyer access, stage-specific calibrated heat model or validated soil-organic-matter response model is supplied. Existing rotation must come from the farmer. Simulated trajectories, outcomes and future UI remain unimplemented. This package provides real starter data and a complete requirement specification, not proof that every requirement is operationally satisfied.

## Reuse

Raw files retain source bytes; derived CSVs are convenience transformations. Source manifests contain requests/citations and metadata. Scripts can repeat acquisition, but some auxiliary scripts depend on Python packages used for shapefiles/PDF extraction. Different sample sets use different coordinates: join by coordinates and source identifiers, never by city label alone. POWER uses Shafter/Oxnard while soil samples include Bakersfield/Santa Maria. No area-weighted statewide inference is justified from these points.

Use the same historical weather sequence to compare all candidate rotations. Resampling historical years is a scenario, not a forecast. Long-term soil change needs a separately documented and validated model. Ground cover and green vegetation index are not interchangeable.
