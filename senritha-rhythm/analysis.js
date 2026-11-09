/* Beat analysis engine v2.
   1. Mix to mono and resample to 22 050 Hz.
   2. Short-time FFT (1024 window, 128 hop = 5.8 ms) -> log-compressed spectral flux in four bands.
   3. Tempo: harmonic-enhanced autocorrelation with a tempo prior, then a local tempo curve (8 s windows)
      so songs that speed up or slow down stay locked.
   4. Beats: dynamic-programming beat tracking on the local tempo, then each beat is pulled onto the
      nearest real onset with sub-frame (parabolic) precision.
   5. Downbeats, kicks and hi-hats from band onsets with adaptive thresholds.
   The heavy work runs in a Web Worker so the visuals stay smooth while a song is analysed. */
const Analysis=(()=>{

function core(){
  const SR=22050,HOP=128,N=1024,FPS=SR/HOP,H2=N/2;
  const DELAY=800;            // samples from frame start to the onset it reports (measured with test/accuracy.js)
  const bitrev=new Uint16Array(N),cs=new Float32Array(H2),sn=new Float32Array(H2),win=new Float32Array(N);
  for(let i=0;i<N;i++){let r=0,x=i;for(let b=1;b<N;b<<=1){r=(r<<1)|(x&1);x>>=1}bitrev[i]=r;win[i]=.5-.5*Math.cos(2*Math.PI*i/N)}
  for(let i=0;i<H2;i++){cs[i]=Math.cos(2*Math.PI*i/N);sn[i]=-Math.sin(2*Math.PI*i/N)}
  function fft(re,im){
    for(let i=0;i<N;i++){const j=bitrev[i];if(j>i){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
    for(let size=2;size<=N;size<<=1){const half=size>>1,step=N/size;
      for(let i=0;i<N;i+=size)for(let j=0,k=0;j<half;j++,k+=step){const a=i+j,b=a+half,tr=re[b]*cs[k]-im[b]*sn[k],ti=re[b]*sn[k]+im[b]*cs[k];
        re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti}}
  }
  /* mono mix + anti-aliased resample to 22 050 Hz */
  function prepare(chans,sr){
    const n=chans[0].length,mono=new Float32Array(n);
    for(const c of chans)for(let i=0;i<n;i++)mono[i]+=c[i]/chans.length;
    if(Math.abs(sr-SR)<1)return mono;
    const ratio=sr/SR,box=Math.max(1,Math.round(ratio)),m=Math.floor(n/ratio),out=new Float32Array(m);
    const ps=new Float64Array(n+1);for(let i=0;i<n;i++)ps[i+1]=ps[i]+mono[i];
    for(let j=0;j<m;j++){const c=j*ratio,a=Math.max(0,Math.floor(c-box/2)),b=Math.min(n,a+box);out[j]=(ps[b]-ps[a])/(b-a)}
    return out;
  }
  const fr2t=f=>(f*HOP+DELAY)/SR;
  function localStats(a,half){const n=a.length,s=new Float64Array(n+1),q=new Float64Array(n+1);
    for(let i=0;i<n;i++){s[i+1]=s[i]+a[i];q[i+1]=q[i]+a[i]*a[i]}
    return i=>{const lo=Math.max(0,i-half),hi=Math.min(n,i+half+1),c=hi-lo,m=(s[hi]-s[lo])/c;return[m,Math.sqrt(Math.max(0,(q[hi]-q[lo])/c-m*m))]}}
  function norm(a,winSec){const n=a.length,st=localStats(a,Math.round(winSec*FPS/2)),o=new Float32Array(n);let s=0,q=0;
    for(let i=0;i<n;i++){o[i]=Math.max(0,a[i]-st(i)[0]);s+=o[i];q+=o[i]*o[i]}
    const sd=Math.sqrt(Math.max(1e-12,q/n-(s/n)**2))||1;for(let i=0;i<n;i++)o[i]/=sd;return o}
  const parab=(a,i)=>{const l=a[i-1]||0,c=a[i],r=a[i+1]||0,d=l-2*c+r;return d<0?Math.max(-.5,Math.min(.5,.5*(l-r)/d)):0};

  function analyze(chans,sr,progress){
    const x=prepare(chans,sr),F=Math.max(2,Math.floor((x.length-N)/HOP)+1);
    const fL=new Float32Array(F),fM=new Float32Array(F),fH=new Float32Array(F),fA=new Float32Array(F),rms=new Float32Array(F);
    const re=new Float32Array(N),im=new Float32Array(N);let prev=new Float32Array(H2),cur=new Float32Array(H2);
    for(let f=0;f<F;f++){
      const off=f*HOP;let e=0;
      for(let i=0;i<N;i++){const v=x[off+i]||0;re[i]=v*win[i];im[i]=0;if(i>=H2-HOP/2&&i<H2+HOP/2)e+=v*v}
      rms[f]=Math.sqrt(e/HOP); fft(re,im);
      let a=0,l=0,m=0,h=0;
      for(let k=1;k<H2;k++){const mag=Math.log1p(100*Math.sqrt(re[k]*re[k]+im[k]*im[k]));cur[k]=mag;const d=mag-prev[k];
        if(d>0){a+=d;if(k<=7)l+=d;else if(k<=92)m+=d;else if(k>=232)h+=d}}
      if(f){fA[f]=a;fL[f]=l;fM[f]=m;fH[f]=h}
      const t=prev;prev=cur;cur=t;
      if(progress&&f%3000===0)progress(f/F*.7);
    }
    const oA=norm(fA,.3),oL=norm(fL,.3),oM=norm(fM,.3),oH=norm(fH,.3),oT=new Float32Array(F);
    for(let f=0;f<F;f++)oT[f]=oA[f]+.8*oL[f]+.4*oM[f];
    progress&&progress(.75);

    /* global tempo */
    const minL=Math.floor(FPS*60/200),maxL=Math.ceil(FPS*60/55),ac=new Float32Array(maxL*2+3);
    for(let L=Math.floor(minL/2);L<ac.length;L++){let s=0;for(let i=L;i<F;i++)s+=oT[i]*oT[i-L];ac[L]=s/(F-L)}
    const acAt=v=>{const i=Math.floor(v),f=v-i;return(ac[i]||0)*(1-f)+(ac[i+1]||0)*f};
    let best=minL,bv=-1;
    for(let L=minL;L<=maxL;L++){const bpm=60*FPS/L,prior=Math.exp(-.5*Math.pow(Math.log2(bpm/118)/.85,2)),
      v=(ac[L]+.5*acAt(L*2)+.5*acAt(L/2)+.25*acAt(L*3))*prior;if(v>bv){bv=v;best=L}}
    const P=best+parab(ac,best);
    progress&&progress(.8);

    /* local tempo curve: 8 s windows every 2 s, searched within +-10% of the global period */
    const Wn=Math.round(8*FPS),Hs=Math.round(2*FPS),centers=[],periods=[];
    for(let s0=0;s0+Wn<=F||!centers.length;s0+=Hs){const e0=Math.min(F,s0+Wn),lo=Math.floor(P*.9),hi=Math.ceil(P*1.1),loc=new Float32Array(hi+2);let bl=-1,bvv=0;
      for(let L=lo-1;L<=hi+1;L++){let s=0;for(let i=s0+L;i<e0;i++)s+=oT[i]*oT[i-L];loc[L]=s/Math.max(1,e0-s0-L)}
      for(let L=lo;L<=hi;L++)if(loc[L]>bvv){bvv=loc[L];bl=L}
      centers.push((s0+e0)/2);periods.push(bl>0&&bl>lo&&bl<hi?bl+parab(loc,bl):P);if(e0>=F)break}
    const sm=periods.map((_,i)=>{const w=periods.slice(Math.max(0,i-2),i+3).sort((a,b)=>a-b);return w[w.length>>1]});
    const Ploc=new Float32Array(F);
    for(let f=0,j=0;f<F;f++){while(j<centers.length-1&&centers[j+1]<f)j++;
      if(f<=centers[0])Ploc[f]=sm[0];else if(j>=centers.length-1)Ploc[f]=sm[sm.length-1];
      else{const u=(f-centers[j])/(centers[j+1]-centers[j]);Ploc[f]=sm[j]*(1-u)+sm[j+1]*u}}
    progress&&progress(.85);

    /* dynamic-programming beat tracking */
    const score=new Float32Array(F),back=new Int32Array(F).fill(-1),TIGHT=100;
    for(let i=0;i<F;i++){const p=Ploc[i],lo=Math.max(0,i-Math.round(2*p)),hi=i-Math.max(1,Math.round(p/2));let bs=0,bj=-1;
      for(let j=lo;j<=hi;j++){const r=Math.log((i-j)/p),v=score[j]-TIGHT*r*r;if(v>bs){bs=v;bj=j}}
      score[i]=oT[i]+bs;back[i]=bj}
    let end=F-1,ev=-1;for(let i=Math.max(0,F-Math.round(Ploc[F-1]*1.5));i<F;i++)if(score[i]>ev){ev=score[i];end=i}
    let bf=[];for(let i=end;i>=0;i=back[i])bf.push(i);bf.reverse();
    while(bf.length&&bf[0]-Ploc[0]>=0)bf.unshift(bf[0]-Ploc[0]);
    while(bf.length&&bf[bf.length-1]+Ploc[F-1]<F)bf.push(bf[bf.length-1]+Ploc[F-1]);
    /* pull each beat onto the strongest nearby onset, with sub-frame precision */
    const R=Math.round(.035*FPS);
    bf=bf.map(b=>{const c=Math.round(b);let pi=-1,pv=0;for(let i=Math.max(1,c-R);i<=Math.min(F-2,c+R);i++)if(oT[i]>pv&&oT[i]>=oT[i-1]&&oT[i]>=oT[i+1]){pv=oT[i];pi=i}
      if(pi<0||pv<.6)return b;const peak=pi+parab(oT,pi),w=Math.min(1,pv/2);return b+(peak-b)*w*.85});
    const beats=bf.map(fr2t).filter(t=>t>=0);
    progress&&progress(.92);

    /* downbeat phase: strongest bass plus chord changes */
    let bar0=0,bb=-1;
    for(let k=0;k<4;k++){let s=0;for(let i=k;i<bf.length;i+=4){const f=Math.max(0,Math.min(F-1,Math.round(bf[i])));s+=oL[f]+.5*oM[f]}if(s>bb){bb=s;bar0=k}}

    function peaks(o,gap,k,floor){const st=localStats(o,Math.round(.5*FPS)),out=[],g=Math.round(gap*FPS);let last=-1e9;
      for(let i=1;i<F-1;i++){if(o[i]<floor||o[i]<o[i-1]||o[i]<o[i+1]||i-last<g)continue;const[m,s]=st(i);if(o[i]>m+k*s){out.push(fr2t(i+parab(o,i)));last=i}}return out}
    const kicks=peaks(oL,.1,1.3,1),highs=peaks(oH,.06,1.5,1.2);

    const step=FPS/10,en=[];for(let f=0;f<F;f+=step){const a=Math.max(0,Math.floor(f-FPS*.25)),b=Math.min(F,Math.floor(f+FPS*.25));let s=0;for(let i=a;i<b;i++)s+=rms[i];en.push(s/Math.max(1,b-a))}
    const srt=[...en].sort((a,b)=>a-b),mx=srt[Math.floor(srt.length*.95)]||1e-6;
    const iv=[];for(let i=1;i<beats.length;i++)iv.push(beats[i]-beats[i-1]);iv.sort((a,b)=>a-b);
    const bpm=iv.length?60/iv[iv.length>>1]:60*FPS/P;
    progress&&progress(1);
    return{v:2,bpm:Math.round(bpm*10)/10,beats,bar0,kicks,highs,energy:en.map(v=>Math.min(1,v/mx)),duration:x.length/SR,
      tempoVaries:Math.max(...sm)/Math.min(...sm)>1.03};
  }
  return{analyze,SR,FPS};
}

const C=core();
async function decode(blob){
  const buf=await blob.arrayBuffer(),A=window.OfflineAudioContext||window.webkitOfflineAudioContext,ctx=new A(1,2,44100);
  return await new Promise((res,rej)=>{const p=ctx.decodeAudioData(buf,res,rej);if(p&&p.then)p.then(res,rej)});
}
let worker=null,workerFailed=false,jobs=0;const pending={};
function getWorker(){
  if(worker||workerFailed)return worker;
  try{const src=`const C=(${core.toString()})();onmessage=e=>{const{id,chans,sr}=e.data;try{const r=C.analyze(chans,sr,p=>postMessage({id,p}));postMessage({id,r})}catch(err){postMessage({id,err:String(err)})}}`;
    worker=new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));
    worker.onmessage=e=>{const j=pending[e.data.id];if(!j)return;if(e.data.p!=null)j.progress&&j.progress(e.data.p);else{delete pending[e.data.id];e.data.err?j.rej(new Error(e.data.err)):j.res(e.data.r)}};
    worker.onerror=()=>{workerFailed=true;worker=null;for(const k in pending){pending[k].fallback();delete pending[k]}};
  }catch(e){workerFailed=true;worker=null}
  return worker;
}
async function analyze(blob,progress){
  const ab=await decode(blob),chans=[];for(let c=0;c<Math.min(2,ab.numberOfChannels);c++)chans.push(new Float32Array(ab.getChannelData(c)));
  const local=()=>C.analyze(chans,ab.sampleRate,progress), again=()=>analyze(blob,progress);
  const w=getWorker(); if(!w)return local();
  return new Promise((res,rej)=>{const id=++jobs;pending[id]={res,rej,progress,fallback:()=>again().then(res,rej)};
    try{w.postMessage({id,chans,sr:ab.sampleRate},chans.map(c=>c.buffer))}catch(e){delete pending[id];res(local())}});
}
return{analyze,core,VERSION:2};
})();
if(typeof module!=='undefined')module.exports=Analysis;
