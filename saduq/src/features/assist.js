// หน้าผู้ช่วย AI (#ai): เล่าปัญหา แล้วได้ 3 ตัวเลือก
// หน้าจอแสดงทั้ง 4 ขั้นของ src/ai/pipeline.js ให้เห็นว่า AI คิดอะไรในแต่ละขั้น แล้วจบที่ 3 ตัวเลือกพร้อมเหตุผล
import { h, ic, put } from '../ui/kit.js';
import { svcOf } from '../domain/catalog.js';
import { baht } from '../domain/providers.js';
import { careAI, STAGES } from '../ai/pipeline.js';
import { FACTOR_LABEL } from '../ai/rank.js';
import { S } from './shared.js';
import { P, PQ, pageHead, members, callBox, go, avatarColor } from './common.js';
import { stars, setCompare } from './market.js';
import { speechSupported, startListening } from './voice.js';

const SAMPLES = ['แม่เดินไม่สะดวก ต้องไปหาหมอทุกเดือน', 'พ่ออยู่บ้านคนเดียว เป็นเบาหวาน ทำกับข้าวเองไม่ไหว', 'ยายลื่นล้มในห้องน้ำบ่อย', 'คุณแม่ติดเตียง อยากได้คนดูแลตอนกลางวัน งบไม่เกิน 900'];
const PICK = ['ตัวเลือกที่ 1', 'ตัวเลือกที่ 2', 'ตัวเลือกที่ 3'];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// สถานะบทสนทนา (อยู่ในหน่วยความจำ ปิดหน้าแล้วหาย — ไม่เก็บเรื่องสุขภาพไว้ในเครื่องโดยไม่ได้บอก)
const as = { turns: [], msgs: [], draft: '', busy: false, shown: 0, last: null, mic: null };

/** เปิดหน้า AI พร้อมคำถาม (จากช่องค้นหาหน้าหลัก) */
export function askAI(text) { as.draft = ''; go('ai'); setTimeout(() => send(text), 0); }

const ctx = () => ({ homeArea: S().prefs.my_addr || '', people: members().map(m => ({ name: m.name })) });
let rootEl = null;

async function send(text) {
  text = String(text || '').trim();
  if (!text || as.busy) return;
  as.mic?.abort(); as.mic = null;
  as.turns.push(text); as.msgs.push({ me: true, text }); as.draft = ''; as.busy = true; as.shown = 0;
  paint();
  const res = await careAI.run(as.turns, ctx());
  as.last = res;
  // แสดงทีละขั้นให้เห็นการทำงาน (ผลคิดเสร็จแล้ว แค่เปิดเผยทีละขั้น)
  const total = res.trace.length;
  for (let i = 1; i <= total; i++) { as.shown = i; paint(); if (!reduced()) await new Promise(r => setTimeout(r, 380)); }
  as.msgs.push({ me: false, res });
  if (res.status === 'emergency') as.turns = []; // เรื่องฉุกเฉินไม่ปนกับเรื่องถัดไป
  as.busy = false; paint();
  rootEl?.querySelector('.ai-msg:last-of-type')?.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
}
function reset() { as.mic?.abort(); Object.assign(as, { turns: [], msgs: [], draft: '', busy: false, shown: 0, last: null, mic: null }); paint(); }

export function assistView(root) { rootEl = root; paint(); }
function paint() {
  const root = rootEl; if (!root?.isConnected || root.dataset.view !== 'ai') return;
  const keep = document.activeElement?.id === 'ai-in';
  put(root,
    pageHead('ผู้ช่วย AI', { back: 'home', sub: 'เล่าปัญหา แล้วได้ 3 ตัวเลือก', right: as.msgs.length ? h('button.btn.ghost.auto', { type: 'button', onclick: reset }, 'เริ่มเรื่องใหม่') : '' }),
    flow(),
    h('div.ai-log', { role: 'log', 'aria-live': 'polite', 'aria-label': 'บทสนทนากับผู้ช่วย AI' },
      h('div.ai-msg.bot', botFace(), h('div.ai-bub', h('p', `เล่าให้ฟังได้เลย${P()} ว่าใครติดเรื่องอะไร เดี๋ยวช่วยหาให้ 3 ทางเลือกที่เหมาะที่สุด`))),
      as.msgs.map(m => m.me ? h('div.ai-msg.me', h('div.ai-bub', m.text)) : reply(m.res)),
      as.busy ? h('div.ai-msg.bot', botFace(), h('div.ai-bub.typing', { 'aria-label': 'กำลังคิด' }, h('i'), h('i'), h('i'))) : ''),
    composer());
  if (keep) { const el = root.querySelector('#ai-in'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}

const botFace = () => h('span.ai-face', { 'aria-hidden': 'true', html: ic('spark') });

/* ---------- แถบ 4 ขั้น (เหมือนสไลด์) พร้อมผลของแต่ละขั้น ---------- */
function flow() {
  const res = as.last, by = id => res?.trace.find(t => t.id === id);
  const idx = id => res?.trace.findIndex(t => t.id === id) ?? -1;
  const out = {
    chat: o => `"${clip(o.last, 34)}"`,
    understand: o => o.emergency ? 'พบสัญญาณฉุกเฉิน' : o.intents[0] ? `${svcOf(o.intents[0].sid).name} ${pct(o.intents[0].conf)}` : 'ยังไม่ชัด ขอถามเพิ่ม',
    retrieve: o => `${o.candidates.length} เจ้า จาก ${o.services} บริการ · ใช้ได้ในพื้นที่ ${o.inArea}`,
    rank: o => `เลือก ${o.options.length} จาก ${o.ranked.length} เจ้า`,
  };
  return h('ol.ai-flow', { 'aria-label': 'ขั้นตอนการทำงานของ AI' }, STAGES.map(s => {
    const i = idx(s.id), done = i >= 0 && i < as.shown, active = as.busy && i === as.shown;
    const t = done ? by(s.id) : null;
    return h('li' + (done ? '.done' : '') + (active ? '.active' : ''),
      h('span.af-dot', { 'aria-hidden': 'true' }, done ? h('span', { html: ic('check') }) : ''),
      h('b', s.name), h('small', s.sub),
      t ? h('em', out[s.id](t.output), h('span.af-ms', ` · ${t.ms} ms`)) : '');
  }));
}
const pct = x => Math.round(x * 100) + '%';
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/* ---------- คำตอบของ AI ---------- */
function reply(res) {
  const u = res.u;
  if (res.status === 'emergency') return h('div.ai-msg.bot', botFace(), h('div.ai-bub.sos',
    h('p', h('b', `"${u.emergency}" อาจเป็นเหตุฉุกเฉิน`), ` — ยังไม่ต้องเลือกร้าน${P()} โทร 1669 ก่อน ฟรี 24 ชั่วโมง`),
    callBox('1669', 'เจ็บป่วยฉุกเฉิน', { danger: true }),
    h('a.linkbtn2', { href: '#emergency' }, 'เปิดหน้าฉุกเฉิน (แจ้งครอบครัว · ข้อมูลการแพทย์)')));
  if (res.status === 'clarify') return h('div.ai-msg.bot', botFace(), h('div.ai-bub',
    h('p', `ยังไม่แน่ใจว่าติดเรื่องอะไร${P()} เล่าเพิ่มอีกนิดได้ไหม${PQ()} เช่น ใครต้องการความช่วยเหลือ และลำบากตรงไหน`),
    sampleChips()));
  return h('div.ai-msg.bot.wide', botFace(), h('div.ai-res',
    h('div.ai-bub',
      h('p.ai-sum', h('small', 'AI เข้าใจว่า'), u.summary),
      h('div.ai-needs', u.needs.map(n => h('span', { title: `ได้ยินว่า "${n.evidence}"` }, n.label, h('q', n.evidence))),
        Object.entries(u.mods).filter(([, v]) => v).map(([k, v]) => h('span.mod', { recurring: 'เป็นประจำ', urgent: 'เร่งด่วน', cheap: 'ประหยัด', quality: 'เน้นคุณภาพ' }[k], h('q', v))),
        u.budget ? h('span.mod', `งบ ${baht(u.budget)}`) : '',
        u.province ? h('span.area', h('span', { html: ic('map') }), u.province, h('small', u.provinceFrom)) : ''),
      res.ask === 'province' ? h('p.ai-ask', `อยู่จังหวัดไหน${PQ()} บอกได้เลย จะได้หาเจ้าที่ใกล้บ้าน`) : '',
      res.found.noLocal.length ? h('p.ai-ask', `ยังไม่มี${res.found.noLocal.map(id => svcOf(id).name).join(' / ')}ใน${u.province} ตัวเลือกที่ไกลติดป้ายไว้ให้แล้ว${P()}`) : ''),
    h('div.ai-opts', res.options.map((o, i) => optCard(o, i))),
    h('div.ai-after',
      res.options.length >= 2 ? h('button.btn.ghost.auto', { type: 'button', onclick: () => { setCompare(res.options.map(o => o.p.id)); go('compare'); } }, h('span', { html: ic('layout') }), 'เทียบทั้ง 3 แบบตาราง') : '',
      u.related.length ? h('div.ai-rel', h('small', 'สิทธิและบริการรัฐที่ควรรู้'), u.related.map(id => svcOf(id)).filter(Boolean).map(s => h('a.pchip', { href: '#svc/' + s.id }, s.name))) : '',
      h('small.ai-hint', 'พิมพ์ต่อเพื่อปรับได้ เช่น "อยู่เชียงใหม่" · "ขอถูกกว่านี้" · "งบไม่เกิน 500"')),
    thinking(res)));
}

function optCard(o, i) {
  const s = svcOf(o.p.sid), p = o.p;
  return h('article.aiopt' + (i === 0 ? '.best' : ''),
    h('div.ao-head', h('span.ao-ic', { html: ic(s.icon) }), h('div', h('small', PICK[i] + (i === 0 ? ' · เหมาะที่สุด' : '')), h('b', s.name)),
      h('span.ao-score', { style: { '--p': o.score }, role: 'img', 'aria-label': `เหมาะกับโจทย์ ${pct(o.score)}` }, h('b', pct(o.score)), h('small', 'เหมาะ'))),
    h('p.ao-goal', o.intent.goal),
    h('a.ao-prov', { href: '#prov/' + p.id },
      h('span.pav', { style: { background: avatarColor(p.id) }, 'aria-hidden': 'true' }, p.name.replace(/^(ร้าน|ศูนย์|คลินิก)/, '').trim()[0]),
      h('span', h('b', p.name), h('small', stars(p.rating), ` ${p.rating.toFixed(1)} · ${p.area}`))),
    h('ul.ao-why', o.why.map(w => h('li' + (w.ok ? '' : '.no'), h('span', { 'aria-hidden': 'true', html: ic(w.ok ? 'check' : 'info') }),
      h('span', w.text, w.quote?.length ? h('q', w.quote.join(', ')) : '')))),
    h('details.ao-factors', h('summary', 'ทำไมได้คะแนนนี้'),
      Object.entries(o.factors).map(([k, v]) => h('div.af-row', h('span', FACTOR_LABEL[k]), h('i', h('i', { style: { width: pct(v) } })), h('small', `×${o.weights[k].toFixed(2)}`)))),
    h('div.ao-foot', h('div', h('small', 'เริ่มต้น'), h('b', baht(p.price)), h('small', ' ' + p.unit)), h('a.btn.primary.sm', { href: '#prov/' + p.id }, 'ดูร้านและจอง')));
}

/* ---------- เปิดดูว่า AI คิดอย่างไร (สำหรับกรรมการ/นักพัฒนา) ---------- */
function thinking(res) {
  const u = res.u;
  return h('details.ai-think', h('summary', 'ดูว่า AI คิดอย่างไร'),
    h('ol',
      h('li', h('b', 'เข้าใจโจทย์'), ' — ความต้องการที่จับได้: ', u.needs.map(n => `${n.label} ("${n.evidence}")`).join(', ') || '-',
        h('br'), 'บริการที่น่าจะช่วยได้: ', u.intents.map(x => `${svcOf(x.sid).name} ${pct(x.conf)}`).join(' · ')),
      h('li', h('b', 'ค้นบริการ'), ` — ดู ${res.found.scanned} เจ้า → ตรงประเภท ${res.found.candidates.length} เจ้า → ใช้ได้ใน${u.province || 'ทุกพื้นที่'} ${res.found.inArea} เจ้า`),
      h('li', h('b', 'จัดอันดับ'), ' — คะแนน = ', Object.entries(res.weights).map(([k, w]) => `${FACTOR_LABEL[k]} ×${w.toFixed(2)}`).join(' + '),
        ' แล้วเลือกเจ้าที่ดีที่สุดของแต่ละบริการ เพื่อให้ได้ทางออกคนละแบบ'),
      h('li', h('b', 'อันดับทั้งหมด'), h('ul.think-rank', res.ranked.slice(0, 8).map(r => h('li', `${pct(r.score)} · ${r.p.name} (${svcOf(r.p.sid).name})${r.localOnly && r.area === 'far' ? ' · ไกล' : ''}`))))),
    h('p.muted', 'ตัวคิดทำงานในเครื่องนี้ ไม่ส่งเรื่องที่เล่าออกไปที่ไหน · ร้านทั้งหมดเป็นข้อมูลจำลอง'));
}

/* ---------- ช่องพิมพ์/พูด ---------- */
const sampleChips = () => h('div.ai-samples', { role: 'group', 'aria-label': 'ตัวอย่างปัญหา' }, SAMPLES.map(t => h('button.pchip', { type: 'button', onclick: () => send(t) }, t)));
function composer() {
  const ta = h('textarea', { id: 'ai-in', rows: 2, value: as.draft, placeholder: 'เล่าปัญหา เช่น แม่เดินไม่สะดวก ต้องไปหาหมอทุกเดือน', 'aria-label': 'เล่าปัญหา',
    oninput: e => { as.draft = e.target.value; }, onkeydown: e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(as.draft); } } });
  ta.value = as.draft;
  const mic = speechSupported() ? h('button.ai-mic' + (as.mic ? '.on' : ''), { type: 'button', 'aria-pressed': String(!!as.mic), 'aria-label': as.mic ? 'หยุดฟัง' : 'พูดแทนพิมพ์', html: ic(as.mic ? 'check' : 'mic'),
    onclick: () => {
      if (as.mic) { as.mic.stop(); return; }
      as.mic = startListening({ onText: t => { as.draft = t; const el = document.getElementById('ai-in'); if (el) el.value = t; },
        onEnd: t => { as.mic = null; if (t) send(t); else paint(); } });
      paint();
    } }) : '';
  return h('form.ai-compose', { onsubmit: e => { e.preventDefault(); send(as.draft); } },
    as.msgs.length ? '' : sampleChips(),
    h('div.ai-row', ta, mic, h('button.btn.primary.auto', { type: 'submit', disabled: as.busy }, 'ส่ง')));
}
