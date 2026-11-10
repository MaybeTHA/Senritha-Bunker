/* What the browser will tell us about the machine. Nothing here is estimated unless labelled so. */
const HW=(()=>{
function browserName(){
  const b=navigator.userAgentData&&navigator.userAgentData.brands;
  if(b){const m=b.find(x=>!/Not.?A.?Brand|Chromium/i.test(x.brand))||b[0];if(m)return`${m.brand} ${m.version}`}
  const u=navigator.userAgent;let m;
  if((m=u.match(/Edg\/([\d.]+)/)))return'Edge '+m[1].split('.')[0];if((m=u.match(/Firefox\/([\d.]+)/)))return'Firefox '+m[1].split('.')[0];
  if((m=u.match(/Chrome\/([\d.]+)/)))return'Chrome '+m[1].split('.')[0];if((m=u.match(/Version\/([\d.]+).*Safari/)))return'Safari '+m[1];return'Unknown browser'}
function platform(){const d=navigator.userAgentData;if(d&&d.platform)return d.platform+(d.mobile?' (mobile)':'');const u=navigator.userAgent;
  return/Windows/.test(u)?'Windows':/Mac OS X/.test(u)&&!/Mobile/.test(u)?'macOS':/Android/.test(u)?'Android':/iPhone|iPad/.test(u)?'iOS':/Linux/.test(u)?'Linux':'Unknown'}
/* measured, not reported: median interval of 90 animation frames */
function measureRefresh(){return new Promise(res=>{const ts=[];const f=t=>{ts.push(t);if(ts.length<91)requestAnimationFrame(f);else{const d=ts.slice(1).map((v,i)=>v-ts[i]).sort((a,b)=>a-b),m=d[d.length>>1];res(Math.round(1000/m))}};requestAnimationFrame(f)})}
function memory(){const m=performance.memory;return m&&m.usedJSHeapSize?{used:m.usedJSHeapSize,limit:m.jsHeapSizeLimit}:null}
function collect(gl,refresh){
  return{browser:browserName(),platform:platform(),cores:navigator.hardwareConcurrency||null,deviceMemoryGB:navigator.deviceMemory||null,
    gpu:gl.renderer||null,gpuVendor:gl.vendor||null,gpuBasic:gl.basicRenderer,webgl:gl.version,maxTexture:gl.maxTexture,maxSamples:gl.maxSamples,gpuTimer:gl.gpuTimer,
    screen:`${screen.width} × ${screen.height}`,dpr:+(devicePixelRatio||1).toFixed(2),refreshHz:refresh,jsHeap:!!memory()}}
return{collect,measureRefresh,memory};
})();
