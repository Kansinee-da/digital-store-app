import { createClient } from '@supabase/supabase-js'

// client ทั่วไป (anon) ใช้อ่านสินค้า/รูปปกได้
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// ใช้ในไฟล์ API route (ฝั่งเซิร์ฟเวอร์) เท่านั้น
// สร้าง client ที่ถือสิทธิ์ของผู้ใช้ที่ล็อกอินอยู่ (ผ่าน access token)
export function supabaseForUser(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}