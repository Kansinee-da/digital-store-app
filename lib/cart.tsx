'use client'
import { createContext, useContext, useEffect, useState } from 'react'
export type CartItem = { id: string; name: string; price: number; qty: number }
type CartCtx = {
  items: CartItem[]
  add: (item: Omit<CartItem, 'qty'>) => void
  remove: (id: string) => void
  setQty: (id: string, qty: number) => void
  clear: () => void
  total: number
  count: number
}
const Ctx = createContext<CartCtx | null>(null)
const KEY = 'digitalstore_cart'

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setItems(JSON.parse(raw).map((i: CartItem) => ({ ...i, qty: 1 })))
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)) } catch {}
  }, [items])

  function add(item: Omit<CartItem, 'qty'>) {
    setItems(prev => {
      const found = prev.find(p => p.id === item.id)
      if (found) return prev.map(p => p.id === item.id ? { ...p, qty: p.qty + 1 } : p)
      return [...prev, { ...item, qty: 1 }]
    })
  }
  function remove(id: string) { setItems(prev => prev.filter(p => p.id !== id)) }
  function setQty(id: string, qty: number) {
    setItems(prev => prev.map(p => p.id === id ? { ...p, qty: Math.max(1, qty) } : p))
  }
  function clear() { setItems([]) }
  const total = items.reduce((s, i) => s + i.price * i.qty, 0)
  const count = items.reduce((s, i) => s + i.qty, 0)

  return <Ctx.Provider value={{ items, add, remove, setQty, clear, total, count }}>{children}</Ctx.Provider>
}
export function useCart() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCart ต้องอยู่ใต้ CartProvider')
  return ctx
}