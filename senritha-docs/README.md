# Senritha's Docs

Word-style document editor that runs in the browser. Thai UI. No server.

## What it does
- **New document**: blank A4 page, Sarabun 14 pt (`assets/blank-a4.docx`).
- **Open .docx**: edits the Word file itself (OOXML), so styles, headers/footers, tables, images and lists from Word stay intact when saved back.
- **Open .pdf**: pulls the text out with pdf.js and turns it into an editable A4 document (paragraphs, headings, centred lines). The original layout is not kept. Thai text is cleaned up (private-use tone marks mapped back, stray spaces removed). Scanned PDFs have no text and are refused with a message.
- **Export**: *Word* downloads a `.docx`. *PDF* uses the browser's print dialog (choose "Save as PDF"): vector text, one PDF page per document page at the document's own paper size.
- **Autosave**: every edit is saved as `.docx` in IndexedDB on this device (about 1 s after you stop typing). The home screen lists them; each can be downloaded or deleted.
- Shortcuts: Ctrl/⌘+S save now, Ctrl/⌘+O open, Ctrl/⌘+P export PDF. Drag a file anywhere to open it.

## Files
| File | Purpose |
| --- | --- |
| `index.html` | Home screen + editor shell |
| `app.js` | Storage, editor lifecycle, autosave, PDF import, export |
| `style.css` | App styles, phone layout, print rules used for PDF export |
| `assets/blank-a4.docx` | Template for new documents |
| `vendor/superdoc/` | SuperDoc 1.47.2 browser build (the editing engine) |
| `vendor/pdfjs/` | pdf.js 4.10.38 (PDF text extraction) |

## Notes
- Fonts: the font menu offers Thai web fonts (Sarabun, Noto Sans/Serif Thai, Kanit, Prompt, Chakra Petch) plus common Windows fonts. Whoever opens the exported `.docx` needs the font installed, or Word substitutes another one.
- Old binary `.doc` files are not supported; save them as `.docx` in Word first.
- SuperDoc's telemetry is turned off (`telemetry: { enabled: false }`).

## Licenses
- SuperDoc 1.47.2 is AGPL-3.0 (`vendor/superdoc/LICENSE`). SuperDoc 2.x is not used on purpose: it depends on a closed-source DOCX engine.
- pdf.js is Apache-2.0 (`vendor/pdfjs/LICENSE`).
- Because SuperDoc is AGPL-3.0, this app's source must stay public. It is: this repository.
