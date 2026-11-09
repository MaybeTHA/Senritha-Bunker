/* Sketch: finger drawing with smoothed strokes, undo, and save to Gallery. */
(()=>{
const {$,$$,vib}=OS;
const INKS=['#16181A','#D9483B','#EE8A2A','#2FA083','#3557D6','#8A4FB8'];
const SIZES={s:3,m:7,l:16};
OS.register('sketch',{name:'Sketch',bg:'#FF6B57',fg:'#fff',installable:true,category:'Creativity',size:'24 KB',
  desc:'Draw with your finger in six inks and three brush sizes. Save drawings to Gallery.',
  glyph:'<svg viewBox="0 0 24 24"><path d="M14.5 4.5l5 5L10 19H5v-5z"/><path d="M12.5 6.5l5 5"/></svg>',
  build(el){
    el.classList.add('sketch');
    el.innerHTML=`<div class="bar"><button data-a="undo">Undo</button><button data-a="clear">Clear</button><span class="spacer"></span><button data-a="save">Save</button></div>
      <div class="paper"><canvas></canvas></div>
      <div class="tools"><div class="inks">${INKS.map((c,i)=>`<button data-ink="${c}" style="--sw:${c}" class="${i?'':'on'}" aria-label="Ink ${i+1}"></button>`).join('')}
        <button data-ink="erase" class="erase" aria-label="Eraser"><svg viewBox="0 0 24 24"><path d="M8 20h12M4.5 14.5l9-9 6 6-7 7H8z"/></svg></button></div>
        <div class="seg sizes"><button data-sz="s">S</button><button data-sz="m" class="on">M</button><button data-sz="l">L</button></div></div>`;
    const paper=$('.paper',el), cv=$('canvas',el), ctx=cv.getContext('2d');
    let strokes=[], cur=null, ink=INKS[0], size='m', w=0, h=0;
    function fit(){if(paper.clientWidth<20)return;const d=devicePixelRatio||1;w=paper.clientWidth;h=paper.clientHeight;
      cv.width=w*d;cv.height=h*d;cv.style.width=w+'px';cv.style.height=h+'px';ctx.setTransform(d,0,0,d,0,0);redraw()}
    function seg(s,from){const p=s.pts;ctx.strokeStyle=s.erase?'#FFFFFF':s.color;ctx.lineWidth=s.size;ctx.lineCap=ctx.lineJoin='round';
      if(p.length===1){ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.arc(p[0][0],p[0][1],s.size/2,0,7);ctx.fill();return}
      ctx.beginPath();const i0=Math.max(1,from);
      let mx=(p[i0-1][0]+(i0>1?p[i0-2][0]:p[i0-1][0]))/2, my=(p[i0-1][1]+(i0>1?p[i0-2][1]:p[i0-1][1]))/2; ctx.moveTo(mx,my);
      for(let i=i0;i<p.length;i++){const nx=(p[i-1][0]+p[i][0])/2, ny=(p[i-1][1]+p[i][1])/2;ctx.quadraticCurveTo(p[i-1][0],p[i-1][1],nx,ny)}
      ctx.stroke()}
    function redraw(){ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,w,h);for(const s of strokes)seg(s,1)}
    const pos=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
    cv.addEventListener('pointerdown',e=>{try{cv.setPointerCapture(e.pointerId)}catch(err){}cur={color:ink,erase:ink==='erase',size:SIZES[size]*(ink==='erase'?2.2:1),pts:[pos(e)],id:e.pointerId};strokes.push(cur);seg(cur,1)});
    cv.addEventListener('pointermove',e=>{if(!cur||e.pointerId!==cur.id)return;const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];const n=cur.pts.length;
      for(const ev of evs.length?evs:[e])cur.pts.push(pos(ev));seg(cur,Math.max(1,n-1))});
    const end=e=>{if(cur&&e.pointerId===cur.id)cur=null}; cv.addEventListener('pointerup',end); cv.addEventListener('pointercancel',end);
    el.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;
      if(b.dataset.ink){ink=b.dataset.ink;$$('.inks button',el).forEach(x=>x.classList.toggle('on',x===b));vib(4)}
      else if(b.dataset.sz){size=b.dataset.sz;$$('.sizes button',el).forEach(x=>x.classList.toggle('on',x===b))}
      else if(b.dataset.a==='undo'){strokes.pop();redraw()}
      else if(b.dataset.a==='clear'){if(!strokes.length)return;if(b.dataset.armed){strokes=[];redraw();delete b.dataset.armed;b.textContent='Clear'}
        else{b.dataset.armed=1;b.textContent='Tap to clear';setTimeout(()=>{delete b.dataset.armed;b.textContent='Clear'},2200)}}
      else if(b.dataset.a==='save'){if(!strokes.length||!OS.photos)return;cv.toBlob(async bl=>{if(!bl)return;await OS.photos.add(bl);vib(10);b.textContent='Saved';setTimeout(()=>b.textContent='Save',1500)},'image/png')}
    });
    return{visible(on){if(on)setTimeout(fit,30)}};
  }});
})();
