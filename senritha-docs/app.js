/* Senritha's Docs — a Word-style editor that runs in the browser.
   Editing engine: SuperDoc 1.47.2 (AGPL-3.0, vendored in vendor/superdoc) edits the .docx itself (OOXML),
   so formatting from Word survives open → edit → save. pdf.js reads text out of PDFs.
   Documents live in IndexedDB on this device, saved automatically as .docx blobs. */

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const UNTITLED = 'เอกสารไม่มีชื่อ';
const SAVE_DELAY = 1200;

/* Font menu. Web fonts are loaded in index.html; the rest show if the device has them.
   Whoever opens the exported .docx needs the same font installed (Word substitutes otherwise). */
const FONTS = ['Sarabun', 'TH Sarabun New', 'Noto Sans Thai', 'Noto Serif Thai', 'Kanit', 'Prompt', 'Chakra Petch',
  'Tahoma', 'Leelawadee UI', 'Angsana New', 'Cordia New',
  'Arial', 'Calibri', 'Cambria', 'Times New Roman', 'Georgia', 'Courier New'].map(f => ({ label: f, key: f }));

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const baseName = n => n.replace(/\.[^.]+$/, '').trim() || UNTITLED;
const narrow = () => innerWidth < 860;
const safeFile = n => (n || UNTITLED).replace(/[\\/:*?"<>|]+/g, ' ').trim() || UNTITLED;

/* ---------- Shared prefs with the rest of the bunker (theme, name) ---------- */
const prefs = (() => { try { return Object.assign({ name: 'Senritha', theme: 'system' }, JSON.parse(localStorage.getItem('ws.prefs') || '{}')); } catch { return { name: 'Senritha', theme: 'system' }; } })();
if (prefs.theme === 'light' || prefs.theme === 'dark') document.documentElement.dataset.theme = prefs.theme;

/* ---------- Storage: IndexedDB ---------- */
const dbp = new Promise((res, rej) => {
  const r = indexedDB.open('senritha-docs', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('docs', { keyPath: 'id' });
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
async function tx(mode, fn) {
  const db = await dbp;
  return new Promise((res, rej) => {
    const t = db.transaction('docs', mode), s = t.objectStore('docs');
    const out = fn(s);
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('aborted'));
  });
}
const db = {
  all: () => tx('readonly', s => s.getAll()),
  get: id => tx('readonly', s => s.get(id)),
  put: rec => tx('readwrite', s => s.put(rec)),
  del: id => tx('readwrite', s => s.delete(id)),
};

/* ---------- UI helpers ---------- */
let toastT;
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
function ask(title, body, okText = 'ตกลง', danger = false, cancel = true) {
  const d = $('#dlg');
  $('#dlgTitle').textContent = title; $('#dlgBody').textContent = body;
  $('#dlgOk').textContent = okText; $('#dlgOk').className = 'btn ' + (danger ? 'primary danger-bg' : 'primary');
  $('#dlgCancel').hidden = !cancel;
  d.returnValue = '';
  d.showModal();
  return new Promise(res => d.addEventListener('close', () => res(d.returnValue === 'ok'), { once: true }));
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const rtf = new Intl.RelativeTimeFormat('th', { numeric: 'auto' });
const dtf = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 45) return 'เมื่อสักครู่';
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  if (s < 86400 * 7) return rtf.format(-Math.round(s / 86400), 'day');
  return dtf.format(t);
}
function fmtBytes(b) { if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(b < 10240 ? 1 : 0) + ' KB'; return (b / 1048576).toFixed(1) + ' MB'; }

/* ---------- Home: list of documents ---------- */
async function renderList() {
  const docs = (await db.all()).sort((a, b) => b.updated - a.updated);
  $('#docCount').textContent = docs.length ? docs.length + ' ไฟล์' : '';
  $('#docList').innerHTML = docs.length ? docs.map(d => `
    <div class="doc" data-id="${d.id}" tabindex="0" role="button" aria-label="เปิด ${esc(d.name)}">
      <span class="ico" aria-hidden="true"></span>
      <span class="nm"><b>${esc(d.name)}</b><small>${d.from === 'pdf' ? 'จาก PDF · ' : ''}Word · ${fmtBytes(d.size || 0)}</small></span>
      <span class="when" title="${dtf.format(d.updated)}">${ago(d.updated)}</span>
      <span class="acts">
        <button class="ib" data-act="dl" aria-label="ดาวน์โหลด ${esc(d.name)}.docx" title="ดาวน์โหลด .docx"><svg viewBox="0 0 24 24"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19h14"/></svg></button>
        <button class="ib" data-act="del" aria-label="ลบ ${esc(d.name)}" title="ลบ"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg></button>
      </span>
    </div>`).join('') : '<div class="empty">ยังไม่มีเอกสาร สร้างเอกสารใหม่หรือเปิดไฟล์ Word / PDF</div>';
}
$('#docList').addEventListener('click', async e => {
  const row = e.target.closest('.doc'); if (!row) return;
  const id = row.dataset.id, act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'dl') { const r = await db.get(id); if (r) download(r.blob, safeFile(r.name) + '.docx'); return; }
  if (act === 'del') {
    const r = await db.get(id); if (!r) return;
    if (await ask('ลบเอกสารนี้?', `"${r.name}" จะถูกลบออกจากเครื่องนี้ และกู้คืนไม่ได้`, 'ลบ', true)) { await db.del(id); renderList(); toast('ลบแล้ว'); }
    return;
  }
  location.hash = 'doc/' + id;
});
$('#docList').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('doc')) e.target.click(); });

/* ---------- Editor ---------- */
let sd = null;          // SuperDoc instance
let cur = null;         // { id, name, created, from }
let session = 0;        // guards callbacks from a destroyed instance
let ready = false, dirty = false, saving = null, saveT = 0;

function setState(kind, text) { const s = $('#saveState'); s.className = 'save-state ' + kind; s.textContent = text; }
function showLoading(text) { $('#loadingText').textContent = text || 'กำลังเปิดเอกสาร…'; $('#loading').hidden = false; }

function destroyEditor() {
  session++; ready = false; dirty = false; clearTimeout(saveT);
  try { sd?.destroy(); } catch (e) { console.warn(e); }
  sd = null;
  $('#superdoc').innerHTML = ''; $('#toolbar').innerHTML = '';
}

function mountEditor(blob, { html = null, fresh = false } = {}) {
  destroyEditor();
  const my = session;
  $('#home').hidden = true; $('#editor').hidden = false;
  $('#docName').value = cur.name; document.title = cur.name + " · Senritha's Docs";
  setState('', ''); showLoading();
  const file = new File([blob], safeFile(cur.name) + '.docx', { type: DOCX_MIME }); // MIME is required or SuperDoc opens a blank page
  sd = new SuperDoc({
    selector: '#superdoc',
    toolbar: '#toolbar',
    document: file,
    documentMode: 'editing',
    zoom: { mode: narrow() ? 'fit-width' : 'manual' }, // phones: shrink the page to the screen
    telemetry: { enabled: false },
    user: { name: prefs.name || 'Senritha', email: '' },
    modules: { toolbar: { fonts: FONTS, responsiveToContainer: true } },
    onReady: () => {
      if (my !== session) return;
      if (html) {
        try { sd.activeEditor?.commands.insertContent(html, { contentType: 'html' }); }
        catch (e) { console.error(e); toast('ใส่ข้อความจาก PDF ไม่สำเร็จ'); }
      }
      ready = true;
      $('#loading').hidden = true;
      if (fresh || html) { dirty = true; saveNow(); } else setState('ok', 'บันทึกแล้ว');
    },
    onEditorUpdate: () => { if (my === session && ready) markDirty(); },
    onContentError: ({ error } = {}) => { if (my === session) failOpen(error); },
    onException: ({ error } = {}) => { console.error('SuperDoc', error); },
  });
}

async function failOpen(err) {
  console.error(err);
  destroyEditor();
  await ask('เปิดไฟล์ไม่ได้', 'ไฟล์นี้อาจเสียหาย หรือไม่ใช่ไฟล์ Word (.docx) ที่ถูกต้อง', 'ตกลง', false, false);
  location.hash = '';
}

function markDirty() {
  dirty = true; setState('busy', 'กำลังบันทึก…');
  clearTimeout(saveT); saveT = setTimeout(saveNow, SAVE_DELAY);
}

/* Export the live document to .docx and store it. Serialised: one save at a time, the latest edit always wins. */
async function saveNow() {
  clearTimeout(saveT);
  if (!sd || !ready || !cur) return;
  if (saving) { await saving; if (!dirty) return; }
  const my = session, rec = cur;
  dirty = false;
  saving = (async () => {
    try {
      setState('busy', 'กำลังบันทึก…');
      const blob = await sd.export({ triggerDownload: false });
      if (!blob || !blob.size) throw new Error('empty export');
      await db.put({ id: rec.id, name: rec.name, created: rec.created, from: rec.from, updated: Date.now(), size: blob.size, blob });
      if (my === session) setState(dirty ? 'busy' : 'ok', dirty ? 'กำลังบันทึก…' : 'บันทึกแล้ว');
    } catch (e) {
      console.error(e); dirty = true;
      if (my === session) setState('err', 'บันทึกไม่สำเร็จ');
    }
  })();
  await saving; saving = null;
  if (dirty && my === session) markDirty();
}
async function flush() { if (dirty) await saveNow(); else if (saving) await saving; }

async function openById(id) {
  const r = await db.get(id);
  if (!r) { toast('ไม่พบเอกสารนี้'); location.hash = ''; return; }
  cur = { id: r.id, name: r.name, created: r.created, from: r.from };
  mountEditor(r.blob);
}

let blankBlob = null;
async function blankA4() { if (!blankBlob) blankBlob = await (await fetch('assets/blank-a4.docx')).blob(); return blankBlob; }

async function newDoc() {
  const id = uid();
  cur = { id, name: UNTITLED, created: Date.now() };
  const blob = await blankA4();
  await db.put({ ...cur, updated: Date.now(), size: blob.size, blob });
  history.pushState(null, '', '#doc/' + id); routeShown = id;
  mountEditor(blob, { fresh: true });
  setTimeout(() => { const n = $('#docName'); n.focus(); n.select(); }, 50);
}

/* ---------- Opening files ---------- */
async function openFile(file) {
  if (!file) return;
  const lower = file.name.toLowerCase();
  const isPdf = lower.endsWith('.pdf') || file.type === 'application/pdf';
  const isDocx = lower.endsWith('.docx') || file.type === DOCX_MIME;
  if (lower.endsWith('.doc') && !isDocx) { ask('ยังไม่รองรับไฟล์ .doc แบบเก่า', 'เปิดไฟล์นี้ใน Word แล้วเลือก "บันทึกเป็น" .docx ก่อน จากนั้นนำมาเปิดที่นี่', 'ตกลง', false, false); return; }
  if (!isPdf && !isDocx) { toast('รองรับเฉพาะไฟล์ .docx และ .pdf'); return; }
  if (sd) await flush();
  const id = uid();
  if (isDocx) {
    cur = { id, name: baseName(file.name), created: Date.now() };
    await db.put({ ...cur, updated: Date.now(), size: file.size, blob: file }); // keep the original until the first save
    history.pushState(null, '', '#doc/' + id); routeShown = id;
    mountEditor(file);
    return;
  }
  // PDF → text → new A4 document
  $('#home').hidden = true; $('#editor').hidden = false; destroyEditor();
  $('#docName').value = baseName(file.name); setState('', '');
  showLoading('กำลังอ่านข้อความจาก PDF…');
  let html;
  try { html = await pdfToHtml(file); }
  catch (e) {
    console.error(e); $('#loading').hidden = true;
    await ask('อ่าน PDF ไม่ได้', e?.name === 'PasswordException' ? 'PDF นี้มีรหัสผ่าน ปลดรหัสก่อนแล้วลองใหม่' : 'ไฟล์ PDF นี้อาจเสียหาย', 'ตกลง', false, false);
    showHome(); return;
  }
  if (!html) {
    $('#loading').hidden = true;
    await ask('ไม่พบข้อความใน PDF', 'PDF นี้น่าจะเป็นภาพสแกน ซึ่งไม่มีข้อความให้ดึงออกมาแก้ไข', 'ตกลง', false, false);
    showHome(); return;
  }
  cur = { id, name: baseName(file.name), created: Date.now(), from: 'pdf' };
  history.pushState(null, '', '#doc/' + id); routeShown = id;
  mountEditor(await blankA4(), { html });
  toast('ดึงข้อความจาก PDF แล้ว เลย์เอาต์เดิมอาจไม่ครบ ตรวจทานก่อนใช้', 4200);
}

/* Many Thai fonts draw shifted tone marks and vowels from Private Use glyphs (U+F700–U+F71A).
   Map them back to the real Thai characters so the text is editable and searchable. */
const THAI_PUA = 'ฐิีึื่้๊๋์่้๊๋์ญัํ็่้๊๋์ฺุู';
const fixThai = s => s
  .replace(/[-]/g, c => THAI_PUA[c.charCodeAt(0) - 0xF700])
  .replace(/\s+(?=[ัิ-ฺ็-๎])/g, '') // no space before a combining mark
  .replace(/ํา/g, 'ำ'); // nikhahit + sara aa → sara am

/* PDF text → simple HTML: lines grouped by baseline, lines joined into paragraphs,
   larger text becomes headings, centred short lines stay centred. */
async function pdfToHtml(file) {
  const pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = tc.items.filter(i => i.str !== undefined && i.str !== '').map(i => ({
      s: i.str, x: i.transform[4], y: i.transform[5], w: i.width,
      h: Math.abs(i.transform[3]) || Math.hypot(i.transform[2], i.transform[3]) || i.height || 10,
    })).filter(i => !(/^\s+$/.test(i.s) && i.w < i.h * 0.1)); // zero-width "spaces" pdf.js adds between glyphs
    items.sort((a, b) => b.y - a.y); // stable: keeps stream order, which places Thai marks correctly
    const lines = [];
    for (const it of items) {
      const ln = lines.find(l => Math.abs(l.y - it.y) < Math.max(2, Math.min(l.h, it.h) * 0.45));
      if (ln) { ln.items.push(it); ln.h = Math.max(ln.h, it.h); } else lines.push({ y: it.y, h: it.h, items: [it] });
    }
    lines.sort((a, b) => b.y - a.y);
    for (const l of lines) {
      l.items.sort((a, b) => Math.abs(a.x - b.x) < 1 ? 0 : a.x - b.x); // ~same x: keep stream order
      let t = '', end = null;
      for (const it of l.items) {
        // Thai has no spaces between words, so only a wide gap between two Thai glyphs counts as a space
        const th = /[฀-๿-]/, both = th.test(t.slice(-1)) && th.test(it.s[0]);
        if (end !== null && it.x - end > it.h * (both ? 0.45 : 0.22) && !/\s$/.test(t) && !/^\s/.test(it.s)) t += ' ';
        t += it.s; end = it.x + it.w;
      }
      l.text = fixThai(t).replace(/\s+/g, ' ').trim();
      l.x0 = l.items[0].x; l.x1 = end;
    }
    pages.push({ w: vp.width, lines: lines.filter(l => l.text) });
  }
  const all = pages.flatMap(p => p.lines);
  if (!all.length) return '';
  const hs = all.map(l => l.h).sort((a, b) => a - b), body = hs[Math.floor(hs.length / 2)];
  const out = [];
  const thai = c => /[฀-๿]/.test(c);
  for (const p of pages) {
    const right = Math.max(...p.lines.map(l => l.x1)), left = Math.min(...p.lines.map(l => l.x0));
    let para = null, prev = null;
    const close = () => { if (para) out.push(para); para = null; };
    for (const l of p.lines) {
      const big = l.h >= body * 1.3;
      const tag = l.h >= body * 1.75 ? 'h1' : big ? 'h2' : 'p';
      const mid = (l.x0 + l.x1) / 2, width = l.x1 - l.x0;
      const centred = Math.abs(mid - p.w / 2) < p.w * 0.04 && width < (right - left) * 0.7 && l.x0 > left + 20;
      const gap = prev ? prev.y - l.y : 0;
      const breakBefore = !para || tag !== para.tag || tag !== 'p' || centred || para.centred
        || gap > prev.h * 1.75 || prev.x1 < right - (right - left) * 0.15 || l.x0 > left + 24 && l.x0 - prev.x0 > 12;
      if (breakBefore) { close(); para = { tag, centred, text: l.text }; }
      else para.text += (thai(para.text.slice(-1)) && thai(l.text[0]) ? '' : ' ') + l.text;
      prev = l;
    }
    close();
  }
  return out.map(b => `<${b.tag}${b.centred ? ' style="text-align:center"' : ''}>${esc(b.text)}</${b.tag}>`).join('');
}

/* ---------- Export ---------- */
async function exportDocx() {
  if (!sd || !ready) return;
  try {
    const blob = await sd.export({ triggerDownload: false });
    download(blob, safeFile(cur.name) + '.docx');
    dirty = true; saveNow();
  } catch (e) { console.error(e); toast('ส่งออก Word ไม่สำเร็จ'); }
}

/* PDF goes through the browser's print engine: vector text, selectable, real fonts.
   Each laid-out page becomes one PDF page at the document's own paper size. */
async function exportPdf() {
  if (!sd || !ready) return;
  await flush();
  const zoom = sd.getZoom?.() ?? 100;
  if (zoom !== 100) { sd.setZoom?.(100); await new Promise(r => setTimeout(r, 350)); }
  await document.fonts.ready;
  const first = document.querySelector('#superdoc .superdoc-page');
  const w = first ? first.offsetWidth / 96 : 8.27, h = first ? first.offsetHeight / 96 : 11.69;
  const st = document.createElement('style');
  // +0.02in absorbs sub-pixel rounding that would otherwise spill a blank page at the end
  st.textContent = `@page{size:${w.toFixed(3)}in ${(h + 0.02).toFixed(3)}in;margin:0}`;
  document.head.appendChild(st);
  const oldTitle = document.title;
  document.title = safeFile(cur.name); // becomes the suggested PDF file name
  toast('เลือก "บันทึกเป็น PDF" ในหน้าต่างพิมพ์', 3500);
  await new Promise(r => setTimeout(r, 60));
  window.print();
  setTimeout(() => {
    st.remove(); document.title = oldTitle;
    if (zoom !== 100) { if (narrow()) sd?.setZoomMode?.('fit-width'); else sd?.setZoom?.(zoom); }
  }, 500);
}

/* ---------- Routing ---------- */
let routeShown = null;
async function showHome() {
  if (sd) await flush();
  destroyEditor(); cur = null; routeShown = null;
  $('#editor').hidden = true; $('#home').hidden = false;
  document.title = "Senritha's Docs";
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  renderList();
}
async function route() {
  const m = location.hash.match(/^#doc\/([\w-]+)$/);
  if (m) { if (routeShown !== m[1]) { if (sd) await flush(); routeShown = m[1]; openById(m[1]); } }
  else if (routeShown !== null || !$('#editor').hidden) showHome();
}
addEventListener('hashchange', route);
addEventListener('popstate', route);

/* ---------- Wiring ---------- */
$('#btnNew').onclick = newDoc;
$('#btnOpen').onclick = $('#btnOpen2').onclick = () => $('#filePick').click();
$('#filePick').onchange = e => { const f = e.target.files[0]; e.target.value = ''; openFile(f); };
$('#btnBack').onclick = () => { history.pushState(null, '', location.pathname + location.search); route(); };
$('#btnDocx').onclick = exportDocx;
$('#btnPdf').onclick = exportPdf;

$('#docName').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { if (e.key === 'Escape') e.target.value = cur?.name || ''; e.target.blur(); } });
$('#docName').addEventListener('blur', async e => {
  if (!cur) return;
  const name = e.target.value.trim() || UNTITLED;
  e.target.value = name;
  if (name === cur.name) return;
  cur.name = name; document.title = name + " · Senritha's Docs";
  const r = await db.get(cur.id);
  if (r) { r.name = name; r.updated = Date.now(); await db.put(r); }
  setState('ok', 'บันทึกแล้ว');
});

addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod || $('#editor').hidden) return;
  const k = e.key.toLowerCase();
  if (k === 's') { e.preventDefault(); saveNow().then(() => toast('บันทึกแล้ว')); }
  else if (k === 'o') { e.preventDefault(); $('#filePick').click(); }
  else if (k === 'p') { e.preventDefault(); exportPdf(); }
});

// Save when the tab is hidden or closed
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && dirty) saveNow(); });
addEventListener('beforeunload', e => { if (dirty || saving) { saveNow(); e.preventDefault(); e.returnValue = ''; } });

// Drag and drop anywhere
let dragDepth = 0;
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; $('#drop').hidden = false; });
addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
addEventListener('dragleave', e => { if (!hasFiles(e)) return; if (--dragDepth <= 0) { dragDepth = 0; $('#drop').hidden = true; } });
addEventListener('drop', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth = 0; $('#drop').hidden = true; openFile(e.dataTransfer.files[0]); });

// Keep the device from evicting saved documents when storage gets tight
navigator.storage?.persist?.().catch(() => {});

renderList();
route();
