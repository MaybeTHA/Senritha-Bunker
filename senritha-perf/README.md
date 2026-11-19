# Senritha's Test performance
A 2D graphics benchmark that runs in the browser on WebGL2. It stress-tests GPU rendering, main-thread CPU work and frame pacing, and reports only measured numbers.

## Modes
1. **Particle Stress**: 100 to 50,000 particles (× density) with wall and obstacle collisions, glow and transparency
2. **Geometric Stress**: 1,000 to 100,000 rotating circles, squares, triangles, hexagons and rings with alpha blending
3. **Fluid & Waves**: layered waves with domain-warp distortion, moving vortices and particles carried by the flow
4. **Lighting & Glow**: 4 to 64 moving lights; every light shades every pixel with soft shadows from moving occluders, plus additive glows and bloom
5. **Physics Simulation**: 250 to 8,000 balls (× density) with gravity, grid-based collision detection and impulse response, solved in a Web Worker
6. **Image Rendering**: up to 10,000 sprites from generated 512–4096 px textures, scaled, rotated and alpha-blended, with per-pixel filtering on High and Ultra
7. **Ultimate GPU Stress**: everything at once over a fluid background, rising from 20% to 100% load in five stages; the report shows FPS per stage

## Settings
Render resolution (720p to 4K, rendered at that size and scaled to fit), target FPS cap, duration, object density (×0.5 / ×1 / ×2 / ×4), V-Sync, and quality preset (glow, bloom, mipmaps, anisotropic filtering, 4× MSAA on Ultra, physics substeps).

## How it measures
- Frame times come from real frame timestamps: `requestAnimationFrame` with V-Sync on, or `performance.now()` after the GPU finishes each frame (a 1-pixel read-back) with V-Sync off.
- A 3-second warm-up and any paused time are excluded. A hidden tab pauses the run.
- Average FPS = frames ÷ measured time. 1% and 0.1% low = 1000 ÷ mean of the slowest 1% and 0.1% of frame times. Min and max FPS use 1-second windows. Live lows come from a 0.05 ms histogram; the final report sorts every frame.
- GPU time per frame uses `EXT_disjoint_timer_query_webgl2` where the browser offers it. Main-thread work is timed around update and draw submission and is labelled as an estimate.
- Temperatures, GPU utilization and system CPU usage are not available to web pages and are shown as not available.

## Results
Score, KPIs, FPS over time, frame-time distribution, frame time per second, stage table, load and hardware. Runs are saved in history on the device, can be compared two at a time, and export to JSON or CSV.

## Files
- `index.html`, `style.css`: dashboard
- `stats.js`: frame statistics
- `gl.js`: WebGL2 renderer (instancing, light/fluid passes, MSAA, bloom, GPU timer)
- `scenes.js`: the seven modes and the physics worker
- `charts.js`, `hw.js`: charts and hardware info
- `app.js`: run loop, dashboard, results, history, export
