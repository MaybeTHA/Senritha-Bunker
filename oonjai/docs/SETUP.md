# คู่มือตั้งค่า อุ่นใจ (ทีละคลิก)

## A. สร้าง Firebase project (ทำครั้งเดียว ~10 นาที)
1. เข้า https://console.firebase.google.com → กด **Create a project / เพิ่มโปรเจกต์**
2. ตั้งชื่อ เช่น `oonjai-hackathon` → Continue → ปิด Google Analytics ได้ → **Create project**
3. **เพิ่มแอปผู้สูงอายุ**: หน้า Project Overview กดไอคอน **Android**
   - Android package name: `th.oonjai.elder` → **Register app**
   - กด **Download google-services.json** → เก็บไว้ก่อน → Next จนจบ (ข้ามขั้น SDK ได้ โค้ดใส่ให้แล้ว)
4. **เพิ่มแอปผู้ดูแล**: กด **Add app** → Android → package `th.oonjai.caregiver` → Register
   - ดาวน์โหลด google-services.json **อีกครั้ง** (ไฟล์ใหม่นี้มีทั้ง 2 แอปในไฟล์เดียว ใช้ไฟล์นี้)
5. **เปิด Authentication**: เมนูซ้าย Build → **Authentication** → Get started → แท็บ Sign-in method → **Anonymous** → Enable → Save
6. **เปิด Firestore**: Build → **Firestore Database** → Create database → เลือก location `asia-southeast1` (สิงคโปร์) → **Start in production mode** → Create
7. **ใส่ Security Rules**: ใน Firestore → แท็บ **Rules** → ลบของเดิม → คัดลอกทั้งไฟล์ `oonjai/firebase/firestore.rules` มาวาง → **Publish**

> Phase 5 (LINE + AI) จะต้องอัปเกรดเป็นแพ็กเกจ **Blaze** (ผูกบัตร ใช้น้อยแทบไม่เสียเงิน) — ยังไม่ต้องทำตอนนี้

## B. ได้ APK มาติดตั้ง
### วิธีที่ 1: ให้ GitHub build ให้ (ไม่ต้องลงโปรแกรม)
1. ใน GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Name: `GOOGLE_SERVICES_JSON` / Secret: เปิดไฟล์ google-services.json ด้วย Notepad → คัดลอกทั้งหมดมาวาง → **Add secret**
3. แท็บ **Actions** → เลือก **Oonjai APK** → **Run workflow** → รอ ~5 นาที
4. กดเข้า run ที่เสร็จ (✅) → ส่วน **Artifacts** → ดาวน์โหลด `oonjai-apks` → แตก zip ได้ 2 ไฟล์
   - `app-elder-debug.apk` → ลงมือถือผู้สูงอายุ
   - `app-caregiver-debug.apk` → ลงมือถือผู้ดูแล
5. ส่ง APK เข้ามือถือ (LINE/Google Drive) → แตะติดตั้ง → อนุญาต "ติดตั้งจากแหล่งที่ไม่รู้จัก"

### วิธีที่ 2: Android Studio
1. ติดตั้ง Android Studio → **Open** → เลือกโฟลเดอร์ `oonjai`
2. วาง google-services.json ไว้ที่ `oonjai/app-elder/` และ `oonjai/app-caregiver/` (ไฟล์เดียวกัน)
3. เลือก `app-elder` หรือ `app-caregiver` ที่แถบบน → กด ▶ Run

> ⚠️ ห้าม commit google-services.json (มีใน .gitignore แล้ว)

## C. ทดสอบการจับคู่ (Phase 1)
1. เครื่องผู้ดูแล: เปิด **อุ่นใจ ผู้ดูแล** → **เพิ่มผู้สูงอายุ** → ใส่ชื่อ → ได้ QR + รหัส 6 หลัก
2. เครื่องผู้สูงอายุ: เปิด **อุ่นใจ ผู้สูงอายุ** → ติ๊กยินยอม → **สแกน QR** (หรือกรอกรหัส)
3. ทั้งสองเครื่องขึ้น ✅ จับคู่สำเร็จ
