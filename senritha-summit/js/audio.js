// Soundscape. Recorded sounds (footsteps on snow, wood and rock, the fireplace, the door and
// cabin creaks; see sounds/ and the README credits) are varied in pitch and level on every play
// and placed in 3D around the listener. Wind, flag, icy tinkles and music are generated live.
// If the recordings cannot load, every sound falls back to a generated version.
import { SOUNDS } from './sounds.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class Soundscape {
	constructor() {
		this.ctx = null;
		this.vol = { master: 0.8, ambience: 0.9, music: 0.5 };
		this.muted = false;
		this.musicOn = false;
	}
	start() {
		if (this.ctx) { this.ctx.resume(); return; }
		const C = window.AudioContext || window.webkitAudioContext;
		if (!C) return;
		const ctx = this.ctx = new C();
		this.master = ctx.createGain(); this.master.connect(ctx.destination);
		this.amb = ctx.createGain(); this.amb.connect(this.master);
		this.mus = ctx.createGain(); this.mus.gain.value = 0; this.mus.connect(this.master);
		this.reverb = ctx.createConvolver(); this.reverb.buffer = this.impulse(3.2);
		const rv = ctx.createGain(); rv.gain.value = 0.5; this.reverb.connect(rv); rv.connect(this.master);
		this.applyVolumes();
		const noise = this.noiseBuffer(4);
		const loop = (type, f, q) => {
			const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
			s.playbackRate.value = 0.8 + Math.random() * 0.4;
			const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
			const g = ctx.createGain(); g.gain.value = 0;
			s.connect(fl); fl.connect(g); g.connect(this.amb);
			s.start(0, Math.random() * 3);
			return { f: fl, g };
		};
		this.windLow = loop('lowpass', 320, 0.4);
		this.windMid = loop('bandpass', 700, 0.6);
		this.whistle = loop('bandpass', 1500, 9);
		this.fireRoar = loop('lowpass', 180, 0.7);
		this.flag = loop('bandpass', 950, 0.9);
		this.muffle = ctx.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000;
		// route wind through a muffling filter for when we are indoors
		for (const w of [this.windLow, this.windMid, this.whistle]) { w.g.disconnect(); w.g.connect(this.muffle); }
		this.muffle.connect(this.amb);
		this.noise = noise;
		this.nextCrackle = 0; this.nextTink = 2; this.nextCreak = 6;
		this.chord = 0; this.nextChord = 0;
		// footsteps: dry plus a send into a small timber room (indoors) or a wide open space (outdoors)
		this.steps = ctx.createGain(); this.steps.connect(this.amb);
		this.room = ctx.createConvolver(); this.room.buffer = this.impulse(0.55, 5);
		this.roomSend = ctx.createGain(); this.roomSend.gain.value = 0;
		this.steps.connect(this.roomSend); this.roomSend.connect(this.room); this.room.connect(this.amb);
		this.openSend = ctx.createGain(); this.openSend.gain.value = 0.06;
		this.steps.connect(this.openSend); this.openSend.connect(this.reverb);
		// fireplace: everything it makes goes through one 3D panner, then a wall filter
		this.fireBus = ctx.createGain();
		this.firePan = this.panner(1.6, 1.3);
		this.fireWall = ctx.createBiquadFilter(); this.fireWall.type = 'lowpass'; this.fireWall.frequency.value = 18000;
		this.fireBus.connect(this.firePan); this.firePan.connect(this.fireWall); this.fireWall.connect(this.amb);
		this.fireRoom = ctx.createGain(); this.fireRoom.gain.value = 0.18;
		this.fireBus.connect(this.fireRoom); this.fireRoom.connect(this.room);
		this.buf = {};
		this.lastPick = {};
		this.load();
	}

	async load() {
		const base = new URL('../sounds/', import.meta.url);
		const names = [...Object.keys(SOUNDS.sprites), 'fire_loop'];
		await Promise.all(names.map(async (n) => {
			try {
				const r = await fetch(new URL(n + '.mp3', base));
				if (!r.ok) return;
				const data = await r.arrayBuffer();
				this.buf[n] = await new Promise((res, rej) => this.ctx.decodeAudioData(data, res, rej));
			} catch { /* keep the generated fallback for this sound */ }
		}));
		if (this.buf.fire_loop) {
			const src = this.ctx.createBufferSource();
			src.buffer = this.buf.fire_loop;
			src.loop = true;
			src.loopStart = SOUNDS.fireLoop.start; src.loopEnd = SOUNDS.fireLoop.end;
			this.fireGain = this.ctx.createGain(); this.fireGain.gain.value = 0;
			src.connect(this.fireGain); this.fireGain.connect(this.fireBus);
			src.start(0, SOUNDS.fireLoop.start + Math.random() * 15);
			this.fireRoar.g.gain.value = 0;
		}
		this.loaded = true;
	}

	panner(ref, roll) {
		const p = this.ctx.createPanner();
		p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
		p.refDistance = ref; p.rolloffFactor = roll; p.maxDistance = 200;
		return p;
	}
	place(p, v) {
		if (!v) return;
		if (p.positionX) { const t = this.ctx.currentTime; p.positionX.setValueAtTime(v.x, t); p.positionY.setValueAtTime(v.y, t); p.positionZ.setValueAtTime(v.z, t); }
		else p.setPosition(v.x, v.y, v.z);
	}
	listen(l) {
		const L = this.ctx.listener, t = this.ctx.currentTime;
		if (L.positionX) {
			L.positionX.setValueAtTime(l.pos.x, t); L.positionY.setValueAtTime(l.pos.y, t); L.positionZ.setValueAtTime(l.pos.z, t);
			L.forwardX.setValueAtTime(l.fwd.x, t); L.forwardY.setValueAtTime(l.fwd.y, t); L.forwardZ.setValueAtTime(l.fwd.z, t);
			L.upX.setValueAtTime(l.up.x, t); L.upY.setValueAtTime(l.up.y, t); L.upZ.setValueAtTime(l.up.z, t);
		} else {
			L.setPosition(l.pos.x, l.pos.y, l.pos.z);
			L.setOrientation(l.fwd.x, l.fwd.y, l.fwd.z, l.up.x, l.up.y, l.up.z);
		}
	}

	// play one clip from a sprite; returns the source node or null when it is not loaded
	clip(sprite, { rate = 1, gain = 1, dest = this.amb, when = 0, index = -1, filter = null } = {}) {
		const b = this.buf[sprite];
		if (!b) return null;
		const list = SOUNDS.sprites[sprite];
		let i = index;
		if (i < 0) {
			// never the same take twice in a row
			do { i = Math.floor(Math.random() * list.length); } while (list.length > 1 && i === this.lastPick[sprite]);
			this.lastPick[sprite] = i;
		}
		const [start, dur] = list[i];
		const ctx = this.ctx, t = ctx.currentTime + when;
		const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
		const g = ctx.createGain(); g.gain.value = gain;
		let node = src;
		if (filter) {
			const f = ctx.createBiquadFilter(); f.type = filter.type; f.frequency.value = filter.f; f.Q.value = filter.q ?? 0.7;
			src.connect(f); node = f;
		}
		node.connect(g); g.connect(dest);
		src.start(t, start, dur);
		return src;
	}
	// a one-shot placed somewhere in the world
	at(sprite, pos, opts = {}, ref = 1.5, roll = 1.2) {
		if (!this.buf[sprite]) return null;
		const p = this.panner(ref, roll);
		this.place(p, pos);
		p.connect(opts.dest || this.amb);
		const src = this.clip(sprite, { ...opts, dest: p });
		if (src) src.onended = () => p.disconnect();
		return src;
	}
	noiseBuffer(sec) {
		const ctx = this.ctx, b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
		let last = 0;
		for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.5 + last * 3.5; }
		return b;
	}
	impulse(sec, decay = 3.2) {
		const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
		for (let c = 0; c < 2; c++) {
			const d = b.getChannelData(c);
			let lp = 0;
			for (let i = 0; i < n; i++) { lp += ((Math.random() * 2 - 1) - lp) * (decay > 4 ? 0.35 : 1); d[i] = lp * Math.pow(1 - i / n, decay); }
		}
		return b;
	}
	applyVolumes() {
		if (!this.ctx) return;
		const t = this.ctx.currentTime;
		this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.1);
		this.amb.gain.setTargetAtTime(this.vol.ambience, t, 0.1);
	}
	set(k, v) { this.vol[k] = v; this.applyVolumes(); }
	mute(m) { this.muted = m; this.applyVolumes(); }

	burst(dur, freq, q, gain, dest = this.amb, type = 'bandpass', when = 0) {
		const ctx = this.ctx, t = ctx.currentTime + when;
		const s = ctx.createBufferSource(); s.buffer = this.noise;
		const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
		const g = ctx.createGain();
		g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + Math.min(0.012, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		s.connect(f); f.connect(g); g.connect(dest);
		s.start(t, Math.random() * 3); s.stop(t + dur + 0.05);
	}
	tone(freq, dur, gain, dest = this.amb, type = 'sine', when = 0, glide = 0) {
		const ctx = this.ctx, t = ctx.currentTime + when;
		const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
		if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t + dur);
		const g = ctx.createGain();
		g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
	}
	footstep(surface, speed) {
		if (!this.ctx) return;
		const run = speed > 4.5;
		const v = Math.min(1.15, 0.7 + speed * 0.06);
		const sprite = surface === 'wood' ? 'wood_steps' : surface === 'rock' ? 'rock_steps' : 'snow_steps';
		if (this.buf[sprite]) {
			if (surface === 'wood') {
				this.clip('wood_steps', { rate: rand(0.9, 1.08), gain: 0.55 * v * rand(0.8, 1), dest: this.steps });
				// boards answer now and then
				if (Math.random() < 0.18) this.clip('creaks', { rate: rand(1.1, 1.5), gain: 0.12 * rand(0.5, 1), dest: this.steps, when: rand(0.02, 0.08) });
			} else if (surface === 'rock') {
				this.clip('rock_steps', { rate: rand(0.85, 1.12), gain: 0.5 * v * rand(0.8, 1), dest: this.steps });
				// a little snow on the stone
				this.clip('snow_steps', { rate: rand(1.15, 1.35), gain: 0.12, dest: this.steps, filter: { type: 'highpass', f: 1800 } });
			} else {
				// packed trail snow squeaks higher and shorter than loose powder
				const path = surface === 'path';
				this.clip('snow_steps', {
					rate: (path ? rand(1.02, 1.12) : rand(0.88, 1.03)) * (run ? 1.06 : 1),
					gain: (path ? 0.55 : 0.68) * v * rand(0.78, 1),
					dest: this.steps,
					filter: path ? { type: 'highpass', f: 260 } : null,
				});
			}
			return;
		}
		// generated fallback
		if (surface === 'wood') {
			this.tone(95 + Math.random() * 20, 0.12, 0.22 * v, this.amb, 'triangle');
			this.burst(0.05, 2400, 1.2, 0.05 * v);
		} else if (surface === 'rock') {
			this.burst(0.07, 1800, 0.8, 0.12 * v);
			this.tone(140, 0.06, 0.08 * v);
		} else {
			for (let i = 0; i < 6; i++) this.burst(0.03 + Math.random() * 0.04, 1300 + Math.random() * 2600, 2.5, (surface === 'path' ? 0.07 : 0.1) * v, this.amb, 'bandpass', i * 0.018 + Math.random() * 0.012);
			this.burst(0.16, 420, 0.7, 0.07 * v, this.amb, 'lowpass');
		}
	}
	click() { if (this.ctx) { this.tone(880, 0.05, 0.05); } }
	door(open, pos) {
		if (!this.ctx) return;
		if (this.buf.door) {
			if (open) this.at('door', pos, { index: 0, rate: rand(0.95, 1.05), gain: 0.75 }, 1.4, 1.1);
			else {
				this.at('door', pos, { index: 0, rate: rand(1.15, 1.3), gain: 0.3 }, 1.4, 1.1);
				this.at('door', pos, { index: 1, rate: rand(0.96, 1.04), gain: 0.9, when: 0.35 }, 1.6, 1.1);
			}
			return;
		}
		this.tone(open ? 180 : 140, 0.5, 0.05, this.amb, 'sawtooth', 0, open ? 1.6 : 0.7);
		this.burst(0.08, 600, 1, 0.25, this.amb, 'lowpass', open ? 0.45 : 0.3);
	}
	// sitting or lying down: the furniture takes the weight
	creak(pos) {
		if (!this.ctx || !this.buf.creaks) return;
		this.at('creaks', pos, { rate: rand(0.8, 1.0), gain: 0.5 }, 1.2, 1.2);
	}
	stoke() {
		if (!this.ctx) return;
		if (this.buf.fire_crackles) {
			// a log lands on the embers, the flames catch and spit
			this.clip('wood_steps', { rate: 0.62, gain: 0.5, dest: this.fireBus });
			this.clip('rock_steps', { rate: 0.7, gain: 0.25, dest: this.fireBus, when: 0.05 });
			for (let i = 0; i < 16; i++) this.clip('fire_crackles', { rate: rand(0.8, 1.3), gain: rand(0.4, 1.0), dest: this.fireBus, when: 0.15 + Math.random() * Math.random() * 2.2 });
			const t = this.ctx.currentTime;
			const s = this.ctx.createBufferSource(); s.buffer = this.noise;
			const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240;
			const g = this.ctx.createGain();
			g.gain.setValueAtTime(0, t + 0.1); g.gain.linearRampToValueAtTime(0.35, t + 0.6); g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
			s.connect(f); f.connect(g); g.connect(this.fireBus); s.start(t, Math.random() * 2); s.stop(t + 2.8);
			return;
		}
		for (let i = 0; i < 14; i++) this.burst(0.02 + Math.random() * 0.03, 2000 + Math.random() * 3000, 1, 0.25, this.amb, 'highpass', Math.random() * 0.6);
		this.burst(0.8, 200, 0.7, 0.3, this.amb, 'lowpass');
	}

	// e: { wind 0..1, gust, inside, fireDist, firePos, fire, listener, flagDist, flagEnergy, alt01, night }
	update(dt, e) {
		if (!this.ctx) return;
		const ctx = this.ctx, t = ctx.currentTime;
		if (e.listener) this.listen(e.listener);
		this.roomSend.gain.setTargetAtTime(e.inside ? 0.22 : 0, t, 0.2);
		this.openSend.gain.setTargetAtTime(e.inside ? 0 : 0.05, t, 0.2);
		const w = e.wind, gst = e.gust;
		const alt = e.alt01;
		const exposure = (0.55 + alt * 0.6) * (e.inside ? 0.28 : 1);
		const base = (0.06 + w * 0.32) * (1 + gst * 0.9) * exposure * (e.night ? 0.8 : 1);
		this.windLow.g.gain.setTargetAtTime(base * 1.2, t, 0.4);
		this.windMid.g.gain.setTargetAtTime(base * 0.55 * (0.4 + w), t, 0.4);
		this.windMid.f.frequency.setTargetAtTime(500 + gst * 700 + w * 300, t, 0.6);
		this.whistle.g.gain.setTargetAtTime(base * 0.12 * (w > 0.5 ? 1 : 0.3) * (0.3 + gst), t, 0.5);
		this.whistle.f.frequency.setTargetAtTime(1200 + gst * 900 + Math.sin(t * 0.7) * 200, t, 0.5);
		this.muffle.frequency.setTargetAtTime(e.inside ? 650 : 18000, t, 0.3);
		// fireplace: heard from its place in the room, muffled by the walls from outside
		const fireOn = e.fireDist < (e.inside ? 30 : 22);
		if (this.fireGain) {
			this.place(this.firePan, e.firePos);
			this.fireWall.frequency.setTargetAtTime(e.inside ? 16000 : 700, t, 0.25);
			this.fireGain.gain.setTargetAtTime(fireOn ? 0.75 * e.fire * (e.inside ? 1 : 0.5) : 0, t, 0.4);
			this.fireRoom.gain.setTargetAtTime(e.inside ? 0.16 : 0, t, 0.3);
			if (fireOn && t > this.nextCrackle) {
				this.nextCrackle = t + rand(0.08, 0.5) * rand(0.4, 1.6) / e.fire;
				this.clip('fire_crackles', { rate: rand(0.75, 1.35), gain: rand(0.25, 0.9) * e.fire, dest: this.fireBus });
			}
		} else {
			const fire = Math.max(0, 1 - e.fireDist / (e.inside ? 14 : 9)) * (e.inside ? 1 : 0.4) * e.fire;
			this.fireRoar.g.gain.setTargetAtTime(fire * 0.16, t, 0.3);
			if (fire > 0.02 && t > this.nextCrackle) {
				this.nextCrackle = t + 0.04 + Math.random() * Math.random() * 0.5;
				this.burst(0.012 + Math.random() * 0.03, 1500 + Math.random() * 4500, 1.2, fire * (0.08 + Math.random() * 0.25), this.amb, 'highpass');
			}
		}
		// the cabin settles in the cold and creaks in the wind
		if (e.inside && t > this.nextCreak) {
			this.nextCreak = t + rand(8, 22) * (1.2 - w * 0.6);
			if (this.buf.creaks && e.listener) {
				const p = e.listener.pos;
				const a = Math.random() * Math.PI * 2;
				this.at('creaks', { x: p.x + Math.cos(a) * rand(1.5, 3.5), y: p.y + rand(0.5, 2.2), z: p.z + Math.sin(a) * rand(1.5, 3.5) }, { rate: rand(0.55, 0.85), gain: 0.16 + w * 0.2 }, 1.2, 1.2);
			} else this.tone(70 + Math.random() * 50, 0.6 + Math.random() * 0.6, 0.025 + w * 0.03, this.amb, 'sawtooth', 0, 1.2 + Math.random() * 0.3);
		}
		// icy tinkles on the open mountain
		if (!e.inside && t > this.nextTink) {
			this.nextTink = t + 3 + Math.random() * (10 - w * 6);
			const f = 2400 + Math.random() * 3200;
			for (let i = 0; i < 3; i++) this.tone(f * (1 + i * 0.37), 0.5 + Math.random() * 0.6, 0.012 * (0.5 + w), this.reverb, 'sine', i * 0.07 + Math.random() * 0.05);
		}
		// flag flapping near the summit
		const fl = Math.max(0, 1 - e.flagDist / 60) * Math.min(1, 0.2 + e.flagEnergy * 0.08);
		const flap = 0.5 + 0.5 * Math.sin(t * (7 + w * 9));
		this.flag.g.gain.setTargetAtTime(fl * 0.18 * (0.3 + flap * 0.7) * (0.4 + w), t, 0.03);
		// music
		const mOn = this.musicOn && !this.muted;
		this.mus.gain.setTargetAtTime(mOn ? this.vol.music * 0.5 : 0, t, 1.5);
		if (mOn && t > this.nextChord) {
			const chords = [[220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6], [130.8, 196, 246.9, 329.6], [196, 246.9, 293.7, 370]];
			const c = chords[this.chord++ % chords.length];
			const len = 9;
			this.nextChord = t + len - 1.2;
			for (const f of c) for (const det of [-3, 3]) {
				const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
				const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.022, t + 3.2); g.gain.linearRampToValueAtTime(0.0, t + len);
				const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
				o.connect(lp); lp.connect(g); g.connect(this.mus); g.connect(this.reverb);
				o.start(t); o.stop(t + len + 0.1);
			}
			// a high, sparse bell
			if (Math.random() < 0.7) this.tone(c[3] * 2, 4, 0.02, this.reverb, 'sine', 1.5 + Math.random() * 3);
		}
	}
}
