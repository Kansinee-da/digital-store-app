'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/lib/cart'
import { supabase } from '@/lib/supabase'
import { checkAdmin } from '@/lib/admin-client'

type U = { id: string; email?: string } | null

// หน้าที่ต้องล็อกอินก่อนถึงเข้าได้
const PROTECTED = ['/library', '/orders', '/checkout', '/profile', '/admin']
const isProtected = (p: string) => PROTECTED.some(x => p.startsWith(x))

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const { count } = useCart()
  const [user, setUser] = useState<U | undefined>(undefined) // undefined = กำลังเช็ก
  const [prof, setProf] = useState<{ nickname: string; avatar: string }>({ nickname: '', avatar: '' })
  const loggingOut = useRef(false)
  const wasAdmin = useRef(false)
  const [admin, setAdmin] = useState(false)

  useEffect(() => {
    if (!user) { setAdmin(false); return }
    checkAdmin().then(setAdmin)
  }, [user?.id])

  // ฟังการเปลี่ยนสิทธิ์แอดมินแบบเรียลไทม์ (ตาราง profiles คอลัมน์ is_admin)
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel('admin-perm-' + user.id)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        () => { checkAdmin().then(setAdmin) }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  // เคยเป็นแอดมิน แล้วถูกถอนสิทธิ์ขณะอยู่หน้า /admin -> เด้งออกไปหน้าแรก
  useEffect(() => {
    if (wasAdmin.current && !admin && pathname.startsWith('/admin')) {
      router.replace('/')
    }
    wasAdmin.current = admin
  }, [admin, pathname, router])

  async function loadProfile(id?: string) {
    if (!id) { setProf({ nickname: '', avatar: '' }); return }
    const { data } = await supabase
      .from('profiles').select('nickname, full_name, avatar_url').eq('id', id).maybeSingle()
    setProf({ nickname: data?.nickname || data?.full_name || '', avatar: data?.avatar_url || '' })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      loadProfile(data.session?.user?.id)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      loadProfile(session?.user?.id)
    })
    const refresh = () => supabase.auth.getSession().then(({ data }) => loadProfile(data.session?.user?.id))
    window.addEventListener('profile-updated', refresh)
    return () => {
      sub.subscription.unsubscribe()
      window.removeEventListener('profile-updated', refresh)
    }
  }, [])

  // ถึงหน้าที่ไม่ต้องล็อกอินแล้ว ให้เลิกจำว่ากำลังออกจากระบบ
  useEffect(() => {
    if (!isProtected(pathname)) loggingOut.current = false
  }, [pathname])

  // ยังไม่ล็อกอิน + อยู่หน้าที่ต้องล็อกอิน -> ไป login (จำหน้าเดิมไว้)
  useEffect(() => {
    if (user === null && isProtected(pathname) && !loggingOut.current) {
      router.replace('/login?next=' + encodeURIComponent(pathname))
    }
  }, [user, pathname, router])

  async function logout() {
    loggingOut.current = true
    await supabase.auth.signOut()
    setUser(null)
    if (isProtected(pathname)) router.replace('/')
    else router.refresh()
  }

  const loggedIn = !!user
  const active = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)
  const loginHref = pathname === '/login' ? '/login' : '/login?next=' + encodeURIComponent(pathname)
  const label = prof.nickname || user?.email?.split('@')[0] || ''
  const initial = (label[0] ?? '?').toUpperCase()

  return (
    <>
      <style>{`
        .nav-top { display:flex; justify-content:space-between; align-items:center;
          padding:0 32px; height:64px; border-bottom:1px solid #eee; background:#fff;
          position:sticky; top:0; z-index:20; }
        .nav-logo { font-weight:700; font-size:18px; color:#111; text-decoration:none; }
        .nav-links { display:flex; gap:28px; align-items:center; }
        .nav-links a, .nav-links button, .nav-bottom button {
          color:#6b6b6b; font-size:14px; text-decoration:none; background:none; border:0;
          padding:0; cursor:pointer; font-family:inherit; }
        .nav-links a.on { color:#111; font-weight:600; }
        .nav-me { display:flex; align-items:center; }
        .nav-avatar { width:30px; height:30px; border-radius:50%; object-fit:cover; background:#111; color:#fff;
          display:grid; place-items:center; font-size:13px; font-weight:600; flex:none; }
        .nav-me.on .nav-avatar { outline:2px solid #111; outline-offset:2px; }
        .nav-bottom { display:none; }
        @media (max-width: 768px) {
          .nav-top { padding:0 16px; height:56px; }
          .nav-links { display:none; }
          .nav-bottom { display:flex; position:fixed; left:0; right:0; bottom:0; height:60px;
            background:#fff; border-top:1px solid #eee; z-index:30;
            padding-bottom:env(safe-area-inset-bottom); }
          .nav-bottom a, .nav-bottom button { flex:1; display:flex; align-items:center;
            justify-content:center; font-size:13px; color:#6b6b6b; text-decoration:none; }
          .nav-bottom a.on { color:#111; font-weight:700; }
          body { padding-bottom:64px; }
        }
      `}</style>

      <header className="nav-top">
        <Link href={admin ? '/admin' : '/'} className="nav-logo">DigitalStore</Link>
        {user !== undefined && (
          <nav className="nav-links">
            <Link href="/" className={active('/') && !active('/admin') ? 'on' : ''}>สินค้า</Link>
            {loggedIn ? (
              <>
                {admin ? (
                  <Link href="/admin" className={active('/admin') ? 'on' : ''}>Admin</Link>
                ) : (
                  <>
                    <Link href="/library" className={active('/library') ? 'on' : ''}>คลังของฉัน</Link>
                    <Link href="/cart" className={active('/cart') ? 'on' : ''}>
                      ตะกร้า{count > 0 ? ` (${count})` : ''}
                    </Link>
                  </>
                )}
                <button onClick={logout}>ออกจากระบบ</button>
                <Link
                  href="/profile"
                  className={'nav-me' + (active('/profile') ? ' on' : '')}
                  title="โปรไฟล์ของฉัน"
                  aria-label="โปรไฟล์ของฉัน"
                >
                  {prof.avatar ? (
                    <img src={prof.avatar} alt="" className="nav-avatar" />
                  ) : (
                    <span className="nav-avatar">{initial}</span>
                  )}
                </Link>
              </>
            ) : (
              <Link href={loginHref} className={active('/login') ? 'on' : ''}>เข้าสู่ระบบ</Link>
            )}
          </nav>
        )}
      </header>

      {user !== undefined && (
        <nav className="nav-bottom">
          <Link href="/" className={pathname === '/' ? 'on' : ''}>หน้าแรก</Link>
          {loggedIn ? (
            <>
              {admin ? (
                <Link href="/admin" className={active('/admin') ? 'on' : ''}>Admin</Link>
              ) : (
                <>
                  <Link href="/cart" className={active('/cart') ? 'on' : ''}>
                    ตะกร้า{count > 0 ? ` (${count})` : ''}
                  </Link>
                  <Link href="/library" className={active('/library') ? 'on' : ''}>คลัง</Link>
                </>
              )}
              <Link href="/profile" className={active('/profile') ? 'on' : ''}>โปรไฟล์</Link>
              <button onClick={logout}>ออก</button>
            </>
          ) : (
            <Link href={loginHref} className={active('/login') ? 'on' : ''}>เข้าสู่ระบบ</Link>
          )}
        </nav>
      )}
    </>
  )
}

export default Nav
