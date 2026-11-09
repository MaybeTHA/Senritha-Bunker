/* Pulse: music player whose tracks are generated live with Web Audio. Keeps playing in the background. */
(()=>{
const {$,$$,vib,loop,prefs}=OS;
const SCALES={minor:[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],pent:[0,2,4,7,9,12,14]};
const TRACKS=[
  {name:'Night Bus',bpm:92,root:45,scale:'minor',prog:[0,5,3,4],color:'#3557D6',seed:7},
  {name:'Rice Fields',bpm:104,root:50,scale:'pent',prog:[0,3,4,2],color:'#1F8A70',seed:21},
  {name:'Neon Rain',bpm:122,root:43,scale:'dorian',prog:[0,3,6,4],color:'#E0603A',seed:42}];
const BARS=24, STEPS=16;
const rng=s=>()=>((s=Math.imul(s^s>>>15,1|s)+0x6D2B79F5|0,((s^s>>>14)>>>0)/4294967296));
const hz=m=>440*Math.pow(2,(m-69)/12);
function patterns(tr){const r=rng(tr.seed),sc=SCALES[tr.scale];
  const kick=[...Array(STEPS)].map((_,i)=>i%8===0||(r()<.2&&i%2===0&&i!==4&&i!==12));
  const hat=[...Array(STEPS)].map((_,i)=>i%2===1||r()<.25);
  const lead=[...Array(STEPS*2)].map((_,i)=>r()<(i%4===0?.55:.22)?sc[Math.floor(r()*sc.length)]+12*(r()<.3?1:0):null);
  return{kick,hat,lead,sc}}
OS.register('pulse',{name:'Pulse',bg:'#8A4FB8',fg:'#fff',installable:true,category:'Music',size:'31 KB',
  desc:'Three original tracks, generated live on your phone. Keeps playing when you leave the app.',
  glyph:'<svg viewBox="0 0 24 24"><path d="M9 18V6.5l10-2.2v11.5"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="15.8" r="2.5"/></svg>',
  build(el){
    el.innerHTML=`<div class="hdr"><h1>Pulse</h1><p class="sub">Made live on this phone</p></div><div class="scroll pulse">
      <div class="art"><canvas></canvas></div>
      <div class="ptitle"><b class="pn"></b><span class="pm"></span></div>
      <div class="pbar" data-nogesture><i></i></div><div class="ptime"><span class="pe">0:00</span><span class="pl">0:00</span></div>
      <div class="pctl"><button data-a="prev" aria-label="Previous"><svg viewBox="0 0 24 24"><path d="M18 6v12l-9-6zM6 6v12"/></svg></button>
        <button data-a="play" class="pplay" aria-label="Play"><svg viewBox="0 0 24 24" class="ico"><path d="M8 5v14l11-7z"/></svg></button>
        <button data-a="next" aria-label="Next"><svg viewBox="0 0 24 24"><path d="M6 6v12l9-6zM18 6v12"/></svg></button></div>
      <div class="group plist">${TRACKS.map((t,i)=>`<button class="row" data-t="${i}"><span><i style="background:${t.color}"></i>${t.name}</span><span class="val">${t.bpm} BPM</span></button>`).join('')}</div></div>`;
    const cv=$('canvas',el), cx=cv.getContext('2d'), art=$('.art',el), bar=$('.pbar i',el);
    let ac=null, master=null, an=null, noise=null, timer=0, ti=0, step=0, next=0, playing=false, P=patterns(TRACKS[0]), vis=false, data=null;
    const total=()=>BARS*STEPS, spb=()=>60/TRACKS[ti].bpm/4;
    const fmt=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
    function ensure(){if(ac)return;const A=window.AudioContext||window.webkitAudioContext;if(!A)return;ac=new A();master=ac.createGain();an=ac.createAnalyser();an.fftSize=128;
      master.connect(an);an.connect(ac.destination);data=new Uint8Array(an.frequencyBinCount);
      noise=ac.createBuffer(1,ac.sampleRate*.5,ac.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;setVol()}
    function setVol(){if(master)master.gain.setTargetAtTime(prefs.vol*.7,ac.currentTime,.05)}
    function env(node,t,a,peak,dec){node.gain.setValueAtTime(0,t);node.gain.linearRampToValueAtTime(peak,t+a);node.gain.exponentialRampToValueAtTime(.0001,t+a+dec)}
    function tone(type,f,t,dur,peak,cut){const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f,t);let n=o;
      if(cut){const fl=ac.createBiquadFilter();fl.type='lowpass';fl.frequency.value=cut;o.connect(fl);n=fl}n.connect(g);g.connect(master);env(g,t,.005,peak,dur);o.start(t);o.stop(t+dur+.05)}
    function kick(t){const o=ac.createOscillator(),g=ac.createGain();o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(42,t+.12);o.connect(g);g.connect(master);env(g,t,.002,.9,.28);o.start(t);o.stop(t+.35)}
    function hiss(t,dur,peak,f,type){const s=ac.createBufferSource(),fl=ac.createBiquadFilter(),g=ac.createGain();s.buffer=noise;fl.type=type;fl.frequency.value=f;s.connect(fl);fl.connect(g);g.connect(master);env(g,t,.002,peak,dur);s.start(t);s.stop(t+dur+.05)}
    function play1(s,t){const tr=TRACKS[ti], i=s%STEPS, b=Math.floor(s/STEPS), chord=tr.prog[b%tr.prog.length], sc=P.sc, root=tr.root+sc[chord%sc.length];
      if(P.kick[i])kick(t); if(i===4||i===12)hiss(t,.16,.35,1800,'bandpass'); if(P.hat[i])hiss(t,.04,i%4===2?.16:.09,7000,'highpass');
      if(i%4===0||i===10)tone('sawtooth',hz(root-12),t,spb()*1.6,.22,520);
      if(i===0)[0,2,4].forEach(k=>tone('triangle',hz(tr.root+12+sc[(chord+k)%sc.length]+(chord+k>=sc.length?12:0)),t,spb()*14,.05));
      const ln=P.lead[(b%2)*STEPS+i]; if(ln!=null&&b>=4)tone('square',hz(tr.root+24+ln),t,spb()*.9,.045,2600);
    }
    function sched(){while(next<ac.currentTime+.12){play1(step,next);next+=spb();step++;if(step>=total()){load((ti+1)%TRACKS.length,true);return}}}
    function load(i,keep){ti=i;P=patterns(TRACKS[i]);step=0;if(ac)next=ac.currentTime+.06;ui();if(keep&&playing)sched()}
    function play(){ensure();if(!ac)return;ac.resume();if(!playing){playing=true;next=ac.currentTime+.06;timer=setInterval(sched,25);sched()}ui()}
    function pause(){playing=false;clearInterval(timer);ui()}
    function ui(){const t=TRACKS[ti];$('.pn',el).textContent=t.name;$('.pm',el).textContent=`${t.bpm} BPM · ${t.scale==='pent'?'pentatonic':t.scale}`;art.style.background=t.color;
      $('.pl',el).textContent=fmt(total()*spb());$('.pplay .ico',el).innerHTML=playing?'<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>':'<path d="M8 5v14l11-7z"/>';
      $('.pplay',el).setAttribute('aria-label',playing?'Pause':'Play');$$('.plist .row',el).forEach((r,k)=>r.classList.toggle('on',k===ti))}
    function fit(){const d=devicePixelRatio||1;cv.width=art.clientWidth*d;cv.height=art.clientHeight*d;cx.setTransform(d,0,0,d,0,0)}
    function frame(){const W=cv.width/(devicePixelRatio||1),H=cv.height/(devicePixelRatio||1);cx.clearRect(0,0,W,H);
      const pr=Math.min(1,step/total());bar.style.transform=`scaleX(${pr})`;$('.pe',el).textContent=fmt(step*spb());
      const n=24,bw=W/n;cx.fillStyle='rgba(255,255,255,.85)';if(playing&&an)an.getByteFrequencyData(data);
      for(let i=0;i<n;i++){const v=playing&&an?data[Math.floor(i*data.length/n/1.4)]/255:0;const bh=Math.max(4,v*H*.7);cx.fillRect(i*bw+bw*.2,H-bh-14,bw*.6,bh)}}
    el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;vib(5);
      if(b.dataset.a==='play')playing?pause():play();else if(b.dataset.a==='next')load((ti+1)%TRACKS.length,true);
      else if(b.dataset.a==='prev')load(step>STEPS*2?ti:(ti+TRACKS.length-1)%TRACKS.length,true);else if(b.dataset.t!=null){load(+b.dataset.t,true);play()}});
    OS.bus.add(setVol); ui();
    return{visible(on){vis=on;if(on){setTimeout(fit,30);loop.add(frame)}else loop.del(frame)},
      destroy(){pause();loop.del(frame);OS.bus.delete(setVol);if(ac)ac.close()}};
  }});
})();
