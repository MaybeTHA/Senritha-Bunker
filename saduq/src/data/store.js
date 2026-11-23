// สถานะของแอปทั้งหมด + การบันทึกลงเครื่อง · จอทุกจออ่านจากที่นี่ที่เดียว
import { makeTask, updateTask, newId, isLive } from '../domain/tasks.js';
import { toYMD } from '../domain/dates.js';

export const SUBJECT_COLORS = ['#1769D2', '#E45465', '#16B76A', '#F4A340', '#8B5CF6', '#0EA5B7', '#D9468F', '#64748B'];

// วิชาตั้งต้น — ลบ/ซ่อน/เปลี่ยนชื่อได้ทั้งหมดในหน้า "ฉัน"
// หมวดการเตือน (เดิมคือ "วิชา") — ลบ/ซ่อน/เปลี่ยนชื่อได้ในหน้าโปรไฟล์
export const DEFAULT_SUBJECTS = [
  ['ยาและสุขภาพ', ['ยา', 'สุขภาพ', 'ความดัน', 'เบาหวาน']],
  ['นัดหมอ', ['หมอ', 'โรงพยาบาล', 'คลินิก', 'รพ']],
  ['กิจกรรม', ['ชมรม', 'ออกกำลัง', 'วัด']],
  ['ครอบครัว', ['ลูก', 'หลาน', 'บ้าน']],
  ['ธุระและเอกสาร', ['ธุระ', 'ธนาคาร', 'เอกสาร', 'ซื้อของ']],
];

export function createStore(db, { now = () => new Date() } = {}) {
  const state = { tasks: [], subjects: [], attachments: [], prefs: {}, requests: [], family: [], notices: [], dbKind: db.kind };
  const listeners = new Set();
  const iso = () => now().toISOString();
  const emit = () => listeners.forEach(fn => fn(state));

  async function load() {
    [state.tasks, state.subjects, state.attachments, state.requests, state.family, state.notices] = await Promise.all(['tasks', 'subjects', 'attachments', 'requests', 'family', 'notices'].map(n => db.all(n)));
    state.prefs = Object.fromEntries((await db.all('prefs')).map(p => [p.key, p.value]));
    if (!state.prefs.seeded) {
      for (const [i, [name, aliases]] of DEFAULT_SUBJECTS.entries()) {
        await putSubject({ id: newId('s'), name, aliases, color: SUBJECT_COLORS[i % SUBJECT_COLORS.length], order: i, hidden: false, created_at: iso() }, false);
      }
      await setPref('seeded', true, false);
    }
    // งานที่ลบแล้วเกิน 30 วัน ลบทิ้งจริง (ช่วงกู้คืนหมดแล้ว)
    const cutoff = now().getTime() - 30 * 86400000;
    for (const t of state.tasks.filter(t => t.deleted_at && Date.parse(t.deleted_at) < cutoff)) await purgeTask(t.id, false);
    emit();
    return state;
  }

  async function putTask(t, notify = true) {
    await db.put('tasks', t);
    const i = state.tasks.findIndex(x => x.id === t.id);
    if (i >= 0) state.tasks[i] = t; else state.tasks.push(t);
    if (notify) emit();
    return t;
  }
  async function putSubject(s, notify = true) {
    await db.put('subjects', s);
    const i = state.subjects.findIndex(x => x.id === s.id);
    if (i >= 0) state.subjects[i] = s; else state.subjects.push(s);
    if (notify) emit();
    return s;
  }
  async function setPref(key, value, notify = true) {
    await db.put('prefs', { key, value });
    state.prefs[key] = value;
    if (notify) emit();
  }

  /** บันทึกร่างงานหลายชิ้นพร้อมกัน — กันซ้ำด้วย draft_key (กดบันทึกสองทีต้องไม่ได้งานสองชุด) */
  async function addTasks(drafts) {
    const saved = [];
    for (const d of drafts) {
      if (d.draft_key && state.tasks.some(t => t.draft_key === d.draft_key && isLive(t))) continue;
      let subject_id = d.subject_id || null;
      if (!subject_id && d.subject_name) subject_id = (await ensureSubject(d.subject_name)).id;
      const t = makeTask({ ...d, subject_id }, iso());
      if (d.draft_key) t.draft_key = d.draft_key;
      saved.push(await putTask(t, false));
    }
    emit();
    return saved;
  }
  async function ensureSubject(name) {
    const clean = String(name).trim();
    const found = state.subjects.find(s => s.name === clean);
    if (found) return found;
    const order = state.subjects.length;
    return putSubject({ id: newId('s'), name: clean, aliases: [], color: SUBJECT_COLORS[order % SUBJECT_COLORS.length], order, hidden: false, created_at: iso() }, false);
  }
  async function patchTask(id, patch) {
    const t = state.tasks.find(x => x.id === id);
    if (!t) throw new Error('ไม่พบงาน');
    return putTask(updateTask(t, patch, iso()));
  }
  const removeTask = id => patchTask(id, { deleted_at: iso() });
  const restoreTask = id => patchTask(id, { deleted_at: null });
  async function purgeTask(id, notify = true) {
    for (const a of state.attachments.filter(a => a.task_id === id)) await removeAttachment(a.id, false);
    await db.del('tasks', id);
    state.tasks = state.tasks.filter(t => t.id !== id);
    if (notify) emit();
  }

  async function addAttachment(task_id, { kind, blob = null, text = '', mime_type = '', size = 0 }) {
    const a = { id: newId('a'), task_id, kind, blob, text, mime_type, size, created_at: iso() };
    await db.put('attachments', a);
    state.attachments.push(a);
    emit();
    return a;
  }
  async function removeAttachment(id, notify = true) {
    await db.del('attachments', id);
    state.attachments = state.attachments.filter(a => a.id !== id);
    if (notify) emit();
  }

  const updateSubject = (id, patch) => putSubject({ ...state.subjects.find(s => s.id === id), ...patch });
  /** ลบวิชา — งานที่ผูกอยู่ไม่หาย แค่กลายเป็น "ไม่ระบุวิชา" (หน้าจอถามยืนยันก่อนเรียก) */
  async function deleteSubject(id) {
    for (const t of state.tasks.filter(t => t.subject_id === id)) await putTask(updateTask(t, { subject_id: null }, iso()), false);
    await db.del('subjects', id);
    state.subjects = state.subjects.filter(s => s.id !== id);
    emit();
  }

  /** ส่งออกทุกอย่างเป็น JSON (รูปไม่รวม — บอกผู้ใช้ตรง ๆ) */
  function exportJSON() {
    return JSON.stringify({
      app: 'SABAii.com', version: 1, exported_at: iso(),
      tasks: state.tasks, subjects: state.subjects, prefs: state.prefs,
      requests: state.requests, family: state.family,
      notes: state.attachments.filter(a => a.kind === 'text').map(({ blob, ...a }) => a),
    }, null, 2);
  }

  /** งานตัวอย่างให้ลองใช้ — ติดป้าย "ตัวอย่าง" ทุกชิ้น และลบทิ้งได้ทั้งหมดในครั้งเดียว */
  async function addSamples() {
    const day = n => { const d = new Date(now()); d.setDate(d.getDate() + n); return toYMD(d); };
    const sid = name => state.subjects.find(x => x.name === name)?.id || null;
    const rows = [
      ['กินยาความดันหลังอาหารเช้า', 'ยาและสุขภาพ', 'medicine', day(0), '08:00', '1 เม็ด หลังอาหาร'],
      ['นัดหมอตรวจเบาหวาน', 'นัดหมอ', 'appointment', day(3), '09:30', 'งดอาหารก่อนเจาะเลือด 8 ชั่วโมง · นำสมุดนัดไปด้วย'],
      ['รำไม้พลองที่ชมรม', 'กิจกรรม', 'activity', day(1), '17:00', ''],
      ['วิดีโอคอลกับหลาน', 'ครอบครัว', 'reminder', day(2), '19:00', ''],
      ['ซื้อแผ่นวัดน้ำตาลเพิ่ม', 'ธุระและเอกสาร', 'errand', day(4), null, ''],
    ];
    const saved = [];
    for (const [title, subj, type, due_date, due_time, note] of rows) {
      const t = makeTask({ title, subject_id: sid(subj), type, due_date, due_time, source: 'sample' }, iso());
      await putTask(t, false);
      if (note) { const a = { id: newId('a'), task_id: t.id, kind: 'text', blob: null, text: note, mime_type: '', size: 0, created_at: iso() }; await db.put('attachments', a); state.attachments.push(a); }
      saved.push(t);
    }
    emit();
    return saved;
  }
  async function removeSamples() {
    const ids = state.tasks.filter(t => t.source === 'sample').map(t => t.id);
    for (const id of ids) await purgeTask(id, false);
    emit();
    return ids.length;
  }

  /** กู้คืนจากไฟล์สำรองของ SABAii เอง — งานที่มีอยู่แล้ว (id เดียวกัน) ข้ามไป ไม่เขียนทับ */
  async function restoreBackup(raw) {
    let data;
    try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { throw new Error('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ SABAii'); }
    if (data?.app !== 'SABAii.com' || !Array.isArray(data.tasks)) throw new Error('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ SABAii');
    let added = 0, skipped = 0;
    for (const sj of data.subjects || []) if (sj?.id && sj.name && !state.subjects.some(x => x.id === sj.id)) await putSubject(sj, false);
    for (const t of data.tasks) {
      if (!t?.id || !t.title || state.tasks.some(x => x.id === t.id)) { skipped++; continue; }
      await putTask(t, false); added++;
    }
    for (const n of data.notes || []) if (n?.id && n.task_id && !state.attachments.some(a => a.id === n.id)) { await db.put('attachments', n); state.attachments.push(n); }
    emit();
    return { added, skipped };
  }

  /* ---------- ศูนย์รวมบริการ: คำขอ · ครอบครัว · การแจ้งเตือน (เก็บในเครื่องนี้เท่านั้น) ---------- */
  async function putIn(store, v, notify = true) {
    await db.put(store, v);
    const arr = state[store], i = arr.findIndex(x => x.id === v.id);
    if (i >= 0) arr[i] = v; else arr.push(v);
    if (notify) emit();
    return v;
  }
  async function delIn(store, id) { await db.del(store, id); state[store] = state[store].filter(x => x.id !== id); emit(); }
  async function notify(n, now = true) { return putIn('notices', { id: newId('n'), at: iso(), read: false, kind: 'info', ...n }, now); }
  async function addRequest(r) {
    const at = iso();
    const req = { id: newId('r'), created_at: at, updated_at: at, status: 'requested', review: null, demo: true, ...r,
      history: [{ status: 'requested', at, by: r.by_id || 'me' }] };
    await putIn('requests', req, false);
    await notify({ kind: 'request', ref: req.id, title: `ส่งคำขอ: ${req.title}`, body: 'บันทึกไว้ในเครื่องแล้ว (โหมดตัวอย่าง)', by: req.by_id }, false);
    emit();
    return req;
  }
  async function patchRequest(id, patch, label) {
    const r = state.requests.find(x => x.id === id); if (!r) throw new Error('ไม่พบคำขอ');
    const at = iso(), next = { ...r, ...patch, updated_at: at };
    if (patch.status && patch.status !== r.status) next.history = [...(r.history || []), { status: patch.status, at, by: patch.by || 'me' }];
    await putIn('requests', next, false);
    if (label) await putIn('notices', { id: newId('n'), at, read: false, kind: 'request', ref: id, title: label, body: r.title }, false);
    emit();
    return next;
  }
  const saveMember = m => putIn('family', { created_at: iso(), ...m, id: m.id || newId('f') });
  const removeMember = id => delIn('family', id);
  async function readAll() { for (const n of state.notices.filter(n => !n.read)) await putIn('notices', { ...n, read: true }, false); emit(); }
  const clearNotices = async () => { for (const n of [...state.notices]) await db.del('notices', n.id); state.notices = []; emit(); };

  return {
    state, load,
    addRequest, patchRequest, removeRequest: id => delIn('requests', id),
    saveMember, removeMember, notify: n => notify(n), readAll, clearNotices, subscribe: fn => (listeners.add(fn), () => listeners.delete(fn)),
    addTasks, patchTask, removeTask, restoreTask, purgeTask,
    addAttachment, removeAttachment, attachmentsOf: id => state.attachments.filter(a => a.task_id === id),
    ensureSubject, updateSubject, deleteSubject, setPref, exportJSON, restoreBackup, addSamples, removeSamples,
    subjectsById: () => Object.fromEntries(state.subjects.map(s => [s.id, s])),
  };
}
