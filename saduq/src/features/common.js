// ชิ้นส่วนที่ทุกหน้าของศูนย์รวมบริการใช้ร่วมกัน: น้ำเสียง (ครับ/ค่ะ) · คนในครอบครัว · การ์ดบริการ · ป้ายสถานะ · เบอร์โทร
import { h, ic, toast } from '../ui/kit.js';
import { catOf, REQ_LABEL } from '../domain/catalog.js';
import { photoOf } from '../domain/photos.js';
import { app, S } from './shared.js';
import { fromYMD, DOW_SHORT, MONTH_SHORT } from '../domain/dates.js';

/* ---------- น้ำเสียง ---------- */
export const tone = () => S().prefs.polite || 'none';
export const P = () => ({ krub: 'ครับ', ka: 'ค่ะ' })[tone()] || '';
export const PQ = () => ({ krub: 'ครับ', ka: 'คะ' })[tone()] || '';
export const role = () => S().prefs.role === 'family' ? 'family' : 'senior';
export const myName = () => S().prefs.display_name || '';
export function greeting() {
  const hr = new Date().getHours(), n = myName();
  const when = hr < 11 ? 'อรุณสวัสดิ์' : 'สวัสดี';
  return `${when}${P()}${n ? ' คุณ' + n : ''}`;
}

/* ---------- คนในครอบครัว ('me' = เจ้าของเครื่อง) ---------- */
export const members = () => [...S().family].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
export const member = id => S().family.find(m => m.id === id);
export function whoName(id) {
  if (!id || id === 'me') return myName() ? `${myName()} (ฉัน)` : 'ฉัน';
  return member(id)?.name || 'สมาชิกที่ถูกลบ';
}
/** คนที่รับบริการได้: ตัวฉัน + สมาชิกที่เป็นผู้สูงอายุ */
export const careTargets = () => [{ id: 'me', name: whoName('me') }, ...members().filter(m => m.role === 'senior').map(m => ({ id: m.id, name: m.name }))];
export const initial = s => (String(s || '?').trim()[0] || '?');
const AV = ['#0A6CF1', '#16A06A', '#E07A2E', '#7C4DFF', '#D9468F', '#0E8FA3'];
export const avatarColor = id => AV[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
export const avatar = (id, name, cls = '') => h('span.avatar.av' + (id === 'me' ? '.grad' : '') + cls, { style: id === 'me' ? null : { background: avatarColor(id) }, 'aria-hidden': 'true' }, initial(name));

/* ---------- เวลา ---------- */
export const thaiDay = ymd => { if (!ymd) return ''; const d = fromYMD(ymd); return `${DOW_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`; };
export function ago(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'เมื่อสักครู่';
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชั่วโมงที่แล้ว`;
  const d = new Date(iso); return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

/* ---------- ป้าย ---------- */
export const demoTag = (txt = 'ตัวอย่าง') => h('span.dtag', txt);
export const statusPill = st => h('span.spill.st-' + st, REQ_LABEL[st] || st);
export const go = hash => { location.hash = '#' + hash; };
/** ปิดกล่องแล้วค่อยเปลี่ยนหน้า — ปิดกล่องจะถอยประวัติ 1 ก้าว (ทำงานทีหลัง) ต้องรอให้เสร็จก่อน ไม่งั้นหน้าจะเด้งกลับ */
export function goAfterModal(hash) {
  let done = false; const f = () => { if (!done) { done = true; go(hash); } };
  addEventListener('popstate', () => setTimeout(f, 0), { once: true }); setTimeout(f, 450);
}

/* ---------- หัวหน้าเพจ: ปุ่มย้อนกลับมีคำกำกับเสมอ ---------- */
export function pageHead(title, { back, sub, right } = {}) {
  return h('header.hhead',
    back ? h('button.backbtn', { onclick: () => (history.length > 1 && back === 'auto' ? history.back() : go(back === 'auto' ? 'home' : back)), html: ic('back') + '<span>ย้อนกลับ</span>' }) : '',
    h('div.hh-row', h('div.hh-t', h('h1', title), sub ? h('p.hsub', sub) : ''), right || ''));
}
export const secHead = (title, more) => h('div.hsec', h('h2', title), more ? h('a.more', { href: '#' + more[1] }, more[0], h('span', { html: ic('right') })) : '');

/* ---------- การ์ดหมวด / บริการ ---------- */
export function catCard(c, big = false) {
  return h('a.catcard' + (big ? '.big' : '') + (c.id === 'emergency' ? '.sos' : ''), { href: c.id === 'emergency' ? '#emergency' : '#cat/' + c.id, style: { '--ct': c.tint, '--ci': c.ink } },
    h('span.cc-ic', { html: ic(c.icon) }), h('b', c.name), h('small', c.sub));
}
export function svcRow(s) {
  const c = catOf(s.cat);
  return h('a.svcrow', { href: '#svc/' + s.id, style: { '--ct': c.tint, '--ci': c.ink } },
    photoOf(s) ? h('span.sr-ic.ph', { style: { backgroundImage: `url("${photoOf(s).src}")` }, 'aria-hidden': 'true' }) : h('span.sr-ic', { html: ic(s.icon) }),
    h('span.sr-tx', h('b', s.name), h('small', s.short)),
    s.provider?.phone ? h('span.sr-num', s.provider.phone) : h('span.sr-go', { html: ic('right') }));
}
/** การ์ดแนะนำ (เลื่อนข้าง): ภาพ · ชื่อ · คำอธิบาย · ผู้ให้บริการ · ราคา · รีวิว · ปุ่มดูรายละเอียด — ไม่มีข้อมูลก็บอกว่าไม่มี */
export function recCard(s) {
  const c = catOf(s.cat), mine = myReviews(s.id);
  return h('article.reccard', { style: { '--ct': c.tint, '--ci': c.ink } },
    h('div.rc-art' + (photoOf(s) ? '.photo' : ''), { style: photoOf(s) ? { backgroundImage: `url("${photoOf(s).src}")` } : null }, h('span.rc-ic', { html: ic(s.icon) }), h('span.rc-cat', c.short)),
    h('div.rc-body',
      h('b', s.name), h('p', s.short),
      h('dl.rc-meta',
        h('div', h('dt', 'ผู้ให้บริการ'), h('dd', s.provider?.name || (s.ready ? 'Saduq (ในเครื่องนี้)' : 'ยังไม่มีในระบบ'))),
        h('div', h('dt', 'ราคา'), h('dd', s.price || (s.ready ? 'ไม่มีค่าใช้จ่าย' : 'ยังไม่มีข้อมูล'))),
        h('div', h('dt', 'รีวิว'), h('dd', mine.length ? `${avgStars(mine).toFixed(1)} ★ (${mine.length} ของคุณ)` : 'ยังไม่มีรีวิว'))),
      h('a.btn.primary.sm', { href: '#svc/' + s.id }, 'ดูรายละเอียด')));
}
export const myReviews = sid => S().requests.filter(r => r.service_id === sid && r.review);
export const avgStars = rs => rs.reduce((a, r) => a + r.review.stars, 0) / rs.length;

/* ---------- เบอร์โทร: ลิงก์ tel อาจไม่ทำงานในบางหน้าต่าง → โชว์ตัวเลขใหญ่ + ปุ่มคัดลอกเสมอ ---------- */
export function callBox(num, label, { danger = false } = {}) {
  return h('div.callbox' + (danger ? '.danger' : ''),
    h('div.cb-num', h('small', label), h('b', num)),
    h('div.cb-act',
      h('a.btn.' + (danger ? 'sos' : 'primary'), { href: 'tel:' + num.replace(/[^\d+]/g, ''), html: ic('phone') + `<span>โทร ${num}</span>` }),
      h('button.btn.ghost', { type: 'button', onclick: () => copy(num), html: ic('copy') + '<span>คัดลอก</span>' })));
}
export async function copy(txt) {
  try { await navigator.clipboard.writeText(txt); toast(`คัดลอก ${txt} แล้ว`); }
  catch { toast(`เบอร์ ${txt} — กดค้างที่ตัวเลขเพื่อคัดลอก`); }
}
export const mapsUrl = q => 'https://www.google.com/maps/search/' + encodeURIComponent(q + ' ใกล้ฉัน');

/** บันทึกเหตุการณ์ลงหน้าอัปเดต */
export const log = (title, body = '', extra = {}) => app.store.notify({ title, body, by: 'me', ...extra });
