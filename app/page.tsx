import Cover from '@/components/Cover'
import RealtimeRefresh from '@/components/RealtimeRefresh'
import Link from 'next/link'
import { getProducts, categories } from '@/lib/products'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function Home({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string }> }) {
  const params = await searchParams
  const cat = params.cat || 'ทั้งหมด'
  const rawQ = params.q || ''
  const q = rawQ.toLowerCase()
  const all = await getProducts()
  const list = all.filter(p => p.active !== false && (cat === 'ทั้งหมด' || p.category === cat) && p.name.toLowerCase().includes(q))
  return (
    <main className="container">
      <RealtimeRefresh table="products" />
      <style>{`#categories:target .chip:not(.on){ border-color:#111; color:#111; }`}</style>
      <section className="hero">
        <h1>Digital Product for You</h1>
        <p>E-Book คอร์ส ดาวน์โหลดได้ทันที</p>
        <form style={{ maxWidth: 380, margin: '20px auto 0' }}>
          <input className="field" name="q" defaultValue={rawQ} placeholder="ค้นหาสินค้า…" style={{ borderRadius: 99 }} />
        </form>
      </section>
      <div id="categories" className="chips" style={{ scrollMarginTop: 80 }}>
        {categories.map(c => <Link key={c} href={`/?cat=${c}`} className={'chip' + (c === cat ? ' on' : '')}>{c}</Link>)}
      </div>
      <p className="price" style={{ textAlign: 'center' }}>พบ {list.length} รายการ จากทั้งหมด {all.length} รายการ</p>
      <div className="grid">
        {list.map(p => (
          <Link key={p.id} href={`/product/${p.id}`}>
            <Cover path={p.cover_path} alt={p.name} style={{ aspectRatio: '4/3' }} />
            <b>{p.name}</b>
            <div className="price">฿{p.price}</div>
          </Link>
        ))}
      </div>
      {!list.length && <p className="price" style={{ textAlign: 'center' }}>ไม่พบสินค้า ลองเปลี่ยนคำค้นหรือหมวดหมู่</p>}
    </main>
  )
}