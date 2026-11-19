// Two ways to move: a free orbit camera with damping, smooth flights and terrain clearance,
// and a first-person walker with gravity, jumping, slope limits and collisions against the
// terrain, the cabin, rocks and trees. Also: boot prints left in the snow.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { U, GLSL_NOISE } from './shading.js';
import { FINE } from './world.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---------------------------------------------------------------- free camera
export class FreeCam {
	constructor(camera, dom, hf, cabin) {
		this.camera = camera; this.hf = hf; this.cabin = cabin;
		this.c = new OrbitControls(camera, dom);
		this.c.enableDamping = true;
		this.c.dampingFactor = 0.075;
		this.c.screenSpacePanning = false;
		this.c.maxDistance = 9000;
		this.c.minDistance = 0.3;
		this.c.maxPolarAngle = Math.PI * 0.94;
		this.c.zoomToCursor = true;
		this.speed = 1;
		this.flight = null;
	}
	set enabled(v) { this.c.enabled = v; }
	setSpeed(s) {
		this.speed = s;
		this.c.rotateSpeed = 0.55 * s; this.c.zoomSpeed = 0.9 * s; this.c.panSpeed = 0.8 * s;
	}
	flyTo(pos, target, dur = 2.6) {
		const from = this.camera.position.clone(), fromT = this.c.target.clone();
		const dist = from.distanceTo(pos);
		this.flight = { from, fromT, pos: pos.clone(), target: target.clone(), t: 0, dur: Math.max(1.2, Math.min(dur, 1.2 + dist / 400)), arc: Math.min(400, dist * 0.18) };
	}
	update(dt) {
		const cam = this.camera;
		if (this.flight) {
			const f = this.flight;
			f.t += dt / f.dur;
			const k = ease(Math.min(1, f.t));
			cam.position.lerpVectors(f.from, f.pos, k);
			cam.position.y += Math.sin(k * Math.PI) * f.arc;
			this.c.target.lerpVectors(f.fromT, f.target, k);
			cam.lookAt(this.c.target);
			if (f.t >= 1) { this.flight = null; this.c.update(); }
		} else {
			this.c.update();
		}
		// stay above the ground
		const g = this.hf.height(cam.position.x, cam.position.z);
		const inside = this.cabin && this.cabin.inside(this.c.target) && cam.position.distanceTo(this.c.target) < 7;
		if (!inside && cam.position.y < g + 1.4) cam.position.y = g + 1.4;
		// inside the cabin, keep the camera inside the walls
		if (inside) {
			const l = cam.position.clone().applyMatrix4(this.cabin.inv);
			const W = 4.45, D = 3.15;
			l.x = THREE.MathUtils.clamp(l.x, -W, W); l.z = THREE.MathUtils.clamp(l.z, -D, D); l.y = THREE.MathUtils.clamp(l.y, 0.3, 4.6);
			cam.position.copy(l.applyMatrix4(this.cabin.group.matrixWorld));
		}
	}
}

// ---------------------------------------------------------------- walker
export class Walker {
	constructor(camera, dom, hf, world) {
		this.camera = camera; this.dom = dom; this.hf = hf; this.world = world;
		this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
		this.yaw = 0; this.pitch = 0;
		this.onGround = true;
		this.eye = 1.62; this.radius = 0.3; this.step = 0.42;
		this.keys = new Set();
		this.joy = new THREE.Vector2();
		this.sprintBtn = false;
		this.jumpReq = false;
		this.enabled = false;
		this.bob = 0; this.stepDist = 0; this.side = 1;
		this.sens = 1;
		this.surface = 'snow';
		this._n = { x: 0, y: 1, z: 0 };
		this.onStep = null;
		this.locked = false;
		this.look = null;
		addEventListener('keydown', (e) => {
			if (!this.enabled || e.target.closest?.('input,select,textarea')) return;
			this.keys.add(e.code);
			if (e.code === 'Space') { this.jumpReq = true; e.preventDefault(); }
		});
		addEventListener('keyup', (e) => this.keys.delete(e.code));
		addEventListener('blur', () => this.keys.clear());
		document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === dom; this.onLock?.(this.locked); });
		document.addEventListener('mousemove', (e) => {
			if (!this.enabled || !this.locked) return;
			this.turn(e.movementX * 0.0022, e.movementY * 0.0022);
		});
		// touch / mouse drag look (no pointer lock)
		let drag = null;
		dom.addEventListener('pointerdown', (e) => {
			if (!this.enabled) return;
			if (e.pointerType === 'mouse' && !this.locked && !this.noLock) { dom.requestPointerLock?.(); return; }
			if (e.pointerType !== 'mouse' || this.noLock) { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; dom.setPointerCapture?.(e.pointerId); }
		});
		dom.addEventListener('pointermove', (e) => {
			if (!drag || e.pointerId !== drag.id) return;
			this.turn((e.clientX - drag.x) * 0.0042, (e.clientY - drag.y) * 0.0042);
			drag.x = e.clientX; drag.y = e.clientY;
		});
		const end = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
		dom.addEventListener('pointerup', end); dom.addEventListener('pointercancel', end);
	}
	turn(dx, dy) {
		if (this.look) return;
		this.yaw -= dx * this.sens;
		this.pitch = THREE.MathUtils.clamp(this.pitch - dy * this.sens, -1.45, 1.45);
	}
	place(x, z, yaw = this.yaw, y = null) {
		const g = this.groundAt(x, z, y ?? 1e9, true);
		this.pos.set(x, g, z);
		this.vel.set(0, 0, 0);
		this.yaw = yaw; this.pitch = -0.05;
		this.onGround = true;
	}
	// highest standable surface under (x, z) not above feet + step
	groundAt(x, z, feet, any = false) {
		let g = this.hf.height(x, z);
		this.surface = this.hf.pathMask(x, z) > 0.4 ? 'path' : 'snow';
		const n = this.hf.normal(x, z, this._n);
		if (n.y < 0.72 && this.surface === 'snow') this.surface = 'rock';
		for (const f of this.world.floors) {
			const c = Math.cos(f.rot), s = Math.sin(f.rot);
			const dx = x - f.x, dz = z - f.z;
			const lx = dx * c - dz * s, lz = dx * s + dz * c;
			if (Math.abs(lx) <= f.hx + 0.05 && Math.abs(lz) <= f.hz + 0.05 && f.top > g && (any || f.top <= feet + this.step)) { g = f.top; this.surface = 'wood'; }
		}
		return g;
	}
	collide() {
		const p = this.pos, r = this.radius;
		const feet = p.y + this.step, head = p.y + 1.75;
		for (const c of this.world.colliders) {
			if (c.disabled || c.y1 < feet || c.y0 > head) continue;
			const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
			const dx = p.x - c.x, dz = p.z - c.z;
			// into the box's frame (inverse rotation about Y)
			const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
			const qx = THREE.MathUtils.clamp(lx, -c.hx, c.hx), qz = THREE.MathUtils.clamp(lz, -c.hz, c.hz);
			let ox = lx - qx, oz = lz - qz;
			const d2 = ox * ox + oz * oz;
			if (d2 >= r * r) continue;
			let nx, nz, push;
			if (d2 > 1e-8) { const d = Math.sqrt(d2); nx = ox / d; nz = oz / d; push = r - d; } else {
				// centre inside the box: leave by the nearest face
				const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz);
				if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; push = px + r; } else { nx = 0; nz = Math.sign(lz) || 1; push = pz + r; }
			}
			// back to world
			const wx = nx * cs + nz * sn, wz = -nx * sn + nz * cs;
			p.x += wx * push; p.z += wz * push;
			const vn = this.vel.x * wx + this.vel.z * wz;
			if (vn < 0) { this.vel.x -= wx * vn; this.vel.z -= wz * vn; }
		}
		// raised floors you cannot step onto are walls too
		for (const f of this.world.floors) {
			if (f.top <= p.y + this.step || f.top - 1.2 > head) continue;
			const cs = Math.cos(f.rot), sn = Math.sin(f.rot);
			const dx = p.x - f.x, dz = p.z - f.z;
			const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
			const qx = THREE.MathUtils.clamp(lx, -f.hx, f.hx), qz = THREE.MathUtils.clamp(lz, -f.hz, f.hz);
			const ox = lx - qx, oz = lz - qz, d2 = ox * ox + oz * oz;
			if (d2 >= r * r || d2 < 1e-8) continue;
			const d = Math.sqrt(d2), nx = ox / d, nz = oz / d;
			const wx = nx * cs + nz * sn, wz = -nx * sn + nz * cs;
			p.x += wx * (r - d); p.z += wz * (r - d);
		}
		for (const c of this.world.circles) {
			if (c.top !== undefined && c.top < feet) continue;
			const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + r;
			const d2 = dx * dx + dz * dz;
			if (d2 >= rr * rr) continue;
			const d = Math.sqrt(d2) || 1e-4;
			p.x = c.x + (dx / d) * rr; p.z = c.z + (dz / d) * rr;
		}
		// stay inside the explorable massif
		const m = 140;
		p.x = THREE.MathUtils.clamp(p.x, FINE.x0 + m, FINE.x0 + FINE.size - m);
		p.z = THREE.MathUtils.clamp(p.z, FINE.z0 + m, FINE.z0 + FINE.size - m);
	}
	update(dt) {
		if (!this.enabled) return;
		const k = this.keys;
		let fx = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
		let sx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
		fx += -this.joy.y; sx += this.joy.x;
		const mag = Math.min(1, Math.hypot(fx, sx));
		if (this.look) { fx = 0; sx = 0; }
		const sprint = k.has('ShiftLeft') || k.has('ShiftRight') || this.sprintBtn;
		const indoors = this.surface === 'wood';
		const speed = (indoors ? (sprint ? 3.2 : 1.9) : (sprint ? 7.5 : 3.2)) * mag;
		const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
		const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
		const want = new THREE.Vector3().addScaledVector(fwd, fx).addScaledVector(right, sx);
		if (want.lengthSq() > 0) want.normalize().multiplyScalar(speed);
		// slopes: slow down climbing, refuse walls of snow and rock
		const n = this.hf.normal(this.pos.x, this.pos.z, this._n);
		if (this.surface !== 'wood' && want.lengthSq() > 0) {
			const up = -(n.x * want.x + n.z * want.z) / (want.length() || 1);
			const slope = Math.acos(Math.min(1, n.y));
			if (up > 0) {
				const steep = THREE.MathUtils.smoothstep(slope, 0.62, 0.74);
				want.multiplyScalar(1 - Math.min(0.55, up * 0.6) - steep * 0.95);
			}
		}
		const acc = this.onGround ? 12 : 2.5;
		this.vel.x += (want.x - this.vel.x) * Math.min(1, acc * dt);
		this.vel.z += (want.z - this.vel.z) * Math.min(1, acc * dt);
		if (this.jumpReq && this.onGround) { this.vel.y = 5.0; this.onGround = false; }
		this.jumpReq = false;
		this.vel.y -= 18 * dt;
		// integrate in small steps so fast movement never tunnels through thin walls
		const steps = Math.ceil(Math.max(1, (Math.hypot(this.vel.x, this.vel.z) * dt) / 0.12));
		const h = dt / steps;
		for (let i = 0; i < steps; i++) {
			const ox = this.pos.x, oz = this.pos.z;
			this.pos.x += this.vel.x * h; this.pos.z += this.vel.z * h; this.pos.y += this.vel.y * h;
			this.collide();
			const g = this.groundAt(this.pos.x, this.pos.z, this.pos.y);
			if (this.pos.y <= g + 0.02 || (this.onGround && this.pos.y - g < this.step && this.vel.y <= 0)) {
				// on very steep terrain slide back down instead of standing
				const nn = this.hf.normal(this.pos.x, this.pos.z, this._n);
				if (this.surface !== 'wood' && nn.y < 0.62 && g > this.pos.y + 0.05) { this.pos.x = ox; this.pos.z = oz; }
				this.pos.y = Math.max(g, Math.min(this.pos.y, g));
				this.pos.y = this.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.1);
				if (this.vel.y < 0) this.vel.y = 0;
				this.onGround = true;
			} else this.onGround = false;
		}
		// footsteps and head bob
		const hs = Math.hypot(this.vel.x, this.vel.z);
		if (this.onGround && hs > 0.3) {
			this.stepDist += hs * dt;
			this.bob += hs * dt * 2.1;
			const stride = sprint ? 1.05 : 0.72;
			if (this.stepDist > stride) {
				this.stepDist = 0; this.side = -this.side;
				this.onStep?.(this.surface, this.side, hs);
			}
		}
		const cam = this.camera;
		const bobY = Math.sin(this.bob * 2) * 0.035 * Math.min(1, hs / 3), bobX = Math.cos(this.bob) * 0.02 * Math.min(1, hs / 3);
		if (this.look) {
			cam.position.lerp(this.look.pos, Math.min(1, dt * 3));
			const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(cam.position, this.look.target, cam.up));
			cam.quaternion.slerp(q, Math.min(1, dt * 3));
		} else {
			cam.position.set(this.pos.x + right.x * bobX, this.pos.y + this.eye + bobY, this.pos.z + right.z * bobX);
			cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
		}
	}
}

// ---------------------------------------------------------------- boot prints
export class Footprints {
	constructor(hf, max = 420) {
		this.hf = hf; this.max = max; this.i = 0;
		const g = new THREE.PlaneGeometry(0.16, 0.34);
		g.rotateX(-Math.PI / 2);
		this.birth = new Float32Array(max).fill(-1e4);
		this.side = new Float32Array(max);
		g.setAttribute('aBirth', new THREE.InstancedBufferAttribute(this.birth, 1));
		g.setAttribute('aSide', new THREE.InstancedBufferAttribute(this.side, 1));
		this.mat = new THREE.MeshStandardMaterial({ color: 0xc9d6e6, roughness: 0.95, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
		this.life = { value: 120 };
		this.mat.onBeforeCompile = (sh) => {
			sh.uniforms.uTime = U.uTime; sh.uniforms.uLife = this.life; sh.uniforms.tNoise = U.tNoise;
			sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aBirth; attribute float aSide; varying float vAge; varying vec2 vFp; varying float vSide; uniform float uTime;')
				.replace('#include <begin_vertex>', '#include <begin_vertex>\nvAge = uTime - aBirth; vFp = position.xz / vec2(0.16, 0.34); vSide = aSide;');
			sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
				varying float vAge; varying vec2 vFp; varying float vSide; uniform float uLife; uniform sampler2D tNoise;
				${GLSL_NOISE}`)
				.replace('#include <alphamap_fragment>', `
					vec2 f = vFp; f.x *= vSide;
					// sole: a rounded toe box and a heel, with lug tread
					float toe = length((f - vec2(0.02, -0.18)) / vec2(0.46, 0.34));
					float heel = length((f - vec2(-0.02, 0.26)) / vec2(0.38, 0.22));
					float sole = 1.0 - smoothstep(0.85, 1.0, min(toe, heel));
					float tread = step(0.5, fract(f.y * 9.0 + step(0.0, f.x) * 0.5)) * 0.35 + 0.65;
					float n = tnoise(f * 0.6 + vSide);
					float fade = 1.0 - smoothstep(uLife * 0.5, uLife, vAge);
					diffuseColor.a = sole * (0.55 + 0.25 * tread) * fade * (0.8 + 0.4 * n);
					diffuseColor.rgb *= 0.78 + 0.22 * tread;
				`);
		};
		this.mesh = new THREE.InstancedMesh(g, this.mat, max);
		this.mesh.frustumCulled = false;
		this.mesh.renderOrder = 1;
		const m = new THREE.Matrix4().makeScale(0, 0, 0);
		for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, m);
		this._q = new THREE.Quaternion(); this._m = new THREE.Matrix4(); this._n = { x: 0, y: 1, z: 0 };
	}
	add(x, z, yaw, side, time) {
		const n = this.hf.normal(x, z, this._n);
		const y = this.hf.height(x, z) + 0.03;
		const up = new THREE.Vector3(n.x, n.y, n.z);
		const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
		const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
		q.multiply(qy);
		this._m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
		const i = this.i;
		this.mesh.setMatrixAt(i, this._m);
		this.birth[i] = time; this.side[i] = side;
		this.mesh.geometry.attributes.aBirth.needsUpdate = true;
		this.mesh.geometry.attributes.aSide.needsUpdate = true;
		this.mesh.instanceMatrix.needsUpdate = true;
		this.i = (i + 1) % this.max;
	}
}
