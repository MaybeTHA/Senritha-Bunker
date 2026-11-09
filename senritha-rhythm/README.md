# Senritha's Rhythm
A beat visualizer and rhythm game you install on your phone. Pick songs from your phone; the visuals move with every beat, and any song can be played as a 4-lane rhythm game.

## How it follows your music
1. Each song is decoded on the device and analysed once: band energies, then onset strength, then tempo by autocorrelation, then beat tracking with dynamic programming. This finds the BPM, every beat, the downbeats, kick hits and hi-hat hits.
2. While playing, the visuals are drawn from the song clock, so rings, bursts and color changes land on the mapped beats. Colors change on each bar.
3. Until the analysis finishes, a live bass detector drives the beat.
4. **Beat sync** in Settings shifts the visuals earlier or later, for example to make up for Bluetooth delay.

## Features
- **Six visual styles:** Orb, Bars, Tunnel, Wave, Galaxy, Words. **Auto style** switches between calm, medium and intense styles as the song's loudness changes, always on a downbeat.
- **Rhythm game:** any analysed song becomes a 4-lane game (Easy, Normal, Hard) built from its beats, kicks and hi-hats. Perfect/Great/Good timing, combo, accuracy, S–D grade and a best score for each song and difficulty.
- **Share a clip:** records 15 seconds of the screen (visuals or game) with the song, then shares it with the phone's share sheet or saves it as a video.
- **Library:** playlists, shuffle, repeat (all / one / off), and title, artist and cover art read from MP3 and M4A tags
- Songs saved on the device (IndexedDB), with a demo beat made on the phone
- Lock-screen controls (Media Session) and the screen stays on while playing
- Installable and works offline (manifest + service worker)

## Files
- `index.html`, `style.css`: page and styles
- `app.js`: player, library, settings, phone integration
- `analysis.js`: beat analysis
- `visuals.js`: the visual styles
- `game.js`: rhythm game
- `clip.js`: clip recording and sharing
- `tags.js`: MP3/M4A tag and cover art reader
- `sw.js`, `manifest.webmanifest`, `icons/`: install and offline support

## Install on your phone
1. Turn on GitHub Pages for this repo (Settings → Pages → Deploy from a branch → `main`, `/ (root)`).
2. Open `https://maybetha.github.io/Senritha-Bunker/senritha-rhythm/` on your phone.
3. Android (Chrome): tap **Install** in Settings, or use the browser menu → Install app. iPhone (Safari): Share → Add to Home Screen.
