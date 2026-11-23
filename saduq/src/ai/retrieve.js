// ขั้น 3 · ค้นบริการ — กรองตามประเภทบริการ (จากโจทย์) และพื้นที่
// ไม่ทิ้งเจ้าที่อยู่ไกลทันที แต่ติดป้าย area ไว้ให้ขั้นจัดอันดับตัดสิน (บริการที่ต้องมาถึงตัวจะโดนหักหนัก)
import { PROVIDERS } from '../domain/providers.js';
import { LOCAL_ONLY, NATIONWIDE } from './knowledge.js';

/** area: 'local' ในจังหวัดเดียวกัน · 'nationwide' ส่ง/ออนไลน์ทั่วประเทศ · 'far' คนละจังหวัด · 'unknown' ยังไม่รู้ว่าผู้ใช้อยู่ไหน */
export function areaOf(p, province) {
  if (NATIONWIDE.test(p.area)) return 'nationwide';
  if (!province) return 'unknown';
  return p.area.includes(province.replace(/ฯ$/, '')) ? 'local' : 'far';
}

export function retrieve(u, { providers = PROVIDERS } = {}) {
  const want = new Map(u.intents.map(i => [i.sid, i]));
  const all = providers.filter(p => want.has(p.sid)).map(p => ({ p, intent: want.get(p.sid), area: areaOf(p, u.province), localOnly: LOCAL_ONLY.has(p.sid) }));
  const usable = all.filter(c => !(c.localOnly && c.area === 'far'));
  return {
    candidates: all,
    services: want.size,
    scanned: providers.length,
    inArea: usable.length,
    // บริการที่ไม่มีเจ้าในพื้นที่เลย → บอกผู้ใช้ตรง ๆ
    noLocal: [...want.keys()].filter(sid => LOCAL_ONLY.has(sid) && u.province && !all.some(c => c.p.sid === sid && c.area !== 'far')),
  };
}
