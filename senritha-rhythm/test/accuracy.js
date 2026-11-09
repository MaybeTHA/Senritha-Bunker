/* Beat engine accuracy test. Builds synthetic songs with known beat times, runs the engine,
   and reports tempo, beat F-measure (+-70 ms) and timing offset. Run: node test/accuracy.js
   Pass --old <path-to-old-analysis.js> to compare with an older engine. Exits 1 if a check fails. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const SR=44100;
let seed=1;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;

/* ---------- synth ---------- */
function track(len){return new Float32Array(Math.ceil(len*SR))}
function kick(b,t,g=1){const s=Math.round(t*SR);let ph=0;for(let i=0;i<SR*.35&&s+i<b.length;i++){const u=i/SR,f=45+105*Math.exp(-u*30);ph+=2*Math.PI*f/SR;b[s+i]+=Math.sin(ph)*Math.exp(-u*9)*.9*g}}
function snare(b,t,g=1){const s=Math.round(t*SR);let p=0;for(let i=0;i<SR*.2&&s+i<b.length;i++){const n=rnd()*2-1,h=n-p;p=n;b[s+i]+=(h*.5+Math.sin(2*Math.PI*190*i/SR)*.3)*Math.exp(-i/SR*22)*.6*g}}
function hat(b,t,g=1){const s=Math.round(t*SR);let p=0,q=0;for(let i=0;i<SR*.05&&s+i<b.length;i++){const n=rnd()*2-1,h=n-p,hh=h-q;p=n;q=h;b[s+i]+=hh*Math.exp(-i/SR*70)*.18*g}}
function bassNote(b,t,dur,midi,g=.25){const s=Math.round(t*SR),f=440*2**((midi-69)/12);let lp=0;for(let i=0;i<dur*SR&&s+i<b.length;i++){const saw=2*((i*f/SR)%1)-1;lp+=.08*(saw-lp);b[s+i]+=lp*g*Math.min(1,i/200)*Math.exp(-i/SR*2)}}
function pad(b,t,dur,midis,g=.05){const s=Math.round(t*SR);for(let i=0;i<dur*SR&&s+i<b.length;i++){let v=0;for(const m of midis)v+=Math.sin(2*Math.PI*440*2**((m-69)/12)*i/SR);b[s+i]+=v*g*Math.min(1,i/(SR*.3))*Math.min(1,(dur*SR-i)/(SR*.3))}}
function noise(b,g){for(let i=0;i<b.length;i++)b[i]+=(rnd()*2-1)*g}

/* each builder returns {name, buf, beats (truth), bpm} */
function grid(bpm,len,start=.5){const out=[];for(let t=start;t<len-.3;t+=60/bpm)out.push(t);return out}
const SONGS={
  'Four on the floor 128':()=>{const len=40,bpm=128,b=track(len),beats=grid(bpm,len);
    beats.forEach((t,i)=>{kick(b,t);if(i%2)snare(b,t);hat(b,t+30/bpm);if(i%4===0)bassNote(b,t,60/bpm*2,40)});noise(b,.004);return{b,beats,bpm}},
  'Hip-hop 90 with swing':()=>{const len=40,bpm=90,b=track(len),beats=grid(bpm,len),q=60/bpm;
    beats.forEach((t,i)=>{if(i%4===0)kick(b,t);if(i%4===2){kick(b,t-q*.33,.8)}if(i%2)snare(b,t);hat(b,t,.8);hat(b,t+q*.62,.6);if(i%4===0)bassNote(b,t,q*3,36)});
    for(let t=.5;t<len;t+=q*4)pad(b,t,q*4,[60,63,67]);noise(b,.004);return{b,beats,bpm}},
  'Tempo ramp 100 to 116':()=>{const len=48,b=track(len),beats=[];let t=.5,bpm=100;while(t<len-.3){beats.push(t);bpm=100+16*t/len;t+=60/bpm}
    beats.forEach((t,i)=>{kick(b,t);if(i%2)snare(b,t);hat(b,t+(beats[i+1]?(beats[i+1]-t)/2:.25))});noise(b,.004);return{b,beats,bpm:108}},
  'Ballad 72, soft drums':()=>{const len=48,bpm=72,b=track(len),beats=grid(bpm,len),q=60/bpm,ch=[[57,60,64],[53,57,60],[60,64,67],[55,59,62]];
    beats.forEach((t,i)=>{if(i%4===0)kick(b,t,.6);if(i%4===2)snare(b,t,.5);hat(b,t,.4);if(i%4===0){pad(b,t,q*4,ch[(i/4)%4],.06);bassNote(b,t,q*3.5,ch[(i/4)%4][0]-24,.2)}});
    noise(b,.003);return{b,beats,bpm}},
  'Busy pop 120 with syncopation':()=>{const len=40,bpm=120,b=track(len),beats=grid(bpm,len),q=60/bpm;
    beats.forEach((t,i)=>{if(i%4===0||i%4===2)kick(b,t);if(i%4===2)kick(b,t+q*.75,.7);if(i%2)snare(b,t);for(let k=0;k<4;k++)hat(b,t+k*q/4,k?.5:.8);bassNote(b,t+q*.5,q*.4,43,.2)});
    noise(b,.004);return{b,beats,bpm}},
};

/* ---------- metrics ---------- */
function score(est,truth,tol=.07){
  const used=new Uint8Array(est.length);let tp=0,offs=[];
  for(const t of truth){let bi=-1,bd=tol;for(let i=0;i<est.length;i++){const d=Math.abs(est[i]-t);if(!used[i]&&d<=bd){bd=d;bi=i}}if(bi>=0){used[bi]=1;tp++;offs.push(est[bi]-t)}}
  const p=tp/Math.max(1,est.length),r=tp/Math.max(1,truth.length),f=p+r?2*p*r/(p+r):0;
  const mean=offs.length?offs.reduce((a,b)=>a+b,0)/offs.length:NaN, mad=offs.length?offs.reduce((a,b)=>a+Math.abs(b),0)/offs.length:NaN;
  return{f,mean:mean*1000,mad:mad*1000};
}

/* ---------- engines ---------- */
function loadNew(){const A=require(path.join(__dirname,'..','analysis.js'));const c=A.core();return async b=>c.analyze([b],SR)}
function loadOld(file){
  const src=fs.readFileSync(file,'utf8');let cur=null;
  const ctx={setTimeout,Math,Float32Array,Float64Array,Int32Array,Array,Promise,console,
    window:{OfflineAudioContext:function(){this.decodeAudioData=(buf,res)=>res(cur)}}};
  vm.createContext(ctx);vm.runInContext(src+';this.Analysis=Analysis;',ctx);
  return async b=>{cur={sampleRate:SR,length:b.length,numberOfChannels:1,getChannelData:()=>b};return ctx.Analysis.analyze({arrayBuffer:async()=>new ArrayBuffer(8)})};
}

(async()=>{
  const engines=[['new',loadNew()]];const oi=process.argv.indexOf('--old');if(oi>0)engines.push(['old',loadOld(process.argv[oi+1])]);
  let fail=false;const rows=[];
  for(const [name,mk] of Object.entries(SONGS)){seed=7;const {b,beats,bpm}=mk();
    for(const [en,run] of engines){const t0=Date.now(),r=await run(b),s=score(r.beats,beats),s25=score(r.beats,beats,.025),bpmErr=Math.abs(r.bpm-bpm)/bpm;
      rows.push({song:name,engine:en,bpm:`${r.bpm} (true ${bpm})`,F:s.f.toFixed(3),'F ±25ms':s25.f.toFixed(3),'offset ms':s.mean.toFixed(1),'abs err ms':s.mad.toFixed(1),'time ms':Date.now()-t0});
      if(en==='new'&&(s.f<.9||s25.f<.85||Math.abs(s.mean)>8||bpmErr>.03))fail=true}}
  console.table(rows);
  console.log(fail?'FAIL: a song is below F 0.90 (or 0.85 at ±25 ms), off by more than 8 ms on average, or more than 3% off in tempo':'PASS');
  process.exit(fail?1:0);
})();
