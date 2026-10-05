import { createClient } from '@supabase/supabase-js'
// คำเตือน: ไฟล์นี้ใช้ Service Role Key ซึ่งมีสิทธิ์เต็ม ห้าม import เข้าไฟล์ที่มี 'use client'
// ใช้ได้เฉพาะใน API route (ฝั่งเซิร์ฟเวอร์) เท่านั้น
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
)
