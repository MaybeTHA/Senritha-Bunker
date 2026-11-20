// Snow-laden pines (instanced, two levels of detail, grouped in cells for culling), scattered
// boulders with snow caps, and hanging icicles.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { patch, tex } from './shading.js';
import { mulberry32, makeNoise, smoothstep } from './noise.js';
import { FINE } from './world.js';

const N = makeNoise(4242);

// ---------------------------------------------------------------- pine geometry
function pineGeometry(seed, lod) {
	const rnd = mulberry32(seed);
	const H = 1; // unit height, scaled per instance
	const parts = [];
	const green = new THREE.Color(0.035, 0.075, 0.05), green2 = new THREE.Color(0.06, 0.1, 0.06);
	const snow = new THREE.Color(0.88, 0.92, 0.97), bark = new THREE.Color(0.13, 0.09, 0.07);
	const color = (g, fn) => {
		const p = g.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
		for (let i = 0; i < p.count; i++) { fn(p.getX(i), p.getY(i), p.getZ(i), col, i); c.set([col.r, col.g, col.b], i * 3); }
		g.setAttribute('color', new THREE.BufferAttribute(c, 3));
		return g;
	};
	const trunk = new THREE.CylinderGeometry(0.008, 0.022, H * 0.95, lod ? 5 : 7, 1, true);
	trunk.translate(0, H * 0.475, 0);
	parts.push(color(trunk, (x, y, z, c) => c.copy(bark)));
	const whorls = lod ? 4 : 9;
	const segs = lod ? 6 : 15;
	for (let k = 0; k < whorls; k++) {
		const f = k / whorls;
		const r = 0.24 * Math.pow(1 - f, 0.95) + 0.035;
		const hl = (lod ? 0.36 : 0.22) * (1 - f * 0.45);
		const y = H * (0.14 + 0.82 * f);
		const g = new THREE.ConeGeometry(r, hl, segs, lod ? 1 : 3, true);
		const p = g.attributes.position;
		const jit = 0.38;
		for (let i = 0; i < p.count; i++) {
			const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
			const v = 0.5 - py / hl; // 0 tip .. 1 rim
			const a = Math.atan2(pz, px);
			const rr = 1 + (Math.sin(a * 3 + seed + k) * 0.4 + (rnd() - 0.5) + ((i % 2) ? 0.35 : -0.2)) * jit * v;
			// droop at the rim
			p.setXYZ(i, px * rr, py - v * v * hl * 0.25, pz * rr);
		}
		g.translate(0, y + hl * 0.4, 0);
		g.rotateY(rnd() * Math.PI);
		g.computeVertexNormals();
		color(g, (x, yy, z, c) => {
			const v = 1 - (yy - y + hl * 0.1) / hl; // rough height along the whorl
			const n = N.n2(x * 40 + seed, z * 40 + k) * 0.25;
			const s = 1 - smoothstep(0.55, 1.0, v + n);
			c.copy(green).lerp(green2, Math.random() * 0.5).lerp(snow, Math.max(0, Math.min(1, s * 0.97)));
		});
		parts.push(g);
		if (!lod) {
			// a snow-free underside skirt so the tree reads dark from below
			const u = new THREE.ConeGeometry(r * 0.96, hl * 0.35, segs, 1, true);
			u.rotateX(Math.PI);
			u.translate(0, y - hl * 0.05, 0);
			parts.push(color(u, (x, yy, z, c) => c.copy(green).multiplyScalar(0.6)));
		}
	}
	const g = mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p; }));
	g.computeBoundingSphere();
	return g;
}

// ---------------------------------------------------------------- trees
export class Forest {
	constructor(hf, q, camp) {
		this.group = new THREE.Group();
		this.cells = [];
		this.colliders = [];
		const near = [pineGeometry(11, 0), pineGeometry(23, 0), pineGeometry(37, 0)];
		const far = [pineGeometry(11, 1), pineGeometry(23, 1), pineGeometry(37, 1)];
		this.matNear = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }), { sway: 1 });
		this.matFar = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }), { sway: 0 });
		const rnd = mulberry32(777);
		const CELL = 256;
		const cells = new Map();
		const n = { x: 0, y: 1, z: 0 };
		const push = (x, z, s, y) => {
			const key = Math.floor(x / CELL) + ',' + Math.floor(z / CELL);
			if (!cells.has(key)) cells.set(key, [[], [], []]);
			const v = (rnd() * 3) | 0;
			let low = y;
			const tr = s * 0.04;
			for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; low = Math.min(low, hf.height(x + Math.cos(a) * tr, z + Math.sin(a) * tr)); }
			cells.get(key)[v].push([x, low - 0.15, z, s, rnd() * Math.PI * 2]);
			this.colliders.push({ x, z, r: 0.2 + s * 0.018 });
		};
		let count = 0;
		const spacing = q.treeSpacing;
		let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
		for (const p of hf.route) { bx0 = Math.min(bx0, p.x); bx1 = Math.max(bx1, p.x); bz0 = Math.min(bz0, p.z); bz1 = Math.max(bz1, p.z); }
		const R = FINE;
		for (let gz = R.z0 + 60; gz < R.z0 + R.size - 60 && count < q.trees; gz += spacing) {
			for (let gx = R.x0 + 60; gx < R.x0 + R.size - 60 && count < q.trees; gx += spacing) {
				const x = gx + (rnd() - 0.5) * spacing * 0.9, z = gz + (rnd() - 0.5) * spacing * 0.9;
				const y = hf.height(x, z);
				if (y > 140 || y < -1080) continue;
				hf.normal(x, z, n);
				if (n.y < 0.8) continue;
				if (Math.hypot(x - camp.x, z - camp.z) < 46) continue;
				if (x > bx0 - 8 && x < bx1 + 8 && z > bz0 - 8 && z < bz1 + 8 && hf.nearestRoute(x, z).d < 6) continue;
				const elev = smoothstep(130, -120, y);
				const clump = smoothstep(-0.25, 0.35, N.fbm(x / 260, z / 260, 3));
				const p = elev * (0.25 + 0.75 * clump) * smoothstep(0.8, 0.92, n.y);
				if (rnd() > p) continue;
				const s = (7 + rnd() * 9) * (0.55 + 0.45 * elev);
				push(x, z, s, y);
				count++;
			}
		}
		// a sheltering grove just below the camp shelf
		for (let i = 0; i < 70; i++) {
			const a = rnd() * Math.PI * 2, d = 48 + rnd() * 90;
			const x = camp.x + Math.cos(a) * d, z = camp.z + Math.sin(a) * d;
			const y = hf.height(x, z);
			hf.normal(x, z, n);
			if (n.y < 0.78 || hf.nearestRoute(x, z).d < 6) continue;
			const s = 4 + rnd() * 6;
			push(x, z, s, y);
		}
		this.count = count;
		const m = new THREE.Matrix4(), qn = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
		for (const [key, lists] of cells) {
			const [cx, cz] = key.split(',').map(Number);
			const cell = { x: (cx + 0.5) * CELL, z: (cz + 0.5) * CELL, near: [], far: [] };
			lists.forEach((list, v) => {
				if (!list.length) return;
				const mk = (geo, mat) => {
					const im = new THREE.InstancedMesh(geo, mat, list.length);
					list.forEach(([x, y, z, s, r], i) => {
						qn.setFromAxisAngle(up, r);
						sc.set(s * (0.85 + (i % 5) * 0.06), s, s * (0.85 + (i % 3) * 0.08));
						ps.set(x, y, z);
						im.setMatrixAt(i, m.compose(ps, qn, sc));
					});
					im.instanceMatrix.needsUpdate = true;
					im.computeBoundingSphere();
					im.castShadow = true; im.receiveShadow = true;
					this.group.add(im);
					return im;
				};
				cell.near.push(mk(near[v], this.matNear));
				const f = mk(far[v], this.matFar); f.castShadow = false; cell.far.push(f);
			});
			this.cells.push(cell);
		}
		this.cell = CELL;
	}
	update(cam) {
		for (const c of this.cells) {
			const d = Math.hypot(c.x - cam.x, c.z - cam.z);
			const nearOn = d < this.cell * 1.15;
			c.near.forEach((m) => { m.visible = nearOn; });
			c.far.forEach((m) => { m.visible = !nearOn && d < 9000; });
		}
	}
}

// ---------------------------------------------------------------- rocks
function boulderGeometry(seed) {
	const g = new THREE.IcosahedronGeometry(1, 4);
	const p = g.attributes.position, v = new THREE.Vector3();
	const n = makeNoise(seed);
	for (let i = 0; i < p.count; i++) {
		v.fromBufferAttribute(p, i);
		const d = 1 + 0.32 * n.fbm(v.x * 1.3 + seed, v.y * 1.3 + v.z * 0.7, 4) + 0.12 * n.ridged(v.x * 3 + v.z, v.y * 3, 3);
		v.multiplyScalar(d);
		// flatter bottoms, angular facets
		v.y = v.y < 0 ? v.y * 0.55 : v.y * 0.85;
		v.x = Math.round(v.x * 9) / 9 * 0.3 + v.x * 0.7;
		p.setXYZ(i, v.x, v.y, v.z);
	}
	g.computeVertexNormals();
	return g;
}

export class Rocks {
	constructor(hf, q, camp, opts = {}) {
		const extra = opts.extra || [];
		this.group = new THREE.Group();
		this.colliders = [];
		const mat = patch(new THREE.MeshStandardMaterial({
			map: tex('rock_diff', 1.2), normalMap: tex('rock_nor', 1.2), roughnessMap: tex('rock_rough', 1.2),
			color: new THREE.Color(0.4, 0.42, 0.47), roughness: 1, normalScale: new THREE.Vector2(1.2, 1.2),
		}), { snow: 0.62 });
		const geos = [boulderGeometry(3), boulderGeometry(8), boulderGeometry(15), boulderGeometry(29)];
		const lists = [[], [], [], []];
		const rnd = mulberry32(31337);
		const n = { x: 0, y: 1, z: 0 };
		const keepOut = opts.keepOut || (() => false);
		const add = (x, z, s, sink = 0.35) => {
			if (keepOut(x, z, s * 1.2) || Math.hypot(x - hf.summit.x, z - hf.summit.z) < 14) return;
			if (x > bx0 - 12 && x < bx1 + 12 && z > bz0 - 12 && z < bz1 + 12 && hf.nearestRoute(x, z).d < 2.3 + s * 1.15 + 0.6) return;
			const y = hf.height(x, z);
			// the lowest ground under the rock: on a slope it must not hang over the downhill side
			let low = y;
			for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; low = Math.min(low, hf.height(x + Math.cos(a) * s * 1.25, z + Math.sin(a) * s * 1.25)); }
			const v = (rnd() * 4) | 0;
			const cy = Math.min(y - s * sink, low + s * 0.22);
			lists[v].push([x, cy, z, s, rnd() * 6.28, rnd() * 0.4]);
			if (s > 0.45) this.colliders.push({ x, z, r: s * 0.8, top: cy + s * 0.75 });
		};
		let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
		for (const p of hf.route) { bx0 = Math.min(bx0, p.x); bx1 = Math.max(bx1, p.x); bz0 = Math.min(bz0, p.z); bz1 = Math.max(bz1, p.z); }
		const R = hf.route;
		// boulders along the route
		for (let i = 8; i < R.length; i += 7) {
			if (rnd() > 0.55) continue;
			const a = R[Math.min(R.length - 1, i + 1)], b = R[i];
			const tx = a.x - b.x, tz = a.z - b.z, l = Math.hypot(tx, tz) || 1;
			const side = rnd() < 0.5 ? -1 : 1;
			const sz = 0.35 + rnd() * rnd() * 2.2;
			const off = 2.3 + sz * 1.15 + 0.8 + rnd() * 4;
			add(b.x - (tz / l) * off * side, b.z + (tx / l) * off * side, sz, 0.35);
		}
		// scattered over the massif
		let k = 0;
		while (k < q.rocks) {
			const x = -1500 + rnd() * 3000, z = -1500 + rnd() * 3000;
			hf.normal(x, z, n);
			if (n.y < 0.72 || n.y > 0.97) continue;
			if (hf.pathMask(x, z) > 0.01 || Math.hypot(x - camp.x, z - camp.z) < 40) continue;
			const s = 0.8 + rnd() * rnd() * 7;
			add(x, z, s, 0.4);
			k++;
		}
		// around the camp
		for (let i = 0; i < 26; i++) {
			const a = rnd() * Math.PI * 2, d = 30 + rnd() * 22;
			const x = camp.x + Math.cos(a) * d, z = camp.z + Math.sin(a) * d;
			if (hf.nearestRoute(x, z).d < 4) continue;
			add(x, z, 0.5 + rnd() * 2.2, 0.35);
		}
		for (const e of extra) add(e.x, e.z, e.s, e.sink ?? 0.35);
		const m = new THREE.Matrix4(), qn = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
		this.icicleSpots = [];
		lists.forEach((list, v) => {
			const im = new THREE.InstancedMesh(geos[v], mat, list.length);
			list.forEach(([x, y, z, s, r, tilt], i) => {
				e.set(tilt * 0.4, r, tilt * 0.3);
				qn.setFromEuler(e);
				sc.set(s * (1 + (i % 3) * 0.15), s * (0.7 + (i % 4) * 0.12), s);
				ps.set(x, y, z);
				im.setMatrixAt(i, m.compose(ps, qn, sc));
				if (s > 1.6 && s < 4 && i % 3 === 0) this.icicleSpots.push({ x, y: y + s * 0.15, z, s, r });
			});
			im.instanceMatrix.needsUpdate = true;
			im.computeBoundingSphere();
			im.castShadow = true; im.receiveShadow = true;
			this.group.add(im);
		});
	}
}

// ---------------------------------------------------------------- icicles
export function icicles(spots) {
	const g = new THREE.ConeGeometry(0.035, 1, 6, 3);
	g.rotateX(Math.PI);
	g.translate(0, -0.5, 0);
	const p = g.attributes.position;
	for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 + Math.sin(y * 30) * 0.25)); p.setZ(i, p.getZ(i) * (1 + Math.cos(y * 27) * 0.25)); }
	g.computeVertexNormals();
	const mat = patch(new THREE.MeshPhysicalMaterial({ color: 0xd8ecff, roughness: 0.08, metalness: 0, transmission: 0, transparent: true, opacity: 0.82, clearcoat: 1, envMapIntensity: 1.6 }), {});
	const im = new THREE.InstancedMesh(g, mat, spots.length);
	const m = new THREE.Matrix4(), s = new THREE.Vector3(), q = new THREE.Quaternion(), pos = new THREE.Vector3();
	spots.forEach((sp, i) => {
		s.set(1 + (i % 3) * 0.2, sp.len, 1 + (i % 2) * 0.3);
		pos.set(sp.x, sp.y, sp.z);
		im.setMatrixAt(i, m.compose(pos, q, s));
	});
	im.instanceMatrix.needsUpdate = true;
	im.computeBoundingSphere();
	im.castShadow = false;
	return im;
}
