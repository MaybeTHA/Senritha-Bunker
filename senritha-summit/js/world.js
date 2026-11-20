// The shape of the world: one height function for the whole mountain range, the path from
// the rest camp to the summit, and the camp shelf. Pure math, no three.js, so it runs in
// workers (and in Node for previews).
import { makeNoise, clamp, smoothstep, lerp } from './noise.js';

export const SEED = 7319;
export const VALLEY = -1150;        // valley floor
export const ALT0 = 3460;           // display altitude of y = 0, in metres above sea level
// Three nested height grids: DETAIL around the route, FINE over the massif, COARSE for the world.
export const DETAIL = { size: 1792, x0: -620, z0: -420 };
export const FINE = { size: 4096, x0: -2048, z0: -2048 };
export const COARSE = { size: 65536, x0: -32768, z0: -32768 };

const N = makeNoise(SEED);
const TAU = Math.PI * 2;
const deg = (d) => (d * Math.PI) / 180;

// Arêtes radiating from the summit. az = atan2(z, x).
const RIDGES = [
	{ az: deg(62), w: 0.2, boost: 0.9, wob: 0.12 },    // south-east ridge: the camp ridge and the route
	{ az: deg(-24), w: 0.17, boost: 0.55, wob: 0.2 },  // east-north-east
	{ az: deg(-112), w: 0.15, boost: 0.6, wob: 0.18 }, // north
	{ az: deg(176), w: 0.18, boost: 0.5, wob: 0.22 },  // west
	{ az: deg(128), w: 0.13, boost: 0.34, wob: 0.2 },  // south-west spur
];

function angDiff(a, b) { let d = a - b; d -= Math.round(d / TAU) * TAU; return d; }
function smax(a, b, k) { const h = clamp(0.5 + (0.5 * (a - b)) / k, 0, 1); return lerp(b, a, h) + k * h * (1 - h); }

const HS = 1500;   // massif relief above the valley floor
const R = 3600;    // massif radius (effective)

// Height of the main massif (summit near the origin).
function massif(x, z) {
	const wx = x + 150 * N.fbm(x / 1150, z / 1150, 3);
	const wz = z + 150 * N.fbm(x / 1150 + 7.3, z / 1150 - 3.1, 3);
	const d = Math.hypot(wx, wz) + 1e-3;
	const th = Math.atan2(wz, wx);

	let b = 0;
	for (let i = 0; i < RIDGES.length; i++) {
		const r = RIDGES[i];
		const az = r.az + r.wob * N.n2(d / 700, i * 11.7);
		const da = Math.abs(angDiff(th, az));
		// cusp profile -> knife-edge crest that broadens with distance
		const g = r.boost * Math.exp(-da / r.w) * (0.75 + 0.25 * Math.exp(-((da / (r.w * 2.2)) ** 2)));
		b = smax(b, g, 0.08);
	}
	const reff = d / (1 + b);
	const t = clamp(1 - reff / R, 0, 1);
	if (t <= 0) return VALLEY + 10 * N.n2(wx / 140, wz / 140);
	let h = HS * Math.pow(t, 1.42);
	// the summit horn
	const th2 = clamp(1 - reff / 470, 0, 1);
	h += 140 * th2 * th2;

	// radial couloirs and ribs: ridged noise in (arc length, radius) so features run downhill
	const thw = th + 0.09 * N.n2(d / 260 + Math.cos(th) * 0.9, Math.sin(th) * 0.9);
	const tA = thw < 0 ? thw + TAU : thw;
	const wSeam = smoothstep(2.3, 2.9, Math.abs(th));
	const v = d / 820;
	const steep = smoothstep(0.05, 0.35, t) * (1 - smoothstep(0.9, 1.0, t) * 0.7);
	if (steep > 0) {
		const ga = wSeam < 1 ? N.ridged(thw * 4.6, v, 4, 2.0, 0.5) : 0;
		const gb = wSeam > 0 ? N.ridged(tA * 4.6, v, 4, 2.0, 0.5) : 0;
		h += 46 * (lerp(ga, gb, wSeam) - 0.42) * steep * smoothstep(70, 420, d);
	}

	// broken rock and secondary ridges everywhere on the massif
	const rm = N.ridged(wx / 560, wz / 560, 6, 2.05, 0.52);
	h += 95 * (rm - 0.4) * smoothstep(0.02, 0.3, t) * (1 - 0.6 * th2);
	h += 26 * (N.ridged(wx / 190 + 3.7, wz / 190 - 1.3, 4, 2.1, 0.5) - 0.42) * smoothstep(0.04, 0.35, t);
	h += 10 * N.fbm(wx / 140, wz / 140, 4);

	return VALLEY + h;
}

// The surrounding ranges: big, broken and always a little lower than our summit.
function ranges(x, z) {
	const d = Math.hypot(x, z);
	const wx = x + 900 * N.fbm(x / 9000 + 3.3, z / 9000, 3);
	const wz = z + 900 * N.fbm(x / 9000, z / 9000 + 8.1, 3);
	const r = N.ridged(wx / 6200, wz / 6200, 7, 2.07, 0.5);
	const amp = 1650 * smoothstep(2600, 9000, d) + 260 * smoothstep(1800, 3800, d);
	let h = VALLEY + amp * Math.pow(r, 1.55) + 40 * N.fbm(x / 1700, z / 1700, 3);
	// keep the distant range below the summit so it stays the highest visible point
	if (h > 300) h = 300 + (h - 300) * 0.25;
	// glacier floors: flatten the lowest parts of the valleys
	const floor = VALLEY + 20 + 25 * N.fbm(x / 2600, z / 2600, 2);
	h = smax(h, floor, 120);
	return h;
}

export function rawHeight(x, z) {
	const m = massif(x, z);
	// the ranges only matter where the massif has run out
	if (m > VALLEY + 520 || x * x + z * z < 1700 * 1700) return m;
	return smax(m, ranges(x, z), 160);
}

// ---------------------------------------------------------------- the route
// The route climbs the crest of the south-east ridge from the rest camp, then zig-zags up
// the steep summit horn. The crest is traced from the height function itself.
export const SUMMIT_XZ = { x: 0, z: 0 };
const ROUTE_AZ = deg(62);
const CAMP_D = 1000;

function crestAt(d, heightFn) {
	let best = -1e9, bt = ROUTE_AZ;
	for (let k = -24; k <= 24; k++) {
		const th = ROUTE_AZ + (k / 24) * 0.3;
		const y = heightFn(Math.cos(th) * d, Math.sin(th) * d);
		if (y > best) { best = y; bt = th; }
	}
	return bt;
}

// Camp sits just off the crest on the sunny south side, on a shelf cut into the ridge.
export const CAMP = (() => {
	const th = crestAt(CAMP_D, rawHeight);
	const off = 26;
	const x = Math.cos(th) * CAMP_D - Math.sin(th) * off;
	const z = Math.sin(th) * CAMP_D + Math.cos(th) * off;
	return { x, z, th, yaw: Math.atan2(Math.cos(th), -Math.sin(th)) };
})();

// cabin-local (x right, z toward the summit) to world, matching cabin.js
export const CAMP_YAW = Math.atan2(SUMMIT_XZ.x - CAMP.x, SUMMIT_XZ.z - CAMP.z);
export function campLocal(lx, lz) {
	const c = Math.cos(CAMP_YAW), s = Math.sin(CAMP_YAW);
	return [CAMP.x + lx * c + lz * s, CAMP.z - lx * s + lz * c];
}
const CABIN_EXIT = [[8.0, -1.35], [8.6, 4.5], [6.5, 10.5], [0, 15], [-9, 17.5]];

export function buildRoute(heightFn = rawHeight) {
	// crest line from the camp out to the summit
	const raw = [];
	for (let d = CAMP_D - 14; d >= 2; d -= 6) raw.push({ d, th: crestAt(d, heightFn) });
	// smooth the crest azimuth
	for (let pass = 0; pass < 4; pass++) for (let i = 1; i < raw.length - 1; i++) raw[i].th = (raw[i - 1].th + 2 * raw[i].th + raw[i + 1].th) / 4;
	const ctrl = [];
	// start at the foot of the cabin's porch steps, pass the corner of the deck, then swing
	// out in front of the glass gable toward the summit and join the crest
	for (const [lx, lz] of CABIN_EXIT) ctrl.push(campLocal(lx, lz));
	for (const p of raw) {
		// switchbacks where the ridge steepens and on the summit horn
		let lat = 0;
		if (p.d < 660) {
			const u = (660 - p.d) / 58;
			const tri = 1 - Math.abs((u % 2) - 1);
			const amp = p.d < 330 ? 36 : 44;
			lat = amp * tri * smoothstep(660, 610, p.d) * smoothstep(30, 120, p.d);
		}
		const x = Math.cos(p.th) * p.d - Math.sin(p.th) * lat;
		const z = Math.sin(p.th) * p.d + Math.cos(p.th) * lat;
		ctrl.push([x, z]);
	}
	ctrl.push([SUMMIT_XZ.x + 2.2, SUMMIT_XZ.z + 1.2]);

	// resample to ~1.5 m with Catmull-Rom
	const pts = [];
	for (let i = 0; i < ctrl.length - 1; i++) {
		const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
		const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 1.5));
		for (let k = 0; k < n; k++) {
			const t = k / n;
			pts.push({ x: catmull(p0[0], p1[0], p2[0], p3[0], t), z: catmull(p0[1], p1[1], p2[1], p3[1], t) });
		}
	}
	pts.push({ x: ctrl[ctrl.length - 1][0], z: ctrl[ctrl.length - 1][1] });
	let s = 0;
	for (let i = 0; i < pts.length; i++) {
		if (i > 0) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
		pts[i].s = s;
		pts[i].g = heightFn(pts[i].x, pts[i].z);
	}
	const n = pts.length;
	// elevation: the smoothed ground, kept climbing and never steeper than a hard mountain path
	const y0 = campHeight(heightFn), y1 = pts[n - 1].g;
	let y = pts.map((p) => p.g);
	for (let pass = 0; pass < 6; pass++) {
		const out = y.slice();
		for (let i = 0; i < n; i++) {
			let acc = 0, wt = 0;
			for (let k = -24; k <= 24; k++) { const j = clamp(i + k, 0, n - 1); const w = 25 - Math.abs(k); acc += y[j] * w; wt += w; }
			out[i] = acc / wt;
		}
		y = out;
	}
	y[0] = y0; y[n - 1] = y1;
	for (let i = 0; i < n; i++) if (Math.hypot(pts[i].x - CAMP.x, pts[i].z - CAMP.z) < 30) y[i] = y0 + 0.015 * pts[i].s;
	const L = pts[n - 1].s;
	const MING = 0.02;
	const maxG = (i) => (pts[i].s > L - 45 ? 0.5 : 0.62);
	for (let it = 0; it < 4; it++) {
		for (let i = 1; i < n; i++) {
			const ds = pts[i].s - pts[i - 1].s;
			y[i] = clamp(y[i], y[i - 1] + MING * ds, y[i - 1] + maxG(i) * ds);
		}
		y[n - 1] = y1;
		for (let i = n - 2; i >= 0; i--) {
			const ds = pts[i + 1].s - pts[i].s;
			y[i] = clamp(y[i], y[i + 1] - maxG(i + 1) * ds, y[i + 1] - MING * ds);
		}
		y[0] = y0;
	}
	for (let i = 0; i < n; i++) pts[i].y = y[i];
	return pts;
}

export function campHeight(heightFn = rawHeight) {
	let acc = 0;
	for (let k = 0; k < 9; k++) acc += heightFn(CAMP.x + ((k % 3) - 1) * 12, CAMP.z + (Math.floor(k / 3) - 1) * 12);
	return acc / 9 + 1.5;
}

function catmull(p0, p1, p2, p3, t) {
	const t2 = t * t, t3 = t2 * t;
	return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

// ---------------------------------------------------------------- generation
// Fills `out` (res*res floats) for a square region. Rows [r0, r1) only, so workers can split it.
export function fillHeights(region, res, r0, r1, out, rowOffset = 0) {
	const step = region.size / (res - 1);
	for (let j = r0; j < r1; j++) {
		const z = region.z0 + j * step;
		const o = (j - rowOffset) * res;
		for (let i = 0; i < res; i++) out[o + i] = rawHeight(region.x0 + i * step, z);
	}
}

// Path bench, camp shelf and summit platform, written into a finished fine heightmap.
// Returns a Float32Array path mask (0..1) of the same size.
export function carve(h, res, region, route, campY) {
	const step = region.size / (res - 1);
	// 0) the camp shelf, first, so the path bench can cut its own level way out of it
	const cR = 34, cF = 30;
	for (let j = 0; j < res; j++) {
		const z = region.z0 + j * step;
		if (Math.abs(z - CAMP.z) > cR + cF) continue;
		for (let i = 0; i < res; i++) {
			const x = region.x0 + i * step;
			const d = Math.hypot(x - CAMP.x, z - CAMP.z);
			if (d > cR + cF) continue;
			const idx = j * res + i;
			const w = 1 - smoothstep(cR, cR + cF, d);
			const shelf = campY + 0.35 * N.fbm(x / 9, z / 9, 2) * smoothstep(8, 26, d);
			h[idx] = lerp(h[idx], shelf, w);
		}
	}
	const sampleH = (x, z) => {
		const fx = clamp((x - region.x0) / step, 0, res - 1.001), fz = clamp((z - region.z0) / step, 0, res - 1.001);
		const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, o = j * res + i;
		return lerp(lerp(h[o], h[o + 1], tx), lerp(h[o + res], h[o + res + 1], tx), tz);
	};
	// 1) reshape the whole ridge in a wide band so its crest follows the route's steady grade
	{
		const n = route.length;
		const gs = new Float32Array(n);
		for (let i = 0; i < n; i++) {
			let acc = 0, c = 0;
			for (let k = -30; k <= 30; k++) { const j = clamp(i + k, 0, n - 1); acc += sampleH(route[j].x, route[j].z); c++; }
			gs[i] = acc / c;
		}
		const pts = [];
		for (let i = 0; i < n; i += 6) pts.push({ x: route[i].x, z: route[i].z, d: route[i].y - gs[i] });
		pts.push({ x: route[n - 1].x, z: route[n - 1].z, d: route[n - 1].y - gs[n - 1] });
		const RB = 45;
		const bestD = new Float32Array(res * res).fill(1e9);
		const delta = new Float32Array(res * res);
		for (let k = 0; k < pts.length - 1; k++) {
			const a = pts[k], b = pts[k + 1];
			const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - RB - region.x0) / step)), i1 = Math.min(res - 1, Math.ceil((Math.max(a.x, b.x) + RB - region.x0) / step));
			const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - RB - region.z0) / step)), j1 = Math.min(res - 1, Math.ceil((Math.max(a.z, b.z) + RB - region.z0) / step));
			const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
			for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
				const x = region.x0 + i * step, z = region.z0 + j * step;
				const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / L2, 0, 1);
				const dist = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
				const idx = j * res + i;
				if (dist < bestD[idx]) { bestD[idx] = dist; delta[idx] = lerp(a.d, b.d, t); }
			}
		}
		for (let idx = 0; idx < res * res; idx++) {
			if (bestD[idx] >= RB) continue;
			const w = 1 - smoothstep(6, RB, bestD[idx]);
			h[idx] += delta[idx] * w * w * (3 - 2 * w) / (1 + 0 * w);
		}
	}
	// 2) the path bench itself
	const mask = new Float32Array(res * res);
	const best = new Float32Array(res * res).fill(1e9);
	const target = new Float32Array(res * res);
	const HALF = 2.3, SHOULDER = 6.0;
	const R = HALF + SHOULDER;
	for (let k = 0; k < route.length - 1; k++) {
		const a = route[k], b = route[k + 1];
		const minx = Math.min(a.x, b.x) - R, maxx = Math.max(a.x, b.x) + R;
		const minz = Math.min(a.z, b.z) - R, maxz = Math.max(a.z, b.z) + R;
		const i0 = Math.max(0, Math.floor((minx - region.x0) / step)), i1 = Math.min(res - 1, Math.ceil((maxx - region.x0) / step));
		const j0 = Math.max(0, Math.floor((minz - region.z0) / step)), j1 = Math.min(res - 1, Math.ceil((maxz - region.z0) / step));
		const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
		for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
			const x = region.x0 + i * step, z = region.z0 + j * step;
			const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / L2, 0, 1);
			const px = a.x + dx * t, pz = a.z + dz * t;
			const dist = Math.hypot(x - px, z - pz);
			const idx = j * res + i;
			if (dist < best[idx]) { best[idx] = dist; target[idx] = lerp(a.y, b.y, t); }
		}
	}
	for (let idx = 0; idx < res * res; idx++) {
		const dist = best[idx];
		if (dist > R) continue;
		const w = 1 - smoothstep(HALF, R, dist);
		h[idx] = lerp(h[idx], target[idx] - 0.12, w);
		mask[idx] = 1 - smoothstep(HALF - 0.6, HALF + 1.2, dist);
	}
	// summit platform: a small rounded top, highest point at the flag
	const top = route[route.length - 1];
	const topY = top.y + 0.1;
	for (let j = 0; j < res; j++) {
		const z = region.z0 + j * step;
		if (Math.abs(z - SUMMIT_XZ.z) > 40) continue;
		for (let i = 0; i < res; i++) {
			const x = region.x0 + i * step;
			const d = Math.hypot(x - SUMMIT_XZ.x, z - SUMMIT_XZ.z);
			if (d > 40) continue;
			const idx = j * res + i;
			const dome = topY - 0.05 * d * d;
			h[idx] = d < 4 ? Math.min(h[idx], dome) : Math.min(h[idx], topY - 0.8 - (d - 4) * 0.45);
		}
	}
	return mask;
}

export const ROUTE_HALF = 2.3;
export { N as noise };
