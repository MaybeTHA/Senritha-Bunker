// Builds the three nested height grids (in workers when possible), carves the route, camp
// and summit into the detail grid, and answers height / normal / surface queries on the CPU.
// The blend between grids matches the terrain vertex shader exactly.
import { DETAIL, FINE, COARSE, buildRoute, carve, campHeight, fillHeights, CAMP, SUMMIT_XZ } from './world.js';
import { smoothstep, clamp } from './noise.js';

export const BLEND = { detail: 48, fine: 160 };

class Grid {
	constructor(region, res, data) {
		this.region = region; this.res = res; this.h = data;
		this.step = region.size / (res - 1);
		this.inv = 1 / this.step;
		this.n = null;    // Float32 nx, nz, path, cavity per texel
	}
	sample(x, z) {
		const r = this.res;
		let fx = (x - this.region.x0) * this.inv, fz = (z - this.region.z0) * this.inv;
		fx = clamp(fx, 0, r - 1.001); fz = clamp(fz, 0, r - 1.001);
		const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j;
		const o = j * r + i, h = this.h;
		const a = h[o] + (h[o + 1] - h[o]) * tx;
		const b = h[o + r] + (h[o + r + 1] - h[o + r]) * tx;
		return a + (b - a) * tz;
	}
	sampleN(x, z, c) {
		const r = this.res;
		let fx = (x - this.region.x0) * this.inv, fz = (z - this.region.z0) * this.inv;
		fx = clamp(fx, 0, r - 1.001); fz = clamp(fz, 0, r - 1.001);
		const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j;
		const o = (j * r + i) * 4 + c, n = this.n;
		const a = n[o] + (n[o + 4] - n[o]) * tx;
		const b = n[o + r * 4] + (n[o + r * 4 + 4] - n[o + r * 4]) * tx;
		return a + (b - a) * tz;
	}
	edge(x, z) {
		const R = this.region;
		return Math.min(x - R.x0, R.x0 + R.size - x, z - R.z0, R.z0 + R.size - z);
	}
	// normals (central differences), path mask and cavity
	derive(mask, blurR) {
		const r = this.res, h = this.h, s2 = 2 * this.step;
		const n = new Float32Array(r * r * 4);
		const blur = boxBlur(h, r, blurR);
		const k = 1 / (this.step * blurR * 0.35);
		for (let j = 0; j < r; j++) {
			const jm = Math.max(0, j - 1) * r, jp = Math.min(r - 1, j + 1) * r, jr = j * r;
			for (let i = 0; i < r; i++) {
				const im = Math.max(0, i - 1), ip = Math.min(r - 1, i + 1);
				const dx = (h[jr + ip] - h[jr + im]) / s2, dz = (h[jp + i] - h[jm + i]) / s2;
				const il = 1 / Math.sqrt(dx * dx + 1 + dz * dz);
				const o = (jr + i) * 4;
				n[o] = -dx * il; n[o + 1] = -dz * il;
				n[o + 2] = mask ? mask[jr + i] : 0;
				n[o + 3] = 0.5 + 0.5 * Math.tanh((h[jr + i] - blur[jr + i]) * k);
			}
		}
		this.n = n;
	}
}

function boxBlur(src, r, rad) {
	const tmp = new Float32Array(r * r), out = new Float32Array(r * r);
	const w = 2 * rad + 1;
	for (let pass = 0; pass < 2; pass++) {
		const a = pass ? tmp : src, b = pass ? out : tmp;
		for (let j = 0; j < r; j++) {
			let acc = 0;
			for (let k = -rad; k <= rad; k++) acc += a[j * r + clamp(k, 0, r - 1)];
			for (let i = 0; i < r; i++) {
				b[i * r + j] = acc / w; // transpose while writing
				acc += a[j * r + Math.min(r - 1, i + rad + 1)] - a[j * r + Math.max(0, i - rad)];
			}
		}
	}
	return out;
}

export class Heightfield {
	constructor(detail, fine, coarse, route, campY) {
		this.detail = detail; this.fine = fine; this.coarse = coarse;
		this.route = route; this.campY = campY;
	}
	weights(x, z) {
		const wd = smoothstep(0, BLEND.detail, this.detail.edge(x, z));
		const wf = smoothstep(0, BLEND.fine, this.fine.edge(x, z));
		return [wd, wf];
	}
	height(x, z) {
		const [wd, wf] = this.weights(x, z);
		if (wd >= 1) return this.detail.sample(x, z);
		let h = wf > 0 ? this.fine.sample(x, z) : 0;
		if (wf < 1) h = this.coarse.sample(x, z) * (1 - wf) + h * wf;
		if (wd > 0) h = h * (1 - wd) + this.detail.sample(x, z) * wd;
		return h;
	}
	// channel: 0 nx, 1 nz, 2 path, 3 cavity
	field(x, z, c) {
		const [wd, wf] = this.weights(x, z);
		if (wd >= 1) return this.detail.sampleN(x, z, c);
		let v = wf > 0 ? this.fine.sampleN(x, z, c) : 0;
		if (wf < 1) v = this.coarse.sampleN(x, z, c) * (1 - wf) + v * wf;
		if (wd > 0) v = v * (1 - wd) + this.detail.sampleN(x, z, c) * wd;
		return v;
	}
	normal(x, z, out = { x: 0, y: 1, z: 0 }) {
		const nx = this.field(x, z, 0), nz = this.field(x, z, 1);
		out.x = nx; out.z = nz; out.y = Math.sqrt(Math.max(0, 1 - nx * nx - nz * nz));
		return out;
	}
	pathMask(x, z) { return this.detail.edge(x, z) > 0 ? this.detail.sampleN(x, z, 2) : 0; }
	// nearest route index (coarse search then refine)
	nearestRoute(x, z, hint = -1) {
		const R = this.route;
		let best = 1e18, bi = 0;
		const a = hint >= 0 ? Math.max(0, hint - 60) : 0, b = hint >= 0 ? Math.min(R.length, hint + 60) : R.length;
		const stepI = hint >= 0 ? 1 : 4;
		for (let i = a; i < b; i += stepI) { const d = (R[i].x - x) ** 2 + (R[i].z - z) ** 2; if (d < best) { best = d; bi = i; } }
		if (stepI > 1) for (let i = Math.max(0, bi - 4); i < Math.min(R.length, bi + 5); i++) { const d = (R[i].x - x) ** 2 + (R[i].z - z) ** 2; if (d < best) { best = d; bi = i; } }
		return { i: bi, d: Math.sqrt(best) };
	}
}

// ---------------------------------------------------------------- generation
export async function generate(res, onProgress = () => {}) {
	const jobs = [];
	const ROWS = 48;
	const grids = {};
	for (const [name, r] of Object.entries(res)) {
		grids[name] = new Float32Array(r * r);
		for (let r0 = 0; r0 < r; r0 += ROWS) jobs.push({ region: name, res: r, r0, r1: Math.min(r, r0 + ROWS) });
	}
	const total = jobs.length;
	let done = 0;
	const regions = { detail: DETAIL, fine: FINE, coarse: COARSE };

	let workers = [];
	const nW = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
	try {
		for (let i = 0; i < nW; i++) workers.push(new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' }));
	} catch { workers = []; }

	if (workers.length) {
		const ok = await new Promise((resolve) => {
			let next = 0, failed = false;
			const feed = (w) => {
				if (next >= jobs.length) return;
				const j = jobs[next++];
				w.postMessage({ id: next, ...j });
			};
			for (const w of workers) {
				w.onmessage = (e) => {
					const { region, r0, out } = e.data;
					grids[region].set(out, r0 * res[region]);
					done++;
					onProgress(done / total);
					if (done === total) resolve(true); else feed(w);
				};
				w.onerror = () => { if (!failed) { failed = true; resolve(false); } };
				feed(w);
			}
		});
		workers.forEach((w) => w.terminate());
		if (!ok) { done = 0; workers = []; }
	}
	if (!workers.length || done < total) {
		// main-thread fallback, yielding so the progress bar moves
		for (const j of jobs) {
			const out = new Float32Array((j.r1 - j.r0) * j.res);
			fillHeights(regions[j.region], j.res, j.r0, j.r1, out, j.r0);
			grids[j.region].set(out, j.r0 * j.res);
			done++; onProgress(done / total);
			if (done % 6 === 0) await new Promise((r) => setTimeout(r, 0));
		}
	}

	const route = buildRoute();
	const campY = campHeight();
	const detail = new Grid(DETAIL, res.detail, grids.detail);
	const fine = new Grid(FINE, res.fine, grids.fine);
	const coarse = new Grid(COARSE, res.coarse, grids.coarse);
	const mask = carve(detail.h, detail.res, DETAIL, route, campY);
	// route heights after carving (the bench is cut slightly below the profile)
	const hf = new Heightfield(detail, fine, coarse, route, campY);
	detail.derive(mask, 6);
	fine.derive(null, 6);
	coarse.derive(null, 4);
	hf.summit = { x: SUMMIT_XZ.x, z: SUMMIT_XZ.z, y: detail.sample(SUMMIT_XZ.x, SUMMIT_XZ.z) };
	hf.camp = { x: CAMP.x, z: CAMP.z, y: campY, yaw: CAMP.yaw, th: CAMP.th };
	return hf;
}
