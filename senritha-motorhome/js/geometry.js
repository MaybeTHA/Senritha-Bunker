// Geometry helpers: soft upholstered boxes, lathe/tube shortcuts, parametric surfaces and a static batcher.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeNoise } from './noise.js';

const V3 = THREE.Vector3;
const N = makeNoise(77);

export function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
	const m = new THREE.Matrix4();
	m.compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new V3(sx, sy, sz));
	return m;
}

// Average normals of vertices that share a position, so separately built faces shade smoothly.
export function smoothSeams(geo, q = 1e4) {
	const pos = geo.attributes.position, nor = geo.attributes.normal;
	const map = new Map();
	for (let i = 0; i < pos.count; i++) {
		const k = `${Math.round(pos.getX(i) * q)},${Math.round(pos.getY(i) * q)},${Math.round(pos.getZ(i) * q)}`;
		let e = map.get(k);
		if (!e) { e = { n: new V3(), idx: [] }; map.set(k, e); }
		e.n.x += nor.getX(i); e.n.y += nor.getY(i); e.n.z += nor.getZ(i);
		e.idx.push(i);
	}
	for (const e of map.values()) {
		if (e.idx.length < 2) continue;
		e.n.normalize();
		for (const i of e.idx) nor.setXYZ(i, e.n.x, e.n.y, e.n.z);
	}
	nor.needsUpdate = true;
	return geo;
}

// Box with rounded edges and optional cushion puff, pinched corners and fabric wrinkles.
export function softBox(w, h, d, r = 0.02, o = {}) {
	const { seg = 3, density = 22, puff = 0, puffBottom = 0, puffSide = 0, pinch = 0, wrinkle = 0, wrinkleF = 9, sag = 0, grain = 'long' } = o;
	const a = [w / 2, h / 2, d / 2];
	r = Math.max(0, Math.min(r, a[0] * 0.999, a[1] * 0.999, a[2] * 0.999));
	const axisPts = (half) => {
		const inner = half - r;
		const nIn = Math.max(1, Math.min(48, Math.ceil(2 * inner * density)));
		const p = [];
		if (r > 0) for (let i = 0; i < seg; i++) p.push(-half + r * (i / seg));
		for (let i = 0; i <= nIn; i++) p.push(-inner + (2 * inner) * (i / nIn));
		if (r > 0) for (let i = 1; i <= seg; i++) p.push(inner + r * (i / seg));
		return p;
	};
	const P = [axisPts(a[0]), axisPts(a[1]), axisPts(a[2])];
	const pos = [], nor = [], uv = [], idx = [];
	const c = new V3(), p = new V3(), dir = new V3();
	for (let n = 0; n < 3; n++) {
		for (const s of [1, -1]) {
			const i = (n + 1) % 3, j = (n + 2) % 3;
			const pi = P[i], pj = P[j];
			const base = pos.length / 3;
			const swap = grain === 'h' && n !== 1 ? (i === 1) : (a[i] < a[j]);
			for (let jj = 0; jj < pj.length; jj++) {
				for (let ii = 0; ii < pi.length; ii++) {
					const q = [0, 0, 0];
					q[n] = s * a[n]; q[i] = pi[ii]; q[j] = pj[jj];
					p.set(q[0], q[1], q[2]);
					c.set(
						Math.max(-(a[0] - r), Math.min(a[0] - r, p.x)),
						Math.max(-(a[1] - r), Math.min(a[1] - r, p.y)),
						Math.max(-(a[2] - r), Math.min(a[2] - r, p.z)));
					dir.subVectors(p, c);
					const len = dir.length();
					if (len > 1e-9) dir.multiplyScalar(1 / len); else { dir.set(0, 0, 0); dir.setComponent(n, s); }
					if (r > 0) p.copy(c).addScaledVector(dir, r);
					const fx = q[0] / a[0], fy = q[1] / a[1], fz = q[2] / a[2];
					if (puff || puffBottom) {
						const b = Math.max(0, (1 - fx * fx) * (1 - fz * fz));
						if (dir.y > 0.2) p.y += b * puff * dir.y;
						else if (dir.y < -0.2) p.y -= b * puffBottom * -dir.y;
					}
					if (puffSide) {
						const bx = Math.max(0, (1 - fy * fy) * (1 - fz * fz)), bz = Math.max(0, (1 - fy * fy) * (1 - fx * fx));
						p.x += dir.x * bx * puffSide; p.z += dir.z * bz * puffSide;
					}
					if (pinch) {
						const k = Math.pow(Math.abs(fx), 2.5) * Math.pow(Math.abs(fz), 2.5);
						p.y *= 1 - pinch * k;
						p.x *= 1 - pinch * 0.08 * (1 - fz * fz);
						p.z *= 1 - pinch * 0.08 * (1 - fx * fx);
					}
					if (sag) p.y -= sag * Math.max(0, (1 - fx * fx)) * (p.y > 0 ? 1 : 0.3);
					if (wrinkle) {
						const wv = N.n2(p.x * wrinkleF + p.y * 3.1, p.z * wrinkleF - p.y * 2.3) * 0.7 + N.n2(p.x * wrinkleF * 2.3, p.z * wrinkleF * 2.3 + p.y * 5) * 0.3;
						p.addScaledVector(dir, wv * wrinkle);
					}
					pos.push(p.x, p.y, p.z);
					nor.push(dir.x, dir.y, dir.z);
					if (swap) uv.push(pj[jj], pi[ii]); else uv.push(pi[ii], pj[jj]);
				}
			}
			const row = pi.length;
			for (let jj = 0; jj < pj.length - 1; jj++) {
				for (let ii = 0; ii < pi.length - 1; ii++) {
					const A = base + jj * row + ii, B = A + 1, C = A + row + 1, D = A + row;
					if (s > 0) idx.push(A, B, C, A, C, D); else idx.push(A, C, B, A, D, C);
				}
			}
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.setIndex(idx);
	if (puff || puffBottom || puffSide || pinch || wrinkle || sag) {
		g.computeVertexNormals();
		smoothSeams(g);
	}
	return g;
}

export function planeM(w, h) {
	const g = new THREE.PlaneGeometry(w, h);
	const uv = g.attributes.uv;
	for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
	return g;
}

export const pillow = (w, h, d, o = {}) => softBox(w, h, d, h * 0.48, { density: 30, seg: 4, puff: h * 0.34, puffBottom: h * 0.34, pinch: 0.6, wrinkle: 0.003, ...o });

export function lathe(pts, segs = 48, phiStart = 0, phiLen = Math.PI * 2) {
	return new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), segs, phiStart, phiLen);
}

export function tube(pts, radius, segs = 64, radial = 12, closed = false) {
	const curve = new THREE.CatmullRomCurve3(pts.map((p) => new V3(p[0], p[1], p[2])), closed, 'centripetal');
	return new THREE.TubeGeometry(curve, segs, radius, radial, closed);
}

export function cyl(rt, rb, h, seg = 32, open = false) {
	return new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
}

// Parametric surface. fn(u, v, out:Vector3) with u,v in [0,1]. UVs scaled by su, sv.
export function surface(nu, nv, fn, su = 1, sv = 1) {
	const pos = [], uv = [], idx = [];
	const t = new V3();
	for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
		fn(i / nu, j / nv, t);
		pos.push(t.x, t.y, t.z); uv.push(i / nu * su, j / nv * sv);
	}
	for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
		const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 2, d = a + nu + 1;
		idx.push(a, b, c, a, c, d);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.setIndex(idx);
	g.computeVertexNormals();
	return g;
}

// Reverse triangle winding (and normals) so the other side becomes the front face.
export function flipWinding(g) {
	const ix = g.index.array;
	for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
	g.index.needsUpdate = true;
	g.computeVertexNormals();
	return g;
}

// Rounded rectangle path (for shapes and holes).
export function roundRect(shapeOrPath, x0, y0, x1, y1, r) {
	const s = shapeOrPath;
	s.moveTo(x0 + r, y0);
	s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r);
	s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1);
	s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r);
	s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
	return s;
}

// Collects static meshes per material and merges them into a handful of draw calls.
export class Batcher {
	constructor() {
		this.buckets = new Map();
		this.stack = [new THREE.Matrix4()];
	}
	push(m) { this.stack.push(this.stack[this.stack.length - 1].clone().multiply(m)); return this; }
	pop() { this.stack.pop(); return this; }
	add(geo, mat, m = null, opt = {}) {
		let g = geo.index ? geo.clone() : geo.clone();
		for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
		if (!g.attributes.normal) g.computeVertexNormals();
		if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
		if (!g.index) {
			const n = g.attributes.position.count; const ix = new Array(n);
			for (let i = 0; i < n; i++) ix[i] = i;
			g.setIndex(ix);
		}
		g.clearGroups();
		const mm = this.stack[this.stack.length - 1].clone();
		if (m) mm.multiply(m);
		g.applyMatrix4(mm);
		if (mm.determinant() < 0) {
			const ix = g.index.array;
			for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
		}
		const cast = opt.cast ?? true, receive = opt.receive ?? true;
		const key = `${mat.uuid}|${cast}|${receive}`;
		let b = this.buckets.get(key);
		if (!b) { b = { mat, cast, receive, geos: [] }; this.buckets.set(key, b); }
		b.geos.push(g);
		return this;
	}
	build(parent, name = 'batch') {
		const meshes = [];
		for (const b of this.buckets.values()) {
			const merged = mergeGeometries(b.geos, false);
			if (!merged) continue;
			merged.computeBoundingSphere(); merged.computeBoundingBox();
			const mesh = new THREE.Mesh(merged, b.mat);
			mesh.castShadow = b.cast; mesh.receiveShadow = b.receive;
			mesh.name = name;
			mesh.matrixAutoUpdate = false;
			parent.add(mesh); meshes.push(mesh);
			for (const g of b.geos) g.dispose();
		}
		this.buckets.clear();
		return meshes;
	}
}
