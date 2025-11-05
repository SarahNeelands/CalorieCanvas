import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wktnorhpdxfchoscnclc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrdG5vcmhwZHhmY2hvc2NuY2xjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMzYyMDgsImV4cCI6MjA3NzcxMjIwOH0.4SXPRh6pNXNbDIPxL-lkNupSQt-dxQKiV0n_pGtjN4w'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
