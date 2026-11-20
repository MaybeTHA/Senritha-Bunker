// Small animated effects that live entirely on the GPU: soft puffs (steam, chimney smoke,
// spindrift) and fire.
import * as THREE from 'three';
import { U, GLSL_NOISE } from './shading.js';

// Billboarded puffs on a loop. Each instance has its own phase, so nothing is simulated on the CPU.
export class Puffs {
	constructor(o) {
		const n = o.count;
		const g = new THREE.InstancedBufferGeometry();
		const quad = new THREE.PlaneGeometry(1, 1);
		g.index = quad.index;
		g.setAttribute('position', quad.attributes.position);
		g.setAttribute('uv', quad.attributes.uv);
		const seed = new Float32Array(n * 4);
		for (let i = 0; i < n; i++) seed.set([Math.random(), Math.random(), Math.random(), i / n], i * 4);
		g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
		g.instanceCount = n;
		this.uniforms = {
			uTime: U.uTime, uWindDir: U.uWindDir, uWind: U.uWind, uGust: U.uGust, tNoise: U.tNoise,
			uOrigin: { value: o.origin.clone() },
			uLife: { value: o.life }, uRise: { value: o.rise }, uSpread: { value: o.spread },
			uSize: { value: new THREE.Vector2(o.size0, o.size1) }, uColor: { value: new THREE.Color(o.color) },
			uOpacity: { value: o.opacity }, uWindK: { value: o.windK ?? 1 }, uLit: { value: new THREE.Color(1, 1, 1) },
			uSunDir: U.uSunDir, uFogColor: U.uFogColor, uFogDensity: U.uFogDensity, uFogFalloff: U.uFogFalloff, uFogBase: U.uFogBase, uHaze: U.uHaze, uFogSunColor: U.uFogSunColor,
		};
		this.mat = new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: /* glsl */`
				#include <common>
				#include <logdepthbuf_pars_vertex>
				attribute vec4 aSeed;
				uniform float uTime; uniform vec3 uOrigin; uniform float uLife; uniform float uRise; uniform float uSpread;
				uniform vec2 uSize; uniform vec2 uWindDir; uniform float uWind; uniform float uGust; uniform float uWindK;
				varying vec2 vUv; varying float vAge; varying float vSeed; varying vec3 vWP;
				void main(){
					float age = fract(uTime / uLife + aSeed.w + aSeed.x * 0.13);
					vAge = age; vSeed = aSeed.y; vUv = uv;
					float t = age * uLife;
					vec3 p = uOrigin;
					p.y += uRise * t * (1.0 - age * 0.35);
					vec2 sw = vec2(sin(t * 1.3 + aSeed.y * 6.28), cos(t * 1.1 + aSeed.z * 6.28));
					p.xz += sw * uSpread * (0.3 + age) + (aSeed.yz - 0.5) * uSpread * 0.6;
					float ws = (0.6 + uWind * 3.5) * (1.0 + uGust * 0.8) * uWindK;
					p.xz += uWindDir * ws * t * age;
					float size = mix(uSize.x, uSize.y, sqrt(age)) * (0.8 + aSeed.z * 0.4);
					vec4 mv = modelViewMatrix * vec4(p, 1.0);
					float rot = aSeed.x * 6.28 + t * 0.3;
					vec2 q = position.xy * size;
					q = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * q;
					mv.xy += q;
					vWP = p;
					gl_Position = projectionMatrix * mv;
					#include <logdepthbuf_vertex>
				}`,
			fragmentShader: /* glsl */`
				#include <common>
				#include <logdepthbuf_pars_fragment>
				uniform sampler2D tNoise; uniform vec3 uColor; uniform float uOpacity; uniform vec3 uLit; uniform float uTime;
				varying vec2 vUv; varying float vAge; varying float vSeed; varying vec3 vWP;
				${GLSL_NOISE}
				void main(){
					#include <logdepthbuf_fragment>
					vec2 c = vUv - 0.5;
					float r = length(c);
					float n = tfbm(vUv * 0.6 + vSeed + uTime * 0.02);
					float a = smoothstep(0.5, 0.1, r + (n - 0.5) * 0.35);
					a *= smoothstep(0.0, 0.12, vAge) * (1.0 - smoothstep(0.3, 1.0, vAge)) * uOpacity;
					if (a < 0.004) discard;
					gl_FragColor = vec4(uColor * uLit, a);
				}`,
			transparent: true, depthWrite: false, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
		});
		this.mesh = new THREE.Mesh(g, this.mat);
		this.mesh.frustumCulled = false;
		this.mesh.renderOrder = o.renderOrder ?? 2;
	}
}

// Fire: a few crossed flame cards with a procedural flame shader, plus glowing embers.
export class Fire {
	constructor() {
		this.group = new THREE.Group();
		this.uniforms = { uTime: U.uTime, tNoise: U.tNoise, uPower: { value: 1 } };
		const mat = new THREE.ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: /* glsl */`
				#include <common>
				#include <logdepthbuf_pars_vertex>
				varying vec2 vUv;
				void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				#include <logdepthbuf_vertex>
				}`,
			fragmentShader: /* glsl */`
				#include <common>
				#include <logdepthbuf_pars_fragment>
				uniform float uTime; uniform sampler2D tNoise; uniform float uPower;
				varying vec2 vUv;
				void main(){
					#include <logdepthbuf_fragment>
					vec2 uv = vUv;
					float n1 = texture2D(tNoise, vec2(uv.x * 0.9, uv.y * 0.6 - uTime * 0.55)).r;
					float n2 = texture2D(tNoise, vec2(uv.x * 2.1 + 0.3, uv.y * 1.3 - uTime * 0.9)).g;
					float n = n1 * 0.65 + n2 * 0.45;
					float w = (1.0 - uv.y) * 0.62 * (0.85 + 0.3 * uPower);
					float shape = smoothstep(w, w * 0.3, abs(uv.x - 0.5) + (n - 0.5) * 0.35 * uv.y);
					shape *= smoothstep(0.0, 0.08, uv.y) * smoothstep(1.0, 0.25 + 0.35 * n, uv.y + (1.0 - uPower) * 0.3);
					float core = smoothstep(0.55, 1.0, shape * (1.0 - uv.y));
					vec3 col = mix(vec3(1.0, 0.28, 0.04), vec3(1.0, 0.72, 0.28), core);
					col = mix(col, vec3(1.0, 0.95, 0.75), smoothstep(0.75, 1.0, core));
					gl_FragColor = vec4(col * shape * (2.2 + core * 3.0), 1.0);
				}`,
			transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
		});
		for (let i = 0; i < 4; i++) {
			const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5 - i * 0.06, 0.62 - i * 0.05), mat);
			m.position.set((i - 1.5) * 0.06, 0.3 - i * 0.02, (i % 2) * 0.05 - 0.025);
			m.rotation.y = (i / 4) * Math.PI;
			m.renderOrder = 5;
			this.group.add(m);
		}
		this.embers = new Puffs({ count: 26, origin: new THREE.Vector3(0, 0.05, 0), life: 1.8, rise: 0.55, spread: 0.08, size0: 0.025, size1: 0.01, color: 0xff7a2a, opacity: 1.6, windK: 0, additive: true, renderOrder: 6 });
		this.group.add(this.embers.mesh);
	}
	set power(v) { this.uniforms.uPower.value = v; this.embers.uniforms.uOpacity.value = 1.2 * v; }
	get power() { return this.uniforms.uPower.value; }
}
