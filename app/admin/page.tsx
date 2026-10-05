'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { checkAdmin } from '@/lib/admin-client'
import AdminManager from '@/components/AdminManager'
import { getProducts, type Product } from '@/lib/products'

const CATS = ['E-Book', 'คอร์ส']
const emptyForm = { name: '', category: 'E-Book', price: '', description: '' }
const CLEAR_PHRASE = 'ลบออเดอร์ทั้งหมด'

type Order = { id: string; user_id: string; product_id: string; amount: number; created_at: string; name: string }
type View = 'dashboard' | 'products' | 'orders' | 'customers' | 'reports' | 'settings'
type Sold = { qty: number; revenue: number; first: string; last: string }

const MENU: { key: View; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'products', label: 'สินค้า' },
  { key: 'orders', label: 'ออเดอร์' },
  { key: 'customers', label: 'ลูกค้า' },
  { key: 'reports', label: 'รายงาน' },
  { key: 'settings', label: 'ตั้งค่า' },
]

// อ่าน CSV (รองรับเครื่องหมายคำพูดและ , ในรายละเอียด)
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  text = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ } else q = false
      } else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''; rows.push(row); row = []
    } else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(x => x.trim() !== ''))
}

const extOf = (name: string, fallback: string) => {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] : fallback
}
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const monthKey = (d: Date) => dayKey(d).slice(0, 7)

// กราฟเส้นยอดขาย (SVG ไม่ต้องติดตั้งแพ็กเกจ)
function SalesChart({ data }: { data: { label: string; value: number }[] }) {
  const W = 640, H = 240, L = 48, R = 16, T = 26, B = 30
  const max = Math.max(1, ...data.map(d => d.value))
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, data.length - 1)
  const y = (v: number) => H - B - (v / max) * (H - T - B)
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ')
  const step = data.length > 14 ? 5 : 1
  const showValues = data.length <= 7
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 0.5, 1].map(g => (
        <g key={g}>
          <line x1={L} x2={W - R} y1={y(max * g)} y2={y(max * g)} stroke="#eee" />
          <text x={L - 6} y={y(max * g) + 4} fontSize="11" textAnchor="end" fill="#999">{Math.round(max * g)}</text>
        </g>
      ))}
      <polyline points={pts} fill="none" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r="3.5" fill="#111" />)}
      {showValues && data.map((d, i) => d.value > 0 && (
        <text key={'v' + i} x={x(i)} y={y(d.value) - 9} fontSize="11" textAnchor="middle" fill="#111">฿{d.value}</text>
      ))}
      {data.map((d, i) => i % step === 0 && (
        <text key={'t' + i} x={x(i)} y={H - 8} fontSize="11" textAnchor="middle" fill="#999">{d.label}</text>
      ))}
    </svg>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [adminEmail, setAdminEmail] = useState('')
  const [view, setView] = useState<View>('dashboard')
  const [range, setRange] = useState<7 | 30>(7)
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [profiles, setProfiles] = useState<Record<string, { email: string | null; full_name: string | null }>>({})
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [reportFilter, setReportFilter] = useState<'all' | 'active' | 'stopped'>('all')
  const [confirmText, setConfirmText] = useState('')
  const csvRef = useRef<HTMLInputElement>(null)
  const jsonRef = useRef<HTMLInputElement>(null)
  const anyRef = useRef<HTMLInputElement>(null)

  async function load() { setProducts(await getProducts()) }
  async function loadOrders() {
    const { data } = await supabase
      .from('orders')
      .select('id, user_id, product_id, amount, created_at, products(name)')
      .order('created_at', { ascending: false })
    setOrders((data ?? []).map((o: any) => ({
      id: o.id, user_id: o.user_id, product_id: o.product_id, amount: Number(o.amount), created_at: o.created_at,
      name: o.products?.name ?? '(ไม่พบสินค้า)',
    })))
  }
  async function loadProfiles() {
    const { data } = await supabase.from('profiles').select('id, email, full_name')
    setProfiles(Object.fromEntries((data ?? []).map((p: any) => [p.id, { email: p.email, full_name: p.full_name }])))
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (await checkAdmin()) {
        setAllowed(true)
        setAdminEmail(data.session?.user?.email ?? '')
        load()
        loadOrders()
        loadProfiles()
      } else {
        setAllowed(false)
        router.replace('/')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // เรียลไทม์: มีออเดอร์ใหม่/ถูกลบ -> โหลดข้อมูลใหม่ทันที
  // + polling ทุก 15 วินาที เป็นตัวสำรองเผื่อ Realtime หลุด
  useEffect(() => {
    if (allowed !== true) return

    const channel = supabase
      .channel('admin-orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadOrders()
        loadProfiles()
      })
      .subscribe()

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadOrders()
        loadProfiles()
      }
    }, 15000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed])

  // มีข้อความแจ้งเตือนใหม่ -> เลื่อนขึ้นบนสุดให้เห็นเสมอ
  useEffect(() => {
    if (msg) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [msg])

  // ---------- ตัวเลขสรุป ----------
  const stats = useMemo(() => ({
    sales: orders.reduce((s, o) => s + o.amount, 0),
    orders: orders.length,
    customers: new Set(orders.map(o => o.user_id)).size,
  }), [orders])

  // ยอดขายรายวันย้อนหลัง 7 / 30 วัน
  const daily = useMemo(() => {
    const days: { key: string; date: Date; label: string; value: number; qty: number }[] = []
    const t = new Date()
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i)
      days.push({ key: dayKey(d), date: d, label: `${d.getDate()}/${d.getMonth() + 1}`, value: 0, qty: 0 })
    }
    const idx = new Map(days.map((d, i) => [d.key, i]))
    for (const o of orders) {
      const i = idx.get(dayKey(new Date(o.created_at)))
      if (i !== undefined) { days[i].value += o.amount; days[i].qty += 1 }
    }
    return days
  }, [orders, range])

  const rangeSales = daily.reduce((s, d) => s + d.value, 0)
  const rangeQty = daily.reduce((s, d) => s + d.qty, 0)
  const todaySales = daily.length ? daily[daily.length - 1].value : 0

  // สินค้าขายดีในช่วงที่เลือก
  const rangeBest = useMemo(() => {
    const keys = new Set(daily.map(d => d.key))
    const m = new Map<string, { name: string; qty: number; revenue: number }>()
    for (const o of orders) {
      if (!keys.has(dayKey(new Date(o.created_at)))) continue
      const r = m.get(o.name) ?? { name: o.name, qty: 0, revenue: 0 }
      r.qty += 1; r.revenue += o.amount
      m.set(o.name, r)
    }
    return Array.from(m.values()).sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 5)
  }, [orders, daily])

  // สรุปยอดขายรายเดือน (ย้อนหลังสูงสุด 12 เดือน)
  const monthly = useMemo(() => {
    const m = new Map<string, { key: string; label: string; qty: number; revenue: number; byProduct: Map<string, { qty: number; revenue: number }> }>()
    const ensure = (d: Date) => {
      const key = monthKey(d)
      let r = m.get(key)
      if (!r) {
        r = { key, label: d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }), qty: 0, revenue: 0, byProduct: new Map() }
        m.set(key, r)
      }
      return r
    }
    ensure(new Date())
    for (const o of orders) {
      const r = ensure(new Date(o.created_at))
      r.qty += 1; r.revenue += o.amount
      const p = r.byProduct.get(o.name) ?? { qty: 0, revenue: 0 }
      p.qty += 1; p.revenue += o.amount
      r.byProduct.set(o.name, p)
    }
    return Array.from(m.values())
      .sort((a, b) => b.key.localeCompare(a.key))
      .slice(0, 12)
      .map(r => {
        let best: { name: string; qty: number; revenue: number } | null = null
        for (const [name, v] of Array.from(r.byProduct.entries())) {
          if (!best || v.qty > best.qty || (v.qty === best.qty && v.revenue > best.revenue)) {
            best = { name, qty: v.qty, revenue: v.revenue }
          }
        }
        return { key: r.key, label: r.label, qty: r.qty, revenue: r.revenue, best }
      })
  }, [orders])

  // ยอดขายแยกตามสินค้า (รวมสินค้าที่เลิกขายแล้วด้วย)
  const soldBy = useMemo(() => {
    const m = new Map<string, Sold>()
    for (const o of orders) {
      const r = m.get(o.product_id)
      if (!r) m.set(o.product_id, { qty: 1, revenue: o.amount, first: o.created_at, last: o.created_at })
      else {
        r.qty += 1; r.revenue += o.amount
        if (o.created_at < r.first) r.first = o.created_at
        if (o.created_at > r.last) r.last = o.created_at
      }
    }
    return m
  }, [orders])

  const customers = useMemo(() => {
    const m = new Map<string, { id: string; count: number; total: number }>()
    for (const o of orders) {
      const r = m.get(o.user_id) ?? { id: o.user_id, count: 0, total: 0 }
      r.count += 1; r.total += o.amount
      m.set(o.user_id, r)
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total)
  }, [orders])

  const reportRows = useMemo(() => {
    return products
      .map(p => ({ p, s: soldBy.get(p.id), active: p.active !== false }))
      .filter(r => reportFilter === 'all' || (reportFilter === 'active' ? r.active : !r.active))
      .sort((a, b) => (b.s?.revenue ?? 0) - (a.s?.revenue ?? 0))
  }, [products, soldBy, reportFilter])

  const stoppedList = products.filter(p => p.active === false)
  const stoppedRevenue = stoppedList.reduce((s, p) => s + (soldBy.get(p.id)?.revenue ?? 0), 0)

  // ---------- เพิ่ม / แก้ไข / เลิกขาย-เปิดขาย / ลบ สินค้า ----------
  function resetForm() {
    setForm(emptyForm); setEditingId(null); setCoverFile(null); setPdfFile(null); setFileKey(k => k + 1)
  }
  function startEdit(p: Product) {
    setEditingId(p.id)
    setForm({ name: p.name, category: CATS.includes(p.category) ? p.category : CATS[0], price: String(p.price), description: p.description || '' })
    setCoverFile(null); setPdfFile(null); setFileKey(k => k + 1)
    setMsg(''); setView('products'); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function toggleActive(p: Product) {
    const next = p.active === false // ตอนนี้เลิกขายอยู่ -> เปิดขายใหม่
    const { data, error } = await supabase.from('products').update({ active: next }).eq('id', p.id).select('id')
    if (error) { setMsg('เปลี่ยนสถานะไม่สำเร็จ: ' + error.message); return }
    if (!data?.length) { setMsg('เปลี่ยนสถานะไม่สำเร็จ: ไม่มีสิทธิ์แก้ไข (รัน SQL policy ของแอดมินใน Supabase ก่อน)'); return }
    setMsg(next ? `เปิดขาย "${p.name}" อีกครั้งแล้ว` : `เลิกขาย "${p.name}" แล้ว (ยังเก็บประวัติการขายไว้)`)
    load()
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')

    if (coverFile && !coverFile.type.startsWith('image/')) { setMsg('รูปปกต้องเป็นไฟล์รูปภาพ (jpg, png, webp)'); return }
    if (coverFile && coverFile.size > 5 * 1024 * 1024) { setMsg('รูปปกต้องมีขนาดไม่เกิน 5 MB'); return }
    if (pdfFile && pdfFile.type !== 'application/pdf') { setMsg('ไฟล์สินค้าต้องเป็น PDF'); return }
    if (pdfFile && pdfFile.size > 50 * 1024 * 1024) { setMsg('ไฟล์ PDF ต้องมีขนาดไม่เกิน 50 MB'); return }

    setSaving(true)
    const editing = editingId ? products.find(p => p.id === editingId) : undefined
    let newCover: string | null = null
    let newFile: string | null = null

    if (coverFile) {
      const p = `${crypto.randomUUID()}.${extOf(coverFile.name, 'jpg')}`
      const { error } = await supabase.storage.from('covers').upload(p, coverFile, { contentType: coverFile.type })
      if (error) { setSaving(false); setMsg('อัปโหลดรูปปกไม่สำเร็จ: ' + error.message); return }
      newCover = p
    }
    if (pdfFile) {
      const p = `${crypto.randomUUID()}.pdf`
      const { error } = await supabase.storage.from('product-files').upload(p, pdfFile, { contentType: 'application/pdf' })
      if (error) {
        if (newCover) await supabase.storage.from('covers').remove([newCover])
        setSaving(false); setMsg('อัปโหลดไฟล์ PDF ไม่สำเร็จ: ' + error.message); return
      }
      newFile = p
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(), category: form.category, price: Number(form.price), description: form.description,
    }
    if (newCover) payload.cover_path = newCover
    if (newFile) payload.file_path = newFile

    const res = editing
      ? await supabase.from('products').update(payload).eq('id', editing.id).select('id')
      : await supabase.from('products').insert(payload).select('id')
    setSaving(false)

    const failed = res.error || !res.data?.length
    if (failed) {
      if (newCover) await supabase.storage.from('covers').remove([newCover])
      if (newFile) await supabase.storage.from('product-files').remove([newFile])
      setMsg('บันทึกไม่สำเร็จ: ' + (res.error ? res.error.message : 'ไม่มีสิทธิ์บันทึก (รัน SQL policy ของแอดมินใน Supabase ก่อน)'))
      return
    }

    // แก้ไขแล้วเปลี่ยนไฟล์ -> ลบไฟล์เก่าทิ้ง
    if (editing) {
      if (newCover && editing.cover_path) await supabase.storage.from('covers').remove([editing.cover_path])
      if (newFile && editing.file_path) await supabase.storage.from('product-files').remove([editing.file_path])
    }
    setMsg(editing ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มสินค้าแล้ว')
    resetForm()
    load()
  }

  // ลบถาวร: ลบสินค้า + ประวัติการขายของสินค้านี้ + ไฟล์ใน Storage
  async function removeProduct(p: Product) {
    const s = soldBy.get(p.id)
    const text = s?.qty
      ? `ลบถาวร "${p.name}" ?\n\nสินค้านี้เคยขายแล้ว ${s.qty} เล่ม (฿${s.revenue})\nการลบจะลบประวัติการขายเหล่านี้ทิ้งด้วย และลูกค้าจะไม่เห็นสินค้านี้ในคลังอีก\n\nถ้าแค่อยากเลิกขายแต่เก็บประวัติไว้ ให้กดยกเลิก แล้วใช้สวิตช์ "กำลังขาย" แทน`
      : `ลบถาวร "${p.name}" ?`
    if (!window.confirm(text)) return

    if (s?.qty) {
      const o = await supabase.from('orders').delete().eq('product_id', p.id).select('id')
      if (o.error) { setMsg('ลบประวัติออเดอร์ไม่สำเร็จ: ' + o.error.message); return }
      if (!o.data?.length) { setMsg('ลบประวัติออเดอร์ไม่สำเร็จ: ไม่มีสิทธิ์ลบ (รัน SQL policy "แอดมินลบออเดอร์" ใน Supabase ก่อน)'); return }
    }
    const d = await supabase.from('products').delete().eq('id', p.id).select('id')
    if (d.error) { setMsg('ลบไม่สำเร็จ: ' + d.error.message); return }
    if (!d.data?.length) { setMsg('ลบไม่สำเร็จ: ไม่มีสิทธิ์ลบ (รัน SQL policy ของแอดมินใน Supabase ก่อน)'); return }

    if (p.cover_path) await supabase.storage.from('covers').remove([p.cover_path])
    if (p.file_path) await supabase.storage.from('product-files').remove([p.file_path])
    if (editingId === p.id) resetForm()
    setMsg(`ลบ "${p.name}" แล้ว`)
    load()
    loadOrders()
  }

  // ---------- ลบออเดอร์ (ล้างข้อมูลทดสอบ) ----------
  async function removeOrder(o: Order) {
    if (!window.confirm(`ลบออเดอร์ #${o.id.slice(0, 6)} (${o.name} ฿${o.amount}) ?`)) return
    const { data, error } = await supabase.from('orders').delete().eq('id', o.id).select('id')
    if (error) { setMsg('ลบออเดอร์ไม่สำเร็จ: ' + error.message); return }
    if (!data?.length) { setMsg('ลบออเดอร์ไม่สำเร็จ: ไม่มีสิทธิ์ลบ (รัน SQL policy "แอดมินลบออเดอร์" ใน Supabase ก่อน)'); return }
    setMsg('ลบออเดอร์แล้ว')
    loadOrders()
  }

  async function clearAllOrders() {
    if (confirmText.trim() !== CLEAR_PHRASE) { setMsg(`ต้องพิมพ์ "${CLEAR_PHRASE}" ให้ตรงก่อนจึงจะลบได้`); return }
    if (!orders.length) { setMsg('ยังไม่มีออเดอร์ให้ลบ'); return }
    if (!window.confirm(`ลบออเดอร์ทั้งหมด ${orders.length} รายการ ?\nย้อนกลับไม่ได้ และลูกค้าจะเห็นคลังว่าง`)) return
    const { error, count } = await supabase.from('orders').delete({ count: 'exact' }).not('id', 'is', null)
    if (error) { setMsg('ลบออเดอร์ไม่สำเร็จ: ' + error.message); return }
    if (!count) { setMsg('ลบออเดอร์ไม่สำเร็จ: ไม่มีสิทธิ์ลบ (รัน SQL policy "แอดมินลบออเดอร์" ใน Supabase ก่อน)'); return }
    setConfirmText('')
    setMsg(`ลบออเดอร์ทั้งหมด ${count} รายการแล้ว`)
    loadOrders()
  }

  // ---------- Export ----------
  function downloadBlob(blob: Blob, filename: string) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = filename; a.click()
  }
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  function exportJSON() {
    downloadBlob(new Blob([JSON.stringify(products, null, 2)], { type: 'application/json' }), 'products.json')
  }
  function exportCSV() {
    const header = 'id,name,category,price,description\n'
    const rows = products.map(p => [p.id, p.name, p.category, p.price, p.description].map(esc).join(',')).join('\n')
    downloadBlob(new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8' }), 'products.csv')
  }
  function exportReport() {
    const header = 'name,status,copies_sold,revenue,first_sale,last_sale\n'
    const rows = reportRows.map(({ p, s, active }) => [
      p.name, active ? 'กำลังขาย' : 'เลิกขายแล้ว', s?.qty ?? 0, s?.revenue ?? 0,
      s ? new Date(s.first).toLocaleDateString('th-TH') : '', s ? new Date(s.last).toLocaleDateString('th-TH') : '',
    ].map(esc).join(',')).join('\n')
    downloadBlob(new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8' }), 'sales-report.csv')
  }

  // ---------- Import ----------
  async function importFile(file: File) {
    setMsg('กำลังอ่านไฟล์…')

    let raw: any[] = []
    try {
      const text = await file.text()
      if (file.name.toLowerCase().endsWith('.json')) {
        const j = JSON.parse(text)
        raw = Array.isArray(j) ? j : []
      } else if (file.name.toLowerCase().endsWith('.csv')) {
        const rows = parseCSV(text)
        const head = (rows[0] || []).map(h => h.trim().toLowerCase())
        raw = rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
      } else {
        setMsg('ไม่พบไฟล์ที่รองรับ ต้องเป็นไฟล์ .csv หรือ .json เท่านั้น')
        return
      }
    } catch {
      setMsg('อ่านไฟล์ไม่สำเร็จ ตรวจสอบว่าเป็นไฟล์ CSV หรือ JSON ที่รูปแบบถูกต้อง')
      return
    }

    const valid: { name: string; category: string; price: number; description: string }[] = []
    let skipped = 0
    for (const r of raw) {
      const name = String(r?.name ?? '').trim()
      const category = String(r?.category ?? '').trim()
      const price = Number(r?.price)
      if (!name || !CATS.includes(category) || !Number.isFinite(price) || price < 0) { skipped++; continue }
      valid.push({ name, category, price, description: String(r?.description ?? '').trim() })
    }
    if (!valid.length) {
      setMsg(`ไม่พบรายการที่นำเข้าได้ (ข้าม ${skipped} แถว) ไฟล์ต้องมีคอลัมน์ name, category, price, description และหมวดหมู่ต้องเป็น ${CATS.join(' / ')}`)
      return
    }
    const { error } = await supabase.from('products').insert(valid)
    if (error) { setMsg('นำเข้าไม่สำเร็จ: ' + error.message); return }
    setMsg(`นำเข้าสำเร็จ ${valid.length} รายการ` + (skipped ? ` (ข้าม ${skipped} แถวที่ข้อมูลไม่ถูกต้อง)` : ''))
    load()
  }
  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) importFile(file)
  }

  if (allowed !== true) {
    return <main className="container"><p className="price">กำลังตรวจสอบสิทธิ์…</p></main>
  }

  const who = (id: string) => profiles[id]?.email || '#' + id.slice(0, 6)
  const fmtDate = (s: string) =>
    new Date(s).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
  const fmtDay = (s: string) => new Date(s).toLocaleDateString('th-TH')
  const bad = /ไม่สำเร็จ|ไม่พบ|ไม่มีสิทธิ์|ต้อง|ยกเลิก|ยังไม่มี/.test(msg)
  const nowMonth = monthKey(new Date())

  const dropZone = (
    <div
      className={'adm-dz' + (dragOver ? ' over' : '')}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault(); setDragOver(false)
        const f = e.dataTransfer.files?.[0]
        if (f) importFile(f)
      }}
      onClick={() => anyRef.current?.click()}
    >
      ลากไฟล์ CSV / JSON มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
    </div>
  )

  return (
    <main className="container" style={{ maxWidth: 1400, width: '100%' }}>
      <style>{`
        .adm { display:grid; grid-template-columns:220px minmax(0,1fr); gap:28px; align-items:start; }
        .adm-side { border:1px solid #eee; border-radius:16px; padding:16px; position:sticky; top:80px; background:#fff; }
        .adm-side .logo { display:block; margin:4px 8px 14px; font-size:17px; }
        .adm-side button { display:block; width:100%; text-align:left; background:none; border:0; padding:11px 14px;
          border-radius:10px; color:#888; font:inherit; font-size:15px; cursor:pointer; }
        .adm-side button.on { background:#f4f4f4; color:#111; font-weight:600; }
        .adm-card { border:1px solid #eee; border-radius:16px; padding:22px; background:#fff; }
        .adm-two { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:20px; margin-top:20px; }
        .adm-prod { display:grid; grid-template-columns:minmax(0,1fr) 380px; gap:20px; align-items:start; }
        .adm-prod .summary { position:static !important; top:auto !important; }
        .adm-dz { border:1.5px dashed #ccc; border-radius:12px; padding:22px 16px; text-align:center; margin-top:14px;
          color:#888; font-size:14px; cursor:pointer; transition:background .12s,border-color .12s; }
        .adm-dz.over, .adm-dz:hover { background:#fafafa; border-color:#111; color:#111; }
        .adm-scroll { overflow-x:auto; }
        .adm-maxh { max-height:380px; overflow-y:auto; }
        .adm .table { font-size:15px; }
        .adm .table th, .adm .table td { padding:14px 12px; }
        .adm-act { background:none; border:0; padding:0; margin-right:14px; font:inherit; font-size:15px; cursor:pointer; color:#111; }
        .adm-act.red { color:#b00020; margin-right:0; }
        .adm-hidden td { opacity:.5; }
        .adm-hidden td:nth-child(3), .adm-hidden td:nth-last-child(-n+2) { opacity:1; }
        .adm-zero td { color:#aaa; }
        .adm-switch { position:relative; width:46px; height:26px; border-radius:99px; border:0; background:#cfcfcf;
          cursor:pointer; padding:0; transition:background .15s; flex:none; }
        .adm-switch::after { content:''; position:absolute; top:3px; left:3px; width:20px; height:20px; border-radius:50%;
          background:#fff; transition:transform .15s; box-shadow:0 1px 2px rgba(0,0,0,.25); }
        .adm-switch.on { background:#111; }
        .adm-switch.on::after { transform:translateX(20px); }
        .adm-msg { padding:12px 16px; border-radius:12px; margin:0 0 16px; font-size:15px; background:#eef7ee; color:#14532d; }
        .adm-msg.bad { background:#fdecea; color:#8a1c1c; }
        .adm-chip { border:1px solid #ddd; background:#fff; border-radius:99px; padding:7px 16px; font:inherit; font-size:14px; cursor:pointer; color:#555; }
        .adm-chip.on { background:#111; border-color:#111; color:#fff; }
        .adm-danger { border:1px solid #f1c4c4; background:#fff8f8; }
        .adm-tag { display:inline-block; font-size:12px; padding:2px 9px; border-radius:99px; background:#f0f0f0; color:#666; }
        .adm-tag.stop { background:#fdecea; color:#8a1c1c; }
        @media (max-width: 1180px) {
          .adm-prod { grid-template-columns:1fr; }
          .adm-prod .summary { order:-1; }
        }
        @media (max-width: 900px) {
          .adm { grid-template-columns:1fr; }
          .adm-side { position:static; display:flex; gap:6px; overflow-x:auto; padding:8px; }
          .adm-side .logo { display:none; }
          .adm-side button { width:auto; white-space:nowrap; }
          .adm-two { grid-template-columns:1fr; }
        }
      `}</style>

      <input ref={csvRef} type="file" accept=".csv,text/csv" onChange={handleImport} style={{ display: 'none' }} />
      <input ref={jsonRef} type="file" accept=".json,application/json" onChange={handleImport} style={{ display: 'none' }} />
      <input ref={anyRef} type="file" accept=".csv,.json,text/csv,application/json" onChange={handleImport} style={{ display: 'none' }} />

      <div className="adm">
        <aside className="adm-side">
          <b className="logo">DigitalStore</b>
          {MENU.map(m => (
            <button key={m.key} className={view === m.key ? 'on' : ''} onClick={() => { setView(m.key); setMsg('') }}>
              {m.label}
            </button>
          ))}
        </aside>

        <section>
          {msg && <p className={'adm-msg' + (bad ? ' bad' : '')}>{msg}</p>}

          {/* ================= Dashboard ================= */}
          {view === 'dashboard' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0 }}>Dashboard</h1>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={'adm-chip' + (range === 7 ? ' on' : '')} onClick={() => setRange(7)}>7 วันล่าสุด</button>
                  <button className={'adm-chip' + (range === 30 ? ' on' : '')} onClick={() => setRange(30)}>30 วันล่าสุด</button>
                </div>
              </div>

              <div className="stats" style={{ marginTop: 16 }}>
                <div className="stat"><span>ยอดขายวันนี้</span><b>฿{todaySales}</b></div>
                <div className="stat"><span>ยอดขาย {range} วันล่าสุด</span><b>฿{rangeSales}</b></div>
                <div className="stat"><span>ขายได้ {range} วันล่าสุด</span><b>{rangeQty} เล่ม</b></div>
                <div className="stat"><span>ยอดขายรวมทั้งหมด</span><b>฿{stats.sales}</b></div>
              </div>

              <div className="adm-card" style={{ marginTop: 20 }}>
                <b style={{ fontSize: 16 }}>ยอดขายรายวัน ({range} วันล่าสุด)</b>
                <div style={{ marginTop: 12 }}><SalesChart data={daily} /></div>
              </div>

              <div className="adm-card adm-scroll" style={{ marginTop: 20 }}>
                <b style={{ fontSize: 16 }}>สรุปยอดขายรายเดือน</b>
                <table className="table" style={{ marginTop: 8 }}>
                  <thead><tr><th>เดือน</th><th>ขายได้</th><th>ยอดขาย</th><th>ขายดีที่สุด</th></tr></thead>
                  <tbody>
                    {monthly.map(m => (
                      <tr key={m.key}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {m.label} {m.key === nowMonth && <span className="adm-tag" style={{ marginLeft: 6 }}>เดือนนี้</span>}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{m.qty} เล่ม</td>
                        <td style={{ whiteSpace: 'nowrap' }}><b>฿{m.revenue}</b></td>
                        <td>{m.best ? `${m.best.name} · ${m.best.qty} เล่ม (฿${m.best.revenue})` : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="adm-two">
                <div className="adm-card">
                  <b style={{ fontSize: 16 }}>สรุปยอดขายรายวัน</b>
                  <div className="adm-maxh" style={{ marginTop: 8 }}>
                    <table className="table">
                      <thead><tr><th>วัน</th><th>ขายได้</th><th>ยอดขาย</th></tr></thead>
                      <tbody>
                        {daily.slice().reverse().map(d => (
                          <tr key={d.key} className={d.qty ? '' : 'adm-zero'}>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {d.date.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </td>
                            <td>{d.qty ? `${d.qty} เล่ม` : '–'}</td>
                            <td>{d.qty ? <b>฿{d.value}</b> : '฿0'}</td>
                          </tr>
                        ))}
                        <tr>
                          <td><b>รวม</b></td><td><b>{rangeQty} เล่ม</b></td><td><b>฿{rangeSales}</b></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="adm-card">
                  <b style={{ fontSize: 16 }}>สินค้าขายดี ({range} วันล่าสุด)</b>
                  {!rangeBest.length ? (
                    <p className="price">ยังไม่มีข้อมูลการขายในช่วงนี้</p>
                  ) : (
                    <table className="table" style={{ marginTop: 8 }}>
                      <thead><tr><th>สินค้า</th><th>ขายได้</th><th>ยอดขาย</th></tr></thead>
                      <tbody>
                        {rangeBest.map(b => (
                          <tr key={b.name}><td>{b.name}</td><td>{b.qty} เล่ม</td><td>฿{b.revenue}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ================= สินค้า ================= */}
          {view === 'products' && (
            <>
              <h1 style={{ marginTop: 0 }}>สินค้า</h1>
              <div className="adm-prod">
                <div className="adm-card">
                  <b style={{ fontSize: 16 }}>รายการสินค้า</b>
                  <div className="adm-scroll" style={{ marginTop: 6 }}>
                    <table className="table">
                      <thead><tr><th>ชื่อ</th><th>ราคา</th><th>ขายได้</th><th>ไฟล์</th><th>สถานะ</th><th></th></tr></thead>
                      <tbody>
                        {products.map(p => {
                          const shown = p.active !== false
                          const s = soldBy.get(p.id)
                          return (
                            <tr key={p.id} className={shown ? '' : 'adm-hidden'}>
                              <td>
                                <div>{p.name}</div>
                                <div style={{ fontSize: 13, color: '#888' }}>{p.category}</div>
                              </td>
                              <td style={{ whiteSpace: 'nowrap' }}>฿{p.price}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                <div>{s?.qty ?? 0} เล่ม</div>
                                <div style={{ fontSize: 13, color: '#888' }}>฿{s?.revenue ?? 0}</div>
                              </td>
                              <td style={{ fontSize: 14, color: '#888', whiteSpace: 'nowrap' }}>
                                <div>{p.cover_path ? 'ปก ✓' : 'ปก –'}</div>
                                <div>{p.file_path?.endsWith('.pdf') ? 'PDF ✓' : 'PDF –'}</div>
                              </td>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                                  <button
                                    type="button"
                                    className={'adm-switch' + (shown ? ' on' : '')}
                                    onClick={() => toggleActive(p)}
                                    aria-pressed={shown}
                                    aria-label={shown ? 'เลิกขายสินค้า' : 'เปิดขายสินค้า'}
                                    title={shown ? 'กดเพื่อเลิกขาย (ซ่อนจากหน้าร้าน เก็บประวัติไว้)' : 'กดเพื่อเปิดขายอีกครั้ง'}
                                  />
                                  <span style={{ fontSize: 14 }}>{shown ? 'กำลังขาย' : 'เลิกขายแล้ว'}</span>
                                </span>
                              </td>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                <button className="adm-act" onClick={() => startEdit(p)}>แก้ไข</button>
                                <button className="adm-act red" onClick={() => removeProduct(p)}>ลบ</button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!products.length && <p className="price">ยังไม่มีสินค้า เพิ่มสินค้าแรกได้ที่ฟอร์ม "+ เพิ่มสินค้า"</p>}
                  <p className="price" style={{ marginTop: 10, fontSize: 13 }}>
                    เลิกขาย = ซ่อนจากหน้าร้านแต่เก็บประวัติการขายไว้ ลูกค้าที่ซื้อแล้วยังดาวน์โหลดได้ และกดสวิตช์เพื่อเปิดขายอีกครั้งได้ ·
                    ลบ = ลบถาวร (รวมประวัติการขายของสินค้านั้น)
                  </p>

                  <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn outline" onClick={() => csvRef.current?.click()}>Import CSV</button>
                    <button className="btn outline" onClick={() => jsonRef.current?.click()}>Import JSON</button>
                    <button className="btn outline" onClick={exportCSV}>Export CSV</button>
                    <button className="btn outline" onClick={exportJSON}>Export JSON</button>
                  </div>
                  {dropZone}
                  <p className="price" style={{ marginTop: 10, fontSize: 13 }}>
                    ไฟล์ที่นำเข้าต้องมีคอลัมน์ name, category, price, description (คอลัมน์ id ไม่จำเป็น)
                  </p>
                </div>

                <div className="summary">
                  <b style={{ fontSize: 17 }}>{editingId ? 'แก้ไขสินค้า' : '+ เพิ่มสินค้า'}</b>
                  <form onSubmit={saveProduct} style={{ marginTop: 14 }}>
                    <input className="field" placeholder="ชื่อสินค้า" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    <select className="field" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                      {CATS.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <input className="field" placeholder="ราคา" type="number" min="0" required value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                    <textarea className="field" placeholder="รายละเอียด" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

                    <label style={{ display: 'block', fontSize: 13, color: '#888', margin: '4px 0' }}>
                      รูปปก (jpg, png, webp ไม่เกิน 5 MB){editingId ? ' — เลือกใหม่เฉพาะเมื่อต้องการเปลี่ยน' : ''}
                    </label>
                    <input key={'c' + fileKey} type="file" accept="image/*" onChange={e => setCoverFile(e.target.files?.[0] ?? null)} style={{ marginBottom: 12, fontSize: 13 }} />

                    <label style={{ display: 'block', fontSize: 13, color: '#888', margin: '4px 0' }}>
                      ไฟล์สินค้า PDF (ไม่เกิน 50 MB){editingId ? ' — เลือกใหม่เฉพาะเมื่อต้องการเปลี่ยน (ลูกค้าที่เคยซื้อจะได้ไฟล์ใหม่)' : ''}
                    </label>
                    <input key={'p' + fileKey} type="file" accept="application/pdf" onChange={e => setPdfFile(e.target.files?.[0] ?? null)} style={{ marginBottom: 12, fontSize: 13 }} />

                    <button className="btn full" type="submit" disabled={saving}>
                      {saving ? 'กำลังบันทึก…' : editingId ? 'บันทึกการแก้ไข' : 'บันทึกสินค้า'}
                    </button>
                    {editingId && (
                      <button className="btn outline full" type="button" style={{ marginTop: 8 }} onClick={resetForm}>
                        ยกเลิกการแก้ไข
                      </button>
                    )}
                  </form>
                </div>
              </div>
            </>
          )}

          {/* ================= ออเดอร์ ================= */}
          {view === 'orders' && (
            <>
              <h1 style={{ marginTop: 0 }}>ออเดอร์</h1>
              <div className="adm-card adm-scroll">
                {!orders.length ? <p className="price">ยังไม่มีออเดอร์</p> : (
                  <table className="table">
                    <thead><tr><th>ออเดอร์</th><th>สินค้า</th><th>ยอด</th><th>วันที่</th><th>ลูกค้า</th><th></th></tr></thead>
                    <tbody>
                      {orders.map(o => (
                        <tr key={o.id}>
                          <td>#{o.id.slice(0, 6)}</td><td>{o.name}</td><td>฿{o.amount}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(o.created_at)}</td>
                          <td>{who(o.user_id)}</td>
                          <td><button className="adm-act red" onClick={() => removeOrder(o)}>ลบ</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ================= ลูกค้า ================= */}
          {view === 'customers' && (
            <>
              <h1 style={{ marginTop: 0 }}>ลูกค้า</h1>
              <div className="adm-card adm-scroll">
                {!customers.length ? <p className="price">ยังไม่มีลูกค้าที่สั่งซื้อ</p> : (
                  <table className="table">
                    <thead><tr><th>ชื่อ</th><th>อีเมล</th><th>จำนวนออเดอร์</th><th>ยอดซื้อรวม</th></tr></thead>
                    <tbody>
                      {customers.map(c => (
                        <tr key={c.id}><td>{profiles[c.id]?.full_name || '–'}</td><td>{who(c.id)}</td><td>{c.count}</td><td>฿{c.total}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ================= รายงาน ================= */}
          {view === 'reports' && (
            <>
              <h1 style={{ marginTop: 0 }}>รายงานการขาย</h1>
              <div className="stats">
                <div className="stat"><span>ยอดขายรวม</span><b>฿{stats.sales}</b></div>
                <div className="stat"><span>ขายได้ทั้งหมด</span><b>{orders.length} เล่ม</b></div>
                <div className="stat"><span>สินค้าที่เลิกขายแล้ว</span><b>{stoppedList.length}</b></div>
                <div className="stat"><span>ยอดขายจากสินค้าที่เลิกขาย</span><b>฿{stoppedRevenue}</b></div>
              </div>

              <div className="adm-card" style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className={'adm-chip' + (reportFilter === 'all' ? ' on' : '')} onClick={() => setReportFilter('all')}>ทั้งหมด</button>
                    <button className={'adm-chip' + (reportFilter === 'active' ? ' on' : '')} onClick={() => setReportFilter('active')}>กำลังขาย</button>
                    <button className={'adm-chip' + (reportFilter === 'stopped' ? ' on' : '')} onClick={() => setReportFilter('stopped')}>เลิกขายแล้ว</button>
                  </div>
                  <button className="btn outline" onClick={exportReport}>Export รายงาน CSV</button>
                </div>

                <div className="adm-scroll" style={{ marginTop: 12 }}>
                  {!reportRows.length ? <p className="price">ไม่มีสินค้าในหมวดนี้</p> : (
                    <table className="table">
                      <thead>
                        <tr><th>สินค้า</th><th>สถานะ</th><th>ขายได้</th><th>ยอดขาย</th><th>ขายครั้งแรก</th><th>ขายล่าสุด</th></tr>
                      </thead>
                      <tbody>
                        {reportRows.map(({ p, s, active }) => (
                          <tr key={p.id}>
                            <td>{p.name}</td>
                            <td><span className={'adm-tag' + (active ? '' : ' stop')}>{active ? 'กำลังขาย' : 'เลิกขายแล้ว'}</span></td>
                            <td>{s?.qty ?? 0} เล่ม</td>
                            <td>฿{s?.revenue ?? 0}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{s ? fmtDay(s.first) : '–'}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{s ? fmtDay(s.last) : '–'}</td>
                          </tr>
                        ))}
                        <tr>
                          <td><b>รวม</b></td><td></td>
                          <td><b>{reportRows.reduce((a, r) => a + (r.s?.qty ?? 0), 0)} เล่ม</b></td>
                          <td><b>฿{reportRows.reduce((a, r) => a + (r.s?.revenue ?? 0), 0)}</b></td>
                          <td></td><td></td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ================= ตั้งค่า ================= */}
          {view === 'settings' && (
            <>
              <h1 style={{ marginTop: 0 }}>ตั้งค่า</h1>

              <div className="adm-two" style={{ marginTop: 0 }}>
                <div className="adm-card">
                  <b style={{ fontSize: 16 }}>บัญชีแอดมิน</b>
                  <p className="price" style={{ margin: '10px 0 0' }}>อีเมลที่ใช้เข้าหน้านี้</p>
                  <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{adminEmail}</p>
                  <p className="price" style={{ fontSize: 13 }}>บัญชีอื่นที่ไม่ได้ถูกเพิ่มเป็นแอดมินเป็นลูกค้า เข้าหน้า Admin ไม่ได้</p>
                </div>
                <div className="adm-card">
                  <b style={{ fontSize: 16 }}>ข้อมูลในระบบ</b>
                  <table className="table" style={{ marginTop: 8 }}>
                    <tbody>
                      <tr><td>สินค้า</td><td>{products.length} (เลิกขาย {stoppedList.length})</td></tr>
                      <tr><td>ออเดอร์</td><td>{orders.length}</td></tr>
                      <tr><td>ลูกค้าที่เคยซื้อ</td><td>{stats.customers}</td></tr>
                      <tr><td>ยอดขายรวม</td><td>฿{stats.sales}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <AdminManager />

              <div className="adm-card adm-danger" style={{ marginTop: 20 }}>
                <b style={{ fontSize: 16 }}>ล้างออเดอร์ทั้งหมด (ล้างข้อมูลทดสอบ)</b>
                <p className="price" style={{ marginTop: 8 }}>
                  ใช้ตอนจะเริ่มขายของจริง จะลบออเดอร์ทุกรายการ ยอดขายกลับเป็น 0 และคลังของลูกค้าจะว่าง
                  สินค้าและไฟล์ของสินค้าไม่ถูกลบ · ย้อนกลับไม่ได้
                </p>
                <p className="price" style={{ marginBottom: 6, fontSize: 13 }}>พิมพ์ "{CLEAR_PHRASE}" เพื่อยืนยัน</p>
                <input className="field" style={{ maxWidth: 340 }} value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={CLEAR_PHRASE} />
                <div>
                  <button className="btn" style={{ background: '#b00020', borderColor: '#b00020' }} onClick={clearAllOrders}>
                    ลบออเดอร์ทั้งหมด ({orders.length})
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}