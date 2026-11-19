// Animated effects: fire, candle flames, coffee steam, chimney smoke, dust motes and light cones.
import * as THREE from 'three';
import { U } from './materials.js';

const NOISE = /* glsl */`
float hash12(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

export function flameMaterial(seed = 0, intensity = 4.5, speed = 1.6) {
	return new THREE.ShaderMaterial({
		uniforms: { uTime: U.time, uSeed: { value: seed }, uInt: { value: intensity }, uSpeed: { value: speed } },
		vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
		fragmentShader: /* glsl */`
			uniform float uTime, uSeed, uInt, uSpeed; varying vec2 vUv;
			${NOISE}
			void main(){
				vec2 uv = vUv;
				float t = uTime * uSpeed + uSeed * 10.0;
				float n = fbm(vec2(uv.x * 3.0 + uSeed * 7.0, uv.y * 2.2 - t));
				float n2 = fbm(vec2(uv.x * 6.0 - uSeed * 3.0, uv.y * 4.0 - t * 1.7));
				float x = (uv.x - 0.5) * 2.0 + (n - 0.5) * 0.9 * uv.y;
				float w = mix(0.95, 0.04, pow(uv.y, 0.8));
				float shape = smoothstep(w, w * 0.2, abs(x));
				float h = uv.y + (n2 - 0.5) * 0.5;
				float body = shape * smoothstep(1.0, 0.2, h) * smoothstep(0.0, 0.1, uv.y);
				float I = pow(body, 1.3);
				vec3 col = mix(vec3(0.8, 0.12, 0.01), vec3(1.0, 0.45, 0.08), smoothstep(0.05, 0.5, I));
				col = mix(col, vec3(1.0, 0.85, 0.55), smoothstep(0.55, 0.95, I));
				gl_FragColor = vec4(col * I * uInt, 1.0);
			}`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
	});
}

// Soft additive glow card (for flame halos, lamp glows).
export function glowMaterial(color, intensity = 1) {
	return new THREE.ShaderMaterial({
		uniforms: { uColor: { value: new THREE.Color(color) }, uInt: { value: intensity } },
		vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
		fragmentShader: /* glsl */`uniform vec3 uColor; uniform float uInt; varying vec2 vUv;
			void main(){ float d = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.2); gl_FragColor = vec4(uColor * a * uInt, 1.0); }`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
	});
}

// Rising wisps: coffee steam and chimney smoke share this GPU particle shader.
export function wisps({ count = 60, life = 4, rise = 0.32, spread = 0.03, drift = 0.06, size = 0.05, grow = 1.8, color = 0xffffff, opacity = 0.22, wind = [0, 0] } = {}) {
	const g = new THREE.BufferGeometry();
	const pos = new Float32Array(count * 3), seed = new Float32Array(count);
	for (let i = 0; i < count; i++) {
		const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
		pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = Math.sin(a) * r;
		seed[i] = i / count + Math.random() * 0.02;
	}
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
	const mat = new THREE.ShaderMaterial({
		uniforms: {
			uTime: U.time, uLife: { value: life }, uRise: { value: rise }, uDrift: { value: drift }, uSize: { value: size },
			uGrow: { value: grow }, uScale: { value: 800 }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity },
			uWind: { value: new THREE.Vector2(wind[0], wind[1]) },
		},
		vertexShader: /* glsl */`
			attribute float aSeed; uniform float uTime, uLife, uRise, uDrift, uSize, uGrow, uScale; uniform vec2 uWind;
			varying float vA; varying float vS;
			void main(){
				float t = fract(uTime / uLife + aSeed);
				vec3 p = position;
				float h = t * uRise;
				float sw = aSeed * 6.283 + uTime * 0.7;
				p.x += sin(sw + h * 9.0) * (0.004 + t * uDrift) + uWind.x * t * t;
				p.z += cos(sw * 1.3 + h * 7.0) * (0.004 + t * uDrift) + uWind.y * t * t;
				p.y += h;
				vec4 mv = modelViewMatrix * vec4(p, 1.0);
				gl_Position = projectionMatrix * mv;
				gl_PointSize = min(uSize * (0.35 + t * uGrow) * uScale / -mv.z, 256.0);
				vA = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.4, 1.0, t));
				vS = aSeed;
			}`,
		fragmentShader: /* glsl */`
			uniform vec3 uColor; uniform float uOpacity; varying float vA; varying float vS;
			${NOISE}
			void main(){
				vec2 c = gl_PointCoord - 0.5;
				float d = length(c);
				float n = fbm(c * 4.0 + vS * 31.0);
				float a = smoothstep(0.5, 0.05, d + (n - 0.5) * 0.35);
				gl_FragColor = vec4(uColor, a * a * vA * uOpacity);
			}`,
		transparent: true, depthWrite: false,
	});
	const pts = new THREE.Points(g, mat);
	pts.frustumCulled = false;
	pts.renderOrder = 6;
	return pts;
}

// Dust motes drifting in the warm air, brighter near light sources.
export function dustMotes(box, count, lightsPos) {
	const g = new THREE.BufferGeometry();
	const pos = new Float32Array(count * 3), rnd = new Float32Array(count * 3);
	for (let i = 0; i < count; i++) {
		pos[i * 3] = THREE.MathUtils.lerp(box.min.x, box.max.x, Math.random());
		pos[i * 3 + 1] = THREE.MathUtils.lerp(box.min.y, box.max.y, Math.random());
		pos[i * 3 + 2] = THREE.MathUtils.lerp(box.min.z, box.max.z, Math.random());
		rnd[i * 3] = Math.random(); rnd[i * 3 + 1] = Math.random(); rnd[i * 3 + 2] = Math.random();
	}
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 3));
	const L = lightsPos.map((p) => new THREE.Vector3(...p));
	const mat = new THREE.ShaderMaterial({
		uniforms: { uTime: U.time, uScale: { value: 800 }, uL: { value: L }, uMin: { value: box.min }, uMax: { value: box.max } },
		vertexShader: /* glsl */`
			attribute vec3 aRnd; uniform float uTime, uScale; uniform vec3 uL[${L.length}]; uniform vec3 uMin, uMax;
			varying float vB;
			void main(){
				vec3 p = position;
				p.x += sin(uTime * 0.11 + aRnd.x * 40.0) * 0.12;
				p.y += mod(uTime * (0.006 + aRnd.y * 0.012) + aRnd.z, 1.0) * 0.3 - 0.15;
				p.z += cos(uTime * 0.09 + aRnd.y * 40.0) * 0.12;
				float b = 0.0;
				for (int i = 0; i < ${L.length}; i++){ float d = distance(p, uL[i]); b += 0.35 / (0.15 + d * d); }
				vB = b * (0.5 + 0.5 * sin(uTime * (0.5 + aRnd.z) + aRnd.x * 20.0));
				vec4 mv = modelViewMatrix * vec4(p, 1.0);
				gl_Position = projectionMatrix * mv;
				gl_PointSize = clamp(0.0035 * uScale / -mv.z, 1.0, 6.0);
			}`,
		fragmentShader: /* glsl */`varying float vB; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d);
			gl_FragColor = vec4(vec3(1.0, 0.82, 0.6) * min(vB, 2.5) * 0.35, a * min(vB, 1.0) * 0.5); }`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
	});
	const p = new THREE.Points(g, mat);
	p.frustumCulled = false;
	return p;
}

// Volumetric light cone (porch light in the snow).
export function lightCone(length, radius, color, intensity = 0.25) {
	const geo = new THREE.CylinderGeometry(0.03, radius, length, 48, 12, true);
	geo.translate(0, -length / 2, 0);
	const mat = new THREE.ShaderMaterial({
		uniforms: { uTime: U.time, uColor: { value: new THREE.Color(color) }, uInt: { value: intensity }, uLen: { value: length } },
		vertexShader: /* glsl */`varying vec3 vN; varying vec3 vV; varying float vH; varying vec3 vP;
			void main(){ vH = -position.y; vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0);
			vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
		fragmentShader: /* glsl */`uniform vec3 uColor; uniform float uInt, uLen, uTime; varying vec3 vN; varying vec3 vV; varying float vH; varying vec3 vP;
			${NOISE}
			void main(){
				float f = pow(abs(dot(vN, vV)), 1.6);
				float fall = pow(1.0 - clamp(vH / uLen, 0.0, 1.0), 1.6);
				float n = 0.75 + 0.5 * fbm(vec2(atan(vP.x, vP.z) * 2.0, vH * 2.0 - uTime * 0.25));
				gl_FragColor = vec4(uColor * f * fall * n * uInt, 1.0);
			}`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.renderOrder = 4;
	return mesh;
}
