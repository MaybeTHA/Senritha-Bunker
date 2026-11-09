# Senritha's Rhythm
A beat visualizer you install on your phone. Pick songs from your phone and the visuals move with every beat.

## How it follows your music
1. Each song is decoded on the device and analysed once: band energies, then onset strength, then tempo by autocorrelation, then beat tracking with dynamic programming. This finds the BPM, every beat, the downbeats, kick hits and hi-hat hits.
2. While playing, the visuals are drawn from the song clock, so rings, bursts and color changes land on the mapped beats. Colors change on each bar.
3. Until the analysis finishes, a live bass detector drives the beat.
4. **Beat sync** in Settings shifts the visuals earlier or later, for example to make up for Bluetooth delay.

## Features
- Three visual styles: Orb, Bars, Tunnel
- Library saved on the device (IndexedDB), with a demo beat made on the phone
- Lock-screen controls (Media Session) and the screen stays on while playing
- Installable and works offline (manifest + service worker)

## Files
- `index.html`, `style.css`: page and styles
- `app.js`: player, library, settings, phone integration
- `analysis.js`: beat analysis
- `visuals.js`: the three visual styles
- `sw.js`, `manifest.webmanifest`, `icons/`: install and offline support

## Install on your phone
1. Turn on GitHub Pages for this repo (Settings → Pages → Deploy from a branch → `main`, `/ (root)`).
2. Open `https://maybetha.github.io/Senritha-Bunker/senritha-rhythm/` on your phone.
3. Android (Chrome): tap **Install** in Settings, or use the browser menu → Install app. iPhone (Safari): Share → Add to Home Screen.
