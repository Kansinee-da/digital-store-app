import { NextRequest, NextResponse } from 'next/server'
import { supabaseForUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/admin'

export async function GET(req: NextRequest, { params }: { params: { productId: string } }) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนดาวน์โหลด' }, { status: 401 })

  const sb = supabaseForUser(token)
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนดาวน์โหลด' }, { status: 401 })

  // แอดมินดาวน์โหลดได้เลยโดยไม่ต้องซื้อ ส่วนลูกค้าทั่วไปต้องมีออเดอร์
  if (!isAdmin(user.email)) {
    const { data: order } = await sb.from('orders').select('id')
      .eq('user_id', user.id).eq('product_id', params.productId).limit(1).maybeSingle()
    if (!order) return NextResponse.json({ error: 'คุณยังไม่ได้ซื้อสินค้านี้' }, { status: 403 })
  }

  const { data: product } = await sb.from('products').select('name, file_path').eq('id', params.productId).maybeSingle()
  if (!product?.file_path) return NextResponse.json({ error: 'สินค้านี้ยังไม่มีไฟล์ให้ดาวน์โหลด' }, { status: 404 })

  const ext = product.file_path.split('.').pop()
  const downloadName = `${product.name}.${ext}`

  const { data: signed, error } = await supabaseAdmin.storage
    .from('product-files')
    .createSignedUrl(product.file_path, 120, { download: downloadName })
  if (error || !signed) return NextResponse.json({ error: 'สร้างลิงก์ดาวน์โหลดไม่สำเร็จ' }, { status: 500 })

  return NextResponse.json({ url: signed.signedUrl })
}