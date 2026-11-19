// Camera rig: orbit / pan / zoom with collision, double-click focus, first-person walk,
// smooth fly-to transitions (through the door when changing inside <-> outside) and a cinematic tour.
import * as THREE from 'three';

const V3 = THREE.Vector3;
const PI = Math.PI;
const clamp = THREE.MathUtils.clamp;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeSine = (t) => -(Math.cos(PI * t) - 1) / 2;

function sph(yaw, pitch, out = new V3()) {
	const c = Math.cos(pitch);
	return out.set(c * Math.sin(yaw), Math.sin(pitch), c * Math.cos(yaw));
}

function rayBox(o, d, b) {
	let tmin = -Infinity, tmax = Infinity;
	for (const k of ['x', 'y', 'z']) {
		if (Math.abs(d[k]) < 1e-9) {
			if (o[k] < b.min[k] || o[k] > b.max[k]) return [Infinity, -Infinity];
		} else {
			let t1 = (b.min[k] - o[k]) / d[k], t2 = (b.max[k] - o[k]) / d[k];
			if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
			tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
		}
	}
	return [tmin, tmax];
}

const LIMITS = {
	interior: { min: 0.22, max: 4.6, pMin: -1.3, pMax: 1.4 },
	exterior: { min: 2.0, max: 34, pMin: -0.25, pMax: 1.42 },
};

export class Rig {
	constructor(camera, dom, world) {
		this.cam = camera; this.dom = dom; this.w = world;
		this.mode = 'orbit'; this.space = 'interior';
		this.target = new V3(); this.gTarget = new V3();
		this.yaw = 0; this.gYaw = 0; this.pitch = 0.3; this.gPitch = 0.3;
		this.dist = 2; this.gDist = 2; this.eff = 2;
		this.pos = new V3(); this.vel = new V3();
		this.fov = camera.fov; this.gFov = camera.fov;
		this.speed = 1;
		this.move = { x: 0, y: 0, up: 0 };
		this.keys = new Set();
		this.pointers = new Map();
		this.anim = null;
		this.lastTap = null;
		this.listeners = {};
		this.margin = 0.14;
		this.inner = world.interiorBox.clone().expandByScalar(-this.margin);
		this.body = world.bodyBox.clone().expandByScalar(this.margin);
		this.colliders = world.colliders.map((b) => b.clone().expandByScalar(0.08));
		this.walkColliders = world.colliders.filter((b) => b.min.y < 1.1 && b.max.y > 0.2);
		this._bind();
	}

	on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
	emit(ev, ...a) { for (const f of this.listeners[ev] || []) f(...a); }

	// ---------------------------------------------------------------- input
	_bind() {
		const d = this.dom;
		d.addEventListener('contextmenu', (e) => e.preventDefault());
		d.addEventListener('pointerdown', (e) => {
			try { d.setPointerCapture(e.pointerId); } catch { /* pointer already released */ }
			this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, type: e.pointerType, t0: performance.now(), x0: e.clientX, y0: e.clientY, moved: 0 });
			this._input();
		});
		d.addEventListener('pointermove', (e) => {
			const p = this.pointers.get(e.pointerId);
			if (!p) return;
			const dx = e.clientX - p.x, dy = e.clientY - p.y;
			if (this.pointers.size === 2) {
				const [a, b] = [...this.pointers.values()];
				const d0 = Math.hypot(a.x - b.x, a.y - b.y), m0x = (a.x + b.x) / 2, m0y = (a.y + b.y) / 2;
				p.x = e.clientX; p.y = e.clientY;
				const d1 = Math.hypot(a.x - b.x, a.y - b.y), m1x = (a.x + b.x) / 2, m1y = (a.y + b.y) / 2;
				if (d0 > 0 && d1 > 0) this._zoom(d0 / d1, true);
				this._pan(m1x - m0x, m1y - m0y);
				return;
			}
			p.x = e.clientX; p.y = e.clientY; p.moved += Math.abs(dx) + Math.abs(dy);
			const panBtn = p.type === 'mouse' && (p.b === 2 || p.b === 1 || e.shiftKey || e.ctrlKey);
			if (panBtn) this._pan(dx, dy); else this._rotate(dx, dy);
		});
		const up = (e) => {
			const p = this.pointers.get(e.pointerId);
			this.pointers.delete(e.pointerId);
			if (p && p.type !== 'mouse' && p.moved < 12 && performance.now() - p.t0 < 280 && this.pointers.size === 0) {
				const now = performance.now();
				if (this.lastTap && now - this.lastTap.t < 320 && Math.hypot(e.clientX - this.lastTap.x, e.clientY - this.lastTap.y) < 36) {
					this.emit('pick', e.clientX, e.clientY); this.lastTap = null;
				} else this.lastTap = { t: now, x: e.clientX, y: e.clientY };
			}
		};
		d.addEventListener('pointerup', up);
		d.addEventListener('pointercancel', up);
		d.addEventListener('dblclick', (e) => { this.emit('pick', e.clientX, e.clientY); });
		d.addEventListener('wheel', (e) => {
			e.preventDefault();
			this._input();
			let dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
			dy = clamp(dy, -120, 120);
			this._zoom(Math.exp(dy * 0.0014 * this.speed), false);
		}, { passive: false });
		window.addEventListener('keydown', (e) => {
			if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
			const k = e.key.toLowerCase();
			if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
				this.keys.add(k); this._input();
				if (k.startsWith('arrow')) e.preventDefault();
			}
		});
		window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
		window.addEventListener('blur', () => this.keys.clear());
	}

	bindJoystick(el, knob) {
		let id = null, cx = 0, cy = 0;
		const R = 46;
		const set = (x, y) => {
			let dx = x - cx, dy = y - cy; const l = Math.hypot(dx, dy);
			if (l > R) { dx *= R / l; dy *= R / l; }
			knob.style.transform = `translate(${dx}px, ${dy}px)`;
			this.move.x = dx / R; this.move.y = -dy / R;
		};
		el.addEventListener('pointerdown', (e) => {
			e.stopPropagation(); id = e.pointerId; try { el.setPointerCapture(id); } catch { /* ignore */ }
			const r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
			set(e.clientX, e.clientY); this._input();
		});
		el.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e.clientX, e.clientY); });
		const end = (e) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; this.move.x = 0; this.move.y = 0; };
		el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
	}

	_input() {
		if (this.anim && this.anim.kind === 'tour') this.stopTour();
		this.emit('input');
	}

	_rotate(dx, dy) {
		if (this.anim) return;
		const k = (2 * PI / Math.max(400, this.dom.clientHeight)) * 0.85 * this.speed;
		const L = LIMITS[this.space];
		if (this.mode === 'orbit') {
			this.gYaw -= dx * k;
			this.gPitch = clamp(this.gPitch + dy * k, L.pMin, L.pMax);
		} else {
			this.gYaw += dx * k * 0.75;
			this.gPitch = clamp(this.gPitch - dy * k * 0.75, -1.35, 1.35);
		}
	}

	_pan(dx, dy) {
		if (this.anim) return;
		if (this.mode === 'walk') { this._rotate(dx, dy); return; }
		const h = Math.max(300, this.dom.clientHeight);
		const upp = 2 * this.eff * Math.tan(THREE.MathUtils.degToRad(this.cam.fov) / 2) / h * this.speed;
		const e = this.cam.matrixWorld.elements;
		const right = new V3(e[0], e[1], e[2]), up = new V3(e[4], e[5], e[6]);
		this.gTarget.addScaledVector(right, -dx * upp).addScaledVector(up, dy * upp);
		this._clampTarget(this.gTarget);
	}

	_zoom(f, pinch) {
		if (this.anim) return;
		if (this.mode === 'walk') { this.gFov = clamp(this.gFov * Math.pow(f, pinch ? 1 : 0.6), 28, 80); return; }
		const L = LIMITS[this.space];
		let nd = this.gDist * f;
		if (nd < L.min) {
			// keep moving forward: push the pivot along the view direction
			const fwd = sph(this.yaw, this.pitch).negate();
			const next = this.gTarget.clone().addScaledVector(fwd, (L.min - nd) * 1.4);
			const blocked = this.space === 'exterior' && (this.body.containsPoint(this.gTarget) || this.body.containsPoint(next));
			if (!blocked) { this.gTarget.copy(next); this._clampTarget(this.gTarget); }
			nd = L.min;
		}
		this.gDist = clamp(nd, L.min, L.max);
	}

	_clampTarget(t) {
		if (this.space === 'interior') {
			t.x = clamp(t.x, this.w.interiorBox.min.x + 0.05, this.w.interiorBox.max.x - 0.2);
			t.y = clamp(t.y, 0.08, this.w.interiorBox.max.y - 0.05);
			t.z = clamp(t.z, this.w.interiorBox.min.z + 0.03, this.w.interiorBox.max.z - 0.03);
		} else {
			const r = Math.hypot(t.x, t.z);
			if (r > 40) { t.x *= 40 / r; t.z *= 40 / r; }
			t.y = clamp(t.y, this.w.groundHeight(t.x, t.z) + 0.2, 12);
		}
	}

	// ---------------------------------------------------------------- collision
	_limit(target, dir, dist) {
		let t = dist;
		if (this.space === 'interior') {
			const [, exit] = rayBox(target, dir, this.inner);
			if (exit < t) t = exit;
			// never park the camera inside furniture; tall pieces (walls, cabinets) also block the view
			for (const b of this.colliders) {
				if (b.containsPoint(target)) continue;
				const [tn, tf] = rayBox(target, dir, b);
				if (!(tf >= tn && tn > 0 && tn < t)) continue;
				const tall = b.max.y - b.min.y > 1.3;
				if (tall || t < tf) t = tn;
			}
			return Math.max(0.03, t);
		}
		// exterior: stay outside the body and above the snow
		if (this.body.containsPoint(target)) {
			const [, exit] = rayBox(target, dir, this.body);
			t = Math.max(t, exit + 0.05);
		} else {
			// the body may hide the pivot, but the camera itself never ends up inside it
			const [tn, tf] = rayBox(target, dir, this.body);
			if (tf >= tn && tn > 0 && tn < t && t < tf) t = Math.max(0.5, tn);
		}
		const p = target.clone().addScaledVector(dir, t);
		const g = this.w.groundHeight(p.x, p.z) + 0.3;
		if (p.y < g && dir.y < 0) t = Math.max(0.5, (target.y - g) / -dir.y);
		return t;
	}

	// ---------------------------------------------------------------- state helpers
	look() {
		if (this.mode === 'orbit') return this.target.clone();
		return this.pos.clone().addScaledVector(sph(this.yaw, this.pitch), -1.5);
	}

	setPose(space, mode, pos, look) {
		this.space = space; this.mode = mode;
		const off = new V3().subVectors(pos, look);
		const dist = Math.max(0.05, off.length());
		off.divideScalar(dist);
		this.yaw = this.gYaw = Math.atan2(off.x, off.z);
		this.pitch = this.gPitch = Math.asin(clamp(off.y, -1, 1));
		if (mode === 'orbit') {
			this.target.copy(look); this._clampTarget(this.target); this.gTarget.copy(this.target);
			const L = LIMITS[space];
			this.dist = this.gDist = clamp(dist, L.min, L.max);
			this.eff = this._limit(this.target, sph(this.yaw, this.pitch), this.dist);
		} else {
			this.pos.copy(pos); this.vel.set(0, 0, 0);
		}
		this.emit('space', this.space, this.mode);
	}

	// Snap state from wherever the camera is now (used when a tour is interrupted).
	adoptCamera(space) {
		const fwd = new V3(); this.cam.getWorldDirection(fwd);
		const p = this.cam.position.clone();
		let d = space === 'interior' ? 1.4 : 9;
		const box = space === 'interior' ? this.inner : this.body;
		const [tn, tf] = rayBox(p, fwd, box);
		if (space === 'interior' && tf > 0.3) d = Math.min(d, tf * 0.8);
		if (space === 'exterior' && tf >= tn && tn > 0.5) d = Math.min(d, tn + 0.3);
		const look = p.clone().addScaledVector(fwd, d);
		this.setPose(space, 'orbit', p, look);
		this.eff = this.dist;
	}

	// ---------------------------------------------------------------- animated moves
	goTo(shot, opt = {}) {
		this.anim = null;
		const toPos = new V3(...shot.pos), toLook = new V3(...shot.look);
		const fromPos = this.cam.position.clone(), fromLook = this.look();
		const fromFov = this.cam.fov, toFov = shot.fov ?? 55;
		const dur = opt.dur ?? clamp(0.9 + fromPos.distanceTo(toPos) * 0.18, 1.1, 3.2);
		const finish = () => { this.anim = null; this.setPose(shot.space, shot.mode || 'orbit', toPos, toLook); this.fov = this.gFov = toFov; this.emit('arrive', shot); };
		const fly = (pts, l0, l1, d, f0, f1, onEnd, fade) => ({
			kind: 'fly', t: 0, d,
			curve: new THREE.CatmullRomCurve3(pts, false, 'centripetal'),
			update(dt, rig) {
				this.t = Math.min(1, this.t + dt / this.d);
				const k = ease(this.t);
				rig.cam.position.copy(this.curve.getPoint(k));
				rig.cam.lookAt(new V3().lerpVectors(l0, l1, k));
				rig.cam.fov = THREE.MathUtils.lerp(f0, f1, k);
				if (fade) rig.emit('fade', fade(this.t));
				if (this.t >= 1) onEnd();
			},
		});
		if (shot.space !== this.space && !opt.direct) {
			// go through the door, fading to black at the threshold
			const inside = this.space === 'interior';
			const doorOut = new V3(3.12, 1.25, 3.4), doorIn = new V3(3.1, 1.5, 0.55), door = new V3(3.12, 1.1, 1.27);
			const aEnd = inside ? new V3(3.12, 1.4, 0.75) : doorOut;
			const bStart = inside ? new V3(3.4, 1.5, 3.1) : doorIn;
			const phaseB = () => {
				this.space = shot.space; this.emit('space', this.space, shot.mode || 'orbit');
				const mid = bStart.clone().lerp(toPos, 0.5); mid.y += inside ? 0.6 : 0.1;
				this.anim = fly([bStart, mid, toPos], inside ? new V3(3.1, 1.2, 0.6) : bStart.clone().lerp(toLook, 0.7), toLook, Math.max(1.3, dur * 0.6), toFov, toFov, finish, (t) => 1 - clamp(t / 0.35, 0, 1));
			};
			const mid = fromPos.clone().lerp(aEnd, 0.5);
			this.anim = fly([fromPos, mid, aEnd], fromLook, door, Math.max(1.0, dur * 0.55), fromFov, toFov, phaseB, (t) => clamp((t - 0.5) / 0.45, 0, 1));
			return;
		}
		const pts = [fromPos];
		if (this.space === 'interior') {
			const px = -1.88;
			if ((fromPos.x - px) * (toPos.x - px) < 0) {
				const s = Math.sign(fromPos.x - px);
				pts.push(new V3(px + s * 0.5, 1.35, 0), new V3(px - s * 0.5, 1.3, 0));
			} else {
				const mid = fromPos.clone().lerp(toPos, 0.5);
				mid.y = clamp(mid.y + 0.15, 0.6, 1.85); mid.z *= 0.6;
				pts.push(mid);
			}
		} else {
			const mid = fromPos.clone().lerp(toPos, 0.5);
			mid.y = Math.max(mid.y, Math.min(fromPos.y, toPos.y) + fromPos.distanceTo(toPos) * 0.08);
			pts.push(mid);
		}
		pts.push(toPos);
		this.anim = fly(pts, fromLook, toLook, dur, fromFov, toFov, finish);
	}

	tour(shots) {
		let i = 0;
		const rig = this;
		const start = (k) => {
			const s = shots[k % shots.length];
			rig.space = s.space; rig.emit('space', s.space, 'tour');
			const p0 = new V3(...s.from), p1 = new V3(...s.to), l0 = new V3(...s.lookFrom), l1 = new V3(...(s.lookTo || s.lookFrom));
			rig.anim = {
				kind: 'tour', t: 0, d: s.dur || 8, s,
				update(dt) {
					this.t = Math.min(1, this.t + dt / this.d);
					const k2 = easeSine(this.t);
					rig.cam.position.lerpVectors(p0, p1, k2);
					rig.cam.lookAt(new V3().lerpVectors(l0, l1, k2));
					rig.cam.fov = s.fov || 50;
					const fade = Math.max(1 - clamp(this.t * this.d / 0.9, 0, 1), clamp((this.t * this.d - (this.d - 0.9)) / 0.9, 0, 1));
					rig.emit('fade', fade);
					if (this.t >= 1) { i++; start(i); }
				},
			};
		};
		start(0);
		this.emit('tour', true);
	}

	stopTour() {
		if (!this.anim || this.anim.kind !== 'tour') return;
		const space = this.anim.s.space;
		this.anim = null;
		this.emit('fade', 0);
		this.adoptCamera(space);
		this.fov = this.gFov = this.cam.fov;
		this.emit('tour', false);
	}

	get touring() { return !!(this.anim && this.anim.kind === 'tour'); }

	// ---------------------------------------------------------------- per frame
	update(dt) {
		if (this.anim) {
			this.anim.update(dt, this);
			this.cam.updateProjectionMatrix();
			return;
		}
		const k = 1 - Math.exp(-dt * 9);
		const ks = this.keys;
		const fast = ks.has('shift') ? 2.2 : 1;
		const kx = (ks.has('d') || ks.has('arrowright') ? 1 : 0) - (ks.has('a') || ks.has('arrowleft') ? 1 : 0);
		const ky = (ks.has('w') || ks.has('arrowup') ? 1 : 0) - (ks.has('s') || ks.has('arrowdown') ? 1 : 0);
		const kz = (ks.has('e') ? 1 : 0) - (ks.has('q') ? 1 : 0);
		const mx = clamp(this.move.x + kx, -1, 1), my = clamp(this.move.y + ky, -1, 1);
		const fwd = new V3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
		const right = new V3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

		if (this.mode === 'orbit') {
			if (mx || my || kz) {
				const sp = (this.space === 'interior' ? 1.3 : 6) * this.speed * fast * dt;
				this.gTarget.addScaledVector(fwd, my * sp).addScaledVector(right, mx * sp);
				this.gTarget.y += kz * sp * 0.6;
				this._clampTarget(this.gTarget);
			}
			this.yaw += (this.gYaw - this.yaw) * k;
			this.pitch += (this.gPitch - this.pitch) * k;
			this.dist += (this.gDist - this.dist) * k;
			this.target.lerp(this.gTarget, k);
			const dir = sph(this.yaw, this.pitch);
			const lim = this._limit(this.target, dir, this.dist);
			if (lim < this.eff) this.eff = lim; else this.eff += (lim - this.eff) * (1 - Math.exp(-dt * 5));
			this.cam.position.copy(this.target).addScaledVector(dir, this.eff);
			this.cam.lookAt(this.target);
		} else {
			const sp = (this.space === 'interior' ? 1.25 : 2.6) * this.speed * fast;
			const want = new V3().addScaledVector(fwd, my * sp).addScaledVector(right, mx * sp);
			this.vel.lerp(want, 1 - Math.exp(-dt * 8));
			const next = this.pos.clone().addScaledVector(this.vel, dt);
			this._walkCollide(next);
			this.pos.copy(next);
			const eye = this.space === 'interior' ? (this.pos.y < 1.3 ? this.pos.y : 1.62) : this.w.groundHeight(this.pos.x, this.pos.z) + 1.65;
			if (this.space === 'interior' && this.vel.lengthSq() > 0.01) this.pos.y += (1.62 - this.pos.y) * (1 - Math.exp(-dt * 3));
			else this.pos.y += (eye - this.pos.y) * (1 - Math.exp(-dt * 6));
			this.yaw += (this.gYaw - this.yaw) * k;
			this.pitch += (this.gPitch - this.pitch) * k;
			this.cam.position.copy(this.pos);
			this.cam.lookAt(this.pos.clone().addScaledVector(sph(this.yaw, this.pitch), -1));
		}
		this.fov += (this.gFov - this.fov) * k;
		if (Math.abs(this.cam.fov - this.fov) > 0.01) { this.cam.fov = this.fov; }
		this.cam.updateProjectionMatrix();
	}

	_walkCollide(p) {
		const r = 0.24;
		if (this.space === 'interior') {
			const b = this.w.interiorBox;
			p.x = clamp(p.x, b.min.x + r, 4.15); p.z = clamp(p.z, b.min.z + r, b.max.z - r);
			for (let it = 0; it < 2; it++) {
				for (const c of this.walkColliders) {
					const cx = clamp(p.x, c.min.x, c.max.x), cz = clamp(p.z, c.min.z, c.max.z);
					const dx = p.x - cx, dz = p.z - cz; const d = Math.hypot(dx, dz);
					if (d < r) {
						if (d > 1e-5) { p.x = cx + dx / d * r; p.z = cz + dz / d * r; }
						else {
							const pen = [p.x - c.min.x, c.max.x - p.x, p.z - c.min.z, c.max.z - p.z];
							const i = pen.indexOf(Math.min(...pen));
							if (i === 0) p.x = c.min.x - r; else if (i === 1) p.x = c.max.x + r; else if (i === 2) p.z = c.min.z - r; else p.z = c.max.z + r;
						}
					}
				}
			}
		} else {
			const b = this.w.bodyBox;
			const cx = clamp(p.x, b.min.x, b.max.x), cz = clamp(p.z, b.min.z, b.max.z);
			const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
			if (d < r) { if (d > 1e-5) { p.x = cx + dx / d * r; p.z = cz + dz / d * r; } else p.z = b.max.z + r; }
			for (const t of this.w.trunks) {
				const ex = p.x - t.x, ez = p.z - t.z, dd = Math.hypot(ex, ez), rr = t.r + r;
				if (dd < rr && dd > 1e-5) { p.x = t.x + ex / dd * rr; p.z = t.z + ez / dd * rr; }
			}
			for (const c of this.w.extColliders) {
				const qx = clamp(p.x, c.x - c.hw, c.x + c.hw), qz = clamp(p.z, c.z - c.hd, c.z + c.hd);
				const ex = p.x - qx, ez = p.z - qz, dd = Math.hypot(ex, ez);
				if (dd < r && dd > 1e-5) { p.x = qx + ex / dd * r; p.z = qz + ez / dd * r; }
			}
			const rr = Math.hypot(p.x, p.z);
			if (rr > 60) { p.x *= 60 / rr; p.z *= 60 / rr; }
		}
	}
}
