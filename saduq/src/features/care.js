// คำขอบริการ (ส่ง → ติดตาม → รีวิว) · ขอให้ครอบครัวช่วย · รายการซื้อ · หน้ากิจกรรมของฉัน · หน้าแจ้งเตือน
import { h, ic, put, toast, openModal, closeModal, confirmBox } from '../ui/kit.js';
import { svcOf, catOf, REQ_STEPS, REQ_LABEL, SLOTS, stepIndex, nextStatus, isActiveReq } from '../domain/catalog.js';
import { app, S, today } from './shared.js';
import { dayChips } from './add.js';
import { tasksView } from './tasks.js';
import { goAfterModal, P, whoName, careTargets, members, thaiDay, ago, pageHead, statusPill, demoTag, go, avatar, log } from './common.js';

/* ---------- ชิ้นฟอร์มสั้น ๆ ---------- */
const chips = (opts, sel, onPick, label) => h('div.qchips', { role: 'group', 'aria-label': label },
  opts.map(([k, v]) => h('button.qchip', { type: 'button', 'aria-pressed': String(k === sel), onclick: () => onPick(k) }, v)));
const fl = (txt, forId) => h('label.flabel', forId ? { for: forId } : null, txt);

/** ติดตามเรื่อง — ผู้ดูแลจดว่ากำลังยื่น/ติดต่อบริการไหนให้ใคร แล้วอัปเดตสถานะเอง (แอปไม่ได้ส่งให้หน่วยงาน) */
export function requestForm(s, preset = {}) {
  const f = { for_id: careTargets()[0]?.id || 'me', date: null, slot: 'morning', note: '', phone: S().prefs.my_phone || '', ...preset };
  const body = h('div.rform');
  const note = h('textarea.field', { id: 'rq-note', rows: 3, maxlength: 500, placeholder: 'เช่น คุยกับใคร ได้เลขที่เรื่องอะไร ต้องเตรียมเอกสารอะไรเพิ่ม', oninput: e => { f.note = e.target.value; } });
  const phone = h('input.field', { id: 'rq-phone', type: 'tel', inputmode: 'tel', maxlength: 20, value: f.phone, placeholder: 'เบอร์เจ้าหน้าที่/หน่วยงาน', oninput: e => { f.phone = e.target.value; } });
  const paint = () => put(body,
    h('p.demo-note', h('span', { html: ic('info') }), 'แอปจดไว้ให้คุณติดตามเอง ไม่ได้ส่งเรื่องให้หน่วยงาน — ติดต่อหน่วยงานตามช่องทางในหน้าบริการ'),
    careTargets().length > 1 ? [fl('เรื่องของใคร'), chips(careTargets().map(x => [x.id, x.name]), f.for_id, v => { f.for_id = v; paint(); }, 'เรื่องของใคร')] : '',
    fl('วันที่ติดต่อ/วันนัดถัดไป'), dayChips(f.date, v => { f.date = v; paint(); }),
    fl('ช่วงเวลา'), chips(Object.entries(SLOTS), f.slot, v => { f.slot = v; paint(); }, 'ช่วงเวลา'),
    fl('บันทึก', 'rq-note'), note, fl('เบอร์ติดต่อหน่วยงาน (ไม่บังคับ)', 'rq-phone'), phone);
  paint();
  const m = openModal({ title: `ติดตาม: ${s.name}`, label: `ติดตามเรื่อง ${s.name}`, body, isDirty: () => !!f.note.trim(),
    foot: h('button.btn.primary', { onclick: async () => {
      if (!f.date) return toast(`เลือกวันก่อน${P()}`);
      const r = await app.store.addRequest({ service_id: s.id, cat: s.cat, title: s.name, for_id: f.for_id, by_id: 'me', date: f.date, slot: f.slot, note: f.note.trim(), phone: f.phone.trim() });
      m.close(true); toast(`เริ่มติดตามแล้ว${P()} ดูได้ที่เมนู งานดูแล`); goAfterModal('req/' + r.id);
    } }, 'เริ่มติดตาม') });
}

/** ขอให้คนในครอบครัวช่วย — ใช้เส้นทางสถานะเดียวกับคำขอบริการ (ผู้รับเรื่อง = สมาชิก) */
export function familyAsk(preset = {}) {
  const ms = members().filter(m => m.role !== 'senior');
  if (!ms.length) {
    return openModal({ title: 'แบ่งงานให้คนในทีม', body: h('div', h('p', 'ยังไม่มีคนในทีมดูแล (พี่น้อง ญาติ ผู้ดูแลจ้าง) เพิ่มก่อนแล้วค่อยแบ่งงาน')),
      foot: h('button.btn.primary', { onclick: () => { closeModal(); goAfterModal('family'); } }, 'ไปเพิ่มคนในทีม') });
  }
  const f = { who: ms[0].id, what: preset.what || '', date: null, slot: 'morning' };
  const body = h('div.rform');
  const what = h('textarea.field', { id: 'fa-what', rows: 3, maxlength: 300, placeholder: 'เช่น พาแม่ไปหาหมอ เฝ้าแทนวันเสาร์ ซื้อผ้าอ้อม', oninput: e => { f.what = e.target.value; } });
  what.value = f.what;
  const paint = () => put(body,
    fl('ให้ใครทำ'), chips(ms.map(m => [m.id, `${m.name} (${m.relation || 'ทีมดูแล'})`]), f.who, v => { f.who = v; paint(); }, 'ให้ใครทำ'),
    fl('ให้ช่วยเรื่องอะไร', 'fa-what'), what,
    fl('วันไหน'), dayChips(f.date, v => { f.date = v; paint(); }),
    fl('ช่วงเวลา'), chips(Object.entries(SLOTS), f.slot, v => { f.slot = v; paint(); }, 'ช่วงเวลา'),
    h('p.demo-note', h('span', { html: ic('info') }), 'ยังส่งถึงเครื่องของคนในทีมไม่ได้ แอปเก็บงานไว้ให้ติดตาม และโชว์เบอร์ให้โทร/LINE บอกเอง'));
  paint();
  const m = openModal({ title: 'แบ่งงานให้คนในทีม', body, isDirty: () => !!f.what.trim(),
    foot: h('button.btn.primary', { onclick: async () => {
      if (!f.what.trim()) return toast('บอกงานที่อยากให้ช่วยก่อน');
      if (!f.date) return toast('เลือกวันก่อน');
      const r = await app.store.addRequest({ service_id: 'f-ask', cat: 'family', title: f.what.trim().slice(0, 80), for_id: careTargets()[0]?.id || 'me', by_id: 'me', assignee_id: f.who, date: f.date, slot: f.slot, note: '' });
      m.close(true); toast(`บันทึกแล้ว${P()} อย่าลืมโทรบอก ${whoName(f.who)}`); goAfterModal('req/' + r.id);
    } }, 'บันทึกงาน') });
}

/** สินค้า: ไม่มีร้านค้าในระบบ → จดเป็นรายการซื้อ (เตือน) หรือขอให้ลูกหลานช่วยซื้อ */
export function shopModal(s) {
  let item = s.includes?.[0] || s.name;
  const inp = h('input.field', { id: 'shop-item', value: item, maxlength: 100, 'aria-label': 'ของที่ต้องการ', oninput: e => { item = e.target.value; } });
  openModal({ title: s.name, body: h('div.rform',
    h('p.demo-note', h('span', { html: ic('info') }), 'ยังไม่มีร้านค้าที่ยืนยันแล้วในระบบ จึงยังสั่งซื้อในแอปไม่ได้'),
    fl('ของที่ต้องการ', 'shop-item'), inp,
    s.includes?.length ? h('div.qchips', s.includes.map(x => h('button.qchip', { type: 'button', onclick: () => { inp.value = item = x; } }, x))) : ''),
    foot: [h('button.btn.ghost', { onclick: async () => {
      if (!item.trim()) return;
      await app.store.addTasks([{ title: 'ซื้อ ' + item.trim(), type: 'errand', due_date: today(), subject_name: 'ธุระและเอกสาร', source: 'shop' }]);
      closeModal(); toast(`เพิ่มในรายการซื้อของแล้ว${P()}`);
    } }, 'จดไว้ซื้อเอง'), h('button.btn.primary', { onclick: () => { closeModal(); familyAsk({ what: 'ช่วยซื้อ ' + item.trim() }); } }, 'ขอให้ลูกหลานซื้อ')] });
}

/* ---------- แถวคำขอ (ใช้ทุกหน้า) ---------- */
export function reqRow(r) {
  const c = catOf(r.cat) || catOf('living');
  return h('a.actrow', { href: '#req/' + r.id, style: { '--ct': c.tint, '--ci': c.ink } },
    h('span.ar-ic.req', { html: ic(svcOf(r.service_id)?.icon || 'clip') }),
    h('span.ar-tx', h('b', r.title), h('small', statusPill(r.status), ' ', [thaiDay(r.date), r.assignee_id ? 'ขอ ' + whoName(r.assignee_id) : ''].filter(Boolean).join(' · '), r.demo ? demoTag() : '')),
    h('span.sr-go', { html: ic('right') }));
}

/* ================= รายละเอียดคำขอ: สถานะ · ประวัติ · ยกเลิก · รีวิว ================= */
export function requestView(root, id) {
  const r = S().requests.find(x => x.id === id);
  if (!r) { put(root, pageHead('ไม่พบคำขอ', { back: 'activity' }), h('p.muted', 'คำขอนี้อาจถูกลบไปแล้ว')); return; }
  const s = svcOf(r.service_id), si = stepIndex(r.status), nx = nextStatus(r.status), fam = r.assignee_id;
  put(root, pageHead(r.title, { back: 'activity', sub: s ? s.name : '' }),
    r.demo ? h('p.demo-note', h('span', { html: ic('info') }), fam ? `บันทึกในเครื่องนี้ ยังไม่ได้ส่งถึง ${whoName(fam)} — โทรบอกด้วยตัวเอง` : 'เรื่องที่คุณติดตามเอง เมื่อหน่วยงานตอบกลับ กดอัปเดตสถานะด้านล่าง') : '',
    h('section.statusbox', h('div.sb-top', statusPill(r.status), h('small', `อัปเดต ${ago(r.updated_at)}`)),
      r.status === 'cancelled' ? '' : h('ol.stepper', REQ_STEPS.map(([k, v], i) => h('li' + (i < si ? '.done' : i === si ? '.now' : ''), h('i', i < si ? h('span', { html: ic('check') }) : String(i + 1)), h('span', fam && k === 'confirmed' ? 'รับเรื่องแล้ว' : v))))),
    h('dl.facts',
      h('div', h('dt', 'สำหรับ'), h('dd', whoName(r.for_id))),
      h('div', h('dt', 'บันทึกโดย'), h('dd', whoName(r.by_id))),
      fam ? h('div', h('dt', 'ผู้รับเรื่อง'), h('dd', whoName(fam))) : h('div', h('dt', 'หน่วยงาน'), h('dd', s?.provider?.name || '—')),
      h('div', h('dt', 'วันที่'), h('dd', `${thaiDay(r.date)} · ${SLOTS[r.slot] || ''}`)),
      r.phone ? h('div', h('dt', 'เบอร์หน่วยงาน'), h('dd', r.phone)) : '',
      s ? h('div', h('dt', 'ข้อมูลบริการ'), h('dd', h('a', { href: '#svc/' + s.id }, 'เปิดหน้าบริการ'))) : '',
      r.note ? h('div', h('dt', 'รายละเอียด'), h('dd', r.note)) : ''),
    fam && S().family.find(m => m.id === fam)?.phone ? h('a.btn.ghost.full', { href: 'tel:' + S().family.find(m => m.id === fam).phone, html: ic('phone') + `<span>โทรหา ${whoName(fam)} ${S().family.find(m => m.id === fam).phone}</span>` }) : '',
    r.status === 'done' ? reviewBox(r) : '',
    isActiveReq(r) ? h('div.reqacts',
      nx ? h('button.btn.primary', { onclick: async () => { await app.store.patchRequest(r.id, { status: nx }, `${r.title}: ${REQ_LABEL[nx]}`); toast(`อัปเดตเป็น "${REQ_LABEL[nx]}" แล้ว`); } },
        `อัปเดตสถานะเป็น: ${fam && nx === 'confirmed' ? 'รับเรื่องแล้ว' : REQ_LABEL[nx]}`) : '',
      h('button.btn.danger', { onclick: async () => {
        if (!await confirmBox({ title: `เลิกติดตาม "${r.title}"?`, body: 'ย้ายไปอยู่ในประวัติ', ok: 'เลิกติดตาม', cancel: 'เก็บไว้', danger: true })) return;
        await app.store.patchRequest(r.id, { status: 'cancelled' }, `ยกเลิก: ${r.title}`); toast('ย้ายไปประวัติแล้ว');
      } }, 'เลิกติดตาม')) : '',
    h('section.dsec', h('h2', 'ประวัติ'), h('ul.timeline', [...(r.history || [])].reverse().map(x => h('li', h('b', REQ_LABEL[x.status] || x.status), h('small', `${whoName(x.by)} · ${ago(x.at)}`))))),
    !isActiveReq(r) ? h('button.linkbtn', { onclick: async () => { if (await confirmBox({ title: 'ลบเรื่องนี้ออกจากเครื่อง?', ok: 'ลบ', danger: true })) { await app.store.removeRequest(r.id); go('activity'); } } }, 'ลบเรื่องนี้') : '');
}

function reviewBox(r) {
  if (r.review) return h('section.dsec', h('h2', 'รีวิวของคุณ'), h('p.stars', '★'.repeat(r.review.stars) + '☆'.repeat(5 - r.review.stars)), r.review.text ? h('p', r.review.text) : '');
  let stars = 0, text = '';
  const row = h('div.starpick', { role: 'radiogroup', 'aria-label': 'ให้คะแนน' });
  const paint = () => put(row, [1, 2, 3, 4, 5].map(n => h('button', { type: 'button', role: 'radio', 'aria-checked': String(n === stars), 'aria-label': `${n} ดาว`, class: n <= stars ? 'on' : '', onclick: () => { stars = n; paint(); } }, '★')));
  paint();
  return h('section.dsec.revbox', h('h2', 'บริการนี้เป็นอย่างไร'), h('p.muted', 'โน้ตส่วนตัว เก็บในเครื่องนี้ ช่วยให้ทีมดูแลจำได้ว่าบริการเป็นอย่างไร'), row,
    h('textarea.field', { rows: 2, maxlength: 300, placeholder: 'เล่าสั้น ๆ (ไม่บังคับ)', 'aria-label': 'ข้อความรีวิว', oninput: e => { text = e.target.value; } }),
    h('button.btn.primary.full', { onclick: async () => { if (!stars) return toast('แตะดาวเพื่อให้คะแนนก่อน'); await app.store.patchRequest(r.id, { review: { stars, text: text.trim(), at: new Date().toISOString() } }, `รีวิว: ${r.title}`); toast(`ขอบคุณสำหรับรีวิว${P()}`); } }, 'บันทึกรีวิว'));
}

/* ================= กิจกรรมของฉัน ================= */
const av = { tab: 'reminders' };
const TABS = { reminders: 'ยา นัด และงานดูแล', requests: 'เรื่องที่ติดตาม', history: 'ประวัติ' };
export function activityView(root, tab) {
  if (tab && TABS[tab]) av.tab = tab;
  const reqs = [...S().requests].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const active = reqs.filter(isActiveReq), past = reqs.filter(r => !isActiveReq(r));
  const body = h('div');
  put(root, pageHead('งานดูแล', { sub: 'ตารางยา นัดหมอ งานที่แบ่งให้ทีม และเรื่องที่กำลังยื่น' }),
    h('div.tabs', { role: 'tablist' }, Object.entries(TABS).map(([k, v]) => h('button', { role: 'tab', 'aria-selected': String(av.tab === k), onclick: () => { av.tab = k; activityView(root); } }, v,
      k === 'requests' && active.length ? h('em', String(active.length)) : ''))),
    body);
  if (av.tab === 'reminders') { tasksView(body, { embedded: true }); return; }
  if (av.tab === 'history') {
    put(body, past.length ? h('div.actlist', past.map(reqRow)) : h('div.emptybox', h('b', 'ยังไม่มีประวัติ'), h('p', 'เรื่องที่ปิดหรือเลิกติดตามแล้วจะอยู่ที่นี่')));
    return;
  }
  put(body, active.length ? h('div.actlist', active.map(reqRow))
    : h('div.emptybox', h('b', 'ยังไม่มีเรื่องที่ติดตาม'), h('p', 'เปิดบริการหรือสิทธิ แล้วกด "ติดตามเรื่องนี้" เช่น ยื่นผ้าอ้อมฟรี ขอยืมเตียง'), h('a.btn.primary.sm', { href: '#cat/benefits' }, 'ดูสิทธิและสวัสดิการ')),
    h('button.btn.ghost.full', { onclick: () => familyAsk(), html: ic('hand') + '<span>แบ่งงานให้คนในทีม</span>' }));
}

/* ================= การแจ้งเตือน / อัปเดต ================= */
export function notifView(root) {
  const list = [...S().notices].sort((a, b) => b.at.localeCompare(a.at));
  put(root, pageHead('การแจ้งเตือน', { back: 'home', sub: 'ความเคลื่อนไหวของงานดูแล ค่าสุขภาพที่ผิดปกติ และทีมดูแล' }),
    list.length ? [h('div.row2.notibar', h('button.btn.ghost', { onclick: async () => { await app.store.readAll(); toast('อ่านทั้งหมดแล้ว'); } }, 'อ่านทั้งหมดแล้ว'),
      h('button.btn.ghost', { onclick: async () => { if (await confirmBox({ title: 'ล้างการแจ้งเตือนทั้งหมด?', ok: 'ล้าง', danger: true })) app.store.clearNotices(); } }, 'ล้างทั้งหมด')),
      h('ul.feed.big', list.map(n => h('li.fitem' + (n.read ? '' : '.unread'), avatar(n.by || 'me', whoName(n.by)),
        h('div', h('b', n.title), h('small', [whoName(n.by), ago(n.at), n.body].filter(Boolean).join(' · ')),
          n.kind === 'request' && n.ref && S().requests.some(r => r.id === n.ref) ? h('a.more', { href: '#req/' + n.ref }, 'ดูเรื่อง') : ''))))]
      : h('div.emptybox', h('b', 'ยังไม่มีการแจ้งเตือน'), h('p', 'เมื่อให้ยา บันทึกค่าที่ผิดปกติ อัปเดตเรื่องที่ติดตาม หรือแจ้งเหตุ จะมีบันทึกที่นี่')));
}
