# DigitalStore

ร้านขายสินค้าดิจิทัล (E-Book, คอร์ส ฯลฯ) ครบวงจร: เลือกซื้อ ชำระเงิน ดาวน์โหลดไฟล์ทันที และมีระบบหลังบ้านสำหรับแอดมิน

**เว็บจริง:** https://digital-store-app-one.vercel.app

> หมายเหตุ: การชำระเงินเป็น **โหมดจำลอง** (ยังไม่ต่อ Stripe จริง) เพื่อให้สาธิตได้ง่าย

## ภาพหน้าจอ

| หน้าร้าน | Admin Dashboard | คลังของฉัน |
|---|---|---|
| ![หน้าร้าน](docs/home.png) | ![Dashboard](docs/dashboard.png) | ![คลัง](docs/library.png) |

## ฟีเจอร์

**ฝั่งลูกค้า**
- สมัครสมาชิก / เข้าสู่ระบบ, แก้ไขโปรไฟล์
- ดูรายการสินค้า ค้นหา และกรองตามหมวดหมู่
- ตะกร้าสินค้า และชำระเงิน (จำลอง)
- ประวัติคำสั่งซื้อ และคลังของฉัน (แสดงวันที่ซื้อและราคา)
- ดาวน์โหลดไฟล์อัตโนมัติหลังซื้อ
- กันซื้อซ้ำ: ถ้าเคยซื้อสินค้านั้นแล้ว จะแจ้งเตือนและให้ไปดาวน์โหลดจากคลังแทน (ตรวจทั้งหน้าสินค้าและฝั่งเซิร์ฟเวอร์ตอนชำระเงิน)

**ฝั่งแอดมิน**
- Dashboard: ยอดขาย สินค้า ลูกค้า สถิติ
- จัดการสินค้า เพิ่ม / เลิกขาย
- จัดการออเดอร์ และลูกค้า
- Import / Export สินค้า (CSV, JSON)
- เพิ่ม / ถอนสิทธิ์แอดมิน (เฉพาะเจ้าของระบบ)

**Realtime (Supabase Realtime)**
- เพิ่มหรือถอนสิทธิ์แอดมินแล้วเมนูเปลี่ยนทันที ผู้ที่ถูกถอนสิทธิ์จะถูกพาออกจากหน้า `/admin`
- รายชื่อแอดมินอัปเดตเอง
- หน้าร้านอัปเดตทันทีเมื่อแอดมินเพิ่มหรือเลิกขายสินค้า

## เทคโนโลยี

- **Frontend:** Next.js (App Router), React, TypeScript
- **Backend (BaaS):** Supabase (Auth, PostgreSQL, Storage, Realtime)
- **Deploy:** Vercel
- รองรับทุกขนาดจอ (responsive) ใช้งานบนมือถือผ่านเบราว์เซอร์ได้

## หน้าเว็บทั้งหมด

| หน้า | ไฟล์ |
|---|---|
| หน้าแรก | `app/page.tsx` |
| รายละเอียดสินค้า | `app/product/[id]/page.tsx` |
| Login/สมัครสมาชิก | `app/login/page.tsx` |
| ตะกร้า | `app/cart/page.tsx` |
| ชำระเงิน | `app/checkout/page.tsx` |
| ประวัติคำสั่งซื้อ | `app/orders/page.tsx` |
| คลังของฉัน | `app/library/page.tsx` |
| โปรไฟล์ | `app/profile/page.tsx` |
| Admin Dashboard | `app/admin/page.tsx` |
| เมนูบนสุด (มือถือเป็นแถบเมนูด้านล่าง) | `components/Nav.tsx` |
| จัดการแอดมิน | `components/AdminManager.tsx` |
| ตะกร้าสินค้า (เก็บใน localStorage) | `lib/cart.tsx` |

## แก้ดีไซน์เอง

สี / มุมโค้ง / ระยะห่าง แก้ที่ `app/globals.css` ตัวแปรบนสุด (`:root{...}`) ที่เดียว ทั้งเว็บเปลี่ยนตาม

## สถานะการเชื่อมระบบจริง

- **ตะกร้า:** ทำงานจริง (เก็บใน localStorage)
- **ชำระเงิน:** เป็น **โหมดจำลอง** ตั้งใจไม่ต่อผู้ให้บริการรับชำระเงินจริง (เช่น Stripe) เพื่อให้ส่งงาน/สาธิตได้ง่าย กดปุ่ม "ฉันสแกนจ่ายแล้ว" ระบบจะถือว่าจ่ายสำเร็จทันที **และบันทึกออเดอร์ลงตาราง orders จริง** เพื่อให้หน้าประวัติคำสั่งซื้อกับคลังของฉันมีข้อมูลจริงครบวงจร
- **ดาวน์โหลดไฟล์:** ต่อจริงผ่าน Supabase Storage (ดูหัวข้อ "ตั้งค่าไฟล์ดาวน์โหลด") ปุ่มดาวน์โหลดของสินค้าที่ซื้อแล้วใช้งานได้จริง
- **ประวัติ / คลังของฉัน:** ดึงจากตาราง orders ของผู้ใช้ที่ล็อกอิน
- **Admin:** เพิ่ม/เลิกขายสินค้าผ่าน Supabase, Export/Import CSV/JSON ทำงานจริง และจำกัดสิทธิ์เฉพาะแอดมิน (ตรวจผ่านฟังก์ชัน `is_admin` และคอลัมน์ `profiles.is_admin`)
- **Realtime:** สิทธิ์แอดมิน รายชื่อแอดมิน และรายการสินค้าอัปเดตทันทีโดยไม่ต้องรีเฟรช

## รันในเครื่อง

1. `npm install`
2. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่าจาก Supabase (Project Settings > API)
3. รัน `supabase/schema.sql` ใน Supabase SQL Editor
4. เปิด Realtime ให้ตารางที่ใช้:
```sql
   alter publication supabase_realtime add table public.profiles;
   alter publication supabase_realtime add table public.products;
```
5. `npm run dev` แล้วเปิด http://localhost:3000

### Environment Variables

| ตัวแปร | คำอธิบาย |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL ของโปรเจกต์ Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (เปิดเผยฝั่งเบราว์เซอร์ได้) |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น **ห้ามใส่ `NEXT_PUBLIC_` และห้ามอัปขึ้น GitHub** |

## ตั้งค่าไฟล์ดาวน์โหลด (Supabase Storage)

1. Supabase > Storage > New bucket ชื่อ `product-files` เลือก **Private** (ห้ามติ๊ก Public)
2. อัปโหลดไฟล์สินค้าเข้า bucket
3. ตั้งค่าคอลัมน์ `file_path` ในตาราง `products` ให้ตรงกับชื่อไฟล์ เช่น
   `update products set file_path='notion-template.zip' where name='Notion Template';`
4. ใส่ **service_role key** ใน `.env.local` เป็น `SUPABASE_SERVICE_ROLE_KEY` (มีสิทธิ์เต็ม ห้ามใส่ `NEXT_PUBLIC_` นำหน้า และห้ามอัปขึ้น GitHub)
5. ระบบอนุญาตให้ดาวน์โหลดเฉพาะผู้ที่มีออเดอร์ของสินค้านั้นจริง (หรือแอดมิน) และลิงก์ดาวน์โหลดจะหมดอายุใน 2 นาที

## Deploy ขึ้น Vercel

1. push โค้ดขึ้น GitHub
2. Vercel > Add New Project > เลือกรีโป
3. ใส่ Environment Variables ให้ครบทุกตัวใน `.env.example` แล้ว Deploy
4. ที่ Supabase > Authentication > URL Configuration ตั้ง **Site URL** เป็นลิงก์เว็บ Vercel และเพิ่ม `https://ลิงก์ของคุณ/**` ใน **Redirect URLs** (เก็บ `http://localhost:3000/**` ไว้สำหรับทดสอบในเครื่อง)

**ห้ามอัปโหลดไฟล์ `.env.local` ขึ้น GitHub** (ถูกกันไว้ใน `.gitignore` แล้ว)

## Mobile App / Desktop App

เว็บนี้รองรับทุกขนาดจอ (responsive) ใช้งานบนมือถือผ่านเบราว์เซอร์ได้ทันที
หากต้องการเป็นแอปติดตั้งจริง:

- **Mobile:** ห่อด้วย Capacitor (`npx cap init`) หรือใช้ PWABuilder จาก URL ที่ deploy แล้ว
- **Desktop:** ห่อด้วย Tauri หรือ Electron โดยชี้ไปที่ URL ที่ deploy แล้ว

ทั้งสองแบบใช้ backend (Supabase) ชุดเดียวกับเว็บ ไม่ต้องเขียนระบบหลังบ้านซ้ำ


## ข้อจำกัดและแผนต่อยอด

- ชำระเงินยังเป็นโหมดจำลอง: ต่อ Stripe จริงได้โดยแก้ที่ `app/api/checkout/route.ts` แล้วสร้างออเดอร์หลังยืนยันว่าจ่ายสำเร็จ
- ราคาในการชำระเงินควรคำนวณจากตาราง `products` ฝั่งเซิร์ฟเวอร์ (ปัจจุบันรับจากหน้าเว็บ)