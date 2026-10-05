'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Cover from '@/components/Cover'

type Item = {
  id: string
  name: string
  cover_path?: string | null
  bought_at: string | null
  amount: number | null
}

const fmtDate = (s: string | null) =>
  s
    ? new Date(s).toLocaleString('th-TH', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : ''

export default function LibraryPage() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setItems([]); return }

      const { data, error } = await supabase
        .from('orders')
        .select('created_at, amount, products(id, name, cover_path)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        setMsg('โหลดคลังไม่สำเร็จ: ' + error.message)
        setItems([])
        return
      }

      // รวมสินค้าที่ซ้ำกัน (ซื้อหลายรอบ) ให้เหลือชิ้นเดียว โดยใช้การซื้อครั้งล่าสุด
      const map = new Map<string, Item>()
      for (const o of (data ?? []) as any[]) {
        if (o.products && !map.has(o.products.id)) {
          map.set(o.products.id, {
            id: o.products.id,
            name: o.products.name,
            cover_path: o.products.cover_path,
            bought_at: o.created_at ?? null,
            amount: o.amount ?? null,
          })
        }
      }
      setItems(Array.from(map.values()))
    })()
  }, [])

  async function download(productId: string) {
    setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg('กรุณาเข้าสู่ระบบก่อนดาวน์โหลด'); return }
    const res = await fetch(`/api/download/${productId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const data = await res.json()
    if (data.url) window.open(data.url, '_blank')
    else setMsg(data.error || 'ดาวน์โหลดไม่สำเร็จ')
  }

  return (
    <main className="container">
      <h1>คลังของฉัน</h1>
      {msg && <p style={{ color: '#b00020' }}>{msg}</p>}
      {!items ? (
        <p className="price">กำลังโหลด…</p>
      ) : !items.length ? (
        <div className="empty">ยังไม่มีสินค้าที่ซื้อ</div>
      ) : (
        items.map(i => (
          <div className="cart-row" key={i.id}>
            <Cover path={i.cover_path} alt={i.name} />
            <div className="info">
              <b>{i.name}</b>
              <div className="price">
                ซื้อแล้ว{i.bought_at ? ` · ${fmtDate(i.bought_at)}` : ''}
                {i.amount != null ? ` · ฿${i.amount}` : ''}
              </div>
            </div>
            <button className="btn outline" onClick={() => download(i.id)}>ดาวน์โหลด</button>
          </div>
        ))
      )}
    </main>
  )
}