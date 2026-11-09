/* Visual styles. Each draws one frame from the beat state S, computed from the song clock,
   so every ring, burst and flash lands exactly on its beat. */
const Visuals=(()=>{
const PAL=['#FF3D7F','#FFB020','#2EE6D6','#8B5CFF'];
const BG='#07070C';
const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return`rgba(${n>>16},${n>>8&255},${n&255},${Math.max(0,Math.min(1,a)).toFixed(3)})`};
const hash=x=>{x=Math.sin(x*127.1+311.7)*43758.5453;return x-Math.floor(x)};
const ease=x=>1-Math.pow(1-x,3);
function fade(c,w,h,S){c.fillStyle=S.trails?rgba(BG,.3):BG;c.fillRect(0,0,w,h)}
/* spectrum value 0..1 for position i of n on a log frequency scale */
function band(S,i,n){const sp=S.spec;if(!sp)return 0;const a=Math.floor(2*Math.pow(110,i/n)),b=Math.max(a+1,Math.floor(2*Math.pow(110,(i+1)/n)));
  let s=0;for(let k=a;k<b&&k<sp.length;k++)s+=sp[k];return s/(b-a)/255}

function orb(c,w,h,S){
  fade(c,w,h,S);
  const cx=w/2,cy=h*.47,R=Math.min(w,h)*.15,k=S.strength;
  for(const b of S.recent){const age=S.t-b.t;if(age<0||age>2.4)continue;
    const r=R*(1.12+age*(1.6+S.energy*1.6)),a=(1-age/2.4)*(b.down?.95:.5);
    c.strokeStyle=rgba(b.col,a);c.lineWidth=(b.down?7:3)*(1-age/2.4)+1;c.beginPath();c.arc(cx,cy,r,0,6.2832);c.stroke()}
  const n=72,r0=R*1.1;c.strokeStyle=rgba(S.col,.9);c.lineCap='round';c.lineWidth=Math.max(2,6.2832*r0/n*.42);c.beginPath();
  for(let i=0;i<n;i++){const j=i<n/2?i:n-1-i,v=band(S,j,n/2),len=R*.06+v*R*1.25*(1+.3*S.beatEnv*k),an=i/n*6.2832-1.5708;
    c.moveTo(cx+Math.cos(an)*r0,cy+Math.sin(an)*r0);c.lineTo(cx+Math.cos(an)*(r0+len),cy+Math.sin(an)*(r0+len))}
  c.stroke();
  for(const q of S.kickList){const age=S.t-q.t;if(age<0||age>1.1)continue;const p=ease(age/1.1);c.fillStyle=rgba(q.col,1-age/1.1);c.beginPath();
    for(let j=0;j<16;j++){const an=hash(q.i*31+j)*6.2832,d=R*1.15+R*(1.1+hash(q.i*17+j)*2.4)*p,s=1.5+hash(q.i*7+j)*2.5;
      c.moveTo(cx+Math.cos(an)*d+s,cy+Math.sin(an)*d);c.arc(cx+Math.cos(an)*d,cy+Math.sin(an)*d,s,0,6.2832)}c.fill()}
  const r=R*(1+(.17*S.kickEnv+.07*S.beatEnv)*k);
  c.fillStyle=S.col;c.beginPath();c.arc(cx,cy,r,0,6.2832);c.fill();
  c.fillStyle=BG;c.beginPath();c.arc(cx,cy,r*.64,0,6.2832);c.fill();
  c.fillStyle=rgba(S.col,.35+.65*S.beatEnv);c.font=`700 ${Math.round(r*.62)}px Unbounded, system-ui, sans-serif`;c.textAlign='center';c.textBaseline='middle';
  c.fillText(S.playing||S.hasSong?String(S.beatInBar+1):'',cx,cy+r*.04);
}

const caps=[];
function bars(c,w,h,S){
  c.fillStyle=BG;c.fillRect(0,0,w,h);
  if(S.downEnv>0){c.fillStyle=rgba(S.col,.14*S.downEnv*S.strength);c.fillRect(0,0,w,h)}
  const n=Math.max(18,Math.min(48,Math.floor(w/14))),gap=4,bw=(w-32-gap*(n-1))/n,base=h*.6,maxH=h*.4;
  for(let i=0;i<n;i++){const v=band(S,i,n)*(1+.22*S.beatEnv*S.strength),bh=Math.max(3,v*maxH),x=16+i*(bw+gap);
    caps[i]=Math.max(bh,(caps[i]||0)-maxH*.012);
    c.fillStyle=rgba(S.col,.92);c.fillRect(x,base-bh,bw,bh);
    c.fillStyle=rgba(S.col,.22);c.fillRect(x,base+6,bw,bh*.45);
    c.fillStyle='#FFFFFF';c.fillRect(x,base-caps[i]-6,bw,3)}
  c.fillStyle=rgba('#FFFFFF',.35+.65*S.beatEnv);c.fillRect(16,base+1,w-32,2+3*S.beatEnv);
}

function tunnel(c,w,h,S){
  fade(c,w,h,S);
  const cx=w/2,cy=h*.47,m=Math.min(w,h);
  c.lineJoin='round';
  for(const b of S.recent){const age=S.t-b.t;if(age<0||age>3)continue;
    const s=m*.05*Math.exp(age*(1.25+S.energy*.9)),a=Math.min(1,(1-age/3)*1.6)*(b.down?1:.6);if(s>m*1.6)continue;
    c.save();c.translate(cx,cy);c.rotate(b.i*.21+age*.35);c.strokeStyle=rgba(b.col,a);c.lineWidth=(b.down?6:2.5)*(1+age);c.strokeRect(-s,-s,s*2,s*2);c.restore()}
  for(const q of S.highList){const age=S.t-q.t;if(age<0||age>.5)continue;const an=hash(q.i)*6.2832,d=m*(.12+ease(age/.5)*.5);
    c.fillStyle=rgba('#FFFFFF',1-age/.5);c.beginPath();c.arc(cx+Math.cos(an)*d,cy+Math.sin(an)*d,2.5,0,6.2832);c.fill()}
  const s=m*.035*(1+.5*S.kickEnv*S.strength);c.save();c.translate(cx,cy);c.rotate(S.t*.6);c.fillStyle=S.col;c.fillRect(-s,-s,s*2,s*2);c.restore();
}
let wPeak=.5;
function wave(c,w,h,S){
  fade(c,w,h,S);
  const wv=S.wave;let dev=0;if(wv)for(let i=0;i<wv.length;i+=4)dev=Math.max(dev,Math.abs(wv[i]-128)/128);
  wPeak=Math.max(dev,wPeak*.985,.12);                 // auto-gain so quiet passages still move
  const cy=h*.47,amp=h*.2*(1+.35*S.beatEnv*S.strength)/wPeak*.85;
  for(const b of S.recent){const age=S.t-b.t;if(age<0||age>1.6)continue;const y=age*h*.18;c.fillStyle=rgba(b.col,(1-age/1.6)*(b.down?.5:.22));
    c.fillRect(0,cy-amp-14-y,w,b.down?3:1.5);c.fillRect(0,cy+amp+12+y,w,b.down?3:1.5)}
  const layers=[[1,.95,3+4*S.kickEnv],[.6,.45,2],[-.45,.3,2]];
  for(const[sc,al,lw]of layers){c.strokeStyle=rgba(S.col,al);c.lineWidth=lw;c.lineJoin='round';c.beginPath();
    const n=96;for(let i=0;i<=n;i++){const k=wv?Math.floor(i/n*(wv.length-1)):0,v=wv?(wv[k]-128)/128:Math.sin(i*.2+S.t*2)*.15,
      x=i/n*w,y=cy+v*amp*sc*(.6+.4*Math.sin(i/n*Math.PI));i?c.lineTo(x,y):c.moveTo(x,y)}c.stroke()}
}

let rot=0,lastT=0;
function galaxy(c,w,h,S){
  fade(c,w,h,S);
  const dt=Math.max(0,Math.min(.1,S.t-lastT));lastT=S.t;rot+=dt*(.18+1.6*S.kickEnv*S.strength+.3*S.energy);
  const cx=w/2,cy=h*.47,m=Math.min(w,h)*.46,puff=1+.12*S.beatEnv*S.strength;
  for(let arm=0;arm<4;arm++){c.fillStyle=rgba(PAL[(arm+S.barIdx)%4],.85);c.beginPath();
    for(let i=0;i<110;i++){const f=i/110,r=m*(.08+f*.92)*puff,an=rot*(1.6-f)+arm*1.5708+f*4.2+hash(i*7+arm)*.35,
      x=cx+Math.cos(an)*r,y=cy+Math.sin(an)*r*.82,s=.8+2.2*(1-f)*(.6+hash(i+arm*13)*.8);c.moveTo(x+s,y);c.arc(x,y,s,0,6.2832)}c.fill()}
  const r=m*.07*(1+.6*S.kickEnv*S.strength);c.fillStyle='#FFFFFF';c.beginPath();c.arc(cx,cy,r,0,6.2832);c.fill();
  c.strokeStyle=rgba(S.col,.5*S.beatEnv);c.lineWidth=2;c.beginPath();c.arc(cx,cy,r*2.4,0,6.2832);c.stroke();
}

function words(c,w,h,S){
  c.fillStyle=BG;c.fillRect(0,0,w,h);
  if(S.downEnv>0){c.fillStyle=rgba(S.col,.1*S.downEnv*S.strength);c.fillRect(0,0,w,h)}
  const list=S.words&&S.words.length?S.words:['Senritha\'s','Rhythm'],word=list[((S.beatIdx%list.length)+list.length)%list.length].toUpperCase();
  let fs=Math.min(w*.2,h*.14);c.font=`700 ${fs}px Unbounded, system-ui, sans-serif`;const tw=c.measureText(word).width;if(tw>w*.86){fs*=w*.86/tw;c.font=`700 ${fs}px Unbounded, system-ui, sans-serif`}
  const sc=1+.12*S.beatEnv*S.strength,cy=h*.45;
  c.save();c.translate(w/2,cy);c.scale(sc,sc);c.textAlign='center';c.textBaseline='middle';
  c.fillStyle=rgba(S.col,.18);c.fillText(word,6,6);c.fillStyle=S.col;c.fillText(word,0,0);c.restore();
  const n=Math.max(16,Math.floor(w/16)),bw=w/n;c.fillStyle=rgba('#FFFFFF',.5);
  for(let i=0;i<n;i++){const v=band(S,i,n),bh=2+v*h*.06;c.fillRect(i*bw+bw*.3,cy+fs*.75,bw*.4,bh)}
  if(S.artist){c.font=`600 ${Math.round(Math.max(13,fs*.16))}px Figtree, system-ui, sans-serif`;c.fillStyle=rgba('#FFFFFF',.55);c.textAlign='center';c.fillText(S.artist,w/2,cy-fs*.85)}
}
return{PAL,styles:{orb,bars,tunnel,wave,galaxy,words},
  names:{orb:'Orb',bars:'Bars',tunnel:'Tunnel',wave:'Wave',galaxy:'Galaxy',words:'Words'},
  mood:{low:['wave','words'],mid:['orb','galaxy'],high:['bars','tunnel']}};
})();
