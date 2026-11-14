'use strict';
/* Simple farm-first front end. Uses data.js + engine.js only. */
Object.assign(S,{region:'central',crop:'tomato',priority:'water',launched:true,adopt:80,drought:25,warm:1,years:15});
const V={t:15,season:'winter',sel:'B',timer:null};
const NAMES={A:'Keep farming as usual',B:'Add a winter cover crop',C:'Mix up the crops'};
const CATS=[['water','💧','Water'],['soil','🌱','Soil'],['n','🧪','Fertilizer'],['pest','🐛','Pests'],['income','💰','Income']];
const WX={normal:['☀️ Normal',{drought:25,warm:1}],dry:['🏜️ Dry years',{drought:70,warm:2}],hot:['🔥 Hot & dry',{drought:55,warm:3.5}],wet:['🌧️ Wet',{drought:0,warm:.5}]};
const WEIGHT_KEY={water:'water',som:'soil',nitrogen:'n',pest:'pest'};
const PRIO_LABEL={water:'Save water',som:'Build soil',nitrogen:'Cut fertilizer',pest:'Fewer pests'};
const wk=k=>k==='soil'?'som':k;
const col=v=>v<40?'#c0392b':v<65?'#d9822b':'#2d6a4f';

/* absolute 0-100 scores for strategy s at year t */
function scoresAt(sim,c,s,t){
  const M=sim.M[s],tt=Math.max(1,t),cr=c.crop;
  const avg=m=>mean(M[m].med.slice(1,tt+1).filter(x=>!isNaN(x)));
  const wri=M.wri.med[t],shi=M.shi.med[t],pest=t===0?40:M.pest.med[t];
  const short=avg('short'),leach=avg('leach'),nsave=avg('nsave');
  const ref=cr.nLeach*c.soil.leach*1.15;
  const annual=t===0?0:M.net.med[t]/t*Math.pow(1.03,t/2);
  const x={};
  x.water=clamp(.5*wri+.5*(100-400*short),0,100);
  x.soil=clamp(shi,0,100);
  x.n=clamp(100*(1-leach/(2*ref))+Math.min(15,nsave/(cr.nRate*NPRICE+1)*60),0,100);
  x.pest=clamp(100-(pest-20)*1.6,0,100);
  x.income=clamp(50+annual/(.2*cr.rev)*50,0,100);
  const W=sim.scores.weights;
  x.total=sum(CATS.map(([k])=>x[k]*W[wk(k)]));
  return x;
}
const mix=(a,b,t)=>{const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const A=p(a),B=p(b);return'rgb('+A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(',')+')'};

function farmSVG(s,c,sim,t){
  const M=sim.M[s],tt=Math.max(1,t),cr=c.crop,winter=V.season==='winter';
  const perennial=cr.type.startsWith('Perennial')&&S.crop!=='alfalfa';
  const shi=M.shi.med[t],ym=t===0?.95:M.yld.med[t],eros=t===0?1.5:M.eros.med[tt];
  const as=s==='A'?0:S.adopt/100;
  const soil=mix('#d9b98a','#4a2f1b',clamp((shi-30)/50,0,1));
  let g='';
  // sky
  g+=`<rect width="240" height="84" fill="${winter?'#b4c3cf':'#bfe3f5'}"/>`;
  if(winter){g+=`<ellipse cx="60" cy="22" rx="38" ry="13" fill="#8fa0ad"/><ellipse cx="150" cy="30" rx="48" ry="14" fill="#8fa0ad"/>`;
    const n=Math.round(16*(1-S.drought/160));for(let i=0;i<n;i++){const x=(i*37)%230+5,y=36+(i*13)%34;g+=`<line x1="${x}" y1="${y}" x2="${x-3}" y2="${y+9}" stroke="#4d6a85" stroke-width="1.6"/>`}}
  else{const hot=S.warm>=2.5;g+=`<circle cx="205" cy="26" r="${hot?20:14}" fill="${hot?'#f08a24':'#ffd23f'}"/>`;if(hot)for(let i=0;i<4;i++)g+=`<path d="M${20+i*50} 70 q6 -6 12 0 t12 0" stroke="#e8743b" fill="none" opacity=".6"/>`}
  g+=`<path d="M0 84 Q60 66 120 80 T240 72 V90 H0Z" fill="${winter?'#6f8f6a':'#8cab5a'}"/>`;
  // field
  g+=`<polygon points="14,190 226,190 192,80 48,80" fill="${soil}"/>`;
  // ground cover
  const covered=(s==='B'&&winter)||(s==='C'&&winter);
  if(covered)g+=`<polygon points="14,190 226,190 192,80 48,80" fill="#58a14b" opacity="${s==='B'?.2+.45*as:.12+.3*as}"/>`;
  // rows
  const N=7;
  for(let i=0;i<N;i++){
    const xb=26+i*(188/(N-1)),xt=54+i*(136/(N-1)),mid=(xb+xt)/2;
    let green=null,w=8;
    if(perennial){
      for(let k=0;k<4;k++){const f=k/3,y=186-f*98,x=xb+(xt-xb)*f,r=7-f*3.5;
        g+=`<rect x="${x-1}" y="${y-r}" width="2" height="${r}" fill="#5a3d22"/>`;
        if(!winter)g+=`<circle cx="${x}" cy="${y-r-1}" r="${r}" fill="${mix('#a9a33a','#2f8f46',clamp((ym-.6)/.4,0,1))}"/>`}
      if(s==='B'&&winter){g+=`<line x1="${(xb*2+xt)/3}" y1="150" x2="${(xt*2+xb)/3}" y2="110" stroke="#58a14b" stroke-width="${6*as+1}" opacity=".6"/>`}
      continue}
    if(!winter){green=mix('#b3a13a','#2f8f46',clamp((ym-.6)/.4,0,1));if(s==='C'&&i%3===1&&S.adopt>0&&cr.alt.share)green=mix('#e0b740','#c79a1d',.5)}
    else if(S.crop==='alfalfa')green='#6fae5a';
    else if(s==='B'&&as>0)green='#5aa84a';
    else if(s==='C'&&as>0&&i%2===0)green='#5aa84a';
    if(green)g+=`<line x1="${xb}" y1="188" x2="${xt}" y2="82" stroke="${green}" stroke-width="${winter?5:8}" stroke-linecap="round" opacity=".92"/>`;
    else g+=`<line x1="${xb}" y1="188" x2="${xt}" y2="82" stroke="#00000018" stroke-width="2"/>`;
  }
  // dry cracks in summer
  const stress=M.short.med[tt];
  if(!winter&&(S.drought>=50||stress>.1)){for(let i=0;i<5;i++){const x=40+i*35;g+=`<path d="M${x} 178 l7 -10 l-4 -9 l8 -9" stroke="#2b1a0e" stroke-width="1.4" fill="none" opacity=".55"/>`}}
  // erosion runoff in winter
  if(winter){const n=Math.min(9,Math.round(eros*2.2));for(let i=0;i<n;i++){const x=24+i*22;g+=`<path d="M${x} 150 q4 14 -2 26 q-4 8 0 14" stroke="#7a4a1f" stroke-width="3" fill="none" opacity=".55"/>`}
    if(eros>2.5)g+=`<rect x="14" y="186" width="212" height="4" fill="#7a4a1f" opacity=".5"/>`}
  if(s==='C'&&cr.alt.addRev&&as>0)g+=`<text x="150" y="150" font-size="20">🐑</text>`;
  return`<svg viewBox="0 0 240 190" role="img" aria-label="${NAMES[s]}">${g}</svg>`;
}

function ring(v,color){const r=30,C=2*Math.PI*r;return`<svg width="76" height="76" viewBox="0 0 76 76"><circle cx="38" cy="38" r="${r}" fill="none" stroke="#eee" stroke-width="8"/><circle cx="38" cy="38" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C*v/100} ${C}" transform="rotate(-90 38 38)"/><text x="38" y="45" text-anchor="middle" font-size="22" font-weight="700" fill="${color}">${Math.round(v)}</text></svg>`}

function render(){
  const c=ctx(),sim=S.sim,Y=sim.Y;
  V.t=clamp(V.t,0,Y);$('#year').max=Y;$('#year').value=V.t;$('#yearO').textContent=V.t===0?'today':'year '+V.t;
  $('#yearsO').textContent=S.years+' yrs';$('#years').value=S.years;$('#adopt').value=S.adopt;$('#adoptO').textContent=S.adopt+'%';
  $$('#season button').forEach(b=>b.classList.toggle('on',b.dataset.v===V.season));
  $$('#wx button').forEach(b=>b.classList.toggle('on',WX[b.dataset.v][1].drought===S.drought&&WX[b.dataset.v][1].warm===S.warm));
  const sc={};for(const s of'ABC')sc[s]=scoresAt(sim,c,s,V.t);
  let best='A';for(const s of'BC')if(sc[s].total>sc[best].total+.5)best=s;
  $('#farms').innerHTML=['A','B','C'].map(s=>`<div class="farm ${V.sel===s?'sel':''}" data-s="${s}" style="--c:${SC[s]}">${best===s?'<div class="badge">⭐ Best for you</div>':''}
    <h3>${s==='A'?'1':s==='B'?'2':'3'}. ${NAMES[s]}</h3>${farmSVG(s,c,sim,V.t)}
    <div class="overall">${ring(sc[s].total,col(sc[s].total))}<div><b style="font-size:17px">Overall score</b><div class="big">out of 100 · weighted to “${PRIO_LABEL[S.priority]}”</div></div></div>
    <div class="cats">${CATS.map(([k,e,l])=>`<div class="c"><span>${e} ${l}${sim.scores.weights[wk(k)]>.3?' ★':''}</span><div class="bar"><i style="width:${sc[s][k]}%;background:${col(sc[s][k])}"></i></div><span class="n" style="color:${col(sc[s][k])}">${Math.round(sc[s][k])}</span></div>`).join('')}</div></div>`).join('');
  $$('.farm').forEach(f=>f.onclick=()=>{V.sel=f.dataset.s;render()});
  detail(c,sim,sc,best);
}
function detail(c,sim,sc,best){
  const s=V.sel,a=sc.A,x=sc[s];
  const caution={A:'Soil stays bare part of the year and slowly loses organic matter; pests build up with no rotation.',B:'Cover crops cost seed money and can use spring water in dry years — pick the planting and ending dates with your advisor.',C:'You need a buyer, equipment and sometimes insurance for the new crop or grazing lease.'}[s];
  let chips='';
  if(s!=='A')chips=CATS.map(([k,e,l])=>{const d=Math.round(x[k]-a[k]);return`<span>${e} ${l} <b class="${d>=0?'up':'dn'}">${d>=0?'+':''}${d}</b></span>`}).join('')+'<span class="tiny">vs. farming as usual</span>';
  const ks=CATS.slice().sort((p,q)=>x[q[0]]-x[p[0]]);
  const prob=s==='B'?sim.prob.Bnet:s==='C'?sim.prob.Cnet:null;
  $('#detail').innerHTML=`<div class="verdict">${best==='A'?'Right now <b>keeping things as they are</b> scores best for your goal.':`For <b>${PRIO_LABEL[S.priority].toLowerCase()}</b>, the best fit is <b>${NAMES[best]}</b> (${Math.round(sc[best].total)} vs ${Math.round(sc.A.total)}).`}</div>
   <h3 style="margin:12px 0 4px;color:${SC[s]}">You are looking at: ${NAMES[s]}</h3>
   <div>Strongest: <b>${ks[0][1]} ${ks[0][2]} (${Math.round(x[ks[0][0]])})</b> · Weakest: <b>${ks[4][1]} ${ks[4][2]} (${Math.round(x[ks[4][0]])})</b>${prob!=null?` · Earns more than farming as usual in <b>${Math.round(prob*100)}%</b> of simulated weather`:''}</div>
   <div class="chips" style="margin-top:6px">${chips}</div>
   <div class="tiny" style="margin-top:6px">⚠️ ${caution}</div>
   <details style="margin-top:8px"><summary>How are the scores made?</summary><p class="tiny">💧 Water = soil water-holding + how rarely the crop runs short. 🌱 Soil = organic matter, structure, life and erosion. 🧪 Fertilizer = less nitrate washing away and fertilizer saved by legumes. 🐛 Pests = disease and pest pressure (rotation lowers it). 💰 Income = average yearly profit per acre. The overall score gives your top goal 40% and each other category 15%. Try “Dry years” or “Hot &amp; dry” to see which farm holds up.</p></details>`;
}

/* controls */
function refresh(){recompute();render()}
function init(){
  $('#region').innerHTML=Object.keys(REGIONS).map(k=>`<option value="${k}">${REGIONS[k].icon} ${REGIONS[k].name}</option>`).join('');
  $('#crop').innerHTML=Object.keys(CROPS).map(k=>`<option value="${k}">${CROPS[k].icon} ${CROPS[k].name}</option>`).join('');
  $('#goal').innerHTML=Object.keys(PRIORITIES).map(k=>`<option value="${k}">${PRIORITIES[k].icon} ${PRIO_LABEL[k]}</option>`).join('');
  $('#wx').innerHTML=Object.keys(WX).map(k=>`<button data-v="${k}">${WX[k][0]}</button>`).join('');
  $('#region').value=S.region;$('#crop').value=S.crop;$('#goal').value=S.priority;
  $('#region').onchange=e=>{S.region=e.target.value;S.soil='';S.som='';refresh()};
  $('#crop').onchange=e=>{S.crop=e.target.value;refresh()};
  $('#goal').onchange=e=>{S.priority=e.target.value;refresh()};
  $('#wx').onclick=e=>{const b=e.target.closest('button');if(b){Object.assign(S,WX[b.dataset.v][1]);refresh()}};
  $('#season').onclick=e=>{const b=e.target.closest('button');if(b){V.season=b.dataset.v;render()}};
  $('#adopt').oninput=e=>{S.adopt=+e.target.value;refresh()};
  $('#years').oninput=e=>{S.years=+e.target.value;V.t=Math.min(V.t,S.years);refresh()};
  $('#year').oninput=e=>{V.t=+e.target.value;render()};
  $('#play').onclick=()=>{
    if(V.timer){clearInterval(V.timer);V.timer=null;$('#play').textContent='▶ Play';return}
    V.t=0;render();$('#play').textContent='⏸ Pause';
    V.timer=setInterval(()=>{if(V.t>=S.years){clearInterval(V.timer);V.timer=null;$('#play').textContent='▶ Play';return}V.t++;render()},550)};
  refresh();
}
document.addEventListener('DOMContentLoaded',init);
