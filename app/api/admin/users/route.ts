import { NextRequest, NextResponse } from 'next/server'
import { supabaseForUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })

  const sb = supabaseForUser(token)
  const { data: { user } } = await sb.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'เฉพาะแอดมินเท่านั้น' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users: Record<string, { email: string; name: string }> = {}
  for (const u of data.users) {
    users[u.id] = { email: u.email ?? '', name: (u.user_metadata?.display_name as string) ?? '' }
  }
  return NextResponse.json({ users })
}