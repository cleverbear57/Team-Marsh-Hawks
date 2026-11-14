'use strict';
/* Static knowledge base. Regional climatologies are representative values (approximate, rounded from
   public station/NASA POWER-style normals) used so the demo works offline; the live NASA POWER button
   replaces temperature + precipitation with real MERRA-2-based climatology for the chosen point. */
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS=[31,28.25,31,30,31,30,31,31,30,31,30,31];

const REGIONS={
 central:{name:'Central Valley (San Joaquin)',short:'Central Valley',lat:36.6,lon:-119.8,icon:'🌾',tag:'Hot dry summers · heavy groundwater reliance',
  precip:[53,50,50,25,10,3,0,0,5,15,30,45],tmax:[12,16,19,23,28,33,36,35,32,26,18,12],tmin:[3,5,7,9,13,16,19,18,16,11,6,3],tminX:[-3,-2,0,2,5,8,12,11,8,3,-1,-3],
  et0:[30,45,85,125,165,195,210,185,135,90,45,25],gw:.85,grace:-2.0,slope:1.2,elev:90,soil:'sandy loam',som:1.0,smap:-.4,xdays:1.5,
  typical:['tomato','almonds','alfalfa','grapes','greens'],
  water:'Mostly pumped groundwater; surface deliveries cut sharply in dry years (SGMA limits now apply).'},
 salinas:{name:'Salinas Valley (Central Coast)',short:'Salinas Valley',lat:36.6,lon:-121.6,icon:'🥬',tag:'Cool coastal · high-value vegetables',
  precip:[70,70,60,25,8,2,0,1,5,20,40,60],tmax:[17,18,19,21,22,24,25,25,26,24,20,17],tmin:[5,6,7,8,9,11,12,12,11,9,6,4],tminX:[0,1,2,3,5,7,9,9,7,4,1,-1],
  et0:[35,45,75,100,120,130,130,120,100,75,45,30],gw:.9,grace:-.9,slope:2.0,elev:20,soil:'clay loam',som:2.0,smap:-.3,xdays:2.5,
  typical:['greens','tomato','grapes'],
  water:'Almost entirely groundwater; seawater intrusion pressure near the coast; nitrate in groundwater is a regulatory focus.'},
 sacramento:{name:'Sacramento Valley',short:'Sacramento Valley',lat:39.4,lon:-121.9,icon:'🌻',tag:'Wetter north valley · surface-water + wells',
  precip:[100,90,75,35,15,5,0,1,8,25,65,90],tmax:[13,17,20,24,29,33,35,35,32,26,18,13],tmin:[4,6,7,9,12,15,16,16,14,11,7,4],tminX:[-3,-1,0,2,5,9,11,11,8,3,-1,-3],
  et0:[25,45,85,125,165,190,205,180,130,85,40,20],gw:.5,grace:-.8,slope:1.5,elev:20,soil:'loam',som:1.6,smap:-.3,xdays:3.5,
  typical:['tomato','almonds','alfalfa','grapes'],
  water:'Mix of surface-water rights and wells; more resilient than the south valley but not drought-proof.'},
 imperial:{name:'Imperial Valley (Desert)',short:'Imperial Valley',lat:33.0,lon:-115.5,icon:'🏜️',tag:'Extreme heat · Colorado River irrigation',
  precip:[11,9,8,2,1,0,2,7,5,5,5,9],tmax:[20,23,27,31,36,41,43,43,40,34,25,19],tmin:[6,9,12,15,19,23,27,27,24,17,10,6],tminX:[0,2,5,8,12,17,22,22,17,9,3,0],
  et0:[70,95,150,200,255,285,290,265,210,150,90,60],gw:.1,grace:-.3,slope:.3,elev:-15,soil:'silty clay',som:.8,smap:-.2,xdays:.3,
  typical:['alfalfa','greens'],
  water:'Colorado River canal water — GRACE groundwater trend understates the real risk, which is river allocation cuts.'}
};

const SOILS={
 'sandy loam':{base:46,K:.22,leach:1.25,cap:.85,awc:110,note:'Drains fast, low water holding, leaches nitrate easily'},
 'loam':{base:55,K:.30,leach:1.0,cap:1.0,awc:160,note:'Balanced water holding and drainage'},
 'clay loam':{base:60,K:.28,leach:.85,cap:1.1,awc:175,note:'Holds water well; slower infiltration, compaction risk'},
 'silty clay':{base:58,K:.32,leach:.75,cap:1.15,awc:165,note:'High water holding; crusting and drainage issues; often saline'}
};

const COVERNDVI=[.55,.65,.72,.5,0,0,0,0,0,.22,.4,.5];

const TRAITS={
 rye:{name:'Cereal rye',role:'Cover (grass)',root:120,n:0,bio:4.5,water:6,drought:4,frost:5,som:5,note:'Scavenges leftover nitrate, heavy residue; can temporarily tie up N for the next crop.'},
 vetch:{name:'Hairy / common vetch',role:'Cover (legume)',root:90,n:80,bio:3,water:7,drought:3,frost:4,som:3,note:'Fixes nitrogen (≈60–120 lb N/ac); fixes less if soil N is already high.'},
 mustard:{name:'Mustard / brassica',role:'Cover (brassica)',root:150,n:0,bio:3,water:5,drought:3,frost:3,som:3,note:'Deep taproot breaks compaction; biofumigation can suppress some nematodes/soil pathogens.'},
 clover:{name:'Crimson clover / bell bean',role:'Cover (legume)',root:70,n:70,bio:2.5,water:6,drought:2,frost:3,som:3,note:'Good orchard/vineyard floor legume; flowers feed pollinators and beneficials.'},
 barley:{name:'Barley (cover)',role:'Cover (grass)',root:100,n:0,bio:3,water:5,drought:4,frost:4,som:4,note:'Cheap to seed, fast winter cover, easy to mow in row-middles.'},
 garbanzo:{name:'Garbanzo (chickpea)',role:'Cash (legume)',root:150,n:45,bio:2,water:11,drought:4,frost:3,som:3,note:'Low-water cash legume; breaks tomato/lettuce pest cycles; needs a buyer & harvester.'},
 wheat:{name:'Winter wheat',role:'Cash (cereal)',root:150,n:0,bio:4,water:12,drought:4,frost:5,som:4,note:'Mostly rain-fed in winter; fills the bare window; markets are well established.'},
 safflower:{name:'Safflower',role:'Cash (oilseed)',root:200,n:0,bio:3,water:13,drought:5,frost:3,som:3,note:'Very deep taproot reaches stored water; strongly drought-tolerant; modest margins.'},
 sorghum:{name:'Sorghum',role:'Cash / forage',root:160,n:0,bio:5,water:16,drought:5,frost:1,som:4,note:'Summer drought-tolerant grain/forage; heavy residue.'},
 cole:{name:'Broccoli / cauliflower',role:'Cash (brassica)',root:60,n:0,bio:2,water:14,drought:2,frost:3,som:2,note:'Different family from lettuce, so it interrupts lettuce-specific diseases; still water- and N-hungry.'},
 graze:{name:'Sheep grazing + insectary strips',role:'Supplemental income',root:80,n:0,bio:2,water:4,drought:3,frost:4,som:4,note:'Lease income and nutrient return; check food-safety, pesticide-label and fencing requirements.'}
};

const CROPS={
 tomato:{name:'Processing Tomatoes',icon:'🍅',type:'Annual',water:2.5,wexp:1,ky:1.0,heat:.9,heatThr:35,frostSens:'High — transplants killed by frost',nRate:180,nLeach:36,rev:4600,cost:3500,
  ndvi:[.15,.15,.18,.25,.5,.75,.8,.6,.3,.15,.15,.15],coverEff:1,cEff:1,
  cover:{keys:['rye','vetch','mustard'],label:'Cereal rye + hairy vetch + mustard mix',water:.5,nCredit:45,cost:130},
  alt:{keys:['garbanzo','wheat'],label:'Garbanzo / winter wheat in a 3-yr rotation',share:.33,rev:830,cost:500,water:.95,addRev:0,addCost:25,addW:0,pestK:.7},
  pestB:.3,pests:['Fusarium wilt','Verticillium wilt','Root-knot nematodes','Spotted-wilt virus (thrips)'],
  pestNote:'Back-to-back tomatoes build nematodes and wilt pathogens; grains/legumes and brassica biofumigation break those cycles.',
  strat:{A:['Standard tomato rotation, winter fallow','Tomato (transplant Mar–Apr, harvest Jul–Sep), disked fallow Oct–Mar, synthetic N, drip or furrow irrigation.'],
         B:['Tomato + winter cover crop','Seed rye/vetch/mustard after harvest (Oct–Nov) so roots are working before the winter rains; terminate Feb–Mar ahead of transplanting.'],
         C:['Tomato → garbanzo → winter wheat','Roughly one year in three is a low-water cash crop that interrupts pests and weeds; winter wheat covers the bare window.']},
  market:'Processor contracts fix tomato price and acreage; adding garbanzo or wheat means lining up a local buyer, a combine and crop-insurance eligibility.'},
 almonds:{name:'Almonds',icon:'🌰',type:'Perennial orchard',water:3.8,wexp:1,ky:1.1,heat:.5,heatThr:38,frostSens:'High at bloom (Feb–Mar)',nRate:220,nLeach:44,rev:5000,cost:3700,
  ndvi:[.2,.25,.4,.6,.7,.75,.75,.72,.65,.5,.3,.2],coverEff:.9,cEff:.8,
  cover:{keys:['clover','vetch','barley'],label:'Crimson clover + vetch + barley orchard-floor mix',water:.55,nCredit:50,cost:110},
  alt:{keys:['graze'],label:'Floor diversity + winter sheep grazing; cereal/brassica fallow before replanting',share:0,rev:0,cost:0,water:0,addRev:45,addCost:15,addW:.05,pestK:.35},
  pestB:.25,pests:['Nematodes & replant disease','Navel orangeworm','Hull rot / Phytophthora','Weeds on bare berms'],
  pestNote:'Perennial orchards cannot rotate yearly; diversity is built in the alleys and through a rotation year before replanting.',
  strat:{A:['Clean-cultivated or herbicide strip, bare floor','Bare or mowed resident weeds in alleys, full irrigation, standard N program.'],
         B:['Orchard-floor cover crop','Seed clover/vetch/barley in alleys in Oct; mow at bloom (Feb–Mar) to cut water use and frost risk from cover.'],
         C:['Diversified floor + grazing income','Multi-species floor, insectary strips and winter sheep grazing; plan a cereal/brassica rotation year before the next replant to reduce replant disease.']},
  market:'Grazing leases need a local grazier and food-safety compliance; insectary strips and floor cover may qualify for cost-share (CDFA Healthy Soils, NRCS EQIP) — confirm current terms.'},
 alfalfa:{name:'Alfalfa',icon:'🌿',type:'Perennial forage (4–6-yr stand)',water:4.5,wexp:1,ky:1.1,heat:.5,heatThr:35,frostSens:'Low once established',nRate:20,nLeach:12,rev:2100,cost:1000,
  ndvi:[.35,.4,.55,.7,.75,.78,.75,.75,.7,.6,.45,.35],coverEff:.5,cEff:1,
  cover:{keys:['rye','vetch'],label:'Winter cereal/vetch at stand turnover',water:.4,nCredit:0,cost:90},
  alt:{keys:['wheat','safflower','sorghum'],label:'1 year in 4 as wheat / safflower / sorghum under deficit irrigation',share:.25,rev:720,cost:450,water:1.1,addRev:0,addCost:20,addW:0,pestK:.7},
  pestB:.2,pests:['Stem nematode','Alfalfa weevil','Phytophthora root rot','Autotoxicity (alfalfa-after-alfalfa)'],
  pestNote:'Alfalfa already covers the soil year-round, so most gains come from rotating out — and from water saved in the rotation years.',
  strat:{A:['Continuous alfalfa (5–6-yr stands)','Year-round canopy, 6–9 cuttings, heavy summer irrigation; the largest water user of the five.'],
         B:['Alfalfa + winter cereal/vetch at turnover','Short-stand management with a cereal/vetch winter cover when the stand is terminated; modest gain because alfalfa is already green.'],
         C:['Alfalfa → small grain / safflower / sorghum','One year in four swaps to a drought-tolerant cash crop with far lower water use, breaking nematode and autotoxicity cycles.']},
  market:'Dairy and hay markets reward alfalfa; wheat/safflower/sorghum need nearby elevators or buyers. Rotation years cut hay supply — check forage contracts.'},
 greens:{name:'Leafy Greens (lettuce, spinach)',icon:'🥬',type:'Annual (2–3 crops/yr)',water:1.8,wexp:.4,ky:1.0,heat:1.0,heatThr:27,frostSens:'Moderate — frost damage on young transplants',nRate:220,nLeach:55,rev:12000,cost:10000,
  ndvi:[.2,.2,.4,.65,.6,.4,.6,.65,.55,.3,.2,.2],coverEff:1,cEff:.9,
  cover:{keys:['mustard','rye'],label:'Mustard + cereal rye winter cover',water:.35,nCredit:10,cost:120},
  alt:{keys:['cole'],label:'Broccoli / cauliflower break with an occasional small-grain or legume cover',share:.33,rev:7500,cost:6600,water:1.3,addRev:0,addCost:30,addW:0,pestK:.75},
  pestB:.35,pests:['Sclerotinia drop','Fusarium wilt of lettuce','Verticillium wilt','Downy mildew / aphids'],
  pestNote:'Soil-borne disease is the big driver here; brassica covers/crops and long breaks reduce inoculum.',
  strat:{A:['Lettuce/spinach back-to-back, winter fallow','2–3 crops per year, minimal tillage windows, soil often bare Dec–Feb and between plantings.'],
         B:['Greens + winter mustard/rye cover','Plant a cover in the Dec–Feb fallow window; incorporate before spring planting; cover also helps hold nitrate that would otherwise leach.'],
         C:['Greens → brassica crop with covers','Alternate lettuce blocks with broccoli/cauliflower (different disease family) plus rye/mustard cover in the gaps.']},
  market:'Buyers and shippers drive acreage and planting dates; cole crops have strong Salinas-area markets but have their own pests (clubroot, aphids) and water needs.'},
 grapes:{name:'Wine Grapes',icon:'🍇',type:'Perennial vineyard',water:1.8,wexp:1,ky:.7,heat:.7,heatThr:38,frostSens:'High at budbreak (Mar–Apr)',nRate:40,nLeach:8,rev:5400,cost:4100,
  ndvi:[.15,.15,.25,.45,.6,.7,.7,.65,.55,.4,.2,.15],coverEff:.9,cEff:.8,
  cover:{keys:['barley','vetch','clover'],label:'Barley + vetch + clover row-middle cover',water:.35,nCredit:30,cost:95},
  alt:{keys:['graze'],label:'Row-middle perennial mix + winter grazing + insectary habitat',share:0,rev:0,cost:0,water:0,addRev:50,addCost:20,addW:.04,pestK:.35},
  pestB:.25,pests:["Pierce's disease (sharpshooters)",'Powdery mildew','Nematodes','Phylloxera'],
  pestNote:'Vineyard floor diversity supports beneficial insects; rootstock choice and replant timing are the main rotation levers.',
  strat:{A:['Clean-tilled or herbicide row-middles','Bare soil Nov–Mar, vine rows only, deficit irrigation in summer.'],
         B:['Winter cover in row-middles','Seed barley/vetch/clover in Oct, mow in spring before bloom to limit competition and frost pooling.'],
         C:['Diversified floor + grazing','Perennial grass/legume mix, insectary habitat and winter sheep grazing; plan a rotation year before replanting.']},
  market:'Cover and grazing rarely change grape price, but some wineries and sustainability programs reward them; compatibility with harvest equipment matters.'}
};

const PRIORITIES={
 water:{label:'Conserve water & survive drought',icon:'💧',crit:'water',desc:'Cut irrigation / pumping and stay productive in dry years.'},
 som:{label:'Build soil organic matter',icon:'🌱',crit:'som',desc:'Raise carbon, structure and water-holding capacity.'},
 nitrogen:{label:'Fix nitrogen / cut fertilizer cost',icon:'🧪',crit:'n',desc:'Use legumes and covers to lower synthetic N and nitrate loss.'},
 pest:{label:'Disrupt pest & weed cycles',icon:'🐛',crit:'pest',desc:'Rotate to break disease, nematode and weed build-up.'}
};

const DATASETS=[
 {id:'smap',name:'SMAP',full:'Soil Moisture Active Passive',nat:9000,natLabel:'9 km (36 km radiometer)',cad:'2–3 days (L3) · 3-hourly (L4 model-assimilated)',
  use:'Surface (0–5 cm) and root-zone (to ~1 m) soil moisture and anomalies',term:'Soil-moisture anomaly = how much wetter or drier the soil is than the multi-year norm for that time of year, expressed as a z-score (negative = drier than normal).',
  method:'Too coarse for a field → disaggregate with NDVI, land-surface temperature, slope and soil texture; keep the SMAP value as the regional “anchor”.',color:'#2a6fb0'},
 {id:'eco',name:'ECOSTRESS',full:'ECOsystem Spaceborne Thermal Radiometer (ISS)',nat:70,natLabel:'70 m',cad:'Irregular 1–5 day revisits, varying time of day',
  use:'Land-surface temperature (LST), evapotranspiration (ET) and the Evaporative Stress Index (ESI)',term:'Evapotranspiration (ET) = water leaving the field as evaporation from soil plus transpiration through leaves. ESI = actual ET ÷ potential ET; low values mean the crop is water-stressed.',
  method:'Finer than the analysis grid → aggregate (mean of the ~70 m pixels, weighted by cloud/QC flags) and composite to weekly/monthly.',color:'#c0392b'},
 {id:'gpm',name:'GPM IMERG',full:'Global Precipitation Measurement',nat:10000,natLabel:'0.1° ≈ 10 km',cad:'30-minute (use daily/monthly sums)',
  use:'Rainfall totals, storm intensity and atmospheric-river (extreme-rain) days',term:'Extreme-precipitation days (e.g. > 25 mm/day) drive most erosion and nitrate leaching; they cluster in a few winter storms in California.',
  method:'Coarser than a field → bilinear resample, then bias-correct against CIMIS / rain-gauge totals.',color:'#1b7f8c'},
 {id:'landsat',name:'Landsat 8/9 (HLS)',full:'Landsat / Harmonized Landsat-Sentinel',nat:30,natLabel:'30 m',cad:'~8 days (2–3 days with HLS)',
  use:'NDVI field-by-field: crop vigor, planting/harvest dates, bare-field windows',term:'NDVI = (NIR − Red) ÷ (NIR + Red). ≈ 0.1 means bare soil, 0.3 is sparse cover, 0.7–0.9 is dense healthy canopy. We call a month “bare” when NDVI < 0.25.',
  method:'Aggregate 30 m pixels to the analysis grid after cloud/shadow masking; gap-fill with a smoothing filter.',color:'#2d6a4f'},
 {id:'modis',name:'MODIS',full:'Terra/Aqua MODIS (MOD13Q1 / MOD11)',nat:250,natLabel:'250 m (NDVI) · 1 km (LST)',cad:'Daily / 16-day composites since 2000',
  use:'Long, gap-free NDVI & LST history to build seasonal norms and detect anomalies',term:'A 20+ year record lets us compute a “normal” seasonal curve and flag years that are unusually stressed.',
  method:'Resample 1 km LST to the grid; use the 250 m NDVI archive as the backbone climatology for Landsat.',color:'#6b8e23'},
 {id:'grace',name:'GRACE / GRACE-FO',full:'Gravity Recovery and Climate Experiment',nat:300000,natLabel:'~300 km mascons',cad:'Monthly (2002–present, with a 2017–18 gap)',
  use:'Long-term groundwater storage trend for the whole region',term:'GRACE measures total water storage change (cm of water). Subtracting soil moisture, snow and surface water leaves the groundwater trend. One pixel covers thousands of farms, so it describes the aquifer, not your well.',
  method:'Far coarser than a field → treat as a regional context layer; never downscale it to farm level.',color:'#8e44ad'},
 {id:'srtm',name:'SRTM / NASADEM',full:'Shuttle Radar Topography Mission',nat:30,natLabel:'30 m',cad:'Static (2000)',
  use:'Elevation, slope, aspect and low spots (cold-air pooling) for erosion and frost mapping',term:'Slope steepness and slope length feed the standard erosion equations; low depressions collect cold air on still nights and are frost-prone.',
  method:'Aggregate (mean + max slope) to the grid; compute flow accumulation at native resolution first.',color:'#a0522d'},
 {id:'power',name:'NASA POWER',full:'Prediction Of Worldwide Energy Resources (MERRA-2)',nat:55000,natLabel:'0.5° × 0.625° ≈ 55 km',cad:'Daily; 25-yr monthly climatology',
  use:'Air temperature, rainfall, solar radiation → heat stress, frost risk, reference ET',term:'Frost risk is estimated from the coldest nights (T2M minimum); heat stress from daily maximum temperature relative to crop thresholds.',
  method:'Resample to the grid; correct lapse-rate by elevation (SRTM); this is the one dataset the demo can pull live for your coordinates.',color:'#d9822b'}
];

/* Simplified California outline [lon,lat] */
const CA_OUTLINE=[[-124.2,42.0],[-120.0,42.0],[-120.0,39.0],[-114.63,35.0],[-114.72,32.72],[-117.12,32.53],[-117.25,32.85],[-117.4,33.2],[-118.0,33.6],[-118.4,33.75],[-118.5,34.03],[-119.2,34.15],[-120.47,34.45],[-120.65,35.15],[-121.3,35.65],[-121.9,36.3],[-121.95,36.6],[-122.0,36.95],[-122.4,37.2],[-122.5,37.8],[-123.0,38.0],[-123.7,38.9],[-123.8,39.6],[-124.4,40.4],[-124.1,41.0],[-124.2,41.8]];
