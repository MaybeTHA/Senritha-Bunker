# อุ่นใจ — แอปติดตามผู้สูงอายุ (Android)

| โมดูล | หน้าที่ |
| --- | --- |
| `app-elder/` | อุ่นใจ ผู้สูงอายุ — ทำงานเบื้องหลัง |
| `app-caregiver/` | อุ่นใจ ผู้ดูแล — dashboard, แจ้งเตือน, ตั้งค่า |
| `core/` | model, Firestore repository, theme ที่ใช้ร่วมกัน |
| `firebase/` | Security Rules (+ Cloud Functions ใน Phase 5) |

ตั้งค่าครั้งแรก: [docs/SETUP.md](docs/SETUP.md)

## สถานะ
- [x] Phase 1: โครงสร้าง + Firebase + จับคู่ QR/รหัส + PDPA
- [ ] Phase 2: Foreground service + เตือนยาด้วยเสียง + event
- [ ] Phase 3: Dashboard + FCM
- [ ] Phase 4: หกล้ม + geofence + แบต/heartbeat
- [ ] Phase 5: Cloud Functions (LINE + Gemini)
- [ ] Phase 6: โหมดเดโม + APK
