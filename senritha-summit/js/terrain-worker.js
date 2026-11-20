// Generates rows of a height grid off the main thread.
import { fillHeights, DETAIL, FINE, COARSE } from './world.js';

const REGIONS = { detail: DETAIL, fine: FINE, coarse: COARSE };

self.onmessage = (e) => {
	const { id, region, res, r0, r1 } = e.data;
	const out = new Float32Array((r1 - r0) * res);
	fillHeights(REGIONS[region], res, r0, r1, out, r0);
	self.postMessage({ id, region, r0, r1, out }, [out.buffer]);
};
