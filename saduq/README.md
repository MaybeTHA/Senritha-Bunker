# Saduq

ผู้ช่วยของ **ผู้ดูแลผู้สูงอายุ** (รุ่น 2.0) — ผู้ใช้คือลูกหลาน/ผู้ดูแล ผู้สูงอายุเป็นโปรไฟล์ "ผู้รับการดูแล" · เว็บแอป JavaScript ล้วน ไม่มี framework ข้อมูลเก็บในเครื่องผู้ใช้ (IndexedDB)

## โครงสร้าง
- `src/` — โค้ด (ES modules): `main.js` เส้นทางและเมนู · `features/` หน้าจอ · `domain/` ข้อมูลและกฎ (`catalog.js` = บริการและสิทธิจริง · `market.js` = สินค้าจริง · `vitals.js` = เกณฑ์บันทึกสุขภาพ) · `data/` ที่เก็บข้อมูล · `ui/kit.js` ชิ้นส่วน UI · `styles/` CSS
- `body.html` — โครงหน้า (แถบบน · เนื้อหา · เมนูล่าง)
- `assets/` — โลโก้และภาพประกอบ
- `build.py` — รวมทุกอย่างเป็น `dist/index.html` หน้าเดียว
- `dist/` — ไฟล์พร้อม deploy (เช่น Vercel: ตั้ง Output Directory = `saduq/dist`)

## เปิดเป็นเว็บแอป (GitHub Pages)
1. merge PR เข้า `main`
2. GitHub → repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main** / **(root)** → Save
3. รอ 1–2 นาที แล้วเปิด https://maybetha.github.io/Senritha-Bunker/saduq/

## ผู้ช่วย AI (`src/ai/engine.js` · หน้า `#ai`)
เล่าปัญหา แล้วได้ 3 ตัวเลือก — ท่อ 4 ขั้น แต่ละขั้นเป็นฟังก์ชันแยก:
1. **Chat Bot** รับข้อความ (พิมพ์หรือพูด) · พิมพ์ประโยคในช่องค้นหาหน้าหลักแล้วกด Enter ก็เข้าที่นี่
2. **AI เข้าใจโจทย์** `localUnderstand()` จับความต้องการ 14 แบบ (เดินทาง เคลื่อนไหว ติดเตียง ผ้าอ้อม คนช่วยดูแล ยา ฉุกเฉิน ฯลฯ) + ใคร พื้นที่ ความถี่ สิทธิ งบ · รู้จักคำปฏิเสธ ("ไม่ได้ติดเตียง") · เติมข้อมูลที่ไม่ได้เล่าจากโปรไฟล์ผู้รับการดูแล
3. **ค้นบริการ** `retrieve()` กรอง `INDEX` (บริการ+สินค้าจริงในแค็ตตาล็อก) ตามประเภทและพื้นที่/อายุ
4. **AI จัดอันดับ** `rank()` ให้คะแนนความเหมาะสม (ฟรี สิทธิบัตรทอง กทม. ใช้ซ้ำได้ ฯลฯ) พร้อมเหตุผล แล้วเลือก 3 ตัวที่ต่างแนวกัน · อาการฉุกเฉิน → โชว์โทร 1669 ก่อนทุกอย่าง

ตัวเข้าใจภาษาทำงานในเครื่อง ไม่ส่งข้อมูลออก · เสียบ LLM แทนได้ด้วย `setUnderstander(fn)` (ต้องเรียกผ่าน backend ของเราเอง ห้ามใส่ API key ในหน้าเว็บ) · AI เลือกจากของจริงในแค็ตตาล็อกเท่านั้น ไม่แต่งบริการใหม่

## Build
```bash
python3 build.py
```
ต้องมี Node.js (ใช้ `npx esbuild`)

## สถานะข้อมูล
- ใช้ได้จริง: ผู้รับการดูแลหลายคน (อายุ สิทธิรักษา การเคลื่อนไหว ข้อมูลการแพทย์) · ตารางยา/นัดหมอรายคน · บันทึกสุขภาพ (ความดัน น้ำตาล ไข้ SpO2 น้ำหนัก) · สิทธิที่น่าจะใช้ได้ (กฎใน `benefitsFor`) · ทีมดูแลและการแบ่งงาน · ติดตามเรื่องที่ยื่น · หน้าฉุกเฉินรายคน
- ข้อมูลจริงพร้อมแหล่งที่มา (ตรวจ พ.ย. 2569): บริการ/สิทธิรัฐใน `catalog.js` (`src`) และสินค้าใน `market.js` (`src`, `price.where`) — ราคาใส่เฉพาะที่เห็นจากร้านในไทย ไม่มีก็บอกว่าไม่มี · อัปเดตข้อมูลให้แก้ `CHECKED` ใน `market.js` ด้วย
- ยังไม่มี: บัญชีและการซิงก์ข้ามเครื่องของทีมดูแล · ระบบสั่งซื้อ/จองในแอป (ลิงก์ออกไปร้านและหน่วยงานจริง)
- เปิดครั้งแรกจะใส่ข้อมูลตัวอย่าง (ติดป้าย "ตัวอย่าง") ให้อัตโนมัติ · ผู้ใช้รุ่น 1.x ที่ใช้ในฐานะผู้สูงอายุ จะถูกย้ายเป็นผู้รับการดูแล 1 คนพร้อมข้อมูลการแพทย์เดิม

## เครดิตภาพ (Wikimedia Commons)
ต้องคงเครดิตตามไลเซนส์ของแต่ละภาพ

| ไฟล์ | ภาพ | ผู้สร้าง | ไลเซนส์ |
|---|---|---|---|
| `h-appt` | [Doctor working in her office while using a computer and taking notes during a consultation with a patient.jpg](https://commons.wikimedia.org/wiki/File:Doctor_working_in_her_office_while_using_a_computer_and_taking_notes_during_a_consultation_with_a_patient.jpg) | Shixart1985 | CC BY 2.0 |
| `h-find` | [โรงพยาบาลบางปะอิน - Bang Pa-in Hospital (2025) - img 10.jpg](https://commons.wikimedia.org/wiki/File:%E0%B9%82%E0%B8%A3%E0%B8%87%E0%B8%9E%E0%B8%A2%E0%B8%B2%E0%B8%9A%E0%B8%B2%E0%B8%A5%E0%B8%9A%E0%B8%B2%E0%B8%87%E0%B8%9B%E0%B8%B0%E0%B8%AD%E0%B8%B4%E0%B8%99_-_Bang_Pa-in_Hospital_(2025)_-_img_10.jpg) | Chainwit. | CC BY 4.0 |
| `h-consult` | [Older woman enjoying a video call at home while smiling and expressing gratitude.jpg](https://commons.wikimedia.org/wiki/File:Older_woman_enjoying_a_video_call_at_home_while_smiling_and_expressing_gratitude.jpg) | Shixart1985 | CC BY 2.0 |
| `h-med` | [Pill Box (32636946385).jpg](https://commons.wikimedia.org/wiki/File:Pill_Box_(32636946385).jpg) | NIAID | CC BY 2.0 |
| `h-check` | [Sphygmomanometer, automatic blood pressure monitor. Oscillometric measurements, millimeter of mercury (mmHg) unit.jpg](https://commons.wikimedia.org/wiki/File:Sphygmomanometer,_automatic_blood_pressure_monitor._Oscillometric_measurements,_millimeter_of_mercury_(mmHg)_unit.jpg) | Albarubescens | CC BY-SA 4.0 |
| `h-1330` | [Somdech Phra Pinklao OPD.jpg](https://commons.wikimedia.org/wiki/File:Somdech_Phra_Pinklao_OPD.jpg) | Jthaw01 | CC BY-SA 4.0 |
| `l-care` | [A woman and her grandson with a developmental disability.jpg](https://commons.wikimedia.org/wiki/File:A_woman_and_her_grandson_with_a_developmental_disability.jpg) | AnikaMeyer | CC BY-SA 4.0 |
| `l-ride` | [Rear ramp load of wheelchair, QDN Office, Hamilton Place Bowen Hills IMGP8392.jpg](https://commons.wikimedia.org/wiki/File:Rear_ramp_load_of_wheelchair,_QDN_Office,_Hamilton_Place_Bowen_Hills_IMGP8392.jpg) | John Robert McPherson | CC BY-SA 4.0 |
| `l-repair` | [Grab bar.jpg](https://commons.wikimedia.org/wiki/File:Grab_bar.jpg) | Gramody | CC BY-SA 2.0 |
| `l-personal` | [Hair Salon In Iran.jpg](https://commons.wikimedia.org/wiki/File:Hair_Salon_In_Iran.jpg) | Mostafameraji | CC0 |
| `l-meal` | [Thai lunch.jpg](https://commons.wikimedia.org/wiki/File:Thai_lunch.jpg) | Takeaway | CC BY-SA 3.0 |
| `s-health` | [2020 Sfigmomanometr elektroniczny.jpg](https://commons.wikimedia.org/wiki/File:2020_Sfigmomanometr_elektroniczny.jpg) | Jacek Halicki | CC BY-SA 4.0 |
| `s-mobility` | [Cane, Walker Cane Hybrid, Walker.JPG](https://commons.wikimedia.org/wiki/File:Cane,_Walker_Cane_Hybrid,_Walker.JPG) | KDPetersen | CC BY-SA 3.0 |
| `s-daily` | [Castellon Pharmacy New Orleans Empty Shelves where TP and Wipes were.jpg](https://commons.wikimedia.org/wiki/File:Castellon_Pharmacy_New_Orleans_Empty_Shelves_where_TP_and_Wipes_were.jpg) | Infrogmation of New Orleans | CC BY-SA 4.0 |
| `s-medical` | [Hospital Bed 2011.JPG](https://commons.wikimedia.org/wiki/File:Hospital_Bed_2011.JPG) | Blogotron | CC0 |
| `c-club` | [Tai Chi Young and Old.jpg](https://commons.wikimedia.org/wiki/File:Tai_Chi_Young_and_Old.jpg) | Peter Harrison from Auckland, New Zealand | CC BY 2.0 |
| `c-events` | [An elderly man dancing at Funsi.jpg](https://commons.wikimedia.org/wiki/File:An_elderly_man_dancing_at_Funsi.jpg) | Shahadusadik | CC BY-SA 4.0 |
| `c-digital` | [Elderly woman with a laptop on her lap talking on the phone and celebrating.jpg](https://commons.wikimedia.org/wiki/File:Elderly_woman_with_a_laptop_on_her_lap_talking_on_the_phone_and_celebrating.jpg) | Shixart1985 | CC BY 2.0 |
| `c-meet` | [Slovakia- kolovratko.jpg](https://commons.wikimedia.org/wiki/File:Slovakia-_kolovratko.jpg) | Davidt164 | CC BY-SA 4.0 |
| `f-members` | [Grandmother and Grandchild.jpg](https://commons.wikimedia.org/wiki/File:Grandmother_and_Grandchild.jpg) | Sinchalak Musulmon | CC BY-SA 4.0 |
| `b-office` | [Chombueng government office - panoramio.jpg](https://commons.wikimedia.org/wiki/File:Chombueng_government_office_-_panoramio.jpg) | chalongrat hantragul | CC BY 3.0 |
| `e-1669` | [Royal Thai Army, Toyota Hiace ambulance..jpg](https://commons.wikimedia.org/wiki/File:Royal_Thai_Army,_Toyota_Hiace_ambulance..jpg) | Manrat Thiusthas | CC BY-SA 4.0 |
| `e-191` | [Royal Thai Police, Toyota Hilux traffic police car..jpg](https://commons.wikimedia.org/wiki/File:Royal_Thai_Police,_Toyota_Hilux_traffic_police_car..jpg) | Manrat Thiusthas | CC BY-SA 4.0 |
| `e-199` | [Thai fire engine and firefighters during 2010 Thai political protests.jpg](https://commons.wikimedia.org/wiki/File:Thai_fire_engine_and_firefighters_during_2010_Thai_political_protests.jpg) | Roland Dobbins from Singapore, Singapore | CC BY 2.0 |
| `e-1784` | [2011 flooding in Ayutthaya Province-EO-1 merged.jpg](https://commons.wikimedia.org/wiki/File:2011_flooding_in_Ayutthaya_Province-EO-1_merged.jpg) | NASA Earth Observatory image created by Jesse Allen and Robert Simmon, using EO- | Public domain |
