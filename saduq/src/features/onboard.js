// เริ่มใช้งานครั้งแรก — หน้าเดียว 3 คำถามสั้น ๆ (ชื่อ · ใช้ในฐานะ · คำลงท้าย) ข้ามได้ แก้ทีหลังในโปรไฟล์
import { h, put, openModal, closeModal } from '../ui/kit.js';
import { app, S } from './shared.js';

export const needsOnboarding = () => !S().prefs.hub_onboarded;
const pick = (opts, cur, on) => h('div.seg.wrap', opts.map(([k, v]) => h('button', { type: 'button', 'aria-pressed': String(k === cur), onclick: () => on(k) }, v)));

export function openOnboarding() {
  const p = S().prefs;
  const f = { name: p.display_name || '', role: p.role || 'senior', polite: p.polite || 'none' };
  const body = h('div.onb');
  const name = h('input.field', { id: 'onb-name', maxlength: 40, value: f.name, placeholder: 'เช่น สมศรี', oninput: e => { f.name = e.target.value; } });
  const paint = () => {
    put(body,
      h('p.onb-lead', 'ศูนย์รวมบริการสำหรับผู้สูงอายุและครอบครัว ตอบ 3 ข้อสั้น ๆ แก้ทีหลังได้ที่เมนู ฉัน'),
      h('label.flabel', { for: 'onb-name' }, '1. อยากให้เราเรียกคุณว่าอะไร'), name,
      h('p.flabel', '2. คุณใช้แอปในฐานะ'), pick([['senior', 'ผู้สูงอายุ'], ['family', 'ลูกหลาน / ผู้ดูแล']], f.role, v => { f.role = v; paint(); }),
      h('p.flabel', '3. ให้แอปพูดลงท้ายว่า'), pick([['krub', 'ครับ'], ['ka', 'ค่ะ'], ['none', 'ไม่ระบุ']], f.polite, v => { f.polite = v; paint(); }));
  };
  paint();
  const save = async samples => {
    const st = app.store;
    await st.setPref('display_name', f.name.trim(), false);
    await st.setPref('role', f.role, false); await st.setPref('polite', f.polite, false);
    await st.setPref('hub_onboarded', true);
    closeModal(true);
    if (samples) (await import('./family.js')).addHubSamples();
  };
  openModal({ title: 'ยินดีต้อนรับสู่ Saduq', label: 'ตั้งค่าเริ่มต้น', body,
    foot: [h('button.btn.ghost', { onclick: () => save(true) }, 'เริ่มพร้อมข้อมูลตัวอย่าง'), h('button.btn.primary', { onclick: () => save(false) }, 'เริ่มใช้งาน')] });
}
