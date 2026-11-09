/* Rhythm game: turns a song's beat map into notes falling down 4 lanes. Tap each lane as its note hits the line. */
(()=>{
const R=Rhythm, G=R.Game, $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const PAL=Visuals.PAL, LANES=4;
const DIFF={
  easy:{name:'Easy',travel:1.6,gap:.36,win:[.06,.11,.16]},
  normal:{name:'Normal',travel:1.3,gap:.2,win:[.05,.1,.15]},
  hard:{name:'Hard',travel:1.05,gap:.11,win:[.04,.085,.13]}};
const PTS={perfect:300,great:200,good:100};
const KEYS={d:0,f:1,j:2,k:3,arrowleft:0,arrowdown:1,arrowup:2,arrowright:3};
const rng=s=>()=>((s=Math.imul(s^s>>>15,1|s)+0x6D2B79F5|0,((s^s>>>14)>>>0)/4294967296));
const best=(id,d)=>{try{return JSON.parse(localStorage.getItem(`rhythm.best.${id}.${d}`))||null}catch(e){return null}};
const setBest=(id,d,v)=>{try{localStorage.setItem(`rhythm.best.${id}.${d}`,JSON.stringify(v))}catch(e){}};

/* ---------- Chart ---------- */
function chart(A,diff,seed){
  const r=rng(seed), en=t=>A.energy[Math.min(A.energy.length-1,Math.max(0,Math.floor(t*10)))]||0;
  let ts=[];
  A.beats.forEach((t,i)=>{const pos=((i-A.bar0)%4+4)%4;
    if(diff==='easy'){if(pos%2===0||en(t)>.8)ts.push({t,down:pos===0})}else ts.push({t,down:pos===0})});
  if(diff!=='easy')A.kicks.forEach(t=>{if(en(t)>.3)ts.push({t})});
  if(diff==='hard')A.highs.forEach(t=>{if(en(t)>.45)ts.push({t})});
  ts=ts.filter(n=>n.t>1.6&&n.t<A.duration-.2&&en(n.t)>.08).sort((a,b)=>a.t-b.t);
  const g=DIFF[diff].gap,out=[];let last=-9,lane=1;
  for(const n of ts){if(n.t-last<g)continue;const fast=n.t-last<.3;
    if(fast)lane=Math.max(0,Math.min(3,lane+(r()<.5?-1:1)));else{let l;do l=Math.floor(r()*4);while(l===lane);lane=l}
    out.push({t:n.t,lane,hit:null});
    if(diff==='hard'&&n.down&&en(n.t)>.8){let l2;do l2=Math.floor(r()*4);while(l2===lane);out.push({t:n.t,lane:l2,hit:null})}
    last=n.t}
  return out;
}

/* ---------- State ---------- */
let notes=[],diff=R.prefs.difficulty||'normal',st=null,startAt=0,pressed=[0,0,0,0],flashes=[0,0,0,0],pops=[],judge=null,paused=false;
function reset(){st={score:0,combo:0,max:0,perfect:0,great:0,good:0,miss:0,next:0};pops=[];judge=null;hud()}
G.blocking=()=>G.active;

/* ---------- Flow ---------- */
$('#gameBtn').onclick=()=>{const s=R.cur;
  if(!s){R.toast('Pick a song first');return}
  if(!s.analysis){R.toast(s.failed?'This song can\'t be played as a game. Its beat couldn\'t be mapped.':'Wait a moment, the beat is still being mapped.');return}
  syncDiff();R.sheet('gameSheet')};
function syncDiff(){$$('#gDiff button').forEach(b=>b.classList.toggle('on',b.dataset.v===diff));const s=R.cur,b=s&&best(s.id,diff);
  $('#gBest').textContent=b?`Your best on ${DIFF[diff].name}: ${b.score.toLocaleString()} · ${b.grade} · ${Math.round(b.acc*100)}%`:`No score yet on ${DIFF[diff].name}.`;
  $('#gCount').textContent=s&&s.analysis?`${chart(s.analysis,diff,s.id%100000).length} notes`:''}
$('#gDiff').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;diff=b.dataset.v;R.prefs.difficulty=diff;R.savePrefs();syncDiff()});
$('#gStart').onclick=start; $('#rAgain').onclick=start; $('#pRestart').onclick=start;
$('#rDone').onclick=quit; $('#pQuit').onclick=quit;
$('#pResume').onclick=()=>{paused=false;R.sheet(null);R.audio.play()};
$('#gPause').onclick=()=>pause();
function start(){
  const s=R.cur; if(!s||!s.analysis)return;
  R.ensureGraph(); R.ac&&R.ac.resume();
  notes=chart(s.analysis,diff,s.id%100000); reset(); paused=false;
  G.active=true; document.getElementById('app').classList.add('gaming'); R.immersive(false); R.sheet(null);
  R.audio.pause(); R.audio.currentTime=0; startAt=performance.now()+2400;
  setTimeout(()=>{if(G.active&&!paused)R.audio.play().catch(()=>{})},2400);
}
function pause(){if(!G.active||paused)return;paused=true;R.audio.pause();R.sheet('pauseSheet')}
function quit(){G.active=false;paused=false;document.getElementById('app').classList.remove('gaming');R.sheet(null);R.audio.pause();R.ui()}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
R.endHooks.push(()=>{if(!G.active)return false;finish();return true});
function finish(){
  for(const n of notes)if(!n.hit){n.hit='miss';st.miss++}
  const total=notes.length||1, acc=(st.perfect+st.great*.7+st.good*.4)/total, grade=acc>=.95?'S':acc>=.88?'A':acc>=.75?'B':acc>=.6?'C':'D';
  const s=R.cur, prev=best(s.id,diff), isBest=!prev||st.score>prev.score;
  if(isBest)setBest(s.id,diff,{score:st.score,grade,acc});
  $('#rGrade').textContent=grade; $('#rGrade').dataset.g=grade;
  $('#rSong').textContent=`${R.title(s)} · ${DIFF[diff].name}`;
  $('#rScore').textContent=st.score.toLocaleString()+(isBest?' · New best!':'');
  $('#rStats').innerHTML=[['Accuracy',Math.round(acc*100)+'%'],['Max combo',st.max],['Perfect',st.perfect],['Great',st.great],['Good',st.good],['Miss',st.miss]]
    .map(([k,v])=>`<div><b>${v}</b><span>${k}</span></div>`).join('');
  paused=true; R.sheet('resultSheet'); R.vib(isBest?[30,40,30,40,60]:20);
}

/* ---------- Judging ---------- */
function hit(lane,ts){
  if(!G.active||paused||performance.now()<startAt)return;
  flashes[lane]=performance.now(); const t=R.songTimeAt(ts||performance.now()), w=DIFF[diff].win;   // judged at the moment of the touch, not when the code runs
  let cand=null;for(let i=st.next;i<notes.length;i++){const n=notes[i];if(n.t-t>w[2])break;if(!n.hit&&n.lane===lane&&Math.abs(n.t-t)<=w[2]){cand=n;break}}
  if(!cand)return;
  const d=Math.abs(cand.t-t), j=d<=w[0]?'perfect':d<=w[1]?'great':'good';
  cand.hit=j; st[j]++; st.combo++; st.max=Math.max(st.max,st.combo);
  st.score+=Math.round(PTS[j]*(1+Math.min(1,st.combo/50)));
  judge={j,at:performance.now(),early:cand.t>t}; pops.push({lane,at:performance.now(),j}); if(pops.length>12)pops.shift();
  R.vib(j==='perfect'?12:8); hud();
}
function missCheck(t){const w=DIFF[diff].win[2];
  while(st.next<notes.length&&notes[st.next].hit)st.next++;
  for(let i=st.next;i<notes.length;i++){const n=notes[i];if(n.t>t-w)break;if(!n.hit){n.hit='miss';st.miss++;st.combo=0;judge={j:'miss',at:performance.now()};hud()}}}
let hudKey='';
function hud(){const k=`${st.score}|${st.combo}`;if(k===hudKey)return;hudKey=k;$('#hScore').textContent=st.score.toLocaleString();
  $('#hCombo').textContent=st.combo>1?`${st.combo} combo`:'';const done=st.perfect+st.great+st.good+st.miss;
  $('#hAcc').textContent=done?Math.round((st.perfect+st.great*.7+st.good*.4)/done*100)+'%':'—'}

/* ---------- Input ---------- */
const geo=()=>{const {W,H}=R.size(),lw=Math.min(W-24,520)/LANES,x0=(W-lw*LANES)/2;return{W,H,lw,x0,hy:H-Math.max(130,H*.17)}};
R.canvas.addEventListener('pointerdown',e=>{if(!G.active)return;const g=geo(),l=Math.floor((e.clientX-g.x0)/g.lw);if(l<0||l>=LANES)return;pressed[l]=e.pointerId;hit(l,e.timeStamp)});
const up=e=>{pressed=pressed.map(p=>p===e.pointerId?0:p)}; addEventListener('pointerup',up); addEventListener('pointercancel',up);
document.addEventListener('keydown',e=>{if(!G.active||e.repeat)return;const l=KEYS[e.key.toLowerCase()];if(l!=null){e.preventDefault();pressed[l]=-1;hit(l,e.timeStamp)}else if(e.key==='Escape'||e.code==='Space'){e.preventDefault();paused?null:pause()}});
document.addEventListener('keyup',e=>{const l=KEYS[e.key.toLowerCase()];if(l!=null)pressed[l]=0});

/* ---------- Drawing (runs after the visual style each frame) ---------- */
const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return`rgba(${n>>16},${n>>8&255},${n&255},${Math.max(0,Math.min(1,a)).toFixed(3)})`};
function rr(c,x,y,w,h,r){c.beginPath();c.roundRect?c.roundRect(x,y,w,h,r):c.rect(x,y,w,h);c.fill()}
R.frameHooks.add((c,W,H,S)=>{
  if(!G.active)return;
  const g=geo(),now=performance.now(),t=R.songTime(),travel=DIFF[diff].travel;
  if(!paused&&now>=startAt)missCheck(t);
  c.fillStyle='rgba(7,7,12,.55)';c.fillRect(g.x0,0,g.lw*LANES,H);
  for(let l=0;l<LANES;l++){const x=g.x0+l*g.lw,f=Math.max(0,1-(now-flashes[l])/220);
    c.fillStyle=rgba(PAL[l],.05+.18*f);c.fillRect(x+1,0,g.lw-2,H);
    if(l)c.fillStyle='rgba(255,255,255,.06)',c.fillRect(x,0,1,H)}
  c.fillStyle='rgba(255,255,255,.75)';c.fillRect(g.x0,g.hy-1.5,g.lw*LANES,3);
  for(let l=0;l<LANES;l++){const x=g.x0+l*g.lw,on=pressed[l]||now-flashes[l]<90;
    c.fillStyle=rgba(PAL[l],on?.9:.28);rr(c,x+8,g.hy+10,g.lw-16,24,12)}
  const nh=Math.max(14,g.lw*.22);
  for(let i=st.next;i<notes.length;i++){const n=notes[i],dt=n.t-t;if(dt>travel)break;if(n.hit)continue;
    const y=g.hy-dt/travel*g.hy;if(y<-nh)continue;const x=g.x0+n.lane*g.lw;
    c.fillStyle=PAL[n.lane];rr(c,x+6,y-nh/2,g.lw-12,nh,nh/2);c.fillStyle='rgba(255,255,255,.55)';rr(c,x+14,y-nh/2+3,g.lw-28,nh*.28,nh*.14)}
  for(const p of pops){const a=(now-p.at)/380;if(a>1)continue;const x=g.x0+(p.lane+.5)*g.lw;
    c.strokeStyle=rgba(PAL[p.lane],1-a);c.lineWidth=4*(1-a)+1;c.beginPath();c.arc(x,g.hy,g.lw*.25+a*g.lw*.45,0,6.2832);c.stroke()}
  if(judge){const a=(now-judge.at)/600;if(a<1){const col={perfect:'#2EE6D6',great:'#FFB020',good:'#F3F1F8',miss:'#FF3D7F'}[judge.j];
    c.font=`700 ${Math.round(Math.min(34,W*.08))}px Unbounded, system-ui, sans-serif`;c.textAlign='center';c.textBaseline='middle';
    c.fillStyle=rgba(col,1-a);c.fillText(judge.j.toUpperCase(),W/2,g.hy-g.hy*.32-a*18)}}
  if(now<startAt){const n=Math.ceil((startAt-now)/800);c.font=`700 ${Math.round(Math.min(W,H)*.22)}px Unbounded, system-ui, sans-serif`;c.textAlign='center';c.textBaseline='middle';
    c.fillStyle=rgba(PAL[(3-n+4)%4],.95);c.fillText(String(Math.max(1,n)),W/2,H*.42);
    c.font='600 15px Figtree, system-ui, sans-serif';c.fillStyle='rgba(255,255,255,.75)';c.fillText('Tap the lanes, or press D F J K',W/2,H*.42+Math.min(W,H)*.16)}
});
})();
