// Senritha's Last Summit X3D: boot, renderer and post-processing, the main loop, and the
// interface (time of day, wind, view mode, destinations, settings, language).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { U, makeNoiseTexture, loadTextures } from './shading.js';
import { generate } from './heightfield.js';
import { Terrain } from './terrain.js';
import { Sky } from './sky.js';
import { Forest, Rocks, icicles } from './flora.js';
import { Summit, RouteFurniture } from './summit.js';
import { Cabin } from './cabin.js';
import { Wind, SnowFall, Spindrift, GroundDrift, CloudSea } from './weather.js';
import { FreeCam, Walker, Footprints } from './controls.js';
import { Soundscape } from './audio.js';
import { STR } from './i18n.js';
import { ALT0 } from './world.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const store = {
	get(k, d) { try { const v = localStorage.getItem('summit.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
	set(k, v) { try { localStorage.setItem('summit.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

// ---------------------------------------------------------------- quality
const TIERS = {
	high: { pr: 2, terrainGrid: 32, terrainRange: 120, res: { detail: 1024, fine: 1024, coarse: 1024 }, shadowRes: 1024, sunShadow: 2048, stars: 7000, msaa: 4, snow: 16000, snowFar: 3500, trees: 9000, treeSpacing: 8, rocks: 520, drift: 700, fireShadow: true, spindrift: 14 },
	balanced: { pr: 1.5, terrainGrid: 24, terrainRange: 110, res: { detail: 1024, fine: 768, coarse: 768 }, shadowRes: 768, sunShadow: 2048, stars: 5000, msaa: 2, snow: 10000, snowFar: 2200, trees: 6000, treeSpacing: 9, rocks: 380, drift: 450, fireShadow: true, spindrift: 10 },
	low: { pr: 1.25, terrainGrid: 16, terrainRange: 100, res: { detail: 768, fine: 512, coarse: 512 }, shadowRes: 512, sunShadow: 1024, stars: 3000, msaa: 0, snow: 5000, snowFar: 1000, trees: 3000, treeSpacing: 11, rocks: 220, drift: 260, fireShadow: false, spindrift: 6 },
};
const coarsePtr = matchMedia('(pointer: coarse)').matches;
const mobile = coarsePtr && Math.min(screen.width, screen.height) < 820;
const qSetting = params.get('q') || store.get('quality', 'auto');
const tierName = TIERS[qSetting] ? qSetting : mobile ? 'low' : 'high';
const Q = { ...TIERS[tierName] };
const maxPR = Math.min(devicePixelRatio, Q.pr);
let pr = maxPR;

// ---------------------------------------------------------------- language
let lang = store.get('lang', 'en');
const t = (k) => (STR[lang] && STR[lang][k]) || STR.en[k] || k;
function applyLang() {
	document.documentElement.lang = lang;
	document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
	document.querySelectorAll('[data-tip]').forEach((el) => { el.dataset.tipt = t(el.dataset.tip); el.setAttribute('aria-label', t(el.dataset.tip)); });
	document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
	document.title = (lang === 'th' ? STR.th.title : "Senritha's Last Summit") + ' X3D';
}
applyLang();
document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => { lang = b.dataset.lang; store.set('lang', lang); applyLang(); }));

// ---------------------------------------------------------------- state
const S = {
	time: params.get('t') || store.get('time', 'morning'),
	wind: params.get('w') || store.get('wind', 'light'),
	view: 'free',
	dest: null,
	hud: store.get('hud', true),
};

let renderer, scene, camera, composer, bloom, grade, sky, terrain, sun, hemi, hf, cabin, summit, route, forest, rocks;
let snowNear, snowFar, spindrift, driftNear, driftFar, clouds, wind, free, walker, prints, audio;
const world = { colliders: [], floors: [], circles: [] };
const clock = new THREE.Clock();

const GradeShader = {
	uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uVig: { value: 0.25 } },
	vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
	fragmentShader: /* glsl */`
		uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform float uVig; varying vec2 vUv;
		void main(){
			vec4 c = texture2D(tDiffuse, vUv);
			vec2 d = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
			c.rgb *= mix(1.0 - uVig, 1.0, smoothstep(1.1, 0.3, length(d)));
			float g = fract(sin(dot(vUv * uRes + fract(uTime * 7.13) * 91.0, vec2(12.9898, 78.233))) * 43758.5453);
			c.rgb += (g - 0.5) * 0.012;
			gl_FragColor = c;
		}`,
};

// ---------------------------------------------------------------- boot
async function boot() {
	const progress = (p, key) => { $('bar').style.transform = `scaleX(${p})`; if (key) { $('status').dataset.t = key; $('status').textContent = t(key); } };
	renderer = new THREE.WebGLRenderer({ antialias: false, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
	renderer.setPixelRatio(pr);
	renderer.setSize(innerWidth, innerHeight);
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	$('stage').appendChild(renderer.domElement);

	U.tNoise.value = makeNoiseTexture(256);
	progress(0.02, 'shaping');
	hf = await generate(Q.res, (p) => progress(0.02 + p * 0.6));
	progress(0.64, 'snow');
	await loadTextures(renderer, (p) => progress(0.64 + p * 0.16));
	progress(0.82, 'building');
	await new Promise((r) => setTimeout(r, 0));

	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 150000);

	terrain = new Terrain(renderer, hf, Q);
	scene.add(terrain.mesh);
	sky = new Sky(renderer, Q);
	sky.onEnv = (tex) => { scene.environment = tex; };
	scene.add(sky.group);

	sun = new THREE.DirectionalLight(0xffffff, 3);
	sun.castShadow = true;
	sun.shadow.mapSize.set(Q.sunShadow, Q.sunShadow);
	sun.shadow.bias = -0.0004;
	sun.shadow.normalBias = 0.04;
	sun.shadow.camera.near = 1; sun.shadow.camera.far = 2600;
	scene.add(sun, sun.target);
	hemi = new THREE.HemisphereLight(0x58e6b0, 0x0a1020, 0);
	scene.add(hemi);

	cabin = new Cabin(hf, Q);
	scene.add(cabin.group, cabin.smoke.mesh);
	summit = new Summit(hf, Q);
	scene.add(summit.group);
	route = new RouteFurniture(hf);
	scene.add(route.group);
	forest = new Forest(hf, Q, hf.camp);
	scene.add(forest.group);
	rocks = new Rocks(hf, Q, hf.camp);
	scene.add(rocks.group);
	const iceSpots = cabin.icicleWorld();
	for (const r of rocks.icicleSpots.slice(0, 40)) for (let k = 0; k < 5; k++) iceSpots.push({ x: r.x + (k - 2) * 0.15 * r.s, y: r.y, z: r.z + r.s * 0.7, len: 0.15 + Math.random() * 0.45 });
	scene.add(icicles(iceSpots));

	world.colliders = cabin.colliders;
	world.floors = cabin.floors;
	world.circles = [...rocks.colliders, ...forest.colliders, ...summit.colliders, ...route.colliders];

	wind = new Wind();
	wind.set(S.wind);
	snowNear = new SnowFall(Q.snow, 46, 0.022, 0.95);
	snowFar = new SnowFall(Q.snowFar, 240, 0.07, 0.35, true);
	spindrift = new Spindrift(hf, Q.spindrift);
	driftNear = new GroundDrift(Q.drift, 70, 0.9, 1.6, 0.4);
	driftFar = new GroundDrift(Math.round(Q.drift * 0.35), 600, 22, 18, 0.22);
	clouds = new CloudSea(hf);
	scene.add(snowNear.mesh, snowFar.mesh, spindrift.mesh, driftNear.mesh, driftFar.mesh, clouds.group);

	prints = new Footprints(hf, mobile ? 240 : 480);
	scene.add(prints.mesh);

	progress(0.9, 'lighting');
	sky.setPreset(S.time, true);
	terrain.shadow.update(U.uSunDir.value);

	free = new FreeCam(camera, renderer.domElement, hf, cabin);
	free.setSpeed(store.get('speed', 1));
	walker = new Walker(camera, renderer.domElement, hf, world);
	walker.sens = store.get('sens', 1);
	walker.noLock = coarsePtr;
	walker.onStep = (surface, side, speed) => {
		audio.footstep(surface, speed);
		if (surface === 'snow' || surface === 'path') {
			const fx = -Math.sin(walker.yaw), fz = -Math.cos(walker.yaw);
			prints.add(walker.pos.x - fz * 0.13 * side, walker.pos.z + fx * 0.13 * side, walker.yaw, side, U.uTime.value);
		}
	};
	walker.onLock = (locked) => { showHint(S.view === 'walk' && !locked && !coarsePtr ? t('clickToLook') : null); };
	resetCamera(true);
	if (params.get('cam')) camera.position.fromArray(params.get('cam').split(',').map(Number));
	if (params.get('look')) free.c.target.fromArray(params.get('look').split(',').map(Number));
	free.c.update();

	composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth * pr, innerHeight * pr, { type: THREE.HalfFloatType, samples: Q.msaa }));
	composer.setPixelRatio(pr);
	composer.setSize(innerWidth, innerHeight);
	composer.addPass(new RenderPass(scene, camera));
	bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.2, 0.55, 1.6);
	composer.addPass(bloom);
	composer.addPass(new OutputPass());
	grade = new ShaderPass(GradeShader);
	grade.uniforms.uRes.value.set(innerWidth, innerHeight);
	composer.addPass(grade);

	audio = new Soundscape();
	audio.vol.master = store.get('vol', 0.8); audio.vol.ambience = store.get('amb', 0.9); audio.vol.music = store.get('mus', 0.5);
	audio.musicOn = store.get('music', false);
	audio.muted = store.get('muted', false);

	addEventListener('resize', onResize);
	wireUI();
	progress(1, 'ready');
	frame();
	document.body.classList.add('ready');
	$('enter').hidden = false;
	$('enter').focus();
	window.__audio = audio;
	window.__app = { composer, renderer, scene, camera, terrain, sky, hf, U, cabin, summit, walker, free, wind, setTime, setWind, setView, goTo, interact, THREE, renderFrames: (n) => { for (let i = 0; i < n; i++) { frames = 0; frame(); } }, viewpoint };
	renderer.setAnimationLoop(frame);
}

function onResize() {
	camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
	renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
	bloom.resolution.set(innerWidth, innerHeight);
	grade.uniforms.uRes.value.set(innerWidth, innerHeight);
}

// ---------------------------------------------------------------- views and destinations
const CABIN_DOOR_OUT = { x: 6.7, z: -1.35 };
function viewpoint(name) {
	const c = cabin, s = hf.summit;
	if (name === 'camp') {
		const p = c.toWorld(10.5, 3.6, 15);
		p.y = Math.max(p.y, hf.height(p.x, p.z) + 2.5);
		return { pos: p, target: c.toWorld(-0.8, 2.2, 1.2) };
	}
	if (name === 'summit') {
		const away = new THREE.Vector3(hf.camp.x - s.x, 0, hf.camp.z - s.z).normalize();
		const side = new THREE.Vector3(-away.z, 0, away.x);
		return { pos: new THREE.Vector3(s.x, s.y, s.z).addScaledVector(away, 16).addScaledVector(side, 9).add(new THREE.Vector3(0, 6.5, 0)), target: new THREE.Vector3(s.x, s.y + 4.2, s.z) };
	}
	// hero: the cabin in the foreground, the summit beyond
	const toS = new THREE.Vector3(s.x - hf.camp.x, 0, s.z - hf.camp.z).normalize();
	const side = new THREE.Vector3(-toS.z, 0, toS.x);
	const p = new THREE.Vector3(hf.camp.x, hf.camp.y, hf.camp.z).addScaledVector(toS, -24).addScaledVector(side, 15);
	p.y = Math.max(hf.height(p.x, p.z) + 3, hf.camp.y + 8);
	const tg = new THREE.Vector3(hf.camp.x, hf.camp.y, hf.camp.z).addScaledVector(toS, 55);
	tg.y = hf.camp.y + 13;
	return { pos: p, target: tg };
}

function resetCamera(instant = false) {
	if (S.view === 'walk') {
		walker.look = null;
		const nr = hf.nearestRoute(walker.pos.x, walker.pos.z);
		const R = hf.route, a = R[Math.max(0, nr.i - 3)], b = R[Math.min(R.length - 1, nr.i + 6)];
		walker.yaw = Math.atan2(-(b.x - a.x), -(b.z - a.z));
		walker.pitch = 0;
		return;
	}
	const v = viewpoint('hero');
	if (instant) { camera.position.copy(v.pos); free.c.target.copy(v.target); camera.lookAt(v.target); free.c.update(); }
	else free.flyTo(v.pos, v.target, 3);
}

function setTime(name) {
	S.time = name; store.set('time', name);
	sky.setPreset(name);
	segSelect('seg-time', name);
}
function setWind(mode) {
	S.wind = mode; store.set('wind', mode);
	wind.set(mode);
	segSelect('seg-wind', mode);
}
function camYaw() { const d = new THREE.Vector3(); camera.getWorldDirection(d); return Math.atan2(-d.x, -d.z); }
function spawnFromFree() {
	// start from where the free camera is looking if that is near the route or inside the cabin; else at the cabin door
	const tg = free.c.target;
	if (cabin.inside(tg)) return walker.place(tg.x, tg.z, camYaw(), cabin.base.y + 0.1);
	const near = hf.nearestRoute(tg.x, tg.z);
	if (near.d < 260 && camera.position.distanceTo(tg) < 900) {
		const p = hf.route[near.i];
		return walker.place(p.x, p.z, camYaw());
	}
	const door = cabin.toWorld(CABIN_DOOR_OUT.x, 0, CABIN_DOOR_OUT.z);
	walker.place(door.x, door.z, cabin.yaw + Math.PI);
}

function setView(mode) {
	if (mode === S.view) return;
	S.view = mode;
	segSelect('seg-view', mode);
	document.body.classList.toggle('free', mode === 'free');
	if (mode === 'walk') {
		free.enabled = false; free.flight = null;
		spawnFromFree();
		walker.enabled = true;
		camera.fov = 68; camera.updateProjectionMatrix();
		$('crosshair').hidden = false;
		$('touch').hidden = !coarsePtr;
		$('fast-wrap').hidden = false;
		showHint(coarsePtr ? t('dragToLook') : t('clickToLook'));
		setTimeout(() => { if (walker.locked || coarsePtr) showHint(null); }, 5000);
	} else {
		walker.enabled = false; walker.look = null;
		document.exitPointerLock?.();
		const d = new THREE.Vector3(); camera.getWorldDirection(d);
		const tg = camera.position.clone().addScaledVector(d, 6);
		camera.fov = 55; camera.updateProjectionMatrix();
		free.c.target.copy(tg);
		camera.position.addScaledVector(d, -4).y += 1.5;
		free.enabled = true;
		free.c.update();
		$('crosshair').hidden = true; $('touch').hidden = true; $('prompt').hidden = true; $('fast-wrap').hidden = true;
		showHint(null);
	}
	updateGuide();
}

function goTo(dest) {
	S.dest = dest;
	segSelect('seg-dest', dest, true);
	if (S.view === 'free') {
		const v = viewpoint(dest);
		free.flyTo(v.pos, v.target, 3.4);
		showLabel(dest === 'camp' ? t('camp') : t('summit'), dest === 'camp' ? cabin.toWorld(0, 7.4, 0) : new THREE.Vector3(hf.summit.x, hf.summit.y + 9, hf.summit.z));
		setTimeout(() => { if (S.view === 'free') { S.dest = null; segSelect('seg-dest', null, true); } }, 4000);
	} else if ($('fast').checked) {
		fade(() => {
			walker.look = null;
			if (dest === 'camp') { const d = cabin.toWorld(CABIN_DOOR_OUT.x, 0, CABIN_DOOR_OUT.z); walker.place(d.x, d.z, cabin.yaw + Math.PI); }
			else { const R = hf.route, p = R[R.length - 14]; walker.place(p.x, p.z, Math.atan2(-(hf.summit.x - p.x), -(hf.summit.z - p.z))); }
			S.dest = null; segSelect('seg-dest', null, true); updateGuide();
			toast(dest === 'camp' ? t('arrivedCamp') : t('arrivedSummit'));
		});
	}
	updateGuide();
}

function fade(fn) {
	$('fade').classList.add('on');
	setTimeout(() => { fn(); setTimeout(() => $('fade').classList.remove('on'), 120); }, 520);
}

// ---------------------------------------------------------------- UI helpers
function segSelect(id, v, pressed = false) {
	document.querySelectorAll(`#${id} button`).forEach((b) => b.setAttribute(pressed ? 'aria-pressed' : 'aria-checked', String(b.dataset.v === v)));
}
let toastT = 0;
function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600); }
function showHint(msg) { const el = $('hint'); if (!msg) { el.hidden = true; return; } el.textContent = msg; el.hidden = false; }
let label = null;
function showLabel(text, pos) { label = { pos, until: performance.now() + 4200 }; $('dest-label').textContent = text; }

function wireUI() {
	document.querySelectorAll('#seg-time button').forEach((b) => b.addEventListener('click', () => { setTime(b.dataset.v); audio.click(); }));
	document.querySelectorAll('#seg-wind button').forEach((b) => b.addEventListener('click', () => { setWind(b.dataset.v); audio.click(); }));
	document.querySelectorAll('#seg-view button').forEach((b) => b.addEventListener('click', () => { setView(b.dataset.v); audio.click(); }));
	document.querySelectorAll('#seg-dest button').forEach((b) => b.addEventListener('click', () => { goTo(b.dataset.v); audio.click(); }));
	segSelect('seg-time', S.time); segSelect('seg-wind', S.wind); segSelect('seg-view', 'free');
	document.body.classList.add('free');
	$('dock-toggle').addEventListener('click', () => { const b = $('dock-toggle'); b.setAttribute('aria-expanded', String(b.getAttribute('aria-expanded') !== 'true')); });
	if (innerWidth <= 860) $('dock-toggle').setAttribute('aria-expanded', 'false');

	$('enter').addEventListener('click', () => {
		audio.start();
		$('loader').classList.add('gone');
		setTimeout(() => { $('loader').hidden = true; }, 1000);
	});
	$('btn-reset').addEventListener('click', () => resetCamera());
	const soundBtn = $('btn-sound');
	soundBtn.setAttribute('aria-pressed', String(!audio.muted));
	soundBtn.addEventListener('click', () => { audio.start(); audio.mute(!audio.muted); store.set('muted', audio.muted); soundBtn.setAttribute('aria-pressed', String(!audio.muted)); });
	$('btn-full').addEventListener('click', toggleFull);
	const panel = (btn, id) => {
		$(btn).addEventListener('click', () => {
			const open = $(id).hidden;
			['settings', 'help'].forEach((p) => { $(p).hidden = true; });
			['btn-settings', 'btn-help'].forEach((b) => $(b).setAttribute('aria-expanded', 'false'));
			$(id).hidden = !open; $(btn).setAttribute('aria-expanded', String(open));
			if (open) document.exitPointerLock?.();
		});
	};
	panel('btn-settings', 'settings'); panel('btn-help', 'help');
	document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { b.closest('.panel').hidden = true; ['btn-settings', 'btn-help'].forEach((x) => $(x).setAttribute('aria-expanded', 'false')); }));

	const q = $('quality'); q.value = TIERS[qSetting] || qSetting === 'auto' ? qSetting : 'auto';
	q.addEventListener('change', () => { store.set('quality', q.value); location.reload(); });
	const range = (id, out, key, fmt, apply) => {
		const el = $(id); el.value = store.get(key, +el.value);
		const show = () => { $(out).textContent = fmt(+el.value); };
		show();
		el.addEventListener('input', () => { show(); store.set(key, +el.value); apply(+el.value); });
	};
	range('speed', 'speed-out', 'speed', (v) => v.toFixed(1) + '×', (v) => free.setSpeed(v));
	range('sens', 'sens-out', 'sens', (v) => v.toFixed(1) + '×', (v) => { walker.sens = v; });
	range('vol', 'vol-out', 'vol', (v) => Math.round(v * 100), (v) => audio.set('master', v));
	range('amb', 'amb-out', 'amb', (v) => Math.round(v * 100), (v) => audio.set('ambience', v));
	range('mus', 'mus-out', 'mus', (v) => Math.round(v * 100), (v) => audio.set('music', v));
	$('music').checked = audio.musicOn;
	$('music').addEventListener('change', () => { audio.start(); audio.musicOn = $('music').checked; store.set('music', audio.musicOn); });
	$('hud').checked = S.hud; document.body.classList.toggle('nohud', !S.hud);
	$('hud').addEventListener('change', () => { S.hud = $('hud').checked; store.set('hud', S.hud); document.body.classList.toggle('nohud', !S.hud); });

	addEventListener('keydown', (e) => {
		if (e.target.closest?.('input,select,textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
		const k = e.key.toLowerCase();
		if (k === '1') setTime('morning'); else if (k === '2') setTime('afternoon'); else if (k === '3') setTime('night');
		else if (k === 'g') setWind(S.wind === 'light' ? 'strong' : 'light');
		else if (k === 'v') setView(S.view === 'free' ? 'walk' : 'free');
		else if (k === 'c') goTo('camp'); else if (k === 't') goTo('summit');
		else if (k === 'r') resetCamera(); else if (k === 'f') toggleFull();
		else if (k === 'e') interact();
		else if (k === 'h') $('btn-help').click();
	});

	// touch: joystick and buttons
	const stick = $('stick'), knob = $('knob');
	let sid = null;
	const moveStick = (e) => {
		const r = stick.getBoundingClientRect();
		let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
		const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
		walker.joy.set(dx, dy);
		knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
	};
	stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); e.preventDefault(); });
	stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) moveStick(e); });
	const endStick = (e) => { if (e.pointerId !== sid) return; sid = null; walker.joy.set(0, 0); knob.style.transform = ''; };
	stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);
	$('t-run').addEventListener('click', () => { walker.sprintBtn = !walker.sprintBtn; $('t-run').setAttribute('aria-pressed', String(walker.sprintBtn)); });
	$('t-jump').addEventListener('pointerdown', (e) => { walker.jumpReq = true; e.preventDefault(); });
	$('t-use').addEventListener('click', interact);
	document.addEventListener('visibilitychange', () => { if (document.hidden) audio.ctx?.suspend(); else if (audio.ctx && !audio.muted) audio.ctx.resume(); });
}

function toggleFull() {
	if (document.fullscreenElement) document.exitFullscreen?.();
	else document.documentElement.requestFullscreen?.().catch(() => {});
}

// ---------------------------------------------------------------- interaction
let focus = null;
const _f = new THREE.Vector3();
function interactables() {
	const list = cabin.interact.slice();
	list.push({ id: 'flag', pos: new THREE.Vector3(hf.summit.x, hf.summit.y + 2.5, hf.summit.z), r: 7, label: 'flag' });
	return list;
}
function findFocus() {
	if (S.view !== 'walk') return null;
	if (walker.look) return { id: 'getup', label: 'getUp' };
	camera.getWorldDirection(_f);
	let best = null, bd = 1e9;
	for (const it of interactables()) {
		const d = it.pos.distanceTo(camera.position);
		if (d > it.r) continue;
		const dir = it.pos.clone().sub(camera.position).normalize();
		if (dir.dot(_f) < 0.55) continue;
		if (d < bd) { bd = d; best = it; }
	}
	return best;
}
function interact() {
	if (S.view !== 'walk' || !focus) return;
	const id = focus.id;
	if (id === 'getup') { walker.look = null; return; }
	if (id === 'door') { const o = cabin.toggleDoor(); audio.door(o, focus.pos); }
	else if (id === 'fire') { cabin.fireBoost = 1; audio.stoke(); toast(t('fireToast')); }
	else if (id === 'coffee') { toast(t('coffeeToast')); audio.click(); }
	else if (id === 'bed') { walker.look = { pos: cabin.bedView.pos, target: cabin.bedView.look }; toast(t('restToast')); audio.creak(focus.pos); }
	else if (id === 'sofa') { walker.look = { pos: cabin.sofaView.pos, target: cabin.sofaView.look }; audio.creak(focus.pos); }
	else if (id === 'chair') { walker.look = { pos: cabin.chairView.pos, target: cabin.chairView.look }; audio.creak(focus.pos); }
	else if (id === 'flag') {
		const s = hf.summit, w = U.uWindDir.value;
		const side = new THREE.Vector3(-w.y, 0, w.x);
		walker.look = {
			pos: new THREE.Vector3(s.x, s.y, s.z).addScaledVector(side, 4.4).add(new THREE.Vector3(w.x * 2.0, 5.0, w.y * 2.0)),
			target: new THREE.Vector3(s.x + w.x * 1.5, s.y + 5.7, s.z + w.y * 1.5),
		};
	}
}

// ---------------------------------------------------------------- guidance along the route
const guide = { target: null, hint: -1 };
function updateGuide() {
	guide.target = S.view === 'walk' && S.dest ? S.dest : null;
	$('guide').hidden = !guide.target;
}
function guideStep() {
	if (!guide.target) return;
	const R = hf.route, p = walker.pos;
	const nr = hf.nearestRoute(p.x, p.z, guide.hint);
	guide.hint = nr.d < 40 ? nr.i : -1;
	const toSummit = guide.target === 'summit';
	const destPos = toSummit ? new THREE.Vector3(hf.summit.x, hf.summit.y, hf.summit.z) : cabin.toWorld(CABIN_DOOR_OUT.x, 0, CABIN_DOOR_OUT.z);
	const direct = Math.hypot(destPos.x - p.x, destPos.z - p.z);
	let aim, remain;
	if (direct < 45) { aim = destPos; remain = direct; }
	else if (nr.d > 30) { aim = R[nr.i]; remain = nr.d + (toSummit ? R[R.length - 1].s - R[nr.i].s : R[nr.i].s); }
	else {
		const j = toSummit ? Math.min(R.length - 1, nr.i + 16) : Math.max(0, nr.i - 16);
		aim = R[j]; remain = (toSummit ? R[R.length - 1].s - R[nr.i].s : R[nr.i].s) + nr.d;
	}
	const want = Math.atan2(-(aim.x - p.x), -(aim.z - p.z));
	let rel = want - walker.yaw;
	rel = Math.atan2(Math.sin(rel), Math.cos(rel));
	$('guide-arrow').style.transform = `rotate(${-rel}rad)`;
	$('guide-dist').textContent = remain > 950 ? (remain / 1000).toFixed(1) + ' km' : Math.round(remain) + ' m';
	$('guide-label').textContent = (toSummit ? t('toSummit') : t('toCamp')) + (nr.d > 30 && direct >= 45 ? ' · ' + t('followPath') : '');
	if (direct < (toSummit ? 7 : 6)) {
		toast(toSummit ? t('arrivedSummit') : t('arrivedCamp'));
		S.dest = null; segSelect('seg-dest', null, true); updateGuide();
	}
}

// ---------------------------------------------------------------- readout
let readT = 0;
function readout(dt) {
	readT -= dt; if (readT > 0) return; readT = 0.25;
	const p = S.view === 'walk' ? walker.pos : camera.position;
	const inside = cabin.inside(camera.position);
	let loc = 'locValley';
	const nr = hf.nearestRoute(p.x, p.z);
	const ds = Math.hypot(p.x - hf.summit.x, p.z - hf.summit.z);
	if (inside) loc = 'locCabin';
	else if (Math.hypot(p.x - hf.camp.x, p.z - hf.camp.z) < 70) loc = 'locCamp';
	else if (ds < 30) loc = 'locSummit';
	else if (nr.d < 120) loc = hf.route[nr.i].s > hf.route[hf.route.length - 1].s - 340 ? 'locHorn' : 'locRidge';
	$('where').textContent = t(loc);
	const base = { morning: -15, afternoon: -8, night: -21 }[S.time];
	const temp = Math.round(base - (p.y - hf.camp.y) * 0.0065 - wind.s * 5);
	const kmh = Math.round(wind.speed * 3.6);
	const wtxt = kmh < 12 ? t('calm') : kmh < 40 ? t('breezy') : t('gale');
	$('readout').innerHTML = `<span>${t('elevation')} ${Math.round(ALT0 + p.y).toLocaleString('en-US')} m</span><span>${inside ? 21 : temp} °C</span><span>${t('windNow')} ${inside ? 0 : kmh} km/h · ${wtxt}</span><span>${Math.round(p.x)} E · ${Math.round(-p.z)} N</span>`;
}

// ---------------------------------------------------------------- frame
let lastShadowKey = '';
let frames = 0, perfT = 0, perfN = 0;
const still = +params.get('still') || 0;
const _v = new THREE.Vector3();
const _c = new THREE.Color();
const _lf = new THREE.Vector3(), _lu = new THREE.Vector3();
function frame() {
	frames++;
	if (still && frames > still) { renderer.setAnimationLoop(null); document.body.classList.add('still'); return; }
	const dt = still ? 1 / 60 : Math.min(clock.getDelta(), 0.1);
	const time = still ? 30 + frames / 60 : clock.elapsedTime;
	U.uTime.value = time;
	wind.update(dt, time);

	if (S.view === 'walk') walker.update(dt); else free.update(dt);

	sky.update(dt, time);
	const st = sky.state;
	const key = U.uSunDir.value.toArray().map((v) => v.toFixed(3)).join();
	if (key !== lastShadowKey) { lastShadowKey = key; terrain.shadow.update(U.uSunDir.value); }

	// key light, with the shadow box following the area of interest
	const focusP = S.view === 'walk' ? walker.pos : free.c.target;
	const dCam = camera.position.distanceTo(focusP);
	const ext = S.view === 'walk' ? 42 : THREE.MathUtils.clamp(dCam * 0.55, 24, 420);
	const sc = sun.shadow.camera;
	if (Math.abs(sc.right - ext) > ext * 0.1) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix(); }
	const texel = (ext * 2) / Q.sunShadow;
	_v.copy(focusP); _v.x = Math.round(_v.x / texel) * texel; _v.z = Math.round(_v.z / texel) * texel;
	sun.target.position.copy(_v);
	sun.position.copy(_v).addScaledVector(U.uSunDir.value, 1200);
	const kc = sky.keyColor, ki = Math.max(kc.r, kc.g, kc.b, 1e-4);
	sun.color.setRGB(kc.r / ki, kc.g / ki, kc.b / ki);
	sun.intensity = ki;
	scene.environmentIntensity = st.env;
	renderer.toneMappingExposure = st.exposure;
	window.__dbg = { ki, exposure: st.exposure };
	const auroraPulse = st.aurora * (0.7 + 0.3 * Math.sin(time * 0.21) * Math.sin(time * 0.13 + 1));
	hemi.intensity = auroraPulse * 0.09;
	bloom.strength = st.bloom; bloom.threshold = st.bloomThr; bloom.radius = 0.55;
	grade.uniforms.uTime.value = time;
	grade.uniforms.uVig.value = 0.22 + st.aurora * 0.08;
	// strong gusts thin the air with blowing snow
	U.uHaze.value = st.haze + wind.gust * Math.max(0, wind.s - 0.4) * 0.0018;

	const amb = sky.uniforms.uAmbient.value;
	const camP = camera.position;
	const glowPos = cabin.toWorld(0, 1.6, 3.6);
	const snowDensity = Math.min(1, st.snowfall * 0.65 + wind.s * 0.55);
	snowNear.update(camP, wind, snowDensity, sky.keyColor, amb, glowPos, st.cabin);
	snowFar.update(camP, wind, snowDensity * 0.9, sky.keyColor, amb, glowPos, st.cabin * 0.5);
	spindrift.update(sky.keyColor, amb, wind.s);
	driftNear.update(dt, camP, wind, 0.08 + wind.s * 0.92, sky.keyColor, amb);
	driftFar.update(dt, camP, wind, Math.max(0, wind.s - 0.3) * 1.3, sky.keyColor, amb);
	clouds.update(camP, sky.keyColor, amb, st.mist);
	cabin.update(dt, time, st.cabin, camP);
	cabin.smoke.uniforms.uLit.value.copy(amb).multiplyScalar(2.2).add(_c.copy(sky.keyColor).multiplyScalar(0.25));
	summit.update(dt, time, camera);
	forest.update(camP);
	prints.life.value = 160 - wind.s * 120;

	sky.follow(camera);
	terrain.update(camera);

	// near plane: tight indoors and when walking, relaxed high in the air
	const near = cabin.inside(camP) || S.view === 'walk' ? 0.05 : THREE.MathUtils.clamp((camP.y - hf.height(camP.x, camP.z)) * 0.02, 0.08, 2);
	if (Math.abs(camera.near - near) > 0.01) { camera.near = near; camera.updateProjectionMatrix(); }

	// overlays
	if (S.view === 'walk') {
		focus = findFocus();
		const pEl = $('prompt');
		if (focus) {
			let lbl = focus.label;
			if (focus.id === 'door' && cabin.doorTarget) lbl = 'doorClose';
			$('prompt-text').textContent = t(lbl);
			pEl.hidden = false;
			pEl.querySelector('kbd').hidden = coarsePtr;
		} else pEl.hidden = true;
		$('t-use').hidden = !focus;
		guideStep();
	}
	if (label) {
		const el = $('dest-label');
		const v = label.pos.clone().project(camera);
		const on = performance.now() < label.until && v.z < 1;
		el.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px';
		el.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px';
		el.classList.toggle('on', on);
		if (performance.now() > label.until + 800) label = null;
	}
	readout(dt);

	if (audio?.ctx) {
		audio.update(dt, {
			wind: wind.s, gust: wind.gust, inside: cabin.inside(camP),
			fireDist: camP.distanceTo(cabin.firePos), firePos: cabin.firePos, fire: 0.7 + cabin.fireBoost * 0.6,
			listener: { pos: camP, fwd: camera.getWorldDirection(_lf), up: _lu.set(0, 1, 0).applyQuaternion(camera.quaternion) },
			flagDist: camP.distanceTo(summit.top), flagEnergy: summit.flapEnergy,
			alt01: THREE.MathUtils.clamp((camP.y - hf.camp.y) / 450, 0, 1), night: S.time === 'night',
		});
	}

	composer.render(dt);

	// automatic resolution keeps the frame rate smooth
	if (qSetting === 'auto' && !still) {
		perfT += dt; perfN++;
		if (perfT > 2.5) {
			const ms = (perfT / perfN) * 1000;
			let npr = pr;
			if (ms > 24 && pr > 0.7) npr = Math.max(0.7, pr - 0.15);
			else if (ms < 14 && pr < maxPR) npr = Math.min(maxPR, pr + 0.1);
			if (npr !== pr) { pr = npr; renderer.setPixelRatio(pr); composer.setPixelRatio(pr); onResize(); }
			perfT = 0; perfN = 0;
		}
	}
}

boot().catch((e) => { console.error(e); const s = $('status'); if (s) s.textContent = 'Error: ' + e.message; });
