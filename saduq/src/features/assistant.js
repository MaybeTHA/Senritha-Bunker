// หน้า "ผู้ช่วย AI": เล่าปัญหา → เห็น AI ทำงานทีละขั้น (Chat Bot · เข้าใจโจทย์ · ค้นบริการ · จัดอันดับ) → ได้ 3 ตัวเลือก
import { h, ic, put, toast } from '../ui/kit.js';
import { runPipeline, INTENTS, itemOf } from '../ai/engine.js';
import { RIGHTS, MOBILITY, CHECKED } from '../domain/catalog.js';
import { S, app } from './shared.js';
import { P, PQ, pageHead, recipients, team, member, myName, avatar, go } from './common.js';
import { requestForm } from './care.js';
import { speechSupported, startListening } from './voice.js';

const EXAMPLES = ['แม่เดินไม่สะดวก ต้องไปหาหมอทุกเดือน', 'ยายติดเตียง ฉี่ราด ค่าผ้าอ้อมแพง', 'ต้องไปทำงานทั้งวัน แม่อยู่บ้านคนเดียว', 'พ่อเป็นไข้ ไอ เจ็บคอ ไม่อยากไปรอคิว', 'แม่ล้มในห้องน้ำบ่อย', 'แม่ลืมกินยาความดันบ่อย'];
const STEPS = [['chat', 'Chat Bot', 'รับเรื่องที่คุณเล่า'], ['understand', 'AI เข้าใจโจทย์', 'จับว่าต้องการอะไร ของใคร ที่ไหน'], ['retrieve', 'ค้นบริการ', 'กรองตามประเภทและพื้นที่'], ['rank', 'AI จัดอันดับ', 'เรียงตามความเหมาะสมกับโจทย์']];
const st = { thread: [], busy: false };
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, reduce() ? 0 : ms));

export function assistantView(root, preset) {
  if (preset) { const q = decodeURIComponent(preset); history.replaceState(null, '', '#ai'); setTimeout(() => ask(root, q), 0); }
  const input = h('textarea.field.aiq', { id: 'ai-q', rows: 1, maxlength: 400, placeholder: 'เล่าปัญหา…', 'aria-label': 'เล่าปัญหา',
    onkeydown: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } } });
  const send = () => { const v = input.value.trim(); if (!v || st.busy) return; input.value = ''; ask(root, v); };
  const mic = speechSupported() ? h('button.iconbtn.aimic', { type: 'button', 'aria-label': 'พูดแทนพิมพ์', html: ic('mic'), onclick: () => {
    toast('กำลังฟัง… พูดได้เลย'); startListening({ onText: v => { input.value = v; }, onEnd: () => { if (input.value.trim()) send(); } }); } }) : '';
  put(root,
    pageHead('ผู้ช่วย AI', { sub: 'เล่าปัญหาของผู้ที่คุณดูแล แล้วได้ 3 ตัวเลือกจากบริการและสินค้าจริง' }),
    h('ol.aiflow', { 'aria-label': 'ขั้นตอนของ AI' }, STEPS.map(([, t, d], i) => h('li', h('i', String(i + 1)), h('b', t), h('small', d)))),
    h('div.aithread', { 'aria-live': 'polite' }, st.thread.length ? st.thread.map(turnEl) : intro(root)),
    h('div.aibar', mic, input, h('button.btn.primary.aisend', { onclick: send, 'aria-label': 'ส่ง', html: ic('arrow') })));
  root.querySelector('.aithread .aiturn:last-child')?.scrollIntoView({ block: 'start' });
}

function intro(root) {
  const rs = recipients();
  return h('div.aiintro',
    h('div.aibubble.bot', h('span.aiav', { html: ic('spark') }), h('div',
      h('p', `สวัสดี${P()}${myName() ? ' คุณ' + myName() : ''} เล่าปัญหาที่เจอตอนดูแล${rs.length === 1 ? rs[0].name : 'ผู้สูงอายุ'}ได้เลย${P()}`),
      h('p.muted', rs.length ? `AI จะใช้ข้อมูลที่บันทึกไว้ (${rs.map(m => [m.name, m.age ? m.age + ' ปี' : '', RIGHTS[m.rights], m.bkk ? 'กรุงเทพฯ' : ''].filter(Boolean).join(' · ')).join(' / ')}) ช่วยเลือกด้วย` : 'เพิ่มผู้รับการดูแลไว้ก่อน AI จะใช้อายุ สิทธิ และพื้นที่ช่วยเลือกให้ตรงขึ้น'))),
    h('div.aiex', h('small', 'ลองเล่าแบบนี้'), h('div.qchips', EXAMPLES.map(x => h('button.qchip', { type: 'button', onclick: () => ask(root, x) }, x)))));
}

async function ask(root, text) {
  if (st.busy) return;
  st.busy = true;
  const turn = { text, at: Date.now(), step: 0, result: null };
  st.thread.push(turn); if (st.thread.length > 6) st.thread.shift();
  assistantView(root);
  try {
    const res = await runPipeline(text, { people: recipients(), teamSize: team().length });
    turn.result = res;
    for (let i = 1; i <= 5; i++) { turn.step = i; repaint(root, turn); if (i < 5) await wait(i === 1 ? 250 : 450); }
    app.store.notify({ kind: 'ai', title: `ถามผู้ช่วย AI: ${text.slice(0, 60)}`, body: res.ranked.picks.map(p => p.item.name).join(' · '), by: 'me' });
  } catch (e) { toast('ผู้ช่วยทำงานไม่สำเร็จ ลองอีกครั้ง'); st.thread.pop(); }
  st.busy = false;
  if (location.hash.startsWith('#ai')) repaint(root, turn);
}
function repaint(root, turn) {
  const el = root.querySelector(`[data-turn="${turn.at}"]`);
  if (el) { const n = turnEl(turn); el.replaceWith(n); n.scrollIntoView({ block: 'nearest', behavior: reduce() ? 'auto' : 'smooth' }); }
}

/* ---------- หนึ่งรอบถาม-ตอบ ---------- */
function turnEl(turn) {
  const r = turn.result, s = turn.result ? turn.step : 1;
  return h('div.aiturn', { 'data-turn': String(turn.at) },
    h('div.aibubble.me', h('p', turn.text), avatar('me', myName() || 'ฉ')),
    h('div.aisteps',
      stepBox(1, s, 'Chat Bot', 'รับเรื่องแล้ว', r ? `"${turn.text}"` : 'กำลังอ่าน…'),
      stepBox(2, s, 'AI เข้าใจโจทย์', r ? understoodSummary(r) : '', r && s >= 2 ? understoodDetail(r) : ''),
      stepBox(3, s, 'ค้นบริการ', r ? `กรองได้ ${r.found.kept.length} จาก ${r.total} รายการ` : '', r && s >= 3 ? retrieveDetail(r) : ''),
      stepBox(4, s, 'AI จัดอันดับ', r ? `เลือก ${r.ranked.picks.length} ตัวเลือกที่เหมาะที่สุด` : '', '')),
    r && s >= 4 ? answer(r) : '');
}
function stepBox(n, cur, title, sum, detail) {
  const state = cur > n ? 'done' : cur === n ? 'now' : 'wait';
  return h('div.aistep.' + state, h('span.as-i', state === 'done' ? h('span', { html: ic('check') }) : String(n)),
    h('div', h('b', title), state !== 'wait' && sum ? h('small', sum) : h('small', '…'), state !== 'wait' && detail ? h('div.as-d', detail) : ''));
}
function understoodSummary(r) {
  const it = r.understood.intents;
  return it.length ? `ต้องการ: ${it.slice(0, 3).map(i => i.label).join(' + ')}` : 'ยังจับความต้องการไม่ได้';
}
function understoodDetail(r) {
  const c = r.ctx, p = c.person;
  const facts = [
    p ? ['ของใคร', p.name] : r.understood.entities.relation ? ['ของใคร', r.understood.entities.relation] : null,
    c.mobility ? ['การเคลื่อนไหว', MOBILITY[c.mobility]] : null,
    c.age ? ['อายุ', `${c.age} ปี`] : null,
    c.rights ? ['สิทธิรักษา', RIGHTS[c.rights]] : null,
    ['พื้นที่', c.bkk === true ? 'กรุงเทพฯ' : c.bkk === false ? 'ต่างจังหวัด' : 'ไม่ระบุ'],
    c.recurring ? ['ความถี่', 'เป็นประจำ'] : null,
    c.budget === 'low' ? ['งบ', 'อยากประหยัด'] : null,
  ].filter(Boolean);
  return [
    h('div.aitags', r.understood.intents.slice(0, 4).map(i => h('span.aitag', { title: `คำที่เจอ: ${i.words.join(', ')}` }, h('span', { html: ic(INTENTS[i.id].icon) }), i.label))),
    h('dl.aifacts', facts.map(([k, v]) => h('div', h('dt', k), h('dd', v)))),
    h('small.aisrc', p && !r.understood.entities.person_id ? `ใช้ข้อมูลที่บันทึกไว้ของ ${p.name} เติมส่วนที่ไม่ได้เล่า` : '')];
}
function retrieveDetail(r) {
  return [h('small', `ประเภท: ${r.found.types.join(', ') || '—'} · พื้นที่: ${r.found.area}`),
    r.found.dropped.length ? h('small.aidrop', 'ตัดออก: ' + r.found.dropped.map(d => `${itemOf(d.x).name} (${d.why})`).join(', ')) : ''];
}

/* ---------- คำตอบ: 3 ตัวเลือก ---------- */
function answer(r) {
  const picks = r.ranked.picks;
  if (r.urgent) return h('div.aians', h('a.aiurgent', { href: 'tel:1669' }, h('span', { html: ic('siren') }), h('div', h('b', 'อาการนี้อาจฉุกเฉิน — โทร 1669 ทันที'), h('small', 'ฟรี 24 ชั่วโมง บอกอาการ ที่อยู่ อายุ และโรคประจำตัว')), h('span.aiu-n', '1669')),
    h('a.btn.ghost.full', { href: '#emergency' }, 'เปิดหน้าฉุกเฉิน (ข้อมูลการแพทย์ไว้อ่านให้เจ้าหน้าที่)'));
  if (!picks.length) return h('div.aians', h('div.aibubble.bot', h('span.aiav', { html: ic('spark') }), h('div',
    h('p', `ยังไม่เข้าใจปัญหานี้${P()} ลองเล่าว่าเกิดอะไรกับผู้สูงอายุ เช่น เดินไม่ได้ ไปหาหมอลำบาก ไม่มีคนดูแล ลืมกินยา`),
    h('a.btn.ghost.sm', { href: '#services' }, 'ดูบริการทั้งหมดแทน'))));
  return h('div.aians',
    h('p.aih', `${picks.length} ตัวเลือกสำหรับปัญหานี้`),
    h('div.aicards', picks.map((p, i) => optionCard(p, i))),
    h('p.srcnote', `AI เลือกจากบริการและสินค้าจริงในแค็ตตาล็อก (ตรวจ ${CHECKED}) ไม่ได้แต่งขึ้นเอง · คะแนนคือความเหมาะสมกับเรื่องที่เล่า ไม่ใช่รีวิว · เงื่อนไขจริงให้ตรวจกับหน่วยงาน/ร้าน`));
}
function optionCard(p, i) {
  const it = p.item, isP = p.x.kind === 'product', href = isP ? '#product/' + p.x.id : '#svc/' + p.x.id;
  const sub = isP ? `${it.brand} · ${it.model}` : it.provider?.name || 'เครื่องมือใน Saduq';
  return h('article.aicard',
    h('div.ac-top', h('span.ac-rank', String(i + 1)), h('span.ac-ic', { html: ic(p.x.icon || 'spark') }),
      h('div.ac-fit', h('small', 'เหมาะกับโจทย์'), h('b', `${p.fit}%`), h('i', h('em', { style: { width: p.fit + '%' } })))),
    h('span.ac-kind', isP ? 'สินค้า' : p.x.cost === 'tool' ? 'เครื่องมือในแอป' : p.x.cost === 'free' ? 'บริการฟรี/ตามสิทธิ' : 'บริการ'),
    h('b.ac-name', it.name), h('small.ac-sub', sub),
    h('ul.ac-why', p.why.map(w => h('li', h('span', { html: ic('check') }), w))),
    h('div.ac-act',
      h('a.btn.primary.sm', { href }, 'ดูรายละเอียด'),
      !isP && svcTrackable(p) ? h('button.btn.ghost.sm', { onclick: () => requestForm(it) }, 'ติดตามเรื่องนี้') : ''));
}
const svcTrackable = p => p.item.track;
export const aiPrompt = () => go('ai');
