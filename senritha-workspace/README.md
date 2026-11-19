# Senritha's Work Space
One menu for every Senritha project. Pick an app to open it. Each app opens as its own page (not inside a frame), so it runs at full speed with full screen, camera and microphone working as normal. Use back to return to the menu.

## In the menu
- **Channels** (`channels/`): channels, sub-channels as deep as you like, and messages with text and images. Everything is saved on this device.
- **Senritha OS**, **Rhythm**, **Solaris X3D**, **Motorhome 3D**, **Test performance**: links to the sibling project folders.

To add a project, add one entry to `APPS` in `menu.js`.

## Channels features
- **Channels and sub-channels:** unlimited nesting, shown as a tree that expands and collapses. Breadcrumbs and sub-channel chips at the top of each channel. Rename or delete a channel; deleting asks first and removes its sub-channels too.
- **Messages:** text with **bold**, _italic_, ~~strike~~, `code`, code blocks and links. Messages are grouped by day and sender.
- **Images:** attach, paste or drag and drop up to 10 per message. Large photos are resized to 2048 px. Tap to open a lightbox that zooms from the thumbnail; swipe or use arrow keys to move between images, and drag down to close.
- **Reactions, threads, edit, delete, pin:** hover a message on a computer, or long-press on a phone. Pinned messages are listed under the pin button.
- **Search** across every channel and thread (⌘K / Ctrl+K), with matches highlighted. Tap a result to jump to the message.
- **Phone layout:** channel list, channel and thread are separate screens with native-style slide transitions and swipe-from-the-edge to go back.
- Light and dark themes (shared with the menu), your name and color, drafts kept per channel.

## Files
- `index.html`, `menu.css`, `menu.js`: the menu
- `channels/`: the Channels app (`db.js` is IndexedDB storage, `app.js` is the app)
- `sw.js`, `manifest.webmanifest`, `icons/`: install and offline support for the menu and Channels

## Run on your phone
Turn on GitHub Pages for the repo, then open `https://maybetha.github.io/Senritha-Bunker/senritha-workspace/` and add it to your home screen.
