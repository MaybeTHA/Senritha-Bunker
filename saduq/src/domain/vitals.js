// บันทึกสุขภาพที่ผู้ดูแลจด — ข้อมูลล้วน
// เกณฑ์ที่ใช้ทำป้ายเป็น "ค่าทั่วไปของผู้ใหญ่" เพื่อเตือนให้สังเกตเท่านั้น ไม่ใช่การวินิจฉัย — ค่าเป้าหมายของแต่ละคนให้ถามแพทย์
export const VKINDS = {
  bp: { name: 'ความดันโลหิต', short: 'ความดัน', unit: 'มม.ปรอท', two: true, l1: 'ตัวบน', l2: 'ตัวล่าง', icon: 'heart' },
  sugar: { name: 'น้ำตาลในเลือด', short: 'น้ำตาล', unit: 'มก./ดล.', icon: 'pill' },
  temp: { name: 'อุณหภูมิ', short: 'ไข้', unit: '°C', step: 0.1, icon: 'spark' },
  spo2: { name: 'ออกซิเจนปลายนิ้ว', short: 'SpO2', unit: '%', icon: 'activity' },
  weight: { name: 'น้ำหนัก', short: 'น้ำหนัก', unit: 'กก.', step: 0.1, icon: 'walk' },
};
export const fmtVital = v => VKINDS[v.kind]?.two ? `${v.v1}/${v.v2}` : String(v.v1);

/** คืน null (ปกติ) หรือ { level: 'high'|'low', text } */
export function flagOf(v) {
  const a = +v.v1, b = +v.v2;
  switch (v.kind) {
    case 'bp': return a >= 180 || b >= 110 ? { level: 'high', text: 'สูงมาก' } : a >= 140 || b >= 90 ? { level: 'high', text: 'สูงกว่าค่าทั่วไป' } : a < 90 || b < 60 ? { level: 'low', text: 'ต่ำกว่าค่าทั่วไป' } : null;
    case 'sugar': return a < 70 ? { level: 'low', text: 'ต่ำ' } : a > 180 ? { level: 'high', text: 'สูง' } : null;
    case 'temp': return a >= 37.5 ? { level: 'high', text: 'มีไข้' } : a < 35.5 ? { level: 'low', text: 'ต่ำ' } : null;
    case 'spo2': return a < 95 ? { level: 'low', text: 'ต่ำกว่าค่าทั่วไป' } : null;
    default: return null;
  }
}
export function validVital(kind, v1, v2) {
  const a = +v1, b = +v2;
  if (!VKINDS[kind] || !Number.isFinite(a) || a <= 0) return false;
  if (VKINDS[kind].two && (!Number.isFinite(b) || b <= 0 || b >= a)) return false;
  const max = { bp: 300, sugar: 800, temp: 45, spo2: 100, weight: 300 }[kind];
  return a <= max;
}
