/* Share a clip: records 15 seconds of the screen (visuals or game) with the song, then shares or saves it as a video. */
(()=>{
const R=Rhythm, $=s=>document.querySelector(s);
const LEN=15000;
let rec=null, chunks=[], t0=0, file=null, raf=0;
const pickType=()=>{if(!window.MediaRecorder)return null;
  for(const t of['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'])
    if(MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t))return t;return ''};
const btn=$('#recBtn');
btn.onclick=()=>rec?stop():start();
/* watermark drawn into the canvas while recording */
R.frameHooks.add((c,W,H)=>{if(!rec)return;const s=R.cur;
  c.font='700 13px Unbounded, system-ui, sans-serif';c.textAlign='left';c.textBaseline='alphabetic';c.fillStyle='rgba(255,255,255,.8)';
  c.fillText('Senritha\'s Rhythm',18,H-26);if(s){c.font='600 13px Figtree, system-ui, sans-serif';c.fillStyle='rgba(255,255,255,.6)';c.fillText(R.title(s),18,H-44)}});
function start(){
  const type=pickType();
  if(type===null||!R.canvas.captureStream){R.toast('This browser can\'t record clips. Try Chrome or Safari on your phone.');return}
  if(!R.cur){R.toast('Pick a song first');return}
  R.ensureGraph(); R.ac&&R.ac.resume(); if(R.audio.paused)R.audio.play().catch(()=>{});
  const tracks=[...R.canvas.captureStream(30).getVideoTracks()];
  if(R.recDest)tracks.push(...R.recDest.stream.getAudioTracks());
  try{rec=type?new MediaRecorder(new MediaStream(tracks),{mimeType:type,videoBitsPerSecond:5e6}):new MediaRecorder(new MediaStream(tracks))}catch(e){rec=null;R.toast('Recording isn\'t available here.');return}
  chunks=[]; rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  rec.onstop=done; rec.start(500); t0=performance.now();
  btn.classList.add('on'); btn.setAttribute('aria-label','Stop recording'); R.toast('Recording 15 seconds'); tick();
}
function tick(){const p=Math.min(1,(performance.now()-t0)/LEN);btn.style.setProperty('--p',p);if(p>=1){stop();return}raf=requestAnimationFrame(tick)}
function stop(){if(!rec)return;cancelAnimationFrame(raf);const r=rec;rec=null;try{r.stop()}catch(e){}r.stream.getVideoTracks().forEach(t=>t.stop());btn.classList.remove('on');btn.style.setProperty('--p',0);btn.setAttribute('aria-label','Record a 15 second clip')}
function done(){
  const type=(chunks[0]&&chunks[0].type)||'video/webm', ext=type.includes('mp4')?'mp4':'webm';
  const name=`rhythm-${(R.title(R.cur)||'clip').replace(/[^\w฀-๿-]+/g,'-').slice(0,40)}.${ext}`;
  file=new File(chunks,name,{type:type.split(';')[0]}); chunks=[];
  const v=$('#clipVideo'); if(v.src)URL.revokeObjectURL(v.src); v.src=URL.createObjectURL(file);
  $('#clipInfo').textContent=`${(file.size/1048576).toFixed(1)} MB · ${ext.toUpperCase()}`;
  $('#clipShare').hidden=!(navigator.canShare&&navigator.canShare({files:[file]}));
  R.sheet('clipSheet');
}
$('#clipShare').onclick=async()=>{try{await navigator.share({files:[file],title:'Senritha\'s Rhythm'})}catch(e){if(e&&e.name!=='AbortError')R.toast('Sharing didn\'t work. Use Save video instead.')}};
$('#clipSave').onclick=async()=>{
  try{const dl=window.claude&&window.claude.use?await window.claude.use('downloads'):null;
    if(dl){await dl.save({filename:file.name,data:file});R.toast('Video saved');return}}catch(e){if(e&&e.code==='declined')return}
  const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
};
})();
