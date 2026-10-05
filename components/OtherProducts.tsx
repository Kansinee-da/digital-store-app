'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useCart } from '@/lib/cart'
import { supabase } from '@/lib/supabase'
import Cover from '@/components/Cover'

type P = { id: string; name: string; price: number; cover_path?: string | null; active?: boolean | null }

export default function OtherProducts({ currentId }: { currentId: string }) {
  const { items, add } = useCart()
  const [products, setProducts] = useState<P[]>([])

  useEffect(() => {
    supabase
      .from('products')
      .select('id, name, price, cover_path, active')
      .neq('id', currentId)
      .then(({ data }) => {
        setProducts(
          (data ?? [])
            .filter((p: any) => p.active !== false)
            .map((p: any) => ({ ...p, price: Number(p.price) }))
        )
      })
  }, [currentId])

  if (!products.length) return null

  return (
    <section style={{ marginTop: 56 }}>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>สินค้าอื่น ๆ ที่คุณอาจสนใจ</h2>
      <div className="grid">
        {products.map(p => {
          const inCart = items.some(i => i.id === p.id)
          return (
            <div key={p.id}>
              <Link href={`/product/${p.id}`}>
                <Cover path={p.cover_path} alt={p.name} />
                <b>{p.name}</b>
                <div className="price">฿{p.price}</div>
              </Link>
              <button
                className="btn outline full"
                style={{ marginTop: 8 }}
                disabled={inCart}
                onClick={() => add({ id: p.id, name: p.name, price: p.price })}
              >
                {inCart ? 'อยู่ในตะกร้าแล้ว' : 'ใส่ตะกร้า'}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}