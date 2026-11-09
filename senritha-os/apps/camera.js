/* Camera, Gallery, photo storage (IndexedDB) and flashlight. */
(()=>{
const {$,$$,vib}=OS;
const hasGUM=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);

/* ---------- Photo storage ---------- */
const photos=(()=>{
  let dbp=null, mem=[];
  const open=()=>dbp||(dbp=new Promise((res,rej)=>{try{const r=indexedDB.open('senritha-os',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('photos',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}}));
  const tx=async(mode,fn)=>{const db=await open();return new Promise((res,rej)=>{const t=db.transaction('photos',mode),r=fn(t.objectStore('photos'));
    t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error)})};
  const changed=()=>window.dispatchEvent(new Event('photos-changed'));
  return{
    async add(blob){const p={id:Date.now()+Math.random(),t:Date.now(),blob};try{await tx('readwrite',s=>s.put(p))}catch(e){mem.push(p)}changed();return p},
    async list(){let a=[];try{a=(await tx('readonly',s=>s.getAll()))||[]}catch(e){}return a.concat(mem).sort((x,y)=>y.t-x.t)},
    async del(id){try{await tx('readwrite',s=>s.delete(id))}catch(e){}mem=mem.filter(p=>p.id!==id);changed()}
  };
})();
OS.photos=photos;

/* ---------- Camera stream shared with the flashlight ---------- */
const cam={stream:null,track:null};
const torchCap=t=>{try{return !!(t&&t.getCapabilities&&t.getCapabilities().torch)}catch(e){return false}};

/* ---------- Flashlight: real torch where supported, else a bright screen light ---------- */
const torch={on:false,track:null,own:false,screen:null,
  async set(on){
    if(!on){
      if(this.track){if(this.own)this.track.stop();else this.track.applyConstraints({advanced:[{torch:false}]}).catch(()=>{})}
      this.track=null;this.own=false;this.screenOff();this.on=false;OS.syncCC();return;
    }
    let track=cam.track, own=false;
    try{
      if(!track){if(!hasGUM)throw 0;const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});track=s.getVideoTracks()[0];own=true}
      if(!torchCap(track))throw 0;
      await track.applyConstraints({advanced:[{torch:true}]}); this.track=track; this.own=own;
    }catch(e){if(own&&track)track.stop(); this.screenOn()}
    this.on=true; OS.syncCC();
  },
  toggle(){this.set(!this.on)},
  screenOn(){
    if(this.screen)return; const d=document.createElement('div'); d.className='screenlight'; d.dataset.nogesture='';
    d.innerHTML='<span>Screen light is on<br><small>This browser can\'t reach the flashlight. Tap to turn off.</small></span>';
    d.addEventListener('click',()=>this.set(false)); $('#device').appendChild(d); this.screen=d; requestAnimationFrame(()=>d.classList.add('on'));
  },
  screenOff(){const d=this.screen;if(!d)return;this.screen=null;d.classList.remove('on');setTimeout(()=>d.remove(),350)}
};
OS.torch=torch;

/* ---------- Camera app ---------- */
OS.register('camera',{name:'Camera',bg:'#2A2D31',fg:'#fff',darkUI:true,
  glyph:'<svg viewBox="0 0 24 24"><path d="M4 8h3.2l1.8-2.6h6l1.8 2.6H20v11H4z"/><circle cx="12" cy="13.2" r="3.6"/></svg>',
  build(el){
    el.classList.add('cam');
    el.innerHTML=`<div class="vf"><video playsinline muted autoplay></video><div class="flash"></div>
      <div class="nocam" hidden><b>Use your phone's camera</b><p class="camMsg"></p>
        <label class="btn solid">Take photo<input type="file" accept="image/*" capture="environment" class="vh"></label>
        <label class="btn">Choose from library<input type="file" accept="image/*" multiple class="vh"></label></div></div>
      <div class="camtop"><button class="ctorch" aria-pressed="false" aria-label="Flash" hidden><svg viewBox="0 0 24 24"><path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/></svg></button><span class="mode">PHOTO</span><span class="spacer"></span></div>
      <div class="camtoast"></div>
      <div class="camctl"><button class="thumb" aria-label="Open Gallery"></button><button class="shutter" aria-label="Take photo"></button>
        <button class="flip" aria-label="Switch camera"><svg viewBox="0 0 24 24"><path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2"/><path d="M20 4v4h-4M4 20v-4h4"/></svg></button></div>`;
    const video=$('video',el), noc=$('.nocam',el), msg=$('.camMsg',el), thumb=$('.thumb',el), flash=$('.flash',el), tb=$('.ctorch',el), toast=$('.camtoast',el);
    const inputs=$$('input[type=file]',el);
    let facing='environment', vis=false, starting=null, thumbUrl=null, toastT=0;
    const say=t=>{toast.textContent=t;toast.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>toast.classList.remove('on'),1800)};
    async function refreshThumb(){const l=await photos.list();if(thumbUrl)URL.revokeObjectURL(thumbUrl);thumbUrl=l[0]?URL.createObjectURL(l[0].blob):null;thumb.style.backgroundImage=thumbUrl?`url("${thumbUrl}")`:'none'}
    function fallback(text){noc.hidden=false;msg.textContent=text;el.classList.add('nolive')}
    async function start(){
      if(cam.stream||starting)return;
      if(!hasGUM){fallback('Live view needs the GitHub Pages link. On this page, your phone\'s own camera app opens instead.');return}
      starting=navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1080}},audio:false});
      try{
        const s=await starting; starting=null;
        if(!vis){s.getTracks().forEach(t=>t.stop());return}
        cam.stream=s; cam.track=s.getVideoTracks()[0]; video.srcObject=s; video.classList.toggle('mirror',facing==='user');
        noc.hidden=true; el.classList.remove('nolive'); tb.hidden=!torchCap(cam.track); tb.setAttribute('aria-pressed','false');
      }catch(e){starting=null;
        fallback(e&&e.name==='NotAllowedError'?'Camera access is off for this page. Use the buttons below, or allow the camera in your browser settings and reopen Camera.'
          :'No live camera here. Use the buttons below to open your phone\'s camera.')}
    }
    function stop(){if(cam.stream){if(torch.track===cam.track){torch.track=null;torch.on=false;OS.syncCC()}cam.stream.getTracks().forEach(t=>t.stop())}cam.stream=cam.track=null;video.srcObject=null}
    async function save(blob){await photos.add(blob);refreshThumb();say('Saved to Gallery')}
    $('.shutter',el).addEventListener('click',()=>{
      if(!cam.stream){inputs[0].click();return}
      const c=document.createElement('canvas'), w=video.videoWidth, h=video.videoHeight; if(!w)return;
      c.width=w; c.height=h; const x=c.getContext('2d'); if(facing==='user'){x.translate(w,0);x.scale(-1,1)} x.drawImage(video,0,0,w,h);
      flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); vib(12);
      c.toBlob(b=>b&&save(b),'image/jpeg',.9);
    });
    inputs.forEach(i=>i.addEventListener('change',async()=>{for(const f of i.files)await photos.add(f);i.value='';refreshThumb();say('Saved to Gallery')}));
    thumb.addEventListener('click',()=>OS.openApp('gallery'));
    $('.flip',el).addEventListener('click',()=>{if(!cam.stream)return;facing=facing==='user'?'environment':'user';stop();start();vib(6)});
    tb.addEventListener('click',async()=>{const on=tb.getAttribute('aria-pressed')!=='true';
      try{await cam.track.applyConstraints({advanced:[{torch:on}]});tb.setAttribute('aria-pressed',on);torch.track=on?cam.track:null;torch.own=false;torch.on=on;OS.syncCC()}catch(e){say('Flash not available')}});
    refreshThumb();
    return{visible(on){vis=on;on?(start(),refreshThumb()):stop()},destroy(){vis=false;stop();if(thumbUrl)URL.revokeObjectURL(thumbUrl)}};
  }});

/* ---------- Gallery app ---------- */
OS.register('gallery',{name:'Gallery',bg:'#FFFFFF',fg:'#E0603A',
  glyph:'<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 15.5l-4.5-4.5-8.5 8"/></svg>',
  build(el){
    el.innerHTML=`<div class="hdr"><h1>Gallery</h1><p class="sub" id="gC"></p></div><div class="scroll"><div class="pgrid" id="gG"></div>
      <div class="empty" id="gE" hidden>No photos yet.<br><button class="btn" id="gCam">Open Camera</button></div></div>
      <div class="pview" id="gV"><div class="bar"><button id="gX">‹ Gallery</button><span class="when" id="gW"></span><button class="del" id="gD">Delete</button></div><img alt=""></div>`;
    const G=$('#gG',el), V=$('#gV',el), img=$('img',V), D=$('#gD',el);
    let list=[], urls=[], cur=null, vis=false, stale=true;
    async function render(){
      stale=false; list=await photos.list(); urls.forEach(u=>URL.revokeObjectURL(u)); urls=list.map(p=>URL.createObjectURL(p.blob));
      G.innerHTML=urls.map((u,i)=>`<button data-i="${i}" style="background-image:url('${u}')" aria-label="Photo ${i+1}"></button>`).join('');
      $('#gE',el).hidden=!!list.length; $('#gC',el).textContent=list.length+(list.length===1?' photo':' photos');
    }
    const close=()=>{V.classList.remove('open');cur=null};
    G.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const i=+b.dataset.i;cur=list[i];img.src=urls[i];
      $('#gW',el).textContent=new Date(cur.t).toLocaleString([], {day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
      D.classList.remove('armed');D.textContent='Delete';V.classList.add('open')});
    $('#gX',el).onclick=close; img.addEventListener('click',close);
    D.onclick=async()=>{if(!D.classList.contains('armed')){D.classList.add('armed');D.textContent='Tap to confirm';return}const id=cur.id;close();await photos.del(id);vib(8)};
    $('#gCam',el).onclick=()=>OS.openApp('camera');
    const onChange=()=>{vis?render():stale=true}; window.addEventListener('photos-changed',onChange);
    render();
    return{visible(on){vis=on;if(on&&stale)render();if(!on)close()},destroy(){window.removeEventListener('photos-changed',onChange);urls.forEach(u=>URL.revokeObjectURL(u))}};
  }});
})();
