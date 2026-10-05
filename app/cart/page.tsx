'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useCart } from '@/lib/cart'
import { supabase } from '@/lib/supabase'
import Cover from '@/components/Cover'

type P = { id: string; name: string; price: number; cover_path?: string | null; active?: boolean | null }

export default function CartPage() {
  const { items, total, remove, add } = useCart()
  const [products, setProducts] = useState<P[]>([])

  useEffect(() => {
    supabase
      .from('products')
      .select('id, name, price, cover_path, active')
      .then(({ data }) => {
        setProducts((data ?? []).map((p: any) => ({ ...p, price: Number(p.price) })))
      })
  }, [])

  const coverOf = (id: string) => products.find(p => p.id === id)?.cover_path
  const others = products.filter(p => p.active !== false && !items.some(i => i.id === p.id))

  return (
    <main className="container">
      {!items.length ? (
        <>
          <h1>ตะกร้าสินค้า</h1>
          <p className="price">ยังไม่มีสินค้าในตะกร้า</p>
        </>
      ) : (
        <div className="split">
          <div>
            <h1>ตะกร้าสินค้า</h1>
            {items.map(i => (
              <div className="cart-row" key={i.id}>
                <Cover path={coverOf(i.id)} alt={i.name} />
                <div className="info">
                  <b>{i.name}</b>
                  <div className="price">฿{i.price}</div>
                  <button
                    onClick={() => remove(i.id)}
                    style={{ marginTop: 6, background: 'none', border: 0, padding: 0, color: '#b00020', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}
                  >
                    ลบ
                  </button>
                </div>
                <b>฿{i.price}</b>
              </div>
            ))}
          </div>

          <div className="summary">
            <b style={{ fontSize: 16 }}>สรุปคำสั่งซื้อ</b>
            <p style={{ display: 'flex', justifyContent: 'space-between', margin: '16px 0' }}>
              <span className="price">ยอดรวม</span><b>฿{total}</b>
            </p>
            <Link href="/checkout" className="btn full">ไปหน้าชำระเงิน</Link>
          </div>
        </div>
      )}

      {others.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>สินค้าอื่น ๆ ที่คุณอาจสนใจ</h2>
          <div className="grid">
            {others.map(p => (
              <div key={p.id}>
                <Link href={`/product/${p.id}`}>
                  <Cover path={p.cover_path} alt={p.name} />
                  <b>{p.name}</b>
                  <div className="price">฿{p.price}</div>
                </Link>
                <button
                  className="btn outline full"
                  style={{ marginTop: 8 }}
                  onClick={() => add({ id: p.id, name: p.name, price: p.price })}
                >
                  ใส่ตะกร้า
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}