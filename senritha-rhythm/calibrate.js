/* Tap-to-sync calibration: plays 20 clicks at 100 BPM and measures how late you hear them.
   Each click is scheduled on the audio clock; getOutputTimestamp() maps it to the moment it leaves the
   speaker. The median gap between that moment and your taps is the extra delay (Bluetooth, touch lag). */
(()=>{
const R=Rhythm,$=s=>document.querySelector(s);
const COUNT=20,WARM=4,GAP=.6;
let clicks=[],diffs=[],running=false,result=null,endT=0;
$('#calOpen').onclick=()=>{reset();R.sheet('calSheet')};
function reset(){running=false;clicks=[];diffs=[];result=null;$('#calApply').hidden=true;$('#calStart').textContent='Start';$('#calCount').textContent='';
  $('#calText').textContent='Use the headphones or speaker you normally use. Press Start, then tap the pad each time you hear a click. Tap to the sound, not a light.'}
/* performance.now() time at which audio-clock time c is heard from the speaker */
function heardAt(ac,c){
  try{const ts=ac.getOutputTimestamp&&ac.getOutputTimestamp();if(ts&&ts.performanceTime>0)return ts.performanceTime+(c-ts.contextTime)*1000}catch(e){}
  return performance.now()+(c-ac.currentTime)*1000+R.outLat()*1000;
}
$('#calStart').onclick=()=>{
  R.ensureGraph();const ac=R.ac;if(!ac){R.toast('Calibration needs Web Audio, which this browser doesn\'t have.');return}
  ac.resume();R.audio.pause();reset();running=true;$('#calStart').textContent='Restart';
  const t0=ac.currentTime+1.2;
  for(let i=0;i<COUNT;i++){const c=t0+i*GAP,o=ac.createOscillator(),g=ac.createGain();o.frequency.value=i%4?1000:1500;o.connect(g);g.connect(ac.destination);
    g.gain.setValueAtTime(0,c);g.gain.linearRampToValueAtTime(.5,c+.002);g.gain.exponentialRampToValueAtTime(.0001,c+.06);o.start(c);o.stop(c+.08);clicks.push(c)}
  endT=t0+COUNT*GAP+.5;$('#calCount').textContent=`0 / ${COUNT-WARM}`;
  $('#calText').textContent='Listen, and tap the pad on every click. The first few are a warm-up.';
  const chk=()=>{if(!running)return;if(ac.currentTime>endT)finish();else setTimeout(chk,200)};chk();
};
$('#calPad').addEventListener('pointerdown',e=>{
  const pad=$('#calPad');pad.classList.remove('hit');void pad.offsetWidth;pad.classList.add('hit');R.vib(5);
  if(!running)return;const ac=R.ac,p=e.timeStamp;
  let best=null;for(let i=WARM;i<clicks.length;i++){const d=p-heardAt(ac,clicks[i]);if(Math.abs(d)<GAP*500&&(!best||Math.abs(d)<Math.abs(best)))best=d}
  if(best!=null){diffs.push(best);$('#calCount').textContent=`${diffs.length} / ${COUNT-WARM}`}
});
function finish(){
  running=false;$('#calStart').textContent='Try again';
  if(diffs.length<8){$('#calText').textContent='Not enough taps were caught. Try again and tap on every click.';return}
  const s=[...diffs].sort((a,b)=>a-b),med=s[s.length>>1],q1=s[Math.floor(s.length*.25)],q3=s[Math.floor(s.length*.75)];
  result=Math.round(Math.max(-150,Math.min(400,med))/5)*5;
  const steady=q3-q1<60;
  $('#calText').textContent=`Your extra delay is ${result>0?'+':''}${result} ms${steady?'.':', but your taps were uneven. Trying again may give a better result.'} Current setting: ${R.prefs.offset>0?'+':''}${R.prefs.offset} ms.`;
  $('#calApply').hidden=false;
}
$('#calApply').onclick=()=>{if(result==null)return;R.prefs.offset=result;R.savePrefs();R.syncSettings();R.toast(`Beat sync set to ${result>0?'+':''}${result} ms`);R.sheet('setSheet')};
})();
