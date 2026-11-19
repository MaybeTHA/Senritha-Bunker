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
- **Real planetary data.** Mercury, Venus, Mars and the Moon use real colour maps plus elevation models
  from NASA/USGS missions (MESSENGER, Magellan, MGS MOLA, LRO LOLA), turned into normal and height maps.
  The surfaces are displaced in 3D, shaded with crater-scale ambient occlusion, and cast their own terrain
  shadows near the day/night line. Earth uses 8K day, night, cloud, normal and ocean maps; Jupiter and Saturn
  use real global cloud maps.
- **Progressive resolution.** Every body loads 2K maps first so the scene appears quickly. The body you fly
  to steps up to 4K and then 8K (desktop), and drops back when you leave so only one large set stays in
  GPU memory. Grayscale maps are stored single-channel. Procedural micro-detail fades in for extreme close-ups.
- **Living atmospheres.** Jupiter's and Saturn's real cloud maps flow at different speeds by latitude, the
  Great Red Spot rotates as a vortex, and separate cloud decks drift above them for depth. Saturn has its
  north polar hexagon. Venus has moving cloud layers and a **RADAR SURFACE MODE** (Magellan radar, optional
  false-colour elevation). Earth has two cloud decks, live hurricanes, moving cloud shadows, ocean glint and
  aurora. Mars has regional and occasional planet-wide dust storms. Neptune's dark storms form, drift and fade.
- **Physically based scattering.** Each atmosphere is ray-marched with Rayleigh and Mie scattering using its
  own coefficients: blue Earth, golden Venus, dusty Mars, orange Titan, thin hazes on the giants.
- **Ring systems.** Saturn's rings use a measured opacity profile with the D, C, B, A, F, G and E rings, an
  empty Cassini Division, Encke and Keeler gaps, a braided F ring, fine ringlets that appear up close, faint
  spokes, icy glints, translucency, shadows both ways, and instanced ice boulders when the camera skims the
  ring plane. Jupiter has a dusty main ring, halo and gossamer rings that brighten when backlit. Uranus has its
  narrow dark rings plus the faint outer rings; Neptune has five rings and the Adams ring arcs.
- **The Sun** has animated granulation, sunspots, prominences, occasional flares and coronal mass ejections,
  magnetic threads in the corona, and a subtle lens flare when you look toward it.
- Analytic shadows: moons eclipse planets, planets eclipse moons, Saturn's rings and planet shadow each other.
- Real axial tilts and pole directions (Uranus rolls on its side at about 98°), oblate gas giants,
  tidally locked moons, Triton's backwards orbit.
- Performance: geometry levels of detail, adaptive resolution, quality presets (`?q=low`, `?q=mid`, `?q=high`),
  and a guard pass that keeps a single bad pixel from spoiling the bloom.

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
- Colour maps: [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0), based on NASA mission data.
- Elevation: NASA/USGS Astrogeology: MESSENGER global DEM (Mercury), Magellan global topography (Venus),
  MGS MOLA DEM (Mars); NASA SVS CGI Moon Kit, LRO LOLA (Moon).
- Orbital elements: JPL, "Keplerian Elements for Approximate Positions of the Major Planets".
- Physical data: NASA planetary fact sheets. Moon counts as of 2025.
- Three.js: MIT License (see `vendor/THREE-LICENSE.txt`).
