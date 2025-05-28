import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://iyxjhadvxhrdnyrelbcb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGpoYWR2eGhyZG55cmVsYmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzODgyMDQsImV4cCI6MjA2Mzk2NDIwNH0.V69_Pi96YFAgJrwNFrargFmnWe0TdiAJWwHvI7Yousw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)