// ภาพประกอบบริการ — จาก Wikimedia Commons (ไลเซนส์เสรีเท่านั้น · ให้เครดิตตามไลเซนส์) · ไฟล์ถูกสร้างตอน build
import PHOTOS from './photos.data.js';
const CAT_DEFAULT = { health: 'h-appt', living: 'l-care', shop: 's-daily', community: 'c-club', family: 'f-members', benefits: 'b-office', emergency: 'e-1669' };
const ALIAS = { 'f-schedule': 'f-members', 'f-updates': 'f-members', 'f-ask': 'f-members', 'e-page': 'e-1669', 'e-1323': 'h-consult', 'b-ucs': 'h-1330', 'c-school': 'c-club', 'l-house': 'l-care', 's-delivery': 's-daily' };
export const photoOf = s => PHOTOS[s.id] || PHOTOS[ALIAS[s.id]] || PHOTOS[CAT_DEFAULT[s.cat]] || null;
export const catPhoto = id => PHOTOS[CAT_DEFAULT[id]] || null;
export const allPhotos = () => Object.entries(PHOTOS);
