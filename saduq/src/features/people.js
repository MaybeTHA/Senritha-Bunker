// ผู้รับการดูแล: โปรไฟล์ (อายุ สิทธิ การเคลื่อนไหว ข้อมูลการแพทย์) · บันทึกสุขภาพ · สิทธิที่น่าจะใช้ได้ · การ์ดบนหน้าหลัก
import { h, ic, put, toast, openModal, closeModal, confirmBox } from '../ui/kit.js';
import { RELATIONS, RIGHTS, MOBILITY, benefitsFor, svcOf, catOf, CHECKED } from '../domain/catalog.js';
import { VKINDS, fmtVital, flagOf, validVital } from '../domain/vitals.js';
import { isOpen, typeOf } from '../domain/tasks.js';
import { app, S, today, ranked, dueLine } from './shared.js';
import { P, member, recipients, curPerson, forPerson, pageHead, secHead, avatar, ago, demoTag, go, goAfterModal, log, copy } from './common.js';
import { openReminder, finish } from './remind.js';
import { addTask } from './add.js';

export const MED = [['blood', 'กรุ๊ปเลือด'], ['conditions', 'โรคประจำตัว'], ['allergies', 'แพ้ยา/แพ้อาหาร'], ['meds', 'ยาที่ใช้ประจำ'], ['hospital', 'โรงพยาบาลประจำ / HN'], ['address', 'ที่อยู่ (บอกรถพยาบาล)']];
const DEFAULT_PERMS = { appts: true, requests: true, health: true, emergency: true, manage: true };

/* ---------- ข้อมูลรายวันของคนหนึ่งคน ---------- */
export const vitalsOf = (id, kind) => S().vitals.filter(v => v.for_id === id && (!kind || v.kind === kind)).sort((a, b) => b.at.localeCompare(a.at));
export function todayOf(id) {
  const td = today(), live = S().tasks.filter(t => !t.deleted_at && forPerson(t, id));
  const meds = live.filter(t => typeOf(t) === 'medicine' && t.due_date === td);
  const next = live.filter(t => isOpen(t) && typeOf(t) === 'appointment' && t.due_date && t.due_date >= td).sort((a, b) => (a.due_date + (a.due_time || '')).localeCompare(b.due_date + (b.due_time || '')))[0];
  const open = ranked().filter(t => forPerson(t, id) && t.due_date && t.due_date <= td);
  return { meds, medsDone: meds.filter(t => t.status === 'done').length, next, open };
}
const ageLine = m => [m.age ? `${m.age} ปี` : '', m.relation, MOBILITY[m.mobility]].filter(Boolean).join(' · ');
const flagEl = v => { const f = flagOf(v); return f ? h('span.vflag.' + f.level, f.text) : ''; };

/* ================= การ์ดบนหน้าหลัก ================= */
export function careBoard() {
  const rs = recipients();
  if (!rs.length) return h('section.careboard', secHead('ผู้ที่คุณดูแล'),
    h('div.emptybox.fam', h('span.eb-ic', { html: ic('userplus') }), h('div', h('b', 'เพิ่มผู้สูงอายุที่คุณดูแล'), h('p', 'ใส่อายุ สิทธิการรักษา และโรคประจำตัว แอปจะช่วยบอกสิทธิที่น่าจะได้ และจัดตารางยาให้')),
      h('button.btn.primary.sm', { onclick: () => personForm() }, 'เพิ่มผู้รับการดูแล')));
  return h('section.careboard', secHead('ผู้ที่คุณดูแล', ['ทีมดูแล', 'family']),
    h('div.pcards', rs.map(personCard), h('button.pcard.add', { onclick: () => personForm(), 'aria-label': 'เพิ่มผู้รับการดูแล' }, h('span', { html: ic('userplus') }), h('b', 'เพิ่มอีกคน'))));
}
function personCard(m) {
  const d = todayOf(m.id), bp = vitalsOf(m.id, 'bp')[0], cond = m.medinfo?.conditions;
  return h('article.pcard',
    h('a.pc-head', { href: '#person/' + m.id }, avatar(m.id, m.name, '.big'), h('div', h('b', m.name, m.sample ? demoTag() : ''), h('small', ageLine(m) || 'แตะเพื่อใส่ข้อมูล')), h('span.sr-go', { html: ic('right') })),
    cond ? h('p.pc-cond', h('span', { html: ic('info') }), cond) : '',
    h('div.pc-stats',
      h('div', h('small', 'ยาวันนี้'), h('b', d.meds.length ? `${d.medsDone}/${d.meds.length}` : '—'), d.meds.length && d.medsDone < d.meds.length ? h('em', `เหลือ ${d.meds.length - d.medsDone}`) : ''),
      h('div', h('small', 'นัดถัดไป'), h('b', d.next ? dueText(d.next) : '—')),
      h('div', h('small', 'ความดันล่าสุด'), h('b', bp ? fmtVital(bp) : '—'), bp ? flagEl(bp) || h('i', ago(bp.at)) : '')),
    h('div.pc-acts',
      h('button.btn.primary.sm', { onclick: () => vitalForm(m.id), html: ic('plus') + '<span>บันทึกค่า</span>' }),
      h('button.btn.ghost.sm', { onclick: () => addTask('text', '', { for_id: m.id }), html: ic('pill') + '<span>เพิ่มยา/นัด</span>' })));
}
const dueText = t => { const n = dueLine(t); return [].concat(n).map(x => x?.textContent ?? x).join(''); };

/** งานดูแลวันนี้ (ทุกคน) — ติ๊กทำแล้วได้ทันที */
export function todayCare() {
  const td = today(), list = ranked().filter(t => t.due_date && t.due_date <= td).slice(0, 6);
  const done = S().tasks.filter(t => !t.deleted_at && t.status === 'done' && t.due_date === td).length;
  return h('section', secHead('งานดูแลวันนี้', ['ตารางทั้งหมด', 'activity/reminders']),
    list.length ? h('div.actlist', list.map(careRow))
      : h('div.emptybox', h('b', done ? `ทำครบแล้ววันนี้ ${done} รายการ` : 'วันนี้ยังไม่มีงานดูแล'), h('p', 'เพิ่มยาหรือนัดหมอให้ผู้ที่คุณดูแล แอปจะรวมไว้ที่นี่')),
    h('div.quickadd', { role: 'group', 'aria-label': 'เพิ่มงานดูแลด่วน' },
      h('button.qa', { onclick: () => addTask('voice'), html: ic('mic') + '<span>พูด</span>' }),
      h('button.qa', { onclick: () => addTask('text'), html: ic('edit') + '<span>พิมพ์</span>' }),
      h('button.qa', { onclick: () => addTask('camera'), html: ic('camera') + '<span>ถ่ายใบนัด</span>' })));
}
export function careRow(t) {
  const who = t.for_id && member(t.for_id) && recipients().length > 1 ? member(t.for_id).name : '';
  return h('div.actrow.care',
    h('button.ar-chk', { 'aria-label': `ทำแล้ว: ${t.title}`, onclick: () => finish(t.id), html: ic('check') }),
    h('button.ar-tx', { onclick: () => openReminder(t.id) }, h('b', t.title), h('small', dueLine(t), who ? ` · ${who}` : '', t.source === 'sample' ? demoTag() : '')),
    h('span.ar-ic.sm.t-' + typeOf(t), { html: ic({ medicine: 'pill', appointment: 'steth', activity: 'spark', errand: 'bag' }[typeOf(t)] || 'bell') }));
}

/** สิทธิที่น่าจะใช้ได้ของคนนี้ */
export function benefitsBlock(m, { limit = 6, head = true } = {}) {
  const list = benefitsFor(m).slice(0, limit);
  if (!list.length) return head ? h('section', secHead(`สิทธิที่${m.name}น่าจะใช้ได้`), h('div.emptybox', h('p', 'ใส่อายุ สิทธิการรักษา และการเคลื่อนไหว เพื่อให้แอปช่วยหาสิทธิ'), h('button.btn.primary.sm', { onclick: () => personForm(m) }, 'ใส่ข้อมูล'))) : '';
  return h('section.benefits', head ? secHead(`สิทธิที่${m.name}น่าจะใช้ได้`, ['สิทธิทั้งหมด', 'cat/benefits']) : '',
    h('div.svclist', list.map(({ id, why }) => { const s = svcOf(id), c = catOf(s.cat);
      return h('a.svcrow.ben', { href: '#svc/' + id, style: { '--ct': c.tint, '--ci': c.ink } }, h('span.sr-ic', { html: ic(s.icon) }),
        h('span.sr-tx', h('b', s.name), h('small', why)), h('span.sr-go', { html: ic('right') })); })),
    h('p.srcnote', `เงื่อนไขจริงขึ้นกับหน่วยงาน · ตรวจ ${CHECKED}`));
}

/* ================= หน้าผู้รับการดูแล ================= */
export function personView(root, id) {
  const m = member(id) || curPerson();
  if (!m) { put(root, pageHead('ผู้รับการดูแล', { back: 'home' }), careBoard()); return; }
  if (S().prefs.cur_person !== m.id) app.store.setPref('cur_person', m.id, false);
  const d = todayOf(m.id), info = m.medinfo || {}, kinds = Object.keys(VKINDS);
  put(root, pageHead(m.name, { back: 'home', sub: ageLine(m) || 'ผู้รับการดูแล', right: h('button.chipbtn', { onclick: () => personForm(m), html: ic('edit') + '<span>แก้ไข</span>' }) }),
    m.sample ? h('p.demo-note', h('span', { html: ic('info') }), 'ข้อมูลตัวอย่าง — แก้เป็นข้อมูลจริง หรือลบได้ที่เมนู ฉัน → ข้อมูลตัวอย่าง') : '',
    h('div.pstrip',
      h('div', h('small', 'ยาวันนี้'), h('b', d.meds.length ? `${d.medsDone}/${d.meds.length}` : '—')),
      h('div', h('small', 'นัดถัดไป'), h('b', d.next ? dueText(d.next) : '—')),
      h('div', h('small', 'สิทธิรักษา'), h('b', RIGHTS[m.rights] || '—'))),
    h('section', secHead('งานดูแลของวันนี้'),
      d.open.length ? h('div.actlist', d.open.slice(0, 6).map(careRow)) : h('div.emptybox', h('p', 'ไม่มีงานค้างวันนี้')),
      h('button.btn.ghost.full', { onclick: () => addTask('text', '', { for_id: m.id }), html: ic('plus') + `<span>เพิ่มยา นัด หรืองานของ${m.name}</span>` })),
    h('section', secHead('บันทึกสุขภาพ'),
      h('div.vgrid', kinds.map(k => { const v = vitalsOf(m.id, k)[0];
        return h('button.vtile', { onclick: () => vitalForm(m.id, k) }, h('small', VKINDS[k].short), h('b', v ? fmtVital(v) : '—'), h('span', v ? [flagEl(v) || '', ' ', ago(v.at)] : VKINDS[k].unit)); })),
      vitalHistory(m.id)),
    benefitsBlock(m),
    h('section', secHead('ข้อมูลการแพทย์ (ใช้ตอนฉุกเฉิน)'),
      h('dl.facts.med', MED.map(([k, v]) => h('div', h('dt', v), h('dd', info[k] || h('span.muted', 'ยังไม่ได้ใส่'))))),
      h('div.row2', h('button.btn.ghost', { onclick: () => personForm(m, 'med'), html: ic('edit') + '<span>แก้ข้อมูลการแพทย์</span>' }),
        h('button.btn.ghost', { onclick: () => copy(medText(m)), html: ic('copy') + '<span>คัดลอกส่งหมอ</span>' }))),
    h('a.btn.sos.full', { href: '#emergency', html: ic('siren') + `<span>ฉุกเฉิน: โทร 1669 และเปิดข้อมูล${m.name}</span>` }));
}
export const medText = m => [`${m.name}${m.age ? ` อายุ ${m.age} ปี` : ''}`, ...MED.map(([k, v]) => m.medinfo?.[k] ? `${v}: ${m.medinfo[k]}` : '').filter(Boolean)].join('\n');

function vitalHistory(id) {
  const list = vitalsOf(id).slice(0, 8);
  if (!list.length) return h('p.muted', 'ยังไม่มีบันทึก แตะช่องด้านบนเพื่อจดค่าที่วัดได้');
  return h('ul.vlist', list.map(v => h('li', h('span.vk', VKINDS[v.kind].short), h('b', fmtVital(v), h('small', ' ' + VKINDS[v.kind].unit)), flagEl(v), h('small.vt', ago(v.at), v.note ? ` · ${v.note}` : ''),
    h('button.iconbtn.sm', { 'aria-label': 'ลบบันทึกนี้', html: ic('trash'), onclick: async () => { if (await confirmBox({ title: 'ลบบันทึกนี้?', ok: 'ลบ', danger: true })) app.store.removeVital(v.id); } }))));
}

/** จดค่าที่วัดได้ */
export function vitalForm(id, kind = 'bp') {
  const m = member(id); if (!m) return;
  const f = { kind, v1: '', v2: '', note: '' };
  const body = h('div.rform');
  const paint = () => {
    const K = VKINDS[f.kind];
    const n1 = h('input.field.big', { id: 'v1', type: 'number', inputmode: 'decimal', step: K.step || 1, value: f.v1, placeholder: K.two ? K.l1 : K.unit, 'aria-label': K.two ? K.l1 : K.name, oninput: e => { f.v1 = e.target.value; } });
    const n2 = K.two ? h('input.field.big', { id: 'v2', type: 'number', inputmode: 'numeric', value: f.v2, placeholder: K.l2, 'aria-label': K.l2, oninput: e => { f.v2 = e.target.value; } }) : null;
    put(body,
      h('div.qchips', { role: 'group', 'aria-label': 'ชนิด' }, Object.entries(VKINDS).map(([k, v]) => h('button.qchip', { type: 'button', 'aria-pressed': String(k === f.kind), onclick: () => { f.kind = k; f.v1 = f.v2 = ''; paint(); } }, v.short))),
      h('label.flabel', { for: 'v1' }, `${K.name} (${K.unit})`),
      K.two ? h('div.vpair', n1, h('span', '/'), n2) : n1,
      h('label.flabel', { for: 'vnote' }, 'หมายเหตุ (ไม่บังคับ)'),
      h('input.field', { id: 'vnote', maxlength: 80, value: f.note, placeholder: f.kind === 'sugar' ? 'เช่น ก่อนอาหารเช้า' : 'เช่น หลังตื่นนอน', oninput: e => { f.note = e.target.value; } }),
      h('p.muted', 'ป้าย "สูง/ต่ำกว่าค่าทั่วไป" ใช้เกณฑ์ผู้ใหญ่ทั่วไปเพื่อช่วยสังเกต ค่าเป้าหมายของแต่ละคนให้ถามแพทย์'));
    setTimeout(() => n1.focus(), 50);
  };
  paint();
  openModal({ title: `บันทึกค่า · ${m.name}`, body, isDirty: () => !!f.v1,
    foot: h('button.btn.primary', { onclick: async () => {
      if (!validVital(f.kind, f.v1, f.v2)) return toast(VKINDS[f.kind].two ? 'ใส่ตัวบนและตัวล่างให้ครบ (ตัวบนต้องมากกว่า)' : 'ใส่ค่าที่วัดได้ก่อน');
      const v = { for_id: id, kind: f.kind, v1: +f.v1, v2: VKINDS[f.kind].two ? +f.v2 : null, note: f.note.trim() };
      await app.store.addVital(v); closeModal(true);
      const fl = flagOf(v);
      if (fl) log(`${m.name}: ${VKINDS[f.kind].short} ${fmtVital(v)} (${fl.text})`, VKINDS[f.kind].unit, { kind: 'vital' });
      toast(fl ? `บันทึกแล้ว — ${fl.text} ควรสังเกตอาการ` : `บันทึกแล้ว${P()}`);
    } }, 'บันทึก') });
}

/** เพิ่ม/แก้ผู้รับการดูแล · section 'med' = เปิดที่ข้อมูลการแพทย์ */
export function personForm(m = null, section = '') {
  const f = m ? structuredClone(m) : { name: '', relation: 'แม่', role: 'senior', age: '', rights: 'ucs', mobility: 'walk', incont: false, bkk: false, phone: '', medinfo: {}, perms: { ...DEFAULT_PERMS } };
  f.medinfo ||= {};
  const body = h('div.rform');
  const chips = (opts, key) => h('div.qchips', opts.map(([k, v]) => h('button.qchip', { type: 'button', 'aria-pressed': String(f[key] === k), onclick: () => { f[key] = k; paint(); } }, v)));
  const name = h('input.field', { id: 'pf-name', maxlength: 40, value: f.name, placeholder: 'เช่น คุณแม่สมศรี', oninput: e => { f.name = e.target.value; } });
  const age = h('input.field', { id: 'pf-age', type: 'number', inputmode: 'numeric', min: 1, max: 120, value: f.age || '', placeholder: 'เช่น 72', oninput: e => { f.age = e.target.value; } });
  const phone = h('input.field', { id: 'pf-phone', type: 'tel', inputmode: 'tel', maxlength: 20, value: f.phone || '', placeholder: 'เบอร์ของผู้สูงอายุ (ถ้ามี)', oninput: e => { f.phone = e.target.value; } });
  const medFields = MED.map(([k, v]) => [h('label.flabel', { for: 'pm-' + k }, v), h('input.field', { id: 'pm-' + k, value: f.medinfo[k] || '', maxlength: 160, oninput: e => { f.medinfo[k] = e.target.value; } })]);
  const paint = () => put(body,
    h('label.flabel', { for: 'pf-name' }, 'ชื่อที่เรียก'), name,
    h('label.flabel', 'เป็นอะไรกับคุณ'), chips(RELATIONS.map(r => [r, r]), 'relation'),
    h('label.flabel', { for: 'pf-age' }, 'อายุ (ปี)'), age,
    h('label.flabel', 'สิทธิการรักษา'), chips(Object.entries(RIGHTS), 'rights'),
    h('label.flabel', 'การเคลื่อนไหว'), chips(Object.entries(MOBILITY), 'mobility'),
    h('div.perms',
      h('label.toggle', h('input', { type: 'checkbox', checked: !!f.incont, onchange: e => { f.incont = e.target.checked; } }), h('span', 'กลั้นปัสสาวะ/อุจจาระไม่ได้')),
      h('label.toggle', h('input', { type: 'checkbox', checked: !!f.bkk, onchange: e => { f.bkk = e.target.checked; } }), h('span', 'อาศัยอยู่ในกรุงเทพฯ (มีบริการเฉพาะ กทม.)'))),
    h('label.flabel', { for: 'pf-phone' }, 'เบอร์โทร'), phone,
    h('h3.fsec', { id: 'pf-med' }, 'ข้อมูลการแพทย์'), h('p.muted', 'เก็บในเครื่องนี้ ใช้บอกหมอหรือเจ้าหน้าที่ 1669'), medFields);
  paint();
  openModal({ title: m ? `แก้ไข ${m.name}` : 'เพิ่มผู้รับการดูแล', body, isDirty: () => !m && !!f.name.trim(),
    foot: [m ? h('button.btn.danger', { onclick: async () => {
      if (!await confirmBox({ title: `ลบ ${m.name}?`, body: 'บันทึกสุขภาพของคนนี้จะยังอยู่ในไฟล์สำรอง แต่จะไม่แสดงในแอป', ok: 'ลบ', danger: true })) return;
      await app.store.removeMember(m.id); closeModal(true); toast(`ลบ ${m.name} แล้ว`); goAfterModal('home');
    } }, 'ลบ') : '',
    h('button.btn.primary', { onclick: async () => {
      if (!f.name.trim()) return toast('ใส่ชื่อก่อน');
      const a = parseInt(f.age, 10);
      const saved = await app.store.saveMember({ ...f, role: 'senior', name: f.name.trim(), age: a > 0 && a < 121 ? a : null, phone: (f.phone || '').trim(), sample: m ? m.sample && f.name === m.name : false });
      if (!m) { log(`เพิ่ม ${saved.name} เป็นผู้รับการดูแล`, f.relation); await app.store.setPref('cur_person', saved.id, false); }
      closeModal(true); toast(m ? 'บันทึกแล้ว' : `เพิ่ม ${saved.name} แล้ว${P()}`);
      if (!m) goAfterModal('person/' + saved.id);
    } }, 'บันทึก')] });
  if (section === 'med') setTimeout(() => document.getElementById('pf-med')?.scrollIntoView({ block: 'start' }), 350);
  else if (!m) setTimeout(() => name.focus(), 300);
}
