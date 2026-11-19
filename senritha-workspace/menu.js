/* Work Space menu: one list of every Senritha project. Links open each app as its own page. */
const APPS=[
  {href:'channels/',path:'work-space / channels',name:'Channels',desc:'Channels, sub-channels, messages and images. Saved on this device.',
   icon:'<path d="M4 6.5A1.5 1.5 0 0 1 5.5 5H10l2 2h6.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><path d="M8 12h8M8 15h5"/>'},
  {href:'../senritha-os/',path:'senritha-os',name:'Senritha OS',desc:'Phone OS-style web app: lock screen, home screen, app switcher and an App Store.',
   icon:'<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>'},
  {href:'../senritha-rhythm/',path:'senritha-rhythm',name:"Senritha's Rhythm",desc:'Beat visualizer and 4-lane rhythm game for the songs on your phone.',
   icon:'<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'},
  {href:'../senritha-solaris/',path:'senritha-solaris',name:"Senritha's Solaris X3D",desc:'Real-time interactive 3D explorer of the Solar System.',
   icon:'<circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-20 12 12)"/>'},
  {href:'../senritha-motorhome/',path:'senritha-motorhome',name:"Senritha's Motorhome 3D",desc:'Walk through a luxury motorhome parked in a snowy forest at blue hour.',
   icon:'<path d="M3 16V8a2 2 0 0 1 2-2h10l4 4h1a1 1 0 0 1 1 1v5h-2"/><path d="M9 16h6"/><circle cx="7" cy="16.5" r="1.8"/><circle cx="17" cy="16.5" r="1.8"/><path d="M6 10h4"/>'},
  {href:'../senritha-perf/',path:'senritha-perf',name:"Senritha's Test performance",desc:'WebGL2 2D graphics benchmark: GPU, CPU and frame pacing, measured.',
   icon:'<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 18 4-6"/>'},
];

const list=document.getElementById('list');
list.innerHTML=APPS.map(a=>`<a class="app" href="${a.href}">
  <span class="mark" aria-hidden="true"><svg viewBox="0 0 24 24">${a.icon}</svg></span>
  <span class="txt"><b>${a.name}</b><span class="desc">${a.desc}</span><span class="path">${a.path} /</span></span>
  <svg class="go" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
</a>`).join('');

/* Fetch an app's page as soon as a finger or pointer lands on it, so the tap opens faster. Costs nothing until then. */
const warmed=new Set();
list.addEventListener('pointerdown',warm,{passive:true});
list.addEventListener('pointerover',warm,{passive:true});
function warm(e){const a=e.target.closest('a.app');if(!a||warmed.has(a.href))return;warmed.add(a.href);
  const l=document.createElement('link');l.rel='prefetch';l.href=a.href;document.head.appendChild(l)}

/* Theme: shared with Channels (same saved setting). */
const KEY='ws.prefs';
function read(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return{}}}
function apply(){const t=read().theme;if(!t||t==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=t}
apply();
document.getElementById('theme').addEventListener('click',()=>{
  const dark=document.documentElement.dataset.theme?document.documentElement.dataset.theme==='dark':matchMedia('(prefers-color-scheme: dark)').matches;
  const p=read();p.theme=dark?'light':'dark';try{localStorage.setItem(KEY,JSON.stringify(p))}catch(e){}apply();
});
window.addEventListener('pageshow',apply);

try{if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{})}catch(e){}
