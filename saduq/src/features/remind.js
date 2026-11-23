// การเตือน (ระบบงานเดิมของ SABAii) ในศูนย์รวมบริการ: ดูรายละเอียด · ทำแล้ว (เลิกทำได้) · เพิ่มโน้ต/รูป
import { h, ic, toast, openModal, closeModal, $ } from '../ui/kit.js';
import { typeLabel } from '../domain/tasks.js';
import { app, task, subj, dueLine, notesOf } from './shared.js';
import { editTask, addNote, miniOf } from './add.js';
import { P } from './common.js';

export async function finish(id) {
  const t = task(id); if (!t) return;
  const prev = { status: t.status };
  await app.store.patchTask(id, { status: 'done' });
  app.store.notify({ kind: 'reminder', ref: id, title: `ทำแล้ว: ${t.title}`, by: 'me' });
  toast(`บันทึกว่าทำแล้ว${P()}`, { label: 'เลิกทำ', run: () => app.store.patchTask(id, prev) });
}
export const focusSearch = () => { location.hash = '#home'; setTimeout(() => $('#hub-q')?.focus(), 200); };

/** แผ่นรายละเอียดการเตือน — ใช้แทน "โน้ตเต็มจอ" ของรุ่นนักเรียน */
export function openReminder(id) {
  const t = task(id); if (!t) return;
  const s = subj(t.subject_id), notes = notesOf(id);
  openModal({ title: t.title, label: `การเตือน ${t.title}`, body: h('div.remd',
    h('p.rd-meta', h('span.rd-type', typeLabel(t)), s.id ? h('span', s.name) : '', h('span', dueLine(t))),
    t.description ? h('p', t.description) : '',
    notes.length ? h('div.strip', notes.map(a => miniOf(a))) : h('p.muted', 'ยังไม่มีโน้ตหรือรูป เช่น รูปซองยา ใบนัด'),
    h('div.row2', h('button.btn.ghost', { onclick: () => { closeModal(); addNote(id, 'pick'); }, html: ic('img') + '<span>เพิ่มรูป/โน้ต</span>' }),
      h('button.btn.ghost', { onclick: () => { closeModal(); editTask(id); }, html: ic('edit') + '<span>แก้ไข</span>' }))),
    foot: t.status === 'done'
      ? h('button.btn.ghost', { onclick: async () => { await app.store.patchTask(id, { status: 'todo' }); closeModal(); toast('ย้ายกลับไปรายการที่ยังไม่ทำ'); } }, 'ยังไม่ได้ทำ')
      : h('button.btn.primary', { onclick: () => { closeModal(); finish(id); }, html: ic('check') + '<span>ทำแล้ว</span>' }) });
}
