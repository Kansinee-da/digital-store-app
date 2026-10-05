'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Order = { id: string; product_id: string; product_name: string; amount: number; created_at: string }
const demoOrders: Order[] = [
  { id: '1042', product_id: '1', product_name: 'Notion Template', amount: 299, created_at: '2026-09-20T00:00:00+07:00' },
  { id: '1038', product_id: '3', product_name: 'E-Book Marketing', amount: 199, created_at: '2026-09-15T00:00:00+07:00' },
]

function fmtDate(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const date = d.toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const time = d.toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${date} ${time}`
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [success, setSuccess] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setSuccess(new URLSearchParams(location.search).get('success') === '1')
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setOrders(demoOrders); return }
      const { data, error } = await supabase
        .from('orders').select('id, product_id, amount, created_at, products(name)')
        .eq('user_id', user.id).order('created_at', { ascending: false })
      if (error || !data?.length) { setOrders(demoOrders); return }
      setOrders(data.map((o: any) => ({
        id: o.id, product_id: o.product_id, amount: o.amount, created_at: o.created_at,
        product_name: o.products?.name ?? '-',
      })))
    })()
  }, [])

  async function download(productId: string) {
    setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg('กรุณาเข้าสู่ระบบก่อนดาวน์โหลด'); return }
    const res = await fetch(`/api/download/${productId}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
    const data = await res.json()
    if (data.url) window.open(data.url, '_blank')
    else setMsg(data.error || 'ดาวน์โหลดไม่สำเร็จ')
  }

  return (
    <main className="container">
      <h1>ประวัติคำสั่งซื้อ</h1>
      {success && <p style={{ color: '#0a7d32' }}>ชำระเงินสำเร็จ ขอบคุณที่อุดหนุนร้านของเรา</p>}
      {msg && <p style={{ color: '#b00020' }}>{msg}</p>}
      {!orders ? <p className="price">กำลังโหลด…</p> : !orders.length ? (
        <div className="empty">ยังไม่มีประวัติคำสั่งซื้อ</div>
      ) : (
        <table className="table">
          <thead><tr><th>ออเดอร์</th><th>สินค้า</th><th>วันที่</th><th>ยอด</th><th></th></tr></thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id}>
                <td>#{o.id}</td><td>{o.product_name}</td><td>{fmtDate(o.created_at)}</td><td>฿{o.amount}</td>
                <td><button className="btn outline" onClick={() => download(o.product_id)}>ดาวน์โหลด</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}