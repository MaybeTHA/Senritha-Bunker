// เริ่มใช้งาน — สำหรับผู้ดูแล: ชื่อคุณ · ผู้สูงอายุที่ดูแล (ชื่อ ความสัมพันธ์) · คำลงท้าย · แก้ทีหลังได้
import { h, put, openModal, closeModal, toast } from '../ui/kit.js';
import { RELATIONS } from '../domain/catalog.js';
import { app, S } from './shared.js';
import { recipients } from './common.js';

export const needsOnboarding = () => !S().prefs.hub_onboarded;
const pick = (opts, cur, on) => h('div.seg.wrap', opts.map(([k, v]) => h('button', { type: 'button', 'aria-pressed': String(k === cur), onclick: () => on(k) }, v)));

export function openOnboarding() {
  const p = S().prefs, r0 = recipients().find(m => !m.sample);
  const f = { name: p.name_sample ? '' : p.display_name || '', who: r0?.name || '', rel: r0?.relation || 'แม่', polite: p.polite || 'none' };
  const body = h('div.onb');
  const name = h('input.field', { id: 'onb-name', maxlength: 40, value: f.name, placeholder: 'ชื่อของคุณ (ผู้ดูแล)', oninput: e => { f.name = e.target.value; } });
  const who = h('input.field', { id: 'onb-who', maxlength: 40, value: f.who, placeholder: 'เช่น คุณแม่สมศรี', oninput: e => { f.who = e.target.value; } });
  const paint = () => put(body,
    h('p.onb-lead', 'Saduq เป็นผู้ช่วยของผู้ดูแลผู้สูงอายุ: ตารางยา บันทึกสุขภาพ สิทธิรัฐ และสินค้าที่ขายจริง ตอบ 3 ข้อ แก้ทีหลังได้'),
    h('label.flabel', { for: 'onb-name' }, '1. ชื่อของคุณ'), name,
    h('label.flabel', { for: 'onb-who' }, '2. คุณดูแลใคร (ข้ามได้)'), who,
    h('div.qchips', RELATIONS.map(r => h('button.qchip', { type: 'button', 'aria-pressed': String(f.rel === r), onclick: () => { f.rel = r; paint(); } }, r))),
    h('p.flabel', '3. ให้แอปพูดลงท้ายว่า'), pick([['krub', 'ครับ'], ['ka', 'ค่ะ'], ['none', 'ไม่ระบุ']], f.polite, v => { f.polite = v; paint(); }));
  paint();
  const save = async samples => {
    const st = app.store;
    await st.setPref('display_name', f.name.trim(), false); await st.setPref('name_sample', false, false);
    await st.setPref('polite', f.polite, false);
    await st.setPref('hub_onboarded', true);
    if (f.who.trim() && !recipients().some(m => m.name === f.who.trim())) {
      const m = await st.saveMember({ name: f.who.trim(), relation: f.rel, role: 'senior', rights: 'ucs', mobility: 'walk', medinfo: {}, perms: {} });
      await st.setPref('cur_person', m.id);
    }
    closeModal(true);
    if (samples) (await import('./family.js')).addHubSamples();
    else toast('พร้อมแล้ว แตะชื่อผู้รับการดูแลเพื่อใส่อายุและโรคประจำตัว');
  };
  openModal({ title: 'ยินดีต้อนรับสู่ Saduq', label: 'ตั้งค่าเริ่มต้น', body,
    foot: [h('button.btn.ghost', { onclick: () => save(true) }, 'ดูพร้อมข้อมูลตัวอย่าง'), h('button.btn.primary', { onclick: () => save(false) }, 'เริ่มใช้งาน')] });
}
