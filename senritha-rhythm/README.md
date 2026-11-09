# Senritha's Rhythm
A beat visualizer and rhythm game you install on your phone. Pick songs from your phone; the visuals move with every beat, and any song can be played as a 4-lane rhythm game.

## How it follows your music (engine v2)
1. **Analysis, once per song, on the device, in a background worker:** mono mix at 22 050 Hz → short-time FFT (5.8 ms steps) → log spectral flux in bass, mid, high and full bands.
2. **Tempo:** autocorrelation with harmonic checks and a tempo prior, then a local tempo curve (8 s windows) so songs that speed up or slow down stay locked.
3. **Beats:** dynamic-programming beat tracking on that tempo curve. Each beat is then pulled onto the nearest real onset with sub-frame precision.
4. **Downbeats, kicks and hi-hats** come from the band onsets with adaptive thresholds, so quiet sections still get hits.
5. **Playback clock:** a smoothed clock gives an exact song time on every frame, even on phones where the audio position updates slowly. Game taps are judged at the moment of the touch (event timestamp), not when the code runs.
6. **Sync:** output latency is subtracted automatically. **Calibrate by tapping** (Settings) measures any extra delay, such as Bluetooth, from 16 taps.

### Accuracy test
`node test/accuracy.js` builds five synthetic songs with known beat times (four-on-the-floor 128, swung hip-hop 90, a 100→116 tempo ramp, a soft 72 BPM ballad, syncopated pop 120). It checks tempo, beat F-measure at ±70 ms and ±25 ms, and the average timing offset. Engine v2 lands every beat within ±25 ms with about 1–2 ms average error, and finds the right tempo for all five songs, including the ramp and the ballad.

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
- `analysis.js`: beat analysis engine (runs in a Web Worker)
- `calibrate.js`: tap-to-sync calibration
- `test/accuracy.js`: engine accuracy test
- `visuals.js`: the visual styles
- `game.js`: rhythm game
- `clip.js`: clip recording and sharing
- `tags.js`: MP3/M4A tag and cover art reader
- `sw.js`, `manifest.webmanifest`, `icons/`: install and offline support

## Install on your phone
1. Turn on GitHub Pages for this repo (Settings → Pages → Deploy from a branch → `main`, `/ (root)`).
2. Open `https://maybetha.github.io/Senritha-Bunker/senritha-rhythm/` on your phone.
3. Android (Chrome): tap **Install** in Settings, or use the browser menu → Install app. iPhone (Safari): Share → Add to Home Screen.
