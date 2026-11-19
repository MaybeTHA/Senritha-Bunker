// Builders for the high-detail planets, atmospheres and ring systems.
import * as THREE from 'three';
import * as S from './shaders.js';
import * as H from './shaders-hd.js';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Direction in a texture's object space for a geographic lat/lon (three.js sphere UV convention, lon 0 at map centre).
export function geoDir(latDeg, lonDeg) {
  const la = latDeg * DEG, phi = (lonDeg / 360 + 0.5) * TAU;
  return new THREE.Vector3(-Math.cos(phi) * Math.cos(la), Math.sin(la), Math.sin(phi) * Math.cos(la));
}

const geoCache = {};
function sphere(w, h) { const k = w + 'x' + h; return geoCache[k] ||= new THREE.SphereGeometry(1, w, h); }

function lodFor(material, R, hi, mobile) {
  const lod = new THREE.LOD();
  const top = mobile ? [256, 128] : hi;
  lod.addLevel(new THREE.Mesh(sphere(top[0], top[1]), material), 0);
  lod.addLevel(new THREE.Mesh(sphere(160, 96), material), R * 9);
  lod.addLevel(new THREE.Mesh(sphere(64, 40), material), R * 40);
  lod.addLevel(new THREE.Mesh(sphere(28, 18), material), R * 160);
  return lod;
}

// ---------------------------------------------------------------- materials
export function terrainMaterial(world, texId, hd, L) {
  const uniforms = {
    ...L,
    uColor: { value: null }, uTerrain: { value: null },
    uDisp: { value: hd.disp }, uH0: { value: hd.h0 }, uHRange: { value: hd.disp * 0.6 },
    uNormalScale: { value: hd.normal ?? 1 }, uLunar: { value: hd.lunar ?? 0.4 }, uShadowLen: { value: hd.shadowLen ?? 0.07 },
    uAO: { value: hd.ao ?? 5 }, uDetail: { value: 0 }, uTime: { value: 0 }, uDust: { value: hd.dust ? 1 : 0 }, uDustGlobal: { value: 0 },
    uTint: { value: hd.tint ?? 0 }, uMode: { value: hd.mode ?? 0 }, uFalse: { value: 0 },
    uHaze: { value: hd.haze ?? 0 }, uHazeColor: { value: new THREE.Color(...(hd.hazeColor || [0, 0, 0])) },
    uGray: { value: texId === 'mercury' || texId === 'venus' ? 1 : 0 },
    uSteps: { value: world.q.mobile ? 5 : 10 },
  };
  if (hd.ambient !== undefined) uniforms.uAmbient = { value: hd.ambient };
  world.tm.attach(texId, 'color', uniforms.uColor);
  world.tm.attach(texId, 'terrain', uniforms.uTerrain);
  const material = new THREE.ShaderMaterial({ vertexShader: H.TERRAIN_VERT, fragmentShader: H.TERRAIN_FRAG, uniforms });
  return { material, uniforms };
}

function stormBasis(lat, lon, u) {
  const c = geoDir(lat, lon);
  const e = new THREE.Vector3().crossVectors(UP, c).normalize();
  u.uStormC.value.copy(c); u.uStormE.value.copy(e); u.uStormN.value.crossVectors(c, e);
}

export function gasEqMaterial(world, texId, p, L, R) {
  const f = p.flow, hd = p.hd;
  const uniforms = {
    ...L, uMap: { value: null }, uTime: { value: 0 },
    uFlowAmp: { value: f.amp }, uJets: { value: f.jets }, uPeriod: { value: f.period }, uTurb: { value: f.turb }, uRefLat: { value: f.refLat },
    uHasStorm: { value: hd.storm ? 1 : 0 }, uStormSpin: { value: hd.storm ? hd.storm.spin : 0 },
    uStormC: { value: new THREE.Vector3() }, uStormE: { value: new THREE.Vector3() }, uStormN: { value: new THREE.Vector3() },
    uStormAB: { value: new THREE.Vector2(hd.storm ? hd.storm.a : 1, hd.storm ? hd.storm.b : 1) },
    uLimb: { value: f.limb }, uHaze: { value: f.hazeAmt }, uHazeColor: { value: new THREE.Color(...f.haze) }, uBump: { value: hd.bump ?? f.bump }, uWrap: { value: f.wrap },
    uDetail: { value: 0 }, uHex: { value: hd.hex ? 1 : 0 }, uSuper: { value: hd.superRot || 0 },
    uHasRing: { value: 0 }, uRingTex: { value: null }, uRingRange: { value: new THREE.Vector2(1, 2) },
    uRingN: { value: new THREE.Vector3() }, uCenter: { value: new THREE.Vector3() }, uRadiusW: { value: R },
  };
  if (hd.storm) stormBasis(hd.storm.lat, hd.storm.lon, uniforms);
  world.tm.attach(texId, hd.map || 'color', uniforms.uMap);
  const material = new THREE.ShaderMaterial({ vertexShader: S.BODY_VERT, fragmentShader: H.GASEQ_FRAG, uniforms });
  return { material, uniforms };
}

function cloudLayer(world, R, scale, opt, L, parent) {
  const u = {
    ...L, uTime: { value: 0 }, uSpeed: { value: opt.speed }, uScale: { value: opt.scale }, uStretch: { value: opt.stretch ?? 3 },
    uOpacity: { value: opt.opacity }, uLo: { value: opt.lo ?? 0.55 }, uHi: { value: opt.hi ?? 0.85 }, uSeed: { value: opt.seed ?? 0 },
    uShear: { value: opt.shear ?? 0.3 }, uTint: { value: new THREE.Color(...opt.tint).convertSRGBToLinear() },
  };
  const mesh = new THREE.Mesh(sphere(160, 96), new THREE.ShaderMaterial({
    vertexShader: S.BODY_VERT, fragmentShader: H.CLOUDLAYER_FRAG, uniforms: u, transparent: true, depthWrite: false,
  }));
  mesh.scale.setScalar(R * scale);
  mesh.renderOrder = 1;
  parent.add(mesh);
  return { mesh, u };
}

// ---------------------------------------------------------------- per-planet builders
export function buildHD(world, p, ctx) {
  const { R, L, tilt, spin, sy } = ctx;
  const hd = p.hd;
  const mobile = world.q.mobile;
  const out = { layers: [], updates: [] };

  if (hd.render === 'terrain') {
    const { material, uniforms } = terrainMaterial(world, p.id, hd, L);
    out.material = material; out.uniforms = uniforms;
    out.lod = lodFor(material, R, [384, 192], mobile);
    if (hd.dust) {
      // occasional planet-wide dust storms that veil the surface for a while
      const r = rng(77);
      let next = 50 + r() * 60, start = -1;
      out.updates.push(({ vt }) => {
        if (start < 0 && vt > next) start = vt;
        let g = 0;
        if (start >= 0) {
          const t = vt - start;
          g = smooth(0, 25, t) * (1 - smooth(55, 95, t)) * 0.8;
          if (t > 95) { start = -1; next = vt + 160 + r() * 140; }
        }
        uniforms.uDustGlobal.value = g;
        if (out.scatter) out.scatter.tauM = out.scatter.tauM0 + g * 0.9;
      });
    }
  } else if (hd.render === 'venus') {
    // A: the cloud deck in motion; B: Magellan radar surface beneath it
    const gas = gasEqMaterial(world, 'venus', { ...p, hd: { ...hd, map: 'clouds' } }, L, R);
    out.material = gas.material; out.uniforms = gas.uniforms;
    out.lod = lodFor(gas.material, R, [192, 128], mobile);
    const radar = terrainMaterial(world, 'venus', { ...hd.radar, mode: 2 }, world.lightUniforms(1));
    radar.uniforms.uOcc = L.uOcc; radar.uniforms.uOccN = L.uOccN; radar.uniforms.uSunI = L.uSunI;
    const rlod = lodFor(radar.material, R, [384, 192], mobile);
    rlod.scale.setScalar(R); rlod.visible = false;
    spin.add(rlod);
    out.radar = { lod: rlod, uniforms: radar.uniforms };
    for (const l of hd.layers) out.layers.push(cloudLayer(world, R, l.r, l, L, tilt));
  } else if (hd.render === 'earth') {
    const uniforms = {
      ...L, uDay: { value: null }, uNight: { value: null }, uClouds: { value: null }, uNormal: { value: null }, uSpec: { value: null },
      uCloudShift: { value: 0 }, uDetail: { value: 0 }, uTime: { value: 0 },
    };
    ['day', 'night', 'clouds', 'normal', 'spec'].forEach((m) => world.tm.attach('earth', m, uniforms['u' + m[0].toUpperCase() + m.slice(1)]));
    out.material = new THREE.ShaderMaterial({ vertexShader: S.BODY_VERT, fragmentShader: H.EARTH_HD_FRAG, uniforms });
    out.uniforms = uniforms;
    out.lod = lodFor(out.material, R, [256, 160], mobile);
    // low cloud deck with live hurricanes
    const cu = { ...world.lightUniforms(1), uClouds: { value: null }, uTime: { value: 0 }, uStorms: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] } };
    cu.uOcc = L.uOcc; cu.uOccN = L.uOccN; cu.uSunI = L.uSunI;
    world.tm.attach('earth', 'clouds', cu.uClouds);
    const clouds = new THREE.Mesh(sphere(192, 128), new THREE.ShaderMaterial({ vertexShader: S.BODY_VERT, fragmentShader: H.EARTH_CLOUDS_HD_FRAG, uniforms: cu, transparent: true, depthWrite: false }));
    clouds.scale.setScalar(R * 1.007); clouds.renderOrder = 1;
    tilt.add(clouds);
    out.clouds = clouds; out.cloudsU = cu;
    const storms = [{ lat: 17, lon: -52, s: 0.07 }, { lat: 15, lon: 138, s: 0.085 }, { lat: -16, lon: 62, s: 0.065 }];
    out.updates.push(({ vt }) => storms.forEach((st, i) => { const d = geoDir(st.lat + Math.sin(vt * 0.01 + i) * 2, st.lon - vt * 0.15); cu.uStorms.value[i].set(d.x, d.y, d.z, st.s); }));
    // high, thin cirrus drifting faster than the weather below
    out.layers.push(cloudLayer(world, R, 1.013, { speed: 0.004, scale: 2.4, stretch: 2.2, opacity: 0.12, lo: 0.62, hi: 0.92, tint: [1, 1, 1], shear: 0.6, seed: 4 }, L, tilt));
    // aurora curtains around both magnetic poles (two heights: green below, red above)
    const magN = geoDir(80.7, -72.7);
    for (let k = 0; k < 2; k++) {
      const au = { uTime: { value: 0 }, uIntensity: { value: k ? 0.35 : 0.9 }, uLayer: { value: k }, uMagN: { value: magN } };
      const m = new THREE.Mesh(sphere(160, 96), new THREE.ShaderMaterial({ vertexShader: S.BODY_VERT, fragmentShader: H.AURORA_FRAG, uniforms: au, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.scale.setScalar(R * (k ? 1.032 : 1.018)); m.renderOrder = 2;
      spin.add(m);
      out.updates.push(({ vt }) => { au.uTime.value = vt; });
    }
  } else if (hd.render === 'gaseq') {
    const { material, uniforms } = gasEqMaterial(world, p.id, p, L, R);
    out.material = material; out.uniforms = uniforms;
    out.lod = lodFor(material, R, [256, 160], mobile);
    for (const l of hd.layers || []) out.layers.push(cloudLayer(world, R, l.r, l, L, tilt));
  }
  return out;
}

// ---------------------------------------------------------------- scattering atmospheres
export function makeScatter(world, sc, R, parent, sy = 1) {
  const Hh = sc.H * R;
  const u = {
    uCenter: { value: new THREE.Vector3() }, uAxis: { value: new THREE.Vector3(0, 1, 0) }, uFlat: { value: 1 / sy },
    uR: { value: R }, uShell: { value: R * sc.shell }, uH: { value: Hh }, uSunI: { value: 1 }, uIntensity: { value: sc.I },
    uG: { value: sc.g }, uBetaR: { value: new THREE.Vector3(...sc.tauR).multiplyScalar(1 / Hh) }, uBetaM: { value: new THREE.Vector3().setScalar(sc.tauM / Hh) },
    uMieColor: { value: new THREE.Vector3(...sc.mie) }, uSteps: { value: world.q.mobile ? 8 : 14 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: H.SCATTER_VERT, fragmentShader: H.SCATTER_FRAG, uniforms: u, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  const mesh = new THREE.Mesh(sphere(128, 80), mat);
  mesh.scale.set(R * sc.shell, R * sc.shell * sy, R * sc.shell);
  mesh.renderOrder = 4;
  parent.add(mesh);
  return { mesh, u, H0: sc.H, shell: sc.shell, tauR: new THREE.Vector3(...sc.tauR), tauM: sc.tauM, tauM0: sc.tauM };
}

export function updateScatter(s, center, Rw, axis, sunI, camPos) {
  const u = s.u;
  u.uCenter.value.copy(center);
  if (axis) u.uAxis.value.copy(axis);
  // optics follow the drawn radius (planets are enlarged a little in the overview)
  const Hh = s.H0 * Rw;
  u.uH.value = Hh;
  u.uBetaR.value.copy(s.tauR).multiplyScalar(1 / Hh);
  u.uBetaM.value.setScalar(s.tauM / Hh);
  u.uR.value = Rw; u.uShell.value = Rw * s.shell;
  u.uSunI.value = sunI;
  const inside = camPos.distanceTo(center) < Rw * s.shell * 1.002;
  const m = s.mesh.material;
  const side = inside ? THREE.BackSide : THREE.FrontSide;
  if (m.side !== side) { m.side = side; m.depthTest = !inside; m.needsUpdate = true; }
}

// ---------------------------------------------------------------- rings
function ringMesh(inner, outer, material, R, segs = 512) {
  const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, segs, 8), material);
  m.rotation.x = -Math.PI / 2;
  m.scale.setScalar(R);
  m.renderOrder = 3;
  m.frustumCulled = false;
  return m;
}

function dustRing(kind, inner, outer, R, sunI, opacity, parent) {
  const u = { uKind: { value: kind }, uTime: { value: 0 }, uSunI: sunI, uR: { value: R }, uOpacity: { value: opacity }, uCenter: { value: new THREE.Vector3() }, uN: { value: new THREE.Vector3() } };
  const mesh = ringMesh(inner, outer, new THREE.ShaderMaterial({
    vertexShader: S.RING_VERT, fragmentShader: H.RING_DUST_FRAG, uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }), R);
  parent.add(mesh);
  return { mesh, u };
}

function dustPoints(spec, R, sunI, parent, pr) {
  const r = rng(spec.seed || 5);
  const N = spec.count;
  const at = { aR: new Float32Array(N), aTh: new Float32Array(N), aY: new Float32Array(N), aSize: new Float32Array(N), aB: new Float32Array(N) };
  for (let i = 0; i < N; i++) {
    const s = spec.sample(r);
    at.aR[i] = s.r; at.aTh[i] = s.th; at.aY[i] = s.y; at.aSize[i] = s.size; at.aB[i] = s.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  for (const [k, v] of Object.entries(at)) g.setAttribute(k, new THREE.BufferAttribute(v, 1));
  const u = { uTime: { value: 0 }, uPR: pr, uRate: { value: spec.rate ?? 0.05 }, uCenter: { value: new THREE.Vector3() }, uRw: { value: R }, uColor: { value: new THREE.Color(...spec.color) }, uAlpha: { value: spec.alpha } };
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: H.DUSTPTS_VERT, fragmentShader: H.DUSTPTS_FRAG, uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false;
  pts.scale.setScalar(R);
  pts.renderOrder = 3;
  parent.add(pts);
  return { pts, u };
}

export function buildRings(world, p, ctx, planetU) {
  const { R, L, tilt } = ctx;
  const set = p.data ? p.data.rings : p.rings;
  const parts = [];
  const pr = world.prU;
  if (!set) return null;
  if (set.kind === 'saturn') {
    const prof = world.textures.saturnRings;
    const texRange = [1.157, 2.349];
    const layers = world.q.mobile ? [0] : [-0.0016, 0, 0.0016];
    for (const off of layers) {
      const u = {
        uProfile: { value: prof }, uTexRange: { value: new THREE.Vector2(...texRange) }, uRange: { value: new THREE.Vector2(1.11, 2.40) },
        uCenter: { value: new THREE.Vector3() }, uN: { value: new THREE.Vector3() }, uR: { value: R }, uTime: { value: 0 }, uSunI: L.uSunI,
        uOpacity: { value: 1 }, uLayerA: { value: 1 / layers.length },
      };
      const mesh = ringMesh(1.11, 2.40, new THREE.ShaderMaterial({
        vertexShader: S.RING_VERT, fragmentShader: H.RING_HD_FRAG, uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      }), R, 720);
      mesh.position.y = off * R;
      tilt.add(mesh);
      parts.push({ mesh, u });
    }
    parts.push(dustRing(1, 2.6, 8.2, R, L.uSunI, 1, tilt));
    planetU.uHasRing.value = 1; planetU.uRingTex.value = prof; planetU.uRingRange.value.set(...texRange);
    // ice boulders around the camera when it skims the ring plane
    const N = world.q.mobile ? 2500 : 7000;
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const seeds = new Float32Array(N * 4); const r = rng(31);
    for (let i = 0; i < N * 4; i++) seeds[i] = r();
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    const ru = { uCamL: { value: new THREE.Vector3() }, uBox: { value: 0.2 }, uThick: { value: 0.004 }, uSize: { value: 0.0006 }, uProfile: { value: prof }, uTexRange: { value: new THREE.Vector2(...texRange) }, uCenter: { value: new THREE.Vector3() }, uR: { value: R }, uSunI: L.uSunI };
    const rocks = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({ vertexShader: H.ROCK_VERT, fragmentShader: H.ROCK_FRAG, uniforms: ru }), N);
    rocks.frustumCulled = false; rocks.scale.setScalar(R); rocks.visible = false;
    tilt.add(rocks);
    parts.rocks = { mesh: rocks, u: ru };
  } else if (set.kind === 'jupiter') {
    parts.push(dustRing(4, 1.68, 3.15, R, L.uSunI, 1, tilt));
    const halo = { count: world.q.mobile ? 6000 : 16000, color: [0.75, 0.62, 0.50], alpha: 0.5, seed: 3, sample: (r) => { const rr = 1.29 + 0.43 * Math.pow(r(), 0.7); return { r: rr, th: r() * TAU, y: (r() + r() + r() - 1.5) * 0.09 * (1.75 - rr) / 0.45, size: 0.5 + r(), b: 0.05 + 0.1 * r() }; } };
    const goss = { count: world.q.mobile ? 5000 : 14000, color: [0.70, 0.60, 0.52], alpha: 0.4, seed: 4, sample: (r) => { const thebe = r() < 0.35; const rr = thebe ? 1.81 + 1.3 * r() : 1.81 + 0.73 * r(); return { r: rr, th: r() * TAU, y: (r() - 0.5) * (thebe ? 0.11 : 0.06), size: 0.4 + r(), b: thebe ? 0.03 : 0.06 }; } };
    const main = { count: world.q.mobile ? 5000 : 12000, color: [0.75, 0.62, 0.50], alpha: 0.6, seed: 6, sample: (r) => ({ r: 1.72 + 0.09 * r(), th: r() * TAU, y: (r() - 0.5) * 0.006, size: 0.4 + 0.6 * r(), b: 0.1 + 0.15 * r() }) };
    for (const s of [halo, goss, main]) parts.push(dustPoints(s, R, L.uSunI, tilt, pr));
  } else if (set.kind === 'uranus') {
    const { tex, range } = world.ringTexture('uranus');
    const u = { uRingTex: { value: tex }, uRange: { value: new THREE.Vector2(...range) }, uCenter: { value: new THREE.Vector3() }, uN: { value: new THREE.Vector3() }, uR: { value: R }, uTime: { value: 0 }, uSpokes: { value: 0 }, uSunI: L.uSunI, uOpacity: { value: 0.85 } };
    const mesh = ringMesh(range[0], range[1], new THREE.ShaderMaterial({ vertexShader: S.RING_VERT, fragmentShader: S.RING_FRAG, uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide }), R);
    tilt.add(mesh);
    parts.push({ mesh, u });
    parts.push(dustRing(2, 2.5, 4.1, R, L.uSunI, 1, tilt));
  } else if (set.kind === 'neptune') {
    parts.push(dustRing(3, 1.6, 2.6, R, L.uSunI, 1, tilt));
    const arcs = { count: world.q.mobile ? 2000 : 5000, color: [0.62, 0.60, 0.66], alpha: 0.7, seed: 9, rate: 0.013, sample: (r) => {
      const c = [0.0, 0.14, 0.31, 0.37, 0.55][Math.floor(r() * 5)];
      const w = c === 0.55 ? 0.09 : c === 0 ? 0.01 : 0.03;
      return { r: 2.54 + (r() - 0.5) * 0.004, th: c + (r() - 0.5) * 2 * w, y: (r() - 0.5) * 0.002, size: 0.5 + r(), b: 0.15 + 0.2 * r() };
    } };
    parts.push(dustPoints(arcs, R, L.uSunI, tilt, pr));
  }
  return parts;
}

export function updateRings(parts, center, axis, Rw, vt, camera) {
  if (!parts) return;
  for (const p of parts) {
    const u = p.u;
    if (u.uCenter) u.uCenter.value.copy(center);
    if (u.uN) u.uN.value.copy(axis);
    if (u.uR) u.uR.value = Rw;
    if (u.uRw) u.uRw.value = Rw;
    if (u.uTime) u.uTime.value = vt;
  }
  const rk = parts.rocks;
  if (rk) {
    const cl = rk.mesh.worldToLocal(camera.position.clone());
    const rr = Math.hypot(cl.x, cl.z);
    const near = Math.abs(cl.y) < 0.35 && rr > 1.0 && rr < 2.6;
    rk.mesh.visible = near;
    if (near) {
      const box = THREE.MathUtils.clamp(Math.abs(cl.y) * 3 + 0.03, 0.04, 0.6);
      rk.u.uCamL.value.copy(cl);
      rk.u.uBox.value = box;
      rk.u.uSize.value = box * 0.0045;
      rk.u.uThick.value = Math.min(0.004, box * 0.05);
      rk.u.uCenter.value.copy(center); rk.u.uR.value = Rw;
    }
  }
}
