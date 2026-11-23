// ชิ้นส่วนหน้าจอที่ทุกหน้าใช้: สร้าง DOM · ไอคอน · ข้อความลอย · กล่องล่าง (modal) · กล่องยืนยัน · ป้ายหมวด
// ข้อความผู้ใช้ผ่าน textContent เสมอ — innerHTML ใช้กับไอคอนคงที่เท่านั้น

/** h('button.go', { onclick }, 'ทำเลย') */
export function h(tag, props, ...kids) {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (props != null && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { kids.unshift(props); props = null; }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv); }
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}
export function append(el, kids) {
  for (const c of [kids].flat(Infinity)) if (c != null && c !== false && c !== '') el.append(c instanceof Node ? c : String(c));
  return el;
}
export const put = (el, ...kids) => { el.replaceChildren(); return append(el, kids); };
export const $ = s => document.querySelector(s);

const P = {
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>', up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  left: '<path d="M15 5l-7 7 7 7"/>', right: '<path d="M9 5l7 7-7 7"/>', plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  text: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>', tasks: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7M9 7h3"/>', me: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18a6.5 6.5 0 0111 0"/>',
  check: '<path d="M5 12l5 5 9-10"/>', moon: '<path d="M20 14A8 8 0 1110 4a6.5 6.5 0 0010 10z"/>', reset: '<path d="M4 12a8 8 0 108-8 8.5 8.5 0 00-6 2.5L4 8"/><path d="M4 3v5h5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', img: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  pin: '<path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>', book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/>',
  save: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/>', restore: '<path d="M12 21V9M7 14l5-5 5 5"/><path d="M4 7V4h16v3"/>',
  spark: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  layout: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M4 14h16M9 17.5h6"/>',
  hand: '<path d="M18 11V6a2 2 0 00-4 0v5M14 10V4a2 2 0 00-4 0v6M10 10.5V6a2 2 0 00-4 0v8"/><path d="M18 8a2 2 0 114 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 012.8-2.8L7 15"/>',
  users: '<circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 19a5.5 5.5 0 0111 0M15 15.5a4.5 4.5 0 016 3.5"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>', bell: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4z"/><path d="M10 20a2 2 0 004 0"/>',
  handheart: '<path d="M12 11.5s-3.5-2.2-3.5-4.7a2 2 0 013.5-1.3 2 2 0 013.5 1.3c0 2.5-3.5 4.7-3.5 4.7z"/><path d="M3 15h3l4 2h4.5a1.5 1.5 0 000-3H11"/><path d="M14 16l5-2.5a1.5 1.5 0 011.5 2.5L14 20H8l-5-1.5"/>',
  wheel: '<circle cx="11" cy="4.5" r="1.8"/><path d="M11 7.5v6h5l2.5 5"/><path d="M11 10.5h5"/><path d="M8.5 11.2a5.5 5.5 0 107.5 6.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  bot: '<rect x="4" y="7" width="16" height="12" rx="4"/><path d="M12 3v4M9 12.5h.01M15 12.5h.01M9.5 16h5"/><path d="M2 12v3M22 12v3"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
  homehelp: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9.5 15.5l2 2 3.5-4"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
  landmark: '<path d="M3 9l9-5 9 5z"/><path d="M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18"/>',
  siren: '<path d="M7 18v-6a5 5 0 0110 0v6"/><path d="M5 18h14v3H5zM12 3v2M4.2 6.2l1.4 1.4M19.8 6.2l-1.4 1.4"/>',
  steth: '<path d="M6 3v6a4 4 0 008 0V3"/><path d="M10 13v2a5 5 0 0010 0v-2"/><circle cx="20" cy="11" r="2"/>',
  map: '<path d="M12 21s-6-5.6-6-11a6 6 0 0112 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.3"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
  pill: '<g transform="rotate(-45 12 12)"><rect x="3" y="8.5" width="18" height="7" rx="3.5"/><path d="M12 8.5v7"/></g>',
  clip: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
  broom: '<path d="M14 3l-4 9"/><path d="M6 13h8l2 8H4z"/><path d="M8 17v4M12 17v4"/>',
  car: '<path d="M4 16v-4l2-5h12l2 5v4z"/><path d="M4 12h16"/><circle cx="7.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/>',
  tool: '<path d="M14.5 6.5a4 4 0 005 5L13 18a2.1 2.1 0 01-3-3z"/><path d="M14.5 6.5L17 4"/><path d="M3 21l7-7"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 007 0"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  bowl: '<path d="M3 11h18a9 9 0 01-18 0z"/><path d="M8 7c0-1.5 1-2 1-3M12 7c0-1.5 1-2 1-3M16 7c0-1.5 1-2 1-3"/>',
  walk: '<circle cx="12" cy="4.5" r="2"/><path d="M10 21l2-7-3-2 1-4 4 2 2 3M8 13l-2 3M17 12v9"/>',
  bed: '<path d="M3 18V7M3 13h18v5M21 18v2M3 18v2"/><path d="M7 13v-3h6a3 3 0 013 3"/>',
  truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2 0 00-2.5-1.5c-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2a2.5 2 0 01-2.5-1.5M12 6v1.5M12 16.5V18"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
  doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  activity: '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M4 10h16M9 3v4M15 3v4M8.5 15l2 2 4-4"/>',
  userplus: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0113 0M19 8v6M16 11h6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0014.5 4h-9A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16H8"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', eyeoff: '<path d="M3 3l18 18M10.6 6.1A10 10 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.2 3.8M6.6 7.6A17 17 0 002 12s4 7 10 7a9.6 9.6 0 004.4-1"/>',
};
export const ic = n => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

// ภาพประกอบปุ่มเพิ่มการเตือน 4 แบบ · เส้นเข้ม = สีตัวอักษร พื้นขาว = สีแผ่น (ธีมมืดจะไม่หาย)
const W = 'style="fill:var(--sheet-bg)" stroke="currentColor"';
export const ART = {
  speak: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="17" y="4" width="14" height="26" rx="7" fill="#0A6CF1"/><rect x="20" y="9" width="8" height="3" rx="1.5" fill="#fff" opacity=".5"/><path d="M11 22a13 13 0 0026 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M24 35v7M17 43h14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  attach: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="9" width="30" height="32" rx="4" ${W} stroke-width="3"/><circle cx="16" cy="19" r="3.5" fill="#F4A340"/><path d="M8 37l10-10 7 7 4-4 7 7" fill="#0A6CF1" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><circle cx="37" cy="10" r="8" fill="#0A6CF1"/><path d="M37 6v8M33 10h8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  type: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="14" width="40" height="24" rx="5" ${W} stroke-width="3"/><g fill="currentColor"><rect x="10" y="20" width="4" height="4" rx="1"/><rect x="17" y="20" width="4" height="4" rx="1"/><rect x="24" y="20" width="4" height="4" rx="1"/><rect x="31" y="20" width="4" height="4" rx="1"/><rect x="14" y="28" width="20" height="4" rx="1"/></g><rect x="14" y="5" width="20" height="7" rx="3.5" fill="#0A6CF1"/></svg>`,
  shoot: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 15h8l3-5h14l3 5h8v25H6z" fill="currentColor"/><circle cx="24" cy="27" r="9" style="fill:var(--sheet-bg)"/><circle cx="24" cy="27" r="5.5" fill="#0A6CF1"/><rect x="36" y="18" width="4" height="3" rx="1" style="fill:var(--sheet-bg)"/></svg>`,
};

/* ---------- ข้อความลอย (มีปุ่มเลิกทำได้) ---------- */
let toastT;
export function toast(msg, action) {
  let el = $('#toast');
  if (!el) { el = h('div'); el.id = 'toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.append(el); }
  put(el, h('span', msg), action ? h('button', { onclick: () => { el.classList.remove('show'); action.run(); } }, action.label) : null);
  el.classList.add('show'); clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), action ? 6000 : 2600);
}

/* ---------- ประวัติของเบราว์เซอร์: ปุ่มย้อนกลับของเครื่องปิดกล่อง/ออกจากโหมดโน้ต ---------- */
let skipPop = 0;
const backHandlers = [];
/** ลงทะเบียนตัวรับปุ่มย้อนกลับ — ตัวที่ลงทีหลังได้ก่อน · คืน true = จัดการแล้ว */
export const onBack = fn => backHandlers.unshift(fn);
window.addEventListener('popstate', e => {
  if (skipPop) { skipPop--; return; }
  for (const fn of backHandlers) if (fn(e)) return;
});
export function pushBack(state) { try { history.pushState(state, ''); return true; } catch { return false; } }
/** ถอยประวัติที่เราใส่เองไว้ โดยไม่ให้ตัวรับปุ่มย้อนกลับทำงาน */
export function dropBack(key) { if (history.state?.[key]) { skipPop++; history.back(); } }

/* ---------- กล่องล่าง (modal): ปิดด้วยปุ่มปิด · แตะพื้นหลัง · Esc · ปุ่มย้อนกลับ — ถ้ายังมีข้อความค้างจะถามก่อน ---------- */
let cur = null;
export const modalOpen = () => !!cur;
export function openModal({ title, body, foot, isDirty = () => false, onClose, label }) {
  if (cur) cur.close(true);
  const scrim = h('div.mscrim');
  const box = h('section.modal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': label || title });
  const prevFocus = document.activeElement;
  let closed = false;
  const api = {
    box, setDirty: fn => { isDirty = fn; },
    close: async (force = false, fromPop = false) => {
      if (closed) return true;
      if (!force && isDirty()) {
        if (fromPop) pushBack({ modal: 1 });
        const ok = await confirmBox({ title: 'ทิ้งข้อความที่พิมพ์ไว้?', body: 'ยังไม่ได้บันทึก ถ้าปิดตอนนี้ข้อความจะหาย', ok: 'ทิ้ง', cancel: 'กลับไปแก้ต่อ', danger: true });
        if (!ok) return false;
      }
      closed = true; if (cur === api) cur = null;
      if (!fromPop) dropBack('modal');
      box.classList.remove('show'); scrim.classList.remove('show');
      setTimeout(() => { box.remove(); scrim.remove(); }, 300);
      document.removeEventListener('keydown', onKey);
      prevFocus?.focus?.({ preventScroll: true });
      onClose?.();
      return true;
    },
  };
  const onKey = e => { if (e.key === 'Escape' && cur === api && !$('.confirm')) api.close(); };
  box.append(h('div.mhead', h('h2', title), h('button.iconbtn', { 'aria-label': 'ปิด', onclick: () => api.close(), html: ic('close') })),
    h('div.mbody', body), foot ? h('div.mfoot', foot) : '');
  scrim.onclick = () => api.close();
  document.body.append(scrim, box);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => { box.classList.add('show'); scrim.classList.add('show'); });
  pushBack({ modal: 1 });
  cur = api;
  return api;
}
export const closeModal = (force = true) => cur?.close(force);
onBack(() => { if (!cur) return false; cur.close(false, true); return true; });

/* ---------- กล่องยืนยัน ---------- */
export function confirmBox({ title, body, ok = 'ตกลง', cancel = 'ยกเลิก', danger = false }) {
  return new Promise(resolve => {
    const done = v => { wrap.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    const okBtn = h('button.btn' + (danger ? '.danger' : '.primary'), { onclick: () => done(true) }, ok);
    const wrap = h('div.confirm', { role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'cf-t', onclick: e => { if (e.target === wrap) done(false); } },
      h('div.cbox', h('h3', { id: 'cf-t' }, title), body ? h('p', body) : '', h('div.row2', h('button.btn.ghost', { onclick: () => done(false) }, cancel), okBtn)));
    document.body.append(wrap);
    document.addEventListener('keydown', onKey, true);
    okBtn.focus();
  });
}

/* ---------- หมวด: ตัวย่อ สีอ่อน ป้าย ---------- */
const SHORT = { 'คณิตศาสตร์': 'คณิต', 'ภาษาไทย': 'ไทย', 'ภาษาอังกฤษ': 'Eng', 'วิทยาศาสตร์': 'วิทย์', 'ฟิสิกส์': 'ฟิส', 'เคมี': 'เคมี', 'ชีววิทยา': 'ชีวะ', 'สังคมศึกษา': 'สังคม' };
export const NONE = { id: '', name: 'ไม่ระบุหมวด', color: '#69778F', aliases: [] };
export function shortOf(s) {
  if (!s?.id) return '—';
  if (SHORT[s.name]) return SHORT[s.name];
  const base = s.name.replace(/^(ภาษา|หมวด)/, '');
  const nick = (s.aliases || []).find(a => a.length <= 5);
  return base.length <= 5 ? base : (nick || base.slice(0, 4));
}
export const nameOf = s => s?.id ? s.name.replace(/^ภาษา/, '') : '';
export const tintOf = s => (s?.color || '#69778F') + '1F'; // สีหมวดโปร่ง 12%
export const badge = s => h('span.badge', { style: { background: tintOf(s), color: s?.color || '#69778F' }, 'aria-hidden': 'true' }, shortOf(s));
