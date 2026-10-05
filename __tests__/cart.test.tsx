import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { CartProvider, useCart } from '../lib/cart'

describe('useCart Hook', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('ควรเพิ่มสินค้าลงในตะกร้าได้ถูกต้อง', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider })

    act(() => {
      result.current.add({ id: '1', name: 'E-Book React', price: 100 })
    })

    expect(result.current.items.length).toBe(1)
    expect(result.current.count).toBe(1)
    expect(result.current.total).toBe(100)
  })

  it('ควรเพิ่มจำนวนเมื่อเพิ่มสินค้าชิ้นเดิม', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider })

    act(() => {
      result.current.add({ id: '1', name: 'E-Book React', price: 100 })
      result.current.add({ id: '1', name: 'E-Book React', price: 100 })
    })

    expect(result.current.items.length).toBe(1)
    expect(result.current.count).toBe(2)
    expect(result.current.total).toBe(200)
  })

  it('ควรลบสินค้าและล้างตะกร้าได้ถูกต้อง', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider })

    act(() => {
      result.current.add({ id: '1', name: 'Item 1', price: 100 })
      result.current.add({ id: '2', name: 'Item 2', price: 200 })
    })

    act(() => {
      result.current.remove('1')
    })

    expect(result.current.items.length).toBe(1)
    expect(result.current.total).toBe(200)

    act(() => {
      result.current.clear()
    })

    expect(result.current.items.length).toBe(0)
    expect(result.current.count).toBe(0)
  })
})
