/* Beat analysis: decodes a song, then finds its tempo, every beat, the downbeats, kick hits and hi-hat hits.
   Method: band energies at 100 frames/s -> onset strength -> autocorrelation tempo -> dynamic-programming beat tracking. */
const Analysis=(()=>{
const FPS=100;
const pause=()=>new Promise(r=>setTimeout(r,0));

async function decode(blob){
  const buf=await blob.arrayBuffer();
  const C=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  const ctx=new C(1,2,44100);
  return await new Promise((res,rej)=>{const p=ctx.decodeAudioData(buf,res,rej);if(p&&p.then)p.then(res,rej)});
}
function sd(a){let s=0,q=0;for(let i=0;i<a.length;i++){s+=a[i];q+=a[i]*a[i]}const m=s/a.length;return Math.sqrt(Math.max(0,q/a.length-m*m))||1}
/* positive difference of log energy, minus a local mean, scaled to unit deviation */
function onset(e,win){
  const n=e.length,raw=new Float32Array(n);
  for(let i=1;i<n;i++)raw[i]=Math.max(0,e[i]-e[i-1]);
  const ps=new Float64Array(n+1);for(let i=0;i<n;i++)ps[i+1]=ps[i]+raw[i];
  const o=new Float32Array(n),h=win>>1;
  for(let i=0;i<n;i++){const a=Math.max(0,i-h),b=Math.min(n,i+h+1);o[i]=Math.max(0,raw[i]-(ps[b]-ps[a])/(b-a))}
  const s=sd(o);for(let i=0;i<n;i++)o[i]/=s;
  return o;
}
function peaks(o,thr,gap){const out=[];let last=-1e9;
  for(let i=1;i<o.length-1;i++)if(o[i]>thr&&o[i]>=o[i-1]&&o[i]>o[i+1]&&i-last>=gap){out.push(i/FPS);last=i}
  return out}
/* tempo period in frames, with a gentle preference for tempos near 120 BPM */
function tempo(o){
  const n=o.length,minL=Math.floor(FPS*60/200),maxL=Math.ceil(FPS*60/60),ac=new Float32Array(maxL+2);
  for(let L=minL-1;L<=maxL+1;L++){let s=0;for(let i=L;i<n;i++)s+=o[i]*o[i-L];ac[L]=s/(n-L)}
  let best=minL,bv=-1;
  for(let L=minL;L<=maxL;L++){const bpm=60*FPS/L,w=Math.exp(-.5*Math.pow(Math.log2(bpm/120)/.9,2)),v=ac[L]*w;if(v>bv){bv=v;best=L}}
  const a=ac[best-1],b=ac[best],c=ac[best+1],d=a-2*b+c,off=d?.5*(a-c)/d:0;
  return best+Math.max(-.5,Math.min(.5,off));
}
function track(o,P,tight){
  const n=o.length,score=new Float32Array(n),back=new Int32Array(n).fill(-1),lo=Math.max(1,Math.round(P/2)),hi=Math.round(P*2);
  for(let i=0;i<n;i++){let best=0,bj=-1;
    for(let j=Math.max(0,i-hi);j<=i-lo;j++){const r=Math.log((i-j)/P),v=score[j]-tight*r*r;if(v>best){best=v;bj=j}}
    score[i]=o[i]+best;back[i]=bj}
  let end=n-1,bv=-1;for(let i=Math.max(0,n-Math.round(P*1.5));i<n;i++)if(score[i]>bv){bv=score[i];end=i}
  const beats=[];for(let i=end;i>=0;i=back[i])beats.push(i/FPS);
  beats.reverse();
  const p=P/FPS;                                   // cover intros and outros at the same tempo
  while(beats.length&&beats[0]-p>0)beats.unshift(beats[0]-p);
  const dur=n/FPS;while(beats.length&&beats[beats.length-1]+p<dur)beats.push(beats[beats.length-1]+p);
  return beats;
}
async function analyze(blob,onProgress){
  const ab=await decode(blob);
  const sr=ab.sampleRate,n=ab.length,d0=ab.getChannelData(0),d1=ab.numberOfChannels>1?ab.getChannelData(1):d0;
  const hop=Math.round(sr/FPS),F=Math.floor(n/hop);
  const eL=new Float32Array(F),eH=new Float32Array(F),eA=new Float32Array(F),rms=new Float32Array(F);
  const aL=Math.exp(-2*Math.PI*150/sr),aH=Math.exp(-2*Math.PI*5000/sr);
  let lp=0,lh=0,i=0;
  for(let f=0;f<F;f++){
    let sL=0,sH=0,sA=0;
    for(let k=0;k<hop;k++,i++){const x=(d0[i]+d1[i])*.5;lp=aL*lp+(1-aL)*x;lh=aH*lh+(1-aH)*x;const h=x-lh;sL+=lp*lp;sH+=h*h;sA+=x*x}
    eL[f]=Math.log(1e-10+sL/hop);eH[f]=Math.log(1e-10+sH/hop);eA[f]=Math.log(1e-10+sA/hop);rms[f]=Math.sqrt(sA/hop);
    if(f%4000===3999){onProgress&&onProgress(f/F*.8);await pause()}
  }
  const W=Math.round(FPS*.5),oL=onset(eL,W),oH=onset(eH,W),oA=onset(eA,W),oT=new Float32Array(F);
  for(let f=0;f<F;f++)oT[f]=oL[f]+.6*oA[f]+.3*oH[f];
  await pause(); onProgress&&onProgress(.85);
  const P=tempo(oT), beats=track(oT,P,60);
  onProgress&&onProgress(.95);
  let bar0=0,bs=-1;                                 // downbeat phase: beat slot with the strongest bass hits
  for(let k=0;k<4;k++){let s=0;for(let b=k;b<beats.length;b+=4)s+=oL[Math.min(F-1,Math.round(beats[b]*FPS))];if(s>bs){bs=s;bar0=k}}
  const step=FPS/10,en=[];let mx=1e-6;             // loudness curve at 10 values per second, 0..1
  for(let f=0;f<F;f+=step){let s=0,c=0;for(let k=Math.max(0,f-25);k<Math.min(F,f+25);k++){s+=rms[k];c++}en.push(s/c)}
  const sorted=[...en].sort((a,b)=>a-b);mx=sorted[Math.floor(sorted.length*.95)]||1e-6;
  return{v:1,bpm:Math.round(60*FPS/P*10)/10,beats,bar0,
    kicks:peaks(oL,2,Math.round(FPS*.12)),highs:peaks(oH,2.2,Math.round(FPS*.07)),
    energy:en.map(v=>Math.min(1,v/mx)),duration:n/sr};
}
return{analyze,FPS};
})();
