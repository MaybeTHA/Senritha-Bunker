/* Paper Glide: original tap-to-fly game. Tap to lift the paper plane through gaps between towers. */
(()=>{
const {$,vib,store,loop}=OS;
OS.register('glide',{name:'Paper Glide',bg:'#F4A64A',fg:'#fff',installable:true,category:'Game',size:'42 KB',
  desc:'Tap to lift your paper plane through the gaps between the towers. One mistake and it\'s over.',
  glyph:'<svg viewBox="0 0 24 24"><path d="M3 11.5L21 4l-6.5 16-3.2-6.3z"/><path d="M11.3 13.7L21 4"/></svg>',
  build(el){
    el.classList.add('game','glide');
    el.innerHTML=`<div class="stage full"><canvas></canvas><div class="gscore">0</div><div class="gover"><b>Paper Glide</b><p>Tap to fly. Best: <span class="bs">0</span></p></div></div>`;
    const stage=$('.stage',el), cv=$('canvas',el), ctx=cv.getContext('2d'), ov=$('.gover',el), sc=$('.gscore',el);
    let w=300,h=600, st='ready', y,vy,towers,score,best=store.get('glideBest',0), t0=0,last=0, scroll=0, deadT=0;
    $('.bs',el).textContent=best;
    const P=()=>({x:w*.3,r:Math.max(10,h*.02),g:h*2.3,flap:-h*.66,speed:Math.max(150,w*.48),gap:Math.max(150,h*.26),space:Math.max(210,w*.62),tw:Math.max(54,w*.17)});
    function fit(){w=stage.clientWidth;h=stage.clientHeight;if(w<50)return;const d=devicePixelRatio||1;
      cv.width=w*d;cv.height=h*d;cv.style.width=w+'px';cv.style.height=h+'px';ctx.setTransform(d,0,0,d,0,0);if(st!=='play')reset()}
    function reset(){const p=P();y=h*.45;vy=0;score=0;towers=[];sc.textContent='0';for(let i=0;i<4;i++)addTower(w+120+i*p.space)}
    function addTower(x){const p=P(),m=h*.12,ground=h*.9;towers.push({x,gy:m+Math.random()*(ground-m*2-p.gap),passed:false})}
    function flap(){if(st==='ready'||st==='over'&&performance.now()-deadT>500){if(st==='over')reset();st='play';ov.classList.add('hide')}
      if(st==='play'){vy=P().flap;vib(5)}}
    function crash(){st='dead';deadT=performance.now();vib([50,30,50]);if(score>best){best=score;store.set('glideBest',best)}}
    const isDark=()=>OS.isDark();
    function draw(t){
      const p=P(),dk=isDark(),ground=h*.9;
      const C=dk?{sky:'#10202E',far:'#16304A',near:'#1C3D5A',cloud:'#1E3650',a:'#E0603A',b:'#1F8A70',gr:'#0B1824',plane:'#F4F1E8'}
               :{sky:'#CFE7F6',far:'#B3D8EE',near:'#9CCBE5',cloud:'#FFFFFF',a:'#F08A5D',b:'#2FA083',gr:'#7BB98F',plane:'#FFFFFF'};
      ctx.fillStyle=C.sky;ctx.fillRect(0,0,w,h);
      ctx.fillStyle=C.cloud;for(let i=0;i<5;i++){const cx=((i*w*.37-scroll*.15)%(w+160)+w+160)%(w+160)-80,cy=h*(.12+.09*(i%3));
        ctx.beginPath();ctx.arc(cx,cy,22,0,7);ctx.arc(cx+24,cy+6,17,0,7);ctx.arc(cx-22,cy+8,14,0,7);ctx.fill()}
      for(const[layer,col,sp,r]of[[0,C.far,.3,h*.22],[1,C.near,.55,h*.16]]){ctx.fillStyle=col;for(let i=-1;i<6;i++){const cx=((i*r*1.7-scroll*sp)%(r*1.7*6)+r*1.7*6)%(r*1.7*6)-r;ctx.beginPath();ctx.arc(cx,ground+r*.35+layer*10,r,0,7);ctx.fill()}}
      for(const k of towers){ctx.fillStyle=k.passed?C.b:C.a;const rr=10;
        rrect(k.x,-20,p.tw,k.gy+20,rr);rrect(k.x,k.gy+p.gap,p.tw,ground-k.gy-p.gap+20,rr);
        ctx.fillStyle='rgba(0,0,0,.08)';ctx.fillRect(k.x+p.tw*.68,-20,p.tw*.32-rr*.3,k.gy+20);ctx.fillRect(k.x+p.tw*.68,k.gy+p.gap,p.tw*.32-rr*.3,ground-k.gy-p.gap)}
      ctx.fillStyle=C.gr;ctx.fillRect(0,ground,w,h-ground);
      const by=st==='ready'?y+Math.sin(t/260)*8:y, ang=st==='ready'?Math.sin(t/260)*.12:Math.max(-.6,Math.min(1.2,vy/(p.speed*2.2)));
      ctx.save();ctx.translate(p.x,by);ctx.rotate(ang);const s=p.r*1.6;
      ctx.fillStyle=C.plane;ctx.beginPath();ctx.moveTo(s*1.3,0);ctx.lineTo(-s,-s*.75);ctx.lineTo(-s*.45,0);ctx.lineTo(-s,s*.75);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(0,0,0,.14)';ctx.beginPath();ctx.moveTo(s*1.3,0);ctx.lineTo(-s*.45,0);ctx.lineTo(-s,s*.75);ctx.closePath();ctx.fill();ctx.restore();
    }
    function rrect(x,y0,ww,hh,r){if(hh<=0)return;ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y0,ww,hh,r):ctx.rect(x,y0,ww,hh);ctx.fill()}
    function frame(t){if(!towers)return;
      const dt=Math.min(1/30,(t-(last||t))/1000);last=t;const p=P(),ground=h*.9;
      if(st==='play'||st==='ready')scroll+=p.speed*dt*(st==='ready'?.5:1);
      if(st==='play'){
        vy+=p.g*dt;y+=vy*dt;if(y<p.r){y=p.r;vy=0}
        for(const k of towers){k.x-=p.speed*dt;
          if(!k.passed&&k.x+p.tw<p.x){k.passed=true;score++;sc.textContent=score;vib(4)}
          if(p.x+p.r>k.x&&p.x-p.r<k.x+p.tw&&(y-p.r<k.gy||y+p.r>k.gy+p.gap))crash()}
        if(towers[0].x<-p.tw-10){towers.shift();addTower(towers[towers.length-1].x+p.space)}
        if(y+p.r>=ground){y=ground-p.r;crash()}
      }else if(st==='dead'){vy+=p.g*dt;y=Math.min(ground-p.r,y+vy*dt);
        if(y>=ground-p.r&&performance.now()-deadT>350){st='over';ov.innerHTML=`<b>Score ${score}</b><p>Best ${best}. Tap to fly again.</p>`;ov.classList.remove('hide')}}
      draw(t);
    }
    stage.addEventListener('pointerdown',e=>{e.preventDefault();flap()});
    const key=e=>{if(e.key===' '||e.key==='ArrowUp'){e.preventDefault();flap()}};
    return{visible(on){if(on){setTimeout(fit,30);last=0;loop.add(frame);document.addEventListener('keydown',key)}
        else{loop.del(frame);document.removeEventListener('keydown',key);if(st==='play'){st='ready';ov.innerHTML='<b>Paused</b><p>Tap to keep flying.</p>';ov.classList.remove('hide')}}},
      destroy(){loop.del(frame);document.removeEventListener('keydown',key)}};
  }});
})();
