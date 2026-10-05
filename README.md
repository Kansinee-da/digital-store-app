# DigitalStore (Next.js + Supabase + Vercel)

หน้าเว็บครบตามดีไซน์: หน้าแรก, รายละเอียดสินค้า, Login/สมัครสมาชิก, ตะกร้า, ชำระเงิน,
ประวัติคำสั่งซื้อ, คลังของฉัน, Admin Dashboard (จัดการสินค้า + Import/Export CSV/JSON)
ใช้งานได้ทั้งจอคอมพิวเตอร์และมือถือ (responsive)

## รันในเครื่อง
1. `npm install`
2. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่าจาก Supabase (Project Settings > API)
3. รัน `supabase/schema.sql` ใน Supabase SQL Editor (สร้างตาราง products, orders)
4. `npm run dev` แล้วเปิด http://localhost:3000
(ยังไม่ต่อ Supabase ก็เปิดดูได้ทุกหน้า จะใช้ข้อมูลตัวอย่างแทน)

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
| Admin Dashboard | `app/admin/page.tsx` |
| เมนูบนสุด (มือถือมีปุ่มแฮมเบอร์เกอร์) | `components/Nav.tsx` |
| ตะกร้าสินค้า (เก็บใน localStorage) | `lib/cart.tsx` |

## แก้ดีไซน์เอง
สี / มุมโค้ง / ระยะห่าง แก้ที่ `app/globals.css` ตัวแปรบนสุด (`:root{...}`) ที่เดียว ทั้งเว็บเปลี่ยนตาม

## สถานะการเชื่อมระบบจริง
- **ตะกร้า**: ทำงานจริงแล้ว (เก็บใน localStorage)
- **ชำระเงิน**: เป็น **โหมดจำลอง** ตั้งใจไม่ต่อผู้ให้บริการรับชำระเงินจริง (เช่น Stripe) เพื่อให้ส่งงาน/สาธิตได้ง่าย
  กดปุ่ม "ชำระเงิน" แล้วระบบจะถือว่าจ่ายสำเร็จทันที **และบันทึกออเดอร์ลงตาราง orders จริง**
  (ถ้าล็อกอินอยู่) เพื่อให้หน้าประวัติคำสั่งซื้อกับคลังของฉันมีข้อมูลจริงให้ดูผลลัพธ์ครบวงจร
- **ดาวน์โหลดไฟล์**: ต่อจริงแล้วผ่าน Supabase Storage ดูวิธีตั้งค่าในหัวข้อ "ตั้งค่าไฟล์ดาวน์โหลด"
  เพราะออเดอร์ถูกบันทึกจริงจากขั้นชำระเงินจำลอง ปุ่มดาวน์โหลดของสินค้าที่ "ซื้อ" ไปแล้วจะใช้งานได้จริง
- **ประวัติ/คลังของฉัน**: ดึงจากตาราง orders ถ้าล็อกอินและมีออเดอร์จริง ไม่งั้นแสดงข้อมูลตัวอย่าง
  (ข้อมูลตัวอย่างกดดาวน์โหลดไม่ได้จริง เพราะไม่ใช่ออเดอร์จริงในฐานข้อมูล)
- **Admin**: เพิ่ม/ลบสินค้าได้จริงผ่าน Supabase, Export CSV/JSON ทำงานจริง
  Import CSV/JSON, หน้าแก้ไขสินค้า, และการจำกัดสิทธิ์เฉพาะแอดมิน ยังไม่ได้ทำ

## ถ้าอยากต่อผู้ให้บริการรับชำระเงินจริงในอนาคต (เช่น Stripe)
แก้ที่ `app/api/checkout/route.ts` ไฟล์เดียว โดยเพิ่มการเรียก API ของผู้ให้บริการนั้น
แล้วให้ระบบสร้างแถวใน orders หลังยืนยันว่าจ่ายเงินสำเร็จจริง (ปัจจุบันจำลองขั้นนี้ไว้แล้ว)

## ตั้งค่าไฟล์ดาวน์โหลด (Supabase Storage)
1. ไปที่ Supabase Dashboard > Storage > New bucket ตั้งชื่อ `product-files` และเลือก **Private** (ห้ามติ๊ก Public)
2. อัปโหลดไฟล์สินค้าเข้า bucket นี้ เช่น `notion-template.zip`
3. ไปที่ตาราง `products` ใน Table Editor ตั้งค่าคอลัมน์ `file_path` ของแต่ละสินค้าให้ตรงกับชื่อไฟล์ที่อัปโหลด
   เช่น `update products set file_path='notion-template.zip' where name='Notion Template';`
4. คัดลอก **service_role key** จาก Project Settings > API ใส่ใน `.env.local` เป็น `SUPABASE_SERVICE_ROLE_KEY`
   (คีย์นี้มีสิทธิ์เต็ม ห้ามใส่คำว่า `NEXT_PUBLIC_` นำหน้า และห้ามอัปขึ้น GitHub)
5. ระบบจะอนุญาตให้ดาวน์โหลดเฉพาะคนที่มีออเดอร์ของสินค้านั้นจริงในตาราง `orders` เท่านั้น
   ลิงก์ดาวน์โหลดที่สร้างให้จะหมดอายุใน 60 วินาที เพื่อความปลอดภัย

## Deploy ขึ้น Vercel
push ขึ้น GitHub > Vercel > Import > ใส่ Environment Variables ให้ครบทุกตัวใน `.env.example` > Deploy
**ห้ามอัปโหลดไฟล์ `.env.local` ขึ้น GitHub** (ควรอยู่ใน `.gitignore` อยู่แล้วเพราะ Next.js ตั้งไว้ให้)

## Mobile App / Desktop App
เว็บนี้ตอบสนองต่อขนาดจอ (responsive) อยู่แล้ว ใช้งานบนมือถือผ่านเบราว์เซอร์ได้ทันที
เมื่ออยากได้เป็นแอปติดตั้งจริง:
- **Mobile**: ห่อเว็บนี้ด้วย Capacitor (`npx cap init`) หรือใช้ PWABuilder จาก URL ที่ deploy แล้ว
- **Desktop**: ห่อด้วย Tauri หรือ Electron โดยชี้ไปที่ URL ที่ deploy แล้ว
ทั้งสองแบบใช้ backend (Supabase) ชุดเดียวกับเว็บ ไม่ต้องเขียนระบบหลังบ้านซ้ำ
