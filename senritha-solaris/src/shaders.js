// GLSL for Senritha's Solaris X3D.
// Surfaces are generated once on the GPU into cube maps ("baking"), then animated at runtime.

export const NOISE = /* glsl */`
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float fbm(vec3 p, int oct, float lac, float gain){
  float s = 0.0, a = 0.5, f = 1.0;
  for (int i = 0; i < 10; i++){ if (i >= oct) break; s += a * snoise(p * f); f *= lac; a *= gain; }
  return s;
}
float ridged(vec3 p, int oct){
  float s = 0.0, a = 0.5, f = 1.0, w = 1.0;
  for (int i = 0; i < 8; i++){
    if (i >= oct) break;
    float n = 1.0 - abs(snoise(p * f)); n *= n; n *= w; w = clamp(n * 2.0, 0.0, 1.0);
    s += n * a; f *= 2.1; a *= 0.5;
  }
  return s;
}
vec3 hash33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float hash13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 voronoi(vec3 p){
  vec3 ip = floor(p), fp = fract(p); float f1 = 8.0, f2 = 8.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++){
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 r = g + hash33(ip + g) - fp; float d = dot(r, r);
    if (d < f1){ f2 = f1; f1 = d; } else if (d < f2){ f2 = d; }
  }
  return vec2(sqrt(f1), sqrt(f2));
}
float sat(float x){ return clamp(x, 0.0, 1.0); }
float gauss(float x, float w){ return exp(-(x*x)/(w*w)); }
vec3 dirLL(float latDeg, float lonDeg){ float la = radians(latDeg), lo = radians(lonDeg); return vec3(cos(la)*cos(lo), sin(la), cos(la)*sin(lo)); }
float angDist(vec3 a, vec3 b){ return acos(clamp(dot(a, b), -1.0, 1.0)); }
vec3 eastOf(vec3 n){ vec3 up = abs(n.y) > 0.999 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0); return normalize(cross(up, n)); }
`;

// Soft shadows from spheres (moons, planets) between a point and the Sun.
export const SHADOW = /* glsl */`
uniform vec4 uOcc[4];
uniform int uOccN;
uniform float uSunR;
float sphereShadow(vec3 P){
  vec3 toSun = -P; float dS = length(toSun); vec3 Ld = toSun / dS;
  float aS = asin(clamp(uSunR / dS, 0.0, 1.0));
  float light = 1.0;
  for (int i = 0; i < 4; i++){
    if (i >= uOccN) break;
    vec3 toO = uOcc[i].xyz - P; float dO = length(toO);
    if (dot(toO, Ld) <= 0.0 || dO > dS) continue;
    float aO = asin(clamp(uOcc[i].w / dO, 0.0, 1.0));
    float sep = acos(clamp(dot(toO / dO, Ld), -1.0, 1.0));
    float full = min(1.0, (aO * aO) / (aS * aS));
    light *= 1.0 - full * (1.0 - smoothstep(abs(aS - aO), aS + aO, sep));
  }
  return light;
}
`;

// ---------------------------------------------------------------- baking
export const BAKE_VERT = /* glsl */`
varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export const BAKE_FRAG = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform float uKind;
uniform vec3 uColA, uColB;
uniform vec4 uP;
uniform float uSeed;
${NOISE}

float craterShape(float d, float big){
  if (d > 2.4) return 0.0;
  float bowl = d < 1.0 ? max(d*d - 1.0, -0.62 + 0.2*big) : 0.0;
  float rim = 0.30 * exp(-pow((d - 1.0) * 4.2, 2.0));
  float ej = d > 1.0 ? 0.10 * exp(-(d - 1.0) * 3.0) : 0.0;
  float peak = big * 0.30 * exp(-d*d*28.0);
  return bowl + rim + ej + peak;
}
// x: height, y: bright ray/ejecta amount
vec2 craterLayer(vec3 p, float freq, float density, float seed){
  vec3 q = p * freq + seed;
  vec3 ip = floor(q), fp = fract(q);
  float h = 0.0, ray = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++){
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 cell = ip + g;
    vec3 r = hash33(cell);
    if (r.z > density) continue;
    vec3 c = g + 0.15 + 0.7 * hash33(cell + 17.31);
    float rad = mix(0.16, 0.46, r.x * r.x);
    vec3 v = fp - c;
    float d = length(v) / rad;
    h += craterShape(d, step(0.72, r.y)) * rad;
    if (r.y > 0.9){
      float streak = snoise(normalize(v + 1e-4) * 6.0 + cell * 3.7) * 0.5 + 0.5;
      ray += pow(streak, 3.0) * exp(-max(d - 1.0, 0.0) * 0.55) * step(0.85, d) * 1.4 + 0.5 * exp(-d*d*0.6);
    }
  }
  return vec2(h, ray);
}

vec4 bakeMercury(vec3 d){
  float h = 0.0, rays = 0.0; vec2 c;
  c = craterLayer(d, 2.2, 0.55, 1.0); h += c.x*0.95; rays += c.y*0.8;
  c = craterLayer(d, 4.5, 0.70, 2.0); h += c.x*0.48; rays += c.y;
  c = craterLayer(d, 9.0, 0.80, 3.0); h += c.x*0.24; rays += c.y*0.6;
  c = craterLayer(d, 18.0, 0.85, 4.0); h += c.x*0.12;
  c = craterLayer(d, 36.0, 0.90, 5.0); h += c.x*0.06;
  c = craterLayer(d, 72.0, 0.90, 6.0); h += c.x*0.03;
  float plains = smoothstep(0.12, 0.42, fbm(d*1.3 + 7.0, 4, 2.0, 0.5));
  h = mix(h, h*0.4, plains);
  h += 0.04 * fbm(d*6.0, 5, 2.0, 0.5);
  float tone = 0.5 + 0.5*fbm(d*3.0 + 3.0, 6, 2.1, 0.5);
  vec3 col = mix(vec3(0.33, 0.31, 0.29), vec3(0.56, 0.53, 0.49), tone);
  col = mix(col, vec3(0.42, 0.37, 0.31), plains*0.55);
  col = mix(col, vec3(0.24, 0.23, 0.24), smoothstep(0.35, 0.6, fbm(d*2.4 - 5.0, 4, 2.0, 0.5))*0.35);
  col += vec3(0.26, 0.25, 0.24) * min(rays, 1.2);
  return vec4(col, sat(0.5 + h*0.5));
}

vec4 bakeVenus(vec3 d){
  float lat = asin(clamp(d.y, -1.0, 1.0));
  float lon = atan(d.z, d.x);
  vec3 q = vec3(d.x, d.y*3.0, d.z);
  float w1 = fbm(q*1.6 + 2.0, 5, 2.0, 0.5);
  float w2 = fbm(q*3.2 + vec3(w1*1.8, w1*0.6, -w1*1.2), 6, 2.0, 0.5);
  float w3 = fbm(vec3(d.x, d.y*1.5, d.z)*7.0 + w2*1.2, 4, 2.0, 0.5);
  float yf = gauss(abs(lat)*2.0 - (0.55 + 0.45*cos(lon))*0.9 + w1*0.35, 0.32) * (0.6 + 0.4*cos(lon));
  float collar = gauss(abs(lat) - 1.12, 0.10);
  float vortex = smoothstep(1.28, 1.5, abs(lat));
  float tone = 0.5 + 0.5*w2;
  vec3 light = vec3(0.97, 0.88, 0.64), mid = vec3(0.89, 0.74, 0.47), dark = vec3(0.74, 0.56, 0.33);
  vec3 col = mix(mid, light, smoothstep(0.25, 0.8, tone));
  col = mix(col, dark, 0.35*yf + 0.22*smoothstep(0.55, 0.95, 1.0 - tone));
  col *= 0.96 + 0.08*w3;
  col = mix(col, light, collar*0.45);
  col = mix(col, dark, vortex*0.25);
  return vec4(col, 0.5 + 0.22*w2 + 0.06*w3);
}

vec4 bakeMars(vec3 d){
  float lat = degrees(asin(clamp(d.y, -1.0, 1.0)));
  float lon = degrees(atan(d.z, d.x));
  float n1 = fbm(d*2.0 + 1.7, 6, 2.0, 0.5);
  float n2 = fbm(d*5.0 - 3.1, 5, 2.1, 0.5);
  float lowland = smoothstep(-6.0, 6.0, lat - 8.0 - 14.0*sin(radians(lon + 60.0)) + 22.0*n1);
  float h = -0.22*lowland + 0.08*n1 + 0.03*n2;
  float th = angDist(d, dirLL(2.0, -105.0));
  h += 0.40*gauss(th, 0.38);
  float om = angDist(d, dirLL(18.6, -134.0));
  h += 0.50*gauss(om, 0.07) + 0.10*gauss(om, 0.12) - 0.10*gauss(om, 0.012);
  vec3 mons[3] = vec3[3](dirLL(-9.0, -121.0), dirLL(-1.0, -113.0), dirLL(11.0, -104.0));
  for (int i = 0; i < 3; i++){ float a = angDist(d, mons[i]); h += 0.30*gauss(a, 0.04) - 0.07*gauss(a, 0.008); }
  h += 0.12*gauss(angDist(d, dirLL(40.5, -109.6)), 0.15);
  h += 0.20*gauss(angDist(d, dirLL(25.0, 147.0)), 0.05);
  // Valles Marineris
  float lonN = (lon + 112.0) / 72.0;
  float latC = -6.0 - 8.0*lonN + 1.5*sin(lonN*9.0);
  float w = mix(0.9, 2.3, sin(clamp(lonN, 0.0, 1.0)*3.14159)) + 0.7*n2;
  float vm = gauss((lat - latC)/w, 1.0) * smoothstep(-0.04, 0.08, lonN) * smoothstep(1.06, 0.9, lonN);
  vm += 0.6*gauss((lat - latC - 3.4)/(w*0.55), 1.0) * smoothstep(0.2, 0.35, lonN) * smoothstep(0.75, 0.6, lonN);
  float maze = smoothstep(0.55, 0.9, ridged(d*22.0, 4)) * gauss(angDist(d, dirLL(-7.0, -103.0)), 0.07);
  h -= 0.34*vm + 0.10*maze;
  // impact basins
  float ha = angDist(d, dirLL(-42.4, 70.5));
  h += -0.45*gauss(ha, 0.26) + 0.07*gauss(ha - 0.36, 0.06);
  float aa = angDist(d, dirLL(-49.7, -43.4));
  h += -0.25*gauss(aa, 0.13) + 0.05*gauss(aa - 0.2, 0.04);
  h += -0.15*gauss(angDist(d, dirLL(12.9, 87.0)), 0.1);
  float dens = mix(0.75, 0.2, lowland);
  vec2 c;
  c = craterLayer(d, 3.0, 0.30*dens, 11.0); h += c.x*0.32;
  c = craterLayer(d, 6.5, 0.45*dens, 12.0); h += c.x*0.17;
  c = craterLayer(d, 14.0, 0.60*dens, 13.0); h += c.x*0.09;
  c = craterLayer(d, 30.0, 0.70*dens, 14.0); h += c.x*0.045;
  // albedo
  vec3 rust = vec3(0.74, 0.42, 0.25), bright = vec3(0.86, 0.60, 0.40), dark = vec3(0.40, 0.25, 0.17);
  float dm = smoothstep(0.05, 0.45, fbm(d*2.6 + 9.0, 5, 2.0, 0.5) + 0.35*gauss(lat + 20.0, 16.0));
  dm += 0.9*gauss(angDist(d, dirLL(9.0, 69.0)), 0.13);
  dm += 0.6*gauss(angDist(d, dirLL(46.0, -30.0)), 0.16);
  dm += 0.5*gauss(angDist(d, dirLL(-2.0, 0.0)), 0.09);
  dm += 0.5*gauss(angDist(d, dirLL(-25.0, -40.0)), 0.18);
  dm *= 1.0 - 0.85*gauss(th, 0.42);
  dm *= 1.0 - 0.7*gauss(angDist(d, dirLL(20.0, 5.0)), 0.3);
  dm = sat(dm);
  vec3 col = mix(rust, bright, smoothstep(-0.2, 0.5, n2)*0.5 + gauss(th, 0.35)*0.4);
  col = mix(col, dark, dm*0.8);
  col = mix(col, bright, gauss(ha, 0.2)*0.6);
  col *= 0.92 + 0.16*sat(0.5 + h*0.8);
  // polar caps
  float colat = 90.0 - lat;
  float capR = 8.5 + 3.5*n2 + 1.5*n1;
  float capN = smoothstep(capR + 1.0, capR - 1.0, colat);
  float phi = atan(d.z, d.x);
  float trough = pow(abs(sin(phi*2.0 + colat*0.55 + n2*2.0)), 14.0) * capN * smoothstep(2.0, 5.0, colat) * 0.4;
  float sa = degrees(angDist(d, dirLL(-87.0, -45.0)));
  float capS = smoothstep(5.5, 3.8, sa + 2.0*n2);
  float cap = max(capN, capS);
  col = mix(col, vec3(0.95, 0.93, 0.89), cap);
  col = mix(col, vec3(0.62, 0.50, 0.42), trough*0.6);
  h += cap*0.05;
  return vec4(col, sat(0.5 + h*0.5));
}

vec3 jupBand(float latD){
  vec3 c = vec3(0.56, 0.54, 0.52);
  c = mix(c, vec3(0.64, 0.57, 0.49), smoothstep(-61.0, -59.0, latD));
  c = mix(c, vec3(0.72, 0.66, 0.57), smoothstep(-51.0, -49.0, latD));
  c = mix(c, vec3(0.80, 0.74, 0.64), smoothstep(-46.0, -44.0, latD));
  c = mix(c, vec3(0.60, 0.48, 0.38), smoothstep(-37.0, -35.0, latD));
  c = mix(c, vec3(0.86, 0.80, 0.69), smoothstep(-30.0, -28.0, latD));
  c = mix(c, vec3(0.91, 0.85, 0.74), smoothstep(-25.0, -23.5, latD));
  c = mix(c, vec3(0.64, 0.44, 0.31), smoothstep(-19.5, -18.0, latD));
  c = mix(c, vec3(0.73, 0.55, 0.39), smoothstep(-14.0, -12.0, latD));
  c = mix(c, vec3(0.89, 0.81, 0.67), smoothstep(-8.5, -7.0, latD));
  c = mix(c, vec3(0.86, 0.72, 0.53), smoothstep(-3.0, -1.0, latD));
  c = mix(c, vec3(0.90, 0.82, 0.68), smoothstep(2.0, 4.0, latD));
  c = mix(c, vec3(0.58, 0.37, 0.25), smoothstep(6.0, 7.5, latD));
  c = mix(c, vec3(0.67, 0.46, 0.32), smoothstep(13.0, 15.0, latD));
  c = mix(c, vec3(0.88, 0.82, 0.70), smoothstep(17.5, 19.0, latD));
  c = mix(c, vec3(0.66, 0.51, 0.39), smoothstep(23.5, 25.0, latD));
  c = mix(c, vec3(0.83, 0.77, 0.66), smoothstep(30.0, 31.5, latD));
  c = mix(c, vec3(0.67, 0.57, 0.47), smoothstep(35.0, 36.5, latD));
  c = mix(c, vec3(0.78, 0.72, 0.63), smoothstep(42.0, 43.5, latD));
  c = mix(c, vec3(0.62, 0.58, 0.53), smoothstep(49.0, 51.0, latD));
  c = mix(c, vec3(0.55, 0.54, 0.53), smoothstep(58.0, 61.0, latD));
  return c;
}

vec4 bakeJupiter(vec3 d){
  float lat = asin(clamp(d.y, -1.0, 1.0)); float latD = degrees(lat);
  float lon = atan(d.z, d.x);
  vec3 a = vec3(d.x, d.y*5.0, d.z);
  float t1 = fbm(a*2.0 + 4.0, 6, 2.0, 0.55);
  float t2 = fbm(a*3.5 + vec3(t1*1.6, t1*0.4, -t1*1.6), 6, 2.05, 0.52);
  float t3 = fbm(vec3(d.x, d.y*2.0, d.z)*12.0 + vec3(t2*2.0), 4, 2.0, 0.5);
  float polar = smoothstep(42.0, 62.0, abs(latD));
  float wake = gauss(latD + 17.0, 5.0) * smoothstep(0.05, -0.35, lon) * smoothstep(-1.6, -0.5, lon);
  float edgeT = 1.0 + 1.6*pow(abs(sin(lat*20.0)), 3.0);
  float latW = latD + (t2*2.6 + t1*1.3 + t3*1.1*edgeT) * (1.0 + 2.2*polar) + t3*5.0*wake;
  vec3 col = jupBand(latW);
  float streak = fbm(vec3(d.x*3.0, d.y*64.0, d.z*3.0) + vec3(t2*0.8), 5, 2.1, 0.5);
  col *= 0.92 + 0.15*streak;
  // small eddies along band edges
  vec2 vo = voronoi(vec3(d.x, d.y*2.0, d.z)*18.0 + t2);
  float eddy = smoothstep(0.25, 0.0, vo.x) * (0.5 + 0.5*sin(lat*22.0)) * (1.0 - polar);
  col = mix(col, col*1.12 + 0.03, eddy*0.35);
  // festoons along the southern edge of the North Equatorial Belt
  float fest = gauss(latW - 6.2, 2.4) * smoothstep(0.55, 0.95, 0.5 + 0.5*sin(lon*13.0 + t1*5.0));
  col = mix(col, vec3(0.38, 0.40, 0.47), fest*0.75);
  // "string of pearls" white ovals
  for (int i = 0; i < 8; i++){
    vec3 c = dirLL(-40.5, float(i)*45.0 + 23.0);
    float r = angDist(d, c) / 0.034;
    col = mix(col, vec3(0.95, 0.93, 0.88), smoothstep(1.0, 0.55, r + t3*0.15));
    col = mix(col, vec3(0.60, 0.50, 0.40), gauss(r - 1.15, 0.25)*0.35);
  }
  // Oval BA
  { vec3 c = dirLL(-33.0, 80.0); float r = angDist(d, c) / 0.05;
    col = mix(col, vec3(0.86, 0.60, 0.48), smoothstep(1.0, 0.45, r + t3*0.1));
    col = mix(col, vec3(0.95, 0.90, 0.82), gauss(r - 1.05, 0.15)*0.5); }
  // brown barges in the NEB
  for (int i = 0; i < 5; i++){
    vec3 c = dirLL(15.5, float(i)*72.0 - 150.0);
    vec3 E = eastOf(c); vec3 N = cross(c, E);
    vec2 q = vec2(dot(d, E)/0.045, dot(d, N)/0.018);
    float m = smoothstep(1.0, 0.4, length(q)) * step(0.9, dot(d, c));
    col = mix(col, vec3(0.40, 0.25, 0.17), m*0.85);
  }
  // polar cyclone clusters
  float cyc = 0.0;
  if (abs(latD) > 55.0){
    vec2 pv = voronoi(d*9.0 + 31.0);
    cyc = smoothstep(0.35, 0.0, pv.x) * polar;
    float sw = sin(atan(d.z, d.x)*3.0 + pv.x*30.0);
    col = mix(col, col*(0.85 + 0.25*sw), cyc*0.6);
  }
  float hgt = 0.5 + 0.35*(dot(col, vec3(0.333)) - 0.7) + 0.06*t2 + 0.04*eddy;
  // Great Red Spot
  vec3 gc = dirLL(-22.3, 0.0); vec3 gE = eastOf(gc); vec3 gN = cross(gc, gE);
  vec2 q = vec2(dot(d, gE)/0.16, dot(d, gN)/0.105);
  float rr = length(q);
  if (dot(d, gc) > 0.8 && rr < 2.2){
    float ang = atan(q.y, q.x);
    float sp = ang + 2.8*rr;
    vec2 sq = vec2(cos(sp), sin(sp)) * rr;
    float sw = fbm(vec3(sq*3.4, 7.0), 6, 2.0, 0.55);
    float arms = 0.5 + 0.5*sin(ang*2.0 - 8.0*rr + sw*3.5);
    vec3 core = vec3(0.70, 0.31, 0.19);
    vec3 midc = vec3(0.80, 0.45, 0.27);
    vec3 coll = vec3(0.90, 0.67, 0.49);
    vec3 gcol = mix(core, midc, smoothstep(0.05, 0.7, rr) + sw*0.35);
    gcol = mix(gcol, coll, smoothstep(0.62, 0.95, rr)*0.85);
    gcol *= 0.88 + 0.24*arms;
    float m = smoothstep(1.02, 0.88, rr + sw*0.06);
    float hollow = smoothstep(0.98, 1.12, rr) * smoothstep(1.6, 1.25, rr);
    col = mix(col, vec3(0.94, 0.89, 0.79), hollow*0.75);
    col = mix(col, gcol, m);
    hgt += 0.22*m*(1.0 - rr*0.45) + 0.06*(arms - 0.5)*m - 0.05*hollow;
  }
  return vec4(col, sat(hgt));
}

vec3 satBand(float latD){
  vec3 c = vec3(0.70, 0.62, 0.48);
  c = mix(c, vec3(0.78, 0.68, 0.50), smoothstep(-70.0, -66.0, latD));
  c = mix(c, vec3(0.85, 0.75, 0.56), smoothstep(-55.0, -52.0, latD));
  c = mix(c, vec3(0.78, 0.66, 0.47), smoothstep(-42.0, -40.0, latD));
  c = mix(c, vec3(0.87, 0.77, 0.57), smoothstep(-33.0, -31.0, latD));
  c = mix(c, vec3(0.80, 0.68, 0.49), smoothstep(-24.0, -22.0, latD));
  c = mix(c, vec3(0.92, 0.84, 0.66), smoothstep(-14.0, -12.0, latD));
  c = mix(c, vec3(0.95, 0.88, 0.71), smoothstep(-3.0, 0.0, latD));
  c = mix(c, vec3(0.87, 0.77, 0.57), smoothstep(12.0, 14.0, latD));
  c = mix(c, vec3(0.80, 0.69, 0.50), smoothstep(20.0, 22.0, latD));
  c = mix(c, vec3(0.87, 0.78, 0.59), smoothstep(29.0, 31.0, latD));
  c = mix(c, vec3(0.76, 0.68, 0.54), smoothstep(40.0, 42.0, latD));
  c = mix(c, vec3(0.70, 0.68, 0.62), smoothstep(52.0, 56.0, latD));
  c = mix(c, vec3(0.60, 0.64, 0.66), smoothstep(62.0, 68.0, latD));
  return c;
}

vec4 bakeSaturn(vec3 d){
  float latD = degrees(asin(clamp(d.y, -1.0, 1.0)));
  vec3 a = vec3(d.x, d.y*6.0, d.z);
  float t1 = fbm(a*2.0 + 1.0, 5, 2.0, 0.5);
  float t2 = fbm(a*4.0 + t1*1.4, 5, 2.0, 0.5);
  float latW = latD + t2*1.2 + t1*0.8;
  vec3 col = satBand(latW);
  col *= 0.95 + 0.08*fbm(vec3(d.x*3.0, d.y*70.0, d.z*3.0) + t2, 4, 2.0, 0.5);
  float colat = degrees(acos(clamp(d.y, -1.0, 1.0)));
  if (colat < 22.0){
    float phi = atan(d.z, d.x);
    float seg = mod(phi, 1.0471976) - 0.5235988;
    float hexR = 12.0 * 0.8660254 / cos(seg) + t1*0.4;
    float inside = smoothstep(hexR + 0.6, hexR - 0.6, colat);
    col = mix(col, vec3(0.47, 0.53, 0.57), inside*0.85);
    col *= 1.0 + inside*0.06*sin(colat*4.0 + t1*3.0);
    col = mix(col, vec3(0.84, 0.82, 0.74), gauss(colat - hexR, 0.5)*0.6);
    col = mix(col, vec3(0.28, 0.31, 0.36), smoothstep(3.2, 0.6, colat));
  }
  float hgt = 0.5 + 0.25*(dot(col, vec3(0.333)) - 0.75) + 0.05*t2;
  return vec4(col, sat(hgt));
}

vec4 bakeUranus(vec3 d){
  float latD = degrees(asin(clamp(d.y, -1.0, 1.0)));
  float t1 = fbm(vec3(d.x, d.y*3.0, d.z)*2.0, 4, 2.0, 0.5);
  float latW = latD + t1*4.0;
  vec3 col = vec3(0.68, 0.86, 0.89);
  col = mix(col, vec3(0.61, 0.81, 0.85), gauss(abs(latW) - 25.0, 10.0)*0.6);
  col = mix(col, vec3(0.76, 0.91, 0.93), smoothstep(45.0, 72.0, latW));
  col = mix(col, vec3(0.65, 0.84, 0.88), smoothstep(-45.0, -72.0, latW)*0.5);
  col *= 0.992 + 0.012*fbm(vec3(d.x*3.0, d.y*24.0, d.z*3.0) + t1, 3, 2.0, 0.5);
  float cl = smoothstep(0.55, 0.8, fbm(vec3(d.x*4.0, d.y*14.0, d.z*4.0) + 9.0, 4, 2.0, 0.5)) * gauss(abs(latD) - 30.0, 12.0);
  col = mix(col, vec3(0.93, 0.98, 1.0), cl*0.55);
  return vec4(col, 0.5 + 0.2*cl);
}

vec4 bakeNeptune(vec3 d){
  float latD = degrees(asin(clamp(d.y, -1.0, 1.0)));
  vec3 a = vec3(d.x, d.y*5.0, d.z);
  float t1 = fbm(a*2.2 + 5.0, 5, 2.0, 0.5);
  float t2 = fbm(a*4.5 + t1*1.5, 5, 2.0, 0.5);
  float latW = latD + t2*2.5 + t1*1.5;
  vec3 col = vec3(0.25, 0.41, 0.80);
  col = mix(col, vec3(0.30, 0.48, 0.86), gauss(latW, 14.0)*0.6);
  col = mix(col, vec3(0.16, 0.28, 0.64), gauss(latW + 55.0, 7.0)*0.8);
  col = mix(col, vec3(0.20, 0.33, 0.70), gauss(latW - 50.0, 9.0)*0.5);
  col = mix(col, vec3(0.34, 0.52, 0.88), smoothstep(65.0, 85.0, abs(latW))*0.5);
  col *= 0.94 + 0.12*fbm(vec3(d.x*3.0, d.y*45.0, d.z*3.0) + t1, 4, 2.0, 0.5);
  float hgt = 0.5;
  // Great Dark Spot with bright companion clouds
  vec3 gc = dirLL(-20.0, 0.0); vec3 gE = eastOf(gc); vec3 gN = cross(gc, gE);
  vec2 q = vec2(dot(d, gE)/0.17, dot(d, gN)/0.10);
  if (dot(d, gc) > 0.8){
    float sw = fbm(vec3(q*2.5, 3.0), 4, 2.0, 0.5);
    float rr = length(q);
    float m = smoothstep(1.0, 0.65, rr + sw*0.12);
    col = mix(col, vec3(0.09, 0.15, 0.40), m*0.88);
    col = mix(col, vec3(0.20, 0.32, 0.66), gauss(rr - 1.05, 0.12)*0.5);
    vec2 qc = q - vec2(0.25, -1.15);
    float comp = smoothstep(0.6, 0.05, length(qc*vec2(0.55, 1.5)) + sw*0.18);
    col = mix(col, vec3(0.93, 0.96, 1.0), comp*0.9);
    hgt += comp*0.3 - m*0.1;
  }
  { vec3 c = dirLL(-42.0, 120.0); vec3 E = eastOf(c); vec3 N = cross(c, E);
    vec2 s = vec2(dot(d, E)/0.06, dot(d, N)/0.035);
    float m = smoothstep(1.0, 0.25, length(s) + t2*0.25) * step(0.9, dot(d, c));
    col = mix(col, vec3(0.90, 0.94, 1.0), m*0.8); hgt += m*0.2; }
  { vec3 c = dirLL(-55.0, -100.0); vec3 E = eastOf(c); vec3 N = cross(c, E);
    vec2 s = vec2(dot(d, E)/0.07, dot(d, N)/0.045); float r = length(s);
    float k = step(0.9, dot(d, c));
    col = mix(col, vec3(0.10, 0.17, 0.42), smoothstep(1.0, 0.6, r)*0.8*k);
    col = mix(col, vec3(0.85, 0.90, 1.0), smoothstep(0.35, 0.0, r)*0.8*k); }
  float ci = smoothstep(0.52, 0.85, fbm(vec3(d.x*5.0, d.y*28.0, d.z*5.0) + 13.0, 4, 2.0, 0.5)) * (gauss(latD - 28.0, 6.0) + gauss(latD + 30.0, 6.0)*0.7);
  col = mix(col, vec3(0.88, 0.93, 1.0), ci*0.8);
  hgt += ci*0.3;
  return vec4(col, sat(hgt));
}

vec4 bakeMoon(vec3 d){
  float n1 = fbm(d*2.5 + uSeed, 5, 2.0, 0.5);
  float h = 0.0, rays = 0.0; vec2 c;
  float k = uP.x;
  c = craterLayer(d, 2.5, 0.35*k, uSeed + 1.0); h += c.x*0.85; rays += c.y;
  c = craterLayer(d, 5.0, 0.55*k, uSeed + 2.0); h += c.x*0.42; rays += c.y*0.7;
  c = craterLayer(d, 10.0, 0.70*k, uSeed + 3.0); h += c.x*0.21;
  c = craterLayer(d, 20.0, 0.80*k, uSeed + 4.0); h += c.x*0.10;
  c = craterLayer(d, 40.0, 0.85*k, uSeed + 5.0); h += c.x*0.05;
  float tone = smoothstep(-0.45, 0.5, n1 + 0.25*fbm(d*6.0 + uSeed, 4, 2.0, 0.5));
  vec3 col = mix(uColA, uColB, tone);
  col += rays * uP.y * 0.32;
  if (uP.z > 0.5){
    float g = ridged(d*3.0 + uSeed, 4);
    col *= 1.0 - 0.25*smoothstep(0.7, 0.95, g);
    h -= 0.15*smoothstep(0.75, 0.98, g);
  }
  col *= 0.9 + 0.2*sat(h*1.5 + 0.5);
  return vec4(col, sat(0.5 + h*0.5));
}

vec4 bakeIo(vec3 d){
  float latD = degrees(asin(clamp(d.y, -1.0, 1.0)));
  float n1 = fbm(d*3.0 + 2.0, 6, 2.0, 0.5);
  float n2 = fbm(d*7.0 - 5.0, 5, 2.0, 0.5);
  vec3 yel = vec3(0.90, 0.80, 0.42), ora = vec3(0.82, 0.56, 0.29), wht = vec3(0.92, 0.90, 0.78), red = vec3(0.60, 0.30, 0.18);
  vec3 col = mix(yel, ora, smoothstep(-0.1, 0.5, n1));
  col = mix(col, wht, smoothstep(0.25, 0.6, n2)*0.6);
  col = mix(col, red, smoothstep(55.0, 80.0, abs(latD) + n1*10.0)*0.6);
  vec3 q = d*9.0; vec3 ip = floor(q), fp = fract(q);
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++){
    vec3 g = vec3(float(x), float(y), float(z)); vec3 r = hash33(ip + g + 5.0);
    if (r.z > 0.45) continue;
    vec3 c = g + 0.2 + 0.6*hash33(ip + g + 9.0);
    float dd = length(c - fp) / (0.10 + 0.18*r.x);
    col = mix(col, vec3(0.08, 0.06, 0.05), smoothstep(1.0, 0.6, dd));
    col = mix(col, vec3(0.75, 0.36, 0.18), gauss(dd - 1.5, 0.55)*0.5*r.y);
  }
  float pa = degrees(angDist(d, dirLL(-19.0, -105.0)));
  col = mix(col, vec3(0.66, 0.28, 0.16), gauss(pa - 11.0, 2.2)*0.75*(0.7 + 0.3*n2));
  col = mix(col, vec3(0.06, 0.05, 0.04), smoothstep(1.6, 0.8, pa));
  return vec4(col, 0.5 + 0.1*n1);
}

vec4 bakeEuropa(vec3 d){
  float n1 = fbm(d*2.2 + 3.0, 5, 2.0, 0.5);
  vec3 ice = vec3(0.90, 0.87, 0.80), tn = vec3(0.72, 0.58, 0.44), brown = vec3(0.52, 0.34, 0.24);
  vec3 col = mix(ice, tn, smoothstep(0.0, 0.6, n1)*0.75);
  float lines = 0.0;
  for (int i = 0; i < 5; i++){
    float fi = float(i);
    vec3 p = d*(2.4 + fi*1.6) + vec3(fi*7.3, fi*1.9, -fi*4.1);
    float r = 1.0 - abs(snoise(p));
    lines = max(lines, pow(r, 38.0 + fi*12.0) * (1.0 - fi*0.13));
  }
  col = mix(col, brown, lines*0.85);
  float chaos = smoothstep(0.35, 0.6, fbm(d*5.0 + 11.0, 4, 2.0, 0.5));
  col = mix(col, tn*0.9, chaos*0.4);
  vec3 pc = dirLL(-25.0, 90.0); float pa = degrees(angDist(d, pc));
  vec3 v = normalize(cross(pc, d) + 1e-5); float rayN = snoise(v*12.0)*0.5 + 0.5;
  col = mix(col, vec3(0.97, 0.96, 0.93), exp(-pa*0.08)*pow(rayN, 3.0)*0.6 + smoothstep(2.0, 0.5, pa)*0.3);
  return vec4(col, 0.5 + 0.1*lines - 0.05*chaos);
}

vec4 bakeGanymede(vec3 d){
  float n1 = fbm(d*1.8 + 7.0, 5, 2.0, 0.5);
  float region = smoothstep(-0.1, 0.15, n1);
  vec3 dark = vec3(0.38, 0.34, 0.30), bright = vec3(0.68, 0.66, 0.62);
  float gw = fbm(d*3.0, 3, 2.0, 0.5);
  float grooves = 0.5 + 0.5*sin((d.x*30.0 + d.y*18.0 + d.z*25.0) + gw*20.0);
  vec3 col = mix(dark*(0.85 + 0.3*fbm(d*8.0, 4, 2.0, 0.5)), bright*(0.9 + 0.15*grooves), region);
  float h = 0.0, rays = 0.0; vec2 c;
  c = craterLayer(d, 4.0, 0.45, 21.0); h += c.x*0.4; rays += c.y;
  c = craterLayer(d, 9.0, 0.60, 22.0); h += c.x*0.2; rays += c.y*0.6;
  c = craterLayer(d, 20.0, 0.70, 23.0); h += c.x*0.1;
  col += rays*0.28;
  col = mix(col, vec3(0.80, 0.80, 0.82), smoothstep(0.75, 0.92, abs(d.y))*0.6);
  return vec4(col, sat(0.5 + h*0.5 + (grooves - 0.5)*0.05*region));
}

vec4 bakeTitan(vec3 d){
  float latD = degrees(asin(clamp(d.y, -1.0, 1.0)));
  float n = fbm(vec3(d.x, d.y*3.0, d.z)*2.0, 4, 2.0, 0.5);
  vec3 col = vec3(0.84, 0.60, 0.30);
  col = mix(col, vec3(0.78, 0.52, 0.24), gauss(latD, 25.0)*0.3);
  col = mix(col, vec3(0.62, 0.42, 0.24), smoothstep(55.0, 80.0, latD)*0.6);
  col *= 0.96 + 0.06*n;
  return vec4(col, 0.5);
}

vec4 bakeEnceladus(vec3 d){
  float latD = degrees(asin(clamp(d.y, -1.0, 1.0)));
  vec3 col = vec3(0.94, 0.95, 0.96);
  float h = 0.0; vec2 c;
  float north = smoothstep(-20.0, 20.0, latD);
  c = craterLayer(d, 6.0, 0.6*north, 31.0); h += c.x*0.25;
  c = craterLayer(d, 13.0, 0.7*north, 32.0); h += c.x*0.12;
  float fr = ridged(d*4.0 + 3.0, 4);
  col *= 1.0 - 0.06*smoothstep(0.7, 0.95, fr);
  h -= 0.05*smoothstep(0.7, 0.95, fr);
  if (latD < -50.0){
    vec2 p = d.xz;
    vec2 dir = normalize(vec2(0.8, 0.6));
    float across = dot(p, vec2(-dir.y, dir.x));
    float along = dot(p, dir);
    float s = sin(across*45.0 + snoise(d*8.0)*1.2);
    float stripes = smoothstep(0.9, 1.0, s) * smoothstep(0.32, 0.22, abs(across)) * smoothstep(0.42, 0.3, abs(along)) * smoothstep(-55.0, -70.0, latD);
    col = mix(col, vec3(0.52, 0.68, 0.80), stripes*0.85);
    h -= stripes*0.1;
  }
  col *= 0.97 + 0.04*fbm(d*10.0, 3, 2.0, 0.5);
  return vec4(col, sat(0.5 + h*0.5));
}

vec4 bakeIapetus(vec3 d){
  float n1 = fbm(d*2.0 + 4.0, 5, 2.0, 0.5);
  float lead = d.z;
  float darkM = smoothstep(-0.05, 0.25, lead - abs(d.y)*0.55 + n1*0.25);
  vec3 col = mix(vec3(0.82, 0.78, 0.70), vec3(0.24, 0.16, 0.11), darkM);
  float h = 0.0; vec2 c;
  c = craterLayer(d, 3.0, 0.50, 41.0); h += c.x*0.5;
  c = craterLayer(d, 7.0, 0.65, 42.0); h += c.x*0.25;
  c = craterLayer(d, 15.0, 0.75, 43.0); h += c.x*0.12;
  float ridge = gauss(d.y, 0.025) * smoothstep(-0.2, 0.3, lead);
  h += ridge*0.4;
  col *= 0.9 + 0.2*sat(h + 0.5);
  return vec4(col, sat(0.5 + h*0.5));
}

vec4 bakeMiranda(vec3 d){
  vec3 col = vec3(0.56, 0.56, 0.57);
  float h = 0.0; vec2 c;
  c = craterLayer(d, 4.0, 0.50, 51.0); h += c.x*0.35;
  c = craterLayer(d, 9.0, 0.65, 52.0); h += c.x*0.18;
  vec3 cs[3] = vec3[3](dirLL(-40.0, 30.0), dirLL(-25.0, 150.0), dirLL(-30.0, -100.0));
  for (int i = 0; i < 3; i++){
    float a = angDist(d, cs[i]);
    float m = smoothstep(0.75, 0.6, a + 0.1*fbm(d*3.0 + float(i), 3, 2.0, 0.5));
    float rings = 0.5 + 0.5*sin(a*55.0 + fbm(d*6.0, 3, 2.0, 0.5)*2.0);
    col = mix(col, mix(vec3(0.40, 0.40, 0.41), vec3(0.74, 0.74, 0.74), rings), m*0.8);
    h += m*(rings - 0.5)*0.1 - m*0.05;
  }
  return vec4(col, sat(0.5 + h*0.5));
}

vec4 bakeTriton(vec3 d){
  float latD = degrees(asin(clamp(d.y, -1.0, 1.0)));
  float n1 = fbm(d*3.0 + 8.0, 5, 2.0, 0.5);
  vec3 col = vec3(0.74, 0.66, 0.60);
  vec2 v = voronoi(d*14.0);
  float cell = smoothstep(0.0, 0.12, v.y - v.x);
  float cant = smoothstep(-25.0, 0.0, latD);
  col = mix(col, vec3(0.62, 0.63, 0.56)*(0.85 + 0.2*cell), cant*0.7);
  float cap = smoothstep(-10.0, -25.0, latD + n1*8.0);
  float streak = smoothstep(0.55, 0.8, fbm(vec3(d.x*30.0, d.y*6.0, d.z*4.0), 4, 2.0, 0.5)) * cap;
  col = mix(col, vec3(0.93, 0.85, 0.80), cap);
  col = mix(col, vec3(0.36, 0.29, 0.26), streak*0.7);
  return vec4(col, 0.5 + 0.08*(cell - 0.5)*cant);
}

void main(){
  vec3 d = normalize(vDir);
  int k = int(uKind + 0.5);
  vec4 o;
  if (k == 1) o = bakeMercury(d);
  else if (k == 2) o = bakeVenus(d);
  else if (k == 3) o = bakeMars(d);
  else if (k == 4) o = bakeJupiter(d);
  else if (k == 5) o = bakeSaturn(d);
  else if (k == 6) o = bakeUranus(d);
  else if (k == 7) o = bakeNeptune(d);
  else if (k == 11) o = bakeIo(d);
  else if (k == 12) o = bakeEuropa(d);
  else if (k == 13) o = bakeGanymede(d);
  else if (k == 14) o = bakeTitan(d);
  else if (k == 15) o = bakeEnceladus(d);
  else if (k == 16) o = bakeIapetus(d);
  else if (k == 17) o = bakeMiranda(d);
  else if (k == 18) o = bakeTriton(d);
  else o = bakeMoon(d);
  gl_FragColor = vec4(clamp(o.rgb, 0.0, 1.0), clamp(o.a, 0.0, 1.0));
}
`;

export const SKY_BAKE_FRAG = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform vec3 uGalN, uGalC, uLMC, uSMC, uM31;
${NOISE}
float blob(vec3 d, vec3 c, float r){ float a = angDist(d, c); return exp(-(a*a)/(r*r)); }
void main(){
  vec3 d = normalize(vDir);
  float b = asin(clamp(dot(d, uGalN), -1.0, 1.0));
  vec3 E = normalize(cross(uGalN, uGalC));
  float l = atan(dot(d, E), dot(d, uGalC));
  float bulge = exp(-pow(l/0.6, 2.0));
  float width = 0.10 + 0.12*bulge;
  float band = exp(-pow((b + 0.012*sin(l*2.0))/width, 2.0));
  float clouds = fbm(d*4.0, 6, 2.0, 0.5)*0.5 + 0.5;
  float fine = fbm(d*16.0, 5, 2.0, 0.55)*0.5 + 0.5;
  float mw = band * (0.3 + 0.7*clouds) * (0.55 + 0.45*fine) * (0.55 + 1.1*bulge);
  float lane = smoothstep(0.45, 0.78, fbm(d*7.0 + 3.0, 5, 2.0, 0.5)*0.5 + 0.5) * exp(-pow((b - 0.015*sin(l*3.0))/(0.04 + 0.035*bulge), 2.0));
  mw *= 1.0 - 0.8*lane;
  vec3 col = vec3(0.0035, 0.0045, 0.010);
  vec3 mwCol = mix(vec3(0.60, 0.66, 0.82), vec3(1.0, 0.86, 0.68), sat(bulge*0.8 + clouds*0.2));
  col += mwCol * mw * 0.10;
  float halo = exp(-pow(b/0.5, 2.0)) * (0.4 + 0.6*bulge);
  col += vec3(0.20, 0.22, 0.30) * halo * 0.012;
  float neb = pow(max(fbm(d*2.5 + 11.0, 5, 2.0, 0.5), 0.0), 2.0) * exp(-pow(b/0.22, 2.0));
  col += vec3(0.55, 0.20, 0.28) * neb * 0.05;
  float neb2 = pow(max(fbm(d*1.6 - 7.0, 5, 2.0, 0.5), 0.0), 2.6);
  col += vec3(0.10, 0.20, 0.42) * neb2 * 0.03;
  float neb3 = pow(max(fbm(d*2.2 + 23.0, 5, 2.0, 0.5), 0.0), 3.0);
  col += vec3(0.30, 0.16, 0.38) * neb3 * 0.02;
  col += vec3(0.72, 0.74, 0.86) * blob(d, uLMC, 0.075) * (0.6 + 0.4*fine) * 0.05;
  col += vec3(0.72, 0.74, 0.86) * blob(d, uSMC, 0.04) * (0.6 + 0.4*fine) * 0.035;
  { vec3 E2 = eastOf(uM31); vec3 N2 = cross(uM31, E2);
    vec2 q = vec2(dot(d, E2)/0.05, dot(d, N2)/0.016);
    float r = length(vec2(q.x*0.8 + q.y*0.6, -q.x*0.6 + q.y*0.8));
    col += vec3(0.85, 0.80, 0.75) * exp(-r*r) * step(0.9, dot(d, uM31)) * 0.04; }
  vec3 q = d*620.0; float hs = hash13(floor(q));
  float star = step(0.9965 - band*0.004, hs) * pow(hash13(floor(q) + 3.0), 6.0);
  col += vec3(0.8, 0.85, 1.0) * star * 0.25;
  gl_FragColor = vec4(pow(col, vec3(1.0/2.2)), 1.0);
}
`;

// ---------------------------------------------------------------- runtime
export const BODY_VERT = /* glsl */`
varying vec3 vObj;
varying vec3 vWorld;
varying vec2 vUv;
void main(){
  vObj = position;
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const LIGHT_UNIFORMS = /* glsl */`
uniform mat4 modelMatrix;
uniform vec3 uSunColor;
uniform float uSunI;
uniform float uAmbient;
uniform vec3 uInvScale2;
`;

export const ROCKY_FRAG = /* glsl */`
precision highp float;
varying vec3 vObj; varying vec3 vWorld; varying vec2 vUv;
uniform samplerCube uMap;
uniform sampler2D uEqMap;
uniform vec2 uEqSize;
uniform float uBump, uLunar, uTexel, uDetail, uTime, uDust, uHaze;
uniform vec3 uHazeColor;
${LIGHT_UNIFORMS}
${NOISE}
${SHADOW}
vec4 surf(vec3 d){
#ifdef EQUIRECT
  vec4 c = texture2D(uEqMap, vUv); c.a = dot(c.rgb, vec3(0.3, 0.59, 0.11)); return c;
#else
  return textureCube(uMap, d);
#endif
}
void main(){
  vec3 n = normalize(vObj);
  vec4 s0 = surf(n);
  vec3 T = eastOf(n); vec3 B = cross(n, T);
  vec3 g;
#ifdef EQUIRECT
  float cl = max(sqrt(1.0 - n.y*n.y), 0.05);
  vec2 du = vec2(1.0/uEqSize.x, 0.0), dv = vec2(0.0, 1.0/uEqSize.y);
  float hE = dot(texture2D(uEqMap, vUv + du).rgb, vec3(0.3, 0.59, 0.11));
  float hN = dot(texture2D(uEqMap, vUv + dv).rgb, vec3(0.3, 0.59, 0.11));
  g = (hE - s0.a)/(du.x*6.2831853*cl) * T + (hN - s0.a)/(dv.y*3.14159265) * B;
#else
  float e = uTexel;
  float hT = textureCube(uMap, normalize(n + T*e)).a;
  float hB = textureCube(uMap, normalize(n + B*e)).a;
  g = ((hT - s0.a)*T + (hB - s0.a)*B) / e;
#endif
  vec3 nb = normalize(n - uBump * g);
  vec3 alb = pow(s0.rgb, vec3(2.2));
  if (uDetail > 0.01){
    vec3 p = n * 90.0;
    float d0 = snoise(p), dx = snoise(p + T*0.6), dy = snoise(p + B*0.6);
    float d1 = snoise(p*3.1), dx1 = snoise(p*3.1 + T*0.6), dy1 = snoise(p*3.1 + B*0.6);
    vec3 gd = ((dx - d0) + 0.5*(dx1 - d1))*T + ((dy - d0) + 0.5*(dy1 - d1))*B;
    nb = normalize(nb - uDetail * 0.012 * gd / 0.6 * 6.0);
    alb *= 1.0 + uDetail*0.07*(d0 + 0.5*d1);
  }
  float dust = 0.0;
  if (uDust > 0.0){
    float dn = fbm(n*2.2 + vec3(uTime*0.012, 0.0, -uTime*0.008), 4, 2.0, 0.5);
    float dn2 = fbm(n*6.0 + vec3(dn*1.5) + uTime*0.02, 3, 2.0, 0.5);
    dust = smoothstep(0.15, 0.6, dn + 0.25*dn2) * uDust;
    alb = mix(alb, pow(vec3(0.80, 0.56, 0.38), vec3(2.2)), dust*0.55);
    nb = normalize(mix(nb, n, dust*0.7));
  }
  vec3 Ng = normalize(mat3(modelMatrix) * (n * uInvScale2));
  vec3 Nb = normalize(mat3(modelMatrix) * (nb * uInvScale2));
  vec3 L = normalize(-vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  float mu0 = max(dot(Nb, L), 0.0);
  float mu = max(dot(Ng, V), 0.0);
  float ls = 2.0*mu0/(mu0 + mu + 1e-4);
  float diff = mix(mu0, min(ls*0.62, 1.3), uLunar);
  diff *= smoothstep(-0.10, 0.06, dot(Ng, L));
  float shadow = sphereShadow(vWorld);
  vec3 col = alb * (uSunColor * uSunI * diff * shadow + uAmbient);
  if (uHaze > 0.0){
    float fres = pow(1.0 - mu, 2.5);
    float lit = smoothstep(-0.25, 0.45, dot(Ng, L));
    col += uHazeColor * fres * uHaze * lit * shadow * uSunI;
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

export const GAS_FRAG = /* glsl */`
precision highp float;
varying vec3 vObj; varying vec3 vWorld; varying vec2 vUv;
uniform samplerCube uMap;
uniform float uTime, uFlowAmp, uJets, uPeriod, uTurb, uRefLat;
uniform float uHasStorm, uStormSpin;
uniform vec3 uStormC, uStormE, uStormN;
uniform vec2 uStormAB;
uniform float uLimb, uHaze, uBump, uWrap;
uniform vec3 uHazeColor;
uniform float uHasRing;
uniform sampler2D uRingTex;
uniform vec2 uRingRange;
uniform vec3 uRingN, uCenter;
uniform float uRadiusW;
${LIGHT_UNIFORMS}
${NOISE}
${SHADOW}
float zonal(float lat){ return uFlowAmp * sin(lat * uJets) * cos(lat); }
vec3 rotY(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(c*v.x - s*v.z, v.y, s*v.x + c*v.z); }
vec3 swirl(vec3 d, float tau){
  if (uHasStorm < 0.5) return d;
  float z = dot(d, uStormC);
  if (z < 0.8) return d;
  vec2 q = vec2(dot(d, uStormE)/uStormAB.x, dot(d, uStormN)/uStormAB.y);
  float r = length(q);
  if (r > 1.6) return d;
  float w = uStormSpin * smoothstep(1.6, 0.2, r) * (0.55 + 0.45*smoothstep(0.0, 0.8, r));
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
  vec3 turb = vec3(tA, (tA + tB)*0.18, tB) * uTurb;
  vec3 d0 = normalize(swirl(rotY(n, sp*tau0), tau0) + turb);
  vec3 d1 = normalize(swirl(rotY(n, sp*tau1), tau1) + turb);
  vec4 c = textureCube(uMap, d0)*w0 + textureCube(uMap, d1)*(1.0 - w0);
  // high-altitude haze streaks drifting on their own wind
  float hz = snoise(vec3(n.x*2.5, n.y*22.0, n.z*2.5) + vec3(uTime*0.02, 0.0, -uTime*0.015));
  vec3 alb = pow(c.rgb, vec3(2.2));
  alb *= 1.0 + 0.05*hz;
  vec3 Ng = normalize(mat3(modelMatrix) * (n * uInvScale2));
  float hgt = c.a + 0.08*hz;
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
        vec3 H = vWorld + L*t;
        float r = length(H - uCenter) / uRadiusW;
        float u = (r - uRingRange.x) / (uRingRange.y - uRingRange.x);
        if (u > 0.0 && u < 1.0){
          float bl = t * 0.035 / uRadiusW / (uRingRange.y - uRingRange.x);
          float a = (texture2D(uRingTex, vec2(u, 0.5)).a + texture2D(uRingTex, vec2(u + bl, 0.5)).a + texture2D(uRingTex, vec2(u - bl, 0.5)).a) / 3.0;
          shadow *= 1.0 - a*0.92;
        }
      }
    }
  }
  vec3 col = alb * (uSunColor * uSunI * diff * limb * shadow + uAmbient);
  float fres = pow(1.0 - NdV, 2.6);
  col += uHazeColor * fres * uHaze * smoothstep(-0.25, 0.5, dot(Ng, L)) * 0.35 * shadow * uSunI;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const EARTH_FRAG = /* glsl */`
precision highp float;
varying vec3 vObj; varying vec3 vWorld; varying vec2 vUv;
uniform sampler2D uDay, uNight, uData;
uniform float uCloudShift, uTexW, uDetail;
${LIGHT_UNIFORMS}
${NOISE}
${SHADOW}
void main(){
  vec3 n = normalize(vObj);
  vec2 uv = vUv;
  vec3 day = pow(texture2D(uDay, uv).rgb, vec3(2.2));
  vec3 night = pow(texture2D(uNight, uv).rgb, vec3(2.2));
  vec4 data = texture2D(uData, uv);
  float ocean = 1.0 - smoothstep(0.25, 0.6, data.g);
  float cl = max(sqrt(1.0 - n.y*n.y), 0.05);
  vec3 T = eastOf(n); vec3 B = cross(n, T);
  float du = 1.0/uTexW, dv = 2.0/uTexW;
  float hE = texture2D(uData, uv + vec2(du, 0.0)).r;
  float hN = texture2D(uData, uv + vec2(0.0, dv)).r;
  float gE = (hE - data.r)/(du*6.2831853*cl);
  float gN = (hN - data.r)/(dv*3.14159265);
  vec3 nb = normalize(n - 0.010*(gE*T + gN*B)*(1.0 - ocean));
  vec3 Ng = normalize(mat3(modelMatrix) * n);
  vec3 Nw = normalize(mat3(modelMatrix) * nb);
  vec3 L = normalize(-vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 Lo = normalize(transpose(mat3(modelMatrix)) * L);
  float NgL = dot(Ng, L);
  float dayF = smoothstep(-0.10, 0.16, NgL);
  float diff = max(dot(Nw, L), 0.0) * smoothstep(-0.08, 0.05, NgL);
  vec2 cuv = vec2(uv.x - uCloudShift, uv.y);
  vec2 off = vec2(dot(Lo, T)/(6.2831853*cl), dot(Lo, B)/3.14159265) * 0.0035;
  float cShadow = texture2D(uData, cuv - off).b;
  float cHere = texture2D(uData, cuv).b;
  float shadow = sphereShadow(vWorld);
  vec3 alb = mix(day, day*vec3(0.42, 0.60, 0.86), ocean*0.75);
  vec3 col = alb * uSunColor * uSunI * diff * shadow * (1.0 - 0.5*smoothstep(0.15, 0.9, cShadow));
  float twi = smoothstep(-0.18, 0.0, NgL) * smoothstep(0.28, 0.0, NgL);
  col += alb * vec3(1.0, 0.42, 0.18) * twi * 0.05 * shadow;
  vec3 H = normalize(L + V);
  float NdH = max(dot(Ng, H), 0.0);
  float fres = 0.02 + 0.98*pow(1.0 - max(dot(Ng, V), 0.0), 5.0);
  float spec = (pow(NdH, 220.0)*1.1 + pow(NdH, 24.0)*0.035) * ocean * dayF * (0.45 + fres) * (1.0 - 0.8*cHere);
  col += vec3(1.0, 0.94, 0.82) * spec * uSunI * shadow;
  col += night * vec3(1.0, 0.80, 0.52) * 2.4 * (1.0 - dayF) * (1.0 - cHere*0.85);
  float rim = pow(1.0 - max(dot(Ng, V), 0.0), 2.6);
  float litRim = smoothstep(-0.3, 0.45, NgL);
  col = mix(col, vec3(0.30, 0.52, 1.0)*0.55*uSunI*shadow, rim*0.55*litRim);
  col += alb * uAmbient;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const CLOUD_FRAG = /* glsl */`
precision highp float;
varying vec3 vObj; varying vec3 vWorld; varying vec2 vUv;
uniform sampler2D uData;
uniform float uTexW;
${LIGHT_UNIFORMS}
${NOISE}
${SHADOW}
void main(){
  vec3 n = normalize(vObj);
  float c0 = texture2D(uData, vUv).b;
  float c = smoothstep(0.12, 0.85, c0);
  if (c < 0.01) discard;
  float cl = max(sqrt(1.0 - n.y*n.y), 0.05);
  float du = 1.0/uTexW, dv = 2.0/uTexW;
  float cE = texture2D(uData, vUv + vec2(du, 0.0)).b;
  float cN = texture2D(uData, vUv + vec2(0.0, dv)).b;
  vec3 T = eastOf(n); vec3 B = cross(n, T);
  vec3 nb = normalize(n - 0.006*((cE - c0)/(du*6.2831853*cl)*T + (cN - c0)/(dv*3.14159265)*B));
  vec3 Ng = normalize(mat3(modelMatrix) * n);
  vec3 Nb = normalize(mat3(modelMatrix) * nb);
  vec3 L = normalize(-vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  float NgL = dot(Ng, L);
  float diff = smoothstep(-0.12, 0.25, NgL) * (0.35 + 0.65*max(dot(Nb, L), 0.0));
  float twi = smoothstep(-0.15, 0.02, NgL) * smoothstep(0.3, 0.02, NgL);
  float shadow = sphereShadow(vWorld);
  vec3 col = vec3(1.0, 0.99, 0.97) * mix(vec3(1.0), vec3(1.0, 0.55, 0.3), twi*0.85) * diff * uSunI * shadow * 0.95;
  col += vec3(0.6, 0.65, 0.8) * uAmbient;
  float rim = pow(1.0 - max(dot(Ng, V), 0.0), 2.0);
  float a = c * (0.88 + 0.12*rim);
  gl_FragColor = vec4(col, a);
}
`;

export const ATMO_VERT = /* glsl */`
varying vec3 vWorld;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
`;

export const ATMO_FRAG = /* glsl */`
precision highp float;
varying vec3 vWorld;
uniform vec3 uColor, uSunset, uCenter, uAxis;
uniform float uR, uShell, uIntensity, uDensity, uSunI, uFlat;
void main(){
  vec3 ro = cameraPosition; vec3 rd = normalize(vWorld - ro);
  float tc = max(dot(uCenter - ro, rd), 0.0);
  vec3 P = ro + rd*tc;
  vec3 rel = P - uCenter;
  rel += uAxis * dot(rel, uAxis) * (uFlat - 1.0);
  float b = length(rel);
  float H = (uShell - uR) * 0.24;
  float hgt = max(b - uR, 0.0) / H;
  float dens = exp(-hgt) * (1.0 - smoothstep(uShell*0.96, uShell, b));
  dens *= mix(1.0, 1.6, smoothstep(0.0, -0.02*uR, b - uR));
  vec3 up = normalize(rel);
  vec3 Ld = normalize(-P);
  float sd = dot(up, Ld);
  float lit = smoothstep(-0.35, 0.25, sd);
  float sunset = smoothstep(-0.35, 0.0, sd) * (1.0 - smoothstep(0.0, 0.4, sd));
  float fwd = pow(max(dot(rd, Ld), 0.0), 6.0);
  vec3 col = mix(uColor, uSunset, sunset*0.65) * lit * dens * (1.0 + 2.5*fwd) * uDensity;
  gl_FragColor = vec4(col * uIntensity * uSunI, 1.0);
}
`;

export const RING_VERT = /* glsl */`
varying vec3 vWorld; varying vec3 vLocal;
void main(){ vLocal = position; vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
`;

export const RING_FRAG = /* glsl */`
precision highp float;
varying vec3 vWorld; varying vec3 vLocal;
uniform sampler2D uRingTex;
uniform vec2 uRange;
uniform vec3 uCenter, uN;
uniform float uR, uTime, uSpokes, uSunI, uOpacity;
${NOISE}
void main(){
  float r = length(vLocal.xy);
  float u = (r - uRange.x) / (uRange.y - uRange.x);
  if (u < 0.0 || u > 1.0) discard;
  vec4 tex = texture2D(uRingTex, vec2(u, 0.5));
  float alpha = tex.a;
  float th = atan(vLocal.y, vLocal.x);
  float tt = th - 0.35*pow(r, -1.5)*uTime;
  float rf = r*90.0;
  float aa = 1.0 - smoothstep(0.15, 0.5, fwidth(rf));
  float clump = snoise(vec3(cos(tt)*1.6, sin(tt)*1.6, rf));
  alpha *= 1.0 + 0.08*clump*aa;
  vec3 L = normalize(-vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  float sL = dot(L, uN), sV = dot(V, uN);
  if (uSpokes > 0.0){
    float ts = th - 0.18*uTime;
    float sk = snoise(vec3(cos(ts)*4.0, sin(ts)*4.0, uTime*0.03)) * 0.5 + 0.5;
    float spokes = smoothstep(0.72, 0.95, sk) * smoothstep(1.66, 1.74, r) * smoothstep(1.93, 1.86, r);
    alpha *= 1.0 - (sL*sV > 0.0 ? 0.06 : -0.08) * spokes * uSpokes;
  }
  alpha = clamp(alpha, 0.0, 1.0);
  vec3 rel = vWorld - uCenter;
  float proj = dot(rel, L);
  float shadow = 1.0;
  if (proj < 0.0){
    float perp = length(rel - L*proj);
    float pen = 0.04*uR + (-proj)*0.03;
    shadow = smoothstep(uR - pen, uR + pen*0.5, perp);
  }
  vec3 alb = pow(tex.rgb, vec3(2.2));
  float phase = pow(max(dot(-V, L), 0.0), 8.0);
  float incid = mix(0.42, 1.0, sqrt(abs(sL)));
  vec3 col;
  if (sL*sV > 0.0) col = alb * incid * (1.05 + 0.8*phase*(1.0 - alpha));
  else col = alb * (alpha*(1.0 - alpha)*2.4 + phase*(1.0 - alpha)*1.4) * 0.8;
  col *= shadow * uSunI;
  col += alb * 0.015;
  gl_FragColor = vec4(col, alpha * uOpacity);
}
`;

export const SUN_VERT = /* glsl */`
varying vec3 vObj; varying vec3 vWorld; varying vec3 vNormalW;
void main(){
  vObj = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const SUN_FRAG = /* glsl */`
precision highp float;
varying vec3 vObj; varying vec3 vWorld; varying vec3 vNormalW;
uniform float uTime, uIntensity;
${NOISE}
vec2 vorAnim(vec3 p, float t){
  vec3 ip = floor(p), fp = fract(p); float f1 = 8.0, f2 = 8.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++){
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 h = hash33(ip + g);
    vec3 o = 0.5 + 0.38*sin(t + 6.2831*h);
    vec3 r = g + o - fp; float d = dot(r, r);
    if (d < f1){ f2 = f1; f1 = d; } else if (d < f2){ f2 = d; }
  }
  return vec2(sqrt(f1), sqrt(f2));
}
void main(){
  vec3 n = normalize(vObj);
  vec3 V = normalize(cameraPosition - vWorld);
  float mu = max(dot(normalize(vNormalW), V), 0.0);
  float t = uTime;
  float flow = fbm(n*2.6 + vec3(t*0.012, -t*0.009, t*0.007), 4, 2.0, 0.5);
  float flow2 = fbm(n*6.5 + vec3(flow*1.6) + vec3(0.0, t*0.02, 0.0), 4, 2.0, 0.5);
  vec3 wp = n*34.0 + vec3(flow*0.9, flow2*0.6, -flow*0.7);
  vec2 g1 = vorAnim(wp, t*0.35);
  float gran = smoothstep(0.0, 0.42, g1.y - g1.x);
  vec2 g2 = vorAnim(n*95.0 + flow2*2.0, t*0.6);
  float gran2 = smoothstep(0.0, 0.35, g2.y - g2.x);
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float band = smoothstep(0.10, 0.22, abs(lat)) * smoothstep(0.62, 0.42, abs(lat));
  float spotN = snoise(n*2.3 + vec3(0.0, 0.0, t*0.003))*0.65 + snoise(n*6.0 + 3.0)*0.35;
  float umbra = smoothstep(0.60, 0.68, spotN) * band;
  float pen = smoothstep(0.47, 0.60, spotN) * band;
  float fil = 0.5 + 0.5*sin(atan(n.z, n.x)*220.0 + flow2*12.0);
  float fac = smoothstep(0.30, 0.47, spotN) * band * (1.0 - pen) * pow(1.0 - mu, 1.2);
  float I = 0.54 + 0.40*gran + 0.12*gran2 + 0.12*flow2;
  I *= 1.0 - pen*(0.45 + 0.15*fil) - umbra*0.45;
  I += fac*0.35;
  float limb = 1.0 - 0.66*(1.0 - pow(mu, 0.55));
  vec3 hot = vec3(1.0, 0.76, 0.42), warm = vec3(1.0, 0.47, 0.12), deep = vec3(0.78, 0.20, 0.03);
  vec3 col = mix(warm, hot, sat(limb*I*1.2 - 0.25));
  col = mix(deep, col, smoothstep(0.08, 0.55, limb*I));
  float plasma = smoothstep(0.2, 0.7, flow*0.5 + 0.5);
  col *= 1.0 + 0.10*plasma;
  gl_FragColor = vec4(col * I * limb * uIntensity, 1.0);
}
`;

export const BILLBOARD_VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv*2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export const CORONA_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform float uTime, uScale, uIntensity;
${NOISE}
void main(){
  vec2 p = vUv * uScale;
  float r = length(p);
  if (r < 0.985) discard;
  float a = atan(p.y, p.x);
  float x = r - 1.0;
  float glow = 0.55*exp(-x*4.5) + 0.12*exp(-x*1.5) + 0.018*exp(-x*0.45);
  float st = fbm(vec3(cos(a)*2.6, sin(a)*2.6, x*0.35 - uTime*0.015), 4, 2.0, 0.5)*0.5 + 0.5;
  float st2 = snoise(vec3(cos(a)*9.0, sin(a)*9.0, x*0.9 - uTime*0.04))*0.5 + 0.5;
  float streamers = pow(st, 2.4)*exp(-x*1.0)*0.55 + pow(st2, 3.0)*exp(-x*2.2)*0.35;
  float spic = snoise(vec3(cos(a)*80.0, sin(a)*80.0, uTime*0.3))*0.5 + 0.5;
  float chrom = exp(-pow(x/0.018, 2.0)) * (0.6 + 0.6*spic);
  vec3 col = vec3(1.0, 0.76, 0.48)*glow + vec3(1.0, 0.86, 0.68)*streamers*0.55 + vec3(1.0, 0.35, 0.18)*chrom*0.9;
  col *= smoothstep(0.985, 1.005, r) * (1.0 - smoothstep(uScale*0.6, uScale, r));
  gl_FragColor = vec4(col * uIntensity, 1.0);
}
`;

export const PROM_VERT = /* glsl */`
varying vec2 vUv; varying vec3 vWorld; varying vec3 vNormalW;
void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; vNormalW = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }
`;

export const PROM_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv; varying vec3 vWorld; varying vec3 vNormalW;
uniform float uTime, uSeed, uFade, uIntensity, uSunR;
${NOISE}
void main(){
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 D = -V;
  float tc = dot(-cameraPosition, D);
  float bd = sqrt(max(dot(cameraPosition, cameraPosition) - tc*tc, 0.0));
  float disk = (1.0 - smoothstep(uSunR*0.97, uSunR*1.01, bd)) * step(length(vWorld - cameraPosition), tc);
  float facing = abs(dot(normalize(vNormalW), V));
  float core = pow(facing, 1.6);
  float along = vUv.x;
  float n = fbm(vec3(along*9.0 - uTime*0.12 + uSeed, vUv.y*2.5, uTime*0.05 + uSeed), 4, 2.0, 0.5)*0.5 + 0.5;
  float fil = smoothstep(0.32, 0.82, n);
  float ends = smoothstep(0.0, 0.06, along) * smoothstep(1.0, 0.94, along);
  vec3 col = mix(vec3(1.0, 0.30, 0.10), vec3(1.0, 0.72, 0.42), fil) * (0.25 + 1.6*fil) * core * ends * uFade * (1.0 - 0.88*disk);
  gl_FragColor = vec4(col * uIntensity, 1.0);
}
`;

export const ORBIT_VERT = /* glsl */`
attribute vec3 aTangent;
attribute float aSide;
attribute float aPhase;
uniform float uPx, uWidth;
varying float vSide; varying float vPhase; varying float vDist;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec3 toCam = cameraPosition - wp.xyz;
  float dist = length(toCam);
  vec3 tw = normalize(mat3(modelMatrix) * aTangent);
  vec3 side = normalize(cross(tw, toCam / dist));
  wp.xyz += side * aSide * uWidth * uPx * dist * 0.5;
  vSide = aSide; vPhase = aPhase; vDist = dist;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const ORBIT_FRAG = /* glsl */`
precision highp float;
varying float vSide; varying float vPhase; varying float vDist;
uniform vec3 uColor;
uniform float uPhase, uAlpha, uHighlight, uNear, uDim;
void main(){
  float trail = fract(uPhase - vPhase);
  float tail = pow(1.0 - trail, 5.0);
  float edge = 1.0 - smoothstep(0.15, 1.0, abs(vSide));
  float a = (uAlpha + 0.5*tail + uHighlight*0.28) * edge * uDim;
  a *= smoothstep(uNear*0.6, uNear*2.2, vDist);
  gl_FragColor = vec4(uColor, a);
}
`;

export const STAR_VERT = /* glsl */`
attribute float aSize;
attribute vec3 aColor;
attribute float aTw;
uniform float uTime, uPR;
varying vec3 vColor; varying float vB;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 1.0 + aTw * 0.35 * sin(uTime * (1.3 + aTw*2.7) + position.x * 0.01);
  vB = tw;
  vColor = aColor;
  gl_PointSize = aSize * uPR;
}
`;

export const STAR_FRAG = /* glsl */`
precision highp float;
varying vec3 vColor; varying float vB;
void main(){
  vec2 c = gl_PointCoord*2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float core = exp(-r2*7.0);
  gl_FragColor = vec4(vColor * core * vB, 1.0);
}
`;

export const BELT_VERT = /* glsl */`
attribute float aA;
attribute float aTheta;
attribute float aRate;
attribute float aIncl;
attribute float aNode;
attribute float aSize;
attribute float aBright;
uniform float uDays, uPR;
varying float vB; varying float vLit;
void main(){
  float th = aTheta + aRate * uDays;
  vec3 p = vec3(aA*cos(th), aA*sin(aIncl)*sin(th - aNode), -aA*sin(th));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = -mv.z;
  gl_PointSize = clamp(aSize * uPR * (0.6 + 40.0/dist), 1.0, 3.5*uPR);
  vB = aBright * (0.25 + 0.75*smoothstep(1500.0, 60.0, dist));
}
`;

export const BELT_FRAG = /* glsl */`
precision highp float;
varying float vB;
uniform vec3 uColor;
uniform float uAlpha;
void main(){
  vec2 c = gl_PointCoord*2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float a = exp(-r2*3.0) * vB * uAlpha;
  gl_FragColor = vec4(uColor, a);
}
`;

export const DUST_VERT = /* glsl */`
uniform vec3 uCam;
uniform float uBox, uPR, uAlpha;
varying float vA;
void main(){
  vec3 p = position * uBox;
  vec3 rel = mod(p - uCam, uBox) - uBox*0.5;
  vec3 wp = uCam + rel;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = length(rel) / (uBox*0.5);
  vA = uAlpha * (1.0 - smoothstep(0.55, 1.0, d)) * smoothstep(0.02, 0.12, d);
  gl_PointSize = clamp(uBox*0.035/max(-mv.z, 0.001), 0.6, 2.4) * uPR;
}
`;

export const DUST_FRAG = /* glsl */`
precision highp float;
varying float vA;
void main(){
  vec2 c = gl_PointCoord*2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  gl_FragColor = vec4(vec3(0.85, 0.80, 0.72), exp(-r2*3.0) * vA);
}
`;

export const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main(){ vDir = position; vec4 wp = modelMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * viewMatrix * wp; }
`;

export const SKY_FRAG = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform samplerCube uSky;
uniform float uIntensity;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec3 c = textureCube(uSky, normalize(vDir)).rgb;
  c = pow(c, vec3(2.2)) * uIntensity;
  c += (hash12(gl_FragCoord.xy) - 0.5) * 0.0012;
  gl_FragColor = vec4(max(c, 0.0), 1.0);
}
`;

export const POST_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tDiffuse;
uniform float uTime, uVignette, uWarp;
uniform vec2 uRes;
varying vec2 vUv;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec2 uv = vUv; vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  vec2 off = c * r2 * (0.0025 + uWarp*0.03);
  vec3 col;
  col.r = texture2D(tDiffuse, uv - off).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv + off).b;
  col *= 1.0 - uVignette * smoothstep(0.1, 0.75, r2*1.6);
  float g = hash12(uv*uRes + fract(uTime*7.13)*317.0) - 0.5;
  col += g * 0.010 * (col + 0.015);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const POST_VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
