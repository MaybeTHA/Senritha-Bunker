// Senritha's Solaris X3D — scientific data, artistic scale and bilingual text.
// Orbital elements: JPL "Keplerian Elements for Approximate Positions" (J2000, 1800–2050).
// Physical data: NASA planetary fact sheets. Moon counts as of 2025.

export const SUN_RADIUS = 15;

// Artistic orbit radius (scene units) for each real semi-major axis (AU).
// Planets keep their order and spacing rhythm; the whole system fits one view.
const AU_KNOTS = [
  [0, 0], [0.387, 46], [0.723, 64], [1.0, 84], [1.524, 108],
  [5.203, 162], [9.537, 238], [19.19, 306], [30.07, 366], [60, 531],
];
export function auToScene(au) {
  for (let i = 1; i < AU_KNOTS.length; i++) {
    const [a0, s0] = AU_KNOTS[i - 1], [a1, s1] = AU_KNOTS[i];
    if (au <= a1) return s0 + (au - a0) / (a1 - a0) * (s1 - s0);
  }
  return AU_KNOTS[AU_KNOTS.length - 1][1];
}

// Artistic body radius from real diameter (km): compressed power law.
export const artRadius = (km) => 1.5 * Math.pow(km / 12756, 0.55);

export const PLANETS = [
  {
    id: 'mercury', kind: 'rocky', bake: 1, radius: artRadius(4879),
    el: { a: 0.38709927, e: 0.20563593, I: 7.00497902, L: 252.25032350, lp: 77.45779628, node: 48.33076593, Ldot: 149472.67411175 },
    pole: [281.01, 61.41], rotHours: 1407.6, oblate: 0,
    orbitColor: [0.75, 0.70, 0.66], dot: ['#b8aea4', '#5e5650'],
    atmo: null, bump: 0.8, lunar: 0.55,
    hd: { render: 'terrain', disp: 0.0235, h0: 0.529, normal: 1.0, lunar: 0.62, ao: 7, tint: 1, ambient: 0.0012, shadowLen: 0.06 },
    scatter: { tauR: [0, 0, 0], tauM: 0.006, mie: [1.0, 0.85, 0.45], g: 0.5, H: 0.035, shell: 1.15, I: 3 },
    name: { th: 'ดาวพุธ', en: 'Mercury' },
    type: { th: 'ดาวเคราะห์หิน', en: 'Terrestrial planet' },
    stats: { diameter: 4879, distAU: 0.387, distMkm: 57.9, orbitDays: 87.97, rotHours: 1407.6, retro: false, tempC: 167, tempRange: [-173, 427], moons: 0, tilt: 0.03, gravity: 3.7 },
    facts: {
      th: [
        'ดาวเคราะห์ที่เล็กที่สุดและอยู่ใกล้ดวงอาทิตย์ที่สุด',
        'หนึ่งวันสุริยะ (เที่ยงวันถึงเที่ยงวันถัดไป) ยาวถึง 176 วันของโลก นานกว่าหนึ่งปีของมันซึ่งมีเพียง 88 วัน',
        'อุณหภูมิแกว่งจากราว 430 °C ตอนกลางวันลงไปถึง −180 °C ตอนกลางคืน เพราะแทบไม่มีบรรยากาศเก็บความร้อน',
        'แม้อยู่ใกล้ดวงอาทิตย์ที่สุด แต่ในหลุมอุกกาบาตบริเวณขั้วที่แสงส่องไม่ถึงกลับมีน้ำแข็งอยู่',
      ],
      en: [
        'The smallest planet and the closest to the Sun.',
        'One solar day (noon to noon) lasts 176 Earth days, longer than its 88-day year.',
        'Temperatures swing from about 430 °C by day to −180 °C at night, because there is almost no atmosphere to hold heat.',
        'Despite being closest to the Sun, it hides water ice in permanently shadowed polar craters.',
      ],
    },
    moons: [],
  },
  {
    id: 'venus', kind: 'gas', bake: 2, radius: artRadius(12104),
    el: { a: 0.72333566, e: 0.00677672, I: 3.39467605, L: 181.97909950, lp: 131.60246718, node: 76.67984255, Ldot: 58517.81538729 },
    pole: [272.76, 67.16], rotHours: -5832.5, cloudRotHours: -96, oblate: 0,
    orbitColor: [0.95, 0.82, 0.55], dot: ['#f3d9a0', '#a87a3c'],
    atmo: { color: [1.0, 0.82, 0.52], sunset: [1.0, 0.55, 0.25], scale: 1.09, density: 1.6, intensity: 1.15 },
    flow: { amp: 0.004, jets: 3, period: 7, turb: 0.010, refLat: 0, limb: 0.35, haze: [1.0, 0.86, 0.58], hazeAmt: 0.75, bump: 0.006, wrap: 0.35 },
    hd: {
      render: 'venus', bump: 0.004,
      layers: [
        { r: 1.006, speed: 0.012, scale: 2.2, stretch: 2.5, opacity: 0.32, lo: 0.5, hi: 0.85, tint: [0.98, 0.90, 0.70], seed: 1 },
        { r: 1.014, speed: 0.021, scale: 3.4, stretch: 3.5, opacity: 0.20, lo: 0.55, hi: 0.9, tint: [1.0, 0.95, 0.82], seed: 7 },
      ],
      radar: { disp: 0.0126, h0: 0.127, normal: 1.0, lunar: 0, ao: 4, shadowLen: 0.05 },
    },
    scatter: { tauR: [0.02, 0.025, 0.035], tauM: 0.5, mie: [1.0, 0.84, 0.52], g: 0.7, H: 0.012, shell: 1.085, I: 3.5 },
    name: { th: 'ดาวศุกร์', en: 'Venus' },
    type: { th: 'ดาวเคราะห์หิน', en: 'Terrestrial planet' },
    stats: { diameter: 12104, distAU: 0.723, distMkm: 108.2, orbitDays: 224.7, rotHours: 5832.5, retro: true, tempC: 464, moons: 0, tilt: 177.4, gravity: 8.9 },
    facts: {
      th: [
        'ดาวเคราะห์ที่ร้อนที่สุด บรรยากาศคาร์บอนไดออกไซด์หนาทึบกักความร้อนจนพื้นผิวร้อนราว 465 °C',
        'หมุนรอบตัวเองย้อนทิศ ดวงอาทิตย์จึงขึ้นทางทิศตะวันตก',
        'หนึ่งวันของดาวศุกร์ (243 วันของโลก) ยาวกว่าหนึ่งปีของมัน (225 วัน)',
        'ความกดอากาศที่พื้นผิวสูงกว่าโลกราว 92 เท่า เท่ากับอยู่ใต้ทะเลลึก 900 เมตร',
        'เมฆกรดกำมะถันชั้นบนพัดรอบดาวได้ในเวลาเพียงราว 4 วัน เรียกว่าการหมุนวนยิ่งยวด (super-rotation)',
      ],
      en: [
        'The hottest planet: a thick CO₂ atmosphere traps heat and keeps the surface near 465 °C.',
        'It spins backwards (retrograde), so the Sun rises in the west.',
        'A Venus day (243 Earth days) is longer than its year (225 days).',
        'Surface pressure is about 92 times Earth’s, like being 900 m under the sea.',
        'Its sulfuric-acid cloud tops race around the planet in about 4 days (super-rotation).',
      ],
    },
    moons: [],
  },
  {
    id: 'earth', kind: 'earth', radius: artRadius(12756),
    el: { a: 1.00000261, e: 0.01671123, I: -0.00001531, L: 100.46457166, lp: 102.93768193, node: 0.0, Ldot: 35999.37244981 },
    pole: [0, 90], rotHours: 23.934, oblate: 0,
    orbitColor: [0.55, 0.75, 1.0], dot: ['#6fa8ff', '#1d3f7a'],
    atmo: { color: [0.32, 0.58, 1.0], sunset: [1.0, 0.45, 0.2], scale: 1.045, density: 1.0, intensity: 1.25 },
    hd: { render: 'earth' },
    scatter: { tauR: [0.06, 0.14, 0.33], tauM: 0.02, mie: [1, 1, 1], g: 0.76, H: 0.0085, shell: 1.065, I: 5 },
    name: { th: 'โลก', en: 'Earth' },
    type: { th: 'ดาวเคราะห์หิน', en: 'Terrestrial planet' },
    stats: { diameter: 12756, distAU: 1.0, distMkm: 149.6, orbitDays: 365.25, rotHours: 23.934, retro: false, tempC: 15, moons: 1, tilt: 23.44, gravity: 9.8 },
    facts: {
      th: [
        'ดาวดวงเดียวที่รู้ว่ามีสิ่งมีชีวิต',
        'พื้นผิวราว 71% ปกคลุมด้วยน้ำ',
        'บรรยากาศมีไนโตรเจน 78% และออกซิเจน 21% และกระเจิงแสงสีน้ำเงิน ท้องฟ้าจึงเป็นสีฟ้า',
        'ดวงจันทร์ค่อย ๆ เคลื่อนห่างออกจากโลกราว 3.8 ซม. ต่อปี',
      ],
      en: [
        'The only world known to host life.',
        'About 71% of the surface is covered by water.',
        'The air is 78% nitrogen and 21% oxygen, and it scatters blue sunlight, which is why the sky is blue.',
        'The Moon drifts away from Earth by about 3.8 cm every year.',
      ],
    },
    moons: [
      { id: 'moon', km: 3474, dist: 3.9, periodDays: 27.32, incl: 5.14, inEcliptic: true,
        hd: { render: 'terrain', disp: 0.0263, h0: 0.45, normal: 1.0, lunar: 0.6, ao: 6, shadowLen: 0.06 },
        name: { th: 'ดวงจันทร์', en: 'The Moon' },
        fact: { th: 'หันด้านเดียวเข้าหาโลกเสมอ เพราะถูกแรงไทดัลล็อกไว้', en: 'Always shows the same face to Earth because it is tidally locked.' } },
    ],
  },
  {
    id: 'mars', kind: 'rocky', bake: 3, radius: artRadius(6792),
    el: { a: 1.52371034, e: 0.09339410, I: 1.84969142, L: -4.55343205, lp: -23.94362959, node: 49.55953891, Ldot: 19140.30268499 },
    pole: [317.68, 52.89], rotHours: 24.623, oblate: 0.006,
    orbitColor: [1.0, 0.62, 0.45], dot: ['#e08a5a', '#7a3418'],
    atmo: { color: [0.95, 0.62, 0.42], sunset: [0.55, 0.65, 1.0], scale: 1.03, density: 0.45, intensity: 0.9 },
    bump: 0.6, lunar: 0.2, dust: 1,
    hd: { render: 'terrain', disp: 0.0224, h0: 0.329, normal: 1.0, lunar: 0.15, ao: 5, dust: 1, haze: 0.16, hazeColor: [0.95, 0.65, 0.45], shadowLen: 0.07 },
    scatter: { tauR: [0.004, 0.007, 0.014], tauM: 0.09, mie: [1.0, 0.62, 0.38], g: 0.65, H: 0.011, shell: 1.06, I: 3.0 },
    name: { th: 'ดาวอังคาร', en: 'Mars' },
    type: { th: 'ดาวเคราะห์หิน', en: 'Terrestrial planet' },
    stats: { diameter: 6792, distAU: 1.524, distMkm: 227.9, orbitDays: 687.0, rotHours: 24.623, retro: false, tempC: -65, moons: 2, tilt: 25.19, gravity: 3.7 },
    facts: {
      th: [
        'เป็นที่ตั้งของโอลิมปัสมอนส์ ภูเขาไฟที่สูงที่สุดในระบบสุริยะ สูงราว 22 กม. เกือบ 2.5 เท่าของเอเวอเรสต์',
        'หุบเขาวาลิส มาริเนริส ทอดยาวกว่า 4,000 กม. พอ ๆ กับความกว้างของสหรัฐอเมริกา',
        'สีแดงมาจากเหล็กออกไซด์ (สนิม) ในฝุ่น',
        'พายุฝุ่นที่ปกคลุมทั้งดาวอาจบดบังพื้นผิวทั้งหมดได้นานหลายสัปดาห์',
      ],
      en: [
        'Home to Olympus Mons, the tallest volcano in the Solar System: about 22 km high, almost 2.5 times Everest.',
        'The Valles Marineris canyon system runs for more than 4,000 km, about the width of the United States.',
        'Its red color comes from iron oxide (rust) in the dust.',
        'Planet-wide dust storms can hide the entire surface for weeks.',
      ],
    },
    moons: [
      { id: 'phobos', bake: 10, km: 22.5, minR: 0.075, dist: 2.1, periodDays: 0.319, incl: 1.1, shape: [1.25, 0.95, 0.8],
        colors: [[0.28, 0.25, 0.23], [0.45, 0.41, 0.37]], craters: 0.9,
        name: { th: 'โฟบอส', en: 'Phobos' },
        fact: { th: 'โคจรรอบดาวอังคารวันละ 3 รอบ และกำลังค่อย ๆ เคลื่อนเข้าใกล้ดาวอังคาร', en: 'Circles Mars three times a day and is slowly spiraling inward.' } },
      { id: 'deimos', bake: 10, km: 12.4, minR: 0.055, dist: 3.4, periodDays: 1.263, incl: 1.8, shape: [1.2, 0.9, 0.85],
        colors: [[0.33, 0.30, 0.27], [0.52, 0.48, 0.43]], craters: 0.6,
        name: { th: 'ดีมอส', en: 'Deimos' },
        fact: { th: 'หนึ่งในดวงจันทร์ที่เล็กที่สุด เมื่อมองจากดาวอังคารจะเห็นเป็นเพียงจุดสว่างคล้ายดาว', en: 'One of the smallest moons known; from Mars it looks like a bright star.' } },
    ],
  },
  {
    id: 'jupiter', kind: 'gas', bake: 4, radius: artRadius(142984),
    el: { a: 5.20288700, e: 0.04838624, I: 1.30439695, L: 34.39644051, lp: 14.72847983, node: 100.47390909, Ldot: 3034.74612775 },
    pole: [268.06, 64.50], rotHours: 9.925, oblate: 0.0649,
    orbitColor: [0.95, 0.80, 0.62], dot: ['#e7c8a0', '#8a5a3a'],
    atmo: { color: [0.95, 0.85, 0.70], sunset: [0.9, 0.6, 0.4], scale: 1.025, density: 0.55, intensity: 0.7 },
    flow: { amp: 0.009, jets: 22, period: 6, turb: 0.0045, refLat: -20.9, limb: 0.45, haze: [0.95, 0.88, 0.78], hazeAmt: 0.35, bump: 0.010, wrap: 0.12,
      storm: { lat: -20.9, lon: 47.2, a: 0.15, b: 0.095, spin: 0.10 } },
    hd: {
      render: 'gaseq', bump: 0.012, storm: { lat: -20.9, lon: 47.2, a: 0.15, b: 0.095, spin: 0.10 },
      layers: [{ r: 1.005, speed: 0.006, scale: 3.0, stretch: 9, opacity: 0.16, lo: 0.6, hi: 0.9, tint: [1.0, 0.98, 0.94], shear: 0.8, seed: 2 }],
    },
    rings: { kind: 'jupiter' },
    scatter: { tauR: [0.01, 0.02, 0.035], tauM: 0.03, mie: [1.0, 0.9, 0.75], g: 0.6, H: 0.006, shell: 1.04, I: 3 },
    name: { th: 'ดาวพฤหัสบดี', en: 'Jupiter' },
    type: { th: 'ดาวเคราะห์แก๊สยักษ์', en: 'Gas giant' },
    stats: { diameter: 142984, distAU: 5.203, distMkm: 778.5, orbitDays: 4332.6, rotHours: 9.925, retro: false, tempC: -110, moons: 95, tilt: 3.13, gravity: 24.8 },
    facts: {
      th: [
        'มีมวลมากกว่าดาวเคราะห์ดวงอื่นทั้งหมดรวมกันมากกว่าสองเท่า',
        'จุดแดงใหญ่เป็นพายุที่ใหญ่กว่าโลกทั้งใบ และถูกสังเกตต่อเนื่องมาอย่างน้อย 190 ปี',
        'หมุนรอบตัวเองเร็วที่สุด หนึ่งวันยาวไม่ถึง 10 ชั่วโมง จนขั้วดาวแบนลงอย่างเห็นได้ชัด',
        'แถบเมฆแต่ละแถบมีลมพัดคนละทิศคนละความเร็ว บางแถบเร็วกว่า 500 กม./ชม.',
        'แกนีมีด ดวงจันทร์ของมัน ใหญ่ที่สุดในระบบสุริยะ ใหญ่กว่าดาวพุธเสียอีก',
      ],
      en: [
        'More than twice as massive as all the other planets combined.',
        'The Great Red Spot is a storm wider than Earth, watched continuously for at least 190 years.',
        'The fastest-spinning planet: a day lasts under 10 hours, which visibly flattens its poles.',
        'Neighboring cloud bands blow in opposite directions, some faster than 500 km/h.',
        'Its moon Ganymede is the largest in the Solar System, bigger than Mercury.',
      ],
    },
    moons: [
      { id: 'io', bake: 11, km: 3643, dist: 3.4, periodDays: 1.769, incl: 0.05,
        name: { th: 'ไอโอ', en: 'Io' },
        fact: { th: 'โลกที่มีภูเขาไฟคุกรุ่นมากที่สุดเท่าที่รู้จัก มีภูเขาไฟที่ยังปะทุกว่า 400 ลูก', en: 'The most volcanically active world known, with over 400 active volcanoes.' } },
      { id: 'europa', bake: 12, km: 3122, dist: 4.3, periodDays: 3.551, incl: 0.47,
        name: { th: 'ยูโรปา', en: 'Europa' },
        fact: { th: 'ใต้เปลือกน้ำแข็งมีมหาสมุทรน้ำเค็มทั่วทั้งดวง เป็นเป้าหมายสำคัญในการค้นหาสิ่งมีชีวิต', en: 'A global saltwater ocean lies under its icy crust, a prime place to search for life.' } },
      { id: 'ganymede', bake: 13, km: 5268, dist: 5.3, periodDays: 7.155, incl: 0.2,
        name: { th: 'แกนีมีด', en: 'Ganymede' },
        fact: { th: 'ดวงจันทร์ที่ใหญ่ที่สุดในระบบสุริยะ และเป็นดวงเดียวที่มีสนามแม่เหล็กของตัวเอง', en: 'The largest moon in the Solar System and the only one with its own magnetic field.' } },
      { id: 'callisto', bake: 10, km: 4821, dist: 6.2, periodDays: 16.69, incl: 0.28,
        colors: [[0.22, 0.20, 0.18], [0.52, 0.48, 0.42]], craters: 1.0, brightCraters: 1,
        name: { th: 'คัลลิสโต', en: 'Callisto' },
        fact: { th: 'พื้นผิวมีหลุมอุกกาบาตหนาแน่นที่สุดแห่งหนึ่งในระบบสุริยะ', en: 'One of the most heavily cratered surfaces in the Solar System.' } },
    ],
  },
  {
    id: 'saturn', kind: 'gas', bake: 5, radius: artRadius(120536),
    el: { a: 9.53667594, e: 0.05386179, I: 2.48599187, L: 49.95424423, lp: 92.59887831, node: 113.66242448, Ldot: 1222.49362201 },
    pole: [40.59, 83.54], rotHours: 10.56, oblate: 0.098,
    orbitColor: [0.95, 0.86, 0.62], dot: ['#ecd7a2', '#9a7a48'],
    atmo: { color: [0.95, 0.86, 0.62], sunset: [0.9, 0.65, 0.4], scale: 1.025, density: 0.5, intensity: 0.65 },
    flow: { amp: 0.006, jets: 10, period: 7, turb: 0.0028, refLat: 0, limb: 0.4, haze: [0.95, 0.88, 0.70], hazeAmt: 0.4, bump: 0.006, wrap: 0.12 },
    rings: { kind: 'saturn', inner: 1.11, outer: 2.35 },
    hd: {
      render: 'gaseq', hex: 1, bump: 0.008,
      layers: [{ r: 1.004, speed: 0.004, scale: 2.5, stretch: 10, opacity: 0.10, lo: 0.62, hi: 0.92, tint: [1.0, 0.96, 0.86], shear: 0.6, seed: 5 }],
    },
    scatter: { tauR: [0.012, 0.022, 0.03], tauM: 0.03, mie: [1.0, 0.92, 0.72], g: 0.6, H: 0.006, shell: 1.04, I: 3 },
    name: { th: 'ดาวเสาร์', en: 'Saturn' },
    type: { th: 'ดาวเคราะห์แก๊สยักษ์', en: 'Gas giant' },
    stats: { diameter: 120536, distAU: 9.537, distMkm: 1432.0, orbitDays: 10759, rotHours: 10.56, retro: false, tempC: -140, moons: 274, tilt: 26.73, gravity: 10.4 },
    facts: {
      th: [
        'วงแหวนกว้างราว 280,000 กม. แต่หลายแห่งหนาเพียงราว 10 เมตร',
        'วงแหวนประกอบด้วยก้อนน้ำแข็งนับไม่ถ้วน ตั้งแต่เม็ดฝุ่นไปจนถึงก้อนขนาดเท่าบ้าน',
        'ช่องว่างแคสซีนีระหว่างวงแหวน A และ B กว้างราว 4,800 กม.',
        'เป็นดาวเคราะห์ที่มีความหนาแน่นต่ำที่สุด โดยเฉลี่ยต่ำกว่าน้ำ',
        'กระแสลมกรดรูปหกเหลี่ยมพัดวนรอบขั้วเหนือ',
      ],
      en: [
        'Its rings span about 280,000 km, yet in many places they are only about 10 m thick.',
        'The rings are countless pieces of water ice, from dust grains to house-sized chunks.',
        'The Cassini Division between the A and B rings is about 4,800 km wide.',
        'The least dense planet: on average, less dense than water.',
        'A six-sided jet stream, the hexagon, circles its north pole.',
      ],
    },
    moons: [
      { id: 'enceladus', bake: 15, km: 504, dist: 3.95, periodDays: 1.370, incl: 0.02,
        name: { th: 'เอนเซลาดัส', en: 'Enceladus' },
        fact: { th: 'น้ำพุที่ขั้วใต้พ่นน้ำแข็งออกสู่อวกาศ และเป็นแหล่งกำเนิดวงแหวน E ของดาวเสาร์', en: 'Geysers at its south pole spray ice into space and feed Saturn’s E ring.' } },
      { id: 'rhea', bake: 10, km: 1527, dist: 5.4, periodDays: 4.518, incl: 0.35,
        colors: [[0.55, 0.54, 0.52], [0.85, 0.84, 0.82]], craters: 0.9,
        name: { th: 'เรีย', en: 'Rhea' },
        fact: { th: 'ดวงจันทร์ใหญ่อันดับสองของดาวเสาร์ เป็นโลกน้ำแข็งที่มีหลุมอุกกาบาตมากมาย', en: 'Saturn’s second-largest moon, an icy and heavily cratered world.' } },
      { id: 'titan', bake: 14, km: 5150, dist: 7.0, periodDays: 15.95, incl: 0.33,
        scatter: { tauR: [0.03, 0.06, 0.12], tauM: 1.2, mie: [1.0, 0.62, 0.28], g: 0.7, H: 0.02, shell: 1.14, I: 3 },
        name: { th: 'ไททัน', en: 'Titan' },
        fact: { th: 'ดวงจันทร์ดวงเดียวที่มีบรรยากาศหนา และมีแม่น้ำกับทะเลมีเทนเหลว', en: 'The only moon with a thick atmosphere, with rivers and seas of liquid methane.' } },
      { id: 'iapetus', bake: 16, km: 1469, dist: 8.2, periodDays: 79.32, incl: 15.5,
        name: { th: 'ไอแอพิตัส', en: 'Iapetus' },
        fact: { th: 'มีสองโทนสี ซีกหนึ่งมืดเหมือนถ่าน อีกซีกสว่างเหมือนหิมะ', en: 'Two-toned: one hemisphere is dark as coal, the other bright as snow.' } },
    ],
  },
  {
    id: 'uranus', kind: 'gas', bake: 6, radius: artRadius(51118),
    el: { a: 19.18916464, e: 0.04725744, I: 0.77263783, L: 313.23810451, lp: 170.95427630, node: 74.01692503, Ldot: 428.48202785 },
    pole: [257.31, -15.18], rotHours: -17.24, oblate: 0.023,
    orbitColor: [0.65, 0.90, 0.95], dot: ['#bfeaf0', '#4f8f9c'],
    atmo: { color: [0.62, 0.90, 1.0], sunset: [0.6, 0.85, 1.0], scale: 1.035, density: 0.8, intensity: 0.85 },
    flow: { amp: 0.004, jets: 3, period: 8, turb: 0.002, refLat: 0, limb: 0.55, haze: [0.75, 0.93, 0.97], hazeAmt: 0.6, bump: 0.003, wrap: 0.18 },
    rings: { kind: 'uranus', inner: 1.60, outer: 2.02 },
    scatter: { tauR: [0.02, 0.06, 0.09], tauM: 0.02, mie: [0.8, 0.95, 1.0], g: 0.6, H: 0.008, shell: 1.05, I: 4 },
    name: { th: 'ดาวยูเรนัส', en: 'Uranus' },
    type: { th: 'ดาวเคราะห์น้ำแข็งยักษ์', en: 'Ice giant' },
    stats: { diameter: 51118, distAU: 19.19, distMkm: 2867.0, orbitDays: 30687, rotHours: 17.24, retro: true, tempC: -195, moons: 29, tilt: 97.77, gravity: 8.9 },
    facts: {
      th: [
        'แกนเอียงราว 98° จึงเหมือนกลิ้งไปรอบดวงอาทิตย์ในแนวนอน',
        'แต่ละขั้วได้รับแสงอาทิตย์ต่อเนื่องราว 42 ปี แล้วมืดต่อเนื่องอีก 42 ปี',
        'มีเทนในบรรยากาศดูดกลืนแสงสีแดง เราจึงเห็นเป็นสีฟ้าอมเขียว',
        'ดาวเคราะห์ดวงแรกที่ค้นพบด้วยกล้องโทรทรรศน์ โดยวิลเลียม เฮอร์เชล เมื่อปี ค.ศ. 1781',
      ],
      en: [
        'Tilted about 98°, it rolls around the Sun on its side.',
        'Each pole gets about 42 years of continuous sunlight, then 42 years of darkness.',
        'Methane in its air absorbs red light, leaving the cyan color we see.',
        'The first planet discovered with a telescope, by William Herschel in 1781.',
      ],
    },
    moons: [
      { id: 'miranda', bake: 17, km: 472, dist: 4.6, periodDays: 1.413, incl: 4.3,
        name: { th: 'มิแรนดา', en: 'Miranda' },
        fact: { th: 'มีหน้าผาเวโรนารูเปส ลึกราว 20 กม. สูงที่สุดเท่าที่รู้จักในระบบสุริยะ', en: 'Home to Verona Rupes, a cliff about 20 km deep, the tallest known in the Solar System.' } },
      { id: 'ariel', bake: 10, km: 1158, dist: 5.4, periodDays: 2.520, incl: 0.26,
        colors: [[0.48, 0.47, 0.46], [0.78, 0.77, 0.75]], craters: 0.55, grooves: 1,
        name: { th: 'แอเรียล', en: 'Ariel' },
        fact: { th: 'มีพื้นผิวสว่างที่สุดและอาจอายุน้อยที่สุดในบรรดาดวงจันทร์ใหญ่ของยูเรนัส', en: 'The brightest and possibly youngest surface among Uranus’s large moons.' } },
      { id: 'umbriel', bake: 10, km: 1169, dist: 6.3, periodDays: 4.144, incl: 0.13,
        colors: [[0.20, 0.20, 0.21], [0.36, 0.36, 0.37]], craters: 1.0,
        name: { th: 'อัมเบรียล', en: 'Umbriel' },
        fact: { th: 'มืดที่สุดในบรรดาดวงจันทร์ใหญ่ของยูเรนัส', en: 'The darkest of Uranus’s large moons.' } },
      { id: 'titania', bake: 10, km: 1577, dist: 7.4, periodDays: 8.706, incl: 0.34,
        colors: [[0.40, 0.38, 0.37], [0.66, 0.63, 0.60]], craters: 0.75, grooves: 1,
        name: { th: 'ไททาเนีย', en: 'Titania' },
        fact: { th: 'ดวงจันทร์ที่ใหญ่ที่สุดของยูเรนัส มีหุบเขารอยเลื่อนขนาดมหึมา', en: 'Uranus’s largest moon, cut by enormous fault canyons.' } },
      { id: 'oberon', bake: 10, km: 1523, dist: 8.6, periodDays: 13.46, incl: 0.06,
        colors: [[0.34, 0.31, 0.30], [0.58, 0.54, 0.51]], craters: 1.0,
        name: { th: 'โอเบอรอน', en: 'Oberon' },
        fact: { th: 'ดวงจันทร์ใหญ่ที่อยู่ไกลที่สุดของยูเรนัส เก่าแก่และเต็มไปด้วยหลุมอุกกาบาต', en: 'Uranus’s outermost large moon, old and heavily cratered.' } },
    ],
  },
  {
    id: 'neptune', kind: 'gas', bake: 7, radius: artRadius(49528),
    el: { a: 30.06992276, e: 0.00859048, I: 1.77004347, L: -55.12002969, lp: 44.96476227, node: 131.78422574, Ldot: 218.45945325 },
    pole: [299.36, 43.46], rotHours: 16.11, oblate: 0.017,
    orbitColor: [0.45, 0.62, 1.0], dot: ['#5b7fe0', '#1a2b6b'],
    atmo: { color: [0.36, 0.56, 1.0], sunset: [0.5, 0.7, 1.0], scale: 1.035, density: 0.8, intensity: 0.95 },
    flow: { amp: 0.010, jets: 2, period: 7, turb: 0.0035, refLat: -20, limb: 0.5, haze: [0.55, 0.70, 1.0], hazeAmt: 0.5, bump: 0.005, wrap: 0.15 },
    storms: true,
    scatter: { tauR: [0.015, 0.05, 0.13], tauM: 0.02, mie: [0.7, 0.85, 1.0], g: 0.6, H: 0.008, shell: 1.05, I: 4 },
    rings: { kind: 'neptune', inner: 1.65, outer: 2.56 },
    name: { th: 'ดาวเนปจูน', en: 'Neptune' },
    type: { th: 'ดาวเคราะห์น้ำแข็งยักษ์', en: 'Ice giant' },
    stats: { diameter: 49528, distAU: 30.07, distMkm: 4515.0, orbitDays: 60190, rotHours: 16.11, retro: false, tempC: -200, moons: 16, tilt: 28.32, gravity: 11.0 },
    facts: {
      th: [
        'มีลมแรงที่สุดในระบบสุริยะ เร็วราว 2,000 กม./ชม.',
        'ดาวเคราะห์ดวงแรกที่ถูกทำนายตำแหน่งด้วยคณิตศาสตร์ก่อนมีผู้มองเห็น (ค.ศ. 1846)',
        'หนึ่งปีของเนปจูนยาว 165 ปีของโลก มันเพิ่งโคจรครบรอบแรกนับจากวันค้นพบเมื่อปี 2011',
        'ไทรทัน ดวงจันทร์ที่ใหญ่ที่สุด โคจรย้อนทิศ และน่าจะเป็นวัตถุจากแถบไคเปอร์ที่ถูกจับไว้',
      ],
      en: [
        'The strongest winds in the Solar System, about 2,000 km/h.',
        'The first planet located by mathematical prediction before anyone saw it (1846).',
        'One Neptune year lasts 165 Earth years; it finished its first orbit since discovery in 2011.',
        'Its largest moon Triton orbits backwards and is probably a captured Kuiper Belt object.',
      ],
    },
    moons: [
      { id: 'triton', bake: 18, km: 2707, dist: 5.2, periodDays: -5.877, incl: 157,
        name: { th: 'ไทรทัน', en: 'Triton' },
        fact: { th: 'โคจรสวนทางกับการหมุนของเนปจูน และมีน้ำพุไนโตรเจนพุ่งจากพื้นผิว', en: 'Orbits against Neptune’s spin, and nitrogen geysers erupt from its surface.' } },
    ],
  },
];

export const SUN = {
  id: 'sun', kind: 'sun', radius: SUN_RADIUS,
  dot: ['#ffe2a6', '#e07a2a'],
  name: { th: 'ดวงอาทิตย์', en: 'The Sun' },
  type: { th: 'ดาวฤกษ์ชนิด G2V (ดาวแคระเหลือง)', en: 'G2V star (yellow dwarf)' },
  stats: { diameter: 1392700, surfaceC: 5500, coreMC: 15, rotEq: 25, rotPole: 35, ageGyr: 4.6, galacticMyr: 230, planets: 8 },
  facts: {
    th: [
      'มีมวลคิดเป็น 99.86% ของมวลทั้งหมดในระบบสุริยะ',
      'แสงอาทิตย์ใช้เวลาราว 8 นาที 20 วินาทีเดินทางมาถึงโลก',
      'แกนกลางร้อนราว 15 ล้าน °C ฟิวชันนิวเคลียร์เปลี่ยนมวลราว 4 ล้านตันเป็นพลังงานทุกวินาที',
      'พื้นผิวเต็มไปด้วยแกรนูล เซลล์การพาความร้อนกว้างราว 1,000 กม. ที่มีอายุเพียง 10–20 นาที',
    ],
    en: [
      'Holds 99.86% of all the mass in the Solar System.',
      'Sunlight takes about 8 minutes 20 seconds to reach Earth.',
      'The core is about 15 million °C; fusion turns about 4 million tonnes of matter into energy every second.',
      'The surface is tiled with granules, convection cells about 1,000 km wide that last only 10–20 minutes.',
    ],
  },
};

// Belts (AU ranges) rendered as particles.
export const BELTS = [
  { id: 'asteroids', count: 6000, a: [2.15, 3.3], incl: 9, size: [0.8, 1.7], color: [0.58, 0.53, 0.48], alpha: 0.42 },
  { id: 'kuiper', count: 4200, a: [30.5, 50], incl: 14, size: [0.8, 1.6], color: [0.55, 0.60, 0.70], alpha: 0.32 },
];

// Time speeds in simulated days per real second.
export const SPEEDS = [
  { d: 1 / 24, th: '1 ชม./วินาที', en: '1 hour / s' },
  { d: 0.5, th: '12 ชม./วินาที', en: '12 hours / s' },
  { d: 2, th: '2 วัน/วินาที', en: '2 days / s' },
  { d: 10, th: '10 วัน/วินาที', en: '10 days / s' },
  { d: 30.44, th: '1 เดือน/วินาที', en: '1 month / s' },
  { d: 121.75, th: '4 เดือน/วินาที', en: '4 months / s' },
  { d: 365.25, th: '1 ปี/วินาที', en: '1 year / s' },
];
export const DEFAULT_SPEED = 2;

export const STRINGS = {
  th: {
    tagline: 'สำรวจระบบสุริยะแบบสามมิติ',
    overview: 'ภาพรวม', labels: 'ป้ายชื่อ', info: 'ข้อมูล', help: 'วิธีใช้', fullscreen: 'เต็มจอ', lang: 'EN',
    play: 'เล่น', pause: 'หยุด', slower: 'ช้าลง', faster: 'เร็วขึ้น', today: 'วันนี้', paused: 'หยุดเวลา',
    diameter: 'เส้นผ่านศูนย์กลาง', distance: 'ระยะห่างจากดวงอาทิตย์', orbit: 'คาบการโคจร', rotation: 'คาบการหมุนรอบตัวเอง',
    temp: 'อุณหภูมิเฉลี่ย', moons: 'ดวงจันทร์ที่รู้จัก', tilt: 'แกนเอียง', gravity: 'แรงโน้มถ่วงพื้นผิว',
    facts: 'ข้อเท็จจริงน่ารู้', majorMoons: 'ดวงจันทร์หลัก', orbits: 'โคจรรอบ', moonOf: 'ดวงจันทร์ของ', backTo: 'กลับไปที่',
    surfaceTemp: 'อุณหภูมิพื้นผิว', coreTemp: 'อุณหภูมิแกนกลาง', sunRotation: 'คาบการหมุน (เส้นศูนย์สูตร–ขั้ว)', age: 'อายุ',
    galactic: 'โคจรรอบใจกลางทางช้างเผือก', planets: 'ดาวเคราะห์บริวาร',
    km: 'กม.', mkm: 'ล้าน กม.', days: 'วัน', years: 'ปี', h: 'ชม.', m: 'นาที', retro: 'หมุนย้อนทิศ', range: 'ช่วง',
    gyr: 'พันล้านปี', myr: 'ล้านปี', mc: 'ล้าน °C', ms2: 'ม./วินาที²',
    hidePanel: 'ซ่อนข้อมูล', showPanel: 'แสดงข้อมูล', close: 'ปิด',
    loading: 'กำลังเตรียมระบบสุริยะ', building: 'กำลังสร้าง', textures: 'โหลดภาพพื้นผิวโลกและดวงจันทร์', sky: 'ท้องฟ้าและทางช้างเผือก', ready: 'พร้อมแล้ว',
    scaleNote: 'ขนาดและระยะทางถูกปรับย่อเพื่อให้เห็นทั้งระบบในภาพเดียว ตำแหน่งดาวเคราะห์คำนวณจากวันที่จริง',
    helpTitle: 'วิธีควบคุม', desktop: 'คอมพิวเตอร์', mobile: 'มือถือและแท็บเล็ต',
    hDesk: [['ลากเมาส์ซ้าย', 'หมุนมุมกล้อง'], ['ล้อเมาส์', 'ซูมเข้า–ออก'], ['ลากเมาส์ขวา', 'เลื่อนกล้อง'], ['คลิกดาว', 'บินไปยังดาวดวงนั้น'], ['Esc', 'กลับภาพรวม'], ['1–8 · 0', 'เลือกดาวเคราะห์ · ดวงอาทิตย์'], ['Space', 'หยุด/เล่นเวลา']],
    hMob: [['ลากหนึ่งนิ้ว', 'หมุนมุมกล้อง'], ['หยิกสองนิ้ว', 'ซูม'], ['ลากสองนิ้ว', 'เลื่อนกล้อง'], ['แตะดาว', 'บินไปยังดาวดวงนั้น']],
    credits: 'แผนที่สี: Solar System Scope (CC BY 4.0) จากข้อมูลภารกิจของ NASA · ความสูงภูมิประเทศ: NASA/USGS จาก MESSENGER (ดาวพุธ), Magellan (ดาวศุกร์), MGS MOLA (ดาวอังคาร), LRO LOLA (ดวงจันทร์) · ดาวยูเรนัส ดาวเนปจูน และดวงจันทร์บริวารอื่นสร้างด้วยเชดเดอร์',
    radar: 'RADAR SURFACE MODE', radarSub: 'มองทะลุเมฆลงไปถึงพื้นผิว (ข้อมูลเรดาร์ Magellan)', falseColor: 'สีตามระดับความสูง',
    surface: 'รายละเอียดพื้นผิว', loadingRes: 'กำลังโหลด',
    noWebGL: 'อุปกรณ์นี้ไม่รองรับ WebGL 2 ลองเปิดด้วยเบราว์เซอร์รุ่นใหม่บนคอมพิวเตอร์หรือมือถือ',
    explore: 'ลากเพื่อหมุนรอบดาว · ซูมเพื่อดูรายละเอียด',
    time: 'ความเร็วเวลา',
  },
  en: {
    tagline: 'A 3D journey through our Solar System',
    overview: 'Overview', labels: 'Labels', info: 'Info', help: 'Controls', fullscreen: 'Fullscreen', lang: 'ไทย',
    play: 'Play', pause: 'Pause', slower: 'Slower', faster: 'Faster', today: 'Today', paused: 'Time paused',
    diameter: 'Diameter', distance: 'Distance from Sun', orbit: 'Orbital period', rotation: 'Rotation period',
    temp: 'Average temperature', moons: 'Known moons', tilt: 'Axial tilt', gravity: 'Surface gravity',
    facts: 'Did you know', majorMoons: 'Major moons', orbits: 'Orbits', moonOf: 'Moon of', backTo: 'Back to',
    surfaceTemp: 'Surface temperature', coreTemp: 'Core temperature', sunRotation: 'Rotation (equator–poles)', age: 'Age',
    galactic: 'Orbit around the galaxy', planets: 'Planets',
    km: 'km', mkm: 'million km', days: 'days', years: 'years', h: 'h', m: 'm', retro: 'retrograde', range: 'range',
    gyr: 'billion years', myr: 'million years', mc: 'million °C', ms2: 'm/s²',
    hidePanel: 'Hide info', showPanel: 'Show info', close: 'Close',
    loading: 'Preparing the Solar System', building: 'Building', textures: 'Loading Earth and Moon imagery', sky: 'Sky and Milky Way', ready: 'Ready',
    scaleNote: 'Sizes and distances are scaled so the whole system fits one view. Planet positions are computed for the real date.',
    helpTitle: 'Controls', desktop: 'Desktop', mobile: 'Phone & tablet',
    hDesk: [['Left-drag', 'Rotate camera'], ['Mouse wheel', 'Zoom in and out'], ['Right-drag', 'Pan camera'], ['Click a planet', 'Fly to it'], ['Esc', 'Back to overview'], ['1–8 · 0', 'Select planet · Sun'], ['Space', 'Pause or play time']],
    hMob: [['One-finger drag', 'Rotate camera'], ['Pinch', 'Zoom'], ['Two-finger drag', 'Pan camera'], ['Tap a planet', 'Fly to it']],
    credits: 'Colour maps: Solar System Scope (CC BY 4.0), based on NASA mission data · Elevation: NASA/USGS from MESSENGER (Mercury), Magellan (Venus), MGS MOLA (Mars), LRO LOLA (Moon) · Uranus, Neptune and the other moons are shader-generated.',
    radar: 'RADAR SURFACE MODE', radarSub: 'See through the clouds to the ground (Magellan radar data)', falseColor: 'False-colour elevation',
    surface: 'Surface detail', loadingRes: 'Loading',
    noWebGL: 'This device does not support WebGL 2. Try a recent browser on a computer or phone.',
    explore: 'Drag to orbit · zoom for detail',
    time: 'Time speed',
  },
};
