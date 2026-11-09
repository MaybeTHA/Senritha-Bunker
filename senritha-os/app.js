(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const vib=p=>{try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}};
const store={get(k,d){try{const v=localStorage.getItem('senritha.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
             set(k,v){try{localStorage.setItem('senritha.'+k,JSON.stringify(v))}catch(e){}}};
const DEF={theme:'system',accent:'#1F8A70',wall:0,reduce:false,speed:1,fps:false,bright:1,vol:.6,cc:{wifi:true,bt:true,air:false,dnd:false}};
const prefs=Object.assign({},DEF,store.get('prefs',{})); prefs.cc=Object.assign({},DEF.cc,prefs.cc);
const savePrefs=()=>store.set('prefs',prefs);
const root=document.documentElement, device=$('#device');

/* ---------- Spring physics engine (one rAF for everything, transforms only) ---------- */
const active=new Set(), dirty=new Set(), resting=new Set(); let rafId=0,last=0,inTick=false;
class Spring{
  constructor(v,owner,eps){this.v=v;this.t=v;this.vel=0;this.owner=owner;this.eps=eps;this.k=200;this.c=25}
  to(t,o={}){let r=o.resp||.42,z=o.damp==null?.86:o.damp; if(prefs.reduce){r=.22;z=1}
    const w=2*Math.PI/r; this.k=w*w; this.c=2*z*w; this.t=t; if(o.vel!=null)this.vel=o.vel; active.add(this); kick(); return this}
  set(v){this.v=this.t=v;this.vel=0;active.delete(this);dirty.add(this.owner);kick();return this}
  get moving(){return active.has(this)}
}
function kick(){if(!rafId&&!inTick){last=performance.now();rafId=requestAnimationFrame(tick)}}
function tick(now){
  rafId=0; inTick=true; const dt=Math.min(.05,Math.max(0,(now-last)/1000))*prefs.speed; last=now;
  const n=Math.max(1,Math.ceil(dt/.004)), h=dt/n;
  for(const s of active){
    for(let i=0;i<n;i++){const a=-s.k*(s.v-s.t)-s.c*s.vel; s.vel+=a*h; s.v+=s.vel*h}
    dirty.add(s.owner);
    if(Math.abs(s.v-s.t)<s.eps&&Math.abs(s.vel)<s.eps*12){s.v=s.t;s.vel=0;active.delete(s);resting.add(s.owner)}
  }
  for(const o of dirty)o.apply(); dirty.clear();
  for(const o of resting){ if(o.onRest&&!o.springs.some(s=>s.moving)){const f=o.onRest;o.onRest=null;f()} } resting.clear();
  inTick=false; if(active.size||dirty.size)rafId=requestAnimationFrame(tick);
}
function entity(apply,specs){const o={apply,onRest:null,springs:[]};for(const[k,v,e]of specs){o[k]=new Spring(v,o,e);o.springs.push(o[k])}return o}
const loopFns=new Set(); let loopId=0;
function loopRun(t){loopId=0;for(const f of loopFns)f(t);if(loopFns.size)loopId=requestAnimationFrame(loopRun)}
const loop={add(f){loopFns.add(f);if(!loopId)loopId=requestAnimationFrame(loopRun)},del(f){loopFns.delete(f)}};

/* ---------- Geometry ---------- */
let W=390,H=844,SC=.66,spacing=300,ccH=420,cardY=-25;
function measure(){const r=device.getBoundingClientRect();W=r.width;H=r.height;SC=.66;spacing=W*SC+16;cardY=-H*.03;ccH=$('#cc').offsetHeight||420}

/* ---------- Icons & apps ---------- */
const G_={
  settings:'<svg viewBox="0 0 24 24"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/></svg>',
  clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  calculator:'<svg viewBox="0 0 24 24"><rect x="5.5" y="3" width="13" height="18" rx="3"/><path d="M9 7.5h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01"/></svg>',
  notes:'<svg viewBox="0 0 24 24"><path d="M6.5 3.5h7.5l4 4v13h-11.5z"/><path d="M14 3.5v4h4M9.5 12.5h5M9.5 16h5"/></svg>',
  tips:'<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>'
};
const calGlyph=()=>{const d=new Date();return `<div class="calg"><small>${d.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase()}</small><b>${d.getDate()}</b></div>`};
const APPS={
  settings:{name:'Settings',bg:'#5A646E',fg:'#fff'},
  clock:{name:'Clock',bg:'#17191B',fg:'#fff'},
  calculator:{name:'Calculator',bg:'#EE8A2A',fg:'#fff'},
  notes:{name:'Notes',bg:'#F2C230',fg:'#2B2414'},
  calendar:{name:'Calendar',bg:'#FFFFFF',fg:'#111614'},
  tips:{name:'Tips',bg:'#1F8A70',fg:'#fff'}
};
const glyph=id=>id==='calendar'?calGlyph():G_[id];
function iconHTML(id,label=true){const a=APPS[id];
  return `<div class="icon" data-app="${id}" role="button" tabindex="0" aria-label="${a.name}"><div class="glyph" style="background:${a.bg};color:${a.fg}">${glyph(id)}</div>${label?`<span>${a.name}</span>`:''}</div>`}
$('#p1icons').innerHTML=['calendar','tips'].map(i=>iconHTML(i)).join('');
$('#dock').innerHTML=['notes','calculator','clock','settings'].map(i=>iconHTML(i,false)).join('');

/* ---------- Layer entities ---------- */
const homeEl=$('#home'), pagesEl=$('#pages'), scrimEl=$('#scrim'), winsEl=$('#wins'), lockEl=$('#lock'), ccEl=$('#cc'), ccScrimEl=$('#ccScrim');
let curPage=0;
const home=entity(()=>{
  const z=home.z.v,l=home.l.v, sc=(1-.07*z)*(1+.1*l);
  homeEl.style.transform=`scale(${sc})`; homeEl.style.opacity=1-.3*z;
  pagesEl.style.transform=`translate3d(${home.page.v}px,0,0)`;
  const p=clamp(Math.round(-home.page.v/W),0,1); $$('#dots i').forEach((d,i)=>d.classList.toggle('on',i===p));
},[['z',0,.0005],['l',1,.0005],['page',0,.1]]);
const scrim=entity(()=>{scrimEl.style.opacity=scrim.o.v},[['o',0,.002]]);
const lock=entity(()=>{
  lockEl.style.transform=`translate3d(0,${lock.u.v}px,0)`;
  home.l.set(clamp(1+lock.u.v/H,0,1));
},[['u',0,.1]]);
const cc=entity(()=>{
  const c=cc.c.v; ccEl.style.transform=`translate3d(0,${(Math.min(c,1)-1)*(ccH+30)+Math.max(0,c-1)*ccH}px,0)`;
  ccScrimEl.style.opacity=clamp(c,0,1);
},[['c',0,.0005]]);
const banEl=$('#banner');
const ban=entity(()=>{banEl.style.transform=`translate3d(0,${ban.y.v}px,0)`},[['y',-160,.1]]);

/* ---------- Window manager ---------- */
const state={mode:'home',top:null,stack:[],locked:true,cc:false};
const wins={};
let sx=0;
function makeWin(id){
  const a=APPS[id], el=document.createElement('div'); el.className='win';
  el.innerHTML=`<div class="app"></div><div class="splash" style="background:${a.bg};color:${a.fg}">${glyph(id)}</div>`;
  const appEl=el.firstChild, splash=el.lastChild;
  const w=entity(()=>{
    const p=clamp((w.s.v-w.s0)/(1-w.s0),0,1);
    el.style.transform=`translate3d(${w.x.v}px,${w.y.v}px,0) scale(${w.s.v})`;
    el.style.opacity=Math.min(1,p*4)*w.a.v;
    splash.style.opacity=clamp(1-p*2.2,0,1);
    if(w===state.top&&state.mode!=='switcher')home.z.set(p);
  },[['x',0,.1],['y',0,.1],['s',1,.0004],['a',1,.002]]);
  Object.assign(w,{id,el,s0:.15,vis:false});
  w.api=BUILD[id](appEl,w)||{};
  winsEl.appendChild(el); return w;
}
function setVis(w,on){if(w.vis===on)return;w.vis=on;w.el.style.visibility=on?'visible':'hidden';w.api.visible&&w.api.visible(on)}
function restack(){state.stack.forEach((w,i)=>w.el.style.zIndex=i+1);$('#stApps').textContent=state.stack.length}
function iconRect(id){
  const sc=(1-.07*home.z.v)*(1+.1*home.l.v);
  const dr=device.getBoundingClientRect();
  for(const g of $$(`#home [data-app="${id}"] .glyph`)){
    const r=g.getBoundingClientRect(); const cx=r.left+r.width/2-dr.left, cy=r.top+r.height/2-dr.top;
    const dx=(cx-W/2)/sc, dy=(cy-H/2)/sc;
    if(Math.abs(dx)<W/2&&Math.abs(dy)<H/2)return{dx,dy,s:r.width/sc/W};
  }
  return{dx:0,dy:H*.32,s:60/W};
}
const OPEN={resp:.5,damp:.84}, CLOSE={resp:.46,damp:.9};
function openApp(id){
  if(state.locked)return;
  const w=wins[id]||(wins[id]=makeWin(id)); const st=state.stack, i=st.indexOf(w);
  if(i>=0)st.splice(i,1); st.push(w); restack();
  const r=iconRect(id); w.s0=r.s; w.onRest=null;
  if(!w.vis){w.x.set(r.dx);w.y.set(r.dy);w.s.set(r.s);w.a.set(1);setVis(w,true)}
  state.mode='app'; state.top=w; winsEl.classList.remove('cards');
  w.a.to(1); w.x.to(0,OPEN); w.y.to(0,OPEN); w.s.to(1,OPEN);
  w.onRest=()=>{state.stack.forEach(o=>o!==w&&setVis(o,false))};
  scrim.o.to(0); paint(); vib(6);
}
function goHome(w,v={}){
  state.mode='home'; paint();
  const r=iconRect(w.id); w.s0=r.s;
  w.x.to(r.dx,{...CLOSE,vel:v.x}); w.y.to(r.dy,{...CLOSE,vel:v.y}); w.s.to(r.s,{resp:.46,damp:.96});
  w.onRest=()=>setVis(w,false);
  scrim.o.to(0);
  state.stack.forEach(o=>{if(o!==w&&o.vis){o.a.to(0,{resp:.25,damp:1});o.onRest=()=>{setVis(o,false);o.a.set(1)}}});
}
function layoutCards(immediate,vx){
  state.stack.forEach((w,i)=>{const tx=(i-sx)*spacing;
    if(immediate){w.x.set(tx);return}
    w.x.to(tx,{resp:.42,damp:.9,vel:vx}); w.y.to(cardY,{resp:.42,damp:.88}); w.s.to(SC,{resp:.42,damp:.92})});
}
function openSwitcher(v={}){
  const st=state.stack; if(!st.length)return;
  state.mode='switcher'; winsEl.classList.add('cards');
  const ti=st.indexOf(state.top); sx=ti<0?st.length-1:ti;
  st.forEach((w,i)=>{w.onRest=null; if(!w.vis){w.x.set((i-sx)*spacing);w.y.set(cardY+60);w.s.set(SC*.94);w.a.set(1);setVis(w,true)} else w.a.to(1)});
  layoutCards(false,v.x||0); home.z.to(.55); scrim.o.to(1); paint(); vib(8);
}
function openFromSwitcher(w){
  const st=state.stack; st.splice(st.indexOf(w),1); st.push(w); restack();
  state.mode='app'; state.top=w; winsEl.classList.remove('cards');
  w.x.to(0,OPEN); w.y.to(0,OPEN); w.s.to(1,OPEN);
  w.onRest=()=>st.forEach(o=>o!==w&&setVis(o,false));
  scrim.o.to(0); paint();
}
function homeFromSwitcher(){
  state.mode='home'; state.top=null; winsEl.classList.remove('cards');
  state.stack.forEach(w=>{w.y.to(cardY+H*.18,{resp:.4,damp:1}); w.a.to(0,{resp:.3,damp:1}); w.onRest=()=>{setVis(w,false);w.a.set(1)}});
  home.z.to(0); scrim.o.to(0); paint();
}
function closeCard(w,vy){
  const st=state.stack, i=st.indexOf(w); st.splice(i,1); restack();
  if(i<sx||sx>st.length-1)sx=Math.max(0,sx-1);
  w.y.to(-H*1.1,{resp:.34,damp:1,vel:vy});
  w.onRest=()=>{setVis(w,false);w.api.destroy&&w.api.destroy();w.el.remove();delete wins[w.id];if(state.top===w)state.top=null};
  vib(10);
  if(!st.length)homeFromSwitcher(); else layoutCards(false,0);
}
function hitCard(x,y){
  const st=state.stack;
  for(let i=st.length-1;i>=0;i--){const w=st[i],cx=W/2+w.x.v,cy=H/2+w.y.v,hw=W*w.s.v/2,hh=H*w.s.v/2;
    if(Math.abs(x-cx)<hw&&Math.abs(y-cy)<hh)return w}
  return null;
}

/* ---------- Lock / Control Center / Banner ---------- */
function unlock(vy=0){state.locked=false;lock.u.to(-H,{resp:.42,damp:1,vel:vy});lock.onRest=()=>{lockEl.style.visibility='hidden'};paint();vib(8)}
function lockNow(){if(state.cc)closeCC();state.locked=true;lockEl.style.visibility='visible';lock.onRest=null;lock.u.to(0,{resp:.4,damp:1});paint()}
function openCC(vel=0){state.cc=true;ccEl.style.visibility=ccScrimEl.style.visibility='visible';cc.c.to(1,{resp:.42,damp:.82,vel});cc.onRest=null;paint();syncCC()}
function closeCC(vel=0){state.cc=false;cc.c.to(0,{resp:.36,damp:1,vel});cc.onRest=()=>{ccEl.style.visibility=ccScrimEl.style.visibility='hidden'};paint()}
let banTimer=0, banApp=null;
function notify(app,title,body){
  if(prefs.cc.dnd)return;
  const a=APPS[app]; banApp=app;
  banEl.querySelector('.glyph').outerHTML=`<div class="glyph" style="background:${a.bg};color:${a.fg}">${glyph(app)}</div>`;
  banEl.querySelector('b').textContent=title; banEl.querySelector('span').textContent=body;
  ban.y.to(0,{resp:.45,damp:.78}); clearTimeout(banTimer); banTimer=setTimeout(()=>ban.y.to(-160,{resp:.4,damp:1}),4000); vib([60,40,60]);
}
banEl.addEventListener('click',()=>{clearTimeout(banTimer);ban.y.to(-160,{resp:.35,damp:1});if(!state.locked&&banApp){if(state.cc)closeCC();openApp(banApp)}});

/* ---------- Status painting ---------- */
const sb=$('#statusbar'), hb=$('#homebar');
function paint(){
  const ink=!state.locked&&(state.cc||state.mode==='app'); sb.classList.toggle('ink',ink);
  hb.classList.toggle('ink',!state.locked&&state.mode==='app'&&!state.cc);
}

/* ---------- Gesture manager ---------- */
let GS=null;
const now=()=>performance.now();
function velocity(g){
  const s=g.samples, t=now(); let i=s.length-1; while(i>0&&t-s[i-1][0]<90)i--;
  const a=s[i]||s[0], b=s[s.length-1]; if(!a||!b||t-b[0]>70)return{x:0,y:0};
  const dt=(b[0]-a[0])/1000; if(dt<.008)return{x:0,y:0};
  return{x:(b[1]-a[1])/dt,y:(b[2]-a[2])/dt};
}
const HANDLERS={};
device.addEventListener('pointerdown',e=>{
  if(GS||(e.pointerType==='mouse'&&e.button!==0))return;
  const t=e.target; if(t.closest('[data-nogesture]'))return;
  let kind=null;
  if(state.locked)kind='lock';
  else if(state.cc){if(!t.closest('button'))kind='ccClose'}
  else if(t.closest('#topzone'))kind='ccOpen';
  else if(t.closest('#botzone'))kind=state.mode==='app'?'appBottom':state.mode==='home'?'homeBottom':'switcher';
  else if(state.mode==='switcher'&&t.closest('#wins'))kind='switcher';
  else if(state.mode==='home'&&t.closest('#home'))kind='home';
  if(!kind)return;
  const r=device.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
  GS={kind,id:e.pointerId,ox:r.left,oy:r.top,x0:x,y0:y,x,y,moved:false,axis:null,target:t,samples:[[now(),x,y]]};
  HANDLERS[kind].down&&HANDLERS[kind].down(GS);
});
window.addEventListener('pointermove',e=>{
  const g=GS; if(!g||e.pointerId!==g.id)return;
  g.x=e.clientX-g.ox; g.y=e.clientY-g.oy; g.samples.push([now(),g.x,g.y]); if(g.samples.length>12)g.samples.shift();
  if(!g.moved){const dx=g.x-g.x0,dy=g.y-g.y0; if(Math.hypot(dx,dy)<8)return;
    g.moved=true; g.axis=Math.abs(dx)>Math.abs(dy)?'x':'y'; try{g.target.setPointerCapture(g.id)}catch(err){}
    HANDLERS[g.kind].start&&HANDLERS[g.kind].start(g)}
  HANDLERS[g.kind].move&&HANDLERS[g.kind].move(g);
},{passive:true});
function endPointer(e){
  const g=GS; if(!g||e.pointerId!==g.id)return; GS=null;
  const h=HANDLERS[g.kind]; if(g.moved)h.end&&h.end(g,velocity(g)); else h.tap&&h.tap(g);
  h.up&&h.up(g);
}
window.addEventListener('pointerup',endPointer); window.addEventListener('pointercancel',endPointer);

HANDLERS.lock={
  move(g){const dy=g.y-g.y0; lock.u.set(dy<0?dy:dy*.15)},
  end(g,v){(lock.u.v<-H*.22||v.y<-450)&&v.y<300?unlock(v.y):lock.u.to(0,{resp:.4,damp:.8,vel:v.y})},
  tap(){lock.u.to(0,{resp:.4,damp:.55,vel:-900})}
};
HANDLERS.ccOpen={
  start(){ccEl.style.visibility=ccScrimEl.style.visibility='visible';cc.onRest=null;syncCC()},
  move(g){let c=(g.y-g.y0)/ccH; c=c>1?1+(c-1)*.2:Math.max(0,c); cc.c.set(c)},
  end(g,v){(cc.c.v>.35||v.y>500)&&v.y>-300?openCC(v.y/ccH):closeCC(v.y/ccH)},
  tap(){}
};
HANDLERS.ccClose={
  move(g){if(g.axis!=='y')return;const d=(g.y-g.y0)/ccH;cc.c.set(d>0?1+d*.12:1+d)},
  end(g,v){if(g.axis!=='y')return;(cc.c.v<.75||v.y<-500)?closeCC(v.y/ccH):openCC(v.y/ccH)},
  tap(g){if(!g.target.closest('#cc'))closeCC()}
};
HANDLERS.home={
  down(g){g.el=g.target.closest('.icon,.widget');if(g.el)g.el.classList.add('press')},
  start(g){if(g.el)g.el.classList.remove('press');
    if(g.axis==='y'&&g.y>g.y0){g.kind='ccOpen';HANDLERS.ccOpen.start(g)}},
  move(g){if(g.axis!=='x')return; let off=-curPage*W+(g.x-g.x0), min=-W;
    if(off>0)off*=.3; if(off<min)off=min+(off-min)*.3; home.page.set(off)},
  end(g,v){if(g.axis!=='x')return; curPage=clamp(Math.round(-(home.page.v+v.x*.18)/W),0,1);
    home.page.to(-curPage*W,{resp:.4,damp:.9,vel:v.x})},
  tap(g){if(!g.el)return; openApp(g.el.dataset.app||g.el.dataset.open)},
  up(g){if(g.el)setTimeout(()=>g.el.classList.remove('press'),60)}
};
HANDLERS.homeBottom={end(g,v){if(g.y0-g.y>40||v.y<-300)openSwitcher(v)}};
function neighbors(g){const w=g.w, s=w.s.v, st=state.stack, k=st.length-1;
  st.forEach((o,i)=>{if(o===w)return; if(!o.vis){o.a.set(1);setVis(o,true)} o.x.set(w.x.v-(k-i)*(W*s+16)); o.y.set(w.y.v); o.s.set(s)})}
HANDLERS.appBottom={
  start(g){const st=state.stack, w=g.w=state.top; if(!w)return; w.onRest=null;
    if(g.axis==='x'&&g.x>g.x0&&st.length>1){g.mode='switch';const n=g.n=st[st.length-2];n.onRest=null;n.a.set(1);n.y.set(0);setVis(n,true)}
    else g.mode='lift'},
  move(g){const w=g.w; if(!w)return; const dx=g.x-g.x0, dy=g.y-g.y0;
    if(g.mode==='switch'){const d=Math.max(0,dx), s=1-.07*Math.min(1,d/W);
      w.x.set(d); w.s.set(s); w.y.set(0); g.n.x.set(d-W*s-16); g.n.s.set(s); return}
    const up=dy<0?-dy:-dy*.15, prog=clamp(up/(H*.85),0,1), s=Math.max(.36,1-prog*.9);
    w.s.set(s); w.y.set(H*(1-s)/2-up); w.x.set(dx*.85);
    clearTimeout(g.at);
    if(!g.armed&&prog>.06&&prog<.6)g.at=setTimeout(()=>{if(GS===g){g.armed=true;vib(8);scrim.o.to(.6);neighbors(g)}},140);
    if(g.armed)neighbors(g);
  },
  end(g,v){const w=g.w; if(!w)return; clearTimeout(g.at);
    if(g.mode==='switch'){const n=g.n, d=w.x.v;
      if(d>W*.3||v.x>400){w.x.to(W+20,{resp:.42,damp:.92,vel:v.x});w.s.to(1);n.x.to(0,{resp:.42,damp:.92,vel:v.x});n.s.to(1);
        w.onRest=()=>setVis(w,false); const st=state.stack; st.splice(st.indexOf(n),1); st.push(n); restack(); state.top=n}
      else{w.x.to(0,{vel:v.x});w.s.to(1);n.x.to(-W-20,{vel:v.x});n.onRest=()=>setVis(n,false)} return}
    const prog=clamp((1-w.s.v)/.9,0,1);
    if(v.y<-750||(!g.armed&&prog>.28)){goHome(w,v)}
    else if(g.armed||prog>.14){openSwitcher(v)}
    else{w.x.to(0,{...OPEN,vel:v.x});w.y.to(0,{...OPEN,vel:v.y});w.s.to(1,OPEN);scrim.o.to(0)}
  }
};
HANDLERS.switcher={
  down(g){g.card=hitCard(g.x0,g.y0);g.sx0=sx},
  start(g){g.mode=g.axis==='y'&&g.card?'close':'scroll'},
  move(g){const n=state.stack.length;
    if(g.mode==='close'){const dy=g.y-g.y0;g.card.y.set(cardY+(dy<0?dy:dy*.2));return}
    let s=g.sx0-(g.x-g.x0)/spacing; if(s<0)s*=.3; if(s>n-1)s=n-1+(s-n+1)*.3; sx=s; layoutCards(true)},
  end(g,v){const n=state.stack.length;
    if(g.mode==='close'){const dy=g.y-g.y0; if(dy<-H*.12||v.y<-600)closeCard(g.card,v.y); else g.card.y.to(cardY,{resp:.4,damp:.8,vel:v.y});return}
    sx=clamp(Math.round(sx-v.x/spacing*.22),0,n-1); layoutCards(false,v.x)},
  tap(g){g.card?openFromSwitcher(g.card):homeFromSwitcher()}
};
device.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('#home')){const el=e.target.closest('.icon,.widget');if(el){e.preventDefault();openApp(el.dataset.app||el.dataset.open)}}
  if(e.key==='Escape'){if(state.cc)closeCC();else if(state.mode==='app')goHome(state.top);else if(state.mode==='switcher')homeFromSwitcher()}});
$('#lock').addEventListener('keydown',e=>{if(e.key==='Enter')unlock()}); $('#lock').tabIndex=0;

/* ---------- Control Center wiring ---------- */
const mql=matchMedia('(prefers-color-scheme: dark)');
const isDark=()=>prefs.theme==='dark'||(prefs.theme==='system'&&mql.matches);
function applyPrefs(){
  if(prefs.theme==='system')delete root.dataset.theme; else root.dataset.theme=prefs.theme;
  root.style.setProperty('--accent',prefs.accent);
  $('#wall').className=$('#lockWall').className='wall wp'+prefs.wall;
  $('#dim').style.opacity=(1-prefs.bright)*.65;
  $('#fps').hidden=!prefs.fps; prefs.fps?loop.add(fpsTick):loop.del(fpsTick);
  $('#sbWifi').style.display=prefs.cc.wifi&&!prefs.cc.air?'':'none';
  $('#sbSig').style.opacity=prefs.cc.air?.3:1;
  syncCC(); BUS.forEach(f=>f());
}
const BUS=new Set();
function syncCC(){
  $$('[data-cc]').forEach(b=>b.setAttribute('aria-pressed',!!prefs.cc[b.dataset.cc]));
  const d=isDark(); $('#ccDark').setAttribute('aria-pressed',d); $('#ccDark small').textContent=d?'On':'Off';
  const sl=prefs.speed<1; $('#ccSlow').setAttribute('aria-pressed',sl); $('#ccSlow small').textContent=sl?'0.4× speed':'Off';
  setSlider($('#slBright'),prefs.bright); setSlider($('#slVol'),prefs.vol);
}
$$('[data-cc]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.cc;prefs.cc[k]=!prefs.cc[k];if(k==='air'&&prefs.cc.air){prefs.cc.wifi=false;prefs.cc.bt=false}savePrefs();applyPrefs();vib(6)}));
$('#ccDark').addEventListener('click',()=>{prefs.theme=isDark()?'light':'dark';savePrefs();applyPrefs();vib(6)});
$('#ccSlow').addEventListener('click',()=>{prefs.speed=prefs.speed<1?1:.4;savePrefs();applyPrefs();vib(6)});
$('#ccLock').addEventListener('click',()=>{closeCC();setTimeout(lockNow,120)});
$('#ccSet').addEventListener('click',()=>{closeCC();openApp('settings')});
function setSlider(el,v){el.querySelector('.fill').style.transform=`scaleX(${v})`;el.querySelector('em').textContent=Math.round(v*100)+'%'}
function bindSlider(el,key,min){
  let id=null;
  const upd=e=>{const r=el.getBoundingClientRect();prefs[key]=clamp((e.clientX-r.left)/r.width,min,1);applyPrefs()};
  el.addEventListener('pointerdown',e=>{id=e.pointerId;try{el.setPointerCapture(id)}catch(err){}upd(e)});
  el.addEventListener('pointermove',e=>{if(e.pointerId===id)upd(e)});
  const end=e=>{if(e.pointerId===id){id=null;savePrefs()}};
  el.addEventListener('pointerup',end); el.addEventListener('pointercancel',end);
}
bindSlider($('#slBright'),'bright',.15); bindSlider($('#slVol'),'vol',0);
mql.addEventListener&&mql.addEventListener('change',applyPrefs);

/* ---------- FPS meter & refresh rate ---------- */
let fpsN=0,fpsT=0;
function fpsTick(t){fpsN++;if(!fpsT)fpsT=t;if(t-fpsT>=500){$('#fps').textContent=Math.round(fpsN*1000/(t-fpsT))+' fps';fpsN=0;fpsT=t}}
let HZ=60;
(function measureHz(){const ts=[];function f(t){ts.push(t);if(ts.length<40)requestAnimationFrame(f);else{const d=ts.slice(1).map((v,i)=>v-ts[i]).sort((a,b)=>a-b),m=d[d.length>>1];
  const raw=1000/m;HZ=[60,75,90,120,144,165].reduce((a,b)=>Math.abs(b-raw)<Math.abs(a-raw)?b:a);$('#stHz').textContent=HZ;BUS.forEach(fn=>fn())}}requestAnimationFrame(f)})();

/* ---------- Time ---------- */
const fmtT=d=>d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}).replace(/\s?[AP]M$/i,'');
function clockTick(){
  const d=new Date();
  $('#sbTime').textContent=fmtT(d); $('#lTime').textContent=fmtT(d);
  $('#lDate').textContent=d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  $('#wtDay').textContent=d.toLocaleDateString('en-US',{weekday:'long'});
  $('#wtDate').textContent=d.getDate(); $('#wtSub').textContent=d.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  setTimeout(clockTick,1000-d.getMilliseconds()+5);
}
try{navigator.getBattery&&navigator.getBattery().then(b=>{const u=()=>$('#sbBatt').style.width=Math.round(b.level*100)+'%';u();b.addEventListener('levelchange',u)}).catch(()=>{})}catch(e){}

/* ---------- Apps ---------- */
const BUILD={};
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

BUILD.settings=(el)=>{
  const sw=['#1F8A70','#3557D6','#E0603A','#8A4FB8','#C2410C','#4B5563'];
  el.innerHTML=`<div class="hdr"><h1>Settings</h1></div><div class="scroll">
  <div class="glabel">Appearance</div><div class="group">
    <div class="row"><span>Theme</span><div class="seg" id="sTheme"><button data-v="system">Auto</button><button data-v="light">Light</button><button data-v="dark">Dark</button></div></div>
    <div class="row col"><span>Accent color</span><div class="swatches" id="sAcc">${sw.map(c=>`<button style="--sw:${c}" data-v="${c}" aria-label="Accent ${c}"></button>`).join('')}</div></div>
    <div class="row col"><span>Wallpaper</span><div class="walls" id="sWall">${[0,1,2,3].map(i=>`<button data-v="${i}" aria-label="Wallpaper ${i+1}"><span class="wall wp${i}"></span></button>`).join('')}</div></div>
  </div>
  <div class="glabel">Motion</div><div class="group">
    <div class="row"><span>Animation speed</span><div class="seg" id="sSpeed"><button data-v="0.4">Slow</button><button data-v="1">Normal</button><button data-v="1.4">Fast</button></div></div>
    <div class="row"><span>Reduce motion</span><button class="switch" role="switch" id="sReduce" aria-label="Reduce motion"></button></div>
    <div class="row"><span>Show frame rate</span><button class="switch" role="switch" id="sFps" aria-label="Show frame rate"></button></div>
  </div>
  <div class="glabel">About this phone</div><div class="group">
    <div class="row"><span>System</span><span class="val">Senritha OS 1.0</span></div>
    <div class="row"><span>Screen</span><span class="val" id="aScr"></span></div>
    <div class="row"><span>Refresh rate</span><span class="val" id="aHz"></span></div>
    <div class="row"><span>Apps open</span><span class="val" id="aApps"></span></div>
  </div>
  <button class="btn" id="sLock">Lock phone</button>
  <button class="btn danger" id="sReset">Reset all settings</button>
  </div>`;
  const sync=()=>{
    $$('#sTheme button',el).forEach(b=>b.classList.toggle('on',b.dataset.v===prefs.theme));
    $$('#sAcc button',el).forEach(b=>b.classList.toggle('on',b.dataset.v===prefs.accent));
    $$('#sWall button',el).forEach(b=>b.classList.toggle('on',+b.dataset.v===prefs.wall));
    $$('#sSpeed button',el).forEach(b=>b.classList.toggle('on',+b.dataset.v===prefs.speed));
    $('#sReduce',el).setAttribute('aria-checked',prefs.reduce); $('#sFps',el).setAttribute('aria-checked',prefs.fps);
    $('#aScr',el).textContent=`${Math.round(W)} × ${Math.round(H)} pt @${(devicePixelRatio||1).toFixed(1)}x`;
    $('#aHz',el).textContent=HZ+' Hz'; $('#aApps',el).textContent=state.stack.length;
  };
  const set=(k,v)=>{prefs[k]=v;savePrefs();applyPrefs();vib(6)};
  el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const p=b.parentElement.id;
    if(p==='sTheme')set('theme',b.dataset.v); else if(p==='sAcc')set('accent',b.dataset.v); else if(p==='sWall')set('wall',+b.dataset.v);
    else if(p==='sSpeed')set('speed',+b.dataset.v); else if(b.id==='sReduce')set('reduce',!prefs.reduce); else if(b.id==='sFps')set('fps',!prefs.fps);
    else if(b.id==='sLock')lockNow();
    else if(b.id==='sReset'){if(b.dataset.armed){Object.assign(prefs,JSON.parse(JSON.stringify(DEF)));savePrefs();applyPrefs();b.textContent='Settings reset';delete b.dataset.armed}
      else{b.dataset.armed=1;b.textContent='Tap again to reset';setTimeout(()=>{delete b.dataset.armed;b.textContent='Reset all settings'},2500)}}});
  BUS.add(sync); sync();
  return{visible(on){on&&sync()},destroy(){BUS.delete(sync)}};
};

BUILD.clock=(el)=>{
  const zones=[['London','Europe/London'],['Bangkok','Asia/Bangkok'],['Tokyo','Asia/Tokyo'],['New York','America/New_York']];
  el.innerHTML=`<div class="hdr"><h1>Clock</h1></div>
  <div class="seg wide" id="cTabs"><button data-i="0" class="on">Clock</button><button data-i="1">Stopwatch</button><button data-i="2">Timer</button></div>
  <div class="views"><div class="track">
    <section><div class="face">${Array.from({length:60},(_,i)=>`<i class="${i%5?'':'major'}" style="transform:rotate(${i*6}deg)"></i>`).join('')}<b class="hand h"></b><b class="hand m"></b><b class="hand s"></b><span class="pin"></span></div>
      <div class="digital" id="cDig"></div><div class="group world">${zones.map(z=>`<div class="row"><span>${z[0]}</span><span class="val" data-tz="${z[1]}"></span></div>`).join('')}</div></section>
    <section><div class="big" id="swD">00:00.00</div><div class="pair"><button class="round" id="swL">Lap</button><button class="round go" id="swS">Start</button></div><div class="group laps" id="swLaps" hidden></div></section>
    <section><div class="ring"><svg viewBox="0 0 220 220"><circle class="bgc" cx="110" cy="110" r="100"/><circle class="fgc" cx="110" cy="110" r="100" stroke-dasharray="628.3" stroke-dashoffset="0"/></svg><div class="big" id="tmD">5:00</div></div>
      <div class="chips" id="tmChips">${[1,3,5,10,25].map(m=>`<button data-m="${m}" class="${m===5?'on':''}">${m} min</button>`).join('')}</div>
      <div class="pair"><button class="round" id="tmC">Cancel</button><button class="round go" id="tmS">Start</button></div></section>
  </div></div>`;
  const track=$('.track',el), hH=$('.hand.h',el), hM=$('.hand.m',el), hS=$('.hand.s',el), dig=$('#cDig',el), fg=$('.fgc',el);
  $('#cTabs',el).addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$$('#cTabs button',el).forEach(x=>x.classList.toggle('on',x===b));track.style.transform=`translate3d(${-b.dataset.i*100}%,0,0)`});
  let lastSec=-1;
  const sw={run:false,t0:0,acc:0,laps:[]}, tm={dur:300000,end:0,left:300000,run:false,to:0};
  const f2=n=>String(n).padStart(2,'0');
  const fmtSW=ms=>{const cs=Math.floor(ms/10);return `${f2(Math.floor(cs/6000))}:${f2(Math.floor(cs/100)%60)}.${f2(cs%100)}`};
  const fmtTM=ms=>{const s=Math.ceil(ms/1000);return s>=3600?`${Math.floor(s/3600)}:${f2(Math.floor(s/60)%60)}:${f2(s%60)}`:`${Math.floor(s/60)}:${f2(s%60)}`};
  const swTime=()=>sw.acc+(sw.run?now()-sw.t0:0);
  const tmLeft=()=>tm.run?Math.max(0,tm.end-Date.now()):tm.left;
  function draw(){
    const d=new Date(), s=d.getSeconds()+d.getMilliseconds()/1000, m=d.getMinutes()+s/60, h=(d.getHours()%12)+m/60;
    hS.style.transform=`rotate(${s*6}deg)`; hM.style.transform=`rotate(${m*6}deg)`; hH.style.transform=`rotate(${h*30}deg)`;
    if(d.getSeconds()!==lastSec){lastSec=d.getSeconds();dig.textContent=d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
      const today=d.toLocaleDateString('en-CA');
      $$('[data-tz]',el).forEach(x=>{const tz=x.dataset.tz,day=d.toLocaleDateString('en-CA',{timeZone:tz});
        x.textContent=d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:tz})+(day>today?' · tomorrow':day<today?' · yesterday':' · today')})}
    $('#swD',el).textContent=fmtSW(swTime());
    const left=tmLeft(); $('#tmD',el).textContent=fmtTM(left); fg.setAttribute('stroke-dashoffset',(628.3*(1-left/tm.dur)).toFixed(1));
  }
  const swUI=()=>{const s=$('#swS',el),l=$('#swL',el);s.textContent=sw.run?'Stop':'Start';s.className='round '+(sw.run?'stop':'go');l.textContent=sw.run||!sw.acc?'Lap':'Reset';
    const L=$('#swLaps',el);L.hidden=!sw.laps.length;L.innerHTML=sw.laps.map((t,i)=>`<div class="row"><span>Lap ${sw.laps.length-i}</span><span class="val">${fmtSW(t)}</span></div>`).join('')};
  $('#swS',el).onclick=()=>{if(sw.run){sw.acc+=now()-sw.t0;sw.run=false}else{sw.t0=now();sw.run=true}swUI();vib(6)};
  $('#swL',el).onclick=()=>{if(sw.run){const t=swTime();const prev=sw.laps.reduce((a,b)=>a+b,0);sw.laps.unshift(t-prev)}else{sw.acc=0;sw.laps=[]}swUI();draw()};
  const tmUI=()=>{const s=$('#tmS',el);s.textContent=tm.run?'Pause':(tm.left<tm.dur?'Resume':'Start');s.className='round '+(tm.run?'stop':'go')};
  const finish=()=>{tm.run=false;tm.left=tm.dur;tmUI();draw();notify('clock','Timer finished',`${Math.round(tm.dur/60000)} minute timer is done`)};
  $('#tmS',el).onclick=()=>{if(tm.run){tm.left=tmLeft();tm.run=false;clearTimeout(tm.to)}else{tm.end=Date.now()+tm.left;tm.run=true;tm.to=setTimeout(finish,tm.left)}tmUI();vib(6)};
  $('#tmC',el).onclick=()=>{clearTimeout(tm.to);tm.run=false;tm.left=tm.dur;tmUI();draw()};
  $('#tmChips',el).addEventListener('click',e=>{const b=e.target.closest('button');if(!b||tm.run)return;$$('#tmChips button',el).forEach(x=>x.classList.toggle('on',x===b));tm.dur=tm.left=b.dataset.m*60000;tmUI();draw()});
  draw();
  return{visible(on){on?loop.add(draw):loop.del(draw)},destroy(){loop.del(draw);clearTimeout(tm.to)}};
};

BUILD.calculator=(el)=>{
  el.classList.add('calc');
  el.innerHTML=`<div class="expr" id="kE"></div><div class="disp" id="kD">0</div><div class="keys">
   <button class="fn" data-k="c">AC</button><button class="fn" data-k="neg">±</button><button class="fn" data-k="pct">%</button><button class="op" data-k="/">÷</button>
   <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button><button class="op" data-k="*">×</button>
   <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button><button class="op" data-k="-">−</button>
   <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button><button class="op" data-k="+">+</button>
   <button class="zero" data-k="0">0</button><button data-k=".">.</button><button class="op" data-k="=">=</button></div>`;
  const D=$('#kD',el), E=$('#kE',el), SYM={'/':'÷','*':'×','-':'−','+':'+'};
  let cur='0',prev=null,op=null,fresh=true;
  const fmt=n=>{if(!isFinite(n))return'Error';const a=Math.abs(n);if(a>=1e9||(a<1e-7&&a>0))return n.toExponential(4).replace('e+','e');return String(parseFloat(n.toPrecision(9)))};
  const pretty=s=>{if(s==='Error'||s.includes('e'))return s;const[i,f]=s.split('.');const neg=i.startsWith('-');const ii=(neg?i.slice(1):i).replace(/\B(?=(\d{3})+(?!\d))/g,',');return(neg?'-':'')+ii+(f!=null?'.'+f:'')};
  const render=()=>{const t=pretty(cur);D.textContent=t;D.style.fontSize=Math.min(84,Math.floor((W-48)/(t.length*.58)))+'px';
    $('[data-k="c"]',el).textContent=(!fresh&&cur!=='0')?'C':'AC';
    $$('.op',el).forEach(b=>b.classList.toggle('on',fresh&&op===b.dataset.k&&b.dataset.k!=='='));
    E.textContent=op&&prev!=null?`${pretty(fmt(prev))} ${SYM[op]}`:''};
  const calc=()=>{const b=parseFloat(cur),a=prev;let r=b;if(op==='+')r=a+b;else if(op==='-')r=a-b;else if(op==='*')r=a*b;else if(op==='/')r=b===0?NaN:a/b;cur=fmt(r);prev=isFinite(r)?r:null};
  el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const k=b.dataset.k;vib(4);
    if(/^[0-9.]$/.test(k)){if(fresh||cur==='Error'){cur=k==='.'?'0.':k;fresh=false}else{if(k==='.'&&cur.includes('.'))return;if(cur.replace(/[-.]/g,'').length>=9)return;cur=(cur==='0'&&k!=='.')?k:cur+k}}
    else if(k==='c'){if(!fresh&&cur!=='0'){cur='0';fresh=true}else{cur='0';prev=null;op=null;fresh=true}}
    else if(k==='neg'){if(cur!=='0'&&cur!=='Error')cur=cur.startsWith('-')?cur.slice(1):'-'+cur}
    else if(k==='pct'){cur=fmt(parseFloat(cur)/100)}
    else if(k==='='){if(op&&prev!=null){calc();op=null;fresh=true}}
    else{if(op&&!fresh&&prev!=null)calc();else if(cur!=='Error')prev=parseFloat(cur);op=k;fresh=true}
    render()});
  render(); return{visible(on){on&&render()}};
};

let notes=store.get('notes',null);
if(!Array.isArray(notes))notes=[
  {id:2,t:Date.now()-36e5*3,text:'Ideas for Senritha OS\nHaptic ticks on toggles. Lock screen widgets. A darker wallpaper for night.'},
  {id:1,t:Date.now()-864e5*2,text:'Groceries\nJasmine rice, eggs, chili paste, limes, coconut milk'}];
const saveNotes=()=>store.set('notes',notes);
function noteWidget(){const n=[...notes].sort((a,b)=>b.t-a.t)[0];const[t,...r]=(n?n.text:'No notes yet\nTap to write one').split('\n');
  $('#wnTitle').textContent=t||'Untitled';$('#wnBody').textContent=r.join(' ').trim()||'No additional text'}
BUILD.notes=(el)=>{
  el.innerHTML=`<div class="nav"><section class="pane list"><div class="hdr"><h1>Notes</h1><p class="sub" id="nC"></p></div><div class="scroll"><ul class="nlist" id="nL"></ul><div class="empty" id="nE" hidden>No notes. Tap + to write one.</div></div><button class="fab" id="nN" aria-label="New note">+</button></section>
  <section class="pane edit"><div class="bar"><button id="nB">‹ Notes</button><span class="when" id="nW"></span><button class="del" id="nX">Delete</button></div><textarea id="nT" placeholder="Start typing. The first line becomes the title."></textarea></section></div>`;
  const nav=$('.nav',el), L=$('#nL',el), T=$('#nT',el), X=$('#nX',el); let cur=null, tmr=0;
  const when=t=>{const d=new Date(t),n=new Date();return d.toDateString()===n.toDateString()?d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):d.toLocaleDateString([], {day:'numeric',month:'short'})};
  const list=()=>{const s=[...notes].sort((a,b)=>b.t-a.t);
    L.innerHTML=s.map(n=>{const[t,...r]=n.text.split('\n');return`<li data-id="${n.id}"><b>${esc(t||'Untitled')}</b><span>${when(n.t)}  ${esc(r.join(' ').trim()||'No additional text')}</span></li>`}).join('');
    L.hidden=!s.length;$('#nE',el).hidden=!!s.length;$('#nC',el).textContent=s.length+(s.length===1?' note':' notes');noteWidget()};
  const open=n=>{cur=n;T.value=n.text;$('#nW',el).textContent=when(n.t);nav.classList.add('editing');X.classList.remove('armed');X.textContent='Delete'};
  const back=()=>{T.blur();if(cur&&!cur.text.trim())notes=notes.filter(n=>n!==cur);cur=null;saveNotes();list();nav.classList.remove('editing')};
  L.addEventListener('click',e=>{const li=e.target.closest('li');if(li)open(notes.find(n=>n.id==li.dataset.id))});
  $('#nN',el).onclick=()=>{const n={id:Date.now(),t:Date.now(),text:''};notes.push(n);open(n);setTimeout(()=>T.focus(),350)};
  $('#nB',el).onclick=back;
  T.addEventListener('input',()=>{if(!cur)return;cur.text=T.value;cur.t=Date.now();clearTimeout(tmr);tmr=setTimeout(()=>{saveNotes();noteWidget()},300)});
  X.onclick=()=>{if(!X.classList.contains('armed')){X.classList.add('armed');X.textContent='Tap to confirm';return}notes=notes.filter(n=>n!==cur);cur=null;saveNotes();list();nav.classList.remove('editing')};
  list(); return{visible(on){if(!on&&cur){saveNotes();noteWidget()}}};
};

BUILD.calendar=(el)=>{
  const t=new Date(); let y=t.getFullYear(), m=t.getMonth(), sel=new Date(y,m,t.getDate());
  el.innerHTML=`<div class="calhead"><h1 id="yH"></h1><div class="arrows"><button id="yP" aria-label="Previous month">‹</button><button id="yN" aria-label="Next month">›</button></div></div>
   <div class="wk">${['M','T','W','T','F','S','S'].map(d=>`<span>${d}</span>`).join('')}</div><div class="days" id="yD"></div><div class="dayinfo"><b id="yI"></b><p id="yJ"></p></div>`;
  const render=()=>{const first=new Date(y,m,1), off=(first.getDay()+6)%7, start=new Date(y,m,1-off);
    $('#yH',el).innerHTML=`${first.toLocaleDateString('en-US',{month:'long'})} <span>${y}</span>`;
    let h='';for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);
      const c=[d.getMonth()!==m?'out':'',d.toDateString()===t.toDateString()?'today':'',d.toDateString()===sel.toDateString()?'sel':''].join(' ');
      h+=`<button class="${c}" data-d="${d.toISOString()}">${d.getDate()}</button>`}
    $('#yD',el).innerHTML=h;
    const diff=Math.round((sel-new Date(t.getFullYear(),t.getMonth(),t.getDate()))/864e5);
    $('#yI',el).textContent=sel.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    $('#yJ',el).textContent=diff===0?'Today':diff>0?`In ${diff} day${diff>1?'s':''}`:`${-diff} day${diff<-1?'s':''} ago`};
  $('#yP',el).onclick=()=>{m--;if(m<0){m=11;y--}render()}; $('#yN',el).onclick=()=>{m++;if(m>11){m=0;y++}render()};
  $('#yD',el).addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;sel=new Date(b.dataset.d);if(sel.getMonth()!==m){m=sel.getMonth();y=sel.getFullYear()}render();vib(4)});
  render();
};

const TIPS=[['↑','Unlock','Swipe up anywhere on the lock screen.'],['↑','Go home','Swipe up from the bar at the bottom of any app.'],
  ['⏸','App switcher','Swipe up from the bottom bar and pause for a moment, then let go.'],['→','Previous app','Swipe right along the bottom bar to jump back to the last app.'],
  ['↓','Control Center','Pull down from the top edge, or anywhere on the home screen.'],['✕','Close an app','In the app switcher, flick a card up.'],
  ['½','Watch it slowly','Turn on Slow motion in Control Center to see every spring.'],['+','Add to home screen','Use your browser menu to add this page to your home screen for a full-screen view.']];
BUILD.tips=(el)=>{
  el.innerHTML=`<div class="hdr"><h1>Tips</h1><p class="sub">Every gesture in Senritha OS</p></div><div class="scroll"><div class="group" style="margin-top:12px">${TIPS.map(t=>`<div class="tip"><i>${t[0]}</i><div><b>${t[1]}</b><span>${t[2]}</span></div></div>`).join('')}</div></div>`;
};
let tipI=0; function rotateTip(){const t=TIPS[tipI++%6];$('#wTip').textContent=`${t[1]}: ${t[2]}`}
setInterval(rotateTip,8000);

/* ---------- Boot ---------- */
function relayout(){
  measure();
  $('#stRes').textContent=Math.round(W);
  home.page.set(-curPage*W);
  if(!state.locked)lock.u.set(-H);
  if(state.mode==='app'&&state.top){const w=state.top;w.x.set(0);w.y.set(0);w.s.set(1)}
  if(state.mode==='switcher')layoutCards(true);
  cc.c.set(state.cc?1:0);
}
window.addEventListener('resize',relayout);
measure(); applyPrefs(); clockTick(); noteWidget(); rotateTip(); relayout(); paint();
ccEl.style.visibility='hidden';
})();
