// ตลาดบริการ: เลือกเจ้า (เรียง/กรองจังหวัด) · หน้าร้าน (แพ็กเกจ · รีวิว) · เปรียบเทียบสูงสุด 3 เจ้า · สั่ง/จอง → ติดตามสถานะ
import { h, ic, put, toast, openModal } from '../ui/kit.js';
import { svcOf, catOf, SLOTS } from '../domain/catalog.js';
import { providersOf, providerOf, packagesOf, reviewsOf, breakdown, kindOf, baht, MARKET } from '../domain/providers.js';
import { photoOf } from '../domain/photos.js';
import { app, S } from './shared.js';
import { dayChips } from './add.js';
import { P, careTargets, pageHead, avatarColor, goAfterModal } from './common.js';

const ms = { sort: 'rec', prov: '', cmp: [] };
const SORTS = { rec: 'แนะนำ', rating: 'คะแนนสูงสุด', price: 'ราคาต่ำสุด', reviews: 'รีวิวมากสุด' };
const score = p => p.rating * Math.log10(p.reviews + 10);
const sorted = list => [...list].sort({ rec: (a, b) => score(b) - score(a), rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
  price: (a, b) => a.price - b.price, reviews: (a, b) => b.reviews - a.reviews }[ms.sort]);

export const stars = (r, cls = '') => h('span.stars5' + cls, { role: 'img', 'aria-label': `คะแนน ${r.toFixed(1)} จาก 5` },
  h('i', { style: { '--p': `${(r / 5) * 100}%` }, 'aria-hidden': 'true' }, '★★★★★'));
const pAvatar = (p, big = false) => h('span.pav' + (big ? '.big' : ''), { style: { background: avatarColor(p.id) }, 'aria-hidden': 'true' }, p.name.replace(/^(ร้าน|ศูนย์|คลินิก)/, '').trim()[0]);
const inCmp = id => ms.cmp.includes(id);
function toggleCmp(id, rerender) {
  if (inCmp(id)) ms.cmp = ms.cmp.filter(x => x !== id);
  else if (ms.cmp.length >= 3) return toast('เปรียบเทียบได้ครั้งละ 3 เจ้า เอาออกก่อน 1 เจ้า');
  else ms.cmp = [...ms.cmp, id];
  rerender();
}
const cmpBar = () => ms.cmp.length ? h('div.cmpbar', { role: 'region', 'aria-label': 'เปรียบเทียบ' },
  h('div.cb-av', ms.cmp.map(id => pAvatar(providerOf(id)))), h('span', `เลือกไว้ ${ms.cmp.length}/3 เจ้า`),
  h('button.linkbtn2', { onclick: () => { ms.cmp = []; app.refresh(); } }, 'ล้าง'),
  h('a.btn.primary.sm', { href: '#compare', 'aria-disabled': String(ms.cmp.length < 2) }, ms.cmp.length < 2 ? 'เลือกอีก 1 เจ้า' : 'เปรียบเทียบ')) : '';

/** การ์ดเจ้า: รูป · ชื่อ · คะแนน · รีวิว · พื้นที่ · จุดเด่น · ราคาเริ่มต้น · เวลา · ปุ่มดูร้าน/เทียบ */
export function provCard(p, rerender) {
  const s = svcOf(p.sid);
  return h('article.pcard',
    h('a.pc-img', { href: '#prov/' + p.id, style: { backgroundImage: photoOf(s) ? `url("${photoOf(s).src}")` : null }, 'aria-label': `ดูร้าน ${p.name}` }, h('span.pc-eta', p.eta)),
    h('div.pc-body',
      h('div.pc-top', pAvatar(p), h('div', h('a.pc-name', { href: '#prov/' + p.id }, p.name), h('small', p.area))),
      h('div.pc-rate', stars(p.rating), h('b', p.rating.toFixed(1)), h('small', `(${p.reviews.toLocaleString('th-TH')} รีวิว)`)),
      h('div.pc-tags', p.badges.slice(0, 3).map(b => h('span', b))),
      h('div.pc-foot', h('div.pc-price', h('small', 'เริ่มต้น'), h('b', baht(p.price)), h('small', p.unit)),
        h('label.cmpchk', h('input', { type: 'checkbox', checked: inCmp(p.id), onchange: () => toggleCmp(p.id, rerender) }), h('span', 'เทียบ')))),
    h('a.btn.primary.sm.pc-go', { href: '#prov/' + p.id }, 'ดูร้านและแพ็กเกจ'));
}

/* ================= เลือกเจ้า (หน้าบริการที่มีตลาด) ================= */
export function marketView(root, s) {
  const c = catOf(s.cat), all = providersOf(s.id);
  const provs = [...new Set(all.map(p => p.province))];
  if (ms.prov && !provs.includes(ms.prov)) ms.prov = '';
  const list = sorted(all.filter(p => !ms.prov || p.province === ms.prov));
  const re = () => marketView(root, s);
  put(root, pageHead(s.name, { back: 'cat/' + s.cat, sub: `${all.length} เจ้าให้เลือก · ${s.short}` }),
    photoOf(s) ? h('div.mkhero', { style: { backgroundImage: `url("${photoOf(s).src}")`, '--ci': c.ink } },
      h('div', h('a.chipcat', { href: '#cat/' + c.id }, c.short), h('p', s.desc))) : '',
    h('div.mktools',
      h('div.qchips.filt', { role: 'group', 'aria-label': 'เรียงตาม' }, Object.entries(SORTS).map(([k, v]) =>
        h('button.qchip', { type: 'button', 'aria-pressed': String(ms.sort === k), onclick: () => { ms.sort = k; re(); } }, v))),
      provs.length > 1 ? h('label.selwrap', h('span', { html: ic('map') }), h('select', { 'aria-label': 'จังหวัด', onchange: e => { ms.prov = e.target.value; re(); } },
        h('option', { value: '' }, 'ทุกจังหวัด'), provs.map(v => h('option', { value: v, selected: v === ms.prov }, v)))) : ''),
    h('p.mkcount', `${list.length} เจ้า · แตะ "เทียบ" เพื่อเปรียบเทียบได้สูงสุด 3 เจ้า`),
    h('div.pgrid', list.map(p => provCard(p, re))),
    cmpBar());
}

/* ================= หน้าร้าน ================= */
let pickPk = 0;
export function providerView(root, id) {
  const p = providerOf(id);
  if (!p) { put(root, pageHead('ไม่พบร้านนี้', { back: 'home' })); return; }
  const s = svcOf(p.sid), pks = packagesOf(p), bd = breakdown(p), maxBd = Math.max(...bd, 1), k = kindOf(p);
  if (!pks[pickPk]) pickPk = 0;
  const re = () => providerView(root, id);
  const others = providersOf(p.sid).filter(x => x.id !== p.id);
  put(root, pageHead(p.name, { back: 'svc/' + p.sid, sub: s.name }),
    h('section.phead2',
      h('div.ph-img', { style: { backgroundImage: photoOf(s) ? `url("${photoOf(s).src}")` : null } }),
      h('div.ph-info', pAvatar(p, true),
        h('div', h('h2', p.name), h('p.ph-area', h('span', { html: ic('map') }), p.area),
          h('div.pc-rate', stars(p.rating), h('b', p.rating.toFixed(1)), h('small', `${p.reviews.toLocaleString('th-TH')} รีวิว · ใช้บริการแล้ว ${p.done.toLocaleString('th-TH')} ครั้ง`))),
        h('label.cmpchk.big', h('input', { type: 'checkbox', checked: inCmp(p.id), onchange: () => toggleCmp(p.id, re) }), h('span', 'เพิ่มในการเปรียบเทียบ'))),
      h('ul.pfacts', [[ 'clock', p.eta], ['phone', p.reply], ['shield', `เปิดมา ${p.years} ปี`]].map(([i, t]) => h('li', h('span', { html: ic(i) }), t))),
      h('p.ph-about', p.about), h('div.pc-tags', p.badges.map(b => h('span', b)))),
    h('section.dsec', h('h2', 'เลือกแพ็กเกจ'),
      h('div.pkgs', { role: 'radiogroup', 'aria-label': 'แพ็กเกจ' }, pks.map((x, i) => h('button.pkg', { type: 'button', role: 'radio', 'aria-checked': String(i === pickPk), onclick: () => { pickPk = i; re(); } },
        h('small', ['เริ่มต้น', 'แนะนำ', 'คุ้มที่สุด'][i]), h('b', x.name), h('span.pk-price', baht(x.price)), h('p', x.desc))))),
    h('section.dsec', h('h2', 'รีวิวจากผู้ใช้บริการ'),
      h('div.revsum', h('div.rs-big', h('b', p.rating.toFixed(1)), stars(p.rating), h('small', `${p.reviews.toLocaleString('th-TH')} รีวิว`)),
        h('div.rs-bars', bd.map((n, i) => h('div', h('span', `${5 - i} ★`), h('i', h('em', { style: { width: `${(n / maxBd) * 100}%` } })), h('small', n.toLocaleString('th-TH')))))),
      h('ul.revlist', reviewsOf(p).map(r => h('li', h('div.rv-top', h('b', r.name), h('small', `${r.who} · ${r.ago}`)), h('span.rv-st', '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars)), h('p', r.text))))),
    others.length ? h('section.dsec', h('h2', 'เจ้าอื่นในบริการนี้'), h('div.pgrid.mini', others.map(x => provCard(x, re)))) : '',
    h('div.stickycta.order', h('div.so-sum', h('small', pks[pickPk].name), h('b', baht(pks[pickPk].price))),
      h('button.btn.primary', { onclick: () => orderForm(p, pks[pickPk]) }, k.book)),
    cmpBar());
}

/* ================= เปรียบเทียบ ================= */
export function compareView(root) {
  const ps = ms.cmp.map(providerOf).filter(Boolean);
  if (ps.length < 2) {
    put(root, pageHead('เปรียบเทียบ', { back: 'auto' }), h('div.emptybox', h('b', 'เลือกอย่างน้อย 2 เจ้า'), h('p', 'ไปที่บริการที่ต้องการ แล้วแตะ "เทียบ" บนการ์ดร้าน'), h('a.btn.primary.sm', { href: ps[0] ? '#svc/' + ps[0].sid : '#services' }, 'เลือกร้าน')));
    return;
  }
  const best = (f, low) => { const v = ps.map(f); const b = low ? Math.min(...v) : Math.max(...v); return p => f(p) === b; };
  const bRate = best(p => p.rating), bPrice = best(p => p.price, true), bRev = best(p => p.reviews);
  const row = (label, cell, isBest) => h('tr', h('th', { scope: 'row' }, label), ps.map(p => h('td' + (isBest?.(p) ? '.best' : ''), cell(p))));
  put(root, pageHead('เปรียบเทียบ', { back: 'auto', sub: `${ps.length} เจ้า · ช่องสีเขียว = ดีที่สุดในข้อนั้น` }),
    h('div.cmpwrap', h('table.cmptable',
      h('thead', h('tr', h('th', ''), ps.map(p => h('th', { scope: 'col' }, pAvatar(p), h('a', { href: '#prov/' + p.id }, p.name), h('button.rmv', { 'aria-label': `เอา ${p.name} ออก`, onclick: () => toggleCmp(p.id, () => compareView(root)) }, 'เอาออก'))))),
      h('tbody',
        row('คะแนน', p => [stars(p.rating), ` ${p.rating.toFixed(1)}`], bRate),
        row('จำนวนรีวิว', p => p.reviews.toLocaleString('th-TH'), bRev),
        row('ราคาเริ่มต้น', p => [h('b', baht(p.price)), h('small', ' ' + p.unit)], bPrice),
        row('พื้นที่', p => p.area),
        row('ระยะเวลา', p => p.eta),
        row('ตอบกลับ', p => p.reply),
        row('ประสบการณ์', p => `${p.years} ปี · ${p.done.toLocaleString('th-TH')} ครั้ง`),
        row('จุดเด่น', p => h('div.pc-tags', p.badges.map(b => h('span', b)))),
        row('แพ็กเกจ', p => h('ul.cmppk', packagesOf(p).map(x => h('li', `${x.name} `, h('b', baht(x.price)))))),
        h('tr', h('th', ''), ps.map(p => h('td', h('a.btn.primary.sm', { href: '#prov/' + p.id }, 'เลือกเจ้านี้'))))))));
}

/* ================= สั่ง/จอง ================= */
export function orderForm(p, pk) {
  const s = svcOf(p.sid), k = kindOf(p), targets = careTargets();
  const f = { for_id: targets[0].id, date: null, slot: 'morning', note: '', addr: S().prefs.my_addr || '' };
  const body = h('div.rform');
  const note = h('textarea.field', { id: 'od-note', rows: 2, maxlength: 300, placeholder: p.kind === 'food' ? 'เช่น ไม่ใส่ผักชี เคี้ยวยาก ขอหั่นชิ้นเล็ก' : 'สิ่งที่ผู้ให้บริการควรรู้ เช่น โรคประจำตัว ใช้รถเข็น', oninput: e => { f.note = e.target.value; } });
  const addr = h('input.field', { id: 'od-addr', maxlength: 160, value: f.addr, placeholder: 'บ้านเลขที่ ถนน เขต จังหวัด', oninput: e => { f.addr = e.target.value; } });
  const paint = () => put(body,
    h('div.osum', h('div', h('b', p.name), h('small', `${pk.name} · ${p.eta}`)), h('b.os-price', baht(pk.price))),
    h('label.flabel', `${k.book}ให้ใคร`), h('div.qchips', targets.map(x => h('button.qchip', { type: 'button', 'aria-pressed': String(x.id === f.for_id), onclick: () => { f.for_id = x.id; paint(); } }, x.name))),
    p.kind === 'food' || p.kind === 'goods' ? '' : [h('label.flabel', 'วันที่'), dayChips(f.date, v => { f.date = v; paint(); }),
      h('label.flabel', 'ช่วงเวลา'), h('div.qchips', Object.entries(SLOTS).map(([kk, v]) => h('button.qchip', { type: 'button', 'aria-pressed': String(kk === f.slot), onclick: () => { f.slot = kk; paint(); } }, v)))],
    h('label.flabel', { for: 'od-addr' }, p.kind === 'ride' ? 'รับที่' : 'ที่อยู่'), addr,
    h('label.flabel', { for: 'od-note' }, 'หมายเหตุถึงร้าน'), note);
  paint();
  const m = openModal({ title: k.book, label: `${k.book} ${p.name}`, body, isDirty: () => !!f.note.trim(),
    foot: h('button.btn.primary', { onclick: async () => {
      const now = p.kind === 'food' || p.kind === 'goods';
      if (!now && !f.date) return toast(`เลือกวันก่อน${P()}`);
      if (!f.addr.trim()) return toast('ใส่ที่อยู่ก่อน');
      await app.store.setPref('my_addr', f.addr.trim(), false);
      const r = await app.store.addRequest({ service_id: s.id, cat: s.cat, title: `${s.name} · ${p.name}`, provider_id: p.id, pkg: pk.name, price: pk.price,
        for_id: f.for_id, by_id: 'me', date: now ? new Date().toISOString().slice(0, 10) : f.date, slot: now ? null : f.slot, note: f.note.trim(), addr: f.addr.trim(), auto: true });
      m.close(true); toast(`${k.book}แล้ว${P()} ติดตามสถานะได้ที่เมนู กิจกรรม`); goAfterModal('req/' + r.id);
    } }, `ยืนยัน${k.book} ${baht(pk.price)}`) });
}

/* ================= จำลองสถานะอัตโนมัติ (ร้านรับงาน → กำลังทำ → เสร็จ) ================= */
const AT = [0, 8, 25, 50]; // วินาทีหลังสั่ง
export function startOrderSim() {
  const tick = async () => {
    const st = app.store; if (!st) return;
    for (const r of st.state.requests.filter(r => r.auto && r.provider_id && !['done', 'cancelled'].includes(r.status))) {
      const p = providerOf(r.provider_id); if (!p) continue;
      const steps = ['requested', 'confirmed', 'in_progress', 'done'], cur = steps.indexOf(r.status);
      const el = (Date.now() - Date.parse(r.created_at)) / 1000;
      const target = AT.filter(t => el >= t).length - 1;
      if (target > cur) { const nx = steps[cur + 1]; await st.patchRequest(r.id, { status: nx, by: r.provider_id }, `${p.name}: ${kindOf(p).steps[cur + 1]}`); }
    }
  };
  tick(); setInterval(tick, 3000);
}
export const PKG_OF = MARKET;
/** ตั้งรายการเปรียบเทียบจากภายนอก (เช่น ผู้ช่วย AI เลือก 3 เจ้า) */
export function setCompare(ids) { ms.cmp = ids.slice(0, 3); }
