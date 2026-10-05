'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart'
import { supabase } from '@/lib/supabase'
import Cover from '@/components/Cover'

export default function CheckoutPage() {
  const { items, total, clear } = useCart()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [covers, setCovers] = useState<Record<string, string | null>>({})
  const [popup, setPopup] = useState<{ msg: string; toLibrary: boolean } | null>(null)

  useEffect(() => {
    supabase
      .from('products')
      .select('id, cover_path')
      .then(({ data }) => {
        const map: Record<string, string | null> = {}
        ;(data ?? []).forEach((p: any) => { map[p.id] = p.cover_path })
        setCovers(map)
      })
  }, [])

  async function pay() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setLoading(false)
      alert('กรุณาเข้าสู่ระบบก่อนชำระเงิน')
      router.push('/login')
      return
    }
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ items, total }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok || data.error) {
      setPopup({
        msg: 'ชำระเงินไม่สำเร็จ: ' + (data.error || res.status),
        toLibrary: res.status === 409,
      })
      return
    }
    clear()
    router.push('/orders?success=1')
  }

  if (!items.length) {
    return <main className="container"><h1>ชำระเงิน</h1><p className="price">ไม่มีสินค้าในตะกร้า</p></main>
  }

  return (
    <main className="container split">
      <div>
        <h1>ชำระเงิน</h1>
        {items.map(i => (
          <div className="cart-row" key={i.id}>
            <Cover path={covers[i.id]} alt={i.name} />
            <div className="info"><b>{i.name}</b><div className="price">จำนวน {i.qty}</div></div>
            <b>฿{i.price * i.qty}</b>
          </div>
        ))}
      </div>

      <div className="summary" style={{ textAlign: 'center' }}>
        <b style={{ fontSize: 16 }}>สแกนเพื่อชำระเงิน</b>

        <div style={{
          width: 200, height: 200, margin: '16px auto', border: '2px dashed #ccc',
          borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#999', fontSize: 14, background: '#fafafa',
        }}>
          QR Code (จำลอง)
        </div>

        <p style={{ display: 'flex', justifyContent: 'space-between', margin: '16px 0' }}>
          <span className="price">ยอดที่ต้องชำระ</span><b>฿{total}</b>
        </p>

        <button className="btn full" onClick={pay} disabled={loading}>
          {loading ? 'กำลังดำเนินการ…' : 'ฉันสแกนจ่ายแล้ว'}
        </button>
        <p className="price">โหมดจำลอง: กดยืนยันแล้วระบบจะถือว่าชำระสำเร็จ และปลดล็อกไฟล์ให้ดาวน์โหลดทันที</p>
      </div>

      {popup && (
        <div
          onClick={() => setPopup(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, padding: 24, maxWidth: 380, width: '100%',
              textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,.2)',
            }}
          >
            <p style={{ fontSize: 16, lineHeight: 1.6, margin: '0 0 20px' }}>{popup.msg}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {popup.toLibrary && (
                <button className="btn" onClick={() => { setPopup(null); router.push('/library') }}>
                  ไปที่คลังของฉัน
                </button>
              )}
              <button className="btn outline" onClick={() => setPopup(null)}>ปิด</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}