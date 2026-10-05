'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { checkAdmin } from '@/lib/admin-client'

// อ่าน ?next= และกันไม่ให้เด้งไปเว็บอื่น (ต้องขึ้นต้นด้วย / เท่านั้น)
function getNext(): string | null {
  if (typeof window === 'undefined') return null
  const n = new URLSearchParams(window.location.search).get('next')
  if (n && n.startsWith('/') && !n.startsWith('//')) return n
  return null
}

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)

  async function goHome(_email?: string | null) {
    const next = getNext()
    const a = await checkAdmin()
    router.replace(a ? '/admin' : next || '/')
    router.refresh()
  }

  // ล็อกอินอยู่แล้ว (รวมถึงกลับมาจาก Google) -> ไปหน้าที่เหมาะกับสิทธิ์
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goHome(data.session.user.email)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function thai(m: string) {
    if (m.includes('Invalid login credentials')) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง (ถ้ายังไม่มีบัญชี ให้กด "สมัครสมาชิก" ก่อน)'
    if (m.includes('already registered')) return 'อีเมลนี้สมัครไปแล้ว ให้กลับไปเข้าสู่ระบบ'
    if (m.includes('at least 6')) return 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร'
    if (m.includes('Email not confirmed')) return 'ยังไม่ได้ยืนยันอีเมล (ปิด Confirm email ใน Supabase หรือกดลิงก์ในอีเมล)'
    if (m.toLowerCase().includes('rate limit')) return 'ส่งคำขอถี่เกินไป รอสักครู่แล้วลองใหม่'
    return m
  }

  function switchMode() {
    setMode(m => (m === 'in' ? 'up' : 'in'))
    setMsg('')
    setOk(false)
  }

  function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) { setOk(false); setMsg('รูปโปรไฟล์ต้องเป็นไฟล์รูปภาพ'); return }
    if (f.size > 5 * 1024 * 1024) { setOk(false); setMsg('รูปโปรไฟล์ต้องไม่เกิน 5 MB'); return }
    setMsg('')
    setAvatarFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function googleLogin() {
    setMsg(''); setOk(false)
    const next = getNext()
    const redirectTo =
      window.location.origin + '/login' + (next ? '?next=' + encodeURIComponent(next) : '')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) setMsg(thai(error.message))
  }

  async function submit() {
    setMsg(''); setOk(false)
    if (!email.trim() || !password) {
      setMsg('กรุณากรอกอีเมลและรหัสผ่าน')
      return
    }
    if (mode === 'up' && !name.trim()) {
      setMsg('กรุณากรอกชื่อ-นามสกุล')
      return
    }
    setLoading(true)

    if (mode === 'in') {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      setLoading(false)
      if (error) { setMsg(thai(error.message)); return }
      goHome(data.user?.email)
      return
    }

    // สมัครสมาชิก
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim(), nickname: nickname.trim() } },
    })
    if (error) { setLoading(false); setMsg(thai(error.message)); return }

    let note = ''
    if (data.session && data.user) {
      // มี session ชั่วคราวหลังสมัคร -> บันทึกโปรไฟล์ + อัปโหลดรูปตอนนี้เลย
      const uid = data.user.id
      let avatarUrl: string | null = null

      if (avatarFile) {
        const ext = (avatarFile.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${uid}/${Date.now()}.${ext}`
        const up = await supabase.storage.from('avatars').upload(path, avatarFile, { contentType: avatarFile.type })
        if (up.error) note = ' (อัปโหลดรูปไม่สำเร็จ ตั้งรูปได้ที่หน้าโปรไฟล์ภายหลัง)'
        else avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      }

      const upd = await supabase
        .from('profiles')
        .update({ full_name: name.trim(), nickname: nickname.trim() || null, ...(avatarUrl ? { avatar_url: avatarUrl } : {}) })
        .eq('id', uid)
        .select('id')
      if (upd.error || !upd.data?.length) {
        note = note || ' (บันทึกชื่อเล่น/รูปไม่สำเร็จ ตั้งได้ที่หน้าโปรไฟล์ภายหลัง)'
      }

      // สมัครเสร็จ -> ออกจากระบบ แล้วให้กลับไปเข้าสู่ระบบเอง
      await supabase.auth.signOut()
    } else if (avatarFile || nickname.trim()) {
      note = ' (ต้องยืนยันอีเมลก่อน แล้วตั้งรูป/ชื่อเล่นได้ที่หน้าโปรไฟล์)'
    }

    setLoading(false)
    setMode('in')
    setPassword('')
    setAvatarFile(null); setPreview(''); setNickname('')
    setOk(true)
    setMsg('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง' + note)
  }

  return (
    <main className="card">
      <h2 style={{ marginBottom: 4 }}>{mode === 'in' ? 'เข้าสู่ระบบ' : 'สร้างบัญชีใหม่'}</h2>
      <p className="price" style={{ marginTop: 0 }}>
        {mode === 'in' ? 'ยินดีต้อนรับกลับมา' : 'เริ่มซื้อ-ขาย Digital Product'}
      </p>

      {mode === 'up' && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '8px 0 14px', cursor: 'pointer' }}>
            {preview ? (
              <img src={preview} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <span style={{ width: 64, height: 64, borderRadius: '50%', background: '#f0f0f0', color: '#999', display: 'grid', placeItems: 'center', fontSize: 12, textAlign: 'center' }}>
                รูป
              </span>
            )}
            <span style={{ fontSize: 14, color: '#555' }}>
              {preview ? 'เปลี่ยนรูปโปรไฟล์' : 'เลือกรูปโปรไฟล์ (ไม่บังคับ)'}
            </span>
            <input type="file" accept="image/*" onChange={pickAvatar} style={{ display: 'none' }} />
          </label>
          <input className="field" placeholder="ชื่อ-นามสกุล" value={name} onChange={e => setName(e.target.value)} />
          <input className="field" placeholder="ชื่อเล่น (ไม่บังคับ)" maxLength={30} value={nickname} onChange={e => setNickname(e.target.value)} />
        </>
      )}
      <input className="field" placeholder="อีเมล" value={email} onChange={e => setEmail(e.target.value)} />
      <input
        className="field"
        type="password"
        placeholder={mode === 'in' ? 'รหัสผ่าน' : 'รหัสผ่าน (6 ตัวขึ้นไป)'}
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
      />

      <button className="btn full" disabled={loading} onClick={submit}>
        {loading ? 'กำลังดำเนินการ...' : mode === 'in' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
      </button>

      <p style={{ textAlign: 'center', fontSize: 13, color: '#aaa', margin: '16px 0 12px' }}>หรือ</p>

      <button className="btn outline full" onClick={googleLogin}>
        เข้าสู่ระบบด้วย Google
      </button>

      <p style={{ textAlign: 'center', fontSize: 14, color: '#888', marginTop: 16 }}>
        {mode === 'in' ? 'ยังไม่มีบัญชี? ' : 'มีบัญชีอยู่แล้ว? '}
        <a href="#" onClick={e => { e.preventDefault(); switchMode() }} style={{ color: '#111', fontWeight: 700 }}>
          {mode === 'in' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
        </a>
      </p>

      {msg && <p className={ok ? '' : 'err'} style={ok ? { color: '#15803d' } : undefined}>{msg}</p>}
    </main>
  )
}