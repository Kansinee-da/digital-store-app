'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function RealtimeRefresh({ table }: { table: string }) {
  const router = useRouter()

  useEffect(() => {
    const channel = supabase
      .channel('rt-' + table)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => router.refresh()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [table, router])

  return null
}