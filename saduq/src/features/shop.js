// สินค้าและอุปกรณ์ (ข้อมูลจริง): รายการตามกลุ่ม · หน้ารายละเอียด · การ์ดสินค้า
// ไม่มีระบบสั่งซื้อในแอป — ลิงก์ออกไปร้านจริง + จดเป็นรายการซื้อ/แบ่งให้คนในทีมซื้อ
import { h, ic, put, toast } from '../ui/kit.js';
import { GROUPS, groupOf, PRODUCTS, productOf, productsIn, CHECKED } from '../domain/market.js';
import { svcOf } from '../domain/catalog.js';
import { photoById } from '../domain/photos.js';
import { app, today } from './shared.js';
import { P, pageHead, secHead } from './common.js';
import { familyAsk } from './care.js';

const priceText = p => p.price ? p.price.text : 'ดูราคาที่ร้าน';
/** ภาพจริงจาก Wikimedia Commons: เป็นภาพสินค้าประเภทเดียวกัน ไม่ใช่รุ่นนั้นเป๊ะ จึงติดป้าย "ภาพประกอบ" */
export const productPhoto = p => photoById(p.photo || p.id);

export function productCard(p) {
  return h('a.prodcard', { href: '#product/' + p.id },
    productPhoto(p)
      ? h('div.pd-art.photo', h('img', { src: productPhoto(p).src, alt: '', loading: 'lazy' }), h('span.pd-grp', groupOf(p.group).name), h('span.pd-ill', 'ภาพประกอบ'))
      : h('div.pd-art', h('span.pd-ic', { html: ic(groupOf(p.group).icon) }), h('span.pd-grp', groupOf(p.group).name)),
    h('div.pd-body',
      h('small.pd-brand', `${p.brand} · ${p.model}`), h('b', p.name),
      h('div.pd-foot', h('span.pd-price' + (p.price ? '' : '.none'), priceText(p)), p.price ? h('small', p.price.where) : '')));
}

const ps = { g: 'all' };
export function productsView(root, g) {
  if (g && (g === 'all' || groupOf(g))) ps.g = g;
  const list = ps.g === 'all' ? PRODUCTS : productsIn(ps.g);
  put(root, pageHead('สินค้าและอุปกรณ์', { sub: 'ของที่ขายจริงในไทย พร้อมราคาและร้าน' }),
    h('div.qchips.filt', { role: 'group', 'aria-label': 'กลุ่มสินค้า' },
      [['all', 'ทั้งหมด'], ...GROUPS.map(x => [x.id, x.name])].map(([k, v]) => h('button.qchip', { type: 'button', 'aria-pressed': String(ps.g === k), onclick: () => { ps.g = k; history.replaceState(null, '', '#shop/' + k); productsView(root); } }, v))),
    h('div.freebar',
      h('span', { html: ic('spark') }),
      h('p', h('b', 'ขอฟรีหรือยืมได้ก่อนซื้อ')),
      h('div.fb-links', h('a.chipbtn', { href: '#svc/b-diaper' }, 'ผ้าอ้อมฟรี'), h('a.chipbtn', { href: '#svc/l-loan' }, 'ยืมอุปกรณ์'))),
    h('div.prodgrid', list.map(productCard)),
    h('p.srcnote', `ราคาเปลี่ยนได้ · ตรวจ ${CHECKED} · ไม่รับค่าตอบแทนจากร้าน`));
}

export function productView(root, id) {
  const p = productOf(id);
  if (!p) return productsView(root);
  const free = p.free && svcOf(p.free);
  const ph = productPhoto(p);
  put(root, pageHead(p.name, { back: 'shop/' + p.group, sub: `${p.brand} · ${p.model}` }),
    ph ? h('figure.svcphoto.prod', h('img', { src: ph.src, alt: '', loading: 'lazy' }), h('figcaption', `ภาพประกอบ ไม่ใช่รุ่นนี้ · ${ph.artist || 'Wikimedia Commons'} · ${ph.license}`)) : '',
    h('section.pricebox',
      h('div', h('small', p.price ? `ราคาที่พบ · ${p.price.where}` : 'ราคา'), h('b', priceText(p)), p.price?.note ? h('p', p.price.note) : h('p', 'ยังไม่มีราคาที่ยืนยันได้ — เปิดลิงก์ร้านด้านล่างเพื่อดูราคาปัจจุบัน')),
      h('div.buylinks', p.buy.map((b, i) => h('a.btn' + (i === 0 ? '.primary' : '.ghost'), { href: b.url, target: '_blank', rel: 'noopener', html: `<span>${b.label}</span>` + ic('ext') })))),
    free ? h('a.freecard', { href: '#svc/' + free.id }, h('span', { html: ic('spark') }), h('div', h('b', 'อาจได้ฟรี / ยืมได้'), h('small', free.name)), h('span.sr-go', { html: ic('right') })) : '',
    h('section.dsec', h('h2', 'ผู้ดูแลใช้ทำอะไร'), h('p', p.why)),
    p.specs?.length ? h('section.dsec', h('h2', 'ข้อมูลสินค้า'), h('ul.ticks', p.specs.map(x => h('li', h('span', { html: ic('check') }), x)))) : '',
    p.tips?.length ? h('section.dsec', h('h2', 'เคล็ดลับจากการดูแล'), h('ul.ticks.tip', p.tips.map(x => h('li', h('span', { html: ic('info') }), x)))) : '',
    h('section.dsec', h('h2', 'แหล่งที่มาของข้อมูล'), sources(p.src), h('p.srcnote', `ตรวจข้อมูล ${CHECKED} · ราคาและสต็อกเปลี่ยนได้ ตรวจกับร้านก่อนซื้อ`)),
    h('div.stickycta.two',
      h('button.btn.ghost', { onclick: () => addToList(p) }, 'จดไว้ซื้อ'),
      h('button.btn.primary', { onclick: () => familyAsk({ what: `ช่วยซื้อ ${p.brand} ${p.model} (${p.name})` }) }, 'ให้คนในทีมช่วยซื้อ')));
}
export function sources(src = []) {
  if (!src.length) return h('p.muted', 'ข้อมูลทั่วไป ไม่ได้อ้างอิงร้านใดร้านหนึ่ง');
  return h('ul.srclist', src.map(s => h('li', h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.label, h('span', { html: ic('ext') })))));
}
async function addToList(p) {
  await app.store.addTasks([{ title: `ซื้อ ${p.brand} ${p.model} ${p.name}`, type: 'errand', due_date: today(), subject_name: 'ธุระและเอกสาร', source: 'shop' }]);
  toast(`เพิ่มในรายการซื้อของแล้ว${P()}`);
}

/** แถวสินค้าแนะนำบนหน้าหลัก */
export function featuredProducts() {
  const ids = ['p-diaper-feelfree', 'p-bp-omron', 'p-walker-yamada', 'p-mattress-air', 'p-oxi-yuwell'];
  return h('section', secHead('สินค้าที่ผู้ดูแลใช้บ่อย', ['ดูทั้งหมด', 'shop']), h('div.recrow', ids.map(productOf).filter(Boolean).map(productCard)));
}
