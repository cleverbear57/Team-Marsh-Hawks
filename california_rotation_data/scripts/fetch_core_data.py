"""Download public NASA catalog metadata and POWER samples. No app or simulation.

Uses curl.exe on Windows, curl elsewhere. Raw response bytes stay unchanged.
Run: python scripts/fetch_core_data.py [power|catalog|all]
"""
import concurrent.futures
import csv
import datetime as dt
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
CURL = shutil.which('curl.exe') or shutil.which('curl')
SITES = [
    ('davis', 'Davis / Yolo County', 38.54, -121.75),
    ('colusa', 'Colusa / Sacramento Valley', 39.21, -122.00),
    ('five_points', 'Five Points / San Joaquin Valley', 36.36, -120.10),
    ('salinas', 'Salinas Valley', 36.65, -121.65),
    ('shafter', 'Shafter / Kern County', 35.50, -119.28),
    ('el_centro', 'El Centro / Imperial Valley', 32.80, -115.55),
    ('tulelake', 'Tulelake / northern intermountain region', 41.96, -121.48),
    ('oxnard', 'Oxnard / Ventura County', 34.19, -119.18),
]
PARAMETERS = ['T2M','T2M_MAX','T2M_MIN','T2MDEW','PRECTOTCORR','RH2M','WS2M','PS','ALLSKY_SFC_SW_DWN']

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding='utf-8')

def download(url, path, timeout=150):
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {'url':url, 'file':path.relative_to(ROOT).as_posix(), 'retrieved_at_utc':now()}
    if path.exists() and path.stat().st_size:
        record['cache_reused']=True
    else:
        command=[CURL,'-L','-sS','--fail-with-body','--connect-timeout','15','--max-time',str(timeout),
                 '--retry','1','--retry-delay','2','-H','Accept: application/json','-o',str(path),url]
        p=subprocess.run(command,capture_output=True,text=True,timeout=timeout*2+40)
        if p.returncode:
            record.update(status='failed',error=p.stderr.strip()[:800],returncode=p.returncode)
            return record,None
    try:
        data=json.loads(path.read_bytes())
    except Exception as e:
        record.update(status='failed',error=str(e))
        return record,None
    record.update(status='downloaded',bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    return record,data

def power():
    folder=ROOT/'raw/nasa/power'
    folder.mkdir(parents=True,exist_ok=True)
    def one(site):
        sid,label,lat,lon=site
        url='https://power.larc.nasa.gov/api/temporal/daily/point?'+urlencode({
            'parameters':','.join(PARAMETERS),'community':'AG','longitude':lon,'latitude':lat,
            'start':'20010101','end':'20251231','format':'JSON','time-standard':'UTC'})
        rec,data=download(url,folder/(sid+'_daily_2001_2025.json'))
        rec.update(site_id=sid,latitude=lat,longitude=lon,label=label,
                   data_kind='NASA analysis-ready gridded data; meteorology from reanalysis/assimilation, solar from satellite-derived products',
                   catalog_url='https://data.nasa.gov/dataset/prediction-of-worldwide-energy-resources-power')
        if data and 'properties' in data:
            values=data['properties']['parameter']
            rec['dates']=len(values.get('T2M',{})); rec['parameters']=data.get('parameters',{})
            rec['header']=data.get('header',{}); rec['messages']=data.get('messages',[])
        elif data:
            rec.update(status='failed',error=str(data)[:1000])
        print(sid,rec['status'],rec.get('dates'),flush=True)
        return rec,data
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(one,SITES))
    dump(folder/'manifest.json',[rec for rec,data in results])
    out=ROOT/'derived/power_daily_8_locations_2001_2025.csv'
    with out.open('w',newline='',encoding='utf-8') as f:
        w=csv.writer(f); w.writerow(['site_id','latitude','longitude','date','time_standard']+PARAMETERS)
        for rec,data in results:
            if rec['status']!='downloaded': continue
            values=data['properties']['parameter']; fill=data['header']['fill_value']
            dates=sorted(set().union(*(set(v) for v in values.values())))
            for date in dates:
                row=[rec['site_id'],rec['latitude'],rec['longitude'],date[:4]+'-'+date[4:6]+'-'+date[6:],'UTC']
                row += ['' if values.get(p,{}).get(date) in (None,fill) else values[p][date] for p in PARAMETERS]
                w.writerow(row)
    first=next((d for r,d in results if r['status']=='downloaded'),None)
    if first:
        dump(ROOT/'derived/power_parameter_units.json',first.get('parameters',{}))
    dump(ROOT/'derived/sample_locations.geojson',{'type':'FeatureCollection','features':[
        {'type':'Feature','geometry':{'type':'Point','coordinates':[lon,lat]},
         'properties':{'site_id':sid,'label':label,'role':'illustrative sampling point, not a surveyed farm parcel'}}
        for sid,label,lat,lon in SITES]})

def catalog():
    folder=ROOT/'raw/nasa/catalog'; folder.mkdir(parents=True,exist_ok=True)
    queries={
      'smap_l4':'"SMAP L4" "Surface" "Geophysical" "V008"',
      'gpm_imerg':'"GPM IMERG" "Final" "V07"',
      'ecostress_jet':'"ECOSTRESS" "JET"',
      'ecostress_lste':'"ECOSTRESS" "LSTE" "V002"',
      'grace_mascon':'"JPL" "MASCON"',
      'nasadem':'"NASADEM" "HGT"',
      'hls_l30':'"Harmonized Landsat Sentinel" "L30"',
    }
    jobs=[('power','https://data.nasa.gov/api/3/action/package_show?'+urlencode({'id':'prediction-of-worldwide-energy-resources-power'})),
          ('mod13q1','https://data.nasa.gov/api/3/action/package_show?'+urlencode({'id':'modis-terra-vegetation-indices-16-day-l3-global-250m-sin-grid-v061-2eb0d'}))]
    jobs += [(key,'https://data.nasa.gov/api/3/action/package_search?'+urlencode({'q':q,'rows':20})) for key,q in queries.items()]
    def one(job):
        key,url=job; rec,data=download(url,folder/(key+'.json'),90)
        if data:
            rec['success']=data.get('success')
            rec['returned_count']=data.get('result',{}).get('count',1)
        rec['data_kind']='catalog metadata, not numerical observations'
        print(key,rec['status'],rec.get('returned_count'),flush=True)
        return rec,data
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: results=list(pool.map(one,jobs))
    dump(folder/'manifest.json',[r for r,d in results])
    with (folder/'catalog_records.csv').open('w',encoding='utf-8',newline='') as f:
        w=csv.writer(f);w.writerow(['query_file','title','catalog_url','identifier','landing_page','resource_urls','metadata_only'])
        for rec,data in results:
            if not data or not data.get('success'):continue
            result=data['result']; items=result.get('results',[result])
            for item in items:
                extras={v['key']:v['value'] for v in item.get('extras',[])}
                w.writerow([rec['file'],item.get('title'), 'https://data.nasa.gov/dataset/'+item.get('name',''),
                    extras.get('identifier',extras.get('Identifier','')),extras.get('landingPage',''),
                    ' | '.join(v.get('url','') for v in item.get('resources',[])),True])

if __name__=='__main__':
    mode=sys.argv[1] if len(sys.argv)>1 else 'all'
    if mode in ('all','power'):power()
    if mode in ('all','catalog'):catalog()
