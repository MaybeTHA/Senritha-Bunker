// The rest camp: a small timber cabin with a glass gable that faces the summit, a deck, a
// stone fireplace and a cosy interior. Everything is built in cabin-local space (floor at
// y = 0, glass front toward +z) and placed on the camp shelf.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { patch, tex, U } from './shading.js';
import { Fire, Puffs } from './effects.js';
import { mulberry32 } from './noise.js';

export const CABIN = { W: 9.2, D: 6.6, EAVE: 2.75, PITCH: 0.66, T: 0.22, LIFT: 0.55 };

// planar UVs in metres so every surface has the same texel density
function uvMeters(g, scale = 1) {
	g = g.index ? g.toNonIndexed() : g;
	const p = g.attributes.position, n = g.attributes.normal;
	const uv = new Float32Array(p.count * 2);
	for (let i = 0; i < p.count; i++) {
		const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
		let u, v;
		if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); } else if (ay >= az) { u = p.getX(i); v = p.getZ(i); } else { u = p.getX(i); v = p.getY(i); }
		uv[i * 2] = u / scale; uv[i * 2 + 1] = v / scale;
	}
	g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
	return g;
}

// bulge the top and bottom of a box-like geometry so it reads as a soft cushion
function puff(g, w, d, amt) {
	const p = g.attributes.position;
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i) / (w / 2), z = p.getZ(i) / (d / 2), y = p.getY(i);
		const k = Math.max(0, 1 - x * x) * Math.max(0, 1 - z * z);
		p.setY(i, y + Math.sign(y) * k * amt);
	}
	g.computeVertexNormals();
	return g;
}

function wrinkle(g, amt, seed = 1) {
	const p = g.attributes.position;
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
		const w = Math.sin(x * 9 + seed) * Math.sin(z * 7 + seed * 2) * 0.5 + Math.sin(x * 23 + z * 17 + seed) * 0.25;
		if (y > 0) p.setY(i, y + w * amt);
	}
	g.computeVertexNormals();
	return g;
}

export class Cabin {
	constructor(hf, q) {
		this.q = q;
		this.group = new THREE.Group();
		this.inner = new THREE.Group();
		this.group.add(this.inner);
		this.colliders = [];     // oriented boxes in world space
		this.floors = [];        // walkable tops
		this.interact = [];
		this.lights = [];
		this.glows = [];
		const camp = hf.camp;
		const toSummit = Math.atan2(hf.summit.x - camp.x, hf.summit.z - camp.z);
		this.yaw = toSummit;
		this.base = new THREE.Vector3(camp.x, camp.y + CABIN.LIFT, camp.z);
		this.group.position.copy(this.base);
		this.group.rotation.y = this.yaw;
		this.group.updateMatrixWorld(true);
		this.inv = new THREE.Matrix4().copy(this.group.matrixWorld).invert();
		U.uCabinInv.value.copy(this.inv);
		this.rnd = mulberry32(99);
		this.materials();
		this.shell();
		this.roof();
		this.deck();
		this.fireplace();
		this.bedroom();
		this.living();
		this.entry();
		this.lighting();
		this.outside(hf);
		this.group.traverse((o) => { if (o.isMesh && o.userData.shadow !== false) { o.castShadow = o.castShadow || o.userData.cast !== false; o.receiveShadow = true; } });
	}

	// ------------------------------------------------------------ materials
	materials() {
		const std = (o, p = {}) => patch(new THREE.MeshStandardMaterial(o), p);
		const phys = (o, p = {}) => patch(new THREE.MeshPhysicalMaterial(o), p);
		const INT = 0.32; // interiors see little of the open sky
		this.M = {
			ext: std({ map: tex('extwood_diff', 0.5), normalMap: tex('extwood_nor', 0.5), roughnessMap: tex('extwood_arm', 0.5), aoMap: tex('extwood_arm', 0.5), color: 0x8a7464, roughness: 1 }),
			trim: std({ map: tex('extwood_diff', 0.8), normalMap: tex('extwood_nor', 0.8), color: 0x4a3426, roughness: 0.85 }, { snow: 0.6 }),
			pine: std({ map: tex('pine_diff', 0.45), normalMap: tex('pine_nor', 0.45), roughnessMap: tex('pine_arm', 0.45), color: 0xe6c9a6, roughness: 1, envMapIntensity: INT }),
			beam: std({ map: tex('pine_diff', 0.6), normalMap: tex('pine_nor', 0.6), color: 0x7a4e2c, roughness: 0.75, envMapIntensity: INT }),
			floor: std({ map: tex('floor_diff', 0.5), normalMap: tex('floor_nor', 0.5), roughnessMap: tex('floor_arm', 0.5), color: 0xd3b597, roughness: 1, envMapIntensity: INT }),
			deck: std({ map: tex('floor_diff', 0.6), normalMap: tex('floor_nor', 0.6), color: 0x9b836c, roughness: 0.9 }, { snow: 0.35 }),
			stone: std({ map: tex('stone_diff', 0.8), normalMap: tex('stone_nor', 0.8), roughnessMap: tex('stone_arm', 0.8), aoMap: tex('stone_arm', 0.8), color: 0xc8c2b8, roughness: 1, envMapIntensity: INT }),
			stoneOut: std({ map: tex('stone_diff', 0.8), normalMap: tex('stone_nor', 0.8), color: 0xa9a6a2, roughness: 1 }, { snow: 0.55 }),
			snow: std({ color: 0xf4f7fc, roughness: 0.8, normalMap: tex('snow_nor', 0.6), normalScale: new THREE.Vector2(0.7, 0.7) }),
			glass: std({ color: 0x9fb3c2, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.14, envMapIntensity: 1.6, depthWrite: false }),
			linen: phys({ color: 0xf3f0ea, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(1, 1, 1), sheenRoughness: 0.6, normalMap: tex('linen_nor', 0.5), normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: INT }),
			pillow: phys({ color: 0xece2cf, roughness: 0.95, sheen: 1, sheenColor: new THREE.Color(1, 0.96, 0.9), sheenRoughness: 0.5, normalMap: tex('linen_nor', 0.4), normalScale: new THREE.Vector2(0.4, 0.4), envMapIntensity: INT }),
			plaid: phys({ map: tex('plaid_diff', 0.55), normalMap: tex('plaid_nor', 0.55), roughness: 1, sheen: 1, sheenColor: new THREE.Color(0.9, 0.85, 0.8), sheenRoughness: 0.4, envMapIntensity: INT }),
			knit: phys({ map: tex('knit_diff', 0.35), normalMap: tex('knit_nor', 0.35), color: 0xd9ccbb, roughness: 1, sheen: 1, sheenColor: new THREE.Color(1, 0.95, 0.88), sheenRoughness: 0.5, envMapIntensity: INT }),
			teddy: phys({ map: tex('teddy_diff', 0.4), normalMap: tex('teddy_nor', 0.4), color: 0xffffff, roughness: 1, sheen: 1, sheenColor: new THREE.Color(1, 0.97, 0.9), sheenRoughness: 0.35, envMapIntensity: INT }),
			rug: phys({ map: tex('teddy_diff', 0.8), normalMap: tex('teddy_nor', 0.8), color: 0xd8c7ad, roughness: 1, sheen: 1, sheenColor: new THREE.Color(1, 0.95, 0.85), envMapIntensity: INT }),
			walnut: std({ map: tex('pine_diff', 0.9), normalMap: tex('pine_nor', 0.9), color: 0x6b4128, roughness: 0.55, envMapIntensity: INT }),
			iron: std({ color: 0x1f1d1c, roughness: 0.6, metalness: 0.7, envMapIntensity: INT }),
			brass: std({ color: 0xc9a46a, roughness: 0.3, metalness: 1, envMapIntensity: 0.6 }),
			ceramic: phys({ color: 0xece6dc, roughness: 0.25, clearcoat: 0.8, envMapIntensity: INT }),
			coffee: std({ color: 0x2a160b, roughness: 0.15, envMapIntensity: 0.6 }),
			bark: std({ map: tex('bark_diff', 1), normalMap: tex('bark_nor', 1), color: 0xa08a78, roughness: 1, envMapIntensity: INT }),
			leaf: std({ color: 0x2f5a2c, roughness: 0.6, side: THREE.DoubleSide, envMapIntensity: INT }),
			pot: std({ color: 0xb06a48, roughness: 0.8, envMapIntensity: INT }),
			soot: std({ color: 0x0c0a09, roughness: 1, envMapIntensity: 0.1 }),
			jacketR: phys({ color: 0x8e1c1c, roughness: 0.7, sheen: 0.6, sheenColor: new THREE.Color(1, 0.6, 0.6), envMapIntensity: INT }),
			jacketB: phys({ color: 0x24394f, roughness: 0.7, sheen: 0.6, sheenColor: new THREE.Color(0.7, 0.8, 1), envMapIntensity: INT }),
			leather: std({ color: 0x5a3a22, roughness: 0.6, envMapIntensity: INT }),
			pack: phys({ color: 0x3d4a35, roughness: 0.8, sheen: 0.4, sheenColor: new THREE.Color(0.8, 0.9, 0.7), envMapIntensity: INT }),
			lampshade: std({ color: 0xf6e3c3, roughness: 0.9, emissive: new THREE.Color(1.0, 0.72, 0.42), emissiveIntensity: 0, side: THREE.DoubleSide, envMapIntensity: INT }),
			bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.78, 0.5) }),
			lampInner: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.7, 0.4), side: THREE.BackSide }),
			lanternGlass: std({ color: 0xffd7a0, emissive: new THREE.Color(1.0, 0.62, 0.28), emissiveIntensity: 0, roughness: 0.2, transparent: true, opacity: 0.9 }),
			bookA: std({ color: 0x7a2a22, roughness: 0.8, envMapIntensity: INT }),
		};
		// frost creeping in from the window frames
		this.frost = { value: 0.4 };
		const g = this.M.glass;
		const prev = g.onBeforeCompile;
		g.onBeforeCompile = (sh, r) => {
			prev(sh, r);
			sh.uniforms.uFrost = this.frost;
			sh.fragmentShader = sh.fragmentShader
				.replace('#include <common>', '#include <common>\nuniform float uFrost;\nvarying vec2 vUvF;')
				.replace('#include <map_fragment>', `#include <map_fragment>
					{
						vec2 e = min(vUvF, 1.0 - vUvF);
						float edge = min(e.x, e.y * 0.8);
						float fr = tfbm(vUvF * 2.3 + vWorldPosS.xz * 0.05);
						float frost = smoothstep(0.14 * uFrost + 0.02, 0.0, edge - (fr - 0.5) * 0.09) * uFrost;
						diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.95, 1.0), frost);
						diffuseColor.a = mix(diffuseColor.a, 0.75, frost);
					}`);
			sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vUvF;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvUvF = uv;');
		};
	}

	add(geo, mat, x = 0, y = 0, z = 0, parent = this.inner) {
		const m = new THREE.Mesh(geo, mat);
		m.position.set(x, y, z);
		parent.add(m);
		return m;
	}
	box(w, h, d, mat, x, y, z, uvScale = 1, parent) {
		return this.add(uvMeters(new THREE.BoxGeometry(w, h, d), uvScale), mat, x, y, z, parent);
	}
	rbox(w, h, d, r, mat, x, y, z, seg = 3) {
		return this.add(new RoundedBoxGeometry(w, h, d, seg, r), mat, x, y, z);
	}
	// collider in cabin-local coordinates
	solid(cx, cz, hx, hz, y0, y1, opts = {}) {
		const c = { lx: cx, lz: cz, hx, hz, y0: this.base.y + y0, y1: this.base.y + y1, ...opts };
		const w = new THREE.Vector3(cx, 0, cz).applyMatrix4(this.group.matrixWorld);
		c.x = w.x; c.z = w.z; c.rot = this.yaw;
		this.colliders.push(c);
		return c;
	}
	walk(cx, cz, hx, hz, top) {
		const w = new THREE.Vector3(cx, 0, cz).applyMatrix4(this.group.matrixWorld);
		this.floors.push({ x: w.x, z: w.z, hx, hz, rot: this.yaw, top: this.base.y + top, lx: cx, lz: cz });
	}
	toWorld(x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(this.group.matrixWorld); }

	// ------------------------------------------------------------ walls, floor, windows
	shell() {
		const { W, D, EAVE, T } = CABIN;
		const M = this.M;
		const hw = W / 2, hd = D / 2;
		// floor and stone foundation
		this.box(W, 0.12, D, M.floor, 0, -0.06, 0, 1);
		this.box(W + 0.3, CABIN.LIFT + 1.2, D + 0.3, M.stoneOut, 0, -0.12 - (CABIN.LIFT + 1.2) / 2, 0, 1.2);
		this.walk(0, 0, hw, hd, 0);

		// a wall made of an exterior skin and an interior lining, with rectangular holes
		const wall = (axis, pos, len, holes, outward) => {
			// axis 'x': wall runs along x at z = pos; 'z': runs along z at x = pos
			const segs = [];
			let cursor = -len / 2;
			const sorted = [...holes].sort((a, b) => a.c - b.c);
			for (const h of sorted) {
				if (h.c - h.w / 2 > cursor) segs.push([cursor, h.c - h.w / 2, 0, EAVE]);
				if (h.y0 > 0) segs.push([h.c - h.w / 2, h.c + h.w / 2, 0, h.y0]);
				if (h.y1 < EAVE) segs.push([h.c - h.w / 2, h.c + h.w / 2, h.y1, EAVE]);
				cursor = h.c + h.w / 2;
			}
			if (cursor < len / 2) segs.push([cursor, len / 2, 0, EAVE]);
			for (const [a, b, y0, y1] of segs) {
				const l = b - a, c = (a + b) / 2, h = y1 - y0, yc = (y0 + y1) / 2;
				const extOff = outward * (T / 2 - 0.04), intOff = -outward * (T / 2 - 0.02);
				if (axis === 'x') {
					this.box(l, h, 0.08, M.ext, c, yc, pos + extOff, 1);
					this.box(l, h, 0.04, M.pine, c, yc, pos + intOff, 1);
					this.solid(c, pos, l / 2, T / 2, y0, y1);
				} else {
					this.box(0.08, h, l, M.ext, pos + extOff, yc, c, 1);
					this.box(0.04, h, l, M.pine, pos + intOff, yc, c, 1);
					this.solid(pos, c, T / 2, l / 2, y0, y1);
				}
			}
			// frames around the holes
			for (const h of holes) {
				const fw = 0.08, depth = T + 0.04;
				const parts = axis === 'x'
					? [[h.w + fw * 2, fw, depth, h.c, h.y1 + fw / 2, pos], [fw, h.y1 - h.y0, depth, h.c - h.w / 2 - fw / 2, (h.y0 + h.y1) / 2, pos], [fw, h.y1 - h.y0, depth, h.c + h.w / 2 + fw / 2, (h.y0 + h.y1) / 2, pos]]
					: [[depth, fw, h.w + fw * 2, pos, h.y1 + fw / 2, h.c], [depth, h.y1 - h.y0, fw, pos, (h.y0 + h.y1) / 2, h.c - h.w / 2 - fw / 2], [depth, h.y1 - h.y0, fw, pos, (h.y0 + h.y1) / 2, h.c + h.w / 2 + fw / 2]];
				if (h.y0 > 0) parts.push(axis === 'x' ? [h.w + fw * 2, 0.06, depth + 0.1, h.c, h.y0 - 0.03, pos] : [depth + 0.1, 0.06, h.w + fw * 2, pos, h.y0 - 0.03, h.c]);
				for (const [a, b, c, x, y, z] of parts) this.box(a, b, c, M.trim, x, y, z, 1);
				if (h.glass) {
					const g = axis === 'x' ? new THREE.PlaneGeometry(h.w, h.y1 - h.y0) : new THREE.PlaneGeometry(h.w, h.y1 - h.y0).rotateY(Math.PI / 2);
					const m = this.add(g, M.glass, axis === 'x' ? h.c : pos, (h.y0 + h.y1) / 2, axis === 'x' ? pos : h.c);
					m.userData.cast = false; m.renderOrder = 3;
					this.solid(axis === 'x' ? h.c : pos, axis === 'x' ? pos : h.c, axis === 'x' ? h.w / 2 : 0.05, axis === 'x' ? 0.05 : h.w / 2, h.y0, h.y1);
				}
			}
		};
		// back wall (z = -hd), solid
		wall('x', -hd, W, [], -1);
		// corner posts
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.28, EAVE, 0.28, M.trim, sx * (hw + 0.02), EAVE / 2, sz * (hd + 0.02), 1);
		// left wall (x = -hw): small window by the bed
		wall('z', -hw, D, [{ c: -1.9, w: 0.9, y0: 1.0, y1: 2.0, glass: true }], -1);
		// right wall (x = +hw): door at the back, window at the front
		this.door = { c: -1.75, w: 1.0, y0: 0, y1: 2.12 };
		wall('z', hw, D, [{ ...this.door }, { c: 1.35, w: 1.6, y0: 0.85, y1: 2.15, glass: true }], 1);

		// front: floor-to-ceiling glass between timber mullions
		const posts = [-hw, -2.3, 0, 2.3, hw];
		for (let i = 0; i < posts.length; i++) {
			const x = THREE.MathUtils.clamp(posts[i], -hw + 0.1, hw - 0.1);
			this.box(0.16, EAVE, 0.22, M.trim, x, EAVE / 2, hd, 1);
			this.solid(x, hd, 0.08, 0.11, 0, EAVE);
			if (i < posts.length - 1) {
				const a = THREE.MathUtils.clamp(posts[i], -hw + 0.1, hw - 0.1) + 0.08, b = THREE.MathUtils.clamp(posts[i + 1], -hw + 0.1, hw - 0.1) - 0.08;
				const g = this.add(new THREE.PlaneGeometry(b - a, EAVE - 0.2), M.glass, (a + b) / 2, EAVE / 2 + 0.03, hd);
				g.renderOrder = 3; g.userData.cast = false;
				this.solid((a + b) / 2, hd, (b - a) / 2, 0.05, 0, EAVE);
				this.box(b - a, 0.08, 0.2, M.trim, (a + b) / 2, 0.04, hd, 1);
			}
		}
		this.box(W, 0.16, 0.24, M.trim, 0, EAVE, hd, 1);

		// gables: back in timber, front in glass with a timber frame
		const rise = hw * CABIN.PITCH;
		const tri = (back) => {
			const s = new THREE.Shape();
			s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(0, rise); s.closePath();
			return new THREE.ShapeGeometry(s);
		};
		const bg = uvMeters(tri().translate(0, EAVE, 0), 1);
		const backExt = this.add(bg, M.ext, 0, 0, -hd - 0.07); backExt.material = M.ext; backExt.scale.z = 1;
		backExt.rotation.y = Math.PI;
		this.add(uvMeters(tri().translate(0, EAVE, 0), 1), M.pine, 0, 0, -hd + 0.09);
		const fg = this.add(tri().translate(0, EAVE, 0), M.glass, 0, 0, hd);
		fg.renderOrder = 3; fg.userData.cast = false;
		// frame of the glass gable
		const gl = Math.hypot(hw, rise);
		for (const sgn of [-1, 1]) {
			const b = this.box(gl, 0.16, 0.22, M.trim, sgn * hw / 2, EAVE + rise / 2, hd, 1);
			b.rotation.z = -sgn * Math.atan2(rise, hw);
		}
		this.box(0.14, rise, 0.2, M.trim, 0, EAVE + rise / 2, hd, 1);
		this.box(W * 0.62, 0.12, 0.2, M.trim, 0, EAVE + rise * 0.42, hd, 1);
	}

	roof() {
		const { W, D, EAVE } = CABIN;
		const M = this.M;
		const hw = W / 2, hd = D / 2;
		const rise = hw * CABIN.PITCH;
		const ang = Math.atan2(rise, hw);
		const over = 0.65, gableOver = 0.85;
		const slope = Math.hypot(hw + over, (hw + over) * CABIN.PITCH);
		const len = D + gableOver * 2;
		for (const sgn of [-1, 1]) {
			const g = new THREE.Group();
			g.position.set(0, EAVE + rise + 0.12, 0);
			g.rotation.z = sgn * -ang;
			this.inner.add(g);
			// structural deck: dark outside edges, pine boards inside
			const deck = this.box(slope, 0.22, len, M.trim, sgn * slope / 2, 0, 0, 1, g);
			deck.userData.cast = true;
			this.box(slope - 0.1, 0.03, D - 0.1, M.pine, sgn * (slope / 2 + 0.05), -0.125, 0, 1, g);
			// thick snow load with rounded edges and a drift toward the eave
			const sg = new RoundedBoxGeometry(slope + 0.18, 0.5, len + 0.22, 4, 0.2);
			const p = sg.attributes.position;
			for (let i = 0; i < p.count; i++) {
				const x = p.getX(i) * sgn, z = p.getZ(i), y = p.getY(i);
				if (y > 0) p.setY(i, y + Math.sin(z * 1.3 + x * 0.7) * 0.05 + (x / slope) * 0.12);
			}
			sg.computeVertexNormals();
			const snow = this.add(sg, M.snow, sgn * slope / 2, 0.34, 0, g);
			snow.userData.cast = true;
		}
		// ridge, beams and rafters inside
		this.box(0.24, 0.3, len, M.beam, 0, EAVE + rise - 0.05, 0, 1);
		for (const z of [-2.2, 0, 2.2]) {
			this.box(W - 0.3, 0.22, 0.2, M.beam, 0, EAVE + 0.05, z, 1);
			for (const sgn of [-1, 1]) {
				const r = this.box(Math.hypot(hw, rise) - 0.2, 0.2, 0.16, M.beam, sgn * hw / 2, EAVE + rise / 2 - 0.08, z, 1);
				r.rotation.z = -sgn * ang;
			}
			this.box(0.14, rise - 0.25, 0.14, M.beam, 0, EAVE + (rise - 0.25) / 2 + 0.12, z, 1);
		}
		// chimney rising straight from the fireplace breast, through the left eave
		const cx = -W / 2 + 0.45, cz = 0.8;
		this.box(0.95, 2.7, 1.62, M.stoneOut, cx, 2.7 + 1.35, cz, 1).userData.cast = true;
		this.box(1.1, 0.12, 1.78, M.trim, cx, 5.46, cz, 1);
		this.smoke = new Puffs({ count: 34, origin: new THREE.Vector3(0, 0, 0), life: 9, rise: 1.0, spread: 0.5, size0: 0.6, size1: 4.0, color: 0xb9bcc4, opacity: 0.13, windK: 1.2 });
		this.smoke.mesh.position.copy(this.toWorld(cx, 5.6, cz));
		// icicles hanging from both eaves
		this.icicleSpots = [];
		for (const sgn of [-1, 1]) {
			for (let z = -len / 2 + 0.2; z < len / 2 - 0.1; z += 0.18 + this.rnd() * 0.25) {
				if (sgn > 0 && z > -1.75 - 1.1 && z < -1.75 + 1.9) continue;
				const ex = sgn * (hw + over - 0.05);
				const ey = EAVE + rise + 0.12 - (hw + over) * CABIN.PITCH - 0.12;
				this.icicleSpots.push({ local: new THREE.Vector3(ex, ey, z), len: 0.12 + Math.pow(this.rnd(), 2) * 0.75 });
			}
		}
	}

	deck() {
		const { W, D } = CABIN;
		const M = this.M;
		const hd = D / 2, DEPTH = 2.8;
		this.box(W + 1.2, 0.1, DEPTH, M.deck, 0, -0.05, hd + DEPTH / 2, 1);
		this.walk(0, hd + DEPTH / 2, (W + 1.2) / 2, DEPTH / 2, 0);
		// posts and railing with snow on the top rail
		const zf = hd + DEPTH - 0.06;
		const railX = [-(W + 1.2) / 2 + 0.06, (W + 1.2) / 2 - 0.06];
		for (let x = -(W + 1.2) / 2 + 0.06; x <= (W + 1.2) / 2; x += (W + 1.08) / 6) {
			this.box(0.1, 1.05, 0.1, M.trim, x, 0.52, zf, 1);
			this.box(0.14, CABIN.LIFT + 1.5, 0.14, M.trim, x, -0.75 - CABIN.LIFT / 2, zf, 1);
		}
		this.box(W + 1.2, 0.08, 0.12, M.trim, 0, 1.05, zf, 1);
		this.box(W + 1.2, 0.06, 0.06, M.trim, 0, 0.55, zf, 1);
		this.add(new RoundedBoxGeometry(W + 1.15, 0.07, 0.15, 2, 0.03), M.snow, 0, 1.12, zf);
		this.solid(0, zf, (W + 1.2) / 2, 0.08, 0, 1.1);
		for (const x of railX) {
			this.box(0.08, 0.08, DEPTH - 0.1, M.trim, x, 1.05, hd + DEPTH / 2, 1);
			this.add(new RoundedBoxGeometry(0.14, 0.07, DEPTH - 0.1, 2, 0.03), M.snow, x, 1.12, hd + DEPTH / 2);
			for (let z = hd + 0.3; z < hd + DEPTH; z += 0.9) this.box(0.08, 1.05, 0.08, M.trim, x, 0.52, z, 1);
		}
		this.solid(railX[0], hd + DEPTH / 2 + 0.2, 0.08, DEPTH / 2 - 0.2, 0, 1.1);
		// the right rail stops short to leave the steps open
		this.box(0.08, 0.08, 1.1, M.trim, railX[1], 1.05, hd + DEPTH - 0.55, 1);
		this.solid(railX[1], hd + DEPTH - 0.55, 0.08, 0.55, 0, 1.1);
		// a snowed-in bench on the deck
		this.box(1.6, 0.06, 0.42, M.trim, -2.6, 0.45, hd + 1.6, 1);
		this.box(0.06, 0.45, 0.4, M.trim, -3.35, 0.22, hd + 1.6, 1);
		this.box(0.06, 0.45, 0.4, M.trim, -1.85, 0.22, hd + 1.6, 1);
		this.add(new RoundedBoxGeometry(1.58, 0.12, 0.4, 2, 0.05), M.snow, -2.6, 0.53, hd + 1.6);
		this.solid(-2.6, hd + 1.6, 0.8, 0.22, 0, 0.55);
		// side entry: a small porch and steps at the door
		const dz = this.door.c;
		this.box(1.8, 0.1, 2.2, M.deck, W / 2 + 0.9, -0.05, dz + 0.4, 1);
		this.walk(W / 2 + 0.9, dz + 0.4, 0.9, 1.1, 0);
		for (let k = 1; k <= 3; k++) {
			const top = -k * (CABIN.LIFT / 3.2);
			this.box(0.4, 0.1, 1.4, M.deck, W / 2 + 1.8 + k * 0.38 - 0.18, top - 0.05, dz + 0.4, 1);
			this.walk(W / 2 + 1.8 + k * 0.38 - 0.18, dz + 0.4, 0.2, 0.7, top);
		}
		// porch roof
		const pr = this.box(2.2, 0.12, 2.6, M.trim, W / 2 + 0.95, 2.6, dz + 0.4, 1);
		pr.rotation.z = -0.25;
		this.add(new RoundedBoxGeometry(2.25, 0.25, 2.65, 3, 0.1), M.snow, W / 2 + 0.95, 2.78, dz + 0.4).rotation.z = -0.25;
		for (const z of [dz - 0.8, dz + 1.6]) this.box(0.12, 2.5, 0.12, M.trim, W / 2 + 1.75, 1.2, z, 1);
		this.solid(W / 2 + 1.75, dz - 0.8, 0.07, 0.07, 0, 2.5);
		this.solid(W / 2 + 1.75, dz + 1.6, 0.07, 0.07, 0, 2.5);
	}

	// ------------------------------------------------------------ fireplace
	fireplace() {
		const M = this.M;
		const x = -CABIN.W / 2 + 0.45, z = 0.8;
		const H = 3.3; // the chimney above takes over at the roof
		// chimney breast with a dark firebox opening
		this.box(0.7, 0.85, 1.7, M.stone, x, 0.425, z, 1);
		this.box(0.7, H - 1.65, 1.5, M.stone, x, 1.65 + (H - 1.65) / 2, z, 1);
		this.box(0.62, 0.8, 0.32, M.stone, x, 1.25, z - 0.69, 1);
		this.box(0.62, 0.8, 0.32, M.stone, x, 1.25, z + 0.69, 1);
		this.box(0.5, 0.75, 1.06, M.soot, x - 0.08, 1.23, z, 1);
		// hearth and mantel
		this.box(1.15, 0.12, 2.1, M.stone, x + 0.2, 0.06, z, 1);
		this.box(0.32, 0.14, 1.95, M.beam, x + 0.25, 1.72, z, 1);
		this.solid(x, z, 0.4, 0.9, 0, 3);
		this.solid(x + 0.25, z, 0.55, 1.05, 0, 0.13);
		// logs in the firebox
		for (let i = 0; i < 4; i++) {
			const l = this.add(new THREE.CylinderGeometry(0.07, 0.08, 0.62, 10), M.bark, x + 0.05 + (i % 2) * 0.08, 0.93 + Math.floor(i / 2) * 0.12, z + (i - 1.5) * 0.08);
			l.rotation.x = Math.PI / 2; l.rotation.z = (i - 1.5) * 0.25;
		}
		this.fire = new Fire();
		this.fire.group.position.set(x + 0.08, 0.92, z);
		this.inner.add(this.fire.group);
		// candles and a lantern on the mantel
		for (const dz of [-0.7, -0.55, 0.65]) {
			this.add(new THREE.CylinderGeometry(0.03, 0.03, 0.14 + (dz > 0 ? 0.06 : 0), 12), this.M.pillow, x + 0.25, 1.86, z + dz);
			const f = this.add(new THREE.SphereGeometry(0.012, 8, 6), M.bulb, x + 0.25, 1.95 + (dz > 0 ? 0.06 : 0), z + dz);
			f.scale.y = 2;
		}
		// log basket
		const basket = this.add(new THREE.CylinderGeometry(0.28, 0.22, 0.38, 18, 1, true), M.iron, x + 0.5, 0.19, z + 1.45);
		basket.material = M.iron;
		for (let i = 0; i < 6; i++) {
			const l = this.add(new THREE.CylinderGeometry(0.05, 0.055, 0.5, 9), M.bark, x + 0.42 + (i % 3) * 0.08, 0.3 + Math.floor(i / 3) * 0.09, z + 1.45 + ((i * 7) % 3 - 1) * 0.05);
			l.rotation.z = Math.PI / 2 + (i - 2) * 0.1;
		}
		this.solid(x + 0.5, z + 1.45, 0.3, 0.3, 0, 0.45);
		this.fireLight = new THREE.PointLight(0xff8c3a, 0, 9, 2);
		this.fireLight.position.set(x + 0.6, 1.0, z);
		if (this.q.fireShadow) {
			this.fireLight.castShadow = true;
			this.fireLight.shadow.mapSize.set(512, 512);
			this.fireLight.shadow.camera.near = 0.1; this.fireLight.shadow.camera.far = 9;
			this.fireLight.shadow.bias = -0.004; this.fireLight.shadow.radius = 4;
		}
		this.inner.add(this.fireLight);
		this.firePos = this.toWorld(x + 0.6, 1.0, z);
		this.interact.push({ id: 'fire', pos: this.toWorld(x + 0.7, 1.0, z), r: 2.2, label: 'stokeFire' });
		this.fireBoost = 0;
	}

	// ------------------------------------------------------------ bed
	bedroom() {
		const M = this.M;
		const bx = -2.0, bz = -CABIN.D / 2 + 0.22 + 1.08, BW = 1.75, BL = 2.12;
		// frame
		this.box(BW + 0.12, 0.26, BL + 0.08, M.walnut, bx, 0.25, bz, 1);
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.09, 0.14, 0.09, M.walnut, bx + sx * (BW / 2), 0.07, bz + sz * (BL / 2 - 0.02), 1);
		// headboard: slats in a frame
		const hz = bz - BL / 2 - 0.03;
		this.box(BW + 0.24, 0.1, 0.09, M.walnut, bx, 1.2, hz, 1);
		for (const sx of [-1, 1]) this.box(0.1, 1.2, 0.1, M.walnut, bx + sx * (BW / 2 + 0.07), 0.6, hz, 1);
		for (let i = 0; i < 9; i++) this.box(0.14, 0.72, 0.035, M.walnut, bx - BW / 2 + 0.12 + i * ((BW - 0.24) / 8), 0.78, hz, 1);
		// mattress, duvet, fold, pillows, throw
		this.rbox(BW, 0.24, BL - 0.04, 0.07, M.linen, bx, 0.5, bz);
		const duvet = wrinkle(puff(new RoundedBoxGeometry(BW + 0.16, 0.17, BL * 0.72, 5, 0.075), BW + 0.16, BL * 0.72, 0.035), 0.012, 3);
		this.add(duvet, M.linen, bx, 0.66, bz + BL * 0.14);
		const fold = new THREE.CapsuleGeometry(0.075, BW + 0.04, 6, 14);
		fold.rotateZ(Math.PI / 2);
		this.add(fold, M.linen, bx, 0.7, bz + BL * 0.14 - BL * 0.36 + 0.02);
		const pillow = (x, y, z, w, tilt, mat) => {
			const g = puff(new RoundedBoxGeometry(w, 0.13, 0.42, 4, 0.06), w, 0.42, 0.05);
			const m = this.add(g, mat, x, y, z);
			m.rotation.x = -tilt;
			return m;
		};
		pillow(bx - 0.42, 0.72, hz + 0.33, 0.7, 0.9, M.pillow);
		pillow(bx + 0.42, 0.72, hz + 0.33, 0.7, 0.85, M.pillow);
		pillow(bx - 0.4, 0.7, hz + 0.6, 0.62, 0.35, M.linen);
		pillow(bx + 0.4, 0.7, hz + 0.6, 0.62, 0.38, M.linen);
		const cushion = pillow(bx, 0.72, hz + 0.75, 0.42, 0.25, M.teddy); cushion.scale.set(1, 0.9, 0.8);
		const throwG = new THREE.PlaneGeometry(BW + 0.5, 0.75, 24, 12);
		const tp = throwG.attributes.position;
		for (let i = 0; i < tp.count; i++) {
			const x = tp.getX(i), y = tp.getY(i);
			const over = Math.max(0, Math.abs(x) - (BW / 2 + 0.06));
			tp.setXYZ(i, x - Math.sign(x) * over * 0.7, -over * 1.6 + Math.sin(y * 9 + x * 2) * 0.012, -y);
		}
		throwG.computeVertexNormals();
		const throwM = M.plaid.clone(); throwM.side = THREE.DoubleSide; patch(throwM, {});
		this.add(throwG, throwM, bx, 0.76, bz + BL / 2 - 0.42);
		this.solid(bx, bz, BW / 2 + 0.08, BL / 2 + 0.06, 0, 0.8);
		this.interact.push({ id: 'bed', pos: this.toWorld(bx, 0.7, bz), r: 2.0, label: 'rest' });
		this.bedView = { pos: this.toWorld(bx + 0.1, 1.05, hz + 0.62), look: this.toWorld(bx + 0.4, 1.35, CABIN.D / 2 + 6) };
		// nightstands with lamps
		for (const sx of [-1, 1]) {
			const nx = bx + sx * (BW / 2 + 0.42);
			this.box(0.5, 0.52, 0.42, M.walnut, nx, 0.26, hz + 0.27, 1);
			this.box(0.44, 0.02, 0.36, M.brass, nx, 0.36, hz + 0.27, 1).scale.y = 0.5;
			this.solid(nx, hz + 0.27, 0.25, 0.21, 0, 0.55);
			this.add(new THREE.CylinderGeometry(0.07, 0.09, 0.05, 20), M.brass, nx, 0.545, hz + 0.27);
			this.add(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), M.brass, nx, 0.72, hz + 0.27);
			const shade = this.add(new THREE.CylinderGeometry(0.11, 0.16, 0.2, 24, 1, true), M.lampshade, nx, 0.92, hz + 0.27);
			shade.userData.cast = false;
			this.glows.push(shade);
		}
		// a book and glasses on the left nightstand
		this.box(0.16, 0.035, 0.23, M.bookA, bx - BW / 2 - 0.36, 0.54, hz + 0.3, 1).rotation.y = 0.3;
		this.bedLamp = new THREE.PointLight(0xffb978, 0, 5.5, 2);
		this.bedLamp.position.copy(new THREE.Vector3(bx - BW / 2 - 0.42, 0.95, hz + 0.3));
		this.inner.add(this.bedLamp);
		// sheepskin by the bed
		const sk = new THREE.CircleGeometry(0.6, 32);
		sk.rotateX(-Math.PI / 2);
		const skp = sk.attributes.position;
		for (let i = 0; i < skp.count; i++) { const a = Math.atan2(skp.getZ(i), skp.getX(i)); const r = 1 + Math.sin(a * 5) * 0.12 + Math.sin(a * 11) * 0.05; skp.setX(i, skp.getX(i) * r * 1.3); skp.setZ(i, skp.getZ(i) * r * 0.9); }
		this.add(sk, M.teddy, bx + 1.25, 0.012, bz + 0.2);
	}

	// ------------------------------------------------------------ living area
	living() {
		const M = this.M;
		// rug
		this.rbox(2.9, 0.03, 2.1, 0.012, M.rug, 1.1, 0.016, 1.5, 2);
		// sofa facing the glass
		const sx = 1.4, sz = 0.35, SW = 2.2, SD = 0.95;
		this.rbox(SW, 0.28, SD, 0.06, M.knit, sx, 0.26, sz);
		for (const k of [-1, 1]) {
			const g = puff(new RoundedBoxGeometry(SW / 2 - 0.05, 0.16, SD - 0.2, 4, 0.07), SW / 2, SD - 0.2, 0.03);
			this.add(g, M.knit, sx + k * (SW / 4), 0.47, sz + 0.08);
			const b = puff(new RoundedBoxGeometry(SW / 2 - 0.08, 0.5, 0.2, 4, 0.08), SW / 2, 0.2, 0.0);
			const back = this.add(b, M.knit, sx + k * (SW / 4), 0.74, sz - SD / 2 + 0.14);
			back.rotation.x = -0.12;
		}
		this.rbox(SW + 0.1, 0.62, 0.18, 0.06, M.knit, sx, 0.52, sz - SD / 2 + 0.03);
		for (const k of [-1, 1]) this.rbox(0.18, 0.55, SD, 0.07, M.knit, sx + k * (SW / 2 + 0.02), 0.48, sz);
		const deco = (x, z, mat, rot) => { const p = this.add(puff(new RoundedBoxGeometry(0.46, 0.42, 0.14, 4, 0.06), 0.46, 0.14, 0), mat, x, 0.74, z); p.rotation.set(-0.2, rot, 0.08); return p; };
		deco(sx - 0.78, sz - 0.18, M.plaid, 0.2);
		deco(sx + 0.8, sz - 0.18, M.teddy, -0.15);
		// knitted blanket draped over the arm
		const bl = new THREE.PlaneGeometry(0.62, 1.0, 10, 18);
		const bp = bl.attributes.position;
		for (let i = 0; i < bp.count; i++) {
			const x = bp.getX(i), y = bp.getY(i) + 0.5;
			const ang = Math.min(y, 0.45) / 0.45 * Math.PI;
			const r = 0.16;
			const px = y < 0.45 ? -Math.cos(ang) * r : r + (y - 0.45) * 0.05;
			const py = y < 0.45 ? Math.sin(ang) * r : -(y - 0.45);
			bp.setXYZ(i, px + Math.sin(y * 13) * 0.01, py, x);
		}
		bl.computeVertexNormals();
		const blM = M.knit.clone(); blM.color = new THREE.Color(0xa9443a); blM.side = THREE.DoubleSide; patch(blM, {});
		this.add(bl, blM, sx + SW / 2 + 0.02, 0.62, sz + 0.05);
		this.solid(sx, sz, SW / 2 + 0.12, SD / 2, 0, 0.8);
		this.interact.push({ id: 'sofa', pos: this.toWorld(sx, 0.6, sz), r: 1.9, label: 'sit' });
		this.sofaView = { pos: this.toWorld(sx - 0.2, 1.12, sz + 0.05), look: this.toWorld(sx - 0.5, 1.5, CABIN.D / 2 + 8) };
		// coffee table with coffee, books and a lantern
		const tx = 1.25, tz = 1.75;
		this.rbox(1.15, 0.06, 0.62, 0.02, M.walnut, tx, 0.42, tz);
		for (const a of [-1, 1]) for (const b of [-1, 1]) this.box(0.05, 0.4, 0.05, M.walnut, tx + a * 0.5, 0.2, tz + b * 0.25, 1);
		this.box(1.0, 0.03, 0.5, M.walnut, tx, 0.12, tz, 1);
		this.solid(tx, tz, 0.58, 0.32, 0, 0.46);
		const mug = new THREE.Group();
		const cup = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.038, 0), new THREE.Vector2(0.042, 0.01), new THREE.Vector2(0.046, 0.09), new THREE.Vector2(0.041, 0.09), new THREE.Vector2(0.037, 0.012), new THREE.Vector2(0, 0.012)], 28);
		mug.add(new THREE.Mesh(cup, M.ceramic));
		const handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.008, 8, 16, Math.PI), M.ceramic);
		handle.position.set(0.046, 0.048, 0); handle.rotation.z = -Math.PI / 2;
		mug.add(handle);
		const surf = new THREE.Mesh(new THREE.CircleGeometry(0.04, 24), M.coffee); surf.rotation.x = -Math.PI / 2; surf.position.y = 0.078;
		mug.add(surf);
		mug.position.set(tx + 0.22, 0.45, tz + 0.06);
		this.inner.add(mug);
		this.steam = new Puffs({ count: 22, origin: new THREE.Vector3(0, 0, 0), life: 3.2, rise: 0.11, spread: 0.018, size0: 0.04, size1: 0.2, color: 0xffffff, opacity: 0.26, windK: 0 });
		this.steam.mesh.position.set(tx + 0.22, 0.54, tz + 0.06);
		this.inner.add(this.steam.mesh);
		this.interact.push({ id: 'coffee', pos: this.toWorld(tx + 0.22, 0.5, tz + 0.06), r: 1.3, label: 'coffee' });
		this.box(0.22, 0.04, 0.3, M.bookA, tx - 0.25, 0.47, tz - 0.02, 1).rotation.y = 0.2;
		this.box(0.2, 0.035, 0.27, M.jacketB, tx - 0.24, 0.505, tz - 0.03, 1).rotation.y = -0.1;
		this.lantern(tx - 0.42, 0.45, tz + 0.15, 0.6);
		// lounge chair angled between the fire and the view
		const ax = -2.55, az = 2.15;
		const chair = new THREE.Group();
		chair.position.set(ax, 0, az); chair.rotation.y = 0.75;
		this.inner.add(chair);
		const c = (g, m, x, y, z) => { const mm = new THREE.Mesh(g, m); mm.position.set(x, y, z); chair.add(mm); return mm; };
		c(new RoundedBoxGeometry(0.88, 0.3, 0.85, 4, 0.08), M.teddy, 0, 0.3, 0);
		c(puff(new RoundedBoxGeometry(0.7, 0.14, 0.7, 4, 0.06), 0.7, 0.7, 0.03), M.teddy, 0, 0.5, 0.04);
		c(new RoundedBoxGeometry(0.88, 0.72, 0.2, 4, 0.09), M.teddy, 0, 0.72, -0.36).rotation.x = -0.18;
		for (const k of [-1, 1]) c(new RoundedBoxGeometry(0.16, 0.55, 0.85, 4, 0.07), M.teddy, k * 0.42, 0.45, 0);
		for (const k of [-1, 1]) for (const m of [-1, 1]) c(new THREE.CylinderGeometry(0.02, 0.015, 0.16, 8), M.walnut, k * 0.36, 0.08, m * 0.34);
		c(puff(new RoundedBoxGeometry(0.4, 0.38, 0.13, 4, 0.06), 0.4, 0.13, 0), M.plaid, 0.05, 0.72, -0.22).rotation.x = -0.25;
		const cw = this.toWorld(ax, 0, az);
		this.colliders.push({ x: cw.x, z: cw.z, hx: 0.48, hz: 0.48, rot: this.yaw + 0.75, y0: this.base.y, y1: this.base.y + 0.9 });
		this.interact.push({ id: 'chair', pos: this.toWorld(ax, 0.6, az), r: 1.6, label: 'sit' });
		this.chairView = { pos: this.toWorld(ax + 0.05, 1.1, az - 0.05), look: this.toWorld(ax + 2.5, 1.2, az + 6) };
		// pendant lamps over the living area
		for (const [px, pz] of [[0.6, 1.4], [2.0, 1.4]]) {
			this.add(new THREE.CylinderGeometry(0.006, 0.006, 2.3, 4), M.iron, px, CABIN.EAVE + 1.1, pz);
			const sh = this.add(new THREE.SphereGeometry(0.17, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), M.brass, px, 2.08, pz);
			sh.userData.cast = false;
			const inner = this.add(new THREE.SphereGeometry(0.165, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), M.lampshade, px, 2.08, pz);
			inner.material = M.lampInner; inner.userData.cast = false;
			this.add(new THREE.SphereGeometry(0.045, 12, 8), M.bulb, px, 2.0, pz);
		}
		this.pendant = new THREE.PointLight(0xffc488, 0, 7.5, 2);
		this.pendant.position.set(1.3, 1.9, 1.4);
		this.inner.add(this.pendant);
		// a tall plant by the glass
		this.plant(3.85, 2.6, 1.0);
		this.plant(1.5, -CABIN.D / 2 + 0.27, 0.3, 2.04);
	}

	plant(x, z, s, y = 0) {
		const M = this.M;
		const potH = 0.32 * s + 0.1;
		this.add(new THREE.CylinderGeometry(0.17 * s + 0.05, 0.13 * s + 0.04, potH, 20), M.pot, x, y + potH / 2, z);
		const rnd = this.rnd;
		const leaves = [];
		for (let i = 0; i < 14 * s + 4; i++) {
			const g = new THREE.SphereGeometry(0.11 * s + 0.03, 8, 6);
			g.scale(0.45, 0.06, 1);
			g.translate(0, 0, 0.12 * s);
			const a = rnd() * Math.PI * 2, h = rnd();
			g.rotateX(-0.6 - h * 0.6);
			g.rotateY(a);
			g.translate(Math.cos(a) * 0.04, potH + 0.1 + h * 0.85 * s, Math.sin(a) * 0.04);
			leaves.push(g);
		}
		const m = this.add(mergeGeometries(leaves), M.leaf, x, y, z);
		m.userData.cast = true;
		this.solid(x, z, 0.22 * s + 0.05, 0.22 * s + 0.05, y, y + 1.2 * s);
	}

	lantern(x, y, z, s = 1, parent = this.inner, light = false) {
		const M = this.M;
		const g = new THREE.Group();
		g.position.set(x, y, z); g.scale.setScalar(s);
		parent.add(g);
		const frame = (geo, px, py, pz) => { const m = new THREE.Mesh(geo, M.iron); m.position.set(px, py, pz); g.add(m); };
		frame(new THREE.CylinderGeometry(0.11, 0.12, 0.04, 6), 0, 0.02, 0);
		frame(new THREE.ConeGeometry(0.13, 0.1, 6), 0, 0.34, 0);
		frame(new THREE.TorusGeometry(0.04, 0.008, 6, 12), 0, 0.42, 0);
		for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; frame(new THREE.BoxGeometry(0.012, 0.26, 0.012), Math.cos(a) * 0.1, 0.17, Math.sin(a) * 0.1); }
		const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.25, 6, 1, true), M.lanternGlass);
		glass.position.y = 0.17;
		g.add(glass);
		const flame = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), M.bulb);
		flame.position.y = 0.15; flame.scale.y = 1.8;
		g.add(flame);
		this.glows.push(glass);
		return g;
	}

	// ------------------------------------------------------------ entry: coats, boots, gear, shelves
	entry() {
		const M = this.M;
		const hw = CABIN.W / 2, hd = CABIN.D / 2;
		const dz = this.door.c;
		// the door: hinged on its back edge
		this.doorPivot = new THREE.Group();
		this.doorPivot.position.set(hw - 0.06, 0, dz - this.door.w / 2);
		this.inner.add(this.doorPivot);
		const leaf = this.box(0.07, 2.1, this.door.w - 0.02, M.ext, 0, 1.05, this.door.w / 2, 1, this.doorPivot);
		leaf.material = M.trim;
		for (const y of [0.5, 1.05, 1.6]) this.box(0.09, 0.08, this.door.w - 0.12, M.beam, -0.01, y, this.door.w / 2, 1, this.doorPivot);
		const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), M.brass);
		knob.position.set(-0.07, 1.02, this.door.w - 0.12);
		this.doorPivot.add(knob);
		const knob2 = knob.clone(); knob2.position.x = 0.07; this.doorPivot.add(knob2);
		this.doorAngle = 0; this.doorTarget = 0;
		this.doorCollider = this.solid(hw, dz, 0.06, this.door.w / 2, 0, 2.1, { door: true });
		this.doorOpenCollider = this.solid(hw, dz, 0.05, this.door.w / 2, 0, 2.1, { disabled: true });
		this.interact.push({ id: 'door', pos: this.toWorld(hw, 1.0, dz), r: 1.8, label: 'door' });
		// door mat, boots
		this.rbox(0.9, 0.02, 0.6, 0.01, M.leather, hw - 0.55, 0.01, dz, 2);
		const boot = (x, z, r) => {
			const g = new THREE.Group();
			const sole = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.05, 0.3, 3, 0.02), M.iron); sole.position.y = 0.025;
			const up = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.24, 0.13, 3, 0.04), M.leather); up.position.set(0, 0.16, -0.07);
			const toe = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.09, 0.2, 3, 0.04), M.leather); toe.position.set(0, 0.07, 0.04);
			g.add(sole, up, toe); g.position.set(x, 0, z); g.rotation.y = r;
			this.inner.add(g);
		};
		boot(hw - 0.42, dz - 0.18, 1.5); boot(hw - 0.4, dz - 0.02, 1.62);
		boot(hw - 0.75, dz + 0.2, 1.3); boot(hw - 0.78, dz + 0.36, 1.45);
		// coat hooks on the back wall with two jackets and a scarf
		const ky = 1.75, kz = -hd + 0.14;
		this.box(1.3, 0.12, 0.04, M.walnut, hw - 1.25, ky, kz, 1);
		[[hw - 1.7, M.jacketR], [hw - 1.2, M.jacketB], [hw - 0.75, M.knit]].forEach(([x, mat], i) => {
			this.add(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6), M.brass, x, ky, kz + 0.05).rotation.x = Math.PI / 2;
			if (i < 2) {
				const body = new THREE.CylinderGeometry(0.17, 0.25, 0.85, 14, 4);
				body.scale(1, 1, 0.45);
				const j = this.add(body, mat, x, ky - 0.46, kz + 0.13);
				const hood = this.add(new THREE.SphereGeometry(0.13, 12, 8), mat, x, ky - 0.02, kz + 0.11); hood.scale.set(1, 0.7, 0.6);
				void j;
			} else {
				const sc = this.add(new THREE.BoxGeometry(0.16, 0.9, 0.03), mat, x, ky - 0.42, kz + 0.08); void sc;
			}
		});
		// gloves and a beanie on the shelf above
		this.box(1.3, 0.03, 0.24, M.walnut, hw - 1.25, 2.12, kz + 0.06, 1);
		this.rbox(0.13, 0.05, 0.2, 0.02, M.jacketR, hw - 1.6, 2.16, kz + 0.06, 2);
		this.rbox(0.13, 0.05, 0.2, 0.02, M.jacketR, hw - 1.44, 2.16, kz + 0.07, 2).rotation.y = 0.3;
		const beanie = this.add(new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.knit, hw - 0.95, 2.135, kz + 0.06);
		void beanie;
		// backpack leaning against the wall
		const bp = new THREE.Group();
		bp.position.set(hw - 2.2, 0, -hd + 0.32); bp.rotation.set(-0.12, 0.1, 0);
		this.inner.add(bp);
		const bpm = (g, m, x, y, z) => { const mm = new THREE.Mesh(g, m); mm.position.set(x, y, z); bp.add(mm); };
		bpm(new RoundedBoxGeometry(0.42, 0.68, 0.28, 4, 0.08), M.pack, 0, 0.36, 0);
		bpm(new RoundedBoxGeometry(0.34, 0.24, 0.12, 3, 0.05), M.pack, 0, 0.28, 0.17);
		bpm(new RoundedBoxGeometry(0.4, 0.16, 0.26, 3, 0.07), M.jacketR, 0, 0.74, 0);
		bpm(new THREE.CylinderGeometry(0.06, 0.06, 0.44, 12).rotateZ(Math.PI / 2), M.jacketB, 0, 0.06, 0.08);
		this.solid(hw - 2.2, -hd + 0.32, 0.25, 0.2, 0, 0.8);
		// skis and poles
		for (const k of [0, 1]) {
			const ski = this.box(0.08, 1.75, 0.02, M.jacketB, hw - 0.18, 0.9, -hd + 0.5 + k * 0.1, 1);
			ski.rotation.z = 0.08;
		}
		for (const k of [0, 1]) {
			const p = this.add(new THREE.CylinderGeometry(0.009, 0.009, 1.25, 6), M.iron, hw - 0.2, 0.62, -hd + 0.75 + k * 0.06);
			p.rotation.x = 0.05;
		}
		// an ice axe on the wall
		const axe = new THREE.Group();
		axe.position.set(hw - 0.14, 1.45, -0.55); axe.rotation.set(0, -Math.PI / 2, 0.15);
		this.inner.add(axe);
		const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.62, 8), M.jacketB); axe.add(shaft);
		const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.02), M.iron); head.position.y = 0.31; axe.add(head);
		// bookshelf on the back wall
		const shx = 1.05, shz = -hd + 0.27;
		for (const y of [0.04, 0.55, 1.05, 1.55, 2.02]) this.box(1.5, 0.04, 0.32, M.walnut, shx, y, shz, 1);
		for (const sx of [-1, 1]) this.box(0.04, 2.05, 0.32, M.walnut, shx + sx * 0.75, 1.03, shz, 1);
		this.solid(shx, shz, 0.78, 0.17, 0, 2.1);
		const bookColors = [0x7a2a22, 0x24394f, 0x3d4a35, 0xc6a265, 0x5a3a22, 0x8b6d5a, 0x2b2b2b, 0xa2473a, 0x546a7b];
		const bookMats = bookColors.map((c) => patch(new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, envMapIntensity: 0.32 }), {}));
		const rnd = this.rnd;
		for (const y of [0.06, 0.57, 1.07]) {
			let x = shx - 0.7;
			while (x < shx + 0.7) {
				const w = 0.025 + rnd() * 0.035, h = 0.2 + rnd() * 0.14;
				if (rnd() < 0.08) { x += 0.12; continue; }
				const b = this.box(w, h, 0.18 + rnd() * 0.06, bookMats[(rnd() * bookMats.length) | 0], x + w / 2, y + h / 2 + 0.02, shz + 0.02, 1);
				if (rnd() < 0.1) b.rotation.z = 0.2;
				x += w + 0.004;
			}
		}
		this.lantern(shx + 0.45, 1.57, shz, 0.7);
		this.plant(shx - 0.4, shz, 0.25, 1.57);
		this.add(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 16), M.ceramic, shx, 1.65, shz);
		this.add(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 16), M.pot, shx + 0.15, 1.63, shz);
	}

	// ------------------------------------------------------------ lights
	lighting() {
		// exterior lanterns: two on the deck posts and one by the door, plus warm light spilling out
		const M = this.M;
		const hw = CABIN.W / 2, hd = CABIN.D / 2;
		this.lantern(-hw - 0.5, 1.16, hd + 2.74, 0.9);
		this.lantern(hw + 0.5, 1.16, hd + 2.74, 0.9);
		const dl = this.lantern(hw + 0.12, 2.0, this.door.c + 0.75, 0.8);
		dl.rotation.y = Math.PI / 2;
		this.porchLight = new THREE.PointLight(0xffa860, 0, 11, 2);
		this.porchLight.position.copy(new THREE.Vector3(hw + 0.6, 2.0, this.door.c + 0.75));
		this.inner.add(this.porchLight);
		this.deckLight = new THREE.PointLight(0xffb878, 0, 12, 2);
		this.deckLight.position.set(0, 1.4, hd + 2.0);
		this.inner.add(this.deckLight);
		void M;
	}

	// ------------------------------------------------------------ outside props
	outside() {
		const M = this.M;
		const hw = CABIN.W / 2;
		// woodpile along the back-left wall
		const logG = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 10);
		logG.rotateX(Math.PI / 2);
		const pile = new THREE.InstancedMesh(logG, M.bark, 48);
		const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
		let i = 0;
		for (let row = 0; row < 6; row++) for (let k = 0; k < 8; k++) {
			p.set(-hw - 0.55, -CABIN.LIFT + 0.12 + row * 0.22, -2.6 + k * 0.25 + (row % 2) * 0.12);
			q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 + (this.rnd() - 0.5) * 0.1);
			s.set(1, 1, 0.9 + this.rnd() * 0.2);
			pile.setMatrixAt(i++, m.compose(p, q, s));
		}
		pile.instanceMatrix.needsUpdate = true; pile.castShadow = true;
		this.inner.add(pile);
		this.add(new RoundedBoxGeometry(0.9, 0.12, 2.3, 3, 0.05), M.snow, -hw - 0.55, -CABIN.LIFT + 1.45, -1.7);
		this.solid(-hw - 0.55, -1.7, 0.5, 1.2, -CABIN.LIFT, 1.5);
		// chopping block and a pair of snowshoes by the porch
		this.add(new THREE.CylinderGeometry(0.28, 0.3, 0.5, 14), M.bark, hw + 2.4, -CABIN.LIFT + 0.25, this.door.c - 1.5);
		this.add(new THREE.CylinderGeometry(0.27, 0.27, 0.06, 14), M.snow, hw + 2.4, -CABIN.LIFT + 0.53, this.door.c - 1.5);
		this.solid(hw + 2.4, this.door.c - 1.5, 0.3, 0.3, -CABIN.LIFT, 0.1);
		for (const k of [0, 1]) {
			const g = new THREE.Group();
			g.position.set(hw + 0.16 + k * 0.05, 0.31, this.door.c + 1.3 + k * 0.16);
			g.rotation.set(0, Math.PI / 2, 0);
			const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 20), M.trim);
			ring.scale.set(0.55, 1.3, 1); ring.rotation.x = -0.18;
			const web = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), M.leather);
			web.scale.set(0.55, 1.3, 1); web.rotation.x = -0.18;
			g.add(ring, web);
			this.inner.add(g);
		}
	}

	// icicles in world space for the shared instanced mesh
	icicleWorld() {
		return this.icicleSpots.map((s) => { const w = s.local.clone().applyMatrix4(this.group.matrixWorld); return { x: w.x, y: w.y, z: w.z, len: s.len }; });
	}

	toggleDoor() { this.doorTarget = this.doorTarget ? 0 : 1; return this.doorTarget; }

	update(dt, time, level, cam) {
		// level: 0..1 how strongly the camp is lit for the time of day
		this.doorAngle += (this.doorTarget - this.doorAngle) * Math.min(1, dt * 3.2);
		this.doorPivot.rotation.y = this.doorAngle * 1.75;
		this.doorCollider.disabled = this.doorAngle > 0.35;
		{
			const th = this.doorPivot.rotation.y, half = this.door.w / 2;
			const p = this.doorPivot.position;
			const w = this.toWorld(p.x + Math.sin(th) * half, 0, p.z + Math.cos(th) * half);
			const oc = this.doorOpenCollider;
			oc.x = w.x; oc.z = w.z; oc.rot = this.yaw + th;
			oc.disabled = this.doorAngle < 0.35;
		}
		this.fireBoost = Math.max(0, this.fireBoost - dt * 0.12);
		const flick = 0.82 + Math.sin(time * 11.3) * 0.06 + Math.sin(time * 23.7 + 1.3) * 0.05 + Math.sin(time * 5.1) * 0.07;
		const fp = 1 + this.fireBoost * 0.9;
		this.fire.power = Math.min(1.6, 0.85 * fp + (flick - 0.82) * 0.6);
		this.fireLight.intensity = 9 * flick * fp * (0.55 + 0.45 * level);
		this.fireLight.position.x = -CABIN.W / 2 + 0.6 + Math.sin(time * 7.1) * 0.04;
		const lamps = 0.08 + level;
		this.bedLamp.intensity = 2.6 * lamps;
		this.pendant.intensity = 5.2 * lamps;
		this.porchLight.intensity = 6 * level;
		this.deckLight.intensity = 3.2 * level;
		const glow = Math.min(1.4, lamps * 1.4);
		this.M.lampshade.emissiveIntensity = glow * 0.9;
		this.M.lanternGlass.emissiveIntensity = 0.4 + level * 2.6 + Math.sin(time * 9.0) * 0.08 * level;
		this.frost.value = 0.25 + level * 0.5;
		// shadows from the fire only matter when someone is near
		if (this.fireLight.castShadow) this.fireLight.shadow.autoUpdate = cam.distanceTo(this.firePos) < 16;
	}

	// is a world point inside the cabin box?
	inside(p) {
		const l = p.clone().applyMatrix4(this.inv);
		return Math.abs(l.x) < CABIN.W / 2 - 0.05 && Math.abs(l.z) < CABIN.D / 2 - 0.05 && l.y > -0.5 && l.y < CABIN.EAVE + CABIN.W / 2 * CABIN.PITCH;
	}
}
