// Saduq Care AI — เล่าปัญหา แล้วได้ 3 ตัวเลือก
//
//   ① Chat Bot        รับเรื่องที่เล่า (พิมพ์หรือพูด) เก็บเป็นบทสนทนา
//   ② AI เข้าใจโจทย์   ประโยค → ใคร · ปัญหา · พื้นที่ · ข้อจำกัด · บริการที่ต้องการ (+ ราวกันตกเหตุฉุกเฉิน)
//   ③ ค้นบริการ        กรองตามประเภทบริการและพื้นที่
//   ④ AI จัดอันดับ     5 ปัจจัยถ่วงน้ำหนัก → 3 ตัวเลือกที่ต่างกัน พร้อมเหตุผล
//
// ทุกขั้นเป็นฟังก์ชันแยก เปลี่ยนตัวใดตัวหนึ่งได้ เช่น ให้โมเดลภาษาทำขั้น ② แทนตัวคิดในเครื่อง:
//   const ai = createPipeline({ understand: async (turns, ctx) => callMyLLM(turns, ctx) })  // ต้องคืนรูปแบบ Understanding (understand.js)
// ขั้น ③ ④ ยังเป็นโค้ดที่ตรวจสอบได้ — โมเดลไม่ได้เลือกร้านเอง จึงไม่แต่งร้านที่ไม่มีอยู่จริงขึ้นมา
import { understand as localUnderstand } from './understand.js';
import { retrieve as localRetrieve } from './retrieve.js';
import { rank as localRank } from './rank.js';

export const STAGES = [
  { id: 'chat', name: 'Chat Bot', sub: 'รับเรื่องที่เล่า' },
  { id: 'understand', name: 'AI เข้าใจโจทย์', sub: 'จับว่าต้องการบริการแบบไหน' },
  { id: 'retrieve', name: 'ค้นบริการ', sub: 'กรองตามประเภทและพื้นที่' },
  { id: 'rank', name: 'AI จัดอันดับ', sub: 'เรียงตามความเหมาะสมกับโจทย์' },
];

export function createPipeline({ understand = localUnderstand, retrieve = localRetrieve, rank = localRank, n = 3 } = {}) {
  /**
   * @param {string[]} turns ข้อความผู้ใช้ทั้งบทสนทนา
   * @param {{ homeArea?: string, people?: {name:string}[] }} ctx
   * @param {(stageId:string, output:any)=>void} [onStage] เรียกทุกครั้งที่จบหนึ่งขั้น (ให้หน้าจอแสดงทีละขั้น)
   */
  async function run(turns, ctx = {}, onStage = () => {}) {
    const trace = [];
    const step = async (id, fn) => {
      const t0 = performance.now(), output = await fn();
      trace.push({ id, ms: Math.max(1, Math.round(performance.now() - t0)), output });
      onStage(id, output);
      return output;
    };
    const chat = await step('chat', () => ({ turns: turns.length, last: turns.at(-1) || '' }));
    const u = await step('understand', () => understand(turns, ctx));
    if (u.emergency) return { status: 'emergency', u, trace, options: [] };
    if (!u.intents.length) return { status: 'clarify', u, trace, options: [], ask: 'problem' };
    const found = await step('retrieve', () => retrieve(u));
    const ranked = await step('rank', () => rank(u, found, { n }));
    return { status: 'ok', chat, u, found, ...ranked, trace, ask: u.missing.includes('province') ? 'province' : null };
  }
  return { run, stages: STAGES };
}

export const careAI = createPipeline();
