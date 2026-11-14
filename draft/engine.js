'use strict';
/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const sum=a=>a.reduce((x,y)=>x+y,0);
const mean=a=>a.length?sum(a)/a.length:0;
const fmt=(x,d=0)=>Number(x).toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d});
const usd=x=>(x<0?'−$':'$')+fmt(Math.abs(x));
const sgn=(x,d=0)=>(x>0.0001?'+':x<-0.0001?'−':'')+fmt(Math.abs(x),d);
const SC={A:'#b5651d',B:'#1b7f8c',C:'#6b4fbb'};
const SN={A:'A · Conventional',B:'B · Winter cover crop',C:'C · Diversified rotation'};
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function randn(r){let u=0;while(!u)u=r();const v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}

/* ---------- state ---------- */
const S={region:null,lat:null,lon:null,crop:null,priority:null,years:15,soil:'',som:'',water:90,irrig:'drip',equip:'own',market:'moderate',
 launched:false,incent:0,drought:30,warm:1.5,adopt:70,price:0,mode:'ensemble',seed:1,res:250,layer:'prio',phase:1,tab:'data',power:null,sim:null,sat:2};

function curLL(){if(S.region==='custom')return{lat:S.lat,lon:S.lon};const r=REGIONS[S.region];return r?{lat:r.lat,lon:r.lon}:{lat:null,lon:null}}
function powerKey(){const{lat,lon}=curLL();return lat==null?'':lat.toFixed(2)+','+lon.toFixed(2)}

function baseProfile(){
  if(!S.region)return null;let p;
  if(S.region==='custom'){
    if(S.lat==null||S.lon==null||isNaN(S.lat)||isNaN(S.lon))return null;
    let best=null,bd=1e9;for(const k of Object.keys(REGIONS)){const r=REGIONS[k];const d=Math.hypot(r.lat-S.lat,(r.lon-S.lon)*.8);if(d<bd){bd=d;best=k}}
    p={...REGIONS[best],key:'custom',near:best,name:`Custom point (${S.lat.toFixed(2)}, ${S.lon.toFixed(2)})`,short:'Custom point',lat:S.lat,lon:S.lon,distKm:bd*111};
  }else p={...REGIONS[S.region],key:S.region,near:S.region};
  if(S.power&&S.power.key===powerKey()){Object.assign(p,{precip:S.power.precip,tmax:S.power.tmax,tmin:S.power.tmin,tminX:S.power.tminX,live:true});}
  return p;
}

/* Everything the model and the pages need, derived from the user's choices */
function ctx(){
  const p=baseProfile();if(!p||!S.crop)return null;
  const crop=CROPS[S.crop],soilKey=S.soil||p.soil,soil=SOILS[soilKey],som0=S.som!==''&&!isNaN(+S.som)?clamp(+S.som,.3,5):p.som;
  const et=sum(p.et0),pr=sum(p.precip);
  const wscale=Math.pow(et/1335,crop.wexp);
  const nd={A:crop.ndvi,B:crop.ndvi.map((v,i)=>Math.max(v,COVERNDVI[i])),C:crop.ndvi.map((v,i)=>Math.max(v,.8*COVERNDVI[i]))};
  const bareMo={},bareRain={},bare={};
  for(const s of'ABC'){bareMo[s]=nd[s].map(v=>v<.25);bareRain[s]=pr>0?sum(p.precip.map((x,i)=>bareMo[s][i]?x:0))/pr:0;bare[s]=bareMo[s].filter(Boolean).length}
  const wetShare=pr>0?sum([10,11,0,1,2].map(i=>p.precip[i]))/pr:0;
  const irrF={furrow:1.15,sprinkler:1,drip:.8}[S.irrig]||1;
  const coverM=S.equip==='own'?.85:1.15;
  const altM={strong:1,moderate:.92,limited:.75}[S.market]||.92;
  let seed=0;for(const ch of p.key+(p.lat||''))seed=(seed*31+ch.charCodeAt(0))%9973;
  return{p,crop,soil,soilKey,som0,et,pr,wscale,waterStatic:crop.water*wscale,nd,bareMo,bareRain,bare,wetShare,
    gwp:clamp(-p.grace/2,0,1.5),irrF,coverM,altM,seed,minTmin:Math.min(...(p.tminX||p.tmin)),maxTmax:Math.max(...p.tmax),
    atypical:S.region!=='custom'?!(REGIONS[S.region].typical.includes(S.crop)):!(REGIONS[p.near].typical.includes(S.crop))};
}

/* ---------- simulation: annual time-step process model + Monte-Carlo weather ---------- */
const NPRICE=.85;
const MET=['shi','wri','som','net','pump','applied','leach','eros','pest','nsave','short','yld'];
function simulate(c,o){
  const{p,crop,soil,som0}=c;const Y=o.years,R=o.runs,ad=o.adopt/100,d=o.drought/100,pm=1+o.price/100;
  const acc={};for(const s of'ABC'){acc[s]={};for(const m of MET)acc[s][m]=Array.from({length:Y+1},()=>new Float64Array(R))}
  const G={A:-.12,B:.38*crop.coverEff,C:.30*crop.cEff},TS={A:38,B:62,C:58},TB={A:35,B:62,C:72};
  const kS={A:0,B:crop.pestB,C:crop.alt.pestK};
  const erosK=2.4*(soil.K/.3)*(1+p.slope/3);
  const shiF=(som,st,bio,E)=>.3*clamp(som/3*100,0,100)+.25*st+.2*bio+.25*(100-clamp(E/6*100,0,100));
  const shi0=shiF(som0,38,35,erosK*(.15+c.bareRain.A)*(1.1-.004*38));
  let weather=[],heat=[];
  for(let r=0;r<R;r++){
    const rng=mulberry(o.seed*100003+r*7919+11);
    const W=[0],HT=[0];let z=randn(rng);const sig=.40+.15*d,rho=.35;
    for(let t=1;t<=Y;t++){z=rho*z+Math.sqrt(1-rho*rho)*randn(rng);W.push(clamp((1-.42*d)*Math.exp(sig*z-sig*sig/2),.15,2.2));HT.push(Math.max(-.4,o.warm*(.35+.65*t/Y)-.3*z))}
    if(r===0){weather=W;heat=HT}
    for(const s of'ABC'){
      const as=s==='A'?0:ad;let som=som0,st=38,bio=35,cum=0;
      acc[s].shi[0][r]=shi0;acc[s].wri[0][r]=soil.base;acc[s].som[0][r]=som0;acc[s].net[0][r]=0;
      for(const m of['pump','applied','leach','eros','pest','nsave','short','yld'])acc[s][m][0][r]=NaN;
      for(let t=1;t<=Y;t++){
        const w=W[t],wm=HT[t];
        let g=G.A*(1-as)+G[s]*as;if(g>0)g*=.55+.45*Math.min(w,1.3)/1.3;g-=.04*Math.max(0,wm);
        som+=.07*(som0*(1+g*soil.cap)-som);
        st+=.18*((TS.A*(1-as)+TS[s]*as)-st);bio+=.15*((TB.A*(1-as)+TB[s]*as)-bio);
        const wri=soil.base+.35*(st-38)+12*(som-som0)+.1*(bio-35);
        const bareR=c.bareRain.A*(1-as)+c.bareRain[s]*as;
        const E=Math.max(.05,erosK*(.15+bareR)*Math.pow(w,1.2)*(1.1-.004*st));
        const shi=shiF(som,st,bio,E);
        const sh=s==='C'?crop.alt.share*as:0;
        const pest=40+25*(1-Math.exp(-t/8))*(1-kS[s]*as)-5*kS[s]*as*(1-Math.exp(-t/6));
        let base=c.waterStatic;if(s==='C')base=base*(1-sh)+crop.alt.water*c.wscale*sh+crop.alt.addW*as;
        const coverPen=(s==='B'?1:s==='C'?.5:0)*crop.cover.water*as*Math.max(0,1.1-w)*.9;
        const need=base*(1+.04*wm+.10*Math.max(0,1-w))*(1-.004*c.irrF*(wri-soil.base))+coverPen;
        const cap=o.W/100*c.waterStatic*1.2*(.8+.2*Math.min(w,1));
        const applied=Math.min(need,cap),short=Math.max(0,need-cap)/need;
        const cut=clamp(.65*(1-w),0,.8),pshare=Math.min(1,p.gw+(1-p.gw)*cut);
        const rech=s==='A'?0:.20*as*Math.max(0,w-.8)*Math.max(0,st-38)/24;
        const pump=Math.max(0,applied*pshare-rech);
        const heatPen=.018*Math.max(0,wm)*crop.heat*(1-.003*(wri-soil.base));
        const ym=clamp(1-crop.ky*short-heatPen-.0015*(pest-40)+.0012*(shi-shi0)-(s==='A'?0:.025*as*Math.exp(-(t-1)/2.5)),.4,1.15);
        const rev=(crop.rev*(1-sh)+(s==='C'?crop.alt.rev*c.altM*sh:0))*ym*pm+(s==='C'?crop.alt.addRev*c.altM*as:0);
        const nsaveLb=s==='B'?crop.cover.nCredit*as*.6*(w>=.4?1:.6):s==='C'?crop.cover.nCredit*as*.3:0;
        const costBase=crop.cost*(1-sh)+(s==='C'?crop.alt.cost*sh+crop.alt.addCost*as:0);
        const coverCost=(s==='B'?1:s==='C'?.5:0)*crop.cover.cost*c.coverM*as-(s==='A'?0:(o.incent||0)*as);
        const pumpCost=180*(1+.012*t*c.gwp);
        const net=rev-costBase-crop.nRate*(1-sh)*NPRICE+nsaveLb*NPRICE-coverCost-clamp(3.2*(pest-40),-40,200)-pump*pumpCost-(applied-pump)*70;
        cum+=net/Math.pow(1.03,t);
        const lbase=crop.nLeach*soil.leach*(.55+.6*w);
        const red=s==='B'?.45*as*(w>=.4?1:.7):s==='C'?.3*as:0;
        const a=acc[s];
        a.shi[t][r]=shi;a.wri[t][r]=wri;a.som[t][r]=som;a.net[t][r]=cum;a.pump[t][r]=pump;a.applied[t][r]=applied;
        a.leach[t][r]=lbase*(1-red);a.eros[t][r]=E;a.pest[t][r]=pest;a.nsave[t][r]=nsaveLb*NPRICE;a.short[t][r]=short;a.yld[t][r]=ym;
      }
    }
  }
  const q=(arr,pp)=>{const a=Array.from(arr).filter(x=>!isNaN(x)).sort((x,y)=>x-y);return a.length?a[Math.min(a.length-1,Math.max(0,Math.round(pp*(a.length-1))))]:NaN};
  const M={},M1={};
  for(const s of'ABC'){M[s]={};M1[s]={};for(const m of MET){
    M[s][m]={med:acc[s][m].map(a=>q(a,.5)),lo:acc[s][m].map(a=>q(a,.1)),hi:acc[s][m].map(a=>q(a,.9))};
    const one=acc[s][m].map(a=>a[0]);M1[s][m]={med:one,lo:one,hi:one};}}
  // final / averaged medians
  const fin={},avg={};
  for(const s of'ABC'){fin[s]={};avg[s]={};for(const m of MET){fin[s][m]=M[s][m].med[Y];avg[s][m]=mean(M[s][m].med.slice(1).filter(x=>!isNaN(x)))}}
  // probabilities across the weather ensemble
  const cnt={Bnet:0,Cnet:0,Bshi:0,Cshi:0,Bpump:0,Cpump:0,Bshort:0};
  for(let r=0;r<R;r++){
    const mp=s=>{let x=0;for(let t=1;t<=Y;t++)x+=acc[s].pump[t][r];return x/Y};
    if(acc.B.net[Y][r]>acc.A.net[Y][r])cnt.Bnet++;if(acc.C.net[Y][r]>acc.A.net[Y][r])cnt.Cnet++;
    if(acc.B.shi[Y][r]>acc.A.shi[Y][r])cnt.Bshi++;if(acc.C.shi[Y][r]>acc.A.shi[Y][r])cnt.Cshi++;
    const pa=mp('A');if(mp('B')<pa)cnt.Bpump++;if(mp('C')<pa)cnt.Cpump++;
  }
  const prob={};for(const k in cnt)prob[k]=cnt[k]/R;
  const be={};for(const s of'BC'){be[s]=null;for(let t=1;t<=Y;t++){if(M[s].net.med[t]>=M.A.net.med[t]){be[s]=t;break}}}
  // worst-year comparison (drought year with most shortfall in run 0)
  return{Y,M,M1,fin,avg,prob,be,weather,heat,opts:{...o}};
}

function scoreAll(sim,c){
  const f=sim.fin,a=sim.avg,pr=PRIORITIES[S.priority]||PRIORITIES.water;
  const W={water:.15,som:.15,n:.15,pest:.15,income:.15};if(pr)W[pr.crit]=.4;
  const sc={};
  for(const s of'ABC'){
    const x={};
    const dp=(a.A.pump-a[s].pump)/Math.max(a.A.pump,.1),da=(a.A.applied-a[s].applied)/Math.max(a.A.applied,.1);
    x.water=50+50*clamp((.5*dp+.5*da)/.15,-1,1);
    x.som=50+50*clamp((f[s].som-f.A.som)/c.som0/.35,-1,1);
    const dl=(a.A.leach-a[s].leach)/Math.max(a.A.leach,1),dn=a[s].nsave/(c.crop.nRate*NPRICE+1);
    x.n=50+50*clamp((.7*dl+.3*dn)/.4,-1,1);
    x.pest=50+50*clamp((f.A.pest-f[s].pest)/40/.35,-1,1);
    x.income=50+50*clamp((f[s].net-f.A.net)/(.1*Math.abs(f.A.net)+1000),-1,1);
    x.total=sum(Object.keys(W).map(k=>W[k]*x[k]));
    sc[s]=x;
  }
  sc.weights=W;
  let best='A';for(const s of'BC')if(sc[s].total>sc[best].total+.5)best=s;
  sc.best=best;return sc;
}

let _rc=null;
function recompute(){
  const c=ctx();if(!c){S.sim=null;return null}
  const sim=simulate(c,{years:S.years,drought:S.drought,warm:S.warm,adopt:S.adopt,price:S.price,W:S.water,incent:S.incent,runs:200,seed:S.seed});
  sim.scores=scoreAll(sim,c);S.sim=sim;return sim;
}
