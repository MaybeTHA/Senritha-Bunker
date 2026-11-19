// Wind and everything it moves: falling snow (stretched into streaks by strong wind),
// spindrift plumes torn off the ridges, snow blowing along the ground, and banks of cloud
// and mist filling the valleys. All particles are animated in vertex shaders.
import * as THREE from 'three';
import { U, GLSL_NOISE, GLSL_TERRAIN, GLSL_FOG } from './shading.js';
import { VALLEY, COARSE } from './world.js';
import { mulberry32, smoothstep } from './noise.js';

const BASE_DIR = new THREE.Vector2(0.95, 0.31).normalize();

export class Wind {
	constructor() {
		this.mode = 'light';
		this.s = 0.22; this.target = 0.22;
		this.gust = 0;
		this.offset = new THREE.Vector3();
		this.vel = new THREE.Vector3();
		this.speed = 0;
	}
	set(mode) { this.mode = mode; this.target = mode === 'strong' ? 1 : 0.22; }
	update(dt, t) {
		this.s += (this.target - this.s) * Math.min(1, dt * 0.7);
		const raw = 0.5 + 0.5 * Math.sin(t * 0.41) * Math.sin(t * 0.73 + 1.3) + 0.25 * Math.sin(t * 1.9 + Math.sin(t * 0.3) * 3);
		const strongK = smoothstep(0.3, 0.9, this.s);
		this.gust = strongK * smoothstep(0.38, 0.95, raw) + (1 - strongK) * smoothstep(0.75, 1.1, raw) * 0.25;
		const a = Math.atan2(BASE_DIR.y, BASE_DIR.x) + Math.sin(t * 0.05) * 0.06 + Math.sin(t * 0.31) * 0.03 * this.s;
		U.uWindDir.value.set(Math.cos(a), Math.sin(a));
		U.uWind.value = this.s;
		U.uGust.value = this.gust;
		this.speed = (0.8 + this.s * 15) * (1 + this.gust * 0.9);
		this.vel.set(Math.cos(a) * this.speed, -1.0 + this.s * 0.25, Math.sin(a) * this.speed);
		this.offset.addScaledVector(this.vel, dt);
		// keep the numbers small; the snow box wraps anyway
		for (const k of ['x', 'y', 'z']) if (Math.abs(this.offset[k]) > 4800) this.offset[k] = this.offset[k] % 4800;
	}
}

const LOG_V = '#include <logdepthbuf_pars_vertex>';
const LOG_VM = '#include <logdepthbuf_vertex>';
const LOG_F = '#include <logdepthbuf_pars_fragment>';
const LOG_FM = '#include <logdepthbuf_fragment>';

function quadInstances(n, seedFn) {
	const g = new THREE.InstancedBufferGeometry();
	const q = new THREE.PlaneGeometry(2, 2);
	g.index = q.index;
	g.setAttribute('position', q.attributes.position);
	const a = new Float32Array(n * 4);
	for (let i = 0; i < n; i++) a.set(seedFn(i), i * 4);
	g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(a, 4));
	g.instanceCount = n;
	return g;
}

// ---------------------------------------------------------------- falling snow
export class SnowFall {
	constructor(n, box, size, alpha, far = false) {
		const rnd = mulberry32(far ? 91 : 17);
		this.n = n;
		this.geo = quadInstances(n, () => [rnd(), rnd(), rnd(), rnd()]);
		this.uniforms = {
			uTime: U.uTime, uCabinInv: U.uCabinInv, uCabinHalf: U.uCabinHalf, uSunDir: U.uSunDir,
			uCam: { value: new THREE.Vector3() }, uOffset: { value: new THREE.Vector3() }, uVel: { value: new THREE.Vector3() },
			uBox: { value: new THREE.Vector3(box, box * 0.7, box) },
			uSize: { value: size }, uStreak: { value: 0.03 }, uNear: { value: new THREE.Vector2(far ? 18 : 0.25, far ? 40 : 1.2) }, uDensity: { value: 0.5 }, uAlpha: { value: alpha },
			uKey: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() },
			uGlowPos: { value: new THREE.Vector3() }, uGlow: { value: 0 },
		};
		this.mat = new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: /* glsl */`
				#include <common>
				${LOG_V}
				attribute vec4 aSeed;
				uniform float uTime; uniform vec3 uCam; uniform vec3 uOffset; uniform vec3 uVel; uniform vec3 uBox;
				uniform float uSize; uniform float uStreak; uniform float uDensity; uniform vec2 uNear;
				uniform mat4 uCabinInv; uniform vec3 uCabinHalf;
				varying vec2 vL; varying float vA; varying vec3 vWP;
				void main(){
					if (aSeed.w > uDensity) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
					float sp = 0.75 + aSeed.w * 0.5;
					vec3 p = aSeed.xyz * uBox + uOffset * sp;
					p.x += sin(uTime * 1.3 + aSeed.y * 40.0) * 0.3;
					p.z += cos(uTime * 1.1 + aSeed.x * 37.0) * 0.3;
					vec3 rel = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5;
					vec3 wp = uCam + rel;
					vec3 lc = (uCabinInv * vec4(wp, 1.0)).xyz;
					if (all(lessThan(abs(lc - vec3(0.0, uCabinHalf.y, 0.0)), uCabinHalf))) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
					vec3 wp0 = wp - uVel * sp * uStreak;
					vec4 v1 = viewMatrix * vec4(wp, 1.0), v0 = viewMatrix * vec4(wp0, 1.0);
					vec2 d = v1.xy - v0.xy; float L = length(d);
					vec2 dir = L > 1e-5 ? d / L : vec2(0.0, 1.0); vec2 perp = vec2(-dir.y, dir.x);
					float size = uSize * (0.55 + aSeed.z * 0.9);
					vec4 v = mix(v0, v1, position.x * 0.5 + 0.5);
					v.xy += perp * position.y * size + dir * position.x * size;
					gl_Position = projectionMatrix * v;
					vL = position.xy;
					float dist = length(rel);
					vA = smoothstep(uNear.x, uNear.y, -v1.z) * (1.0 - smoothstep(uBox.x * 0.32, uBox.x * 0.5, dist)) / (1.0 + L / size * 0.35);
					vWP = wp;
					${LOG_VM}
				}`,
			fragmentShader: /* glsl */`
				#include <common>
				${LOG_F}
				uniform float uAlpha; uniform vec3 uKey; uniform vec3 uAmb; uniform vec3 uSunDir; uniform vec3 uGlowPos; uniform float uGlow;
				varying vec2 vL; varying float vA; varying vec3 vWP;
				void main(){
					${LOG_FM}
					float r = length(vL * vec2(0.85, 1.0));
					float a = smoothstep(1.0, 0.15, r) * vA * uAlpha;
					if (a < 0.003) discard;
					vec3 vd = normalize(vWP - cameraPosition);
					float fwd = pow(max(dot(vd, uSunDir), 0.0), 8.0);
					vec3 col = uAmb * 1.7 + uKey * (0.22 + fwd * 1.4);
					col = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))) * vec3(0.92, 0.96, 1.05), 0.45);
					float gd = distance(vWP, uGlowPos);
					col += vec3(1.0, 0.62, 0.3) * uGlow * 2.2 / (1.0 + gd * gd * 0.03);
					gl_FragColor = vec4(col, a);
				}`,
			transparent: true, depthWrite: false,
		});
		this.mesh = new THREE.Mesh(this.geo, this.mat);
		this.mesh.frustumCulled = false;
		this.mesh.renderOrder = 10;
	}
	update(cam, wind, density, keyCol, amb, glowPos, glow) {
		const u = this.uniforms;
		u.uCam.value.copy(cam);
		u.uOffset.value.copy(wind.offset);
		u.uVel.value.copy(wind.vel);
		u.uDensity.value = density;
		u.uStreak.value = 0.018 + wind.s * 0.05;
		u.uKey.value.copy(keyCol);
		u.uAmb.value.copy(amb);
		if (glowPos) u.uGlowPos.value.copy(glowPos);
		u.uGlow.value = glow || 0;
	}
}

// ---------------------------------------------------------------- spindrift plumes off the ridges
export class Spindrift {
	constructor(hf, perEmitter = 14) {
		// pick exposed ridge points spread over the massif
		const pts = [];
		const rnd = mulberry32(5);
		const cell = 70;
		const used = new Set();
		for (let i = 0; i < 9000 && pts.length < 90; i++) {
			const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 1500;
			const x = Math.cos(a) * d, z = Math.sin(a) * d;
			const y = hf.height(x, z);
			if (y < -120) continue;
			const cav = hf.field(x, z, 3);
			if (cav < 0.64) continue;
			const key = Math.floor(x / cell) + ',' + Math.floor(z / cell);
			if (used.has(key)) continue;
			used.add(key);
			pts.push([x, y + 1, z]);
		}
		pts.push([hf.summit.x, hf.summit.y + 1, hf.summit.z]);
		const n = pts.length * perEmitter;
		const g = quadInstances(n, (i) => { const p = pts[Math.floor(i / perEmitter)]; return [p[0], p[1], p[2], rnd()]; });
		this.uniforms = {
			uTime: U.uTime, uWindDir: U.uWindDir, uWind: U.uWind, uGust: U.uGust, tNoise: U.tNoise, uSunDir: U.uSunDir,
			uKey: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() }, uAmt: { value: 0.2 },
			uFogColor: U.uFogColor, uFogSunColor: U.uFogSunColor, uFogDensity: U.uFogDensity, uFogFalloff: U.uFogFalloff, uFogBase: U.uFogBase, uHaze: U.uHaze,
		};
		this.mat = new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: /* glsl */`
				#include <common>
				${LOG_V}
				attribute vec4 aSeed;
				uniform float uTime; uniform vec2 uWindDir; uniform float uWind; uniform float uGust; uniform float uAmt;
				varying vec2 vL; varying float vA; varying vec3 vWP; varying float vS;
				void main(){
					float life = 7.0 - uWind * 2.5;
					float age = fract(uTime / life + aSeed.w);
					float t = age * life;
					float sp = 5.0 + uWind * 18.0 * (1.0 + uGust * 0.7);
					vec3 w = vec3(uWindDir.x, 0.0, uWindDir.y);
					vec3 p = aSeed.xyz + w * sp * t * (0.6 + aSeed.w * 0.6);
					p.y += t * (1.5 + aSeed.w * 3.0) - t * t * 0.18;
					vec3 side = vec3(-w.z, 0.0, w.x);
					p += side * sin(t * 0.8 + aSeed.w * 30.0) * (2.0 + t * 1.5);
					float size = (2.0 + t * (2.2 + uWind * 4.5)) * (0.7 + aSeed.w * 0.6);
					vec4 mv = viewMatrix * vec4(p, 1.0);
					float rot = aSeed.w * 6.28 + t * 0.2;
					vec2 q = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * position.xy * size;
					vec2 wd = normalize((viewMatrix * vec4(w, 0.0)).xy + vec2(1e-4));
					q = wd * dot(q, wd) * (1.6 + uWind * 1.6) + vec2(-wd.y, wd.x) * dot(q, vec2(-wd.y, wd.x)) * 0.55;
					mv.xy += q;
					gl_Position = projectionMatrix * mv;
					vL = position.xy; vWP = p; vS = aSeed.w;
					vA = sin(age * 3.14159) * uAmt * (0.6 + uGust * 0.8);
					${LOG_VM}
				}`,
			fragmentShader: /* glsl */`
				#include <common>
				${LOG_F}
				uniform sampler2D tNoise; uniform vec3 uKey; uniform vec3 uAmb; uniform float uTime;
				varying vec2 vL; varying float vA; varying vec3 vWP; varying float vS;
				${GLSL_NOISE}
				${GLSL_FOG}
				void main(){
					${LOG_FM}
					float n = tfbm(vL * 0.35 + vS * 7.0 + uTime * 0.03);
					float n2 = tfbm(vL * 0.9 - vS * 3.0 + uTime * 0.05);
					float a = smoothstep(1.0, 0.0, length(vL) + (n - 0.5) * 1.1) * smoothstep(0.25, 0.75, n2 + 0.2) * vA * 0.3;
					if (a < 0.004) discard;
					vec3 vd = normalize(vWP - cameraPosition);
					float fwd = pow(max(dot(vd, uSunDir), 0.0), 5.0);
					vec3 col = uAmb * 1.4 + uKey * (0.45 + fwd * 2.2);
					col = applyAtmosphere(col, vWP);
					gl_FragColor = vec4(col, a);
				}`,
			transparent: true, depthWrite: false,
		});
		this.mesh = new THREE.Mesh(g, this.mat);
		this.mesh.frustumCulled = false;
		this.mesh.renderOrder = 8;
	}
	update(keyCol, amb, windS) {
		this.uniforms.uKey.value.copy(keyCol);
		this.uniforms.uAmb.value.copy(amb);
		this.uniforms.uAmt.value = Math.pow(Math.max(0, windS - 0.1) / 0.9, 1.5) * 1.1 + 0.02;
	}
}

// ---------------------------------------------------------------- snow streaming along the ground
export class GroundDrift {
	constructor(n, radius, size, height, alpha) {
		const rnd = mulberry32(radius | 0);
		this.geo = quadInstances(n, () => [rnd(), rnd(), rnd(), rnd()]);
		this.uniforms = {
			...U,
			uCam: { value: new THREE.Vector3() }, uOff: { value: new THREE.Vector2() },
			uR: { value: radius }, uSize: { value: size }, uH: { value: height }, uAlpha: { value: alpha }, uDensity: { value: 0.3 },
			uKey: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() },
		};
		this.mat = new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: /* glsl */`
				#include <common>
				${LOG_V}
				${GLSL_TERRAIN}
				attribute vec4 aSeed;
				uniform float uTime; uniform vec3 uCam; uniform vec2 uOff; uniform float uR; uniform float uSize; uniform float uH; uniform float uDensity;
				uniform vec2 uWindDir; uniform float uWind; uniform float uGust;
				uniform mat4 uCabinInv; uniform vec3 uCabinHalf;
				varying vec2 vL; varying float vA; varying vec3 vWP; varying float vS;
				void main(){
					if (aSeed.w > uDensity) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
					float box = uR * 2.0;
					vec2 p = aSeed.xy * box + uOff * (0.8 + aSeed.z * 0.4);
					vec2 rel = mod(p - uCam.xz + uR, box) - uR;
					vec2 xz = uCam.xz + rel;
					float g = terrainH(xz);
					float hh = aSeed.z * aSeed.z * uH * (0.5 + uGust);
					vec3 wp = vec3(xz.x, g + 0.15 + hh, xz.y);
					vec3 lc = (uCabinInv * vec4(wp, 1.0)).xyz;
					if (all(lessThan(abs(lc - vec3(0.0, uCabinHalf.y, 0.0)), uCabinHalf + 0.3))) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
					vec4 mv = viewMatrix * vec4(wp, 1.0);
					vec3 w = vec3(uWindDir.x, 0.0, uWindDir.y);
					vec2 sd = normalize((viewMatrix * vec4(w, 0.0)).xy + vec2(1e-4));
					float s = uSize * (0.6 + aSeed.w * 0.8);
					float stretch = 1.0 + uWind * 2.5;
					vec2 q = sd * position.x * s * stretch + vec2(-sd.y, sd.x) * position.y * s * 0.45;
					mv.xy += q;
					gl_Position = projectionMatrix * mv;
					vL = position.xy; vWP = wp; vS = aSeed.w;
					float dist = length(rel);
					vA = (1.0 - smoothstep(uR * 0.6, uR, dist)) * smoothstep(0.5, 3.0, -mv.z);
					${LOG_VM}
				}`,
			fragmentShader: /* glsl */`
				#include <common>
				${LOG_F}
				uniform sampler2D tNoise; uniform vec3 uKey; uniform vec3 uAmb; uniform float uAlpha; uniform float uTime; uniform float uGust;
				varying vec2 vL; varying float vA; varying vec3 vWP; varying float vS;
				${GLSL_NOISE}
				${GLSL_FOG}
				void main(){
					${LOG_FM}
					float n = tfbm(vL * 0.4 + vS * 9.0 + uTime * 0.05);
					float a = smoothstep(1.0, 0.0, length(vL) + (n - 0.5) * 0.8) * vA * uAlpha * (0.6 + uGust * 0.8);
					if (a < 0.003) discard;
					vec3 col = applyAtmosphere(uAmb * 1.35 + uKey * 0.5, vWP);
					gl_FragColor = vec4(col, a);
				}`,
			transparent: true, depthWrite: false,
		});
		this.mesh = new THREE.Mesh(this.geo, this.mat);
		this.mesh.frustumCulled = false;
		this.mesh.renderOrder = 9;
		this.off = new THREE.Vector2();
	}
	update(dt, cam, wind, density, keyCol, amb) {
		const u = this.uniforms;
		this.off.x += U.uWindDir.value.x * wind.speed * 1.15 * dt;
		this.off.y += U.uWindDir.value.y * wind.speed * 1.15 * dt;
		u.uCam.value.copy(cam);
		u.uOff.value.copy(this.off);
		u.uDensity.value = density;
		u.uKey.value.copy(keyCol); u.uAmb.value.copy(amb);
	}
}

// ---------------------------------------------------------------- valley cloud sea and mist
export class CloudSea {
	constructor(hf) {
		// a small 8-bit copy of the world heights so the clouds can fade where they meet the slopes
		const res = 512;
		const data = new Uint8Array(res * res);
		for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
			const x = COARSE.x0 + (i / (res - 1)) * COARSE.size, z = COARSE.z0 + (j / (res - 1)) * COARSE.size;
			data[j * res + i] = Math.max(0, Math.min(255, Math.round(((hf.height(x, z) - VALLEY) / 1700) * 255)));
		}
		const ht = new THREE.DataTexture(data, res, res, THREE.RedFormat);
		ht.magFilter = THREE.LinearFilter; ht.minFilter = THREE.LinearFilter; ht.needsUpdate = true;
		this.group = new THREE.Group();
		this.uniforms = {
			...U,
			tLowH: { value: ht },
			uKey: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() }, uMist: { value: 1 },
		};
		const layers = [
			{ y: -760, a: 0.5, s: 0.00042, cov: 0.46 },
			{ y: -720, a: 0.45, s: 0.0005, cov: 0.5 },
			{ y: -680, a: 0.4, s: 0.00058, cov: 0.55 },
			{ y: -630, a: 0.32, s: 0.00066, cov: 0.6 },
			{ y: -560, a: 0.22, s: 0.0008, cov: 0.66 },
			{ y: -420, a: 0.12, s: 0.0011, cov: 0.72 },
		];
		const geo = new THREE.PlaneGeometry(1, 1);
		geo.rotateX(-Math.PI / 2);
		for (const L of layers) {
			const m = new THREE.ShaderMaterial({
				uniforms: { ...this.uniforms, uY: { value: L.y }, uA: { value: L.a }, uS: { value: L.s }, uCov: { value: L.cov } },
				vertexShader: /* glsl */`
					#include <common>
					${LOG_V}
					varying vec3 vWP;
					void main(){
						vec4 w = modelMatrix * vec4(position, 1.0);
						vWP = w.xyz;
						gl_Position = projectionMatrix * viewMatrix * w;
						${LOG_VM}
					}`,
				fragmentShader: /* glsl */`
					#include <common>
					${LOG_F}
					uniform sampler2D tNoise; uniform sampler2D tLowH; uniform float uTime; uniform vec2 uWindDir; uniform float uWind;
					uniform float uY; uniform float uA; uniform float uS; uniform float uCov; uniform float uMist;
					uniform vec3 uKey; uniform vec3 uAmb;
					varying vec3 vWP;
					${GLSL_NOISE}
					${GLSL_FOG}
					void main(){
						${LOG_FM}
						vec2 drift = uWindDir * uTime * (2.0 + uWind * 9.0);
						vec2 p = (vWP.xz - drift) * uS;
						float n = tfbm(p) * 0.6 + tfbm(p * 2.7 + 3.1) * 0.3 + tfbm(p * 7.1 - uTime * 0.002) * 0.15;
						float cov = uCov - (uMist - 0.5) * 0.25;
						float d = smoothstep(cov, cov + 0.22, n);
						vec2 huv = (vWP.xz - vec2(${COARSE.x0.toFixed(1)}, ${COARSE.z0.toFixed(1)})) / ${COARSE.size.toFixed(1)};
						float th = texture2D(tLowH, huv).r * 1700.0 + ${VALLEY.toFixed(1)};
						d *= smoothstep(-15.0, 90.0, uY - th);
						float dc = length(vWP.xz - cameraPosition.xz);
						d *= smoothstep(26000.0, 9000.0, dc);
						float a = d * uA * uMist;
						if (a < 0.003) discard;
						vec3 vd = normalize(vWP - cameraPosition);
						float fwd = pow(max(dot(vd, uSunDir), 0.0), 6.0);
						vec3 col = uAmb * 1.5 + uKey * (0.42 + 0.25 * n + fwd * 1.2);
						col = applyAtmosphere(col, vWP);
						gl_FragColor = vec4(col, a);
					}`,
				transparent: true, depthWrite: false, side: THREE.DoubleSide,
			});
			const mesh = new THREE.Mesh(geo, m);
			mesh.scale.set(60000, 1, 60000);
			mesh.position.y = L.y;
			mesh.frustumCulled = false;
			mesh.renderOrder = 1;
			this.group.add(mesh);
		}
	}
	update(cam, keyCol, amb, mist) {
		this.group.children.forEach((m) => { m.position.x = Math.round(cam.x / 500) * 500; m.position.z = Math.round(cam.z / 500) * 500; });
		this.uniforms.uKey.value.copy(keyCol);
		this.uniforms.uAmb.value.copy(amb);
		this.uniforms.uMist.value = mist;
	}
}
