# Inside Bunker
Senritha's personal OS: the home page of Senritha-Bunker (`/index.html` at the repo root). It launches every project in the repo.

## Features
- **System bar:** logo, live date and clock, online/offline status, notifications panel (empty until an app sends notifications), settings and profile avatar.
- **Home:** welcome, plus an overview made only from real data: number of apps, apps opened this week, Work Space channel and message counts (read from its own database, only if it already exists), and storage used by this site as the browser reports it.
- **Recent apps:** every launch from Inside Bunker is recorded on this device and shown newest first.
- **Applications:** grid or compact list (the choice is remembered), favorites with a star, filter by category.
- **Search:** ⌘K / Ctrl K or `/`. Matches name, description and category, filters by category, ↑ ↓ to move, Enter to open, Esc to close.
- **Sidebar:** Home, All applications, Recent apps, Favorites, Categories, Settings. Full or icons-only on desktop, icon rail with slide-over panel on tablet, bottom dock on phones.
- **Settings:** name and avatar color (shared with Work Space), layout, sidebar, clear history and favorites.

Apps open as their own pages, not inside a frame, so each one keeps full speed, full screen, camera and microphone.

## Add an app
Add one entry to `APPS` and a glyph to `G` in `app.js`. Categories are in `CATS`.

## Files
- `../index.html`: page structure
- `style.css`: styles (black + electric blue tokens on `:root`)
- `app.js`: apps, routing (`#apps`, `#recent`, `#favorites`, `#categories`, `#settings`), search, launch, stats
- `icon.svg`: favicon

## Saved on this device
`localStorage`: `ib.recent`, `ib.fav`, `ib.view`, `ib.rail`, and `ws.prefs` (name and color, shared with Work Space).
