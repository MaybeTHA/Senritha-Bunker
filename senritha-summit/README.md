# Senritha's Last Summit X3D

A real-time 3D alpine world built with [three.js](https://threejs.org/) (r170). Walk from a warm timber cabin on a sheltered ledge, up a marked ridge route, to a single red flag on the highest summit. Everything moves: snow, wind, cloth, fire, steam, clouds and the aurora.

Open `index.html` through any static web server (for example `npx serve .` or GitHub Pages). three.js loads from jsDelivr, so the first visit needs an internet connection.

## The world

- **Mountains:** one height function for the whole range: a horn-shaped summit with five arêtes, radial couloirs, broken rock, and a ring of lower ranges with glacier floors out to about 30 km. Heights live in three nested grids (1.75 m around the route, 4 m over the massif, 64 m for the world) generated in Web Workers at load.
- **Terrain rendering:** CDLOD quadtree with vertex morphing (no cracks between levels), terrain self-shadowing ray-marched toward the sun or moon, snow/rock/ice shading by slope, curvature and altitude, wind ripples, blue snow in hollows, glints, glacier crevasses and a trampled route.
- **Rest camp:** a timber cabin with a glass gable that faces the summit, a deck with lanterns, a stone fireplace with live flames, a bed with a thick duvet and pillows, sofa, lounge chair, rug, bookshelf, coats, boots, backpack, skis, a steaming coffee, frosted windows and icicles.
- **Summit:** jagged crown rocks, a wind-carved cornice, a steel pole with guy wires and a cairn, and a deep red flag simulated as cloth (Verlet, 442 particles) that follows the wind.
- **Route:** about 1.2 km and 450 m of climbing along the south-east ridge with switchbacks, marker poles, cairns and a fixed rope near the top.

## Controls

| | Desktop | Touch |
| --- | --- | --- |
| Free camera: rotate / pan / zoom | Left-drag / right-drag / wheel | One finger / two-finger drag / pinch |
| Walk: move / look | W A S D / mouse (click to capture, Esc to release) | Joystick / drag |
| Run / jump / interact | Shift / Space / E | Run / Jump / hand buttons |

Shortcuts: **1 2 3** time of day · **G** wind · **V** view · **C** rest camp · **T** summit · **R** reset camera · **F** full screen · **H** controls.

In Walk mode you can open the cabin door, rest in bed, sit on the sofa or lounge chair, add a log to the fire, sip the coffee and inspect the flag. Choosing a destination while walking shows a direction arrow that follows the route; tick **Fast travel** to jump there instead.

## Settings

Time of day (sunrise, clear afternoon, aurora night), light or strong wind, free camera or walk, language (English or Thai), render quality (Auto lowers the resolution if the frame rate drops), camera speed, look sensitivity, volume, ambience, music, and the elevation readout. Settings are saved on this device (`localStorage`, keys starting with `summit.`).

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `style.css` | Page and interface |
| `js/main.js` | Renderer, post-processing, quality tiers, main loop, interface |
| `js/world.js` | Height function, route, camp shelf and summit carving |
| `js/heightfield.js`, `js/terrain-worker.js` | Grid generation in workers, CPU height and normal queries |
| `js/terrain.js` | CDLOD terrain, terrain material, terrain self-shadow |
| `js/sky.js` | Atmosphere, sun, moon, stars, Milky Way, high clouds, aurora, time-of-day presets |
| `js/weather.js` | Wind, falling snow, spindrift, ground drift, valley cloud sea |
| `js/cabin.js` | The rest camp |
| `js/summit.js` | Summit rocks, flag cloth, route markers, sign |
| `js/flora.js` | Pines, boulders, icicles |
| `js/controls.js` | Free camera, first-person walker with collisions, footprints |
| `js/effects.js` | Fire, steam and smoke |
| `js/audio.js` | Sound: recorded footsteps, fireplace, door and creaks placed in 3D; generated wind, flag and music |
| `js/sounds.js`, `sounds/`, `tools/make_sounds.py` | Sound sprites, their offsets, and the script that builds them |
| `js/shading.js` | Shared uniforms, fog and material patches, texture loading |
| `js/i18n.js` | English and Thai text |

## Credits

Textures in `textures/` are from [Poly Haven](https://polyhaven.com/) and are CC0: snow_02, marble_cliff_03, dark_wooden_planks, coated_pine, old_wood_floor, castle_wall_slates, pine_bark, wool_boucle, knitted_fleece, rough_linen, curly_teddy_natural. They were resized and converted to WebP.

Recorded sounds in `sounds/` come from Wikimedia Commons. They were cut into single takes, filtered, level-matched and packed into MP3 sprites by `tools/make_sounds.py`; the wooden-floor steps are built from the boot attack of the gravel recording played through a modelled floorboard.

| Sound | Source | Author | License |
| --- | --- | --- | --- |
| Footsteps on snow | [Walking through snow](https://commons.wikimedia.org/wiki/File:Walking_through_snow.mp3) | Lukas Beck | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Footsteps on rock, wooden floor | [Footstep on Gravel (Gravity Sound)](https://commons.wikimedia.org/wiki/File:Footstep_on_Gravel_(Gravity_Sound).mp3) | Gravity Sound | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Fireplace and crackles | [Dry grass burning in open fireplace](https://commons.wikimedia.org/wiki/File:Dry_grass_burning_in_open_fireplace.ogg) | ezwa | Public domain |
| Door opening | [Door handle creaking](https://commons.wikimedia.org/wiki/File:Door_handle_creaking.ogg) | stephan | Public domain |
| Door closing | [Closing an old door](https://commons.wikimedia.org/wiki/File:Closing_an_old_door.ogg) | ezwa | Public domain |
| Cabin and furniture creaks | [Creaky wooden swivel chair](https://commons.wikimedia.org/wiki/File:Creaky_wooden_swivel_chair.ogg) | chocoholic | Public domain |

Wind, the flag, icy tinkles and the music are generated in the browser. If the recordings cannot load, generated versions play instead.
