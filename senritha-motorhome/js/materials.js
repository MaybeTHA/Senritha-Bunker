// PBR material library and small shader extensions (snow sparkle, snow-laden foliage, swaying curtains).
import * as THREE from 'three';

export const U = { time: { value: 0 } };

function rep(tex, size, sy = size) {
	const t = tex.clone();
	t.repeat.set(1 / size, 1 / sy);
	t.needsUpdate = true;
	return t;
}

const SPARKLE_FRAG = /* glsl */`
varying vec3 vSpW;
float spHash(vec3 p){ p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
`;

export function addSparkle(mat, strength = 1) {
	const prev = mat.onBeforeCompile;
	mat.onBeforeCompile = (sh, r) => {
		prev && prev(sh, r);
		sh.vertexShader = sh.vertexShader
			.replace('#include <common>', '#include <common>\nvarying vec3 vSpW;')
			.replace('#include <project_vertex>', '#include <project_vertex>\nvSpW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
		sh.fragmentShader = sh.fragmentShader
			.replace('#include <common>', '#include <common>\n' + SPARKLE_FRAG)
			.replace('#include <opaque_fragment>', /* glsl */`
			{
				vec3 cell = floor(vSpW * 70.0);
				float h = spHash(cell);
				vec3 rn = normalize(vec3(spHash(cell + 1.3) - 0.5, spHash(cell + 2.7) * 0.8 + 0.6, spHash(cell + 4.1) - 0.5));
				vec3 vd = normalize(cameraPosition - vSpW);
				float g = step(0.982, h) * pow(max(dot(vd, rn), 0.0), 60.0);
				float fade = smoothstep(28.0, 3.0, distance(cameraPosition, vSpW));
				vec3 lit = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse * 0.35;
				outgoingLight += g * fade * lit * ${(40 * strength).toFixed(1)};
			}
			#include <opaque_fragment>`);
	};
	mat.customProgramCacheKey = () => 'sparkle' + strength;
	return mat;
}

// Snow that settles on surfaces facing `dir` (world space). Optional per-vertex AO attribute `aAO`.
export function addSnowCover(mat, { dir = [0, 1, 0], lo = 0.05, hi = 0.5, amount = 0.95, ao = false, color = [0.86, 0.9, 0.97] } = {}) {
	mat.userData.snow = { value: amount };
	const d = new THREE.Vector3(...dir).normalize();
	mat.onBeforeCompile = (sh) => {
		sh.uniforms.uSnow = mat.userData.snow;
		sh.vertexShader = sh.vertexShader
			.replace('#include <common>', `#include <common>\nvarying float vSnowUp;\n${ao ? 'attribute float aAO; varying float vAO;' : ''}`)
			.replace('#include <beginnormal_vertex>', /* glsl */`#include <beginnormal_vertex>
				vec3 snN = objectNormal;
				#ifdef USE_INSTANCING
				snN = mat3(instanceMatrix) * snN;
				#endif
				vSnowUp = dot(normalize(mat3(modelMatrix) * snN), vec3(${d.x.toFixed(3)}, ${d.y.toFixed(3)}, ${d.z.toFixed(3)}));
				${ao ? 'vAO = aAO;' : ''}`);
		sh.fragmentShader = sh.fragmentShader
			.replace('#include <common>', `#include <common>\nuniform float uSnow;\nvarying float vSnowUp;\n${ao ? 'varying float vAO;' : ''}`)
			.replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
				{
					float up = vSnowUp * (gl_FrontFacing ? 1.0 : -1.0);
					float sn = smoothstep(${lo.toFixed(3)}, ${hi.toFixed(3)}, up ${ao ? '+ (vAO - 0.7) * 0.35' : ''});
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${color.map((c) => c.toFixed(3)).join(',')}), sn * uSnow);
					${ao ? 'diffuseColor.rgb *= vAO;' : ''}
				}`);
	};
	mat.customProgramCacheKey = () => `snow${d.x}${d.y}${d.z}${lo}${hi}${ao}`;
	return mat;
}

// Gentle drift for fabric hanging in warm, moving air. Needs a per-vertex `aSway` attribute (0 at the rod).
export function addSway(mat, amp = 0.012) {
	mat.onBeforeCompile = (sh) => {
		sh.uniforms.uTime = U.time;
		sh.vertexShader = sh.vertexShader
			.replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aSway;')
			.replace('#include <begin_vertex>', /* glsl */`#include <begin_vertex>
				float swp = uTime * 0.55 + position.x * 3.0 + position.z * 3.0;
				transformed.x += sin(swp + position.y * 1.7) * ${amp.toFixed(4)} * aSway;
				transformed.z += cos(swp * 0.8 + position.y * 2.3) * ${amp.toFixed(4)} * aSway;`);
	};
	mat.customProgramCacheKey = () => 'sway' + amp;
	return mat;
}

export function buildMaterials(T) {
	const I = [], E = [];
	const std = (o, list = I) => { const m = new THREE.MeshStandardMaterial(o); list.push(m); return m; };
	const phy = (o, list = I) => { const m = new THREE.MeshPhysicalMaterial(o); list.push(m); return m; };
	const basic = (rgb) => new THREE.MeshBasicMaterial({ color: new THREE.Color(rgb[0], rgb[1], rgb[2]), toneMapped: true });

	const m = {};
	m.floor = std({ map: rep(T.floor.map, 1.9), roughnessMap: rep(T.floor.rough, 1.9), normalMap: rep(T.floor.normal, 1.9), normalScale: new THREE.Vector2(0.7, 0.7) });
	m.wall = std({ map: rep(T.wall.map, 2.1), roughnessMap: rep(T.wall.rough, 2.1), normalMap: rep(T.wall.normal, 2.1), normalScale: new THREE.Vector2(0.6, 0.6) });
	m.ceiling = std({ map: rep(T.ceiling.map, 1.4), roughnessMap: rep(T.ceiling.rough, 1.4), normalMap: rep(T.ceiling.normal, 1.4) });
	m.walnut = phy({ map: rep(T.walnut.map, 1.1), roughnessMap: rep(T.walnut.rough, 1.1), normalMap: rep(T.walnut.normal, 1.1), normalScale: new THREE.Vector2(0.25, 0.25), clearcoat: 0.35, clearcoatRoughness: 0.4 });
	m.walnutTrim = phy({ map: rep(T.walnut.map, 0.6), roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4, color: 0xd8c8b8 });
	m.oak = std({ map: rep(T.floor.map, 1.2), roughnessMap: rep(T.floor.rough, 1.2), normalMap: rep(T.floor.normal, 1.2), color: 0xf2e6da });
	m.brass = std({ color: 0xc9a46a, metalness: 1, roughness: 0.3, roughnessMap: T.brushed });
	m.bronze = std({ color: 0x5a4433, metalness: 0.85, roughness: 0.42 });
	m.iron = std({ color: 0x1d1c1b, metalness: 0.6, roughness: 0.58 });
	m.steel = std({ color: 0xd2d2cf, metalness: 1, roughness: 0.26, roughnessMap: rep(T.brushed, 0.5) });
	m.blackMatte = std({ color: 0x161514, roughness: 0.75 });
	m.quartz = phy({ map: rep(T.quartz, 1.0), roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.12 });
	m.zellige = phy({ map: rep(T.zellige.map, 0.6), normalMap: rep(T.zellige.normal, 0.6), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06 });
	m.stone = std({ map: rep(T.stone.map, 0.9), normalMap: rep(T.stone.normal, 0.9), roughnessMap: rep(T.stone.rough, 0.9), normalScale: new THREE.Vector2(1.2, 1.2) });
	m.hearth = std({ map: rep(T.stone.map, 0.6), normalMap: rep(T.stone.normal, 0.6), roughness: 0.7, color: 0x9a948c });

	const fab = (color, t, scale, o = {}) => phy({
		color, map: rep(t.map, scale), normalMap: rep(t.normal, scale), roughness: 0.95,
		sheen: 1, sheenColor: new THREE.Color(o.sheen ?? 0xfff3e2), sheenRoughness: o.sr ?? 0.65, ...o.extra,
	});
	m.sofa = fab(0xe6dac8, T.boucle, 0.32);
	m.cushionLinen = fab(0xeee5d6, T.linen, 0.25);
	m.pillowRust = fab(0x93492a, T.velvet, 0.4, { sheen: 0xffb48a, sr: 0.35 });
	m.pillowOlive = fab(0x6b6744, T.velvet, 0.4, { sheen: 0xe8e0b0, sr: 0.35 });
	m.pillowBrown = fab(0x6f4e37, T.knit, 0.3);
	m.pillowCream = fab(0xece2d2, T.knit, 0.3);
	m.throwKnit = fab(0xefe5d6, T.knit, 0.42, { extra: { side: THREE.DoubleSide } });
	m.tartan = fab(0xffffff, T.tartan, 0.6, { sheen: 0xffe8cc, extra: { side: THREE.DoubleSide } });
	m.duvet = fab(0xf5efe4, T.linen, 0.3);
	m.duvetDrape = fab(0xf5efe4, T.linen, 0.3, { extra: { side: THREE.DoubleSide } });
	m.sheet = fab(0xe9e0d0, T.linen, 0.25);
	m.headboard = fab(0xcbb59a, T.boucle, 0.3);
	m.fur = fab(0xf2ece2, T.fur, 0.25, { sheen: 0xffffff, sr: 0.9 });
	m.leather = phy({ color: 0xb06a3c, map: rep(T.leather.map, 0.35), normalMap: rep(T.leather.normal, 0.35), roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.5 });
	m.leatherDark = phy({ color: 0x8a6a58, map: rep(T.leather.map, 0.35), normalMap: rep(T.leather.normal, 0.35), roughness: 0.5, clearcoat: 0.2 });
	m.rug = std({ map: T.rug.map, normalMap: T.rug.normal, roughness: 0.95 });
	m.curtain = addSway(phy({ color: 0xe8dcc8, map: rep(T.linen.map, 0.22), normalMap: rep(T.linen.normal, 0.22), roughness: 0.92, sheen: 0.8, sheenColor: new THREE.Color(0xfff0dc), side: THREE.DoubleSide }));
	m.ceramic = phy({ color: 0xeee6d8, roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.08 });
	m.ceramicDark = phy({ color: 0x3e3a36, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 });
	m.ceramicSage = phy({ color: 0x8e9a82, roughness: 0.35, clearcoat: 0.6 });
	m.terracotta = std({ color: 0xb36848, roughness: 0.88 });
	m.enamel = phy({ color: 0xe9e0cf, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 });
	m.coffee = phy({ map: T.latte, roughness: 0.25, clearcoat: 0.6 });
	m.glass = phy({ color: 0xffffff, transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
	m.glassAmber = phy({ color: 0xd08a3c, transparent: true, opacity: 0.45, roughness: 0.06, depthWrite: false });
	m.window = phy({ color: 0x9fb2bf, transparent: true, opacity: 0.1, roughness: 0.02, metalness: 0.1, depthWrite: false, envMapIntensity: 1.4 });
	m.stoveGlass = phy({ color: 0x2a1d16, transparent: true, opacity: 0.32, roughness: 0.08, depthWrite: false });
	m.frost = new THREE.MeshBasicMaterial({ color: 0xdfe8f2, alphaMap: T.frost, transparent: true, opacity: 0.2, depthWrite: false });
	m.globe = std({ color: 0xfff1df, emissive: 0xffa95e, emissiveIntensity: 1.7, roughness: 0.55 });
	m.bulb = basic([6, 3.6, 1.6]);
	m.led = basic([3.2, 2.1, 1.15]);
	m.ledCool = basic([2.2, 2.1, 1.9]);
	m.fairy = new THREE.MeshBasicMaterial({ color: 0xffffff });
	m.leaf = std({ color: 0x4d7a41, roughness: 0.5, side: THREE.DoubleSide, vertexColors: true });
	m.stem = std({ color: 0x5e6b3e, roughness: 0.7 });
	m.dried = std({ color: 0xb59a76, roughness: 0.85, side: THREE.DoubleSide });
	m.paper = std({ map: T.pages, roughness: 0.85 });
	m.pagesBlock = std({ color: 0xe9dcc3, roughness: 0.9 });
	m.books = std({ map: T.spine, roughness: 0.72 });
	m.wax = phy({ color: 0xf1e7d2, roughness: 0.45, sheen: 0.4, emissive: 0xff9a50, emissiveIntensity: 0.08 });
	m.dash = std({ color: 0x2c2522, roughness: 0.7 });
	m.rubber = std({ color: 0x1a1918, roughness: 0.92 });
	m.painting = std({ map: T.painting, roughness: 0.62 });
	m.fern = std({ map: T.fern, roughness: 0.8 });
	m.photos = T.photos.map((t) => std({ map: t, roughness: 0.4 }));
	m.clock = std({ map: T.clock, roughness: 0.5 });
	m.birch = std({ map: rep(T.birch.map, 0.4, 0.5), normalMap: rep(T.birch.normal, 0.4, 0.5), roughness: 0.85 });
	m.endGrain = std({ map: T.endGrain, roughness: 0.9 });
	m.emberLog = std({ map: rep(T.birch.map, 0.4), color: 0x3a2c24, emissiveMap: rep(T.embers, 0.3), emissive: 0xff7a2a, emissiveIntensity: 2.5, roughness: 0.95 });
	m.ash = std({ color: 0x4a4440, roughness: 1 });
	m.mirror = std({ color: 0xf2f2f2, metalness: 1, roughness: 0.02 });
	m.plantPot = phy({ color: 0xd9cfbf, roughness: 0.6, clearcoat: 0.2 });
	m.orange = std({ color: 0xe0782a, roughness: 0.55, normalMap: rep(T.leather.normal, 0.05) });
	m.apple = phy({ color: 0x9c2a22, roughness: 0.35, clearcoat: 0.4 });
	m.bread = std({ color: 0xb87a42, roughness: 0.8, normalMap: rep(T.boucle.normal, 0.1) });
	m.cookie = std({ color: 0xa8743c, roughness: 0.85, normalMap: rep(T.boucle.normal, 0.06) });
	m.wool = fab(0x7b5a44, T.knit, 0.15);
	m.woolRed = fab(0x8b3a2b, T.knit, 0.15);

	// exterior
	m.paintR = phy({ map: T.sideR, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 }, E);
	m.paintL = phy({ map: T.sideL, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 }, E);
	m.paint = phy({ color: 0xebe6de, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 }, E);
	m.paintDark = phy({ color: 0x3a291f, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 }, E);
	m.chrome = std({ color: 0xffffff, metalness: 1, roughness: 0.1 }, E);
	m.trim = std({ color: 0x151515, roughness: 0.5 }, E);
	m.tire = std({ color: 0x1b1b1b, roughness: 0.9, normalMap: rep(T.leather.normal, 0.08) }, E);
	m.alloy = std({ color: 0xbfc2c4, metalness: 1, roughness: 0.3 }, E);
	m.lens = phy({ color: 0xffffff, transparent: true, opacity: 0.4, roughness: 0.05, depthWrite: false }, E);
	m.lamp = std({ color: 0xfff1d8, emissive: 0xffc27a, emissiveIntensity: 4 }, E);
	m.tail = std({ color: 0x5a0d08, emissive: 0x6a0a04, emissiveIntensity: 0.6, roughness: 0.3 }, E);
	m.snow = addSparkle(std({ map: rep(T.snow.map, 3), normalMap: rep(T.snow.normal, 3), roughness: 0.78, color: 0xf4f7fc }, E));
	m.snowSoft = addSparkle(std({ map: rep(T.snow.map, 1.2), normalMap: rep(T.snow.normal, 1.2), roughness: 0.8, color: 0xf6f8fc }, E), 0.6);
	m.ice = phy({ color: 0xe2f0fb, roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false, clearcoat: 1 }, E);
	m.bark = addSnowCover(std({ map: rep(T.bark.map, 0.9, 2.4), normalMap: rep(T.bark.normal, 0.9, 2.4), roughness: 0.95 }, E), { dir: [-0.75, 0.35, 0.3], lo: 0.25, hi: 0.6, amount: 0.9 });
	m.frond = addSnowCover(std({ map: T.frond, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.92 }, E), { dir: [0, 1, 0], lo: -0.05, hi: 0.42, ao: true });
	m.frondDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: T.frond, alphaTest: 0.42, side: THREE.DoubleSide });
	m.logPile = addSnowCover(std({ map: rep(T.bark.map, 0.5, 0.8), normalMap: rep(T.bark.normal, 0.5, 0.8), roughness: 0.95, color: 0xb8a898 }, E), { lo: 0.4, hi: 0.75 });
	m.endGrainExt = std({ map: T.endGrain, roughness: 0.9, color: 0xc9bcae }, E);
	m.canvasChair = addSnowCover(std({ color: 0x4b3a2e, roughness: 0.9, map: rep(T.linen.map, 0.2) }, E), { lo: 0.3, hi: 0.7 });
	m.metalDark = std({ color: 0x2b2724, metalness: 0.7, roughness: 0.55 }, E);
	m.rock = addSnowCover(std({ color: 0x6d6862, roughness: 0.95, map: rep(T.stone.map, 0.7), normalMap: rep(T.stone.normal, 0.7) }, E), { lo: 0.15, hi: 0.5 });
	m.extWood = std({ map: rep(T.walnut.map, 0.8), roughness: 0.7, color: 0xb09a88 }, E);
	m.footprints = new THREE.MeshStandardMaterial({ color: 0x9fb0c8, alphaMap: T.footprints, transparent: true, opacity: 0.55, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
	E.push(m.footprints);

	return { m, interior: I, exterior: E };
}
