// Procedural PBR textures drawn on canvases at load time: wood, fabrics, stone, bark, snow and art.
import * as THREE from 'three';
import { makeNoise, rng, clamp, lerp, smooth } from './noise.js';

let ANISO = 8;
const tick = () => new Promise((r) => setTimeout(r, 0));

function mkCanvas(w, h) {
	const c = document.createElement('canvas');
	c.width = w; c.height = h;
	return c;
}

function toTex(canvas, { srgb = true, repeat = true } = {}) {
	const t = new THREE.CanvasTexture(canvas);
	t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
	if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.anisotropy = ANISO;
	t.needsUpdate = true;
	return t;
}

class Px {
	constructor(w, h) {
		this.w = w; this.h = h;
		this.c = mkCanvas(w, h);
		this.ctx = this.c.getContext('2d');
		this.img = this.ctx.createImageData(w, h);
		this.d = this.img.data;
	}
	set(i, r, g, b, a = 255) {
		const k = i * 4;
		this.d[k] = r; this.d[k + 1] = g; this.d[k + 2] = b; this.d[k + 3] = a;
	}
	done() { this.ctx.putImageData(this.img, 0, 0); return this.c; }
}

// Tangent-space normal map (OpenGL convention, +Y = up the texture) from a tileable height field.
function normalFrom(H, w, h, strength) {
	const px = new Px(w, h);
	for (let y = 0; y < h; y++) {
		const yu = ((y - 1 + h) % h) * w, yd = ((y + 1) % h) * w, row = y * w;
		for (let x = 0; x < w; x++) {
			const xl = (x - 1 + w) % w, xr = (x + 1) % w;
			const dx = (H[row + xr] - H[row + xl]) * strength;
			const dy = (H[yu + x] - H[yd + x]) * strength;
			const l = Math.hypot(dx, dy, 1);
			px.set(row + x, (-dx / l * 0.5 + 0.5) * 255, (-dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255);
		}
	}
	return px.done();
}

function grayTex(G, w, h) {
	const px = new Px(w, h);
	for (let i = 0; i < w * h; i++) { const g = clamp(G[i], 0, 1) * 255; px.set(i, g, g, g); }
	return px.done();
}

// ---------------------------------------------------------------- wood planks
function woodPlanks(o) {
	const { size = 1024, rows = 8, seg = [1, 3], seed = 1, dark, light, gap = 2, ring = 0.6,
		knots = 0.2, rough = [0.4, 0.62], tone = 0.14, grainFv = 80, normal = 3 } = o;
	const N = makeNoise(seed), R = rng(seed + 11);
	const W = size, Hh = size;
	const rowsD = [];
	for (let r = 0; r < rows; r++) {
		const n = seg[0] + Math.floor(R() * (seg[1] - seg[0] + 1));
		const segs = [];
		for (let s = 0; s < n; s++) {
			segs.push({
				tone: 1 + (R() - 0.5) * 2 * tone,
				warm: (R() - 0.5) * 0.08,
				rf: 1.2 + R() * 2.2, rp: R() * 10, k: Math.floor(R() * 40),
				knot: R() < knots ? { x: 0.2 + R() * 0.6, y: 0.25 + R() * 0.5, r: 0.5 + R() * 0.8 } : null,
			});
		}
		rowsD.push({ n, off: R(), segs });
	}
	const col = new Px(W, Hh);
	const H = new Float32Array(W * Hh), Rg = new Float32Array(W * Hh);
	const plankH = Hh / rows;
	for (let y = 0; y < Hh; y++) {
		const v = (y + 0.5) / Hh;
		const rv = (1 - v) * rows; const r = Math.min(rows - 1, Math.floor(rv)); const fy = rv - r;
		const row = rowsD[r];
		const segLen = W / row.n;
		for (let x = 0; x < W; x++) {
			const u = (x + 0.5) / W;
			const su = (u + row.off) * row.n; const si = Math.floor(su); const fx = su - si;
			const s = row.segs[((si % row.n) + row.n) % row.n];
			const fine = N.tile(u + s.k, v, 4, grainFv, 3);
			const fig = N.tile(u + s.k, v, 3, rows * 2, 3);
			let ringT = fy * s.rf + fig * 2.2 + s.rp;
			let kd = 0;
			if (s.knot) {
				const dx = (fx - s.knot.x) * segLen / plankH, dy = (fy - s.knot.y);
				const d = Math.hypot(dx * 0.6, dy) / (0.18 * s.knot.r);
				if (d < 3) { ringT += (3 - d) * 0.6; kd = smooth(1.1, 0.2, d); }
			}
			const band = 0.5 + 0.5 * Math.sin(ringT * 6.2832);
			let t = 0.55 + fine * 0.33 - Math.pow(band, 2.5) * ring * 0.55;
			const pore = N.n2(u * 300, v * grainFv * 6, 300, grainFv * 6);
			if (pore > 0.55) t -= 0.12;
			t = clamp(t - kd * 0.55, 0, 1);
			let sf = 1;
			if (gap > 0) {
				const e = Math.min(Math.min(fx, 1 - fx) * segLen, Math.min(fy, 1 - fy) * plankH);
				sf = smooth(0, gap, e);
			}
			const k = s.tone * lerp(0.42, 1, sf);
			const i = y * W + x;
			col.set(i,
				clamp(lerp(dark[0], light[0], t) * k * (1 + s.warm), 0, 255),
				clamp(lerp(dark[1], light[1], t) * k, 0, 255),
				clamp(lerp(dark[2], light[2], t) * k * (1 - s.warm), 0, 255));
			H[i] = t * 0.18 + sf * 1.0 - (pore > 0.55 ? 0.05 : 0);
			Rg[i] = sf < 0.9 ? 0.85 : lerp(rough[0], rough[1], 1 - t) + kd * 0.1;
		}
	}
	return {
		map: toTex(col.done()),
		rough: toTex(grayTex(Rg, W, Hh), { srgb: false }),
		normal: toTex(normalFrom(H, W, Hh, normal), { srgb: false }),
	};
}

// ---------------------------------------------------------------- fabrics
function fabric(kind, seed = 3, size = 512) {
	const N = makeNoise(seed);
	const col = new Px(size, size); const H = new Float32Array(size * size);
	for (let y = 0; y < size; y++) {
		const v = y / size;
		for (let x = 0; x < size; x++) {
			const u = x / size, i = y * size + x;
			let h = 0, c = 0.9;
			if (kind === 'boucle') {
				const loops = N.ridge(u, v, 48, 48, 2);
				const fine = N.tile(u, v, 110, 110, 1);
				h = loops * 0.7 + fine * 0.3;
				c = 0.86 + h * 0.12 + N.tile(u, v, 6, 6, 2) * 0.03;
			} else if (kind === 'linen') {
				const T = 72;
				const tu = u * T, tv = v * T; const cu = Math.floor(tu), cv = Math.floor(tv);
				const fu = tu - cu, fv = tv - cv;
				const slubU = N.tile(u, v, T, 6, 2), slubV = N.tile(u, v, 6, T, 2);
				const warp = Math.pow(Math.sin(Math.PI * fu), 0.7) * (0.85 + 0.3 * slubU);
				const weft = Math.pow(Math.sin(Math.PI * fv), 0.7) * (0.85 + 0.3 * slubV);
				h = ((cu + cv) & 1) ? Math.max(warp, weft * 0.6) : Math.max(weft, warp * 0.6);
				c = 0.84 + h * 0.1 + (slubU + slubV) * 0.04;
			} else if (kind === 'velvet') {
				h = 0.5 + 0.3 * N.tile(u, v, 160, 160, 1);
				const crush = N.tile(u, v, 5, 5, 4);
				c = 0.8 + crush * 0.22 + h * 0.05;
				h += crush * 2;
			} else if (kind === 'knit') {
				const cols = 14, rows = 20;
				const cu = u * cols; const lx = cu - Math.floor(cu);
				const s = lx < 0.5 ? lx / 0.5 : (lx - 0.5) / 0.5;
				const rv = v * rows + (lx < 0.5 ? (1 - s) * 0.45 : s * 0.45);
				const ty = rv - Math.floor(rv);
				h = Math.pow(Math.sin(Math.PI * s), 0.6) * Math.pow(Math.sin(Math.PI * ty), 0.8);
				h += N.tile(u, v, 120, 120, 1) * 0.08;
				c = 0.72 + h * 0.28 + N.tile(u, v, 8, 8, 2) * 0.03;
			} else if (kind === 'fur') {
				const a = N.tile(u, v, 30, 30, 3), b = N.ridge(u, v, 70, 70, 2);
				h = a * 0.6 + b * 0.6;
				c = 0.8 + h * 0.18;
			}
			H[i] = h;
			const g = clamp(c, 0, 1) * 255;
			col.set(i, g, g * 0.985, g * 0.965);
		}
	}
	const strength = kind === 'knit' ? 5 : kind === 'boucle' ? 3 : kind === 'fur' ? 4 : 1.6;
	return { map: toTex(col.done()), normal: toTex(normalFrom(H, size, size, strength), { srgb: false }) };
}

// ---------------------------------------------------------------- stacked ledger stone
function ledgerStone(seed = 5, size = 512) {
	const N = makeNoise(seed), R = rng(seed);
	const rowsH = []; let tot = 0;
	while (tot < 1) { const h = 0.05 + R() * 0.07; rowsH.push(h); tot += h; }
	const sc = 1 / tot; for (let i = 0; i < rowsH.length; i++) rowsH[i] *= sc;
	const palette = [[132, 120, 108], [104, 96, 90], [152, 138, 120], [118, 104, 92], [96, 88, 84], [164, 150, 132]];
	const rows = []; let acc = 0;
	for (const h of rowsH) {
		const stones = []; let t = 0;
		while (t < 1) { const l = 0.12 + R() * 0.3; stones.push({ s: t, l, c: palette[Math.floor(R() * palette.length)], k: Math.floor(R() * 50), d: R() * 0.3 }); t += l; }
		const k = 1 / t; for (const s of stones) { s.s *= k; s.l *= k; }
		rows.push({ y0: acc, h, off: R(), stones }); acc += h;
	}
	const col = new Px(size, size); const H = new Float32Array(size * size); const Rg = new Float32Array(size * size);
	for (let y = 0; y < size; y++) {
		const v = 1 - (y + 0.5) / size;
		let ri = 0; while (ri < rows.length - 1 && v > rows[ri].y0 + rows[ri].h) ri++;
		const row = rows[ri]; const fy = (v - row.y0) / row.h;
		for (let x = 0; x < size; x++) {
			const u = (x + 0.5) / size;
			const uu = (u + row.off) % 1;
			let st = row.stones[0];
			for (const s of row.stones) if (uu >= s.s) st = s;
			const fx = (uu - st.s) / st.l;
			const ex = Math.min(fx, 1 - fx) * st.l * size, ey = Math.min(fy, 1 - fy) * row.h * size;
			const e = Math.min(ex, ey);
			const n = N.tile(u + st.k, v, 16, 16, 4);
			const edge = smooth(0, 6 + n * 3, e - 1.5);
			const i = y * size + x;
			const face = edge * (0.75 + st.d + n * 0.25);
			H[i] = face * 1.0 + N.tile(u, v, 60, 60, 2) * 0.08 * edge;
			const mortar = 1 - edge;
			const tone = 0.85 + n * 0.25 + N.tile(u, v, 40, 40, 2) * 0.08;
			const c = st.c;
			col.set(i,
				lerp(c[0] * tone, 62, mortar), lerp(c[1] * tone, 58, mortar), lerp(c[2] * tone, 54, mortar));
			Rg[i] = 0.75 + mortar * 0.2 - n * 0.08;
		}
	}
	return {
		map: toTex(col.done()), normal: toTex(normalFrom(H, size, size, 6), { srgb: false }),
		rough: toTex(grayTex(Rg, size, size), { srgb: false }),
	};
}

// ---------------------------------------------------------------- glazed zellige tiles
function zellige(seed = 9, size = 512) {
	const N = makeNoise(seed), R = rng(seed);
	const n = 6, cell = size / n;
	const tones = []; for (let i = 0; i < n * n; i++) tones.push([0.94 + R() * 0.08, R() * 0.04, Math.floor(R() * 30)]);
	const col = new Px(size, size); const H = new Float32Array(size * size);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
		const fx = x / cell - cx, fy = y / cell - cy;
		const e = Math.min(fx, 1 - fx, fy, 1 - fy) * cell;
		const t = tones[cy * n + cx];
		const g = smooth(1, 4, e);
		const wav = N.tile(x / size + t[2], y / size, 8, 8, 3);
		const i = y * size + x;
		H[i] = g * (1 + wav * 0.35);
		const k = t[0] * (0.96 + wav * 0.06);
		col.set(i, lerp(196, 238 * k, g), lerp(190, 229 * k * (1 - t[1]), g), lerp(180, 212 * k * (1 - t[1] * 2), g));
	}
	return { map: toTex(col.done()), normal: toTex(normalFrom(H, size, size, 2.5), { srgb: false }) };
}

function quartz(seed = 4, size = 512) {
	const N = makeNoise(seed); const col = new Px(size, size);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const u = x / size, v = y / size;
		const w = N.tile(u, v, 3, 3, 5);
		const vein = smooth(0.05, 0, Math.abs(w + N.tile(u, v, 9, 9, 3) * 0.25)) * 0.45;
		const speck = N.n2(u * 400, v * 400, 400, 400) > 0.7 ? 0.05 : 0;
		const c = 1 - vein * 0.35 - speck;
		col.set(y * size + x, 236 * c, 229 * c, 218 * c);
	}
	return toTex(col.done());
}

// ---------------------------------------------------------------- woven rug (one-off, not tiled)
function rug(seed = 21) {
	const W = 1024, Hh = 384;
	const N = makeNoise(seed); const col = new Px(W, Hh); const H = new Float32Array(W * Hh);
	const cream = [226, 212, 190], rust = [150, 72, 44], brown = [86, 56, 40], char = [52, 44, 40], camel = [184, 140, 96];
	for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
		const u = x / W, v = y / Hh;
		const bx = Math.min(u, 1 - u) * W, by = Math.min(v, 1 - v) * Hh;
		const b = Math.min(bx, by);
		let c = cream;
		if (b < 16) c = brown;
		else if (b < 22) c = cream;
		else if (b < 44) {
			const t = b - 22; const tri = Math.abs(((x + y) % 44) - 22);
			c = tri < t ? rust : camel;
		} else if (b < 50) c = char;
		else {
			const cu = (u * 4) % 1; const dx = Math.abs(cu - 0.5) * 4 * (W / 4) / Hh, dy = Math.abs(v - 0.5) * 2;
			const d = dx + dy * 1.15;
			if (d < 0.18) c = rust; else if (d < 0.24) c = char; else if (d < 0.4) c = camel;
			else if (d < 0.44) c = brown; else if (d < 0.62 && ((Math.floor(d * 60)) % 3 === 0)) c = rust;
		}
		const row = 0.5 + 0.5 * Math.sin(y * 1.6);
		const fib = N.tile(u, v, 300, 120, 2);
		const ab = 1 - Math.abs(N.tile(u, v, 12, 5, 3)) * 0.15;
		const k = (0.86 + row * 0.08 + fib * 0.08) * ab;
		const i = y * W + x;
		col.set(i, c[0] * k, c[1] * k, c[2] * k);
		H[i] = row * 0.6 + fib * 0.6;
	}
	return { map: toTex(col.done(), { repeat: false }), normal: toTex(normalFrom(H, W, Hh, 1.5), { srgb: false, repeat: false }) };
}

function tartan(size = 512) {
	const sett = [[232, 222, 202, 18], [120, 82, 56, 10], [232, 222, 202, 4], [176, 128, 86, 22], [70, 46, 34, 6], [160, 70, 42, 3], [70, 46, 34, 6]];
	const total = sett.reduce((a, s) => a + s[3], 0) * 2;
	const stripe = (p) => {
		let q = p % total; if (q >= total / 2) q = total - 1 - q;
		for (const s of sett) { if (q < s[3]) return s; q -= s[3]; }
		return sett[0];
	};
	const sc = total / size; const col = new Px(size, size); const H = new Float32Array(size * size);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const warp = stripe(Math.floor(x * sc)), weft = stripe(Math.floor(y * sc));
		const tw = ((x + y) >> 1) & 1;
		const c = tw ? warp : weft;
		const i = y * size + x;
		const k = 0.9 + 0.1 * Math.sin((tw ? y : x) * 2.2);
		col.set(i, c[0] * k, c[1] * k, c[2] * k);
		H[i] = tw ? Math.sin(x * 0.8) : Math.sin(y * 0.8);
	}
	return { map: toTex(col.done()), normal: toTex(normalFrom(H, size, size, 0.6), { srgb: false }) };
}

function bark(seed = 31, size = 512) {
	const N = makeNoise(seed); const col = new Px(size, size); const H = new Float32Array(size * size);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const u = x / size, v = y / size;
		const f = N.ridge(u, v, 9, 2, 5);
		const plates = N.tile(u, v, 6, 10, 3);
		const h = Math.pow(f, 2.2) * 0.8 + plates * 0.2;
		const lich = smooth(0.35, 0.6, N.tile(u, v, 5, 7, 4));
		const i = y * size + x;
		H[i] = h;
		const t = clamp(h, 0, 1);
		col.set(i, lerp(lerp(46, 118, t), 128, lich * 0.4), lerp(lerp(38, 104, t), 132, lich * 0.4), lerp(lerp(33, 92, t), 118, lich * 0.4));
	}
	return { map: toTex(col.done()), normal: toTex(normalFrom(H, size, size, 5), { srgb: false }) };
}

function snowTex(seed = 41, size = 512) {
	const N = makeNoise(seed); const H = new Float32Array(size * size); const col = new Px(size, size);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const u = x / size, v = y / size;
		const h = N.tile(u, v, 6, 6, 4) * 0.5 + N.tile(u, v, 32, 32, 2) * 0.35 + N.tile(u, v, 96, 96, 1) * 0.15;
		const i = y * size + x; H[i] = h;
		const c = 0.93 + h * 0.07;
		col.set(i, 236 * c, 242 * c, 252 * c);
	}
	return { map: toTex(col.done()), normal: toTex(normalFrom(H, size, size, 2.2), { srgb: false }) };
}

function brushed(seed = 51, size = 256) {
	const N = makeNoise(seed); const G = new Float32Array(size * size);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) G[y * size + x] = 0.28 + N.tile(x / size, y / size, 2, 128, 2) * 0.1;
	return toTex(grayTex(G, size, size), { srgb: false });
}

function leather(seed = 61, size = 256) {
	const N = makeNoise(seed); const H = new Float32Array(size * size); const col = new Px(size, size);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const u = x / size, v = y / size;
		const h = N.ridge(u, v, 28, 28, 2);
		const i = y * size + x; H[i] = h;
		const c = 0.85 + h * 0.15 + N.tile(u, v, 4, 4, 2) * 0.06;
		col.set(i, 92 * c, 58 * c, 38 * c);
	}
	return { map: toTex(col.done()), normal: toTex(normalFrom(H, size, size, 2), { srgb: false }) };
}

// ---------------------------------------------------------------- spruce bough with alpha
function frond(seed = 71) {
	const W = 256, Hh = 512; const c = mkCanvas(W, Hh); const g = c.getContext('2d');
	const R = rng(seed);
	g.clearRect(0, 0, W, Hh);
	const twig = (x0, y0, ang, len, wid, depth) => {
		const steps = Math.max(6, Math.floor(len / 6));
		let x = x0, y = y0, a = ang;
		for (let s = 0; s < steps; s++) {
			const t = s / steps;
			const nx = x + Math.cos(a) * len / steps, ny = y + Math.sin(a) * len / steps;
			g.strokeStyle = `rgb(${70 + R() * 20},${52 + R() * 10},${38})`;
			g.lineWidth = wid * (1 - t * 0.7);
			g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
			const nl = (depth ? 13 : 10) * (1 - t * 0.55) + R() * 4;
			for (let k = 0; k < 7; k++) {
				const side = k & 1 ? 1 : -1;
				const na = a + side * (0.7 + R() * 0.6) - 0.15;
				const px = lerp(x, nx, R()), py = lerp(y, ny, R());
				const sh = 0.75 + R() * 0.35;
				g.strokeStyle = `rgb(${(26 + R() * 22) * sh},${(52 + R() * 34) * sh},${(36 + R() * 20) * sh})`;
				g.lineWidth = 1.6 + R() * 1.2;
				g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(na) * nl, py + Math.sin(na) * nl); g.stroke();
			}
			if (depth > 0 && s % 2 === 1 && t < 0.85) {
				for (const side of [-1, 1]) {
					twig(nx, ny, a + side * (0.55 + R() * 0.25), len * (0.42 - t * 0.3) * (0.8 + R() * 0.4), wid * 0.5, depth - 1);
				}
			}
			x = nx; y = ny; a += (R() - 0.5) * 0.08;
		}
	};
	twig(W / 2, Hh - 4, -Math.PI / 2, Hh - 30, 5, 1);
	return toTex(c, { repeat: false });
}

// ---------------------------------------------------------------- painted art & photos
function painting(seed = 81) {
	const W = 640, Hh = 448; const c = mkCanvas(W, Hh); const g = c.getContext('2d');
	const N = makeNoise(seed), R = rng(seed);
	const sky = g.createLinearGradient(0, 0, 0, Hh * 0.62);
	sky.addColorStop(0, '#2c3150'); sky.addColorStop(0.45, '#8a6f86'); sky.addColorStop(0.8, '#e7a77d'); sky.addColorStop(1, '#f2d2a6');
	g.fillStyle = sky; g.fillRect(0, 0, W, Hh);
	g.fillStyle = 'rgba(255,236,200,0.9)'; g.beginPath(); g.arc(W * 0.68, Hh * 0.5, 22, 0, 7); g.fill();
	const layers = [['#9a8aa0', 0.42, 60], ['#6d6683', 0.5, 50], ['#4a4b63', 0.58, 42], ['#2d3442', 0.66, 30]];
	layers.forEach(([color, base, amp], li) => {
		g.fillStyle = color; g.beginPath(); g.moveTo(0, Hh);
		for (let x = 0; x <= W; x += 4) {
			const n = N.fbm(x / 160 + li * 7, li * 3.1, 999, 999, 5);
			g.lineTo(x, Hh * base - Math.abs(n) * amp * 2.2 - amp * 0.3);
		}
		g.lineTo(W, Hh); g.fill();
	});
	g.fillStyle = '#1d2329';
	for (let i = 0; i < 70; i++) {
		const x = R() * W, h = 18 + R() * 40, y = Hh * 0.7 + R() * 14;
		g.beginPath(); g.moveTo(x, y - h); g.lineTo(x - h * 0.22, y); g.lineTo(x + h * 0.22, y); g.fill();
	}
	const lake = g.createLinearGradient(0, Hh * 0.72, 0, Hh);
	lake.addColorStop(0, '#d9a07c'); lake.addColorStop(0.5, '#7b6a82'); lake.addColorStop(1, '#2f3349');
	g.fillStyle = lake; g.fillRect(0, Hh * 0.72, W, Hh * 0.28);
	for (let i = 0; i < 160; i++) {
		g.fillStyle = `rgba(255,230,200,${R() * 0.18})`;
		g.fillRect(R() * W, Hh * 0.72 + R() * Hh * 0.28, 10 + R() * 50, 1.5);
	}
	const snap = g.getImageData(0, 0, W, Hh).data;
	for (let i = 0; i < 2600; i++) {
		const x = R() * W, y = R() * Hh;
		const k = ((y | 0) * W + (x | 0)) * 4;
		g.fillStyle = `rgba(${snap[k]},${snap[k + 1]},${snap[k + 2]},0.5)`;
		g.save(); g.translate(x, y); g.rotate((R() - 0.5) * 0.6); g.fillRect(-6, -1.5, 12, 3); g.restore();
	}
	return toTex(c, { repeat: false });
}

function fernPrint(seed = 82) {
	const W = 360, Hh = 480; const c = mkCanvas(W, Hh); const g = c.getContext('2d'); const R = rng(seed);
	g.fillStyle = '#efe6d6'; g.fillRect(0, 0, W, Hh);
	g.strokeStyle = '#4b5a3e'; g.lineCap = 'round';
	const stem = (x, y, a, len, w) => {
		g.lineWidth = w; let px = x, py = y;
		for (let i = 0; i < 30; i++) {
			const t = i / 30; const nx = px + Math.cos(a) * len / 30, ny = py + Math.sin(a) * len / 30;
			g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
			if (i % 2 === 0 && w > 1) {
				const ll = len * 0.28 * (1 - t);
				for (const s of [-1, 1]) {
					g.lineWidth = w * 0.5;
					g.beginPath(); g.moveTo(nx, ny);
					g.quadraticCurveTo(nx + Math.cos(a + s * 1.1) * ll * 0.6, ny + Math.sin(a + s * 1.1) * ll * 0.6, nx + Math.cos(a + s * 0.8) * ll, ny + Math.sin(a + s * 0.8) * ll);
					g.stroke(); g.lineWidth = w;
				}
			}
			a += 0.012; px = nx; py = ny;
		}
	};
	stem(W * 0.45, Hh * 0.9, -Math.PI / 2 - 0.15, Hh * 0.75, 3);
	stem(W * 0.5, Hh * 0.9, -Math.PI / 2 + 0.35, Hh * 0.55, 2.4);
	g.fillStyle = '#6b5a4a'; g.font = 'italic 16px Georgia, serif'; g.textAlign = 'center';
	g.fillText('Polystichum munitum', W / 2, Hh - 22);
	for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(120,100,80,${R() * 0.05})`; g.fillRect(R() * W, R() * Hh, 1, 1); }
	return toTex(c, { repeat: false });
}

function photo(kind, seed) {
	const W = 160, Hh = 190; const c = mkCanvas(W, Hh); const g = c.getContext('2d'); const R = rng(seed);
	g.fillStyle = '#f4efe6'; g.fillRect(0, 0, W, Hh);
	const x0 = 10, y0 = 10, w = W - 20, h = W - 20;
	const gr = g.createLinearGradient(0, y0, 0, y0 + h);
	if (kind === 0) { gr.addColorStop(0, '#f2a65a'); gr.addColorStop(0.55, '#f7d08a'); gr.addColorStop(0.56, '#3d6a85'); gr.addColorStop(1, '#244255'); }
	if (kind === 1) { gr.addColorStop(0, '#8fb3d1'); gr.addColorStop(0.6, '#d8e4ee'); gr.addColorStop(0.61, '#c98b54'); gr.addColorStop(1, '#a5643a'); }
	if (kind === 2) { gr.addColorStop(0, '#0f1a33'); gr.addColorStop(1, '#2a3d5c'); }
	if (kind === 3) { gr.addColorStop(0, '#b9d1d6'); gr.addColorStop(0.5, '#6e8f7a'); gr.addColorStop(1, '#2f4a3a'); }
	if (kind === 4) { gr.addColorStop(0, '#e9c7a8'); gr.addColorStop(1, '#a7765a'); }
	g.fillStyle = gr; g.fillRect(x0, y0, w, h);
	g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
	if (kind === 0) { g.fillStyle = '#fff1c9'; g.beginPath(); g.arc(x0 + w * 0.6, y0 + h * 0.52, 12, 0, 7); g.fill(); }
	if (kind === 1) { g.fillStyle = '#b3703f'; g.beginPath(); g.moveTo(x0, y0 + h * 0.6); g.quadraticCurveTo(x0 + w * 0.4, y0 + h * 0.3, x0 + w, y0 + h * 0.62); g.lineTo(x0 + w, y0 + h); g.lineTo(x0, y0 + h); g.fill(); }
	if (kind === 2) { for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${R()})`; g.fillRect(x0 + R() * w, y0 + R() * h * 0.7, 1.2, 1.2); } g.fillStyle = '#0a0f18'; g.beginPath(); g.moveTo(x0, y0 + h); for (let x = 0; x <= w; x += 8) g.lineTo(x0 + x, y0 + h * 0.75 - R() * 20); g.lineTo(x0 + w, y0 + h); g.fill(); }
	if (kind === 3) { g.fillStyle = '#25392d'; for (let i = 0; i < 14; i++) { const x = x0 + R() * w, hh = 30 + R() * 50; g.beginPath(); g.moveTo(x, y0 + h * 0.6 - hh); g.lineTo(x - 9, y0 + h * 0.62); g.lineTo(x + 9, y0 + h * 0.62); g.fill(); } }
	if (kind === 4) { g.fillStyle = '#6b4a3a'; g.beginPath(); g.arc(x0 + w * 0.42, y0 + h * 0.55, 26, 0, 7); g.fill(); g.fillStyle = '#c99d7a'; g.beginPath(); g.arc(x0 + w * 0.42, y0 + h * 0.45, 13, 0, 7); g.fill(); g.fillStyle = '#7a5b4b'; g.beginPath(); g.arc(x0 + w * 0.66, y0 + h * 0.58, 20, 0, 7); g.fill(); g.fillStyle = '#d4a989'; g.beginPath(); g.arc(x0 + w * 0.66, y0 + h * 0.47, 11, 0, 7); g.fill(); }
	g.restore();
	g.fillStyle = 'rgba(70,60,50,0.75)'; g.font = 'italic 13px "Segoe Print", "Bradley Hand", cursive';
	g.fillText(['Big Sur', 'Moab', 'Yellowknife', 'Banff', 'us, 2025'][kind], 14, Hh - 14);
	return toTex(c, { repeat: false });
}

function sideGraphics(mirror) {
	const W = 2048, Hh = 512; const c = mkCanvas(W, Hh); const g = c.getContext('2d');
	const base = g.createLinearGradient(0, 0, 0, Hh);
	base.addColorStop(0, '#efebe4'); base.addColorStop(0.85, '#e7e1d8'); base.addColorStop(1, '#d9d1c4');
	g.fillStyle = base; g.fillRect(0, 0, W, Hh);
	g.save();
	if (mirror) { g.translate(W, 0); g.scale(-1, 1); }
	const sw = (y0, y1, y2, y3, color) => {
		g.fillStyle = color; g.beginPath();
		g.moveTo(0, Hh * y0);
		g.bezierCurveTo(W * 0.35, Hh * y0, W * 0.55, Hh * y1, W, Hh * y1 - Hh * 0.05);
		g.lineTo(W, Hh * y2);
		g.bezierCurveTo(W * 0.6, Hh * y3, W * 0.3, Hh * y3 + Hh * 0.08, 0, Hh * y3 + Hh * 0.08);
		g.closePath(); g.fill();
	};
	sw(0.70, 0.48, 0.56, 0.78, '#b9996c');
	sw(0.74, 0.55, 0.66, 0.86, '#4a3326');
	g.fillStyle = '#3a291f'; g.fillRect(0, Hh * 0.93, W, Hh * 0.07);
	g.strokeStyle = '#c8aa7a'; g.lineWidth = 3; g.beginPath();
	g.moveTo(0, Hh * 0.66); g.bezierCurveTo(W * 0.35, Hh * 0.66, W * 0.55, Hh * 0.44, W, Hh * 0.38); g.stroke();
	g.restore();
	g.fillStyle = '#9c7d55'; g.font = 'italic 600 56px Georgia, "Times New Roman", serif';
	g.textAlign = mirror ? 'right' : 'left';
	g.fillText('Senritha', mirror ? W - 110 : 110, Hh * 0.17);
	return toTex(c, { repeat: false });
}

function frost(seed = 91, size = 512) {
	const N = makeNoise(seed); const R = rng(seed);
	const c = mkCanvas(size, size); const g = c.getContext('2d');
	const px = g.createImageData(size, size);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const u = x / size, v = y / size;
		const e = Math.min(u, 1 - u, v * 1.6, 1 - v);
		const corner = Math.min(Math.hypot(u, v), Math.hypot(1 - u, v), Math.hypot(u, 1 - v), Math.hypot(1 - u, 1 - v));
		const n = N.tile(u, v, 10, 10, 5);
		const a = smooth(0.1, 0.0, e + n * 0.05) * 0.8 + smooth(0.26, 0.02, corner + n * 0.08) * 0.55;
		const k = (y * size + x) * 4;
		const val = clamp(a, 0, 1) * 255;
		px.data[k] = px.data[k + 1] = px.data[k + 2] = val; px.data[k + 3] = 255;
	}
	g.putImageData(px, 0, 0);
	g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1;
	const fern = (x, y, a, l, d) => {
		if (d === 0 || l < 3) return;
		const nx = x + Math.cos(a) * l, ny = y + Math.sin(a) * l;
		g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
		fern(nx, ny, a + (R() - 0.5) * 0.4, l * 0.8, d - 1);
		if (R() < 0.7) fern(nx, ny, a + 0.8, l * 0.5, d - 1);
		if (R() < 0.7) fern(nx, ny, a - 0.8, l * 0.5, d - 1);
	};
	for (let i = 0; i < 26; i++) {
		const side = i % 4; const t = R();
		const [x, y, a] = side === 0 ? [t * size, size - 2, -Math.PI / 2] : side === 1 ? [2, t * size, 0] : side === 2 ? [size - 2, t * size, Math.PI] : [t * size, 2, Math.PI / 2];
		fern(x, y, a + (R() - 0.5) * 0.6, 14 + R() * 12, 6);
	}
	return toTex(c, { srgb: false, repeat: false });
}

function clockFace() {
	const S = 256; const c = mkCanvas(S, S); const g = c.getContext('2d');
	g.fillStyle = '#efe7da'; g.fillRect(0, 0, S, S);
	g.translate(S / 2, S / 2);
	g.fillStyle = '#3b2c22'; g.font = '500 26px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
	for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2; g.fillText(String(i), Math.sin(a) * 92, -Math.cos(a) * 92); }
	for (let i = 0; i < 60; i++) {
		const a = i / 60 * Math.PI * 2; const r0 = i % 5 ? 116 : 110;
		g.lineWidth = i % 5 ? 1 : 2.5; g.strokeStyle = '#3b2c22';
		g.beginPath(); g.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0); g.lineTo(Math.sin(a) * 122, -Math.cos(a) * 122); g.stroke();
	}
	g.font = 'italic 13px Georgia, serif'; g.fillText('Pine Hollow', 0, 40);
	return toTex(c, { repeat: false });
}

function bookPages() {
	const W = 512, Hh = 340; const c = mkCanvas(W, Hh); const g = c.getContext('2d'); const R = rng(7);
	const gr = g.createLinearGradient(0, 0, W, 0);
	gr.addColorStop(0, '#efe5d3'); gr.addColorStop(0.47, '#e9dcc5'); gr.addColorStop(0.5, '#cdbd9f'); gr.addColorStop(0.53, '#e9dcc5'); gr.addColorStop(1, '#efe5d3');
	g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
	g.fillStyle = 'rgba(60,50,40,0.55)';
	for (const x0 of [34, W / 2 + 26]) {
		for (let y = 40; y < Hh - 36; y += 13) {
			let x = x0; const end = x0 + W / 2 - 60;
			while (x < end) { const w = 6 + R() * 26; if (x + w > end) break; g.fillRect(x, y, w, 3); x += w + 5; }
		}
	}
	return toTex(c, { repeat: false });
}

function spine() {
	const W = 64, Hh = 256; const c = mkCanvas(W, Hh); const g = c.getContext('2d');
	g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, W, Hh);
	g.fillStyle = '#fff6d8'; g.fillRect(0, 18, W, 5); g.fillRect(0, 28, W, 2); g.fillRect(0, Hh - 26, W, 5);
	g.fillStyle = '#bdbdbd'; g.fillRect(14, 70, W - 28, 110);
	const sh = g.createLinearGradient(0, 0, W, 0);
	sh.addColorStop(0, 'rgba(0,0,0,0.25)'); sh.addColorStop(0.3, 'rgba(0,0,0,0)'); sh.addColorStop(0.75, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)');
	g.fillStyle = sh; g.fillRect(0, 0, W, Hh);
	return toTex(c, { repeat: false });
}

function endGrain(seed = 101) {
	const S = 256; const N = makeNoise(seed); const col = new Px(S, S);
	for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
		const u = x / S - 0.5, v = y / S - 0.5; const r = Math.hypot(u, v) * 2;
		const n = N.fbm(u * 6, v * 6, 999, 999, 3);
		const ring = 0.5 + 0.5 * Math.sin((r + n * 0.05) * 70);
		const crack = Math.abs(N.fbm(Math.atan2(v, u) * 3, r * 2, 999, 999, 2)) < 0.03 ? 0.5 : 1;
		const barkR = smooth(0.86, 0.92, r);
		const i = y * S + x;
		const base = [lerp(196, 170, ring) * crack, lerp(164, 132, ring) * crack, lerp(120, 92, ring) * crack];
		col.set(i, lerp(base[0], 60, barkR), lerp(base[1], 46, barkR), lerp(base[2], 38, barkR));
	}
	return toTex(col.done(), { repeat: false });
}

function embers(seed = 111, size = 256) {
	const N = makeNoise(seed); const col = new Px(size, size);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const u = x / size, v = y / size;
		const cr = N.ridge(u, v, 10, 4, 4);
		const glow = smooth(0.82, 0.97, cr) * (0.5 + 0.5 * N.tile(u, v, 3, 3, 2));
		col.set(y * size + x, 255 * glow, 110 * glow * glow, 30 * glow * glow * glow);
	}
	return toTex(col.done());
}

function birch(seed = 131, size = 256) {
	const N = makeNoise(seed); const col = new Px(size, size); const H = new Float32Array(size * size);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const u = x / size, v = y / size;
		const len = N.tile(u, v, 3, 22, 3);
		const mark = smooth(0.42, 0.55, len) * smooth(0.2, 0.5, N.tile(u, v, 8, 3, 2) + 0.3);
		const scar = smooth(0.62, 0.7, N.tile(u, v, 2, 5, 4) + 0.2);
		const base = 0.88 + N.tile(u, v, 4, 40, 2) * 0.08;
		const dark = Math.max(mark, scar * 0.9);
		const i = y * size + x;
		col.set(i, lerp(232 * base, 40, dark), lerp(226 * base, 34, dark), lerp(214 * base, 30, dark));
		H[i] = 1 - dark * 0.6 + N.tile(u, v, 30, 8, 2) * 0.05;
	}
	return { map: toTex(col.done()), normal: toTex(normalFrom(H, size, size, 2), { srgb: false }) };
}

function latte() {
	const S = 256; const c = mkCanvas(S, S); const g = c.getContext('2d');
	const gr = g.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
	gr.addColorStop(0, '#c08a58'); gr.addColorStop(0.75, '#a46a3c'); gr.addColorStop(1, '#6e4224');
	g.fillStyle = gr; g.fillRect(0, 0, S, S);
	g.fillStyle = '#f4e8d6';
	g.beginPath();
	g.moveTo(S / 2, S * 0.78);
	g.bezierCurveTo(S * 0.12, S * 0.5, S * 0.22, S * 0.2, S / 2, S * 0.36);
	g.bezierCurveTo(S * 0.78, S * 0.2, S * 0.88, S * 0.5, S / 2, S * 0.78);
	g.fill();
	g.strokeStyle = '#b07848'; g.lineWidth = 4;
	g.beginPath(); g.moveTo(S / 2, S * 0.3); g.lineTo(S / 2, S * 0.8); g.stroke();
	return toTex(c, { repeat: false });
}

function radial(w, h, stops) {
	const c = mkCanvas(w, h); const g = c.getContext('2d');
	const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) / 2);
	for (const [o, col] of stops) gr.addColorStop(o, col);
	g.fillStyle = gr; g.fillRect(0, 0, w, h);
	return c;
}

function footprints(seed = 121) {
	const W = 128, Hh = 1024; const c = mkCanvas(W, Hh); const g = c.getContext('2d'); const R = rng(seed);
	g.fillStyle = '#000'; g.fillRect(0, 0, W, Hh);
	for (let y = 30, i = 0; y < Hh - 30; y += 46, i++) {
		const x = W / 2 + (i % 2 ? 18 : -18) + (R() - 0.5) * 6;
		const gr = g.createRadialGradient(x, y, 2, x, y, 22);
		gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
		g.fillStyle = gr; g.save(); g.translate(x, y); g.rotate((R() - 0.5) * 0.3); g.scale(0.55, 1); g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill(); g.restore();
	}
	return toTex(c, { srgb: false, repeat: false });
}

export async function buildTextures(renderer, progress = () => {}) {
	ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
	const T = {};
	const steps = [
		['floor', () => woodPlanks({ size: 1024, rows: 9, seg: [1, 3], seed: 2, dark: [104, 66, 38], light: [184, 132, 84], gap: 2.2, ring: 0.6, knots: 0.25, normal: 4 })],
		['wall', () => woodPlanks({ size: 1024, rows: 12, seg: [1, 2], seed: 7, dark: [176, 136, 98], light: [226, 196, 158], gap: 1.6, ring: 0.45, knots: 0.15, tone: 0.08, rough: [0.5, 0.7], normal: 3 })],
		['ceiling', () => woodPlanks({ size: 512, rows: 8, seg: [1, 1], seed: 13, dark: [190, 152, 112], light: [232, 206, 170], gap: 2.5, ring: 0.4, knots: 0.05, tone: 0.06, rough: [0.55, 0.7], grainFv: 50, normal: 3 })],
		['walnut', () => woodPlanks({ size: 512, rows: 3, seg: [1, 1], seed: 17, dark: [46, 28, 18], light: [118, 76, 46], gap: 0, ring: 0.7, knots: 0.0, tone: 0.06, rough: [0.32, 0.5], grainFv: 40, normal: 1.5 })],
		['boucle', () => fabric('boucle', 3)],
		['linen', () => fabric('linen', 5)],
		['velvet', () => fabric('velvet', 6)],
		['knit', () => fabric('knit', 8)],
		['fur', () => fabric('fur', 10)],
		['stone', () => ledgerStone(5)],
		['zellige', () => zellige(9)],
		['quartz', () => quartz(4)],
		['rug', () => rug(21)],
		['tartan', () => tartan()],
		['bark', () => bark(31)],
		['snow', () => snowTex(41)],
		['brushed', () => brushed(51)],
		['leather', () => leather(61)],
		['frond', () => frond(71)],
		['painting', () => painting(81)],
		['fern', () => fernPrint(82)],
		['photos', () => [0, 1, 2, 3, 4].map((k) => photo(k, 200 + k))],
		['sideR', () => sideGraphics(false)],
		['sideL', () => sideGraphics(true)],
		['frost', () => frost(91)],
		['clock', () => clockFace()],
		['pages', () => bookPages()],
		['spine', () => spine()],
		['endGrain', () => endGrain(101)],
		['embers', () => embers(111)],
		['birch', () => birch(131)],
		['latte', () => latte()],
		['spill', () => toTex(radial(256, 256, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]), { srgb: false, repeat: false })],
		['footprints', () => footprints(121)],
	];
	for (let i = 0; i < steps.length; i++) {
		const [k, fn] = steps[i];
		T[k] = fn();
		progress((i + 1) / steps.length, k);
		await tick();
	}
	return T;
}
