// หน้าหลักของผู้ดูแล · บริการทั้งหมด · หน้าหมวด · รายละเอียดบริการ · การค้นหา
import { h, ic, put, toast } from '../ui/kit.js';
import { CATS, catOf, svcOf, svcsIn, searchCatalog, CHECKED } from '../domain/catalog.js';
import { searchProducts, groupOf } from '../domain/market.js';
import { isOpen } from '../domain/tasks.js';
import { S, dueLine } from './shared.js';
import { addTask } from './add.js';
import { openReminder } from './remind.js';
import { requestForm, familyAsk, reqRow } from './care.js';
import { greeting, PQ, myName, thaiDay, whoName, pageHead, secHead, svcRow, mapsUrl, go, avatar, curPerson, recipients } from './common.js';
import { isActiveReq } from '../domain/catalog.js';
import { photoOf } from '../domain/photos.js';
import { careBoard, todayCare, benefitsBlock } from './people.js';
import { productCard, featuredProducts, sources } from './shop.js';

const DOWL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'], MON = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const hs = { q: '', cat: 'living' };
const MARK = '__MARK__';

/* ================= หน้าหลักของผู้ดูแล: ค้นหา · ผู้ที่ดูแล · งานวันนี้ · หมวด · สิทธิ · สินค้า ================= */
const TYPED = ['ผ้าอ้อมผู้ใหญ่ฟรี', 'ยืมเตียงผู้ป่วย', 'Caregiver ชุมชน', 'หาหมอออนไลน์', 'เครื่องวัดความดัน'];
let typeTimer = 0;
function typedLine() {
  const out = h('span.tw'), wrap = h('span.typed', { 'aria-hidden': 'true' }, out, h('i.caret'));
  clearInterval(typeTimer);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { out.textContent = TYPED[0]; return wrap; }
  let w = 0, c = 0, hold = 0;
  typeTimer = setInterval(() => {
    if (!out.isConnected) return clearInterval(typeTimer);
    const word = [...TYPED[w]];
    if (c <= word.length) out.textContent = word.slice(0, c++).join('');
    else if (++hold > 16) { hold = 0; c = 0; w = (w + 1) % TYPED.length; }
  }, 100);
  return wrap;
}
export function homeView(root, keepFocus = false) {
  const d = new Date(), unread = S().notices.filter(n => !n.read).length, cp = curPerson();
  const input = h('input', { id: 'hub-q', type: 'search', value: hs.q, autocomplete: 'off', placeholder: 'ค้นหาสินค้า บริการ สิทธิ เช่น ผ้าอ้อม รถเข็น บัตรทอง', 'aria-label': 'ค้นหาสินค้า บริการ และสิทธิ',
    oninput: e => { hs.q = e.target.value; homeView(root, true); },
    onkeydown: e => { if (e.key === 'Enter' && hs.q.trim().split(/\s+/).length >= 2) { const q = hs.q.trim(); hs.q = ''; go('ai/' + encodeURIComponent(q)); } } });
  const keepTyped = keepFocus && root.querySelector('.typed');
  put(root,
    h('header.hubtop',
      h('div.brandline', h('span.brandrow2', h('img.bmark', { src: MARK, alt: '' }), h('span.wordmark', 'SADU', h('i', 'Q'))), h('span.hdate', 'ผู้ช่วยของผู้ดูแลผู้สูงอายุ')),
      h('a.bellbtn', { href: '#notif', 'aria-label': `การแจ้งเตือน${unread ? ` ยังไม่อ่าน ${unread}` : ''}` }, h('span', { html: ic('bell') }), unread ? h('em', String(Math.min(unread, 99))) : '', h('small', 'แจ้งเตือน')),
      h('a.mebtn', { href: '#me', 'aria-label': 'หน้าฉัน' }, avatar('me', myName() || 'ฉ'))),
    h('section.hero',
      h('p.hgreet', greeting(), h('span.hg-date', ` · ${DOWL[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`)),
      h('h1.htitle', h('span.sr', `ผู้ช่วยของผู้ดูแลผู้สูงอายุ ค้นหาอะไรดี${PQ()}`), h('span', { 'aria-hidden': 'true' }, cp ? `ดูแล${cp.name}วันนี้ ต้องหา..` : 'ผู้ดูแลต้องหา..'), keepTyped || typedLine()),
      h('label.hsearch.big', h('span', { html: ic('search') }), input, hs.q ? h('button.clr', { type: 'button', onclick: () => { hs.q = ''; homeView(root); }, 'aria-label': 'ล้างคำค้น' }, 'ล้าง') : ''),
      h('div.popular', { role: 'group', 'aria-label': 'คำค้นยอดนิยม' }, h('span', 'ค้นหาบ่อย'),
        POPULAR.map(k => h('button.pchip', { type: 'button', onclick: () => { hs.q = k; homeView(root); } }, k))),
      h('a.aicta', { href: '#ai' }, h('span.aicta-ic', { html: ic('spark') }), h('span', h('b', 'ไม่รู้จะค้นอะไร? เล่าปัญหาให้ AI ฟัง'), h('small', 'เช่น "แม่เดินไม่สะดวก ต้องไปหาหมอทุกเดือน" → ได้ 3 ตัวเลือก')), h('span.aicta-go', { html: ic('arrow') }))),
    hs.q.trim() ? h('div.panel', searchResults(hs.q)) : [
      h('div.panel.board', h('div.boardcols', h('div.col', careBoard()), h('div.col', todayCare()))),
      catPanel(root),
      cp ? benefitsBlock(cp, { limit: 4 }) : '',
      featuredProducts(),
      demoEntry(),
      banner(),
      h('div.homecols',
        h('div.col', tracking(), teamUpdates()),
        h('div.col', nearby(), trustNote())),
    ]);
  if (keepFocus) { const el = root.querySelector('#hub-q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}
const POPULAR = ['ผ้าอ้อม', 'ยืมเตียง', 'ผู้ดูแล', 'หาหมอออนไลน์', 'เบี้ยยังชีพ', 'ความดัน'];

/** แผงหมวด: แท็บไอคอนใหญ่ + ไทล์ของหมวดที่เลือก */
function catPanel(root) {
  const cur = catOf(hs.cat) ? hs.cat : 'living', c = catOf(cur);
  const tabs = h('div.ctabs', { role: 'tablist', 'aria-label': 'หมวด' }, CATS.map(x => h('button.ctab', { role: 'tab', 'aria-selected': String(x.id === cur), style: { '--ct': x.tint, '--ci': x.ink },
    onclick: () => { hs.cat = x.id; homeView(root); requestAnimationFrame(() => root.querySelector('.ctab[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })); } },
    h('span.ct-ic', { html: ic(x.icon) }), h('span', x.short))));
  const list = svcsIn(cur), href = s => s.action === 'products' ? '#shop/' + s.group : '#svc/' + s.id;
  return h('section.panel.catpanel',
    h('div.ctabwrap', tabs),
    h('div.tiles2', { role: 'tabpanel', 'aria-label': c.name }, list.map(s => h('a.ptile' + (photoOf(s) ? '.photo' : ''), { href: href(s), style: { '--ci': c.ink, '--ct': c.tint, backgroundImage: photoOf(s) ? `url("${photoOf(s).src}")` : null } },
      h('span.pt-art', { html: ic(s.icon) }), h('b', s.name), h('small', s.provider?.phone && s.action === 'call' ? `โทร ${s.provider.phone} · ${s.short}` : s.short)))),
    h('div.panelfoot', h('span', c.sub), h('a.morearrow', { href: cur === 'emergency' ? '#emergency' : cur === 'shop' ? '#shop' : '#cat/' + cur }, 'ดูเพิ่มเติม', h('span', { html: ic('arrow') }))));
}

/** ทางเข้าตลาดตัวอย่าง (ข้อมูลจำลอง): เลือกเจ้า · รีวิว · เปรียบเทียบ · สั่ง/จอง */
function demoEntry() {
  const pics = ['l-meal', 'l-care', 'l-ride'];
  return h('a.demoentry', { href: '#demo' },
    h('div.de-pics', pics.map(p => h('i', { style: { backgroundImage: `url("assets/photos/${p}.jpg")` } }))),
    h('div.de-tx', h('span.mk-tag', 'ข้อมูลจำลอง'), h('b', 'ลองตลาดบริการตัวอย่าง'), h('small', '140 ร้านสมมุติใน 20 บริการ: เลือกเจ้า ดูรีวิว เปรียบเทียบ แล้วลองสั่งหรือจอง')),
    h('span.sr-go', { html: ic('right') }));
}

function banner() {
  return h('a.banner', { href: '#emergency' },
    h('div.bn-l', h('small', 'ผู้สูงอายุเจ็บป่วยฉุกเฉิน'), h('b', 'โทร 1669'), h('span', 'ฟรี 24 ชั่วโมง · ทั่วประเทศ')),
    h('div.bn-m', h('p', 'ผู้ดูแลบอก 4 อย่างให้ชัด'), h('ul', ['อาการ', 'ที่อยู่ + จุดสังเกต', 'อายุและโรคประจำตัว', 'เบอร์ติดต่อกลับ'].map(x => h('li', x)))),
    h('span.bn-cta', 'เปิดหน้าฉุกเฉิน', h('span', { html: ic('arrow') })));
}

/** เรื่องที่กำลังติดตาม (ยื่นสิทธิ ยืมอุปกรณ์ แบ่งงานให้ทีม) */
function tracking() {
  const reqs = S().requests.filter(isActiveReq).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 3);
  return h('section', secHead('เรื่องที่กำลังติดตาม', ['ทั้งหมด', 'activity']),
    reqs.length ? h('div.actlist', reqs.map(reqRow))
      : h('div.emptybox', h('b', 'ยังไม่มีเรื่องที่ติดตาม'), h('p', 'เวลายื่นสิทธิหรือขอยืมอุปกรณ์ กด "ติดตามเรื่องนี้" ที่หน้าบริการ จะได้ไม่ลืมว่าถึงขั้นไหนแล้ว')));
}
function teamUpdates() {
  const feed = [...S().notices].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4);
  return h('section', secHead('อัปเดตทีมดูแล', ['ทีมดูแล', 'family']),
    feed.length ? h('ul.feed', feed.map(feedItem)) : h('div.emptybox', h('p', 'ยังไม่มีอัปเดต')));
}
export const feedItem = n => h('li.fitem', avatar(n.by || 'me', whoName(n.by)), h('div', h('b', n.title), h('small', [whoName(n.by), ago2(n.at), n.body].filter(Boolean).join(' · '))));
const ago2 = iso => { const s = (Date.now() - Date.parse(iso)) / 1000; return s < 60 ? 'เมื่อสักครู่' : s < 3600 ? `${Math.floor(s / 60)} นาทีที่แล้ว` : s < 86400 ? `${Math.floor(s / 3600)} ชั่วโมงที่แล้ว` : thaiDay(iso.slice(0, 10)); };

/** ใกล้ฉัน: ไม่มีฐานข้อมูลสถานที่ในแอป จึงไม่แสดงรายการปลอม — เปิด Google Maps ให้ค้นจากตำแหน่งจริงแทน */
function nearby() {
  const kinds = [['โรงพยาบาล', 'steth'], ['ร้านยาคุณภาพของฉัน', 'pill'], ['ร้านอุปกรณ์การแพทย์', 'bag'], ['ศูนย์ดูแลผู้สูงอายุ', 'hand']];
  return h('section', secHead('ค้นหาใกล้บ้าน'),
    h('div.nearbox',
      h('p', 'แตะเพื่อค้นหาใน Google Maps แผนที่จะถามก่อนใช้ตำแหน่งของคุณ'),
      h('div.nearbtns', kinds.map(([k, i]) => h('a.nearbtn', { href: mapsUrl(k), target: '_blank', rel: 'noopener', html: ic(i) + `<span>${k}</span>` + ic('ext') })))));
}
function trustNote() {
  const pts = [['shield', 'ข้อมูลจริง มีแหล่งอ้างอิง', `ทุกสิทธิ สินค้า และราคา มีลิงก์ที่มา · ตรวจ ${CHECKED}`], ['coin', 'ไม่มีโฆษณาแฝง', 'ไม่ได้รับค่าตอบแทนจากร้านหรือผู้ให้บริการ'], ['lock', 'ข้อมูลอยู่ในเครื่องคุณ', 'ข้อมูลการแพทย์และบันทึกสุขภาพไม่ถูกส่งออกไปไหน']];
  return h('section.trust', h('h2', 'ทำไมผู้ดูแลไว้ใจ Saduq ได้'), h('ul', pts.map(([i, t, d]) => h('li', h('span', { html: ic(i) }), h('div', h('b', t), h('small', d))))));
}

/* ---------- ผลการค้นหา: สินค้า · บริการ · งานดูแล · เรื่องที่ติดตาม ---------- */
function searchResults(q) {
  const svcs = searchCatalog(q), prods = searchProducts(q), words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = s => words.every(w => s.toLowerCase().includes(w));
  const rems = S().tasks.filter(t => isOpen(t) && hit(`${t.title} ${t.description || ''}`)).slice(0, 5);
  const reqs = S().requests.filter(r => hit(`${r.title} ${r.note || ''}`)).slice(0, 5);
  const n = svcs.length + prods.length + rems.length + reqs.length;
  return h('section.results', { 'aria-live': 'polite' },
    h('p.rcount', n ? `พบ ${n} รายการ` : `ไม่พบ "${q}" ลองคำที่สั้นลง เช่น ผ้าอ้อม เตียง ยา`),
    h('a.aicta.inline', { href: '#ai/' + encodeURIComponent(q) }, h('span.aicta-ic', { html: ic('spark') }), h('span', h('b', `ให้ AI ช่วยคิดจาก "${q}"`), h('small', 'กด Enter หรือแตะที่นี่ — ได้ 3 ตัวเลือกพร้อมเหตุผล')), h('span.aicta-go', { html: ic('arrow') })),
    svcs.length ? [h('h2.rh', 'บริการและสิทธิ'), h('div.svclist', svcs.map(svcRow))] : '',
    prods.length ? [h('h2.rh', 'สินค้าและอุปกรณ์'), h('div.prodgrid', prods.map(productCard))] : '',
    rems.length ? [h('h2.rh', 'งานดูแล'), h('div.actlist', rems.map(t => h('button.actrow', { onclick: () => openReminder(t.id) }, h('span.ar-ic', { html: ic('bell') }), h('span.ar-tx', h('b', t.title), h('small', dueLine(t))))))] : '',
    reqs.length ? [h('h2.rh', 'เรื่องที่ติดตาม'), h('div.actlist', reqs.map(reqRow))] : '');
}

/* ================= บริการทั้งหมด ================= */
const SF = { all: ['ทั้งหมด', () => true], free: ['ฟรี/ตามสิทธิ', s => /ฟรี|ไม่มีค่าใช้จ่าย|ไม่เกิน/.test(s.price || '')], call: ['โทรสายด่วน', s => s.action === 'call'], gov: ['บริการรัฐ', s => s.provider?.public], app: ['ใช้ในแอป', s => s.ready && s.action !== 'products'] };
let sf = 'all';
export function servicesView(root) {
  const test = SF[sf][1];
  put(root, pageHead('บริการและสิทธิทั้งหมด', { back: 'home', sub: 'บริการจริงจากหน่วยงานรัฐและโครงการ พร้อมวิธียื่นและแหล่งที่มา' }),
    h('div.qchips.filt', { role: 'group', 'aria-label': 'กรองบริการ' }, Object.entries(SF).map(([k, [v]]) => h('button.qchip', { type: 'button', 'aria-pressed': String(sf === k), onclick: () => { sf = k; servicesView(root); } }, v))),
    h('label.hsearch', h('span', { html: ic('search') }), h('input', { type: 'search', placeholder: 'ค้นหาบริการ…', 'aria-label': 'ค้นหาบริการ', onfocus: () => { go('home'); setTimeout(() => document.getElementById('hub-q')?.focus(), 150); } })),
    CATS.map(c => { const list = svcsIn(c.id).filter(s => s.action !== 'products').filter(test); if (!list.length) return null; const shown = sf === 'all' ? list.slice(0, 4) : list;
      return h('section.catblock', { style: { '--ct': c.tint, '--ci': c.ink } },
        h('a.cb-head', { href: c.id === 'emergency' ? '#emergency' : '#cat/' + c.id }, h('span.cc-ic', { html: ic(c.icon) }), h('h2', c.name), h('span.sr-go', { html: ic('right') })),
        h('div.svclist', shown.map(svcRow)),
        list.length > shown.length ? h('a.morelink', { href: '#cat/' + c.id }, `ดูอีก ${list.length - shown.length} บริการ`) : ''); }));
}

export function categoryView(root, id) {
  const c = catOf(id);
  if (!c) return servicesView(root);
  if (id === 'shop') return go('shop');
  const cp = curPerson();
  put(root, pageHead(c.name, { back: 'services', sub: c.sub }),
    h('div.cathero', { style: { '--ct': c.tint, '--ci': c.ink } }, h('span.cc-ic.xl', { html: ic(c.icon) }),
      h('p', id === 'emergency' ? 'เหตุฉุกเฉินทางการแพทย์ โทร 1669 ฟรี 24 ชั่วโมง'
        : id === 'family' ? 'ผู้รับการดูแลและคนในทีมที่ช่วยกันดูแล'
        : `ข้อมูลจากหน่วยงานรัฐและข่าวที่อ้างอิงได้ ตรวจ ${CHECKED} หลักเกณฑ์อาจเปลี่ยนตามปีงบประมาณ ตรวจสอบกับหน่วยงานก่อนเสมอ`)),
    id === 'benefits' && cp ? benefitsBlock(cp) : '',
    id === 'benefits' && cp ? h('h2.rh', 'สิทธิทั้งหมด') : '',
    h('div.svclist', svcsIn(id).map(svcRow)));
}

/* ================= รายละเอียดบริการ ================= */
const CTA = { reminder: 'ตั้งการเตือน', family: 'แบ่งงานให้คนในทีม', maps: 'ค้นหาใกล้ฉันใน Google Maps', route: 'เปิด', info: 'ตั้งเตือนให้ไปติดต่อ', web: 'เปิดเว็บหน่วยงาน' };
const contactEl = c => c.t === 'tel' ? h('a.ctrow', { href: 'tel:' + c.v }, h('span', { html: ic('phone') }), h('b', c.v), h('small', c.label || 'โทร'))
  : c.t === 'web' ? h('a.ctrow', { href: c.v, target: '_blank', rel: 'noopener' }, h('span', { html: ic('ext') }), h('b', c.label || c.v), h('small', 'เว็บไซต์'))
  : h('a.ctrow', { href: 'https://line.me/R/ti/p/' + encodeURIComponent(c.v), target: '_blank', rel: 'noopener' }, h('span', { html: ic('link') }), h('b', 'LINE ' + c.v), h('small', c.label || 'LINE'));
export function serviceView(root, id) {
  const s = svcOf(id);
  if (!s) return servicesView(root);
  if (s.action === 'products') return go('shop/' + s.group);
  const c = catOf(s.cat), mine = S().requests.filter(r => r.service_id === s.id);
  const prov = s.provider
    ? h('div.provcard', h('span.pv-ic', { html: ic('landmark') }), h('div', h('b', s.provider.name), h('small', s.provider.public ? 'หน่วยงานรัฐ / โครงการรัฐ' : '')))
    : s.ready ? h('div.provcard', h('span.pv-ic', { html: ic('shield') }), h('div', h('b', 'เครื่องมือใน Saduq'), h('small', 'ใช้งานได้จริง ข้อมูลเก็บในเครื่องของคุณ'))) : '';
  put(root, pageHead(s.name, { back: 'cat/' + s.cat }),
    photoOf(s) ? h('figure.svcphoto', h('img', { src: photoOf(s).src, alt: '', loading: 'lazy' }), h('figcaption', `ภาพประกอบ: ${photoOf(s).artist || 'Wikimedia Commons'} · ${photoOf(s).license}`)) : '',
    h('div.svchero', { style: { '--ct': c.tint, '--ci': c.ink } },
      h('span.cc-ic.xl', { html: ic(s.icon) }),
      h('div', h('a.chipcat', { href: '#cat/' + c.id }, c.short), h('p.lead', s.short))),
    s.action === 'call' && s.provider?.phone && !s.contact ? callBoxLite(s) : '',
    s.contact?.length ? h('section.dsec', h('h2', 'ช่องทางติดต่อ'), h('div.ctlist', s.contact.map(contactEl))) : '',
    h('section.dsec', h('h2', 'รายละเอียด'), h('p', s.desc), s.includes?.length ? h('ul.ticks', s.includes.map(x => h('li', h('span', { html: ic('check') }), x))) : ''),
    s.who?.length ? h('section.dsec', h('h2', 'ใครมีสิทธิ / เงื่อนไข'), h('ul.ticks', s.who.map(x => h('li', h('span', { html: ic('check') }), x)))) : '',
    s.how?.length ? h('section.dsec', h('h2', 'ผู้ดูแลต้องทำอะไร'), h('ol.flow', s.how.map((x, i) => h('li', h('i', String(i + 1)), x)))) : '',
    prov ? h('section.dsec', h('h2', 'ผู้ให้บริการ'), prov, s.price ? h('dl.facts', h('div', h('dt', 'ค่าใช้จ่าย'), h('dd', s.price))) : '') : '',
    s.src?.length ? h('section.dsec', h('h2', 'แหล่งที่มาของข้อมูล'), sources(s.src), h('p.srcnote', `ตรวจข้อมูล ${CHECKED} · หลักเกณฑ์อาจเปลี่ยน ตรวจสอบกับหน่วยงานก่อนยื่น`)) : '',
    mine.length ? h('section.dsec', h('h2', 'เรื่องที่คุณติดตามของบริการนี้'), h('div.actlist', mine.map(reqRow))) : '',
    h('div.stickycta' + (s.track ? '.two' : ''),
      s.track ? h('button.btn.ghost', { onclick: () => requestForm(s) }, 'ติดตามเรื่องนี้') : '',
      mainCta(s)));
}
const callBoxLite = s => h('div.callbox' + (s.cat === 'emergency' ? '.danger' : ''), h('div.cb-num', h('small', s.provider.name), h('b', s.provider.phone)));
function mainCta(s) {
  const phone = s.provider?.phone || s.contact?.find(c => c.t === 'tel')?.v;
  if (s.action === 'call' && phone) return h('a.btn.' + (s.cat === 'emergency' ? 'sos' : 'primary'), { href: 'tel:' + phone, html: ic('phone') + `<span>โทร ${phone}</span>` });
  if (s.action === 'maps') return h('a.btn.primary', { href: mapsUrl(s.query), target: '_blank', rel: 'noopener', html: ic('map') + `<span>${CTA.maps}</span>` });
  if (s.action === 'web') return h('a.btn.primary', { href: s.url, target: '_blank', rel: 'noopener', html: ic('ext') + `<span>${CTA.web}</span>` });
  return h('button.btn.primary', { onclick: () => runAction(s) }, CTA[s.action] + (s.action === 'route' ? s.name : ''));
}

export function runAction(s) {
  const cp = curPerson();
  if (s.action === 'family') return familyAsk();
  if (s.action === 'reminder') return addTask('text', s.preset || '', { type: s.type, for_id: cp?.id });
  if (s.action === 'route') return go(s.to);
  if (s.action === 'info') return addTask('text', 'ติดต่อเรื่อง ' + s.name + ' ', { for_id: cp?.id });
  if (s.action === 'products') return go('shop/' + s.group);
  toast('ไม่มีการทำงานสำหรับบริการนี้');
}
export { recipients };
