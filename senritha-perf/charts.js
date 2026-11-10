/* Small canvas charts: thin lines, recessive grid, mono labels, one highlight. */
const Charts=(()=>{
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function setup(cv){const d=Math.min(2,devicePixelRatio||1),w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return null;
  if(cv.width!==Math.round(w*d)||cv.height!==Math.round(h*d)){cv.width=Math.round(w*d);cv.height=Math.round(h*d)}const x=cv.getContext('2d');x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,w,h);return{x,w,h}}
function nice(max){if(max<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(max))),n=max/p;return(n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p}
function frame(c,yMax,unit,pad){const {x,w,h}=c,grid=css('--grid'),muted=css('--muted');x.font='11px "IBM Plex Mono",ui-monospace,monospace';x.textBaseline='middle';
  const ticks=4;for(let i=0;i<=ticks;i++){const v=yMax*i/ticks,y=pad.t+(h-pad.t-pad.b)*(1-i/ticks);x.strokeStyle=grid;x.lineWidth=1;x.beginPath();x.moveTo(pad.l,Math.round(y)+.5);x.lineTo(w-pad.r,Math.round(y)+.5);x.stroke();
    x.fillStyle=muted;x.textAlign='right';x.fillText((v>=100?Math.round(v):+v.toFixed(1))+(i===ticks?unit:''),pad.l-6,y)}}
/* series: [{data:Float32Array|number[], color, width, fill}] ; refs: [{value,label,color}] */
function line(cv,{series,yMax,unit='',refs=[],xLabels=null,minY=0}){
  const c=setup(cv);if(!c)return;const {x,w,h}=c,pad={l:44,r:10,t:10,b:xLabels?22:10};
  let mx=yMax||0;if(!yMax){for(const s of series)for(const v of s.data)if(v>mx&&isFinite(v))mx=v;for(const r of refs)if(r.value>mx)mx=r.value;mx=nice(mx*1.1||1)}
  frame(c,mx,unit,pad);const pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;
  for(const s of series){const d=s.data,n=d.length;if(n<2)continue;const X=i=>pad.l+pw*i/(n-1),Y=v=>pad.t+ph*(1-Math.min(1,Math.max(0,(v-minY)/(mx-minY))));
    x.beginPath();for(let i=0;i<n;i++){const px=X(i),py=Y(d[i]);i?x.lineTo(px,py):x.moveTo(px,py)}
    if(s.fill){x.save();x.lineTo(X(n-1),pad.t+ph);x.lineTo(X(0),pad.t+ph);x.closePath();x.fillStyle=s.fill;x.fill();x.restore();x.beginPath();for(let i=0;i<n;i++){const px=X(i),py=Y(d[i]);i?x.lineTo(px,py):x.moveTo(px,py)}}
    x.strokeStyle=s.color;x.lineWidth=s.width||2;x.lineJoin='round';x.stroke();
    if(s.end){const px=X(n-1),py=Y(d[n-1]);x.fillStyle=s.color;x.beginPath();x.arc(px,py,3.5,0,7);x.fill()}}
  for(const r of refs){const y=pad.t+ph*(1-Math.min(1,r.value/mx));x.setLineDash([4,4]);x.strokeStyle=r.color;x.lineWidth=1;x.beginPath();x.moveTo(pad.l,y);x.lineTo(w-pad.r,y);x.stroke();x.setLineDash([]);
    if(r.label){x.font='11px "IBM Plex Mono",ui-monospace,monospace';x.textAlign='right';x.textBaseline='bottom';x.fillStyle=css('--fg-2');x.fillText(r.label,w-pad.r-2,y-3)}}
  if(xLabels){x.font='11px "IBM Plex Mono",ui-monospace,monospace';x.fillStyle=css('--muted');x.textBaseline='alphabetic';x.textAlign='left';x.fillText(xLabels[0],pad.l,h-6);x.textAlign='right';x.fillText(xLabels[1],w-pad.r,h-6)}
  return{yMax:mx,pad,pw,ph};
}
function bars(cv,{counts,binMs,color,highlightFrom}){
  const c=setup(cv);if(!c)return;const {x,w,h}=c,pad={l:44,r:10,t:10,b:22};let mx=0;for(const v of counts)if(v>mx)mx=v;mx=nice(mx*1.1||1);
  const pw=w-pad.l-pad.r,ph=h-pad.t-pad.b,n=counts.length,bw=pw/n;frame(c,mx,'',pad);
  for(let i=0;i<n;i++){const v=counts[i];if(!v)continue;const bh=Math.max(1,ph*v/mx),bx=pad.l+i*bw+1,by=pad.t+ph-bh;
    x.fillStyle=highlightFrom!=null&&i*binMs>=highlightFrom?css('--warn'):color;const r=Math.min(3,(bw-2)/2);x.beginPath();x.roundRect?x.roundRect(bx,by,Math.max(1,bw-2),bh,[r,r,0,0]):x.rect(bx,by,Math.max(1,bw-2),bh);x.fill()}
  x.font='11px "IBM Plex Mono",ui-monospace,monospace';x.fillStyle=css('--muted');x.textBaseline='alphabetic';x.textAlign='left';x.fillText('0 ms',pad.l,h-6);x.textAlign='right';x.fillText((binMs*n).toFixed(1)+' ms',w-pad.r,h-6);
}
return{line,bars};
})();
