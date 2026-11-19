import * as THREE from 'three';

// Progressive, multi-resolution planet maps.
// Every body starts with its 2K maps; the body in focus steps up to 4K and then 8K
// (desktop) and drops back to 2K when the camera leaves, so only one large set lives on the GPU.
export const MAPS = {
  mercury: { color: ['2k', '4k', '8k'], terrain: ['2k', '4k', '8k'] },
  venus: { color: ['2k', '4k', '8k'], terrain: ['2k', '4k', '8k'], clouds: ['2k', '4k'] },
  earth: { day: ['2k', '4k', '8k'], night: ['2k', '4k'], clouds: ['2k', '4k', '8k'], normal: ['2k', '4k'], spec: ['2k', '4k'] },
  moon: { color: ['2k', '4k', '8k'], terrain: ['2k', '4k'] },
  mars: { color: ['2k', '4k', '8k'], terrain: ['2k', '4k', '8k'] },
  jupiter: { color: ['2k', '4k'] },
  saturn: { color: ['2k', '4k'] },
};
const RANK = { '2k': 0, '4k': 1, '8k': 2 };
// single-channel maps are uploaded as R8 to use a quarter of the GPU memory
export const GRAY = { earth: ['clouds', 'spec'], mercury: ['color'], venus: ['color'] };
const isGray = (url) => Object.entries(GRAY).some(([id, maps]) => maps.some((m) => url.includes(`/${id}/${m}_`)));

export class TextureManager {
  constructor(renderer, maxLevel) {
    this.renderer = renderer;
    this.maxLevel = maxLevel;
    this.aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.base = {};      // id -> { map: Texture }
    this.hi = {};        // id -> { level, maps: { map: Texture } }
    this.bind = {};      // id -> { map: [uniform, ...] }
    this.level = {};     // id -> current level string
    this.pending = {};
    this.listeners = new Set();
    this.useBitmap = typeof createImageBitmap === 'function';
  }

  setup(tex, url = '') {
    if (isGray(url)) tex.format = THREE.RedFormat;
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = this.aniso;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  }

  async load(url) {
    if (this.useBitmap) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const blob = await res.blob();
      try {
        // decode off the main thread so large maps do not freeze the camera flight
        const bmp = await createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
        const tex = new THREE.Texture(bmp);
        tex.flipY = false;
        return this.setup(tex, url);
      } catch {
        this.useBitmap = false; // older browsers: fall back to <img> decoding below
      }
    }
    const tex = await new THREE.TextureLoader().loadAsync(url);
    return this.setup(tex, url);
  }

  url(id, map, level) { return `textures/${id}/${map}_${level}.jpg`; }

  async loadBase(onEach) {
    const jobs = [];
    for (const [id, maps] of Object.entries(MAPS)) {
      this.base[id] = {}; this.level[id] = '2k';
      for (const map of Object.keys(maps)) {
        jobs.push(this.load(this.url(id, map, '2k')).then((t) => { this.base[id][map] = t; onEach && onEach(); }));
      }
    }
    await Promise.all(jobs);
  }

  get(id, map) { return (this.hi[id] && this.hi[id].maps[map]) || this.base[id][map]; }

  // remember which uniforms show a map so they can be swapped when a sharper level arrives
  attach(id, map, uniform) {
    (this.bind[id] ||= {});
    (this.bind[id][map] ||= []).push(uniform);
    uniform.value = this.get(id, map);
  }

  apply(id) {
    const b = this.bind[id]; if (!b) return;
    for (const [map, us] of Object.entries(b)) for (const u of us) u.value = this.get(id, map);
  }

  bestLevel(id, map) {
    const avail = MAPS[id][map];
    let best = '2k';
    for (const lv of avail) if (RANK[lv] <= RANK[this.maxLevel] && RANK[lv] > RANK[best]) best = lv;
    return best;
  }

  // Step up through the levels for one body; drop every other body back to 2K.
  async focus(id) {
    for (const other of Object.keys(this.hi)) if (other !== id) this.release(other);
    if (!MAPS[id]) return;
    const steps = ['4k', '8k'].filter((lv) => RANK[lv] <= RANK[this.maxLevel]);
    const token = (this.pending[id] = Symbol(id));
    for (const lv of steps) {
      const maps = Object.keys(MAPS[id]).filter((m) => MAPS[id][m].includes(lv) || this.bestLevel(id, m) === lv);
      const want = maps.filter((m) => MAPS[id][m].includes(lv));
      if (!want.length) continue;
      if (this.hi[id] && RANK[this.hi[id].level] >= RANK[lv]) continue;
      this.emit(id, lv, 'loading');
      let loaded;
      try { loaded = await Promise.all(want.map((m) => this.load(this.url(id, m, lv)).then((t) => [m, t]))); }
      catch (e) { console.warn('texture level failed', id, lv, e); this.emit(id, this.level[id], 'ready'); return; }
      if (this.pending[id] !== token) { loaded.forEach(([, t]) => t.dispose()); return; }
      // upload before swapping so the switch does not stall a frame mid-flight
      loaded.forEach(([, t]) => this.renderer.initTexture(t));
      const prev = this.hi[id];
      const next = { level: lv, maps: { ...(prev ? prev.maps : {}) } };
      for (const [m, t] of loaded) next.maps[m] = t;
      this.hi[id] = next;
      this.level[id] = lv;
      this.apply(id);
      if (prev) for (const [m, t] of Object.entries(prev.maps)) if (next.maps[m] !== t) t.dispose();
      this.emit(id, lv, 'ready');
    }
  }

  release(id) {
    const h = this.hi[id]; if (!h) return;
    delete this.hi[id];
    this.pending[id] = null;
    this.level[id] = '2k';
    this.apply(id);
    for (const t of Object.values(h.maps)) t.dispose();
    this.emit(id, '2k', 'ready');
  }

  on(fn) { this.listeners.add(fn); }
  emit(id, level, state) { for (const fn of this.listeners) fn(id, level, state); }
}
