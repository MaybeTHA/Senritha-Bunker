// Shared uniforms, GLSL helpers and the material patch that gives every lit surface the
// same aerial perspective, height fog, terrain self-shadow, wind and snow cover.
import * as THREE from 'three';

export const U = {
	uTime: { value: 0 },
	uSunDir: { value: new THREE.Vector3(0, 1, 0) },       // direction toward the key light (sun or moon)
	uWindDir: { value: new THREE.Vector2(0.95, 0.31) },
	uWind: { value: 0.25 },     // 0..1 eased wind strength
	uGust: { value: 0 },        // 0..1 current gust
	uFogColor: { value: new THREE.Color(0.6, 0.7, 0.85) },
	uFogSunColor: { value: new THREE.Color(1, 0.9, 0.7) },
	uFogDensity: { value: 0.0004 },
	uFogFalloff: { value: 0.0012 },
	uFogBase: { value: -900 },
	uHaze: { value: 0.00004 },
	uSnowLevel: { value: 0.0 },
	// terrain grids
	tHD: { value: null }, tHF: { value: null }, tHC: { value: null },
	tND: { value: null }, tNF: { value: null }, tNC: { value: null },
	tShF: { value: null }, tShC: { value: null },
	uRD: { value: new THREE.Vector4() }, uRF: { value: new THREE.Vector4() }, uRC: { value: new THREE.Vector4() },
	tNoise: { value: null },
	uCabinInv: { value: new THREE.Matrix4() },  // world -> cabin local
	uCabinHalf: { value: new THREE.Vector3(4.7, 3, 3.45) },
};

// ---------------------------------------------------------------- GLSL
export const GLSL_NOISE = /* glsl */`
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
	return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float tnoise(vec2 p){ return texture2D(tNoise, p).r; }
float tfbm(vec2 p){ return texture2D(tNoise, p).r*0.5 + texture2D(tNoise, p*2.03+0.37).g*0.25 + texture2D(tNoise, p*4.11+0.71).b*0.125 + texture2D(tNoise, p*8.3+0.13).a*0.0625; }
`;

export const GLSL_TERRAIN = /* glsl */`
uniform sampler2D tHD; uniform sampler2D tHF; uniform sampler2D tHC;
uniform vec4 uRD; uniform vec4 uRF; uniform vec4 uRC;
float gridH(sampler2D t, vec4 R, vec2 p){
	vec2 f = clamp((p - R.xy) / R.z * (R.w - 1.0), vec2(0.0), vec2(R.w - 1.001));
	ivec2 i = ivec2(floor(f)); vec2 k = f - vec2(i);
	float a = texelFetch(t, i, 0).r, b = texelFetch(t, i + ivec2(1, 0), 0).r;
	float c = texelFetch(t, i + ivec2(0, 1), 0).r, d = texelFetch(t, i + ivec2(1, 1), 0).r;
	return mix(mix(a, b, k.x), mix(c, d, k.x), k.y);
}
float edgeDist(vec4 R, vec2 p){ vec2 a = p - R.xy; vec2 b = R.xy + R.z - p; return min(min(a.x, a.y), min(b.x, b.y)); }
float terrainH(vec2 p){
	float wd = smoothstep(0.0, 48.0, edgeDist(uRD, p));
	float wf = smoothstep(0.0, 160.0, edgeDist(uRF, p));
	float h = wf < 1.0 ? gridH(tHC, uRC, p) : 0.0;
	if (wf > 0.0) h = mix(h, gridH(tHF, uRF, p), wf);
	if (wd > 0.0) h = mix(h, gridH(tHD, uRD, p), wd);
	return h;
}
`;

export const GLSL_TSHADOW = /* glsl */`
uniform sampler2D tShF; uniform sampler2D tShC; uniform vec4 uRF; uniform vec4 uRC;
float terrainShadow(vec3 wp){
	vec2 uf = (wp.xz - uRF.xy) / uRF.z;
	vec2 uc = (wp.xz - uRC.xy) / uRC.z;
	float sc = texture2D(tShC, uc).r;
	vec2 e = min(uf, 1.0 - uf);
	float wf = smoothstep(0.0, 0.03, min(e.x, e.y));
	float s = wf > 0.0 ? mix(sc, texture2D(tShF, uf).r, wf) : sc;
	return s;
}
`;

export const GLSL_FOG = /* glsl */`
uniform vec3 uFogColor; uniform vec3 uFogSunColor; uniform float uFogDensity; uniform float uFogFalloff; uniform float uFogBase; uniform float uHaze; uniform vec3 uSunDir;
vec3 applyAtmosphere(vec3 col, vec3 wp){
	vec3 d = wp - cameraPosition; float dist = length(d); vec3 rd = d / max(dist, 1e-3);
	float b = uFogFalloff;
	float h0 = cameraPosition.y - uFogBase;
	float ry = d.y * b;
	float g = abs(ry) > 1e-4 ? (1.0 - exp(-ry)) / ry : 1.0;
	float fogInt = uFogDensity * exp(-b * h0) * dist * g;
	float ext = fogInt + dist * uHaze;
	float s = pow(max(dot(rd, uSunDir), 0.0), 6.0);
	vec3 fc = mix(uFogColor, uFogSunColor, s * 0.85);
	return mix(col, fc, 1.0 - exp(-ext));
}
`;

// ---------------------------------------------------------------- material patch
// opts: { fog, shadow, snow (0..1 coverage strength), sway (tree height in m), cabinClip }
export function patch(material, opts = {}) {
	const o = { fog: true, shadow: true, snow: 0, sway: 0, flutter: 0, ...opts };
	material.userData.patch = o;
	const prev = material.onBeforeCompile;
	material.onBeforeCompile = (sh, r) => {
		if (prev) prev(sh, r);
		Object.assign(sh.uniforms, U);
		let vs = sh.vertexShader, fs = sh.fragmentShader;
		vs = vs.replace('#include <common>', `#include <common>
			varying vec3 vWorldPosS;
			uniform float uTime; uniform vec2 uWindDir; uniform float uWind; uniform float uGust;
			${o.sway ? 'uniform sampler2D tNoise;' : ''}`);
		if (o.sway || o.flutter) {
			vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>
			{
				#ifdef USE_INSTANCING
					vec3 ip = instanceMatrix[3].xyz;
					mat3 im = mat3(instanceMatrix);
				#else
					vec3 ip = vec3(modelMatrix[3].xyz);
					mat3 im = mat3(1.0);
				#endif
				float ph = ip.x * 0.071 + ip.z * 0.053;
				float str = 0.15 + uWind * 0.85;
				vec3 wdir = vec3(uWindDir.x, 0.0, uWindDir.y);
				${o.sway ? `
				float hf = clamp(transformed.y / ${o.sway.toFixed(2)}, 0.0, 1.0);
				float sway = (sin(uTime * (0.9 + uWind) + ph) * 0.5 + 0.6 + uGust * 1.2) * str * hf * hf * 0.03 * ${o.sway.toFixed(2)};
				float flick = sin(uTime * 7.0 + ph * 9.0 + transformed.y * 2.3 + transformed.x * 3.1) * 0.02 * str * hf;
				vec3 lw = normalize(transpose(im) * wdir);
				transformed += lw * sway + vec3(flick, 0.0, flick * 0.7);
				` : ''}
				${o.flutter ? `
				transformed += vec3(0.0, 1.0, 0.0) * sin(uTime * 11.0 + ph + transformed.x * 4.0) * ${o.flutter.toFixed(3)} * str;
				` : ''}
			}`);
		}
		vs = vs.replace('#include <project_vertex>', `#include <project_vertex>
			{
				vec4 wpS = vec4(transformed, 1.0);
				#ifdef USE_INSTANCING
					wpS = instanceMatrix * wpS;
				#endif
				vWorldPosS = (modelMatrix * wpS).xyz;
			}`);

		fs = fs.replace('#include <common>', `#include <common>
			varying vec3 vWorldPosS;
			uniform float uTime;
			uniform sampler2D tNoise;
			${GLSL_NOISE}
			${o.shadow ? GLSL_TSHADOW : ''}
			${o.fog ? GLSL_FOG : ''}
			${o.snow ? 'uniform float uSnowLevel;' : ''}`);
		if (o.snow) {
			fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
			{
				vec3 wN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
				float nz = tfbm(vWorldPosS.xz * 0.11 + vWorldPosS.y * 0.05) - 0.5;
				float cover = smoothstep(0.42, 0.68, wN.y + nz * 0.5 + (${o.snow.toFixed(2)} - 0.5) * 0.6);
				diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.9, 0.96), cover);
				roughnessFactor = mix(roughnessFactor, 0.72, cover);
				metalnessFactor = mix(metalnessFactor, 0.0, cover);
			}`);
		}
		if (o.shadow) {
			fs = fs.replace('#include <lights_fragment_begin>', `float sTerrainShadow = terrainShadow(vWorldPosS);
			#include <lights_fragment_begin>`);
			fs = fs.replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace(
				'getDirectionalLightInfo( directionalLight, directLight );',
				'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= sTerrainShadow;'));
		}
		if (o.fog) fs = fs.replace('#include <fog_fragment>', 'gl_FragColor.rgb = applyAtmosphere(gl_FragColor.rgb, vWorldPosS);');
		sh.vertexShader = vs; sh.fragmentShader = fs;
		material.userData.shader = sh;
	};
	const key = `s${+o.fog}${+o.shadow}${o.snow}${o.sway}${o.flutter}`;
	const prevKey = material.customProgramCacheKey?.bind(material);
	material.customProgramCacheKey = () => key + (prevKey ? prevKey() : '');
	return material;
}

// ---------------------------------------------------------------- noise texture (tileable)
export function makeNoiseTexture(size = 256) {
	const data = new Uint8Array(size * size * 4);
	const lattice = (cells, seed) => {
		const g = new Float32Array(cells * cells);
		let s = seed;
		for (let i = 0; i < g.length; i++) { s = (s * 16807) % 2147483647; g[i] = s / 2147483647; }
		return g;
	};
	const freqs = [8, 16, 32, 64];
	for (let c = 0; c < 4; c++) {
		const cells = freqs[c];
		const g = lattice(cells, 1234 + c * 977);
		for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
			let v = 0, amp = 0.5, tot = 0;
			for (let o = 0; o < 3; o++) {
				const cc = cells << o;
				const gx = (x / size) * cc, gy = (y / size) * cc;
				const ix = Math.floor(gx), iy = Math.floor(gy);
				const fx = gx - ix, fy = gy - iy;
				const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
				const at = (i, j) => g[((j % cells) * cells + (i % cells)) % g.length] * 0.5 + g[(((j * 7 + o) % cells) * cells + ((i * 3 + o) % cells)) % g.length] * 0.5;
				const a = at(ix % cc, iy % cc), b = at((ix + 1) % cc, iy % cc), cc0 = at(ix % cc, (iy + 1) % cc), d = at((ix + 1) % cc, (iy + 1) % cc);
				v += amp * (a + (b - a) * ux + (cc0 - a) * uy + (a - b - cc0 + d) * ux * uy);
				tot += amp; amp *= 0.5;
			}
			data[(y * size + x) * 4 + c] = Math.round((v / tot) * 255);
		}
	}
	const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
	t.generateMipmaps = true; t.needsUpdate = true;
	return t;
}

// ---------------------------------------------------------------- texture library (Poly Haven, CC0)
const loader = new THREE.TextureLoader();
export const TEX = {};
export function loadTextures(renderer, onProgress) {
	const names = [
		'snow_diff', 'snow_nor', 'snow_rough', 'rock_diff', 'rock_nor', 'rock_rough',
		'extwood_diff', 'extwood_nor', 'extwood_arm', 'pine_diff', 'pine_nor', 'pine_arm',
		'floor_diff', 'floor_nor', 'floor_arm', 'stone_diff', 'stone_nor', 'stone_arm',
		'bark_diff', 'bark_nor', 'plaid_diff', 'plaid_nor', 'knit_diff', 'knit_nor', 'linen_nor', 'teddy_diff', 'teddy_nor',
	];
	const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
	let n = 0;
	return Promise.all(names.map((name) => new Promise((resolve) => {
		loader.load(new URL(`../textures/${name}.webp`, import.meta.url).href, (t) => {
			t.wrapS = t.wrapT = THREE.RepeatWrapping;
			t.anisotropy = aniso;
			if (name.endsWith('_diff')) t.colorSpace = THREE.SRGBColorSpace;
			TEX[name] = t; n++; onProgress?.(n / names.length); resolve();
		}, undefined, () => {
			// a missing texture should never stop the world from loading
			const d = new THREE.DataTexture(new Uint8Array(name.endsWith('_nor') ? [128, 128, 255, 255] : [200, 200, 200, 255]), 1, 1);
			d.needsUpdate = true; TEX[name] = d; n++; onProgress?.(n / names.length); resolve();
		});
	})));
}

// clone a texture with its own repeat
export function tex(name, rx = 1, ry = rx) {
	const t = TEX[name].clone();
	t.repeat.set(rx, ry);
	t.needsUpdate = true;
	return t;
}
