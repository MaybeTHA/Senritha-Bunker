// The motorhome: exterior shell, cab, lounge, wood stove, dinette, kitchen, library wall and bedroom.
// Units are metres. Interior floor at y = 0, +x is the front (cab), +z is the door side.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { M, Batcher, softBox, pillow, lathe, tube, cyl, surface, roundRect, planeM, flipWinding } from './geometry.js';
import { makeNoise, rng, lerp, smooth } from './noise.js';
import { U } from './materials.js';
import { flameMaterial, glowMaterial, wisps, dustMotes, lightCone } from './effects.js';

const V3 = THREE.Vector3;
const PI = Math.PI;
const N = makeNoise(5);

export const IN = { x0: -4.55, x1: 4.9, z: 1.17, y1: 2.05 };
export const OUT = { x0: -4.67, x1: 5.1, z: 1.27, yb: -0.42, yt: 2.13, roof: 2.28 };
export const GROUND_Y = -0.92;

const SIDE_WIN = {
	'-1': [{ x0: 1.45, x1: 3.25, y0: 0.82, y1: 1.74, curtain: true }, { x0: -3.55, x1: -2.65, y0: 0.9, y1: 1.45, curtain: true }],
	'1': [{ x0: 1.0, x1: 2.62, y0: 0.86, y1: 1.74, curtain: true }, { x0: -0.92, x1: 0.12, y0: 1.08, y1: 1.6, sill: 0.12 }, { x0: -3.55, x1: -2.65, y0: 0.9, y1: 1.45, curtain: true }],
};
const CAB_WIN = [[3.62, 0.95], [4.86, 0.95], [4.62, 1.72], [3.62, 1.72]];
const DOOR = { x0: 2.82, x1: 3.42, y0: 0.02, y1: 1.98 };

function slab(w, h, d, r = 0.004) { return softBox(w, h, d, r, { density: 1.5, seg: 2 }); }
function panel(w, h, d, r = 0.004) { return softBox(w, h, d, r, { density: 1.5, seg: 2, grain: 'h' }); }

function drape(width, profile, { nu = 26, nv = 44, folds = 0.012, foldF = 7, hang = 2.2, wrinkle = 0.004, seed = 1, edge = 0.02 } = {}) {
	const pts = profile.map((p) => new THREE.Vector2(p[0], p[1]));
	const L = [0];
	for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1]));
	const total = L[L.length - 1];
	const nz = makeNoise(seed);
	return flipWinding(surface(nu, nv, (u, v, t) => {
		const s = v * total;
		let i = 1; while (i < L.length - 1 && L[i] < s) i++;
		const a = pts[i - 1], b = pts[i];
		const k = (s - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
		const pz = lerp(a.x, b.x, k), py = lerp(a.y, b.y, k);
		const tz = (b.x - a.x), ty = (b.y - a.y); const tl = Math.hypot(tz, ty) || 1;
		const nzv = -ty / tl, nyv = tz / tl;
		const steep = Math.abs(ty / tl);
		const amp = folds * (0.25 + hang * steep * steep);
		const x = (u - 0.5) * width;
		let off = Math.sin(x * foldF * 2 * PI / width * 1.0 + nz.n2(x * 3, s * 2) * 2.5) * amp;
		off += nz.n2(x * 14, s * 14) * wrinkle;
		const droop = (Math.pow(Math.abs(u - 0.5) * 2, 6)) * edge * steep;
		t.set(x, py + nyv * off - droop, pz + nzv * off);
	}, width, total));
}

function curtainGeo(w, h, pleats, depth = 0.026) {
	const g = surface(Math.max(30, pleats * 8), 18, (u, v, t) => {
		const amp = depth * (0.75 + 0.5 * v);
		t.set(u * w, -v * h, Math.sin(u * pleats * PI * 2) * amp + Math.sin(u * 37.0) * 0.002);
	}, w, h);
	const pos = g.attributes.position; const sw = new Float32Array(pos.count);
	for (let i = 0; i < pos.count; i++) sw[i] = Math.pow(Math.min(1, -pos.getY(i) / h), 1.4);
	g.setAttribute('aSway', new THREE.BufferAttribute(sw, 1));
	return g;
}

function heartLeaf(size) {
	const s = new THREE.Shape();
	s.moveTo(0, 0);
	s.bezierCurveTo(0.35 * size, 0.15 * size, 0.55 * size, 0.6 * size, 0, size);
	s.bezierCurveTo(-0.55 * size, 0.6 * size, -0.35 * size, 0.15 * size, 0, 0);
	const g = new THREE.ShapeGeometry(s, 6);
	const p = g.attributes.position;
	for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -Math.abs(x) * 0.35 + Math.sin(y / size * PI) * 0.08 * size); }
	g.computeVertexNormals();
	return g;
}

function ovalLeaf(len, wid) {
	const s = new THREE.Shape();
	s.moveTo(0, 0); s.quadraticCurveTo(wid, len * 0.45, 0, len); s.quadraticCurveTo(-wid, len * 0.45, 0, 0);
	const g = new THREE.ShapeGeometry(s, 5);
	const p = g.attributes.position;
	for (let i = 0; i < p.count; i++) p.setZ(i, -Math.abs(p.getX(i)) * 0.5);
	g.computeVertexNormals();
	return g;
}

export function buildMotorhome(mats, T, quality) {
	RectAreaLightUniformsLib.init();
	const { m } = mats;
	const group = new THREE.Group(); group.name = 'motorhome';
	const fx = new THREE.Group(); fx.name = 'motorhome-fx'; group.add(fx);
	const B = new Batcher();
	const colliders = [], focusables = [], updaters = [];
	const curtainGeos = [], leafGeos = [];
	let steam, ksteam;
	const R = rng(42);

	const put = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, opt) => B.add(geo, mat, M(x, y, z, rx, ry, rz), opt);
	const col = (x0, y0, z0, x1, y1, z1) => colliders.push(new THREE.Box3(new V3(x0, y0, z0), new V3(x1, y1, z1)));
	const focus = (name, desc, box, view, dist, space = 'interior') => focusables.push({
		name, desc, space, dist, box: new THREE.Box3(new V3(box[0], box[1], box[2]), new V3(box[3], box[4], box[5])),
		view: view ? new V3(...view).normalize() : null,
	});
	const mz = (z) => new THREE.Matrix4().makeScale(1, 1, -1).setPosition(0, 0, z);
	const wellMat = new THREE.MeshStandardMaterial({ color: 0x0f0f0f, roughness: 0.9, side: THREE.DoubleSide });
	mats.exterior.push(wellMat);

	const addLeaves = (geo, matrix, color) => {
		const g = geo.clone(); g.applyMatrix4(matrix);
		const c = new Float32Array(g.attributes.position.count * 3);
		for (let i = 0; i < c.length; i += 3) { c[i] = color[0]; c[i + 1] = color[1]; c[i + 2] = color[2]; }
		g.setAttribute('color', new THREE.BufferAttribute(c, 3));
		for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
		leafGeos.push(g);
	};
	const leafColor = (k = 0) => {
		const v = R();
		return [0.12 + v * 0.08 + k * 0.05, 0.26 + v * 0.12 + k * 0.05, 0.09 + v * 0.05];
	};

	// ------------------------------------------------------------------ helpers for the shell
	const ptsPath = (pts) => { const p = new THREE.Path(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); return p; };
	const rectPts = (w) => [[w.x0, w.y0], [w.x1, w.y0], [w.x1, w.y1], [w.x0, w.y1]];

	function revealRing(A, Bp, mat) {
		const pos = [], nor = [], uv = [], idx = [];
		const c = new V3(); A.forEach((p) => c.add(p)); c.multiplyScalar(1 / A.length);
		for (let i = 0; i < A.length; i++) {
			const a0 = A[i], a1 = A[(i + 1) % A.length], b0 = Bp[i], b1 = Bp[(i + 1) % A.length];
			const n = new V3().subVectors(a1, a0).cross(new V3().subVectors(b0, a0)).normalize();
			const toC = new V3().subVectors(c, a0);
			toC.sub(n.clone().multiplyScalar(0));
			const flip = n.dot(new V3().subVectors(c, a0).projectOnPlane(new V3().subVectors(b0, a0).normalize())) < 0;
			if (flip) n.negate();
			const base = pos.length / 3; const len = a0.distanceTo(a1), dep = a0.distanceTo(b0);
			for (const p of [a0, a1, b1, b0]) { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); }
			uv.push(0, 0, len, 0, len, dep, 0, dep);
			if (flip) idx.push(base, base + 2, base + 1, base, base + 3, base + 2); else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
		g.setIndex(idx);
		B.add(g, mat);
	}

	// ------------------------------------------------------------------ side walls
	for (const side of [-1, 1]) {
		const wins = SIDE_WIN[side];
		const holes = wins.map(rectPts);
		holes.push(CAB_WIN);
		if (side === 1) holes.push(rectPts(DOOR));

		const inner = new THREE.Shape();
		inner.moveTo(IN.x0, 0); inner.lineTo(4.9, 0); inner.lineTo(4.9, 1.0); inner.lineTo(4.55, IN.y1); inner.lineTo(IN.x0, IN.y1); inner.closePath();
		inner.holes = holes.map(ptsPath);
		const gi = new THREE.ShapeGeometry(inner, 4);
		if (side === -1) B.add(gi, m.wall, new THREE.Matrix4().makeTranslation(0, 0, -IN.z));
		else B.add(gi, m.wall, mz(IN.z));

		const outer = new THREE.Shape();
		outer.moveTo(OUT.x0, OUT.yb);
		outer.lineTo(-2.2 - 0.58, OUT.yb); outer.absarc(-2.2, OUT.yb, 0.58, PI, 0, true);
		outer.lineTo(3.4 - 0.58, OUT.yb); outer.absarc(3.4, OUT.yb, 0.58, PI, 0, true);
		outer.lineTo(5.06, OUT.yb); outer.lineTo(5.08, 0.6); outer.lineTo(5.0, 1.0); outer.lineTo(4.62, OUT.yt); outer.lineTo(OUT.x0, OUT.yt); outer.closePath();
		outer.holes = holes.map(ptsPath);
		const go = new THREE.ShapeGeometry(outer, 16);
		const uvA = go.attributes.uv;
		for (let i = 0; i < uvA.count; i++) {
			const x = uvA.getX(i), y = uvA.getY(i);
			uvA.setXY(i, side === 1 ? (x - OUT.x0) / (5.08 - OUT.x0) : (5.08 - x) / (5.08 - OUT.x0), (y - OUT.yb) / (OUT.yt - OUT.yb));
		}
		if (side === 1) B.add(go, m.paintR, new THREE.Matrix4().makeTranslation(0, 0, OUT.z));
		else B.add(go, m.paintL, mz(-OUT.z));

		// reveals, glass, trims
		for (const h of holes) {
			const A = h.map((p) => new V3(p[0], p[1], side * IN.z));
			const Bp = h.map((p) => new V3(p[0], p[1], side * OUT.z));
			revealRing(A, Bp, m.walnutTrim);
		}
		for (const h of [...wins.map(rectPts), CAB_WIN]) {
			const s = new THREE.Shape(); s.moveTo(h[0][0], h[0][1]); for (let i = 1; i < h.length; i++) s.lineTo(h[i][0], h[i][1]); s.closePath();
			const g = new THREE.ShapeGeometry(s);
			if (side === 1) B.add(g, m.window, new THREE.Matrix4().makeTranslation(0, 0, 1.24), { cast: false });
			else B.add(g, m.window, mz(-1.24), { cast: false });
		}
		for (const w of wins) {
			const W = w.x1 - w.x0, H = w.y1 - w.y0, cx = (w.x0 + w.x1) / 2, cy = (w.y0 + w.y1) / 2;
			const zc = side * (IN.z - 0.007);
			put(slab(W + 0.1, 0.05, 0.014), m.walnutTrim, cx, w.y1 + 0.025, zc);
			put(slab(0.05, H, 0.014), m.walnutTrim, w.x0 - 0.025, cy, zc);
			put(slab(0.05, H, 0.014), m.walnutTrim, w.x1 + 0.025, cy, zc);
			const sd = w.sill ?? 0.07;
			put(slab(W + 0.12, 0.024, sd, 0.006), m.walnut, cx, w.y0 - 0.012, side * (IN.z - sd / 2 + 0.01));
			// exterior rubber gasket and snow on the ledge
			const zo = side * (OUT.z + 0.006);
			put(slab(W + 0.07, 0.035, 0.012), m.trim, cx, w.y1 + 0.017, zo);
			put(slab(W + 0.07, 0.035, 0.012), m.trim, cx, w.y0 - 0.017, zo);
			put(slab(0.035, H, 0.012), m.trim, w.x0 - 0.017, cy, zo);
			put(slab(0.035, H, 0.012), m.trim, w.x1 + 0.017, cy, zo);
			put(softBox(W + 0.04, 0.04, 0.07, 0.018, { density: 30, puff: 0.012, wrinkle: 0.004 }), m.snowSoft, cx, w.y0 + 0.005, side * (OUT.z + 0.03));
			// frost on the inside of the glass
			const fg = new THREE.PlaneGeometry(W, H);
			if (side === 1) B.add(fg, m.frost, M(cx, cy, 1.2, 0, PI, 0), { cast: false, receive: false });
			else B.add(fg, m.frost, M(cx, cy, -1.2), { cast: false, receive: false });
			// curtains on a brass rod
			if (w.curtain) {
				const rodY = w.y1 + 0.1, rz = side * (IN.z - 0.07);
				put(cyl(0.011, 0.011, W + 0.5, 16), m.brass, cx, rodY, rz, 0, 0, PI / 2);
				for (const e of [-1, 1]) {
					put(new THREE.SphereGeometry(0.02, 16, 12), m.brass, cx + e * (W / 2 + 0.25), rodY, rz);
					put(cyl(0.006, 0.006, 0.07, 8), m.brass, cx + e * (W / 2 + 0.18), rodY, side * (IN.z - 0.035), PI / 2);
				}
				const ch = rodY - (w.y0 - 0.16);
				for (const e of [-1, 1]) {
					const cw = 0.3;
					const g = curtainGeo(cw, ch, 5);
					const x0 = e < 0 ? w.x0 - 0.22 : w.x1 + 0.22 - cw;
					g.applyMatrix4(M(x0, rodY - 0.015, rz));
					curtainGeos.push(g);
				}
			}
		}
		// cab window gasket ring and ledge
		const cabA = CAB_WIN.map((p) => new V3(p[0], p[1], side * (OUT.z + 0.004)));
		for (let i = 0; i < cabA.length; i++) {
			const a = cabA[i], b = cabA[(i + 1) % cabA.length];
			const len = a.distanceTo(b); const mid = a.clone().add(b).multiplyScalar(0.5);
			const ang = Math.atan2(b.y - a.y, b.x - a.x);
			put(slab(len + 0.03, 0.035, 0.012), m.trim, mid.x, mid.y, mid.z, 0, 0, ang);
		}
	}

	// ------------------------------------------------------------------ rear wall
	{
		const rw = [[-0.62, 1.25], [0.62, 1.25], [0.62, 1.68], [-0.62, 1.68]];
		const si = new THREE.Shape(); si.moveTo(-IN.z, 0); si.lineTo(IN.z, 0); si.lineTo(IN.z, IN.y1); si.lineTo(-IN.z, IN.y1); si.closePath();
		si.holes = [ptsPath(rw)];
		B.add(new THREE.ShapeGeometry(si), m.wall, M(IN.x0, 0, 0, 0, PI / 2, 0));
		const so = new THREE.Shape(); so.moveTo(-OUT.z, OUT.yb); so.lineTo(OUT.z, OUT.yb); so.lineTo(OUT.z, OUT.yt); so.lineTo(-OUT.z, OUT.yt); so.closePath();
		so.holes = [ptsPath(rw)];
		B.add(new THREE.ShapeGeometry(so), m.paint, M(OUT.x0, 0, 0, 0, -PI / 2, 0));
		const A = rw.map((p) => new V3(IN.x0, p[1], p[0])), Bp = rw.map((p) => new V3(OUT.x0, p[1], p[0]));
		revealRing(A, Bp, m.walnutTrim);
		const gs = new THREE.ShapeGeometry(new THREE.Shape(rw.map((p) => new THREE.Vector2(p[0], p[1]))));
		B.add(gs, m.window, M(-4.64, 0, 0, 0, -PI / 2, 0), { cast: false });
		put(new THREE.PlaneGeometry(1.24, 0.43), m.frost, IN.x0 + 0.04, 1.465, 0, 0, PI / 2, 0, { cast: false, receive: false });
		put(slab(0.014, 0.05, 1.34), m.walnutTrim, IN.x0 + 0.007, 1.705, 0);
		put(slab(0.07, 0.024, 1.36, 0.006), m.walnut, IN.x0 + 0.03, 1.238, 0);
		put(softBox(0.07, 0.04, 1.28, 0.018, { density: 30, puff: 0.012 }), m.snowSoft, OUT.x0 - 0.03, 1.255, 0);
		// rear lights and ladder
		for (const s of [-1, 1]) {
			put(softBox(0.04, 0.42, 0.14, 0.02), m.tail, OUT.x0 - 0.015, 0.25, s * 1.1);
			put(softBox(0.03, 0.05, 0.08, 0.012), m.tail, OUT.x0 - 0.012, 2.05, s * 0.4);
		}
		for (const z of [-0.95, -0.62]) put(cyl(0.016, 0.016, 2.3, 10), m.alloy, OUT.x0 - 0.12, 0.95, z);
		for (let i = 0; i < 8; i++) {
			const y = -0.15 + i * 0.3;
			put(cyl(0.012, 0.012, 0.33, 8), m.alloy, OUT.x0 - 0.12, y, -0.785, PI / 2);
			put(softBox(0.05, 0.025, 0.3, 0.012, { density: 20, puff: 0.008 }), m.snowSoft, OUT.x0 - 0.12, y + 0.022, -0.785);
		}
		for (const z of [-0.95, -0.62]) for (const y of [0.1, 1.8]) put(cyl(0.01, 0.01, 0.12, 8), m.alloy, OUT.x0 - 0.06, y, z, 0, 0, PI / 2);
	}

	// ------------------------------------------------------------------ floor, ceiling, skylight
	put(planeM(4.55 + 3.5, 2 * IN.z), m.floor, (IN.x0 + 3.5) / 2, 0, 0, -PI / 2, 0, 0, { cast: false });
	put(new THREE.PlaneGeometry(1.4, 2 * IN.z), m.rubber, 4.2, 0.001, 0, -PI / 2, 0, 0, { cast: false });
	{
		const sh = new THREE.Shape(); sh.moveTo(IN.x0, -IN.z); sh.lineTo(4.56, -IN.z); sh.lineTo(4.56, IN.z); sh.lineTo(IN.x0, IN.z); sh.closePath();
		const sky = [[1.9, -0.45], [2.9, -0.45], [2.9, 0.45], [1.9, 0.45]];
		const fan = [[-0.8, -0.2], [-0.4, -0.2], [-0.4, 0.2], [-0.8, 0.2]];
		sh.holes = [ptsPath(sky)];
		const g = new THREE.ShapeGeometry(sh);
		// shape is in x,y -> rotate so y becomes z and it faces down
		B.add(g, m.ceiling, M(0, IN.y1, 0, PI / 2, 0, 0), { cast: true });
		// skylight well
		const A = sky.map((p) => new V3(p[0], IN.y1, p[1])), Bp = sky.map((p) => new V3(p[0], OUT.roof + 0.02, p[1]));
		revealRing(A, Bp, m.walnutTrim);
		put(new THREE.PlaneGeometry(1.0, 0.9), m.window, 2.4, OUT.roof + 0.015, 0, -PI / 2, 0, 0, { cast: false });
		put(new THREE.PlaneGeometry(0.9, 0.8), m.frost, 2.4, OUT.roof - 0.02, 0, PI / 2, 0, 0, { cast: false, receive: false });
		for (const [w, d, x, z] of [[1.08, 0.05, 2.4, -0.475], [1.08, 0.05, 2.4, 0.475], [0.05, 0.9, 1.875, 0], [0.05, 0.9, 2.925, 0]]) {
			put(slab(w, 0.06, d, 0.01), m.paint, x, OUT.roof + 0.03, z);
		}
		// roof vent fan grille in the kitchen ceiling
		put(slab(0.42, 0.02, 0.42, 0.006), m.ceramic, -0.6, IN.y1 - 0.01, 0);
		put(slab(0.34, 0.012, 0.34, 0.004), m.blackMatte, -0.6, IN.y1 - 0.022, 0);
		for (let i = -3; i <= 3; i++) put(slab(0.33, 0.006, 0.008), m.ceramic, -0.6, IN.y1 - 0.03, i * 0.045);
		void fan;
	}
	// cove valances with LED, recessed puck lights
	for (const s of [-1, 1]) {
		put(slab(7.9, 0.06, 0.025, 0.006), m.walnutTrim, -0.5, IN.y1 - 0.06, s * (IN.z - 0.07));
		put(slab(7.85, 0.008, 0.012), m.led, -0.5, IN.y1 - 0.028, s * (IN.z - 0.085), 0, 0, 0, { cast: false });
	}
	for (const x of [-3.4, -0.6, 0.55, 3.1]) {
		put(cyl(0.035, 0.035, 0.01, 24), m.brass, x, IN.y1 - 0.004, 0);
		put(cyl(0.024, 0.024, 0.006, 24), m.ledCool, x, IN.y1 - 0.01, 0, 0, 0, 0, { cast: false });
	}

	// ------------------------------------------------------------------ roof, front cap, body details
	{
		const rs = new THREE.Shape();
		rs.moveTo(-OUT.z, OUT.yt - 0.03); rs.lineTo(-OUT.z, 2.17); rs.quadraticCurveTo(-OUT.z, OUT.roof, -1.15, OUT.roof);
		rs.lineTo(1.15, OUT.roof); rs.quadraticCurveTo(OUT.z, OUT.roof, OUT.z, 2.17); rs.lineTo(OUT.z, OUT.yt - 0.03); rs.closePath();
		// roof in three spans so the skylight opening stays clear
		const ext = (shape, x0, x1) => B.add(new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments: 10 }), m.paint, M(x0, 0, 0, 0, PI / 2, 0));
		ext(rs, OUT.x0, 1.86); ext(rs, 2.94, 4.62);
		for (const s of [-1, 1]) {
			const side = new THREE.Shape();
			side.moveTo(s * OUT.z, OUT.yt - 0.03); side.lineTo(s * OUT.z, 2.17); side.quadraticCurveTo(s * OUT.z, OUT.roof, s * 1.15, OUT.roof);
			side.lineTo(s * 0.47, OUT.roof); side.lineTo(s * 0.47, OUT.yt - 0.03); side.closePath();
			ext(side, 1.86, 2.94);
		}
		// rounded vertical rear corners
		for (const s of [-1, 1]) put(cyl(0.05, 0.05, OUT.yt - OUT.yb, 16), m.paint, OUT.x0 + 0.02, (OUT.yt + OUT.yb) / 2, s * (OUT.z - 0.02));
		// front lower cap, grille, headlights, bumper
		put(softBox(0.16, 1.44, 2.56, 0.06, { density: 4 }), m.paint, 5.02, 0.29, 0);
		put(softBox(0.06, 0.32, 1.1, 0.03, { density: 6 }), m.trim, 5.1, 0.42, 0);
		for (let i = 0; i < 6; i++) put(slab(0.02, 0.012, 1.06), m.chrome, 5.13, 0.29 + i * 0.05, 0);
		for (const s of [-1, 1]) {
			put(softBox(0.06, 0.15, 0.4, 0.04, { density: 10 }), m.chrome, 5.09, 0.36, s * 0.86);
			put(softBox(0.04, 0.12, 0.36, 0.035, { density: 10 }), m.lamp, 5.115, 0.36, s * 0.86);
			put(softBox(0.06, 0.15, 0.4, 0.04, { density: 10 }), m.lens, 5.125, 0.36, s * 0.86, 0, 0, 0, { cast: false });
		}
		put(softBox(0.2, 0.2, 2.6, 0.07, { density: 6 }), m.trim, 5.13, -0.33, 0);
		put(softBox(0.12, 0.05, 2.5, 0.025, { density: 18, puff: 0.02, wrinkle: 0.006 }), m.snowSoft, 5.15, -0.21, 0);
		// windshield glass (bowed), pillars and cowl
		const ws = surface(30, 12, (u, v, t) => {
			const z = (u - 0.5) * 2.3;
			const bow = 0.06 * (1 - Math.pow(z / 1.15, 2));
			t.set(lerp(4.99, 4.64, v) + bow, lerp(1.02, 2.09, v), z * lerp(1, 0.97, v));
		});
		B.add(ws, m.window, null, { cast: false });
		for (const s of [-1, 1]) {
			const pil = tube([[5.0, 0.98, s * 1.2], [4.82, 1.55, s * 1.19], [4.63, 2.12, s * 1.17]], 0.05, 16, 10);
			B.add(pil, m.trim);
			const corner = tube([[5.06, -0.42, s * 1.23], [5.08, 0.3, s * 1.235], [5.07, 0.6, s * 1.235], [5.0, 1.0, s * 1.235]], 0.045, 24, 12);
			B.add(corner, m.paint);
			// mirrors
			put(cyl(0.015, 0.015, 0.45, 8), m.trim, 5.05, 1.55, s * 1.42, PI / 2 - 0.4 * s, 0, 0);
			put(softBox(0.12, 0.34, 0.2, 0.04, { density: 10 }), m.trim, 5.08, 1.42, s * 1.6);
			put(softBox(0.14, 0.035, 0.2, 0.017, { density: 30, puff: 0.012 }), m.snowSoft, 5.08, 1.6, s * 1.6);
			// wipers
			put(slab(0.014, 0.012, 0.75), m.trim, 4.97, 1.06, s * 0.45, 0, 0, -1.24);
		}
		put(tube([[4.64, 2.1, -1.15], [4.64, 2.11, 0], [4.64, 2.1, 1.15]], 0.035, 16, 8), m.trim);
		put(tube([[5.0, 1.0, -1.18], [5.05, 1.0, 0], [5.0, 1.0, 1.18]], 0.04, 16, 8), m.trim);
		put(softBox(0.12, 0.05, 2.25, 0.025, { density: 20, puff: 0.025, wrinkle: 0.008 }), m.snowSoft, 5.0, 1.04, 0);
		// amber clearance lights along the front roof edge, red at the rear
		for (let i = -2; i <= 2; i++) put(softBox(0.05, 0.035, 0.09, 0.012), m.lamp, 4.66, 2.2, i * 0.32);
		// skirt shadow line and underbody
		put(slab(9.0, 0.32, 1.9, 0.02), m.trim, 0.3, -0.58, 0, 0, 0, 0, { receive: false });
		put(new THREE.PlaneGeometry(9.7, 2.54), m.trim, 0.2, OUT.yb + 0.001, 0, PI / 2, 0, 0, { cast: false });
		// wheel wells and wheels
		const tireProf = [[0.3, -0.14], [0.43, -0.14], [0.47, -0.12], [0.485, -0.06], [0.488, 0], [0.485, 0.06], [0.47, 0.12], [0.43, 0.14], [0.3, 0.14]];
		const tire = lathe(tireProf, 48); tire.rotateX(PI / 2);
		const rim = lathe([[0.001, 0.115], [0.12, 0.12], [0.24, 0.105], [0.29, 0.1], [0.305, 0.13], [0.305, -0.1]], 40); rim.rotateX(PI / 2);
		const hub = lathe([[0.001, 0.15], [0.07, 0.145], [0.09, 0.12]], 24); hub.rotateX(PI / 2);
		for (const ax of [3.4, -2.2]) {
			for (const s of [-1, 1]) {
				const well = new THREE.CylinderGeometry(0.6, 0.6, 0.5, 32, 1, true, PI / 2, PI);
				well.rotateX(PI / 2);
				B.add(well, wellMat, M(ax, OUT.yb, s * 1.02), { cast: false });
				const zs = ax > 0 ? [1.08] : [1.12, 0.84];
				for (const zz of zs) {
					const z = s * zz;
					B.add(tire, m.tire, M(ax, GROUND_Y + 0.488, z, 0, 0, 0, 1, 1, s));
					if (zz !== 0.84) {
						B.add(rim, m.alloy, M(ax, GROUND_Y + 0.488, z, 0, 0, 0, 1, 1, s));
						B.add(hub, m.chrome, M(ax, GROUND_Y + 0.488, z, 0, 0, 0, 1, 1, s));
						for (let k = 0; k < 8; k++) {
							const a = k / 8 * PI * 2;
							put(cyl(0.012, 0.012, 0.03, 8), m.chrome, ax + Math.cos(a) * 0.12, GROUND_Y + 0.488 + Math.sin(a) * 0.12, z + s * 0.12, PI / 2);
						}
					}
				}
				// snow caught on top of the tyres
				put(softBox(0.3, 0.05, 0.22, 0.02, { density: 30, puff: 0.02, wrinkle: 0.006 }), m.snowSoft, ax, GROUND_Y + 0.975, s * 1.08);
			}
		}
		// awning roll with LED strip on the door side
		put(cyl(0.065, 0.065, 5.0, 24), m.paint, 0.15, 2.05, OUT.z + 0.08, 0, 0, PI / 2);
		put(softBox(5.0, 0.06, 0.12, 0.03, { density: 12, puff: 0.03, wrinkle: 0.01 }), m.snowSoft, 0.15, 2.13, OUT.z + 0.08);
		put(slab(4.6, 0.012, 0.02), m.led, 0.15, 1.982, OUT.z + 0.085, 0, 0, 0, { cast: false });
		for (const x of [-2.3, 2.6]) put(slab(0.04, 2.0, 0.05), m.paint, x, 1.05, OUT.z + 0.04);
		// porch light fixture
		put(softBox(0.16, 0.1, 0.1, 0.02), m.chrome, 3.12, 2.05, OUT.z + 0.05);
		put(softBox(0.13, 0.04, 0.08, 0.015), m.lamp, 3.12, 1.995, OUT.z + 0.055);
		// chimney pipe and cap
		put(cyl(0.065, 0.065, 0.62, 24), m.steel, 0.9, OUT.roof + 0.3, -0.93);
		put(cyl(0.1, 0.1, 0.02, 24), m.steel, 0.9, OUT.roof + 0.18, -0.93);
		put(lathe([[0.001, 0.1], [0.15, 0.0], [0.155, -0.01]], 24), m.steel, 0.9, OUT.roof + 0.66, -0.93);
		put(lathe([[0.001, 0.11], [0.13, 0.0], [0.14, -0.015]], 24), m.snowSoft, 0.9, OUT.roof + 0.7, -0.93);
	}

	// ------------------------------------------------------------------ roof snow (cleared around the warm skylight)
	{
		const x0 = -4.79, x1 = 4.74, z0 = -1.4, z1 = 1.4;
		const g = surface(150, 44, (u, v, t) => {
			const x = lerp(x0, x1, u), z = lerp(z0, z1, v);
			const ex = Math.min(x - OUT.x0, 4.62 - x), ez = OUT.z - Math.abs(z);
			const e = Math.min(ex, ez);
			let h = 0.17 + 0.05 * N.fbm(x * 0.8, z * 1.6, 999, 999, 3) + 0.015 * N.n2(x * 5, z * 5);
			h += 0.24 * Math.exp(-((x + 2.0) ** 2) / 0.3 - (z * z) / 0.25);
			h += 0.08 * Math.exp(-((x + 0.6) ** 2) / 0.05 - (z * z) / 0.05);
			const dsx = Math.max(1.84 - x, x - 2.96, 0), dsz = Math.max(Math.abs(z) - 0.51, 0);
			h *= smooth(0.0, 0.3, Math.hypot(dsx, dsz));
			h *= smooth(0.1, 0.4, Math.hypot(x - 0.9, z + 0.93));
			const f = e > 0.12 ? 1 : Math.sqrt(Math.max(0, 1 - ((0.12 - e) / 0.235) ** 2));
			t.set(x, OUT.roof + h * f - (e < 0 ? -e * 0.35 : 0), z);
		}, 4, 1.2);
		const pos = g.attributes.position; const ix = g.index.array; const keep = [];
		for (let i = 0; i < ix.length; i += 3) {
			let cx = 0, cz = 0;
			for (let k = 0; k < 3; k++) { cx += pos.getX(ix[i + k]); cz += pos.getZ(ix[i + k]); }
			cx /= 3; cz /= 3;
			if (cx > 1.86 && cx < 2.94 && Math.abs(cz) < 0.49) continue;
			keep.push(ix[i], ix[i + 1], ix[i + 2]);
		}
		g.setIndex(keep);
		flipWinding(g);
		B.add(g, m.snow);
		// icicles along the eaves
		for (const s of [-1, 1]) {
			for (let i = 0; i < 46; i++) {
				const x = lerp(-4.5, 4.4, R());
				if (s === 1 && x > 2.7 && x < 3.55) continue;
				const L = 0.04 + Math.pow(R(), 2.2) * 0.32;
				const ic = lathe([[0.0005, -L], [0.006, -L * 0.7], [0.014, -L * 0.3], [0.02, 0]], 10);
				put(ic, m.ice, x, OUT.roof - 0.02, s * (OUT.z + 0.07), (R() - 0.5) * 0.08, 0, (R() - 0.5) * 0.08, { cast: false });
			}
		}
	}

	// ------------------------------------------------------------------ entry door and steps
	{
		const d = DOOR;
		const win = [[2.94, 1.2], [3.3, 1.2], [3.3, 1.75], [2.94, 1.75]];
		const outerS = new THREE.Shape(); roundRect(outerS, d.x0 + 0.004, d.y0, d.x1 - 0.004, d.y1 - 0.004, 0.04); outerS.holes = [ptsPath(win)];
		const go = new THREE.ShapeGeometry(outerS, 6);
		const uvA = go.attributes.uv;
		for (let i = 0; i < uvA.count; i++) uvA.setXY(i, (uvA.getX(i) - OUT.x0) / (5.08 - OUT.x0), (uvA.getY(i) - OUT.yb) / (OUT.yt - OUT.yb));
		B.add(go, m.paintR, new THREE.Matrix4().makeTranslation(0, 0, OUT.z - 0.004));
		const innerS = new THREE.Shape(); roundRect(innerS, d.x0 + 0.004, d.y0, d.x1 - 0.004, d.y1 - 0.004, 0.04); innerS.holes = [ptsPath(win)];
		B.add(new THREE.ShapeGeometry(innerS, 6), m.walnut, mz(IN.z + 0.03));
		revealRing(win.map((p) => new V3(p[0], p[1], IN.z + 0.03)), win.map((p) => new V3(p[0], p[1], OUT.z - 0.004)), m.trim);
		const wg = new THREE.ShapeGeometry(new THREE.Shape(win.map((p) => new THREE.Vector2(p[0], p[1]))));
		B.add(wg, m.window, new THREE.Matrix4().makeTranslation(0, 0, 1.25), { cast: false });
		// door edge
		revealRing(rectPts(d).map((p) => new V3(p[0], p[1], IN.z + 0.03)), rectPts(d).map((p) => new V3(p[0], p[1], OUT.z - 0.004)), m.trim);
		put(slab(0.12, 0.03, 0.04, 0.01), m.chrome, 3.3, 1.0, OUT.z + 0.015);
		put(softBox(0.04, 0.12, 0.05, 0.015), m.brass, 3.32, 1.0, IN.z + 0.005);
		put(cyl(0.014, 0.014, 0.5, 12), m.brass, 2.76, 1.15, IN.z - 0.05);
		for (const y of [0.92, 1.38]) put(cyl(0.01, 0.01, 0.05, 8), m.brass, 2.76, y, IN.z - 0.025, PI / 2);
		// fold-out steps with snow
		for (const [y, z] of [[-0.3, OUT.z + 0.2], [-0.62, OUT.z + 0.42]]) {
			put(slab(0.56, 0.035, 0.26, 0.008), m.alloy, 3.12, y, z);
			put(softBox(0.5, 0.04, 0.22, 0.02, { density: 24, puff: 0.02, wrinkle: 0.006 }), m.snowSoft, 3.12, y + 0.035, z);
			for (const s of [-1, 1]) put(slab(0.02, 0.36, 0.02), m.alloy, 3.12 + s * 0.27, y + 0.15, z - 0.1, -0.5, 0, 0);
		}
		col(d.x0, 0, IN.z - 0.02, d.x1, d.y1, IN.z + 0.1);
	}

	// ------------------------------------------------------------------ lounge: sofa, throw, pillows, guitar
	{
		B.push(M(2.38, 0, -IN.z));
		put(slab(1.8, 0.09, 0.6), m.walnut, 0, 0.045, 0.33);
		put(softBox(1.86, 0.26, 0.72, 0.035, { density: 8 }), m.sofa, 0, 0.22, 0.36);
		for (const s of [-1, 1]) put(softBox(0.15, 0.34, 0.72, 0.065, { density: 14, puff: 0.012 }), m.sofa, s * 0.855, 0.5, 0.36);
		for (let i = 0; i < 2; i++) {
			const x = -0.39 + i * 0.78;
			put(softBox(0.77, 0.15, 0.58, 0.05, { density: 20, puff: 0.02, wrinkle: 0.002, sag: 0.006 }), m.sofa, x, 0.425, 0.41);
			put(softBox(0.77, 0.46, 0.17, 0.065, { density: 20, puffSide: 0.02, wrinkle: 0.0025 }), m.sofa, x, 0.66, 0.11, -0.16);
		}
		const pil = [[m.pillowRust, -0.62, 0.44, 0.08], [m.pillowCream, -0.22, 0.46, -0.05], [m.pillowOlive, 0.42, 0.42, 0.1], [m.pillowBrown, 0.12, 0.38, -0.12]];
		for (const [mat, x, s, rz] of pil) put(pillow(s, 0.13, s), mat, x, 0.66, 0.26, 1.22, rz * 0.6, rz);
		put(pillow(0.5, 0.1, 0.3), m.pillowCream, 0.62, 0.56, 0.4, 1.3, -0.5, 0.2);
		// knit throw over the cab-side arm
		const throwG = drape(0.62, [[0.42, 0.52], [0.6, 0.52], [0.72, 0.6], [0.8, 0.69], [0.89, 0.69], [0.95, 0.6], [0.965, 0.38], [0.97, 0.14]], { folds: 0.014, foldF: 4, seed: 3, wrinkle: 0.003 });
		B.add(throwG, m.throwKnit, M(0, 0, 0.4, 0, PI / 2, 0));
		B.pop();
		col(1.45, 0, -IN.z, 3.32, 0.9, -0.44);
		focus('Bouclé sofa', 'Three-seater with a hand-knit wool throw. The cushion on the left is still dented.', [1.45, 0, -1.17, 3.32, 0.9, -0.44], [0.15, 0.45, 1], 2.0);

		// slippers
		for (const [x, a] of [[2.0, 0.25], [2.13, -0.1]]) put(softBox(0.1, 0.06, 0.26, 0.04, { density: 30, puff: 0.012, wrinkle: 0.003 }), m.fur, x, 0.03, -0.32, 0, a, 0);

		// parlour guitar leaning on the arm
		const body = new THREE.Shape();
		const hw = (y) => Math.max(0.18 * Math.sqrt(Math.max(0, 1 - ((y - 0.16) / 0.165) ** 2)), 0.135 * Math.sqrt(Math.max(0, 1 - ((y - 0.37) / 0.12) ** 2)), 0.11 * Math.sqrt(Math.max(0, 1 - ((y - 0.27) / 0.2) ** 2)));
		const ys = []; for (let i = 0; i <= 48; i++) ys.push(i / 48 * 0.49 - 0.005);
		body.moveTo(0, ys[0]);
		for (const y of ys) body.lineTo(hw(y), y);
		for (let i = ys.length - 1; i >= 0; i--) body.lineTo(-hw(ys[i]), ys[i]);
		const gb = new THREE.ExtrudeGeometry(body, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 4 });
		B.push(M(3.4, 0.02, -0.66, -0.0, -1.2, 0.2));
		B.push(M(0, 0, 0, -0.16, 0, 0));
		put(gb, m.oak, 0, 0, -0.04);
		put(new THREE.CircleGeometry(0.045, 32), m.blackMatte, 0, 0.33, 0.049);
		put(new THREE.RingGeometry(0.045, 0.055, 32), m.walnut, 0, 0.33, 0.0495);
		put(slab(0.1, 0.02, 0.012), m.walnut, 0, 0.12, 0.05);
		put(softBox(0.05, 0.46, 0.025, 0.008), m.walnut, 0, 0.7, 0.03);
		put(slab(0.075, 0.17, 0.018, 0.006), m.walnut, 0, 1.0, 0.026);
		for (let k = 0; k < 6; k++) {
			put(cyl(0.0007, 0.0007, 0.8, 4), m.steel, -0.015 + k * 0.006, 0.52, 0.052);
			put(cyl(0.006, 0.006, 0.03, 8), m.brass, (k < 3 ? -1 : 1) * 0.05, 0.96 + (k % 3) * 0.045, 0.026, 0, 0, PI / 2);
		}
		B.pop(); B.pop();
		col(3.3, 0, -0.78, 3.55, 1.0, -0.5);
		focus('Parlour guitar', 'Small-bodied spruce guitar, tuned half a step down for slow songs.', [3.25, 0, -0.85, 3.6, 1.05, -0.45], [0.2, 0.25, 1], 1.0);

		// runner rug
		const rg = new THREE.BoxGeometry(3.0, 0.008, 0.78);
		put(rg, m.rug, 1.65, 0.004, 0, 0, 0, 0, { cast: false });
		focus('Kilim runner', 'Hand-woven wool, picked up at a market in Moab.', [0.15, 0, -0.4, 3.15, 0.02, 0.4], [0.3, 1, 0.4], 1.6);
	}

	// ------------------------------------------------------------------ fairy lights and travel photos over the lounge window
	const fairyPts = [];
	{
		const a = new V3(1.4, 1.89, -1.06), b = new V3(3.3, 1.89, -1.06);
		const wire = [];
		for (let i = 0; i <= 40; i++) {
			const t = i / 40; const p = a.clone().lerp(b, t);
			p.y -= Math.sin(t * PI * 2 % PI) * 0.05 + Math.sin(t * PI) * 0.02;
			p.z += 0.01 * Math.sin(t * 13);
			wire.push(p);
		}
		B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wire), 120, 0.0015, 4), m.blackMatte, null, { cast: false });
		for (let i = 1; i < 40; i++) fairyPts.push(wire[i].clone().add(new V3(0, -0.008, 0.004)));
		const ph = [0.22, 0.38, 0.55, 0.7, 0.86];
		ph.forEach((t, k) => {
			const i = Math.round(t * 40); const p = wire[i];
			put(slab(0.008, 0.03, 0.006, 0.001), m.oak, p.x, p.y - 0.012, p.z + 0.005);
			put(new THREE.PlaneGeometry(0.08, 0.095), m.photos[k], p.x, p.y - 0.065, p.z + 0.008, 0, 0.05, (R() - 0.5) * 0.18, { cast: false });
		});
		focus('Travel photos', 'Polaroids from Big Sur, Moab, Yellowknife and Banff, clipped under the fairy lights.', [1.4, 1.65, -1.17, 3.3, 1.88, -1.05], [0, -0.1, 1], 1.1);
	}

	// ------------------------------------------------------------------ wood stove, hearth, stone wall, birch basket
	const stove = { x: 0.9, z: -0.93 };
	{
		put(slab(0.86, 0.05, 0.68, 0.01), m.hearth, 0.9, 0.025, -0.83);
		put(softBox(0.92, 1.6, 0.05, 0.008, { density: 3, grain: 'h' }), m.stone, 0.9, 0.8, -IN.z + 0.02);
		put(slab(0.98, 0.04, 0.09, 0.008), m.walnut, 0.9, 1.62, -IN.z + 0.045);
		// stove body: open-front firebox with glass door
		const sx = stove.x, sz = stove.z, y0 = 0.17;
		const W = 0.44, H = 0.44, D = 0.36;
		B.push(M(sx, 0, sz));
		for (const [x, z] of [[-0.17, -0.13], [0.17, -0.13], [-0.17, 0.13], [0.17, 0.13]]) put(cyl(0.018, 0.022, y0 - 0.05, 12), m.iron, x, 0.05 + (y0 - 0.05) / 2, z);
		put(softBox(W, 0.03, D, 0.01), m.iron, 0, y0, 0);
		put(softBox(W + 0.04, 0.035, D + 0.04, 0.012), m.iron, 0, y0 + H, 0);
		put(softBox(W, H, 0.03, 0.01), m.iron, 0, y0 + H / 2, -D / 2);
		for (const s of [-1, 1]) put(softBox(0.03, H, D, 0.01), m.iron, s * (W / 2 - 0.015), y0 + H / 2, 0);
		put(slab(W - 0.06, 0.02, D - 0.04, 0.004), m.ash, 0, y0 + 0.025, 0);
		put(slab(W - 0.06, H - 0.06, 0.01), m.hearth, 0, y0 + H / 2, -D / 2 + 0.02);
		// door frame
		const fz = D / 2;
		put(softBox(W, 0.07, 0.03, 0.01), m.iron, 0, y0 + 0.05, fz);
		put(softBox(W, 0.06, 0.03, 0.01), m.iron, 0, y0 + H - 0.03, fz);
		for (const s of [-1, 1]) put(softBox(0.06, H, 0.03, 0.01), m.iron, s * (W / 2 - 0.03), y0 + H / 2, fz);
		put(new THREE.PlaneGeometry(W - 0.1, H - 0.12), m.stoveGlass, 0, y0 + H / 2 + 0.005, fz + 0.002, 0, 0, 0, { cast: false });
		put(tube([[0.17, y0 + 0.3, fz + 0.02], [0.2, y0 + 0.3, fz + 0.06], [0.2, y0 + 0.17, fz + 0.06], [0.17, y0 + 0.17, fz + 0.02]], 0.007, 24, 8), m.brass);
		// ash lip, top plate rings
		put(softBox(W + 0.02, 0.02, 0.06, 0.008), m.iron, 0, y0 - 0.005, fz + 0.03);
		put(cyl(0.09, 0.09, 0.01, 32), m.iron, 0, y0 + H + 0.022, 0);
		// flue
		put(cyl(0.065, 0.065, IN.y1 - (y0 + H), 32), m.iron, 0, (IN.y1 + y0 + H) / 2, -0.02);
		put(cyl(0.11, 0.11, 0.025, 32), m.brass, 0, IN.y1 - 0.012, -0.02);
		put(cyl(0.075, 0.075, 0.04, 32), m.iron, 0, 0.98, -0.02);
		// logs in the firebox (ember material)
		const logG = cyl(0.035, 0.04, 0.3, 14);
		put(logG, m.emberLog, -0.03, y0 + 0.07, 0.0, 0, 0.3, PI / 2);
		put(logG, m.emberLog, 0.04, y0 + 0.08, 0.06, 0, -0.5, PI / 2);
		put(cyl(0.03, 0.03, 0.26, 12), m.emberLog, 0.0, y0 + 0.13, 0.02, 0.1, 1.4, PI / 2 - 0.25);
		B.pop();
		col(0.46, 0, -IN.z, 1.34, 0.7, -0.68);
		col(0.82, 0.6, -1.03, 0.98, IN.y1, -0.87);
		focus('Wood stove', 'Cast iron, burning birch. About 74 °C at the glass, enough to keep the whole van at 21 °C.', [0.62, 0.05, -1.12, 1.18, 0.66, -0.73], [0.35, 0.3, 1], 1.25);

		// heat-powered stove fan
		const fan = new THREE.Group();
		fan.position.set(sx + 0.1, y0 + H + 0.03, sz + 0.02);
		const fb = new THREE.Mesh(slab(0.07, 0.012, 0.05, 0.003), m.iron); fb.position.y = 0.006; fan.add(fb);
		const fp = new THREE.Mesh(slab(0.01, 0.13, 0.05, 0.003), m.iron); fp.position.y = 0.075; fan.add(fp);
		const rotor = new THREE.Group(); rotor.position.set(0.0, 0.13, 0.03); fan.add(rotor);
		const hubM = new THREE.Mesh(cyl(0.01, 0.01, 0.02, 12), m.brass); hubM.rotation.x = PI / 2; rotor.add(hubM);
		for (let k = 0; k < 4; k++) {
			const bl = new THREE.Mesh(softBox(0.022, 0.07, 0.003, 0.0015), m.steel);
			const piv = new THREE.Group(); piv.rotation.z = k * PI / 2; piv.add(bl); bl.position.y = 0.04; bl.rotation.y = 0.5;
			rotor.add(piv);
		}
		fan.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
		group.add(fan);
		updaters.push((t, dt) => { rotor.rotation.z -= dt * 3.2; });
		focus('Stove fan', 'Runs on the heat of the stove alone. The hotter the fire, the faster it turns.', [sx + 0.05, y0 + H, sz - 0.03, sx + 0.15, y0 + H + 0.2, sz + 0.07], [0.4, 0.3, 1], 0.45);

		// flames + glow
		const flames = new THREE.Group(); flames.position.set(sx, y0 + 0.07, sz + 0.02);
		const fl = [[0, 0.17, 0.2, 0], [0.07, 0.13, 0.17, 1.1], [-0.08, 0.12, 0.15, 2.0], [0.02, 0.1, 0.24, 2.9], [-0.03, 0.15, 0.12, 3.7]];
		const flameI = 2.9;
		fl.forEach(([x, w, h, seed], k) => {
			const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), flameMaterial(seed, flameI));
			pl.position.set(x, h / 2, (k % 2) * 0.03 - 0.02);
			pl.rotation.y = (k - 2) * 0.35;
			pl.renderOrder = 3;
			flames.add(pl);
		});
		const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), glowMaterial(0xff7a2a, 0.5));
		glow.position.set(0, 0.12, 0.16); glow.renderOrder = 3; flames.add(glow);
		fx.add(flames);

		// birch firewood basket
		const bx = 1.3, bz = -0.95;
		put(lathe([[0.001, 0], [0.13, 0], [0.145, 0.05], [0.15, 0.28], [0.142, 0.285], [0.135, 0.06], [0.001, 0.02]], 32), m.wool, bx, 0.05, bz);
		for (let i = 0; i < 6; i++) {
			const a = i / 6 * PI * 2 + 0.3, r = i === 0 ? 0 : 0.07;
			const h = 0.42 + R() * 0.08;
			put(cyl(0.035, 0.038, h, 14), m.birch, bx + Math.cos(a) * r * 0.9, 0.08 + h / 2, bz + Math.sin(a) * r * 0.9, (R() - 0.5) * 0.15, 0, (R() - 0.5) * 0.15);
			put(new THREE.CircleGeometry(0.035, 16), m.endGrain, bx + Math.cos(a) * r * 0.9, 0.081 + h, bz + Math.sin(a) * r * 0.9, -PI / 2);
		}
		col(1.14, 0, -1.12, 1.46, 0.55, -0.79);
		focus('Birch firewood', 'Split last week and dried by the stove. Smells faintly of wintergreen.', [1.14, 0, -1.12, 1.46, 0.55, -0.79], [0.3, 0.6, 1], 0.9);
	}

	// ------------------------------------------------------------------ dinette with coffee, book, candle
	const cup = new V3(1.62, 0.758, 0.77);
	{
		put(softBox(0.76, 0.035, 0.66, 0.012, { density: 3 }), m.walnut, 1.825, 0.74, 0.84);
		put(cyl(0.03, 0.03, 0.72, 16), m.brass, 1.825, 0.37, 0.75);
		put(cyl(0.16, 0.18, 0.02, 32), m.brass, 1.825, 0.01, 0.75);
		put(slab(0.5, 0.06, 0.04), m.walnut, 1.825, 0.7, IN.z - 0.03);
		for (const [x0, x1, back] of [[0.95, 1.45, 0.95], [2.2, 2.7, 2.7]]) {
			const cx = (x0 + x1) / 2, dir = back < cx ? 1 : -1;
			put(slab(0.5, 0.36, 0.66, 0.008), m.walnut, cx, 0.18, 0.84);
			put(softBox(0.48, 0.09, 0.64, 0.035, { density: 20, puff: 0.012, wrinkle: 0.0015 }), m.leather, cx, 0.405, 0.84);
			put(slab(0.04, 0.6, 0.66, 0.006), m.walnut, back + dir * 0.02, 0.66, 0.84);
			for (let k = 0; k < 4; k++) {
				put(softBox(0.08, 0.46, 0.155, 0.035, { density: 24, puffSide: 0.012 }), m.leather, back + dir * 0.08, 0.7, 0.6 + k * 0.158, 0, 0, dir * 0.1);
			}
			col(x0, 0, 0.5, x1, 0.98, IN.z);
		}
		col(1.45, 0, 0.5, 2.2, 0.78, IN.z);
		focus('Dinette', 'Walnut table for two by the big window. Best seat for watching the snow.', [0.95, 0, 0.5, 2.7, 0.98, 1.17], [-0.2, 0.55, -1], 2.0);

		// coffee
		B.push(M(cup.x, cup.y, cup.z));
		put(lathe([[0.001, 0], [0.075, 0], [0.078, 0.004], [0.072, 0.008], [0.03, 0.006], [0.001, 0.006]], 48), m.ceramic, 0, 0, 0);
		put(lathe([[0.001, 0.006], [0.028, 0.006], [0.034, 0.012], [0.042, 0.04], [0.046, 0.075], [0.047, 0.084], [0.043, 0.084], [0.04, 0.05], [0.032, 0.016], [0.001, 0.013]], 48), m.ceramic, 0, 0, 0);
		put(new THREE.CircleGeometry(0.042, 40), m.coffee, 0, 0.074, 0, -PI / 2, 0, 0, { cast: false });
		put(new THREE.TorusGeometry(0.02, 0.0055, 10, 24, PI * 1.3), m.ceramic, 0.051, 0.05, 0, 0, 0, -PI * 0.65);
		put(softBox(0.08, 0.003, 0.012, 0.0015), m.steel, -0.02, 0.009, 0.055, 0, 0.4, 0);
		B.pop();
		steam = wisps({ count: 70, life: 3.6, rise: 0.3, spread: 0.028, drift: 0.07, size: 0.06, grow: 1.6, opacity: 0.2 });
		steam.position.set(cup.x, cup.y + 0.08, cup.z);
		fx.add(steam);
		focus('Hot coffee', 'Oat flat white, poured four minutes ago. Still too hot to drink.', [cup.x - 0.08, cup.y, cup.z - 0.08, cup.x + 0.08, cup.y + 0.1, cup.z + 0.08], [-0.55, 0.65, -0.55], 0.42);

		// open book with reading glasses
		B.push(M(1.98, 0.758, 0.74, 0, 0.35, 0));
		put(slab(0.3, 0.012, 0.2, 0.004), m.leatherDark, 0, 0.006, 0);
		const pg = surface(24, 2, (u, v, t) => { const x = (u - 0.5) * 0.28; t.set(x, 0.016 + Math.sin(Math.abs(x) / 0.14 * PI * 0.5) * 0.012 - (Math.abs(x) < 0.01 ? 0.006 : 0), (v - 0.5) * 0.19); });
		flipWinding(pg);
		put(pg, m.paper, 0, 0, 0);
		for (const s of [-1, 1]) put(new THREE.TorusGeometry(0.02, 0.0018, 8, 32), m.bronze, s * 0.026, 0.04, 0.03, PI / 2.3, 0, 0);
		put(cyl(0.0015, 0.0015, 0.012, 6), m.bronze, 0, 0.04, 0.03, 0, 0, PI / 2);
		for (const s of [-1, 1]) put(cyl(0.0014, 0.0014, 0.11, 6), m.bronze, s * 0.046, 0.035, -0.025, PI / 2 + 0.15, 0, 0);
		B.pop();
		focus('Open book', '"A Field Guide to Getting Lost", page 112. Reading glasses left on top.', [1.82, 0.75, 0.62, 2.14, 0.8, 0.86], [-0.3, 0.9, -0.4], 0.5);

		// candle in an amber jar, dried eucalyptus, cookies
		const cj = new V3(1.86, 0.758, 1.05);
		put(lathe([[0.001, 0], [0.04, 0], [0.042, 0.004], [0.042, 0.085], [0.039, 0.085], [0.039, 0.004], [0.001, 0.004]], 32), m.glassAmber, cj.x, cj.y, cj.z, 0, 0, 0, { cast: false });
		put(cyl(0.036, 0.036, 0.05, 24), m.wax, cj.x, cj.y + 0.03, cj.z);
		const cf = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.04), flameMaterial(5.3, 3.0, 2.4));
		cf.position.set(cj.x, cj.y + 0.075, cj.z); cf.renderOrder = 3; fx.add(cf);
		const cglow = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), glowMaterial(0xff9a40, 0.35)); cglow.position.copy(cf.position); cglow.renderOrder = 3; fx.add(cglow);
		const candleFlames = [cf, cglow];

		put(lathe([[0.001, 0], [0.03, 0], [0.04, 0.04], [0.032, 0.11], [0.018, 0.14], [0.02, 0.15], [0.018, 0.15]], 32), m.ceramicSage, 2.08, 0.758, 1.06);
		for (let i = 0; i < 7; i++) {
			const a = i / 7 * PI * 2; const tip = new V3(2.08 + Math.cos(a) * 0.09, 0.758 + 0.32 + R() * 0.08, 1.06 + Math.sin(a) * 0.07);
			const st = [new V3(2.08, 0.9, 1.06), new V3(2.08 + Math.cos(a) * 0.04, 1.0, 1.06 + Math.sin(a) * 0.03), tip];
			B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(st), 10, 0.0018, 4), m.stem);
			const leaf = ovalLeaf(0.03, 0.022);
			for (let k = 0; k < 6; k++) {
				const t = 0.25 + k * 0.12; const p = new THREE.CatmullRomCurve3(st).getPoint(t);
				addLeaves(leaf, M(p.x, p.y, p.z, R() * PI, R() * PI * 2, R() * PI), [0.25 + R() * 0.05, 0.33 + R() * 0.05, 0.28]);
			}
		}
		put(lathe([[0.001, 0], [0.08, 0], [0.095, 0.012], [0.1, 0.016]], 32), m.ceramic, 1.66, 0.758, 1.02);
		for (const [dx, dz] of [[-0.03, 0], [0.03, 0.02], [0, -0.035]]) put(softBox(0.055, 0.012, 0.055, 0.006, { density: 40, puff: 0.003, wrinkle: 0.0015 }), m.cookie, 1.66 + dx, 0.776, 1.02 + dz, 0, R(), 0);
		focus('Candle', 'Cedar and smoked vanilla. Lit at dusk.', [cj.x - 0.05, cj.y, cj.z - 0.05, cj.x + 0.05, cj.y + 0.12, cj.z + 0.05], [-0.4, 0.4, -1], 0.45);

		// pendant lamps over the table
		for (const x of [1.68, 1.98]) {
			const y = 1.5;
			put(cyl(0.004, 0.004, IN.y1 - y - 0.08, 6), m.blackMatte, x, (IN.y1 + y + 0.08) / 2, 0.86);
			put(cyl(0.035, 0.035, 0.012, 24), m.brass, x, IN.y1 - 0.006, 0.86);
			put(lathe([[0.001, 0.09], [0.025, 0.09], [0.03, 0.06], [0.026, 0.05]], 24), m.brass, x, y, 0.86);
			put(new THREE.SphereGeometry(0.075, 40, 28), m.globe, x, y, 0.86, 0, 0, 0, { cast: false });
			col(x - 0.08, y - 0.08, 0.78, x + 0.08, IN.y1, 0.94);
		}
		focus('Pendant lamps', 'Opal glass globes on brass caps, dimmed to about a third.', [1.6, 1.42, 0.78, 2.06, 1.62, 0.94], [-0.3, -0.4, -1], 0.9);
		updaters.push((t, dt, cam) => {
			for (const f of candleFlames) f.rotation.y = Math.atan2(cam.position.x - f.position.x, cam.position.z - f.position.z);
			cf.scale.y = 0.9 + Math.sin(t * 11) * 0.05 + Math.sin(t * 23.7) * 0.04;
		});
	}

	// ------------------------------------------------------------------ kitchen (+z side)
	{
		const zf = 0.6, ct = 0.9;
		put(slab(2.6, 0.1, 0.5), m.blackMatte, -0.45, 0.05, 0.9);
		put(slab(2.6, 0.58, 0.55, 0.004), m.walnut, -0.45, 0.39, 0.875);
		put(slab(0.02, 0.87, 0.57, 0.003), m.walnut, 0.86, 0.435, 0.885);
		const units = [[-1.75, -1.2, 'drawers'], [-1.2, -0.8, 'door'], [-0.8, 0.0, 'doors'], [0.0, 0.35, 'drawers'], [0.35, 0.85, 'doors']];
		const handle = (x, y, len = 0.12, vertical = false) => {
			put(cyl(0.006, 0.006, len, 10), m.brass, x, y, zf - 0.035, vertical ? 0 : 0, 0, vertical ? 0 : PI / 2);
			const off = len / 2 - 0.012;
			for (const s of [-1, 1]) put(cyl(0.004, 0.004, 0.025, 8), m.brass, x + (vertical ? 0 : s * off), y + (vertical ? s * off : 0), zf - 0.02, PI / 2);
		};
		for (const [x0, x1, type] of units) {
			const w = x1 - x0 - 0.006, cx = (x0 + x1) / 2;
			if (type === 'drawers') {
				const hs = [0.2, 0.26, 0.3]; let y = 0.11;
				for (const h of hs) { put(slab(w, h - 0.006, 0.02, 0.004), m.walnut, cx, y + h / 2, zf - 0.01); handle(cx, y + h - 0.06); y += h; }
			} else if (type === 'door') {
				put(slab(w, 0.75, 0.02, 0.004), m.walnut, cx, 0.49, zf - 0.01); handle(x1 - 0.05, 0.75, 0.14, true);
			} else {
				for (const s of [-1, 1]) { put(slab(w / 2 - 0.003, 0.75, 0.02, 0.004), m.walnut, cx + s * w / 4, 0.49, zf - 0.01); handle(cx + s * 0.04, 0.75, 0.14, true); }
			}
		}
		// quartz counter with sink cut-out
		const cs = new THREE.Shape(); cs.moveTo(-1.77, -IN.z); cs.lineTo(0.87, -IN.z); cs.lineTo(0.87, -0.57); cs.lineTo(-1.77, -0.57); cs.closePath();
		const hole = new THREE.Path(); roundRect(hole, -0.66, -1.08, -0.16, -0.73, 0.03); cs.holes = [hole];
		const cg = new THREE.ExtrudeGeometry(cs, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 6 });
		B.add(cg, m.quartz, M(0, ct - 0.03, 0, -PI / 2, 0, 0));
		// sink basin
		const sxc = -0.41, szc = 0.905, sw = 0.5, sd = 0.35, sdep = 0.19;
		put(slab(sw, 0.006, sd), m.steel, sxc, ct - sdep, szc);
		for (const s of [-1, 1]) {
			put(slab(0.006, sdep, sd), m.steel, sxc + s * sw / 2, ct - sdep / 2, szc);
			put(slab(sw, sdep, 0.006), m.steel, sxc, ct - sdep / 2, szc + s * sd / 2);
		}
		put(cyl(0.022, 0.022, 0.004, 20), m.blackMatte, sxc, ct - sdep + 0.004, szc);
		// faucet
		const fxp = -0.41, fzp = 1.12;
		put(cyl(0.022, 0.026, 0.05, 20), m.brass, fxp, ct + 0.025, fzp);
		B.add(tube([[fxp, ct + 0.04, fzp], [fxp, ct + 0.24, fzp - 0.01], [fxp, ct + 0.33, fzp - 0.07], [fxp, ct + 0.3, fzp - 0.16], [fxp, ct + 0.22, fzp - 0.19]], 0.011, 48, 12), m.brass);
		put(cyl(0.013, 0.011, 0.02, 12), m.brass, fxp, ct + 0.215, fzp - 0.19);
		put(cyl(0.006, 0.006, 0.09, 8), m.brass, fxp + 0.035, ct + 0.09, fzp, 0, 0, -0.9);
		// zellige backsplash avoiding the window
		const bs = (x0, x1, y0, y1) => put(slab(x1 - x0, y1 - y0, 0.012, 0.002), m.zellige, (x0 + x1) / 2, (y0 + y1) / 2, IN.z - 0.006);
		bs(-1.75, -0.92, ct, 1.46); bs(0.12, 0.85, ct, 1.46); bs(-0.92, 0.12, ct, 1.06);
		// two-burner hob with kettle
		put(slab(0.42, 0.006, 0.38, 0.004), m.blackMatte, 0.6, ct + 0.003, 0.89);
		for (const [bx, bz] of [[0.5, 0.8], [0.7, 0.98]]) {
			put(cyl(0.04, 0.045, 0.015, 24), m.brass, bx, ct + 0.012, bz);
			put(cyl(0.03, 0.03, 0.008, 24), m.blackMatte, bx, ct + 0.022, bz);
			for (let k = 0; k < 4; k++) put(slab(0.15, 0.012, 0.012), m.iron, bx, ct + 0.035, bz, 0, k * PI / 4, 0);
		}
		const kt = new V3(0.7, ct + 0.042, 0.98);
		put(lathe([[0.001, 0], [0.085, 0], [0.095, 0.02], [0.095, 0.1], [0.07, 0.15], [0.03, 0.17], [0.03, 0.18], [0.001, 0.19]], 40), m.enamel, kt.x, kt.y, kt.z);
		put(new THREE.SphereGeometry(0.015, 16, 12), m.walnut, kt.x, kt.y + 0.195, kt.z);
		put(new THREE.TorusGeometry(0.075, 0.009, 10, 32, PI), m.walnut, kt.x, kt.y + 0.17, kt.z, 0, PI / 2, 0);
		B.add(tube([[kt.x - 0.08, kt.y + 0.05, kt.z], [kt.x - 0.13, kt.y + 0.1, kt.z], [kt.x - 0.16, kt.y + 0.15, kt.z]], 0.012, 12, 8), m.enamel);
		ksteam = wisps({ count: 24, life: 2.8, rise: 0.22, spread: 0.008, drift: 0.05, size: 0.04, grow: 2.0, opacity: 0.08 });
		ksteam.position.set(kt.x - 0.165, kt.y + 0.16, kt.z); fx.add(ksteam);
		// upper cabinet over the hob, LED strip under it
		put(slab(0.66, 0.56, 0.34, 0.004), m.walnut, 0.53, 1.74, IN.z - 0.17);
		for (const s of [-1, 1]) { put(slab(0.322, 0.55, 0.02, 0.004), m.walnut, 0.53 + s * 0.165, 1.74, IN.z - 0.35); put(cyl(0.006, 0.006, 0.12, 10), m.brass, 0.53 + s * 0.03, 1.55, IN.z - 0.375); }
		put(slab(0.6, 0.006, 0.012), m.led, 0.53, 1.457, IN.z - 0.3, 0, 0, 0, { cast: false });
		// open spice shelf above the window and painting on the left
		put(slab(1.1, 0.025, 0.16, 0.004), m.walnut, -0.4, 1.78, IN.z - 0.08);
		for (let i = 0; i < 8; i++) {
			const x = -0.88 + i * 0.12;
			put(cyl(0.024, 0.024, 0.08, 20), m.glass, x, 1.833, IN.z - 0.08, 0, 0, 0, { cast: false });
			put(cyl(0.021, 0.021, 0.05, 16), i % 3 === 0 ? m.terracotta : i % 3 === 1 ? m.bread : m.dried, x, 1.82, IN.z - 0.08);
			put(cyl(0.025, 0.025, 0.012, 20), m.walnut, x, 1.879, IN.z - 0.08);
		}
		put(slab(0.6, 0.44, 0.03, 0.004), m.walnut, -1.33, 1.73, IN.z - 0.015);
		put(new THREE.PlaneGeometry(0.54, 0.38), m.painting, -1.33, 1.73, IN.z - 0.031, 0, PI, 0, { cast: false });
		focus('Painting', 'Oil sketch of the Sierra at dusk, bought from the painter at a campground.', [-1.65, 1.5, 1.1, -1.01, 1.96, 1.17], [0, 0, -1], 1.0);
		// cutting board, bread, crock with spoons, fruit bowl, herb pots, hanging mugs, towel
		put(softBox(0.36, 0.018, 0.24, 0.008), m.oak, -1.3, ct + 0.009, 0.95, 0, 0.1, 0);
		put(softBox(0.24, 0.09, 0.12, 0.045, { density: 30, puff: 0.02, wrinkle: 0.006 }), m.bread, -1.32, ct + 0.06, 0.95, 0, 0.15, 0);
		put(lathe([[0.001, 0], [0.05, 0], [0.055, 0.02], [0.055, 0.15], [0.05, 0.155]], 32), m.ceramicSage, -1.62, ct, 1.06);
		for (let i = 0; i < 4; i++) B.add(tube([[-1.62 + (i - 1.5) * 0.012, ct + 0.04, 1.06], [-1.62 + (i - 1.5) * 0.03, ct + 0.33, 1.06 + (i % 2) * 0.02]], 0.005, 4, 6), m.oak);
		put(lathe([[0.001, 0], [0.07, 0], [0.12, 0.06], [0.13, 0.075]], 40), m.ceramic, 0.18, ct, 0.86);
		for (const [dx, dz, mat, r] of [[-0.03, 0, m.orange, 0.036], [0.04, 0.02, m.orange, 0.034], [0.0, -0.045, m.apple, 0.033], [0.01, 0.035, m.apple, 0.032]]) put(new THREE.SphereGeometry(r, 24, 16), mat, 0.18 + dx, ct + 0.06, 0.86 + dz);
		for (let i = 0; i < 3; i++) {
			const x = -0.75 + i * 0.3;
			put(lathe([[0.001, 0], [0.04, 0], [0.05, 0.08], [0.055, 0.085]], 24), m.terracotta, x, 1.08, 1.1);
			const leaf = ovalLeaf(0.035, 0.018);
			for (let k = 0; k < 26; k++) {
				const a = R() * PI * 2, r = R() * 0.04;
				addLeaves(leaf, M(x + Math.cos(a) * r, 1.15 + R() * 0.09, 1.1 + Math.sin(a) * r, -0.4 - R() * 0.8, a, 0), leafColor(i === 1 ? 0.6 : 0));
			}
		}
		focus('Herb pots', 'Basil, thyme and rosemary on the window sill.', [-0.85, 1.06, 1.03, 0.0, 1.3, 1.17], [0, 0.3, -1], 0.75);
		for (const [x, mat] of [[0.32, m.ceramic], [0.44, m.ceramicDark]]) {
			put(cyl(0.003, 0.003, 0.04, 6), m.brass, x, 1.43, 1.06);
			put(lathe([[0.001, 0], [0.038, 0], [0.042, 0.09], [0.039, 0.09], [0.035, 0.005], [0.001, 0.005]], 32), mat, x, 1.32, 1.06, PI, 0, 0);
		}
		const towel = drape(0.24, [[0.0, 0.0], [0.015, -0.01], [0.02, -0.03], [0.02, -0.32]], { folds: 0.006, foldF: 3, seed: 9 });
		B.add(towel, m.tartan, M(-0.05, 0.8, zf - 0.05, 0, 0, 0));
		put(cyl(0.006, 0.006, 0.35, 8), m.brass, -0.05, 0.8, zf - 0.04, 0, 0, PI / 2);
		col(-1.77, 0, 0.57, 0.87, 0.97, IN.z);
		col(0.2, 1.45, 0.83, 0.86, IN.y1, IN.z);
		focus('Kitchen', 'Two-burner gas hob, kettle on low, quartz counter and a deep sink.', [-1.77, 0, 0.57, 0.87, 1.2, 1.17], [0.2, 0.7, -1], 2.0);
		// wall clock on the partition (real local time)
		const clock = new THREE.Group(); clock.position.set(-1.83, 1.7, 0.62); clock.rotation.y = PI / 2;
		const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 12, 48), m.walnut); clock.add(ring);
		const face = new THREE.Mesh(new THREE.CircleGeometry(0.115, 48), m.clock); face.position.z = -0.004; clock.add(face);
		const handG = (len, w) => { const g = new THREE.BoxGeometry(w, len, 0.002); g.translate(0, len / 2 - 0.012, 0); return g; };
		const hH = new THREE.Mesh(handG(0.065, 0.007), m.blackMatte), hM = new THREE.Mesh(handG(0.095, 0.005), m.blackMatte), hS = new THREE.Mesh(handG(0.1, 0.0018), m.pillowRust);
		hH.position.z = 0.002; hM.position.z = 0.004; hS.position.z = 0.006; clock.add(hH, hM, hS);
		group.add(clock);
		updaters.push(() => {
			const d = new Date(); const s = d.getSeconds() + d.getMilliseconds() / 1000, mi = d.getMinutes() + s / 60, h = (d.getHours() % 12) + mi / 60;
			hS.rotation.z = -s / 60 * PI * 2; hM.rotation.z = -mi / 60 * PI * 2; hH.rotation.z = -h / 12 * PI * 2;
		});
		focus('Wall clock', 'Set to your local time.', [-1.86, 1.56, 0.48, -1.8, 1.84, 0.76], [1, 0, 0], 0.6);
	}

	// ------------------------------------------------------------------ fridge and library wall (-z side)
	const books = [];
	{
		put(slab(0.6, 1.85, 0.6, 0.006), m.walnut, -1.45, 0.925, -0.87);
		put(slab(0.59, 1.18, 0.02, 0.004), m.walnut, -1.45, 0.6, -0.565);
		put(slab(0.59, 0.6, 0.02, 0.004), m.walnut, -1.45, 1.51, -0.565);
		put(slab(0.5, 0.03, 0.02), m.blackMatte, -1.45, 1.835, -0.565);
		put(cyl(0.008, 0.008, 0.4, 10), m.brass, -1.2, 0.95, -0.535);
		put(cyl(0.008, 0.008, 0.18, 10), m.brass, -1.2, 1.32, -0.535);
		for (const y of [0.76, 1.14, 1.24, 1.4]) put(cyl(0.005, 0.005, 0.03, 8), m.brass, -1.2, y, -0.55, PI / 2);
		col(-1.75, 0, -IN.z, -1.15, 1.85, -0.55);
		focus('Fridge', 'Walnut-panelled compressor fridge. Oat milk, cheddar, a jar of kimchi.', [-1.75, 0, -1.17, -1.15, 1.85, -0.55], [0.3, 0.2, 1], 1.8);

		// sideboard
		put(slab(1.5, 0.78, 0.42, 0.004), m.walnut, -0.35, 0.46, -0.96);
		put(slab(1.46, 0.07, 0.38), m.blackMatte, -0.35, 0.035, -0.97);
		put(slab(1.54, 0.03, 0.45, 0.006), m.walnutTrim, -0.35, 0.865, -0.95);
		for (let i = 0; i < 3; i++) {
			const cx = -1.1 + 0.25 + i * 0.5;
			put(slab(0.494, 0.74, 0.02, 0.004), m.walnut, cx, 0.46, -0.745);
			put(cyl(0.022, 0.022, 0.012, 20), m.brass, cx, 0.7, -0.732, PI / 2);
		}
		// open shelves with brackets
		const shelfY = [1.2, 1.5, 1.8];
		for (const y of shelfY) {
			put(slab(1.5, 0.025, 0.24, 0.005), m.walnut, -0.35, y, -IN.z + 0.12);
			for (const x of [-1.0, 0.3]) put(slab(0.012, 0.012, 0.2), m.brass, x, y - 0.018, -IN.z + 0.1);
		}
		col(-1.12, 0, -IN.z, 0.42, 0.9, -0.73);
		focus('Sideboard', 'A wooden radio tuned to the overnight jazz station, rye whiskey and two tumblers.', [-1.12, 0, -1.17, 0.42, 1.12, -0.73], [0.2, 0.55, 1], 1.5);
		col(-1.12, 1.15, -IN.z, 0.42, 1.98, -0.92);
		focus('Bookshelf', 'Field guides, poetry, a dog-eared road atlas and two seasons of travel journals.', [-1.12, 1.15, -1.17, 0.42, 1.98, -0.92], [0.1, 0.1, 1], 1.4);

		const palette = [0x6d2b2b, 0x2f4a3a, 0x283a52, 0xb88a3c, 0xe3d6bd, 0x9a4d2e, 0x4e5660, 0x6b6a3e, 0xb49572, 0x2f2d2c, 0x6f8597, 0x8c6b4f];
		const row = (x0, x1, y, gapAt = []) => {
			let x = x0;
			while (x < x1) {
				const t = 0.018 + R() * 0.028, h = 0.15 + R() * 0.09, d = 0.13 + R() * 0.06;
				if (x + t > x1) break;
				if (gapAt.some(([a, b]) => x > a && x < b)) { x += 0.02; continue; }
				const lean = (x + t + 0.03 > x1 && R() < 0.7) ? -0.18 : 0;
				books.push({ p: new V3(x + t / 2 + (lean ? 0.02 : 0), y + h / 2, -IN.z + 0.02 + d / 2), s: new V3(t, h, d), r: lean, c: palette[Math.floor(R() * palette.length)] });
				x += t + 0.002;
			}
		};
		row(-1.08, -0.45, 1.2125, []); row(0.0, 0.38, 1.2125);
		row(-1.08, -0.7, 1.5125); row(-0.2, 0.38, 1.5125);
		row(-0.55, 0.38, 1.8125);
		// horizontal stack + candle, camera, plant pots, framed photo, radio
		for (let i = 0; i < 4; i++) books.push({ p: new V3(-0.45, 1.525 + i * 0.03, -1.03), s: new V3(0.21, 0.028, 0.15), r: 0, c: palette[(i * 5) % palette.length], flat: (R() - 0.5) * 0.2 });
		put(cyl(0.03, 0.03, 0.07, 24), m.wax, -0.45, 1.68, -1.03);
		put(softBox(0.12, 0.08, 0.06, 0.01), m.blackMatte, -0.3, 1.553, -1.05);
		put(cyl(0.025, 0.028, 0.04, 24), m.blackMatte, -0.3, 1.553, -1.0, PI / 2);
		put(cyl(0.02, 0.02, 0.002, 24), m.glass, -0.3, 1.553, -0.979, PI / 2, 0, 0, { cast: false });
		put(slab(0.08, 0.012, 0.012), m.chrome, -0.3, 1.598, -1.05);
		put(lathe([[0.001, 0], [0.045, 0], [0.06, 0.1], [0.065, 0.11]], 32), m.ceramicSage, -0.25, 1.2125, -1.04);
		put(lathe([[0.001, 0], [0.025, 0], [0.04, 0.05], [0.025, 0.12], [0.012, 0.16], [0.016, 0.17]], 32), m.ceramicDark, -0.13, 1.2125, -1.05);
		// pothos on the top shelf, trailing down
		const pp = new V3(-0.85, 1.8125, -1.04);
		put(lathe([[0.001, 0], [0.055, 0], [0.065, 0.11], [0.07, 0.115]], 32), m.plantPot, pp.x, pp.y, pp.z);
		const heart = heartLeaf(0.05);
		for (let v = 0; v < 9; v++) {
			const a = (v / 9) * PI * 2;
			const start = new V3(pp.x + Math.cos(a) * 0.05, pp.y + 0.1, pp.z + Math.sin(a) * 0.04);
			const len = v < 5 ? 0.15 + R() * 0.2 : 0.45 + R() * 0.55;
			const pts = [start];
			const out = new V3(Math.cos(a) * 0.09, 0.05, Math.max(0.04, Math.sin(a) * 0.09 + 0.06));
			pts.push(start.clone().add(out));
			const n = 6;
			for (let k = 1; k <= n; k++) {
				const prev = pts[pts.length - 1];
				pts.push(new V3(prev.x + (R() - 0.5) * 0.06, Math.max(pp.y - len * k / n, 0.95), Math.min(-0.86, prev.z + 0.012)));
			}
			const curve = new THREE.CatmullRomCurve3(pts);
			B.add(new THREE.TubeGeometry(curve, 30, 0.0022, 5), m.stem, null, { cast: false });
			const count = Math.floor(5 + len * 22);
			for (let k = 0; k < count; k++) {
				const t = (k + 0.5) / count; const p = curve.getPoint(t); const tg = curve.getTangent(t);
				const yaw = Math.atan2(tg.x, tg.z) + (k % 2 ? 1.2 : -1.2);
				const sc = 0.75 + R() * 0.5 - t * 0.2;
				addLeaves(heart, M(p.x, p.y, p.z, -0.6 - R() * 0.6, yaw, (R() - 0.5) * 0.6, sc), leafColor(R() < 0.3 ? 1.6 : 0.2));
			}
		}
		focus('Pothos', 'Grown from a cutting taken in Banff. It has wrapped itself around the shelf bracket.', [-0.95, 1.4, -1.12, -0.7, 2.0, -0.85], [0.3, 0, 1], 0.9);
		// on the sideboard: fern print, radio, tray with amber glasses
		put(slab(0.3, 0.38, 0.02, 0.004), m.oak, 0.15, 1.07, -1.1, -0.12, 0, 0);
		put(new THREE.PlaneGeometry(0.26, 0.34), m.fern, 0.15, 1.07, -1.088, -0.12, 0, 0, { cast: false });
		put(softBox(0.24, 0.13, 0.1, 0.02), m.walnut, -0.85, 0.945, -1.0);
		put(new THREE.CircleGeometry(0.04, 24), m.blackMatte, -0.9, 0.945, -0.949);
		put(cyl(0.012, 0.012, 0.02, 12), m.brass, -0.78, 0.97, -0.945, PI / 2);
		put(cyl(0.012, 0.012, 0.02, 12), m.brass, -0.78, 0.925, -0.945, PI / 2);
		put(slab(0.36, 0.02, 0.2, 0.006), m.walnutTrim, -0.4, 0.89, -0.95);
		put(lathe([[0.001, 0], [0.035, 0], [0.037, 0.14], [0.02, 0.2], [0.014, 0.25], [0.016, 0.26]], 32), m.glassAmber, -0.5, 0.9, -0.97, 0, 0, 0, { cast: false });
		for (const dx of [-0.32, -0.24]) put(lathe([[0.001, 0], [0.032, 0], [0.034, 0.07], [0.031, 0.07], [0.029, 0.006], [0.001, 0.006]], 32), m.glass, dx, 0.9, -0.92, 0, 0, 0, { cast: false });
	}

	// ------------------------------------------------------------------ partition wall with doorway
	{
		const px = -1.88;
		put(panel(0.06, IN.y1, 0.75, 0.003), m.wall, px, IN.y1 / 2, -0.795);
		put(panel(0.06, IN.y1, 0.75, 0.003), m.wall, px, IN.y1 / 2, 0.795);
		put(panel(0.06, IN.y1 - 1.95, 0.84, 0.003), m.wall, px, (IN.y1 + 1.95) / 2, 0);
		for (const s of [-1, 1]) {
			put(slab(0.09, 1.95, 0.05, 0.005), m.walnutTrim, px, 0.975, s * 0.445);
		}
		put(slab(0.09, 0.05, 0.94, 0.005), m.walnutTrim, px, 1.95, 0);
		col(px - 0.04, 0, -IN.z, px + 0.04, IN.y1, -0.42);
		col(px - 0.04, 0, 0.42, px + 0.04, IN.y1, IN.z);
		col(px - 0.04, 1.95, -0.42, px + 0.04, IN.y1, 0.42);
	}

	// ------------------------------------------------------------------ bedroom
	{
		// wardrobes against the partition
		for (const s of [-1, 1]) {
			const zc = s * 0.835;
			put(slab(0.46, IN.y1 - 0.01, 0.66, 0.004), m.walnut, -2.15, IN.y1 / 2, zc);
			put(slab(0.02, 1.9, 0.32, 0.004), m.walnut, -2.39, 1.0, zc - 0.165);
			put(slab(0.02, 1.9, 0.32, 0.004), m.walnut, -2.39, 1.0, zc + 0.165);
			for (const dz of [-0.03, 0.03]) put(cyl(0.007, 0.007, 0.3, 10), m.brass, -2.41, 1.05, zc + dz);
			col(-2.4, 0, s > 0 ? 0.5 : -IN.z, -1.91, IN.y1, s > 0 ? IN.z : -0.5);
			focus('Wardrobe', s > 0 ? 'Wool sweaters, a down parka and a spare set of thermals.' : 'Hanging space with a full-length mirror on the door.', [-2.42, 0, s > 0 ? 0.5 : -1.17, -1.91, 2.05, s > 0 ? 1.17 : -0.5], [-1, 0.25, 0], 1.6);
		}
		put(slab(0.006, 1.2, 0.28, 0.002), m.mirror, -2.405, 1.1, -0.67);
		// bed platform with drawers
		put(slab(2.0, 0.4, 1.56, 0.006), m.walnut, -3.52, 0.2, 0);
		for (const s of [-1, 1]) { put(slab(0.02, 0.26, 0.7, 0.004), m.walnut, -2.51, 0.2, s * 0.38); put(cyl(0.007, 0.007, 0.16, 10), m.brass, -2.49, 0.24, s * 0.38, PI / 2); }
		put(softBox(2.0, 0.22, 1.5, 0.06, { density: 10, puff: 0.008 }), m.sheet, -3.5, 0.51, 0);
		// duvet draped over both sides
		const duv = drape(1.62, [[-0.86, 0.3], [-0.82, 0.48], [-0.78, 0.6], [-0.72, 0.67], [-0.55, 0.69], [0, 0.705], [0.55, 0.69], [0.72, 0.67], [0.78, 0.6], [0.82, 0.48], [0.86, 0.3]], { folds: 0.012, foldF: 5, seed: 12, wrinkle: 0.005, nu: 40, nv: 50 });
		B.add(duv, m.duvetDrape, M(-3.22, 0, 0, 0, 0, 0));
		put(softBox(0.24, 0.1, 1.64, 0.05, { density: 22, puff: 0.025, wrinkle: 0.005 }), m.duvet, -4.05, 0.7, 0);
		// tartan throw across the foot
		const thr = drape(0.55, [[-0.93, 0.2], [-0.89, 0.48], [-0.84, 0.68], [-0.74, 0.77], [0, 0.785], [0.74, 0.77], [0.84, 0.68], [0.89, 0.48], [0.93, 0.24]], { folds: 0.01, foldF: 3, seed: 21, wrinkle: 0.003, nu: 24, nv: 50 });
		B.add(thr, m.tartan, M(-2.82, 0, 0, 0, 0, 0));
		// pillows
		for (const s of [-1, 1]) {
			put(pillow(0.68, 0.16, 0.48), m.duvet, -4.27, 0.74, s * 0.37, 0.85, PI / 2, 0);
			put(pillow(0.62, 0.15, 0.5), m.headboard, -4.36, 0.86, s * 0.36, 1.1, PI / 2, 0);
		}
		put(pillow(0.5, 0.12, 0.26), m.pillowRust, -4.05, 0.8, 0.02, 1.2, PI / 2, 0.05);
		// channel-tufted headboard
		for (let k = 0; k < 7; k++) put(softBox(0.07, 0.62, 0.22, 0.04, { density: 24, puffSide: 0.01 }), m.headboard, IN.x0 + 0.04, 0.92, -0.66 + k * 0.22);
		put(slab(0.04, 0.05, 1.56, 0.006), m.walnut, IN.x0 + 0.03, 1.25, 0);
		col(IN.x0, 0, -0.8, -2.49, 0.8, 0.8);
		focus('Bed', 'Queen bed with a linen duvet and a wool tartan throw folded at the foot.', [-4.55, 0, -0.8, -2.49, 0.9, 0.8], [1, 0.75, 0.35], 2.5);
		// nightstands, sconces, books
		for (const s of [-1, 1]) {
			const zc = s * 0.99;
			put(slab(0.4, 0.55, 0.34, 0.004), m.walnut, -4.33, 0.275, zc);
			put(slab(0.36, 0.16, 0.02, 0.004), m.walnut, -4.13 + 0.0, 0.44, zc, 0, PI / 2, 0);
			put(cyl(0.016, 0.016, 0.012, 16), m.brass, -4.12, 0.44, zc, 0, 0, PI / 2);
			// sconce on the rear wall
			put(cyl(0.04, 0.04, 0.012, 24), m.brass, IN.x0 + 0.006, 1.32, zc, 0, 0, PI / 2);
			B.add(tube([[IN.x0 + 0.01, 1.32, zc], [IN.x0 + 0.12, 1.36, zc], [IN.x0 + 0.2, 1.3, zc]], 0.006, 16, 8), m.brass);
			put(lathe([[0.03, 0.06], [0.07, 0.0], [0.072, -0.004]], 32, 0, PI * 2), m.brass, IN.x0 + 0.2, 1.24, zc);
			put(new THREE.SphereGeometry(0.03, 20, 14), m.globe, IN.x0 + 0.2, 1.235, zc, 0, 0, 0, { cast: false });
			col(IN.x0, 0, s > 0 ? 0.82 : -IN.z, -4.12, 0.6, s > 0 ? IN.z : -0.82);
		}
		for (let i = 0; i < 3; i++) books.push({ p: new V3(-4.33, 0.565 + i * 0.03, 0.99), s: new V3(0.2, 0.028, 0.15), r: 0, c: [0x283a52, 0xb88a3c, 0x6d2b2b][i], flat: (R() - 0.5) * 0.3 });
		put(lathe([[0.001, 0], [0.038, 0], [0.042, 0.09], [0.039, 0.09], [0.035, 0.005], [0.001, 0.005]], 32), m.ceramicDark, -4.3, 0.55, -0.95);
		put(lathe([[0.001, 0], [0.04, 0], [0.05, 0.07], [0.052, 0.075]], 24), m.ceramic, -4.38, 0.55, -1.05);
		const fl = ovalLeaf(0.045, 0.02);
		for (let k = 0; k < 18; k++) { const a = R() * PI * 2; addLeaves(fl, M(-4.38 + Math.cos(a) * 0.02, 0.62, -1.05 + Math.sin(a) * 0.02, -0.2 - R() * 0.6, a, 0), leafColor(0.4)); }
		// overhead cabinets
		for (const s of [-1, 1]) {
			put(slab(2.1, 0.42, 0.34, 0.004), m.walnut, -3.5, 1.83, s * (IN.z - 0.17));
			for (let k = 0; k < 4; k++) {
				const x = -4.29 + k * 0.525;
				put(slab(0.515, 0.41, 0.02, 0.004), m.walnut, x, 1.83, s * (IN.z - 0.35));
				put(cyl(0.006, 0.006, 0.12, 10), m.brass, x, 1.66, s * (IN.z - 0.375), 0, 0, PI / 2);
			}
			put(slab(2.0, 0.006, 0.012), m.led, -3.5, 1.617, s * (IN.z - 0.3), 0, 0, 0, { cast: false });
			col(-4.55, 1.6, s > 0 ? 0.83 : -IN.z, -2.45, IN.y1, s > 0 ? IN.z : -0.83);
		}
		// rear window curtains
		const rodY = 1.79;
		put(cyl(0.011, 0.011, 1.7, 16), m.brass, IN.x0 + 0.07, rodY, 0, PI / 2);
		for (const e of [-1, 1]) {
			const g = curtainGeo(0.26, 0.62, 4, 0.02);
			g.applyMatrix4(M(IN.x0 + 0.08, rodY - 0.015, e < 0 ? -0.58 : 0.84, 0, PI / 2, 0));
			curtainGeos.push(g);
		}
		// sheepskin with slippers at the foot of the bed
		const sk = new THREE.Shape();
		for (let i = 0; i <= 40; i++) { const a = i / 40 * PI * 2; const r = 0.3 + 0.04 * Math.sin(a * 5) + 0.03 * Math.sin(a * 3 + 1); const x = Math.cos(a) * r * 0.8, y = Math.sin(a) * r * 1.2; i ? sk.lineTo(x, y) : sk.moveTo(x, y); }
		put(new THREE.ExtrudeGeometry(sk, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.02, bevelSegments: 3, curveSegments: 4 }), m.fur, -2.2, 0.012, 0, -PI / 2, 0, 0);
		focus('Sheepskin', 'Warm under bare feet on cold mornings.', [-2.45, 0, -0.4, -1.95, 0.05, 0.4], [0.5, 1, 0.3], 1.0);
	}

	// ------------------------------------------------------------------ cab: seats, dashboard, wheel, windshield curtains
	{
		const seat = (x, z, yaw) => {
			B.push(M(x, 0, z, 0, yaw, 0));
			put(slab(0.42, 0.06, 0.42, 0.01), m.blackMatte, 0, 0.03, 0);
			put(cyl(0.08, 0.1, 0.32, 20), m.blackMatte, 0, 0.22, 0);
			put(softBox(0.52, 0.14, 0.52, 0.055, { density: 20, puff: 0.014, wrinkle: 0.002 }), m.leatherDark, 0, 0.47, 0);
			put(softBox(0.14, 0.66, 0.5, 0.065, { density: 20, puffSide: 0.015, wrinkle: 0.002 }), m.leatherDark, -0.26, 0.88, 0, 0, 0, 0.14);
			put(softBox(0.12, 0.17, 0.3, 0.05, { density: 20 }), m.leatherDark, -0.33, 1.28, 0, 0, 0, 0.14);
			for (const s of [-1, 1]) {
				put(softBox(0.36, 0.05, 0.07, 0.024, { density: 20 }), m.leatherDark, 0.0, 0.72, s * 0.29);
				put(slab(0.03, 0.18, 0.03, 0.006), m.blackMatte, -0.12, 0.63, s * 0.29);
			}
			B.pop();
		};
		seat(3.88, -0.6, 0);
		seat(3.88, 0.62, PI * 0.86);
		put(pillow(0.4, 0.12, 0.4), m.pillowCream, 3.98, 0.72, 0.6, 1.1, PI * 0.86 - PI / 2, 0.1);
		col(3.58, 0, -0.9, 4.18, 1.38, -0.3);
		col(3.58, 0, 0.32, 4.18, 1.38, 0.92);
		focus('Captain seats', 'The passenger seat swivels round to face the lounge in the evenings.', [3.58, 0, -0.9, 4.18, 1.38, 0.92], [-1, 0.5, 0.1], 1.8);
		// dashboard
		put(softBox(0.62, 0.42, 2.34, 0.1, { density: 6, puff: 0.01 }), m.dash, 4.62, 0.86, 0);
		put(softBox(0.66, 0.06, 2.3, 0.03, { density: 6 }), m.dash, 4.68, 1.06, 0, 0, 0, 0.12);
		put(slab(0.02, 0.045, 2.2, 0.004), m.walnut, 4.32, 0.88, 0);
		put(softBox(0.2, 0.08, 0.42, 0.04, { density: 10 }), m.dash, 4.5, 1.1, -0.6);
		put(slab(0.01, 0.03, 0.08), m.led, 4.401, 0.97, 0.0, 0, 0, 0, { cast: false });
		put(softBox(0.3, 0.7, 0.3, 0.04, { density: 6 }), m.dash, 4.3, 0.35, 0.0);
		// steering wheel
		B.push(M(4.3, 1.02, -0.6, 0, 0, 0.55));
		B.push(M(0, 0, 0, 0, PI / 2, 0));
		put(new THREE.TorusGeometry(0.19, 0.017, 16, 64), m.leatherDark, 0, 0, 0);
		put(cyl(0.04, 0.045, 0.05, 24), m.dash, 0, 0, 0, PI / 2);
		for (const a of [0, PI * 0.5 + 0.6, PI * 0.5 - 0.6 + PI]) put(slab(0.17, 0.03, 0.015, 0.006), m.dash, Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0, 0, 0, a);
		B.pop();
		put(cyl(0.03, 0.035, 0.4, 16), m.dash, 0.0, -0.17, 0, 0, 0, 0);
		B.pop();
		// folded road map and sunglasses on the dash
		put(slab(0.22, 0.012, 0.16, 0.004), m.paper, 4.55, 1.1, 0.4, 0, 0.3, 0.12);
		for (const s of [-1, 1]) put(new THREE.TorusGeometry(0.022, 0.003, 8, 24), m.blackMatte, 4.6, 1.115, 0.15 + s * 0.026, PI / 2 - 0.12, 0, 0);
		// sun visors
		for (const s of [-1, 1]) put(softBox(0.04, 0.2, 0.6, 0.02), m.dash, 4.5, 1.95, s * 0.55, 0, 0, -0.35);
		// windshield curtains gathered at the pillars
		for (const s of [-1, 1]) {
			const g = curtainGeo(0.26, 0.92, 5, 0.03);
			g.applyMatrix4(M(4.5, 2.0, s < 0 ? -1.14 : 0.88, 0, -PI / 2 + 0.25, 0));
			curtainGeos.push(g);
		}
		col(4.3, 0, -IN.z, 5.0, 1.15, IN.z);
		focus('Dashboard', 'A folded road map of the Rockies and a pair of sunglasses nobody needs tonight.', [4.25, 0.6, -1.17, 4.95, 1.2, 1.17], [-1, 0.6, 0.1], 1.4);
		focus('Boots', 'Still dripping melted snow onto the coir mat.', [2.9, 0, 0.66, 3.35, 0.32, 1.1], [-0.3, 0.7, -0.7], 0.9);
		// boots on a coir mat by the door
		put(slab(0.6, 0.012, 0.4, 0.006), m.wool, 3.12, 0.006, 0.9);
		for (const [x, a] of [[3.02, 0.1], [3.22, -0.15]]) {
			B.push(M(x, 0.012, 0.86, 0, a, 0));
			put(softBox(0.1, 0.07, 0.28, 0.035, { density: 25 }), m.leather, 0, 0.035, 0);
			put(cyl(0.05, 0.055, 0.2, 20), m.leather, 0, 0.16, -0.06);
			put(cyl(0.056, 0.056, 0.035, 20), m.fur, 0, 0.27, -0.06);
			B.pop();
		}
		put(new THREE.CircleGeometry(0.2, 24), m.window, 3.12, 0.014, 0.86, -PI / 2, 0, 0, { cast: false });
	}

	// ------------------------------------------------------------------ merge statics
	const statics = B.build(group, 'motorhome-static');
	for (const s of statics) {
		if (s.material === m.window) s.renderOrder = 2;
		if (s.material === m.frost) s.renderOrder = 2;
		if (s.material.transparent) s.castShadow = false;
	}

	// curtains (sway shader needs its own attribute)
	const curtains = new THREE.Mesh(mergeGeometries(curtainGeos, false), m.curtain);
	curtains.castShadow = true; curtains.receiveShadow = true; group.add(curtains);
	// leaves (vertex coloured)
	const leaves = new THREE.Mesh(mergeGeometries(leafGeos, false), m.leaf);
	leaves.castShadow = true; leaves.receiveShadow = true; group.add(leaves);

	// books (instanced)
	const bookMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), m.books, books.length);
	const tmpM = new THREE.Matrix4(), tmpC = new THREE.Color();
	books.forEach((b, i) => {
		if (b.flat !== undefined) tmpM.compose(b.p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, b.flat, 0)), b.s);
		else {
			const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, b.r));
			const p = b.p.clone(); if (b.r) p.y -= b.s.y * 0.02;
			tmpM.compose(p, q, b.s);
		}
		bookMesh.setMatrixAt(i, tmpM);
		bookMesh.setColorAt(i, tmpC.set(b.c));
	});
	bookMesh.castShadow = true; bookMesh.receiveShadow = true; group.add(bookMesh);

	// fairy lights (instanced bulbs that twinkle)
	const fairy = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0085, 10, 8), m.fairy, fairyPts.length);
	fairyPts.forEach((p, i) => { tmpM.makeTranslation(p.x, p.y, p.z); fairy.setMatrixAt(i, tmpM); fairy.setColorAt(i, tmpC.setRGB(4, 2.4, 1)); });
	fx.add(fairy);
	const fairyPhase = fairyPts.map(() => Math.random() * 10);
	updaters.push((t) => {
		for (let i = 0; i < fairyPts.length; i++) {
			const k = 0.55 + 0.45 * Math.max(0, Math.sin(t * 0.9 + fairyPhase[i] * 3.0)) + 0.1 * Math.sin(t * 7 + fairyPhase[i]);
			fairy.setColorAt(i, tmpC.setRGB(4.2 * k, 2.5 * k, 1.05 * k));
		}
		fairy.instanceColor.needsUpdate = true;
	});

	// ------------------------------------------------------------------ lights
	const lights = {};
	// firelight: one shadowed spot facing the room (a single shadow pass) plus an unshadowed fill for the hearth
	const fire = new THREE.SpotLight(0xff8a3c, 6.5, 0, 1.25, 1.0, 2);
	fire.position.set(stove.x, 0.42, stove.z + 0.36);
	fire.target.position.set(stove.x, 0.25, stove.z + 2.5);
	fire.castShadow = quality.fireShadow;
	fire.shadow.mapSize.set(1024, 1024); fire.shadow.bias = -0.002; fire.shadow.normalBias = 0.02; fire.shadow.camera.near = 0.05; fire.shadow.camera.far = 9;
	group.add(fire, fire.target); lights.fire = fire;
	const fireFill = new THREE.PointLight(0xff8a3c, 1.6, 3.5, 2);
	fireFill.position.set(stove.x, 0.5, stove.z + 0.3);
	group.add(fireFill);
	const pend = new THREE.PointLight(0xffa860, 3.2, 0, 2); pend.position.set(1.83, 1.4, 0.86); group.add(pend); lights.pendant = pend;
	const bed = new THREE.PointLight(0xffa860, 2.2, 0, 2); bed.position.set(-3.9, 1.45, 0); group.add(bed); lights.bed = bed;
	const kit = new THREE.RectAreaLight(0xffc78a, 7, 0.6, 0.08); kit.position.set(0.53, 1.445, 1.0); kit.lookAt(0.53, 0, 1.0); group.add(kit);
	const ceil = new THREE.RectAreaLight(0xffcf9a, 0.55, 7.6, 1.6); ceil.position.set(-0.4, IN.y1 - 0.02, 0); ceil.lookAt(-0.4, 0, 0); group.add(ceil); lights.ceil = ceil;

	if (quality.windowFill) {
		const wl = new THREE.RectAreaLight(0x7f98c4, 1.4, 1.8, 0.9); wl.position.set(2.35, 1.28, -1.19); wl.lookAt(2.35, 1.0, 0); group.add(wl);
		const wr = new THREE.RectAreaLight(0x7f98c4, 1.2, 1.6, 0.9); wr.position.set(1.81, 1.3, 1.19); wr.lookAt(1.81, 1.0, 0); group.add(wr);
		lights.windows = [wl, wr];
	}
	const porch = new THREE.SpotLight(0xffbe78, 26, 16, 0.95, 0.75, 2);
	porch.position.set(3.12, 1.97, OUT.z + 0.08);
	porch.target.position.set(3.5, GROUND_Y, 3.6);
	porch.castShadow = quality.porchShadow;
	porch.shadow.mapSize.set(1024, 1024); porch.shadow.bias = -0.0008; porch.shadow.normalBias = 0.03; porch.shadow.camera.near = 0.2; porch.shadow.camera.far = 16;
	group.add(porch, porch.target); lights.porch = porch;
	const cone = lightCone(3.6, 1.55, 0xffc489, 0.12);
	cone.position.copy(porch.position); cone.position.y -= 0.03;
	cone.lookAt(porch.target.position); cone.rotateX(-PI / 2);
	fx.add(cone);

	updaters.push((t) => {
		const f = 0.82 + 0.1 * Math.sin(t * 7.3) + 0.07 * Math.sin(t * 13.1 + 1.3) + 0.05 * Math.sin(t * 23.7);
		fire.intensity = 6.5 * f; fireFill.intensity = 1.6 * f;
		fire.position.x = stove.x + Math.sin(t * 5.1) * 0.012;
		m.emberLog.emissiveIntensity = 2.0 + Math.sin(t * 1.7) * 0.5 + Math.sin(t * 4.3) * 0.25;
		pend.intensity = 3.2 * (0.97 + 0.03 * Math.sin(t * 0.21));
		U.time.value = t;
	});

	// dust motes in the lounge air
	const motes = dustMotes(new THREE.Box3(new V3(-1.6, 0.3, -1.0), new V3(3.4, 1.95, 1.0)), quality.motes, [[1.83, 1.45, 0.86], [0.9, 0.45, -0.6], [2.35, 1.3, -1.0]]);
	fx.add(motes);

	// chimney smoke
	const smoke = wisps({ count: 46, life: 9, rise: 3.2, spread: 0.06, drift: 0.7, size: 0.5, grow: 3.2, color: 0x9aa4b2, opacity: 0.13, wind: [1.6, 0.7] });
	smoke.position.set(0.9, OUT.roof + 0.7, -0.93);
	fx.add(smoke);

	// transparent effects and particles are excluded from the AO normal pass
	fx.traverse((o) => { o.layers.set(1); });
	for (const s of statics) if (s.material.transparent) s.layers.set(1);

	const pointScaled = [steam, ksteam, motes, smoke];

	focus('Panoramic window', 'Snow has been falling on the spruce since mid-afternoon.', [1.45, 0.82, -1.27, 3.25, 1.74, -1.1], [0, 0.05, 1], 1.3);
	focus('Skylight', 'Kept clear by the warmth rising from the stove. Watch the flakes land.', [1.9, 2.0, -0.45, 2.9, 2.3, 0.45], [0, -1, 0.2], 1.2);
	focus('Motorhome', 'A 9.7 m coach, parked in a clearing at Pine Hollow for the week.', [-4.7, -0.9, -1.3, 5.1, 2.6, 1.3], [0.7, 0.25, 1], 13, 'exterior');
	focus('Porch light', 'Left on so the path to the woodpile stays lit.', [2.9, 1.85, 1.25, 3.35, 2.15, 1.45], [0.3, -0.2, 1], 3.5, 'exterior');

	return {
		group, colliders, focusables, updaters, lights, pointScaled,
		bodyBox: new THREE.Box3(new V3(OUT.x0 - 0.05, GROUND_Y, -OUT.z - 0.1), new V3(5.2, OUT.roof + 0.25, OUT.z + 0.12)),
		interiorBox: new THREE.Box3(new V3(IN.x0, 0, -IN.z), new V3(4.85, IN.y1, IN.z)),
		snowBox: new THREE.Box3(new V3(OUT.x0 - 0.02, GROUND_Y - 1, -OUT.z - 0.02), new V3(5.12, OUT.roof + 0.05, OUT.z + 0.02)),
		porch: { pos: porch.position.clone(), target: porch.target.position.clone() },
	};
}
