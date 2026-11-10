/* Frame statistics from real frame timestamps.
   - Every measured frame time (ms) is stored (growable Float32Array) for the exact final report.
   - A rolling ring buffer (last 1200 frames) drives the live FPS / frame-time readouts and graphs.
   - A 0.05 ms histogram gives live percentile lows in O(bins) without sorting every second.
   Definitions (shown in the report):
     Average FPS  = frames / total measured time
     1% / 0.1% low = 1000 / mean of the slowest 1% / 0.1% of frame times
     Min / Max FPS = lowest / highest FPS over 1-second windows */
const Stats=(()=>{
const BIN=0.05,NBINS=4000; // 0..200 ms
class FrameStats{
  constructor(){this.reset()}
  reset(){
    this.all=new Float32Array(1<<14);this.n=0;this.sum=0;
    this.ring=new Float32Array(1200);this.ringT=new Float64Array(1200);this.ri=0;this.rn=0;
    this.hist=new Uint32Array(NBINS+1);this.histSum=new Float64Array(NBINS+1);
    this.sec=[];this.secStart=null;this.secFrames=0;this.secSum=0;this.secMax=0;this.secObjects=0;this.secCpu=0;this.secGpu=0;this.secGpuN=0;
    this.measured=0;
  }
  /* ms: time since previous rendered frame; t: measured time (s) at this frame; extra: per-frame info */
  push(ms,t,objects,cpuMs,gpuMs){
    if(!(ms>0)||!isFinite(ms))return;
    if(this.n===this.all.length){const a=new Float32Array(this.all.length*2);a.set(this.all);this.all=a}
    this.all[this.n++]=ms;this.sum+=ms;this.measured=t;
    this.ring[this.ri]=ms;this.ringT[this.ri]=t;this.ri=(this.ri+1)%this.ring.length;if(this.rn<this.ring.length)this.rn++;
    const b=Math.min(NBINS,Math.floor(ms/BIN));this.hist[b]++;this.histSum[b]+=ms;
    if(this.secStart===null)this.secStart=t-ms/1000;
    this.secFrames++;this.secSum+=ms;if(ms>this.secMax)this.secMax=ms;this.secObjects=objects;this.secCpu+=cpuMs||0;if(gpuMs!=null){this.secGpu+=gpuMs;this.secGpuN++}
    if(t-this.secStart>=1){
      this.sec.push({t:+t.toFixed(3),fps:this.secFrames/(this.secSum/1000),ftAvg:this.secSum/this.secFrames,ftMax:this.secMax,objects:this.secObjects,
        cpu:this.secCpu/this.secFrames,gpu:this.secGpuN?this.secGpu/this.secGpuN:null});
      this.secStart=t;this.secFrames=0;this.secSum=0;this.secMax=0;this.secCpu=0;this.secGpu=0;this.secGpuN=0}
  }
  /* FPS over the most recent `win` seconds of rendered frames */
  current(win=.5){let s=0,c=0;for(let k=0;k<this.rn;k++){const i=(this.ri-1-k+this.ring.length)%this.ring.length;s+=this.ring[i];c++;if(s>=win*1000)break}return c&&s?c/(s/1000):0}
  lastFrame(){return this.rn?this.ring[(this.ri-1+this.ring.length)%this.ring.length]:0}
  recent(count){const out=new Float32Array(Math.min(count,this.rn));for(let k=0;k<out.length;k++){out[out.length-1-k]=this.ring[(this.ri-1-k+this.ring.length*2)%this.ring.length]}return out}
  /* live percentile low from the histogram (slowest fraction q of frames) */
  lowLive(q){if(!this.n)return 0;let need=Math.max(1,Math.ceil(this.n*q)),cnt=0,sum=0;
    for(let b=NBINS;b>=0&&need>0;b--){const h=this.hist[b];if(!h)continue;const take=Math.min(h,need),avg=this.histSum[b]/h;cnt+=take;sum+=avg*take;need-=take}
    return cnt?1000/(sum/cnt):0}
  live(){const avg=this.n?this.n/(this.sum/1000):0,secs=this.sec.map(s=>s.fps);
    return{fps:this.current(),avg,min:secs.length?Math.min(...secs):0,max:secs.length?Math.max(...secs):0,low1:this.lowLive(.01),low01:this.lowLive(.001),
      frameTime:this.lastFrame(),frames:this.n}}
  /* exact summary from every measured frame */
  summary(){
    const n=this.n;if(!n)return null;const a=this.all.slice(0,n),sorted=Float32Array.from(a).sort();
    const worstMean=q=>{const k=Math.max(1,Math.ceil(n*q));let s=0;for(let i=n-k;i<n;i++)s+=sorted[i];return s/k};
    const pct=p=>sorted[Math.min(n-1,Math.floor(p*(n-1)))];
    let mean=this.sum/n,v=0;for(let i=0;i<n;i++)v+=(a[i]-mean)**2;const sd=Math.sqrt(v/n),med=pct(.5);
    let stutter=0;for(let i=0;i<n;i++)if(a[i]>med*2&&a[i]>med+4)stutter++;
    const secs=this.sec.map(s=>s.fps);
    return{frames:n,measuredSeconds:this.sum/1000,avgFps:n/(this.sum/1000),avgFrameTime:mean,medianFrameTime:med,p99FrameTime:pct(.99),p999FrameTime:pct(.999),
      frameTimeSd:sd,low1:1000/worstMean(.01),low01:1000/worstMean(.001),minFps:secs.length?Math.min(...secs):1000/sorted[n-1],maxFps:secs.length?Math.max(...secs):1000/sorted[0],
      fastestFrame:sorted[0],slowestFrame:sorted[n-1],stutterFrames:stutter,histogram:histo(sorted)};
  }
}
/* frame-time distribution in 0.5 ms bins up to the 99.9th percentile (rest in an overflow bin) */
function histo(sorted){const n=sorted.length,top=Math.max(2,Math.ceil(sorted[Math.min(n-1,Math.floor(.999*(n-1)))]*2)/2),w=Math.max(.25,top/40),bins=Math.ceil(top/w)+1,h=new Array(bins).fill(0);
  for(let i=0;i<n;i++)h[Math.min(bins-1,Math.floor(sorted[i]/w))]++;return{binMs:w,counts:h}}
return{FrameStats};
})();
