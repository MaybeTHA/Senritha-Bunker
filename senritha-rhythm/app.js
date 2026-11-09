/* Senritha's Rhythm: plays songs from your phone and moves with every beat. */
(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const fmt=s=>!isFinite(s)?'0:00':`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ls={get(k,d){try{const v=localStorage.getItem('rhythm.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('rhythm.'+k,JSON.stringify(v))}catch(e){}}};
const prefs=Object.assign({style:'orb',trails:true,offset:0,strength:1,auto:false,shuffle:false,repeat:'all',difficulty:'normal'},ls.get('prefs',{}));
const savePrefs=()=>ls.set('prefs',prefs);
const vib=p=>{try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}};

/* ---------- Song library (IndexedDB, with an in-memory fallback) ---------- */
const lib=(()=>{let dbp=null,mem=new Map();
  const open=()=>dbp||(dbp=new Promise((res,rej)=>{try{const r=indexedDB.open('senritha-rhythm',1);r.onupgradeneeded=()=>r.result.createObjectStore('songs',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}}));
  const tx=async(m,fn)=>{const db=await open();return new Promise((res,rej)=>{const t=db.transaction('songs',m),r=fn(t.objectStore('songs'));t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error)})};
  const clean=s=>{const o={...s};delete o.progress;delete o.artUrl;return o};
  return{
    async put(s){mem.set(s.id,s);try{await tx('readwrite',st=>st.put(clean(s)))}catch(e){}},
    async all(){try{const a=await tx('readonly',st=>st.getAll());if(a)a.forEach(s=>{const m=mem.get(s.id);mem.set(s.id,m?Object.assign(m,s,{artUrl:m.artUrl}):s)})}catch(e){}
      return[...mem.values()].sort((a,b)=>a.added-b.added)},
    async del(id){mem.delete(id);try{await tx('readwrite',st=>st.delete(id))}catch(e){}}
  }})();
let playlists=ls.get('playlists',[]); const savePl=()=>ls.set('playlists',playlists);
const artUrl=s=>{if(!s||!s.art)return null;if(!s.artUrl)s.artUrl=URL.createObjectURL(s.art);return s.artUrl};
const title=s=>s?(s.title||s.name):'';

/* ---------- Audio graph ---------- */
const audio=new Audio(); audio.preload='auto'; audio.setAttribute('playsinline','');
let ac=null, analyser=null, spec=null, wave=null, recDest=null;
function ensureGraph(){
  if(ac)return; const A=window.AudioContext||window.webkitAudioContext; if(!A)return;
  ac=new A(); const src=ac.createMediaElementSource(audio); analyser=ac.createAnalyser(); analyser.fftSize=512; analyser.smoothingTimeConstant=.72;
  src.connect(analyser); analyser.connect(ac.destination);
  try{recDest=ac.createMediaStreamDestination();analyser.connect(recDest)}catch(e){}
  spec=new Uint8Array(analyser.frequencyBinCount); wave=new Uint8Array(analyser.fftSize);
}

/* ---------- Library state, views, play order ---------- */
let songs=[], cur=null, url=null, analyzing=null, view='all', order=[];
const viewSongs=()=>{if(view==='all')return songs;const p=playlists.find(x=>x.id===view);if(!p){view='all';return songs}return p.songIds.map(id=>songs.find(s=>s.id===id)).filter(Boolean)};
function buildOrder(){const list=viewSongs().slice();
  if(prefs.shuffle){for(let i=list.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[list[i],list[j]]=[list[j],list[i]]}
    if(cur){const k=list.indexOf(cur);if(k>0){list.splice(k,1);list.unshift(cur)}}}
  order=list}
async function refresh(){songs=await lib.all();buildOrder();renderList();$('#empty').hidden=!!songs.length;$('#player').hidden=!songs.length}

async function addFiles(files){
  const list=[...files].filter(f=>f.type.startsWith('audio/')||/\.(mp3|m4a|aac|wav|ogg|flac|opus|webm)$/i.test(f.name));
  if(!list.length){toast('Those files are not songs. Pick MP3, M4A, WAV or OGG files.');return}
  let first=null;
  for(const [i,f] of list.entries()){
    const tg=await Tags.read(f);
    const s={id:Date.now()+i,name:f.name.replace(/\.[^.]+$/,''),title:tg.title||'',artist:tg.artist||'',art:tg.art||null,size:f.size,added:Date.now()+i,blob:f,analysis:null};
    await lib.put(s); if(!first)first=s;
    if(view!=='all'){const p=playlists.find(x=>x.id===view);if(p){p.songIds.push(s.id);savePl()}}
  }
  await refresh(); toast(list.length===1?'Song added':`${list.length} songs added`);
  if(!cur||audio.paused)play(first); pump();
}
$$('input[type=file]').forEach(i=>i.addEventListener('change',()=>{addFiles(i.files);i.value=''}));

async function pump(){                       // analyse songs one at a time, current song first
  if(analyzing)return;
  const pending=songs.filter(s=>!s.analysis&&!s.failed); if(!pending.length)return;
  const s=(cur&&!cur.analysis&&!cur.failed)?cur:pending[0]; analyzing=s.id; renderList(); meta();
  try{s.analysis=await Analysis.analyze(s.blob,p=>{s.progress=p;if(cur===s)meta()});await lib.put(s)}
  catch(e){s.failed=true;if(cur===s)toast('Couldn\'t read the beat of this song. It still plays with live beat detection.')}
  analyzing=null; delete s.progress; renderList(); meta(); pump(); emit('analysis',s);
}

function load(s){
  if(cur===s)return; cur=s; if(url)URL.revokeObjectURL(url); url=URL.createObjectURL(s.blob); audio.src=url; live.reset();
  $('#ttl').textContent=title(s); const a=artUrl(s); $('#art').style.backgroundImage=a?`url("${a}")`:''; $('#art').classList.toggle('none',!a);
  meta(); mediaMeta(); renderList();
}
function play(s){
  if(!s)return; ensureGraph(); if(ac&&ac.state==='suspended')ac.resume();
  load(s); audio.play().catch(()=>{}); if(!s.analysis&&!s.failed)pump();
}
function step(dir){if(!order.length)buildOrder();if(!order.length)return null;const i=order.indexOf(cur);
  if(i<0)return order[0];const j=i+dir;if(j>=order.length||j<0){if(prefs.repeat==='off'&&dir>0)return null;return order[(j+order.length)%order.length]}return order[j]}
const next=()=>{const s=step(1);if(s)play(s)};
const prev=()=>{if(audio.currentTime>3){audio.currentTime=0;return}const s=step(-1);if(s)play(s)};
function toggle(){if(!cur){buildOrder();play(order[0]||songs[0]);return} if(audio.paused){ensureGraph();ac&&ac.resume();audio.play().catch(()=>{})}else audio.pause()}
audio.addEventListener('ended',()=>{if(hooksEnd())return;if(prefs.repeat==='one'){audio.currentTime=0;audio.play();return}const s=step(1);if(s)play(s);else{audio.currentTime=0;ui()}});
audio.addEventListener('play',()=>{ui();wake(true);idleSoon()});
audio.addEventListener('pause',()=>{ui();wake(false);immersive(false)});
audio.addEventListener('loadedmetadata',()=>{$('#dur').textContent=fmt(audio.duration)});

/* ---------- Live beat detection, used until the full analysis is ready ---------- */
const live={beats:[],kicks:[],hist:[],last:-1,reset(){this.beats=[];this.kicks=[];this.hist=[];this.last=-1},
  feed(t){if(!analyser)return;analyser.getByteFrequencyData(spec);let e=0;for(let k=1;k<6;k++)e+=spec[k];e/=5;
    const h=this.hist,avg=h.length?h.reduce((a,b)=>a+b,0)/h.length:e;h.push(e);if(h.length>45)h.shift();
    if(e>avg*1.18&&e>90&&t-this.last>.28){this.last=t;this.beats.push(t);this.kicks.push(t);if(this.beats.length>64){this.beats.shift();this.kicks.shift()}}},
  bpm(){const b=this.beats;if(b.length<6)return 0;const d=[];for(let i=Math.max(1,b.length-8);i<b.length;i++)d.push(b[i]-b[i-1]);d.sort((x,y)=>x-y);let p=d[d.length>>1];while(p<.33)p*=2;while(p>1)p/=2;return Math.round(60/p)}};

/* ---------- Frame state ---------- */
const lastLE=(a,t)=>{let lo=0,hi=a.length-1,r=-1;while(lo<=hi){const m=(lo+hi)>>1;if(a[m]<=t){r=m;lo=m+1}else hi=m-1}return r};
const cv=$('#viz'), ctx=cv.getContext('2d');
let W=0,H=0;
function resize(){const d=Math.min(2,devicePixelRatio||1);W=innerWidth;H=innerHeight;cv.width=W*d;cv.height=H*d;cv.style.width=W+'px';cv.style.height=H+'px';ctx.setTransform(d,0,0,d,0,0);ctx.fillStyle='#07070C';ctx.fillRect(0,0,W,H)}
addEventListener('resize',resize);
const PAL=Visuals.PAL;
const songTime=()=>{const lat=ac?(ac.outputLatency||ac.baseLatency||0):0;return audio.currentTime-lat+prefs.offset/1000};
function state(now){
  const playing=!!cur&&!audio.paused, A=cur&&cur.analysis;
  let t; if(cur){t=songTime();if(playing&&!A)live.feed(audio.currentTime)}else t=now/1000;
  let beats,kicks,highs,bar0=0,bpm,base=0;
  if(A){beats=A.beats;kicks=A.kicks;highs=A.highs;bar0=A.bar0;bpm=A.bpm}
  else if(cur){beats=live.beats;kicks=live.kicks;highs=[];bpm=live.bpm()}
  else{const p=60/72,n=Math.floor(t/p);base=Math.max(0,n-12);beats=[];for(let i=base;i<=n;i++)beats.push(i*p);kicks=beats;highs=[];bpm=0}
  const bi=lastLE(beats,t), lb=bi>=0?beats[bi]:-9, gi=base+Math.max(0,bi);
  const barOf=i=>Math.floor((i-bar0)/4), colOf=i=>PAL[((barOf(i)%4)+4)%4];
  const recent=[];for(let i=Math.max(0,bi-10);i<=bi;i++){const ix=base+i;recent.push({t:beats[i],i:ix,col:colOf(ix),down:((ix-bar0)%4+4)%4===0})}
  const ki=lastLE(kicks,t),kickList=[];for(let i=Math.max(0,ki-5);i<=ki;i++)kickList.push({t:kicks[i],i,col:colOf(base+Math.max(0,lastLE(beats,kicks[i])))});
  const hi=lastLE(highs,t),highList=[];for(let i=Math.max(0,hi-8);i<=hi;i++)highList.push({t:highs[i],i});
  const dt=t-lb, beatInBar=((gi-bar0)%4+4)%4, k=cur?1:.35;
  if(analyser&&cur){analyser.getByteFrequencyData(spec);analyser.getByteTimeDomainData(wave)}
  const words=cur?(title(cur).split(/\s+/).filter(Boolean)):null;
  return{t,playing,hasSong:!!cur,bpm,recent,kickList,highList,beatInBar,beatIdx:gi,barIdx:((barOf(gi)%4)+4)%4,col:colOf(gi),trails:prefs.trails,
    strength:prefs.strength*k*(Game.active?.55:1),
    beatEnv:bi>=0?Math.exp(-dt*7)*k:0, downEnv:bi>=0&&beatInBar===0?Math.exp(-dt*4):0,
    kickEnv:ki>=0?Math.exp(-(t-kicks[ki])*9)*k:0,
    energy:A&&A.energy.length?A.energy[clamp(Math.floor(t*10),0,A.energy.length-1)]:(cur?.6:.2),
    spec:cur&&analyser?spec:idleSpec(t), wave:cur&&analyser?wave:null, words, artist:cur?cur.artist:''};
}
const idleArr=new Uint8Array(256);
function idleSpec(t){for(let i=0;i<256;i++)idleArr[i]=Math.max(0,60+50*Math.sin(t*1.3+i*.21)*Math.sin(i*.05+t*.4));return idleArr}

/* Auto style: picks a calm, medium or intense style from the song's loudness, switching only on a downbeat */
let autoBar=-99, autoMood='', lastDown=-1;
function autoStyle(S){
  if(!prefs.auto||!S.playing||S.beatInBar!==0||S.beatIdx===lastDown)return; lastDown=S.beatIdx;
  const bar=Math.floor(S.beatIdx/4), mood=S.energy<.4?'low':S.energy<.72?'mid':'high';
  if((mood!==autoMood&&bar-autoBar>=8)||bar-autoBar>=16){
    const opts=Visuals.mood[mood].filter(x=>x!==prefs.style), pick=opts[(Math.random()*opts.length)|0]||Visuals.mood[mood][0];
    autoMood=mood; autoBar=bar; if(pick!==prefs.style){prefs.style=pick;syncSettings();toast(Visuals.names[pick])}
  }
}

const frameHooks=new Set();
let lastBeatShown=-1, lastSecShown=-1;
function frame(now){
  const S=state(now);
  autoStyle(S);
  (Visuals.styles[prefs.style]||Visuals.styles.orb)(ctx,W,H,S);
  for(const f of frameHooks)f(ctx,W,H,S);
  if(S.beatInBar!==lastBeatShown){lastBeatShown=S.beatInBar;$$('.beats i').forEach((d,i)=>d.classList.toggle('on',i===S.beatInBar&&!!cur))}
  $('.beats').style.setProperty('--c',S.col);
  if(cur){const s=Math.floor(audio.currentTime);if(s!==lastSecShown){lastSecShown=s;$('#cur').textContent=fmt(audio.currentTime);
      if(!seeking&&audio.duration)$('#seek').value=Math.round(audio.currentTime/audio.duration*1000);
      $('#bpm').textContent=S.bpm?`${Math.round(S.bpm)} BPM`:'— BPM'}}
  requestAnimationFrame(frame);
}

/* ---------- UI ---------- */
function meta(){if(!cur)return;const A=cur.analysis,by=cur.artist?cur.artist+' · ':'';
  $('#meta').textContent=by+(A?`${Math.round(A.bpm)} BPM`:cur.failed?'Live beat detection':`Finding the beat… ${Math.round((cur.progress||0)*100)}%`)}
const ICON={play:'<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',pause:'<svg viewBox="0 0 24 24"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg>'};
function ui(){const p=!!cur&&!audio.paused;$('#play').innerHTML=p?ICON.pause:ICON.play;$('#play').setAttribute('aria-label',p?'Pause':'Play');
  $('#shuffle').setAttribute('aria-pressed',prefs.shuffle);$('#repeat').setAttribute('aria-pressed',prefs.repeat!=='off');$('#repeat').classList.toggle('one',prefs.repeat==='one');
  $('#repeat').setAttribute('aria-label',{off:'Repeat is off',all:'Repeat all',one:'Repeat this song'}[prefs.repeat]);renderList()}

let menuFor=null;
function renderTabs(){
  $('#tabs').innerHTML=`<button data-view="all" class="${view==='all'?'on':''}">All songs</button>`+
    playlists.map(p=>`<button data-view="${p.id}" class="${view===p.id?'on':''}">${esc(p.name)} <small>${p.songIds.length}</small></button>`).join('')+
    `<button data-newpl class="add">+ New playlist</button>`;
}
function renderList(){
  renderTabs();
  const L=$('#songs'), list=viewSongs();
  $('#plTools').hidden=view==='all';
  if(!list.length){L.innerHTML=`<li class="none">${view==='all'?'No songs yet. Add some from your phone.':'This playlist is empty. Open All songs and use ⋯ to add songs.'}</li>`;return}
  L.innerHTML=list.map(s=>{const A=s.analysis,on=s===cur,a=artUrl(s),st=(s.artist?esc(s.artist)+' · ':'')+(A?`${fmt(A.duration)} · ${Math.round(A.bpm)} BPM`:s.failed?'Live beat only':analyzing===s.id?'Finding the beat…':'Waiting to analyse');
    const menu=menuFor===s.id?`<div class="menu">${playlists.filter(p=>p.id!==view).map(p=>`<button data-addto="${p.id}" data-song="${s.id}">${p.songIds.includes(s.id)?'✓ In':'Add to'} ${esc(p.name)}</button>`).join('')}
      ${view!=='all'?`<button data-unlist="${s.id}">Remove from this playlist</button>`:''}<button class="danger" data-del="${s.id}">Delete song</button></div>`:'';
    return`<li class="${on?'on':''}${on&&!audio.paused?' playing':''}" data-id="${s.id}"><span class="thumb ${a?'':'none'}" ${a?`style="background-image:url('${a}')"`:''}><span class="eq"><i></i><i></i><i></i></span></span>
      <div class="si"><b>${esc(title(s))}</b><small>${st}</small></div><button class="more" data-more="${s.id}" aria-label="More for ${esc(title(s))}">⋯</button>${menu}</li>`}).join('');
}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.newpl!=null){$('#newPl').hidden=false;$('#plName').focus();return}
  view=b.dataset.view==='all'?'all':+b.dataset.view;menuFor=null;buildOrder();renderList()});
$('#newPl').addEventListener('submit',e=>{e.preventDefault();const n=$('#plName').value.trim();if(!n)return;const p={id:Date.now(),name:n.slice(0,40),songIds:[]};
  playlists.push(p);savePl();$('#plName').value='';$('#newPl').hidden=true;view=p.id;buildOrder();renderList();toast(`Playlist "${p.name}" made`)});
$('#plCancel').onclick=()=>{$('#newPl').hidden=true};
$('#plDelete').onclick=e=>{const b=e.currentTarget;if(!b.dataset.armed){b.dataset.armed=1;b.textContent='Tap again to delete playlist';setTimeout(()=>{delete b.dataset.armed;b.textContent='Delete playlist'},2500);return}
  playlists=playlists.filter(p=>p.id!==view);savePl();view='all';delete b.dataset.armed;b.textContent='Delete playlist';buildOrder();renderList()};
$('#songs').addEventListener('click',async e=>{
  const more=e.target.closest('[data-more]'),add=e.target.closest('[data-addto]'),un=e.target.closest('[data-unlist]'),d=e.target.closest('[data-del]');
  if(more){menuFor=menuFor==+more.dataset.more?null:+more.dataset.more;renderList();return}
  if(add){const p=playlists.find(x=>x.id==add.dataset.addto),id=+add.dataset.song;if(p.songIds.includes(id))p.songIds=p.songIds.filter(x=>x!==id);else p.songIds.push(id);savePl();renderList();return}
  if(un){const p=playlists.find(x=>x.id===view);p.songIds=p.songIds.filter(x=>x!=un.dataset.unlist);savePl();menuFor=null;buildOrder();renderList();return}
  if(d){if(!d.dataset.armed){d.dataset.armed=1;d.textContent='Tap again to delete';return}
    const s=songs.find(x=>x.id==d.dataset.del);if(s===cur){audio.pause();cur=null;audio.removeAttribute('src');$('#ttl').textContent='Pick a song';$('#meta').textContent='';$('#art').style.backgroundImage='';$('#art').classList.add('none')}
    playlists.forEach(p=>p.songIds=p.songIds.filter(x=>x!==s.id));savePl();menuFor=null;await lib.del(s.id);await refresh();return}
  const li=e.target.closest('li[data-id]');if(li&&!e.target.closest('.menu')){play(songs.find(x=>x.id==li.dataset.id));buildOrder();sheet(null)}});
$('#play').onclick=toggle; $('#next').onclick=next; $('#prev').onclick=prev;
$('#shuffle').onclick=()=>{prefs.shuffle=!prefs.shuffle;savePrefs();buildOrder();ui();toast(prefs.shuffle?'Shuffle on':'Shuffle off')};
$('#repeat').onclick=()=>{prefs.repeat={all:'one',one:'off',off:'all'}[prefs.repeat];savePrefs();ui();toast({all:'Repeat all',one:'Repeat this song',off:'Repeat off'}[prefs.repeat])};
let seeking=false; const seek=$('#seek');
seek.addEventListener('input',()=>{seeking=true;if(audio.duration)$('#cur').textContent=fmt(seek.value/1000*audio.duration)});
seek.addEventListener('change',()=>{if(audio.duration)audio.currentTime=seek.value/1000*audio.duration;seeking=false});

/* sheets */
function sheet(id){$$('.sheet').forEach(s=>s.classList.toggle('open',s.id===id));$('#scrim').classList.toggle('on',!!id);if(id)immersive(false);if(id!=='libSheet'){menuFor=null}}
$('#lib').onclick=()=>{renderList();sheet('libSheet')}; $('#openSettings').onclick=()=>sheet('setSheet'); $('#scrim').onclick=()=>{if(!Game.blocking())sheet(null)};
$$('[data-close]').forEach(b=>b.onclick=()=>sheet(null));
const styleIds=Object.keys(Visuals.styles);
$('#styleBtn').onclick=()=>{prefs.style=styleIds[(styleIds.indexOf(prefs.style)+1)%styleIds.length];if(prefs.auto)prefs.auto=false;savePrefs();syncSettings();toast(Visuals.names[prefs.style])};

/* settings */
$('#setStyle').innerHTML=styleIds.map(id=>`<button data-v="${id}">${Visuals.names[id]}</button>`).join('');
function syncSettings(){
  $$('#setStyle button').forEach(b=>b.classList.toggle('on',b.dataset.v===prefs.style));
  $('#setAuto').setAttribute('aria-checked',prefs.auto); $('#setTrails').setAttribute('aria-checked',prefs.trails);
  $('#setOffset').value=prefs.offset; $('#offVal').textContent=(prefs.offset>0?'+':'')+prefs.offset+' ms';
  $('#setStrength').value=prefs.strength; $('#strVal').textContent=Math.round(prefs.strength*100)+'%';
}
$('#setStyle').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;prefs.style=b.dataset.v;prefs.auto=false;savePrefs();syncSettings()});
$('#setAuto').onclick=()=>{prefs.auto=!prefs.auto;autoBar=-99;savePrefs();syncSettings()};
$('#setTrails').onclick=()=>{prefs.trails=!prefs.trails;savePrefs();syncSettings()};
$('#setOffset').oninput=e=>{prefs.offset=+e.target.value;savePrefs();syncSettings()};
$('#setStrength').oninput=e=>{prefs.strength=+e.target.value;savePrefs();syncSettings()};

/* immersive mode: controls fade while music plays */
let idleT=0;
function immersive(on){if(Game.active)on=false;$('#app').classList.toggle('immersive',on)}
function idleSoon(){clearTimeout(idleT);if(!audio.paused&&!document.querySelector('.sheet.open')&&!Game.active)idleT=setTimeout(()=>immersive(true),3500)}
cv.addEventListener('pointerdown',()=>{if(Game.active)return;const on=$('#app').classList.contains('immersive');immersive(!on);if(on)idleSoon()});
['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,e=>{if(e.target!==cv){immersive(false);idleSoon()}},{passive:true}));
document.addEventListener('keydown',e=>{if(e.target.closest('input')||Game.active)return;if(e.code==='Space'){e.preventDefault();toggle()}
  else if(e.key==='ArrowRight'&&cur)audio.currentTime+=5;else if(e.key==='ArrowLeft'&&cur)audio.currentTime-=5;else if(e.key==='Escape')sheet(null)});

let toastT=0; function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('on'),2200)}

/* ---------- Demo beat (generated on the device, 118 BPM) ---------- */
$('#demo').onclick=async()=>{
  const b=$('#demo'); b.disabled=true; b.textContent='Making the demo…';
  try{const blob=await makeDemo();const s={id:Date.now(),name:'Demo beat (sample)',title:'Demo beat',artist:'Sample',size:blob.size,added:Date.now(),blob,analysis:null};await lib.put(s);await refresh();play(s);pump()}
  catch(e){toast('Couldn\'t make the demo on this browser.')}
  b.disabled=false; b.textContent='Play the demo beat';
};
async function makeDemo(){
  const sr=44100,bpm=118,beat=60/bpm,bars=24,len=bars*4*beat+1,C=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  const o=new C(1,Math.ceil(sr*len),sr), out=o.createGain(); out.gain.value=.8; out.connect(o.destination);
  const nb=o.createBuffer(1,sr*.5,sr),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  const env=(g,t,p,d)=>{g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(p,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+d)};
  const kick=t=>{const s=o.createOscillator(),g=o.createGain();s.frequency.setValueAtTime(150,t);s.frequency.exponentialRampToValueAtTime(45,t+.12);s.connect(g);g.connect(out);env(g,t,1,.32);s.start(t);s.stop(t+.4)};
  const noise=(t,d,p,f,type)=>{const s=o.createBufferSource(),fl=o.createBiquadFilter(),g=o.createGain();s.buffer=nb;fl.type=type;fl.frequency.value=f;s.connect(fl);fl.connect(g);g.connect(out);env(g,t,p,d);s.start(t);s.stop(t+d+.05)};
  const tone=(t,f,d,p,type,cut)=>{const s=o.createOscillator(),g=o.createGain(),fl=o.createBiquadFilter();s.type=type;s.frequency.value=f;fl.type='lowpass';fl.frequency.value=cut;s.connect(fl);fl.connect(g);g.connect(out);env(g,t,p,d);s.start(t);s.stop(t+d+.05)};
  const hz=m=>440*Math.pow(2,(m-69)/12), prog=[45,41,48,43];
  for(let b=0;b<bars;b++)for(let q=0;q<4;q++){const t=(b*4+q)*beat+.05,r=prog[b%4],busy=b>=8&&b<20;
    kick(t); if(q%2)noise(t,.18,.45,1900,'bandpass'); noise(t+beat/2,.05,.18,8000,'highpass'); if(busy){noise(t,.04,.1,8000,'highpass');kick(t+beat*.75)}
    tone(t,hz(r-12),beat*.9,.35,'sawtooth',600); if(b>=4&&q===0)[0,3,7].forEach(k=>tone(t,hz(r+12+k),beat*3.6,.07,'triangle',3000));}
  const buf=await new Promise((res,rej)=>{const p=o.startRendering();if(p&&p.then)p.then(res,rej);else o.oncomplete=e=>res(e.renderedBuffer)});
  return wav(buf.getChannelData(0),sr);
}
function wav(d,sr){const n=d.length,b=new ArrayBuffer(44+n*2),v=new DataView(b),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
  w(0,'RIFF');v.setUint32(4,36+n*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*2,true);
  for(let i=0;i<n;i++)v.setInt16(44+i*2,clamp(d[i],-1,1)*32767,true);return new Blob([b],{type:'audio/wav'})}

/* ---------- Phone integration: lock-screen controls, screen wake lock, install ---------- */
function mediaMeta(){try{if(!('mediaSession'in navigator)||!cur)return;const a=artUrl(cur);
  navigator.mediaSession.metadata=new MediaMetadata({title:title(cur),artist:cur.artist||'Senritha\'s Rhythm',artwork:a?[{src:a,sizes:'512x512',type:cur.art.type}]:[]});
  const m=navigator.mediaSession;m.setActionHandler('play',toggle);m.setActionHandler('pause',toggle);m.setActionHandler('nexttrack',next);m.setActionHandler('previoustrack',prev)}catch(e){}}
let lock=null;
async function wake(on){try{if(on&&!lock&&navigator.wakeLock){lock=await navigator.wakeLock.request('screen');lock.addEventListener('release',()=>lock=null)}else if(!on&&lock){lock.release();lock=null}}catch(e){lock=null}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!audio.paused)wake(true)});
let installEvt=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;$('#installBtn').hidden=false;$('#installHint').hidden=true});
$('#installBtn').onclick=async()=>{if(!installEvt)return;installEvt.prompt();await installEvt.userChoice.catch(()=>{});installEvt=null;$('#installBtn').hidden=true};
if(/iphone|ipad|ipod/i.test(navigator.userAgent))$('#installHint').textContent='On iPhone: open this page in Safari, tap Share, then Add to Home Screen.';
if(matchMedia('(display-mode: standalone)').matches)$('#installRow').hidden=true;
try{if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{})}catch(e){}

/* ---------- API for game.js and clip.js ---------- */
const listeners={}; function emit(n,a){(listeners[n]||[]).forEach(f=>f(a))}
const endHooks=[]; function hooksEnd(){return endHooks.some(f=>f())}
const Game={active:false,blocking:()=>false};   // replaced by game.js
window.Rhythm={audio,prefs,savePrefs,toast,sheet,vib,esc,fmt,title,artUrl,songTime,ensureGraph,
  get ac(){return ac},get cur(){return cur},get recDest(){return recDest},canvas:cv,size:()=>({W,H}),
  frameHooks,endHooks,on(n,f){(listeners[n]=listeners[n]||[]).push(f)},
  setGame(g){Object.assign(Game,g)},Game,immersive,play,ui};

/* ---------- Start ---------- */
resize(); syncSettings(); ui();
refresh().then(()=>{if(songs.length){load(songs[songs.length-1]);buildOrder();pump()}});
requestAnimationFrame(frame);
})();
