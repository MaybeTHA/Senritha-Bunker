// Ambient sound made in the browser: crackling stove, wind in the spruce, muffled when inside.

function fireBuffer(ctx, secs = 14) {
	const sr = ctx.sampleRate, n = Math.floor(sr * secs);
	const buf = ctx.createBuffer(2, n, sr);
	for (let ch = 0; ch < 2; ch++) {
		const d = buf.getChannelData(ch);
		let brown = 0, last = 0;
		for (let i = 0; i < n; i++) {
			brown = (brown + (Math.random() * 2 - 1) * 0.02) / 1.02;
			d[i] = brown * 1.6 + (Math.random() * 2 - 1) * 0.004;
		}
		let t = 0;
		while (t < n) {
			t += Math.floor(-Math.log(1 - Math.random()) * sr / 11);
			if (t >= n) break;
			const big = Math.random() < 0.08;
			const amp = big ? 0.5 + Math.random() * 0.5 : 0.05 + Math.random() * 0.25;
			const len = Math.floor(sr * (big ? 0.012 + Math.random() * 0.02 : 0.001 + Math.random() * 0.006));
			const tone = Math.random();
			for (let k = 0; k < len && t + k < n; k++) {
				const env = Math.exp(-k / (len * 0.25));
				const w = Math.random() * 2 - 1;
				const v = tone * w + (1 - tone) * (w - last);
				last = w;
				d[t + k] += v * amp * env;
			}
			if (big && Math.random() < 0.6) {
				for (let j = 0; j < 4; j++) {
					const o = t + Math.floor(Math.random() * sr * 0.06);
					const l2 = Math.floor(sr * 0.002);
					for (let k = 0; k < l2 && o + k < n; k++) d[o + k] += (Math.random() * 2 - 1) * amp * 0.4 * Math.exp(-k / (l2 * 0.3));
				}
			}
		}
		const f = Math.floor(sr * 0.05);
		for (let i = 0; i < f; i++) { const g = i / f; d[i] *= g; d[n - 1 - i] *= g; }
	}
	return buf;
}

function pinkBuffer(ctx, secs = 10) {
	const sr = ctx.sampleRate, n = Math.floor(sr * secs);
	const buf = ctx.createBuffer(2, n, sr);
	for (let ch = 0; ch < 2; ch++) {
		const d = buf.getChannelData(ch);
		let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
		for (let i = 0; i < n; i++) {
			const w = Math.random() * 2 - 1;
			b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
			b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
			d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
		}
		const f = Math.floor(sr * 0.2);
		for (let i = 0; i < f; i++) { const g = i / f; d[i] = d[i] * g + d[n - f + i] * (1 - g); }
	}
	return buf;
}

export class Ambience {
	constructor() { this.ctx = null; this.on = true; this.started = false; }

	start() {
		if (this.started) { if (this.on) this.ctx.resume(); return; }
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return;
		const ctx = this.ctx = new AC();
		this.started = true;
		this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);
		this.master.gain.setTargetAtTime(this.on ? 0.9 : 0, ctx.currentTime, 1.2);

		const fire = ctx.createBufferSource(); fire.buffer = fireBuffer(ctx); fire.loop = true;
		this.fireLP = ctx.createBiquadFilter(); this.fireLP.type = 'lowpass'; this.fireLP.frequency.value = 7000;
		this.fireGain = ctx.createGain(); this.fireGain.gain.value = 0;
		fire.connect(this.fireLP).connect(this.fireGain).connect(this.master);
		fire.start();

		const wind = ctx.createBufferSource(); wind.buffer = pinkBuffer(ctx); wind.loop = true;
		this.windBP = ctx.createBiquadFilter(); this.windBP.type = 'bandpass'; this.windBP.frequency.value = 420; this.windBP.Q.value = 0.6;
		this.windLP = ctx.createBiquadFilter(); this.windLP.type = 'lowpass'; this.windLP.frequency.value = 900;
		this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
		wind.connect(this.windBP).connect(this.windLP).connect(this.windGain).connect(this.master);
		wind.start();

		const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 58;
		this.humGain = ctx.createGain(); this.humGain.gain.value = 0;
		hum.connect(this.humGain).connect(this.master); hum.start();
		if (!this.on) ctx.suspend();
	}

	setOn(on) {
		this.on = on;
		if (!this.ctx) return;
		if (on) { this.ctx.resume(); this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.4); }
		else { this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15); setTimeout(() => { if (!this.on) this.ctx.suspend(); }, 600); }
	}

	update(t, inside, stoveDist) {
		if (!this.ctx || !this.on) return;
		const now = this.ctx.currentTime;
		const fireLevel = inside ? Math.min(0.9, 0.55 / (0.35 + stoveDist * 0.45)) : 0.03;
		this.fireGain.gain.setTargetAtTime(fireLevel, now, 0.5);
		this.fireLP.frequency.setTargetAtTime(inside ? 7000 : 1200, now, 0.5);
		const gust = 0.6 + 0.4 * Math.sin(t * 0.11) * Math.sin(t * 0.037 + 1.3) + 0.15 * Math.sin(t * 0.53);
		this.windGain.gain.setTargetAtTime((inside ? 0.1 : 0.42) * gust, now, 0.8);
		this.windLP.frequency.setTargetAtTime(inside ? 650 : 3800, now, 0.6);
		this.windBP.frequency.setTargetAtTime(300 + gust * 360, now, 1.5);
		this.humGain.gain.setTargetAtTime(inside ? 0.006 : 0, now, 0.8);
	}
}
