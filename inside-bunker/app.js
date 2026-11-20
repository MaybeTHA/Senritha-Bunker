/* Inside Bunker — personal OS shell for Senritha-Bunker.
   Everything shown is real: app list, launches recorded on this device, Work Space data read from its own
   IndexedDB (read-only), and storage reported by the browser. Nothing is sent anywhere. */
(()=>{
'use strict';

/* ---------- Apps ---------- */
const CATS=['Productivity','System','Music','3D Worlds'];
const G={ /* two-tone glyphs: white strokes + one blue accent (.a) */
  workspace:'<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><path class="a" d="M8 12.5h8M8 15.5h5"/>',
  os:'<rect x="7" y="3" width="10" height="18" rx="2.6"/><path class="a" d="M10 7.5h.01M14 7.5h.01M10 11h.01M14 11h.01"/><path d="M11 18h2"/>',
  rhythm:'<path d="M5 4v16M10 4v16M15 4v16M20 4v16" opacity=".45"/><path class="a" d="M3.5 8h3M8.5 13h3M13.5 6h3M18.5 16h3"/>',
  solaris:'<circle cx="12" cy="12" r="4.2"/><ellipse class="a" cx="12" cy="12" rx="10" ry="3.6" transform="rotate(-22 12 12)"/>',
  motorhome:'<path d="M2.5 16.5V8a2 2 0 0 1 2-2h10.2l4.3 4.5h1a1.5 1.5 0 0 1 1.5 1.5v4.5h-2"/><path d="M9 16.5h6"/><circle cx="6.8" cy="16.8" r="1.9"/><circle cx="17.2" cy="16.8" r="1.9"/><path class="a" d="M6 9.5h4.5M14 9.5h3.2"/>',
  summit:'<path d="M2.5 20 10 7.5l3.5 5.5 2.5-3.5 5.5 10.5z"/><path d="M15 9.5V3.5"/><path class="a" d="M15.5 3.5h4l-1.2 1.5 1.2 1.5h-4"/>',
  perf:'<path d="M4 17.5a8 8 0 1 1 16 0"/><path d="M7 17.5h.01M17 17.5h.01M12 9.5v.01" opacity=".6"/><path class="a" d="m12 17.5 4.2-5.2"/>',
  clips:'<rect x="3" y="4.5" width="18" height="12.5" rx="2.5"/><path d="M9 20h6"/><circle class="a" cx="12" cy="10.75" r="2.6"/>',
};
const APPS=[
  {id:'workspace',href:'senritha-workspace/',name:"Senritha's Work Space",desc:'Channels, sub-channels, messages and images. Saved on this device.',cat:'Productivity'},
  {id:'os',href:'senritha-os/',name:'Senritha OS',desc:'Phone OS-style web app: lock screen, home screen, app switcher and an App Store.',cat:'System'},
  {id:'rhythm',href:'senritha-rhythm/',name:"Senritha's Rhythm",desc:'Beat visualizer and 4-lane rhythm game for the songs on your phone.',cat:'Music'},
  {id:'solaris',href:'senritha-solaris/',name:"Senritha's Solaris X3D",desc:'Real-time interactive 3D explorer of the Solar System.',cat:'3D Worlds'},
  {id:'motorhome',href:'senritha-motorhome/',name:"Senritha's Motorhome 3D",desc:'Walk through a luxury motorhome parked in a snowy forest at blue hour.',cat:'3D Worlds'},
  {id:'summit',href:'senritha-summit/',name:"Senritha's Last Summit X3D",desc:'Climb from a warm mountain cabin to a red flag on a snowy summit: sunrise, clear afternoon or aurora, light or strong wind.',cat:'3D Worlds'},
  {id:'perf',href:'senritha-perf/',name:"Senritha's Test Performance",desc:'WebGL2 graphics benchmark: GPU, CPU and frame pacing, measured.',cat:'System'},
  {id:'clips',href:'senritha-clips/',name:"Senritha's Random Clips",desc:'Long screen-recording sessions that save short clips at random moments. Every timing is yours to set.',cat:'Productivity'},
];
const byId=Object.fromEntries(APPS.map(a=>[a.id,a]));
const slug=c=>c.toLowerCase().replace(/[^a-z0-9]+/g,'-');
const catBySlug=Object.fromEntries(CATS.map(c=>[slug(c),c]));

/* ---------- Storage (per device) ---------- */
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const K={recent:'ib.recent',fav:'ib.fav',view:'ib.view',rail:'ib.rail',prefs:'ws.prefs'}; /* ws.prefs is shared with Work Space */
const COLORS=['#57524A','#B4532A','#3F7A5E','#8A560C','#3B6A8F','#7A4E7E','#A23E48','#2F2C28']; /* same choices as Work Space */
const S={
  recent:store.get(K.recent,[]).filter(r=>byId[r.id]),
  fav:store.get(K.fav,[]).filter(id=>byId[id]),
  view:store.get(K.view,'grid')==='list'?'list':'grid',
  rail:!!store.get(K.rail,false),
};
const prefs=()=>Object.assign({name:'Senritha',color:'#57524A'},store.get(K.prefs,{}));
function setPrefs(patch){store.set(K.prefs,Object.assign(store.get(K.prefs,{}),patch))}

/* ---------- Helpers ---------- */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const I={
  arrow:'<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  chev:'<svg class="chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  star:'<svg viewBox="0 0 24 24"><path d="m12 4.5 2.3 4.7 5.2.8-3.8 3.6.9 5.2L12 16.4l-4.6 2.4.9-5.2-3.8-3.6 5.2-.8z"/></svg>',
  grid:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></svg>',
  list:'<svg viewBox="0 0 24 24"><path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/></svg>',
  clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/></svg>',
  apps:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></svg>',
  chat:'<svg viewBox="0 0 24 24"><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V16h0a2 2 0 0 1-2-2z"/></svg>',
  disk:'<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6.5" rx="7" ry="2.5"/><path d="M5 6.5v11c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-11M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/></svg>',
};
const icon=(a,cls='')=>`<span class="icon ${cls}" aria-hidden="true"><svg viewBox="0 0 24 24">${G[a.id]}</svg></span>`;
const rtf=new Intl.RelativeTimeFormat('en',{numeric:'auto'});
function ago(t){const s=(Date.now()-t)/1000;
  if(s<45)return 'Just now';
  for(const[u,n]of[['minute',60],['hour',3600],['day',86400],['week',604800],['month',2629800],['year',31557600]].reverse()){if(s>=n)return rtf.format(-Math.floor(s/n),u)}
  return rtf.format(-Math.max(1,Math.round(s/60)),'minute')}
const lastOpened=id=>{const r=S.recent.find(x=>x.id===id);return r?r.t:0};
function fmtBytes(b){if(b<1024)return b+' B';const u=['KB','MB','GB','TB'];let i=-1;do{b/=1024;i++}while(b>=1024&&i<u.length-1);return(b<10?b.toFixed(1):Math.round(b))+' '+u[i]}
let toastT;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2200)}
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Rendering pieces ---------- */
function card(a){const f=S.fav.includes(a.id);return`<article class="card" data-id="${a.id}">
  <a class="card-link" href="${a.href}" data-launch="${a.id}" aria-label="Open ${esc(a.name)}"></a>
  <div class="card-top">${icon(a)}<button class="fav" data-fav="${a.id}" aria-pressed="${f}" aria-label="${f?'Remove from':'Add to'} favorites" title="${f?'Remove from favorites':'Add to favorites'}">${I.star}</button></div>
  <div><h3>${esc(a.name)}</h3><p>${esc(a.desc)}</p></div>
  <div class="card-foot"><span class="tag">${a.cat}</span><span class="open-hint">Open ${I.arrow}</span></div>
</article>`}
function row(a){const f=S.fav.includes(a.id),t=lastOpened(a.id);return`<div class="row" data-id="${a.id}">
  <a class="card-link" href="${a.href}" data-launch="${a.id}" aria-label="Open ${esc(a.name)}"></a>
  ${icon(a,'sm')}<div class="t"><h3>${esc(a.name)}</h3><p>${esc(a.desc)}</p></div>
  <span><span class="tag">${a.cat}</span></span><span class="when">${t?ago(t):'Not opened yet'}</span>
  <button class="fav" data-fav="${a.id}" aria-pressed="${f}" aria-label="${f?'Remove from':'Add to'} favorites" title="${f?'Remove from favorites':'Add to favorites'}">${I.star}</button>${I.chev}
</div>`}
const collection=list=>S.view==='list'?`<div class="list">${list.map(row).join('')}</div>`:`<div class="grid">${list.map(card).join('')}</div>`;
const viewSwitch=()=>`<div class="seg" role="group" aria-label="View">
  <button data-view="grid" aria-pressed="${S.view==='grid'}" title="Grid view">${I.grid}<span>Grid</span></button>
  <button data-view="list" aria-pressed="${S.view==='list'}" title="Compact list view">${I.list}<span>List</span></button></div>`;
function recentStrip(limit){const r=S.recent.slice(0,limit);
  if(!r.length)return`<div class="empty inline">${I.clock}<div><b>No recent apps yet</b><p>Apps you open from Inside Bunker will show up here.</p></div></div>`;
  return`<div class="recent">${r.map(x=>{const a=byId[x.id];return`<a class="recent-item" href="${a.href}" data-launch="${a.id}" title="Open ${esc(a.name)}">${icon(a,'sm')}<span class="t"><b>${esc(a.name.replace(/^Senritha's /,''))}</b><small>${ago(x.t)}</small></span></a>`}).join('')}</div>`}

/* ---------- Views ---------- */
const VIEWS={
  home(){const p=prefs(),now=new Date(),h=now.getHours();
    const part=h<5?'Working late':h<12?'Good morning':h<18?'Good afternoon':'Good evening';
    const week=new Set(S.recent.filter(r=>Date.now()-r.t<6048e5).map(r=>r.id)).size, last=S.recent[0];
    return`<section class="hero">
      <p class="eyebrow"><i></i>${part} · ${now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</p>
      <h1>Welcome back, ${esc(p.name||'Senritha')}.</h1>
      <p class="sub">Your personal workspace is ready.</p>
      <div class="stats">
        <div class="stat"><span class="k">${I.apps}Applications</span><span class="v">${APPS.length}</span><span class="s">${CATS.length} categories</span></div>
        <div class="stat"><span class="k">${I.clock}Opened this week</span><span class="v">${week}</span><span class="s">${last?`Last: ${esc(byId[last.id].name.replace(/^Senritha's /,''))} · ${ago(last.t)}`:'Nothing opened yet'}</span></div>
        <div class="stat" id="statWs"><span class="k">${I.chat}Work Space</span><span class="skel v"></span><span class="skel"></span></div>
        <div class="stat" id="statDisk"><span class="k">${I.disk}Storage</span><span class="skel v"></span><span class="skel"></span></div>
      </div></section>
    <section class="sec"><div class="sec-head"><h2>Recent</h2>${S.recent.length?`<a class="link" href="#recent">See all ${I.arrow}</a>`:''}</div>${recentStrip(8)}</section>
    <section class="sec"><div class="sec-head"><h2>Applications <small>${APPS.length}</small></h2>${viewSwitch()}</div>${collection(APPS)}</section>`},
  apps(arg){const cat=catBySlug[arg]||'';const list=cat?APPS.filter(a=>a.cat===cat):APPS;
    return`<div class="page-head"><div><h1>${cat||'All applications'}</h1><p>${list.length} app${list.length===1?'':'s'}${cat?` in ${cat}`:' installed in your bunker'}.</p></div></div>
    <div class="toolbar"><div class="chips">${['',...CATS].map(c=>`<a class="chip ${c===cat?'on':''}" href="#apps${c?'/'+slug(c):''}">${c||'All'} <b>${c?APPS.filter(a=>a.cat===c).length:APPS.length}</b></a>`).join('')}</div>${viewSwitch()}</div>
    ${collection(list)}`},
  recent(){const list=S.recent.map(r=>byId[r.id]);
    return`<div class="page-head"><div><h1>Recent apps</h1><p>Apps opened from Inside Bunker on this device, newest first.</p></div>${list.length?'<button class="btn" data-act="clear-recent">Clear history</button>':''}</div>
    ${list.length?collection(list):`<div class="empty">${I.clock}<b>No recent apps yet</b><p>Open any app from Home or All applications and it will appear here.</p><a class="btn" href="#apps" style="margin-top:12px;display:inline-flex;align-items:center">Browse apps</a></div>`}`},
  favorites(){const list=S.fav.map(id=>byId[id]);
    return`<div class="page-head"><div><h1>Favorites</h1><p>Your pinned apps.</p></div>${list.length?viewSwitch():''}</div>
    ${list.length?collection(list):`<div class="empty">${I.star}<b>No favorites yet</b><p>Tap the star on any app to pin it here.</p><a class="btn" href="#apps" style="margin-top:12px;display:inline-flex;align-items:center">Browse apps</a></div>`}`},
  categories(){return`<div class="page-head"><div><h1>Categories</h1><p>${APPS.length} apps in ${CATS.length} categories.</p></div>${viewSwitch()}</div>
    ${CATS.map((c,i)=>`<section class="${i?'sec':''}"><div class="sec-head"><h2>${c} <small>${APPS.filter(a=>a.cat===c).length}</small></h2><a class="link" href="#apps/${slug(c)}">Open ${I.arrow}</a></div>${collection(APPS.filter(a=>a.cat===c))}</section>`).join('')}`},
  settings(){const p=prefs();
    return`<div class="page-head"><div><h1>Settings</h1><p>Saved in this browser on this device.</p></div></div>
    <div class="panel"><h2>Profile</h2>
      <div class="field"><div class="lbl"><b>Name</b><small>Shown on Home. Shared with Work Space.</small></div><input class="input" id="setName" maxlength="40" value="${esc(p.name||'')}" placeholder="Senritha" autocomplete="off"></div>
      <div class="field"><div class="lbl"><b>Color</b><small>Your avatar color. Shared with Work Space.</small></div><div class="swatches" id="setColor">${COLORS.map(c=>`<button style="--sw:${c}" data-c="${c}" class="${c===p.color?'on':''}" aria-label="Color ${c}" aria-pressed="${c===p.color}"></button>`).join('')}</div></div>
    </div>
    <div class="panel"><h2>Display</h2>
      <div class="field"><div class="lbl"><b>App layout</b><small>Grid cards or a compact list.</small></div>${viewSwitch()}</div>
      <div class="field desk-only"><div class="lbl"><b>Sidebar</b><small>Full sidebar or icons only (desktop).</small></div><div class="seg" role="group" aria-label="Sidebar"><button data-rail="0" aria-pressed="${!S.rail}">Full</button><button data-rail="1" aria-pressed="${S.rail}">Icons</button></div></div>
    </div>
    <div class="panel"><h2>Data</h2>
      <div class="field"><div class="lbl"><b>Recent apps</b><small>${S.recent.length} app${S.recent.length===1?'':'s'} in history.</small></div><button class="btn danger" data-act="clear-recent" ${S.recent.length?'':'disabled'}>Clear history</button></div>
      <div class="field"><div class="lbl"><b>Favorites</b><small>${S.fav.length} pinned.</small></div><button class="btn danger" data-act="clear-fav" ${S.fav.length?'':'disabled'}>Clear favorites</button></div>
    </div>
    <p class="about">Inside Bunker · ${APPS.length} apps · Your history, favorites and settings stay in this browser and are never uploaded.</p>`},
};

/* ---------- Router (hash, so back/forward work) ---------- */
let route='home',arg='';
function parse(){const h=decodeURIComponent(location.hash.slice(1));const[r,a='']=h.split('/');return{r:VIEWS[r]?r:'home',a}}
function render(anim=true){
  const v=$('#view');v.innerHTML=VIEWS[route](arg);
  if(anim&&!reduced){v.classList.remove('enter');void v.offsetWidth;v.classList.add('enter')}
  $$('[data-route]').forEach(n=>{const on=n.dataset.route===route;n.classList.toggle('on',on);on?n.setAttribute('aria-current','page'):n.removeAttribute('aria-current')});
  $$('#sideCats a').forEach(n=>n.classList.toggle('on',route==='apps'&&n.dataset.cat===arg));
  $('#navFav').textContent=S.fav.length||'';
  document.title=route==='home'?'Inside Bunker':`${({apps:'Applications',recent:'Recent',favorites:'Favorites',categories:'Categories',settings:'Settings'})[route]} · Inside Bunker`;
  if(route==='home')fillStats();
  if(route==='settings')bindSettings();
}
function go(){const{r,a}=parse();const changed=r!==route||a!==arg;route=r;arg=a;render(changed);if(changed)$('#main').scrollTop=0;closeSide()}
window.addEventListener('hashchange',go);

/* ---------- Live stats (real data only) ---------- */
async function fillStats(){
  const ws=$('#statWs'),dk=$('#statDisk');
  /* Work Space: read its database only if it already exists, so we never create an empty one. */
  let html=`<span class="k">${I.chat}Work Space</span><span class="v">Not set up</span><span class="s">Open Work Space to start</span>`;
  try{
    if(indexedDB.databases){const dbs=await indexedDB.databases();
      if(dbs.some(d=>d.name==='senritha-workspace')){
        const db=await new Promise((res,rej)=>{const r=indexedDB.open('senritha-workspace');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);r.onupgradeneeded=()=>{r.transaction.abort()}});
        const n=s=>new Promise(res=>{try{const q=db.transaction(s,'readonly').objectStore(s).count();q.onsuccess=()=>res(q.result);q.onerror=()=>res(0)}catch(e){res(0)}});
        const [c,m]=await Promise.all([n('channels'),n('messages')]);db.close();
        html=`<span class="k">${I.chat}Work Space</span><span class="v">${c} channel${c===1?'':'s'}</span><span class="s">${m} message${m===1?'':'s'} saved</span>`;
      }
    }else html=`<span class="k">${I.chat}Work Space</span><span class="v">Ready</span><span class="s">Details not available in this browser</span>`;
  }catch(e){}
  if(ws.isConnected)ws.innerHTML=html;
  /* Storage: what this site uses on this device, as reported by the browser. */
  try{if(navigator.storage&&navigator.storage.estimate){const{usage=0,quota=0}=await navigator.storage.estimate();
    if(dk.isConnected)dk.innerHTML=`<span class="k">${I.disk}Storage</span><span class="v">${fmtBytes(usage)}</span><span class="s">${quota?`of ${fmtBytes(quota)} on this device`:'used on this device'}</span>${quota?`<span class="meter"><i style="width:${Math.min(100,usage/quota*100).toFixed(2)}%"></i></span>`:''}`;
  }else if(dk.isConnected)dk.remove()}catch(e){if(dk.isConnected)dk.remove()}
}

/* ---------- Launching ---------- */
function record(id){S.recent=[{id,t:Date.now()},...S.recent.filter(r=>r.id!==id)].slice(0,12);store.set(K.recent,S.recent)}
document.addEventListener('click',e=>{
  const l=e.target.closest('[data-launch]');if(!l)return;
  const a=byId[l.dataset.launch];record(a.id);
  if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||reduced)return; /* new tab etc.: let the browser handle it */
  e.preventDefault();launch(a);
});
function launch(a){
  closePalette(true);
  $('#launchIcon').innerHTML=icon(a,'lg');$('#launchName').textContent=`Opening ${a.name}`;$('#launch').hidden=false;
  setTimeout(()=>{location.href=a.href},220);
}
/* Coming back with the back button (page restored from cache): hide the overlay and refresh times. */
window.addEventListener('pageshow',e=>{$('#launch').hidden=true;S.recent=store.get(K.recent,[]).filter(r=>byId[r.id]);if(e.persisted)render(false)});

/* ---------- Favorites, view mode, actions ---------- */
document.addEventListener('click',e=>{
  const f=e.target.closest('[data-fav]');
  if(f){e.preventDefault();const id=f.dataset.fav,on=!S.fav.includes(id);S.fav=on?[...S.fav,id]:S.fav.filter(x=>x!==id);store.set(K.fav,S.fav);
    toast(on?`${byId[id].name} added to favorites`:`Removed from favorites`);render(false);return}
  const v=e.target.closest('[data-view]');
  if(v){S.view=v.dataset.view;store.set(K.view,S.view);render(false);return}
  const r=e.target.closest('[data-rail]');
  if(r){setRail(r.dataset.rail==='1');render(false);return}
  const act=e.target.closest('[data-act]');
  if(act){if(act.dataset.act==='clear-recent'){S.recent=[];store.set(K.recent,[]);toast('Recent history cleared')}
    if(act.dataset.act==='clear-fav'){S.fav=[];store.set(K.fav,[]);toast('Favorites cleared')}
    render(false)}
});

/* ---------- Settings ---------- */
function bindSettings(){
  const n=$('#setName');let t;
  n.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>{setPrefs({name:n.value.trim()||'Senritha'});paintAvatar()},250)});
  n.addEventListener('change',()=>toast('Name saved'));
  $('#setColor').addEventListener('click',e=>{const b=e.target.closest('[data-c]');if(!b)return;setPrefs({color:b.dataset.c});
    $$('#setColor button').forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)});paintAvatar()});
}
function paintAvatar(){const p=prefs(),a=$('#avatar');a.textContent=(p.name||'S').trim().charAt(0).toUpperCase()||'S';a.style.setProperty('--av',p.color)}

/* ---------- Sidebar ---------- */
const os=$('#os'),wide=matchMedia('(min-width:1024px)');
function setRail(v){S.rail=v;store.set(K.rail,v);os.classList.toggle('rail',v)}
function closeSide(){os.classList.remove('open')}
$('#sideToggle').addEventListener('click',()=>{if(wide.matches)setRail(!S.rail);else os.classList.toggle('open')});
$('#sideScrim').addEventListener('click',closeSide);
wide.addEventListener('change',closeSide);
$('#sideCats').innerHTML=CATS.map(c=>`<a href="#apps/${slug(c)}" data-cat="${slug(c)}">${c}<b>${APPS.filter(a=>a.cat===c).length}</b></a>`).join('');
$('#navCount').textContent=APPS.length;

/* ---------- Search palette ---------- */
const pal=$('#palette'),q=$('#q'),res=$('#results');let qCat='',sel=0,hits=[],lastFocus=null;
$('#qCats').innerHTML=['',...CATS].map(c=>`<button class="chip ${c===''?'on':''}" data-qcat="${c}" type="button">${c||'All'}</button>`).join('');
function mark(s,t){if(!t)return esc(s);const i=s.toLowerCase().indexOf(t);return i<0?esc(s):esc(s.slice(0,i))+'<mark>'+esc(s.slice(i,i+t.length))+'</mark>'+esc(s.slice(i+t.length))}
function search(){
  const t=q.value.trim().toLowerCase();
  hits=APPS.filter(a=>!qCat||a.cat===qCat).map(a=>{const n=a.name.toLowerCase(),d=a.desc.toLowerCase();
    let s=!t?1:n.startsWith(t)||n.replace(/^senritha's /,'').startsWith(t)?4:n.includes(t)?3:a.cat.toLowerCase().includes(t)?2:d.includes(t)?1:0;
    return{a,s}}).filter(x=>x.s>0).sort((x,y)=>y.s-x.s||lastOpened(y.a.id)-lastOpened(x.a.id)).map(x=>x.a);
  sel=Math.min(sel,Math.max(0,hits.length-1));
  res.innerHTML=hits.length?hits.map((a,i)=>`<div class="res ${i===sel?'on':''}" role="option" id="res-${a.id}" aria-selected="${i===sel}" data-i="${i}">${icon(a,'xs')}<span class="t"><b>${mark(a.name,t)}</b><small>${mark(a.desc,t)}</small></span><span class="tag">${a.cat}</span><span class="enter"><kbd>↵</kbd></span></div>`).join('')
    :`<div class="res-empty">No apps match “${esc(q.value.trim())}”${qCat?` in ${qCat}`:''}.</div>`;
  q.setAttribute('aria-activedescendant',hits[sel]?'res-'+hits[sel].id:'');
}
function move(d){if(!hits.length)return;sel=(sel+d+hits.length)%hits.length;$$('.res',res).forEach((r,i)=>{r.classList.toggle('on',i===sel);r.setAttribute('aria-selected',i===sel)});
  q.setAttribute('aria-activedescendant','res-'+hits[sel].id);$$('.res',res)[sel].scrollIntoView({block:'nearest'})}
function openPalette(){if(!pal.hidden)return;lastFocus=document.activeElement;pal.hidden=false;pal.classList.remove('closing');q.value='';sel=0;search();requestAnimationFrame(()=>q.focus())}
function closePalette(now){if(pal.hidden)return;if(now||reduced){pal.hidden=true;return}
  pal.classList.add('closing');setTimeout(()=>{pal.hidden=true;pal.classList.remove('closing')},140);if(lastFocus&&lastFocus.focus)lastFocus.focus()}
q.addEventListener('input',()=>{sel=0;search()});
q.addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'){e.preventDefault();move(1)}
  else if(e.key==='ArrowUp'){e.preventDefault();move(-1)}
  else if(e.key==='Enter'){e.preventDefault();const a=hits[sel];if(a){record(a.id);if(e.metaKey||e.ctrlKey){window.open(a.href,'_blank');closePalette()}else if(reduced)location.href=a.href;else launch(a)}}
});
res.addEventListener('mousemove',e=>{const r=e.target.closest('.res');if(r&&+r.dataset.i!==sel){sel=+r.dataset.i;move(0)}});
res.addEventListener('click',e=>{const r=e.target.closest('.res');if(!r)return;const a=hits[+r.dataset.i];record(a.id);reduced?location.href=a.href:launch(a)});
$('#qCats').addEventListener('click',e=>{const c=e.target.closest('[data-qcat]');if(!c)return;qCat=c.dataset.qcat;$$('#qCats .chip').forEach(x=>x.classList.toggle('on',x===c));sel=0;search();q.focus()});
pal.addEventListener('click',e=>{if(e.target.matches('[data-close]'))closePalette()});
pal.addEventListener('keydown',e=>{if(e.key==='Tab'){const f=[q,...$$('#qCats .chip')];const i=f.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();q.focus()}}});
$('#searchOpen').addEventListener('click',openPalette);$('#searchOpen2').addEventListener('click',openPalette);
const mac=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);$('#kbdHint').textContent=mac?'⌘K':'Ctrl K';
document.addEventListener('keydown',e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();pal.hidden?openPalette():closePalette();return}
  if(e.key==='Escape'){if(!pal.hidden){e.preventDefault();closePalette()}else if(!$('#notifPop').hidden)toggleNotif(false);else closeSide();return}
  if(e.key==='/'&&pal.hidden&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();openPalette()}
});

/* ---------- Notifications ---------- */
const nb=$('#notifBtn'),np=$('#notifPop');
function toggleNotif(v){np.hidden=!v;nb.setAttribute('aria-expanded',v)}
nb.addEventListener('click',e=>{e.stopPropagation();toggleNotif(np.hidden)});
document.addEventListener('click',e=>{if(!np.hidden&&!e.target.closest('.pop-wrap'))toggleNotif(false)});

/* ---------- System bar: clock + connection ---------- */
function tick(){const d=new Date();
  const t=d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),ds=d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
  if($('#clockTime').textContent!==t)$('#clockTime').textContent=t;if($('#clockDate').textContent!==ds)$('#clockDate').textContent=ds;
  $('#clock').dateTime=d.toISOString();$('#clock').dataset.tip=d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
tick();setInterval(tick,1000);
function net(){const on=navigator.onLine,s=$('#status');s.classList.toggle('off',!on);s.querySelector('span').textContent=on?'Online':'Offline';
  s.dataset.tip=on?'Connected':'No connection: apps you have opened before may still work'}
net();addEventListener('online',net);addEventListener('offline',net);

/* ---------- Start ---------- */
os.classList.toggle('rail',S.rail);
paintAvatar();
const st=parse();route=st.r;arg=st.a;render(true);
})();
