/* App Store: lists installable apps (def.installable) and installs/removes them. */
(()=>{
const {$,$$,vib,esc}=OS;
const RING='<svg viewBox="0 0 36 36"><circle class="trk" cx="18" cy="18" r="14"/><circle class="prg" cx="18" cy="18" r="14" stroke-dasharray="88" stroke-dashoffset="88"/></svg>';
OS.register('store',{name:'App Store',bg:'#2E6BE6',fg:'#fff',
  glyph:'<svg viewBox="0 0 24 24"><path d="M5.5 8.5h13l-1.2 11h-10.6z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/></svg>',
  build(el){
    el.innerHTML=`<div class="hdr"><h1>App Store</h1><p class="sub">Free games and apps for Senritha OS</p></div><div class="scroll" id="asS"></div>`;
    const S=$('#asS',el), busy={};
    const btn=id=>busy[id]?`<button class="get loading" data-get="${id}" aria-label="Installing">${RING}</button>`
      :`<button class="get" data-get="${id}">${OS.isInstalled(id)?'Open':'Get'}</button>`;
    const row=([id,a])=>`<div class="srow"><div class="glyph" style="background:${a.bg};color:${a.fg}">${OS.glyph(id)}</div>
      <div class="sinfo"><b>${esc(a.name)}</b><span>${esc(a.desc)}</span><small>${a.category} · ${a.size}${OS.isInstalled(id)?` · <button class="rm" data-rm="${id}">Remove</button>`:''}</small></div>${btn(id)}</div>`;
    function render(){
      const all=Object.entries(OS.apps()).filter(([,a])=>a.installable), f=all.find(([id])=>id==='glide');
      const games=all.filter(([,a])=>a.category==='Game'), apps=all.filter(([,a])=>a.category!=='Game');
      S.innerHTML=(f?`<div class="feat" style="background:${f[1].bg};color:${f[1].fg}"><div class="wlabel">Featured game</div><h2>${f[1].name}</h2><p>${esc(f[1].desc)}</p>
        <div class="featrow"><div class="glyph" style="background:${f[1].fg};color:${f[1].bg}">${OS.glyph('glide')}</div>${btn('glide')}</div></div>`:'')+
        `<div class="glabel">Games</div><div class="group">${games.map(row).join('')}</div>
         <div class="glabel">Apps</div><div class="group">${apps.map(row).join('')}</div>
         <p class="fine">Apps install to page 2 of your home screen.</p>`;
    }
    function install(id){
      busy[id]=true; render(); vib(6);
      let p=0; const step=()=>{p=Math.min(1,p+.12+Math.random()*.22);
        $$(`[data-get="${id}"] .prg`,el).forEach(c=>c.setAttribute('stroke-dashoffset',(88*(1-p)).toFixed(1)));
        if(p<1)setTimeout(step,180+Math.random()*160);
        else setTimeout(()=>{delete busy[id];OS.install(id);render();vib(12);OS.notify(id,`${OS.apps()[id].name} installed`,'Find it on page 2 of your home screen')},260)};
      requestAnimationFrame(()=>requestAnimationFrame(step));
    }
    el.addEventListener('click',e=>{
      const g=e.target.closest('[data-get]'), r=e.target.closest('[data-rm]');
      if(g){const id=g.dataset.get; if(busy[id])return; OS.isInstalled(id)?OS.openApp(id):install(id)}
      else if(r){if(r.dataset.armed){OS.uninstall(r.dataset.rm);render();vib(10)}
        else{r.dataset.armed=1;r.textContent='Tap again to remove';setTimeout(()=>{if(r.isConnected){delete r.dataset.armed;r.textContent='Remove'}},2500)}}
    });
    render();
    return{visible(on){on&&render()}};
  }});
})();
