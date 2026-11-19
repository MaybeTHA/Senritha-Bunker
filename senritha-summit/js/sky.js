// Sky and time of day: single-scattering atmosphere (rendered into a small LUT whenever the
// light moves), sun and moon discs, high clouds, stars, Milky Way and animated aurora
// curtains. Presets blend smoothly; fog, light colours and image-based lighting follow.
import * as THREE from 'three';
import { U, GLSL_NOISE } from './shading.js';

const deg = (d) => (d * Math.PI) / 180;
// azimuth measured from north (-Z) clockwise toward east (+X)
export function dirFromAzEl(az, el, out = new THREE.Vector3()) {
	return out.set(Math.sin(deg(az)) * Math.cos(deg(el)), Math.sin(deg(el)), -Math.cos(deg(az)) * Math.cos(deg(el)));
}

export const PRESETS = {
	morning: {
		sun: [116, 8.5], moon: [290, -30], sunI: 3.6, sunTint: [1.0, 0.86, 0.66], moonI: 0, keyIsMoon: 0,
		exposure: 1.0, env: 0.85, fogDensity: 0.0016, fogFalloff: 0.0042, fogBase: -760, haze: 3.4e-5,
		cloud: 0.42, cloudDensity: 0.75, stars: 0, aurora: 0, mist: 1.0, skyGain: 1.7, cabin: 0.55, bloom: 0.22, bloomThr: 1.6,
		skyTint: [1.0, 1.0, 1.0], fogTint: [1.0, 0.98, 0.98], alpenglow: 1.0, snowfall: 0.35,
	},
	afternoon: {
		sun: [208, 34], moon: [80, -40], sunI: 4.4, sunTint: [1.0, 0.98, 0.95], moonI: 0, keyIsMoon: 0,
		exposure: 0.8, env: 1.0, fogDensity: 0.00028, fogFalloff: 0.003, fogBase: -900, haze: 2.1e-5,
		cloud: 0.5, cloudDensity: 0.85, stars: 0, aurora: 0, mist: 0.45, skyGain: 1.25, cabin: 0.12, bloom: 0.16, bloomThr: 2.2,
		skyTint: [1.0, 1.0, 1.0], fogTint: [1.0, 1.0, 1.0], alpenglow: 0, snowfall: 0.25,
	},
	night: {
		sun: [10, -28], moon: [228, 32], sunI: 0, sunTint: [1.0, 1.0, 1.0], moonI: 0.95, keyIsMoon: 1,
		exposure: 1.3, env: 0.9, fogDensity: 0.00045, fogFalloff: 0.0035, fogBase: -820, haze: 2.6e-5,
		cloud: 0.2, cloudDensity: 0.5, stars: 1, aurora: 1, mist: 0.75, skyGain: 5.0, cabin: 1, bloom: 0.5, bloomThr: 0.75,
		skyTint: [1.0, 1.0, 1.0], fogTint: [1.0, 1.0, 1.0], alpenglow: 0, snowfall: 0.6,
	},
};

// ---------------------------------------------------------------- atmosphere (shared GLSL + JS)
const ATMO_GLSL = /* glsl */`
const float PR = 6371e3; const float AR = 6471e3;
const vec3 BR = vec3(5.5e-6, 13.0e-6, 22.4e-6); const float BM = 21e-6; const vec3 BO = vec3(0.65e-6, 1.881e-6, 0.085e-6);
const float HR = 8e3; const float HM = 1.2e3;
vec2 rsi(vec3 r0, vec3 rd, float sr){ float a = dot(rd, rd); float b = 2.0 * dot(rd, r0); float c = dot(r0, r0) - sr * sr; float d = b*b - 4.0*a*c; if (d < 0.0) return vec2(1e5, -1e5); return vec2((-b - sqrt(d)) / (2.0*a), (-b + sqrt(d)) / (2.0*a)); }
vec3 atmosphere(vec3 rd, vec3 sd, float I){
	vec3 r0 = vec3(0.0, PR + 3600.0, 0.0);
	vec2 p = rsi(r0, rd, AR);
	if (p.x > p.y) return vec3(0.0);
	p.y = min(p.y, rsi(r0, rd, PR).x > 0.0 ? rsi(r0, rd, PR).x : p.y);
	float iStep = (p.y - max(p.x, 0.0)) / 16.0;
	float iTime = max(p.x, 0.0) + iStep * 0.5;
	vec3 tR = vec3(0.0), tM = vec3(0.0); float odR = 0.0, odM = 0.0;
	float mu = dot(rd, sd); float mumu = mu * mu; float g = 0.76; float gg = g * g;
	float pR = 3.0 / (16.0 * PI) * (1.0 + mumu);
	float pM = 3.0 / (8.0 * PI) * ((1.0 - gg) * (mumu + 1.0)) / (pow(1.0 + gg - 2.0 * mu * g, 1.5) * (2.0 + gg));
	for (int i = 0; i < 16; i++) {
		vec3 iPos = r0 + rd * iTime;
		float iH = length(iPos) - PR;
		float dR = exp(-iH / HR) * iStep, dM = exp(-iH / HM) * iStep;
		odR += dR; odM += dM;
		float jStep = rsi(iPos, sd, AR).y / 6.0;
		float jTime = jStep * 0.5; float jR = 0.0, jM = 0.0;
		for (int j = 0; j < 6; j++) {
			vec3 jPos = iPos + sd * jTime;
			float jH = length(jPos) - PR;
			jR += exp(-jH / HR) * jStep; jM += exp(-jH / HM) * jStep;
			jTime += jStep;
		}
		vec3 att = exp(-(BM * 1.1 * (odM + jM) + (BR + BO) * (odR + jR)));
		tR += dR * att; tM += dM * att;
		iTime += iStep;
	}
	return I * (pR * BR * tR + pM * BM * tM);
}
`;

const BO = [0.65e-6, 1.881e-6, 0.085e-6];
function atmosphereJS(rd, sd, I) {
	const PR = 6371e3, AR = 6471e3, BR = [5.5e-6, 13.0e-6, 22.4e-6], BM = 21e-6, HR = 8e3, HM = 1.2e3;
	const r0 = [0, PR + 3600, 0];
	const rsi = (o, d, sr) => {
		const a = d[0] * d[0] + d[1] * d[1] + d[2] * d[2], b = 2 * (d[0] * o[0] + d[1] * o[1] + d[2] * o[2]), c = o[0] ** 2 + o[1] ** 2 + o[2] ** 2 - sr * sr;
		const dd = b * b - 4 * a * c; if (dd < 0) return [1e5, -1e5];
		return [(-b - Math.sqrt(dd)) / (2 * a), (-b + Math.sqrt(dd)) / (2 * a)];
	};
	const p = rsi(r0, rd, AR);
	const pg = rsi(r0, rd, PR);
	let far = p[1]; if (pg[0] > 0) far = Math.min(far, pg[0]);
	const iStep = (far - Math.max(p[0], 0)) / 12;
	let iT = iStep * 0.5;
	const tR = [0, 0, 0], tM = [0, 0, 0]; let odR = 0, odM = 0;
	const mu = rd[0] * sd[0] + rd[1] * sd[1] + rd[2] * sd[2], g = 0.76, gg = g * g;
	const pR = (3 / (16 * Math.PI)) * (1 + mu * mu);
	const pM = (3 / (8 * Math.PI)) * ((1 - gg) * (mu * mu + 1)) / (Math.pow(1 + gg - 2 * mu * g, 1.5) * (2 + gg));
	for (let i = 0; i < 12; i++) {
		const ip = [r0[0] + rd[0] * iT, r0[1] + rd[1] * iT, r0[2] + rd[2] * iT];
		const iH = Math.hypot(ip[0], ip[1], ip[2]) - PR;
		const dR = Math.exp(-iH / HR) * iStep, dM = Math.exp(-iH / HM) * iStep;
		odR += dR; odM += dM;
		const jStep = rsi(ip, sd, AR)[1] / 6; let jT = jStep * 0.5, jR = 0, jM = 0;
		for (let j = 0; j < 6; j++) {
			const jp = [ip[0] + sd[0] * jT, ip[1] + sd[1] * jT, ip[2] + sd[2] * jT];
			const jH = Math.hypot(jp[0], jp[1], jp[2]) - PR;
			jR += Math.exp(-jH / HR) * jStep; jM += Math.exp(-jH / HM) * jStep; jT += jStep;
		}
		for (let c = 0; c < 3; c++) {
			const att = Math.exp(-(BM * 1.1 * (odM + jM) + (BR[c] + BO[c]) * (odR + jR)));
			tR[c] += dR * att; tM[c] += dM * att;
		}
		iT += iStep;
	}
	return [0, 1, 2].map((c) => I * (pR * BR[c] * tR[c] + pM * BM * tM[c]));
}

// colour of direct light after travelling through the atmosphere toward the viewer
function transmittanceJS(sd) {
	const PR = 6371e3, AR = 6471e3, BR = [5.5e-6, 13.0e-6, 22.4e-6], BM = 21e-6, HR = 8e3, HM = 1.2e3;
	const o = [0, PR + 3600, 0];
	const b = 2 * (sd[1] * o[1]), c = o[1] * o[1] - AR * AR;
	const L = (-b + Math.sqrt(b * b - 4 * c)) / 2;
	const n = 24, st = L / n; let odR = 0, odM = 0;
	for (let i = 0; i < n; i++) {
		const t = (i + 0.5) * st;
		const h = Math.hypot(sd[0] * t, o[1] + sd[1] * t, sd[2] * t) - PR;
		if (h < -50) return [0, 0, 0];
		odR += Math.exp(-h / HR) * st; odM += Math.exp(-h / HM) * st;
	}
	return BR.map((br, c) => Math.exp(-((br + BO[c]) * odR + BM * 1.1 * odM)));
}

const SKY_SCALE = 0.11;  // sky radiance -> scene units

export class Sky {
	constructor(renderer, q) {
		this.renderer = renderer;
		this.q = q;
		this.state = { ...PRESETS.morning };
		this.from = null; this.to = null; this.t = 1;
		this.sunDir = new THREE.Vector3(); this.moonDir = new THREE.Vector3(); this.keyDir = new THREE.Vector3();
		this.group = new THREE.Group();
		this.lut = new THREE.WebGLRenderTarget(256, 128, { type: THREE.HalfFloatType, depthBuffer: false });
		this.lut.texture.wrapS = THREE.RepeatWrapping; this.lut.texture.minFilter = THREE.LinearFilter; this.lut.texture.generateMipmaps = false;
		this.uniforms = {
			...U,
			tLUT: { value: this.lut.texture },
			uSun: { value: this.sunDir }, uMoon: { value: this.moonDir },
			uSunI: { value: 3 }, uMoonI: { value: 0 },
			uExposure: { value: 1 }, uStars: { value: 0 }, uCloud: { value: 0.4 }, uCloudDensity: { value: 0.8 },
			uSunColor: { value: new THREE.Color() }, uAmbient: { value: new THREE.Color() },
			uAurora: { value: 0 },
		};
		this.makeLUT();
		this.makeDome();
		this.makeStars(q.stars);
		this.aurora = new Aurora(this.uniforms);
		this.group.add(this.aurora.group);
		this.pmrem = new THREE.PMREMGenerator(renderer);
		this.envScene = new THREE.Scene();
		this.envDome = new THREE.Mesh(this.dome.geometry, this.domeMat);
		this.envScene.add(this.envDome);
		this.envRT = null;
		this.envTimer = 0;
		this.lutDirty = true;
		this.apply(PRESETS.morning, 1);
	}

	makeLUT() {
		this.lutMat = new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
			fragmentShader: /* glsl */`
				precision highp float;
				#define PI 3.141592653589793
				varying vec2 vUv;
				uniform vec3 uSun; uniform vec3 uMoon; uniform float uSunI; uniform float uMoonI;
				${ATMO_GLSL}
				void main(){
					float az = (vUv.x - 0.5) * 2.0 * PI;
					float v = vUv.y * 2.0 - 1.0;
					float el = sign(v) * v * v * PI * 0.5;
					vec3 rd = vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az));
					vec3 rdc = rd; rdc.y = max(rdc.y, 0.002);
					rdc = normalize(rdc);
					vec3 c = vec3(0.0);
					if (uSunI > 0.0) c += atmosphere(rdc, uSun, uSunI * 22.0);
					if (uMoonI > 0.0) c += atmosphere(rdc, uMoon, uMoonI * 0.06) * vec3(0.85, 0.92, 1.1);
					// airglow and starlight so the night sky is never pure black
					c += vec3(0.0022, 0.0034, 0.0075) * (1.0 - smoothstep(-0.1, 0.6, rd.y) * 0.5);
					gl_FragColor = vec4(c, 1.0);
				}`,
			depthTest: false, depthWrite: false,
		});
		this.lutScene = new THREE.Scene();
		this.lutScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.lutMat));
		this.lutCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	}

	makeDome() {
		const g = new THREE.SphereGeometry(1, 64, 40);
		this.domeMat = new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: /* glsl */`
				varying vec3 vDir;
				void main(){
					vDir = position;
					vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
					gl_Position = p.xyww;
				}`,
			fragmentShader: /* glsl */`
				precision highp float;
				#define PI 3.141592653589793
				varying vec3 vDir;
				uniform sampler2D tLUT; uniform sampler2D tNoise;
				uniform vec3 uSun; uniform vec3 uMoon; uniform float uSunI; uniform float uMoonI;
				uniform float uExposure; uniform float uStars; uniform float uCloud; uniform float uCloudDensity; uniform float uTime;
				uniform vec3 uSunColor; uniform vec3 uAmbient; uniform vec2 uWindDir; uniform float uWind;
				uniform vec3 uFogColor;
				${GLSL_NOISE}
				vec3 lut(vec3 d){
					float az = atan(d.z, d.x);
					float el = asin(clamp(d.y, -1.0, 1.0));
					float v = sign(el) * sqrt(abs(el) / (PI * 0.5));
					return texture2D(tLUT, vec2(az / (2.0 * PI) + 0.5, v * 0.5 + 0.5)).rgb;
				}
				void main(){
					vec3 d = normalize(vDir);
					vec3 col = lut(d) * ${SKY_SCALE.toFixed(4)} * uExposure;
					// below the horizon: settle into the haze colour
					float below = smoothstep(0.0, -0.12, d.y);
					col = mix(col, uFogColor, below);
					// Milky Way and a faint zodiacal glow
					if (uStars > 0.0) {
						vec3 gp = normalize(vec3(0.42, 0.62, -0.66));
						float band = exp(-pow(dot(d, gp) / 0.16, 2.0));
						float mw = band * (0.55 + 0.9 * tfbm(vec2(atan(d.z, d.x) * 2.2, d.y * 3.0) + 0.3));
						float dust = smoothstep(0.55, 0.75, tfbm(vec2(atan(d.z, d.x) * 5.0, d.y * 7.0)));
						col += vec3(0.010, 0.011, 0.016) * mw * (1.0 - dust * 0.7) * uStars * smoothstep(-0.02, 0.15, d.y);
					}
					// sun disc with limb darkening + bloom halo
					float sd = dot(d, uSun);
					float sunDisc = smoothstep(0.99995, 0.99998, sd);
					col += uSunColor * sunDisc * 60.0 * uSunI;
					col += uSunColor * pow(max(sd, 0.0), 900.0) * 1.2 * uSunI;
					// moon
					float md = dot(d, uMoon);
					if (md > 0.999) {
						vec3 mu = normalize(cross(uMoon, vec3(0.0, 1.0, 0.0)));
						vec3 mv = cross(mu, uMoon);
						vec2 mp = vec2(dot(d, mu), dot(d, mv)) / 0.0105;
						float r = length(mp);
						if (r < 1.0) {
							float maria = tfbm(mp * 0.35 + 0.6);
							float lit = 0.75 + 0.25 * sqrt(1.0 - r * r);
							col += vec3(0.85, 0.88, 0.95) * (0.62 + 0.38 * smoothstep(0.42, 0.62, maria)) * lit * 2.4 * smoothstep(1.0, 0.94, r) * step(0.0, uMoonI) * (uMoonI > 0.0 ? 1.0 : 0.0);
						}
					}
					col += vec3(0.55, 0.62, 0.8) * pow(max(md, 0.0), 300.0) * 0.12 * uMoonI;
					// high clouds: a moving layer 5 km up
					if (d.y > 0.0 && uCloud > 0.0) {
						float t = 5200.0 / max(d.y, 0.02);
						vec2 cp = d.xz * t * 0.000045 + uWindDir * uTime * (0.0006 + uWind * 0.0018);
						float n = tfbm(cp) * 0.62 + tfbm(cp * 3.1 + 7.0) * 0.38;
						float wisp = tfbm(vec2(cp.x * 6.0, cp.y * 1.6) + 2.0);
						float cov = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.28, n * 0.78 + wisp * 0.32);
						float fade = smoothstep(0.015, 0.16, d.y);
						cov *= fade * uCloudDensity;
						// light: silver lining toward the light, soft self-shadow
						float n2 = tfbm(cp + uWindDir * 0.0 + vec2(uSun.x, uSun.z) * 0.02);
						float self = clamp(1.0 - (n2 - n) * 3.0, 0.4, 1.2);
						float fwd = pow(max(dot(d, uSun), 0.0), 6.0);
						vec3 key = uSunI > 0.0 ? uSunColor : vec3(0.0);
						vec3 cl = uAmbient * 1.1 + key * (0.22 * self + fwd * 0.9) * (uSunI > 0.0 ? 1.0 : 0.0);
						if (uMoonI > 0.0) cl += vec3(0.05, 0.06, 0.09) * self * uMoonI;
						col = mix(col, cl, cov * 0.9);
					}
					gl_FragColor = vec4(col, 1.0);
				}`,
			side: THREE.BackSide, depthWrite: false, depthTest: true,
		});
		this.dome = new THREE.Mesh(g, this.domeMat);
		this.dome.frustumCulled = false;
		this.dome.renderOrder = -1000;
		this.group.add(this.dome);
	}

	makeStars(n) {
		const pos = new Float32Array(n * 3), mag = new Float32Array(n), col = new Float32Array(n * 3);
		let s = 99;
		const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
		const gp = new THREE.Vector3(0.42, 0.62, -0.66).normalize();
		for (let i = 0; i < n; i++) {
			// concentrate a share of stars along the galactic band
			let v;
			do {
				v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
			} while (v.lengthSq() > 1 || v.lengthSq() < 0.01);
			v.normalize();
			if (i % 3 === 0) { v.addScaledVector(gp, -v.dot(gp) * (0.7 + rnd() * 0.3)).normalize(); }
			if (v.y < -0.05) v.y = -v.y;
			pos.set([v.x, v.y, v.z], i * 3);
			const m = Math.pow(rnd(), 3.2);
			mag[i] = m;
			const tK = rnd();
			const c = tK < 0.15 ? [1.0, 0.78, 0.6] : tK < 0.3 ? [0.75, 0.85, 1.0] : [1, 0.97, 0.94];
			col.set(c, i * 3);
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		g.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
		g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
		this.starMat = new THREE.ShaderMaterial({
			uniforms: { ...this.uniforms, uPR: { value: this.renderer.getPixelRatio() } },
			vertexShader: /* glsl */`
				attribute float aMag; attribute vec3 aCol;
				uniform float uTime; uniform float uPR; uniform float uStars;
				varying vec3 vCol; varying float vA;
				void main(){
					vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position * 1000.0, 1.0);
					gl_Position = p.xyww;
					float tw = 0.75 + 0.25 * sin(uTime * (1.3 + aMag * 4.0) + position.x * 400.0);
					float horizon = smoothstep(-0.02, 0.2, position.y);
					vA = (0.25 + aMag * 1.6) * tw * uStars * mix(0.35, 1.0, horizon);
					vCol = aCol;
					gl_PointSize = (1.2 + aMag * 2.6) * uPR;
				}`,
			fragmentShader: /* glsl */`
				varying vec3 vCol; varying float vA;
				void main(){
					vec2 c = gl_PointCoord - 0.5;
					float a = smoothstep(0.5, 0.0, length(c));
					gl_FragColor = vec4(vCol * vA * a * 0.9, 1.0);
				}`,
			transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
		});
		this.stars = new THREE.Points(g, this.starMat);
		this.stars.frustumCulled = false;
		this.stars.renderOrder = -900;
		this.group.add(this.stars);
	}

	// ------------------------------------------------------------- presets
	setPreset(name, instant = false) {
		this.target = name;
		const to = PRESETS[name];
		if (instant) { this.apply(to, 1); this.from = null; this.t = 1; this.refresh(true); return; }
		this.from = { ...this.state, sun: [...this.state.sun], moon: [...this.state.moon] };
		this.to = to; this.t = 0;
	}

	apply(p, k) {
		// p is a target preset, blended into this.state by k (0..1)
		const s = this.state;
		const L = (a, b) => a + (b - a) * k;
		const from = this.from || s;
		for (const key of Object.keys(p)) {
			if (Array.isArray(p[key])) s[key] = p[key].map((v, i) => L(from[key][i], v));
			else s[key] = L(from[key], p[key]);
		}
	}

	update(dt, time) {
		if (this.from) {
			this.t = Math.min(1, this.t + dt / 3.2);
			const k = this.t * this.t * (3 - 2 * this.t);
			this.apply(this.to, k);
			this.lutDirty = true;
			if (this.t >= 1) { this.from = null; this.refresh(true); }
		}
		this.sync();
		const s = this.state;
		if (this.lutDirty) this.refresh(false);
		this.aurora.update(time, s.aurora);
		this.envTimer += dt;
		if (this.from && this.envTimer > 0.45) { this.envTimer = 0; this.renderEnv(); }
	}

	sync() {
		const s = this.state, u = this.uniforms;
		dirFromAzEl(s.sun[0], s.sun[1], this.sunDir);
		dirFromAzEl(s.moon[0], s.moon[1], this.moonDir);
		u.uSunI.value = Math.max(0, s.sunI * Math.min(1, (s.sun[1] + 4) / 6));
		u.uMoonI.value = s.moonI;
		u.uExposure.value = s.skyGain;
		u.uStars.value = s.stars;
		u.uCloud.value = s.cloud;
		u.uCloudDensity.value = s.cloudDensity;
		u.uAurora.value = s.aurora;
	}

	// recompute everything that depends on the light direction
	refresh(env) {
		this.sync();
		const s = this.state, u = this.uniforms;
		const r = this.renderer, prev = r.getRenderTarget();
		r.setRenderTarget(this.lut); r.render(this.lutScene, this.lutCam); r.setRenderTarget(prev);
		this.lutDirty = false;

		// key light: sun by day, moon by night (blended through the transition)
		const nightK = s.keyIsMoon;
		this.keyDir.copy(this.sunDir).lerp(this.moonDir, nightK);
		if (this.keyDir.y < 0.04) this.keyDir.y = 0.04;
		this.keyDir.normalize();
		U.uSunDir.value.copy(this.keyDir);

		const sd = [this.sunDir.x, Math.max(this.sunDir.y, -0.2), this.sunDir.z];
		const T = transmittanceJS([sd[0], Math.max(sd[1], 0.01), sd[2]]);
		const sunCol = new THREE.Color(T[0] * s.sunTint[0], T[1] * s.sunTint[1], T[2] * s.sunTint[2]);
		u.uSunColor.value.copy(sunCol);
		const moonCol = new THREE.Color(0.55, 0.66, 1.0);
		this.keyColor = sunCol.clone().multiplyScalar(u.uSunI.value).lerp(moonCol.clone().multiplyScalar(s.moonI), nightK);

		// fog colours from the sky near the horizon
		const sample = (az, el) => {
			const rd = dirFromAzEl(az, el);
			const a = u.uSunI.value > 0 ? atmosphereJS([rd.x, rd.y, rd.z], [this.sunDir.x, this.sunDir.y, this.sunDir.z], u.uSunI.value * 22) : [0, 0, 0];
			const b = s.moonI > 0 ? atmosphereJS([rd.x, rd.y, rd.z], [this.moonDir.x, this.moonDir.y, this.moonDir.z], s.moonI * 0.06) : [0, 0, 0];
			return new THREE.Color(
				(a[0] + b[0] * 0.85 + 0.0022) * SKY_SCALE * s.skyGain,
				(a[1] + b[1] * 0.92 + 0.0034) * SKY_SCALE * s.skyGain,
				(a[2] + b[2] * 1.1 + 0.0075) * SKY_SCALE * s.skyGain);
		};
		const keyAz = s.keyIsMoon > 0.5 ? s.moon[0] : s.sun[0];
		const fogC = new THREE.Color(0, 0, 0);
		for (const da of [90, 150, 180, 210, 270]) fogC.add(sample(keyAz + da, 2.5));
		fogC.multiplyScalar(1 / 5);
		const fogS = sample(keyAz, 2.5);
		U.uFogColor.value.copy(fogC).multiply(new THREE.Color(...s.fogTint));
		U.uFogSunColor.value.copy(fogS);
		U.uFogDensity.value = s.fogDensity; U.uFogFalloff.value = s.fogFalloff; U.uFogBase.value = s.fogBase; U.uHaze.value = s.haze;
		const amb = sample(keyAz + 180, 40).multiplyScalar(0.8);
		u.uAmbient.value.copy(amb);
		if (env) this.renderEnv();
	}

	renderEnv() {
		const prevStars = this.uniforms.uStars.value;
		const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 10);
		this.uniforms.uStars.value = prevStars;
		if (this.envRT) this.envRT.dispose();
		this.envRT = rt;
		this.onEnv?.(rt.texture);
	}

	follow(camera) {
		this.dome.position.copy(camera.position);
		this.dome.scale.setScalar(1000);
		this.stars.position.copy(camera.position);
		this.aurora.group.position.set(camera.position.x, 0, camera.position.z);
	}
}

// ---------------------------------------------------------------- aurora borealis
// Several tall translucent curtains far to the north, folding slowly, with vertical rays,
// a bright green lower edge, cyan highlights and violet tops.
class Aurora {
	constructor(skyUniforms) {
		this.group = new THREE.Group();
		this.uniforms = {
			uTime: skyUniforms.uTime, tNoise: skyUniforms.tNoise, uAurora: skyUniforms.uAurora,
			uPulse: { value: 1 },
		};
		const curtains = [
			{ dist: 26000, az: -18, span: 120, y0: 5200, h: 9000, seed: 0.1, amp: 2600, bright: 1.0 },
			{ dist: 32000, az: 22, span: 110, y0: 6400, h: 11000, seed: 0.37, amp: 3400, bright: 0.75 },
			{ dist: 21000, az: 4, span: 70, y0: 4600, h: 6500, seed: 0.61, amp: 1600, bright: 0.55 },
			{ dist: 38000, az: -40, span: 80, y0: 8000, h: 12000, seed: 0.83, amp: 3000, bright: 0.5 },
		];
		for (const c of curtains) this.group.add(this.makeCurtain(c));
	}
	makeCurtain(c) {
		const seg = 220;
		const g = new THREE.PlaneGeometry(1, 1, seg, 1);
		const pos = g.attributes.position;
		const a0 = deg(c.az - c.span / 2), a1 = deg(c.az + c.span / 2);
		const base = new Float32Array(pos.count * 3);
		for (let i = 0; i < pos.count; i++) {
			const u = pos.getX(i) + 0.5, v = pos.getY(i) + 0.5;
			const a = a0 + (a1 - a0) * u;
			// arc in the northern sky, gently S-shaped
			const r = c.dist * (1 + 0.12 * Math.sin(u * Math.PI * 2 + c.seed * 10));
			base[i * 3] = Math.sin(a) * r;
			base[i * 3 + 1] = c.y0 + v * c.h;
			base[i * 3 + 2] = -Math.cos(a) * r;
			pos.setXYZ(i, base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
		}
		const m = new THREE.ShaderMaterial({
			uniforms: { ...this.uniforms, uSeed: { value: c.seed }, uAmp: { value: c.amp }, uBright: { value: c.bright } },
			vertexShader: /* glsl */`
				uniform float uTime; uniform float uSeed; uniform float uAmp; uniform sampler2D tNoise;
				varying vec2 vUv; varying float vFold;
				void main(){
					vUv = uv;
					vec3 p = position;
					vec2 radial = normalize(p.xz);
					float f1 = texture2D(tNoise, vec2(uv.x * 0.9 + uSeed, uTime * 0.0035 + uSeed)).r - 0.5;
					float f2 = texture2D(tNoise, vec2(uv.x * 3.1 - uTime * 0.004, uSeed * 3.0)).g - 0.5;
					float fold = f1 * 1.0 + f2 * 0.45;
					p.xz += radial * fold * uAmp * 1.8;
					// curtains lean slightly with height
					p.xz += radial * uv.y * uAmp * 0.25;
					vFold = f2;
					vec4 mv = modelViewMatrix * vec4(p, 1.0);
					gl_Position = projectionMatrix * mv;
					gl_Position.z = gl_Position.w * 0.99999;
				}`,
			fragmentShader: /* glsl */`
				uniform float uTime; uniform float uSeed; uniform float uAurora; uniform float uBright; uniform sampler2D tNoise;
				varying vec2 vUv; varying float vFold;
				void main(){
					float u = vUv.x, v = vUv.y;
					// vertical rays drifting sideways
					float r1 = texture2D(tNoise, vec2(u * 9.0 + uTime * 0.006 + uSeed, 0.13)).r;
					float r2 = texture2D(tNoise, vec2(u * 31.0 - uTime * 0.011, 0.71 + uSeed)).b;
					float rays = smoothstep(0.25, 0.95, r1 * 0.7 + r2 * 0.5);
					// bright patches moving along the arc
					float bright = smoothstep(0.3, 0.8, texture2D(tNoise, vec2(u * 1.6 - uTime * 0.0025 + uSeed * 2.0, uTime * 0.0015)).g);
					float lower = smoothstep(0.0, 0.06 + r2 * 0.05, v);
					float body = exp(-v * 2.6) * lower;
					float top = smoothstep(0.25, 0.75, v) * (1.0 - smoothstep(0.75, 1.0, v));
					float ends = smoothstep(0.0, 0.12, u) * smoothstep(1.0, 0.88, u);
					vec3 green = vec3(0.12, 1.0, 0.42);
					vec3 cyan = vec3(0.2, 0.95, 0.85);
					vec3 violet = vec3(0.55, 0.22, 0.85);
					vec3 col = green * body * (0.35 + rays * 1.1);
					col += cyan * smoothstep(0.08, 0.0, abs(v - 0.05)) * rays * 0.6 * (0.5 + vFold);
					col += violet * top * (0.2 + rays * 0.35) * 0.55;
					float I = (0.45 + bright * 0.9) * ends * uAurora * uBright;
					gl_FragColor = vec4(col * I * 0.09, 1.0);
				}`,
			transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
		});
		const mesh = new THREE.Mesh(g, m);
		mesh.frustumCulled = false;
		mesh.renderOrder = -800;
		return mesh;
	}
	update(time, k) {
		this.group.visible = k > 0.01;
	}
}
