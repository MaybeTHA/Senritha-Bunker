// ขั้น 2 · AI เข้าใจโจทย์ — ประโยคที่เล่า → โจทย์ที่เป็นโครงสร้าง (ใคร · ปัญหาอะไร · ที่ไหน · ข้อจำกัด · ต้องการบริการแบบไหน)
// ตัวนี้คิดในเครื่อง (ไม่ส่งข้อความออกไปไหน) · จะเปลี่ยนเป็นโมเดลภาษาก็ได้ ขอแค่คืนค่ารูปแบบเดียวกัน (ดู pipeline.js)
import { NEEDS, MODIFIERS, EMERGENCY, SERVICE_SIGNALS, PLACES, PEOPLE, RELATED, needLabel } from './knowledge.js';

const lastMatch = (text, table) => {
  let best = null;
  for (const [name, re] of table) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    for (const m of text.matchAll(g)) if (!best || m.index > best.at) best = { name, at: m.index, word: m[0] };
  }
  return best;
};

/**
 * @param {string[]|string} turns ข้อความที่ผู้ใช้พิมพ์ (ทั้งบทสนทนา ข้อความหลังสุดชนะเมื่อขัดกัน)
 * @param {{ homeArea?: string, people?: {name:string}[] }} ctx ข้อมูลที่แอปรู้อยู่แล้ว
 * @returns {Understanding}
 */
export function understand(turns, ctx = {}) {
  const list = (Array.isArray(turns) ? turns : [turns]).map(t => String(t || '').trim()).filter(Boolean);
  const text = list.join(' \n ');

  // ราวกันตก: เหตุฉุกเฉินดูเฉพาะข้อความล่าสุด
  const emergencyWord = (list.at(-1) || '').match(EMERGENCY)?.[0] || null;

  // ความต้องการ + หลักฐาน (คำที่ผู้ใช้พูดจริง)
  const needs = NEEDS.flatMap(([id, label, re]) => { const m = text.match(re); return m ? [{ id, label, evidence: m[0] }] : []; });
  const has = new Set(needs.map(n => n.id));
  const mods = Object.fromEntries(Object.entries(MODIFIERS).map(([k, [re]]) => [k, text.match(re)?.[0] || null]));

  // งบ: "ไม่เกิน 500" · "งบ 1,000 บาท"
  const bm = [...text.matchAll(/(?:งบ(?:ประมาณ)?|ไม่เกิน|ประมาณ|ราว ?ๆ?|ต่ำกว่า)\s*([\d,]{2,7})\s*(?:บาท|฿)?/g)].at(-1);
  const budget = bm ? Number(bm[1].replace(/,/g, '')) : null;

  // ที่ไหน: ข้อความล่าสุดที่บอกจังหวัด > ที่อยู่ในโปรไฟล์
  const place = lastMatch(text, PLACES);
  const home = ctx.homeArea ? lastMatch(ctx.homeArea, PLACES) : null;
  const province = place?.name || home?.name || null;
  const provinceFrom = place ? `จากที่เล่า "${place.word}"` : home ? 'จากที่อยู่ในโปรไฟล์' : null;

  // ใคร: ชื่อสมาชิกครอบครัวก่อน แล้วค่อยคำเรียก
  const named = (ctx.people || []).find(p => p.name && text.includes(p.name));
  const who = named?.name || lastMatch(text, PEOPLE)?.name || null;

  // ความต้องการ → บริการ (ผลรวมถ่วงน้ำหนัก) แล้วทำเป็นความมั่นใจ 0–1
  const raw = Object.entries(SERVICE_SIGNALS).map(([sid, s]) => {
    const hits = Object.entries(s.w).filter(([n]) => has.has(n)).sort((a, b) => b[1] - a[1]);
    return { sid, goal: s.goal, score: hits.reduce((a, [, w]) => a + w, 0), because: hits.map(([n]) => n) };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  const top = raw[0]?.score || 1;
  const intents = raw.map(x => ({ ...x, conf: Math.min(1, x.score / Math.max(top, 1.2)) })).filter(x => x.conf >= .2);

  const related = [...new Set(needs.flatMap(n => RELATED[n.id] || []))];
  const missing = [];
  if (!intents.length) missing.push('problem');
  if (!province) missing.push('province');

  return { turns: list, text, who, needs, mods, budget, province, provinceFrom, intents, related, missing, emergency: emergencyWord,
    summary: summarize({ who, needs, mods, intents }) };
}

/** สรุปโจทย์เป็นประโยคเดียว เช่น "คุณแม่ · เดินไม่สะดวก + ต้องพบแพทย์ · เป็นประจำ → ต้องการ: มีรถพาไปและรอรับกลับ" */
function summarize({ who, needs, mods, intents }) {
  if (!needs.length) return '';
  const parts = [who, needs.slice(0, 3).map(n => n.label).join(' + '), mods.recurring && 'เป็นประจำ', mods.urgent && 'เร่งด่วน', mods.cheap && 'เน้นประหยัด'].filter(Boolean);
  return parts.join(' · ') + (intents[0] ? ` → ต้องการ: ${intents[0].goal}` : '');
}

export { needLabel };

/**
 * @typedef {object} Understanding
 * @property {string[]} turns
 * @property {string|null} who
 * @property {{id:string,label:string,evidence:string}[]} needs
 * @property {{recurring:?string,urgent:?string,cheap:?string,quality:?string}} mods
 * @property {number|null} budget
 * @property {string|null} province
 * @property {{sid:string,goal:string,conf:number,because:string[]}[]} intents
 * @property {string[]} related   รหัสบริการรัฐที่ควรรู้
 * @property {string[]} missing   'problem' | 'province'
 * @property {string|null} emergency
 * @property {string} summary
 */
