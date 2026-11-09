# Senritha OS
A phone OS-style web app: lock screen, home screen, app switcher, Control Center and an App Store. Animations use spring physics and GPU transforms.

## Apps
- **Built in:** Settings, Clock, Calculator, Notes, Calendar, Tips, Camera, Gallery, App Store
- **App Store downloads:** Snake, Paper Glide (tap-to-fly game), Sketch (drawing), Pulse (music made live with Web Audio)

## Phone features
- **Camera:** shows a live view when the page runs over HTTPS (GitHub Pages). Elsewhere it opens your phone's own camera app. Photos are saved in Gallery.
- **Flashlight** (Control Center): turns on the real torch in Chrome on Android. Other browsers get a bright white screen light instead.

## Files
- `index.html`: layout
- `style.css`: styles and theme tokens
- `app.js`: spring engine, gestures, window manager, core apps and the `OS` API
- `apps/*.js`: one file per extra app. Each file calls `OS.register(id, {...})`. Set `installable: true` to list the app in the App Store.

## Run on your phone (GitHub Pages)
1. On GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then save.
3. After about a minute, open `https://maybetha.github.io/Senritha-Bunker/senritha-os/` on your phone.
4. Allow camera access when asked. Add the page to your home screen to run it full screen.
