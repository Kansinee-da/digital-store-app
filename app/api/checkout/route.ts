import { NextRequest, NextResponse } from 'next/server'
import { supabaseForUser } from '@/lib/supabase-server'

// โหมดจำลองการชำระเงิน (ไม่ต่อ Stripe จริง)
// กด "ชำระเงิน" = ถือว่าจ่ายสำเร็จ และบันทึกออเดอร์ลงตาราง orders จริง
// ถ้าบันทึกไม่สำเร็จ จะตอบ error กลับไป (ไม่แกล้งทำเป็นสำเร็จ)
export async function POST(req: NextRequest) {
  const { items, total } = await req.json().catch(() => ({ items: null, total: 0 }))

  if (!Array.isArray(items) || !items.length) {
    return NextResponse.json({ error: 'ไม่มีสินค้าในตะกร้า' }, { status: 400 })
  }

  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนชำระเงิน' }, { status: 401 })
  }

  const sb = supabaseForUser(token)
  const { data: { user }, error: userErr } = await sb.auth.getUser()
  if (userErr || !user) {
    return NextResponse.json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' }, { status: 401 })
  }

  // กันซื้อซ้ำ: ถ้ามีสินค้าที่เคยซื้อแล้ว ให้ปฏิเสธทั้งรายการ
  const ids = items.map((i: any) => i.id)
  const { data: owned } = await sb
    .from('orders').select('product_id')
    .eq('user_id', user.id).in('product_id', ids)

  if (owned?.length) {
    const ownedIds = [...new Set(owned.map((o: any) => o.product_id))]
    const { data: prods } = await sb.from('products').select('id, name').in('id', ownedIds)
    const names = (prods ?? []).map((p: any) => p.name).join(', ') || 'บางรายการ'
    return NextResponse.json(
      { error: `คุณเคยซื้อสินค้านี้แล้ว: ${names} กรุณาตรวจสอบที่คลังของคุณ`, owned: ownedIds },
      { status: 409 }
    )
  }

  const rows = items.map((i: any) => ({
    user_id: user.id,
    product_id: i.id,
    amount: i.price * i.qty,
  }))
  const { error } = await sb.from('orders').insert(rows)
  if (error) {
    console.error('บันทึกออเดอร์ไม่สำเร็จ:', error.message)
    return NextResponse.json({ error: 'บันทึกออเดอร์ไม่สำเร็จ: ' + error.message }, { status: 500 })
  }

  return NextResponse.json({ demo: true, total })
}