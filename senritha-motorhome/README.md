# Senritha's Motorhome 3D

A real-time 3D walk-through of a luxury motorhome parked in a snowy spruce forest at blue hour. Everything is built in code with [three.js](https://threejs.org/): the geometry, the wood, fabric, stone and bark textures, the lighting and the sound. There are no image, model or audio files.

Open `index.html` through any static web server (for example `npx serve .` or GitHub Pages). It loads three.js r170 from jsDelivr, so the first visit needs an internet connection.

## What's inside

- **Lounge:** bouclé sofa with a hand-knit throw, a cast-iron wood stove with live flames, a heat-powered stove fan, a birch log basket and a parlour guitar.
- **Dinette:** walnut table with a steaming flat white, an open book, a candle and opal pendant lamps.
- **Kitchen:** quartz counter, brass faucet, a kettle on the gas hob, herbs on the sill and a wall clock that shows your local time.
- **Library wall:** shelves of books, a trailing pothos and a radio on the sideboard.
- **Bedroom:** queen bed with linen duvet and tartan throw, reading sconces, wardrobes and a sheepskin rug.
- **Outside:** a snow-loaded roof with icicles, chimney smoke, a lit porch, a woodpile, snowed-in camp chairs, skis, a lantern, footprints, a forest road and around 950 instanced spruce trees in drifting fog.

Animated: falling snow (lit by the porch light and the windows), flickering firelight, coffee and kettle steam, swaying curtains, twinkling fairy lights, dust motes and slowly drifting cloud.

## Controls

| | Mouse & keyboard | Touch |
| --- | --- | --- |
| Rotate | Left-drag | One finger |
| Zoom | Scroll wheel | Pinch |
| Pan | Right-drag or Shift-drag | Two-finger drag |
| Inspect an object | Double-click | Double-tap |
| Move | W A S D, Q / E for down / up | Joystick in Walk view |

Shortcuts: **F** walk mode, **R** reset camera, **T** cinematic tour, **Esc** stop the tour.

The bar at the bottom jumps between views (overview, walk, stove, coffee, kitchen, bedroom, window seat, exterior, porch, forest) and starts a looping cinematic tour. Moving between inside and outside travels through the door. Settings set camera speed, snowfall and render quality.

## Rendering

- Physically based materials (clearcoat walnut, sheen fabrics, brushed brass), ACES tone mapping
- Image-based lighting captured from the interior and from the sky
- Shadows from the moon, the stove and the porch light
- Ground-truth ambient occlusion (High quality), bloom, vignette and film grain
- Camera collision with walls and furniture

Quality starts at **High** on desktop and **Battery saver** on phones. In **Auto** it lowers resolution and effects if the frame rate drops.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `style.css` | Page and interface |
| `js/main.js` | Renderer, post-processing, views, quality, interface wiring |
| `js/motorhome.js` | Motorhome shell, furniture, props and interior lights |
| `js/nature.js` | Sky, ground, forest, snowfall, fog and outdoor props |
| `js/camera.js` | Orbit, pan, zoom, focus, walk mode, collisions, transitions and tour |
| `js/textures.js` | Procedural canvas textures |
| `js/materials.js` | Material library and shader tweaks (snow cover, sparkle, curtain sway) |
| `js/effects.js` | Fire, steam, smoke, dust motes, light cone |
| `js/geometry.js` | Rounded cushions, drapes, static mesh batching |
| `js/audio.js` | Generated stove crackle and wind |
| `js/noise.js` | Seeded noise |
