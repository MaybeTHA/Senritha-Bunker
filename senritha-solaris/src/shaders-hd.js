// High-detail shaders for Senritha's Solaris X3D: real terrain, flowing atmospheres,
// multi-layer clouds, physically based scattering and particle ring systems.
import { NOISE, SHADOW } from './shaders.js';

// Equirectangular sampling from a direction, seam-safe (no line at the date line) and
// pole-correct, matching three.js SphereGeometry UVs.
export const EQ_BASE = /* glsl */`
const float PI = 3.14159265, TAU = 6.2831853;
vec2 dirToUV(vec3 n){ return vec2(atan(n.z, -n.x) / TAU, 1.0 - acos(clamp(n.y, -1.0, 1.0)) / PI); }
vec3 rotY(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(c*v.x - s*v.z, v.y, s*v.x + c*v.z); }
`;
export const EQ = EQ_BASE + /* glsl */`
struct EqS { vec2 uv; vec2 dx; vec2 dy; };
EqS eqs(vec3 n){
  vec2 uv = dirToUV(n);
  vec2 a = vec2(fract(uv.x), uv.y), b = vec2(fract(uv.x + 0.5) - 0.5, uv.y);
  vec2 dax = dFdx(a), day = dFdy(a), dbx = dFdx(b), dby = dFdy(b);
  bool useB = abs(dbx.x) + abs(dby.x) < abs(dax.x) + abs(day.x);
  if (useB) return EqS(b, dbx, dby);
  return EqS(a, dax, day);
}
vec4 samp(sampler2D t, EqS s){ return textureGrad(t, s.uv, s.dx, s.dy); }
vec4 texEq(sampler2D t, vec3 n){ return samp(t, eqs(n)); }
`;

const LIGHT = /* glsl */`
uniform mat4 modelMatrix;
uniform vec3 uSunColor;
uniform float uSunI;
uniform float uAmbient;
uniform vec3 uInvScale2;
`;

// ------------------------------------------------------------------ rocky worlds with real elevation
export const TERRAIN_VERT = /* glsl */`
uniform sampler2D uTerrain;
uniform float uDisp, uH0;
varying vec3 vObj; varying vec3 vWorld;
${EQ_BASE}
void main(){
  vec3 n = normalize(position);
  vec2 uv = dirToUV(n); uv.x = fract(uv.x);
  float h = textureLod(uTerrain, uv, 1.5).b;
  vec3 p = n * (1.0 + (h - uH0) * uDisp);
  vObj = n;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const TERRAIN_FRAG = /* glsl */`
precision highp float;
varying vec3 vObj; varying vec3 vWorld;
uniform sampler2D uColor, uTerrain;
uniform float uNormalScale, uLunar, uHRange, uShadowLen, uAO, uDetail, uTime, uDust, uDustGlobal, uTint, uMode, uFalse, uHaze, uGray, uSteps;
uniform vec3 uHazeColor;
${LIGHT}
${NOISE}
${SHADOW}
${EQ}
float terrainShadow(EqS s, vec3 n, vec3 T, vec3 B, vec3 Lo, float h0n){
  float lz = dot(Lo, n);
  if (lz < -0.04) return 0.0;
  vec2 lt = vec2(dot(Lo, T), dot(Lo, B));
  float lh = length(lt);
  if (lh < 1e-4) return 1.0;
  vec2 dir = lt / lh;
  float cl = max(sqrt(1.0 - n.y*n.y), 0.03);
  vec2 duv = vec2(dir.x / (TAU*cl), dir.y / PI);
  float slope = lz / lh;
  float h0 = textureGrad(uTerrain, s.uv, s.dx*2.0, s.dy*2.0).b * uHRange + 0.0004;
  float sh = 1.0;
  for (int i = 1; i <= 10; i++){
    if (float(i) > uSteps) break;
    float fi = float(i) / uSteps;
    float d = uShadowLen * fi * fi;
    float h = textureGrad(uTerrain, s.uv + duv*d, s.dx*2.0, s.dy*2.0).b * uHRange;
    float ray = h0 + slope*d + d*d*0.5;
    sh = min(sh, clamp((ray - h) / (d*0.035 + 1e-4) + 0.5, 0.0, 1.0));
  }
  return sh;
}
vec3 elevRamp(float h){
  vec3 c = mix(vec3(0.10, 0.22, 0.55), vec3(0.10, 0.55, 0.62), smoothstep(0.0, 0.25, h));
  c = mix(c, vec3(0.35, 0.65, 0.30), smoothstep(0.22, 0.4, h));
  c = mix(c, vec3(0.85, 0.78, 0.35), smoothstep(0.38, 0.55, h));
  c = mix(c, vec3(0.70, 0.38, 0.20), smoothstep(0.55, 0.75, h));
  c = mix(c, vec3(0.96, 0.95, 0.94), smoothstep(0.78, 0.98, h));
  return c;
}
void main(){
  vec3 n = normalize(vObj);
  EqS s = eqs(n);
  vec4 tr = samp(uTerrain, s);
  vec4 c0 = samp(uColor, s);
  vec3 alb = pow(uGray > 0.5 ? c0.rrr : c0.rgb, vec3(2.2));
  vec3 T = eastOf(n), B = cross(n, T);
  vec2 g = tr.rg*2.0 - 1.0;
  float nz = sqrt(max(1.0 - dot(g, g), 0.0));
  vec3 nb = normalize(T*g.x*uNormalScale + B*g.y*uNormalScale + n*nz);
  float hb = textureGrad(uTerrain, s.uv, s.dx*24.0 + vec2(0.003, 0.0), s.dy*24.0 + vec2(0.0, 0.003)).b;
  float ao = clamp(1.0 - (hb - tr.b)*uAO, 0.42, 1.0);
  if (uDetail > 0.01){
    vec3 p = n * 260.0;
    float d0 = snoise(p), dx = snoise(p + T*0.6), dy = snoise(p + B*0.6);
    float d1 = snoise(p*3.3), dx1 = snoise(p*3.3 + T*0.6), dy1 = snoise(p*3.3 + B*0.6);
    vec3 gd = ((dx - d0) + 0.5*(dx1 - d1))*T + ((dy - d0) + 0.5*(dy1 - d1))*B;
    nb = normalize(nb - uDetail * 0.11 * gd);
    alb *= 1.0 + uDetail*0.08*(d0 + 0.5*d1);
  }
  if (uTint > 0.0){
    // MESSENGER-style accents: freshly exposed material (hollows, young rays) reads blue-white
    vec4 bl = textureGrad(uColor, s.uv, s.dx*14.0 + vec2(0.0025, 0.0), s.dy*14.0 + vec2(0.0, 0.0025));
    vec3 blur = pow(uGray > 0.5 ? bl.rrr : bl.rgb, vec3(2.2));
    float hp = dot(alb - blur, vec3(0.333));
    alb = mix(alb, alb*vec3(0.84, 0.97, 1.22) + vec3(0.0, 0.004, 0.014), smoothstep(0.012, 0.08, hp)*uTint);
    float t = fbm(n*2.5 + 2.0, 3, 2.0, 0.5);
    alb *= mix(vec3(1.0, 0.93, 0.84), vec3(0.95, 0.95, 0.95), smoothstep(-0.35, 0.35, t));
  }
  float dust = 0.0;
  if (uDust > 0.0){
    float dn = fbm(n*2.2 + vec3(uTime*0.012, 0.0, -uTime*0.008), 4, 2.0, 0.5);
    float dn2 = fbm(n*6.0 + vec3(dn*1.5) + uTime*0.02, 3, 2.0, 0.5);
    dust = clamp(smoothstep(0.2, 0.62, dn + 0.25*dn2) * uDust + uDustGlobal*(0.55 + 0.25*dn2), 0.0, 1.0);
    if (uDetail > 0.01){
      // dust devils: small bright whirls drifting across the plains
      vec2 vo = voronoi(n*900.0 + vec3(uTime*0.6, 0.0, uTime*0.4));
      dust = max(dust, smoothstep(0.08, 0.0, vo.x) * 0.55 * uDetail * step(0.5, fract(sin(dot(floor(n*900.0), vec3(12.9, 78.2, 37.7)))*43758.5)));
    }
    alb = mix(alb, pow(vec3(0.80, 0.57, 0.39), vec3(2.2)), dust*0.62);
    nb = normalize(mix(nb, n, dust*0.75));
  }
  vec3 Ng = normalize(mat3(modelMatrix) * n);
  vec3 Nb = normalize(mat3(modelMatrix) * nb);
  vec3 L = normalize(-vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 col;
  if (uMode > 1.5){
    // Magellan radar view: evenly revealed relief, optional false-colour elevation
    vec3 rad = alb;
    if (uFalse > 0.5) rad = elevRamp(tr.b) * (0.45 + 0.85*dot(alb, vec3(0.333)));
    float shade = 0.30 + 0.70*max(dot(Nb, normalize(V*0.55 + L*0.25 + Ng*0.2)), 0.0);
    col = rad * shade * ao * 0.95;
  } else {
    vec3 Lo = normalize(transpose(mat3(modelMatrix)) * L);
    float mu0 = max(dot(Nb, L), 0.0);
    float mu = max(dot(Ng, V), 0.0);
    float ls = 2.0*mu0/(mu0 + mu + 1e-4);
    float diff = mix(mu0, min(ls*0.62, 1.3), uLunar);
    diff *= smoothstep(-0.10, 0.03, dot(Ng, L));
    float sh = diff > 0.0 ? terrainShadow(s, n, T, B, Lo, tr.b) : 1.0;
    float shadow = sphereShadow(vWorld) * mix(1.0, sh, 1.0 - dust*0.6);
    col = alb * (uSunColor * uSunI * diff * shadow + uAmbient * ao) * mix(1.0, ao, 0.65);
    if (uHaze > 0.0){
      float fres = pow(1.0 - mu, 2.5);
      col += uHazeColor * fres * (uHaze + uDustGlobal*0.4) * smoothstep(-0.25, 0.45, dot(Ng, L)) * uSunI;
    }
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

// ------------------------------------------------------------------ gas giants from real maps, set in motion
export const GASEQ_FRAG = /* glsl */`
precision highp float;
varying vec3 vObj; varying vec3 vWorld; varying vec2 vUv;
uniform sampler2D uMap;
uniform float uTime, uFlowAmp, uJets, uPeriod, uTurb, uRefLat, uHasStorm, uStormSpin, uLimb, uHaze, uBump, uWrap, uDetail, uHex, uSuper;
uniform vec3 uStormC, uStormE, uStormN, uHazeColor;
uniform vec2 uStormAB;
uniform float uHasRing, uRadiusW;
uniform sampler2D uRingTex;
uniform vec2 uRingRange;
uniform vec3 uRingN, uCenter;
${LIGHT}
${NOISE}
${SHADOW}
${EQ}
float zonal(float lat){ return uFlowAmp * sin(lat * uJets) * cos(lat); }
vec3 swirl(vec3 d, float tau){
  if (uHasStorm < 0.5) return d;
  float z = dot(d, uStormC);
  if (z < 0.8) return d;
  vec2 q = vec2(dot(d, uStormE)/uStormAB.x, dot(d, uStormN)/uStormAB.y);
  float r = length(q);
  if (r > 1.7) return d;
  float w = uStormSpin * smoothstep(1.7, 0.15, r) * (0.5 + 0.5*smoothstep(0.0, 0.85, r));
  float ang = -w * tau;
  float c = cos(ang), s = sin(ang);
  q = vec2(c*q.x - s*q.y, s*q.x + c*q.y) * uStormAB;
  return normalize(uStormC*z + uStormE*q.x + uStormN*q.y);
}
vec3 perturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy){
  vec3 sx = dFdx(surf_pos), sy = dFdy(surf_pos);
  vec3 R1 = cross(sy, surf_norm), R2 = cross(surf_norm, sx);
  float det = dot(sx, R1);
  vec3 grad = sign(det) * (dHdxy.x*R1 + dHdxy.y*R2);
  return normalize(abs(det)*surf_norm - grad);
}
void main(){
  vec3 n = normalize(vObj);
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float sp = zonal(lat) - zonal(radians(uRefLat));
  float ph0 = fract(uTime/uPeriod + 0.35*sin(lat*5.0));
  float ph1 = fract(ph0 + 0.5);
  float w0 = 1.0 - abs(2.0*ph0 - 1.0);
  float tau0 = (ph0 - 0.5)*uPeriod, tau1 = (ph1 - 0.5)*uPeriod;
  vec3 tp = n * vec3(3.5, 13.0, 3.5);
  float tA = snoise(tp + vec3(0.0, 0.0, uTime*0.035));
  float tB = snoise(tp*1.9 + vec3(5.2, 1.3, -uTime*0.05));
  float tC = snoise(tp*4.3 + vec3(-uTime*0.06, 2.0, 0.0));
  vec3 turb = vec3(tA + 0.35*tC, (tA + tB)*0.18, tB - 0.35*tC) * uTurb;
  vec3 base = rotY(n, uSuper * uTime);
  vec3 d0 = normalize(swirl(rotY(base, sp*tau0), tau0) + turb);
  vec3 d1 = normalize(swirl(rotY(base, sp*tau1), tau1) + turb);
  vec4 c = texEq(uMap, d0)*w0 + texEq(uMap, d1)*(1.0 - w0);
  vec3 alb = pow(c.rgb, vec3(2.2));
  // drifting high-altitude haze and fine turbulent streaks that sharpen up close
  float hz = snoise(vec3(n.x*2.5, n.y*22.0, n.z*2.5) + vec3(uTime*0.02, 0.0, -uTime*0.015));
  float det = fbm(vec3(d0.x*40.0, d0.y*260.0, d0.z*40.0), 4, 2.1, 0.5);
  alb *= 1.0 + 0.04*hz + uDetail*0.09*det;
  if (uHex > 0.0 && n.y > 0.88){
    // Saturn's north polar hexagon and its central vortex
    float colat = degrees(acos(clamp(n.y, -1.0, 1.0)));
    float phi = atan(n.z, n.x);
    float seg = mod(phi + uTime*0.002, 1.0471976) - 0.5235988;
    float hexR = 13.5*0.8660254 / cos(seg);
    float inside = smoothstep(hexR + 0.8, hexR - 0.8, colat);
    float swirlS = sin(colat*2.6 - uTime*0.6/(colat + 1.5) + fbm(n*30.0 + vec3(0.0, uTime*0.01, 0.0), 3, 2.0, 0.5)*2.0);
    vec3 hexCol = pow(vec3(0.50, 0.56, 0.60), vec3(2.2)) * (0.9 + 0.12*swirlS);
    alb = mix(alb, hexCol, inside*0.85);
    alb = mix(alb, pow(vec3(0.86, 0.84, 0.76), vec3(2.2)), gauss(colat - hexR, 0.55)*0.55);
    float eye = smoothstep(3.0, 0.6, colat);
    alb = mix(alb, pow(vec3(0.24, 0.27, 0.32), vec3(2.2)), eye*0.9);
    alb += pow(vec3(0.7, 0.72, 0.7), vec3(2.2)) * gauss(colat - 1.6, 0.25) * 0.4;
  }
  vec3 Ng = normalize(mat3(modelMatrix) * (n * uInvScale2));
  float hgt = dot(c.rgb, vec3(0.3, 0.59, 0.11)) + 0.06*hz + uDetail*0.05*det;
  vec3 Nb = perturb(vWorld, Ng, vec2(dFdx(hgt), dFdy(hgt)) * uBump * uRadiusW);
  vec3 L = normalize(-vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  float NdV = max(dot(Ng, V), 0.0);
  float diff = clamp((dot(Nb, L) + uWrap)/(1.0 + uWrap), 0.0, 1.0);
  diff *= smoothstep(-0.18, 0.08, dot(Ng, L));
  float limb = pow(max(NdV, 0.02), uLimb);
  float shadow = sphereShadow(vWorld);
  if (uHasRing > 0.5){
    float den = dot(L, uRingN);
    if (abs(den) > 1e-4){
      float t = dot(uCenter - vWorld, uRingN) / den;
      if (t > 0.0){
        float r = length(vWorld + L*t - uCenter) / uRadiusW;
        float u = (r - uRingRange.x) / (uRingRange.y - uRingRange.x);
        if (u > 0.0 && u < 1.0){
          float bl = t * 0.03 / uRadiusW / (uRingRange.y - uRingRange.x);
          float a = (texture2D(uRingTex, vec2(u, 0.5)).a + texture2D(uRingTex, vec2(u + bl, 0.5)).a + texture2D(uRingTex, vec2(u - bl, 0.5)).a) / 3.0;
          a *= 1.0 - 0.85*smoothstep(1.950, 1.956, r)*(1.0 - smoothstep(2.020, 2.027, r));
          shadow *= 1.0 - a*0.9;
        }
      }
    }
  }
  vec3 col = alb * (uSunColor * uSunI * diff * limb * shadow + uAmbient);
  float fres = pow(1.0 - NdV, 2.6);
  col += uHazeColor * fres * uHaze * smoothstep(-0.25, 0.5, dot(Ng, L)) * 0.3 * shadow * uSunI;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ------------------------------------------------------------------ independent animated cloud decks (parallax depth)
export const CLOUDLAYER_FRAG = /* glsl */`
precision highp float;
varying vec3 vObj; varying vec3 vWorld; varying vec2 vUv;
uniform float uTime, uSpeed, uScale, uStretch, uOpacity, uLo, uHi, uSeed, uShear;
uniform vec3 uTint;
${LIGHT}
${NOISE}
${SHADOW}
${EQ}
void main(){
  vec3 n = normalize(vObj);
  float lat = asin(clamp(n.y, -1.0, 1.0));
  vec3 p = rotY(n, uTime*uSpeed*(1.0 + uShear*sin(lat*6.0)));
  vec3 q = vec3(p.x*uScale, p.y*uScale*uStretch, p.z*uScale) + uSeed;
  float w = fbm(q*0.5 + vec3(0.0, uTime*0.01, 0.0), 3, 2.0, 0.5);
  float c = fbm(q + vec3(w*1.4, 0.0, -w*1.4), 5, 2.05, 0.5)*0.5 + 0.5;
  c = smoothstep(uLo, uHi, c) * smoothstep(1.0, 0.85, abs(n.y));
  if (c < 0.004) discard;
  vec3 Ng = normalize(mat3(modelMatrix) * n);
  vec3 L = normalize(-vWorld);
  float NgL = dot(Ng, L);
  float diff = smoothstep(-0.15, 0.3, NgL) * (0.45 + 0.55*max(NgL, 0.0));
  float shadow = sphereShadow(vWorld);
  vec3 col = uTint * uSunColor * diff * uSunI * shadow + uTint * uAmbient;
  float ndv = dot(Ng, normalize(cameraPosition - vWorld));
  gl_FragColor = vec4(col, c * uOpacity * smoothstep(0.03, 0.3, ndv));
}
`;

// ------------------------------------------------------------------ Earth
export const EARTH_HD_FRAG = /* glsl */`
precision highp float;
varying vec3 vObj; varying vec3 vWorld; varying vec2 vUv;
uniform sampler2D uDay, uNight, uClouds, uNormal, uSpec;
uniform float uCloudShift, uDetail, uTime;
${LIGHT}
${NOISE}
${SHADOW}
${EQ}
void main(){
  vec3 n = normalize(vObj);
  EqS s = eqs(n);
  vec3 day = pow(samp(uDay, s).rgb, vec3(2.2));
  vec3 night = pow(samp(uNight, s).rgb, vec3(2.2));
  float ocean = smoothstep(0.25, 0.6, samp(uSpec, s).r);
  vec3 nt = samp(uNormal, s).rgb*2.0 - 1.0;
  vec3 T = eastOf(n); vec3 B = cross(n, T);
  vec3 nb = normalize(T*nt.x*1.6 + B*nt.y*1.6 + n*max(nt.z, 0.2));
  nb = normalize(mix(nb, n, ocean));
  if (uDetail > 0.01){
    vec3 p = n*420.0;
    float w0 = snoise(p + vec3(uTime*0.4, 0.0, 0.0)), wx = snoise(p + T*0.7 + vec3(uTime*0.4, 0.0, 0.0)), wy = snoise(p + B*0.7 + vec3(uTime*0.4, 0.0, 0.0));
    nb = normalize(nb - uDetail*0.04*ocean*((wx - w0)*T + (wy - w0)*B));
  }
  vec3 Ng = normalize(mat3(modelMatrix) * n);
  vec3 Nw = normalize(mat3(modelMatrix) * nb);
  vec3 L = normalize(-vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 Lo = normalize(transpose(mat3(modelMatrix)) * L);
  float NgL = dot(Ng, L);
  float dayF = smoothstep(-0.10, 0.16, NgL);
  float diff = max(dot(Nw, L), 0.0) * smoothstep(-0.08, 0.05, NgL);
  vec3 cn = rotY(n, uCloudShift*TAU);
  float cl = max(sqrt(1.0 - n.y*n.y), 0.05);
  vec3 off = (dot(Lo, T)*T + dot(Lo, B)*B) * 0.006;
  float cShadow = texEq(uClouds, normalize(cn - rotY(off, uCloudShift*TAU))).r;
  float cHere = texEq(uClouds, cn).r;
  float shadow = sphereShadow(vWorld);
  vec3 alb = mix(day, day*vec3(0.40, 0.58, 0.88), ocean*0.8);
  vec3 col = alb * uSunColor * uSunI * diff * shadow * (1.0 - 0.55*smoothstep(0.15, 0.9, cShadow));
  vec3 H = normalize(L + V);
  float NdH = max(dot(Nw, H), 0.0);
  float fres = 0.02 + 0.98*pow(1.0 - max(dot(Ng, V), 0.0), 5.0);
  float spec = (pow(NdH, 240.0)*1.2 + pow(NdH, 26.0)*0.04) * ocean * dayF * (0.45 + fres) * (1.0 - 0.85*cHere);
  col += vec3(1.0, 0.93, 0.80) * spec * uSunI * shadow;
  float twi = smoothstep(-0.18, 0.0, NgL) * smoothstep(0.28, 0.0, NgL);
  col += alb * vec3(1.0, 0.42, 0.18) * twi * 0.04 * shadow;
  col += night * vec3(1.0, 0.80, 0.52) * 2.4 * (1.0 - dayF) * (1.0 - cHere*0.85);
  col += alb * uAmbient;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const EARTH_CLOUDS_HD_FRAG = /* glsl */`
precision highp float;
varying vec3 vObj; varying vec3 vWorld; varying vec2 vUv;
uniform sampler2D uClouds;
uniform float uTime;
uniform vec4 uStorms[3];
${LIGHT}
${NOISE}
${SHADOW}
${EQ}
float hurricane(vec3 n, vec4 st){
  vec3 c = normalize(st.xyz);
  if (dot(n, c) < 0.97) return 0.0;
  vec3 E = eastOf(c); vec3 N = cross(c, E);
  vec2 q = vec2(dot(n, E), dot(n, N)) / st.w;
  float r = length(q);
  if (r > 1.25) return 0.0;
  float hemi = sign(c.y + 1e-4);
  float a = atan(q.y, q.x) + hemi*uTime*0.25;
  float arms = 0.5 + 0.5*sin(a*2.0 - hemi*log(r + 0.03)*7.0 + snoise(vec3(q*6.0, uTime*0.05))*1.4);
  float body = smoothstep(1.2, 0.25, r) * (0.55 + 0.45*arms);
  float core = smoothstep(0.45, 0.0, r);
  float eye = smoothstep(0.035, 0.085, r);
  return clamp(max(body, core*0.95) * eye, 0.0, 1.0);
}
void main(){
  vec3 n = normalize(vObj);
  EqS s = eqs(n);
  float c0 = samp(uClouds, s).r;
  float c = smoothstep(0.10, 0.85, c0);
  for (int i = 0; i < 3; i++) c = max(c, hurricane(n, uStorms[i]));
  if (c < 0.01) discard;
  vec3 T = eastOf(n); vec3 B = cross(n, T);
  float cl = max(sqrt(1.0 - n.y*n.y), 0.05);
  float e = 0.0015;
  float cE = textureGrad(uClouds, s.uv + vec2(e/cl, 0.0), s.dx, s.dy).r;
  float cN = textureGrad(uClouds, s.uv + vec2(0.0, e*2.0), s.dx, s.dy).r;
  vec3 nb = normalize(n - 0.9*((cE - c0)*T + (cN - c0)*B));
  vec3 Ng = normalize(mat3(modelMatrix) * n);
  vec3 Nb = normalize(mat3(modelMatrix) * nb);
  vec3 L = normalize(-vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  float NgL = dot(Ng, L);
  float diff = smoothstep(-0.12, 0.25, NgL) * (0.35 + 0.65*max(dot(Nb, L), 0.0));
  float twi = smoothstep(-0.15, 0.02, NgL) * smoothstep(0.3, 0.02, NgL);
  float shadow = sphereShadow(vWorld);
  vec3 col = vec3(1.0, 0.99, 0.97) * mix(vec3(1.0), vec3(1.0, 0.55, 0.3), twi*0.85) * diff * uSunI * shadow * 0.92;
  col += vec3(0.6, 0.65, 0.8) * uAmbient;
  float rim = pow(1.0 - max(dot(Ng, V), 0.0), 2.0);
  gl_FragColor = vec4(col, c * (0.9 + 0.1*rim));
}
`;

export const AURORA_FRAG = /* glsl */`
precision highp float;
varying vec3 vObj; varying vec3 vWorld; varying vec2 vUv;
uniform mat4 modelMatrix;
uniform float uTime, uIntensity, uLayer;
uniform vec3 uMagN;
${NOISE}
void main(){
  vec3 n = normalize(vObj);
  float best = 0.0;
  for (int k = 0; k < 2; k++){
    vec3 pole = k == 0 ? uMagN : -uMagN;
    float colat = degrees(acos(clamp(dot(n, pole), -1.0, 1.0)));
    vec3 E = normalize(cross(pole, n + 1e-4));
    float lon = atan(dot(n, cross(pole, E)), dot(n, E));
    float wob = 2.2*snoise(vec3(cos(lon)*2.0, sin(lon)*2.0, uTime*0.05 + float(k)*7.0));
    float band = exp(-pow((colat - 20.0 - wob)/(2.4 + uLayer*1.5), 2.0));
    float rays = pow(snoise(vec3(cos(lon)*38.0, sin(lon)*38.0, uTime*0.35 + float(k)*3.0))*0.5 + 0.5, 2.0);
    float sheet = 0.55 + 0.45*snoise(vec3(cos(lon)*6.0, sin(lon)*6.0, uTime*0.12));
    best = max(best, band * (0.35 + 0.9*rays) * sheet);
  }
  vec3 L = normalize(-vWorld);
  vec3 Ng = normalize(mat3(modelMatrix) * n);
  float night = smoothstep(0.25, -0.2, dot(Ng, L));
  vec3 V = normalize(cameraPosition - vWorld);
  float edge = 0.4 + 1.6*pow(1.0 - abs(dot(Ng, V)), 2.0);
  vec3 col = (uLayer < 0.5 ? vec3(0.20, 1.0, 0.45) : vec3(0.85, 0.20, 0.45)) * best * night * edge * uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ------------------------------------------------------------------ physically based atmospheric scattering
export const SCATTER_VERT = /* glsl */`
varying vec3 vWorld;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
`;
export const SCATTER_FRAG = /* glsl */`
precision highp float;
varying vec3 vWorld;
uniform vec3 uCenter, uAxis, uBetaR, uBetaM, uMieColor;
uniform float uFlat, uR, uShell, uH, uSunI, uIntensity, uG, uSteps;
vec2 sph(vec3 ro, vec3 rd, float r){
  float b = dot(ro, rd); float c = dot(ro, ro) - r*r; float h = b*b - c;
  if (h < 0.0) return vec2(1e9, -1e9);
  h = sqrt(h); return vec2(-b - h, -b + h);
}
void main(){
  vec3 ro = cameraPosition - uCenter;
  vec3 rd = normalize(vWorld - cameraPosition);
  ro += uAxis * dot(ro, uAxis) * (uFlat - 1.0);
  rd += uAxis * dot(rd, uAxis) * (uFlat - 1.0);
  float stretch = length(rd); rd /= stretch;
  vec2 ts = sph(ro, rd, uShell);
  if (ts.y < 0.0) discard;
  float t0 = max(ts.x, 0.0), t1 = ts.y;
  vec2 tp = sph(ro, rd, uR);
  bool hitsPlanet = tp.x > 0.0 && tp.x < t1;
  if (hitsPlanet) t1 = tp.x;
  const int N = 14;
  float dt = (t1 - t0) / uSteps;
  vec3 Ls = normalize(-uCenter);
  float mu = dot(rd, Ls);
  float phR = 0.0596831 * (1.0 + mu*mu);
  float g = uG;
  float phM = 0.1193662 * (1.0 - g*g) * (1.0 + mu*mu) / ((2.0 + g*g) * pow(1.0 + g*g - 2.0*g*mu, 1.5));
  vec3 betaE = uBetaR + uBetaM * 1.11;
  vec3 sum = vec3(0.0); vec3 sumM = vec3(0.0);
  float odV = 0.0;
  for (int i = 0; i < N; i++){
    if (float(i) >= uSteps) break;
    vec3 p = ro + rd * (t0 + dt * (float(i) + 0.5));
    float r = length(p);
    float h = max(r - uR, 0.0);
    float dens = exp(-h / uH);
    float d = dens * dt;
    odV += d * 0.5;
    float mus = dot(p / r, Ls);
    float hor = -sqrt(max(1.0 - (uR*uR)/(r*r), 0.0));
    float sunVis = smoothstep(hor - 0.015, hor + 0.05, mus);
    float odS = dens * uH / max(mus - hor + 0.06, 0.02) * 0.35;
    vec3 att = exp(-betaE * (odV + odS)) * sunVis;
    odV += d * 0.5;
    sum += d * att;
  }
  vec3 col = (sum * uBetaR * phR + sum * uBetaM * phM * uMieColor) * uSunI * uIntensity;
  vec3 trans = exp(-betaE * odV);
  float a = hitsPlanet ? clamp(1.0 - dot(trans, vec3(0.333)), 0.0, 0.92) : 0.0;
  gl_FragColor = vec4(col, a);
}
`;

// ------------------------------------------------------------------ Saturn's main rings
export const RING_HD_FRAG = /* glsl */`
precision highp float;
varying vec3 vWorld; varying vec3 vLocal;
uniform sampler2D uProfile;
uniform vec2 uTexRange, uRange;
uniform vec3 uCenter, uN;
uniform float uR, uTime, uSunI, uOpacity, uLayerA;
${NOISE}
float ringAlpha(float r, float th, out vec3 alb){
  float u = (r - uTexRange.x) / (uTexRange.y - uTexRange.x);
  vec4 tex = texture2D(uProfile, vec2(clamp(u, 0.0, 1.0), 0.5));
  float a = (u >= 0.0 && u <= 1.0) ? tex.a : 0.0;
  vec3 warm = r < 1.527 ? vec3(0.62, 0.57, 0.51) : (r < 1.951 ? vec3(0.95, 0.86, 0.70) : vec3(0.84, 0.78, 0.68));
  alb = pow(mix(tex.rgb*1.35, warm, 0.55), vec3(2.2));
  a += 0.035 * smoothstep(1.11, 1.12, r) * (1.0 - smoothstep(1.15, 1.236, r));
  float cass = smoothstep(1.950, 1.956, r) * (1.0 - smoothstep(2.020, 2.027, r));
  a *= mix(1.0, 0.06 + 0.45*exp(-pow((r - 1.990)/0.0018, 2.0)) + 0.35*exp(-pow((r - 2.005)/0.0012, 2.0)), cass);
  a *= 1.0 - 0.97*exp(-pow((r - 2.214)/0.0026, 2.0));
  a *= 1.0 - 0.92*exp(-pow((r - 2.2645)/0.0008, 2.0));
  float s1 = 2.326 + 0.0011*sin(th*7.0 + uTime*0.05);
  float s2 = 2.326 + 0.0011*sin(th*7.0 + 2.6 + uTime*0.05);
  float clumpF = 0.5 + 0.5*snoise(vec3(cos(th)*24.0, sin(th)*24.0, uTime*0.02));
  float F = (exp(-pow((r - s1)/0.0006, 2.0)) + exp(-pow((r - s2)/0.0006, 2.0))) * (0.45 + 0.55*clumpF) + 0.12*exp(-pow((r - 2.326)/0.004, 2.0));
  a = max(a, F * 0.8);
  if (r > 2.31) alb = pow(vec3(0.86, 0.84, 0.80), vec3(2.2));
  return clamp(a, 0.0, 1.0);
}
void main(){
  float r = length(vLocal.xy);
  if (r < uRange.x || r > uRange.y) discard;
  float th = atan(vLocal.y, vLocal.x);
  vec3 alb;
  float alpha = ringAlpha(r, th, alb);
  // thousands of fine ringlets, revealed as the camera gets close (anti-aliased)
  float fr = r * 2200.0;
  float aa = 1.0 - smoothstep(0.25, 0.8, fwidth(fr));
  float ringlets = snoise(vec3(fr*0.5, 0.0, 3.0))*0.6 + 0.4*snoise(vec3(fr*1.9, 1.0, 5.0));
  alpha *= 1.0 + 0.28*ringlets*aa*step(1.24, r)*step(r, 2.3);
  float fr2 = r * 90.0;
  float aa2 = 1.0 - smoothstep(0.15, 0.5, fwidth(fr2));
  float tt = th - 0.35*pow(r, -1.5)*uTime;
  alpha *= 1.0 + 0.07*snoise(vec3(cos(tt)*1.6, sin(tt)*1.6, fr2))*aa2;
  vec3 L = normalize(-vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  float sL = dot(L, uN), sV = dot(V, uN);
  // faint spokes in the B ring, co-rotating with the planet's magnetic field
  float ts = th - 0.18*uTime;
  float sk = snoise(vec3(cos(ts)*4.0, sin(ts)*4.0, uTime*0.02))*0.5 + 0.5;
  float spokes = smoothstep(0.78, 0.97, sk) * smoothstep(1.66, 1.74, r) * smoothstep(1.93, 1.86, r);
  alpha *= 1.0 - (sL*sV > 0.0 ? 0.06 : -0.08) * spokes;
  alpha = clamp(alpha, 0.0, 1.0);
  vec3 rel = vWorld - uCenter;
  float proj = dot(rel, L);
  float shadow = 1.0;
  if (proj < 0.0){
    float perp = length(rel - L*proj);
    float pen = 0.03*uR + (-proj)*0.025;
    shadow = smoothstep(uR - pen, uR + pen*0.5, perp);
  }
  float phase = pow(max(dot(-V, L), 0.0), 8.0);
  float incid = mix(0.42, 1.0, sqrt(abs(sL)));
  vec3 col;
  if (sL*sV > 0.0){
    float selfShadow = mix(1.0, 0.62, alpha * (1.0 - abs(sL)));
    col = alb * incid * selfShadow * (1.05 + 0.8*phase*(1.0 - alpha));
    // icy glints when close
    vec2 cell = floor(vec2(th*6000.0, r*6000.0));
    float h = fract(sin(dot(cell, vec2(12.9898, 78.233)))*43758.5453);
    vec3 Rf = reflect(-L, uN * sign(sL));
    float gl = step(0.996, h) * pow(max(dot(Rf, V), 0.0), 30.0) * aa;
    col += vec3(1.0, 0.98, 0.94) * gl * 2.5 * alpha;
  } else {
    col = alb * (alpha*(1.0 - alpha)*2.4 + phase*(1.0 - alpha)*1.4) * 0.8;
  }
  col *= shadow * uSunI;
  col += alb * 0.012;
  float aOut = 1.0 - pow(1.0 - alpha * uOpacity, uLayerA);
  gl_FragColor = vec4(col, aOut);
}
`;

// faint dusty rings: Saturn G/E, Uranus nu/mu, Neptune (with the Adams arcs), Jupiter's main ring
export const RING_DUST_FRAG = /* glsl */`
precision highp float;
varying vec3 vWorld; varying vec3 vLocal;
uniform float uKind, uTime, uSunI, uR, uOpacity;
uniform vec3 uCenter, uN;
${NOISE}
float g1(float r, float c, float w){ return exp(-pow((r - c)/w, 2.0)); }
float win(float a, float c, float w){ float d = abs(mod(a - c + 3.14159265, 6.2831853) - 3.14159265); return smoothstep(w, w*0.6, d); }
void main(){
  float r = length(vLocal.xy);
  float th = atan(vLocal.y, vLocal.x);
  float a = 0.0; vec3 c = vec3(0.6); float fwd = 6.0;
  int k = int(uKind + 0.5);
  if (k == 1){
    a = 0.07*g1(r, 2.75, 0.04) + 0.05*g1(r, 3.95, 0.5) + 0.03*smoothstep(2.9, 3.4, r)*(1.0 - smoothstep(6.5, 8.0, r));
    c = vec3(0.70, 0.80, 0.95); fwd = 10.0;
  } else if (k == 2){
    a = 0.05*g1(r, 2.66, 0.05) + 0.09*g1(r, 3.75, 0.25);
    c = r < 3.1 ? vec3(0.72, 0.56, 0.50) : vec3(0.50, 0.64, 0.95); fwd = 4.0;
  } else if (k == 3){
    float adams = 0.35*g1(r, 2.54, 0.0018);
    float arcsAng = th - 0.26*uTime*0.05;
    float arcs = win(arcsAng, 0.00, 0.010) + win(arcsAng, 0.14, 0.035) + win(arcsAng, 0.31, 0.030) + win(arcsAng, 0.37, 0.030) + win(arcsAng, 0.55, 0.09);
    arcs *= 0.6 + 0.4*snoise(vec3(cos(arcsAng)*90.0, sin(arcsAng)*90.0, 1.0));
    a = 0.05*g1(r, 1.69, 0.035) + 0.30*g1(r, 2.148, 0.0013) + 0.03*smoothstep(2.15, 2.2, r)*(1.0 - smoothstep(2.31, 2.36, r)) + 0.12*g1(r, 2.31, 0.0013) + adams*(0.15 + 3.2*arcs);
    c = vec3(0.55, 0.52, 0.56); fwd = 6.0;
  } else {
    a = 0.22*smoothstep(1.71, 1.725, r)*(1.0 - smoothstep(1.80, 1.815, r)) * (0.8 + 0.2*snoise(vec3(r*300.0, 0.0, 1.0))) + 0.04*smoothstep(1.81, 1.85, r)*(1.0 - smoothstep(2.4, 2.56, r)) + 0.02*smoothstep(2.5, 2.6, r)*(1.0 - smoothstep(2.95, 3.1, r));
    c = vec3(0.62, 0.50, 0.40); fwd = 8.0;
  }
  if (a < 0.002) discard;
  vec3 L = normalize(-vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  float sL = dot(L, uN), sV = dot(V, uN);
  vec3 rel = vWorld - uCenter;
  float proj = dot(rel, L);
  float shadow = 1.0;
  if (proj < 0.0){ float perp = length(rel - L*proj); shadow = smoothstep(uR*0.97, uR*1.04, perp); }
  float phase = pow(max(dot(-V, L), 0.0), fwd);
  float lit = (sL*sV > 0.0 ? 0.35 + 0.65*abs(sL) : 0.25) * (k == 1 ? 0.25 : 1.0);
  vec3 col = pow(c, vec3(2.2)) * (lit + phase*5.0) * shadow * uSunI;
  gl_FragColor = vec4(col, clamp(a * uOpacity * (0.6 + 2.0*phase), 0.0, 1.0));
}
`;

// instanced ice boulders that fill the rings around the camera when it flies close
export const ROCK_VERT = /* glsl */`
attribute vec4 aSeed;
uniform vec3 uCamL;
uniform float uBox, uThick, uSize;
uniform sampler2D uProfile;
uniform vec2 uTexRange;
varying vec3 vN; varying vec3 vWorld; varying float vTone;
mat3 rotm(vec3 a){
  float cx = cos(a.x), sx = sin(a.x), cy = cos(a.y), sy = sin(a.y), cz = cos(a.z), sz = sin(a.z);
  return mat3(cy*cz, cy*sz, -sy, sx*sy*cz - cx*sz, sx*sy*sz + cx*cz, sx*cy, cx*sy*cz + sx*sz, cx*sy*sz - sx*cz, cx*cy);
}
void main(){
  vec2 xz = (fract(aSeed.xz - uCamL.xz/uBox) - 0.5) * uBox + uCamL.xz;
  float r = length(xz);
  float u = (r - uTexRange.x) / (uTexRange.y - uTexRange.x);
  float dens = (u > 0.0 && u < 1.0) ? textureLod(uProfile, vec2(u, 0.5), 0.0).a : 0.0;
  dens *= 1.0 - 0.95*smoothstep(1.950, 1.956, r)*(1.0 - smoothstep(2.020, 2.027, r));
  dens *= 1.0 - exp(-pow((r - 2.214)/0.0026, 2.0));
  float keep = step(fract(aSeed.w*7.13), dens);
  float y = (aSeed.y - 0.5) * uThick;
  vec3 c = vec3(xz.x, y, xz.y);
  float d = length(c - uCamL);
  float fade = 1.0 - smoothstep(uBox*0.28, uBox*0.48, d);
  float sz = uSize * (0.25 + 2.2*pow(fract(aSeed.w*3.7), 4.0)) * keep * fade;
  mat3 R = rotm(aSeed.wxy * 6.2831);
  vec3 pos = R * (position * vec3(1.0, 0.75 + 0.5*fract(aSeed.x*9.1), 0.8)) * sz + c;
  vN = normalize(mat3(modelMatrix) * (R * normal));
  vTone = fract(aSeed.z * 5.3);
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
export const ROCK_FRAG = /* glsl */`
precision highp float;
varying vec3 vN; varying vec3 vWorld; varying float vTone;
uniform vec3 uCenter;
uniform float uR, uSunI;
void main(){
  vec3 L = normalize(-vWorld);
  vec3 rel = vWorld - uCenter;
  float proj = dot(rel, L);
  float shadow = 1.0;
  if (proj < 0.0){ float perp = length(rel - L*proj); shadow = smoothstep(uR*0.98, uR*1.02, perp); }
  vec3 alb = pow(mix(vec3(0.78, 0.74, 0.68), vec3(0.95, 0.93, 0.9), vTone), vec3(2.2));
  float diff = max(dot(normalize(vN), L), 0.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float spec = pow(max(dot(reflect(-L, normalize(vN)), V), 0.0), 24.0) * 0.4;
  gl_FragColor = vec4(alb * (diff * shadow * uSunI + 0.02) + spec * shadow * uSunI, 1.0);
}
`;

// dust particles: Jupiter's halo and gossamer rings, Neptune's arc clumps
export const DUSTPTS_VERT = /* glsl */`
attribute float aR, aTh, aY, aSize, aB;
uniform float uTime, uPR, uRate;
uniform vec3 uCenter;
uniform float uRw;
varying float vB;
void main(){
  float th = aTh + uRate * pow(aR, -1.5) * uTime;
  vec3 p = vec3(aR*cos(th), aY, -aR*sin(th));
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vec3 L = normalize(-wp.xyz);
  vec3 V = normalize(cameraPosition - wp.xyz);
  float phase = pow(max(dot(-V, L), 0.0), 7.0);
  vec3 rel = wp.xyz - uCenter;
  float proj = dot(rel, L);
  float shadow = proj < 0.0 ? smoothstep(uRw*0.97, uRw*1.04, length(rel - L*proj)) : 1.0;
  vB = aB * (0.15 + 6.0*phase) * shadow;
  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uPR * 30.0 / max(-mv.z, 0.01), 0.8, 3.0*uPR);
}
`;
export const DUSTPTS_FRAG = /* glsl */`
precision highp float;
varying float vB;
uniform vec3 uColor;
uniform float uAlpha;
void main(){
  vec2 c = gl_PointCoord*2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  gl_FragColor = vec4(uColor * vB * exp(-r2*3.0) * uAlpha, 1.0);
}
`;
