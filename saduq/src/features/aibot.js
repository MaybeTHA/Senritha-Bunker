// ผู้ช่วย AI (จำลอง): เล่าปัญหา → AI เข้าใจโจทย์ → ค้นบริการ → AI จัดอันดับ → 3 ตัวเลือก
import { h, ic, put, openModal, closeModal } from '../ui/kit.js';
import { understand, rank, featLabel, findProvince, EXAMPLES } from '../domain/understand.js';
import { svcOf } from '../domain/services-lookup.js';
import { baht } from '../domain/providers.js';
import { app, S } from './shared.js';
import { members, goAfterModal, PQ, P } from './common.js';
import { setCompare } from './market.js';

const STEPS = [['bot', 'Chat Bot'], ['spark', 'AI เข้าใจโจทย์'], ['search', 'ค้นบริการ'], ['star', 'AI จัดอันดับ']];
const chat = { text: '', el: null };           // เก็บในหน่วยความจำเท่านั้น (ปิดแล้วเปิดใหม่ยังเห็นบทสนทนาเดิม)
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, calm() ? 0 : ms));
const homeProvince = () => findProvince(S().prefs.my_addr || '');
const whoMember = who => who && members().find(m => m.role === 'senior' && (m.relation === who || m.name.includes(who.split('/')[0])));

/** แถบ 4 ขั้น (เหมือนสไลด์) — n = ขั้นที่ทำเสร็จแล้ว */
const stepper = n => h('ol.aisteps', { 'aria-label': 'ขั้นตอนของ AI' }, STEPS.map(([i, t], k) => h('li' + (k < n ? '.done' : k === n ? '.now' : ''), h('span', { html: ic(i) }), h('small', t))));

export function openAI(prefill = '') {
  const log = chat.el ||= h('div.ailog', { role: 'log', 'aria-live': 'polite' });
  const bar = h('div.aibar');
  const input = h('textarea.field.aiin', { id: 'ai-in', rows: 2, maxlength: 400, placeholder: 'เล่าปัญหา เช่น แม่เดินไม่สะดวก ต้องไปหาหมอทุกเดือน', 'aria-label': 'เล่าปัญหาให้ AI',
    onkeydown: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } } });
  const bubble = (who, ...kids) => { const b = h('div.aimsg.' + who, who === 'bot' ? h('span.aiav', { html: ic('bot') }) : '', h('div.aibub', kids)); log.append(b); b.scrollIntoView({ block: 'end', behavior: calm() ? 'auto' : 'smooth' }); return b; };
  const typing = () => bubble('bot', h('span.dots3', h('i'), h('i'), h('i')));
  const hello = () => bubble('bot', h('p', `สวัสดี${P()} เล่าปัญหาของคนที่คุณดูแลมาได้เลย แล้ว AI จะเลือก 3 บริการที่เหมาะที่สุดให้`),
    h('div.aiex', EXAMPLES.map(x => h('button.qchip', { type: 'button', onclick: () => { input.value = x; send(); } }, x))));

  async function send() {
    const msg = input.value.trim(); if (!msg) return;
    input.value = ''; put(bar, stepper(0));
    bubble('me', h('p', msg));
    chat.text = (chat.text + ' ' + msg).trim();
    const t1 = typing(); await wait(700); t1.remove();
    const u = understand(chat.text, { homeProvince: homeProvince() });
    if (!u) {
      chat.text = '';
      bubble('bot', h('p', `ยังจับไม่ได้ว่าต้องการบริการแบบไหน${P()} ลองเล่าเพิ่มอีกนิด เช่น อาการ ต้องการให้ช่วยเรื่องอะไร หรืออยู่จังหวัดไหน`),
        h('div.aiex', EXAMPLES.slice(0, 3).map(x => h('button.qchip', { type: 'button', onclick: () => { input.value = x; send(); } }, x))));
      return;
    }
    put(bar, stepper(1));
    const who = whoMember(u.who);
    bubble('bot', h('p.aistep', h('b', '① AI เข้าใจโจทย์')),
      h('ul.aineeds', u.needs.map(n => h('li', h('span', { html: ic('check') }), n))),
      u.feats.length ? h('p.aisub', 'ต้องมี: ', u.feats.map(f => h('span.aitag', featLabel(f).split('/')[0]))) : '',
      h('p.aisub', `สำหรับ: ${who ? who.name : u.who || 'ไม่ได้ระบุ'} · พื้นที่: ${u.province || 'ทั่วประเทศ'}${u.province && !u.provinceSaid ? ' (จากที่อยู่ของคุณ)' : ''}`));
    const t2 = typing(); await wait(800); t2.remove();
    const r = rank(u);
    put(bar, stepper(2));
    bubble('bot', h('p.aistep', h('b', '② ค้นบริการ')),
      h('p', `กรองจาก ${r.total} เจ้า → ประเภทที่เกี่ยวข้อง ${r.services.length} ประเภท (${r.services.map(s => svcOf(s)?.name).join(', ')}) → ${r.candidates} เจ้า → ในพื้นที่${u.province ? ' ' + u.province : ''} ${r.filtered} เจ้า`));
    const t3 = typing(); await wait(900); t3.remove();
    put(bar, stepper(4));
    bubble('bot', h('p.aistep', h('b', '③ AI จัดอันดับ: 3 ตัวเลือกที่เหมาะที่สุด')),
      h('div.aipicks', r.picks.map((x, i) => pickCard(x, i, u, who))),
      h('div.aiacts', h('button.btn.ghost.sm', { onclick: () => { setCompare(r.picks.map(x => x.p.id)); closeModal(); goAfterModal('compare'); } }, h('span', { html: ic('grid') }), 'เทียบทั้ง 3 เจ้า'),
        h('button.btn.ghost.sm', { onclick: reset }, 'เริ่มเรื่องใหม่')),
      h('p.aisub', `อยากให้ละเอียดขึ้นไหม${PQ()} พิมพ์เพิ่มได้ เช่น "อยู่เชียงใหม่" "งบน้อย" "ขอผู้หญิง"`));
  }
  function reset() { chat.text = ''; log.replaceChildren(); put(bar, stepper(0)); hello(); }

  const m = openModal({ title: 'ผู้ช่วย AI', label: 'ผู้ช่วย AI เลือกบริการ', body: h('div.aiwrap', bar, log, h('p.ainote', 'AI จำลอง: จับคำสำคัญและให้คะแนนด้วยกฎในเครื่องนี้ ไม่ได้ส่งข้อความออกไปไหน')),
    foot: h('div.aisend', input, h('button.btn.primary', { type: 'button', 'aria-label': 'ส่ง', onclick: send, html: ic('send') + '<span>ส่ง</span>' })) });
  m.box.classList.add('aimodal');
  put(bar, stepper(0));
  if (!log.childElementCount) hello();
  if (prefill) { input.value = prefill; send(); } else setTimeout(() => input.focus(), 300);
}

function pickCard(x, i, u, who) {
  const p = x.p, s = svcOf(p.sid);
  return h('article.aipick',
    h('div.ap-top', h('span.ap-rank', String(i + 1)), h('span.ap-ic', { html: ic(s?.icon || 'star') }),
      h('div', h('b', p.name), h('small', `${s?.name} · ${p.area}`)),
      h('span.ap-fit', { 'aria-label': `เหมาะ ${x.fit}%` }, `${x.fit}%`, h('small', 'เหมาะ'))),
    h('i.ap-bar', h('em', { style: { width: x.fit + '%' } })),
    h('ul.ap-why',
      x.have.map(f => h('li.ok', '✓ ', featLabel(f))),
      h('li' + (x.local ? '.ok' : '.no'), x.local ? `✓ อยู่ใน${u.province || 'พื้นที่บริการ'}` : `✗ อยู่${p.province} คนละจังหวัด`),
      h('li.ok', `✓ ${p.rating.toFixed(1)} ★ จาก ${p.reviews.toLocaleString('th-TH')} รีวิว`),
      x.miss.map(f => h('li.no', '✗ ไม่ระบุว่า', featLabel(f).split('/')[0]))),
    h('div.ap-foot', h('span', 'เริ่มต้น ', h('b', baht(p.price)), ` ${p.unit}`),
      h('button.btn.primary.sm', { onclick: () => { closeModal(); goAfterModal('prov/' + p.id); } }, 'ดูร้านและจอง')));
}
