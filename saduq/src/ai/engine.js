// Saduq AI — เล่าปัญหา แล้วได้ 3 ตัวเลือก
// ท่อ 4 ขั้น (แต่ละขั้นเป็นฟังก์ชันล้วน ทดสอบแยกได้ และเปลี่ยนตัวทำงานได้):
//   1. chat       รับข้อความที่ผู้ดูแลเล่า
//   2. understand AI เข้าใจโจทย์: จับ "ความต้องการ" (intent) + ข้อมูลประกอบ (ใคร พื้นที่ ความถี่ การเคลื่อนไหว เรื่องเงิน)
//   3. retrieve   ค้นบริการ: กรองแค็ตตาล็อกจริงตามประเภทความต้องการและพื้นที่/สิทธิ
//   4. rank       AI จัดอันดับ: ให้คะแนนความเหมาะสมกับโจทย์และโปรไฟล์ผู้รับการดูแล แล้วเลือก 3 ตัวเลือกที่ไม่ซ้ำแนวกัน
// ตัวเข้าใจภาษาเริ่มต้นทำงานในเครื่อง (ไทย · ไม่ส่งข้อมูลออก) — เสียบโมเดลภาษา (LLM) แทนได้ด้วย setUnderstander()
// ผลลัพธ์ต้องมาจากแค็ตตาล็อกจริงเท่านั้น: AI เลือกและเรียง ไม่แต่งบริการใหม่ขึ้นมา
import { SERVICES, svcOf } from '../domain/catalog.js';
import { PRODUCTS, productOf } from '../domain/market.js';

/* ================= ขั้น 2: ความต้องการที่รู้จัก ================= */
// kw: [คำ/วลี, น้ำหนัก] — วลียาวให้น้ำหนักมากกว่าคำเดี่ยว
export const INTENTS = {
  emergency: { label: 'อาการฉุกเฉิน', icon: 'siren', kw: [['หมดสติ', 5], ['ไม่รู้สึกตัว', 5], ['เจ็บหน้าอก', 5], ['แน่นหน้าอก', 5], ['หายใจไม่ออก', 5], ['ชัก', 4], ['พูดไม่ชัด', 5], ['ปากเบี้ยว', 5], ['แขนขาอ่อนแรง', 5], ['อ่อนแรงครึ่งซีก', 5], ['ล้มหัวฟาด', 5], ['เลือดออกไม่หยุด', 5]] },
  transport: { label: 'การเดินทางไปหาหมอ', icon: 'car', kw: [['ไปหาหมอ', 3], ['ไปโรงพยาบาล', 3], ['ไป รพ', 3], ['พาไป', 2.5], ['เดินทาง', 2.5], ['ไม่มีรถ', 3], ['รถรับส่ง', 3], ['นัดหมอ', 2], ['ไปตามนัด', 2.5], ['ไปรับยา', 2], ['ขึ้นรถ', 2], ['แท็กซี่', 2]] },
  mobility: { label: 'การเคลื่อนไหว/เดิน', icon: 'walk', kw: [['เดินไม่สะดวก', 3.5], ['เดินไม่ไหว', 3.5], ['เดินไม่ได้', 3.5], ['เดินลำบาก', 3.5], ['ขาไม่มีแรง', 3], ['ทรงตัว', 2.5], ['ล้มบ่อย', 3], ['หกล้ม', 3], ['วีลแชร์', 3], ['รถเข็น', 3], ['ไม้เท้า', 2.5], ['วอล์คเกอร์', 2.5], ['ปวดเข่า', 2], ['ข้อเข่า', 2]] },
  bedridden: { label: 'ติดเตียง/พึ่งพิง', icon: 'bed', kw: [['ติดเตียง', 4], ['นอนติดเตียง', 4], ['ลุกไม่ได้', 3.5], ['ลุกเองไม่ได้', 3.5], ['แผลกดทับ', 4], ['พลิกตัว', 3], ['ป้อนข้าว', 2.5], ['ให้อาหารทางสาย', 3], ['เตียงผู้ป่วย', 3]] },
  incont: { label: 'กลั้นปัสสาวะ/ผ้าอ้อม', icon: 'bag', kw: [['ผ้าอ้อม', 3.5], ['แพมเพิส', 3.5], ['ฉี่ราด', 3.5], ['กลั้นไม่ได้', 3.5], ['กลั้นปัสสาวะ', 3.5], ['ปัสสาวะเล็ด', 3], ['แผ่นรองซับ', 3], ['ขับถ่าย', 2]] },
  carehelp: { label: 'ต้องการคนช่วยดูแล', icon: 'hand', kw: [['ไม่มีคนดูแล', 4], ['ไม่มีใครดูแล', 4], ['ต้องไปทำงาน', 3], ['ทำงานทั้งวัน', 3], ['อยู่คนเดียว', 3], ['ไม่ว่าง', 2.5], ['จ้างคน', 3], ['คนดูแล', 3], ['ผู้ดูแล', 2], ['พี่เลี้ยง', 3], ['ฝากดูแล', 3.5], ['ดูแลไม่ไหว', 3.5], ['เหนื่อย', 1.5], ['กลางวัน', 1.5]] },
  sick: { label: 'เจ็บป่วยเล็กน้อย', icon: 'steth', kw: [['ไม่สบาย', 3], ['เป็นไข้', 3], ['ไข้', 2], ['ไอ', 2], ['เจ็บคอ', 3], ['ปวดหัว', 2.5], ['ท้องเสีย', 3], ['ผื่น', 2.5], ['คัน', 1.5], ['ปรึกษาหมอ', 3], ['ถามหมอ', 3], ['หมอออนไลน์', 4]] },
  meds: { label: 'การใช้ยา', icon: 'pill', kw: [['ลืมกินยา', 4], ['กินยา', 2.5], ['ยาหมด', 3.5], ['รับยา', 3], ['ยาประจำ', 3], ['จัดยา', 3], ['ยาเยอะ', 3], ['ยาความดัน', 2.5], ['ยาเบาหวาน', 2.5], ['ให้ยา', 2.5]] },
  monitor: { label: 'วัด/ติดตามสุขภาพ', icon: 'heart', kw: [['ความดัน', 3], ['น้ำตาล', 3], ['เบาหวาน', 2.5], ['วัดไข้', 2.5], ['ออกซิเจนในเลือด', 3.5], ['ชีพจร', 2.5], ['เครื่องวัด', 3]] },
  breathing: { label: 'การหายใจ/ออกซิเจน', icon: 'spark', kw: [['หอบ', 3], ['เหนื่อยหอบ', 3.5], ['หายใจลำบาก', 3.5], ['ออกซิเจน', 3.5], ['ถุงลมโป่งพอง', 3.5], ['ปอด', 2]] },
  home: { label: 'บ้านไม่ปลอดภัย', icon: 'tool', kw: [['ห้องน้ำ', 3], ['ลื่น', 3], ['ราวจับ', 3.5], ['บันได', 2.5], ['พื้นลื่น', 3.5], ['ซ่อมบ้าน', 3.5], ['ทางลาด', 3.5], ['อาบน้ำ', 2]] },
  money: { label: 'ค่าใช้จ่าย/รายได้', icon: 'coin', kw: [['ไม่มีเงิน', 4], ['เงินไม่พอ', 4], ['ค่าใช้จ่าย', 3], ['แพง', 2.5], ['รายได้น้อย', 3.5], ['ประหยัด', 2], ['ฟรี', 2], ['เบี้ยยังชีพ', 4], ['สวัสดิการ', 3], ['สิทธิ', 2]] },
  mental: { label: 'ความเครียด/อารมณ์', icon: 'heart', kw: [['เครียด', 3], ['เศร้า', 3], ['ซึม', 3], ['เหงา', 3], ['นอนไม่หลับ', 3], ['หมดไฟ', 3.5], ['ท้อ', 3], ['หลงลืม', 2.5], ['สมองเสื่อม', 3]] },
  scam: { label: 'มิจฉาชีพ', icon: 'shield', kw: [['มิจฉาชีพ', 4], ['โดนหลอก', 4], ['แก๊งคอลเซ็นเตอร์', 4], ['โอนเงิน', 3], ['otp', 3], ['ลิงก์แปลก', 3]] },
};

const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const nospace = s => norm(s).replace(/ /g, '');
const RELWORDS = [[/แม่/, 'แม่'], [/พ่อ/, 'พ่อ'], [/ยาย/, 'ปู่/ย่า/ตา/ยาย'], [/ย่า/, 'ปู่/ย่า/ตา/ยาย'], [/(^|[^ห])ตา(?![มยงน่้])/, 'ปู่/ย่า/ตา/ยาย'], [/ปู่/, 'ปู่/ย่า/ตา/ยาย'], [/สามี|ภรรยา/, 'คู่สมรส']];
const NEG = /(ไม่ได้|ไม่ค่อย|ไม่|ยังไม่)$/; // "ไม่ได้ติดเตียง" → ไม่นับ
/** เจอคำนี้แบบไม่ถูกปฏิเสธ (ดู 8 ตัวอักษรก่อนหน้า) */
export function has(t, k) {
  for (let i = t.indexOf(k); i >= 0; i = t.indexOf(k, i + k.length)) if (/^ไม่/.test(k) || !NEG.test(t.slice(Math.max(0, i - 8), i))) return true;
  return false;
}
const any = (t, words) => words.some(w => has(t, w));

/** ตัวเข้าใจโจทย์เริ่มต้น: ให้คะแนนแต่ละ intent จากวลีที่เจอ + ดึงข้อมูลประกอบ */
export function localUnderstand(text, { people = [] } = {}) {
  const t = nospace(text), raw = norm(text), scores = {}, hits = {};
  for (const [id, it] of Object.entries(INTENTS)) {
    let sc = 0; const found = [];
    for (const [w, wt] of it.kw) {
      if (has(t, nospace(w))) { sc += wt; found.push(w); }
    }
    // คำเดี่ยวสั้น ๆ ที่ถูกนับซ้ำในวลียาว → กันไม่ให้คะแนนพองเกิน
    if (sc) { scores[id] = Math.min(sc, 8); hits[id] = found; }
  }
  const intents = Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([id, score]) => ({ id, score: +(score / 8).toFixed(2), label: INTENTS[id].label, words: hits[id] }));
  // ---- ข้อมูลประกอบ (entities) ----
  const ent = {};
  if (/ทุกเดือน|ทุกอาทิตย์|ทุกสัปดาห์|ประจำ|บ่อย|ทุกวัน|เดือนละ|อาทิตย์ละ/.test(t)) ent.recurring = true;
  if (/กรุงเทพ|กทม|bangkok/.test(t)) ent.bkk = true;
  else if (/ต่างจังหวัด|จังหวัด|อำเภอ|ตำบล|หมู่บ้าน|ชนบท|เชียงใหม่|ขอนแก่น|โคราช|อุบล|ภูเก็ต|หาดใหญ่|สงขลา|นครปฐม|นนทบุรี|ปทุม/.test(t)) ent.bkk = false;
  if (any(t, ['ติดเตียง', 'ลุกไม่ได้', 'ลุกเองไม่ได้'])) ent.mobility = 'bed';
  else if (any(t, ['วีลแชร์', 'นั่งรถเข็น'])) ent.mobility = 'wheel';
  else if (any(t, ['เดินไม่สะดวก', 'เดินลำบาก', 'เดินไม่ไหว', 'ทรงตัว', 'ไม้เท้า', 'ต้องพยุง'])) ent.mobility = 'assist';
  if (/ไม่มีเงิน|เงินไม่พอ|รายได้น้อย|แพง|ประหยัด|ฟรี/.test(t)) ent.budget = 'low';
  if (/บัตรทอง|30บาท/.test(t)) ent.rights = 'ucs';
  else if (/ประกันสังคม/.test(t)) ent.rights = 'sso';
  else if (/ข้าราชการ|เบิกได้/.test(t)) ent.rights = 'gov';
  const age = raw.match(/(?:อายุ\s*)?(\d{2,3})\s*(?:ปี|ขวบ)/); if (age && +age[1] >= 40 && +age[1] <= 120) ent.age = +age[1];
  // ใคร: ตรงชื่อผู้รับการดูแลก่อน แล้วค่อยดูคำเรียก (แม่ พ่อ ยาย)
  const byName = people.find(p => p.name && t.includes(nospace(p.name).replace(/^คุณ/, '')));
  const rel = RELWORDS.find(([re]) => re.test(t));
  const who = byName || (rel && people.find(p => p.relation === rel[1])) || null;
  if (who) ent.person_id = who.id;
  if (rel) ent.relation = rel[1];
  return { text: String(text || ''), intents, entities: ent, engine: 'local-th-1' };
}

let understander = localUnderstand;
/** เปลี่ยนตัวเข้าใจโจทย์ (เช่น LLM ผ่าน backend) — ต้องคืนรูปแบบเดียวกับ localUnderstand; พังเมื่อไรจะถอยกลับตัวในเครื่องเอง */
export const setUnderstander = fn => { understander = fn || localUnderstand; };

/* ================= ขั้น 3: ดัชนีของจริงในแค็ตตาล็อก ================= */
// need: ความต้องการที่ตอบได้ (น้ำหนัก 0–1) · area: 'bkk' = เฉพาะกรุงเทพฯ · cost: free | paid | tool · needs: เงื่อนไข
const S = (id, need, o = {}) => ({ kind: 'service', id, need, area: 'all', cost: 'free', ...o });
const PR = (id, need, o = {}) => ({ kind: 'product', id, need, area: 'all', cost: 'paid', ...o });
export const INDEX = [
  S('l-ride', { transport: 1, mobility: .5 }, { area: 'bkk', icon: 'car', angle: 'รถรับส่ง' }),
  S('l-loan', { mobility: 1, bedridden: .9, breathing: .7, transport: .3 }, { area: 'bkk', icon: 'bed', angle: 'อุปกรณ์' }),
  S('l-ltc', { bedridden: 1, carehelp: .9, mobility: .5, incont: .3 }, { icon: 'hand', angle: 'คนช่วยดูแล', needsDep: true }),
  S('l-daycare', { carehelp: .8, mental: .5 }, { icon: 'smile', angle: 'คนช่วยดูแล' }),
  S('l-hire', { carehelp: .7, transport: .3, bedridden: .4 }, { cost: 'paid', icon: 'users', angle: 'คนช่วยดูแล' }),
  S('f-ask', { transport: .7, carehelp: .6, meds: .3 }, { cost: 'tool', icon: 'users', angle: 'คนช่วยดูแล', needsTeam: true }),
  S('h-telemed', { sick: 1, transport: .45, meds: .3 }, { icon: 'phone', angle: 'ลดการเดินทาง', rights: 'ucs' }),
  S('h-pharmacy', { meds: .9, sick: .8, transport: .4 }, { icon: 'pill', angle: 'ลดการเดินทาง', rights: 'ucs' }),
  S('h-med', { meds: 1 }, { cost: 'tool', icon: 'pill', angle: 'เครื่องมือ' }),
  S('h-appt', { transport: .35, meds: .2 }, { cost: 'tool', icon: 'steth', angle: 'เครื่องมือ', recurringBoost: .3 }),
  S('b-diaper', { incont: 1, bedridden: .6, money: .3 }, { icon: 'bag', angle: 'สิทธิ' }),
  S('b-allowance', { money: 1 }, { icon: 'coin', angle: 'สิทธิ', needsAge: 60 }),
  S('b-repair', { home: 1, money: .4, mobility: .3 }, { icon: 'tool', angle: 'สิทธิ', needsAge: 60 }),
  S('b-1300', { money: .5, carehelp: .4 }, { icon: 'phone', angle: 'สายด่วน' }),
  S('e-1323', { mental: 1, carehelp: .3 }, { icon: 'heart', angle: 'สายด่วน' }),
  S('c-digital', { scam: 1 }, { icon: 'shield', angle: 'สายด่วน' }),
  S('c-training', { carehelp: .4, bedridden: .3 }, { icon: 'book', angle: 'ความรู้' }),
  S('e-1669', { emergency: 1 }, { icon: 'siren', angle: 'ฉุกเฉิน' }),
  PR('p-wheel-soma', { mobility: .9, transport: .5 }, { icon: 'walk', angle: 'อุปกรณ์' }),
  PR('p-walker-yamada', { mobility: .8 }, { icon: 'walk', angle: 'อุปกรณ์' }),
  PR('p-diaper-feelfree', { incont: .8, bedridden: .4 }, { icon: 'bag', angle: 'อุปกรณ์' }),
  PR('p-diaper-lifree', { incont: .7 }, { icon: 'bag', angle: 'อุปกรณ์' }),
  PR('p-bed-allwell', { bedridden: .8 }, { icon: 'bed', angle: 'อุปกรณ์' }),
  PR('p-mattress-air', { bedridden: .8 }, { icon: 'bed', angle: 'อุปกรณ์' }),
  PR('p-o2-yuwell3', { breathing: .8 }, { icon: 'spark', angle: 'อุปกรณ์' }),
  PR('p-oxi-yuwell', { breathing: .6, monitor: .6 }, { icon: 'activity', angle: 'อุปกรณ์' }),
  PR('p-bp-omron', { monitor: .9 }, { icon: 'heart', angle: 'อุปกรณ์' }),
  PR('p-glu-accu', { monitor: .7 }, { icon: 'pill', angle: 'อุปกรณ์' }),
  PR('p-shower-chair', { home: .8, mobility: .3 }, { icon: 'shield', angle: 'อุปกรณ์' }),
  PR('p-grab-bar', { home: .7, mobility: .3 }, { icon: 'shield', angle: 'อุปกรณ์' }),
];
export const itemOf = x => x.kind === 'product' ? productOf(x.id) : svcOf(x.id);

/** รวมโปรไฟล์ที่ผู้ดูแลบันทึกไว้กับสิ่งที่เพิ่งเล่า (สิ่งที่เล่าใหม่ชนะ) */
export function contextOf(u, people = [], { teamSize = 0 } = {}) {
  // คนเดียวในรายชื่อ → ใช้คนนั้น เว้นแต่เล่าถึงคนอื่น (เช่น เล่าว่า "พ่อ" แต่ที่บันทึกไว้คือแม่)
  const p = people.find(x => x.id === u.entities.person_id) || (people.length === 1 && (!u.entities.relation || people[0].relation === u.entities.relation) ? people[0] : null);
  const e = u.entities;
  return {
    person: p, teamSize,
    bkk: e.bkk ?? p?.bkk ?? null,
    mobility: e.mobility || p?.mobility || null,
    age: e.age || p?.age || null,
    rights: e.rights || p?.rights || null,
    budget: e.budget || null,
    recurring: !!e.recurring,
  };
}

/** ขั้น 3: กรองตามประเภทความต้องการ + พื้นที่/สิทธิ/อายุ — คืนรายการพร้อมเหตุผลที่ถูกตัดออก */
export function retrieve(u, ctx) {
  const want = new Set(u.intents.map(i => i.id)), kept = [], dropped = [];
  for (const x of INDEX) {
    if (!Object.keys(x.need).some(n => want.has(n))) continue;
    if (!itemOf(x)) continue;
    if (x.area === 'bkk' && ctx.bkk === false) { dropped.push({ x, why: 'มีเฉพาะกรุงเทพฯ' }); continue; }
    if (x.needsAge && ctx.age && ctx.age < x.needsAge) { dropped.push({ x, why: `ต้องอายุ ${x.needsAge} ปีขึ้นไป` }); continue; }
    kept.push(x);
  }
  return { kept, dropped, types: [...want].map(id => INTENTS[id].label), area: ctx.bkk === true ? 'กรุงเทพฯ' : ctx.bkk === false ? 'ต่างจังหวัด' : 'ไม่ระบุ (แสดงทุกพื้นที่)' };
}

/** ขั้น 4: ให้คะแนนความเหมาะสม (0–100) + เหตุผลที่อ่านเข้าใจได้ แล้วเลือก 3 ตัวเลือกที่ต่างแนวกัน */
export function rank(u, ctx, cands, k = 3) {
  const iw = Object.fromEntries(u.intents.map(i => [i.id, i.score]));
  const scored = cands.map(x => {
    const it = itemOf(x), why = [];
    let s = 0;
    for (const [n, w] of Object.entries(x.need)) if (iw[n]) { s += iw[n] * w * 10; if (w >= .4) why.push(`ตอบเรื่อง${INTENTS[n].label}`); }
    if (x.cost === 'free') { s += ctx.budget === 'low' ? 3 : 1.5; why.push('ไม่มีค่าใช้จ่าย'); }
    if (x.cost === 'paid' && ctx.budget === 'low') s -= 2.5;
    if (x.cost === 'paid' && x.kind === 'product' && it.price) why.push(`ราคาที่พบ ${it.price.text}`);
    if (x.area === 'bkk') { if (ctx.bkk) { s += 1.5; why.push('ให้บริการในกรุงเทพฯ'); } else { s -= 1.5; why.push('เฉพาะกรุงเทพฯ — ตรวจพื้นที่ก่อน'); } }
    if (x.rights) { if (ctx.rights === x.rights) { s += 2; why.push('ใช้สิทธิบัตรทองได้'); } else if (ctx.rights) { s -= 4; } else why.push('สำหรับสิทธิบัตรทอง'); }
    if (x.needsDep) { if (['bed', 'wheel', 'assist'].includes(ctx.mobility)) { s += 1.5; why.push('เหมาะกับผู้ที่ต้องพึ่งพิง'); } else s -= 1; }
    if (x.needsTeam) { if (ctx.teamSize) { s += 1; why.push(`มีคนในทีม ${ctx.teamSize} คน`); } else s -= 2; }
    if (ctx.recurring && (x.need.transport || x.recurringBoost)) { s += 1.5 + (x.recurringBoost || 0) * 3; if (x.need.transport) why.push('ใช้ซ้ำได้ทุกครั้งที่นัด'); }
    if (ctx.mobility === 'wheel' && x.id === 'p-walker-yamada') s -= 3;
    if (x.id === 'h-med' && /ลืม/.test(u.text)) { s += 4; why.push('ช่วยเรื่องลืมให้ยา — มีเตือนทุกมื้อ'); }
    if (ctx.mobility === 'bed' && x.id === 'p-diaper-feelfree') { s += 1; why.push('แบบเทปเหมาะกับผู้ติดเตียง'); }
    if (x.kind === 'product' && cands.some(c => c.kind === 'service' && c.cost === 'free' && c.need[Object.keys(x.need)[0]])) s -= .8; // มีของฟรีแนวเดียวกัน → ให้ของฟรีมาก่อน
    return { x, item: it, score: s, why: [...new Set(why)].slice(0, 3) };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
  // เลือกแบบกระจาย: ตัวที่แนว (angle) ซ้ำกับที่เลือกแล้วจะโดนลดคะแนน
  const picks = [], pool = [...scored];
  while (picks.length < k && pool.length) {
    pool.sort((a, b) => adj(b) - adj(a));
    picks.push(pool.shift());
  }
  function adj(r) { const same = picks.filter(p => p.x.angle === r.x.angle).length; return r.score - same * 4; }
  const top = picks[0]?.score || 1;
  return { picks: picks.map(r => ({ ...r, fit: Math.max(35, Math.min(98, Math.round(r.score / top * 92))) })), considered: scored.length };
}

/** ท่อทั้งหมด: คืนผลแต่ละขั้นให้หน้าจอแสดงทีละขั้น */
export async function runPipeline(text, { people = [], teamSize = 0 } = {}) {
  let u;
  try { u = await understander(text, { people }); if (!u?.intents) throw new Error('bad'); }
  catch { u = localUnderstand(text, { people }); }
  const urgent = u.intents.find(i => i.id === 'emergency');
  const ctx = contextOf(u, people, { teamSize });
  const found = retrieve(u, ctx);
  const ranked = rank(u, ctx, found.kept);
  return { understood: u, ctx, found, ranked, urgent: !!urgent, total: INDEX.length + 0 * SERVICES.length + 0 * PRODUCTS.length };
}
