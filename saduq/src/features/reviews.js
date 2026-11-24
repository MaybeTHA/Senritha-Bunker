// รีวิวสินค้าและบริการ (ของผู้ใช้เอง · เก็บในเครื่องนี้) → AI ใช้ช่วยจัดอันดับ
// ยังไม่มีรีวิวจากผู้ใช้คนอื่น: แอปยังไม่มีบัญชี/ซิงก์ข้ามเครื่อง จึงไม่แสดงคะแนนที่ไม่ได้มาจากผู้ใช้
// รีวิวตัวอย่าง (sample: true) ติดป้าย "ตัวอย่าง" เหมือนข้อมูลตัวอย่างอื่น · ลบได้ที่ ฉัน → ข้อมูลตัวอย่าง · แก้แล้วกลายเป็นรีวิวของผู้ใช้
import { h, put, toast } from '../ui/kit.js';
import { app, S } from './shared.js';
import { P, demoTag } from './common.js';

const KEY = 'reviews'; // prefs: { [id สินค้า/บริการ]: { stars, text, at, sample? } }
const all = () => S().prefs[KEY] || {};

const SAMPLES = {
  'p-bp-omron': [5, 'วัดให้แม่ทุกเช้า กดปุ่มเดียว ตัวเลขใหญ่อ่านง่าย'],
  'p-diaper-feelfree': [4, 'ซึมซับดีตอนกลางคืน ไซส์ L หลวมนิดหน่อยสำหรับแม่'],
  'p-walker-yamada': [4, 'พับเก็บง่าย แม่ใช้เดินในบ้าน มีที่นั่งพักด้วย'],
  'p-oxi-yuwell': [3, 'ใช้ได้ แต่ถ้ามือเย็นต้องรอนานกว่าค่าจะขึ้น'],
  'l-loan': [5, 'นักสังคมสงเคราะห์โทรกลับใน 3 วัน ได้วีลแชร์ฟรี'],
  'h-telemed': [4, 'คุยกับหมอทางวิดีโอ ยาส่งถึงบ้านวันรุ่งขึ้น'],
};
export async function addSampleReviews() {
  const cur = all(), at = new Date().toISOString(), add = {};
  for (const [id, [stars, text]] of Object.entries(SAMPLES)) if (!cur[id]) add[id] = { stars, text, at, sample: true };
  await app.store.setPref(KEY, { ...cur, ...add });
}
export async function removeSampleReviews() {
  await app.store.setPref(KEY, Object.fromEntries(Object.entries(all()).filter(([, r]) => !r.sample)));
}
export const hasSampleReviews = () => Object.values(all()).some(r => r.sample);

/** คะแนนรวมของสินค้า/บริการหนึ่งรายการ: รีวิวที่ให้ตรง ๆ + รีวิวจากเรื่องที่ติดตามจนเสร็จ */
export function ratingOf(id) {
  const own = all()[id], list = [own, ...S().requests.filter(r => r.service_id === id && r.review).map(r => r.review)].filter(Boolean);
  if (!list.length) return null;
  return { avg: Math.round(list.reduce((a, r) => a + r.stars, 0) / list.length * 10) / 10, n: list.length, sample: list.every(r => r === own && own.sample) };
}
/** คะแนนทุกรายการ ส่งให้ AI จัดอันดับ */
export function allRatings() {
  const ids = new Set([...Object.keys(all()), ...S().requests.filter(r => r.review).map(r => r.service_id)]);
  return Object.fromEntries([...ids].map(id => [id, ratingOf(id)]).filter(([, r]) => r));
}
export const starText = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

/** แถวดาวบนการ์ด: มีรีวิว = ดาว + คะแนน · ยังไม่มี = บอกตรง ๆ */
export function ratingLine(id) {
  const r = ratingOf(id);
  return r ? h('small.pd-rev', h('span.st', starText(r.avg)), ` ${r.avg}`, r.sample ? demoTag() : ' รีวิวของคุณ')
    : h('small.pd-rev.none', '☆ ยังไม่มีรีวิว');
}
/** ปุ่มสรุปรีวิวด้านบนหน้ารายละเอียด → เลื่อนลงไปที่ส่วนรีวิว */
export function ratingBar(id, what = 'สินค้านี้') {
  const r = ratingOf(id), go = () => document.querySelector('.revbox')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return h('button.ratebar', { type: 'button', onclick: go },
    r ? [h('span.st', starText(r.avg)), h('b', String(r.avg)), h('span', r.sample ? 'รีวิวตัวอย่าง' : 'รีวิวของคุณ'), r.sample ? demoTag() : '']
      : [h('span.st.none', '☆☆☆☆☆'), h('span', `ยังไม่มีรีวิว · ให้คะแนน${what}`)],
    h('em', r ? 'ดูรีวิว' : 'รีวิว'));
}

/** ส่วนรีวิวในหน้ารายละเอียด: ยังไม่รีวิว = เลือกดาว + ข้อความ · รีวิวแล้ว = แสดง + แก้ได้ */
export function reviewSection(id, what = 'สินค้านี้') {
  const box = h('section.dsec.revbox', { id: 'review' });
  const mine = all()[id];
  const show = () => put(box, h('h2', 'รีวิวของคุณ', mine.sample ? demoTag() : ''),
    h('div.myrev', h('p.stars', starText(mine.stars), h('span', ` ${mine.stars}/5`)), mine.text ? h('p', mine.text) : '',
      h('button.chipbtn', { type: 'button', onclick: () => edit(mine.stars, mine.text) }, mine.sample ? 'รีวิวเอง' : 'แก้รีวิว')),
    h('p.muted.revnote', mine.sample ? 'รีวิวตัวอย่าง ลบได้ที่ ฉัน → ข้อมูลตัวอย่าง · AI ใช้รีวิวช่วยจัดอันดับ' : 'AI ใช้รีวิวนี้ช่วยจัดอันดับตอนคุณถามครั้งต่อไป'));
  const edit = (stars = 0, text = '') => {
    const row = h('div.starpick', { role: 'radiogroup', 'aria-label': 'ให้คะแนน' });
    const paint = () => put(row, [1, 2, 3, 4, 5].map(n => h('button', { type: 'button', role: 'radio', 'aria-checked': String(n === stars), 'aria-label': `${n} ดาว`, class: n <= stars ? 'on' : '', onclick: () => { stars = n; paint(); } }, '★')));
    paint();
    put(box, h('h2', `ใช้${what}แล้วเป็นอย่างไร`), h('p.muted.revnote', 'เก็บในเครื่องนี้ · AI จะดันตัวที่คุณให้ดาวสูงขึ้น และลดตัวที่ให้ดาวต่ำ'), row,
      h('textarea.field', { rows: 2, maxlength: 300, placeholder: 'เล่าสั้น ๆ (ไม่บังคับ)', 'aria-label': 'ข้อความรีวิว', oninput: e => { text = e.target.value; } }, text),
      h('button.btn.primary.full', { onclick: async () => {
        if (!stars) return toast('แตะดาวเพื่อให้คะแนนก่อน');
        await app.store.setPref(KEY, { ...all(), [id]: { stars, text: text.trim(), at: new Date().toISOString() } });
        toast(`บันทึกรีวิวแล้ว${P()}`);
      } }, 'บันทึกรีวิว'));
  };
  mine ? show() : edit();
  return box;
}
