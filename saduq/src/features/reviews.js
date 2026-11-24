// รีวิวสินค้าและบริการ (ของผู้ใช้เอง · เก็บในเครื่องนี้) → AI ใช้ช่วยจัดอันดับ
// ยังไม่มีรีวิวจากผู้ใช้คนอื่น: แอปยังไม่มีบัญชี/ซิงก์ข้ามเครื่อง จึงไม่แสดงคะแนนที่ไม่ได้มาจากผู้ใช้จริง
import { h, put, toast } from '../ui/kit.js';
import { app, S } from './shared.js';
import { P } from './common.js';

const KEY = 'reviews'; // prefs: { [id สินค้า/บริการ]: { stars, text, at } }
const all = () => S().prefs[KEY] || {};

/** คะแนนรวมของสินค้า/บริการหนึ่งรายการ: รีวิวที่ให้ตรง ๆ + รีวิวจากเรื่องที่ติดตามจนเสร็จ */
export function ratingOf(id) {
  const list = [all()[id], ...S().requests.filter(r => r.service_id === id && r.review).map(r => r.review)].filter(Boolean);
  if (!list.length) return null;
  return { avg: Math.round(list.reduce((a, r) => a + r.stars, 0) / list.length * 10) / 10, n: list.length };
}
/** คะแนนทุกรายการ ส่งให้ AI จัดอันดับ */
export function allRatings() {
  const ids = new Set([...Object.keys(all()), ...S().requests.filter(r => r.review).map(r => r.service_id)]);
  return Object.fromEntries([...ids].map(id => [id, ratingOf(id)]).filter(([, r]) => r));
}
export const starText = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

/** ส่วนรีวิวในหน้ารายละเอียด: ยังไม่รีวิว = เลือกดาว + ข้อความ · รีวิวแล้ว = แสดง + แก้ได้ */
export function reviewSection(id, what = 'สินค้านี้') {
  const box = h('section.dsec.revbox');
  const mine = all()[id];
  const show = () => put(box, h('h2', 'รีวิวของคุณ'),
    h('div.myrev', h('p.stars', starText(mine.stars), h('span', ` ${mine.stars}/5`)), mine.text ? h('p', mine.text) : '',
      h('button.chipbtn', { type: 'button', onclick: () => edit(mine.stars, mine.text) }, 'แก้รีวิว')),
    h('p.muted.revnote', 'AI ใช้รีวิวนี้ช่วยจัดอันดับตอนคุณถามครั้งต่อไป'));
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
