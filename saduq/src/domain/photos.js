// ภาพประกอบบริการ — ชุดของ Saduq เอง (own) + ภาพจาก Wikimedia Commons สำหรับหมวดซื้อของ/ฉุกเฉิน (ไลเซนส์เสรี · ให้เครดิต)
import PHOTOS from './photos.data.js';
const CAT_DEFAULT = { health: 'h-appt', living: 'l-care', shop: 's-daily', community: 'c-club', family: 'f-members', benefits: 'b-allowance', emergency: 'e-1669' };
// บริการรุ่น 2.x ที่ยังไม่มีภาพของตัวเอง → ใช้ภาพที่ใกล้เคียง
const ALIAS = { 'e-page': 'e-1669', 'e-1323': 'h-consult', 's-delivery': 's-daily',
  'h-telemed': 'h-consult', 'h-pharmacy': 'h-med', 'l-ltc': 'l-care', 'l-loan': 's-medical', 'l-daycare': 'c-events', 'l-hire': 'l-personal', 'c-training': 'c-school',
  's-resp': 's-medical', 's-safety': 'l-repair', 's-measure': 's-health', 'b-diaper': 's-daily', 'b-repair': 'l-repair' };
export const photoOf = s => PHOTOS[s.id] || PHOTOS[ALIAS[s.id]] || PHOTOS[CAT_DEFAULT[s.cat]] || null;
export const photoById = id => PHOTOS[id] || null;
export const catPhoto = id => PHOTOS[CAT_DEFAULT[id]] || null;
/** เฉพาะภาพจาก Wikimedia Commons (ต้องให้เครดิต) — ภาพของ Saduq เองไม่ต้อง */
export const allPhotos = () => Object.entries(PHOTOS).filter(([, p]) => !p.own);
