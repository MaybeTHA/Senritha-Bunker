// สินค้าและอุปกรณ์ที่ผู้ดูแลผู้สูงอายุใช้บ่อย — ยี่ห้อ/รุ่นที่ขายจริงในไทย พร้อมแหล่งที่มาของข้อมูล
// กฎ: ราคาใส่เฉพาะที่เห็นจากร้านในไทยจริง (บอกร้านและช่วงเวลาที่เห็น) · ไม่มีราคาก็บอกว่า "ดูราคาล่าสุดที่ร้าน" · ไม่แต่งรีวิว
// ลิงก์ซื้อ = หน้าสินค้าที่พบ + ลิงก์ค้นหาใน Shopee/Lazada (ใช้ได้เสมอ แม้ร้านเปลี่ยนหน้า)

export const CHECKED = 'พ.ย. 2569';

export const GROUPS = [
  { id: 'measure', name: 'เครื่องวัดสุขภาพ', icon: 'heart', photo: 's-health', sub: 'ความดัน · ออกซิเจน · น้ำตาล' },
  { id: 'mobility', name: 'ช่วยเดินและเคลื่อนย้าย', icon: 'walk', photo: 's-mobility', sub: 'วอล์คเกอร์ · วีลแชร์' },
  { id: 'incont', name: 'ผ้าอ้อมและแผ่นรองซับ', icon: 'bag', photo: 's-daily', sub: 'แบบเทป · แบบกางเกง' },
  { id: 'bed', name: 'เตียงและกันแผลกดทับ', icon: 'bed', photo: 's-medical', sub: 'เตียงปรับระดับ · ที่นอนลม' },
  { id: 'resp', name: 'ระบบหายใจ', icon: 'spark', photo: 's-medical', sub: 'เครื่องผลิตออกซิเจน' },
  { id: 'safety', name: 'ห้องน้ำและความปลอดภัย', icon: 'shield', photo: 'l-repair', sub: 'เก้าอี้อาบน้ำ · ราวจับ' },
];
export const groupOf = id => GROUPS.find(g => g.id === id);

const enc = encodeURIComponent;
export const shopee = q => ({ label: 'ค้นใน Shopee', url: 'https://shopee.co.th/search?keyword=' + enc(q) });
export const lazada = q => ({ label: 'ค้นใน Lazada', url: 'https://www.lazada.co.th/catalog/?q=' + enc(q) });
const HP = 'https://www.homepro.co.th';

export const PRODUCTS = [
  // ---------- เครื่องวัด ----------
  { id: 'p-bp-omron', group: 'measure', brand: 'OMRON', model: 'HEM-7120', name: 'เครื่องวัดความดันต้นแขนอัตโนมัติ',
    why: 'วัดความดันและชีพจรที่บ้าน ใช้ติดตามผู้ที่มีความดันสูงหรือกินยาความดัน แล้วเอาค่าไปให้หมอดูตอนนัด',
    specs: ['วัดที่ต้นแขน กดปุ่มเดียว', 'รุ่นนี้ไม่บันทึกค่าย้อนหลัง — รุ่น HEM-7121 มีหน่วยความจำ'],
    tips: ['ให้ผู้สูงอายุนั่งพัก 5 นาที เท้าวางพื้น แขนวางระดับหัวใจ', 'วัดเวลาเดิมทุกวัน แล้วจดค่าในแอปนี้ (หน้า ผู้รับการดูแล → บันทึกค่า)'],
    price: { text: '2,790 บาท', where: 'Central (ร้าน MAC MODERN)', note: 'ลดจาก 2,990 บาท · สินค้าสั่งจองล่วงหน้า' },
    buy: [{ label: 'Central', url: 'https://www.central.co.th/en/omron-white-omron-hem-7120-fully-automatic-digital-blood-pressure-monitor-mkp1371025' }, shopee('Omron HEM-7120'), lazada('Omron HEM-7120')],
    src: [{ label: 'OMRON Healthcare (ข้อมูลรุ่น)', url: 'https://www.omronhealthcare-ap.com/sg/product/12-hem-7120' }, { label: 'Central — หน้าสินค้า', url: 'https://www.central.co.th/en/omron-white-omron-hem-7120-fully-automatic-digital-blood-pressure-monitor-mkp1371025' }],
    kw: 'ความดัน วัดความดัน omron ออมรอน' },
  { id: 'p-oxi-yuwell', group: 'measure', brand: 'Yuwell', model: 'YX302', name: 'เครื่องวัดออกซิเจนปลายนิ้ว',
    why: 'ดูระดับออกซิเจนในเลือด (SpO2) และชีพจร ใช้กับผู้ป่วยโรคปอด หัวใจ หรือตอนไม่สบาย',
    specs: ['วัด SpO2 ช่วง 70–100% · ชีพจร 25–250 ครั้ง/นาที', 'ใช้ได้ทั้งผู้ใหญ่และเด็ก', 'ใช้ถ่าน AAA 2 ก้อน'],
    tips: ['นิ้วต้องอุ่นและไม่ทาเล็บสีเข้ม ค่าจึงแม่น', 'ถ้าค่าต่ำกว่าปกติของผู้ป่วยหรือหายใจลำบาก โทร 1669'],
    price: { text: '690 บาท', where: 'JIB', note: 'ราคาที่หน้าร้านแสดงล่าสุด ก.พ. 2567 — อาจเปลี่ยนแล้ว' },
    buy: [{ label: 'JIB', url: 'https://www.jib.co.th/web/product/readProduct/49665' }, shopee('Yuwell YX302'), lazada('Yuwell YX302')],
    src: [{ label: 'JIB — หน้าสินค้า YX302', url: 'https://www.jib.co.th/web/product/readProduct/49665' }],
    kw: 'ออกซิเจน ปลายนิ้ว spo2 oximeter' },
  { id: 'p-glu-accu', group: 'measure', brand: 'Accu-Chek', model: 'Instant', name: 'เครื่องตรวจน้ำตาลปลายนิ้ว',
    why: 'ตรวจน้ำตาลในเลือดที่บ้าน สำหรับผู้ป่วยเบาหวานที่หมอให้ติดตามค่าเอง',
    specs: ['ใช้เลือดเพียงประมาณ 0.6 ไมโครลิตรต่อครั้ง', 'แผ่นตรวจ Accu-Chek Instant ใช้ได้กับเครื่อง Instant และ Instant S เท่านั้น'],
    tips: ['ซื้อแผ่นตรวจให้ตรงรุ่นเครื่องเสมอ และดูวันหมดอายุ', 'จดค่าพร้อมบอกว่า "ก่อน/หลังอาหาร" เพื่อให้หมออ่านได้ถูก'],
    price: null,
    buy: [shopee('Accu-Chek Instant'), lazada('Accu-Chek Instant'), shopee('แผ่นตรวจน้ำตาล Accu-Chek Instant 50')],
    src: [{ label: 'Roche Diabetes Care — แผ่นตรวจ Instant', url: 'https://diabetes.roche.com/hcp-gb/latest-news/accu-chek-instant-50-strips-price-change' }],
    kw: 'น้ำตาล เบาหวาน ตรวจน้ำตาล glucose' },

  // ---------- ช่วยเดิน ----------
  { id: 'p-walker-yamada', group: 'mobility', brand: 'YAMADA', model: 'WK01', name: 'วอล์คเกอร์ช่วยเดินแบบพับได้',
    why: 'ช่วยพยุงตัวตอนเดินสำหรับผู้ที่ทรงตัวไม่ดีหรือเพิ่งฟื้นจากการผ่าตัด',
    specs: ['พับเก็บได้', 'น้ำหนัก 4.8 กก.', 'จัดจำหน่ายโดย HomePro'],
    tips: ['ปรับความสูงให้มือจับอยู่ระดับข้อมือตอนยืนตรง', 'ถ้าบ้านมีพื้นลื่นหรือพรม ระวังขาวอล์คเกอร์สะดุด'],
    price: { text: '1,490 บาท', where: 'HomePro', note: 'ราคาสุดท้ายที่หน้าร้านออนไลน์' },
    buy: [{ label: 'HomePro', url: HP + '/p/1179889' }, shopee('วอล์คเกอร์ ผู้สูงอายุ'), lazada('walker ผู้สูงอายุ')],
    src: [{ label: 'HomePro — YAMADA WK01', url: HP + '/p/1179889' }],
    free: 'l-loan', kw: 'วอล์คเกอร์ ช่วยเดิน walker' },
  { id: 'p-wheel-soma', group: 'mobility', brand: 'SOMA', model: 'CHM-100', name: 'รถเข็นวีลแชร์',
    why: 'พาผู้สูงอายุที่เดินไกลไม่ได้ไปหาหมอหรือออกนอกบ้าน',
    specs: ['วีลแชร์มาตรฐาน', 'มีรุ่นน้ำหนักเบาราคาสูงกว่า เช่น KARMA Ergo Lite (~15,370 บาท ที่ HomePro)'],
    tips: ['วัดความกว้างประตูบ้านและห้องน้ำก่อนซื้อ', 'ถ้าใช้ชั่วคราว ลองยืมฟรีก่อน'],
    price: { text: 'ประมาณ 4,118 บาท', where: 'HomePro', note: 'ตอนตรวจสอบสินค้าหมด' },
    buy: [{ label: 'HomePro หมวดผู้สูงอายุ', url: HP + '/c/HEA05' }, shopee('รถเข็นวีลแชร์ พับได้'), lazada('wheelchair พับได้')],
    src: [{ label: 'HomePro — หมวดอุปกรณ์ผู้สูงอายุ', url: HP + '/c/HEA05' }],
    free: 'l-loan', kw: 'วีลแชร์ รถเข็น wheelchair' },

  // ---------- ผ้าอ้อม ----------
  { id: 'p-diaper-feelfree', group: 'incont', brand: 'FEELFREE', model: 'แบบเทป L-XL', name: 'ผ้าอ้อมผู้ใหญ่แบบเทป',
    why: 'แบบเทปเปลี่ยนได้ขณะนอน เหมาะกับผู้ป่วยติดเตียง',
    specs: ['แพ็ค 10 ชิ้น ไซส์ L-XL', 'ซึมซับได้สูงสุดประมาณ 1,800 มล.'],
    tips: ['เทียบราคา "ต่อชิ้น" ไม่ใช่ต่อแพ็ค', 'ผู้ป่วยติดเตียงอาจรับผ้าอ้อมฟรีได้วันละไม่เกิน 3 ชิ้น'],
    price: null,
    buy: [{ label: 'HomePro', url: HP + '/p/888125300048' }, shopee('ผ้าอ้อมผู้ใหญ่ แบบเทป'), lazada('ผ้าอ้อมผู้ใหญ่ แบบเทป')],
    src: [{ label: 'HomePro — FEELFREE แบบเทป', url: HP + '/p/888125300048' }],
    free: 'b-diaper', kw: 'ผ้าอ้อม แพมเพิส เทป ติดเตียง' },
  { id: 'p-diaper-lifree', group: 'incont', brand: 'Lifree (ไลฟ์รี่)', model: 'กางเกงซึมซับตลอดคืน', name: 'กางเกงผ้าอ้อมผู้ใหญ่',
    why: 'แบบกางเกงใส่-ถอดเองได้ เหมาะกับผู้ที่ยังลุกเดินเข้าห้องน้ำได้',
    specs: ['ไซส์ M 16 ชิ้น · L 14 ชิ้น · XL 12 ชิ้น (ต่อแพ็ค)'],
    tips: ['วัดรอบเอวก่อนเลือกไซส์', 'ถ้าเปลี่ยนให้ผู้ป่วยนอนติดเตียง แบบเทปสะดวกกว่า'],
    price: null,
    buy: [{ label: 'HomePro', url: HP + '/p/888134800088' }, shopee('Lifree กางเกงซึมซับ'), lazada('Lifree กางเกงซึมซับ')],
    src: [{ label: 'HomePro — Lifree ไซส์ L', url: HP + '/p/888134800088' }, { label: 'HomePro — Lifree ไซส์ M', url: HP + '/p/888134800090' }],
    free: 'b-diaper', kw: 'ผ้าอ้อม กางเกง lifree ไลฟ์รี่' },

  // ---------- เตียง ----------
  { id: 'p-bed-allwell', group: 'bed', brand: 'ALLWELL', model: 'KS888', name: 'เตียงผู้ป่วยไฟฟ้า 3 ไกร์ (แถมที่นอน)',
    why: 'ปรับหัว-เข่า-ความสูงได้ ช่วยให้ผู้ป่วยลุกนั่งกินข้าว และผู้ดูแลไม่ต้องก้มหลังตอนเปลี่ยนผ้าอ้อม',
    specs: ['ไฟฟ้า 3 ฟังก์ชัน (ไกร์)', 'แถมที่นอนผู้ป่วย'],
    tips: ['วัดพื้นที่ห้องและทางเข้าก่อนสั่ง', 'ถ้าใช้ระยะสั้น ลองยืมเตียงฟรีก่อน (กทม. มีบริการยืม)'],
    price: null,
    buy: [{ label: 'HomePro', url: HP + '/p/888114900021' }, shopee('เตียงผู้ป่วยไฟฟ้า 3 ไกร'), lazada('เตียงผู้ป่วยไฟฟ้า')],
    src: [{ label: 'HomePro — ALLWELL KS888', url: HP + '/p/888114900021' }],
    free: 'l-loan', kw: 'เตียง เตียงผู้ป่วย ไกร ติดเตียง' },
  { id: 'p-mattress-air', group: 'bed', brand: 'PHENOMA · MEDHUB', model: 'ที่นอนลมแบบลอน', name: 'ที่นอนลมกันแผลกดทับ',
    why: 'ลมสลับลอนช่วยกระจายแรงกด ลดโอกาสเกิดแผลกดทับในผู้ป่วยติดเตียง',
    specs: ['มีปั๊มลมสลับลอน วางบนเตียงเดิมได้'],
    tips: ['ยังต้องพลิกตัวผู้ป่วยตามที่พยาบาลแนะนำ ที่นอนลมไม่ได้ทดแทนการพลิกตัว', 'ดูผิวบริเวณก้นกบ ส้นเท้า สะโพกทุกวัน'],
    price: { text: 'ประมาณ 3,000–3,700 บาท', where: 'HomePro', note: 'ช่วงราคาที่เห็นในหมวดที่นอนผู้ป่วย' },
    buy: [{ label: 'HomePro หมวดที่นอนผู้ป่วย', url: HP + '/c/HEA0202' }, shopee('ที่นอนลม กันแผลกดทับ'), lazada('ที่นอนลม กันแผลกดทับ')],
    src: [{ label: 'HomePro — หมวดที่นอนผู้ป่วย', url: HP + '/c/HEA0202' }],
    kw: 'ที่นอนลม แผลกดทับ ติดเตียง' },

  // ---------- หายใจ ----------
  { id: 'p-o2-yuwell3', photo: 'p-o2', group: 'resp', brand: 'Yuwell', model: '7F-3DW', name: 'เครื่องผลิตออกซิเจน 3 ลิตร',
    why: 'สำหรับผู้ป่วยที่แพทย์สั่งให้ใช้ออกซิเจนที่บ้าน',
    specs: ['อัตราสูงสุด 3 ลิตร/นาที', 'เสียงทำงานไม่เกินประมาณ 55 dB'],
    tips: ['ใช้ตามอัตราที่แพทย์สั่งเท่านั้น', 'ห้ามสูบบุหรี่หรือจุดไฟใกล้เครื่อง'],
    price: { text: '12,900 บาท', where: 'ร้านอุปกรณ์การแพทย์บน LINE Shop', note: 'รุ่น 7F-3NW ที่มีจอแสดง % ออกซิเจน 15,500 บาท' },
    buy: [{ label: 'HomePro', url: HP + '/p/888113500024' }, shopee('Yuwell 7F-3DW'), lazada('Yuwell เครื่องผลิตออกซิเจน 3 ลิตร')],
    src: [{ label: 'HomePro — Yuwell 7F-3DW', url: HP + '/p/888113500024' }],
    free: 'l-loan', kw: 'ออกซิเจน เครื่องผลิตออกซิเจน yuwell' },
  { id: 'p-o2-yuwell5', photo: 'p-o2', group: 'resp', brand: 'Yuwell', model: '9F-5BW', name: 'เครื่องผลิตออกซิเจน 5 ลิตร',
    why: 'สำหรับผู้ป่วยที่แพทย์สั่งอัตราออกซิเจนสูงกว่า 3 ลิตร/นาที',
    specs: ['อัตราสูงสุด 5 ลิตร/นาที'],
    tips: ['ถามแพทย์ว่าต้องใช้กี่ลิตรก่อนเลือกรุ่น'],
    price: { text: '20,418.50 บาท', where: 'HomePro', note: 'ราคาปกติ 22,500 บาท · ตอนตรวจสอบสินค้าหมด' },
    buy: [{ label: 'HomePro หมวดออกซิเจน', url: HP + '/c/HEA1003' }, shopee('Yuwell 9F-5BW'), lazada('เครื่องผลิตออกซิเจน 5 ลิตร')],
    src: [{ label: 'HomePro — หมวดเครื่องผลิตออกซิเจน', url: HP + '/c/HEA1003' }],
    free: 'l-loan', kw: 'ออกซิเจน 5 ลิตร' },

  // ---------- ความปลอดภัย ----------
  { id: 'p-shower-chair', group: 'safety', brand: 'หลายยี่ห้อ', model: 'โครงอะลูมิเนียม', name: 'เก้าอี้นั่งอาบน้ำ',
    why: 'ให้ผู้สูงอายุนั่งอาบน้ำ ลดการลื่นล้มในห้องน้ำซึ่งเป็นจุดที่ล้มบ่อย',
    specs: ['ตัวอย่างสเปกที่พบ: ที่นั่งพลาสติก PE โครงขาอะลูมิเนียม รับน้ำหนักได้ถึง 80 กก. ปรับความสูงได้'],
    tips: ['ดูน้ำหนักที่รับได้ให้เกินน้ำหนักผู้ใช้', 'ขายางกันลื่นต้องครบทุกขา'],
    price: null,
    buy: [{ label: 'HomePro หมวดผู้สูงอายุ', url: HP + '/c/HEA05' }, shopee('เก้าอี้นั่งอาบน้ำ ผู้สูงอายุ'), lazada('เก้าอี้อาบน้ำ ผู้สูงอายุ')],
    src: [{ label: 'HomePro — หมวดอุปกรณ์ผู้สูงอายุ', url: HP + '/c/HEA05' }],
    kw: 'เก้าอี้อาบน้ำ ห้องน้ำ ลื่น ล้ม' },
  { id: 'p-grab-bar', group: 'safety', brand: 'หลายยี่ห้อ', model: 'สแตนเลส', name: 'ราวจับในห้องน้ำ',
    why: 'ติดข้างโถส้วมและในที่อาบน้ำ ให้มีที่จับตอนลุก-นั่ง',
    specs: ['เลือกแบบยึดผนังด้วยพุก ไม่ใช่แบบสุญญากาศ'],
    tips: ['ผู้สูงอายุรายได้น้อยอาจขอเงินปรับปรุงบ้านจากรัฐได้ (ดูบริการ "ซ่อมบ้านผู้สูงอายุ")'],
    price: null,
    buy: [shopee('ราวจับ ห้องน้ำ ผู้สูงอายุ'), lazada('ราวจับห้องน้ำ ผู้สูงอายุ')],
    src: [], free: 'b-repair', kw: 'ราวจับ ห้องน้ำ' },
];
export const productOf = id => PRODUCTS.find(p => p.id === id);
export const productsIn = g => PRODUCTS.filter(p => p.group === g);

export function searchProducts(q) {
  const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return PRODUCTS.filter(p => {
    const hay = `${p.brand} ${p.model} ${p.name} ${p.why} ${p.kw || ''} ${groupOf(p.group).name}`.toLowerCase();
    return words.every(w => hay.includes(w));
  });
}
