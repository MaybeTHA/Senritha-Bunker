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

globalThis.SABAII_VERSION = '1.3.0';
const VIEWS = {
  home: ['หน้าหลัก', homeView], services: ['บริการ', servicesView], cat: ['บริการ', categoryView], svc: ['บริการ', serviceView],
  activity: ['กิจกรรม', activityView], req: ['คำขอบริการ', requestView], notif: ['การแจ้งเตือน', notifView], subject: ['หมวดการเตือน', subjectView],
  family: ['ครอบครัว', familyView], emergency: ['ฉุกเฉิน', emergencyView], me: ['ฉัน', profileView],
};
const ALIAS = { tasks: 'activity' }; // ลิงก์รุ่นนักเรียนเดิม
const NAV_OF = { services: 'home', cat: 'home', svc: 'home', emergency: 'home', req: 'activity', notif: 'activity', subject: 'activity', family: 'me' };
const NAV = [['home', 'home', 'หน้าหลัก'], ['activity', 'activity', 'กิจกรรม'], ['me', 'me', 'ฉัน']];

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
    sos.hidden = r.name === 'emergency' || r.name === 'home';
    if (key !== last) { const h1 = wrap.querySelector('h1'); if (last && h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); } }
    last = key;
  }
  app.refresh = () => { applyScale(); if (!document.activeElement?.matches?.('#hub-q')) render(); else homeRefreshKeepFocus(); };
  const homeRefreshKeepFocus = () => { const r = route(); if (r.name === 'home') homeView(wrap, true); else render(); };
  store.subscribe(() => { gcUrls(); app.refresh(); });
  addEventListener('hashchange', render);
  render();
  // เปิดแอปครั้งแรก: เข้าหน้าหลักทันที พร้อมข้อมูลตัวอย่างกรอกไว้แล้ว (แก้/ลบได้ที่เมนู ฉัน)
  if (needsOnboarding()) {
    await store.setPref('display_name', 'สมศรี', false); await store.setPref('name_sample', true, false);
    await store.setPref('role', 'senior', false); await store.setPref('polite', 'ka', false);
    await store.setPref('medinfo', { blood: 'O (ตัวอย่าง)', conditions: 'ความดันสูง เบาหวาน (ตัวอย่าง)', allergies: 'ไม่มี (ตัวอย่าง)', meds: 'ยาความดัน เช้า 1 เม็ด (ตัวอย่าง)', hospital: '', address: '' }, false);
    await store.setPref('hub_onboarded', true);
    await addHubSamples();
  }
  addEventListener('offline', () => toast('ออฟไลน์อยู่ — ใช้การเตือนและข้อมูลในเครื่องได้ตามปกติ'));
  globalThis.__sabaii = store;
}
boot();
