/* Senritha's Test performance: run loop, live dashboard, results, history and export.
   Rendering and UI are independent: frames render in the loop; the dashboard reads the stats on its own timers. */
(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ls={get(k,d){try{const v=localStorage.getItem('stp.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('stp.'+k,JSON.stringify(v));return true}catch(e){return false}}};
const f1=v=>v>0&&isFinite(v)?v.toFixed(1):'—', f0=v=>v>0&&isFinite(v)?Math.round(v).toLocaleString():'—', f2=v=>v>0&&isFinite(v)?v.toFixed(2):'—';
const mmss=s=>{s=Math.max(0,Math.floor(s));return`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`};

/* ---------- presets ---------- */
const QUALITY={
  Low:{glow:0,glowK:6,glowExt:0,msaa:1,bloom:0,bloomScale:0,bloomPasses:0,mipmaps:false,aniso:0,substeps:1,process:false,weight:.7},
  Medium:{glow:.6,glowK:5,glowExt:1.2,msaa:1,bloom:.6,bloomScale:.25,bloomPasses:1,mipmaps:true,aniso:0,substeps:2,process:false,weight:.85},
  High:{glow:1,glowK:4,glowExt:1.6,msaa:1,bloom:.8,bloomScale:.5,bloomPasses:2,mipmaps:true,aniso:4,substeps:3,process:true,weight:1},
  Ultra:{glow:1.2,glowK:3.2,glowExt:2,msaa:4,bloom:1,bloomScale:.5,bloomPasses:3,mipmaps:true,aniso:16,substeps:4,process:true,weight:1.25}};
const DENSITY={Low:.5,Medium:1,High:2,Extreme:4};
const MODES=Scenes.MODES;
const cfg=Object.assign({mode:'particles',res:'1920x1080',target:'Unlimited',duration:60,density:'Medium',vsync:'on',quality:'High',opts:{}},ls.get('cfg',{}));
const saveCfg=()=>ls.set('cfg',cfg);
const mode=()=>MODES.find(m=>m.id===cfg.mode)||MODES[0];
const optOf=(m,k='option')=>{const o=m[k];if(!o)return null;const v=cfg.opts[m.id+(k==='option2'?'2':'')];return o.values.includes(v)?v:o.def};

/* ---------- renderer + hardware ---------- */
let G=null,fatal=null,hw=null,refresh=null;
try{G=new Renderer.GLRenderer($('#cv'))}catch(e){fatal=e.message}
let toastT=0;function toast(t,ms=3200){const el=$('#toast');el.textContent=t;el.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('on'),ms)}

/* ---------- configuration UI ---------- */
function renderModes(){$('#modes').innerHTML=MODES.map((m,i)=>`<button class="mode" role="radio" aria-checked="${m.id===cfg.mode}" data-mode="${m.id}"><span class="num">${i+1}</span><b>${esc(m.name)}</b><small>${esc(m.short)}</small></button>`).join('')}
function renderModeOpts(){const m=mode(),box=$('#modeOpts');let h='';
  for(const k of['option','option2']){const o=m[k];if(!o)continue;const v=optOf(m,k);h+=`<label class="field"><span>${esc(o.label)}</span><select data-opt="${k}">${o.values.map(x=>`<option value="${x}"${x===v?' selected':''}>${esc(o.fmt(x))}</option>`).join('')}</select></label>`}
  if(m.id==='lighting')h+=`<p class="note">Every light shades every pixel and tests every occluder for shadows. Object density sets the number of occluders.</p>`;
  if(m.id==='ultimate')h+=`<p class="note">Load rises in five equal stages over the run: particles, shapes, physics balls, image sprites and lights grow from 20% to 100%, over a fluid background with bloom.</p>`;
  if(m.id==='images'&&optOf(m,'option2')===4096)h+=`<p class="note"><b>4096 textures use about 340 MB of GPU memory.</b> Weaker devices may lose the graphics context.</p>`;
  box.innerHTML=h||'<p class="note">This mode has no extra settings.</p>'}
function syncCfgUI(){$('#cfgRes').value=cfg.res;$('#cfgTarget').value=cfg.target;$('#cfgDuration').value=String(cfg.duration);$('#cfgDensity').value=cfg.density;$('#cfgVsync').value=cfg.vsync;$('#cfgQuality').value=cfg.quality;cfgNote()}
function effectiveCount(){const m=mode(),o=optOf(m);return typeof o==='number'&&m.id!=='lighting'?Math.round(o*DENSITY[cfg.density]):null}
function cfgNote(){const n=[],eff=effectiveCount(),t=cfg.target==='Unlimited'?Infinity:+cfg.target;
  if(eff!=null)n.push(`Effective count: <b>${eff.toLocaleString()}</b> (${optOf(mode()).toLocaleString()} × ${DENSITY[cfg.density]} density).`);
  if(cfg.vsync==='on'&&refresh&&t>refresh)n.push(`With V-Sync on, FPS cannot go above your display's measured <b>${refresh} Hz</b>.`);
  if(cfg.vsync==='off')n.push('V-Sync off renders the next frame as soon as the GPU finishes the last one. The display still refreshes at its own rate, so not every frame is shown.');
  n.push(`Quality ${cfg.quality}: ${{Low:'no glow, no bloom, no mipmaps',Medium:'soft glow, quarter-res bloom',High:'glow, half-res bloom, mipmaps, texture filtering',Ultra:'strong glow, 3-pass bloom, 4× MSAA, 16× anisotropic'}[cfg.quality]}.`);
  $('#cfgNote').innerHTML=n.join(' ')}
$('#modes').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(!b||busy())return;cfg.mode=b.dataset.mode;saveCfg();renderModes();renderModeOpts();cfgNote()});
$('#modeOpts').addEventListener('change',e=>{const s=e.target.closest('select');if(!s)return;const m=mode(),k=s.dataset.opt,o=m[k],v=o.values.find(x=>String(x)===s.value);cfg.opts[m.id+(k==='option2'?'2':'')]=v;saveCfg();renderModeOpts();cfgNote()});
[['#cfgRes','res'],['#cfgTarget','target'],['#cfgDuration','duration',Number],['#cfgDensity','density'],['#cfgVsync','vsync'],['#cfgQuality','quality']].forEach(([s,k,cv])=>$(s).addEventListener('change',e=>{cfg[k]=cv?cv(e.target.value):e.target.value;saveCfg();cfgNote()}));
function lockUI(on){$$('.left select,.mode').forEach(el=>el.disabled=on)}

/* ---------- run state ---------- */
let state='idle',scene=null,c=null,stats=new Stats.FrameStats(),liveRec=new Stats.FrameStats();
let lastTs=null,skip=true,warmLeft=0,measured=0,pausedFrom=null,cpuRing=new Float32Array(60),cpuI=0,gpuSamples=[],heapPeak=0,objMax=0,objSum=0,objN=0,physMs=[],stageAcc=[],startedAt=null;
const busy=()=>state==='preparing'||state==='warmup'||state==='running'||state==='paused';
function setStatus(s,text){state=s;const el=$('#status');el.dataset.s=s;el.querySelector('span').textContent=text;
  $('#btnStart').disabled=busy();$('#btnPause').disabled=!(s==='warmup'||s==='running'||s==='paused');$('#btnStop').disabled=!busy()||s==='preparing';
  $('#btnPause').textContent=s==='paused'?'Resume':'Pause';lockUI(busy())}
function stageMsg(title,text,err){const m=$('#stageMsg');m.hidden=!title;if(title){m.innerHTML=`<b>${esc(title)}</b>${text?`<span>${esc(text)}</span>`:''}`;m.classList.toggle('err',!!err)}}

async function start(){
  if(busy()||!G)return;if(G.lost){toast('The graphics context is still recovering. Try again in a moment.');return}
  const m=mode(),[w,h]=cfg.res.split('x').map(Number),q=QUALITY[cfg.quality];
  if(w>G.info.maxViewport[0]||h>G.info.maxViewport[1]){toast(`This GPU cannot render ${cfg.res}. The largest size it supports is ${G.info.maxViewport.join(' × ')}.`);return}
  setStatus('preparing','Preparing');stageMsg('Preparing scene','Building geometry and textures. This is not timed.');$('#hud').hidden=true;
  await new Promise(r=>setTimeout(r,30));
  try{
    c={w,h,q,density:DENSITY[cfg.density],opt:optOf(m),opt2:optOf(m,'option2'),sync:cfg.vsync==='off'};
    G.setup(w,h,q);if(m.prepare)await m.prepare(c,G);scene=m.create(c);
    scene.update(0,0);scene.render(G);
  }catch(e){console.error(e);scene&&scene.dispose&&scene.dispose();scene=null;setStatus('error','Error');stageMsg('This benchmark could not start',e.message||String(e),true);return}
  stats.reset();liveRec.reset();lastTs=null;skip=true;warmLeft=3000;measured=0;cpuRing.fill(0);gpuSamples=[];heapPeak=0;objMax=0;objSum=0;objN=0;physMs=[];stageAcc=[];startedAt=new Date();
  setStatus('warmup','Warming up');stageMsg(null);$('#hud').hidden=false;schedule();
}
function pause(){if(state==='warmup'||state==='running'){pausedFrom=state;setStatus('paused','Paused')}else if(state==='paused'){setStatus(pausedFrom,pausedFrom==='running'?'Running':'Warming up');lastTs=null;skip=true;schedule()}}
function stop(){if(!busy())return;if(state==='preparing')return;
  if(measured>=5000&&stats.n>10){finish(true)}else{cleanup();setStatus('idle','Ready');stageMsg('Stopped','Less than 5 seconds were measured, so there is no result.');}}
function cleanup(){if(scene&&scene.dispose)scene.dispose();scene=null;$('#hud').hidden=true}
$('#btnStart').onclick=start;$('#btnPause').onclick=pause;$('#btnStop').onclick=stop;
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(state==='running'||state==='warmup')){pause();toast('Paused because the tab was hidden. Hidden tabs are throttled, so their frames would not be valid.',5000)}});
if(G){G.onLost=()=>{if(busy()){cleanup();setStatus('error','Graphics reset')}stageMsg('The graphics driver reset','The browser lost the WebGL context, often from running out of GPU memory. Lower the resolution, density or texture size and try again.',true)};
  G.onRestored=()=>{if(state==='error')setStatus('idle','Ready');stageMsg('Graphics restored','Press Start to run again.')}}

/* ---------- the frame loop ---------- */
const mc=new MessageChannel();mc.port1.onmessage=()=>loop(performance.now());
let rafId=0,timeoutId=0;
function schedule(){if(cfg.vsync==='on')rafId=requestAnimationFrame(loop);else mc.port2.postMessage(0)}
function loop(ts){
  if(!(state==='warmup'||state==='running')||!scene||G.lost)return;
  const now=cfg.vsync==='on'?ts:performance.now(),target=cfg.target==='Unlimited'?0:+cfg.target;
  if(target&&lastTs!=null){const interval=1000/target,el=now-lastTs;
    if(cfg.vsync==='on'){if(el<interval-1.5){rafId=requestAnimationFrame(loop);return}}
    else if(el<interval){const wait=interval-el;clearTimeout(timeoutId);if(wait>2)timeoutId=setTimeout(()=>loop(performance.now()),wait-1);else mc.port2.postMessage(0);return}}
  const dt=lastTs==null?0:now-lastTs;lastTs=now;
  const progress=state==='running'?Math.min(1,measured/(cfg.duration*1000)):0;
  const c0=performance.now();
  try{scene.update(Math.min(dt||16.7,100)/1000,progress);scene.render(G)}catch(e){console.error(e);cleanup();setStatus('error','Error');stageMsg('Rendering failed',e.message||String(e),true);return}
  const cpu=performance.now()-c0;cpuRing[cpuI++%cpuRing.length]=cpu;
  const objs=scene.objects();
  if(!skip&&dt>0){
    liveRec.push(dt,performance.now()/1000,objs,cpu,G.gpuMs);
    if(state==='warmup'){warmLeft-=dt;if(warmLeft<=0){setStatus('running','Running');skip=true;schedule();return}}
    else{measured+=dt;stats.push(dt,measured/1000,objs,cpu,G.gpuMs);objSum+=objs;objN++;if(objs>objMax)objMax=objs;if(G.gpuMs!=null)gpuSamples.push(G.gpuMs);
      if(scene.physics)physMs.push(scene.physics.ms);
      if(scene.stage){const s=scene.stage;(stageAcc[s]=stageAcc[s]||{frames:0,ms:0,objects:0}).frames++;stageAcc[s].ms+=dt;stageAcc[s].objects=objs}
      if(measured>=cfg.duration*1000){finish(false);return}}
  }
  skip=false;schedule();
}

/* ---------- live dashboard (independent timers) ---------- */
const METRICS=[['fps','Current FPS','hero'],['avg','Average FPS'],['low1','1% low'],['low01','0.1% low'],['min','Minimum FPS'],['max','Maximum FPS'],['ft','Frame time'],['ftAvg','Avg frame time'],['dur','Duration','wide'],['obj','Rendered objects','wide'],['frames','Frames measured','wide']];
$('#metrics').innerHTML=METRICS.map(([k,l,cls])=>`<div class="${cls||''}"><dt>${l}</dt><dd id="m-${k}">—</dd></div>`).join('');
function row(label,value,tag){const t={m:'<span class="tag t-meas">Measured</span>',r:'<span class="tag t-rep">Browser-reported</span>',e:'<span class="tag t-est">Estimate</span>',n:'<span class="tag t-na">Not available</span>'}[tag]||'';
  return`<div><dt>${label} ${t}</dt><dd${tag==='n'?' class="na"':''}>${value}</dd></div>`}
function renderHW(){
  if(!G){$('#hw').innerHTML=row('Graphics','WebGL2 unavailable','n');return}
  const i=G.info;$('#hw').innerHTML=[
    row('GPU',esc(i.renderer||'Hidden by this browser'),i.renderer?'r':'n'),row('Graphics API',esc(i.version.replace('WebGL 2.0','WebGL 2.0').slice(0,40)),'r'),
    row('Browser',esc(hw.browser),'r'),row('Platform',esc(hw.platform),'r'),row('Logical cores',hw.cores||'Not reported',hw.cores?'r':'n'),
    row('Device memory',hw.deviceMemoryGB?`≈ ${hw.deviceMemoryGB} GB`:'Not reported',hw.deviceMemoryGB?'r':'n'),row('Display',`${hw.screen} @ ${hw.dpr}×`,'r'),
    row('Refresh rate',refresh?`${refresh} Hz`:'Measuring…','m'),row('Max texture',`${i.maxTexture.toLocaleString()} px`,'r'),row('GPU timer queries',i.gpuTimer?'Available':'Not available',i.gpuTimer?'r':'n')].join('');
  $('#sensors').innerHTML=[row('GPU temperature','—','n'),row('CPU temperature','—','n'),row('GPU utilization (%)','—','n'),row('System CPU usage (%)','—','n')].join('');
}
function updateDash(){
  const L=stats.live(),cur=liveRec.current(),ft=liveRec.lastFrame(),run=state==='running'||state==='paused'&&pausedFrom==='running'||state==='done';
  const set=(k,v)=>{const el=$('#m-'+k);if(el.innerHTML!==v)el.innerHTML=v};
  set('fps',busy()?f0(cur):'—');set('ft',busy()&&ft?`${ft.toFixed(2)}<small>ms</small>`:'—');
  set('avg',run?f1(L.avg):'—');set('low1',run?f1(L.low1):'—');set('low01',run?f1(L.low01):'—');set('min',run&&L.min?f1(L.min):'—');set('max',run&&L.max?f1(L.max):'—');
  set('ftAvg',run&&L.avg?`${(1000/L.avg).toFixed(2)}<small>ms</small>`:'—');
  set('dur',`${mmss(measured/1000)}<small>/ ${mmss(cfg.duration)}</small>`);set('obj',scene?scene.objects().toLocaleString():'—');set('frames',run?L.frames.toLocaleString():'—');
  $('#hudFps').textContent=busy()?Math.round(cur):0;$('#hudFt').textContent=`${(ft||0).toFixed(2)} ms`;$('#hudObj').textContent=`${scene?scene.objects().toLocaleString():0} objects`;
  $('#hudStage').textContent=scene&&scene.stage?`Stage ${scene.stage} of 5`:state==='warmup'?`Warm-up ${(Math.max(0,warmLeft)/1000).toFixed(1)} s`:'';
  const p=state==='warmup'?1-warmLeft/3000:measured/(cfg.duration*1000);$('#bar').style.width=(Math.min(1,Math.max(0,p))*100).toFixed(1)+'%';$('#bar').classList.toggle('warm',state==='warmup');
  $('#progText').textContent=state==='warmup'?`Warm-up ${(Math.max(0,warmLeft)/1000).toFixed(1)} s`:`${mmss(measured/1000)} / ${mmss(cfg.duration)}`;
  if(state==='running')$('#status span').textContent=`Running ${mmss(measured/1000)}`;
  let cpuAvg=0,cn=0;for(const v of cpuRing)if(v>0){cpuAvg+=v;cn++}cpuAvg=cn?cpuAvg/cn:0;
  const mem=HW.memory();if(mem&&mem.used>heapPeak)heapPeak=mem.used;
  const gpu=G&&G.gpuMs!=null&&busy()?G.gpuMs:null;
  $('#load').innerHTML=[
    row('Main-thread work per frame',busy()&&cn?`${cpuAvg.toFixed(2)} ms · ${ft?Math.min(100,cpuAvg/ft*100).toFixed(0):0}%`:'—','e'),
    scene&&scene.physics?row('Physics worker step',`${scene.physics.ms.toFixed(2)} ms${scene.physics.usingWorker?'':' (main thread)'}`,'m'):'',
    row('GPU time per frame',G&&G.info.gpuTimer?(gpu!=null?`${gpu.toFixed(2)} ms`:'—'):'No timer queries',G&&G.info.gpuTimer?'m':'n'),
    row('GPU busy share',gpu!=null&&ft?`${Math.min(100,gpu/ft*100).toFixed(0)}%`:'Needs GPU timer',gpu!=null?'e':'n'),
    row('JS heap',mem?`${(mem.used/1048576).toFixed(0)} MB`:'Not reported by this browser',mem?'r':'n'),
    row('Draw calls per frame',busy()&&G?G.drawCalls:'—','m')].join('');
}
function updateGraphs(){
  const ft=liveRec.recent(300);if(ft.length<2){Charts.line($('#gFps'),{series:[],yMax:120,unit:''});Charts.line($('#gFt'),{series:[],yMax:33,unit:' ms'});return}
  const fps=new Float32Array(ft.length);for(let i=0;i<ft.length;i++){let s=0,k=0;for(let j=Math.max(0,i-7);j<=i;j++){s+=ft[j];k++}fps[i]=1000/(s/k)}
  const target=cfg.target==='Unlimited'?(cfg.vsync==='on'&&refresh?refresh:0):+cfg.target;
  Charts.line($('#gFps'),{series:[{data:fps,color:getComputedStyle(document.documentElement).getPropertyValue('--cyan'),fill:'rgba(34,211,238,.10)',end:true}],unit:'',refs:target?[{value:target,label:`${target} target`,color:'rgba(159,178,196,.5)'}]:[]});
  const budget=target?1000/target:16.67;
  Charts.line($('#gFt'),{series:[{data:ft,color:'#3B82F6',width:1.5}],unit:' ms',refs:[{value:budget,label:`${budget.toFixed(1)} ms budget`,color:'rgba(245,181,68,.55)'}]});
}
setInterval(updateDash,250);setInterval(updateGraphs,100);

/* ---------- results ---------- */
function score(sum,m){const [w,h]=cfg.res.split('x').map(Number),o=optOf(m),def=m.option?m.option.def:1;
  const optF=m.id==='fluid'?{Low:.5,Medium:.75,High:1,Extreme:1.5}[o]:m.id==='images'?Math.sqrt(o/def)*Math.pow(optOf(m,'option2')/1024,.25):m.option?Math.sqrt(o/def):1;
  const stab=Math.pow(Math.min(1,sum.low1/sum.avgFps),.3),f={res:Math.sqrt(w*h/2073600),density:Math.sqrt(DENSITY[cfg.density]),quality:QUALITY[cfg.quality].weight,load:optF,stability:stab};
  return{value:Math.round(sum.avgFps*f.res*f.density*f.quality*f.load*f.stability*10),factors:f}}
function finish(early){
  const m=mode(),sum=stats.summary();cleanup();
  if(!sum){setStatus('idle','Ready');return}
  const sc=score(sum,m),avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  const res={id:Date.now().toString(36),date:startedAt.toISOString(),app:"Senritha's Test performance",version:1,status:early?'stopped early':'completed',
    mode:{id:m.id,name:m.name},settings:{resolution:cfg.res,targetFps:cfg.target,durationSeconds:cfg.duration,density:cfg.density,vsync:cfg.vsync,quality:cfg.quality,
      option:m.option?{label:m.option.label,value:optOf(m)}:null,option2:m.option2?{label:m.option2.label,value:optOf(m,'option2')}:null},
    summary:sum,score:sc.value,scoreFactors:sc.factors,perSecond:stats.sec,
    stages:stageAcc.map((s,i)=>s?{stage:i,frames:s.frames,avgFps:s.frames/(s.ms/1000),objects:s.objects}:null).filter(Boolean),
    load:{avgObjects:objN?Math.round(objSum/objN):0,maxObjects:objMax,avgMainThreadMs:avg(stats.sec.map(s=>s.cpu)),avgGpuMs:avg(gpuSamples),avgPhysicsWorkerMs:avg(physMs),peakJsHeapMB:heapPeak?+(heapPeak/1048576).toFixed(1):null},
    hardware:Object.assign({},hw,{refreshHz:refresh})};
  const hist=ls.get('history',[]);hist.unshift(res);while(hist.length>50)hist.pop();
  if(!ls.set('history',hist)){hist.forEach(r=>{r.perSecond=r.perSecond.filter((_,i)=>i%5===0)});ls.set('history',hist)}
  updateHistCount();setStatus('done','Done');stageMsg('Benchmark finished',`${m.name} · ${f1(sum.avgFps)} average FPS · score ${sc.value.toLocaleString()}`);showResult(res);
}
const KPI=[['avgFps','Average FPS',f1],['low1','1% low',f1],['low01','0.1% low',f1],['minFps','Minimum FPS',f1],['maxFps','Maximum FPS',f1],['avgFrameTime','Avg frame time',v=>f2(v)+'<small> ms</small>'],['frames','Frames rendered',f0],['measuredSeconds','Measured time',v=>mmss(v)]];
const settingsText=r=>`${r.settings.resolution} · ${r.settings.quality} · density ${r.settings.density} · V-Sync ${r.settings.vsync} · target ${r.settings.targetFps}${r.settings.option?` · ${r.settings.option.label.toLowerCase()} ${Number(r.settings.option.value)?Number(r.settings.option.value).toLocaleString():r.settings.option.value}`:''}${r.settings.option2?` · ${r.settings.option2.value}px textures`:''}`;
const sameSettings=(a,b)=>a.mode.id===b.mode.id&&JSON.stringify(a.settings)===JSON.stringify(b.settings);
function showResult(r){
  const prev=ls.get('history',[]).find(x=>x.id!==r.id&&sameSettings(x,r)&&new Date(x.date)<new Date(r.date)),s=r.summary;
  const delta=(k,higher=true)=>{if(!prev)return'';const a=prev.summary[k],b=s[k];if(!a||!b)return'';const d=(b-a)/a*100,good=higher?d>=0:d<=0;return`<span class="delta ${good?'up':'down'}">${d>=0?'+':''}${d.toFixed(1)}% vs previous</span>`};
  const hwRows=[['GPU',r.hardware.gpu||'Hidden by browser'],['Browser',r.hardware.browser],['Platform',r.hardware.platform],['Logical cores',r.hardware.cores||'Not reported'],['Device memory',r.hardware.deviceMemoryGB?`≈ ${r.hardware.deviceMemoryGB} GB (browser-rounded)`:'Not reported'],['Display',`${r.hardware.screen} @ ${r.hardware.dpr}× · ${r.hardware.refreshHz||'?'} Hz measured`],['WebGL',r.hardware.webgl]];
  const ld=r.load,loadRows=[['Average rendered objects',ld.avgObjects.toLocaleString()],['Main-thread work per frame (estimate)',ld.avgMainThreadMs!=null?ld.avgMainThreadMs.toFixed(2)+' ms':'—'],['GPU time per frame (timer query)',ld.avgGpuMs!=null?ld.avgGpuMs.toFixed(2)+' ms':'Not available in this browser'],
    ...(ld.avgPhysicsWorkerMs!=null?[['Physics worker step',ld.avgPhysicsWorkerMs.toFixed(2)+' ms']]:[]),['Peak JS heap (browser-reported)',ld.peakJsHeapMB!=null?ld.peakJsHeapMB+' MB':'Not reported'],['Stutter frames (> 2× median)',s.stutterFrames.toLocaleString()],['Median / 99th / 99.9th pct frame time',`${s.medianFrameTime.toFixed(2)} / ${s.p99FrameTime.toFixed(2)} / ${s.p999FrameTime.toFixed(2)} ms`]];
  const f=r.scoreFactors;
  $('#resultsBody').innerHTML=`<div class="sh-head"><div><h2 id="rTitle">${esc(r.mode.name)}</h2><p>${new Date(r.date).toLocaleString()} · ${esc(settingsText(r))}</p></div>
    <div class="sh-acts"><button class="btn sm" data-x="json">Export JSON</button><button class="btn sm" data-x="csv">Export CSV</button><button class="btn sm" data-x="again">Run again</button><button class="btn sm primary" data-x="close">Close</button></div></div>
    <div class="score"><b>${r.score.toLocaleString()}</b><span>Benchmark score. Compare it only with runs of the same mode and settings.${prev?` Previous run: ${prev.score.toLocaleString()}.`:''}</span><span class="chip ${r.status==='completed'?'':'early'}">${r.status}</span></div>
    <div class="kpis">${KPI.map(([k,l,fm])=>`<div class="kpi"><span>${l}</span><b>${fm(s[k])}</b>${['avgFps','low1','low01','minFps','maxFps'].includes(k)?delta(k):k==='avgFrameTime'?delta(k,false):''}</div>`).join('')}</div>
    <div class="rgrid"><div class="card"><h3>FPS over time</h3><p class="sub">1-second windows · dashed line = average</p><canvas id="rFps"></canvas></div>
      <div class="card"><h3>Frame-time distribution</h3><p class="sub">every frame · amber = slower than 2× median</p><canvas id="rHist"></canvas></div></div>
    <div class="rgrid even"><div class="card"><h3>Frame time per second</h3><div class="legend"><span><i style="background:var(--series-a)"></i>Average</span><span><i style="background:var(--series-b)"></i>Slowest frame</span></div><canvas id="rFt"></canvas></div>
      <div class="card"><h3>${r.stages.length?'Stages':'Load'}</h3>${r.stages.length?`<div class="tablewrap"><table><thead><tr><th>Stage</th><th class="num">Objects</th><th class="num">Avg FPS</th><th class="num">Frames</th></tr></thead><tbody>${r.stages.map(x=>`<tr><td>${x.stage} of 5</td><td class="num">${x.objects.toLocaleString()}</td><td class="num">${x.avgFps.toFixed(1)}</td><td class="num">${x.frames.toLocaleString()}</td></tr>`).join('')}</tbody></table></div>`:''}
        <div class="tablewrap"><table><tbody>${loadRows.map(([a,b])=>`<tr><td>${a}</td><td class="num">${esc(b)}</td></tr>`).join('')}</tbody></table></div></div></div>
    <div class="rgrid even"><div class="card"><h3>Hardware</h3><div class="tablewrap"><table><tbody>${hwRows.map(([a,b])=>`<tr><td>${a}</td><td class="num">${esc(b)}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="card"><h3>How these numbers are measured</h3><ul class="notes">
        <li>Frame times come from real frame timestamps (${r.settings.vsync==='on'?'requestAnimationFrame':'performance.now() after the GPU finishes each frame'}). Nothing is simulated.</li>
        <li>The 3-second warm-up and any paused time are not counted.</li>
        <li>Average FPS = frames ÷ measured time. 1% and 0.1% low = 1000 ÷ mean of the slowest 1% and 0.1% of frame times. Min and max FPS use 1-second windows.</li>
        <li>Score = average FPS × <code>${f.res.toFixed(2)}</code> resolution × <code>${f.density.toFixed(2)}</code> density × <code>${f.quality.toFixed(2)}</code> quality × <code>${f.load.toFixed(2)}</code> load × <code>${f.stability.toFixed(2)}</code> stability (1% low ÷ average, ^0.3) × 10.</li>
        <li>Temperatures, GPU utilization and system CPU usage are not available to web pages and are not shown.</li></ul></div></div>`;
  $('#results').classList.add('open');
  requestAnimationFrame(()=>{
    const ps=r.perSecond.map(x=>x.fps);Charts.line($('#rFps'),{series:[{data:ps,color:'#22D3EE',fill:'rgba(34,211,238,.10)',end:true}],refs:[{value:s.avgFps,label:`avg ${s.avgFps.toFixed(1)}`,color:'rgba(159,178,196,.6)'}],xLabels:['0 s',`${Math.round(s.measuredSeconds)} s`]});
    Charts.line($('#rFt'),{series:[{data:r.perSecond.map(x=>x.ftMax),color:'#C77A17',width:1.5},{data:r.perSecond.map(x=>x.ftAvg),color:'#119DB8',width:2}],unit:' ms',xLabels:['0 s',`${Math.round(s.measuredSeconds)} s`]});
    Charts.bars($('#rHist'),{counts:s.histogram.counts,binMs:s.histogram.binMs,color:'#22D3EE',highlightFrom:s.medianFrameTime*2});
  });
  $('#resultsBody').onclick=e=>{const b=e.target.closest('[data-x]');if(!b)return;const x=b.dataset.x;
    if(x==='close')$('#results').classList.remove('open');else if(x==='json')exportJSON(r);else if(x==='csv')exportCSV(r);else if(x==='again'){$('#results').classList.remove('open');start()}};
}
$('#results').addEventListener('click',e=>{if(e.target.id==='results')$('#results').classList.remove('open')});

/* ---------- export ---------- */
async function save(name,data,type){
  try{if(window.claude&&window.claude.use){const dl=await window.claude.use('downloads');if(dl){await dl.save({filename:name,data:new Blob([data],{type})});toast(`Saved ${name}`);return}}}catch(e){if(e&&e.code==='declined')return;}
  try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);toast(`Saved ${name}`)}
  catch(e){toast('This browser blocked the download.')}}
const fileBase=r=>`senritha-benchmark-${r.mode.id}-${r.date.slice(0,19).replace(/[:T]/g,'-')}`;
function exportJSON(r){save(fileBase(r)+'.json',JSON.stringify(r,null,2),'application/json')}
function exportCSV(r){const s=r.summary,q=v=>`"${String(v).replace(/"/g,'""')}"`,rows=[['metric','value'],['mode',r.mode.name],['date',r.date],['status',r.status],['resolution',r.settings.resolution],['quality',r.settings.quality],['density',r.settings.density],['vsync',r.settings.vsync],['target_fps',r.settings.targetFps],
    ...(r.settings.option?[[r.settings.option.label,r.settings.option.value]]:[]),...(r.settings.option2?[[r.settings.option2.label,r.settings.option2.value]]:[]),
    ['score',r.score],['avg_fps',s.avgFps.toFixed(2)],['low_1pct_fps',s.low1.toFixed(2)],['low_0_1pct_fps',s.low01.toFixed(2)],['min_fps',s.minFps.toFixed(2)],['max_fps',s.maxFps.toFixed(2)],
    ['avg_frame_time_ms',s.avgFrameTime.toFixed(3)],['median_frame_time_ms',s.medianFrameTime.toFixed(3)],['p99_frame_time_ms',s.p99FrameTime.toFixed(3)],['frames',s.frames],['measured_seconds',s.measuredSeconds.toFixed(2)],
    ['gpu',r.hardware.gpu||''],['browser',r.hardware.browser],['platform',r.hardware.platform],['cores',r.hardware.cores||''],['refresh_hz',r.hardware.refreshHz||'']];
  let csv=rows.map(x=>x.map(q).join(',')).join('\n')+'\n\n'+['t_seconds','fps','frame_time_avg_ms','frame_time_max_ms','objects','main_thread_ms','gpu_ms'].join(',')+'\n';
  csv+=r.perSecond.map(p=>[p.t,p.fps.toFixed(2),p.ftAvg.toFixed(3),p.ftMax.toFixed(3),p.objects,p.cpu.toFixed(3),p.gpu!=null?p.gpu.toFixed(3):''].join(',')).join('\n');
  save(fileBase(r)+'.csv',csv,'text/csv')}

/* ---------- history & compare ---------- */
let selected=new Set();
function updateHistCount(){const n=ls.get('history',[]).length;$('#histCount').textContent=n?n:''}
function showHistory(view){
  const hist=ls.get('history',[]);selected=new Set([...selected].filter(id=>hist.some(h=>h.id===id)));
  let body=`<div class="sh-head"><div><h2 id="hTitle">History</h2><p>${hist.length} saved run${hist.length===1?'':'s'} on this device · select two to compare</p></div>
    <div class="sh-acts"><button class="btn sm" data-h="compare" ${selected.size===2?'':'disabled'}>Compare selected</button><button class="btn sm danger" data-h="delete" ${selected.size?'':'disabled'}>Delete selected</button><button class="btn sm primary" data-h="close">Close</button></div></div>`;
  if(!hist.length)body+='<p class="empty">No runs yet. Finished benchmarks are saved here automatically.</p>';
  else body+=`<div class="tablewrap"><table><thead><tr><th></th><th>Date</th><th>Mode</th><th>Settings</th><th class="num">Avg FPS</th><th class="num">1% low</th><th class="num">Score</th><th></th></tr></thead><tbody>${hist.map(h=>`<tr class="${selected.has(h.id)?'sel':''}"><td><input type="checkbox" data-sel="${h.id}" ${selected.has(h.id)?'checked':''} aria-label="Select run"></td>
    <td class="num" style="text-align:left">${new Date(h.date).toLocaleString([], {dateStyle:'short',timeStyle:'short'})}</td><td>${esc(h.mode.name)}${h.status!=='completed'?' <span class="tag t-est">stopped</span>':''}</td><td style="color:var(--fg-2);font-size:12px">${esc(settingsText(h))}</td>
    <td class="num">${h.summary.avgFps.toFixed(1)}</td><td class="num">${h.summary.low1.toFixed(1)}</td><td class="num">${h.score.toLocaleString()}</td><td><button class="btn sm" data-open="${h.id}">Report</button></td></tr>`).join('')}</tbody></table></div>`;
  if(view==='compare'&&selected.size===2){const [a,b]=[...selected].map(id=>hist.find(h=>h.id===id)).sort((x,y)=>new Date(x.date)-new Date(y.date));
    const rowsC=[['Score','score',v=>v.toLocaleString(),1],['Average FPS','avgFps',f1,1],['1% low','low1',f1,1],['0.1% low','low01',f1,1],['Minimum FPS','minFps',f1,1],['Maximum FPS','maxFps',f1,1],['Avg frame time (ms)','avgFrameTime',f2,0],['Frames','frames',f0,1]];
    const get=(r,k)=>k==='score'?r.score:r.summary[k];
    body+=`<div class="card" style="margin-top:16px"><h3>Comparison</h3><p class="sub">${sameSettings(a,b)?'Same mode and settings':'Different mode or settings, so the score is not directly comparable'}</p>
      <div class="legend"><span><i style="background:var(--series-a)"></i>A · ${esc(a.mode.name)} · ${new Date(a.date).toLocaleString([], {dateStyle:'short',timeStyle:'short'})}</span><span><i style="background:var(--series-b)"></i>B · ${esc(b.mode.name)} · ${new Date(b.date).toLocaleString([], {dateStyle:'short',timeStyle:'short'})}</span></div>
      <div class="rgrid even"><div class="tablewrap"><table><thead><tr><th>Metric</th><th class="num">A</th><th class="num">B</th><th class="num">Change</th></tr></thead><tbody>${rowsC.map(([l,k,fm,hi])=>{const x=get(a,k),y=get(b,k),d=x?(y-x)/x*100:0,good=hi?d>=0:d<=0;
        return`<tr><td>${l}</td><td class="num">${fm(x)}</td><td class="num">${fm(y)}</td><td class="num ${good?'up':'down'}">${d>=0?'+':''}${d.toFixed(1)}%</td></tr>`}).join('')}</tbody></table></div>
        <div><canvas id="cmpChart" style="width:100%;height:220px;display:block"></canvas><p class="sub">FPS per second, A and B</p></div></div>
      <p class="sub">A: ${esc(settingsText(a))}<br>B: ${esc(settingsText(b))}</p></div>`;
    requestAnimationFrame(()=>Charts.line($('#cmpChart'),{series:[{data:a.perSecond.map(x=>x.fps),color:'#119DB8',width:2},{data:b.perSecond.map(x=>x.fps),color:'#C77A17',width:2}],xLabels:['start','end']}))}
  $('#historyBody').innerHTML=body;$('#history').classList.add('open');
}
$('#btnHistory').onclick=()=>showHistory();
$('#historyBody').addEventListener('click',e=>{const t=e.target;
  if(t.dataset.sel){t.checked?selected.add(t.dataset.sel):selected.delete(t.dataset.sel);if(selected.size>2){selected.delete([...selected][0])}showHistory(selected.size===2?'compare':null);return}
  const b=t.closest('button');if(!b)return;
  if(b.dataset.open){const r=ls.get('history',[]).find(h=>h.id===b.dataset.open);if(r){$('#history').classList.remove('open');showResult(r)}}
  else if(b.dataset.h==='close')$('#history').classList.remove('open');
  else if(b.dataset.h==='compare')showHistory('compare');
  else if(b.dataset.h==='delete'){if(!b.dataset.armed){b.dataset.armed=1;b.textContent=`Tap again to delete ${selected.size}`;return}const hist=ls.get('history',[]).filter(h=>!selected.has(h.id));ls.set('history',hist);selected.clear();updateHistCount();showHistory()}});
$('#history').addEventListener('click',e=>{if(e.target.id==='history')$('#history').classList.remove('open')});
addEventListener('keydown',e=>{if(e.key==='Escape'){$('#results').classList.remove('open');$('#history').classList.remove('open')}
  else if(e.target.tagName!=='SELECT'&&e.target.tagName!=='INPUT'&&e.code==='Space'&&(state==='running'||state==='warmup'||state==='paused')){e.preventDefault();pause()}});

/* ---------- boot ---------- */
renderModes();renderModeOpts();syncCfgUI();updateHistCount();
if(fatal){setStatus('error','No WebGL2');stageMsg('WebGL2 is not available',fatal,true);$('#btnStart').disabled=true;$('#hw').innerHTML=row('Graphics','WebGL2 unavailable','n')}
else{hw=HW.collect(G.info,null);renderHW();HW.measureRefresh().then(hz=>{refresh=hz;hw.refreshHz=hz;renderHW();cfgNote()});setStatus('idle','Ready');
  G.setup(1280,720,QUALITY.Low);const g=G.gl;g.bindFramebuffer(g.FRAMEBUFFER,null);g.clearColor(.012,.02,.04,1);g.clear(g.COLOR_BUFFER_BIT)}
updateDash();updateGraphs();
})();
