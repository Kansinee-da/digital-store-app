import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qzeddrjnmpcosstxmxzz.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6ZWRkcmpubXBjb3NzdHhteHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NTA1ODAsImV4cCI6MjEwNjUyNjU4MH0.lrFdnVgXBlZGcITJzziyHhzz0wGlE0Jo71ncggdfP9o'
)
