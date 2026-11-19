// CDLOD terrain: one small grid patch drawn as many instances, chosen every frame from a
// quadtree by distance, morphed in the vertex shader so levels meet without cracks. Heights
// come from three nested float grids; the snow/rock/ice look is built in the fragment shader.
import * as THREE from 'three';
import { U, GLSL_NOISE, GLSL_TERRAIN, GLSL_FOG, TEX } from './shading.js';
import { DETAIL, FINE, COARSE, VALLEY } from './world.js';

const WORLD = 65536;

export class Terrain {
	constructor(renderer, hf, q) {
		this.hf = hf;
		this.grid = q.terrainGrid;           // quads per patch side
		this.leaf = 32;                      // leaf node size (m)
		this.levels = 12;                    // 32 m ... 65536 m
		this.range0 = q.terrainRange;
		this.ranges = [];
		for (let l = 0; l < this.levels; l++) this.ranges.push(this.range0 * Math.pow(2, l));
		this.maxNodes = 1400;
		this.bounds = new Map();
		this.frustum = new THREE.Frustum();
		this._m = new THREE.Matrix4();
		this._box = new THREE.Box3();

		this.makeTextures();
		this.material = this.makeMaterial();
		this.geometry = this.makeGeometry();
		this.mesh = new THREE.Mesh(this.geometry, this.material);
		this.mesh.frustumCulled = false;
		this.mesh.receiveShadow = true;
		this.mesh.castShadow = false;
		this.mesh.name = 'terrain';
		this.shadow = new TerrainShadow(renderer, q);
	}

	makeTextures() {
		const hf = this.hf;
		const mk = (g, R) => {
			const t = new THREE.DataTexture(g.h, g.res, g.res, THREE.RedFormat, THREE.FloatType);
			t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
			const n = new Uint8Array(g.res * g.res * 4);
			for (let i = 0; i < g.n.length; i++) {
				const c = i & 3;
				const v = c < 2 ? g.n[i] * 0.5 + 0.5 : g.n[i];
				n[i] = Math.max(0, Math.min(255, Math.round(v * 255)));
			}
			const nt = new THREE.DataTexture(n, g.res, g.res, THREE.RGBAFormat);
			nt.minFilter = THREE.LinearMipmapLinearFilter; nt.magFilter = THREE.LinearFilter;
			nt.generateMipmaps = true; nt.anisotropy = 4; nt.needsUpdate = true;
			return [t, nt, new THREE.Vector4(R.x0, R.z0, R.size, g.res)];
		};
		[U.tHD.value, U.tND.value, U.uRD.value] = mk(hf.detail, DETAIL);
		[U.tHF.value, U.tNF.value, U.uRF.value] = mk(hf.fine, FINE);
		[U.tHC.value, U.tNC.value, U.uRC.value] = mk(hf.coarse, COARSE);
	}

	makeGeometry() {
		const N = this.grid;
		const base = new THREE.PlaneGeometry(1, 1, N, N);
		base.rotateX(-Math.PI / 2);
		base.translate(0.5, 0, 0.5);
		const g = new THREE.InstancedBufferGeometry();
		g.index = base.index;
		g.setAttribute('position', base.attributes.position);
		g.setAttribute('normal', base.attributes.normal);
		this.aNode = new THREE.InstancedBufferAttribute(new Float32Array(this.maxNodes * 4), 4);
		this.aMorph = new THREE.InstancedBufferAttribute(new Float32Array(this.maxNodes * 2), 2);
		this.aNode.setUsage(THREE.DynamicDrawUsage); this.aMorph.setUsage(THREE.DynamicDrawUsage);
		g.setAttribute('aNode', this.aNode);
		g.setAttribute('aMorph', this.aMorph);
		g.instanceCount = 0;
		g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
		return g;
	}

	makeMaterial() {
		const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0 });
		const N = this.grid.toFixed(1);
		const T = {
			tSnowN: { value: TEX.snow_nor }, tSnowD: { value: TEX.snow_diff }, tSnowR: { value: TEX.snow_rough },
			tRockN: { value: TEX.rock_nor }, tRockD: { value: TEX.rock_diff }, tRockR: { value: TEX.rock_rough },
		};
		m.onBeforeCompile = (sh) => {
			Object.assign(sh.uniforms, U, T);
			sh.vertexShader = sh.vertexShader
				.replace('#include <common>', `#include <common>
					attribute vec4 aNode; attribute vec2 aMorph;
					varying vec3 vWorldPosS; varying float vMorph;
					${GLSL_TERRAIN}`)
				.replace('#include <begin_vertex>', `
					vec2 gp = position.xz;
					vec2 wxz = aNode.xy + gp * aNode.z;
					float h0 = terrainH(wxz);
					float dist0 = distance(cameraPosition, vec3(wxz.x, h0, wxz.y));
					float mk = clamp((dist0 - aMorph.x) / (aMorph.y - aMorph.x), 0.0, 1.0);
					vec2 fr = fract(gp * ${N} * 0.5) * 2.0 / ${N};
					wxz -= fr * aNode.z * mk;
					vec3 transformed = vec3(wxz.x, terrainH(wxz), wxz.y);
					vWorldPosS = transformed; vMorph = mk;`);
			sh.fragmentShader = sh.fragmentShader
				.replace('#include <common>', `#include <common>
					varying vec3 vWorldPosS; varying float vMorph;
					uniform float uTime; uniform sampler2D tNoise;
					uniform sampler2D tND; uniform sampler2D tNF; uniform sampler2D tNC;
					uniform vec4 uRD; uniform vec4 uRF; uniform vec4 uRC;
					uniform sampler2D tShF; uniform sampler2D tShC;
					uniform sampler2D tSnowN; uniform sampler2D tSnowD; uniform sampler2D tSnowR;
					uniform sampler2D tRockN; uniform sampler2D tRockD; uniform sampler2D tRockR;
					uniform float uSnowLevel;
					${GLSL_NOISE}
					${GLSL_FOG}
					float edgeDistF(vec4 R, vec2 p){ vec2 a = p - R.xy; vec2 b = R.xy + R.z - p; return min(min(a.x, a.y), min(b.x, b.y)); }
					vec4 fieldAt(sampler2D t, vec4 R, vec2 p){ vec2 uv = (p - R.xy) / R.z * (R.w - 1.0) / R.w + 0.5 / R.w; return texture2D(t, uv); }
					vec4 terrainField(vec2 p, out float wd){
						wd = smoothstep(0.0, 48.0, edgeDistF(uRD, p));
						float wf = smoothstep(0.0, 160.0, edgeDistF(uRF, p));
						vec4 f = wf < 1.0 ? fieldAt(tNC, uRC, p) : vec4(0.0);
						if (wf > 0.0) f = mix(f, fieldAt(tNF, uRF, p), wf);
						if (wd > 0.0) f = mix(f, fieldAt(tND, uRD, p), wd);
						return f;
					}
					float terrainShadowT(vec2 p){
						vec2 uf = (p - uRF.xy) / uRF.z;
						vec2 uc = (p - uRC.xy) / uRC.z;
						float sc = texture2D(tShC, uc).r;
						vec2 e = min(uf, 1.0 - uf);
						float wf = smoothstep(0.0, 0.03, min(e.x, e.y));
						return wf > 0.0 ? mix(sc, texture2D(tShF, uf).r, wf) : sc;
					}
					vec3 unpackN(vec3 t){ return t * 2.0 - 1.0; }
					// whiteout-blended tangent normal on a horizontal plane (world space, y up)
					vec3 udnY(vec3 base, vec3 tn){ return normalize(vec3(base.x + tn.x, base.y, base.z + tn.y)); }
					vec3 triW(vec3 n){ vec3 w = pow(abs(n), vec3(4.0)); return w / (w.x + w.y + w.z); }
					float sTerrainShadowV; float sRock; float sCav; float sPath; float sIce; float sGlint;
				`)
				.replace('#include <map_fragment>', `
					vec3 P = vWorldPosS;
					float wdD;
					vec4 F = terrainField(P.xz, wdD);
					vec2 fxz = F.xy * 2.0 - 1.0;
					vec3 nM = normalize(vec3(fxz.x, sqrt(max(0.0, 1.0 - dot(fxz, fxz))), fxz.y));
					sPath = F.z * wdD; sCav = F.w;
					float camDist = distance(P, cameraPosition);
					float detailFade = 1.0 - smoothstep(180.0, 900.0, camDist);
					float slope = 1.0 - nM.y;
					float alt = P.y;
					// macro variation
					float m1 = tfbm(P.xz * 0.0011);
					float m2 = tfbm(P.xz * 0.0071 + 3.1);
					float m3 = tfbm(P.xz * 0.043 + 1.7);
					// exposed rock: steep faces, wind-scoured ridges; hollows hold snow
					float convex = sCav - 0.5;
					float thr = 0.4 + (m1 - 0.5) * 0.2 - convex * 0.35 - smoothstep(-200.0, 450.0, alt) * 0.04 - uSnowLevel * 0.1;
					float rockMask = smoothstep(thr, thr + 0.09, slope + (m3 - 0.5) * 0.1 * (0.3 + detailFade));
					rockMask *= 1.0 - smoothstep(0.2, 0.6, sPath);
					// rock texture (triplanar, two scales)
					vec3 tw = triW(nM);
					vec2 uvX = P.zy / 9.0, uvY = P.xz / 9.0, uvZ = P.xy / 9.0;
					vec3 rcol = texture2D(tRockD, uvX).rgb * tw.x + texture2D(tRockD, uvY).rgb * tw.y + texture2D(tRockD, uvZ).rgb * tw.z;
					vec3 rcol2 = texture2D(tRockD, P.zy / 61.0).rgb * tw.x + texture2D(tRockD, P.xz / 61.0).rgb * tw.y + texture2D(tRockD, P.xy / 61.0).rgb * tw.z;
					rcol = mix(rcol2, rcol * (0.6 + 0.8 * dot(rcol2, vec3(0.33))), detailFade);
					float rl = dot(rcol, vec3(0.299, 0.587, 0.114));
					vec3 rockAlb = mix(vec3(rl), rcol, 0.14) * mix(vec3(0.3, 0.315, 0.345), vec3(0.4, 0.39, 0.38), m2) * 1.25;
					rockAlb *= 0.7 + 0.5 * m3;
					// snow
					vec2 su = P.xz / 3.4;
					float snL = mix(0.94, texture2D(tSnowD, su).r * 0.25 + 0.75, detailFade * 0.7);
					float windPack = smoothstep(0.45, 0.75, sCav + (m2 - 0.5) * 0.4) * smoothstep(-300.0, 380.0, alt);
					vec3 snowAlb = vec3(0.93, 0.95, 0.985) * snL;
					snowAlb = mix(snowAlb, vec3(0.86, 0.9, 0.96), windPack * 0.6);
					// soft blue in hollows and couloirs
					snowAlb *= mix(vec3(1.0), vec3(0.84, 0.9, 1.0), smoothstep(0.48, 0.25, sCav) * 0.8);
					// icy patches high up and on wind-polished ridges
					sIce = smoothstep(0.62, 0.8, m3 * 0.6 + windPack * 0.5 + smoothstep(150.0, 480.0, alt) * 0.25) * (1.0 - sPath);
					snowAlb = mix(snowAlb, vec3(0.72, 0.82, 0.92), sIce * 0.55);
					// glaciers in the far valley floors: bluish ice with crevasses
					float glacier = smoothstep(${(VALLEY + 140).toFixed(1)}, ${(VALLEY + 40).toFixed(1)}, alt) * smoothstep(0.12, 0.03, slope) * smoothstep(2600.0, 3600.0, length(P.xz));
					float crev = smoothstep(0.92, 0.99, abs(sin(dot(P.xz, vec2(0.012, 0.007)) + tfbm(P.xz * 0.0009) * 18.0)));
					snowAlb = mix(snowAlb, mix(vec3(0.55, 0.7, 0.82), vec3(0.15, 0.22, 0.3), crev), glacier * 0.75);
					// the trampled route
					vec3 pathAlb = vec3(0.6, 0.63, 0.68) * (0.86 + 0.2 * vnoise(P.xz * 3.1)) * (0.9 + 0.1 * vnoise(P.xz * 0.4));
					snowAlb = mix(snowAlb, pathAlb, smoothstep(0.15, 0.85, sPath));
					sRock = rockMask;
					diffuseColor = vec4(mix(snowAlb, rockAlb, rockMask), 1.0);
				`)
				.replace('#include <color_fragment>', '')
				.replace('#include <roughnessmap_fragment>', `
					float sR = texture2D(tSnowR, P.xz / 3.4).r;
					float snowRough = mix(0.82, mix(0.55, 0.95, sR), detailFade);
					snowRough = mix(snowRough, 0.62, windPack * 0.6);
					snowRough = mix(snowRough, 0.16, sIce);
					snowRough = mix(snowRough, 0.25, glacier * 0.8);
					snowRough = mix(snowRough, 0.88, smoothstep(0.2, 0.9, sPath));
					float rR = texture2D(tRockR, uvY).r * tw.y + texture2D(tRockR, uvX).r * tw.x + texture2D(tRockR, uvZ).r * tw.z;
					float roughnessFactor = mix(snowRough, mix(0.75, rR, 0.6) + 0.1, rockMask);
				`)
				.replace('#include <normal_fragment_begin>', `
					float faceDirection = 1.0;
					// detail normals, faded out with distance
					vec3 nS1 = unpackN(texture2D(tSnowN, su).xyz);
					vec3 nS2 = unpackN(texture2D(tSnowN, P.xz / 19.0 + 0.37).xyz);
					vec3 snowT = vec3(nS1.xy * 0.9 + nS2.xy * 0.7, 1.0);
					// wind ripples (sastrugi) across the wind direction
					float rip = sin(dot(P.xz, vec2(0.95, 0.31)) * 1.7 + tfbm(P.xz * 0.05) * 9.0);
					snowT.xy += vec2(0.95, 0.31) * rip * 0.08 * windPack;
					vec3 nSnow = udnY(nM, vec3(snowT.xy * detailFade * (1.0 - sIce * 0.6), 1.0));
					// path: boot-churned dimples
					nSnow = normalize(nSnow + vec3(vnoise(P.xz * 4.0) - 0.5, 0.0, vnoise(P.xz * 4.0 + 7.0) - 0.5) * 0.35 * smoothstep(0.3, 0.9, sPath) * detailFade);
					// rock: triplanar UDN
					vec3 rX = unpackN(texture2D(tRockN, uvX).xyz), rY = unpackN(texture2D(tRockN, uvY).xyz), rZ = unpackN(texture2D(tRockN, uvZ).xyz);
					vec3 rX2 = unpackN(texture2D(tRockN, P.zy / 61.0).xyz), rY2 = unpackN(texture2D(tRockN, P.xz / 61.0).xyz), rZ2 = unpackN(texture2D(tRockN, P.xy / 61.0).xyz);
					float dk = 0.4 + 0.9 * detailFade;
					rX = rX * dk + rX2 * 0.9; rY = rY * dk + rY2 * 0.9; rZ = rZ * dk + rZ2 * 0.9;
					vec3 nRock = normalize(
						vec3(0.0, rX.y, rX.x) * tw.x + vec3(rY.x, 0.0, rY.y) * tw.y + vec3(rZ.x, rZ.y, 0.0) * tw.z + nM);
					// snow settles on rock ledges that face up
					float ledge = smoothstep(0.72, 0.9, nRock.y + (m3 - 0.5) * 0.3) * smoothstep(0.75, 0.45, slope);
					rockMask *= 1.0 - ledge * 0.85;
					diffuseColor.rgb = mix(snowAlb, rockAlb, rockMask);
					roughnessFactor = mix(snowRough, roughnessFactor, rockMask);
					sRock = rockMask;
					vec3 nW = normalize(mix(nSnow, nRock, rockMask));
					vec3 normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
					vec3 nonPerturbedNormal = normal;
					sTerrainShadowV = terrainShadowT(P.xz + nM.xz * 2.0);
					// glints: tiny facets catching the key light
					{
						vec2 cell = floor(P.xz * 38.0);
						vec2 r2 = hash22(cell);
						vec3 fn = normalize(nW + vec3(r2.x - 0.5, 0.0, r2.y - 0.5) * 0.9);
						vec3 Vw = normalize(cameraPosition - P);
						vec3 Hw = normalize(Vw + uSunDir);
						sGlint = pow(max(dot(Hw, fn), 0.0), 900.0) * step(0.6, hash12(cell + 17.0)) * (1.0 - rockMask) * (1.0 - smoothstep(25.0, 90.0, camDist)) * (1.0 - sPath);
					}
				`)
				.replace('#include <normal_fragment_maps>', '')
				.replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace(
					'getDirectionalLightInfo( directionalLight, directLight );',
					'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= sTerrainShadowV;') + `
					#if NUM_DIR_LIGHTS > 0
						reflectedLight.directSpecular += directLight.color * sGlint * 9.0;
					#endif
				`)
				.replace('#include <aomap_fragment>', `
					{
						float ambientOcclusion = mix(0.6, 1.0, smoothstep(0.18, 0.52, sCav)) * mix(1.0, 0.75, sRock);
						reflectedLight.indirectDiffuse *= ambientOcclusion;
						#if defined( USE_ENVMAP ) && defined( STANDARD )
							float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
							reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
						#endif
					}`)
				.replace('#include <fog_fragment>', 'gl_FragColor.rgb = applyAtmosphere(gl_FragColor.rgb, vWorldPosS);');
			m.userData.shader = sh;
		};
		m.customProgramCacheKey = () => 'terrain' + this.grid;
		return m;
	}

	nodeBounds(x0, z0, size, level) {
		const key = x0 + ',' + z0 + ',' + level;
		let b = this.bounds.get(key);
		if (b) return b;
		const k = 8;
		let mn = 1e9, mx = -1e9;
		for (let j = 0; j <= k; j++) for (let i = 0; i <= k; i++) {
			const h = this.hf.height(x0 + (i / k) * size, z0 + (j / k) * size);
			if (h < mn) mn = h; if (h > mx) mx = h;
		}
		const pad = 3 + (mx - mn) * 0.15 + size * 0.02;
		b = [mn - pad, mx + pad];
		if (this.bounds.size > 60000) this.bounds.clear();
		this.bounds.set(key, b);
		return b;
	}

	update(camera) {
		this._m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
		this.frustum.setFromProjectionMatrix(this._m);
		const cam = camera.position;
		const nodes = this.aNode.array, morphs = this.aMorph.array;
		let count = 0;
		const ranges = this.ranges;
		const box = this._box;
		const self = this;
		const dist2 = (x0, z0, size, y0, y1) => {
			const dx = Math.max(x0 - cam.x, 0, cam.x - (x0 + size));
			const dz = Math.max(z0 - cam.z, 0, cam.z - (z0 + size));
			const dy = Math.max(y0 - cam.y, 0, cam.y - y1);
			return dx * dx + dy * dy + dz * dz;
		};
		const add = (x0, z0, size, level) => {
			if (count >= self.maxNodes) return;
			const o = count * 4;
			nodes[o] = x0; nodes[o + 1] = z0; nodes[o + 2] = size; nodes[o + 3] = level;
			const r = ranges[level], prev = level > 0 ? ranges[level - 1] : 0;
			morphs[count * 2] = prev + (r - prev) * 0.72;
			morphs[count * 2 + 1] = r * 0.98;
			count++;
		};
		const visit = (x0, z0, size, level) => {
			const [y0, y1] = self.nodeBounds(x0, z0, size, level);
			const r = ranges[level];
			if (dist2(x0, z0, size, y0, y1) > r * r) return false;
			box.min.set(x0, y0, z0); box.max.set(x0 + size, y1, z0 + size);
			if (!self.frustum.intersectsBox(box)) return true;
			if (level === 0) { add(x0, z0, size, 0); return true; }
			const rp = ranges[level - 1];
			if (dist2(x0, z0, size, y0, y1) > rp * rp) { add(x0, z0, size, level); return true; }
			const h = size / 2;
			for (let c = 0; c < 4; c++) {
				const cx = x0 + (c & 1) * h, cz = z0 + (c >> 1) * h;
				if (!visit(cx, cz, h, level - 1)) {
					const [cy0, cy1] = self.nodeBounds(cx, cz, h, level - 1);
					box.min.set(cx, cy0, cz); box.max.set(cx + h, cy1, cz + h);
					if (self.frustum.intersectsBox(box)) add(cx, cz, h, level - 1);
				}
			}
			return true;
		};
		const top = this.levels - 1;
		const rootSize = this.leaf * Math.pow(2, top);
		const half = WORLD / 2;
		for (let z = -half; z < half; z += rootSize) for (let x = -half; x < half; x += rootSize) {
			if (!visit(x, z, rootSize, top)) {
				const [y0, y1] = this.nodeBounds(x, z, rootSize, top);
				box.min.set(x, y0, z); box.max.set(x + rootSize, y1, z + rootSize);
				if (this.frustum.intersectsBox(box)) add(x, z, rootSize, top);
			}
		}
		this.geometry.instanceCount = count;
		this.aNode.needsUpdate = true; this.aMorph.needsUpdate = true;
		this.aNode.addUpdateRange(0, count * 4); this.aMorph.addUpdateRange(0, count * 2);
		this.count = count;
	}
}

// ---------------------------------------------------------------- terrain self-shadow
// Ray-marches the height grids toward the key light and stores a soft visibility term for
// the fine (massif) and coarse (world) areas. Re-run when the light direction changes.
class TerrainShadow {
	constructor(renderer, q) {
		this.renderer = renderer;
		const mk = (s) => {
			const rt = new THREE.WebGLRenderTarget(s, s, { type: THREE.UnsignedByteType, depthBuffer: false });
			rt.texture.minFilter = THREE.LinearFilter; rt.texture.magFilter = THREE.LinearFilter; rt.texture.generateMipmaps = false;
			return rt;
		};
		this.fine = mk(q.shadowRes); this.coarse = mk(Math.min(1024, q.shadowRes));
		U.tShF.value = this.fine.texture; U.tShC.value = this.coarse.texture;
		this.mat = new THREE.ShaderMaterial({
			uniforms: { ...U, uRegion: { value: new THREE.Vector4() }, uLight: { value: new THREE.Vector3(0, 1, 0) }, uStep0: { value: 4 }, uSteps: { value: 64 }, uK: { value: 1.07 } },
			vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
			fragmentShader: /* glsl */`
				precision highp float;
				varying vec2 vUv;
				uniform vec4 uRegion; uniform vec3 uLight; uniform float uStep0; uniform float uK;
				${GLSL_TERRAIN}
				void main(){
					vec2 p = uRegion.xy + vUv * uRegion.z;
					float h0 = terrainH(p) + 1.5;
					vec3 L = normalize(uLight);
					float horiz = max(length(L.xz), 1e-3);
					vec2 dir = L.xz / horiz;
					float rise = L.y / horiz;
					float vis = 1.0;
					float t = uStep0;
					for (int i = 0; i < 72; i++) {
						vec2 q = p + dir * t;
						float rayH = h0 + t * rise;
						float th = terrainH(q);
						vis = min(vis, clamp((rayH - th) / (t * 0.035 + 1.0) * 0.5 + 0.5, 0.0, 1.0));
						if (vis <= 0.0 || rayH > 700.0) break;
						t *= uK;
					}
					vis = smoothstep(0.0, 1.0, vis);
					if (L.y <= 0.0) vis = 0.0;
					gl_FragColor = vec4(vis, vis, vis, 1.0);
				}`,
			depthTest: false, depthWrite: false,
		});
		this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
		this.scene = new THREE.Scene(); this.scene.add(this.quad);
		this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	}
	update(lightDir) {
		const r = this.renderer, prev = r.getRenderTarget();
		const u = this.mat.uniforms;
		u.uLight.value.copy(lightDir);
		u.uRegion.value.set(FINE.x0, FINE.z0, FINE.size, 0); u.uStep0.value = 3; u.uK.value = 1.085;
		r.setRenderTarget(this.fine); r.render(this.scene, this.cam);
		u.uRegion.value.set(COARSE.x0, COARSE.z0, COARSE.size, 0); u.uStep0.value = 70; u.uK.value = 1.07;
		r.setRenderTarget(this.coarse); r.render(this.scene, this.cam);
		r.setRenderTarget(prev);
	}
}
