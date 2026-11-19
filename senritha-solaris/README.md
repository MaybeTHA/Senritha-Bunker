# Senritha's Solaris X3D

A real-time, interactive 3D explorer of our Solar System, built with Three.js (WebGL 2).
The interface is in Thai by default, with an English toggle.

## What you can do
- Start from a wide view of the whole Solar System: the Sun, all eight planets, their orbits,
  the asteroid and Kuiper belts, and a Milky Way sky.
- Click or tap any planet, the Sun, or a major moon. The camera flies there in a smooth arc
  and frames the body, with an info panel (diameter, distance, orbital and rotation periods,
  temperature, moon count, axial tilt, gravity, and facts).
- Orbit, zoom and pan freely. The camera can't pass through planets.
- Change the speed of time, pause it, or jump back to today. Planet positions are computed
  for the real date from JPL orbital elements.

## Controls
| Desktop | Phone and tablet |
| --- | --- |
| Left-drag: rotate | One-finger drag: rotate |
| Wheel: zoom | Pinch: zoom |
| Right-drag: pan | Two-finger drag: pan |
| Click a body: fly to it | Tap a body: fly to it |
| `Esc`: overview, `1`–`8`: planets, `0`: Sun, `Space`: pause | |

## How it is made
- **Surfaces are generated on the GPU** when the page loads. Each planet and moon is baked into a
  cube map from noise, craters and hand-placed features (Olympus Mons, Valles Marineris, Hellas,
  the Great Red Spot, Saturn's hexagon, Neptune's Great Dark Spot, Io's volcanoes, Europa's cracks,
  Iapetus's two tones and more).
- **Gas giants move.** Cloud bands drift at different speeds by latitude, a turbulence field keeps
  the clouds alive, and the Great Red Spot rotates as a vortex.
- **Earth** uses real imagery: day map, night lights, terrain, ocean mask and a moving cloud layer
  with cloud shadows, ocean glint and a scattering atmosphere.
- **Lighting and shadows** come from the Sun: Saturn's rings shadow the planet and the planet
  shadows its rings, moons cast eclipse shadows on their planets, and planets eclipse their moons.
- **The Sun** has animated granulation, sunspots, limb darkening, a corona and magnetic loops.
- Real axial tilts and pole directions (Uranus rolls on its side at about 98°), oblate gas giants,
  tidally locked moons, Triton's backwards orbit.
- Performance: geometry levels of detail, adaptive resolution, and quality presets.
  Add `?q=low`, `?q=mid` or `?q=high` to the URL to force a preset.

Sizes and distances are scaled so the whole system fits one view; the order of the planets and their
relative orbital periods are kept.

## Run locally
The page uses ES modules, so serve the folder over HTTP:

```sh
cd senritha-solaris
python3 -m http.server 8000
# open http://localhost:8000
```

Three.js r170 is included in `vendor/`, so it works offline once loaded.

## Credits
- Earth and Moon imagery: maps from the three.js examples collection, based on NASA data.
- Orbital elements: JPL, "Keplerian Elements for Approximate Positions of the Major Planets".
- Physical data: NASA planetary fact sheets. Moon counts as of 2025.
- Three.js: MIT License (see `vendor/THREE-LICENSE.txt`).
