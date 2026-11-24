// ทีมดูแล (ผู้รับการดูแล · คนช่วยดูแล · สิทธิ์การเห็นข้อมูล) · ฉุกเฉิน · โปรไฟล์ผู้ดูแล · ข้อมูลตัวอย่าง
import { h, ic, put, toast, openModal, closeModal, confirmBox } from '../ui/kit.js';
import { RELATIONS, PERMS, svcsIn, isActiveReq, CHECKED } from '../domain/catalog.js';
import { isOpen, typeOf } from '../domain/tasks.js';
import { app, S, ranked, dueLine } from './shared.js';
import { familyAsk, reqRow } from './care.js';
import { feedItem } from './hub.js';
import { openReminder } from './remind.js';
import { P, myName, members, whoName, pageHead, secHead, avatar, callBox, demoTag, log, go, copy, recipients, team, curPerson } from './common.js';
import { editName, toggleListen, exportData, restoreModal, privacyModal, subjectsModal } from './me.js';
import { MODES, listenMode } from './listen.js';
import { openOnboarding } from './onboard.js';
import { allPhotos } from '../domain/photos.js';
import { addSampleReviews, removeSampleReviews, hasSampleReviews } from './reviews.js';
import { personForm, MED, medText } from './people.js';

const TEAM_REL = ['พี่น้อง', 'ลูก', 'หลาน', 'คู่สมรส', 'ผู้ดูแลจ้าง', 'เพื่อนบ้าน', 'อาสาสมัคร/อสม.', 'อื่น ๆ'];
const DEFAULT_PERMS = { appts: true, requests: true, health: false, emergency: true, manage: false };
const PERM_SHORT = { appts: 'นัดหมาย', requests: 'เรื่องที่ติดตาม', health: 'ข้อมูลแพทย์', emergency: 'ฉุกเฉิน', manage: 'จัดการแทน' };

/* ================= ทีมดูแล ================= */
export function familyView(root) {
  const rs = recipients(), tm = team();
  const shared = S().requests.filter(r => isActiveReq(r) && r.assignee_id);
  put(root, pageHead('ทีมดูแล', { back: 'me', sub: 'ผู้สูงอายุที่คุณดูแล และคนที่ช่วยกันดูแล' }),
    h('section', secHead('ผู้รับการดูแล'),
      h('div.memlist', rs.map(m => h('a.memrow', { href: '#person/' + m.id }, avatar(m.id, m.name),
        h('div.mr-tx', h('b', m.name, m.sample ? demoTag() : ''), h('small', [m.age ? `${m.age} ปี` : '', m.relation, m.medinfo?.conditions].filter(Boolean).join(' · ') || 'ยังไม่ได้ใส่ข้อมูล')),
        h('span.sr-go', { html: ic('right') })))),
      h('button.btn.primary.full', { onclick: () => personForm(), html: ic('userplus') + '<span>เพิ่มผู้รับการดูแล</span>' })),
    h('section', secHead('คนในทีมดูแล'),
      h('div.memlist',
        h('div.memrow.me', avatar('me', myName() || 'ฉ'), h('div.mr-tx', h('b', whoName('me')), h('small', 'ผู้ดูแลหลัก (เจ้าของเครื่องนี้)')), h('a.chipbtn', { href: '#me' }, 'หน้าฉัน')),
        tm.map(m => h('button.memrow', { onclick: () => memberForm(m) }, avatar(m.id, m.name),
          h('div.mr-tx', h('b', m.name, m.sample ? demoTag() : ''), h('small', [m.relation, m.phone].filter(Boolean).join(' · ')),
            h('span.permline', Object.keys(PERMS).filter(k => m.perms?.[k]).map(k => h('i', { title: PERMS[k] }, PERM_SHORT[k])))),
          h('span.sr-go', { html: ic('edit') })))),
      h('button.btn.ghost.full', { onclick: () => memberForm(), html: ic('userplus') + '<span>เพิ่มคนในทีม</span>' })),
    h('section', secHead('งานที่แบ่งให้ทีม'),
      shared.length ? h('div.actlist', shared.map(reqRow)) : h('div.emptybox', h('p', 'ยังไม่ได้แบ่งงานให้ใคร')),
      h('button.btn.ghost.full', { onclick: () => familyAsk(), html: ic('hand') + '<span>แบ่งงานให้คนในทีม</span>' })),
    h('section', secHead('อัปเดตล่าสุด', ['ทั้งหมด', 'notif']),
      S().notices.length ? h('ul.feed', [...S().notices].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5).map(feedItem)) : h('div.emptybox', h('p', 'ยังไม่มีอัปเดต'))),
    h('div.conn', h('span', { html: ic('link') }), h('p', h('b', 'คนในทีมยังไม่เห็นข้อมูลบนมือถือของตัวเอง'), 'ตอนนี้ทุกอย่างอยู่ในเครื่องนี้ สิทธิ์ที่ตั้งไว้จะมีผลเมื่อเปิดระบบเชื่อมทีม — ระหว่างนี้ใช้ "คัดลอกส่งหมอ" หรือส่งไฟล์สำรองแทน')));
}

/** เพิ่ม/แก้คนในทีม (ไม่ใช่ผู้รับการดูแล — ผู้รับการดูแลใช้ personForm) */
export function memberForm(m = null) {
  if (m?.role === 'senior') return personForm(m);
  const f = m ? structuredClone(m) : { name: '', relation: 'พี่น้อง', role: 'family', phone: '', perms: { ...DEFAULT_PERMS } };
  const body = h('div.rform');
  const name = h('input.field', { id: 'mf-name', maxlength: 40, value: f.name, placeholder: 'เช่น พี่ต้น', oninput: e => { f.name = e.target.value; } });
  const phone = h('input.field', { id: 'mf-phone', type: 'tel', inputmode: 'tel', maxlength: 20, value: f.phone || '', placeholder: '08x-xxx-xxxx', oninput: e => { f.phone = e.target.value; } });
  const paint = () => put(body,
    h('label.flabel', { for: 'mf-name' }, 'ชื่อที่เรียก'), name,
    h('label.flabel', 'เป็นใคร'), h('div.qchips', TEAM_REL.map(r => h('button.qchip', { type: 'button', 'aria-pressed': String(f.relation === r), onclick: () => { f.relation = r; paint(); } }, r))),
    h('label.flabel', { for: 'mf-phone' }, 'เบอร์โทร'), phone,
    h('label.flabel', 'ให้คนนี้เห็นอะไรบ้าง'),
    h('div.perms', Object.entries(PERMS).map(([k, v]) => h('label.toggle', h('input', { type: 'checkbox', checked: !!f.perms[k], onchange: e => { f.perms[k] = e.target.checked; } }), h('span', v)))));
  paint();
  openModal({ title: m ? `แก้ไข ${m.name}` : 'เพิ่มคนในทีมดูแล', body, isDirty: () => !m && !!f.name.trim(),
    foot: [m ? h('button.btn.danger', { onclick: async () => {
      if (!await confirmBox({ title: `ลบ ${m.name} ออกจากทีม?`, body: 'งานเก่าที่แบ่งให้ยังอยู่', ok: 'ลบ', danger: true })) return;
      await app.store.removeMember(m.id); closeModal(); toast(`ลบ ${m.name} แล้ว`);
    } }, 'ลบ') : '',
    h('button.btn.primary', { onclick: async () => {
      if (!f.name.trim()) return toast('ใส่ชื่อก่อน');
      await app.store.saveMember({ ...f, role: 'family', name: f.name.trim(), phone: (f.phone || '').trim() });
      if (!m) log(`เพิ่ม ${f.name.trim()} เข้าทีมดูแล`, f.relation);
      closeModal(true); toast(m ? 'บันทึกแล้ว' : `เพิ่ม ${f.name.trim()} แล้ว${P()}`);
    } }, 'บันทึก')] });
  if (!m) setTimeout(() => name.focus(), 300);
}

/* ================= ฉุกเฉิน: เลือกคน → เบอร์ · ข้อมูลการแพทย์ใหญ่ ๆ ให้อ่านให้เจ้าหน้าที่ฟัง ================= */
const em = { id: null };
export function emergencyView(root) {
  const rs = recipients(), m = rs.find(x => x.id === em.id) || curPerson(), info = m?.medinfo || {};
  const ec = team().filter(x => x.perms?.emergency);
  put(root, pageHead('ฉุกเฉิน', { back: 'home', sub: 'ใช้หน้านี้ตอนผู้สูงอายุต้องการความช่วยเหลือด่วน' }),
    callBox('1669', 'เจ็บป่วยฉุกเฉิน · รถพยาบาล · ฟรี 24 ชม.', { danger: true }),
    h('p.tipline', 'บอกเจ้าหน้าที่: อาการ · ที่อยู่ · จุดสังเกต · อายุและโรคประจำตัว · เบอร์ติดต่อกลับ'),
    rs.length > 1 ? h('div.qchips', { role: 'group', 'aria-label': 'ใครเจ็บป่วย' }, rs.map(x => h('button.qchip', { type: 'button', 'aria-pressed': String(x.id === m?.id), onclick: () => { em.id = x.id; emergencyView(root); } }, x.name))) : '',
    m ? h('section.medcard', h('div.mc-h', h('b', `${m.name}${m.age ? ` · ${m.age} ปี` : ''}`), h('button.chipbtn', { onclick: () => copy(medText(m)), html: ic('copy') + '<span>คัดลอก</span>' })),
      h('dl.facts.med', MED.map(([k, v]) => h('div', h('dt', v), h('dd', info[k] || h('span.muted', 'ยังไม่ได้ใส่'))))),
      h('button.btn.ghost.full', { onclick: () => personForm(m, 'med'), html: ic('edit') + '<span>แก้ไขข้อมูลการแพทย์</span>' }))
      : h('div.emptybox', h('p', 'ยังไม่มีผู้รับการดูแล เพิ่มก่อนเพื่อเก็บข้อมูลการแพทย์ไว้บอกเจ้าหน้าที่'), h('button.btn.primary.sm', { onclick: () => personForm() }, 'เพิ่มผู้รับการดูแล')),
    h('section', secHead('แจ้งทีมดูแล'),
      ec.length ? [h('div.memlist', ec.map(x => h('div.memrow', avatar(x.id, x.name), h('div.mr-tx', h('b', x.name), h('small', x.phone || 'ยังไม่มีเบอร์')),
        x.phone ? h('a.btn.primary.sm', { href: 'tel:' + x.phone.replace(/[^\d+]/g, ''), html: ic('phone') + '<span>โทร</span>' }) : ''))),
        h('button.btn.sos.full', { onclick: () => alertFamily(m), html: ic('bell') + '<span>บันทึกแจ้งเหตุถึงทีม</span>' })]
        : h('div.emptybox', h('p', 'ยังไม่มีคนในทีมที่รับแจ้งเหตุ เพิ่มคนในทีมแล้วเปิด "รับแจ้งเหตุฉุกเฉิน"'), h('a.btn.primary.sm', { href: '#family' }, 'เพิ่มคนในทีม'))),
    h('section', secHead('เบอร์สำคัญ'), h('div.svclist', svcsIn('emergency').filter(s => s.provider?.phone).map(s =>
      h('div.numrow', h('div', h('b', s.name), h('small', s.short)), h('a.numbtn', { href: 'tel:' + s.provider.phone, 'aria-label': `โทร ${s.provider.phone}` }, s.provider.phone),
        h('button.iconbtn', { 'aria-label': `คัดลอก ${s.provider.phone}`, onclick: () => copy(s.provider.phone), html: ic('copy') }))))));
}
async function alertFamily(m) {
  const ec = team().filter(x => x.perms?.emergency);
  if (!await confirmBox({ title: 'บันทึกการแจ้งเหตุ?', body: `ระบบส่งข้อความถึงเครื่องคนในทีมยังไม่เปิด แอปจะบันทึกเหตุการณ์ไว้ และโชว์เบอร์ ${ec.map(x => x.name).join(', ')} ให้โทรทันที`, ok: 'บันทึกและโทร' })) return;
  await log(`แจ้งเหตุฉุกเฉิน${m ? `: ${m.name}` : ''}`, `ถึง ${ec.map(x => x.name).join(', ')}`, { kind: 'emergency' });
  toast(`บันทึกแล้ว${P()} กดปุ่ม "โทร" ข้างชื่อเพื่อติดต่อทันที`);
}

/* ================= โปรไฟล์ผู้ดูแล ================= */
const TONE = { krub: 'ครับ', ka: 'ค่ะ', none: 'ไม่ระบุ' };
export function applyScale() {}

export function profileView(root) {
  const s = S(), row = (icon, label, value, onclick, sub) => h('button.list-btn', { onclick }, h('span.mi', { html: ic(icon) }), h('span.lk', label, sub ? h('small', sub) : ''), value != null ? h('span.lv', value) : '', h('span.chev', { html: ic('right') }));
  const hasSamples = s.tasks.some(t => t.source === 'sample') || s.family.some(m => m.sample) || s.requests.some(r => r.sample) || s.vitals.some(v => v.sample) || hasSampleReviews();
  const rs = recipients();
  put(root, pageHead('ฉัน'),
    h('div.meline', avatar('me', myName() || 'ฉ', '.big'), h('div', h('b', myName() || 'ยังไม่ได้ตั้งชื่อ', S().prefs.name_sample ? demoTag() : ''), h('small', `ผู้ดูแล${rs.length ? ` · ดูแล ${rs.map(m => m.name).join(', ')}` : ''}`)), h('button.mename', { onclick: editName }, 'แก้ชื่อ')),
    h('a.famcard', { href: '#family' }, h('div.fc-av', s.family.slice(0, 4).map(m => avatar(m.id, m.name)), !s.family.length ? h('span.eb-ic', { html: ic('users') }) : ''),
      h('div.fc-tx', h('b', 'ทีมดูแล'), h('small', s.family.length ? `ผู้รับการดูแล ${rs.length} · คนในทีม ${team().length}` : 'เพิ่มผู้สูงอายุที่ดูแลและคนช่วยดูแล')), h('span.sr-go', { html: ic('right') })),
    h('a.famcard.sos', { href: '#emergency' }, h('span.eb-ic', { html: ic('siren') }), h('div.fc-tx', h('b', 'ฉุกเฉินและข้อมูลการแพทย์'), h('small', 'โทร 1669 · ข้อมูลไว้บอกเจ้าหน้าที่')), h('span.sr-go', { html: ic('right') })),
    h('a.famcard.care', { href: '#svc/e-1323' }, h('span.eb-ic', { html: ic('heart') }), h('div.fc-tx', h('b', 'ผู้ดูแลก็ต้องได้พัก'), h('small', 'เหนื่อยหรือเครียดจากการดูแล คุยได้ที่สายด่วน 1323 ฟรี 24 ชม.')), h('span.sr-go', { html: ic('right') })),
    h('section.dsec', h('h2', 'ให้แอปพูดลงท้ายว่า'), h('div.seg', Object.entries(TONE).map(([k, v]) => h('button', { 'aria-pressed': String((s.prefs.polite || 'none') === k), onclick: () => app.store.setPref('polite', k) }, v)))),
    h('div.mlist',
      row('book', 'หมวดงานดูแล', `${s.subjects.filter(x => !x.hidden).length} หมวด`, subjectsModal),
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
    h('p', 'ผู้ช่วยของ "ผู้ดูแลผู้สูงอายุ": จัดตารางยาและนัดหมอ บันทึกค่าสุขภาพ หาสิทธิรัฐที่ผู้สูงอายุน่าจะได้ เทียบสินค้าและอุปกรณ์ที่ขายจริง และแบ่งงานกันในทีมดูแล'),
    h('p.muted', `ข้อมูลบริการ สิทธิ และสินค้า มาจากหน่วยงานรัฐ ข่าว และหน้าร้านที่อ้างอิงได้ (ตรวจ ${CHECKED}) แต่ละรายการมีลิงก์แหล่งที่มา หลักเกณฑ์และราคาเปลี่ยนได้ โปรดตรวจสอบกับหน่วยงาน/ร้านก่อนเสมอ`),
    h('p.muted', 'Saduq ไม่ได้รับค่าตอบแทนจากร้านหรือผู้ให้บริการใด ข้อมูลทั้งหมดเก็บในเครื่องนี้ ยังไม่มีบัญชีหรือการซิงก์'),
    allPhotos().length ? [h('h3.credh', 'เครดิตภาพ (Wikimedia Commons)'), h('ul.credits', allPhotos().map(([, p]) => h('li', h('a', { href: p.page, target: '_blank', rel: 'noopener' }, p.title.replace(/^File:/, '')), ` — ${p.artist || 'ไม่ระบุผู้สร้าง'} · ${p.license}`)))] : '') });
}

/** ข้อมูลตัวอย่าง: ผู้รับการดูแล 1 คน + คนในทีม 1 คน + งานดูแล + ค่าความดัน + เรื่องที่ติดตาม — ติดป้าย "ตัวอย่าง" ลบได้ครั้งเดียว */
export async function toggleHubSamples(remove) {
  const st = app.store;
  if (remove) {
    if (!await confirmBox({ title: 'ลบข้อมูลตัวอย่าง?', body: 'ลบเฉพาะรายการที่ติดป้าย "ตัวอย่าง" ข้อมูลของคุณเองไม่หาย', ok: 'ลบข้อมูลตัวอย่าง', danger: true })) return;
    await st.removeSamples();
    for (const m of S().family.filter(m => m.sample)) await st.removeMember(m.id);
    for (const r of S().requests.filter(r => r.sample)) await st.removeRequest(r.id);
    await removeSampleReviews();
    return toast('ลบข้อมูลตัวอย่างแล้ว');
  }
  await addHubSamples();
  toast('ใส่ข้อมูลตัวอย่างแล้ว ทุกชิ้นมีป้าย "ตัวอย่าง"');
}
export async function addHubSamples() {
  const st = app.store, d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const hrs = n => new Date(Date.now() - n * 3600e3).toISOString();
  const mom = await st.saveMember({ name: 'คุณแม่สมศรี', relation: 'แม่', role: 'senior', age: 78, rights: 'ucs', mobility: 'assist', incont: false, bkk: true, phone: '', sample: true,
    medinfo: { blood: 'O', conditions: 'ความดันสูง เบาหวาน', allergies: 'แพ้ยาซัลฟา', meds: 'ยาความดันเช้า 1 เม็ด · ยาเบาหวานก่อนนอน', hospital: 'รพ.ตัวอย่าง HN 000000', address: '' },
    perms: { appts: true, requests: true, health: true, emergency: true, manage: true } });
  await st.saveMember({ name: 'พี่ต้น', relation: 'พี่น้อง', role: 'family', phone: '', sample: true, perms: { appts: true, requests: true, health: true, emergency: true, manage: false } });
  if (!S().tasks.some(t => t.source === 'sample')) await st.addSamples(mom.id);
  for (const [v1, v2, h0] of [[138, 86, 2], [146, 92, 26], [132, 84, 50]]) await st.addVital({ for_id: mom.id, kind: 'bp', v1, v2, note: 'หลังตื่นนอน', at: hrs(h0), sample: true });
  await st.addVital({ for_id: mom.id, kind: 'sugar', v1: 124, v2: null, note: 'ก่อนอาหารเช้า', at: hrs(3), sample: true });
  await st.addRequest({ service_id: 'l-loan', cat: 'living', title: 'ยืมวีลแชร์ (Fa-Equipment)', for_id: mom.id, by_id: 'me', date: d(2), slot: 'morning', note: 'นักสังคมสงเคราะห์จะโทรกลับเพื่อนัดประเมิน', sample: true });
  await addSampleReviews();
  await st.setPref('cur_person', mom.id);
}
