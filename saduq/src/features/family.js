// ครอบครัว (สมาชิก · สิทธิ์การเห็นข้อมูล · งานดูแลร่วมกัน) · ฉุกเฉิน · โปรไฟล์
import { h, ic, put, toast, openModal, closeModal, confirmBox } from '../ui/kit.js';
import { RELATIONS, PERMS, svcsIn, isActiveReq } from '../domain/catalog.js';
import { isOpen, typeOf } from '../domain/tasks.js';
import { app, S, ranked, dueLine } from './shared.js';
import { familyAsk, reqRow } from './care.js';
import { feedItem } from './hub.js';
import { openReminder } from './remind.js';
import { P, role, myName, members, whoName, pageHead, secHead, avatar, callBox, demoTag, log, go, copy } from './common.js';
import { editName, toggleListen, toggleSamples, exportData, restoreModal, privacyModal, subjectsModal } from './me.js';
import { MODES, listenMode } from './listen.js';
import { openOnboarding } from './onboard.js';
import { allPhotos } from '../domain/photos.js';

const ROLE = { senior: 'ผู้สูงอายุ (รับการดูแล)', family: 'ลูกหลาน / ผู้ดูแล' };
const DEFAULT_PERMS = { appts: true, requests: true, health: false, emergency: true, manage: false };

/* ================= ครอบครัว ================= */
export function familyView(root) {
  const ms = members(), seniors = ms.filter(m => m.role === 'senior');
  const shared = S().requests.filter(r => isActiveReq(r) && (r.assignee_id || r.for_id !== 'me' || r.by_id !== 'me'));
  const appts = ranked().filter(t => ['appointment', 'medicine'].includes(typeOf(t))).slice(0, 4);
  put(root, pageHead('ครอบครัว', { back: 'me', sub: 'คนที่ดูแลกันและกัน และสิ่งที่แชร์ให้เห็น' }),
    h('div.conn', h('span', { html: ic('link') }), h('p', h('b', 'สมาชิกยังไม่เห็นข้อมูลบนมือถือของตัวเอง'), 'ตอนนี้ทุกอย่างอยู่ในเครื่องนี้ สิทธิ์ที่ตั้งไว้จะมีผลเมื่อเปิดระบบเชื่อมครอบครัว')),
    h('section', secHead('สมาชิก'),
      h('div.memlist',
        h('div.memrow.me', avatar('me', myName() || 'ฉ'), h('div.mr-tx', h('b', whoName('me')), h('small', ROLE[role()])), h('a.chipbtn', { href: '#me' }, 'หน้าฉัน')),
        ms.map(m => h('button.memrow', { onclick: () => memberForm(m) }, avatar(m.id, m.name),
          h('div.mr-tx', h('b', m.name, m.sample ? demoTag() : ''), h('small', [m.relation, ROLE[m.role]?.split(' ')[0], m.phone].filter(Boolean).join(' · ')),
            h('span.permline', Object.entries(PERMS).filter(([k]) => m.perms?.[k]).map(([k, v]) => h('i', { title: v }, { appts: 'นัดหมาย', requests: 'คำขอ', health: 'ข้อมูลแพทย์', emergency: 'ฉุกเฉิน', manage: 'ขอแทนได้' }[k])))),
          h('span.sr-go', { html: ic('edit') })))),
      h('button.btn.primary.full', { onclick: () => memberForm(), html: ic('userplus') + '<span>เพิ่มสมาชิกครอบครัว</span>' })),
    h('section', secHead('นัดหมายและยาที่ใกล้ถึง', ['ดูตาราง', 'activity/reminders']),
      appts.length ? h('div.actlist', appts.map(t => h('button.actrow', { onclick: () => openReminder(t.id) }, h('span.ar-ic.t-' + typeOf(t), { html: ic(typeOf(t) === 'medicine' ? 'pill' : 'steth') }),
        h('span.ar-tx', h('b', t.title), h('small', dueLine(t))), h('span.sharedto', sharedNames('appts')))))
        : h('div.emptybox', h('p', 'ยังไม่มีนัดหมอหรือการเตือนกินยา'))),
    h('section', secHead('ขอความช่วยเหลือกันในครอบครัว'),
      shared.length ? h('div.actlist', shared.map(reqRow)) : h('div.emptybox', h('p', 'ยังไม่มีเรื่องที่ขอให้คนในครอบครัวช่วย')),
      h('button.btn.ghost.full', { onclick: () => familyAsk(), html: ic('hand') + '<span>ขอให้ลูกหลานช่วย</span>' })),
    h('section', secHead('อัปเดตล่าสุด', ['ทั้งหมด', 'notif']),
      S().notices.length ? h('ul.feed', [...S().notices].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5).map(feedItem)) : h('div.emptybox', h('p', 'ยังไม่มีอัปเดต'))),
    h('section.privacy', h('h2', h('span', { html: ic('lock') }), 'ความเป็นส่วนตัว'),
      h('p', 'แต่ละคนเห็นเฉพาะเรื่องที่คุณเปิดให้ แตะชื่อสมาชิกเพื่อเปลี่ยนสิทธิ์ ข้อมูลการแพทย์ปิดไว้เป็นค่าเริ่มต้น'),
      seniors.length ? h('p.muted', `ผู้สูงอายุในความดูแล: ${seniors.map(m => m.name).join(', ')}`) : ''));
}
const sharedNames = perm => { const n = members().filter(m => m.perms?.[perm]); return n.length ? `แชร์ให้ ${n.map(m => m.name).join(', ')}` : 'ไม่ได้แชร์'; };

export function memberForm(m = null) {
  const f = m ? structuredClone(m) : { name: '', relation: 'ลูก', role: role() === 'family' ? 'senior' : 'family', phone: '', perms: { ...DEFAULT_PERMS } };
  const body = h('div.rform');
  const name = h('input.field', { id: 'mf-name', maxlength: 40, value: f.name, placeholder: 'เช่น น้องเมย์', oninput: e => { f.name = e.target.value; } });
  const phone = h('input.field', { id: 'mf-phone', type: 'tel', inputmode: 'tel', maxlength: 20, value: f.phone || '', placeholder: '08x-xxx-xxxx', oninput: e => { f.phone = e.target.value; } });
  const paint = () => put(body,
    h('label.flabel', { for: 'mf-name' }, 'ชื่อที่เรียก'), name,
    h('label.flabel', 'ความสัมพันธ์'), h('div.qchips', RELATIONS.map(r => h('button.qchip', { type: 'button', 'aria-pressed': String(f.relation === r), onclick: () => { f.relation = r; paint(); } }, r))),
    h('label.flabel', 'บทบาท'), h('div.qchips', Object.entries(ROLE).map(([k, v]) => h('button.qchip', { type: 'button', 'aria-pressed': String(f.role === k), onclick: () => { f.role = k; paint(); } }, v))),
    h('label.flabel', { for: 'mf-phone' }, 'เบอร์โทร'), phone,
    h('label.flabel', 'ให้คนนี้เห็นอะไรบ้าง'),
    h('div.perms', Object.entries(PERMS).map(([k, v]) => h('label.toggle', h('input', { type: 'checkbox', checked: !!f.perms[k], onchange: e => { f.perms[k] = e.target.checked; } }), h('span', v)))));
  paint();
  openModal({ title: m ? `แก้ไข ${m.name}` : 'เพิ่มสมาชิกครอบครัว', body, isDirty: () => !m && !!f.name.trim(),
    foot: [m ? h('button.btn.danger', { onclick: async () => {
      if (!await confirmBox({ title: `ลบ ${m.name} ออกจากครอบครัว?`, body: 'คำขอเก่าที่เกี่ยวข้องยังอยู่', ok: 'ลบ', danger: true })) return;
      await app.store.removeMember(m.id); closeModal(); toast(`ลบ ${m.name} แล้ว`);
    } }, 'ลบ') : '',
    h('button.btn.primary', { onclick: async () => {
      if (!f.name.trim()) return toast('ใส่ชื่อก่อน');
      await app.store.saveMember({ ...f, name: f.name.trim(), phone: (f.phone || '').trim() });
      if (!m) log(`เพิ่ม ${f.name.trim()} เข้าครอบครัว`, f.relation);
      closeModal(true); toast(m ? 'บันทึกแล้ว' : `เพิ่ม ${f.name.trim()} แล้ว${P()}`);
    } }, 'บันทึก')] });
  if (!m) setTimeout(() => name.focus(), 300);
}

/* ================= ฉุกเฉิน ================= */
const MED = [['blood', 'กรุ๊ปเลือด'], ['conditions', 'โรคประจำตัว'], ['allergies', 'แพ้ยา/แพ้อาหาร'], ['meds', 'ยาที่ใช้ประจำ'], ['hospital', 'โรงพยาบาลประจำ'], ['address', 'ที่อยู่ (บอกรถพยาบาล)']];
export function emergencyView(root) {
  const info = S().prefs.medinfo || {}, ec = members().filter(m => m.perms?.emergency);
  put(root, pageHead('ฉุกเฉิน', { back: 'home', sub: 'ใช้หน้านี้ตอนต้องการความช่วยเหลือด่วน' }),
    callBox('1669', 'เจ็บป่วยฉุกเฉิน · รถพยาบาล · ฟรี 24 ชม.', { danger: true }),
    h('p.tipline', 'บอกเจ้าหน้าที่: อาการ · ที่อยู่ · จุดสังเกต · เบอร์ติดต่อกลับ'),
    h('section', secHead('แจ้งครอบครัว'),
      ec.length ? [h('div.memlist', ec.map(m => h('div.memrow', avatar(m.id, m.name), h('div.mr-tx', h('b', m.name), h('small', m.phone || 'ยังไม่มีเบอร์')),
        m.phone ? h('a.btn.primary.sm', { href: 'tel:' + m.phone.replace(/[^\d+]/g, ''), html: ic('phone') + '<span>โทร</span>' }) : ''))),
        h('button.btn.sos.full', { onclick: alertFamily, html: ic('bell') + '<span>บันทึกแจ้งเหตุถึงครอบครัว</span>' })]
        : h('div.emptybox', h('p', 'ยังไม่มีผู้ติดต่อฉุกเฉิน เพิ่มสมาชิกครอบครัวแล้วเปิด "รับแจ้งเหตุฉุกเฉิน"'), h('a.btn.primary.sm', { href: '#family' }, 'เพิ่มผู้ติดต่อ'))),
    h('section', secHead('ข้อมูลการแพทย์ของฉัน'),
      h('dl.facts.med', MED.map(([k, v]) => h('div', h('dt', v), h('dd', info[k] || h('span.muted', 'ยังไม่ได้ใส่'))))),
      h('button.btn.ghost.full', { onclick: editMedInfo, html: ic('edit') + '<span>แก้ไขข้อมูลการแพทย์</span>' })),
    h('section', secHead('เบอร์สำคัญ'), h('div.svclist', svcsIn('emergency').filter(s => s.provider?.phone).map(s =>
      h('div.numrow', h('div', h('b', s.name), h('small', s.short)), h('a.numbtn', { href: 'tel:' + s.provider.phone, 'aria-label': `โทร ${s.provider.phone}` }, s.provider.phone),
        h('button.iconbtn', { 'aria-label': `คัดลอก ${s.provider.phone}`, onclick: () => copy(s.provider.phone), html: ic('copy') }))))));
}
async function alertFamily() {
  const ec = members().filter(m => m.perms?.emergency);
  if (!await confirmBox({ title: 'บันทึกการแจ้งเหตุ?', body: `ระบบส่งข้อความถึงเครื่องสมาชิกยังไม่เปิด แอปจะบันทึกเหตุการณ์ไว้ และโชว์เบอร์ ${ec.map(m => m.name).join(', ')} ให้โทรทันที`, ok: 'บันทึกและโทร' })) return;
  await log('แจ้งเหตุฉุกเฉิน', `ถึง ${ec.map(m => m.name).join(', ')}`, { kind: 'emergency' });
  toast(`บันทึกแล้ว${P()} กดปุ่ม "โทร" ข้างชื่อเพื่อติดต่อทันที`);
}
function editMedInfo() {
  const info = { ...(S().prefs.medinfo || {}) };
  openModal({ title: 'ข้อมูลการแพทย์', body: h('div.rform', h('p.muted', 'เก็บในเครื่องนี้ ใช้บอกหมอหรือเจ้าหน้าที่ตอนฉุกเฉิน'),
    MED.map(([k, v]) => [h('label.flabel', { for: 'med-' + k }, v), h('input.field', { id: 'med-' + k, value: info[k] || '', maxlength: 120, oninput: e => { info[k] = e.target.value; } })])),
    foot: h('button.btn.primary', { onclick: async () => { await app.store.setPref('medinfo', info); closeModal(true); toast('บันทึกแล้ว'); } }, 'บันทึก') });
}

/* ================= โปรไฟล์ ================= */
const TONE = { krub: 'ครับ', ka: 'ค่ะ', none: 'ไม่ระบุ' };
/** ขนาดตัวอักษรคงที่ (ไม่มีตัวเลือก) — ตั้งไว้ใหญ่พออ่านง่ายสำหรับผู้สูงวัยแล้ว */
export function applyScale() {}

export function profileView(root) {
  const s = S(), row = (icon, label, value, onclick, sub) => h('button.list-btn', { onclick }, h('span.mi', { html: ic(icon) }), h('span.lk', label, sub ? h('small', sub) : ''), value != null ? h('span.lv', value) : '', h('span.chev', { html: ic('right') }));
  const hasSamples = s.tasks.some(t => t.source === 'sample') || s.family.some(m => m.sample) || s.requests.some(r => r.sample);
  put(root, pageHead('ฉัน'),
    h('div.meline', avatar('me', myName() || 'ฉ', '.big'), h('div', h('b', myName() || 'ยังไม่ได้ตั้งชื่อ', S().prefs.name_sample ? demoTag() : ''), h('small', ROLE[role()])), h('button.mename', { onclick: editName }, 'แก้ชื่อ')),
    h('a.famcard', { href: '#family' }, h('div.fc-av', s.family.slice(0, 4).map(m => avatar(m.id, m.name)), !s.family.length ? h('span.eb-ic', { html: ic('users') }) : ''),
      h('div.fc-tx', h('b', 'ครอบครัวและผู้ดูแล'), h('small', s.family.length ? `${s.family.length} คน · ตั้งค่าการแชร์ข้อมูล` : 'เพิ่มลูกหลานหรือผู้ดูแล')), h('span.sr-go', { html: ic('right') })),
    h('a.famcard.sos', { href: '#emergency' }, h('span.eb-ic', { html: ic('siren') }), h('div.fc-tx', h('b', 'ฉุกเฉินและข้อมูลการแพทย์'), h('small', 'โทร 1669 · ผู้ติดต่อฉุกเฉิน')), h('span.sr-go', { html: ic('right') })),
    h('section.dsec', h('h2', 'ให้แอปพูดลงท้ายว่า'), h('div.seg', Object.entries(TONE).map(([k, v]) => h('button', { 'aria-pressed': String((s.prefs.polite || 'none') === k), onclick: () => app.store.setPref('polite', k) }, v)))),
    h('section.dsec', h('h2', 'ฉันใช้แอปในฐานะ'), h('div.seg.stack', Object.entries(ROLE).map(([k, v]) => h('button', { 'aria-pressed': String(role() === k), onclick: () => app.store.setPref('role', k) }, v)))),
    h('div.mlist',
      row('book', 'หมวดการเตือน', `${s.subjects.filter(x => !x.hidden).length} หมวด`, subjectsModal),
      row('mic', 'ปุ่มพูด เริ่มที่', MODES[listenMode()], toggleListen),
      row('spark', 'ข้อมูลตัวอย่าง', hasSamples ? 'ลบออก' : 'ลองใส่', () => toggleHubSamples(hasSamples)),
      row('reset', 'ตั้งค่าเริ่มต้นใหม่', null, () => openOnboarding({ redo: true }))),
    h('div.mlist',
      row('save', 'สำรองข้อมูล', 'ไฟล์ JSON', exportData),
      row('restore', 'กู้คืนจากไฟล์สำรอง', null, restoreModal),
      row('lock', 'ข้อมูลและความเป็นส่วนตัว', s.dbKind === 'indexeddb' ? 'เก็บในเครื่อง' : 'ชั่วคราว', privacyModal),
      row('info', 'ช่วยเหลือและเกี่ยวกับ Saduq', `รุ่น ${globalThis.SABAII_VERSION || ''}`, aboutModal)));
}
function aboutModal() {
  openModal({ title: 'เกี่ยวกับ Saduq', body: h('div',
    h('p', 'ศูนย์รวมบริการสำหรับผู้สูงอายุและครอบครัว: สุขภาพ ช่วยงานบ้าน ซื้อของ กิจกรรม สิทธิรัฐ และเหตุฉุกเฉิน ในแอปเดียว'),
    h('p.muted', 'รุ่นนี้ทำงานในเครื่องเท่านั้น ยังไม่มีผู้ให้บริการที่ยืนยันแล้ว การจองและคำขอเป็นโหมดตัวอย่าง ส่วนการเตือน ข้อมูลครอบครัว และเบอร์สายด่วนใช้ได้จริง'),
    h('p.muted', 'ข้อมูลสิทธิและสายด่วนเป็นข้อมูลทั่วไปจากหน่วยงานรัฐ โปรดตรวจสอบเงื่อนไขล่าสุดกับหน่วยงานโดยตรง'),
    allPhotos().length ? [h('h3.credh', 'เครดิตภาพ (Wikimedia Commons)'), h('ul.credits', allPhotos().map(([, p]) => h('li', h('a', { href: p.page, target: '_blank', rel: 'noopener' }, p.title.replace(/^File:/, '')), ` — ${p.artist || 'ไม่ระบุผู้สร้าง'} · ${p.license}`)))] : '') });
}

/** ข้อมูลตัวอย่าง: การเตือน + สมาชิก 2 คน + คำขอ 1 รายการ — ติดป้าย "ตัวอย่าง" ทุกชิ้น ลบได้ในครั้งเดียว */
export async function toggleHubSamples(remove) {
  const st = app.store;
  if (remove) {
    if (!await confirmBox({ title: 'ลบข้อมูลตัวอย่าง?', body: 'ลบเฉพาะรายการที่ติดป้าย "ตัวอย่าง" ข้อมูลของคุณเองไม่หาย', ok: 'ลบข้อมูลตัวอย่าง', danger: true })) return;
    await st.removeSamples();
    for (const m of S().family.filter(m => m.sample)) await st.removeMember(m.id);
    for (const r of S().requests.filter(r => r.sample)) await st.removeRequest(r.id);
    return toast('ลบข้อมูลตัวอย่างแล้ว');
  }
  await addHubSamples();
  toast('ใส่ข้อมูลตัวอย่างแล้ว ทุกชิ้นมีป้าย "ตัวอย่าง"');
}
export async function addHubSamples() {
  const st = app.store, d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  if (!S().tasks.some(t => t.source === 'sample')) await st.addSamples();
  const sr = role() === 'family';
  const a = await st.saveMember({ name: sr ? 'คุณแม่' : 'ลูกสาว', relation: sr ? 'อื่น ๆ' : 'ลูก', role: sr ? 'senior' : 'family', phone: '', sample: true, perms: { appts: true, requests: true, health: true, emergency: true, manage: true } });
  await st.saveMember({ name: 'หลานชาย', relation: 'หลาน', role: 'family', phone: '', sample: true, perms: { appts: true, requests: false, health: false, emergency: true, manage: false } });
  await st.addRequest({ service_id: 'l-ride', cat: 'living', title: 'รถรับส่ง', for_id: sr ? a.id : 'me', by_id: 'me', date: d(3), slot: 'morning', note: 'ไปนัดหมอตรวจเบาหวาน ต้องการรถเข็น', sample: true });
}
