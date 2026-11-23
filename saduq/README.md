# Saduq

ศูนย์รวมบริการสำหรับผู้สูงอายุและครอบครัว (ต่อยอดจาก SABAii) — เว็บแอป JavaScript ล้วน ไม่มี framework ข้อมูลเก็บในเครื่องผู้ใช้ (IndexedDB)

## โครงสร้าง
- `src/` — โค้ด (ES modules): `main.js` เส้นทางและเมนู · `features/` หน้าจอ · `domain/` ข้อมูลและกฎ (`catalog.js` = บริการทั้งหมด) · `data/` ที่เก็บข้อมูล · `ui/kit.js` ชิ้นส่วน UI · `styles/` CSS
- `body.html` — โครงหน้า (แถบบน · เนื้อหา · เมนูล่าง)
- `assets/` — โลโก้และภาพประกอบ
- `build.py` — รวมทุกอย่างเป็น `dist/index.html` หน้าเดียว
- `dist/` — ไฟล์พร้อม deploy (เช่น Vercel: ตั้ง Output Directory = `saduq/dist`)

## เปิดเป็นเว็บแอป (GitHub Pages)
1. merge PR เข้า `main`
2. GitHub → repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main** / **(root)** → Save
3. รอ 1–2 นาที แล้วเปิด https://maybetha.github.io/Senritha-Bunker/saduq/

## Build
```bash
python3 build.py
```
ต้องมี Node.js (ใช้ `npx esbuild`)

## สถานะข้อมูล
- **ใช้ได้จริง:** การเตือน (ยา/นัดหมอ/กิจกรรม) · ครอบครัวและสิทธิ์การเห็นข้อมูล · การแจ้งเตือน · เบอร์สายด่วนจากหน่วยงานจริง
- **ข้อมูลจำลอง (`src/domain/providers.js`):** ร้านและผู้ให้บริการ 40 เจ้าใน 14 บริการ ราคา แพ็กเกจ รีวิว และสถานะออเดอร์ที่เดินเองอัตโนมัติ — ชื่อแต่งขึ้นทั้งหมด ไม่มีเบอร์โทรจริง ไม่เก็บเงิน หน้าเว็บมีแถบ "ข้อมูลจำลอง" บนสุดตลอด
- เปิดครั้งแรกจะใส่ข้อมูลตัวอย่างมุมผู้ดูแล (ผู้ใช้ "นิด" ดูแลคุณแม่และคุณพ่อ) ลบได้ที่เมนู ฉัน

## ตลาดบริการ
เลือกบริการ → เรียงตามคะแนน/ราคา/รีวิว และกรองจังหวัด → ติ๊ก "เทียบ" ได้สูงสุด 3 เจ้า (`#compare`) → หน้าร้าน (`#prov/<id>`) เลือกแพ็กเกจ ดูรีวิว → สั่ง/จอง → ติดตามสถานะที่เมนู กิจกรรม → รีวิวเมื่อเสร็จ

## คลิปแนะนำแอป (promo/)
แอนิเมชันแนะนำแอปสำหรับสไลด์ MVP Demo: เปิดแอป → เลือกเขตบ้าน → ดูบริการใกล้บ้านบนแผนที่ → สั่งและติดตามออเดอร์ → ปิดด้วยโลโก้ (30 วินาที เล่นวน, 16:10)
- `promo/saduq-mvp-demo.mp4` — วิดีโอ 1920×1200 พร้อมใส่สไลด์
- `promo/index.html` — เวอร์ชันเล่นในเบราว์เซอร์ (Space หยุด/เล่น · R เริ่มใหม่ · F เต็มจอ · ←/→ เลื่อน 1 วินาที)
- แก้ที่ `promo/promo.src.html` แล้วรัน `python3 promo/build_promo.py` เพื่อฝังโลโก้และภาพลงไฟล์เดียว

## ภาพประกอบ
- ภาพส่วนใหญ่ (สุขภาพ ช่วยงานบ้าน ครอบครัว สิทธิรัฐ กิจกรรม) เป็นชุดภาพของ Saduq เอง
- หมวดซื้อของและฉุกเฉินใช้ภาพจาก Wikimedia Commons ต้องคงเครดิตตามไลเซนส์:

| ไฟล์ | ภาพ | ผู้สร้าง | ไลเซนส์ |
|---|---|---|---|
| `s-health` | [2020 Sfigmomanometr elektroniczny.jpg](https://commons.wikimedia.org/wiki/File:2020_Sfigmomanometr_elektroniczny.jpg) | Jacek Halicki | CC BY-SA 4.0 |
| `s-mobility` | [Cane, Walker Cane Hybrid, Walker.JPG](https://commons.wikimedia.org/wiki/File:Cane,_Walker_Cane_Hybrid,_Walker.JPG) | KDPetersen | CC BY-SA 3.0 |
| `s-daily` | [Castellon Pharmacy New Orleans Empty Shelves where TP and Wipes were.jpg](https://commons.wikimedia.org/wiki/File:Castellon_Pharmacy_New_Orleans_Empty_Shelves_where_TP_and_Wipes_were.jpg) | Infrogmation of New Orleans | CC BY-SA 4.0 |
| `s-medical` | [Hospital Bed 2011.JPG](https://commons.wikimedia.org/wiki/File:Hospital_Bed_2011.JPG) | Blogotron | CC0 |
| `e-1669` | [Royal Thai Army, Toyota Hiace ambulance..jpg](https://commons.wikimedia.org/wiki/File:Royal_Thai_Army,_Toyota_Hiace_ambulance..jpg) | Manrat Thiusthas | CC BY-SA 4.0 |
| `e-191` | [Royal Thai Police, Toyota Hilux traffic police car..jpg](https://commons.wikimedia.org/wiki/File:Royal_Thai_Police,_Toyota_Hilux_traffic_police_car..jpg) | Manrat Thiusthas | CC BY-SA 4.0 |
| `e-199` | [Thai fire engine and firefighters during 2010 Thai political protests.jpg](https://commons.wikimedia.org/wiki/File:Thai_fire_engine_and_firefighters_during_2010_Thai_political_protests.jpg) | Roland Dobbins from Singapore, Singapore | CC BY 2.0 |
| `e-1784` | [2011 flooding in Ayutthaya Province-EO-1 merged.jpg](https://commons.wikimedia.org/wiki/File:2011_flooding_in_Ayutthaya_Province-EO-1_merged.jpg) | NASA Earth Observatory image created by Jesse Allen and Robert Simmon, using EO- | Public domain |
