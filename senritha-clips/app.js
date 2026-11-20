/* Senritha's Random Clips — one long screen-share session that records short clips at random moments.
   The screen is shared once (getDisplayMedia); each clip is its own MediaRecorder on that stream, so every
   file is complete and playable on its own. Timing runs on a Web Worker so background tabs keep schedule.
   Nothing leaves this computer. */
(()=>{
'use strict';

/* ---------- Helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const rand=(a,b)=>a+Math.random()*(b-a);
const pad=n=>String(n).padStart(2,'0');
const fmt=ms=>{if(!isFinite(ms))return'∞';const s=Math.floor(Math.max(0,ms)/1000),h=Math.floor(s/3600),m=Math.floor(s/60)%60;return h?`${h}:${pad(m)}:${pad(s%60)}`:`${pad(m)}:${pad(s%60)}`};
const human=sec=>{sec=Math.round(sec*10)/10;if(sec<60)return`${+sec.toFixed(1)} วิ`;const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=Math.round(sec%60);return[h&&`${h} ชม.`,m&&`${m} นาที`,s&&`${s} วิ`].filter(Boolean).join(' ')};
const size=b=>b>=1e9?(b/1e9).toFixed(2)+' GB':(b/1e6).toFixed(1)+' MB';
const clock=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
let toastT;
function toast(msg,ms=3200){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),ms)}
const idb={ /* remembers the chosen save folder between visits */
  db:null,
  open(){return this.db||(this.db=new Promise((res,rej)=>{const r=indexedDB.open('random-clips',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}))},
  async get(k){const db=await this.open();return new Promise(res=>{const r=db.transaction('kv').objectStore('kv').get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>res(undefined)})},
  async set(k,v){const db=await this.open();return new Promise(res=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(v,k);tx.oncomplete=tx.onerror=()=>res()})},
};

/* ---------- Capabilities ---------- */
const CAN_SHARE=!!navigator.mediaDevices?.getDisplayMedia;
const CAN_FOLDER='showDirectoryPicker' in window;
const MIMES=[
  ['video/mp4;codecs=avc1,mp4a.40.2','MP4 · H.264'],
  ['video/mp4;codecs=avc1.640033,mp4a.40.2','MP4 · H.264 High'],
  ['video/mp4','MP4'],
  ['video/webm;codecs=vp9,opus','WebM · VP9'],
  ['video/webm;codecs=vp8,opus','WebM · VP8'],
  ['video/webm;codecs=h264,opus','WebM · H.264'],
  ['video/webm','WebM'],
].filter(([m])=>window.MediaRecorder?.isTypeSupported?.(m));
const ext=m=>m.startsWith('video/mp4')?'mp4':'webm';

/* ---------- Settings ---------- */
const DEF={dur:3600,durUnlimited:false,maxClips:0,firstMin:30,firstMax:180,clipMin:15,clipMax:15,cdMin:180,cdMax:600,mode:'random',manualLen:15,
  surface:'monitor',res:'native',fps:30,bitrate:0,mime:'',sysAudio:true,sysGain:100,mic:false,micId:'',micGain:100,
  save:'download',prefix:'clip',surprise:false,preview:true,notify:false,beep:false};
const SCHED=['dur','durUnlimited','maxClips','firstMin','firstMax','clipMin','clipMax','cdMin','cdMax','mode','manualLen'];
const LIVE=new Set(['surprise','preview','notify','beep']); /* changeable while recording */
const BUILTIN={
  'ทดสอบ 1 ชั่วโมง (คลิป 15 วิ · คูลดาวน์ 3–10 นาที)':{},
  'ทดสอบเร็ว 3 นาที (คลิป 5 วิ · คูลดาวน์ 20–40 วิ)':{dur:180,firstMin:5,firstMax:10,clipMin:5,clipMax:5,cdMin:20,cdMax:40,manualLen:5},
  'กระจาย 10 คลิปใน 1 ชั่วโมง':{dur:3600,mode:'spread',maxClips:10,firstMin:0,firstMax:60,cdMin:180},
  'ทั้งวัน 8 ชั่วโมง (คลิป 10–20 วิ · คูลดาวน์ 10–30 นาที)':{dur:28800,firstMin:60,firstMax:600,clipMin:10,clipMax:20,cdMin:600,cdMax:1800},
  'ไม่จำกัดเวลา (คลิป 15 วิ · คูลดาวน์ 5–15 นาที)':{durUnlimited:true,cdMin:300,cdMax:900},
};
let S=Object.assign({},DEF,store.get('rc.settings',{}));
let presets=store.get('rc.presets',{});
const saveS=()=>store.set('rc.settings',S);

const UNITS=[[1,'วินาที'],[60,'นาที'],[3600,'ชั่วโมง']];
const durHTML=(k,label)=>`<span class="dur" data-dur="${k}"><input type="number" min="0" step="any" inputmode="decimal" aria-label="${esc(label)}"><select aria-label="หน่วย">${UNITS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></span>`;
const FORM=[
  {sec:'เซสชัน',items:[
    {t:'dur',k:'dur',l:'ระยะเวลารัน',when:s=>!s.durUnlimited},
    {t:'check',k:'durUnlimited',l:'ไม่จำกัดเวลา (รันจนกว่าจะกดหยุด)'},
    {t:'num',k:'maxClips',l:'จำนวนคลิปสูงสุด',h:'0 = ไม่จำกัด · จบเซสชันเมื่อครบ',min:0,step:1},
    {t:'range',k:['firstMin','firstMax'],l:'รอก่อนคลิปแรก',h:'สุ่มค่าระหว่างต่ำสุดถึงสูงสุด'},
  ]},
  {sec:'คลิปและการสุ่ม',items:[
    {t:'range',k:['clipMin','clipMax'],l:'ความยาวคลิป',h:'ใส่สองค่าเท่ากัน = ความยาวคงที่'},
    {t:'range',k:['cdMin','cdMax'],l:'คูลดาวน์ระหว่างคลิป',h:'นับจากจบคลิปหนึ่งถึงเริ่มคลิปถัดไป',hs:s=>s.mode==='spread'?'โหมดกระจายใช้แค่ค่าต่ำสุด':''},
    {t:'select',k:'mode',l:'รูปแบบการสุ่ม',o:[['random','สุ่มอิสระ: คูลดาวน์สุ่มในช่วงที่ตั้ง'],['spread','กระจายทั่วเวลา: แบ่งช่วง แล้วสุ่มในแต่ละช่วง']],hs:s=>s.mode==='spread'?'ต้องกำหนดระยะเวลารันและจำนวนคลิปสูงสุด':''},
    {t:'dur',k:'manualLen',l:'ความยาวเมื่อกด “อัดตอนนี้”'},
  ]},
  {sec:'วิดีโอ',items:[
    {t:'select',k:'surface',l:'แหล่งที่จะแนะนำให้เลือก',o:[['monitor','ทั้งหน้าจอ'],['window','หน้าต่างโปรแกรม'],['browser','แท็บเบราว์เซอร์']],h:'เลือกจริงได้ในหน้าต่างของเบราว์เซอร์'},
    {t:'select',k:'res',l:'ความละเอียดสูงสุด',o:[['native','ตามจอจริง'],['2160','2160p (4K)'],['1440','1440p'],['1080','1080p'],['720','720p'],['480','480p']]},
    {t:'select',k:'fps',l:'เฟรมเรต',o:[[5,'5 fps'],[10,'10 fps'],[15,'15 fps'],[24,'24 fps'],[30,'30 fps'],[60,'60 fps']],num:true},
    {t:'num',k:'bitrate',l:'บิตเรตวิดีโอ (Mbps)',min:0,step:.5,hs:s=>`0 = อัตโนมัติ (≈ ${autoBitrate(s)} Mbps สำหรับค่าที่ตั้ง)`},
    {t:'select',k:'mime',l:'รูปแบบไฟล์',o:()=>MIMES.length?MIMES:[['','ไม่รองรับการอัด']],h:'MP4 เปิดได้แทบทุกโปรแกรม'},
  ]},
  {sec:'เสียง',items:[
    {t:'check',k:'sysAudio',l:'อัดเสียงระบบ / เสียงแท็บ',h:'ต้องติ๊ก “แชร์เสียง” ตอนเลือกจอ · Windows ได้ทั้งจอและแท็บ, macOS ได้เฉพาะแท็บ'},
    {t:'num',k:'sysGain',l:'ระดับเสียงระบบ (%)',min:0,max:300,step:5,when:s=>s.sysAudio},
    {t:'check',k:'mic',l:'อัดเสียงไมโครโฟนด้วย'},
    {t:'select',k:'micId',l:'ไมโครโฟน',o:()=>mics,when:s=>s.mic},
    {t:'num',k:'micGain',l:'ระดับเสียงไมค์ (%)',min:0,max:300,step:5,when:s=>s.mic},
  ]},
  {sec:'การบันทึกไฟล์',items:[
    {t:'select',k:'save',l:'เมื่ออัดเสร็จแต่ละคลิป',o:()=>[['download','ดาวน์โหลดอัตโนมัติ (โฟลเดอร์ Downloads)'],...(CAN_FOLDER?[['folder','บันทึกลงโฟลเดอร์ที่เลือก']]:[]),['memory','เก็บไว้ในหน้านี้ แล้วดาวน์โหลดเองทีหลัง']],
      hs:s=>s.save==='download'?'ครั้งแรก Chrome อาจถามว่าอนุญาตให้ดาวน์โหลดหลายไฟล์ไหม ให้กดอนุญาต':s.save==='memory'?'ปิดหรือรีเฟรชหน้าแล้วคลิปจะหาย':''},
    {t:'folder',k:'folder',l:'โฟลเดอร์',when:s=>s.save==='folder'},
    {t:'text',k:'prefix',l:'ชื่อไฟล์ขึ้นต้นด้วย',h:'ตัวอย่าง: clip_2026-11-20_14-05-12_003.mp4'},
  ]},
  {sec:'การแสดงผลและแจ้งเตือน',items:[
    {t:'check',k:'surprise',l:'โหมดเซอร์ไพรส์: ไม่บอกว่าจะอัดเมื่อไร',h:'ซ่อนตารางและนับถอยหลัง จะเห็นทั้งหมดเมื่อจบเซสชัน'},
    {t:'check',k:'preview',l:'แสดงภาพพรีวิว',h:'ปิดเพื่อลดภาระเครื่อง'},
    {t:'check',k:'notify',l:'แจ้งเตือนเมื่อเริ่มอัด (ตอนอยู่หน้าต่างอื่น)'},
    {t:'check',k:'beep',l:'เสียงบี๊ปเมื่อเริ่มและจบคลิป',h:'ถ้าอัดเสียงระบบ เสียงบี๊ปจะติดไปในคลิปด้วย'},
  ]},
];
const FIELDS=FORM.flatMap(s=>s.items);
let mics=[['','ไมค์เริ่มต้นของระบบ']];

function autoBitrate(s){const h=s.res==='native'?Math.min(1440,screen.height*(devicePixelRatio||1)):+s.res;const base=h>=2160?20:h>=1440?12:h>=1080?8:h>=720?5:2.5;return Math.round(base*Math.pow(+s.fps/30,.6)*2)/2}
const vbr=s=>(+s.bitrate>0?+s.bitrate:autoBitrate(s))*1e6;

function renderForm(){
  $('#form').innerHTML=FORM.map(sec=>`<section class="sec"><h3>${sec.sec}</h3>${sec.items.map(fieldHTML).join('')}</section>`).join('');
  fillForm();
}
function fieldHTML(f){
  const id='f-'+(Array.isArray(f.k)?f.k[0]:f.k), live=LIVE.has(f.k)?' data-live':'';
  const hint=`<span class="hint" data-hint="${f.k}">${esc(f.h||'')}</span>`;
  let body;
  switch(f.t){
    case'dur':body=`<span class="lbl">${f.l}</span>${durHTML(f.k,f.l)}`;break;
    case'range':body=`<span class="lbl">${f.l}</span><div class="range">${durHTML(f.k[0],f.l+' ต่ำสุด')}<em>ถึง</em>${durHTML(f.k[1],f.l+' สูงสุด')}</div>`;break;
    case'num':body=`<label for="${id}">${f.l}</label><input id="${id}" type="number" data-k="${f.k}" min="${f.min??''}" max="${f.max??''}" step="${f.step??'any'}">`;break;
    case'text':body=`<label for="${id}">${f.l}</label><input id="${id}" type="text" data-k="${f.k}" maxlength="40" spellcheck="false">`;break;
    case'select':body=`<label for="${id}">${f.l}</label><select id="${id}" data-k="${f.k}"></select>`;break;
    case'check':body=`<label class="check"><input type="checkbox" data-k="${f.k}"><span>${f.l}</span></label>`;break;
    case'folder':body=`<span class="lbl">${f.l}</span><div class="folder"><button class="btn sm" id="pickDir" type="button">เลือกโฟลเดอร์</button><span id="dirName">ยังไม่ได้เลือก</span></div>`;break;
  }
  return`<div class="f" data-f="${Array.isArray(f.k)?f.k.join(','):f.k}"${live}>${body}${hint}</div>`;
}
function fillSelect(f){
  const el=$(`select[data-k="${f.k}"]`);if(!el)return;
  const opts=typeof f.o==='function'?f.o():f.o;
  el.innerHTML=opts.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('');
  if(!opts.some(([v])=>String(v)===String(S[f.k])))S[f.k]=f.k==='fps'?+opts[0][0]:opts[0][0];
  el.value=String(S[f.k]);
}
function setDur(k){
  const w=$(`.dur[data-dur="${k}"]`);if(!w)return;const v=+S[k]||0;
  const u=v>=3600&&v%3600===0?3600:v>=60&&v%60===0?60:1;
  w.querySelector('select').value=u;w.querySelector('input').value=+(v/u).toFixed(3);
}
function fillForm(){
  for(const f of FIELDS){
    if(f.t==='dur')setDur(f.k);
    else if(f.t==='range'){setDur(f.k[0]);setDur(f.k[1])}
    else if(f.t==='select')fillSelect(f);
    else if(f.t==='check')$(`input[data-k="${f.k}"]`).checked=!!S[f.k];
    else if(f.t==='num'||f.t==='text')$(`input[data-k="${f.k}"]`).value=S[f.k];
  }
  showDir();refreshForm();
}
function refreshForm(){ /* visibility, dynamic hints, locking */
  const locked=R.phase==='running'||R.phase==='paused'||R.phase==='starting';
  for(const f of FIELDS){
    const key=Array.isArray(f.k)?f.k.join(','):f.k, w=$(`[data-f="${key}"]`);if(!w)continue;
    w.hidden=f.when?!f.when(S):false;
    if(f.hs){const h=w.querySelector('.hint');h.textContent=f.hs(S)||f.h||''}
    const off=locked&&!w.hasAttribute('data-live');
    w.querySelectorAll('input,select,button').forEach(el=>el.disabled=off);
  }
  $('#presetSel').disabled=$('#presetSave').disabled=locked;$('#presetDel').disabled=locked||!presets[$('#presetSel').value];
  renderEstimate();
}
function onField(e){
  const t=e.target, dur=t.closest('.dur');let k;
  if(dur){k=dur.dataset.dur;const n=parseFloat(dur.querySelector('input').value);S[k]=Math.max(0,(isFinite(n)?n:0)*+dur.querySelector('select').value)}
  else if(t.dataset.k){
    k=t.dataset.k;
    if(t.type==='checkbox')S[k]=t.checked;
    else if(t.type==='number'){const n=parseFloat(t.value);S[k]=isFinite(n)?Math.max(0,n):0}
    else if(k==='fps')S[k]=+t.value;
    else S[k]=t.value;
  }else return;
  saveS();
  if(k==='notify'&&S.notify&&'Notification' in window&&Notification.permission==='default')Notification.requestPermission();
  if(k==='mic'&&S.mic)loadMics(true);
  if(k==='preview')applyPreview();
  if(LIVE.has(k)){refreshForm();R.dirtyPlan=true;render();return}
  refreshForm();
  if(SCHED.includes(k))schedulePreview();
}
let prevT;
function schedulePreview(){clearTimeout(prevT);prevT=setTimeout(()=>{if(R.phase==='idle'||R.phase==='done')newPreview()},180)}

async function loadMics(ask){
  try{
    if(ask){const s=await navigator.mediaDevices.getUserMedia({audio:true});s.getTracks().forEach(t=>t.stop())}
    const list=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput'&&d.deviceId&&d.deviceId!=='default'&&d.deviceId!=='communications');
    mics=[['','ไมค์เริ่มต้นของระบบ'],...list.map((d,i)=>[d.deviceId,d.label||`ไมโครโฟน ${i+1}`])];
    fillSelect(FIELDS.find(f=>f.k==='micId'));
  }catch(e){if(ask)toast('ไม่ได้รับสิทธิ์ใช้ไมโครโฟน')}
}

/* Presets */
function renderPresets(sel=''){
  const b=Object.keys(BUILTIN),c=Object.keys(presets);
  $('#presetSel').innerHTML=`<option value="">พรีเซ็ต…</option><optgroup label="สำเร็จรูป">${b.map(n=>`<option value="b:${esc(n)}">${esc(n)}</option>`).join('')}</optgroup>${c.length?`<optgroup label="ของฉัน">${c.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('')}</optgroup>`:''}`;
  $('#presetSel').value=sel;refreshForm();
}
function applyPreset(v){
  if(!v)return;
  if(v.startsWith('b:')){const p=BUILTIN[v.slice(2)];if(!p)return;const base={};SCHED.forEach(k=>base[k]=DEF[k]);S=Object.assign({},S,base,p)}
  else if(presets[v])S=Object.assign({},S,presets[v]);
  saveS();fillForm();newPreview();toast('ใช้พรีเซ็ตแล้ว');
}

/* ---------- Schedule ---------- */
const HORIZON=2*3600e3;
const total=c=>c.durUnlimited?Infinity:c.dur*1000;
/* Clips as {start,len} in ms of session time (paused time excluded). */
function makePlan(c,fromT,prevEnd,count,horizon){
  const T=total(c),max=c.maxClips>0?c.maxClips:Infinity,out=[];
  const lo=Math.min(c.clipMin,c.clipMax),hi=Math.max(c.clipMin,c.clipMax);
  const clipLen=()=>Math.max(1000,Math.round(rand(lo,hi)*10)*100);
  const minLen=Math.max(1000,lo*1000);
  const fit=(st,len)=>st+len<=T?len:(T-st>=minLen?T-st:0);
  const first=()=>rand(c.firstMin,Math.max(c.firstMin,c.firstMax))*1000;
  const cd=()=>rand(c.cdMin,Math.max(c.cdMin,c.cdMax))*1000;
  if(c.mode==='spread'&&isFinite(T)&&isFinite(max)){
    const n=max-count;if(n<=0)return out;
    const begin=prevEnd==null?fromT+first():Math.max(fromT,prevEnd+c.cdMin*1000);
    const slot=(T-begin)/n;let pe=prevEnd;
    for(let k=0;k<n;k++){
      let len=clipLen();const s0=begin+k*slot,s1=s0+slot;
      const a=Math.max(s0,pe==null?begin:pe+c.cdMin*1000),b=s1-len;
      const st=a<b?rand(a,b):a;len=fit(st,len);if(!len)break;
      out.push({start:st,len});pe=st+len;
    }
    return out;
  }
  let t;
  if(prevEnd==null)t=fromT+first();
  else{t=prevEnd+cd();if(t<fromT)t=fromT+rand(0,Math.max(0,c.cdMax-c.cdMin))*1000}
  const stop=Math.min(T,horizon??Infinity);
  while(count+out.length<max&&t<stop){
    const len=fit(t,clipLen());if(!len)break;
    out.push({start:t,len});t+=len+cd();
  }
  return out;
}
const entry=p=>({start:p.start,len:p.len,state:'plan'});
function newPreview(){R.plan=makePlan(S,0,null,0,S.durUnlimited?HORIZON:undefined).map(entry);R.acc=0;if(R.phase==='done')setPhase('idle');R.dirtyPlan=true;render()}

function validate(c){
  const err=[],warn=[];
  if(!CAN_SHARE)err.push('เบราว์เซอร์นี้อัดหน้าจอไม่ได้ ใช้ Chrome, Edge หรือ Firefox บนคอมพิวเตอร์');
  else if(!MIMES.length)err.push('เบราว์เซอร์นี้ไม่รองรับ MediaRecorder');
  if(c.clipMin<1)err.push('ความยาวคลิปต่ำสุดต้องอย่างน้อย 1 วินาที');
  if(c.clipMin>c.clipMax)err.push('ความยาวคลิป: ค่าต่ำสุดมากกว่าสูงสุด');
  if(c.cdMin>c.cdMax&&c.mode!=='spread')err.push('คูลดาวน์: ค่าต่ำสุดมากกว่าสูงสุด');
  if(c.firstMin>c.firstMax)err.push('รอก่อนคลิปแรก: ค่าต่ำสุดมากกว่าสูงสุด');
  if(!c.durUnlimited&&c.dur<=0)err.push('ตั้งระยะเวลารันก่อน');
  else if(!c.durUnlimited&&c.firstMin+Math.max(1,c.clipMin)>c.dur)err.push('ระยะเวลารันสั้นเกินกว่าจะได้แม้แต่คลิปเดียว');
  if(c.manualLen<1)err.push('ความยาว “อัดตอนนี้” ต้องอย่างน้อย 1 วินาที');
  if(c.mode==='spread'){
    if(c.durUnlimited||!(c.maxClips>0))err.push('โหมดกระจายต้องกำหนดระยะเวลารันและจำนวนคลิปสูงสุด');
    else if(c.maxClips*(c.clipMax+c.cdMin)>c.dur-c.firstMin)warn.push('จำนวนคลิปมากเกินเวลา อาจได้ไม่ครบหรือคูลดาวน์สั้นกว่าที่ตั้ง');
  }
  if(c.cdMin<3&&c.mode!=='spread')warn.push('คูลดาวน์สั้นมาก คลิปจะต่อกันแทบไม่มีช่วงพัก');
  if(c.save==='folder'&&!R.dir)warn.push('ยังไม่ได้เลือกโฟลเดอร์บันทึก');
  if(c.save==='memory'&&c.durUnlimited)warn.push('เก็บในหน้านี้ + ไม่จำกัดเวลา อาจกินหน่วยความจำมาก');
  return{err,warn};
}
function renderEstimate(){
  const v=validate(S);let row='';
  if(!v.err.length){
    const runs=150,unl=S.durUnlimited;let mn=Infinity,mx=0,n=0,sec=0;
    for(let i=0;i<runs;i++){const p=makePlan(S,0,null,0,unl?3600e3:undefined);mn=Math.min(mn,p.length);mx=Math.max(mx,p.length);n+=p.length;sec+=p.reduce((a,x)=>a+x.len,0)/1000}
    n/=runs;sec/=runs;
    const bytes=sec*(vbr(S)+(S.sysAudio||S.mic?160e3:0))/8;
    row=`<div class="row"><span>${unl?'ชั่วโมงแรก ':''}≈ <b>${mn===mx?mn:`${mn}–${mx}`}</b> คลิป</span><span>รวม <b>${human(sec)}</b></span><span>ไฟล์ ≈ <b>${size(bytes)}</b></span></div>`;
  }
  $('#estimate').innerHTML=row+(v.err.length||v.warn.length?`<ul>${v.err.map(e=>`<li class="err">${esc(e)}</li>`).join('')}${v.warn.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>`:'');
  if(R.phase==='idle'||R.phase==='done')$('#startBtn').disabled=!!v.err.length;
}

/* ---------- Session state ---------- */
const R={phase:'idle',acc:0,resumeAt:0,plan:[],files:[],cur:null,cfg:null,display:null,mic:null,ac:null,stream:null,mime:'',vbr:0,dir:null,n:0,wl:null,dirtyPlan:true,dirtyFiles:true,span:0};
const elapsed=()=>R.acc+(R.phase==='running'?performance.now()-R.resumeAt:0);
const nextPlanned=()=>R.plan.find(p=>p.state==='plan');
const tickW=new Worker(URL.createObjectURL(new Blob(['let i;onmessage=e=>{clearInterval(i);if(e.data)i=setInterval(()=>postMessage(0),e.data)}'],{type:'text/javascript'})));
tickW.onmessage=tick;

async function start(){
  const c={...S},v=validate(c);
  if(v.err.length)return toast(v.err[0]);
  if(c.save==='folder'){
    if(!R.dir)return toast('เลือกโฟลเดอร์บันทึกก่อน');
    if(await R.dir.queryPermission({mode:'readwrite'})!=='granted'){
      if(await R.dir.requestPermission({mode:'readwrite'})!=='granted')return toast('ไม่ได้รับสิทธิ์เขียนโฟลเดอร์');
      return toast('ได้สิทธิ์โฟลเดอร์แล้ว กด “เริ่ม” อีกครั้ง');
    }
  }
  const back=R.phase;setPhase('starting');
  try{await acquire(c)}
  catch(e){release();setPhase(back);toast(e.name==='NotAllowedError'||e.name==='AbortError'?'ยกเลิกการเลือกหน้าจอ':'เริ่มไม่ได้: '+e.message,4500);return}
  R.cfg=c;
  R.mime=MIMES.some(([m])=>m===c.mime)?c.mime:MIMES[0][0];R.vbr=vbr(c);
  if(R.plan.some(p=>p.state!=='plan')||!R.plan.length)R.plan=makePlan(c,0,null,0,c.durUnlimited?HORIZON:undefined).map(entry);
  R.acc=0;R.resumeAt=performance.now();
  setPhase('running');tickW.postMessage(200);wake(true);
  if(c.sysAudio&&!R.display.getAudioTracks().length)toast('ไม่ได้เสียงระบบ: ตอนเลือกจอต้องติ๊ก “แชร์เสียง” (macOS อัดเสียงได้เฉพาะแท็บ)',6000);
  else toast(S.surprise?'เริ่มแล้ว แอปจะสุ่มอัดโดยไม่บอกล่วงหน้า':'เริ่มแล้ว');
  tick();
}
async function acquire(c){
  const video={frameRate:{ideal:+c.fps,max:+c.fps},displaySurface:c.surface};
  if(c.res!=='native'){video.height={max:+c.res};video.width={max:Math.round(+c.res*16/9*1.6)}}
  const audio=c.sysAudio?{echoCancellation:false,noiseSuppression:false,autoGainControl:false,suppressLocalAudioPlayback:false}:false;
  R.display=await navigator.mediaDevices.getDisplayMedia({video,audio,systemAudio:c.sysAudio?'include':'exclude',selfBrowserSurface:'exclude',surfaceSwitching:'include',monitorTypeSurfaces:'include'});
  const vt=R.display.getVideoTracks()[0];
  vt.onended=()=>finish('หยุดแชร์หน้าจอแล้ว');
  if(c.mic){
    try{R.mic=await navigator.mediaDevices.getUserMedia({audio:{deviceId:c.micId?{exact:c.micId}:undefined,echoCancellation:true,noiseSuppression:true}})}
    catch(e){R.mic=null;toast('ใช้ไมโครโฟนไม่ได้ อัดต่อโดยไม่มีไมค์',4500)}
  }
  const sys=R.display.getAudioTracks()[0],mic=R.mic?.getAudioTracks()[0];
  let at=sys||mic||null;
  if((sys&&mic)||(sys&&c.sysGain!==100)||(mic&&c.micGain!==100)){
    R.ac=new AudioContext();const dest=R.ac.createMediaStreamDestination();
    for(const [t,g] of [[sys,c.sysGain],[mic,c.micGain]]){if(!t)continue;const gn=R.ac.createGain();gn.gain.value=g/100;R.ac.createMediaStreamSource(new MediaStream([t])).connect(gn).connect(dest)}
    R.ac.resume().catch(()=>{});at=dest.stream.getAudioTracks()[0];
  }
  R.stream=new MediaStream(at?[vt,at]:[vt]);
  applyPreview();
}
function release(){
  R.display?.getTracks().forEach(t=>{t.onended=null;t.stop()});R.mic?.getTracks().forEach(t=>t.stop());R.ac?.close().catch(()=>{});
  R.display=R.mic=R.ac=R.stream=null;applyPreview();wake(false);
}
function applyPreview(){
  const v=$('#preview'),on=!!R.display&&S.preview;
  v.srcObject=on?new MediaStream(R.display.getVideoTracks()):null;
  $('#stage').classList.toggle('live',on);$('#stage').classList.toggle('nopreview',!!R.display&&!S.preview);
}

function tick(){
  if(R.phase==='running'){
    const c=R.cfg,T=total(c);let t=elapsed();
    if(R.cur&&t>=R.cur.entry.start+R.cur.entry.len)stopClip(false);
    if(!R.cur){
      for(let nx=nextPlanned();nx&&t>=nx.start;nx=nextPlanned()){
        const rem=nx.start+nx.len-t;
        if(rem>=Math.min(1000,nx.len)){startClip(nx);break}
        nx.state='skip';R.dirtyPlan=true; /* missed (computer slept) */
      }
    }
    if(c.durUnlimited)extend(t);
    const left=nextPlanned();
    if(!R.cur&&(t>=T||(!left&&c.maxClips>0&&R.plan.filter(p=>!p.manual&&p.state==='done').length>=c.maxClips)))finish(t>=T?'ครบเวลาแล้ว':'ครบจำนวนคลิปแล้ว');
  }
  render();
}
function extend(t){
  const plans=R.plan.filter(p=>p.state==='plan');const last=R.plan.filter(p=>!p.manual&&p.state!=='skip').at(-1);
  if(plans.length>3&&plans.at(-1).start>t+HORIZON/2)return;
  const end=last?last.start+last.len:null,from=end??t;
  const add=makePlan(R.cfg,Math.max(from,t),end,R.plan.filter(p=>!p.manual&&p.state!=='skip').length,t+HORIZON).filter(p=>!last||p.start>last.start);
  if(add.length){R.plan.push(...add.map(entry));R.dirtyPlan=true}
}

function startClip(e){
  let rec;
  try{rec=new MediaRecorder(R.stream,{mimeType:R.mime,videoBitsPerSecond:R.vbr,audioBitsPerSecond:R.stream.getAudioTracks().length?160000:undefined})}
  catch(err){e.state='fail';R.dirtyPlan=true;toast('เริ่มอัดไม่ได้: '+err.message+' ลองเปลี่ยนรูปแบบไฟล์เป็น WebM',6000);return}
  const idx=++R.n,now=new Date();
  const name=`${(S.prefix||'clip').replace(/[\\/:*?"<>|]+/g,'-')}_${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}_${String(idx).padStart(3,'0')}.${ext(R.mime)}`;
  const file={id:idx+'-'+now.getTime(),idx,wall:now,name,size:0,state:'rec',manual:!!e.manual,cut:false,t0:performance.now(),plannedLen:e.len};
  const chunks=[];
  rec.ondataavailable=ev=>{if(ev.data.size){chunks.push(ev.data);file.size+=ev.data.size}};
  rec.onerror=ev=>toast('การอัดผิดพลาด: '+(ev.error?.message||'ไม่ทราบสาเหตุ'),5000);
  const done=new Promise(res=>rec.onstop=res);
  rec.start(1000);
  e.state='rec';e.file=file.id;file.entry=e;
  R.files.unshift(file);R.cur={entry:e,rec,file,chunks,done};
  R.dirtyPlan=R.dirtyFiles=true;
  cue(`เริ่มอัดคลิป #${idx}`,`ยาว ${human(e.len/1000)}`);beep(880);
}
async function stopClip(cut){
  const cur=R.cur;if(!cur)return;R.cur=null;
  const e=cur.entry,f=cur.file;
  if(cut){e.len=Math.max(200,elapsed()-e.start);f.cut=true}
  e.state='done';R.dirtyPlan=true;
  if(cur.rec.state!=='inactive')cur.rec.stop();
  await cur.done;beep(560);
  f.dur=(performance.now()-f.t0)/1000;
  f.blob=new Blob(cur.chunks,{type:R.mime.split(';')[0]});f.size=f.blob.size;
  if(!f.size){f.state='fail';f.err='ไฟล์ว่าง ไม่มีข้อมูลวิดีโอ';e.state='fail';R.dirtyFiles=R.dirtyPlan=true;render();return}
  f.url=URL.createObjectURL(f.blob);f.state='saving';R.dirtyFiles=true;render();
  const mode=R.cfg.save;
  try{
    if(mode==='folder'){const h=await R.dir.getFileHandle(f.name,{create:true});const w=await h.createWritable();await w.write(f.blob);await w.close();f.state='folder'}
    else if(mode==='download'){download(f.url,f.name);f.state='downloaded'}
    else f.state='memory';
  }catch(err){f.state='memory';f.err='บันทึกไม่สำเร็จ ('+err.message+') ยังดาวน์โหลดจากรายการได้';toast(f.err,6000)}
  /* outside "keep in page" mode, keep only the newest 30 clips in memory for preview */
  if(mode!=='memory')R.files.filter(x=>x.url&&x.state!=='memory').slice(30).forEach(x=>{URL.revokeObjectURL(x.url);x.url=null;x.blob=null;x.released=true});
  R.dirtyFiles=true;render();
}
function download(url,name){const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove()}

function pauseToggle(){
  if(R.phase==='running'){if(R.cur)stopClip(true);R.acc=elapsed();setPhase('paused');toast('พักแล้ว เวลาจะไม่เดินจนกว่าจะกดทำต่อ')}
  else if(R.phase==='paused'){R.resumeAt=performance.now();setPhase('running');tick()}
}
function manual(){
  if(R.phase!=='running'||R.cur)return;
  const t=elapsed(),len=Math.min(R.cfg.manualLen*1000,total(R.cfg)-t);if(len<1000)return;
  const e={start:t,len,state:'plan',manual:true};
  let skipped=0;for(const p of R.plan)if(p.state==='plan'&&p.start<t+len){p.state='skip';skipped++}
  R.plan.push(e);R.plan.sort((a,b)=>a.start-b.start);startClip(e);
  if(skipped)toast(`ข้ามคลิปที่สุ่มไว้ ${skipped} คลิปที่ทับเวลานี้`);
}
function skipNext(){const n=nextPlanned();if(!n)return;n.state='skip';R.dirtyPlan=true;toast('ข้ามคลิปถัดไปแล้ว');render()}
function reroll(){
  if(R.phase==='idle'||R.phase==='done'){newPreview();return toast(S.surprise?'สุ่มใหม่แล้ว (ซ่อนไว้)':'สุ่มตารางใหม่แล้ว')}
  const c=R.cfg,keep=R.plan.filter(p=>p.state!=='plan'),real=keep.filter(p=>!p.manual&&p.state!=='skip');
  const t=elapsed(),last=keep.filter(p=>p.state!=='skip').at(-1),end=last?last.start+last.len:null;
  R.plan=keep.concat(makePlan(c,Math.max(t,end??0),end,real.length,c.durUnlimited?t+HORIZON:undefined).map(entry));
  R.dirtyPlan=true;render();toast('สุ่มเวลาที่เหลือใหม่แล้ว');
}
async function finish(reason){
  if(!['running','paused','starting'].includes(R.phase))return;
  const early=R.cur&&elapsed()<R.cur.entry.start+R.cur.entry.len;
  const p=R.cur?stopClip(early):null;
  R.acc=elapsed();tickW.postMessage(0);
  if(R.cfg.durUnlimited)R.plan=R.plan.filter(e=>e.state!=='plan'); /* an endless plan has nothing worth showing */
  for(const e of R.plan)if(e.state==='plan')e.state='skip';
  setPhase('done');R.dirtyPlan=true;
  await p;release();
  const n=R.plan.filter(e=>e.state==='done').length;
  toast(`${reason} · ได้ ${n} คลิป`,5000);cue('จบเซสชัน',`${reason} · ได้ ${n} คลิป`);render();
}
function stopAsk(){
  const left=R.plan.filter(p=>p.state==='plan').length;
  if(left&&!confirm(`ยังเหลือคลิปที่สุ่มไว้ ${left} คลิป หยุดเลยไหม?`))return;
  finish('หยุดแล้ว');
}

function cue(title,body){if(S.notify&&document.hidden&&'Notification' in window&&Notification.permission==='granted'){try{new Notification(title,{body,silent:true,tag:'random-clips',icon:'icon.svg'})}catch(e){}}}
let beepAC;
function beep(f){if(!S.beep)return;try{beepAC=beepAC||new AudioContext();const o=beepAC.createOscillator(),g=beepAC.createGain(),t=beepAC.currentTime;o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.2,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.18);o.connect(g).connect(beepAC.destination);o.start(t);o.stop(t+.2)}catch(e){}}
async function wake(on){
  try{if(on&&'wakeLock' in navigator&&document.visibilityState==='visible'&&!R.wl){R.wl=await navigator.wakeLock.request('screen');R.wl.onrelease=()=>R.wl=null}
  else if(!on&&R.wl){await R.wl.release();R.wl=null}}catch(e){}
}

/* ---------- Render ---------- */
const PH={idle:['idle','พร้อม'],starting:['starting','กำลังเลือกหน้าจอ…'],running:['wait','รอ'],paused:['paused','พักอยู่'],done:['done','จบเซสชัน']};
function setPhase(p){
  R.phase=p;
  const active=p==='running'||p==='paused';
  const sb=$('#startBtn');sb.textContent=active?'หยุด':p==='starting'?'รอ…':'เริ่ม';sb.className='btn '+(active?'danger':'primary');sb.disabled=p==='starting';
  $('#pauseBtn').disabled=!active;$('#pauseBtn').innerHTML=(p==='paused'?'ทำต่อ':'พัก')+' <kbd>P</kbd>';
  refreshForm();render();
}
function render(){
  const p=R.phase,c=R.cfg&&(p!=='idle')?R.cfg:S,T=total(c),t=elapsed(),hide=S.surprise&&p!=='done';
  const rec=!!R.cur,nx=nextPlanned();
  /* status + HUD */
  const [s,label]=rec?['rec','กำลังอัด']:PH[p];
  $('#status').dataset.s=s;$('#statusText').textContent=label;
  let big,sub;
  if(rec){const e=R.cur.entry;big=`${fmt(t-e.start)} / ${fmt(e.len)}`;sub=`กำลังอัดคลิป #${R.cur.file.idx}${e.manual?' (กดเอง)':''}`}
  else if(p==='running'){big=hide?'••:••':nx?fmt(nx.start-t):'—';sub=hide?'รอสุ่ม… ไม่บอกล่วงหน้า':nx?`คลิปถัดไปยาว ${human(nx.len/1000)}`:'ไม่มีคลิปที่สุ่มไว้แล้ว'}
  else if(p==='paused'){big='พัก';sub='กด ทำต่อ หรือ P'}
  else if(p==='starting'){big='…';sub='เลือกหน้าจอในหน้าต่างของเบราว์เซอร์'}
  else if(p==='done'){big='เสร็จ';sub=`ได้ ${R.plan.filter(e=>e.state==='done').length} คลิป · กด เริ่ม เพื่อรอบใหม่`}
  else{big='พร้อม';sub='กด เริ่ม แล้วเลือกหน้าจอที่จะอัด'}
  $('#hudBig').textContent=big;$('#hudSub').textContent=sub;$('#hud').classList.toggle('rec',rec);
  document.title=rec?`● REC #${R.cur.file.idx} · Random Clips`:p==='running'&&!hide&&nx?`${fmt(nx.start-t)} · Random Clips`:p==='paused'?'พัก · Random Clips':"Senritha's Random Clips";
  $('#manualBtn').disabled=p!=='running'||rec;$('#skipBtn').disabled=p!=='running'||!nx||hide;
  /* timeline */
  const vis=R.plan.filter(e=>!hide||e.state==='rec'||e.state==='done'||e.state==='fail');
  const span=isFinite(T)?T:Math.max(3600e3,Math.ceil(Math.max(t+60e3,...(hide?[0]:R.plan.map(e=>e.start+e.len)))/3600e3)*3600e3);
  if(R.dirtyPlan||span!==R.span){
    R.span=span;R.dirtyPlan=false;
    $('#tlTrack').innerHTML=vis.map((e,i)=>`<i class="${e.state}${e.manual?' manual':''}" style="left:${e.start/span*100}%;width:${e.len/span*100}%" title="${e.manual?'กดเอง · ':''}${{plan:'สุ่มไว้',rec:'กำลังอัด',done:'อัดแล้ว',skip:'ข้าม',fail:'ล้มเหลว'}[e.state]} · เริ่ม ${fmt(e.start)} · ยาว ${human(e.len/1000)}"></i>`).join('');
    $('#tlAxis').innerHTML=[0,.25,.5,.75,1].map(f=>`<span style="left:${f*100}%">${fmt(span*f)}</span>`).join('');
    const planned=R.plan.filter(e=>!e.manual&&e.state!=='skip').length;
    $('#tlInfo').textContent=hide?'โหมดเซอร์ไพรส์: ซ่อนตารางไว้':p==='idle'?`ตัวอย่างตาราง ${planned} คลิป${isFinite(T)?'':' (2 ชม. แรก)'} · ใช้ตารางนี้ตอนกดเริ่ม`:p==='done'?'ผลของเซสชันล่าสุด':`สุ่มไว้ ${planned} คลิป${isFinite(T)?'':' (ต่อเติมเรื่อย ๆ)'}`;
  }
  $('#tlHead').style.left=Math.min(100,t/span*100)+'%';$('#tlHead').hidden=p==='idle';
  $('#rerollBtn').disabled=p==='starting';
  /* stats */
  $('#stElapsed').textContent=fmt(t);
  $('#stLeft').textContent=isFinite(T)?fmt(T-t):'ไม่จำกัด';
  const done=R.plan.filter(e=>e.state==='done').length,planned=R.plan.filter(e=>e.state!=='skip'&&e.state!=='fail').length;
  $('#stClips').textContent=hide||!isFinite(T)?String(done):`${done} / ${planned}`;
  const bytes=R.files.reduce((a,f)=>a+(f.size||0),0);$('#stSize').textContent=size(bytes);
  if(R.dirtyFiles)renderFiles();
  else if(R.cur){const row=document.querySelector(`[data-id="${R.cur.file.id}"] .live`);if(row)row.textContent=`${fmt(t-R.cur.entry.start)} · ${size(R.cur.file.size)}`}
}
const IC={
  play:'<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  dl:'<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/></svg>',
  del:'<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7"/></svg>',
};
const STATE={rec:'กำลังอัด…',saving:'กำลังบันทึก…',folder:'บันทึกลงโฟลเดอร์แล้ว',downloaded:'ดาวน์โหลดแล้ว',memory:'อยู่ในหน้านี้ ยังไม่ได้ดาวน์โหลด',fail:'ล้มเหลว'};
function renderFiles(){
  R.dirtyFiles=false;
  $('#clips').innerHTML=R.files.map(f=>{
    const live=f.state==='rec';
    return`<li class="clip${live?' rec':''}" data-id="${f.id}">
      <button class="thumb" data-act="play" ${f.url?'':'disabled'} aria-label="เล่นคลิป #${f.idx}">${f.url?`<video src="${f.url}#t=0.1" preload="metadata" muted></video>${IC.play}`:live?'<span class="dot"></span>':''}</button>
      <div class="meta">
        <b>#${String(f.idx).padStart(3,'0')} · ${clock(f.wall)}${f.manual?'<em>กดเอง</em>':''}${f.cut?'<em>ถูกตัด</em>':''}</b>
        <span${live?' class="live"':''}>${live?'00:00 · 0 MB':`${human(f.dur||0)} · ${size(f.size)} · ${STATE[f.state]}${f.released?' (ล้างพรีวิวแล้ว)':''}`}</span>
        ${f.err?`<span class="err">${esc(f.err)}</span>`:''}
        <code>${esc(f.name)}</code>
      </div>
      <div class="acts">
        <button class="ib" data-act="dl" ${f.url?'':'disabled'} aria-label="ดาวน์โหลด" title="ดาวน์โหลด">${IC.dl}</button>
        <button class="ib" data-act="del" ${live||f.state==='saving'?'disabled':''} aria-label="ลบจากรายการ" title="ลบจากรายการ (ไฟล์ที่บันทึกแล้วไม่ถูกลบ)">${IC.del}</button>
      </div></li>`}).join('');
  $('#clipsEmpty').hidden=R.files.length>0;
  $('#clipCount').textContent=R.files.length;
  $('#dlAll').disabled=!R.files.some(f=>f.url);
  $('#clearAll').disabled=!R.files.some(f=>f.state!=='rec'&&f.state!=='saving');
}
function onClipAct(e){
  const b=e.target.closest('[data-act]');if(!b||b.disabled)return;
  const f=R.files.find(x=>x.id===b.closest('.clip').dataset.id);if(!f)return;
  if(b.dataset.act==='play'){const d=$('#player');d.querySelector('video').src=f.url;$('#playerName').textContent=f.name;d.showModal();d.querySelector('video').play().catch(()=>{})}
  else if(b.dataset.act==='dl'){download(f.url,f.name);if(f.state==='memory'){f.state='downloaded';R.dirtyFiles=true;render()}}
  else if(b.dataset.act==='del'){
    if(f.state==='memory'&&!confirm('คลิปนี้ยังไม่ได้ดาวน์โหลด ลบเลยไหม?'))return;
    if(f.url)URL.revokeObjectURL(f.url);R.files=R.files.filter(x=>x!==f);R.dirtyFiles=true;render();
  }
}

/* Folder */
function showDir(){const el=$('#dirName');if(el)el.textContent=R.dir?R.dir.name:'ยังไม่ได้เลือก'}
async function pickDir(){
  try{R.dir=await window.showDirectoryPicker({id:'random-clips',mode:'readwrite',startIn:'videos'});await idb.set('dir',R.dir);showDir();refreshForm();toast(`จะบันทึกลง “${R.dir.name}”`)}
  catch(e){if(e.name!=='AbortError')toast('เลือกโฟลเดอร์ไม่ได้: '+e.message)}
}

/* ---------- Wire up ---------- */
renderForm();renderPresets();newPreview();setPhase('idle');
if(CAN_FOLDER)idb.get('dir').then(h=>{if(h){R.dir=h;showDir();refreshForm()}}).catch(()=>{});
if(S.mic)loadMics(false);

$('#form').addEventListener('input',onField);
$('#form').addEventListener('change',onField);
$('#form').addEventListener('click',e=>{if(e.target.closest('#pickDir'))pickDir()});
$('#presetSel').addEventListener('change',e=>{applyPreset(e.target.value);refreshForm()});
$('#presetSave').addEventListener('click',()=>{
  const name=(prompt('ตั้งชื่อพรีเซ็ต')||'').trim();if(!name)return;
  const p={...S};delete p.micId;presets[name]=p;store.set('rc.presets',presets);renderPresets(name);toast(`บันทึกพรีเซ็ต “${name}” แล้ว`);
});
$('#presetDel').addEventListener('click',()=>{const n=$('#presetSel').value;if(!presets[n]||!confirm(`ลบพรีเซ็ต “${n}”?`))return;delete presets[n];store.set('rc.presets',presets);renderPresets()});
$('#startBtn').addEventListener('click',()=>R.phase==='running'||R.phase==='paused'?stopAsk():start());
$('#pauseBtn').addEventListener('click',pauseToggle);
$('#manualBtn').addEventListener('click',manual);
$('#skipBtn').addEventListener('click',skipNext);
$('#rerollBtn').addEventListener('click',reroll);
$('#clips').addEventListener('click',onClipAct);
$('#dlAll').addEventListener('click',async()=>{
  const list=R.files.filter(f=>f.url).reverse();
  for(const f of list){download(f.url,f.name);if(f.state==='memory')f.state='downloaded';await new Promise(r=>setTimeout(r,350))}
  R.dirtyFiles=true;render();
});
$('#clearAll').addEventListener('click',()=>{
  const unsaved=R.files.filter(f=>f.state==='memory').length;
  if(!confirm(unsaved?`มี ${unsaved} คลิปที่ยังไม่ได้ดาวน์โหลด ล้างรายการทั้งหมดไหม?`:'ล้างรายการคลิป? (ไฟล์ที่บันทึกแล้วยังอยู่)'))return;
  R.files=R.files.filter(f=>{if(f.state==='rec'||f.state==='saving')return true;if(f.url)URL.revokeObjectURL(f.url);return false});R.dirtyFiles=true;render();
});
$('#player').addEventListener('close',()=>{const v=$('#player video');v.pause();v.removeAttribute('src');v.load()});
$('#playerClose').addEventListener('click',()=>$('#player').close());
$('#player').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close()});
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,select,textarea')||$('#player').open)return;
  const k=e.key.toLowerCase();
  if(k==='r'){manual();e.preventDefault()}else if(k==='p'){pauseToggle();e.preventDefault()}
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&(R.phase==='running'||R.phase==='paused'))wake(true)});
window.addEventListener('beforeunload',e=>{if(R.phase==='running'||R.phase==='paused'||R.files.some(f=>f.state==='memory')){e.preventDefault();e.returnValue=''}});
if(!CAN_SHARE)toast('เบราว์เซอร์นี้อัดหน้าจอไม่ได้ ใช้ Chrome, Edge หรือ Firefox บนคอมพิวเตอร์',8000);
})();
