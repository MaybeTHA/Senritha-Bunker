// หน้าหลัก (ศูนย์รวมบริการ) · หน้าบริการทั้งหมด · หน้าหมวด · หน้ารายละเอียดบริการ · การค้นหา
import { h, ic, put, toast } from '../ui/kit.js';
import { CATS, catOf, svcOf, svcsIn, searchCatalog, recommendFor, REQ_STEPS } from '../domain/catalog.js';
import { typeOf, isOpen } from '../domain/tasks.js';
import { app, S, ranked, dueLine } from './shared.js';
import { addTask } from './add.js';
import { openReminder } from './remind.js';
import { requestForm, familyAsk, shopModal, reqRow } from './care.js';
import { statusPill } from './common.js';
import { greeting, P, PQ, role, myName, thaiDay, ago, whoName, pageHead, secHead, catCard, svcRow, recCard, myReviews, avgStars, callBox, mapsUrl, demoTag, go, avatar } from './common.js';
import { isActiveReq } from '../domain/catalog.js';
import { photoOf } from '../domain/photos.js';
import { hasMarket, marketStats, baht } from '../domain/providers.js';
import { marketView } from './market.js';
import { openAI } from './aibot.js';
import { EXAMPLES } from '../domain/understand.js';
import { members } from './common.js';

const DOWL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'], MON = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const hs = { q: '', cat: 'health' };
const MARK = '__MARK__';

/* ================= หน้าหลัก (เว็บแอป: ฮีโร่ + ค้นหา · แท็บหมวด + ไทล์ · แบนเนอร์ · ทำไมต้อง Saduq) ================= */
const TYPED = ['สั่งอาหารอ่อนให้คุณแม่', 'หาผู้ดูแลรายวัน', 'จองรถพาไปหาหมอ', 'นัดตรวจสุขภาพ', 'หาช่างติดราวจับ'];
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
  }, 110);
  return wrap;
}
export function homeView(root, keepFocus = false) {
  const d = new Date(), unread = S().notices.filter(n => !n.read).length;
  const input = h('input', { id: 'hub-q', type: 'search', value: hs.q, autocomplete: 'off', placeholder: 'ค้นหาบริการ เช่น อาหารอ่อน ผู้ดูแล รถรับส่ง', 'aria-label': 'ค้นหาบริการ',
    oninput: e => { hs.q = e.target.value; homeView(root, true); } });
  const keepTyped = keepFocus && root.querySelector('.typed');
  put(root,
    h('header.hubtop',
      h('div.brandline', h('span.brandrow2', h('img.bmark', { src: MARK, alt: '' }), h('span.wordmark', 'SADU', h('i', 'Q'))), h('span.hdate', `${DOWL[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`)),
      h('a.bellbtn', { href: '#notif', 'aria-label': `การแจ้งเตือน${unread ? ` ยังไม่อ่าน ${unread}` : ''}` }, h('span', { html: ic('bell') }), unread ? h('em', String(Math.min(unread, 99))) : '', h('small', 'แจ้งเตือน')),
      h('a.mebtn', { href: '#me', 'aria-label': 'หน้าฉัน' }, avatar('me', myName() || 'ฉ'))),
    h('section.hero',
      h('p.hgreet', greeting(), h('span.hg-date', ` · ${DOWL[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`)),
      h('h1.htitle', h('span.sr', `วันนี้อยากให้เราช่วยอะไรดี${PQ()}`), h('span', { 'aria-hidden': 'true' }, role() === 'family' ? 'ดูแลคนที่คุณรัก ให้เราช่วย..' : 'ให้เราช่วย..'), keepTyped || typedLine()),
      h('label.hsearch.big', h('span', { html: ic('search') }), input, hs.q ? h('button.clr', { type: 'button', onclick: () => { hs.q = ''; homeView(root); }, 'aria-label': 'ล้างคำค้น' }, 'ล้าง') : ''),
      h('div.popular', { role: 'group', 'aria-label': 'คำค้นยอดนิยม' }, h('span', 'ค้นหาบ่อย'),
        POPULAR.map(k => h('button.pchip', { type: 'button', onclick: () => { hs.q = k; homeView(root); } }, k))),
      h('button.aihero', { type: 'button', onclick: () => openAI() }, h('span', { html: ic('bot') }), 'ไม่รู้จะเลือกอะไร? เล่าปัญหาให้ AI ช่วยเลือก 3 ตัวเลือก')),
    hs.q.trim() ? h('div.panel', searchResults(hs.q)) : [
      catPanel(root),
      aiSection(),
      caredFor(),
      banner(),
      whySabaii(),
      h('div.homecols',
        h('div.col', myActivities(), familyUpdates()),
        h('div.col', recommended(), nearby())),
    ]);
  if (keepFocus) { const el = root.querySelector('#hub-q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}

/** แผงหมวด: แท็บไอคอนใหญ่ (เลื่อนข้างได้) + ไทล์บริการของหมวดที่เลือก */
function catPanel(root) {
  const cur = catOf(hs.cat) ? hs.cat : 'health', c = catOf(cur);
  const tabs = h('div.ctabs', { role: 'tablist', 'aria-label': 'หมวดบริการ' }, CATS.map(x => h('button.ctab', { role: 'tab', 'aria-selected': String(x.id === cur), style: { '--ct': x.tint, '--ci': x.ink },
    onclick: () => { hs.cat = x.id; homeView(root); requestAnimationFrame(() => root.querySelector('.ctab[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })); } },
    h('span.ct-ic', { html: ic(x.icon) }), h('span', x.short))));
  const list = svcsIn(cur);
  return h('section.panel.catpanel',
    h('div.ctabwrap', tabs),
    h('div.tiles2', { role: 'tabpanel', 'aria-label': c.name }, list.map(s => h('a.ptile' + (photoOf(s) ? '.photo' : ''), { href: '#svc/' + s.id, style: { '--ci': c.ink, '--ct': c.tint, backgroundImage: photoOf(s) ? `url("${photoOf(s).src}")` : null } },
      h('span.pt-art', { html: ic(s.icon) }), marketStats(s.id) ? h('span.pt-badge', `${marketStats(s.id).count} เจ้า · ★ ${marketStats(s.id).rating.toFixed(1)}`) : '', h('b', s.name), h('small', s.provider?.phone ? `โทร ${s.provider.phone}` : marketStats(s.id) ? `เริ่มต้น ${baht(marketStats(s.id).min)} ${marketStats(s.id).unit}` : s.short)))),
    h('div.panelfoot', h('span', c.sub), h('a.morearrow', { href: cur === 'emergency' ? '#emergency' : '#cat/' + cur }, 'ดูเพิ่มเติม', h('span', { html: ic('arrow') }))));
}

/** เล่าปัญหา แล้วได้ 3 ตัวเลือก (ผู้ช่วย AI จำลอง) — 4 ขั้นแบบสไลด์ + ช่องพิมพ์ */
function aiSection() {
  const ta = h('textarea.field', { id: 'ai-home', rows: 2, maxlength: 400, placeholder: EXAMPLES[0], 'aria-label': 'เล่าปัญหาให้ AI' });
  const steps = [['bot', 'Chat Bot', `“${EXAMPLES[0]}”`], ['spark', 'AI เข้าใจโจทย์', 'จับว่าต้องการบริการพาไปโรงพยาบาล'], ['search', 'ค้นบริการ', 'กรองตามประเภทบริการและพื้นที่'], ['star', 'AI จัดอันดับ', 'เรียงตามความเหมาะสมกับโจทย์']];
  return h('section.aisec',
    h('div.ais-head', h('span.ais-badge', 'AI automation'), h('h2', 'เล่าปัญหา แล้วได้ 3 ตัวเลือก')),
    h('ol.aiflow', steps.map(([i, t, d]) => h('li', h('span.af-dot', { html: ic(i) }), h('b', t), h('small', d)))),
    h('div.ais-out', [['handheart', 'ผู้ช่วยพาไป รพ.'], ['car', 'รถรับส่ง'], ['wheel', 'รถตู้วีลแชร์']].map(([i, t]) => h('span', h('i', { html: ic(i) }), t))),
    h('div.ais-in', ta, h('button.btn.primary', { onclick: () => openAI(ta.value.trim() || EXAMPLES[0]), html: ic('send') + '<span>ให้ AI ช่วยเลือก</span>' })));
}

/** ผู้ที่คุณดูแล (มุมผู้ดูแล): การ์ดต่อคน · คำขอที่กำลังดำเนินการ · ทางลัดสั่งของ/จองบริการให้คนนั้น */
function caredFor() {
  const sr = members().filter(m => m.role === 'senior');
  const quick = [['l-meal', 'bowl', 'สั่งอาหาร'], ['l-care', 'hand', 'หาผู้ดูแล'], ['l-ride', 'car', 'จองรถ'], ['h-appt', 'steth', 'นัดหมอ']];
  return h('section.cared', secHead(role() === 'family' ? 'ผู้ที่คุณดูแล' : 'ครอบครัวของคุณ', ['จัดการ', 'family']),
    sr.length ? h('div.crow', sr.map(m => { const act = S().requests.filter(r => r.for_id === m.id && isActiveReq(r));
      return h('article.ccard', h('div.cc-top', avatar(m.id, m.name), h('div', h('b', m.name), h('small', [m.relation, act.length ? `กำลังดำเนินการ ${act.length} รายการ` : 'ไม่มีรายการค้าง'].filter(Boolean).join(' · ')))),
        act.length ? h('div.cc-act', act.slice(0, 2).map(r => h('a', { href: '#req/' + r.id }, statusPill(r.status, r), ' ', r.title.split(' · ').pop()))) : '',
        h('div.cc-quick', quick.map(([sid, i, t]) => h('a', { href: '#svc/' + sid, html: ic(i) + `<span>${t}</span>` })))); }))
      : h('div.emptybox.fam', h('span.eb-ic', { html: ic('users') }), h('div', h('b', 'เพิ่มคนที่คุณดูแล'), h('p', 'เช่น คุณแม่ คุณพ่อ เพื่อสั่งของและจองบริการให้แต่ละคน')), h('a.btn.primary.sm', { href: '#family' }, 'เพิ่ม')));
}

/** แบนเนอร์: ข้อมูลจริงที่ควรรู้ (ไม่ใช่โปรโมชั่น) */
function banner() {
  return h('a.banner', { href: '#emergency' },
    h('div.bn-l', h('small', 'เจ็บป่วยฉุกเฉิน'), h('b', 'โทร 1669'), h('span', 'ฟรี 24 ชั่วโมง · ทั่วประเทศ')),
    h('div.bn-m', h('p', 'บอก 4 อย่างให้ชัด'), h('ul', ['อาการ', 'ที่อยู่ + จุดสังเกต', 'อายุและโรคประจำตัว', 'เบอร์ติดต่อกลับ'].map(x => h('li', x)))),
    h('span.bn-cta', 'เปิดหน้าฉุกเฉิน', h('span', { html: ic('arrow') })));
}

/** ทำไมต้องใช้ Saduq? — หัวข้อใหญ่ + 3 คอลัมน์ (บอกเฉพาะที่จริง) */
function whySabaii() {
  const pts = [['grid', 'บริการผู้สูงอายุทั่วประเทศในที่เดียว', 'อาหาร ผู้ดูแล รถรับส่ง หมอ ช่าง และของใช้ จากหลายเจ้าในทุกภาค'], ['star', 'เทียบก่อนเลือก', 'ดูคะแนน รีวิวจากลูกหลานคนอื่น ราคา และแพ็กเกจ เทียบกันได้ทีละ 3 เจ้า'], ['users', 'ดูแลได้แม้อยู่ไกล', 'สั่งให้คุณพ่อคุณแม่จากที่ทำงาน ติดตามสถานะ และแชร์ให้พี่น้องรู้']];
  return h('section.why', h('p.eyebrow', 'ทำไมถึงต้องใช้ Saduq?'), h('h2.whyh', 'ตลาดบริการสำหรับลูกหลานและผู้ดูแล ครบทุกเรื่องของคนที่คุณรัก'),
    h('div.why3', pts.map(([i, t, d]) => h('div.wy', h('span.wy-ic', { html: ic(i) }), h('b', t), h('p', d)))),
    howItWorks());
}

const POPULAR = ['อาหารอ่อน', 'ผู้ดูแล', 'รถรับส่ง', 'แม่บ้าน', 'นัดหมอ', 'เบี้ยยังชีพ'];

/** ใช้งานอย่างไร — 3 ขั้น (แบบตลาดบริการ) */
function howItWorks() {
  const steps = [['search', 'เลือกบริการ', 'เลือกหมวด หรือพิมพ์สิ่งที่ต้องการ'], ['star', 'เทียบแล้วเลือกเจ้า', 'ดูคะแนน รีวิว ราคา แล้วกดสั่งหรือจอง'], ['activity', 'ติดตามและรีวิว', 'ดูสถานะที่เมนู กิจกรรม แล้วรีวิวเมื่อเสร็จ']];
  return h('section.howsec', h('h3.howh', 'ใช้งานง่ายใน 3 ขั้น'),
    h('ol.how', steps.map(([i, t, d], n) => h('li', h('span.how-ic', { html: ic(i) }), h('div', h('small', `ขั้นที่ ${n + 1}`), h('b', t), h('p', d))))));
}
/** ทำไมไว้ใจได้ — บอกเฉพาะสิ่งที่จริงในรุ่นนี้ */
function trust() {
  const pts = [['phone', 'เบอร์สายด่วนจากหน่วยงานจริง', 'เช่น 1669 · 1300 · 1330'], ['shield', 'ไม่มีรีวิว ราคา หรือผู้ให้บริการที่แต่งขึ้น', 'ไม่มีข้อมูลก็บอกตรง ๆ ว่ายังไม่มี'], ['lock', 'ข้อมูลอยู่ในเครื่องของคุณ', 'คุณเลือกเองว่าจะแชร์อะไรกับครอบครัว']];
  return h('section.trust', h('h2', 'ทำไมไว้ใจ Saduq ได้'), h('ul', pts.map(([i, t, d]) => h('li', h('span', { html: ic(i) }), h('div', h('b', t), h('small', d))))));
}

function recommended() {
  const list = recommendFor({ role: role(), hasMed: S().tasks.some(t => isOpen(t) && typeOf(t) === 'medicine'), hasFamily: S().family.length > 0 });
  return h('section', secHead('แนะนำสำหรับคุณ', ['ดูทั้งหมด', 'services']),
    h('div.recrow', list.map(recCard)));
}

/** กิจกรรมของฉัน: การเตือนที่ใกล้ถึง + คำขอที่ยังไม่จบ */
function myActivities() {
  const rem = ranked().slice(0, 3), reqs = S().requests.filter(isActiveReq).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 2);
  return h('section', secHead('นัดและคำขอล่าสุด', ['ดูทั้งหมด', 'activity']),
    rem.length || reqs.length ? h('div.actlist',
      reqs.map(reqRow),
      rem.map(t => h('button.actrow', { onclick: () => openReminder(t.id) },
        h('span.ar-ic.t-' + typeOf(t), { html: ic({ medicine: 'pill', appointment: 'steth', activity: 'spark', errand: 'bag' }[typeOf(t)] || 'bell') }),
        h('span.ar-tx', h('b', t.title), h('small', dueLine(t), t.source === 'sample' ? demoTag() : '')),
        h('span.sr-go', { html: ic('right') }))))
      : h('div.emptybox', h('b', 'ยังไม่มีนัดหรือคำขอ'), h('p', 'เริ่มจากตั้งเตือนกินยา หรือเลือกบริการจากหมวดด้านบน')),
    h('div.quickadd', { role: 'group', 'aria-label': 'เพิ่มการเตือนด่วน' },
      h('button.qa', { onclick: () => addTask('voice'), html: ic('mic') + '<span>พูดเพื่อเตือน</span>' }),
      h('button.qa', { onclick: () => addTask('text'), html: ic('edit') + '<span>พิมพ์เตือน</span>' }),
      h('button.qa', { onclick: () => addTask('camera'), html: ic('camera') + '<span>ถ่ายใบนัด/ซองยา</span>' })));
}

function familyUpdates() {
  const fam = S().family, feed = [...S().notices].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3);
  return h('section', secHead('อัปเดตจากครอบครัว', ['ครอบครัว', 'family']),
    !fam.length ? h('div.emptybox.fam', h('span.eb-ic', { html: ic('users') }), h('div', h('b', 'ยังไม่ได้เพิ่มคนในครอบครัว'), h('p', 'เพิ่มลูกหลานหรือผู้ดูแล เพื่อแชร์นัดหมายและแจ้งเหตุฉุกเฉิน')),
      h('a.btn.primary.sm', { href: '#family' }, 'เพิ่มสมาชิก'))
      : feed.length ? h('ul.feed', feed.map(feedItem)) : h('div.emptybox', h('p', 'ยังไม่มีอัปเดต')));
}
export const feedItem = n => h('li.fitem', avatar(n.by || 'me', whoName(n.by)), h('div', h('b', n.title), h('small', [whoName(n.by), ago(n.at), n.body].filter(Boolean).join(' · '))));

/** ใกล้ฉัน: ไม่มีฐานข้อมูลสถานที่ในแอป จึงไม่แสดงรายการปลอม — เปิด Google Maps ให้ค้นจากตำแหน่งจริงแทน */
function nearby() {
  const kinds = [['โรงพยาบาล', 'steth'], ['คลินิก', 'heart'], ['ร้านขายยา', 'pill'], ['ศูนย์ดูแลผู้สูงอายุ', 'hand']];
  return h('section', secHead('บริการใกล้คุณ'),
    h('div.nearbox',
      h('p', 'แตะเพื่อค้นหาใน Google Maps แผนที่จะถามก่อนใช้ตำแหน่งของคุณ'),
      h('div.nearbtns', kinds.map(([k, i]) => h('a.nearbtn', { href: mapsUrl(k), target: '_blank', rel: 'noopener', html: ic(i) + `<span>${k}</span>` + ic('ext') })))));
}

/* ---------- ผลการค้นหา: บริการ · การเตือน · คำขอ ---------- */
function searchResults(q) {
  const svcs = searchCatalog(q), words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = s => words.every(w => s.toLowerCase().includes(w));
  const rems = S().tasks.filter(t => isOpen(t) && hit(`${t.title} ${t.description || ''}`)).slice(0, 5);
  const reqs = S().requests.filter(r => hit(`${r.title} ${r.note || ''}`)).slice(0, 5);
  const n = svcs.length + rems.length + reqs.length;
  return h('section.results', { 'aria-live': 'polite' },
    h('p.rcount', n ? `พบ ${n} รายการ` : `ไม่พบ "${q}" ลองคำที่สั้นลง เช่น หมอ ยา รถ`),
    svcs.length ? [h('h2.rh', 'บริการ'), h('div.svclist', svcs.map(svcRow))] : '',
    rems.length ? [h('h2.rh', 'การเตือนของฉัน'), h('div.actlist', rems.map(t => h('button.actrow', { onclick: () => openReminder(t.id) }, h('span.ar-ic', { html: ic('bell') }), h('span.ar-tx', h('b', t.title), h('small', dueLine(t))))))] : '',
    reqs.length ? [h('h2.rh', 'คำขอบริการ'), h('div.actlist', reqs.map(reqRow))] : '');
}

/* ================= บริการทั้งหมด ================= */
const SF = { all: ['ทั้งหมด', () => true], now: ['ใช้ได้ทันที', s => s.ready], request: ['ส่งคำขอได้', s => ['request', 'family', 'shop'].includes(s.action)], call: ['โทรสายด่วน', s => s.action === 'call'], gov: ['บริการรัฐ', s => s.provider?.public] };
let sf = 'all';
export function servicesView(root) {
  const test = SF[sf][1];
  put(root, pageHead('บริการทั้งหมด', { back: 'home', sub: 'เลือกหมวด แล้วแตะบริการที่ต้องการ' }),
    h('div.qchips.filt', { role: 'group', 'aria-label': 'กรองบริการ' }, Object.entries(SF).map(([k, [v]]) => h('button.qchip', { type: 'button', 'aria-pressed': String(sf === k), onclick: () => { sf = k; servicesView(root); } }, v))),
    h('label.hsearch', h('span', { html: ic('search') }), h('input', { type: 'search', placeholder: 'ค้นหาบริการ…', 'aria-label': 'ค้นหาบริการ', onfocus: () => { go('home'); setTimeout(() => document.getElementById('hub-q')?.focus(), 150); } })),
    CATS.map(c => { const list = svcsIn(c.id).filter(test); if (!list.length) return null; const shown = sf === 'all' ? list.slice(0, 3) : list;
      return h('section.catblock', { style: { '--ct': c.tint, '--ci': c.ink } },
        h('a.cb-head', { href: c.id === 'emergency' ? '#emergency' : '#cat/' + c.id }, h('span.cc-ic', { html: ic(c.icon) }), h('h2', c.name), h('span.sr-go', { html: ic('right') })),
        h('div.svclist', shown.map(svcRow)),
        list.length > shown.length ? h('a.morelink', { href: '#cat/' + c.id }, `ดูอีก ${list.length - shown.length} บริการ`) : ''); }));
}

export function categoryView(root, id) {
  const c = catOf(id);
  if (!c) return servicesView(root);
  put(root, pageHead(c.name, { back: 'services', sub: c.sub }),
    h('div.cathero', { style: { '--ct': c.tint, '--ci': c.ink } }, h('span.cc-ic.xl', { html: ic(c.icon) }),
      h('p', id === 'benefits' ? 'ข้อมูลทั่วไปจากหน่วยงานรัฐ หลักเกณฑ์อาจเปลี่ยน โปรดตรวจสอบกับหน่วยงานก่อนเสมอ'
        : id === 'emergency' ? 'เหตุฉุกเฉินทางการแพทย์ โทร 1669 ฟรี 24 ชั่วโมง'
        : 'เลือกบริการ แล้วเทียบเจ้าที่ให้บริการจากคะแนน รีวิว และราคา')),
    h('div.svclist', svcsIn(id).map(svcRow)));
}

/* ================= รายละเอียดบริการ (โครงเดียวกันทุกหมวด) ================= */
const CTA = { request: 'ส่งคำขอบริการ', reminder: 'ตั้งการเตือน', family: 'ขอให้คนในครอบครัวช่วย', shop: 'จดไว้ซื้อ หรือขอให้ลูกหลานซื้อ', maps: 'ค้นหาใกล้ฉันใน Google Maps', route: 'เปิด', info: 'ตั้งเตือนให้ไปติดต่อ' };
export function serviceView(root, id) {
  const s = svcOf(id);
  if (!s) return servicesView(root);
  if (hasMarket(s.id)) return marketView(root, s);
  const c = catOf(s.cat), revs = myReviews(s.id), mine = S().requests.filter(r => r.service_id === s.id);
  const prov = s.provider
    ? h('div.provcard', h('span.pv-ic', { html: ic('landmark') }), h('div', h('b', s.provider.name), h('small', s.provider.public ? 'หน่วยงานรัฐ / สายด่วนทางการ' : '')))
    : s.ready ? h('div.provcard', h('span.pv-ic', { html: ic('shield') }), h('div', h('b', 'Saduq ในเครื่องนี้'), h('small', 'ใช้งานได้จริง ข้อมูลเก็บในเครื่องของคุณ')))
    : h('div.provcard.none', h('span.pv-ic', { html: ic('info') }), h('div', h('b', 'ยังไม่มีผู้ให้บริการในแอป'), h('small', 'ส่งคำขอได้ แอปจะบันทึกไว้ให้ติดตามเอง แต่ยังไม่ส่งถึงผู้ให้บริการ')));
  const act = () => runAction(s);
  put(root, pageHead(s.name, { back: 'cat/' + s.cat }),
    photoOf(s) ? h('figure.svcphoto', h('img', { src: photoOf(s).src, alt: '', loading: 'lazy' }), photoOf(s).own ? '' : h('figcaption', `ภาพประกอบ: ${photoOf(s).artist || 'Wikimedia Commons'} · ${photoOf(s).license}`)) : '',
    h('div.svchero', { style: { '--ct': c.tint, '--ci': c.ink } },
      h('span.cc-ic.xl', { html: ic(s.icon) }),
      h('div', h('a.chipcat', { href: '#cat/' + c.id }, c.short), h('p.lead', s.short))),
    s.action === 'call' && s.provider?.phone ? callBox(s.provider.phone, s.provider.name, { danger: s.cat === 'emergency' }) : '',
    h('section.dsec', h('h2', 'รายละเอียด'), h('p', s.desc), s.includes?.length ? h('ul.ticks', s.includes.map(x => h('li', h('span', { html: ic('check') }), x))) : ''),
    h('section.dsec', h('h2', 'ผู้ให้บริการ'), prov),
    h('section.dsec', h('h2', 'ราคาและเวลาให้บริการ'),
      h('dl.facts', h('div', h('dt', 'ราคา'), h('dd', s.price || (s.ready ? 'ไม่มีค่าใช้จ่าย' : 'ยังไม่มีข้อมูลราคา'))),
        h('div', h('dt', 'วันเวลาว่าง'), h('dd', s.action === 'call' ? 'ตามเวลาทำการของหน่วยงาน' : s.ready ? 'ใช้ได้ทุกเวลา' : 'ยังไม่มีข้อมูล — ระบุวันที่สะดวกในคำขอ')))),
    h('section.dsec', h('h2', 'รีวิว'), revs.length
      ? [h('p.stars', `${avgStars(revs).toFixed(1)} ★ จาก ${revs.length} รีวิวของคุณ`), revs.map(r => h('blockquote.rev', h('b', '★'.repeat(r.review.stars) + '☆'.repeat(5 - r.review.stars)), r.review.text ? h('p', r.review.text) : '', h('small', `${whoName(r.by_id)} · ${thaiDay(r.date) || ''}`)))]
      : h('p.muted', 'ยังไม่มีรีวิว รีวิวได้หลังใช้บริการเสร็จ')),
    s.action === 'request' ? h('section.dsec', h('h2', 'ขั้นตอน'), h('ol.flow', ['ส่งคำขอ', ...REQ_STEPS.slice(1).map(x => x[1]), 'รีวิว'].map((x, i) => h('li', h('i', String(i + 1)), x)))) : '',
    mine.length ? h('section.dsec', h('h2', 'คำขอของคุณสำหรับบริการนี้'), h('div.actlist', mine.map(reqRow))) : '',
    h('div.stickycta', s.action === 'call' ? h('a.btn.' + (s.cat === 'emergency' ? 'sos' : 'primary'), { href: 'tel:' + s.provider.phone, html: ic('phone') + `<span>โทร ${s.provider.phone}</span>` })
      : s.action === 'maps' ? h('a.btn.primary', { href: mapsUrl(s.query), target: '_blank', rel: 'noopener', html: ic('map') + `<span>${CTA.maps}</span>` })
      : h('button.btn.primary', { onclick: act }, CTA[s.action] + (s.action === 'route' ? s.name : ''))));
}

export function runAction(s) {
  if (s.action === 'request') return requestForm(s);
  if (s.action === 'family') return familyAsk();
  if (s.action === 'shop') return shopModal(s);
  if (s.action === 'reminder') return addTask('text', s.preset || '');
  if (s.action === 'route') return go(s.to);
  if (s.action === 'info') return addTask('text', s.name + ' ');
  toast('ไม่มีการทำงานสำหรับบริการนี้');
}
