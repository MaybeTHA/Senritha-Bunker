/* Benchmark scenes. Every scene is seeded, so two runs with the same settings draw the same work.
   Sizes scale with the render height, so a higher resolution shows the same scene with more pixels. */
const Scenes=(()=>{
const {Batch,SHAPE}=Renderer;
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const hex=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];
const NEON=['#22D3EE','#38BDF8','#3B82F6','#60A5FA','#67E8F9','#A5F3FC','#818CF8','#2DD4BF','#E0F2FE','#F472B6'].map(hex);
const BG=[0.016,0.024,0.04];

/* ---------------- physics: same code runs in a Web Worker or, if workers fail, on the main thread ---------------- */
function physicsCore(){
  let n=0,x,y,vx,vy,r,W=1280,H=720,head,next,sub=2,seed=1;
  const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
  function resize(m){const ox=x,oy=y,ovx=vx,ovy=vy,or=r,k=Math.min(n,m);
    x=new Float32Array(m);y=new Float32Array(m);vx=new Float32Array(m);vy=new Float32Array(m);r=new Float32Array(m);next=new Int32Array(m);
    if(k){x.set(ox.subarray(0,k));y.set(oy.subarray(0,k));vx.set(ovx.subarray(0,k));vy.set(ovy.subarray(0,k));r.set(or.subarray(0,k))}
    const s=H/1080;for(let i=k;i<m;i++){r[i]=(3+rnd()*7)*s;x[i]=r[i]+rnd()*(W-2*r[i]);y[i]=r[i]+rnd()*H*.5;vx[i]=(rnd()-.5)*300*s;vy[i]=(rnd()-.5)*200*s}
    n=m}
  function step(dt,ax,ay,ap){
    const s=H/1080,g=1400*s;let maxR=0;for(let i=0;i<n;i++)if(r[i]>maxR)maxR=r[i];
    for(let i=0;i<n;i++){const dx=ax-x[i],dy=ay-y[i],d2=dx*dx+dy*dy+400*s*s,f=ap/d2;vx[i]+=dx*f*dt;vy[i]+=(dy*f+g)*dt;
      x[i]+=vx[i]*dt;y[i]+=vy[i]*dt;const ri=r[i];
      if(x[i]<ri){x[i]=ri;vx[i]=-vx[i]*.8}else if(x[i]>W-ri){x[i]=W-ri;vx[i]=-vx[i]*.8}
      if(y[i]<ri){y[i]=ri;vy[i]=-vy[i]*.8}else if(y[i]>H-ri){y[i]=H-ri;vy[i]=-vy[i]*.8;vx[i]*=.995}}
    const cs=Math.max(2,maxR*2),cols=Math.ceil(W/cs)+1,rows=Math.ceil(H/cs)+1;
    if(!head||head.length<cols*rows)head=new Int32Array(cols*rows);head.fill(-1,0,cols*rows);
    for(let i=0;i<n;i++){const c=Math.min(rows-1,Math.max(0,(y[i]/cs)|0))*cols+Math.min(cols-1,Math.max(0,(x[i]/cs)|0));next[i]=head[c];head[c]=i}
    const NB=[[0,0],[1,0],[-1,1],[0,1],[1,1]];
    for(let cy=0;cy<rows;cy++)for(let cx=0;cx<cols;cx++){let i=head[cy*cols+cx];
      while(i>=0){for(const[ox,oy]of NB){const nx=cx+ox,ny=cy+oy;if(nx<0||nx>=cols||ny>=rows)continue;let j=ox===0&&oy===0?next[i]:head[ny*cols+nx];
          while(j>=0){const dx=x[j]-x[i],dy=y[j]-y[i],rr=r[i]+r[j],d2=dx*dx+dy*dy;
            if(d2<rr*rr&&d2>1e-6){const d=Math.sqrt(d2),nxv=dx/d,nyv=dy/d,ov=rr-d,mi=r[i]*r[i],mj=r[j]*r[j],tot=mi+mj;
              x[i]-=nxv*ov*mj/tot;y[i]-=nyv*ov*mj/tot;x[j]+=nxv*ov*mi/tot;y[j]+=nyv*ov*mi/tot;
              const rv=(vx[j]-vx[i])*nxv+(vy[j]-vy[i])*nyv;if(rv<0){const imp=-1.85*rv/tot;vx[i]-=imp*mj*nxv;vy[i]-=imp*mj*nyv;vx[j]+=imp*mi*nxv;vy[j]+=imp*mi*nyv}}
            j=next[j]}}
        i=next[i]}}
  }
  return{init(m){W=m.w;H=m.h;sub=m.sub;seed=m.seed||7;n=0;resize(m.n)},resize,
    stepAll(dt,ax,ay,ap){const h=Math.min(dt,1/30)/sub;for(let k=0;k<sub;k++)step(h,ax,ay,ap)},
    write(out){for(let i=0,o=0;i<n;i++,o+=4){out[o]=x[i];out[o+1]=y[i];out[o+2]=r[i];out[o+3]=Math.hypot(vx[i],vy[i])}},get n(){return n}};
}
class Physics{
  constructor(){this.cur=null;this.n=0;this.ms=0;this.pending=false;this.spare=null;this.worker=null;this.core=null;this.usingWorker=false;
    try{const src=`const C=(${physicsCore.toString()})();onmessage=e=>{const m=e.data;
      if(m.type==='init')C.init(m);else if(m.type==='count')C.resize(m.n);
      else if(m.type==='step'){const t0=performance.now();C.stepAll(m.dt,m.ax,m.ay,m.ap);let b=m.buf;if(b.length<C.n*4)b=new Float32Array(C.n*4);C.write(b);postMessage({buf:b,n:C.n,ms:performance.now()-t0},[b.buffer])}}`;
      this.url=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));this.worker=new Worker(this.url);this.usingWorker=true;
      this.worker.onmessage=e=>{this.pending=false;if(this.cur)this.spare=this.cur;this.cur=e.data.buf;this.n=e.data.n;this.ms=e.data.ms};
      this.worker.onerror=()=>this.fallback()}catch(e){this.fallback()}}
  fallback(){if(this.worker){this.worker.terminate();this.worker=null}this.usingWorker=false;this.pending=false;this.core=physicsCore();if(this.lastInit)this.core.init(this.lastInit)}
  init(n,w,h,sub){this.lastInit={type:'init',n,w,h,sub,seed:11};this.cur=null;this.spare=null;this.n=0;
    if(this.worker)this.worker.postMessage(this.lastInit);else{this.core=this.core||physicsCore();this.core.init(this.lastInit)}}
  count(n){if(this.lastInit)this.lastInit.n=n;if(this.worker)this.worker.postMessage({type:'count',n});else this.core.resize(n)}
  step(dt,ax,ay,ap){
    if(this.worker){if(this.pending)return;const buf=this.spare&&this.spare.length?this.spare:new Float32Array(Math.max(4,this.n*4||4));this.spare=null;this.pending=true;
      this.worker.postMessage({type:'step',dt,ax,ay,ap,buf},[buf.buffer])}
    else{const t0=performance.now();this.core.stepAll(dt,ax,ay,ap);if(!this.cur||this.cur.length<this.core.n*4)this.cur=new Float32Array(this.core.n*4);this.core.write(this.cur);this.n=this.core.n;this.ms=performance.now()-t0}}
  dispose(){if(this.worker)this.worker.terminate();if(this.url)URL.revokeObjectURL(this.url)}
}

/* ---------------- generated images for the image test ---------------- */
function makeImages(size,count){
  const out=[];
  for(let k=0;k<count;k++){const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d'),s=size,R=rng(100+k);
    x.clearRect(0,0,s,s);
    if(k%4===0){const g=x.createRadialGradient(s*.42,s*.38,s*.05,s*.5,s*.5,s*.48);g.addColorStop(0,'#E0F2FE');g.addColorStop(.35,'#38BDF8');g.addColorStop(.75,'#1E3A8A');g.addColorStop(1,'rgba(8,15,40,0)');
      x.fillStyle=g;x.beginPath();x.arc(s/2,s/2,s*.48,0,7);x.fill();x.strokeStyle='rgba(165,243,252,.55)';x.lineWidth=s/180;
      for(let i=0;i<9;i++){x.beginPath();x.ellipse(s/2,s/2,s*.46,s*.46*(i/9),0,0,7);x.stroke()}}
    else if(k%4===1){const n=12,w=s/n;for(let i=0;i<n;i++)for(let j=0;j<n;j++){const v=R();x.fillStyle=`hsla(${190+v*40},90%,${30+v*40}%,${.35+v*.6})`;
      x.beginPath();const cx=i*w+w/2+(j%2)*w/2,cy=j*w*.87+w/2;for(let a=0;a<6;a++)x.lineTo(cx+Math.cos(a*Math.PI/3)*w*.48,cy+Math.sin(a*Math.PI/3)*w*.48);x.fill()}}
    else if(k%4===2){for(let i=0;i<220;i++){const r=s*(.02+R()*.12),px=R()*s,py=R()*s,g=x.createRadialGradient(px,py,0,px,py,r);
        g.addColorStop(0,`hsla(${180+R()*60},100%,${55+R()*30}%,.55)`);g.addColorStop(1,'hsla(200,100%,50%,0)');x.fillStyle=g;x.fillRect(px-r,py-r,r*2,r*2)}}
    else{x.fillStyle='#0B1222';x.fillRect(0,0,s,s);x.strokeStyle='#22D3EE';x.lineWidth=s/128;
      for(let i=0;i<=16;i++){x.globalAlpha=i%4?.25:.8;x.beginPath();x.moveTo(i*s/16,0);x.lineTo(i*s/16,s);x.moveTo(0,i*s/16);x.lineTo(s,i*s/16);x.stroke()}
      x.globalAlpha=1;x.fillStyle='#E0F2FE';x.font=`700 ${s*.16}px "Chakra Petch",system-ui,sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillText('STP',s/2,s/2)}
    out.push(c)}
  return out;
}

/* ---------------- scene building blocks ---------------- */
function particleField(n,w,h,R){
  const s=h/1080,p={n,x:new Float32Array(n),y:new Float32Array(n),vx:new Float32Array(n),vy:new Float32Array(n),sz:new Float32Array(n),c:new Uint8Array(n),a:new Float32Array(n)};
  for(let i=0;i<n;i++){p.x[i]=R()*w;p.y[i]=R()*h;const sp=(40+R()*220)*s,an=R()*6.283;p.vx[i]=Math.cos(an)*sp;p.vy[i]=Math.sin(an)*sp;p.sz[i]=(1.2+R()*R()*7)*s;p.c[i]=(R()*NEON.length)|0;p.a[i]=.45+R()*.5}
  return p}
function obstaclesAt(t,w,h){const s=h/1080;return[[w*.5+Math.cos(t*.5)*w*.28,h*.5+Math.sin(t*.7)*h*.25,90*s],[w*.3+Math.sin(t*.37)*w*.18,h*.4+Math.cos(t*.44)*h*.3,60*s],[w*.72+Math.cos(t*.61+1)*w*.15,h*.62+Math.sin(t*.53)*h*.22,70*s]]}
function stepParticles(p,dt,w,h,obs){const {x,y,vx,vy,sz}=p;
  for(let i=0;i<p.n;i++){let px=x[i]+vx[i]*dt,py=y[i]+vy[i]*dt;const r=sz[i];
    if(px<r){px=r;vx[i]=-vx[i]}else if(px>w-r){px=w-r;vx[i]=-vx[i]}
    if(py<r){py=r;vy[i]=-vy[i]}else if(py>h-r){py=h-r;vy[i]=-vy[i]}
    for(let k=0;k<obs.length;k++){const o=obs[k],dx=px-o[0],dy=py-o[1],rr=o[2]+r,d2=dx*dx+dy*dy;
      if(d2<rr*rr){const d=Math.sqrt(d2)||1,nx=dx/d,ny=dy/d,dot=vx[i]*nx+vy[i]*ny;if(dot<0){vx[i]-=2*dot*nx;vy[i]-=2*dot*ny}px=o[0]+nx*rr;py=o[1]+ny*rr}}
    x[i]=px;y[i]=py}}
function drawParticles(B,p,glow){for(let i=0;i<p.n;i++){const c=NEON[p.c[i]];B.push(p.x[i],p.y[i],p.sz[i],0,c[0],c[1],c[2],p.a[i],SHAPE.circle,glow,0,1)}}
function shapeField(n,w,h,R){
  const s=h/1080,o={n,x:new Float32Array(n),y:new Float32Array(n),vx:new Float32Array(n),vy:new Float32Array(n),rot:new Float32Array(n),vr:new Float32Array(n),sz:new Float32Array(n),sh:new Uint8Array(n),c:new Uint8Array(n),a:new Float32Array(n),asp:new Float32Array(n)};
  for(let i=0;i<n;i++){o.x[i]=R()*w;o.y[i]=R()*h;const sp=(20+R()*140)*s,an=R()*6.283;o.vx[i]=Math.cos(an)*sp;o.vy[i]=Math.sin(an)*sp;o.rot[i]=R()*6.283;o.vr[i]=(R()-.5)*6;
    o.sz[i]=(4+R()*R()*22)*s;o.sh[i]=(R()*5)|0;o.c[i]=(R()*NEON.length)|0;o.a[i]=.25+R()*.6;o.asp[i]=o.sh[i]===1&&R()<.4?1.6:1}
  return o}
function stepShapes(o,dt,w,h){for(let i=0;i<o.n;i++){o.x[i]+=o.vx[i]*dt;o.y[i]+=o.vy[i]*dt;o.rot[i]+=o.vr[i]*dt;
  if(o.x[i]<0||o.x[i]>w)o.vx[i]=-o.vx[i];if(o.y[i]<0||o.y[i]>h)o.vy[i]=-o.vy[i]}}
function drawShapes(B,o,glow){for(let i=0;i<o.n;i++){const c=NEON[o.c[i]];B.push(o.x[i],o.y[i],o.sz[i],o.rot[i],c[0],c[1],c[2],o.a[i],o.sh[i],glow,0,o.asp[i])}}
function spriteField(n,w,h,R,layers){const s=h/1080,o={n,x:new Float32Array(n),y:new Float32Array(n),vx:new Float32Array(n),vy:new Float32Array(n),sz:new Float32Array(n),ph:new Float32Array(n),l:new Uint8Array(n),vr:new Float32Array(n)};
  for(let i=0;i<n;i++){o.x[i]=R()*w;o.y[i]=R()*h;o.vx[i]=(R()-.5)*120*s;o.vy[i]=(R()-.5)*120*s;o.sz[i]=(14+R()*R()*90)*s;o.ph[i]=R()*6.283;o.l[i]=(R()*layers)|0;o.vr[i]=(R()-.5)*2}return o}
function stepSprites(o,dt,w,h){for(let i=0;i<o.n;i++){o.x[i]+=o.vx[i]*dt;o.y[i]+=o.vy[i]*dt;if(o.x[i]<0||o.x[i]>w)o.vx[i]=-o.vx[i];if(o.y[i]<0||o.y[i]>h)o.vy[i]=-o.vy[i]}}
function drawSprites(B,o,t,process){for(let i=0;i<o.n;i++){const ph=o.ph[i],sc=1+.35*Math.sin(t*1.7+ph);B.push(o.x[i],o.y[i],o.sz[i]*sc,t*o.vr[i]+ph,1,1,1,.55+.45*Math.sin(t*1.1+ph*2),SHAPE.sprite,process,o.l[i],1)}}
function lightsAt(t,n,w,h,lightsArr,colArr,intensity){const s=h/1080;
  for(let i=0;i<n;i++){const a=i*2.399,sp=.25+(i%7)*.06;lightsArr[i*4]=w*(.5+.42*Math.sin(t*sp+a));lightsArr[i*4+1]=h*(.5+.4*Math.cos(t*sp*1.3+a*1.7));
    lightsArr[i*4+2]=(220+(i%5)*70)*s;lightsArr[i*4+3]=intensity;const c=NEON[i%NEON.length];colArr[i*3]=c[0];colArr[i*3+1]=c[1];colArr[i*3+2]=c[2]}}
function drawPhysics(B,P,glow){const b=P.cur;if(!b)return;const n=Math.min(P.n,b.length/4|0);
  for(let i=0,o=0;i<n;i++,o+=4){const sp=Math.min(1,b[o+3]/900),r=.15+.85*sp,g=.55+.45*sp;B.push(b[o],b[o+1],b[o+2],0,r*.4,g,1,.95,SHAPE.circle,glow*.5,0,1)}}

/* ---------------- the seven modes ---------------- */
const MODES=[
 {id:'particles',name:'Particle Stress',short:'Thousands of particles with collisions, glow and transparency.',
  option:{label:'Particle count',values:[100,500,1000,5000,10000,25000,50000],def:10000,fmt:v=>v.toLocaleString()},
  create(c){const {w,h}=c,R=rng(1),n=Math.round(c.opt*c.density),p=particleField(n,w,h,R),B=new Batch(n+8);let t=0;
    return{objects:()=>n+3,update(dt){t+=dt;stepParticles(p,dt,w,h,obstaclesAt(t,w,h))},
      render(G){G.begin(BG);B.clear();drawParticles(B,p,c.q.glow);G.draw(B);B.clear();for(const o of obstaclesAt(t,w,h))B.push(o[0],o[1],o[2],0,.13,.83,.93,.9,SHAPE.ring,c.q.glow,0,1);G.draw(B);G.end(c.q.bloom*.6,c.sync)}}}},
 {id:'geometry',name:'Geometric Stress',short:'Circles, squares, triangles, hexagons and rings rotating with alpha blending.',
  option:{label:'Object count',values:[1000,5000,10000,25000,50000,100000],def:10000,fmt:v=>v.toLocaleString()},
  create(c){const {w,h}=c,R=rng(2),n=Math.round(c.opt*c.density),o=shapeField(n,w,h,R),B=new Batch(n);
    return{objects:()=>n,update(dt){stepShapes(o,dt,w,h)},render(G){G.begin(BG);B.clear();drawShapes(B,o,c.q.glow*.35);G.draw(B);G.end(c.q.bloom*.4,c.sync)}}}},
 {id:'fluid',name:'Fluid & Waves',short:'Layered waves with domain-warp distortion and particles carried by the flow.',
  option:{label:'Simulation complexity',values:['Low','Medium','High','Extreme'],def:'High',fmt:v=>v},
  create(c){const {w,h}=c,R=rng(3),cx={Low:[6,1,1500],Medium:[12,2,3000],High:[20,3,5000],Extreme:[32,5,8000]}[c.opt],n=Math.round(cx[2]*c.density),p=particleField(n,w,h,R),B=new Batch(n),s=h/1080;
    const stir=new Float32Array(16),cols=[hex('#03111F'),hex('#0B4F8A'),hex('#67E8F9')];let t=0;
    return{objects:()=>n+1,layers:cx[0],update(dt){t+=dt;
        for(let k=0;k<4;k++){stir[k*4]=w*(.5+.38*Math.sin(t*.31+k*1.7));stir[k*4+1]=h*(.5+.36*Math.cos(t*.27+k*2.3));stir[k*4+2]=(k%2?1:-1)*1.2}
        const {x,y,vx,vy}=p;for(let i=0;i<n;i++){const X=x[i]/h*3.2,Y=y[i]/h*3.2;let fx=Math.sin(Y*1.3+t*.7)+.6*Math.sin(Y*2.1-X*.7+t*.4),fy=Math.cos(X*1.1-t*.6)+.6*Math.cos(X*1.9+Y*.5+t*.5);
          for(let k=0;k<4;k++){const dx=x[i]-stir[k*4],dy=y[i]-stir[k*4+1],d2=(dx*dx+dy*dy)/(h*h)*10;const f=stir[k*4+2]*Math.exp(-d2*2.5)*3;fx+=-dy/h*f*10;fy+=dx/h*f*10}
          vx[i]+=(fx*90*s-vx[i])*Math.min(1,dt*2);vy[i]+=(fy*90*s-vy[i])*Math.min(1,dt*2);x[i]+=vx[i]*dt;y[i]+=vy[i]*dt;
          if(x[i]<0)x[i]+=w;else if(x[i]>w)x[i]-=w;if(y[i]<0)y[i]+=h;else if(y[i]>h)y[i]-=h}},
      render(G){G.begin(BG);G.fluidPass(t,cx[0],cx[1],cols,stir,1);B.clear();for(let i=0;i<n;i++){const k=p.c[i]%3,cc=NEON[k];B.push(p.x[i],p.y[i],p.sz[i]*.6,0,cc[0],cc[1],cc[2],.7,SHAPE.circle,c.q.glow*.8,0,1)}G.draw(B,true);G.end(c.q.bloom*.7,c.sync)}}}},
 {id:'lighting',name:'Lighting & Glow',short:'Moving lights with soft shadows, additive blending, bloom and stacked glows.',
  option:{label:'Light sources',values:[4,8,16,32,48,64],def:16,fmt:v=>v},
  create(c){const {w,h}=c,R=rng(4),L=c.opt,no=Math.min(32,Math.round(12*c.density)),s=h/1080,lights=new Float32Array(256),lc=new Float32Array(192),occ=new Float32Array(96),occBase=[];
    for(let i=0;i<no;i++)occBase.push([R()*w,R()*h,(22+R()*40)*s,R()*6.283,.2+R()*.5]);
    const tile=Math.round(48*s),cols=Math.ceil(w/tile)+1,rows=Math.ceil(h/tile)+1,B=new Batch(cols*rows+no+L*3+8);let t=0;
    return{objects:()=>cols*rows+no+L*3,update(dt){t+=dt;lightsAt(t,L,w,h,lights,lc,1.1);
        occBase.forEach((o,i)=>{occ[i*3]=o[0]+Math.cos(t*o[4]+o[3])*60*s;occ[i*3+1]=o[1]+Math.sin(t*o[4]*1.3+o[3])*60*s;occ[i*3+2]=o[2]})},
      render(G){G.begin([.01,.012,.02]);B.clear();for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)B.push(i*tile,j*tile,tile*.46,0,.06,.09,.14,1,SHAPE.square,0,0,1);G.draw(B);
        G.lightPass(lights,lc,L,occ,no,true,[.004,.006,.012]);
        B.clear();for(let i=0;i<no;i++)B.push(occ[i*3],occ[i*3+1],occ[i*3+2],0,.02,.03,.05,1,SHAPE.circle,0,0,1);G.draw(B);
        B.clear();for(let i=0;i<L;i++){const x=lights[i*4],y=lights[i*4+1];for(let k=0;k<3;k++)B.push(x,y,(18+k*34)*s,0,lc[i*3],lc[i*3+1],lc[i*3+2],.9-k*.25,SHAPE.light,0,0,1)}G.draw(B,true);
        G.end(Math.max(.35,c.q.bloom),c.sync)}}}},
 {id:'physics',name:'Physics Simulation',short:'Bouncing balls with gravity, collisions and impulse response, solved in a Web Worker.',
  option:{label:'Ball count',values:[250,500,1000,2000,4000,8000],def:2000,fmt:v=>v.toLocaleString()},
  create(c){const {w,h}=c,n=Math.round(c.opt*c.density),P=new Physics(),B=new Batch(n+4),s=h/1080;P.init(n,w,h,c.q.substeps);let t=0;
    return{objects:()=>n,physics:P,update(dt){t+=dt;const ax=w*(.5+.35*Math.sin(t*.6)),ay=h*(.45+.25*Math.cos(t*.9));this.ax=ax;this.ay=ay;P.step(dt,ax,ay,(t%8<3?-1:1)*6e6*s*s)},
      render(G){G.begin(BG);B.clear();drawPhysics(B,P,c.q.glow);B.push(this.ax||0,this.ay||0,26*s,0,.13,.83,.93,.8,SHAPE.ring,c.q.glow,0,1);G.draw(B);G.end(c.q.bloom*.4,c.sync)},dispose(){P.dispose()}}}},
 {id:'images',name:'Image Rendering',short:'High-resolution textures scaled, rotated and alpha-blended, with per-pixel filtering on High and Ultra.',
  option:{label:'Sprites',values:[100,500,1000,2500,5000,10000],def:1000,fmt:v=>v.toLocaleString()},
  option2:{label:'Texture resolution',values:[512,1024,2048,4096],def:1024,fmt:v=>`${v} × ${v}`},
  async prepare(c,G){G.setTextures(makeImages(c.opt2,4),c.q)},
  create(c){const {w,h}=c,R=rng(6),n=Math.round(c.opt*c.density),o=spriteField(n,w,h,R,4),B=new Batch(n);let t=0;const proc=c.q.process?.6:0;
    return{objects:()=>n,update(dt){t+=dt;stepSprites(o,dt,w,h)},render(G){G.begin(BG);B.clear();drawSprites(B,o,t,proc);G.draw(B);G.end(c.q.bloom*.3,c.sync)}}}},
 {id:'ultimate',name:'Ultimate GPU Stress',short:'Everything at once. The load rises in five stages over the run to test stability.',
  option:null,
  async prepare(c,G){G.setTextures(makeImages(1024,4),c.q)},
  create(c){const {w,h}=c,R=rng(7),d=c.density,s=h/1080,MAXP=Math.round(30000*d),MAXS=Math.round(15000*d),MAXB=Math.round(2000*d),MAXI=Math.round(750*d);
    const p=particleField(MAXP,w,h,R),o=shapeField(MAXS,w,h,R),sp=spriteField(MAXI,w,h,R,4),P=new Physics(),B=new Batch(MAXP+MAXS+MAXB+MAXI+200);
    const lights=new Float32Array(256),lc=new Float32Array(192),occ=new Float32Array(96),stir=new Float32Array(16),cols=[hex('#020A14'),hex('#0A3A66'),hex('#38BDF8')];
    let t=0,stage=1,np=0,ns=0,nb=0,ni=0,nl=0;
    const apply=()=>{const f=stage/5;np=Math.round(MAXP*f);ns=Math.round(MAXS*f);nb=Math.round(MAXB*f);ni=Math.round(MAXI*f);nl=Math.min(30,6*stage)};
    apply();P.init(nb,w,h,Math.min(2,c.q.substeps));
    return{physics:P,get stage(){return stage},objects:()=>np+ns+nb+ni+nl*2+1,
      update(dt,progress){const st=Math.min(5,1+Math.floor((progress||0)*5));if(st!==stage){stage=st;apply();P.count(nb)}t+=dt;
        p.n=np;o.n=ns;sp.n=ni;stepParticles(p,dt,w,h,obstaclesAt(t,w,h));stepShapes(o,dt,w,h);stepSprites(sp,dt,w,h);
        P.step(dt,w*(.5+.3*Math.sin(t*.5)),h*.4,(t%7<3?-1:1)*4e6*s*s);lightsAt(t,nl,w,h,lights,lc,.9);
        for(let k=0;k<4;k++){stir[k*4]=w*(.5+.38*Math.sin(t*.31+k*1.7));stir[k*4+1]=h*(.5+.36*Math.cos(t*.27+k*2.3));stir[k*4+2]=(k%2?1:-1)*1.2}
        const b=P.cur;for(let i=0;i<16;i++){if(b&&i*4+2<b.length&&i<P.n){occ[i*3]=b[i*4];occ[i*3+1]=b[i*4+1];occ[i*3+2]=b[i*4+2]*2.5}else{occ[i*3]=-999;occ[i*3+1]=-999;occ[i*3+2]=1}}},
      render(G){G.begin(BG);G.fluidPass(t,6+stage*4,1+(stage>>1),cols,stir,.5);
        B.clear();drawSprites(B,sp,t,c.q.process?.4:0);G.draw(B);
        B.clear();drawShapes(B,o,c.q.glow*.3);G.draw(B);
        G.lightPass(lights,lc,nl,occ,16,true,[0,0,0]);
        B.clear();drawPhysics(B,P,c.q.glow);G.draw(B);
        B.clear();drawParticles(B,p,c.q.glow);G.draw(B,true);
        B.clear();for(let i=0;i<nl;i++)B.push(lights[i*4],lights[i*4+1],40*s,0,lc[i*3],lc[i*3+1],lc[i*3+2],.8,SHAPE.light,0,0,1);G.draw(B,true);
        G.end(Math.max(.5,c.q.bloom),c.sync)},dispose(){P.dispose()}}}},
];
return{MODES,BG};
})();
