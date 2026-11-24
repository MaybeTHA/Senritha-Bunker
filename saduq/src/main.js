// จุดเริ่มแอป Saduq ศูนย์รวมบริการผู้สูงอายุ: เปิดที่เก็บข้อมูลในเครื่อง → เส้นทาง (hash) → เมนูล่าง 5 ปุ่ม
import { h, ic, toast, $, put } from './ui/kit.js';
import { openBestDB } from './data/db.js';
import { createStore } from './data/store.js';
import { app, gcUrls } from './features/shared.js';
import { applyTheme } from './features/me.js';
import { homeView, servicesView, categoryView, serviceView } from './features/hub.js';
import { activityView, requestView, notifView } from './features/care.js';
import { familyView, emergencyView, profileView, applyScale } from './features/family.js';
import { subjectView } from './features/tasks.js';
import { openReminder } from './features/remind.js';
import { avatar } from './features/common.js';
import { needsOnboarding } from './features/onboard.js';
import { addHubSamples } from './features/family.js';
import { addSampleReviews } from './features/reviews.js';
import { personView } from './features/people.js';
import { productsView, productView } from './features/shop.js';
import { assistantView } from './features/assistant.js';

globalThis.SABAII_VERSION = '2.2.0';
const VIEWS = {
  home: ['หน้าหลัก', homeView], services: ['บริการ', servicesView], cat: ['บริการ', categoryView], svc: ['บริการ', serviceView],
  activity: ['งานดูแล', activityView], req: ['เรื่องที่ติดตาม', requestView], notif: ['การแจ้งเตือน', notifView], subject: ['หมวดการเตือน', subjectView],
  family: ['ทีมดูแล', familyView], person: ['ผู้รับการดูแล', personView], ai: ['ผู้ช่วย AI', assistantView], shop: ['สินค้าและอุปกรณ์', productsView], product: ['สินค้า', productView], emergency: ['ฉุกเฉิน', emergencyView], me: ['ฉัน', profileView],
};
const ALIAS = { tasks: 'activity' }; // ลิงก์รุ่นนักเรียนเดิม
const NAV_OF = { services: 'home', cat: 'home', svc: 'home', emergency: 'home', person: 'home', product: 'shop', req: 'activity', notif: 'activity', subject: 'activity', family: 'me' };
const NAV = [['home', 'home', 'หน้าหลัก'], ['ai', 'spark', 'ผู้ช่วย AI'], ['activity', 'activity', 'งานดูแล'], ['shop', 'bag', 'สินค้า'], ['me', 'me', 'ฉัน']];

/** รับทั้ง #home และ #/home และ #svc/h-appt */
export function route() {
  let [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
  name = ALIAS[name] || name;
  return name in VIEWS ? { name, arg } : { name: 'home' };
}

async function boot() {
  let store;
  try { store = createStore(await openBestDB()); await store.load(); }
  catch (e) { document.body.append(h('div.fatal', h('b', 'เปิดข้อมูลในเครื่องไม่ได้'), h('p', String(e.message || e)))); return; }
  app.store = store;
  app.openNotes = openReminder;
  applyTheme(); applyScale();
  if (store.state.dbKind !== 'indexeddb') document.body.append(h('div.storage-warn', 'เบราว์เซอร์นี้เก็บข้อมูลถาวรไม่ได้ — ข้อมูลจะหายเมื่อปิดหน้า'));

  const page = $('#page'), wrap = $('#page .wrap'), nav = $('#nav');
  put(nav, NAV.map(([r, i, l]) => h('a', { href: '#' + r, 'data-r': r, html: ic(i) + `<span>${l}</span>` })));
  const topnav = $('#topnav');
  put(topnav, NAV.map(([r, , l]) => h('a', { href: '#' + r, 'data-r': r }, l)));
  const paintTop = () => {
    const unread = store.state.notices.filter(n => !n.read).length;
    $('.tb-bell').innerHTML = ic('bell') + (unread ? `<em>${Math.min(unread, 99)}</em>` : '');
    $('.tb-bell').setAttribute('aria-label', `การแจ้งเตือน${unread ? ` ยังไม่อ่าน ${unread}` : ''}`);
    put($('.tb-me'), avatar('me', store.state.prefs.display_name || 'ฉ'));
  };
  const sos = $('#sos');
  let last = null;
  function render() {
    const r = route(), key = r.name + '/' + (r.arg || '');
    const y = key === last ? page.scrollTop : 0;
    wrap.dataset.view = r.name;
    VIEWS[r.name][1](wrap, r.arg);
    paintTop();
    if (key !== last) { document.title = `${VIEWS[r.name][0]} · Saduq`; }
    page.scrollTop = y;
    const here = NAV_OF[r.name] || r.name;
    document.querySelectorAll('#nav a, #topnav a').forEach(a => a.dataset.r === here ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
    sos.hidden = r.name === 'emergency' || r.name === 'home' || r.name === 'ai';
    if (key !== last) { const h1 = wrap.querySelector('h1'); if (last && h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); } }
    last = key;
  }
  app.refresh = () => { applyScale(); if (route().name === 'ai') { if (document.activeElement?.matches?.('#ai-q')) paintTop(); else render(); return; } if (!document.activeElement?.matches?.('#hub-q')) render(); else homeRefreshKeepFocus(); };
  const homeRefreshKeepFocus = () => { const r = route(); if (r.name === 'home') homeView(wrap, true); else render(); };
  store.subscribe(() => { gcUrls(); app.refresh(); });
  addEventListener('hashchange', render);
  render();
  // เปิดแอปครั้งแรก: เข้าหน้าหลักทันที พร้อมข้อมูลตัวอย่างกรอกไว้แล้ว (แก้/ลบได้ที่เมนู ฉัน)
  if (needsOnboarding()) {
    await store.setPref('display_name', 'เมย์', false); await store.setPref('name_sample', true, false);
    await store.setPref('polite', 'ka', false); await store.setPref('cg_v2', true, false);
    await store.setPref('hub_onboarded', true);
    await addHubSamples();
  } else if (!store.state.prefs.cg_v2) await migrateToCaregiver(store);
  // รุ่น 2.2: ผู้ใช้เดิมที่ยังมีข้อมูลตัวอย่าง → เติมรีวิวตัวอย่างครั้งเดียว (ติดป้าย "ตัวอย่าง")
  if (!store.state.prefs.reviews_seeded) { if (store.state.family.some(m => m.sample)) await addSampleReviews(); await store.setPref('reviews_seeded', true, false); }
  addEventListener('offline', () => toast('ออฟไลน์อยู่ — ใช้การเตือนและข้อมูลในเครื่องได้ตามปกติ'));
  globalThis.__sabaii = store;
}
/** รุ่น 1.x ผู้ใช้คือผู้สูงอายุเอง → รุ่น 2 ผู้ใช้คือผู้ดูแล: ย้ายข้อมูลการแพทย์ของ "ฉัน" ไปเป็นผู้รับการดูแล 1 คน */
async function migrateToCaregiver(store) {
  const p = store.state.prefs, hasR = store.state.family.some(m => m.role === 'senior');
  const info = p.medinfo || {}, hasInfo = Object.values(info).some(v => String(v || '').trim());
  if (p.name_sample) { // ข้อมูลตัวอย่างชุดเก่า → ชุดผู้ดูแล
    await store.setPref('display_name', 'เมย์', false);
    for (const m of store.state.family.filter(m => m.sample)) await store.removeMember(m.id);
    for (const r of store.state.requests.filter(r => r.sample)) await store.removeRequest(r.id);
    await store.removeSamples();
    await addHubSamples();
  } else if (!hasR && (p.role === 'senior' || hasInfo)) {
    const m = await store.saveMember({ name: p.role === 'senior' && p.display_name ? p.display_name : 'ผู้สูงอายุที่ดูแล', relation: 'อื่น ๆ', role: 'senior', rights: 'ucs', mobility: 'walk', medinfo: info, perms: {} });
    await store.setPref('cur_person', m.id, false);
    if (p.role === 'senior') await store.setPref('display_name', '', false);
  }
  await store.setPref('cg_v2', true);
}
boot();

/* อัปเดตเอง: GitHub Pages ให้เบราว์เซอร์จำหน้าได้ ~10 นาที และแอปบนหน้าจอโฮมของ iPhone มักเปิดหน้าเดิมค้างไว้
   → ตอนเปิดแอปและทุกครั้งที่สลับกลับมา เช็ครหัสรุ่น (saduq-build) ในไฟล์บนเว็บแบบไม่ใช้ของที่จำไว้ ถ้าไม่ตรงก็โหลดหน้าใหม่ */
const BUILD = document.querySelector('meta[name="saduq-build"]')?.content;
let lastCheck = 0;
async function checkUpdate() {
  if (!BUILD || location.protocol === 'file:' || Date.now() - lastCheck < 60e3) return;
  lastCheck = Date.now();
  try {
    const html = await (await fetch(location.pathname + '?check=' + Date.now(), { cache: 'no-store' })).text();
    const live = html.match(/name="saduq-build" content="(\d+)"/)?.[1];
    if (live && live > BUILD && !document.querySelector('.modal.show, textarea:focus, input:focus')) location.replace(location.pathname + '?v=' + live + location.hash);
  } catch { /* ออฟไลน์ → ใช้รุ่นที่มีอยู่ */ }
}
addEventListener('load', () => setTimeout(checkUpdate, 1500));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
