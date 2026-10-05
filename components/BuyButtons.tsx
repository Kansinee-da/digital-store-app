'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useCart } from '@/lib/cart'
import { supabase } from '@/lib/supabase'
import { checkAdmin } from '@/lib/admin-client'
import type { Product } from '@/lib/products'

export default function BuyButtons({ product }: { product: Product }) {
  const { add } = useCart()
  const router = useRouter()
  const pathname = usePathname()
  const [admin, setAdmin] = useState(false)
  const [owned, setOwned] = useState(false)
  const [ready, setReady] = useState(false) // เช็กสิทธิ์/การซื้อเสร็จหรือยัง
  const [msg, setMsg] = useState('')

  // เช็กว่าผู้ใช้ที่ล็อกอินอยู่เคยซื้อสินค้านี้ไปแล้วหรือยัง
  async function checkOwned(): Promise<boolean> {
    const { data } = await supabase.auth.getSession()
    const uid = data.session?.user?.id
    if (!uid) return false
    const { data: order } = await supabase
      .from('orders').select('id')
      .eq('user_id', uid).eq('product_id', product.id)
      .limit(1).maybeSingle()
    return !!order
  }

  useEffect(() => {
    Promise.all([checkAdmin(), checkOwned()]).then(([a, o]) => {
      setAdmin(a)
      setOwned(o)
      setReady(true)
    })
  }, [product.id])

  // ถ้ายังไม่ล็อกอิน พาไปหน้า login แล้วจำหน้าเดิมไว้ใน ?next=
  async function requireLogin(): Promise<boolean> {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      router.push('/login?next=' + encodeURIComponent(pathname))
      return false
    }
    return true
  }

  async function download() {
    setMsg('')
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) { setMsg('กรุณาเข้าสู่ระบบก่อน'); return }
    const res = await fetch(`/api/download/${product.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.url) { setMsg(json.error || 'ดาวน์โหลดไม่สำเร็จ'); return }
    window.location.href = json.url
  }

  async function buyNow() {
    if (!(await requireLogin())) return
    if (await checkOwned()) { setOwned(true); return }
    add(product)
    router.push('/checkout')
  }

  async function addToCart() {
    if (!(await requireLogin())) return
    if (await checkOwned()) { setOwned(true); return }
    add(product)
    setMsg('เพิ่มลงตะกร้าแล้ว')
  }

  if (!ready) return null

  if (admin) {
    return (
      <>
        <button className="btn full" onClick={download}>ดาวน์โหลด (แอดมิน)</button>
        {msg && <p className="price" style={{ marginTop: 8 }}>{msg}</p>}
      </>
    )
  }

  if (owned) {
    return (
      <>
        <p style={{ background: '#eef7ee', color: '#1a6b2a', padding: '12px 14px', borderRadius: 10, marginBottom: 10, fontSize: 14 }}>
          คุณซื้อสินค้านี้ไปแล้ว ไม่ต้องซื้อซ้ำ ดาวน์โหลดได้เลย
        </p>
        <button className="btn full" onClick={download}>ดาวน์โหลด</button>
        {msg && <p className="price" style={{ marginTop: 8 }}>{msg}</p>}
      </>
    )
  }

  return (
    <>
      <button className="btn full" style={{ marginBottom: 8 }} onClick={buyNow}>ซื้อเลย</button>
      <button className="btn outline full" onClick={addToCart}>เพิ่มลงตะกร้า</button>
      {msg && <p className="price" style={{ marginTop: 8 }}>{msg}</p>}
    </>
  )
}