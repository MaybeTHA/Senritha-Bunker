import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World, Baker } from './world.js';
import { UI } from './ui.js';
import { PLANETS, SPEEDS, DEFAULT_SPEED, STRINGS } from './data.js';
import { POST_VERT, POST_FRAG } from './shaders.js';

const DEG = Math.PI / 180;
const J2000 = Date.UTC(2000, 0, 1, 12);
const params = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;
const small = Math.min(screen.width, screen.height) < 700;
const QUALITY = {
  high: { bake: 1024, moon: 512, sky: 2048, prMax: 2, prMin: 0.8, earth: '4k', stars: 16000, belt: 1, dust: 1400, samples: 4, minPx: 4.5 },
  mid: { bake: 512, moon: 256, sky: 1024, prMax: 1.6, prMin: 0.7, earth: '2k', stars: 10000, belt: 0.7, dust: 900, samples: 2, minPx: 4.5 },
  low: { bake: 256, moon: 128, sky: 512, prMax: 1, prMin: 0.6, earth: '2k', stars: 6000, belt: 0.45, dust: 500, samples: 0, minPx: 4 },
};
const qName = QUALITY[params.get('q')] ? params.get('q') : (coarse || small ? 'mid' : 'high');
const Q = QUALITY[qName];

const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

class App {
  constructor() {
    this.speedIdx = DEFAULT_SPEED;
    this.paused = false;
    this.simDays = (Date.now() - J2000) / 86400000;
    this.vt = 0;
    this.focus = null;
    this.flight = null;
    this.hover = null;
    this.viewOffset = { x: 0, y: 0, tx: 0, ty: 0 };
    this.ui = new UI(this);
    this.ui.updateSpeed();
    this.start().catch((e) => { console.error(e); this.ui.fail(STRINGS[this.ui.lang].noWebGL); });
  }

  async start() {
    const canvas = document.getElementById('scene');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
    } catch (e) {
      this.ui.fail(STRINGS[this.ui.lang].noWebGL); return;
    }
    this.renderer = renderer;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.pr = Math.min(window.devicePixelRatio || 1, Q.prMax);
    renderer.setPixelRatio(this.pr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);

    const t = STRINGS[this.ui.lang];
    const tl = () => STRINGS[this.ui.lang];
    this.ui.progress(0.03, tl().textures);

    // textures
    const loader = new THREE.TextureLoader();
    const tex = async (f, srgb = false) => {
      const tx = await loader.loadAsync('textures/' + f);
      tx.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      tx.colorSpace = THREE.NoColorSpace;
      tx.wrapS = THREE.RepeatWrapping;
      return tx;
    };
    const ek = Q.earth;
    const [day, night, data, moon] = await Promise.all([tex(`earth_day_${ek}.jpg`), tex(`earth_night_${ek}.jpg`), tex(`earth_data_${ek}.jpg`), tex('moon_1k.jpg')]);
    this.ui.progress(0.12, tl().sky);
    await nextFrame();

    // bake procedural surfaces on the GPU, one body per frame
    const baker = new Baker(renderer);
    const baked = {};
    baked.sky = baker.bakeSky(Q.sky);
    const jobs = [];
    for (const p of PLANETS) {
      if (p.bake) jobs.push({ id: p.id, name: p.name, size: Q.bake, opt: { kind: p.bake, seed: 3 } });
      for (const m of p.moons || []) {
        if (!m.bake && m.bake !== 0) continue;
        if (m.equirect) continue;
        const opt = { kind: m.bake, seed: m.id.length * 7.3, colA: m.colors?.[0], colB: m.colors?.[1], p: [m.craters ?? 1, m.brightCraters ?? 0.5, m.grooves ?? 0, 0] };
        if (!opt.colA) delete opt.colA; if (!opt.colB) delete opt.colB;
        jobs.push({ id: m.id, name: m.name, size: Q.moon, opt });
      }
    }
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i];
      this.ui.progress(0.15 + 0.7 * (i / jobs.length), `${tl().building} ${j.name[this.ui.lang]}`);
      await nextFrame();
      baked[j.id] = baker.bake(j.size, j.opt);
    }

    // scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 30000);
    this.world = new World({ renderer, scene: this.scene, quality: Q, baked, textures: { day, night, data, moon } });
    this.ui.ensureLabels(this.world.bodies);

    // post-processing
    const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
    const rt = new THREE.WebGLRenderTarget(size.x * this.pr, size.y * this.pr, { type: THREE.HalfFloatType, samples: Q.samples });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.setPixelRatio(this.pr);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(size, 0.42, 0.4, 0.95);
    this.composer.addPass(this.bloom);
    this.post = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.38 }, uWarp: { value: 0 }, uRes: { value: new THREE.Vector2() } }, vertexShader: POST_VERT, fragmentShader: POST_FRAG });
    this.composer.addPass(this.post);
    this.composer.addPass(new OutputPass());

    // controls
    const c = new OrbitControls(this.camera, renderer.domElement);
    c.enableDamping = true; c.dampingFactor = 0.07;
    c.rotateSpeed = 0.55; c.zoomSpeed = 1.1; c.panSpeed = 0.9;
    c.screenSpacePanning = true;
    c.maxDistance = 3200;
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    c.addEventListener('start', () => { this.userActive = performance.now(); if (this.flight && this.flight.t > 0.15) this.cancelFlight(); });
    this.controls = c;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindPointer(renderer.domElement);
    this.bindKeys();

    this.ui.progress(0.9, tl().building + '…');
    await nextFrame();
    this.world.update(this.simDays, 0, 0, this.camera, window.innerHeight);
    const ov = this.overviewPose();
    const sp = ov.pos.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.9).multiplyScalar(1.9);
    sp.y += ov.pos.length() * 0.35;
    this.camera.position.copy(sp);
    c.target.set(0, 0, 0);
    this.camera.lookAt(0, 0, 0);
    try { await renderer.compileAsync(this.scene, this.camera); } catch { renderer.compile(this.scene, this.camera); }
    this.ui.progress(1, tl().ready);
    this.composer.render();
    await nextFrame();
    this.ui.hideLoader();
    this.ui.setCurrent(null);
    this.flyOverview(5.5);
    this.last = performance.now();
    this.fpsT = 0; this.fpsN = 0;
    renderer.setAnimationLoop((now) => this.frame(now));
  }

  // ---------------------------------------------------------------- layout
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.portrait = h > w * 1.1;
    this.baseFov = this.portrait ? 58 : 45;
    if (!this.flight) this.camera.fov = this.baseFov;
    this.camera.aspect = w / h;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.post.uniforms.uRes.value.set(w * this.pr, h * this.pr);
    this.layoutChanged();
  }
  layoutChanged() {
    requestAnimationFrame(() => {
      const ins = this.ui.panelInset();
      const show = !!this.focus || (this.flight && this.flight.body);
      this.viewOffset.tx = show ? ins.right / 2 : 0;
      this.viewOffset.ty = show ? ins.bottom * 0.42 : 0;
    });
  }
  applyViewOffset(dt) {
    const v = this.viewOffset, k = 1 - Math.exp(-dt * 4);
    v.x += (v.tx - v.x) * k; v.y += (v.ty - v.y) * k;
    const w = window.innerWidth, h = window.innerHeight;
    if (Math.abs(v.x) < 0.3 && Math.abs(v.y) < 0.3 && v.tx === 0 && v.ty === 0) this.camera.clearViewOffset();
    else this.camera.setViewOffset(w, h, v.x, v.y, w, h);
    this.camera.updateProjectionMatrix();
  }
  availAspect() {
    const ins = this.ui.panelInset();
    return Math.max(0.3, (window.innerWidth - ins.right) / Math.max(200, window.innerHeight - ins.bottom * 0.84));
  }

  // ---------------------------------------------------------------- camera poses
  overviewPose() {
    // Fit Neptune's orbit inside the visible frame (above the dock, below the header).
    const R = 375, w = window.innerWidth, h = window.innerHeight;
    const elev = (this.portrait ? 58 : 24) * DEG, az = -24 * DEG;
    const dir = new THREE.Vector3(Math.cos(elev) * Math.sin(az), Math.sin(elev), Math.cos(elev) * Math.cos(az));
    const cam = new THREE.PerspectiveCamera(this.baseFov, w / h, 1, 50000);
    const top = 1 - 2 * (this.portrait ? 110 : 84) / h, bottom = -1 + 2 * (this.portrait ? 150 : 70) / h, side = 0.97;
    const pts = [];
    for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R)); }
    const target = new THREE.Vector3();
    const fits = (d, ty) => {
      target.set(0, ty, 0);
      cam.position.copy(dir).multiplyScalar(d).add(target); cam.lookAt(target); cam.updateMatrixWorld();
      let minY = 1, maxY = -1, maxX = 0;
      for (const p of pts) { const v = p.clone().project(cam); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); maxX = Math.max(maxX, Math.abs(v.x)); }
      return { ok: maxX <= side && minY >= bottom && maxY <= top, minY, maxY };
    };
    const center = (d) => { let ty = 0, f; for (let i = 0; i < 24; i++) { f = fits(d, ty); ty += ((f.minY + f.maxY) / 2 - (top + bottom) / 2) * d * 0.3; } f = fits(d, ty); return { ty, ok: f.ok }; };
    let lo = 150, hi = 6000, ty = 0;
    for (let i = 0; i < 26; i++) { const mid = (lo + hi) / 2; const c = center(mid); if (c.ok) hi = mid; else lo = mid; }
    const d = hi; ty = center(d).ty; target.set(0, ty, 0);
    return { pos: dir.clone().multiplyScalar(d).add(target), target: target.clone() };
  }
  frameDistance(b) {
    let Rf = b.R;
    if (b.data.rings && b.data.rings.kind === 'saturn') Rf = b.R * 2.05;
    else if (b.data.rings) Rf = b.R * 1.25;
    const fov = this.baseFov * DEG, halfV = fov / 2;
    const halfH = Math.atan(Math.tan(halfV) * this.availAspect());
    const half = Math.min(halfV, halfH);
    const fill = b.kind === 'sun' ? 0.5 : 0.64;
    return Rf / Math.sin(Math.atan(Math.tan(half) * fill));
  }

  // ---------------------------------------------------------------- selection & flight
  selectById(id) { const b = this.world.bodies.find((x) => x.id === id); if (b) this.select(b); }
  select(b) {
    if (!b) return;
    if (b.kind === 'moon' && !b.lod.visible && this.focus !== b.parent) { /* fly via parent framing */ }
    this.focus = null;
    this.ui.setCurrent(b);
    this.flyTo(b);
    this.layoutChanged();
  }
  goOverview() {
    this.focus = null;
    this.ui.setCurrent(null);
    this.layoutChanged();
    this.flyOverview(3.6);
  }
  cancelFlight() {
    const f = this.flight; this.flight = null;
    if (f && f.body) { this.focus = f.body; this.lastFocus = f.body.world.clone(); }
    this.camera.fov = this.baseFov; this.camera.updateProjectionMatrix();
    this.controls.enabled = true;
  }

  flyTo(b) {
    const cam = this.camera, B = b.world.clone();
    const dist = this.frameDistance(b);
    let dir;
    if (b.kind === 'sun') {
      dir = cam.position.clone().sub(B); dir.y = Math.max(dir.y, dir.length() * 0.25); dir.normalize();
    } else {
      const toSun = B.clone().negate().normalize();
      const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), toSun).normalize();
      if (side.dot(cam.position.clone().sub(B)) < 0) side.negate();
      dir = toSun.clone().multiplyScalar(0.58).add(side.multiplyScalar(0.78)).add(new THREE.Vector3(0, 0.24, 0));
      const pl = b.kind === 'planet' ? b : null;
      if (pl && pl.data.rings && pl.data.rings.kind === 'saturn') {
        // look at the sunlit face of the rings with a generous opening angle
        const n = pl.axis.clone(); const s = Math.sign(n.dot(toSun)) || 1;
        dir.normalize().addScaledVector(n, 0.75 * s);
      }
      if (pl && pl.data.flow && pl.data.flow.storm) dir.y -= 0.32;
      dir.normalize();
      if (pl && pl.data.flow && pl.data.flow.storm) {
        // turn the planet so its great storm faces the camera when we arrive
        const local = dir.clone().applyQuaternion(pl.tilt.quaternion.clone().invert());
        const want = Math.atan2(-local.z, local.x) - 0.3;
        const dur = this.flightDuration(b, dir, dist);
        const cur = pl.spinOffset || 0;
        let target = want - pl.spinRate * (this.vt + dur);
        target = cur + Math.atan2(Math.sin(target - cur), Math.cos(target - cur));
        this.spinAlign = { pl, from: cur, to: target, t: 0 };
      }
    }
    this.startFlight({ body: b, dir, dist });
  }
  flyOverview(dur) {
    const ov = this.overviewPose();
    this.startFlight({ body: null, dir: ov.pos.clone().sub(ov.target).normalize(), dist: ov.pos.distanceTo(ov.target), target: ov.target, dur });
  }
  flightDuration(b, dir, dist) {
    const travel = this.camera.position.distanceTo(b.world.clone().addScaledVector(dir, dist));
    return THREE.MathUtils.clamp(2.4 + Math.log(1 + travel) * 0.42, 2.6, 5.4);
  }
  startFlight({ body, dir, dist, target, dur }) {
    const cam = this.camera;
    const B = body ? body.world.clone() : target.clone();
    const rel = cam.position.clone().sub(B);
    const d0 = Math.max(rel.length(), 1e-3);
    const travel = cam.position.distanceTo(B.clone().addScaledVector(dir, dist));
    this.flight = {
      body, t: 0,
      dur: dur || THREE.MathUtils.clamp(2.4 + Math.log(1 + travel) * 0.42, 2.6, 5.4),
      u0: rel.normalize(), u1: dir.clone(), d0, d1: dist, T0: this.controls.target.clone(),
      target: target ? target.clone() : null, lift: Math.min(travel * 0.16, 140),
      q: new THREE.Quaternion().setFromUnitVectors(rel.clone().normalize(), dir.clone().normalize()),
    };
    this.controls.enabled = false;
  }
  updateFlight(dt) {
    const f = this.flight;
    f.t = Math.min(1, f.t + dt / f.dur);
    const sa = this.spinAlign;
    if (sa) { sa.t = Math.min(1, f.t / 0.45); sa.pl.spinOffset = sa.from + (sa.to - sa.from) * ease(sa.t); if (sa.t >= 1) this.spinAlign = null; }
    const e = ease(f.t);
    const B = f.body ? f.body.world : f.target;
    const q = new THREE.Quaternion().slerp(f.q, ease(Math.min(1, f.t * 1.08)));
    const u = f.u0.clone().applyQuaternion(q);
    const d = Math.exp(THREE.MathUtils.lerp(Math.log(f.d0), Math.log(f.d1), e));
    const pos = B.clone().addScaledVector(u, d);
    pos.y += Math.sin(Math.PI * e) * f.lift;
    this.camera.position.copy(pos);
    const tgt = f.T0.clone().lerp(B, easeOut(Math.min(1, f.t * 1.5)));
    this.controls.target.copy(tgt);
    this.camera.lookAt(tgt);
    this.camera.fov = this.baseFov + 9 * Math.pow(Math.sin(Math.PI * e), 2);
    this.post.uniforms.uWarp.value = Math.pow(Math.sin(Math.PI * e), 2);
    if (f.t >= 1) {
      this.flight = null;
      this.camera.fov = this.baseFov;
      this.post.uniforms.uWarp.value = 0;
      this.controls.enabled = true;
      if (f.body) {
        this.focus = f.body;
        this.lastFocus = f.body.world.clone();
        this.controls.minDistance = f.body.minDist;
        if (!this.hinted) { this.hinted = true; this.ui.toast(STRINGS[this.ui.lang].explore); }
      } else {
        this.controls.minDistance = 30;
      }
    }
  }

  // ---------------------------------------------------------------- input
  bindPointer(el) {
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), n: e.isPrimary }; });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (moved < 7 && performance.now() - down.t < 600 && e.button === 0) {
        const b = this.pick(e.clientX, e.clientY);
        if (b) this.select(b);
      }
      down = null;
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.mouse = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointerleave', () => { this.mouse = null; this.hover = null; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea')) return;
      if (e.key === 'Escape') { if (!document.getElementById('help').hidden) this.ui.toggleHelp(false); else this.goOverview(); }
      else if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); this.togglePause(); }
      else if (e.key === '0') this.selectById('sun');
      else if (/^[1-8]$/.test(e.key)) this.selectById(PLANETS[+e.key - 1].id);
    });
  }
  pick(x, y) {
    const w = window.innerWidth, h = window.innerHeight;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, -(y / h) * 2 + 1), this.camera);
    const k = 2 * Math.tan((this.camera.fov * DEG) / 2) / h;
    let best = null, bestD = Infinity;
    const hit = new THREE.Vector3(), sph = new THREE.Sphere();
    for (const b of this.world.bodies) {
      if (b.kind === 'moon' && !b.lod.visible) continue;
      const dist = b.world.distanceTo(this.camera.position);
      const rr = Math.max(b.R * (b.scale || 1) * 1.05, (b.kind === 'moon' ? 10 : 14) * k * dist);
      sph.set(b.world, rr);
      if (ray.ray.intersectSphere(sph, hit)) {
        const dd = hit.distanceTo(this.camera.position);
        const prefer = b.kind === 'moon' ? 0.92 : 1;
        if (dd * prefer < bestD) { bestD = dd * prefer; best = b; }
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- time
  finishFlight() { if (this.flight) { this.flight.t = 0.9999; if (this.spinAlign) { this.spinAlign.pl.spinOffset = this.spinAlign.to; this.spinAlign = null; } } }
  togglePause() { this.paused = !this.paused; this.ui.updateSpeed(); }
  setSpeed(i) { this.speedIdx = THREE.MathUtils.clamp(i, 0, SPEEDS.length - 1); this.paused = false; this.ui.updateSpeed(); }
  resetDate() { this.simDays = (Date.now() - J2000) / 86400000; }

  // ---------------------------------------------------------------- frame
  frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (!this.paused) this.simDays += SPEEDS[this.speedIdx].d * dt;
    this.vt += dt;
    const cam = this.camera, c = this.controls;
    const H = window.innerHeight;

    this.world.update(this.simDays, this.vt, dt, cam, H);

    if (this.flight) this.updateFlight(dt);
    else if (this.focus) {
      const p = this.focus.world;
      const delta = p.clone().sub(this.lastFocus);
      cam.position.add(delta); c.target.add(delta);
      this.lastFocus.copy(p);
    }
    if (!this.flight) c.update();

    // keep the camera outside every body
    for (const b of this.world.bodies) {
      if (b.kind === 'moon' && !b.lod.visible) continue;
      const minD = b.R * (b.scale || 1) * (b.kind === 'sun' ? 1.25 : 1.1);
      const off = cam.position.clone().sub(b.world);
      const d = off.length();
      if (d < minD) cam.position.copy(b.world).addScaledVector(off.normalize(), minD);
    }
    // dynamic near plane for precision close to small moons
    let nearest = Infinity;
    for (const b of this.world.bodies) {
      if (b.kind === 'moon' && !b.lod.visible) continue;
      nearest = Math.min(nearest, cam.position.distanceTo(b.world) - b.R * (b.scale || 1) * 1.02);
    }
    cam.near = THREE.MathUtils.clamp(nearest * 0.3, 0.01, 8);
    this.applyViewOffset(dt);
    cam.updateMatrixWorld();

    this.updateVisuals(dt);
    this.composer.render(dt);
    this.adapt(dt);
  }

  updateVisuals(dt) {
    const cam = this.camera, w = this.world;
    const W = window.innerWidth, H = window.innerHeight;
    const k = 2 * Math.tan((cam.fov * DEG) / 2) / H;
    const focusD = this.focus ? cam.position.distanceTo(this.focus.world) : cam.position.length();
    for (const pl of w.planets) {
      const o = pl.orbit.u;
      o.uPx.value = k;
      o.uWidth.value = (this.portrait ? 2.2 : 2.4) * this.pr;
      const hl = this.ui.current && (this.ui.current === pl || this.ui.current.parent === pl) ? 1 : (this.hover === pl ? 0.6 : 0);
      o.uHighlight.value += (hl - o.uHighlight.value) * Math.min(1, dt * 5);
      o.uNear.value = this.focus ? focusD * 1.1 : 0;
      const dimT = this.focus && this.focus.kind !== 'sun' ? 0.35 : 1;
      o.uDim.value += (dimT - o.uDim.value) * Math.min(1, dt * 3);
      for (const m of pl.moons) {
        const show = this.focus && (this.focus === pl || this.focus.parent === pl);
        const mat = m.orbitLine.material;
        mat.opacity += ((show ? 0.07 : 0) - mat.opacity) * Math.min(1, dt * 3);
        m.orbitLine.visible = mat.opacity > 0.005 && m.lod.visible;
      }
    }
    // surface detail fades in when close
    for (const b of w.bodies) {
      if (!b.uniforms || b.uniforms.uDetail === undefined) continue;
      const d = cam.position.distanceTo(b.world) / (b.R * (b.scale || 1));
      b.uniforms.uDetail.value = THREE.MathUtils.clamp((3.2 - d) / 1.6, 0, 1);
    }
    for (const bl of w.belts) bl.u.uPR.value = this.pr;
    w.starUniforms.uPR.value = this.pr;
    // near-camera dust: scale with how far we are from the nearest object of interest
    const du = w.dustU;
    du.uCam.value.copy(cam.position);
    du.uPR.value = this.pr;
    du.uBox.value = THREE.MathUtils.clamp(focusD * 0.5, 4, 220);
    const speed = this.prevCam ? this.prevCam.distanceTo(cam.position) / Math.max(dt, 1e-3) / du.uBox.value : 0;
    du.uAlpha.value += (THREE.MathUtils.clamp(0.10 + speed * 0.08, 0.10, 0.7) - du.uAlpha.value) * Math.min(1, dt * 4);
    this.prevCam = (this.prevCam || new THREE.Vector3()).copy(cam.position);
    // sun glare: calmer when the Sun fills the view
    const sunD = cam.position.length();
    const sunPx = w.bodies[0].R / (sunD * k);
    const calm = THREE.MathUtils.clamp((sunPx - 50) / 250, 0, 1);
    this.bloom.strength = THREE.MathUtils.lerp(0.42, 0.2, calm);
    w.sun.sunU.uIntensity.value = THREE.MathUtils.lerp(1.5, 0.95, calm);
    w.sun.coronaU.uIntensity.value = THREE.MathUtils.lerp(1.0, 0.7, calm);
    this.post.uniforms.uTime.value = this.vt;

    // hover
    if (this.mouse && !this.flight) {
      const hb = this.pick(this.mouse.x, this.mouse.y);
      if (hb !== this._hoverPick) { this._hoverPick = hb; this.hover = hb; }
    }
    this.renderer.domElement.style.cursor = this.hover ? 'pointer' : '';

    // labels and reticle
    const items = [];
    const v = new THREE.Vector3();
    const sunW = w.bodies[0];
    let ret = null;
    const occluders = [sunW]; if (this.focus && this.focus.kind !== 'sun') occluders.push(this.focus.kind === 'moon' ? this.focus.parent : this.focus);
    for (const b of w.bodies) {
      v.copy(b.world).project(cam);
      const dist = cam.position.distanceTo(b.world);
      const vis = v.z < 1 && v.z > -1 && (b.kind !== 'moon' || b.lod.visible);
      const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
      const r = (b.R * (b.scale || 1)) / (dist * k);
      let occ = false;
      for (const o of occluders) {
        if (o === b || (b.kind === 'moon' && o === b.parent && false)) continue;
        const od = cam.position.distanceTo(o.world);
        if (od >= dist) continue;
        const ov = o.world.clone().project(cam);
        const ox = (ov.x + 1) / 2 * W, oy = (1 - ov.y) / 2 * H;
        const orr = (o.R * (o.scale || 1)) / (od * k);
        if (Math.hypot(x - ox, y - oy) < orr * 0.98) { occ = true; break; }
      }
      const it = { body: b, x, y, r, visible: vis && !occ && x > -50 && x < W + 50 && y > -50 && y < H + 50 };
      items.push(it);
      if (b === this.ui.current) ret = it;
    }
    this.ui.placeLabels(items, this.focus || (this.flight && this.flight.body) || null, this.hover);
    this.ui.placeReticle(this.flight ? null : ret);
    this.ui.updateDate(J2000 + this.simDays * 86400000);
  }

  adapt(dt) {
    this.fpsT += dt; this.fpsN++;
    if (this.fpsT < 1.5) return;
    const ms = (this.fpsT / this.fpsN) * 1000;
    this.fpsT = 0; this.fpsN = 0;
    let pr = this.pr;
    const maxPr = Math.min(window.devicePixelRatio || 1, Q.prMax);
    if (ms > 24 && pr > Q.prMin) pr = Math.max(Q.prMin, pr * 0.85);
    else if (ms < 13 && pr < maxPr) pr = Math.min(maxPr, pr * 1.1);
    if (Math.abs(pr - this.pr) > 0.01) {
      this.pr = pr;
      this.renderer.setPixelRatio(pr);
      this.composer.setPixelRatio(pr);
      this.resize();
    }
  }
}

window.solaris = new App();
