import { supabase } from '@/lib/supabase'
import { ADMIN_EMAIL } from '@/lib/admin'

export const isOwner = (email?: string | null) => email?.toLowerCase() === ADMIN_EMAIL

// เช็กจากฐานข้อมูลว่าผู้ใช้ที่ล็อกอินอยู่เป็นแอดมินไหม
export async function checkAdmin(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false
  if (isOwner(session.user.email)) return true
  const { data, error } = await supabase.rpc('is_admin')
  return !error && data === true
}