'use strict';
/* =============== navigation =============== */
const PH=[['1','Intake'],['2','NASA data'],['3','Strategies'],['4','Simulation'],['5','Summary'],['6','Coverage ✓']];
function buildNav(){
  $('#nav').innerHTML=PH.map(([n,l])=>`<button data-go="${n}" class="${S.phase==n?'on':''}" ${n>1&&n<6&&!S.launched?'disabled':''}>${n<6?n+' · ':''}${l}</button>`).join('');
}
function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast._t);toast._t=setTimeout(()=>t.style.display='none',2600)}
function go(n,tab){
  n=+n;if(n>1&&n<6&&!S.launched){toast('Choose your region, crop and priority, then launch the simulation first.');return}
  S.phase=n;if(tab)S.tab=tab;
  $$('.phase').forEach(e=>e.classList.toggle('on',e.id==='p'+n));
  if(S.launched&&n>1&&n<6)recompute();
  ({1:renderIntake,2:renderP2,3:renderP3,4:renderP4,5:renderP5,6:renderP6})[n]();
  buildNav();window.scrollTo({top:0,behavior:'smooth'});
}

/* =============== PHASE 1: intake =============== */
function pickCards(items,sel,key){return items.map(i=>`<button class="opt ${sel===i.k?'sel':''}" data-pick="${key}:${i.k}"><span class="ic">${i.ic}</span><b>${i.t}</b><span>${i.d}</span></button>`).join('')}
function renderIntake(){
  $('#regionCards').innerHTML=pickCards([...Object.keys(REGIONS).map(k=>({k,ic:REGIONS[k].icon,t:REGIONS[k].name,d:REGIONS[k].tag})),{k:'custom',ic:'📍',t:'Custom county / coordinates',d:'Enter lat/lon for your field'}],S.region,'region');
  $('#cropCards').innerHTML=pickCards(Object.keys(CROPS).map(k=>({k,ic:CROPS[k].icon,t:CROPS[k].name,d:CROPS[k].type})),S.crop,'crop');
  $('#prioCards').innerHTML=pickCards(Object.keys(PRIORITIES).map(k=>({k,ic:PRIORITIES[k].icon,t:PRIORITIES[k].label,d:PRIORITIES[k].desc})),S.priority,'prio');
  $('#customBox').hidden=S.region!=='custom';
  $('#years').value=S.years;$('#yrsOut').textContent=S.years+' years';
  $('#water').value=S.water;$('#wOut').textContent=S.water+'%';
  $('#irrig').value=S.irrig;$('#equip').value=S.equip;$('#market').value=S.market;
  const sel=$('#soil');if(!sel.options.length)sel.innerHTML='<option value="">Auto (regional default)</option>'+Object.keys(SOILS).map(k=>`<option>${k}</option>`).join('');sel.value=S.soil;
  const p=baseProfile(),c=ctx();
  let msg='';
  if(S.region==='custom'){
    if(S.lat==null||S.lon==null||isNaN(S.lat)||isNaN(S.lon))msg='Enter both coordinates.';
    else if(S.lat<32.5||S.lat>42||S.lon<-124.5||S.lon>-114.1)msg='⚠ That point is outside California.';
    else msg=`✔ Using the <b>${REGIONS[p.near].short}</b> profile (nearest, ~${fmt(p.distKm)} km away). Climate can be replaced with live NASA POWER data in step 2.`;
  }$('#customMsg').innerHTML=msg;
  const ok=!!(p&&S.crop&&S.priority&&!(S.region==='custom'&&(S.lat<32.5||S.lat>42||S.lon<-124.5||S.lon>-114.1)));
  $('#sumBox').innerHTML=`<dt>Region</dt><dd>${p?p.name:'—'}</dd><dt>Baseline crop (Strategy A)</dt><dd>${S.crop?CROPS[S.crop].icon+' '+CROPS[S.crop].name:'—'}</dd><dt>Top priority</dt><dd>${S.priority?PRIORITIES[S.priority].icon+' '+PRIORITIES[S.priority].label:'—'}</dd><dt>Timeline</dt><dd>${S.years} years</dd><dt>Soil · water</dt><dd>${c?c.soilKey+', '+c.som0.toFixed(1)+'% SOM · '+S.water+'% water':'—'}</dd>`;
  $('#chkBox').innerHTML=[['Region',!!p],['Baseline crop',!!S.crop],['Priority',!!S.priority]].map(([l,o])=>`<li class="${o?'ok':'no'}">${l}</li>`).join('')+(c&&c.atypical?`<li class="no" style="color:#b42318">Note: ${CROPS[S.crop].name} is uncommon in this region — results use generic assumptions.</li>`:'');
  $('#launchBtn').disabled=!ok;$('#launchBtn').textContent=S.launched?'🔄 Update & re-run simulation':'🚀 Lock in & launch simulation';
}
function initIntake(){
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-pick]');if(b){const[k,v]=b.dataset.pick.split(':');
      if(k==='region'){S.region=v;if(v==='custom'&&S.lat==null){S.lat=36.74;S.lon=-119.79;$('#lat').value=S.lat;$('#lon').value=S.lon}if(v!=='custom'){S.lat=null;S.lon=null}if(S.soil==='')S.som=''}
      if(k==='crop')S.crop=v;if(k==='prio')S.priority=v;renderIntake();return}
    const g=e.target.closest('[data-go]');if(g){go(g.dataset.go);return}
    const j=e.target.closest('[data-jump]');if(j){const[n,t]=j.dataset.jump.split(':');go(n,t);return}
  });
  $('#lat').oninput=e=>{S.lat=parseFloat(e.target.value);renderIntake()};$('#lon').oninput=e=>{S.lon=parseFloat(e.target.value);renderIntake()};
  $('#years').oninput=e=>{S.years=+e.target.value;renderIntake()};
  $('#water').oninput=e=>{S.water=+e.target.value;renderIntake()};
  $('#soil').onchange=e=>{S.soil=e.target.value;renderIntake()};
  $('#som').oninput=e=>{S.som=e.target.value;renderIntake()};
  $('#irrig').onchange=e=>S.irrig=e.target.value;$('#equip').onchange=e=>S.equip=e.target.value;$('#market').onchange=e=>S.market=e.target.value;
  $('#launchBtn').onclick=()=>{S.launched=true;recompute();go(2,'data')};
  $('#demoBtn').onclick=()=>{S.region='central';S.crop='tomato';S.priority='water';S.years=15;S.lat=S.lon=null;S.soil='';S.som='';renderIntake();toast('Demo loaded: Central Valley · Processing Tomatoes · Water')};
}

/* =============== shared SVG charts =============== */
function niceTicks(lo,hi,n=5){const span=hi-lo||1,raw=span/n,pow=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/pow,step=(f<1.5?1:f<3?2:f<7?5:10)*pow;const a=Math.floor(lo/step)*step,b=Math.ceil(hi/step)*step,t=[];for(let v=a;v<=b+step/2;v+=step)t.push(+v.toFixed(6));return t}
let _chartId=0;
function lineChart(opt){
  const id='ch'+(++_chartId),W=540,H=250,m={l:54,r:12,t:10,b:30},{series,Y,title,unit,dec=1,band=true,weather}=opt;
  const first=opt.from0?0:1;
  let lo=Infinity,hi=-Infinity;for(const s of series){for(let t=first;t<=Y;t++){const a=s.lo[t],b=s.hi[t];if(!isNaN(a))lo=Math.min(lo,a);if(!isNaN(b))hi=Math.max(hi,b)}}
  if(!isFinite(lo)){lo=0;hi=1}
  if(opt.zero)lo=Math.min(lo,0);const pad=(hi-lo)*.06||1;const ticks=niceTicks(lo-pad,hi+pad);const y0=ticks[0],y1=ticks[ticks.length-1];
  const X=t=>m.l+(t-first)/Math.max(1,Y-first)*(W-m.l-m.r),Yp=v=>m.t+(1-(v-y0)/(y1-y0||1))*(H-m.t-m.b);
  let g='';
  for(const tv of ticks)g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${Yp(tv)}" y2="${Yp(tv)}" stroke="#e8e4d6"/><text x="${m.l-6}" y="${Yp(tv)+4}" text-anchor="end" font-size="11" fill="#5d6a62">${fmt(tv,dec>0&&Math.abs(y1-y0)<12?dec:0)}</text>`;
  const xs=Y<=10?1:Y<=15?2:5;for(let t=xs===1?first:xs;t<=Y;t+=xs)g+=`<text x="${X(t)}" y="${H-10}" text-anchor="middle" font-size="11" fill="#5d6a62">${t}</text>`;
  g+=`<text x="${(W+m.l)/2}" y="${H-0}" text-anchor="middle" font-size="10" fill="#5d6a62">year</text>`;
  if(weather){for(let t=1;t<=Y;t++)if(weather[t]<.7)g+=`<rect x="${X(t)-(W-m.l-m.r)/Math.max(1,Y-first)/2}" y="${m.t}" width="${(W-m.l-m.r)/Math.max(1,Y-first)}" height="${H-m.t-m.b}" fill="#d9822b" opacity=".13"/>`}
  for(const s of series){
    const pts=[];for(let t=first;t<=Y;t++)if(!isNaN(s.med[t]))pts.push(t);
    if(band&&s.lo!==s.med){const up=pts.map(t=>`${X(t)},${Yp(s.hi[t])}`),dn=pts.slice().reverse().map(t=>`${X(t)},${Yp(s.lo[t])}`);g+=`<polygon points="${up.concat(dn).join(' ')}" fill="${s.color}" opacity=".14"/>`}
    g+=`<polyline fill="none" stroke="${s.color}" stroke-width="2.4" points="${pts.map(t=>X(t)+','+Yp(s.med[t])).join(' ')}"/>`;
  }
  const svg=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${title}">${g}<line id="${id}v" y1="${m.t}" y2="${H-m.b}" stroke="#1d2a23" stroke-dasharray="3 3" style="display:none"/><rect id="${id}r" x="${m.l}" y="${m.t}" width="${W-m.l-m.r}" height="${H-m.t-m.b}" fill="transparent"/></svg>`;
  setTimeout(()=>{const r=document.getElementById(id+'r');if(!r)return;const host=r.closest('.rel'),tip=host.querySelector('.tip'),vl=document.getElementById(id+'v');
    r.onmousemove=ev=>{const bb=r.getBoundingClientRect(),fx=(ev.clientX-bb.left)/bb.width;const t=clamp(Math.round(first+fx*(Y-first)),first,Y);
      vl.style.display='';vl.setAttribute('x1',X(t));vl.setAttribute('x2',X(t));
      tip.innerHTML=`<b>Year ${t}</b>${weather&&weather[t]<.7?' · dry year':''}<br>`+series.map(s=>`<span style="color:${s.color}">●</span> ${s.name}: ${fmt(s.med[t],dec)} ${unit}${s.lo!==s.med&&band?` <span style="opacity:.7">(${fmt(s.lo[t],dec)}–${fmt(s.hi[t],dec)})</span>`:''}`).join('<br>');
      tip.style.display='block';const hb=host.getBoundingClientRect();tip.style.left=Math.min(ev.clientX-hb.left+12,hb.width-190)+'px';tip.style.top=(ev.clientY-hb.top-10)+'px'};
    r.onmouseleave=()=>{tip.style.display='none';vl.style.display='none'}},0);
  return`<div class="chart rel"><h4>${title}</h4>${svg}<div class="tip"></div></div>`;
}
function monthlyChart(c){
  const p=c.p,W=560,H=240,m={l:44,r:44,t:12,b:26},bw=(W-m.l-m.r)/12;
  const pm=Math.max(...p.precip,50),tm=Math.max(...p.et0,...p.tmax.map(x=>x*5),50);
  const Yp=v=>m.t+(1-v/pm)*(H-m.t-m.b),Yt=v=>m.t+(1-v/tm)*(H-m.t-m.b);
  let g='';for(let i=0;i<=4;i++){const v=pm*i/4;g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${Yp(v)}" y2="${Yp(v)}" stroke="#e8e4d6"/><text x="${m.l-5}" y="${Yp(v)+4}" text-anchor="end" font-size="10" fill="#1b7f8c">${fmt(v)}</text>`}
  p.precip.forEach((v,i)=>{g+=`<rect x="${m.l+i*bw+4}" y="${Yp(v)}" width="${bw-8}" height="${H-m.b-Yp(v)}" fill="#1b7f8c" opacity=".75"><title>${MONTHS[i]}: ${fmt(v)} mm rain</title></rect><text x="${m.l+i*bw+bw/2}" y="${H-8}" text-anchor="middle" font-size="10" fill="#5d6a62">${MONTHS[i]}</text>`});
  const pl=(arr,f,col)=>`<polyline fill="none" stroke="${col}" stroke-width="2.4" points="${arr.map((v,i)=>`${m.l+i*bw+bw/2},${Yt(f(v))}`).join(' ')}"/>`;
  g+=pl(p.et0,v=>v,'#d9822b')+pl(p.tmax,v=>v*5,'#c0392b');
  g+=`<text x="${W-m.r+4}" y="${m.t+10}" font-size="10" fill="#d9822b">ET₀ mm</text><text x="${W-m.r+4}" y="${m.t+24}" font-size="10" fill="#c0392b">Tmax ×5</text>`;
  return`<svg viewBox="0 0 ${W} ${H}" width="100%">${g}</svg><div class="leg"><span><i style="background:#1b7f8c"></i>Rain (mm, GPM / POWER)</span><span><i style="background:#d9822b"></i>Reference ET₀ (mm)</span><span><i style="background:#c0392b"></i>Mean daily max temp (°C, scaled)</span></div>`;
}

/* =============== PHASE 2: NASA data =============== */
const P2TABS=[['data','📡 The datasets'],['harm','🧩 Harmonization'],['map','🗺️ Map & field layers'],['cal','📅 Seasonal vulnerability'],['sat','🛰️ vs ground truth'],['si','🧠 Modeling approach']];
function renderP2(){
  const c=ctx();
  $('#p2').innerHTML=`<div class="card"><h2>Phase 2 · NASA Earth observations for ${c.p.name}</h2>
   <p class="mute">Eight NASA data streams with very different pixel sizes and revisit times are brought onto <b>one common analysis grid</b> so they can be compared side-by-side. ${c.p.live?'<span class="chip s">live NASA POWER climate loaded</span>':'<span class="chip w">demo climatology — pull live NASA POWER below</span>'}</p>
   <div class="tabs">${P2TABS.map(([k,l])=>`<button data-tab="${k}" class="${S.tab===k?'on':''}">${l}</button>`).join('')}</div><div id="p2body"></div></div>
   <div style="text-align:right"><button class="btn" data-go="3">Next: compare rotation strategies →</button></div>`;
  $$('#p2 [data-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;renderP2()});
  ({data:tabData,harm:tabHarm,map:tabMap,cal:tabCal,sat:tabSat,si:tabSI})[S.tab](c,$('#p2body'));
}
function bareList(c){return c.bareMo.A.map((b,i)=>b?MONTHS[i]:null).filter(Boolean)}
function dsValue(id,c){
  const p=c.p;
  switch(id){
    case'smap':return`Winter root-zone anomaly at this site ≈ <b>${p.smap.toFixed(1)} σ</b> (drier than the 2015–2025 norm) → the soil profile often refills only partly in winter, so water captured by good infiltration matters.`;
    case'eco':return`Midsummer bare-soil skin temperature ≈ <b>${fmt(c.maxTmax+17)} °C</b> vs. a transpiring canopy ≈ <b>${fmt(c.maxTmax-3)} °C</b>; low ESI in ${bareList(c).length?'bare spells':'summer'} flags crop water stress.`;
    case'gpm':return`<b>${fmt(c.wetShare*100)}%</b> of the ${fmt(c.pr)} mm annual rain falls Nov–Mar; ~${p.xdays} extreme-rain days (>25 mm) per year — these storms do the erosion/leaching damage when fields are bare.`;
    case'landsat':return`Baseline ${CROPS[S.crop].name} leaves the field below NDVI 0.25 in <b>${bareList(c).join(', ')||'no month'}</b> (${c.bare.A} months/yr). ${c.bare.A?'That bare window overlaps winter rain.':''}`;
    case'modis':return`Peak NDVI ≈ <b>${Math.max(...c.nd.A).toFixed(2)}</b>, minimum ≈ <b>${Math.min(...c.nd.A).toFixed(2)}</b> in the climatological curve; a 20-year archive lets us spot unusually stressed seasons.`;
    case'grace':return`Regional water-storage trend ≈ <b>${p.grace.toFixed(1)} cm/yr</b> (negative = losing storage). ${p.gw>.6?'High pumping dependence makes this directly relevant.':'Water supply here depends more on surface/river water, so GRACE only partly captures your risk.'}`;
    case'srtm':return`Typical slope ≈ <b>${p.slope}%</b>, elevation ≈ ${p.elev} m. ${p.slope<1?'Nearly level — erosion is mostly wind/dust & furrow-end losses; low spots may pool cold air.':'Gentle slopes concentrate runoff; soil erodibility (K) and bare winters set the risk.'}`;
    case'power':return`Hottest-month mean max ≈ <b>${fmt(c.maxTmax)} °C</b>; coldest night ≈ <b>${fmt(c.minTmin)} °C</b> → ~${fmt(clamp((5-c.minTmin)*7,0,35))} frost nights/yr. ${p.live?'<span class="chip s">LIVE from NASA POWER</span>':''}`;
  }
}
function tabData(c,el){
  el.innerHTML=`<div class="info">Click a dataset’s plain-language box to learn the term. Numbers in green are what that dataset says about <b>your site</b>.</div>
  <div class="grid2">${DATASETS.map(d=>`<div class="ds" style="border-left-color:${d.color}"><h4>${d.name} <span class="mute small">· ${d.full}</span></h4>
   <div class="meta">Native: <b>${d.natLabel}</b> · Revisit: ${d.cad}</div><p class="small" style="margin:6px 0 0">${d.use}</p>
   <div class="val">${dsValue(d.id,c)}</div><details style="margin:4px 0;padding:4px 8px"><summary class="small">What does that mean?</summary><p class="small">${d.term}</p></details>
   <div class="tiny mute"><b>How we harmonize:</b> ${d.method}</div></div>`).join('')}</div>
  <div class="card" style="margin-top:14px"><h3 style="margin-top:0">Get live NASA POWER climate for ${c.p.name}</h3>
   <p class="small mute">Calls the public NASA POWER API (25-year MERRA-2 monthly climatology) for the coordinates of this site and replaces the demo temperature and rainfall used in the model and calendar. Only the coordinates are sent.</p>
   <button class="btn sm" id="powerBtn">☁️ Fetch live data (${curLL().lat.toFixed(2)}, ${curLL().lon.toFixed(2)})</button> <span id="powerMsg" class="small mute"></span></div>
  <details><summary>How a production version pulls the real rasters (NASA Earthdata)</summary><pre>import earthaccess, xarray as xr, rioxarray
earthaccess.login()                              # free Earthdata account
bbox=(-120.2,36.2,-119.4,36.9); t=("2015-01-01","2025-12-31")
smap = earthaccess.search_data(short_name="SPL4SMGP", bounding_box=bbox, temporal=t)   # root-zone SM (9 km)
eco  = earthaccess.search_data(short_name="ECO_L3T_JET", bounding_box=bbox, temporal=t)# ET, 70 m
lst  = earthaccess.search_data(short_name="ECO_L2T_LSTE", bounding_box=bbox, temporal=t)
gpm  = earthaccess.search_data(short_name="GPM_3IMERGDF", bounding_box=bbox, temporal=t)# daily rain
hls  = earthaccess.search_data(short_name="HLSL30", bounding_box=bbox, temporal=t)     # Landsat NDVI, 30 m
mod  = earthaccess.search_data(short_name="MOD13Q1", bounding_box=bbox, temporal=t)    # MODIS NDVI, 250 m
grc  = earthaccess.search_data(short_name="TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4")# GRACE-FO mascons
dem  = earthaccess.search_data(short_name="NASADEM_HGT", bounding_box=bbox)            # 30 m elevation
# reproject everything to EPSG:3310 (California Albers) and resample to a 250 m grid → feature stack</pre></details>`;
  $('#powerBtn').onclick=fetchPower;
}
async function fetchPower(){
  const{lat,lon}=curLL(),msg=$('#powerMsg');msg.textContent='Contacting NASA POWER…';
  try{
    const r=await fetch(`https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,T2M_RANGE,T2M_MIN,PRECTOTCORR&community=AG&longitude=${lon}&latitude=${lat}&format=JSON`);
    if(!r.ok)throw new Error('HTTP '+r.status);const d=(await r.json()).properties.parameter,K=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    S.power={key:powerKey(),precip:K.map((k,i)=>+(d.PRECTOTCORR[k]*DAYS[i]).toFixed(1)),tmax:K.map(k=>+(d.T2M[k]+d.T2M_RANGE[k]/2).toFixed(1)),tmin:K.map(k=>+(d.T2M[k]-d.T2M_RANGE[k]/2).toFixed(1)),tminX:K.map(k=>d.T2M_MIN[k])};
    recompute();toast('Live NASA POWER climate loaded');renderP2();
  }catch(e){msg.innerHTML='<span style="color:#b42318">Could not reach NASA POWER ('+e.message+'). The demo climatology is still in use.</span>'}
}

/* ---- Harmonization ---- */
function resBtns(){return`<div class="seg" id="resSeg">${[100,250,500,1000].map(r=>`<button data-res="${r}" class="${S.res==r?'on':''}">${r<1000?r+' m':'1 km'}</button>`).join('')}</div>`}
function tabHarm(c,el){
  const res=S.res;
  const rows=DATASETS.map(d=>{const r=d.nat/res;let how,cls;
    if(r<.7){const n=Math.round((1/r)*(1/r));how=`Aggregate ≈ ${fmt(n)} native pixels → 1 cell (mean, QC-weighted)`;cls='s'}
    else if(r>1.4){const n=Math.round(r*r);how=`Disaggregate: 1 pixel spans ≈ ${fmt(n)} cells (downscale with NDVI/LST/slope)`;cls='w'}
    else{how='≈ same size → bilinear resample';cls='s'}
    return`<tr><td><b>${d.name}</b></td><td>${d.natLabel}</td><td class="small">${d.cad}</td><td><span class="chip ${cls}">${how}</span></td></tr>`}).join('');
  el.innerHTML=`<p>Satellites do not share a pixel size or a calendar. Landsat sees 30 m but returns every 8 days; SMAP sees 9 km every 2–3 days; GRACE sees ~300 km once a month. To make features that a model can compare, we put every layer on a <b>common grid</b> in a <b>common projection (EPSG:3310, California Albers)</b> and a <b>common time step</b>.</p>
  <div class="pipe"><div><b>1 · Reproject</b>All rasters → EPSG:3310, aligned origin.</div><div><b>2 · Quality mask</b>Drop cloud / shadow / low-QC pixels (Landsat Fmask, SMAP retrieval flag, ECOSTRESS cloud).</div><div><b>3 · Spatial resample</b>Fine → aggregate (mean). Coarse → disaggregate with fine-scale helpers. Rain → bilinear.</div><div><b>4 · Temporal composite</b>Weekly / monthly medians; gap-fill NDVI with a smoother.</div><div><b>5 · Anomalies</b>z-score each cell/month vs. its 2003–2025 climatology.</div><div><b>6 · Feature stack</b>Per-cell features → strategy comparison model.</div></div>
  <div class="row" style="align-items:center;margin:12px 0"><div style="flex:0 0 auto"><b>Choose the common analysis grid:</b> ${resBtns()}</div><div class="small mute">Smaller cells reveal field-scale detail but coarse datasets (SMAP, GPM, GRACE) cannot add information at that scale — they only provide context.</div></div>
  <div class="tw"><table><tr><th>Dataset</th><th>Native pixel</th><th>Revisit</th><th>Treatment on the ${res<1000?res+' m':'1 km'} grid</th></tr>${rows}</table></div>
  <div class="note"><b>Why this matters:</b> A single GRACE pixel covers ~${fmt(Math.pow(300000/res,2))} cells on this grid, and one SMAP pixel ~${fmt(Math.pow(9000/res,2))} cells. Treating them as if they measured each cell would overstate our certainty — so the tool tags every derived feature with its <i>native resolution</i> and widens uncertainty for coarse inputs.</div>`;
  $('#resSeg').onclick=e=>{const b=e.target.closest('[data-res]');if(b){S.res=+b.dataset.res;tabHarm(c,el)}};
}

/* ---- Map & field layers ---- */
function hash(i,j,s){let h=Math.imul(i*374761393+j*668265263+s*2147483647,1274126177);h=(h^(h>>>13))>>>0;return(Math.imul(h,1103515245)>>>0)/4294967296}
function vnoise(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);const a=hash(xi,yi,s),b=hash(xi+1,yi,s),c=hash(xi,yi+1,s),d=hash(xi+1,yi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
const fbm=(x,y,s)=>.6*vnoise(x,y,s)+.3*vnoise(x*2.3,y*2.3,s+7)+.1*vnoise(x*5.1,y*5.1,s+13);
function fields(u,v,c){
  const s=c.seed,p=c.p;
  const slope=p.slope*(.25+1.8*fbm(u*3.2,v*3.2,s+2));
  const eros=clamp(2.4*(c.soil.K/.3)*(1+slope/3)*(.15+c.bareRain.A)*(.7+.6*fbm(u*7,v*7,s+9)),0,12);
  const aridity=clamp(1-c.pr/c.et,0,1),esi=clamp(.18+.6*aridity*(.7+.6*fbm(u*6,v*6,s+3)),0,1);
  const sm=p.smap+(fbm(u*1.2,v*1.2,s+4)-.5)*.5+(.5-fbm(u*8,v*8,s+13))*.35;
  const bare=clamp(100*c.bare.A/12*(.7+.6*fbm(u*5,v*5,s+5)),0,100);
  const frost=clamp((5-c.minTmin)*7,0,35)*(.4+1.2*(1-fbm(u*4,v*4,s+6)));
  const prio=100*clamp(.35*clamp(eros/6,0,1)+.25*clamp(bare/60,0,1)+.25*esi+.15*clamp(-sm/1.2,0,1),0,1);
  return{slope,eros,esi,sm,bare,frost,grace:p.grace,prio};
}
const RAMPS={
  seq:[[0,[255,248,225]],[.4,[253,203,124]],[.75,[227,92,51]],[1,[110,10,10]]],
  div:[[0,[140,81,10]],[.5,[245,245,240]],[1,[1,102,94]]],
  cold:[[0,[245,250,255]],[.5,[130,170,225]],[1,[70,40,150]]],
  grn:[[0,[255,255,230]],[.5,[140,200,120]],[1,[20,100,60]]]
};
function ramp(name,t){const st=RAMPS[name];t=clamp(t,0,1);for(let i=1;i<st.length;i++)if(t<=st[i][0]){const[a,ca]=st[i-1],[b,cb]=st[i],f=(t-a)/(b-a||1);return`rgb(${ca.map((x,k)=>Math.round(x+(cb[k]-x)*f)).join(',')})`}return`rgb(${st[st.length-1][1].join(',')})`}
const LAYERS=[
 {id:'prio',name:'⭐ Cover-crop priority zones (composite)',src:'Combines erosion, bare-field days, water stress and dry soil',native:'common grid',key:'prio',range:[0,100],unit:'score',ramp:'seq',f:v=>fmt(v)+' / 100',txt:'Where a winter cover crop would pay off first: darker = bigger gain.'},
 {id:'eros',name:'Erosion risk',src:'SRTM slope × soil erodibility × bare-season rain (GPM, Landsat/MODIS)',native:'30 m (SRTM)',key:'eros',range:[0,8],unit:'t/ac/yr',ramp:'seq',f:v=>v.toFixed(1)+' t/ac/yr',txt:'Soil loss risk from water and wind while the ground is bare.'},
 {id:'esi',name:'Water-stress hotspots (ESI)',src:'ECOSTRESS ET ÷ PET, summer',native:'70 m',key:'esi',range:[0,1],unit:'0–1',ramp:'seq',f:v=>v.toFixed(2),txt:'Higher = crop drawing less water than it wants (stressed).'},
 {id:'sm',name:'Soil-moisture anomaly',src:'SMAP root-zone anomaly, downscaled',native:'9 km → downscaled',key:'sm',range:[-1.5,1],unit:'σ',ramp:'div',rev:false,f:v=>(v>0?'+':'')+v.toFixed(2)+' σ',txt:'Brown = drier than normal, teal = wetter. Mostly regional; field texture is modelled.'},
 {id:'bare',name:'Bare-field days',src:'Landsat/MODIS NDVI < 0.25 under baseline rotation',native:'30–250 m',key:'bare',range:[0,70],unit:'% of year',ramp:'seq',f:v=>fmt(v)+'% of year',txt:'Share of the year the soil has little or no cover.'},
 {id:'frost',name:'Frost-prone low spots',src:'NASA POWER Tmin + SRTM cold-air pooling',native:'55 km + 30 m',key:'frost',range:[0,40],unit:'nights/yr',ramp:'cold',f:v=>fmt(v)+' frost nights',txt:'Low spots collect cold air; darker = more frost nights.'},
 {id:'grace',name:'Groundwater trend (GRACE)',src:'GRACE-FO mascon',native:'~300 km',key:'grace',range:[-3,0],unit:'cm/yr',ramp:'seq',rev:true,f:v=>v.toFixed(1)+' cm/yr',txt:'One pixel covers the whole farm — and ~100,000 others. Context only.'}
];
function mapPoint(lon,lat){const k=53.6;return[(lon+124.6)*.8*k,(42.1-lat)*k]}
function tabMap(c,el){
  const L=LAYERS.find(l=>l.id===S.layer)||LAYERS[0];
  const poly=CA_OUTLINE.map(([lo,la])=>mapPoint(lo,la).join(',')).join(' ');
  const marks=Object.keys(REGIONS).map(k=>{const r=REGIONS[k],[x,y]=mapPoint(r.lon,r.lat),sel=(S.region===k);return`<g data-reg="${k}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="${sel?9:6}" fill="${sel?'#d9822b':'#2d6a4f'}" stroke="#fff" stroke-width="2"/><text x="${k==='salinas'?x-11:x+11}" y="${y+4}" text-anchor="${k==='salinas'?'end':'start'}" font-size="11" fill="#1d2a23" font-weight="${sel?700:400}">${r.short}</text></g>`}).join('');
  let cm='';if(S.region==='custom'){const[x,y]=mapPoint(c.p.lon,c.p.lat);cm=`<circle cx="${x}" cy="${y}" r="9" fill="#d9822b" stroke="#fff" stroke-width="2"/><text x="${x+11}" y="${y+4}" font-size="11" font-weight="700">Your point</text>`}
  const nx=Math.round(5000/S.res),ny=Math.round(3500/S.res),cw=600/nx,ch=420/ny;let cells='';
  const vals=[];
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){let a=0;for(let sj=0;sj<2;sj++)for(let si=0;si<2;si++)a+=fields((i+(si+.5)/2)/nx,(j+(sj+.5)/2)/ny,c)[L.key];vals.push(a/4)}
  let lowT=Math.min(...vals),hiT=Math.max(...vals);if(hiT-lowT<1e-6){lowT=L.range[0];hiT=L.range[1]}
  vals.forEach((a,k)=>{const i=k%nx,j=Math.floor(k/nx);let t=(a-lowT)/(hiT-lowT);if(L.rev)t=1-t;cells+=`<rect x="${i*cw}" y="${j*ch}" width="${cw+.5}" height="${ch+.5}" fill="${ramp(L.ramp,t)}" data-v="${a.toFixed(3)}"/>`});
  el.innerHTML=`<p class="small mute">Pick a layer. The big grid is a <b>${nx}×${ny}-cell, ${S.res<1000?S.res+' m':'1 km'} analysis grid</b> over a 5 × 3.5 km area around your field. <span class="chip w">Demonstration surfaces: built from this region’s climatology and your soil, with fine-scale texture simulated — not real pixels.</span> Replace <code>fields()</code> with rasters from the Earthdata pipeline for a production map.</p>
  <div class="row" style="margin-bottom:8px"><select id="layerSel" style="max-width:420px">${LAYERS.map(l=>`<option value="${l.id}" ${l.id===S.layer?'selected':''}>${l.name}</option>`).join('')}</select><div style="flex:0 0 auto">${resBtns()}</div></div>
  <div class="mapwrap"><div><svg viewBox="0 0 500 520" width="100%" id="caMap"><polygon points="${poly}" fill="#eaf3ee" stroke="#2d6a4f" stroke-width="2"/>${marks}${cm}</svg><div class="tiny mute">Click a dot to switch region.</div></div>
  <div class="rel"><svg viewBox="0 0 600 420" width="100%" id="grid" style="border-radius:10px;border:1px solid #0002">${cells}</svg><div class="tip" id="gtip"></div>
   <div class="legend"><span>${L.f(lowT)}</span><i style="background:linear-gradient(90deg,${[0,.25,.5,.75,1].map(t=>ramp(L.ramp,L.rev?1-t:t)).join(',')})"></i><span>${L.f(hiT)}</span></div>
   <p class="small"><b>${L.name}</b> — ${L.txt}<br><span class="mute tiny">Source: ${L.src} · native ${L.native}${L.id==='grace'?' · <b>every cell is identical on purpose</b>':''}</span></p></div></div>
  ${priorityZones(c)}`;
  $('#layerSel').onchange=e=>{S.layer=e.target.value;tabMap(c,el)};
  $('#resSeg').onclick=e=>{const b=e.target.closest('[data-res]');if(b){S.res=+b.dataset.res;tabMap(c,el)}};
  $$('#caMap [data-reg]').forEach(g=>g.onclick=()=>{S.region=g.dataset.reg;S.lat=S.lon=null;recompute();renderP2()});
  const g=$('#grid'),tip=$('#gtip');g.onmousemove=e=>{const r=e.target.closest('rect');if(!r){return}const bb=g.getBoundingClientRect(),host=g.parentElement.getBoundingClientRect();tip.style.display='block';tip.innerHTML=`${L.name.replace('⭐ ','')}: <b>${L.f(+r.dataset.v)}</b>`;tip.style.left=Math.min(e.clientX-host.left+12,host.width-200)+'px';tip.style.top=(e.clientY-host.top-8)+'px'};g.onmouseleave=()=>tip.style.display='none';
}
function priorityZones(c){
  let hot=0,n=0;const N=20;for(let j=0;j<N;j++)for(let i=0;i<N;i++){n++;if(fields((i+.5)/N,(j+.5)/N,c).prio>=55)hot++}
  return`<div class="info" style="margin-top:12px"><b>Reading the map:</b> about <b>${fmt(hot/n*100)}%</b> of the analysis area scores ≥ 55 on cover-crop priority — start winter cover there (steeper, erodible, or frequently bare ground) and walk those spots with your advisor before committing the whole field. Frost-prone low spots are where tender crops, or a tall winter cover that holds cold air, need extra care.</div>`;
}

/* ---- Seasonal vulnerability calendar ---- */
function tabCal(c,el){
  const p=c.p,crop=c.crop,present=c.nd.A.map(v=>v>=.4);
  const heat=p.tmax.map(t=>clamp((t-crop.heatThr+3)/8,0,1));
  const frost=(p.tminX||p.tmin).map(t=>clamp((3-t)/6,0,1));
  const wdef=p.et0.map((e,i)=>clamp((e-p.precip[i])/200,0,1));
  const maxP=Math.max(...p.precip,1);
  const bareRain=c.bareMo.A.map((b,i)=>b?clamp(p.precip[i]/(maxP*.6),0,1):0);
  const bareHeat=c.bareMo.A.map((b,i)=>b?clamp((p.tmax[i]-24)/16,0,1):0);
  const exposed=(arr,i)=>arr[i]*(present[i]?1:.45);
  const rows=[['🌡️ Heat stress (Tmax vs crop limit)',heat.map((v,i)=>exposed(heat,i)),'#c0392b',p.tmax.map(t=>fmt(t))],
    ['❄️ Frost risk (coldest nights)',frost.map((v,i)=>exposed(frost,i)),'#4a6fb5',(p.tminX||p.tmin).map(t=>fmt(t))],
    ['💧 Water deficit (ET₀ − rain)',wdef.map((v,i)=>exposed(wdef,i)),'#d9822b',p.et0.map((e,i)=>fmt(e-p.precip[i]))],
    ['🌧️ Bare soil in rainy months',bareRain,'#7a4a1a',p.precip.map(x=>fmt(x))],
    ['🌬️ Bare & hot (dust / ECOSTRESS LST)',bareHeat,'#a0522d',p.tmax.map(t=>fmt(t+17))]];
  const cell=(v,col,txt)=>`<div style="background:${col};opacity:${.15+.85*v};color:${v>.5?'#fff':'#1d2a23'}" title="${txt}">${txt}</div>`;
  const hdr=`<div class="lab"></div>${MONTHS.map(m=>`<div class="hd">${m}</div>`).join('')}`;
  const body=rows.map(([l,arr,col,tx])=>`<div class="lab">${l}</div>`+arr.map((v,i)=>cell(v,col,tx[i])).join('')).join('')
    +`<div class="lab">🌱 ${crop.name}: canopy (NDVI)</div>`+c.nd.A.map(v=>`<div style="background:${v<.25?'#e9dcc0':ramp('grn',v)};color:${v>.6?'#fff':'#1d2a23'}">${v.toFixed(2)}</div>`).join('')
    +`<div class="lab">🌿 With winter cover (B)</div>`+c.nd.B.map(v=>`<div style="background:${v<.25?'#e9dcc0':ramp('grn',v)};color:${v>.6?'#fff':'#1d2a23'}">${v.toFixed(2)}</div>`).join('');
  const score=arr=>arr.reduce((a,v,i)=>a+exposed(arr,i),0)/12;
  const worst=(arr)=>{let b=0;arr.forEach((v,i)=>{if(exposed(arr,i)>exposed(arr,b))b=i});return MONTHS[b]};
  el.innerHTML=`<p>Where and when is <b>${crop.name}</b> vulnerable here? Each row blends NASA POWER temperature/rain, ECOSTRESS-style heat and ET signals, and Landsat/MODIS NDVI. Darker cells = higher exposure; the cream cells at the bottom are <b>bare-field</b> months (NDVI &lt; 0.25).</p>
  <div class="tw"><div class="cal" style="min-width:760px">${hdr}${body}</div></div>
  <div class="grid3" style="margin-top:14px">
   <div class="note"><b>Crop vulnerability</b><br>Heat peaks in <b>${worst(heat)}</b> (limit ${crop.heatThr} °C). Frost: ${crop.frostSens}; coldest nights ≈ ${fmt(c.minTmin)} °C. Water deficit peaks in <b>${worst(wdef)}</b>.</div>
   <div class="note"><b>Bare-field periods</b><br>${bareList(c).length?`Bare in <b>${bareList(c).join(', ')}</b> — ${fmt(c.bareRain.A*100)}% of annual rain falls then. A winter cover shrinks this to ${c.bare.B} month(s).`:'The canopy covers the soil all year — cover crops add less here.'}</div>
   <div class="note"><b>Extreme weather</b><br>~${p.xdays} extreme-rain days/yr (GPM); hottest-month max ≈ ${fmt(c.maxTmax)} °C. A multi-year drought (see Phase 4) lowers rain ~${fmt(42*S.drought/100)}% and raises heat.</div></div>
  <h3>Monthly climate at this site</h3>${monthlyChart(c)}`;
}

/* ---- Satellite vs ground ---- */
function tabSat(c,el){
  const n=S.sat,fused=Math.sqrt(1/(1/Math.pow(.06,2)+n/Math.pow(.05,2)));
  el.innerHTML=`<p>Satellites and ground instruments measure <i>different things at different scales</i>. Neither is “the truth” — good decisions blend both.</p>
  <div class="tw"><table><tr><th>Variable</th><th>Satellite (NASA)</th><th>Ground-based</th><th>Why combine?</th></tr>
  <tr><td>Soil moisture</td><td>SMAP: ~9 km, top 5 cm (root zone is modelled)</td><td>Probes / tensiometers: one point, any depth</td><td>Probe shows your field; SMAP shows regional wetness &amp; fills gaps. Use probes to calibrate SMAP downscaling.</td></tr>
  <tr><td>Evapotranspiration</td><td>ECOSTRESS: 70 m, clear-sky overpasses only</td><td>CIMIS stations, flux towers, flow meters</td><td>Satellite maps field-to-field variability; CIMIS gives continuous daily reference ET.</td></tr>
  <tr><td>Rainfall</td><td>GPM IMERG: ~10 km</td><td>Rain gauges (CIMIS, CoCoRaHS)</td><td>Gauges are accurate but sparse; GPM shows storm footprints. Bias-correct GPM to gauges.</td></tr>
  <tr><td>Temperature</td><td>ECOSTRESS LST (skin temp)</td><td>Air-temperature sensors</td><td>Skin ≠ air temperature (bare soil may be 15–20 °C hotter). Needs a conversion.</td></tr>
  <tr><td>Crop vigor</td><td>Landsat / MODIS NDVI</td><td>Scouting, yield monitor</td><td>NDVI saturates on dense canopy; yield maps reveal what NDVI misses.</td></tr>
  <tr><td>Groundwater</td><td>GRACE-FO: ~300 km, monthly</td><td>DWR / SGMA monitoring wells</td><td>GRACE gives the regional trend; your wells give the local reality.</td></tr></table></div>
  <div class="card" style="margin-top:14px"><h3 style="margin-top:0">Try it: how much do on-farm sensors help?</h3>
   <p class="small mute">Toy illustration of inverse-variance data fusion for root-zone soil-moisture error (illustrative numbers: satellite-only error 0.06 m³/m³, each independent probe 0.05).</p>
   <div class="sl"><div class="t"><span>Soil-moisture probes in the field</span><span>${n}</span></div><input type="range" id="satN" min="0" max="8" value="${n}"></div>
   <div class="bar" style="height:18px"><i style="width:${fused/.06*100}%;background:var(--brand)"></i></div>
   <p class="small">Estimated error: <b>${fused.toFixed(3)} m³/m³</b> (${fmt((1-fused/.06)*100)}% lower than satellite alone). Real gains depend on probe placement and calibration — ask your advisor.</p></div>`;
  $('#satN').oninput=e=>{S.sat=+e.target.value;tabSat(c,el)};
}

/* ---- Modeling approach ---- */
function tabSI(c,el){
  el.innerHTML=`<p>The challenge asks us to explain <b>how the AI / statistical modeling works</b> and where it is uncertain. The prototype uses a transparent, layered approach rather than a black box — farmers and advisors can see <i>why</i> a strategy ranks where it does.</p>
  <div class="tw"><table><tr><th>Approach</th><th>What it does here</th><th>Strengths</th><th>Limits</th><th>In this tool</th></tr>
  <tr><td>Anomaly z-scores</td><td>Compares each month’s soil moisture / NDVI / LST to the 20+ yr norm to find stress and bare windows</td><td>Simple, explainable, needs no yield data</td><td>Says “unusual”, not “harmful”</td><td><span class="chip s">Implemented</span></td></tr>
  <tr><td>Multi-criteria scoring (weighted)</td><td>Scores water, organic matter, nitrogen, pests, income, weighted by the farmer’s top priority (40% on the chosen goal, 15% on each other)</td><td>Puts the farmer’s goals in charge</td><td>Weights are judgement calls</td><td><span class="chip s">Implemented</span></td></tr>
  <tr><td>Process model (soil carbon + water balance)</td><td>Annual time-step: SOM relaxes toward a management-set equilibrium, structure &amp; biology indices, irrigation demand, leaching, erosion, yield, cash flow</td><td>Captures slow soil change and trade-offs; every coefficient visible</td><td>Simplified, not calibrated to your field (RothC/DayCent-style models are the next step)</td><td><span class="chip s">Implemented</span></td></tr>
  <tr><td>Monte-Carlo weather ensemble</td><td>200 random weather histories (autocorrelated multi-year droughts, warming trend) run through all strategies on the <i>same</i> weather</td><td>Shows the range (P10–P90) and the probability that a strategy beats the baseline</td><td>Only as good as the weather generator</td><td><span class="chip s">Implemented</span></td></tr>
  <tr><td>Machine learning (random forest / gradient boosting)</td><td>Would learn field vulnerability from the harmonized feature stack against yield maps &amp; ground data</td><td>Finds non-obvious patterns</td><td>Needs labelled local data; harder to explain</td><td><span class="chip w">Proposed next</span></td></tr>
  <tr><td>Bayesian hierarchical model</td><td>Would pool information across farms while respecting local differences and giving formal credible intervals</td><td>Best uncertainty handling</td><td>Data-hungry, slower to build</td><td><span class="chip w">Proposed next</span></td></tr></table></div>
  <div class="grid2" style="margin-top:14px">
   <div class="note"><b>How uncertainty is shown</b><ul style="margin:4px 0 0 18px"><li>Shaded bands on every chart = 10th–90th percentile across the weather ensemble.</li><li>“Chance B beats A” = share of the 200 weather histories where B finished ahead.</li><li>Coarse datasets (SMAP, GRACE, GPM) are labelled as regional context, not field truth.</li></ul></div>
   <div class="warn"><b>Where local expertise must validate</b><ul style="margin:4px 0 0 18px"><li>Soil test &amp; SOM baseline; salinity, compaction, drainage.</li><li>Cover-crop species, seeding date, termination timing for your equipment.</li><li>Actual water rights, SGMA allocation and well data.</li><li>Local pests, buyers, contracts, crop insurance.</li></ul></div></div>
  <div class="info"><b>Key equations (all editable in <code>engine.js</code>).</b> SOM<sub>t+1</sub> = SOM<sub>t</sub> + 0.07 · (SOM₀ · (1 + g · soil capacity) − SOM<sub>t</sub>); water need = crop ET × (1 + 4%/°C warming + dry-year penalty) × (1 − 0.3% per point of water-retention gain) + cover-crop spring use in dry years; yield = 1 − K<sub>y</sub> · shortfall − heat − pest + soil-health bonus − transition dip; net = revenue − costs − water − cover seed/labor + N credit.</div>`;
}

/* =============== PHASE 3: strategies =============== */
function dots(n){return'●'.repeat(n)+'○'.repeat(5-n)}
function stripHTML(c,s){return`<div class="strip">${c.nd[s].map((v,i)=>`<div style="background:${v<.25?'#e9dcc0':ramp('grn',v)};color:${v>.6?'#fff':'#0008'}" title="${MONTHS[i]} NDVI ${v.toFixed(2)}${v<.25?' — bare':''}">${MONTHS[i][0]}</div>`).join('')}</div>`}
function explain(s,c,sim){
  const f=sim.fin,a=sim.avg,pr=sim.prob,crop=c.crop,p=c.p,X={why:[],ev:[],ben:[],risk:[],gap:[],loc:[]};
  const dPump=a.A.pump-a[s].pump,dLeach=(1-a[s].leach/a.A.leach)*100,dEros=(1-a[s].eros/a.A.eros)*100;
  if(s==='A'){
    X.why=['This is your current practice — the benchmark every other strategy is judged against.',`Leaves the soil bare ${c.bare.A} month(s) a year${bareList(c).length?' ('+bareList(c).join(', ')+')':''}, with ${fmt(c.bareRain.A*100)}% of annual rain falling on bare or thin cover.`];
    X.ev=[['Landsat/MODIS','NDVI < 0.25 in '+(bareList(c).join(', ')||'no months')],['GPM',fmt(c.wetShare*100)+'% of rain Nov–Mar'],['ECOSTRESS','bare-soil skin temp ≈ '+fmt(c.maxTmax+17)+' °C in summer'],['GRACE','regional storage trend '+p.grace.toFixed(1)+' cm/yr'],['SMAP','root-zone anomaly '+p.smap.toFixed(1)+' σ']];
    X.ben=['Familiar agronomy, equipment and labor; predictable contracts and insurance.','Lowest short-term management complexity and no seed/termination cost.'];
    X.risk=[`Soil organic matter drifts ${f.A.som<c.som0?'down':'sideways'}: ${c.som0.toFixed(2)}% → ${f.A.som.toFixed(2)}% over ${sim.Y} yrs.`,`Pumps ≈ ${a.A.pump.toFixed(2)} AF/ac/yr; in the worst simulated droughts the crop is short of water by up to ${fmt(Math.max(...sim.M.A.short.hi.slice(1))*100)}%.`,`Pest/disease pressure index climbs to ${f.A.pest.toFixed(0)} (from 40) without rotation.`,`Estimated erosion ${a.A.eros.toFixed(1)} t/ac/yr and nitrate leaching ≈ ${a.A.leach.toFixed(0)} lb N/ac/yr.`];
    X.gap=['No satellite measures your actual yield, nutrients or tillage — those come from your records.','Soil carbon baseline is regional; a lab test could change the picture.'];
    X.loc=['Confirm SOM and compaction with a soil test.','Check your SGMA allocation and well levels with the local groundwater agency.'];
  }
  if(s==='B'){
    X.why=[`Targets your goal (${PRIORITIES[S.priority].label.toLowerCase()}) with the smallest change to what you grow.`,`The cover crop (${crop.cover.label}) sits in the ${c.bare.A}-month bare window when ${fmt(c.bareRain.A*100)}% of rain arrives.`,`Pays off first in the priority zones on your map (steeper, erodible or frequently-bare ground).`];
    X.ev=[['GPM',fmt(c.wetShare*100)+'% of rain Nov–Mar → cover is rain-fed'],['Landsat/MODIS','bare months fall from '+c.bare.A+' to '+c.bare.B],['SMAP','winter anomaly '+p.smap.toFixed(1)+' σ → infiltration matters; spring dry-down is the water risk'],['SRTM','slope ≈ '+p.slope+'% + K '+c.soil.K+' → erosion exposure'],['ECOSTRESS','cover cuts bare-soil surface heat in cool season; check spring ET']];
    X.ben=[`Soil organic matter ${sgn(f.B.som-f.A.som,2)} pts vs. A by year ${sim.Y}; water-retention index ${sgn(f.B.wri-f.A.wri,0)} pts.`,`Erosion ${sgn(-dEros,0)}%, nitrate leaching ${sgn(-dLeach,0)}% (cover scavenges N and slows runoff).`,`Legume N credit ≈ ${usd(a.B.nsave)}/ac/yr in fertilizer.`,`${dPump>0.005?`Pumping ${sgn(-dPump,2)} AF/ac/yr`:`Pumping about the same`} on average; infiltration also adds to winter recharge.`];
    X.risk=[`Spring water use: in dry winters the cover can draw down stored soil moisture before ${crop.name.toLowerCase()} needs it (modelled penalty ${crop.cover.water} AF/ac at full adoption).`,`Chance B out-earns A over ${sim.Y} yrs: ${fmt(pr.Bnet*100)}% (cumulative net ${usd(f.B.net-f.A.net)}/ac vs. A at the median).`,'Grass covers (rye) can tie up nitrogen; early-year yield dip while soil and management adjust.','Seed, seeding and termination add cost ($'+fmt(crop.cover.cost*c.coverM)+'/ac) and labor in a busy window.'];
    X.gap=['No satellite sees nitrate directly — we infer leaching risk from wetness (SMAP) and storms (GPM); real reduction must be checked with soil nitrate tests.','Cover biomass, and thus benefit, varies a lot with seeding date and rain.',c.crop.type.startsWith('Perennial')?'Perennial systems respond slowly; field trials in your soil type are sparse.':'Field-to-field differences in compaction and drainage are not captured.'];
    X.loc=['UC Cooperative Extension advisor: species mix, seeding date, termination for your irrigation system.','NRCS / RCD: cost-share programs (e.g. EQIP, CDFA Healthy Soils) — confirm current eligibility.','Irrigation supplier: check cover-crop compatibility with '+S.irrig+' irrigation.'];
  }
  if(s==='C'){
    const alt=crop.alt;
    X.why=[crop.type.startsWith('Perennial')?'Perennials cannot rotate yearly, so diversity is built into the floor, grazing and the replant cycle.':`Adds a low-water rotation crop one year in ${Math.round(1/alt.share)}, breaking pest and weed cycles that monoculture builds.`,`Combines a lighter winter cover with new income (${alt.label}).`];
    X.ev=[['Crop traits','see table below: deep roots, N-fixing, drought tolerance'],['MODIS/Landsat','alt-crop growing season fills the bare window ('+c.bare.C+' bare months)'],['GPM',fmt(c.wetShare*100)+'% winter rain feeds rain-fed rotation crops'],['SMAP/ECOSTRESS','lower summer ET demand than the baseline crop'],['GRACE','lower pumping eases pressure on a '+p.grace.toFixed(1)+' cm/yr aquifer trend']];
    X.ben=[`Pest/disease index ${f.C.pest.toFixed(0)} vs. ${f.A.pest.toFixed(0)} for A at year ${sim.Y}.`,`${dPump>0.005?`Average pumping ${sgn(-dPump,2)} AF/ac/yr`:'Water use about the same'}; soil organic matter ${sgn(f.C.som-f.A.som,2)} pts vs. A.`,`Supplemental income: ${alt.share?`rotation crop ≈ ${usd(alt.rev*c.altM)}/ac gross in its years`:`grazing / insectary ≈ ${usd(alt.addRev*c.altM)}/ac/yr`}.`,`Cumulative net vs. A: ${usd(f.C.net-f.A.net)}/ac; chance C out-earns A: ${fmt(pr.Cnet*100)}%.`];
    X.risk=['Market and contract risk for the new crop or lease; revenue estimated at '+fmt(c.altM*100)+'% of nominal given your market access ('+S.market+').','New equipment, labor timing and crop-insurance rules.',alt.share?'Rotation crops can have lower margins than the baseline in some years.':'Grazing needs fencing, a grazier and food-safety/pesticide-label compliance.','Weeds or volunteers if the rotation crop is poorly managed.'];
    X.gap=['Local yield and price data for alternative crops are the biggest unknown.','No satellite product substitutes for field trials of the new crop on your soil.'];
    X.loc=['Farm advisor + a local buyer: confirm agronomy, varieties and a market before planting.','Insurance agent: eligibility of the new crop.',crop.market];
  }
  return X;
}
function renderP3(){
  const c=ctx(),sim=S.sim,sc=sim.scores,crop=c.crop,pr=PRIORITIES[S.priority];
  const crit=[['water','Water'],['som','Soil organic matter'],['n','Nitrogen / nitrate'],['pest','Pest cycles'],['income','Income']];
  const card=s=>{const X=explain(s,c,sim),t=crop.strat[s],best=sc.best===s;
    return`<div class="scard" style="border-top-color:${SC[s]}"><h3 style="color:${SC[s]}">${SN[s]}${best?'<span class="badge">★ best fit for you</span>':''}</h3>
    <div style="font-weight:600;margin-top:4px">${t[0]}</div><div class="small mute">${t[1]}</div>${stripHTML(c,s)}<div class="tiny mute">Ground cover by month (cream = bare, NDVI&lt;0.25)</div>
    <div style="margin:10px 0"><div class="small"><b>Fit to your priorities: ${fmt(sc[s].total)}/100</b></div><div class="bar"><i style="width:${sc[s].total}%;background:${SC[s]}"></i></div>
    ${crit.map(([k,l])=>`<div class="tiny" style="display:flex;gap:6px;align-items:center;margin-top:3px"><span style="width:120px">${l}${sc.weights[k]>.3?' ★':''}</span><div class="bar" style="flex:1;height:6px"><i style="width:${sc[s][k]}%;background:${SC[s]};opacity:.75"></i></div><span style="width:26px;text-align:right">${fmt(sc[s][k])}</span></div>`).join('')}</div>
    <h4>Why it was suggested</h4><ul>${X.why.map(x=>`<li>${x}</li>`).join('')}</ul>
    <h4>Evidence (NASA &amp; other)</h4><div>${X.ev.map(([a,b])=>`<span class="chip"><b>${a}</b>: ${b}</span>`).join('')}</div>
    <h4>Benefits</h4><ul>${X.ben.map(x=>`<li>${x}</li>`).join('')}</ul>
    <h4>Risks</h4><ul>${X.risk.map(x=>`<li>${x}</li>`).join('')}</ul>
    <h4>Information gaps</h4><ul>${X.gap.map(x=>`<li>${x}</li>`).join('')}</ul>
    <h4>Needs local review</h4><ul>${X.loc.map(x=>`<li>${x}</li>`).join('')}</ul></div>`};
  const keys=[...new Set([...crop.cover.keys,...crop.alt.keys])];
  $('#p3').innerHTML=`<div class="card"><h2>Phase 3 · Rotation strategies for ${crop.icon} ${crop.name} in ${c.p.short}</h2>
   <p class="mute">Three strategies, including your existing rotation, scored against your priority <b>${pr.icon} ${pr.label}</b> (40% weight; other goals 15% each). Scores reflect the simulation at your current Phase 4 settings (drought ${S.drought}%, cover adoption ${S.adopt}%).</p>
   <div class="grid3">${card('A')}${card('B')}${card('C')}</div></div>
  <div class="card"><h2>Crop characteristics</h2><p class="small mute">How each crop contributes to soil health: nitrogen-fixing legumes feed the next crop, deep roots open the soil and reach stored water, grasses build residue/organic matter, drought-tolerant crops cut water demand.</p>
   <div class="tw"><table><tr><th>Crop</th><th>Role</th><th>Root depth</th><th>N fixed</th><th>Residue</th><th>Water (in)</th><th>Drought tol.</th><th>Frost tol.</th><th>Soil carbon</th><th>Notes</th></tr>
   <tr style="background:#faf6ea"><td><b>${crop.icon} ${crop.name}</b> (baseline)</td><td>${crop.type}</td><td>—</td><td>${crop.nRate?'needs ~'+crop.nRate+' lb N':'fixes own N'}</td><td>—</td><td>${fmt(crop.water*12*c.wscale)}</td><td>—</td><td>${crop.frostSens}</td><td>—</td><td>Heat limit ≈ ${crop.heatThr} °C · pests: ${crop.pests.join(', ')}</td></tr>
   ${keys.map(k=>{const t=TRAITS[k];return`<tr><td><b>${t.name}</b></td><td>${t.role}</td><td>${t.root} cm</td><td>${t.n?'≈ '+t.n+' lb/ac':'—'}</td><td>${t.bio} t/ac</td><td>${t.water}</td><td class="dots">${dots(t.drought)}</td><td class="dots">${dots(t.frost)}</td><td class="dots">${dots(t.som)}</td><td class="small">${t.note}</td></tr>`}).join('')}</table></div></div>
  <div class="grid2"><div class="card"><h2>Pest &amp; disease cycles</h2><p class="small">${crop.pestNote}</p><p class="small">Key threats: ${crop.pests.map(x=>`<span class="chip w">${x}</span>`).join('')}</p>
   <p class="small">Simulated pest-pressure index at year ${sim.Y} (lower is better): <b style="color:${SC.A}">A ${sim.fin.A.pest.toFixed(0)}</b> · <b style="color:${SC.B}">B ${sim.fin.B.pest.toFixed(0)}</b> · <b style="color:${SC.C}">C ${sim.fin.C.pest.toFixed(0)}</b></p></div>
   <div class="card"><h2>Supplemental income &amp; markets</h2><ul class="small"><li><b>Cover crop (B):</b> costs ≈ ${usd(crop.cover.cost*c.coverM)}/ac/yr (${S.equip==='own'?'own seeder':'custom seeding'}); offsets ≈ ${usd(sim.avg.B.nsave)}/ac/yr of fertilizer.</li><li><b>Diversified (C):</b> ${crop.alt.label}.</li><li><b>Market note:</b> ${crop.market}</li><li><b>Incentives:</b> look into CDFA Healthy Soils Program and USDA NRCS EQIP/CSP — rates change yearly, confirm locally.</li></ul>
   <p class="small mute">Your market access setting (“${S.market}”) scales alternative-crop revenue to ${fmt(c.altM*100)}% of nominal.</p></div></div>
  <div style="text-align:right"><button class="btn" data-go="4">Next: run the simulation →</button></div>`;
}

/* =============== PHASE 4: simulation widget =============== */
const SLIDERS=[
 ['years','Simulation timeline',5,20,1,v=>v+' yrs','Soil changes slowly — 10+ years shows the payoff (max 20).'],
 ['drought','Drought severity',0,100,5,v=>v+'%','0 = normal climate · 100 = persistent multi-year drought (rain ≈ −42%, more variable).'],
 ['warm','Warming by end of period',0,4,.5,v=>'+'+v+' °C','Raises crop water demand and heat stress (summer heat, ECOSTRESS-type signal).'],
 ['adopt','Cover-crop / rotation adoption',0,100,5,v=>v+'%','Share of the field managed under Strategies B and C.'],
 ['water','Irrigation water available',40,100,5,v=>v+'%','Of full crop need in a normal year; falls further in dry years.'],
 ['price','Crop price scenario',-30,30,5,v=>sgn(v)+'%','Applies to baseline crop revenue.'],
 ['incent','Cost-share / incentive payment',0,150,10,v=>'$'+v+'/ac/yr','e.g. CDFA Healthy Soils or NRCS EQIP-type payments for B/C practices — 0 = none (confirm real rates locally).']
];
const PRESETS={typ:{t:'Typical',d:{drought:30,warm:1.5,price:0}},dry:{t:'🏜️ Dry decade',d:{drought:75,warm:2,price:0}},hot:{t:'🔥 Hot & dry future',d:{drought:60,warm:3.5,price:-10}},wet:{t:'🌧️ Wetter, stable',d:{drought:5,warm:.5,price:0}}};
function renderP4(){
  const c=ctx();
  $('#p4').innerHTML=`<div class="card"><h2>Phase 4 · Interactive simulation</h2><p class="mute">Slide the controls — 200 random weather histories re-run instantly for all three strategies on the <i>same</i> weather. Lines are the median; shaded bands are the 10th–90th percentile. Hover a chart for exact values.</p>
  <div class="sctl"><div><div class="card" style="margin:0;padding:12px">
   <div class="small"><b>Scenario presets</b></div><div class="row" style="gap:6px;margin:6px 0">${Object.keys(PRESETS).map(k=>`<button class="btn ghost sm" data-preset="${k}">${PRESETS[k].t}</button>`).join('')}</div>
   ${SLIDERS.map(([k,l,mn,mx,st,f,h])=>`<div class="sl"><div class="t"><span>${l}</span><span id="o_${k}"></span></div><input type="range" data-s="${k}" min="${mn}" max="${mx}" step="${st}" value="${S[k]}"><div class="h">${h}</div></div>`).join('')}
   <div class="small"><b>Show</b></div><div class="seg" id="modeSeg"><button data-mode="ensemble" class="${S.mode==='ensemble'?'on':''}">Range of futures</button><button data-mode="single" class="${S.mode==='single'?'on':''}">One weather history</button></div>
   <div style="margin-top:8px"><button class="btn ghost sm" id="reroll">🎲 Draw new weather</button></div>
  </div></div><div id="simOut"></div></div></div>
  <div class="card" id="simTable"></div>
  <div style="text-align:right"><button class="btn" data-go="5">Next: summary →</button></div>`;
  const upd=()=>{SLIDERS.forEach(([k,,,,,f])=>{$('#o_'+k).textContent=f(S[k])});recompute();drawSim()};
  $$('#p4 [data-s]').forEach(i=>i.oninput=()=>{S[i.dataset.s]=+i.value;upd()});
  $$('#p4 [data-preset]').forEach(b=>b.onclick=()=>{Object.assign(S,PRESETS[b.dataset.preset].d);$$('#p4 [data-s]').forEach(i=>i.value=S[i.dataset.s]);upd()});
  $('#modeSeg').onclick=e=>{const b=e.target.closest('[data-mode]');if(b){S.mode=b.dataset.mode;$$('#modeSeg button').forEach(x=>x.classList.toggle('on',x===b));drawSim()}};
  $('#reroll').onclick=()=>{S.seed++;recompute();drawSim()};
  upd();
}
function drawSim(){
  const sim=S.sim,c=ctx(),Mx=S.mode==='single'?sim.M1:sim.M,Y=sim.Y,ser=m=>['A','B','C'].map(s=>({name:SN[s].split(' · ')[1]==='Conventional'?'A Conventional':s==='B'?'B Cover crop':'C Diversified',color:SC[s],...Mx[s][m]}));
  const w=S.mode==='single'?sim.weather:null,band=S.mode==='ensemble';
  const C=[['shi','Soil health index (0–100)','',1,{from0:true}],['wri','Water retention index (0–100)','',1,{from0:true}],['net','Cumulative net returns, discounted ($/ac)','$',0,{from0:true,zero:true}],['pump','Groundwater pumped (AF/ac/yr)','AF',2,{}],['leach','Nitrate leaching (lb N/ac/yr)','lb',0,{}],['eros','Soil erosion (t/ac/yr)','t',1,{}]];
  $('#simOut').innerHTML=`<div class="leg">${['A','B','C'].map(s=>`<span><i style="background:${SC[s]}"></i>${SN[s]}</span>`).join('')}${w?'<span><i style="background:#d9822b;opacity:.3"></i>dry year</span>':''}</div><div class="charts">${C.map(([m,t,u,d,o])=>lineChart({series:ser(m),Y,title:t,unit:u,dec:d,band,weather:w,...o})).join('')}</div>`;
  const f=sim.fin,a=sim.avg,pr=sim.prob;
  const dl=(v,good,fmtf)=>`<span class="${(good?v>=0:v<=0)?'up':'dn'}">${fmtf(v)}</span>`;
  const row=(l,fn)=>`<tr><td>${l}</td>${['A','B','C'].map(s=>`<td>${fn(s)}</td>`).join('')}</tr>`;
  $('#simTable').innerHTML=`<h2>Summary metrics — year ${Y} (median) · drought ${S.drought}% · adoption ${S.adopt}%</h2>
  <div class="kpi"><div><b>${f.B.som>f.A.som?'+':''}${(f.B.som-f.A.som).toFixed(2)} pts</b><span>Soil organic matter, B vs A</span></div><div><b>${sgn(f.B.wri-f.A.wri,0)} pts</b><span>Water-retention index, B vs A</span></div><div><b>${usd(f.B.net-f.A.net)}</b><span>Cumulative net, B − A ($/ac)</span></div><div><b>${fmt(pr.Bnet*100)}%</b><span>Chance B out-earns A</span></div><div><b>${sim.be.B?'year '+sim.be.B:'not in '+Y+' yrs'}</b><span>B pays back vs A</span></div><div><b>${sgn(-(a.A.pump-a.B.pump)*Y,1)} AF/ac</b><span>Groundwater use, B − A (cumulative)</span></div></div>
  <div class="tw" style="margin-top:10px"><table><tr><th>Indicator</th><th style="color:${SC.A}">A · Conventional</th><th style="color:${SC.B}">B · Cover crop</th><th style="color:${SC.C}">C · Diversified</th></tr>
  ${row('Soil organic matter (%)',s=>f[s].som.toFixed(2)+(s==='A'?'':' '+dl(f[s].som-f.A.som,true,v=>'('+sgn(v,2)+')')))}
  ${row('Soil health index',s=>fmt(f[s].shi)+(s==='A'?'':' '+dl(f[s].shi-f.A.shi,true,v=>'('+sgn(v,0)+')')))}
  ${row('Water retention index',s=>fmt(f[s].wri)+(s==='A'?'':' '+dl(f[s].wri-f.A.wri,true,v=>'('+sgn(v,0)+')')))}
  ${row('Cumulative net returns ($/ac, 3% discount)',s=>usd(f[s].net)+(s==='A'?'':' '+dl(f[s].net-f.A.net,true,v=>'('+(v<0?'−':'+')+'$'+fmt(Math.abs(v))+')')))}
  ${row('Avg annual net ($/ac)',s=>usd(f[s].net/Y*1.03**(Y/2)))}
  ${row('Groundwater pumped (AF/ac/yr, avg)',s=>a[s].pump.toFixed(2)+(s==='A'?'':' '+dl(a[s].pump-a.A.pump,false,v=>'('+sgn(v,2)+')')))}
  ${row('Irrigation applied (AF/ac/yr, avg)',s=>a[s].applied.toFixed(2))}
  ${row('Nitrate leaching (lb N/ac/yr, avg)',s=>fmt(a[s].leach)+(s==='A'?'':' '+dl(a[s].leach-a.A.leach,false,v=>'('+sgn(v,0)+')')))}
  ${row('Fertilizer N credit ($/ac/yr)',s=>usd(a[s].nsave))}
  ${row('Erosion (t/ac/yr, avg)',s=>a[s].eros.toFixed(1))}
  ${row('Pest/disease pressure index',s=>fmt(f[s].pest))}
  ${row('Bare months per year',s=>c.bare[s])}
  ${row('Avg water shortfall (% of need)',s=>fmt(a[s].short*100,1)+'%')}
  ${row('Chance it beats A on net returns',s=>s==='A'?'—':fmt(pr[s+'net']*100)+'%')}
  ${row('Chance it uses less groundwater than A',s=>s==='A'?'—':fmt(pr[s+'pump']*100)+'%')}</table></div>
  <div class="note" style="margin-top:10px">${keyTakeaways(sim,c)}</div>`;
}
function keyTakeaways(sim,c){
  const f=sim.fin,a=sim.avg,pr=sim.prob,out=[];
  out.push(`<b>Soil:</b> under A, organic matter ${f.A.som<c.som0?'declines':'holds'} to ${f.A.som.toFixed(2)}%; B reaches ${f.B.som.toFixed(2)}% and C ${f.C.som.toFixed(2)}%.`);
  out.push(`<b>Water:</b> B changes average pumping by ${sgn(a.B.pump-a.A.pump,2)} AF/ac/yr and C by ${sgn(a.C.pump-a.A.pump,2)} — ${S.drought>=60?'drought stress makes cover-crop spring water use visible; compare the dry-year penalty on yield.':'benefits come mostly from infiltration and lower evaporation.'}`);
  out.push(`<b>Money:</b> payback for B ${sim.be.B?'in year '+sim.be.B:'is not reached'}; ${fmt(pr.Bnet*100)}% of weather futures favor B and ${fmt(pr.Cnet*100)}% favor C on cumulative net returns.`);
  if(S.adopt<30)out.push('Low adoption limits benefits — try ≥ 50% to see the structural gains.');
  return out.join('<br>');
}

/* =============== PHASE 5: summary =============== */
function renderP5(){
  const c=ctx(),sim=S.sim,f=sim.fin,a=sim.avg,pr=sim.prob,sc=sim.scores,p=c.p,crop=c.crop,best=sc.best,Y=sim.Y;
  const prio=PRIORITIES[S.priority];
  const recName={A:'stay with Strategy A',B:'adopt Strategy B (winter cover cropping)',C:'adopt Strategy C (diversified cash-cover rotation)'}[best];
  $('#p5').innerHTML=`<div class="card"><h2>Phase 5 · Summary for ${crop.icon} ${crop.name} — ${p.name}</h2>
  <div class="info"><b>Exploration result:</b> for your priority <b>${prio.icon} ${prio.label}</b>, the model suggests <b>${recName}</b> ${best==='A'?'under the current settings — benefits of change do not clearly outweigh costs/risks':`(fit ${fmt(sc[best].total)}/100 vs. ${fmt(sc.A.total)} for A)`}. This is a starting point for a conversation with your farm advisor — not a prescription.</div>
  <div class="kpi"><div><b>${fmt(sc.A.total)}</b><span style="color:${SC.A}">A · Conventional fit</span></div><div><b>${fmt(sc.B.total)}</b><span style="color:${SC.B}">B · Cover crop fit</span></div><div><b>${fmt(sc.C.total)}</b><span style="color:${SC.C}">C · Diversified fit</span></div><div><b>${fmt(Math.max(pr.Bnet,pr.Cnet)*100)}%</b><span>Best strategy’s chance to out-earn A</span></div></div>
  <div class="answer"><h3>1 · Why shift away from the conventional baseline (Strategy A)?</h3>
   <ul><li><b>Bare soil.</b> Landsat/MODIS NDVI shows the field below 0.25 in ${bareList(c).join(', ')||'no month'} (${c.bare.A} months); GPM shows ${fmt(c.wetShare*100)}% of annual rain falls Nov–Mar, so ${fmt(c.bareRain.A*100)}% of rain lands on bare or thin cover. Modelled erosion ≈ ${a.A.eros.toFixed(1)} t/ac/yr${f.B.som?` vs ${a.B.eros.toFixed(1)} with cover`:''}. In dry summers bare ground reaches ≈ ${fmt(c.maxTmax+17)} °C (ECOSTRESS-type skin temperature) and becomes a dust source.</li>
   <li><b>Soil organic matter drifts down.</b> ${c.som0.toFixed(2)}% → ${f.A.som.toFixed(2)}% over ${Y} years, lowering the water-retention index to ${fmt(f.A.wri)} (B: ${fmt(f.B.wri)}).</li>
   <li><b>Groundwater.</b> GRACE-FO shows the region losing ≈ ${Math.abs(p.grace).toFixed(1)} cm/yr of stored water${p.gw>.6?`, and A depends on pumping for about ${fmt(p.gw*100)}% of irrigation (≈ ${a.A.pump.toFixed(2)} AF/ac/yr)`:'; here the pressure is more about surface-water allocation than wells'}. Under drought, A is short of water by ${fmt(a.A.short*100,1)}% on average, and pumping costs rise as water tables fall.</li>
   <li><b>Pests build.</b> Without rotation the pest/disease index climbs to ${fmt(f.A.pest)}; and nitrate leaching averages ≈ ${fmt(a.A.leach)} lb N/ac/yr.</li></ul></div>
  <div class="answer"><h3>2 · What evidence supports the recommended rotations?</h3>
   <ul><li><b>SMAP</b> root-zone anomalies ≈ ${p.smap.toFixed(1)} σ show winter recharge is often incomplete; practices that improve infiltration and water-holding (B, C) keep more of each storm on-site, and the spring dry-down it shows is the window to watch for cover-crop water use.</li>
   <li><b>ECOSTRESS</b> ET/ESI and LST show the hottest, driest, most water-stressed weeks and that bare soil is far hotter than a vegetated surface — supporting year-round cover and lower-water rotation crops (C).</li>
   <li><b>GPM</b> shows rain arrives in a few winter storms (~${p.xdays} extreme days/yr), exactly when the baseline is bare — the logic behind winter covers (B) that slow runoff and scavenge nitrate.</li>
   <li><b>Landsat/MODIS NDVI</b> confirms the bare-field window and, later, lets you verify cover establishment. <b>SRTM</b> + soil erodibility locate priority zones. <b>GRACE-FO</b> frames why reducing pumping matters.</li>
   <li><b>Nitrate note:</b> no satellite sees nitrate. SMAP and GPM indicate <i>when drainage conditions favor leaching</i>; reductions of ≈ ${fmt((1-a.B.leach/a.A.leach)*100)}% (B) and ${fmt((1-a.C.leach/a.A.leach)*100)}% (C) in this tool come from published cover-crop effects, not satellite measurement.</li>
   <li><b>Model result (${Y} yrs, ${S.drought}% drought, ${S.adopt}% adoption):</b> SOM ${sgn(f.B.som-f.A.som,2)} pts (B) / ${sgn(f.C.som-f.A.som,2)} (C); cumulative net ${usd(f.B.net-f.A.net)} / ${usd(f.C.net-f.A.net)} per acre vs. A; B wins on net returns in ${fmt(pr.Bnet*100)}% and C in ${fmt(pr.Cnet*100)}% of simulated weather histories.</li></ul></div>
  <div class="answer"><h3>3 · Primary risks, limitations and information gaps</h3>
   <ul><li><b>Weather unpredictability.</b> California alternates between drought and atmospheric-river floods; the simulation samples that range, but real years can be outside it. Check the P10–P90 bands, not just the median.</li>
   <li><b>Spring water use by cover crops.</b> In a dry winter a cover crop can use soil moisture the cash crop needs; termination timing and a rain-or-irrigate decision matter. The model penalizes B/C in dry years for this, with yield loss up to ${fmt(Math.max(...sim.M.B.short.hi.slice(1))*100)}% in bad years.</li>
   <li><b>Satellites ≠ your field.</b> SMAP (9 km), GPM (10 km) and GRACE (~300 km) describe regions; ECOSTRESS and Landsat (30–70 m) are cloud- and overpass-limited. Soil texture, SOM, salinity, drainage and compaction need on-farm tests.</li>
   <li><b>Model simplifications.</b> Coefficients are literature-style estimates, not calibrated to your farm; markets, prices, regulation (SGMA, nitrate rules) and pest dynamics are simplified. The regional climate profiles are representative demo values unless you load live NASA POWER data.</li>
   <li><b>Information gaps.</b> Your actual yields, well levels and water allocation, tile drainage, labor/equipment, buyers for new crops, and local cover-crop trial results.</li>
   <li><b>Human expertise is essential.</b> Review every result with your <b>UC Cooperative Extension farm advisor</b>, the local <b>NRCS office / Resource Conservation District</b> and, for water, your groundwater sustainability agency. Start on a small, well-monitored block (the priority zones) and ground-truth with soil tests, moisture probes and your own records before scaling.</li></ul></div>
  <div class="card" style="background:var(--soft)"><h3 style="margin-top:0">Suggested next steps</h3><ol class="small"><li>Walk the highest-priority zones from the map with your advisor.</li><li>Soil-test organic matter, nitrate and compaction in 2–3 spots.</li><li>Pick one 5–10 acre pilot block; seed the cover after harvest and track NDVI (Landsat/Sentinel) and soil moisture.</li><li>Check cost-share programs (CDFA Healthy Soils, NRCS EQIP/CSP).</li><li>Re-run this tool each year with your measured results.</li></ol>
   <button class="btn ghost sm noprint" onclick="window.print()">🖨️ Print / save as PDF</button> <button class="btn sm noprint" data-go="6">See requirement coverage →</button></div></div>`;
}

/* =============== PHASE 6: requirement coverage =============== */
function renderP6(){
  const R=[
   ['Combine NASA Earth observations','2:data','SMAP, ECOSTRESS, GPM, Landsat, MODIS, GRACE-FO, SRTM and NASA POWER (live API) harmonized onto one grid.'],
   ['Use local soil information','1:','Soil texture, organic matter %, K-factor and leaching class (NRCS-style) drive erosion, water holding, leaching and SOM trajectory; user can enter their own soil test.'],
   ['Consider crop characteristics','3:','Crop-trait table: root depth, N fixation, water use, drought/frost tolerance, heat limits, pests, revenue/cost.'],
   ['Incorporate farmer priorities','1:','Top-priority selection weights the strategy scoring (40% / 15%); plus water, equipment, irrigation and market constraints.'],
   ['Compare at least 3 rotation strategies','3:','Strategies A, B and C side by side, per crop and region.'],
   ['Include the existing rotation','3:','Strategy A = the farmer’s current baseline.'],
   ['Analyze temperature and heat stress','2:cal','Heat-stress row vs crop-specific thresholds, ECOSTRESS-style bare-soil LST, warming slider in the simulation.'],
   ['Analyze rainfall and extreme weather','2:cal','GPM/POWER monthly rain, extreme-rain days, drought severity and variability controls.'],
   ['Analyze soil moisture and evaporation','2:data','SMAP anomalies, ECOSTRESS ET/ESI, ET₀ water-deficit row, irrigation demand in the model.'],
   ['Identify bare-field periods','2:cal','NDVI < 0.25 months flagged for each strategy; bare-field-days map layer.'],
   ['Identify crop vulnerability','2:cal','Month-by-month heat, frost, water-deficit and bare-soil exposure rows with plain-language callouts.'],
   ['Explain why each rotation is recommended','3:','Each strategy card: why suggested, evidence chips, benefits, risks, gaps, local review.'],
   ['Explain benefits and risks','3:','Benefits and risks computed from simulation numbers, plus Phase 5 summary.'],
   ['Identify information gaps and uncertainty','4:','P10–P90 bands, probability of out-performing A, explicit gaps lists, Phase 5 risk section.'],
   ['Consider pest and disease cycles','3:','Crop-specific pest list and simulated pest-pressure index per strategy.'],
   ['Consider supplemental income and markets','3:','Rotation-crop revenue, grazing lease, N credit, incentives, market-access setting.'],
   ['Include geospatial mapping','2:map','California map + 7 switchable field-scale layers (priority zones, erosion, water stress, soil moisture, bare days, frost, GRACE) on a selectable grid.'],
   ['Allow interactive scenario exploration','4:','Drought, warming, adoption, water, price and timeline sliders; presets; ensemble vs single weather.'],
   ['Explain satellite vs. ground measurements','2:sat','Comparison table and interactive sensor-fusion demo.'],
   ['Explain SI / statistical modeling approach','2:si','Approaches compared, what is implemented, uncertainty handling and equations.'],
   ['Include local agricultural expertise','5:','UC Cooperative Extension, NRCS/RCD and GSA called out in each strategy and the summary.']];
  $('#p6').innerHTML=`<div class="card"><h2>NASA Challenge requirement coverage</h2><p class="mute">Every requirement from the challenge brief and where to see it in the tool.</p>
  <div class="tw"><table><tr><th>Requirement</th><th>Status</th><th>How the tool addresses it</th><th></th></tr>${R.map(([r,w,h])=>`<tr><td>${r}</td><td><span class="chip s">✔ Covered</span></td><td class="small">${h}</td><td>${w.endsWith(':')&&w.startsWith('1')?`<button class="btn ghost sm" data-go="1">Open</button>`:`<button class="btn ghost sm" data-jump="${w.split(':')[0]}:${w.split(':')[1]||''}">Open</button>`}</td></tr>`).join('')}</table></div>
  <div class="note">Honest status: climate profiles and model coefficients are representative demo values; NASA POWER can be loaded live. Next steps are wiring the Earthdata rasters into the map layers and calibrating the model with local trial data.</div></div>`;
}

/* =============== init =============== */
window.addEventListener('DOMContentLoaded',()=>{initIntake();renderIntake();buildNav()});
