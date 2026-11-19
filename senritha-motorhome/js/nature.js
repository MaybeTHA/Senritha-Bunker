// Winter forest: sky dome, snow ground with a forest road, instanced snow-laden spruce,
// falling snow, fog banks and the props outside the door.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, Batcher, softBox, lathe, cyl, surface } from './geometry.js';
import { makeNoise, rng, lerp, smooth } from './noise.js';
import { U } from './materials.js';
import { GROUND_Y } from './motorhome.js';

const V3 = THREE.Vector3;
const PI = Math.PI;
const N = makeNoise(17);

export const SKY = {
	zenith: new THREE.Color(0x101a2e),
	mid: new THREE.Color(0x2c3b56),
	horizon: new THREE.Color(0x5b6a82),
	glow: new THREE.Color(0x8a7e8c),
};

// Forest road leaving the clearing to the front of the motorhome.
const ROAD = [[4, 0.2], [12, 1.2], [22, 4.5], [34, 11], [48, 16], [66, 18], [90, 15], [130, 8]].map(([x, z]) => new THREE.Vector2(x, z));
function roadDist(x, z) {
	let best = 1e9, along = 0, acc = 0;
	for (let i = 0; i < ROAD.length - 1; i++) {
		const a = ROAD[i], b = ROAD[i + 1];
		const abx = b.x - a.x, abz = b.y - a.y; const L2 = abx * abx + abz * abz;
		const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.y) * abz) / L2));
		const px = a.x + abx * t, pz = a.y + abz * t;
		const d = Math.hypot(x - px, z - pz);
		if (d < best) { best = d; along = acc + t * Math.sqrt(L2); }
		acc += Math.sqrt(L2);
	}
	return [best, along];
}

export function groundHeight(x, z) {
	const r = Math.hypot(x * 0.7, z);
	const wild = smooth(8, 26, r);
	let h = GROUND_Y + wild * (N.fbm(x * 0.018, z * 0.018, 999, 999, 4) * 3.2 + 0.4) + N.fbm(x * 0.12, z * 0.12, 999, 999, 3) * 0.12 * (0.3 + wild);
	// snow banked against the motorhome
	const bx = Math.max(Math.abs(x - 0.2) - 4.9, 0), bz = Math.max(Math.abs(z) - 1.3, 0);
	h += 0.12 * Math.exp(-Math.hypot(bx, bz) * 1.6) * (Math.abs(z) > 1.25 || Math.abs(x - 0.2) > 4.9 ? 1 : 0);
	const [d] = roadDist(x, z);
	if (x > 3) {
		const road = smooth(3.4, 1.6, d);
		h = lerp(h, GROUND_Y + wild * 0.6 * (N.fbm(x * 0.018, z * 0.018, 999, 999, 2) * 3.2 + 0.4), road * 0.85);
		for (const off of [-0.78, 0.78]) h -= 0.07 * Math.exp(-((d - Math.abs(off)) ** 2) / 0.02) * road;
	}
	return h;
}

export function skyMaterial() {
	return new THREE.ShaderMaterial({
		uniforms: { uTime: U.time, uZen: { value: SKY.zenith }, uMid: { value: SKY.mid }, uHor: { value: SKY.horizon }, uGlow: { value: SKY.glow }, uBright: { value: 1 } },
		vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
		fragmentShader: /* glsl */`
			uniform vec3 uZen, uMid, uHor, uGlow; uniform float uTime, uBright; varying vec3 vDir;
			float h3(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.7); }
			float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
				return mix(mix(h3(i), h3(i + vec2(1, 0)), f.x), mix(h3(i + vec2(0, 1)), h3(i + vec2(1, 1)), f.x), f.y); }
			float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vn(p); p *= 2.1; a *= 0.5; } return s; }
			void main(){
				vec3 d = normalize(vDir);
				float h = d.y;
				vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.22, h));
				col = mix(col, uZen, smoothstep(0.2, 0.85, h));
				float az = atan(d.z, d.x);
				col += uGlow * 0.35 * exp(-pow((az - 2.4) * 1.2, 2.0)) * exp(-max(h, 0.0) * 9.0);
				vec2 cp = d.xz / max(h + 0.25, 0.05) * 1.6 + vec2(uTime * 0.004, uTime * 0.0015);
				float c = fbm(cp);
				col *= 0.86 + 0.26 * c * smoothstep(0.0, 0.3, h);
				if (h < 0.0) col = mix(uHor, uHor * 0.92, smoothstep(0.0, -0.2, h));
				gl_FragColor = vec4(col * uBright, 1.0);
			}`,
		side: THREE.BackSide, depthWrite: false, fog: false,
	});
}

// ---------------------------------------------------------------- spruce geometry
function buildSpruce(seed, { height = 14, whorls = 13, per = 8, fill = 0.6, segs = 5, widthK = 0.62, sides = 0 }) {
	const R = rng(seed);
	const pos = [], uv = [], ao = [], idx = [];
	const H = height;
	const addFrond = (base, ang, L, droop, wid, aoBase, tilt = 0) => {
		const dir = new V3(Math.cos(ang), 0, Math.sin(ang));
		const side = new V3(-Math.sin(ang), 0, Math.cos(ang));
		const b0 = pos.length / 3;
		for (let k = 0; k <= segs; k++) {
			const s = k / segs;
			const r = s * L;
			const y = -droop * Math.pow(s, 1.5) * L + 0.22 * Math.pow(s, 3) * L + tilt * s * L;
			const c = base.clone().addScaledVector(dir, r); c.y += y;
			const w = wid * (0.25 + 0.75 * Math.sin(PI * Math.min(1, 0.12 + s * 0.95)));
			const ridge = w * 0.16, dropE = w * 0.22;
			const l = c.clone().addScaledVector(side, -w / 2); l.y -= dropE;
			const m = c.clone(); m.y += ridge;
			const rr = c.clone().addScaledVector(side, w / 2); rr.y -= dropE;
			for (const [p, u] of [[l, 0], [m, 0.5], [rr, 1]]) { pos.push(p.x, p.y, p.z); uv.push(u, s); ao.push(lerp(aoBase * 0.55, 1.0, Math.pow(s, 0.7))); }
		}
		for (let k = 0; k < segs; k++) {
			const a = b0 + k * 3, b = a + 3;
			idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
		}
	};
	for (let w = 0; w < whorls; w++) {
		const t = (w + R() * 0.3) / whorls;
		const y = H * (0.1 + 0.86 * Math.pow(t, 0.92));
		const env = Math.pow(1 - (y / H), 0.95);
		const L = H * 0.19 * env + 0.25;
		const aoBase = 0.45 + 0.55 * (y / H);
		const n = Math.max(4, Math.round(per * (0.6 + 0.4 * env)));
		const off = R() * PI * 2;
		for (let k = 0; k < n; k++) {
			const a = off + (k / n) * PI * 2 + (R() - 0.5) * 0.4;
			const l = L * (0.85 + R() * 0.3);
			const droop = 0.32 + R() * 0.18;
			addFrond(new V3(0, y, 0), a, l, droop, l * widthK, aoBase);
			for (let sd = 0; sd < sides; sd++) {
				const st = 0.28 + 0.5 * (sd + R() * 0.6) / sides;
				const p = new V3(Math.cos(a) * st * l, y - droop * Math.pow(st, 1.5) * l + 0.22 * Math.pow(st, 3) * l - 0.025, Math.sin(a) * st * l);
				const sgn = sd % 2 ? 1 : -1;
				const sl = l * (0.46 - st * 0.18) * (0.85 + R() * 0.3);
				addFrond(p, a + sgn * (0.7 + R() * 0.35), sl, droop * 0.85, sl * widthK * 1.1, aoBase * (0.8 + st * 0.2));
			}
			if (R() < fill) {
				const a2 = a + PI / n;
				const l2 = l * (0.55 + R() * 0.2);
				addFrond(new V3(0, y - H * 0.35 / whorls, 0), a2, l2, 0.25 + R() * 0.2, l2 * widthK, aoBase * 0.9);
			}
		}
	}
	// crown: short fronds angled gently upward around a slim leader
	for (let k = 0; k < 5; k++) addFrond(new V3(0, H * (0.93 + k * 0.012), 0), k / 5 * PI * 2 + 0.4, 0.42 - k * 0.05, -0.05, 0.22, 0.95, 0.35);
	{
		const b0 = pos.length / 3; const top = H * 1.02, bot = H * 0.9;
		for (const [x, y, z, u, v] of [[-0.06, bot, 0, 0, 0], [0.06, bot, 0, 1, 0], [0, top, 0, 0.5, 1], [0, bot, -0.06, 0, 0], [0, bot, 0.06, 1, 0]]) { pos.push(x, y, z); uv.push(u * 0.4 + 0.3, v); ao.push(0.9); }
		idx.push(b0, b0 + 1, b0 + 2, b0 + 3, b0 + 4, b0 + 2);
	}
	const fr = new THREE.BufferGeometry();
	fr.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	fr.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	fr.setAttribute('aAO', new THREE.Float32BufferAttribute(ao, 1));
	fr.setIndex(idx);
	fr.computeVertexNormals();

	const trunk = new THREE.CylinderGeometry(0.035, 0.24, H * 0.97, 9, 8, true);
	trunk.translate(0, H * 0.97 / 2 - 0.1, 0);
	const tp = trunk.attributes.position, tuv = trunk.attributes.uv;
	for (let i = 0; i < tp.count; i++) {
		const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i);
		const k = 1 + N.n2(Math.atan2(z, x) * 2, y * 0.8) * 0.12 + (y < 0.6 ? (0.6 - y) * 0.5 : 0);
		tp.setXYZ(i, x * k, y, z * k);
		tuv.setXY(i, tuv.getX(i), y / H * 6);
	}
	trunk.computeVertexNormals();
	// dark inner cone so the crown reads as dense from a distance
	const inner = new THREE.ConeGeometry(H * 0.06, H * 0.75, 10, 1, true);
	inner.translate(0, H * 0.53, 0);
	return { fronds: fr, trunk, inner, height: H };
}

export function buildNature(mats, T, quality, motor) {
	const { m } = mats;
	const group = new THREE.Group(); group.name = 'nature';
	const updaters = [];
	const R = rng(99);
	const trunks = [];

	// ---------------------------------------------------------------- sky
	const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 48, 24), skyMaterial());
	sky.renderOrder = -10; sky.frustumCulled = false; sky.layers.set(1);
	group.add(sky);

	// ---------------------------------------------------------------- ground (dense near the motorhome)
	{
		const n = quality.groundRes;
		const half = 230;
		const map = (s) => half * (0.12 * s + 0.88 * s * s * s);
		const g = surface(n, n, (u, v, t) => {
			const x = map(u * 2 - 1), z = map(v * 2 - 1);
			t.set(x, groundHeight(x, z), z);
		});
		const p = g.attributes.position, uvA = g.attributes.uv;
		for (let i = 0; i < p.count; i++) uvA.setXY(i, p.getX(i), -p.getZ(i));
		// flip winding: surface() builds in x/z with normals pointing down
		const ix = g.index.array;
		for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
		g.computeVertexNormals();
		const ground = new THREE.Mesh(g, m.snow);
		ground.receiveShadow = true; ground.name = 'ground';
		group.add(ground);
	}

	// ---------------------------------------------------------------- spruce forest
	const variants = [
		buildSpruce(3, { height: 15, whorls: 16, per: 9, fill: 0.5, segs: 4, widthK: 0.48, sides: 2 }),
		buildSpruce(8, { height: 13.5, whorls: 14, per: 8, fill: 0.5, segs: 4, widthK: 0.55, sides: 1 }),
		buildSpruce(13, { height: 14, whorls: 10, per: 6, fill: 0.3, segs: 3, widthK: 0.8 }),
	];
	const innerMat = new THREE.MeshStandardMaterial({ color: 0x1b2a22, roughness: 1 });
	mats.exterior.push(innerMat);
	const placed = [];
	const ok = (x, z, minD) => {
		for (const q of placed) if ((q.x - x) ** 2 + (q.z - z) ** 2 < minD * minD) return false;
		return true;
	};
	const want = quality.trees;
	let tries = 0;
	while (placed.length < want && tries < want * 40) {
		tries++;
		const a = R() * PI * 2;
		const rr = 10 + Math.pow(R(), 0.85) * 140;
		const x = Math.cos(a) * rr * 1.25, z = Math.sin(a) * rr;
		if (Math.hypot(x * 0.68, z) < 10.5) continue;
		const [d] = roadDist(x, z);
		if (x > 2 && d < 4.6) continue;
		if (Math.hypot(x + 0.5, z - 5) < 5) continue;
		if (Math.hypot(x - 6.5, z - 4.2) < 4) continue;
		const minD = rr < 40 ? 2.3 : 3.4;
		if (!ok(x, z, minD)) continue;
		placed.push({ x, z, r: Math.hypot(x, z) });
	}
	// saplings at the clearing edge
	for (let i = 0; i < 26; i++) {
		const a = R() * PI * 2, rr = 8.5 + R() * 6;
		const x = Math.cos(a) * rr * 1.35, z = Math.sin(a) * rr;
		if (Math.hypot(x * 0.68, z) < 8) continue;
		const [d] = roadDist(x, z);
		if (x > 2 && d < 4) continue;
		if (Math.hypot(x + 0.5, z - 5) < 4 || Math.hypot(x - 6.5, z - 4.2) < 3.5) continue;
		placed.push({ x, z, r: Math.hypot(x, z), small: 0.12 + R() * 0.22 });
	}
	placed.sort((a, b) => a.r - b.r);
	const nearCut = quality.nearRadius;
	const buckets = [[], [], []];
	for (const p of placed) {
		const v = p.r < 26 || p.small ? 0 : p.r < nearCut ? 1 : 2;
		buckets[v].push(p);
	}
	const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), c = new THREE.Color();
	buckets.forEach((list, vi) => {
		if (!list.length) return;
		const v = variants[vi];
		const fr = new THREE.InstancedMesh(v.fronds, m.frond, list.length);
		const tr = new THREE.InstancedMesh(v.trunk, m.bark, list.length);
		const inn = new THREE.InstancedMesh(v.inner, innerMat, vi === 2 ? list.length : 0);
		list.forEach((p, i) => {
			const sc = p.small ?? (0.75 + R() * 0.6) * (p.r > 60 ? 1.15 : 1);
			const y = groundHeight(p.x, p.z) - 0.15;
			q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.04, R() * PI * 2, (R() - 0.5) * 0.04));
			s.set(sc * (0.9 + R() * 0.2), sc * (0.85 + R() * 0.3), sc * (0.9 + R() * 0.2));
			tmp.compose(new V3(p.x, y, p.z), q, s);
			fr.setMatrixAt(i, tmp); tr.setMatrixAt(i, tmp); if (vi === 2) inn.setMatrixAt(i, tmp);
			const k = 0.75 + R() * 0.4;
			fr.setColorAt(i, c.setRGB(k * (0.95 + R() * 0.1), k, k * (0.9 + R() * 0.15)));
			if (p.r < 30) trunks.push({ x: p.x, z: p.z, r: 0.3 * sc });
		});
		fr.customDepthMaterial = m.frondDepth;
		for (const im of vi === 2 ? [fr, tr, inn] : [fr, tr]) {
			im.castShadow = vi < 2; im.receiveShadow = true; im.layers.set(1);
			im.computeBoundingSphere();
			group.add(im);
		}
		fr.userData.fullCount = list.length; tr.userData.fullCount = list.length; if (vi === 2) inn.userData.fullCount = list.length;
	});

	// ---------------------------------------------------------------- outdoor props
	const B = new Batcher();
	const put = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, opt) => B.add(geo, mat, M(x, y, z, rx, ry, rz), opt);
	const focusables = [];
	const focus = (name, desc, box, view, dist) => focusables.push({ name, desc, space: 'exterior', dist, box: new THREE.Box3(new V3(box[0], box[1], box[2]), new V3(box[3], box[4], box[5])), view: new V3(...view).normalize() });
	const colliders = [];

	// woodpile with a snow cap
	{
		const wx = -0.6, wz = 5.2, gy = groundHeight(wx, wz);
		put(softBox(2.3, 0.08, 0.7, 0.02), m.extWood, wx, gy + 0.04, wz);
		const logG = cyl(0.075, 0.08, 0.6, 14, true);
		const cap = new THREE.CircleGeometry(0.078, 16);
		for (let row = 0; row < 5; row++) {
			const n = 13 - row;
			for (let i = 0; i < n; i++) {
				const x = wx - (n - 1) * 0.08 + i * 0.16 + (row % 2) * 0.04, y = gy + 0.16 + row * 0.135;
				const r = (R() - 0.5) * 0.1;
				put(logG, m.logPile, x, y, wz, PI / 2, r, 0);
				put(cap, m.endGrainExt, x, y, wz + 0.301, 0, r * 0.3, 0);
			}
		}
		put(softBox(2.1, 0.16, 0.72, 0.07, { density: 18, puff: 0.06, wrinkle: 0.02 }), m.snowSoft, wx, gy + 0.85, wz);
		for (const s of [-1, 1]) put(cyl(0.04, 0.04, 1.0, 10), m.extWood, wx + s * 1.1, gy + 0.5, wz);
		// stump and axe
		const sx = 1.4, sz = 4.4, sy = groundHeight(sx, sz);
		put(cyl(0.24, 0.28, 0.42, 20), m.logPile, sx, sy + 0.21, sz);
		put(new THREE.CircleGeometry(0.24, 24), m.endGrainExt, sx, sy + 0.421, sz, -PI / 2);
		put(softBox(0.38, 0.06, 0.38, 0.03, { density: 30, puff: 0.03, wrinkle: 0.01 }), m.snowSoft, sx + 0.05, sy + 0.44, sz + 0.04);
		put(cyl(0.017, 0.02, 0.7, 10), m.extWood, sx + 0.12, sy + 0.62, sz - 0.05, 0.3, 0, -0.5);
		put(softBox(0.16, 0.09, 0.025, 0.006), m.metalDark, sx - 0.02, sy + 0.45, sz - 0.03, 0, 0, -0.5);
		colliders.push({ x: wx, z: wz, hw: 1.2, hd: 0.4 }, { x: sx, z: sz, hw: 0.3, hd: 0.3 });
		focus('Woodpile', 'Birch and spruce split for the stove, stacked under a crust of fresh snow.', [wx - 1.2, gy, wz - 0.4, wx + 1.2, gy + 1.0, wz + 0.4], [0.2, 0.35, -1], 3.4);
	}
	// fire ring and two camp chairs, snowed in
	{
		const fx = 6.6, fz = 4.3, fy = groundHeight(fx, fz);
		for (let i = 0; i < 14; i++) {
			const a = i / 14 * PI * 2;
			put(softBox(0.24, 0.16, 0.18, 0.06, { density: 16, puff: 0.02, wrinkle: 0.02 }), m.rock, fx + Math.cos(a) * 0.62, fy + 0.05, fz + Math.sin(a) * 0.62, R() * 0.3, -a, R() * 0.2);
		}
		put(new THREE.CircleGeometry(0.55, 32), m.snowSoft, fx, fy + 0.03, fz, -PI / 2);
		const chair = (x, z, yaw) => {
			const y = groundHeight(x, z);
			B.push(M(x, y, z, 0, yaw, 0));
			for (const [a, b] of [[[-0.25, 0, -0.22], [0.25, 0.42, 0.22]], [[0.25, 0, -0.22], [-0.25, 0.42, 0.22]], [[-0.25, 0, 0.22], [0.25, 0.42, -0.22]], [[0.25, 0, 0.22], [-0.25, 0.42, -0.22]]]) {
				const va = new V3(...a), vb = new V3(...b); const mid = va.clone().add(vb).multiplyScalar(0.5); const len = va.distanceTo(vb);
				const qq = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), new V3().subVectors(vb, va).normalize());
				B.add(cyl(0.012, 0.012, len, 8), m.metalDark, new THREE.Matrix4().compose(mid, qq, new V3(1, 1, 1)));
			}
			put(softBox(0.52, 0.04, 0.46, 0.02, { density: 20, sag: 0.04 }), m.canvasChair, 0, 0.42, 0);
			put(softBox(0.52, 0.5, 0.03, 0.02, { density: 20 }), m.canvasChair, 0, 0.68, -0.24, -0.2, 0, 0);
			put(softBox(0.48, 0.07, 0.42, 0.03, { density: 24, puff: 0.04, wrinkle: 0.01 }), m.snowSoft, 0, 0.46, 0.01);
			put(softBox(0.5, 0.04, 0.06, 0.02, { density: 24, puff: 0.02 }), m.snowSoft, 0, 0.95, -0.29);
			B.pop();
		};
		chair(fx - 1.3, fz + 0.7, PI * 0.65);
		chair(fx + 0.4, fz + 1.4, PI * 1.05);
		colliders.push({ x: fx, z: fz, hw: 0.75, hd: 0.75 }, { x: fx - 1.3, z: fz + 0.7, hw: 0.35, hd: 0.35 }, { x: fx + 0.4, z: fz + 1.4, hw: 0.35, hd: 0.35 });
		focus('Fire ring', 'Too much snow for a campfire tonight. Two chairs wait for a clear evening.', [fx - 1.7, fy, fz - 0.8, fx + 0.8, fy + 1.0, fz + 1.8], [-0.2, 0.5, -1], 4);
	}
	// skis and poles leaning against the motorhome
	{
		const z = 1.33;
		for (const [x, a] of [[2.38, 0.12], [2.5, 0.1]]) {
			B.add(softBox(0.08, 1.75, 0.018, 0.008, { density: 2 }), m.paintDark, M(x, GROUND_Y + 0.86, z + 0.12, -0.16, 0, a));
			put(lathe([[0.001, 0.06], [0.04, 0.0], [0.04, -0.01]], 12), m.paintDark, x + 0.09, GROUND_Y + 1.74, z + 0.26, -0.16, 0, a);
		}
		for (const x of [2.22, 2.27]) put(cyl(0.008, 0.008, 1.3, 8), m.alloy, x, GROUND_Y + 0.62, z + 0.12, -0.12, 0, 0.08);
		put(softBox(0.22, 0.05, 0.08, 0.02, { density: 30, puff: 0.02 }), m.snowSoft, 2.44, GROUND_Y + 1.63, z + 0.25);
		focus('Skis', 'Waxed this morning. The trail starts behind the woodpile.', [2.15, GROUND_Y, 1.3, 2.6, GROUND_Y + 1.8, 1.6], [0.3, 0.3, 1], 2.2);
	}
	// shepherd hook lantern lighting the path
	const lanternPos = new V3(1.0, 0, 3.1);
	{
		const ly = groundHeight(lanternPos.x, lanternPos.z);
		B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(0, 0, 0), new V3(0, 1.4, 0), new V3(0.08, 1.55, 0), new V3(0.18, 1.5, 0)].map((p) => p.add(new V3(lanternPos.x, ly, lanternPos.z)))), 24, 0.01, 8), m.metalDark);
		put(softBox(0.11, 0.16, 0.11, 0.01), m.metalDark, lanternPos.x + 0.18, ly + 1.3, lanternPos.z);
		put(cyl(0.032, 0.032, 0.1, 16), m.lamp, lanternPos.x + 0.18, ly + 1.3, lanternPos.z);
		put(lathe([[0.001, 0.05], [0.08, 0], [0.08, -0.008]], 16), m.metalDark, lanternPos.x + 0.18, ly + 1.39, lanternPos.z);
		put(lathe([[0.001, 0.04], [0.075, 0], [0.078, -0.01]], 16), m.snowSoft, lanternPos.x + 0.18, ly + 1.41, lanternPos.z);
		lanternPos.set(lanternPos.x + 0.18, ly + 1.3, lanternPos.z);
		focus('Lantern', 'A candle lantern on a shepherd hook marks the way to the woodpile.', [lanternPos.x - 0.25, ly, lanternPos.z - 0.2, lanternPos.x + 0.15, ly + 1.6, lanternPos.z + 0.2], [0.4, 0.2, 1], 2.4);
	}
	// boulders and a fallen log
	for (const [x, z, sc] of [[-9, 6, 1.2], [-11, -4, 0.9], [8, -7, 1.4], [-6, -8.5, 0.8], [11, 6.5, 1.0]]) {
		const y = groundHeight(x, z);
		put(softBox(1.2 * sc, 0.6 * sc, 0.9 * sc, 0.25 * sc, { density: 8, puff: 0.12 * sc, wrinkle: 0.06 * sc, wrinkleF: 3 }), m.rock, x, y + 0.15 * sc, z, R() * 0.2, R() * PI, R() * 0.2);
	}
	{
		const x = -7.5, z = 2.5, y = groundHeight(x, z);
		put(cyl(0.22, 0.26, 4.2, 16), m.logPile, x, y + 0.18, z, 0, 0.6, PI / 2 - 0.04);
		put(softBox(4.0, 0.1, 0.3, 0.05, { density: 10, puff: 0.06, wrinkle: 0.02 }), m.snowSoft, x, y + 0.42, z, 0, 0.6, 0.04);
	}
	const props = B.build(group, 'props');
	for (const p of props) if (p.material.transparent) p.layers.set(1);

	// footprints from the door to the woodpile
	{
		const pts = [new V3(3.05, 0, 2.2), new V3(2.4, 0, 3.0), new V3(1.2, 0, 3.6), new V3(0.2, 0, 4.2), new V3(-0.4, 0, 4.6)];
		const curve = new THREE.CatmullRomCurve3(pts);
		const L = curve.getLength(); const n = 60; const w = 0.5;
		const pos = [], uv = [], idx = [];
		for (let i = 0; i <= n; i++) {
			const t = i / n; const p = curve.getPoint(t); const tg = curve.getTangent(t);
			const sd = new V3(-tg.z, 0, tg.x).normalize();
			for (const e of [-1, 1]) {
				const x = p.x + sd.x * e * w / 2, z = p.z + sd.z * e * w / 2;
				pos.push(x, groundHeight(x, z) + 0.012, z); uv.push(e < 0 ? 0 : 1, t * L / 15);
			}
			if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
		g.setIndex(idx); g.computeVertexNormals();
		const fp = new THREE.Mesh(g, m.footprints); fp.receiveShadow = true; fp.layers.set(1); fp.renderOrder = 1;
		if (g.attributes.normal.getY(0) < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
		group.add(fp);
	}

	// warm window light spilling onto the snow
	{
		const spillMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.62, 0.3), alphaMap: T.spill, transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending });
		const spills = [[2.35, -1, 1.9, 2.6], [1.81, 1, 1.7, 2.4], [-0.4, 1, 1.1, 1.7], [-3.1, 1, 1.0, 1.6], [-3.1, -1, 1.0, 1.6], [3.12, 1, 0.8, 1.4]];
		for (const [x, s, w, d] of spills) {
			const z = s * (1.27 + d / 2 + 0.1);
			const g = new THREE.PlaneGeometry(w * 1.5, d * 1.4, 8, 8);
			g.rotateX(-PI / 2);
			const p = g.attributes.position;
			for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(x + p.getX(i), z + p.getZ(i)) + 0.02);
			g.translate(x, 0, z);
			const mesh = new THREE.Mesh(g, spillMat); mesh.layers.set(1); mesh.renderOrder = 1;
			group.add(mesh);
		}
	}

	// ---------------------------------------------------------------- fog banks between the trees
	{
		const fogMat = new THREE.ShaderMaterial({
			uniforms: { uTime: U.time, uColor: { value: SKY.horizon.clone().multiplyScalar(1.05) }, uOp: { value: 0.32 } },
			vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
			fragmentShader: /* glsl */`uniform float uTime, uOp; uniform vec3 uColor; varying vec2 vUv; varying vec3 vW;
				float h3(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.7); }
				float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h3(i), h3(i + vec2(1, 0)), f.x), mix(h3(i + vec2(0, 1)), h3(i + vec2(1, 1)), f.x), f.y); }
				float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.1; a *= 0.5; } return s; }
				void main(){
					float n = fbm(vW.xz * 0.04 + vec2(uTime * 0.01, 0.0) + vUv.y * 0.8);
					float a = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.35, vUv.y) * smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
					float d = length(cameraPosition - vW);
					a *= smoothstep(6.0, 22.0, d) * (0.45 + 0.8 * n);
					gl_FragColor = vec4(uColor, a * uOp);
				}`,
			transparent: true, depthWrite: false, fog: false,
		});
		const banks = new THREE.Group();
		for (let i = 0; i < quality.fogBanks; i++) {
			const a = R() * PI * 2, r = 22 + R() * 60;
			const x = Math.cos(a) * r, z = Math.sin(a) * r;
			const w = 26 + R() * 30, h = 5 + R() * 5;
			const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), fogMat);
			p.position.set(x, groundHeight(x, z) + h * 0.32, z);
			p.layers.set(1); p.renderOrder = 1;
			banks.add(p);
		}
		group.add(banks);
		updaters.push((t, dt, cam) => {
			for (const b of banks.children) b.rotation.y = Math.atan2(cam.position.x - b.position.x, cam.position.z - b.position.z);
		});
	}

	// ---------------------------------------------------------------- falling snow
	const snow = makeSnowfall(quality.snow, motor);
	group.add(snow);
	updaters.push((t, dt, cam) => {
		snow.material.uniforms.uCam.value.copy(cam.position);
	});

	// ---------------------------------------------------------------- moonlight through cloud and the lantern
	const moon = new THREE.DirectionalLight(0x9db2d8, 0.55);
	moon.position.set(-22, 34, 16);
	moon.target.position.set(0, 0, 0);
	moon.castShadow = true;
	const sc = moon.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 110;
	moon.shadow.mapSize.set(quality.moonShadow, quality.moonShadow);
	moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.05;
	moon.shadow.camera.layers.enable(1);
	group.add(moon, moon.target);
	const lantern = new THREE.PointLight(0xffb066, 1.4, 12, 2);
	lantern.position.copy(lanternPos);
	group.add(lantern);
	updaters.push((t) => { lantern.intensity = 1.4 * (0.9 + 0.06 * Math.sin(t * 9.1) + 0.04 * Math.sin(t * 17.3)); });

	return { group, sky, snow, moon, updaters, focusables, colliders, trunks };
}

function makeSnowfall(count, motor) {
	const g = new THREE.BufferGeometry();
	const box = new V3(56, 26, 56);
	const pos = new Float32Array(count * 3), rnd = new Float32Array(count * 3);
	for (let i = 0; i < count; i++) {
		pos[i * 3] = Math.random() * box.x; pos[i * 3 + 1] = Math.random() * box.y; pos[i * 3 + 2] = Math.random() * box.z;
		rnd[i * 3] = Math.random(); rnd[i * 3 + 1] = Math.random(); rnd[i * 3 + 2] = Math.random();
	}
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 3));
	const mat = new THREE.ShaderMaterial({
		uniforms: {
			uTime: U.time, uCam: { value: new V3() }, uBox: { value: box }, uScale: { value: 800 }, uDensity: { value: 1 },
			uWind: { value: new V3(0.35, 0, 0.15) }, uRVmin: { value: motor.snowBox.min }, uRVmax: { value: motor.snowBox.max },
			uPorch: { value: motor.porch.pos }, uPorchDir: { value: motor.porch.target.clone().sub(motor.porch.pos).normalize() },
			uFog: { value: SKY.horizon }, uFogD: { value: 0.02 }, uAmb: { value: new THREE.Color(0x56627a) },
		},
		vertexShader: /* glsl */`
			attribute vec3 aRnd;
			uniform float uTime, uScale, uDensity, uFogD; uniform vec3 uCam, uBox, uWind, uRVmin, uRVmax, uPorch, uPorchDir, uAmb;
			varying vec3 vCol; varying float vA;
			void main(){
				vec3 p = position;
				float sp = 0.55 + aRnd.x * 0.55;
				p.y -= uTime * sp;
				p.x += uTime * uWind.x + sin(uTime * (0.4 + aRnd.y * 0.6) + aRnd.z * 6.28) * 0.45;
				p.z += uTime * uWind.z + cos(uTime * (0.35 + aRnd.x * 0.5) + aRnd.y * 6.28) * 0.45;
				vec3 o = uCam - uBox * 0.5;
				p = o + mod(p - o, uBox);
				bool hide = aRnd.z > uDensity || (all(greaterThan(p, uRVmin)) && all(lessThan(p, uRVmax)));
				vec3 L = p - uPorch; float d = length(L);
				float cone = smoothstep(0.35, 0.8, dot(L / d, uPorchDir));
				vec3 col = uAmb * 1.1;
				col += vec3(1.0, 0.68, 0.38) * cone * 9.0 / (0.6 + d * d);
				vec3 q = max(max(uRVmin - p, p - uRVmax), 0.0);
				float bd = length(q);
				float band = smoothstep(-0.2, 0.8, p.y) * smoothstep(2.4, 1.6, p.y);
				col += vec3(1.0, 0.6, 0.3) * 0.9 * exp(-bd * 1.3) * band;
				vec4 mv = modelViewMatrix * vec4(p, 1.0);
				float dist = -mv.z;
				float fogF = 1.0 - exp(-uFogD * uFogD * dist * dist);
				vA = (1.0 - fogF * 0.85) * smoothstep(0.12, 0.7, dist) * (0.55 + aRnd.y * 0.45);
				vCol = col;
				gl_Position = hide ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
				gl_PointSize = hide ? 0.0 : clamp((0.011 + aRnd.y * 0.013) * uScale / dist, 1.0, 48.0);
			}`,
		fragmentShader: /* glsl */`
			varying vec3 vCol; varying float vA;
			void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.12, d); gl_FragColor = vec4(vCol, a * vA); }`,
		transparent: true, depthWrite: false,
	});
	const pts = new THREE.Points(g, mat);
	pts.frustumCulled = false;
	pts.layers.set(1);
	pts.renderOrder = 1;
	return pts;
}
