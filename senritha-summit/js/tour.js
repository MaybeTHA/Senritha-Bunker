// Cinematic tour: seven shots across sunrise, afternoon and the aurora night. The camera follows
// smooth spline paths; everything is a pure function of tour time, so the same tour plays live
// in the game and renders frame by frame for the showcase video.
import * as THREE from 'three';

const FADE = 0.55;
const easeIO = (t) => t * t * (3 - 2 * t);

export class Tour {
	constructor(ctx) {
		// ctx: { hf, cabin, camera, setPreset(name), setWind(mode), fadeEl, titleEl, t(key) }
		this.ctx = ctx;
		this.shots = this.build();
		this.total = this.shots.reduce((a, s) => a + s.dur, 0);
		this.time = 0; this.active = false; this.index = -1;
	}

	build() {
		const { hf, cabin } = this.ctx;
		const V = (x, y, z) => new THREE.Vector3(x, y, z);
		const S = hf.summit, C = hf.camp;
		const toS = V(S.x - C.x, 0, S.z - C.z).normalize();
		const side = V(-toS.z, 0, toS.x);
		const cw = (x, y, z) => cabin.toWorld(x, y, z);
		const R = hf.route;
		const rp = (i, up = 0, off = 0) => { const p = R[Math.min(R.length - 1, i)], q = R[Math.min(R.length - 1, i + 2)]; const tx = q.x - p.x, tz = q.z - p.z, l = Math.hypot(tx, tz) || 1; return V(p.x - (tz / l) * off, p.y + up, p.z + (tx / l) * off); };
		const n = R.length;
		const sp = V(S.x, S.y, S.z);
		const orbit = (r, h, a) => V(S.x + Math.cos(a) * r, S.y + h, S.z + Math.sin(a) * r);
		return [
			{ // 1: dawn over the range, the horn catching first light
				dur: 7, time: 'morning', wind: 'light', fov: 50, title: 'title', clamp: 20,
				pos: [V(2600, 900, 3100), V(1900, 700, 2300), V(1250, 520, 1650)],
				look: [V(0, 280, 0), V(0, 300, 0), V(60, 320, 60)],
			},
			{ // 2: low past the cabin, smoke drifting, toward the summit
				dur: 6.5, time: 'morning', wind: 'light', fov: 48, clamp: 1.2,
				pos: [cw(17, 3.2, -7), cw(15, 3.6, 5), cw(10, 4.4, 15)],
				look: [cw(0, 2, 0), cw(-1, 2.8, 2.5), cw(-3, 5, 9)],
			},
			{ // 3: along the trail, poles leading up the ridge
				dur: 6.5, time: 'afternoon', wind: 'light', fov: 52, clamp: 8,
				pos: [rp(Math.floor(n * 0.3), 22, -38), rp(Math.floor(n * 0.42), 28, -42), rp(Math.floor(n * 0.54), 36, -46)],
				look: [rp(Math.floor(n * 0.45), 0), rp(Math.floor(n * 0.62), 10), sp.clone().add(V(0, -20, 0))],
			},
			{ // 4: the summit in a gale, orbiting the flag
				dur: 7, time: 'afternoon', wind: 'strong', fov: 45, clamp: 1.5,
				pos: [orbit(19, 7, 0.9), orbit(16, 6, 1.6), orbit(13, 5.5, 2.3), orbit(12, 5, 2.9)],
				look: [sp.clone().add(V(0, 4, 0)), sp.clone().add(V(0, 4.5, 0)), sp.clone().add(V(0, 5, 0)), sp.clone().add(V(0, 5, 0))],
			},
			{ // 5: night, aurora over the summit from the deck
				dur: 6.5, time: 'night', wind: 'light', fov: 52, clamp: 1.2,
				pos: [cw(-3.5, 7, 3), cw(-1.5, 8.5, 6), cw(0.5, 10, 9)],
				look: [sp.clone().add(V(0, 70, 0)), sp.clone().add(V(0, 60, 0)), sp.clone().add(V(0, 50, 0))],
			},
			{ // 6: inside, from the bed past the fire to the glass wall
				dur: 6, time: 'night', wind: 'light', fov: 58, interior: true,
				pos: [cw(-1.4, 1.35, -1.6), cw(-0.6, 1.45, -0.4), cw(0.4, 1.55, 0.8)],
				look: [cw(-3.4, 1.0, 0.9), cw(-2.2, 1.3, 3.5), cw(0.2, 1.8, 8)],
			},
			{ // 7: rising away from the warm windows into the aurora night
				dur: 5.5, time: 'night', wind: 'light', fov: 50, title: 'end', clamp: 2,
				pos: [cw(2, 3, 14), cw(6, 14, 30), cw(12, 60, 70)],
				look: [cw(0, 2, 0), cw(0, 8, 20), sp.clone().add(V(0, 150, 0))],
			},
		].map((s) => {
			s.posCurve = new THREE.CatmullRomCurve3(s.pos, false, 'centripetal');
			s.lookCurve = new THREE.CatmullRomCurve3(s.look, false, 'centripetal');
			void side;
			return s;
		});
	}

	start() {
		this.active = true; this.time = 0; this.index = -1;
		this.ctx.titleEl.hidden = false;
		document.body.classList.add('touring');
	}
	stop() {
		this.active = false;
		this.ctx.fadeEl.style.opacity = '';
		this.ctx.titleEl.hidden = true;
		document.body.classList.remove('touring');
	}

	// advance by dt and place the camera; returns false when the tour has ended (loop = restart)
	update(dt, loop = true) {
		if (!this.active) return false;
		this.time += dt;
		if (this.time >= this.total) {
			if (!loop) { this.time = this.total - 1e-3; } else { this.time %= this.total; this.index = -1; }
		}
		let t = this.time, i = 0;
		while (i < this.shots.length - 1 && t >= this.shots[i].dur) { t -= this.shots[i].dur; i++; }
		const s = this.shots[i];
		if (i !== this.index) {
			this.index = i;
			this.ctx.setPreset(s.time);
			this.ctx.setWind(s.wind);
		}
		const k = easeIO(Math.min(1, t / s.dur)) * 0.92 + (t / s.dur) * 0.08;
		const cam = this.ctx.camera;
		s.posCurve.getPoint(k, cam.position);
		const look = s.lookCurve.getPoint(k);
		if (s.clamp) {
			const g = this.ctx.hf.height(cam.position.x, cam.position.z);
			if (cam.position.y < g + s.clamp) cam.position.y = g + s.clamp;
		}
		cam.lookAt(look);
		if (cam.fov !== s.fov) { cam.fov = s.fov; cam.updateProjectionMatrix(); }
		// fades between shots, and at the very start and end
		const first = i === 0, last = i === this.shots.length - 1;
		const fin = first ? Math.min(1, t / 1.2) : Math.min(1, t / FADE);
		const fout = Math.min(1, (s.dur - t) / (last ? 1.2 : FADE));
		this.ctx.fadeEl.style.opacity = String(1 - Math.min(fin, fout));
		// title cards
		const el = this.ctx.titleEl;
		if (s.title) {
			const a = Math.min(1, Math.max(0, (t - 1.0) / 0.9)) * Math.min(1, Math.max(0, (s.dur - 0.9 - t) / 0.9));
			el.style.opacity = String(a);
			el.dataset.kind = s.title;
		} else el.style.opacity = '0';
		return true;
	}
}
