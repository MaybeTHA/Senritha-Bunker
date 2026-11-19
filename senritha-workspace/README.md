# Senritha's Work Space
A personal work app: channels, sub-channels as deep as you like, and messages with text and images. Everything is saved on this device.

## Features
- **Channels and sub-channels:** unlimited nesting, shown as a tree that expands and collapses. Breadcrumbs and sub-channel chips at the top of each channel. Rename or delete a channel; deleting asks first and removes its sub-channels too.
- **Messages:** text with **bold**, _italic_, ~~strike~~, `code`, code blocks and links. Messages are grouped by day and sender.
- **Images:** attach, paste or drag and drop up to 10 per message. Large photos are resized to 2048 px. Tap to open a lightbox that zooms from the thumbnail; swipe or use arrow keys to move between images, and drag down to close.
- **Reactions, threads, edit, delete, pin:** hover a message on a computer, or long-press on a phone. Pinned messages are listed under the pin button.
- **Search** across every channel and thread (⌘K / Ctrl+K), with matches highlighted. Tap a result to jump to the message.
- **Phone layout:** channel list, channel and thread are separate screens with native-style slide transitions and swipe-from-the-edge to go back.
- Light and dark themes, your name and color, drafts kept per channel, installable and works offline.

## Files
- `index.html`, `style.css`: layout and styles
- `db.js`: IndexedDB storage (channels, messages, images)
- `app.js`: the app
- `sw.js`, `manifest.webmanifest`, `icons/`: install and offline support

## Run on your phone
Turn on GitHub Pages for the repo, then open `https://maybetha.github.io/Senritha-Bunker/senritha-workspace/` and add it to your home screen.
