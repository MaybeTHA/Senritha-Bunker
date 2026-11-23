// AI จำลอง: เข้าใจโจทย์ → ค้นบริการ → จัดอันดับ → 3 ตัวเลือก (กฎในเครื่องล้วน ไม่ส่งข้อความออกไปไหน)
import { allProviders, FEATS } from './providers.js';

/** กฎจับความต้องการ: คำที่เจอ → ความต้องการ · บริการที่เกี่ยว (น้ำหนัก) · คุณสมบัติที่ต้องมี */
const RULES = [
  { rx: /หาหมอ|โรงพยาบาล|รพ\.|นัดหมอ|ไปตรวจ|รับยาที่|ฟังผล|คลินิก/, need: 'ต้องการบริการพาไปโรงพยาบาล', svc: { 'l-escort': 3, 'l-ride': 3, 'l-wheel': 2, 'h-appt': 1 }, feats: ['escort'] },
  { rx: /เดินไม่สะดวก|เดินไม่ไหว|เดินไม่ได้|เดินลำบาก|เดินช้า|ขาไม่ดี|ปวดเข่า|รถเข็น|วีลแชร์|ทรงตัว|หกล้ม|ล้มบ่อย/, need: 'เดินไม่สะดวก ต้องรองรับรถเข็น', svc: { 'l-wheel': 2, 'l-escort': 1, 'h-physio': 1, 's-mobility': 1 }, feats: ['wheelchair'] },
  { rx: /ทุกเดือน|เดือนละ|ประจำ|ทุกสัปดาห์|อาทิตย์ละ|บ่อย ?ๆ?/, need: 'ใช้บริการเป็นประจำ', svc: {}, feats: ['monthly'] },
  { rx: /กินข้าว|อาหาร|ทำกับข้าว|หิว|ข้าวต้ม|ไม่มีคนทำกับข้าว|มื้อ/, need: 'ต้องการอาหารส่งถึงบ้าน', svc: { 'l-meal': 3 }, feats: [] },
  { rx: /เคี้ยว|ฟันไม่ดี|ฟันปลอม|กลืน/, need: 'เคี้ยวลำบาก ต้องอาหารอ่อน', svc: { 'l-meal': 1 }, feats: ['soft'] },
  { rx: /เบาหวาน|น้ำตาลสูง|คุมน้ำตาล/, need: 'เป็นเบาหวาน', svc: { 'l-meal': 1, 'h-check': 1, 's-health': 1 }, feats: ['diabetes'] },
  { rx: /อยู่บ้านคนเดียว|อยู่คนเดียว|ไม่มีคนดูแล|ไปทำงาน|ดูแลไม่ไหว|ไม่มีใครอยู่|ไม่มีเวลา/, need: 'ไม่มีคนอยู่ดูแลระหว่างวัน', svc: { 'l-care': 3, 'l-daycare': 3 }, feats: [] },
  { rx: /ติดเตียง|นอนติดเตียง|แผลกดทับ|ลุกไม่ได้|ลุกไม่ไหว/, need: 'ผู้ป่วยติดเตียง', svc: { 'l-care': 2, 'h-nurse': 3, 's-medical': 2, 'l-wheel': 1 }, feats: ['bedridden'] },
  { rx: /กลางคืน|ตอนดึก|นอนไม่หลับ|ค้างคืน|ทั้งคืน/, need: 'ต้องมีคนดูแลกลางคืน', svc: { 'l-care': 1, 'h-nurse': 1 }, feats: ['night'] },
  { rx: /กายภาพ|อัมพฤกษ์|อัมพาต|หลอดเลือดสมอง|stroke|ผ่าตัดเข่า|ฟื้นฟู|ฝึกเดิน/i, need: 'ต้องฟื้นฟูการเคลื่อนไหว', svc: { 'h-physio': 3 }, feats: ['home'] },
  { rx: /ทำความสะอาด|บ้านรก|ซักผ้า|แม่บ้าน|กวาดบ้าน|ถูบ้าน/, need: 'ต้องการคนช่วยงานบ้าน', svc: { 'l-house': 3 }, feats: [] },
  { rx: /ห้องน้ำ|ลื่น|ราวจับ|บันได|ปรับบ้าน|พื้นกันลื่น/, need: 'บ้านไม่ปลอดภัย เสี่ยงหกล้ม', svc: { 'l-repair': 3 }, feats: [] },
  { rx: /อาบน้ำ|ตัดผม|ตัดเล็บ|แต่งตัว/, need: 'ต้องการคนช่วยดูแลส่วนตัว', svc: { 'l-personal': 3 }, feats: ['home'] },
  { rx: /ลืมกินยา|ส่งยา|รับยาแทน|ยาหมด/, need: 'เรื่องยา', svc: { 's-delivery': 2, 'h-consult': 1 }, feats: [] },
  { rx: /เหงา|เบื่อ|ไม่มีเพื่อน|ซึม|อยากออกไปข้างนอก|ไม่ได้คุยกับใคร/, need: 'อยากมีกิจกรรมและเพื่อน', svc: { 'c-events': 3, 'l-daycare': 2 }, feats: [] },
  { rx: /ปรึกษา|ถามหมอ|ไม่อยากไปโรงพยาบาล|ออนไลน์|วิดีโอคอล/, need: 'อยากปรึกษาแพทย์โดยไม่ต้องเดินทาง', svc: { 'h-consult': 3 }, feats: ['online'] },
  { rx: /ตรวจสุขภาพ|ความดันสูง|ตรวจเลือด|เช็กสุขภาพ/, need: 'ต้องการตรวจสุขภาพ', svc: { 'h-check': 2, 'h-appt': 1 }, feats: [] },
  { rx: /ผ้าอ้อม|แพมเพิส|แผ่นรองซับ|ของใช้/, need: 'ต้องการของใช้ส่งถึงบ้าน', svc: { 's-daily': 3 }, feats: ['home'] },
  { rx: /(?<!โรง)พยาบาล|ทำแผล|ฉีดยา|สายให้อาหาร/, need: 'ต้องการพยาบาล', svc: { 'h-nurse': 3 }, feats: ['nurse'] },
  { rx: /ผู้หญิง|ขอคนผู้หญิง/, need: 'อยากได้ผู้ให้บริการหญิง', svc: {}, feats: ['female'] },
  { rx: /ประหยัด|ราคาถูก|งบน้อย|ไม่แพง|งบจำกัด/, need: 'งบประมาณจำกัด', svc: {}, feats: ['cheap'] },
];
const PROVINCES = { 'กรุงเทพ': 'กรุงเทพฯ', 'กทม': 'กรุงเทพฯ', 'นนทบุรี': 'นนทบุรี', 'ปทุมธานี': 'ปทุมธานี', 'เชียงใหม่': 'เชียงใหม่', 'เชียงราย': 'เชียงราย', 'ขอนแก่น': 'ขอนแก่น',
  'อุดร': 'อุดรธานี', 'โคราช': 'นครราชสีมา', 'นครราชสีมา': 'นครราชสีมา', 'ชลบุรี': 'ชลบุรี', 'ศรีราชา': 'ชลบุรี', 'พัทยา': 'ชลบุรี', 'ระยอง': 'ระยอง', 'ภูเก็ต': 'ภูเก็ต', 'หาดใหญ่': 'สงขลา',
  'สงขลา': 'สงขลา', 'สุราษฎร์': 'สุราษฎร์ธานี', 'พิษณุโลก': 'พิษณุโลก', 'นครปฐม': 'นครปฐม', 'สมุทรปราการ': 'สมุทรปราการ', 'บางนา': 'กรุงเทพฯ' };
export const findProvince = t => { for (const [k, v] of Object.entries(PROVINCES)) if (t.includes(k)) return v; return null; };
const WHO = [[/คุณแม่|แม่/, 'แม่'], [/คุณพ่อ|พ่อ/, 'พ่อ'], [/ยาย|ย่า/, 'ยาย/ย่า'], [/ตา(?!ย|ม|ร)|ปู่/, 'ตา/ปู่']];

/** 1–2: เข้าใจโจทย์ — คืน null ถ้าไม่เจออะไรเลย */
export function understand(text, { homeProvince = null } = {}) {
  const t = String(text || '');
  const hits = RULES.filter(r => r.rx.test(t));
  const svc = {}, feats = new Set();
  for (const r of hits) { for (const [k, w] of Object.entries(r.svc)) svc[k] = (svc[k] || 0) + w; r.feats.forEach(f => feats.add(f)); }
  if (!Object.keys(svc).length) return null;
  const said = findProvince(t), who = WHO.find(([rx]) => rx.test(t))?.[1] || null;
  return { needs: hits.map(r => r.need), svc, feats: [...feats], province: said || homeProvince, provinceSaid: !!said, who };
}

/** 3–4: ค้นบริการ แล้วจัดอันดับ → 3 ตัวเลือก (คนละบริการเมื่อทำได้) */
export function rank(u) {
  const pool = allProviders(), cands = pool.filter(p => u.svc[p.sid]);
  const inArea = p => !u.province || p.province === u.province || /ทั่วประเทศ|ออนไลน์/.test(p.area);
  const filtered = cands.filter(inArea);
  const maxW = Math.max(...Object.values(u.svc));
  const score = p => {
    const have = u.feats.filter(f => p.feats.includes(f)), miss = u.feats.filter(f => !p.feats.includes(f));
    const s = (u.svc[p.sid] / maxW) * 30 + have.length * 14 - miss.length * 7 + (inArea(p) ? 18 : -12) + (p.rating - 4) * 22 + Math.log10(p.reviews + 1) * 3;
    const max = 30 + u.feats.length * 14 + 18 + 22 + 9;
    return { p, s, fit: Math.max(35, Math.min(98, Math.round((s / max) * 100))), have, miss, local: inArea(p) };
  };
  const all = cands.map(score).sort((a, b) => b.s - a.s);
  const picks = [], seen = new Set();
  for (const x of all) if (picks.length < 3 && !seen.has(x.p.sid)) { picks.push(x); seen.add(x.p.sid); }
  for (const x of all) if (picks.length < 3 && !picks.includes(x)) picks.push(x);
  return { total: pool.length, services: Object.keys(u.svc).sort((a, b) => u.svc[b] - u.svc[a]), candidates: cands.length, filtered: filtered.length, picks: picks.sort((a, b) => b.s - a.s) };
}
export const featLabel = f => FEATS[f] || f;
export const EXAMPLES = ['แม่เดินไม่สะดวก ต้องไปหาหมอทุกเดือน', 'พ่อเป็นเบาหวาน อยู่บ้านคนเดียวตอนกลางวัน', 'ยายติดเตียง ต้องมีคนดูแลกลางคืน อยู่เชียงใหม่', 'แม่ฟันไม่ดี เคี้ยวลำบาก ไม่มีคนทำกับข้าว'];
