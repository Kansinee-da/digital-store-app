import OtherProducts from '@/components/OtherProducts'
import Cover from '@/components/Cover'
import { notFound } from 'next/navigation'
import { getProduct } from '@/lib/products'
import BuyButtons from '@/components/BuyButtons'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export default async function ProductPage({ params }: { params: { id: string } }) {
  const p = await getProduct(params.id)
if (!p || p.active === false) notFound() 
  return (
    <>
      <main className="container detail">
        <Cover path={p.cover_path} alt={p.name} style={{ aspectRatio: '4/3' }} />
        <div>
          <span className="price">{p.category}</span>
          <h1 style={{ margin: '4px 0' }}>{p.name}</h1>
          <p className="price">{p.description}</p>
          <div style={{ fontSize: 26, fontWeight: 600, margin: '16px 0' }}>฿{p.price}</div>
          <BuyButtons product={p} />
          <p className="price" style={{ marginTop: 14 }}><b>ไฟล์ที่ได้รับ</b></p>
          <p className="price">📄 {p.name}.pdf</p>
          <p className="price">ดาวน์โหลดได้ทันทีหลังชำระเงิน</p>
        </div>
      </main>

      <div className="container">
        <OtherProducts currentId={params.id} />
      </div>
    </>
  )
}