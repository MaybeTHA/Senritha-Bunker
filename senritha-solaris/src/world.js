import * as THREE from 'three';
import * as S from './shaders.js';
import { PLANETS, SUN, SUN_RADIUS, BELTS, auToScene, artRadius } from './data.js';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const OBLIQ = 23.4392911 * DEG;
const UP = new THREE.Vector3(0, 1, 0);

// Equatorial (RA/Dec, J2000) direction to scene space (ecliptic, Y = ecliptic north).
export function eqToScene(raDeg, decDeg) {
  const ra = raDeg * DEG, dec = decDeg * DEG;
  const x = Math.cos(dec) * Math.cos(ra), y = Math.cos(dec) * Math.sin(ra), z = Math.sin(dec);
  const ye = y * Math.cos(OBLIQ) + z * Math.sin(OBLIQ);
  const ze = -y * Math.sin(OBLIQ) + z * Math.cos(OBLIQ);
  return new THREE.Vector3(x, ze, -ye).normalize();
}

// Heliocentric position from Keplerian elements, scaled to the artistic orbit.
export function kepler(el, days, out) {
  const T = days / 36525;
  const L = (el.L + el.Ldot * T) * DEG;
  const lp = el.lp * DEG, node = el.node * DEG, I = el.I * DEG, e = el.e;
  let M = (L - lp) % TAU; if (M < 0) M += TAU;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  orbitPoint(el, E, out);
  return M / TAU;
}
function orbitPoint(el, E, out) {
  const e = el.e, a = el.a;
  const lp = el.lp * DEG, node = el.node * DEG, I = el.I * DEG, w = lp - node;
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(node), sO = Math.sin(node), cI = Math.cos(I), sI = Math.sin(I);
  const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  const y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  const z = (sw * sI) * xp + (cw * sI) * yp;
  const k = auToScene(a) / a;
  return out.set(x * k, z * k, -y * k);
}

// Seeded random for stable layouts.
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ baking
export class Baker {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.mat = new THREE.ShaderMaterial({
      vertexShader: S.BAKE_VERT, fragmentShader: S.BAKE_FRAG, side: THREE.BackSide, depthTest: false, depthWrite: false,
      uniforms: { uKind: { value: 0 }, uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() }, uP: { value: new THREE.Vector4() }, uSeed: { value: 0 } },
    });
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: S.BAKE_VERT, fragmentShader: S.SKY_BAKE_FRAG, side: THREE.BackSide, depthTest: false, depthWrite: false,
      uniforms: {
        uGalN: { value: eqToScene(192.859, 27.128) }, uGalC: { value: eqToScene(266.405, -28.936) },
        uLMC: { value: eqToScene(80.9, -69.8) }, uSMC: { value: eqToScene(13.2, -72.8) }, uM31: { value: eqToScene(10.68, 41.27) },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), this.mat);
    this.scene.add(this.mesh);
  }
  target(size) {
    return new THREE.WebGLCubeRenderTarget(size, {
      generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, type: THREE.UnsignedByteType,
    });
  }
  bake(size, { kind = 10, colA = [0.3, 0.3, 0.3], colB = [0.6, 0.6, 0.6], p = [1, 0, 0, 0], seed = 0 } = {}) {
    const rt = this.target(size);
    const u = this.mat.uniforms;
    u.uKind.value = kind; u.uColA.value.setRGB(...colA); u.uColB.value.setRGB(...colB); u.uP.value.set(...p); u.uSeed.value = seed;
    this.mesh.material = this.mat;
    const cam = new THREE.CubeCamera(0.1, 10, rt);
    cam.update(this.renderer, this.scene);
    rt.texture.userData.size = size;
    return rt.texture;
  }
  bakeSky(size) {
    const rt = this.target(size);
    this.mesh.material = this.skyMat;
    const cam = new THREE.CubeCamera(0.1, 10, rt);
    cam.update(this.renderer, this.scene);
    return rt.texture;
  }
}

// ------------------------------------------------------------------ rings
function ringTexture(kind) {
  const N = 2048, data = new Uint8Array(N * 4);
  const rnd = rng(kind === 'saturn' ? 7 : kind === 'uranus' ? 11 : 13);
  const waves = Array.from({ length: 24 }, () => ({ f: 200 + rnd() * 2600, p: rnd() * TAU, a: 0.2 + rnd() }));
  const fine = (r) => { let s = 0, n = 0; for (const w of waves) { s += Math.sin(r * w.f + w.p) * w.a; n += w.a; } return s / n; };
  const def = { saturn: [1.11, 2.35], uranus: [1.60, 2.02], neptune: [1.65, 2.56] }[kind];
  const g = (r, c, w) => Math.exp(-((r - c) * (r - c)) / (w * w));
  for (let i = 0; i < N; i++) {
    const r = def[0] + (def[1] - def[0]) * (i + 0.5) / N;
    let a = 0, c = [0.5, 0.5, 0.5];
    if (kind === 'saturn') {
      const f = fine(r);
      if (r < 1.236) { a = 0.025 + 0.015 * f; c = [0.52, 0.48, 0.44]; }
      else if (r < 1.527) {
        const t = (r - 1.236) / (1.527 - 1.236);
        a = 0.10 + 0.07 * t + 0.06 * f + 0.10 * smooth(0.6, 0.62, t) * (1 - smooth(0.66, 0.68, t)) + 0.12 * g(r, 1.495, 0.01);
        a *= 1 - 0.85 * g(r, 1.29, 0.0035) - 0.85 * g(r, 1.45, 0.004);
        c = [0.60, 0.55, 0.49];
      } else if (r < 1.951) {
        const t = (r - 1.527) / (1.951 - 1.527);
        a = 0.55 + 0.40 * smooth(0.0, 0.3, t) + 0.10 * f - 0.06 * Math.abs(fine(r * 1.7));
        a -= 0.12 * smooth(0.85, 1.0, t);
        c = [0.93 + 0.04 * f, 0.85 + 0.03 * f, 0.69];
      } else if (r < 2.027) {
        a = 0.06 + 0.05 * Math.max(0, f) + 0.18 * g(r, 1.99, 0.003) + 0.15 * g(r, 2.005, 0.002);
        a *= 1 - 0.9 * g(r, 1.953, 0.004);
        c = [0.55, 0.51, 0.47];
      } else if (r < 2.269) {
        const t = (r - 2.027) / (2.269 - 2.027);
        a = 0.62 - 0.12 * t + 0.08 * f;
        a *= 1 - 0.97 * g(r, 2.214, 0.0032) - 0.9 * g(r, 2.2645, 0.0009);
        c = [0.84, 0.78, 0.67];
      } else if (r < 2.31) { a = 0.015; c = [0.6, 0.56, 0.5]; }
      a += 0.55 * g(r, 2.326, 0.0016); if (r > 2.31) c = [0.82, 0.78, 0.72];
    } else if (kind === 'uranus') {
      const rings = [[1.637, 0.0008, 0.35], [1.652, 0.0008, 0.35], [1.666, 0.0009, 0.4], [1.750, 0.0012, 0.5], [1.786, 0.0012, 0.5], [1.834, 0.001, 0.3], [1.863, 0.001, 0.45], [1.900, 0.0012, 0.55], [1.958, 0.001, 0.3], [2.006, 0.0028, 0.9]];
      for (const [rc, w, s] of rings) a += s * g(r, rc, w);
      a += 0.02 * g(r, 1.75, 0.15);
      c = [0.45, 0.47, 0.50];
    } else {
      a = 0.06 * g(r, 1.69, 0.035) + 0.45 * g(r, 2.148, 0.0012) + 0.035 * smooth(2.15, 2.2, r) * (1 - smooth(2.35, 2.4, r)) + 0.15 * g(r, 2.31, 0.0012) + 0.6 * g(r, 2.54, 0.0016);
      c = [0.48, 0.46, 0.50];
    }
    a = Math.min(1, Math.max(0, a));
    data[i * 4] = Math.round(Math.pow(c[0], 1 / 2.2) * 255);
    data[i * 4 + 1] = Math.round(Math.pow(c[1], 1 / 2.2) * 255);
    data[i * 4 + 2] = Math.round(Math.pow(c[2], 1 / 2.2) * 255);
    data[i * 4 + 3] = Math.round(a * 255);
  }
  const tex = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  tex.wrapS = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  return { tex, range: def };
}

// ------------------------------------------------------------------ world
export class World {
  constructor({ renderer, scene, quality, baked, textures }) {
    this.renderer = renderer;
    this.scene = scene;
    this.q = quality;
    this.baked = baked;
    this.tex = textures;
    this.bodies = [];
    this.planets = [];
    this.shared = {
      uSunColor: { value: new THREE.Color(1.0, 0.97, 0.92) },
      uSunR: { value: SUN_RADIUS },
      uAmbient: { value: 0.012 },
    };
    this.geo = {
      hi: new THREE.SphereGeometry(1, 192, 128),
      mid: new THREE.SphereGeometry(1, 96, 64),
      lo: new THREE.SphereGeometry(1, 40, 28),
      moon: new THREE.SphereGeometry(1, 96, 64),
      moonLo: new THREE.SphereGeometry(1, 32, 20),
    };
    this.buildSky();
    this.buildSun();
    PLANETS.forEach((p) => this.buildPlanet(p));
    this.buildBelts();
    this.buildDust();
    this.buildZodiacal();
  }

  // ---------------------------------------------------------- sky
  buildSky() {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({
      vertexShader: S.SKY_VERT, fragmentShader: S.SKY_FRAG, side: THREE.BackSide, depthTest: false, depthWrite: false,
      uniforms: { uSky: { value: this.baked.sky }, uIntensity: { value: 1.0 } },
    }));
    sky.scale.setScalar(15000); sky.renderOrder = -10; sky.frustumCulled = false;
    this.scene.add(sky); this.sky = sky;

    const N = this.q.stars;
    const r = rng(42);
    const gn = eqToScene(192.859, 27.128), gc = eqToScene(266.405, -28.936);
    const ge = new THREE.Vector3().crossVectors(gn, gc).normalize();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), tw = new Float32Array(N);
    const temps = [[0.66, 0.76, 1.0, 0.10], [0.92, 0.95, 1.0, 0.25], [1.0, 0.96, 0.88, 0.35], [1.0, 0.82, 0.62, 0.21], [1.0, 0.66, 0.50, 0.09]];
    const v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      if (r() < 0.42) {
        const l = r() * TAU; const gb = (r() + r() + r() - 1.5) * 0.16;
        v.copy(gc).multiplyScalar(Math.cos(l)).addScaledVector(ge, Math.sin(l)).multiplyScalar(Math.cos(gb)).addScaledVector(gn, Math.sin(gb));
      } else {
        const u = r() * 2 - 1, t = r() * TAU, s = Math.sqrt(1 - u * u);
        v.set(s * Math.cos(t), u, s * Math.sin(t));
      }
      v.normalize().multiplyScalar(9000);
      pos.set([v.x, v.y, v.z], i * 3);
      const b = Math.pow(r(), 7.0);
      let pick = r(), k = 0; while (k < temps.length - 1 && pick > temps[k][3]) { pick -= temps[k][3]; k++; }
      const c = temps[k], inten = 0.18 + 1.9 * b;
      col.set([c[0] * inten, c[1] * inten, c[2] * inten], i * 3);
      size[i] = 1.1 + 2.6 * Math.sqrt(b) + r() * 0.4;
      tw[i] = r() < 0.35 ? r() : 0;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aTw', new THREE.BufferAttribute(tw, 1));
    this.starUniforms = { uTime: { value: 0 }, uPR: { value: 1 } };
    const stars = new THREE.Points(g, new THREE.ShaderMaterial({
      vertexShader: S.STAR_VERT, fragmentShader: S.STAR_FRAG, uniforms: this.starUniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    stars.renderOrder = -5; stars.frustumCulled = false;
    this.scene.add(stars); this.stars = stars;
  }

  // ---------------------------------------------------------- sun
  buildSun() {
    const R = SUN_RADIUS;
    const root = new THREE.Group();
    const spin = new THREE.Group();
    root.add(spin);
    spin.quaternion.setFromUnitVectors(UP, eqToScene(286.13, 63.87));
    const sunU = { uTime: { value: 0 }, uIntensity: { value: 1.5 } };
    const sphere = new THREE.Mesh(this.geo.hi, new THREE.ShaderMaterial({ vertexShader: S.SUN_VERT, fragmentShader: S.SUN_FRAG, uniforms: sunU }));
    sphere.scale.setScalar(R);
    spin.add(sphere);

    const coronaU = { uTime: { value: 0 }, uScale: { value: 5.5 }, uIntensity: { value: 1.0 } };
    const corona = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: S.BILLBOARD_VERT, fragmentShader: S.CORONA_FRAG, uniforms: coronaU,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    corona.scale.setScalar(R * 5.5);
    corona.renderOrder = 5;
    root.add(corona);

    // prominences: glowing magnetic loops anchored on the surface
    const r = rng(9);
    const proms = [];
    for (let i = 0; i < 9; i++) {
      const lat = (r() - 0.5) * 70 * DEG, lon = r() * TAU;
      const c = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
      const t = new THREE.Vector3().crossVectors(c, new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5)).normalize();
      const axis = new THREE.Vector3().crossVectors(c, t).normalize();
      const span = 0.10 + r() * 0.22, h = 0.08 + r() * 0.22;
      const A = c.clone().applyAxisAngle(axis, -span / 2), B = c.clone().applyAxisAngle(axis, span / 2);
      const mid = c.clone();
      const pts = [];
      for (let k = 0; k <= 40; k++) {
        const s = k / 40;
        const d = A.clone().lerp(B, s).normalize();
        const twist = new THREE.Vector3().crossVectors(d, axis).multiplyScalar(Math.sin(s * Math.PI * 2) * 0.012);
        pts.push(d.multiplyScalar(1 + h * Math.sin(Math.PI * s)).add(twist).sub(mid));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 64, 0.010 + r() * 0.012, 8, false);
      const u = { uTime: { value: 0 }, uSeed: { value: r() * 50 }, uFade: { value: 1 }, uIntensity: { value: 1.25 }, uSunR: { value: R } };
      const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        vertexShader: S.PROM_VERT, fragmentShader: S.PROM_FRAG, uniforms: u,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }));
      const holder = new THREE.Group();
      holder.position.copy(mid);
      holder.add(mesh);
      const anchor = new THREE.Group(); anchor.scale.setScalar(R); anchor.add(holder);
      spin.add(anchor);
      proms.push({ holder, u, period: 14 + r() * 22, phase: r(), erupt: i < 2 });
    }
    this.sun = { root, spin, sphere, sunU, corona, coronaU, proms };
    this.scene.add(root);
    this.bodies.push({
      id: 'sun', kind: 'sun', data: SUN, R, root, scale: 1, pick: sphere,
      world: new THREE.Vector3(), minDist: R * 1.35,
    });
  }

  // ---------------------------------------------------------- planets
  makeLOD(material, R) {
    const lod = new THREE.LOD();
    lod.addLevel(new THREE.Mesh(this.geo.hi, material), 0);
    lod.addLevel(new THREE.Mesh(this.geo.mid, material), R * 14);
    lod.addLevel(new THREE.Mesh(this.geo.lo, material), R * 70);
    return lod;
  }

  lightUniforms(scaleY = 1) {
    return {
      uSunColor: this.shared.uSunColor, uSunR: this.shared.uSunR, uAmbient: this.shared.uAmbient,
      uSunI: { value: 1 }, uInvScale2: { value: new THREE.Vector3(1, 1 / (scaleY * scaleY), 1) },
      uOcc: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] }, uOccN: { value: 0 },
    };
  }

  buildPlanet(p) {
    const R = p.radius;
    const sy = 1 - (p.oblate || 0);
    const root = new THREE.Group();
    const scaleG = new THREE.Group(); root.add(scaleG);
    const tilt = new THREE.Group(); scaleG.add(tilt);
    const axis = eqToScene(p.pole[0], p.pole[1]);
    tilt.quaternion.setFromUnitVectors(UP, axis);
    const spin = new THREE.Group(); tilt.add(spin);
    const L = this.lightUniforms(sy);
    let material, uniforms, clouds = null, cloudsU = null;
    const texel = (size) => 1.5 * (Math.PI / 2) / size;

    if (p.kind === 'earth') {
      uniforms = { ...L, uDay: { value: this.tex.day }, uNight: { value: this.tex.night }, uData: { value: this.tex.data }, uCloudShift: { value: 0 }, uTexW: { value: this.tex.data.image.width }, uDetail: { value: 0 } };
      material = new THREE.ShaderMaterial({ vertexShader: S.BODY_VERT, fragmentShader: S.EARTH_FRAG, uniforms });
      cloudsU = { ...this.lightUniforms(1), uData: { value: this.tex.data }, uTexW: { value: this.tex.data.image.width } };
      cloudsU.uOcc = uniforms.uOcc; cloudsU.uOccN = uniforms.uOccN; cloudsU.uSunI = uniforms.uSunI;
      clouds = new THREE.Mesh(this.geo.hi, new THREE.ShaderMaterial({
        vertexShader: S.BODY_VERT, fragmentShader: S.CLOUD_FRAG, uniforms: cloudsU, transparent: true, depthWrite: false,
      }));
      clouds.scale.setScalar(R * 1.012);
      clouds.renderOrder = 1;
      tilt.add(clouds);
    } else if (p.kind === 'gas') {
      const map = this.baked[p.id];
      const f = p.flow;
      uniforms = {
        ...L, uMap: { value: map }, uTime: { value: 0 },
        uFlowAmp: { value: f.amp }, uJets: { value: f.jets }, uPeriod: { value: f.period }, uTurb: { value: f.turb }, uRefLat: { value: f.refLat },
        uHasStorm: { value: f.storm ? 1 : 0 }, uStormSpin: { value: f.storm ? f.storm.spin : 0 },
        uStormC: { value: new THREE.Vector3() }, uStormE: { value: new THREE.Vector3() }, uStormN: { value: new THREE.Vector3() },
        uStormAB: { value: new THREE.Vector2(f.storm ? f.storm.a : 1, f.storm ? f.storm.b : 1) },
        uLimb: { value: f.limb }, uHaze: { value: f.hazeAmt }, uHazeColor: { value: new THREE.Color(...f.haze) }, uBump: { value: f.bump }, uWrap: { value: f.wrap },
        uHasRing: { value: 0 }, uRingTex: { value: null }, uRingRange: { value: new THREE.Vector2(1, 2) },
        uRingN: { value: new THREE.Vector3() }, uCenter: { value: new THREE.Vector3() }, uRadiusW: { value: R },
      };
      if (f.storm) {
        const la = f.storm.lat * DEG, lo = f.storm.lon * DEG;
        const c = new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo));
        const e = new THREE.Vector3().crossVectors(UP, c).normalize();
        uniforms.uStormC.value.copy(c); uniforms.uStormE.value.copy(e); uniforms.uStormN.value.crossVectors(c, e);
      }
      material = new THREE.ShaderMaterial({ vertexShader: S.BODY_VERT, fragmentShader: S.GAS_FRAG, uniforms });
    } else {
      const map = this.baked[p.id];
      uniforms = {
        ...L, uMap: { value: map }, uEqMap: { value: null }, uEqSize: { value: new THREE.Vector2(1, 1) },
        uBump: { value: p.bump }, uLunar: { value: p.lunar || 0 }, uTexel: { value: texel(map.userData.size || 512) },
        uDetail: { value: 0 }, uTime: { value: 0 }, uDust: { value: p.dust ? 1 : 0 }, uHaze: { value: p.atmo ? 0.25 : 0 },
        uHazeColor: { value: new THREE.Color(...(p.atmo ? p.atmo.color : [0, 0, 0])) },
      };
      material = new THREE.ShaderMaterial({ vertexShader: S.BODY_VERT, fragmentShader: S.ROCKY_FRAG, uniforms });
    }

    const lod = this.makeLOD(material, R);
    lod.scale.set(R, R * sy, R);
    spin.add(lod);

    let atmo = null, atmoU = null;
    if (p.atmo) ({ mesh: atmo, u: atmoU } = this.makeAtmosphere(p.atmo, R, tilt, sy));

    let ring = null, ringU = null;
    if (p.rings) {
      const { tex, range } = ringTexture(p.rings.kind);
      ringU = {
        uRingTex: { value: tex }, uRange: { value: new THREE.Vector2(...range) }, uCenter: { value: new THREE.Vector3() }, uN: { value: new THREE.Vector3() },
        uR: { value: R }, uTime: { value: 0 }, uSpokes: { value: 0 }, uSunI: L.uSunI,
        uOpacity: { value: p.rings.kind === 'saturn' ? 1 : 0.75 },
      };
      ring = new THREE.Mesh(new THREE.RingGeometry(range[0], range[1], 320, 6), new THREE.ShaderMaterial({
        vertexShader: S.RING_VERT, fragmentShader: S.RING_FRAG, uniforms: ringU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      }));
      ring.rotation.x = -Math.PI / 2;
      ring.scale.setScalar(R);
      ring.renderOrder = 3;
      tilt.add(ring);
      if (p.rings.kind === 'saturn') {
        uniforms.uHasRing.value = 1; uniforms.uRingTex.value = tex; uniforms.uRingRange.value.set(...range);
      }
    }

    // orbit ribbon
    const orbit = this.makeOrbit(p);

    const moonFrame = new THREE.Group();
    moonFrame.quaternion.copy(tilt.quaternion);
    root.add(moonFrame);

    const body = {
      id: p.id, kind: 'planet', data: p, R, root, scaleG, tilt, spin, lod, material, uniforms, clouds, cloudsU, atmo, atmoU, ring, ringU, orbit,
      moonFrame, moons: [], scale: 1, world: new THREE.Vector3(), phase: 0, minDist: R * 1.18 * (p.rings ? 1 : 1),
      axis, spinRate: this.spinRate(p.cloudRotHours || p.rotHours), sy,
    };
    this.scene.add(root);
    this.bodies.push(body);
    this.planets.push(body);
    (p.moons || []).forEach((m, i) => this.buildMoon(m, body, i));
  }

  spinRate(hours) {
    return Math.sign(hours) * (TAU / 70) * Math.pow(23.934 / Math.abs(hours), 0.6);
  }

  makeAtmosphere(a, R, parent, sy = 1) {
    const u = {
      uAxis: { value: new THREE.Vector3(0, 1, 0) }, uFlat: { value: 1 / sy },
      uColor: { value: new THREE.Color(...a.color) }, uSunset: { value: new THREE.Color(...a.sunset) }, uCenter: { value: new THREE.Vector3() },
      uR: { value: R }, uShell: { value: R * a.scale }, uIntensity: { value: a.intensity }, uDensity: { value: a.density }, uSunI: { value: 1 },
    };
    const mesh = new THREE.Mesh(this.geo.mid, new THREE.ShaderMaterial({
      vertexShader: S.ATMO_VERT, fragmentShader: S.ATMO_FRAG, uniforms: u, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    mesh.scale.set(R * a.scale, R * a.scale * sy, R * a.scale);
    mesh.renderOrder = 2;
    parent.add(mesh);
    return { mesh, u };
  }

  makeOrbit(p) {
    const N = 900, el = p.el;
    const pos = new Float32Array((N + 1) * 2 * 3), tan = new Float32Array((N + 1) * 2 * 3), side = new Float32Array((N + 1) * 2), phase = new Float32Array((N + 1) * 2);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      const E = (i / N) * TAU;
      orbitPoint(el, E, a); orbitPoint(el, E + 0.001, b); c.subVectors(b, a).normalize();
      const M = (E - el.e * Math.sin(E)) / TAU;
      for (let s = 0; s < 2; s++) {
        const k = i * 2 + s;
        pos.set([a.x, a.y, a.z], k * 3); tan.set([c.x, c.y, c.z], k * 3);
        side[k] = s ? 1 : -1; phase[k] = i === N ? 1 : M;
      }
    }
    const idx = [];
    for (let i = 0; i < N; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aTangent', new THREE.BufferAttribute(tan, 3));
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setIndex(idx);
    const u = {
      uColor: { value: new THREE.Color(...p.orbitColor) }, uPhase: { value: 0 }, uAlpha: { value: 0.13 }, uHighlight: { value: 0 },
      uPx: { value: 0.001 }, uWidth: { value: 1.4 }, uNear: { value: 0 }, uDim: { value: 1 },
    };
    const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: S.ORBIT_VERT, fragmentShader: S.ORBIT_FRAG, uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    mesh.frustumCulled = false;
    mesh.renderOrder = 0;
    this.scene.add(mesh);
    return { mesh, u };
  }

  buildMoon(m, planet, index) {
    const R = Math.max(planet.R * Math.pow(m.km / planet.data.stats.diameter, 0.72), (m.minR || 0) * planet.R);
    const r = rng(index * 31 + planet.data.id.length * 7);
    const frame = new THREE.Group();
    frame.rotation.order = 'YXZ';
    frame.rotation.y = r() * TAU;
    frame.rotation.x = m.incl * DEG;
    const pivot = new THREE.Group();
    pivot.rotation.y = r() * TAU;
    frame.add(pivot);
    (m.inEcliptic ? planet.root : planet.moonFrame).add(frame);

    const L = this.lightUniforms(1);
    let uniforms, material, geo = this.geo.moon;
    if (m.equirect) {
      const t = this.tex.moon;
      uniforms = {
        ...L, uMap: { value: null }, uEqMap: { value: t }, uEqSize: { value: new THREE.Vector2(t.image.width, t.image.height) },
        uBump: { value: 0.0016 }, uLunar: { value: 0.6 }, uTexel: { value: 0.002 }, uDetail: { value: 0 }, uTime: { value: 0 }, uDust: { value: 0 },
        uHaze: { value: 0 }, uHazeColor: { value: new THREE.Color(0, 0, 0) },
      };
      material = new THREE.ShaderMaterial({ vertexShader: S.BODY_VERT, fragmentShader: S.ROCKY_FRAG, uniforms, defines: { EQUIRECT: '' } });
    } else {
      const map = this.baked[m.id];
      uniforms = {
        ...L, uMap: { value: map }, uEqMap: { value: null }, uEqSize: { value: new THREE.Vector2(1, 1) },
        uBump: { value: ({ 11: 0.22, 12: 0.3, 14: 0, 15: 0.35, 18: 0.3 })[m.bake] ?? 0.7 }, uLunar: { value: m.bake === 14 ? 0 : 0.5 }, uTexel: { value: 1.5 * (Math.PI / 2) / (map.userData.size || 256) },
        uDetail: { value: 0 }, uTime: { value: 0 }, uDust: { value: 0 }, uHaze: { value: m.atmo ? 0.3 : 0 },
        uHazeColor: { value: new THREE.Color(...(m.atmo ? m.atmo.color : [0, 0, 0])) },
      };
      material = new THREE.ShaderMaterial({ vertexShader: S.BODY_VERT, fragmentShader: S.ROCKY_FRAG, uniforms });
      if (m.shape) geo = this.irregular(m.id.length * 13 + index, m.shape);
    }
    const lod = new THREE.LOD();
    lod.addLevel(new THREE.Mesh(geo, material), 0);
    lod.addLevel(new THREE.Mesh(m.shape ? geo : this.geo.moonLo, material), R * 40);
    lod.position.set(m.dist * planet.R, 0, 0);
    lod.rotation.y = Math.PI;
    lod.scale.setScalar(R);
    pivot.add(lod);

    let atmo = null, atmoU = null;
    if (m.atmo) {
      ({ mesh: atmo, u: atmoU } = this.makeAtmosphere(m.atmo, R, lod));
      atmo.scale.setScalar(m.atmo.scale);
    }

    // faint orbit circle, shown while exploring the parent
    const pts = [];
    for (let i = 0; i <= 160; i++) { const a = (i / 160) * TAU; pts.push(new THREE.Vector3(Math.cos(a) * m.dist * planet.R, 0, -Math.sin(a) * m.dist * planet.R)); }
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x9fb8e0, transparent: true, opacity: 0.0, depthWrite: false }));
    frame.add(ring);

    const body = {
      id: m.id, kind: 'moon', data: m, R, parent: planet, frame, pivot, lod, material, uniforms, atmo, atmoU, orbitLine: ring,
      root: lod, scale: 1, world: new THREE.Vector3(), minDist: R * 1.3,
      rate: TAU / (Math.sqrt(Math.abs(m.periodDays)) * 16),
    };
    planet.moons.push(body);
    this.bodies.push(body);
  }

  irregular(seed, shape) {
    const g = new THREE.SphereGeometry(1, 64, 40);
    const p = g.attributes.position; const v = new THREE.Vector3();
    const r = rng(seed);
    const bumps = Array.from({ length: 9 }, () => ({ d: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), s: 0.15 + r() * 0.35, a: (r() - 0.4) * 0.22 }));
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      let k = 1;
      for (const b of bumps) k += b.a * Math.exp(-(1 - v.dot(b.d)) / (b.s * b.s * 0.5));
      v.multiplyScalar(k); v.x *= shape[0]; v.y *= shape[2]; v.z *= shape[1];
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }

  // ---------------------------------------------------------- belts, dust, zodiacal light
  buildBelts() {
    this.belts = BELTS.map((b, bi) => {
      const N = Math.round(b.count * this.q.belt);
      const r = rng(100 + bi);
      const at = (n) => new Float32Array(n);
      const A = at(N), Th = at(N), Rt = at(N), In = at(N), No = at(N), Sz = at(N), Br = at(N);
      for (let i = 0; i < N; i++) {
        let au = b.a[0] + (b.a[1] - b.a[0]) * Math.pow(r(), bi === 0 ? 1 : 1.6);
        if (bi === 0) { if (Math.abs(au - 2.5) < 0.03 || Math.abs(au - 2.82) < 0.025 || Math.abs(au - 2.95) < 0.02) au += 0.06; }
        A[i] = auToScene(au) + (r() - 0.5) * 2.0;
        Th[i] = r() * TAU;
        Rt[i] = TAU / (365.25 * Math.pow(au, 1.5));
        In[i] = (r() + r() + r() - 1.5) * b.incl * DEG;
        No[i] = r() * TAU;
        Sz[i] = b.size[0] + (b.size[1] - b.size[0]) * Math.pow(r(), 3);
        Br[i] = 0.35 + 0.65 * r();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      [['aA', A], ['aTheta', Th], ['aRate', Rt], ['aIncl', In], ['aNode', No], ['aSize', Sz], ['aBright', Br]].forEach(([n, a]) => g.setAttribute(n, new THREE.BufferAttribute(a, 1)));
      const u = { uDays: { value: 0 }, uPR: { value: 1 }, uColor: { value: new THREE.Color(...b.color) }, uAlpha: { value: b.alpha } };
      const pts = new THREE.Points(g, new THREE.ShaderMaterial({
        vertexShader: S.BELT_VERT, fragmentShader: S.BELT_FRAG, uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      pts.frustumCulled = false;
      this.scene.add(pts);
      return { pts, u };
    });
  }

  buildDust() {
    const N = this.q.dust;
    const r = rng(5);
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) pos[i] = r();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dustU = { uCam: { value: new THREE.Vector3() }, uBox: { value: 40 }, uPR: { value: 1 }, uAlpha: { value: 0.12 } };
    const dust = new THREE.Points(g, new THREE.ShaderMaterial({
      vertexShader: S.DUST_VERT, fragmentShader: S.DUST_FRAG, uniforms: this.dustU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    dust.frustumCulled = false;
    this.scene.add(dust);
  }

  buildZodiacal() {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uI: { value: 1 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `precision highp float; varying vec3 vP; uniform float uI;
        void main(){ float r = length(vP.xy); float a = exp(-r/110.0) * smoothstep(22.0, 60.0, r) * (1.0 - smoothstep(420.0, 520.0, r));
        a += 0.35 * exp(-pow((r - 126.0)/14.0, 2.0));
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * a * 0.010 * uI, 1.0); }`,
    });
    const disk = new THREE.Mesh(new THREE.CircleGeometry(520, 128), mat);
    disk.rotation.x = -Math.PI / 2;
    disk.renderOrder = -1;
    this.scene.add(disk);
    this.zodiacal = disk;
  }

  // ---------------------------------------------------------- per-frame
  update(simDays, vt, dt, camera, viewH) {
    const sun = this.sun;
    sun.spin.rotation.y = 0;
    sun.sphere.rotation.y = vt * TAU / 600;
    sun.sunU.uTime.value = vt;
    sun.coronaU.uTime.value = vt;
    sun.corona.quaternion.copy(camera.quaternion);
    for (const p of sun.proms) {
      p.u.uTime.value = vt;
      const c = ((vt / p.period) + p.phase) % 1;
      if (p.erupt) {
        p.holder.scale.setScalar(1 + c * 1.6);
        p.u.uFade.value = smooth(0, 0.12, c) * (1 - smooth(0.55, 1, c));
      } else {
        p.holder.scale.setScalar(1 + 0.12 * Math.sin(c * TAU));
        p.u.uFade.value = 0.55 + 0.45 * Math.sin(c * TAU + 1.0);
      }
    }
    this.starUniforms.uTime.value = vt;
    this.stars.position.copy(camera.position);
    this.sky.position.copy(camera.position);
    this.stars.rotation.y = vt * 0.0004;
    this.sky.rotation.y = vt * 0.0004;
    for (const b of this.belts) b.u.uDays.value = simDays;

    for (const pl of this.planets) {
      pl.phase = kepler(pl.data.el, simDays, pl.root.position);
      pl.orbit.u.uPhase.value = pl.phase;
      pl.spin.rotation.y = pl.spinRate * vt + (pl.spinOffset || 0);
      if (pl.clouds) {
        const cr = pl.spinRate * vt * 1.0 + vt * 0.0035;
        pl.clouds.rotation.y = cr;
        pl.uniforms.uCloudShift.value = (cr - pl.spin.rotation.y) / TAU;
      }
      if (pl.uniforms.uTime) pl.uniforms.uTime.value = vt;
      if (pl.ringU) pl.ringU.uTime.value = vt;
      for (const m of pl.moons) {
        m.pivot.rotation.y = vt * m.rate;
        m.uniforms.uTime.value = vt;
      }
    }
    this.scene.updateMatrixWorld();
    this.updateScales(camera, viewH);
    this.scene.updateMatrixWorld();

    const tmp = new THREE.Vector3();
    for (const b of this.bodies) b.root.getWorldPosition(b.world);
    for (const pl of this.planets) {
      const d = pl.world.length();
      const sunI = Math.min(1.35, 1.18 * Math.pow(84 / d, 0.22));
      pl.uniforms.uSunI.value = sunI;
      const Rw = pl.R * pl.scale;
      if (pl.uniforms.uCenter) pl.uniforms.uCenter.value.copy(pl.world);
      if (pl.uniforms.uRingN) { pl.uniforms.uRingN.value.copy(pl.axis); pl.uniforms.uRadiusW.value = Rw; }
      if (pl.ringU) { pl.ringU.uCenter.value.copy(pl.world); pl.ringU.uN.value.copy(pl.axis); pl.ringU.uR.value = Rw; }
      if (pl.atmoU) { pl.atmoU.uAxis.value.copy(pl.axis); pl.atmoU.uCenter.value.copy(pl.world); pl.atmoU.uR.value = Rw; pl.atmoU.uShell.value = Rw * pl.data.atmo.scale; pl.atmoU.uSunI.value = sunI / (pl.scale * pl.scale); }
      // moons cast shadows on their planet; the planet shadows its moons
      const occ = pl.uniforms.uOcc.value; let n = 0;
      const vis = pl.moons.filter((m) => m.lod.visible).sort((a, b) => b.R - a.R);
      for (const m of vis) { if (n >= 4) break; occ[n++].set(m.world.x, m.world.y, m.world.z, m.R); }
      pl.uniforms.uOccN.value = n;
      for (const m of pl.moons) {
        m.uniforms.uSunI.value = sunI;
        m.uniforms.uOcc.value[0].set(pl.world.x, pl.world.y, pl.world.z, Rw);
        m.uniforms.uOccN.value = 1;
        if (m.atmoU) { m.atmoU.uCenter.value.copy(m.world); m.atmoU.uR.value = m.R; m.atmoU.uShell.value = m.R * m.data.atmo.scale; m.atmoU.uSunI.value = sunI; }
      }
    }
    return tmp;
  }

  // Keep far planets at least a few pixels wide so the overview stays readable.
  updateScales(camera, viewH) {
    const k = 2 * Math.tan((camera.fov * DEG) / 2) / viewH;
    const minPx = this.q.minPx;
    const cam = camera.position;
    const w = new THREE.Vector3();
    for (const pl of this.planets) {
      pl.root.getWorldPosition(w);
      const d = w.distanceTo(cam);
      const target = Math.max(1, (minPx * Math.pow(pl.R / 1.5, 0.35) * k * d) / pl.R);
      pl.scale = target;
      pl.scaleG.scale.setScalar(target);
      const show = target < 1.25;
      for (const m of pl.moons) m.lod.visible = show;
      if (pl.clouds) pl.uniforms.uDetail.value = 0;
    }
  }
}
