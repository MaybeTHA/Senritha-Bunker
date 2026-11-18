// Senritha's Motorhome 3D: renderer, post-processing, quality tiers, camera shots and UI.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { buildTextures } from './textures.js';
import { buildMaterials, U } from './materials.js';
import { buildMotorhome } from './motorhome.js';
import { buildNature, skyMaterial, groundHeight, SKY } from './nature.js';
import { Rig } from './camera.js';
import { Ambience } from './audio.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const store = {
	get(k, d) { try { const v = localStorage.getItem('smh3d.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
	set(k, v) { try { localStorage.setItem('smh3d.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

// ---------------------------------------------------------------- quality tiers
const TIERS = {
	high: { pr: 2, msaa: 4, ao: true, fireShadow: true, porchShadow: true, moonShadow: 2048, trees: 950, nearRadius: 44, snow: 16000, fogBanks: 22, groundRes: 220, motes: 260, windowFill: true },
	balanced: { pr: 1.5, msaa: 4, ao: false, fireShadow: true, porchShadow: true, moonShadow: 2048, trees: 750, nearRadius: 36, snow: 10000, fogBanks: 16, groundRes: 180, motes: 180, windowFill: true },
	low: { pr: 1.25, msaa: 2, ao: false, fireShadow: false, porchShadow: false, moonShadow: 1024, trees: 420, nearRadius: 26, snow: 5500, fogBanks: 10, groundRes: 140, motes: 110, windowFill: false },
};
const coarse = matchMedia('(pointer: coarse)').matches;
const small = Math.min(screen.width, screen.height) < 820;
const mobile = coarse && small;
const qParam = params.get('q');
let qSetting = qParam || store.get('quality', 'auto');
const buildTier = qParam && TIERS[qParam] ? qParam : (mobile ? 'low' : 'high');
const Q = { ...TIERS[buildTier] };
if (mobile) Q.pr = Math.min(Q.pr, 1.5);

// ---------------------------------------------------------------- shots
const SHOTS = {
	overview: { space: 'interior', mode: 'orbit', pos: [4.05, 1.72, 0.78], look: [0.4, 0.82, -0.25] },
	walk: { space: 'interior', mode: 'walk', pos: [3.05, 1.62, 0.05], look: [0, 1.42, -0.1] },
	fire: { space: 'interior', mode: 'orbit', pos: [1.72, 0.98, 0.22], look: [0.9, 0.42, -0.86] },
	coffee: { space: 'interior', mode: 'orbit', pos: [1.27, 1.08, 0.4], look: [1.62, 0.8, 0.77] },
	kitchen: { space: 'interior', mode: 'orbit', pos: [0.85, 1.58, -0.6], look: [-0.45, 1.02, 0.86] },
	bedroom: { space: 'interior', mode: 'orbit', pos: [-1.98, 1.72, 0.18], look: [-3.5, 0.62, -0.02] },
	window: { space: 'interior', mode: 'walk', pos: [2.35, 1.08, -0.3], look: [2.45, 1.22, -3.2], fov: 60 },
	outside: { space: 'exterior', mode: 'orbit', pos: [9.8, 2.5, 9.2], look: [0.8, 0.7, 0.2] },
	porch: { space: 'exterior', mode: 'orbit', pos: [5.6, 0.75, 5.6], look: [2.9, 0.6, 1.6] },
	forest: { space: 'exterior', mode: 'orbit', pos: [23, 4.2, 6.5], look: [0.3, 1.2, 0] },
};
const TOUR = [
	{ space: 'exterior', from: [30, 5.5, 11], to: [19, 3.2, 5.5], lookFrom: [0.6, 1.4, 0], lookTo: [0.6, 1.0, 0], dur: 9, fov: 45 },
	{ space: 'exterior', from: [7.2, 0.9, 7.4], to: [5.4, 0.7, 5.0], lookFrom: [3.0, 1.0, 1.4], lookTo: [3.1, 1.25, 1.3], dur: 8, fov: 48 },
	{ space: 'interior', from: [4.1, 1.72, 0.82], to: [3.65, 1.55, 0.62], lookFrom: [0.2, 0.9, -0.3], lookTo: [-0.6, 0.95, -0.15], dur: 9, fov: 52 },
	{ space: 'interior', from: [1.75, 0.62, -0.12], to: [1.48, 0.55, -0.32], lookFrom: [0.9, 0.42, -0.88], dur: 8, fov: 46 },
	{ space: 'interior', from: [1.22, 1.02, 0.36], to: [1.33, 0.96, 0.46], lookFrom: [1.62, 0.8, 0.77], lookTo: [1.62, 0.85, 0.77], dur: 8, fov: 42 },
	{ space: 'interior', from: [2.3, 1.12, 0.25], to: [2.32, 1.18, -0.45], lookFrom: [2.4, 1.25, -3], dur: 8, fov: 55 },
	{ space: 'interior', from: [0.7, 1.45, 0.25], to: [0.25, 1.4, 0.18], lookFrom: [-0.6, 1.45, -1.1], lookTo: [-0.15, 1.4, -1.1], dur: 8, fov: 50 },
	{ space: 'interior', from: [-2.1, 1.5, 0.3], to: [-2.42, 1.32, 0.1], lookFrom: [-3.8, 0.8, 0], dur: 8, fov: 52 },
	{ space: 'exterior', from: [12, 4.2, -7], to: [13.5, 4.8, 4], lookFrom: [0, 1.2, 0], lookTo: [0.5, 1.0, 0.5], dur: 10, fov: 45 },
];

// ---------------------------------------------------------------- grade pass (vignette + grain, in display space)
const GradeShader = {
	uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
	vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
	fragmentShader: /* glsl */`
		uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
		void main(){
			vec4 c = texture2D(tDiffuse, vUv);
			vec2 d = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
			float v = smoothstep(1.05, 0.25, length(d));
			c.rgb *= mix(0.68, 1.0, v);
			float g = fract(sin(dot(vUv * uRes + fract(uTime * 7.13) * 91.0, vec2(12.9898, 78.233))) * 43758.5453);
			c.rgb += (g - 0.5) * 0.022;
			gl_FragColor = c;
		}`,
};

let renderer, scene, camera, composer, bloom, gtao, aoCam, grade, rig, motor, nature, mats, audio;
const updaters = [];
let time = 0;
let currentShot = null;

function setProgress(p, label) {
	$('bar').style.width = `${Math.round(p * 100)}%`;
	$('loader').setAttribute('aria-valuenow', String(Math.round(p * 100)));
	if (label) $('step').textContent = label;
}
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

const LABELS = {
	floor: 'Sanding the oak floor', wall: 'Panelling the walls', walnut: 'Oiling the walnut cabinets', boucle: 'Weaving the sofa bouclé',
	knit: 'Knitting the throw', stone: 'Laying the stone hearth', bark: 'Growing spruce bark', frond: 'Shaping spruce boughs',
	painting: 'Painting the Sierra at dusk', photos: 'Developing travel photos', frost: 'Frosting the windows', birch: 'Splitting birch logs',
};

async function init() {
	renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
	renderer.setPixelRatio(Math.min(devicePixelRatio, Q.pr));
	renderer.setSize(innerWidth, innerHeight);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.05;
	$('stage').appendChild(renderer.domElement);

	scene = new THREE.Scene();
	scene.fog = new THREE.FogExp2(SKY.horizon.clone(), 0.021);
	camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.03, 700);
	camera.layers.enable(1);

	setProgress(0.02, 'Preparing materials');
	await nextFrame();
	const T = await buildTextures(renderer, (p, k) => setProgress(0.02 + p * 0.58, LABELS[k]));
	mats = buildMaterials(T);
	setProgress(0.62, 'Building the motorhome');
	await nextFrame();
	motor = buildMotorhome(mats, T, Q);
	scene.add(motor.group);
	setProgress(0.74, `Planting ${Q.trees} spruce`);
	await nextFrame();
	nature = buildNature(mats, T, Q, motor);
	scene.add(nature.group);
	updaters.push(...motor.updaters, ...nature.updaters);

	setProgress(0.84, 'Lighting the stove');
	await nextFrame();
	buildEnvironments();

	// post-processing
	const size = renderer.getDrawingBufferSize(new THREE.Vector2());
	const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: Q.msaa });
	composer = new EffectComposer(renderer, rt);
	composer.setPixelRatio(renderer.getPixelRatio());
	composer.setSize(innerWidth, innerHeight);
	composer.addPass(new RenderPass(scene, camera));
	if (Q.ao) {
		aoCam = camera.clone(); aoCam.layers.set(0);
		gtao = new GTAOPass(scene, aoCam, innerWidth, innerHeight);
		gtao.updateGtaoMaterial({ radius: 0.32, distanceExponent: 1.6, thickness: 1.0, scale: 1.15, samples: 12, distanceFallOff: 1.0 });
		gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
		gtao.blendIntensity = 0.9;
		composer.addPass(gtao);
	}
	bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.55, 0.92);
	composer.addPass(bloom);
	composer.addPass(new OutputPass());
	grade = new ShaderPass(GradeShader);
	composer.addPass(grade);

	// camera rig
	const pickables = [];
	scene.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.layers.test(new THREE.Layers())) pickables.push(o); });
	rig = new Rig(camera, renderer.domElement, {
		interiorBox: motor.interiorBox, bodyBox: motor.bodyBox, colliders: motor.colliders,
		groundHeight, trunks: nature.trunks, extColliders: nature.colliders,
	});
	setupUI(pickables);

	setProgress(0.92, 'Letting it snow');
	await nextFrame();
	const start = params.get('shot');
	if (start && SHOTS[start]) { rig.setPose(SHOTS[start].space, SHOTS[start].mode, new THREE.Vector3(...SHOTS[start].pos), new THREE.Vector3(...SHOTS[start].look)); currentShot = start; }
	else rig.setPose('exterior', 'orbit', new THREE.Vector3(-24, 7.5, 27), new THREE.Vector3(0.4, 1.1, 0));
	rig.update(0);
	try { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); } catch { /* compile lazily instead */ }
	setProgress(1, 'Ready');
	applyQuality(qSetting);

	if (stillFrames) { $('loader').remove(); hideHint(); }
	requestAnimationFrame(loop);
	if (!stillFrames) setTimeout(() => {
		$('loader').classList.add('done');
		setTimeout(() => $('loader').remove(), 1300);
		if (!start) {
			rig.goTo(SHOTS.outside, { dur: 6.5 });
			markActive('outside');
		}
	}, 250);
}

function buildEnvironments() {
	const pmrem = new THREE.PMREMGenerator(renderer);
	// sky light for everything outdoors
	const skyScene = new THREE.Scene();
	const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), skyMaterial());
	skyScene.add(dome);
	const disc = new THREE.Mesh(new THREE.CircleGeometry(49, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.17, 0.2, 0.27) }));
	disc.rotation.x = -Math.PI / 2; disc.position.y = -3; skyScene.add(disc);
	const envSky = pmrem.fromScene(skyScene, 0.04).texture;
	// light bounced around the interior, captured from the middle of the lounge
	const shift = -1.15;
	motor.group.position.y += shift; nature.group.position.y += shift;
	scene.updateMatrixWorld(true);
	scene.background = new THREE.Color(0x1b2436);
	const envIn = pmrem.fromScene(scene, 0.035, 0.03, 120).texture;
	scene.background = null;
	motor.group.position.y -= shift; nature.group.position.y -= shift;
	scene.updateMatrixWorld(true);
	const { m } = mats;
	for (const mt of mats.interior) { mt.envMap = envIn; mt.envMapIntensity = 0.75; mt.needsUpdate = true; }
	m.window.envMapIntensity = 1.6; m.mirror.envMapIntensity = 1.2; m.brass.envMapIntensity = 1.1; m.steel.envMapIntensity = 1.1;
	for (const mt of mats.exterior) { mt.envMap = envSky; mt.envMapIntensity = 1.0; mt.needsUpdate = true; }
	m.paintR.envMapIntensity = m.paintL.envMapIntensity = m.paint.envMapIntensity = 1.2;
	pmrem.dispose();
}

// ---------------------------------------------------------------- quality control at runtime
let tierLevel = 0;
function applyQuality(setting) {
	qSetting = setting;
	const pr = (v) => { renderer.setPixelRatio(Math.min(devicePixelRatio, v)); composer.setPixelRatio(renderer.getPixelRatio()); onResize(); };
	const shadows = (on) => {
		motor.lights.fire.castShadow = on && Q.fireShadow;
		motor.lights.porch.castShadow = on && Q.porchShadow;
	};
	if (setting === 'high') { pr(Math.max(Q.pr, 2)); if (gtao) gtao.enabled = true; bloom.enabled = true; shadows(true); setTrees(1); }
	else if (setting === 'balanced') { pr(1.5); if (gtao) gtao.enabled = false; bloom.enabled = true; shadows(true); setTrees(0.8); }
	else if (setting === 'low') { pr(1); if (gtao) gtao.enabled = false; bloom.enabled = true; shadows(false); setTrees(0.55); }
	else { tierLevel = 0; pr(Q.pr); if (gtao) gtao.enabled = true; bloom.enabled = true; shadows(true); setTrees(1); }
	$('quality').value = setting;
	$('quality-note').textContent = setting === 'auto' ? 'Adjusts itself to keep the motion smooth.' : setting === 'high' ? 'Ambient occlusion and full resolution. Needs a strong GPU.' : setting === 'balanced' ? 'Good look at a lower resolution.' : 'Fewer trees and shadows, for phones and long sessions.';
}
function setTrees(f) {
	nature.group.traverse((o) => { if (o.isInstancedMesh && o.userData.fullCount) o.count = Math.max(1, Math.floor(o.userData.fullCount * f)); });
}
// Auto mode: step down when frames are slow.
const perf = { acc: 0, n: 0, since: 0 };
function autoTune(dt) {
	if (qSetting !== 'auto') return;
	perf.since += dt;
	if (perf.since < 2.5) return;
	perf.acc += dt; perf.n++;
	if (perf.n < 90) return;
	const avg = perf.acc / perf.n; perf.acc = 0; perf.n = 0;
	if (avg > 1 / 38 && tierLevel < 3) {
		tierLevel++;
		if (tierLevel === 1 && gtao && gtao.enabled) gtao.enabled = false;
		else if (tierLevel <= 2) { renderer.setPixelRatio(Math.min(devicePixelRatio, tierLevel === 1 ? 1.5 : 1.2)); composer.setPixelRatio(renderer.getPixelRatio()); onResize(); }
		else setTrees(0.6);
		perf.since = 0;
	}
}

// ---------------------------------------------------------------- UI
function markActive(name) {
	currentShot = name;
	for (const b of document.querySelectorAll('.views button')) b.classList.toggle('active', b.dataset.shot === name);
}

let toastTimer = 0;
function toast(name, desc) {
	$('toast-name').textContent = name; $('toast-desc').textContent = desc;
	const t = $('toast'); t.hidden = false;
	t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
	clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 7000);
}

function setupUI(pickables) {
	audio = new Ambience();
	audio.on = store.get('sound', true);
	const sb = $('btn-sound');
	const syncSound = () => { sb.setAttribute('aria-pressed', String(audio.on)); sb.title = audio.on ? 'Sound on' : 'Sound off'; };
	syncSound();
	sb.addEventListener('click', () => { audio.start(); audio.setOn(!audio.on); store.set('sound', audio.on); syncSound(); });
	const firstGesture = () => { if (audio.on) audio.start(); window.removeEventListener('pointerdown', firstGesture); window.removeEventListener('keydown', firstGesture); };
	window.addEventListener('pointerdown', firstGesture); window.addEventListener('keydown', firstGesture);

	const panels = { settings: $('btn-settings'), help: $('btn-help') };
	const closePanels = (except) => { for (const [id, btn] of Object.entries(panels)) if (id !== except) { $(id).hidden = true; btn.setAttribute('aria-expanded', 'false'); } };
	for (const [id, btn] of Object.entries(panels)) {
		btn.addEventListener('click', () => {
			const open = $(id).hidden; closePanels(id);
			$(id).hidden = !open; btn.setAttribute('aria-expanded', String(open));
		});
	}
	renderer.domElement.addEventListener('pointerdown', () => closePanels());

	$('btn-reset').addEventListener('click', () => resetView());

	const speed = $('speed');
	speed.value = store.get('speed', 1);
	const syncSpeed = () => { rig.speed = Number(speed.value); $('speed-out').textContent = `${Number(speed.value).toFixed(1)}×`; store.set('speed', Number(speed.value)); };
	speed.addEventListener('input', syncSpeed); syncSpeed();
	const snowR = $('snowfall');
	snowR.value = store.get('snow', 0.8);
	const syncSnow = () => {
		const v = Number(snowR.value);
		nature.snow.material.uniforms.uDensity.value = v;
		$('snow-out').textContent = v < 0.35 ? 'Flurries' : v < 0.65 ? 'Light' : v < 0.9 ? 'Steady' : 'Heavy';
		store.set('snow', v);
	};
	snowR.addEventListener('input', syncSnow); syncSnow();
	$('quality').addEventListener('change', (e) => { applyQuality(e.target.value); store.set('quality', e.target.value); });

	for (const b of document.querySelectorAll('.views button')) {
		b.addEventListener('click', () => {
			const s = b.dataset.shot;
			hideHint();
			if (s === 'tour') { if (rig.touring) rig.stopTour(); else { rig.tour(TOUR); markActive('tour'); } return; }
			rig.stopTour();
			rig.goTo(SHOTS[s]);
			markActive(s);
		});
	}

	window.addEventListener('keydown', (e) => {
		if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
		const k = e.key.toLowerCase();
		if (k === 'r') resetView();
		else if (k === 'f') { rig.stopTour(); const s = rig.mode === 'walk' ? 'overview' : 'walk'; rig.goTo(SHOTS[s]); markActive(s); }
		else if (k === 't') { if (rig.touring) rig.stopTour(); else { rig.tour(TOUR); markActive('tour'); } }
		else if (k === 'escape') { rig.stopTour(); closePanels(); }
	});

	rig.bindJoystick($('joystick'), $('joystick').querySelector('.knob'));
	rig.on('space', (space, mode) => { $('joystick').hidden = !(mode === 'walk' && coarse); });
	rig.on('arrive', (shot) => { $('joystick').hidden = !(shot.mode === 'walk' && coarse); });
	rig.on('fade', (v) => { $('fade').style.opacity = String(v); });
	rig.on('tour', (on) => { if (!on) markActive(null); });
	rig.on('input', () => {
		hideHint();
		if (currentShot && currentShot !== 'tour' && !rig.anim) markActive(null);
	});

	// double-click / double-tap to inspect
	const ray = new THREE.Raycaster(); ray.layers.set(0);
	const ndc = new THREE.Vector2(); const tmp = new THREE.Vector3();
	rig.on('pick', (cx, cy) => {
		if (rig.anim) return;
		const r = renderer.domElement.getBoundingClientRect();
		ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
		ray.setFromCamera(ndc, camera);
		const hit = ray.intersectObjects(pickables, false)[0];
		if (!hit) return;
		const p = hit.point;
		const all = [...motor.focusables, ...nature.focusables];
		let best = null, bestV = Infinity;
		for (const f of all) {
			const b = f.box.clone().expandByScalar(0.05);
			if (!b.containsPoint(p)) continue;
			if (f.name === 'Motorhome' && motor.interiorBox.containsPoint(p)) continue;
			b.getSize(tmp); const v = tmp.x * tmp.y * tmp.z;
			if (v < bestV) { best = f; bestV = v; }
		}
		const inside = motor.interiorBox.containsPoint(p);
		const space = best ? best.space : inside ? 'interior' : 'exterior';
		const target = best ? best.box.getCenter(new THREE.Vector3()) : p.clone();
		let dir = best && best.view ? best.view.clone() : camera.position.clone().sub(target).normalize();
		if (!best && space !== rig.space) dir = space === 'interior' ? new THREE.Vector3(0.3, 0.4, 0.8).normalize() : new THREE.Vector3(0.5, 0.3, 1).normalize();
		const dist = best ? best.dist : space === 'interior' ? 0.9 : 5;
		const pos = target.clone().addScaledVector(dir, dist);
		rig.goTo({ space, mode: 'orbit', pos: pos.toArray(), look: target.toArray() });
		markActive(null);
		if (best) toast(best.name, best.desc);
	});

	setTimeout(hideHint, 14000);
	const clock = () => { const d = new Date(); $('clock').textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
	clock(); setInterval(clock, 15000);
}

function hideHint() { $('hint').classList.add('gone'); }
function resetView() { rig.stopTour(); rig.goTo(SHOTS.overview); markActive('overview'); }

function onResize() {
	if (!renderer) return;
	camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
	renderer.setSize(innerWidth, innerHeight);
	composer.setSize(innerWidth, innerHeight);
	const s = renderer.getDrawingBufferSize(new THREE.Vector2());
	grade.uniforms.uRes.value.set(s.x, s.y);
}
window.addEventListener('resize', onResize);

const stovePos = new THREE.Vector3(0.9, 0.4, -0.9);
let last = performance.now();
const fixedT = params.has('t') ? Number(params.get('t')) : null;
const stillFrames = params.has('still') ? Number(params.get('still')) || 3 : 0;
function loop(now) {
	const dt = Math.min(0.05, (now - last) / 1000); last = now;
	time = fixedT ?? time + dt;
	rig.update(dt);
	for (const u of updaters) u(time, dt, camera);
	const h = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
	const scale = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
	nature.snow.material.uniforms.uScale.value = scale;
	for (const p of motor.pointScaled) p.material.uniforms.uScale.value = scale;
	audio.update(time, rig.space === 'interior', camera.position.distanceTo(stovePos));
	if (aoCam) {
		aoCam.position.copy(camera.position); aoCam.quaternion.copy(camera.quaternion);
		aoCam.fov = camera.fov; aoCam.aspect = camera.aspect; aoCam.near = camera.near; aoCam.far = camera.far;
		aoCam.updateProjectionMatrix(); aoCam.updateMatrixWorld();
	}
	grade.uniforms.uTime.value = time;
	composer.render(dt);
	autoTune(dt);
	if (stillFrames) {
		window.__frames = (window.__frames || 0) + 1;
		if (window.__frames < stillFrames) requestAnimationFrame(loop); else window.__done = true;
	} else requestAnimationFrame(loop);
}

init().catch((err) => {
	console.error(err);
	const e = $('loader-error');
	e.hidden = false;
	e.textContent = /webgl/i.test(String(err)) ? 'This view needs WebGL 2. Try a recent version of Chrome, Safari, Edge or Firefox.' : `Something went wrong while building the scene: ${err.message || err}`;
	$('step').textContent = '';
});

window.__smh = {
	get rig() { return rig; }, get camera() { return camera; }, get renderer() { return renderer; }, get scene() { return scene; }, SHOTS, U,
	// test hook: render one still frame from a named shot or an explicit pose
	still(spec, t = 5) {
		const s = typeof spec === 'string' ? SHOTS[spec] : spec;
		rig.anim = null;
		rig.setPose(s.space, s.mode || 'orbit', new THREE.Vector3(...s.pos), new THREE.Vector3(...s.look));
		if (s.fov) { rig.fov = rig.gFov = s.fov; camera.fov = s.fov; }
		for (let i = 0; i < 3; i++) rig.update(0.5);
		for (const u of updaters) u(t, 0.016, camera);
		const h = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
		const scale = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
		nature.snow.material.uniforms.uScale.value = scale;
		for (const p of motor.pointScaled) p.material.uniforms.uScale.value = scale;
		if (aoCam) { aoCam.position.copy(camera.position); aoCam.quaternion.copy(camera.quaternion); aoCam.fov = camera.fov; aoCam.aspect = camera.aspect; aoCam.updateProjectionMatrix(); aoCam.updateMatrixWorld(); }
		renderer.info.autoReset = false; renderer.info.reset();
		composer.render(0.016);
		const r = renderer.info.render; const out = { calls: r.calls, tris: r.triangles };
		renderer.info.autoReset = true;
		return out;
	},
};
