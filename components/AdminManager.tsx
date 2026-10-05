'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isOwner } from '@/lib/admin-client'

type P = { id: string; email: string | null; full_name: string | null; nickname: string | null; is_admin: boolean }

export default function AdminManager() {
  const [list, setList] = useState<P[]>([])
  const [me, setMe] = useState('')
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const [bad, setBad] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('profiles').select('id, email, full_name, nickname, is_admin').order('created_at')
    setList((data ?? []) as P[])
  }
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setMe(data.session?.user?.email ?? ''))
    load()
  }, [])

  // ฟังการเปลี่ยนแปลงของตาราง profiles แบบเรียลไทม์
  useEffect(() => {
    const channel = supabase
      .channel('admin-manager-profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => { load() }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const owner = isOwner(me)
  const nameOf = (p: P) => p.nickname || p.full_name || '–'
  const admins = list.filter(p => p.is_admin || isOwner(p.email))
  const key = q.trim().toLowerCase()
  const matches = key
    ? list.filter(p => !(p.is_admin || isOwner(p.email)) &&
        ((p.email ?? '').toLowerCase().includes(key) || nameOf(p).toLowerCase().includes(key))).slice(0, 5)
    : []

  async function setRole(p: P, value: boolean) {
    const label = p.email || nameOf(p)
    if (!window.confirm(value ? `เพิ่ม ${label} เป็นแอดมิน ?` : `ถอนสิทธิ์แอดมินของ ${label} ?`)) return
    setBusy(true); setMsg('')
    const { data, error } = await supabase.from('profiles').update({ is_admin: value }).eq('id', p.id).select('id')
    setBusy(false)
    if (error || !data?.length) {
      setBad(true)
      setMsg('ไม่สำเร็จ: ' + (error?.message || 'ไม่มีสิทธิ์ (เฉพาะเจ้าของระบบ หรือยังไม่ได้รัน SQL)'))
      return
    }
    setBad(false)
    setMsg(value ? `เพิ่ม ${label} เป็นแอดมินแล้ว` : `ถอนสิทธิ์แอดมินของ ${label} แล้ว`)
    setQ('')
    load()
  }

  return (
    <div className="adm-card" style={{ marginTop: 20 }}>
      <b style={{ fontSize: 16 }}>จัดการแอดมิน</b>
      {msg && <p className={'adm-msg' + (bad ? ' bad' : '')} style={{ marginTop: 12 }}>{msg}</p>}

      <div className="adm-scroll">
        <table className="table" style={{ marginTop: 8 }}>
          <thead><tr><th>ชื่อ</th><th>อีเมล</th><th></th></tr></thead>
          <tbody>
            {admins.map(p => (
              <tr key={p.id}>
                <td>{nameOf(p)}</td>
                <td>{p.email}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {isOwner(p.email)
                    ? <span className="adm-tag">เจ้าของระบบ</span>
                    : owner && <button className="adm-act red" disabled={busy} onClick={() => setRole(p, false)}>ถอนสิทธิ์</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {owner ? (
        <>
          <p className="price" style={{ margin: '14px 0 6px', fontSize: 13 }}>
            เพิ่มแอดมิน: พิมพ์อีเมลหรือชื่อของผู้ใช้ที่สมัครสมาชิกแล้ว
          </p>
          <input className="field" style={{ maxWidth: 340 }} value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาอีเมล / ชื่อ" />
          {key && !matches.length && <p className="price" style={{ fontSize: 13 }}>ไม่พบผู้ใช้ (ต้องสมัครสมาชิกก่อน)</p>}
          {matches.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '8px 0', borderTop: '1px solid #eee' }}>
              <span>{nameOf(p)} <span className="price">· {p.email}</span></span>
              <button className="btn outline" disabled={busy} onClick={() => setRole(p, true)}>เพิ่มเป็นแอดมิน</button>
            </div>
          ))}
        </>
      ) : (
        <p className="price" style={{ fontSize: 13, marginTop: 12 }}>เฉพาะเจ้าของระบบที่เพิ่มหรือถอนแอดมินได้</p>
      )}
    </div>
  )
}