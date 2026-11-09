/* Snake: grid game with interpolated (smooth) movement. Swipe or arrow keys to steer. */
(()=>{
const {$,vib,store,loop}=OS;
OS.register('snake',{name:'Snake',bg:'#2F7D4F',fg:'#fff',installable:true,category:'Game',size:'36 KB',
  desc:'Eat the dots and grow longer. Swipe to steer and don\'t bite your tail.',
  glyph:'<svg viewBox="0 0 24 24"><path d="M5 18.5h8.5a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6H18"/><circle cx="18.5" cy="6.5" r=".6"/></svg>',
  build(el){
    el.classList.add('game');
    el.innerHTML=`<div class="ghead"><div><span>Score</span><b class="sc">0</b></div><h1>Snake</h1><div><span>Best</span><b class="bs">0</b></div></div>
      <div class="stage"><canvas></canvas><div class="gover"><b>Snake</b><p>Swipe to steer. Tap to start.</p></div></div>`;
    const N=17, stage=$('.stage',el), cv=$('canvas',el), ctx=cv.getContext('2d'), ov=$('.gover',el);
    let size=300, cell=17, col={}, snake, prev, dir, queue, food, step, acc, score, best=store.get('snakeBest',0), playing=false, dead=false, last=0;
    $('.bs',el).textContent=best;
    const DIRS={u:[0,-1],d:[0,1],l:[-1,0],r:[1,0]};
    function reset(){const m=N>>1;snake=[{x:m,y:m},{x:m-1,y:m},{x:m-2,y:m}];prev=snake.map(p=>({...p}));dir='r';queue=[];step=.15;acc=0;score=0;dead=false;$('.sc',el).textContent=0;placeFood()}
    function placeFood(){do{food={x:Math.random()*N|0,y:Math.random()*N|0}}while(snake.some(s=>s.x===food.x&&s.y===food.y))}
    function fit(){size=Math.floor(Math.min(stage.clientWidth-24,stage.clientHeight-24));if(size<100)return;cell=size/N;const d=devicePixelRatio||1;
      cv.width=size*d;cv.height=size*d;cv.style.width=cv.style.height=size+'px';ctx.setTransform(d,0,0,d,0,0);
      const cs=getComputedStyle(document.documentElement);col={bg:cs.getPropertyValue('--card').trim(),grid:cs.getPropertyValue('--key').trim(),fg:cs.getPropertyValue('--fg').trim(),acc:cs.getPropertyValue('--accent').trim()};draw(0,0)}
    function tickGame(){
      prev=snake.map(p=>({...p})); if(queue.length)dir=queue.shift();
      const h=snake[0], d=DIRS[dir], n={x:h.x+d[0],y:h.y+d[1]}, eat=n.x===food.x&&n.y===food.y;
      if(n.x<0||n.y<0||n.x>=N||n.y>=N||snake.slice(0,eat?snake.length:snake.length-1).some(s=>s.x===n.x&&s.y===n.y))return die();
      snake.unshift(n); if(eat){score++;$('.sc',el).textContent=score;step=Math.max(.075,step-.004);placeFood();vib(10)}else snake.pop();
    }
    function die(){playing=false;dead=true;vib([40,40,40]);if(score>best){best=score;store.set('snakeBest',best);$('.bs',el).textContent=best}
      ov.innerHTML=`<b>Game over</b><p>Score ${score}. Tap to play again.</p>`;ov.classList.remove('hide')}
    function draw(a,t){
      ctx.fillStyle=col.bg;ctx.fillRect(0,0,size,size);
      ctx.fillStyle=col.grid;for(let y=0;y<N;y++)for(let x=(y&1);x<N;x+=2)ctx.fillRect(x*cell,y*cell,cell,cell);
      if(!snake)return;
      const fp=1+.08*Math.sin(t/180);ctx.fillStyle=col.acc;ctx.beginPath();ctx.arc((food.x+.5)*cell,(food.y+.5)*cell,cell*.32*fp,0,7);ctx.fill();
      const pts=snake.map((s,i)=>{const p=prev[i]||s;return[(p.x+(s.x-p.x)*a+.5)*cell,(p.y+(s.y-p.y)*a+.5)*cell]});
      ctx.strokeStyle=col.fg;ctx.lineWidth=cell*.7;ctx.lineCap=ctx.lineJoin='round';ctx.beginPath();
      // head and tail glide between cells; the body passes through the real grid corners
      ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<snake.length;i++){ctx.lineTo((snake[i].x+.5)*cell,(snake[i].y+.5)*cell);}
      ctx.lineTo(pts[pts.length-1][0],pts[pts.length-1][1]);ctx.stroke();
      const [hx,hy]=pts[0], d=DIRS[queue[0]&&a>.5?queue[0]:dir], ex=-d[1]*cell*.16, ey=d[0]*cell*.16;
      ctx.fillStyle=col.bg;for(const s of[1,-1]){ctx.beginPath();ctx.arc(hx+d[0]*cell*.12+ex*s,hy+d[1]*cell*.12+ey*s,cell*.08,0,7);ctx.fill()}
    }
    function frame(t){const dt=Math.min(.05,(t-(last||t))/1000);last=t;
      if(playing){acc+=dt;while(acc>=step&&playing){acc-=step;tickGame()}}
      draw(playing?Math.min(1,acc/step):1,t)}
    function startGame(){if(dead||!snake)reset();playing=true;last=0;ov.classList.add('hide')}
    function turn(k){const lastD=queue.length?queue[queue.length-1]:dir, d=DIRS[k], l=DIRS[lastD];
      if(d[0]===-l[0]&&d[1]===-l[1]||k===lastD||queue.length>2)return;queue.push(k)}
    let sx=0,sy=0,down=false;
    stage.addEventListener('pointerdown',e=>{down=true;sx=e.clientX;sy=e.clientY;if(!playing)startGame()});
    stage.addEventListener('pointermove',e=>{if(!down||!playing)return;const dx=e.clientX-sx,dy=e.clientY-sy;if(Math.hypot(dx,dy)<18)return;
      turn(Math.abs(dx)>Math.abs(dy)?(dx>0?'r':'l'):(dy>0?'d':'u'));sx=e.clientX;sy=e.clientY});
    const up=()=>down=false; stage.addEventListener('pointerup',up); stage.addEventListener('pointercancel',up);
    const key=e=>{const m={ArrowUp:'u',ArrowDown:'d',ArrowLeft:'l',ArrowRight:'r'}[e.key];if(m){e.preventDefault();if(!playing)startGame();turn(m)}else if(e.key===' '&&!playing)startGame()};
    reset();
    return{visible(on){if(on){setTimeout(fit,30);loop.add(frame);document.addEventListener('keydown',key)}
        else{loop.del(frame);document.removeEventListener('keydown',key);if(playing){playing=false;ov.innerHTML='<b>Paused</b><p>Tap to keep playing.</p>';ov.classList.remove('hide')}}},
      destroy(){loop.del(frame);document.removeEventListener('keydown',key)}};
  }});
})();
