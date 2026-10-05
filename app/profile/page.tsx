'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { checkAdmin } from '@/lib/admin-client'

type Order = { id: string; amount: number; created_at: string; product_name: string }

const baht = (n: number) => '฿' + Math.round(n).toLocaleString('en-US')
const card: React.CSSProperties = { border: '1px solid #eee', borderRadius: 16, padding: 20, background: '#fff', marginBottom: 20 }

export default function ProfilePage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [uid, setUid] = useState('')
  const [email, setEmail] = useState('')
  const [joined, setJoined] = useState('')
  const [fullName, setFullName] = useState('')
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState('')
  const [saved, setSaved] = useState({ fullName: '', nickname: '' })
  const [orders, setOrders] = useState<Order[]>([])
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [admin, setAdmin] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login?next=/profile'); return }
      setUid(user.id)
      setEmail(user.email ?? '')
      setJoined(user.created_at ? new Date(user.created_at).toLocaleDateString('th-TH') : '')

      const { data: p } = await supabase
        .from('profiles').select('full_name, nickname, avatar_url').eq('id', user.id).maybeSingle()
      const fn = p?.full_name ?? ''
      const nn = p?.nickname ?? ''
      setFullName(fn); setNickname(nn); setSaved({ fullName: fn, nickname: nn })
      setAvatar(p?.avatar_url ?? '')

      // แอดมินไม่ต้องใช้ข้อมูลการซื้อ
      const adm = await checkAdmin()
      setAdmin(adm)
      if (!adm) {
        const { data } = await supabase
          .from('orders').select('id, amount, created_at, products(name)')
          .eq('user_id', user.id).order('created_at', { ascending: false })
        setOrders((data ?? []).map((o: any) => ({
          id: o.id, amount: Number(o.amount), created_at: o.created_at, product_name: o.products?.name ?? '-',
        })))
      }
      setReady(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setMsg(''); setErr('')
    const fn = fullName.trim()
    const nn = nickname.trim()
    if (!fn) { setErr('กรุณากรอกชื่อ-นามสกุล'); return }
    if (fn.length > 60 || nn.length > 30) { setErr('ชื่อยาวเกินกำหนด'); return }
    setBusy(true)
    const { data, error } = await supabase
      .from('profiles').update({ full_name: fn, nickname: nn || null }).eq('id', uid).select('id')
    setBusy(false)
    if (error) { setErr('บันทึกไม่สำเร็จ: ' + error.message); return }
    if (!data?.length) { setErr('บันทึกไม่สำเร็จ: ไม่มีสิทธิ์แก้ไข'); return }
    setSaved({ fullName: fn, nickname: nn })
    setMsg('บันทึกโปรไฟล์แล้ว')
    window.dispatchEvent(new Event('profile-updated'))
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMsg(''); setErr('')
    if (!file.type.startsWith('image/')) { setErr('ต้องเป็นไฟล์รูปภาพ'); return }
    if (file.size > 5 * 1024 * 1024) { setErr('รูปต้องไม่เกิน 5 MB'); return }
    setBusy(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${uid}/${Date.now()}.${ext}`
    const up = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type })
    if (up.error) { setBusy(false); setErr('อัปโหลดรูปไม่สำเร็จ: ' + up.error.message); return }
    const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
    const { data, error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', uid).select('id')
    setBusy(false)
    if (error || !data?.length) { setErr('บันทึกรูปไม่สำเร็จ'); return }
    setAvatar(url)
    setMsg('เปลี่ยนรูปโปรไฟล์แล้ว')
    window.dispatchEvent(new Event('profile-updated'))
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setMsg(''); setErr('')
    if (newPass.length < 6) { setErr('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return }
    if (newPass !== confirmPass) { setErr('รหัสผ่านทั้งสองช่องไม่ตรงกัน'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setBusy(false)
    if (error) { setErr('เปลี่ยนรหัสผ่านไม่สำเร็จ: ' + error.message); return }
    setNewPass(''); setConfirmPass('')
    setMsg('เปลี่ยนรหัสผ่านแล้ว')
  }

  if (!ready) return <main className="container"><p className="price">กำลังโหลด…</p></main>

  const total = orders.reduce((s, o) => s + o.amount, 0)
  const shown = saved.nickname || saved.fullName || email.split('@')[0]
  const initial = (shown[0] ?? '?').toUpperCase()
  const dirty = fullName.trim() !== saved.fullName || nickname.trim() !== saved.nickname

  return (
    <main className="container" style={{ maxWidth: 760 }}>
      <h1>โปรไฟล์ของฉัน</h1>

      <section style={{ ...card, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {avatar ? (
          <img src={avatar} alt={shown} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#111', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 600 }}>
            {initial}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {shown}
            {admin && <span style={{ marginLeft: 8, fontSize: 12, padding: '2px 9px', borderRadius: 99, background: '#f0f0f0', color: '#666', verticalAlign: 'middle' }}>แอดมิน</span>}
          </div>
          {saved.nickname && saved.fullName && <div className="price">{saved.fullName}</div>}
          <div className="price">{email}</div>
          {joined && <div className="price" style={{ fontSize: 13 }}>สมัครเมื่อ {joined}</div>}
        </div>
        <label className="btn outline" style={{ cursor: 'pointer' }}>
          {busy ? 'กำลังอัปโหลด…' : 'เปลี่ยนรูป'}
          <input type="file" accept="image/*" onChange={uploadAvatar} disabled={busy} style={{ display: 'none' }} />
        </label>
      </section>

      {!admin && (
        <div className="stats" style={{ marginBottom: 20 }}>
          <div className="stat"><span>ออเดอร์ทั้งหมด</span><b>{orders.length}</b></div>
          <div className="stat"><span>ยอดซื้อรวม</span><b>{baht(total)}</b></div>
        </div>
      )}

      {(msg || err) && (
        <p style={{ color: err ? '#b00020' : '#0a7d32', marginBottom: 12 }}>{err || msg}</p>
      )}

      <section style={card}>
        <b style={{ fontSize: 16 }}>ข้อมูลส่วนตัว</b>

        <form onSubmit={saveProfile} style={{ marginTop: 14 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 4 }}>ชื่อ-นามสกุล</label>
          <input className="field" value={fullName} maxLength={60} onChange={e => setFullName(e.target.value)} />
          <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 4 }}>ชื่อเล่น</label>
          <input className="field" value={nickname} maxLength={30} placeholder="เช่น อาย" onChange={e => setNickname(e.target.value)} />
          <button className="btn" type="submit" disabled={busy || !dirty}>บันทึก</button>
        </form>

        <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '20px 0' }} />

        <form onSubmit={savePassword}>
          <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 4 }}>เปลี่ยนรหัสผ่าน</label>
          <input className="field" type="password" placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)" value={newPass} onChange={e => setNewPass(e.target.value)} />
          <input className="field" type="password" placeholder="ยืนยันรหัสผ่านใหม่" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
          <button className="btn outline" type="submit" disabled={busy || !newPass}>เปลี่ยนรหัสผ่าน</button>
        </form>
      </section>

      {!admin && (
        <section style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 16 }}>ออเดอร์ล่าสุด</b>
            <a href="/orders" className="price" style={{ fontSize: 14 }}>ดูทั้งหมด / ดาวน์โหลด →</a>
          </div>
          {!orders.length ? (
            <p className="price" style={{ marginTop: 10 }}>ยังไม่มีคำสั่งซื้อ</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ marginTop: 10 }}>
                <thead><tr><th>สินค้า</th><th>วันที่</th><th>ยอด</th></tr></thead>
                <tbody>
                  {orders.slice(0, 5).map(o => (
                    <tr key={o.id}>
                      <td>{o.product_name}</td>
                      <td>{new Date(o.created_at).toLocaleDateString('th-TH')}</td>
                      <td>{baht(o.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  )
}