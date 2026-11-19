// Generated soundscape (Web Audio, no files): layered wind with gusts, fire crackle, cabin
// creaks, icy tinkles, flag flapping, footsteps on snow / wood / rock, and an optional
// slow ambient pad.
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
	}
	noiseBuffer(sec) {
		const ctx = this.ctx, b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
		let last = 0;
		for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.5 + last * 3.5; }
		return b;
	}
	impulse(sec) {
		const ctx = this.ctx, n = ctx.sampleRate * sec, b = ctx.createBuffer(2, n, ctx.sampleRate);
		for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
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
		const v = Math.min(1, 0.55 + speed * 0.08);
		if (surface === 'wood') {
			this.tone(95 + Math.random() * 20, 0.12, 0.22 * v, this.amb, 'triangle');
			this.burst(0.05, 2400, 1.2, 0.05 * v);
		} else if (surface === 'rock') {
			this.burst(0.07, 1800, 0.8, 0.12 * v);
			this.tone(140, 0.06, 0.08 * v);
		} else {
			// snow: a cluster of tiny squeaks and crunches
			for (let i = 0; i < 6; i++) this.burst(0.03 + Math.random() * 0.04, 1300 + Math.random() * 2600, 2.5, (surface === 'path' ? 0.07 : 0.1) * v, this.amb, 'bandpass', i * 0.018 + Math.random() * 0.012);
			this.burst(0.16, 420, 0.7, 0.07 * v, this.amb, 'lowpass');
		}
	}
	click() { if (this.ctx) { this.tone(880, 0.05, 0.05); } }
	door(open) { if (!this.ctx) return; this.tone(open ? 180 : 140, 0.5, 0.05, this.amb, 'sawtooth', 0, open ? 1.6 : 0.7); this.burst(0.08, 600, 1, 0.25, this.amb, 'lowpass', open ? 0.45 : 0.3); }
	stoke() { if (!this.ctx) return; for (let i = 0; i < 14; i++) this.burst(0.02 + Math.random() * 0.03, 2000 + Math.random() * 3000, 1, 0.25, this.amb, 'highpass', Math.random() * 0.6); this.burst(0.8, 200, 0.7, 0.3, this.amb, 'lowpass'); }

	// e: { wind 0..1, gust, inside, fireDist, flagDist, flagEnergy, alt01, night }
	update(dt, e) {
		if (!this.ctx) return;
		const ctx = this.ctx, t = ctx.currentTime;
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
		// fireplace
		const fire = Math.max(0, 1 - e.fireDist / (e.inside ? 14 : 9)) * (e.inside ? 1 : 0.4) * e.fire;
		this.fireRoar.g.gain.setTargetAtTime(fire * 0.16, t, 0.3);
		if (fire > 0.02 && t > this.nextCrackle) {
			this.nextCrackle = t + 0.04 + Math.random() * Math.random() * 0.5;
			this.burst(0.012 + Math.random() * 0.03, 1500 + Math.random() * 4500, 1.2, fire * (0.08 + Math.random() * 0.25), this.amb, 'highpass');
		}
		// cabin creaks
		if (e.inside && t > this.nextCreak) {
			this.nextCreak = t + 9 + Math.random() * 18;
			this.tone(70 + Math.random() * 50, 0.6 + Math.random() * 0.6, 0.025 + w * 0.03, this.amb, 'sawtooth', 0, 1.2 + Math.random() * 0.3);
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
