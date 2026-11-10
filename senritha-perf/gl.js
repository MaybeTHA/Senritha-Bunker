/* WebGL2 renderer: instanced shapes (one draw call per batch), full-screen effect passes,
   an off-screen scene target (4x MSAA on Ultra), bloom, and GPU timer queries where the browser allows them. */
const Renderer=(()=>{
const FLOATS=12; // per instance: x,y,size,rot | r,g,b,a | shape,glow,layer,aspect
const SHAPE={circle:0,square:1,triangle:2,hexagon:3,ring:4,light:5,sprite:6};

const INST_VS=`#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aA; layout(location=2) in vec4 aC; layout(location=3) in vec4 aB;
uniform vec2 uRes; uniform float uGlowExt;
out vec2 vUV; out vec4 vC; flat out vec4 vB;
void main(){
  float ext=aB.y>0.0&&aB.x<5.5?1.0+uGlowExt*aB.y:1.0;
  vec2 c=aCorner*ext; vec2 sz=vec2(aA.z*aB.w,aA.z);
  float cs=cos(aA.w),sn=sin(aA.w);
  vec2 p=aA.xy+vec2(c.x*sz.x*cs-c.y*sz.y*sn,c.x*sz.x*sn+c.y*sz.y*cs);
  vUV=c; vC=aC; vB=aB;
  gl_Position=vec4(p.x/uRes.x*2.0-1.0,1.0-p.y/uRes.y*2.0,0.0,1.0);
}`;
const INST_FS=`#version 300 es
precision highp float; precision highp sampler2DArray;
in vec2 vUV; in vec4 vC; flat in vec4 vB;
uniform sampler2DArray uTex; uniform float uGlowK; uniform float uTexel;
out vec4 o;
float sdPoly(vec2 p,float n){float a=atan(p.x,p.y)+3.14159265;float r=6.2831853/n;return cos(floor(.5+a/r)*r-a)*length(p);}
void main(){
  int sh=int(vB.x+.5); vec2 p=vUV; float d;
  if(sh==5){float l2=dot(p,p);float a=exp(-l2*4.0)*vC.a;o=vec4(vC.rgb*a,0.0);return;}
  if(sh==6){
    if(abs(p.x)>1.0||abs(p.y)>1.0)discard;
    vec3 uv=vec3(p*.5+.5,vB.z); vec4 t=texture(uTex,uv);
    if(vB.y>0.0){float e=uTexel*2.0;t=(t*2.0+texture(uTex,uv+vec3(e,0,0))+texture(uTex,uv-vec3(e,0,0))+texture(uTex,uv+vec3(0,e,0))+texture(uTex,uv-vec3(0,e,0)))/6.0;
      float g=dot(t.rgb,vec3(.299,.587,.114));t.rgb=mix(vec3(g),t.rgb,1.0+vB.y);}
    t.rgb*=vC.rgb; float a=t.a*vC.a; o=vec4(t.rgb*a,a); return;}
  if(sh==0)d=length(p)-1.0;
  else if(sh==1){vec2 q=abs(p)-vec2(.92);d=length(max(q,0.0))+min(max(q.x,q.y),0.0)-.08;}
  else if(sh==2)d=sdPoly(p,3.0)-.5;
  else if(sh==3)d=sdPoly(p,6.0)-.9;
  else d=abs(length(p)-.74)-.24;
  float aa=fwidth(d);
  float fill=1.0-smoothstep(-aa,aa,d);
  float glow=vB.y>0.0?exp(-max(d,0.0)*uGlowK)*vB.y*.55:0.0;
  float a=fill*vC.a+glow*(1.0-fill);
  if(a<.004)discard;
  o=vec4(vC.rgb*a,fill*vC.a);
}`;
const FS_VS=`#version 300 es
out vec2 vUV; void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vUV=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`;
const BLIT_FS=`#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uA; uniform sampler2D uB; uniform float uBloom; out vec4 o;
void main(){vec3 c=texture(uA,vUV).rgb+texture(uB,vUV).rgb*uBloom; o=vec4(c,1.0);}`;
const BRIGHT_FS=`#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uA; uniform float uThr; out vec4 o;
void main(){vec3 c=texture(uA,vUV).rgb; float l=max(c.r,max(c.g,c.b)); o=vec4(c*smoothstep(uThr,uThr+.35,l),1.0);}`;
const BLUR_FS=`#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uA; uniform vec2 uDir; out vec4 o;
void main(){vec3 c=texture(uA,vUV).rgb*.227027;
  c+=(texture(uA,vUV+uDir*1.3846).rgb+texture(uA,vUV-uDir*1.3846).rgb)*.316216;
  c+=(texture(uA,vUV+uDir*3.2308).rgb+texture(uA,vUV-uDir*3.2308).rgb)*.070270; o=vec4(c,1.0);}`;
/* every light visits every pixel; each light tests every occluder for a soft shadow */
const LIGHT_FS=`#version 300 es
precision highp float; in vec2 vUV;
uniform vec2 uRes; uniform vec4 uL[64]; uniform vec3 uLC[64]; uniform int uN; uniform vec3 uO[32]; uniform int uNO; uniform float uShadow; uniform vec3 uAmb;
out vec4 o;
void main(){
  vec2 p=vec2(vUV.x,1.0-vUV.y)*uRes; vec3 acc=uAmb;
  for(int i=0;i<64;i++){ if(i>=uN)break;
    vec2 lp=uL[i].xy; vec2 d=p-lp; float dist=length(d); float r=uL[i].z; if(dist>r)continue;
    float att=1.0-dist/r; att*=att*uL[i].w; float vis=1.0;
    if(uShadow>.5){ for(int j=0;j<32;j++){ if(j>=uNO)break; vec3 c=uO[j];
        vec2 m=c.xy-lp; float t=clamp(dot(m,d)/max(dot(d,d),1e-3),0.0,1.0); float h=length(lp+d*t-c.xy)-c.z;
        float behind=step(c.z,length(p-c.xy))*step(.02,t)*step(t,.999);
        float pen=1.0+(1.0-t)*.02*dist+t*dist*.04;
        vis*=mix(1.0,mix(.06,1.0,smoothstep(-pen,pen,h)),behind); } }
    acc+=uLC[i]*att*vis; }
  o=vec4(acc,1.0);
}`;
/* layered sine waves with domain warping; cost = layers x (warp+1) per pixel */
const FLUID_FS=`#version 300 es
precision highp float; in vec2 vUV;
uniform vec2 uRes; uniform float uT; uniform int uLayers; uniform int uWarp; uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec4 uStir[4]; uniform float uDim;
out vec4 o;
float h(vec2 p){float s=0.0,a=1.0;for(int i=0;i<48;i++){if(i>=uLayers)break;float f=float(i);vec2 dir=vec2(cos(f*1.71+.3),sin(f*1.33+.7));
  s+=a*sin(dot(p,dir)*(1.0+f*.37)+uT*(.55+f*.09));a*=.86;}return s;}
void main(){
  vec2 px=vec2(vUV.x,1.0-vUV.y)*uRes; vec2 p=px/uRes.y*3.2;
  for(int k=0;k<4;k++){vec2 s=uStir[k].xy/uRes.y*3.2;vec2 q=p-s;float r=dot(q,q);p+=vec2(-q.y,q.x)*uStir[k].z*exp(-r*2.5);}
  float n=float(uLayers);
  for(int k=0;k<8;k++){if(k>=uWarp)break;p+=.42*vec2(h(p+vec2(1.7*float(k),.3)),h(p.yx-vec2(.9,1.3*float(k))))/sqrt(n);}
  float v=h(p)/sqrt(n)*.6+.5;
  vec3 c=mix(uC0,uC1,smoothstep(.15,.6,v)); c=mix(c,uC2,smoothstep(.62,.95,v));
  float foam=smoothstep(.015,.0,abs(fract(v*6.0)-.5)-.47); c+=foam*.18*uC2;
  o=vec4(c*uDim,1.0);
}`;

function compile(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const e=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error('Shader failed to compile: '+e)}return s}
function program(gl,vs,fs){const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('Shader failed to link: '+gl.getProgramInfoLog(p));
  const u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const info=gl.getActiveUniform(p,i),name=info.name.replace(/\[0\]$/,'');u[name]=gl.getUniformLocation(p,info.name)}
  return{p,u}}

class Batch{
  constructor(max){this.max=max;this.data=new Float32Array(max*FLOATS);this.n=0}
  ensure(max){if(max>this.max){this.max=max;this.data=new Float32Array(max*FLOATS)}}
  clear(){this.n=0}
  push(x,y,size,rot,r,g,b,a,shape,glow,layer,aspect){
    if(this.n>=this.max)return;const d=this.data,o=this.n++*FLOATS;
    d[o]=x;d[o+1]=y;d[o+2]=size;d[o+3]=rot;d[o+4]=r;d[o+5]=g;d[o+6]=b;d[o+7]=a;d[o+8]=shape;d[o+9]=glow;d[o+10]=layer;d[o+11]=aspect;
  }
}

class GLRenderer{
  constructor(canvas){
    this.canvas=canvas;
    const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'high-performance'});
    if(!gl)throw new Error('WebGL2 is not available in this browser, so the benchmark cannot run. Use a current version of Chrome, Edge, Firefox or Safari with hardware acceleration turned on.');
    this.gl=gl;this.lost=false;
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.onLost&&this.onLost()});
    canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.init();this.onRestored&&this.onRestored()});
    this.init();
  }
  init(){
    const gl=this.gl;
    this.inst=program(gl,INST_VS,INST_FS);this.blit=program(gl,FS_VS,BLIT_FS);this.bright=program(gl,FS_VS,BRIGHT_FS);this.blur=program(gl,FS_VS,BLUR_FS);
    this.light=program(gl,FS_VS,LIGHT_FS);this.fluid=program(gl,FS_VS,FLUID_FS);
    this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
    const corners=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,corners);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    this.ibuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.ibuf);
    for(let i=0;i<3;i++){gl.enableVertexAttribArray(1+i);gl.vertexAttribPointer(1+i,4,gl.FLOAT,false,FLOATS*4,i*16);gl.vertexAttribDivisor(1+i,1)}
    gl.bindVertexArray(null);
    this.emptyVao=gl.createVertexArray();
    this.blackTex=this.tex2D(1,1,new Uint8Array([0,0,0,255]));
    this.texArray=null;this.texLayers=0;this.texSize=0;
    this.targets=null;this.targetKey='';
    const dbg=gl.getExtension('WEBGL_debug_renderer_info');
    this.info={renderer:dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):null,vendor:dbg?gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL):null,
      basicRenderer:gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION),glsl:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      maxTexture:gl.getParameter(gl.MAX_TEXTURE_SIZE),maxSamples:gl.getParameter(gl.MAX_SAMPLES),maxViewport:Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS))};
    this.aniso=gl.getExtension('EXT_texture_filter_anisotropic');
    this.timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');this.queries=[];this.gpuMs=null;
    this.info.gpuTimer=!!this.timer;
    this.px=new Uint8Array(4);
  }
  tex2D(w,h,data){const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,data||null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t}
  fbo(tex){const gl=this.gl,f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);return f}
  /* (re)build render targets for a resolution and quality */
  setup(w,h,q){
    const gl=this.gl,key=`${w}x${h}:${q.msaa}:${q.bloomScale}`;
    this.canvas.width=w;this.canvas.height=h;this.w=w;this.h=h;this.q=q;
    if(key===this.targetKey&&this.targets)return;this.freeTargets();this.targetKey=key;
    const T={};T.sceneTex=this.tex2D(w,h);T.sceneFbo=this.fbo(T.sceneTex);
    if(q.msaa>1){T.msRb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,T.msRb);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,Math.min(q.msaa,this.info.maxSamples),gl.RGBA8,w,h);
      T.msFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,T.msFbo);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,T.msRb)}
    if(q.bloomScale){const bw=Math.max(1,Math.round(w*q.bloomScale)),bh=Math.max(1,Math.round(h*q.bloomScale));T.bw=bw;T.bh=bh;
      T.b1=this.tex2D(bw,bh);T.f1=this.fbo(T.b1);T.b2=this.tex2D(bw,bh);T.f2=this.fbo(T.b2)}
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('The graphics driver could not create the render target.');
    this.targets=T;
  }
  freeTargets(){const gl=this.gl,T=this.targets;if(!T)return;[T.sceneTex,T.b1,T.b2].forEach(t=>t&&gl.deleteTexture(t));[T.sceneFbo,T.msFbo,T.f1,T.f2].forEach(f=>f&&gl.deleteFramebuffer(f));T.msRb&&gl.deleteRenderbuffer(T.msRb);this.targets=null;this.targetKey=''}
  /* texture array of generated images (mipmapped on High/Ultra) */
  setTextures(canvases,q){
    const gl=this.gl;if(this.texArray){gl.deleteTexture(this.texArray);this.texArray=null}
    if(!canvases||!canvases.length)return;const s=canvases[0].width;
    const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D_ARRAY,t);
    const levels=q.mipmaps?Math.floor(Math.log2(s))+1:1;gl.texStorage3D(gl.TEXTURE_2D_ARRAY,levels,gl.RGBA8,s,s,canvases.length);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    canvases.forEach((c,i)=>gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,i,s,s,1,gl.RGBA,gl.UNSIGNED_BYTE,c));
    if(q.mipmaps)gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,q.mipmaps?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    if(this.aniso&&q.aniso)gl.texParameterf(gl.TEXTURE_2D_ARRAY,this.aniso.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(q.aniso,gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    this.texArray=t;this.texLayers=canvases.length;this.texSize=s;
  }
  /* ---- per frame ---- */
  begin(clear){
    const gl=this.gl,T=this.targets;
    if(this.timer)this.timerBegin();
    gl.bindFramebuffer(gl.FRAMEBUFFER,T.msFbo||T.sceneFbo);gl.viewport(0,0,this.w,this.h);
    gl.clearColor(clear[0],clear[1],clear[2],1);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    this.drawCalls=0;this.instances=0;
  }
  draw(batch,additive){
    if(!batch.n)return;const gl=this.gl,P=this.inst;
    gl.useProgram(P.p);gl.uniform2f(P.u.uRes,this.w,this.h);gl.uniform1f(P.u.uGlowK,this.q.glowK);gl.uniform1f(P.u.uGlowExt,this.q.glowExt);
    gl.uniform1f(P.u.uTexel,this.texSize?1/this.texSize:0);
    gl.activeTexture(gl.TEXTURE0);if(this.texArray)gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.texArray);gl.uniform1i(P.u.uTex,0);
    gl.blendFunc(gl.ONE,additive?gl.ONE:gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.ibuf);
    gl.bufferData(gl.ARRAY_BUFFER,batch.data.subarray(0,batch.n*FLOATS),gl.STREAM_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,batch.n);gl.bindVertexArray(null);
    gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);this.drawCalls++;this.instances+=batch.n;
  }
  fluidPass(t,layers,warp,colors,stirs,dim){
    const gl=this.gl,P=this.fluid;gl.disable(gl.BLEND);gl.useProgram(P.p);
    gl.uniform2f(P.u.uRes,this.w,this.h);gl.uniform1f(P.u.uT,t);gl.uniform1i(P.u.uLayers,layers);gl.uniform1i(P.u.uWarp,warp);
    gl.uniform3fv(P.u.uC0,colors[0]);gl.uniform3fv(P.u.uC1,colors[1]);gl.uniform3fv(P.u.uC2,colors[2]);gl.uniform4fv(P.u.uStir,stirs);gl.uniform1f(P.u.uDim,dim);
    gl.bindVertexArray(this.emptyVao);gl.drawArrays(gl.TRIANGLES,0,3);gl.enable(gl.BLEND);this.drawCalls++;
  }
  lightPass(lights,lightColors,n,occ,no,shadows,amb){
    const gl=this.gl,P=this.light;gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.useProgram(P.p);
    gl.uniform2f(P.u.uRes,this.w,this.h);gl.uniform4fv(P.u.uL,lights);gl.uniform3fv(P.u.uLC,lightColors);gl.uniform1i(P.u.uN,n);
    gl.uniform3fv(P.u.uO,occ);gl.uniform1i(P.u.uNO,no);gl.uniform1f(P.u.uShadow,shadows?1:0);gl.uniform3fv(P.u.uAmb,amb);
    gl.bindVertexArray(this.emptyVao);gl.drawArrays(gl.TRIANGLES,0,3);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);this.drawCalls++;
  }
  /* resolve MSAA, bloom, present. sync=true waits for the GPU (used when V-Sync is off so frame times include GPU work) */
  end(bloomAmount,sync){
    const gl=this.gl,T=this.targets;
    if(T.msFbo){gl.bindFramebuffer(gl.READ_FRAMEBUFFER,T.msFbo);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,T.sceneFbo);gl.blitFramebuffer(0,0,this.w,this.h,0,0,this.w,this.h,gl.COLOR_BUFFER_BIT,gl.NEAREST)}
    gl.disable(gl.BLEND);gl.bindVertexArray(this.emptyVao);
    let bloomTex=this.blackTex,amt=0;
    if(T.b1&&bloomAmount>0){
      gl.viewport(0,0,T.bw,T.bh);
      gl.bindFramebuffer(gl.FRAMEBUFFER,T.f1);gl.useProgram(this.bright.p);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,T.sceneTex);gl.uniform1i(this.bright.u.uA,0);gl.uniform1f(this.bright.u.uThr,.55);gl.drawArrays(gl.TRIANGLES,0,3);
      gl.useProgram(this.blur.p);gl.uniform1i(this.blur.u.uA,0);
      for(let i=0;i<this.q.bloomPasses;i++){const s=1+i;
        gl.bindFramebuffer(gl.FRAMEBUFFER,T.f2);gl.bindTexture(gl.TEXTURE_2D,T.b1);gl.uniform2f(this.blur.u.uDir,s/T.bw,0);gl.drawArrays(gl.TRIANGLES,0,3);
        gl.bindFramebuffer(gl.FRAMEBUFFER,T.f1);gl.bindTexture(gl.TEXTURE_2D,T.b2);gl.uniform2f(this.blur.u.uDir,0,s/T.bh);gl.drawArrays(gl.TRIANGLES,0,3);this.drawCalls+=2}
      bloomTex=T.b1;amt=bloomAmount;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.w,this.h);gl.useProgram(this.blit.p);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,T.sceneTex);gl.uniform1i(this.blit.u.uA,0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,bloomTex);gl.uniform1i(this.blit.u.uB,1);gl.uniform1f(this.blit.u.uBloom,amt);
    gl.drawArrays(gl.TRIANGLES,0,3);gl.activeTexture(gl.TEXTURE0);gl.enable(gl.BLEND);
    if(this.timer)this.timerEnd();
    if(sync)gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,this.px);
  }
  /* GPU time per frame via EXT_disjoint_timer_query_webgl2 (results arrive a few frames later) */
  timerBegin(){const gl=this.gl,q=gl.createQuery();gl.beginQuery(this.timer.TIME_ELAPSED_EXT,q);this.queries.push(q);this.collect()}
  timerEnd(){this.gl.endQuery(this.timer.TIME_ELAPSED_EXT)}
  collect(){const gl=this.gl;
    while(this.queries.length>1){const q=this.queries[0];if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))break;
      const disjoint=gl.getParameter(this.timer.GPU_DISJOINT_EXT),ns=gl.getQueryParameter(q,gl.QUERY_RESULT);gl.deleteQuery(q);this.queries.shift();
      if(!disjoint)this.gpuMs=ns/1e6}
    while(this.queries.length>8){gl.deleteQuery(this.queries.shift())}}
  dispose(){this.freeTargets();if(this.texArray)this.gl.deleteTexture(this.texArray);this.texArray=null}
}
return{GLRenderer,Batch,SHAPE,FLOATS};
})();
