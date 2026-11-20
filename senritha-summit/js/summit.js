// The summit: crown rocks, wind-packed drifts, the steel flagpole and the red flag (a
// Verlet cloth driven by the wind), plus the route furniture: marker poles, cairns, the fixed
// rope on the summit zig-zags and the trailhead sign.
import * as THREE from 'three';
import { patch, tex, U } from './shading.js';
import { mulberry32 } from './noise.js';

// ---------------------------------------------------------------- cloth
class Cloth {
	constructor(w, h, cols, rows) {
		this.cols = cols; this.rows = rows; this.w = w; this.h = h;
		const n = cols * rows;
		this.p = new Float32Array(n * 3); this.o = new Float32Array(n * 3);
		this.pin = new Uint8Array(n);
		this.rest = { x: w / (cols - 1), y: h / (rows - 1) };
		for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
			const k = (j * cols + i) * 3;
			this.p[k] = (i / (cols - 1)) * w; this.p[k + 1] = -(j / (rows - 1)) * h; this.p[k + 2] = 0;
			if (i === 0) this.pin[j * cols + i] = 1;
		}
		this.o.set(this.p);
		this.pinPos = this.p.slice();
		const c = [];
		const L = (a, b) => { const ax = this.p[a * 3] - this.p[b * 3], ay = this.p[a * 3 + 1] - this.p[b * 3 + 1]; c.push(a, b, Math.hypot(ax, ay)); };
		for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
			const a = j * cols + i;
			if (i < cols - 1) L(a, a + 1);
			if (j < rows - 1) L(a, a + cols);
			if (i < cols - 1 && j < rows - 1) { L(a, a + cols + 1); L(a + 1, a + cols); }
			if (i < cols - 2) L(a, a + 2);
			if (j < rows - 2) L(a, a + cols * 2);
		}
		this.c = new Float32Array(c);
		this.normals = null;
	}
	step(dt, wind, gust, time, normals) {
		const p = this.p, o = this.o, n = this.cols * this.rows;
		const dt2 = dt * dt;
		for (let i = 0; i < n; i++) {
			if (this.pin[i]) continue;
			const k = i * 3;
			const vx = p[k] - o[k], vy = p[k + 1] - o[k + 1], vz = p[k + 2] - o[k + 2];
			const col = i % this.cols, row = (i / this.cols) | 0;
			// turbulence that travels down the flag
			const tw = Math.sin(time * (6 + gust * 9) - col * 0.55 + row * 0.25) * 0.5 + Math.sin(time * 2.3 + col * 0.31 + row * 0.7) * 0.35;
			const wx = wind.x * (1 + 0.35 * tw), wz = wind.z * (1 + 0.35 * tw) + tw * wind.l * 0.4, wy = tw * wind.l * 0.12;
			// aerodynamic push along the cloth normal
			const nx = normals[k], ny = normals[k + 1], nz = normals[k + 2];
			const rx = wx - vx / dt, ry = wy - vy / dt, rz = wz - vz / dt;
			const dn = rx * nx + ry * ny + rz * nz;
			const fx = nx * dn * 1.6 + rx * 0.08, fy = ny * dn * 1.6 + ry * 0.08 - 9.8 * 0.55, fz = nz * dn * 1.6 + rz * 0.08;
			o[k] = p[k]; o[k + 1] = p[k + 1]; o[k + 2] = p[k + 2];
			p[k] += vx * 0.985 + fx * dt2; p[k + 1] += vy * 0.985 + fy * dt2; p[k + 2] += vz * 0.985 + fz * dt2;
		}
		const c = this.c;
		for (let it = 0; it < 7; it++) {
			for (let q = 0; q < c.length; q += 3) {
				const a = c[q], b = c[q + 1], r = c[q + 2];
				const ka = a * 3, kb = b * 3;
				const dx = p[kb] - p[ka], dy = p[kb + 1] - p[ka + 1], dz = p[kb + 2] - p[ka + 2];
				const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
				const diff = (d - r) / d;
				const pa = this.pin[a], pb = this.pin[b];
				const wa = pa ? 0 : pb ? 1 : 0.5, wb = pb ? 0 : pa ? 1 : 0.5;
				p[ka] += dx * diff * wa; p[ka + 1] += dy * diff * wa; p[ka + 2] += dz * diff * wa;
				p[kb] -= dx * diff * wb; p[kb + 1] -= dy * diff * wb; p[kb + 2] -= dz * diff * wb;
			}
		}
	}
}

function flagTextures() {
	const W = 512, H = 336;
	const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
	const g = cv.getContext('2d');
	g.fillStyle = '#b3121c'; g.fillRect(0, 0, W, H);
	// sun-faded, weathered fabric
	for (let i = 0; i < 2600; i++) {
		const x = Math.random() * W, y = Math.random() * H;
		const fade = x / W;
		g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,210,200' : '60,0,6'},${0.02 + Math.random() * 0.05 * (0.4 + fade)})`;
		g.fillRect(x, y, 1 + Math.random() * 18, 1 + Math.random() * 3);
	}
	const grad = g.createLinearGradient(0, 0, W, 0);
	grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(255,190,180,0.16)');
	g.fillStyle = grad; g.fillRect(0, 0, W, H);
	// hems and stitching
	g.fillStyle = 'rgba(70,0,6,0.55)';
	g.fillRect(0, 0, W, 10); g.fillRect(0, H - 10, W, 10); g.fillRect(0, 0, 26, H);
	g.strokeStyle = 'rgba(255,215,205,0.55)'; g.lineWidth = 1.4; g.setLineDash([6, 5]);
	for (const y of [7, H - 7]) { g.beginPath(); g.moveTo(28, y); g.lineTo(W - 10, y); g.stroke(); }
	for (const x of [8, 22]) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x, H - 6); g.stroke(); }
	g.setLineDash([]);
	// grommets on the hoist
	g.fillStyle = '#c9c3b8';
	for (const y of [18, H / 2, H - 18]) { g.beginPath(); g.arc(13, y, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#5a1015'; g.beginPath(); g.arc(13, y, 2.4, 0, Math.PI * 2); g.fill(); g.fillStyle = '#c9c3b8'; }
	const map = new THREE.CanvasTexture(cv);
	map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
	// frayed fly end
	const ac = document.createElement('canvas'); ac.width = W; ac.height = H;
	const a = ac.getContext('2d');
	a.fillStyle = '#fff'; a.fillRect(0, 0, W, H);
	a.fillStyle = '#000';
	for (let y = 0; y < H; y += 2) {
		const len = 4 + Math.random() * 14 + (Math.sin(y * 0.07) * 0.5 + 0.5) * 10;
		a.fillRect(W - len, y, len, 2);
	}
	const alpha = new THREE.CanvasTexture(ac);
	return { map, alpha };
}

export class Summit {
	constructor(hf, q) {
		this.group = new THREE.Group();
		this.colliders = [];
		const s = hf.summit;
		this.top = new THREE.Vector3(s.x, s.y, s.z);
		const rnd = mulberry32(2024);

		// crown rocks: jagged slabs around the platform
		const rockMat = patch(new THREE.MeshStandardMaterial({ map: tex('rock_diff', 0.8), normalMap: tex('rock_nor', 0.8), roughnessMap: tex('rock_rough', 0.8), color: new THREE.Color(0.36, 0.38, 0.43), normalScale: new THREE.Vector2(1.4, 1.4) }), { snow: 0.5 });
		const slab = (x, z, w, h, d, ry, rx) => {
			const g = new THREE.BoxGeometry(w, h, d, 6, 8, 4);
			const p = g.attributes.position;
			for (let i = 0; i < p.count; i++) {
				const y = p.getY(i) / h + 0.5;
				const taper = 1 - y * 0.55;
				p.setX(i, p.getX(i) * taper + Math.sin(p.getY(i) * 3.1 + x) * 0.12);
				p.setZ(i, p.getZ(i) * taper + Math.cos(p.getY(i) * 2.3 + z) * 0.1);
				if (y > 0.98) p.setY(i, p.getY(i) + (rnd() - 0.5) * h * 0.25);
			}
			g.computeVertexNormals();
			const m = new THREE.Mesh(g, rockMat);
			const gy = hf.height(s.x + x, s.z + z);
			m.position.set(s.x + x, gy + h * 0.38, s.z + z);
			m.rotation.set(rx, ry, rx * 0.6);
			m.castShadow = m.receiveShadow = true;
			this.group.add(m);
			this.colliders.push({ x: s.x + x, z: s.z + z, r: Math.max(w, d) * 0.45, top: gy + h * 0.8 });
		};
		slab(-4.6, -2.2, 2.2, 5.2, 1.6, 0.4, 0.12);
		slab(-6.5, 1.8, 1.6, 3.6, 1.4, 1.2, -0.1);
		slab(3.8, -4.4, 1.8, 3.4, 1.3, -0.5, 0.18);
		slab(-2.0, -5.6, 2.8, 4.4, 1.9, 0.9, -0.15);
		slab(5.8, 2.6, 1.3, 2.6, 1.1, 2.1, 0.1);

		// wind-packed snow drifts on the lee (downwind, east) side of the top, sunk into the slope
		const snowMat = patch(new THREE.MeshStandardMaterial({ color: 0xf2f6fc, roughness: 0.78, normalMap: tex('snow_nor', 2), normalScale: new THREE.Vector2(0.6, 0.6) }), {});
		for (const [dx, dz, sx, sy, sz, ry] of [[3.8, -2.9, 3.0, 0.85, 1.5, 0.25], [6.6, -0.9, 2.4, 0.7, 1.2, -0.3], [-1.2, -4.8, 2.0, 0.55, 1.1, 0.6]]) {
			const g = new THREE.SphereGeometry(1, 28, 14);
			const p = g.attributes.position;
			// sharp windward crest, rounded lee
			for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setY(i, y > 0 ? y * (1 - 0.35 * Math.max(0, -x)) : y); }
			g.computeVertexNormals();
			const m = new THREE.Mesh(g, snowMat);
			const gx = s.x + dx, gz = s.z + dz;
			m.position.set(gx, hf.height(gx, gz) - sy * 0.45, gz);
			m.scale.set(sx, sy, sz);
			m.rotation.y = ry;
			m.receiveShadow = true;
			this.group.add(m);
		}

		// flagpole with cairn base and guy wires
		const poleH = 6.6;
		this.poleH = poleH;
		const steel = patch(new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 1, roughness: 0.32 }), {});
		const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.05, poleH, 14), steel);
		pole.position.y = poleH / 2;
		pole.castShadow = true;
		const finial = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), steel);
		finial.position.y = poleH + 0.06;
		this.flagRoot = new THREE.Group();
		this.flagRoot.position.copy(this.top);
		this.flagRoot.add(pole, finial);
		const stoneMat = patch(new THREE.MeshStandardMaterial({ map: tex('stone_diff', 0.6), normalMap: tex('stone_nor', 0.6), color: 0x9a9da3, roughness: 0.95 }), { snow: 0.55 });
		for (let i = 0; i < 26; i++) {
			const a = rnd() * Math.PI * 2, r = 0.25 + rnd() * 0.75, h = rnd() * 0.85;
			const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + rnd() * 0.16, 0), stoneMat);
			st.position.set(Math.cos(a) * r * (1 - h * 0.6), h * 0.75, Math.sin(a) * r * (1 - h * 0.6));
			st.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
			st.scale.y = 0.6;
			st.castShadow = true;
			this.flagRoot.add(st);
		}
		const wireMat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.9, roughness: 0.4 });
		for (const a of [0.5, 2.6, 4.7]) {
			const end = new THREE.Vector3(Math.cos(a) * 3.2, hf.height(s.x + Math.cos(a) * 3.2, s.z + Math.sin(a) * 3.2) - s.y + 0.1, Math.sin(a) * 3.2);
			const start = new THREE.Vector3(0, poleH * 0.72, 0);
			const len = start.distanceTo(end);
			const w = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, len, 4), wireMat);
			w.position.copy(start).add(end).multiplyScalar(0.5);
			w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
			this.flagRoot.add(w);
			const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), steel);
			peg.position.copy(end);
			this.flagRoot.add(peg);
		}
		this.group.add(this.flagRoot);
		this.colliders.push({ x: s.x, z: s.z, r: 1.0, top: s.y + 1.0 });

		// the flag
		const FW = 2.7, FH = 1.75, COLS = 26, ROWS = 17;
		this.cloth = new Cloth(FW, FH, COLS, ROWS);
		const fg = new THREE.PlaneGeometry(FW, FH, COLS - 1, ROWS - 1);
		this.flagGeo = fg;
		const { map, alpha } = flagTextures();
		const linen = tex('linen_nor', 3, 2);
		this.flagMat = patch(new THREE.MeshPhysicalMaterial({
			map, alphaMap: alpha, alphaTest: 0.5, color: 0xffffff, roughness: 0.78, metalness: 0,
			sheen: 1, sheenColor: new THREE.Color(1.0, 0.45, 0.42), sheenRoughness: 0.55,
			normalMap: linen, normalScale: new THREE.Vector2(0.5, 0.5), side: THREE.DoubleSide,
		}), {});
		this.flag = new THREE.Mesh(fg, this.flagMat);
		this.flag.castShadow = true;
		this.flag.frustumCulled = false;
		this.flag.position.set(0.05, poleH - 0.12, 0);
		this.flagRoot.add(this.flag);
		this.normals = new Float32Array(COLS * ROWS * 3);
		for (let i = 0; i < COLS * ROWS; i++) this.normals[i * 3 + 2] = 1;
		this.acc = 0;
		this.windLocal = { x: 0, z: 0, l: 0 };
		this.flapEnergy = 0;
		// settle the cloth
		for (let i = 0; i < 90; i++) this.simulate(1 / 60, i / 60, true);
	}

	simulate(dt, time, warm = false) {
		const wd = U.uWindDir.value;
		const strength = U.uWind.value, gust = U.uGust.value;
		const speed = (3 + strength * 15) * (1 + gust * 0.6);
		// wind in flag-local axes (flagRoot is not rotated)
		this.windLocal.x = wd.x * speed; this.windLocal.z = wd.y * speed; this.windLocal.l = speed;
		const prev = this.cloth.p.slice(0, 3 * this.cloth.cols);
		this.cloth.step(dt, this.windLocal, gust, time, this.normals);
		if (!warm) {
			const pos = this.flagGeo.attributes.position;
			pos.array.set(this.cloth.p);
			pos.needsUpdate = true;
			this.flagGeo.computeVertexNormals();
			this.normals.set(this.flagGeo.attributes.normal.array);
			// flutter energy for the audio
			let e = 0; const p = this.cloth.p, o = this.cloth.o;
			for (let i = 0; i < p.length; i += 9) e += Math.abs(p[i + 2] - o[i + 2]);
			this.flapEnergy = e / (p.length / 9) / dt;
		} else {
			this.normals.fill(0); for (let i = 2; i < this.normals.length; i += 3) this.normals[i] = 1;
		}
		void prev;
	}

	update(dt, time, camera) {
		const d = camera.position.distanceTo(this.top);
		// keep the flag readable from far away
		const sc = THREE.MathUtils.clamp(d / 320, 1, 2.6);
		this.flagRoot.scale.setScalar(sc);
		if (d > 4000) return;
		const steps = d < 200 ? 2 : 1;
		this.acc += dt;
		const h = 1 / 60;
		let n = 0;
		while (this.acc >= h && n < 4) { this.simulate(h, time); this.acc -= h; n++; }
		void steps;
		if (this.acc > h) this.acc = 0;
	}
}

// ---------------------------------------------------------------- route furniture
export class RouteFurniture {
	constructor(hf) {
		this.group = new THREE.Group();
		this.colliders = [];
		const R = hf.route;
		const rnd = mulberry32(55);
		// marker poles: wooden with a red-orange top band, every ~20 m alternating sides
		const pg = new THREE.CylinderGeometry(0.035, 0.045, 1.7, 7);
		pg.translate(0, 0.85, 0);
		const colors = new Float32Array(pg.attributes.position.count * 3);
		for (let i = 0; i < pg.attributes.position.count; i++) {
			const y = pg.attributes.position.getY(i);
			const c = y > 1.3 ? [0.75, 0.12, 0.05] : y > 1.15 ? [0.85, 0.8, 0.7] : [0.32, 0.22, 0.14];
			colors.set(c, i * 3);
		}
		pg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		const poleMat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), {});
		const spots = [];
		let side = 1;
		for (let i = 12; i < R.length - 10; i += 14) {
			const a = R[i], b = R[i + 1];
			const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1;
			side = -side;
			const x = a.x - (tz / l) * 2.9 * side, z = a.z + (tx / l) * 2.9 * side;
			spots.push([x, Math.min(hf.height(x, z), hf.height(x + 0.2, z), hf.height(x - 0.2, z), hf.height(x, z + 0.2), hf.height(x, z - 0.2)) - 0.3, z, (rnd() - 0.5) * 0.12]);
		}
		const im = new THREE.InstancedMesh(pg, poleMat, spots.length);
		const m = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
		spots.forEach(([x, y, z, t], i) => { e.set(t, 0, t * 0.7); q.setFromEuler(e); p.set(x, y, z); im.setMatrixAt(i, m.compose(p, q, s)); });
		im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true;
		this.group.add(im);
		this.markers = spots;

		// cairns at the switchback corners
		const stoneMat = patch(new THREE.MeshStandardMaterial({ map: tex('stone_diff', 0.5), normalMap: tex('stone_nor', 0.5), color: 0x8f9298, roughness: 0.95 }), { snow: 0.6 });
		const stone = new THREE.DodecahedronGeometry(0.3, 0);
		const cairnStones = [];
		for (let i = 20; i < R.length - 20; i++) {
			const a = R[i - 12], b = R[i], c = R[i + 12];
			const v1x = b.x - a.x, v1z = b.z - a.z, v2x = c.x - b.x, v2z = c.z - b.z;
			const cos = (v1x * v2x + v1z * v2z) / (Math.hypot(v1x, v1z) * Math.hypot(v2x, v2z) + 1e-6);
			if (cos < 0.2) {
				const ox = (v1x - v2x), oz = (v1z - v2z), ol = Math.hypot(ox, oz) || 1;
				const x = b.x + (ox / ol) * 3.2, z = b.z + (oz / ol) * 3.2, y = hf.height(x, z);
				for (let k = 0; k < 7; k++) cairnStones.push([x + (rnd() - 0.5) * 0.3 * (1 - k / 7), y + k * 0.2 - 0.05, z + (rnd() - 0.5) * 0.3 * (1 - k / 7), 1.3 - k * 0.13]);
				this.colliders.push({ x, z, r: 0.5, top: y + 1.3 });
				i += 30;
			}
		}
		const cim = new THREE.InstancedMesh(stone, stoneMat, Math.max(1, cairnStones.length));
		cairnStones.forEach(([x, y, z, sc], i) => { e.set(rnd() * 3, rnd() * 3, 0); q.setFromEuler(e); p.set(x, y, z); s.set(sc, sc * 0.65, sc); cim.setMatrixAt(i, m.compose(p, q, s)); });
		cim.count = cairnStones.length;
		cim.instanceMatrix.needsUpdate = true; cim.computeBoundingSphere(); cim.castShadow = true;
		this.group.add(cim);

		// fixed rope on the final steep zig-zags: posts and a sagging rope
		const ropeMat = new THREE.MeshStandardMaterial({ color: 0xc23b1d, roughness: 0.6 });
		const postMat = patch(new THREE.MeshStandardMaterial({ color: 0x6d7076, metalness: 0.8, roughness: 0.45 }), {});
		const posts = [];
		const startS = R[R.length - 1].s - 300;
		let sideR = 1;
		for (let i = 0; i < R.length - 3; i += 9) {
			if (R[i].s < startS) continue;
			const a = R[i], b = R[i + 1];
			const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1;
			const x = a.x + (tz / l) * 2.4 * sideR, z = a.z - (tx / l) * 2.4 * sideR;
			posts.push(new THREE.Vector3(x, hf.height(x, z) + 1.0, z));
		}
		void sideR;
		const pgeo = new THREE.CylinderGeometry(0.025, 0.025, 1.15, 6); pgeo.translate(0, -0.5, 0);
		const pim = new THREE.InstancedMesh(pgeo, postMat, Math.max(1, posts.length));
		posts.forEach((v, i) => { q.identity(); s.set(1, 1, 1); pim.setMatrixAt(i, m.compose(v, q, s)); });
		pim.instanceMatrix.needsUpdate = true; pim.computeBoundingSphere();
		this.group.add(pim);
		if (posts.length > 1) {
			const pts = [];
			for (let i = 0; i < posts.length - 1; i++) {
				const a = posts[i], b = posts[i + 1];
				for (let k = 0; k < 6; k++) { const t = k / 6; pts.push(a.clone().lerp(b, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * 0.18, 0))); }
			}
			pts.push(posts[posts.length - 1]);
			const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.014, 5), ropeMat);
			rope.castShadow = true;
			this.group.add(rope);
		}

		// trailhead sign near the camp
		const a = R[6], b = R[10];
		const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1;
		const sx = a.x + (tz / l) * 2.6, sz = a.z - (tx / l) * 2.6;
		const sign = new THREE.Group();
		const wood = patch(new THREE.MeshStandardMaterial({ map: tex('extwood_diff', 0.3, 0.3), color: 0x8a6a4c, roughness: 0.85 }), { snow: 0.7 });
		const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), wood); post.position.y = 1.1; post.castShadow = true;
		const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160;
		const g = cv.getContext('2d');
		g.fillStyle = '#6b4a2f'; g.fillRect(0, 0, 512, 160);
		g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 40; i++) g.fillRect(0, Math.random() * 160, 512, 1);
		g.fillStyle = '#f3e7d3'; g.font = '600 52px Georgia, serif'; g.textBaseline = 'middle';
		g.fillText('SUMMIT  ▲', 26, 58);
		g.font = '500 34px Georgia, serif';
		g.fillText(`${(R[R.length - 1].s / 1000).toFixed(1)} km · ${Math.round(R[R.length - 1].y - R[0].y)} m`, 26, 116);
		const st = new THREE.CanvasTexture(cv); st.colorSpace = THREE.SRGBColorSpace;
		const board = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.4, 0.05), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: st, roughness: 0.8 }), wood]);
		board.position.set(0.4, 1.8, 0.07); board.castShadow = true;
		sign.add(post, board);
		sign.position.set(sx, hf.height(sx, sz) - 0.1, sz);
		sign.rotation.y = Math.atan2(tx, tz) + Math.PI / 2;
		this.group.add(sign);
		this.colliders.push({ x: sx, z: sz, r: 0.25, top: sign.position.y + 2.2 });
	}
}
