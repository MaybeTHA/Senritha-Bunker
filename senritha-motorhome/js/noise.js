// Seeded random numbers and periodic gradient noise used by the texture and geometry generators.

export function rng(seed = 1) {
	let s = seed >>> 0;
	return function () {
		s = (s + 0x6D2B79F5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function makeNoise(seed = 1) {
	const r = rng(seed);
	const p = new Uint16Array(512);
	const base = [];
	for (let i = 0; i < 256; i++) base.push(i);
	for (let i = 255; i > 0; i--) {
		const j = Math.floor(r() * (i + 1));
		const t = base[i]; base[i] = base[j]; base[j] = t;
	}
	for (let i = 0; i < 512; i++) p[i] = base[i & 255];
	const gx = new Float32Array(256), gy = new Float32Array(256);
	for (let i = 0; i < 256; i++) {
		const a = r() * Math.PI * 2;
		gx[i] = Math.cos(a); gy[i] = Math.sin(a);
	}

	// 2D gradient noise, periodic in x over px cells and in y over py cells. Range about [-1, 1].
	function n2(x, y, px = 256, py = 256) {
		let xi = Math.floor(x), yi = Math.floor(y);
		const xf = x - xi, yf = y - yi;
		xi = ((xi % px) + px) % px; yi = ((yi % py) + py) % py;
		const xi1 = (xi + 1) % px, yi1 = (yi + 1) % py;
		const a = p[xi & 255], b = p[xi1 & 255];
		const h00 = p[a + (yi & 255)], h10 = p[b + (yi & 255)];
		const h01 = p[a + (yi1 & 255)], h11 = p[b + (yi1 & 255)];
		const d00 = gx[h00] * xf + gy[h00] * yf;
		const d10 = gx[h10] * (xf - 1) + gy[h10] * yf;
		const d01 = gx[h01] * xf + gy[h01] * (yf - 1);
		const d11 = gx[h11] * (xf - 1) + gy[h11] * (yf - 1);
		const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
		const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
		const x1 = d00 + (d10 - d00) * u, x2 = d01 + (d11 - d01) * u;
		return (x1 + (x2 - x1) * v) * 1.414;
	}

	// Fractal sum. With integer px/py the result tiles over the unit square when x=u*px, y=v*py.
	function fbm(x, y, px = 256, py = 256, oct = 4, gain = 0.5) {
		let s = 0, a = 1, f = 1, norm = 0;
		for (let i = 0; i < oct; i++) {
			s += a * n2(x * f, y * f, px * f, py * f);
			norm += a; a *= gain; f *= 2;
		}
		return s / norm;
	}

	// Tileable helpers on the unit square: u,v in [0,1), integer frequencies.
	const tile = (u, v, fu, fv, oct = 4, gain = 0.5) => fbm(u * fu, v * fv, fu, fv, oct, gain);
	const ridge = (u, v, fu, fv, oct = 4) => 1 - Math.abs(tile(u, v, fu, fv, oct));

	return { n2, fbm, tile, ridge, r };
}

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => {
	const t = clamp((x - e0) / (e1 - e0), 0, 1);
	return t * t * (3 - 2 * t);
};
