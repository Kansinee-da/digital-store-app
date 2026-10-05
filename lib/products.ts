import { supabase } from './supabase'

export type Product = {
  id: string
  name: string
  category: string
  price: number
  description: string
  file_path?: string | null
  cover_path?: string | null
  active?: boolean | null
}

export async function getProducts(): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
    if (error || !data) return []
    return data.map((p: any) => ({ ...p, price: Number(p.price) })) as Product[]
  } catch {
    return []
  }
}

export async function getProduct(id: string) {
  return (await getProducts()).find(p => p.id === id)
}

// ลิงก์รูปปก (ที่เก็บ covers เป็น Public)
export function coverUrl(path?: string | null) {
  if (!path) return null
  return supabase.storage.from('covers').getPublicUrl(path).data.publicUrl
}

export const categories = ['ทั้งหมด', 'E-Book', 'คอร์ส']