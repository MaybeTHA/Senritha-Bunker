/* Senritha's Work Space: channels with unlimited sub-channels, messages with images, reactions,
   threads, edit/delete, pins and search. Everything is saved on this device. */
(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const vib=p=>{try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}};
const ls={get(k,d){try{const v=localStorage.getItem('ws.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('ws.'+k,JSON.stringify(v))}catch(e){}}};
const prefs=Object.assign({name:'Senritha',color:'#57524A',theme:'system',enterSend:true},ls.get('prefs',{}));
const ui=Object.assign({active:null,open:{}},ls.get('ui',{}));
const drafts=ls.get('drafts',{});
const savePrefs=()=>ls.set('prefs',prefs), saveUi=()=>ls.set('ui',ui);
let draftT=0; const saveDrafts=()=>{clearTimeout(draftT);draftT=setTimeout(()=>ls.set('drafts',drafts),300)};
const COLORS=['#57524A','#B4532A','#3F7A5E','#8A560C','#3B6A8F','#7A4E7E','#A23E48','#2F2C28'];
const QUICK=['👍','❤️','😂','🎉','🔥','👀','✅','🙏'];
const EMOJI=['😀','😄','😁','😅','🤣','😊','😍','🥰','😎','🤩','🤔','😴','😮','😢','😭','😤','👍','👎','👏','🙌','🙏','💪','👀','🤝','❤️','🧡','💛','💚','💙','💜','🔥','✨','🎉','🎯','✅','❌','⚠️','💡','📌','📎','🚀','⭐','☕','🍜','🎵','🎮','📷','💯'];
const I={
  chev:'<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  dots:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
  smile:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/></svg>',
  reply:'<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v5"/></svg>',
  edit:'<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  pin:'<svg viewBox="0 0 24 24"><path d="M12 17v5M9 3h6l-1 6 4 4H6l4-4z"/></svg>',
  trash:'<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  copy:'<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
  image:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/></svg>',
  send:'<svg viewBox="0 0 24 24"><path d="M5 12h13M12 5l7 7-7 7"/></svg>',
  x:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  rename:'<svg viewBox="0 0 24 24"><path d="M4 7V5h16v2M9 19h6M12 5v14"/></svg>',
};
const isPhone=()=>matchMedia('(max-width:820px)').matches;
/* scroll only the given scroller (scrollIntoView would also shift the clipped app layout) */
function reveal(el,scroller,center){if(!el||!scroller)return;const r=el.getBoundingClientRect(),s=scroller.getBoundingClientRect();
  const top=scroller.scrollTop+(r.top-s.top)-(center?(s.height-r.height)/2:0);
  if(center||r.top<s.top||r.bottom>s.bottom)scroller.scrollTo({top:center?top:(r.top<s.top?top-8:scroller.scrollTop+(r.bottom-s.bottom)+8),behavior:'smooth'})}
const app=$('#app');

/* ---------- Theme ---------- */
function applyTheme(){if(prefs.theme==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=prefs.theme}
applyTheme();

/* ---------- Data ---------- */
let channels=[]; const cache=new Map(), index=new Map(), urls=new Map();
const ch=id=>channels.find(c=>c.id===id);
const kids=pid=>channels.filter(c=>(c.parentId||null)===(pid||null)).sort((a,b)=>a.order-b.order);
const pathOf=id=>{const p=[];let c=ch(id);while(c){p.unshift(c);c=ch(c.parentId)}return p};
const pathStr=id=>pathOf(id).map(c=>c.name).join(' / ');
const descendants=id=>{const out=[];(function walk(i){kids(i).forEach(k=>{out.push(k);walk(k.id)})})(id);return out};
async function msgsOf(cid){if(!cache.has(cid)){const a=await DB.byIndex('messages','channelId',cid);a.sort((x,y)=>x.created-y.created);a.forEach(m=>index.set(m.id,m));cache.set(cid,a)}return cache.get(cid)}
const repliesOf=m=>(cache.get(m.channelId)||[]).filter(r=>r.parentId===m.id);
async function blobUrl(id){if(urls.has(id))return urls.get(id);const r=await DB.get('blobs',id);const u=r&&r.blob?URL.createObjectURL(r.blob):'';urls.set(id,u);return u}

/* ---------- Formatting ---------- */
function md(t){
  let s=esc(t);const blocks=[],codes=[];
  s=s.replace(/```([\s\S]*?)```/g,(_,c)=>{blocks.push(c.replace(/^\n/,''));return`\u0000${blocks.length-1}\u0000`});
  s=s.replace(/`([^`\n]+)`/g,(_,c)=>{codes.push(c);return`\u0001${codes.length-1}\u0001`});
  s=s.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
  s=s.replace(/\*\*([^*\n]+)\*\*/g,'<b>$1</b>').replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,!?:;])/g,'$1<i>$2</i>').replace(/~~([^~\n]+)~~/g,'<s>$1</s>');
  s=s.replace(/\u0001(\d+)\u0001/g,(_,i)=>`<code>${codes[i]}</code>`).replace(/\u0000(\d+)\u0000/g,(_,i)=>`<pre>${blocks[i]}</pre>`);
  return s;
}
const fmtTime=ts=>new Date(ts).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
function dayLabel(ts){const d=new Date(ts),n=new Date(),y=new Date(n);y.setDate(n.getDate()-1);
  if(d.toDateString()===n.toDateString())return'Today';if(d.toDateString()===y.toDateString())return'Yesterday';
  return d.toLocaleDateString([], {weekday:'long',day:'numeric',month:'long',...(d.getFullYear()!==n.getFullYear()?{year:'numeric'}:{})})}
const ago=ts=>{const s=(Date.now()-ts)/1000;if(s<60)return'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago'};

/* ---------- Toast ---------- */
let toastT=0; function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('on'),2200)}

/* ---------- Channel tree ---------- */
const tree=$('#tree');
function renderTree(freshId){
  const branch=(pid,d)=>kids(pid).map(c=>{const ks=kids(c.id),open=ui.open[c.id]!==false;
    return`<div class="node${open?' open':''}${c.id===freshId?' fresh':''}" data-node="${c.id}" role="treeitem" aria-expanded="${ks.length?open:'false'}">
      <div class="row${c.id===ui.active?' on':''}" style="--d:${d}" data-ch="${c.id}" tabindex="0">
        <button class="tw${ks.length?'':' none'}" data-tw aria-label="${open?'Collapse':'Expand'} ${esc(c.name)}">${I.chev}</button><span class="hash">#</span><span class="nm">${esc(c.name)}</span>
        <span class="row-acts"><button data-addsub aria-label="New sub-channel in ${esc(c.name)}">${I.plus}</button><button data-chmenu aria-label="Options for ${esc(c.name)}">${I.dots}</button></span>
      </div><div class="kids"><div class="kids-in">${branch(c.id,d+1)}</div></div></div>`}).join('');
  tree.innerHTML=channels.length?branch(null,0):'<p class="tree-empty">No channels yet. Press + to make your first one.</p>';
}
tree.addEventListener('click',e=>{
  const row=e.target.closest('.row');if(!row)return;const id=row.dataset.ch;
  if(e.target.closest('[data-tw]')){e.stopPropagation();toggleNode(id);return}
  if(e.target.closest('[data-addsub]')){showNewRow(id);return}
  if(e.target.closest('[data-chmenu]')){chMenu(id,e.target.closest('button'));return}
  openChannel(id);
});
tree.addEventListener('keydown',e=>{const row=e.target.closest('.row');if(!row||e.target!==row)return;
  if(e.key==='Enter')openChannel(row.dataset.ch);else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){const n=row.parentElement,open=n.classList.contains('open');if((e.key==='ArrowRight')!==open)toggleNode(row.dataset.ch)}});
function toggleNode(id){const n=tree.querySelector(`[data-node="${id}"]`);if(!n)return;const open=!n.classList.contains('open');n.classList.toggle('open',open);ui.open[id]=open;saveUi();n.setAttribute('aria-expanded',open)}
function expandTo(id){let c=ch(ch(id)?.parentId);while(c){ui.open[c.id]=true;c=ch(c.parentId)}saveUi()}
function showNewRow(pid){
  if(pid){ui.open[pid]=true;saveUi()}renderTree();
  const host=pid?tree.querySelector(`[data-node="${pid}"] > .kids > .kids-in`):tree, d=pid?pathOf(pid).length:0;
  if(!pid&&!channels.length)tree.innerHTML='';
  const row=document.createElement('div');row.className='newrow';row.style.setProperty('--d',d);
  row.innerHTML=`<input id="newChName" maxlength="60" placeholder="${pid?'Sub-channel name':'Channel name'}" aria-label="${pid?'New sub-channel name':'New channel name'}" autocomplete="off">`;
  host.appendChild(row);const inp=row.querySelector('input');inp.focus({preventScroll:true});reveal(row,$('.side-scroll'));
  let done=false;const finish=async ok=>{if(done)return;done=true;const name=inp.value.trim();row.remove();
    if(ok&&name)await createChannel(pid,name);else renderTree()};
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();finish(true)}else if(e.key==='Escape')finish(false)});
  inp.addEventListener('blur',()=>setTimeout(()=>finish(true),120));
}
async function createChannel(pid,name){
  const c={id:uid(),parentId:pid||null,name:name.slice(0,60),created:Date.now(),order:Date.now()};
  channels.push(c);await DB.put('channels',c);cache.set(c.id,[]);
  if(pid){ui.open[pid]=true;saveUi()}renderTree(c.id);openChannel(c.id);toast(pid?`Sub-channel #${c.name} made`:`Channel #${c.name} made`);vib(8);
}
$('#addRoot').onclick=()=>showNewRow(null);

/* ---------- Popovers / menus ---------- */
let popOpen=null;
function openPop(pop,anchor,align='right'){
  closePops();const r=anchor.getBoundingClientRect();pop.style.left='0px';pop.style.top='0px';pop.classList.add('open');popOpen=pop;
  const w=pop.offsetWidth,h=pop.offsetHeight;let left=align==='right'?r.right-w:r.left,top=r.bottom+6;
  if(top+h>innerHeight-10)top=Math.max(10,r.top-h-6);pop.style.left=clamp(left,10,innerWidth-w-10)+'px';pop.style.top=top+'px';
  pop.style.transformOrigin=(top<r.top?'bottom ':'top ')+(align==='right'?'right':'left');
}
function closePops(){$$('.pop.open').forEach(p=>p.classList.remove('open'));popOpen=null}
document.addEventListener('pointerdown',e=>{if(popOpen&&!e.target.closest('.pop')&&!e.target.closest('[data-popanchor]'))closePops()},true);
$$('[data-closepop]').forEach(b=>b.onclick=closePops);
function menu(anchor,items){const m=$('#menuPop');m.innerHTML=items.map((it,i)=>`<button data-i="${i}" class="${it.danger?'danger':''}" role="menuitem">${it.icon||''}${esc(it.label)}</button>`).join('');
  m.onclick=e=>{const b=e.target.closest('button');if(!b)return;closePops();items[+b.dataset.i].run()};openPop(m,anchor)}
function chMenu(id,anchor){const c=ch(id);menu(anchor,[
  {label:'New sub-channel',icon:I.plus,run:()=>showNewRow(id)},
  {label:'Rename',icon:I.rename,run:()=>renameChannel(c)},
  {label:'Delete channel',icon:I.trash,danger:true,run:()=>deleteChannelAsk(c)}])}
function emojiPick(anchor,cb){const p=$('#emojiPop');p.innerHTML=`<div class="emoji-grid">${EMOJI.map(e=>`<button data-e="${e}" aria-label="${e}">${e}</button>`).join('')}</div>`;
  p.onclick=e=>{const b=e.target.closest('[data-e]');if(!b)return;closePops();cb(b.dataset.e)};openPop(p,anchor)}

/* ---------- Modal & sheet ---------- */
const scrim=$('#scrim'),modal=$('#modal'),sheet=$('#sheet');
function openModal(html,mount){closePops();modal.innerHTML=html;modal.classList.add('open');scrim.classList.add('on');mount&&mount(modal);const f=modal.querySelector('input,button.primary');f&&setTimeout(()=>f.focus(),60)}
function closeModal(){modal.classList.remove('open');if(!sheet.classList.contains('open'))scrim.classList.remove('on')}
function openSheet(html,mount){closePops();sheet.innerHTML='<div class="grab"></div>'+html;sheet.classList.add('open');scrim.classList.add('on');mount&&mount(sheet)}
function closeSheet(){sheet.classList.remove('open');sheet.style.transform='';if(!modal.classList.contains('open'))scrim.classList.remove('on')}
scrim.onclick=()=>{closeModal();closeSheet()};
(()=>{let y0=null,dy=0;sheet.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;y0=e.clientY;dy=0;sheet.style.transition='none'});
  addEventListener('pointermove',e=>{if(y0==null)return;dy=Math.max(0,e.clientY-y0);sheet.style.transform=`translateY(${dy}px)`});
  addEventListener('pointerup',()=>{if(y0==null)return;y0=null;sheet.style.transition='';if(dy>90)closeSheet();else sheet.style.transform=''})})();
function renameChannel(c){
  openModal(`<h3>Rename channel</h3><p class="path">${esc(pathStr(c.id))}</p><form id="rnForm"><label class="field"><span>Name</span><input type="text" id="rnName" maxlength="60" value="${esc(c.name)}"></label>
    <div class="row-btns"><button type="button" class="btn" data-cancel>Cancel</button><button class="btn primary">Save</button></div></form>`,m=>{
    m.querySelector('[data-cancel]').onclick=closeModal;
    m.querySelector('#rnForm').onsubmit=async e=>{e.preventDefault();const n=m.querySelector('#rnName').value.trim();if(!n)return;c.name=n.slice(0,60);await DB.put('channels',c);closeModal();renderTree();if(ui.active===c.id||pathOf(ui.active).includes(c))renderHead();toast('Renamed')}});
}
async function deleteChannelAsk(c){
  const all=[c,...descendants(c.id)];let n=0;for(const x of all)n+=(await msgsOf(x.id)).length;
  const subs=all.length-1;
  openModal(`<h3>Delete #${esc(c.name)}?</h3><p>This removes ${subs?`${subs} sub-channel${subs>1?'s':''} and `:''}${n} message${n===1?'':'s'}, including their images. You can't undo this.</p>
    <div class="row-btns"><button class="btn" data-cancel>Cancel</button><button class="btn danger" data-ok>Delete</button></div>`,m=>{
    m.querySelector('[data-cancel]').onclick=closeModal;
    m.querySelector('[data-ok]').onclick=async()=>{closeModal();await deleteChannel(c);toast(`#${c.name} deleted`);vib(12)}});
}
async function deleteChannel(c){
  const all=[c,...descendants(c.id)],ids=new Set(all.map(x=>x.id));
  for(const x of all){const ms=await msgsOf(x.id);const blobs=ms.flatMap(m=>(m.images||[]).map(i=>i.id));await DB.delMany('messages',ms.map(m=>m.id));await DB.delMany('blobs',blobs);ms.forEach(m=>index.delete(m.id));cache.delete(x.id);await DB.del('channels',x.id)}
  channels=channels.filter(x=>!ids.has(x.id));
  if(ids.has(ui.active)){closeThread(true);const next=c.parentId||(kids(null)[0]||{}).id;ui.active=null;saveUi();renderTree();if(next)openChannel(next,{push:false});else showEmpty()}else renderTree();
}

/* ---------- Composer ---------- */
function makeComposer(slot,opts){
  slot.innerHTML=`<div class="composer"><div class="atts"></div><div class="cbar">
    <label class="icon" aria-label="Add images">${I.image}<input type="file" accept="image/*" multiple class="vh"></label>
    <button class="icon" data-emoji data-popanchor aria-label="Insert emoji">${I.smile}</button>
    <textarea rows="1" aria-label="Message"></textarea><button class="send" disabled aria-label="Send">${I.send}</button></div>
    <div class="chint"><span>**bold** &nbsp;_italic_ &nbsp;\`code\` &nbsp;· paste or drop images</span><span>Enter to send · Shift+Enter for a new line</span></div></div>`;
  const ta=slot.querySelector('textarea'),send=slot.querySelector('.send'),atts=slot.querySelector('.atts'),file=slot.querySelector('input[type=file]');
  let files=[],key=null;
  const size=()=>{ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,180)+'px'};
  const sync=()=>{send.disabled=!ta.value.trim()&&!files.length;size()};
  function add(list){for(const f of list){if(!f.type.startsWith('image/'))continue;if(files.length>=10){toast('Up to 10 images per message');break}
    const a={id:uid(),file:f,url:URL.createObjectURL(f)};a.processed=processImage(f);files.push(a);
    const el=document.createElement('div');el.className='att busy';el.dataset.id=a.id;el.innerHTML=`<img src="${a.url}" alt=""><button aria-label="Remove image">${I.x}</button>`;
    el.querySelector('button').onclick=()=>{files=files.filter(x=>x!==a);el.remove();URL.revokeObjectURL(a.url);sync()};atts.appendChild(el);a.processed.finally(()=>el.classList.remove('busy'))}
    sync();ta.focus()}
  file.onchange=()=>{add(file.files);file.value=''};
  ta.addEventListener('paste',e=>{const imgs=[...(e.clipboardData||{}).files||[]].filter(f=>f.type.startsWith('image/'));if(imgs.length){e.preventDefault();add(imgs)}});
  ta.addEventListener('input',()=>{sync();if(key){drafts[key]=ta.value;saveDrafts()}});
  ta.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&prefs.enterSend&&!isPhone()){e.preventDefault();go()}
    else if(e.key==='ArrowUp'&&!ta.value&&opts.onEditLast){e.preventDefault();opts.onEditLast()}
    else if(e.key==='Escape')ta.blur()});
  slot.querySelector('[data-emoji]').onclick=e=>emojiPick(e.currentTarget,em=>{const s=ta.selectionStart??ta.value.length;ta.value=ta.value.slice(0,s)+em+ta.value.slice(ta.selectionEnd??s);ta.focus();ta.selectionStart=ta.selectionEnd=s+em.length;ta.dispatchEvent(new Event('input'))});
  send.onclick=go;
  async function go(){const text=ta.value;if(!text.trim()&&!files.length)return;const f=files;files=[];atts.innerHTML='';ta.value='';if(key){delete drafts[key];saveDrafts()}sync();ta.focus();
    await opts.onSend({text,files:f})}
  return{add,focus:()=>ta.focus(),setKey(k,ph){key=k;ta.value=drafts[k]||'';ta.placeholder=ph;files.forEach(a=>URL.revokeObjectURL(a.url));files=[];atts.innerHTML='';sync()}};
}
async function processImage(f){
  const dims=src=>new Promise(res=>{const im=new Image();im.onload=()=>res({w:im.naturalWidth,h:im.naturalHeight,im});im.onerror=()=>res({w:800,h:600,im:null});im.src=src});
  const url=URL.createObjectURL(f);const d=await dims(url);
  try{
    if(f.type==='image/gif'||f.size<400*1024||!d.im)return{blob:f,w:d.w,h:d.h};
    const s=Math.min(1,2048/Math.max(d.w,d.h)),w=Math.round(d.w*s),h=Math.round(d.h*s),c=document.createElement('canvas');c.width=w;c.height=h;
    const x=c.getContext('2d'),png=f.type==='image/png'&&f.size<1.5e6;if(!png){x.fillStyle='#fff';x.fillRect(0,0,w,h)}x.drawImage(d.im,0,0,w,h);
    const blob=await new Promise(r=>c.toBlob(r,png?'image/png':'image/jpeg',.86));return{blob:blob&&blob.size<f.size?blob:f,w,h};
  }finally{URL.revokeObjectURL(url)}
}

/* ---------- Messages ---------- */
const msgList=$('#msgList'),msgsEl=$('#msgs'),thList=$('#thList'),thMsgs=$('#thMsgs');
let thread=null;
function imgsHTML(imgs){if(!imgs||!imgs.length)return'';const n=imgs.length,show=imgs.slice(0,n>4?6:4);
  const cls=n===1?'n1':n===2?'n2':n===3?'n3':n===4?'n4':'many';
  return`<div class="imgs ${cls}">${show.map((im,i)=>{const r=n===1?`style="aspect-ratio:${im.w}/${Math.min(im.h,im.w*1.3)}"`:'';
    return`<button class="ph" data-img="${i}" ${r} aria-label="Open image ${i+1}"><img data-blob="${im.id}" alt="">${i===show.length-1&&n>show.length?`<span class="more">+${n-show.length}</span>`:''}</button>`}).join('')}</div>`}
function reactsHTML(m){const r=m.reactions||[];if(!r.length)return'';return`<div class="reacts">${r.map(e=>`<button class="rx" data-rx="${e}" aria-label="Remove ${e}">${e}<b>1</b></button>`).join('')}<button class="rx addrx" data-addrx data-popanchor aria-label="Add reaction">${I.smile}</button></div>`}
function msgHTML(m,o={}){
  const reps=o.thread?[]:repliesOf(m),last=reps[reps.length-1];
  return`<div class="msg${o.cont?' cont':''}${m.pinned?' pinned':''}${o.enter?' enter':''}" data-id="${m.id}">
    <div class="av" style="background:${prefs.color}">${esc((prefs.name||'?').trim().charAt(0).toUpperCase())}</div>
    <div class="mb"><div class="mh"><b>${esc(prefs.name)}</b><time datetime="${new Date(m.created).toISOString()}" title="${new Date(m.created).toLocaleString()}">${fmtTime(m.created)}</time>${m.pinned?`<span class="pinflag">${I.pin}Pinned</span>`:''}</div>
      ${m.text?`<div class="mt">${md(m.text)}${m.edited?'<span class="edited">(edited)</span>':''}</div>`:''}
      ${imgsHTML(m.images)}${reactsHTML(m)}
      ${reps.length?`<button class="replies" data-thread>${I.reply}${reps.length} ${reps.length===1?'reply':'replies'} <small>Last ${ago(last.created)}</small></button>`:''}
    </div>
    <div class="tools" role="toolbar" aria-label="Message actions">
      <button data-act="react" data-popanchor aria-label="Add reaction">${I.smile}</button>${o.thread?'':`<button data-act="reply" aria-label="Reply in thread">${I.reply}</button>`}
      <button data-act="edit" aria-label="Edit message">${I.edit}</button><button data-act="pin" aria-label="${m.pinned?'Unpin':'Pin'} message">${I.pin}</button>
      <button data-act="delete" aria-label="Delete message">${I.trash}</button></div></div>`}
function hydrate(root){$$('img[data-blob]:not([src])',root).forEach(async img=>{const u=await blobUrl(img.dataset.blob);if(!u)return;img.onload=()=>img.classList.add('ok');img.src=u;if(img.complete)img.classList.add('ok')})}
const sameGroup=(a,b)=>a&&b&&new Date(a.created).toDateString()===new Date(b.created).toDateString()&&b.created-a.created<5*60e3;

async function renderMsgs(){
  const c=ch(ui.active);if(!c)return;const list=(await msgsOf(c.id)).filter(m=>!m.parentId);
  const p=pathOf(c.id),subs=kids(c.id);
  let h=`<div class="ch-intro">${p.length>1?`<div class="path">${esc(p.map(x=>x.name).join(' / '))}</div>`:''}<h2>${esc(c.name)}</h2><p>${p.length>1?`Inside ${esc(p[p.length-2].name)}. `:''}${list.length?`${list.length} message${list.length===1?'':'s'} so far.`:'This is the start of the channel. Write the first message below.'}${subs.length?` Has ${subs.length} sub-channel${subs.length===1?'':'s'}.`:''}</p></div>`;
  let prev=null;for(const m of list){if(!prev||new Date(prev.created).toDateString()!==new Date(m.created).toDateString())h+=`<div class="day">${dayLabel(m.created)}</div>`;h+=msgHTML(m,{cont:sameGroup(prev,m)});prev=m}
  msgList.innerHTML=h;msgList.classList.remove('list-swap');void msgList.offsetWidth;msgList.classList.add('list-swap');hydrate(msgList);
  msgsEl.scrollTop=msgsEl.scrollHeight;requestAnimationFrame(()=>msgsEl.scrollTop=msgsEl.scrollHeight);
}
function renderHead(){
  const c=ch(ui.active);if(!c)return;const p=pathOf(c.id);
  $('#crumbs').innerHTML=`<span class="path">${p.slice(0,-1).map(x=>`<button data-go="${x.id}">${esc(x.name)}</button> / `).join('')}</span><span class="cur">${esc(c.name)}</span>`;
  $('#crumbs .path').hidden=p.length<2;
  const subs=kids(c.id);$('#subs').innerHTML=`<span class="lbl">Sub-channels</span>${subs.map(s=>`<button class="chip" data-go="${s.id}"><i>#</i>${esc(s.name)}</button>`).join('')}<button class="chip add" id="addSubChip">${I.plus}New sub-channel</button>`;
  updatePins();
}
$('#crumbs').onclick=e=>{const b=e.target.closest('[data-go]');if(b)openChannel(b.dataset.go)};
$('#subs').onclick=e=>{const b=e.target.closest('[data-go]');if(b)openChannel(b.dataset.go);else if(e.target.closest('#addSubChip')){if(isPhone())setView('list');showNewRow(ui.active)}};
$('#chMenuBtn').onclick=e=>{if(ui.active)chMenu(ui.active,e.currentTarget)};
$('#chMenuBtn').dataset.popanchor='';$('#pinsBtn').dataset.popanchor='';

const mainComposer=makeComposer($('#mainComposer'),{onSend:x=>sendMessage(x,null),onEditLast:()=>{const l=(cache.get(ui.active)||[]).filter(m=>!m.parentId).pop();if(l)startEdit(l)}});
const thComposer=makeComposer($('#thComposer'),{onSend:x=>sendMessage(x,thread&&thread.id)});

async function openChannel(id,o={}){
  if(!ch(id))return;const same=ui.active===id;ui.active=id;saveUi();expandTo(id);
  $$('.row.on',tree).forEach(r=>r.classList.remove('on'));let row=tree.querySelector(`.row[data-ch="${id}"]`);
  if(!row){renderTree();row=tree.querySelector(`.row[data-ch="${id}"]`)}
  pathOf(id).slice(0,-1).forEach(a=>{const n=tree.querySelector(`[data-node="${a.id}"]`);if(n){n.classList.add('open');n.setAttribute('aria-expanded','true')}});
  if(row){row.classList.add('on');setTimeout(()=>reveal(row,$('.side-scroll')),330)}
  showMain();if(!same||o.force){if(thread&&thread.channelId!==id)closeThread(true);renderHead();await renderMsgs();mainComposer.setKey('ch:'+id,`Message #${ch(id).name}`)}
  if(o.push!==false&&isPhone())setView('channel');
  if(!isPhone()&&o.focus!==false)mainComposer.focus();
  closeSearch(true);
}
function showMain(){$('#main').querySelectorAll('.empty-main').forEach(e=>e.remove());['.ch-head','.subs','#msgs','#mainComposer'].forEach(s=>$(s).hidden=false)}
function showEmpty(){['.ch-head','.subs','#msgs','#mainComposer'].forEach(s=>$(s).hidden=true);if(!$('.empty-main')){const d=document.createElement('div');d.className='empty-main';
  d.innerHTML='<div><h2>No channel open</h2><p>Make a channel with the + button in the sidebar.</p></div>';$('#main').appendChild(d)}}

async function sendMessage({text,files},parentId){
  const cid=ui.active;if(!cid)return;const images=[];
  for(const a of files){try{const p=await a.processed;const id=uid();await DB.put('blobs',{id,blob:p.blob});urls.set(id,a.url);images.push({id,w:p.w,h:p.h})}catch(e){toast('One image couldn\'t be added.')}}
  const m={id:uid(),channelId:cid,parentId:parentId||null,text:text.replace(/\s+$/,''),images,created:Date.now(),edited:0,pinned:false,reactions:[]};
  await DB.put('messages',m);const list=await msgsOf(cid);list.push(m);index.set(m.id,m);vib(6);
  if(parentId){appendTo(thList,thMsgs,m,list.filter(x=>x.parentId===parentId),true);refreshMsg(index.get(parentId));$('.th-sep')&&updateThSep()}
  else appendTo(msgList,msgsEl,m,list.filter(x=>!x.parentId),false);
}
function appendTo(listEl,scroller,m,arr,isThread){
  const prev=arr[arr.length-2];let h='';
  if(!isThread&&(!prev||new Date(prev.created).toDateString()!==new Date(m.created).toDateString()))h+=`<div class="day">${dayLabel(m.created)}</div>`;
  h+=msgHTML(m,{cont:sameGroup(prev,m),enter:true,thread:isThread});listEl.insertAdjacentHTML('beforeend',h);hydrate(listEl);
  scroller.scrollTo({top:scroller.scrollHeight,behavior:'smooth'});
}
function refreshMsg(m){if(!m)return;$$(`.msg[data-id="${m.id}"]`).forEach(el=>{const inThread=!!el.closest('#thList'),cont=el.classList.contains('cont');
  const t=document.createElement('div');t.innerHTML=msgHTML(m,{cont,thread:inThread});const n=t.firstElementChild;el.replaceWith(n);hydrate(n)})}

/* message interactions (main list and thread) */
function bindList(listEl){
  listEl.addEventListener('click',e=>{
    const el=e.target.closest('.msg');if(!el||el.classList.contains('editing'))return;const m=index.get(el.dataset.id);if(!m)return;
    const ph=e.target.closest('.ph');if(ph){openLightbox(m,+ph.dataset.img,ph);return}
    const rx=e.target.closest('[data-rx]');if(rx){toggleReact(m,rx.dataset.rx);return}
    if(e.target.closest('[data-addrx]')){emojiPick(e.target.closest('[data-addrx]'),em=>toggleReact(m,em));return}
    if(e.target.closest('[data-thread]')){openThread(m);return}
    const a=e.target.closest('[data-act]');if(a)act(m,a.dataset.act,a);
  });
  /* long-press on phones opens the action sheet */
  let t=0,sx=0,sy=0;
  listEl.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;const el=e.target.closest('.msg');if(!el||e.target.closest('button,a,textarea'))return;sx=e.clientX;sy=e.clientY;
    t=setTimeout(()=>{const m=index.get(el.dataset.id);if(m){vib(12);msgSheet(m,!!el.closest('#thList'))}},430)});
  listEl.addEventListener('pointermove',e=>{if(t&&Math.hypot(e.clientX-sx,e.clientY-sy)>8){clearTimeout(t);t=0}});
  ['pointerup','pointercancel','scroll'].forEach(ev=>listEl.addEventListener(ev,()=>{clearTimeout(t);t=0},{passive:true}));
  listEl.addEventListener('contextmenu',e=>{if(e.target.closest('.msg')&&matchMedia('(hover:none)').matches)e.preventDefault()});
}
bindList(msgList);bindList(thList);
function act(m,a,btn){
  if(a==='react')emojiPick(btn,em=>toggleReact(m,em));
  else if(a==='reply')openThread(m,true);
  else if(a==='edit')startEdit(m);
  else if(a==='pin')togglePin(m);
  else if(a==='copy'){try{navigator.clipboard.writeText(m.text).then(()=>toast('Copied'),()=>toast('Copy isn\'t available here'))}catch(e){toast('Copy isn\'t available here')}}
  else if(a==='delete')deleteAsk(m);
}
function msgSheet(m,inThread){
  openSheet(`<div class="quick">${QUICK.slice(0,6).map(e=>`<button data-q="${e}" aria-label="React ${e}">${e}</button>`).join('')}</div><div class="acts">
    ${inThread?'':`<button data-a="reply">${I.reply}Reply in thread</button>`}<button data-a="edit">${I.edit}Edit</button>
    <button data-a="pin">${I.pin}${m.pinned?'Unpin':'Pin to channel'}</button>${m.text?`<button data-a="copy">${I.copy}Copy text</button>`:''}<button data-a="delete" class="danger">${I.trash}Delete</button></div>`,s=>{
    s.onclick=e=>{const q=e.target.closest('[data-q]'),b=e.target.closest('[data-a]');if(q){closeSheet();toggleReact(m,q.dataset.q)}else if(b){closeSheet();setTimeout(()=>act(m,b.dataset.a,b),180)}}});
}
async function toggleReact(m,e){m.reactions=m.reactions||[];const has=m.reactions.includes(e);m.reactions=has?m.reactions.filter(x=>x!==e):[...m.reactions,e];await DB.put('messages',m);refreshMsg(m);
  if(!has)$$(`.msg[data-id="${m.id}"] [data-rx="${e}"]`).forEach(b=>b.classList.add('pop'));vib(5)}
async function togglePin(m){m.pinned=!m.pinned;await DB.put('messages',m);refreshMsg(m);updatePins();toast(m.pinned?'Pinned to channel':'Unpinned')}
function startEdit(m){
  const el=$(`${thread&&thread.id!==m.id&&m.parentId?'#thList':'#msgList'} .msg[data-id="${m.id}"]`)||$(`.msg[data-id="${m.id}"]`);if(!el)return;
  el.classList.add('editing');const mb=el.querySelector('.mb'),old=mb.querySelector('.mt');
  const box=document.createElement('div');box.className='editbox';box.innerHTML=`<textarea id="editText" aria-label="Edit message"></textarea><div class="eb-acts"><button class="save">Save</button><button class="cancel">Cancel</button><span>Enter to save · Esc to cancel</span></div>`;
  const ta=box.querySelector('textarea');ta.value=m.text;if(old)old.replaceWith(box);else mb.querySelector('.mh').after(box);
  const fit=()=>{ta.style.height='auto';ta.style.height=ta.scrollHeight+'px'};fit();ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);ta.oninput=fit;
  const done=async save=>{if(save){const v=ta.value.replace(/\s+$/,'');if(!v&&!(m.images||[]).length){deleteAsk(m);return}if(v!==m.text){m.text=v;m.edited=Date.now();await DB.put('messages',m)}}el.classList.remove('editing');refreshMsg(m)};
  box.querySelector('.save').onclick=()=>done(true);box.querySelector('.cancel').onclick=()=>done(false);
  ta.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!isPhone()){e.preventDefault();done(true)}else if(e.key==='Escape')done(false)};
}
function deleteAsk(m){const reps=m.parentId?[]:repliesOf(m);
  openModal(`<h3>Delete message?</h3><p>${reps.length?`Its ${reps.length} ${reps.length===1?'reply':'replies'} will be deleted too. `:''}You can't undo this.</p><div class="row-btns"><button class="btn" data-cancel>Cancel</button><button class="btn danger" data-ok>Delete</button></div>`,md=>{
    md.querySelector('[data-cancel]').onclick=closeModal;md.querySelector('[data-ok]').onclick=async()=>{closeModal();await deleteMsg(m)}})}
async function deleteMsg(m){
  const reps=m.parentId?[]:repliesOf(m),all=[m,...reps],ids=new Set(all.map(x=>x.id));
  await DB.delMany('messages',[...ids]);await DB.delMany('blobs',all.flatMap(x=>(x.images||[]).map(i=>i.id)));
  cache.set(m.channelId,(cache.get(m.channelId)||[]).filter(x=>!ids.has(x.id)));ids.forEach(i=>index.delete(i));
  $$(`.msg[data-id="${m.id}"]`).forEach(el=>{el.style.maxHeight=el.offsetHeight+'px';el.classList.add('leave');setTimeout(()=>{el.remove();tidyDays()},300)});
  if(thread&&thread.id===m.id)closeThread();if(m.parentId){refreshMsg(index.get(m.parentId));updateThSep()}
  updatePins();toast('Message deleted');vib(10);
}
function tidyDays(){$$('.day',msgList).forEach(d=>{const n=d.nextElementSibling;if(!n||n.classList.contains('day'))d.remove()});
  $$('.msg',msgList).forEach((el,i,a)=>{const m=index.get(el.dataset.id),p=i?index.get(a[i-1].dataset.id):null,prevIsDay=el.previousElementSibling&&el.previousElementSibling.classList.contains('day');
    el.classList.toggle('cont',!prevIsDay&&sameGroup(p,m))})}

/* ---------- Thread ---------- */
function openThread(m,focus){
  thread=m;$('#thWhere').textContent=pathStr(m.channelId);$('#thWhere').className='path';
  renderThread();app.classList.add('th-open');if(isPhone())setView('thread');thComposer.setKey('th:'+m.id,'Reply in thread');
  if(focus||!isPhone())setTimeout(()=>thComposer.focus(),300);
}
function renderThread(){if(!thread)return;const reps=repliesOf(thread);
  thList.innerHTML=msgHTML(thread,{thread:true})+`<div class="th-sep">${reps.length} ${reps.length===1?'reply':'replies'}</div>`+reps.map((r,i)=>msgHTML(r,{thread:true,cont:sameGroup(reps[i-1],r)})).join('');
  hydrate(thList);thMsgs.scrollTop=thMsgs.scrollHeight}
function updateThSep(){if(!thread)return;const n=repliesOf(thread).length,s=$('.th-sep');if(s)s.textContent=`${n} ${n===1?'reply':'replies'}`}
function closeThread(silent){if(!thread&&silent)return;thread=null;if(isPhone()&&app.dataset.view==='thread'){setView('channel');setTimeout(()=>app.classList.remove('th-open'),420)}else app.classList.remove('th-open')}
$('#thClose').onclick=()=>closeThread();$('#thBack').onclick=()=>closeThread();

/* ---------- Pins ---------- */
function updatePins(){const all=(cache.get(ui.active)||[]).filter(m=>m.pinned);$('#pinCount').textContent=all.length;$('#pinsBtn').classList.toggle('has',!!all.length)}
$('#pinsBtn').onclick=e=>{const all=(cache.get(ui.active)||[]).filter(m=>m.pinned).sort((a,b)=>b.created-a.created);
  $('#pinsList').innerHTML=all.length?all.map(m=>`<button class="pin-item" data-id="${m.id}"><small>${dayLabel(m.created)} · ${fmtTime(m.created)}${m.parentId?' · in a thread':''}</small><div>${m.text?esc(m.text):`<span class="imgnote">${I.image}Image</span>`}</div></button>`).join(''):'<p class="noresult">No pinned messages. Use the pin button on a message to keep it here.</p>';
  $('#pinsList').onclick=ev=>{const b=ev.target.closest('[data-id]');if(b){closePops();jumpTo(index.get(b.dataset.id))}};openPop($('#pinsPop'),e.currentTarget)};
async function jumpTo(m){if(!m)return;await openChannel(m.channelId,{focus:false});
  let el;if(m.parentId){openThread(index.get(m.parentId));el=$(`#thList .msg[data-id="${m.id}"]`)}else el=$(`#msgList .msg[data-id="${m.id}"]`);
  if(el){setTimeout(()=>{reveal(el,m.parentId?thMsgs:msgsEl,true);el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash')},m.parentId?350:60)}}

/* ---------- Search ---------- */
const q=$('#q');let qT=0;
q.addEventListener('input',()=>{clearTimeout(qT);qT=setTimeout(()=>search(q.value),140)});
q.addEventListener('keydown',e=>{if(e.key==='Escape'){q.value='';closeSearch()}else if(e.key==='Enter'){const f=$('#results .res');f&&f.click()}});
addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(isPhone())setView('list');q.focus();q.select()}
  else if(e.key==='Escape'&&!e.target.closest('textarea,input')){if(lbOpen)closeLightbox();else if(modal.classList.contains('open'))closeModal();else if(sheet.classList.contains('open'))closeSheet();else if(popOpen)closePops();else if(thread)closeThread()}});
$('#searchClose').onclick=()=>{q.value='';closeSearch()};
const reEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
async function search(v){
  const terms=v.toLowerCase().split(/\s+/).filter(Boolean);if(!terms.length){closeSearch();return}
  const all=(await DB.all('messages')).filter(m=>{const t=(m.text||'').toLowerCase();return terms.every(x=>t.includes(x))}).sort((a,b)=>b.created-a.created).slice(0,150);
  all.forEach(m=>{if(!index.has(m.id))index.set(m.id,m)});
  const hl=new RegExp('('+terms.map(t=>reEsc(esc(t))).join('|')+')','gi');
  const groups=new Map();all.forEach(m=>{if(!ch(m.channelId))return;if(!groups.has(m.channelId))groups.set(m.channelId,[]);groups.get(m.channelId).push(m)});
  $('#searchTitle').textContent=`${all.length} result${all.length===1?'':'s'} for “${v.trim()}”`;
  $('#results').innerHTML=all.length?[...groups].map(([cid,ms])=>`<div class="rgroup path">${esc(pathStr(cid))}</div>`+ms.map(m=>{
    const t=m.text.replace(/\*\*|~~|`/g,''),i=Math.max(0,t.toLowerCase().indexOf(terms[0])-50),snip=(i?'…':'')+t.slice(i,i+220);
    return`<button class="res" data-id="${m.id}"><div class="rt"><span>${dayLabel(m.created)} · ${fmtTime(m.created)}</span>${m.parentId?'<span>in a thread</span>':''}${m.pinned?'<span>pinned</span>':''}</div><div class="rx2">${esc(snip).replace(hl,'<mark>$1</mark>')}</div></button>`}).join('')).join('')
    :'<p class="noresult">No messages match. Try fewer or different words.</p>';
  app.classList.add('searching');
}
$('#results').onclick=async e=>{const b=e.target.closest('[data-id]');if(!b)return;const m=index.get(b.dataset.id);await msgsOf(m.channelId);jumpTo(index.get(m.id)||m)};
function closeSearch(keep){app.classList.remove('searching');if(!keep)q.blur()}

/* ---------- Phone navigation + swipe back ---------- */
function setView(v){app.dataset.view=v}
$('#back').onclick=()=>setView('list');
(()=>{let s=null;
  const start=(e,which)=>{if(!isPhone()||e.clientX>28)return;s={which,x0:e.clientX,y0:e.clientY,dx:0,t:performance.now(),id:e.pointerId,dir:null}};
  $('#main').addEventListener('pointerdown',e=>{if(app.dataset.view==='channel')start(e,'main')});
  $('#thread').addEventListener('pointerdown',e=>{if(app.dataset.view==='thread')start(e,'thread')});
  addEventListener('pointermove',e=>{if(!s||e.pointerId!==s.id)return;const dx=e.clientX-s.x0,dy=e.clientY-s.y0;
    if(!s.dir){if(Math.hypot(dx,dy)<8)return;s.dir=Math.abs(dx)>Math.abs(dy)?'x':'y';if(s.dir==='y'){s=null;return}app.classList.add('dragging-back')}
    s.dx=Math.max(0,dx);const W=innerWidth,p=s.dx/W;
    if(s.which==='main'){$('#main').style.transform=`translateX(${s.dx}px)`;$('#side').style.transform=`translateX(${-25+25*p}%)`;$('#side').style.filter=`brightness(${.7+.3*p})`}
    else{$('#thread').style.transform=`translateX(${s.dx}px)`;$('#main').style.transform=`translateX(${-25+25*p}%)`}});
  const end=e=>{if(!s||e.pointerId!==s.id)return;const v=s.dx/((performance.now()-s.t)/1000),go=s.dx>innerWidth*.33||v>650,w=s.which;s=null;
    app.classList.remove('dragging-back');['#main','#side','#thread'].forEach(x=>{$(x).style.transform='';$(x).style.filter=''});
    if(go){if(w==='main')setView('list');else closeThread()}};
  addEventListener('pointerup',end);addEventListener('pointercancel',end)})();

/* ---------- Drag & drop images ---------- */
(()=>{let depth=0;const main=$('#main');
  const hasFiles=e=>[...(e.dataTransfer&&e.dataTransfer.types)||[]].includes('Files');
  addEventListener('dragenter',e=>{if(!hasFiles(e))return;depth++;main.classList.add('dragging')});
  addEventListener('dragleave',()=>{depth=Math.max(0,depth-1);if(!depth)main.classList.remove('dragging')});
  addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault()});
  addEventListener('drop',e=>{if(!hasFiles(e))return;e.preventDefault();depth=0;main.classList.remove('dragging');const files=[...e.dataTransfer.files];
    (thread&&e.target.closest('#thread')?thComposer:mainComposer).add(files)})})();

/* ---------- Lightbox (zooms from the thumbnail) ---------- */
const lb=$('#lightbox'),lbImg=$('#lbImg');let lbOpen=null;
function fitRect(w,h){const mw=innerWidth*.94,mh=innerHeight*.84,s=Math.min(mw/w,mh/h,1.5),W=w*s,H=h*s;return{x:(innerWidth-W)/2,y:(innerHeight-H)/2,w:W,h:H}}
function place(r,t,anim){lbImg.style.transition=anim?'transform .42s var(--ease),opacity .3s':'none';lbImg.style.transform=`translate(${r.x}px,${r.y}px) scale(${r.w/t.w})`}
async function openLightbox(m,i,thumb){const imgs=m.images;if(!imgs||!imgs.length)return;lbOpen={m,i};await showLb(thumb.getBoundingClientRect());lb.classList.add('open');lb.setAttribute('aria-hidden','false')}
async function showLb(from){const {m,i}=lbOpen,im=m.images[i],u=await blobUrl(im.id),t=fitRect(im.w||800,im.h||600);
  lbImg.src=u;lbImg.style.width=t.w+'px';lbImg.style.height=t.h+'px';lbImg.style.opacity=1;
  if(from){place({x:from.left,y:from.top,w:from.width,h:from.height},t,false);void lbImg.offsetWidth}
  place(t,t,true);lbOpen.t=t;$('#lbCount').textContent=m.images.length>1?`${i+1} / ${m.images.length}`:'';
  $('#lbPrev').hidden=$('#lbNext').hidden=m.images.length<2}
function closeLightbox(){if(!lbOpen)return;const {m,i,t}=lbOpen;const th=$(`.msg[data-id="${m.id}"] .ph[data-img="${i}"]`);
  lb.classList.remove('open');lb.setAttribute('aria-hidden','true');
  if(th){const r=th.getBoundingClientRect();place({x:r.left,y:r.top,w:r.width,h:r.height},t,true)}else lbImg.style.opacity=0;
  setTimeout(()=>{if(!lb.classList.contains('open')){lbImg.removeAttribute('src');lbImg.style.opacity=0}},430);lbOpen=null}
function lbStep(d){if(!lbOpen)return;const n=lbOpen.m.images.length;if(n<2)return;lbOpen.i=(lbOpen.i+d+n)%n;showLb(null)}
$('#lbClose').onclick=closeLightbox;$('#lbPrev').onclick=e=>{e.stopPropagation();lbStep(-1)};$('#lbNext').onclick=e=>{e.stopPropagation();lbStep(1)};
addEventListener('keydown',e=>{if(!lbOpen)return;if(e.key==='ArrowLeft')lbStep(-1);else if(e.key==='ArrowRight')lbStep(1)});
(()=>{let s=null;lb.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;s={x:e.clientX,y:e.clientY,dx:0,dy:0}});
  lb.addEventListener('pointermove',e=>{if(!s||!lbOpen)return;s.dx=e.clientX-s.x;s.dy=e.clientY-s.y;const t=lbOpen.t;
    lbImg.style.transition='none';lbImg.style.transform=`translate(${t.x+s.dx}px,${t.y+Math.max(0,s.dy)}px) scale(${1-Math.min(.3,Math.max(0,s.dy)/1000)})`;
    lb.style.background=`rgba(6,6,12,${.92-Math.min(.6,Math.max(0,s.dy)/400)})`});
  lb.addEventListener('pointerup',()=>{if(!s||!lbOpen){s=null;return}const {dx,dy}=s;s=null;lb.style.background='';
    if(Math.abs(dx)<6&&Math.abs(dy)<6){closeLightbox();return}
    if(dy>110)closeLightbox();else if(Math.abs(dx)>70&&Math.abs(dx)>dy)lbStep(dx<0?1:-1);else place(lbOpen.t,lbOpen.t,true)})})();

/* ---------- Settings ---------- */
$('#setBtn').onclick=async()=>{
  let used='';try{const est=await navigator.storage.estimate();used=`Using ${(est.usage/1048576).toFixed(1)} MB on this device.`}catch(e){}
  const n=channels.length;
  openModal(`<h3>Settings</h3><label class="field"><span>Your name</span><input type="text" id="setName" maxlength="40" value="${esc(prefs.name)}"></label>
    <div class="field"><span>Your color</span><div class="swatches" id="setColor">${COLORS.map(c=>`<button style="--sw:${c}" data-c="${c}" class="${c===prefs.color?'on':''}" aria-label="Color ${c}"></button>`).join('')}</div></div>
    <div class="field"><span>Theme</span><div class="seg" id="setTheme"><button data-t="system">Auto</button><button data-t="light">Light</button><button data-t="dark">Dark</button></div></div>
    <div class="switchrow"><span>Enter sends the message</span><button class="switch" role="switch" id="setEnter" aria-checked="${prefs.enterSend}" aria-label="Enter sends the message"></button></div>
    <div class="store-note">${n} channel${n===1?'':'s'} saved only on this device. ${used} ${DB.usingMemory?'<b>Storage is blocked in this browser, so messages will be lost when you close the page.</b>':''}</div>
    <div class="row-btns"><button class="btn" id="setPersist">Keep my data safe</button><button class="btn primary" id="setDone">Done</button></div>`,m=>{
    const sync=()=>{$$('#setTheme button',m).forEach(b=>b.classList.toggle('on',b.dataset.t===prefs.theme))};sync();
    m.querySelector('#setName').oninput=e=>{prefs.name=e.target.value.trim()||'Me';savePrefs()};
    m.querySelector('#setColor').onclick=e=>{const b=e.target.closest('[data-c]');if(!b)return;prefs.color=b.dataset.c;savePrefs();$$('#setColor button',m).forEach(x=>x.classList.toggle('on',x===b))};
    m.querySelector('#setTheme').onclick=e=>{const b=e.target.closest('[data-t]');if(!b)return;prefs.theme=b.dataset.t;savePrefs();applyTheme();sync()};
    m.querySelector('#setEnter').onclick=e=>{prefs.enterSend=!prefs.enterSend;savePrefs();e.currentTarget.setAttribute('aria-checked',prefs.enterSend)};
    m.querySelector('#setPersist').onclick=async()=>{try{const ok=navigator.storage&&await navigator.storage.persist();toast(ok?'Your browser will keep this data':'Your browser may clear this data if space runs low')}catch(e){toast('This browser decides on its own')}};
    m.querySelector('#setDone').onclick=()=>{closeModal();renderMsgs();if(thread)renderThread()};
  });
};

/* ---------- Example workspace on first run ---------- */
async function seed(){
  const now=Date.now(),H=36e5,mk=(name,parent,o)=>({id:uid(),parentId:parent,name,created:now,order:o});
  const gen=mk('general',null,1),ann=mk('announcements',gen.id,2),proj=mk('projects',null,3),os=mk('senritha-os',proj.id,4),bugs=mk('bugs',os.id,5),rh=mk('senrithas-rhythm',proj.id,6),ideas=mk('ideas',null,7);
  const cs=[gen,ann,proj,os,bugs,rh,ideas];for(const c of cs)await DB.put('channels',c);
  let img=null;try{const c=document.createElement('canvas');c.width=960;c.height=540;const x=c.getContext('2d');x.fillStyle='#1A1B2E';x.fillRect(0,0,960,540);
    const pal=['#FF3D7F','#FFB020','#2EE6D6','#8B5CFF'];for(let i=0;i<24;i++){const h=60+Math.abs(Math.sin(i*.7))*300;x.fillStyle=pal[Math.floor(i/6)%4];x.fillRect(60+i*36,440-h,24,h)}
    x.fillStyle='#fff';x.font='700 44px system-ui';x.fillText('Beat engine v2',60,90);x.font='500 24px system-ui';x.fillStyle='#B9BAD6';x.fillText('Average timing error: 1–2 ms (example image)',60,130);
    const blob=await new Promise(r=>c.toBlob(r,'image/png'));if(blob){img={id:uid(),w:960,h:540};await DB.put('blobs',{id:img.id,blob})}}catch(e){}
  const msg=(c,text,t,o={})=>({id:uid(),channelId:c.id,parentId:o.parent||null,text,images:o.images||[],created:now-t,edited:0,pinned:!!o.pinned,reactions:o.reactions||[]});
  const m1=msg(gen,'This workspace starts with **example** channels and messages. Rename or delete them anytime.',26*H,{pinned:true,reactions:['🎉']});
  const m2=msg(gen,'Quick tips:\n• Press + next to a channel to make a sub-channel inside it (as deep as you like)\n• Paste, drop or attach images in the message box\n• Hover a message, or long-press on a phone, to react, reply, edit, pin or delete\n• Write **bold**, _italic_ and `code`',26*H-60e3);
  const r1=msg(rh,'Beat engine v2 is in. Timing is much tighter on the test songs.',3*H,{images:img?[img]:[],reactions:['🔥','🎉']});
  const r2=msg(rh,'Next: try it with real songs on the phone.',2.5*H,{parent:r1.id});
  const r3=msg(rh,'And calibrate with Bluetooth headphones.',2.4*H,{parent:r1.id});
  const b1=msg(bugs,'Camera live view only works on the GitHub Pages link. On the artifact link it opens the phone camera instead.',5*H);
  const i1=msg(ideas,'Share Rhythm clips straight to LINE?',40*60e3,{reactions:['👀']});
  const a1=msg(ann,'Senritha OS and Senritha\'s Rhythm are both in PR #1.',27*H);
  for(const m of [m1,m2,r1,r2,r3,b1,i1,a1])await DB.put('messages',m);
  await DB.put('meta',{id:'seeded',at:now});return gen.id;
}

/* ---------- Start ---------- */
(async()=>{
  channels=await DB.all('channels');let first=null;
  if(!channels.length&&!(await DB.get('meta','seeded'))){first=await seed();channels=await DB.all('channels')}
  renderTree();
  const start=ch(ui.active)?ui.active:(first||(kids(null)[0]||{}).id);
  if(start)await openChannel(start,{push:false,focus:false,force:true});else showEmpty();
  if(!isPhone()&&start)setView('channel');
  try{if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{})}catch(e){}
})();
})();
