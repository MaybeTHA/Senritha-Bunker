// ขั้น 4 · AI จัดอันดับ — ให้คะแนนทุกเจ้าจาก 5 ปัจจัยที่อธิบายได้ แล้วเลือก 3 ตัวเลือกที่ "ต่างกัน" (คนละแบบของทางออก)
import { FEATURES, FEATURE_WHY, SERVICE_SIGNALS } from './knowledge.js';

/** น้ำหนักปัจจัย (รวม = 1) · ปรับได้ตามโจทย์ */
export const WEIGHTS = { intent: .38, fit: .24, quality: .16, area: .14, price: .08 };
export const FACTOR_LABEL = { intent: 'ตรงโจทย์', fit: 'จุดเด่นตรงปัญหา', quality: 'คะแนนรีวิว', area: 'ใกล้บ้าน', price: 'ราคา' };

const AREA_SCORE = { local: 1, nationwide: .85, unknown: .6, far: .1 };
const clamp = x => Math.max(0, Math.min(1, x));
// คะแนนรีวิวแบบเผื่อจำนวนรีวิวน้อย (Bayesian average) แล้ววางบนช่วง 4.3–5.0
const bayes = p => (p.rating * p.reviews + 4.5 * 60) / (p.reviews + 60);
const etaHours = eta => /นาที|ภายในวัน|ใน ?30/.test(eta) ? 1 : /ชม/.test(eta) ? 2 : /พรุ่งนี้|1 วัน/.test(eta) ? 24 : /1–2|1-2|2 วัน/.test(eta) ? 36 : 72;

function weightsFor(u) {
  const w = { ...WEIGHTS };
  if (u.mods.cheap || u.budget) { w.price += .1; w.quality -= .05; w.fit -= .05; }
  if (u.mods.quality) { w.quality += .08; w.price -= .06; w.area -= .02; }
  return w;
}

export function scoreOne(c, u, ctx) {
  const { p } = c, text = `${p.badges.join(' ')} ${p.about}`;
  // นับเฉพาะความต้องการที่บริการนี้ตั้งใจแก้ (ร้านเตียงมี "รับประกัน" ไม่ได้แปลว่าเป็นผู้ดูแลที่ดี)
  const sw = SERVICE_SIGNALS[p.sid]?.w || {};
  const wanted = [...u.needs.map(n => n.id).filter(k => k in sw), u.mods.recurring && 'recurring', u.mods.cheap && 'cheap'].filter(k => k && FEATURES[k]);
  const matched = wanted.filter(k => FEATURES[k].test(text));
  const peers = ctx.bySid.get(p.sid);
  const lo = Math.min(...peers.map(x => x.price)), hi = Math.max(...peers.map(x => x.price));
  let price = hi > lo ? 1 - (p.price - lo) / (hi - lo) : .7;
  if (u.budget && p.price > u.budget) price = Math.max(0, price - .6);
  const f = {
    intent: c.intent.conf,
    fit: wanted.length ? clamp(matched.length / Math.min(wanted.length, 3)) : .5,
    quality: clamp((bayes(p) - 4.3) / .7),
    area: c.localOnly ? AREA_SCORE[c.area] : Math.max(AREA_SCORE[c.area], .85),
    price,
  };
  if (u.mods.urgent) f.area = f.area * .7 + .3 * clamp(1 - etaHours(p.eta) / 72);
  const w = ctx.w;
  const total = Object.keys(w).reduce((a, k) => a + w[k] * f[k], 0);

  // เหตุผลที่คนอ่านแล้วเชื่อ: อ้างคำที่ผู้ใช้พูด + จุดเด่นจริงของร้าน
  const ev = id => u.needs.find(n => n.id === id)?.evidence;
  const why = [
    { ok: true, text: `แก้ได้ตรง: ${c.intent.goal}`, quote: c.intent.because.slice(0, 2).map(ev).filter(Boolean) },
    ...matched.slice(0, 2).map(k => ({ ok: true, text: `${FEATURE_WHY[k]} — ${p.badges.find(b => FEATURES[k].test(b)) || 'ระบุไว้ในรายละเอียดร้าน'}`, quote: [ev(k) || u.mods[k]].filter(Boolean) })),
    { ok: f.quality >= .5, text: `รีวิว ${p.rating.toFixed(1)} จาก ${p.reviews.toLocaleString('th-TH')} รีวิว` },
    c.area === 'local' ? { ok: true, text: `อยู่ใน${u.province}` } : c.area === 'nationwide' ? { ok: true, text: 'ส่ง/ให้บริการได้ทั่วประเทศ' }
      : c.area === 'far' ? (c.localOnly ? { ok: false, text: `อยู่ ${p.area} — คนละจังหวัด ยังไม่มีเจ้าใกล้กว่านี้` } : { ok: true, text: `ส่งจาก ${p.province}` }) : { ok: false, text: 'ยังไม่รู้ว่าอยู่จังหวัดไหน (บอกได้ในแชต)' },
    u.budget ? (p.price <= u.budget ? { ok: true, text: `เริ่ม ${p.price.toLocaleString('th-TH')} บาท อยู่ในงบ` } : { ok: false, text: `เริ่ม ${p.price.toLocaleString('th-TH')} บาท เกินงบ ${u.budget.toLocaleString('th-TH')}` }) : null,
  ].filter(Boolean);
  return { ...c, factors: f, weights: w, score: total, why };
}

/**
 * จัดอันดับ แล้วเลือก n ตัวเลือก: ทีละ 1 เจ้าต่อบริการก่อน (ทางออกคนละแบบ) ถ้าบริการไม่พอค่อยเติมเจ้าที่ดีรองลงมา
 * @returns {{ options: object[], ranked: object[], weights: object }}
 */
export function rank(u, found, { n = 3 } = {}) {
  const bySid = new Map();
  for (const c of found.candidates) bySid.set(c.p.sid, [...(bySid.get(c.p.sid) || []), c.p]);
  const ctx = { bySid, w: weightsFor(u) };
  const ranked = found.candidates.map(c => scoreOne(c, u, ctx)).sort((a, b) => b.score - a.score);
  const near = r => !(r.localOnly && r.area === 'far');
  // ลำดับการเลือก: ใช้ได้จริงในพื้นที่ + คนละบริการ → เจ้าไกลที่ตรงโจทย์ที่สุด 1 เจ้า (ติดป้ายเตือน) → ใช้ได้จริงที่เหลือ → อะไรก็ได้
  const options = [], seen = new Set();
  const take = (ok, diverse, max = n) => { for (const r of ranked) if (options.length < max && ok(r) && !options.includes(r) && (!diverse || !seen.has(r.p.sid))) { options.push(r); seen.add(r.p.sid); } };
  take(near, true); take(r => !near(r), true, Math.min(n, options.length + 1)); take(near, false); take(() => true, false);
  options.sort((a, b) => near(b) - near(a) || b.score - a.score);
  return { options, ranked, weights: ctx.w };
}
